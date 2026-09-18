import { TextRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import {
  AccordionItemRenderable,
  AccordionPanelRenderable,
  AccordionRootRenderable,
  AccordionTriggerRenderable,
} from "@tuiparts/core/accordion"
import { describe, expect, it, mock } from "bun:test"

import {
  createAccordion,
  createAccordionContent,
  createAccordionItem,
  createAccordionTrigger,
} from "~/components/Accordion"

describe("createAccordion (Tuiparts recipe)", () => {
  it("should coordinate open state and expansion between items", async () => {
    const setup = await createTestRenderer({ width: 30, height: 10 })
    const onValueChange = mock(() => {})

    const accordion = createAccordion(setup.renderer, {
      defaultValue: ["item-1"],
      onValueChange,
      multiple: false,
    })

    const item1 = createAccordionItem(setup.renderer, accordion, { value: "item-1" })
    const trigger1 = createAccordionTrigger(setup.renderer, item1, { label: "Section 1" })
    const content1 = createAccordionContent(setup.renderer, item1)
    content1.add(new TextRenderable(setup.renderer, { content: "Details 1" }))
    item1.add(trigger1)
    item1.add(content1)

    const item2 = createAccordionItem(setup.renderer, accordion, { value: "item-2" })
    const trigger2 = createAccordionTrigger(setup.renderer, item2, { label: "Section 2" })
    const content2 = createAccordionContent(setup.renderer, item2)
    content2.add(new TextRenderable(setup.renderer, { content: "Details 2" }))
    item2.add(trigger2)
    item2.add(content2)

    accordion.add(item1)
    accordion.add(item2)
    setup.renderer.root.add(accordion)

    expect(accordion).toBeInstanceOf(AccordionRootRenderable)
    expect(item1).toBeInstanceOf(AccordionItemRenderable)
    expect(trigger1).toBeInstanceOf(AccordionTriggerRenderable)
    expect(content1).toBeInstanceOf(AccordionPanelRenderable)

    expect(item1.getState().open).toBe(true)
    expect(content1.visible).toBe(true)
    expect(item2.getState().open).toBe(false)
    expect(content2.visible).toBe(false)

    // Toggle item 2 (single mode closes item 1)
    item2.toggle()
    expect(item1.getState().open).toBe(false)
    expect(content1.visible).toBe(false)
    expect(item2.getState().open).toBe(true)
    expect(content2.visible).toBe(true)
    expect(onValueChange).toHaveBeenCalledWith(["item-2"], expect.anything())

    accordion.destroy()
    setup.renderer.destroy()
  })
})
