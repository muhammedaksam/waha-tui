/**
 * Retry Utility
 * Provides retry logic with exponential backoff for API calls
 */

import type { AppError } from "~/services/ErrorService"
import { errorService } from "~/services/ErrorService"
import { debugLog } from "~/utils/debug"

/**
 * Configuration for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs?: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
  /** Whether to add jitter to prevent thundering herd (default: true) */
  jitter?: boolean
  /** Function to determine if error is retryable (default: network/server errors) */
  isRetryable?: (error: AppError) => boolean
  /** Callback when retry is attempted */
  onRetry?: (attempt: number, delay: number, error: AppError) => void
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry">> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: (error: AppError) => {
    // Retry network errors and server errors (5xx)
    return (
      error.category === "network" || (error.category === "api" && error.code === "SERVER_ERROR")
    )
  },
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: delay = initialDelay * multiplier^attempt
  let delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1)

  // Cap at maximum delay
  delay = Math.min(delay, maxDelayMs)

  // Add jitter (±25% random variation)
  if (jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5 // 0.75 to 1.25
    delay = Math.floor(delay * jitterFactor)
  }

  return delay
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, initialDelayMs: 500 }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  let lastError: AppError | null = null

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await fn()
    } catch (error) {
      // Classify the error
      lastError = errorService.classify(error, { attempt })

      // Check if this is the last attempt
      const isLastAttempt = attempt > config.maxRetries

      // Check if error is retryable
      const isRetryable = config.isRetryable(lastError)

      if (isLastAttempt || !isRetryable) {
        debugLog(
          "Retry",
          `Attempt ${attempt}/${config.maxRetries + 1} failed (not retrying): ${lastError.message}`
        )
        throw error
      }

      // Calculate delay for next retry
      const delay = calculateDelay(
        attempt,
        config.initialDelayMs,
        config.maxDelayMs,
        config.backoffMultiplier,
        config.jitter
      )

      debugLog(
        "Retry",
        `Attempt ${attempt}/${config.maxRetries + 1} failed, retrying in ${delay}ms: ${lastError.message}`
      )

      // Call onRetry callback if provided
      if (config.onRetry) {
        config.onRetry(attempt, delay, lastError)
      }

      // Wait before retrying
      await sleep(delay)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError?.cause || new Error("All retry attempts failed")
}

/**
 * Create a retryable version of an async function
 *
 * @example
 * ```ts
 * const fetchWithRetry = retryable(fetchData, { maxRetries: 3 });
 * const result = await fetchWithRetry();
 * ```
 */
export function retryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options)
}

/**
 * Preset configurations for common retry scenarios
 */
export const RetryPresets = {
  /** Quick retry for minor network hiccups (3 retries, 500ms initial) */
  quick: {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 2000,
  } as RetryOptions,

  /** Standard retry for API calls (3 retries, 1s initial) */
  standard: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  } as RetryOptions,

  /** Aggressive retry for critical operations (5 retries, 2s initial) */
  aggressive: {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
  } as RetryOptions,

  /** Gentle retry with longer delays (3 retries, 3s initial) */
  gentle: {
    maxRetries: 3,
    initialDelayMs: 3000,
    maxDelayMs: 15000,
  } as RetryOptions,
} as const
