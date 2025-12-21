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
  CliRenderer,
  t,
  TextareaRenderable,
  RenderableEvents,
  fg,
  ScrollBarRenderable,
} from "@opentui/core"
import { ScrollBoxRenderable } from "@opentui/core"
import { appState } from "../state/AppState"
import type { WAMessageExtended } from "../types"
import { getRenderer } from "../state/RendererContext"
import { WhatsAppTheme, Icons } from "../config/theme"
import { debugLog } from "../utils/debug"
import { sendMessage, loadChatDetails, sendTypingState } from "../client"
import type { WAMessage } from "@muhammedaksam/waha-node"
import {
  formatAckStatus,
  formatLastSeen,
  truncate,
  getInitials,
  isGroupChat,
  isSelfChat,
} from "../utils/formatters"

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
  // Note: chat.id might be an object with _serialized, so we need to normalize for comparison
  const currentChat = state.chats.find((chat) => {
    const chatId =
      typeof chat.id === "string" ? chat.id : (chat.id as { _serialized: string })._serialized
    return chatId === state.currentChatId
  })
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
          return p.id.split("@")[0]
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
          return contactName || p.participant.split("@")[0]
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
      marginTop: 1,
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

// Hash function to assign consistent colors to senders (Round-Robin with fallback)
function getSenderColor(senderId: string, participants?: string[], chatId?: string): string {
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

// Simple string hash function
function stringHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash = hash & hash
  }
  return hash
}

// Render the quoted/reply context box above a reply message
function renderReplyContext(
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
  const myProfileId = appState.getState().myProfile?.id
  // Use isSelfChat for proper ID comparison (handles @c.us suffix differences)
  // In self-chats, ALL quoted messages are from "me" since it's a chat with yourself
  // Also use replyToFromMe flag from replyTo object (handles group chat quotes with @lid IDs)
  let isQuotedFromMe =
    replyToFromMe ||
    isSelfChatFlag ||
    (quotedSenderId !== "" && isSelfChat(quotedSenderId, myProfileId ?? null))

  // Always try to find the quoted message in cache - fromMe is the authoritative source
  if (replyTo.id) {
    const state = appState.getState()
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

// Helper to get sender info (ID, Name, Color)
function getSenderInfo(
  message: WAMessageExtended,
  isGroupChat: boolean,
  participants?: string[],
  chatId?: string
): { senderId: string; senderName: string; senderColor: string } {
  const isFromMe = message.fromMe
  let senderName = ""
  let senderId = ""

  if (isFromMe) {
    senderName = "You"
    senderId = appState.getState().myProfile?.id || "me"
  } else {
    senderId = message.from || ""
    if (isGroupChat && message.participant) {
      senderId = message.participant
    }

    // Determine name
    if (isGroupChat && message.from) {
      const fromParts = message.from.split("@")
      senderName = fromParts[0] // Fallback

      // Priority 1: Check contacts cache
      const cachedName = appState.getContactName(senderId)
      if (cachedName) {
        senderName = cachedName
      } else {
        // Priority 2: _data info
        const msgData = message._data
        if (msgData?.notifyName) {
          senderName = msgData.notifyName
        } else if (msgData?.pushName) {
          senderName = msgData.pushName
        } else {
          // Priority 3: Participant ID parts
          const participantParts = senderId.split("@")
          senderName = participantParts[0]
        }
      }
    } else {
      // 1:1 Chat sender name
      senderName = appState.getContactName(senderId) || senderId.split("@")[0]
    }
  }

  const senderColor = isFromMe
    ? WhatsAppTheme.green
    : getSenderColor(senderId, participants, chatId)

  return { senderId, senderName, senderColor }
}

function renderReactions(
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

function renderMessage(
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
  const messageText = message.body || "(media)"
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
    const currentChatId = appState.getState().currentChatId || ""
    const myId = appState.getState().myProfile?.id || null
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

  // Row 2: Message content + Timestamp on same line (WhatsApp style)
  const contentRow = new BoxRenderable(renderer, {
    id: `msg-${message.id || Date.now()}-content`,
    flexDirection: "row",
    alignItems: "flex-end", // Align timestamp to bottom of content
    justifyContent: "space-between", // Push timestamp to right edge of bubble
  })

  const contentText = new TextRenderable(renderer, {
    content: messageText,
    fg: WhatsAppTheme.textPrimary,
    flexGrow: 1, // Take available space, pushing timestamp right
  })
  contentRow.add(contentText)

  // Timestamp on same line, pushed to right
  const timeText = new TextRenderable(renderer, {
    content: timestampText, // Use directly - it's already a t`` template
    fg: isFromMe ? WhatsAppTheme.textSecondary : WhatsAppTheme.textTertiary,
    flexShrink: 0, // Don't shrink timestamp
    marginLeft: 1, // Space before timestamp
  })
  contentRow.add(timeText)

  bubble.add(contentRow)

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

// Helper to format date for separator
function formatDateSeparator(timestamp: number): string {
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

// Renderable for Day Separator

function DaySeparator(renderer: CliRenderer, label: string): BoxRenderable {
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

// Helper to center text in a fixed width
function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width)
  const paddingLeft = Math.floor((width - text.length) / 2)
  return text.padStart(text.length + paddingLeft).padEnd(width)
}
