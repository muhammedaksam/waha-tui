import type { KeyEvent } from "@opentui/core"

import { createTestRenderer } from "@opentui/core/testing"
import { SliderRootRenderable } from "@tuiparts/core/slider"
import { describe, expect, it, mock } from "bun:test"

import { createSlider } from "~/components/Slider"

describe("createSlider (Tuiparts recipe)", () => {
  it("should create a slider and handle value updates", async () => {
    const setup = await createTestRenderer({ width: 40, height: 5 })
    const onValueChange = mock(() => {})

    const slider = createSlider(setup.renderer, {
      label: "Volume",
      min: 0,
      max: 100,
      defaultValue: 50,
      onValueChange,
      trackSize: 20,
    })

    setup.renderer.root.add(slider)

    expect(slider).toBeInstanceOf(SliderRootRenderable)
    expect(slider.value).toBe(50)

    slider.store.stepByKey({ name: "right" } as unknown as KeyEvent)
    expect(slider.value).toBe(51)
    expect(onValueChange).toHaveBeenCalledWith(51, expect.anything())

    slider.store.setValue(75)
    expect(slider.value).toBe(75)

    slider.disabled = true
    expect(slider.getState().disabled).toBe(true)

    slider.destroy()
    setup.renderer.destroy()
  })
})
