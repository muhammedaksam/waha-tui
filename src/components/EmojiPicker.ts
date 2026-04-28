/**
 * Emoji Picker Component
 * Dialog-based emoji picker for reactions and message input.
 */

import type { RenderContext } from "@opentui/core"

import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  ScrollBoxRenderable,
  TextAttributes,
  TextRenderable,
} from "@opentui/core"

import { WhatsAppTheme } from "~/config/theme"
import { EMOJI_CATEGORIES, getEmojiVariants, searchEmojis } from "~/data/emojis"
import { getDialogManager } from "~/router"
import { appState } from "~/state/AppState"
import { getRenderer } from "~/state/RendererContext"

/** Number of emojis per row in the grid */
const GRID_COLS = 8

let resolveEmojiPromise: ((emoji: string | null) => void) | null = null
let activeCategoryState: string | null = "Recent"

/**
 * Show the emoji picker overlay.
 * Returns the selected emoji string, or null if cancelled.
 */
export function showEmojiPicker(pos?: {
  x: number
  y: number
  bubbleWidth?: number
  bubbleHeight?: number
}): Promise<string | null> {
  // Set input mode synchronously to prevent keyboard handler interference
  appState.setInputMode(true)

  return new Promise((resolve) => {
    resolveEmojiPromise = resolve
    appState.setEmojiPicker({ visible: true, position: pos })
  })
}

function safeResolve(value: string | null) {
  if (resolveEmojiPromise) {
    resolveEmojiPromise(value)
    resolveEmojiPromise = null
  }
  appState.setInputMode(false)
  appState.setEmojiPicker(null)
}

export function EmojiPicker(): BoxRenderable | null {
  const state = appState.getState()
  if (!state.emojiPicker?.visible) return null

  const pos = state.emojiPicker.position || { x: 10, y: 5 }
  const renderer = getRenderer()

  const pickerWidth = 32
  const pickerHeight = 15

  let leftPosition = pos.x
  let topPosition = pos.y

  // Positioning logic similar to ContextMenu
  if (pos.bubbleWidth) {
    const bubbleX = pos.x
    const bubbleY = pos.y
    const bubbleHeight = pos.bubbleHeight || 3
    leftPosition = bubbleX + 1

    const anchorY = bubbleY + 1
    if (anchorY + pickerHeight > renderer.height - 2) {
      topPosition = Math.max(2, bubbleY + bubbleHeight - pickerHeight)
    } else {
      topPosition = Math.max(2, anchorY)
    }
  }

  // Final bounds check to ensure the picker stays on screen
  if (leftPosition + pickerWidth > renderer.width - 2) {
    leftPosition = Math.max(2, renderer.width - pickerWidth - 2)
  }
  if (topPosition + pickerHeight > renderer.height - 2) {
    topPosition = Math.max(2, renderer.height - pickerHeight - 2)
  }

  const anchor = new BoxRenderable(renderer, {
    position: "absolute",
    top: 0,
    left: 0,
    width: renderer.width,
    height: renderer.height,
    zIndex: 100,
    onMouse(event) {
      if (event.type === "down" && event.button === 0) {
        safeResolve(null)
        event.stopPropagation()
      }
    },
  })

  const pickerBox = new BoxRenderable(renderer, {
    position: "absolute",
    top: topPosition,
    left: leftPosition,
    width: pickerWidth,
    height: pickerHeight,
    backgroundColor: WhatsAppTheme.panelDark,
    border: true,
    borderColor: WhatsAppTheme.borderLight,
    flexDirection: "column",
    onMouse(event) {
      event.stopPropagation()
    },
  })

  let selectedIndex = 0
  let searchQuery = ""
  let displayEmojis: string[] = getAllDisplayEmojis()

  const searchInput = new InputRenderable(renderer, {
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

  pickerBox.add(searchInput)
  pickerBox.add(new BoxRenderable(renderer, { height: 1 }))

  const categoriesRow = new BoxRenderable(renderer, {
    flexDirection: "row",
    width: "100%",
    height: 1,
  })
  pickerBox.add(categoriesRow)
  pickerBox.add(new BoxRenderable(renderer, { height: 1 }))

  const gridContainer = new ScrollBoxRenderable(renderer, {
    id: "emoji-grid-scroll",
    flexGrow: 1,
    contentOptions: {
      flexDirection: "column",
    },
  })
  pickerBox.add(gridContainer)

  const categoryOffsets = new Map<string, number>()

  function rebuildGrid() {
    // Clear grid
    const children = gridContainer.getChildren()
    for (const child of children) {
      gridContainer.remove(child.id)
    }

    const tabChildren = categoriesRow.getChildren()
    for (const child of tabChildren) {
      categoriesRow.remove(child.id)
    }

    categoryOffsets.clear()
    let currentLine = 0

    if (displayEmojis.length === 0) {
      const noResultsBox = new BoxRenderable(renderer, { height: 1 })
      noResultsBox.add(
        new TextRenderable(renderer, {
          content: "No emojis found",
          fg: WhatsAppTheme.textTertiary,
        })
      )
      gridContainer.add(noResultsBox)
      return
    }

    const handleEmojiSelect = (emoji: string) => {
      const variants = getEmojiVariants(emoji)
      if (variants && variants.length > 0) {
        showVariantsModal(emoji, variants, (selectedEmoji) => {
          if (selectedEmoji) {
            safeResolve(selectedEmoji)
          }
        })
      } else {
        safeResolve(emoji)
      }
    }

    if (searchQuery.trim()) {
      const gridRows = chunkArray(displayEmojis, GRID_COLS)
      for (const row of gridRows) {
        const rowBox = new BoxRenderable(renderer, { flexDirection: "row", height: 1 })
        for (const emoji of row) {
          rowBox.add(createEmojiCell(renderer, emoji, () => handleEmojiSelect(emoji)))
        }
        gridContainer.add(rowBox)
      }
    } else {
      const recentEmojis = appState.getState().recentEmojis || []
      const categoriesToRender = []

      if (recentEmojis.length > 0) {
        categoriesToRender.push({ name: "Recent", icon: "🕒", emojis: recentEmojis })
      }
      categoriesToRender.push(...EMOJI_CATEGORIES)

      for (const category of categoriesToRender) {
        categoryOffsets.set(category.name, currentLine)

        const headerBox = new BoxRenderable(renderer, { height: 1 })
        headerBox.add(
          new TextRenderable(renderer, {
            content: `${category.icon} ${category.name}`,
            fg: WhatsAppTheme.textTertiary,
            attributes: TextAttributes.BOLD,
          })
        )
        gridContainer.add(headerBox)
        currentLine++

        const gridRows = chunkArray(category.emojis, GRID_COLS)
        for (const row of gridRows) {
          const rowBox = new BoxRenderable(renderer, { flexDirection: "row", height: 1 })
          for (const emoji of row) {
            rowBox.add(createEmojiCell(renderer, emoji, () => handleEmojiSelect(emoji)))
          }
          gridContainer.add(rowBox)
          currentLine++
        }
      }

      // Build tabs
      for (const cat of categoriesToRender) {
        const isActive = activeCategoryState === cat.name
        const tabBox = new BoxRenderable(renderer, {
          height: 1,
          width: 3,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isActive ? WhatsAppTheme.panelLight : "transparent",
          onMouse(event) {
            if (event.type === "down" && event.button === 0) {
              activeCategoryState = cat.name
              const offset = categoryOffsets.get(cat.name)
              if (offset !== undefined) {
                gridContainer.scrollTop = offset
              }
              // Force rebuild grid to update active highlight
              rebuildGrid()
              event.stopPropagation()
            }
          },
        })
        tabBox.add(new TextRenderable(renderer, { content: cat.icon }))
        categoriesRow.add(tabBox)
      }
    }
  }

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
    if (displayEmojis.length > 0) {
      safeResolve(displayEmojis[selectedIndex] || displayEmojis[0])
    }
  })

  rebuildGrid()
  anchor.add(pickerBox)

  setTimeout(() => {
    searchInput.focus()
  }, 50)

  return anchor
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

/**
 * Show a modal to select a skin tone variant for a base emoji
 */
function showVariantsModal(
  baseEmoji: string,
  variants: string[],
  onSelect: (emoji: string | null) => void
) {
  const dialogManager = getDialogManager()

  // The options are the base emoji plus all its variants
  const options = [baseEmoji, ...variants]

  const dialogId = dialogManager.show({
    content: (ctx) => {
      const wrapper = new BoxRenderable(ctx, {
        flexDirection: "column",
        width: 30, // Needs to fit 6 emojis (6 * 3 = 18 + padding)
        padding: 1,
      })

      wrapper.add(
        new TextRenderable(ctx, {
          content: "Select Skin Tone",
          fg: WhatsAppTheme.textPrimary,
          attributes: TextAttributes.BOLD,
        })
      )

      wrapper.add(new BoxRenderable(ctx, { height: 1 }))

      const rowBox = new BoxRenderable(ctx, {
        flexDirection: "row",
        height: 1,
      })

      for (const emoji of options) {
        const cell = new BoxRenderable(ctx, {
          width: 3,
          height: 1,
          justifyContent: "center",
          alignItems: "center",
          onMouse(event) {
            if (event.type === "down" && event.button === 0) {
              onSelect(emoji)
              dialogManager.close(dialogId)
              event.stopPropagation()
            }
          },
        })
        cell.add(new TextRenderable(ctx, { content: emoji }))
        rowBox.add(cell)
      }

      wrapper.add(rowBox)
      return wrapper
    },
    onClose: () => onSelect(null),
  })
}
