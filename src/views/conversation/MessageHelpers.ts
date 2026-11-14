/**
 * Message Helpers
 * Utility functions for message rendering in ConversationView
 */

import type { ColorInput } from "@opentui/core"

import { BoxRenderable, CliRenderer, TextRenderable } from "@opentui/core"

import type { WAMessageExtended } from "~/types"
import { WhatsAppTheme } from "~/config/theme"
import { appState } from "~/state/AppState"
import { formatPhoneNumber } from "~/utils/formatters"

/**
 * Simple string hash function for consistent color assignment
 */
export function stringHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash = hash & hash
  }
  return hash
}

/**
 * Hash function to assign consistent colors to senders (Round-Robin with fallback)
 */
export function getSenderColor(
  senderId: string,
  participants?: string[],
  chatId?: string
): ColorInput {
  const colors = WhatsAppTheme.senderColors

  // If we have a participants list, use round-robin assignment based on per-group randomized sorting
  if (participants && participants.length > 0) {
    // Sort participants deterministically but randomly per group
    // We use a hash of (participantId + chatId) to seed the sort order
    // This ensures that if two people have colliding colors in one group,
    // they essentially "re-roll" their relative order in another group.
    const sortedParticipants = [...participants].sort((a, b) => {
      // Use simple string comparison if no chatId (fallback to alphabetical)
      if (!chatId) return a.localeCompare(b)

      const hashA = stringHash(a + chatId)
      const hashB = stringHash(b + chatId)
      return hashA - hashB
    })

    const index = sortedParticipants.indexOf(senderId)
    if (index !== -1) {
      return colors[index % colors.length]
    }
  }

  // Fallback to hash-based assignment
  const hash = stringHash(senderId)
  return colors[Math.abs(hash) % colors.length]
}

/**
 * Resolves the display name for a sender ID according to WhatsApp conventions:
 * 1. Saved contact: show the saved name.
 * 2. Phone and pushname both known: show `${formattedPhone} ~${pushname}`.
 * 3. Only the pushname known: show `~${pushname}`.
 * 4. Only the phone known: show the formatted phone number from getPhoneFromLid plus formatPhoneNumber.
 * Fallback: LID digits (split('@')[0]).
 */
export function resolveSenderDisplayName(senderId: string, inlinePushName?: string): string {
  if (!senderId) return ""

  // Priority 1: Saved contact: show the name
  const savedName = appState.getContactName(senderId)
  if (savedName) {
    return savedName
  }

  // Determine push name
  const rawPushName = inlinePushName || appState.getPushName(senderId)
  const pushName = rawPushName?.trim()
  const tildePushName = pushName
    ? pushName.startsWith("~")
      ? pushName
      : `~${pushName}`
    : undefined

  // Determine phone number (LIDs must be resolved via getPhoneFromLid)
  let phoneId: string | undefined
  if (senderId.endsWith("@lid")) {
    phoneId = appState.getPhoneFromLid(senderId)
  } else if (!senderId.endsWith("@g.us") && !senderId.endsWith("@broadcast")) {
    phoneId = senderId
  }

  const formattedPhone = phoneId ? formatPhoneNumber(phoneId) : undefined

  // Priority 2: Phone and pushname both known: show +44 7700 900001 ~Alice
  if (formattedPhone && tildePushName) {
    return `${formattedPhone} ${tildePushName}`
  }

  // Priority 3: Only the pushname known: show ~Alice
  if (tildePushName) {
    return tildePushName
  }

  // Priority 4: Only the phone known: show the formatted phone number
  if (formattedPhone) {
    return formattedPhone
  }

  // Fallback: LID digits
  const parts = senderId.split("@")
  return parts[0]
}

/**
 * Helper to get sender info (ID, Name, Color)
 */
export function getSenderInfo(
  message: WAMessageExtended,
  isGroupChat: boolean,
  participants?: string[],
  chatId?: string
): { senderId: string; senderName: string; senderColor: ColorInput } {
  const isFromMe = message.fromMe
  let senderName: string
  let senderId: string

  if (isFromMe) {
    senderName = "You"
    senderId = appState.getState().myProfile?.id || "me"
  } else {
    senderId = message.from || ""
    if (isGroupChat && message.participant) {
      senderId = message.participant
    }

    const inlinePushName =
      message._data?.notifyName ||
      message._data?.pushName ||
      (message as { pushName?: string }).pushName ||
      (message as { notifyName?: string }).notifyName

    senderName = resolveSenderDisplayName(senderId, inlinePushName)
  }

  const senderColor = isFromMe
    ? WhatsAppTheme.green
    : getSenderColor(senderId, participants, chatId)

  return { senderId, senderName, senderColor }
}

/**
 * Helper to format date for separator
 */
export function formatDateSeparator(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const dateStr = date.toDateString()
  if (dateStr === today.toDateString()) {
    return "Today"
  }
  if (dateStr === yesterday.toDateString()) {
    return "Yesterday"
  }

  // Check if within last 7 days for weekday name
  const diffTime = Math.abs(today.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays < 7 && date < today) {
    return date.toLocaleDateString("en-US", { weekday: "long" })
  }

  // Otherwise Full Date
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

/**
 * Renderable for Day Separator
 */
export function DaySeparator(renderer: CliRenderer, label: string): BoxRenderable {
  const container = new BoxRenderable(renderer, {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 1,
    marginTop: 1,
  })

  const badge = new BoxRenderable(renderer, {
    backgroundColor: WhatsAppTheme.panelLight,
    paddingLeft: 2,
    paddingRight: 2,
    border: false,
  })

  const text = new TextRenderable(renderer, {
    content: label,
    fg: WhatsAppTheme.textSecondary,
  })

  badge.add(text)
  container.add(badge)
  return container
}

/**
 * Helper to center text in a fixed width
 */
export function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width)
  const paddingLeft = Math.floor((width - text.length) / 2)
  return text.padStart(text.length + paddingLeft).padEnd(width)
}
