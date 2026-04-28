/**
 * Tests for mediaLabels utility
 */

import { describe, expect, it } from "bun:test"

import type { WAMessageExtended } from "~/types"
import { formatFileSize, getMediaLabel, getMediaLabelFromReply } from "~/utils/mediaLabels"

// Helper to create a minimal WAMessageExtended for testing
function makeMessage(
  overrides: Partial<WAMessageExtended> & Record<string, unknown> = {}
): WAMessageExtended {
  return {
    id: "test-msg-1",
    timestamp: 1700000000,
    from: "123@c.us",
    to: "456@c.us",
    body: "",
    fromMe: false,
    hasMedia: false,
    ack: 0,
    ackName: "",
    ...overrides,
  } as WAMessageExtended
}

// ─── getMediaLabel ────────────────────────────────────────────────

describe("getMediaLabel", () => {
  it("returns hasMedia: false for plain text messages", () => {
    const msg = makeMessage({ body: "Hello world" })
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(false)
    expect(result.label).toBe("")
  })

  it("detects image type", () => {
    const msg = makeMessage({ type: "image" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("📷 Photo")
  })

  it("detects video type", () => {
    const msg = makeMessage({ type: "video" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("🎥 Video")
  })

  it("detects gif as video", () => {
    const msg = makeMessage({ type: "gif" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("🎥 Video")
  })

  it("detects audio type", () => {
    const msg = makeMessage({ type: "audio" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("🎵 Audio")
  })

  it("detects ptt (voice note) type", () => {
    const msg = makeMessage({ type: "ptt" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("🎤 Voice message")
  })

  it("detects document type with filename from _data", () => {
    const msg = makeMessage({
      type: "document",
      _data: { filename: "report.pdf" },
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("📎 Document: report.pdf")
  })

  it("detects document type without filename", () => {
    const msg = makeMessage({ type: "document" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("📎 Document")
  })

  it("detects sticker type", () => {
    const msg = makeMessage({ type: "sticker" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("🏷 Sticker")
  })

  it("detects location type", () => {
    const msg = makeMessage({ type: "location" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("📍 Location")
  })

  it("detects location with name", () => {
    const msg = makeMessage({
      type: "location",
      _data: { loc: "Central Park" },
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.label).toBe("📍 Location: Central Park")
  })

  it("detects vcard type with name", () => {
    const msg = makeMessage({
      type: "vcard",
      _data: { vcardFormattedName: "John Doe" },
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("👤 Contact: John Doe")
  })

  it("detects vcard type without name", () => {
    const msg = makeMessage({ type: "vcard" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.label).toBe("👤 Contact")
  })

  it("detects multi_vcard type with count", () => {
    const msg = makeMessage({
      type: "multi_vcard",
      _data: { vcardList: [{}, {}, {}] },
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.label).toBe("👤 3 Contacts")
  })

  it("detects call_log type", () => {
    const msg = makeMessage({ type: "call_log" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.label).toBe("📞 Call")
  })

  it("detects revoked type", () => {
    const msg = makeMessage({ type: "revoked" } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.label).toBe("🚫 This message was deleted")
  })

  it("extracts caption from _data.caption", () => {
    const msg = makeMessage({
      type: "image",
      _data: { caption: "Beautiful sunset" },
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.caption).toBe("Beautiful sunset")
  })

  it("uses body as caption for media messages", () => {
    const msg = makeMessage({
      type: "image",
      body: "Check this out!",
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.caption).toBe("Check this out!")
  })

  it("extracts file size from _data.size", () => {
    const msg = makeMessage({
      type: "document",
      _data: { size: 2500000, filename: "doc.pdf" },
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.fileSize).toBe("2.4 MB")
  })

  it("falls back to hasMedia flag with image mimetype", () => {
    const msg = makeMessage({
      hasMedia: true,
      mimetype: "image/jpeg",
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("📷 Photo")
  })

  it("falls back to hasMedia flag with video mimetype", () => {
    const msg = makeMessage({
      hasMedia: true,
      mimetype: "video/mp4",
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.label).toBe("🎥 Video")
  })

  it("falls back to hasMedia flag with audio mimetype", () => {
    const msg = makeMessage({
      hasMedia: true,
      mimetype: "audio/ogg",
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.label).toBe("🎵 Audio")
  })

  it("falls back to generic Media for unknown mimetype", () => {
    const msg = makeMessage({
      hasMedia: true,
      mimetype: "application/octet-stream",
    } as Record<string, unknown>)
    const result = getMediaLabel(msg)
    expect(result.label).toBe("📎 Media")
  })

  it("handles missing _data gracefully", () => {
    const msg = makeMessage({ type: "image" } as Record<string, unknown>)
    // Explicitly remove _data
    delete (msg as Record<string, unknown>)._data
    const result = getMediaLabel(msg)
    expect(result.hasMedia).toBe(true)
    expect(result.label).toBe("📷 Photo")
    expect(result.caption).toBeUndefined()
    expect(result.fileSize).toBeUndefined()
  })
})

// ─── getMediaLabelFromReply ───────────────────────────────────────

describe("getMediaLabelFromReply", () => {
  it("returns null for null replyTo", () => {
    expect(getMediaLabelFromReply(undefined)).toBeNull()
  })

  it("returns null for regular text reply", () => {
    const reply = { id: "r1", body: "Hello" }
    expect(getMediaLabelFromReply(reply)).toBeNull()
  })

  it("detects image type in reply", () => {
    const reply = { id: "r1", type: "image" } as Record<string, unknown>
    expect(getMediaLabelFromReply(reply as WAMessageExtended["replyTo"])).toBe("📷 Photo")
  })

  it("detects document type in reply", () => {
    const reply = { id: "r1", type: "document" } as Record<string, unknown>
    expect(getMediaLabelFromReply(reply as WAMessageExtended["replyTo"])).toBe("📎 Document")
  })

  it("detects ptt type in reply", () => {
    const reply = { id: "r1", type: "ptt" } as Record<string, unknown>
    expect(getMediaLabelFromReply(reply as WAMessageExtended["replyTo"])).toBe("🎤 Voice message")
  })

  it("falls back to hasMedia flag", () => {
    const reply = { id: "r1", hasMedia: true } as Record<string, unknown>
    expect(getMediaLabelFromReply(reply as WAMessageExtended["replyTo"])).toBe("📎 Media")
  })
})

// ─── formatFileSize ───────────────────────────────────────────────

describe("formatFileSize", () => {
  it("formats 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0 B")
  })

  it("formats bytes below 1 KB", () => {
    expect(formatFileSize(500)).toBe("500 B")
    expect(formatFileSize(1023)).toBe("1023 B")
  })

  it("formats exactly 1 KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB")
  })

  it("formats KB range", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB")
    expect(formatFileSize(10240)).toBe("10.0 KB")
  })

  it("formats exactly 1 MB", () => {
    expect(formatFileSize(1048576)).toBe("1.0 MB")
  })

  it("formats MB range", () => {
    expect(formatFileSize(2500000)).toBe("2.4 MB")
  })

  it("formats exactly 1 GB", () => {
    expect(formatFileSize(1073741824)).toBe("1.0 GB")
  })

  it("handles negative values", () => {
    expect(formatFileSize(-100)).toBe("0 B")
  })
})
