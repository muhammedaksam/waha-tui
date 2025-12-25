/**
 * Sessions View
 * Display and manage WAHA sessions
 */

import { Box, Text, TextAttributes } from "@opentui/core"

import { appState } from "../state/AppState"
import { getConnectionStatusIcon } from "../utils/formatters"

export function SessionsView() {
  const state = appState.getState()

  return Box(
    { flexDirection: "column", flexGrow: 1, padding: 2 },

    // Header
    Text({
      content: "WAHA Sessions",
      attributes: TextAttributes.BOLD,
    }),

    Box({ height: 1 }),

    // Session list
    ...state.sessions.map((session, index) => {
      const statusIcon = getConnectionStatusIcon(session.status)
      const isCurrentSession = state.currentSession === session.name
      const isSelected = index === state.selectedSessionIndex

      return Box(
        {
          flexDirection: "row",
          paddingLeft: 1,
          paddingRight: 1,
          backgroundColor: isSelected ? "#2a3942" : undefined,
        },
        Text({
          content: `${isCurrentSession ? ">" : " "} ${statusIcon} ${session.name}`,
          attributes: isCurrentSession ? TextAttributes.BOLD : TextAttributes.NONE,
        }),
        Text({
          content: ` (${session.status})`,
          attributes: TextAttributes.DIM,
        })
      )
    }),

    // Empty state
    ...(state.sessions.length === 0
      ? [
          Text({
            content: "No sessions found. Create a new session to get started.",
            attributes: TextAttributes.DIM,
          }),
        ]
      : []),

    Box({ height: 1 }),

    // Help text
    Text({
      content: "Press 'n' to create new session | 'q' to quit",
      attributes: TextAttributes.DIM,
    })
  )
}
