/**
 * Chat Actions
 * Functions for chat-level operations (archive, unarchive, delete, mark unread)
 */

import { debugLog } from "../utils/debug"
import { getClient, getSession } from "./core"

export async function archiveChat(chatId: string): Promise<boolean> {
  try {
    const session = getSession()
    debugLog("Client", `Archiving chat: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerArchiveChat(session, chatId)
    debugLog("Client", `Chat archived successfully: ${chatId}`)
    return true
  } catch (error) {
    debugLog("Client", `Failed to archive chat: ${error}`)
    return false
  }
}

export async function unarchiveChat(chatId: string): Promise<boolean> {
  try {
    const session = getSession()
    debugLog("Client", `Unarchiving chat: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerUnarchiveChat(session, chatId)
    debugLog("Client", `Chat unarchived successfully: ${chatId}`)
    return true
  } catch (error) {
    debugLog("Client", `Failed to unarchive chat: ${error}`)
    return false
  }
}

export async function markChatUnread(chatId: string): Promise<boolean> {
  try {
    const session = getSession()
    debugLog("Client", `Marking chat as unread: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerUnreadChat(session, chatId)
    debugLog("Client", `Chat marked as unread: ${chatId}`)
    return true
  } catch (error) {
    debugLog("Client", `Failed to mark chat as unread: ${error}`)
    return false
  }
}

export async function deleteChat(chatId: string): Promise<boolean> {
  try {
    const session = getSession()
    debugLog("Client", `Deleting chat: ${chatId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerDeleteChat(session, chatId)
    debugLog("Client", `Chat deleted successfully: ${chatId}`)
    return true
  } catch (error) {
    debugLog("Client", `Failed to delete chat: ${error}`)
    return false
  }
}
