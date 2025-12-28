/**
 * Base types for state slices
 */

export type SliceListener<T> = (state: T) => void
export type Unsubscribe = () => void

export interface StateSlice<T> {
  name: string
  get: () => T
  set: (updates: Partial<T>) => void
  subscribe: (listener: SliceListener<T>) => Unsubscribe
  reset: () => void
}

/**
 * Standard interface for slice actions
 * Each slice returns its specific actions + state getters
 */
export interface SliceActions<T> {
  getState: () => T
  setState: (updates: Partial<T>) => void
  subscribe: (listener: SliceListener<T>) => Unsubscribe
}

/**
 * Helper to create a partial update for the main AppState
 * from a slice update
 */
export type GlobalStateUpdate<GlobalState> = Partial<GlobalState>
