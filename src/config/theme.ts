/**
 * WhatsApp Theme Configuration
 * Color palette and styling constants adapted for terminal UI
 * Supports Tuiparts semantic tokens, system terminal theming, and dark/light color modes.
 */

import type { ColorInput, ThemeMode } from "@opentui/core"

import { parseColor, RGBA } from "@opentui/core"

// WhatsApp Web Design System (WDS) Colors - Complete palette
export const WDSColors = {
  green: {
    50: "#F2FDF0",
    75: "#E7FCE3",
    100: "#D9FDD3",
    200: "#ACFCAC",
    300: "#71EB85",
    400: "#25D366",
    450: "#21C063",
    500: "#1DAA61",
    600: "#1B8755",
    700: "#15603E",
    750: "#144D37",
    800: "#103529",
  },
  red: {
    50: "#FEEFF2",
    75: "#FDE8EB",
    100: "#FBD8DC",
    200: "#FA99A4",
    300: "#FB5061",
    400: "#EA0038",
    500: "#B80531",
    600: "#911435",
    700: "#61182E",
    800: "#321622",
  },
  orange: {
    50: "#FFF7F5",
    75: "#FFEBE6",
    100: "#FEE2D8",
    200: "#FDC1AD",
    300: "#FC9775",
    400: "#FA6533",
    500: "#C4532D",
    600: "#9A4529",
    700: "#6B3424",
    800: "#35221E",
  },
  yellow: {
    50: "#FFFCF5",
    75: "#FFF7E5",
    100: "#FFF0D4",
    200: "#FFE4AF",
    300: "#FFD279",
    400: "#FFB938",
    500: "#C58730",
    600: "#9D6C2C",
    700: "#6D4E26",
    800: "#362C1F",
  },
  purple: {
    50: "#F7F5FF",
    75: "#EFEBFF",
    100: "#E8E0FF",
    200: "#D1C4FF",
    300: "#A791FF",
    400: "#7F66FF",
    500: "#5E47DE",
    600: "#4837AF",
    700: "#3A327B",
    800: "#242447",
  },
  cobalt: {
    50: "#F2F8FF",
    75: "#E1F0FF",
    100: "#D2E8FE",
    200: "#99CAFE",
    300: "#53A6FD",
    400: "#007BFC",
    500: "#0063CB",
    600: "#0451A3",
    700: "#073D76",
    800: "#092642",
  },
  skyBlue: {
    50: "#F2FAFE",
    75: "#DEF3FC",
    100: "#CAECFA",
    200: "#93D7F5",
    300: "#53BDEB",
    400: "#009DE2",
    500: "#027EB5",
    600: "#046692",
    700: "#074B6A",
    800: "#092C3D",
  },
  pink: {
    50: "#FFF5F8",
    75: "#FFEBF1",
    100: "#FFDAE7",
    200: "#FFABC7",
    300: "#FF72A1",
    400: "#FF2E74",
    500: "#D42A66",
    600: "#A32553",
    700: "#6D1E3E",
    800: "#36192A",
  },
  emerald: {
    50: "#F0FFF9",
    75: "#E1FEF2",
    100: "#D5FDED",
    200: "#B2F5DA",
    300: "#7AE3C3",
    400: "#06CF9C",
    500: "#00A884",
    600: "#008069",
    700: "#125C4E",
    800: "#0A332C",
  },
  teal: {
    50: "#EDFAFA",
    75: "#DFF6F5",
    100: "#CBF2EE",
    200: "#95DBD4",
    300: "#42C7B8",
    400: "#02A698",
    500: "#028377",
    600: "#046A62",
    700: "#074D4A",
    800: "#092D2F",
  },
  cream: {
    50: "#FAF8F5",
    75: "#F5F1EB",
    100: "#EFE9E0",
    200: "#E5DBCD",
    300: "#D4C3AB",
    400: "#C1A886",
    500: "#9F8465",
    600: "#7B654C",
    700: "#504334",
    800: "#2C2720",
  },
  brown: {
    50: "#FEF9F6",
    75: "#FCEDE3",
    100: "#F4DED1",
    200: "#E5C6B2",
    300: "#DBA685",
    400: "#C0835D",
    500: "#9E6947",
    600: "#855538",
    700: "#5B3C29",
    800: "#35271E",
  },
} as const

// WhatsApp WDS default sender palette
export const senderColorsPalette = [
  WDSColors.emerald[300],
  WDSColors.skyBlue[300],
  WDSColors.pink[300],
  WDSColors.purple[300],
  WDSColors.yellow[300],
  WDSColors.orange[300],
  WDSColors.cobalt[300],
  WDSColors.teal[300],
  WDSColors.green[300],
  WDSColors.red[300],
  WDSColors.brown[300],
  WDSColors.cream[300],
  WDSColors.emerald[500],
  WDSColors.skyBlue[500],
  WDSColors.pink[500],
  WDSColors.purple[500],
  WDSColors.yellow[500],
  WDSColors.orange[500],
  WDSColors.cobalt[500],
  WDSColors.teal[500],
  WDSColors.green[500],
  WDSColors.red[500],
  WDSColors.brown[500],
  WDSColors.cream[500],
] as const

// Terminal ANSI sender palette (dynamically adapts to whatever theme is loaded in user's terminal)
export const terminalSenderColors = [
  RGBA.fromIndex(1), // red
  RGBA.fromIndex(2), // green
  RGBA.fromIndex(3), // yellow
  RGBA.fromIndex(4), // blue
  RGBA.fromIndex(5), // magenta
  RGBA.fromIndex(6), // cyan
  RGBA.fromIndex(9), // bright red
  RGBA.fromIndex(10), // bright green
  RGBA.fromIndex(11), // bright yellow
  RGBA.fromIndex(12), // bright blue
  RGBA.fromIndex(13), // bright magenta
  RGBA.fromIndex(14), // bright cyan
] as const

/** Semantic token contract shared by every installed recipe. */
export interface Tokens {
  colors: {
    background: ColorInput
    surface: ColorInput
    foreground: ColorInput
    mutedForeground: ColorInput
    border: ColorInput
    focus: ColorInput
    primary: ColorInput
    primaryForeground: ColorInput
    destructive: ColorInput
    destructiveForeground: ColorInput
    success: ColorInput
    successForeground: ColorInput
    warning: ColorInput
    warningForeground: ColorInput
    disabled: ColorInput
    disabledForeground: ColorInput
  }
  glyphs: {
    check: string
    radio: string
    thumb: string
    track: string
  }
  borders: {
    style: "single" | "rounded" | "double" | "heavy"
  }
  density: {
    paddingX: number
    comfortablePaddingX: number
  }
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends RGBA ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K]
}

/** A named theme: shared overrides plus optional per-mode overlays. */
export interface ThemeDefinition {
  tokens?: DeepPartial<Tokens>
  dark?: DeepPartial<Tokens>
  light?: DeepPartial<Tokens>
}

export type ThemeModeSetting = ThemeMode | "system"

/** Structural slice of CliRenderer consumed by `follow`. */
export interface ThemeModeSource {
  readonly themeMode: ThemeMode | null
  on(event: "theme_mode", listener: (mode: ThemeMode) => void): unknown
  off(event: "theme_mode", listener: (mode: ThemeMode) => void): unknown
}

export interface ThemeStoreConfig {
  base: Tokens
  themes?: Record<string, ThemeDefinition>
  active?: string
  mode?: ThemeModeSetting
}

export interface ThemeStore {
  get(): Readonly<Tokens>
  subscribe(listener: () => void): () => void
  setActive(name: string): boolean
  getActive(): string
  getMode(): ThemeModeSetting
  getResolvedMode(): ThemeMode
  setMode(mode: ThemeModeSetting): void
  override(tokens: DeepPartial<Tokens> | undefined): void
  register(name: string, definition: ThemeDefinition): void
  follow(source: ThemeModeSource): () => void
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepMerge<T>(base: T, layer: DeepPartial<T>): T {
  const merged: Record<string, unknown> = { ...(base as object) }
  for (const [key, value] of Object.entries(layer as object)) {
    if (value === undefined) continue
    const current = merged[key]
    merged[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value
  }
  return merged as T
}

function deepFrozen<T>(value: T): Readonly<T> {
  if (!isPlainObject(value)) return value
  const copy: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    copy[key] = deepFrozen(child)
  }
  return Object.freeze(copy) as Readonly<T>
}

/**
 * Resolves `base ⊕ active.tokens ⊕ active[mode] ⊕ override` eagerly into one
 * frozen snapshot that stays referentially stable until the next change.
 */
export function createThemeStore(config: ThemeStoreConfig): ThemeStore {
  const themes = new Map(Object.entries(config.themes ?? {}))
  const listeners = new Set<() => void>()
  let active = config.active ?? ""
  let mode: ThemeModeSetting = config.mode ?? "system"
  let detected: ThemeMode | undefined
  let overrides: DeepPartial<Tokens> | undefined
  let snapshot: Readonly<Tokens>

  const resolvedMode = (): ThemeMode => (mode === "system" ? (detected ?? "dark") : mode)

  const resolve = () => {
    const definition = themes.get(active)
    const layers = [definition?.tokens, definition?.[resolvedMode()], overrides]
    snapshot = deepFrozen(
      layers.reduce<Tokens>(
        (tokens, layer) => (layer ? deepMerge(tokens, layer) : tokens),
        config.base
      )
    )
  }
  resolve()

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setActive(name) {
      if (!themes.has(name)) return false
      if (name !== active) {
        active = name
        resolve()
        notify()
      }
      return true
    },
    getActive: () => active,
    getMode: () => mode,
    getResolvedMode: () => resolvedMode(),
    setMode(next) {
      if (next === mode) return
      const before = resolvedMode()
      mode = next
      if (resolvedMode() !== before) {
        resolve()
        notify()
      }
    },
    override(tokens) {
      overrides = tokens
      resolve()
      notify()
    },
    register(name, definition) {
      themes.set(name, definition)
      if (name === active) {
        resolve()
        notify()
      }
    },
    follow(source) {
      const apply = (next: ThemeMode) => {
        if (next === detected) return
        const before = resolvedMode()
        detected = next
        if (mode === "system" && resolvedMode() !== before) {
          resolve()
          notify()
        }
      }
      if (source.themeMode) apply(source.themeMode)
      const listener = (next: ThemeMode) => apply(next)
      source.on("theme_mode", listener)
      return () => {
        source.off("theme_mode", listener)
      }
    },
  }
}

/** Blend `overlay` into `base` by `alpha` (0–1); indexed and default-intent colors blend via their RGB snapshot. */
export function tint(base: ColorInput, overlay: ColorInput, alpha: number): RGBA {
  const from = parseColor(base)
  const to = parseColor(overlay)
  const channel = (a: number, b: number) => Math.round((a + (b - a) * alpha) * 255)
  return RGBA.fromInts(
    channel(from.r, to.r),
    channel(from.g, to.g),
    channel(from.b, to.b),
    Math.round(from.a * 255)
  )
}

/**
 * Resolved terminal palette cache.
 *
 * RGBA.fromIndex(N) stores static VGA fallback bytes (e.g. index 0 = #000000)
 * that the renderer overrides only at draw time. When tint() reads .r/.g/.b it
 * gets VGA values, producing dark-biased results regardless of the terminal's
 * actual theme. This cache stores the real hex values obtained from
 * renderer.getPalette() so tint bases match what the user actually sees.
 */
const resolvedPalette: { colors: (string | null)[]; fg: string | null; bg: string | null } = {
  colors: [],
  fg: null,
  bg: null,
}

/** Return the resolved hex for an ANSI index, falling back to the static RGBA. */
function ansi(index: number): ColorInput {
  return resolvedPalette.colors[index] ?? RGBA.fromIndex(index)
}

/**
 * Sync the palette cache with the terminal's actual colors.
 * Call this after renderer.getPalette() and on the "palette" event.
 */
export function syncPalette(colors: {
  palette: (string | null)[]
  defaultForeground: string | null
  defaultBackground: string | null
}): void {
  resolvedPalette.colors = colors.palette
  resolvedPalette.fg = colors.defaultForeground
  resolvedPalette.bg = colors.defaultBackground
}

/**
 * Default theme built from ANSI-indexed colors.
 * Inherits whatever palette and transparency the user's terminal configured.
 */
export const terminal: Tokens = {
  colors: {
    background: RGBA.defaultBackground(),
    surface: RGBA.fromIndex(0), // dark theme base
    foreground: RGBA.defaultForeground(),
    mutedForeground: RGBA.fromIndex(7), // normal white/light foreground
    border: RGBA.fromIndex(8), // bright black (gutter/border)
    focus: RGBA.fromIndex(12), // bright blue
    primary: RGBA.fromIndex(4), // blue / accent
    primaryForeground: RGBA.fromIndex(15), // bright white
    destructive: RGBA.fromIndex(1), // red
    destructiveForeground: RGBA.fromIndex(15), // bright white
    success: RGBA.fromIndex(2), // green
    successForeground: RGBA.fromIndex(15), // bright white
    warning: RGBA.fromIndex(3), // yellow
    warningForeground: RGBA.fromIndex(0), // black
    disabled: RGBA.fromIndex(0), // black
    disabledForeground: RGBA.fromIndex(8), // bright black
  },
  glyphs: {
    check: "✓",
    radio: "●",
    thumb: "●",
    track: "─",
  },
  borders: { style: "single" },
  density: { paddingX: 1, comfortablePaddingX: 2 },
}

/**
 * WhatsApp brand theme definition with dark and light variants
 */
export const whatsappThemeDefinition: ThemeDefinition = {
  tokens: {
    colors: {
      primary: "#00a884",
      primaryForeground: "#ffffff",
      destructive: "#ea0038",
      destructiveForeground: "#ffffff",
      success: "#00a884",
      successForeground: "#ffffff",
      warning: "#ffb938",
      warningForeground: "#111b21",
      focus: "#00a884",
    },
    glyphs: {
      check: "✓",
      radio: "●",
      thumb: "●",
      track: "─",
    },
    borders: { style: "single" },
    density: { paddingX: 1, comfortablePaddingX: 2 },
  },
  dark: {
    colors: {
      background: "#0b141a",
      surface: "#111b21",
      foreground: "#e9edef",
      mutedForeground: "#8696a0",
      border: "#2a3942",
      disabled: "#2a3942",
      disabledForeground: "#667781",
    },
  },
  light: {
    colors: {
      background: "#f0f2f5",
      surface: "#ffffff",
      foreground: "#111b21",
      mutedForeground: "#667781",
      border: "#e9edef",
      disabled: "#e9edef",
      disabledForeground: "#8696a0",
    },
  },
}

/** App-wide theme store: terminal (user's system theme) vs whatsapp */
export const theme = createThemeStore({
  base: terminal,
  themes: {
    terminal: {},
    whatsapp: whatsappThemeDefinition,
  },
  active: "terminal",
  mode: "system",
})

/** Apply user-configured theme settings to store */
export function applyThemeSettings(settings: {
  useSystemTheme?: boolean
  themeMode?: ThemeModeSetting
}): void {
  if (settings.useSystemTheme !== undefined) {
    theme.setActive(settings.useSystemTheme ? "terminal" : "whatsapp")
  }
  if (settings.themeMode !== undefined) {
    theme.setMode(settings.themeMode)
  }
}

// WhatsApp brand color palettes
const whatsappDarkPalette = {
  deepDark: "#0b141a",
  panelDark: "#111b21",
  panelLight: "#202c33",
  inputBg: "#2a3942",
  green: "#00a884",
  greenDark: "#005c4b",
  blue: "#53bdeb",
  background: "#0b141a",
  sentBubble: "#005c4b",
  receivedBubble: "#202c33",
  quoteSentBg: "#025144",
  quoteReceivedBg: "#1a2429",
  white: "#ffffff",
  textPrimary: "#e9edef",
  textSecondary: "#8696a0",
  textTertiary: "#667781",
  divider: "#262d31",
  hoverBg: "#2a3942",
  activeBg: "#2a3942",
  selectedBg: "#2a3942",
  focusBorder: "#00a884",
  borderColor: "#2a3942",
  borderLight: "#3b4a54",
} as const

const whatsappLightPalette = {
  deepDark: "#f0f2f5",
  panelDark: "#f0f2f5",
  panelLight: "#ffffff",
  inputBg: "#f0f2f5",
  green: "#008069",
  greenDark: "#d9fdd3",
  blue: "#027eb5",
  background: "#f0f2f5",
  sentBubble: "#d9fdd3",
  receivedBubble: "#ffffff",
  quoteSentBg: "#cfe9ba",
  quoteReceivedBg: "#f0f2f5",
  white: "#111b21",
  textPrimary: "#111b21",
  textSecondary: "#667781",
  textTertiary: "#8696a0",
  divider: "#e9edef",
  hoverBg: "#f5f6f6",
  activeBg: "#e9edef",
  selectedBg: "#e9edef",
  focusBorder: "#008069",
  borderColor: "#e9edef",
  borderLight: "#d1d7db",
} as const

export interface IWhatsAppTheme {
  readonly deepDark: ColorInput
  readonly panelDark: ColorInput
  readonly panelLight: ColorInput
  readonly inputBg: ColorInput
  readonly green: ColorInput
  readonly greenDark: ColorInput
  readonly blue: ColorInput
  readonly background: ColorInput
  readonly sentBubble: ColorInput
  readonly receivedBubble: ColorInput
  readonly quoteSentBg: ColorInput
  readonly quoteReceivedBg: ColorInput
  readonly white: ColorInput
  readonly textPrimary: ColorInput
  readonly textSecondary: ColorInput
  readonly textTertiary: ColorInput
  readonly divider: ColorInput
  readonly hoverBg: ColorInput
  readonly activeBg: ColorInput
  readonly selectedBg: ColorInput
  readonly focusBorder: ColorInput
  readonly borderColor: ColorInput
  readonly borderLight: ColorInput
  readonly senderColors: readonly ColorInput[]
}

/**
 * Dynamic WhatsAppTheme export that resolves according to the active theme
 * (system terminal colors vs WhatsApp branding) and detected/chosen mode.
 */
export const WhatsAppTheme: IWhatsAppTheme = {
  get deepDark(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.background
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.deepDark
      : whatsappDarkPalette.deepDark
  },

  get panelDark(): ColorInput {
    if (theme.getActive() === "terminal") {
      // Keep transparent background across sidebar in terminal mode
      return RGBA.defaultBackground()
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.panelDark
      : whatsappDarkPalette.panelDark
  },

  get panelLight(): ColorInput {
    if (theme.getActive() === "terminal") {
      return RGBA.defaultBackground()
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.panelLight
      : whatsappDarkPalette.panelLight
  },

  get inputBg(): ColorInput {
    if (theme.getActive() === "terminal") {
      return tint(ansi(0), ansi(7), 0.12)
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.inputBg
      : whatsappDarkPalette.inputBg
  },

  get green(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.success
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.green
      : whatsappDarkPalette.green
  },

  get greenDark(): ColorInput {
    if (theme.getActive() === "terminal") {
      // Tint terminal background toward success (green) for sent-message bubble
      return tint(ansi(0), ansi(2), 0.25)
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.greenDark
      : whatsappDarkPalette.greenDark
  },

  get blue(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.primary
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.blue
      : whatsappDarkPalette.blue
  },

  get background(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.background
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.background
      : whatsappDarkPalette.background
  },

  get sentBubble(): ColorInput {
    return this.greenDark
  },

  get receivedBubble(): ColorInput {
    if (theme.getActive() === "terminal") {
      // Subtle surface lift for received messages
      return tint(ansi(0), ansi(7), 0.12)
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.receivedBubble
      : whatsappDarkPalette.receivedBubble
  },

  get quoteSentBg(): ColorInput {
    if (theme.getActive() === "terminal") {
      return tint(ansi(0), ansi(2), 0.15)
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.quoteSentBg
      : whatsappDarkPalette.quoteSentBg
  },

  get quoteReceivedBg(): ColorInput {
    if (theme.getActive() === "terminal") {
      return tint(ansi(0), ansi(7), 0.08)
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.quoteReceivedBg
      : whatsappDarkPalette.quoteReceivedBg
  },

  get white(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.primaryForeground
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.white
      : whatsappDarkPalette.white
  },

  get textPrimary(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.foreground
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.textPrimary
      : whatsappDarkPalette.textPrimary
  },

  get textSecondary(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.mutedForeground
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.textSecondary
      : whatsappDarkPalette.textSecondary
  },

  get textTertiary(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.disabledForeground
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.textTertiary
      : whatsappDarkPalette.textTertiary
  },

  get divider(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.border
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.divider
      : whatsappDarkPalette.divider
  },

  get hoverBg(): ColorInput {
    if (theme.getActive() === "terminal") {
      return tint(ansi(0), ansi(7), 0.12)
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.hoverBg
      : whatsappDarkPalette.hoverBg
  },

  get activeBg(): ColorInput {
    if (theme.getActive() === "terminal") {
      return tint(ansi(0), ansi(7), 0.18)
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.activeBg
      : whatsappDarkPalette.activeBg
  },

  get selectedBg(): ColorInput {
    if (theme.getActive() === "terminal") {
      return tint(ansi(0), ansi(4), 0.25)
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.selectedBg
      : whatsappDarkPalette.selectedBg
  },

  get focusBorder(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.focus
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.focusBorder
      : whatsappDarkPalette.focusBorder
  },

  get borderColor(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.border
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.borderColor
      : whatsappDarkPalette.borderColor
  },

  get borderLight(): ColorInput {
    if (theme.getActive() === "terminal") {
      return theme.get().colors.border
    }
    return theme.getResolvedMode() === "light"
      ? whatsappLightPalette.borderLight
      : whatsappDarkPalette.borderLight
  },

  get senderColors(): readonly ColorInput[] {
    if (theme.getActive() === "terminal") {
      return terminalSenderColors
    }
    return senderColorsPalette
  },
}

export const Icons = {
  // Navigation
  chats: "💬",
  status: "⭕",
  channels: "📢",
  communities: "👥",
  profile: "👤",
  settings: "⚙️",

  // Actions
  newChat: "+",
  menu: "⋮",
  search: "🔍",
  video: "📹",
  call: "📞",
  attach: "📎",
  mic: "🎤",
  smile: "😊",
  send: "➤",

  // Context Menu Actions
  reply: "↩",
  forward: "➡",
  copy: "📋",
  download: "⬇",
  pin: "📌",
  star: "☆",
  starFilled: "★",
  react: "😀",
  delete: "✕",
  edit: "✏",
  archive: "📦",
  unread: "●",
  info: "ⓘ",
  poll: "☑",
  pollMultiple: "☑☑",

  // Status
  checkSingle: "✓",
  checkDouble: "✓✓",
  online: "●",
  typing: "...",

  // WhatsApp branding
  whatsapp: "📱",
  lock: "🔒",

  // Circled numbers for steps
  circled1: "①",
  circled2: "②",
  circled3: "③",
  circled4: "④",

  // Chat list indicators
  muted: "🔕",
  chevronDown: "˅",
} as const

export const BoxChars = {
  // Rounded corners
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",

  // Square corners
  squareTopLeft: "┌",
  squareTopRight: "┐",
  squareBottomLeft: "└",
  squareBottomRight: "┘",
  squareHorizontal: "─",
  squareVertical: "│",

  // Filled blocks
  full: "█",
  light: "░",
  medium: "▒",
  dark: "▓",
} as const

export const Layout = {
  iconSidebarWidth: 6,
  chatListMinWidth: 30,
  chatListMaxWidth: 40,
  minTerminalWidth: 80,
  minTerminalHeight: 24,
} as const
