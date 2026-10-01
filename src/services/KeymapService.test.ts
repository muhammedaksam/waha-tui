import type { MockInput, TestRenderer } from "@opentui/core/testing"

import { KeyEvent } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import {
  destroyKeymap,
  getKonamiProgress,
  initKeymap,
  isDialogOpen,
  isSnakeGameActive,
  KONAMI_CODE_SEQUENCE,
  processKonamiStroke,
  resetKonamiProgress,
  setSnakeGameHandler,
} from "~/services/KeymapService"
import { appState } from "~/state/AppState"

describe("KeymapService", () => {
  let renderer: TestRenderer
  let mockInput: MockInput

  beforeEach(async () => {
    destroyKeymap()
    resetKonamiProgress()
    appState.setInputMode(false)
    appState.setCurrentView("sessions")
    appState.setSettingsPage("main")
    appState.setSettingsSelectedIndex(0)
    appState.setSettingsSubIndex(0)
    appState.setAuthMode("qr")
    appState.setPhoneNumber("")

    const setup = await createTestRenderer({ width: 80, height: 24, kittyKeyboard: true })
    renderer = setup.renderer
    mockInput = setup.mockInput
  })

  afterEach(() => {
    destroyKeymap()
    resetKonamiProgress()
    renderer?.destroy()
  })

  function pressStroke(
    stroke: string,
    options?: { ctrl?: boolean; shift?: boolean; meta?: boolean }
  ) {
    if (stroke === "up" || stroke === "down" || stroke === "left" || stroke === "right") {
      mockInput.pressArrow(stroke, options)
    } else if (stroke === "escape") {
      mockInput.pressEscape(options)
    } else if (stroke === "enter" || stroke === "return") {
      mockInput.pressEnter(options)
    } else if (stroke === "tab") {
      mockInput.pressTab(options)
    } else if (stroke === "backspace") {
      mockInput.pressBackspace(options)
    } else if (stroke === "home") {
      mockInput.pressKey("HOME", options)
    } else if (stroke === "end") {
      mockInput.pressKey("END", options)
    } else if (stroke === "space") {
      mockInput.pressKey(" ", options)
    } else {
      mockInput.pressKey(stroke, options)
    }
  }

  it("should initialize keymap and register all layers and commands", () => {
    const keymap = initKeymap(renderer)
    expect(keymap).toBeDefined()

    const commands = keymap.getCommands({ visibility: "registered" })
    const commandNames = commands.map((c) => c.name)

    // Global
    expect(commandNames).toContain("app.quit")
    expect(commandNames).toContain("nav.sessions")
    expect(commandNames).toContain("nav.chats")
    expect(commandNames).toContain("easter-egg.konami")

    // Context Menu
    expect(commandNames).toContain("context-menu.up")
    expect(commandNames).toContain("context-menu.down")
    expect(commandNames).toContain("context-menu.left")
    expect(commandNames).toContain("context-menu.right")
    expect(commandNames).toContain("context-menu.select")
    expect(commandNames).toContain("context-menu.close")

    // Dialog
    expect(commandNames).toContain("dialog.nav-next")
    expect(commandNames).toContain("dialog.nav-prev")
    expect(commandNames).toContain("dialog.select")
    expect(commandNames).toContain("dialog.close")

    // Settings
    expect(commandNames).toContain("settings.nav-up")
    expect(commandNames).toContain("settings.nav-down")
    expect(commandNames).toContain("settings.select")
    expect(commandNames).toContain("settings.toggle")
    expect(commandNames).toContain("settings.escape")

    // QR
    expect(commandNames).toContain("qr.toggle-auth")
    expect(commandNames).toContain("qr.quit")
    expect(commandNames).toContain("qr.phone-backspace")
    expect(commandNames).toContain("qr.phone-submit")
    expect(commandNames).toContain("qr.phone-cancel")

    // Sessions
    expect(commandNames).toContain("sessions.nav-up")
    expect(commandNames).toContain("sessions.nav-down")
    expect(commandNames).toContain("sessions.home")
    expect(commandNames).toContain("sessions.end")
    expect(commandNames).toContain("sessions.select")
    expect(commandNames).toContain("sessions.new")
    expect(commandNames).toContain("sessions.delete")
    expect(commandNames).toContain("sessions.refresh")

    // Chats
    expect(commandNames).toContain("chats.filter-next")
    expect(commandNames).toContain("chats.filter-prev")
    expect(commandNames).toContain("chats.search")
    expect(commandNames).toContain("chats.context-menu")
    expect(commandNames).toContain("chats.settings")
    expect(commandNames).toContain("chats.new-chat")
    expect(commandNames).toContain("chats.nav-up")
    expect(commandNames).toContain("chats.nav-down")
    expect(commandNames).toContain("chats.select")
    expect(commandNames).toContain("chats.home")
    expect(commandNames).toContain("chats.end")
    expect(commandNames).toContain("chats.page-up")
    expect(commandNames).toContain("chats.page-down")
    expect(commandNames).toContain("chats.escape")
    expect(commandNames).toContain("chats.toggle-archived")
    expect(commandNames).toContain("chats.refresh")

    // Conversation
    expect(commandNames).toContain("conversation.search-next")
    expect(commandNames).toContain("conversation.search-prev")
    expect(commandNames).toContain("conversation.context-menu")
    expect(commandNames).toContain("conversation.open-media")
    expect(commandNames).toContain("conversation.attach-media")
    expect(commandNames).toContain("conversation.emoji")
    expect(commandNames).toContain("conversation.poll")
    expect(commandNames).toContain("conversation.toggle-selection")
    expect(commandNames).toContain("conversation.bulk-delete")
    expect(commandNames).toContain("conversation.bulk-forward")
    expect(commandNames).toContain("conversation.bulk-star")
    expect(commandNames).toContain("conversation.scroll-up")
    expect(commandNames).toContain("conversation.scroll-down")
    expect(commandNames).toContain("conversation.page-up")
    expect(commandNames).toContain("conversation.page-down")
    expect(commandNames).toContain("conversation.input-mode")
    expect(commandNames).toContain("conversation.search")
    expect(commandNames).toContain("conversation.escape")
  })

  it("should track Konami Code progress sequentially and trigger easter egg on completion", () => {
    initKeymap(renderer)
    let easterEggTriggered = false

    mock.restore()
    mock.module("~/components/EasterEggModal", () => ({
      showEasterEggModal: () => {
        easterEggTriggered = true
      },
    }))

    expect(getKonamiProgress()).toBe(0)

    // Send the first 9 keys
    for (let i = 0; i < KONAMI_CODE_SEQUENCE.length - 1; i++) {
      pressStroke(KONAMI_CODE_SEQUENCE[i]!)
      expect(getKonamiProgress()).toBe(i + 1)
      expect(easterEggTriggered).toBe(false)
    }

    // Send the final key ('a')
    pressStroke("a")

    expect(getKonamiProgress()).toBe(0)
    expect(easterEggTriggered).toBe(true)
  })

  it("should reset Konami Code progress on invalid key", () => {
    initKeymap(renderer)

    pressStroke("up")
    expect(getKonamiProgress()).toBe(1)
    pressStroke("up")
    expect(getKonamiProgress()).toBe(2)

    // Invalid key breaks the sequence
    pressStroke("x")
    expect(getKonamiProgress()).toBe(0)
  })

  it("should restart Konami Code progress if invalid key is 'up'", () => {
    initKeymap(renderer)

    pressStroke("up")
    expect(getKonamiProgress()).toBe(1)
    pressStroke("up")
    expect(getKonamiProgress()).toBe(2)
    pressStroke("down")
    expect(getKonamiProgress()).toBe(3)

    // Pressing 'up' restarts from 1
    pressStroke("up")
    expect(getKonamiProgress()).toBe(1)
  })

  it("should ignore Konami Code when inputMode is active", () => {
    initKeymap(renderer)
    appState.setInputMode(true)

    pressStroke("up")
    expect(getKonamiProgress()).toBe(0)
  })

  it("should reset progress when modifier keys are pressed", () => {
    initKeymap(renderer)

    pressStroke("up")
    expect(getKonamiProgress()).toBe(1)

    // Ctrl+Up resets
    pressStroke("up", { ctrl: true })
    expect(getKonamiProgress()).toBe(0)
  })

  it("should handle settings view navigation and escape", () => {
    initKeymap(renderer)
    appState.setCurrentView("settings")
    appState.setSettingsPage("main")
    appState.setSettingsSelectedIndex(0)

    // Navigate down with 'j'
    pressStroke("j")
    expect(appState.getState().settingsSelectedIndex).toBe(1)

    // Navigate up with 'k'
    pressStroke("k")
    expect(appState.getState().settingsSelectedIndex).toBe(0)

    // Escape exits settings back to chats view
    pressStroke("escape")
    expect(appState.getState().currentView).toBe("chats")
  })

  it("should handle settings view toggle on subpage", () => {
    initKeymap(renderer)
    appState.setCurrentView("settings")
    appState.setSettingsPage("chats")
    appState.setSettingsSubIndex(0)
    appState.setEnterIsSend(false)

    // Press enter to toggle enterIsSend
    pressStroke("enter")
    expect(appState.getState().enterIsSend).toBe(true)

    // Press space to toggle again
    pressStroke("space")
    expect(appState.getState().enterIsSend).toBe(false)
  })

  it("should handle QR view mode toggle and phone digits", () => {
    initKeymap(renderer)
    appState.setCurrentView("qr")
    appState.setAuthMode("qr")

    // 'p' switches to phone pairing mode
    pressStroke("p")
    expect(appState.getState().authMode).toBe("phone")

    // Typing numbers inputs phone digits
    pressStroke("1")
    pressStroke("2")
    pressStroke("3")
    expect(appState.getState().phoneNumber).toBe("123")

    // Backspace deletes a digit
    pressStroke("backspace")
    expect(appState.getState().phoneNumber).toBe("12")

    // Escape exits phone mode back to QR
    pressStroke("escape")
    expect(appState.getState().authMode).toBe("qr")
  })

  it("should handle sessions view navigation", () => {
    initKeymap(renderer)
    appState.setCurrentView("sessions")
    appState.setSessions([
      { name: "sess-1", status: "WORKING" },
      { name: "sess-2", status: "WORKING" },
      { name: "sess-3", status: "WORKING" },
    ] as never)
    appState.setSelectedSessionIndex(0)

    // Navigate down
    pressStroke("down")
    expect(appState.getState().selectedSessionIndex).toBe(1)

    // Jump to end
    pressStroke("end")
    expect(appState.getState().selectedSessionIndex).toBe(2)

    // Jump to home
    pressStroke("home")
    expect(appState.getState().selectedSessionIndex).toBe(0)
  })

  it("should handle chats view filter cycling and settings navigation", () => {
    initKeymap(renderer)
    appState.setCurrentView("chats")
    appState.setActiveFilter("all")

    // Tab cycles to unread
    pressStroke("tab")
    expect(appState.getState().activeFilter).toBe("unread")

    // 's' opens settings
    pressStroke("s")
    expect(appState.getState().currentView).toBe("settings")
    expect(appState.getState().settingsPage).toBe("main")
  })

  it("should consume stroke on completion in processKonamiStroke", () => {
    const keymap = initKeymap(renderer)
    let consumed = false
    let commandRun = false

    mock.restore()
    mock.module("~/components/EasterEggModal", () => ({
      showEasterEggModal: () => {
        commandRun = true
      },
    }))

    const makeEvent = (name: string): KeyEvent =>
      new KeyEvent({
        name,
        ctrl: false,
        meta: false,
        shift: false,
        option: false,
        sequence: "",
        number: false,
        raw: "",
        eventType: "press",
        source: "raw",
      })

    // Run first 9 strokes
    for (let i = 0; i < KONAMI_CODE_SEQUENCE.length - 1; i++) {
      const completed = processKonamiStroke(
        makeEvent(KONAMI_CODE_SEQUENCE[i]!),
        () => {
          consumed = true
        },
        keymap
      )
      expect(completed).toBe(false)
      expect(consumed).toBe(false)
    }

    // Run 10th stroke
    const completed = processKonamiStroke(
      makeEvent("a"),
      () => {
        consumed = true
      },
      keymap
    )

    expect(completed).toBe(true)
    expect(consumed).toBe(true)
    expect(commandRun).toBe(true)
  })

  it("should intercept keys when snake game handler is active", () => {
    initKeymap(renderer)
    expect(isSnakeGameActive()).toBe(false)

    const interceptedKeys: string[] = []
    setSnakeGameHandler((key) => {
      interceptedKeys.push(key)
      return key === "up" || key === "w"
    })

    expect(isSnakeGameActive()).toBe(true)

    pressStroke("up")
    expect(interceptedKeys).toContain("up")

    pressStroke("w")
    expect(interceptedKeys).toContain("w")

    setSnakeGameHandler(null)
    expect(isSnakeGameActive()).toBe(false)
  })

  it("should bind navigation and select commands in dialog layer", () => {
    const keymap = initKeymap(renderer)
    const commands = keymap.getCommands({ visibility: "registered" })

    const nextCmd = commands.find((c) => c.name === "dialog.nav-next")
    const prevCmd = commands.find((c) => c.name === "dialog.nav-prev")
    const selectCmd = commands.find((c) => c.name === "dialog.select")
    const closeCmd = commands.find((c) => c.name === "dialog.close")

    expect(nextCmd).toBeDefined()
    expect(prevCmd).toBeDefined()
    expect(selectCmd).toBeDefined()
    expect(closeCmd).toBeDefined()

    // Test execution runs without errors
    expect(() => keymap.runCommand("dialog.nav-next")).not.toThrow()
    expect(() => keymap.runCommand("dialog.nav-prev")).not.toThrow()
    expect(() => keymap.runCommand("dialog.select")).not.toThrow()
    expect(() => keymap.runCommand("dialog.close")).not.toThrow()
  })

  it("should return dialog open state from isDialogOpen", () => {
    expect(isDialogOpen()).toBe(false)
  })
})
