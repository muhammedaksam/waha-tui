#!/usr/bin/env bun
/**
 * WAHA TUI - Terminal User Interface for WhatsApp via WAHA
 */

import { Box, createCliRenderer, Text, ASCIIFont, type KeyEvent } from "@opentui/core"
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
import { StatusBar } from "./components/StatusBar"
import { Footer } from "./components/Footer"
import { SessionsView, loadSessions } from "./views/SessionsView"
import { loadChats } from "./views/ChatsView"
import { createNewSession } from "./views/SessionCreate"
import { QRCodeView } from "./views/QRCodeView"
import { MainLayout } from "./views/MainLayout"
import type { WahaTuiConfig } from "./config/schema"
import { initDebug, debugLog } from "./utils/debug"

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

  // Load initial sessions
  await loadSessions()

  // Auto-switch to chats view if we have a working session
  const state = appState.getState()
  if (state.sessions.length > 0) {
    const workingSession = state.sessions.find((s) => s.status === "WORKING")
    if (workingSession) {
      debugLog("App", `Found working session: ${workingSession.name}, switching to chats view`)
      appState.setCurrentSession(workingSession.name)
      appState.setCurrentView("chats")
      await loadChats(workingSession.name)
    }
  }

  // Create renderer
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  // Set up reactive rendering
  function renderApp() {
    const state = appState.getState()

    // Clear previous render - remove all children
    const children = renderer.root.getChildren()
    for (const child of children) {
      renderer.root.remove(child.id)
    }

    // Main layout
    renderer.root.add(
      Box(
        { flexDirection: "column", flexGrow: 1 },

        // Header
        Box(
          { height: 3, flexDirection: "column", justifyContent: "center", alignItems: "center" },
          ASCIIFont({ font: "tiny", text: "WAHA TUI" })
        ),

        // Status Bar
        StatusBar(),

        Box({ height: 1 }),

        // Main Content Area - WhatsApp Layout or Legacy Views
        Box(
          { flexGrow: 1 },
          state.currentView === "sessions"
            ? SessionsView()
            : state.currentView === "qr"
              ? QRCodeView()
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

  // Initial render
  renderApp()

  // Keyboard handling using OpenTUI's keyInput event system
  renderer.keyInput.on("keypress", async (key: KeyEvent) => {
    // Debug log for keyboard input
    debugLog(
      "Keyboard",
      `Key: ${key.name} | Ctrl: ${key.ctrl} | Shift: ${key.shift} | Meta: ${key.meta}`
    )

    // Quit
    if ((key.name === "q" && !key.ctrl && !key.shift) || (key.name === "c" && key.ctrl)) {
      process.exit(0)
    }

    // Refresh current view
    if (key.name === "r") {
      const state = appState.getState()
      if (state.currentView === "sessions") {
        await loadSessions()
      } else if (state.currentView === "chats" && state.currentSession) {
        await loadChats(state.currentSession)
      }
    }

    const state = appState.getState()

    // Arrow key navigation
    if (key.name === "up") {
      if (state.currentView === "sessions" && state.sessions.length > 0) {
        const newIndex = Math.max(0, state.selectedSessionIndex - 1)
        appState.setSelectedSessionIndex(newIndex)
      } else if (state.currentView === "chats" && state.chats.length > 0) {
        const newIndex = Math.max(0, state.selectedChatIndex - 1)
        appState.setSelectedChatIndex(newIndex)
      }
    }

    if (key.name === "down") {
      if (state.currentView === "sessions" && state.sessions.length > 0) {
        const newIndex = Math.min(state.sessions.length - 1, state.selectedSessionIndex + 1)
        appState.setSelectedSessionIndex(newIndex)
      } else if (state.currentView === "chats" && state.chats.length > 0) {
        const newIndex = Math.min(state.chats.length - 1, state.selectedChatIndex + 1)
        appState.setSelectedChatIndex(newIndex)
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
        }
      } else if (state.currentView === "chats" && state.chats.length > 0) {
        const selectedChat = state.chats[state.selectedChatIndex]
        if (selectedChat) {
          debugLog("App", `Selected chat object: ${JSON.stringify(selectedChat)}`)
          debugLog("App", `Selected chat ID: ${selectedChat.id}`)
          appState.setCurrentChat(selectedChat.id)
          // Conversation view will be implemented later
        }
      }
    }

    // Escape key - go back
    if (key.name === "escape") {
      if (state.currentView === "conversation") {
        appState.setCurrentView("chats")
        appState.setCurrentChat(null)
      } else if (state.currentView === "chats") {
        appState.setCurrentView("sessions")
        appState.setSelectedSessionIndex(0) // Reset session selection
      }
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
    if (key.name === "1") {
      appState.setCurrentView("sessions")
      appState.setSelectedSessionIndex(0)
      await loadSessions()
    }

    // Navigate to chats view
    if (key.name === "2") {
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
