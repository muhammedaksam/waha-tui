/**
 * Message Renderer
 * Renders individual message bubbles in the conversation view
 */

import type { WAMessage } from "@muhammedaksam/waha-node"

import { BoxRenderable, CliRenderer, t, TextAttributes, TextRenderable } from "@opentui/core"

import type { WAMessageExtended } from "~/types"
import { WhatsAppTheme } from "~/config/theme"
import { appState } from "~/state/AppState"
import { debugLog } from "~/utils/debug"
import { formatAckStatus, getInitials, isSelfChat } from "~/utils/formatters"
import { getMediaLabel } from "~/utils/mediaLabels"
import { centerText, getSenderInfo } from "~/views/conversation/MessageHelpers"
import { renderReplyContext } from "~/views/conversation/ReplyContext"

/**
 * Render reaction badges below a message
 */
export function renderReactions(
  renderer: CliRenderer,
  reactions: Array<{ text: string; id: string; from?: string }> | undefined,
  _isFromMe: boolean
): BoxRenderable | null {
  if (!reactions || reactions.length === 0) return null

  // Group reactions by emoji text
  const counts = new Map<string, number>()
  for (const r of reactions) {
    counts.set(r.text, (counts.get(r.text) || 0) + 1)
  }

  // Container for the reaction pill
  const container = new BoxRenderable(renderer, {
    flexDirection: "row",
    gap: 1,
    backgroundColor: WhatsAppTheme.panelLight, // Stand out a bit
    paddingLeft: 1,
    paddingRight: 1,
    height: 1,
    // Positioning details:
    // We will place this box relative to the message bubble in the parent
  })

  // Render emojis
  // limit to 3 types of reactions to avoid overflow?
  let renderedCount = 0
  for (const [emoji, count] of counts) {
    if (renderedCount >= 4) break

    container.add(
      new TextRenderable(renderer, {
        content: count > 1 ? `${emoji} ${count}` : emoji,
        fg: WhatsAppTheme.textPrimary,
      })
    )
    renderedCount++
  }

  return container
}

/**
 * Render a single message bubble
 */
export function renderMessage(
  renderer: CliRenderer,
  message: WAMessageExtended,
  isGroupChat: boolean = false,
  isSequenceStart: boolean = true,
  participants?: string[],
  chatId?: string
): BoxRenderable {
  const isFromMe = message.fromMe
  const timestamp = new Date(message.timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  const { senderName, senderColor } = getSenderInfo(message, isGroupChat, participants, chatId)

  // Build message bubble content with WhatsApp-like layout
  // Detect media type and produce descriptive label
  const media = getMediaLabel(message)
  let messageText: string
  let isMediaLabel = false

  if (media.hasMedia) {
    messageText = media.fileSize ? `${media.label}  (${media.fileSize})` : media.label
    isMediaLabel = true
  } else {
    messageText = message.body || ""
  }

  const timestampText = t`${timestamp}${isFromMe ? formatAckStatus(message.ack, {}) : ""}`

  // Create outer row container
  const row = new BoxRenderable(renderer, {
    id: `msg-${message.id || Date.now()}-row`,
    flexDirection: "row",
    justifyContent: isFromMe ? "flex-end" : "flex-start",
    marginBottom: 0, // Tight spacing for grouped messages
    marginTop: isSequenceStart ? 1 : 0, // Add spacing only between groups
  })

  // Avatar Column - WhatsApp Web shows consistent left spacing for all messages
  // In groups: received messages show avatar, sent messages get margin
  // In 1:1: both sent and received get margin
  if (isGroupChat && !isFromMe) {
    // Group chat received messages: show avatar column with avatar or empty placeholder
    const avatarColumn = new BoxRenderable(renderer, {
      width: 6, // Match avatarBox width
      height: 3, // Approximate height of avatar
      marginRight: 1, // Gap between avatar column and message bubble
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    })

    if (isSequenceStart) {
      // Show Avatar
      const avatarBox = new BoxRenderable(renderer, {
        width: 6, // Wider avatar box
        height: 3, // Match column height for vertical centering
        backgroundColor: senderColor,
        justifyContent: "center",
        alignItems: "center",
      })
      const initials = getInitials(senderName)
      // Manually center text for TUI (width 6)
      const centeredInitials = centerText(initials, 6)

      avatarBox.add(
        new TextRenderable(renderer, {
          content: centeredInitials,
          fg: WhatsAppTheme.white,
          attributes: TextAttributes.BOLD,
        })
      )
      avatarColumn.add(avatarBox)
    }
    // else: Empty placeholder - width ensures alignment

    row.add(avatarColumn)
  } else {
    // All other cases: use marginLeft on row to create gap (like WhatsApp Web)
    // This includes: sent messages in groups, and ALL messages in 1:1 chats
    // Using marginLeft instead of spacer box because flex-end ignores spacers
    if (isFromMe) {
      row.marginRight = 7
    } else {
      row.marginLeft = 7
    }
  }

  // Create bubble container
  // Capture message reference for context menu click handler
  const msgRef = message
  const msgId = message.id || String(Date.now())

  // Extract hidden sender info from parent message _data if needed
  let quotedParticipantId: string | undefined
  if (message.replyTo && message._data) {
    if (message._data.quotedParticipant) {
      quotedParticipantId =
        message._data.quotedParticipant._serialized || message._data.quotedParticipant.user
    }
  }

  const bubble = new BoxRenderable(renderer, {
    id: `msg-${msgId}-bubble`,
    maxWidth: "65%",
    // minWidth: "15%",
    padding: 1,
    // marginRight: isFromMe && !message.replyTo ? 1 : 0,
    backgroundColor: isFromMe ? WhatsAppTheme.greenDark : WhatsAppTheme.receivedBubble,
    border: false,
    flexDirection: "column",
    // Handle right-click for context menu
    // Use function (not arrow) to get access to 'this' which is the bubble renderable
    onMouse: function (event) {
      if (event.type === "down" && event.button === 2) {
        // Get bubble's exact screen position and dimensions
        const bubbleX = this.x
        const bubbleY = this.y

        debugLog(
          "ConversationView",
          `Right-clicked message: ${msgId} at bubble pos (${bubbleX}, ${bubbleY})`
        )

        // Pass bubble bounds for precise positioning
        // The context menu will use this to anchor to the bubble's corner
        appState.openContextMenu("message", msgId, msgRef as unknown as WAMessage, {
          x: bubbleX,
          y: bubbleY,
        })
      }
    },
  })

  // Row 1: Sender name (only for group chat received messages AND first in sequence)
  if (isGroupChat && !isFromMe && isSequenceStart) {
    const senderRow = new BoxRenderable(renderer, {
      id: `msg-${message.id || Date.now()}-sender`,
      height: 1,
      flexDirection: "row",
      justifyContent: "flex-start",
    })
    const senderText = new TextRenderable(renderer, {
      content: senderName,
      fg: senderColor,
      attributes: TextAttributes.BOLD,
    })
    senderRow.add(senderText)
    bubble.add(senderRow)
  }

  // Row 1.5: Reply context (if this message is a reply)
  if (message.replyTo) {
    const msgChatId = message.from || message.to || ""
    // Check if this is a self-chat (chatting with yourself)
    const state = appState.getState()
    const currentChatId = state.currentChatId || ""
    const myId = state.myProfile?.id || null
    const isSelfChatFlag = isSelfChat(currentChatId, myId)
    const replyContext = renderReplyContext(
      renderer,
      message.replyTo,
      msgId,
      isFromMe,
      isGroupChat,
      msgChatId,
      quotedParticipantId, // Pass extracted sender ID
      participants,
      isSelfChatFlag // Pass self-chat flag
    )
    if (replyContext) {
      bubble.add(replyContext)
    }
  }

  // Row 2: Media label (if media) — uses dimmed text for the label line
  if (isMediaLabel) {
    const mediaLabelRow = new BoxRenderable(renderer, {
      id: `msg-${message.id || Date.now()}-media-label`,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    })

    const mediaLabelText = new TextRenderable(renderer, {
      content: messageText,
      fg: WhatsAppTheme.textSecondary, // Dimmed for media labels
      flexGrow: 1,
    })
    mediaLabelRow.add(mediaLabelText)

    // If no caption follows, put timestamp on the label row
    if (!media.caption) {
      const timeText = new TextRenderable(renderer, {
        content: timestampText,
        fg: isFromMe ? WhatsAppTheme.textSecondary : WhatsAppTheme.textTertiary,
        flexShrink: 0,
        marginLeft: 1,
      })
      mediaLabelRow.add(timeText)
    }

    bubble.add(mediaLabelRow)
  }

  // Row 2.5: Caption text (if media with caption)
  if (isMediaLabel && media.caption) {
    const captionRow = new BoxRenderable(renderer, {
      id: `msg-${message.id || Date.now()}-caption`,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    })

    const captionText = new TextRenderable(renderer, {
      content: media.caption,
      fg: WhatsAppTheme.textPrimary, // Normal text for captions
      flexGrow: 1,
    })
    captionRow.add(captionText)

    // Timestamp goes on the caption row (last line of content)
    const timeText = new TextRenderable(renderer, {
      content: timestampText,
      fg: isFromMe ? WhatsAppTheme.textSecondary : WhatsAppTheme.textTertiary,
      flexShrink: 0,
      marginLeft: 1,
    })
    captionRow.add(timeText)

    bubble.add(captionRow)
  }

  // Row 3: Regular text content + Timestamp (non-media messages)
  if (!isMediaLabel) {
    const contentRow = new BoxRenderable(renderer, {
      id: `msg-${message.id || Date.now()}-content`,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    })

    const contentText = new TextRenderable(renderer, {
      content: messageText,
      fg: WhatsAppTheme.textPrimary,
      flexGrow: 1,
    })
    contentRow.add(contentText)

    const timeText = new TextRenderable(renderer, {
      content: timestampText,
      fg: isFromMe ? WhatsAppTheme.textSecondary : WhatsAppTheme.textTertiary,
      flexShrink: 0,
      marginLeft: 1,
    })
    contentRow.add(timeText)

    bubble.add(contentRow)
  }

  // Render reactions
  const reactionBox = renderReactions(renderer, message.reactions, isFromMe)

  // Add tail before bubble for received messages
  if (!isFromMe) {
    const tailLeft = new TextRenderable(renderer, {
      content: isSequenceStart ? "◥" : " ",
      fg: WhatsAppTheme.receivedBubble,
    })
    row.add(tailLeft)
  }

  if (reactionBox) {
    // Wrap bubble and reactions in a column to stack them
    const messageContainer = new BoxRenderable(renderer, {
      flexDirection: "column",
      alignItems: isFromMe ? "flex-end" : "flex-start",
    })

    messageContainer.add(bubble)

    // Add reactions below bubble
    messageContainer.add(reactionBox)

    row.add(messageContainer)
  } else {
    row.add(bubble)
  }

  // Add tail after bubble for sent messages
  if (isFromMe) {
    const tailRight = new TextRenderable(renderer, {
      content: isSequenceStart ? "◤" : " ",
      fg: WhatsAppTheme.greenDark,
      marginRight: 1, // Spacing from scrollbar
    })
    row.add(tailRight)
  }

  return row
}
