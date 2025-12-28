import type { ChatSummary } from "@muhammedaksam/waha-node"

import { describe, expect, it } from "bun:test"

import {
  countArchivedChats,
  countUnreadInArchived,
  filterChats,
  hasUnreadMessages,
  isArchived,
  isFavorite,
  isPinned,
} from "./filterChats"

// Helper to create mock chat objects
// Note: getChatProperties requires archived to be defined for other properties to be extracted
function createChat(
  id: string,
  name: string,
  options: {
    archived?: boolean
    pinned?: boolean
    unreadCount?: number
  } = {}
): ChatSummary {
  return {
    id,
    name,
    // Always include archived (default false) so getChatProperties extracts other properties
    archived: options.archived ?? false,
    pinned: options.pinned,
    unreadCount: options.unreadCount,
  } as unknown as ChatSummary
}

// Helper to create group chat ID
function groupId(id: string): string {
  return `${id}@g.us`
}

// Helper to create individual chat ID
function contactId(id: string): string {
  return `${id}@c.us`
}

describe("filterChats", () => {
  describe("isArchived", () => {
    it("should return true for archived chat", () => {
      const chat = createChat(contactId("123"), "John", { archived: true })
      expect(isArchived(chat)).toBe(true)
    })

    it("should return false for non-archived chat", () => {
      const chat = createChat(contactId("123"), "John", { archived: false })
      expect(isArchived(chat)).toBe(false)
    })

    it("should return false when archived is undefined", () => {
      const chat = createChat(contactId("123"), "John")
      expect(isArchived(chat)).toBe(false)
    })
  })

  describe("hasUnreadMessages", () => {
    it("should return true when unreadCount > 0", () => {
      const chat = createChat(contactId("123"), "John", { unreadCount: 5 })
      expect(hasUnreadMessages(chat)).toBe(true)
    })

    it("should return false when unreadCount is 0", () => {
      const chat = createChat(contactId("123"), "John", { unreadCount: 0 })
      expect(hasUnreadMessages(chat)).toBe(false)
    })

    it("should return false when unreadCount is undefined", () => {
      const chat = createChat(contactId("123"), "John")
      expect(hasUnreadMessages(chat)).toBe(false)
    })
  })

  describe("isPinned", () => {
    it("should return true for pinned chat", () => {
      const chat = createChat(contactId("123"), "John", { pinned: true })
      expect(isPinned(chat)).toBe(true)
    })

    it("should return false for non-pinned chat", () => {
      const chat = createChat(contactId("123"), "John", { pinned: false })
      expect(isPinned(chat)).toBe(false)
    })

    it("should return false when pinned is undefined", () => {
      const chat = createChat(contactId("123"), "John")
      expect(isPinned(chat)).toBe(false)
    })
  })

  describe("isFavorite", () => {
    it("should return true for pinned chat (favorites = pinned)", () => {
      const chat = createChat(contactId("123"), "John", { pinned: true })
      expect(isFavorite(chat)).toBe(true)
    })

    it("should return false for non-pinned chat", () => {
      const chat = createChat(contactId("123"), "John", { pinned: false })
      expect(isFavorite(chat)).toBe(false)
    })
  })

  describe("filterChats", () => {
    const chats: ChatSummary[] = [
      createChat(contactId("1"), "Alice", { unreadCount: 3 }),
      createChat(contactId("2"), "Bob", { pinned: true }),
      createChat(groupId("3"), "Family Group", { unreadCount: 1 }),
      createChat(contactId("4"), "Charlie", { archived: true }),
      createChat(groupId("5"), "Work Group", { pinned: true }),
    ]

    it("should filter out archived chats by default", () => {
      const result = filterChats(chats, "all", "")
      expect(result.length).toBe(4)
      expect(result.every((c) => !isArchived(c))).toBe(true)
    })

    it("should filter by search query - name match", () => {
      const result = filterChats(chats, "all", "Alice")
      expect(result.length).toBe(1)
      expect(result[0].name).toBe("Alice")
    })

    it("should filter by search query - case insensitive", () => {
      const result = filterChats(chats, "all", "alice")
      expect(result.length).toBe(1)
      expect(result[0].name).toBe("Alice")
    })

    it("should filter by search query - partial match", () => {
      const result = filterChats(chats, "all", "Group")
      expect(result.length).toBe(2)
    })

    it("should filter unread chats", () => {
      const result = filterChats(chats, "unread", "")
      expect(result.length).toBe(2)
      expect(result.every((c) => hasUnreadMessages(c))).toBe(true)
    })

    it("should filter favorite (pinned) chats", () => {
      const result = filterChats(chats, "favorites", "")
      expect(result.length).toBe(2)
      expect(result.every((c) => isPinned(c))).toBe(true)
    })

    it("should filter group chats", () => {
      const result = filterChats(chats, "groups", "")
      expect(result.length).toBe(2)
      expect(result.every((c) => c.id.toString().endsWith("@g.us"))).toBe(true)
    })

    it("should combine search and filter", () => {
      const result = filterChats(chats, "groups", "Family")
      expect(result.length).toBe(1)
      expect(result[0].name).toBe("Family Group")
    })

    it("should return empty array when no matches", () => {
      const result = filterChats(chats, "all", "nonexistent")
      expect(result.length).toBe(0)
    })
  })

  describe("countArchivedChats", () => {
    it("should count archived chats", () => {
      const chats: ChatSummary[] = [
        createChat(contactId("1"), "Alice", { archived: true }),
        createChat(contactId("2"), "Bob", { archived: false }),
        createChat(contactId("3"), "Charlie", { archived: true }),
      ]
      expect(countArchivedChats(chats)).toBe(2)
    })

    it("should return 0 when no archived chats", () => {
      const chats: ChatSummary[] = [
        createChat(contactId("1"), "Alice", { archived: false }),
        createChat(contactId("2"), "Bob"),
      ]
      expect(countArchivedChats(chats)).toBe(0)
    })
  })

  describe("countUnreadInArchived", () => {
    it("should count unread messages in archived chats", () => {
      const chats: ChatSummary[] = [
        createChat(contactId("1"), "Alice", { archived: true, unreadCount: 5 }),
        createChat(contactId("2"), "Bob", { archived: true, unreadCount: 0 }),
        createChat(contactId("3"), "Charlie", { archived: false, unreadCount: 3 }),
        createChat(contactId("4"), "David", { archived: true, unreadCount: 2 }),
      ]
      expect(countUnreadInArchived(chats)).toBe(2) // Alice and David
    })

    it("should return 0 when no unread in archived", () => {
      const chats: ChatSummary[] = [
        createChat(contactId("1"), "Alice", { archived: true, unreadCount: 0 }),
        createChat(contactId("2"), "Bob", { archived: false, unreadCount: 5 }),
      ]
      expect(countUnreadInArchived(chats)).toBe(0)
    })
  })
})
