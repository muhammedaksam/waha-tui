/**
 * Authentication View
 * WhatsApp Web-style login page with QR code and phone number pairing option
 */

import { Box, Text, TextAttributes } from "@opentui/core"
import { appState } from "../state/AppState"
import { getQRCode } from "../utils/qr"
import { requestPairingCode } from "../utils/pairing"
import { WhatsAppTheme, Icons } from "../config/theme"
import QRCode from "qrcode"
import type { QRCode as QRCodeType } from "qrcode"
import { Logo } from "../components/Logo"
import { getClient, loadChats } from "../client"
import { debugLog } from "../utils/debug"
import { createNewSession } from "./SessionCreate"

// Module-level intervals for QR refresh and status checking
let qrRefreshInterval: NodeJS.Timeout | null = null
let statusCheckInterval: NodeJS.Timeout | null = null

// Current session name for pairing requests
let currentSessionName: string = ""

/**
 * Stop QR code auto-refresh and status checking
 */
export function stopQRRefresh(): void {
  if (qrRefreshInterval) {
    clearInterval(qrRefreshInterval)
    qrRefreshInterval = null
  }
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval)
    statusCheckInterval = null
  }
}

/**
 * Toggle between QR and phone authentication modes
 */
export function toggleAuthMode(): void {
  const state = appState.getState()
  const newMode = state.authMode === "qr" ? "phone" : "qr"
  appState.setState({
    authMode: newMode,
    pairingCode: null,
    pairingStatus: "idle",
    pairingError: null,
  })
  debugLog("Auth", `Switched to ${newMode} mode`)
}

/**
 * Handle phone number input character
 */
export function handlePhoneInput(char: string): void {
  const state = appState.getState()
  if (state.authMode !== "phone") return

  // Only allow digits
  if (/^\d$/.test(char)) {
    appState.setState({
      phoneNumber: state.phoneNumber + char,
      pairingError: null,
    })
  }
}

/**
 * Handle backspace in phone number input
 */
export function handlePhoneBackspace(): void {
  const state = appState.getState()
  if (state.authMode !== "phone") return

  if (state.phoneNumber.length > 0) {
    appState.setState({
      phoneNumber: state.phoneNumber.slice(0, -1),
      pairingError: null,
    })
  }
}

/**
 * Submit phone number and request pairing code
 */
export async function submitPhoneNumber(): Promise<void> {
  const state = appState.getState()
  if (state.authMode !== "phone") return
  if (state.pairingStatus === "requesting") return

  const phoneNumber = state.phoneNumber.trim()
  if (!phoneNumber || phoneNumber.length < 10) {
    appState.setState({
      pairingError: "Enter a valid phone number (10+ digits)",
      pairingStatus: "error",
    })
    return
  }

  appState.setState({ pairingStatus: "requesting", pairingError: null })

  const result = await requestPairingCode(currentSessionName, phoneNumber)

  if (result.success && result.code) {
    appState.setState({
      pairingCode: result.code,
      pairingStatus: "success",
      pairingError: null,
    })
  } else {
    appState.setState({
      pairingStatus: "error",
      pairingError: result.error || "Failed to get pairing code",
    })
  }
}

/**
 * Build QR code lines from matrix
 */
function buildQRLines(qrMatrix: QRCodeType): string[] {
  const qrLines: string[] = []
  const BLOCK_FULL = "█"
  const BLOCK_UPPER = "▀"
  const BLOCK_LOWER = "▄"
  const BLOCK_EMPTY = " "

  const padding = 4
  const modules = qrMatrix.modules

  // Top padding
  for (let i = 0; i < padding / 2; i++) {
    qrLines.push(BLOCK_FULL.repeat(modules.size + padding * 2))
  }

  // Render QR using half-blocks (2 rows per line)
  for (let y = 0; y < modules.size; y += 2) {
    let line = BLOCK_FULL.repeat(padding)

    for (let x = 0; x < modules.size; x++) {
      const upperPixel = modules.data[y * modules.size + x] === 1
      const lowerPixel =
        y + 1 < modules.size ? modules.data[(y + 1) * modules.size + x] === 1 : false

      if (upperPixel && lowerPixel) {
        line += BLOCK_FULL
      } else if (upperPixel && !lowerPixel) {
        line += BLOCK_UPPER
      } else if (!upperPixel && lowerPixel) {
        line += BLOCK_LOWER
      } else {
        line += BLOCK_EMPTY
      }
    }

    line += BLOCK_FULL.repeat(padding)
    qrLines.push(line)
  }

  // Bottom padding
  for (let i = 0; i < padding / 2; i++) {
    qrLines.push(BLOCK_FULL.repeat(modules.size + padding * 2))
  }

  return qrLines
}

/**
 * QR Mode Instructions Component
 */
function QRModeInstructions() {
  return Box(
    {
      flexDirection: "column",
      justifyContent: "center",
      width: "40%",
      paddingRight: 4,
    },
    Text({
      content: "Steps to log in",
      fg: WhatsAppTheme.textPrimary,
      attributes: TextAttributes.BOLD,
    }),
    Box({ height: 1 }),
    Box(
      { flexDirection: "row" },
      Text({ content: `${Icons.circled1} `, fg: WhatsAppTheme.textSecondary }),
      Text({
        content: `Open WhatsApp ${Icons.whatsapp} on your phone`,
        fg: WhatsAppTheme.textPrimary,
      })
    ),
    Box({ height: 1 }),
    Box(
      { flexDirection: "row" },
      Text({ content: `${Icons.circled2} `, fg: WhatsAppTheme.textSecondary }),
      Text({
        content: "On Android tap Menu ⋮ · On iPhone tap Settings ⚙",
        fg: WhatsAppTheme.textPrimary,
      })
    ),
    Box({ height: 1 }),
    Box(
      { flexDirection: "row" },
      Text({ content: `${Icons.circled3} `, fg: WhatsAppTheme.textSecondary }),
      Text({ content: "Tap Linked devices, then Link device", fg: WhatsAppTheme.textPrimary })
    ),
    Box({ height: 1 }),
    Box(
      { flexDirection: "row" },
      Text({ content: `${Icons.circled4} `, fg: WhatsAppTheme.textSecondary }),
      Text({ content: "Scan the QR code to confirm", fg: WhatsAppTheme.textPrimary })
    )
  )
}

/**
 * Phone Mode Input Component - WhatsApp Web style
 * Single centered column with phone input and back link
 */
function PhoneModeInstructions() {
  const state = appState.getState()

  return Box(
    {
      flexDirection: "column",
      alignItems: "center",
    },
    // Title
    Text({
      content: "Enter phone number",
      fg: WhatsAppTheme.textPrimary,
      attributes: TextAttributes.BOLD,
    }),
    // Subtitle
    Text({
      content: "Enter your phone number with country code",
      fg: WhatsAppTheme.textSecondary,
    }),
    Box({ height: 2 }),
    // Phone number input field
    Box(
      {
        flexDirection: "row",
        borderStyle: "rounded",
        borderColor: WhatsAppTheme.borderLight,
        paddingLeft: 2,
        paddingRight: 2,
        width: 30,
      },
      Text({
        content: `+${state.phoneNumber || ""}█`,
        fg: WhatsAppTheme.textPrimary,
      })
    ),
    Box({ height: 2 }),
    // Submit instruction (like "Next" button)
    Box(
      {
        backgroundColor: WhatsAppTheme.green,
        paddingLeft: 3,
        paddingRight: 3,
      },
      Text({
        content: "Press Enter",
        fg: WhatsAppTheme.white,
        attributes: TextAttributes.BOLD,
      })
    ),
    Box({ height: 2 }),
    // Back link
    Text({
      content: "Log in with QR code >",
      fg: WhatsAppTheme.green,
      attributes: TextAttributes.UNDERLINE,
    }),
    Text({
      content: "(Press Q to switch)",
      fg: WhatsAppTheme.textTertiary,
    }),

    // Error message
    ...(state.pairingError
      ? [
          Box({ height: 1 }),
          Text({
            content: state.pairingError,
            fg: "#ff6b6b",
          }),
        ]
      : [])
  )
}

/**
 * QR Code Display with phone number link below
 */
function QRCodeDisplay() {
  const state = appState.getState()
  const qrMatrix = state.qrCodeMatrix

  if (!qrMatrix) {
    return Box(
      {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      },
      Text({
        content: "Loading QR code...",
        fg: WhatsAppTheme.textSecondary,
      })
    )
  }

  const qrLines = buildQRLines(qrMatrix)

  return Box(
    {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    // QR Code
    ...qrLines.map((line) =>
      Text({
        content: line,
        fg: WhatsAppTheme.green,
      })
    ),
    // Spacing
    Box({ height: 1 }),
    // "Log in with phone number" link - like WhatsApp Web
    Text({
      content: "Log in with phone number >",
      fg: WhatsAppTheme.green,
      attributes: TextAttributes.UNDERLINE,
    }),
    Text({
      content: "(Press P to switch)",
      fg: WhatsAppTheme.textTertiary,
    })
  )
}

/**
 * Pairing Code Display Component - WhatsApp Web style
 * Single column layout with code at top and instructions below
 */
function PairingCodeDisplay() {
  const state = appState.getState()

  if (state.pairingStatus === "requesting") {
    return Box(
      {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
      },
      Text({
        content: "Requesting pairing code...",
        fg: WhatsAppTheme.textSecondary,
      })
    )
  }

  if (state.pairingStatus === "success" && state.pairingCode) {
    // Split code into characters for individual box display
    const codeChars = state.pairingCode.split("")

    return Box(
      {
        flexDirection: "column",
        alignItems: "center",
      },
      // Title
      Text({
        content: "Enter code on phone",
        fg: WhatsAppTheme.textPrimary,
        attributes: TextAttributes.BOLD,
      }),
      // Subtitle with phone number
      Text({
        content: `Linking WhatsApp account +${state.phoneNumber}`,
        fg: WhatsAppTheme.textSecondary,
      }),
      Box({ height: 2 }),
      // Code display - each character in its own box
      Box(
        {
          flexDirection: "row",
          borderStyle: "rounded",
          borderColor: WhatsAppTheme.borderLight,

          padding: 1,
          paddingLeft: 2,
          paddingRight: 2,
        },
        Box(
          { flexDirection: "row", gap: 1 },
          ...codeChars.map((char) =>
            char === "-"
              ? Box(
                  {
                    borderColor: WhatsAppTheme.background,
                    paddingLeft: 1,
                    paddingRight: 1,
                  },
                  Text({ content: "-", fg: WhatsAppTheme.textSecondary })
                )
              : Box(
                  {
                    borderStyle: "rounded",
                    borderColor: WhatsAppTheme.borderLight,
                    paddingLeft: 1,
                    paddingRight: 1,
                  },
                  Text({
                    content: char,
                    fg: WhatsAppTheme.textPrimary,
                    attributes: TextAttributes.BOLD,
                  })
                )
          )
        )
      ),
      Box({ height: 2 }),
      // Instructions - numbered steps
      Box(
        { flexDirection: "column", alignItems: "flex-start" },
        Box(
          { flexDirection: "row" },
          Text({ content: `${Icons.circled1} `, fg: WhatsAppTheme.textSecondary }),
          Text({
            content: `Open WhatsApp ${Icons.whatsapp} on your phone`,
            fg: WhatsAppTheme.textPrimary,
          })
        ),
        Box({ height: 1 }),
        Box(
          { flexDirection: "row" },
          Text({ content: `${Icons.circled2} `, fg: WhatsAppTheme.textSecondary }),
          Text({
            content: "On Android tap Menu ⋮ · On iPhone tap Settings ⚙",
            fg: WhatsAppTheme.textPrimary,
          })
        ),
        Box({ height: 1 }),
        Box(
          { flexDirection: "row" },
          Text({ content: `${Icons.circled3} `, fg: WhatsAppTheme.textSecondary }),
          Text({ content: "Tap Linked devices, then Link device", fg: WhatsAppTheme.textPrimary })
        ),
        Box({ height: 1 }),
        Box(
          { flexDirection: "row" },
          Text({ content: `${Icons.circled4} `, fg: WhatsAppTheme.textSecondary }),
          Text({
            content: "Tap Link with phone number instead and enter this code",
            fg: WhatsAppTheme.textPrimary,
          })
        )
      ),
      Box({ height: 2 }),
      // Back link
      Text({
        content: "Log in with QR code >",
        fg: WhatsAppTheme.green,
        attributes: TextAttributes.UNDERLINE,
      }),
      Text({
        content: "(Press Q to switch)",
        fg: WhatsAppTheme.textTertiary,
      })
    )
  }

  // Default: waiting for input - show prompt to enter phone number
  return Box(
    {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 2,
    },
    Text({
      content: "Enter your phone number",
      fg: WhatsAppTheme.textSecondary,
    }),
    Box({ height: 1 }),
    Text({
      content: "and press Enter",
      fg: WhatsAppTheme.textSecondary,
    }),
    Box({ height: 2 }),
    Text({
      content: "< Back to QR code",
      fg: WhatsAppTheme.green,
      attributes: TextAttributes.UNDERLINE,
    }),
    Text({
      content: "(Press Q to switch)",
      fg: WhatsAppTheme.textTertiary,
    })
  )
}

/**
 * Authentication View Component (QR Code or Phone Pairing)
 */
export function QRCodeView() {
  const state = appState.getState()
  const isPhoneMode = state.authMode === "phone"

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: WhatsAppTheme.background,
    },

    // Header with WhatsApp branding
    Box(
      {
        height: 3,
        width: "100%",
        paddingLeft: 2,
        alignItems: "center",
        flexDirection: "row",
      },
      Logo({ color: WhatsAppTheme.green })
    ),

    // Main content area
    Box(
      {
        flexDirection: "row",
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 2,
      },

      Box(
        {
          flexDirection: isPhoneMode ? "column" : "row",
          borderStyle: "rounded",
          justifyContent: "center",
          alignItems: "center",
          borderColor: WhatsAppTheme.borderLight,
          padding: 3,
          paddingLeft: 4,
          paddingRight: 4,
        },

        ...(isPhoneMode
          ? [
              state.pairingStatus === "success" && state.pairingCode
                ? PairingCodeDisplay()
                : PhoneModeInstructions(),
            ]
          : [QRModeInstructions(), QRCodeDisplay()])
      )
    ),

    // Footer
    Box(
      {
        height: 2,
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
      },
      Text({
        content: `${Icons.lock} Your personal messages are end-to-end encrypted`,
        fg: WhatsAppTheme.textSecondary,
      })
    )
  )
}

/**
 * Load QR code data and show QR view
 */
export async function showQRCode(name: string): Promise<void> {
  // Stop any existing refresh intervals
  stopQRRefresh()

  // Store session name for pairing requests
  currentSessionName = name

  // Reset auth state
  appState.setState({
    authMode: "qr",
    phoneNumber: "",
    pairingCode: null,
    pairingStatus: "idle",
    pairingError: null,
  })

  const client = getClient()

  // Helper function to wait for session to be ready (SCAN_QR_CODE state)
  // Uses sessionsControllerList to find the session, as GET may return 404 for newly created sessions
  const waitForSessionReady = async (maxWaitMs: number = 30000): Promise<boolean> => {
    const startTime = Date.now()
    const pollInterval = 1000 // 1 second

    while (Date.now() - startTime < maxWaitMs) {
      try {
        // Use list endpoint to find session - more reliable for newly created sessions
        const { data: sessions } = await client.sessions.sessionsControllerList({ all: true })
        const session = sessions.find((s) => s.name === name)

        if (!session) {
          debugLog("QR", "Session not found in list yet, waiting...")
          await new Promise((resolve) => setTimeout(resolve, pollInterval))
          continue
        }

        debugLog("QR", `Waiting for session... status: ${session.status}`)

        if (session.status === "SCAN_QR_CODE") {
          debugLog("QR", "Session is ready for QR scan")
          return true
        } else if (session.status === "WORKING") {
          debugLog("QR", "Session became WORKING while waiting")
          appState.setCurrentSession(name)
          appState.setCurrentView("loading")
          await loadChats()
          appState.setCurrentView("chats")
          return false // Don't continue with QR flow
        } else if (session.status === "FAILED") {
          debugLog("QR", "Session failed while waiting")
          return false
        }
      } catch (error) {
        debugLog("QR", `Error checking sessions: ${error}`)
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    debugLog("QR", "Timeout waiting for session to be ready")
    return false
  }

  // Check current session status and recover if needed
  let needsWait = false
  try {
    const { data: session } = await client.sessions.sessionsControllerGet(name)
    debugLog("QR", `Initial session status: ${session.status}`)

    // If session is FAILED or STOPPED, we need to restart it
    if (session.status === "FAILED" || session.status === "STOPPED") {
      debugLog("QR", `Session is ${session.status}, restarting...`)

      // Try to logout first (ignore errors)
      try {
        await client.sessions.sessionsControllerLogout(name)
        debugLog("QR", "Logged out from failed session")
      } catch {
        debugLog("QR", "Logout failed (session may not have been authenticated)")
      }

      // Delete and recreate the session
      try {
        await client.sessions.sessionsControllerDelete(name)
        debugLog("QR", "Deleted failed session")
      } catch {
        debugLog("QR", "Delete failed (continuing anyway)")
      }

      // Create fresh session
      await createNewSession(name)
      debugLog("QR", "Created fresh session, waiting for it to be ready...")
      needsWait = true
    } else if (session.status === "STARTING") {
      debugLog("QR", "Session is STARTING, waiting for it to be ready...")
      needsWait = true
    } else if (session.status === "WORKING") {
      // Session is already working, go to chats
      debugLog("QR", "Session already WORKING, navigating to chats")
      appState.setCurrentSession(name)
      appState.setCurrentView("loading")
      await loadChats()
      appState.setCurrentView("chats")
      return
    }
  } catch (error) {
    // Session doesn't exist, create it
    debugLog("QR", `Session check failed, creating new session: ${error}`)
    try {
      await createNewSession(name)
      debugLog("QR", "Created new session, waiting for it to be ready...")
      needsWait = true
    } catch {
      debugLog("QR", "Failed to create session (may already exist)")
    }
  }

  // Wait for session to be ready if needed
  if (needsWait) {
    const isReady = await waitForSessionReady()
    if (!isReady) {
      debugLog("QR", "Session not ready, cannot show QR code")
      // Still show the QR view with "Loading..." message
    }
  }

  const QR_REFRESH_INTERVAL = 15000 // 15 seconds

  // Function to check session status (called every 1s)
  const checkStatus = async () => {
    // Only check if still on QR view
    if (appState.getState().currentView !== "qr") {
      stopQRRefresh()
      return
    }

    try {
      const client = getClient()

      // Check session status
      const { data: session } = await client.sessions.sessionsControllerGet(name)

      // Double-check view hasn't changed while we were waiting for API response
      // (another status check might have already detected login)
      if (appState.getState().currentView !== "qr") {
        return
      }

      debugLog("QR", `Session ${name} status: ${session.status}`)

      // Check if login was successful
      if (session.status === "WORKING") {
        debugLog("QR", "Session is now WORKING - login successful!")
        stopQRRefresh()

        // Show loading screen
        appState.setCurrentSession(name)
        appState.setCurrentView("loading")

        // Load chats in background
        await loadChats()

        // Navigate to chats after loading
        appState.setCurrentView("chats")
        return
      }

      // Check if session is no longer in QR scan mode
      if (session.status !== "SCAN_QR_CODE") {
        debugLog("QR", `Session status changed to ${session.status} - stopping QR refresh`)
        stopQRRefresh()
        return
      }
    } catch (error) {
      debugLog("QR", `Failed to check session status: ${error}`)
    }
  }

  // Function to load/refresh QR code (called every 15s)
  const loadQR = async (isInitialLoad: boolean = false) => {
    // Only refresh if still on QR view and in QR mode
    const state = appState.getState()
    if (state.currentView !== "qr" || state.authMode !== "qr") {
      return
    }

    try {
      // Get raw QR data
      const qrValue = await getQRCode(name)
      if (!qrValue) {
        return
      }

      // Generate QR matrix
      const matrix: QRCodeType = QRCode.create(qrValue, { errorCorrectionLevel: "M" })

      // Store in app state
      appState.setState({
        ...appState.getState(),
        qrCodeMatrix: matrix,
        currentView: "qr",
      })
    } catch (error) {
      debugLog("QR", `Failed to load QR code: ${error}`)
      if (isInitialLoad) {
        console.error("Failed to load QR code:", error)
      }
    }
  }

  // Initial load
  await loadQR(true)

  // Set up status check every 1 second (fast detection of login)
  statusCheckInterval = setInterval(() => {
    void checkStatus()
  }, 1000)

  // Set up QR refresh every 15 seconds
  qrRefreshInterval = setInterval(() => {
    void loadQR(false)
  }, QR_REFRESH_INTERVAL)
}
