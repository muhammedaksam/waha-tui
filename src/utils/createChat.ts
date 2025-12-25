/**
 * Create New Chat Utility
 * Handles creating a new chat by sending a first message
 */

import { appState } from "../state/AppState"
import { debugLog } from "./debug"

/**
 * Start a new chat with a phone number
 * @param chatId WhatsApp Chat ID (e.g. 123456@c.us)
 */
export async function startNewChat(chatId: string): Promise<void> {
  try {
    debugLog("CreateChat", `Starting new chat with ${chatId}`)

    // In WAHA/WhatsApp Web, "starting" a chat is just navigating to it.
    // If it doesn't exist in the chat list yet, it will be created locally
    // when we send the first message.

    // 1. Set current chat in state to navigate immediately
    appState.setCurrentChat(chatId)
    appState.setCurrentView("conversation")

    // 2. We don't need to send a message immediately upon opening.
    // The user will type the message in the conversation view.
    // HOWEVER, if the chat doesn't exist in `state.chats`, the ConversationView
    // might need to handle fetching messages (which will be empty) and info differently.
  } catch (error) {
    debugLog("CreateChat", `Failed to start chat with ${chatId}: ${error}`)
  }
}
