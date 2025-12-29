#!/usr/bin/env bun
/**
 * WAHA TUI - Terminal User Interface for WhatsApp via WAHA
 */
import type { CliRenderer, KeyEvent } from "@opentui/core"

import { createCliRenderer } from "@opentui/core"

import type { WahaTuiConfig } from "./config/schema"
import {
  fetchMyProfile,
  getClient,
  initializeClient,
  loadChats,
  loadLidMappings,
  loadSessions,
  stopPresenceManagement,
  testConnection,
} from "./client"
import { UpdateAvailableModal } from "./components/Modal"
import { errorToToast } from "./components/Toast"
import { configExists, createDefaultConfig, loadConfig, saveConfig } from "./config/manager"
import { validateConfig } from "./config/schema"
import { executeContextMenuAction, handleKeyPress } from "./handlers"
import { loadSavedSettings } from "./handlers/settingsHandler"
import { createRenderApp } from "./router"
import { errorService } from "./services/ErrorService"
import { webSocketService } from "./services/WebSocketService"
import { appState } from "./state/AppState"
import { setRenderer } from "./state/RendererContext"
import { debugLog, initDebug } from "./utils/debug"
import { runMigrations } from "./utils/migrations"
import { checkForUpdates } from "./utils/update-checker"
import {
  ConfigView,
  destroyConfigInputs,
  getApiKeyInputValue,
  getUrlInputValue,
} from "./views/ConfigView"
import { showQRCode } from "./views/QRCodeView"

/**
 * Run the configuration wizard using the TUI
 * Returns when configuration is complete and saved
 */
async function runConfigWizard(renderer: CliRenderer): Promise<void> {
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

    // Declare cleanup function before use
    let removeKeyListener: () => void = () => {}

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
          appState.setConfigStep({ ...state.configStep, step: 3, status: "success" })

          // Wait a moment to show success, then resolve
          setTimeout(() => {
            destroyConfigInputs()
            removeKeyListener()
            unsubscribe()
            resolve()
          }, 1500)
        } else {
          appState.setConfigStep({
            ...state.configStep,
            step: 3,
            status: "error",
            errorMessage: "Could not connect to WAHA server",
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
        appState.setConfigStep({ ...state.configStep, step: 2, status: "input" })
      }
    }

    renderer.keyInput.on("keypress", handleErrorRetry)

    // Cleanup function to remove listeners
    removeKeyListener = () => {
      renderer.keyInput.off("keypress", handleErrorRetry)
    }

    // Cleanup on view change
    const unsubscribeViewChange = appState.subscribe((state) => {
      if (state.currentView !== "config") {
        destroyConfigInputs()
        removeKeyListener()
        unsubscribe()
        unsubscribeViewChange()
      }
    })
  })
}

async function main() {
  // Initialize debug logging
  initDebug()
  debugLog("App", "WAHA TUI starting...")

  // Register toast listener for error notifications
  errorService.subscribe((error) => {
    const toast = errorToToast(error)
    appState.showToast(toast.message, toast.type)
  })

  // Run migrations (e.g., move config from ~/.waha-tui to XDG location)
  await runMigrations()

  // Create renderer FIRST so we can use it for everything including config
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  // Set renderer context for imperative API usage
  setRenderer(renderer)

  // Cleanup function to properly restore terminal state
  let isCleanedUp = false
  const cleanup = () => {
    if (isCleanedUp) return
    isCleanedUp = true

    try {
      // Stop presence management
      stopPresenceManagement()

      // Disconnect WebSocket
      webSocketService.disconnect()

      // Destroy renderer to restore terminal state (disables mouse tracking, restores cursor, etc.)
      if (renderer && typeof renderer.destroy === "function") {
        renderer.destroy()
      }
    } catch (error) {
      debugLog("App", `Error during cleanup: ${error}`)
    }
  }

  // Register cleanup handlers for various exit scenarios
  process.on("exit", cleanup)
  process.on("SIGINT", () => {
    cleanup()
    process.exit(0)
  })
  process.on("SIGTERM", () => {
    cleanup()
    process.exit(0)
  })
  process.on("uncaughtException", (error) => {
    cleanup()
    console.error("Uncaught exception:", error)
    process.exit(1)
  })
  process.on("unhandledRejection", (reason) => {
    cleanup()
    console.error("Unhandled rejection:", reason)
    process.exit(1)
  })

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
    appState.setCurrentView("config")
    appState.setConfigStep({
      step: 1,
      wahaUrl: "http://localhost:3000",
      wahaApiKey: "",
      status: "input",
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
      appState.setWahaTier(versionInfo.tier)
      debugLog("App", `WAHA tier: ${versionInfo.tier}, version: ${versionInfo.version}`)
    }
  } catch (error) {
    debugLog("App", `Failed to fetch WAHA version: ${error}`)
  }

  // Load saved settings
  await loadSavedSettings()

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

  // Set up reactive rendering using the router module
  const renderApp = createRenderApp(renderer)

  // Subscribe to state changes
  appState.subscribe(() => {
    renderApp()
  })

  // Initial render (force rebuild)
  renderApp(true)

  // Check for updates
  try {
    const updateInfo = await checkForUpdates()
    if (updateInfo.updateAvailable) {
      UpdateAvailableModal({
        updateInfo: updateInfo,
        onDismiss: () => {
          renderApp(true)
        },
      })
    }
  } catch (error) {
    debugLog("Update", `Error checking for updates: ${error}`)
  }

  // Register context menu action callback for mouse clicks (must be before keypress handler)
  appState.setContextMenuActionCallback((actionId) => {
    const currentState = appState.getState()
    if (currentState.contextMenu) {
      void executeContextMenuAction(actionId, currentState.contextMenu)
    }
  })

  // Keyboard handling using OpenTUI's keyInput event system
  renderer.keyInput.on("keypress", async (key: KeyEvent) => {
    await handleKeyPress(key, { renderApp })
  })
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
