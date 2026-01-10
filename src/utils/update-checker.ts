/**
 * Update Checker
 * Check GitHub releases for new waha-tui versions
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { VersionInfo } from "~/config/version"
import { TIME_MS } from "~/constants"

const GITHUB_REPO = "muhammedaksam/waha-tui"

// Use XDG_CONFIG_HOME or fallback to ~/.config/waha-tui or ~/.waha-tui
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

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseUrl: string
  releaseNotes?: string
  publishedAt?: string
  dismissedVersion?: string
}

interface CachedUpdate {
  checkedAt: string
  latestVersion: string
  releaseUrl: string
  releaseNotes?: string
  publishedAt?: string
  dismissedVersion?: string
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

    // Cache still valid for checks
    if (now - checkedAt < TIME_MS.UPDATE_CHECK_CACHE_DURATION) {
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
    // Preserve existing dismissedVersion if not provided
    let existingDismissed: string | undefined
    try {
      if (existsSync(CACHE_FILE)) {
        const content = readFileSync(CACHE_FILE, "utf-8")
        const cached = JSON.parse(content) as CachedUpdate
        existingDismissed = cached.dismissedVersion
      }
    } catch {
      /* ignore */
    }

    const cached: CachedUpdate = {
      dismissedVersion: existingDismissed,
      ...info,
      checkedAt: new Date().toISOString(),
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cached, null, 2), "utf-8")
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Dismiss an update version
 */
export function dismissUpdate(version: string): void {
  try {
    let cached: CachedUpdate = {
      checkedAt: new Date(0).toISOString(), // Expired by default if new
      latestVersion: version,
      releaseUrl: "",
    }

    if (existsSync(CACHE_FILE)) {
      try {
        const content = readFileSync(CACHE_FILE, "utf-8")
        cached = JSON.parse(content) as CachedUpdate
      } catch {
        /* ignore */
      }
    }

    cached.dismissedVersion = version
    writeFileSync(CACHE_FILE, JSON.stringify(cached, null, 2), "utf-8")
  } catch {
    // Ignore errors
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
    // If dismissed version matches latest, consider update unavailable
    const isDismissed = cached.dismissedVersion === cached.latestVersion

    return {
      currentVersion,
      latestVersion: cached.latestVersion,
      updateAvailable: !isDismissed && isNewerVersion(currentVersion, cached.latestVersion),
      releaseUrl: cached.releaseUrl,
      releaseNotes: cached.releaseNotes,
      publishedAt: cached.publishedAt,
      dismissedVersion: cached.dismissedVersion,
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

  // Check if this version was dismissed previously (by reading file directly as getCachedUpdate might have failed/expired)
  let dismissedVersion: string | undefined
  try {
    if (existsSync(CACHE_FILE)) {
      const content = readFileSync(CACHE_FILE, "utf-8")
      const c = JSON.parse(content) as CachedUpdate
      dismissedVersion = c.dismissedVersion
    }
  } catch {
    /* ignore */
  }

  // Cache the result
  cacheUpdate({
    latestVersion: release.version,
    releaseUrl: release.url,
    releaseNotes: release.notes,
    publishedAt: release.publishedAt,
    dismissedVersion: dismissedVersion, // Preserve
  })

  const isDismissed = dismissedVersion === release.version

  return {
    currentVersion,
    latestVersion: release.version,
    updateAvailable: !isDismissed && isNewerVersion(currentVersion, release.version),
    releaseUrl: release.url,
    releaseNotes: release.notes,
    publishedAt: release.publishedAt,
    dismissedVersion,
  }
}
