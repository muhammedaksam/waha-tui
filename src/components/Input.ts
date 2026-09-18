/**
 * Input Component
 * Built on @tuiparts/core/input primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type { InputOptions as BaseInputOptions } from "@tuiparts/core/input"

import { InputRenderable } from "@tuiparts/core/input"

import { WhatsAppTheme } from "~/config/theme"

export type InputOptions = BaseInputOptions

export class InputRecipeRenderable extends InputRenderable {
  constructor(ctx: RenderContext, options: InputOptions = {}) {
    super(ctx, {
      backgroundColor: options.backgroundColor ?? WhatsAppTheme.inputBg,
      focusedBackgroundColor: options.focusedBackgroundColor ?? WhatsAppTheme.inputBg,
      textColor: options.textColor ?? WhatsAppTheme.textPrimary,
      focusedTextColor: options.focusedTextColor ?? WhatsAppTheme.white,
      placeholderColor: options.placeholderColor ?? WhatsAppTheme.textTertiary,
      cursorColor: options.cursorColor ?? WhatsAppTheme.white,
      ...options,
    })
  }
}

/** Consumer-owned imperative Input recipe with WhatsApp visual defaults. */
export function createInput(ctx: RenderContext, options: InputOptions = {}): InputRenderable {
  return new InputRecipeRenderable(ctx, options)
}
