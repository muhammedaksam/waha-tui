import { GroupParticipant } from "@muhammedaksam/waha-node"
import { Box, Text, TextAttributes, VChild } from "@opentui/core"

import { leaveGroup, loadGroupMetadata, setChatEphemeral, updateGroupSecurity } from "~/client"
import { showConfirmModal } from "~/components/Modal"
import { showToast } from "~/components/Toast"
import { WDSColors, WhatsAppTheme } from "~/config/theme"
import { appState } from "~/state/AppState"
import { getContactName, getInitials, getPhoneNumber, isGroupChat } from "~/utils/formatters"

/**
 * Sidebar Header Component
 */
function SidebarHeader({
  title,
  onBack,
  onClose,
  isSubView = false,
}: {
  title: string
  onBack?: () => void
  onClose?: () => void
  isSubView?: boolean
}) {
  return Box(
    {
      height: 4,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelLight,
    },
    Box(
      {
        onMouse: (e) => {
          if (e.type === "down") {
            if (isSubView && onBack) onBack()
            else if (onClose) onClose()
          }
        },
        marginRight: 2,
      },
      Text({
        content: isSubView ? "←" : "✕",
        fg: WhatsAppTheme.textPrimary,
        attributes: TextAttributes.BOLD,
      })
    ),
    Text({
      content: title,
      fg: WhatsAppTheme.textPrimary,
      attributes: TextAttributes.BOLD,
    })
  )
}

/**
 * Standard Sidebar Section
 */
function Section({
  children,
  marginBottom = 2,
  padding = 2,
}: {
  children: VChild[]
  marginBottom?: number
  padding?: number
}) {
  return Box(
    {
      padding,
      flexDirection: "column",
      backgroundColor: WhatsAppTheme.panelDark,
      marginBottom,
    },
    ...children
  )
}

/**
 * Participant Row Component
 */
function ParticipantRow(p: GroupParticipant, isMe: boolean) {
  const state = appState.getState()
  const name = getContactName(p.id, state.allContacts)
  const isAdmin = p.role === "admin" || p.role === "superadmin"

  return Box(
    {
      height: 3,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelDark,
      border: ["bottom"],
      borderColor: WhatsAppTheme.divider,
    },
    // Avatar
    Box(
      {
        width: 2,
        height: 1,
        backgroundColor: WhatsAppTheme.green,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 2,
      },
      Text({ content: getInitials(name), fg: WhatsAppTheme.white })
    ),
    // Name and phone column
    Box(
      { flexDirection: "column", flexGrow: 1 },
      Text({
        content: isMe ? `${name} (You)` : name,
        fg: WhatsAppTheme.textPrimary,
      }),
      (p.pn || appState.getPhoneFromLid(p.id)) && (p.pn || appState.getPhoneFromLid(p.id)) !== name
        ? Text({
            content: getPhoneNumber(p.pn || appState.getPhoneFromLid(p.id)).replace(
              /^(\d+)/,
              "+$1"
            ),
            fg: WhatsAppTheme.textSecondary,
          })
        : null
    ),
    // Admin Badge
    isAdmin
      ? Box(
          {
            paddingLeft: 1,
            paddingRight: 1,
            border: true,
            borderColor: WhatsAppTheme.green,
          },
          Text({
            content: "Admin",
            fg: WhatsAppTheme.green,
          })
        )
      : null
  )
}

/**
 * Generic Setting Row Component
 */
function SettingRow({
  icon,
  label,
  value,
  onClick,
  color = WhatsAppTheme.textPrimary,
  showChevron = true,
}: {
  icon: string
  label: string
  value?: string
  onClick?: () => void
  color?: string
  showChevron?: boolean
}) {
  return Box(
    {
      height: 3,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 2,
      paddingRight: 2,
      backgroundColor: WhatsAppTheme.panelDark,
      onMouse: (e) => {
        if (e.type === "down" && onClick) onClick()
      },
    },
    Text({ content: icon, fg: WhatsAppTheme.textSecondary, marginRight: 2, width: 3 }),
    Box(
      { flexDirection: "column", flexGrow: 1 },
      Text({ content: label, fg: color }),
      value ? Text({ content: value, fg: WhatsAppTheme.textSecondary }) : null
    ),
    onClick && showChevron ? Text({ content: "›", fg: WhatsAppTheme.textTertiary }) : null
  )
}

/**
 * Generic Setting Toggle Component
 */
function SettingToggle({
  label,
  value,
  onToggle,
  description,
}: {
  label: string
  value: boolean
  onToggle: (v: boolean) => void
  description?: string
}) {
  return Box(
    {
      padding: 2,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: WhatsAppTheme.panelDark,
      onMouse: (e) => {
        if (e.type === "down") onToggle(!value)
      },
    },
    Box(
      { flexDirection: "column", flexGrow: 1 },
      Text({ content: label, fg: WhatsAppTheme.textPrimary }),
      description
        ? Text({ content: description, fg: WhatsAppTheme.textSecondary, marginTop: 1 })
        : null
    ),
    Text({
      content: value ? "ON" : "OFF",
      fg: value ? WhatsAppTheme.green : WhatsAppTheme.textTertiary,
      attributes: TextAttributes.BOLD,
    })
  )
}

/**
 * Disappearing Messages Sub-View
 */
function DisappearingMessagesView() {
  const metadata = appState.getState().currentGroupMetadata
  const options = [
    { label: "24 hours", value: "86400" },
    { label: "7 days", value: "604800" },
    { label: "90 days", value: "7776000" },
    { label: "Off", value: "0" },
  ]

  return Box(
    { flexGrow: 1, flexDirection: "column", backgroundColor: WhatsAppTheme.deepDark },
    SidebarHeader({
      title: "Disappearing messages",
      isSubView: true,
      onBack: () => appState.setRightSidebarSubView("main"),
    }),

    // Description
    Section({
      children: [
        Text({
          content:
            "For more privacy and storage, all new messages will disappear from this chat for everyone after the selected duration, except when kept. Anyone in the chat can change this setting.",
          fg: WhatsAppTheme.textSecondary,
          marginBottom: 1,
        }),
        Text({
          content: "Learn more",
          fg: WhatsAppTheme.blue,
        }),
      ],
    }),

    // Options
    Section({
      padding: 0,
      children: options.map((opt) =>
        Box(
          {
            height: 3,
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: 2,
            paddingRight: 2,
            border: ["bottom"],
            borderColor: WhatsAppTheme.divider,
            onMouse: async (e) => {
              if (e.type === "down") {
                const chatId = appState.getState().currentChatId
                if (chatId) {
                  // This will likely 404 in Core, but we have the UI ready
                  await setChatEphemeral(chatId, parseInt(opt.value))
                }
              }
            },
          },
          Box(
            { flexDirection: "column", flexGrow: 1 },
            Text({
              content: opt.label,
              fg:
                (metadata?.ephemeralDuration?.toString() || "0") === opt.value
                  ? WhatsAppTheme.green
                  : WhatsAppTheme.textPrimary,
            })
          ),
          Text({
            content: (metadata?.ephemeralDuration?.toString() || "0") === opt.value ? "◉" : "○",
            fg:
              (metadata?.ephemeralDuration?.toString() || "0") === opt.value
                ? WhatsAppTheme.green
                : WhatsAppTheme.textTertiary,
          })
        )
      ),
    }),

    Box(
      { padding: 2 },
      Text({
        content:
          "⚠️ Programmatically setting ephemeral duration is currently only supported in WAHA NOWEB engine.",
        fg: WDSColors.yellow[400],
        attributes: TextAttributes.ITALIC,
      })
    )
  )
}

/**
 * Group Permissions Sub-View
 */
function GroupPermissionsView() {
  const metadata = appState.getState().currentGroupMetadata
  const chatId = appState.getState().currentChatId

  return Box(
    { flexGrow: 1, flexDirection: "column", backgroundColor: WhatsAppTheme.deepDark },
    SidebarHeader({
      title: "Group permissions",
      isSubView: true,
      onBack: () => appState.setRightSidebarSubView("main"),
    }),
    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),

    Section({
      padding: 0,
      children: [
        SettingToggle({
          label: "Edit group settings",
          description: "All members can edit this group's settings",
          value: metadata?.membersCanChangeGroupInfo !== false, // Default to true if unknown
          onToggle: async (v) => {
            if (chatId) await updateGroupSecurity(chatId, "info-admin-only", !v)
          },
        }),
        SettingToggle({
          label: "Send messages",
          description: "All members can send messages in this group",
          value: metadata?.membersCanSendMessages !== false,
          onToggle: async (v) => {
            if (chatId) await updateGroupSecurity(chatId, "messages-admin-only", !v)
          },
        }),
        SettingToggle({
          label: "Add other participants",
          description: "All members can add other participants to this group",
          value: metadata?.membersCanAddNewMember !== false,
          onToggle: () =>
            showToast(
              "This setting is currently only adjustable via the WhatsApp mobile app.",
              "info"
            ),
        }),
      ],
    }),

    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),

    Section({
      padding: 0,
      children: [
        Text({
          content: "Admins can:",
          fg: WhatsAppTheme.textSecondary,
          padding: 2,
          paddingBottom: 1,
        }),
        SettingToggle({
          label: "Approve new members",
          description: "When turned on, admins must approve anyone who wants to join the group.",
          value: metadata?.newMembersApprovalRequired === true,
          onToggle: () =>
            showToast(
              "This setting is currently only adjustable via the WhatsApp mobile app.",
              "info"
            ),
        }),
      ],
    }),

    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),
    SettingRow({
      icon: "👮",
      label: "Edit group admins",
      onClick: () => appState.setRightSidebarSubView("admins"),
    })
  )
}

/**
 * Advanced Privacy Sub-View
 */
function AdvancedPrivacyView() {
  return Box(
    { flexGrow: 1, flexDirection: "column", backgroundColor: WhatsAppTheme.deepDark },
    SidebarHeader({
      title: "Advanced chat privacy",
      isSubView: true,
      onBack: () => appState.setRightSidebarSubView("main"),
    }),
    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),
    SettingToggle({
      label: "Protect IP address in calls",
      description:
        "To make it harder for people to infer your location, calls on this device will be securely relayed through WhatsApp servers. This will reduce call quality.",
      value: false,
      onToggle: () => {},
    }),
    Box(
      { padding: 2 },
      Text({
        content:
          "⚠️ Advanced privacy settings are currently handled by the WhatsApp mobile app and are not yet exposed via the WAHA REST API.",
        fg: WDSColors.yellow[400],
        attributes: TextAttributes.ITALIC,
      })
    )
  )
}

/**
 * Member Changes Sub-View
 */
function MemberChangesView() {
  return Box(
    { flexGrow: 1, flexDirection: "column", backgroundColor: WhatsAppTheme.deepDark },
    SidebarHeader({
      title: "Member changes",
      isSubView: true,
      onBack: () => appState.setRightSidebarSubView("main"),
    }),
    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),
    SettingToggle({
      label: "Show member changes",
      description: "Show notifications in this chat when members join or leave.",
      value: true,
      onToggle: () => {},
    }),
    Box(
      { padding: 2 },
      Text({
        content:
          "⚠️ This setting is a UI placeholder and does not affect server-side member notifications.",
        fg: WDSColors.yellow[400],
        attributes: TextAttributes.ITALIC,
      })
    )
  )
}

/**
 * Group Admins Sub-View
 */
function GroupAdminsView() {
  const state = appState.getState()
  const participants = state.currentChatParticipants || []
  const admins = participants.filter((p) => p.role === "admin" || p.role === "superadmin")

  return Box(
    { flexGrow: 1, flexDirection: "column", backgroundColor: WhatsAppTheme.deepDark },
    SidebarHeader({
      title: "Edit group admins",
      isSubView: true,
      onBack: () => appState.setRightSidebarSubView("permissions"),
    }),
    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),
    ...admins.map((p) => ParticipantRow(p, p.id === state.myProfile?.id))
  )
}

/**
 * Contact Info View (for 1:1 chats)
 */
function ContactInfoView() {
  const state = appState.getState()
  const chatId = state.currentChatId
  if (!chatId) return null

  const name = getContactName(chatId, state.allContacts)
  const presence = state.chatPresences.get(chatId)
  const isOnline = presence?.presences?.some((p) => p.lastKnownPresence === "online")

  return Box(
    { flexGrow: 1, flexDirection: "column", backgroundColor: WhatsAppTheme.deepDark },
    SidebarHeader({
      title: "Contact info",
      onClose: () => appState.setRightSidebar("none"),
    }),

    // Profile Section
    Section({
      padding: 0,
      children: [
        Box(
          {
            height: 10,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: WhatsAppTheme.panelDark,
          },
          Box(
            {
              width: 10,
              height: 5,
              backgroundColor: WhatsAppTheme.green,
              justifyContent: "center",
              alignItems: "center",
            },
            Text({ content: getInitials(name), fg: WhatsAppTheme.white })
          )
        ),
        Box(
          { padding: 2, flexDirection: "column", alignItems: "center" },
          Text({
            content: name,
            fg: WhatsAppTheme.white,
            attributes: TextAttributes.BOLD,
            marginBottom: 1,
          }),
          Text({
            content: getPhoneNumber(appState.getPhoneFromLid(chatId) || chatId).replace(
              /^(\d+)/,
              "+$1"
            ),
            fg: WhatsAppTheme.textSecondary,
          }),
          isOnline
            ? Text({
                content: "online",
                fg: WhatsAppTheme.green,
                marginTop: 1,
              })
            : null
        ),
      ],
    }),

    // Media Section
    SettingRow({ icon: "🖼️", label: "Media, links and docs", value: "0" }),
    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),

    // Settings
    SettingRow({ icon: "⭐", label: "Starred messages" }),
    SettingRow({ icon: "🔔", label: "Mute notifications", value: "Off" }),
    SettingRow({
      icon: "🔒",
      label: "Encryption",
      value: "Messages are end-to-end encrypted. Click to learn more.",
    }),
    SettingRow({
      icon: "⏲️",
      label: "Disappearing messages",
      value: "Off",
      onClick: () => appState.setRightSidebarSubView("disappearing-messages"),
    }),
    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),

    // Groups in Common
    SettingRow({ icon: "👥", label: "Groups in common", value: "0 groups" }),
    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),

    // Actions
    SettingRow({ icon: "🚫", label: `Block ${name}`, color: "#f15c5c" }),
    SettingRow({ icon: "👎", label: `Report ${name}`, color: "#f15c5c" }),
    SettingRow({ icon: "🗑️", label: "Delete chat", color: "#f15c5c" })
  )
}

/**
 * Main Entry Point for Right Sidebar
 */
export function GroupInfoView() {
  const state = appState.getState()
  const subView = state.rightSidebarSubView
  const metadata = state.currentGroupMetadata
  const chatId = state.currentChatId

  if (!chatId) return null

  // Route to sub-views
  if (subView === "permissions") return GroupPermissionsView()
  if (subView === "admins") return GroupAdminsView()
  if (subView === "disappearing-messages") return DisappearingMessagesView()
  if (subView === "advanced-privacy") return AdvancedPrivacyView()
  if (subView === "member-changes") return MemberChangesView()

  const isGroup = isGroupChat(chatId)

  // 1:1 Contact Info
  if (!isGroup) {
    return ContactInfoView()
  }

  // Group Info
  if (!metadata) {
    loadGroupMetadata(chatId)
    return Box(
      {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: WhatsAppTheme.panelDark,
      },
      Text({ content: "Loading group info...", fg: WhatsAppTheme.textSecondary })
    )
  }

  const groupName = metadata.subject || "Group Info"
  const description = metadata.desc || ""
  const participants = state.currentChatParticipants || []
  const myId = state.myProfile?.id

  return Box(
    {
      flexGrow: 1,
      flexDirection: "column",
      backgroundColor: WhatsAppTheme.deepDark,
    },
    SidebarHeader({
      title: "Group info",
      onClose: () => appState.setRightSidebar("none"),
    }),

    // Top Card
    Section({
      padding: 0,
      children: [
        Box(
          {
            height: 10,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: WhatsAppTheme.panelDark,
          },
          Box(
            {
              width: 10,
              height: 5,
              backgroundColor: WhatsAppTheme.panelLight,
              justifyContent: "center",
              alignItems: "center",
            },
            Text({ content: "👥", fg: WhatsAppTheme.textSecondary })
          )
        ),
        Box(
          { padding: 2, flexDirection: "column", alignItems: "center" },
          Box(
            { flexDirection: "row", alignItems: "center", marginBottom: 1 },
            Text({
              content: groupName,
              fg: WhatsAppTheme.white,
              attributes: TextAttributes.BOLD,
              marginRight: 1,
            }),
            Text({ content: "✎", fg: WhatsAppTheme.textTertiary })
          ),
          Text({
            content: `Group · ${participants.length} member${participants.length === 1 ? "" : "s"}`,
            fg: WhatsAppTheme.textSecondary,
          })
        ),
        // Action Buttons Row
        Box(
          {
            flexDirection: "row",
            justifyContent: "space-around",
            padding: 2,
            border: ["top"],
            borderColor: WhatsAppTheme.divider,
          },
          Box(
            { flexDirection: "column", alignItems: "center" },
            Text({ content: "👤+", fg: WhatsAppTheme.green, marginBottom: 1 }),
            Text({ content: "Add", fg: WhatsAppTheme.green })
          ),
          Box(
            { flexDirection: "column", alignItems: "center" },
            Text({ content: "🔍", fg: WhatsAppTheme.green, marginBottom: 1 }),
            Text({ content: "Search", fg: WhatsAppTheme.green })
          )
        ),
      ],
    }),

    // Description Section
    Section({
      children: [
        Text({
          content: description || "Add group description",
          fg: description ? WhatsAppTheme.textPrimary : WhatsAppTheme.green,
          marginBottom: 1,
        }),
        Text({
          content: `Group created by you, today at ${new Date().getHours()}:${new Date().getMinutes().toString().padStart(2, "0")}`,
          fg: WhatsAppTheme.textSecondary,
          marginTop: 1,
        }),
      ],
    }),

    // Settings rows
    SettingRow({ icon: "🖼️", label: "Media, links and docs", value: "0" }),
    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),

    SettingRow({ icon: "⭐", label: "Starred messages" }),
    SettingRow({ icon: "🔔", label: "Notification settings" }),
    SettingRow({
      icon: "🔒",
      label: "Encryption",
      value: "Messages are end-to-end encrypted. Click to learn more.",
      showChevron: false,
    }),
    SettingRow({
      icon: "⏲️",
      label: "Disappearing messages",
      value:
        metadata?.ephemeralDuration === 86400
          ? "24 hours"
          : metadata?.ephemeralDuration === 604800
            ? "7 days"
            : metadata?.ephemeralDuration === 7776000
              ? "90 days"
              : "Off",
      onClick: () => appState.setRightSidebarSubView("disappearing-messages"),
    }),
    SettingRow({
      icon: "🛡️",
      label: "Advanced chat privacy",
      value: "Off",
      onClick: () => appState.setRightSidebarSubView("advanced-privacy"),
    }),
    SettingRow({
      icon: "⚙️",
      label: "Group permissions",
      onClick: () => appState.setRightSidebarSubView("permissions"),
    }),
    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),

    // Participants List Header
    Box(
      {
        paddingLeft: 2,
        paddingTop: 1,
        paddingBottom: 1,
        backgroundColor: WhatsAppTheme.panelDark,
      },
      Text({
        content: `${participants.length} member${participants.length === 1 ? "" : "s"}`,
        fg: WhatsAppTheme.textSecondary,
      })
    ),

    // Participants List
    Box({ flexDirection: "column" }, ...participants.map((p) => ParticipantRow(p, p.id === myId))),
    Box({ height: 1, backgroundColor: WhatsAppTheme.deepDark }),

    // Exit Actions
    SettingRow({
      icon: "🚪",
      label: "Exit group",
      color: "#f15c5c",
      onClick: async () => {
        const confirmed = await showConfirmModal(
          "Exit group?",
          "Are you sure you want to exit this group?",
          "Exit",
          "danger"
        )
        if (confirmed) {
          await leaveGroup(chatId)
          appState.setRightSidebar("none")
        }
      },
    }),
    SettingRow({ icon: "👎", label: "Report group", color: "#f15c5c" })
  )
}
