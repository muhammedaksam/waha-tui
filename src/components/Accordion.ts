/**
 * Accordion Component
 * Built on @tuiparts/core/accordion primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type {
  AccordionItemOptions,
  AccordionPanelOptions,
  AccordionTriggerOptions,
  AccordionTriggerState,
  AccordionRootOptions as PrimitiveAccordionRootOptions,
} from "@tuiparts/core/accordion"

import { TextRenderable } from "@opentui/core"
import {
  AccordionItemRenderable,
  AccordionPanelRenderable,
  AccordionRootRenderable,
  AccordionTriggerRenderable,
} from "@tuiparts/core/accordion"

import { WhatsAppTheme } from "~/config/theme"

/** Options for the consumer-owned imperative Accordion Root. */
export type AccordionOptions = Omit<PrimitiveAccordionRootOptions, "store">

/** Options for one consumer-owned imperative Accordion Item. */
export type AccordionItemRecipeOptions = Omit<AccordionItemOptions, "store">

/** Options for one labeled imperative Accordion Trigger. */
export interface AccordionTriggerRecipeOptions extends Omit<AccordionTriggerOptions, "item"> {
  /** Marker shown while closed. */
  closedMark?: string
  /** Trigger label. */
  label: string
  /** Marker shown while open. */
  openMark?: string
}

/** Options for one imperative Accordion content region. */
export type AccordionContentOptions = Omit<AccordionPanelOptions, "item">

class RecipeTriggerRenderable extends AccordionTriggerRenderable {
  private readonly unsubscribeState: () => void

  constructor(
    ctx: RenderContext,
    options: AccordionTriggerRecipeOptions & {
      item: AccordionItemRenderable
    }
  ) {
    const { closedMark = "›", label: content, openMark = "⌄", ...trigger } = options
    super(ctx, { flexDirection: "row", gap: 1, ...trigger })
    const mark = new TextRenderable(ctx, { content: closedMark })
    const label = new TextRenderable(ctx, { content })
    this.add(mark)
    this.add(label)

    const apply = (state: AccordionTriggerState) => {
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

class RecipePanelRenderable extends AccordionPanelRenderable {
  constructor(
    ctx: RenderContext,
    options: AccordionContentOptions & { item: AccordionItemRenderable }
  ) {
    super(ctx, {
      paddingLeft: options.paddingLeft ?? 2,
      ...options,
    })
  }
}

/** Creates the imperative Accordion ownership boundary. */
export function createAccordion(
  ctx: RenderContext,
  options: AccordionOptions = {}
): AccordionRootRenderable {
  return new AccordionRootRenderable(ctx, {
    flexDirection: "column",
    ...options,
  })
}

/** Creates one imperative Accordion Item. */
export function createAccordionItem(
  ctx: RenderContext,
  root: AccordionRootRenderable,
  options: AccordionItemRecipeOptions
): AccordionItemRenderable {
  return new AccordionItemRenderable(ctx, {
    flexDirection: "column",
    gap: 1,
    ...options,
    store: root.store,
  })
}

/** Creates one labeled imperative Accordion Trigger. */
export function createAccordionTrigger(
  ctx: RenderContext,
  item: AccordionItemRenderable,
  options: AccordionTriggerRecipeOptions
): AccordionTriggerRenderable {
  return new RecipeTriggerRenderable(ctx, { ...options, item })
}

/** Creates one imperative Accordion content region. */
export function createAccordionContent(
  ctx: RenderContext,
  item: AccordionItemRenderable,
  options: AccordionContentOptions = {}
): AccordionPanelRenderable {
  return new RecipePanelRenderable(ctx, { ...options, item })
}
