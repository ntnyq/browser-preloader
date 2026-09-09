import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { preloadImages, preloadImagesSettled } from '../src'

describe('image loading lifecycle', () => {
  const images: ControlledImage[] = []

  class ControlledImage {
    public onerror: (() => void) | null = null
    public onload: (() => void) | null = null
    public src = ''

    public constructor() {
      images.push(this)
    }
  }

  beforeEach(() => {
    images.length = 0
    vi.useFakeTimers()
    vi.stubGlobal('Image', ControlledImage)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe.each([
    { name: 'preloadImages', preload: preloadImages },
    { name: 'preloadImagesSettled', preload: preloadImagesSettled },
  ])('$name callback exceptions', ({ preload }) => {
    it.each(['parallel', 'sequential'] as const)(
      'settles successful images when onProgress throws with %s loading',
      async strategy => {
        const callbackError = new Error('Progress callback failed')
        const onComplete = vi.fn()
        const onSettled = vi.fn()
        const loading = preload(['first.jpg', 'second.jpg'], {
          onComplete,
          onProgress() {
            throw callbackError
          },
          strategy,
          timeout: 100,
        }).then(onSettled)

        expect(() => images[0].onload?.()).toThrow(callbackError)
        await vi.advanceTimersByTimeAsync(0)
        expect(() => images[1].onload?.()).toThrow(callbackError)
        await vi.advanceTimersByTimeAsync(100)

        expect(onComplete).toHaveBeenCalledExactlyOnceWith(images)
        expect(onSettled).toHaveBeenCalledOnce()
        expect(vi.getTimerCount()).toBe(0)
        await loading
      },
    )

    it.each(['parallel', 'sequential'] as const)(
      'settles failed images when onError throws with %s loading',
      async strategy => {
        const callbackError = new Error('Error callback failed')
        const onComplete = vi.fn()
        const onSettled = vi.fn()
        const loading = preload(['error.jpg', 'success.jpg'], {
          onComplete,
          onError() {
            throw callbackError
          },
          strategy,
          timeout: 100,
        }).then(onSettled)

        expect(() => images[0].onerror?.()).toThrow(callbackError)
        await vi.advanceTimersByTimeAsync(0)
        images[1].onload?.()
        await vi.advanceTimersByTimeAsync(100)

        expect(onComplete).toHaveBeenCalledExactlyOnceWith([images[1]])
        expect(onSettled).toHaveBeenCalledOnce()
        expect(vi.getTimerCount()).toBe(0)
        await loading
      },
    )

    it('settles timed out images when onError throws', async () => {
      const callbackError = new Error('Timeout callback failed')
      const onSettled = vi.fn()
      const loading = preload('timeout.jpg', {
        onError() {
          throw callbackError
        },
        timeout: 100,
      }).then(onSettled)

      expect(() => vi.advanceTimersByTime(100)).toThrow(callbackError)
      await vi.advanceTimersByTimeAsync(0)

      expect(onSettled).toHaveBeenCalledOnce()
      expect(images[0].onload).toBeNull()
      expect(images[0].onerror).toBeNull()
      expect(vi.getTimerCount()).toBe(0)
      await loading
    })
  })

  describe.each(['parallel', 'sequential'] as const)(
    '%s idle cancellation',
    strategy => {
      it('cancels an idle wait and reports every unstarted URL immediately', async () => {
        const requestIdleCallback = vi.fn(
          (_callback: IdleRequestCallback) => 42,
        )
        const cancelIdleCallback = vi.fn()
        vi.stubGlobal('window', { cancelIdleCallback, requestIdleCallback })
        const controller = new AbortController()
        const onError = vi.fn()
        const onSettled = vi.fn()
        const loading = preloadImagesSettled(['a.jpg', 'b.jpg', 'c.jpg'], {
          loadOnIdle: true,
          maxConcurrent: 1,
          onError,
          signal: controller.signal,
          strategy,
        }).then(onSettled)

        controller.abort()
        await vi.advanceTimersByTimeAsync(0)

        expect(cancelIdleCallback).toHaveBeenCalledExactlyOnceWith(42)
        expect(requestIdleCallback).toHaveBeenCalledOnce()
        expect(images).toHaveLength(0)
        expect(onSettled).toHaveBeenCalledExactlyOnceWith({
          failed: ['a.jpg', 'b.jpg', 'c.jpg'].map(url => ({
            error: expect.objectContaining({ name: 'AbortError' }),
            url,
          })),
          loaded: [],
        })

        // Even a late callback from an imperfect idle polyfill must not run twice.
        requestIdleCallback.mock.calls[0][0]({
          didTimeout: false,
          timeRemaining: () => 50,
        })
        await vi.advanceTimersByTimeAsync(0)
        expect(onError).toHaveBeenCalledTimes(3)
        await loading
      })

      it('preserves completed images when the next idle wait is aborted', async () => {
        const requestIdleCallback = vi.fn(
          (_callback: IdleRequestCallback) => 42,
        )
        const cancelIdleCallback = vi.fn()
        vi.stubGlobal('window', { cancelIdleCallback, requestIdleCallback })
        const controller = new AbortController()
        const onSettled = vi.fn()
        const loading = preloadImagesSettled(['first.jpg', 'second.jpg'], {
          loadOnIdle: true,
          maxConcurrent: 1,
          signal: controller.signal,
          strategy,
        }).then(onSettled)

        requestIdleCallback.mock.calls[0][0]({
          didTimeout: false,
          timeRemaining: () => 50,
        })
        images[0].onload?.()
        await vi.advanceTimersByTimeAsync(0)
        expect(requestIdleCallback).toHaveBeenCalledTimes(2)

        controller.abort()
        await vi.advanceTimersByTimeAsync(0)

        expect(cancelIdleCallback).toHaveBeenCalledExactlyOnceWith(42)
        expect(requestIdleCallback).toHaveBeenCalledTimes(2)
        expect(images).toHaveLength(1)
        expect(onSettled).toHaveBeenCalledExactlyOnceWith({
          failed: [
            {
              error: expect.objectContaining({ name: 'AbortError' }),
              url: 'second.jpg',
            },
          ],
          loaded: images,
        })
        await loading
      })
    },
  )
})
