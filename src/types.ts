export interface PreloadImagesOptions {
  /**
   * Whether to set the cross-origin attribute on the image
   *
   * @default false
   */
  crossOrigin?: boolean

  /**
   * The cross-origin attribute to use for the image
   *
   * @default `anonymous`
   */
  crossOriginAttribute?: 'anonymous' | 'use-credentials'

  /**
   * Image decoding hint
   */
  decoding?: HTMLImageElement['decoding']

  /**
   * Image fetch priority hint
   */
  fetchPriority?: HTMLImageElement['fetchPriority']

  /**
   * Timeout for requestIdleCallback in milliseconds
   * Only effective when loadOnIdle is true
   *
   * @default 2000
   */
  idleTimeout?: number

  /**
   * Whether to load images only when browser is idle
   * Uses requestIdleCallback API if available
   *
   * @default false
   */
  loadOnIdle?: boolean

  /**
   * Maximum number of concurrent image loads
   *
   * @default 6
   */
  maxConcurrent?: number

  /**
   * Signal for canceling pending image loads
   */
  signal?: AbortSignal

  /**
   * The strategy to load images
   *
   * @default `parallel`
   */
  strategy?: 'parallel' | 'sequential'

  /**
   * Timeout for image loading in milliseconds
   *
   * @default 0
   */
  timeout?: number

  /**
   * Callback function to be called when all images are loaded
   * @param loadedImages - Array of loaded HTMLImageElement objects
   */
  onComplete?: (loadedImages: HTMLImageElement[]) => void

  /**
   * Callback function to be called when an error occurs
   * @param error - Error object
   * @param url - The URL of the image that failed to load
   */
  onError?: (error: Error, url: string) => void

  /**
   * Callback function to be called when the progress of image loading changes
   *
   * @param loadedCount - Number of images loaded so far
   * @param totalCount - Total number of images to be loaded
   */
  onProgress?: (loadedCount: number, totalCount: number) => void

  /**
   * Image referrer policy
   */
  referrerPolicy?: HTMLImageElement['referrerPolicy']
}

export interface PreloadImageFailure {
  error: Error
  url: string
}

export interface PreloadImagesSettledResult {
  failed: PreloadImageFailure[]
  loaded: HTMLImageElement[]
}
