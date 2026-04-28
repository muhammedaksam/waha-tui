/**
 * Chat Picker Dialog
 * Displays a searchable list of chats to select for forwarding messages.
 */

import type { ChatSummary } from "@muhammedaksam/waha-node"
import type { DialogId } from "@opentui-ui/dialog"
import type { RenderContext } from "@opentui/core"

import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  KeyEvent,
  TextAttributes,
  TextRenderable,
} from "@opentui/core"

import type { WAMessageExtended } from "~/types"
import { Icons, WhatsAppTheme } from "~/config/theme"
import { getDialogManager } from "~/router"
import { appState } from "~/state/AppState"
import { getRenderer } from "~/state/RendererContext"
import { debugLog } from "~/utils/debug"
import { filterChats } from "~/utils/filterChats"
import { getChatIdString, getInitials } from "~/utils/formatters"

/**
 * Show a chat picker dialog for forwarding a message.
 * Returns a promise that resolves to an array of selected chats,
 * or an empty array if cancelled.
 */
export function showChatPicker(_message: WAMessageExtended): Promise<ChatSummary[]> {
  const dialogManager = getDialogManager()
  const renderer = getRenderer()

  return new Promise((resolve) => {
    // eslint-disable-next-line prefer-const
    let dialogId: DialogId | undefined
    const state = appState.getState()
    const allChats = state.chats
    let filteredChats = filterChats(allChats, "all", "")

    // Internal state for the dialog
    const selectedChats = new Set<string>() // Set of chat IDs
    let selectedIndex = 0
    let searchQuery = ""

    // UI References we need to update imperatively
    let listContainer: BoxRenderable
    let footerText: TextRenderable
    const rowRenderables: BoxRenderable[] = []

    // Constants
    const PAGE_SIZE = 8

    // Close dialog and resolve
    const finish = (chats: ChatSummary[]) => {
      debugLog("ChatPickerDialog", `finish() called with ${chats.length} chats`)
      // Remove global key listener
      renderer.keyInput.off("keypress", handleKey)

      // Resolve first so that dialogManager.close's onClose handler (which resolves with []) is a no-op
      resolve(chats)

      if (dialogId !== undefined) {
        debugLog("ChatPickerDialog", `Closing dialog ${dialogId}`)
        dialogManager.close(dialogId)
      } else {
        debugLog("ChatPickerDialog", `Warning: dialogId is undefined in finish()`)
      }
    }

    // Refresh the list UI based on current state
    const updateListUI = () => {
      // Update filtered chats
      filteredChats = filterChats(allChats, "all", searchQuery)

      // Keep selectedIndex in bounds
      if (filteredChats.length === 0) {
        selectedIndex = 0
      } else if (selectedIndex >= filteredChats.length) {
        selectedIndex = filteredChats.length - 1
      }

      // Clear existing list
      const children = listContainer.getChildren()
      for (const child of children) {
        listContainer.remove(child.id)
      }
      rowRenderables.length = 0

      if (filteredChats.length === 0) {
        const emptyBox = new BoxRenderable(renderer, {
          height: PAGE_SIZE,
          justifyContent: "center",
          alignItems: "center",
        })
        emptyBox.add(
          new TextRenderable(renderer, {
            content: "No chats found",
            fg: WhatsAppTheme.textSecondary,
          })
        )
        listContainer.add(emptyBox)
      } else {
        // Calculate viewport
        let startIndex = Math.max(0, selectedIndex - Math.floor(PAGE_SIZE / 2))
        let endIndex = startIndex + PAGE_SIZE
        if (endIndex > filteredChats.length) {
          endIndex = filteredChats.length
          startIndex = Math.max(0, endIndex - PAGE_SIZE)
        }

        for (let i = startIndex; i < endIndex; i++) {
          const chat = filteredChats[i]
          const chatId = getChatIdString(chat.id)
          const isSelected = i === selectedIndex
          const isChecked = selectedChats.has(chatId)

          const rowBg = isSelected ? WhatsAppTheme.hoverBg : "transparent"

          const row = new BoxRenderable(renderer, {
            flexDirection: "row",
            height: 2,
            backgroundColor: rowBg,
            alignItems: "center",
            paddingLeft: 1,
            paddingRight: 1,
            onMouse(event) {
              if (event.type === "down" && event.button === 0) {
                selectedIndex = i
                if (selectedChats.has(chatId)) {
                  selectedChats.delete(chatId)
                } else {
                  selectedChats.add(chatId)
                }
                updateListUI()
                event.stopPropagation()
              }
            },
          })

          // Checkbox
          row.add(
            new TextRenderable(renderer, {
              content: isChecked ? `${Icons.checkDouble} ` : "  ",
              fg: isChecked ? WhatsAppTheme.green : WhatsAppTheme.textTertiary,
              width: 3,
            })
          )

          // Avatar
          const avatarName = chat.name || "Unknown"
          const initials = getInitials(avatarName, 2)
          const avatar = new BoxRenderable(renderer, {
            width: 4,
            height: 1,
            backgroundColor: WhatsAppTheme.green,
            alignItems: "center",
            justifyContent: "center",
          })
          avatar.add(
            new TextRenderable(renderer, {
              content: initials,
              fg: WhatsAppTheme.white,
            })
          )
          row.add(avatar)

          // Contact Name
          const nameBox = new BoxRenderable(renderer, { paddingLeft: 1 })
          nameBox.add(
            new TextRenderable(renderer, {
              content: avatarName.length > 25 ? avatarName.substring(0, 22) + "..." : avatarName,
              fg: WhatsAppTheme.textPrimary,
              attributes: TextAttributes.BOLD,
            })
          )
          row.add(nameBox)

          listContainer.add(row)
          rowRenderables.push(row)
        }

        // Add spacer if needed to keep height constant
        const renderedCount = endIndex - startIndex
        if (renderedCount < PAGE_SIZE) {
          listContainer.add(
            new BoxRenderable(renderer, {
              height: (PAGE_SIZE - renderedCount) * 2,
            })
          )
        }
      }

      // Update footer
      if (selectedChats.size > 0) {
        footerText.content = `${selectedChats.size} chat(s) selected`
        footerText.fg = WhatsAppTheme.green
      } else {
        footerText.content = "No chats selected"
        footerText.fg = WhatsAppTheme.textSecondary
      }

      renderer.root.requestRender()
    }

    // Global Key Handler for navigating the list
    const handleKey = (key: KeyEvent) => {
      if (filteredChats.length === 0) return

      if (key.name === "up") {
        selectedIndex = Math.max(0, selectedIndex - 1)
        updateListUI()
      } else if (key.name === "down") {
        selectedIndex = Math.min(filteredChats.length - 1, selectedIndex + 1)
        updateListUI()
      } else if (key.name === "space" || key.name === "tab") {
        // Toggle selection
        const chat = filteredChats[selectedIndex]
        if (chat) {
          const chatId = getChatIdString(chat.id)
          if (selectedChats.has(chatId)) {
            selectedChats.delete(chatId)
          } else {
            selectedChats.add(chatId)
          }
          updateListUI()
        }
      } else if (key.name === "return" || key.name === "enter") {
        const finalSelection = allChats.filter((c) => selectedChats.has(getChatIdString(c.id)))
        // If nothing is selected but enter is pressed on a chat, select it and forward
        if (selectedChats.size === 0 && filteredChats[selectedIndex]) {
          finish([filteredChats[selectedIndex]])
        } else {
          finish(finalSelection)
        }
      }
    }

    // Setup dialog
    dialogId = dialogManager.show({
      content: (ctx: RenderContext) => {
        const wrapper = new BoxRenderable(ctx, {
          flexDirection: "column",
          width: 50,
        })

        // Header
        wrapper.add(
          new TextRenderable(ctx, {
            content: "Forward message to",
            fg: WhatsAppTheme.textPrimary,
            attributes: TextAttributes.BOLD,
          })
        )
        wrapper.add(new BoxRenderable(ctx, { height: 1 }))

        // Search Input
        const searchInput = new InputRenderable(ctx, {
          id: "chat-picker-search",
          placeholder: "Search name or number",
          backgroundColor: WhatsAppTheme.inputBg,
          focusedBackgroundColor: WhatsAppTheme.inputBg,
          textColor: WhatsAppTheme.textPrimary,
          focusedTextColor: WhatsAppTheme.white,
          placeholderColor: WhatsAppTheme.textTertiary,
          cursorColor: WhatsAppTheme.white,
          width: 48,
        })

        searchInput.on(InputRenderableEvents.INPUT, (value: string) => {
          searchQuery = value
          updateListUI()
        })

        // Auto-focus search input
        setTimeout(() => searchInput.focus(), 50)

        const searchContainer = new BoxRenderable(ctx, {
          paddingBottom: 1,
        })
        searchContainer.add(searchInput)
        wrapper.add(searchContainer)

        // List Container
        wrapper.add(new BoxRenderable(ctx, { height: 1 }))
        listContainer = new BoxRenderable(ctx, {
          flexDirection: "column",
          height: PAGE_SIZE * 2,
        })
        wrapper.add(listContainer)

        // Footer
        wrapper.add(new BoxRenderable(ctx, { height: 1 }))
        const footerContainer = new BoxRenderable(ctx, {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 1,
        })

        footerText = new TextRenderable(ctx, {
          content: "No chats selected",
          fg: WhatsAppTheme.textSecondary,
        })
        footerContainer.add(footerText)

        // Send Button
        const sendBtn = new BoxRenderable(ctx, {
          backgroundColor: WhatsAppTheme.green,
          paddingLeft: 2,
          paddingRight: 2,
          height: 1,
          alignItems: "center",
          justifyContent: "center",
          onMouse(event) {
            if (event.type === "down" && event.button === 0) {
              debugLog(
                "ChatPickerDialog",
                `Send button clicked with ${selectedChats.size} selected chats`
              )
              const finalSelection = allChats.filter((c) =>
                selectedChats.has(getChatIdString(c.id))
              )
              // If nothing is selected but enter is clicked, we just close
              finish(finalSelection)
              event.stopPropagation()
            }
          },
        })
        sendBtn.add(
          new TextRenderable(ctx, {
            content: "Send",
            fg: WhatsAppTheme.white,
            attributes: TextAttributes.BOLD,
          })
        )
        footerContainer.add(sendBtn)
        wrapper.add(footerContainer)

        // Initial render
        updateListUI()

        // Attach global key listener
        renderer.keyInput.on("keypress", handleKey)

        return wrapper
      },
      size: "large",
      onClose: () => {
        renderer.keyInput.off("keypress", handleKey)
        resolve([])
      },
    })
  })
}
