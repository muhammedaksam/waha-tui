/**
 * Chat Actions
 * Functions for chat-level operations (archive, unarchive, delete, mark unread)
 */

import type { ChatId } from "../types"
import { errorService } from "../services/ErrorService"
import { debugLog } from "../utils/debug"
import { getClient, getSession } from "./core"

/**
 * Archive a chat.
 * @param chatId - The chat ID to archive
 * @returns True if successful, false otherwise
 */

export async function archiveChat(chatId: ChatId): Promise<boolean> {
  try {
    const session = getSession()
    debugLog("Client", `Archiving chat: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerArchiveChat(session, chatId)
    debugLog("Client", `Chat archived successfully: ${chatId}`)
    return true
  } catch (error) {
    errorService.handle(error, { context: { action: "archiveChat", chatId } })
    return false
  }
}

/**
 * Unarchive a chat.
 * @param chatId - The chat ID to unarchive
 * @returns True if successful, false otherwise
 */

export async function unarchiveChat(chatId: ChatId): Promise<boolean> {
  try {
    const session = getSession()
    debugLog("Client", `Unarchiving chat: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerUnarchiveChat(session, chatId)
    debugLog("Client", `Chat unarchived successfully: ${chatId}`)
    return true
  } catch (error) {
    errorService.handle(error, { context: { action: "unarchiveChat", chatId } })
    return false
  }
}

/**
 * Mark a chat as unread.
 * @param chatId - The chat ID to mark unread
 * @returns True if successful, false otherwise
 */

export async function markChatUnread(chatId: ChatId): Promise<boolean> {
  try {
    const session = getSession()
    debugLog("Client", `Marking chat as unread: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerUnreadChat(session, chatId)
    debugLog("Client", `Chat marked as unread: ${chatId}`)
    return true
  } catch (error) {
    errorService.handle(error, { context: { action: "markChatUnread", chatId } })
    return false
  }
}

/**
 * Delete a chat permanently.
 * @param chatId - The chat ID to delete
 * @returns True if successful, false otherwise
 */

export async function deleteChat(chatId: ChatId): Promise<boolean> {
  try {
    const session = getSession()
    debugLog("Client", `Deleting chat: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerDeleteChat(session, chatId)
    debugLog("Client", `Chat deleted successfully: ${chatId}`)
    return true
  } catch (error) {
    errorService.handle(error, { context: { action: "deleteChat", chatId } })
    return false
  }
}
