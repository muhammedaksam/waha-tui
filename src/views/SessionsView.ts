/**
 * Sessions View
 * Display and manage WAHA sessions
 */

import { Box, Text, TextAttributes } from "@opentui/core"
import { appState } from "../state/AppState"
import { getClient } from "../client"
import { getConnectionStatusIcon } from "../utils/formatters"
import { debugLog } from "../utils/debug"

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

/**
 * Load sessions from WAHA API
 */
export async function loadSessions(): Promise<void> {
  try {
    debugLog("Session", "Loading sessions from WAHA API")
    appState.setConnectionStatus("connecting")
    const client = getClient()
    const { data: sessions } = await client.sessions.sessionsControllerList()
    debugLog("Session", `Loaded ${sessions?.length ?? 0} sessions`)
    appState.setSessions(sessions ?? [])
    appState.setConnectionStatus("connected")
  } catch (error) {
    debugLog("Session", `Failed to load sessions: ${error}`)
    appState.setConnectionStatus("error", `Failed to load sessions: ${error}`)
    appState.setSessions([])
  }
}
