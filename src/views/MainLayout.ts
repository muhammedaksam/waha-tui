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

import { WhatsAppTheme } from "~/config/theme"
import { appState } from "~/state/AppState"
import { ChatsView } from "~/views/ChatsView"
import { ConversationView } from "~/views/ConversationView"
import { GroupInfoView } from "~/views/GroupInfoView"
import { IconSidebar } from "~/views/IconSidebar"
import { WelcomeView } from "~/views/WelcomeView"

type LayoutChild =
  | ProxiedVNode<typeof BoxRenderable>
  | BoxRenderable
  | TextRenderable
  | Renderable
  | null

interface ThreePanelLayoutProps {
  leftPanel: LayoutChild
  rightPanel: LayoutChild
  asidePanel?: LayoutChild
}

/**
 * Reusable three-panel layout with consistent widths
 * Used by both MainLayout (chats) and settings
 */
export function ThreePanelLayout({ leftPanel, rightPanel, asidePanel }: ThreePanelLayoutProps) {
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

    // Right Panel
    Box(
      {
        flexGrow: 1,
        flexShrink: 1,
        flexDirection: "column",
      },
      rightPanel
    ),

    // Aside Panel (Right Sidebar)
    asidePanel
      ? Box(
          {
            width: "30%",
            flexShrink: 0,
            flexDirection: "column",
            backgroundColor: WhatsAppTheme.panelDark,
            borderColor: WhatsAppTheme.borderColor,
            border: ["left"],
          },
          asidePanel
        )
      : null
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

  // Determine aside panel content
  let asidePanel: LayoutChild = null
  if (state.rightSidebar === "group-info" || state.rightSidebar === "contact-info") {
    asidePanel = GroupInfoView()
  }

  return ThreePanelLayout({
    leftPanel: ChatsView(),
    rightPanel: showConversation ? ConversationView() : WelcomeView(),
    asidePanel,
  })
}
