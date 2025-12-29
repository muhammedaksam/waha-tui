/**
 * Chat Actions Integration Tests
 * Tests for chat-level operations with mocked WAHA client
 */

import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"

import { NetworkError } from "../services/Errors"
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
      await archiveChat("123@c.us")

      expect(mockChatsController.chatsControllerArchiveChat).toHaveBeenCalledWith(
        "test-session",
        "123@c.us"
      )
    })

    it("should throw NetworkError on error", async () => {
      mockChatsController.chatsControllerArchiveChat.mockRejectedValueOnce(new Error("API Error"))

      await expect(() => archiveChat("123@c.us")).toThrow(NetworkError)
    })

    it("should call errorService.handle on error", async () => {
      const handleSpy = spyOn(errorService, "handle")
      mockChatsController.chatsControllerArchiveChat.mockRejectedValueOnce(new Error("API Error"))

      await expect(() => archiveChat("123@c.us")).toThrow(NetworkError)

      expect(handleSpy).toHaveBeenCalled()
    })

    it("should call errorService.handle on error", async () => {
      const handleSpy = spyOn(errorService, "handle")
      mockChatsController.chatsControllerArchiveChat.mockRejectedValueOnce(new Error("API Error"))

      await expect(() => archiveChat("123@c.us")).toThrow(NetworkError)

      expect(handleSpy).toHaveBeenCalled()
    })
  })

  describe("unarchiveChat", () => {
    it("should unarchive a chat successfully", async () => {
      await unarchiveChat("123@c.us")

      expect(mockChatsController.chatsControllerUnarchiveChat).toHaveBeenCalledWith(
        "test-session",
        "123@c.us"
      )
    })

    it("should throw NetworkError on error", async () => {
      mockChatsController.chatsControllerUnarchiveChat.mockRejectedValueOnce(new Error("API Error"))

      await expect(() => unarchiveChat("123@c.us")).toThrow(NetworkError)
    })
  })

  describe("markChatUnread", () => {
    it("should mark chat as unread successfully", async () => {
      await markChatUnread("123@c.us")

      expect(mockChatsController.chatsControllerUnreadChat).toHaveBeenCalledWith(
        "test-session",
        "123@c.us"
      )
    })

    it("should throw NetworkError on error", async () => {
      mockChatsController.chatsControllerUnreadChat.mockRejectedValueOnce(new Error("API Error"))

      await expect(() => markChatUnread("123@c.us")).toThrow(NetworkError)
    })
  })

  describe("deleteChat", () => {
    it("should delete a chat successfully", async () => {
      await deleteChat("123@c.us")

      expect(mockChatsController.chatsControllerDeleteChat).toHaveBeenCalledWith(
        "test-session",
        "123@c.us"
      )
    })

    it("should throw NetworkError on error", async () => {
      mockChatsController.chatsControllerDeleteChat.mockRejectedValueOnce(new Error("API Error"))

      await expect(() => deleteChat("123@c.us")).toThrow(NetworkError)
    })
  })
})
