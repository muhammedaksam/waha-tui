/**
 * Chat Actions
 * Functions for chat-level operations (archive, unarchive, delete, mark unread, ephemeral)
 */

import type { ChatId } from "~/types"
import { getClient, getSession } from "~/client/core"
import { NetworkError } from "~/services/Errors"
import { errorService } from "~/services/ErrorService"
import { appState } from "~/state/AppState"
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
 * Mark chas as read
 * @throws {NetworkError} If network connection fails
 * @throws {AuthError} If authentication fails
 * @throws {ServerError} If server error occurs
 */

export async function markChatRead(chatId: ChatId): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `Marking chat as read: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerReadChatMessages(session, chatId)
    debugLog("Client", `Chat marked as read: ${chatId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "markChatread", chatId } })
    throw error instanceof Error
      ? new NetworkError("Failed to mark chat as read", { chatId }, error)
      : new NetworkError("Failed to mark chat as read", { chatId })
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

/**
 * Set disappearing messages (ephemeral) duration for a chat.
 * @param chatId The chat ID
 * @param duration Duration in seconds (0 = off, 86400 = 24h, 604800 = 7d, 7776000 = 90d)
 */
export async function setChatEphemeral(chatId: ChatId, duration: number): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    debugLog("Chats", `Setting ephemeral duration for ${chatId} to ${duration}s`)

    // Attempt to call the endpoint directly as it's missing from the generated SDK
    // Probable endpoint: POST /api/{session}/chats/{chatId}/ephemeral
    // Body: { duration: number }

    if (!wahaClient.httpClient) {
      throw new Error("WahaClient httpClient is not available")
    }

    try {
      const isGroup = chatId.endsWith("@g.us")
      const baseUrl = isGroup
        ? `/api/${session}/groups/${chatId}`
        : `/api/${session}/chats/${chatId}`

      try {
        await wahaClient.httpClient.post(`${baseUrl}/ephemeral`, {
          duration: duration,
        })
      } catch (e: unknown) {
        if (e && typeof e === "object" && "response" in e) {
          const response = e.response as { status?: number }
          if (response?.status === 404) {
            debugLog("Chats", `POST ${baseUrl}/ephemeral failed with 404, trying PUT...`)
            await wahaClient.httpClient.put(`${baseUrl}/ephemeral`, {
              duration: duration,
            })
          } else {
            throw e
          }
        } else {
          throw e
        }
      }
    } catch (e: unknown) {
      if (e && typeof e === "object" && "response" in e) {
        const response = e.response as { status?: number }
        if (response?.status === 404) {
          throw new Error(
            "Ephemeral messages setting is not supported by your WAHA version/tier or engine (NOWEB required).",
            { cause: e }
          )
        }
      }
      throw e
    }

    // Update local state
    appState.updateChatEphemeralDuration(chatId, duration)

    debugLog("Chats", `Successfully updated ephemeral duration for ${chatId}`)
  } catch (error) {
    errorService.handle(error, {
      context: {
        action: "setChatEphemeral",
        chatId,
        duration,
      },
      notify: true,
    })
    throw error
  }
}
