/**
 * WXG-T-266 EP12-S5 · 难度分 `DI` 单一真源 + 守卫（正本 = level-difficulty.md §3/§5/§7）。
 *
 * 覆盖：验收① §5 **第一章** 9 关逐值复现 + Spearman 0.833；验收② §7 守卫 G1–G10（纯 Node）。
 * G6 的「可排严格序 + 并列红」判据本体在 `tools/scripts/sync-levels-data.test.mjs`（node --test，
 * 与门禁同侧）；本文件从游戏侧钉住公式真源与其余守卫。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIFFICULTY } from '../src/config/tuning.js';
import { ARCS } from '../src/config/arcs.js';
import { difficultyOf } from '../src/game/difficulty.js';
import { measuredLevelTime } from '../src/game/level-import.js';

const at = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const SINGLES = at('../design/levels/singles');

/** §5.1 实测表：DI 逐值 + steps（bot 动作数，dev-only 不进产物，故从真源 JSON 读）。
 *  2026-10-24 WXG-T-374 全池重测：L3 73.7→42.2（换盘后读数）、L4 66.8→59.5（A 案换图）、L9 289.7→426.7（30×30 重建）。
 *  2026-10-24 WXG-T-376 只重出 L1：31.8→28.7（图案 4 行重排 ⇒ M 102→92、steps 10→27）；
 *  连带 DI 升序首关由 L6 变 L1、Spearman 0.867→0.833（Σd² 16→20）。*/
const EXPECT_DI: Record<number, number> = {
    1: 28.7, 2: 41.0, 3: 42.2, 4: 59.5, 5: 43.7, 6: 29.9, 7: 76.8, 8: 36.4, 9: 426.7,
};
interface PoolLevel {
    id: number;
    di: number;
    steps: number;
    res: ReturnType<typeof difficultyOf>;
}
/**
 * §5.1/§5.2 两张表的射程 = **第一章（曼陀罗）关卡清单**，不是目录全量。
 * WXG-T-341 v1.21 起真源目录多了第二大关（照片验证 boss `L00010`，DI 796.3）⇒ 旧「扫 singles/」写法
 * 会把表外关拉进池 ⇒ 三条断言（逐值 / 九关墙序 / Spearman）同时假红。改由 `ARCS[0].levelRefs` 取数。
 */
const ARC1_IDS = new Set<number>();
for (const [from, to] of ARCS[0].levelRefs) {
    for (let i = from; i <= to; i += 1) ARC1_IDS.add(i);
}
const pool: PoolLevel[] = readdirSync(SINGLES)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(SINGLES, f), 'utf8')))
    .filter((lv) => ARC1_IDS.has(lv.id))
    .map((lv) => ({ id: lv.id, di: difficultyOf(lv).di, steps: lv.pricing.steps as number, res: difficultyOf(lv) }))
    .sort((a, b) => a.id - b.id);

const is3 = (x: number) => x === Math.round(x * 1000) / 1000;
const is1 = (x: number) => x === Math.round(x * 10) / 10;

describe('EP12-S5 · 验收① §5 第一章 9 关逐值复现', () => {
    it('9 关 DI 与 §5.1 表逐值相等（含中间量 A/K/fC/fK）', () => {
        // 逐值差异先收集再一次性断言：`expect` 首条失败即抛出，会遮蔽其后各关的漂移
        // （WXG-T-370 实测：表只报了 L3，L4/L9 同样不符却看不见）。
        const drift: string[] = [];
        for (const p of pool) {
            if (p.di !== EXPECT_DI[p.id]) drift.push(`L${p.id} DI=${p.di} ≠ §5.1 表 ${EXPECT_DI[p.id]}`);
            // 前置取整必要：因子必须三位，DI 一位（否则跨端漂移，§3.2）。
            expect(is3(p.res.a)).toBe(true);
            expect(is3(p.res.k)).toBe(true);
            expect(is3(p.res.fC)).toBe(true);
            expect(is3(p.res.fK)).toBe(true);
            expect(is1(p.di)).toBe(true);
        }
        expect(drift).toEqual([]);
    });

    it('DI 升序序列 = §5.2 表 L1→L6→L8→L2→L3→L5→L4→L7→L9（分析参照，非运行时墙序）', () => {
        const order = [...pool].sort((a, b) => a.di - b.di || a.id - b.id).map((p) => p.id);
        expect(order).toEqual([1, 6, 8, 2, 3, 5, 4, 7, 9]);
    });

    it('Spearman(DI 序, steps 序) = 0.833（doc 平局按关号升序破，与 §5.2 步序列一致）', () => {
        // steps 秩：升序、平局按关号升序赋不同秩（现池 steps 全互异 ⇒ 平局臂不可达），复刻 §5.2「steps 序」列。
        const bySteps = [...pool].sort((a, b) => a.steps - b.steps || a.id - b.id);
        const stepRank = new Map<number, number>();
        bySteps.forEach((p, i) => stepRank.set(p.id, i + 1));
        const byDi = [...pool].sort((a, b) => a.di - b.di || a.id - b.id);
        const d2 = byDi.reduce((s, p, i) => s + (i + 1 - stepRank.get(p.id)!) ** 2, 0);
        const n = pool.length;
        const rho = 1 - (6 * d2) / (n * (n * n - 1));
        expect(Math.round(rho * 1000) / 1000).toBe(0.833);
    });
});

describe('EP12-S5 · §7 守卫', () => {
    it('G1 单一真源：difficultyOf/系数 定义仅一处，其余 src/tools 无第二份副本', () => {
        const roots = [at('../src'), at('../../../tools/scripts')];
        const hits: { file: string; what: string }[] = [];
        const walk = (d: string) => {
            for (const e of readdirSync(d)) {
                if (e.startsWith('.')) continue;
                const fp = join(d, e);
                if (statSync(fp).isDirectory()) walk(fp);
                else if (/\.(ts|mjs)$/.test(e)) {
                    const src = readFileSync(fp, 'utf8');
                    if (/export function difficultyOf\b/.test(src)) hits.push({ file: fp, what: 'difficultyOf' });
                    // 系数标识（非 DIFFICULTY. 引用、非 tuning 定义）= 第二真源嫌疑。
                    const localCoef = new RegExp(`\\b(?:const|let|var)\\s+(?:c_C|c_K|C_REF|K_REF|FK_FLOOR|FC_LO|FC_HI)\\b`).test(src);
                    if (localCoef) hits.push({ file: fp, what: 'coef-decl' });
                }
            }
        };
        roots.forEach(walk);
        expect(hits.filter((h) => h.what === 'difficultyOf').length).toBe(1); // only difficulty.ts
        expect(hits.filter((h) => h.what === 'coef-decl').length).toBe(0); // coefficients never re-declared
        expect(readFileSync(at('../src/config/tuning.ts'), 'utf8')).toMatch(/DIFFICULTY = Object\.freeze\(/); // 唯一定义位
    });

    it('G2 确定性零 RNG：同输入两次逐位相等 + 实现内无 Math.random/services.rng', () => {
        const lv = JSON.parse(readFileSync(join(SINGLES, 'L00005.json'), 'utf8'));
        expect(difficultyOf(lv)).toEqual(difficultyOf(lv));
        const src = readFileSync(at('../src/game/difficulty.ts'), 'utf8');
        expect(src).not.toMatch(/Math\.random|services\.rng|createRng/);
    });

    it('G3 取整口径：DI 一位、A/K/fC/fK 三位（全池）', () => {
        for (const p of pool) {
            expect(is1(p.di)).toBe(true);
            expect(is3(p.res.a) && is3(p.res.k) && is3(p.res.fC) && is3(p.res.fK)).toBe(true);
        }
    });

    it('G4 钳位可达 + 现池无一关触发钳位（无退化腿，H-2）', () => {
        for (const p of pool) {
            expect(p.res.fK).toBeGreaterThanOrEqual(DIFFICULTY.FK_FLOOR);
            expect(p.res.fC).toBeGreaterThanOrEqual(DIFFICULTY.FC_LO);
            expect(p.res.fC).toBeLessThanOrEqual(DIFFICULTY.FC_HI);
            // 现池无一触界 ⇒ 没有任何 DI 是靠钳位兜住的
            expect(p.res.fC).not.toBe(DIFFICULTY.FC_LO);
            expect(p.res.fC).not.toBe(DIFFICULTY.FC_HI);
            expect(p.res.fK).not.toBe(DIFFICULTY.FK_FLOOR);
        }
        // 钳位确实可达（合成极值）：C=1 纯色聚块 ⇒ f_C=FC_LO 且 K=0 ⇒ f_K=FK_FLOOR。
        const oneColor = { pattern: ['11', '11'], misplaced: ['11', '11'] };
        expect(difficultyOf(oneColor).fC).toBe(DIFFICULTY.FC_LO);
        expect(difficultyOf(oneColor).fK).toBe(DIFFICULTY.FK_FLOOR);
        // 高色数触顶（C≥15 ⇒ FC_HI）。
        const wide = '123456789ABCDEFGHIJ'; // 19 色
        expect(difficultyOf({ pattern: [wide], misplaced: [wide] }).fC).toBe(DIFFICULTY.FC_HI);
    });

    it('G5 陈列序单调：DI 升序即严格递增（无并列）；反例=强行 ID 序不单调', () => {
        const asc = [...pool].sort((a, b) => a.di - b.di).map((p) => p.di);
        for (let i = 1; i < asc.length; i++) expect(asc[i]).toBeGreaterThan(asc[i - 1]!);
        // 反例：按关号序取 DI 不单调（L9=538 若在首位则红）⇒ 证明陈列序必须按 DI 排。
        const byId = pool.map((p) => p.di);
        expect(byId.some((v, i) => i > 0 && v <= byId[i - 1]!)).toBe(true);
    });

    it('G7 与定价解耦：difficultyOf 不产 time，DI 变动不回写 measuredLevelTime', () => {
        for (const p of pool) {
            expect(p.res).not.toHaveProperty('time'); // 难度真源不含时长字段
        }
        // 定价只走实测 steps × SEC_PER_STEP（§1.2），与 DI 无函数依赖：改 DI 计算不影响 time。
        const t = measuredLevelTime(pool[0]!.steps).time;
        expect(t).toBe(measuredLevelTime(pool[0]!.steps).time); // 稳定
        expect(pool.some((p) => 'time' in p.res)).toBe(false);
    });

    it('G9 反解自洽：由 (fC,fK) 反解 M 回算 DI，误差 ≤ 0.5×ΔDI(默认 45)（非钳位档）', () => {
        const DI_STEP = 45; // 生成器默认（§4.2，Q6 已裁；仅测试内用，不进门禁）
        for (const p of pool) {
            const m2 = p.di / (p.res.fC * p.res.fK); // ρ=1 ⇒ N=M
            expect(Math.abs(m2 - p.res.m)).toBeLessThanOrEqual(0.5 * DI_STEP);
            // 且正向回算逐位自洽：round₁₀(M×fC×fK) === di
            expect(Math.round(p.res.m * p.res.fC * p.res.fK * 10) / 10).toBe(p.di);
        }
    });

    it('G10 双轨解耦：DI 侧只锁序（零 DI 数值阈值）；工作量数值闸走 steps 且真源住 tuning', () => {
        const gate = readFileSync(at('../../../tools/scripts/sync-levels-data.mjs'), 'utf8');
        // DI 侧依旧禁任何公差/阈值参数（⑥ 只锁序）——换盘后「DI 不够估工」的硬约束不松。
        expect(gate).not.toMatch(/di_start|di_step|DI_START|DI_STEP|ΔDI|DI_FLOOR|DI_STEP_MIN/);
        const difficultySrc = readFileSync(at('../src/game/difficulty.ts'), 'utf8');
        expect(difficultySrc).not.toMatch(/DI_FLOOR|DI_STEP_MIN|di_start|di_step/);
        // 门禁⑦（工作量闸）：2026-10-10 用户裁定推翻原 Q7=③「全仓无数值阈值」的**一部分**——
        // 只解禁 steps 绝对区间，DI 仍只锁序；且区间真源住 tuning.ts，gate 只引用不写死。
        expect(gate).toMatch(/checkStepsGate|assertStepsGate/);
        expect(gate).not.toMatch(/NORMAL_STEPS_MIN\s*=\s*\d/); // gate 内不硬编字面值（读 t.NORMAL_STEPS_MIN）
    });
});
