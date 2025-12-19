/**
 * Enhanced Chats View
 * WhatsApp-style chat list with search, filters, and styled rows
 */

import { Box, Text, BoxRenderable, TextRenderable } from "@opentui/core"
import { appState } from "../state/AppState"
import { getRenderer } from "../state/RendererContext"
import { WhatsAppTheme, Icons } from "../config/theme"
import { debugLog } from "../utils/debug"
import { getClient } from "../client"
import type { ActiveFilter } from "../state/AppState"
import type { ChatSummary } from "@muhammedaksam/waha-node"
import { chatListManager } from "./ChatListManager"
import { Logo } from "../components/Logo"

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
      height: 3,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelDark,
    },
    Logo({}),
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

  // Handle empty state
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
      emptyBox
    )
  }

  // Use ChatListManager for optimized rendering
  const chatScrollBox = chatListManager.buildChatList(renderer, state.chats)

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
