import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { preloadImages, preloadImagesSettled } from '../src'

describe('image loading lifecycle', () => {
  const images: ControlledImage[] = []
  const activeImages = new Set<ControlledImage>()
  // oxlint-disable-next-line init-declarations
  let peakActiveCount: number

  class ControlledImage {
    public onerror: (() => void) | null = null
    public onload: (() => void) | null = null
    private source = ''

    public constructor() {
      images.push(this)
    }

    public get src() {
      return this.source
    }

    public set src(value: string) {
      this.source = value
      if (value) {
        activeImages.add(this)
        peakActiveCount = Math.max(peakActiveCount, activeImages.size)
      } else {
        activeImages.delete(this)
      }
    }

    public succeed() {
      activeImages.delete(this)
      this.onload?.()
    }

    public fail() {
      activeImages.delete(this)
      this.onerror?.()
    }
  }

  beforeEach(() => {
    images.length = 0
    activeImages.clear()
    peakActiveCount = 0
    vi.useFakeTimers()
    vi.stubGlobal('Image', ControlledImage)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each(['parallel', 'sequential'] as const)(
    'clears timed out requests before starting more images with %s loading',
    async strategy => {
      const loading = preloadImagesSettled(['a.jpg', 'b.jpg', 'c.jpg'], {
        maxConcurrent: 1,
        strategy,
        timeout: 100,
      })

      await vi.advanceTimersByTimeAsync(300)
      const result = await loading

      expect(result).toStrictEqual({
        loaded: [],
        failed: ['a.jpg', 'b.jpg', 'c.jpg'].map(url => ({
          error: expect.any(Error),
          url,
        })),
      })
      expect(images.map(image => image.src)).toStrictEqual(['', '', ''])
      expect(peakActiveCount).toBe(1)
      expect(activeImages.size).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('clears active requests on abort and preserves completed images', async () => {
    const controller = new AbortController()
    const onError = vi.fn()
    const onProgress = vi.fn()
    const onComplete = vi.fn()
    const loading = preloadImagesSettled(
      ['loaded.jpg', 'pending.jpg', 'next.jpg', 'queued.jpg'],
      {
        maxConcurrent: 2,
        onComplete,
        onError,
        onProgress,
        signal: controller.signal,
        timeout: 100,
      },
    )
    const lateLoad = images[1].onload
    const lateError = images[1].onerror

    images[0].succeed()
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    const result = await loading
    lateLoad?.()
    lateError?.()

    expect(result).toStrictEqual({
      loaded: [images[0]],
      failed: ['pending.jpg', 'next.jpg', 'queued.jpg'].map(url => ({
        error: expect.objectContaining({ name: 'AbortError' }),
        url,
      })),
    })
    expect({
      sources: images.map(image => image.src),
      activeCount: activeImages.size,
      timerCount: vi.getTimerCount(),
    }).toStrictEqual({
      sources: ['loaded.jpg', '', ''],
      activeCount: 0,
      timerCount: 0,
    })
    expect(onError).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(1, 4)
    expect(onComplete).toHaveBeenCalledExactlyOnceWith([images[0]])
  })

  it('refills free slots after success or failure and returns images in input order', async () => {
    const loading = preloadImagesSettled(
      ['slow.jpg', 'fast.jpg', 'error.jpg', 'fast.jpg'],
      { maxConcurrent: 2 },
    )

    expect(images).toHaveLength(2)
    images[1].succeed()
    await vi.advanceTimersByTimeAsync(0)
    expect(images.map(image => image.src)).toStrictEqual([
      'slow.jpg',
      'fast.jpg',
      'error.jpg',
    ])

    images[2].fail()
    await vi.advanceTimersByTimeAsync(0)
    expect(images).toHaveLength(4)
    images[3].succeed()
    images[0].succeed()
    const result = await loading

    expect(result).toStrictEqual({
      loaded: [images[0], images[1], images[3]],
      failed: [{ error: expect.any(Error), url: 'error.jpg' }],
    })
    expect({ peakActiveCount, activeCount: activeImages.size }).toStrictEqual({
      peakActiveCount: 2,
      activeCount: 0,
    })
  })

  it('waits for idle before refilling slots and cancels queued idle work', async () => {
    const callbacks: IdleRequestCallback[] = []
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    const cancelIdleCallback = vi.fn()
    const deadline: IdleDeadline = {
      didTimeout: false,
      timeRemaining: () => 50,
    }
    vi.stubGlobal('window', { cancelIdleCallback, requestIdleCallback })
    const controller = new AbortController()
    const loading = preloadImagesSettled(['slow.jpg', 'fast.jpg', 'next.jpg'], {
      loadOnIdle: true,
      maxConcurrent: 2,
      signal: controller.signal,
    })

    expect({
      imageCount: images.length,
      idleCount: requestIdleCallback.mock.calls.length,
    }).toStrictEqual({ imageCount: 0, idleCount: 2 })
    callbacks[0](deadline)
    callbacks[1](deadline)
    images[1].succeed()
    await vi.advanceTimersByTimeAsync(0)

    expect({
      imageCount: images.length,
      idleCount: requestIdleCallback.mock.calls.length,
    }).toStrictEqual({ imageCount: 2, idleCount: 3 })
    controller.abort()
    const result = await loading
    callbacks[2](deadline)

    expect(cancelIdleCallback).toHaveBeenCalledExactlyOnceWith(3)
    expect(result).toStrictEqual({
      loaded: [images[1]],
      failed: ['slow.jpg', 'next.jpg'].map(url => ({
        error: expect.objectContaining({ name: 'AbortError' }),
        url,
      })),
    })
    expect({
      imageCount: images.length,
      source: images[0].src,
      activeCount: activeImages.size,
    }).toStrictEqual({ imageCount: 2, source: '', activeCount: 0 })
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
