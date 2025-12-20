/**
 * WAHA Client
 * Singleton client for interacting with WAHA API
 */

import { WahaClient, WAMessage } from "@muhammedaksam/waha-node"
import type {
  ChatSummary,
  SessionInfo,
  WAHAChatPresences,
  GroupParticipant,
} from "@muhammedaksam/waha-node"
import type { WahaTuiConfig } from "./config/schema"
import { debugLog, debugRequest, debugResponse, DEBUG_ENABLED } from "./utils/debug"
import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from "axios"
import { appState } from "./state/AppState"
import type { WAMessageExtended } from "./types"

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

/**
 * Get the initialized WAHA client
 * Throws error if client is not initialized
 */
export function getClient(): WahaClient {
  if (!client) {
    throw new Error("WAHA client not initialized. Call initializeClient() first.")
  }
  return client
}

/**
 * Get current session from appState
 * Throws error if no session is active
 */
function getSession(): string {
  const session = appState.getState().currentSession
  if (!session) {
    throw new Error("No active session. Please select a session first.")
  }
  return session
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

// ============================================
// Message Actions
// ============================================

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
    // Polling-related log removed to reduce spam
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
      // If we have reactions in _data, but NOT in our root reactions field yet
      if (
        msg._data?.hasReaction &&
        msg._data?.reactions &&
        (!msg.reactions || msg.reactions.length === 0)
      ) {
        try {
          // Format from WAWebJS/WAHA:
          // reactions: [{ id: '...', aggregateEmoji: '...', senders: [...] }]
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
                    id: `${msg.id}_${emoji}_${sender.id}`, // Generate a unique ID
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

    // Polling-related log removed to reduce spam
    appState.setMessages(chatId, messages as WAMessageExtended[])
  } catch (error) {
    debugLog("Messages", `Failed to load messages: ${error}`)
    appState.setMessages(chatId, [])
  }
}

// ============================================
// Utility Functions
// ============================================

interface ClipboardTool {
  command: string
  args: string[]
}

/**
 * Try to copy text using a specific clipboard tool
 */
async function tryClipboardTool(text: string, tool: ClipboardTool): Promise<boolean> {
  const { spawn } = await import("child_process")

  return new Promise((resolve) => {
    const proc = spawn(tool.command, tool.args, {
      stdio: ["pipe", "ignore", "ignore"],
    })

    proc.stdin?.write(text)
    proc.stdin?.end()

    proc.on("close", (code) => {
      if (code === 0) {
        debugLog("Client", `Copied to clipboard using ${tool.command}`)
        resolve(true)
      } else {
        resolve(false)
      }
    })

    proc.on("error", () => {
      resolve(false)
    })
  })
}

/**
 * Copy text to system clipboard using platform-specific command
 * Returns true if successful, false otherwise
 *
 * Linux fallback order: wl-copy (Wayland) -> xclip (X11) -> xsel (X11)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const platform = process.platform

    if (platform === "darwin") {
      // macOS - use pbcopy
      const success = await tryClipboardTool(text, { command: "pbcopy", args: [] })
      if (success) {
        debugLog("Client", `Copied: ${text.substring(0, 50)}...`)
      }
      return success
    } else if (platform === "win32") {
      // Windows - use clip
      const success = await tryClipboardTool(text, { command: "clip", args: [] })
      if (success) {
        debugLog("Client", `Copied: ${text.substring(0, 50)}...`)
      }
      return success
    } else if (platform === "linux") {
      // Linux - try multiple clipboard tools in order of preference
      const linuxTools: ClipboardTool[] = [
        { command: "wl-copy", args: [] }, // Wayland (GNOME, KDE on Wayland)
        { command: "xclip", args: ["-selection", "clipboard"] }, // X11
        { command: "xsel", args: ["--clipboard", "--input"] }, // X11 alternative
      ]

      for (const tool of linuxTools) {
        const success = await tryClipboardTool(text, tool)
        if (success) {
          debugLog("Client", `Copied: ${text.substring(0, 50)}...`)
          return true
        }
      }

      debugLog("Client", "No clipboard tool available. Install wl-copy, xclip, or xsel.")
      return false
    } else {
      debugLog("Client", `Clipboard not supported on platform: ${platform}`)
      return false
    }
  } catch (error) {
    debugLog("Client", `Failed to copy to clipboard: ${error}`)
    return false
  }
}

// ============================================
// Session Management
// ============================================

export async function loadSessions(): Promise<void> {
  try {
    debugLog("Session", "Loading sessions from WAHA API")
    appState.setConnectionStatus("connecting")
    const wahaClient = getClient()
    const { data: sessions } = await wahaClient.sessions.sessionsControllerList()
    debugLog("Session", `Loaded ${sessions?.length ?? 0} sessions`)
    appState.setSessions((sessions as SessionInfo[]) ?? [])
    appState.setConnectionStatus("connected")
  } catch (error) {
    debugLog("Session", `Failed to load sessions: ${error}`)
    appState.setConnectionStatus("error", `Failed to load sessions: ${error}`)
    appState.setSessions([])
  }
}

export async function logoutSession(): Promise<void> {
  const state = appState.getState()
  const sessionName = state.currentSession

  if (!sessionName) {
    debugLog("Session", "No session to logout from")
    return
  }

  try {
    debugLog("Session", `Logging out from session: ${sessionName}`)
    const wahaClient = getClient()
    await wahaClient.sessions.sessionsControllerLogout(sessionName)
    debugLog("Session", `Successfully logged out from: ${sessionName}`)

    appState.setCurrentSession(null)
    appState.setCurrentView("sessions")
    await loadSessions()
  } catch (error) {
    debugLog("Session", `Failed to logout: ${error}`)
  }
}

export async function deleteSession(): Promise<void> {
  const state = appState.getState()
  const sessionName = state.currentSession

  if (!sessionName) {
    debugLog("Session", "No session to delete")
    return
  }

  try {
    debugLog("Session", `Deleting session: ${sessionName}`)
    const wahaClient = getClient()
    await wahaClient.sessions.sessionsControllerDelete(sessionName)
    debugLog("Session", `Successfully deleted: ${sessionName}`)

    appState.setCurrentSession(null)
    appState.setCurrentView("sessions")
    await loadSessions()
  } catch (error) {
    debugLog("Session", `Failed to delete session: ${error}`)
  }
}

/**
 * Load all contacts from WAHA API
 * This populates a full contact list for search (not just contacts with chats)
 */
export async function loadAllContacts(): Promise<Map<string, string>> {
  const session = getSession()

  debugLog("Contacts", `Loading all contacts for session: ${session}`)

  try {
    const client = getClient()
    // The API returns an array of contact objects
    const response = await client.contacts.contactsControllerGetAll({
      session,
      limit: 10000, // Get all contacts
      sortBy: "name",
    })

    // The actual API response format is different than the Contact interface
    // It returns objects with { id, name, pushname, ... }
    const contacts = response.data as unknown as Array<{
      id: string
      name?: string
      pushname?: string
      shortName?: string
    }>

    const contactMap = new Map<string, string>()

    for (const contact of contacts) {
      // Use name, fallback to pushname, then shortName
      const contactName = contact.name || contact.pushname || contact.shortName

      if (contact.id && contactName) {
        contactMap.set(contact.id, contactName)
      }
    }

    debugLog("Contacts", `Loaded ${contactMap.size} contacts`)
    return contactMap
  } catch (error) {
    debugLog("Contacts", `Error loading contacts: ${error}`)
    // Return empty map on error
    return new Map()
  }
}

// ============================================
// Chats
// ============================================

export async function loadChats(): Promise<void> {
  try {
    const session = getSession()
    debugLog("Chats", `Loading chats for session: ${session}`)
    const wahaClient = getClient()
    const response = await wahaClient.chats.chatsControllerGetChats(session, {})
    const chats = (response.data as unknown as ChatSummary[]) || []
    debugLog("Chats", `Loaded ${chats.length} chats`)
    appState.setChats(chats)

    // Also load all contacts for comprehensive search
    const allContacts = await loadAllContacts()
    appState.setAllContacts(allContacts)
  } catch (error) {
    debugLog("Chats", `Failed to load chats: ${error}`)
    appState.setChats([])
  }
}

export async function pollChats(): Promise<void> {
  try {
    const session = getSession()
    const wahaClient = getClient()
    const response = await wahaClient.chats.chatsControllerGetChatsOverview(session, {
      limit: 1000,
    })
    const chats = (response.data as unknown as ChatSummary[]) || []
    appState.setChats(chats)
  } catch {
    // Silent error for polling
  }
}

// ============================================
// Contacts
// ============================================

export async function loadContacts(): Promise<void> {
  try {
    const state = appState.getState()
    if (state.contactsCache.size > 0) return

    const session = getSession()
    debugLog("Contacts", `Loading contacts for session: ${session}`)
    const wahaClient = getClient()
    const response = await wahaClient.contacts.contactsControllerGetAll({
      session,
      limit: 5000,
    })

    const contacts = (response.data as unknown as Array<{ id?: string; name?: string }>) || []
    const contactsMap = new Map<string, string>()

    for (const contact of contacts) {
      if (contact.id && contact.name) {
        contactsMap.set(contact.id, contact.name)
      }
    }

    debugLog("Contacts", `Cached ${contactsMap.size} contacts`)
    appState.setContactsCache(contactsMap)
  } catch (error) {
    debugLog("Contacts", `Failed to load contacts: ${error}`)
  }
}

/**
 * Load LID to phone number mappings for presence matching
 */
export async function loadLidMappings(): Promise<void> {
  try {
    const state = appState.getState()
    if (state.lidToPhoneMap.size > 0) return // Already loaded

    const session = getSession()
    debugLog("LID", `Loading LID mappings for session: ${session}`)
    const wahaClient = getClient()

    // Get all known LID to phone number mappings
    const response = await wahaClient.contacts.lidsControllerGetAll(session, { limit: 5000 })
    const mappings = response.data || []

    appState.addLidMappings(mappings)
    debugLog("LID", `Loaded ${mappings.length} LID mappings`)
  } catch (error) {
    debugLog("LID", `Failed to load LID mappings: ${error}`)
    // Not critical - we can still work without mappings
  }
}

// ============================================
// Chat Details (Presence/Participants)
// ============================================

export async function loadChatDetails(chatId: string): Promise<void> {
  const isGroup = chatId.endsWith("@g.us")
  const session = getSession()
  const wahaClient = getClient()

  try {
    if (isGroup) {
      debugLog("Conversation", `Loading participants for group: ${chatId}`)
      const response = await wahaClient.groups.groupsControllerGetGroupParticipants(session, chatId)
      const participants = response.data as unknown as GroupParticipant[]
      appState.setCurrentChatParticipants(participants)
    }

    // Always load and subscribe to presence (for both groups and 1:1 chats)
    const response = await wahaClient.presence.presenceControllerGetPresence(session, chatId)
    const presence = response.data as unknown as WAHAChatPresences
    appState.setCurrentChatPresence(presence)

    // Also explicitly subscribe to ensure we get WebSocket updates (if supported by WAHA tier)
    try {
      await wahaClient.presence.presenceControllerSubscribe(session, chatId)
    } catch {
      // Subscription might fail if already subscribed or not supported, that's okay
    }
  } catch (error) {
    debugLog("Conversation", `Failed to load chat details: ${error}`)
  }
}

// ============================================
// Message Operations
// ============================================

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

    // Clear reply state after successful send
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

// ============================================
// Profile
// ============================================

export async function fetchMyProfile(): Promise<void> {
  try {
    const session = getSession()
    const wahaClient = getClient()
    const response = await wahaClient.profile.profileControllerGetMyProfile(session)
    if (response.data) {
      appState.setMyProfile(response.data)
      debugLog("Polling", `Fetched my profile: ${response.data.name} (${response.data.id})`)
    }
  } catch {
    debugLog("Polling", "Failed to fetch profile")
  }
}

export async function sendTypingState(
  chatId: string,
  state: "composing" | "paused"
): Promise<void> {
  try {
    const session = getSession()
    const wahaClient = getClient()

    debugLog("Client", `Sending typing state: ${state} to ${chatId}`)

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
  } catch {
    // Silent fail for typing indicators
  }
}

// ============================================
// Session Presence Management
// ============================================

let lastActivityTime = Date.now()
let presenceInterval: ReturnType<typeof setInterval> | null = null
let resubscribeInterval: ReturnType<typeof setInterval> | null = null
let currentPresenceStatus: "online" | "offline" = "offline"

/**
 * Mark user activity - resets the offline timer
 */
export function markActivity(): void {
  lastActivityTime = Date.now()
  // If we're offline, go online
  if (currentPresenceStatus === "offline") {
    setSessionPresence("online")
  }
}

/**
 * Set session presence (online/offline)
 * Required to receive presence.update events on WEBJS engine
 */
export async function setSessionPresence(presence: "online" | "offline"): Promise<void> {
  // Set status immediately to prevent race conditions with markActivity
  if (currentPresenceStatus === presence) return // No change needed
  currentPresenceStatus = presence

  try {
    const session = getSession()
    const wahaClient = getClient()

    await wahaClient.presence.presenceControllerSetPresence(session, {
      chatId: "", // Empty for global presence
      presence,
    })

    debugLog("Presence", `Session presence set to: ${presence}`)
  } catch (error) {
    debugLog("Presence", `Failed to set session presence: ${error}`)
    // Revert status on failure
    currentPresenceStatus = presence === "online" ? "offline" : "online"
  }
}

/**
 * Subscribe to presence for a chat - needs to be called every 5 minutes
 */
export async function subscribeToPresence(chatId: string): Promise<void> {
  try {
    const session = getSession()
    const wahaClient = getClient()

    await wahaClient.presence.presenceControllerSubscribe(session, chatId)
    debugLog("Presence", `Subscribed to presence for: ${chatId}`)
  } catch {
    // Silent fail
  }
}

/**
 * Start presence management for a conversation
 * - Sets session to "online" to receive presence.update events
 * - Re-subscribes every 5 minutes
 * - Goes offline after 30 seconds of inactivity
 */
export function startPresenceManagement(chatId: string): void {
  stopPresenceManagement()

  debugLog("Presence", `Starting presence management for: ${chatId}`)

  // Mark initial activity and go online
  markActivity()

  // Subscribe immediately
  subscribeToPresence(chatId)

  // Set up re-subscription every 5 minutes (300000ms)
  resubscribeInterval = setInterval(
    () => {
      const state = appState.getState()
      if (state.currentChatId === chatId) {
        debugLog("Presence", `Re-subscribing to presence for: ${chatId}`)
        subscribeToPresence(chatId)
      }
    },
    5 * 60 * 1000
  )

  // Set up activity check - go offline after 30 seconds of inactivity
  presenceInterval = setInterval(() => {
    const now = Date.now()
    const inactiveDuration = now - lastActivityTime

    if (inactiveDuration > 30000 && currentPresenceStatus === "online") {
      // 30 seconds of inactivity
      debugLog("Presence", "Inactivity timeout - going offline")
      setSessionPresence("offline")
    }
  }, 5000) // Check every 5 seconds
}

/**
 * Stop presence management
 */
export function stopPresenceManagement(): void {
  if (presenceInterval) {
    clearInterval(presenceInterval)
    presenceInterval = null
  }
  if (resubscribeInterval) {
    clearInterval(resubscribeInterval)
    resubscribeInterval = null
  }

  // Go offline when leaving
  if (currentPresenceStatus === "online") {
    setSessionPresence("offline")
  }

  debugLog("Presence", "Stopped presence management")
}
