/**
 * Debug logging utility for waha-tui
 *
 * Enable debug logging via:
 * - CLI flag: waha-tui --debug or -d
 * - Environment variable: WAHA_TUI_DEBUG=1 bun dev
 */

import { appendFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Check CLI args for --debug flag
const hasDebugFlag = process.argv.includes("--debug") || process.argv.includes("-d")
const hasEnvDebug = process.env.WAHA_TUI_DEBUG === "1" || process.env.WAHA_TUI_DEBUG === "true"

export const DEBUG_ENABLED = hasDebugFlag || hasEnvDebug

// Compute XDG path locally to avoid circular dependency with manager.ts
function getXdgConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  return join(xdgConfigHome, "waha-tui")
}

// Save debug log to XDG config dir like other config files
const wahaTuiDir = getXdgConfigDir()
const logFile = join(wahaTuiDir, "debug.log")

/**
 * Initialize debug mode - clears old log file
 */
export function initDebug(): void {
  if (!DEBUG_ENABLED) return
  try {
    writeFileSync(logFile, `=== waha-tui Debug Log - ${new Date().toISOString()} ===\n`)
  } catch {
    // Ignore
  }
}

/**
 * Log a debug message to debug.log file if debug mode is enabled
 */
export function debugLog(category: string, message: string): void {
  if (!DEBUG_ENABLED) return

  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] [${category}] ${message}\n`
  try {
    appendFileSync(logFile, line)
  } catch {
    // Ignore logging errors
  }
}

/**
 * Log API request details for debugging
 */
export function debugRequest(method: string, url: string, body?: unknown): void {
  if (!DEBUG_ENABLED) return
  debugLog("API", `${method} ${url}`)
  if (body) {
    debugLog("API", `Body: ${JSON.stringify(body, null, 2)}`)
  }
}

/**
 * Log API response details for debugging
 */
export function debugResponse(status: number, url: string, body?: string): void {
  if (!DEBUG_ENABLED) return
  debugLog("API", `Response ${status} from ${url}`)
  if (body && body.length < 2000) {
    debugLog("API", `Response Body: ${body}`)
  }
}

/**
 * Log process state including memory, uptime, and handle counts
 */
export function debugProcessState(): void {
  if (!DEBUG_ENABLED) return

  const memoryUsage = process.memoryUsage()
  const uptime = process.uptime()

  debugLog("Process", `Uptime: ${uptime.toFixed(2)}s`)
  debugLog(
    "Process",
    `Memory: RSS=${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, HeapUsed=${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB, HeapTotal=${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`
  )

  try {
    const resourceUsage = process.resourceUsage?.()
    if (resourceUsage) {
      debugLog(
        "Process",
        `User CPU: ${resourceUsage.userCPUTime}ns, System CPU: ${resourceUsage.systemCPUTime}ns`
      )
    }
  } catch {
    // resourceUsage() might not be available on all platforms
  }
}

/**
 * Log formatted stack trace from an error
 */
export function debugStackTrace(error: Error, context?: string): void {
  if (!DEBUG_ENABLED) return
  const label = context || "StackTrace"
  debugLog(label, `Error: ${error.message}`)
  if (error.stack) {
    const lines = error.stack.split("\n")
    lines.slice(1).forEach((line) => {
      debugLog(label, line.trim())
    })
  }
}

/**
 * Log async operation timing
 */
export function debugTiming(category: string, operation: string, startTime: number): void {
  if (!DEBUG_ENABLED) return
  const duration = Date.now() - startTime
  debugLog(category, `${operation} completed in ${duration}ms`)
}
