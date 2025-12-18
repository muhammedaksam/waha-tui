/**
 * Enhanced Chats View
 * WhatsApp-style chat list with search, filters, and styled rows
 */

import { Box, Text, TextAttributes } from "@opentui/core"
import { appState } from "../state/AppState"
import { WhatsAppTheme, Icons } from "../config/theme"
import { truncate } from "../utils/formatters"
import { debugLog } from "../utils/debug"
import { getClient } from "../client"
import type { ActiveFilter } from "../state/AppState"
import type { ChatSummary } from "@muhammedaksam/waha-node"

export function ChatsView() {
  const state = appState.getState()

  if (!state.currentSession) {
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
      backgroundColor: WhatsAppTheme.panelLight,
    },
    Text({
      content: "Chats",
      fg: WhatsAppTheme.white,
      attributes: TextAttributes.BOLD,
    }),
    Box(
      { flexDirection: "row", gap: 2 },
      Text({ content: Icons.newChat, fg: WhatsAppTheme.textSecondary }),
      Text({ content: Icons.menu, fg: WhatsAppTheme.textSecondary })
    )
  )

  // Search Bar
  const searchBar = Box(
    {
      height: 3,
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 1,
      paddingBottom: 1,
      backgroundColor: WhatsAppTheme.panelDark,
    },
    Box(
      {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: WhatsAppTheme.inputBg,
        paddingLeft: 2,
        paddingRight: 2,
        border: true,
        borderColor: WhatsAppTheme.borderColor,
      },
      Text({
        content: state.searchQuery || `${Icons.search} Search or start new chat`,
        fg: state.searchQuery ? WhatsAppTheme.textPrimary : WhatsAppTheme.textTertiary,
      })
    )
  )

  // Filter Pills
  const filters: ActiveFilter[] = ["all", "unread", "favorites", "groups"]
  const filterPills = Box(
    {
      height: 2,
      flexDirection: "row",
      gap: 1,
      paddingLeft: 2,
      paddingTop: 1,
      backgroundColor: WhatsAppTheme.panelDark,
    },
    ...filters.map((filter) => {
      const isActive = state.activeFilter === filter
      const label = filter.charAt(0).toUpperCase() + filter.slice(1)

      return Box(
        {
          paddingLeft: 2,
          paddingRight: 2,
          backgroundColor: isActive ? WhatsAppTheme.green : WhatsAppTheme.inputBg,
          border: true,
          borderColor: isActive ? WhatsAppTheme.green : WhatsAppTheme.borderLight,
        },
        Text({
          content: label,
          fg: isActive ? WhatsAppTheme.white : WhatsAppTheme.textSecondary,
          attributes: isActive ? TextAttributes.BOLD : TextAttributes.NONE,
        })
      )
    })
  )

  // Chat Rows
  const chatRows =
    state.chats.length === 0
      ? [
          Box(
            {
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
            },
            Text({
              content: "No chats yet",
              fg: WhatsAppTheme.textSecondary,
            })
          ),
        ]
      : state.chats.map((chat, index) => {
          const isCurrentChat = state.currentChatId === chat.id
          const isSelected = index === state.selectedChatIndex
          const lastMessage = "No messages" // Placeholder since ChatSummary.lastMessage is object
          const timestamp = "" // Placeholder

          return Box(
            {
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
            },
            // Avatar (circle with first letter or icon)
            Box(
              {
                width: 3,
                height: 3,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: WhatsAppTheme.green,
                marginRight: 2,
              },
              Text({
                content: chat.name ? chat.name.charAt(0).toUpperCase() : Icons.online,
                fg: WhatsAppTheme.white,
                attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
              })
            ),
            // Chat info
            Box(
              {
                flexDirection: "column",
                flexGrow: 1,
              },
              // Name and timestamp row
              Box(
                {
                  flexDirection: "row",
                  justifyContent: "space-between",
                },
                Text({
                  content: truncate(chat.name || chat.id, 25),
                  fg: WhatsAppTheme.white,
                  attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
                }),
                Text({
                  content: timestamp,
                  fg: WhatsAppTheme.textTertiary,
                })
              ),
              // Last message and receipt
              Box(
                {
                  flexDirection: "row",
                  justifyContent: "space-between",
                },
                Text({
                  content: truncate(lastMessage, 30),
                  fg: WhatsAppTheme.textSecondary,
                }),
                Text({
                  content: Icons.checkDouble,
                  fg: WhatsAppTheme.blue,
                })
              )
            )
          )
        })

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: WhatsAppTheme.panelDark,
    },
    header,
    searchBar,
    filterPills,
    // Chat list (scrollable content)
    Box(
      {
        flexDirection: "column",
        flexGrow: 1,
        backgroundColor: WhatsAppTheme.panelDark,
      },
      ...chatRows
    )
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
