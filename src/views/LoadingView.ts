/**
 * Loading View
 * WhatsApp Web-style loading screen with logo, progress bar, and encryption message
 */

import { Box, Text, TextAttributes } from "@opentui/core"

import { Logo } from "~/components/Logo"
import { Icons, WhatsAppTheme } from "~/config/theme"

/**
 * Loading View Component
 * Full-screen loading overlay shown after successful QR scan
 */
export function LoadingView() {
  const progressWidth = 40
  const progressFilled = "━".repeat(progressWidth)

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: WhatsAppTheme.background,
    },

    // Spacer
    Box({ flexGrow: 1 }),

    // Center content container
    Box(
      {
        flexDirection: "column",
        alignItems: "center",
      },

      // WhatsApp Logo
      Logo({ color: WhatsAppTheme.textSecondary }),

      Box({ height: 2 }),

      // Loading text
      Text({
        content: "Loading your chats",
        fg: WhatsAppTheme.textPrimary,
        attributes: TextAttributes.BOLD,
      }),

      Box({ height: 1 }),

      // Progress bar
      Text({
        content: progressFilled,
        fg: WhatsAppTheme.green,
      }),

      Box({ height: 2 }),

      // Encryption message
      Box(
        { flexDirection: "row" },
        Text({
          content: `${Icons.lock} `,
          fg: WhatsAppTheme.textSecondary,
        }),
        Text({
          content: "End-to-end encrypted",
          fg: WhatsAppTheme.textSecondary,
        })
      )
    ),

    // Spacer
    Box({ flexGrow: 1 })
  )
}
