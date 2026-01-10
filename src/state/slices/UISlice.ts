import { SliceActions, StateSlice } from "~/state/slices/types"

export type ViewType =
  | "config"
  | "sessions"
  | "chats"
  | "conversation"
  | "settings"
  | "qr"
  | "loading"

export type ActiveFilter = "all" | "unread" | "favorites" | "groups"
export type ActiveIcon = "chats" | "status" | "profile" | "settings" | "channels" | "communities"

export interface UIState {
  currentView: ViewType
  activeFilter: ActiveFilter
  activeIcon: ActiveIcon
  searchQuery: string
}

export const initialUIState: UIState = {
  currentView: "sessions",
  activeFilter: "all",
  activeIcon: "chats",
  searchQuery: "",
}

export interface UIActions extends SliceActions<UIState> {
  setCurrentView(currentView: ViewType): void
  setActiveFilter(activeFilter: ActiveFilter): void
  setSearchQuery(searchQuery: string): void
  setActiveIcon(activeIcon: ActiveIcon): void
}

export function createUISlice(): StateSlice<UIState> & UIActions {
  let state: UIState = { ...initialUIState }
  const listeners: Array<(state: UIState) => void> = []

  const notify = () => {
    listeners.forEach((l) => l(state))
  }

  return {
    name: "ui",
    get: () => ({ ...state }),
    set: (updates: Partial<UIState>) => {
      state = { ...state, ...updates }
      notify()
    },
    getState: () => ({ ...state }),
    setState: (updates: Partial<UIState>) => {
      state = { ...state, ...updates }
      notify()
    },
    subscribe: (listener: (state: UIState) => void) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    reset: () => {
      state = { ...initialUIState }
      notify()
    },

    setCurrentView(currentView: ViewType) {
      state = { ...state, currentView }
      notify()
    },

    setActiveFilter(activeFilter: ActiveFilter) {
      state = { ...state, activeFilter }
      notify()
    },

    setSearchQuery(searchQuery: string) {
      state = { ...state, searchQuery }
      notify()
    },

    setActiveIcon(activeIcon: ActiveIcon) {
      state = { ...state, activeIcon }
      notify()
    },
  }
}
