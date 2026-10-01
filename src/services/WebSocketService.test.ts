import type { WAMessage } from "@muhammedaksam/waha-node"

import { afterEach, beforeEach, describe, expect, jest, mock, spyOn, test } from "bun:test"
import notifier from "node-notifier"

import * as client from "~/client"
import * as configManager from "~/config/manager"
import { DEFAULT_SETTINGS } from "~/config/schema"
import { TIME_MS } from "~/constants"
import { WebSocketService } from "~/services/WebSocketService"
import { appState } from "~/state/AppState"

const CHAT_ID = "123456789@c.us"
const SELF_ID = "987654321@c.us"

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  receive(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }))
  }

  close() {}
}

function messageEvent(
  id: string,
  event = "message.any",
  session: string | undefined = "session-a",
  payload: Partial<WAMessage> = {}
) {
  return {
    event,
    session,
    payload: {
      id,
      timestamp: 1_700_000_000,
      fromMe: false,
      from: CHAT_ID,
      to: SELF_ID,
      body: "Hello",
      hasMedia: false,
      mediaUrl: "",
      source: "app",
      ack: 1,
      ackName: "SERVER",
      _data: { notifyName: "Test sender" },
      ...payload,
    },
  }
}

describe("WebSocketService message notifications", () => {
  const originalWebSocket = globalThis.WebSocket
  const originalNotify = Object.getOwnPropertyDescriptor(notifier, "notify")
  let service: WebSocketService
  let socket: FakeWebSocket
  let settings: ReturnType<typeof spyOn<typeof configManager, "getSettings">>
  let notifications: ReturnType<typeof mock<typeof notifier.notify>>
  let loadChats: ReturnType<typeof spyOn<typeof client, "loadChats">>
  let loadMessages: ReturnType<typeof spyOn<typeof client, "loadMessages">>
  let appendMessage: ReturnType<typeof spyOn<typeof appState, "appendMessage">>

  beforeEach(() => {
    jest.useFakeTimers()
    FakeWebSocket.instances = []
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
    settings = spyOn(configManager, "getSettings").mockResolvedValue(DEFAULT_SETTINGS)
    // node-notifier exposes an inherited getter, which Bun's spyOn cannot replace.
    notifications = mock(() => notifier)
    Object.defineProperty(notifier, "notify", { configurable: true, value: notifications })
    loadChats = spyOn(client, "loadChats").mockResolvedValue(undefined)
    loadMessages = spyOn(client, "loadMessages").mockResolvedValue(undefined)
    appendMessage = spyOn(appState, "appendMessage")
    appState.reset()
    appState.setCurrentSession("session-a")
    service = new WebSocketService()
    service.initialize({
      wahaUrl: "http://waha.test:3000",
      wahaApiKey: "",
      version: "test",
      createdAt: "",
      updatedAt: "",
    })
    socket = FakeWebSocket.instances[0]!
  })

  afterEach(async () => {
    service.disconnect()
    // Reload timers outlive the socket; finish them while the API spies are installed.
    jest.runAllTimers()
    await Promise.resolve()
    await Promise.resolve()
    appendMessage.mockRestore()
    loadMessages.mockRestore()
    loadChats.mockRestore()
    if (originalNotify) Object.defineProperty(notifier, "notify", originalNotify)
    else Reflect.deleteProperty(notifier, "notify")
    settings.mockRestore()
    globalThis.WebSocket = originalWebSocket
    jest.useRealTimers()
    appState.reset()
  })

  async function flushBatch() {
    jest.advanceTimersByTime(TIME_MS.WS_DEBOUNCE)
    await Promise.resolve()
    await Promise.resolve()
  }

  test("subscribes to incoming and outgoing messages through message.any only", () => {
    const events = new URL(socket.url).searchParams.getAll("events")
    expect(events).toContain("message.any")
    expect(events).not.toContain("message")
    expect(events).toContain("message.ack")
    expect(events).toContain("message.edited")
  })

  test("notifies once for message and message.any even while settings are loading", async () => {
    let resolveSettings!: (value: typeof DEFAULT_SETTINGS) => void
    settings.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSettings = resolve
        })
    )
    socket.receive(messageEvent("same-message", "message"))
    socket.receive(messageEvent("same-message", "message.any"))
    await flushBatch()

    try {
      expect(settings).toHaveBeenCalledTimes(1)
      expect(notifications).not.toHaveBeenCalled()
    } finally {
      resolveSettings(DEFAULT_SETTINGS)
    }
    await Promise.resolve()
    await Promise.resolve()

    expect(notifications).toHaveBeenCalledTimes(1)
    expect(notifications).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test sender", message: "Hello" })
    )
  })

  test("ignores repeated deliveries in later batches and after reconnecting", async () => {
    socket.receive(messageEvent("replayed-message"))
    await flushBatch()
    socket.receive(messageEvent("replayed-message"))
    await flushBatch()
    expect(notifications).toHaveBeenCalledTimes(1)

    service.disconnect()
    service.connect()
    const reconnected = FakeWebSocket.instances[1]!
    reconnected.receive(messageEvent("replayed-message"))
    await flushBatch()
    expect(notifications).toHaveBeenCalledTimes(1)
  })

  test("notifies for distinct messages even when sender and body are identical", async () => {
    socket.receive(messageEvent("first-message"))
    socket.receive(messageEvent("second-message"))
    await flushBatch()
    expect(notifications).toHaveBeenCalledTimes(2)
  })

  test("keeps duplicate IDs independent between sessions", async () => {
    socket.receive(messageEvent("shared-id"))
    await flushBatch()
    appState.setCurrentSession("session-b")
    socket.receive(messageEvent("shared-id", "message.any", "session-b"))
    await flushBatch()
    expect(notifications).toHaveBeenCalledTimes(2)
  })

  test("does not remember messages filtered out for an inactive session", async () => {
    socket.receive(messageEvent("filtered-message", "message.any", "session-b"))
    await flushBatch()
    expect(notifications).not.toHaveBeenCalled()

    appState.setCurrentSession("session-b")
    socket.receive(messageEvent("filtered-message", "message.any", "session-b"))
    await flushBatch()
    expect(notifications).toHaveBeenCalledTimes(1)
  })

  test("uses the current session when an event omits it", async () => {
    const event = messageEvent("without-session")
    socket.receive({ ...event, session: undefined })
    socket.receive(event)
    await flushBatch()
    expect(notifications).toHaveBeenCalledTimes(1)

    appState.setCurrentSession("session-b")
    socket.receive({ ...event, session: undefined })
    await flushBatch()
    expect(notifications).toHaveBeenCalledTimes(2)
  })

  test("continues to notify for messages without an ID", async () => {
    socket.receive(messageEvent("unused", "message.any", "session-a", { id: undefined }))
    socket.receive(messageEvent("unused", "message.any", "session-a", { id: undefined }))
    await flushBatch()
    expect(notifications).toHaveBeenCalledTimes(2)
  })

  test("appends incoming messages once in the active chat without notifying", async () => {
    appState.setCurrentChat(CHAT_ID)
    socket.receive(messageEvent("active-message", "message"))
    socket.receive(messageEvent("active-message", "message.any"))
    await flushBatch()
    expect(appendMessage).toHaveBeenCalledTimes(1)
    expect(appendMessage).toHaveBeenCalledWith(
      CHAT_ID,
      expect.objectContaining({ id: "active-message" })
    )
    expect(notifications).not.toHaveBeenCalled()

    // A later duplicate must not notify just because the user left the chat.
    appState.setCurrentChat(null)
    socket.receive(messageEvent("active-message"))
    await flushBatch()
    expect(notifications).not.toHaveBeenCalled()
  })

  test("keeps outgoing message updates and reloads without desktop notifications", async () => {
    appState.setCurrentChat(CHAT_ID)
    const outgoing = messageEvent("outgoing-message", "message.any", "session-a", {
      fromMe: true,
      from: SELF_ID,
      to: CHAT_ID,
    })
    socket.receive(outgoing)
    socket.receive(outgoing)
    await flushBatch()
    jest.advanceTimersByTime(TIME_MS.SEND_MESSAGE_RELOAD_DELAY)
    expect(appendMessage).toHaveBeenCalledTimes(1)
    expect(appendMessage).toHaveBeenCalledWith(
      CHAT_ID,
      expect.objectContaining({ id: "outgoing-message", fromMe: true })
    )
    expect(loadMessages).toHaveBeenCalledWith(CHAT_ID)
    expect(loadChats).toHaveBeenCalledTimes(1)
    expect(notifications).not.toHaveBeenCalled()
  })

  test("bounds retained IDs while keeping the most recent messages deduplicated", async () => {
    for (let index = 0; index <= 1000; index++) {
      socket.receive(messageEvent(`message-${index}`))
    }
    await flushBatch()
    expect(notifications).toHaveBeenCalledTimes(1001)

    socket.receive(messageEvent("message-1000"))
    socket.receive(messageEvent("message-0"))
    await flushBatch()
    // Only the oldest ID has fallen out of the 1000-message window.
    expect(notifications).toHaveBeenCalledTimes(1002)
  })
})
