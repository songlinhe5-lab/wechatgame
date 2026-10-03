import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    makeBeadRecipe,
    makeCellRecipe,
    type FilledBeadDraw,
    type TargetTileDraw,
    type EmptySocketDraw,
    type MaskBakeRecipe,
} from '../../src/core/bake/bake-recipes.js';
import { computeMaskField } from '../../src/core/bake/mask-field.js';
import {
    HOLED_MASK_SPEC,
    HOLeless_MASK_SPEC,
    MASK_CANONICAL_SIZE,
    MASK_CELL_DP,
    MASK_SCHEMA_VERSION,
    MASK_SUPERSAMPLE,
    maskSpecFor,
} from '../../src/core/bake/mask-spec.js';
import type { RenderModelBuilder } from '../../src/core/render/render-model.js';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '../../../..');
const TOOLS = join(REPO, 'tools/mask-preview');

/** 层集真源（capture 产物，⛔ 不手改）—— 单测读它把「spec 快照」钉死（DEC-3 防漂移）。 */
function layerSource(file: string): { beadLayers: unknown[] } {
    return JSON.parse(readFileSync(join(TOOLS, file), 'utf8')) as { beadLayers: unknown[] };
}

describe('MASK_SCHEMA_VERSION / MASK_CANONICAL_SIZE', () => {
    it('mask 失效号独立于位图号（EP12-S7：两套 key 结构不同，混号必互相牵连）', () => {
        expect(Number.isInteger(MASK_SCHEMA_VERSION)).toBe(true);
        expect(MASK_SCHEMA_VERSION).toBeGreaterThan(0);
    });

    it('烘焙档位 = 128px（= 定稿 py 的 OUT；⛔ 非 112）', () => {
        // ADR-0029 DEC-4：128 是当前唯一烘焙档。`BAKE_CANONICAL_SIZE`（beads tuning）同为 128，
        // 由 `games/beads/tests/bead-tint-arm.test.ts` 跨包钉住。
        expect(MASK_CANONICAL_SIZE).toBe(128);
        expect(MASK_CANONICAL_SIZE % MASK_SUPERSAMPLE).toBe(0);
    });
});

describe('MaskSpec · 层集同源（DEC-3「⛔ 不得手写第二份系数」）', () => {
    it('有孔档 beadLayers 逐字段等于 layers.json', () => {
        expect(HOLED_MASK_SPEC.beadLayers).toEqual(layerSource('layers.json').beadLayers);
    });

    it('无孔档 beadLayers 逐字段等于 layers-holeless.json', () => {
        expect(HOLeless_MASK_SPEC.beadLayers).toEqual(layerSource('layers-holeless.json').beadLayers);
    });

    it('两档定稿口径：珠 26/24dp、孔 ⌀12/无孔、frame 1dp、四扇 0.70/0.63/0.52/0.42、槽底 0.70/0.32', () => {
        expect(HOLED_MASK_SPEC.beadDp).toBe(26);
        expect(HOLED_MASK_SPEC.holeDp).toBe(12);
        expect(HOLED_MASK_SPEC.holeRingDp).toBe(1);
        expect(HOLED_MASK_SPEC.frameDp).toBe(1);
        expect(HOLED_MASK_SPEC.slotFloorD).toBe(0.7);
        expect(HOLED_MASK_SPEC.outsideD).toBe(0.7);
        expect(HOLeless_MASK_SPEC.beadDp).toBe(24);
        expect(HOLeless_MASK_SPEC.holeDp).toBe(0);
        expect(HOLeless_MASK_SPEC.slotFloorD).toBe(0.32);
        expect(HOLeless_MASK_SPEC.outsideD).toBe(0.7);
        // 外框四扇：0.42 + 0.28×(1.0 | 0.75 | 0.35) = 0.70 / 0.63 / 0.52（冻结值）
        expect(0.42 + 0.28 * 1.0).toBeCloseTo(0.7, 10);
        expect(0.42 + 0.28 * 0.75).toBeCloseTo(0.63, 10);
        expect(0.42 + 0.28 * 0.35).toBeCloseTo(0.518, 10);
    });

    it('maskSpecFor 覆盖两档且 ⛔ 不给未定义档位回落', () => {
        expect(maskSpecFor('holed')).toBe(HOLED_MASK_SPEC);
        expect(maskSpecFor('holeless')).toBe(HOLeless_MASK_SPEC);
    });
});

describe('computeMaskField · 编码不变式（DEC-6，承 ADR-0028 §2.1）', () => {
    const w = MASK_CANONICAL_SIZE;
    const px = (f: { data: Uint8Array }, x: number, y: number, c: number) => f.data[(y * w + x) * 4 + c]!;

    for (const [kind, gauge] of [
        ['bead', 'holed'],
        ['cell', 'holed'],
        ['bead', 'holeless'],
        ['cell', 'holeless'],
    ] as const) {
        it(`I-1 A ≡ 255 满幅（免疫 Trim）· ${kind}/${gauge}`, () => {
            const f = computeMaskField(kind, maskSpecFor(gauge), w);
            for (let i = 0; i < w * w; i++) expect(f.data[i * 4 + 3]).toBe(255);
        });
    }

    it('I-2 珠面 B = 圆角方 − 真透孔：孔心 B=0，且孔等效 ⌀ 在 12dp 名义附近', () => {
        const f = computeMaskField('bead', HOLED_MASK_SPEC, w);
        const c = Math.floor(w / 2);
        expect(px(f, c, c, 2)).toBe(0);
        // 洪泛 B<250 的孔区（与 asset-spec §2.3 I-2 同口径：含 0.5dp 羽化环）
        const seen = new Uint8Array(w * w);
        const stack = [c * w + c];
        seen[c * w + c] = 1;
        let n = 0;
        while (stack.length > 0) {
            const i = stack.pop()!;
            n++;
            const x = i % w;
            const y = (i - x) / w;
            for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
                if (nx < 0 || ny < 0 || nx >= w || ny >= w) continue;
                const j = ny * w + nx;
                if (seen[j] === 1 || f.data[j * 4 + 2]! >= 250) continue;
                seen[j] = 1;
                stack.push(j);
            }
        }
        const perPx = (MASK_CELL_DP / w) ** 2;
        const dEq = 2 * Math.sqrt((n * perPx) / Math.PI);
        expect(dEq).toBeGreaterThan(11.4);
        expect(dEq).toBeLessThan(13.2);
    });

    // ── [WXG-T-232] 形状通道边缘质量：把「亮刻面压格边界 / 孔缘过软」变成可测数 ──
    it('WXG-T-232：形状通道**无振铃斑点**（0 < B < 8 的像素 = 0）', () => {
        // 回归锚：LANCZOS 在珠外缘 0↔255 硬台阶两侧留 1–4/255 的斑点（实测 x=6 B=4 / x=121 B=2），
        // 它们落在 B0 上成为极淡亮晕 ⇒ 视觉上「亮带压格线」。`applyShapeFloor`（8/255）清之。
        for (const gauge of ['holed', 'holeless'] as const) {
            const f = computeMaskField('bead', maskSpecFor(gauge), MASK_CANONICAL_SIZE);
            let specks = 0;
            for (let i = 2; i < f.data.length; i += 4) {
                const b = f.data[i]!;
                if (b > 0 && b < 8) specks += 1;
            }
            expect(specks, `${gauge} 振铃斑点`).toBe(0);
        }
    });

    it('WXG-T-232：珠 solid 区 = 26.0dp（±1px），亮刻面到格边界缓冲 ≥ 1.5dp', () => {
        // 验收项（用户 2026-10-03 裁定的机检数）：不是「看着别扭」，是可测数。
        const n = MASK_CANONICAL_SIZE;
        const f = computeMaskField('bead', HOLED_MASK_SPEC, n);
        // ⚠ 中行穿过**孔心**（B=0）⇒ 不能从中心左右扫；改用**全局包围盒**
        // （最左/最右的 solid 像素在中高度的两侧，角部圆角不影响 bbox 宽度）。
        const solidCols: number[] = [];
        for (let x = 0; x < n; x += 1) {
            for (let y = 0; y < n; y += 1) {
                if (f.data[(y * n + x) * 4 + 2]! >= 128) { solidCols.push(x); break; }
            }
        }
        const lo = solidCols[0]!;
        const hi = solidCols[solidCols.length - 1]!;
        const beadDp = ((hi - lo + 1) / n) * MASK_CELL_DP;
        expect(beadDp).toBeGreaterThanOrEqual(25.5);
        expect(beadDp).toBeLessThanOrEqual(26.5);
        // 缓冲：格径 30 − 珠 26 ⇒ 每侧 2dp
        expect((MASK_CELL_DP - beadDp) / 2).toBeGreaterThanOrEqual(1.5);
    });

    it('WXG-T-232：孔缘 50% 交点 ≈ 标称 ⌀12dp（羽化收到 0.25dp）', () => {
        // ⛔ 判据用「50% 交点」而非「全透区直径」：任何 AA/羽化都会让全透区小于标称，
        //    那是几何的必然，不是缺陷（v0.1 我曾把 ⌀10.5 当成「侵蚀」——已自纠）。
        expect(HOLED_MASK_SPEC.holeFeatherDp).toBe(0.25);
        const n = MASK_CANONICAL_SIZE;
        const f = computeMaskField('bead', HOLED_MASK_SPEC, n);
        const c = Math.floor(n / 2);
        const at = (r: number) => f.data[((c - r) * n + c) * 4 + 2]!;
        // 找 B 穿越 128 的半径
        let r50 = 0;
        for (let r = 1; r < n / 2; r += 1) {
            if (at(r) >= 128) { r50 = r; break; }
        }
        const holeDp = (2 * r50 / n) * MASK_CELL_DP;
        expect(holeDp).toBeGreaterThanOrEqual(11.0);
        expect(holeDp).toBeLessThanOrEqual(13.0);
    });

    it('I-3 holeless 珠面无孔（孔心 B 满幅）', () => {
        const f = computeMaskField('bead', HOLeless_MASK_SPEC, w);
        const c = Math.floor(w / 2);
        expect(px(f, c, c, 2)).toBe(255);
    });

    // [WXG-T-237 v7.0 · 用户裁定「格底 base 图的槽外面部分要做成透明」]
    // ⛔ **旧口径「格面 B 满幅 255」已被推翻**（那正是「格面被 mask 完全遮住」的根因）。
    // 新口径钉三条：
    //  ① **槽口内**（3dp 斜面 + 槽底）B = 255 —— 凹陷感由它承担；**槽底两档都必须留**
    //     （无孔档槽底是 0.32 深坑，透明化会抹平判据 I-5 的分叉）。
    //  ② **格外** B = 0 ⇒ 透明 ⇒ 露出调用方在下方画的 `−0.30` 底色层。
    //  ③ 零中间带（无振铃残留）⇒ 形状是**纯二值**，格面边界不会糊。
    it('I-4 格面 B：槽口内 255 / 格外 0（纯二值，零振铃中间带）', () => {
        const c = Math.floor(w / 2);
        for (const gauge of ['holed', 'holeless'] as const) {
            const f = computeMaskField('cell', maskSpecFor(gauge), w);
            // ① 槽心（槽底）= 255
            expect(f.data[(c * w + c) * 4 + 2], `${gauge} 槽底 shape`).toBe(255);
            // ② 格外（四角 + 边缘中点）= 0
            for (const [x, y] of [[1, 1], [1, c], [c, 1], [w - 2, c], [c, w - 2], [w - 2, w - 2]] as const) {
                expect(f.data[(y * w + x) * 4 + 2], `${gauge} 格外(${x},${y}) shape 须透明`).toBe(0);
            }
            // ③ 纯二值：全场只允许 {0, 255}
            for (let i = 0; i < w * w; i++) {
                const b = f.data[i * 4 + 2]!;
                expect(b === 0 || b === 255, `${gauge} 出现振铃中间值 ${b} @(${i % w},${Math.floor(i / w)})`).toBe(true);
            }
        }
    });

    it('I-5/I-6 槽底按档定值（holed 0.70 / holeless 0.32）· 格外 0.70', () => {
        const holed = computeMaskField('cell', HOLED_MASK_SPEC, w);
        const holeless = computeMaskField('cell', HOLeless_MASK_SPEC, w);
        const c = Math.floor(w / 2);
        expect(Math.abs(px(holed, c, c, 0) - Math.trunc(0.7 * 255))).toBeLessThanOrEqual(1);
        expect(Math.abs(px(holeless, c, c, 0) - Math.trunc(0.32 * 255))).toBeLessThanOrEqual(1);
        expect(Math.abs(px(holed, 1, 1, 0) - Math.trunc(0.7 * 255))).toBeLessThanOrEqual(1);
        expect(Math.abs(px(holeless, 1, 1, 0) - Math.trunc(0.7 * 255))).toBeLessThanOrEqual(1);
    });

    it('V-1 mask 与颜色无关：同一 (kind,gauge) 两次计算逐字节相同，且不接收任何颜色参数', () => {
        for (const [kind, gauge] of [
            ['bead', 'holed'],
            ['cell', 'holeless'],
        ] as const) {
            const a = computeMaskField(kind, maskSpecFor(gauge), w);
            const b = computeMaskField(kind, maskSpecFor(gauge), w);
            expect(Array.from(a.data)).toEqual(Array.from(b.data));
        }
    });

    it('G 通道只在上扇与受光斜面非零；上界 0.408 = lit 0.38 + LANCZOS 过冲（asset-spec §2.1 实测值）', () => {
        const f = computeMaskField('bead', HOLED_MASK_SPEC, w);
        let gMax = 0;
        for (let i = 0; i < w * w; i++) gMax = Math.max(gMax, f.data[i * 4 + 1]!);
        expect(gMax).toBeGreaterThan(0);
        // ⛔ 不可断言 ≤ lit(0.38)：LANCZOS 有负瓣，0↔0.38 边界过冲到 0.408（`asset-spec §2.1` 实测 0–0.408）。
        expect(gMax).toBeLessThanOrEqual(105);
    });
});

describe('makeBeadRecipe / makeCellRecipe · mask 模式（S1 交付面）', () => {
    it('mask 模式返回 d/l mask 场，**不吃 builder**、零绘制命令', () => {
        const calls: unknown[] = [];
        const draw: FilledBeadDraw = (...args) => calls.push(args);
        const recipe = makeBeadRecipe(draw, { mode: 'mask', gauge: 'holed' });
        const field = recipe();
        expect(field.width).toBe(MASK_CANONICAL_SIZE);
        expect(field.data.length).toBe(MASK_CANONICAL_SIZE * MASK_CANONICAL_SIZE * 4);
        expect(calls).toHaveLength(0);
    });

    it('mask 模式忽略 styleId / colorIdx（d/l 与色无关，V-1）', () => {
        const recipe = makeBeadRecipe(() => {}, { mode: 'mask', gauge: 'holed' });
        expect(Array.from(recipe(64).data)).toEqual(Array.from(recipe(64).data));
    });

    it('两档产出不同（holed 有孔 ⌀12 / holeless 无孔 24dp）', () => {
        const holed = makeBeadRecipe(() => {}, { mode: 'mask', gauge: 'holed' })(MASK_CANONICAL_SIZE);
        const holeless = makeBeadRecipe(() => {}, { mode: 'mask', gauge: 'holeless' })(MASK_CANONICAL_SIZE);
        expect(Array.from(holed.data)).not.toEqual(Array.from(holeless.data));
        const c = Math.floor(MASK_CANONICAL_SIZE / 2);
        expect(holed.data[(c * MASK_CANONICAL_SIZE + c) * 4 + 2]).toBe(0); // 孔心 B=0
        expect(holeless.data[(c * MASK_CANONICAL_SIZE + c) * 4 + 2]).toBe(255);
    });

    it('cell mask 模式同样零绘制命令，且槽底按档分叉', () => {
        const tileCalls: unknown[] = [];
        const socketCalls: unknown[] = [];
        const drawTile: TargetTileDraw = (...a) => tileCalls.push(a);
        const drawSocket: EmptySocketDraw = (...a) => socketCalls.push(a);
        const opts = { palette: {}, inks: {}, cellOfPitch: 30 / 32, insetOverPitch: 4 / 32 };
        const recipe = makeCellRecipe(drawTile, drawSocket, opts, { mode: 'mask', gauge: 'holeless' });
        const field = recipe();
        expect(field.data.length).toBe(MASK_CANONICAL_SIZE ** 2 * 4);
        expect(tileCalls).toHaveLength(0);
        expect(socketCalls).toHaveLength(0);
    });

    it('**默认仍是位图模式**：旧调用方（studio bake-export）零破坏', () => {
        const calls: Array<{ cx: number; cy: number; ci: number; opts: unknown }> = [];
        const draw: FilledBeadDraw = (_b, cx, cy, ci, opts) => calls.push({ cx, cy, ci, opts });
        const recipe = makeBeadRecipe(draw);
        recipe({} as RenderModelBuilder, 'facet-4', 3, 112);
        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual({ cx: 56, cy: 56, ci: 3, opts: { size: 112, styleId: 'facet-4' } });
    });

    it('cell 位图模式逐字节不变（drawTile + drawSocket 序与参不变）', () => {
        const order: string[] = [];
        const drawTile: TargetTileDraw = () => order.push('tile');
        const drawSocket: EmptySocketDraw = () => order.push('socket');
        const recipe = makeCellRecipe(drawTile, drawSocket, {
            palette: {},
            inks: {},
            cellOfPitch: 30 / 32,
            insetOverPitch: 4 / 32,
        });
        recipe({} as RenderModelBuilder, 'ignored', 5, 112);
        expect(order).toEqual(['tile', 'socket']);
    });

    it('MaskBakeRecipe 形状 = (size?) => MaskField', () => {
        const recipe: MaskBakeRecipe = makeBeadRecipe(() => {}, { mode: 'mask', gauge: 'holed' });
        expect(recipe(64).width).toBe(64);
    });
});

describe('computeMaskField · 尺寸守卫', () => {
    it('⛔ 非整数比尺寸直接抛错（LANCZOS ÷非整数比会把内容压偏）', () => {
        expect(() => computeMaskField('bead', HOLED_MASK_SPEC, 130)).toThrow(/divisible/);
    });
});
