/**
 * Chat List Manager
 * Manages persistent chat list renderables to avoid rebuilding on every state change
 */

import type { ChatSummary } from "@muhammedaksam/waha-node"
import type { CliRenderer } from "@opentui/core"

import {
  BoxRenderable,
  ScrollBoxRenderable,
  t,
  TextAttributes,
  TextRenderable,
} from "@opentui/core"

import type { AppState } from "../state/AppState"
import type { MessagePreview } from "../utils/formatters"
import { loadContacts, loadMessages, startPresenceManagement } from "../client"
import { Icons, WhatsAppTheme } from "../config/theme"
import { appState } from "../state/AppState"
import { ROW_HEIGHT } from "../utils/chatListScroll"
import { debugLog } from "../utils/debug"
import { isPinned } from "../utils/filterChats"
import {
  extractMessagePreview,
  formatAckStatus,
  getChatIdString,
  getContactName,
  getInitials,
  isGroupChat,
  isSelfChat,
  truncate,
} from "../utils/formatters"
import { destroyConversationScrollBox } from "./ConversationView"

interface ChatRowData {
  box: BoxRenderable
  avatar: BoxRenderable
  avatarText: TextRenderable
  nameText: TextRenderable
  timeText: TextRenderable
  chatInfo: BoxRenderable
  messageRow: BoxRenderable
  messageLeftGroup: BoxRenderable
  ackText: TextRenderable | null
  messageText: TextRenderable
}

interface ExtendedChatSummary extends Omit<ChatSummary, "lastMessage"> {
  lastMessage?: {
    timestamp?: number
    id?: string
    [key: string]: unknown
  }
}

class ChatListManager {
  private static instance: ChatListManager | null = null

  private renderer: CliRenderer | null = null
  private scrollBox: ScrollBoxRenderable | null = null
  private chatRows: Map<number, ChatRowData> = new Map()
  private currentSelectedIndex: number = -1
  private currentScrollOffset: number = 0
  private currentChatsHash: string = ""

  private constructor() {}

  public static getInstance(): ChatListManager {
    if (!ChatListManager.instance) {
      ChatListManager.instance = new ChatListManager()
    }
    return ChatListManager.instance
  }

  /**
   * Check if chat data has changed (different chats loaded)
   */
  // Hash for structure (chat IDs in order)
  private getChatsStructureHash(chats: ChatSummary[]): string {
    return chats.map((c) => c.id).join(",")
  }

  // Hash for content (ids + message timestamps + active/selected state + last message content)
  private getChatsContentHash(chats: ChatSummary[], state: AppState): string {
    const myId = state.myProfile?.id || "null"
    return (
      (chats as unknown as ExtendedChatSummary[])
        .map((c) => `${c.id}:${c.lastMessage?.timestamp || 0}:${c.lastMessage?.id || ""}`)
        .join(",") + `:${myId}`
    )
  }

  /**
   * Build the chat list - only called when chats are loaded or data changes
   */
  public buildChatList(renderer: CliRenderer, chats: ChatSummary[]): ScrollBoxRenderable {
    const state = appState.getState()
    const newStructureHash = this.getChatsStructureHash(chats)
    const newContentHash = this.getChatsContentHash(chats, state)

    // CASE 1: exact same content (no changes)
    if (this.scrollBox && newContentHash === this.currentChatsHash) {
      // debugLog("ChatListManager", "Using cached chat list (exact match)")
      // Still need to update selection/active styling as those may have changed
      this.updateSelectionAndActive(state.selectedChatIndex, state.currentChatId, chats)
      return this.scrollBox
    }

    this.currentChatsHash = newContentHash
    this.currentSelectedIndex = state.selectedChatIndex

    // CASE 2: same structure (same chats, same order), just content update (new message)
    if (
      this.scrollBox &&
      this.currentStructureHash === newStructureHash &&
      this.chatRows.size === chats.length
    ) {
      // debugLog("ChatListManager", "Updating existing chat list content (same structure)")
      this.updateExistingRows(chats)
      return this.scrollBox
    }

    // CASE 3: structure changed (reorder or new chat)
    // Full rebuild required
    // debugLog("ChatListManager", `Rebuilding chat list (structure changed)`)

    // Destroy old renderables if they exist
    this.destroy()

    this.renderer = renderer
    this.currentStructureHash = newStructureHash

    // Create ScrollBox
    this.scrollBox = new ScrollBoxRenderable(renderer, {
      id: "chats-scroll-box",
      flexGrow: 1,
      rootOptions: {
        backgroundColor: WhatsAppTheme.panelDark,
      },
      contentOptions: {
        backgroundColor: WhatsAppTheme.panelDark,
      },
      scrollbarOptions: {
        trackOptions: {
          backgroundColor: WhatsAppTheme.receivedBubble,
          foregroundColor: WhatsAppTheme.borderColor,
        },
      },
    })

    // Build chat rows

    for (let index = 0; index < chats.length; index++) {
      const chat = chats[index]
      this.createChatRow(renderer, chat, index, state.currentChatId === chat.id, state)
    }

    // Apply initial scroll position
    const scrollOffset = state.chatListScrollOffset
    if (scrollOffset > 0) {
      const scrollTop = scrollOffset * ROW_HEIGHT
      setTimeout(() => {
        if (this.scrollBox) {
          this.scrollBox.scrollTop = scrollTop
        }
      }, 0)
    }

    return this.scrollBox
  }

  // Helper to check if structure matches existing rows
  // Helper is no longer needed as we check hash directly
  // private checkStructureMatch(chats: ChatSummary[]): boolean { ... }

  // Store structure hash separately
  private currentStructureHash: string = ""

  private createChatRow(
    renderer: CliRenderer,
    chat: ChatSummary,
    index: number,
    isCurrentChat: boolean,
    state: AppState
  ) {
    if (!this.scrollBox) return

    const isSelected = index === this.currentSelectedIndex

    // Extract message preview
    const preview = extractMessagePreview(chat.lastMessage)
    const chatIdStr = getChatIdString(chat.id)
    const isSelf = isSelfChat(chatIdStr, state.myProfile?.id ?? null)
    const contactName = getContactName(chatIdStr, state.allContacts, chat.name || undefined)
    const displayName = isSelf ? `${contactName} (You)` : contactName
    let lastMessageText = preview.text

    if (isGroupChat(chatIdStr) && preview.text !== "No messages") {
      if (preview.isFromMe) {
        lastMessageText = `You: ${preview.text}`
      }
    }

    // Capture index and chat reference for click handler closure
    const chatIndex = index
    const chatRef = chat

    // Create chat row box
    // Use simple ID to enable in-place updates (no hash in ID)
    const rowId = `chat-row-${index}`
    const chatRow = new BoxRenderable(renderer, {
      id: rowId,
      height: 5,
      flexDirection: "row",
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 1,
      paddingBottom: 1,
      backgroundColor: isSelected
        ? WhatsAppTheme.selectedBg
        : isCurrentChat
          ? WhatsAppTheme.activeBg
          : WhatsAppTheme.panelDark,
      // Handle click (mouse down) to open chat or show context menu
      onMouse: (event) => {
        if (event.type === "down") {
          const currentState = appState.getState()
          if (chatRef && currentState.currentSession) {
            // Extract chat ID properly (handle _serialized property)
            const chatId = getChatIdString(chatRef.id)

            // Right-click (button 2) opens context menu
            if (event.button === 2) {
              debugLog("ChatListManager", `Right-clicked chat: ${chatRef.name || chatId}`)
              appState.setSelectedChatIndex(chatIndex)
              // Pass click position for menu placement
              appState.openContextMenu("chat", chatId, chatRef, { x: event.x, y: event.y })
              return
            }

            // Left-click (button 0) opens chat
            debugLog("ChatListManager", `Clicked chat: ${chatRef.name || chatId}`)

            // Destroy old scroll box before loading new messages
            destroyConversationScrollBox()

            // Set current chat first (this changes view to "conversation")
            appState.setCurrentChat(chatId)
            appState.setSelectedChatIndex(chatIndex)

            // Load contacts and messages
            loadContacts()
            loadMessages(chatId)
            // Start presence management (online/offline + re-subscribe)
            startPresenceManagement(chatId)
          }
        }
      },
    })

    // Avatar
    const avatar = new BoxRenderable(renderer, {
      id: `avatar-${index}`,
      width: 7,
      height: 3,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: WhatsAppTheme.green,
      marginRight: 2,
      // Center vertically in 5-line row (1 line padding top/bottom effectively)
      // Actually with paddingTop:1 on parent, we are already starting at line 2
      // height: 5, total content area = 3 lines (2-4).
      // avatar height 3 fits perfectly.
    })

    const avatarText = new TextRenderable(renderer, {
      content: getInitials(chat.name || ""),
      fg: WhatsAppTheme.white,
      attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
    })
    avatar.add(avatarText)
    chatRow.add(avatar)

    // Chat info container
    const chatInfo = new BoxRenderable(renderer, {
      id: `chat-info-${index}`,
      flexDirection: "column",
      flexGrow: 1,
    })

    // Name and timestamp row
    const nameRow = new BoxRenderable(renderer, {
      id: `name-row-${index}`,
      flexDirection: "row",
      justifyContent: "space-between",
    })

    const nameText = new TextRenderable(renderer, {
      content: truncate(displayName),
      fg: WhatsAppTheme.white,
      attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
    })
    nameRow.add(nameText)

    // Time and pin indicator container
    const timeContainer = new BoxRenderable(renderer, {
      id: `time-container-${index}`,
      flexDirection: "row",
      gap: 1,
    })

    const timeText = new TextRenderable(renderer, {
      content: preview.timestamp,
      fg: WhatsAppTheme.textTertiary,
    })
    timeContainer.add(timeText)

    nameRow.add(timeContainer)
    chatInfo.add(nameRow)

    // Last message row - use space-between to push pin to right
    const messageRow = new BoxRenderable(renderer, {
      id: `message-row-${index}`,
      flexDirection: "row",
      justifyContent: "space-between",
    })

    // Left group: ack status + message text
    const messageLeftGroup = new BoxRenderable(renderer, {
      id: `message-left-${index}`,
      flexDirection: "row",
      gap: 1,
      flexGrow: 1,
    })

    // Add Ack Status if message is from me
    let ackText: TextRenderable | null = null
    if (preview.isFromMe) {
      ackText = new TextRenderable(renderer, {
        content: t`${formatAckStatus(preview.ack, { side: "right", disableSpace: true })}`,
      })
      messageLeftGroup.add(ackText)
    }

    // Check if someone is typing in this chat
    const isTyping = appState.isChatTyping(chatIdStr)

    const messageText = new TextRenderable(renderer, {
      content: isTyping ? "typing..." : truncate(lastMessageText),
      fg: isTyping ? WhatsAppTheme.green : WhatsAppTheme.textSecondary,
    })

    messageLeftGroup.add(messageText)
    messageRow.add(messageLeftGroup)

    // Add pin icon on the right if chat is pinned
    if (isPinned(chat)) {
      messageRow.add(
        new TextRenderable(renderer, {
          content: Icons.pin,
          fg: WhatsAppTheme.textTertiary,
        })
      )
    }

    // Add muted icon if chat is muted (check both top-level and _chat properties)
    const chatData = chat as ChatSummary & { isMuted?: boolean; _chat?: { isMuted?: boolean } }
    const isMuted = chatData.isMuted || chatData._chat?.isMuted
    if (isMuted) {
      messageRow.add(
        new TextRenderable(renderer, {
          content: Icons.muted,
          fg: WhatsAppTheme.textTertiary,
        })
      )
    }

    chatInfo.add(messageRow)

    chatRow.add(chatInfo)
    this.scrollBox.add(chatRow)

    // Store references
    this.chatRows.set(index, {
      box: chatRow,
      avatar,
      avatarText,
      nameText,
      timeText,
      chatInfo,
      messageRow,
      messageLeftGroup,
      ackText,
      messageText,
    })
  }

  // Update existing rows in-place
  private updateExistingRows(chats: ChatSummary[]) {
    // Only update structure hash if we are sure it matches, but here we assume it does based on Logic in buildChatList which should have verified it.
    // Actually, we need to correct Logic in buildChatList to check structure hash property.

    const state = appState.getState()

    for (let index = 0; index < chats.length; index++) {
      const chat = chats[index]
      const rowData = this.chatRows.get(index)

      if (!rowData) continue

      const isSelected = index === this.currentSelectedIndex
      const isCurrentChat = state.currentChatId === chat.id

      // Update Box Styles
      rowData.box.backgroundColor = isSelected
        ? WhatsAppTheme.selectedBg
        : isCurrentChat
          ? WhatsAppTheme.activeBg
          : WhatsAppTheme.panelDark

      // Prepare data
      const preview = extractMessagePreview(chat.lastMessage)
      const chatIdStr = getChatIdString(chat.id)
      const isSelf = isSelfChat(chatIdStr, state.myProfile?.id ?? null)
      const contactName = getContactName(chatIdStr, state.allContacts, chat.name || undefined)
      const displayName = isSelf ? `${contactName} (You)` : contactName
      let lastMessageText = preview.text
      if (isGroupChat(chatIdStr) && preview.text !== "No messages" && preview.isFromMe) {
        lastMessageText = `You: ${preview.text}`
      }

      // Update Text Content directly
      // 1. Avatar Initials

      rowData.avatarText.content = getInitials(contactName)
      rowData.avatarText.attributes = isSelected ? TextAttributes.BOLD : TextAttributes.NONE

      // 2. Name
      rowData.nameText.content = truncate(displayName, 50)
      rowData.nameText.attributes = isSelected ? TextAttributes.BOLD : TextAttributes.NONE

      // 3. Message Preview - check for typing status
      const isTyping = appState.isChatTyping(chatIdStr)
      rowData.messageText.content = isTyping ? "typing..." : truncate(lastMessageText, 50)
      rowData.messageText.fg = isTyping ? WhatsAppTheme.green : WhatsAppTheme.textSecondary

      // 4. Update Ack Status
      this.updateAckStatus(rowData, preview, this.renderer!)
    }
  }

  /**
   * Update selection and active (current chat) highlighting for all rows
   * This handles both selectedChatIndex and currentChatId changes
   */
  private updateSelectionAndActive(
    newSelectedIndex: number,
    currentChatId: string | null,
    chats: ChatSummary[]
  ): void {
    if (!this.scrollBox) return

    // Update all rows to reflect current selection and active state
    for (let index = 0; index < chats.length; index++) {
      const rowData = this.chatRows.get(index)
      if (!rowData) continue

      const chat = chats[index]
      const chatId = getChatIdString(chat.id)

      const isSelected = index === newSelectedIndex
      const isCurrentChat = currentChatId === chatId

      // Update background color
      rowData.box.backgroundColor = isSelected
        ? WhatsAppTheme.selectedBg
        : isCurrentChat
          ? WhatsAppTheme.activeBg
          : WhatsAppTheme.panelDark

      // Update text attributes
      rowData.avatarText.attributes = isSelected ? TextAttributes.BOLD : TextAttributes.NONE
      rowData.nameText.attributes = isSelected ? TextAttributes.BOLD : TextAttributes.NONE

      // Update typing status for message text
      const isTyping = appState.isChatTyping(chatId)
      const preview = extractMessagePreview(chat.lastMessage)
      if (isTyping) {
        rowData.messageText.content = "typing..."
        rowData.messageText.fg = WhatsAppTheme.green
      } else {
        // Always restore the message preview when not typing
        let lastMessageText = preview.text
        if (isGroupChat(chatId) && preview.text !== "No messages" && preview.isFromMe) {
          lastMessageText = `You: ${preview.text}`
        }
        rowData.messageText.content = truncate(lastMessageText, 50)
        rowData.messageText.fg = WhatsAppTheme.textSecondary
      }

      // Update ack status
      if (this.renderer) {
        this.updateAckStatus(rowData, preview, this.renderer)
      }
    }

    this.currentSelectedIndex = newSelectedIndex
  }

  /**
   * Update ack status text for a chat row
   * Creates/updates/removes ack text based on isFromMe and ack value
   */
  private updateAckStatus(
    rowData: ChatRowData,
    preview: MessagePreview,
    renderer: CliRenderer
  ): void {
    if (preview.isFromMe) {
      const ackContent = t`${formatAckStatus(preview.ack, { side: "right", disableSpace: true })}`
      if (rowData.ackText) {
        // Update existing ack text
        rowData.ackText.content = ackContent
      } else {
        // Create new ack text
        const ackText = new TextRenderable(renderer, {
          content: ackContent,
        })
        // Add to messageLeftGroup - we need to add at beginning
        // Since BoxRenderable doesn't have insertChild, we'll destroy message text,
        // add ack, then re-add message text
        rowData.messageText.destroy()
        rowData.messageLeftGroup.add(ackText)
        const newMessageText = new TextRenderable(renderer, {
          content: rowData.messageText.content,
          fg: rowData.messageText.fg,
        })
        rowData.messageLeftGroup.add(newMessageText)
        rowData.ackText = ackText
        rowData.messageText = newMessageText
      }
    } else {
      // Remove ack text if message is not from me
      if (rowData.ackText) {
        rowData.ackText.destroy()
        rowData.ackText = null
      }
    }
  }

  /**
   * Update selection highlight - only changes styles, doesn't rebuild
   */
  public updateSelection(newIndex: number): void {
    if (!this.scrollBox || this.currentSelectedIndex === newIndex) {
      return
    }

    debugLog("ChatListManager", `Updating selection: ${this.currentSelectedIndex} -> ${newIndex}`)

    const state = appState.getState()

    // Update old selected row (deselect)
    const oldRow = this.chatRows.get(this.currentSelectedIndex)
    if (oldRow) {
      const isCurrentChat = state.currentChatId === state.chats[this.currentSelectedIndex]?.id
      oldRow.box.backgroundColor = isCurrentChat ? WhatsAppTheme.activeBg : WhatsAppTheme.panelDark
      oldRow.avatarText.attributes = TextAttributes.NONE
      oldRow.nameText.attributes = TextAttributes.NONE
    }

    // Update new selected row (select)
    const newRow = this.chatRows.get(newIndex)
    if (newRow) {
      newRow.box.backgroundColor = WhatsAppTheme.selectedBg
      newRow.avatarText.attributes = TextAttributes.BOLD
      newRow.nameText.attributes = TextAttributes.BOLD
    }

    this.currentSelectedIndex = newIndex
  }

  /**
   * Update scroll position - only changes scrollTop, doesn't rebuild
   */
  public updateScroll(scrollOffset: number): void {
    if (!this.scrollBox) {
      return
    }

    // Skip if scroll offset hasn't changed
    if (scrollOffset === this.currentScrollOffset) {
      return
    }

    const scrollTop = scrollOffset * ROW_HEIGHT
    this.scrollBox.scrollTop = scrollTop
    this.currentScrollOffset = scrollOffset
    debugLog("ChatListManager", `Updated scroll: ${scrollTop}`)
  }

  /**
   * Get the cached ScrollBox
   */
  public getScrollBox(): ScrollBoxRenderable | null {
    return this.scrollBox
  }

  /**
   * Check if we have a valid cached list
   */
  public hasCachedList(): boolean {
    return this.scrollBox !== null && this.chatRows.size > 0
  }

  /**
   * Destroy all renderables and reset state
   */
  public destroy(): void {
    // debugLog("ChatListManager", "Destroying chat list manager")

    // Destroy all chat rows
    for (const [, row] of this.chatRows) {
      row.box.destroyRecursively()
    }
    this.chatRows.clear()

    // Destroy scroll box
    if (this.scrollBox) {
      this.scrollBox.destroyRecursively()
      this.scrollBox = null
    }

    this.currentSelectedIndex = -1
    this.currentScrollOffset = 0
    this.currentChatsHash = ""
    this.currentStructureHash = ""
    this.renderer = null
  }
}

export const chatListManager = ChatListManager.getInstance()
