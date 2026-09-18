/**
 * Position utilities for toast rendering
 *
 * Handles conversion of position strings to box layout properties.
 */

import type { BoxOptions } from "@opentui/core"

import type { Position, ToasterOffset } from "../types"
import { DEFAULT_OFFSET } from "../constants"

/**
 * Convert a Position and offset to BoxOptions for absolute positioning
 *
 * Handles all 6 position variants:
 * - top-left, top-center, top-right
 * - bottom-left, bottom-center, bottom-right
 *
 * @example
 * ```ts
 * getPositionStyles("top-right", { top: 2, right: 3 })
 * // => { position: "absolute", top: 2, right: 3, alignItems: "flex-end" }
 *
 * getPositionStyles("bottom-center", {})
 * // => { position: "absolute", bottom: 1, left: 0, width: "100%", alignItems: "center" }
 * ```
 */
export function getPositionStyles(
  position: Position,
  offset: ToasterOffset = {}
): Partial<BoxOptions> {
  const [y, x] = position.split("-")

  const styles: Partial<BoxOptions> = {
    position: "absolute",
  }

  // Vertical positioning
  if (y === "top") {
    styles.top = offset.top ?? DEFAULT_OFFSET.top
  } else {
    styles.bottom = offset.bottom ?? DEFAULT_OFFSET.bottom
  }

  // Horizontal positioning
  if (x === "left") {
    styles.left = offset.left ?? DEFAULT_OFFSET.left
    styles.alignItems = "flex-start"
  } else if (x === "center") {
    // Center horizontally - make container full width and center children
    styles.left = 0
    styles.width = "100%"
    styles.alignItems = "center"
  } else {
    styles.right = offset.right ?? DEFAULT_OFFSET.right
    styles.alignItems = "flex-end"
  }

  return styles
}

/**
 * Check if a position is horizontally centered
 */
export function isCenteredPosition(position: Position): boolean {
  return position.includes("center")
}

/**
 * Check if a position is at the top of the screen
 */
export function isTopPosition(position: Position): boolean {
  return position.startsWith("top")
}
