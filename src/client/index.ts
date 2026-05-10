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
export {
  archiveChat,
  unarchiveChat,
  markChatUnread,
  deleteChat,
  setChatEphemeral,
} from "~/client/chatActions"

// Message actions
export {
  starMessage,
  pinMessage,
  unpinMessage,
  deleteMessage,
  editMessage,
  forwardMessage,
  reactToMessage,
  loadMessages,
  loadOlderMessages,
  sendMessage,
  sendPoll,
  sendPollVote,
  sendTypingState,
  prefetchMessagesForTopChats,
  downloadAndOpenMedia,
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
  loadLabels,
} from "~/client/sessionActions"

// Presence actions
export {
  markActivity,
  setSessionPresence,
  subscribeToPresence,
  startPresenceManagement,
  stopPresenceManagement,
} from "~/client/presenceActions"

// Group actions
export {
  loadGroupMetadata,
  updateGroupSubject,
  updateGroupDescription,
  leaveGroup,
  getGroupInviteLink,
  revokeGroupInviteLink,
  addParticipants,
  removeParticipants,
  promoteParticipants,
  demoteParticipants,
  updateGroupSecurity,
} from "~/client/groupActions"
