/**
 * Enhanced Chats View
 * WhatsApp-style chat list with search, filters, and styled rows
 */

import { Box, Text, BoxRenderable, TextRenderable } from "@opentui/core"
import { InputRenderable, InputRenderableEvents } from "@opentui/core"
import { appState } from "../state/AppState"
import { getRenderer } from "../state/RendererContext"
import { WhatsAppTheme, Icons } from "../config/theme"
import { debugLog } from "../utils/debug"
import { getClient } from "../client"
import type { ActiveFilter } from "../state/AppState"
import type { ChatSummary } from "@muhammedaksam/waha-node"
import { chatListManager } from "./ChatListManager"
import { Logo } from "../components/Logo"
import { filterChats, countUnreadInArchived } from "../utils/filterChats"

// Module-level search input component for focus management
let searchInputComponent: InputRenderable | null = null

//Export functions for search input control
export function focusSearchInput(): void {
  if (searchInputComponent) {
    searchInputComponent.focus()
    appState.setInputMode(true)
  }
}

export function blurSearchInput(): void {
  if (searchInputComponent) {
    searchInputComponent.blur()
    appState.setInputMode(false)
  }
}

export function clearSearchInput(): void {
  if (searchInputComponent) {
    searchInputComponent.value = ""
    appState.setSearchQuery("")
    blurSearchInput()
  }
}

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

  // Search Bar - using InputRenderable for interactive search
  const searchBarContainer = Box(
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
        paddingLeft: 1,
        paddingRight: 2,
        flexGrow: 1,
        border: true,
        borderStyle: "rounded",
        borderColor: WhatsAppTheme.borderColor,
      },
      // Search icon
      Text({
        content: Icons.search + " ",
        fg: WhatsAppTheme.textTertiary,
      }),
      // Create or reuse search input
      (() => {
        // Create new search input if it doesn't exist
        if (!searchInputComponent) {
          searchInputComponent = new InputRenderable(renderer, {
            id: "chat-search-input",
            width: "auto",
            height: 1,
            placeholder: "Search or start a new chat",
            backgroundColor: WhatsAppTheme.inputBg,
            focusedBackgroundColor: WhatsAppTheme.inputBg,
            textColor: WhatsAppTheme.textPrimary,
            focusedTextColor: WhatsAppTheme.white,
            placeholderColor: WhatsAppTheme.textTertiary,
            cursorColor: WhatsAppTheme.white,
            maxLength: 100,
            flexGrow: 1,
          })

          // Listen for input changes and update state
          searchInputComponent.on(InputRenderableEvents.INPUT, (value: string) => {
            appState.setSearchQuery(value)
          })
        }

        // Update value from state in case it changed
        searchInputComponent.value = state.searchQuery

        return searchInputComponent
      })()
    )
  )

  // Filter Pills - using imperative API for click handlers
  const filters: ActiveFilter[] = ["all", "unread", "favorites", "groups"]
  const filterPillsContainer = new BoxRenderable(renderer, {
    id: "filter-pills",
    height: 3,
    flexDirection: "row",
    gap: 1,
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 1,
    paddingBottom: 1,
    backgroundColor: WhatsAppTheme.panelDark,
    alignItems: "center",
  })

  for (const filter of filters) {
    const isActive = state.activeFilter === filter
    const label = filter.charAt(0).toUpperCase() + filter.slice(1)

    const pill = new BoxRenderable(renderer, {
      id: `filter-pill-${filter}`,
      width: "auto",
      height: 3,
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: isActive ? WhatsAppTheme.green : WhatsAppTheme.receivedBubble,
      alignItems: "center",
      justifyContent: "center",
      onMouse(event) {
        if (event.type === "down") {
          debugLog("ChatsView", `Filter clicked: ${filter}`)
          appState.setActiveFilter(filter)
          event.stopPropagation()
        }
      },
    })

    pill.add(
      new TextRenderable(renderer, {
        content: label,
        fg: isActive ? WhatsAppTheme.white : WhatsAppTheme.textSecondary,
      })
    )

    filterPillsContainer.add(pill)
  }

  // Archived Section with unread count
  const archivedUnreadCount = countUnreadInArchived(state.chats)
  const archivedSection = Box(
    {
      height: 3,
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 1,
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelDark,
    },
    Text({
      content: "📦",
      fg: WhatsAppTheme.textSecondary,
    }),
    Text({
      content: "  Archived",
      fg: WhatsAppTheme.textPrimary,
    }),
    // Spacer to push count to the right
    Box({ flexGrow: 1 }),
    archivedUnreadCount > 0
      ? Text({
          content: archivedUnreadCount.toString(),
          fg: WhatsAppTheme.textSecondary,
        })
      : Text({ content: "" })
  )

  // Filter chats based on active filter and search query
  const filteredChats = filterChats(state.chats, state.activeFilter, state.searchQuery)

  // Handle empty state (after filtering)
  if (filteredChats.length === 0) {
    const emptyMessage =
      state.chats.length === 0
        ? "No chats yet"
        : state.searchQuery
          ? `No chats matching "${state.searchQuery}"`
          : `No ${state.activeFilter} chats`

    debugLog("ChatsView", `No chats to display: ${emptyMessage}`)
    const emptyBox = new BoxRenderable(renderer, {
      id: "empty-chats",
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
    })
    emptyBox.add(
      new TextRenderable(renderer, {
        content: emptyMessage,
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
      searchBarContainer,
      filterPillsContainer,
      archivedSection,
      emptyBox
    )
  }

  // Use ChatListManager for optimized rendering with filtered chats
  const chatScrollBox = chatListManager.buildChatList(renderer, filteredChats)

  debugLog(
    "ChatsView",
    `Displaying ${filteredChats.length} chats (filter: ${state.activeFilter}, search: "${state.searchQuery}")`
  )

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: WhatsAppTheme.panelDark,
    },
    header,
    searchBarContainer,
    filterPillsContainer,
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
