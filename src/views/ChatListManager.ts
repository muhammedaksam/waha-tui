/**
 * Chat List Manager
 * Manages persistent chat list renderables to avoid rebuilding on every state change
 */

import { BoxRenderable, TextRenderable, ScrollBoxRenderable, TextAttributes } from "@opentui/core"
import type { CliRenderer } from "@opentui/core"
import type { ChatSummary } from "@muhammedaksam/waha-node"
import { WhatsAppTheme, Icons } from "../config/theme"
import { truncate, extractMessagePreview } from "../utils/formatters"
import { debugLog } from "../utils/debug"
import { appState } from "../state/AppState"
import { loadMessages, loadContacts } from "./ConversationView"
import { ROW_HEIGHT } from "../utils/chatListScroll"

interface ChatRowData {
  box: BoxRenderable
  avatar: BoxRenderable
  avatarText: TextRenderable
  nameText: TextRenderable
  messageText: TextRenderable
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
  private getChatsHash(chats: ChatSummary[]): string {
    // Simple hash based on chat IDs
    return chats.map((c) => c.id).join(",")
  }

  /**
   * Build the chat list - only called when chats are loaded or data changes
   */
  public buildChatList(renderer: CliRenderer, chats: ChatSummary[]): ScrollBoxRenderable {
    const newHash = this.getChatsHash(chats)

    // If same chats, just return existing scrollbox
    if (this.scrollBox && newHash === this.currentChatsHash) {
      debugLog("ChatListManager", "Using cached chat list (same chats)")
      return this.scrollBox
    }

    debugLog("ChatListManager", `Building new chat list with ${chats.length} chats`)

    // Destroy old renderables if they exist
    this.destroy()

    this.renderer = renderer
    this.currentChatsHash = newHash
    this.currentSelectedIndex = appState.getState().selectedChatIndex

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
      const isSelected = index === this.currentSelectedIndex
      const isCurrentChat = state.currentChatId === chat.id

      // Extract message preview
      const preview = extractMessagePreview(chat.lastMessage)
      const isGroupChat = typeof chat.id === "string" ? chat.id.endsWith("@g.us") : false
      let lastMessageText = preview.text

      if (isGroupChat && preview.text !== "No messages") {
        if (preview.isFromMe) {
          lastMessageText = `You: ${preview.text}`
        }
      }

      // Create chat row box
      const chatRow = new BoxRenderable(renderer, {
        id: `chat-row-${index}`,
        height: 4,
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
        border: isCurrentChat,
        borderColor: isCurrentChat ? WhatsAppTheme.green : undefined,
      })

      // Handle click to open chat
      const chatIndex = index // Capture for closure
      chatRow.on("click", async () => {
        const currentState = appState.getState()
        appState.setSelectedChatIndex(chatIndex)
        const selectedChat = currentState.chats[chatIndex]
        if (selectedChat && currentState.currentSession) {
          appState.setCurrentView("conversation")
          appState.setCurrentChat(selectedChat.id)
          await loadMessages(currentState.currentSession, selectedChat.id)
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
      })
      // Get initials from up to 3 words
      const getInitials = (name: string): string => {
        if (!name) return Icons.online
        const words = name.trim().split(/\s+/)
        return words
          .slice(0, 3)
          .map((word) => word.charAt(0).toUpperCase())
          .join("")
      }

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
        content: truncate(chat.name || chat.id, 25),
        fg: WhatsAppTheme.white,
        attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
      })
      nameRow.add(nameText)

      nameRow.add(
        new TextRenderable(renderer, {
          content: preview.timestamp,
          fg: WhatsAppTheme.textTertiary,
        })
      )
      chatInfo.add(nameRow)

      // Last message row
      const messageRow = new BoxRenderable(renderer, {
        id: `message-row-${index}`,
        flexDirection: "row",
        justifyContent: "space-between",
      })

      const messageText = new TextRenderable(renderer, {
        content: truncate(lastMessageText, 30),
        fg: WhatsAppTheme.textSecondary,
      })
      messageRow.add(messageText)

      messageRow.add(
        new TextRenderable(renderer, {
          content: preview.isFromMe ? Icons.checkDouble : "",
          fg: WhatsAppTheme.blue,
        })
      )
      chatInfo.add(messageRow)

      chatRow.add(chatInfo)
      this.scrollBox.add(chatRow)

      // Store references for later updates
      this.chatRows.set(index, {
        box: chatRow,
        avatar,
        avatarText,
        nameText,
        messageText,
      })
    }

    // Apply initial scroll position
    const scrollOffset = state.chatListScrollOffset
    if (scrollOffset > 0) {
      const scrollTop = scrollOffset * ROW_HEIGHT
      setTimeout(() => {
        if (this.scrollBox) {
          this.scrollBox.scrollTop = scrollTop
          debugLog("ChatListManager", `Applied initial scroll: ${scrollTop}`)
        }
      }, 0)
    }

    // NOTE: We do NOT call scrollBox.focus() because:
    // 1. The focused ScrollBox handles arrow keys internally and scrolls
    // 2. We want to control scrolling ourselves via calculateChatListScrollOffset
    // 3. Having both causes double-scrolling issues

    return this.scrollBox
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
    this.renderer = null
  }
}

export const chatListManager = ChatListManager.getInstance()
