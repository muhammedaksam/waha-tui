/**
 * Badge Component
 * Built on tuiparts badge recipe contract with WhatsApp design tokens
 */

import type { BoxOptions, RenderContext, TextOptions } from "@opentui/core"

import { Box, BoxRenderable, Text, TextAttributes, TextRenderable } from "@opentui/core"

import { WDSColors, WhatsAppTheme } from "~/config/theme"

export type BadgeIntent = "danger" | "neutral" | "success" | "warning"
export type BadgeSize = "compact" | "comfortable"

export interface BadgeOptions extends BoxOptions {
  intent?: BadgeIntent
  label: string
  labelOptions?: Omit<TextOptions, "content">
  size?: BadgeSize
}

function getPalette(intent: BadgeIntent = "neutral") {
  switch (intent) {
    case "danger":
      return { background: WDSColors.red[500], foreground: WhatsAppTheme.white }
    case "success":
      return { background: WhatsAppTheme.green, foreground: WhatsAppTheme.white }
    case "warning":
      return { background: WDSColors.yellow[400], foreground: WhatsAppTheme.deepDark }
    case "neutral":
    default:
      return { background: WhatsAppTheme.panelLight, foreground: WhatsAppTheme.textSecondary }
  }
}

export class BadgeRecipeRenderable extends BoxRenderable {
  constructor(ctx: RenderContext, options: BadgeOptions) {
    const { intent = "neutral", label, labelOptions, size = "compact", ...rootOptions } = options
    const palette = getPalette(intent)

    super(ctx, {
      paddingLeft: size === "comfortable" ? 2 : 1,
      paddingRight: size === "comfortable" ? 2 : 1,
      height: 1,
      backgroundColor: rootOptions.backgroundColor ?? palette.background,
      justifyContent: "center",
      alignItems: "center",
      ...rootOptions,
    })

    const text = new TextRenderable(ctx, {
      content: label,
      fg: labelOptions?.fg ?? palette.foreground,
      attributes: TextAttributes.BOLD,
      ...labelOptions,
    })
    this.add(text)
  }
}

/** Consumer-owned imperative recipe composed from OpenTUI Renderables. */
export function createBadge(ctx: RenderContext, options: BadgeOptions): BoxRenderable {
  return new BadgeRecipeRenderable(ctx, options)
}

/** Declarative VNode Badge component. */
export function Badge(options: BadgeOptions) {
  const { intent = "neutral", label, size = "compact", ...rootOptions } = options
  const palette = getPalette(intent)

  return Box(
    {
      paddingLeft: size === "comfortable" ? 2 : 1,
      paddingRight: size === "comfortable" ? 2 : 1,
      height: 1,
      backgroundColor: rootOptions.backgroundColor ?? palette.background,
      justifyContent: "center",
      alignItems: "center",
      ...rootOptions,
    },
    Text({
      content: label,
      fg: palette.foreground,
      attributes: TextAttributes.BOLD,
    })
  )
}
