/**
 * Controls image requests, scheduling, and lifecycle callbacks for
 * {@link preloadImages} and {@link preloadImagesSettled}
 */
export interface PreloadImagesOptions {
  /**
   * Whether to set each image's `crossOrigin` attribute before assigning its URL
   *
   * @default false
   */
  crossOrigin?: boolean

  /**
   * Cross-origin mode assigned when {@link PreloadImagesOptions.crossOrigin}
   * is enabled; otherwise the image's attribute is left unchanged
   *
   * @default `anonymous`
   */
  crossOriginAttribute?: 'anonymous' | 'use-credentials'

  /**
   * Native decoding hint assigned before the image URL
   * When omitted, the image's existing decoding hint is left unchanged
   * Loading completes on the load event without explicitly calling `decode()`
   */
  decoding?: HTMLImageElement['decoding']

  /**
   * Native fetch priority hint assigned before the image URL
   * When omitted, the image's existing fetch priority is left unchanged
   */
  fetchPriority?: HTMLImageElement['fetchPriority']

  /**
   * Timeout in milliseconds passed to each `requestIdleCallback` call
   * Only used when `loadOnIdle` is enabled and the idle callback API is available
   * This limits the idle wait separately from the image loading `timeout`
   *
   * @default 2000
   */
  idleTimeout?: number

  /**
   * Whether each image waits for `requestIdleCallback` before starting
   * Falls back to immediate scheduling when the API or `window` is unavailable
   * Waiting images occupy concurrency slots; cancellation ends queued idle waits
   *
   * @default false
   */
  loadOnIdle?: boolean

  /**
   * Maximum number of concurrent workers when `strategy` is `parallel`
   * Each free slot starts the next queued image, including any required idle wait
   * Finite positive values are rounded down with a minimum of one; all other
   * values use one worker. Ignored when `strategy` is `sequential`.
   *
   * @default 6
   */
  maxConcurrent?: number

  /**
   * Signal that cancels active requests and queued idle waits
   * Completed images remain in the result; unfinished URLs report `AbortError`
   * failures without starting further requests. If already aborted on entry,
   * `preloadImages` returns no images without calling `onError`, whereas
   * `preloadImagesSettled` records and reports a failure for every URL.
   */
  signal?: AbortSignal

  /**
   * Whether to use a pool of up to `maxConcurrent` workers or load one image
   * at a time. Both strategies return successful images in input order.
   *
   * @default `parallel`
   */
  strategy?: 'parallel' | 'sequential'

  /**
   * Per-image loading timeout in milliseconds, starting after any idle wait
   * Only finite positive values enable a timeout; zero, negative, and non-finite
   * values disable it. Timed out requests clear their source and report an error.
   *
   * @default 0
   */
  timeout?: number

  /**
   * Called once after all URLs have been processed, including failures and aborts
   * Also called with an empty array for empty input or an already aborted signal
   *
   * @param loadedImages - Successfully loaded elements in input order
   * @returns Nothing; any returned value is ignored and promises are not awaited
   * @throws {unknown} Any synchronous exception rejects the preloading promise
   * with the original exception
   */
  onComplete?: (loadedImages: HTMLImageElement[]) => void

  /**
   * Called for each reported load error, timeout, or cancellation
   * Active images settle before this callback runs. For an already aborted
   * signal, only `preloadImagesSettled` invokes it, once for each input URL.
   *
   * @param error - Load or timeout error, or an error named `AbortError` on cancel
   * @param url - Original input URL associated with the failure
   * @returns Nothing; any returned value is ignored and promises are not awaited
   * @throws {unknown} Synchronous exceptions during image, timeout, or abort events
   * propagate from those events without preventing image settlement. Exceptions
   * while `preloadImagesSettled` reports an already aborted signal reject its
   * returned promise.
   */
  onError?: (error: Error, url: string) => void

  /**
   * Called after each successfully loaded image, in completion order
   * Failed, timed out, and aborted images do not trigger progress updates
   *
   * @param loadedCount - Number of successful images so far, including this image
   * @param totalCount - Number of input URLs, including failures and duplicates
   * @returns Nothing; any returned value is ignored and promises are not awaited
   * @throws {unknown} Synchronous exceptions propagate from the image load event
   * after the image has settled and do not reject the preloading promise
   */
  onProgress?: (loadedCount: number, totalCount: number) => void

  /**
   * Native referrer policy assigned before the image URL
   * When omitted, the image's existing referrer policy is left unchanged
   */
  referrerPolicy?: HTMLImageElement['referrerPolicy']
}

/**
 * A failure reported for one input URL by {@link preloadImagesSettled}
 */
export interface PreloadImageFailure {
  /**
   * Error describing a failed load, timeout, or cancellation
   * Cancellation errors have the name `AbortError`; load and timeout errors
   * include the image URL in their message
   */
  error: Error

  /**
   * Original input URL associated with this failure
   * Duplicate URLs can produce separate failure entries
   */
  url: string
}

/**
 * Successful images and reported failures collected by {@link preloadImagesSettled}
 */
export interface PreloadImagesSettledResult {
  /**
   * Load errors, timeouts, and cancellations in the order they were reported
   * Empty when no failures were reported; parallel loads can report failures
   * in a different order from the input URLs
   */
  failed: PreloadImageFailure[]

  /**
   * Successfully loaded image elements in input order, preserving duplicate URLs
   * Excludes failed, timed out, and aborted entries; empty when none succeed
   */
  loaded: HTMLImageElement[]
}
