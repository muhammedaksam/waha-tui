/**
 * Group Actions
 * Functions for group management operations (subject, description, participants, invite links)
 */

import { GroupParticipant } from "@muhammedaksam/waha-node"

import { getClient, getSession } from "~/client/core"
import { showToast } from "~/components/Toast"
import { errorService } from "~/services/ErrorService"
import { appState } from "~/state/AppState"
import { GroupMetadata } from "~/state/slices/ChatSlice"
import { debugLog } from "~/utils/debug"

/**
 * Load detailed metadata for a group.
 */
export async function loadGroupMetadata(chatId: string): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    debugLog("Groups", `Loading metadata for group: ${chatId}`)

    // Use the correct method name from waha-node
    const response = await wahaClient.groups.groupsControllerGetGroup(session, chatId)
    const data = response.data as unknown
    const rawData = (data && typeof data === "object" ? data : {}) as Record<string, unknown>
    const gm = (rawData.groupMetadata as Record<string, unknown>) || {}

    const rawParticipants =
      (gm.participants as unknown[]) || (rawData.participants as unknown[]) || []
    const participants: GroupParticipant[] = rawParticipants.map((item: unknown) => {
      const p = item as Record<string, unknown>
      const roleValue = (p.role as string) || (p.isAdmin ? "admin" : "participant")
      return {
        ...p,
        id:
          typeof p.id === "string"
            ? p.id
            : (p.id as { _serialized?: string })?._serialized ||
              (p.id as { id?: string })?.id ||
              "",
        role: roleValue as "admin" | "participant" | "left" | "superadmin",
      } as GroupParticipant
    })

    const metadata: GroupMetadata = {
      id:
        (rawData.id as { _serialized?: string })?._serialized ||
        (typeof rawData.id === "string" ? rawData.id : chatId),
      subject: (rawData.subject as string) || (rawData.name as string) || "Group",
      owner:
        (rawData.owner as { _serialized?: string })?._serialized ||
        (typeof rawData.owner === "string" ? rawData.owner : ""),
      creation: Number(rawData.creation) || 0,
      desc: (rawData.desc as string) || (gm.desc as string) || "",
      participants: participants,
      membersCanChangeGroupInfo: gm.restrict === false,
      membersCanSendMessages: gm.announce === false,
      membersCanAddNewMember: gm.memberAddMode === "all_member_add",
      newMembersApprovalRequired: gm.membershipApprovalMode === true,
    }

    debugLog("Groups", `Mapped Metadata for ${chatId}: ${JSON.stringify(metadata)}`)

    appState.setCurrentGroupMetadata(metadata)

    // Also update participants
    if (metadata.participants && metadata.participants.length > 0) {
      appState.setCurrentChatParticipants(metadata.participants)
    }

    debugLog("Groups", `Metadata loaded for group: ${chatId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "loadGroupMetadata", chatId } })
    // If it fails, we still want to show the view but with limited data
    appState.setCurrentGroupMetadata({
      id: chatId,
      subject: "Error loading info",
      error: "Failed to load metadata",
    } as unknown as GroupMetadata)
  }
}

/**
 * Update group subject (name).
 */
export async function updateGroupSubject(chatId: string, subject: string): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    await wahaClient.groups.groupsControllerSetSubject(session, chatId, { subject })
    debugLog("Groups", `Updated subject for ${chatId}: ${subject}`)
    await loadGroupMetadata(chatId)
  } catch (error) {
    errorService.handle(error, { context: { action: "updateGroupSubject", chatId } })
    throw error
  }
}

/**
 * Update group description.
 */
export async function updateGroupDescription(chatId: string, description: string): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    await wahaClient.groups.groupsControllerSetDescription(session, chatId, { description })
    debugLog("Groups", `Updated description for ${chatId}`)
    await loadGroupMetadata(chatId)
  } catch (error) {
    errorService.handle(error, { context: { action: "updateGroupDescription", chatId } })
    throw error
  }
}

/**
 * Leave a group.
 */
export async function leaveGroup(chatId: string): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    await wahaClient.groups.groupsControllerLeaveGroup(session, chatId)
    debugLog("Groups", `Left group: ${chatId}`)
    appState.setCurrentChat(null)
    appState.setCurrentView("chats")
  } catch (error) {
    errorService.handle(error, { context: { action: "leaveGroup", chatId } })
    throw error
  }
}

/**
 * Get group invite link.
 */
export async function getGroupInviteLink(chatId: string): Promise<string | null> {
  const session = getSession()
  if (!session) return null

  try {
    const wahaClient = getClient()
    const response = await wahaClient.groups.groupsControllerGetInviteCode(session, chatId)
    // Cast to any briefly to access data property if it's an object, or use it directly if it's a string
    const data = response.data as unknown as { code?: string }
    const code = data.code || response.data
    return `https://chat.whatsapp.com/${code}`
  } catch (error) {
    debugLog("Groups", `Failed to get invite link: ${error}`)
    return null
  }
}

/**
 * Revoke group invite link.
 */
export async function revokeGroupInviteLink(chatId: string): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    await wahaClient.groups.groupsControllerRevokeInviteCode(session, chatId)
    debugLog("Groups", `Revoked invite link for ${chatId}`)
  } catch (error) {
    errorService.handle(error, { context: { action: "revokeGroupInviteLink", chatId } })
    throw error
  }
}

/**
 * Participant Management
 */

export async function addParticipants(chatId: string, participantIds: string[]): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    await wahaClient.groups.groupsControllerAddParticipants(session, chatId, {
      participants: participantIds.map((id) => ({ id })),
    })
    debugLog("Groups", `Added participants to ${chatId}: ${participantIds.join(", ")}`)
    await loadGroupMetadata(chatId)
  } catch (error) {
    errorService.handle(error, { context: { action: "addParticipants", chatId } })
    throw error
  }
}

export async function removeParticipants(chatId: string, participantIds: string[]): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    await wahaClient.groups.groupsControllerRemoveParticipants(session, chatId, {
      participants: participantIds.map((id) => ({ id })),
    })
    debugLog("Groups", `Removed participants from ${chatId}: ${participantIds.join(", ")}`)
    await loadGroupMetadata(chatId)
  } catch (error) {
    errorService.handle(error, { context: { action: "removeParticipants", chatId } })
    throw error
  }
}

export async function promoteParticipants(chatId: string, participantIds: string[]): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    await wahaClient.groups.groupsControllerPromoteToAdmin(session, chatId, {
      participants: participantIds.map((id) => ({ id })),
    })
    debugLog("Groups", `Promoted participants in ${chatId}: ${participantIds.join(", ")}`)
    await loadGroupMetadata(chatId)
  } catch (error) {
    errorService.handle(error, { context: { action: "promoteParticipants", chatId } })
    throw error
  }
}

export async function demoteParticipants(chatId: string, participantIds: string[]): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    await wahaClient.groups.groupsControllerDemoteToAdmin(session, chatId, {
      participants: participantIds.map((id) => ({ id })),
    })
    debugLog("Groups", `Demoted participants in ${chatId}: ${participantIds.join(", ")}`)
    await loadGroupMetadata(chatId)
  } catch (error) {
    errorService.handle(error, { context: { action: "demoteParticipants", chatId } })
    throw error
  }
}

/**
 * Update group security settings (info admin only, messages admin only)
 */
export async function updateGroupSecurity(
  chatId: string,
  type: "info-admin-only" | "messages-admin-only",
  adminsOnly: boolean
): Promise<void> {
  const session = getSession()
  if (!session) return

  try {
    const wahaClient = getClient()
    const data = { adminsOnly }

    if (type === "info-admin-only") {
      await wahaClient.groups.groupsControllerSetInfoAdminOnly(session, chatId, data)
      appState.updateGroupMetadata(chatId, { membersCanChangeGroupInfo: !adminsOnly })
    } else {
      await wahaClient.groups.groupsControllerSetMessagesAdminOnly(session, chatId, data)
      appState.updateGroupMetadata(chatId, { membersCanSendMessages: !adminsOnly })
    }

    debugLog("Groups", `Updated security ${type} for ${chatId} to ${adminsOnly}`)
    // Still load from server after a short delay to ensure consistency
    setTimeout(() => loadGroupMetadata(chatId), 500)
  } catch (error: unknown) {
    if (error && typeof error === "object" && "response" in error) {
      const response = error.response as { status?: number }
      if (response?.status === 404) {
        showToast(`Setting ${type} is not supported by your WAHA version.`, "error")
      }
    }
    errorService.handle(error, {
      context: { action: "updateGroupSecurity", chatId, type, adminsOnly },
    })
    throw error
  }
}
