/**
 * Icon Sidebar
 * Vertical navigation with emoji icons for main sections
 */

import { Box, Text, TextAttributes } from "@opentui/core"

import type { ActiveIcon } from "../state/AppState"
import { Icons, Layout, WhatsAppTheme } from "../config/theme"
import { appState } from "../state/AppState"
import { getInitials } from "../utils/formatters"

export function IconSidebar() {
  const state = appState.getState()

  const iconItems: Array<{ key: ActiveIcon; icon: string; position: "top" | "bottom" }> = [
    { key: "chats", icon: Icons.chats, position: "top" },
    { key: "status", icon: Icons.status, position: "top" },
    { key: "channels", icon: Icons.channels, position: "top" },
    { key: "communities", icon: Icons.communities, position: "top" },
    // Bottom section - like WhatsApp Web
    { key: "status", icon: "📷", position: "bottom" }, // Status/Photos
    { key: "settings", icon: Icons.settings, position: "bottom" },
    // { key: "profile", icon: Icons.profile, position: "bottom" },
  ]

  // Top icons
  const topIcons = iconItems
    .filter((item) => item.position === "top")
    .map((item) => {
      const isActive = state.activeIcon === item.key

      return Box(
        {
          height: 3,
          width: Layout.iconSidebarWidth,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isActive ? WhatsAppTheme.activeBg : WhatsAppTheme.panelDark,
          border: false,
          borderColor: isActive ? WhatsAppTheme.green : undefined,
        },
        Text({
          content: item.icon,
          fg: isActive ? WhatsAppTheme.green : WhatsAppTheme.textSecondary,
        })
      )
    })

  // Bottom icons
  const bottomIcons = iconItems
    .filter((item) => item.position === "bottom")
    .map((item) => {
      const isActive = state.activeIcon === item.key

      return Box(
        {
          width: Layout.iconSidebarWidth,
          height: 3,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isActive ? WhatsAppTheme.activeBg : WhatsAppTheme.panelDark,
          border: isActive,
          borderColor: isActive ? WhatsAppTheme.green : undefined,
        },
        Text({
          content: item.icon,
          fg: isActive ? WhatsAppTheme.green : WhatsAppTheme.textSecondary,
        })
      )
    })

  return Box(
    {
      width: Layout.iconSidebarWidth,
      height: "auto",
      flexDirection: "column",
      flexGrow: 0,
      flexShrink: 0,
      backgroundColor: WhatsAppTheme.panelDark,
      justifyContent: "space-between",
    },
    // Top section
    Box(
      {
        flexDirection: "column",
      },
      ...topIcons
    ),
    // Bottom section
    Box(
      {
        flexDirection: "column",
      },
      ...bottomIcons,
      Box(
        {
          width: 5,
          height: 3,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: WhatsAppTheme.green,
          marginLeft: 1,
        },
        Text({
          content: getInitials(state.myProfile?.name || ""),
          fg: WhatsAppTheme.white,
          attributes: TextAttributes.BOLD,
        })
      )
    )
  )
}
