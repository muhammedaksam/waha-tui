/**
 * Modal Component
 * A reusable modal dialog overlay
 */

import { TextAttributes, BoxRenderable, TextRenderable } from "@opentui/core"
import { WhatsAppTheme, WDSColors } from "../config/theme"
import { getRenderer } from "../state/RendererContext"
import { type UpdateInfo } from "../utils/update-checker"

export interface ModalButton {
  label: string
  action: () => void
  variant?: "primary" | "secondary" | "danger"
}

export interface ModalProps {
  title: string
  message?: string
  buttons: ModalButton[]
  onClose?: () => void
  size?: "small" | "medium" | "large" | "xlarge"
  customContent?: BoxRenderable
}

/**
 * Create a modal dialog overlay
 */
export function Modal(props: ModalProps) {
  const renderer = getRenderer()
  const { title, message, buttons, onClose, size = "small", customContent } = props

  // Modal size mappings
  const getWidth = (s: string) => {
    switch (s) {
      case "xlarge":
        return 150
      case "large":
        return 130
      case "medium":
        return 110
      case "small":
      default:
        return 90
    }
  }

  const modalWidth = getWidth(size)

  // Button styling based on variant
  const getButtonStyle = (variant?: string) => {
    switch (variant) {
      case "danger":
        return {
          bg: WDSColors.red[500],
          fg: WhatsAppTheme.white,
        }
      case "primary":
        return {
          bg: WhatsAppTheme.green,
          fg: WhatsAppTheme.white,
        }
      case "secondary":
      default:
        return {
          bg: "transparent",
          fg: WhatsAppTheme.textPrimary,
        }
    }
  }

  // Create buttons
  const buttonElements = buttons.map((btn, index) => {
    const style = getButtonStyle(btn.variant)
    const buttonBox = new BoxRenderable(renderer, {
      id: `modal-btn-${index}`,
      paddingLeft: 2,
      paddingRight: 2,
      height: 1,
      marginLeft: index > 0 ? 2 : 0,
      backgroundColor: style.bg,
      justifyContent: "center",
      alignItems: "center",
      onMouse(event) {
        if (event.type === "down" && event.button === 0) {
          btn.action()
          event.stopPropagation()
        }
      },
    })

    buttonBox.add(
      new TextRenderable(renderer, {
        content: btn.label,
        fg: style.fg,
      })
    )

    return buttonBox
  })

  // Modal content box
  const contentBox = new BoxRenderable(renderer, {
    id: "modal-content",
    width: modalWidth,
    flexDirection: "column",
    backgroundColor: WhatsAppTheme.panelDark,
    padding: 1,
    paddingLeft: 2,
    paddingRight: 2,
    border: true,
    borderColor: WhatsAppTheme.borderColor,
  })

  // Title
  contentBox.add(
    new TextRenderable(renderer, {
      content: title,
      fg: WhatsAppTheme.textPrimary,
      attributes: TextAttributes.BOLD,
    })
  )

  // Message
  if (message) {
    contentBox.add(
      new BoxRenderable(renderer, {
        id: "modal-spacer-1",
        height: 1,
      })
    )
    contentBox.add(
      new TextRenderable(renderer, {
        content: message,
        fg: WhatsAppTheme.textSecondary,
      })
    )
  }

  // Custom Content
  if (customContent) {
    contentBox.add(
      new BoxRenderable(renderer, {
        id: "modal-spacer-custom",
        height: 1,
      })
    )
    contentBox.add(customContent)
  }

  // Button row
  const buttonRow = new BoxRenderable(renderer, {
    id: "modal-buttons",
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 2,
  })

  for (const btn of buttonElements) {
    buttonRow.add(btn)
  }

  contentBox.add(buttonRow)

  // Modal overlay (full screen, dimmed background)
  const overlay = new BoxRenderable(renderer, {
    id: "modal-overlay",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WhatsAppTheme.deepDark,
    opacity: 0.32,
    zIndex: 100,
    onMouse(event) {
      // Close on backdrop click if onClose is provided
      if (event.type === "down" && event.button === 0 && onClose) {
        onClose()
        event.stopPropagation()
      }
    },
  })

  // Content wrapper (full screen, centered, transparent - holds content on top of overlay)
  const contentWrapper = new BoxRenderable(renderer, {
    id: "modal-content-wrapper",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 101,
    onMouse(event) {
      // Prevent clicks on wrapper from closing (only overlay closes)
      event.stopPropagation()
    },
  })

  contentWrapper.add(contentBox)

  // Add both elements to renderer.root internally
  renderer.root.add(overlay)
  renderer.root.add(contentWrapper)
}

/**
 * Logout confirmation modal
 */
export function LogoutConfirmModal(props: { onConfirm: () => void; onCancel: () => void }) {
  return Modal({
    title: "Log out?",
    message: "You will be logged out of this WhatsApp session.",
    buttons: [
      {
        label: "Cancel",
        action: props.onCancel,
        variant: "secondary",
      },
      {
        label: "Log out",
        action: props.onConfirm,
        variant: "danger",
      },
    ],
    onClose: props.onCancel,
  })
}

/**
 * Update Available Modal
 */
export function UpdateAvailableModal(props: { updateInfo: UpdateInfo; onDismiss: () => void }) {
  const { updateInfo, onDismiss } = props
  const renderer = getRenderer()
  const command = "bun install -g @muhammedaksam/waha-tui"

  // Release Notes Box
  let notesContent: BoxRenderable | undefined
  if (updateInfo.releaseNotes) {
    notesContent = new BoxRenderable(renderer, {
      flexDirection: "column",
      padding: 1,
      marginTop: 1,
      backgroundColor: WhatsAppTheme.background,
    })

    // Parse and render lines
    // replace \r
    const rawNotes = updateInfo.releaseNotes.replace(/\r/g, "")
    const lines = rawNotes.split("\n")
    const maxLines = 15

    // Process lines
    let renderedLines = 0
    for (const line of lines) {
      if (renderedLines >= maxLines) {
        notesContent.add(
          new TextRenderable(renderer, {
            content: "... (more on GitHub)",
            fg: WhatsAppTheme.textTertiary,
          })
        )
        break
      }

      const trimmed = line.trim()
      if (!trimmed) {
        // preserve paragraph spacing (except at very start)
        if (renderedLines > 0) {
          notesContent.add(new BoxRenderable(renderer, { height: 1 }))
          renderedLines++
        }
        continue
      }

      if (trimmed.startsWith("#")) {
        // Header
        const content = trimmed.replace(/^#+\s*/, "")
        const heading = new BoxRenderable(renderer, {
          flexDirection: "row",
          alignItems: "center",
          marginTop: renderedLines === 0 ? 0 : 1, // Only add spacing if not first item
          border: ["bottom"],
          borderColor: WhatsAppTheme.borderColor,
        })
        heading.add(
          new TextRenderable(renderer, {
            content: content,
            fg: WhatsAppTheme.textSecondary,
            attributes: TextAttributes.BOLD,
          })
        )
        notesContent.add(heading)
      } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        // List item
        const content = `• ${trimmed.substring(2)}`

        const row = new BoxRenderable(renderer, {
          flexDirection: "row",
          width: "100%",
          alignItems: "flex-start", // Top align items
          marginBottom: 0,
        })

        // Content with flexGrow to wrap properly
        const textWrapper = new BoxRenderable(renderer, {
          flexGrow: 1,
          flexDirection: "column",
        })
        textWrapper.add(
          new TextRenderable(renderer, { content: content, fg: WhatsAppTheme.textTertiary })
        )
        row.add(textWrapper)

        notesContent.add(row)
        renderedLines++
      } else {
        // Normal text
        // Check for **Bold** at start (common in changelogs for "Full Changelog")
        let attributes = undefined
        let fg: string = WhatsAppTheme.textSecondary

        if (trimmed.startsWith("**") && trimmed.includes("**")) {
          attributes = TextAttributes.BOLD
          fg = WhatsAppTheme.textSecondary
        }

        // Strip markdown bold markers for display
        const displayContent = trimmed.replace(/\*\*/g, "")

        notesContent.add(
          new TextRenderable(renderer, {
            content: displayContent,
            fg,
            attributes,
          })
        )
        renderedLines++
      }
    }
  }

  // Version Display Box
  const versionBox = new BoxRenderable(renderer, {
    flexDirection: "column",
    marginBottom: 1,
  })

  // helper to render version parts
  const renderVersionRow = (label: string, verString: string, compareString?: string) => {
    const row = new BoxRenderable(renderer, { flexDirection: "row" })

    // Label
    row.add(
      new TextRenderable(renderer, { content: label, fg: WhatsAppTheme.textSecondary, width: 9 })
    )

    // Version v prefix
    row.add(new TextRenderable(renderer, { content: "v", fg: WhatsAppTheme.textSecondary }))

    // Normalize versions (remove v prefix if present)
    const cleanVer = verString.replace(/^v/, "")
    const cleanCompare = compareString?.replace(/^v/, "")

    if (!compareString) {
      // Just render the string (Current version)
      row.add(new TextRenderable(renderer, { content: cleanVer, fg: WhatsAppTheme.textSecondary }))
    } else {
      // Compare mode (Latest version)
      const parts = cleanVer.split(".")
      const compareParts = (cleanCompare || "").split(".")

      parts.forEach((part, index) => {
        const compPart = compareParts[index]
        const isDiff = part !== compPart

        row.add(
          new TextRenderable(renderer, {
            content: part,
            fg: isDiff ? WhatsAppTheme.green : WhatsAppTheme.textSecondary,
            attributes: isDiff ? TextAttributes.BOLD : undefined,
          })
        )

        if (index < parts.length - 1) {
          row.add(new TextRenderable(renderer, { content: ".", fg: WhatsAppTheme.textSecondary }))
        }
      })
    }
    return row
  }

  versionBox.add(renderVersionRow("Current:", updateInfo.currentVersion))
  versionBox.add(renderVersionRow("Latest:", updateInfo.latestVersion, updateInfo.currentVersion))

  // Command Box (Bold)
  const commandBox = new BoxRenderable(renderer, {
    flexDirection: "row",
    marginTop: 1,
  })
  commandBox.add(new TextRenderable(renderer, { content: "Run ", fg: WhatsAppTheme.textSecondary }))
  commandBox.add(
    new TextRenderable(renderer, {
      content: `'${command}'`,
      fg: WhatsAppTheme.textPrimary,
      attributes: TextAttributes.BOLD,
    })
  )
  commandBox.add(
    new TextRenderable(renderer, { content: " to update.", fg: WhatsAppTheme.textSecondary })
  )

  // Wrapper for custom content (Versions + Command + Notes)
  const wrapper = new BoxRenderable(renderer, { flexDirection: "column" })
  wrapper.add(versionBox)
  wrapper.add(commandBox)
  if (notesContent) {
    wrapper.add(notesContent)
  }

  return Modal({
    title: "Update Available!",
    message: `A new version of waha-tui is available.`,
    size: "xlarge",
    customContent: wrapper,
    buttons: [
      {
        label: "GitHub Release",
        variant: "secondary",
        action: () => {
          Bun.spawn(["xdg-open", updateInfo.releaseUrl])
        },
      },
      {
        label: "OK",
        variant: "primary",
        action: onDismiss,
      },
    ],
    onClose: onDismiss,
  })
}
