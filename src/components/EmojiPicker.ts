/**
 * Emoji Picker Component
 * Dialog-based emoji picker for reactions and message input.
 */

import type { RenderContext } from "@opentui/core"

import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  TextAttributes,
  TextRenderable,
} from "@opentui/core"

import { WhatsAppTheme } from "~/config/theme"
import { EMOJI_CATEGORIES, QUICK_REACTIONS, searchEmojis } from "~/data/emojis"
import { getDialogManager } from "~/router"
import { appState } from "~/state/AppState"

/** Number of emojis per row in the grid */
const GRID_COLS = 8

/**
 * Show the emoji picker dialog.
 * Returns the selected emoji string, or null if cancelled.
 */
export function showEmojiPicker(): Promise<string | null> {
  const dialogManager = getDialogManager()
  let resolved = false
  let selectedIndex = 0
  let searchQuery = ""
  let displayEmojis: string[] = getAllDisplayEmojis()

  // Set input mode synchronously to prevent keyboard handler interference
  appState.setInputMode(true)

  return new Promise((resolve) => {
    const safeResolve = (value: string | null) => {
      if (resolved) return
      resolved = true
      appState.setInputMode(false)
      resolve(value)
    }

    const dialogId = dialogManager.show({
      content: (ctx: RenderContext) => {
        const wrapper = new BoxRenderable(ctx, {
          flexDirection: "column",
          width: "100%",
        })

        // Title
        wrapper.add(
          new TextRenderable(ctx, {
            content: "Pick an Emoji",
            fg: WhatsAppTheme.textPrimary,
            attributes: TextAttributes.BOLD,
          })
        )

        wrapper.add(new BoxRenderable(ctx, { height: 1 }))

        // Search input
        const searchInput = new InputRenderable(ctx, {
          value: "",
          placeholder: "Search emoji...",
          width: "100%",
          backgroundColor: WhatsAppTheme.inputBg,
          focusedBackgroundColor: WhatsAppTheme.inputBg,
          textColor: WhatsAppTheme.textPrimary,
          focusedTextColor: WhatsAppTheme.white,
          placeholderColor: WhatsAppTheme.textTertiary,
          cursorColor: WhatsAppTheme.white,
        })

        searchInput.on(InputRenderableEvents.INPUT, (val: string) => {
          searchQuery = val
          if (searchQuery.trim()) {
            displayEmojis = searchEmojis(searchQuery)
          } else {
            displayEmojis = getAllDisplayEmojis()
          }
          selectedIndex = 0
          rebuildGrid()
        })

        searchInput.on(InputRenderableEvents.ENTER, () => {
          // If searching with results, select the first emoji
          if (displayEmojis.length > 0) {
            safeResolve(displayEmojis[selectedIndex] || displayEmojis[0])
            dialogManager.close(dialogId)
          }
        })

        wrapper.add(searchInput)
        wrapper.add(new BoxRenderable(ctx, { height: 1 }))

        // Quick reactions row
        const quickLabel = new TextRenderable(ctx, {
          content: "Quick Reactions",
          fg: WhatsAppTheme.textTertiary,
        })
        wrapper.add(quickLabel)

        const quickRow = new BoxRenderable(ctx, {
          flexDirection: "row",
          gap: 1,
          height: 1,
        })

        for (const emoji of QUICK_REACTIONS) {
          const emojiBtn = new BoxRenderable(ctx, {
            paddingLeft: 1,
            paddingRight: 1,
            height: 1,
            backgroundColor: WhatsAppTheme.panelLight,
            justifyContent: "center",
            alignItems: "center",
            onMouse(event) {
              if (event.type === "down" && event.button === 0) {
                safeResolve(emoji)
                dialogManager.close(dialogId)
                event.stopPropagation()
              }
            },
          })
          emojiBtn.add(new TextRenderable(ctx, { content: emoji }))
          quickRow.add(emojiBtn)
        }

        wrapper.add(quickRow)
        wrapper.add(new BoxRenderable(ctx, { height: 1 }))

        // Emoji grid container (rebuilt on search)
        const gridContainer = new BoxRenderable(ctx, {
          flexDirection: "column",
          flexGrow: 1,
          maxHeight: 12,
          overflow: "hidden",
        })

        function rebuildGrid() {
          // Clear grid
          const children = gridContainer.getChildren()
          for (const child of children) {
            gridContainer.remove(child.id)
          }

          if (displayEmojis.length === 0) {
            gridContainer.add(
              new TextRenderable(ctx, {
                content: "No emojis found",
                fg: WhatsAppTheme.textTertiary,
              })
            )
            return
          }

          // Build rows from flat emoji list
          if (searchQuery.trim()) {
            // Search results: flat grid, no category headers
            const gridRows = chunkArray(displayEmojis, GRID_COLS)
            for (const row of gridRows) {
              const rowBox = new BoxRenderable(ctx, {
                flexDirection: "row",
                height: 1,
              })
              for (const emoji of row) {
                const cell = createEmojiCell(ctx, emoji, () => {
                  safeResolve(emoji)
                  dialogManager.close(dialogId)
                })
                rowBox.add(cell)
              }
              gridContainer.add(rowBox)
            }
          } else {
            // Categorized view
            for (const category of EMOJI_CATEGORIES) {
              // Category header
              gridContainer.add(
                new TextRenderable(ctx, {
                  content: `${category.icon} ${category.name}`,
                  fg: WhatsAppTheme.textTertiary,
                  attributes: TextAttributes.BOLD,
                })
              )

              const gridRows = chunkArray(category.emojis, GRID_COLS)
              for (const row of gridRows) {
                const rowBox = new BoxRenderable(ctx, {
                  flexDirection: "row",
                  height: 1,
                })
                for (const emoji of row) {
                  const cell = createEmojiCell(ctx, emoji, () => {
                    safeResolve(emoji)
                    dialogManager.close(dialogId)
                  })
                  rowBox.add(cell)
                }
                gridContainer.add(rowBox)
              }
            }
          }
        }

        rebuildGrid()
        wrapper.add(gridContainer)

        wrapper.add(new BoxRenderable(ctx, { height: 1 }))

        // Cancel button row
        const buttonRow = new BoxRenderable(ctx, {
          flexDirection: "row",
          justifyContent: "flex-end",
        })

        const cancelBtn = new BoxRenderable(ctx, {
          paddingLeft: 2,
          paddingRight: 2,
          height: 1,
          backgroundColor: "transparent",
          justifyContent: "center",
          alignItems: "center",
          onMouse(event) {
            if (event.type === "down" && event.button === 0) {
              safeResolve(null)
              dialogManager.close(dialogId)
              event.stopPropagation()
            }
          },
        })
        cancelBtn.add(
          new TextRenderable(ctx, {
            content: "Cancel",
            fg: WhatsAppTheme.textPrimary,
          })
        )
        buttonRow.add(cancelBtn)

        wrapper.add(buttonRow)

        // Auto focus search input
        setTimeout(() => {
          searchInput.focus()
        }, 50)

        return wrapper
      },
      size: "large",
      onClose: () => {
        safeResolve(null)
      },
    })
  })
}

/**
 * Create an emoji cell for the grid (clickable)
 */
function createEmojiCell(ctx: RenderContext, emoji: string, onSelect: () => void): BoxRenderable {
  const cell = new BoxRenderable(ctx, {
    width: 3,
    height: 1,
    justifyContent: "center",
    alignItems: "center",
    onMouse(event) {
      if (event.type === "down" && event.button === 0) {
        onSelect()
        event.stopPropagation()
      }
    },
  })
  cell.add(new TextRenderable(ctx, { content: emoji }))
  return cell
}

/**
 * Get all emojis in display order (no search filter)
 */
function getAllDisplayEmojis(): string[] {
  return EMOJI_CATEGORIES.flatMap((c) => c.emojis)
}

/**
 * Split an array into chunks of given size
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
