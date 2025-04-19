import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    reporters: ['dot'],
    coverage: {
      include: ['src/**/*.ts'],
      reporter: ['lcov', 'text'],
    },
  },
})
