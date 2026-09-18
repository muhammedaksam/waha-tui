import type { VNode } from "@opentui/core"

import { BoxRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { SwitchRootRenderable } from "@tuiparts/core/switch"
import { describe, expect, it, mock } from "bun:test"

import { createSwitch, ToggleSwitch } from "~/components/Switch"

describe("ToggleSwitch", () => {
  it("should render unchecked state when passed false", () => {
    const node = ToggleSwitch(false)
    expect(node).toBeDefined()
    expect(node.type).toBe(BoxRenderable)
    expect(node.props?.width).toBe(3)

    // Children: track text and thumb box
    const trackChild = node.children?.[0] as VNode | undefined
    expect(trackChild?.props?.content).toBe("───")

    const thumbBox = node.children?.[1] as VNode | undefined
    expect(thumbBox?.props?.left).toBe(0)
    const thumbText = thumbBox?.children?.[0] as VNode | undefined
    expect(thumbText?.props?.content).toBe("●")
  })

  it("should render checked state when passed true", () => {
    const node = ToggleSwitch(true)
    expect(node).toBeDefined()
    expect(node.type).toBe(BoxRenderable)
    expect(node.props?.width).toBe(3)

    const thumbBox = node.children?.[1] as VNode | undefined
    expect(thumbBox?.props?.left).toBe(2)
  })

  it("should support comfortable density and custom symbols", () => {
    const node = ToggleSwitch({
      checked: true,
      density: "comfortable",
      symbols: "ascii",
    })
    expect(node).toBeDefined()
    expect(node.props?.width).toBe(5)

    const trackChild = node.children?.[0] as VNode | undefined
    expect(trackChild?.props?.content).toBe("-----")

    const thumbBox = node.children?.[1] as VNode | undefined
    expect(thumbBox?.props?.left).toBe(4)
    const thumbText = thumbBox?.children?.[0] as VNode | undefined
    expect(thumbText?.props?.content).toBe("*")
  })

  it("should handle default unchecked when passed empty object", () => {
    const node = ToggleSwitch({})
    expect(node).toBeDefined()
    expect(node.type).toBe(BoxRenderable)
    expect(node.props?.width).toBe(3)

    const thumbBox = node.children?.[1] as VNode | undefined
    expect(thumbBox?.props?.left).toBe(0)
  })
})

describe("createSwitch (Tuiparts recipe)", () => {
  it("should instantiate SwitchRootRenderable recipe", async () => {
    const setup = await createTestRenderer({ width: 30, height: 3 })
    const onCheckedChange = mock(() => {})
    const sw = createSwitch(setup.renderer, {
      defaultChecked: false,
      label: "Enter is send",
      onCheckedChange,
    })

    expect(sw).toBeInstanceOf(SwitchRootRenderable)
    expect(sw.getState().checked).toBe(false)

    sw.store.requestToggle()
    expect(sw.getState().checked).toBe(true)
    expect(onCheckedChange).toHaveBeenCalledWith(true)

    sw.destroy()
    setup.renderer.destroy()
  })
})
