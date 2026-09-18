/**
 * Style utilities for toast rendering
 */

import type { ToastOptions, ToastStyle, ToastType } from "../types"
import { mergeStyles } from "../../utils"
import { DEFAULT_TOAST_OPTIONS } from "../constants"

/**
 * Compute the final style for a toast by merging all style layers
 *
 * Merges styles in order of increasing specificity:
 * 1. DEFAULT_TOAST_OPTIONS.style (sensible defaults)
 * 2. DEFAULT_TOAST_OPTIONS[type].style (default type colors)
 * 3. toastOptions.style (user's global style)
 * 4. toastOptions[type].style (user's type-specific overrides)
 * 5. toastStyle (per-toast inline style from toast() call)
 *
 * @example
 * ```ts
 * computeToastStyle("success", { style: { paddingX: 2 }, success: { style: { borderColor: "green" } } })
 * ```
 */
export function computeToastStyle(
  type: ToastType,
  toastOptions?: ToastOptions,
  toastStyle?: Partial<ToastStyle>
): ToastStyle {
  // Default styles
  const defaultBaseStyle = DEFAULT_TOAST_OPTIONS.style
  const defaultTypeStyle = DEFAULT_TOAST_OPTIONS[type]?.style

  // User-provided styles from toastOptions
  const userBaseStyle = toastOptions?.style
  const userTypeStyle = toastOptions?.[type]?.style

  const computedStyle = mergeStyles(
    defaultBaseStyle,
    defaultTypeStyle,
    userBaseStyle,
    userTypeStyle,
    toastStyle
  )

  // If border is false, clear borderStyle and borderColor for cleaner config
  if (computedStyle.border === false) {
    delete computedStyle.borderStyle
    delete computedStyle.borderColor
  }

  return computedStyle
}

/**
 * Compute the duration for a toast
 *
 * Priority: toast.duration > toastOptions[type].duration > toastOptions.duration > DEFAULT
 */
export function computeToastDuration(
  type: ToastType,
  toastOptions?: ToastOptions,
  toastDuration?: number
): number {
  // Per-toast duration takes highest priority
  if (toastDuration !== undefined) {
    return toastDuration
  }

  // Type-specific duration from toastOptions
  const typeDuration = toastOptions?.[type]?.duration
  if (typeDuration !== undefined) {
    return typeDuration
  }

  // Global duration from toastOptions
  if (toastOptions?.duration !== undefined) {
    return toastOptions.duration
  }

  // Default
  return DEFAULT_TOAST_OPTIONS.duration
}
