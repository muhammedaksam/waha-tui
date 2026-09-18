/**
 * CheckboxGroup Component
 * Built on @tuiparts/core/checkbox-group primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type { CheckboxState } from "@tuiparts/core/checkbox"
import type {
  CheckboxGroupStore,
  CheckboxGroupOptions as PrimitiveCheckboxGroupOptions,
} from "@tuiparts/core/checkbox-group"

import { BoxRenderable, TextRenderable } from "@opentui/core"
import { CheckboxIndicatorRenderable, CheckboxRootRenderable } from "@tuiparts/core/checkbox"
import { CheckboxGroupRenderable } from "@tuiparts/core/checkbox-group"

import { WhatsAppTheme } from "~/config/theme"

export type CheckboxGroupOptions = Omit<PrimitiveCheckboxGroupOptions, "store">

export interface CheckboxGroupItemOptions {
  disabled?: boolean
  label: string
  mark?: string
  value: string
}

class CheckboxGroupItemRecipeRenderable extends CheckboxRootRenderable {
  private readonly unsubscribeState: () => void

  constructor(ctx: RenderContext, store: CheckboxGroupStore, options: CheckboxGroupItemOptions) {
    super(ctx, {
      backgroundColor: "transparent",
      disabled: options.disabled,
      flexDirection: "row",
      gap: 1,
      group: store,
      value: options.value,
    })

    const markCell = new BoxRenderable(ctx, { width: 3, height: 1, position: "relative" })
    const brackets = new TextRenderable(ctx, { content: "[ ]", fg: WhatsAppTheme.textSecondary })
    markCell.add(brackets)

    const indicator = new CheckboxIndicatorRenderable(ctx, {
      store: this.store,
      position: "absolute",
      left: 1,
      top: 0,
      width: 1,
      height: 1,
    })
    const mark = new TextRenderable(ctx, {
      content: options.mark ?? "✓",
      fg: WhatsAppTheme.green,
    })
    indicator.add(mark)
    markCell.add(indicator)
    this.add(markCell)

    const label = new TextRenderable(ctx, { content: options.label })
    this.add(label)

    const apply = (state: CheckboxState) => {
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

/** Creates the imperative CheckboxGroup ownership boundary. */
export function createCheckboxGroup(
  ctx: RenderContext,
  options: CheckboxGroupOptions = {}
): CheckboxGroupRenderable {
  return new CheckboxGroupRenderable(ctx, {
    ...options,
    flexDirection: options.orientation === "horizontal" ? "row" : "column",
    gap: options.gap ?? 1,
  })
}

/** Creates one grouped Checkbox using packaged Checkbox behavior. */
export function createCheckboxGroupItem(
  ctx: RenderContext,
  store: CheckboxGroupStore,
  options: CheckboxGroupItemOptions
): CheckboxRootRenderable {
  return new CheckboxGroupItemRecipeRenderable(ctx, store, options)
}
