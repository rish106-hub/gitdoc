import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts', 'test/realgit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // extension.ts / ui.ts are thin vscode-API wrappers exercised by the
      // integration suite, not unit tests; exclude from unit-coverage numbers.
      exclude: ['src/extension.ts', 'src/ui.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
})
