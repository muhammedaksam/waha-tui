/**
 * Configuration Schema
 * Defines the structure and types for WAHA TUI configuration
 *
 * Config is split into two files:
 * - ~/.waha-tui/.env - Secrets (WAHA_URL, WAHA_API_KEY)
 * - ~/.waha-tui/config.json - Metadata (version, timestamps, settings)
 */

import { VersionInfo } from "./version"

/**
 * Environment secrets stored in .env file
 */
export interface WahaTuiEnv {
  wahaUrl: string
  wahaApiKey: string
}

/**
 * User settings stored in config.json
 */
export interface WahaTuiSettings {
  enterIsSend: boolean // Enter key sends message (vs Shift+Enter)
}

export const DEFAULT_SETTINGS: WahaTuiSettings = {
  enterIsSend: true,
}

/**
 * Config metadata stored in config.json
 */
export interface WahaTuiConfigMeta {
  version: string
  createdAt: string
  updatedAt: string
  settings?: WahaTuiSettings
}

/**
 * Combined config for runtime use
 */
export interface WahaTuiConfig extends WahaTuiEnv, WahaTuiConfigMeta {}

export const DEFAULT_ENV: WahaTuiEnv = {
  wahaUrl: "http://localhost:3000",
  wahaApiKey: "",
}

export const DEFAULT_CONFIG_META: Partial<WahaTuiConfigMeta> = {
  version: VersionInfo.version,
}

export function validateConfig(config: Partial<WahaTuiConfig>): string[] {
  const errors: string[] = []

  if (!config.wahaUrl) {
    errors.push("WAHA URL is required")
  }

  // Validate URL format
  if (config.wahaUrl) {
    try {
      new URL(config.wahaUrl)
    } catch {
      errors.push("WAHA URL must be a valid URL")
    }
  }

  return errors
}
