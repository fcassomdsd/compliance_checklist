import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom', // For Vue component testing
    globals: true,
    include: ['src/__tests__/*.test.js', 'electron/__tests__/*.test.js'],
    exclude: ['electron/__tests__/preload.test.js', 'electron/__tests__/main.mjs.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'cobertura'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        'electron/__tests__/',
        'e2e/**',
        '*eslint*',
        'alfresco/',
        'dist/',
        'electron/preload.cjs',
        'electron/main.mjs',
        '**/*.config.js',
        '**/*.config.mjs',
      ],
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
  },
})
