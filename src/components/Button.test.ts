import { createTestRenderer } from "@opentui/core/testing"
import { ButtonRenderable } from "@tuiparts/core/button"
import { describe, expect, it, mock } from "bun:test"

import { createButton } from "~/components/Button"

describe("createButton (Tuiparts recipe)", () => {
  it("should create a ButtonRenderable with specified label and variant", async () => {
    const setup = await createTestRenderer({ width: 20, height: 3 })
    const onPress = mock(() => {})

    const btn = createButton(setup.renderer, {
      label: "Confirm",
      variant: "primary",
      onPress,
    })

    expect(btn).toBeInstanceOf(ButtonRenderable)
    expect(btn.getState().disabled).toBe(false)
    expect(btn.disabled).toBe(false)

    btn.store.requestPress({ source: "pointer", button: 0 })
    expect(onPress).toHaveBeenCalledTimes(1)

    btn.disabled = true
    expect(btn.getState().disabled).toBe(true)

    btn.store.requestPress({ source: "pointer", button: 0 })
    expect(onPress).toHaveBeenCalledTimes(1) // Not called again when disabled

    btn.destroy()
    setup.renderer.destroy()
  })

  it("should handle danger and secondary variants", async () => {
    const setup = await createTestRenderer({ width: 20, height: 3 })
    const dangerBtn = createButton(setup.renderer, {
      label: "Delete",
      variant: "danger",
    })
    expect(dangerBtn).toBeInstanceOf(ButtonRenderable)

    const secBtn = createButton(setup.renderer, {
      label: "Cancel",
      variant: "secondary",
    })
    expect(secBtn).toBeInstanceOf(ButtonRenderable)

    dangerBtn.destroy()
    secBtn.destroy()
    setup.renderer.destroy()
  })
})
