/**
 * ToastRenderable - A single toast notification component
 *
 * Renders a toast with icon, title, description, action button, and close button.
 */

import type { RenderContext } from "@opentui/core"

import { BoxRenderable, parseColor, TextAttributes, TextRenderable } from "@opentui/core"

import type { SpinnerConfig, Toast, ToastIcons, ToastOptions, ToastStyle } from "../types"
import { resolvePadding } from "../../utils"
import { TIME_BEFORE_UNMOUNT, TOAST_WIDTH } from "../constants"
import { DEFAULT_ICONS, getLoadingIcon, getSpinnerConfig, getTypeIcon } from "../icons"
import { ToastState } from "../state"
import { isAction } from "../types"
import { computeToastDuration, computeToastStyle } from "../utils"

/**
 * Options for creating a ToastRenderable
 */
export interface ToastRenderableOptions {
  /** The toast data to render */
  toast: Toast
  /** Custom icons (merged with defaults), or `false` to disable icons */
  icons?: Partial<ToastIcons> | false
  /** Toast options (styles, duration, per-type overrides) */
  toastOptions?: ToastOptions
  /** Global closeButton setting from toaster */
  closeButton?: boolean
  /** Callback when toast should be removed from container */
  onRemove?: (toast: Toast) => void
}

/**
 * ToastRenderable - A single toast notification
 *
 * Renders a toast with:
 * - Icon (based on type, with spinner animation for loading)
 * - Title (bold text)
 * - Description (optional, muted text)
 * - Action button (optional)
 * - Close button (optional)
 *
 * Supports:
 * - Auto-dismiss with configurable duration
 * - Pause/resume timer
 * - Style updates when toast type changes
 * - Spinner animation for loading toasts
 */
export class ToastRenderable extends BoxRenderable {
  private _toast: Toast
  private _icons: ToastIcons | false
  private _toastOptions?: ToastOptions
  private _computedStyle: ToastStyle
  private _closeButton?: boolean
  private _onRemove?: (toast: Toast) => void

  // Timer management
  private _remainingTime: number
  private _closeTimerStartTime: number = 0
  private _lastCloseTimerStartTime: number = 0
  private _timerHandle: ReturnType<typeof setTimeout> | null = null
  private _paused: boolean = false
  private _dismissed: boolean = false

  // Spinner animation for loading toasts
  private _spinnerHandle: ReturnType<typeof setInterval> | null = null
  private _spinnerFrameIndex: number = 0
  private _spinnerConfig: SpinnerConfig | null = null

  // Child renderables
  private _iconText: TextRenderable | null = null
  private _contentBox: BoxRenderable | null = null
  private _titleText: TextRenderable | null = null
  private _descriptionText: TextRenderable | null = null
  private _actionsBox: BoxRenderable | null = null

  constructor(ctx: RenderContext, options: ToastRenderableOptions) {
    // Compute the merged style for this toast
    const computedStyle = computeToastStyle(
      options.toast.type,
      options.toastOptions,
      options.toast.style
    )

    // Compute duration for this toast
    const duration = computeToastDuration(
      options.toast.type,
      options.toastOptions,
      options.toast.duration
    )

    // Resolve padding from computed style
    // Defaults are passed separately so user shorthands (padding, paddingX) cascade correctly
    const padding = resolvePadding(computedStyle, {
      top: 0,
      right: 1,
      bottom: 0,
      left: 1,
    })

    super(ctx, {
      id: `toast-${options.toast.id}`,
      flexDirection: "row",
      gap: 1,
      border: computedStyle.border,
      borderStyle: computedStyle.borderStyle,
      borderColor: computedStyle.borderColor,
      customBorderChars: computedStyle.customBorderChars,
      backgroundColor: computedStyle.backgroundColor,
      minHeight: computedStyle.minHeight,
      maxWidth: computedStyle.maxWidth ?? TOAST_WIDTH,
      minWidth: computedStyle.minWidth,
      paddingTop: padding.top,
      paddingRight: padding.right,
      paddingBottom: padding.bottom,
      paddingLeft: padding.left,
      onMouseOver: () => this.pause(),
      onMouseOut: () => this.resume(),
    })

    this._toast = options.toast
    this._icons = options.icons === false ? false : { ...DEFAULT_ICONS, ...options.icons }
    this._toastOptions = options.toastOptions
    this._computedStyle = computedStyle
    this._closeButton = options.closeButton
    this._onRemove = options.onRemove
    this._remainingTime = duration

    this.setupContent()

    // Start timer if not infinite duration and not loading type
    if (this._remainingTime !== Infinity && this._toast.type !== "loading") {
      this.startTimer()
    }

    // Start spinner animation for loading toasts
    if (this._toast.type === "loading") {
      this.startSpinner()
    }
  }

  /**
   * Set up the toast content (icon, title, description, actions)
   */
  private setupContent(): void {
    const ctx = this.ctx
    const toast = this._toast
    const style = this._computedStyle
    const icons = this._icons

    // Determine icon color (iconColor > borderColor)
    const iconColor = style.iconColor ?? style.borderColor

    // Icon - use spinner frames for loading type, otherwise use static icon
    // Skip icon rendering entirely if icons === false (unless toast has custom icon)
    const isLoading = toast.type === "loading"

    // Resolve the spinner config for loading toasts
    if (isLoading && icons !== false) {
      this._spinnerConfig = getSpinnerConfig(icons.loading)
    }

    const icon =
      toast.icon ??
      (icons === false
        ? undefined
        : isLoading
          ? getLoadingIcon(icons.loading)
          : getTypeIcon(toast.type, icons))
    if (icon) {
      this._iconText = new TextRenderable(ctx, {
        id: `${this.id}-icon`,
        content: icon,
        fg: iconColor,
        flexShrink: 0,
        paddingTop: 0,
        paddingBottom: 0,
      })
      this.add(this._iconText)
    }

    // Content container (title + description)
    this._contentBox = new BoxRenderable(ctx, {
      id: `${this.id}-content`,
      flexDirection: "column",
      flexGrow: 1,
      flexShrink: 1,
      gap: 0,
    })

    // Title
    const title = typeof toast.title === "function" ? toast.title() : toast.title
    if (title) {
      this._titleText = new TextRenderable(ctx, {
        id: `${this.id}-title`,
        content: title,
        fg: style.foregroundColor,
        attributes: TextAttributes.BOLD,
        wrapMode: "word",
      })
      this._contentBox.add(this._titleText)
    }

    // Description
    const description =
      typeof toast.description === "function" ? toast.description() : toast.description
    if (description) {
      this._descriptionText = new TextRenderable(ctx, {
        id: `${this.id}-description`,
        content: description,
        fg: style.mutedColor,
        wrapMode: "word",
      })
      this._contentBox.add(this._descriptionText)
    }

    this.add(this._contentBox)

    // Actions (action button)
    if (toast.action) {
      this._actionsBox = new BoxRenderable(ctx, {
        id: `${this.id}-actions`,
        flexDirection: "row",
        gap: 1,
        flexShrink: 0,
        alignItems: "center",
      })

      if (toast.action && isAction(toast.action)) {
        const actionText = new TextRenderable(ctx, {
          id: `${this.id}-action`,
          content: `[${toast.action.label}]`,
          fg: style.foregroundColor,
          onMouseUp: () => toast.action?.onClick?.(),
        })
        this._actionsBox.add(actionText)
      }

      this.add(this._actionsBox)
    }

    // Close button (if enabled globally or per-toast)
    const showCloseButton = toast.closeButton ?? this._closeButton
    if (showCloseButton && toast.dismissible !== false) {
      const closeIcon = icons === false ? "×" : icons.close
      const closeText = new TextRenderable(ctx, {
        id: `${this.id}-close`,
        content: closeIcon,
        fg: style.mutedColor,
        flexShrink: 0,
        onMouseUp: () => this.dismiss(),
      })
      this.add(closeText)
    }
  }

  /**
   * Start the auto-dismiss timer
   */
  private startTimer(): void {
    if (this._remainingTime === Infinity) return

    this._closeTimerStartTime = Date.now()

    this._timerHandle = setTimeout(() => {
      this._toast.onAutoClose?.(this._toast)
      this.dismiss()
    }, this._remainingTime)
  }

  /**
   * Pause the auto-dismiss timer
   *
   * Call this when the user is interacting with the toast
   * (e.g., hovering over it in a mouse-enabled terminal)
   */
  public pause(): void {
    if (this._paused || this._remainingTime === Infinity) return

    this._paused = true

    if (this._timerHandle) {
      clearTimeout(this._timerHandle)
      this._timerHandle = null
    }

    if (this._lastCloseTimerStartTime < this._closeTimerStartTime) {
      const elapsed = Date.now() - this._closeTimerStartTime
      this._remainingTime = Math.max(0, this._remainingTime - elapsed)
    }

    this._lastCloseTimerStartTime = Date.now()
  }

  /**
   * Resume the auto-dismiss timer
   *
   * Call this when the user stops interacting with the toast
   */
  public resume(): void {
    if (!this._paused || this._remainingTime === Infinity) return

    this._paused = false
    this.startTimer()
  }

  /**
   * Start the spinner animation for loading toasts
   */
  private startSpinner(): void {
    if (this._spinnerHandle || !this._spinnerConfig) return

    const { frames, interval } = this._spinnerConfig

    this._spinnerHandle = setInterval(() => {
      this._spinnerFrameIndex = (this._spinnerFrameIndex + 1) % frames.length
      const frame = frames[this._spinnerFrameIndex]
      if (this._iconText && frame) {
        this._iconText.content = frame
        this.requestRender()
      }
    }, interval)
  }

  /**
   * Stop the spinner animation
   */
  private stopSpinner(): void {
    if (this._spinnerHandle) {
      clearInterval(this._spinnerHandle)
      this._spinnerHandle = null
    }
  }

  /**
   * Dismiss this toast
   *
   * Triggers the onDismiss callback and schedules removal.
   * Also notifies ToastState subscribers (e.g., React hooks) about the dismissal.
   */
  public dismiss(): void {
    if (this._dismissed) return

    this._dismissed = true

    if (this._timerHandle) {
      clearTimeout(this._timerHandle)
      this._timerHandle = null
    }

    this.stopSpinner()

    this._toast.onDismiss?.(this._toast)

    ToastState.dismiss(this._toast.id)

    // Wait a bit before removing (for potential exit effects)
    setTimeout(() => {
      this._onRemove?.(this._toast)
    }, TIME_BEFORE_UNMOUNT)
  }

  /**
   * Update the toast data
   *
   * Used for updating an existing toast (e.g., toast.success('done', { id: existingId }))
   */
  public updateToast(toast: Toast): void {
    this._toast = toast

    // Recompute style for the new type
    const computedStyle = computeToastStyle(toast.type, this._toastOptions, toast.style)
    this._computedStyle = computedStyle

    // Update border color based on new type
    if (computedStyle.borderColor) {
      this.borderColor = computedStyle.borderColor
    }

    // Update custom border chars if provided
    if (computedStyle.customBorderChars) {
      this.customBorderChars = computedStyle.customBorderChars
    }

    // Determine icon color
    const iconColor = computedStyle.iconColor ?? computedStyle.borderColor

    // Update icon
    if (this._iconText) {
      const icon =
        toast.icon ?? (this._icons === false ? undefined : getTypeIcon(toast.type, this._icons))
      if (icon) {
        this._iconText.content = icon
      }
      if (iconColor) {
        this._iconText.fg = parseColor(iconColor)
      }
    }

    // Update title
    if (this._titleText) {
      const title = typeof toast.title === "function" ? toast.title() : toast.title
      if (title) {
        this._titleText.content = title
      }
    }

    // Update description
    if (this._descriptionText) {
      const description =
        typeof toast.description === "function" ? toast.description() : toast.description
      if (description) {
        this._descriptionText.content = description
      }
    }

    // Handle spinner state changes
    const wasLoading = this._spinnerHandle !== null
    const isLoading = toast.type === "loading"

    if (wasLoading && !isLoading) {
      // Transitioning from loading to non-loading: stop spinner
      this.stopSpinner()
      this._spinnerConfig = null
    } else if (!wasLoading && isLoading) {
      // Transitioning to loading: set up spinner config and start
      if (this._icons !== false) {
        this._spinnerConfig = getSpinnerConfig(this._icons.loading)
      }
      this.startSpinner()
    }

    // Reset timer if duration changed and not loading
    if (toast.type !== "loading") {
      if (this._timerHandle) {
        clearTimeout(this._timerHandle)
      }
      this._remainingTime = computeToastDuration(toast.type, this._toastOptions, toast.duration)
      if (this._remainingTime !== Infinity) {
        this.startTimer()
      }
    }

    this.requestRender()
  }

  /**
   * Get the toast data
   */
  public get toast(): Toast {
    return this._toast
  }

  /**
   * Check if toast is dismissed
   */
  public get isDismissed(): boolean {
    return this._dismissed
  }

  /**
   * Clean up on destroy
   */
  public override destroy(): void {
    if (this._timerHandle) {
      clearTimeout(this._timerHandle)
      this._timerHandle = null
    }
    this.stopSpinner()
    super.destroy()
  }
}
