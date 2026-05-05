import type { WAMessage } from "@muhammedaksam/waha-node"

import type { WAMessageExtended } from "~/types"
import { SliceActions, StateSlice } from "~/state/slices/types"
import { debugLog } from "~/utils/debug"

export interface MessageState {
  messages: Map<string, WAMessageExtended[]>
  scrollPosition: number
  isSending: boolean
  messageInput: string
  inputHeight: number
  inputMode: boolean
  replyingToMessage: WAMessageExtended | WAMessage | null

  // Pagination state
  hasMoreMessages: Map<string, boolean>
  isLoadingMore: Map<string, boolean>

  // In-chat search state
  searchQuery: string
  searchResultIndices: number[] // Indices into the current chat's messages array
  searchActiveIndex: number // Which result is currently focused
  isSearchActive: boolean
}

export const initialMessageState: MessageState = {
  messages: new Map(),
  scrollPosition: 0,
  isSending: false,
  messageInput: "",
  inputHeight: 3,
  inputMode: false,
  replyingToMessage: null,
  hasMoreMessages: new Map(),
  isLoadingMore: new Map(),
  searchQuery: "",
  searchResultIndices: [],
  searchActiveIndex: -1,
  isSearchActive: false,
}

export interface MessageActions extends SliceActions<MessageState> {
  setMessages(chatId: string, messagesToSet: WAMessageExtended[]): void
  appendMessage(chatId: string, message: WAMessage): void
  updateMessageAck(chatId: string, messageId: string, ack: number, ackName: string): void
  updateMessageReaction(
    chatId: string,
    messageId: string,
    reaction: string,
    senderId?: string
  ): void
  markMessageRevoked(chatId: string, messageId: string): void
  updateMessageBody(chatId: string, messageId: string, newBody: string, isEdited?: boolean): void
  replaceMessage(chatId: string, messageId: string, newMessage: WAMessage): void
  setScrollPosition(scrollPosition: number): void
  setMessageInput(messageInput: string): void
  setInputMode(inputMode: boolean): void
  setIsSending(isSending: boolean): void
  setInputHeight(inputHeight: number): void
  setReplyingToMessage(message: WAMessageExtended | WAMessage | null): void

  // Pagination actions
  setHasMoreMessages(chatId: string, hasMore: boolean): void
  setIsLoadingMore(chatId: string, isLoading: boolean): void

  // Search actions
  setSearchActive(active: boolean): void
  setSearchQuery(query: string, chatId: string): void
  navigateSearchResult(direction: 1 | -1): void
  clearSearch(): void
}

export function createMessageSlice(): StateSlice<MessageState> & MessageActions {
  let state: MessageState = { ...initialMessageState }
  const listeners: Array<(state: MessageState) => void> = []

  const notify = () => {
    listeners.forEach((l) => l(state))
  }

  return {
    name: "message",
    get: () => ({ ...state }),
    set: (updates: Partial<MessageState>) => {
      state = { ...state, ...updates }
      notify()
    },
    getState: () => ({ ...state }),
    setState: (updates: Partial<MessageState>) => {
      state = { ...state, ...updates }
      notify()
    },
    subscribe: (listener: (state: MessageState) => void) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    reset: () => {
      state = { ...initialMessageState }
      notify()
    },

    setMessages(chatId: string, messagesToSet: WAMessageExtended[]) {
      const messagesMap = new Map(state.messages)
      const existingMessages = messagesMap.get(chatId) || []

      // Create a map of existing reactions by message ID to preserve them
      const existingReactionsMap = new Map<string, WAMessageExtended["reactions"]>()
      existingMessages.forEach((m) => {
        if (m.reactions && m.reactions.length > 0) {
          existingReactionsMap.set(m.id, m.reactions)
        }
      })

      // Merge existing reactions into the new messages if they don't have their own
      const mergedMessages = messagesToSet.map((m) => {
        const existingReactions = existingReactionsMap.get(m.id)
        if (existingReactions && (!m.reactions || m.reactions.length === 0)) {
          return { ...m, reactions: existingReactions }
        }
        return m
      })

      messagesMap.set(chatId, mergedMessages)
      state = { ...state, messages: messagesMap }
      notify()
    },

    appendMessage(chatId: string, message: WAMessage) {
      const messagesMap = new Map(state.messages)
      const existing = messagesMap.get(chatId) || []

      const existingIds = new Set(existing.map((m) => m.id))
      if (existingIds.has(message.id)) {
        debugLog("MessageSlice", `Duplicate message ${message.id} ignored`)
        return
      }

      const newMessages = [...existing, message]
      newMessages.sort((a, b) => b.timestamp - a.timestamp)

      messagesMap.set(chatId, newMessages)
      state = { ...state, messages: messagesMap }
      notify()
    },

    updateMessageAck(chatId: string, messageId: string, ack: number, ackName: string) {
      const messages = new Map(state.messages)
      const chatMessages = messages.get(chatId)

      if (!chatMessages) return

      const msgIndex = chatMessages.findIndex((m) => m.id === messageId)
      if (msgIndex === -1) return

      const updatedMsg = { ...chatMessages[msgIndex], ack: ack as WAMessage["ack"], ackName }
      const newChatMessages = [...chatMessages]
      newChatMessages[msgIndex] = updatedMsg

      messages.set(chatId, newChatMessages)
      state = { ...state, messages }
      notify()
    },

    updateMessageReaction(chatId: string, messageId: string, reaction: string, senderId?: string) {
      const messages = new Map(state.messages)
      const chatMessages = messages.get(chatId)
      if (!chatMessages) return

      const msgIndex = chatMessages.findIndex((m) => m.id === messageId)
      if (msgIndex === -1) return

      // Get the message and cast it to include reactions
      const msg = chatMessages[msgIndex] as WAMessage & {
        reactions?: Array<{ text: string; id: string; from?: string }>
      }

      // Initialize reactions array if needed
      let newReactions = msg.reactions ? [...msg.reactions] : []

      if (senderId) {
        // Remove existing reaction from this sender
        newReactions = newReactions.filter((r) => r.from !== senderId)

        // Add new reaction if it's not empty (empty string = remove)
        if (reaction) {
          newReactions.push({
            text: reaction,
            id: Date.now().toString(),
            from: senderId,
          })
        }
      } else {
        // Fallback for when we don't know the sender
        if (reaction) {
          newReactions.push({
            text: reaction,
            id: Date.now().toString(),
            from: "unknown",
          })
        }
      }

      const updatedMsg = { ...msg, reactions: newReactions }
      const newChatMessages = [...chatMessages]
      newChatMessages[msgIndex] = updatedMsg

      messages.set(chatId, newChatMessages)
      state = { ...state, messages }
      notify()
    },

    markMessageRevoked(chatId: string, messageId: string) {
      const messages = new Map(state.messages)
      const chatMessages = messages.get(chatId)
      if (!chatMessages) return

      const msgIndex = chatMessages.findIndex((m) => m.id === messageId)
      if (msgIndex === -1) return

      const updatedMsg = { ...chatMessages[msgIndex], body: "🚫 This message was deleted" }
      const newChatMessages = [...chatMessages]
      newChatMessages[msgIndex] = updatedMsg

      messages.set(chatId, newChatMessages)
      state = { ...state, messages }
      notify()
    },

    setScrollPosition(scrollPosition: number) {
      state = { ...state, scrollPosition }
      notify()
    },

    setMessageInput(messageInput: string) {
      state = { ...state, messageInput }
      notify()
    },

    setInputMode(inputMode: boolean) {
      state = { ...state, inputMode }
      notify()
    },

    setIsSending(isSending: boolean) {
      state = { ...state, isSending }
      notify()
    },

    setInputHeight(inputHeight: number) {
      if (state.inputHeight !== inputHeight) {
        state = { ...state, inputHeight }
        notify()
      }
    },

    setReplyingToMessage(message: WAMessageExtended | WAMessage | null) {
      state = { ...state, replyingToMessage: message }
      notify()
    },

    setHasMoreMessages(chatId: string, hasMore: boolean) {
      const hasMoreMessages = new Map(state.hasMoreMessages)
      hasMoreMessages.set(chatId, hasMore)
      state = { ...state, hasMoreMessages }
      notify()
    },

    setIsLoadingMore(chatId: string, isLoading: boolean) {
      const isLoadingMore = new Map(state.isLoadingMore)
      isLoadingMore.set(chatId, isLoading)
      state = { ...state, isLoadingMore }
      notify()
    },

    updateMessageBody(chatId: string, messageId: string, newBody: string, isEdited?: boolean) {
      const messages = new Map(state.messages)
      const chatMessages = messages.get(chatId)
      if (!chatMessages) return

      const msgIndex = chatMessages.findIndex((m) => m.id === messageId)
      if (msgIndex === -1) return

      const updatedMsg = {
        ...chatMessages[msgIndex],
        body: newBody,
        ...(isEdited ? { isEdited: true } : {}),
      }
      const newChatMessages = [...chatMessages]
      newChatMessages[msgIndex] = updatedMsg

      messages.set(chatId, newChatMessages)
      state = { ...state, messages }
      notify()
    },

    replaceMessage(chatId: string, messageId: string, newMessage: WAMessage) {
      const messagesMap = new Map(state.messages)
      const existing = messagesMap.get(chatId) || []

      const msgIndex = existing.findIndex((m) => m.id === messageId)
      if (msgIndex === -1) return

      const newMessages = [...existing]
      // Preserve local extensions if they exist
      newMessages[msgIndex] = { ...existing[msgIndex], ...newMessage }

      messagesMap.set(chatId, newMessages)
      state = { ...state, messages: messagesMap }
      notify()
    },

    setSearchActive(active: boolean) {
      if (active) {
        state = {
          ...state,
          isSearchActive: true,
          searchQuery: "",
          searchResultIndices: [],
          searchActiveIndex: -1,
        }
      } else {
        state = {
          ...state,
          isSearchActive: false,
          searchQuery: "",
          searchResultIndices: [],
          searchActiveIndex: -1,
        }
      }
      notify()
    },

    setSearchQuery(query: string, chatId: string) {
      if (!query.trim()) {
        state = { ...state, searchQuery: query, searchResultIndices: [], searchActiveIndex: -1 }
        notify()
        return
      }

      const messages = state.messages.get(chatId) || []
      const lowerQuery = query.toLowerCase()
      const indices: number[] = []

      for (let i = 0; i < messages.length; i++) {
        const body = messages[i].body || ""
        if (body.toLowerCase().includes(lowerQuery)) {
          indices.push(i)
        }
      }

      state = {
        ...state,
        searchQuery: query,
        searchResultIndices: indices,
        searchActiveIndex: indices.length > 0 ? indices.length - 1 : -1, // Start at the bottom-most result
      }
      notify()
    },

    navigateSearchResult(direction: 1 | -1) {
      if (state.searchResultIndices.length === 0) return

      let nextIndex = state.searchActiveIndex + direction

      // Wrap around
      if (nextIndex < 0) {
        nextIndex = state.searchResultIndices.length - 1
      } else if (nextIndex >= state.searchResultIndices.length) {
        nextIndex = 0
      }

      state = { ...state, searchActiveIndex: nextIndex }
      notify()
    },

    clearSearch() {
      state = {
        ...state,
        isSearchActive: false,
        searchQuery: "",
        searchResultIndices: [],
        searchActiveIndex: -1,
      }
      notify()
    },
  }
}
