/**
 * Chat Actions Integration Tests
 * Tests for chat-level operations with mocked WAHA client
 */

import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"

import { errorService } from "../services/ErrorService"
import { archiveChat, deleteChat, markChatUnread, unarchiveChat } from "./chatActions"
import * as core from "./core"

// Mock the core module functions
const mockChatsController = {
  chatsControllerArchiveChat: mock(() => Promise.resolve({ data: {} })),
  chatsControllerUnarchiveChat: mock(() => Promise.resolve({ data: {} })),
  chatsControllerUnreadChat: mock(() => Promise.resolve({ data: {} })),
  chatsControllerDeleteChat: mock(() => Promise.resolve({ data: {} })),
}

const mockClient = {
  chats: mockChatsController,
}

describe("chatActions", () => {
  beforeEach(() => {
    // Reset mocks
    mockChatsController.chatsControllerArchiveChat.mockClear()
    mockChatsController.chatsControllerUnarchiveChat.mockClear()
    mockChatsController.chatsControllerUnreadChat.mockClear()
    mockChatsController.chatsControllerDeleteChat.mockClear()

    // Mock getClient and getSession
    spyOn(core, "getClient").mockReturnValue(
      mockClient as unknown as ReturnType<typeof core.getClient>
    )
    spyOn(core, "getSession").mockReturnValue("test-session")
  })

  describe("archiveChat", () => {
    it("should archive a chat successfully", async () => {
      const result = await archiveChat("123@c.us")

      expect(result).toBe(true)
      expect(mockChatsController.chatsControllerArchiveChat).toHaveBeenCalledWith(
        "test-session",
        "123@c.us"
      )
    })

    it("should return false on error", async () => {
      mockChatsController.chatsControllerArchiveChat.mockRejectedValueOnce(new Error("API Error"))

      const result = await archiveChat("123@c.us")

      expect(result).toBe(false)
    })

    it("should call errorService.handle on error", async () => {
      const handleSpy = spyOn(errorService, "handle")
      mockChatsController.chatsControllerArchiveChat.mockRejectedValueOnce(new Error("API Error"))

      await archiveChat("123@c.us")

      expect(handleSpy).toHaveBeenCalled()
    })
  })

  describe("unarchiveChat", () => {
    it("should unarchive a chat successfully", async () => {
      const result = await unarchiveChat("123@c.us")

      expect(result).toBe(true)
      expect(mockChatsController.chatsControllerUnarchiveChat).toHaveBeenCalledWith(
        "test-session",
        "123@c.us"
      )
    })

    it("should return false on error", async () => {
      mockChatsController.chatsControllerUnarchiveChat.mockRejectedValueOnce(new Error("API Error"))

      const result = await unarchiveChat("123@c.us")

      expect(result).toBe(false)
    })
  })

  describe("markChatUnread", () => {
    it("should mark chat as unread successfully", async () => {
      const result = await markChatUnread("123@c.us")

      expect(result).toBe(true)
      expect(mockChatsController.chatsControllerUnreadChat).toHaveBeenCalledWith(
        "test-session",
        "123@c.us"
      )
    })

    it("should return false on error", async () => {
      mockChatsController.chatsControllerUnreadChat.mockRejectedValueOnce(new Error("API Error"))

      const result = await markChatUnread("123@c.us")

      expect(result).toBe(false)
    })
  })

  describe("deleteChat", () => {
    it("should delete a chat successfully", async () => {
      const result = await deleteChat("123@c.us")

      expect(result).toBe(true)
      expect(mockChatsController.chatsControllerDeleteChat).toHaveBeenCalledWith(
        "test-session",
        "123@c.us"
      )
    })

    it("should return false on error", async () => {
      mockChatsController.chatsControllerDeleteChat.mockRejectedValueOnce(new Error("API Error"))

      const result = await deleteChat("123@c.us")

      expect(result).toBe(false)
    })
  })
})
