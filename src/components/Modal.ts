/**
 * Modal Component
 * WhatsApp-themed dialogs using @opentui-ui/dialog
 */

import type { DialogContainerOptions, DialogStyle } from "@opentui-ui/dialog"
import type { RenderContext } from "@opentui/core"

import {
  BoxRenderable,
  fg,
  link,
  t,
  TextAttributes,
  TextRenderable,
  underline,
} from "@opentui/core"

import type { UpdateInfo } from "../utils/update-checker"
import { logoutSession } from "../client"
import { WDSColors, WhatsAppTheme } from "../config/theme"
import { getDialogManager } from "../router"
import { appState } from "../state/AppState"

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
