/**
 * Client Module Barrel Export
 * Re-exports all client functions for backwards compatibility
 */

// Core functions
export {
  initializeClient,
  getClient,
  getSession,
  testConnection,
  copyToClipboard,
} from "~/client/core"

// Chat actions
export { archiveChat, unarchiveChat, markChatUnread, deleteChat } from "~/client/chatActions"

// Message actions
export {
  starMessage,
  pinMessage,
  unpinMessage,
  deleteMessage,
  forwardMessage,
  reactToMessage,
  loadMessages,
  loadOlderMessages,
  sendMessage,
  sendTypingState,
  prefetchMessagesForTopChats,
} from "~/client/messageActions"

// Session & data loading actions
export {
  loadSessions,
  logoutSession,
  deleteSession,
  loadAllContacts,
  loadChats,
  pollChats,
  loadContacts,
  loadLidMappings,
  loadChatDetails,
  fetchMyProfile,
} from "~/client/sessionActions"

// Presence actions
export {
  markActivity,
  setSessionPresence,
  subscribeToPresence,
  startPresenceManagement,
  stopPresenceManagement,
} from "~/client/presenceActions"
