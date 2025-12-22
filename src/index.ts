#!/usr/bin/env bun
/**
 * WAHA TUI - Terminal User Interface for WhatsApp via WAHA
 */

import { Box, createCliRenderer, Text, type KeyEvent, BoxRenderable } from "@opentui/core"
import { loadConfig, saveConfig, configExists, createDefaultConfig } from "./config/manager"
import { validateConfig } from "./config/schema"
import {
  initializeClient,
  testConnection,
  loadMessages,
  loadChats,
  loadSessions,
  logoutSession,
  deleteSession,
  loadContacts,
  loadOlderMessages,
  fetchMyProfile,
  startPresenceManagement,
  stopPresenceManagement,
  markActivity,
  loadLidMappings,
} from "./client"
import { executeContextMenuAction } from "./handlers"
import { appState } from "./state/AppState"
import { Footer } from "./components/Footer"
import {
  ContextMenu,
  handleContextMenuKey,
  getSelectedMenuItem,
  isClickOutsideContextMenu,
  clearMenuBounds,
} from "./components/ContextMenu"
import { SessionsView } from "./views/SessionsView"
import { focusSearchInput, blurSearchInput, clearSearchInput } from "./views/ChatsView"
import {
  scrollConversation,
  destroyConversationScrollBox,
  focusMessageInput,
  blurMessageInput,
} from "./views/ConversationView"
import { createNewSession } from "./views/SessionCreate"
import { QRCodeView } from "./views/QRCodeView"
import { LoadingView } from "./views/LoadingView"
import { MainLayout } from "./views/MainLayout"
import type { WahaTuiConfig } from "./config/schema"
import { initDebug, debugLog } from "./utils/debug"
import { calculateChatListScrollOffset } from "./utils/chatListScroll"
import { filterChats, isArchived } from "./utils/filterChats"
import { getChatIdString } from "./utils/formatters"

import { webSocketService } from "./services/WebSocketService"
import { ConfigView } from "./views/ConfigView"
import type { CliRenderer } from "@opentui/core"
import { setRenderer } from "./state/RendererContext"
import { showQRCode } from "./views/QRCodeView"
import { chatListManager } from "./views/ChatListManager"
import { getClient } from "./client"

/**
 * Run the configuration wizard using the TUI
 * Returns when configuration is complete and saved
 */
async function runConfigWizard(renderer: CliRenderer): Promise<void> {
  const { getUrlInputValue, getApiKeyInputValue, destroyConfigInputs } =
    await import("./views/ConfigView")

  return new Promise((resolve) => {
    // Render the config view
    const renderConfigView = () => {
      const children = renderer.root.getChildren()
      for (const child of children) {
        renderer.root.remove(child.id)
      }
      renderer.root.add(ConfigView())
    }

    // Initial render
    renderConfigView()

    // Subscribe to state changes for re-rendering and handling step transitions
    const unsubscribe = appState.subscribe(async () => {
      const state = appState.getState()
      if (state.currentView !== "config" || !state.configStep) return

      const { step, status } = state.configStep

      // When step 3 is reached with "testing" status, perform the connection test
      if (step === 3 && status === "testing") {
        const wahaUrl = getUrlInputValue() || state.configStep.wahaUrl
        const wahaApiKey = getApiKeyInputValue() || state.configStep.wahaApiKey

        debugLog("Config", `Testing connection to ${wahaUrl}`)

        // Create temp config and test
        const tempConfig = createDefaultConfig(wahaUrl, wahaApiKey, {})
        const connected = await testConnection(tempConfig)

        if (connected) {
          // Save config
          await saveConfig(tempConfig)
          appState.setState({
            configStep: { ...state.configStep, step: 3, status: "success" },
          })

          // Wait a moment to show success, then resolve
          setTimeout(() => {
            destroyConfigInputs()
            unsubscribe()
            resolve()
          }, 1500)
        } else {
          appState.setState({
            configStep: {
              ...state.configStep,
              step: 3,
              status: "error",
              errorMessage: "Could not connect to WAHA server",
            },
          })
        }
        return
      }

      // Handle error retry
      if (status === "error") {
        // Wait for Enter key to retry (handled via key handler below)
      }

      // Re-render on state change
      renderConfigView()
    })

    // Handle error retry with Enter key
    const handleErrorRetry = (key: KeyEvent) => {
      const state = appState.getState()
      if (state.currentView !== "config" || !state.configStep) return
      if (state.configStep.status === "error" && (key.name === "return" || key.name === "enter")) {
        appState.setState({
          configStep: { ...state.configStep, step: 2, status: "input" },
        })
      }
    }

    renderer.keyInput.on("keypress", handleErrorRetry)
  })
}

async function main() {
  // Initialize debug logging
  initDebug()
  debugLog("App", "WAHA TUI starting...")

  // Create renderer FIRST so we can use it for everything including config
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  // Set renderer context for imperative API usage
  setRenderer(renderer)

  let config: WahaTuiConfig | null = null
  let needsConfig = false

  // Check if config exists
  if (await configExists()) {
    config = await loadConfig()

    if (!config) {
      debugLog("Config", "Failed to load config, showing config view")
      needsConfig = true
    } else {
      // Validate loaded config
      const errors = validateConfig(config)
      if (errors.length > 0) {
        debugLog("Config", `Config validation errors: ${errors.join(", ")}`)
        needsConfig = true
      }
    }
  } else {
    // First run - need configuration
    debugLog("Config", "No config found, showing config view")
    needsConfig = true
  }

  // If we need configuration, show the ConfigView
  if (needsConfig) {
    // Initialize config step state
    appState.setState({
      currentView: "config",
      configStep: {
        step: 1,
        wahaUrl: "http://localhost:3000",
        wahaApiKey: "",
        status: "input",
      },
    })

    // Set up config wizard rendering and input handling
    await runConfigWizard(renderer)

    // After config wizard completes, load the saved config
    config = await loadConfig()
    if (!config) {
      debugLog("Config", "Config still not found after wizard")
      process.exit(1)
    }
  }

  // At this point, config is guaranteed to be valid
  if (!config) {
    debugLog("Config", "Config is null after all checks")
    process.exit(1)
  }

  // Initialize WAHA client
  initializeClient(config)
  webSocketService.initialize(config)

  // Fetch WAHA version and tier info
  try {
    const client = getClient()
    const { data: versionInfo } = await client.observability.versionControllerGet()
    if (versionInfo?.tier) {
      appState.setState({ wahaTier: versionInfo.tier })
      debugLog("App", `WAHA tier: ${versionInfo.tier}, version: ${versionInfo.version}`)
    }
  } catch (error) {
    debugLog("App", `Failed to fetch WAHA version: ${error}`)
  }

  // Load initial sessions
  await loadSessions()

  // Default session name for free WAHA users
  const DEFAULT_SESSION = "default"

  // Check if we have a working session
  const currentState = appState.getState()
  const workingSession = currentState.sessions.find((s) => s.status === "WORKING")

  if (workingSession) {
    // Session is already working, go directly to chats
    debugLog("App", `Found working session: ${workingSession.name}, switching to chats view`)
    appState.setCurrentSession(workingSession.name)
    appState.setCurrentView("chats")
    await loadChats()
    loadLidMappings() // Preload LID mappings for presence matching
    webSocketService.connect() // Connect also if already working
    fetchMyProfile() // Fetch profile for "You" identification
  } else {
    // No working session - show QR view for login
    debugLog("App", `No working session, showing QR login with session: ${DEFAULT_SESSION}`)
    appState.setCurrentSession(DEFAULT_SESSION)
    appState.setCurrentView("qr")
    // Trigger QR code loading
    await showQRCode(DEFAULT_SESSION)
  }

  // Set up reactive rendering
  function renderApp(forceRebuild: boolean = false) {
    const state = appState.getState()

    // Optimization: for selection/scroll changes in chat view, only update styles
    if (
      !forceRebuild &&
      state.currentView === "chats" &&
      state.lastChangeType === "selection" &&
      chatListManager.hasCachedList()
    ) {
      debugLog("Render", "Fast path: updating selection only")
      chatListManager.updateSelection(state.selectedChatIndex)
      chatListManager.updateScroll(state.chatListScrollOffset)
      return
    }

    // debugLog("Render", `Full rebuild: lastChangeType=${state.lastChangeType}`)

    // Clear previous render - remove all children
    const children = renderer.root.getChildren()
    for (const child of children) {
      renderer.root.remove(child.id)
    }

    // Destroy chat list manager when leaving chats view
    if (state.currentView !== "chats" && state.currentView !== "conversation") {
      chatListManager.destroy()
    }

    // Clear menu bounds when context menu is closed
    if (!state.contextMenu?.visible) {
      clearMenuBounds()
    }

    // Create root wrapper with mouse handler for outside-click detection
    const rootWrapper = new BoxRenderable(renderer, {
      flexDirection: "column",
      flexGrow: 1,
      onMouse(event) {
        // Close context menu on any mouse down outside the menu
        if (event.type === "down" && state.contextMenu?.visible) {
          if (isClickOutsideContextMenu(event.x, event.y)) {
            appState.closeContextMenu()
          }
        }
      },
    })

    // Main Content Area - WhatsApp Layout or Legacy Views
    rootWrapper.add(
      Box(
        { flexGrow: 1 },
        state.currentView === "config"
          ? ConfigView()
          : state.currentView === "sessions"
            ? SessionsView()
            : state.currentView === "qr"
              ? QRCodeView()
              : state.currentView === "loading"
                ? LoadingView()
                : state.currentView === "chats" || state.currentView === "conversation"
                  ? MainLayout()
                  : Text({ content: `View: ${state.currentView} (Coming soon)` })
      )
    )

    // Footer with styled keyboard hints
    rootWrapper.add(Footer())

    // Add root wrapper to renderer
    renderer.root.add(rootWrapper)

    // Render context menu overlay if visible
    const contextMenuBox = ContextMenu()
    if (contextMenuBox) {
      renderer.root.add(contextMenuBox)
    }
  }

  // Subscribe to state changes
  appState.subscribe(() => {
    renderApp()
  })

  // Initial render (force rebuild)
  renderApp(true)

  // Register context menu action callback for mouse clicks (must be before keypress handler)
  appState.setContextMenuActionCallback((actionId) => {
    const currentState = appState.getState()
    if (currentState.contextMenu) {
      void executeContextMenuAction(actionId, currentState.contextMenu)
    }
  })

  // Keyboard handling using OpenTUI's keyInput event system
  renderer.keyInput.on("keypress", async (key: KeyEvent) => {
    // Debug log for keyboard input
    debugLog(
      "Keyboard",
      `Key: ${key.name} | Ctrl: ${key.ctrl} | Shift: ${key.shift} | Meta: ${key.meta}`
    )

    // Get latest state at the beginning of handler
    const state = appState.getState()

    // Mark activity to keep session "online" when user is active in a conversation
    if (state.currentView === "conversation") {
      markActivity()
    }

    // Helper to determine the current list of chats being displayed
    const getCurrentFilteredChats = () => {
      if (state.showingArchivedChats) {
        return state.chats.filter(isArchived)
      }
      return filterChats(state.chats, state.activeFilter, state.searchQuery)
    }

    // Context menu keyboard handling - takes priority when visible
    if (state.contextMenu?.visible) {
      const handled = handleContextMenuKey(key.name)
      if (handled) {
        // Check if Enter was pressed to execute action
        if (key.name === "return" || key.name === "enter") {
          const selectedItem = getSelectedMenuItem()
          if (selectedItem) {
            await executeContextMenuAction(selectedItem.id, state.contextMenu)
          }
        }
        renderApp(true)
        return
      }
    }

    // Quit (Ctrl+C only)
    if (key.name === "c" && key.ctrl) {
      process.exit(0)
    }

    // Refresh current view
    if (key.name === "r" && !state.inputMode && !state.contextMenu?.visible) {
      if (state.currentView === "sessions") {
        await loadSessions()
      } else if (state.currentView === "chats" && state.currentSession) {
        await loadChats()
      }
    }

    // Quit with 'q' key
    if (key.name === "q" && !state.inputMode && !state.contextMenu?.visible) {
      if (state.currentView === "sessions") {
        // Quit the app from sessions view
        await logoutSession()
        await deleteSession()
        // process.exit(0)
      } else if (state.currentView === "qr") {
        // Go back to sessions from QR view
        appState.setCurrentView("sessions")
      }
    }

    // Context menu triggers
    // 'm' key - open message context menu in conversation view
    if (key.name === "m" && state.currentView === "conversation" && !state.inputMode) {
      // Get the currently visible message (we'd need to track this)
      // For now, we'll need to get the selected/focused message from ConversationView
      const messages = state.messages.get(state.currentChatId || "")
      if (messages && messages.length > 0) {
        // Use the last message as target for now (will improve with message selection)
        const targetMessage = messages[messages.length - 1]
        const messageId = targetMessage.id
        appState.openContextMenu("message", messageId, targetMessage)
        debugLog("ContextMenu", `Opened message context menu for: ${messageId}`)
      }
      return
    }

    // 'c' key - open chat context menu in chats view
    if (key.name === "c" && !key.ctrl && state.currentView === "chats" && !state.inputMode) {
      const filteredChats = getCurrentFilteredChats()
      const selectedChat = filteredChats[state.selectedChatIndex]
      if (selectedChat) {
        const chatId = getChatIdString(selectedChat.id)
        appState.openContextMenu("chat", chatId, selectedChat)
        debugLog("ContextMenu", `Opened chat context menu for: ${chatId}`)
      }
      return
    }

    // Tab/Shift+Tab to cycle through filters in chats view
    if (key.name === "tab" && state.currentView === "chats" && !state.inputMode) {
      const filters: Array<"all" | "unread" | "favorites" | "groups"> = [
        "all",
        "unread",
        "favorites",
        "groups",
      ]
      const currentIndex = filters.indexOf(state.activeFilter)

      if (key.shift) {
        // Shift+Tab: previous filter
        const prevIndex = currentIndex === 0 ? filters.length - 1 : currentIndex - 1
        debugLog("Keyboard", `Filter: cycling backward to ${filters[prevIndex]}`)
        appState.setActiveFilter(filters[prevIndex])
      } else {
        // Tab: next filter
        const nextIndex = (currentIndex + 1) % filters.length
        debugLog("Keyboard", `Filter: cycling forward to ${filters[nextIndex]}`)
        appState.setActiveFilter(filters[nextIndex])
      }
      return
    }

    // Forward slash (/) to focus search in chats view
    if (key.name === "/" && state.currentView === "chats" && !state.inputMode) {
      debugLog("Keyboard", "Focusing search input")
      focusSearchInput()
      return
    }

    // Ctrl+F to focus search in chats view (alternative shortcut)
    if (key.name === "f" && key.ctrl && state.currentView === "chats" && !state.inputMode) {
      debugLog("Keyboard", "Focusing search input (Ctrl+F)")
      focusSearchInput()
      return
    }

    // Arrow key navigation
    if (key.name === "up") {
      if (state.currentView === "sessions" && state.sessions.length > 0) {
        const newIndex = Math.max(0, state.selectedSessionIndex - 1)
        debugLog(
          "Keyboard",
          `Sessions: UP - moving from ${state.selectedSessionIndex} to ${newIndex}`
        )
        appState.setSelectedSessionIndex(newIndex)
      } else if (state.currentView === "chats" && state.chats.length > 0) {
        // Use filtered chats for navigation bounds
        const filteredChats = getCurrentFilteredChats()
        if (filteredChats.length === 0) return
        const newIndex = Math.max(0, state.selectedChatIndex - 1)
        debugLog("Keyboard", `Chats: UP - moving from ${state.selectedChatIndex} to ${newIndex}`)
        // Calculate new scroll offset
        const newScrollOffset = calculateChatListScrollOffset(
          newIndex,
          state.chatListScrollOffset,
          filteredChats.length
        )
        appState.setState({
          selectedChatIndex: newIndex,
          chatListScrollOffset: newScrollOffset,
          lastChangeType: "selection",
        })
        return // Prevent ScrollBox from handling this key
      } else if (state.currentView === "conversation" && !state.inputMode) {
        // Scroll up (to older messages)
        debugLog("Keyboard", "Conversation: UP - scrolling up")
        scrollConversation(-4) // Scroll up by 4 units
        // Check if we should load older messages (scroll is near top)
        loadOlderMessages()
      }
    }

    if (key.name === "down") {
      if (state.currentView === "sessions" && state.sessions.length > 0) {
        const newIndex = Math.min(state.sessions.length - 1, state.selectedSessionIndex + 1)
        debugLog(
          "Keyboard",
          `Sessions: DOWN - moving from ${state.selectedSessionIndex} to ${newIndex}`
        )
        appState.setSelectedSessionIndex(newIndex)
      } else if (state.currentView === "chats" && state.chats.length > 0) {
        // Use filtered chats for navigation bounds
        const filteredChats = getCurrentFilteredChats()
        if (filteredChats.length === 0) return
        const newIndex = Math.min(filteredChats.length - 1, state.selectedChatIndex + 1)
        debugLog("Keyboard", `Chats: DOWN - from ${state.selectedChatIndex} to ${newIndex}`)
        // Calculate new scroll offset
        const newScrollOffset = calculateChatListScrollOffset(
          newIndex,
          state.chatListScrollOffset,
          filteredChats.length
        )
        appState.setState({
          selectedChatIndex: newIndex,
          chatListScrollOffset: newScrollOffset,
          lastChangeType: "selection",
        })
        return // Prevent ScrollBox from handling this key
      } else if (state.currentView === "conversation" && !state.inputMode) {
        // Scroll down (to newer messages)
        debugLog("Keyboard", "Conversation: DOWN - scrolling down")
        scrollConversation(4) // Scroll down by 4 units
      }
    }

    // Enter key - select current item
    if (key.name === "return" || key.name === "enter") {
      if (state.currentView === "sessions" && state.sessions.length > 0) {
        const selectedSession = state.sessions[state.selectedSessionIndex]
        if (selectedSession) {
          debugLog("App", `Selected session: ${selectedSession.name}`)
          appState.setCurrentSession(selectedSession.name)
          appState.setCurrentView("chats")
          appState.setSelectedChatIndex(0) // Reset chat selection
          await fetchMyProfile() // Fetch profile for "You" identification
          await loadChats()
          webSocketService.connect() // Ensure connected
        }
      } else if (state.currentView === "chats" && state.chats.length > 0) {
        // Handle search input focus
        if (state.inputMode) {
          appState.setInputMode(false)
          blurSearchInput()
        }

        // Use filtered chats to get the correct selected chat
        const filteredChats = getCurrentFilteredChats()
        const selectedChat = filteredChats[state.selectedChatIndex]
        if (selectedChat && state.currentSession) {
          // ChatSummary.id is typed as string but runtime returns an object with _serialized
          const chatId = getChatIdString(selectedChat.id)

          debugLog("App", `Selected chat: ${selectedChat.name || chatId}`)
          appState.setCurrentChat(chatId)
          // Destroy old scroll box before loading new messages
          destroyConversationScrollBox()
          // Load contacts in background to populate cache
          loadContacts()
          await loadMessages(chatId)
          // Start presence management (online/offline + re-subscribe)
          startPresenceManagement(chatId)
        }
      }
    }

    // HOME key - jump to first item
    if (key.name === "home") {
      if (state.currentView === "sessions" && state.sessions.length > 0) {
        debugLog("Keyboard", `Sessions: HOME - jumping to first session`)
        appState.setSelectedSessionIndex(0)
      } else if (state.currentView === "chats" && state.chats.length > 0) {
        debugLog("Keyboard", `Chats: HOME - jumping to first chat`)
        appState.setState({
          selectedChatIndex: 0,
          chatListScrollOffset: 0,
          lastChangeType: "selection",
        })
      }
      return // Prevent default ScrollBox behavior
    }

    // END key - jump to last item
    if (key.name === "end") {
      if (state.currentView === "sessions" && state.sessions.length > 0) {
        const lastIndex = state.sessions.length - 1
        debugLog("Keyboard", `Sessions: END - jumping to last session (${lastIndex})`)
        appState.setSelectedSessionIndex(lastIndex)
      } else if (state.currentView === "chats" && state.chats.length > 0) {
        const filteredChats = getCurrentFilteredChats()
        if (filteredChats.length === 0) return
        const lastIndex = filteredChats.length - 1
        debugLog("Keyboard", `Chats: END - jumping to last chat (${lastIndex})`)
        const newScrollOffset = calculateChatListScrollOffset(
          lastIndex,
          state.chatListScrollOffset,
          filteredChats.length
        )
        appState.setState({
          selectedChatIndex: lastIndex,
          chatListScrollOffset: newScrollOffset,
          lastChangeType: "selection",
        })
      }
      return // Prevent default ScrollBox behavior
    }

    // PAGE UP key - jump up by viewport height (~12 chats)
    if (key.name === "pageup" || key.name === "left") {
      if (state.currentView === "chats" && state.chats.length > 0) {
        const filteredChats = getCurrentFilteredChats()
        if (filteredChats.length === 0) return
        const pageSize = 12
        const newIndex = Math.max(0, state.selectedChatIndex - pageSize)
        debugLog(
          "Keyboard",
          `Chats: ${key.name.toUpperCase()} - jumping from ${state.selectedChatIndex} to ${newIndex} (page size: ${pageSize})`
        )
        const newScrollOffset = calculateChatListScrollOffset(
          newIndex,
          state.chatListScrollOffset,
          filteredChats.length
        )
        appState.setState({
          selectedChatIndex: newIndex,
          chatListScrollOffset: newScrollOffset,
          lastChangeType: "selection",
        })
        return // Prevent default ScrollBox behavior
      } else if (state.currentView === "conversation" && !state.inputMode) {
        debugLog("Keyboard", "Conversation: PAGE UP - scrolling up")
        scrollConversation(-20) // Scroll up by ~20 units (page)
      }
    }

    // PAGE DOWN key - jump down by viewport height (~12 chats)
    if (key.name === "pagedown" || key.name === "right") {
      if (state.currentView === "chats" && state.chats.length > 0) {
        const filteredChats = getCurrentFilteredChats()
        if (filteredChats.length === 0) return
        const pageSize = 12
        const newIndex = Math.min(filteredChats.length - 1, state.selectedChatIndex + pageSize)
        debugLog(
          "Keyboard",
          `Chats: ${key.name.toUpperCase()} - jumping from ${state.selectedChatIndex} to ${newIndex} (page size: ${pageSize})`
        )
        const newScrollOffset = calculateChatListScrollOffset(
          newIndex,
          state.chatListScrollOffset,
          filteredChats.length
        )
        appState.setState({
          selectedChatIndex: newIndex,
          chatListScrollOffset: newScrollOffset,
          lastChangeType: "selection",
        })
        return // Prevent default ScrollBox behavior
      } else if (state.currentView === "conversation" && !state.inputMode) {
        debugLog("Keyboard", "Conversation: PAGE DOWN - scrolling down")
        scrollConversation(20) // Scroll down by ~20 units (page)
      }
    }

    // Escape key - go back
    if (key.name === "escape") {
      // Close context menu first if open
      if (state.contextMenu?.visible) {
        appState.closeContextMenu()
        return
      }
      if (state.currentView === "conversation") {
        if (state.inputMode) {
          // Exit input mode
          blurMessageInput()
        } else {
          // Go back to chats
          stopPresenceManagement()
          appState.setCurrentView("chats")
          appState.setCurrentChat(null)
        }
      } else if (state.currentView === "chats") {
        if (state.inputMode) {
          // Exit search input mode
          blurSearchInput()
        } else if (state.showingArchivedChats) {
          // Exit archived view
          appState.setShowingArchivedChats(false)
        } else if (state.searchQuery) {
          // Clear search if there's a query
          clearSearchInput()
        } else {
          // Go back to sessions
          appState.setCurrentView("sessions")
        }
        appState.setSelectedSessionIndex(0) // Reset session selection
      }
    }

    // Ctrl+A / Meta+A - Toggle Archived View
    if (key.name === "a" && (key.meta || key.ctrl)) {
      if (state.currentView === "chats") {
        appState.setShowingArchivedChats(!state.showingArchivedChats)
      }
    }

    // Input mode handling for conversation view
    if (state.currentView === "conversation") {
      // Enter input mode
      if (key.name === "i" && !state.inputMode) {
        focusMessageInput()
      }
      // Note: Actual typing is handled by TextareaRenderable when focused
    }

    // Create new session (only in sessions view)
    if (key.name === "n") {
      if (state.currentView === "sessions") {
        // Create session with default name - user can customize later
        await createNewSession("default")
        await loadSessions() // Refresh to show new session
      }
    }

    // Navigate to sessions view
    if (key.name === "1" && !state.inputMode) {
      appState.setCurrentView("sessions")
      appState.setSelectedSessionIndex(0)
      await loadSessions()
    }

    // Navigate to chats view
    if (key.name === "2" && !state.inputMode) {
      if (state.currentSession) {
        appState.setCurrentView("chats")
        appState.setSelectedChatIndex(0)
        await loadChats()
      }
    }
  })
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
