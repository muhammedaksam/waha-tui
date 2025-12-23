/**
 * Migration: migrate to xdg
 *
 * Moves config from ~/.waha-tui to $XDG_CONFIG_HOME/waha-tui
 */

import { existsSync, lstatSync } from "node:fs"
import { readdir, mkdir, copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import { debugLog } from "../debug"

export const name = "migrate_to_xdg"

const OLD_DIR = join(homedir(), ".waha-tui")

function getNewDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  return join(xdgConfigHome, "waha-tui")
}

export async function up(): Promise<boolean> {
  const newDir = getNewDir()

  // Skip if old directory doesn't exist
  if (!existsSync(OLD_DIR)) {
    debugLog("Migrations", "No legacy ~/.waha-tui directory found, skipping migration")
    return false
  }

  // Skip if already at XDG location (same path)
  if (OLD_DIR === newDir) {
    debugLog("Migrations", "Old and new paths are identical, skipping")
    return false
  }

  // Skip if new directory already has config
  if (existsSync(join(newDir, "config.json"))) {
    debugLog("Migrations", "XDG config already exists, skipping migration")
    return false
  }

  debugLog("Migrations", `Migrating from ${OLD_DIR} to ${newDir}`)

  try {
    // Ensure target directory exists
    if (!existsSync(newDir)) {
      await mkdir(newDir, { recursive: true })
      debugLog("Migrations", `Created directory ${newDir}`)
    }

    // Get all files in old directory
    const entries = await readdir(OLD_DIR)

    // Filter to only include regular files (skip directories, symlinks, etc.)
    const files = entries.filter((entry) => {
      const entryPath = join(OLD_DIR, entry)
      try {
        const stat = lstatSync(entryPath)
        return stat.isFile()
      } catch {
        return false
      }
    })

    for (const file of files) {
      const oldPath = join(OLD_DIR, file)
      const newPath = join(newDir, file)

      // Skip if file already exists in new location
      if (existsSync(newPath)) {
        debugLog("Migrations", `Skipping ${file}, already exists in new location`)
        continue
      }

      // Copy file to new location
      await copyFile(oldPath, newPath)
      debugLog("Migrations", `Copied ${file} to XDG location`)
    }

    // Remove old directory completely (including any subdirectories)
    try {
      await rm(OLD_DIR, { recursive: true, force: true })
      debugLog("Migrations", `Removed legacy directory ${OLD_DIR}`)
    } catch {
      debugLog("Migrations", `Could not remove old directory`)
    }

    debugLog("Migrations", "XDG migration completed successfully")
    return true
  } catch (e) {
    debugLog("Migrations", `Migration error: ${e}`)
    return false
  }
}

export function down(): boolean {
  // This migration is not easily reversible
  // The old config location is deprecated
  debugLog("Migrations", "XDG migration rollback not supported")
  return false
}
