import { SliceActions, StateSlice } from "~/state/slices/types"

export type ViewType =
  | "config"
  | "sessions"
  | "chats"
  | "conversation"
  | "settings"
  | "qr"
  | "loading"

export type SidebarView = "none" | "group-info" | "contact-info"
export type SidebarSubView =
  | "main"
  | "permissions"
  | "admins"
  | "media"
  | "starred"
  | "privacy"
  | "disappearing-messages"
  | "advanced-privacy"
  | "member-changes"

export type ActiveFilter = "all" | "unread" | "favorites" | "groups" | "labeled"
export type ActiveIcon = "chats" | "status" | "profile" | "settings" | "channels" | "communities"

export interface UIState {
  currentView: ViewType
  activeFilter: ActiveFilter
  activeIcon: ActiveIcon
  searchQuery: string
  rightSidebar: SidebarView
  rightSidebarSubView: SidebarSubView
}

export const initialUIState: UIState = {
  currentView: "sessions",
  activeFilter: "all",
  activeIcon: "chats",
  searchQuery: "",
  rightSidebar: "none",
  rightSidebarSubView: "main",
}

export interface UIActions extends SliceActions<UIState> {
  setCurrentView(currentView: ViewType): void
  setActiveFilter(activeFilter: ActiveFilter): void
  setSearchQuery(searchQuery: string): void
  setActiveIcon(activeIcon: ActiveIcon): void
  setRightSidebar(view: SidebarView): void
  setRightSidebarSubView(subView: SidebarSubView): void
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
    setRightSidebar(view: SidebarView) {
      state = { ...state, rightSidebar: view, rightSidebarSubView: "main" }
      notify()
    },
    setRightSidebarSubView(subView: SidebarSubView) {
      state = { ...state, rightSidebarSubView: subView }
      notify()
    },
  }
}
