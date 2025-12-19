/**
 * WAHA Client
 * Singleton client for interacting with WAHA API
 */

import { WahaClient } from "@muhammedaksam/waha-node"
import type { WahaTuiConfig } from "./config/schema"
import { debugLog, debugRequest, debugResponse, DEBUG_ENABLED } from "./utils/debug"
import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from "axios"

let client: WahaClient | null = null

export function initializeClient(config: WahaTuiConfig): WahaClient {
  debugLog("Client", `Initializing WAHA client: ${config.wahaUrl}`)
  client = new WahaClient(config.wahaUrl, config.wahaApiKey)

  // Add axios interceptors for automatic request/response logging
  if (DEBUG_ENABLED) {
    // Access the axios instance via the new httpClient getter
    const httpClient = client.httpClient

    if (httpClient) {
      debugLog("Client", "Configuring axios interceptors for automatic API logging")
      // Request interceptor
      httpClient.interceptors.request.use(
        (requestConfig: InternalAxiosRequestConfig) => {
          const method = requestConfig.method?.toUpperCase() || "UNKNOWN"
          const url = requestConfig.url || "unknown"
          debugRequest(method, url, requestConfig.data)
          return requestConfig
        },
        (error: AxiosError) => {
          debugLog("API", `Request error: ${error.message}`)
          return Promise.reject(error)
        }
      )

      // Response interceptor
      httpClient.interceptors.response.use(
        (response: AxiosResponse) => {
          const status = response.status
          const url = response.config.url || "unknown"
          const body =
            typeof response.data === "string" ? response.data : JSON.stringify(response.data)
          debugResponse(status, url, body)
          return response
        },
        (error: AxiosError) => {
          const status = error.response?.status || 0
          const url = error.config?.url || "unknown"
          debugLog("API", `Response error ${status} from ${url}: ${error.message}`)
          return Promise.reject(error)
        }
      )

      debugLog("Client", "Axios interceptors configured for automatic API logging")
    } else {
      debugLog("Client", "Warning: Could not access httpClient for interceptors")
    }
  }

  debugLog("Client", "WAHA client initialized successfully")
  return client
}

export function getClient(): WahaClient {
  if (!client) {
    throw new Error("WAHA client not initialized. Call initializeClient() first.")
  }
  return client
}

export async function testConnection(config: WahaTuiConfig): Promise<boolean> {
  try {
    debugLog("Client", `Testing connection to ${config.wahaUrl}`)
    const testClient = new WahaClient(config.wahaUrl, config.wahaApiKey)
    // Try to list sessions as a health check
    await testClient.sessions.sessionsControllerList()
    debugLog("Client", "Connection test successful")
    return true
  } catch (error) {
    debugLog("Client", `Connection test failed: ${error}`)
    return false
  }
}

// ============================================
// Chat Actions
// ============================================

export async function archiveChat(session: string, chatId: string): Promise<boolean> {
  try {
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

export async function unarchiveChat(session: string, chatId: string): Promise<boolean> {
  try {
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

export async function markChatUnread(session: string, chatId: string): Promise<boolean> {
  try {
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

export async function deleteChat(session: string, chatId: string): Promise<boolean> {
  try {
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

// ============================================
// Message Actions
// ============================================

export async function starMessage(
  session: string,
  messageId: string,
  chatId: string,
  star: boolean
): Promise<boolean> {
  try {
    debugLog("Client", `${star ? "Starring" : "Unstarring"} message: ${messageId}`)
    const wahaClient = getClient()
    await wahaClient.chatting.chattingControllerSetStar({
      session,
      messageId,
      chatId,
      star,
    })
    debugLog("Client", `Message ${star ? "starred" : "unstarred"}: ${messageId}`)
    return true
  } catch (error) {
    debugLog("Client", `Failed to ${star ? "star" : "unstar"} message: ${error}`)
    return false
  }
}

export async function pinMessage(
  session: string,
  chatId: string,
  messageId: string,
  duration: number = 604800 // 7 days in seconds (default)
): Promise<boolean> {
  try {
    debugLog("Client", `Pinning message: ${messageId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerPinMessage(session, chatId, messageId, {
      duration,
    })
    debugLog("Client", `Message pinned: ${messageId}`)
    return true
  } catch (error) {
    debugLog("Client", `Failed to pin message: ${error}`)
    return false
  }
}

export async function unpinMessage(
  session: string,
  chatId: string,
  messageId: string
): Promise<boolean> {
  try {
    debugLog("Client", `Unpinning message: ${messageId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerUnpinMessage(session, chatId, messageId)
    debugLog("Client", `Message unpinned: ${messageId}`)
    return true
  } catch (error) {
    debugLog("Client", `Failed to unpin message: ${error}`)
    return false
  }
}

export async function deleteMessage(
  session: string,
  chatId: string,
  messageId: string
): Promise<boolean> {
  try {
    debugLog("Client", `Deleting message: ${messageId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerDeleteMessage(session, chatId, messageId)
    debugLog("Client", `Message deleted: ${messageId}`)
    return true
  } catch (error) {
    debugLog("Client", `Failed to delete message: ${error}`)
    return false
  }
}

export async function forwardMessage(
  session: string,
  chatId: string,
  messageId: string,
  toChatId: string
): Promise<boolean> {
  try {
    debugLog("Client", `Forwarding message ${messageId} to ${toChatId}`)
    const wahaClient = getClient()
    await wahaClient.chatting.chattingControllerForwardMessage({
      session,
      chatId: toChatId,
      messageId,
    })
    debugLog("Client", `Message forwarded: ${messageId} -> ${toChatId}`)
    return true
  } catch (error) {
    debugLog("Client", `Failed to forward message: ${error}`)
    return false
  }
}

export async function reactToMessage(
  session: string,
  messageId: string,
  reaction: string
): Promise<boolean> {
  try {
    debugLog("Client", `Reacting to message ${messageId} with ${reaction}`)
    const wahaClient = getClient()
    await wahaClient.chatting.chattingControllerSetReaction({
      session,
      messageId,
      reaction,
    })
    debugLog("Client", `Reaction set: ${reaction} on ${messageId}`)
    return true
  } catch (error) {
    debugLog("Client", `Failed to react to message: ${error}`)
    return false
  }
}
