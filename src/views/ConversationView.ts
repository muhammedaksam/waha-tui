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
import { getRenderer } from "../state/RendererContext"
import { WhatsAppTheme, Icons } from "../config/theme"
import { debugLog } from "../utils/debug"
import { getClient } from "../client"
import type { WAMessage, GroupParticipant, WAHAChatPresences } from "@muhammedaksam/waha-node"
import { formatAckStatus, formatLastSeen, truncate } from "../utils/formatters"

// Cache for conversation scroll box and input
let conversationScrollBox: ScrollBoxRenderable | null = null
let messageInputComponent: TextareaRenderable | null = null
let inputContainer: BoxRenderable | null = null
let inputScrollBar: ScrollBarRenderable | null = null

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

  // Determine if this is a group chat
  const isGroupChat = state.currentChatId.endsWith("@g.us")

  // Get current chat info
  // Note: chat.id might be an object with _serialized, so we need to normalize for comparison
  const currentChat = state.chats.find((chat) => {
    const chatId =
      typeof chat.id === "string" ? chat.id : (chat.id as { _serialized: string })._serialized
    return chatId === state.currentChatId
  })
  const chatName = currentChat?.name || state.currentChatId

  // Get messages for this chat
  const messages = state.messages.get(state.currentChatId) || []

  // Messages - newest at bottom (WhatsApp style)
  const reversedMessages = messages.slice().reverse()

  let headerSubtitle = ""

  if (isGroupChat) {
    // Group chat: show participants
    if (state.currentChatParticipants) {
      const names = state.currentChatParticipants
        .map((p: GroupParticipant) => {
          const contactName = appState.getContactName(p.id)
          if (contactName) return contactName
          const idParts = p.id.split("@")
          return idParts[0]
        })
        .join(", ")
      headerSubtitle = truncate(names, 60)
    } else {
      headerSubtitle = "tap for group info"
      // If no participants loaded yet, load them
      loadChatDetails(state.currentSession, state.currentChatId)
    }
  } else {
    // Direct chat: show presence
    const presence = state.currentChatPresence
    if (presence?.presences && presence.presences.length > 0) {
      const p = presence.presences[0]
      if (p.lastKnownPresence === "online" || p.lastKnownPresence === "typing") {
        headerSubtitle = p.lastKnownPresence
      } else if (p.lastSeen) {
        headerSubtitle = formatLastSeen(p.lastSeen)
      }
    } else {
      // Trigger load if not present (could also poll)
      // loadChatDetails checks cache internally or we can throttle
      loadChatDetails(state.currentSession, state.currentChatId)
    }
  }

  const header = Box(
    {
      height: headerSubtitle ? 4 : 3,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelLight,
      border: true,
      borderColor: WhatsAppTheme.borderLight,
    },
    Box(
      {
        flexDirection: "column",
        justifyContent: "center",
      },
      Text({
        content: chatName,
        fg: WhatsAppTheme.white,
        attributes: TextAttributes.BOLD,
      }),
      Text({
        content: headerSubtitle,
        fg: WhatsAppTheme.textSecondary,
      })
    ),
    Text({
      content: `${Icons.call} ${Icons.video}`,
      fg: WhatsAppTheme.textSecondary,
    })
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
    for (const message of reversedMessages) {
      const dateLabel = formatDateSeparator(message.timestamp)
      if (dateLabel !== lastDateLabel) {
        conversationScrollBox.add(DaySeparator(renderer, dateLabel))
        lastDateLabel = dateLabel
      }
      conversationScrollBox.add(renderMessage(renderer, message, isGroupChat))
    }
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
        if (text && state.currentSession && state.currentChatId) {
          const success = await sendMessage(state.currentSession, state.currentChatId, text)
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

  // Initialize scrollbar (only shown when content exceeds visible area)
  if (!inputScrollBar) {
    inputScrollBar = new ScrollBarRenderable(renderer, {
      id: "input-scrollbar",
      orientation: "vertical",
      width: 1,
      height: "100%",
      showArrows: false,
      trackOptions: {
        foregroundColor: WhatsAppTheme.textSecondary, // Thumb color
        backgroundColor: WhatsAppTheme.panelLight, // Track color
      },
    })
    // Start hidden - only show when content overflows
    inputScrollBar.visible = false
  }

  // Update scrollbar state from textarea
  const lineCount = messageInputComponent.lineCount
  const viewportSize = MAX_INPUT_LINES
  const needsScrollbar = lineCount > viewportSize

  if (inputScrollBar) {
    inputScrollBar.visible = needsScrollbar
    if (needsScrollbar) {
      inputScrollBar.scrollSize = lineCount
      inputScrollBar.viewportSize = viewportSize
      inputScrollBar.scrollPosition = messageInputComponent.scrollY
    }
  }

  // Clear children and add input + scrollbar (idempotent check)
  const children = inputContainer.getChildren()
  if (children.length === 0) {
    inputContainer.add(messageInputComponent)
    if (inputScrollBar) {
      inputContainer.add(inputScrollBar)
    }
  }

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: WhatsAppTheme.deepDark,
    },
    header,
    conversationScrollBox,
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

// Load contacts for the session and cache them
export async function loadContacts(sessionName: string): Promise<void> {
  try {
    // Only load once
    const state = appState.getState()
    if (state.contactsCache.size > 0) return

    debugLog("Contacts", `Loading contacts for session: ${sessionName}`)
    const client = getClient()
    const response = await client.contacts.contactsControllerGetAll({
      session: sessionName,
      limit: 1000,
    })

    const contacts = (response.data as unknown as Array<{ id?: string; name?: string }>) || []
    const contactsMap = new Map<string, string>()

    for (const contact of contacts) {
      if (contact.id && contact.name) {
        contactsMap.set(contact.id, contact.name)
      }
    }

    debugLog("Contacts", `Cached ${contactsMap.size} contacts`)
    appState.setContactsCache(contactsMap)
  } catch (error) {
    debugLog("Contacts", `Failed to load contacts: ${error}`)
  }
}

// Hash function to assign consistent colors to senders
function getSenderColor(senderId: string): string {
  const colors = WhatsAppTheme.senderColors
  let hash = 0
  for (let i = 0; i < senderId.length; i++) {
    hash = (hash << 5) - hash + senderId.charCodeAt(i)
    hash = hash & hash
  }
  const color = colors[Math.abs(hash) % colors.length]
  return color
}

// Extended message type to include runtime fields not in the core type
type WAMessageExtended = Omit<WAMessage, "participant" | "_data"> & {
  participant?: string
  _data?: {
    notifyName?: string
    pushName?: string
  }
}

function renderMessage(
  renderer: CliRenderer,
  message: WAMessageExtended,
  isGroupChat: boolean = false
): BoxRenderable {
  const isFromMe = message.fromMe
  const timestamp = new Date(message.timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  // Extract sender name for group chats (only for received messages)
  let senderName = ""
  let senderId = ""
  if (isGroupChat && !isFromMe && message.from) {
    const fromParts = message.from.split("@")
    senderName = fromParts[0] // Use phone number as fallback
    senderId = message.from

    // If message has participant field (for group messages), use that
    if (message.participant) {
      senderId = message.participant

      // Priority 1: Check contacts cache (user-saved names)
      const cachedName = appState.getContactName(senderId)
      if (cachedName) {
        senderName = cachedName
      } else {
        // Priority 2: Try to get display name from _data
        const msgData = message._data
        if (msgData?.notifyName) {
          senderName = msgData.notifyName
        } else if (msgData?.pushName) {
          senderName = msgData.pushName
        } else {
          // Priority 3: Fallback to participant ID
          const participantParts = senderId.split("@")
          senderName = participantParts[0]
        }
      }
    }
  }

  // Build message bubble content with WhatsApp-like layout
  const messageText = message.body || "(media)"
  const timestampText = t`${timestamp}${isFromMe ? formatAckStatus(message.ack) : ""}`

  // Create outer row container
  const row = new BoxRenderable(renderer, {
    id: `msg-${message.id || Date.now()}-row`,
    flexDirection: "row",
    justifyContent: isFromMe ? "flex-end" : "flex-start",
    marginBottom: 1,
  })

  // Create bubble container
  const bubble = new BoxRenderable(renderer, {
    id: `msg-${message.id || Date.now()}-bubble`,
    maxWidth: "70%",
    minWidth: "15%",
    paddingLeft: 2,
    paddingRight: 2,
    backgroundColor: isFromMe ? WhatsAppTheme.greenDark : WhatsAppTheme.receivedBubble,
    border: true,
    borderColor: isFromMe ? WhatsAppTheme.green : WhatsAppTheme.borderColor,
    flexDirection: "column",
  })

  // Row 1: Sender name (only for group chat received messages)
  if (senderName) {
    const senderRow = new BoxRenderable(renderer, {
      id: `msg-${message.id || Date.now()}-sender`,
      height: 1,
      flexDirection: "row",
      justifyContent: "flex-start",
    })
    const senderText = new TextRenderable(renderer, {
      content: senderName,
      fg: getSenderColor(senderId),
      attributes: TextAttributes.BOLD,
    })
    senderRow.add(senderText)
    bubble.add(senderRow)
  }

  // Row 2: Message content (dynamic height for multiline)
  const contentRow = new BoxRenderable(renderer, {
    id: `msg-${message.id || Date.now()}-content`,
    flexDirection: "row",
    justifyContent: "flex-start",
  })
  const contentText = new TextRenderable(renderer, {
    content: messageText,
    fg: WhatsAppTheme.textPrimary,
  })
  contentRow.add(contentText)
  bubble.add(contentRow)

  // Row 3: Timestamp & Status (Right aligned)
  const timeRow = new BoxRenderable(renderer, {
    id: `msg-${message.id || Date.now()}-time`,
    height: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  })

  const timeText = new TextRenderable(renderer, {
    content: timestampText,
    fg: isFromMe ? WhatsAppTheme.textSecondary : WhatsAppTheme.textTertiary,
  })
  timeRow.add(timeText)

  bubble.add(timeRow)

  row.add(bubble)
  return row
}

// Load messages from WAHA API
export async function loadMessages(sessionName: string, chatId: string): Promise<void> {
  try {
    debugLog("Messages", `Loading messages for chat: ${chatId}`)
    const client = getClient()
    const response = await client.chats.chatsControllerGetChatMessages(sessionName, chatId, {
      limit: 50,
      downloadMedia: false,
      sortBy: "messageTimestamp",
      sortOrder: "desc",
    })
    const messages = (response.data as unknown as WAMessage[]) || []
    debugLog("Messages", `Loaded ${messages.length} messages`)
    appState.setMessages(chatId, messages)
  } catch (error) {
    debugLog("Messages", `Failed to load messages: ${error}`)
    appState.setMessages(chatId, [])
  }
}

// Load chat details (presence or participants)
export async function loadChatDetails(sessionName: string, chatId: string): Promise<void> {
  const isGroup = chatId.endsWith("@g.us")
  const client = getClient()

  try {
    if (isGroup) {
      // Load participants
      debugLog("Conversation", `Loading participants for group: ${chatId}`)
      const response = await client.groups.groupsControllerGetGroupParticipants(sessionName, chatId)
      const participants = response.data as unknown as GroupParticipant[]
      appState.setCurrentChatParticipants(participants)
    } else {
      // Load presence
      debugLog("Conversation", `Loading presence for chat: ${chatId}`)
      const response = await client.presence.presenceControllerGetPresence(sessionName, chatId)
      const presence = response.data as unknown as WAHAChatPresences
      appState.setCurrentChatPresence(presence)
    }
  } catch (error) {
    debugLog("Conversation", `Failed to load chat details: ${error}`)
  }
}

// Track if we're currently loading more messages
let isLoadingMore = false

// Load older messages (for infinite scroll)
export async function loadOlderMessages(): Promise<void> {
  const state = appState.getState()
  if (!state.currentChatId || !state.currentSession || isLoadingMore) {
    return
  }

  const currentMessages = state.messages.get(state.currentChatId) || []
  if (currentMessages.length === 0) return

  isLoadingMore = true
  const offset = currentMessages.length
  debugLog("Messages", `Loading older messages with offset ${offset}`)

  try {
    const client = getClient()
    // Load more messages using offset for pagination
    const response = await client.chats.chatsControllerGetChatMessages(
      state.currentSession,
      state.currentChatId,
      {
        limit: 50,
        offset: offset,
        downloadMedia: false,
        sortBy: "messageTimestamp",
        sortOrder: "desc",
      }
    )

    const newMessages = (response.data as unknown as WAMessage[]) || []

    if (newMessages.length > 0) {
      debugLog("Messages", `Loaded ${newMessages.length} older messages`)
      // Append older messages to existing ones (maintaining Descending order)
      const combinedMessages = [...currentMessages, ...newMessages]
      appState.setMessages(state.currentChatId, combinedMessages)
    } else {
      debugLog("Messages", "No more older messages available")
    }
  } catch (error) {
    debugLog("Messages", `Failed to load older messages: ${error}`)
  } finally {
    isLoadingMore = false
  }
}

// Send a message via WAHA API
export async function sendMessage(
  sessionName: string,
  chatId: string,
  text: string
): Promise<boolean> {
  try {
    debugLog("Messages", `Sending message to ${chatId}: ${text}`)
    appState.setIsSending(true)

    const client = getClient()
    await client.chatting.chattingControllerSendText({
      session: sessionName,
      chatId,
      text,
    })

    debugLog("Messages", "Message sent successfully")
    // Reload messages to get the sent message with proper metadata
    await loadMessages(sessionName, chatId)
    appState.setIsSending(false)
    return true
  } catch (error) {
    debugLog("Messages", `Failed to send message: ${error}`)
    appState.setIsSending(false)
    return false
  }
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
