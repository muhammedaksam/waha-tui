import { createTestRenderer } from "@opentui/core/testing"
import { NumberFieldRootRenderable } from "@tuiparts/core/number-field"
import { describe, expect, it, mock } from "bun:test"

import { createNumberField } from "~/components/NumberField"

describe("createNumberField (Tuiparts recipe)", () => {
  it("should handle stepping and value updates", async () => {
    const setup = await createTestRenderer({ width: 30, height: 4 })
    const onValueChange = mock(() => {})

    const nf = createNumberField(setup.renderer, {
      label: "Count",
      defaultValue: 5,
      min: 0,
      max: 10,
      step: 1,
      onValueChange,
    })

    setup.renderer.root.add(nf)

    expect(nf).toBeInstanceOf(NumberFieldRootRenderable)
    expect(nf.value).toBe(5)

    nf.store.stepByPress(1, { source: "pointer", button: 0 })
    expect(nf.value).toBe(6)
    expect(onValueChange).toHaveBeenCalledWith(6, expect.anything())

    nf.store.stepByPress(-1, { source: "pointer", button: 0 })
    expect(nf.value).toBe(5)

    nf.disabled = true
    expect(nf.getState().disabled).toBe(true)

    nf.destroy()
    setup.renderer.destroy()
  })
})
