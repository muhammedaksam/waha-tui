import type { RenderContext } from "@opentui/core"

import { BoxRenderable } from "@opentui/core"

import type { DialogContainerOptions, InternalDialog } from "../types"
import type { ComputedDialogStyle } from "../utils"
import { JSX_CONTENT_KEY } from "../constants"
import { computeDialogStyle, getDialogWidth } from "../utils"

export interface DialogRenderableOptions {
  dialog: InternalDialog
  containerOptions: DialogContainerOptions
}

export class DialogRenderable extends BoxRenderable {
  private _dialog: InternalDialog
  private _computedStyle: ComputedDialogStyle
  private _containerOptions: DialogContainerOptions

  constructor(ctx: RenderContext, options: DialogRenderableOptions) {
    const { dialog, containerOptions } = options
    const isDeferred = dialog.deferred === true

    const computedStyle = computeDialogStyle({ dialog, containerOptions })
    const dialogWidth = getDialogWidth(dialog.size, containerOptions, ctx.width)
    const padding = computedStyle.resolvedPadding

    const panelWidth = typeof computedStyle.width === "number" ? computedStyle.width : dialogWidth

    super(ctx, {
      id: `dialog-${dialog.id}`,
      position: "absolute",
      width: panelWidth,
      maxWidth: computedStyle.maxWidth ?? ctx.width - 2,
      minWidth: computedStyle.minWidth,
      maxHeight: computedStyle.maxHeight,
      backgroundColor: computedStyle.backgroundColor,
      border: computedStyle.border,
      borderColor: computedStyle.borderColor,
      borderStyle: computedStyle.borderStyle,
      paddingTop: padding.top,
      paddingRight: padding.right,
      paddingBottom: padding.bottom,
      paddingLeft: padding.left,
      visible: !isDeferred,
    })

    this._dialog = dialog
    this._containerOptions = containerOptions
    this._computedStyle = computedStyle

    if (dialog?.[JSX_CONTENT_KEY]) {
      // Reconcilers take over rendering the tree from here
      return
    }

    this.createContent()
  }

  private createContent(): void {
    try {
      const contentRenderable = this._dialog.content(this.ctx)
      this.add(contentRenderable)
    } catch (error) {
      const dialogId = this._dialog.id
      const originalMessage = error instanceof Error ? error.message : String(error)
      const originalStack = error instanceof Error ? error.stack : undefined

      const enhancedError = new Error(
        `[@opentui-ui/dialog] Failed to create content for dialog "${dialogId}".\n\n` +
          `Root cause: ${originalMessage}\n\n` +
          `This error occurred while executing the content factory function. ` +
          `Check that your content factory returns a valid Renderable and doesn't throw.\n\n` +
          `Example of a valid content factory:\n` +
          `  content: (ctx) => new TextRenderable(ctx, { content: "Hello" })`
      )

      if (originalStack) {
        enhancedError.stack = `${enhancedError.message}\n\nOriginal stack trace:\n${originalStack}`
      }

      throw enhancedError
    }
  }

  public updateDimensions(width: number, _height?: number): void {
    const dialogWidth = getDialogWidth(this._dialog.size, this._containerOptions, width)
    const panelWidth =
      typeof this._computedStyle.width === "number" ? this._computedStyle.width : dialogWidth

    this.width = panelWidth
    this.maxWidth = this._computedStyle.maxWidth ?? width - 2
    this.requestRender()
  }

  public get dialog(): InternalDialog {
    return this._dialog
  }
}
