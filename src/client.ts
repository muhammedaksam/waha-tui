/**
 * WAHA Client
 * Singleton client for interacting with WAHA API
 */

import { WahaClient } from "@muhammedaksam/waha-node"
import type { WahaTuiConfig } from "./config/schema"
import { debugLog, debugRequest, debugResponse, DEBUG_ENABLED } from "./utils/debug"
import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from "axios"

let client: WahaClient | null = null

export function initializeClient(config: WahaTuiConfig): WahaClient {
  debugLog("Client", `Initializing WAHA client: ${config.wahaUrl}`)
  client = new WahaClient(config.wahaUrl, config.wahaApiKey)

  // Add axios interceptors for automatic request/response logging
  if (DEBUG_ENABLED) {
    // Access the axios instance via the new httpClient getter
    const httpClient = client?.httpClient

    if (httpClient) {
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

export function getClient(): WahaClient {
  if (!client) {
    throw new Error("WAHA client not initialized. Call initializeClient() first.")
  }
  return client
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
