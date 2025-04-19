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
   * Maximum number of concurrent image loads
   *
   * @default 6
   */
  maxConcurrent?: number

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
    maxConcurrent = 6,
    onComplete,
    onError,
    onProgress,
    strategy = 'parallel',
    timeout = 0,
  } = options

  let loadedCount = 0
  const loadedImages: HTMLImageElement[] = []

  function updateProgress() {
    onProgress?.(loadedCount, urls.length)
  }

  async function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image()

      if (crossOrigin) {
        image.crossOrigin = crossOriginAttribute
      }

      let timer: ReturnType<typeof setTimeout>

      if (timeout > 0) {
        timer = setTimeout(() => {
          const error = new Error(
            `Image load timeout after ${timeout}ms: ${url}`,
          )
          onError?.(error, url)
          reject(error)
        }, timeout)
      }

      image.onload = () => {
        clearTimeout(timer)
        loadedCount++
        loadedImages.push(image)
        updateProgress()
        resolve(image)
      }

      image.onerror = () => {
        clearTimeout(timer)
        const error = new Error(`Failed to load image: ${url}`)
        onError?.(error, url)
        reject(error)
      }

      image.src = url
    })
  }

  async function loadParallel(): Promise<HTMLImageElement[]> {
    const batches: string[][] = []
    const results: HTMLImageElement[] = []

    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent)
      batches.push(batch)
    }

    for (const batch of batches) {
      const batchPromises = batch.map(url => loadImage(url).catch(() => null))
      const batchResults = await Promise.all(batchPromises)
      results.push(...(batchResults.filter(Boolean) as HTMLImageElement[]))
    }

    return results
  }

  async function loadSequential(): Promise<HTMLImageElement[]> {
    const results: HTMLImageElement[] = []

    for (const url of urls) {
      try {
        const image = await loadImage(url)
        results.push(image)
      } catch {
        // image has handled in loadImage
      }
    }
    return results
  }

  try {
    const resolvedImages =
      strategy === 'parallel' ? await loadParallel() : await loadSequential()
    onComplete?.(resolvedImages)
    return resolvedImages
  } catch {
    onComplete?.(loadedImages)
    return loadedImages
  }
}
