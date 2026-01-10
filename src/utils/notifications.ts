/**
 * Notification Service
 * Cross-platform desktop notifications using node-notifier
 *
 * Supports:
 * - Linux: libnotify (notify-send)
 * - macOS: Notification Center
 * - Windows: Windows Toaster
 *
 * Note: Click callbacks may not work on all Linux notification daemons
 */

import notifier from "node-notifier"

import { getSettings } from "~/config/manager"
import { debugLog } from "~/utils/debug"

interface NotificationOptions {
  title: string
  message: string
  subtitle?: string
  sound?: boolean
}

/**
 * Send a desktop notification
 */
export async function sendNotification(options: NotificationOptions): Promise<void> {
  const { title, message, subtitle, sound = true } = options

  try {
    notifier.notify({ title, message, subtitle, sound, timeout: 5 })
    debugLog("Notifications", `Sent: "${title}" - "${message}"`)
  } catch (error) {
    debugLog("Notifications", `Failed to send notification: ${error}`)
  }
}

/**
 * Send a notification for a new message
 */
export async function notifyNewMessage(
  senderName: string,
  messagePreview: string,
  isGroup: boolean,
  groupName?: string,
  isStatus: boolean = false
): Promise<void> {
  const settings = await getSettings()

  // Get the appropriate notification settings based on message type
  let notifSettings
  let typeName: string
  if (isStatus) {
    notifSettings = settings.statusNotifications
    typeName = "status"
  } else if (isGroup) {
    notifSettings = settings.groupNotifications
    typeName = "groups"
  } else {
    notifSettings = settings.messageNotifications
    typeName = "messages"
  }

  // Check if notifications are enabled for this type
  if (!notifSettings.showNotifications) {
    debugLog("Notifications", `Notifications disabled for ${typeName}, skipping`)
    return
  }

  const title = isStatus
    ? `${senderName} posted a status`
    : isGroup && groupName
      ? `${senderName} in ${groupName}`
      : senderName

  // Use preview if enabled, otherwise show generic message
  let preview: string
  if (settings.showPreviews && !isStatus) {
    preview = messagePreview.length > 100 ? messagePreview.slice(0, 97) + "..." : messagePreview
  } else if (isStatus) {
    preview = "New status update"
  } else {
    preview = "New message"
  }

  await sendNotification({
    title,
    message: preview,
    sound: notifSettings.playSound,
  })
}

/**
 * Send a notification for a reaction (if enabled)
 */
export async function notifyReaction(
  senderName: string,
  reaction: string,
  isGroup: boolean,
  groupName?: string
): Promise<void> {
  const settings = await getSettings()

  // Get the appropriate notification settings based on message type
  const notifSettings = isGroup ? settings.groupNotifications : settings.messageNotifications

  // Check if reaction notifications are enabled for this type
  if (!notifSettings.showReactionNotifications) {
    debugLog(
      "Notifications",
      `Reaction notifications disabled for ${isGroup ? "groups" : "messages"}, skipping`
    )
    return
  }

  const title = isGroup && groupName ? `${senderName} in ${groupName}` : senderName

  await sendNotification({
    title,
    message: `Reacted with ${reaction}`,
    sound: notifSettings.playSound,
  })
}
