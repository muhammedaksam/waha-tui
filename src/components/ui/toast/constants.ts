import type { ToasterOffset, ToastOptions, ToastStyle } from "./types"

/**
 * Common toast duration presets (in milliseconds)
 *
 * Use these for consistent, readable duration values across your app.
 *
 * | Preset       | Duration   | Use Case                  |
 * |--------------|------------|---------------------------|
 * | `SHORT`      | 2000ms     | Brief confirmations       |
 * | `DEFAULT`    | 4000ms     | Standard notifications    |
 * | `LONG`       | 6000ms     | Important messages        |
 * | `EXTENDED`   | 10000ms    | Critical information      |
 * | `PERSISTENT` | Infinity   | Requires manual dismissal |
 *
 * @example
 * ```ts
 * import { toast, TOAST_DURATION } from '@tuiparts/toast';
 *
 * // Quick confirmation
 * toast.success('Copied!', { duration: TOAST_DURATION.SHORT });
 *
 * // Important warning
 * toast.warning('Check your settings', { duration: TOAST_DURATION.LONG });
 *
 * // Critical error that requires acknowledgment
 * toast.error('Connection lost', { duration: TOAST_DURATION.PERSISTENT });
 *
 * // Set as default for all toasts
 * const toaster = new ToasterRenderable(ctx, {
 *   toastOptions: { duration: TOAST_DURATION.LONG },
 * });
 * ```
 */
export const TOAST_DURATION = {
  /** 2 seconds - for brief confirmations */
  SHORT: 2000,
  /** 4 seconds - default duration */
  DEFAULT: 4000,
  /** 6 seconds - for important messages */
  LONG: 6000,
  /** 10 seconds - for critical information */
  EXTENDED: 10000,
  /** Never auto-dismiss - requires manual dismissal */
  PERSISTENT: Infinity,
} as const

/**
 * Time to wait before unmounting a dismissed toast (ms)
 * This allows for any exit effects
 *
 * @internal
 */
export const TIME_BEFORE_UNMOUNT = 200

/**
 * Default toast width (in terminal columns)
 *
 * @internal - Users should set maxWidth in ToasterOptions instead
 */
export const TOAST_WIDTH = 60

/**
 * Default offset from screen edges
 *
 * @internal
 */
export const DEFAULT_OFFSET: ToasterOffset = {
  top: 1,
  right: 2,
  bottom: 1,
  left: 2,
}

/**
 * Default base style for all toasts
 *
 * @internal
 */
export const DEFAULT_STYLE: ToastStyle = {
  border: true,
  borderStyle: "single",
  borderColor: "#333333",
  minHeight: 3,
  backgroundColor: "#1a1a1a",
  foregroundColor: "#ffffff",
  mutedColor: "#6b7280",
}

/**
 * Default toast options including base style and per-type overrides
 *
 * @internal
 */
export const DEFAULT_TOAST_OPTIONS = {
  style: DEFAULT_STYLE,
  duration: TOAST_DURATION.DEFAULT,
  default: {
    style: { borderColor: "#333333" },
  },
  success: {
    style: { borderColor: "#22c55e" },
  },
  error: {
    style: { borderColor: "#ef4444" },
  },
  warning: {
    style: { borderColor: "#f59e0b" },
  },
  info: {
    style: { borderColor: "#3b82f6" },
  },
  loading: {
    style: { borderColor: "#6b7280" },
  },
} satisfies ToastOptions
