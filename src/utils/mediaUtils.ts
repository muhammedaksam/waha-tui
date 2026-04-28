import { spawn } from "child_process"
import { existsSync } from "fs"
import { mkdir } from "fs/promises"
import { homedir } from "os"
import { join } from "path"

import { debugLog } from "~/utils/debug"

const MEDIA_DIR_NAME = "waha-tui/media"

/**
 * Ensures the media download directory exists and returns its path.
 * Uses $XDG_DATA_HOME if available, otherwise fallback to ~/.local/share
 */
export async function getMediaDownloadDir(): Promise<string> {
  const xdgDataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share")
  const mediaDir = join(xdgDataHome, MEDIA_DIR_NAME)

  if (!existsSync(mediaDir)) {
    await mkdir(mediaDir, { recursive: true })
    debugLog("FileSystem", `Created media directory: ${mediaDir}`)
  }

  return mediaDir
}

/**
 * Opens a local file using the system's default viewer.
 * @param filePath - The absolute path to the file to open
 * @returns boolean indicating if the spawn command was successful
 */
export async function openLocalFile(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    let command: string
    let args: string[]

    const platform = process.platform
    if (platform === "darwin") {
      command = "open"
      args = [filePath]
    } else if (platform === "win32") {
      command = "cmd"
      args = ["/c", "start", '""', filePath]
    } else {
      // Default to linux xdg-open
      command = "xdg-open"
      args = [filePath]
    }

    try {
      debugLog("FileSystem", `Opening file: ${command} ${args.join(" ")}`)
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
      })

      child.unref() // Allow the parent process to exit independently
      resolve(true)
    } catch (error) {
      debugLog("FileSystem", `Failed to open file: ${error}`)
      resolve(false)
    }
  })
}
