import type { ChatSummary, WAMessage } from "@muhammedaksam/waha-node"

import type { WAMessageExtended } from "~/types"
import type { UpdateInfo } from "~/utils/update-checker"
import { TIME_MS } from "~/constants"
import { SliceActions, StateSlice } from "~/state/slices/types"

// Context menu types
export type ContextMenuType = "chat" | "message" | null

export interface ContextMenuState {
  visible: boolean
  type: ContextMenuType
  targetId: string | null // Chat ID or Message ID
  targetData?: ChatSummary | WAMessage | WAMessageExtended | null // The actual chat or message data
  selectedIndex: number // Currently highlighted menu item
  position: {
    x: number
    y: number
    bubbleWidth?: number // For message bubbles - the width of the bubble
    bubbleHeight?: number // For message bubbles - the height of the bubble
  }
}

// Configuration wizard step state
export interface ConfigStep {
  step: 1 | 2 | 3
  wahaUrl: string
  wahaApiKey: string
  status: "input" | "testing" | "success" | "error"
  errorMessage?: string
}

export interface ToastState {
  visible: boolean
  message: string
  type: "error" | "warning" | "success" | "info"
}

export interface ModalState {
  contextMenu: ContextMenuState | null
  showLogoutModal: boolean
  showUpdateModal: boolean
  updateInfo: UpdateInfo | null
  toast: ToastState | null
  configStep: ConfigStep | null
}

export const initialModalState: ModalState = {
  contextMenu: null,
  showLogoutModal: false,
  showUpdateModal: false,
  updateInfo: null,
  toast: null,
  configStep: null,
}

export interface ModalActions extends SliceActions<ModalState> {
  // Context Menu
  openContextMenu(
    type: ContextMenuType,
    targetId: string,
    targetData?: ChatSummary | WAMessage | WAMessageExtended | null,
    position?: { x: number; y: number }
  ): void
  closeContextMenu(): void
  setContextMenuSelectedIndex(selectedIndex: number): void

  // Context Menu Action Callback
  setContextMenuActionCallback(callback: (actionId: string) => void): void
  triggerContextMenuAction(actionId: string): void

  // Modals
  setShowLogoutModal(showLogoutModal: boolean): void
  setUpdateModal(show: boolean, info?: UpdateInfo): void
  setConfigStep(configStep: ConfigStep | null): void

  // Toast
  showToast(
    message: string,
    type?: "error" | "warning" | "success" | "info",
    autoDismissMs?: number
  ): void
  hideToast(): void
}

export function createModalSlice(): StateSlice<ModalState> & ModalActions {
  let state: ModalState = { ...initialModalState }
  const listeners: Array<(state: ModalState) => void> = []

  // Context menu action callback
  let contextMenuActionCallback: ((actionId: string) => void) | null = null

  const notify = () => {
    listeners.forEach((l) => l(state))
  }

  return {
    name: "modal",
    get: () => ({ ...state }),
    set: (updates: Partial<ModalState>) => {
      state = { ...state, ...updates }
      notify()
    },
    getState: () => ({ ...state }),
    setState: (updates: Partial<ModalState>) => {
      state = { ...state, ...updates }
      notify()
    },
    subscribe: (listener: (state: ModalState) => void) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    reset: () => {
      state = { ...initialModalState }
      notify()
    },

    openContextMenu(
      type: ContextMenuType,
      targetId: string,
      targetData?: ChatSummary | WAMessage | WAMessageExtended | null,
      position: { x: number; y: number } = { x: 10, y: 5 }
    ) {
      state = {
        ...state,
        contextMenu: {
          visible: true,
          type,
          targetId,
          targetData,
          selectedIndex: 0,
          position,
        },
      }
      notify()
    },

    closeContextMenu() {
      state = { ...state, contextMenu: null }
      notify()
    },

    setContextMenuSelectedIndex(selectedIndex: number) {
      if (state.contextMenu) {
        state = {
          ...state,
          contextMenu: {
            ...state.contextMenu,
            selectedIndex,
          },
        }
        notify()
      }
    },

    setContextMenuActionCallback(callback: (actionId: string) => void) {
      contextMenuActionCallback = callback
    },

    triggerContextMenuAction(actionId: string) {
      if (contextMenuActionCallback) {
        contextMenuActionCallback(actionId)
      }
    },

    setShowLogoutModal(showLogoutModal: boolean) {
      state = { ...state, showLogoutModal }
      notify()
    },

    setUpdateModal(show: boolean, info?: UpdateInfo) {
      state = {
        ...state,
        showUpdateModal: show,
        updateInfo: info || state.updateInfo,
      }
      notify()
    },

    setConfigStep(configStep: ConfigStep | null) {
      state = { ...state, configStep }
      notify()
    },

    showToast(
      message: string,
      type: "error" | "warning" | "success" | "info" = "info",
      autoDismissMs: number = TIME_MS.TOAST_DEFAULT_AUTO_DISMISS
    ) {
      state = {
        ...state,
        toast: { visible: true, message, type },
      }
      notify()

      if (autoDismissMs > 0) {
        setTimeout(() => {
          // Use current implementation to hide, ensuring we are modifying the closure's state
          // Re-implement hideToast logic here to be safe inside timeout
          state = { ...state, toast: null }
          notify()
        }, autoDismissMs)
      }
    },

    hideToast() {
      state = { ...state, toast: null }
      notify()
    },
  }
}
