import { describe, expect, it } from "bun:test"

import {
  formatPhoneNumber,
  getChatIdString,
  getConnectionStatusIcon,
  getContactName,
  getInitials,
  getMessageStatusIcon,
  getPhoneNumber,
  isGroupChat,
  isSelfChat,
  isStatusBroadcast,
  normalizeId,
  truncate,
} from "./formatters"

describe("formatters", () => {
  describe("truncate", () => {
    it("should return the original text if shorter than maxLength", () => {
      expect(truncate("Hello", 10)).toBe("Hello")
    })

    it("should truncate text with ellipsis when longer than maxLength", () => {
      expect(truncate("Hello World", 8)).toBe("Hello...")
    })

    it("should handle exact length text", () => {
      expect(truncate("Hello", 5)).toBe("Hello")
    })

    it("should return empty string for non-string input", () => {
      expect(truncate(null as unknown as string, 10)).toBe("")
      expect(truncate(undefined as unknown as string, 10)).toBe("")
      expect(truncate(123 as unknown as string, 10)).toBe("")
    })

    it("should use default maxLength of 50", () => {
      const longText = "a".repeat(60)
      const result = truncate(longText)
      expect(result.length).toBe(50)
      expect(result.endsWith("...")).toBe(true)
    })
  })

  describe("formatPhoneNumber", () => {
    it("should format phone number with @c.us suffix", () => {
      const result = formatPhoneNumber("905551234567@c.us")
      expect(result).toContain("+")
      expect(result).not.toContain("@")
    })

    it("should handle short numbers", () => {
      const result = formatPhoneNumber("1234567890@c.us")
      expect(result).toBe("1234567890")
    })

    it("should handle long numbers with country code", () => {
      const result = formatPhoneNumber("905551234567@c.us")
      expect(result).toBe("+90 555 123 4567")
    })
  })

  describe("getMessageStatusIcon", () => {
    it("should return pending icon for pending status", () => {
      expect(getMessageStatusIcon("pending")).toBe("⏱")
    })

    it("should return single check for sent status", () => {
      expect(getMessageStatusIcon("sent")).toBe("✓")
    })

    it("should return double check for delivered status", () => {
      expect(getMessageStatusIcon("delivered")).toBe("✓✓")
    })

    it("should return double check for read status", () => {
      expect(getMessageStatusIcon("read")).toBe("✓✓")
    })

    it("should return X for failed status", () => {
      expect(getMessageStatusIcon("failed")).toBe("✗")
    })

    it("should return empty string for unknown status", () => {
      expect(getMessageStatusIcon("unknown")).toBe("")
      expect(getMessageStatusIcon(undefined)).toBe("")
    })
  })

  describe("getConnectionStatusIcon", () => {
    it("should return green circle for WORKING status", () => {
      expect(getConnectionStatusIcon("WORKING")).toBe("🟢")
    })

    it("should return yellow circle for STARTING status", () => {
      expect(getConnectionStatusIcon("STARTING")).toBe("🟡")
    })

    it("should return yellow circle for SCAN_QR_CODE status", () => {
      expect(getConnectionStatusIcon("SCAN_QR_CODE")).toBe("🟡")
    })

    it("should return red circle for FAILED status", () => {
      expect(getConnectionStatusIcon("FAILED")).toBe("🔴")
    })

    it("should return red circle for STOPPED status", () => {
      expect(getConnectionStatusIcon("STOPPED")).toBe("🔴")
    })

    it("should return white circle for unknown status", () => {
      expect(getConnectionStatusIcon("unknown")).toBe("⚪")
    })
  })

  describe("getInitials", () => {
    it("should return single initial for single word name", () => {
      expect(getInitials("John")).toBe("J")
    })

    it("should return two initials for two word name", () => {
      expect(getInitials("John Doe")).toBe("JD")
    })

    it("should return three initials for three word name", () => {
      expect(getInitials("John Michael Doe")).toBe("JMD")
    })

    it("should limit to maxCount initials", () => {
      expect(getInitials("John Michael Doe Smith", 2)).toBe("JM")
    })

    it("should return ? for empty name", () => {
      expect(getInitials("")).toBe("?")
    })

    it("should handle extra whitespace", () => {
      expect(getInitials("  John   Doe  ")).toBe("JD")
    })

    it("should return uppercase initials", () => {
      expect(getInitials("john doe")).toBe("JD")
    })
  })

  describe("isGroupChat", () => {
    it("should return true for group chat ID", () => {
      expect(isGroupChat("123456789@g.us")).toBe(true)
    })

    it("should return false for individual chat ID", () => {
      expect(isGroupChat("905551234567@c.us")).toBe(false)
    })

    it("should return false for status broadcast", () => {
      expect(isGroupChat("status@broadcast")).toBe(false)
    })
  })

  describe("isStatusBroadcast", () => {
    it("should return true for status broadcast ID", () => {
      expect(isStatusBroadcast("status@broadcast")).toBe(true)
    })

    it("should return false for other IDs", () => {
      expect(isStatusBroadcast("905551234567@c.us")).toBe(false)
      expect(isStatusBroadcast("123456789@g.us")).toBe(false)
    })
  })

  describe("getChatIdString", () => {
    it("should return string ID as-is", () => {
      expect(getChatIdString("905551234567@c.us")).toBe("905551234567@c.us")
    })

    it("should extract _serialized from object ID", () => {
      expect(getChatIdString({ _serialized: "905551234567@c.us" })).toBe("905551234567@c.us")
    })

    it("should return empty string for null", () => {
      expect(getChatIdString(null)).toBe("")
    })

    it("should return empty string for undefined", () => {
      expect(getChatIdString(undefined)).toBe("")
    })

    it("should return empty string for object without _serialized", () => {
      expect(getChatIdString({} as { _serialized: string })).toBe("")
    })
  })

  describe("normalizeId", () => {
    it("should strip @c.us suffix", () => {
      expect(normalizeId("905551234567@c.us")).toBe("905551234567")
    })

    it("should strip @lid suffix", () => {
      expect(normalizeId("905551234567@lid")).toBe("905551234567")
    })

    it("should handle object IDs", () => {
      expect(normalizeId({ _serialized: "905551234567@c.us" })).toBe("905551234567")
    })

    it("should return empty string for null", () => {
      expect(normalizeId(null)).toBe("")
    })

    it("should return empty string for undefined", () => {
      expect(normalizeId(undefined)).toBe("")
    })

    it("should handle IDs without suffix", () => {
      expect(normalizeId("905551234567")).toBe("905551234567")
    })
  })

  describe("getPhoneNumber", () => {
    it("should extract phone number from @c.us ID", () => {
      expect(getPhoneNumber("905551234567@c.us")).toBe("905551234567")
    })

    it("should extract phone number from @lid ID", () => {
      expect(getPhoneNumber("905551234567@lid")).toBe("905551234567")
    })

    it("should extract phone number from @g.us ID", () => {
      expect(getPhoneNumber("123456789@g.us")).toBe("123456789")
    })

    it("should return empty string for null", () => {
      expect(getPhoneNumber(null)).toBe("")
    })

    it("should return empty string for undefined", () => {
      expect(getPhoneNumber(undefined)).toBe("")
    })
  })

  describe("isSelfChat", () => {
    it("should return true when chat ID matches profile ID", () => {
      expect(isSelfChat("905551234567@c.us", "905551234567@c.us")).toBe(true)
    })

    it("should return true when normalized IDs match", () => {
      expect(isSelfChat("905551234567@c.us", "905551234567@lid")).toBe(true)
    })

    it("should return false when IDs don't match", () => {
      expect(isSelfChat("905551234567@c.us", "905559876543@c.us")).toBe(false)
    })

    it("should return false when profile ID is null", () => {
      expect(isSelfChat("905551234567@c.us", null)).toBe(false)
    })
  })

  describe("getContactName", () => {
    it("should return saved name if available and different from phone number", () => {
      const contacts = new Map([["905551234567@c.us", "John Doe"]])
      expect(getContactName("905551234567@c.us", contacts)).toBe("John Doe")
    })

    it("should return notifyName if saved name is not available", () => {
      const contacts = new Map<string, string>()
      expect(getContactName("905551234567@c.us", contacts, "John")).toBe("John")
    })

    it("should return phone number if no other name available", () => {
      const contacts = new Map<string, string>()
      expect(getContactName("905551234567@c.us", contacts)).toBe("905551234567")
    })

    it("should return Unknown for null contact ID", () => {
      const contacts = new Map<string, string>()
      expect(getContactName(null, contacts)).toBe("Unknown")
    })

    it("should return Unknown for undefined contact ID", () => {
      const contacts = new Map<string, string>()
      expect(getContactName(undefined, contacts)).toBe("Unknown")
    })

    it("should prefer notifyName over phone number in saved name", () => {
      // If saved name is just the phone number, prefer notifyName
      const contacts = new Map([["905551234567@c.us", "905551234567"]])
      expect(getContactName("905551234567@c.us", contacts, "John")).toBe("John")
    })
  })
})
