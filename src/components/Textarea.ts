/**
 * Textarea Component
 * Built on @tuiparts/core/textarea primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type { TextareaOptions as BaseTextareaOptions } from "@tuiparts/core/textarea"

import { TextareaRenderable } from "@tuiparts/core/textarea"

import { WhatsAppTheme } from "~/config/theme"

export type TextareaOptions = BaseTextareaOptions

export class TextareaRecipeRenderable extends TextareaRenderable {
  constructor(ctx: RenderContext, options: TextareaOptions = {}) {
    super(ctx, {
      backgroundColor: options.backgroundColor ?? WhatsAppTheme.inputBg,
      focusedBackgroundColor: options.focusedBackgroundColor ?? WhatsAppTheme.inputBg,
      textColor: options.textColor ?? WhatsAppTheme.textPrimary,
      focusedTextColor: options.focusedTextColor ?? WhatsAppTheme.white,
      placeholderColor: options.placeholderColor ?? WhatsAppTheme.textTertiary,
      cursorColor: options.cursorColor ?? WhatsAppTheme.green,
      height: options.height ?? 5,
      wrapMode: options.wrapMode ?? "word",
      ...options,
    })
  }
}

/** Creates the consumer-owned imperative Textarea Recipe. */
export function createTextarea(
  ctx: RenderContext,
  options: TextareaOptions = {}
): TextareaRenderable {
  return new TextareaRecipeRenderable(ctx, options)
}
