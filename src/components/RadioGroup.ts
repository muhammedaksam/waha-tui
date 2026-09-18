/**
 * RadioGroup Component
 * Built on @tuiparts/core/radio-group and @tuiparts/core/radio primitives following tuiparts recipe contract
 */

import type { BoxOptions, RenderContext } from "@opentui/core"
import type { RadioState } from "@tuiparts/core/radio"
import type { RadioGroupStore, RadioGroupStoreOptions } from "@tuiparts/core/radio-group"

import { BoxRenderable, TextRenderable } from "@opentui/core"
import { RadioIndicatorRenderable, RadioRootRenderable } from "@tuiparts/core/radio"
import { RadioGroupRenderable } from "@tuiparts/core/radio-group"

import { WhatsAppTheme } from "~/config/theme"

export interface RadioGroupOptions extends RadioGroupStoreOptions {
  gap?: BoxOptions["gap"]
  orientation?: "horizontal" | "vertical"
}

export interface RadioGroupItemOptions {
  disabled?: boolean
  label: string
  mark?: string
  value: string
}

class RadioGroupItemRecipeRenderable extends RadioRootRenderable {
  private readonly unsubscribeState: () => void

  constructor(ctx: RenderContext, store: RadioGroupStore, options: RadioGroupItemOptions) {
    super(ctx, {
      store,
      value: options.value,
      disabled: options.disabled,
      backgroundColor: "transparent",
      flexDirection: "row",
      gap: 1,
    })

    const markCell = new BoxRenderable(ctx, { width: 3, height: 1, position: "relative" })
    const circle = new TextRenderable(ctx, { content: "( )", fg: WhatsAppTheme.textSecondary })
    markCell.add(circle)

    const indicator = new RadioIndicatorRenderable(ctx, {
      radio: this,
      position: "absolute",
      left: 1,
      top: 0,
      width: 1,
      height: 1,
    })
    const mark = new TextRenderable(ctx, {
      content: options.mark ?? "●",
      fg: WhatsAppTheme.green,
    })
    indicator.add(mark)
    markCell.add(indicator)
    this.add(markCell)

    const label = new TextRenderable(ctx, { content: options.label })
    this.add(label)

    const apply = (state: RadioState) => {
      label.fg = state.disabled
        ? WhatsAppTheme.textTertiary
        : state.focused
          ? WhatsAppTheme.white
          : WhatsAppTheme.textPrimary
      circle.fg = state.focused ? WhatsAppTheme.white : WhatsAppTheme.textSecondary
    }

    apply(this.getState())
    this.unsubscribeState = this.subscribe((state) => apply(state))
  }

  override destroy(): void {
    this.unsubscribeState()
    super.destroy()
  }
}

/** Consumer-owned imperative RadioGroup layout. */
export function createRadioGroup(
  ctx: RenderContext,
  options: RadioGroupOptions = {}
): RadioGroupRenderable {
  const { gap = 0, orientation = "vertical", ...storeOptions } = options
  return new RadioGroupRenderable(ctx, {
    ...storeOptions,
    backgroundColor: "transparent",
    flexDirection: orientation === "horizontal" ? "row" : "column",
    gap,
  })
}

/** Consumer-owned imperative RadioGroup item presentation. */
export function createRadioGroupItem(
  ctx: RenderContext,
  store: RadioGroupStore,
  options: RadioGroupItemOptions
): RadioRootRenderable {
  return new RadioGroupItemRecipeRenderable(ctx, store, options)
}
