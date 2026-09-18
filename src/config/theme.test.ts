import { RGBA } from "@opentui/core"
import { describe, expect, it } from "bun:test"

import { applyThemeSettings, terminalSenderColors, theme, tint, WhatsAppTheme } from "./theme"

describe("theme store and tokens", () => {
  it("provides complete semantic tokens via theme.get()", () => {
    const tokens = theme.get()
    expect(tokens.colors).toBeDefined()
    expect(tokens.colors.background).toBeDefined()
    expect(tokens.colors.surface).toBeDefined()
    expect(tokens.colors.primary).toBeDefined()
    expect(tokens.glyphs.check).toBe("✓")
    expect(tokens.glyphs.radio).toBe("●")
    expect(tokens.glyphs.thumb).toBe("●")
    expect(tokens.glyphs.track).toBe("─")
    expect(tokens.borders.style).toBe("single")
    expect(tokens.density.paddingX).toBe(1)
  })

  it("tints two colors correctly", () => {
    const blended = tint("#000000", "#ffffff", 0.5)
    expect(blended).toBeInstanceOf(RGBA)
    expect(blended.r).toBeCloseTo(0.5, 1)
    expect(blended.g).toBeCloseTo(0.5, 1)
    expect(blended.b).toBeCloseTo(0.5, 1)
  })

  it("updates tokens and resolvedMode on theme.setMode", () => {
    theme.setActive("whatsapp")
    theme.setMode("dark")
    expect(theme.getResolvedMode()).toBe("dark")
    expect(theme.get().colors.background).toBe("#0b141a")

    theme.setMode("light")
    expect(theme.getResolvedMode()).toBe("light")
    expect(theme.get().colors.background).toBe("#f0f2f5")
  })

  it("switches to terminal theme with ANSI and default colors", () => {
    theme.setActive("terminal")
    const tokens = theme.get()
    expect(tokens.colors.background).toEqual(RGBA.defaultBackground())
    expect(tokens.colors.foreground).toEqual(RGBA.defaultForeground())
  })
})

describe("dynamic WhatsAppTheme export", () => {
  it("resolves WhatsApp dark colors when whatsapp theme and dark mode are active", () => {
    applyThemeSettings({ useSystemTheme: false, themeMode: "dark" })
    expect(WhatsAppTheme.background).toBe("#0b141a")
    expect(WhatsAppTheme.panelDark).toBe("#111b21")
    expect(WhatsAppTheme.panelLight).toBe("#202c33")
    expect(WhatsAppTheme.green).toBe("#00a884")
    expect(WhatsAppTheme.textPrimary).toBe("#e9edef")
  })

  it("resolves WhatsApp light colors when whatsapp theme and light mode are active", () => {
    applyThemeSettings({ useSystemTheme: false, themeMode: "light" })
    expect(WhatsAppTheme.background).toBe("#f0f2f5")
    expect(WhatsAppTheme.panelDark).toBe("#f0f2f5")
    expect(WhatsAppTheme.panelLight).toBe("#ffffff")
    expect(WhatsAppTheme.green).toBe("#008069")
    expect(WhatsAppTheme.textPrimary).toBe("#111b21")
  })

  it("resolves system terminal colors and sender colors when useSystemTheme is true", () => {
    applyThemeSettings({ useSystemTheme: true })
    expect(theme.getActive()).toBe("terminal")
    expect(WhatsAppTheme.background).toEqual(RGBA.defaultBackground())
    expect(WhatsAppTheme.deepDark).toEqual(RGBA.defaultBackground())
    expect(WhatsAppTheme.textPrimary).toEqual(RGBA.defaultForeground())
    expect(WhatsAppTheme.senderColors).toBe(terminalSenderColors)
  })

  it("follows terminal theme mode changes dynamically", () => {
    theme.setActive("whatsapp")
    theme.setMode("system")

    let currentListener: ((mode: "dark" | "light") => void) | undefined
    const mockRenderer = {
      themeMode: "dark" as const,
      on: (_event: "theme_mode", listener: (mode: "dark" | "light") => void) => {
        currentListener = listener
      },
      off: () => {
        currentListener = undefined
      },
    }

    const stopFollowing = theme.follow(mockRenderer)
    expect(theme.getResolvedMode()).toBe("dark")
    expect(WhatsAppTheme.background).toBe("#0b141a")

    // Terminal emits light mode
    currentListener?.("light")
    expect(theme.getResolvedMode()).toBe("light")
    expect(WhatsAppTheme.background).toBe("#f0f2f5")

    stopFollowing()
  })
})
