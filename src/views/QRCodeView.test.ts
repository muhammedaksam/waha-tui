import type { Renderable } from "@opentui/core"

import { createTestRenderer } from "@opentui/core/testing"
import { QRCodeRenderable } from "@opentui/qrcode"
import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import { appState } from "~/state/AppState"
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
    const view = QRCodeView()
    setup.renderer.root.add(view)
    await setup.renderOnce()

    const children = setup.renderer.root.getChildren()
    expect(children.length).toBeGreaterThan(0)
    setup.renderer.destroy()
  })

  it("should render QRCodeRenderable when qrCode is set", async () => {
    const setup = await createTestRenderer({ width: 120, height: 50 })
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
