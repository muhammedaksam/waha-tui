/**
 * NumberField Component
 * Built on @tuiparts/core/number-field primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type { NumberFieldRootOptions } from "@tuiparts/core/number-field"

import { BoxRenderable, TextRenderable } from "@opentui/core"
import {
  NumberFieldDecrementRenderable,
  NumberFieldIncrementRenderable,
  NumberFieldInputRenderable,
  NumberFieldRootRenderable,
  NumberFieldScrubAreaRenderable,
} from "@tuiparts/core/number-field"

import { WhatsAppTheme } from "~/config/theme"

/** Options for the consumer-owned imperative NumberField Recipe. */
export interface NumberFieldOptions extends Omit<NumberFieldRootOptions, "store"> {
  /** Label shown in the draggable ScrubArea. */
  label: string
  /** Decrement glyph. */
  decrementMark?: string
  /** Increment glyph. */
  incrementMark?: string
}

class NumberFieldRecipeRenderable extends NumberFieldRootRenderable {
  private readonly unsubscribeState: () => void

  constructor(ctx: RenderContext, options: NumberFieldOptions) {
    const { decrementMark = "−", incrementMark = "+", label, ...rootOptions } = options
    super(ctx, { ...rootOptions, flexDirection: "column", gap: 1 })

    const scrub = new NumberFieldScrubAreaRenderable(ctx, {
      store: this.store,
    })
    const labelText = new TextRenderable(ctx, { content: label })
    scrub.add(labelText)

    const group = new BoxRenderable(ctx, { flexDirection: "row" })
    const decrement = new NumberFieldDecrementRenderable(ctx, {
      alignItems: "center",
      store: this.store,
      width: 3,
    })
    const decrementText = new TextRenderable(ctx, { content: decrementMark })
    decrement.add(decrementText)

    const input = new NumberFieldInputRenderable(ctx, {
      store: this.store,
      width: 8,
    })

    const increment = new NumberFieldIncrementRenderable(ctx, {
      alignItems: "center",
      store: this.store,
      width: 3,
    })
    const incrementText = new TextRenderable(ctx, { content: incrementMark })
    increment.add(incrementText)

    group.add(decrement)
    group.add(input)
    group.add(increment)
    this.add(scrub)
    this.add(group)

    const apply = () => {
      const state = this.getState()
      const color = state.disabled ? WhatsAppTheme.textTertiary : WhatsAppTheme.textPrimary
      labelText.fg = state.scrubbing ? WhatsAppTheme.blue : color
      decrementText.fg = color
      incrementText.fg = color
      input.textColor = color
    }
    apply()
    this.unsubscribeState = this.store.subscribe(() => apply())
  }

  override endCoordinationLifetime(): void {
    this.unsubscribeState()
    super.endCoordinationLifetime()
  }
}

/** Creates a complete imperative NumberField Recipe. */
export function createNumberField(
  ctx: RenderContext,
  options: NumberFieldOptions
): NumberFieldRootRenderable {
  return new NumberFieldRecipeRenderable(ctx, options)
}
