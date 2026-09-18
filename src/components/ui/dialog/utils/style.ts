import type { Dialog, DialogContainerOptions, DialogSize, DialogStyle } from "../types"
import { mergeStyles, resolvePadding } from "../../utils"
import { DEFAULT_SIZE, DEFAULT_SIZES, FULL_SIZE_OFFSET } from "../constants"
import { DEFAULT_PADDING, DEFAULT_STYLE } from "../themes"

export interface ComputeDialogStyleInput {
  dialog: Dialog
  containerOptions?: DialogContainerOptions
}

export interface ComputedDialogStyle extends DialogStyle {
  resolvedPadding: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

export function computeDialogStyle(input: ComputeDialogStyleInput): ComputedDialogStyle {
  const { dialog, containerOptions } = input

  const isUnstyled = dialog.unstyled ?? containerOptions?.unstyled ?? false

  const baseStyle = isUnstyled ? {} : DEFAULT_STYLE

  const computed = mergeStyles(baseStyle, containerOptions?.dialogOptions?.style, dialog.style)

  const defaultPadding = isUnstyled ? { top: 0, right: 0, bottom: 0, left: 0 } : DEFAULT_PADDING

  const resolvedPadding = isUnstyled
    ? { top: 0, right: 0, bottom: 0, left: 0 }
    : resolvePadding(computed, defaultPadding)

  return {
    ...computed,
    resolvedPadding,
  }
}

export function getDialogWidth(
  size: DialogSize | undefined,
  containerOptions?: DialogContainerOptions,
  terminalWidth?: number
): number {
  const effectiveSize: DialogSize = size ?? containerOptions?.size ?? DEFAULT_SIZE

  const customWidth = containerOptions?.sizePresets?.[effectiveSize]
  if (customWidth !== undefined && customWidth > 0) {
    return customWidth
  }

  const defaultWidth = DEFAULT_SIZES[effectiveSize]

  if (defaultWidth === -1) {
    return terminalWidth ? terminalWidth - FULL_SIZE_OFFSET : 80
  }

  return defaultWidth
}
