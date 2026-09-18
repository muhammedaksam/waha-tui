/**
 * @tuiparts/toast/themes
 *
 * Optional theme presets for the toaster.
 * These override the built-in defaults with alternative visual styles.
 *
 * @example
 * ```ts
 * import { ToasterRenderable } from '@tuiparts/toast'
 * import { minimal } from '@tuiparts/toast/themes'
 *
 * const toaster = new ToasterRenderable(ctx, minimal)
 * ```
 */

import type { ToasterOptions } from "./types"
import { DEFAULT_ICONS, MINIMAL_ICONS } from "./icons"

/**
 * A theme configuration for the toaster.
 * Extends ToasterOptions with metadata.
 */
export interface ToasterTheme extends ToasterOptions {
  /** Human-readable name for the theme */
  name: string
  /** Brief description of the theme */
  description: string
}

// =============================================================================
// Theme Definitions
// =============================================================================

/**
 * Minimal theme - clean and unobtrusive
 *
 * No borders, subtle styling. Perfect for apps where
 * toasts should be informative but not distracting.
 *
 * @example
 * ```ts
 * import { ToasterRenderable } from '@tuiparts/toast';
 * import { minimal } from '@tuiparts/toast/themes';
 *
 * const toaster = new ToasterRenderable(ctx, minimal);
 *
 * // Or customize it
 * const toaster = new ToasterRenderable(ctx, {
 *   ...minimal,
 *   position: 'top-center',
 *   stackingMode: 'stack',
 * });
 * ```
 */
export const minimal: ToasterTheme = {
  name: "Minimal",
  description: "Clean and unobtrusive, no borders",
  position: "bottom-right",
  stackingMode: "single",
  icons: MINIMAL_ICONS,
  toastOptions: {
    style: {
      border: false,
      backgroundColor: "#262626",
      foregroundColor: "#e5e5e5",
      mutedColor: "#737373",
      paddingX: 2,
      paddingY: 1,
    },
    success: { style: { foregroundColor: "#4ade80" } },
    error: { style: { foregroundColor: "#f87171" } },
    warning: { style: { foregroundColor: "#fbbf24" } },
    info: { style: { foregroundColor: "#60a5fa" } },
  },
}

/**
 * Monochrome theme - grayscale only
 *
 * No colors, just shades of gray. Useful for
 * accessibility or when color is not desired.
 *
 * @example
 * ```ts
 * import { ToasterRenderable } from '@tuiparts/toast';
 * import { monochrome } from '@tuiparts/toast/themes';
 *
 * const toaster = new ToasterRenderable(ctx, monochrome);
 * ```
 */
export const monochrome: ToasterTheme = {
  name: "Monochrome",
  description: "Grayscale only, no colors",
  position: "bottom-right",
  stackingMode: "single",
  icons: DEFAULT_ICONS,
  toastOptions: {
    style: {
      border: true,
      borderStyle: "single",
      borderColor: "#525252",
      backgroundColor: "#171717",
      foregroundColor: "#fafafa",
      mutedColor: "#a3a3a3",
      paddingX: 1,
      paddingY: 0,
      minHeight: 3,
    },
    default: { style: { borderColor: "#525252" } },
    success: { style: { borderColor: "#a3a3a3" } },
    error: { style: { borderColor: "#fafafa" } },
    warning: { style: { borderColor: "#d4d4d4" } },
    info: { style: { borderColor: "#737373" } },
    loading: { style: { borderColor: "#525252" } },
  },
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * All available themes as a single object
 *
 * @example
 * ```ts
 * import { themes } from '@tuiparts/toast/themes';
 *
 * // Access themes by name
 * const toaster = new ToasterRenderable(ctx, themes.minimal);
 * ```
 */
export const themes = {
  minimal,
  monochrome,
} as const
