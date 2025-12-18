/**
 * Logo Component
 * ASCII art logo for WAHA TUI
 */

import { Box, ASCIIFont } from "@opentui/core"

export function Logo() {
  return Box(
    {
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    },
    ASCIIFont({ font: "tiny", text: "waha-tui" })
  )
}
