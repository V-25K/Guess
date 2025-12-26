import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Use happy-dom for all tests (compatible with both client and server tests)
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.property.test.ts', 'src/**/*.property.test.tsx', 'docs/**/*.test.ts', 'docs/**/*.property.test.ts'],
    setupFiles: ['./src/client/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      exclude: ['node_modules/', 'src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
    },
    testTimeout: 10000,
    // Property-based tests may need more time
    hookTimeout: 30000,
  },
  resolve: {
    conditions: ['node'],
  },
});
