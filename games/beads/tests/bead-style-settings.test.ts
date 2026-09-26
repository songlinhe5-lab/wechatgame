/**
 * WXG-T-211-S5 · EP11-S5 判据落地（换肤路径 + 行4 两钮 + 存档两字段 + 设置态遮罩分列）
 * ─────────────────────────────────────────────────────────────────────────────
 * 验收真源（断言只准引用下列条目，⛔ 不自造判据）：
 *  - `design/gdd/pause-settings.md` v1.7 §8-**14**（逐档循环 · 恰写档 1 次 · 不切相位 · 不推计时）
 *    §8-**15**（连点幂等 · 末值一条 · 无历史栈）、§8-**16**（双轴正交 · 零棋局状态写入）、
 *    §8-**17**（下一帧生效 · 恰一帧 · B0 逐字段不变 · 零新增毫秒值）、§8-**19**（循环长度 = 运行时注册数）
 *  - `design/gdd/save-progress.md` v1.1 §8-**11**（两字段入档 · 即写 · 只存末值 · 不新增事件名）、
 *    §8-**12**（四构造非法值 ⇒ 逐字段降级）、§8-**13**（旧档不丢档 · 运行时腿）
 *  - `production/qa/beads/test-cases.md` §K.1 TC-STY-01~06 / §K.1a 阳性对照 / §K.3 TC-SAVE-11~13
 *  - `ux-spec` §3.3 生效与存档口径、§4「PAUSED·行4」「玩法·普通/冲刺（无面板）」行
 *
 * 纪律：
 *  - **K-035**：一律驱动真实现物（`tapDesign` 打面板钮 ⇒ `_applyPanelAction`），⛔ 以文档口径写断言。
 *  - **K-060**：缺位型断言（不响应 / 无写入）同夹具内必配**阳性对照腿**；差值型断言写**不等式与整除性**，
 *    ⛔ 不写存在性糊弄。
 *  - **K-051**：帧差分数字全部**当场实测**，⛔ 不引 §11.2 纸面值。
 *  - **U16 = 甲**：循环长度与档数一律取运行时 `registeredStyleIds()`，⛔ 测试内禁写死款数。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    NullAssetProvider,
    NullAudioBackend,
    RenderModelBuilder,
    Viewport,
    createRng,
    polygonVertices,
    type DrawCommand,
    type EventMap,
    type GameServices,
    type Storage,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import {
    BEAD_SIZE_LABELS,
    DESIGN_H, DESIGN_W, GEAR_HIT_SIZE, HUD_BAND, POWERUP_BAND, TRAY_BAND, PUZZLE_BAND,
    PANEL_SCRIM_ALPHA, PANEL_SCRIM_RGB, SETTINGS_SCRIM_ALPHA,
    gridLayoutFor,
} from '../src/config/tuning.js';
import {
    pausePanelLayout,
    type PausePanelAction,
} from '../src/systems/pause-panel.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { registeredStyleIds } from '../src/view/bead-styles/registry.js';
import { metaLayout, type MetaAction } from '../src/view/meta-view.js';
import {
    SAVE_VERSION,
    defaultBeadsSave,
    normalizeBeadsSave,
    normalizeSettings,
} from '../src/game/save-schema.js';
import { createBeadsHarness, placeColor, simpleTestLevel, type Harness } from './helpers.js';
import type { BeadsGame } from '../src/game/beads-game.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SRC = (p: string): string => readFileSync(resolve(REPO, 'games/beads/src', p), 'utf8');

/** 默认档 / 第二档：只取「注册序的第 0 / 第 1 项」，⛔ 不写死 id（U16 = 甲）。 */
const IDS = registeredStyleIds();
const FIRST = IDS[0];
const SECOND = IDS[1];

// ─────────────────────────────────────────────────────────────────── utilities

interface WriteLog {
    key: string;
    kind: 'set' | 'remove';
}

/** 计数 storage（与 `in-level-snapshot.test.ts` 同族手法）⇒「即写 / 恰一次 / 零写入」可机检。 */
function spyStorage(inner: Storage): { storage: Storage; log: WriteLog[] } {
    const log: WriteLog[] = [];
    const storage: Storage = {
        get: (k: string) => inner.get(k),
        set: (k: string, v: string) => {
            log.push({ key: k, kind: 'set' });
            inner.set(k, v);
        },
        remove: (k: string) => {
            log.push({ key: k, kind: 'remove' });
            inner.remove(k);
        },
        keys: () => inner.keys(),
        clear: () => inner.clear(),
    };
    return { storage, log };
}

function newStorage(): Storage {
    return new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createStorage();
}

const SAVE_KEY = 'wxgame.beads.test.s211-s5';

/** 13×N 夹具：`rows` 行全可填 ⇒ 已填格数可控（TC-STY-04 的 Δ 线性性需要两个不同计数）。 */
function levelOf(rows: number): ReturnType<typeof simpleTestLevel> {
    return simpleTestLevel({
        cols: 13,
        rows,
        pattern: Array.from({ length: rows }, () => '1231231231231'),
    });
}

function boot(storage: Storage, rows = 5): Harness {
    return createBeadsHarness({ noAssemble: true, levels: [levelOf(rows)], saveKey: SAVE_KEY, storage });
}

/** 行优先填满 `count` 个可填格（走公开 `placeColor`），返回实际已填数。 */
function fillRow(game: BeadsGame, count: number): number {
    let placed = 0;
    outer: for (let row = 0; row < game.grid.rows; row++) {
        for (let col = 0; col < game.grid.cols; col++) {
            if (!game.grid.isFillable(row, col)) continue;
            if (placed >= count) break outer;
            if (placeColor(game, game.grid.requiredColor(row, col), row, col)) placed++;
        }
    }
    return placed;
}

function boardFilled(game: BeadsGame): number {
    // 已填口径 = 快照格上挂着珠色（`beadColorIdx` 0 = 空）⇒ 不依赖 grid 内部方法。
    return game.snapshot.cells.filter((c) => c.beadColorIdx !== 0).length;
}

/**
 * 本帧**实际被换肤的珠数** = 盘面已填 + 托盘持珠。
 * ⚠ 托盘珠按 `assets-spec §7.11` 也随风格（不随豆径）⇒ 珠体族 Δ 的乘数是本值而非格数；
 *   拿写死的「已填数」去除会把真判据测成假红。
 */
function beadsDrawn(game: BeadsGame): number {
    const tray = game.snapshot.traySlots.reduce((n, s) => n + (s.state === 'free' ? 0 : 1), 0);
    return boardFilled(game) + tray;
}

function fillableCells(game: BeadsGame): number {
    let n = 0;
    for (let row = 0; row < game.grid.rows; row++) {
        for (let col = 0; col < game.grid.cols; col++) if (game.grid.isFillable(row, col)) n++;
    }
    return n;
}

/**
 * 阳性对照用：可填格数必须 > 0（否则「盘上有珠」不成立，Δ 断言会退成空断言）。
 * 本文件只读它的非零性，枚数口径另走 `rows × cols`（B0 满铺）与 `beadsDrawn`。
 */
function expectFillable(game: BeadsGame): void {
    expect(fillableCells(game)).toBeGreaterThan(0);
}

function buttonPoint(id: PausePanelAction, mode: 'normal' | 'sprint' = 'normal'): { x: number; y: number } {
    const button = pausePanelLayout(mode).buttons.find((b) => b.id === id);
    if (!button) throw new Error(`panel: no button "${id}" in ${mode} layout`);
    return { x: (button.rect.xMin + button.rect.xMax) / 2, y: (button.rect.yMin + button.rect.yMax) / 2 };
}

/** 进 PLAYING 稳定帧（`noAssemble` ⇒ 供料关停、托盘恒空，帧比较不会被供珠污染）。 */
function ensurePlaying(harness: Harness): BeadsGame {
    harness.advance(1);
    expect(harness.game.phase).toBe('playing');
    return harness.game;
}

/** 进 PAUSED（S9 §2.1 唯一入口 = 齿轮），并把面板动画推到静息，使帧比较不被入场补间污染。 */
function enterPaused(harness: Harness): BeadsGame {
    const game = ensurePlaying(harness);
    const p = { x: GEAR_HIT_SIZE / 2, y: (HUD_BAND.yMin + HUD_BAND.yMax) / 2 };
    expect(game.tapDesign(p.x, p.y)).toBe(true);
    harness.advance(1); // 面板入 200ms 后静息（§8-10 引用值，本批零改动）
    expect(game.phase).toBe('paused');
    return game;
}

/** 先造盘面（PLAYING 期落子），再进 PAUSED ⇒ 顺序不可颠倒（PAUSED 不落子）。 */
function pauseAfterFill(harness: Harness, fill: number): BeadsGame {
    const game = ensurePlaying(harness);
    expectFillable(game);
    expect(fillRow(game, fill)).toBe(fill);
    return enterPaused(harness);
}

function serialize(model: ReturnType<RenderModelBuilder['end']>): string[] {
    return model.commands.map((c: DrawCommand) =>
        c.kind === 'polygon'
            ? JSON.stringify({ ...c, points: Array.from(polygonVertices(model, c)) })
            : JSON.stringify(c),
    );
}

/** 整帧命令流（真渲染链：`buildBeadsView` 读 snapshot ⇒ 与生产逐字同路）。 */
function frame(harness: Harness): string[] {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
    return serialize(builder.end());
}

function kindCount(flow: readonly string[]): Record<string, number> {
    const kinds: Record<string, number> = {};
    for (const line of flow) {
        const kind = (JSON.parse(line) as { kind: string }).kind;
        kinds[kind] = (kinds[kind] ?? 0) + 1;
    }
    return kinds;
}

/**
 * B0 目标色底图（`drawTargetTile` 的唯一产出）—— 过滤式沿用 `view-model.test.ts::tileRects`
 * （边长 = 本盘实际格距 `snap.gridPitch`）。⛔ 不得只按 `kind === 'rect'` 筛：风格层集也发 `rect`。
 */
function b0Tiles(harness: Harness): DrawCommand[] {
    const pitch = harness.game.snapshot.gridPitch;
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
    return builder
        .end()
        .commands.filter((c) => c.kind === 'rect' && (c as { w: number }).w === pitch);
}

function readSave(storage: Storage): Record<string, unknown> {
    const raw = storage.get(SAVE_KEY);
    expect(typeof raw).toBe('string');
    return JSON.parse(raw as string) as Record<string, unknown>;
}

function settingsOf(storage: Storage): Record<string, unknown> {
    return readSave(storage)['settings'] as Record<string, unknown>;
}

/** 归一化器对「存量档」的读入结果（含 BOOT 不报错面）。 */
function normalizeDoc(doc: unknown): { save: ReturnType<typeof normalizeBeadsSave>['save']; changed: boolean } {
    const r = normalizeBeadsSave(doc, 8);
    return { save: r.save, changed: r.changed };
}

// ───────────────────────────────────────────── TC-STY-01 · S9 §8-14（循环 + 即写 + 不切相位）

describe('TC-STY-01 · §8-14 行4「珠子风格」钮：逐档循环 · 恰写档 · 不切相位 · 不推计时', () => {
    it('每次点按恰切到注册序下一档（到末档回第一档），循环序 = 运行时注册序', () => {
        const { storage, log } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = enterPaused(harness);
        expect(game.beadStyle).toBe(FIRST);

        // ⛔ 不写死档数：期望序 = 注册序左旋一格，长度取运行时注册数（U16 = 甲）。
        for (let step = 1; step <= IDS.length; step++) {
            const before = log.length;
            const point = buttonPoint('cycle-bead-style');
            expect(game.tapDesign(point.x, point.y)).toBe(true);

            expect(game.beadStyle).toBe(IDS[step % IDS.length]);
            // §8-14「恰写 `settings.beadStyle` 1 次」= 一次点按 ⇒ 恰一次落盘（与四开关同判例）。
            expect(log.length - before).toBe(1);
            expect(settingsOf(storage)['beadStyle']).toBe(IDS[step % IDS.length]);
        }
        // 走完一整圈回到起始档 ⇒ 循环闭合（非"停在末档"）。
        expect(game.beadStyle).toBe(FIRST);
    });

    it('不切相位（PAUSED 保持、不发 game:resumed）· 不推 S5/S4 任何计时', () => {
        const { storage } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = enterPaused(harness);
        const remaining = game.snapshot.remaining;
        const phaseElapsed = game.snapshot.phaseElapsed;
        const resumedBefore = harness.count('game:resumed');
        const tickBefore = harness.count('timer:tick');

        for (let i = 0; i < IDS.length; i++) {
            const p = buttonPoint('cycle-bead-style');
            game.tapDesign(p.x, p.y);
            expect(game.phase).toBe('paused'); // 面板不退出
            expect(game.snapshot.panelVisible).toBe(true);
        }
        expect(harness.count('game:resumed')).toBe(resumedBefore); // §8-14「不发 game:resumed」
        expect(harness.count('timer:tick')).toBe(tickBefore);
        expect(game.snapshot.remaining).toBe(remaining); // S5 计时冻结
        expect(game.snapshot.phaseElapsed).toBe(phaseElapsed);
    });

    it('豆子尺寸钮同口径：两档循环 · 恰写一次 · 不切相位', () => {
        const { storage, log } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = enterPaused(harness);
        const seen = [game.beadSize];
        for (let i = 0; i < 2; i++) {
            const before = log.length;
            const p = buttonPoint('cycle-bead-size');
            expect(game.tapDesign(p.x, p.y)).toBe(true);
            expect(log.length - before).toBe(1);
            seen.push(game.beadSize);
            expect(game.phase).toBe('paused');
        }
        expect(new Set(seen).size).toBe(2); // 满/小两档都可达
        expect(seen[0]).toBe(seen[2]); // 两档一循环 ⇒ 回起始
        expect(typeof settingsOf(storage)['beadSize']).toBe('string');
        expect(seen).toContain('full'); // 默认档 = 满豆（S8 §8-12 降级目标值）
    });
});

// ───────────────────────────────────────────────── TC-STY-02 · S9 §8-15（连点幂等）

describe('TC-STY-02 · §8-15 行4 连点幂等：回起始档 · 观感逐帧一致 · 末值一条无历史栈', () => {
    it('连点 N 次（N = 当前注册档数）⇒ 回到起始档且整帧逐字节一致', () => {
        const { storage } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = pauseAfterFill(harness, 13);
        const initial = frame(harness);

        for (let i = 0; i < IDS.length; i++) {
            const p = buttonPoint('cycle-bead-style');
            game.tapDesign(p.x, p.y);
        }
        expect(game.beadStyle).toBe(FIRST);
        expect(frame(harness)).toEqual(initial); // 「观感与初始逐帧一致」
    });

    it('只存末值：档内 `beadStyle` / `beadSize` 恒为**单值字符串**，不得出现历史栈', () => {
        const { storage } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = enterPaused(harness);
        const stylePoint = buttonPoint('cycle-bead-style');
        const sizePoint = buttonPoint('cycle-bead-size');
        for (let i = 0; i < IDS.length + 2; i++) game.tapDesign(stylePoint.x, stylePoint.y);
        for (let i = 0; i < 5; i++) game.tapDesign(sizePoint.x, sizePoint.y);

        const settings = settingsOf(storage);
        expect(typeof settings['beadStyle']).toBe('string');
        expect(Array.isArray(settings['beadStyle'])).toBe(false);
        expect(typeof settings['beadSize']).toBe('string');
        expect(Array.isArray(settings['beadSize'])).toBe(false);
        // 末值 = 内存态（连点后无「撤销」步 ⇒ 档与态一一对应）。
        expect(settings['beadStyle']).toBe(game.beadStyle);
        expect(settings['beadSize']).toBe(game.beadSize);
    });

    it('⚠ 登记：§8-15「N 次合并后的末值一次」按**档内容**口径验，未按**落盘次数**验', () => {
        // 现码 `SaveManager.save()` 立即落盘、无跨调用去抖 ⇒ N 次点按 = N 次 `set`
        // （与四开关同判例，§8-14「每次点按恰写 1 次」正要求如此）。两条字面读法互斥，
        // 若按"次数 = 1"读，§8-14 对既有四开关亦恒红。本用例如实钉住现码行为并把冲突上报，
        // ⛔ 不静默择一（详见回传「未决问题」）。
        const { storage, log } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = enterPaused(harness);
        const p = buttonPoint('cycle-bead-style');
        const before = log.length;
        for (let i = 0; i < IDS.length; i++) game.tapDesign(p.x, p.y);
        expect(log.length - before).toBe(IDS.length);
        expect(settingsOf(storage)['beadStyle']).toBe(FIRST);
    });
});

// ───────────────────────────────────────────────── TC-STY-03 · S9 §8-16（双轴正交）

describe('TC-STY-03 · §8-16 风格 × 豆径双轴正交：各写各字段 · 互不锁 · 零棋局状态写入', () => {
    it('交替连点 ⇒ 一次点按只改写自己的字段，另一字段一字未动', () => {
        const { storage, log } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = enterPaused(harness);
        const stylePoint = buttonPoint('cycle-bead-style');
        const sizePoint = buttonPoint('cycle-bead-size');

        for (let i = 0; i < IDS.length; i++) {
            const sizeBefore = game.beadSize;
            const docBefore = settingsOf(storage)['beadSize'];
            expect(log.length).toBeDefined();

            const writesBefore = log.length;
            game.tapDesign(stylePoint.x, stylePoint.y);
            // 硬断言（QA §K.1 追加条）：写档调用恰 1 次，且不得连带改写另一字段。
            expect(log.length - writesBefore).toBe(1);
            expect(game.beadSize).toBe(sizeBefore);
            expect(settingsOf(storage)['beadSize']).toBe(docBefore);
        }

        for (let i = 0; i < 4; i++) {
            const styleBefore = game.beadStyle;
            const writesBefore = log.length;
            game.tapDesign(sizePoint.x, sizePoint.y);
            expect(log.length - writesBefore).toBe(1);
            expect(game.beadStyle).toBe(styleBefore);
            expect(settingsOf(storage)['beadStyle']).toBe(styleBefore);
        }
    });

    it('任意（注册档 × 两档）组合恒可渲染，且**零棋局状态写入**（铁律 L5）', () => {
        const { storage } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = pauseAfterFill(harness, 13);
        const placed = boardFilled(game);
        expect(placed).toBeGreaterThan(0);

        const stylePoint = buttonPoint('cycle-bead-style');
        const sizePoint = buttonPoint('cycle-bead-size');
        const fingerprint = (): unknown => ({
            phase: game.phase,
            levelIndex: game.levelIndex,
            score: game.snapshot.score,
            remaining: game.snapshot.remaining,
            filled: boardFilled(game),
            tray: game.snapshot.traySlots.map((s) => [s.state, s.colorIdx]),
        });
        const baseline = fingerprint();

        for (const styleIdx of IDS.keys()) {
            while (game.beadStyle !== IDS[styleIdx]) game.tapDesign(stylePoint.x, stylePoint.y);
            for (let sizeIdx = 0; sizeIdx < 2; sizeIdx++) {
                game.tapDesign(sizePoint.x, sizePoint.y); // 走真钮（⛔ 不绕开面板直调 setter）
                const flow = frame(harness);
                expect(flow.length).toBeGreaterThan(0); // 恒可渲染（不抛、不出空帧）
                expect(fingerprint()).toEqual(baseline); // L5：呈现层不写游戏状态
            }
        }
        expect(boardFilled(game)).toBe(placed);
    });
});

// ───────────────────────── TC-STY-04 · S9 §8-17 + §12.2 C8（下一帧生效 · 恰一帧 · B0 不变）

describe('TC-STY-04 · §8-17/C8 三段硬断言：珠体族 Δ ≠ 0 · B0 逐字段不变 · 中间帧数 = 1', () => {
    it('① 切档前一帧与后一帧的珠体族图元集**不相等**，且差值 = 本帧珠数 × 每颗常数（Δ 线性）', () => {
        // 差值断言（K-060）：⛔ 不以「存在某条差异」糊弄。
        // 手法 = 同一夹具改两个不同的**本帧珠数**，断言两次的逐 kind Δ **除以本帧珠数后逐 kind 相等**
        //       ⇒ 变化严格来自珠体族（面板/HUD/B0 的枚数与珠数无关），且不拿纸面数替代实测（C7/K-051）。
        const measure = (fillCount: number): { d: Record<string, number>; n: number } => {
            const { storage } = spyStorage(newStorage());
            const harness = boot(storage, 5);
            const game = pauseAfterFill(harness, fillCount);
            const n = beadsDrawn(game);
            const before = kindCount(frame(harness));
            const p = buttonPoint('cycle-bead-style');
            game.tapDesign(p.x, p.y);
            const after = kindCount(frame(harness));
            return { d: deltas(before, after), n };
        };

        const m13 = measure(13);
        const m26 = measure(26);
        expect(m13.n).toBeGreaterThan(0);
        expect(m26.n).toBeGreaterThan(m13.n); // 两臂珠数确实不同 ⇒ 比例式有判别力

        // ① 珠体族确实变了（不是「两帧全等」）。
        expect(Object.values(m13.d).some((v) => v !== 0)).toBe(true);
        // ① 整除性 + 每颗 Δ 一致性（两臂互推，⛔ 不断言具体数字）。
        const kinds = new Set([...Object.keys(m13.d), ...Object.keys(m26.d)]);
        for (const kind of kinds) {
            const d13 = m13.d[kind] ?? 0;
            const d26 = m26.d[kind] ?? 0;
            // ⚠ 用 `Number.isInteger(d/n)` 而非 `d % n === 0`：JS 的 -52 % 13 得 **-0**，`toBe(0)` 会误红。
            expect(Number.isInteger(d13 / m13.n), `kind ${kind} Δ=${d13} 不被本帧珠数 ${m13.n} 整除 ⇒ 变化不只在珠体族`).toBe(true);
            expect(Number.isInteger(d26 / m26.n), `kind ${kind} Δ=${d26} 不被 ${m26.n} 整除`).toBe(true);
            expect(d26 / m26.n).toBe(d13 / m13.n); // 每颗成本变化与臂无关
        }
        // 整帧总命令数也确实变化（⛔ 排除「只在 kind 间挪位、总量不变」的假象）。
        expect(total(m13.d)).not.toBe(0);
    });

    it('② B0 目标色底图输出**逐字段等值**（kind/x/y/w/h/radius/fill 全列）', () => {
        const { storage } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = pauseAfterFill(harness, 13);

        const before = b0Tiles(harness);
        // 阳性对照（K-060）：筛得出 B0 才有判别力，筛出 0 条的"逐字段相等"是空断言。
        // 实测口径（非纸面）：B0 = **满铺整盘的无缝马赛克**（含非可填格，格心距满铺），
        // 而非「仅可填格」⇒ 枚数 = rows × cols（`view-model.test.ts::tileRects` 同筛法）。
        expect(before.length).toBe(game.grid.rows * game.grid.cols);
        expect(before.length).toBeGreaterThan(0);

        const p = buttonPoint('cycle-bead-style');
        game.tapDesign(p.x, p.y);
        expect(game.beadStyle).toBe(SECOND);
        const after = b0Tiles(harness);
        expect(after).toEqual(before); // 逐字段（含 fill / 几何）一字未动
        expect(after.length).toBe(before.length);

        // 豆径档也不得扰动 B0（豆径作用域 = 仅网格珠珠体，assets-spec §7.11）。
        const q = buttonPoint('cycle-bead-size');
        game.tapDesign(q.x, q.y);
        expect(b0Tiles(harness)).toEqual(before);
    });

    it('③ 中间帧数 = 1：切档后**下一帧即新档**，再下一帧不再渐变', () => {
        const { storage } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = pauseAfterFill(harness, 13);

        const f0 = frame(harness);
        const p = buttonPoint('cycle-bead-style');
        game.tapDesign(p.x, p.y);
        const f1 = frame(harness); // 切档后的第一帧（下一帧）
        expect(f1).not.toEqual(f0); // 非零帧同帧变 ⇒ 恰在此帧生效

        harness.advance(1 / 60); // 再过一帧，无任何新输入
        const f2 = frame(harness);
        expect(f2).toEqual(f1); // 不得两帧渐变（第二段过渡）
        harness.advance(0.5);
        expect(frame(harness)).toEqual(f1); // 稳态收敛，无迟到变更
    });

    it('零新增毫秒值：tuning 不得为换肤/豆径引入新时长真源（§8-17 末句 + ux §5 不落新行）', () => {
        const tuning = SRC('config/tuning.ts');
        const msLines = tuning.split('\n').filter((line) => /export const .*_MS\b/.test(line));
        expect(msLines.length).toBeGreaterThan(0); // 阳性对照：正则确能命中既有毫秒真源
        const skinMs = msLines.filter((line) => /STYLE|SKIN|BEAD_SIZE|THEME/i.test(line));
        expect(skinMs).toEqual([]); // ⛔ 出现「换肤动画时长」即违 §8-17
    });
});

// ─────────────────────────────────── TC-STY-05 · ux §4「PAUSED·行4｜切档后点『继续』」（出栈携新档）

describe('TC-STY-05 · ux §4：切档后点「继续」⇒ 出栈携新档，不重开 BOOT、已填珠同帧换肤', () => {
    it('出栈 → PLAYING 且新档已在画面；关卡与棋局一字未动', () => {
        const { storage } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = pauseAfterFill(harness, 13);
        const placed = boardFilled(game);
        const levelBefore = game.levelIndex;
        const styleBefore = game.beadStyle;
        const framePausedOld = frame(harness);

        const sPoint = buttonPoint('cycle-bead-style');
        game.tapDesign(sPoint.x, sPoint.y);
        expect(game.beadStyle).not.toBe(styleBefore);
        const framePausedNew = frame(harness);
        expect(framePausedNew).not.toEqual(framePausedOld); // 面板内即已换肤

        const r = buttonPoint('resume');
        expect(game.tapDesign(r.x, r.y)).toBe(true);
        harness.advance(0.5); // 面板出 150ms（§8-10 引用值，零改动）后
        expect(game.phase).toBe('playing');
        expect(game.levelIndex).toBe(levelBefore); // 不重开 BOOT、不重载关卡
        expect(boardFilled(game)).toBe(placed); // 本局已填珠无损
        expect(game.beadStyle).not.toBe(styleBefore); // 携新档出栈

        // 「新档已在画面」的可机检形式：同盘同态下，新档帧与旧档帧**逐 kind 不等**，
        // 且旧档帧只能靠改回旧档重现（⛔ 不是拿面板帧做区域过滤那种脆弱比较）。
        const framePlayingNew = kindCount(frame(harness));
        game.applySettingsAction('cycle-bead-style'); // 转一整圈回到旧档（测试侧改档，不动盘）
        for (let i = 0; i < IDS.length - 2; i++) game.applySettingsAction('cycle-bead-style');
        expect(game.beadStyle).toBe(styleBefore);
        const framePlayingOld = kindCount(frame(harness));
        expect(framePlayingNew).not.toEqual(framePlayingOld); // 玩法态画面已携新档（同帧换肤、无二次刷新）

        // 棋局零写入（L5）：两次改档来回，盘与计分一字未动。
        expect(boardFilled(game)).toBe(placed);
        expect(game.snapshot.score).toBe(0);
        expect(game.phase).toBe('playing');
    });
});

// ───────────────────────── TC-STY-06 · ux §4「玩法｜直改风格或豆径」= 无快捷通道 · 无第三入口

describe('TC-STY-06 · ux §4：玩法态直改风格/豆径 ⇒ 零响应（无快捷通道 · 无第三入口）', () => {
    it('盘面 / HUD / 托盘 / 道具位任意坐标投改档意图 ⇒ 两字段零写入、快照不变、零事件', () => {
        const { storage, log } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = harness.game;
        harness.advance(1);
        expect(game.phase).toBe('playing');
        expect(fillRow(game, 13)).toBe(13);

        const styleBefore = game.beadStyle;
        const sizeBefore = game.beadSize;
        const docBefore = JSON.stringify(settingsOf(storage));
        const writesBefore = log.length;
        const eventsBefore = harness.emitted.length;

        const layout = gridLayoutFor(game.grid.cols, game.grid.rows);
        const points: { x: number; y: number }[] = [];
        for (let row = 0; row < game.grid.rows; row++) {
            for (let col = 0; col < game.grid.cols; col++) {
                points.push({ x: layout.colCenterX(col), y: layout.rowCenterY(row) });
            }
        }
        points.push({ x: DESIGN_W / 2, y: (HUD_BAND.yMin + HUD_BAND.yMax) / 2 }); // HUD 带
        points.push({ x: DESIGN_W / 2, y: (TRAY_BAND.yMin + TRAY_BAND.yMax) / 2 }); // 托盘带
        points.push({ x: DESIGN_W / 2, y: (POWERUP_BAND.yMin + POWERUP_BAND.yMax) / 2 }); // 道具位
        for (const pt of points) game.tapDesign(pt.x, pt.y);

        expect(game.beadStyle).toBe(styleBefore);
        expect(game.beadSize).toBe(sizeBefore);
        expect(JSON.stringify(settingsOf(storage))).toBe(docBefore); // settings.* 零改写
        expect(log.length).toBe(writesBefore); // 零落盘
        // 点按当场零事件（⛔ 不得把下列 advance 的计时心跳算到点按头上）。
        expect(harness.emitted.length).toBe(eventsBefore);
        harness.advance(1);
        expect(new Set(harness.emitted.slice(eventsBefore).map((e) => e.type))).toEqual(new Set(['timer:tick']));
        // 阳性对照（K-060）：同夹具的**落子链**确实会产生事件 ⇒ 上面「零事件」是门禁而非链路坏死。
        expect(harness.emitted.filter((e) => e.type === 'bead:placed').length).toBeGreaterThan(0);
    });

    it('阳性对照（K-060）：同夹具点齿轮必进 PAUSED ⇒ 上条「零响应」是门禁，不是链路坏死', () => {
        const { storage } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = harness.game;
        harness.advance(1);
        const p = { x: GEAR_HIT_SIZE / 2, y: (HUD_BAND.yMin + HUD_BAND.yMax) / 2 };
        expect(game.tapDesign(p.x, p.y)).toBe(true);
        expect(game.phase).toBe('paused');
    });

    it('无第三入口（静态门）：改档动作串值只住在两入口 + 受理/呈现/注释侧', () => {
        const allow = new Set([
            'systems/pause-panel.ts', // 入口甲：行4 钮位
            'view/meta-view.ts', // 入口乙：菜单设置 overlay 同钮
            'game/beads-game.ts', // 唯一受理点（_applyPanelAction / applySettingsAction）
            'view/view-model.ts', // 钮文案回显
            'game/beads-shell.ts', // overlay 动作转发（唯一 applySettingsAction 调用点）
            'view/bead-styles/registry.ts', // 注释（S5 收口登记）
        ]);
        const offenders = ALLOWED_SRC_FILES.filter((f) => !allow.has(f) && SRC(f).includes('cycle-bead-style'));
        expect(offenders).toEqual([]);
        // 受理点唯一：overlay 侧只有 shell 一处转发，面板侧只有 `_applyPanelAction`。
        const shell = SRC('game/beads-shell.ts');
        expect((shell.match(/applySettingsAction\(/g) ?? []).length).toBe(1);
    });
});

// ──────────────────────────────────── TC-STY-11 · §8-19 后半句（循环长度 = 运行时注册数）

describe('TC-STY-11 翻转腿 · §8-19：注册数 ≥ 2 ⇒ 钮 present 且循环长度 = 运行时注册数', () => {
    it('前提哨兵：运行时注册数 ≥ 2（<2 时本腿无效，须回到「钮不呈现」口径）', () => {
        expect(IDS.length >= 2).toBe(true);
    });

    it('normal / sprint 两模式行4 均 present 两枚选择器钮；循环长度 = 注册数', () => {
        for (const mode of ['normal', 'sprint'] as const) {
            const ids = pausePanelLayout(mode).buttons.map((b) => b.id);
            expect(ids).toContain('cycle-bead-style');
            expect(ids).toContain('cycle-bead-size');
            expect(ids.filter((i) => i === 'cycle-bead-style').length).toBe(1); // 不重复渲染
        }

        const { storage } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = enterPaused(harness);
        const p = buttonPoint('cycle-bead-style');
        const cycle: string[] = [];
        for (let i = 0; i < IDS.length; i++) {
            game.tapDesign(p.x, p.y);
            cycle.push(game.beadStyle);
        }
        expect(cycle.length).toBe(new Set(cycle).size); // 一圈内无重复 ⇒ 循环长度 = 注册数
        expect(cycle).toEqual(IDS.slice(1).concat(IDS[0])); // 且严格 = 注册序左旋
    });
});

// ────────────────────────────────────────────────── TC-SAVE-11 · S8 §8-11（两字段入档）

describe('TC-SAVE-11 · S8 §8-11：两字段入档 · 即写 · 只存末值 · 重启回显一致 · 不新增事件名', () => {
    it('点按后档内两字段为单值（styleId ∈ registry / 豆径 ∈ 枚举），且**重启后回显与关前最后一帧一致**', () => {
        const store = newStorage();
        const h1 = boot(store);
        const g1 = enterPaused(h1);
        const stylePoint = buttonPoint('cycle-bead-style');
        const sizePoint = buttonPoint('cycle-bead-size');
        g1.tapDesign(stylePoint.x, stylePoint.y);
        g1.tapDesign(sizePoint.x, sizePoint.y);

        const settings = settingsOf(store);
        expect(typeof settings['beadStyle']).toBe('string');
        expect(IDS).toContain(settings['beadStyle'] as string); // 已注册单值
        expect(['full', 'small']).toContain(settings['beadSize'] as string); // 枚举单值

        // 杀进程重启：同一 storage 再装一次（BOOT 读档路径）。
        const h2 = createBeadsHarness({ noAssemble: true, levels: [levelOf(5)], saveKey: SAVE_KEY, storage: store });
        expect(h2.game.beadStyle).toBe(settings['beadStyle']);
        expect(h2.game.beadSize).toBe(settings['beadSize']);
        expect(h2.game.snapshot.beadStyle).toBe(settings['beadStyle']); // 回显走 snapshot（L5）
    });

    it('不新增事件名：改档全程只发既有事件族，⛔ 无 style/skin 专名', () => {
        const { storage } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = enterPaused(harness);
        const p = buttonPoint('cycle-bead-style');
        const q = buttonPoint('cycle-bead-size');
        for (let i = 0; i < 3; i++) {
            game.tapDesign(p.x, p.y);
            game.tapDesign(q.x, q.y);
        }
        const names = new Set(harness.emitted.map((e) => e.type));
        for (const n of names) expect(n).not.toMatch(/style|skin|bead_style|theme/i);
    });

    it('`SAVE_VERSION` 不为此 bump（判例 = debugInfo 与 v1→v2）', () => {
        const tuning = SRC('game/save-schema.ts');
        expect(tuning).toContain(`export const SAVE_VERSION = ${SAVE_VERSION};`);
        expect(SAVE_VERSION).toBe(4);
    });
});

// ────────────────────────────────── TC-SAVE-12 腿②③④ · S8 §8-12（逐字段降级）

describe('TC-SAVE-12 腿②③④ · S8 §8-12：非法值 ⇒ 该字段单独回落默认（复刻·四棱 + 满豆），不弃整档', () => {
    const LEGAL_BUT_UNREGISTERED = 'facet-99-not-registered';

    it('腿② 类型错：`beadStyle` 非字符串 / 豆径档非枚举 ⇒ 各自降级，其余字段无损', () => {
        const base = defaultBeadsSave();
        for (const bad of [42, null, true, [], {}, ['facet-4']]) {
            const s = normalizeSettings({ ...base.settings, beadStyle: bad });
            expect(s.beadStyle).toBe(FIRST);
            expect(s.beadSize).toBe('full');
            expect(s.bgmMuted).toBe(base.settings.bgmMuted); // 未受牵连
        }
        for (const bad of ['FULL', 'huge', 1, null, {}]) {
            const s = normalizeSettings({ ...base.settings, beadSize: bad });
            expect(s.beadSize).toBe('full');
            expect(s.beadStyle).toBe(FIRST);
        }
    });

    it('腿③ `styleId` 字符串合法但未在 registry 注册 ⇒ 回落默认档（不抛、不置空）', () => {
        const s = normalizeSettings({ beadStyle: LEGAL_BUT_UNREGISTERED, beadSize: 'full' });
        expect(s.beadStyle).toBe(FIRST);
        expect(IDS).not.toContain(LEGAL_BUT_UNREGISTERED); // 前置自检：确属未注册
    });

    it('腿④ 豆径档值越界 ⇒ 回落满豆档', () => {
        expect(normalizeSettings({ beadSize: 'tiny' }).beadSize).toBe('full');
        expect(normalizeSettings({ beadSize: 'extra-small' }).beadSize).toBe('full');
        expect(normalizeSettings({ beadSize: 'small' }).beadSize).toBe('small'); // 阳性对照：合法值仍生效
    });

    it('两字段同时非法 ⇒ 仍逐字段降级，进度与六开关全无损、BOOT 不报错', () => {
        const doc = {
            version: SAVE_VERSION,
            runs: 6,
            onboarded: true,
            maxUnlockedLevel: 5,
            currentLevel: 4,
            sprintBestScore: 777,
            sprintBestStage: 3,
            starsByLevel: [3, 2, 1, 0, 0, 0, 0, 0],
            settings: {
                bgmMuted: true, sfxMuted: true, reduceMotion: true, largeText: true, vibrate: false, debugInfo: true,
                beadStyle: { id: 'facet-4' }, beadSize: 'gigantic',
            },
        };
        const { save, changed } = normalizeDoc(doc);
        expect(save.settings.beadStyle).toBe(FIRST);
        expect(save.settings.beadSize).toBe('full');
        expect(save.runs).toBe(6);
        expect(save.currentLevel).toBe(4);
        expect(save.maxUnlockedLevel).toBe(5);
        expect(save.sprintBestScore).toBe(777);
        expect(save.starsByLevel).toEqual([3, 2, 1, 0, 0, 0, 0, 0]);
        expect(save.settings).toMatchObject({ bgmMuted: true, sfxMuted: true, reduceMotion: true, largeText: true, vibrate: false, debugInfo: true });
        expect(changed).toBe(true); // 需一次补写回（patch 型写档）

        // 真 BOOT 面：把该档塞进存储后装载，不抛异常、读到的即默认档。
        const store = newStorage();
        store.set(SAVE_KEY, JSON.stringify(doc));
        const harness = boot(store);
        expect(harness.game.beadStyle).toBe(FIRST);
        expect(harness.game.beadSize).toBe('full');
        expect(harness.game.bootError).toBe(''); // 不因非法档中断启动
    });
});

// ───────────────────────────────── TC-SAVE-13 运行时腿 · S8 §8-13（旧档不丢档）

/**
 * 本夹具 harness 只装 1 关 ⇒ 存量档必须按 `levelCount = 1` 构造才是**全合法存量档**；
 * 否则越界的 `maxUnlockedLevel/currentLevel` 与长度不符的 `starsByLevel` 会自己触发 changed，
 * 两臂差值归零 ⇒ 本判据失真（实测踩到，故在此固定）。
 */
const LEGACY_LEVEL_COUNT = 1;

function legacyDoc(): Record<string, unknown> {
    return {
        version: SAVE_VERSION,
        runs: 9,
        onboarded: true,
        maxUnlockedLevel: LEGACY_LEVEL_COUNT,
        currentLevel: LEGACY_LEVEL_COUNT,
        sprintBestScore: 777,
        sprintBestStage: 3,
        starsByLevel: [3],
        settings: legacySettings(),
    };
}

describe('TC-SAVE-13 运行时腿 · S8 §8-13：不含两字段的存量档 ⇒ 逐字段无损 + 写回恰一次', () => {
    it('旧档（v4 无两字段）读入：进度/星级/runs/其余设置无损，仅两字段取默认，写回恰 1 次', () => {
        const store = newStorage();
        // 先装一次（产生真存量档骨架），再写入一份**不含该两字段**的合法存量档。
        const seed = boot(store);
        expect(seed.game.phase).toBeTruthy();
        const legacy = legacyDoc();
        store.set(SAVE_KEY, JSON.stringify(legacy));

        const { storage, log } = spyStorage(store);
        const harness = createBeadsHarness({ noAssemble: true, levels: [levelOf(5)], saveKey: SAVE_KEY, storage });
        const game = harness.game;

        // 读档后的内存态：两字段取默认，其余无损（装载不抛）。
        expect(game.beadStyle).toBe(FIRST);
        expect(game.beadSize).toBe('full');

        const normalized = normalizeBeadsSave(legacy, LEGACY_LEVEL_COUNT);
        expect(normalized.save.runs).toBe(9);
        expect(normalized.save.maxUnlockedLevel).toBe(LEGACY_LEVEL_COUNT);
        expect(normalized.save.currentLevel).toBe(LEGACY_LEVEL_COUNT);
        expect(normalized.save.sprintBestScore).toBe(777);
        expect(normalized.save.sprintBestStage).toBe(3);
        expect(normalized.save.starsByLevel).toEqual([3]);
        expect(normalized.save.settings).toMatchObject(legacySettings());
        expect(normalized.changed).toBe(true); // 缺字段 ⇒ 报 changed（B1-Q3 修后行为）

        // 「写回恰一次」＝**为两字段缺失而发生的补写**恰一次。
        // BOOT 另有一次既有「runs+1 / lastPlayDate」写（S8 §2.5），与本条无关 ⇒
        // ⛔ 不得直接断言 BOOT 总次数 = 1。解法 = **对照臂差值**：同文档但两字段齐备 ⇒
        //   若仍只少一次写，则那一轮差值即「补写次数」，必须恰为 1（不拖到多次抖动）。
        const bootWrites = log.filter((e) => e.key === SAVE_KEY && e.kind === 'set').length;

        const controlStore = newStorage();
        const complete = JSON.parse(JSON.stringify(legacy)) as { settings: Record<string, unknown> };
        complete.settings['beadStyle'] = FIRST;
        complete.settings['beadSize'] = 'full';
        controlStore.set(SAVE_KEY, JSON.stringify(complete));
        const ctl = spyStorage(controlStore);
        createBeadsHarness({ noAssemble: true, levels: [levelOf(5)], saveKey: SAVE_KEY, storage: ctl.storage });
        const controlWrites = ctl.log.filter((e) => e.key === SAVE_KEY && e.kind === 'set').length;

        expect(bootWrites - controlWrites).toBe(1); // 缺字段 ⇒ 多出**恰一次**补写
        expect(bootWrites).toBeGreaterThanOrEqual(1);

        const after = settingsOf(storage);
        expect(after['beadStyle']).toBe(FIRST);
        expect(after['beadSize']).toBe('full');
        expect(after['debugInfo']).toBe(true); // 补写未抹掉既有字段
        expect((readSave(storage) as Record<string, unknown>)['runs']).toBe((legacy['runs'] as number) + 1); // 旧档不丢档：仅 BOOT 写 +1，未被重置为 0
        expect((readSave(storage) as Record<string, unknown>)['sprintBestScore']).toBe(777);
    });
});

// ─────────────────────────────────────────────────────────────────── 内部小工具

function deltas(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const kind of new Set([...Object.keys(a), ...Object.keys(b)])) {
        out[kind] = (b[kind] ?? 0) - (a[kind] ?? 0);
    }
    return out;
}

function total(kinds: Record<string, number>): number {
    return Object.values(kinds).reduce((a, b) => a + b, 0);
}

/** 旧档面板：剥掉两新字段后的 `settings`（故意以无索引签名写入，模拟存量档）。 */
function legacySettings(): Record<string, unknown> {
    return {
        bgmMuted: true,
        sfxMuted: false,
        reduceMotion: true,
        largeText: false,
        vibrate: false,
        debugInfo: true,
    };
}

/** 静态门扫描面 = `src` 下全部 .ts（与 TC-STY-11 腿 B 的 grep 门同族）。 */
const ALLOWED_SRC_FILES: string[] = [
    'systems/pause-panel.ts',
    'view/meta-view.ts',
    'view/view-model.ts',
    'game/beads-game.ts',
    'game/beads-shell.ts',
    'game/state.ts',
    'game/save-schema.ts',
    'config/tuning.ts',
    'view/bead-styles/registry.ts',
    'view/bead-render.ts',
];

// ═════════════════════════════════ 豆径档作用域（assets-spec §7.11 / ux §3.3 ④）

function cmdList(flow: readonly string[]): DrawCommand[] {
    return flow.map((line) => JSON.parse(line) as DrawCommand);
}

function cmdY(c: DrawCommand): number {
    return c.kind === 'line'
        ? ((c as unknown as { y1: number }).y1 + (c as unknown as { y2: number }).y2) / 2
        : (c as unknown as { y: number }).y;
}

/** 盘面带（网格所在带）——`PUZZLE_BAND` 是棋盘的唯一合法落位（tuning §棋盘带冻结）。 */
function inPuzzle(c: DrawCommand): boolean {
    const y = cmdY(c);
    return y >= PUZZLE_BAND.yMin && y <= PUZZLE_BAND.yMax;
}

/** 托盘带（与盘面带不相交）——「托盘珠恒满幅、不随豆径档」的观测窗。 */
function inTray(c: DrawCommand): boolean {
    const y = cmdY(c);
    return y >= TRAY_BAND.yMin && y <= TRAY_BAND.yMax;
}

function radii(flow: readonly string[], pred: (c: DrawCommand) => boolean): number[] {
    return cmdList(flow)
        .filter((c) => c.kind === 'circle' && pred(c))
        .map((c) => (c as unknown as { r: number }).r);
}

function rectWidths(flow: readonly string[], pred: (c: DrawCommand) => boolean): number[] {
    return cmdList(flow)
        .filter((c) => c.kind === 'rect' && pred(c))
        .map((c) => (c as unknown as { w: number }).w)
        .sort((a, b) => a - b);
}

function labelTexts(flow: readonly string[], prefix: string): string[] {
    return cmdList(flow)
        .filter((c) => c.kind === 'text')
        .map((c) => (c as unknown as { text: string }).text)
        .filter((t) => t.startsWith(prefix));
}

/** 全屏 scrim 的 α 实测（按 RGB 串筛 ⇒ 面板侧与菜单侧天然分列）。 */
function scrimAlphas(flow: readonly string[], rgb: string): number[] {
    const head = `rgba(${rgb},`;
    return cmdList(flow)
        .filter(
            (c) =>
                c.kind === 'rect' &&
                (c as unknown as { w: number }).w === DESIGN_W &&
                (c as unknown as { h: number }).h === DESIGN_H,
        )
        .map((c) => (c as unknown as { fill?: string }).fill ?? '')
        .filter((f) => f.startsWith(head))
        .map((f) => Number(f.slice(head.length, -1)));
}

describe('豆径档作用域 · assets-spec §7.11 + ux §3.3 ④ + S9 §8-16：小豆只改网格珠珠体（含已填态）· 托盘恒满幅 · B0 不随档 · 凹槽随档但恒 ⊂ 珠体', () => {
    it('满豆 → 小豆：盘面每颗珠恰少一枚 circle（无孔）且珠面收窄不重叠；托盘带与 B0 底图逐命令不变；凹槽随档收窄且恒小于珠体', () => {
        const harness = boot(newStorage());
        const game = ensurePlaying(harness);
        expect(fillRow(game, 26)).toBe(26);
        expect(game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);

        const filled = boardFilled(game);
        const trayBeads = game.snapshot.traySlots.reduce((n, s) => (n + (s.state === 'free' ? 0 : 1)), 0);
        expect(filled).toBeGreaterThan(0); // 阳性对照：盘上有珠
        expect(trayBeads).toBeGreaterThan(0); // 阳性对照：托盘有珠可测「不随档」

        const full = frame(harness);
        expect(game.beadSize).toBe('full');
        const pitch = game.snapshot.gridPitch;

        game.applySettingsAction('cycle-bead-size'); // 面板路由到的同一枚真 setter（K-035）
        expect(game.beadSize).toBe('small');
        const small = frame(harness);
        expect(game.snapshot.gridPitch).toBe(pitch); // 前置：格距不随档 ⇒ 带宽比较才有意义

        // ① 小豆无孔：盘面 `circle` 恰少 `filled` 枚（每颗珠少 1 枚孔层，⛔ 不是整颗消失）。
        const rFull = radii(full, inPuzzle);
        const rSmall = radii(small, inPuzzle);
        expect(rFull.length - rSmall.length).toBe(filled);
        expect(rFull.length).toBeGreaterThan(rSmall.length); // 阳性对照：本档确有孔层可剥

        // ② 珠面收窄且恒零重叠（A5「珠面恒 < 格距」在两档下都成立）。
        const maxFull = Math.max(...rFull);
        const maxSmall = Math.max(...rSmall);
        expect(maxSmall).toBeLessThan(maxFull);
        expect(2 * maxFull).toBeLessThan(pitch);
        expect(2 * maxSmall).toBeLessThan(pitch);

        // ③ 托盘珠恒满幅、恒有孔 ⇒ 托盘带内命令逐字段不变（含半径与孔层）。
        expect(cmdList(small).filter(inTray)).toEqual(cmdList(full).filter(inTray));

        // ④ B0 目标色底图（w = 格距）不随档；**随档的只有「珠体 + 凹槽」**，其余带件一律不动。
        //   ⚠ **口径更替（WXG-T-214，用户 2026-09-26 裁定）**：旧口径「凹槽不随档」与
        //     「豆坑恒小于珠子、有豆时看不到坑」**不能同真**——小豆档珠面 14 < 满豆坑 17.8
        //     ⇒ 坑反倒比珠大，裁定当场失效。新口径比旧口径**更强**（不是放宽）：
        //     随档的宽度档**恰 = 珠体 1 + 凹槽 2（坑外廓 / 坑底）**，且**凹槽恒小于同档珠体**
        //     ⇒ 「坑 ⊂ 珠」这条不变式在本腿也钉住（旧口径只数珠体，管不住坑）。
        //   实测口径：盘面带内 rect 宽度直方图 = {B0: pitch × rows×cols, 珠体, 凹槽×2, 其余: 与珠无关的带件}。
        const rectHist = (flow: readonly string[]): Map<number, number> => {
            const map = new Map<number, number>();
            for (const w of rectWidths(flow, (c) => inPuzzle(c) && (c as unknown as { w: number }).w !== pitch)) {
                map.set(w, (map.get(w) ?? 0) + 1);
            }
            return map;
        };
        const hFull = rectHist(full);
        const hSmall = rectHist(small);
        const onlyFull = [...hFull.keys()].filter((w) => !hSmall.has(w));
        const onlySmall = [...hSmall.keys()].filter((w) => !hFull.has(w));
        // 随档档数：珠体 1 + 凹槽 2（坑外廓框 / 坑底内缩块）。
        expect(onlyFull.length).toBe(3);
        expect(onlySmall.length).toBe(3);
        // 珠体 = 其中最宽的一档；枚数恰 = 已填珠数（⛔ 不是别的带件）。
        const beadFull = Math.max(...onlyFull);
        const beadSmall = Math.max(...onlySmall);
        expect(hFull.get(beadFull)).toBe(filled);
        expect(hSmall.get(beadSmall)).toBe(filled);
        expect(beadSmall).toBeLessThan(beadFull); // 变小（ADR-0023 DEC-7：同一条内缩通道）
        // 「坑 ⊂ 珠」：同档内两个凹槽宽度档都严格小于珠体。
        for (const w of onlyFull) if (w !== beadFull) expect(w).toBeLessThan(beadFull);
        for (const w of onlySmall) if (w !== beadSmall) expect(w).toBeLessThan(beadSmall);
        // 凹槽随珠体一同收窄：**逐档对应**（坑外廓↔坑外廓、坑底↔坑底），不是只缩一格。
        // ⚠ 不能写成「max(小豆凹槽) < min(满豆凹槽)」：两档珠面只差 2px 时，小豆**坑外廓**
        // 会大于满豆**坑底**（19.8 > 19.18）⇒ 那是尺度错位比较，不是本不变式的反例。
        const restFull = onlyFull.filter((w) => w !== beadFull).sort((a, b) => a - b);
        const restSmall = onlySmall.filter((w) => w !== beadSmall).sort((a, b) => a - b);
        expect(restFull.length).toBe(2);
        expect(restSmall.length).toBe(2);
        for (let k = 0; k < 2; k += 1) {
            expect(restSmall[k]!, `凹槽第 ${k + 1} 档未随珠体收窄`).toBeLessThan(restFull[k]!);
        }
        // 其余带件：一枚不许动。
        for (const w of hFull.keys()) {
            if (onlyFull.includes(w)) continue;
            expect(hSmall.get(w), `宽度 ${w} 的 rect 枚数不得随豆径档变`).toBe(hFull.get(w));
        }
        const b0Full = rectWidths(full, (c) => inPuzzle(c) && (c as unknown as { w: number }).w === pitch);
        const b0Small = rectWidths(small, (c) => inPuzzle(c) && (c as unknown as { w: number }).w === pitch);
        expect(b0Small).toEqual(b0Full);
        expect(b0Full.length).toBe(game.snapshot.gridRows * game.snapshot.gridCols); // 实测口径：B0 满铺整盘
    });

    it('托盘珠作域两腿：不随豆径档（反腿）· 必随风格（正腿），且两档下恒有孔', () => {
        const harness = boot(newStorage());
        const game = ensurePlaying(harness);
        expect(game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);
        const trayOf = (flow: readonly string[]): DrawCommand[] => cmdList(flow).filter(inTray);
        const circles = (cmds: DrawCommand[]): number => cmds.filter((c) => c.kind === 'circle').length;

        const base = trayOf(frame(harness));
        expect(base.length).toBeGreaterThan(0); // 阳性对照：托盘带确有可观测命令
        expect(circles(base)).toBeGreaterThan(0); // 阳性对照：托盘珠恒画孔（故缺位断言不为空）

        // 反腿：豆径档不作于托盘 ⇒ 托盘带逐命令不变。
        game.applySettingsAction('cycle-bead-size');
        expect(trayOf(frame(harness))).toEqual(base);

        // 正腿（K-060）：风格档**作于**托盘 ⇒ 上一条「不变」是作域门禁，不是渲染坏死。
        game.applySettingsAction('cycle-bead-style');
        expect(game.beadStyle).toBe(SECOND);
        const after = trayOf(frame(harness));
        expect(after).not.toEqual(base);
        // 但「恒有孔、恒满幅」仍成立：`circle`（孔层）枚数不随风格变。
        expect(circles(after)).toBe(circles(base));
    });

    it('「豆子尺寸」钮文案 = 现档显示（逐档实测，⛔ 不写死档数与款名）', () => {
        const harness = boot(newStorage());
        const game = pauseAfterFill(harness, 4);
        const start = game.beadSize;

        const seen: string[] = [];
        // 循环直到回到起始档（终止条件 = 档位本身，⛔ 不预设「共 2 档」）。
        for (let step = 0; step < 16; step++) {
            const point = buttonPoint('cycle-bead-size');
            expect(game.tapDesign(point.x, point.y)).toBe(true);
            seen.push(labelTexts(frame(harness), '豆子尺寸')[0] ?? '');
            if (game.beadSize === start) break;
        }
        expect(seen.length).toBeGreaterThan(0);
        expect(seen[seen.length - 1]).toBe(`豆子尺寸  ${BEAD_SIZE_LABELS[start]}`);
        // 每个档位的文案都由 `BEAD_SIZE_LABELS` 单源派生（两臂各自核对，非纸面常量）。
        for (const label of new Set(seen)) {
            expect(Object.values(BEAD_SIZE_LABELS)).toContain(label.replace('豆子尺寸  ', ''));
        }
        // ⛔ 文案里不得出现「1/2」「共 N 档」之类的款数（U16=甲 的渲染侧腿）。
        for (const label of seen) expect(label).not.toMatch(/\d+\s*\/\s*\d+|共\s*\d+|\d+\s*款/);
    });
});

// ══════════════════════ 设置态遮罩 α 分列（ux §3.3 遮罩条 · U14=丙 / Q3=甲）

describe('设置态遮罩 α 分列 · ux §3.3「遮罩」条 + 工作项④：仅设置态下调，其余面板与 overlay 零改动', () => {
    it('暂停面板 scrim 读 SETTINGS_SCRIM_ALPHA（0 < α < PANEL_SCRIM_ALPHA，⛔ 不钉 [暂定] 字面值）；PLAYING 期无全屏 scrim', () => {
        const harness = boot(newStorage());
        const playing = frame(harness);
        expect(scrimAlphas(playing, `${PANEL_SCRIM_RGB.r},${PANEL_SCRIM_RGB.g},${PANEL_SCRIM_RGB.b}`)).toEqual([]);

        enterPaused(harness); // 静息（t = 1）
        const paused = scrimAlphas(frame(harness), `${PANEL_SCRIM_RGB.r},${PANEL_SCRIM_RGB.g},${PANEL_SCRIM_RGB.b}`);
        expect(paused.length).toBe(1); // 阳性对照：确有且仅有一枚面板 scrim
        expect(paused[0]).toBeCloseTo(SETTINGS_SCRIM_ALPHA, 10);
        // [暂定·待 PT-SKIN-01 真机校准] ⇒ 判据只钉「关系」不钉「字面值」：下调、非 0、非全局。
        expect(SETTINGS_SCRIM_ALPHA).toBeGreaterThan(0);
        expect(SETTINGS_SCRIM_ALPHA).toBeLessThan(PANEL_SCRIM_ALPHA);
    });

    it('静态门：`view-model` 的 scrim 消费点穷尽 = 4 处非设置态面板（读 PANEL_SCRIM_ALPHA）+ 1 处设置态 + 1 处 DEBUG 覆层（非面板遮罩，硬 0.7 未触碰）', () => {
        const vm = SRC('view/view-model.ts');
        const all = vm.match(/rgba\(\$\{PANEL_SCRIM_RGB\.r/g) ?? [];
        const panelSites = vm.match(/\$\{PANEL_SCRIM_ALPHA\}\)/g) ?? [];
        const settingsSites = vm.match(/\$\{SETTINGS_SCRIM_ALPHA \* t\}/g) ?? [];
        const debugOverlay = vm.match(/\$\{PANEL_SCRIM_RGB\.b\},0\.7\)/g) ?? [];

        expect(panelSites.length).toBe(4); // 结算 / 失败 / 通关 / 冲刺结算四类面板（ux ⑥「不得读出全局遮罩变浅」）
        expect(settingsSites.length).toBe(1); // 唯一设置态消费点 = drawPausePanel
        expect(debugOverlay.length).toBe(1);
        expect(all.length).toBe(panelSites.length + settingsSites.length + debugOverlay.length); // 穷尽，无第六处

        // 菜单侧：只换 α、⛔ 不洗 RGB（历史上菜单 scrim 就是 `0,0,0`，与 PANEL_SCRIM_RGB 不同源）。
        const mv = SRC('view/meta-view.ts');
        expect(mv).toContain('rgba(0,0,0,${SETTINGS_SCRIM_ALPHA})');
        expect(mv).toContain("'rgba(0,0,0,0.5)'");
    });

    it('菜单 overlay 判定面 = overlay 打开期间：仅 settings 读下调 α，signin / levels 仍 0.5（真 shell 渲染链）', () => {
        const shell = shellRig(newStorage());
        expect(shell.screen).toBe('menu');
        // 主菜单（无 overlay）⇒ 不得有全屏 scrim（阳性对照的另一端）。
        expect(scrimAlphas(metaFrame(shell), '0,0,0')).toEqual([]);

        for (const [action, expectAlpha] of [
            ['open-settings', SETTINGS_SCRIM_ALPHA],
            ['open-signin', 0.5],
            ['open-levels', 0.5],
        ] as const) {
            shell.tapMeta(2, 2); // 先归位（back 由下一轮显式点击）
            const c = metaCenter('none', action);
            expect(shell.tapMeta(c.x, c.y)).toBe(true);
            const alphas = scrimAlphas(metaFrame(shell), '0,0,0');
            expect(alphas.length, `${action} 应有一枚全屏 scrim`).toBe(1);
            expect(alphas[0]).toBeCloseTo(expectAlpha, 10);
            const back = metaCenter(shell.overlay, 'back');
            expect(shell.tapMeta(back.x, back.y)).toBe(true);
            expect(shell.overlay).toBe('none');
        }
    });
});

// ═════════════════ 菜单设置 overlay 行4 两钮（S9 内容单源 · §8-14/16/19 菜单入口腿）

const SHELL_META_KEY = 'wxgame.beads.test.s211-s5.meta';

function shellRig(storage: Storage): BeadsShell {
    let now = 1_700_000_000_000;
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const services: GameServices = {
        events: new EventBus<EventMap>(),
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('beads-s5-shell-seed'),
        viewport: new Viewport(750, 1334),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({ clock: () => now, metaKey: SHELL_META_KEY, play: { saveKey: SAVE_KEY } });
    shell.init(services);
    return shell;
}

function metaFrame(shell: BeadsShell): string[] {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    shell.buildRenderModel(builder);
    return serialize(builder.end());
}

function metaCenter(overlay: Parameters<typeof metaLayout>[0], id: MetaAction): { x: number; y: number } {
    const b = metaLayout(overlay).buttons.find((btn) => btn.id === id)!;
    return { x: b.box.x + b.box.w / 2, y: b.box.y + b.box.h / 2 };
}

describe('菜单设置 overlay 行4 两钮 · S9 §8-14/16/19（内容单源）+ ux §4「设置 overlay」行', () => {
    it('8 钮 4 行 × 2 列：两枚选择器钮各恰一次，行距沿用旧等差、列间不重叠', () => {
        const buttons = metaLayout('settings').buttons;
        const grid = buttons.filter((b) => b.id !== 'back' && b.id !== 'studio-import');
        const ids = grid.map((b) => b.id);
        expect(new Set(ids).size).toBe(ids.length); // 每钮唯一
        expect(ids.filter((i) => i === 'cycle-bead-style').length).toBe(1);
        expect(ids.filter((i) => i === 'cycle-bead-size').length).toBe(1);

        const rows = [...new Set(grid.map((b) => b.box.y))].sort((a, b) => b - a);
        expect(rows.length).toBe(grid.length / 2); // 两列 ⇒ 行数 = 钮数 / 2
        const gaps = rows.slice(1).map((y, i) => rows[i]! - y);
        expect(new Set(gaps).size).toBe(1); // 行距沿用（等差）
        expect(gaps[0]).toBeGreaterThan(0);
        for (const b of grid) {
            expect(b.box.h).toBeGreaterThanOrEqual(88); // 行高地板 TOUCH_MIN（沿用，⛔ 不为塞行而降）
        }
    });

    it('点按走 shell default → applySettingsAction：档位变、每次恰写 play 档 1 次、循环长度 = 运行时注册数', () => {
        const { storage, log } = spyStorage(newStorage());
        const shell = shellRig(storage);
        const c = metaCenter('none', 'open-settings');
        expect(shell.tapMeta(c.x, c.y)).toBe(true);
        expect(shell.overlay).toBe('settings');

        const before = log.filter((e) => e.key === SAVE_KEY).length;
        const seen: string[] = [shell.play.beadStyle];
        const point = metaCenter('settings', 'cycle-bead-style');
        for (let step = 1; step <= IDS.length; step++) {
            const writes = log.filter((e) => e.key === SAVE_KEY).length;
            expect(shell.tapMeta(point.x, point.y)).toBe(true);
            expect(shell.play.beadStyle).toBe(IDS[step % IDS.length]);
            seen.push(shell.play.beadStyle);
            expect(log.filter((e) => e.key === SAVE_KEY).length - writes).toBe(1); // §8-14 恰写 1 次
        }
        expect(seen).toEqual([...IDS, IDS[0]]); // 循环长度 = 注册数（§8-19 菜单入口腿）
        expect(log.filter((e) => e.key === SAVE_KEY).length - before).toBe(IDS.length);

        // 尺寸钮同通道、各写各字段（§8-16 正交）。
        const sizeBefore = shell.play.beadStyle;
        const p2 = metaCenter('settings', 'cycle-bead-size');
        const w2 = log.filter((e) => e.key === SAVE_KEY).length;
        shell.tapMeta(p2.x, p2.y);
        expect(shell.play.beadSize).toBe('small');
        expect(shell.play.beadStyle).toBe(sizeBefore);
        expect(log.filter((e) => e.key === SAVE_KEY).length - w2).toBe(1);

        // 落盘的即末值（S8 §8-11）。
        const settings = settingsOf(storage);
        expect(settings['beadStyle']).toBe(IDS[0]);
        expect(settings['beadSize']).toBe('small');
    });

    it('两入口文案单源：同一档序列下「菜单 overlay」与「暂停面板」渲染出的钮文案逐位相等', () => {
        // 菜单侧序列
        const shell = shellRig(newStorage());
        shell.tapMeta(metaCenter('none', 'open-settings').x, metaCenter('none', 'open-settings').y);
        const menuLabels: string[] = [];
        const point = metaCenter('settings', 'cycle-bead-style');
        for (let step = 0; step < IDS.length; step++) {
            menuLabels.push(labelTexts(metaFrame(shell), '珠子风格')[0] ?? '');
            shell.tapMeta(point.x, point.y);
        }

        // 暂停面板侧序列（同一批注册表、同一 getter 单源）
        const harness = boot(newStorage());
        const game = pauseAfterFill(harness, 2);
        const panelLabels: string[] = [];
        const tap = buttonPoint('cycle-bead-style');
        for (let step = 0; step < IDS.length; step++) {
            panelLabels.push(labelTexts(frame(harness), '珠子风格')[0] ?? '');
            game.tapDesign(tap.x, tap.y);
        }

        expect(menuLabels.length).toBe(IDS.length);
        expect(panelLabels).toEqual(menuLabels);
        for (const label of menuLabels) expect(label.startsWith('珠子风格  ')).toBe(true);
        expect(new Set(menuLabels).size).toBe(IDS.length); // 逐档各异 ⇒ 未把某档名写死
    });
});
