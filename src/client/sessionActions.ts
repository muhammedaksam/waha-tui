/**
 * Session Actions
 * Functions for session, chats, contacts, and profile management
 */

import type {
  ChatSummary,
  GroupParticipant,
  SessionInfo,
  WAHAChatPresences,
} from "@muhammedaksam/waha-node"

import { TIME_MS } from "../constants"
import { CacheKeys, cacheService } from "../services/CacheService"
import { errorService } from "../services/ErrorService"
import { RetryPresets, withRetry } from "../services/RetryService"
import { appState } from "../state/AppState"
import { debugLog } from "../utils/debug"
import { isGroupChat } from "../utils/formatters"
import { getClient, getSession } from "./core"
import { prefetchMessagesForTopChats } from "./messageActions"

// ============================================
// Session Management
// ============================================

/**
 * Load all available WAHA sessions.
 * Updates app state with session list and connection status.
 * Includes automatic retry with exponential backoff on failure.
 * @throws Never - errors are caught and handled internally
 */
export async function loadSessions(): Promise<void> {
  try {
    debugLog("Session", "Loading sessions from WAHA API")
    appState.setConnectionStatus("connecting")
    const wahaClient = getClient()

    const { data: sessions } = await withRetry(() => wahaClient.sessions.sessionsControllerList(), {
      ...RetryPresets.standard,
      onRetry: (attempt, delay) => {
        debugLog("Session", `Retry attempt ${attempt}, waiting ${delay}ms...`)
      },
    })

    debugLog("Session", `Loaded ${sessions?.length ?? 0} sessions`)
    appState.setSessions((sessions as SessionInfo[]) ?? [])
    appState.setConnectionStatus("connected")
  } catch (error) {
    const appError = errorService.handle(error, {
      notify: false,
      log: true,
      context: { action: "loadSessions" },
    })
    appState.setConnectionStatus("error", errorService.getUserMessage(appError))
    appState.setSessions([])
  }
}

/**
 * Log out from the current WAHA session.
 * Clears session state and returns to sessions view.
 */
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
    errorService.handle(error, { context: { action: "logoutSession", sessionName } })
  }
}

/**
 * Delete the current WAHA session permanently.
 * Removes session from WAHA server and returns to sessions view.
 */
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
    errorService.handle(error, { context: { action: "deleteSession", sessionName } })
  }
}

// ============================================
// Chats
// ============================================

export async function loadAllContacts(): Promise<Map<string, string>> {
  const session = getSession()
  const cacheKey = CacheKeys.contacts(session)

  // Check cache first (contacts change less frequently)
  const cached = cacheService.get<Map<string, string>>(cacheKey)
  if (cached) {
    debugLog("Contacts", `Using cached ${cached.size} contacts`)
    return cached
  }

  debugLog("Contacts", `Loading all contacts for session: ${session}`)

  try {
    const client = getClient()
    const response = await client.contacts.contactsControllerGetAll({
      session,
      limit: 10000,
      sortBy: "name",
    })

    const contacts = response.data as unknown as Array<{
      id: string
      name?: string
      pushname?: string
      shortName?: string
    }>

    const contactMap = new Map<string, string>()

    for (const contact of contacts) {
      const contactName = contact.name || contact.pushname || contact.shortName

      if (contact.id && contactName) {
        contactMap.set(contact.id, contactName)
      }
    }

    debugLog("Contacts", `Loaded ${contactMap.size} contacts`)

    // Cache contacts for 2 minutes (they change less frequently)
    cacheService.set(cacheKey, contactMap, { ttlMs: TIME_MS.SESSION_CONTACT_MAP_TTL })
    return contactMap
  } catch (error) {
    errorService.handle(error, { context: { action: "loadAllContacts" } })
    return new Map()
  }
}

export async function loadChats(): Promise<void> {
  try {
    const session = getSession()
    const cacheKey = CacheKeys.chats(session)

    // Check cache first
    const cached = cacheService.get<ChatSummary[]>(cacheKey)
    if (cached) {
      debugLog("Chats", `Using cached ${cached.length} chats`)
      appState.setChats(cached)
      return
    }

    debugLog("Chats", `Loading chats for session: ${session}`)
    const wahaClient = getClient()

    const response = await withRetry(() => wahaClient.chats.chatsControllerGetChats(session, {}), {
      ...RetryPresets.standard,
      onRetry: (attempt, delay) => {
        debugLog("Chats", `Retry attempt ${attempt}, waiting ${delay}ms...`)
      },
    })

    const chats = (response.data as unknown as ChatSummary[]) || []
    debugLog("Chats", `Loaded ${chats.length} chats`)

    // Cache the result (30 second TTL)
    cacheService.set(cacheKey, chats, { ttlMs: TIME_MS.SESSION_CHATS_CACHE_TTL })
    appState.setChats(chats)

    const allContacts = await loadAllContacts()
    appState.setAllContacts(allContacts)

    // Trigger background sync to pre-fetch messages for top chats
    // Run in background (don't await) so UI isn't blocked
    prefetchMessagesForTopChats(5).catch((error) => {
      debugLog("Chats", `Failed to pre-fetch messages for top chats: ${error}`)
    })
  } catch (error) {
    errorService.handle(error, { context: { action: "loadChats" } })
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
    errorService.handle(error, { context: { action: "loadContacts" } })
  }
}

export async function loadLidMappings(): Promise<void> {
  try {
    const state = appState.getState()
    if (state.lidToPhoneMap.size > 0) return

    const session = getSession()
    debugLog("LID", `Loading LID mappings for session: ${session}`)
    const wahaClient = getClient()

    const response = await wahaClient.contacts.lidsControllerGetAll(session, { limit: 5000 })
    const mappings = response.data || []

    appState.addLidMappings(mappings)
    debugLog("LID", `Loaded ${mappings.length} LID mappings`)
  } catch (error) {
    errorService.handle(error, { context: { action: "loadLidMappings" } })
  }
}

// ============================================
// Chat Details (Presence/Participants)
// ============================================

export async function loadChatDetails(chatId: string): Promise<void> {
  const isGroup = isGroupChat(chatId)
  const session = getSession()
  const wahaClient = getClient()

  try {
    if (isGroup) {
      debugLog("Conversation", `Loading participants for group: ${chatId}`)
      const response = await wahaClient.groups.groupsControllerGetGroupParticipants(session, chatId)
      const participants = response.data as unknown as GroupParticipant[]
      appState.setCurrentChatParticipants(participants)
    }

    const response = await wahaClient.presence.presenceControllerGetPresence(session, chatId)
    const presence = response.data as unknown as WAHAChatPresences
    appState.setCurrentChatPresence(presence)

    try {
      await wahaClient.presence.presenceControllerSubscribe(session, chatId)
    } catch {
      // Subscription might fail if already subscribed or not supported
    }
  } catch (error) {
    errorService.handle(error, { context: { action: "loadChatDetails", chatId } })
  }
}

// ============================================
// Profile
// ============================================

export async function fetchMyProfile(): Promise<void> {
  try {
    const session = getSession()
    debugLog("Profile", `Fetching my profile for session: ${session}`)
    const wahaClient = getClient()
    const response = await wahaClient.profile.profileControllerGetMyProfile(session)
    appState.setMyProfile(response.data)
    debugLog("Profile", `My profile loaded: ${response.data?.id}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "fetchMyProfile" } })
  }
}
