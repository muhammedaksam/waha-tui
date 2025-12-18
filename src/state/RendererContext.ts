/**
 * Renderer Context
 * Provides global access to the renderer instance for imperative API usage
 */

import type { CliRenderer } from "@opentui/core"

let rendererInstance: CliRenderer | null = null

export function setRenderer(renderer: CliRenderer): void {
  rendererInstance = renderer
}

export function getRenderer(): CliRenderer {
  if (!rendererInstance) {
    throw new Error("Renderer not initialized. Call setRenderer() first.")
  }
  return rendererInstance
}
