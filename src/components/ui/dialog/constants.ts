import type { DialogSize } from "./types"

export const DEFAULT_SIZE: DialogSize = "medium"

export const DEFAULT_SIZES: Record<DialogSize, number> = {
  small: 40,
  medium: 60,
  large: 80,
  full: -1,
}

export const FULL_SIZE_OFFSET = 4

export const DIALOG_Z_INDEX = 9998

/** @internal Used by React/Solid bindings for JSX portals */
export const JSX_CONTENT_KEY = Symbol("dialog-jsx-content")
