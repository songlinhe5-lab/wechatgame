/**
 * WXG-T-266 EP12-S5 起 · 难度主序单一真源 + 守卫；WXG-T-997 换方案 C 离散四档后重锚。
 *
 * 覆盖：验收① 第一章 9 关主序逐值复现 + 结构性脱钩；验收② §7 守卫 G1–G10（纯 Node）。
 * G6 的「可排严格序 + 并列红」判据本体在 `tools/scripts/sync-levels-data.test.mjs`（node --test，
 * 与门禁同侧）；本文件从游戏侧钉住公式真源与其余守卫。
 *
 * ⛔ 旧连续式 `round₁₀(M×fC×fK)` 的九关逐值表（28.7 / 41.0 / …）是**史证**，
 *    留在 `level-difficulty.md §5.1` 不回改；本表是方案 C 的确定性主键，不是难度分数。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIFFICULTY, DIFFICULTY_TIERS } from '../src/config/tuning.js';
import { ARCS } from '../src/config/arcs.js';
import { difficultyOf } from '../src/game/difficulty.js';
import { measuredLevelTime } from '../src/game/level-import.js';

const at = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const SINGLES = at('../design/levels/singles');

/** 方案 C 主序主键逐值（WXG-T-997 重锚，由 `difficultyOf` 真源实测）。
 *  形态 = tier×1e12 + N×1e8 + C×1e4 + G(12)；⛔ 不是旧 DI 分数，不回改 §5.1 史证表。 */
const EXPECT_DI: Record<number, number> = {
    1: 10200030008, 2: 8800040011, 3: 10800030009, 4: 12200040013, 5: 12700040014,
    6: 10200030011, 7: 2006000060011, 8: 11200030012, 9: 2044800060041,
};
interface PoolLevel {
    id: number;
    di: number;
    steps: number;
    res: ReturnType<typeof difficultyOf>;
}
/**
 * §5.1/§5.2 两张表的射程 = **第一章（曼陀罗）关卡清单**，不是目录全量。
 * WXG-T-341 v1.21 起真源目录多了第二大关（照片验证 boss `L00010`）⇒ 旧「扫 singles/」写法
 * 会把表外关拉进池 ⇒ 逐值 / 九关墙序断言同时假红。改由 `ARCS[0].levelRefs` 取数。
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

describe('方案 C · 验收① 第一章 9 关主序逐值复现', () => {
    it('9 关主序与重锚表逐值相等（旧 A/K/fC/fK 仍三位，主键为整数）', () => {
        // 逐值差异先收集再一次性断言：`expect` 首条失败即抛出，会遮蔽其后各关的漂移
        // （WXG-T-370 实测：表只报了 L3，L4/L9 同样不符却看不见）。
        const drift: string[] = [];
        for (const p of pool) {
            if (p.di !== EXPECT_DI[p.id]) drift.push(`L${p.id} di=${p.di} ≠ 重锚表 ${EXPECT_DI[p.id]}`);
            expect(is3(p.res.a)).toBe(true);
            expect(is3(p.res.k)).toBe(true);
            expect(is3(p.res.fC)).toBe(true);
            expect(is3(p.res.fK)).toBe(true);
            expect(Number.isInteger(p.di)).toBe(true);
            expect(is1(p.di)).toBe(true);
        }
        expect(drift).toEqual([]);
    });

    it('主序升序序列 = L2→L1→L6→L3→L8→L4→L5→L7→L9（分析参照，非运行时墙序）', () => {
        const order = [...pool].sort((a, b) => a.di - b.di || a.id - b.id).map((p) => p.id);
        expect(order).toEqual([2, 1, 6, 3, 8, 4, 5, 7, 9]);
    });

    it('主序与 steps 脱钩：手改 steps 逐位不变，秩相关不得退化为同轴（⛔ 不改判据凑绿）', () => {
        // 旧断言 Spearman = 0.95 是旧连续式对定价 steps 的拟合读数。新主序不含 steps，
        // 再钉任一数值等于把「拟合优度」伪装成验收判据（§7 判据 3：只验方向与自洽，不验手感）。
        const lv = JSON.parse(readFileSync(join(SINGLES, 'L00005.json'), 'utf8'));
        const perturbed = { ...lv, pricing: { ...lv.pricing, steps: lv.pricing.steps + 7 } };
        expect(difficultyOf(perturbed).di).toBe(difficultyOf(lv).di);
        expect(difficultyOf(perturbed).tier).toBe(difficultyOf(lv).tier);

        const bySteps = [...pool].sort((a, b) => a.steps - b.steps || a.id - b.id);
        const stepRank = new Map<number, number>();
        bySteps.forEach((p, i) => stepRank.set(p.id, i + 1));
        const byDi = [...pool].sort((a, b) => a.di - b.di || a.id - b.id);
        const d2 = byDi.reduce((s, p, i) => s + (i + 1 - stepRank.get(p.id)!) ** 2, 0);
        const n = pool.length;
        const rho = 1 - (6 * d2) / (n * (n * n - 1));
        expect(Number.isFinite(rho)).toBe(true);
        expect(rho).not.toBe(1); // 主序不是 steps 的复制品
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
        expect(readFileSync(at('../src/config/tuning/gameplay.ts'), 'utf8')).toMatch(/DIFFICULTY = Object\.freeze\(/); // 唯一定义位
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

    it('G9′ 主序先验可复算：di = tier×1e12 + N×1e8 + C×1e4 + G(12)，且不等于旧连续式', () => {
        for (const p of pool) {
            const r = p.res;
            expect(r.di).toBe(
                r.tier * DIFFICULTY_TIERS.KEY_TIER
                + r.n * DIFFICULTY_TIERS.KEY_N
                + r.c * DIFFICULTY_TIERS.KEY_C
                + r.g[0],
            );
            // 旧式 round₁₀(M×fC×fK) 已退居史证读数，不得再等于主序。
            expect(r.di).not.toBe(Math.round(r.m * r.fC * r.fK * 10) / 10);
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

// ── 方案 C：离散四档 + G(12) 修正（阶段 0 裁定 §6.1；落码单 WXG-T-997）──────────
// 史证：原 §5.1 九关 DI 逐值表是旧连续公式的产物，本节只验新体系的结构性质，
// 不拿新主序去凑旧读数；旧表在 GREEN 后按 §5 重锚顺序重锚。
describe('方案 C · 离散四档主序', () => {
    it('N 跨 150/300/700 边界时 tier 依次为 0/1/2/3（无错位初盘 ⇒ G 修正不启用）', () => {
        const tierOf = (n: number) => difficultyOf({ pattern: ['1'.repeat(n)] }).tier;
        expect([100, 200, 400, 800].map(tierOf)).toEqual([0, 1, 2, 3]);
    });

    it('四档标签对外可读：tier 与中文 label 一一对应', () => {
        const labels = [100, 200, 400, 800].map(
            (n) => difficultyOf({ pattern: ['1'.repeat(n)] }).label,
        );
        expect(labels).toEqual(['简单', '中等', '难', '超难']);
    });

    it('C ≥ 6 在 N 档上再升一档（高色数轴）', () => {
        const low = difficultyOf({ pattern: ['1'.repeat(100)] });
        const high = difficultyOf({ pattern: ['123456'.repeat(16) + '1234'] });
        expect(high.n).toBe(low.n);
        expect(high.c).toBe(6);
        expect(high.tier).toBe(low.tier + 1);
    });

    it('G(12) 修正：碎成单珠块升一档、整两大块降一档（各至多一次）', () => {
        const plain = difficultyOf({ pattern: ['1'.repeat(100)] });
        const fragmented = difficultyOf({
            pattern: ['12'.repeat(50)],
            misplaced: ['21'.repeat(50)],
        });
        expect(fragmented.n).toBe(plain.n);
        expect(fragmented.tier).toBe(plain.tier + 1);

        const plainMid = difficultyOf({ pattern: ['1'.repeat(200)] });
        const coarse = difficultyOf({
            pattern: ['1'.repeat(100) + '2'.repeat(100)],
            misplaced: ['2'.repeat(100) + '1'.repeat(100)],
        });
        expect(coarse.n).toBe(plainMid.n);
        expect(coarse.tier).toBe(plainMid.tier - 1);
    });

    it('G(T) 对 12→24→48 槽单调不增（主序锁 12，后两档只作参考）', () => {
        for (const p of pool) {
            expect(p.res.g[0]).toBeGreaterThanOrEqual(p.res.g[1]);
            expect(p.res.g[1]).toBeGreaterThanOrEqual(p.res.g[2]);
        }
    });

    it('现池主序无并列：L00001 与 L00006 的 N/C 相同，靠 G(12) 消歧', () => {
        expect(new Set(pool.map((p) => p.di)).size).toBe(pool.length);
        const l1 = pool.find((p) => p.id === 1)!;
        const l6 = pool.find((p) => p.id === 6)!;
        expect([l1.res.n, l1.res.c]).toEqual([l6.res.n, l6.res.c]);
        expect(l1.res.g[0]).not.toBe(l6.res.g[0]);
    });
});

// ── 章末 BOSS 难度闸（用户 2026-11-24 裁定，WXG-T-1050）──────────────────────
// 「A00 关 boss 不用太难，从 A01 开始要严格卡难度」⇒ A00（L00009）豁免超难硬闸，
// A01 起每章末关必须档 3「超难」。这里只做准入守卫，不改任何盘面 / 阈值。
describe('章末 BOSS 难度闸 · A00 豁免 / A01 起必须超难', () => {
    const all = new Map<number, ReturnType<typeof difficultyOf>>();
    for (const f of readdirSync(SINGLES).filter((f) => f.endsWith('.json'))) {
        const lv = JSON.parse(readFileSync(join(SINGLES, f), 'utf8'));
        all.set(lv.id, difficultyOf(lv));
    }
    const lastIdOf = (arc: (typeof ARCS)[number]) => Math.max(
        ...arc.levelRefs.flatMap(([from, to]) =>
            Array.from({ length: to - from + 1 }, (_, i) => from + i)),
    );

    it('A01 起章末 BOSS 逐章档 3（超难）', () => {
        const drift: string[] = [];
        for (const arc of ARCS.slice(1)) {
            const bossId = lastIdOf(arc);
            const res = all.get(bossId);
            if (!res) drift.push(`${arc.id} 章末 L${bossId} 缺失`);
            else if (res.tier !== 3) drift.push(`${arc.id} 章末 L${bossId} tier=${res.tier}（${res.label}），应超难`);
        }
        expect(drift).toEqual([]);
    });

    it('A00 章末 BOSS 按裁定保持宽松（tier < 3）', () => {
        expect(all.get(lastIdOf(ARCS[0]!))!.tier).toBeLessThan(3);
    });
});
