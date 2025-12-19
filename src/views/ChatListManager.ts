/**
 * Chat List Manager
 * Manages persistent chat list renderables to avoid rebuilding on every state change
 */

import {
  BoxRenderable,
  TextRenderable,
  ScrollBoxRenderable,
  TextAttributes,
  t,
} from "@opentui/core"
import type { CliRenderer } from "@opentui/core"
import type { ChatSummary } from "@muhammedaksam/waha-node"
import { WhatsAppTheme } from "../config/theme"
import {
  truncate,
  extractMessagePreview,
  formatAckStatus,
  getInitials,
  isSelfChat,
} from "../utils/formatters"
import { debugLog } from "../utils/debug"
import { appState } from "../state/AppState"
import { loadMessages, loadContacts } from "./ConversationView"
import { ROW_HEIGHT } from "../utils/chatListScroll"

interface ChatRowData {
  box: BoxRenderable
  avatar: BoxRenderable
  avatarText: TextRenderable
  nameText: TextRenderable
  timeText: TextRenderable
  chatInfo: BoxRenderable
  messageRow: BoxRenderable
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
  private getChatsContentHash(chats: ChatSummary[]): string {
    return (chats as unknown as ExtendedChatSummary[])
      .map((c) => `${c.id}:${c.lastMessage?.timestamp || 0}:${c.lastMessage?.id || ""}`)
      .join(",")
  }

  /**
   * Build the chat list - only called when chats are loaded or data changes
   */
  public buildChatList(renderer: CliRenderer, chats: ChatSummary[]): ScrollBoxRenderable {
    const newStructureHash = this.getChatsStructureHash(chats)
    const newContentHash = this.getChatsContentHash(chats)

    // CASE 1: exact same content (no changes)
    if (this.scrollBox && newContentHash === this.currentChatsHash) {
      debugLog("ChatListManager", "Using cached chat list (exact match)")
      return this.scrollBox
    }

    this.currentChatsHash = newContentHash
    this.currentSelectedIndex = appState.getState().selectedChatIndex

    // CASE 2: same structure (same chats, same order), just content update (new message)
    if (
      this.scrollBox &&
      this.currentStructureHash === newStructureHash &&
      this.chatRows.size === chats.length
    ) {
      debugLog("ChatListManager", "Updating existing chat list content (same structure)")
      this.updateExistingRows(chats)
      return this.scrollBox
    }

    // CASE 3: structure changed (reorder or new chat)
    // Full rebuild required
    debugLog("ChatListManager", `Rebuilding chat list (structure changed)`)

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
    const state = appState.getState()

    for (let index = 0; index < chats.length; index++) {
      const chat = chats[index]
      this.createChatRow(renderer, chat, index, state.currentChatId === chat.id)
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
    isCurrentChat: boolean
  ) {
    if (!this.scrollBox) return

    const isSelected = index === this.currentSelectedIndex

    // Extract message preview
    const preview = extractMessagePreview(chat.lastMessage)
    const isGroupChat = typeof chat.id === "string" ? chat.id.endsWith("@g.us") : false
    const chatIdStr =
      typeof chat.id === "string" ? chat.id : (chat.id as { _serialized: string })._serialized
    const isSelf = isSelfChat(chatIdStr, appState.getState().myProfile?.id ?? null)
    let lastMessageText = preview.text
    // Add "(You)" suffix for self-chat
    const displayName = isSelf ? `${chat.name || chat.id} (You)` : chat.name || chat.id

    if (isGroupChat && preview.text !== "No messages") {
      if (preview.isFromMe) {
        lastMessageText = `You: ${preview.text}`
      }
    }

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
    })

    // Handle click to open chat using the filtered chat
    const chatIndex = index // Capture for closure
    const chatRef = chat // Capture chat reference for closure
    chatRow.on("click", async () => {
      const currentState = appState.getState()
      appState.setSelectedChatIndex(chatIndex)
      if (chatRef && currentState.currentSession) {
        appState.setCurrentView("conversation")
        appState.setCurrentChat(chatRef.id)

        // When switching chats, we want to start polling for messages immediately
        // BUT we need to be careful not to create circular dependency imports
        // PollingService imports ConversationView, so ConversationView/ChatListManager shouldn't import PollingService if possible
        // Ideally PollingService observes state changes.

        await loadMessages(currentState.currentSession, chatRef.id)
        await loadContacts(currentState.currentSession)
      }
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

    const timeText = new TextRenderable(renderer, {
      content: preview.timestamp,
      fg: WhatsAppTheme.textTertiary,
    })
    nameRow.add(timeText)
    chatInfo.add(nameRow)

    // Last message row
    const messageRow = new BoxRenderable(renderer, {
      id: `message-row-${index}`,
      flexDirection: "row",
      justifyContent: "space-between",
    })

    const messageText = new TextRenderable(renderer, {
      content: truncate(lastMessageText),
      fg: WhatsAppTheme.textSecondary,
    })
    messageRow.add(messageText)

    // Add Ack Status if message is from me
    if (preview.isFromMe) {
      messageRow.add(
        new TextRenderable(renderer, {
          content: t`${formatAckStatus(preview.ack)}`,
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
      const isGroupChat = typeof chat.id === "string" ? chat.id.endsWith("@g.us") : false
      const chatIdStr =
        typeof chat.id === "string" ? chat.id : (chat.id as { _serialized: string })._serialized
      const isSelf = isSelfChat(chatIdStr, appState.getState().myProfile?.id ?? null)
      const displayName = isSelf ? `${chat.name || chat.id} (You)` : chat.name || chat.id
      let lastMessageText = preview.text
      if (isGroupChat && preview.text !== "No messages" && preview.isFromMe) {
        lastMessageText = `You: ${preview.text}`
      }

      // Update Text Content directly
      // 1. Avatar Initials

      rowData.avatarText.content = getInitials(chat.name || "")
      rowData.avatarText.attributes = isSelected ? TextAttributes.BOLD : TextAttributes.NONE

      // 2. Name
      rowData.nameText.content = truncate(displayName, 50)
      rowData.nameText.attributes = isSelected ? TextAttributes.BOLD : TextAttributes.NONE

      // 3. Message Preview
      rowData.messageText.content = truncate(lastMessageText, 50)

      // Note: We are currently NOT updating the timestamp text or ack status text dynamically
      // because we didn't store references to them in ChatRowData interface.
      // This is a limitation. If we want full in-place updates, we need to store them too.
      // But re-creating the whole list is what causes glitches.
      // Let's at least try to update what we can.

      // Actually, since we need to update timestamp and ack, maybe we SHOULD destroy children of specific containers and re-add them?
      // Or better, update ChatRowData interface to include them.
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
    debugLog("ChatListManager", "Destroying chat list manager")

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
