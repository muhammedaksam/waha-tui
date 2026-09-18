/**
 * UI Utilities for Dialog and Toast components
 */

import type { BorderConfig, BorderStyle } from "@opentui/core"

export type { BorderConfig, BorderStyle }

export interface PaddingInput {
  padding?: number
  paddingX?: number
  paddingY?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
}

export interface Padding {
  top: number
  right: number
  bottom: number
  left: number
}

export function mergeStyles<T extends object>(...styles: (Partial<T> | undefined)[]): T {
  const result = {} as T
  for (const style of styles) {
    if (!style) continue
    Object.assign(result, style)
  }
  return result
}

export function resolvePadding(
  style?: PaddingInput,
  defaults: Padding = { top: 0, right: 0, bottom: 0, left: 0 }
): Padding {
  if (!style) {
    return { ...defaults }
  }

  const uniform = style.padding
  const axisX = style.paddingX
  const axisY = style.paddingY

  return {
    top: style.paddingTop ?? axisY ?? uniform ?? defaults.top,
    right: style.paddingRight ?? axisX ?? uniform ?? defaults.right,
    bottom: style.paddingBottom ?? axisY ?? uniform ?? defaults.bottom,
    left: style.paddingLeft ?? axisX ?? uniform ?? defaults.left,
  }
}

export const DEFAULT_OPACITY = 255

export function normalizeOpacity(
  value: number | string | undefined,
  defaultValue: number = DEFAULT_OPACITY,
  _caller?: string
): number {
  if (value === undefined) {
    return defaultValue
  }

  if (typeof value === "string") {
    if (value.endsWith("%")) {
      const percent = parseFloat(value)
      if (!Number.isNaN(percent)) {
        const clamped = Math.min(100, Math.max(0, percent))
        return Math.round((clamped / 100) * 255)
      }
    }

    const parsed = parseFloat(value)
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(1, Math.max(0, parsed))
      return Math.round(clamped * 255)
    }
  }

  if (typeof value === "number") {
    const clamped = Math.min(1, Math.max(0, value))
    return Math.round(clamped * 255)
  }

  return defaultValue
}
