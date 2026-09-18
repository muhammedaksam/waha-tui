/**
 * Keyboard Handler
 * Fallback and diagnostics for keyboard input events.
 *
 * NOTE: All active keyboard navigation, shortcuts, and view-specific bindings
 * have been migrated to declarative layers and commands in `@opentui/keymap`
 * (see `src/services/KeymapService.ts`).
 */

import type { KeyEvent } from "@opentui/core"

import { debugLog } from "~/utils/debug"

/**
 * Context for keyboard handler operations
 */
export interface KeyHandlerContext {
  renderApp: (forceRebuild?: boolean) => void
}

/**
 * Main keyboard handler - fallback / diagnostic logger.
 * Note: Core key handling is performed by @opentui/keymap via KeymapService.
 */
export async function handleKeyPress(key: KeyEvent, _context: KeyHandlerContext): Promise<void> {
  // If @opentui/keymap already handled or consumed this event, do nothing
  if (key.propagationStopped) return

  debugLog(
    "Keyboard",
    `Unhandled Key: ${key.name} | Ctrl: ${key.ctrl} | Shift: ${key.shift} | Meta: ${key.meta}`
  )
}
