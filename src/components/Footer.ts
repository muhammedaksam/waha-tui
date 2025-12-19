/**
 * Footer Component
 * Styled keyboard shortcuts and version info
 */

import { Box, Text, TextNodeRenderable } from "@opentui/core"
import { WhatsAppTheme } from "../config/theme"
import { appState } from "../state/AppState"
import { getVersion } from "../config/version"

interface KeyHint {
  key: string
  label: string
  keyColor?: string
}

export function Footer() {
  const state = appState.getState()

  // Dynamic hints based on current view
  const hints: KeyHint[] = []

  if (state.currentView === "sessions") {
    hints.push(
      { key: "↑↓", label: "Navigate" },
      { key: "Enter", label: "Select" },
      { key: "n", label: "New Session" },
      { key: "2", label: "Chats" }
    )
  } else if (state.currentView === "chats") {
    hints.push(
      { key: "↑↓", label: "Navigate" },
      { key: "Enter", label: "Open Chat" },
      { key: "Ctrl + F | /", label: "Search" },
      { key: "Tab | Shift+Tab", label: "Filter" },
      { key: "Esc", label: "Back" },
      { key: "1", label: "Sessions" }
    )
  } else if (state.currentView === "conversation") {
    if (state.inputMode) {
      hints.push({ key: "i", label: "Typing..." }, { key: "Esc", label: "Cancel" })
    } else {
      hints.push(
        { key: "↑↓", label: "Scroll" },
        { key: "i", label: "Type Message" },
        { key: "Esc", label: "Back to Chats" }
      )
    }
  }

  // Always available
  hints.push(
    { key: "R", label: "Refresh" },
    { key: "Ctrl + C", label: "Quit", keyColor: "#ef5350" }
  )

  // Build hint text with styled nodes
  const hintText = Text({})

  hints.forEach((hint, idx) => {
    // Key (colored)
    const keyNode = new TextNodeRenderable({
      fg: hint.keyColor || WhatsAppTheme.green,
    })
    keyNode.add(hint.key)
    hintText.add(keyNode)

    // Label (dim)
    const labelNode = new TextNodeRenderable({
      fg: WhatsAppTheme.textSecondary,
    })
    labelNode.add(` ${hint.label}`)
    hintText.add(labelNode)

    // Separator (not for last item)
    if (idx < hints.length - 1) {
      const sepNode = new TextNodeRenderable({
        fg: WhatsAppTheme.borderLight,
      })
      sepNode.add(" │ ")
      hintText.add(sepNode)
    }
  })

  return Box(
    {
      height: 3,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelDark,
      border: true,
      borderColor: WhatsAppTheme.borderLight,
    },
    // Keyboard hints (left)
    hintText,
    // Version (right)
    Text({
      content: `waha-tui ${getVersion()}`,
      fg: WhatsAppTheme.textTertiary,
    })
  )
}
