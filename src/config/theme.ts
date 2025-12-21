/**
 * WhatsApp Theme Configuration
 * Color palette and styling constants adapted for terminal UI
 */

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

// Programmatically generate sender colors from all 300-level WDS colors
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
  // Add darker shades for more variety
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

export const WhatsAppTheme = {
  // Background colors
  deepDark: "#0b141a", // Main background
  panelDark: "#111b21", // Sidebar background
  panelLight: "#202c33", // Chat row background
  inputBg: "#2a3942", // Input field background

  // Accent colors
  green: "#00a884", // WhatsApp green (primary)
  greenDark: "#005c4b", // Sent message bubble
  blue: "#53bdeb", // Links, active states

  // Page background
  background: "#0b141a", // Deep dark background

  // Message bubbles
  sentBubble: "#005c4b",
  receivedBubble: "#202c33",

  // Quote box backgrounds (darker than bubbles)
  quoteSentBg: "#025144",
  quoteReceivedBg: "#1a2429",

  // Text colors
  white: "#ffffff",
  textPrimary: "#e9edef",
  textSecondary: "#8696a0",
  textTertiary: "#667781",

  // UI states
  hoverBg: "#2a3942",
  activeBg: "#2a3942",
  selectedBg: "#2a3942", // Selected item background
  focusBorder: "#00a884",

  // Borders
  borderColor: "#2a3942",
  borderLight: "#3b4a54",

  // WhatsApp WDS colors for sender names in group chats
  senderColors: senderColorsPalette,
} as const

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
  pin: "📌",
  star: "☆",
  starFilled: "★",
  react: "😀",
  delete: "✕",
  archive: "📦",
  unread: "●",
  info: "ⓘ",

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
