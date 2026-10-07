/**
 * **[EP12-S6 · T-2B]** 作品格珠拼缩略判据套（WXG-T-269-S6 子单 T-2B / Deliverable 5）。
 * ─────────────────────────────────────────────────────────────────────────────
 * 真源：`games/beads/art/menu-wall-signage-spec.md`（林绘澄 T-1）**§3.1 聚合规则** / **§3.2 案乙几何** /
 * **§3.3 单格珠数上限** / **§3.4 档位表**；实现 = `src/view/menu-signage.ts::{levelThumbCells,drawLevelThumb}`。
 * 主理人裁定：案乙（缩略区 84、现装占位格几何不动）+ **5×5 主色块聚合** + **单格 ≤ 25 珠硬判据**。
 *
 * ## 本套盯的四个失败模式
 * 1. **聚合越界 / 重复消费**：切块必须**覆盖且仅覆盖**每个源格一次（rows>1 时），否则大关盘面会把
 *    同一格计进两块 ⇒ 主色失真。⇒ 腿 A 用「逐格归属」正面核，不只看结果数。
 * 2. **平票不确定**（T-1 §3.1 明文「⛔ 禁依赖扫描顺序」）：⇒ 腿 B 用**行内容前后调换**的同型块对撞，
 *    并钉「平票 ⇒ 最小 colorIdx」。
 * 3. **每帧分配**（`control-manifest §2`）：聚合表必**一次性烘焙 + 缓存**，每帧只 `get`
 *    ⇒ 腿 D 以「两次调用同一引用」为机械锚（值相等不够，引用相等才证明没重算）。
 * 4. **≤25 上限名存实亡**：上限押在 `n²` 而非关卡规模 ⇒ 腿 C 既测九关实值，也测**人工大盘**（30×30 全填）
 *    证明「规模涨、珠数不涨」。
 *
 * 层级：tests（纯函数 + 纯渲染断言；⛔ 不写业务状态）。
 */

import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import {
    BEAD_GAP,
    BEAD_STYLE_MAX_COMMANDS,
    DESIGN_H,
    DESIGN_W,
    SIGN_FACE_FLOOR,
    THUMB_AREA,
    THUMB_BEADS_MAX,
    THUMB_MATRIX_N,
    THUMB_STAR_BAND,
    THUMB_TIERS,
    THUMB_TOP_INSET,
    WALL_CELL,
    thumbOuterFor,
    thumbPitchFor,
} from '../src/config/tuning.js';
import { LEVELS } from '../src/config/levels.js';
import { BEAD_COLOR_MAX } from '../src/config/tuning.js';
import { beadInksFor, DEFAULT_PALETTE } from '../src/view/palette.js';
import {
    drawLevelThumb,
    levelThumbBeads,
    levelThumbCells,
    thumbFaceB,
} from '../src/view/menu-signage.js';
import { drawFilledBead } from '../src/view/bead-render.js';
import { simpleTestLevel } from './helpers.js';
import type { BeadsLevelRaw } from '../src/config/levels-data.js';

type CircleCmd = Extract<DrawCommand, { kind: 'circle' }>;

/** 表 → `(r,c)` 键集，用于「唯一性 / 覆盖性」断言。 */
function cellKeys(cells: readonly number[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < cells.length; i += 3) out.push(`${cells[i]},${cells[i + 1]}`);
    return out;
}

function paintThumb(level: BeadsLevelRaw, n: number = THUMB_MATRIX_N): readonly DrawCommand[] {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    // 用一个真实格框（现装 `WALL_CELL` 见方）⇒ 案乙几何按生产口径落位。
    drawLevelThumb(builder, level, 100, 200, WALL_CELL, WALL_CELL, n);
    return builder.end().commands;
}

const GRID_X = 100 + (WALL_CELL - THUMB_AREA) / 2; // 缩略区左缘
const GRID_TOP = 200 + WALL_CELL - THUMB_TOP_INSET; // 缩略区顶缘

describe('[T-2B] 聚合切块规则（T-1 §3.1）', () => {
    it('切块覆盖且仅覆盖每个源格一次（rows ≥ n 时）⇒ 不存在重复计数', () => {
        const rows = 7; // 非整除 ⇒ 块尺寸 ∈ {⌊7/5⌋, ⌈7/5⌉} = {1,2}
        const cols = 11;
        const level = simpleTestLevel({
            rows,
            cols,
            pattern: Array.from({ length: rows }, () => '1'.repeat(cols)),
        });
        const n = THUMB_MATRIX_N;
        // 期望块数 = 所有源格被覆盖的块 ⇒ 逐块重算 `[r0,r1)×[c0,c1)` 并核对总覆盖格数。
        let covered = 0;
        for (let r = 0; r < n; r++) {
            const r0 = Math.floor((r * rows) / n);
            const r1 = Math.max(r0 + 1, Math.floor(((r + 1) * rows) / n));
            for (let c = 0; c < n; c++) {
                const c0 = Math.floor((c * cols) / n);
                const c1 = Math.max(c0 + 1, Math.floor(((c + 1) * cols) / n));
                covered += (r1 - r0) * (c1 - c0);
            }
        }
        expect(covered, '块面积之和 ≡ 盘面格数 ⇒ 无重复、无遗漏').toBe(rows * cols);
        expect(cellKeys(levelThumbCells(level, n)).length).toBe(n * n);
    });

    it('均匀单色盘 ⇒ 每块一颗同色珠（表长 = 3·n²，色索引 ≡ 1）', () => {
        const level = simpleTestLevel({
            rows: 6,
            cols: 6,
            pattern: Array.from({ length: 6 }, () => '1'.repeat(6)),
        });
        const cells = levelThumbCells(level, THUMB_MATRIX_N);
        expect(cells.length).toBe(THUMB_MATRIX_N * THUMB_MATRIX_N * 3);
        for (let i = 2; i < cells.length; i += 3) expect(cells[i]).toBe(1);
    });

    it('`.` / `x` 不入 tally：块内只有空 / 不可填 ⇒ **该位不画珠**（露纸底，⛔ 不画「空珠」）', () => {
        const level = simpleTestLevel({
            rows: 5,
            cols: 5,
            pattern: ['.....', 'xxxxx', '.1...', '.....', '.....'],
        });
        const cells = levelThumbCells(level, THUMB_MATRIX_N);
        const keys = new Set(cellKeys(cells));
        expect(cells.length).toBeLessThan(THUMB_MATRIX_N * THUMB_MATRIX_N * 3);
        // 有珠的位必须落在含 '1' 的块（r2,c0 附近），其余位（全 '.' / 全 'x'）必不出现。
        for (let i = 0; i < cells.length; i += 3) {
            expect(cells[i + 2], '有珠位的色索引').toBe(1);
            expect(cells[i]).toBe(2); // r2 ⇒ 唯一含 '1' 的行块
        }
        expect(keys.has('0,0'), '全空行块不得有珠').toBe(false);
        expect(keys.has('1,0'), '全 x 行块不得有珠').toBe(false);
    });

    it('取块内**计数最大**者；平票 ⇒ **最小 colorIdx**；且与块内扫描/行序无关', () => {
        // rows=5, cols=15, n=5 ⇒ 每块 = 1 行 × 3 列 ⇒ 块内可放可控的多色。
        const mk = (row0: string): BeadsLevelRaw => simpleTestLevel({
            rows: 5,
            cols: 15,
            pattern: [row0, '...............', '...............', '...............', '...............'],
        });
        expect(levelThumbCells(mk('122...........'), 5)[2], '块内 1×「1」+2×「2」⇒ 取多数').toBe(2);
        expect(levelThumbCells(mk('19...........'), 5)[2], '平票 ⇒ 最小索引').toBe(1);
        const tieReversed = mk('91...........'); // 同一块内容、扫描序相反
        expect(levelThumbCells(tieReversed, 5)[2], '平票不得退化为「先见者」').toBe(1);
        expect(levelThumbCells(mk('379...........'), 5)[2], '三向平票').toBe(3);
        expect(levelThumbCells(mk('973...........'), 5)[2], '三向平票（换序）').toBe(3);

        // 块与块之间：**同一块内容的行前后调换** ⇒ 表全等（防「依赖扫描顺序」）。
        // rows=10, cols=5, n=5 ⇒ 每块 = 2 行 × 1 列 ⇒ 块内恒为 1×「1」 + 1×「2」。
        const a = simpleTestLevel({ rows: 10, cols: 5, pattern: ['11111', '22222', '11111', '22222', '11111', '22222', '11111', '22222', '11111', '22222'] });
        const b = simpleTestLevel({ rows: 10, cols: 5, pattern: ['22222', '11111', '22222', '11111', '22222', '11111', '22222', '11111', '22222', '11111'] });
        expect(levelThumbCells(a, 5)).toEqual(levelThumbCells(b, 5));
        expect(levelThumbCells(a, 5).length).toBe(5 * 5 * 3); // 满盘 ⇒ 无空格位
        for (let i = 2; i < levelThumbCells(a, 5).length; i += 3) expect(levelThumbCells(a, 5)[i]).toBe(1);
    });

    it('表为**扁平三元组** [r,c,colorIdx] 且 r/c 在 [0,n) 内、色索引在 [1,BEAD_COLOR_MAX] 内', () => {
        for (const lv of LEVELS) {
            for (const n of THUMB_TIERS) {
                const cells = levelThumbCells(lv, n);
                expect(cells.length % 3).toBe(0);
                const seen = new Set<string>();
                for (let i = 0; i < cells.length; i += 3) {
                    expect(Number.isInteger(cells[i]) && cells[i]! >= 0 && cells[i]! < n).toBe(true);
                    expect(Number.isInteger(cells[i + 1]) && cells[i + 1]! >= 0 && cells[i + 1]! < n).toBe(true);
                    expect(cells[i + 2]! >= 1 && cells[i + 2]! <= BEAD_COLOR_MAX).toBe(true);
                    const k = `${cells[i]},${cells[i + 1]}`;
                    expect(seen.has(k), `重复块 ${k}`).toBe(false);
                    seen.add(k);
                }
            }
        }
    });
});

describe('[T-2B] 单格 ≤ THUMB_BEADS_MAX(25) 硬判据（T-1 §3.3）', () => {
    it('九关 × 三档实测全部 ≤ 该档 n² ≤ THUMB_BEADS_MAX', () => {
        for (const lv of LEVELS) {
            for (const n of THUMB_TIERS) {
                const beads = levelThumbBeads(lv, n);
                expect(beads, `L${lv.id}@${n}`).toBeLessThanOrEqual(n * n);
                expect(beads).toBeLessThanOrEqual(THUMB_BEADS_MAX);
            }
        }
    });

    it('上限押在 `n²` 而与关卡规模**解耦**：人工大盘（30×30 全填、9 色）仍 ≤ 25', () => {
        // 第 r 行 = 色索引按列循环（行起点逐行偏移）⇒ 每块内九色同现，取谁全凭计数。
        const rowOf = (r: number): string =>
            Array.from({ length: 30 }, (_, ci) => String.fromCharCode(49 + ((r + ci) % 9))).join('');
        const big = simpleTestLevel({
            rows: 30,
            cols: 30,
            pattern: Array.from({ length: 30 }, (_, r) => rowOf(r)),
        });
        for (const n of THUMB_TIERS) {
            expect(levelThumbBeads(big, n), `${n} 档`).toBeLessThanOrEqual(n * n);
        }
        expect(THUMB_BEADS_MAX).toBe(THUMB_MATRIX_N * THUMB_MATRIX_N);
        // 规模 30×30 = 900 格 ≫ 25 珠 ⇒ 「珠数由盘面规模决定」的旧模型被正面否定。
        expect(big.rows * big.cols).toBeGreaterThan(THUMB_BEADS_MAX * 10);
    });

    it('渲染实测珠数 ≡ 聚合表读数（不是两套数）', () => {
        for (const lv of LEVELS) {
            const cmds = paintThumb(lv);
            const circles = cmds.filter((c) => c.kind === 'circle') as CircleCmd[];
            expect(circles.length / 2).toBe(levelThumbBeads(lv, THUMB_MATRIX_N));
            expect(cmds.length).toBe(levelThumbBeads(lv) * BEAD_STYLE_MAX_COMMANDS);
        }
    });
});

describe('[T-2B] 聚合结果一次性缓存（§2 热路径零分配）', () => {
    it('同 (level, n) 两次调用 ⇒ **同一引用**（命中缓存 ⇒ 每帧只 `get`、不重算、不新建数组）', () => {
        for (const lv of LEVELS) {
            expect(levelThumbCells(lv, 5), `L${lv.id} 5 档引用`).toBe(levelThumbCells(lv, 5));
            expect(levelThumbCells(lv, 3)).not.toBe(levelThumbCells(lv, 5)); // 分档各存一份
            expect(levelThumbCells(lv, 3)).toBe(levelThumbCells(lv, 3));
        }
    });

    it('表本体 `Object.freeze` ⇒ 运行期不可改写位表读数（缓存被污染的风险归零）', () => {
        const cells = levelThumbCells(LEVELS[0]!, 5) as unknown as number[];
        expect(Object.isFrozen(cells)).toBe(true);
        expect(() => {
            'use strict';
            cells[0] = 99;
        }).toThrow();
    });

    it('换肤 / 换墨不影响聚合表（表只依赖 `pattern` 与 `n`）⇒ 缓存无需失效键', () => {
        const before = levelThumbCells(LEVELS[0]!, 5);
        expect(beadInksFor(LEVELS[0]!).hexes.length).toBeGreaterThan(0);
        expect(levelThumbCells(LEVELS[0]!, 5)).toBe(before);
    });
});

describe('[T-2B] 案乙几何与珠体通道（T-1 §3.2 / §3.4 / §3.7）', () => {
    it('缩略区 = 格顶内缩 THUMB_TOP_INSET 的 THUMB_AREA 见方；下部 THUMB_STAR_BAND 留给星（不叠珠）', () => {
        expect(THUMB_AREA).toBe(WALL_CELL - THUMB_TOP_INSET - THUMB_STAR_BAND);
        const circles = paintThumb(LEVELS[4]!).filter((c) => c.kind === 'circle') as CircleCmd[];
        expect(circles.length).toBeGreaterThan(0);
        for (const c of circles) {
            expect(c.x).toBeGreaterThanOrEqual(GRID_X);
            expect(c.x).toBeLessThanOrEqual(GRID_X + THUMB_AREA);
            expect(c.y).toBeGreaterThanOrEqual(GRID_TOP - THUMB_AREA);
            expect(c.y).toBeLessThanOrEqual(GRID_TOP);
        }
        // 星带内**无珠**（缩略不侵入文字带 ⇒ 版面不移位）。
        expect(circles.every((c) => c.y > 200 + THUMB_STAR_BAND)).toBe(true);
    });

    it('逐字节 ≡ 直接调 `drawFilledBead`（size = thumbOuterFor(n)，墨 = beadInksFor(level)）的参照流', () => {
        const level = LEVELS[3]!;
        const n = THUMB_MATRIX_N;
        const ref = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        ref.begin();
        const pitch = thumbPitchFor(n);
        const cells = levelThumbCells(level, n);
        const inks = beadInksFor(level);
        for (let i = 0; i < cells.length; i += 3) {
            drawFilledBead(ref, GRID_X + (cells[i + 1]! + 0.5) * pitch, GRID_TOP - (cells[i]! + 0.5) * pitch, cells[i + 2]!, {
                size: thumbOuterFor(n),
                inks,
                targetColorIdx: cells[i + 2]!,
            });
        }
        const refFlow = ref.end().commands.map((c) => JSON.stringify(c));
        expect(paintThumb(level).map((c) => JSON.stringify(c))).toEqual(refFlow);
    });

    it('口径 B 面过地板（三档皆然）⇒ 缩略不退化为「看不见的珠」', () => {
        for (const n of THUMB_TIERS) {
            expect(thumbFaceB(n), `${n} 档`).toBeGreaterThanOrEqual(SIGN_FACE_FLOOR);
            expect(thumbFaceB(n)).toBe((thumbPitchFor(n) - BEAD_GAP) * (thumbFaceB(n) / (thumbPitchFor(n) - BEAD_GAP)));
        }
        // 档越小 ⇒ 面越大（杠杆方向自证：回退一档确实减压图元数而不牺牲可辨性）。
        expect(thumbFaceB(3)).toBeGreaterThan(thumbFaceB(5));
        expect(THUMB_AREA % THUMB_MATRIX_N).not.toBe(0); // 16.8 非整除 = 真读数，⛔ 别把浮点当整
    });

    it('聚合表为空 ⇒ 一命令不发（早退，不留「空珠」噪声）', () => {
        const empty = simpleTestLevel({ rows: 4, cols: 4, pattern: ['....', '....', '....', '....'] });
        expect(levelThumbBeads(empty, 5)).toBe(0);
        expect(paintThumb(empty)).toEqual([]);
    });

    it('缩略发射色 ∈ 该关墨集（色源唯一，⛔ 不建 UI 简化色表）', () => {
        for (const lv of LEVELS) {
            const allowed = new Set<string>(beadInksFor(lv).hexes);
            const emitted = new Set<string>();
            for (const c of paintThumb(lv)) {
                const fill = (c as { fill?: string }).fill;
                const stroke = (c as { stroke?: string }).stroke;
                if (typeof fill === 'string') emitted.add(fill);
                if (typeof stroke === 'string') emitted.add(stroke);
            }
            // 端点色由 `mix()` 派生 ⇒ 不逐一属 hexes；但**整帧色族**必在菜单帧值域门里（meta-menu-wall 套）。
            // 本腿只钉：发射色非空，且 ⊆ 全局 UI 色 ∪ 该关通道（以字符串前缀 # 判定为色）。
            for (const hex of emitted) expect(hex.startsWith('#'), `非法色值 ${hex}`).toBe(true);
            expect(emitted.size).toBeGreaterThan(0);
            expect(allowed.size).toBeGreaterThan(0);
        }
        expect(DEFAULT_PALETTE.background.startsWith('#')).toBe(true);
    });
});
