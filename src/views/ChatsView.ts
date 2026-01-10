/**
 * Enhanced Chats View
 * WhatsApp-style chat list with search, filters, and styled rows
 */

import type { ChatSummary } from "@muhammedaksam/waha-node"

import {
  Box,
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  ProxiedVNode,
  Text,
  TextRenderable,
} from "@opentui/core"

import type { ActiveFilter } from "~/state/AppState"
import { Logo } from "~/components/Logo"
import { Icons, WhatsAppTheme } from "~/config/theme"
import { appState } from "~/state/AppState"
import { getRenderer } from "~/state/RendererContext"
import { startNewChat } from "~/utils/createChat"
import { debugLog } from "~/utils/debug"
import {
  flattenSearchResults,
  getSectionBoundaries,
  searchChatsWithSections,
} from "~/utils/enhancedSearch"
import { countUnreadInArchived, filterChats, isArchived } from "~/utils/filterChats"
import { looksLikePhoneNumber, validateWhatsAppNumber } from "~/utils/phoneValidation"
import { chatListManager } from "~/views/ChatListManager"

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

  // debugLog(
  //   "ChatsView",
  //   `Rendering ChatsView - selectedChatIndex: ${state.selectedChatIndex}, chats: ${state.chats.length}`
  // )

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

  // Handle click on Archived section
  archivedSection.on("click", () => {
    appState.setShowingArchivedChats(true)
  })

  // Start New Chat Action Section
  let startNewChatSection: ProxiedVNode<typeof BoxRenderable> | null = null

  // Check if search query looks like a phone number
  if (looksLikePhoneNumber(state.searchQuery)) {
    startNewChatSection = Box(
      {
        height: 3,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 2,
        paddingRight: 2,
        backgroundColor: WhatsAppTheme.panelLight,
        marginBottom: 1,
      },
      Text({
        content: Icons.newChat + " ",
        fg: WhatsAppTheme.green,
      }),
      Text({
        content: `Start new chat with ${state.searchQuery}`,
        fg: WhatsAppTheme.textPrimary,
      })
    )

    // Handle click to validate and start chat
    startNewChatSection.on("click", async () => {
      if (!state.currentSession) return

      debugLog("ChatsView", `Validating number: ${state.searchQuery}`)
      // Visual feedback could be added here (e.g. changing text to "Checking...")

      const chatId = await validateWhatsAppNumber(state.searchQuery, state.currentSession)

      if (chatId) {
        debugLog("ChatsView", `Number valid! Starting chat: ${chatId}`)
        // Add to contacts cache so it shows up correctly
        const contacts = appState.getState().allContacts
        // If name unknown, use formatted number
        if (!contacts.has(chatId)) {
          // No saved contact name, using ID
        }

        await startNewChat(chatId)

        // Clear search after starting
        appState.setSearchQuery("")
      } else {
        // Show error
        debugLog("ChatsView", `Invalid WhatsApp number: ${state.searchQuery}`)
      }
    })
  }

  // Filter chats based on active filter and search query
  let filteredChats: ChatSummary[]

  if (state.showingArchivedChats) {
    // Show ONLY archived chats
    filteredChats = state.chats.filter((chat) => isArchived(chat))

    // Override header for Archived view
    const backButton = Box(
      {
        height: 3,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 2,
        backgroundColor: WhatsAppTheme.panelLight,
      },
      Text({
        content: "←",
        fg: WhatsAppTheme.green,
      }),
      Text({
        content: " Archived",
        fg: WhatsAppTheme.textPrimary,
      })
    )

    backButton.on("click", () => {
      appState.setShowingArchivedChats(false)
    })

    return Box(
      {
        flexDirection: "column",
        flexGrow: 1,
        backgroundColor: WhatsAppTheme.panelDark,
      },
      backButton,
      // Reuse chat list manager for archived chats
      chatListManager.buildChatList(renderer, filteredChats)
    )
  }

  // Use enhanced sectioned search when search query is active
  if (state.searchQuery.trim()) {
    const sectionedResults = searchChatsWithSections(
      state.chats,
      state.searchQuery,
      state.allContacts // Use full phonebook contacts for search
    )
    // Flatten results (Chats -> Contacts -> Messages order)
    filteredChats = flattenSearchResults(sectionedResults)

    const boundaries = getSectionBoundaries(sectionedResults)
    debugLog(
      "ChatsView",
      `Search results: ${boundaries.chats.count} chats, ${boundaries.contacts.count} contacts, ${boundaries.messages.count} messages`
    )
  } else {
    // Use regular filter logic when no search
    filteredChats = filterChats(state.chats, state.activeFilter, state.searchQuery)
  }

  // Handle empty state logic
  let emptyBox: BoxRenderable | null = null

  if (filteredChats.length === 0) {
    const emptyMessage =
      state.chats.length === 0
        ? "No chats yet"
        : state.searchQuery
          ? `No chats matching "${state.searchQuery}"`
          : `No ${state.activeFilter} chats`

    debugLog("ChatsView", `No chats to display: ${emptyMessage}`)
    emptyBox = new BoxRenderable(renderer, {
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
  }

  // Assemble view components
  const components: (BoxRenderable | ProxiedVNode<typeof BoxRenderable>)[] = [
    header,
    searchBarContainer,
    filterPillsContainer,
  ]

  // Only show archived section if NOT searching and NOT doing new chat action
  if (!state.searchQuery && !startNewChatSection) {
    components.push(archivedSection)
  }

  // Use ChatListManager for optimized rendering with filtered chats
  const chatScrollBox = chatListManager.buildChatList(renderer, filteredChats)

  // Show Start New Chat action if active
  if (startNewChatSection) {
    components.push(startNewChatSection)
  }

  // Chat list takes up remaining space
  // If empty, show empty box
  if (emptyBox) {
    components.push(emptyBox)
  } else {
    components.push(chatScrollBox)
  }

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: WhatsAppTheme.panelDark,
    },
    ...components
  )
}
