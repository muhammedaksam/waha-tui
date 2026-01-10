/**
 * Enhanced Search Utilities
 * WhatsApp Web-style search with sections: Chats, Contacts, Messages
 */

import type { ChatSummary } from "@muhammedaksam/waha-node"

import { getChatIdString, isGroupChat } from "~/utils/formatters"

export type SearchSection = "chats" | "contacts" | "messages"

export interface SectionedSearchResults {
  chats: ChatSummary[] // Chat names matching
  contacts: ChatSummary[] // Contact names matching (from cache)
  messages: ChatSummary[] // Message content matching
}

/**
 * Perform WhatsApp Web-style sectioned search
 * @param chats All available chats
 * @param searchQuery The search term
 * @param contactsCache Map of contact IDs to names
 * @returns Sectioned search results
 */
export function searchChatsWithSections(
  chats: ChatSummary[],
  searchQuery: string,
  contactsCache: Map<string, string>
): SectionedSearchResults {
  const results: SectionedSearchResults = {
    chats: [],
    contacts: [],
    messages: [],
  }

  if (!searchQuery.trim()) {
    return results
  }

  const query = searchQuery.toLowerCase().trim()

  // Don't filter out archived chats - WhatsApp Web includes them in search!
  // We only exclude archived when browsing the main chat list
  const searchableChats = chats

  for (const chat of searchableChats) {
    const chatName = chat.name?.toLowerCase() ?? ""
    const chatId = getChatIdString(chat.id)

    // Section 1: Chats - Search by chat name or chat ID (for unnamed chats/numbers)
    if (chatName.includes(query) || chatId.toLowerCase().includes(query)) {
      results.chats.push(chat)
      continue // Don't add to multiple sections
    }

    // Section 2: Contacts - Search by contact name from cache
    // For group chats, skip contact search
    if (!isGroupChat(chatId)) {
      const contactName = contactsCache.get(chatId)?.toLowerCase() ?? ""
      if (contactName && contactName.includes(query)) {
        results.contacts.push(chat)
        continue
      }
    }

    // Section 3: Messages - Search in last message content
    const lastMessageBody = (chat.lastMessage as { body?: string } | undefined)?.body
    const lastMessageText = lastMessageBody?.toLowerCase() ?? ""
    if (lastMessageText.includes(query)) {
      results.messages.push(chat)
    }
  }

  return results
}

/**
 * Flatten sectioned results into a single array
 * Returns just the chats in order: Chats, Contacts, Messages
 * Section headers will be handled by the view layer
 */
export function flattenSearchResults(sectioned: SectionedSearchResults): ChatSummary[] {
  return [...sectioned.chats, ...sectioned.contacts, ...sectioned.messages]
}

/**
 * Get section boundaries for navigation
 * Returns start/end indices for each section in the flattened array
 */
export function getSectionBoundaries(sectioned: SectionedSearchResults): {
  chats: { start: number; end: number; count: number }
  contacts: { start: number; end: number; count: number }
  messages: { start: number; end: number; count: number }
} {
  const chatsCount = sectioned.chats.length
  const contactsCount = sectioned.contacts.length
  const messagesCount = sectioned.messages.length

  return {
    chats: { start: 0, end: chatsCount - 1, count: chatsCount },
    contacts: { start: chatsCount, end: chatsCount + contactsCount - 1, count: contactsCount },
    messages: {
      start: chatsCount + contactsCount,
      end: chatsCount + contactsCount + messagesCount - 1,
      count: messagesCount,
    },
  }
}
