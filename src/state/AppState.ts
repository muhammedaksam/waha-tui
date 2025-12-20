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

// Context menu types
export type ContextMenuType = "chat" | "message" | null

export interface ContextMenuState {
  visible: boolean
  type: ContextMenuType
  targetId: string | null // Chat ID or Message ID
  targetData?: ChatSummary | WAMessage | null // The actual chat or message data
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
  messages: Map<string, WAMessage[]>
  contactsCache: Map<string, string> // Maps contact ID to name
  allContacts: Map<string, string> // Full phonebook contacts for search
  connectionStatus: "connected" | "connecting" | "disconnected" | "error"
  errorMessage: string | null
  currentChatPresence: WAHAChatPresences | null
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

  // Config wizard state
  configStep: ConfigStep | null

  // Context menu state
  contextMenu: ContextMenuState | null

  // Reply state - message being replied to
  replyingToMessage: WAMessage | null
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

  setMessages(chatId: string, messagesToSet: WAMessage[]): void {
    const messages = new Map(this.state.messages)
    messages.set(chatId, messagesToSet)
    this.setState({ messages })
  }

  appendMessage(chatId: string, message: WAMessage): void {
    const messages = new Map(this.state.messages)
    const existing = messages.get(chatId) || []

    // Check if message already exists (deduplication)
    if (existing.some((m) => m.id === message.id)) {
      return
    }

    const newMessages = [message, ...existing]
    // Re-sort just in case to be safe
    newMessages.sort((a, b) => b.timestamp - a.timestamp)

    messages.set(chatId, newMessages)
    this.setState({ messages, lastChangeType: "data" })
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

  updateMessageReaction(chatId: string, messageId: string, reaction: string): void {
    const messages = new Map(this.state.messages)
    const chatMessages = messages.get(chatId)
    if (!chatMessages) return

    const msgIndex = chatMessages.findIndex((m) => m.id === messageId)
    if (msgIndex === -1) return

    // Placeholder:
    debugLog("AppState", `Reaction update for ${messageId}: ${reaction}`)
    // To properly update, we'd need to fetch message again or know the full new state.
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

  updateChatPresence(chatId: string, presence: WAHAChatPresences): void {
    if (this.state.currentChatId !== chatId) return

    // Merge with existing presence or set new
    const current = this.state.currentChatPresence
    let newPresences = presence.presences

    if (current && current.presences) {
      // Merge logic: update existing presences, add new ones
      const existingMap = new Map(current.presences.map((p) => [p.participant, p]))

      for (const p of presence.presences) {
        existingMap.set(p.participant, p)
      }

      newPresences = Array.from(existingMap.values())
    }

    this.setState({
      currentChatPresence: {
        id: chatId,
        presences: newPresences,
      },
    })
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
    targetData?: ChatSummary | WAMessage | null,
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
  setReplyingToMessage(message: WAMessage | null): void {
    this.setState({ replyingToMessage: message })
  }
}

export const appState = new StateManager()
