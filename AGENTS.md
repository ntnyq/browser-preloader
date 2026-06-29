# Repository Guidelines

## Project Structure & Module Organization

This repository is a small TypeScript browser utility package. Public exports start at `src/index.ts`; the main implementation lives in `src/preloadImages.ts`. Tests are in `tests/`, currently `tests/preloadImages.test.ts`. Build and test configuration is kept at the root: `tsdown.config.ts`, `vitest.config.ts`, `tsconfig.json`, `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml`. Published artifacts are generated into `dist/` and should not be edited by hand.

## Build, Test, and Development Commands

Use `pnpm` for all package tasks.

- `pnpm install --frozen-lockfile`: install dependencies exactly from `pnpm-lock.yaml`.
- `pnpm run build`: build the package with `tsdown`.
- `pnpm run dev`: run `tsdown` in watch mode.
- `pnpm run test`: run the Vitest suite once.
- `pnpm run typecheck`: run `tsgo --noEmit`.
- `pnpm run lint`: run Oxlint.
- `pnpm run format:check`: check formatting with Oxfmt.
- `pnpm run release:check`: run format, lint, typecheck, and tests together.

## Coding Style & Naming Conventions

Write TypeScript as ES modules and keep browser-specific code inside `src/`. Follow the existing strict TypeScript style: explicit exported types, narrow option unions, and no unnecessary runtime abstractions. Use camelCase for functions and variables, PascalCase for interfaces and exported types, and descriptive option names such as `loadOnIdle` or `maxConcurrent`. Formatting is enforced by Oxfmt and linting by Oxlint; run `pnpm run release:check` before submitting changes.

## Testing Guidelines

Vitest is the test framework. Place tests in `tests/` and name files `*.test.ts`. Prefer behavior-focused test names that describe the observable result, especially for browser APIs such as `Image`, timers, and callbacks. Add or update tests for changes to loading strategy, timeout handling, callback behavior, and error handling.

## Commit & Pull Request Guidelines

The history uses concise Conventional Commit-style messages, especially `chore: ...` and `chore(deps): ...`. Use focused commits such as `fix: handle empty image list` or `test: cover timeout cleanup`. Pull requests should include a short summary, linked issue when available, and the verification commands run. For dependency updates, call out lockfile changes and any runtime or toolchain impact.

## Security & Configuration Tips

Keep package-manager settings in `pnpm-workspace.yaml`. Do not commit credentials, registry tokens, generated caches, or local environment files. This package runs in browsers, so avoid unsafe HTML injection and keep external resource handling explicit.
