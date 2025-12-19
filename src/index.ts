#!/usr/bin/env bun
/**
 * WAHA TUI - Terminal User Interface for WhatsApp via WAHA
 */

import { Box, createCliRenderer, Text, type KeyEvent } from "@opentui/core"
import {
  loadConfig,
  saveConfig,
  configExists,
  createDefaultConfig,
  loadConfigFromEnv,
} from "./config/manager"
import { validateConfig } from "./config/schema"
import { initializeClient, testConnection } from "./client"
import { appState } from "./state/AppState"
import { Footer } from "./components/Footer"
import { deleteSession, logoutSession, SessionsView } from "./views/SessionsView"
import { loadSessions } from "./views/SessionsView"
import { loadChats } from "./views/ChatsView"
import {
  loadMessages,
  loadContacts,
  scrollConversation,
  destroyConversationScrollBox,
  loadOlderMessages,
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
import { pollingService } from "./services/PollingService"

async function promptConfig(): Promise<WahaTuiConfig> {
  console.log("\n📱 Welcome to WAHA TUI!\n")
  console.log("Let's set up your configuration.\n")

  // Try to load from environment first
  const envConfig = await loadConfigFromEnv()

  let wahaUrl = envConfig?.wahaUrl || ""
  let wahaApiKey = envConfig?.wahaApiKey || ""

  if (!wahaUrl) {
    wahaUrl =
      prompt("WAHA URL (default: http://localhost:3000):", "http://localhost:3000") ||
      "http://localhost:3000"
  } else {
    console.log(`✓ Using WAHA URL from .env: ${wahaUrl}`)
  }

  if (!wahaApiKey) {
    wahaApiKey = prompt("WAHA API Key:", "") || ""
  } else {
    console.log("✓ Using WAHA API Key from .env")
  }

  const config = createDefaultConfig(wahaUrl, wahaApiKey, {
    dashboardUsername: envConfig?.dashboardUsername,
    dashboardPassword: envConfig?.dashboardPassword,
    swaggerUsername: envConfig?.swaggerUsername,
    swaggerPassword: envConfig?.swaggerPassword,
  })

  // Validate configuration
  const errors = validateConfig(config)
  if (errors.length > 0) {
    console.error("\n❌ Configuration errors:")
    for (const error of errors) {
      console.error(`  - ${error}`)
    }
    process.exit(1)
  }

  // Test connection
  console.log("\n🔌 Testing connection to WAHA...")
  const connected = await testConnection(config)

  if (!connected) {
    console.error("❌ Failed to connect to WAHA server.")
    console.error("   Please check your WAHA URL and API key, and ensure the server is running.")
    process.exit(1)
  }

  console.log("✅ Connected to WAHA successfully!\n")

  // Save configuration
  await saveConfig(config)
  console.log(`💾 Configuration saved to ~/.waha-tui/config.json\n`)

  return config
}

async function main() {
  // Initialize debug logging
  initDebug()
  debugLog("App", "WAHA TUI starting...")

  let config: WahaTuiConfig | null = null

  // Check if config exists
  if (await configExists()) {
    config = await loadConfig()

    if (!config) {
      console.error("Failed to load configuration. Please check ~/.waha-tui/config.json")
      process.exit(1)
    }

    // Validate loaded config
    const errors = validateConfig(config)
    if (errors.length > 0) {
      console.error("Configuration is invalid:")
      for (const error of errors) {
        console.error(`  - ${error}`)
      }
      process.exit(1)
    }
  } else {
    // First run - prompt for configuration
    config = await promptConfig()
  }

  // Initialize WAHA client
  initializeClient(config)

  // Fetch WAHA version and tier info
  try {
    const client = (await import("./client")).getClient()
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
  const state = appState.getState()
  const workingSession = state.sessions.find((s) => s.status === "WORKING")

  if (workingSession) {
    // Session is already working, go directly to chats
    debugLog("App", `Found working session: ${workingSession.name}, switching to chats view`)
    appState.setCurrentSession(workingSession.name)
    appState.setCurrentView("chats")
    await loadChats(workingSession.name)
    pollingService.start(workingSession.name)
  } else {
    // No working session - show QR view for login
    debugLog("App", `No working session, showing QR login with session: ${DEFAULT_SESSION}`)
    appState.setCurrentSession(DEFAULT_SESSION)
    appState.setCurrentView("qr")
    // Trigger QR code loading
    const { showQRCode } = await import("./views/QRCodeView")
    await showQRCode(DEFAULT_SESSION)
  }

  // Create renderer
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  // Set renderer context for imperative API usage
  const { setRenderer } = await import("./state/RendererContext")
  setRenderer(renderer)

  // Import ChatListManager for optimized rendering
  const { chatListManager } = await import("./views/ChatListManager")

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

    debugLog("Render", `Full rebuild: lastChangeType=${state.lastChangeType}`)

    // Clear previous render - remove all children
    const children = renderer.root.getChildren()
    for (const child of children) {
      renderer.root.remove(child.id)
    }

    // Destroy chat list manager when leaving chats view
    if (state.currentView !== "chats" && state.currentView !== "conversation") {
      chatListManager.destroy()
    }

    // Main layout
    renderer.root.add(
      Box(
        { flexDirection: "column", flexGrow: 1 },

        // Main Content Area - WhatsApp Layout or Legacy Views
        Box(
          { flexGrow: 1 },
          state.currentView === "sessions"
            ? SessionsView()
            : state.currentView === "qr"
              ? QRCodeView()
              : state.currentView === "loading"
                ? LoadingView()
                : state.currentView === "chats" || state.currentView === "conversation"
                  ? MainLayout()
                  : Text({ content: `View: ${state.currentView} (Coming soon)` })
        ),

        // Footer with styled keyboard hints
        Footer()
      )
    )
  }

  // Subscribe to state changes
  appState.subscribe(() => {
    renderApp()
  })

  // Initial render (force rebuild)
  renderApp(true)

  // Keyboard handling using OpenTUI's keyInput event system
  renderer.keyInput.on("keypress", async (key: KeyEvent) => {
    // Debug log for keyboard input
    debugLog(
      "Keyboard",
      `Key: ${key.name} | Ctrl: ${key.ctrl} | Shift: ${key.shift} | Meta: ${key.meta}`
    )

    // Get latest state at the beginning of handler
    const state = appState.getState()

    // Quit (Ctrl+C only)
    if (key.name === "c" && key.ctrl) {
      process.exit(0)
    }

    // Refresh current view
    if (key.name === "r" && !state.inputMode) {
      if (state.currentView === "sessions") {
        await loadSessions()
      } else if (state.currentView === "chats" && state.currentSession) {
        await loadChats(state.currentSession)
      }
    }

    // Quit with 'q' key
    if (key.name === "q" && !state.inputMode) {
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
        const newIndex = Math.max(0, state.selectedChatIndex - 1)
        debugLog("Keyboard", `Chats: UP - moving from ${state.selectedChatIndex} to ${newIndex}`)
        // Calculate new scroll offset
        const newScrollOffset = calculateChatListScrollOffset(
          newIndex,
          state.chatListScrollOffset,
          state.chats.length
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
        const newIndex = Math.min(state.chats.length - 1, state.selectedChatIndex + 1)
        debugLog("Keyboard", `Chats: DOWN - from ${state.selectedChatIndex} to ${newIndex}`)
        // Calculate new scroll offset
        const newScrollOffset = calculateChatListScrollOffset(
          newIndex,
          state.chatListScrollOffset,
          state.chats.length
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
          await loadChats(selectedSession.name)
          pollingService.start(selectedSession.name)
        }
      } else if (state.currentView === "chats" && state.chats.length > 0) {
        const selectedChat = state.chats[state.selectedChatIndex]
        if (selectedChat && state.currentSession) {
          // ChatSummary.id is typed as string but runtime returns an object with _serialized
          const chatId =
            typeof selectedChat.id === "string"
              ? selectedChat.id
              : (selectedChat.id as { _serialized: string })._serialized

          debugLog("App", `Selected chat: ${selectedChat.name || chatId}`)
          appState.setCurrentChat(chatId)
          // Destroy old scroll box before loading new messages
          destroyConversationScrollBox()
          // Load contacts in background to populate cache
          loadContacts(state.currentSession)
          await loadMessages(state.currentSession, chatId)
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
        const lastIndex = state.chats.length - 1
        debugLog("Keyboard", `Chats: END - jumping to last chat (${lastIndex})`)
        const newScrollOffset = calculateChatListScrollOffset(
          lastIndex,
          state.chatListScrollOffset,
          state.chats.length
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
        const pageSize = 12
        const newIndex = Math.max(0, state.selectedChatIndex - pageSize)
        debugLog(
          "Keyboard",
          `Chats: ${key.name.toUpperCase()} - jumping from ${state.selectedChatIndex} to ${newIndex} (page size: ${pageSize})`
        )
        const newScrollOffset = calculateChatListScrollOffset(
          newIndex,
          state.chatListScrollOffset,
          state.chats.length
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
        const pageSize = 12
        const newIndex = Math.min(state.chats.length - 1, state.selectedChatIndex + pageSize)
        debugLog(
          "Keyboard",
          `Chats: ${key.name.toUpperCase()} - jumping from ${state.selectedChatIndex} to ${newIndex} (page size: ${pageSize})`
        )
        const newScrollOffset = calculateChatListScrollOffset(
          newIndex,
          state.chatListScrollOffset,
          state.chats.length
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
      if (state.currentView === "conversation") {
        if (state.inputMode) {
          // Exit input mode
          blurMessageInput()
        } else {
          // Go back to chats
          appState.setCurrentView("chats")
          appState.setCurrentChat(null)
        }
      } else if (state.currentView === "chats") {
        appState.setCurrentView("sessions")
        appState.setSelectedSessionIndex(0) // Reset session selection
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
        await loadChats(state.currentSession)
      }
    }
  })
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
