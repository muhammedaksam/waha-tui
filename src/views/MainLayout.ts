/**
 * Main Layout
 * Three-column WhatsApp-style layout manager
 * Layout: Icon Sidebar (8 chars / 64px equiv) | Chat List (30% of remaining) | Main Window (70% of remaining)
 */

import { Box } from "@opentui/core"
import { appState } from "../state/AppState"
import { WhatsAppTheme } from "../config/theme"
import { IconSidebar } from "./IconSidebar"
import { ChatsView } from "./ChatsView"
import { ConversationView } from "./ConversationView"
import { WelcomeView } from "./WelcomeView"

export function MainLayout() {
  const state = appState.getState()

  // Determine what to show in the right panel
  const showConversation = state.currentView === "conversation" || state.currentChatId !== null

  return Box(
    {
      width: "auto",
      height: "auto",
      flexDirection: "row",
      flexGrow: 1,
      flexShrink: 1,
      backgroundColor: WhatsAppTheme.deepDark,
    },
    // Icon Sidebar (left, 8 chars fixed width ~ 64px)
    IconSidebar(),

    // Chat List (30% of remaining space when conversation/welcome is shown, else full)
    Box(
      {
        width: "30%",
        flexDirection: "column",
        backgroundColor: WhatsAppTheme.panelDark,
        border: true,
        borderColor: WhatsAppTheme.borderColor,
      },
      ChatsView()
    ),

    // Right Panel (70% of remaining space): Welcome View or Conversation View
    ...(showConversation
      ? [
          Box(
            {
              flexGrow: 1,
              flexShrink: 1,
            },
            ConversationView()
          ),
        ]
      : [
          Box(
            {
              flexGrow: 1,
              flexShrink: 1,
            },
            WelcomeView()
          ),
        ])
  )
}
