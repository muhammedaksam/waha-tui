/**
 * Polling Service
 * Manages background polling for real-time updates
 */

import { appState } from "../state/AppState"
import { loadMessages, pollChats, fetchMyProfile } from "../client"
import { debugLog } from "../utils/debug"

// Polling intervals in milliseconds
const CHATS_POLL_INTERVAL = 3000 // 3 seconds for chat list
const MESSAGES_POLL_INTERVAL = 2000 // 2 seconds for active conversation

class PollingService {
  private chatsTimer: NodeJS.Timeout | null = null
  private messagesTimer: NodeJS.Timeout | null = null
  private isPollingChats = false
  private isPollingMessages = false

  public start(sessionName: string): void {
    this.stop() // Clear existing timers
    debugLog("Polling", `Starting polling service for session: ${sessionName}`)

    // Fetch current user's profile for self-chat detection
    fetchMyProfile()

    // Start chats polling
    this.chatsTimer = setInterval(() => this.doPollChats(), CHATS_POLL_INTERVAL)

    // Start messages polling (will only actually poll if a chat is selected)
    this.messagesTimer = setInterval(() => this.pollMessages(), MESSAGES_POLL_INTERVAL)
  }

  public stop(): void {
    if (this.chatsTimer) {
      clearInterval(this.chatsTimer)
      this.chatsTimer = null
    }
    if (this.messagesTimer) {
      clearInterval(this.messagesTimer)
      this.messagesTimer = null
    }
    debugLog("Polling", "Stopped polling service")
  }

  private async doPollChats(): Promise<void> {
    if (this.isPollingChats) return
    this.isPollingChats = true

    try {
      await pollChats()
    } catch {
      // Silent error for polling
    } finally {
      this.isPollingChats = false
    }
  }

  private async pollMessages(): Promise<void> {
    if (this.isPollingMessages) return

    const state = appState.getState()
    const currentChatId = state.currentChatId

    // Only poll if we are in conversation view/have a chat selected
    if (!currentChatId || state.currentView !== "conversation") {
      return
    }

    this.isPollingMessages = true

    try {
      // We use loadMessages which already updates the state
      // It fetches the latest 50 messages, which should include any new ones
      await loadMessages(currentChatId)
    } catch {
      // Silent error
    } finally {
      this.isPollingMessages = false
    }
  }
}

export const pollingService = new PollingService()
