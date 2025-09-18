import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom', // For Vue component testing
    globals: true,
    include: ['tests/*.test.js'],
  },
});
