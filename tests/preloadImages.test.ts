import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { preloadImages } from '../src'

describe('preloadImages', () => {
  let originalImage: typeof Image

  beforeEach(() => {
    originalImage = global.Image

    global.Image = class MockImage {
      constructor() {
        setTimeout(() => {
          if (this.src.includes('valid')) {
            this.onload?.()
          }
          if (this.src.includes('error')) {
            this.onerror?.()
          } else if (this.src.includes('timeout')) {
            // nothing
          }
        }, 10)
      }
      crossOrigin: string = ''
      onerror: (() => void) | null = null
      onload: (() => void) | null = null
      src: string = ''
    } as unknown as typeof Image

    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.Image = originalImage
  })

  it('single image', async () => {
    const loaded = await preloadImages('valid.jpg')
    expect(loaded).toHaveLength(1)
    expect(loaded[0].src).toContain('valid.jpg')
  })

  it('multiple images', async () => {
    const loaded = await preloadImages([
      'valid1.jpg',
      'valid2,jpg',
      'valid3.jpg',
    ])
    expect(loaded).toHaveLength(3)
  })

  it('options - onProgress', async () => {
    const onProgress = vi.fn()

    await preloadImages(['valid1.jpg', 'valid2,jpg', 'valid3.jpg'], {
      onProgress,
    })

    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenCalledWith(1, 3)
    expect(onProgress).toHaveBeenCalledWith(2, 3)
    expect(onProgress).toHaveBeenCalledWith(3, 3)
  })

  it('options - onError', async () => {
    const onError = vi.fn()
    const loaded = await preloadImages(['valid.jpg', 'error.jpg'], { onError })

    expect(loaded).toHaveLength(1)
    expect(loaded[0].src).toContain('valid.jpg')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][1]).toContain('error.jpg')
  })

  it('options - timeout', async () => {
    const onError = vi.fn()
    const images = await preloadImages(['timeout.jpg'], {
      onError,
      timeout: 20,
    })

    expect(images).toHaveLength(0)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].message).toContain('Image load timeout')
  })

  it('options - crossOrigin', async () => {
    const images = await preloadImages('valid.jpg', {
      crossOrigin: true,
      crossOriginAttribute: 'anonymous',
    })

    expect(images[0].crossOrigin).toBe('anonymous')
  })

  it('options - maxConcurrent', async () => {
    const onProgress = vi.fn()
    const startTime = Date.now()

    await preloadImages(
      [
        'valid1.jpg',
        'valid2.jpg',
        'valid3.jpg',
        'valid4.jpg',
        'valid5.jpg',
        'valid6.jpg',
      ],
      {
        maxConcurrent: 2,
        onProgress,
        strategy: 'parallel',
      },
    )

    const duration = Date.now() - startTime
    expect(duration).toBeGreaterThan(10 * 3)
  })

  it('options - strategy(sequential)', async () => {
    const loaded = await preloadImages(
      ['valid1.jpg', 'valid2.jpg', 'valid3.jpg'],
      {
        strategy: 'sequential',
      },
    )

    expect(loaded.map(v => v.src)).toEqual([
      'valid1.jpg',
      'valid2.jpg',
      'valid3.jpg',
    ])
  })

  it('partial success', async () => {
    const images = await preloadImages([
      'valid1.jpg',
      'error.jpg',
      'valid2.jpg',
    ])
    expect(images).toHaveLength(2)
    expect(images[0].src).toContain('valid1.jpg')
    expect(images[1].src).toContain('valid2.jpg')
  })

  it('options - onComplete', async () => {
    const onComplete = vi.fn()
    await preloadImages(['valid1.jpg', 'valid2.jpg'], { onComplete })

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete.mock.calls[0][0]).toHaveLength(2)
  })
})
