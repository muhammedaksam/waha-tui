import type { Dialog, DialogId } from "../types"

// =============================================================================
// Dialog State (shared by framework adapters)
// =============================================================================

/**
 * Dialog state available via useDialogState selector.
 * Shared interface used by both React and Solid adapters.
 */
export interface DialogState {
  /** Whether any dialog is currently open. */
  isOpen: boolean
  /** Array of all active dialogs (oldest first). */
  dialogs: readonly Dialog[]
  /** The top-most (most recent) dialog, or undefined if none. */
  topDialog: Dialog | undefined
  /** Number of currently open dialogs. */
  count: number
}

// =============================================================================
// Context Types
// =============================================================================
// These are passed to content functions in async dialog methods (prompt, confirm, alert, choice).
// Each context provides callbacks for the user to resolve the dialog.
//
// All contexts use a consistent `resolve()` pattern:
// - Call `resolve(value)` to complete the dialog with a value
// - Call `dismiss()` (where available) to cancel without a value
//
// ESC key and backdrop clicks are handled separately via the method's `fallback` option.

/**
 * Context for a generic prompt dialog.
 * Call `resolve(value)` to complete with a value, or `dismiss()` to cancel.
 * @template T The type of value the prompt resolves to.
 */
export interface PromptContext<T> {
  /** Resolves the Promise with the given value and closes the dialog. */
  resolve: (value: T) => void
  /** Dismisses the dialog without a value. Resolves Promise with `undefined`. */
  dismiss: () => void
  /** The unique ID of this dialog. Use with `useDialogKeyboard` for scoped keyboard handling. */
  dialogId: DialogId
}

/**
 * Context for a confirm dialog.
 * Call `resolve(true)` to confirm or `resolve(false)` to cancel.
 */
export interface ConfirmContext {
  /** Resolves the Promise with the given boolean and closes the dialog. */
  resolve: (confirmed: boolean) => void
  /** Dismisses the dialog without confirmation. Resolves Promise with `false`. */
  dismiss: () => void
  /** The unique ID of this dialog. Use with `useDialogKeyboard` for scoped keyboard handling. */
  dialogId: DialogId
}

/**
 * Context for an alert dialog.
 * Call `dismiss()` to acknowledge and close the dialog.
 */
export interface AlertContext {
  /** Acknowledges and closes the alert dialog. */
  dismiss: () => void
  /** The unique ID of this dialog. Use with `useDialogKeyboard` for scoped keyboard handling. */
  dialogId: DialogId
}

/**
 * Context for a choice dialog.
 * Call `resolve(key)` to select an option, or `dismiss()` to cancel.
 * @template K The type of keys for the available choices.
 */
export interface ChoiceContext<K> {
  /** Resolves the Promise with the selected key and closes the dialog. */
  resolve: (key: K) => void
  /** Dismisses the dialog without selection. Resolves Promise with `undefined`. */
  dismiss: () => void
  /** The unique ID of this dialog. Use with `useDialogKeyboard` for scoped keyboard handling. */
  dialogId: DialogId
}
