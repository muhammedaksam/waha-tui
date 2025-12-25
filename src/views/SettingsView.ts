/**
 * Settings View
 * WhatsApp-style settings interface
 */

import { Box, BoxRenderable, Text, TextAttributes, TextRenderable } from "@opentui/core"
import { appState, type SettingsPage } from "../state/AppState"
import { WhatsAppTheme, Icons } from "../config/theme"
import { getInitials } from "../utils/formatters"
import { VersionInfo } from "../config/version"
import { ThreePanelLayout } from "./MainLayout"
import { getRenderer } from "../state/RendererContext"
import { WDSColors } from "../config/theme"
import { Logo } from "../components/Logo"

interface SettingsMenuItem {
  id: SettingsPage | "logout"
  icon: string
  label: string
  description?: string
}

const menuItems: SettingsMenuItem[] = [
  { id: "chats", icon: "💬", label: "Chats", description: "Enter is send" },
  { id: "shortcuts", icon: "⌨️", label: "Keyboard shortcuts", description: "Quick actions" },
  { id: "help", icon: "❓", label: "Help and About", description: "Version info" },
  { id: "logout", icon: "🚪", label: "Log out", description: "" },
]

function SettingsMenuItem(item: SettingsMenuItem, index: number, isSelected: boolean) {
  return Box(
    {
      width: "100%",
      height: 4,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: isSelected ? WhatsAppTheme.selectedBg : WhatsAppTheme.panelDark,
    },
    Box(
      { width: 4, justifyContent: "center" },
      Text({ content: item.icon, fg: WhatsAppTheme.textSecondary })
    ),
    // Label and description
    Box(
      { flexDirection: "column", flexGrow: 1 },
      Text({
        content: item.label,
        fg: item.id === "logout" ? WDSColors.red[400] : WhatsAppTheme.textPrimary,
        attributes: TextAttributes.BOLD,
      }),
      item.description
        ? Text({
            content: item.description,
            fg: WhatsAppTheme.textSecondary,
          })
        : null
    ),
    // Chevron for navigation items
    item.id !== "logout" ? Text({ content: "›", fg: WhatsAppTheme.textSecondary }) : null
  )
}

/**
 * Toggle switch component - WhatsApp style
 */
function ToggleSwitch(enabled: boolean) {
  return Box(
    {
      width: 5,
      height: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    Text({
      content: !enabled ? "○──" : "──◉",
      fg: !enabled ? WhatsAppTheme.textTertiary : WhatsAppTheme.green,
    })
  )
}

/**
 * Settings row with label, description, and optional toggle or chevron
 */
function SettingsRow(props: {
  label: string
  description?: string
  hasToggle?: boolean
  toggleValue?: boolean
  hasChevron?: boolean
  isSelected?: boolean
}) {
  return Box(
    {
      flexDirection: "row",
      width: "100%",
      justifyContent: "space-between",
      alignItems: "center",
      height: props.description ? 3 : 2,
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: props.isSelected ? WhatsAppTheme.selectedBg : undefined,
    },
    Box(
      { flexDirection: "column", flexGrow: 1 },
      Text({ content: props.label, fg: WhatsAppTheme.textPrimary }),
      props.description
        ? Text({
            content: props.description,
            fg: WhatsAppTheme.textSecondary,
          })
        : null
    ),
    props.hasToggle ? ToggleSwitch(props.toggleValue ?? false) : null,
    props.hasChevron ? Text({ content: "›", fg: WhatsAppTheme.textSecondary }) : null
  )
}

/**
 * Section header for settings pages
 */
function SectionHeader(title: string) {
  return Box(
    {
      paddingLeft: 2,
      paddingTop: 1,
      paddingBottom: 1,
    },
    Text({
      content: title,
      fg: WhatsAppTheme.textTertiary,
    })
  )
}

function ChatsSettingsPage() {
  const state = appState.getState()
  const { enterIsSend, settingsSubIndex } = state

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
    },
    // Header
    Box(
      {
        height: 4,
        paddingLeft: 2,
        paddingTop: 1,
        alignItems: "flex-start",
        backgroundColor: WhatsAppTheme.panelDark,
      },
      Text({
        content: "← Chats",
        fg: WhatsAppTheme.textPrimary,
        attributes: TextAttributes.BOLD,
      })
    ),
    // Chat settings section
    SectionHeader("Chat settings"),
    SettingsRow({
      label: "Enter is send",
      description: "Enter key will send your message",
      hasToggle: true,
      toggleValue: enterIsSend,
      isSelected: settingsSubIndex === 0,
    })
  )
}

function KeyboardShortcutsPage() {
  const shortcuts = [
    { key: "j / ↓", action: "Next item" },
    { key: "k / ↑", action: "Previous item" },
    { key: "Enter", action: "Select / Send" },
    { key: "Escape", action: "Go back" },
    { key: "Tab", action: "Switch focus" },
    { key: "i", action: "Start typing" },
    { key: "r", action: "Reply to message" },
    { key: "m", action: "Context menu" },
    { key: "1-4", action: "Filter chats" },
    { key: "a", action: "Toggle archived" },
    { key: "s", action: "Open settings" },
    { key: "Ctrl+C", action: "Quit" },
  ]

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
    },
    // Header
    Box(
      {
        height: 4,
        paddingLeft: 2,
        paddingTop: 1,
        alignItems: "flex-start",
        backgroundColor: WhatsAppTheme.panelDark,
      },
      Text({
        content: "← Keyboard shortcuts",
        fg: WhatsAppTheme.textPrimary,
        attributes: TextAttributes.BOLD,
      })
    ),
    // Shortcuts list
    Box(
      { flexDirection: "column", paddingTop: 1 },
      ...shortcuts.map((s) =>
        Box(
          {
            flexDirection: "row",
            width: "100%",
            height: 2,
            paddingLeft: 2,
          },
          Box(
            { width: 15 },
            Text({
              content: s.key,
              fg: WhatsAppTheme.green,
              attributes: TextAttributes.BOLD,
            })
          ),
          Text({ content: s.action, fg: WhatsAppTheme.textPrimary })
        )
      )
    )
  )
}

function HelpAboutPage() {
  const state = appState.getState()
  const renderer = getRenderer()

  // Create clickable GitHub link
  const githubLink = new BoxRenderable(renderer, {
    id: "github-link",
    paddingLeft: 2,
    height: 2,
    flexDirection: "row",
    onMouse(event: { type: string; button: number; stopPropagation: () => void }) {
      if (event.type === "down" && event.button === 0) {
        // Open GitHub URL in browser
        Bun.spawn(["xdg-open", "https://github.com/muhammedaksam/waha-tui"])
        event.stopPropagation()
      }
    },
  })

  githubLink.add(
    new TextRenderable(renderer, {
      content: "GitHub: ",
      fg: WhatsAppTheme.textSecondary,
    })
  )

  githubLink.add(
    new TextRenderable(renderer, {
      content: "github.com/muhammedaksam/waha-tui",
      fg: WhatsAppTheme.blue,
      attributes: TextAttributes.UNDERLINE,
    })
  )

  return Box(
    {
      flexDirection: "column",
      flexGrow: 1,
    },
    // Header
    Box(
      {
        height: 4,
        paddingLeft: 2,
        paddingTop: 1,
        alignItems: "flex-start",
        backgroundColor: WhatsAppTheme.panelDark,
      },
      Text({
        content: "← Help and About",
        fg: WhatsAppTheme.textPrimary,
        attributes: TextAttributes.BOLD,
      })
    ),
    // About section
    SectionHeader("About"),
    Box(
      {
        paddingLeft: 2,
        alignItems: "flex-start",
        justifyContent: "flex-start",
        flexDirection: "row",
        gap: 1,
      },
      Logo({})
    ),

    SettingsRow({ label: "Version", description: VersionInfo.version }),
    SettingsRow({ label: "WAHA Tier", description: state.wahaTier || "Unknown" }),
    // Links section
    SectionHeader("Links"),
    githubLink,
    // Credits
    SectionHeader("Credits"),
    Box(
      { paddingLeft: 2 },
      Text({ content: "Built with OpenTUI + Bun", fg: WhatsAppTheme.textTertiary })
    )
  )
}

export function SettingsView() {
  const state = appState.getState()
  const { settingsPage, settingsSelectedIndex, myProfile } = state

  // Settings placeholder for right panel (always shown)
  const settingsPlaceholder = Box(
    {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      gap: 1,
    },
    Text({ content: Icons.settings, fg: WhatsAppTheme.textSecondary }),
    Text({ content: "Settings", fg: WhatsAppTheme.textPrimary })
  )

  // Main menu content (shown when settingsPage === "main")
  const mainMenuContent = Box(
    { flexDirection: "column", flexGrow: 1 },
    // Header - "Settings" title
    Box(
      {
        height: 4,
        paddingLeft: 2,
        paddingTop: 1,
        alignItems: "flex-start",
        backgroundColor: WhatsAppTheme.panelDark,
      },
      Text({
        content: "Settings",
        fg: WhatsAppTheme.textPrimary,
        attributes: TextAttributes.BOLD,
      })
    ),
    // Profile section - name centered vertically with avatar
    Box(
      {
        height: 5,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 2,
        paddingTop: 1,
        paddingBottom: 1,
        gap: 2,
      },
      // Avatar
      Box(
        {
          width: 5,
          height: 3,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: WhatsAppTheme.green,
        },
        Text({
          content: getInitials(myProfile?.name || "U"),
          fg: WhatsAppTheme.white,
          attributes: TextAttributes.BOLD,
        })
      ),
      // Name - centered vertically with avatar
      Box(
        {
          justifyContent: "center",
          height: 3,
        },
        Text({
          content: myProfile?.name || "Unknown",
          fg: WhatsAppTheme.textPrimary,
        })
      )
    ),
    Box({ height: 1 }),
    // Menu items
    ...menuItems.map((item, index) =>
      SettingsMenuItem(item, index, index === settingsSelectedIndex)
    )
  )

  // Left panel content - either main menu or sub-page
  const leftPanelContent =
    settingsPage === "main"
      ? mainMenuContent
      : settingsPage === "chats"
        ? ChatsSettingsPage()
        : settingsPage === "shortcuts"
          ? KeyboardShortcutsPage()
          : settingsPage === "help"
            ? HelpAboutPage()
            : mainMenuContent

  // Right panel always shows placeholder
  const rightPanelContent = Box(
    {
      flexGrow: 1,
      flexDirection: "column",
      backgroundColor: WhatsAppTheme.background,
    },
    settingsPlaceholder
  )

  return ThreePanelLayout({
    leftPanel: leftPanelContent,
    rightPanel: rightPanelContent,
  })
}

/**
 * Get list of menu item IDs for navigation
 */
export function getSettingsMenuItems(): Array<SettingsPage | "logout"> {
  return menuItems.map((m) => m.id)
}
