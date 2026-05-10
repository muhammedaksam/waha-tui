import type { WAMessage } from "@muhammedaksam/waha-node"

import type { WAMessageExtended } from "~/types"
import { SliceActions, StateSlice } from "~/state/slices/types"
import { debugLog } from "~/utils/debug"

interface PollOption {
  name?: string
  localId: number | string
}

interface PollVote {
  optionLocalId: number | string
  count: number
  voters?: string[]
}

interface PollData {
  name?: string
  pollName?: string
  options?: PollOption[]
  pollOptions?: PollOption[]
  votes?: PollVote[]
  pollVotesSnapshot?: {
    pollVotes: PollVote[]
  }
  questionResponsesCount?: number
  multipleAnswers?: boolean
  allowMultipleAnswers?: boolean
  pollSelectableOptionsCount?: number
  selectableOptionsCount?: number
}

export interface MessageState {
  messages: Map<string, WAMessageExtended[]>
  scrollPosition: number
  isSending: boolean
  messageInput: string
  inputHeight: number
  inputMode: boolean
  replyingToMessage: WAMessageExtended | WAMessage | null

  // Multi-select state
  isSelectionMode: Map<string, boolean> // chatId -> boolean
  selectedMessageIds: Map<string, Set<string>> // chatId -> Set of message IDs

  // Pagination state
  hasMoreMessages: Map<string, boolean>
  isLoadingMore: Map<string, boolean>

  // In-chat search state
  searchQuery: string
  searchResultIndices: number[] // Indices into the current chat's messages array
  searchActiveIndex: number // Which result is currently focused
  isSearchActive: boolean
  pollVotesCache: Map<string, PollVote[]> // messageId -> votes array
}

export const initialMessageState: MessageState = {
  messages: new Map(),
  scrollPosition: 0,
  isSending: false,
  messageInput: "",
  inputHeight: 3,
  inputMode: false,
  replyingToMessage: null,
  isSelectionMode: new Map(),
  selectedMessageIds: new Map(),
  hasMoreMessages: new Map(),
  isLoadingMore: new Map(),
  searchQuery: "",
  searchResultIndices: [],
  searchActiveIndex: -1,
  isSearchActive: false,
  pollVotesCache: new Map(),
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

  // Multi-select actions
  toggleSelectionMode(chatId: string): void
  toggleMessageSelection(chatId: string, messageId: string): void
  clearMessageSelection(chatId: string): void
  selectAllMessages(chatId: string): void

  // Pagination actions
  setHasMoreMessages(chatId: string, hasMore: boolean): void
  setIsLoadingMore(chatId: string, isLoading: boolean): void

  // Search actions
  setSearchActive(active: boolean): void
  setSearchQuery(query: string, chatId: string): void
  navigateSearchResult(direction: 1 | -1): void
  clearSearch(): void
  updatePollVote(
    chatId: string,
    pollMessageId: string,
    voterId: string,
    selectedOptions: string[]
  ): void
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
        let updated = m
        const existingReactions = existingReactionsMap.get(m.id)
        if (existingReactions && (!m.reactions || m.reactions.length === 0)) {
          updated = { ...updated, reactions: existingReactions }
        }

        // Merge cached poll votes
        const cachedVotes = state.pollVotesCache.get(m.id)
        if (cachedVotes) {
          updated = JSON.parse(JSON.stringify(updated))
          const target = (updated._data?.poll || updated._data) as PollData | undefined
          if (target) {
            target.votes = cachedVotes
            if (!target.pollVotesSnapshot) target.pollVotesSnapshot = { pollVotes: [] }
            target.pollVotesSnapshot.pollVotes = cachedVotes
          }
        }
        return updated
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

      let newMessage = { ...message } as WAMessageExtended
      const cachedVotes = state.pollVotesCache.get(message.id)
      if (cachedVotes) {
        newMessage = JSON.parse(JSON.stringify(newMessage))
        const target = (newMessage._data?.poll || newMessage._data) as PollData | undefined
        if (target) {
          target.votes = cachedVotes
          if (!target.pollVotesSnapshot) target.pollVotesSnapshot = { pollVotes: [] }
          target.pollVotesSnapshot.pollVotes = cachedVotes
        }
      }

      const newMessages = [...existing, newMessage]
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

    toggleSelectionMode(chatId: string) {
      const isSelectionMode = new Map(state.isSelectionMode)
      const current = isSelectionMode.get(chatId) ?? false
      isSelectionMode.set(chatId, !current)

      // Clear selection when disabling mode
      const selectedMessageIds = new Map(state.selectedMessageIds)
      if (current) {
        selectedMessageIds.delete(chatId)
      }

      state = { ...state, isSelectionMode, selectedMessageIds }
      notify()
    },

    toggleMessageSelection(chatId: string, messageId: string) {
      const selectedMessageIds = new Map(state.selectedMessageIds)
      const currentSet = new Set(selectedMessageIds.get(chatId) || [])

      if (currentSet.has(messageId)) {
        currentSet.delete(messageId)
      } else {
        currentSet.add(messageId)
      }

      selectedMessageIds.set(chatId, currentSet)
      state = { ...state, selectedMessageIds }
      notify()
    },

    clearMessageSelection(chatId: string) {
      const selectedMessageIds = new Map(state.selectedMessageIds)
      selectedMessageIds.delete(chatId)
      state = { ...state, selectedMessageIds }
      notify()
    },

    selectAllMessages(chatId: string) {
      const messages = state.messages.get(chatId) || []
      const selectedMessageIds = new Map(state.selectedMessageIds)
      const newSet = new Set(messages.map((m) => m.id))
      selectedMessageIds.set(chatId, newSet)
      state = { ...state, selectedMessageIds }
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
      let updatedMsg = { ...existing[msgIndex], ...newMessage } as WAMessageExtended

      const cachedVotes = state.pollVotesCache.get(newMessage.id)
      if (cachedVotes) {
        updatedMsg = JSON.parse(JSON.stringify(updatedMsg))
        const target = (updatedMsg._data?.poll || updatedMsg._data) as PollData | undefined
        if (target) {
          target.votes = cachedVotes
          if (!target.pollVotesSnapshot) target.pollVotesSnapshot = { pollVotes: [] }
          target.pollVotesSnapshot.pollVotes = cachedVotes
        }
      }

      newMessages[msgIndex] = updatedMsg

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

    updatePollVote(chatId, pollMessageId, voterId, selectedOptions) {
      const messagesMap = new Map(state.messages)
      const chatMessages = messagesMap.get(chatId)
      if (!chatMessages) return

      // Extract core UID (handle parts like true_..._UID or UID_out@c.us)
      const pollIdParts = pollMessageId.split("_")
      // The UID is usually the part that's not true/false/out/JID.
      const pollUid =
        pollIdParts.find(
          (p) =>
            !["true", "false"].includes(p) &&
            !p.split("@")[0].startsWith("out") &&
            !p.includes("@") &&
            p.length > 5
        ) || pollMessageId

      const msgIndex = chatMessages.findIndex(
        (m) => m.id === pollMessageId || m.id.includes(pollUid)
      )

      if (msgIndex === -1) {
        // Quietly fail for poll votes on messages we don't have cached yet
        return
      }

      const msg = chatMessages[msgIndex]

      const pollData = (msg._data?.poll || msg._data) as PollData | undefined
      if (!pollData || (!pollData.options && !pollData.pollOptions)) {
        return
      }

      const options = (pollData.options || pollData.pollOptions || []) as PollOption[]
      let votes = (pollData.votes || pollData.pollVotesSnapshot?.pollVotes || []) as PollVote[]

      // Deep copy votes to avoid mutation
      votes = JSON.parse(JSON.stringify(votes))

      // 1. Remove this voter from all current options
      votes.forEach((v: PollVote) => {
        if (v.voters) {
          v.voters = v.voters.filter((vid: string) => vid !== voterId)
          v.count = v.voters.length
        }
      })

      // 2. Add voter to selected options
      selectedOptions.forEach((optName) => {
        const option = options.find((o: PollOption) => o.name === optName)
        if (option) {
          const optId = option.localId
          let voteInfo = votes.find((v: PollVote) => v.optionLocalId === optId)
          if (!voteInfo) {
            voteInfo = { optionLocalId: optId, count: 0, voters: [] }
            votes.push(voteInfo)
          }
          if (!voteInfo.voters) voteInfo.voters = []
          if (!voteInfo.voters.includes(voterId)) {
            voteInfo.voters.push(voterId)
            voteInfo.count = voteInfo.voters.length
          }
        }
      })

      // 3. Update the message object with a deep copy to ensure reactivity
      const updatedMsg = JSON.parse(JSON.stringify(msg))
      if (!updatedMsg._data) updatedMsg._data = {}

      const target = updatedMsg._data.poll || updatedMsg._data
      target.votes = votes

      // Also update pollVotesSnapshot for WEBJS engines
      if (!target.pollVotesSnapshot) target.pollVotesSnapshot = { pollVotes: [] }
      target.pollVotesSnapshot.pollVotes = votes

      // Update count if present
      if (typeof target.questionResponsesCount === "number") {
        target.questionResponsesCount = votes.reduce(
          (sum: number, v: PollVote) => sum + (v.count || 0),
          0
        )
      }

      const newChatMessages = [...chatMessages]
      newChatMessages[msgIndex] = updatedMsg

      // 4. Update the cache for persistence
      const newCache = new Map(state.pollVotesCache)
      newCache.set(msg.id, votes)

      const newMessagesMap = new Map(messagesMap)
      newMessagesMap.set(chatId, newChatMessages)
      state = { ...state, messages: newMessagesMap, pollVotesCache: newCache }
      notify()
    },
  }
}
