/**
 * Dialog Component
 * Built on @tuiparts/core/dialog primitive following tuiparts recipe contract
 */

import type { BoxOptions, RenderContext } from "@opentui/core"
import type { DialogRootOptions } from "@tuiparts/core/dialog"

import { TextRenderable } from "@opentui/core"
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

import { WhatsAppTheme } from "~/config/theme"

/** Visual defaults only; the Dialog primitive retains all layer behavior. */
export interface DialogOptions extends DialogRootOptions {
  width?: BoxOptions["width"]
}

export interface DialogRecipe {
  root: DialogRootRenderable
  trigger: DialogTriggerRenderable
  portal: DialogPortalRenderable
  backdrop: DialogBackdropRenderable
  popup: DialogPopupRenderable
}

/** Assemble an editable, terminal-wide Dialog layer from packaged Core parts. */
export function createDialog(
  ctx: RenderContext,
  { width = "80%", ...options }: DialogOptions = {}
): DialogRecipe {
  const root = new DialogRootRenderable(ctx, options)
  const trigger = new DialogTriggerRenderable(ctx, {
    store: root.store,
    paddingLeft: 1,
    paddingRight: 1,
    backgroundColor: WhatsAppTheme.panelLight,
  })
  const portal = new DialogPortalRenderable(ctx, {
    store: root.store,
    position: "absolute",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  })
  const backdrop = new DialogBackdropRenderable(ctx, {
    store: root.store,
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: WhatsAppTheme.deepDark,
  })
  const popup = new DialogPopupRenderable(ctx, {
    store: root.store,
    width,
    maxWidth: 56,
    flexDirection: "column",
    gap: 1,
    border: true,
    borderColor: WhatsAppTheme.panelLight,
    backgroundColor: WhatsAppTheme.panelDark,
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 1,
    paddingBottom: 1,
  })

  portal.add(backdrop)
  portal.add(popup)
  root.add(trigger)

  return { root, trigger, portal, backdrop, popup }
}

export function addDialogTitle(
  ctx: RenderContext,
  dialog: DialogRecipe,
  content: string
): DialogTitleRenderable {
  const title = new DialogTitleRenderable(ctx, {
    content,
    fg: WhatsAppTheme.white,
  })
  dialog.popup.add(title)
  return title
}

export function addDialogDescription(
  ctx: RenderContext,
  dialog: DialogRecipe,
  content: string
): DialogDescriptionRenderable {
  const description = new DialogDescriptionRenderable(ctx, {
    content,
    fg: WhatsAppTheme.textSecondary,
  })
  dialog.popup.add(description)
  return description
}

/** Adds an editable close affordance; dismissal behavior remains primitive-owned. */
export function addDialogClose(
  ctx: RenderContext,
  dialog: DialogRecipe,
  label = "✕ Close"
): DialogCloseRenderable {
  const close = new DialogCloseRenderable(ctx, {
    store: dialog.root.store,
    paddingLeft: 1,
    paddingRight: 1,
    backgroundColor: WhatsAppTheme.panelLight,
  })
  const text = new TextRenderable(ctx, {
    content: label,
    fg: WhatsAppTheme.textPrimary,
  })
  close.add(text)
  dialog.popup.add(close)
  return close
}
