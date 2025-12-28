/**
 * Chat Filtering Utilities
 * Filters chats based on active filter and search query
 */

import type { ChatSummary } from "@muhammedaksam/waha-node"

import type { ActiveFilter } from "../state/AppState"
import { getChatIdString, isGroupChat } from "./formatters"

interface ExtendedChat {
  archived?: boolean
  unreadCount?: number
  pinned?: boolean
  // star is for favorited chats in WhatsApp
  star?: boolean
}

/**
 * Extract the extended chat properties from _chat
 */
function getChatProperties(chat: ChatSummary): ExtendedChat {
  // Check top-level properties first (populated by modified waha backend)
  const c = chat as ChatSummary & {
    archived?: boolean
    pinned?: boolean
    unreadCount?: number
    star?: boolean
  }
  if (c.archived !== undefined) {
    return {
      archived: c.archived,
      pinned: c.pinned,
      unreadCount: c.unreadCount,
      star: c.star,
    }
  }

  const rawChat = chat._chat as Record<string, unknown> | undefined
  if (!rawChat) return {}

  return {
    // Check both archived (standard) and archive (some raw data formats)
    archived: (rawChat.archived ?? rawChat.archive) as boolean | undefined,
    unreadCount: rawChat.unreadCount as number | undefined,
    pinned: (rawChat.pinned ?? rawChat.pin) as boolean | undefined,
    star: rawChat.star as boolean | undefined,
  }
}

/**
 * Check if a chat is archived
 */
export function isArchived(chat: ChatSummary): boolean {
  const props = getChatProperties(chat)
  return !!props.archived
}

/**
 * Check if a chat has unread messages
 */
export function hasUnreadMessages(chat: ChatSummary): boolean {
  const props = getChatProperties(chat)
  return (props.unreadCount ?? 0) > 0
}

/**
 * Check if a chat is pinned (at top of list)
 */
export function isPinned(chat: ChatSummary): boolean {
  const props = getChatProperties(chat)
  return props.pinned === true
}

/**
 * Check if a chat is favorited (same as pinned for chats)
 * Note: star is a message-level property, not chat-level
 */
export function isFavorite(chat: ChatSummary): boolean {
  const props = getChatProperties(chat)
  return props.pinned === true
}

/**
 * Filter chats based on the active filter and search query
 */
export function filterChats(
  chats: ChatSummary[],
  filter: ActiveFilter,
  searchQuery: string
): ChatSummary[] {
  // First, exclude archived chats
  let filtered = chats.filter((chat) => {
    // debugLog("filterChats", `Chat: ${chat.name}, archived: ${isArchived(chat)}`)
    return !isArchived(chat)
  })

  // Apply search filter if query exists
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim()
    filtered = filtered.filter((chat) => {
      const name = chat.name?.toLowerCase() ?? ""
      const id = getChatIdString(chat.id)
      return name.includes(query) || id.includes(query)
    })
  }

  // Apply category filter
  switch (filter) {
    case "all":
      // Already filtered out archived, return all remaining
      break
    case "unread":
      filtered = filtered.filter(hasUnreadMessages)
      break
    case "favorites":
      filtered = filtered.filter(isFavorite)
      break
    case "groups":
      filtered = filtered.filter((chat) => isGroupChat(getChatIdString(chat.id)))
      break
  }

  return filtered
}

/**
 * Count archived chats
 */
export function countArchivedChats(chats: ChatSummary[]): number {
  return chats.filter(isArchived).length
}

/**
 * Count unread messages in archived chats
 */
export function countUnreadInArchived(chats: ChatSummary[]): number {
  return chats.filter((chat) => isArchived(chat) && hasUnreadMessages(chat)).length
}
