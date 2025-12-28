import type { QRCode } from "qrcode"

import { SliceActions, StateSlice } from "./types"

export type AuthMode = "qr" | "phone"
export type PairingStatus = "idle" | "requesting" | "success" | "error"

export interface AuthState {
  authMode: AuthMode
  phoneNumber: string
  pairingCode: string | null
  pairingStatus: PairingStatus
  pairingError: string | null
  qrCodeMatrix: QRCode | null
}

export const initialAuthState: AuthState = {
  authMode: "qr",
  phoneNumber: "",
  pairingCode: null,
  pairingStatus: "idle",
  pairingError: null,
  qrCodeMatrix: null,
}

export interface AuthActions extends SliceActions<AuthState> {
  setAuthMode(authMode: AuthMode): void
  setPhoneNumber(phoneNumber: string): void
  setPairingCode(pairingCode: string | null): void
  setPairingStatus(pairingStatus: PairingStatus): void
  setPairingError(pairingError: string | null): void
  setQrCodeMatrix(qrCodeMatrix: QRCode | null): void
}

export function createAuthSlice(): StateSlice<AuthState> & AuthActions {
  let state: AuthState = { ...initialAuthState }
  const listeners: Array<(state: AuthState) => void> = []

  const notify = () => {
    listeners.forEach((l) => l(state))
  }

  return {
    name: "auth",
    get: () => ({ ...state }),
    set: (updates: Partial<AuthState>) => {
      state = { ...state, ...updates }
      notify()
    },
    getState: () => ({ ...state }),
    setState: (updates: Partial<AuthState>) => {
      state = { ...state, ...updates }
      notify()
    },
    subscribe: (listener: (state: AuthState) => void) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    reset: () => {
      state = { ...initialAuthState }
      notify()
    },

    setAuthMode(authMode: AuthMode) {
      state = { ...state, authMode }
      notify()
    },

    setPhoneNumber(phoneNumber: string) {
      state = { ...state, phoneNumber }
      notify()
    },

    setPairingCode(pairingCode: string | null) {
      state = { ...state, pairingCode }
      notify()
    },

    setPairingStatus(pairingStatus: PairingStatus) {
      state = { ...state, pairingStatus }
      notify()
    },

    setPairingError(pairingError: string | null) {
      state = { ...state, pairingError }
      notify()
    },

    setQrCodeMatrix(qrCodeMatrix: QRCode | null) {
      state = { ...state, qrCodeMatrix }
      notify()
    },
  }
}
