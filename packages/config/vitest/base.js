import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest base configuration. Packages compose it with `mergeConfig` so
 * test setup stays consistent.
 */
export const vitestBase = defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/**/index.ts', 'src/**/*.d.ts'],
    },
  },
});

export default vitestBase;
