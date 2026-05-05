import type { WAMessage } from "@muhammedaksam/waha-node"

import type { ContextMenuState } from "~/state/AppState"
import type { WAMessageExtended } from "~/types"
import {
  archiveChat,
  copyToClipboard,
  deleteChat,
  deleteMessage,
  downloadAndOpenMedia,
  editMessage,
  forwardMessage,
  loadChats,
  loadMessages,
  markChatUnread,
  pinMessage,
  reactToMessage,
  starMessage,
  unarchiveChat,
} from "~/client"
import { markChatRead } from "~/client/chatActions"
import { showChatPicker } from "~/components/ChatPickerDialog"
import { showEmojiPicker } from "~/components/EmojiPicker"
import { showInputModal } from "~/components/Modal"
import { showToast } from "~/components/Toast"
import { getSettings, saveSettings } from "~/config/manager"
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
    // Check if actionId has a prefix (e.g. react:👍)
    let action = actionId
    let payload = ""
    if (actionId.includes(":")) {
      const parts = actionId.split(":")
      action = parts[0]
      payload = parts.slice(1).join(":")
    }

    if (contextMenu.type === "chat") {
      // Chat actions
      switch (action) {
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
        case "read":
          await markChatRead(targetId)
          await loadChats()
          break
        case "pin": {
          // WAHA doesn't expose a pin/unpin chat API — only message pinning is available
          showToast("Pin/unpin chat is not supported by WAHA API", "info")
          break
        }
        case "mute": {
          // WAHA doesn't expose a mute/unmute chat API
          showToast("Mute/unmute is not supported by WAHA API", "info")
          break
        }
        case "delete":
          await deleteChat(targetId)
          await loadChats()
          break
      }
    } else if (contextMenu.type === "message") {
      // Message actions
      switch (action) {
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
        case "open_emoji_picker": {
          const position = state.contextMenu?.position
          appState.closeContextMenu()
          const emoji = await showEmojiPicker(position)
          if (emoji) {
            await reactToMessage(targetId, emoji)
          }
          break
        }
        case "react": {
          let emoji: string | null = payload
          if (!emoji) {
            // In case it's still sent as "react" without payload
            const position = state.contextMenu?.position
            appState.closeContextMenu()
            emoji = await showEmojiPicker(position)
          }
          if (emoji) {
            await reactToMessage(targetId, emoji)

            // Add to recent emojis
            const currentSettings = await getSettings()
            const recent = currentSettings.recentEmojis || []

            // Keep only latest 24 unique emojis
            const newRecent = [emoji, ...recent.filter((e: string) => e !== emoji)].slice(0, 24)
            appState.setRecentEmojis(newRecent)
            await saveSettings({ recentEmojis: newRecent })
          }
          break
        }
        case "unreact": {
          // Empty string removes the reaction
          await reactToMessage(targetId, "")
          break
        }
        case "delete": {
          if (state.currentChatId) {
            await deleteMessage(state.currentChatId, targetId)
            // For "delete for me", just remove from the local message list
            await loadMessages(state.currentChatId)
          }
          break
        }
        case "edit": {
          const message = contextMenu.targetData as WAMessageExtended
          if (!message?.body || !state.currentChatId) break

          // Close context menu before showing modal
          appState.closeContextMenu()

          const newText = await showInputModal(
            "Edit Message",
            "Enter new message text...",
            message.body
          )

          if (newText !== null && newText.trim() && newText !== message.body) {
            try {
              await editMessage(state.currentChatId, targetId, newText.trim())
              showToast("Message edited", "success")
            } catch {
              showToast("Failed to edit message", "error")
            }
          }
          break
        }
        case "delete-for-everyone": {
          if (state.currentChatId) {
            await deleteMessage(state.currentChatId, targetId)
            // Optimistically show the revoked placeholder
            appState.markMessageRevoked(state.currentChatId, targetId)
          }
          break
        }
        case "forward": {
          const message = contextMenu.targetData as WAMessageExtended
          if (!message) break

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
                  await forwardMessage(originalChatId, targetId, getChatIdString(chat.id))
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
