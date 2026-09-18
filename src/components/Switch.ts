/**
 * Switch Component
 * Built on @tuiparts/core/switch primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"

import { Box, BoxRenderable, Text, TextRenderable } from "@opentui/core"
import { SwitchRootRenderable, SwitchThumbRenderable } from "@tuiparts/core/switch"

import { WhatsAppTheme } from "~/config/theme"

export interface SwitchOptions {
  checked?: boolean
  defaultChecked?: boolean
  density?: "compact" | "comfortable"
  disabled?: boolean
  label?: string
  onCheckedChange?: (checked: boolean) => void
  symbols?: "round" | "ascii"
}

export interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  density?: "compact" | "comfortable"
  disabled?: boolean
  label?: string
  onCheckedChange?: (checked: boolean) => void
  symbols?: "round" | "ascii"
}

export const SWITCH_SYMBOLS = {
  round: { thumb: "●", track: "─" },
  ascii: { thumb: "*", track: "-" },
} as const

/**
 * Switch Recipe Renderable
 * Implements the tuiparts switch recipe with WhatsApp styling
 */
export class SwitchRecipeRenderable extends SwitchRootRenderable {
  private readonly unsubscribeRecipe: () => void

  constructor(ctx: RenderContext, options: SwitchOptions) {
    const density = options.density ?? "compact"
    const trackWidth = density === "comfortable" ? 5 : 3
    const symbols = SWITCH_SYMBOLS[options.symbols ?? "round"]

    super(ctx, {
      backgroundColor: "transparent",
      checked: options.checked,
      defaultChecked: options.defaultChecked,
      disabled: options.disabled,
      flexDirection: "row",
      gap: density === "comfortable" ? 2 : 1,
      onCheckedChange: options.onCheckedChange,
    })

    const track = new BoxRenderable(ctx, {
      backgroundColor: "transparent",
      height: 1,
      position: "relative",
      width: trackWidth,
    })

    const trackText = new TextRenderable(ctx, {
      content: symbols.track.repeat(trackWidth),
      fg: WhatsAppTheme.borderLight,
    })
    track.add(trackText)

    const isChecked = this.getState().checked
    const thumb = new SwitchThumbRenderable(ctx, {
      height: 1,
      left: isChecked ? trackWidth - 1 : 0,
      position: "absolute",
      store: this.store,
      width: 1,
    })

    const thumbText = new TextRenderable(ctx, {
      content: symbols.thumb,
      fg: isChecked ? WhatsAppTheme.green : WhatsAppTheme.textTertiary,
    })
    thumb.add(thumbText)
    track.add(thumb)
    this.add(track)

    if (options.label) {
      const label = new TextRenderable(ctx, {
        content: options.label,
        fg: options.disabled ? WhatsAppTheme.textTertiary : WhatsAppTheme.textPrimary,
      })
      this.add(label)
    }

    this.unsubscribeRecipe = this.subscribe((state) => {
      thumb.left = state.checked ? trackWidth - 1 : 0
      thumbText.fg = state.checked ? WhatsAppTheme.green : WhatsAppTheme.textTertiary
    })
  }

  override destroy(): void {
    this.unsubscribeRecipe()
    super.destroy()
  }
}

/**
 * Consumer-owned imperative recipe using packaged Switch behavior.
 */
export function createSwitch(ctx: RenderContext, options: SwitchOptions): SwitchRootRenderable {
  return new SwitchRecipeRenderable(ctx, options)
}

/**
 * Toggle switch component - WhatsApp style declarative VNode using tuiparts structure
 */
export function ToggleSwitch(props: boolean | SwitchProps) {
  const options: SwitchProps = typeof props === "boolean" ? { checked: props } : props
  const checked = options.checked ?? options.defaultChecked ?? false
  const density = options.density ?? "compact"
  const trackWidth = density === "comfortable" ? 5 : 3
  const symbols = SWITCH_SYMBOLS[options.symbols ?? "round"]

  const trackContent = symbols.track.repeat(trackWidth)

  return Box(
    {
      width: trackWidth,
      height: 1,
      position: "relative",
      backgroundColor: "transparent",
    },
    // Track line
    Text({
      content: trackContent,
      fg: WhatsAppTheme.borderLight,
    }),
    // Movable thumb indicator
    Box(
      {
        position: "absolute",
        left: checked ? trackWidth - 1 : 0,
        top: 0,
        width: 1,
        height: 1,
      },
      Text({
        content: symbols.thumb,
        fg: checked ? WhatsAppTheme.green : WhatsAppTheme.textTertiary,
      })
    )
  )
}
