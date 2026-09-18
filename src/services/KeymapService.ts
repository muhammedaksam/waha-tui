/**
 * Keymap Service
 * Centralized keybinding and command orchestration using @opentui/keymap
 * Maps all application views and scopes to declarative layers and commands
 */

import type { CliRenderer, KeyEvent, Renderable } from "@opentui/core"
import type { Keymap } from "@opentui/keymap"

import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"

import type { ActiveFilter, AppState } from "~/state/AppState"
import {
  deleteSession,
  fetchMyProfile,
  loadChats,
  loadContacts,
  loadMessages,
  loadSessions,
  logoutSession,
  markActivity,
  startPresenceManagement,
  stopPresenceManagement,
} from "~/client"
import { markChatRead } from "~/client/chatActions"
import {
  bulkDeleteMessages,
  bulkForwardMessages,
  bulkStarMessages,
  downloadAndOpenMedia,
  reactToMessage,
  sendMediaMessage,
  sendPoll,
} from "~/client/messageActions"
import { getSelectedContextMenuActionId, handleContextMenuKey } from "~/components/ContextMenu"
import { showEasterEggModal } from "~/components/EasterEggModal"
import { showEmojiPicker } from "~/components/EmojiPicker"
import {
  handleLogoutConfirm,
  showCaptionModal,
  showContactPickerModal,
  showFilePickerModal,
  showPollModal,
} from "~/components/Modal"
import { showToast } from "~/components/Toast"
import { saveSettings } from "~/config/manager"
import { applyThemeSettings } from "~/config/theme"
import { executeContextMenuAction } from "~/handlers/ContextMenuActions"
import { getDialogContainer, getDialogManager } from "~/router"
import { webSocketService } from "~/services/WebSocketService"
import { appState } from "~/state/AppState"
import { getRenderer } from "~/state/RendererContext"
import { calculateChatListScrollOffset } from "~/utils/chatListScroll"
import { startNewChat } from "~/utils/createChat"
import { debugLog } from "~/utils/debug"
import { filterChats, isArchived } from "~/utils/filterChats"
import { getChatIdString } from "~/utils/formatters"
import { blurSearchInput, clearSearchInput, focusSearchInput } from "~/views/ChatsView"
import {
  blurMessageInput,
  destroyConversationScrollBox,
  focusMessageInput,
  scrollConversation,
} from "~/views/ConversationView"
import {
  handlePhoneBackspace,
  handlePhoneInput,
  submitPhoneNumber,
  toggleAuthMode,
} from "~/views/QRCodeView"
import { createNewSession } from "~/views/SessionCreate"
import { getSettingsMenuItems } from "~/views/SettingsView"

export const KONAMI_CODE_SEQUENCE: readonly string[] = [
  "up",
  "up",
  "down",
  "down",
  "left",
  "right",
  "left",
  "right",
  "b",
  "a",
]

let keymapInstance: Keymap<Renderable, KeyEvent> | null = null
let konamiProgress = 0
let renderAppCallback: ((forceRebuild?: boolean) => void) | null = null
let snakeGameHandler: ((key: string) => boolean) | null = null

export function setKeymapRenderApp(fn: ((forceRebuild?: boolean) => void) | null): void {
  renderAppCallback = fn
}

export function setSnakeGameHandler(handler: ((key: string) => boolean) | null): void {
  snakeGameHandler = handler
}

export function isSnakeGameActive(): boolean {
  return snakeGameHandler !== null
}

export function isDialogOpen(): boolean {
  try {
    return getDialogManager().isOpen()
  } catch {
    return false
  }
}

export function getKonamiProgress(): number {
  return konamiProgress
}

export function resetKonamiProgress(): void {
  konamiProgress = 0
}

/**
 * Filter chats helper
 */
export function getCurrentFilteredChats(state: AppState) {
  if (state.showingArchivedChats) {
    return state.chats.filter(isArchived)
  }
  return filterChats(state.chats, state.activeFilter, state.searchQuery)
}

/**
 * Handle settings toggle actions
 */
export async function handleSettingsToggle(state: AppState): Promise<void> {
  if (state.settingsPage === "chats") {
    if (state.settingsSubIndex === 0) {
      const newValue = !state.enterIsSend
      appState.setEnterIsSend(newValue)
      debugLog("Settings", `Enter is send: ${newValue}`)
      await saveSettings({ enterIsSend: newValue })
    }
  } else if (state.settingsPage === "theme") {
    if (state.settingsSubIndex === 0) {
      const newValue = !state.useSystemTheme
      appState.setUseSystemTheme(newValue)
      applyThemeSettings({ useSystemTheme: newValue })
      debugLog("Settings", `Use system theme: ${newValue}`)
      await saveSettings({ useSystemTheme: newValue })
    } else if (state.settingsSubIndex === 1) {
      const nextModes: Record<string, "system" | "dark" | "light"> = {
        system: "dark",
        dark: "light",
        light: "system",
      }
      const nextMode = nextModes[state.themeMode] || "system"
      appState.setThemeMode(nextMode)
      applyThemeSettings({ themeMode: nextMode })
      debugLog("Settings", `Theme mode: ${nextMode}`)
      await saveSettings({ themeMode: nextMode })
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

function isKonamiInputAllowed(): boolean {
  const state = appState.getState()
  if (state.inputMode) return false

  try {
    const dialogManager = getDialogManager()
    if (dialogManager.isOpen()) return false
  } catch {
    // DialogManager may not be initialized in headless tests
  }

  if (state.contextMenu?.visible) return false

  return true
}

export function processKonamiStroke(
  event: KeyEvent,
  consume: () => void,
  keymap: Keymap<Renderable, KeyEvent>
): boolean {
  if (!isKonamiInputAllowed()) {
    konamiProgress = 0
    return false
  }

  if (event.ctrl || event.meta || event.super) {
    konamiProgress = 0
    return false
  }

  const keyName = event.name.toLowerCase()
  const expectedKey = KONAMI_CODE_SEQUENCE[konamiProgress]

  if (keyName === expectedKey) {
    konamiProgress++
    debugLog("Keymap", `Konami progress: ${konamiProgress}/${KONAMI_CODE_SEQUENCE.length}`)

    if (konamiProgress === KONAMI_CODE_SEQUENCE.length) {
      konamiProgress = 0
      consume()
      keymap.runCommand("easter-egg.konami")
      return true
    }
    return false
  }

  if (keyName === KONAMI_CODE_SEQUENCE[0]) {
    konamiProgress = 1
  } else {
    konamiProgress = 0
  }

  return false
}

/**
 * Register Context Menu Layer (Priority 100)
 */
function registerContextMenuLayer(keymap: Keymap<Renderable, KeyEvent>): void {
  keymap.registerLayer({
    priority: 100,
    enabled: () => !!appState.getState().contextMenu?.visible && !isDialogOpen(),
    commands: [
      {
        name: "context-menu.up",
        title: "Context Menu Move Up",
        run() {
          handleContextMenuKey("up")
          renderAppCallback?.(true)
        },
      },
      {
        name: "context-menu.down",
        title: "Context Menu Move Down",
        run() {
          handleContextMenuKey("down")
          renderAppCallback?.(true)
        },
      },
      {
        name: "context-menu.left",
        title: "Context Menu Move Left",
        run() {
          handleContextMenuKey("left")
          renderAppCallback?.(true)
        },
      },
      {
        name: "context-menu.right",
        title: "Context Menu Move Right",
        run() {
          handleContextMenuKey("right")
          renderAppCallback?.(true)
        },
      },
      {
        name: "context-menu.select",
        title: "Context Menu Execute Action",
        async run() {
          const handled = handleContextMenuKey("return")
          if (handled) {
            const actionId = getSelectedContextMenuActionId()
            const currentMenu = appState.getState().contextMenu
            appState.closeContextMenu()
            renderAppCallback?.(true)
            if (actionId && currentMenu) {
              await executeContextMenuAction(actionId, currentMenu)
            }
          }
          renderAppCallback?.(true)
        },
      },
      {
        name: "context-menu.close",
        title: "Context Menu Close",
        run() {
          handleContextMenuKey("escape")
          appState.closeContextMenu()
          renderAppCallback?.(true)
        },
      },
    ],
    bindings: [
      { key: "up", cmd: "context-menu.up" },
      { key: "k", cmd: "context-menu.up" },
      { key: "down", cmd: "context-menu.down" },
      { key: "j", cmd: "context-menu.down" },
      { key: "left", cmd: "context-menu.left" },
      { key: "h", cmd: "context-menu.left" },
      { key: "right", cmd: "context-menu.right" },
      { key: "l", cmd: "context-menu.right" },
      { key: "return", cmd: "context-menu.select" },
      { key: "enter", cmd: "context-menu.select" },
      { key: "space", cmd: "context-menu.select" },
      { key: "escape", cmd: "context-menu.close" },
      { key: "q", cmd: "context-menu.close" },
    ],
  })
}

/**
 * Register Dialog Layer (Priority 50)
 * Handles focus navigation between dialog buttons using left/right/tab/shift+tab,
 * activation with enter/return/space, and escape to close.
 */
function registerDialogLayer(keymap: Keymap<Renderable, KeyEvent>): void {
  keymap.registerLayer({
    priority: 50,
    enabled: () => isDialogOpen(),
    commands: [
      {
        name: "dialog.nav-next",
        title: "Dialog Next Button",
        run() {
          const container = getDialogContainer()
          container?.focusNextButton()
        },
      },
      {
        name: "dialog.nav-prev",
        title: "Dialog Previous Button",
        run() {
          const container = getDialogContainer()
          container?.focusPrevButton()
        },
      },
      {
        name: "dialog.select",
        title: "Dialog Select Button",
        run() {
          const container = getDialogContainer()
          if (container?.clickFocusedButton()) {
            return
          }
          try {
            const renderer = getRenderer()
            const focused = renderer.currentFocusedRenderable as unknown as {
              submit?: () => void
            } | null
            if (focused && typeof focused.submit === "function") {
              focused.submit()
            }
          } catch {
            // ignore
          }
        },
      },
      {
        name: "dialog.space-select",
        title: "Dialog Space Select Button",
        run() {
          try {
            const renderer = getRenderer()
            const focused = renderer.currentFocusedRenderable as unknown as {
              insertText?: (text: string) => void
            } | null
            if (focused && typeof focused.insertText === "function") {
              focused.insertText(" ")
              return
            }
          } catch {
            // ignore
          }
          const container = getDialogContainer()
          container?.clickFocusedButton()
        },
      },
      {
        name: "dialog.close",
        title: "Dialog Close",
        run() {
          try {
            getDialogManager().close()
          } catch {
            // ignore
          }
          renderAppCallback?.(true)
        },
      },
    ],
    bindings: [
      { key: "right", cmd: "dialog.nav-next" },
      { key: "tab", cmd: "dialog.nav-next" },
      { key: "left", cmd: "dialog.nav-prev" },
      { key: "shift+tab", cmd: "dialog.nav-prev" },
      { key: "return", cmd: "dialog.select" },
      { key: "enter", cmd: "dialog.select" },
      { key: "space", cmd: "dialog.space-select" },
      { key: "escape", cmd: "dialog.close" },
    ],
  })
}

/**
 * Register Settings View Layer (Priority 10)
 */
function registerSettingsLayer(keymap: Keymap<Renderable, KeyEvent>): void {
  const getMaxSubItems = (state: AppState): number => {
    switch (state.settingsPage) {
      case "chats":
        return 1
      case "theme":
        return 2
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

  keymap.registerLayer({
    priority: 10,
    enabled: () => {
      const state = appState.getState()
      return state.currentView === "settings" && !state.contextMenu?.visible && !isDialogOpen()
    },
    commands: [
      {
        name: "settings.nav-down",
        title: "Settings Navigate Down",
        run() {
          const state = appState.getState()
          if (state.settingsPage === "main") {
            const menuLength = getSettingsMenuItems().length
            const newIndex = Math.min(menuLength - 1, state.settingsSelectedIndex + 1)
            appState.setSettingsSelectedIndex(newIndex)
          } else {
            const maxItems = getMaxSubItems(state)
            if (maxItems > 0) {
              const newIndex = Math.min(maxItems - 1, state.settingsSubIndex + 1)
              appState.setSettingsSubIndex(newIndex)
            }
          }
        },
      },
      {
        name: "settings.nav-up",
        title: "Settings Navigate Up",
        run() {
          const state = appState.getState()
          if (state.settingsPage === "main") {
            const newIndex = Math.max(0, state.settingsSelectedIndex - 1)
            appState.setSettingsSelectedIndex(newIndex)
          } else {
            const maxItems = getMaxSubItems(state)
            if (maxItems > 0) {
              const newIndex = Math.max(0, state.settingsSubIndex - 1)
              appState.setSettingsSubIndex(newIndex)
            }
          }
        },
      },
      {
        name: "settings.select",
        title: "Settings Select Option",
        async run() {
          const state = appState.getState()
          if (state.settingsPage === "main") {
            const items = getSettingsMenuItems()
            const selectedItem = items[state.settingsSelectedIndex]
            if (selectedItem === "logout") {
              debugLog("Settings", "Logout selected - showing confirmation")
              await handleLogoutConfirm()
            } else if (selectedItem) {
              appState.setSettingsPage(selectedItem)
              appState.setSettingsSubIndex(0)
            }
          } else {
            await handleSettingsToggle(state)
          }
        },
      },
      {
        name: "settings.toggle",
        title: "Settings Toggle Sub-Option",
        async run() {
          const state = appState.getState()
          if (state.settingsPage !== "main") {
            await handleSettingsToggle(state)
          }
        },
      },
      {
        name: "settings.escape",
        title: "Settings Return / Exit",
        run() {
          const state = appState.getState()
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
        },
      },
    ],
    bindings: [
      { key: "j", cmd: "settings.nav-down" },
      { key: "down", cmd: "settings.nav-down" },
      { key: "k", cmd: "settings.nav-up" },
      { key: "up", cmd: "settings.nav-up" },
      { key: "return", cmd: "settings.select" },
      { key: "enter", cmd: "settings.select" },
      { key: "space", cmd: "settings.toggle" },
      { key: "escape", cmd: "settings.escape" },
    ],
  })
}

/**
 * Register QR / Phone Pairing View Layer (Priority 10)
 */
function registerQRViewLayer(keymap: Keymap<Renderable, KeyEvent>): void {
  keymap.registerLayer({
    priority: 10,
    enabled: () => {
      const state = appState.getState()
      return state.currentView === "qr" && !state.contextMenu?.visible && !isDialogOpen()
    },
    commands: [
      {
        name: "qr.toggle-auth",
        title: "Switch to Phone Pairing Mode",
        enabled: () => appState.getState().authMode === "qr",
        run() {
          debugLog("Auth", "Switching to phone pairing mode")
          toggleAuthMode()
        },
      },
      {
        name: "qr.quit",
        title: "Cancel / Return to Sessions",
        run() {
          const state = appState.getState()
          if (state.authMode === "phone") {
            toggleAuthMode()
          } else {
            appState.setCurrentView("sessions")
          }
        },
      },
      {
        name: "qr.phone-backspace",
        title: "Phone Input Backspace",
        enabled: () => appState.getState().authMode === "phone",
        run() {
          handlePhoneBackspace()
        },
      },
      {
        name: "qr.phone-submit",
        title: "Submit Phone Number",
        enabled: () => appState.getState().authMode === "phone",
        async run() {
          await submitPhoneNumber()
        },
      },
      {
        name: "qr.phone-cancel",
        title: "Exit Phone Pairing",
        enabled: () => appState.getState().authMode === "phone",
        run() {
          toggleAuthMode()
        },
      },
    ],
    bindings: [
      { key: "p", cmd: "qr.toggle-auth" },
      { key: "q", cmd: "qr.quit" },
      { key: "backspace", cmd: "qr.phone-backspace" },
      { key: "return", cmd: "qr.phone-submit" },
      { key: "enter", cmd: "qr.phone-submit" },
      { key: "escape", cmd: "qr.phone-cancel" },
    ],
  })
}

/**
 * Register Sessions View Layer (Priority 10)
 */
function registerSessionsViewLayer(keymap: Keymap<Renderable, KeyEvent>): void {
  keymap.registerLayer({
    priority: 10,
    enabled: () => {
      const state = appState.getState()
      return (
        state.currentView === "sessions" &&
        !state.inputMode &&
        !state.contextMenu?.visible &&
        !isDialogOpen()
      )
    },
    commands: [
      {
        name: "sessions.nav-up",
        title: "Sessions Navigate Up",
        run() {
          const state = appState.getState()
          if (state.sessions.length > 0) {
            const newIndex = Math.max(0, state.selectedSessionIndex - 1)
            appState.setSelectedSessionIndex(newIndex)
          }
        },
      },
      {
        name: "sessions.nav-down",
        title: "Sessions Navigate Down",
        run() {
          const state = appState.getState()
          if (state.sessions.length > 0) {
            const newIndex = Math.min(state.sessions.length - 1, state.selectedSessionIndex + 1)
            appState.setSelectedSessionIndex(newIndex)
          }
        },
      },
      {
        name: "sessions.home",
        title: "Sessions Jump to First",
        run() {
          const state = appState.getState()
          if (state.sessions.length > 0) {
            appState.setSelectedSessionIndex(0)
          }
        },
      },
      {
        name: "sessions.end",
        title: "Sessions Jump to Last",
        run() {
          const state = appState.getState()
          if (state.sessions.length > 0) {
            appState.setSelectedSessionIndex(state.sessions.length - 1)
          }
        },
      },
      {
        name: "sessions.select",
        title: "Select Session",
        async run() {
          const state = appState.getState()
          if (state.sessions.length > 0) {
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
          }
        },
      },
      {
        name: "sessions.new",
        title: "Create New Session",
        async run() {
          await createNewSession("default")
          await loadSessions()
        },
      },
      {
        name: "sessions.delete",
        title: "Delete / Logout Session",
        async run() {
          await logoutSession()
          await deleteSession()
        },
      },
      {
        name: "sessions.refresh",
        title: "Refresh Sessions",
        async run() {
          await loadSessions()
        },
      },
    ],
    bindings: [
      { key: "up", cmd: "sessions.nav-up" },
      { key: "down", cmd: "sessions.nav-down" },
      { key: "home", cmd: "sessions.home" },
      { key: "end", cmd: "sessions.end" },
      { key: "return", cmd: "sessions.select" },
      { key: "enter", cmd: "sessions.select" },
      { key: "n", cmd: "sessions.new" },
      { key: "q", cmd: "sessions.delete" },
      { key: "r", cmd: "sessions.refresh" },
    ],
  })
}

/**
 * Register Chats View Layer (Priority 10)
 */
function registerChatsViewLayer(keymap: Keymap<Renderable, KeyEvent>): void {
  keymap.registerLayer({
    priority: 10,
    enabled: () => {
      const state = appState.getState()
      return state.currentView === "chats" && !state.contextMenu?.visible && !isDialogOpen()
    },
    commands: [
      {
        name: "chats.filter-next",
        title: "Cycle Filter Forward",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const filters: ActiveFilter[] = ["all", "unread", "favorites", "groups", "labeled"]
          const currentIndex = filters.indexOf(state.activeFilter)
          const nextIndex = (currentIndex + 1) % filters.length
          appState.setActiveFilter(filters[nextIndex]!)
        },
      },
      {
        name: "chats.filter-prev",
        title: "Cycle Filter Backward",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const filters: ActiveFilter[] = ["all", "unread", "favorites", "groups", "labeled"]
          const currentIndex = filters.indexOf(state.activeFilter)
          const prevIndex = currentIndex === 0 ? filters.length - 1 : currentIndex - 1
          appState.setActiveFilter(filters[prevIndex]!)
        },
      },
      {
        name: "chats.search",
        title: "Focus Chat Search",
        enabled: () => !appState.getState().inputMode,
        run() {
          focusSearchInput()
        },
      },
      {
        name: "chats.context-menu",
        title: "Open Chat Context Menu",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const filteredChats = getCurrentFilteredChats(state)
          const selectedChat = filteredChats[state.selectedChatIndex]
          if (selectedChat) {
            const chatId = getChatIdString(selectedChat.id)
            const yPos = Math.min(
              18,
              Math.max(6, 6 + (state.selectedChatIndex - state.chatListScrollOffset) * 3)
            )
            appState.openContextMenu("chat", chatId, selectedChat, { x: 32, y: yPos })
            renderAppCallback?.(true)
          }
        },
      },
      {
        name: "chats.settings",
        title: "Open Settings",
        enabled: () => !appState.getState().inputMode,
        run() {
          appState.setCurrentView("settings")
          appState.setSettingsPage("main")
          appState.setSettingsSelectedIndex(0)
          appState.setLastChangeType("view")
        },
      },
      {
        name: "chats.new-chat",
        title: "Start New Chat",
        enabled: () => !appState.getState().inputMode,
        run() {
          showContactPickerModal().then(async (chatId) => {
            if (chatId) {
              await startNewChat(chatId)
              appState.setSearchQuery("")
            }
          })
        },
      },
      {
        name: "chats.nav-up",
        title: "Chats Move Up",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const filteredChats = getCurrentFilteredChats(state)
          if (filteredChats.length === 0) return
          const newIndex = Math.max(0, state.selectedChatIndex - 1)
          const newScrollOffset = calculateChatListScrollOffset(
            newIndex,
            state.chatListScrollOffset,
            filteredChats.length
          )
          appState.setSelectedChatIndex(newIndex)
          appState.setChatListScrollOffset(newScrollOffset)
          appState.setLastChangeType("selection")
        },
      },
      {
        name: "chats.nav-down",
        title: "Chats Move Down",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const filteredChats = getCurrentFilteredChats(state)
          if (filteredChats.length === 0) return
          const newIndex = Math.min(filteredChats.length - 1, state.selectedChatIndex + 1)
          const newScrollOffset = calculateChatListScrollOffset(
            newIndex,
            state.chatListScrollOffset,
            filteredChats.length
          )
          appState.setSelectedChatIndex(newIndex)
          appState.setChatListScrollOffset(newScrollOffset)
          appState.setLastChangeType("selection")
        },
      },
      {
        name: "chats.select",
        title: "Select Chat",
        async run() {
          const state = appState.getState()
          if (state.inputMode) {
            appState.setInputMode(false)
            blurSearchInput()
            return
          }
          const filteredChats = getCurrentFilteredChats(state)
          const selectedChat = filteredChats[state.selectedChatIndex]
          if (selectedChat && state.currentSession) {
            const chatId = getChatIdString(selectedChat.id)
            appState.setCurrentChat(chatId)
            destroyConversationScrollBox()
            loadContacts()
            await loadMessages(chatId)
            startPresenceManagement(chatId)
            markChatRead(chatId)
          }
        },
      },
      {
        name: "chats.home",
        title: "Chats Jump to First",
        enabled: () => !appState.getState().inputMode,
        run() {
          appState.setSelectedChatIndex(0)
          appState.setChatListScrollOffset(0)
          appState.setLastChangeType("selection")
        },
      },
      {
        name: "chats.end",
        title: "Chats Jump to Last",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const filteredChats = getCurrentFilteredChats(state)
          if (filteredChats.length === 0) return
          const lastIndex = filteredChats.length - 1
          const newScrollOffset = calculateChatListScrollOffset(
            lastIndex,
            state.chatListScrollOffset,
            filteredChats.length
          )
          appState.setSelectedChatIndex(lastIndex)
          appState.setChatListScrollOffset(newScrollOffset)
          appState.setLastChangeType("selection")
        },
      },
      {
        name: "chats.page-up",
        title: "Chats Page Up",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const filteredChats = getCurrentFilteredChats(state)
          if (state.chats.length > 0 && filteredChats.length > 0) {
            const pageSize = 12
            const newIndex = Math.max(0, state.selectedChatIndex - pageSize)
            const newScrollOffset = calculateChatListScrollOffset(
              newIndex,
              state.chatListScrollOffset,
              filteredChats.length
            )
            appState.setSelectedChatIndex(newIndex)
            appState.setChatListScrollOffset(newScrollOffset)
            appState.setLastChangeType("selection")
          }
        },
      },
      {
        name: "chats.page-down",
        title: "Chats Page Down",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const filteredChats = getCurrentFilteredChats(state)
          if (state.chats.length > 0 && filteredChats.length > 0) {
            const pageSize = 12
            const newIndex = Math.min(filteredChats.length - 1, state.selectedChatIndex + pageSize)
            const newScrollOffset = calculateChatListScrollOffset(
              newIndex,
              state.chatListScrollOffset,
              filteredChats.length
            )
            appState.setSelectedChatIndex(newIndex)
            appState.setChatListScrollOffset(newScrollOffset)
            appState.setLastChangeType("selection")
          }
        },
      },
      {
        name: "chats.escape",
        title: "Chats Escape / Blur / Back",
        run() {
          const state = appState.getState()
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
        },
      },
      {
        name: "chats.toggle-archived",
        title: "Toggle Archived Chats View",
        run() {
          const state = appState.getState()
          appState.setShowingArchivedChats(!state.showingArchivedChats)
        },
      },
      {
        name: "chats.refresh",
        title: "Refresh Chats",
        enabled: () => !appState.getState().inputMode && !!appState.getState().currentSession,
        async run() {
          await loadChats()
        },
      },
    ],
    bindings: [
      { key: "tab", cmd: "chats.filter-next" },
      { key: "shift+tab", cmd: "chats.filter-prev" },
      { key: "/", cmd: "chats.search" },
      { key: "slash", cmd: "chats.search" },
      { key: "ctrl+f", cmd: "chats.search" },
      { key: "c", cmd: "chats.context-menu" },
      { key: "s", cmd: "chats.settings" },
      { key: "n", cmd: "chats.new-chat" },
      { key: "up", cmd: "chats.nav-up" },
      { key: "down", cmd: "chats.nav-down" },
      { key: "home", cmd: "chats.home" },
      { key: "end", cmd: "chats.end" },
      { key: "left", cmd: "chats.page-up" },
      { key: "pageup", cmd: "chats.page-up" },
      { key: "right", cmd: "chats.page-down" },
      { key: "pagedown", cmd: "chats.page-down" },
      { key: "return", cmd: "chats.select" },
      { key: "enter", cmd: "chats.select" },
      { key: "escape", cmd: "chats.escape" },
      { key: "ctrl+a", cmd: "chats.toggle-archived" },
      { key: "meta+a", cmd: "chats.toggle-archived" },
      { key: "r", cmd: "chats.refresh" },
    ],
  })
}

/**
 * Register Conversation View Layer (Priority 10)
 */
function registerConversationViewLayer(keymap: Keymap<Renderable, KeyEvent>): void {
  keymap.registerLayer({
    priority: 10,
    enabled: () => {
      const state = appState.getState()
      return (
        state.currentView === "conversation" &&
        !state.contextMenu?.visible &&
        !isDialogOpen() &&
        !state.emojiPicker?.visible
      )
    },
    commands: [
      {
        name: "conversation.search-next",
        title: "Next Message Search Result",
        enabled: () => appState.getState().isSearchActive,
        run() {
          appState.navigateMessageSearchResult(1)
        },
      },
      {
        name: "conversation.search-prev",
        title: "Previous Message Search Result",
        enabled: () => appState.getState().isSearchActive,
        run() {
          appState.navigateMessageSearchResult(-1)
        },
      },
      {
        name: "conversation.context-menu",
        title: "Message Context Menu",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const messages = state.messages.get(state.currentChatId || "")
          if (messages && messages.length > 0) {
            const targetMessage = messages[0]!
            const messageId = targetMessage.id
            appState.openContextMenu("message", messageId, targetMessage)
          }
        },
      },
      {
        name: "conversation.open-media",
        title: "Download and Open Media",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const messages = state.messages.get(state.currentChatId || "")
          if (messages && messages.length > 0) {
            const targetMessage = [...messages]
              .reverse()
              .find((m) => m.hasMedia || m._data?.hasMedia)
            if (targetMessage && state.currentChatId) {
              downloadAndOpenMedia(state.currentChatId as string, targetMessage.id).catch((err) => {
                debugLog("Keyboard", `Failed to download media via shortcut: ${err}`)
              })
            }
          }
        },
      },
      {
        name: "conversation.attach-media",
        title: "Attach File / Media",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          if (!state.currentChatId) return

          showFilePickerModal().then((filePath) => {
            if (!filePath) return
            showCaptionModal().then((caption) => {
              if (caption === null) return
              showToast("Sending media...", "info")
              sendMediaMessage(state.currentChatId as string, filePath, caption)
                .then(() => {
                  showToast("Media sent successfully", "success")
                })
                .catch((err) => {
                  debugLog("Keyboard", `Failed to send media: ${err}`)
                  showToast("Failed to send media", "error")
                })
            })
          })
        },
      },
      {
        name: "conversation.emoji",
        title: "Emoji Picker",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          const messages = state.messages.get(state.currentChatId || "")
          if (messages && messages.length > 0) {
            const targetMessage = messages[messages.length - 1]!
            showEmojiPicker().then((emoji) => {
              if (emoji) {
                reactToMessage(targetMessage.id, emoji).catch((err) => {
                  debugLog("Keyboard", `Failed to react: ${err}`)
                  showToast("Failed to react", "error")
                })
              }
            })
          }
        },
      },
      {
        name: "conversation.poll",
        title: "Create Poll",
        enabled: () => !appState.getState().inputMode,
        run() {
          const state = appState.getState()
          if (!state.currentChatId) return
          showPollModal().then((pollData) => {
            if (pollData) {
              showToast("Sending poll...", "info")
              sendPoll(
                state.currentChatId as string,
                pollData.question,
                pollData.options,
                pollData.multipleAnswers
              )
                .then(() => {
                  showToast("Poll sent successfully", "success")
                })
                .catch((err) => {
                  debugLog("Keyboard", `Failed to send poll: ${err}`)
                  showToast("Failed to send poll", "error")
                })
            }
          })
        },
      },
      {
        name: "conversation.toggle-selection",
        title: "Toggle Message Selection Mode",
        enabled: () => !appState.getState().inputMode && !appState.getState().isSearchActive,
        run() {
          const state = appState.getState()
          if (state.currentChatId) {
            appState.toggleSelectionMode(state.currentChatId)
          }
        },
      },
      {
        name: "conversation.bulk-delete",
        title: "Delete Selected Messages",
        enabled: () => {
          const state = appState.getState()
          const isSelection = state.isSelectionMode.get(state.currentChatId || "") ?? false
          return isSelection && !state.inputMode
        },
        run() {
          const state = appState.getState()
          const selectedIds = state.selectedMessageIds.get(state.currentChatId || "")
          if (selectedIds && selectedIds.size > 0 && state.currentChatId) {
            bulkDeleteMessages(state.currentChatId, Array.from(selectedIds))
          }
        },
      },
      {
        name: "conversation.bulk-forward",
        title: "Forward Selected Messages",
        enabled: () => {
          const state = appState.getState()
          const isSelection = state.isSelectionMode.get(state.currentChatId || "") ?? false
          return isSelection && !state.inputMode
        },
        run() {
          const state = appState.getState()
          const selectedIds = state.selectedMessageIds.get(state.currentChatId || "")
          if (selectedIds && selectedIds.size > 0 && state.currentChatId) {
            showContactPickerModal().then((toChatId) => {
              if (toChatId) {
                bulkForwardMessages(state.currentChatId!, Array.from(selectedIds), toChatId)
              }
            })
          }
        },
      },
      {
        name: "conversation.bulk-star",
        title: "Star Selected Messages",
        enabled: () => {
          const state = appState.getState()
          const isSelection = state.isSelectionMode.get(state.currentChatId || "") ?? false
          return isSelection && !state.inputMode
        },
        run() {
          const state = appState.getState()
          const selectedIds = state.selectedMessageIds.get(state.currentChatId || "")
          if (selectedIds && selectedIds.size > 0 && state.currentChatId) {
            bulkStarMessages(state.currentChatId, Array.from(selectedIds), true)
          }
        },
      },
      {
        name: "conversation.scroll-up",
        title: "Conversation Scroll Up",
        enabled: () => !appState.getState().inputMode,
        run() {
          scrollConversation(-4)
        },
      },
      {
        name: "conversation.scroll-down",
        title: "Conversation Scroll Down",
        enabled: () => !appState.getState().inputMode,
        run() {
          scrollConversation(4)
        },
      },
      {
        name: "conversation.page-up",
        title: "Conversation Page Up",
        enabled: () => !appState.getState().inputMode,
        run() {
          scrollConversation(-20)
        },
      },
      {
        name: "conversation.page-down",
        title: "Conversation Page Down",
        enabled: () => !appState.getState().inputMode,
        run() {
          scrollConversation(20)
        },
      },
      {
        name: "conversation.input-mode",
        title: "Focus Message Input",
        enabled: () => !appState.getState().inputMode,
        run() {
          focusMessageInput()
        },
      },
      {
        name: "conversation.search",
        title: "Open Conversation Search",
        enabled: () => !appState.getState().inputMode && !appState.getState().isSearchActive,
        run() {
          appState.setMessageSearchActive(true)
          appState.setInputMode(true)
        },
      },
      {
        name: "conversation.escape",
        title: "Conversation Escape / Back",
        run() {
          const state = appState.getState()
          const isSelectionMode = state.isSelectionMode.get(state.currentChatId || "") ?? false
          if (state.isSearchActive) {
            appState.clearMessageSearch()
            appState.setInputMode(false)
          } else if (isSelectionMode) {
            if (state.currentChatId) {
              appState.toggleSelectionMode(state.currentChatId)
            }
          } else if (state.inputMode) {
            blurMessageInput()
          } else {
            stopPresenceManagement()
            appState.setCurrentView("chats")
            appState.setCurrentChat(null)
          }
        },
      },
    ],
    bindings: [
      { key: "return", cmd: "conversation.search-next" },
      { key: "enter", cmd: "conversation.search-next" },
      { key: "shift+return", cmd: "conversation.search-prev" },
      { key: "shift+enter", cmd: "conversation.search-prev" },
      { key: "m", cmd: "conversation.context-menu" },
      { key: "o", cmd: "conversation.open-media" },
      { key: "a", cmd: "conversation.attach-media" },
      { key: "e", cmd: "conversation.emoji" },
      { key: "p", cmd: "conversation.poll" },
      { key: "x", cmd: "conversation.toggle-selection" },
      { key: "d", cmd: "conversation.bulk-delete" },
      { key: "f", cmd: "conversation.bulk-forward" },
      { key: "s", cmd: "conversation.bulk-star" },
      { key: "up", cmd: "conversation.scroll-up" },
      { key: "down", cmd: "conversation.scroll-down" },
      { key: "left", cmd: "conversation.page-up" },
      { key: "pageup", cmd: "conversation.page-up" },
      { key: "right", cmd: "conversation.page-down" },
      { key: "pagedown", cmd: "conversation.page-down" },
      { key: "i", cmd: "conversation.input-mode" },
      { key: "/", cmd: "conversation.search" },
      { key: "slash", cmd: "conversation.search" },
      { key: "ctrl+f", cmd: "conversation.search" },
      { key: "escape", cmd: "conversation.escape" },
    ],
  })
}

/**
 * Register Global Layer (Priority 0)
 */
function registerGlobalLayer(keymap: Keymap<Renderable, KeyEvent>): void {
  keymap.registerLayer({
    priority: 0,
    commands: [
      {
        name: "app.quit",
        title: "Quit Application",
        run() {
          debugLog("Keymap", "Executing app.quit")
          process.exit(0)
        },
      },
      {
        name: "nav.sessions",
        title: "Go to Sessions View",
        enabled: () => !appState.getState().inputMode && !isDialogOpen(),
        async run() {
          debugLog("Keymap", "Executing nav.sessions")
          appState.setCurrentView("sessions")
          appState.setSelectedSessionIndex(0)
          await loadSessions()
        },
      },
      {
        name: "nav.chats",
        title: "Go to Chats View",
        enabled: () => {
          const state = appState.getState()
          return !state.inputMode && !isDialogOpen() && !!state.currentSession
        },
        async run() {
          debugLog("Keymap", "Executing nav.chats")
          appState.setCurrentView("chats")
          appState.setSelectedChatIndex(0)
          await loadChats()
        },
      },
      {
        name: "easter-egg.konami",
        title: "Konami Code 30 Lives Easter Egg",
        enabled: () => !appState.getState().inputMode && !isDialogOpen(),
        run() {
          debugLog("Keymap", "Executing easter-egg.konami")
          showEasterEggModal()
        },
      },
    ],
    bindings: [
      { key: "ctrl+c", cmd: "app.quit" },
      { key: "1", cmd: "nav.sessions" },
      { key: "2", cmd: "nav.chats" },
    ],
  })
}

/**
 * Initialize @opentui/keymap for the application
 */
export function initKeymap(
  renderer: CliRenderer,
  context?: { renderApp?: (forceRebuild?: boolean) => void }
): Keymap<Renderable, KeyEvent> {
  if (context?.renderApp) {
    setKeymapRenderApp(context.renderApp)
  }

  if (keymapInstance) {
    return keymapInstance
  }

  const keymap = createDefaultOpenTuiKeymap(renderer)
  keymapInstance = keymap

  // Register layers in descending priority order
  registerContextMenuLayer(keymap)
  registerDialogLayer(keymap)
  registerSettingsLayer(keymap)
  registerQRViewLayer(keymap)
  registerSessionsViewLayer(keymap)
  registerChatsViewLayer(keymap)
  registerConversationViewLayer(keymap)
  registerGlobalLayer(keymap)

  // Intercept key events for:
  // 1. Snake game key handling (when modal is open and active)
  // 2. Activity marking in conversation view
  // 3. Phone digits in QR phone pairing mode
  // 4. Konami code sequence detection
  keymap.intercept("key", ({ event, consume }) => {
    // If the snake mini-game is active and consumes this key event, stop further processing
    if (snakeGameHandler && snakeGameHandler(event.name)) {
      consume()
      return
    }

    const state = appState.getState()

    if (state.currentView === "conversation") {
      markActivity()
    }

    if (state.currentView === "qr" && state.authMode === "phone" && /^[0-9]$/.test(event.name)) {
      handlePhoneInput(event.name)
      consume()
      return
    }

    processKonamiStroke(event, consume, keymap)
  })

  return keymap
}

export function getKeymap(): Keymap<Renderable, KeyEvent> | null {
  return keymapInstance
}

export function destroyKeymap(): void {
  keymapInstance = null
  konamiProgress = 0
  renderAppCallback = null
  snakeGameHandler = null
}
