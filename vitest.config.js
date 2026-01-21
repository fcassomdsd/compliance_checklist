import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom', // For Vue component testing
    globals: true,
    include: ['tests/*.test.js'],
    exclude: [
      'tests/preload.test.js',
      'tests/main.mjs.test.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'cobertura'],
      exclude: [
        'node_modules/',
        'tests/',
        '*eslint*',
        'alfresco/',
        'dist/',
        'preload.cjs',
        'main.mjs',
        '**/*.config.js',
      ],
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
  },
})
