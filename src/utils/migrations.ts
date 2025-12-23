/**
 * Migration Runner
 * Sequelize-style migrations with Unix timestamp naming
 *
 * Migration files: src/utils/migrations/{timestamp}_{name}.ts
 * Each migration exports: name, up()
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { debugLog } from "./debug"

/**
 * Get the XDG config directory for waha-tui
 */
function getXdgConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  return join(xdgConfigHome, "waha-tui")
}

const WAHA_TUI_DIR = getXdgConfigDir()
const MIGRATIONS_FILE = join(WAHA_TUI_DIR, ".migrations.json")

interface MigrationState {
  applied: string[] // List of applied migration timestamps
  lastRun: string
}

interface Migration {
  timestamp: string
  name: string
  up: () => boolean | Promise<boolean>
  down: () => boolean | Promise<boolean>
}

/**
 * Ensure the waha-tui directory exists
 */
function ensureWahaTuiDir(): void {
  if (!existsSync(WAHA_TUI_DIR)) {
    mkdirSync(WAHA_TUI_DIR, { recursive: true })
  }
}

/**
 * Get the current migration state
 */
function getMigrationState(): MigrationState {
  if (!existsSync(MIGRATIONS_FILE)) {
    return { applied: [], lastRun: "" }
  }

  try {
    const content = readFileSync(MIGRATIONS_FILE, "utf-8")
    return JSON.parse(content) as MigrationState
  } catch {
    return { applied: [], lastRun: "" }
  }
}

/**
 * Save the migration state
 */
function saveMigrationState(state: MigrationState): void {
  ensureWahaTuiDir()
  state.lastRun = new Date().toISOString()
  writeFileSync(MIGRATIONS_FILE, JSON.stringify(state, null, 2), "utf-8")
}

/**
 * Load all migration modules
 */
async function loadMigrations(): Promise<Migration[]> {
  const migrations: Migration[] = []

  // Import migrations directly - bundled at build time
  try {
    const m1766511205 = await import("./migrations/1766511205_migrate_to_xdg")
    migrations.push({
      timestamp: "1766511205",
      name: m1766511205.name,
      up: m1766511205.up,
      down: m1766511205.down,
    })
  } catch (e) {
    debugLog("Migrations", `Failed to load migration: ${e}`)
  }

  // Add future migrations here:
  // const m2 = await import("./migrations/1734xxxxxx_xxx")
  // migrations.push({ timestamp: "...", name: m2.name, up: m2.up })

  return migrations.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  const state = getMigrationState()
  const migrations = await loadMigrations()

  let hasChanges = false

  for (const migration of migrations) {
    if (state.applied.includes(migration.timestamp)) {
      continue
    }

    debugLog("Migrations", `Running migration ${migration.timestamp}_${migration.name}`)

    try {
      await migration.up()
      state.applied.push(migration.timestamp)
      hasChanges = true
      debugLog("Migrations", `Migration ${migration.timestamp} completed`)
    } catch (e) {
      debugLog("Migrations", `Migration ${migration.timestamp} failed: ${e}`)
    }
  }

  if (hasChanges) {
    saveMigrationState(state)
  } else {
    debugLog("Migrations", "No pending migrations")
  }
}
