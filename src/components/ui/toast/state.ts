import type {
  ExternalToast,
  PromiseData,
  PromiseExtendedResult,
  PromiseT,
  Toast,
  ToastToDismiss,
  ToastType,
} from "./types"

let toastsCounter = 1

type TitleT = string | (() => string)

/**
 * Check if data is an HTTP Response object
 */
function isHttpResponse(data: unknown): data is Response {
  return (
    data !== null &&
    typeof data === "object" &&
    "ok" in data &&
    typeof (data as Response).ok === "boolean" &&
    "status" in data &&
    typeof (data as Response).status === "number"
  )
}

/**
 * Observer class implementing the pub/sub pattern for toast state management.
 * This is the core of the Sonner-compatible API.
 */
class Observer {
  subscribers: Array<(toast: Toast | ToastToDismiss) => void> = []
  toasts: Toast[] = []
  dismissedToasts: Set<string | number> = new Set()

  // Cached active toasts for referential stability
  private _activeToasts: Toast[] = []

  private _updateActiveToastsCache = (): void => {
    const active = this.toasts.filter((toast) => !this.dismissedToasts.has(toast.id))

    if (
      active.length !== this._activeToasts.length ||
      active.some((t, i) => t !== this._activeToasts[i])
    ) {
      this._activeToasts = active
    }
  }

  /**
   * Subscribe to toast state changes
   */
  subscribe = (subscriber: (toast: Toast | ToastToDismiss) => void): (() => void) => {
    this.subscribers.push(subscriber)

    return () => {
      const index = this.subscribers.indexOf(subscriber)
      if (index > -1) {
        this.subscribers.splice(index, 1)
      }
    }
  }

  /**
   * Publish a toast to all subscribers
   */
  publish = (data: Toast): void => {
    for (const subscriber of this.subscribers) {
      subscriber(data)
    }
  }

  /**
   * Add a new toast
   */
  addToast = (data: Toast): void => {
    this.toasts = [...this.toasts, data]
    this._updateActiveToastsCache()
    this.publish(data)
  }

  /**
   * Create a toast (internal method)
   */
  create = (
    data: ExternalToast & {
      message?: TitleT
      type?: ToastType
    }
  ): string | number => {
    const { message, ...rest } = data
    const id =
      typeof data.id === "number" || (data.id && data.id.length > 0) ? data.id : toastsCounter++

    const alreadyExists = this.toasts.find((toast) => toast.id === id)
    const dismissible = data.dismissible === undefined ? true : data.dismissible

    // If was dismissed, allow it to be re-shown
    if (this.dismissedToasts.has(id)) {
      this.dismissedToasts.delete(id)
    }

    if (alreadyExists) {
      // Update existing toast
      this.toasts = this.toasts.map((toast) => {
        if (toast.id === id) {
          this.publish({ ...toast, ...data, id, title: message })
          return {
            ...toast,
            ...data,
            id,
            dismissible,
            title: message,
          }
        }
        return toast
      })
      this._updateActiveToastsCache()
    } else {
      // Add new toast
      this.addToast({
        title: message,
        ...rest,
        dismissible,
        id,
        type: data.type ?? "default",
      } as Toast)
    }

    return id
  }

  /**
   * Dismiss a toast by ID, or all toasts if no ID provided
   *
   * @example
   * ```ts
   * // Dismiss a specific toast
   * const id = toast('Hello');
   * toast.dismiss(id);
   *
   * // Dismiss all toasts
   * toast.dismiss();
   * ```
   */
  dismiss = (id?: string | number): string | number | undefined => {
    if (id !== undefined) {
      this.dismissedToasts.add(id)
      this._updateActiveToastsCache()
      // Use requestAnimationFrame equivalent for terminal (setTimeout with 0)
      setTimeout(() => {
        for (const subscriber of this.subscribers) {
          subscriber({ id, dismiss: true })
        }
      }, 0)
    } else {
      // Dismiss all toasts
      for (const toast of this.toasts) {
        this.dismissedToasts.add(toast.id)
        for (const subscriber of this.subscribers) {
          subscriber({ id: toast.id, dismiss: true })
        }
      }
      this._updateActiveToastsCache()
    }

    return id
  }

  /**
   * Create a basic message toast
   *
   * @example
   * ```ts
   * toast.message('Hello World');
   * toast.message('With description', { description: 'More details here' });
   * ```
   */
  message = (message: TitleT, data?: ExternalToast): string | number => {
    return this.create({ ...data, message, type: "default" })
  }

  /**
   * Create an error toast
   *
   * @example
   * ```ts
   * toast.error('Something went wrong');
   * toast.error('Failed to save', { description: 'Please try again' });
   * ```
   */
  error = (message: TitleT, data?: ExternalToast): string | number => {
    return this.create({ ...data, message, type: "error" })
  }

  /**
   * Create a success toast
   *
   * @example
   * ```ts
   * toast.success('Operation completed!');
   * toast.success('File uploaded', { description: 'document.pdf saved' });
   * ```
   */
  success = (message: TitleT, data?: ExternalToast): string | number => {
    return this.create({ ...data, message, type: "success" })
  }

  /**
   * Create an info toast
   *
   * @example
   * ```ts
   * toast.info('Did you know?');
   * toast.info('Tip', { description: 'Press Ctrl+S to save' });
   * ```
   */
  info = (message: TitleT, data?: ExternalToast): string | number => {
    return this.create({ ...data, message, type: "info" })
  }

  /**
   * Create a warning toast
   *
   * @example
   * ```ts
   * toast.warning('Be careful!');
   * toast.warning('Unsaved changes', { description: 'Your work may be lost' });
   * ```
   */
  warning = (message: TitleT, data?: ExternalToast): string | number => {
    return this.create({ ...data, message, type: "warning" })
  }

  /**
   * Create a loading toast with an animated spinner
   *
   * @example
   * ```ts
   * // Basic loading toast
   * const id = toast.loading('Processing...');
   *
   * // Update to success when done
   * toast.success('Done!', { id });
   *
   * // Or update to error on failure
   * toast.error('Failed', { id });
   * ```
   */
  loading = (message: TitleT, data?: ExternalToast): string | number => {
    return this.create({ ...data, message, type: "loading" })
  }

  /**
   * Create a promise toast that auto-updates based on promise state
   *
   * Automatically shows loading, success, or error states based on the promise result.
   * Handles HTTP Response objects with non-2xx status codes as errors.
   *
   * @example
   * ```ts
   * // Basic promise toast
   * toast.promise(fetch('/api/data'), {
   *   loading: 'Fetching data...',
   *   success: 'Data loaded!',
   *   error: 'Failed to load data',
   * });
   *
   * // With dynamic messages based on result
   * toast.promise(saveUser(data), {
   *   loading: 'Saving user...',
   *   success: (user) => `${user.name} saved!`,
   *   error: (err) => `Error: ${err.message}`,
   * });
   *
   * // Access the underlying promise result
   * const result = toast.promise(fetchData(), { ... });
   * const data = await result.unwrap();
   * ```
   */
  promise = <ToastData>(
    promise: PromiseT<ToastData>,
    data?: PromiseData<ToastData>
  ): { unwrap: () => Promise<ToastData> } | undefined => {
    if (!data) {
      return undefined
    }

    let id: string | number | undefined

    if (data.loading !== undefined) {
      id = this.create({
        ...data,
        type: "loading",
        message: data.loading,
        description: typeof data.description !== "function" ? data.description : undefined,
      })
    }

    const p = promise instanceof Function ? promise() : promise

    let shouldDismiss = id !== undefined
    let result: ["resolve", ToastData] | ["reject", unknown]

    const originalPromise = p
      .then(async (response) => {
        result = ["resolve", response]

        // Handle HTTP error responses
        if (isHttpResponse(response) && !response.ok) {
          shouldDismiss = false

          const promiseData =
            typeof data.error === "function"
              ? await data.error(`HTTP error! status: ${response.status}`)
              : data.error

          const description =
            typeof data.description === "function"
              ? await data.description(
                  `HTTP error! status: ${response.status}` as unknown as ToastData
                )
              : data.description

          const isExtendedResult = typeof promiseData === "object" && promiseData !== null

          const toastSettings: PromiseExtendedResult = isExtendedResult
            ? (promiseData as PromiseExtendedResult)
            : { message: promiseData as string }

          this.create({ id, type: "error", description, ...toastSettings })
        }
        // Handle Error instances
        else if (response instanceof Error) {
          shouldDismiss = false

          const promiseData =
            typeof data.error === "function" ? await data.error(response) : data.error

          const description =
            typeof data.description === "function"
              ? await data.description(response as unknown as ToastData)
              : data.description

          const isExtendedResult = typeof promiseData === "object" && promiseData !== null

          const toastSettings: PromiseExtendedResult = isExtendedResult
            ? (promiseData as PromiseExtendedResult)
            : { message: promiseData as string }

          this.create({ id, type: "error", description, ...toastSettings })
        }
        // Handle success
        else if (data.success !== undefined) {
          shouldDismiss = false

          const promiseData =
            typeof data.success === "function" ? await data.success(response) : data.success

          const description =
            typeof data.description === "function"
              ? await data.description(response)
              : data.description

          const isExtendedResult = typeof promiseData === "object" && promiseData !== null

          const toastSettings: PromiseExtendedResult = isExtendedResult
            ? (promiseData as PromiseExtendedResult)
            : { message: promiseData as string }

          this.create({ id, type: "success", description, ...toastSettings })
        }
      })
      .catch(async (error: unknown) => {
        result = ["reject", error]

        if (data.error !== undefined) {
          shouldDismiss = false

          const promiseData =
            typeof data.error === "function" ? await data.error(error) : data.error

          const description =
            typeof data.description === "function"
              ? await data.description(error as ToastData)
              : data.description

          const isExtendedResult = typeof promiseData === "object" && promiseData !== null

          const toastSettings: PromiseExtendedResult = isExtendedResult
            ? (promiseData as PromiseExtendedResult)
            : { message: promiseData as string }

          this.create({ id, type: "error", description, ...toastSettings })
        }
      })
      .finally(() => {
        if (shouldDismiss) {
          this.dismiss(id)
          id = undefined
        }

        data.finally?.()
      })

    const unwrap = () =>
      new Promise<ToastData>((resolve, reject) =>
        originalPromise
          .then(() => (result[0] === "reject" ? reject(result[1]) : resolve(result[1])))
          .catch(reject)
      )

    if (typeof id !== "string" && typeof id !== "number") {
      return { unwrap }
    }

    return Object.assign(id, { unwrap }) as unknown as {
      unwrap: () => Promise<ToastData>
    }
  }

  getActiveToasts = (): Toast[] => {
    return this._activeToasts
  }
}

/**
 * Global toast state singleton
 */
export const ToastState = new Observer()

/**
 * Basic toast function - delegates to ToastState.message() for consistent behavior
 */
const toastFunction = (message: TitleT, data?: ExternalToast): string | number =>
  ToastState.message(message, data)

/**
 * Get toast history (all toasts ever created, including dismissed)
 *
 * @example
 * ```ts
 * const history = toast.getHistory();
 * console.log(`Total toasts shown: ${history.length}`);
 * ```
 */
const getHistory = () => ToastState.toasts

/**
 * Get currently active (visible) toasts
 *
 * @example
 * ```ts
 * const active = toast.getToasts();
 * console.log(`Currently showing ${active.length} toasts`);
 * ```
 */
const getToasts = () => ToastState.getActiveToasts()

/**
 * The main toast API - a function with methods attached
 *
 * @example
 * ```ts
 * // Basic usage
 * toast('Hello World');
 *
 * // With variants
 * toast.success('Operation completed');
 * toast.error('Something went wrong');
 * toast.warning('Be careful');
 * toast.info('Did you know?');
 * toast.loading('Processing...');
 *
 * // Promise toast
 * toast.promise(fetchData(), {
 *   loading: 'Loading...',
 *   success: 'Data loaded!',
 *   error: 'Failed to load',
 * });
 *
 * // Dismiss
 * const id = toast('Hello');
 * toast.dismiss(id);
 * toast.dismiss(); // dismiss all
 * ```
 */
export const toast = Object.assign(
  toastFunction,
  {
    success: ToastState.success,
    info: ToastState.info,
    warning: ToastState.warning,
    error: ToastState.error,
    message: ToastState.message,
    promise: ToastState.promise,
    dismiss: ToastState.dismiss,
    loading: ToastState.loading,
  },
  { getHistory, getToasts }
)
