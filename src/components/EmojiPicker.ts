/**
 * Emoji Picker Component
 * Dialog-based emoji picker for reactions and message input.
 */

import type { KeyEvent, RenderContext } from "@opentui/core"
import type { ButtonState } from "@tuiparts/core/button"

import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  ScrollBoxRenderable,
  TextAttributes,
  TextRenderable,
} from "@opentui/core"
import { ButtonRenderable } from "@tuiparts/core/button"

import { createInput } from "~/components/Input"
import { createTabs, createTabsList, createTabsTab } from "~/components/Tabs"
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

let focusTimeout: ReturnType<typeof setTimeout> | null = null
let currentSearchInput: InputRenderable | null = null

function safeResolve(value: string | null) {
  if (focusTimeout) {
    clearTimeout(focusTimeout)
    focusTimeout = null
  }
  if (currentSearchInput) {
    try {
      if (currentSearchInput.focused) {
        currentSearchInput.blur()
      }
    } catch {
      // ignore
    }
    currentSearchInput = null
  }
  appState.setInputMode(false)
  appState.setEmojiPicker(null)
  if (resolveEmojiPromise) {
    const cb = resolveEmojiPromise
    resolveEmojiPromise = null
    cb(value)
  }
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

  const searchInput = createInput(renderer, {
    value: "",
    placeholder: "Search emoji...",
    width: "100%",
  })
  currentSearchInput = searchInput

  pickerBox.add(searchInput)
  pickerBox.add(new BoxRenderable(renderer, { height: 1 }))

  const tabsRoot = createTabs(renderer, {
    value: activeCategoryState ?? "Recent",
    onValueChange: (value) => {
      activeCategoryState = value
      const offset = categoryOffsets.get(value)
      if (offset !== undefined) {
        gridContainer.scrollTop = offset
      }
      renderer.root.requestRender()
    },
  })
  const categoriesRow = createTabsList(renderer, tabsRoot, {
    width: "100%",
    height: 1,
  })
  tabsRoot.add(categoriesRow)
  pickerBox.add(tabsRoot)
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
      gridContainer.remove(child)
    }

    const tabChildren = categoriesRow.getChildren()
    for (const child of tabChildren) {
      categoriesRow.remove(child)
      child.destroy()
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

      // Build tabs using tuiparts Tabs recipe
      for (const cat of categoriesToRender) {
        const tab = createTabsTab(renderer, tabsRoot, {
          label: cat.icon,
          value: cat.name,
          paddingX: 1,
        })
        categoriesRow.add(tab)
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
      const selected = displayEmojis[selectedIndex] || displayEmojis[0] || null
      safeResolve(selected)
    }
  })

  searchInput.on("key", (key: KeyEvent) => {
    if (key.name === "escape") {
      safeResolve(null)
    }
  })

  rebuildGrid()
  anchor.add(pickerBox)

  if (focusTimeout) {
    clearTimeout(focusTimeout)
  }
  focusTimeout = setTimeout(() => {
    try {
      if (!searchInput.isDestroyed) {
        searchInput.focus()
      }
    } catch {
      // ignore
    }
  }, 50)

  return anchor
}

/**
 * Emoji Cell Renderable using tuiparts ButtonRenderable
 */
class EmojiCellRenderable extends ButtonRenderable {
  constructor(ctx: RenderContext, emoji: string, onSelect: () => void) {
    super(ctx, {
      width: 3,
      height: 1,
      justifyContent: "center",
      alignItems: "center",
      onPress: () => onSelect(),
    })
    this.add(new TextRenderable(ctx, { content: emoji }))
    const apply = (state: ButtonState) => {
      this.backgroundColor = state.pressed || state.focused ? WhatsAppTheme.hoverBg : "transparent"
    }
    apply(this.getState())
    this.subscribe(apply)
  }
}

/**
 * Create an emoji cell for the grid (clickable)
 */
function createEmojiCell(
  ctx: RenderContext,
  emoji: string,
  onSelect: () => void
): EmojiCellRenderable {
  return new EmojiCellRenderable(ctx, emoji, onSelect)
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
        const cell = new EmojiCellRenderable(ctx, emoji, () => {
          onSelect(emoji)
          dialogManager.close(dialogId)
        })
        rowBox.add(cell)
      }

      wrapper.add(rowBox)
      return wrapper
    },
    onClose: () => onSelect(null),
  })
}
