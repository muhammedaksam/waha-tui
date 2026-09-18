/**
 * Tabs Component
 * Built on @tuiparts/core/tabs primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type {
  TabsRootOptions as PrimitiveTabsRootOptions,
  TabsListOptions,
  TabsPanelOptions,
  TabsTabOptions,
  TabsTabState,
} from "@tuiparts/core/tabs"

import { TextRenderable } from "@opentui/core"
import {
  TabsListRenderable,
  TabsPanelRenderable,
  TabsRootRenderable,
  TabsTabRenderable,
} from "@tuiparts/core/tabs"

import { WhatsAppTheme } from "~/config/theme"

/** Options for the consumer-owned imperative Tabs Root. */
export type TabsOptions = Omit<PrimitiveTabsRootOptions, "store">

/** Options for one labeled imperative Tab Recipe Part. */
export interface TabsTabRecipeOptions extends Omit<TabsTabOptions, "store"> {
  label: string
}

class RecipeTabRenderable extends TabsTabRenderable {
  private readonly unsubscribeState: () => void

  constructor(
    ctx: RenderContext,
    options: TabsTabRecipeOptions & { store: TabsRootRenderable["store"] }
  ) {
    const { label: content, ...tabOptions } = options
    super(ctx, {
      ...tabOptions,
      paddingX: tabOptions.paddingX ?? 1,
    })
    const label = new TextRenderable(ctx, { content })
    this.add(label)

    const apply = (state: TabsTabState) => {
      this.backgroundColor = state.selected
        ? WhatsAppTheme.panelLight
        : state.focused
          ? WhatsAppTheme.hoverBg
          : "transparent"
      label.fg = state.disabled
        ? WhatsAppTheme.textTertiary
        : state.selected
          ? WhatsAppTheme.white
          : WhatsAppTheme.textPrimary
    }

    apply(this.getState())
    this.unsubscribeState = this.subscribe((state) => apply(state))
  }

  override destroy(): void {
    this.unsubscribeState()
    super.destroy()
  }
}

/** Creates the imperative Tabs ownership boundary. */
export function createTabs(ctx: RenderContext, options: TabsOptions = {}): TabsRootRenderable {
  const orientation = options.orientation ?? "horizontal"
  return new TabsRootRenderable(ctx, {
    ...options,
    flexDirection: options.flexDirection ?? (orientation === "vertical" ? "row" : "column"),
    gap: options.gap ?? 1,
  })
}

/** Creates the imperative Tabs List layout. */
export function createTabsList(
  ctx: RenderContext,
  root: TabsRootRenderable,
  options: Omit<TabsListOptions, "store"> = {}
): TabsListRenderable {
  return new TabsListRenderable(ctx, {
    ...options,
    flexDirection: options.flexDirection ?? (root.orientation === "vertical" ? "column" : "row"),
    gap: options.gap ?? 1,
    store: root.store,
  })
}

/** Creates one labeled imperative Tab. */
export function createTabsTab(
  ctx: RenderContext,
  root: TabsRootRenderable,
  options: TabsTabRecipeOptions
): TabsTabRenderable {
  return new RecipeTabRenderable(ctx, { ...options, store: root.store })
}

/** Creates one imperative Tabs Panel without choosing its content. */
export function createTabsPanel(
  ctx: RenderContext,
  root: TabsRootRenderable,
  options: Omit<TabsPanelOptions, "store">
): TabsPanelRenderable {
  return new TabsPanelRenderable(ctx, { ...options, store: root.store })
}
