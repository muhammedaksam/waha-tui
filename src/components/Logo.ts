/**
 * Logo Component
 * ASCII art logo for WAHA TUI
 */

import type { ColorInput } from "@opentui/core"

import { ASCIIFont, Box } from "@opentui/core"

import { WhatsAppTheme } from "~/config/theme"

export function Logo({ color = WhatsAppTheme.textPrimary }: { color?: ColorInput }) {
  return Box(
    {
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    },
    ASCIIFont({ font: "tiny", text: "waha-tui", color })
  )
}
