import { BoxRenderable, parseColor, TextRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { beforeEach, describe, expect, it, spyOn } from "bun:test"

import type { WAMessageExtended } from "~/types"
import * as client from "~/client"
import { getMessageMenuItems } from "~/components/ContextMenu"
import { Icons, WhatsAppTheme } from "~/config/theme"
import { appState } from "~/state/AppState"
import * as urlUtils from "~/utils/urlUtils"
import { renderMessage } from "~/views/conversation/MessageRenderer"

function getTextContent(renderable: TextRenderable): string {
  const content = renderable.content as unknown as { chunks?: Array<{ text: string }> }
  if (content?.chunks) {
    return content.chunks.map((c) => c.text).join("")
  }
  return String(renderable.content || "")
}

function findRenderableById(root: unknown, id: string): BoxRenderable | undefined {
  if (!root || typeof root !== "object") return undefined
  if (root instanceof BoxRenderable && root.id === id) {
    return root
  }
  const children = (root as { getChildren?: () => unknown[] }).getChildren?.() || []
  for (const child of children) {
    const found = findRenderableById(child, id)
    if (found) return found
  }
  return undefined
}

function findTextRenderable(
  root: unknown,
  predicate: (text: string) => boolean
): TextRenderable | undefined {
  if (!root || typeof root !== "object") return undefined
  if (root instanceof TextRenderable) {
    const text = getTextContent(root)
    if (predicate(text)) return root
  }
  const children = (root as { getChildren?: () => unknown[] }).getChildren?.() || []
  for (const child of children) {
    const found = findTextRenderable(child, predicate)
    if (found) return found
  }
  return undefined
}

describe("MessageRenderer > Downloadable Media", () => {
  beforeEach(() => {
    appState.reset()
    appState.setCurrentChat("chat-1")
  })

  it("should render download icon and button for downloadable media", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 })
    const msg = {
      id: "media-msg-1",
      timestamp: 1700000000,
      hasMedia: true,
      type: "document",
      _data: { filename: "report.pdf", size: 10240 },
    } as unknown as WAMessageExtended

    const root = renderMessage(setup.renderer, msg, false, true, undefined, "chat-1")

    const downloadBtn = findRenderableById(root, "msg-media-msg-1-download-btn")
    expect(downloadBtn).toBeDefined()

    const downloadIcon = findTextRenderable(root, (text) => text.includes(Icons.download))
    expect(downloadIcon).toBeDefined()

    setup.renderer.destroy()
  })

  it("should trigger downloadAndOpenMedia when clicking media label row", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 })
    const msg = {
      id: "media-msg-2",
      timestamp: 1700000000,
      hasMedia: true,
      type: "image",
    } as unknown as WAMessageExtended

    const downloadedCalls: Array<{ chatId: string; messageId: string }> = []
    spyOn(client, "downloadAndOpenMedia").mockImplementation(async (chatId, messageId) => {
      downloadedCalls.push({ chatId, messageId })
    })

    const root = renderMessage(setup.renderer, msg, false, true, undefined, "chat-1")

    const mediaLabelRow = findRenderableById(root, "msg-media-msg-2-media-label")
    expect(mediaLabelRow).toBeDefined()

    let stopped = false
    const mockEvent = {
      type: "down",
      button: 0,
      get propagationStopped() {
        return stopped
      },
      stopPropagation: () => {
        stopped = true
      },
    }

    mediaLabelRow?.processMouseEvent(mockEvent as never)

    expect(stopped).toBe(true)
    expect(downloadedCalls).toEqual([{ chatId: "chat-1", messageId: "media-msg-2" }])

    setup.renderer.destroy()
  })

  it("should trigger downloadAndOpenMedia when clicking download button directly", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 })
    const msg = {
      id: "media-msg-3",
      timestamp: 1700000000,
      hasMedia: true,
      type: "document",
      _data: { filename: "doc.docx" },
    } as unknown as WAMessageExtended

    const downloadedCalls: Array<{ chatId: string; messageId: string }> = []
    spyOn(client, "downloadAndOpenMedia").mockImplementation(async (chatId, messageId) => {
      downloadedCalls.push({ chatId, messageId })
    })

    const root = renderMessage(setup.renderer, msg, false, true, undefined, "chat-1")

    const downloadBtn = findRenderableById(root, "msg-media-msg-3-download-btn")
    expect(downloadBtn).toBeDefined()

    let stopped = false
    const mockEvent = {
      type: "down",
      button: 0,
      get propagationStopped() {
        return stopped
      },
      stopPropagation: () => {
        stopped = true
      },
    }

    downloadBtn?.processMouseEvent(mockEvent as never)

    expect(stopped).toBe(true)
    expect(downloadedCalls).toEqual([{ chatId: "chat-1", messageId: "media-msg-3" }])

    setup.renderer.destroy()
  })

  it("should toggle selection instead of downloading when isSelectionMode is active", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 })
    const msg = {
      id: "media-msg-4",
      timestamp: 1700000000,
      hasMedia: true,
      type: "image",
    } as unknown as WAMessageExtended

    const downloadedCalls: Array<{ chatId: string; messageId: string }> = []
    spyOn(client, "downloadAndOpenMedia").mockImplementation(async (chatId, messageId) => {
      downloadedCalls.push({ chatId, messageId })
    })

    const toggleSpy = spyOn(appState, "toggleMessageSelection")

    const root = renderMessage(
      setup.renderer,
      msg,
      false,
      true,
      undefined,
      "chat-1",
      true, // isSelectionMode
      false
    )

    const mediaLabelRow = findRenderableById(root, "msg-media-msg-4-media-label")
    expect(mediaLabelRow).toBeDefined()

    let stopped = false
    const mockEvent = {
      type: "down",
      button: 0,
      get propagationStopped() {
        return stopped
      },
      stopPropagation: () => {
        stopped = true
      },
    }

    mediaLabelRow?.processMouseEvent(mockEvent as never)

    expect(stopped).toBe(true)
    expect(downloadedCalls.length).toBe(0)
    expect(toggleSpy).toHaveBeenCalledWith("chat-1", "media-msg-4")

    setup.renderer.destroy()
  })

  it("should not render download button for plain text or special non-downloadable messages", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 })

    const textMsg = {
      id: "text-1",
      body: "Just a text message",
      timestamp: 1700000000,
      hasMedia: false,
    } as unknown as WAMessageExtended

    const textRoot = renderMessage(setup.renderer, textMsg, false, true, undefined, "chat-1")
    expect(findRenderableById(textRoot, "msg-text-1-download-btn")).toBeUndefined()

    const locationMsg = {
      id: "loc-1",
      timestamp: 1700000000,
      hasMedia: true,
      type: "location",
      _data: { loc: "Central Park" },
    } as unknown as WAMessageExtended

    const locRoot = renderMessage(setup.renderer, locationMsg, false, true, undefined, "chat-1")
    expect(findRenderableById(locRoot, "msg-loc-1-download-btn")).toBeUndefined()

    setup.renderer.destroy()
  })
})

describe("MessageRenderer > Hyperlinks & URL clicking", () => {
  beforeEach(() => {
    appState.reset()
    appState.setCurrentChat("chat-1")
  })

  it("should style URLs in message body with green color and underline", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 })
    const msg = {
      id: "msg-url-1",
      body: "Visit https://github.com for details",
      timestamp: 1700000000,
      hasMedia: false,
    } as unknown as WAMessageExtended

    const root = renderMessage(setup.renderer, msg, false, true, undefined, "chat-1")

    const urlText = findTextRenderable(root, (text) => text.startsWith("Visit "))
    expect(urlText).toBeDefined()

    const content = urlText?.content as {
      chunks?: Array<{ text: string; fg?: unknown; link?: { url: string } }>
    }
    const urlChunk = content?.chunks?.find((c) => c.text === "https://github.com")
    expect(urlChunk).toBeDefined()
    expect(urlChunk?.fg).toEqual(parseColor(WhatsAppTheme.green))
    expect(urlChunk?.link).toEqual({ url: "https://github.com" })

    setup.renderer.destroy()
  })

  it("should trigger openUrl when [Ctrl]+clicking a message content row with a URL", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 })
    const msg = {
      id: "msg-url-2",
      body: "Check out https://waha.dev today",
      timestamp: 1700000000,
      hasMedia: false,
    } as unknown as WAMessageExtended

    const openedUrls: string[] = []
    const openUrlSpy = spyOn(urlUtils, "openUrl").mockImplementation(async (url) => {
      openedUrls.push(url)
      return true
    })

    const root = renderMessage(setup.renderer, msg, false, true, undefined, "chat-1")

    const contentRow = findRenderableById(root, "msg-msg-url-2-content")
    expect(contentRow).toBeDefined()

    let stopped = false
    const mockEvent = {
      type: "down",
      button: 0,
      modifiers: { ctrl: true, alt: false, shift: false },
      get propagationStopped() {
        return stopped
      },
      stopPropagation: () => {
        stopped = true
      },
    }

    contentRow?.processMouseEvent(mockEvent as never)

    expect(stopped).toBe(true)
    expect(openedUrls).toEqual(["https://waha.dev"])

    openUrlSpy.mockRestore()
    setup.renderer.destroy()
  })

  it("should trigger openUrl when clicking the link preview card", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 })
    const msg = {
      id: "msg-url-3",
      body: "https://example.com",
      timestamp: 1700000000,
      hasMedia: false,
      _data: {
        matchedText: "https://example.com",
        title: "Example Domain",
        description: "An example domain description",
      },
    } as unknown as WAMessageExtended

    const openedUrls: string[] = []
    const openUrlSpy = spyOn(urlUtils, "openUrl").mockImplementation(async (url) => {
      openedUrls.push(url)
      return true
    })

    const root = renderMessage(setup.renderer, msg, false, true, undefined, "chat-1")

    const previewBox = findRenderableById(root, "msg-msg-url-3-link-preview")
    expect(previewBox).toBeDefined()

    let stopped = false
    const mockEvent = {
      type: "down",
      button: 0,
      modifiers: { ctrl: false, alt: false, shift: false },
      get propagationStopped() {
        return stopped
      },
      stopPropagation: () => {
        stopped = true
      },
    }

    previewBox?.processMouseEvent(mockEvent as never)

    expect(stopped).toBe(true)
    expect(openedUrls).toEqual(["https://example.com"])

    openUrlSpy.mockRestore()
    setup.renderer.destroy()
  })

  it("should include 'Open Link' in context menu items when message has a URL", () => {
    const msgWithUrl = {
      id: "msg-menu-1",
      body: "Check https://example.com",
    } as unknown as WAMessageExtended

    const items = getMessageMenuItems(msgWithUrl)
    const openLinkItem = items.find((i) => i.id === "open_link")
    expect(openLinkItem).toBeDefined()
    expect(openLinkItem?.label).toBe("Open Link")

    const msgWithoutUrl = {
      id: "msg-menu-2",
      body: "No URL here",
    } as unknown as WAMessageExtended

    const noUrlItems = getMessageMenuItems(msgWithoutUrl)
    expect(noUrlItems.find((i) => i.id === "open_link")).toBeUndefined()
  })
})
