import type { RenderContext, RGBA } from "@opentui/core"

import { BoxRenderable, parseColor } from "@opentui/core"

import type { DialogContainerOptions, InternalDialog } from "../types"
import { normalizeOpacity } from "../../utils"
import { DEFAULT_BACKDROP_COLOR, DEFAULT_BACKDROP_OPACITY } from "../themes"

export interface BackdropRenderableOptions {
  containerOptions: DialogContainerOptions
  onClick: () => void
}

export class BackdropRenderable extends BoxRenderable {
  private _containerOptions: DialogContainerOptions

  constructor(ctx: RenderContext, options: BackdropRenderableOptions) {
    super(ctx, {
      id: "dialog-backdrop",
      position: "absolute",
      left: 0,
      top: 0,
      width: ctx.width,
      height: ctx.height,
      backgroundColor: BackdropRenderable.computeColor(undefined, options.containerOptions),
      visible: false,
      onMouseUp: options.onClick,
    })
    this._containerOptions = options.containerOptions
  }

  public updateStyle(dialog?: InternalDialog): void {
    this.backgroundColor = BackdropRenderable.computeColor(dialog, this._containerOptions)
  }

  public updateDimensions(width: number, height: number): void {
    this.width = width
    this.height = height
  }

  public updateContainerOptions(options: DialogContainerOptions): void {
    this._containerOptions = options
  }

  private static computeColor(
    dialog: InternalDialog | undefined,
    containerOptions: DialogContainerOptions
  ): RGBA {
    const color = dialog?.backdropColor ?? containerOptions.backdropColor ?? DEFAULT_BACKDROP_COLOR
    const opacity = normalizeOpacity(
      dialog?.backdropOpacity ?? containerOptions.backdropOpacity,
      DEFAULT_BACKDROP_OPACITY,
      "@opentui-ui/dialog"
    )
    const rgba = parseColor(color)
    rgba.a = opacity / 255
    return rgba
  }
}
