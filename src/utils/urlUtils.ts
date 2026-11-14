/**
 * URL Utilities
 * URL detection, hyperlink styling, and cross-platform browser opening.
 */

import { spawn } from "child_process"
import type { ColorInput, TextChunk } from "@opentui/core"

import { parseColor, StyledText, TextAttributes } from "@opentui/core"

import { WhatsAppTheme } from "~/config/theme"
import { debugLog } from "~/utils/debug"

/**
 * Matches URLs with schemes (http://, https://, ftp://, git://, etc.) or www.* domains
 */
export const URL_REGEX =
  /\b(?:(?:https?|ftp|file|git):\/\/|www\.)[^\s<>"{}|\\^`[\]]+|(?:[a-z][a-z0-9+.-]*:\/\/[^\s<>"{}|\\^`[\]]+)/gi

/**
 * Trim trailing punctuation often attached to URLs in normal text (e.g. "https://example.com.")
 */
export function trimTrailingPunctuation(rawUrl: string): { url: string; trailing: string } {
  let url = rawUrl
  let trailing = ""

  // Strip trailing punctuation characters: . , ; : ! ? ) ] } ' " >
  const trailingPunctuationRegex = /[.,;:!?')\]}'">]+$/
  const match = url.match(trailingPunctuationRegex)
  if (match) {
    trailing = match[0]
    url = url.slice(0, url.length - trailing.length)
  }

  return { url, trailing }
}

/**
 * Normalize a URL to ensure it has a valid scheme before opening or linking.
 */
export function normalizeUrl(url: string): string {
  if (!url) return ""
  const trimmed = url.trim()
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

/**
 * Extract clean URLs from plain text.
 */
export function extractUrls(text: string): string[] {
  if (!text) return []
  const matches = text.match(URL_REGEX) || []
  return matches.map((m) => trimTrailingPunctuation(m).url).filter((u) => u.length > 0)
}

/**
 * Convert plain text into an OpenTUI StyledText with detected URLs styled in green,
 * underlined, and annotated with OSC 8 hyperlink targets for terminal emulator support.
 */
export function formatTextWithUrls(
  text: string,
  defaultFg: ColorInput = WhatsAppTheme.textPrimary,
  linkColor: ColorInput = WhatsAppTheme.green
): StyledText {
  if (!text) {
    return new StyledText([])
  }

  const fg = parseColor(defaultFg)
  const linkFg = parseColor(linkColor)

  const urls = extractUrls(text)
  if (urls.length === 0) {
    return new StyledText([
      {
        __isChunk: true,
        text,
        fg,
        attributes: 0,
      },
    ])
  }

  const chunks: TextChunk[] = []
  let lastIndex = 0

  const regex = new RegExp(URL_REGEX.source, "gi")
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const rawMatch = match[0]
    const matchIndex = match.index

    // Non-URL text before this match
    if (matchIndex > lastIndex) {
      chunks.push({
        __isChunk: true,
        text: text.slice(lastIndex, matchIndex),
        fg,
        attributes: 0,
      })
    }

    const { url, trailing } = trimTrailingPunctuation(rawMatch)
    const targetHref = normalizeUrl(url)

    // Clickable and highlighted URL chunk
    chunks.push({
      __isChunk: true,
      text: url,
      fg: linkFg,
      attributes: TextAttributes.UNDERLINE,
      link: { url: targetHref },
    })

    // Trailing punctuation as regular text
    if (trailing) {
      chunks.push({
        __isChunk: true,
        text: trailing,
        fg,
        attributes: 0,
      })
    }

    lastIndex = matchIndex + rawMatch.length
  }

  // Any remaining text after the last URL
  if (lastIndex < text.length) {
    chunks.push({
      __isChunk: true,
      text: text.slice(lastIndex),
      fg,
      attributes: 0,
    })
  }

  return new StyledText(chunks)
}

/**
 * Open a URL in the system's default web browser.
 * Supports Linux (xdg-open), macOS (open), and Windows (cmd /c start).
 */
export async function openUrl(url: string): Promise<boolean> {
  if (!url || typeof url !== "string") return false

  const targetUrl = normalizeUrl(url)

  return new Promise((resolve) => {
    let command: string
    let args: string[]

    const platform = process.platform
    if (platform === "darwin") {
      command = "open"
      args = [targetUrl]
    } else if (platform === "win32") {
      command = "cmd"
      args = ["/c", "start", '""', targetUrl]
    } else {
      command = "xdg-open"
      args = [targetUrl]
    }

    try {
      debugLog("Browser", `Opening URL: ${command} ${args.join(" ")}`)
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
      })

      child.unref()
      resolve(true)
    } catch (error) {
      debugLog("Browser", `Failed to open URL: ${error}`)
      resolve(false)
    }
  })
}
