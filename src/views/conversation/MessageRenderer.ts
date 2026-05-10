/**
 * Message Renderer
 * Renders individual message bubbles in the conversation view
 */

import type { WAMessage } from "@muhammedaksam/waha-node"

import { BoxRenderable, CliRenderer, t, TextAttributes, TextRenderable } from "@opentui/core"

import type { WAMessageExtended } from "~/types"
import { sendPollVote } from "~/client"
import { showPollVotesModal } from "~/components/Modal"
import { Icons, WhatsAppTheme } from "~/config/theme"
import { appState } from "~/state/AppState"
import { debugLog } from "~/utils/debug"
import { formatAckStatus, getInitials, isSelfChat } from "~/utils/formatters"
import { getLinkPreviewData } from "~/utils/linkPreview"
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
  chatId?: string,
  isSelectionMode: boolean = false,
  isSelected: boolean = false
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

  // Identify if this is a poll message early for UI decisions
  const isPoll =
    message.type === "poll" ||
    message.type === "poll_creation" ||
    message._data?.type === "poll" ||
    message._data?.type === "poll_creation" ||
    !!message._data?.poll

  const isEdited = (message as WAMessageExtended).isEdited === true
  const editedLabel = isEdited ? "edited " : ""
  const timestampText = t`${editedLabel}${timestamp}${isFromMe ? formatAckStatus(message.ack, {}) : ""}`

  // Create outer row container
  const row = new BoxRenderable(renderer, {
    id: `msg-${message.id || Date.now()}-row`,
    flexDirection: "row",
    justifyContent: isFromMe ? "flex-end" : "flex-start",
    marginBottom: 0, // Tight spacing for grouped messages
    marginTop: isSequenceStart ? 1 : 0, // Add spacing only between groups
  })

  // Multi-selection checkbox
  if (isSelectionMode) {
    const checkboxBox = new BoxRenderable(renderer, {
      width: 4,
      height: 1,
      justifyContent: "center",
      alignItems: "center",
      onMouse: function (event) {
        if (event.type === "down" && event.button === 0 && chatId) {
          appState.toggleMessageSelection(chatId, message.id)
          event.stopPropagation()
        }
      },
    })
    checkboxBox.add(
      new TextRenderable(renderer, {
        content: isSelected ? "☑ " : "☐ ",
        fg: isSelected ? WhatsAppTheme.green : WhatsAppTheme.textSecondary,
        attributes: TextAttributes.BOLD,
      })
    )
    row.add(checkboxBox)
  }

  // Use explicit spacers instead of margins for rock-solid alignment
  if (!isFromMe) {
    // Received side: Avatar column (6) + Gap (1)
    const avatarColumn = new BoxRenderable(renderer, {
      width: 6,
      height: 1,
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    })

    if (isGroupChat && isSequenceStart) {
      const avatarBox = new BoxRenderable(renderer, {
        width: 6,
        height: 3,
        backgroundColor: senderColor,
        justifyContent: "center",
        alignItems: "center",
      })
      const initials = getInitials(senderName)
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
    row.add(avatarColumn)
    row.add(new BoxRenderable(renderer, { width: 1 })) // 1 char gap
  } else {
    // Sent side: add a flexible spacer at the start to push everything to the right
    // This replaces justifyContent: "flex-end" for more predictable behavior with spacers
    row.add(new BoxRenderable(renderer, { flexGrow: 1 }))
    row.justifyContent = "flex-start" // We use flexGrow spacer instead
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
      if (isSelectionMode && event.type === "down" && event.button === 0 && chatId) {
        appState.toggleMessageSelection(chatId, message.id)
        event.stopPropagation()
        return
      }

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

  // Row 1.75: Forwarded indicator
  const isForwarded = message.isForwarded || message._data?.isForwarded
  if (isForwarded) {
    const forwardedRow = new BoxRenderable(renderer, {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: 0,
    })

    forwardedRow.add(
      new TextRenderable(renderer, {
        content: t`➦ Forwarded`,
        fg: WhatsAppTheme.textSecondary,
        attributes: TextAttributes.ITALIC,
      })
    )
    bubble.add(forwardedRow)
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
  // Suppress Row 3 if it's a poll message or a media message with a label
  if (!isMediaLabel && !isPoll) {
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

  // Row 4: Poll (if this is a poll message)
  if (isPoll && message._data) {
    interface PollOption {
      name?: string
      localId?: number | string
    }
    interface PollVoteInfo {
      optionLocalId: number | string
      count: number
      voters?: string[]
    }
    interface PollData {
      name?: string
      pollName?: string
      options?: PollOption[]
      pollOptions?: PollOption[]
      votes?: PollVoteInfo[]
      pollVotesSnapshot?: {
        pollVotes: PollVoteInfo[]
      }
      multipleAnswers?: boolean
      allowMultipleAnswers?: boolean
      pollSelectableOptionsCount?: number
      selectableOptionsCount?: number
    }

    const pollData = (message._data?.poll || message._data) as PollData
    const question = pollData.name || pollData.pollName || "Poll"

    const options = pollData.options || pollData.pollOptions || []
    const votes = pollData.votes || pollData.pollVotesSnapshot?.pollVotes || []

    // Detect multiple answers
    let multipleAnswers = pollData.multipleAnswers || pollData.allowMultipleAnswers || false
    if (pollData.pollSelectableOptionsCount !== undefined) {
      multipleAnswers = pollData.pollSelectableOptionsCount !== 1
    } else if (pollData.selectableOptionsCount !== undefined) {
      multipleAnswers = pollData.selectableOptionsCount !== 1
    }

    // Total votes for percentage calculation
    const totalVotes = votes.reduce((sum, v) => sum + (v.count || 0), 0)

    const pollBox = new BoxRenderable(renderer, {
      flexDirection: "column",
      marginTop: 0,
      padding: 0,
      border: false,
    })

    // Header: Question
    pollBox.add(
      new TextRenderable(renderer, {
        content: question,
        fg: WhatsAppTheme.textPrimary,
        attributes: TextAttributes.BOLD,
      })
    )

    // Sub-header: Instruction
    const instruction = multipleAnswers ? "Select one or more" : "Select one"

    const instructionBox = new BoxRenderable(renderer, {
      marginBottom: 1,
    })
    const pollIcon = multipleAnswers ? Icons.pollMultiple : Icons.poll
    instructionBox.add(
      new TextRenderable(renderer, {
        content: `${pollIcon} ${instruction}`,
        fg: WhatsAppTheme.textSecondary,
      })
    )
    pollBox.add(instructionBox)

    // Options
    options.forEach((opt) => {
      const optionName = opt.name || (opt as unknown as string)
      const optionId = opt.localId !== undefined ? opt.localId : optionName
      const voteInfo = votes.find((v) => v.optionLocalId === optionId)
      const count = voteInfo ? voteInfo.count : 0
      const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0

      const optionContainer = new BoxRenderable(renderer, {
        flexDirection: "column",
        marginBottom: 1,
        onMouse: function (event) {
          if (event.type === "down" && event.button === 0) {
            const state = appState.getState()
            const chatId = state.currentChatId
            debugLog("Poll", `Option clicked: ${optionName} for message ${message.id}`)
            if (chatId && message.id) {
              sendPollVote(chatId, message.id, [optionName]).catch((err) => {
                debugLog("Poll", `Failed to vote: ${err.message}`)
                appState.showToast(err.message, "error")
              })
            }
          }
        },
      })

      const voters = voteInfo?.voters || []
      const myId = appState.getState().myProfile?.id
      const hasVoted = myId ? voters.includes(myId) : false

      // Top row: Icon + Name + Count
      const labelRow = new BoxRenderable(renderer, {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      })

      const leftPart = new BoxRenderable(renderer, {
        flexDirection: "row",
        gap: 1,
      })

      leftPart.add(
        new TextRenderable(renderer, {
          content: hasVoted ? "◉" : "○", // Show filled icon if voted
          fg: hasVoted ? WhatsAppTheme.green : WhatsAppTheme.textSecondary,
        })
      )

      leftPart.add(
        new TextRenderable(renderer, {
          content: optionName,
          fg: WhatsAppTheme.textPrimary,
        })
      )

      labelRow.add(leftPart)

      labelRow.add(
        new TextRenderable(renderer, {
          content: `${count}`,
          fg: WhatsAppTheme.textSecondary,
        })
      )

      optionContainer.add(labelRow)

      const barWidth = 30
      const filledWidth = Math.round((percentage / 100) * barWidth)

      // Progress bar container
      const progressContainer = new BoxRenderable(renderer, {
        flexDirection: "row",
        paddingLeft: 3,
        height: 1,
      })

      if (filledWidth > 0) {
        progressContainer.add(
          new TextRenderable(renderer, {
            content: "━".repeat(filledWidth),
            fg: WhatsAppTheme.green,
          })
        )
      }

      if (barWidth - filledWidth > 0) {
        progressContainer.add(
          new TextRenderable(renderer, {
            content: "━".repeat(barWidth - filledWidth),
            fg: WhatsAppTheme.divider,
          })
        )
      }

      optionContainer.add(progressContainer)
      pollBox.add(optionContainer)
    })

    // Timestamp and Status Row (Bottom right of poll content)
    const timeRow = new BoxRenderable(renderer, {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 0,
      paddingRight: 1,
    })
    timeRow.add(
      new TextRenderable(renderer, {
        content: timestampText,
        fg: isFromMe ? WhatsAppTheme.textSecondary : WhatsAppTheme.textTertiary,
      })
    )
    pollBox.add(timeRow)

    // Separator line before View Votes
    const separator = new TextRenderable(renderer, {
      content: "━".repeat(35),
      fg: WhatsAppTheme.divider,
    })
    pollBox.add(separator)

    const footer = new BoxRenderable(renderer, {
      marginTop: 0,
      flexDirection: "row",
      justifyContent: "center",
    })

    const viewVotesBtn = new BoxRenderable(renderer, {
      paddingLeft: 1,
      paddingRight: 1,
      onMouse: (e) => {
        if (totalVotes > 0 && e.type === "down" && e.button === 0) {
          debugLog("Poll", `Opening votes modal for ${message.id}`)
          showPollVotesModal(message)
          e.stopPropagation()
        }
      },
    })

    viewVotesBtn.add(
      new TextRenderable(renderer, {
        content: "View Votes",
        fg: totalVotes > 0 ? WhatsAppTheme.green : WhatsAppTheme.textSecondary,
        attributes: TextAttributes.BOLD,
      })
    )

    footer.add(viewVotesBtn)
    pollBox.add(footer)
    bubble.add(pollBox)
  }

  // Row 3.5: Link preview box (if URL metadata is available from WAHA)
  const linkPreview = getLinkPreviewData(message)
  if (linkPreview) {
    const previewWrapper = new BoxRenderable(renderer, {
      flexDirection: "row",
      marginTop: 1,
    })

    // Left accent bar
    previewWrapper.add(
      new TextRenderable(renderer, {
        content: "▎",
        fg: WhatsAppTheme.blue,
      })
    )

    const previewContent = new BoxRenderable(renderer, {
      flexDirection: "column",
      backgroundColor: isFromMe ? WhatsAppTheme.quoteSentBg : WhatsAppTheme.quoteReceivedBg,
      paddingLeft: 1,
      paddingRight: 1,
      flexGrow: 1,
    })

    if (linkPreview.title) {
      previewContent.add(
        new TextRenderable(renderer, {
          content: linkPreview.title,
          fg: WhatsAppTheme.textPrimary,
          attributes: TextAttributes.BOLD,
        })
      )
    }

    if (linkPreview.description) {
      // Truncate long descriptions
      const desc =
        linkPreview.description.length > 120
          ? linkPreview.description.slice(0, 117) + "..."
          : linkPreview.description
      previewContent.add(
        new TextRenderable(renderer, {
          content: desc,
          fg: WhatsAppTheme.textSecondary,
        })
      )
    }

    // Show the URL in blue
    const displayUrl = linkPreview.canonicalUrl || linkPreview.url
    previewContent.add(
      new TextRenderable(renderer, {
        content: displayUrl,
        fg: WhatsAppTheme.blue,
      })
    )

    previewWrapper.add(previewContent)
    bubble.add(previewWrapper)
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

  // Add tail/spacer after bubble for sent messages to maintain alignment
  if (isFromMe) {
    // Wrap tail in a solid Box to act as a physical barrier against bubble overlap
    const tailContainer = new BoxRenderable(renderer, {
      width: 1,
      height: 1,
      backgroundColor: WhatsAppTheme.deepDark, // Force separation with chat background
    })

    tailContainer.add(
      new TextRenderable(renderer, {
        content: isSequenceStart ? "◤" : " ",
        fg: isSequenceStart ? WhatsAppTheme.sentBubble : "transparent",
      })
    )

    row.add(tailContainer)
    row.add(new BoxRenderable(renderer, { width: 1 })) // 1 char gap
    row.add(new BoxRenderable(renderer, { width: 6 })) // 6 char avatar placeholder
  }

  return row
}
