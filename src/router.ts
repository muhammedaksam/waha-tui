/**
 * View Router
 * Centralized view routing and rendering logic
 */

import type { CliRenderer, VChild } from "@opentui/core"

import { ToasterRenderable } from "@opentui-ui/toast"
import { Box, BoxRenderable, Text } from "@opentui/core"

import type { AppState, ViewType } from "./state/AppState"
import { logoutSession } from "./client"
import { clearMenuBounds, ContextMenu, isClickOutsideContextMenu } from "./components/ContextMenu"
import { Footer } from "./components/Footer"
import { LogoutConfirmModal, UpdateAvailableModal } from "./components/Modal"
import { WHATSAPP_TOASTER_CONFIG } from "./components/Toast"
import { appState } from "./state/AppState"
import { debugLog } from "./utils/debug"
import { chatListManager } from "./views/ChatListManager"
import { ConfigView } from "./views/ConfigView"
import { LoadingView } from "./views/LoadingView"
import { MainLayout } from "./views/MainLayout"
import { QRCodeView } from "./views/QRCodeView"
import { SessionsView } from "./views/SessionsView"
import { SettingsView } from "./views/SettingsView"

/**
 * Map of view types to their render functions.
 * Used for routing between different application views.
 * @internal
 */
const VIEW_COMPONENTS: Record<ViewType, () => unknown> = {
  config: ConfigView,
  sessions: SessionsView,
  qr: QRCodeView,
  loading: LoadingView,
  chats: MainLayout,
  conversation: MainLayout,
  settings: SettingsView,
}

/**
 * Get the content component for the current view.
 * Returns the appropriate view component based on the view type.
 * @param view - The view type to render
 * @returns The rendered view component or a placeholder for unknown views
 */
export function getViewContent(view: ViewType): unknown {
  const component = VIEW_COMPONENTS[view]
  if (component) {
    return component()
  }
  return Text({ content: `View: ${view} (Coming soon)` })
}

/**
 * Check if fast-path selection update is possible.
 * Fast-path avoids full re-render by only updating selection styles.
 * @param state - Current application state
 * @param forceRebuild - Whether to force a full rebuild
 * @returns True if fast-path update can be used
 */
export function canUseFastPath(state: AppState, forceRebuild: boolean): boolean {
  return (
    !forceRebuild &&
    state.currentView === "chats" &&
    state.lastChangeType === "selection" &&
    chatListManager.hasCachedList()
  )
}

/**
 * Perform fast-path selection update without full re-render.
 * Updates chat list selection and scroll position efficiently.
 * @param state - Current application state
 */
export function updateSelectionFastPath(state: AppState): void {
  debugLog("Render", "Fast path: updating selection only")
  chatListManager.updateSelection(state.selectedChatIndex)
  chatListManager.updateScroll(state.chatListScrollOffset)
}

/**
 * Create the main render function with the given renderer.
 * Returns a function that handles full application rendering.
 * @param renderer - The CLI renderer instance
 * @returns A render function that can be called to update the UI
 * @example
 * ```typescript
 * const renderApp = createRenderApp(renderer)
 * appState.subscribe(() => renderApp())
 * renderApp(true) // Initial render with force rebuild
 * ```
 */
export function createRenderApp(renderer: CliRenderer): (forceRebuild?: boolean) => void {
  // Initialize the toaster once - it manages its own lifecycle
  let toasterInitialized = false

  return function renderApp(forceRebuild: boolean = false): void {
    const state = appState.getState()

    // Optimization: for selection/scroll changes in chat view, only update styles
    if (canUseFastPath(state, forceRebuild)) {
      updateSelectionFastPath(state)
      return
    }

    // Clear previous render - remove all children (except toaster)
    const children = renderer.root.getChildren()
    for (const child of children) {
      // Keep the toaster renderable
      if (child instanceof ToasterRenderable) continue
      renderer.root.remove(child.id)
    }

    // Destroy chat list manager when leaving chats view
    if (state.currentView !== "chats" && state.currentView !== "conversation") {
      chatListManager.destroy()
    }

    // Clear menu bounds when context menu is closed
    if (!state.contextMenu?.visible) {
      clearMenuBounds()
    }

    // Create root wrapper with mouse handler for outside-click detection
    const rootWrapper = new BoxRenderable(renderer, {
      flexDirection: "column",
      flexGrow: 1,
      onMouse(event) {
        // Close context menu on any mouse down outside the menu
        if (event.type === "down" && state.contextMenu?.visible) {
          if (isClickOutsideContextMenu(event.x, event.y)) {
            appState.closeContextMenu()
          }
        }
      },
    })

    // Main Content Area
    rootWrapper.add(Box({ flexGrow: 1 }, getViewContent(state.currentView) as VChild))

    // Footer with styled keyboard hints
    rootWrapper.add(Footer())

    // Add root wrapper to renderer
    renderer.root.add(rootWrapper)

    // Render context menu overlay if visible
    const contextMenuBox = ContextMenu()
    if (contextMenuBox) {
      renderer.root.add(contextMenuBox)
    }

    // Add toaster once (it manages its own toast lifecycle)
    if (!toasterInitialized) {
      renderer.root.add(new ToasterRenderable(renderer, WHATSAPP_TOASTER_CONFIG))
      toasterInitialized = true
    }

    // Render logout confirmation modal if visible
    if (state.showLogoutModal) {
      LogoutConfirmModal({
        onConfirm: async () => {
          appState.setShowLogoutModal(false)
          await logoutSession()
          appState.setCurrentView("sessions")
        },
        onCancel: () => {
          appState.setShowLogoutModal(false)
        },
      })
    }

    // Render update available modal if visible
    if (state.showUpdateModal && state.updateInfo) {
      UpdateAvailableModal({
        updateInfo: state.updateInfo,
        onDismiss: () => {
          appState.dismissUpdateModal()
        },
      })
    }
  }
}
