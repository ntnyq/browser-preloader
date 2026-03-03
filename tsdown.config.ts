import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  dts: {
    tsgo: true,
  },
  entry: ['src/index.ts'],
  minify: 'dce-only',
  platform: 'browser',
  deps: {
    onlyAllowBundle: ['@ntnyq/utils'],
  },
})
