/**
 * Error Service
 * Centralized error handling, classification, and reporting
 */

import { debugLog } from "../utils/debug"
import { BaseAppError } from "./Errors"

/**
 * Error severity levels
 */
export type ErrorSeverity = "info" | "warning" | "error" | "critical"

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | "network" // Network connectivity issues
  | "api" // API errors (4xx, 5xx)
  | "auth" // Authentication/authorization failures
  | "validation" // Input validation errors
  | "state" // Application state errors
  | "unknown" // Unclassified errors

/**
 * Structured error information
 */
export interface AppError {
  /** Unique error code for identification */
  code: string
  /** Human-readable error message */
  message: string
  /** Error severity level */
  severity: ErrorSeverity
  /** Error category for classification */
  category: ErrorCategory
  /** Original error if wrapped */
  cause?: Error
  /** Additional context data */
  context?: Record<string, unknown>
  /** Timestamp of error occurrence */
  timestamp: Date
  /** Whether this error is recoverable */
  recoverable: boolean
  /** Suggested recovery action */
  recoveryAction?: string
}

/**
 * Error listener callback type
 */
export type ErrorListener = (error: AppError) => void

/**
 * Options for error handling
 */
export interface HandleErrorOptions {
  /** Show user notification */
  notify?: boolean
  /** Log to debug output */
  log?: boolean
  /** Rethrow after handling */
  rethrow?: boolean
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Centralized Error Service
 * Provides consistent error handling across the application
 */
class ErrorService {
  private listeners: Set<ErrorListener> = new Set()
  private recentErrors: AppError[] = []
  private maxRecentErrors = 50

  /**
   * Subscribe to error events
   * @returns Unsubscribe function
   */
  subscribe(listener: ErrorListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Classify an error into an AppError structure
   */
  classify(error: unknown, context?: Record<string, unknown>): AppError {
    const timestamp = new Date()

    // Handle custom error classes first
    if (error instanceof BaseAppError) {
      const appError = error.toAppError()
      if (context) {
        appError.context = { ...appError.context, ...context }
      }
      return appError
    }

    // Handle axios/fetch network errors
    if (this.isNetworkError(error)) {
      return {
        code: "NETWORK_ERROR",
        message: "Unable to connect. Please check your network connection.",
        severity: "error",
        category: "network",
        cause: error instanceof Error ? error : undefined,
        context,
        timestamp,
        recoverable: true,
        recoveryAction: "Check your internet connection and try again",
      }
    }

    // Handle API errors (axios response errors)
    if (this.isApiError(error)) {
      const status = this.getStatusCode(error)
      const apiContext = { ...context, statusCode: status }

      if (status === 401 || status === 403) {
        return {
          code: "AUTH_ERROR",
          message: "Authentication failed. Please re-authenticate.",
          severity: "error",
          category: "auth",
          cause: error instanceof Error ? error : undefined,
          context: apiContext,
          timestamp,
          recoverable: true,
          recoveryAction: "Re-authenticate with WAHA server",
        }
      }

      if (status === 404) {
        return {
          code: "NOT_FOUND",
          message: "The requested resource was not found.",
          severity: "warning",
          category: "api",
          cause: error instanceof Error ? error : undefined,
          context: apiContext,
          timestamp,
          recoverable: false,
        }
      }

      if (status >= 500) {
        return {
          code: "SERVER_ERROR",
          message: "Server error. Please try again later.",
          severity: "error",
          category: "api",
          cause: error instanceof Error ? error : undefined,
          context: apiContext,
          timestamp,
          recoverable: true,
          recoveryAction: "Wait a moment and try again",
        }
      }

      return {
        code: "API_ERROR",
        message: this.getErrorMessage(error) || "An API error occurred.",
        severity: "error",
        category: "api",
        cause: error instanceof Error ? error : undefined,
        context: apiContext,
        timestamp,
        recoverable: true,
      }
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      return {
        code: "UNKNOWN_ERROR",
        message: error.message || "An unexpected error occurred.",
        severity: "error",
        category: "unknown",
        cause: error,
        context,
        timestamp,
        recoverable: false,
      }
    }

    // Handle unknown error types
    return {
      code: "UNKNOWN_ERROR",
      message: String(error) || "An unexpected error occurred.",
      severity: "error",
      category: "unknown",
      context,
      timestamp,
      recoverable: false,
    }
  }

  /**
   * Handle an error with optional notification and logging
   */
  handle(error: unknown, options: HandleErrorOptions = {}): AppError {
    const { notify = true, log = true, rethrow = false, context } = options

    const appError = this.classify(error, context)

    // Store in recent errors
    this.recentErrors.unshift(appError)
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors)
    }

    // Log to debug output
    if (log) {
      debugLog(
        "Error",
        `[${appError.code}] ${appError.message}${appError.cause ? ` - Cause: ${appError.cause.message}` : ""}`
      )
    }

    // Notify listeners (includes toast listener if registered)
    if (notify) {
      this.notifyListeners(appError)
    }

    // Rethrow if requested
    if (rethrow) {
      throw appError.cause || new Error(appError.message)
    }

    return appError
  }

  /**
   * Create a user-friendly error message
   */
  getUserMessage(error: AppError): string {
    switch (error.category) {
      case "network":
        return "Connection problem. Please check your internet."
      case "auth":
        return "Session expired. Please log in again."
      case "api":
        return error.message || "Something went wrong. Please try again."
      case "validation":
        return error.message || "Invalid input. Please check your data."
      default:
        return "An unexpected error occurred."
    }
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(): readonly AppError[] {
    return this.recentErrors
  }

  /**
   * Clear recent errors
   */
  clearRecentErrors(): void {
    this.recentErrors = []
  }

  /**
   * Create a wrapped async function with automatic error handling
   */
  wrap<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    options: HandleErrorOptions = {}
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args)
      } catch (error) {
        this.handle(error, options)
        return undefined
      }
    }) as T
  }

  /**
   * Notify all listeners of an error
   */
  private notifyListeners(error: AppError): void {
    for (const listener of this.listeners) {
      try {
        listener(error)
      } catch (listenerError) {
        debugLog("Error", `Error listener threw: ${listenerError}`)
      }
    }
  }

  /**
   * Check if error is a network connectivity error
   */
  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false

    const networkErrorPatterns = [
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "ETIMEDOUT",
      "ENETUNREACH",
      "ERR_NETWORK",
      "Network Error",
      "Failed to fetch",
      "fetch failed",
    ]

    return networkErrorPatterns.some(
      (pattern) =>
        error.message.includes(pattern) || (error as { code?: string }).code?.includes(pattern)
    )
  }

  /**
   * Check if error is an API response error
   */
  private isApiError(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    const axiosError = error as { response?: { status?: number } }
    return typeof axiosError.response?.status === "number"
  }

  /**
   * Extract HTTP status code from error
   */
  private getStatusCode(error: unknown): number {
    const axiosError = error as { response?: { status?: number } }
    return axiosError.response?.status || 0
  }

  /**
   * Extract error message from various error formats
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Check for axios response data
      const axiosError = error as {
        response?: { data?: { message?: string; error?: string } }
      }
      if (axiosError.response?.data?.message) {
        return axiosError.response.data.message
      }
      if (axiosError.response?.data?.error) {
        return axiosError.response.data.error
      }
      return error.message
    }
    return String(error)
  }
}

// Export singleton instance
export const errorService = new ErrorService()

// Export class for testing
export { ErrorService }
