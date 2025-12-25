/**
 * Update Checker
 * Check GitHub releases for new waha-tui versions
 */

import { VersionInfo } from "../config/version"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const GITHUB_REPO = "muhammedaksam/waha-tui"

// Use XDG_CONFIG_HOME or fallback to ~/.config/waha-tui or ~/.waha-tui
// Ideally we should use the ConfigManager path, but for simplicity we'll check common spots
// Let's use os.homedir()/.config/waha-tui/ as per the migration plans
const CONFIG_DIR = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, "waha-tui")
  : join(homedir(), ".config", "waha-tui")

// Ensure directory exists for cache
if (!existsSync(CONFIG_DIR)) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true })
  } catch {
    // ignore
  }
}

const CACHE_FILE = join(CONFIG_DIR, ".update-cache.json")
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseUrl: string
  releaseNotes?: string
  publishedAt?: string
}

interface CachedUpdate {
  checkedAt: string
  latestVersion: string
  releaseUrl: string
  releaseNotes?: string
  publishedAt?: string
}

/**
 * Get cached update info if still valid
 */
function getCachedUpdate(): CachedUpdate | null {
  if (!existsSync(CACHE_FILE)) return null

  try {
    const content = readFileSync(CACHE_FILE, "utf-8")
    const cached = JSON.parse(content) as CachedUpdate

    const checkedAt = new Date(cached.checkedAt).getTime()
    const now = Date.now()

    // Cache still valid
    if (now - checkedAt < CACHE_DURATION_MS) {
      return cached
    }
  } catch {
    // Ignore cache errors
  }

  return null
}

/**
 * Save update info to cache
 */
function cacheUpdate(info: Omit<CachedUpdate, "checkedAt">): void {
  try {
    const cached: CachedUpdate = {
      ...info,
      checkedAt: new Date().toISOString(),
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cached, null, 2), "utf-8")
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Compare semver versions
 * Returns true if v2 is newer than v1
 */
function isNewerVersion(v1: string, v2: string): boolean {
  const normalize = (v: string) => v.replace(/^v/, "")
  const parts1 = normalize(v1).split(".").map(Number)
  const parts2 = normalize(v2).split(".").map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p2 > p1) return true
    if (p2 < p1) return false
  }

  return false
}

/**
 * Fetch latest release from GitHub API
 */
async function fetchLatestRelease(): Promise<{
  version: string
  url: string
  notes?: string
  publishedAt?: string
} | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "waha-tui-update-checker",
      },
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as {
      tag_name: string
      html_url: string
      body?: string
      published_at?: string
    }

    return {
      version: data.tag_name,
      url: data.html_url,
      notes: data.body,
      publishedAt: data.published_at,
    }
  } catch {
    return null
  }
}

/**
 * Check for updates
 * Uses cache to avoid repeated API calls
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = VersionInfo.version

  // Check cache first
  const cached = getCachedUpdate()
  if (cached) {
    return {
      currentVersion,
      latestVersion: cached.latestVersion,
      updateAvailable: isNewerVersion(currentVersion, cached.latestVersion),
      releaseUrl: cached.releaseUrl,
      releaseNotes: cached.releaseNotes,
      publishedAt: cached.publishedAt,
    }
  }

  // Fetch from GitHub
  const release = await fetchLatestRelease()

  if (!release) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      updateAvailable: false,
      releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
    }
  }

  // Cache the result
  cacheUpdate({
    latestVersion: release.version,
    releaseUrl: release.url,
    releaseNotes: release.notes,
    publishedAt: release.publishedAt,
  })

  return {
    currentVersion,
    latestVersion: release.version,
    updateAvailable: isNewerVersion(currentVersion, release.version),
    releaseUrl: release.url,
    releaseNotes: release.notes,
    publishedAt: release.publishedAt,
  }
}
