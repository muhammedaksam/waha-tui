import { describe, expect, it, mock } from "bun:test"

import { retryable, RetryPresets, withRetry } from "~/services/RetryService"

describe("RetryService", () => {
  describe("withRetry", () => {
    it("should return result on first success", async () => {
      const fn = mock(() => Promise.resolve("success"))

      const result = await withRetry(fn, { maxRetries: 3 })

      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("should retry on network error and succeed", async () => {
      let attempts = 0
      const fn = mock(async () => {
        attempts++
        if (attempts < 2) {
          const error = new Error("ECONNREFUSED")
          throw error
        }
        return "success after retry"
      })

      const result = await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 10, // Fast for testing
      })

      expect(result).toBe("success after retry")
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("should throw after max retries exceeded", async () => {
      const fn = mock(() => {
        const error = new Error("ECONNREFUSED")
        return Promise.reject(error)
      })

      await expect(
        withRetry(fn, {
          maxRetries: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow("ECONNREFUSED")

      expect(fn).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
    })

    it("should not retry non-retryable errors", async () => {
      const fn = mock(() => {
        const error = Object.assign(new Error("Unauthorized"), {
          response: { status: 401 },
        })
        return Promise.reject(error)
      })

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          initialDelayMs: 10,
        })
      ).rejects.toThrow()

      // Should only be called once - no retries for auth errors
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("should call onRetry callback", async () => {
      let attempts = 0
      const onRetry = mock((_attempt: number, _delay: number) => {})
      const fn = mock(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error("ECONNREFUSED")
        }
        return "success"
      })

      await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        onRetry,
      })

      expect(onRetry).toHaveBeenCalledTimes(2) // Called on 1st and 2nd failure
    })

    it("should use custom isRetryable function", async () => {
      const fn = mock(() => Promise.reject(new Error("Custom error")))

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          initialDelayMs: 10,
          isRetryable: () => false, // Never retry
        })
      ).rejects.toThrow("Custom error")

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("should respect maxDelayMs cap", async () => {
      // This is a behavioral test - we verify the delay calculation logic
      // doesn't exceed maxDelayMs through the retry mechanism
      let attempts = 0
      const startTime = Date.now()

      const fn = mock(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error("ECONNREFUSED")
        }
        return "success"
      })

      await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 150, // Cap delays
        jitter: false,
      })

      const elapsed = Date.now() - startTime
      // Should be roughly 100 + 150 = 250ms (capped second delay)
      expect(elapsed).toBeLessThan(500)
    })
  })

  describe("retryable", () => {
    it("should create a retryable function", async () => {
      let attempts = 0
      const originalFn = async (value: string) => {
        attempts++
        if (attempts < 2) {
          throw new Error("ECONNREFUSED")
        }
        return `result: ${value}`
      }

      const retryableFn = retryable(originalFn, {
        maxRetries: 3,
        initialDelayMs: 10,
      })

      const result = await retryableFn("test")

      expect(result).toBe("result: test")
      expect(attempts).toBe(2)
    })

    it("should pass through arguments correctly", async () => {
      const originalFn = async (a: number, b: string) => `${a}-${b}`
      const retryableFn = retryable(originalFn, { maxRetries: 1 })

      const result = await retryableFn(42, "hello")

      expect(result).toBe("42-hello")
    })
  })

  describe("RetryPresets", () => {
    it("should have quick preset with low delays", () => {
      expect(RetryPresets.quick.maxRetries).toBe(3)
      expect(RetryPresets.quick.initialDelayMs).toBe(500)
      expect(RetryPresets.quick.maxDelayMs).toBe(2000)
    })

    it("should have standard preset", () => {
      expect(RetryPresets.standard.maxRetries).toBe(3)
      expect(RetryPresets.standard.initialDelayMs).toBe(1000)
    })

    it("should have aggressive preset with more retries", () => {
      expect(RetryPresets.aggressive.maxRetries).toBe(5)
    })

    it("should have gentle preset with longer delays", () => {
      expect(RetryPresets.gentle.initialDelayMs).toBe(3000)
    })
  })
})
