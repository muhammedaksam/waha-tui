/**
 * Tests for URL utilities
 */

import { parseColor, TextAttributes } from "@opentui/core"
import { describe, expect, it } from "bun:test"

import { WhatsAppTheme } from "~/config/theme"
import {
  extractUrls,
  formatTextWithUrls,
  normalizeUrl,
  openUrl,
  trimTrailingPunctuation,
} from "~/utils/urlUtils"

describe("trimTrailingPunctuation", () => {
  it("removes trailing dots, commas, colons, question marks, and brackets", () => {
    expect(trimTrailingPunctuation("https://example.com.")).toEqual({
      url: "https://example.com",
      trailing: ".",
    })
    expect(trimTrailingPunctuation("https://example.com,")).toEqual({
      url: "https://example.com",
      trailing: ",",
    })
    expect(trimTrailingPunctuation("https://example.com)...")).toEqual({
      url: "https://example.com",
      trailing: ")...",
    })
    expect(trimTrailingPunctuation("https://example.com?foo=1!")).toEqual({
      url: "https://example.com?foo=1",
      trailing: "!",
    })
  })

  it("leaves clean URLs unchanged", () => {
    expect(trimTrailingPunctuation("https://example.com/path?a=1&b=2")).toEqual({
      url: "https://example.com/path?a=1&b=2",
      trailing: "",
    })
  })
})

describe("normalizeUrl", () => {
  it("prepends https:// to www. domains", () => {
    expect(normalizeUrl("www.example.com")).toBe("https://www.example.com")
  })

  it("leaves URLs with scheme unchanged", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com")
    expect(normalizeUrl("http://example.com")).toBe("http://example.com")
    expect(normalizeUrl("ftp://example.com")).toBe("ftp://example.com")
  })

  it("prepends https:// to scheme-less inputs", () => {
    expect(normalizeUrl("example.org/path")).toBe("https://example.org/path")
  })
})

describe("extractUrls", () => {
  it("returns empty array when text has no URLs", () => {
    expect(extractUrls("Hello world, this is a plain message.")).toEqual([])
    expect(extractUrls("")).toEqual([])
  })

  it("extracts single and multiple URLs from text", () => {
    const text = "Check out https://github.com/muhammedaksam/waha-tui and http://waha.dev"
    expect(extractUrls(text)).toEqual([
      "https://github.com/muhammedaksam/waha-tui",
      "http://waha.dev",
    ])
  })

  it("extracts www. URLs and strips sentence punctuation", () => {
    const text = "Visit www.whatsapp.com. Have you seen https://google.com?"
    expect(extractUrls(text)).toEqual(["www.whatsapp.com", "https://google.com"])
  })

  it("extracts various protocols", () => {
    const text = "Download from ftp://files.test.com or git://repo.git"
    expect(extractUrls(text)).toEqual(["ftp://files.test.com", "git://repo.git"])
  })
})

describe("formatTextWithUrls", () => {
  it("returns plain text chunk when no URLs present", () => {
    const styled = formatTextWithUrls("Just plain text", WhatsAppTheme.textPrimary)
    expect(styled.chunks.length).toBe(1)
    expect(styled.chunks[0]?.text).toBe("Just plain text")
    expect(styled.chunks[0]?.link).toBeUndefined()
    expect(styled.chunks[0]?.attributes).toBe(0)
  })

  it("formats URLs with underline, green color, and OSC 8 hyperlink targets", () => {
    const text = "Visit https://example.com for more info"
    const styled = formatTextWithUrls(text, WhatsAppTheme.textPrimary, WhatsAppTheme.green)

    expect(styled.chunks.length).toBe(3)

    // Chunk 0: "Visit "
    expect(styled.chunks[0]?.text).toBe("Visit ")
    expect(styled.chunks[0]?.link).toBeUndefined()

    // Chunk 1: "https://example.com"
    expect(styled.chunks[1]?.text).toBe("https://example.com")
    expect(styled.chunks[1]?.attributes).toBe(TextAttributes.UNDERLINE)
    expect(styled.chunks[1]?.fg).toEqual(parseColor(WhatsAppTheme.green))
    expect(styled.chunks[1]?.link).toEqual({ url: "https://example.com" })

    // Chunk 2: " for more info"
    expect(styled.chunks[2]?.text).toBe(" for more info")
    expect(styled.chunks[2]?.link).toBeUndefined()
  })

  it("handles trailing punctuation properly without including it in the link", () => {
    const text = "See (https://example.com)."
    const styled = formatTextWithUrls(text)

    const urlChunk = styled.chunks.find((c) => c.text === "https://example.com")
    expect(urlChunk).toBeDefined()
    expect(urlChunk?.link).toEqual({ url: "https://example.com" })

    const trailingDot = styled.chunks.find((c) => c.text === ").")
    expect(trailingDot).toBeDefined()
    expect(trailingDot?.link).toBeUndefined()
  })

  describe("openUrl protocol validation", () => {
    it("returns false for invalid or unsupported protocol", async () => {
      expect(await openUrl("")).toBe(false)
      expect(await openUrl("javascript:alert(1)")).toBe(false)
      expect(await openUrl("file:///etc/passwd")).toBe(false)
    })
  })
})
