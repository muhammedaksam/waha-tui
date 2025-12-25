/**
 * Configuration Manager
 * Handles reading and writing config to ~/.waha-tui/
 *
 * Config is split into two files:
 * - ~/.waha-tui/.env - Secrets (WAHA_URL, WAHA_API_KEY)
 * - ~/.waha-tui/config.json - Metadata (version, timestamps, settings)
 */

import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import type { WahaTuiConfig, WahaTuiConfigMeta, WahaTuiEnv, WahaTuiSettings } from "./schema"
import { debugLog } from "../utils/debug"
import { DEFAULT_CONFIG_META, DEFAULT_ENV, DEFAULT_SETTINGS } from "./schema"
import { VersionInfo } from "./version"

const CONFIG_DIR_NAME = "waha-tui"
const ENV_FILE_NAME = ".env"
const CONFIG_FILE_NAME = "config.json"

export function getConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  return join(xdgConfigHome, CONFIG_DIR_NAME)
}

export function getEnvPath(): string {
  return join(getConfigDir(), ENV_FILE_NAME)
}

export function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE_NAME)
}

export async function ensureConfigDir(): Promise<void> {
  const configDir = getConfigDir()

  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true })
  }
}

/**
 * Check if config exists (both .env and config.json)
 */
export async function configExists(): Promise<boolean> {
  return existsSync(getEnvPath()) && existsSync(getConfigPath())
}

/**
 * Parse .env file content
 */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {}

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const [key, ...valueParts] = trimmed.split("=")
    if (key && valueParts.length > 0) {
      // Remove quotes if present
      let value = valueParts.join("=").trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      env[key.trim()] = value
    }
  }

  return env
}

/**
 * Generate .env file content
 */
function generateEnvContent(env: WahaTuiEnv): string {
  const lines: string[] = [
    "# WAHA TUI Configuration",
    "# Connection settings for WAHA server",
    "",
    `WAHA_URL=${env.wahaUrl}`,
    `WAHA_API_KEY=${env.wahaApiKey}`,
  ]

  return lines.join("\n") + "\n"
}

/**
 * Load env from ~/.waha-tui/.env
 */
async function loadEnvFile(): Promise<WahaTuiEnv | null> {
  const envPath = getEnvPath()
  debugLog("Config", `Loading env from ${envPath}`)

  if (!existsSync(envPath)) {
    debugLog("Config", "Env file not found")
    return null
  }

  try {
    const content = await readFile(envPath, "utf-8")
    const env = parseEnvFile(content)

    return {
      wahaUrl: env.WAHA_URL || DEFAULT_ENV.wahaUrl,
      wahaApiKey: env.WAHA_API_KEY || "",
    }
  } catch (error) {
    debugLog("Config", `Failed to load env: ${error}`)
    return null
  }
}

/**
 * Load config metadata from ~/.waha-tui/config.json
 */
async function loadConfigMeta(): Promise<WahaTuiConfigMeta | null> {
  const configPath = getConfigPath()
  debugLog("Config", `Loading config from ${configPath}`)

  if (!existsSync(configPath)) {
    debugLog("Config", "Config file not found")
    return null
  }

  try {
    const content = await readFile(configPath, "utf-8")
    const config = JSON.parse(content) as WahaTuiConfigMeta
    debugLog("Config", `Loaded config version ${config.version}`)

    // Auto-update if version differs from current package version
    if (config.version !== VersionInfo.version) {
      debugLog("Config", `Updating config version from ${config.version} to ${VersionInfo.version}`)
      config.version = VersionInfo.version
      config.updatedAt = new Date().toISOString()
      await saveConfigMeta(config)
    }

    return config
  } catch (error) {
    debugLog("Config", `Failed to load config: ${error}`)
    return null
  }
}

/**
 * Load combined config from both files
 */
export async function loadConfig(): Promise<WahaTuiConfig | null> {
  const env = await loadEnvFile()
  const meta = await loadConfigMeta()

  if (!env || !meta) {
    return null
  }

  return {
    ...env,
    ...meta,
  }
}

/**
 * Save env to ~/.waha-tui/.env
 */
async function saveEnvFile(env: WahaTuiEnv): Promise<void> {
  await ensureConfigDir()
  const envPath = getEnvPath()
  debugLog("Config", `Saving env to ${envPath}`)
  await writeFile(envPath, generateEnvContent(env), "utf-8")
}

/**
 * Save config metadata to ~/.waha-tui/config.json
 */
async function saveConfigMeta(meta: WahaTuiConfigMeta): Promise<void> {
  await ensureConfigDir()
  const configPath = getConfigPath()
  debugLog("Config", `Saving config to ${configPath}`)
  await writeFile(configPath, JSON.stringify(meta, null, 2), "utf-8")
}

/**
 * Save combined config to both files
 */
export async function saveConfig(config: WahaTuiConfig): Promise<void> {
  // Update timestamp
  config.updatedAt = new Date().toISOString()

  // Split into env and meta
  const env: WahaTuiEnv = {
    wahaUrl: config.wahaUrl,
    wahaApiKey: config.wahaApiKey,
  }

  const meta: WahaTuiConfigMeta = {
    version: config.version,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    settings: config.settings,
  }

  await saveEnvFile(env)
  await saveConfigMeta(meta)
  debugLog("Config", "Config saved successfully")
}

/**
 * Get current settings (with defaults applied)
 */
export async function getSettings(): Promise<WahaTuiSettings> {
  const config = await loadConfig()
  return {
    ...DEFAULT_SETTINGS,
    ...config?.settings,
  }
}

/**
 * Save just the settings portion of config
 */
export async function saveSettings(settings: Partial<WahaTuiSettings>): Promise<void> {
  const config = await loadConfig()
  if (!config) {
    debugLog("Config", "Cannot save settings - no config loaded")
    return
  }

  config.settings = {
    ...DEFAULT_SETTINGS,
    ...config.settings,
    ...settings,
  }

  await saveConfig(config)
  debugLog("Config", `Settings saved: ${JSON.stringify(settings)}`)
}

/**
 * Create a default config
 */
export function createDefaultConfig(
  wahaUrl: string,
  wahaApiKey: string,
  _options?: Record<string, unknown>
): WahaTuiConfig {
  const now = new Date().toISOString()

  return {
    ...DEFAULT_ENV,
    ...DEFAULT_CONFIG_META,
    wahaUrl,
    wahaApiKey,
    createdAt: now,
    updatedAt: now,
  } as WahaTuiConfig
}

/**
 * Load config from environment variables or .env file in project directory (for development)
 */
export async function loadConfigFromEnv(): Promise<Partial<WahaTuiConfig> | null> {
  // Try to load from project's .env file (for development)
  const projectEnvPath = join(process.cwd(), ".env")

  if (existsSync(projectEnvPath)) {
    try {
      const content = await readFile(projectEnvPath, "utf-8")
      const env = parseEnvFile(content)

      return {
        wahaUrl: env.WAHA_URL,
        wahaApiKey: env.WAHA_API_KEY,
      }
    } catch {
      // Fall through to process.env
    }
  }

  // Fallback to process.env
  if (process.env.WAHA_URL || process.env.WAHA_API_KEY) {
    return {
      wahaUrl: process.env.WAHA_URL,
      wahaApiKey: process.env.WAHA_API_KEY,
    }
  }

  return null
}
