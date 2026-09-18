/**
 * Slider Component
 * Built on @tuiparts/core/slider primitive following tuiparts recipe contract
 */

import type { RenderContext } from "@opentui/core"
import type { SliderRootOptions } from "@tuiparts/core/slider"

import { TextRenderable } from "@opentui/core"
import {
  SliderRangeRenderable,
  SliderRootRenderable,
  SliderThumbRenderable,
  SliderTrackRenderable,
} from "@tuiparts/core/slider"

import { WhatsAppTheme } from "~/config/theme"

/** Options for the consumer-owned imperative Slider Recipe. */
export interface SliderOptions extends Omit<SliderRootOptions, "store"> {
  /** Formats the value displayed beside the label. */
  formatValue?: (value: number) => string
  /** Label shown with the Slider. */
  label: string
  /** Number of terminal cells used by Track. */
  trackSize?: number
  /** Track and Range glyph. */
  trackMark?: string
  /** Thumb glyph. */
  thumbMark?: string
}

class SliderRecipeRenderable extends SliderRootRenderable {
  private readonly unsubscribeState: () => void

  constructor(ctx: RenderContext, options: SliderOptions) {
    const {
      formatValue = String,
      label,
      orientation = "horizontal",
      thumbMark = "●",
      trackMark = "─",
      trackSize = 20,
      ...rootOptions
    } = options
    super(ctx, {
      ...rootOptions,
      flexDirection: orientation === "vertical" ? "row" : "column",
      gap: 1,
      orientation,
    })
    const labelText = new TextRenderable(ctx, { content: "" })
    const track = new SliderTrackRenderable(ctx, {
      height: orientation === "vertical" ? trackSize : 1,
      position: "relative",
      store: this.store,
      width: orientation === "vertical" ? 1 : trackSize,
    })
    const trackText = new TextRenderable(ctx, {
      content: "",
      left: 0,
      position: "absolute",
      top: 0,
    })
    const range = new SliderRangeRenderable(ctx, {
      left: 0,
      position: "absolute",
      store: this.store,
      top: 0,
    })
    const rangeText = new TextRenderable(ctx, { content: "" })
    const thumb = new SliderThumbRenderable(ctx, {
      height: 1,
      position: "absolute",
      store: this.store,
      width: 1,
    })
    const thumbText = new TextRenderable(ctx, { content: "" })
    range.add(rangeText)
    thumb.add(thumbText)
    track.add(trackText)
    track.add(range)
    track.add(thumb)
    this.add(labelText)
    this.add(track)

    const apply = () => {
      const state = this.getState()
      const ratio =
        state.max === state.min ? 0 : (state.value - state.min) / (state.max - state.min)
      const offset = Math.round(ratio * (trackSize - 1))
      const vertical = state.orientation === "vertical"
      const thumbOffset = vertical ? trackSize - 1 - offset : offset
      const filled = vertical ? trackSize - thumbOffset : thumbOffset + 1
      const line = (mark: string, length: number) =>
        vertical ? Array.from({ length }, () => mark).join("\n") : mark.repeat(length)

      this.flexDirection = vertical ? "row" : "column"
      track.width = vertical ? 1 : trackSize
      track.height = vertical ? trackSize : 1
      trackText.content = line(trackMark, trackSize)
      rangeText.content = line(trackMark, filled)
      range.width = vertical ? 1 : filled
      range.height = vertical ? filled : 1
      range.left = 0
      range.top = vertical ? thumbOffset : 0
      thumb.left = vertical ? 0 : thumbOffset
      thumb.top = vertical ? thumbOffset : 0
      thumbText.content = thumbMark
      labelText.content = `${label}: ${formatValue(state.value)}`
      labelText.fg = state.disabled
        ? WhatsAppTheme.textTertiary
        : state.focused
          ? WhatsAppTheme.white
          : WhatsAppTheme.textPrimary
      trackText.fg = WhatsAppTheme.panelLight
      rangeText.fg = WhatsAppTheme.green
      thumbText.fg = state.disabled ? WhatsAppTheme.textTertiary : WhatsAppTheme.green
    }
    apply()
    this.unsubscribeState = this.store.subscribe(() => apply())
  }

  override endCoordinationLifetime(): void {
    this.unsubscribeState()
    super.endCoordinationLifetime()
  }
}

/** Creates a complete imperative Slider Recipe. */
export function createSlider(ctx: RenderContext, options: SliderOptions): SliderRootRenderable {
  return new SliderRecipeRenderable(ctx, options)
}
