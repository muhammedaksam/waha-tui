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

import { appState } from "../state/AppState"
import { debugLog } from "../utils/debug"
import { isGroupChat } from "../utils/formatters"
import { getClient, getSession } from "./core"
import { prefetchMessagesForTopChats } from "./messageActions"

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

// ============================================
// Chats
// ============================================

export async function loadAllContacts(): Promise<Map<string, string>> {
  const session = getSession()

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
    return contactMap
  } catch (error) {
    debugLog("Contacts", `Error loading contacts: ${error}`)
    return new Map()
  }
}

export async function loadChats(): Promise<void> {
  try {
    const session = getSession()
    debugLog("Chats", `Loading chats for session: ${session}`)
    const wahaClient = getClient()
    const response = await wahaClient.chats.chatsControllerGetChats(session, {})
    const chats = (response.data as unknown as ChatSummary[]) || []
    debugLog("Chats", `Loaded ${chats.length} chats`)
    appState.setChats(chats)

    const allContacts = await loadAllContacts()
    appState.setAllContacts(allContacts)

    // Trigger background sync to pre-fetch messages for top chats
    // Run in background (don't await) so UI isn't blocked
    prefetchMessagesForTopChats(5).catch((error) => {
      debugLog("Chats", `Failed to pre-fetch messages for top chats: ${error}`)
    })
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
    debugLog("LID", `Failed to load LID mappings: ${error}`)
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
    debugLog("Conversation", `Failed to load chat details: ${error}`)
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
    debugLog("Profile", `Failed to fetch my profile: ${error}`)
  }
}
