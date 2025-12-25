/**
 * WAHA Client Core
 * Singleton client initialization and core utilities
 */

import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios"

import { WahaClient } from "@muhammedaksam/waha-node"

import type { WahaTuiConfig } from "../config/schema"
import { appState } from "../state/AppState"
import { DEBUG_ENABLED, debugLog, debugRequest, debugResponse } from "../utils/debug"

let client: WahaClient | null = null

export function initializeClient(config: WahaTuiConfig): WahaClient {
  debugLog("Client", `Initializing WAHA client: ${config.wahaUrl}`)
  client = new WahaClient(config.wahaUrl, config.wahaApiKey)

  // Add axios interceptors for automatic request/response logging
  if (DEBUG_ENABLED) {
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
export function getSession(): string {
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
    await testClient.sessions.sessionsControllerList()
    debugLog("Client", "Connection test successful")
    return true
  } catch (error) {
    debugLog("Client", `Connection test failed: ${error}`)
    return false
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
      const success = await tryClipboardTool(text, { command: "pbcopy", args: [] })
      if (success) {
        debugLog("Client", `Copied: ${text.substring(0, 50)}...`)
      }
      return success
    } else if (platform === "win32") {
      const success = await tryClipboardTool(text, { command: "clip", args: [] })
      if (success) {
        debugLog("Client", `Copied: ${text.substring(0, 50)}...`)
      }
      return success
    } else if (platform === "linux") {
      const linuxTools: ClipboardTool[] = [
        { command: "wl-copy", args: [] },
        { command: "xclip", args: ["-selection", "clipboard"] },
        { command: "xsel", args: ["--clipboard", "--input"] },
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
