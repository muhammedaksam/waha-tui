import { SliceActions, StateSlice } from "~/state/slices/types"

export type SettingsPage =
  | "main"
  | "chats"
  | "notifications"
  | "notifications-messages"
  | "notifications-groups"
  | "notifications-status"
  | "shortcuts"
  | "help"

export interface NotificationSettings {
  showNotifications: boolean
  showReactionNotifications: boolean
  playSound: boolean
}

export interface SettingsState {
  settingsPage: SettingsPage
  settingsSelectedIndex: number
  settingsSubIndex: number
  enterIsSend: boolean
  messageNotifications: NotificationSettings
  groupNotifications: NotificationSettings
  statusNotifications: NotificationSettings
  showPreviews: boolean
  backgroundSync: boolean
}

export const initialSettingsState: SettingsState = {
  settingsPage: "main",
  settingsSelectedIndex: 0,
  settingsSubIndex: 0,
  enterIsSend: true,
  messageNotifications: {
    showNotifications: true,
    showReactionNotifications: false,
    playSound: true,
  },
  groupNotifications: {
    showNotifications: true,
    showReactionNotifications: false,
    playSound: true,
  },
  statusNotifications: {
    showNotifications: false,
    showReactionNotifications: false,
    playSound: false,
  },
  showPreviews: true,
  backgroundSync: true,
}

export interface SettingsActions extends SliceActions<SettingsState> {
  setSettingsPage(settingsPage: SettingsPage): void
  setSettingsSelectedIndex(settingsSelectedIndex: number): void
  setSettingsSubIndex(settingsSubIndex: number): void
  setEnterIsSend(enterIsSend: boolean): void
  setMessageNotifications(settings: Partial<NotificationSettings>): void
  setGroupNotifications(settings: Partial<NotificationSettings>): void
  setStatusNotifications(settings: Partial<NotificationSettings>): void
  setShowPreviews(showPreviews: boolean): void
  setBackgroundSync(backgroundSync: boolean): void
}

export function createSettingsSlice(): StateSlice<SettingsState> & SettingsActions {
  let state: SettingsState = { ...initialSettingsState }
  const listeners: Array<(state: SettingsState) => void> = []

  const notify = () => {
    listeners.forEach((l) => l(state))
  }

  return {
    name: "settings",
    get: () => ({ ...state }),
    set: (updates: Partial<SettingsState>) => {
      state = { ...state, ...updates }
      notify()
    },
    getState: () => ({ ...state }),
    setState: (updates: Partial<SettingsState>) => {
      state = { ...state, ...updates }
      notify()
    },
    subscribe: (listener: (state: SettingsState) => void) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    reset: () => {
      state = { ...initialSettingsState }
      notify()
    },

    setSettingsPage(settingsPage: SettingsPage) {
      state = { ...state, settingsPage }
      notify()
    },

    setSettingsSelectedIndex(settingsSelectedIndex: number) {
      state = { ...state, settingsSelectedIndex }
      notify()
    },

    setSettingsSubIndex(settingsSubIndex: number) {
      state = { ...state, settingsSubIndex }
      notify()
    },

    setEnterIsSend(enterIsSend: boolean) {
      state = { ...state, enterIsSend }
      notify()
    },

    setMessageNotifications(settings: Partial<NotificationSettings>) {
      state = {
        ...state,
        messageNotifications: { ...state.messageNotifications, ...settings },
      }
      notify()
    },

    setGroupNotifications(settings: Partial<NotificationSettings>) {
      state = {
        ...state,
        groupNotifications: { ...state.groupNotifications, ...settings },
      }
      notify()
    },

    setStatusNotifications(settings: Partial<NotificationSettings>) {
      state = {
        ...state,
        statusNotifications: { ...state.statusNotifications, ...settings },
      }
      notify()
    },

    setShowPreviews(showPreviews: boolean) {
      state = { ...state, showPreviews }
      notify()
    },

    setBackgroundSync(backgroundSync: boolean) {
      state = { ...state, backgroundSync }
      notify()
    },
  }
}
