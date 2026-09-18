import { createTestRenderer } from "@opentui/core/testing"
import { CheckboxRootRenderable } from "@tuiparts/core/checkbox"
import { describe, expect, it, mock } from "bun:test"

import { createCheckbox } from "~/components/Checkbox"

describe("createCheckbox (Tuiparts recipe)", () => {
  it("should create a CheckboxRootRenderable with toggle behavior", async () => {
    const setup = await createTestRenderer({ width: 30, height: 3 })
    const onCheckedChange = mock(() => {})

    const cb = createCheckbox(setup.renderer, {
      label: "Allow multiple answers",
      defaultChecked: false,
      onCheckedChange,
    })

    expect(cb).toBeInstanceOf(CheckboxRootRenderable)
    expect(cb.getState().checked).toBe(false)

    cb.store.requestToggle()
    expect(cb.getState().checked).toBe(true)
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything())

    cb.disabled = true
    expect(cb.getState().disabled).toBe(true)

    cb.destroy()
    setup.renderer.destroy()
  })
})
