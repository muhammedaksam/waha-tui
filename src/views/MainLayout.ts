/**
 * Main Layout
 * Three-column WhatsApp-style layout manager
 * Layout: Icon Sidebar (8 chars / 64px equiv) | Left Panel (30%) | Right Panel (70%)
 *
 * Can be used for:
 * - Chats view (ChatsView + ConversationView/WelcomeView)
 * - Settings view (SettingsMenu + SettingsContent)
 */

import { Box, BoxRenderable, ProxiedVNode, Renderable, TextRenderable } from "@opentui/core"
import { appState } from "../state/AppState"
import { WhatsAppTheme } from "../config/theme"
import { IconSidebar } from "./IconSidebar"
import { ChatsView } from "./ChatsView"
import { ConversationView } from "./ConversationView"
import { WelcomeView } from "./WelcomeView"

type LayoutChild =
  | ProxiedVNode<typeof BoxRenderable>
  | BoxRenderable
  | TextRenderable
  | Renderable
  | null

interface ThreePanelLayoutProps {
  leftPanel: LayoutChild
  rightPanel: LayoutChild
}

/**
 * Reusable three-panel layout with consistent widths
 * Used by both MainLayout (chats) and settings
 */
export function ThreePanelLayout({ leftPanel, rightPanel }: ThreePanelLayoutProps) {
  return Box(
    {
      width: "auto",
      height: "auto",
      flexDirection: "row",
      flexGrow: 1,
      flexShrink: 1,
      backgroundColor: WhatsAppTheme.deepDark,
    },
    // Icon Sidebar (left, 6 chars fixed width)
    IconSidebar(),

    // Left Panel (30% of remaining space - fixed, should not shrink)
    Box(
      {
        width: "30%",
        flexShrink: 0,
        flexDirection: "column",
        backgroundColor: WhatsAppTheme.panelDark,
        border: true,
        borderColor: WhatsAppTheme.borderColor,
      },
      leftPanel
    ),

    // Right Panel (70% of remaining space)
    Box(
      {
        flexGrow: 1,
        flexShrink: 1,
      },
      rightPanel
    )
  )
}

/**
 * Main Layout for Chats view
 * Shows ChatsView on left, ConversationView or WelcomeView on right
 */
export function MainLayout() {
  const state = appState.getState()

  // Determine what to show in the right panel
  const showConversation = state.currentView === "conversation" || state.currentChatId !== null

  return ThreePanelLayout({
    leftPanel: ChatsView(),
    rightPanel: showConversation ? ConversationView() : WelcomeView(),
  })
}
