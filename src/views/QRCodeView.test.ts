import type { Renderable } from "@opentui/core"

import { createTestRenderer } from "@opentui/core/testing"
import { ErrorCorrectionLevel, QRCode, QRCodeRenderable } from "@opentui/qrcode"
import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import { appState } from "~/state/AppState"
import { setRenderer } from "~/state/RendererContext"
import {
  handlePhoneBackspace,
  handlePhoneInput,
  QRCodeView,
  stopQRRefresh,
  toggleAuthMode,
} from "~/views/QRCodeView"

describe("QRCodeView", () => {
  beforeEach(() => {
    appState.setAuthMode("qr")
    appState.setPhoneNumber("")
    appState.setPairingCode(null)
    appState.setPairingStatus("idle")
    appState.setPairingError(null)
    appState.setQrCode(null)
  })

  afterEach(() => {
    stopQRRefresh()
  })

  it("should render loading state when qrCode is null", async () => {
    const setup = await createTestRenderer({ width: 100, height: 40 })
    setRenderer(setup.renderer)
    const view = QRCodeView()
    setup.renderer.root.add(view)
    await setup.renderOnce()

    const children = setup.renderer.root.getChildren()
    expect(children.length).toBeGreaterThan(0)
    setup.renderer.destroy()
  })

  it("should render QRCodeRenderable when qrCode is set", async () => {
    const setup = await createTestRenderer({ width: 120, height: 50 })
    setRenderer(setup.renderer)
    appState.setQrCode("2@testqrcodecontentfromwaha")

    const view = QRCodeView()
    setup.renderer.root.add(view)
    await setup.renderOnce()

    // Verify QRCodeRenderable is instantiated in the tree
    const qrs: QRCodeRenderable[] = []
    const walk = (node: Renderable) => {
      if (node instanceof QRCodeRenderable) {
        qrs.push(node)
      }
      for (const child of node.getChildren()) {
        walk(child)
      }
    }
    walk(setup.renderer.root)

    expect(qrs.length).toBe(1)
    expect(qrs[0]!.content).toBe("2@testqrcodecontentfromwaha")

    setup.renderer.destroy()
  })

  it("regression Issue #108: should render version 11 QR code at 103x43 without fallback", async () => {
    const setup = await createTestRenderer({ width: 103, height: 43 })
    setRenderer(setup.renderer)

    // Build payload that requires version 11 (61 modules + 8 quiet zone = 69 cols wide, 35 rows tall)
    let version11Payload = "2@"
    while (QRCode.encodeText(version11Payload, ErrorCorrectionLevel.M).version < 11) {
      version11Payload += "A1b2C3d4E5f6G7h8"
    }

    appState.setQrCode(version11Payload)

    const view = QRCodeView()
    setup.renderer.root.add(view)
    await setup.renderOnce()

    const qrs: QRCodeRenderable[] = []
    const walk = (node: Renderable) => {
      if (node instanceof QRCodeRenderable) {
        qrs.push(node)
      }
      for (const child of node.getChildren()) {
        walk(child)
      }
    }
    walk(setup.renderer.root)

    expect(qrs.length).toBe(1)
    expect(qrs[0]!.width).toBe(69)
    expect(qrs[0]!.height).toBe(35)

    const frame = setup.captureCharFrame()
    expect(frame).not.toContain("Terminal too small for QR")
    expect(frame).toContain("Steps to log in")
    expect(frame).toContain("WhatsApp Web Login")

    setup.renderer.destroy()
  })

  it("should render large layout with branding and encryption footer at 120x50", async () => {
    const setup = await createTestRenderer({ width: 120, height: 50 })
    setRenderer(setup.renderer)
    appState.setQrCode("2@standardqrcodepayload")

    const view = QRCodeView()
    setup.renderer.root.add(view)
    await setup.renderOnce()

    const frame = setup.captureCharFrame()
    expect(frame).not.toContain("Terminal too small for QR")
    expect(frame).toContain("Your personal messages are end-to-end encrypted")

    setup.renderer.destroy()
  })

  it("should render narrow stacked layout at 85x42 without fallback", async () => {
    const setup = await createTestRenderer({ width: 85, height: 42 })
    setRenderer(setup.renderer)
    appState.setQrCode("2@testqrcodepayload")

    const view = QRCodeView()
    setup.renderer.root.add(view)
    await setup.renderOnce()

    const frame = setup.captureCharFrame()
    expect(frame).not.toContain("Terminal too small for QR")
    expect(frame).toContain("Open WhatsApp > Linked devices > Link a device")

    setup.renderer.destroy()
  })

  it("should render informative fallback message when terminal is too small (80x24)", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 })
    setRenderer(setup.renderer)
    appState.setQrCode("2@testqrcodepayload")

    const view = QRCodeView()
    setup.renderer.root.add(view)
    await setup.renderOnce()

    const frame = setup.captureCharFrame()
    expect(frame).toContain("Terminal too small for QR code")
    expect(frame).toContain("Requires at least 72x39")
    expect(frame).toContain("current: 80x24")

    setup.renderer.destroy()
  })

  it("should support auth mode toggle and phone input", () => {
    expect(appState.getState().authMode).toBe("qr")

    toggleAuthMode()
    expect(appState.getState().authMode).toBe("phone")

    handlePhoneInput("1")
    handlePhoneInput("2")
    handlePhoneInput("3")
    handlePhoneInput("a") // should be ignored
    expect(appState.getState().phoneNumber).toBe("123")

    handlePhoneBackspace()
    expect(appState.getState().phoneNumber).toBe("12")

    toggleAuthMode()
    expect(appState.getState().authMode).toBe("qr")
  })
})
