// WXG-T-182 · G-3 取证专用 loader（temp/ 临时件，**非生产码**，不进任何构建包）。
//
// 为什么需要它：本仓玩法源码用 TS 的「相对 `.js` 说明符」写法（`import './tray.js'` 指向
// `tray.ts`），而 Node 原生的 TS 支持**不做 `.js → .ts` 重解析**，且 `@wxgame/*` 是 workspace
// 内部包（根 node_modules 无链接）。本 hook 只做两件事：
//   1) 相对/绝对 `.js` 说明符 ⇒ 若同名 `.ts` 存在则改指 `.ts`；
//   2) `@wxgame/framework[...]` / `@wxgame/beads[...]` ⇒ 指到 `src/**.ts` 真源。
// 零补丁、零改写引擎代码：取证脚本因此**跑的是生产实现本体**（beads-game / tray / grid /
// placement / retrieve / powerups），不是复刻。
//
// 用法：node --experimental-transform-types --import=./games/beads/design/forensics/g3/g3-hooks.mjs <script>.ts

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 归档重锚（2026-09-21）：原住 `temp/` 时仓根 = dirname²；现住
// `games/beads/design/forensics/g3/` ⇒ 上溯 5 级（g3→forensics→design→beads→games→仓根）。
const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '../../../../..');

const PKG_ENTRY = {
  '@wxgame/framework': join(REPO_ROOT, 'packages/framework/src/index.ts'),
  '@wxgame/beads': join(REPO_ROOT, 'games/beads/src/index.ts'),
};

registerHooks({
  resolve(spec, ctx, next) {
    // 1) workspace 包名 → TS 真源（含子路径 `@wxgame/framework/core` 之类）。
    if (spec.startsWith('@wxgame/')) {
      const direct = PKG_ENTRY[spec];
      if (direct && existsSync(direct)) {
        return { url: pathToFileURL(direct).href, shortCircuit: true };
      }
      const hit = Object.entries(PKG_ENTRY).find(([name]) => spec.startsWith(name + '/'));
      if (hit) {
        const sub = spec.slice(hit[0].length + 1);
        const pkgRoot = hit[0] === '@wxgame/framework'
          ? join(REPO_ROOT, 'packages/framework')
          : join(REPO_ROOT, 'games/beads');
        for (const cand of [join(pkgRoot, 'src', sub + '.ts'), join(pkgRoot, sub)]) {
          if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
        }
      }
      return next(spec, ctx);
    }

    // 2) `.js` 说明符 → 同目录 `.ts`（本仓玩法/框架源码的既有写法）。
    if (spec.endsWith('.js') && (spec.startsWith('.') || spec.startsWith('/'))) {
      const parent = ctx.parentURL ? fileURLToPath(ctx.parentURL) : process.cwd();
      const base = spec.startsWith('.') ? resolvePath(dirname(parent), spec) : spec;
      const ts = base.slice(0, -3) + '.ts';
      if (existsSync(ts)) return { url: pathToFileURL(ts).href, shortCircuit: true };
    }

    return next(spec, ctx);
  },
});
