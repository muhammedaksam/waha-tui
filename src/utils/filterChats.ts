/**
 * Chat Filtering Utilities
 * Filters chats based on active filter and search query
 */

import type { ChatSummary } from "@muhammedaksam/waha-node"
import type { ActiveFilter } from "../state/AppState"

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
  const rawChat = chat._chat as Record<string, unknown> | undefined
  if (!rawChat) return {}

  return {
    archived: rawChat.archived as boolean | undefined,
    unreadCount: rawChat.unreadCount as number | undefined,
    pinned: rawChat.pinned as boolean | undefined,
    star: rawChat.star as boolean | undefined,
  }
}

/**
 * Check if a chat is archived
 */
export function isArchived(chat: ChatSummary): boolean {
  const props = getChatProperties(chat)
  return props.archived === true
}

/**
 * Check if a chat is a group chat
 */
export function isGroupChat(chat: ChatSummary): boolean {
  const id =
    typeof chat.id === "string" ? chat.id : (chat.id as { _serialized: string })._serialized
  return id.endsWith("@g.us")
}

/**
 * Check if a chat has unread messages
 */
export function hasUnreadMessages(chat: ChatSummary): boolean {
  const props = getChatProperties(chat)
  return (props.unreadCount ?? 0) > 0
}

/**
 * Check if a chat is pinned/favorited
 */
export function isFavorite(chat: ChatSummary): boolean {
  const props = getChatProperties(chat)
  // Use pinned as the primary indicator for favorites
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
  let filtered = chats.filter((chat) => !isArchived(chat))

  // Apply search filter if query exists
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim()
    filtered = filtered.filter((chat) => {
      const name = chat.name?.toLowerCase() ?? ""
      const id =
        typeof chat.id === "string" ? chat.id : (chat.id as { _serialized: string })._serialized
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
      filtered = filtered.filter(isGroupChat)
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
