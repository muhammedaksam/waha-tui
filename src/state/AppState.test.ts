import { beforeEach, describe, expect, it, mock } from "bun:test"

// We need to test the StateManager class, but it's exported as a singleton
// So we'll create a fresh instance for testing using a factory pattern
// First, let's test the exported appState singleton's behavior

import { appState } from "~/state/AppState"

describe("AppState", () => {
  beforeEach(() => {
    // Reset all slices to their initial state for test isolation
    appState.reset()
  })

  describe("getState", () => {
    it("should return the current state", () => {
      const state = appState.getState()
      expect(state).toBeDefined()
      expect(state.currentView).toBeDefined()
    })

    it("should return a copy of state, not the original", () => {
      const state1 = appState.getState()
      const state2 = appState.getState()
      expect(state1).not.toBe(state2)
      expect(state1).toEqual(state2)
    })
  })

  describe("subscribe", () => {
    it("should add a listener", () => {
      const listener = mock(() => {})
      const unsubscribe = appState.subscribe(listener)

      appState.setSearchQuery("hello")

      expect(listener).toHaveBeenCalled()
      unsubscribe()
    })

    it("should return an unsubscribe function", () => {
      const listener = mock(() => {})
      const unsubscribe = appState.subscribe(listener)

      unsubscribe()
      appState.setSearchQuery("world")

      expect(listener).toHaveBeenCalledTimes(0)
    })

    it("should pass current state to listener", () => {
      let receivedState: ReturnType<typeof appState.getState> | null = null
      const listener = (state: ReturnType<typeof appState.getState>) => {
        receivedState = state
      }
      const unsubscribe = appState.subscribe(listener)

      appState.setCurrentView("loading")

      expect(receivedState).not.toBeNull()
      expect(receivedState!.currentView).toBe("loading")
      unsubscribe()
    })
  })

  describe("setCurrentView", () => {
    it("should update currentView", () => {
      appState.setCurrentView("settings")
      expect(appState.getState().currentView).toBe("settings")
    })

    it("should set lastChangeType to view", () => {
      appState.setCurrentView("chats")
      expect(appState.getState().lastChangeType).toBe("view")
    })

    it("should update activeIcon when switching to settings", () => {
      appState.setCurrentView("settings")
      expect(appState.getState().activeIcon).toBe("settings")
    })

    it("should update activeIcon when switching to chats", () => {
      // First switch to settings
      appState.setCurrentView("settings")
      expect(appState.getState().activeIcon).toBe("settings")

      // Then back to chats
      appState.setCurrentView("chats")
      expect(appState.getState().activeIcon).toBe("chats")
    })
  })

  describe("setCurrentSession", () => {
    it("should update currentSession", () => {
      appState.setCurrentSession("test-session")
      expect(appState.getState().currentSession).toBe("test-session")
    })

    it("should allow null session", () => {
      appState.setCurrentSession("test")
      appState.setCurrentSession(null)
      expect(appState.getState().currentSession).toBeNull()
    })
  })

  describe("setCurrentChat", () => {
    it("should update currentChatId and change view to conversation", () => {
      appState.setCurrentChat("chat-123")
      const state = appState.getState()
      expect(state.currentChatId).toBe("chat-123")
      expect(state.currentView).toBe("conversation")
    })

    it("should change view to chats when chatId is null", () => {
      appState.setCurrentChat("chat-123")
      appState.setCurrentChat(null)
      const state = appState.getState()
      expect(state.currentChatId).toBeNull()
      expect(state.currentView).toBe("chats")
    })

    it("should clear presence and participants", () => {
      appState.setChatPresence({ id: "test" } as never)
      // Set participants directly using lower-level slice access
      appState.setChatParticipants([{ id: "p1" }] as never)
      appState.setCurrentChat("new-chat")
      const state = appState.getState()
      expect(state.currentChatPresence).toBeNull()
      expect(state.currentChatParticipants).toBeNull()
    })
  })

  describe("setSessions", () => {
    it("should update sessions array", () => {
      const sessions = [{ name: "session1" }, { name: "session2" }] as never[]
      appState.setSessions(sessions)
      expect(appState.getState().sessions).toEqual(sessions)
    })
  })

  describe("setChats", () => {
    it("should update chats array", () => {
      const chats = [{ id: "chat1" }, { id: "chat2" }] as never[]
      appState.setChats(chats)
      expect(appState.getState().chats).toEqual(chats)
    })

    it("should set lastChangeType to data", () => {
      appState.setChats([])
      expect(appState.getState().lastChangeType).toBe("data")
    })
  })

  describe("setConnectionStatus", () => {
    it("should update connection status", () => {
      appState.setConnectionStatus("connected")
      expect(appState.getState().connectionStatus).toBe("connected")
    })

    it("should update error message when provided", () => {
      appState.setConnectionStatus("error", "Connection failed")
      const state = appState.getState()
      expect(state.connectionStatus).toBe("error")
      expect(state.errorMessage).toBe("Connection failed")
    })
  })

  describe("setSelectedSessionIndex", () => {
    it("should update selected session index", () => {
      appState.setSelectedSessionIndex(5)
      expect(appState.getState().selectedSessionIndex).toBe(5)
    })
  })

  describe("setSelectedChatIndex", () => {
    it("should update selected chat index", () => {
      appState.setSelectedChatIndex(10)
      expect(appState.getState().selectedChatIndex).toBe(10)
    })
  })

  describe("chatListScrollOffset", () => {
    it("should be updatable via setChatListScrollOffset", () => {
      appState.setChatListScrollOffset(50)
      appState.setLastChangeType("scroll")
      const state = appState.getState()
      expect(state.chatListScrollOffset).toBe(50)
      expect(state.lastChangeType).toBe("scroll")
    })
  })

  describe("setActiveFilter", () => {
    it("should update active filter", () => {
      appState.setActiveFilter("unread")
      expect(appState.getState().activeFilter).toBe("unread")
    })

    it("should reset selection when filter changes", () => {
      appState.setSelectedChatIndex(5)
      appState.setActiveFilter("groups")

      const state = appState.getState()
      expect(state.selectedChatIndex).toBe(0)
    })
  })

  describe("context menu operations", () => {
    it("openContextMenu should set contextMenu state", () => {
      appState.openContextMenu("chat", "chat-123", null, { x: 10, y: 20 })
      const state = appState.getState()
      expect(state.contextMenu).not.toBeNull()
      expect(state.contextMenu!.visible).toBe(true)
      expect(state.contextMenu!.type).toBe("chat")
      expect(state.contextMenu!.targetId).toBe("chat-123")
    })

    it("closeContextMenu should clear contextMenu state", () => {
      appState.openContextMenu("chat", "chat-123", null, { x: 10, y: 20 })
      appState.closeContextMenu()
      expect(appState.getState().contextMenu).toBeNull()
    })

    it("setContextMenuSelectedIndex should update selectedIndex", () => {
      appState.openContextMenu("message", "msg-456", null, { x: 10, y: 20 })
      appState.setContextMenuSelectedIndex(3)
      expect(appState.getState().contextMenu!.selectedIndex).toBe(3)
    })
  })

  describe("setReplyingToMessage", () => {
    it("should set replying message", () => {
      const message = { id: "msg-123", body: "Hello" } as never
      appState.setReplyingToMessage(message)
      expect(appState.getState().replyingToMessage).toEqual(message)
    })

    it("should allow clearing reply", () => {
      appState.setReplyingToMessage({ id: "msg" } as never)
      appState.setReplyingToMessage(null)
      expect(appState.getState().replyingToMessage).toBeNull()
    })
  })

  describe("setIsSending", () => {
    it("should update isSending flag", () => {
      appState.setIsSending(true)
      expect(appState.getState().isSending).toBe(true)
      appState.setIsSending(false)
      expect(appState.getState().isSending).toBe(false)
    })
  })
})
