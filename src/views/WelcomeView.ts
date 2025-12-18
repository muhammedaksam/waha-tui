/**
 * Welcome View
 * Empty state shown when no conversation is selected
 * WAHA TUI landing screen
 */

import { Box, Text } from "@opentui/core"
import { WhatsAppTheme } from "../config/theme"
import { Logo } from "../components/Logo"

export function WelcomeView() {
  return Box(
    {
      flexGrow: 1,
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: WhatsAppTheme.deepDark,
      paddingLeft: 4,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 4,
    },
    // Top spacer
    Box({ flexGrow: 1 }),

    // Center content
    Box(
      {
        flexDirection: "column",
        alignItems: "center",
      },
      // Logo
      Box(
        {
          marginBottom: 2,
        },
        Logo()
      ),

      // Description text
      Box(
        {
          flexDirection: "column",
          alignItems: "center",
          maxWidth: "70%",
        },
        Text({
          content: "Send and receive messages without keeping your phone online.",
          fg: WhatsAppTheme.textSecondary,
        }),
        Text({
          content: "Use WhatsApp on up to 4 linked devices and 1 phone at the same time.",
          fg: WhatsAppTheme.textSecondary,
        })
      )
    ),

    // Bottom spacer (larger to push content up)
    Box({ flexGrow: 1 }),

    // Encryption indicator (pinned to bottom)
    Box(
      {
        flexDirection: "row",
        alignItems: "center",
        gap: 1,
      },
      Text({
        content: "🔒",
        fg: WhatsAppTheme.textTertiary,
      }),
      Text({
        content: "Your personal messages are end-to-end encrypted",
        fg: WhatsAppTheme.textTertiary,
      })
    )
  )
}
