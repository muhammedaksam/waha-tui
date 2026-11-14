import { beforeEach, describe, expect, it } from "bun:test"

import type { WAMessageExtended } from "~/types"
import { WhatsAppTheme } from "~/config/theme"
import { appState } from "~/state/AppState"
import { getSenderInfo, resolveSenderDisplayName } from "~/views/conversation/MessageHelpers"

function createMockMessage(overrides: Partial<WAMessageExtended>): WAMessageExtended {
  return {
    id: "msg-1",
    timestamp: 1000,
    fromMe: false,
    from: "123@c.us",
    to: "456@c.us",
    body: "hello",
    hasMedia: false,
    ack: 1,
    source: "web",
    ...overrides,
  } as unknown as WAMessageExtended
}

describe("MessageHelpers", () => {
  beforeEach(() => {
    appState.reset()
  })

  describe("resolveSenderDisplayName", () => {
    it("should return empty string for empty senderId", () => {
      expect(resolveSenderDisplayName("")).toBe("")
    })

    describe("Saved contact", () => {
      it("should return the saved contact name for a phone number ID", () => {
        appState.setContactsCache(new Map([["447700900001@c.us", "Alice"]]))
        expect(resolveSenderDisplayName("447700900001@c.us")).toBe("Alice")
      })

      it("should return the saved contact name for a LID mapped to phone", () => {
        appState.setContactsCache(new Map([["447700900001@c.us", "Alice"]]))
        appState.addLidMappings([{ lid: "123456789012345@lid", pn: "447700900001@c.us" }])
        expect(resolveSenderDisplayName("123456789012345@lid")).toBe("Alice")
      })

      it("should prefer saved contact name over pushname", () => {
        appState.setContactsCache(new Map([["447700900001@c.us", "Alice Saved"]]))
        appState.setPushNamesCache(new Map([["447700900001@c.us", "Alice Push"]]))
        expect(resolveSenderDisplayName("447700900001@c.us", "Alice Inline")).toBe("Alice Saved")
      })
    })

    describe("Phone and pushname both known", () => {
      it("should show formatted phone and ~pushname for phone number ID", () => {
        appState.setPushNamesCache(new Map([["447700900001@c.us", "Alice"]]))
        expect(resolveSenderDisplayName("447700900001@c.us")).toBe("+44 770 090 0001 ~Alice")
      })

      it("should show formatted phone and ~pushname using inline pushname", () => {
        expect(resolveSenderDisplayName("447700900001@c.us", "Alice")).toBe(
          "+44 770 090 0001 ~Alice"
        )
      })

      it("should show formatted phone and ~pushname for LID mapped to phone", () => {
        appState.addLidMappings([{ lid: "123456789012345@lid", pn: "447700900001@c.us" }])
        appState.setPushNamesCache(new Map([["447700900001@c.us", "Alice"]]))
        expect(resolveSenderDisplayName("123456789012345@lid")).toBe("+44 770 090 0001 ~Alice")
      })

      it("should not duplicate tilde if pushname already starts with ~", () => {
        expect(resolveSenderDisplayName("447700900001@c.us", "~Alice")).toBe(
          "+44 770 090 0001 ~Alice"
        )
      })
    })

    describe("Only the pushname known", () => {
      it("should show ~pushname for LID without phone mapping", () => {
        appState.setPushNamesCache(new Map([["123456789012345@lid", "Alice"]]))
        expect(resolveSenderDisplayName("123456789012345@lid")).toBe("~Alice")
      })

      it("should show ~pushname for LID using inline pushname", () => {
        expect(resolveSenderDisplayName("123456789012345@lid", "Alice")).toBe("~Alice")
      })

      it("should not duplicate tilde if inline pushname already has ~", () => {
        expect(resolveSenderDisplayName("123456789012345@lid", "~Alice")).toBe("~Alice")
      })
    })

    describe("Only the phone known", () => {
      it("should show formatted phone number for phone number ID", () => {
        expect(resolveSenderDisplayName("447700900001@c.us")).toBe("+44 770 090 0001")
      })

      it("should show formatted phone number from getPhoneFromLid for LID", () => {
        appState.addLidMappings([{ lid: "123456789012345@lid", pn: "447700900001@c.us" }])
        expect(resolveSenderDisplayName("123456789012345@lid")).toBe("+44 770 090 0001")
      })
    })

    describe("LID digits fallback", () => {
      it("should fallback to LID digits when phone and pushname are both unknown", () => {
        expect(resolveSenderDisplayName("123456789012345@lid")).toBe("123456789012345")
      })
    })
  })

  describe("getSenderInfo", () => {
    it("should return 'You' when message is from me", () => {
      const msg = createMockMessage({
        fromMe: true,
      })
      const info = getSenderInfo(msg, false)
      expect(info.senderName).toBe("You")
      expect(info.senderColor).toBe(WhatsAppTheme.green)
    })

    describe("in group chat", () => {
      it("should resolve saved contact name from message.participant", () => {
        appState.setContactsCache(new Map([["447700900001@c.us", "Alice"]]))
        const msg = createMockMessage({
          fromMe: false,
          from: "12036302482939@g.us",
          participant: "447700900001@c.us",
        })
        const info = getSenderInfo(msg, true)
        expect(info.senderId).toBe("447700900001@c.us")
        expect(info.senderName).toBe("Alice")
      })

      it("should resolve phone and pushname from _data.notifyName", () => {
        const msg = createMockMessage({
          fromMe: false,
          from: "12036302482939@g.us",
          participant: "447700900001@c.us",
          _data: { notifyName: "Alice" },
        })
        const info = getSenderInfo(msg, true)
        expect(info.senderName).toBe("+44 770 090 0001 ~Alice")
      })

      it("should resolve phone and pushname from _data.pushName", () => {
        const msg = createMockMessage({
          fromMe: false,
          from: "12036302482939@g.us",
          participant: "447700900001@c.us",
          _data: { pushName: "Alice" },
        })
        const info = getSenderInfo(msg, true)
        expect(info.senderName).toBe("+44 770 090 0001 ~Alice")
      })

      it("should resolve phone and pushname from appState.getPushName", () => {
        appState.setPushNamesCache(new Map([["447700900001@c.us", "Alice"]]))
        const msg = createMockMessage({
          fromMe: false,
          from: "12036302482939@g.us",
          participant: "447700900001@c.us",
        })
        const info = getSenderInfo(msg, true)
        expect(info.senderName).toBe("+44 770 090 0001 ~Alice")
      })

      it("should resolve only pushname for unmapped LID participant", () => {
        const msg = createMockMessage({
          fromMe: false,
          from: "12036302482939@g.us",
          participant: "123456789012345@lid",
          _data: { notifyName: "Alice" },
        })
        const info = getSenderInfo(msg, true)
        expect(info.senderName).toBe("~Alice")
      })

      it("should resolve only phone when no pushname is available", () => {
        const msg = createMockMessage({
          fromMe: false,
          from: "12036302482939@g.us",
          participant: "447700900001@c.us",
        })
        const info = getSenderInfo(msg, true)
        expect(info.senderName).toBe("+44 770 090 0001")
      })

      it("should fallback to LID digits for unmapped LID with no pushname", () => {
        const msg = createMockMessage({
          fromMe: false,
          from: "12036302482939@g.us",
          participant: "123456789012345@lid",
        })
        const info = getSenderInfo(msg, true)
        expect(info.senderName).toBe("123456789012345")
      })
    })

    describe("in 1:1 chat", () => {
      it("should resolve saved contact name from message.from", () => {
        appState.setContactsCache(new Map([["447700900001@c.us", "Alice"]]))
        const msg = createMockMessage({
          fromMe: false,
          from: "447700900001@c.us",
        })
        const info = getSenderInfo(msg, false)
        expect(info.senderName).toBe("Alice")
      })

      it("should resolve phone and pushname from message.from and pushNamesCache", () => {
        appState.setPushNamesCache(new Map([["447700900001@c.us", "Alice"]]))
        const msg = createMockMessage({
          fromMe: false,
          from: "447700900001@c.us",
        })
        const info = getSenderInfo(msg, false)
        expect(info.senderName).toBe("+44 770 090 0001 ~Alice")
      })
    })
  })
})
