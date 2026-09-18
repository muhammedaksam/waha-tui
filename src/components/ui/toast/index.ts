/**
 * @tuiparts/toast - Toast notification system for terminal applications
 *
 * A Sonner-inspired toast library for @opentui/core.
 */

// =============================================================================
// Core API - The main toast function and container
// =============================================================================

export { ToasterRenderable } from "./renderables"
export { toast } from "./state"

// =============================================================================
// Types - For TypeScript users
// =============================================================================

export { TOAST_DURATION } from "./constants"
export type {
  /** Action button configuration for toasts */
  Action,
  /** Options passed to toast() and toast.success(), etc. */
  ExternalToast,
  /** Position of the toaster on screen */
  Position,
  /** Configuration for toast.promise() */
  PromiseData,
  /** Spinner configuration for animated loading icons */
  SpinnerConfig,
  /** Stacking mode for multiple toasts */
  StackingMode,
  /** Offset configuration for toaster positioning */
  ToasterOffset,
  /** Configuration options for ToasterRenderable */
  ToasterOptions,
  /** Custom icon set configuration */
  ToastIcons,
  /** Default toast options (styles, duration, per-type overrides) */
  ToastOptions,
  /** Terminal-specific toast styling options */
  ToastStyle,
  /** Toast notification type variants */
  ToastType,
  /** Per-type toast options (style + duration) */
  TypeToastOptions,
} from "./types"
export { isAction, isSpinnerConfig } from "./types"

// =============================================================================
// Icon Sets - Alternative icon configurations
// =============================================================================

export { ASCII_ICONS, DEFAULT_ICONS, EMOJI_ICONS, MINIMAL_ICONS } from "./icons"
