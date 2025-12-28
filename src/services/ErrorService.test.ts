import { describe, expect, it } from "bun:test"

import { ErrorService, errorService } from "./ErrorService"

describe("ErrorService", () => {
  describe("classify", () => {
    it("should classify network errors correctly", () => {
      const error = new Error("ECONNREFUSED: Connection refused")
      const result = errorService.classify(error)

      expect(result.code).toBe("NETWORK_ERROR")
      expect(result.category).toBe("network")
      expect(result.recoverable).toBe(true)
    })

    it("should classify fetch failed errors as network errors", () => {
      const error = new Error("fetch failed")
      const result = errorService.classify(error)

      expect(result.code).toBe("NETWORK_ERROR")
      expect(result.category).toBe("network")
    })

    it("should classify axios 401 errors as auth errors", () => {
      const error = Object.assign(new Error("Unauthorized"), {
        response: { status: 401 },
      })
      const result = errorService.classify(error)

      expect(result.code).toBe("AUTH_ERROR")
      expect(result.category).toBe("auth")
      expect(result.recoverable).toBe(true)
    })

    it("should classify axios 403 errors as auth errors", () => {
      const error = Object.assign(new Error("Forbidden"), {
        response: { status: 403 },
      })
      const result = errorService.classify(error)

      expect(result.code).toBe("AUTH_ERROR")
      expect(result.category).toBe("auth")
    })

    it("should classify axios 404 errors as not found", () => {
      const error = Object.assign(new Error("Not Found"), {
        response: { status: 404 },
      })
      const result = errorService.classify(error)

      expect(result.code).toBe("NOT_FOUND")
      expect(result.category).toBe("api")
      expect(result.severity).toBe("warning")
      expect(result.recoverable).toBe(false)
    })

    it("should classify axios 500 errors as server errors", () => {
      const error = Object.assign(new Error("Internal Server Error"), {
        response: { status: 500 },
      })
      const result = errorService.classify(error)

      expect(result.code).toBe("SERVER_ERROR")
      expect(result.category).toBe("api")
      expect(result.recoverable).toBe(true)
    })

    it("should classify unknown Error objects", () => {
      const error = new Error("Something went wrong")
      const result = errorService.classify(error)

      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.category).toBe("unknown")
      expect(result.message).toBe("Something went wrong")
    })

    it("should classify non-Error values", () => {
      const result = errorService.classify("string error")

      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("string error")
    })

    it("should include context in classified error", () => {
      const error = new Error("Test error")
      const context = { userId: "123", action: "test" }
      const result = errorService.classify(error, context)

      expect(result.context).toEqual(context)
    })

    it("should include timestamp", () => {
      const before = new Date()
      const result = errorService.classify(new Error("test"))
      const after = new Date()

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })

  describe("handle", () => {
    it("should classify and return AppError", () => {
      const service = new ErrorService()
      const error = new Error("Test error")

      const result = service.handle(error, { notify: false, log: false })

      expect(result.message).toBe("Test error")
    })

    it("should store errors in recent errors", () => {
      const service = new ErrorService()
      service.handle(new Error("Error 1"), { notify: false, log: false })
      service.handle(new Error("Error 2"), { notify: false, log: false })

      const recent = service.getRecentErrors()
      expect(recent.length).toBe(2)
      expect(recent[0].message).toBe("Error 2") // Most recent first
      expect(recent[1].message).toBe("Error 1")
    })

    it("should limit recent errors to maxRecentErrors", () => {
      const service = new ErrorService()
      for (let i = 0; i < 60; i++) {
        service.handle(new Error(`Error ${i}`), { notify: false, log: false })
      }

      const recent = service.getRecentErrors()
      expect(recent.length).toBe(50) // Default max
    })
  })

  describe("subscribe", () => {
    it("should notify listeners when error is handled", () => {
      const service = new ErrorService()
      const receivedErrors: unknown[] = []

      service.subscribe((error) => receivedErrors.push(error))
      service.handle(new Error("Test"), { log: false })

      expect(receivedErrors.length).toBe(1)
    })

    it("should allow unsubscribing", () => {
      const service = new ErrorService()
      const receivedErrors: unknown[] = []

      const unsubscribe = service.subscribe((error) => receivedErrors.push(error))
      unsubscribe()
      service.handle(new Error("Test"), { log: false })

      expect(receivedErrors.length).toBe(0)
    })

    it("should not notify when notify option is false", () => {
      const service = new ErrorService()
      const receivedErrors: unknown[] = []

      service.subscribe((error) => receivedErrors.push(error))
      service.handle(new Error("Test"), { notify: false, log: false })

      expect(receivedErrors.length).toBe(0)
    })
  })

  describe("getUserMessage", () => {
    it("should return friendly message for network errors", () => {
      const error = errorService.classify(new Error("ECONNREFUSED"))
      const message = errorService.getUserMessage(error)

      expect(message).toBe("Connection problem. Please check your internet.")
    })

    it("should return friendly message for auth errors", () => {
      const error = errorService.classify(
        Object.assign(new Error("Unauthorized"), { response: { status: 401 } })
      )
      const message = errorService.getUserMessage(error)

      expect(message).toBe("Session expired. Please log in again.")
    })
  })

  describe("clearRecentErrors", () => {
    it("should clear all recent errors", () => {
      const service = new ErrorService()
      service.handle(new Error("Error 1"), { notify: false, log: false })
      service.handle(new Error("Error 2"), { notify: false, log: false })

      service.clearRecentErrors()

      expect(service.getRecentErrors().length).toBe(0)
    })
  })

  describe("wrap", () => {
    it("should wrap async function with error handling", async () => {
      const service = new ErrorService()
      const errors: unknown[] = []
      service.subscribe((e) => errors.push(e))

      const failingFn = async () => {
        throw new Error("Wrapped error")
      }

      const wrappedFn = service.wrap(failingFn, { log: false })
      const result = await wrappedFn()

      expect(result).toBeUndefined()
      expect(errors.length).toBe(1)
    })

    it("should return result for successful functions", async () => {
      const service = new ErrorService()

      const successFn = async () => "success"
      const wrappedFn = service.wrap(successFn, { log: false })
      const result = await wrappedFn()

      expect(result).toBe("success")
    })
  })
})
