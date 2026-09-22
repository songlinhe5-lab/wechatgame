import { describe, expect, it } from 'vitest';
import {
    boardStats,
    draftToLevel,
    estimateLevelTime,
    fetchResults,
    importLatest,
    measuredLevelTime,
    studioUrl,
    type LevelDraft,
} from '../src/game/level-import.js';
import { DEMO_LEVEL_COUNT, LEVEL_TIME_MAX, LEVEL_TIME_MIN } from '../src/config/tuning.js';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';
import { createBeadsShell } from '../src/game/beads-shell.js';

/**
 * WXG-T-179 续作 · beads-studio 在线导入（`src/game/level-import.ts`）。
 *
 * 判据点：转换**不得放宽 BOOT 校验**（草案不合规 ⇒ 只回错误、不产关卡），
 * `time: null` 按静态兜底补齐，以及 `play.importLevel` 追加进表 + 跳关。
 */

const SWAPS = [
    [0, 0, 0, 1],
    [1, 0, 1, 1],
    [2, 0, 2, 1],
] as const;

function draftOf(over: Partial<LevelDraft> = {}): LevelDraft {
    const lv = simpleTestLevel();
    return {
        cols: lv.cols,
        rows: lv.rows,
        time: null,
        decoys: [],
        swaps: SWAPS.map((s) => [...s]) as unknown as LevelDraft['swaps'],
        pattern: lv.pattern,
        ...over,
    };
}

describe('WXG-T-179 · level-import 转换与定价', () => {
    it('measuredLevelTime：实测点击数 × SEC_PER_TAP（公式 v0.2，§3.5 v1.41）—— 锚值 / clamp / 非法输入', () => {
        // 锚：已入库关 studio-5-8b07（17×15）真引擎实测 109 taps × 3.6s = 392s
        //（v0.1 按颗定价给的是触顶 420s ⇒ D100 饱和）。
        // ⚠️ difficulty 的分母 = `LEVEL_TIME_MAX`（**v1.47 顶值 420 → 2500** ⇒ 同一盘 D 从 93 变 16，
        //   D 不可跨档比较，见 levels-spec §5.0 版本表 v0.2.1）；改顶值时本锚点需同步重算。
        expect(measuredLevelTime(109)).toEqual({ time: 392, difficulty: 16 });
        expect(measuredLevelTime(10).time).toBe(LEVEL_TIME_MIN); // 36s ⇒ 钳到下限
        expect(measuredLevelTime(1000).time).toBe(LEVEL_TIME_MAX); // 3600s ⇒ 钳到上限
        // 非法输入 ⇒ 0 taps ⇒ 下限（不产生 NaN 倒计时：NaN 永不到零 = 失败条件永不触发）
        expect(measuredLevelTime(Number.NaN).time).toBe(LEVEL_TIME_MIN);
        expect(measuredLevelTime(-5).time).toBe(LEVEL_TIME_MIN);
    });

    it('estimateLevelTime（静态兜底）= ceil(M/2) taps，与实测共用 clamp 出口；N/C/A 不再影响时长', () => {
        const a = estimateLevelTime({ fillable: 200, colors: 3, adjRate: 0.5, misplaced: 8 });
        // v0.1 的三因子（f_N/f_C/g_A）已作废：同 M 不同 N/C/A ⇒ 同时长
        expect(estimateLevelTime({ fillable: 900, colors: 10, adjRate: 0.0, misplaced: 8 })).toEqual(a);
        expect(a).toEqual(measuredLevelTime(4)); // ceil(8/2) = 4 taps
        // 钳到上限需 taps × 3.6 > LEVEL_TIME_MAX（现 2500 ⇒ >694 taps）：M=2000 ⇒ ceil(1000) taps ⇒ 3600s
        expect(estimateLevelTime({ fillable: 200, colors: 3, adjRate: 0.5, misplaced: 2000 }).time).toBe(LEVEL_TIME_MAX);
    });

    it('合法草案 + time=null ⇒ 过关并自动按静态兜底补时长（错位 = 2k 颗）', () => {
        const r = draftToLevel(draftOf(), 9000, '在线导入 x');
        expect(r.errors).toEqual([]);
        expect(r.ok).toBe(true);
        expect(r.level!.time).toBe(estimateLevelTime(boardStats(draftOf().pattern, SWAPS.length * 2)).time);
        expect(r.level!.swaps.length).toBe(3);
    });

    it('草案自报 cycleProfile="long" ⇒ 转换层不信，仍产 short（防生成器旧漂移：交换法恒为 2-环）', () => {
        const lying = { ...draftOf(), cycleProfile: 'long' } as unknown as LevelDraft;
        const r = draftToLevel(lying, 9003, 'lying');
        expect(r.ok).toBe(true);
        expect(r.level!.cycleProfile).toBe('short');
    });

    it('草案带 misplaced（全错位初盘）⇒ 原样透传；引擎优先读它，不受 k≤8 约束', () => {
        const pattern = ['123123', '123123', '123123', '123123', '123123'];
        const misplaced = ['312312', '312312', '312312', '312312', '312312']; // 逐格错开、每色守恒
        const r = draftToLevel(
            { cols: 6, rows: 5, time: null, pattern, swaps: [], misplaced } as unknown as LevelDraft,
            9100, '全错位',
        );
        expect(r.errors).toEqual([]);
        expect(r.level!.misplaced).toEqual(misplaced);
        expect(r.level!.swaps.length).toBe(0);
    });

    it('不合规草案（两色 < 3）⇒ 只回错误、不产关卡（不放宽 BOOT 口径）', () => {
        const bad = draftOf({ pattern: ['121212', '212121', '121212', '212121', '121212'] });
        const r = draftToLevel(bad, 9001, 'bad');
        expect(r.ok).toBe(false);
        expect(r.level).toBeUndefined();
        expect(r.errors.join(' ')).toContain('colour count');
    });

    it('swaps 超 MISPLACED_PAIRS_MAX(8) ⇒ 校验拒绝', () => {
        const many: (readonly [number, number, number, number])[] = [];
        for (let r = 0; r < 5 && many.length < 9; r++) {
            for (let c = 0; c < 3 && many.length < 9; c++) many.push([r, c, r, c + 3]);
        }
        expect(many.length).toBe(9);
        const res = draftToLevel(draftOf({ swaps: many }), 9002, 'many');
        expect(res.ok).toBe(false);
        expect(res.errors.length).toBeGreaterThan(0);
    });

    it('studioUrl：尾斜杠去重', () => {
        expect(studioUrl('http://h:8787/', '/api/results')).toBe('http://h:8787/api/results');
    });

    it('fetchResults / importLatest 走注入式 HTTP（不碰平台 API）', async () => {
        const calls: string[] = [];
        const get = async (url: string): Promise<unknown> => {
            calls.push(url);
            if (url.endsWith('/api/results')) return { results: [{ id: 'small14-1' }, { id: 'small14-2' }] };
            return draftOf();
        };
        const list = await fetchResults('http://h:8787', get);
        expect(list.map((r) => r.id)).toEqual(['small14-1', 'small14-2']);
        const r = await importLatest('http://h:8787', get);
        expect(r.ok).toBe(true);
        expect(calls[calls.length - 1]).toBe('http://h:8787/api/results/small14-1/level'); // 取最新一条
    });

    it('服务空列表 ⇒ 明确错误文案，不抛异常', async () => {
        const r = await importLatest('http://h:8787', async () => ({ results: [] }));
        expect(r.ok).toBe(false);
        expect(r.errors[0]).toContain('无已存结果');
    });

    it('列表首条不可入关（参考图/实验残品）⇒ 跳过它，取下一条可入关的', async () => {
        const got: string[] = [];
        const r = await importLatest('http://h:8787', async (url) => {
            if (url.endsWith('/api/results')) {
                return { results: [{ id: 'junk', importable: false }, { id: 'good', importable: true }] };
            }
            got.push(url);
            return draftOf();
        });
        expect(r.ok).toBe(true);
        expect(got[0]).toBe('http://h:8787/api/results/good/level');
    });

    it('列表非空但全部不可入关 ⇒ 报“均不可入关”，不去碰 /level', async () => {
        const r = await importLatest('http://h:8787', async () => ({
            results: [{ id: 'a', importable: false }, { id: 'b', importable: false }],
        }));
        expect(r.ok).toBe(false);
        expect(r.errors[0]).toContain('均不可入关');
    });

    it('服务端 422（不可入关产物）⇒ 原因原样透传，不降级成「无 levelDraft」', async () => {
        const why = '该结果不可入关：色板为 artkal（非游戏 10 色真源）⇒ 导入会静默换色';
        const r = await importLatest('http://h:8787', async (url) =>
            url.endsWith('/level') ? { error: why, blockers: [why] } : { results: [{ id: 'bad-1' }] });
        expect(r.ok).toBe(false);
        expect(r.errors[0]).toBe(why);
    });
});

describe('WXG-T-179 · BeadsGame.importLevel 追加进表并入局', () => {
    it('校验通过 ⇒ 关表 +1、跳到新关；不通过 ⇒ 关表不变', () => {
        const h = createBeadsHarness({ seed: 'import-seed', levels: [simpleTestLevel()] });
        const game = h.game;
        expect(game.levelCount).toBe(1);

        const errs = game.importLevel(simpleTestLevel({ id: 950 }));
        expect(errs).toEqual([]);
        expect(game.levelCount).toBe(2);
        expect(game.levelIndex).toBe(1);
        expect(game.grid.cols).toBe(6);

        const before = game.levelCount;
        const bad = game.importLevel(simpleTestLevel({ id: 951, pattern: ['111111', '111111', '111111', '111111', '111111'] }));
        expect(bad.length).toBeGreaterThan(0);
        expect(game.levelCount).toBe(before); // 失败不留半截关卡
    });
});

describe('WXG-T-179 · 主菜单「导入」钮接线（beads-shell）', () => {
    it('配了 studio ⇒ 设置页可点「导入」；拉列表成功即入局；未配则空响', async () => {
        const shell = createBeadsShell({
            clock: () => 0,
            initialScreen: 'menu',
            studio: { baseUrl: 'http://h:8787', get: async (url: string) => (url.endsWith('/level') ? draftOf() : { results: [{ id: 'x' }] }) },
        });
        const { metaLayout } = await import('../src/view/meta-view.js');
        const btn = metaLayout('settings').buttons.find((b) => b.id === 'studio-import')!;
        const cx = btn.box.x + btn.box.w / 2;
        const cy = btn.box.y + btn.box.h / 2;

        // 菜单层没这颗钮 ⇒ 不命中、不入局（入口只存在于设置页）。
        expect(shell.tapMeta(cx, cy)).toBe(false);

        const open = metaLayout('none').buttons.find((b) => b.id === 'open-settings')!;
        expect(shell.tapMeta(open.box.x + open.box.w / 2, open.box.y + open.box.h / 2)).toBe(true);
        expect(shell.overlay).toBe('settings');
        expect(shell.tapMeta(cx, cy)).toBe(true);
        await new Promise((r) => setTimeout(r, 0)); // 拉取为微任务
        expect(shell.screen).toBe('play');
        expect(shell.play.levelCount).toBe(DEMO_LEVEL_COUNT + 1); // 全部真源关 + 1 导入关
    });
});
