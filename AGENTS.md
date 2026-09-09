# Repository Guidelines

## Project Structure & Module Organization

`browser-preloader` is a TypeScript ES module package for preloading browser images. `src/index.ts` exposes the public API, `src/preloadImages.ts` implements loading, and `src/types.ts` defines shared interfaces. Tests live in `tests/preloadImages.test.ts` and mock image URLs; no asset directory is required. Root configuration files control TypeScript, tsdown, Vitest, Oxlint, and Oxfmt. Generated JavaScript and declarations go into `dist/`; do not edit them manually.

## Build, Test, and Development Commands

Use the pnpm version pinned in `package.json` and Node LTS as specified by `.node-version`.

- `pnpm install --frozen-lockfile`: install the locked dependencies.
- `pnpm run dev`: rebuild with tsdown in watch mode.
- `pnpm run build`: generate the browser package and type declarations.
- `pnpm run test`: run Vitest once; watch mode is disabled in configuration.
- `pnpm typecheck`: check types with `tsc --noEmit`.
- `pnpm run lint`: check code with Oxlint.
- `pnpm run format`: apply Oxfmt formatting.
- `pnpm run format:check`: check formatting without writing files.
- `pnpm run release:check`: run formatting checks, lint, type checks, and tests.

## Coding Style & Naming Conventions

Use strict TypeScript, ES module syntax, and separate `import type` declarations. Follow two-space indentation, LF endings, single quotes, no semicolons, trailing commas, and an 80-column formatting target. Use camelCase for functions, variables, and implementation filenames, such as `preloadImages.ts`; use PascalCase for interfaces and types. Document public options with JSDoc and update `README.md` when API behavior changes. Husky runs nano-staged before commits to fix lint and formatting on staged files.

## Testing Guidelines

Name test files `tests/*.test.ts` and use descriptive, behavior-focused `it` titles. Mock browser APIs such as `Image` and `requestIdleCallback`, and restore modified globals after tests. Cover success, failure, timeouts, cancellation, callbacks, and concurrency when changing those behaviors. No coverage threshold is configured. Run `pnpm run release:check` and `pnpm run build` before submitting; CI also builds and tests across Linux, Windows, and macOS.

## Commit & Pull Request Guidelines

Follow the history's Conventional Commit style: `feat:`, `fix:`, `docs:`, and `chore(deps):`, followed by a concise description. Keep commits focused. Pull requests should explain the behavior change, link relevant issues, and list verification commands and results. Include updated API examples where applicable and commit lockfile changes with dependency updates.
