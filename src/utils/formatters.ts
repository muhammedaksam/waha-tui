/**
 * Formatting Utilities
 * Helper functions for formatting data in the TUI
 */
import { fg, type TextChunk } from "@opentui/core"
import { WhatsAppTheme, Icons } from "../config/theme"

/**
 * Format a timestamp to relative time (e.g., "2m ago", "yesterday")
 */
export function formatRelativeTime(timestamp: number | string): string {
  const date = typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`

  // Format as date for older messages
  return date.toLocaleDateString()
}

/**
 * Format a timestamp to time (e.g., "14:30")
 */
export function formatTime(timestamp: number | string): string {
  const date = typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number = 50): string {
  // Guard against non-string values
  if (typeof text !== "string") return ""
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + "..."
}

/**
 * Format phone number (e.g., "1234567890@c.us" -> "+1 234 567 890")
 */
export function formatPhoneNumber(chatId: string): string {
  // Extract number from chatId
  const number = chatId.replace(/@.*$/, "")

  // Simple formatting - can be enhanced
  if (number.length > 10) {
    return `+${number.slice(0, -10)} ${number.slice(-10, -7)} ${number.slice(-7, -4)} ${number.slice(-4)}`
  }

  return number
}

/**
 * Get status icon for message
 */
export function getMessageStatusIcon(status?: string): string {
  switch (status) {
    case "pending":
      return "⏱"
    case "sent":
      return "✓"
    case "delivered":
      return "✓✓"
    case "read":
      return "✓✓" // In blue in reality
    case "failed":
      return "✗"
    default:
      return ""
  }
}

/**
 * Get connection status icon
 */
export function getConnectionStatusIcon(status: string): string {
  switch (status) {
    case "WORKING":
      return "🟢"
    case "STARTING":
    case "SCAN_QR_CODE":
      return "🟡"
    case "FAILED":
    case "STOPPED":
      return "🔴"
    default:
      return "⚪"
  }
}

/**
 * Extract message preview data from ChatSummary.lastMessage object
 */
export interface MessagePreview {
  text: string
  timestamp: string
  isFromMe: boolean
  ack: number
  hasMedia: boolean
  mediaType?: "image" | "video" | "audio" | "document"
}

export function extractMessagePreview(lastMessageObj: unknown): MessagePreview {
  // Default fallback
  const defaultPreview: MessagePreview = {
    text: "No messages",
    timestamp: "",
    isFromMe: false,
    ack: 0,
    hasMedia: false,
  }

  if (!lastMessageObj || typeof lastMessageObj !== "object") {
    return defaultPreview
  }

  const msg = lastMessageObj as Record<string, unknown>

  // Extract message text
  let text = ""
  if (typeof msg.body === "string" && msg.body) {
    // Replace newlines with spaces for single-line preview
    text = msg.body.replace(/\r?\n/g, " ").trim()
  } else if (typeof msg.caption === "string" && msg.caption) {
    text = msg.caption.replace(/\r?\n/g, " ").trim()
  }

  // Check for media
  let hasMedia = false
  let mediaType: MessagePreview["mediaType"] = undefined

  if (
    msg.hasMedia === true ||
    msg.type === "image" ||
    msg.type === "video" ||
    msg.type === "audio" ||
    msg.type === "document"
  ) {
    hasMedia = true

    // Determine media type
    if (msg.type === "image" || msg.mimetype?.toString().startsWith("image/")) {
      mediaType = "image"
      text = text || "📷 Photo"
    } else if (msg.type === "video" || msg.mimetype?.toString().startsWith("video/")) {
      mediaType = "video"
      text = text || "🎥 Video"
    } else if (
      msg.type === "audio" ||
      msg.type === "ptt" ||
      msg.mimetype?.toString().startsWith("audio/")
    ) {
      mediaType = "audio"
      text = text || "🎵 Audio"
    } else if (msg.type === "document") {
      mediaType = "document"
      text = text || "📄 Document"
    } else {
      text = text || "📎 Media"
    }
  }

  // If still no text, check for special message types
  if (!text) {
    if (msg.type === "location") {
      text = "📍 Location"
    } else if (msg.type === "vcard") {
      text = "👤 Contact"
    } else if (msg.type === "call_log") {
      text = "📞 Call"
    } else {
      text = "Message"
    }
  }

  // Extract timestamp
  let timestamp = ""
  if (typeof msg.timestamp === "number") {
    timestamp = formatChatTimestamp(msg.timestamp)
  } else if (typeof msg.timestamp === "string") {
    timestamp = formatChatTimestamp(parseInt(msg.timestamp))
  }

  // Check if from me
  const isFromMe = msg.fromMe === true

  // Extract ack
  const ack = typeof msg.ack === "number" ? msg.ack : 0

  return {
    text,
    timestamp,
    isFromMe,
    ack,
    hasMedia,
    mediaType,
  }
}

/**
 * Format timestamp for chat list (shows relative time like WhatsApp)
 */
export function formatChatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()

  // Get start of today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  // If today, show time
  if (date >= todayStart) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // If yesterday, show "Yesterday"
  if (date >= yesterdayStart) {
    return "Yesterday"
  }

  // If within last week, show day name
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  if (date >= weekAgo) {
    return date.toLocaleDateString([], { weekday: "long" })
  }

  // Otherwise show date
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

/**
 * Format message acknowledgment status with color
 */
export function formatAckStatus(ack: number): string | TextChunk {
  // Enum mapping based on WAHA Node definitions:
  // -1: ERROR
  // 0: PENDING
  // 1: SERVER (Sent)
  // 2: DEVICE (Delivered)
  // 3: READ (Read)
  // 4: PLAYED (Played)

  const readColor = WhatsAppTheme.blue

  switch (ack) {
    case -1: // ERROR
    case 0: // PENDING
      return " ○"
    case 1: // SERVER
      return ` ${Icons.checkSingle}`
    case 2: // DEVICE
      return ` ${Icons.checkDouble}`
    case 3: // READ
    case 4: // PLAYED
      // Use fg() directly to return a TextChunk for colored output
      // Note: This requires the consumer to use t`` template tag (e.g. ConversationView)
      // We prepend a space to the icon before styling or handle it in the consumer.
      // fg() applies to the text passed.
      return fg(readColor)(` ${Icons.checkDouble}`)
    default:
      return ""
  }
}

/**
 * Format last seen time
 */
export function formatLastSeen(timestamp: number): string {
  if (!timestamp) return ""
  const date = new Date(timestamp * 1000)
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const dateStr = formatChatTimestamp(timestamp)

  // If dateStr is time only (today), say "today at {time}"
  if (dateStr.includes(":")) {
    return `last seen today at ${time}`
  }
  // If "Yesterday", say "last seen yesterday at {time}"
  if (dateStr === "Yesterday") {
    return `last seen yesterday at ${time}`
  }
  // Otherwise say "last seen {date} at {time}"
  return `last seen ${dateStr} at ${time}`
}

/**
 * Get initials from a name (up to 3 characters)
 */
export function getInitials(name: string, maxCount: number = 3): string {
  if (!name) return "?"
  const words = name.trim().split(/\s+/)
  return words
    .slice(0, maxCount)
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
}

/**
 * Check if a chat ID is a group chat
 */
export function isGroupChat(chatId: string): boolean {
  return chatId.endsWith("@g.us")
}

/**
 * Check if a chat ID is the user's own self-chat (Saved Messages)
 */
export function isSelfChat(chatId: string, myProfileId: string | null): boolean {
  return myProfileId ? chatId === myProfileId : false
}
