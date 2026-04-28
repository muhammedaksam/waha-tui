/**
 * Context Menu Component
 * Floating menu overlay for chat and message actions
 */

import type { ChatSummary, WAMessage } from "@muhammedaksam/waha-node"

import { Box, BoxRenderable, ProxiedVNode, TextRenderable } from "@opentui/core"

import type { ContextMenuType } from "~/state/AppState"
import type { WAMessageExtended } from "~/types"
import { Icons, WhatsAppTheme } from "~/config/theme"
import { QUICK_REACTIONS } from "~/data/emojis"
import { appState } from "~/state/AppState"
import { getRenderer } from "~/state/RendererContext"
import { debugLog } from "~/utils/debug"
import { isArchived } from "~/utils/filterChats"

export interface ContextMenuItem {
  id: string
  label: string
  icon?: string
  disabled?: boolean
  destructive?: boolean // For delete actions (shown in red)
  separator?: boolean // Draws a line separator before this item
  isQuickReactions?: boolean // Indicates this is the quick reactions row
}

// Chat context menu items
export function getChatMenuItems(chat: ChatSummary): ContextMenuItem[] {
  // Check if chat is archived using the same logic as filterChats
  const isArchivedChat = isArchived(chat)

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
export function getMessageMenuItems(message: WAMessage | WAMessageExtended): ContextMenuItem[] {
  // Check if message is starred
  const isStarred = (message as { isStarred?: boolean }).isStarred === true

  // Check if user has reacted to this message
  const state = appState.getState()
  const myProfileId = state.myProfile?.id ?? null
  const extMessage = message as WAMessageExtended
  const hasMyReaction =
    myProfileId &&
    extMessage.reactions?.some((r) => {
      if (!r.from) return false
      // Compare by numeric prefix (strip @c.us / @lid suffix)
      const fromNum = r.from.split("@")[0]
      const myNum = myProfileId.split("@")[0]
      return fromNum === myNum
    })

  const items: ContextMenuItem[] = [
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
  ]

  if (message.hasMedia || (message as WAMessageExtended)._data?.hasMedia) {
    items.push({
      id: "download",
      label: "Download & Open",
      icon: Icons.download,
    })
  }

  items.push({
    id: "react",
    label: "React",
    icon: "😀",
  })

  if (hasMyReaction) {
    items.push({
      id: "unreact",
      label: "Remove Reaction",
      icon: "❌",
    })
  }

  items.push(
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
    }
  )

  return items
}

// Get menu items based on context type
export function getMenuItems(
  type: ContextMenuType,
  targetData: ChatSummary | WAMessage | WAMessageExtended | null | undefined
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
  const renderer = getRenderer()

  // Build menu items using imperative API for mouse handlers
  const menuItems = items.map((item, index) => {
    const isSelected = index === contextMenu.selectedIndex
    const textColor = item.destructive
      ? "#EA0038" // Red for destructive actions
      : item.disabled
        ? WhatsAppTheme.textTertiary
        : WhatsAppTheme.textPrimary

    const bgColor = isSelected ? WhatsAppTheme.hoverBg : WhatsAppTheme.panelDark

    // Container for separator + item
    const container = Box(
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
        : [])
    )

    // Create menu item row imperatively for mouse support
    const menuItemRow = new BoxRenderable(renderer, {
      height: 1,
      width: menuWidth,
      flexDirection: "row",
      backgroundColor: bgColor,
      paddingLeft: 1,
      paddingRight: 1,
      onMouse(event) {
        if (event.type === "down" && event.button === 0) {
          if (!item.disabled) {
            appState.setContextMenuSelectedIndex(index)
            appState.triggerContextMenuAction(item.id)
            event.stopPropagation()
          }
        }
      },
    })

    // Add text content to normal menu row
    menuItemRow.add(
      new TextRenderable(renderer, {
        content: item.icon || " ",
        fg: textColor,
      })
    )
    menuItemRow.add(
      new TextRenderable(renderer, {
        content: " ",
      })
    )
    menuItemRow.add(
      new TextRenderable(renderer, {
        content: item.label,
        fg: textColor,
      })
    )

    // Add the row to container
    container.add(menuItemRow)

    return container
  })

  // Calculate menu height
  const menuHeight =
    items.reduce((acc, item) => acc + (item.separator ? 2 : 1), 0) +
    (contextMenu.type === "chat" ? 2 : 1) // +2 for border

  // Menu title
  // const title = contextMenu.type === "chat" ? "Chat Options" : "Message Options"

  // Position logic differs by menu type:
  // - Chat menu: appears at click position (floating near clicked chat)
  // - Message menu: anchored to right side of conversation area, near the clicked message
  const pos = contextMenu.position || { x: 10, y: 5 }

  let leftPosition: number
  let topPosition: number

  if (contextMenu.type === "message") {
    // For message menu: anchor to top-right corner of the message bubble
    // Use the exact bubble position and dimensions passed from the renderable
    const message = contextMenu.targetData as { fromMe?: boolean } | null
    const isFromMe = message?.fromMe === true

    // Get bubble bounds from position
    const bubbleX = pos.x
    const bubbleY = pos.y
    const bubbleWidth = pos.bubbleWidth || 40
    const bubbleHeight = pos.bubbleHeight || 3

    if (isFromMe) {
      // Sent messages (right-aligned) - menu appears 1 block left from the bubble's left edge
      // So position is: bubbleX - menuWidth - 1
      leftPosition = Math.max(2, bubbleX - menuWidth - 1)
    } else {
      // Received messages (left-aligned) - menu appears 1 block right from the bubble's right edge
      // So position is: bubbleX + bubbleWidth + 1
      leftPosition = bubbleX + bubbleWidth + 1
    }

    // Check for bottom overflow - if menu would go off screen, show above instead
    const renderer = getRenderer()
    const terminalHeight = renderer.height
    // Anchor 1 row down from the top of the bubble
    const anchorY = bubbleY + 1

    if (anchorY + menuHeight > terminalHeight - 2) {
      // Menu would overflow - anchor from bottom of bubble instead (menu grows upward)
      // Position so the bottom of the menu aligns with the bottom of the bubble
      topPosition = Math.max(2, bubbleY + bubbleHeight - menuHeight)
    } else {
      // Normal positioning - menu starts 1 row down from bubble top
      topPosition = Math.max(2, anchorY)
    }
  } else {
    // For chat menu: use click position
    leftPosition = Math.max(2, pos.x)
    topPosition = Math.max(2, pos.y)
  }

  // Create the menu box imperatively for mouse handlers
  const menuBox = new BoxRenderable(renderer, {
    position: "absolute",
    top: topPosition,
    left: leftPosition,
    width: menuWidth + 2, // +2 for border
    height: menuHeight + (contextMenu.type === "message" ? 1 : 0),
    backgroundColor: WhatsAppTheme.panelDark,
    border: true,
    borderColor: WhatsAppTheme.borderLight,
    flexDirection: "column",
    zIndex: 100,
    onMouse(event) {
      // Stop propagation so clicks on menu don't trigger outside-click handler
      event.stopPropagation()
    },
  })

  // Add menu items to the menu box
  for (const item of menuItems) {
    menuBox.add(item)
  }

  const anchor = new BoxRenderable(renderer, {
    position: "absolute",
    top: 0,
    left: 0,
    width: renderer.width,
    height: renderer.height,
    zIndex: 100,
    onMouse(event) {
      if (event.type === "down" && event.button === 0) {
        if (isClickOutsideContextMenu(event.x, event.y)) {
          appState.closeContextMenu()
          event.stopPropagation()
        }
      }
    },
  })

  // Add the menu box to the anchor
  anchor.add(menuBox)

  // Initialize bounds array
  lastMenuBounds = [
    {
      left: leftPosition,
      top: topPosition,
      right: leftPosition + menuWidth + 2,
      bottom: topPosition + menuHeight + (contextMenu.type === "message" ? 1 : 0),
    },
  ]

  // Add Reaction Pill for message context menu
  if (contextMenu.type === "message") {
    const reactions = [...QUICK_REACTIONS, "➕"]
    // Reaction pill styling (whatsapp web style)
    const pillWidth = reactions.length * 3 + 2 // 3 per emoji + padding
    const pillHeight = 3 // Pill height
    const pillTop = Math.max(0, topPosition - pillHeight) // Above the menu
    const pillLeft = leftPosition // Align with the menu

    const pillBox = new BoxRenderable(renderer, {
      position: "absolute",
      top: pillTop,
      left: pillLeft,
      width: pillWidth,
      height: pillHeight,
      backgroundColor: WhatsAppTheme.panelDark,
      border: true,
      borderColor: WhatsAppTheme.borderLight,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      onMouse(event) {
        event.stopPropagation()
      },
    })

    const subIndex = contextMenu.selectedSubIndex || 0

    reactions.forEach((reactionStr: string, rIndex: number) => {
      // For quick reactions, we can highlight the one being hovered
      // For keyboard navigation, we can use the selectedSubIndex
      const isSubSelected = contextMenu.selectedIndex === -1 && subIndex === rIndex
      const reactBg = isSubSelected ? WhatsAppTheme.panelLight : WhatsAppTheme.panelDark

      const reactBox = new BoxRenderable(renderer, {
        height: 1,
        width: 3,
        backgroundColor: reactBg,
        justifyContent: "center",
        alignItems: "center",
        onMouse(event) {
          if (event.type === "down" && event.button === 0) {
            debugLog("ContextMenu", `Clicked reaction pill for: ${reactionStr}`)
            if (reactionStr === "➕") {
              appState.triggerContextMenuAction("open_emoji_picker")
            } else {
              appState.triggerContextMenuAction(`react:${reactionStr}`)
            }
            event.stopPropagation()
          }
        },
      })

      reactBox.add(
        new TextRenderable(renderer, {
          content: reactionStr,
        })
      )

      pillBox.add(reactBox)
    })

    anchor.add(pillBox)

    // Add pill bounds
    lastMenuBounds.push({
      left: pillLeft,
      top: pillTop,
      right: pillLeft + pillWidth,
      bottom: pillTop + pillHeight,
    })
  }

  return anchor as unknown as ProxiedVNode<typeof BoxRenderable>
}

// Store menu bounds for outside-click detection
let lastMenuBounds: { left: number; top: number; right: number; bottom: number }[] = []

// Check if a click position is outside the context menu
export function isClickOutsideContextMenu(x: number, y: number): boolean {
  if (lastMenuBounds.length === 0) return true

  // If the click is INSIDE any of the bounds, it's NOT outside
  for (const bounds of lastMenuBounds) {
    if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) {
      return false
    }
  }

  return true
}

// Clear menu bounds when menu is closed
export function clearMenuBounds(): void {
  lastMenuBounds = []
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

    case "left":
    case "h": {
      const selectedItem = items[contextMenu.selectedIndex]
      if (selectedItem?.isQuickReactions) {
        const maxSubIndex = QUICK_REACTIONS.length // +1 for the '+' button
        const currentSub = contextMenu.selectedSubIndex || 0
        const newSubIndex = currentSub > 0 ? currentSub - 1 : maxSubIndex
        appState.setContextMenuSelectedSubIndex(newSubIndex)
        return true
      }
      return false
    }

    case "right":
    case "l": {
      const selectedItem = items[contextMenu.selectedIndex]
      if (selectedItem?.isQuickReactions) {
        const maxSubIndex = QUICK_REACTIONS.length
        const currentSub = contextMenu.selectedSubIndex || 0
        const newSubIndex = currentSub < maxSubIndex ? currentSub + 1 : 0
        appState.setContextMenuSelectedSubIndex(newSubIndex)
        return true
      }
      return false
    }

    case "return":
    case "enter": {
      const selectedItem = items[contextMenu.selectedIndex]
      if (selectedItem && !selectedItem.disabled) {
        if (selectedItem.isQuickReactions) {
          const subIndex = contextMenu.selectedSubIndex || 0
          if (subIndex === QUICK_REACTIONS.length) {
            appState.triggerContextMenuAction("open_emoji_picker")
          } else {
            appState.triggerContextMenuAction(`react:${QUICK_REACTIONS[subIndex]}`)
          }
        }

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

// Get the currently selected action ID (not just menu item, but handles sub-items)
export function getSelectedContextMenuActionId(): string | null {
  const state = appState.getState()
  const { contextMenu } = state

  if (!contextMenu || !contextMenu.visible) return null

  const items = getMenuItems(contextMenu.type, contextMenu.targetData)
  const selectedItem = items[contextMenu.selectedIndex]

  if (!selectedItem || selectedItem.disabled) return null

  if (selectedItem.isQuickReactions) {
    const subIndex = contextMenu.selectedSubIndex || 0
    if (subIndex === QUICK_REACTIONS.length) {
      return "open_emoji_picker"
    } else {
      return `react:${QUICK_REACTIONS[subIndex]}`
    }
  }

  return selectedItem.id
}
