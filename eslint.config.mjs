// @ts-check

import { defineESLintConfig } from '@ntnyq/eslint-config'

export default defineESLintConfig({
  perfectionist: {
    all: true,
  },
  unicorn: {
    overrides: {
      'unicorn/prefer-add-event-listener': 'off',
    },
  },
})
