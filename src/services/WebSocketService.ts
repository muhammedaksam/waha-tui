/**
 * WebSocket Service
 * Manages real-time event updates from WAHA
 */

import {
  WAHAChatPresences,
  WAHAWebhookMessage,
  WAHAWebhookMessageAck,
  WAHAWebhookMessageAny,
  WAHAWebhookMessageReaction,
  WAHAWebhookMessageRevoked,
  WAHAWebhookSessionStatus,
} from "@muhammedaksam/waha-node"

import type { WahaTuiConfig } from "~/config/schema"
import { loadChats, loadMessages } from "~/client"
import { TIME_MS } from "~/constants"
import { CacheKeys, cacheService } from "~/services/CacheService"
import { WebSocketError } from "~/services/Errors"
import { errorService } from "~/services/ErrorService"
import { appState } from "~/state/AppState"
import { debugLog } from "~/utils/debug"
import { getContactName, isGroupChat, isStatusBroadcast, normalizeId } from "~/utils/formatters"
import { notifyNewMessage } from "~/utils/notifications"

// Standard WebSocket close codes
const CLOSE_NORMAL = 1000

type WahaEvent =
  | WAHAWebhookSessionStatus
  | WAHAWebhookMessage
  | WAHAWebhookMessageAck
  | WAHAWebhookMessageReaction
  | WAHAWebhookMessageRevoked
  | WAHAWebhookMessageAny
  | { event: "presence.update"; payload: WAHAChatPresences; session?: string }

export class WebSocketService {
  private ws: WebSocket | null = null
  private config: WahaTuiConfig | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectDelay = TIME_MS.WS_MAX_RECONNECT_DELAY
  private isConnecting = false
  private shouldKeyReconnect = true

  public initialize(config: WahaTuiConfig) {
    this.config = config
    this.connect()
  }

  public connect() {
    if (this.ws || !this.config || this.isConnecting) return

    this.isConnecting = true
    this.shouldKeyReconnect = true

    try {
      // Construct WebSocket URL
      // Use config.wahaUrl but replace http/https with ws/wss
      let wsUrl = this.config.wahaUrl.replace(/^http/, "ws")
      if (!wsUrl.startsWith("ws")) {
        // Fallback if url doesn't start with http/ws (unlikely but safe)
        wsUrl = `ws://${wsUrl}`
      }

      // Ensure /ws endpoint
      if (!wsUrl.endsWith("/ws")) {
        wsUrl = `${wsUrl}/ws`
      }

      // Add query params
      const params = new URLSearchParams()
      params.append("session", "*") // Listen to all sessions (or filter if needed)

      // Subscribe to all possible events explicitly
      const allEvents = [
        "session.status",
        "message",
        "message.reaction",
        "message.any",
        "message.ack",
        "message.ack.group",
        "message.waiting",
        "message.revoked",
        "message.edited",
        "state.change",
        "group.join",
        "group.leave",
        "group.v2.join",
        "group.v2.leave",
        "group.v2.update",
        "group.v2.participants",
        "presence.update",
        "poll.vote",
        "poll.vote.failed",
        "chat.archive",
        "call.received",
        "call.accepted",
        "call.rejected",
        "label.upsert",
        "label.deleted",
        "label.chat.added",
        "label.chat.deleted",
        "event.response",
        "event.response.failed",
        "engine.event",
      ]
      for (const event of allEvents) {
        params.append("events", event)
      }

      if (this.config.wahaApiKey) {
        params.append("x-api-key", this.config.wahaApiKey)
      }

      const fullUrl = `${wsUrl}?${params.toString()}`
      debugLog("WebSocket", `Connecting to ${fullUrl.replace(this.config.wahaApiKey || "", "***")}`)

      this.ws = new WebSocket(fullUrl)

      // Store bound handlers for cleanup
      this.ws.onopen = this.handleOpen.bind(this)
      this.ws.onmessage = this.handleMessageWithDebounce.bind(this)
      this.ws.onclose = this.handleClose.bind(this)
      this.ws.onerror = this.handleError.bind(this)
    } catch (error) {
      errorService.handle(
        new WebSocketError(
          "Connection failed",
          { url: this.config?.wahaUrl },
          error instanceof Error ? error : undefined
        ),
        { context: { component: "WebSocketService" } }
      )
      this.handleClose({ code: 0, reason: "Connection failed", wasClean: false } as CloseEvent)
    } finally {
      this.isConnecting = false
    }
  }

  public disconnect() {
    this.shouldKeyReconnect = false

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.pendingEvents = []

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null

      this.ws.close(CLOSE_NORMAL, "App closed")
      this.ws = null
    }
  }

  private handleOpen() {
    debugLog("WebSocket", "Connected")
    this.reconnectAttempts = 0
    appState.setConnectionStatus("connected")
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data as string) as WahaEvent

      this.processEvent(data).catch((error) => {
        errorService.handle(error, {
          context: { component: "WebSocketService", action: "processEvent" },
        })
      })
    } catch (error) {
      errorService.handle(
        new WebSocketError(
          "Failed to parse WebSocket message",
          undefined,
          error instanceof Error ? error : undefined
        ),
        { context: { component: "WebSocketService" } }
      )
    }
  }

  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingEvents: WahaEvent[] = []

  private handleMessageWithDebounce(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data as string) as WahaEvent

      this.pendingEvents.push(data)

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }

      this.debounceTimer = setTimeout(() => {
        for (const evt of this.pendingEvents) {
          this.processEvent(evt).catch((error) => {
            errorService.handle(error, {
              context: { component: "WebSocketService", action: "processDebouncedEvent" },
            })
          })
        }
        this.pendingEvents = []
        this.debounceTimer = null
      }, TIME_MS.WS_DEBOUNCE)
    } catch (error) {
      errorService.handle(
        new WebSocketError(
          "Failed to parse WebSocket message",
          undefined,
          error instanceof Error ? error : undefined
        ),
        { context: { component: "WebSocketService" } }
      )
    }
  }

  private handleClose(event: CloseEvent) {
    debugLog("WebSocket", `Closed: ${event.code} ${event.reason}`)
    this.ws = null

    if (this.shouldKeyReconnect) {
      this.scheduleReconnect()
    }
  }

  private handleError(event: Event) {
    debugLog("WebSocket", `Error: ${JSON.stringify(event)}`)
    // Error usually leads to close, so we let handleClose manage reconnection
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return

    const delay = Math.min(
      TIME_MS.WS_RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    )
    debugLog("WebSocket", `Reconnecting in ${delay}ms...`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  private async processEvent(data: WahaEvent) {
    debugLog("WebSocket", `Event: ${data.event}`)

    // Check if event is for the current session
    const state = appState.getState()
    const currentSession = state.currentSession

    // Filter events not for the current session
    if (data.session && currentSession && data.session !== currentSession) {
      return
    }

    switch (data.event) {
      case "session.status":
        this.handleSessionStatus(data as WAHAWebhookSessionStatus)
        break
      case "message.any":
        await this.handleMessageEvent(data as WAHAWebhookMessage | WAHAWebhookMessageAny)
        break
      case "message.ack":
        this.handleMessageAck(data as WAHAWebhookMessageAck)
        break
      case "message.reaction":
        this.handleMessageReaction(data as WAHAWebhookMessageReaction)
        break
      case "message.revoked":
        this.handleMessageRevoked(data as WAHAWebhookMessageRevoked)
        break
      case "presence.update":
        this.handlePresenceUpdate(data as { event: "presence.update"; payload: WAHAChatPresences })
        break
      default:
        debugLog("WebSocket", `Unhandled event: ${data.event}`)
        break
    }
  }

  private handleSessionStatus(data: WAHAWebhookSessionStatus) {
    const status = data.payload?.status
    debugLog("WebSocket", `Session status: ${status}`)
    // TODO: Handle session status updates (e.g. reload session list)
  }

  private async handleMessageEvent(data: WAHAWebhookMessage | WAHAWebhookMessageAny) {
    const payload = data.payload
    if (!payload) return

    // Identify which chat this message belongs to
    // For incoming messages: payload.from
    // For outgoing messages: payload.to
    const chatId = payload.fromMe ? payload.to : payload.from

    // Clear typing status for sender - WhatsApp doesn't always send "paused" presence after sending
    if (!payload.fromMe && payload.from) {
      appState.clearTypingForSender(payload.from)
    }

    // If we are currently viewing this chat, append the message
    const state = appState.getState()
    const session = state.currentSession

    if (state.currentChatId === chatId) {
      debugLog("WebSocket", `New message in current chat: ${chatId}`)
      appState.appendMessage(chatId, payload)

      // For messages from other devices (fromMe messages while viewing the chat),
      // also reload to ensure sync
      if (payload.fromMe) {
        debugLog("WebSocket", `Message from another device, reloading messages for sync`)
        setTimeout(() => {
          loadMessages(chatId)
        }, 100)
      }

      // Also update chat list to show new last message
      if (session) {
        cacheService.delete(CacheKeys.chats(session))
        setTimeout(() => {
          loadChats()
        }, TIME_MS.SEND_MESSAGE_RELOAD_DELAY)
      }
    } else {
      debugLog("WebSocket", `New message in other chat: ${chatId}`)
      // Clear chat cache to force refresh with updated last message
      // This handles both incoming messages and messages sent from other devices
      if (session) {
        cacheService.delete(CacheKeys.chats(session))
        setTimeout(() => {
          loadChats()
        }, TIME_MS.SEND_MESSAGE_RELOAD_DELAY)
      }

      // Send desktop notification for messages not from self
      if (!payload.fromMe) {
        try {
          const isGroup = chatId ? isGroupChat(chatId) : false
          const isStatus = chatId ? isStatusBroadcast(chatId) : false

          debugLog("Notifications", `Processing notification for ${chatId} (isGroup: ${isGroup})`)

          // Cast _data to access internal WhatsApp properties
          const messageData = payload._data as
            | { notifyName?: string; chat?: { name?: string } }
            | undefined

          // Check if we have a name for this chat in our cached chat list
          // Use normalizeId to ensure we match even if suffixes differ
          const normalizedChatId = normalizeId(chatId)
          const cachedChat = state.chats.find((c) => normalizeId(c.id) === normalizedChatId)

          if (cachedChat) {
            debugLog("Notifications", `Found cached chat: ${cachedChat.name || cachedChat.id}`)
          } else {
            debugLog(
              "Notifications",
              `Chat not found in cache for ${chatId} (normalized: ${normalizedChatId})`
            )
          }

          const knownName =
            cachedChat?.name && cachedChat.name !== chatId && cachedChat.name !== cachedChat.id
              ? cachedChat.name
              : undefined

          // Get sender name using utility (saved name → cached chat name → notifyName → phone)
          const senderName = getContactName(
            payload.from,
            state.allContacts,
            knownName || messageData?.notifyName || messageData?.chat?.name
          )

          debugLog("Notifications", `Resolved sender name: ${senderName}`)

          const messageBody = payload.body || "[Media]"
          const groupName = isGroup ? messageData?.chat?.name : undefined
          await notifyNewMessage(senderName, messageBody, isGroup, groupName, isStatus)
        } catch (error) {
          errorService.handle(error, {
            context: { component: "WebSocketService", action: "processNotification" },
          })
        }
      }
    }
  }

  private handleMessageAck(data: WAHAWebhookMessageAck) {
    const payload = data.payload
    const state = appState.getState()

    // Determine chat ID: for outgoing messages (fromMe: true), use 'to'; for incoming, use 'from'
    const chatId = payload.fromMe ? payload.to : payload.from

    debugLog("WebSocket", `Received ack event for message ${payload.id}`)
    debugLog("WebSocket", `  Chat ID: ${chatId}`)
    debugLog("WebSocket", `  From Me: ${payload.fromMe}`)
    debugLog("WebSocket", `  Ack: ${payload.ack} (${payload.ackName})`)
    debugLog("WebSocket", `  Current chat: ${state.currentChatId}`)

    // Update message ack in conversation view if it's the current chat
    if (state.currentChatId === chatId) {
      debugLog("WebSocket", `  Updating message ack in conversation view`)
      appState.updateMessageAck(chatId, payload.id, payload.ack, payload.ackName)
    }

    // Always update the chat list's lastMessage ack for real-time read receipts
    debugLog("WebSocket", `  Updating chat list lastMessage ack`)
    appState.updateChatLastMessageAck(chatId, payload.id, payload.ack, payload.ackName)
  }

  private handleMessageReaction(data: WAHAWebhookMessageReaction) {
    const payload = data.payload
    const targetMessageId = payload.reaction?.messageId
    const reactionText = payload.reaction?.text

    // Extract sender ID
    // valid for group (participant) or direct (from)
    const senderId = payload.participant || payload.from

    const state = appState.getState()
    if (state.currentChatId && targetMessageId) {
      appState.updateMessageReaction(
        state.currentChatId,
        targetMessageId,
        reactionText || "",
        senderId
      )
    }
  }

  private handleMessageRevoked(data: WAHAWebhookMessageRevoked) {
    const payload = data.payload
    const revokedId = payload.revokedMessageId

    const state = appState.getState()
    if (state.currentChatId && revokedId) {
      appState.markMessageRevoked(state.currentChatId, revokedId)
    }
  }

  private handlePresenceUpdate(data: { payload: WAHAChatPresences }) {
    const payload = data.payload
    const state = appState.getState()

    debugLog(
      "WebSocket",
      `Presence update for: ${payload?.id}, current chat: ${state.currentChatId}`
    )

    if (payload && payload.id) {
      // Filter out presence updates from ourselves
      const myProfileId = state.myProfile?.id
      if (myProfileId) {
        // Normalize IDs for comparison (handle both @c.us and @lid formats)
        const myIdBase = normalizeId(myProfileId)
        const chatIdBase = normalizeId(payload.id)

        // Skip presence updates for self-chat entirely
        if (chatIdBase === myIdBase) {
          debugLog("WebSocket", "Skipping presence update for self-chat")
          return
        }
      }

      if (myProfileId && payload.presences) {
        // Normalize myProfileId for comparison (handle both @c.us and @lid formats)
        const myIdBase = normalizeId(myProfileId)

        // Filter out our own presence updates
        const filteredPresences = payload.presences.filter((p) => {
          const participantBase = normalizeId(p.participant)
          return participantBase !== myIdBase
        })

        // If all presences were filtered out, don't update
        if (filteredPresences.length === 0) {
          debugLog("WebSocket", "Filtered out own presence update")
          return
        }

        // Create filtered payload
        const filteredPayload = { ...payload, presences: filteredPresences }

        const presenceInfo = filteredPayload.presences?.[0]
        if (presenceInfo) {
          debugLog(
            "WebSocket",
            `Presence: ${presenceInfo.participant} -> ${presenceInfo.lastKnownPresence}`
          )
        }
        appState.updateChatPresence(payload.id, filteredPayload)
      } else {
        // Log the presence data
        const presenceInfo = payload.presences?.[0]
        if (presenceInfo) {
          debugLog(
            "WebSocket",
            `Presence: ${presenceInfo.participant} -> ${presenceInfo.lastKnownPresence}`
          )
        }
        appState.updateChatPresence(payload.id, payload)
      }
    }
  }
}

export const webSocketService = new WebSocketService()
