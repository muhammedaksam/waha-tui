/**
 * WhatsApp Theme Configuration
 * Color palette and styling constants adapted for terminal UI
 */

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

  // Message bubbles
  sentBubble: "#005c4b",
  receivedBubble: "#202c33",

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
} as const

export const Icons = {
  // Navigation
  chats: "💬",
  status: "📊",
  profile: "👤",
  settings: "⚙️",

  // Actions
  newChat: "+",
  menu: "☰",
  search: "🔍",
  video: "📹",
  call: "📞",
  attach: "📎",
  mic: "🎤",
  smile: "😊",
  send: "➤",

  // Status
  checkSingle: "✓",
  checkDouble: "✓✓",
  online: "●",
  typing: "...",
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
  iconSidebarWidth: 8,
  chatListMinWidth: 30,
  chatListMaxWidth: 40,
  minTerminalWidth: 80,
  minTerminalHeight: 24,
} as const
