import { toArray } from '@ntnyq/utils'
import type { Arrayable } from '@ntnyq/utils'
import type {
  PreloadImageFailure,
  PreloadImagesOptions,
  PreloadImagesSettledResult,
} from './types'

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
    decoding,
    fetchPriority,
    idleTimeout = 2000,
    loadOnIdle = false,
    maxConcurrent = 6,
    onComplete,
    onError,
    onProgress,
    referrerPolicy,
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
      if (decoding !== undefined) {
        image.decoding = decoding
      }
      if (fetchPriority !== undefined) {
        image.fetchPriority = fetchPriority
      }
      if (referrerPolicy !== undefined) {
        image.referrerPolicy = referrerPolicy
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

export async function preloadImagesSettled(
  images: Arrayable<string>,
  options: PreloadImagesOptions = {},
): Promise<PreloadImagesSettledResult> {
  const failed: PreloadImageFailure[] = []
  const loaded = await preloadImages(images, {
    ...options,
    onError(error, url) {
      failed.push({ error, url })
      options.onError?.(error, url)
    },
  })

  return { failed, loaded }
}
