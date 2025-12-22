/**
 * Context Menu Actions Handler
 * Executes actions triggered from context menus (chat and message context menus)
 */

import { appState, type ContextMenuState } from "../state/AppState"
import { debugLog } from "../utils/debug"
import {
  archiveChat,
  unarchiveChat,
  markChatUnread,
  deleteChat,
  loadChats,
  loadMessages,
  copyToClipboard,
  starMessage,
  pinMessage,
  reactToMessage,
  deleteMessage,
} from "../client"
import { focusMessageInput } from "../views/ConversationView"
import type { WAMessage } from "@muhammedaksam/waha-node"

/**
 * Execute a context menu action based on the action ID and context
 */
export async function executeContextMenuAction(
  actionId: string,
  contextMenu: ContextMenuState
): Promise<void> {
  if (!contextMenu?.targetId) return
  const targetId = contextMenu.targetId
  const state = appState.getState() // Get fresh state

  debugLog("ContextMenu", `Executing action: ${actionId} on ${contextMenu.type} ${targetId}`)

  try {
    if (contextMenu.type === "chat") {
      // Chat actions
      switch (actionId) {
        case "archive": {
          const chat = contextMenu.targetData as { _chat?: { archived?: boolean } }
          const isArchivedChat = chat?._chat?.archived === true
          if (isArchivedChat) {
            await unarchiveChat(targetId)
          } else {
            await archiveChat(targetId)
          }
          // Refresh chat list
          await loadChats()
          break
        }
        case "unread":
          await markChatUnread(targetId)
          await loadChats()
          break
        case "delete":
          await deleteChat(targetId)
          await loadChats()
          break
      }
    } else if (contextMenu.type === "message") {
      // Message actions
      switch (actionId) {
        case "reply": {
          // Set replying to message state and focus input
          const message = contextMenu.targetData
          if (message) {
            appState.setReplyingToMessage(message as WAMessage)
            focusMessageInput()
          }
          break
        }
        case "copy": {
          // Copy message text to system clipboard
          const message = contextMenu.targetData as { body?: string }
          if (message?.body) {
            const copied = await copyToClipboard(message.body)
            debugLog("ContextMenu", copied ? `Copied to clipboard` : `Clipboard copy failed`)
          }
          break
        }
        case "star": {
          const message = contextMenu.targetData as { isStarred?: boolean }
          const isStarred = message?.isStarred === true
          if (state.currentChatId) {
            await starMessage(targetId, state.currentChatId, !isStarred)
            // Refresh messages
            await loadMessages(state.currentChatId)
          }
          break
        }
        case "pin": {
          if (state.currentChatId) {
            await pinMessage(state.currentChatId, targetId)
            await loadMessages(state.currentChatId)
          }
          break
        }
        case "react": {
          // For now, add a thumbs up reaction
          // Could show a sub-menu for emoji selection later
          await reactToMessage(targetId, "👍")
          break
        }
        case "delete": {
          if (state.currentChatId) {
            await deleteMessage(state.currentChatId, targetId)
            await loadMessages(state.currentChatId)
          }
          break
        }
        case "forward": {
          // TODO: Implement chat picker UI for selecting destination
          // For now, just log that forward was requested
          debugLog(
            "ContextMenu",
            `Forward requested for message: ${targetId} - need chat picker UI`
          )
          break
        }
      }
    }
  } catch (error) {
    debugLog("ContextMenu", `Error executing action ${actionId}: ${error}`)
  }

  // Close context menu
  appState.closeContextMenu()
}
