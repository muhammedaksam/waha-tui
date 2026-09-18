import type { Renderable, RenderContext } from "@opentui/core"

import type { AlertContext, ChoiceContext, ConfirmContext, PromptContext } from "./prompts"
import type {
  AsyncDialogOptions,
  BaseAlertOptions,
  BaseChoiceOptions,
  BaseConfirmOptions,
  BasePromptOptions,
  Dialog,
  DialogId,
  DialogShowOptions,
  DialogToClose,
} from "./types"

type DialogSubscriber = (data: Dialog | DialogToClose) => void

/** Content factory for prompt dialogs. */
type PromptContent<T> = (renderCtx: RenderContext, promptCtx: PromptContext<T>) => Renderable

/** Content factory for confirm dialogs. */
type ConfirmContent = (renderCtx: RenderContext, confirmCtx: ConfirmContext) => Renderable

/** Content factory for alert dialogs. */
type AlertContent = (renderCtx: RenderContext, alertCtx: AlertContext) => Renderable

/** Content factory for choice dialogs. */
type ChoiceContent<K> = (renderCtx: RenderContext, choiceCtx: ChoiceContext<K>) => Renderable

/**
 * Options for a generic prompt dialog using core renderables.
 * @template T The type of value the prompt resolves to.
 */
export type PromptOptions<T> = BasePromptOptions<T, PromptContent<T>>

/**
 * Options for a confirm dialog using core renderables.
 */
export type ConfirmOptions = BaseConfirmOptions<ConfirmContent>

/**
 * Options for an alert dialog using core renderables.
 */
export type AlertOptions = BaseAlertOptions<AlertContent>

/**
 * Options for a choice dialog using core renderables.
 * @template K The type of keys for the available choices.
 */
export type ChoiceOptions<K> = BaseChoiceOptions<ChoiceContent<K>, K>

/**
 * Extended DialogShowOptions for async dialog factory functions.
 * @template T The type of value returned on dismiss.
 */
export interface AsyncShowOptions<T> extends DialogShowOptions {
  /** Fallback value when dialog is dismissed via ESC or backdrop click. */
  fallback?: T
}

/**
 * Manages dialog state and lifecycle for a DialogContainerRenderable.
 *
 * @example
 * ```ts
 * const manager = new DialogManager(renderer);
 * const container = new DialogContainerRenderable(renderer, { manager });
 *
 * manager.show({
 *   content: (ctx) => new TextRenderable(ctx, { content: "Hello" }),
 * });
 * ```
 */
export class DialogManager {
  private dialogs: Dialog[] = []
  private subscribers = new Set<DialogSubscriber>()
  private idCounter = 1
  private savedFocus: Renderable | null = null
  private ctx: RenderContext
  private focusRestoreTimeout?: ReturnType<typeof setTimeout>
  private destroyed = false

  constructor(ctx: RenderContext) {
    this.ctx = ctx
  }

  private saveFocus(): void {
    this.cancelPendingFocusRestore()
    this.savedFocus = this.ctx.currentFocusedRenderable
    this.savedFocus?.blur()
  }

  private cancelPendingFocusRestore(): void {
    if (this.focusRestoreTimeout) {
      clearTimeout(this.focusRestoreTimeout)
      this.focusRestoreTimeout = undefined
    }
  }

  private restoreFocus(): void {
    this.cancelPendingFocusRestore()

    if (this.savedFocus && !this.savedFocus.isDestroyed) {
      // Defer to next tick to ensure dialog is fully removed from render tree
      this.focusRestoreTimeout = setTimeout(() => {
        if (!this.destroyed && this.savedFocus && !this.savedFocus.isDestroyed) {
          this.savedFocus.focus()
        }
        this.savedFocus = null
        this.focusRestoreTimeout = undefined
      }, 1)
    } else {
      this.savedFocus = null
    }
  }

  /** Subscribe to dialog state changes. Returns an unsubscribe function. */
  subscribe(subscriber: DialogSubscriber): () => void {
    this.subscribers.add(subscriber)
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  private publish(data: Dialog | DialogToClose): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(data)
      } catch (error) {
        console.error("[@opentui-ui/dialog] Subscriber threw an error:", error)
      }
    }
  }

  private addDialog(data: Dialog): void {
    this.dialogs = [...this.dialogs, data]
    this.publish(data)
  }

  /**
   * Show a new dialog.
   *
   * @example
   * ```ts
   * manager.show({
   *   content: (ctx) => new TextRenderable(ctx, { content: "Hello" }),
   *   size: "medium",
   * });
   * ```
   */
  show(options: DialogShowOptions): DialogId {
    if (this.destroyed) {
      throw new Error("[@opentui-ui/dialog] Cannot show dialog: DialogManager has been destroyed.")
    }

    if (options.content === undefined || options.content === null) {
      throw new Error(
        `[@opentui-ui/dialog] Missing required 'content' property.\n\n` +
          `The 'content' property must be a factory function that returns a Renderable:\n\n` +
          `  manager.show({\n` +
          `    content: (ctx) => new TextRenderable(ctx, { content: "Hello" }),\n` +
          `  });\n\n` +
          `For React, use: import { useDialog } from '@opentui-ui/dialog/react'\n` +
          `For Solid, use: import { useDialog } from '@opentui-ui/dialog/solid'`
      )
    }

    if (typeof options.content !== "function") {
      throw new Error(
        `[@opentui-ui/dialog] Invalid 'content' type: expected function, got ${typeof options.content}.\n\n` +
          `The 'content' property must be a factory function that receives a RenderContext\n` +
          `and returns a Renderable:\n\n` +
          `  manager.show({\n` +
          `    content: (ctx) => new TextRenderable(ctx, { content: "Hello" }),\n` +
          `  });\n\n` +
          `If you're using React or Solid, make sure you're importing from\n` +
          `the correct entry point:\n` +
          `  - React: import { useDialog } from '@opentui-ui/dialog/react'\n` +
          `  - Solid: import { useDialog } from '@opentui-ui/dialog/solid'`
      )
    }

    const id = options.id !== undefined && options.id !== null ? options.id : this.idCounter++

    const existingIndex = this.dialogs.findIndex((d) => d.id === id)

    if (existingIndex !== -1) {
      const existing = this.dialogs[existingIndex]
      if (existing) {
        const updated: Dialog = { ...existing, ...options, id }
        this.dialogs = [
          ...this.dialogs.slice(0, existingIndex),
          updated,
          ...this.dialogs.slice(existingIndex + 1),
        ]
        this.publish(updated)
      }
    } else {
      if (this.dialogs.length === 0) {
        this.saveFocus()
      }

      const dialog: Dialog = {
        ...options,
        id,
      }
      this.addDialog(dialog)
      dialog.onOpen?.()
    }

    return id
  }

  /** Close a dialog by ID, or the top-most dialog if no ID provided. */
  close(id?: DialogId): DialogId | undefined {
    let targetId: DialogId | undefined

    if (id !== undefined) {
      targetId = id
    } else {
      const topDialog = this.dialogs[this.dialogs.length - 1]
      targetId = topDialog?.id
    }

    if (targetId === undefined) {
      return undefined
    }

    const dialogIndex = this.dialogs.findIndex((d) => d.id === targetId)
    if (dialogIndex === -1) {
      return undefined
    }

    const dialog = this.dialogs[dialogIndex]

    // Update dialogs before publishing to keep state in sync
    this.dialogs = [...this.dialogs.slice(0, dialogIndex), ...this.dialogs.slice(dialogIndex + 1)]

    this.publish({ id: targetId, close: true })

    dialog?.onClose?.()

    if (this.dialogs.length === 0) {
      this.restoreFocus()
    }

    return targetId
  }

  /** Close all open dialogs. */
  closeAll(): void {
    const dialogsToClose = [...this.dialogs].reverse()
    for (const d of dialogsToClose) {
      this.close(d.id)
    }
  }

  /** Close all dialogs and show a new one. */
  replace(options: DialogShowOptions): DialogId {
    this.closeAll()
    return this.show(options)
  }

  /**
   * Get all active dialogs (oldest first).
   *
   * Returns a stable reference that only changes when dialogs are
   * added/removed/updated.
   */
  getDialogs(): readonly Dialog[] {
    return this.dialogs
  }

  /** Get the top-most active dialog. */
  getTopDialog(): Dialog | undefined {
    if (this.dialogs.length === 0) {
      return undefined
    }
    return this.dialogs[this.dialogs.length - 1]
  }

  /** Check if any dialogs are open. */
  isOpen(): boolean {
    return this.dialogs.length > 0
  }

  /**
   * Builds DialogShowOptions from either a factory function or a CoreOptions object.
   */
  private buildShowOptions<
    TCtx,
    TOptions extends AsyncDialogOptions & {
      content: (renderCtx: RenderContext, ctx: TCtx) => Renderable
    },
  >(input: TOptions | ((ctx: TCtx) => DialogShowOptions), ctx: TCtx): DialogShowOptions {
    if (typeof input === "function") {
      return input(ctx)
    }
    const { content, ...rest } = input
    return {
      ...rest,
      content: (renderCtx: RenderContext) => content(renderCtx, ctx),
    }
  }

  /**
   * Internal helper that handles common async dialog logic:
   * - Promise creation
   * - Safe double-resolve protection
   * - Dialog show/close lifecycle
   * - Fallback value handling for ESC/backdrop dismissal
   */
  private showAsyncDialog<T>(
    createContextAndOptions: (
      safeResolve: (value: T) => void,
      dialogId: DialogId
    ) => {
      showOptions: DialogShowOptions
      fallback?: T
    },
    defaultDismissValue: T
  ): Promise<T> {
    return new Promise<T>((resolve) => {
      let resolved = false

      // Pre-generate the dialog ID so it can be passed to the context factory
      const dialogId = this.idCounter++

      // Guard to ensure the promise resolves only once, since onClose always fires (even after explicit close)
      const safeResolve = (value: T) => {
        if (resolved) return
        resolved = true
        resolve(value)
        this.close(dialogId)
      }

      const { showOptions, fallback } = createContextAndOptions(safeResolve, dialogId)

      this.show({
        ...showOptions,
        id: dialogId,
        onClose: () => {
          showOptions.onClose?.()
          safeResolve(fallback ?? defaultDismissValue)
        },
      })
    })
  }

  /**
   * Show a generic prompt dialog and wait for a response.
   *
   * @template T The type of value the prompt resolves to.
   *
   * Accepts either PromptOptions (for imperative usage) or a factory function
   * that receives the prompt context and returns AsyncShowOptions (for framework adapters).
   *
   * @example
   * ```ts
   * // Core/imperative usage
   * const result = await manager.prompt<string>({
   *   content: (renderCtx, { resolve, dismiss }) => {
   *     const box = new BoxRenderable(renderCtx, { flexDirection: "row" });
   *     const cancelBtn = new TextRenderable(renderCtx, { content: "Cancel" });
   *     cancelBtn.on("mouseUp", dismiss);
   *     const okBtn = new TextRenderable(renderCtx, { content: "OK" });
   *     okBtn.on("mouseUp", () => resolve("some-value"));
   *     box.add(cancelBtn);
   *     box.add(okBtn);
   *     return box;
   *   },
   * });
   * ```
   */
  prompt<T>(options: PromptOptions<T>): Promise<T | undefined>
  prompt<T>(
    showFactory: (ctx: PromptContext<T>) => AsyncShowOptions<T | undefined>
  ): Promise<T | undefined>
  prompt<T>(
    input: PromptOptions<T> | ((ctx: PromptContext<T>) => AsyncShowOptions<T | undefined>)
  ): Promise<T | undefined> {
    return this.showAsyncDialog<T | undefined>((safeResolve, dialogId) => {
      const ctx: PromptContext<T> = {
        resolve: safeResolve,
        dismiss: () => safeResolve(undefined),
        dialogId,
      }

      if (typeof input === "function") {
        const result = input(ctx)
        return { showOptions: result, fallback: result.fallback }
      }

      const { fallback, ...rest } = input
      return {
        showOptions: this.buildShowOptions(rest, ctx),
        fallback,
      }
    }, undefined)
  }

  /**
   * Show a confirmation dialog and wait for the user to confirm or cancel.
   *
   * @returns `true` if confirmed, `false` if cancelled or dismissed.
   *
   * Accepts either ConfirmOptions (for imperative usage) or a factory function
   * that receives the confirm context and returns AsyncShowOptions (for framework adapters).
   *
   * @example
   * ```ts
   * // Core/imperative usage
   * const confirmed = await manager.confirm({
   *   content: (renderCtx, { resolve }) => {
   *     const box = new BoxRenderable(renderCtx, { flexDirection: "column" });
   *     const title = new TextRenderable(renderCtx, { content: "Delete file?" });
   *     box.add(title);
   *
   *     const buttons = new BoxRenderable(renderCtx, { flexDirection: "row" });
   *     const cancelBtn = new TextRenderable(renderCtx, { content: "Cancel" });
   *     cancelBtn.on("mouseUp", () => resolve(false));
   *     const confirmBtn = new TextRenderable(renderCtx, { content: "Confirm" });
   *     confirmBtn.on("mouseUp", () => resolve(true));
   *     buttons.add(cancelBtn);
   *     buttons.add(confirmBtn);
   *     box.add(buttons);
   *
   *     return box;
   *   }
   * });
   * ```
   */
  confirm(options: ConfirmOptions): Promise<boolean>
  confirm(showFactory: (ctx: ConfirmContext) => AsyncShowOptions<boolean>): Promise<boolean>
  confirm(
    input: ConfirmOptions | ((ctx: ConfirmContext) => AsyncShowOptions<boolean>)
  ): Promise<boolean> {
    return this.showAsyncDialog<boolean>((safeResolve, dialogId) => {
      const ctx: ConfirmContext = {
        resolve: safeResolve,
        dismiss: () => safeResolve(false),
        dialogId,
      }

      if (typeof input === "function") {
        const result = input(ctx)
        return { showOptions: result, fallback: result.fallback }
      }

      const { fallback, ...rest } = input
      return {
        showOptions: this.buildShowOptions(rest, ctx),
        fallback,
      }
    }, false)
  }

  /**
   * Show an alert dialog and wait for the user to dismiss it.
   *
   * Accepts either AlertOptions (for imperative usage) or a factory function
   * that receives the alert context and returns DialogShowOptions (for framework adapters).
   *
   * @example
   * ```ts
   * // Core/imperative usage
   * await manager.alert({
   *   content: (renderCtx, { dismiss }) => {
   *     const box = new BoxRenderable(renderCtx, { flexDirection: "column" });
   *     const text = new TextRenderable(renderCtx, { content: "Operation complete!" });
   *     box.add(text);
   *
   *     const okBtn = new TextRenderable(renderCtx, { content: "OK" });
   *     okBtn.on("mouseUp", dismiss);
   *     box.add(okBtn);
   *
   *     return box;
   *   }
   * });
   * ```
   */
  alert(options: AlertOptions): Promise<void>
  alert(showFactory: (ctx: AlertContext) => DialogShowOptions): Promise<void>
  alert(input: AlertOptions | ((ctx: AlertContext) => DialogShowOptions)): Promise<void> {
    return this.showAsyncDialog<void>((safeResolve, dialogId) => {
      const ctx: AlertContext = {
        dismiss: safeResolve,
        dialogId,
      }
      return { showOptions: this.buildShowOptions(input, ctx) }
    }, undefined)
  }

  /**
   * Show a choice dialog and wait for the user to select an option.
   *
   * @template K The type of keys for the available choices.
   * @returns The selected key, or `undefined` if cancelled or dismissed.
   *
   * Accepts either ChoiceOptions (for imperative usage) or a factory function
   * that receives the choice context and returns AsyncShowOptions (for framework adapters).
   *
   * @example
   * ```ts
   * // Core/imperative usage
   * const action = await manager.choice<"save" | "discard">({
   *   content: (renderCtx, { resolve, dismiss }) => {
   *     const box = new BoxRenderable(renderCtx, { flexDirection: "column" });
   *     const title = new TextRenderable(renderCtx, { content: "Unsaved changes" });
   *     box.add(title);
   *
   *     const saveBtn = new TextRenderable(renderCtx, { content: "Save" });
   *     saveBtn.on("mouseUp", () => resolve("save"));
   *     const discardBtn = new TextRenderable(renderCtx, { content: "Discard" });
   *     discardBtn.on("mouseUp", () => resolve("discard"));
   *     const cancelBtn = new TextRenderable(renderCtx, { content: "Cancel" });
   *     cancelBtn.on("mouseUp", dismiss);
   *
   *     box.add(saveBtn);
   *     box.add(discardBtn);
   *     box.add(cancelBtn);
   *
   *     return box;
   *   }
   * });
   * ```
   */
  choice<K>(options: ChoiceOptions<K>): Promise<K | undefined>
  choice<K>(
    showFactory: (ctx: ChoiceContext<K>) => AsyncShowOptions<K | undefined>
  ): Promise<K | undefined>
  choice<K>(
    input: ChoiceOptions<K> | ((ctx: ChoiceContext<K>) => AsyncShowOptions<K | undefined>)
  ): Promise<K | undefined> {
    return this.showAsyncDialog<K | undefined>((safeResolve, dialogId) => {
      const ctx: ChoiceContext<K> = {
        resolve: safeResolve,
        dismiss: () => safeResolve(undefined),
        dialogId,
      }

      if (typeof input === "function") {
        const result = input(ctx)
        return { showOptions: result, fallback: result.fallback }
      }

      const { fallback, ...rest } = input
      return {
        showOptions: this.buildShowOptions(rest, ctx),
        fallback,
      }
    }, undefined)
  }

  /** Destroy the manager and clean up resources. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    this.cancelPendingFocusRestore()
    this.savedFocus = null
    this.subscribers.clear()
    this.dialogs = []
  }

  get isDestroyed(): boolean {
    return this.destroyed
  }
}
