/**
 * Status Bar Component
 * Displays connection status, current session, and view information
 */

import { Box, Text, TextAttributes } from "@opentui/core"

import { appState } from "~/state/AppState"
import { getConnectionStatusIcon } from "~/utils/formatters"

export function StatusBar() {
  const state = appState.getState()

  const statusIcon = state.currentSession
    ? getConnectionStatusIcon(state.connectionStatus.toUpperCase())
    : "⚪"

  const sessionText = state.currentSession
    ? `Session: ${state.currentSession}`
    : "No session selected"

  const viewText = state.currentView.charAt(0).toUpperCase() + state.currentView.slice(1)

  return Box(
    {
      height: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingLeft: 1,
      paddingRight: 1,
    },
    Text({
      content: `${statusIcon} ${sessionText}`,
      attributes: state.connectionStatus === "connected" ? TextAttributes.BOLD : TextAttributes.DIM,
    }),
    Text({
      content: viewText,
      attributes: TextAttributes.DIM,
    })
  )
}
