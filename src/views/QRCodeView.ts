/**
 * Authentication View
 * WhatsApp Web-style login page with QR code and phone number pairing option
 */

import { Box, h, Text, TextAttributes } from "@opentui/core"
import { ErrorCorrectionLevel, QRCodeRenderable } from "@opentui/qrcode"

import { getClient, loadChats } from "~/client"
import { Logo } from "~/components/Logo"
import { Icons, WhatsAppTheme } from "~/config/theme"
import { TIME_MS } from "~/constants"
import { appState } from "~/state/AppState"
import { getRenderer } from "~/state/RendererContext"
import { debugLog } from "~/utils/debug"
import { getQRCode, requestPairingCode } from "~/utils/pairing"
import { createNewSession } from "~/views/SessionCreate"

// Module-level intervals for QR refresh and status checking
let qrRefreshInterval: NodeJS.Timeout | null = null
let statusCheckInterval: NodeJS.Timeout | null = null

// Current session name for pairing requests
let currentSessionName: string = ""

/**
 * Get current terminal dimensions safely
 */
function getTerminalDimensions(): { width: number; height: number } {
  try {
    const renderer = getRenderer()
    const width = renderer.width || renderer.terminalWidth || 120
    const height = renderer.height || renderer.terminalHeight || 45
    return { width, height }
  } catch {
    return { width: 120, height: 45 }
  }
}

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
 * Switch between QR code and phone number pairing modes
 */
export function toggleAuthMode(): void {
  const currentMode = appState.getState().authMode
  const nextMode = currentMode === "qr" ? "phone" : "qr"
  appState.setAuthMode(nextMode)
  appState.setPairingError(null)
  debugLog("Auth", `Switched auth mode to: ${nextMode}`)
}

/**
 * Handle digit input for phone number
 */
export function handlePhoneInput(char: string): void {
  if (!/^\d$/.test(char)) return

  const currentNumber = appState.getState().phoneNumber
  if (currentNumber.length < 15) {
    appState.setPhoneNumber(currentNumber + char)
  }
}

/**
 * Handle backspace for phone number
 */
export function handlePhoneBackspace(): void {
  const currentNumber = appState.getState().phoneNumber
  if (currentNumber.length > 0) {
    appState.setPhoneNumber(currentNumber.slice(0, -1))
  }
}

/**
 * Submit phone number for pairing code
 */
export async function submitPhoneNumber(): Promise<void> {
  const state = appState.getState()
  const phoneNumber = state.phoneNumber

  if (!phoneNumber || phoneNumber.length < 10) {
    appState.setPairingError("Please enter a valid phone number (at least 10 digits)")
    appState.setPairingStatus("error")
    return
  }

  appState.setPairingStatus("requesting")
  appState.setPairingError(null)

  const result = await requestPairingCode(currentSessionName, phoneNumber)

  if (result.success && result.code) {
    appState.setPairingCode(result.code)
    appState.setPairingStatus("success")
    appState.setPairingError(null)
  } else {
    appState.setPairingStatus("error")
    appState.setPairingError(result.error || "Failed to get pairing code")
  }
}

/**
 * QR Mode Instructions Component
 */
function QRModeInstructions(compact: boolean = false) {
  if (compact) {
    return Box(
      {
        flexDirection: "column",
        justifyContent: "center",
        width: 28,
        paddingRight: 1,
      },
      Text({
        content: "Steps to log in",
        fg: WhatsAppTheme.textPrimary,
        attributes: TextAttributes.BOLD,
      }),
      Box({ height: 1 }),
      Text({ content: `${Icons.circled1} Open WhatsApp 📱`, fg: WhatsAppTheme.textPrimary }),
      Text({ content: "  on your phone", fg: WhatsAppTheme.textSecondary }),
      Box({ height: 1 }),
      Text({ content: `${Icons.circled2} Menu ⋮ or`, fg: WhatsAppTheme.textPrimary }),
      Text({ content: "  Settings ⚙", fg: WhatsAppTheme.textSecondary }),
      Box({ height: 1 }),
      Text({ content: `${Icons.circled3} Linked devices`, fg: WhatsAppTheme.textPrimary }),
      Text({ content: "  > Link a device", fg: WhatsAppTheme.textSecondary }),
      Box({ height: 1 }),
      Text({ content: `${Icons.circled4} Scan QR code`, fg: WhatsAppTheme.textPrimary })
    )
  }

  return Box(
    {
      flexDirection: "column",
      justifyContent: "center",
      width: "38%",
      paddingRight: 3,
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
function QRCodeDisplay(compact: boolean = false) {
  const state = appState.getState()
  const qrCode = state.qrCode ?? state.qrCodeMatrix

  if (!qrCode) {
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

  return Box(
    {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    // QR Code
    h(QRCodeRenderable, {
      content: qrCode,
      errorCorrectionLevel: ErrorCorrectionLevel.M,
      quietZone: 4,
      scale: 1,
      fit: "contain",
      foregroundColor: "#000000",
      backgroundColor: "#ffffff",
      fallbackContent: "Terminal too small for QR",
      fallbackColor: WhatsAppTheme.textSecondary,
    }),
    // Spacing and link
    ...(compact
      ? [
          Text({
            content: "Log in with phone number (Press P) >",
            fg: WhatsAppTheme.green,
            attributes: TextAttributes.UNDERLINE,
          }),
        ]
      : [
          Box({ height: 1 }),
          Text({
            content: "Log in with phone number >",
            fg: WhatsAppTheme.green,
            attributes: TextAttributes.UNDERLINE,
          }),
          Text({
            content: "(Press P to switch)",
            fg: WhatsAppTheme.textTertiary,
          }),
        ])
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
  const { width: termWidth, height: termHeight } = getTerminalDimensions()

  const isLarge = termWidth >= 120 && termHeight >= 46
  const isMedium = termWidth >= 98 && termHeight >= 39
  const isTooSmall = termWidth < 72 || termHeight < 39

  // Header with WhatsApp branding
  const header = isLarge
    ? Box(
        {
          height: 3,
          width: "100%",
          paddingLeft: 2,
          alignItems: "center",
          flexDirection: "row",
        },
        Logo({ color: WhatsAppTheme.green })
      )
    : Box(
        {
          height: 1,
          width: "100%",
          paddingLeft: 2,
          alignItems: "center",
          flexDirection: "row",
        },
        Text({
          content: `${Icons.whatsapp} WhatsApp Web Login`,
          fg: WhatsAppTheme.green,
          attributes: TextAttributes.BOLD,
        })
      )

  // Determine main inner card contents
  let innerContent: ReturnType<typeof Box>[]
  if (isPhoneMode) {
    innerContent = [
      state.pairingStatus === "success" && state.pairingCode
        ? PairingCodeDisplay()
        : PhoneModeInstructions(),
    ]
  } else if (isTooSmall) {
    innerContent = [
      Box(
        {
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 1,
        },
        Text({
          content: "Terminal too small for QR code",
          fg: WhatsAppTheme.textPrimary,
          attributes: TextAttributes.BOLD,
        }),
        Box({ height: 1 }),
        Text({
          content: `Requires at least 72x39 (current: ${termWidth}x${termHeight})`,
          fg: WhatsAppTheme.textSecondary,
        }),
        Box({ height: 1 }),
        Text({
          content: "Please resize your terminal or press P for phone login",
          fg: WhatsAppTheme.textSecondary,
        }),
        Box({ height: 1 }),
        Text({
          content: "Log in with phone number (Press P) >",
          fg: WhatsAppTheme.green,
          attributes: TextAttributes.UNDERLINE,
        })
      ),
    ]
  } else if (isLarge) {
    innerContent = [QRModeInstructions(false), QRCodeDisplay(false)]
  } else if (isMedium) {
    // Medium desktop (e.g. 103x43): compact side-by-side
    innerContent = [QRModeInstructions(true), QRCodeDisplay(true)]
  } else {
    // Narrow but tall enough (72 <= width < 98, height >= 39): stacked layout
    innerContent = [
      Box(
        {
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        },
        Text({
          content: "Open WhatsApp > Linked devices > Link a device",
          fg: WhatsAppTheme.textSecondary,
        }),
        Box({ height: 1 }),
        QRCodeDisplay(true)
      ),
    ]
  }

  // Inner card box
  const innerCard = Box(
    {
      flexDirection: isPhoneMode || isTooSmall || (!isLarge && !isMedium) ? "column" : "row",
      borderStyle: "rounded",
      justifyContent: "center",
      alignItems: "center",
      borderColor: WhatsAppTheme.borderLight,
      padding: isLarge ? 2 : 0,
      paddingLeft: isLarge ? 3 : 1,
      paddingRight: isLarge ? 3 : 1,
    },
    ...innerContent
  )

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: WhatsAppTheme.background,
    },
    header,
    Box(
      {
        flexDirection: "row",
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: isLarge ? 1 : 0,
      },
      innerCard
    ),
    // Footer only displayed when there is adequate vertical space
    ...(isLarge
      ? [
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
          ),
        ]
      : [])
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
  appState.setAuthMode("qr")
  appState.setPhoneNumber("")
  appState.setPairingCode(null)
  appState.setPairingStatus("idle")
  appState.setPairingError(null)
  appState.setQrCode(null)

  const client = getClient()

  // Helper function to wait for session to be ready (SCAN_QR_CODE state)
  // Uses sessionsControllerList to find the session, as GET may return 404 for newly created sessions
  const waitForSessionReady = async (
    maxWaitMs: number = TIME_MS.QR_SESSION_READY_MAX_WAIT
  ): Promise<boolean> => {
    const startTime = Date.now()
    const pollInterval = TIME_MS.QR_SESSION_READY_POLL_INTERVAL

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

  const QR_REFRESH_INTERVAL = TIME_MS.QR_REFRESH_INTERVAL

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

        // Keep loading screen visible for smooth transition
        await new Promise((resolve) => setTimeout(resolve, 1500))

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

      // Store in app state
      appState.setQrCode(qrValue)
      appState.setCurrentView("qr")
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
  }, TIME_MS.QR_STATUS_CHECK_INTERVAL)

  // Set up QR refresh every 15 seconds
  qrRefreshInterval = setInterval(() => {
    void loadQR(false)
  }, QR_REFRESH_INTERVAL)
}
