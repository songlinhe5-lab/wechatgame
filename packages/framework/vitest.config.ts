import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the engine-agnostic framework core.
 *
 * Only `src/core`, `src/compose`, `src/platform` and the pure parts of
 * `src/adapters` are exercised here: those run in plain Node with no DOM and no
 * Cocos editor. `src/adapters/cocos/bindings.ts` statically imports `cc` and is
 * therefore excluded everywhere (see docs/engine-reference/cocos/VERSION.md).
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/compose/**/*.ts', 'src/platform/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/*.d.ts'],
      reporter: ['text', 'json-summary'],
      all: false,
    },
  },
});
