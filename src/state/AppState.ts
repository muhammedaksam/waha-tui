/**
 * Application State
 * Global state management for the TUI
 */

import type {
  ChatSummary,
  GroupParticipant,
  MyProfile,
  SessionDTO,
  WAHAChatPresences,
  WAMessage,
} from "@muhammedaksam/waha-node"

import type {
  ActiveFilter,
  ActiveIcon,
  AuthMode,
  AuthState,
  ChangeType,
  ChatState,
  ConfigStep,
  ContactState,
  ContextMenuState,
  ContextMenuType,
  MessageState,
  ModalState,
  NavigationState,
  NotificationSettings,
  PairingStatus,
  SessionState,
  SettingsPage,
  SettingsState,
  UIState,
  ViewType,
} from "~/state/slices"
import type { WAMessageExtended } from "~/types"
import type { UpdateInfo } from "~/utils/update-checker"
import { TIME_MS } from "~/constants"
import {
  createAuthSlice,
  createChatSlice,
  createContactSlice,
  createMessageSlice,
  createModalSlice,
  createNavigationSlice,
  createSessionSlice,
  createSettingsSlice,
  createUISlice,
} from "~/state/slices"
import { getChatIdString } from "~/utils/formatters"
import { dismissUpdate } from "~/utils/update-checker"

// Re-export types for backward compatibility
export type {
  ActiveFilter,
  ActiveIcon,
  AuthMode,
  ChangeType,
  ConfigStep,
  ContextMenuState,
  ContextMenuType,
  NotificationSettings,
  PairingStatus,
  SettingsPage,
  ViewType,
}

// Combined AppState interface
export interface AppState
  extends
    SessionState,
    ChatState,
    MessageState,
    UIState,
    NavigationState,
    SettingsState,
    AuthState,
    ModalState,
    ContactState {}

class StateManager {
  // Slices
  private sessionSlice = createSessionSlice()
  private chatSlice = createChatSlice()
  private messageSlice = createMessageSlice()
  private uiSlice = createUISlice()
  private navigationSlice = createNavigationSlice()
  private settingsSlice = createSettingsSlice()
  private authSlice = createAuthSlice()
  private modalSlice = createModalSlice()
  private contactSlice = createContactSlice()

  // Aggregated state cache
  private state: AppState

  private listeners: Array<(state: AppState) => void> = []

  constructor() {
    // Initialize aggregated state
    this.state = this.buildState()

    // Subscribe to all slices to update aggregated state
    const updateState = () => {
      this.state = this.buildState()
      this.notifyListeners()
    }

    this.sessionSlice.subscribe(updateState)
    this.chatSlice.subscribe(updateState)
    this.messageSlice.subscribe(updateState)
    this.uiSlice.subscribe(updateState)
    this.navigationSlice.subscribe(updateState)
    this.settingsSlice.subscribe(updateState)
    this.authSlice.subscribe(updateState)
    this.modalSlice.subscribe(updateState)
    this.contactSlice.subscribe(updateState)
  }

  private buildState(): AppState {
    return {
      ...this.sessionSlice.get(),
      ...this.chatSlice.get(),
      ...this.messageSlice.get(),
      ...this.uiSlice.get(),
      ...this.navigationSlice.get(),
      ...this.settingsSlice.get(),
      ...this.authSlice.get(),
      ...this.modalSlice.get(),
      ...this.contactSlice.get(),
    }
  }

  // --- Core API ---

  getState(): AppState {
    return { ...this.state }
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.push(listener)
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

  /**
   * Reset all slices to their initial state.
   * Used primarily for testing to ensure clean state between tests.
   */
  reset(): void {
    this.sessionSlice.reset()
    this.chatSlice.reset()
    this.messageSlice.reset()
    this.uiSlice.reset()
    this.navigationSlice.reset()
    this.settingsSlice.reset()
    this.authSlice.reset()
    this.modalSlice.reset()
    this.contactSlice.reset()
    // Rebuild the aggregated state
    this.state = this.buildState()
  }

  // --- Helper Methods (Delegating to Slices) ---

  // UI
  setCurrentView(currentView: ViewType): void {
    this.uiSlice.setCurrentView(currentView)
    this.navigationSlice.set({ lastChangeType: "view" }) // Cross-slice update

    // Sync active icon with view
    if (currentView === "settings") {
      this.uiSlice.setActiveIcon("settings")
    } else if (currentView === "chats" || currentView === "conversation") {
      this.uiSlice.setActiveIcon("chats")
    }
  }

  setActiveFilter(activeFilter: ActiveFilter): void {
    this.uiSlice.setActiveFilter(activeFilter)
    this.navigationSlice.setSelectedChatIndex(0)
    this.navigationSlice.setChatListScrollOffset(0)
    this.navigationSlice.set({ lastChangeType: "data" })
  }

  setSearchQuery(searchQuery: string): void {
    this.uiSlice.setSearchQuery(searchQuery)
    this.navigationSlice.setSelectedChatIndex(0)
    this.navigationSlice.setChatListScrollOffset(0)
    this.navigationSlice.set({ lastChangeType: "data" })
  }

  setShowingArchivedChats(showingArchivedChats: boolean): void {
    this.chatSlice.setShowingArchivedChats(showingArchivedChats)
    this.navigationSlice.setSelectedChatIndex(0)
    this.navigationSlice.setChatListScrollOffset(0)
    this.navigationSlice.set({ lastChangeType: "data" })
  }

  // Session
  setCurrentSession(currentSession: string | null): void {
    this.sessionSlice.setCurrentSession(currentSession)
  }

  setSessions(sessions: SessionDTO[]): void {
    this.sessionSlice.setSessions(sessions)
  }

  setConnectionStatus(
    connectionStatus: SessionState["connectionStatus"],
    errorMessage?: string
  ): void {
    this.sessionSlice.setConnectionStatus(connectionStatus, errorMessage)
  }

  // Chat
  setCurrentChat(currentChatId: string | null): void {
    this.chatSlice.setCurrentChat(currentChatId)
    // Side effect: update view
    this.uiSlice.setCurrentView(currentChatId ? "conversation" : "chats")
  }

  setChats(chats: ChatSummary[]): void {
    this.chatSlice.setChats(chats)
    this.navigationSlice.set({ lastChangeType: "data" })
  }

  setCurrentChatParticipants(currentChatParticipants: GroupParticipant[] | null): void {
    this.chatSlice.setCurrentChatParticipants(currentChatParticipants)
  }

  setCurrentChatPresence(currentChatPresence: WAHAChatPresences | null): void {
    this.chatSlice.setCurrentChatPresence(currentChatPresence)
  }

  // Alias for setCurrentChatPresence
  setChatPresence(currentChatPresence: WAHAChatPresences | null): void {
    this.chatSlice.setCurrentChatPresence(currentChatPresence)
  }

  setChatParticipants(participants: GroupParticipant[] | null): void {
    this.chatSlice.set({ currentChatParticipants: participants })
  }

  updateChatPresence(chatId: string, presence: WAHAChatPresences): void {
    this.chatSlice.updateChatPresence(chatId, presence)
    // Check if update triggered a change in current chat presence or list
    if (this.state.currentChatId === chatId || !this.state.currentChatId) {
      this.navigationSlice.set({ lastChangeType: "data" })
    }
  }

  updateChatLastMessageAck(chatId: string, messageId: string, ack: number, ackName: string): void {
    this.chatSlice.updateChatLastMessageAck(chatId, messageId, ack, ackName)
    this.navigationSlice.set({ lastChangeType: "data" })
  }

  isChatTyping(chatId: string): boolean {
    return this.chatSlice.isChatTyping(chatId, this.state.myProfile?.id)
  }

  getTypingForChatList(): string | null {
    if (!this.state.currentChatId) return null
    return this.chatSlice.getTypingForChatList(this.state.currentChatId)
  }

  clearTypingForSender(senderId: string): void {
    this.chatSlice.clearTypingForSender(senderId)
    this.navigationSlice.set({ lastChangeType: "data" })
  }

  // Message
  setMessages(chatId: string, messagesToSet: WAMessageExtended[]): void {
    this.messageSlice.setMessages(chatId, messagesToSet)
  }

  appendMessage(chatId: string, message: WAMessage): void {
    this.messageSlice.appendMessage(chatId, message)

    // Also update the chat list's lastMessage
    const chatIndex = this.state.chats.findIndex((c) => getChatIdString(c.id) === chatId)
    if (chatIndex !== -1) {
      const chat = this.state.chats[chatIndex]
      const updatedChat = { ...chat, lastMessage: message }
      const newChats = [...this.state.chats]
      newChats[chatIndex] = updatedChat
      // Dispatch updates
      this.chatSlice.setChats(newChats)
      this.navigationSlice.set({ lastChangeType: "data" })
    } else {
      this.navigationSlice.set({ lastChangeType: "data" })
    }
  }

  updateMessageAck(chatId: string, messageId: string, ack: number, ackName: string): void {
    this.messageSlice.updateMessageAck(chatId, messageId, ack, ackName)
    this.navigationSlice.set({ lastChangeType: "data" })
  }

  updateMessageReaction(
    chatId: string,
    messageId: string,
    reaction: string,
    senderId?: string
  ): void {
    this.messageSlice.updateMessageReaction(chatId, messageId, reaction, senderId)
    this.navigationSlice.set({ lastChangeType: "data" })
  }

  markMessageRevoked(chatId: string, messageId: string): void {
    this.messageSlice.markMessageRevoked(chatId, messageId)
    this.navigationSlice.set({ lastChangeType: "data" })
  }

  setScrollPosition(scrollPosition: number): void {
    this.messageSlice.setScrollPosition(scrollPosition)
  }

  setMessageInput(messageInput: string): void {
    this.messageSlice.setMessageInput(messageInput)
  }

  setInputMode(inputMode: boolean): void {
    this.messageSlice.setInputMode(inputMode)
  }

  setIsSending(isSending: boolean): void {
    this.messageSlice.setIsSending(isSending)
  }

  setInputHeight(inputHeight: number): void {
    this.messageSlice.setInputHeight(inputHeight)
  }

  setReplyingToMessage(message: WAMessageExtended | WAMessage | null): void {
    this.messageSlice.setReplyingToMessage(message)
  }

  // Navigation
  setSelectedSessionIndex(selectedSessionIndex: number): void {
    this.navigationSlice.setSelectedSessionIndex(selectedSessionIndex)
  }

  setSelectedChatIndex(selectedChatIndex: number): void {
    this.navigationSlice.setSelectedChatIndex(selectedChatIndex)
  }

  // Contact
  setContactsCache(contactsCache: Map<string, string>): void {
    this.contactSlice.setContactsCache(contactsCache)
  }

  setAllContacts(allContacts: Map<string, string>): void {
    this.contactSlice.setAllContacts(allContacts)
  }

  getContactName(contactId: string): string | undefined {
    return this.contactSlice.getContactName(contactId)
  }

  setMyProfile(myProfile: MyProfile | null): void {
    this.contactSlice.setMyProfile(myProfile)
  }

  setLidToPhoneMap(lidToPhoneMap: Map<string, string>): void {
    this.chatSlice.setLidToPhoneMap(lidToPhoneMap)
  }

  addLidMappings(mappings: Array<{ lid?: string; pn?: string }>): void {
    this.chatSlice.addLidMappings(mappings)
  }

  getPhoneFromLid(lid: string): string | undefined {
    return this.chatSlice.getPhoneFromLid(lid)
  }

  // Modal / Toast
  showToast(
    message: string,
    type: "error" | "warning" | "success" | "info" = "info",
    autoDismissMs: number = TIME_MS.TOAST_DEFAULT_AUTO_DISMISS
  ): void {
    this.modalSlice.showToast(message, type, autoDismissMs)
  }

  hideToast(): void {
    this.modalSlice.hideToast()
  }

  // Context Menu
  openContextMenu(
    type: ContextMenuType,
    targetId: string,
    targetData?: ChatSummary | WAMessage | WAMessageExtended | null,
    position: { x: number; y: number } = { x: 10, y: 5 }
  ): void {
    this.modalSlice.openContextMenu(type, targetId, targetData, position)
  }

  closeContextMenu(): void {
    this.modalSlice.closeContextMenu()
  }

  setContextMenuSelectedIndex(selectedIndex: number): void {
    this.modalSlice.setContextMenuSelectedIndex(selectedIndex)
  }

  setContextMenuActionCallback(callback: (actionId: string) => void): void {
    this.modalSlice.setContextMenuActionCallback(callback)
  }

  triggerContextMenuAction(actionId: string): void {
    this.modalSlice.triggerContextMenuAction(actionId)
  }

  // Modal
  setShowLogoutModal(showLogoutModal: boolean): void {
    this.modalSlice.set({ showLogoutModal })
  }

  setUpdateModal(show: boolean, info?: UpdateInfo): void {
    this.modalSlice.setUpdateModal(show, info)
  }

  dismissUpdateModal(): void {
    const state = this.modalSlice.getState()
    if (state.updateInfo?.latestVersion) {
      dismissUpdate(state.updateInfo.latestVersion)
    }
    this.modalSlice.setUpdateModal(false)
  }

  setConfigStep(configStep: ConfigStep | null): void {
    this.modalSlice.setConfigStep(configStep)
  }

  // Settings
  setSettingsPage(settingsPage: SettingsPage): void {
    this.settingsSlice.setSettingsPage(settingsPage)
  }

  setSettingsSelectedIndex(settingsSelectedIndex: number): void {
    this.settingsSlice.setSettingsSelectedIndex(settingsSelectedIndex)
  }

  setSettingsSubIndex(settingsSubIndex: number): void {
    this.settingsSlice.setSettingsSubIndex(settingsSubIndex)
  }

  setEnterIsSend(enterIsSend: boolean): void {
    this.settingsSlice.setEnterIsSend(enterIsSend)
  }

  setMessageNotifications(settings: NotificationSettings): void {
    this.settingsSlice.setMessageNotifications(settings)
  }

  setGroupNotifications(settings: NotificationSettings): void {
    this.settingsSlice.setGroupNotifications(settings)
  }

  setStatusNotifications(settings: NotificationSettings): void {
    this.settingsSlice.setStatusNotifications(settings)
  }

  setShowPreviews(showPreviews: boolean): void {
    this.settingsSlice.setShowPreviews(showPreviews)
  }

  setBackgroundSync(backgroundSync: boolean): void {
    this.settingsSlice.setBackgroundSync(backgroundSync)
  }

  // Auth
  setAuthMode(authMode: AuthMode): void {
    this.authSlice.setAuthMode(authMode)
  }

  setPhoneNumber(phoneNumber: string): void {
    this.authSlice.setPhoneNumber(phoneNumber)
  }

  setPairingCode(pairingCode: string | null): void {
    this.authSlice.setPairingCode(pairingCode)
  }

  setPairingStatus(pairingStatus: PairingStatus): void {
    this.authSlice.setPairingStatus(pairingStatus)
  }

  setPairingError(pairingError: string | null): void {
    this.authSlice.setPairingError(pairingError)
  }

  setQrCodeMatrix(qrCodeMatrix: AuthState["qrCodeMatrix"]): void {
    this.authSlice.setQrCodeMatrix(qrCodeMatrix)
  }

  // Contact
  setWahaTier(wahaTier: string | null): void {
    this.contactSlice.setWahaTier(wahaTier)
  }

  // Session
  setIsOffline(isOffline: boolean): void {
    this.sessionSlice.set({ isOffline })
  }

  // Navigation
  setChatListScrollOffset(chatListScrollOffset: number): void {
    this.navigationSlice.setChatListScrollOffset(chatListScrollOffset)
  }

  setLastChangeType(lastChangeType: ChangeType): void {
    this.navigationSlice.set({ lastChangeType })
  }
}

export const appState = new StateManager()
