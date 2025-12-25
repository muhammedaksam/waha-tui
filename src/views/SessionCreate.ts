/**
 * Session Creation Helper
 * Handle creating new WAHA sessions without blocking the TUI
 */

import type { SessionCreateRequest } from "@muhammedaksam/waha-node"

import { getClient } from "../client"
import { appState } from "../state/AppState"
import { debugLog } from "../utils/debug"
import { showQRCode } from "./QRCodeView"

export async function createNewSession(sessionName: string = "default"): Promise<void> {
  try {
    const name = sessionName.trim() || "default"

    debugLog("Session", `Creating new session: ${name}`)
    console.log(`\n📱 Creating session: ${name}...`)

    const client = getClient()

    // First, check if session already exists
    try {
      const { data: existingSession } = await client.sessions.sessionsControllerGet(name)
      debugLog("Session", `Session ${name} already exists with status: ${existingSession.status}`)

      // Session exists - check its status
      if (existingSession.status === "STOPPED") {
        console.log(`   Session exists but is stopped. Starting it...`)
        await client.sessions.sessionsControllerStart(name)
        console.log(`✅ Session started: ${name}`)
      } else if (existingSession.status === "SCAN_QR_CODE") {
        console.log(`✅ Session exists and needs QR scan`)

        // Show QR code in TUI
        await showQRCode(name)
      } else {
        console.log(`✅ Session already exists with status: ${existingSession.status}`)
      }

      appState.setCurrentSession(name)
      return
    } catch (error) {
      // Session doesn't exist (404) - continue to create it
      debugLog("Session", `Session ${name} doesn't exist, creating new one: ${error}`)
    }

    // Create new session
    const createRequest: SessionCreateRequest = {
      name,
      start: true,
      config: {
        webjs: {
          tagsEventsOn: true,
        },
      },
    }

    const { data: session } = await client.sessions.sessionsControllerCreate(createRequest)
    debugLog("Session", `Session created: ${session.name} (status: ${session.status})`)
    console.log(`✅ Session created: ${session.name}`)
    console.log(`   Status: ${session.status}`)

    if (session.status === "SCAN_QR_CODE") {
      // Show QR code in TUI
      await showQRCode(session.name)
    }

    // Set as current session
    appState.setCurrentSession(name)
  } catch (error) {
    debugLog("Session", `Failed to create session: ${error}`)
  }
}
