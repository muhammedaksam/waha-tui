/**
 * Modal Component
 * WhatsApp-themed dialogs using @opentui-ui/dialog
 */

import type { DialogContainerOptions, DialogId, DialogStyle } from "@opentui-ui/dialog"
import type { RenderContext } from "@opentui/core"

import {
  BoxRenderable,
  fg,
  InputRenderable,
  InputRenderableEvents,
  KeyEvent,
  link,
  t,
  TextAttributes,
  TextRenderable,
  underline,
} from "@opentui/core"

import type { UpdateInfo } from "~/utils/update-checker"
import { logoutSession } from "~/client"
import { WDSColors, WhatsAppTheme } from "~/config/theme"
import { getDialogManager } from "~/router"
import { appState } from "~/state/AppState"
import { getRenderer } from "~/state/RendererContext"
import { getInitials } from "~/utils/formatters"

/**
 * WhatsApp-themed dialog container configuration
 */
export const WHATSAPP_DIALOG_CONFIG: Partial<DialogContainerOptions> = {
  size: "medium",
  closeOnEscape: true,
  dialogOptions: {
    style: {
      backgroundColor: WhatsAppTheme.panelDark,
      borderColor: WhatsAppTheme.borderColor,
      border: true,
      borderStyle: "rounded",
      padding: 1,
    } as DialogStyle,
  },
  sizePresets: {
    small: 50,
    medium: 70,
    large: 100,
  },
}

/**
 * Button styling based on variant
 */
function getButtonStyle(variant?: "primary" | "secondary" | "danger") {
  switch (variant) {
    case "danger":
      return { bg: WDSColors.red[500], fg: WhatsAppTheme.white }
    case "primary":
      return { bg: WhatsAppTheme.green, fg: WhatsAppTheme.white }
    case "secondary":
    default:
      return { bg: "transparent", fg: WhatsAppTheme.textPrimary }
  }
}

/**
 * Show logout confirmation dialog
 * Returns a promise that resolves to true if user confirms, false if cancelled
 */
export function showLogoutConfirm(): Promise<boolean> {
  const dialogManager = getDialogManager()

  return new Promise((resolve) => {
    const dialogId = dialogManager.show({
      content: (ctx: RenderContext) => {
        const box = new BoxRenderable(ctx, {
          flexDirection: "column",
        })

        // Title
        box.add(
          new TextRenderable(ctx, {
            content: "Log out?",
            fg: WhatsAppTheme.textPrimary,
            attributes: TextAttributes.BOLD,
          })
        )

        // Spacer
        box.add(new BoxRenderable(ctx, { height: 1 }))

        // Message
        box.add(
          new TextRenderable(ctx, {
            content: "You will be logged out of this WhatsApp session.",
            fg: WhatsAppTheme.textSecondary,
          })
        )

        // Spacer
        box.add(new BoxRenderable(ctx, { height: 1 }))

        // Button row
        const buttonRow = new BoxRenderable(ctx, {
          flexDirection: "row",
          justifyContent: "flex-end",
        })

        // Cancel button
        const cancelStyle = getButtonStyle("secondary")
        const cancelBtn = new BoxRenderable(ctx, {
          paddingLeft: 2,
          paddingRight: 2,
          height: 1,
          backgroundColor: cancelStyle.bg,
          justifyContent: "center",
          alignItems: "center",
          onMouse(event) {
            if (event.type === "down" && event.button === 0) {
              dialogManager.close(dialogId)
              resolve(false)
              event.stopPropagation()
            }
          },
        })
        cancelBtn.add(new TextRenderable(ctx, { content: "Cancel", fg: cancelStyle.fg }))
        buttonRow.add(cancelBtn)

        // Logout button
        const logoutStyle = getButtonStyle("danger")
        const logoutBtn = new BoxRenderable(ctx, {
          paddingLeft: 2,
          paddingRight: 2,
          height: 1,
          marginLeft: 2,
          backgroundColor: logoutStyle.bg,
          justifyContent: "center",
          alignItems: "center",
          onMouse(event) {
            if (event.type === "down" && event.button === 0) {
              dialogManager.close(dialogId)
              resolve(true)
              event.stopPropagation()
            }
          },
        })
        logoutBtn.add(new TextRenderable(ctx, { content: "Log out", fg: logoutStyle.fg }))
        buttonRow.add(logoutBtn)

        box.add(buttonRow)
        return box
      },
      size: "small",
      onClose: () => resolve(false),
    })
  })
}

/**
 * Handle logout confirmation result
 */
export async function handleLogoutConfirm(): Promise<void> {
  const confirmed = await showLogoutConfirm()
  if (confirmed) {
    await logoutSession()
    appState.setCurrentView("sessions")
  }
}

/**
 * Show update available modal
 */
export function showUpdateModal(updateInfo: UpdateInfo): void {
  const dialogManager = getDialogManager()
  const command = "bun install -g @muhammedaksam/waha-tui"

  dialogManager.show({
    content: (ctx: RenderContext) => {
      const wrapper = new BoxRenderable(ctx, {
        flexDirection: "column",
      })

      // Title
      wrapper.add(
        new TextRenderable(ctx, {
          content: "Update Available!",
          fg: WhatsAppTheme.textPrimary,
          attributes: TextAttributes.BOLD,
        })
      )

      // Spacer
      wrapper.add(new BoxRenderable(ctx, { height: 1 }))

      // Subtitle
      wrapper.add(
        new TextRenderable(ctx, {
          content: "A new version of waha-tui is available.",
          fg: WhatsAppTheme.textSecondary,
        })
      )

      // Spacer
      wrapper.add(new BoxRenderable(ctx, { height: 1 }))

      // Version Box
      const versionBox = new BoxRenderable(ctx, { flexDirection: "column" })

      // Current version
      const currentRow = new BoxRenderable(ctx, { flexDirection: "row" })
      currentRow.add(
        new TextRenderable(ctx, { content: "Current: ", fg: WhatsAppTheme.textSecondary, width: 9 })
      )
      currentRow.add(
        new TextRenderable(ctx, {
          content: `v${updateInfo.currentVersion.replace(/^v/, "")}`,
          fg: WhatsAppTheme.textSecondary,
        })
      )
      versionBox.add(currentRow)

      // Latest version with highlight
      const latestRow = new BoxRenderable(ctx, { flexDirection: "row" })
      latestRow.add(
        new TextRenderable(ctx, { content: "Latest:  ", fg: WhatsAppTheme.textSecondary, width: 9 })
      )
      latestRow.add(
        new TextRenderable(ctx, {
          content: `v${updateInfo.latestVersion.replace(/^v/, "")}`,
          fg: WhatsAppTheme.green,
          attributes: TextAttributes.BOLD,
        })
      )
      versionBox.add(latestRow)

      wrapper.add(versionBox)

      // Command Box
      wrapper.add(new BoxRenderable(ctx, { height: 1 }))
      const commandRow = new BoxRenderable(ctx, { flexDirection: "row" })
      commandRow.add(new TextRenderable(ctx, { content: "Run ", fg: WhatsAppTheme.textSecondary }))
      commandRow.add(
        new TextRenderable(ctx, {
          content: `'${command}'`,
          fg: WhatsAppTheme.textPrimary,
          attributes: TextAttributes.BOLD,
        })
      )
      commandRow.add(
        new TextRenderable(ctx, { content: " to update.", fg: WhatsAppTheme.textSecondary })
      )
      wrapper.add(commandRow)

      // Release Notes (if available)
      if (updateInfo.releaseNotes) {
        wrapper.add(new BoxRenderable(ctx, { height: 1 }))

        const notesBox = new BoxRenderable(ctx, {
          flexDirection: "column",
          padding: 1,
          backgroundColor: WhatsAppTheme.background,
        })

        const rawNotes = updateInfo.releaseNotes.replace(/\r/g, "")
        const lines = rawNotes.split("\n")
        const maxLines = 12
        let renderedLines = 0

        for (const line of lines) {
          if (renderedLines >= maxLines) {
            notesBox.add(
              new TextRenderable(ctx, {
                content: "... (more on GitHub)",
                fg: WhatsAppTheme.textTertiary,
              })
            )
            break
          }

          const trimmed = line.trim()
          if (!trimmed) {
            if (renderedLines > 0) {
              notesBox.add(new BoxRenderable(ctx, { height: 1 }))
              renderedLines++
            }
            continue
          }

          if (trimmed.startsWith("#")) {
            const content = trimmed.replace(/^#+\s*/, "")
            notesBox.add(
              new TextRenderable(ctx, {
                content,
                fg: WhatsAppTheme.textSecondary,
                attributes: TextAttributes.BOLD,
              })
            )
          } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
            notesBox.add(
              new TextRenderable(ctx, {
                content: `• ${trimmed.substring(2)}`,
                fg: WhatsAppTheme.textTertiary,
              })
            )
            renderedLines++
          } else {
            notesBox.add(
              new TextRenderable(ctx, {
                content: trimmed.replace(/\*\*/g, ""),
                fg: WhatsAppTheme.textSecondary,
              })
            )
            renderedLines++
          }
        }

        wrapper.add(notesBox)
      }

      // Buttons row
      wrapper.add(new BoxRenderable(ctx, { height: 1 }))
      const buttonRow = new BoxRenderable(ctx, {
        flexDirection: "row",
        justifyContent: "flex-end",
      })

      // GitHub button - clickable link using OSC 8
      const githubStyle = getButtonStyle("secondary")
      const githubBtn = new BoxRenderable(ctx, {
        paddingLeft: 2,
        paddingRight: 2,
        height: 1,
        backgroundColor: githubStyle.bg,
        justifyContent: "center",
        alignItems: "center",
      })
      githubBtn.add(
        new TextRenderable(ctx, {
          content: t`${link(updateInfo.releaseUrl)(underline(fg(WhatsAppTheme.textPrimary)("GitHub Release")))}`,
        })
      )
      buttonRow.add(githubBtn)

      // OK button
      const okStyle = getButtonStyle("primary")
      const okBtn = new BoxRenderable(ctx, {
        paddingLeft: 2,
        paddingRight: 2,
        height: 1,
        marginLeft: 2,
        backgroundColor: okStyle.bg,
        justifyContent: "center",
        alignItems: "center",
        onMouse(event) {
          if (event.type === "down" && event.button === 0) {
            dialogManager.closeAll()
            appState.dismissUpdateModal()
            event.stopPropagation()
          }
        },
      })
      okBtn.add(new TextRenderable(ctx, { content: "OK", fg: okStyle.fg }))
      buttonRow.add(okBtn)

      wrapper.add(buttonRow)

      return wrapper
    },
    size: "large",
    onClose: () => {
      appState.dismissUpdateModal()
    },
  })
}

/**
 * Show a generic input modal
 * Returns a promise that resolves to the input string or null if cancelled
 */
export function showInputModal(
  title: string,
  placeholder: string,
  initialValue = ""
): Promise<string | null> {
  const dialogManager = getDialogManager()
  let inputValue = initialValue
  let resolved = false

  // Set input mode BEFORE showing dialog to prevent re-render race
  appState.setInputMode(true)

  return new Promise((resolve) => {
    const safeResolve = (value: string | null) => {
      if (resolved) return
      resolved = true
      appState.setInputMode(false)
      resolve(value)
    }

    const dialogId = dialogManager.show({
      content: (ctx: RenderContext) => {
        const wrapper = new BoxRenderable(ctx, {
          flexDirection: "column",
          width: "100%",
        })

        // Title
        wrapper.add(
          new TextRenderable(ctx, {
            content: title,
            fg: WhatsAppTheme.textPrimary,
            attributes: TextAttributes.BOLD,
          })
        )

        wrapper.add(new BoxRenderable(ctx, { height: 1 }))

        // Input
        const input = new InputRenderable(ctx, {
          value: initialValue,
          placeholder: placeholder,
          width: "100%",
          backgroundColor: WhatsAppTheme.inputBg,
          focusedBackgroundColor: WhatsAppTheme.inputBg,
          textColor: WhatsAppTheme.textPrimary,
          focusedTextColor: WhatsAppTheme.white,
          placeholderColor: WhatsAppTheme.textTertiary,
          cursorColor: WhatsAppTheme.white,
        })

        input.on(InputRenderableEvents.INPUT, (val: string) => {
          inputValue = val
        })

        input.on(InputRenderableEvents.ENTER, () => {
          safeResolve(inputValue)
          dialogManager.close(dialogId)
        })

        wrapper.add(input)

        wrapper.add(new BoxRenderable(ctx, { height: 1 }))

        // Button row
        const buttonRow = new BoxRenderable(ctx, {
          flexDirection: "row",
          justifyContent: "flex-end",
        })

        // Cancel button
        const cancelStyle = getButtonStyle("secondary")
        const cancelBtn = new BoxRenderable(ctx, {
          paddingLeft: 2,
          paddingRight: 2,
          height: 1,
          backgroundColor: cancelStyle.bg,
          justifyContent: "center",
          alignItems: "center",
          onMouse(event) {
            if (event.type === "down" && event.button === 0) {
              safeResolve(null)
              dialogManager.close(dialogId)
              event.stopPropagation()
            }
          },
        })
        cancelBtn.add(new TextRenderable(ctx, { content: "Cancel", fg: cancelStyle.fg }))
        buttonRow.add(cancelBtn)

        // OK button
        const okStyle = getButtonStyle("primary")
        const okBtn = new BoxRenderable(ctx, {
          paddingLeft: 2,
          paddingRight: 2,
          height: 1,
          marginLeft: 2,
          backgroundColor: okStyle.bg,
          justifyContent: "center",
          alignItems: "center",
          onMouse(event) {
            if (event.type === "down" && event.button === 0) {
              safeResolve(inputValue)
              dialogManager.close(dialogId)
              event.stopPropagation()
            }
          },
        })
        okBtn.add(new TextRenderable(ctx, { content: "OK", fg: okStyle.fg }))
        buttonRow.add(okBtn)

        wrapper.add(buttonRow)

        // Auto focus input after it's rendered
        setTimeout(() => {
          input.focus()
        }, 50)

        return wrapper
      },
      size: "medium",
      onClose: () => {
        safeResolve(null)
      },
    })
  })
}

/**
 * Show a file picker modal asking for absolute file path
 */
export function showFilePickerModal(): Promise<string | null> {
  return showInputModal("Attach File", "Enter absolute file path (e.g., /home/user/image.png)", "")
}

/**
 * Show a caption modal
 */
export function showCaptionModal(): Promise<string | null> {
  return showInputModal("Add Caption", "Enter an optional caption...", "")
}

/**
 * Show a contact picker modal to start a new chat
 */
export function showContactPickerModal(): Promise<string | null> {
  const dialogManager = getDialogManager()
  const renderer = getRenderer()
  let resolved = false
  let searchQuery = ""
  let selectedIndex = 0

  // Set input mode so global keyboard handlers don't intercept typing
  appState.setInputMode(true)

  return new Promise((resolve) => {
    const safeResolve = (value: string | null) => {
      if (resolved) return
      resolved = true
      appState.setInputMode(false)
      renderer.keyInput.off("keypress", handleKey)
      resolve(value)
    }

    let filtered: Array<{ id: string; name: string }> = []
    let updateResults: () => void = () => {}
    // eslint-disable-next-line prefer-const
    let dialogId: DialogId | undefined

    const handleKey = (key: KeyEvent) => {
      if (filtered.length === 0) return

      if (key.name === "up") {
        selectedIndex = Math.max(0, selectedIndex - 1)
        updateResults()
      } else if (key.name === "down") {
        selectedIndex = Math.min(filtered.length - 1, selectedIndex + 1)
        updateResults()
      } else if (key.name === "return" || key.name === "enter") {
        // If there's a selection, use it. If not, and search is a phone number, use that.
        if (filtered[selectedIndex] && dialogId !== undefined) {
          safeResolve(filtered[selectedIndex].id)
          dialogManager.close(dialogId)
        }
      }
    }

    dialogId = dialogManager.show({
      content: (ctx: RenderContext) => {
        const wrapper = new BoxRenderable(ctx, {
          flexDirection: "column",
          width: "100%",
        })

        // Title
        wrapper.add(
          new TextRenderable(ctx, {
            content: "Start New Chat",
            fg: WhatsAppTheme.textPrimary,
            attributes: TextAttributes.BOLD,
          })
        )

        wrapper.add(new BoxRenderable(ctx, { height: 1 }))

        // Input
        const input = new InputRenderable(ctx, {
          value: searchQuery,
          placeholder: "Search contacts...",
          width: "100%",
          backgroundColor: WhatsAppTheme.inputBg,
          focusedBackgroundColor: WhatsAppTheme.inputBg,
          textColor: WhatsAppTheme.textPrimary,
          focusedTextColor: WhatsAppTheme.white,
          placeholderColor: WhatsAppTheme.textTertiary,
          cursorColor: WhatsAppTheme.white,
        })

        wrapper.add(input)
        wrapper.add(new BoxRenderable(ctx, { height: 1 }))

        // Results Container
        const resultsContainer = new BoxRenderable(ctx, {
          flexDirection: "column",
          height: 16, // 8 items * 2 height
        })
        wrapper.add(resultsContainer)

        updateResults = () => {
          for (const child of resultsContainer.getChildren()) {
            child.destroyRecursively()
          }
          const contactsMap = appState.getState().allContacts

          filtered = []
          for (const [id, name] of contactsMap.entries()) {
            // Only show regular user contacts (exclude @lid duplicates and @g.us groups)
            if (!id.endsWith("@c.us")) {
              continue
            }

            if (!searchQuery.trim()) {
              filtered.push({ id, name })
            } else {
              const q = searchQuery.toLowerCase().trim()
              if (name.toLowerCase().includes(q) || id.toLowerCase().includes(q)) {
                filtered.push({ id, name })
              }
            }
          }

          // Sort alphabetically by name
          filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""))

          if (selectedIndex >= filtered.length) {
            selectedIndex = Math.max(0, filtered.length - 1)
          }

          if (filtered.length === 0) {
            resultsContainer.add(
              new TextRenderable(ctx, {
                content: "No contacts found",
                fg: WhatsAppTheme.textTertiary,
              })
            )
          } else {
            const PAGE_SIZE = 8
            let startIndex = Math.max(0, selectedIndex - Math.floor(PAGE_SIZE / 2))
            let endIndex = startIndex + PAGE_SIZE
            if (endIndex > filtered.length) {
              endIndex = filtered.length
              startIndex = Math.max(0, endIndex - PAGE_SIZE)
            }

            for (let index = startIndex; index < endIndex; index++) {
              const contact = filtered[index]
              const isSelected = index === selectedIndex
              const row = new BoxRenderable(ctx, {
                flexDirection: "row",
                height: 2,
                paddingLeft: 1,
                paddingRight: 1,
                alignItems: "center",
                backgroundColor: isSelected ? WhatsAppTheme.hoverBg : "transparent",
                onMouse(event) {
                  if (event.type === "down" && event.button === 0 && dialogId !== undefined) {
                    safeResolve(contact.id)
                    dialogManager.close(dialogId)
                    event.stopPropagation()
                  }
                },
              })

              // Avatar
              const avatarName = contact.name || "Unknown"
              const initials = getInitials(avatarName, 2)
              const avatar = new BoxRenderable(ctx, {
                width: 4,
                height: 1,
                backgroundColor: WhatsAppTheme.green,
                alignItems: "center",
                justifyContent: "center",
              })
              avatar.add(
                new TextRenderable(ctx, {
                  content: initials,
                  fg: WhatsAppTheme.white,
                })
              )
              row.add(avatar)

              // Name
              const nameBox = new BoxRenderable(ctx, { paddingLeft: 1 })
              nameBox.add(
                new TextRenderable(ctx, {
                  content:
                    avatarName.length > 25 ? avatarName.substring(0, 22) + "..." : avatarName,
                  fg: WhatsAppTheme.textPrimary,
                  attributes: TextAttributes.BOLD,
                })
              )
              row.add(nameBox)

              resultsContainer.add(row)
            }
          }

          // Request re-render of this container
          ctx.requestRender()
        }

        updateResults()

        input.on(InputRenderableEvents.INPUT, (val: string) => {
          searchQuery = val
          selectedIndex = 0
          updateResults()
        })

        input.on(InputRenderableEvents.ENTER, () => {
          if (filtered.length > 0 && filtered[selectedIndex]) {
            safeResolve(filtered[selectedIndex].id)
          } else if (searchQuery && /^[0-9+]+$/.test(searchQuery)) {
            // If it's a number, return it as the chatId (to be validated by the caller)
            const id = searchQuery.replace(/[^0-9]/g, "") + "@c.us"
            safeResolve(id)
          } else {
            safeResolve(null)
          }
          if (dialogId !== undefined) dialogManager.close(dialogId)
        })

        // Auto focus input after it's rendered
        setTimeout(() => {
          input.focus()
        }, 50)

        // Attach global key listener
        renderer.keyInput.on("keypress", handleKey)

        return wrapper
      },
      size: "medium",
      onClose: () => {
        safeResolve(null)
      },
    })
  })
}

/**
 * Show a poll creation modal
 * Returns a promise that resolves to the poll data or null if cancelled
 */
export function showPollModal(): Promise<{
  question: string
  options: string[]
  multipleAnswers: boolean
} | null> {
  const dialogManager = getDialogManager()
  const renderer = getRenderer()
  let resolved = false

  let question = ""
  let optionsText = ""
  let multipleAnswers = false
  let focusedField: "question" | "options" | "multiple" = "question"

  appState.setInputMode(true)

  return new Promise((resolve) => {
    // eslint-disable-next-line prefer-const
    let dialogId: DialogId | undefined
    let qInput: InputRenderable | undefined
    let oInput: InputRenderable | undefined
    let updateUI: () => void = () => {}

    const safeResolve = (
      value: { question: string; options: string[]; multipleAnswers: boolean } | null
    ) => {
      if (resolved) return
      resolved = true
      appState.setInputMode(false)
      renderer.keyInput.off("keypress", handleKey)
      resolve(value)
      if (dialogId !== undefined) dialogManager.close(dialogId)
    }

    const handleKey = (key: KeyEvent) => {
      if (key.name === "tab") {
        if (focusedField === "question") focusedField = "options"
        else if (focusedField === "options") focusedField = "multiple"
        else focusedField = "question"
        updateUI()
      } else if (key.name === "escape") {
        safeResolve(null)
      } else if (key.name === "return" || key.name === "enter") {
        if (question.trim() && optionsText.trim()) {
          const options = optionsText
            .split(",")
            .map((o) => o.trim())
            .filter((o) => o !== "")
          if (options.length >= 2) {
            safeResolve({ question, options, multipleAnswers })
          }
        }
      }
    }

    renderer.keyInput.on("keypress", handleKey)

    dialogId = dialogManager.show({
      content: (ctx: RenderContext) => {
        const wrapper = new BoxRenderable(ctx, {
          flexDirection: "column",
          width: "100%",
        })

        updateUI = () => {
          for (const child of wrapper.getChildren()) {
            child.destroyRecursively()
          }

          wrapper.add(
            new TextRenderable(ctx, {
              content: "Create Poll",
              fg: WhatsAppTheme.textPrimary,
              attributes: TextAttributes.BOLD,
            })
          )

          wrapper.add(new BoxRenderable(ctx, { height: 1 }))

          // Question field
          wrapper.add(
            new TextRenderable(ctx, { content: "Question:", fg: WhatsAppTheme.textSecondary })
          )
          qInput = new InputRenderable(ctx, {
            value: question,
            placeholder: "Enter question...",
            width: "100%",
            backgroundColor: WhatsAppTheme.inputBg,
            textColor: WhatsAppTheme.textPrimary,
            cursorColor: WhatsAppTheme.white,
          })
          qInput.on(InputRenderableEvents.INPUT, (v) => (question = v))
          wrapper.add(qInput)

          wrapper.add(new BoxRenderable(ctx, { height: 1 }))

          // Options field
          wrapper.add(
            new TextRenderable(ctx, {
              content: "Options (comma separated):",
              fg: WhatsAppTheme.textSecondary,
            })
          )
          oInput = new InputRenderable(ctx, {
            value: optionsText,
            placeholder: "Option 1, Option 2, ...",
            width: "100%",
            backgroundColor: WhatsAppTheme.inputBg,
            textColor: WhatsAppTheme.textPrimary,
            cursorColor: WhatsAppTheme.white,
          })
          oInput.on(InputRenderableEvents.INPUT, (v) => (optionsText = v))
          wrapper.add(oInput)

          wrapper.add(new BoxRenderable(ctx, { height: 1 }))

          // Multiple answers toggle
          const multiRow = new BoxRenderable(ctx, { flexDirection: "row", alignItems: "center" })
          multiRow.add(
            new TextRenderable(ctx, {
              content: multipleAnswers ? " [X] " : " [ ] ",
              fg: multipleAnswers ? WhatsAppTheme.green : WhatsAppTheme.textSecondary,
              onMouse: (e) => {
                if (e.type === "down") {
                  multipleAnswers = !multipleAnswers
                  updateUI()
                }
              },
            })
          )
          multiRow.add(
            new TextRenderable(ctx, {
              content: "Allow multiple answers",
              fg: WhatsAppTheme.textPrimary,
            })
          )
          wrapper.add(multiRow)

          wrapper.add(new BoxRenderable(ctx, { height: 1 }))

          // Help text
          wrapper.add(
            new TextRenderable(ctx, {
              content: "Tab: Cycle fields | Enter: Create | Esc: Cancel",
              fg: WhatsAppTheme.textTertiary,
            })
          )

          // Focus management
          setTimeout(() => {
            if (focusedField === "question") qInput?.focus()
            else if (focusedField === "options") oInput?.focus()
          }, 10)

          ctx.requestRender()
        }

        updateUI()
        return wrapper
      },
      size: "medium",
      onClose: () => safeResolve(null),
    })
  })
}
