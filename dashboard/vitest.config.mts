import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['core/**/*.test.mjs'],
    setupFiles: ['./core/test-setup.mjs'],
    testTimeout: 20000,
  },
});
