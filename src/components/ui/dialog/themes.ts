import type { DialogContainerOptions, DialogStyle } from "./types"

export interface DialogTheme extends Omit<DialogContainerOptions, "manager"> {
  name: string
  description: string
}

export const DEFAULT_BACKDROP_OPACITY = 89 // 35%

export const DEFAULT_BACKDROP_COLOR = "#000000"

export const DEFAULT_STYLE: DialogStyle = {
  backgroundColor: "#262626",
  border: false,
  padding: 1,
}

export const DEFAULT_PADDING = { top: 1, right: 1, bottom: 1, left: 1 }

export const minimal: DialogTheme = {
  name: "Minimal",
  description: "Clean and unobtrusive, lighter backdrop, no borders (default)",
  dialogOptions: {
    style: DEFAULT_STYLE,
  },
}

export const unstyled: DialogTheme = {
  name: "Unstyled",
  description: "No default styles - full control for custom implementations",
  unstyled: true,
  backdropOpacity: 0,
  dialogOptions: {
    style: {
      backgroundColor: undefined,
      border: false,
      padding: 0,
    },
  },
}

export const themes = {
  minimal,
  unstyled,
} as const
