/**
 * Toast Notification Component
 * Using @opentui-ui/toast for beautiful sonner-inspired toast notifications
 */

import type { ToasterOptions } from "@opentui-ui/toast"

import { toast, TOAST_DURATION } from "@opentui-ui/toast"

import type { AppError } from "../services/ErrorService"
import { WDSColors, WhatsAppTheme } from "../config/theme"
import { TIME_MS } from "../constants"
import { debugLog } from "../utils/debug"

/**
 * WhatsApp-themed toaster configuration
 * Uses the WDS color palette for consistent styling
 */
export const WHATSAPP_TOASTER_CONFIG: ToasterOptions = {
  position: "bottom-right",
  gap: 1,
  stackingMode: "stack",
  maxWidth: 60,
  offset: { right: 2, bottom: 4 },
  icons: {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
    loading: {
      frames: ["◜", "◠", "◝", "◞", "◡", "◟"],
      interval: 100,
    },
    close: "×",
  },
  toastOptions: {
    style: {
      backgroundColor: WhatsAppTheme.panelDark,
      foregroundColor: WhatsAppTheme.textPrimary,
      borderColor: WhatsAppTheme.borderLight,
      borderStyle: "rounded",
      paddingX: 2,
      paddingY: 0,
    },
    duration: 4000,
    success: {
      style: {
        borderColor: WDSColors.green[400],
        iconColor: WDSColors.green[400],
      },
      duration: 3000,
    },
    error: {
      style: {
        borderColor: WDSColors.red[400],
        iconColor: WDSColors.red[400],
      },
      duration: 5000,
    },
    warning: {
      style: {
        borderColor: WDSColors.yellow[400],
        iconColor: WDSColors.yellow[400],
      },
      duration: 4000,
    },
    info: {
      style: {
        borderColor: WDSColors.skyBlue[500],
        iconColor: WDSColors.skyBlue[500],
      },
      duration: 3000,
    },
    loading: {
      style: {
        borderColor: WhatsAppTheme.textSecondary,
        iconColor: WhatsAppTheme.green,
      },
    },
  },
}

/**
 * Toast notification types with associated styling
 */
export type ToastType = "error" | "warning" | "success" | "info"

/**
 * Toast configuration
 */
export interface ToastConfig {
  /** Message to display */
  message: string
  /** Toast type for styling */
  type: ToastType
  /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
  duration?: number
  /** Optional action button text */
  actionText?: string
  /** Optional action callback */
  onAction?: () => void
}

/**
 * @param onRetry - Optional retry callback
 */
export function errorToToast(error: AppError, onRetry?: () => void): void {
  debugLog("Toast", `Creating error toast: ${error.code} - ${error.message}`)
  let title = "Error"
  let description = error.message
  let actionLabel: string | undefined
  let actionCallback: (() => void) | undefined

  // Add recovery action if available
  if (error.recoverable && onRetry) {
    actionLabel = "Retry"
    actionCallback = onRetry
  }

  // Use category-specific messages
  switch (error.category) {
    case "network":
      title = "Connection Lost"
      description = "Check your internet connection."
      if (onRetry) {
        actionLabel = "Retry"
        actionCallback = onRetry
      }
      break
    case "auth":
      title = "Session Expired"
      description = "Please reconnect to continue."
      actionLabel = "Reconnect"
      break
    case "api":
      if (error.code === "SERVER_ERROR") {
        title = "Server Error"
        description = "Try again later."
      }
      break
  }

  // Show the toast with title + description
  toast.error(title, {
    description,
    duration: TIME_MS.TOAST_ERROR_DURATION,
    action:
      actionLabel && actionCallback ? { label: actionLabel, onClick: actionCallback } : undefined,
  })
}

/**
 * Create a simple error toast
 */
export function errorToast(description: string): string | number {
  return toast.error("Error", { description, duration: TIME_MS.TOAST_ERROR_DURATION })
}

/**
 * Create a simple success toast
 */
export function successToast(description: string): string | number {
  return toast.success("Success", { description, duration: TIME_MS.TOAST_SUCCESS_DURATION })
}

/**
 * Create a simple warning toast
 */
export function warningToast(description: string): string | number {
  return toast.warning("Warning", { description, duration: TIME_MS.TOAST_WARNING_DURATION })
}

/**
 * Create a simple info toast
 */
export function infoToast(description: string): string | number {
  return toast.info("Info", { description, duration: TIME_MS.TOAST_INFO_DURATION })
}

// Re-export toast utilities from the package
export { toast, TOAST_DURATION }
