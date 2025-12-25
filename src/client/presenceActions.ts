/**
 * Presence Actions
 * Functions for session presence and activity management
 */

import { appState } from "../state/AppState"
import { debugLog } from "../utils/debug"
import { getClient, getSession } from "./core"

// State for presence management
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
