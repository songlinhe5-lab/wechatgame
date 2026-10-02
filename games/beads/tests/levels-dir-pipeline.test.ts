/**
 * 关卡内容管线 P1（目录化真源）不变量守卫 · WXG-T-185
 *
 * 为什么测「数据/结构」而非 import 生成脚本：tsconfig 纳入 tests 目录的 .ts 且无 allowJs，
 * 从 TS 测试 import tools/scripts 下的 .mjs 会破 tsc --noEmit。生成脚本自身由
 * `pnpm run levels:check`（verify 内）把关；本测试只钉住 P1 真正在乎的**结果不变量**：
 *   ① 产物 LEVELS_DATA 数据体与迁移前单文件**逐字节一致**（零行为漂移）
 *   ② manifest 是合法唯一顺序真源（order 连续 / uid 唯一 / 引用齐全 / 无孤儿）
 *   ③ 目录模式下顶层不再残留别的关卡 json（避免与 manifest 二义）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

interface Entry {
  uid: string;
  kind: string;
  file: string;
  pack: string;
  order: number;
}
interface Manifest {
  schemaVersion: number;
  contentVersion: number;
  gameId: string;
  description?: string;
  paletteFile: string;
  entries: Entry[];
}

const LEVELS_DIR = '../design/levels/';
const product = readFileSync(at('../src/config/levels-data.ts'), 'utf8');
const snapshot = readFileSync(at('./__fixtures__/levels-body.snapshot'), 'utf8');
const manifest = JSON.parse(readFileSync(at(`${LEVELS_DIR}manifest.json`), 'utf8')) as Manifest;

// 取产物 `export const LEVELS_DATA …` 之后的数据体（GENERATED 头部注释不计入）
const bodyOf = (src: string) => src.slice(src.indexOf('export const LEVELS_DATA')).trimEnd();

describe('P1 目录化真源不变量', () => {
  /**
   * **① 产物 == 迁移前快照 —— 已降级为「一次性历史断言」（WXG-T-231 · B 类 · 用户 2026-10-02 拍板「乙」）**
   *
   * **它原本证明什么**：P1 目录化迁移那一刀**零行为漂移**（快照 = 迁移当时的数据体）。
   * **为什么必须降级**：它锁的是**历史事件**，却被当作**持续不变量**使用 ⇒ 关表在 P1 之后
   * 任何一次**合法**内容变更（最新一次 = `81b08ed` 入第 9 关，8→9）都会让它红，且红因与被测行为无关。
   * 实测代价：本红在树里挂了 3 天，与 3 条真漂移（`DEMO_LEVEL_COUNT` 漏同步）混在一起，**稀释了真信号**。
   *
   * **现态由谁承担**：
   *   - ②③（本文件）= **活的结构不变量**（`schemaVersion` 冻结 / order·uid·引用齐全）；
   *   - 「产物 == 现场装配结果」的**字节一致性** = `pnpm run levels:check`（`--check` 逐字节比对，
   *     已在 `verify` 内，且 WXG-T-231 同批给它加了门禁⑤「`DEMO_LEVEL_COUNT` == manifest 关数」）。
   *   ⇒ 本条与 `levels:check` **同源重复**（K-042：同源判据须另配守卫，而非两处各钉一份）。
   *
   * **怎么复跑**（默认 skip，设 env 即跑）：
   *   `WXG_T185_MIGRATION_RECHECK=1 pnpm --filter @wxgame/beads exec vitest run tests/levels-dir-pipeline.test.ts`
   * ⚠️ 复跑**预期为红**（快照停在 8 关、产物已 9 关）—— 除非你正在审计 P1 迁移本身，
   *    此时它的红是**正确**的（证明关表确实已偏离迁移时点）。
   */
  it.skipIf(process.env.WXG_T185_MIGRATION_RECHECK !== '1')(
    '［T-185 迁移期一次性］产物数据体逐字节等于迁移前快照（零行为漂移）',
    () => {
      expect(bodyOf(product)).toBe(snapshot.trimEnd());
    },
  );

  it('schemaVersion 冻结为 2（→ LEVELS_DATA.version 不变）', () => {
    expect(manifest.schemaVersion).toBe(2);
  });

  it('manifest.order 连续 1..N 且 uid 唯一', () => {
    const uids = new Set<string>();
    manifest.entries.forEach((e, i) => {
      expect(e.order).toBe(i + 1);
      expect(uids.has(e.uid)).toBe(false);
      uids.add(e.uid);
    });
    expect(manifest.entries.length).toBeGreaterThan(0);
  });

  it('每个 entry 引用的文件存在，且目录模式无孤儿关卡 json', () => {
    const referenced = new Set(manifest.entries.map((e) => e.file));
    for (const e of manifest.entries) {
      expect(existsSync(at(`${LEVELS_DIR}${e.file}`))).toBe(true);
    }
    for (const sub of ['singles', 'plates']) {
      const dir = at(`${LEVELS_DIR}${sub}/`);
      const jsons = existsSync(dir)
        ? readdirSync(dir).filter((f) => f.endsWith('.json'))
        : [];
      for (const f of jsons) expect(referenced.has(`${sub}/${f}`)).toBe(true);
    }
  });

  it('目录模式下顶层不再残留别的关卡 json（仅 manifest+palette）', () => {
    const stray = readdirSync(at(LEVELS_DIR)).filter(
      (f) => f.endsWith('.json') && f !== 'manifest.json' && f !== 'palette.json',
    );
    expect(stray).toEqual([]);
  });
});
