import type { ChatSummary, GroupParticipant, WAHAChatPresences } from "@muhammedaksam/waha-node"

import { SliceActions, StateSlice } from "~/state/slices/types"
import { debugLog } from "~/utils/debug"
import { normalizeId } from "~/utils/formatters"

export interface ChatState {
  currentChatId: string | null
  chats: ChatSummary[]
  currentChatPresence: WAHAChatPresences | null
  chatPresences: Map<string, WAHAChatPresences>
  currentChatParticipants: GroupParticipant[] | null
  showingArchivedChats: boolean
  lidToPhoneMap: Map<string, string> // Moved here as it's relevant to chat/presence
}

export const initialChatState: ChatState = {
  currentChatId: null,
  chats: [],
  currentChatPresence: null,
  chatPresences: new Map(),
  currentChatParticipants: null,
  showingArchivedChats: false,
  lidToPhoneMap: new Map(),
}

export interface ChatActions extends SliceActions<ChatState> {
  setCurrentChat(currentChatId: string | null): void
  setChats(chats: ChatSummary[]): void
  setCurrentChatPresence(currentChatPresence: WAHAChatPresences | null): void
  updateChatPresence(chatId: string, presence: WAHAChatPresences): void
  updateChatLastMessageAck(chatId: string, messageId: string, ack: number, ackName: string): void
  setCurrentChatParticipants(currentChatParticipants: GroupParticipant[] | null): void
  setShowingArchivedChats(showingArchivedChats: boolean): void
  isChatTyping(chatId: string, myProfileId?: string): boolean
  getTypingForChatList(chatId: string): string | null
  clearTypingForSender(senderId: string): void
  setLidToPhoneMap(lidToPhoneMap: Map<string, string>): void
  addLidMappings(mappings: Array<{ lid?: string; pn?: string }>): void
  getPhoneFromLid(lid: string): string | undefined
}

export function createChatSlice(): StateSlice<ChatState> & ChatActions {
  let state: ChatState = { ...initialChatState }
  const listeners: Array<(state: ChatState) => void> = []

  const notify = () => {
    listeners.forEach((l) => l(state))
  }

  return {
    name: "chat",
    get: () => ({ ...state }),
    set: (updates: Partial<ChatState>) => {
      state = { ...state, ...updates }
      notify()
    },
    getState: () => ({ ...state }),
    setState: (updates: Partial<ChatState>) => {
      state = { ...state, ...updates }
      notify()
    },
    subscribe: (listener: (state: ChatState) => void) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    reset: () => {
      state = { ...initialChatState }
      notify()
    },

    setCurrentChat(currentChatId: string | null) {
      state = {
        ...state,
        currentChatId,
        currentChatPresence: null,
        currentChatParticipants: null,
      }
      notify()
    },

    setChats(chats: ChatSummary[]) {
      state = { ...state, chats }
      notify()
    },

    setCurrentChatPresence(currentChatPresence: WAHAChatPresences | null) {
      state = { ...state, currentChatPresence }
      notify()
    },

    updateChatPresence(chatId: string, presence: WAHAChatPresences) {
      const chatPresences = new Map(state.chatPresences)

      // Merge with existing presence for this chat
      const existing = chatPresences.get(chatId)
      let newPresences = presence.presences

      if (existing && existing.presences) {
        const existingMap = new Map(existing.presences.map((p) => [p.participant, p]))
        for (const p of presence.presences) {
          existingMap.set(p.participant, p)
        }
        newPresences = Array.from(existingMap.values())
      }

      chatPresences.set(chatId, { id: chatId, presences: newPresences })

      const updates: Partial<ChatState> = { chatPresences }

      // If we're viewing a chat, also update currentChatPresence
      if (state.currentChatId && state.currentChatId === chatId) {
        let currentNewPresences = presence.presences
        const current = state.currentChatPresence

        if (current && current.presences) {
          const existingMap = new Map(current.presences.map((p) => [p.participant, p]))
          for (const p of presence.presences) {
            existingMap.set(p.participant, p)
          }
          currentNewPresences = Array.from(existingMap.values())
        }

        updates.currentChatPresence = {
          id: state.currentChatId,
          presences: currentNewPresences,
        }
      }

      state = { ...state, ...updates }
      notify()
    },

    updateChatLastMessageAck(chatId: string, messageId: string, ack: number, ackName: string) {
      const chatIndex = state.chats.findIndex((c) => {
        return normalizeId(c.id) === normalizeId(chatId)
      })

      if (chatIndex === -1) {
        debugLog("ChatSlice", `Chat not found for ID: ${chatId}`)
        return
      }

      const chat = state.chats[chatIndex]
      const lastMessage = chat.lastMessage as Record<string, unknown> | undefined
      if (!lastMessage) {
        debugLog("ChatSlice", `No lastMessage for chat: ${chatId}`)
        return
      }

      // Extract serialized ID from lastMessage.id (could be string or object with _serialized)
      const lastMessageId =
        typeof lastMessage.id === "string"
          ? lastMessage.id
          : (lastMessage.id as { _serialized?: string })?._serialized || String(lastMessage.id)

      debugLog("ChatSlice", `Updating ack for chat ${chatId}:`)
      debugLog("ChatSlice", `  Message ID from event: ${messageId}`)
      debugLog("ChatSlice", `  Last message ID (serialized): ${lastMessageId}`)
      debugLog("ChatSlice", `  Match: ${lastMessageId === messageId}`)
      debugLog("ChatSlice", `  New ack: ${ack} (${ackName})`)
      debugLog("ChatSlice", `  Current ack: ${lastMessage.ack}`)

      // Only update if this is the last message of the chat
      if (lastMessageId !== messageId) {
        debugLog("ChatSlice", `Message ID mismatch, skipping ack update`)
        return
      }

      // Create updated chat with new ack
      const updatedLastMessage = { ...lastMessage, ack, ackName }
      const updatedChat = { ...chat, lastMessage: updatedLastMessage }

      const newChats = [...state.chats]
      newChats[chatIndex] = updatedChat

      debugLog("ChatSlice", `Ack updated successfully to ${ack}`)

      state = { ...state, chats: newChats }
      notify()
    },

    setCurrentChatParticipants(currentChatParticipants: GroupParticipant[] | null) {
      state = { ...state, currentChatParticipants }
      notify()
    },

    setShowingArchivedChats(showingArchivedChats: boolean) {
      state = { ...state, showingArchivedChats }
      notify()
    },

    isChatTyping(chatId: string, myProfileId?: string): boolean {
      const myIdBase = myProfileId ? normalizeId(myProfileId) : null

      // Filter out typing for self-chat entirely
      if (myIdBase && normalizeId(chatId) === myIdBase) {
        return false
      }

      // Check all stored presences for typing status
      for (const [, presence] of state.chatPresences) {
        const typingPresence = presence.presences?.find(
          (p) => p.lastKnownPresence === "typing" || p.lastKnownPresence === "recording"
        )
        if (typingPresence) {
          // Skip if this is our own typing
          const participantBase = normalizeId(typingPresence.participant)
          if (myIdBase && participantBase === myIdBase) {
            continue
          }

          // Try to map the LID participant to a phone number
          const participantLid = typingPresence.participant
          const phoneNumber = state.lidToPhoneMap.get(participantLid)

          // Match if:
          // 1. Phone number matches the chatId (1:1 chat)
          if (phoneNumber === chatId) return true

          // Also try partial match (phone number without suffix)
          if (phoneNumber && chatId.startsWith(normalizeId(phoneNumber))) return true

          // Fallback: if no mapping, check if participant starts with chatId base
          const chatIdBase = normalizeId(chatId)
          if (participantLid.includes(chatIdBase)) return true
        }
      }
      return false
    },

    getTypingForChatList(chatId: string): string | null {
      // Check if typing for the specific chat
      for (const [, presence] of state.chatPresences) {
        if (presence.id === chatId) {
          // Direct match
          const typingPresence = presence.presences?.find(
            (p) => p.lastKnownPresence === "typing" || p.lastKnownPresence === "recording"
          )
          if (typingPresence) {
            const participantLid = typingPresence.participant
            const phoneNumber = state.lidToPhoneMap.get(participantLid) || participantLid
            return phoneNumber
          }
        }
      }
      return null
    },

    clearTypingForSender(senderId: string) {
      const chatPresences = new Map(state.chatPresences)
      let hasChanges = false

      let senderLid: string | null = null
      for (const [lid, phone] of state.lidToPhoneMap) {
        if (phone === senderId) {
          senderLid = lid
          break
        }
      }

      for (const [chatId, presence] of chatPresences) {
        if (presence.presences) {
          const updatedPresences = presence.presences.map((p) => {
            if (
              (senderLid && p.participant === senderLid) ||
              p.participant === senderId ||
              p.participant.includes(normalizeId(senderId))
            ) {
              if (p.lastKnownPresence === "typing" || p.lastKnownPresence === "recording") {
                hasChanges = true
                return { ...p, lastKnownPresence: "paused" as const }
              }
            }
            return p
          })
          chatPresences.set(chatId, { ...presence, presences: updatedPresences })
        }
      }

      if (hasChanges) {
        debugLog("Presence", `Cleared typing for sender: ${senderId}`)
        const updates: Partial<ChatState> = { chatPresences }

        if (state.currentChatPresence?.presences) {
          const updatedCurrentPresences = state.currentChatPresence.presences.map((p) => {
            if (
              (senderLid && p.participant === senderLid) ||
              p.participant === senderId ||
              p.participant.includes(normalizeId(senderId))
            ) {
              if (p.lastKnownPresence === "typing" || p.lastKnownPresence === "recording") {
                return { ...p, lastKnownPresence: "paused" as const }
              }
            }
            return p
          })
          updates.currentChatPresence = {
            ...state.currentChatPresence,
            presences: updatedCurrentPresences,
          }
        }
        state = { ...state, ...updates }
        notify()
      }
    },

    setLidToPhoneMap(lidToPhoneMap: Map<string, string>) {
      state = { ...state, lidToPhoneMap }
      notify()
    },

    addLidMappings(mappings: Array<{ lid?: string; pn?: string }>) {
      const newMap = new Map(state.lidToPhoneMap)
      for (const mapping of mappings) {
        if (mapping.lid && mapping.pn) {
          newMap.set(mapping.lid, mapping.pn)
        }
      }
      state = { ...state, lidToPhoneMap: newMap }
      notify()
    },

    getPhoneFromLid(lid: string): string | undefined {
      return state.lidToPhoneMap.get(lid)
    },
  }
}
