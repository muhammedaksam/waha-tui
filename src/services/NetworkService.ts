/**
 * Network Service
 * Detects and manages network connectivity state
 */

import { successToast, warningToast } from "~/components/Toast"
import { TIME_MS } from "~/constants"
import { appState } from "~/state/AppState"
import { debugLog } from "~/utils/debug"

/**
 * Network connectivity state
 */
export type NetworkStatus = "online" | "offline" | "unknown"

/**
 * Network status listener callback
 */
export type NetworkListener = (status: NetworkStatus) => void

/**
 * Network Service
 * Monitors network connectivity and notifies listeners on state changes
 */
class NetworkService {
  private status: NetworkStatus = "unknown"
  private listeners: Set<NetworkListener> = new Set()
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private lastCheckTime: Date | null = null
  private consecutiveFailures = 0
  private readonly maxConsecutiveFailures = 3

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return this.status
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.status === "online"
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return this.status === "offline"
  }

  /**
   * Subscribe to network status changes
   * @returns Unsubscribe function
   */
  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener)
    // Immediately notify of current status
    listener(this.status)
    return () => this.listeners.delete(listener)
  }

  /**
   * Update network status and notify listeners
   */
  private setStatus(newStatus: NetworkStatus): void {
    if (this.status !== newStatus) {
      const oldStatus = this.status
      this.status = newStatus
      debugLog("Network", `Status changed: ${oldStatus} -> ${newStatus}`)

      // Update app state
      appState.setIsOffline(newStatus === "offline")

      // Show toast on status change
      if (newStatus === "offline") {
        warningToast("You are offline. Some features may be unavailable.")
      } else if (oldStatus === "offline" && newStatus === "online") {
        successToast("Back online!")
      }

      // Notify listeners
      for (const listener of this.listeners) {
        try {
          listener(newStatus)
        } catch (error) {
          debugLog("Network", `Listener error: ${error}`)
        }
      }
    }
  }

  /**
   * Mark as online (called when API requests succeed)
   */
  markOnline(): void {
    this.consecutiveFailures = 0
    this.setStatus("online")
  }

  /**
   * Mark a network failure (called when API requests fail with network error)
   */
  markNetworkFailure(): void {
    this.consecutiveFailures++
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.setStatus("offline")
    }
  }

  /**
   * Start periodic connectivity checks
   * @param intervalMs - Check interval in milliseconds (default: 30s)
   */
  startMonitoring(intervalMs: number = TIME_MS.NETWORK_MONITOR_INTERVAL): void {
    if (this.checkInterval) {
      return // Already monitoring
    }

    debugLog("Network", `Starting network monitoring (interval: ${intervalMs}ms)`)
    this.checkInterval = setInterval(() => {
      this.lastCheckTime = new Date()
    }, intervalMs)
  }

  /**
   * Stop periodic connectivity checks
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      debugLog("Network", "Stopped network monitoring")
    }
  }

  /**
   * Get last check time
   */
  getLastCheckTime(): Date | null {
    return this.lastCheckTime
  }
}

/**
 * Singleton network service instance
 */
export const networkService = new NetworkService()
