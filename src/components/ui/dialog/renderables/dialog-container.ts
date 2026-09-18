import type { RenderContext } from "@opentui/core"

import { BoxRenderable, Renderable } from "@opentui/core"

import type { DialogManager } from "../manager"
import type {
  DialogContainerOptions,
  DialogId,
  DialogOptions,
  DialogSize,
  InternalDialog,
} from "../types"
import { DIALOG_Z_INDEX } from "../constants"
import { isDialogToClose } from "../types"
import { BackdropRenderable } from "./backdrop"
import { DialogRenderable } from "./dialog"

export interface DialogContainerRenderableOptions extends DialogContainerOptions {
  manager: DialogManager
}

export interface DialogKeyboardEvent {
  name?: string
  preventDefault?: () => void
}

/**
 * Container that renders dialogs from a DialogManager.
 *
 * @example
 * ```ts
 * const manager = new DialogManager(renderer);
 * const container = new DialogContainerRenderable(ctx, { manager });
 * ctx.root.add(container);
 *
 * manager.show({ content: (ctx) => new TextRenderable(ctx, { content: "Hi" }) });
 * ```
 */
export class DialogContainerRenderable extends BoxRenderable {
  private _manager: DialogManager
  private _options: DialogContainerOptions
  private _backdrop: BackdropRenderable
  private _dialogRenderables: Map<DialogId, DialogRenderable> = new Map()
  private _unsubscribe: (() => void) | null = null
  private _destroyed: boolean = false

  constructor(ctx: RenderContext, options: DialogContainerRenderableOptions) {
    super(ctx, {
      id: "dialog-container",
      position: "absolute",
      left: 0,
      top: 0,
      width: ctx.width,
      height: ctx.height,
      zIndex: DIALOG_Z_INDEX,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      visible: false,
    })

    this._manager = options.manager
    const containerOptions = { ...options }
    delete (containerOptions as { manager?: unknown }).manager
    this._options = containerOptions

    this._backdrop = new BackdropRenderable(ctx, {
      containerOptions: this._options,
      onClick: () => this.handleBackdropClick(),
    })
    this.add(this._backdrop)

    this._ctx.keyInput.on("keypress", this.handleKeyboard)

    this.subscribe()
  }

  private subscribe(): void {
    this._unsubscribe?.()

    this._unsubscribe = this._manager.subscribe((data) => {
      if (this._destroyed) return

      if (isDialogToClose(data)) {
        this.removeDialog(data.id)
      } else {
        this.addOrUpdateDialog(data)
      }
    })
  }

  /**
   * Handle keyboard events. Returns true if handled (e.g., ESC closed a dialog).
   */
  private handleKeyboard = (evt: DialogKeyboardEvent): boolean => {
    const key = evt.name
    if (key === "escape" && this._dialogRenderables.size > 0) {
      const topDialog = this.getTopDialogRenderable()
      if (topDialog) {
        // Per-dialog closeOnEscape takes precedence over container-level
        const closeOnEscape = topDialog.dialog.closeOnEscape ?? this._options.closeOnEscape
        if (closeOnEscape === false) {
          return false
        }
        evt.preventDefault?.()
        this._manager.close(topDialog.dialog.id)
        return true
      }
    }

    return false
  }

  private getTopDialogRenderable(): DialogRenderable | undefined {
    if (this._dialogRenderables.size === 0) {
      return undefined
    }

    const ids = Array.from(this._dialogRenderables.keys())
    const topId = ids[ids.length - 1]
    return topId !== undefined ? this._dialogRenderables.get(topId) : undefined
  }

  public getDialogRenderable(id: DialogId): DialogRenderable | undefined {
    return this._dialogRenderables.get(id)
  }

  public getDialogRenderables(): Map<DialogId, DialogRenderable> {
    return this._dialogRenderables
  }

  /**
   * Helper to find all focusable renderables within the top dialog
   */
  public getTopFocusableElements(): Renderable[] {
    const topDialog = this.getTopDialogRenderable()
    if (!topDialog) return []
    const results: Renderable[] = []
    const traverse = (node: Renderable) => {
      if (node.isDestroyed || !node.visible) return
      if (node.focusable && !(node as { disabled?: boolean }).disabled) {
        results.push(node)
      }
      for (const child of node.getChildren()) {
        traverse(child)
      }
    }
    traverse(topDialog)
    return results
  }

  /**
   * Focus next focusable button/element in the top dialog
   */
  public focusNextButton(): boolean {
    const elements = this.getTopFocusableElements()
    if (elements.length === 0) return false
    const currentIndex = elements.findIndex((el) => el.focused)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % elements.length : 0
    if (currentIndex >= 0 && currentIndex !== nextIndex) {
      elements[currentIndex]!.blur()
    }
    elements[nextIndex]!.focus()
    this.requestRender()
    return true
  }

  /**
   * Focus previous focusable button/element in the top dialog
   */
  public focusPrevButton(): boolean {
    const elements = this.getTopFocusableElements()
    if (elements.length === 0) return false
    const currentIndex = elements.findIndex((el) => el.focused)
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1
    if (currentIndex >= 0 && currentIndex !== prevIndex) {
      elements[currentIndex]!.blur()
    }
    elements[prevIndex]!.focus()
    this.requestRender()
    return true
  }

  /**
   * Click/press the currently focused button
   */
  public clickFocusedButton(): boolean {
    const elements = this.getTopFocusableElements()
    const focused = elements.find((el) => el.focused)
    if (focused) {
      const target = focused as {
        press?: () => void
        handlePress?: (details: {
          x: number
          y: number
          button: number
          target: Renderable
        }) => void
      }
      if (typeof target.press === "function") {
        target.press()
        this.requestRender()
        return true
      }
      if (typeof target.handlePress === "function") {
        target.handlePress({ x: 0, y: 0, button: 0, target: focused })
        this.requestRender()
        return true
      }
    }
    return false
  }

  private addOrUpdateDialog(dialog: InternalDialog): void {
    const existing = this._dialogRenderables.get(dialog.id)

    if (existing) {
      // TODO: Support updating existing dialogs in-place
      this.removeDialog(dialog.id)
    }

    const dialogRenderable = new DialogRenderable(this.ctx, {
      dialog,
      containerOptions: this._options,
    })

    this._dialogRenderables.set(dialog.id, dialogRenderable)
    this.add(dialogRenderable)

    this.updateBackdropVisibility()
    this.updateBackdropStyle()

    this.requestRender()

    // Automatically focus the first focusable button/input in the dialog
    setTimeout(() => {
      if (!this._destroyed && !dialogRenderable.isDestroyed) {
        const elements = this.getTopFocusableElements()
        if (elements.length > 0 && !elements.some((el) => el.focused)) {
          elements[0]!.focus()
          this.requestRender()
        }
      }
    }, 10)
  }

  private removeDialog(id: DialogId): void {
    const renderable = this._dialogRenderables.get(id)
    if (renderable) {
      this._dialogRenderables.delete(id)
      this.remove(renderable)
      renderable.destroyRecursively()

      this.updateBackdropVisibility()
      this.updateBackdropStyle()

      this.requestRender()
    }
  }

  public updateDimensions(width: number, height?: number): void {
    const h = height ?? this._ctx.height

    // Update container dimensions
    this.width = width
    this.height = h

    // Update backdrop dimensions
    this._backdrop.updateDimensions(width, h)

    // Update dialog dimensions
    for (const [, renderable] of this._dialogRenderables) {
      renderable.updateDimensions(width, h)
    }
  }

  public set size(value: DialogSize) {
    this._options.size = value
  }

  public set dialogOptions(value: DialogOptions) {
    this._options.dialogOptions = value
  }

  public set sizePresets(value: Partial<Record<DialogSize, number>>) {
    this._options.sizePresets = value
  }

  public set closeOnEscape(value: boolean) {
    this._options.closeOnEscape = value
  }

  public set closeOnClickOutside(value: boolean) {
    this._options.closeOnClickOutside = value
  }

  public set backdropColor(value: string) {
    this._options.backdropColor = value
    this._backdrop.updateContainerOptions(this._options)
    this.updateBackdropStyle()
  }

  public set backdropOpacity(value: number | string) {
    this._options.backdropOpacity = value
    this._backdrop.updateContainerOptions(this._options)
    this.updateBackdropStyle()
  }

  private updateBackdropVisibility(): void {
    const hasDialogs = this._dialogRenderables.size > 0
    this._backdrop.visible = hasDialogs
    this.visible = hasDialogs
  }

  private updateBackdropStyle(): void {
    const topDialog = this.getTopDialogRenderable()
    this._backdrop.updateStyle(topDialog?.dialog)
  }

  private handleBackdropClick(): void {
    const topDialog = this.getTopDialogRenderable()
    if (!topDialog) return

    // Call per-dialog callback first
    topDialog.dialog.onBackdropClick?.()

    // Check per-dialog setting, fall back to container setting
    const closeOnClickOutside =
      topDialog.dialog.closeOnClickOutside ?? this._options.closeOnClickOutside

    if (closeOnClickOutside === true) {
      this._manager.close(topDialog.dialog.id)
    }
  }

  public set unstyled(value: boolean) {
    this._options.unstyled = value
  }

  public override destroy(): void {
    if (this._destroyed) return
    this._destroyed = true

    this._unsubscribe?.()
    this._unsubscribe = null

    this._ctx.keyInput.off("keypress", this.handleKeyboard)

    // Clean up dialog renderables
    for (const [, renderable] of this._dialogRenderables) {
      renderable.destroyRecursively()
    }
    this._dialogRenderables.clear()

    // Clean up backdrop
    this._backdrop.destroyRecursively()

    super.destroy()
  }
}
