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
 * Preloads browser images and returns only the successfully loaded elements
 *
 * Failed, timed out, and aborted images are omitted without rejecting the
 * returned promise. Successful images retain their input order, including
 * duplicate URLs. Use {@link preloadImagesSettled} to also collect failures.
 *
 * If the signal is already aborted, no requests are started and `onComplete`
 * receives an empty array; `onError` is not called. Aborting during loading
 * preserves completed images and reports unfinished URLs through `onError`.
 *
 * @param images - A single image URL or an array of URLs to load independently
 * @param options - Loading, scheduling, cancellation, and callback options;
 * defaults to an empty object, see {@link PreloadImagesOptions}
 * @returns A promise resolving to successful images in input order, or an empty
 * array when the input is empty or no images load successfully
 * @throws {unknown} Rejects with the original exception if `onComplete` throws
 * or idle callback scheduling throws. Exceptions from `onProgress` or `onError`
 * during image events, timeouts, or abort events propagate from those callbacks
 * after the image has settled; they do not reject the returned promise.
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
      const handlers: { abortImage?: () => void } = {}
      function clearTimer() {
        if (timer !== undefined) {
          clearTimeout(timer)
        }
      }

      function cleanup() {
        clearTimer()
        if (handlers.abortImage !== undefined) {
          signal?.removeEventListener('abort', handlers.abortImage)
        }
        image.onload = null
        image.onerror = null
      }

      function rejectImage(error: Error) {
        if (isSettled) {
          return
        }
        isSettled = true
        cleanup()
        // Clearing the source stops the browser request before freeing its slot.
        image.src = ''
        // Settle before user callbacks so thrown exceptions cannot stall loading.
        reject(error)
        onError?.(error, url)
      }

      handlers.abortImage = () => {
        rejectImage(createAbortError(url))
      }
      signal?.addEventListener('abort', handlers.abortImage, { once: true })

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
        resolve(image)
        updateProgress()
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
      signal?.aborted ||
      typeof window === 'undefined' ||
      window.requestIdleCallback === undefined
    ) {
      return task()
    }

    return new Promise((resolve, reject) => {
      let isStarted = false
      const handlers: { abortIdle?: () => void } = {}

      function startTask() {
        if (isStarted) {
          return
        }
        isStarted = true
        if (handlers.abortIdle !== undefined) {
          signal?.removeEventListener('abort', handlers.abortIdle)
        }
        task().then(resolve).catch(reject)
      }

      const idleHandle = window.requestIdleCallback(startTask, {
        timeout: idleTimeout,
      })

      handlers.abortIdle = () => {
        window.cancelIdleCallback?.(idleHandle)
        // loadImage reports aborted URLs without starting their image requests.
        startTask()
      }

      signal?.addEventListener('abort', handlers.abortIdle, { once: true })
    })
  }

  async function loadParallel(): Promise<HTMLImageElement[]> {
    const results: (HTMLImageElement | undefined)[] = []
    let nextIndex = 0

    async function loadNext() {
      while (nextIndex < urls.length) {
        // Claim the URL before awaiting so workers never load the same entry.
        const index = nextIndex++
        await loadWithIdle(async () => {
          try {
            results[index] = await loadImage(urls[index])
          } catch {
            // Error has been handled in loadImage via onError callback.
          }
        })
      }
    }

    const workerCount = Math.min(safeMaxConcurrent, urls.length)
    await Promise.all(Array.from({ length: workerCount }, () => loadNext()))
    return results.filter(image => image !== undefined)
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

/**
 * Preloads browser images and collects successful elements and reported failures
 *
 * Uses the loading options and callbacks of {@link preloadImages}. Successful
 * images retain their input order; failures follow the order in which they are
 * reported. Load errors, timeouts, and cancellation are collected without
 * rejecting the returned promise.
 *
 * If the signal is already aborted, every URL is recorded as an `AbortError`
 * failure and passed to `onError`, then `onComplete` receives an empty array.
 *
 * @param images - A single image URL or an array of URLs to load independently
 * @param options - Loading, scheduling, cancellation, and callback options;
 * defaults to an empty object, see {@link PreloadImagesOptions}
 * @returns A promise resolving to successful images and reported failures;
 * both arrays are empty when the input is empty
 * @throws {unknown} Rejects with the original exception if `onComplete` throws,
 * idle callback scheduling throws, or `onError` throws while reporting an already
 * aborted signal. Callback exceptions during active image events, timeouts, or
 * abort events propagate as described in {@link preloadImages}.
 */
export async function preloadImagesSettled(
  images: Arrayable<string>,
  options: PreloadImagesOptions = {},
): Promise<PreloadImagesSettledResult> {
  const urls = toArray(images)
  const failed: PreloadImageFailure[] = []

  if (options.signal?.aborted) {
    for (const url of urls) {
      const error = createAbortError(url)
      failed.push({ error, url })
      options.onError?.(error, url)
    }

    options.onComplete?.([])
    return { failed, loaded: [] }
  }

  const loaded = await preloadImages(images, {
    ...options,
    onError(error, url) {
      failed.push({ error, url })
      options.onError?.(error, url)
    },
  })

  return { failed, loaded }
}
