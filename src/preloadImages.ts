import { toArray } from '@ntnyq/utils'
import type { Arrayable } from '@ntnyq/utils'

/**
 * Options for the {@link preloadImages} function
 */
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
}

function createAbortError(url: string): Error {
  const error = new Error(`Image load aborted: ${url}`)
  error.name = 'AbortError'
  return error
}

/**
 * Preload images in browser
 * @param images - Array of image URLs or a single image URL
 * @param options - Options for preloading images, see {@link PreloadImagesOptions}
 * @returns - Promise that resolves to an array of loaded HTMLImageElement objects
 */
export async function preloadImages(
  images: Arrayable<string>,
  options: PreloadImagesOptions = {},
): Promise<HTMLImageElement[]> {
  const urls = toArray(images)
  const {
    crossOrigin = false,
    crossOriginAttribute = 'anonymous',
    idleTimeout = 2000,
    loadOnIdle = false,
    maxConcurrent = 6,
    onComplete,
    onError,
    onProgress,
    signal,
    strategy = 'parallel',
    timeout = 0,
  } = options
  const safeMaxConcurrent =
    Number.isFinite(maxConcurrent) && maxConcurrent > 0
      ? Math.max(1, Math.floor(maxConcurrent))
      : 1
  const safeTimeout = Number.isFinite(timeout) && timeout > 0 ? timeout : 0

  let loadedCount = 0

  if (signal?.aborted) {
    onComplete?.([])
    return []
  }

  function updateProgress() {
    onProgress?.(loadedCount, urls.length)
  }

  async function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        const error = createAbortError(url)
        onError?.(error, url)
        reject(error)
        return
      }

      const image = new Image()
      let isSettled = false

      if (crossOrigin) {
        image.crossOrigin = crossOriginAttribute
      }

      // oxlint-disable-next-line init-declarations
      let timer: ReturnType<typeof setTimeout> | undefined

      function clearTimer() {
        if (timer !== undefined) {
          clearTimeout(timer)
        }
      }

      function cleanup() {
        clearTimer()
        image.onload = null
        image.onerror = null
      }

      function rejectImage(error: Error) {
        if (isSettled) {
          return
        }
        isSettled = true
        cleanup()
        onError?.(error, url)
        reject(error)
      }

      signal?.addEventListener(
        'abort',
        () => {
          rejectImage(createAbortError(url))
        },
        { once: true },
      )

      if (safeTimeout > 0) {
        timer = setTimeout(() => {
          const error = new Error(
            `Image load timeout after ${safeTimeout}ms: ${url}`,
          )
          rejectImage(error)
        }, safeTimeout)
      }

      image.onload = () => {
        if (isSettled) {
          return
        }
        isSettled = true
        cleanup()
        loadedCount++
        updateProgress()
        resolve(image)
      }

      image.onerror = () => {
        const error = new Error(`Failed to load image: ${url}`)
        rejectImage(error)
      }

      image.src = url
    })
  }

  async function loadWithIdle<T>(task: () => Promise<T>): Promise<T> {
    if (
      !loadOnIdle ||
      typeof window === 'undefined' ||
      window.requestIdleCallback === undefined
    ) {
      return task()
    }

    return new Promise((resolve, reject) => {
      window.requestIdleCallback(
        () => {
          task().then(resolve).catch(reject)
        },
        { timeout: idleTimeout },
      )
    })
  }

  async function loadParallel(): Promise<HTMLImageElement[]> {
    const batches: string[][] = []
    const results: HTMLImageElement[] = []

    for (let i = 0; i < urls.length; i += safeMaxConcurrent) {
      const batch = urls.slice(i, i + safeMaxConcurrent)
      batches.push(batch)
    }

    for (const batch of batches) {
      const batchResults = await loadWithIdle(async () => {
        const batchPromises = batch.map(url => loadImage(url).catch(() => null))
        return Promise.all(batchPromises)
      })
      results.push(...(batchResults.filter(Boolean) as HTMLImageElement[]))
    }

    return results
  }

  async function loadSequential(): Promise<HTMLImageElement[]> {
    const results: HTMLImageElement[] = []

    for (const url of urls) {
      await loadWithIdle(async () => {
        try {
          const image = await loadImage(url)
          results.push(image)
        } catch {
          // Error has been handled in loadImage via onError callback
        }
      })
    }
    return results
  }

  const resolvedImages =
    strategy === 'parallel' ? await loadParallel() : await loadSequential()
  onComplete?.(resolvedImages)
  return resolvedImages
}
