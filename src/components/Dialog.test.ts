import { createTestRenderer } from "@opentui/core/testing"
import {
  DialogBackdropRenderable,
  DialogCloseRenderable,
  DialogDescriptionRenderable,
  DialogPopupRenderable,
  DialogPortalRenderable,
  DialogRootRenderable,
  DialogTitleRenderable,
  DialogTriggerRenderable,
} from "@tuiparts/core/dialog"
import { describe, expect, it, mock } from "bun:test"

import {
  addDialogClose,
  addDialogDescription,
  addDialogTitle,
  createDialog,
} from "~/components/Dialog"

describe("createDialog (Tuiparts recipe)", () => {
  it("should assemble a complete dialog with trigger, portal, popup, and semantics", async () => {
    const setup = await createTestRenderer({ width: 50, height: 15 })
    const onOpenChange = mock(() => {})

    const dialog = createDialog(setup.renderer, {
      defaultOpen: false,
      onOpenChange,
    })

    const title = addDialogTitle(setup.renderer, dialog, "Test Title")
    const desc = addDialogDescription(setup.renderer, dialog, "Test Description")
    const close = addDialogClose(setup.renderer, dialog, "Dismiss")

    setup.renderer.root.add(dialog.root)
    setup.renderer.root.add(dialog.portal)

    expect(dialog.root).toBeInstanceOf(DialogRootRenderable)
    expect(dialog.trigger).toBeInstanceOf(DialogTriggerRenderable)
    expect(dialog.portal).toBeInstanceOf(DialogPortalRenderable)
    expect(dialog.backdrop).toBeInstanceOf(DialogBackdropRenderable)
    expect(dialog.popup).toBeInstanceOf(DialogPopupRenderable)
    expect(title).toBeInstanceOf(DialogTitleRenderable)
    expect(desc).toBeInstanceOf(DialogDescriptionRenderable)
    expect(close).toBeInstanceOf(DialogCloseRenderable)

    expect(dialog.root.state.open).toBe(false)
    expect(dialog.portal.visible).toBe(false)

    dialog.root.store.setOpen(true)
    expect(dialog.root.state.open).toBe(true)
    expect(dialog.portal.visible).toBe(true)
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything())

    dialog.root.destroy()
    dialog.portal.destroy()
    setup.renderer.destroy()
  })
})
