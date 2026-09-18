import { createTestRenderer } from "@opentui/core/testing"
import { expect, spyOn, test } from "bun:test"

import * as client from "~/client"
import * as chatActions from "~/client/chatActions"
import { appState } from "~/state/AppState"
import { chatListManager } from "~/views/ChatListManager"
import { destroyConversationScrollBox } from "~/views/ConversationView"

test.each([false, true])(
  "clicking a chat after an incoming message opens its displayed name (object IDs: %s)",
  async (objectIds) => {
    const mocks = [
      spyOn(client, "loadContacts").mockResolvedValue(undefined),
      spyOn(client, "loadMessages").mockResolvedValue(undefined),
      spyOn(client, "startPresenceManagement").mockImplementation(() => {}),
      spyOn(chatActions, "markChatRead").mockResolvedValue(undefined),
    ]
    const { renderer, renderOnce, mockMouse, captureCharFrame } = await createTestRenderer({
      width: 144,
      height: 46,
    })
    appState.reset()
    appState.setCurrentSession("test")
    appState.setChats(
      ["Alpha", "Bravo", "Charlie", ...Array.from({ length: 30 }, (_, i) => `Extra ${i}`)].map(
        (name) => ({
          id: objectIds ? ({ _serialized: `${name}@c.us` } as unknown as string) : `${name}@c.us`,
          name,
          picture: null,
          lastMessage: {},
          _chat: {},
        })
      )
    )
    appState.setCurrentView("chats")
    const renderApp = () => {
      renderer.root.add(chatListManager.buildChatList(renderer, appState.getState().chats))
    }
    const unsubscribe = appState.subscribe(() => renderApp())
    try {
      renderApp()
      await renderOnce()
      const chats = appState.getState().chats
      appState.setChats([
        {
          ...chats[2],
          lastMessage: { id: "incoming", timestamp: 1_800_000_000, body: "New message" },
        },
        ...chats.filter((_, index) => index !== 2),
      ])
      await renderOnce()
      for (const name of ["Charlie", "Alpha", "Bravo", "Charlie"]) {
        const lines = captureCharFrame().split("\n")
        const y = lines.findIndex((line) => line.slice(0, 55).includes(name))
        const x = lines[y].indexOf(name)
        await mockMouse.click(x + 1, y)
        await renderOnce()
        expect(appState.getState().currentChatId).toBe(`${name}@c.us`)
        expect(appState.getState().currentView).toBe("conversation")
        expect(client.loadMessages).toHaveBeenLastCalledWith(`${name}@c.us`)
      }
      const scrollBox = chatListManager.getScrollBox()!
      for (let i = 0; i < 8; i++) {
        await mockMouse.scroll(scrollBox.x + 12, scrollBox.y + 8, "down")
        await renderOnce()
      }
      const lines = captureCharFrame().split("\n")
      const y = lines.findIndex((line) => /Extra \d+/.test(line.slice(0, 55)))
      const name = lines[y].match(/Extra \d+/)![0]
      await mockMouse.click(lines[y].indexOf(name) + 1, y)
      await renderOnce()
      expect(appState.getState().currentChatId).toBe(`${name}@c.us`)
      expect(client.loadMessages).toHaveBeenLastCalledWith(`${name}@c.us`)
    } finally {
      unsubscribe()
      chatListManager.destroy()
      destroyConversationScrollBox()
      renderer.destroy()
      appState.reset()
      mocks.forEach((mock) => mock.mockRestore())
    }
  }
)
