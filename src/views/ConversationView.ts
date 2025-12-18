/**
 * Conversation View
 * Display messages for a selected chat
 */

import { Box, Text, TextAttributes } from "@opentui/core"
import { appState } from "../state/AppState"
import { WhatsAppTheme, Icons } from "../config/theme"
import { debugLog } from "../utils/debug"
import { getClient } from "../client"
import type { WAMessage } from "@muhammedaksam/waha-node"

export function ConversationView() {
  const state = appState.getState()

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

  // Messages viewport logic
  const MESSAGES_PER_PAGE = 8
  const reversedMessages = messages.slice().reverse()
  const maxScroll = Math.max(0, reversedMessages.length - MESSAGES_PER_PAGE)

  // Clamp scroll position to valid range
  const scrollPos = Math.max(0, Math.min(maxScroll, state.scrollPosition))

  // Get visible messages
  const visibleMessages = reversedMessages.slice(scrollPos, scrollPos + MESSAGES_PER_PAGE)

  // Scroll indicator for header
  const scrollInfo =
    reversedMessages.length > MESSAGES_PER_PAGE
      ? ` (${scrollPos + 1}-${Math.min(scrollPos + MESSAGES_PER_PAGE, reversedMessages.length)}/${reversedMessages.length})`
      : ""

  // Header with scroll indicator
  const header = Box(
    {
      height: 3,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelLight,
      border: true,
      borderColor: WhatsAppTheme.borderLight,
    },
    Text({
      content: `${chatName}${scrollInfo}`,
      fg: WhatsAppTheme.white,
      attributes: TextAttributes.BOLD,
    }),
    Text({
      content: `${Icons.call} ${Icons.video}`,
      fg: WhatsAppTheme.textSecondary,
    })
  )

  // Messages area - simplified rendering
  const messagesBox = Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      padding: 2,
      backgroundColor: WhatsAppTheme.deepDark,
    },
    ...(messages.length === 0
      ? [
          Text({
            content: "No messages yet",
            fg: WhatsAppTheme.textSecondary,
          }),
        ]
      : visibleMessages.map((message) => renderMessage(message, isGroupChat)))
  )

  // Message input field (bottom)
  const inputField = Box(
    {
      height: 3,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelLight,
      border: true,
      borderColor: state.inputMode ? WhatsAppTheme.green : WhatsAppTheme.borderLight,
    },
    Text({
      content: state.inputMode
        ? `${Icons.smile} ${state.messageInput}${state.isSending ? " (sending...)" : ""}`
        : "Press 'i' to type a message",
      fg: state.inputMode ? WhatsAppTheme.white : WhatsAppTheme.textSecondary,
    })
  )

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: WhatsAppTheme.deepDark,
    },
    header,
    messagesBox,
    inputField
  )
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
  // debugLog("SenderColor", `Getting color for sender ID: ${senderId}`)
  const colors = WhatsAppTheme.senderColors
  let hash = 0
  for (let i = 0; i < senderId.length; i++) {
    hash = (hash << 5) - hash + senderId.charCodeAt(i)
    hash = hash & hash
  }
  const color = colors[Math.abs(hash) % colors.length]
  debugLog(
    "SenderColor",
    `Assigned color ${color} to ${senderId} (hash: ${Math.abs(hash) % colors.length})`
  )
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

function renderMessage(message: WAMessageExtended, isGroupChat: boolean = false) {
  const isFromMe = message.fromMe
  const timestamp = new Date(message.timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  // Extract sender name for group chats (only for received messages)
  let senderName = ""
  let senderId = ""
  if (isGroupChat && !isFromMe && message.from) {
    debugLog(
      "MessageFields",
      `Full message: ${JSON.stringify({ from: message.from, participant: message.participant, _data: message._data?.notifyName || message._data?.pushName })}`
    )
    // Try to extract name from "from" field
    // Format is usually "number@c.us" or could have a name
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
  const timestampText = `${timestamp}${isFromMe ? ` ${getAckIcon(message.ack)}` : ""}`

  const bubbleContent = []
  let numRows = 0

  // Row 1: Sender name (only for group chat received messages)
  if (senderName) {
    bubbleContent.push(
      Box(
        {
          height: 1,
          flexDirection: "row",
          justifyContent: "flex-start",
        },
        Text({
          content: senderName,
          fg: getSenderColor(senderId),
          attributes: TextAttributes.BOLD,
        })
      )
    )
    numRows++
  }

  // Row 2: Message content
  bubbleContent.push(
    Box(
      {
        height: 1,
        flexDirection: "row",
        justifyContent: "flex-start",
      },
      Text({
        content: messageText,
        fg: WhatsAppTheme.textPrimary,
      })
    )
  )
  numRows++

  // Row 3: Timestamp (always on separate line)
  bubbleContent.push(
    Box(
      {
        height: 1,
        flexDirection: "row",
        justifyContent: "flex-end",
      },
      Text({
        content: timestampText,
        fg: isFromMe ? WhatsAppTheme.textSecondary : WhatsAppTheme.textTertiary,
      })
    )
  )
  numRows++

  // Calculate bubble height
  const bubbleHeight = numRows + 2 // +2 for top and bottom spacing

  return Box(
    {
      flexDirection: "row",
      justifyContent: isFromMe ? "flex-end" : "flex-start",
      marginBottom: 1,
    },
    Box(
      {
        height: bubbleHeight,
        maxWidth: "70%",
        minWidth: "15%",
        paddingLeft: 2,
        paddingRight: 2,
        backgroundColor: isFromMe ? WhatsAppTheme.greenDark : WhatsAppTheme.receivedBubble,
        border: true,
        borderColor: isFromMe ? WhatsAppTheme.green : WhatsAppTheme.borderColor,
        flexDirection: "column",
      },
      ...bubbleContent
    )
  )
}

function getAckIcon(ack: number): string {
  switch (ack) {
    case -1:
    case 0:
      return "○" // Pending
    case 1:
      return Icons.checkSingle // Sent
    case 2:
      return Icons.checkDouble // Delivered
    case 3:
    case 4:
      return `${Icons.checkDouble}` // Read
    default:
      return ""
  }
}

// Load messages from WAHA API
export async function loadMessages(sessionName: string, chatId: string): Promise<void> {
  try {
    debugLog("Messages", `Loading messages for chat: ${chatId}`)
    const client = getClient()
    const response = await client.chats.chatsControllerGetChatMessages(sessionName, chatId, {
      limit: 50,
      downloadMedia: false,
    })
    const messages = (response.data as unknown as WAMessage[]) || []
    debugLog("Messages", `Loaded ${messages.length} messages`)
    appState.setMessages(chatId, messages)

    // Initialize scroll position to bottom (latest messages)
    const MESSAGES_PER_PAGE = 8
    const maxScroll = Math.max(0, messages.length - MESSAGES_PER_PAGE)
    appState.setScrollPosition(maxScroll)
  } catch (error) {
    debugLog("Messages", `Failed to load messages: ${error}`)
    appState.setMessages(chatId, [])
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
