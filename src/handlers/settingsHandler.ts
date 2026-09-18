/**
 * Settings Handler
 * Centralized settings loading and management
 */

import { getSettings } from "~/config/manager"
import { applyThemeSettings } from "~/config/theme"
import { appState } from "~/state/AppState"
import { debugLog } from "~/utils/debug"

/**
 * Load saved settings from config and apply to app state
 * @returns True if settings loaded successfully, false otherwise
 */
export async function loadSavedSettings(): Promise<boolean> {
  try {
    const savedSettings = await getSettings()
    appState.setEnterIsSend(savedSettings.enterIsSend)
    appState.setMessageNotifications(savedSettings.messageNotifications)
    appState.setGroupNotifications(savedSettings.groupNotifications)
    appState.setStatusNotifications(savedSettings.statusNotifications)
    appState.setShowPreviews(savedSettings.showPreviews)
    appState.setBackgroundSync(savedSettings.backgroundSync)
    if (savedSettings.useSystemTheme !== undefined) {
      appState.setUseSystemTheme(savedSettings.useSystemTheme)
    }
    if (savedSettings.themeMode !== undefined) {
      appState.setThemeMode(savedSettings.themeMode)
    }
    applyThemeSettings({
      useSystemTheme: savedSettings.useSystemTheme,
      themeMode: savedSettings.themeMode,
    })
    debugLog(
      "Settings",
      `Loaded settings: enterIsSend=${savedSettings.enterIsSend}, useSystemTheme=${savedSettings.useSystemTheme}, themeMode=${savedSettings.themeMode}`
    )
    return true
  } catch (error) {
    debugLog("Settings", `Failed to load settings: ${error}`)
    return false
  }
}
