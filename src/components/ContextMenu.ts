/**
 * Context Menu Component
 * Floating menu overlay for chat and message actions
 */

import { Box, ProxiedVNode, Text, type BoxRenderable } from "@opentui/core"
import { WhatsAppTheme, Icons } from "../config/theme"
import { appState, type ContextMenuType } from "../state/AppState"
import type { ChatSummary, WAMessage } from "@muhammedaksam/waha-node"

export interface ContextMenuItem {
  id: string
  label: string
  icon?: string
  disabled?: boolean
  destructive?: boolean // For delete actions (shown in red)
  separator?: boolean // Draws a line separator before this item
}

// Chat context menu items
export function getChatMenuItems(chat: ChatSummary): ContextMenuItem[] {
  // Check if chat is archived using the same logic as filterChats
  // The archived property is at _chat.archived, not chat.archive
  const rawChat = (chat as { _chat?: { archived?: boolean } })._chat
  const isArchivedChat = rawChat?.archived === true

  return [
    {
      id: "archive",
      label: isArchivedChat ? "Unarchive chat" : "Archive chat",
      icon: Icons.archive,
    },
    {
      id: "unread",
      label: "Mark as unread",
      icon: Icons.unread,
    },
    {
      id: "delete",
      label: "Delete chat",
      icon: Icons.delete,
      destructive: true,
      separator: true,
    },
  ]
}

// Message context menu items
export function getMessageMenuItems(message: WAMessage): ContextMenuItem[] {
  // Check if message is starred
  const isStarred = (message as { isStarred?: boolean }).isStarred === true

  return [
    {
      id: "reply",
      label: "Reply",
      icon: Icons.reply,
    },
    {
      id: "copy",
      label: "Copy",
      icon: Icons.copy,
    },
    {
      id: "react",
      label: "React",
      icon: Icons.react,
    },
    {
      id: "forward",
      label: "Forward",
      icon: Icons.forward,
      separator: true,
    },
    {
      id: "pin",
      label: "Pin",
      icon: Icons.pin,
    },
    {
      id: "star",
      label: isStarred ? "Unstar" : "Star",
      icon: isStarred ? Icons.starFilled : Icons.star,
    },
    {
      id: "delete",
      label: "Delete",
      icon: Icons.delete,
      destructive: true,
      separator: true,
    },
  ]
}

// Get menu items based on context type
export function getMenuItems(
  type: ContextMenuType,
  targetData: ChatSummary | WAMessage | null | undefined
): ContextMenuItem[] {
  if (!type || !targetData) return []

  if (type === "chat") {
    return getChatMenuItems(targetData as ChatSummary)
  } else if (type === "message") {
    return getMessageMenuItems(targetData as WAMessage)
  }

  return []
}

// Context Menu UI Component
export function ContextMenu(): ProxiedVNode<typeof BoxRenderable> | null {
  const state = appState.getState()
  const { contextMenu } = state

  if (!contextMenu || !contextMenu.visible) {
    return null
  }

  const items = getMenuItems(contextMenu.type, contextMenu.targetData)

  if (items.length === 0) {
    return null
  }

  const menuWidth = 24 // Fixed width for menu

  // Build menu items
  const menuItems = items.map((item, index) => {
    const isSelected = index === contextMenu.selectedIndex
    const textColor = item.destructive
      ? "#EA0038" // Red for destructive actions
      : item.disabled
        ? WhatsAppTheme.textTertiary
        : WhatsAppTheme.textPrimary

    const bgColor = isSelected ? WhatsAppTheme.hoverBg : WhatsAppTheme.panelDark

    return Box(
      {
        height: item.separator ? 2 : 1,
        width: menuWidth,
        flexDirection: "column",
      },
      // Separator line if needed
      ...(item.separator
        ? [
            Box({
              height: 1,
              width: menuWidth,
              backgroundColor: WhatsAppTheme.borderLight,
            }),
          ]
        : []),
      // Menu item row
      Box(
        {
          height: 1,
          width: menuWidth,
          flexDirection: "row",
          backgroundColor: bgColor,
          paddingLeft: 1,
          paddingRight: 1,
        },
        // Icon
        Text({
          content: item.icon || " ",
          fg: textColor,
        }),
        Text({
          content: " ",
        }),
        // Label
        Text({
          content: item.label,
          fg: textColor,
        })
      )
    )
  })

  // Calculate menu height
  const menuHeight = items.reduce((acc, item) => acc + (item.separator ? 2 : 1), 0) + 2 // +2 for border

  // Menu title
  const title = contextMenu.type === "chat" ? "Chat Options" : "Message Options"

  return Box(
    {
      // Position in center of screen for now
      // A more sophisticated implementation would position near click location
      position: "absolute",
      top: 5,
      left: 10,
      width: menuWidth + 2, // +2 for border
      height: menuHeight,
      backgroundColor: WhatsAppTheme.panelDark,
      border: true,
      borderColor: WhatsAppTheme.borderLight,
      flexDirection: "column",
      zIndex: 100,
    },
    // Header
    Box(
      {
        height: 1,
        width: menuWidth,
        paddingLeft: 1,
        backgroundColor: WhatsAppTheme.panelLight,
      },
      Text({
        content: title,
        fg: WhatsAppTheme.textSecondary,
      })
    ),
    // Menu items
    ...menuItems
  )
}

// Keyboard handler for context menu navigation
export function handleContextMenuKey(key: string): boolean {
  const state = appState.getState()
  const { contextMenu } = state

  if (!contextMenu || !contextMenu.visible) {
    return false
  }

  const items = getMenuItems(contextMenu.type, contextMenu.targetData)

  if (items.length === 0) {
    return false
  }

  switch (key) {
    case "up":
    case "k": {
      const newIndex =
        contextMenu.selectedIndex > 0 ? contextMenu.selectedIndex - 1 : items.length - 1
      appState.setContextMenuSelectedIndex(newIndex)
      return true
    }

    case "down":
    case "j": {
      const newIndex =
        contextMenu.selectedIndex < items.length - 1 ? contextMenu.selectedIndex + 1 : 0
      appState.setContextMenuSelectedIndex(newIndex)
      return true
    }

    case "return":
    case "enter": {
      const selectedItem = items[contextMenu.selectedIndex]
      if (selectedItem && !selectedItem.disabled) {
        // Return the selected action - actual handling done in main app
        return true
      }
      return true
    }

    case "escape":
    case "q": {
      appState.closeContextMenu()
      return true
    }

    default:
      return false
  }
}

// Get the currently selected menu item
export function getSelectedMenuItem(): ContextMenuItem | null {
  const state = appState.getState()
  const { contextMenu } = state

  if (!contextMenu || !contextMenu.visible) {
    return null
  }

  const items = getMenuItems(contextMenu.type, contextMenu.targetData)
  return items[contextMenu.selectedIndex] || null
}
