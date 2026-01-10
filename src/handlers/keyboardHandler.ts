/**
 * Keyboard Handler
 * Centralized keyboard input handling for the application
 */

import type { ChatSummary } from "@muhammedaksam/waha-node"
import type { KeyEvent } from "@opentui/core"

import type { AppState } from "../state/AppState"
import {
  deleteSession,
  fetchMyProfile,
  loadChats,
  loadContacts,
  loadMessages,
  loadOlderMessages,
  loadSessions,
  logoutSession,
  markActivity,
  startPresenceManagement,
  stopPresenceManagement,
} from "../client"
import { getSelectedMenuItem, handleContextMenuKey } from "../components/ContextMenu"
import { handleLogoutConfirm } from "../components/Modal"
import { saveSettings } from "../config/manager"
import { executeContextMenuAction } from "../handlers"
import { webSocketService } from "../services/WebSocketService"
import { appState } from "../state/AppState"
import { calculateChatListScrollOffset } from "../utils/chatListScroll"
import { debugLog } from "../utils/debug"
import { filterChats, isArchived } from "../utils/filterChats"
import { getChatIdString } from "../utils/formatters"
import { chatListManager } from "../views/ChatListManager"
import { blurSearchInput, clearSearchInput, focusSearchInput } from "../views/ChatsView"
import {
  blurMessageInput,
  destroyConversationScrollBox,
  focusMessageInput,
  scrollConversation,
} from "../views/ConversationView"
import {
  handlePhoneBackspace,
  handlePhoneInput,
  submitPhoneNumber,
  toggleAuthMode,
} from "../views/QRCodeView"
import { createNewSession } from "../views/SessionCreate"
import { getSettingsMenuItems } from "../views/SettingsView"

/**
 * Context for keyboard handler operations
 */
export interface KeyHandlerContext {
  renderApp: (forceRebuild?: boolean) => void
}

/**
 * Get the current list of filtered chats based on app state
 */
function getCurrentFilteredChats(state: AppState): ChatSummary[] {
  if (state.showingArchivedChats) {
    return state.chats.filter(isArchived)
  }
  return filterChats(state.chats, state.activeFilter, state.searchQuery)
}

/**
 * Handle context menu keyboard input
 * Returns true if the key was handled
 */
async function handleContextMenuKeys(
  key: KeyEvent,
  state: AppState,
  renderApp: (forceRebuild?: boolean) => void
): Promise<boolean> {
  if (!state.contextMenu?.visible) return false

  const handled = handleContextMenuKey(key.name)
  if (handled) {
    if (key.name === "return" || key.name === "enter") {
      const selectedItem = getSelectedMenuItem()
      if (selectedItem) {
        await executeContextMenuAction(selectedItem.id, state.contextMenu)
      }
    }
    renderApp(true)
    return true
  }
  return false
}

/**
 * Handle QR/Phone pairing view keyboard input
 * Returns true if the key was handled
 */
async function handleQRViewKeys(key: KeyEvent, state: AppState): Promise<boolean> {
  if (state.currentView !== "qr") return false

  // 'p' key - switch to phone pairing mode
  if (key.name === "p" && state.authMode === "qr") {
    debugLog("Auth", "Switching to phone pairing mode")
    toggleAuthMode()
    return true
  }

  // 'q' key handling in QR view
  if (key.name === "q" && !state.inputMode && !state.contextMenu?.visible) {
    if (state.authMode === "phone") {
      toggleAuthMode()
    } else {
      appState.setCurrentView("sessions")
    }
    return true
  }

  // Phone number input handling
  if (state.authMode === "phone") {
    if (/^[0-9]$/.test(key.name)) {
      handlePhoneInput(key.name)
      return true
    }
    if (key.name === "backspace") {
      handlePhoneBackspace()
      return true
    }
    if (key.name === "return" || key.name === "enter") {
      await submitPhoneNumber()
      return true
    }
    if (key.name === "escape") {
      toggleAuthMode()
      return true
    }
  }

  return false
}

/**
 * Handle sessions view keyboard input
 * Returns true if the key was handled
 */
async function handleSessionsViewKeys(key: KeyEvent, state: AppState): Promise<boolean> {
  if (state.currentView !== "sessions") return false

  // Arrow navigation
  if (key.name === "up" && state.sessions.length > 0) {
    const newIndex = Math.max(0, state.selectedSessionIndex - 1)
    debugLog("Keyboard", `Sessions: UP - moving from ${state.selectedSessionIndex} to ${newIndex}`)
    appState.setSelectedSessionIndex(newIndex)
    return true
  }

  if (key.name === "down" && state.sessions.length > 0) {
    const newIndex = Math.min(state.sessions.length - 1, state.selectedSessionIndex + 1)
    debugLog(
      "Keyboard",
      `Sessions: DOWN - moving from ${state.selectedSessionIndex} to ${newIndex}`
    )
    appState.setSelectedSessionIndex(newIndex)
    return true
  }

  // Enter key - select session
  if ((key.name === "return" || key.name === "enter") && state.sessions.length > 0) {
    const selectedSession = state.sessions[state.selectedSessionIndex]
    if (selectedSession) {
      debugLog("App", `Selected session: ${selectedSession.name}`)
      appState.setCurrentSession(selectedSession.name)
      appState.setCurrentView("chats")
      appState.setSelectedChatIndex(0)
      await fetchMyProfile()
      await loadChats()
      webSocketService.connect()
    }
    return true
  }

  // HOME key
  if (key.name === "home" && state.sessions.length > 0) {
    debugLog("Keyboard", `Sessions: HOME - jumping to first session`)
    appState.setSelectedSessionIndex(0)
    return true
  }

  // END key
  if (key.name === "end" && state.sessions.length > 0) {
    const lastIndex = state.sessions.length - 1
    debugLog("Keyboard", `Sessions: END - jumping to last session (${lastIndex})`)
    appState.setSelectedSessionIndex(lastIndex)
    return true
  }

  // 'n' key - create new session
  if (key.name === "n") {
    await createNewSession("default")
    await loadSessions()
    return true
  }

  // 'q' key - quit from sessions view
  if (key.name === "q" && !state.inputMode && !state.contextMenu?.visible) {
    await logoutSession()
    await deleteSession()
    return true
  }

  // 'r' key - refresh sessions
  if (key.name === "r" && !state.inputMode && !state.contextMenu?.visible) {
    await loadSessions()
    return true
  }

  return false
}

/**
 * Handle chats view keyboard input
 * Returns true if the key was handled
 */
async function handleChatsViewKeys(key: KeyEvent, state: AppState): Promise<boolean> {
  if (state.currentView !== "chats") return false

  const filteredChats = getCurrentFilteredChats(state)

  // Tab/Shift+Tab to cycle through filters
  if (key.name === "tab" && !state.inputMode) {
    const filters: Array<"all" | "unread" | "favorites" | "groups"> = [
      "all",
      "unread",
      "favorites",
      "groups",
    ]
    const currentIndex = filters.indexOf(state.activeFilter)

    if (key.shift) {
      const prevIndex = currentIndex === 0 ? filters.length - 1 : currentIndex - 1
      debugLog("Keyboard", `Filter: cycling backward to ${filters[prevIndex]}`)
      appState.setActiveFilter(filters[prevIndex])
    } else {
      const nextIndex = (currentIndex + 1) % filters.length
      debugLog("Keyboard", `Filter: cycling forward to ${filters[nextIndex]}`)
      appState.setActiveFilter(filters[nextIndex])
    }
    return true
  }

  // Forward slash (/) to focus search
  if (key.name === "/" && !state.inputMode) {
    debugLog("Keyboard", "Focusing search input")
    focusSearchInput()
    return true
  }

  // Ctrl+F to focus search
  if (key.name === "f" && key.ctrl && !state.inputMode) {
    debugLog("Keyboard", "Focusing search input (Ctrl+F)")
    focusSearchInput()
    return true
  }

  // 'c' key - open chat context menu
  if (key.name === "c" && !key.ctrl && !state.inputMode) {
    const selectedChat = filteredChats[state.selectedChatIndex]
    if (selectedChat) {
      const chatId = getChatIdString(selectedChat.id)
      appState.openContextMenu("chat", chatId, selectedChat)
      debugLog("ContextMenu", `Opened chat context menu for: ${chatId}`)
    }
    return true
  }

  // 's' key - open settings
  if (key.name === "s" && !state.inputMode) {
    appState.setCurrentView("settings")
    appState.setSettingsPage("main")
    appState.setSettingsSelectedIndex(0)
    appState.setLastChangeType("view")
    return true
  }

  // Arrow navigation
  if (key.name === "up" && state.chats.length > 0) {
    if (filteredChats.length === 0) return true
    const newIndex = Math.max(0, state.selectedChatIndex - 1)
    debugLog("Keyboard", `Chats: UP - moving from ${state.selectedChatIndex} to ${newIndex}`)
    const newScrollOffset = calculateChatListScrollOffset(
      newIndex,
      state.chatListScrollOffset,
      filteredChats.length
    )
    appState.setSelectedChatIndex(newIndex)
    appState.setChatListScrollOffset(newScrollOffset)
    appState.setLastChangeType("selection")
    return true
  }

  if (key.name === "down" && state.chats.length > 0) {
    if (filteredChats.length === 0) return true
    const newIndex = Math.min(filteredChats.length - 1, state.selectedChatIndex + 1)
    debugLog("Keyboard", `Chats: DOWN - from ${state.selectedChatIndex} to ${newIndex}`)
    const newScrollOffset = calculateChatListScrollOffset(
      newIndex,
      state.chatListScrollOffset,
      filteredChats.length
    )
    appState.setSelectedChatIndex(newIndex)
    appState.setChatListScrollOffset(newScrollOffset)
    appState.setLastChangeType("selection")
    return true
  }

  // Enter key - select chat
  if (key.name === "return" || key.name === "enter") {
    if (state.inputMode) {
      appState.setInputMode(false)
      blurSearchInput()
      return true
    }

    const selectedChat = filteredChats[state.selectedChatIndex]
    if (selectedChat && state.currentSession) {
      const chatId = getChatIdString(selectedChat.id)
      debugLog("App", `Selected chat: ${selectedChat.name || chatId}`)
      appState.setCurrentChat(chatId)
      destroyConversationScrollBox()
      loadContacts()
      await loadMessages(chatId)
      startPresenceManagement(chatId)
    }
    return true
  }

  // HOME key
  if (key.name === "home" && state.chats.length > 0) {
    debugLog("Keyboard", `Chats: HOME - jumping to first chat`)
    appState.setSelectedChatIndex(0)
    appState.setChatListScrollOffset(0)
    appState.setLastChangeType("selection")
    return true
  }

  // END key
  if (key.name === "end" && state.chats.length > 0) {
    if (filteredChats.length === 0) return true
    const lastIndex = filteredChats.length - 1
    debugLog("Keyboard", `Chats: END - jumping to last chat (${lastIndex})`)
    const newScrollOffset = calculateChatListScrollOffset(
      lastIndex,
      state.chatListScrollOffset,
      filteredChats.length
    )
    appState.setSelectedChatIndex(lastIndex)
    appState.setChatListScrollOffset(newScrollOffset)
    appState.setLastChangeType("selection")
    return true
  }

  // PAGE UP / Left arrow
  if (key.name === "pageup" || key.name === "left") {
    if (state.chats.length > 0 && filteredChats.length > 0) {
      const pageSize = 12
      const newIndex = Math.max(0, state.selectedChatIndex - pageSize)
      debugLog(
        "Keyboard",
        `Chats: ${key.name.toUpperCase()} - jumping from ${state.selectedChatIndex} to ${newIndex}`
      )
      const newScrollOffset = calculateChatListScrollOffset(
        newIndex,
        state.chatListScrollOffset,
        filteredChats.length
      )
      appState.setSelectedChatIndex(newIndex)
      appState.setChatListScrollOffset(newScrollOffset)
      appState.setLastChangeType("selection")
    }
    return true
  }

  // PAGE DOWN / Right arrow
  if (key.name === "pagedown" || key.name === "right") {
    if (state.chats.length > 0 && filteredChats.length > 0) {
      const pageSize = 12
      const newIndex = Math.min(filteredChats.length - 1, state.selectedChatIndex + pageSize)
      debugLog(
        "Keyboard",
        `Chats: ${key.name.toUpperCase()} - jumping from ${state.selectedChatIndex} to ${newIndex}`
      )
      const newScrollOffset = calculateChatListScrollOffset(
        newIndex,
        state.chatListScrollOffset,
        filteredChats.length
      )
      appState.setSelectedChatIndex(newIndex)
      appState.setChatListScrollOffset(newScrollOffset)
      appState.setLastChangeType("selection")
    }
    return true
  }

  // Escape key
  if (key.name === "escape") {
    if (state.inputMode) {
      blurSearchInput()
    } else if (state.showingArchivedChats) {
      appState.setShowingArchivedChats(false)
    } else if (state.searchQuery) {
      clearSearchInput()
    } else {
      appState.setCurrentView("sessions")
    }
    appState.setSelectedSessionIndex(0)
    return true
  }

  // Ctrl+A / Meta+A - Toggle Archived View
  if (key.name === "a" && (key.meta || key.ctrl)) {
    appState.setShowingArchivedChats(!state.showingArchivedChats)
    return true
  }

  // 'r' key - refresh chats
  if (key.name === "r" && !state.inputMode && !state.contextMenu?.visible && state.currentSession) {
    await loadChats()
    return true
  }

  return false
}

/**
 * Handle conversation view keyboard input
 * Returns true if the key was handled
 */
async function handleConversationViewKeys(key: KeyEvent, state: AppState): Promise<boolean> {
  if (state.currentView !== "conversation") return false

  // 'm' key - open message context menu
  if (key.name === "m" && !state.inputMode) {
    const messages = state.messages.get(state.currentChatId || "")
    if (messages && messages.length > 0) {
      const targetMessage = messages[messages.length - 1]
      const messageId = targetMessage.id
      appState.openContextMenu("message", messageId, targetMessage)
      debugLog("ContextMenu", `Opened message context menu for: ${messageId}`)
    }
    return true
  }

  // Arrow navigation (when not in input mode)
  if (key.name === "up" && !state.inputMode) {
    debugLog("Keyboard", "Conversation: UP - scrolling up")
    scrollConversation(-4)
    loadOlderMessages()
    return true
  }

  if (key.name === "down" && !state.inputMode) {
    debugLog("Keyboard", "Conversation: DOWN - scrolling down")
    scrollConversation(4)
    return true
  }

  // PAGE UP
  if ((key.name === "pageup" || key.name === "left") && !state.inputMode) {
    debugLog("Keyboard", "Conversation: PAGE UP - scrolling up")
    scrollConversation(-20)
    return true
  }

  // PAGE DOWN
  if ((key.name === "pagedown" || key.name === "right") && !state.inputMode) {
    debugLog("Keyboard", "Conversation: PAGE DOWN - scrolling down")
    scrollConversation(20)
    return true
  }

  // 'i' key - enter input mode
  if (key.name === "i" && !state.inputMode) {
    focusMessageInput()
    return true
  }

  // Escape key
  if (key.name === "escape") {
    if (state.inputMode) {
      blurMessageInput()
    } else {
      stopPresenceManagement()
      appState.setCurrentView("chats")
      appState.setCurrentChat(null)
    }
    return true
  }

  return false
}

/**
 * Handle settings view keyboard input
 * Returns true if the key was handled
 */
async function handleSettingsViewKeys(key: KeyEvent, state: AppState): Promise<boolean> {
  if (state.currentView !== "settings") return false

  // Main settings menu navigation
  if (state.settingsPage === "main") {
    const menuLength = getSettingsMenuItems().length

    if (key.name === "j" || key.name === "down") {
      const newIndex = Math.min(menuLength - 1, state.settingsSelectedIndex + 1)
      appState.setSettingsSelectedIndex(newIndex)
      return true
    }
    if (key.name === "k" || key.name === "up") {
      const newIndex = Math.max(0, state.settingsSelectedIndex - 1)
      appState.setSettingsSelectedIndex(newIndex)
      return true
    }

    if (key.name === "return" || key.name === "enter") {
      const items = getSettingsMenuItems()
      const selectedItem = items[state.settingsSelectedIndex]

      if (selectedItem === "logout") {
        debugLog("Settings", "Logout selected - showing confirmation")
        await handleLogoutConfirm()
      } else if (selectedItem) {
        appState.setSettingsPage(selectedItem)
        appState.setSettingsSubIndex(0)
      }
      return true
    }
  }

  // Settings sub-page navigation
  if (state.settingsPage !== "main") {
    const getMaxItems = (): number => {
      switch (state.settingsPage) {
        case "chats":
          return 1
        case "notifications":
          return 5
        case "notifications-messages":
        case "notifications-groups":
        case "notifications-status":
          return 3
        default:
          return 0
      }
    }
    const maxItems = getMaxItems()

    if (key.name === "j" || key.name === "down") {
      if (maxItems > 0) {
        const newIndex = Math.min(maxItems - 1, state.settingsSubIndex + 1)
        appState.setSettingsSubIndex(newIndex)
      }
      return true
    }
    if (key.name === "k" || key.name === "up") {
      if (maxItems > 0) {
        const newIndex = Math.max(0, state.settingsSubIndex - 1)
        appState.setSettingsSubIndex(newIndex)
      }
      return true
    }

    // Toggle settings
    if (key.name === "return" || key.name === "enter" || key.name === "space") {
      await handleSettingsToggle(state)
      return true
    }
  }

  // Escape key - navigation
  if (key.name === "escape") {
    if (state.settingsPage === "main") {
      appState.setCurrentView("chats")
    } else if (
      state.settingsPage === "notifications-messages" ||
      state.settingsPage === "notifications-groups" ||
      state.settingsPage === "notifications-status"
    ) {
      appState.setSettingsPage("notifications")
      appState.setSettingsSubIndex(0)
    } else {
      appState.setSettingsPage("main")
      appState.setSettingsSelectedIndex(0)
    }
    return true
  }

  return false
}

/**
 * Handle settings toggle actions
 */
async function handleSettingsToggle(state: AppState): Promise<void> {
  if (state.settingsPage === "chats") {
    if (state.settingsSubIndex === 0) {
      const newValue = !state.enterIsSend
      appState.setEnterIsSend(newValue)
      debugLog("Settings", `Enter is send: ${newValue}`)
      await saveSettings({ enterIsSend: newValue })
    }
  } else if (state.settingsPage === "notifications") {
    if (state.settingsSubIndex === 0) {
      appState.setSettingsPage("notifications-messages")
      appState.setSettingsSubIndex(0)
    } else if (state.settingsSubIndex === 1) {
      appState.setSettingsPage("notifications-groups")
      appState.setSettingsSubIndex(0)
    } else if (state.settingsSubIndex === 2) {
      appState.setSettingsPage("notifications-status")
      appState.setSettingsSubIndex(0)
    } else if (state.settingsSubIndex === 3) {
      const newValue = !state.showPreviews
      appState.setShowPreviews(newValue)
      debugLog("Settings", `Show previews: ${newValue}`)
      await saveSettings({ showPreviews: newValue })
    } else if (state.settingsSubIndex === 4) {
      const newValue = !state.backgroundSync
      appState.setBackgroundSync(newValue)
      debugLog("Settings", `Background sync: ${newValue}`)
      await saveSettings({ backgroundSync: newValue })
    }
  } else if (state.settingsPage === "notifications-messages") {
    const current = { ...state.messageNotifications }
    if (state.settingsSubIndex === 0) {
      current.showNotifications = !current.showNotifications
      debugLog("Settings", `Message notifications: ${current.showNotifications}`)
    } else if (state.settingsSubIndex === 1) {
      current.showReactionNotifications = !current.showReactionNotifications
      debugLog("Settings", `Message reaction notifications: ${current.showReactionNotifications}`)
    } else if (state.settingsSubIndex === 2) {
      current.playSound = !current.playSound
      debugLog("Settings", `Message play sound: ${current.playSound}`)
    }
    appState.setMessageNotifications(current)
    await saveSettings({ messageNotifications: current })
  } else if (state.settingsPage === "notifications-groups") {
    const current = { ...state.groupNotifications }
    if (state.settingsSubIndex === 0) {
      current.showNotifications = !current.showNotifications
      debugLog("Settings", `Group notifications: ${current.showNotifications}`)
    } else if (state.settingsSubIndex === 1) {
      current.showReactionNotifications = !current.showReactionNotifications
      debugLog("Settings", `Group reaction notifications: ${current.showReactionNotifications}`)
    } else if (state.settingsSubIndex === 2) {
      current.playSound = !current.playSound
      debugLog("Settings", `Group play sound: ${current.playSound}`)
    }
    appState.setGroupNotifications(current)
    await saveSettings({ groupNotifications: current })
  } else if (state.settingsPage === "notifications-status") {
    const current = { ...state.statusNotifications }
    if (state.settingsSubIndex === 0) {
      current.showNotifications = !current.showNotifications
      debugLog("Settings", `Status notifications: ${current.showNotifications}`)
    } else if (state.settingsSubIndex === 1) {
      current.showReactionNotifications = !current.showReactionNotifications
      debugLog("Settings", `Status reaction notifications: ${current.showReactionNotifications}`)
    } else if (state.settingsSubIndex === 2) {
      current.playSound = !current.playSound
      debugLog("Settings", `Status play sound: ${current.playSound}`)
    }
    appState.setStatusNotifications(current)
    await saveSettings({ statusNotifications: current })
  }
}

/**
 * Handle global keyboard shortcuts that work across views
 * Returns true if the key was handled
 */
async function handleGlobalKeys(key: KeyEvent, state: AppState): Promise<boolean> {
  // Quit (Ctrl+C only)
  if (key.name === "c" && key.ctrl) {
    process.exit(0)
  }

  // Number key navigation
  if (key.name === "1" && !state.inputMode) {
    appState.setCurrentView("sessions")
    appState.setSelectedSessionIndex(0)
    await loadSessions()
    return true
  }

  if (key.name === "2" && !state.inputMode) {
    if (state.currentSession) {
      appState.setCurrentView("chats")
      appState.setSelectedChatIndex(0)
      await loadChats()
    }
    return true
  }

  return false
}

/**
 * Main keyboard handler - routes key events to appropriate handlers
 */
export async function handleKeyPress(key: KeyEvent, context: KeyHandlerContext): Promise<void> {
  debugLog(
    "Keyboard",
    `Key: ${key.name} | Ctrl: ${key.ctrl} | Shift: ${key.shift} | Meta: ${key.meta}`
  )

  const state = appState.getState()

  // Mark activity in conversation view
  if (state.currentView === "conversation") {
    markActivity()
  }

  // Priority handlers (context menu)
  if (await handleContextMenuKeys(key, state, context.renderApp)) return

  // View-specific handlers
  if (await handleQRViewKeys(key, state)) return
  if (await handleSessionsViewKeys(key, state)) return
  if (await handleChatsViewKeys(key, state)) return
  if (await handleConversationViewKeys(key, state)) return
  if (await handleSettingsViewKeys(key, state)) return

  // Global handlers
  await handleGlobalKeys(key, state)
}

/**
 * Export for fast-path selection updates in chat list
 */
export { chatListManager }
