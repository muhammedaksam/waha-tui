/**
 * Link Preview Utilities
 * Extracts and formats URL metadata from WAHA message _data
 */

import type { WAMessageExtended } from "~/types"

export interface LinkPreviewInfo {
  url: string
  title?: string
  description?: string
  canonicalUrl?: string
}

/**
 * Simple URL regex to detect links in message text
 */
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

/**
 * Extract URLs from plain text
 */
export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || []
}

/**
 * Extract link preview data from a WAMessageExtended message.
 * WAHA may include link metadata in the _data payload under various keys.
 */
export function getLinkPreviewData(message: WAMessageExtended): LinkPreviewInfo | null {
  const data = message._data as Record<string, unknown> | undefined
  if (!data) return null

  // Check for direct link preview fields that WAHA/WhatsApp Web injects
  // Common field names: matchedText, canonicalUrl, title, description
  const matchedText = data.matchedText as string | undefined
  const title = data.title as string | undefined
  const description = data.description as string | undefined
  const canonicalUrl = data.canonicalUrl as string | undefined

  // If we have a matched URL and at least a title, it's a real link preview
  if (matchedText && (title || description)) {
    return {
      url: matchedText,
      title: title || undefined,
      description: description || undefined,
      canonicalUrl: canonicalUrl || undefined,
    }
  }

  // Also check for a links array (some WAHA versions)
  const links = data.links as
    | Array<{ link?: string; title?: string; description?: string }>
    | undefined
  if (links && links.length > 0) {
    const first = links[0]
    if (first.link && (first.title || first.description)) {
      return {
        url: first.link,
        title: first.title || undefined,
        description: first.description || undefined,
      }
    }
  }

  return null
}
