/**
 * Message Actions
 * Functions for message-level operations (star, pin, delete, forward, react, load, send)
 */

import type { WAMessage } from "@muhammedaksam/waha-node"
import { debugLog } from "../utils/debug"
import { appState } from "../state/AppState"
import type { WAMessageExtended } from "../types"
import { getClient, getSession } from "./core"

export async function starMessage(
  messageId: string,
  chatId: string,
  star: boolean
): Promise<boolean> {
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
    return true
  } catch (error) {
    debugLog("Client", `Failed to ${star ? "star" : "unstar"} message: ${error}`)
    return false
  }
}

export async function pinMessage(
  chatId: string,
  messageId: string,
  duration: number = 604800 // 7 days in seconds (default)
): Promise<boolean> {
  try {
    const session = getSession()
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

export async function unpinMessage(chatId: string, messageId: string): Promise<boolean> {
  try {
    const session = getSession()
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

export async function deleteMessage(chatId: string, messageId: string): Promise<boolean> {
  try {
    const session = getSession()
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
  chatId: string,
  messageId: string,
  toChatId: string
): Promise<boolean> {
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
    return true
  } catch (error) {
    debugLog("Client", `Failed to forward message: ${error}`)
    return false
  }
}

export async function reactToMessage(messageId: string, reaction: string): Promise<boolean> {
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
    return true
  } catch (error) {
    debugLog("Client", `Failed to react to message: ${error}`)
    return false
  }
}

export async function loadMessages(chatId: string): Promise<void> {
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
): Promise<boolean> {
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
    return true
  } catch (error) {
    debugLog("Messages", `Failed to send message: ${error}`)
    appState.setIsSending(false)
    return false
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
