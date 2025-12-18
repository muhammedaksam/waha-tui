/**
 * Enhanced Chats View
 * WhatsApp-style chat list with search, filters, and styled rows
 */

import {
  Box,
  Text,
  TextAttributes,
  BoxRenderable,
  TextRenderable,
  ScrollBoxRenderable,
} from "@opentui/core"
import { appState } from "../state/AppState"
import { getRenderer } from "../state/RendererContext"
import { WhatsAppTheme, Icons } from "../config/theme"
import { truncate, extractMessagePreview } from "../utils/formatters"
import { debugLog } from "../utils/debug"
import { getClient } from "../client"
import { loadMessages, loadContacts } from "./ConversationView"
import type { ActiveFilter } from "../state/AppState"
import type { ChatSummary } from "@muhammedaksam/waha-node"

export function ChatsView() {
  const state = appState.getState()
  const renderer = getRenderer()

  debugLog(
    "ChatsView",
    `Rendering ChatsView - selectedChatIndex: ${state.selectedChatIndex}, chats: ${state.chats.length}`
  )

  if (!state.currentSession) {
    debugLog("ChatsView", "No current session, showing placeholder")
    return Box(
      {
        flexDirection: "column",
        flexGrow: 1,
        padding: 2,
        justifyContent: "center",
        alignItems: "center",
      },
      Text({
        content: "No session selected",
        fg: WhatsAppTheme.textSecondary,
      })
    )
  }

  // Header Section
  const header = Box(
    {
      height: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelDark,
    },
    Text({
      content: "WhatsApp",
      fg: WhatsAppTheme.textPrimary,
      attributes: TextAttributes.BOLD,
    }),
    Box(
      { flexDirection: "row", gap: 1 },
      Text({ content: Icons.newChat, fg: WhatsAppTheme.textSecondary }),
      Text({ content: Icons.menu, fg: WhatsAppTheme.textSecondary })
    )
  )

  // Search Bar
  const searchBar = Box(
    {
      height: 5,
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 1,
      paddingBottom: 1,
      backgroundColor: WhatsAppTheme.panelDark,
    },
    Box(
      {
        height: 3,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: WhatsAppTheme.inputBg,
        paddingLeft: 2,
        paddingRight: 2,
        flexGrow: 1,
        border: true,
        borderStyle: "rounded",
        borderColor: WhatsAppTheme.borderColor,
      },
      Text({
        content: state.searchQuery || `${Icons.search} Search or start a new chat`,
        fg: state.searchQuery ? WhatsAppTheme.textPrimary : WhatsAppTheme.textTertiary,
      })
    )
  )

  // Filter Pills
  const filters: ActiveFilter[] = ["all", "unread", "favorites", "groups"]
  const filterPills = Box(
    {
      height: 3,
      flexDirection: "row",
      gap: 1,
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 1,
      paddingBottom: 1,
      backgroundColor: WhatsAppTheme.panelDark,
      alignItems: "center",
    },
    ...filters.map((filter) => {
      const isActive = state.activeFilter === filter
      const label = filter.charAt(0).toUpperCase() + filter.slice(1)

      return Box(
        {
          width: "auto",
          height: 3,
          paddingLeft: 2,
          paddingRight: 2,
          backgroundColor: isActive ? WhatsAppTheme.green : WhatsAppTheme.receivedBubble,
          // borderStyle: isActive ? "rounded" : undefined,
          // borderColor: isActive ? WhatsAppTheme.green : WhatsAppTheme.inputBg,
          alignItems: "center",
          justifyContent: "center",
        },
        Text({
          content: label,
          fg: isActive ? WhatsAppTheme.white : WhatsAppTheme.textSecondary,
        })
      )
    })
  )

  // Archived Section
  const archivedSection = Box(
    {
      height: 3,
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 1,
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelDark,
      gap: 2,
    },
    Text({
      content: "📦",
      fg: WhatsAppTheme.textSecondary,
    }),
    Text({
      content: "Archived",
      fg: WhatsAppTheme.textPrimary,
    })
  )

  // Chat Rows - build as renderables for ScrollBox
  const chatRowsRenderables: BoxRenderable[] = []

  debugLog(
    "ChatsView",
    `Building ${state.chats.length} chat rows, selectedIndex: ${state.selectedChatIndex}`
  )

  if (state.chats.length === 0) {
    debugLog("ChatsView", "No chats found, showing empty state")
    const emptyBox = new BoxRenderable(renderer, {
      id: "empty-chats",
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
    })
    emptyBox.add(
      new TextRenderable(renderer, {
        content: "No chats yet",
        fg: WhatsAppTheme.textSecondary,
      })
    )
    chatRowsRenderables.push(emptyBox)
  } else {
    for (let index = 0; index < state.chats.length; index++) {
      const chat = state.chats[index]
      const isCurrentChat = state.currentChatId === chat.id
      const isSelected = index === state.selectedChatIndex

      // Extract message preview from lastMessage object
      const preview = extractMessagePreview(chat.lastMessage)

      // Format last message text with sender prefix for group chats
      const isGroupChat = typeof chat.id === "string" ? chat.id.endsWith("@g.us") : false
      let lastMessageText = preview.text

      if (isGroupChat && preview.text !== "No messages") {
        if (preview.isFromMe) {
          lastMessageText = `You: ${preview.text}`
        }
      }

      // Create chat row box
      debugLog(
        "ChatsView",
        `Creating chat row ${index}: ${chat.name || chat.id}, isSelected: ${isSelected}`
      )
      const chatRow = new BoxRenderable(renderer, {
        id: `chat-row-${index}`,
        height: 4,
        flexDirection: "row",
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
        backgroundColor: isSelected
          ? WhatsAppTheme.selectedBg
          : isCurrentChat
            ? WhatsAppTheme.activeBg
            : WhatsAppTheme.panelDark,
        border: isCurrentChat,
        borderColor: isCurrentChat ? WhatsAppTheme.green : undefined,
      })

      // Handle focus events to update selection
      chatRow.on("focus", () => {
        debugLog("ChatsView", `Chat row ${index} focused`)
        appState.setSelectedChatIndex(index)
      })

      // Handle click to open chat
      chatRow.on("click", async () => {
        debugLog("ChatsView", `Chat row ${index} clicked`)
        appState.setSelectedChatIndex(index)
        const selectedChat = state.chats[index]
        if (selectedChat && state.currentSession) {
          debugLog("App", `Selected chat: ${selectedChat.name || selectedChat.id}`)
          appState.setCurrentView("conversation")
          appState.setCurrentChat(selectedChat.id)
          await loadMessages(state.currentSession, selectedChat.id)
          await loadContacts(state.currentSession)
        }
      })

      // Avatar
      const avatar = new BoxRenderable(renderer, {
        id: `avatar-${index}`,
        width: 3,
        height: 3,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: WhatsAppTheme.green,
        marginRight: 2,
      })
      avatar.add(
        new TextRenderable(renderer, {
          content: chat.name ? chat.name.charAt(0).toUpperCase() : Icons.online,
          fg: WhatsAppTheme.white,
          attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
        })
      )
      chatRow.add(avatar)

      // Chat info container
      const chatInfo = new BoxRenderable(renderer, {
        id: `chat-info-${index}`,
        flexDirection: "column",
        flexGrow: 1,
      })

      // Name and timestamp row
      const nameRow = new BoxRenderable(renderer, {
        id: `name-row-${index}`,
        flexDirection: "row",
        justifyContent: "space-between",
      })
      nameRow.add(
        new TextRenderable(renderer, {
          content: truncate(chat.name || chat.id, 25),
          fg: WhatsAppTheme.white,
          attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
        })
      )
      nameRow.add(
        new TextRenderable(renderer, {
          content: preview.timestamp,
          fg: WhatsAppTheme.textTertiary,
        })
      )
      chatInfo.add(nameRow)

      // Last message row
      const messageRow = new BoxRenderable(renderer, {
        id: `message-row-${index}`,
        flexDirection: "row",
        justifyContent: "space-between",
      })
      messageRow.add(
        new TextRenderable(renderer, {
          content: truncate(lastMessageText, 30),
          fg: WhatsAppTheme.textSecondary,
        })
      )
      messageRow.add(
        new TextRenderable(renderer, {
          content: preview.isFromMe ? Icons.checkDouble : "",
          fg: WhatsAppTheme.blue,
        })
      )
      chatInfo.add(messageRow)

      chatRow.add(chatInfo)
      chatRowsRenderables.push(chatRow)
    }
  }

  // Create ScrollBox for chat list
  const chatScrollBox = new ScrollBoxRenderable(renderer, {
    id: "chats-scroll-box",
    flexGrow: 1,
    rootOptions: {
      backgroundColor: WhatsAppTheme.panelDark,
    },
    contentOptions: {
      backgroundColor: WhatsAppTheme.panelDark,
    },
    scrollbarOptions: {
      trackOptions: {
        backgroundColor: WhatsAppTheme.receivedBubble,
        foregroundColor: WhatsAppTheme.borderColor,
      },
    },
  })

  // Add chat rows to scroll box
  for (const chatRow of chatRowsRenderables) {
    chatScrollBox.add(chatRow)
  }

  // Scroll to selected item to keep it in view
  debugLog(
    "ChatsView",
    `Setting scroll position - selectedIndex: ${state.selectedChatIndex}, totalChats: ${chatRowsRenderables.length}`
  )

  // Defer scroll to next tick to allow layout to complete
  setTimeout(() => {
    if (state.selectedChatIndex > 0 && chatRowsRenderables.length > 0) {
      const rowHeight = 4 // Each chat row has height 4
      const viewportHeight = chatScrollBox.viewport.height
      const scrollHeight = chatScrollBox.scrollHeight
      const targetPosition = state.selectedChatIndex * rowHeight

      debugLog(
        "ChatsView",
        `[Deferred] Scrolling: targetPosition=${targetPosition}, scrollHeight=${scrollHeight}, viewportHeight=${viewportHeight}`
      )

      // Ensure selected item is visible within viewport
      const currentScroll = chatScrollBox.scrollTop
      const itemTop = targetPosition
      const itemBottom = targetPosition + rowHeight

      let newScrollPosition = currentScroll

      // If item is above viewport, scroll up to show it at top
      if (itemTop < currentScroll) {
        newScrollPosition = itemTop
      }
      // If item is below viewport, scroll down to show it at bottom
      else if (itemBottom > currentScroll + viewportHeight) {
        newScrollPosition = itemBottom - viewportHeight
      }

      debugLog(
        "ChatsView",
        `[Deferred] Scroll calculation: itemTop=${itemTop}, itemBottom=${itemBottom}, currentScroll=${currentScroll}, newScroll=${newScrollPosition}`
      )

      if (newScrollPosition !== currentScroll) {
        chatScrollBox.scrollTo(newScrollPosition)

        debugLog("ChatsView", `[Deferred] After scroll: scrollPosition=${chatScrollBox.scrollTop}`)
      }
    } else {
      debugLog(
        "ChatsView",
        `[Deferred] Not scrolling - selectedIndex: ${state.selectedChatIndex}, rowCount: ${chatRowsRenderables.length}`
      )
    }
  }, 0)

  // Focus the scroll box to enable keyboard scrolling
  debugLog("ChatsView", "Focusing scroll box")
  chatScrollBox.focus()

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: WhatsAppTheme.panelDark,
    },
    header,
    searchBar,
    filterPills,
    archivedSection,
    // Chat list (scrollable content)
    chatScrollBox
  )
}

// Load chats from WAHA API
export async function loadChats(sessionName: string): Promise<void> {
  try {
    debugLog("Chats", `Loading chats for session: ${sessionName}`)
    const client = getClient()
    const response = await client.chats.chatsControllerGetChats(sessionName, {})
    const chats = (response.data as unknown as ChatSummary[]) || []
    debugLog("Chats", `Loaded ${chats.length} chats`)
    appState.setChats(chats)
  } catch (error) {
    debugLog("Chats", `Failed to load chats: ${error}`)
    appState.setChats([])
  }
}
