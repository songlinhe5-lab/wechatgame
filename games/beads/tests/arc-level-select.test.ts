/**
 * EP13-S2 · `levels` overlay = **本大关清单** ∩ 解锁闸门（C-2 ①②④ + C-5）。
 *
 * 验收真源 = `arc-level-select-spec.md` §4 逐行（R1–R5 / R8–R12）+ 注 A（闸门逐字不动）。
 * 本文件只管**集合来源**与**入口上下文**；状态呈现（锁格/星带/按下态）归 S5 / 跟进单，
 * 走马灯按大关翻页归 S4 ⇒ ⛔ 不在本文件断言那些行。
 *
 * 关键反例臂：关池多于本大关清单时（12 关池 vs 1–9），墙 ⛔ 不得退回「全量墙」——
 * 旧实现 `_rebuildWallSlots` = 恒等全池截断 ⇒ 本臂先红。
 */

import { describe, it, expect } from 'vitest';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    NullAssetProvider,
    NullAudioBackend,
    RenderModelBuilder,
    Viewport,
    createRng,
    type DrawCommand,
    type EventMap,
    type GameServices,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { defaultBeadsSave } from '../src/game/save-schema.js';
import { LEVELS } from '../src/config/levels.js';
import { ARCS } from '../src/config/arcs.js';
import { DESIGN_H, DESIGN_W, WALL_CAPACITY, WALL_ROWS } from '../src/config/tuning.js';
import { metaLayout } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';

const PLAY_KEY = 'test.arc-select.play';
const META_KEY = 'test.arc-select.meta';

interface Rig {
    readonly shell: BeadsShell;
    readonly input: InputManager;
    readonly overlayEvents: { open: boolean; name: string }[];
    readonly now: { t: number };
}

/** 12 关池：现池 9 关 + 3 关追加（模拟 beads-studio 导入后的池长 > 大关清单）。 */
const PAD_LEVELS = [
    ...LEVELS,
    ...LEVELS.slice(0, 3).map((lv, i) => ({ ...lv, id: `pad-${i + 10}`, name: `追加${i + 10}` })),
] as unknown as typeof LEVELS;

function rig(
    opts: { maxUnlocked?: number; stars?: number[]; levels?: typeof LEVELS } = {},
): Rig {
    const now = { t: 1_000 };
    const platform = new NodePlatform({ width: DESIGN_W, height: DESIGN_H, pixelRatio: 2 });
    const storage = platform.createStorage();
    storage.set(
        PLAY_KEY,
        JSON.stringify({
            ...defaultBeadsSave(),
            ...(opts.maxUnlocked !== undefined ? { maxUnlockedLevel: opts.maxUnlocked } : {}),
            ...(opts.stars !== undefined ? { starsByLevel: opts.stars } : {}),
        }),
    );
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), staminaCur: 99 }));
    const events = new EventBus<EventMap>();
    const overlayEvents: { open: boolean; name: string }[] = [];
    (events as unknown as { on: (t: string, cb: (p: unknown) => void) => void }).on('meta:overlay', (p) =>
        overlayEvents.push(p as { open: boolean; name: string }),
    );
    const input = new InputManager();
    const services: GameServices = {
        events,
        input,
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('ep13s2-seed'),
        viewport: new Viewport(DESIGN_W, DESIGN_H),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({
        clock: () => now.t,
        metaKey: META_KEY,
        play: { saveKey: PLAY_KEY, ...(opts.levels ? { levels: opts.levels } : {}) },
    });
    shell.init(services);
    return { shell, input, overlayEvents, now };
}

const centerOf = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** 主菜单卡热区（点 Boss 图 = 开选关页）。 */
function cardBox(shell: BeadsShell) {
    return metaLayout('none', WALL_ROWS, shell.menuAnchors).buttons.find((b) => b.id === 'open-levels')!;
}

function openLevels(shell: BeadsShell): void {
    const c = centerOf(cardBox(shell).box);
    expect(shell.tapMeta(c.x, c.y), '卡 = 可点入口').toBe(true);
    expect(shell.overlay).toBe('levels');
}

/** 墙格热区（几何面：恒为 `WALL_CAPACITY` 槽；内容是本大关清单）。 */
function wallCells() {
    return metaLayout('levels', WALL_ROWS).buttons.filter((b) => b.id === 'pick-level');
}

function frameOf(shell: BeadsShell): readonly DrawCommand[] {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    shell.buildRenderModel(builder);
    return builder.end().commands;
}

/** 格内珠数（缩略 = 同心圆对 ⇒ 每珠 2 枚 circle）。 */
function beadsIn(cmds: readonly DrawCommand[], cell: { box: { x: number; y: number; w: number; h: number } }): number {
    const b = cell.box;
    const n = cmds.filter(
        (k) =>
            k.kind === 'circle' &&
            (k as { x: number }).x >= b.x &&
            (k as { x: number }).x <= b.x + b.w &&
            (k as { y: number }).y >= b.y &&
            (k as { y: number }).y <= b.y + b.h,
    ).length;
    return n / 2;
}

/** 格内空槽虚线段数（`slotDashed` 墨）。 */
function dashedIn(cmds: readonly DrawCommand[], cell: { box: { x: number; y: number; w: number; h: number } }): number {
    const b = cell.box;
    return cmds.filter(
        (k) =>
            k.kind === 'line' &&
            k.stroke === DEFAULT_PALETTE.slotDashed &&
            k.x1 >= b.x &&
            k.x1 <= b.x + b.w &&
            k.x2 >= b.x &&
            k.x2 <= b.x + b.w &&
            k.y1 >= b.y &&
            k.y1 <= b.y + b.h,
    ).length;
}

describe('EP13-S2 · 集合源 = 本大关清单（C-2 ②）', () => {
    it('反例臂：关池 12 关 > 清单 9 关 ⇒ 墙仍只列 1–9，槽 9 起零消费（⛔ 不退回全量墙）', () => {
        expect(ARCS[0]!.levelRefs, '本版大关①清单 = 关 1–9').toEqual([[1, 9]]);
        const r = rig({ maxUnlocked: 12, levels: PAD_LEVELS });
        openLevels(r.shell);
        const cells = wallCells();
        expect(cells.length, '几何槽数不变（容量 12）').toBe(WALL_CAPACITY);
        const before = r.shell.meta!.stamina;
        const eventsBefore = r.overlayEvents.length;
        // 槽 9..11 = 清单外 ⇒ 映射 undefined ⇒ 同一闸门臂（零事件、零扣心、留在本页）。
        for (const cell of cells.slice(9)) {
            const c = centerOf(cell.box);
            expect(r.shell.tapMeta(c.x, c.y), `槽 ${cell.slot} 不在大关清单内 ⇒ 不消费`).toBe(false);
        }
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.overlay).toBe('levels');
        expect(r.shell.meta!.stamina).toBe(before);
        expect(r.overlayEvents.length).toBe(eventsBefore);
        // 清单内最后一格（槽 8 = 关 9）仍可进 ⇒ 前一例不是「全墙瘫痪」的假绿。
        const last = centerOf(cells[8]!.box);
        expect(r.shell.tapMeta(last.x, last.y)).toBe(true);
        expect(r.shell.play.levelIndex).toBe(8);
    });
});

describe('EP13-S2 · 闸门与进关语义（R1–R5，注 A 逐字）', () => {
    it('R3 已解锁未通关格：扣 1 心 + 切屏 + 进该关', () => {
        const r = rig({ maxUnlocked: 9 });
        openLevels(r.shell);
        const before = r.shell.meta!.stamina;
        const c = centerOf(wallCells()[2]!.box); // 槽 2 = 关 3（索引 2）
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.levelIndex).toBe(2);
        expect(r.shell.meta!.stamina, '一格 = 一次新局 ⇒ 恰扣 1 心').toBe(before - 1);
        expect(r.shell.overlay).toBe('none');
    });

    it('R4/R5 已通关格 = 直接开新局（同一入口同扣心、零二次确认；历史星不被低星清）', () => {
        const r = rig({ maxUnlocked: 9, stars: [3, 0, 0, 0, 0, 0, 0, 0, 0] });
        openLevels(r.shell);
        const before = r.shell.meta!.stamina;
        const eventsBefore = r.overlayEvents.length;
        const c = centerOf(wallCells()[0]!.box); // 已通关格（L1，同时是当前关 ⇒ R5 叠加态）
        expect(r.shell.tapMeta(c.x, c.y), '一次 tap 即进（⛔ 无确认弹窗）').toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.levelIndex).toBe(0);
        expect(r.shell.meta!.stamina).toBe(before - 1);
        expect(r.shell.play.starsByLevelRaw[0], '历史最高星不被清零').toBe(3);
        expect(r.overlayEvents.length, '只发一条关闭事件（无中间确认态）').toBe(eventsBefore + 1);
        expect(r.overlayEvents.at(-1)).toEqual({ open: false, name: 'none' });
    });

    it('R1/R2 未解锁与越界格：同一闸门臂 ⇒ 零事件、零扣心、不消费；空槽虚线在场', () => {
        const r = rig({ maxUnlocked: 1 });
        openLevels(r.shell);
        const cmds = frameOf(r.shell);
        const before = r.shell.meta!.stamina;
        const eventsBefore = r.overlayEvents.length;
        const cells = wallCells();
        expect(beadsIn(cmds, cells[0]!), 'L1 已解锁 ⇒ 有缩略珠').toBeGreaterThan(0);
        for (const cell of cells.slice(1)) {
            const c = centerOf(cell.box);
            expect(r.shell.tapMeta(c.x, c.y), `槽 ${cell.slot} 未解锁/越界 ⇒ 不消费`).toBe(false);
            expect(beadsIn(cmds, cell), `槽 ${cell.slot} 不画珠`).toBe(0);
            expect(dashedIn(cmds, cell), `槽 ${cell.slot} 虚线空槽在场`).toBeGreaterThan(0);
        }
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.overlay).toBe('levels');
        expect(r.shell.meta!.stamina).toBe(before);
        expect(r.overlayEvents.length, '零新增事件').toBe(eventsBefore);
    });
});

describe('EP13-S2 · 本页边界（R8–R11）', () => {
    it('R8 back → 主菜单；大关页仍停 T（重开即同一墙、可直取同关）', () => {
        const r = rig({ maxUnlocked: 9 });
        openLevels(r.shell);
        const back = metaLayout('levels', WALL_ROWS).buttons.find((b) => b.id === 'back')!;
        const c = centerOf(back.box);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.overlay).toBe('none');
        expect(r.shell.screen).toBe('menu');
        expect(r.overlayEvents.at(-1)).toEqual({ open: false, name: 'none' });
        openLevels(r.shell);
        const cell = centerOf(wallCells()[3]!.box);
        expect(r.shell.tapMeta(cell.x, cell.y)).toBe(true);
        expect(r.shell.play.levelIndex).toBe(3);
    });

    it('R9 面板外零响应（不关页、零事件）', () => {
        const r = rig({ maxUnlocked: 9 });
        openLevels(r.shell);
        const eventsBefore = r.overlayEvents.length;
        expect(r.shell.tapMeta(10, 10), '遮罩区 = 零响应').toBe(false);
        expect(r.shell.overlay).toBe('levels');
        expect(r.shell.screen).toBe('menu');
        expect(r.overlayEvents.length).toBe(eventsBefore);
    });

    it('R11 本页无翻页输入（换大关必 back）', () => {
        const ids = metaLayout('levels', WALL_ROWS).buttons.map((b) => b.id);
        expect(ids).not.toContain('carousel-prev');
        expect(ids).not.toContain('carousel-next');
    });

    it('R10 菜单页手势零副作用（棋盘区 drag 不进玩法、不改状态）', () => {
        const r = rig({ maxUnlocked: 9 });
        openLevels(r.shell);
        const before = { stamina: r.shell.meta!.stamina, idx: r.shell.play.levelIndex };
        const poke = (phase: 'down' | 'move' | 'up', x: number, y: number, t: number) => {
            r.now.t = t;
            r.input.push({ id: 1, phase, x, y, time: t });
            r.shell.update(0.016);
            r.input.endFrame(0.016);
        };
        poke('down', 375, 600, 1_100);
        poke('move', 320, 640, 1_150);
        poke('up', 320, 640, 1_200);
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.overlay).toBe('levels');
        expect(r.shell.meta!.stamina).toBe(before.stamina);
        expect(r.shell.play.levelIndex).toBe(before.idx);
    });

    it('R12 空橱窗页开页 = 空清单态（全槽空、零消费；S4 前该页仍可进 = 已知过渡态）', () => {
        const r = rig({ maxUnlocked: 9 });
        // 翻到空橱窗页（◀▶ 一颗 ⇒ 动画由 update 推完）。
        const next = metaLayout('none', WALL_ROWS, r.shell.menuAnchors).buttons.find((b) => b.id === 'carousel-next')!;
        const n = centerOf(next.box);
        expect(r.shell.tapMeta(n.x, n.y)).toBe(true);
        r.now.t += 500;
        r.shell.update(0.016);
        r.now.t += 500;
        r.shell.update(0.016);
        // 该页无大关实体 ⇒ 进 overlay 后清单为空。
        openLevels(r.shell);
        const cmds = frameOf(r.shell);
        const before = r.shell.meta!.stamina;
        for (const cell of wallCells()) {
            expect(beadsIn(cmds, cell), `槽 ${cell.slot} 无珠`).toBe(0);
            expect(dashedIn(cmds, cell), `槽 ${cell.slot} 空槽语言`).toBeGreaterThan(0);
            const c = centerOf(cell.box);
            expect(r.shell.tapMeta(c.x, c.y)).toBe(false);
        }
        expect(r.shell.meta!.stamina).toBe(before);
        expect(r.shell.screen).toBe('menu');
    });
});
