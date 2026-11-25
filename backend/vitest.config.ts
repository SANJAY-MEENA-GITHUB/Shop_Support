import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/services/**/*.ts', 'src/ai/**/*.ts'],
    },
  },
});
