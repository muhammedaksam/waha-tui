/**
 * Configuration View
 * First-run configuration wizard with WhatsApp-style design
 */

import { Box, BoxRenderable, fg, t, Text, TextareaRenderable, TextAttributes } from "@opentui/core"

import { Logo } from "../components/Logo"
import { Icons, WhatsAppTheme } from "../config/theme"
import { appState } from "../state/AppState"
import { getRenderer } from "../state/RendererContext"

// Module-level textarea components
let urlInputComponent: TextareaRenderable | null = null
let apiKeyInputComponent: TextareaRenderable | null = null
let urlInputContainer: BoxRenderable | null = null
let apiKeyInputContainer: BoxRenderable | null = null

/**
 * Get the URL input value
 */
export function getUrlInputValue(): string {
  return urlInputComponent?.plainText || ""
}

/**
 * Get the API key input value
 */
export function getApiKeyInputValue(): string {
  return apiKeyInputComponent?.plainText || ""
}

/**
 * Focus the URL input
 */
export function focusUrlInput(): void {
  if (urlInputComponent) {
    urlInputComponent.focus()
  }
}

/**
 * Focus the API key input
 */
export function focusApiKeyInput(): void {
  if (apiKeyInputComponent) {
    apiKeyInputComponent.focus()
  }
}

/**
 * Destroy config inputs
 */
export function destroyConfigInputs(): void {
  if (urlInputComponent && !urlInputComponent.isDestroyed) {
    urlInputComponent.destroy()
    urlInputComponent = null
  }
  if (apiKeyInputComponent && !apiKeyInputComponent.isDestroyed) {
    apiKeyInputComponent.destroy()
    apiKeyInputComponent = null
  }
  urlInputContainer = null
  apiKeyInputContainer = null
}

/**
 * Configuration View Component
 * Shows a beautiful WhatsApp-style configuration wizard
 */
export function ConfigView() {
  const state = appState.getState()
  const renderer = getRenderer()
  const configStep = state.configStep || {
    step: 1,
    wahaUrl: "http://localhost:3000",
    wahaApiKey: "",
    status: "input",
  }

  const { step, status, errorMessage } = configStep

  // Step indicators
  const stepIndicator = (num: number, label: string) => {
    const isActive = step === num
    const isComplete = step > num
    const color = isComplete
      ? WhatsAppTheme.green
      : isActive
        ? WhatsAppTheme.white
        : WhatsAppTheme.textSecondary

    return Box(
      { flexDirection: "row", gap: 1 },
      Text({
        content: isComplete ? Icons.checkSingle : `${num}`,
        fg: color,
        attributes: isActive ? TextAttributes.BOLD : undefined,
      }),
      Text({
        content: label,
        fg: color,
        attributes: isActive ? TextAttributes.BOLD : undefined,
      })
    )
  }

  // Progress bar
  const progressBar = () => {
    const totalWidth = 30
    const filledWidth = Math.floor((step / 3) * totalWidth)
    const emptyWidth = totalWidth - filledWidth

    return Box(
      { flexDirection: "row" },
      Text({ content: "━".repeat(filledWidth), fg: WhatsAppTheme.green }),
      Text({ content: "━".repeat(emptyWidth), fg: WhatsAppTheme.textTertiary })
    )
  }

  // Current step content
  const stepContent = () => {
    if (status === "testing") {
      return Box(
        { flexDirection: "column", alignItems: "center", gap: 1 },
        Text({
          content: "Testing connection...",
          fg: WhatsAppTheme.textSecondary,
        }),
        Text({
          content: `Connecting to WAHA server...`,
          fg: WhatsAppTheme.textTertiary,
        })
      )
    }

    if (status === "success") {
      return Box(
        { flexDirection: "column", alignItems: "center", gap: 1 },
        Text({
          content: `${Icons.checkSingle} Connected successfully!`,
          fg: WhatsAppTheme.green,
          attributes: TextAttributes.BOLD,
        }),
        Text({
          content: "Configuration saved to ~/.waha-tui/config.json",
          fg: WhatsAppTheme.textSecondary,
        })
      )
    }

    if (status === "error") {
      return Box(
        { flexDirection: "column", alignItems: "center", gap: 1 },
        Text({
          content: "✗ Connection failed",
          fg: "#EA0038",
          attributes: TextAttributes.BOLD,
        }),
        Text({
          content: errorMessage || "Please check your settings and try again",
          fg: WhatsAppTheme.textSecondary,
        }),
        Box({ height: 1 }),
        Text({
          content: "Press Enter to retry",
          fg: WhatsAppTheme.textTertiary,
        })
      )
    }

    // Input mode - Step 1: URL
    if (step === 1) {
      // Create or update URL input
      if (!urlInputContainer) {
        urlInputContainer = new BoxRenderable(renderer, {
          id: "url-input-container",
          height: 3,
          width: 45,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 1,
          paddingRight: 1,
          backgroundColor: WhatsAppTheme.inputBg,
          border: true,
          borderColor: WhatsAppTheme.green,
        })
      }

      if (!urlInputComponent) {
        urlInputComponent = new TextareaRenderable(renderer, {
          id: "url-input",
          flexGrow: 1,
          height: 1,
          backgroundColor: WhatsAppTheme.inputBg,
          textColor: WhatsAppTheme.textPrimary,
          focusedBackgroundColor: WhatsAppTheme.inputBg,
          focusedTextColor: WhatsAppTheme.textPrimary,
          placeholder: t`${fg(WhatsAppTheme.textSecondary)("http://localhost:3000")}`,
          cursorColor: WhatsAppTheme.green,
          initialValue: configStep.wahaUrl,
          wrapMode: "none",
          keyBindings: [
            { name: "return", action: "submit" },
            { name: "linefeed", action: "submit" },
          ],
        })

        urlInputComponent.onSubmit = () => {
          // Move to step 2
          const url = urlInputComponent?.plainText || "http://localhost:3000"
          appState.setState({
            configStep: { ...configStep, wahaUrl: url, step: 2 },
          })
        }

        urlInputContainer.add(urlInputComponent)
        urlInputComponent?.focus()
        urlInputComponent?.gotoBufferEnd()
      }

      return Box(
        { flexDirection: "column", alignItems: "center", gap: 1 },
        Text({
          content: "WAHA Server URL",
          fg: WhatsAppTheme.white,
          attributes: TextAttributes.BOLD,
        }),
        Text({
          content: "Enter the URL where your WAHA server is running",
          fg: WhatsAppTheme.textSecondary,
        }),
        Box({ height: 1 }),
        urlInputContainer,
        Box({ height: 1 }),
        Text({
          content: "Press Enter to continue →",
          fg: WhatsAppTheme.textTertiary,
        })
      )
    }

    // Step 2: API Key
    if (step === 2) {
      // Destroy URL input if we moved past step 1
      if (urlInputComponent && !urlInputComponent.isDestroyed) {
        urlInputComponent.blur()
      }

      if (!apiKeyInputContainer) {
        apiKeyInputContainer = new BoxRenderable(renderer, {
          id: "apikey-input-container",
          height: 3,
          width: 45,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 1,
          paddingRight: 1,
          backgroundColor: WhatsAppTheme.inputBg,
          border: true,
          borderColor: WhatsAppTheme.green,
        })
      }

      if (!apiKeyInputComponent) {
        apiKeyInputComponent = new TextareaRenderable(renderer, {
          id: "apikey-input",
          flexGrow: 1,
          height: 1,
          backgroundColor: WhatsAppTheme.inputBg,
          textColor: WhatsAppTheme.textPrimary,
          focusedBackgroundColor: WhatsAppTheme.inputBg,
          focusedTextColor: WhatsAppTheme.textPrimary,
          placeholder: t`${fg(WhatsAppTheme.textSecondary)("Leave blank if not required")}`,
          cursorColor: WhatsAppTheme.green,
          initialValue: configStep.wahaApiKey,
          wrapMode: "none",
          keyBindings: [
            { name: "return", action: "submit" },
            { name: "linefeed", action: "submit" },
          ],
        })

        apiKeyInputComponent.onSubmit = () => {
          // Trigger connection test
          const apiKey = apiKeyInputComponent?.plainText || ""
          appState.setState({
            configStep: { ...configStep, wahaApiKey: apiKey, step: 3, status: "testing" },
          })
        }

        apiKeyInputContainer.add(apiKeyInputComponent)

        // Auto-focus
        setTimeout(() => apiKeyInputComponent?.focus(), 100)
      }

      return Box(
        { flexDirection: "column", alignItems: "center", gap: 1 },
        Text({
          content: "API Key (Optional)",
          fg: WhatsAppTheme.white,
          attributes: TextAttributes.BOLD,
        }),
        Text({
          content: "Enter your WAHA API key if authentication is enabled",
          fg: WhatsAppTheme.textSecondary,
        }),
        Box({ height: 1 }),
        apiKeyInputContainer,
        Box({ height: 1 }),
        Text({
          content: "Press Enter to test connection →",
          fg: WhatsAppTheme.textTertiary,
        })
      )
    }

    return null
  }

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: WhatsAppTheme.background,
    },

    // Top spacer
    Box({ flexGrow: 1 }),

    // Main content container
    Box(
      {
        flexDirection: "column",
        alignItems: "center",
        width: 50,
      },

      // Logo
      Logo({ color: WhatsAppTheme.green }),

      Box({ height: 1 }),

      // Tagline
      Text({
        content: "WhatsApp in your terminal",
        fg: WhatsAppTheme.textSecondary,
      }),

      Box({ height: 2 }),

      // Progress bar
      progressBar(),

      Box({ height: 1 }),

      // Step indicators
      Box(
        { flexDirection: "row", gap: 2 },
        stepIndicator(1, "Server"),
        stepIndicator(2, "API Key"),
        stepIndicator(3, "Connect")
      ),

      Box({ height: 2 }),

      // Current step content
      stepContent(),

      Box({ height: 2 }),

      // Footer
      Box(
        { flexDirection: "row" },
        Text({ content: `${Icons.lock} `, fg: WhatsAppTheme.textTertiary }),
        Text({
          content: "Configuration is stored locally",
          fg: WhatsAppTheme.textTertiary,
        })
      )
    ),

    // Bottom spacer
    Box({ flexGrow: 1 })
  )
}
