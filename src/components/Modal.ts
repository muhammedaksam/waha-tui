/**
 * Modal Component
 * A reusable modal dialog overlay
 */

import { TextAttributes, BoxRenderable, TextRenderable } from "@opentui/core"
import { WhatsAppTheme, WDSColors } from "../config/theme"
import { getRenderer } from "../state/RendererContext"

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
}

/**
 * Create a modal dialog overlay
 */
export function Modal(props: ModalProps) {
  const renderer = getRenderer()
  const { title, message, buttons, onClose } = props

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
    width: 50,
    flexDirection: "column",
    backgroundColor: WhatsAppTheme.panelDark,
    padding: 2,
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
