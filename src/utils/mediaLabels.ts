/**
 * Media Labels Utility
 * Shared logic for generating descriptive labels for media messages.
 * Used by both the conversation view (MessageRenderer) and chat list (extractMessagePreview).
 */

import type { WAMessageExtended } from "~/types"

/**
 * Result of media label detection for a message.
 */
export interface MediaLabel {
  /** Emoji-prefixed label, e.g. "📷 Photo", "📎 Document: report.pdf" */
  label: string
  /** Media caption text, if present and distinct from the label */
  caption?: string
  /** Human-readable file size, e.g. "2.4 MB" */
  fileSize?: string
  /** Whether this message is a media/special message type */
  hasMedia: boolean
}

/**
 * Internal representation of the loosely-typed _data payload.
 * Covers fields observed in both WAHA CORE and PLUS tiers.
 */
interface MessageData {
  type?: string
  mimetype?: string
  filename?: string
  size?: number
  fileSizeBytes?: number
  caption?: string
  body?: string
  mediaData?: {
    filename?: string
    mimetype?: string
  }
  // Location data
  lat?: number
  lng?: number
  loc?: string
  // vCard data
  vcardFormattedName?: string
  // Multi-vcard
  vcardList?: unknown[]
  [key: string]: unknown
}

/**
 * Analyse a WAMessageExtended and produce a descriptive media label.
 *
 * Detection priority:
 * 1. `message.type` (most reliable – set by WAHA)
 * 2. `message.hasMedia` flag with mimetype sniffing
 * 3. Fallback generic label
 */
export function getMediaLabel(message: WAMessageExtended): MediaLabel {
  const data = (message._data ?? {}) as MessageData
  const msgAny = message as Record<string, unknown>
  const type = (msgAny.type as string) ?? data.type ?? ""
  const hasMedia = msgAny.hasMedia === true || !!type

  // Extract caption — prefer _data.caption, fall back to body when message carries media
  let caption: string | undefined
  if (data.caption) {
    caption = data.caption
  } else if (hasMedia && message.body && type !== "" && type !== "chat") {
    // When a media message has a body, it's typically the caption
    caption = message.body
  }

  // Extract file size
  const sizeBytes = data.size ?? data.fileSizeBytes
  const fileSize =
    typeof sizeBytes === "number" && sizeBytes > 0 ? formatFileSize(sizeBytes) : undefined

  // Extract filename
  const filename = data.filename ?? data.mediaData?.filename ?? (data.body as string | undefined)

  switch (type) {
    case "image":
      return { label: "📷 Photo", caption, fileSize, hasMedia: true }

    case "video":
    case "gif":
      return { label: "🎥 Video", caption, fileSize, hasMedia: true }

    case "audio":
      return { label: "🎵 Audio", caption, fileSize, hasMedia: true }

    case "ptt":
      return { label: "🎤 Voice message", caption, fileSize, hasMedia: true }

    case "document": {
      const docName = typeof filename === "string" && filename ? filename : undefined
      const label = docName ? `📎 Document: ${docName}` : "📎 Document"
      return { label, caption, fileSize, hasMedia: true }
    }

    case "sticker":
      return { label: "🏷 Sticker", hasMedia: true }

    case "location":
    case "live_location": {
      const locName = data.loc ? `: ${data.loc}` : ""
      return { label: `📍 Location${locName}`, hasMedia: true }
    }

    case "vcard": {
      const contactName = data.vcardFormattedName
      const label = contactName ? `👤 Contact: ${contactName}` : "👤 Contact"
      return { label, hasMedia: true }
    }

    case "multi_vcard": {
      const count = Array.isArray(data.vcardList) ? data.vcardList.length : 0
      const label = count > 0 ? `👤 ${count} Contacts` : "👤 Contacts"
      return { label, hasMedia: true }
    }

    case "call_log":
      return { label: "📞 Call", hasMedia: true }

    case "e2e_notification":
    case "notification":
    case "notification_template":
    case "gp2":
    case "ciphertext":
      // System / encrypted messages — treated as special, not user media
      return { label: "🔒 Encrypted message", hasMedia: true }

    case "revoked":
      return { label: "🚫 This message was deleted", hasMedia: true }

    default:
      break
  }

  // Fallback: check hasMedia flag with mimetype sniffing
  if (msgAny.hasMedia === true) {
    const mimetype = (msgAny.mimetype as string) ?? data.mimetype ?? ""
    if (mimetype.startsWith("image/")) {
      return { label: "📷 Photo", caption, fileSize, hasMedia: true }
    }
    if (mimetype.startsWith("video/")) {
      return { label: "🎥 Video", caption, fileSize, hasMedia: true }
    }
    if (mimetype.startsWith("audio/")) {
      return { label: "🎵 Audio", caption, fileSize, hasMedia: true }
    }
    return { label: "📎 Media", caption, fileSize, hasMedia: true }
  }

  // Not a media message
  return { label: "", hasMedia: false }
}

/**
 * Lightweight media label extraction for reply context objects,
 * which have a more limited data shape than full messages.
 */
export function getMediaLabelFromReply(replyTo: WAMessageExtended["replyTo"]): string | null {
  if (!replyTo) return null

  const data = (replyTo._data ?? {}) as MessageData
  const replyAny = replyTo as Record<string, unknown>
  const type = (replyAny.type as string) ?? data.type ?? ""

  switch (type) {
    case "image":
      return "📷 Photo"
    case "video":
    case "gif":
      return "🎥 Video"
    case "audio":
      return "🎵 Audio"
    case "ptt":
      return "🎤 Voice message"
    case "document":
      return "📎 Document"
    case "sticker":
      return "🏷 Sticker"
    case "location":
    case "live_location":
      return "📍 Location"
    case "vcard":
      return "👤 Contact"
    case "multi_vcard":
      return "👤 Contacts"
    case "call_log":
      return "📞 Call"
    default:
      break
  }

  // Check hasMedia flag
  if (replyAny.hasMedia === true) {
    return "📎 Media"
  }

  return null
}

/**
 * Format a byte count into a human-readable string.
 *
 * @example formatFileSize(0)          → "0 B"
 * @example formatFileSize(1023)       → "1023 B"
 * @example formatFileSize(1024)       → "1.0 KB"
 * @example formatFileSize(1536)       → "1.5 KB"
 * @example formatFileSize(1048576)    → "1.0 MB"
 * @example formatFileSize(1073741824) → "1.0 GB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB"]
  let unitIndex = 0
  let size = bytes

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  // Show decimal only for KB and above
  if (unitIndex === 0) {
    return `${Math.round(size)} B`
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}
