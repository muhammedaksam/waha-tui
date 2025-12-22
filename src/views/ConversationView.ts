/**
 * Conversation View
 * Display messages for a selected chat
 */

import {
  Box,
  Text,
  TextAttributes,
  TextRenderable,
  BoxRenderable,
  t,
  TextareaRenderable,
  RenderableEvents,
  fg,
  ScrollBarRenderable,
} from "@opentui/core"
import { ScrollBoxRenderable } from "@opentui/core"
import { appState } from "../state/AppState"
import { getRenderer } from "../state/RendererContext"
import { WhatsAppTheme, Icons } from "../config/theme"
import { debugLog } from "../utils/debug"
import { sendMessage, loadChatDetails, sendTypingState } from "../client"
import {
  formatLastSeen,
  truncate,
  getInitials,
  isGroupChat,
  isSelfChat,
  getChatIdString,
  getPhoneNumber,
} from "../utils/formatters"
import {
  renderMessage,
  formatDateSeparator,
  DaySeparator,
  getSenderColor,
  getSenderInfo,
} from "./conversation"

// Cache for conversation scroll box and input
let conversationScrollBox: ScrollBoxRenderable | null = null
let messageInputComponent: TextareaRenderable | null = null
let inputContainer: BoxRenderable | null = null
let inputScrollBar: ScrollBarRenderable | null = null
let typingTimeout: ReturnType<typeof setTimeout> | null = null

// Expose input focus control
export function focusMessageInput(): void {
  if (messageInputComponent) {
    messageInputComponent.focus()
  }
}

export function blurMessageInput(): void {
  if (messageInputComponent) {
    messageInputComponent.blur()
  }
}

export function isMessageInputFocused(): boolean {
  return messageInputComponent ? messageInputComponent.focused : false
}

export function ConversationView() {
  const state = appState.getState()
  const renderer = getRenderer()

  if (!state.currentChatId || !state.currentSession) {
    return Box(
      {
        flexDirection: "column",
        flexGrow: 1,
        padding: 2,
        justifyContent: "center",
        alignItems: "center",
      },
      Text({
        content: "No chat selected",
        fg: WhatsAppTheme.textSecondary,
      })
    )
  }

  // Determine if this is a group chat or self-chat
  const isGroup = isGroupChat(state.currentChatId)
  const isSelf = isSelfChat(state.currentChatId, state.myProfile?.id ?? null)

  // Get current chat info
  const currentChat = state.chats.find((chat) => getChatIdString(chat.id) === state.currentChatId)
  const baseChatName = currentChat?.name || state.currentChatId
  // Add "(You)" suffix for self-chat
  const chatName = isSelf ? `${baseChatName} (You)` : baseChatName

  // Get messages for this chat
  const messages = state.messages.get(state.currentChatId) || []

  // Messages - newest at bottom (WhatsApp style)
  const reversedMessages = messages.slice().reverse()

  // Get participant IDs for color assignment
  const participantIds =
    isGroup && state.currentChatParticipants
      ? state.currentChatParticipants.map((p) => p.id)
      : undefined

  // Set header subtitle based on chat type
  let headerSubtitle = isSelf
    ? "Message yourself"
    : `click here for ${isGroup ? "group" : "contact"} info`
  let headerSubtitleColor: string = WhatsAppTheme.textSecondary

  if (isGroup) {
    // Group chat: show participants and presence
    const participantNames: string[] = []
    let typingStatus = ""

    if (state.currentChatParticipants) {
      // Build list of names
      participantNames.push(
        ...state.currentChatParticipants.map((p) => {
          const contactName = appState.getContactName(p.id)
          if (contactName) return contactName
          return getPhoneNumber(p.id)
        })
      )

      // Check for typing/online presence in group
      const presences = state.currentChatPresence?.presences || []
      const typingParticipants = presences.filter(
        (p) => p.lastKnownPresence === "typing" || p.lastKnownPresence === "recording"
      )

      if (typingParticipants.length > 0) {
        const typingNames = typingParticipants.map((p) => {
          const contactName = appState.getContactName(p.participant)
          return contactName || getPhoneNumber(p.participant)
        })

        if (typingNames.length === 1) {
          typingStatus = `${typingNames[0]} is typing...`
        } else {
          typingStatus = `${typingNames.length} people are typing...`
        }
      }
    } else {
      loadChatDetails(state.currentChatId)
    }

    // Priority: Typing status > Participant list
    if (typingStatus) {
      headerSubtitle = typingStatus
      headerSubtitleColor = WhatsAppTheme.green
    } else if (participantNames.length > 0) {
      headerSubtitle = truncate(participantNames.join(", "), 60)
    }
  } else {
    // Direct chat: show presence
    // Use isChatTyping for consistent typing detection with chat list
    if (state.currentChatId && appState.isChatTyping(state.currentChatId)) {
      headerSubtitle = "typing..."
      headerSubtitleColor = WhatsAppTheme.textSecondary // Gray like WhatsApp Web header
    } else {
      // Not typing - show regular presence status
      const presence = state.currentChatPresence
      if (presence?.presences && presence.presences.length > 0) {
        // Find the best presence to display (prefer online, then last seen)
        const onlinePresence = presence.presences.find((p) => p.lastKnownPresence === "online")
        const presenceToShow = onlinePresence || presence.presences[0]

        if (presenceToShow) {
          if (presenceToShow.lastKnownPresence === "online") {
            headerSubtitle = "online"
          } else if (presenceToShow.lastSeen) {
            headerSubtitle = formatLastSeen(presenceToShow.lastSeen)
          } else {
            headerSubtitle = "" // Don't show "offline" or "paused"
          }
        }
      } else {
        // Trigger load if not present
        headerSubtitle = ""
        loadChatDetails(state.currentChatId!)
      }
    }
  }

  const header = Box(
    {
      height: 5,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingLeft: 1,
      paddingRight: 1,
      backgroundColor: WhatsAppTheme.panelLight,
      border: true,
      borderColor: WhatsAppTheme.borderLight,
    },
    // Avatar
    Box(
      {
        width: 7,
        height: 3,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: WhatsAppTheme.green,
        marginRight: 2,
      },
      Text({
        content: getInitials(chatName),
        fg: WhatsAppTheme.white,
        attributes: TextAttributes.BOLD,
      })
    ),
    // Name and subtitle column
    Box(
      {
        flexDirection: "column",
        justifyContent: "center",
        flexGrow: 1,
      },
      ...(headerSubtitle
        ? [
            Text({ content: chatName, fg: WhatsAppTheme.white, attributes: TextAttributes.BOLD }),
            Text({ content: headerSubtitle, fg: headerSubtitleColor }),
          ]
        : [
            Text({}),
            Text({
              content: chatName,
              fg: WhatsAppTheme.white,
              attributes: TextAttributes.BOLD,
            }),
          ]),
      Text({})
    ),
    // Search/Menu icons (like WhatsApp Web)
    Box(
      {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 2,
        paddingRight: 2,
      },
      Text({
        content: Icons.search,
        fg: WhatsAppTheme.textSecondary,
      }),
      Text({
        content: Icons.menu,
        fg: WhatsAppTheme.textSecondary,
      })
    )
  )

  // Create or update the scroll box for messages
  if (!conversationScrollBox) {
    conversationScrollBox = new ScrollBoxRenderable(renderer, {
      id: "conversation-scroll-box",
      flexGrow: 1,
      rootOptions: {
        backgroundColor: WhatsAppTheme.deepDark,
      },
      viewportOptions: {
        backgroundColor: WhatsAppTheme.deepDark,
        padding: 1,
      },
      contentOptions: {
        backgroundColor: WhatsAppTheme.deepDark,
        flexDirection: "column",
        gap: 1,
      },
      scrollbarOptions: {
        trackOptions: {
          backgroundColor: WhatsAppTheme.receivedBubble,
          foregroundColor: WhatsAppTheme.borderColor,
        },
      },
      stickyScroll: true,
      stickyStart: "bottom", // Auto-scroll to new messages
    })
  }

  // Clear existing children and add messages
  const existingChildren = conversationScrollBox.getChildren()
  for (const child of existingChildren) {
    conversationScrollBox.remove(child.id)
  }

  // Add messages
  if (messages.length === 0) {
    const emptyText = new TextRenderable(renderer, {
      content: "No messages yet",
      fg: WhatsAppTheme.textSecondary,
    })
    conversationScrollBox.add(emptyText)
  } else {
    let lastDateLabel = ""
    let lastSenderId = ""
    let lastTimestamp = 0
    let lastFromMe: boolean | null = null

    for (const message of reversedMessages) {
      // Date Separator
      const dateLabel = formatDateSeparator(message.timestamp)
      if (dateLabel !== lastDateLabel) {
        conversationScrollBox.add(DaySeparator(renderer, dateLabel))
        lastDateLabel = dateLabel
        // Reset sender grouping on new day
        lastSenderId = ""
        lastTimestamp = 0
        lastFromMe = null
      }

      // Determine if this is the start of a new sequence of messages from the same user
      // Show tail if sender changed OR if more than 1.5 hours gap between messages
      // For fromMe messages, use fromMe flag directly to avoid ID comparison issues
      const { senderId } = getSenderInfo(message, isGroup, participantIds, state.currentChatId)
      const timeGap = message.timestamp - lastTimestamp

      // Compare using fromMe flag for reliability (avoids myProfile.id being undefined)
      // For group chats, also compare participant IDs
      const currentFromMe = message.fromMe === true
      const senderChanged = isGroup
        ? senderId !== lastSenderId // In groups, compare actual participant IDs
        : currentFromMe !== lastFromMe // In 1:1 chats, just compare fromMe flags

      const isSequenceStart = senderChanged || (lastTimestamp > 0 && timeGap > 60 * 60 * 1.5)

      conversationScrollBox.add(
        renderMessage(
          renderer,
          message,
          isGroup,
          isSequenceStart,
          participantIds,
          state.currentChatId
        )
      )

      // Update last sender, timestamp, and fromMe flag
      lastSenderId = senderId
      lastTimestamp = message.timestamp
      lastFromMe = currentFromMe
    }

    // Add a spacer at the bottom to prevent messages from being "crushed" by the input bar
    const spacer = new BoxRenderable(renderer, {
      height: 1,
      backgroundColor: WhatsAppTheme.deepDark,
    })
    conversationScrollBox.add(spacer)
  }

  // Message input field (bottom)
  // Initial and max height for input
  const MIN_INPUT_HEIGHT = 3
  const MAX_INPUT_LINES = 8

  // Initialize input container (Box that holds the textarea)
  if (!inputContainer) {
    inputContainer = new BoxRenderable(renderer, {
      id: "input-container",
      height: state.inputHeight, // Use state-driven height
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 1,
      paddingRight: 1,
      backgroundColor: WhatsAppTheme.panelLight,
      border: true,
      borderColor: WhatsAppTheme.borderLight,
      title: "Press 'i' to type",
    })
  }

  // Update container height from state on each render
  inputContainer.height = state.inputHeight
  inputContainer.title = state.inputMode ? "Type a message (Enter to send)" : "Press 'i' to type"
  inputContainer.borderColor = state.inputMode ? WhatsAppTheme.green : WhatsAppTheme.borderLight
  // Remove margin when reply preview is shown (it connects to reply bar)
  // inputContainer.marginTop = state.replyingToMessage ? 0 : 0

  // Initialize input component
  if (!messageInputComponent) {
    messageInputComponent = new TextareaRenderable(renderer, {
      id: "message-input",
      flexGrow: 1,
      height: "100%", // Fill the container
      backgroundColor: WhatsAppTheme.panelLight,
      textColor: WhatsAppTheme.textPrimary,
      focusedBackgroundColor: WhatsAppTheme.panelLight,
      focusedTextColor: WhatsAppTheme.textPrimary,
      placeholder: t`${fg(WhatsAppTheme.textSecondary)("Type a message...")}`,
      cursorColor: WhatsAppTheme.green,
      initialValue: state.messageInput,
      wrapMode: "word",
      // Override keybindings: Enter = submit, Shift+Enter or Ctrl+Enter = newline
      keyBindings: [
        { name: "return", shift: true, action: "newline" },
        { name: "return", ctrl: true, action: "newline" },
        { name: "return", action: "submit" },
        { name: "linefeed", shift: true, action: "newline" },
        { name: "linefeed", ctrl: true, action: "newline" },
        { name: "linefeed", action: "submit" },
      ],
    })

    // Event Handlers
    messageInputComponent.on(RenderableEvents.FOCUSED, () => {
      appState.setInputMode(true)
    })

    messageInputComponent.on(RenderableEvents.BLURRED, () => {
      appState.setInputMode(false)
    })

    // Auto-expand logic
    messageInputComponent.onContentChange = () => {
      if (messageInputComponent) {
        // Sync state
        appState.setMessageInput(messageInputComponent.plainText)

        // Handle typing indicator
        if (state.currentChatId && messageInputComponent.plainText.length > 0) {
          sendTypingState(state.currentChatId, "composing")

          if (typingTimeout) {
            clearTimeout(typingTimeout)
          }

          typingTimeout = setTimeout(() => {
            if (state.currentChatId) {
              sendTypingState(state.currentChatId, "paused")
            }
          }, 2000)
        }

        // Calculate needed height
        // Use lineCount (logical lines) instead of virtualLineCount
        // as virtualLineCount may not be updated until after layout
        const lineCount = Math.max(1, messageInputComponent.lineCount)

        // Calculate container height:
        // 2 (border) + lineCount
        const neededHeight = Math.min(lineCount + 2, MAX_INPUT_LINES + 2)

        debugLog(
          "[Input]",
          `lineCount=${lineCount}, neededHeight=${neededHeight}, currentHeight=${appState.getState().inputHeight}`
        )

        // Update state - this triggers a re-render with new height
        appState.setInputHeight(neededHeight)
      }
    }

    messageInputComponent.onSubmit = async () => {
      if (messageInputComponent) {
        const text = messageInputComponent.plainText.trim()
        // Get fresh state to get current replyingToMessage
        const currentState = appState.getState()
        if (text && currentState.currentChatId) {
          // Get reply message ID if replying
          const replyMsg = currentState.replyingToMessage as { id?: string } | null
          const replyToId = replyMsg?.id

          const success = await sendMessage(currentState.currentChatId, text, replyToId)
          if (success) {
            messageInputComponent.setText("")
            appState.setMessageInput("")
            // Reset height via state
            appState.setInputHeight(MIN_INPUT_HEIGHT)
          }
        }
      }
    }
  }

  // Ensure component value matches state if it was changed externally
  if (messageInputComponent.plainText !== state.messageInput && !messageInputComponent.focused) {
    messageInputComponent.setText(state.messageInput)
  }

  // Update scrollbar state from textarea
  const lineCount = messageInputComponent.lineCount
  const viewportSize = MAX_INPUT_LINES
  const needsScrollbar = lineCount > viewportSize

  // Dynamically manage scrollbar - add/remove based on need
  const children = inputContainer.getChildren()
  const hasTextarea = children.some((c) => c.id === "message-input")
  const hasScrollbar = children.some((c) => c.id === "input-scrollbar")

  // Add textarea if not present
  if (!hasTextarea) {
    inputContainer.add(messageInputComponent)
  }

  // Manage scrollbar visibility dynamically
  if (needsScrollbar) {
    // Create scrollbar if it doesn't exist
    if (!inputScrollBar) {
      inputScrollBar = new ScrollBarRenderable(renderer, {
        id: "input-scrollbar",
        orientation: "vertical",
        width: 1,
        height: "100%",
        flexShrink: 0,
        marginLeft: 1,
        showArrows: false,
        trackOptions: {
          foregroundColor: WhatsAppTheme.textSecondary,
          backgroundColor: WhatsAppTheme.panelLight,
        },
      })
    }
    // Add scrollbar if not already added
    if (!hasScrollbar && inputScrollBar) {
      inputContainer.add(inputScrollBar)
    }
    // Update scrollbar state
    inputScrollBar.scrollSize = lineCount
    inputScrollBar.viewportSize = viewportSize
    inputScrollBar.scrollPosition = messageInputComponent.scrollY
  } else {
    // Remove scrollbar if present and not needed
    if (hasScrollbar && inputScrollBar) {
      inputContainer.remove("input-scrollbar")
    }
  }

  // Reply preview bar (shown when replying to a message)
  let replyPreviewBar: BoxRenderable | null = null
  if (state.replyingToMessage) {
    const replyMsg = state.replyingToMessage as {
      body?: string
      from?: string
      fromMe?: boolean
      participant?: string
      _data?: {
        notifyName?: string
        pushName?: string
      }
    }
    const replyText = replyMsg.body || "[Media]"
    const isFromMe = replyMsg.fromMe === true

    // Extract sender name (same logic as renderMessage for consistency)
    let senderName = isFromMe ? "You" : "Unknown"
    let senderId = ""

    if (!isFromMe) {
      // For group messages, use participant field; otherwise use from
      if (replyMsg.participant) {
        senderId = replyMsg.participant
      } else if (replyMsg.from) {
        senderId = replyMsg.from
      }

      if (senderId) {
        // Priority 1: Check contacts cache (user-saved names)
        const cachedName = state.contactsCache.get(senderId)
        if (cachedName) {
          senderName = cachedName
        } else if (replyMsg._data?.notifyName) {
          // Priority 2: Use notifyName from message data
          senderName = replyMsg._data.notifyName
        } else if (replyMsg._data?.pushName) {
          // Priority 3: Use pushName from message data
          senderName = replyMsg._data.pushName
        } else {
          // Priority 4: Fallback to phone number
          const parts = senderId.split("@")
          senderName = parts[0]
        }
      }
    }

    // Get sender color for the bar (use senderId if available, otherwise fall back to from)
    const senderColor = isFromMe
      ? WhatsAppTheme.green
      : getSenderColor(
          senderId || replyMsg.from || "",
          participantIds,
          appState.getState().currentChatId || undefined
        )

    // Create reply preview bar imperatively for click handler
    replyPreviewBar = new BoxRenderable(renderer, {
      id: "reply-preview-bar",
      height: 4,
      flexDirection: "row",
      backgroundColor: WhatsAppTheme.panelDark,
      alignItems: "center",
      paddingLeft: 1,
    })

    // Colored left border bar (WhatsApp style)
    const colorBar = new BoxRenderable(renderer, {
      id: "reply-color-bar",
      width: 1,
      height: 2,
      backgroundColor: senderColor,
    })
    replyPreviewBar.add(colorBar)

    // Content container (sender + message)
    const contentBox = new BoxRenderable(renderer, {
      id: "reply-content",
      flexDirection: "column",
      flexGrow: 1,
      paddingLeft: 1,
    })

    // Sender name
    contentBox.add(
      new TextRenderable(renderer, {
        content: senderName,
        fg: senderColor,
        attributes: TextAttributes.BOLD,
      })
    )

    // Message preview (truncated)
    contentBox.add(
      new TextRenderable(renderer, {
        content: truncate(replyText, 60),
        fg: WhatsAppTheme.textSecondary,
      })
    )

    replyPreviewBar.add(contentBox)

    // Cancel button (✕)
    const cancelButton = new BoxRenderable(renderer, {
      id: "reply-cancel",
      width: 3,
      height: 2,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 2,
      onMouse(event) {
        if (event.type === "down" && event.button === 0) {
          appState.setReplyingToMessage(null)
          event.stopPropagation()
        }
      },
    })

    cancelButton.add(
      new TextRenderable(renderer, {
        content: "✕",
        fg: WhatsAppTheme.textSecondary,
      })
    )

    replyPreviewBar.add(cancelButton)
  }

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: WhatsAppTheme.deepDark,
    },
    header,
    conversationScrollBox,
    ...(replyPreviewBar ? [replyPreviewBar] : []),
    inputContainer
  )
}

// Reset the conversation scroll box (call when switching chats)
export function destroyConversationScrollBox(): void {
  if (conversationScrollBox) {
    conversationScrollBox.destroyRecursively()
    conversationScrollBox = null
    debugLog("ConversationView", "Conversation scroll box destroyed")
  }
  // Also destroy input to reset state/listeners
  if (messageInputComponent) {
    if (!messageInputComponent.isDestroyed) {
      messageInputComponent.destroy()
    }
    messageInputComponent = null
  }
}

// Scroll the conversation by a given amount (for keyboard navigation)
export function scrollConversation(delta: number): void {
  if (conversationScrollBox) {
    conversationScrollBox.scrollBy(delta)
  }
}
