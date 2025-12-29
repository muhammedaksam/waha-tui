/**
 * Toast Notification Component
 * Displays user-friendly error messages with optional recovery actions
 */

import { Box, Text } from "@opentui/core"

import type { AppError } from "../services/ErrorService"
import { WDSColors, WhatsAppTheme } from "../config/theme"
import { TIME_MS } from "../constants"

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
 * Get icon for toast type
 */
function getToastIcon(type: ToastType): string {
  switch (type) {
    case "error":
      return "✕"
    case "warning":
      return "⚠"
    case "success":
      return "✓"
    case "info":
      return "ℹ"
  }
}

/**
 * Get colors for toast type using WhatsApp WDS color palette
 */
function getToastColors(type: ToastType): { bg: string; border: string } {
  switch (type) {
    case "error":
      return { bg: WDSColors.red[800], border: WDSColors.red[400] }
    case "warning":
      return { bg: WDSColors.yellow[800], border: WDSColors.yellow[400] }
    case "success":
      return { bg: WDSColors.green[800], border: WDSColors.green[400] }
    case "info":
      return { bg: WhatsAppTheme.panelDark, border: WDSColors.emerald[500] }
  }
}

/**
 * Convert AppError to user-friendly toast config
 * @param error - The classified error
 * @param onRetry - Optional retry callback
 * @returns Toast configuration
 */
export function errorToToast(error: AppError, onRetry?: () => void): ToastConfig {
  const config: ToastConfig = {
    message: error.message,
    type: "error",
    duration: TIME_MS.TOAST_ERROR_DURATION,
  }

  // Add recovery action if available
  if (error.recoverable && onRetry) {
    config.actionText = "Retry"
    config.onAction = onRetry
  }

  // Use category-specific messages
  switch (error.category) {
    case "network":
      config.message = "Connection lost. Check your internet."
      if (onRetry) {
        config.actionText = "Retry"
      }
      break
    case "auth":
      config.message = "Session expired. Please reconnect."
      config.actionText = "Reconnect"
      break
    case "api":
      if (error.code === "SERVER_ERROR") {
        config.message = "Server error. Try again later."
      }
      break
  }

  return config
}

/**
 * Render a toast notification as a top-centered modal overlay
 * @param config - Toast configuration
 * @returns Box component for the toast
 */
export function Toast(config: ToastConfig) {
  const colors = getToastColors(config.type)
  const icon = getToastIcon(config.type)

  const message = config.actionText
    ? `${icon}  ${config.message}  [${config.actionText}]`
    : `${icon}  ${config.message}`

  // Create a full-width container positioned at the top
  return Box(
    {
      position: "absolute",
      top: 1,
      left: 0,
      right: 0,
      justifyContent: "center",
      alignItems: "center",
    },
    Box(
      {
        borderStyle: "rounded",
        borderColor: colors.border,
        backgroundColor: colors.bg,
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 0,
        paddingBottom: 0,
      },
      Text({ content: message })
    )
  )
}

/**
 * Create a simple error toast
 */
export function ErrorToast(message: string) {
  return Toast({ message, type: "error", duration: TIME_MS.TOAST_ERROR_DURATION })
}

/**
 * Create a simple success toast
 */
export function SuccessToast(message: string) {
  return Toast({ message, type: "success", duration: TIME_MS.TOAST_SUCCESS_DURATION })
}

/**
 * Create a simple warning toast
 */
export function WarningToast(message: string) {
  return Toast({ message, type: "warning", duration: TIME_MS.TOAST_WARNING_DURATION })
}

/**
 * Create a simple info toast
 */
export function InfoToast(message: string) {
  return Toast({ message, type: "info", duration: TIME_MS.TOAST_INFO_DURATION })
}
