/**
 * Message Actions
 * Functions for message-level operations (star, pin, delete, forward, react, load, send)
 */

import type { WAMessage } from "@muhammedaksam/waha-node"

import type { ChatId, MessageId, WAMessageExtended } from "../types"
import { TIME_MS, TIME_S } from "../constants"
import { NetworkError } from "../services/Errors"
import { errorService } from "../services/ErrorService"
import { RetryPresets, withRetry } from "../services/RetryService"
import { appState } from "../state/AppState"
import { debugLog } from "../utils/debug"
import { getChatIdString } from "../utils/formatters"
import { getClient, getSession } from "./core"

/**
 * Star or unstar a message.
 * @param messageId - The message ID to star/unstar
 * @param chatId - The chat containing message
 * @param star - True to star, false to unstar
 * @throws {NetworkError} If network connection fails
 * @throws {AuthError} If authentication fails
 * @throws {ServerError} If server error occurs
 */
export async function starMessage(
  messageId: MessageId,
  chatId: ChatId,
  star: boolean
): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `${star ? "Starring" : "Unstarring"} message: ${messageId}`)
    const wahaClient = getClient()
    await wahaClient.chatting.chattingControllerSetStar({
      session,
      messageId,
      chatId,
      star,
    })
    debugLog("Client", `Message ${star ? "starred" : "unstarred"}: ${messageId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "starMessage", messageId, star } })
    throw error instanceof Error
      ? new NetworkError(
          `Failed to ${star ? "star" : "unstar"} message`,
          { messageId, star },
          error
        )
      : new NetworkError(`Failed to ${star ? "star" : "unstar"} message`, { messageId, star })
  }
}

/**
 * Pin a message in a chat.
 * @param chatId - The chat ID
 * @param messageId - The message ID to pin
 * @param duration - Pin duration in seconds (default: 7 days)
 * @throws {NetworkError} If network connection fails
 * @throws {AuthError} If authentication fails
 * @throws {ServerError} If server error occurs
 */
export async function pinMessage(
  chatId: ChatId,
  messageId: MessageId,
  duration: number = TIME_S.PIN_MESSAGE_DEFAULT_DURATION
): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `Pinning message: ${messageId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerPinMessage(session, chatId, messageId, {
      duration,
    })
    debugLog("Client", `Message pinned: ${messageId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "pinMessage", messageId } })
    throw error instanceof Error
      ? new NetworkError("Failed to pin message", { messageId }, error)
      : new NetworkError("Failed to pin message", { messageId })
  }
}

/**
 * Unpin a previously pinned message.
 * @param chatId - The chat ID
 * @param messageId - The message ID to unpin
 * @throws {NetworkError} If network connection fails
 * @throws {AuthError} If authentication fails
 * @throws {ServerError} If server error occurs
 */
export async function unpinMessage(chatId: ChatId, messageId: MessageId): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `Unpinning message: ${messageId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerUnpinMessage(session, chatId, messageId)
    debugLog("Client", `Message unpinned: ${messageId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "unpinMessage", messageId } })
    throw error instanceof Error
      ? new NetworkError("Failed to unpin message", { messageId }, error)
      : new NetworkError("Failed to unpin message", { messageId })
  }
}

/**
 * Delete a message from a chat.
 * @param chatId - The chat ID
 * @param messageId - The message ID to delete
 * @throws {NetworkError} If network connection fails
 * @throws {AuthError} If authentication fails
 * @throws {ServerError} If server error occurs
 */
export async function deleteMessage(chatId: ChatId, messageId: MessageId): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `Deleting message: ${messageId}`)
    const wahaClient = getClient()
    await wahaClient.chats.chatsControllerDeleteMessage(session, chatId, messageId)
    debugLog("Client", `Message deleted: ${messageId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "deleteMessage", messageId } })
    throw error instanceof Error
      ? new NetworkError("Failed to delete message", { messageId }, error)
      : new NetworkError("Failed to delete message", { messageId })
  }
}

export async function forwardMessage(
  chatId: ChatId,
  messageId: MessageId,
  toChatId: ChatId
): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `Forwarding message ${messageId} to ${toChatId}`)
    const wahaClient = getClient()
    await wahaClient.chatting.chattingControllerForwardMessage({
      session,
      chatId: toChatId,
      messageId,
    })
    debugLog("Client", `Message forwarded: ${messageId} -> ${toChatId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "forwardMessage", messageId, toChatId } })
    throw error instanceof Error
      ? new NetworkError("Failed to forward message", { messageId, toChatId }, error)
      : new NetworkError("Failed to forward message", { messageId, toChatId })
  }
}

export async function reactToMessage(messageId: string, reaction: string): Promise<void> {
  try {
    const session = getSession()
    debugLog("Client", `Reacting to message ${messageId} with ${reaction}`)
    const wahaClient = getClient()
    await wahaClient.chatting.chattingControllerSetReaction({
      session,
      messageId,
      reaction,
    })
    debugLog("Client", `Reaction set: ${reaction} on ${messageId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "reactToMessage", messageId, reaction } })
    throw error instanceof Error
      ? new NetworkError("Failed to set reaction", { messageId, reaction }, error)
      : new NetworkError("Failed to set reaction", { messageId, reaction })
  }
}

export async function loadMessages(chatId: string): Promise<void> {
  try {
    const wahaClient = getClient()
    const session = getSession()

    const response = await withRetry(
      () =>
        wahaClient.chats.chatsControllerGetChatMessages(session, chatId, {
          limit: 50,
          downloadMedia: false,
          sortBy: "messageTimestamp",
          sortOrder: "desc",
        }),
      {
        ...RetryPresets.quick,
        onRetry: (attempt, delay) => {
          debugLog("Messages", `Retry attempt ${attempt}, waiting ${delay}ms...`)
        },
      }
    )

    const messages = (response.data as unknown as WAMessage[]) || []

    // Attempt to normalize reactions if found in _data
    messages.forEach((msg: WAMessageExtended) => {
      if (
        msg._data?.hasReaction &&
        msg._data?.reactions &&
        (!msg.reactions || msg.reactions.length === 0)
      ) {
        try {
          const rawReactions = msg._data.reactions as Array<{
            aggregateEmoji: string
            senders: Array<{ id: string }>
          }>

          if (Array.isArray(rawReactions)) {
            const normalizedReactions: Array<{ text: string; id: string; from?: string }> = []

            rawReactions.forEach((reactionGroup) => {
              const emoji = reactionGroup.aggregateEmoji
              if (Array.isArray(reactionGroup.senders)) {
                reactionGroup.senders.forEach((sender) => {
                  normalizedReactions.push({
                    text: emoji,
                    id: `${msg.id}_${emoji}_${sender.id}`,
                    from: sender.id,
                  })
                })
              }
            })

            if (normalizedReactions.length > 0) {
              msg.reactions = normalizedReactions
            }
          }
        } catch (e) {
          debugLog("Messages", `Failed to parse reactions for message ${msg.id}: ${e}`)
        }
      }
    })

    appState.setMessages(chatId, messages as WAMessageExtended[])
  } catch (error) {
    debugLog("Messages", `Failed to load messages: ${error}`)
    appState.setMessages(chatId, [])
  }
}

let isLoadingMore = false

export async function loadOlderMessages(): Promise<void> {
  const state = appState.getState()
  if (!state.currentChatId || !state.currentSession || isLoadingMore) {
    return
  }

  const currentMessages = state.messages.get(state.currentChatId) || []
  if (currentMessages.length === 0) return

  isLoadingMore = true
  const offset = currentMessages.length
  debugLog("Messages", `Loading older messages with offset ${offset}`)

  try {
    const wahaClient = getClient()
    const response = await wahaClient.chats.chatsControllerGetChatMessages(
      state.currentSession,
      state.currentChatId,
      {
        limit: 50,
        offset: offset,
        downloadMedia: false,
        sortBy: "messageTimestamp",
        sortOrder: "desc",
      }
    )

    const newMessages = (response.data as unknown as WAMessage[]) || []

    if (newMessages.length > 0) {
      debugLog("Messages", `Loaded ${newMessages.length} older messages`)
      const combinedMessages = [...currentMessages, ...newMessages]
      appState.setMessages(state.currentChatId, combinedMessages)
    } else {
      debugLog("Messages", "No more older messages available")
    }
  } catch (error) {
    debugLog("Messages", `Failed to load older messages: ${error}`)
  } finally {
    isLoadingMore = false
  }
}

export async function sendMessage(
  chatId: string,
  text: string,
  replyToMsgId?: string
): Promise<void> {
  try {
    const session = getSession()
    debugLog(
      "Messages",
      `Sending message to ${chatId}: ${text}${replyToMsgId ? ` (replying to ${replyToMsgId})` : ""}`
    )
    appState.setIsSending(true)

    const wahaClient = getClient()
    await wahaClient.chatting.chattingControllerSendText({
      session,
      chatId,
      text,
      ...(replyToMsgId && { reply_to: replyToMsgId }),
    })

    debugLog("Messages", "Message sent successfully")
    appState.setReplyingToMessage(null)

    await loadMessages(chatId)
    appState.setIsSending(false)
  } catch (error) {
    debugLog("Messages", `Failed to send message: ${error}`)
    appState.setIsSending(false)
    errorService.handle(error, { context: { action: "sendMessage", chatId, replyToMsgId } })
    throw error instanceof Error
      ? new NetworkError("Failed to send message", { chatId }, error)
      : new NetworkError("Failed to send message", { chatId })
  }
}

export async function sendTypingState(
  chatId: string,
  state: "composing" | "paused"
): Promise<void> {
  try {
    const session = getSession()
    const wahaClient = getClient()

    if (state === "composing") {
      await wahaClient.chatting.chattingControllerStartTyping({
        session,
        chatId,
      })
    } else {
      await wahaClient.chatting.chattingControllerStopTyping({
        session,
        chatId,
      })
    }
  } catch (error) {
    debugLog("Typing", `Failed to send typing state: ${error}`)
  }
}

/**
 * Pre-fetch messages for top N chats in the background
 * This improves chat switching performance by having messages ready
 * Only runs if backgroundSync setting is enabled
 */
export async function prefetchMessagesForTopChats(count: number = 5): Promise<void> {
  const state = appState.getState()

  // Check if background sync is enabled
  if (!state.backgroundSync) {
    debugLog("BackgroundSync", "Background sync disabled, skipping prefetch")
    return
  }

  const chats = state.chats.slice(0, count)
  if (chats.length === 0) {
    debugLog("BackgroundSync", "No chats to prefetch")
    return
  }

  debugLog("BackgroundSync", `Pre-fetching messages for top ${chats.length} chats`)

  // Process chats sequentially to avoid overwhelming the API
  for (const chat of chats) {
    const chatId = getChatIdString(chat.id)
    if (!chatId) continue

    // Skip if already cached
    if (state.messages.has(chatId) && (state.messages.get(chatId)?.length ?? 0) > 0) {
      debugLog("BackgroundSync", `Chat ${chatId} already cached, skipping`)
      continue
    }

    try {
      const wahaClient = getClient()
      const session = getSession()
      const response = await wahaClient.chats.chatsControllerGetChatMessages(session, chatId, {
        limit: 50,
        downloadMedia: false,
        sortBy: "messageTimestamp",
        sortOrder: "desc",
      })
      const messages = (response.data as unknown as WAMessage[]) || []

      // Store in state without triggering UI update for non-current chat
      appState.setMessages(chatId, messages as WAMessageExtended[])
      debugLog("BackgroundSync", `Pre-fetched ${messages.length} messages for ${chatId}`)

      // Small delay between requests to be nice to the API
      await new Promise((resolve) => setTimeout(resolve, TIME_MS.SEND_MESSAGE_RELOAD_DELAY))
    } catch (error) {
      debugLog("BackgroundSync", `Failed to prefetch messages for ${chatId}: ${error}`)
    }
  }

  debugLog("BackgroundSync", "Pre-fetch complete")
}
