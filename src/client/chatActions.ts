/**
 * Chat Actions
 * Functions for chat-level operations (archive, unarchive, delete, mark unread)
 */

import type { ChatId } from "~/types"
import { getClient, getSession } from "~/client/core"
import { NetworkError } from "~/services/Errors"
import { errorService } from "~/services/ErrorService"
import { debugLog } from "~/utils/debug"

/**
 * Archive a chat.
 * @param chatId - The chat ID to archive
 * @throws {NetworkError} If network connection fails
 * @throws {AuthError} If authentication fails
 * @throws {ServerError} If server error occurs
 */

export async function archiveChat(chatId: ChatId): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `Archiving chat: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerArchiveChat(session, chatId)
    debugLog("Client", `Chat archived successfully: ${chatId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "archiveChat", chatId } })
    throw error instanceof Error
      ? new NetworkError("Failed to archive chat", { chatId }, error)
      : new NetworkError("Failed to archive chat", { chatId })
  }
}

/**
 * Unarchive a chat.
 * @param chatId - The chat ID to unarchive
 * @throws {NetworkError} If network connection fails
 * @throws {AuthError} If authentication fails
 * @throws {ServerError} If server error occurs
 */

export async function unarchiveChat(chatId: ChatId): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `Unarchiving chat: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerUnarchiveChat(session, chatId)
    debugLog("Client", `Chat unarchived successfully: ${chatId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "unarchiveChat", chatId } })
    throw error instanceof Error
      ? new NetworkError("Failed to unarchive chat", { chatId }, error)
      : new NetworkError("Failed to unarchive chat", { chatId })
  }
}

/**
 * Mark a chat as unread.
 * @param chatId - The chat ID to mark unread
 * @throws {NetworkError} If network connection fails
 * @throws {AuthError} If authentication fails
 * @throws {ServerError} If server error occurs
 */

export async function markChatUnread(chatId: ChatId): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `Marking chat as unread: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerUnreadChat(session, chatId)
    debugLog("Client", `Chat marked as unread: ${chatId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "markChatUnread", chatId } })
    throw error instanceof Error
      ? new NetworkError("Failed to mark chat as unread", { chatId }, error)
      : new NetworkError("Failed to mark chat as unread", { chatId })
  }
}

/**
 * Delete a chat permanently.
 * @param chatId - The chat ID to delete
 * @throws {NetworkError} If network connection fails
 * @throws {AuthError} If authentication fails
 * @throws {ServerError} If server error occurs
 */

export async function deleteChat(chatId: ChatId): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `Deleting chat: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerDeleteChat(session, chatId)
    debugLog("Client", `Chat deleted successfully: ${chatId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "deleteChat", chatId } })
    throw error instanceof Error
      ? new NetworkError("Failed to delete chat", { chatId }, error)
      : new NetworkError("Failed to delete chat", { chatId })
  }
}
