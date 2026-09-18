import { TextRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import {
  CollapsiblePanelRenderable,
  CollapsibleRootRenderable,
  CollapsibleTriggerRenderable,
} from "@tuiparts/core/collapsible"
import { describe, expect, it, mock } from "bun:test"

import {
  createCollapsible,
  createCollapsibleContent,
  createCollapsibleTrigger,
} from "~/components/Collapsible"

describe("createCollapsible (Tuiparts recipe)", () => {
  it("should coordinate open state between trigger and content panel", async () => {
    const setup = await createTestRenderer({ width: 30, height: 6 })
    const onOpenChange = mock(() => {})

    const collapsible = createCollapsible(setup.renderer, {
      defaultOpen: false,
      onOpenChange,
    })

    const trigger = createCollapsibleTrigger(setup.renderer, collapsible, {
      label: "Show Advanced",
    })

    const content = createCollapsibleContent(setup.renderer, collapsible)
    content.add(new TextRenderable(setup.renderer, { content: "Hidden settings" }))

    collapsible.add(trigger)
    collapsible.add(content)
    setup.renderer.root.add(collapsible)

    expect(collapsible).toBeInstanceOf(CollapsibleRootRenderable)
    expect(trigger).toBeInstanceOf(CollapsibleTriggerRenderable)
    expect(content).toBeInstanceOf(CollapsiblePanelRenderable)
    expect(collapsible.open).toBe(false)
    expect(content.visible).toBe(false)

    collapsible.store.toggle()
    expect(collapsible.open).toBe(true)
    expect(content.visible).toBe(true)
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything())

    collapsible.destroy()
    setup.renderer.destroy()
  })
})
