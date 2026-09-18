/**
 * Toggle Component
 * Built on @tuiparts/core/toggle primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type { ToggleChangeDetails, ToggleState } from "@tuiparts/core/toggle"

import { TextRenderable } from "@opentui/core"
import { ToggleRenderable } from "@tuiparts/core/toggle"

import { WhatsAppTheme } from "~/config/theme"

export interface ToggleOptions {
  defaultPressed?: boolean
  disabled?: boolean
  label: string
  onPressedChange?: (pressed: boolean, details: ToggleChangeDetails) => void
  pressed?: boolean
}

export class ToggleRecipeRenderable extends ToggleRenderable {
  private readonly unsubscribeRecipe: () => void

  constructor(ctx: RenderContext, options: ToggleOptions) {
    super(ctx, {
      defaultPressed: options.defaultPressed,
      disabled: options.disabled,
      onPressedChange: options.onPressedChange,
      pressed: options.pressed,
      height: 1,
      paddingLeft: 1,
      paddingRight: 1,
    })

    const label = new TextRenderable(ctx, { content: options.label })
    this.add(label)

    const applyStyle = (state: ToggleState) => {
      this.backgroundColor = state.pressed
        ? WhatsAppTheme.green
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

/** Consumer-owned imperative Toggle recipe. */
export function createToggle(ctx: RenderContext, options: ToggleOptions): ToggleRenderable {
  return new ToggleRecipeRenderable(ctx, options)
}
