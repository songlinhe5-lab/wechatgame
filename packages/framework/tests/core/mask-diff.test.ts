/**
 * `[WXG-T-226 EP12-S1 / ADR-0029 DEC-3]` **`mask:diff` 对拍门禁的单测形态**。
 *
 * 权威口径 = `tools/mask-preview/mask-diff.mjs`（同一份读数来源：`lib/png-rgba.mjs` + 同一
 * `computeMaskField`）。本测试把「py 产物 vs TS 场计算」的比较**搬进单测**，使门禁能在
 * `pnpm --filter @wxgame/framework run test` 里跑（CI 友好），而不必依赖 python 复跑。
 *
 * ⛔ **不改 `pnpm run verify` 配置**（是否挂载由主理人裁定，见 TASKS-DETAIL 回写）。
 * ⚠ 容差：方案件 §4.3 的「mean ≤1/255、max ≤2/255」原文标注为「**建议，落码前与 QA 对齐**」。
 *   **本批实测已达逐字节一致（mean = max = 0）** ⇒ 门禁按**逐字节相等**判，比建议容差更严。
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 仓内 .mjs 无类型声明
// @ts-ignore
import { readPngRgba } from '../../../../tools/mask-preview/lib/png-rgba.mjs';
import { computeMaskField } from '../../src/core/bake/mask-field.js';
import { MASK_CANONICAL_SIZE, maskSpecFor, type BeadMaskGauge } from '../../src/core/bake/mask-spec.js';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '../../../..');
const ASSETS = join(REPO, 'tools/mask-preview/cocos-assets');

/** 四件套 = 2 kind × 2 gauge（`art/tint-mask-asset-spec §1.1`）。 */
const TARGETS = [
    { kind: 'bead', gauge: 'holed', file: 'bead-tint-128-mask.png' },
    { kind: 'cell', gauge: 'holed', file: 'grid-tint-128-mask.png' },
    { kind: 'bead', gauge: 'holeless', file: 'bead-holeless-tint-128-mask.png' },
    { kind: 'cell', gauge: 'holeless', file: 'grid-holeless-tint-128-mask.png' },
] as const;

function maxAbsDiff(a: Uint8Array, b: Uint8Array): number {
    let m = 0;
    for (let i = 0; i < a.length; i++) {
        const d = Math.abs(a[i]! - b[i]!);
        if (d > m) m = d;
    }
    return m;
}

describe('mask:diff · py 定稿产物 vs TS 场计算（DEC-3 对拍门禁）', () => {
    for (const t of TARGETS) {
        it(`${t.file}（${t.kind}/${t.gauge}）逐字节一致`, () => {
            const path = join(ASSETS, t.file);
            // ⛔ 参考产物缺失 ⇒ **红**（不得静默跳过：门禁的牙在「产物在库且一致」）。
            expect(existsSync(path), `缺定稿产物 ${path}（先跑 export-cocos-textures*.py）`).toBe(true);
            const ref = readPngRgba(path) as { width: number; height: number; data: Uint8Array };
            const field = computeMaskField(t.kind, maskSpecFor(t.gauge as BeadMaskGauge), MASK_CANONICAL_SIZE);
            expect(ref.width).toBe(field.width);
            expect(ref.height).toBe(field.height);
            // 逐字节（R/G/B/A 全通道）
            expect(maxAbsDiff(ref.data, field.data)).toBe(0);
        });
    }

    it('对拍读数与 mask-diff.mjs 同源（同函数、同容差语义）', () => {
        // 结构守卫：门禁脚本与单测必须都走 `computeMaskField` + `readPngRgba`。
        const script = readFileSync(join(REPO, 'tools/mask-preview/mask-diff.mjs'), 'utf8');
        expect(script).toContain('computeMaskField');
        expect(script).toContain('readPngRgba');
        expect(script).toContain('mask-spec.js');
    });
});
