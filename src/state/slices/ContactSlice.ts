import type { MyProfile } from "@muhammedaksam/waha-node"

import { SliceActions, StateSlice } from "~/state/slices/types"

export interface ContactState {
  contactsCache: Map<string, string> // Maps contact ID to name
  pushNamesCache: Map<string, string> // Maps contact ID to pushname
  allContacts: Map<string, string> // Full phonebook contacts for search
  myProfile: MyProfile | null // Current user's profile
  wahaTier: string | null // WAHA tier
}

export const initialContactState: ContactState = {
  contactsCache: new Map(),
  pushNamesCache: new Map(),
  allContacts: new Map(),
  myProfile: null,
  wahaTier: null,
}

export interface ContactActions extends SliceActions<ContactState> {
  setContactsCache(contactsCache: Map<string, string>): void
  setPushNamesCache(pushNamesCache: Map<string, string>): void
  setPushNames(pushNames: Map<string, string>): void
  setAllContacts(allContacts: Map<string, string>): void
  getContactName(contactId: string): string | undefined
  getPushName(contactId: string): string | undefined
  setMyProfile(myProfile: MyProfile | null): void
  setWahaTier(wahaTier: string | null): void
}

export function createContactSlice(): StateSlice<ContactState> & ContactActions {
  let state: ContactState = { ...initialContactState }
  const listeners: Array<(state: ContactState) => void> = []

  const notify = () => {
    listeners.forEach((l) => l(state))
  }

  return {
    name: "contact",
    get: () => ({ ...state }),
    set: (updates: Partial<ContactState>) => {
      state = { ...state, ...updates }
      notify()
    },
    getState: () => ({ ...state }),
    setState: (updates: Partial<ContactState>) => {
      state = { ...state, ...updates }
      notify()
    },
    subscribe: (listener: (state: ContactState) => void) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    reset: () => {
      state = { ...initialContactState }
      notify()
    },

    setContactsCache(contactsCache: Map<string, string>) {
      state = { ...state, contactsCache }
      notify()
    },

    setPushNamesCache(pushNamesCache: Map<string, string>) {
      state = { ...state, pushNamesCache }
      notify()
    },

    setPushNames(pushNames: Map<string, string>) {
      state = { ...state, pushNamesCache: pushNames }
      notify()
    },

    setAllContacts(allContacts: Map<string, string>) {
      state = { ...state, allContacts }
      notify()
    },

    getContactName(contactId: string): string | undefined {
      return state.contactsCache.get(contactId)
    },

    getPushName(contactId: string): string | undefined {
      return state.pushNamesCache.get(contactId)
    },

    setMyProfile(myProfile: MyProfile | null) {
      state = { ...state, myProfile }
      notify()
    },

    setWahaTier(wahaTier: string | null) {
      state = { ...state, wahaTier }
      notify()
    },
  }
}
