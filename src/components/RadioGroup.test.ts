import { createTestRenderer } from "@opentui/core/testing"
import { RadioRootRenderable } from "@tuiparts/core/radio"
import { RadioGroupRenderable } from "@tuiparts/core/radio-group"
import { describe, expect, it, mock } from "bun:test"

import { createRadioGroup, createRadioGroupItem } from "~/components/RadioGroup"

describe("createRadioGroup (Tuiparts recipe)", () => {
  it("should coordinate radio item selection and updates", async () => {
    const setup = await createTestRenderer({ width: 30, height: 6 })
    const onValueChange = mock(() => {})

    const group = createRadioGroup(setup.renderer, {
      defaultValue: "apple",
      onValueChange,
    })

    const item1 = createRadioGroupItem(setup.renderer, group.store, {
      label: "Apple",
      value: "apple",
    })
    const item2 = createRadioGroupItem(setup.renderer, group.store, {
      label: "Banana",
      value: "banana",
    })

    group.add(item1)
    group.add(item2)
    setup.renderer.root.add(group)

    expect(group).toBeInstanceOf(RadioGroupRenderable)
    expect(item1).toBeInstanceOf(RadioRootRenderable)
    expect(group.value).toBe("apple")
    expect(item1.checked).toBe(true)
    expect(item2.checked).toBe(false)

    item2.press()
    expect(group.value).toBe("banana")
    expect(item1.checked).toBe(false)
    expect(item2.checked).toBe(true)
    expect(onValueChange).toHaveBeenCalledWith("banana", expect.anything())

    group.destroy()
    setup.renderer.destroy()
  })
})
