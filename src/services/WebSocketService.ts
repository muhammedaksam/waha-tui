/**
 * WebSocket Service
 * Manages real-time event updates from WAHA
 */

import { appState } from "../state/AppState"
import { debugLog } from "../utils/debug"
import type { WahaTuiConfig } from "../config/schema"
import { loadChats } from "../client"
import {
  WAHAWebhookSessionStatus,
  WAHAWebhookMessage,
  WAHAWebhookMessageAck,
  WAHAWebhookMessageReaction,
  WAHAWebhookMessageRevoked,
  WAHAWebhookMessageAny,
  WAHAChatPresences,
} from "@muhammedaksam/waha-node"

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
  private maxReconnectDelay = 30000 // 30 seconds
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

      this.ws.onopen = this.handleOpen.bind(this)
      this.ws.onmessage = this.handleMessage.bind(this)
      this.ws.onclose = this.handleClose.bind(this)
      this.ws.onerror = this.handleError.bind(this)
    } catch (error) {
      debugLog("WebSocket", `Connection error: ${error}`)
      this.handleClose({ code: 0, reason: "Connection failed", wasClean: false } as CloseEvent)
    } finally {
      this.isConnecting = false
    }
  }

  public disconnect() {
    this.shouldKeyReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
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
      this.processEvent(data)
    } catch (error) {
      debugLog("WebSocket", `Failed to parse message: ${error}`)
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

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay)
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
      case "message":
      case "message.any":
        await this.handleMessageEvent(data as WAHAWebhookMessage)
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
    if (state.currentChatId === chatId) {
      debugLog("WebSocket", `New message in current chat: ${chatId}`)
      appState.appendMessage(chatId, payload)
    } else {
      debugLog("WebSocket", `New message in other chat: ${chatId}`)
      loadChats()
    }
  }

  private handleMessageAck(data: WAHAWebhookMessageAck) {
    const payload = data.payload
    const state = appState.getState()

    if (state.currentChatId) {
      appState.updateMessageAck(state.currentChatId, payload.id, payload.ack, payload.ackName)
    }
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

export const webSocketService = new WebSocketService()
