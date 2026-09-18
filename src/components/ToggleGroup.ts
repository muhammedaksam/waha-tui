/**
 * ToggleGroup Component
 * Built on @tuiparts/core/toggle-group primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type { ToggleState } from "@tuiparts/core/toggle"
import type {
  ToggleGroupOptions as PrimitiveToggleGroupOptions,
  ToggleGroupStore,
} from "@tuiparts/core/toggle-group"

import { TextRenderable } from "@opentui/core"
import { ToggleRenderable } from "@tuiparts/core/toggle"
import { ToggleGroupRenderable } from "@tuiparts/core/toggle-group"

import { WhatsAppTheme } from "~/config/theme"

export type ToggleGroupOptions = Omit<PrimitiveToggleGroupOptions, "store">

export interface ToggleGroupItemOptions {
  disabled?: boolean
  label: string
  value: string
}

class ToggleGroupItemRecipeRenderable extends ToggleRenderable {
  private readonly unsubscribeRecipe: () => void

  constructor(ctx: RenderContext, store: ToggleGroupStore, options: ToggleGroupItemOptions) {
    super(ctx, {
      disabled: options.disabled,
      group: store,
      height: 1,
      paddingLeft: 1,
      paddingRight: 1,
      value: options.value,
    })

    const label = new TextRenderable(ctx, { content: options.label })
    this.add(label)

    const applyStyle = (state: ToggleState) => {
      this.backgroundColor = state.pressed
        ? WhatsAppTheme.panelLight
        : state.focused
          ? WhatsAppTheme.hoverBg
          : "transparent"
      label.fg = state.disabled
        ? WhatsAppTheme.textTertiary
        : state.pressed
          ? WhatsAppTheme.white
          : WhatsAppTheme.textPrimary
    }

    applyStyle(this.getState())
    this.unsubscribeRecipe = this.subscribe((state) => applyStyle(state))
  }

  override destroy(): void {
    this.unsubscribeRecipe()
    super.destroy()
  }
}

/** Consumer-owned imperative ToggleGroup layout. */
export function createToggleGroup(
  ctx: RenderContext,
  options: ToggleGroupOptions = {}
): ToggleGroupRenderable {
  return new ToggleGroupRenderable(ctx, {
    ...options,
    flexDirection: options.orientation === "vertical" ? "column" : "row",
    gap: options.gap ?? 1,
  })
}

/** Consumer-owned imperative ToggleGroup item presentation. */
export function createToggleGroupItem(
  ctx: RenderContext,
  store: ToggleGroupStore,
  options: ToggleGroupItemOptions
): ToggleRenderable {
  return new ToggleGroupItemRecipeRenderable(ctx, store, options)
}
