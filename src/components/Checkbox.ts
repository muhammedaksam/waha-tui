/**
 * Checkbox Component
 * Built on @tuiparts/core/checkbox primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type { CheckboxChangeDetails } from "@tuiparts/core/checkbox"

import { BoxRenderable, TextRenderable } from "@opentui/core"
import { CheckboxIndicatorRenderable, CheckboxRootRenderable } from "@tuiparts/core/checkbox"

import { WhatsAppTheme } from "~/config/theme"

export interface CheckboxOptions {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  label?: string
  /** Mark glyph; defaults to "✓" */
  mark?: string
  onCheckedChange?: (checked: boolean, details: CheckboxChangeDetails) => void
  width?: number | "auto" | `${number}%`
}

export class CheckboxRecipeRenderable extends CheckboxRootRenderable {
  constructor(ctx: RenderContext, options: CheckboxOptions) {
    super(ctx, {
      backgroundColor: "transparent",
      checked: options.checked,
      defaultChecked: options.defaultChecked,
      disabled: options.disabled,
      flexDirection: "row",
      alignItems: "center",
      gap: 1,
      width: options.width,
      onCheckedChange: options.onCheckedChange,
    })

    const markBox = new BoxRenderable(ctx, {
      width: 3,
      height: 1,
      position: "relative",
    })

    const brackets = new TextRenderable(ctx, {
      content: "[ ]",
      fg: options.disabled ? WhatsAppTheme.textTertiary : WhatsAppTheme.textSecondary,
    })
    markBox.add(brackets)

    const indicator = new CheckboxIndicatorRenderable(ctx, {
      store: this.store,
      position: "absolute",
      left: 1,
      top: 0,
      width: 1,
      height: 1,
    })

    const checkText = new TextRenderable(ctx, {
      content: options.mark ?? "✓",
      fg: options.disabled ? WhatsAppTheme.textTertiary : WhatsAppTheme.green,
    })
    indicator.add(checkText)
    markBox.add(indicator)
    this.add(markBox)

    if (options.label) {
      const label = new TextRenderable(ctx, {
        content: options.label,
        fg: options.disabled ? WhatsAppTheme.textTertiary : WhatsAppTheme.textPrimary,
      })
      this.add(label)
    }
  }
}

/** Consumer-owned imperative recipe using packaged Checkbox behavior. */
export function createCheckbox(
  ctx: RenderContext,
  options: CheckboxOptions
): CheckboxRecipeRenderable {
  return new CheckboxRecipeRenderable(ctx, options)
}
