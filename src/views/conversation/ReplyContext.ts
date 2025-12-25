/**
 * Reply Context Renderer
 * Renders the quoted/reply context box above a reply message
 */

import { BoxRenderable, CliRenderer, TextAttributes, TextRenderable } from "@opentui/core"

import type { WAMessageExtended } from "../../types"
import { WhatsAppTheme } from "../../config/theme"
import { appState } from "../../state/AppState"
import { debugLog } from "../../utils/debug"
import { isSelfChat, truncate } from "../../utils/formatters"
import { getSenderColor } from "./MessageHelpers"

/**
 * Render the quoted/reply context box above a reply message
 */
export function renderReplyContext(
  renderer: CliRenderer,
  replyTo: WAMessageExtended["replyTo"],
  messageId: string,
  isFromMe: boolean,
  isGroupChat: boolean,
  chatId: string,
  quotedParticipantId?: string,
  participants?: string[],
  isSelfChatFlag?: boolean
): BoxRenderable | null {
  if (!replyTo) return null

  // Determine sender name and color for the quoted message
  let quotedSenderName = "Unknown"

  // Cast _data to access potential nested fields
  const replyData = replyTo._data as Record<string, unknown> | undefined

  // Check if quoted message is from me directly from replyTo fields
  // This is more reliable than ID comparison for group chats
  const replyToFromMe =
    (replyTo as { fromMe?: boolean }).fromMe === true || replyData?.fromMe === true

  debugLog(
    "renderReplyContext",
    `replyTo keys: ${Object.keys(replyTo).join(", ")}, replyData?.fromMe=${replyData?.fromMe}, replyToFromMe=${replyToFromMe}`
  )

  // Extract sender ID - priority:
  // 1. Explicit participant field in replyTo
  // 2. Fallback ID passed from parent message (message._data.quotedParticipant._serialized)
  // 3. Nested fields in replyTo._data
  let quotedSenderId = ""

  if (typeof replyTo.participant === "string" && replyTo.participant) {
    quotedSenderId = replyTo.participant
  } else if (quotedParticipantId) {
    quotedSenderId = quotedParticipantId
  } else if (replyData) {
    // Try to get sender ID from _data.from or _data.author
    if (typeof replyData.from === "string" && replyData.from) {
      quotedSenderId = replyData.from
    } else if (typeof replyData.author === "string" && replyData.author) {
      quotedSenderId = replyData.author
    }
  }

  // WAHA CORE workaround: Look up the original message by ID to find the sender
  // This is more reliable than inference because it finds the actual message
  const state = appState.getState()
  const myProfileId = state.myProfile?.id
  // Use isSelfChat for proper ID comparison (handles @c.us suffix differences)
  // In self-chats, ALL quoted messages are from "me" since it's a chat with yourself
  // Also use replyToFromMe flag from replyTo object (handles group chat quotes with @lid IDs)
  let isQuotedFromMe =
    replyToFromMe ||
    isSelfChatFlag ||
    (quotedSenderId !== "" && isSelfChat(quotedSenderId, myProfileId ?? null))

  // Always try to find the quoted message in cache - fromMe is the authoritative source
  if (replyTo.id) {
    const messages = state.messages.get(state.currentChatId || "") || []
    const quotedMessage = messages.find(
      (msg) => msg.id === replyTo.id || msg.id?.endsWith(replyTo.id)
    )

    if (quotedMessage) {
      // Found the original message - use its fromMe flag (authoritative)
      isQuotedFromMe = quotedMessage.fromMe
      if (!isQuotedFromMe) {
        // Get sender ID from the quoted message
        quotedSenderId = (quotedMessage.participant || quotedMessage.from || chatId) as string
      } else {
        quotedSenderId = myProfileId || ""
      }
    } else if (!quotedSenderId && !isGroupChat && chatId) {
      // Fallback for 1:1 chats when message not in cache and no sender ID extracted
      // In 1:1, there are only 2 people: me and the other person (chatId)
      // Best heuristic: assume reply is to the OTHER person's message (most common pattern)
      if (isFromMe) {
        // I'm replying -> most likely quoting them
        quotedSenderId = chatId
        isQuotedFromMe = isSelfChat(chatId, myProfileId ?? null) // Handle self-chat case
      } else {
        // They're replying -> most likely quoting me
        quotedSenderId = myProfileId || ""
        isQuotedFromMe = true
      }
    }
  }

  if (isQuotedFromMe) {
    quotedSenderName = "You"
  } else if (quotedSenderId) {
    // Priority 1: Check contacts cache using sender ID
    const cachedName = appState.getContactName(quotedSenderId)
    if (cachedName) {
      quotedSenderName = cachedName
    } else {
      // Priority 2: Fallback to phone number from sender ID
      const parts = quotedSenderId.split("@")
      quotedSenderName = parts[0]
    }
  }

  // Use sender ID for color consistency, fallback to name
  const colorSeed = quotedSenderId || quotedSenderName
  const senderColor = isQuotedFromMe
    ? WhatsAppTheme.green
    : getSenderColor(colorSeed, participants, chatId)
  const quotedText = replyTo.body || "[Media]"

  // Create the reply context container (use darker backgrounds for quote)
  const contextBox = new BoxRenderable(renderer, {
    id: `msg-${messageId}-reply-context`,
    flexDirection: "row",
    backgroundColor: isFromMe ? WhatsAppTheme.quoteSentBg : WhatsAppTheme.quoteReceivedBg,
    marginBottom: 1,
    border: false,
  })

  // Colored left border bar (WhatsApp style)
  const colorBar = new BoxRenderable(renderer, {
    id: `msg-${messageId}-reply-bar`,
    width: 1,
    backgroundColor: senderColor,
  })
  contextBox.add(colorBar)

  // Content area (sender name + truncated message)
  const contentBox = new BoxRenderable(renderer, {
    id: `msg-${messageId}-reply-content`,
    flexDirection: "column",
    flexGrow: 1,
    paddingLeft: 1,
    paddingRight: 1,
  })

  // Sender name
  contentBox.add(
    new TextRenderable(renderer, {
      content: quotedSenderName,
      fg: senderColor,
      attributes: TextAttributes.BOLD,
    })
  )

  // Quoted message text (truncated)
  contentBox.add(
    new TextRenderable(renderer, {
      content: truncate(quotedText, 50),
      fg: WhatsAppTheme.textSecondary,
    })
  )

  contextBox.add(contentBox)
  return contextBox
}
