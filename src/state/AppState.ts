/**
 * Application State
 * Global state management for the TUI
 */

import type { SessionDTO, ChatSummary, WAMessage } from "@muhammedaksam/waha-node"
import { debugLog } from "../utils/debug"

export type ViewType = "sessions" | "chats" | "conversation" | "settings" | "qr"

export type ActiveFilter = "all" | "unread" | "favorites" | "groups"
export type ActiveIcon = "chats" | "status" | "profile" | "settings"

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

  // UI State for WhatsApp-style layout
  activeFilter: ActiveFilter
  activeIcon: ActiveIcon
  searchQuery: string
  messageInput: string

  // Conversation view state
  scrollPosition: number
  inputMode: boolean
  isSending: boolean

  // Keyboard navigation state
  selectedSessionIndex: number
  selectedChatIndex: number
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

    // UI State
    activeFilter: "all",
    activeIcon: "chats",
    searchQuery: "",
    messageInput: "",

    // Conversation view state
    scrollPosition: 0,
    inputMode: false,
    isSending: false,

    // Keyboard navigation
    selectedSessionIndex: 0,
    selectedChatIndex: 0,
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
  setCurrentView(view: ViewType): void {
    this.setState({ currentView: view })
  }

  setCurrentSession(sessionName: string | null): void {
    this.setState({ currentSession: sessionName })
  }

  setCurrentChat(chatId: string | null): void {
    this.setState({ currentChatId: chatId, currentView: chatId ? "conversation" : "chats" })
  }

  setSessions(sessions: SessionDTO[]): void {
    this.setState({ sessions })
  }

  setChats(chats: ChatSummary[]): void {
    this.setState({ chats })
  }

  setMessages(chatId: string, messages: WAMessage[]): void {
    const messagesMap = new Map(this.state.messages)
    messagesMap.set(chatId, messages)
    this.setState({ messages: messagesMap })
  }

  addMessage(chatId: string, message: WAMessage): void {
    const messagesMap = new Map(this.state.messages)
    const existing = messagesMap.get(chatId) || []
    messagesMap.set(chatId, [...existing, message])
    this.setState({ messages: messagesMap })
  }

  setConnectionStatus(status: AppState["connectionStatus"], errorMessage?: string): void {
    this.setState({ connectionStatus: status, errorMessage: errorMessage || null })
  }

  setSelectedSessionIndex(index: number): void {
    this.setState({ selectedSessionIndex: index })
  }

  setSelectedChatIndex(index: number): void {
    debugLog(`[AppState] setSelectedChatIndex: ${this.state.selectedChatIndex} -> ${index}`)
    this.setState({ selectedChatIndex: index })
    debugLog(`[AppState] State updated, selectedChatIndex is now: ${this.state.selectedChatIndex}`)
  }

  setMessageInput(text: string): void {
    this.setState({ messageInput: text })
  }

  setScrollPosition(position: number): void {
    this.setState({ scrollPosition: position })
  }

  setInputMode(enabled: boolean): void {
    this.setState({ inputMode: enabled })
  }

  setIsSending(status: boolean): void {
    this.setState({ isSending: status })
  }

  setContactsCache(contacts: Map<string, string>): void {
    this.setState({ contactsCache: contacts })
  }

  getContactName(contactId: string): string | undefined {
    return this.state.contactsCache.get(contactId)
  }
}

export const appState = new StateManager()
