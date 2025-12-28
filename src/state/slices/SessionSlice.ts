import type { SessionDTO } from "@muhammedaksam/waha-node"

import { SliceActions, StateSlice } from "./types"

export interface SessionState {
  currentSession: string | null
  sessions: SessionDTO[]
  connectionStatus: "connected" | "connecting" | "disconnected" | "error"
  errorMessage: string | null
  isOffline: boolean
}

export const initialSessionState: SessionState = {
  currentSession: null,
  sessions: [],
  connectionStatus: "disconnected",
  errorMessage: null,
  isOffline: false,
}

export interface SessionActions extends SliceActions<SessionState> {
  setCurrentSession(currentSession: string | null): void
  setSessions(sessions: SessionDTO[]): void
  setConnectionStatus(
    connectionStatus: SessionState["connectionStatus"],
    errorMessage?: string
  ): void
}

export function createSessionSlice(): StateSlice<SessionState> & SessionActions {
  let state: SessionState = { ...initialSessionState }
  const listeners: Array<(state: SessionState) => void> = []

  const notify = () => {
    listeners.forEach((l) => l(state))
  }

  return {
    name: "session",

    get: () => ({ ...state }),

    set: (updates: Partial<SessionState>) => {
      state = { ...state, ...updates }
      notify()
    },

    getState: () => ({ ...state }),

    setState: (updates: Partial<SessionState>) => {
      state = { ...state, ...updates }
      notify()
    },

    subscribe: (listener: (state: SessionState) => void) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    },

    reset: () => {
      state = { ...initialSessionState }
      notify()
    },

    // Actions
    setCurrentSession(currentSession: string | null) {
      state = { ...state, currentSession }
      notify()
    },

    setSessions(sessions: SessionDTO[]) {
      state = { ...state, sessions }
      notify()
    },

    setConnectionStatus(connectionStatus: SessionState["connectionStatus"], errorMessage?: string) {
      state = { ...state, connectionStatus, errorMessage: errorMessage || null }
      notify()
    },
  }
}
