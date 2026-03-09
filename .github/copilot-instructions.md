# Project Guidelines

## Code Style

- Use TypeScript ESM and preserve strict typing (`tsconfig.json` has `strict: true` and bundler module resolution).
- Keep public exports in `src/index.ts`; implementation details belong in `src/preloadImages.ts`.
- Follow existing callback and option naming in `PreloadImagesOptions`; avoid renaming public API fields unless explicitly requested.
- Use the existing toolchain for quality checks: `oxlint` for linting and `oxfmt` for formatting (not ESLint/Prettier).

## Architecture

- This package is a small browser-focused library with a single public API: `preloadImages`.
- Entry point: `src/index.ts` re-exports implementation.
- Core logic: `src/preloadImages.ts` handles batching (`maxConcurrent`), strategy (`parallel`/`sequential`), idle scheduling, timeout behavior, and lifecycle callbacks.
- Build output targets browser ESM via `tsdown.config.ts` (`platform: browser`, `entry: ['src/index.ts']`).

## Build And Test

- Install deps: `pnpm install`
- Build: `pnpm build`
- Dev watch build: `pnpm dev`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Lint: `pnpm lint`
- Format: `pnpm format`
- Pre-release gate: `pnpm run release:check`

## Conventions

- Maintain partial-success behavior: failed image loads should not reject the full preload operation; they trigger `onError` and return successfully loaded images.
- Keep `onProgress` semantics as loaded-count updates per successfully loaded image.
- Preserve `loadOnIdle` fallback behavior when `requestIdleCallback` is unavailable.
- Keep tests in `tests/preloadImages.test.ts` synchronized with API behavior, especially for timeout, concurrency batching, and callback contracts.

## Pitfalls

- Runtime is browser-oriented (`Image`, `window`, `requestIdleCallback`); avoid introducing Node-only runtime assumptions in library code.
- Tests rely on mocked browser globals in Vitest; ensure global mocks are restored in `afterEach`.
- Package manager is pnpm (`packageManager: pnpm@10.31.0`), so prefer `pnpm` commands in docs and automation.
