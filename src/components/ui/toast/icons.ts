import type { SpinnerConfig, ToastIcons, ToastType } from "./types"
import { isSpinnerConfig } from "./types"

/**
 * Default spinner configuration for loading toasts
 *
 * Uses a circular animation pattern. Override this by providing
 * a custom `loading` value in the `icons` option.
 *
 * @example
 * ```ts
 * // Use a different spinner pattern
 * const toaster = new ToasterRenderable(ctx, {
 *   icons: {
 *     ...DEFAULT_ICONS,
 *     loading: {
 *       frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
 *       interval: 80,
 *     },
 *   },
 * });
 * ```
 */
export const DEFAULT_SPINNER: SpinnerConfig = {
  frames: ["◜", "◠", "◝", "◞", "◡", "◟"],
  interval: 100,
}

/**
 * Default Unicode icons for toast notifications
 *
 * These work in most modern terminals. Use these as the base
 * and override specific icons as needed.
 *
 * @example
 * ```ts
 * import { DEFAULT_ICONS, ToasterRenderable } from '@tuiparts/toast';
 *
 * // Use defaults with a custom success icon
 * const toaster = new ToasterRenderable(ctx, {
 *   icons: { ...DEFAULT_ICONS, success: '++' },
 * });
 * ```
 */
export const DEFAULT_ICONS: ToastIcons = {
  success: "\u2713", // checkmark
  error: "\u2717", // X mark
  warning: "\u0021", // exclamation mark
  info: "\u2139", // information
  loading: DEFAULT_SPINNER,
  close: "\u00D7", // multiplication sign (x)
}

/**
 * ASCII-only icons for terminals with limited Unicode support
 *
 * Use these when targeting older terminals or environments
 * where Unicode characters may not render correctly.
 *
 * @example
 * ```ts
 * import { ASCII_ICONS, ToasterRenderable } from '@tuiparts/toast';
 *
 * const toaster = new ToasterRenderable(ctx, {
 *   icons: ASCII_ICONS,
 * });
 * ```
 */
export const ASCII_ICONS: ToastIcons = {
  success: "[/]",
  error: "[x]",
  warning: "[!]",
  info: "[i]",
  loading: "...",
  close: "x",
}

/**
 * Minimal icons using simple single characters
 *
 * Perfect for clean, unobtrusive toast notifications.
 * Pairs well with the `minimal` theme.
 *
 * @example
 * ```ts
 * import { MINIMAL_ICONS, ToasterRenderable } from '@tuiparts/toast';
 * import { minimal } from '@tuiparts/toast/themes';
 *
 * const toaster = new ToasterRenderable(ctx, {
 *   ...minimal,
 *   icons: MINIMAL_ICONS,
 * });
 * ```
 */
export const MINIMAL_ICONS: ToastIcons = {
  success: "*",
  error: "!",
  warning: "!",
  info: "i",
  loading: "~",
  close: "x",
}

/**
 * Emoji icons for terminals with good emoji support
 *
 * Note: Emoji rendering varies across terminals. Test in your
 * target environment before using in production.
 *
 * @example
 * ```ts
 * import { EMOJI_ICONS, ToasterRenderable } from '@tuiparts/toast';
 *
 * const toaster = new ToasterRenderable(ctx, {
 *   icons: EMOJI_ICONS,
 * });
 * ```
 */
export const EMOJI_ICONS: ToastIcons = {
  success: "\u2705", // green checkmark
  error: "\u274C", // red X
  warning: "\u26A0\uFE0F", // warning with variation selector
  info: "\u2139\uFE0F", // info with variation selector
  loading: "\u23F3", // hourglass
  close: "\u2716\uFE0F", // heavy multiplication X
}

/**
 * Get the icon string for a specific toast type
 *
 * For loading type, returns the first frame if it's a SpinnerConfig,
 * or the static string otherwise.
 *
 * @internal - Used by ToastRenderable, not part of public API
 */
export function getTypeIcon(type: ToastType, icons: ToastIcons): string {
  switch (type) {
    case "success":
      return icons.success
    case "error":
      return icons.error
    case "warning":
      return icons.warning
    case "info":
      return icons.info
    case "loading":
      return getLoadingIcon(icons.loading)
    default:
      return ""
  }
}

/**
 * Get the initial loading icon (first frame if spinner, or static string)
 *
 * @internal
 */
export function getLoadingIcon(loading: string | SpinnerConfig): string {
  if (isSpinnerConfig(loading)) {
    return loading.frames[0] ?? "\u25CC" // dotted circle (fallback when spinner unavailable)
  }
  return loading
}

/**
 * Get the spinner config if loading is animated, or null if static
 *
 * @internal
 */
export function getSpinnerConfig(loading: string | SpinnerConfig): SpinnerConfig | null {
  return isSpinnerConfig(loading) ? loading : null
}
