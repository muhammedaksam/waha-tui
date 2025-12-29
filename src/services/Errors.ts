import type { AppError, ErrorCategory, ErrorSeverity } from "./ErrorService"

/**
 * Base class for all custom application errors
 * Provides structured error information and better type safety
 */
export abstract class BaseAppError extends Error implements AppError {
  readonly code: string
  readonly severity: ErrorSeverity
  readonly category: ErrorCategory
  readonly timestamp: Date
  readonly recoverable: boolean
  readonly recoveryAction?: string
  readonly context?: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    recoverable: boolean,
    recoveryAction?: string,
    context?: Record<string, unknown>,
    cause?: unknown
  ) {
    super(message, { cause: cause instanceof Error ? cause : undefined })
    this.name = this.constructor.name
    this.code = code
    this.category = category
    this.severity = severity
    this.recoverable = recoverable
    this.recoveryAction = recoveryAction
    this.context = context
    this.timestamp = new Date()

    Error.captureStackTrace?.(this, this.constructor)
  }

  get cause(): Error | undefined {
    return super.cause instanceof Error ? super.cause : undefined
  }

  toAppError(): AppError {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      cause: this.cause,
      context: this.context,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      recoveryAction: this.recoveryAction,
    }
  }
}

export class NetworkError extends BaseAppError {
  constructor(
    message: string = "Unable to connect. Please check your network connection.",
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      "NETWORK_ERROR",
      message,
      "network",
      "error",
      true,
      "Check your internet connection and try again",
      context,
      cause
    )
  }
}

export class AuthError extends BaseAppError {
  constructor(
    message: string = "Authentication failed. Please re-authenticate.",
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      "AUTH_ERROR",
      message,
      "auth",
      "error",
      true,
      "Re-authenticate with WAHA server",
      context,
      cause
    )
  }
}

export class ValidationError extends BaseAppError {
  constructor(message: string, field?: string, context?: Record<string, unknown>, cause?: unknown) {
    super(
      "VALIDATION_ERROR",
      message,
      "validation",
      "warning",
      true,
      "Check your input and try again",
      { ...context, field },
      cause
    )
  }
}

export class StateError extends BaseAppError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super(
      "STATE_ERROR",
      message,
      "state",
      "error",
      false,
      "Restart the application",
      context,
      cause
    )
  }
}

export class NotFoundError extends BaseAppError {
  constructor(resource: string, id: string, context?: Record<string, unknown>, cause?: Error) {
    super(
      "NOT_FOUND",
      `${resource} '${id}' not found`,
      "api",
      "warning",
      false,
      undefined,
      { ...context, resource, id },
      cause
    )
  }
}

export class ServerError extends BaseAppError {
  constructor(
    message: string = "Server error. Please try again later.",
    statusCode?: number,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      "SERVER_ERROR",
      message,
      "api",
      "error",
      true,
      "Wait a moment and try again",
      { ...context, statusCode },
      cause
    )
  }
}

export class RateLimitError extends BaseAppError {
  constructor(
    message: string = "Too many requests. Please slow down.",
    retryAfter?: number,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      "RATE_LIMIT_ERROR",
      message,
      "api",
      "warning",
      true,
      `Wait ${retryAfter || "a few"} seconds before trying again`,
      { ...context, retryAfter },
      cause
    )
  }
}

export class ConfigurationError extends BaseAppError {
  constructor(
    message: string,
    configKey?: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      "CONFIG_ERROR",
      message,
      "validation",
      "error",
      false,
      "Check your configuration and try again",
      { ...context, configKey },
      cause
    )
  }
}

export class WebSocketError extends BaseAppError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super(
      "WEBSOCKET_ERROR",
      message,
      "network",
      "error",
      true,
      "WebSocket connection will reconnect automatically",
      context,
      cause
    )
  }
}
