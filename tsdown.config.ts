import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  deps: {
    onlyBundle: ['@ntnyq/utils'],
  },
  dts: {
    compilerOptions: {
      isolatedDeclarations: true,
    },
  },
  entry: ['src/index.ts'],
  minify: 'dce-only',
  platform: 'browser',
})
