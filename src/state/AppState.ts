/**
 * Application State
 * Global state management for the TUI
 */

import type {
  SessionDTO,
  ChatSummary,
  WAMessage,
  WAHAChatPresences,
  GroupParticipant,
  MyProfile,
} from "@muhammedaksam/waha-node"
import { debugLog } from "../utils/debug"
import { getChatIdString, normalizeId } from "../utils/formatters"
import type { WAMessageExtended } from "../types"

// Context menu types
export type ContextMenuType = "chat" | "message" | null

export interface ContextMenuState {
  visible: boolean
  type: ContextMenuType
  targetId: string | null // Chat ID or Message ID
  targetData?: ChatSummary | WAMessage | WAMessageExtended | null // The actual chat or message data
  selectedIndex: number // Currently highlighted menu item
  position: {
    x: number
    y: number
    bubbleWidth?: number // For message bubbles - the width of the bubble
    bubbleHeight?: number // For message bubbles - the height of the bubble
  }
}

export type ViewType =
  | "config"
  | "sessions"
  | "chats"
  | "conversation"
  | "settings"
  | "qr"
  | "loading"

export type ActiveFilter = "all" | "unread" | "favorites" | "groups"
export type ActiveIcon = "chats" | "status" | "profile" | "settings" | "channels" | "communities"

// Type of state change - enables render optimization
export type ChangeType = "selection" | "scroll" | "data" | "view" | "other"

// Configuration wizard step state
export interface ConfigStep {
  step: 1 | 2 | 3
  wahaUrl: string
  wahaApiKey: string
  status: "input" | "testing" | "success" | "error"
  errorMessage?: string
}

export interface AppState {
  currentView: ViewType
  currentSession: string | null
  currentChatId: string | null
  sessions: SessionDTO[]
  chats: ChatSummary[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  qrCodeMatrix: any | null // QRCode type from qrcode library
  messages: Map<string, WAMessageExtended[]>
  contactsCache: Map<string, string> // Maps contact ID to name
  allContacts: Map<string, string> // Full phonebook contacts for search
  connectionStatus: "connected" | "connecting" | "disconnected" | "error"
  errorMessage: string | null
  currentChatPresence: WAHAChatPresences | null
  chatPresences: Map<string, WAHAChatPresences> // Track presence for all chats (for chat list typing)
  lidToPhoneMap: Map<string, string> // Maps @lid IDs to @c.us IDs
  currentChatParticipants: GroupParticipant[] | null
  myProfile: MyProfile | null // Current user's profile (id, name, picture)
  wahaTier: string | null // WAHA tier ("PLUS", "CORE", etc.)

  // UI State for WhatsApp-style layout
  activeFilter: ActiveFilter
  activeIcon: ActiveIcon
  searchQuery: string
  showingArchivedChats: boolean // Toggle to show archived chats instead of main list
  messageInput: string

  // Conversation view state
  scrollPosition: number
  inputMode: boolean
  isSending: boolean
  inputHeight: number // Dynamic height for message input (1-8 lines)

  // Keyboard navigation state
  selectedSessionIndex: number
  selectedChatIndex: number

  // Chat list scroll state (item offset, not pixel offset)
  chatListScrollOffset: number

  // Optimization: track what kind of change occurred
  lastChangeType: ChangeType

  // Reply state
  replyingToMessage: WAMessageExtended | WAMessage | null

  // Config wizard state
  configStep: ConfigStep | null

  // Context menu state
  contextMenu: ContextMenuState | null
}

class StateManager {
  private state: AppState = {
    currentView: "sessions",
    currentSession: null,
    currentChatId: null,
    sessions: [],
    chats: [],
    qrCodeMatrix: null,
    messages: new Map(),
    contactsCache: new Map(),
    allContacts: new Map(),
    connectionStatus: "disconnected",
    errorMessage: null,
    currentChatPresence: null,
    chatPresences: new Map(),
    lidToPhoneMap: new Map(),
    currentChatParticipants: null,
    myProfile: null,
    wahaTier: null,

    // UI State
    activeFilter: "all",
    activeIcon: "chats",
    searchQuery: "",
    showingArchivedChats: false,
    messageInput: "",

    // Conversation view state
    scrollPosition: 0,
    inputMode: false,
    isSending: false,
    inputHeight: 3, // Default: 1 line + 2 for border

    // Keyboard navigation
    selectedSessionIndex: 0,
    selectedChatIndex: 0,

    // Chat list scroll state
    chatListScrollOffset: 0,

    // Optimization: track what kind of change
    lastChangeType: "other",

    // Config wizard
    configStep: null,

    // Context menu
    contextMenu: null,

    // Reply state
    replyingToMessage: null,
  }

  private listeners: Array<(state: AppState) => void> = []

  getState(): AppState {
    return { ...this.state }
  }

  setState(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.push(listener)
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(): void {
    const state = this.getState()
    for (const listener of this.listeners) {
      listener(state)
    }
  }

  // Helper methods
  setCurrentView(currentView: ViewType): void {
    this.setState({ currentView, lastChangeType: "view" })
  }

  setCurrentSession(currentSession: string | null): void {
    this.setState({ currentSession })
  }

  setCurrentChat(currentChatId: string | null): void {
    this.setState({
      currentChatId,
      currentView: currentChatId ? "conversation" : "chats",
      currentChatPresence: null,
      currentChatParticipants: null,
    })
  }

  setSessions(sessions: SessionDTO[]): void {
    this.setState({ sessions })
  }

  setChats(chats: ChatSummary[]): void {
    this.setState({ chats, lastChangeType: "data" })
  }

  setMessages(chatId: string, messagesToSet: WAMessageExtended[]): void {
    const messagesMap = new Map(this.state.messages)
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
    this.setState({ messages: messagesMap })
  }

  appendMessage(chatId: string, message: WAMessage): void {
    const messagesMap = new Map(this.state.messages)
    const existing = messagesMap.get(chatId) || []

    // Check if message already exists (deduplication)
    const existingIdx = existing.findIndex((m) => m.id === message.id)
    if (existingIdx !== -1) {
      // If it exists, update it but preserve reactions
      const currentMsg = existing[existingIdx]
      const updatedMsg = { ...message, reactions: currentMsg.reactions } as WAMessageExtended
      const nextMessages = [...existing]
      nextMessages[existingIdx] = updatedMsg
      messagesMap.set(chatId, nextMessages)
      this.setState({ messages: messagesMap, lastChangeType: "data" })
      return
    }

    const newMessages = [message, ...existing]
    // Re-sort just in case to be safe
    newMessages.sort((a, b) => b.timestamp - a.timestamp)

    messagesMap.set(chatId, newMessages)

    // Also update the chat list's lastMessage so the chat list shows the latest message
    const chatIndex = this.state.chats.findIndex((c) => getChatIdString(c.id) === chatId)
    if (chatIndex !== -1) {
      const chat = this.state.chats[chatIndex]
      const updatedChat = { ...chat, lastMessage: message }
      const newChats = [...this.state.chats]
      newChats[chatIndex] = updatedChat
      this.setState({ messages: messagesMap, chats: newChats, lastChangeType: "data" })
    } else {
      this.setState({ messages: messagesMap, lastChangeType: "data" })
    }
  }

  updateMessageAck(chatId: string, messageId: string, ack: number, ackName: string): void {
    const messages = new Map(this.state.messages)
    const chatMessages = messages.get(chatId)

    if (!chatMessages) return

    const msgIndex = chatMessages.findIndex((m) => m.id === messageId)
    if (msgIndex === -1) return

    const updatedMsg = { ...chatMessages[msgIndex], ack: ack as WAMessage["ack"], ackName }
    const newChatMessages = [...chatMessages]
    newChatMessages[msgIndex] = updatedMsg

    messages.set(chatId, newChatMessages)
    this.setState({ messages, lastChangeType: "data" })
  }

  /**
   * Update the ack status of a chat's lastMessage in the chat list
   * This ensures the chat list shows updated read receipts in real-time
   */
  updateChatLastMessageAck(chatId: string, messageId: string, ack: number, ackName: string): void {
    const chatIndex = this.state.chats.findIndex((c) => getChatIdString(c.id) === chatId)
    if (chatIndex === -1) return

    const chat = this.state.chats[chatIndex]
    const lastMessage = chat.lastMessage as Record<string, unknown> | undefined
    if (!lastMessage) return

    // Only update if this is the last message of the chat
    if (lastMessage.id !== messageId) return

    // Create updated chat with new ack
    const updatedLastMessage = { ...lastMessage, ack, ackName }
    const updatedChat = { ...chat, lastMessage: updatedLastMessage }

    const newChats = [...this.state.chats]
    newChats[chatIndex] = updatedChat

    this.setState({ chats: newChats, lastChangeType: "data" })
  }

  updateMessageReaction(
    chatId: string,
    messageId: string,
    reaction: string,
    senderId?: string
  ): void {
    const messages = new Map(this.state.messages)
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

    debugLog("AppState", `Reaction update for ${messageId}: ${reaction} from ${senderId}`)

    // Logic:
    // 1. If reaction is empty, it might mean removal (depending on WAHA payload, usually empty string implies revoke)
    // 2. If senderId is known, we should look for existing reaction from this sender and update/remove it.
    // 3. If senderId is unknown, we just append (naive) or try to find if we have this reaction already?
    //    Ideally we should always have a senderId.

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
      // Fallback for when we don't know the sender (shouldn't happen with correct implementation)
      // Just add it if not empty
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
    this.setState({ messages, lastChangeType: "data" })
  }

  markMessageRevoked(chatId: string, messageId: string): void {
    const messages = new Map(this.state.messages)
    const chatMessages = messages.get(chatId)
    if (!chatMessages) return

    const msgIndex = chatMessages.findIndex((m) => m.id === messageId)
    if (msgIndex === -1) return

    const updatedMsg = { ...chatMessages[msgIndex], body: "🚫 This message was deleted" }
    const newChatMessages = [...chatMessages]
    newChatMessages[msgIndex] = updatedMsg

    messages.set(chatId, newChatMessages)
    this.setState({ messages, lastChangeType: "data" })
  }

  setConnectionStatus(connectionStatus: AppState["connectionStatus"], errorMessage?: string): void {
    this.setState({ connectionStatus, errorMessage })
  }

  setSelectedSessionIndex(selectedSessionIndex: number): void {
    this.setState({ selectedSessionIndex })
  }

  setSelectedChatIndex(selectedChatIndex: number): void {
    debugLog(
      "[AppState]",
      `setSelectedChatIndex: ${this.state.selectedChatIndex} -> ${selectedChatIndex}`
    )
    this.setState({ selectedChatIndex })
    debugLog(
      "[AppState]",
      `State updated, selectedChatIndex is now: ${this.state.selectedChatIndex}`
    )
  }

  setMessageInput(messageInput: string): void {
    this.setState({ messageInput })
  }

  setScrollPosition(scrollPosition: number): void {
    this.setState({ scrollPosition })
  }

  setInputMode(inputMode: boolean): void {
    this.setState({ inputMode })
  }

  setIsSending(isSending: boolean): void {
    this.setState({ isSending })
  }

  setInputHeight(inputHeight: number): void {
    if (this.state.inputHeight !== inputHeight) {
      this.setState({ inputHeight })
    }
  }

  setContactsCache(contactsCache: Map<string, string>): void {
    this.setState({ contactsCache })
  }

  setAllContacts(allContacts: Map<string, string>): void {
    this.setState({ allContacts })
  }

  getContactName(contactId: string): string | undefined {
    return this.state.contactsCache.get(contactId)
  }

  setCurrentChatPresence(currentChatPresence: WAHAChatPresences | null): void {
    this.setState({ currentChatPresence })
  }

  /**
   * Update presence for any chat (for chat list typing indicators)
   * Also updates currentChatPresence if the chat is currently open
   */
  updateChatPresence(chatId: string, presence: WAHAChatPresences): void {
    // Always store in global chatPresences Map (using the ID from the event)
    const chatPresences = new Map(this.state.chatPresences)

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

    // If we're viewing a chat, also update currentChatPresence
    if (this.state.currentChatId) {
      const current = this.state.currentChatPresence
      let currentNewPresences = presence.presences

      if (current && current.presences) {
        const existingMap = new Map(current.presences.map((p) => [p.participant, p]))
        for (const p of presence.presences) {
          existingMap.set(p.participant, p)
        }
        currentNewPresences = Array.from(existingMap.values())
      }

      this.setState({
        chatPresences,
        currentChatPresence: {
          id: this.state.currentChatId,
          presences: currentNewPresences,
        },
        lastChangeType: "data", // Trigger chat list refresh
      })
    } else {
      this.setState({ chatPresences, lastChangeType: "data" })
    }
  }

  /**
   * Clear typing status for a sender when they send a message
   * WhatsApp doesn't always send a "paused" presence update after sending
   */
  clearTypingForSender(senderId: string): void {
    const chatPresences = new Map(this.state.chatPresences)
    let hasChanges = false

    // Find the LID for this sender (reverse lookup)
    let senderLid: string | null = null
    for (const [lid, phone] of this.state.lidToPhoneMap) {
      if (phone === senderId) {
        senderLid = lid
        break
      }
    }

    // Update all presences to remove typing for this sender
    for (const [chatId, presence] of chatPresences) {
      if (presence.presences) {
        const updatedPresences = presence.presences.map((p) => {
          // Match by LID or by phone ID directly
          if (
            (senderLid && p.participant === senderLid) ||
            p.participant === senderId ||
            p.participant.includes(senderId.replace(/@c\.us$/, ""))
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
      // Also update currentChatPresence if viewing the chat
      if (this.state.currentChatPresence?.presences) {
        const updatedCurrentPresences = this.state.currentChatPresence.presences.map((p) => {
          if (
            (senderLid && p.participant === senderLid) ||
            p.participant === senderId ||
            p.participant.includes(senderId.replace(/@c\.us$/, ""))
          ) {
            if (p.lastKnownPresence === "typing" || p.lastKnownPresence === "recording") {
              return { ...p, lastKnownPresence: "paused" as const }
            }
          }
          return p
        })
        this.setState({
          chatPresences,
          currentChatPresence: {
            ...this.state.currentChatPresence,
            presences: updatedCurrentPresences,
          },
          lastChangeType: "data",
        })
      } else {
        this.setState({ chatPresences, lastChangeType: "data" })
      }
    }
  }

  /**
   * Check if any participant in a chat is typing
   * Uses LID mapping to match presence updates to chat IDs
   * Filters out the current user's own typing
   */
  isChatTyping(chatId: string): boolean {
    // Get my profile ID to filter out self-typing
    const myProfileId = this.state.myProfile?.id
    const myIdBase = normalizeId(myProfileId)

    // Filter out typing for self-chat entirely
    if (myIdBase && normalizeId(chatId) === myIdBase) {
      return false
    }

    // Check all stored presences for typing status
    for (const [, presence] of this.state.chatPresences) {
      const typingPresence = presence.presences?.find(
        (p) => p.lastKnownPresence === "typing" || p.lastKnownPresence === "recording"
      )
      if (typingPresence) {
        // Skip if this is our own typing
        const participantBase = normalizeId(typingPresence.participant)
        if (myIdBase && participantBase === myIdBase) {
          continue // Skip our own typing
        }

        // Try to map the LID participant to a phone number
        const participantLid = typingPresence.participant
        const phoneNumber = this.state.lidToPhoneMap.get(participantLid)

        // Match if:
        // 1. Phone number matches the chatId (1:1 chat)
        if (phoneNumber === chatId) {
          debugLog("Presence", `isChatTyping: MATCH by exact phone number`)
          return true
        }
        // Also try partial match (phone number without suffix)
        if (phoneNumber && chatId.startsWith(phoneNumber.replace(/@c\.us$/, ""))) {
          debugLog("Presence", `isChatTyping: MATCH by partial phone number`)
          return true
        }
        // Fallback: if no mapping, check if participant starts with chatId base
        const chatIdBase = chatId.replace(/@c\.us$/, "")
        if (participantLid.includes(chatIdBase)) {
          debugLog("Presence", `isChatTyping: MATCH by chatId base in LID`)
          return true
        }
      }
    }
    return false
  }

  /**
   * Get the typing status for chat list display
   * Returns true only for the current chat since we only subscribe to one chat's presence
   */
  getTypingForChatList(): string | null {
    if (!this.state.currentChatId) return null

    for (const [, presence] of this.state.chatPresences) {
      const typingPresence = presence.presences?.find(
        (p) => p.lastKnownPresence === "typing" || p.lastKnownPresence === "recording"
      )
      if (typingPresence) {
        // Try to map the LID participant to a phone number
        const participantLid = typingPresence.participant
        const phoneNumber = this.state.lidToPhoneMap.get(participantLid) || participantLid
        return phoneNumber
      }
    }
    return null
  }

  /**
   * Set the LID to phone number mapping
   */
  setLidToPhoneMap(lidToPhoneMap: Map<string, string>): void {
    this.setState({ lidToPhoneMap })
  }

  /**
   * Add entries to the LID to phone number mapping
   */
  addLidMappings(mappings: Array<{ lid?: string; pn?: string }>): void {
    const newMap = new Map(this.state.lidToPhoneMap)
    for (const mapping of mappings) {
      if (mapping.lid && mapping.pn) {
        newMap.set(mapping.lid, mapping.pn)
      }
    }
    this.setState({ lidToPhoneMap: newMap })
  }

  /**
   * Get phone number (@c.us) from LID (@lid)
   */
  getPhoneFromLid(lid: string): string | undefined {
    return this.state.lidToPhoneMap.get(lid)
  }

  setCurrentChatParticipants(currentChatParticipants: GroupParticipant[] | null): void {
    this.setState({ currentChatParticipants })
  }

  setMyProfile(myProfile: MyProfile | null): void {
    this.setState({ myProfile })
  }

  setActiveFilter(activeFilter: ActiveFilter): void {
    this.setState({
      activeFilter,
      selectedChatIndex: 0,
      chatListScrollOffset: 0,
      lastChangeType: "data",
    })
  }

  setSearchQuery(searchQuery: string): void {
    this.setState({
      searchQuery,
      selectedChatIndex: 0,
      chatListScrollOffset: 0,
      lastChangeType: "data",
    })
  }

  setShowingArchivedChats(showingArchivedChats: boolean): void {
    this.setState({
      showingArchivedChats,
      selectedChatIndex: 0,
      chatListScrollOffset: 0,
      lastChangeType: "data",
    })
  }

  // Context menu methods
  openContextMenu(
    type: ContextMenuType,
    targetId: string,
    targetData?: ChatSummary | WAMessage | WAMessageExtended | null,
    position: { x: number; y: number } = { x: 10, y: 5 }
  ): void {
    this.setState({
      contextMenu: {
        visible: true,
        type,
        targetId,
        targetData,
        selectedIndex: 0,
        position,
      },
    })
  }

  closeContextMenu(): void {
    this.setState({ contextMenu: null })
  }

  setContextMenuSelectedIndex(selectedIndex: number): void {
    if (this.state.contextMenu) {
      this.setState({
        contextMenu: {
          ...this.state.contextMenu,
          selectedIndex,
        },
      })
    }
  }

  // Context menu action callback (set by index.ts)
  private contextMenuActionCallback: ((actionId: string) => void) | null = null

  setContextMenuActionCallback(callback: (actionId: string) => void): void {
    this.contextMenuActionCallback = callback
  }

  triggerContextMenuAction(actionId: string): void {
    if (this.contextMenuActionCallback) {
      this.contextMenuActionCallback(actionId)
    }
  }

  // Reply methods
  setReplyingToMessage(message: WAMessageExtended | WAMessage | null): void {
    this.setState({ replyingToMessage: message })
  }
}

export const appState = new StateManager()
