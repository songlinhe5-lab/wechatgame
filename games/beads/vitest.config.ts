import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Beads test config.
 *
 * `@wxgame/framework` is aliased straight at the framework *source* so the game
 * tests run with no build step. Same shape as the breakout config (判例复用).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@wxgame/framework': fileURLToPath(
        new URL('../../packages/framework/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts'],
      reporter: ['text', 'json-summary'],
      all: false,
    },
  },
});
