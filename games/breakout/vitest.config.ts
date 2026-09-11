import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Breakout test config.
 *
 * `@wxgame/framework` is aliased straight at the framework *source* so the game
 * tests run with no build step. The Cocos project will instead consume the
 * framework through the packaging strategy described in
 * games/breakout/cocos/README.md (which still needs a decision in the editor).
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
