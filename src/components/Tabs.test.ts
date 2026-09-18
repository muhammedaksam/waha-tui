import { createTestRenderer } from "@opentui/core/testing"
import { TabsRootRenderable } from "@tuiparts/core/tabs"
import { describe, expect, it, mock } from "bun:test"

import { createTabs, createTabsList, createTabsTab } from "~/components/Tabs"

describe("createTabs (Tuiparts recipe)", () => {
  it("should create tabs, list, and tabs with value change handling", async () => {
    const setup = await createTestRenderer({ width: 40, height: 4 })
    const onValueChange = mock(() => {})

    const root = createTabs(setup.renderer, {
      defaultValue: "tab1",
      onValueChange,
    })

    expect(root).toBeInstanceOf(TabsRootRenderable)

    const list = createTabsList(setup.renderer, root)
    const tab1 = createTabsTab(setup.renderer, root, {
      label: "First",
      value: "tab1",
    })
    const tab2 = createTabsTab(setup.renderer, root, {
      label: "Second",
      value: "tab2",
    })

    list.add(tab1)
    list.add(tab2)
    root.add(list)
    setup.renderer.root.add(root)

    expect(root.store.state.value).toBe("tab1")

    tab2.select()
    expect(root.store.state.value).toBe("tab2")
    expect(onValueChange).toHaveBeenCalledWith("tab2", expect.anything())

    tab1.destroy()
    tab2.destroy()
    root.destroy()
    setup.renderer.destroy()
  })
})
