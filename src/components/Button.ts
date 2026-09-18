/**
 * Button Component
 * Built on @tuiparts/core/button primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type { ButtonPressDetails, ButtonState } from "@tuiparts/core/button"

import { TextAttributes, TextRenderable } from "@opentui/core"
import { ButtonRenderable } from "@tuiparts/core/button"

import { WDSColors, WhatsAppTheme } from "~/config/theme"

export type ButtonVariant = "primary" | "secondary" | "danger"

export interface ButtonOptions {
  disabled?: boolean
  variant?: ButtonVariant
  label: string
  onPress?: (details: ButtonPressDetails) => void
  paddingX?: number
  paddingY?: number
  marginLeft?: number
  marginRight?: number
  marginTop?: number
  marginBottom?: number
  id?: string
}

export class ButtonRecipeRenderable extends ButtonRenderable {
  private readonly unsubscribeRecipe: () => void

  constructor(ctx: RenderContext, options: ButtonOptions) {
    const variant = options.variant ?? "primary"
    super(ctx, {
      disabled: options.disabled,
      onPress: options.onPress,
      paddingX: options.paddingX ?? 2,
      paddingY: options.paddingY ?? 0,
      height: 1,
      marginLeft: options.marginLeft,
      marginRight: options.marginRight,
      marginTop: options.marginTop,
      marginBottom: options.marginBottom,
      id: options.id,
      justifyContent: "center",
      alignItems: "center",
    })

    const label = new TextRenderable(ctx, {
      content: options.label,
      attributes: variant === "primary" ? TextAttributes.BOLD : undefined,
    })
    this.add(label)

    const applyStyle = (state: ButtonState) => {
      if (state.disabled) {
        this.backgroundColor = WhatsAppTheme.panelDark
        label.fg = WhatsAppTheme.textTertiary
        return
      }

      switch (variant) {
        case "danger":
          this.backgroundColor = state.pressed
            ? WDSColors.red[600]
            : state.focused
              ? WDSColors.red[400]
              : WDSColors.red[500]
          label.fg = WhatsAppTheme.white
          break
        case "primary":
          this.backgroundColor = state.pressed
            ? WhatsAppTheme.hoverBg
            : state.focused
              ? WDSColors.green[400]
              : WhatsAppTheme.green
          label.fg = WhatsAppTheme.white
          break
        case "secondary":
        default:
          this.backgroundColor =
            state.pressed || state.focused ? WhatsAppTheme.hoverBg : "transparent"
          label.fg = WhatsAppTheme.textPrimary
          break
      }
    }

    applyStyle(this.getState())
    this.unsubscribeRecipe = this.subscribe((state) => applyStyle(state))
  }

  override destroy(): void {
    this.unsubscribeRecipe()
    super.destroy()
  }
}

/** Consumer-owned imperative Button recipe using packaged Button behavior. */
export function createButton(ctx: RenderContext, options: ButtonOptions): ButtonRecipeRenderable {
  return new ButtonRecipeRenderable(ctx, options)
}
