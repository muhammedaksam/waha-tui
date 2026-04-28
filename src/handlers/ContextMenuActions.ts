import type { WAMessage } from "@muhammedaksam/waha-node"

import type { ContextMenuState } from "~/state/AppState"
import type { WAMessageExtended } from "~/types"
import {
  archiveChat,
  copyToClipboard,
  deleteChat,
  deleteMessage,
  loadChats,
  loadMessages,
  markChatUnread,
  pinMessage,
  reactToMessage,
  starMessage,
  unarchiveChat,
} from "~/client"
import { appState } from "~/state/AppState"
import { debugLog } from "~/utils/debug"
import { getChatIdString } from "~/utils/formatters"
import { focusMessageInput } from "~/views/ConversationView"

/**
 * Context Menu Actions Handler
 * Executes actions triggered from context menus (chat and message context menus)
 */

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
        case "download": {
          if (state.currentChatId) {
            // Lazy import to avoid circular dependencies
            const { downloadAndOpenMedia } = await import("~/client")
            await downloadAndOpenMedia(state.currentChatId, targetId)
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
          const message = contextMenu.targetData as WAMessageExtended
          if (!message) break

          // Dynamically import to avoid circular dependencies if any
          const { showChatPicker } = await import("~/components/ChatPickerDialog")

          debugLog("ContextMenu", `Opening ChatPicker for message ${targetId}`)
          const selectedChats = await showChatPicker(message)
          debugLog("ContextMenu", `ChatPicker closed with ${selectedChats.length} selected chats`)

          if (selectedChats.length > 0) {
            let successCount = 0
            appState.showToast(`Forwarding message to ${selectedChats.length} chat(s)...`, "info")

            for (const chat of selectedChats) {
              try {
                // message.chatId might not be directly on message in all WAHA versions,
                // but WAMessageExtended typically has it or we can get it from state
                const originalChatId = state.currentChatId
                debugLog(
                  "ContextMenu",
                  `OriginalChatId: ${originalChatId}, ToChatId: ${getChatIdString(chat.id)}`
                )
                if (originalChatId) {
                  await import("~/client").then((m) =>
                    m.forwardMessage(originalChatId, targetId, getChatIdString(chat.id))
                  )
                  successCount++
                } else {
                  debugLog("ContextMenu", `Failed to forward: originalChatId is missing`)
                }
              } catch (e) {
                debugLog("ContextMenu", `Failed to forward to ${getChatIdString(chat.id)}: ${e}`)
              }
            }

            if (successCount === selectedChats.length) {
              appState.showToast(`${successCount} item(s) forwarded`, "success")
            } else if (successCount > 0) {
              appState.showToast(
                `Forwarded to ${successCount}/${selectedChats.length} chats`,
                "warning"
              )
            } else {
              appState.showToast(`Failed to forward message`, "error")
            }
          }
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
