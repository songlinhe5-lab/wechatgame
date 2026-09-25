/**
 * `.js` → `.ts` 解析钩子（WXG-T-211-B1 / EP11-S2，供 check-bead-style-pool.mjs 用）。
 *
 * 仓内 TS 源码互引一律写 `./x.js`（ESM + TS 惯例），而 Node ≥22.18 的原生
 * type-stripping 只认字面 `.ts` 路径 ⇒ 直接 `import('.../registry.ts')` 会在链上
 * 第一处 `../config/tuning.js` 断掉。本钩子把**磁盘上不存在的 `.js`** 指到同名
 * `.ts`（存在 `.js` 时绝不接管 ⇒ 对普通 .mjs 工具链零影响）。
 * 用法：`node --import=<本文件> <脚本>`。
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(
    new URL('data:text/javascript,' + encodeURIComponent(`
    import { existsSync } from 'node:fs';
    import { fileURLToPath } from 'node:url';
    export async function resolve(specifier, context, next) {
      if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
        const base = new URL(specifier, context.parentURL);
        if (!existsSync(fileURLToPath(base))) {
          const ts = new URL(specifier.replace(/\\.js$/, '') + '.ts', context.parentURL);
          if (existsSync(fileURLToPath(ts))) {
            return next(ts.href, context);
          }
        }
      }
      return next(specifier, context);
    }
  `)),
    pathToFileURL(import.meta.filename),
);
