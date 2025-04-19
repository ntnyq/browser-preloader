# browser-preloader

[![CI](https://github.com/ntnyq/browser-preloader/workflows/CI/badge.svg)](https://github.com/ntnyq/browser-preloader/actions)
[![NPM VERSION](https://img.shields.io/npm/v/browser-preloader.svg)](https://www.npmjs.com/package/browser-preloader)
[![NPM DOWNLOADS](https://img.shields.io/npm/dy/browser-preloader.svg)](https://www.npmjs.com/package/browser-preloader)
[![LICENSE](https://img.shields.io/github/license/ntnyq/browser-preloader.svg)](https://github.com/ntnyq/browser-preloader/blob/main/LICENSE)

Preload resources in browser, e.g: images.

## Install

```shell
npm install browser-preloader
```

```shell
yarn add browser-preloader
```

```shell
pnpm add browser-preloader
```

## Usage

```ts
import { preloadImages } from 'browser-preloader'

try {
  const loadedImages = await preloadImages(['foo.jpg', 'bar.png'])
  console.log(`Loaded ${loadedImages.length} images`)
} catch (err) {
  console.log(err)
}

preloadImages(['foo.jpg', 'bar.png'], {
  timeout: 5000,
  onProgress(loaded, total) {
    console.log(`Progress: ${loaded}/${total}`)
  },
  onComplete(images) {
    console.log(`Successful loaded: ${images.length}`)
  },
  onError(err, url) {
    console.log(`Image ${url} failed to load`, err)
  },
})
```

## API

### preloadImages

- **Type**: `(images: string | string[], options: PreloadImagesOptions = {}) => Promise<HTMLImageElement[]>`

Preload images in browser.

#### Parameters

##### images

- **Type**: `string | string[]`

Array of image URLs or a single image URL.

##### options

- **Type**: `PreloadImagesOptions`
- **Required**: `false`

Options for preloading images, see `PreloadImagesOptions` in [Interfaces](#interfaces).

## Interfaces

```ts
/**
 * Options for the {@link preloadImages} function
 */
export interface PreloadImagesOptions {
  /**
   * Whether to set the cross-origin attribute on the image
   *
   * @default false
   */
  crossOrigin?: string

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
```

## License

[MIT](./LICENSE) License © 2025-PRESENT [ntnyq](https://github.com/ntnyq)
