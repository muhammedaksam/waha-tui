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

export type ViewType = "sessions" | "chats" | "conversation" | "settings" | "qr" | "loading"

export type ActiveFilter = "all" | "unread" | "favorites" | "groups"
export type ActiveIcon = "chats" | "status" | "profile" | "settings" | "channels" | "communities"

// Type of state change - enables render optimization
export type ChangeType = "selection" | "scroll" | "data" | "view" | "other"

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

  addMessage(chatId: string, message: WAMessage): void {
    const messages = new Map(this.state.messages)
    const existing = messages.get(chatId) || []
    messages.set(chatId, [...existing, message])
    this.setState({ messages })
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

  getContactName(contactId: string): string | undefined {
    return this.state.contactsCache.get(contactId)
  }

  setCurrentChatPresence(currentChatPresence: WAHAChatPresences | null): void {
    this.setState({ currentChatPresence })
  }

  setCurrentChatParticipants(currentChatParticipants: GroupParticipant[] | null): void {
    this.setState({ currentChatParticipants })
  }

  setMyProfile(myProfile: MyProfile | null): void {
    this.setState({ myProfile })
  }
}

export const appState = new StateManager()
