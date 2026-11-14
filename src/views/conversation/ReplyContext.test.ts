import { TextRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { beforeEach, describe, expect, it } from "bun:test"

import type { WAMessageExtended } from "~/types"
import { appState } from "~/state/AppState"
import { renderReplyContext } from "~/views/conversation/ReplyContext"

function getTextContent(renderable: TextRenderable): string {
  const content = renderable.content as unknown as { chunks?: Array<{ text: string }> }
  if (content?.chunks) {
    return content.chunks.map((c) => c.text).join("")
  }
  return String(renderable.content || "")
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

function createMockReplyTo(overrides: Record<string, unknown>): WAMessageExtended["replyTo"] {
  return overrides as unknown as WAMessageExtended["replyTo"]
}

describe("renderReplyContext", () => {
  beforeEach(() => {
    appState.reset()
  })

  it("should return null if replyTo is null or undefined", async () => {
    const setup = await createTestRenderer({ width: 50, height: 10 })
    expect(
      renderReplyContext(setup.renderer, undefined, "msg-1", false, false, "chat-1")
    ).toBeNull()
    setup.renderer.destroy()
  })

  it("should render 'You' when quoted message is from me", async () => {
    const setup = await createTestRenderer({ width: 50, height: 10 })
    const replyTo = createMockReplyTo({
      id: "quoted-1",
      body: "Hello",
      fromMe: true,
      participant: "447700900001@c.us",
    })
    const box = renderReplyContext(setup.renderer, replyTo, "msg-1", false, false, "chat-1")
    expect(box).not.toBeNull()

    const senderText = findTextRenderable(box, (text) => text === "You")
    expect(senderText).toBeDefined()
    setup.renderer.destroy()
  })

  it("should render saved contact name when sender is in contacts cache", async () => {
    const setup = await createTestRenderer({ width: 50, height: 10 })
    appState.setContactsCache(new Map([["447700900001@c.us", "Alice"]]))

    const replyTo = createMockReplyTo({
      id: "quoted-1",
      body: "Hello",
      fromMe: false,
      participant: "447700900001@c.us",
      _data: { notifyName: "Alice Push" },
    })
    const box = renderReplyContext(setup.renderer, replyTo, "msg-1", false, true, "1203630@g.us")
    expect(box).not.toBeNull()

    const senderText = findTextRenderable(box, (text) => text === "Alice")
    expect(senderText).toBeDefined()
    setup.renderer.destroy()
  })

  it("should render formatted phone and ~pushname when both are known", async () => {
    const setup = await createTestRenderer({ width: 50, height: 10 })
    const replyTo = createMockReplyTo({
      id: "quoted-1",
      body: "Hello",
      fromMe: false,
      participant: "447700900001@c.us",
      _data: { notifyName: "Alice" },
    })
    const box = renderReplyContext(setup.renderer, replyTo, "msg-1", false, true, "1203630@g.us")
    expect(box).not.toBeNull()

    const senderText = findTextRenderable(box, (text) => text === "+44 770 090 0001 ~Alice")
    expect(senderText).toBeDefined()
    setup.renderer.destroy()
  })

  it("should render ~pushname when only pushname is known (unmapped LID)", async () => {
    const setup = await createTestRenderer({ width: 50, height: 10 })
    const replyTo = createMockReplyTo({
      id: "quoted-1",
      body: "Hello",
      fromMe: false,
      participant: "123456789012345@lid",
      _data: { notifyName: "Alice" },
    })
    const box = renderReplyContext(setup.renderer, replyTo, "msg-1", false, true, "1203630@g.us")
    expect(box).not.toBeNull()

    const senderText = findTextRenderable(box, (text) => text === "~Alice")
    expect(senderText).toBeDefined()
    setup.renderer.destroy()
  })

  it("should render formatted phone number when only phone is known", async () => {
    const setup = await createTestRenderer({ width: 50, height: 10 })
    const replyTo = createMockReplyTo({
      id: "quoted-1",
      body: "Hello",
      fromMe: false,
      participant: "447700900001@c.us",
    })
    const box = renderReplyContext(setup.renderer, replyTo, "msg-1", false, true, "1203630@g.us")
    expect(box).not.toBeNull()

    const senderText = findTextRenderable(box, (text) => text === "+44 770 090 0001")
    expect(senderText).toBeDefined()
    setup.renderer.destroy()
  })

  it("should fallback to LID digits for unmapped LID with no pushname", async () => {
    const setup = await createTestRenderer({ width: 50, height: 10 })
    const replyTo = createMockReplyTo({
      id: "quoted-1",
      body: "Hello",
      fromMe: false,
      participant: "123456789012345@lid",
    })
    const box = renderReplyContext(setup.renderer, replyTo, "msg-1", false, true, "1203630@g.us")
    expect(box).not.toBeNull()

    const senderText = findTextRenderable(box, (text) => text === "123456789012345")
    expect(senderText).toBeDefined()
    setup.renderer.destroy()
  })
})
