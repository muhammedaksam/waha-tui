/**
 * Collapsible Component
 * Built on @tuiparts/core/collapsible primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type {
  CollapsiblePanelOptions,
  CollapsibleTriggerOptions,
  CollapsibleTriggerState,
  CollapsibleRootOptions as PrimitiveCollapsibleRootOptions,
} from "@tuiparts/core/collapsible"

import { TextRenderable } from "@opentui/core"
import {
  CollapsiblePanelRenderable,
  CollapsibleRootRenderable,
  CollapsibleTriggerRenderable,
} from "@tuiparts/core/collapsible"

import { WhatsAppTheme } from "~/config/theme"

/** Options for the consumer-owned imperative Collapsible Root. */
export type CollapsibleOptions = Omit<PrimitiveCollapsibleRootOptions, "store">

/** Options for one labeled imperative Collapsible Trigger. */
export interface CollapsibleTriggerRecipeOptions extends Omit<CollapsibleTriggerOptions, "store"> {
  /** Marker shown while closed. */
  closedMark?: string
  /** Trigger label. */
  label: string
  /** Marker shown while open. */
  openMark?: string
}

/** Options for one imperative Collapsible content region. */
export type CollapsibleContentOptions = Omit<CollapsiblePanelOptions, "store">

class RecipeTriggerRenderable extends CollapsibleTriggerRenderable {
  private readonly unsubscribeState: () => void

  constructor(
    ctx: RenderContext,
    options: CollapsibleTriggerRecipeOptions & {
      store: CollapsibleRootRenderable["store"]
    }
  ) {
    const { closedMark = "›", label: content, openMark = "⌄", ...trigger } = options
    super(ctx, {
      flexDirection: "row",
      gap: 1,
      ...trigger,
    })
    const mark = new TextRenderable(ctx, { content: closedMark })
    const label = new TextRenderable(ctx, { content })
    this.add(mark)
    this.add(label)

    const apply = (state: CollapsibleTriggerState) => {
      mark.content = state.open ? openMark : closedMark
      mark.fg = state.focused ? WhatsAppTheme.blue : WhatsAppTheme.green
      label.fg = state.disabled
        ? WhatsAppTheme.textTertiary
        : state.focused
          ? WhatsAppTheme.white
          : WhatsAppTheme.textPrimary
    }
    apply(this.getState())
    this.unsubscribeState = this.subscribe((state) => apply(state))
  }

  override endCoordinationLifetime(): void {
    this.unsubscribeState()
    super.endCoordinationLifetime()
  }
}

class RecipePanelRenderable extends CollapsiblePanelRenderable {
  constructor(
    ctx: RenderContext,
    options: CollapsibleContentOptions & {
      store: CollapsibleRootRenderable["store"]
    }
  ) {
    super(ctx, {
      paddingLeft: options.paddingLeft ?? 2,
      ...options,
    })
  }
}

/** Creates the imperative Collapsible ownership boundary. */
export function createCollapsible(
  ctx: RenderContext,
  options: CollapsibleOptions = {}
): CollapsibleRootRenderable {
  return new CollapsibleRootRenderable(ctx, {
    flexDirection: "column",
    gap: 1,
    ...options,
  })
}

/** Creates one labeled imperative Collapsible Trigger. */
export function createCollapsibleTrigger(
  ctx: RenderContext,
  root: CollapsibleRootRenderable,
  options: CollapsibleTriggerRecipeOptions
): CollapsibleTriggerRenderable {
  return new RecipeTriggerRenderable(ctx, { ...options, store: root.store })
}

/** Creates one imperative Collapsible content region. */
export function createCollapsibleContent(
  ctx: RenderContext,
  root: CollapsibleRootRenderable,
  options: CollapsibleContentOptions = {}
): CollapsiblePanelRenderable {
  return new RecipePanelRenderable(ctx, { ...options, store: root.store })
}
