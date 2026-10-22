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
// 星账夹具助手（轴从 `LEVELS` 派生，⛔ 手抄 token；K-152）。
import { starsLedger } from './helpers.js';
import { ARCS, ARC_OPEN_MAX } from '../src/config/arcs.js';
import { DESIGN_H, DESIGN_W, PANEL_IN_MS, WALL_CAPACITY, WALL_ROWS } from '../src/config/tuning.js';
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
    // WXG-T-344（ADR-0034 DEC-1）：存档侧的星账 = **身份→星**记录（从本 rig 的关表派生），
    // ⛔ 再往档里写位置型 `starsByLevel`（那 = §2.6.5 一次性入口的输入侧，不是常规形态）。
    // rig 对外仍收「按槽序的星值数组」（视图夹具的人读形状），换算只在这一处完成。
    const levelList = opts.levels ?? LEVELS;
    storage.set(
        PLAY_KEY,
        JSON.stringify({
            ...defaultBeadsSave(),
            ...(opts.maxUnlocked !== undefined ? { maxUnlockedLevel: opts.maxUnlocked } : {}),
            ...(opts.stars !== undefined ? { starsByUid: starsLedger(opts.stars, levelList) } : {}),
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
    settleFx(shell);
}

/**
 * `[WXG-T-314]` 进 / 出页转场（ux §5：入 200 / 出 150）⇒ 帧与终态断言 前先推进到静息。
 * ⚠ 多给一帧：`dt * 1000 / PANEL_IN_MS` 浮点累加可能落在 0.999…。
 */
function settleFx(shell: BeadsShell): void {
    const steps = Math.ceil(PANEL_IN_MS / 1000 / (1 / 60)) + 1;
    for (let i = 0; i < steps; i += 1) shell.update(1 / 60);
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

/** 格内星带文本数（★/☆）——「锁格⛔ 无星」的机械证据（EP13-FU-1 · Q15 合形）。 */
function starIn(cmds: readonly DrawCommand[], cell: { box: { x: number; y: number; w: number; h: number } }): number {
    const b = cell.box;
    return cmds.filter(
        (k) =>
            k.kind === 'text' &&
            /[★☆]/.test(String((k as { text?: string }).text ?? '')) &&
            (k as { x: number }).x >= b.x &&
            (k as { x: number }).x <= b.x + b.w &&
            (k as { y: number }).y >= b.y &&
            (k as { y: number }).y <= b.y + b.h,
    ).length;
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
        // ⚠ 夹具长度仍应 == `LEVELS.length`：虽然 v1.2（WXG-T-342）起 `save-schema.ts::normalizeStars`
        // 已改「长度不符 → 前缀搬运」不再清档，但短夹具会被静默搬成「前 N 位保留 + 末位 0」——
        // 测试仍是绿的，却不再暴露夹具写错（判例 K-152）。⇒ 本行按池长派生，⛔ 不写 magic 数字。
        const r = rig({ maxUnlocked: 9, stars: LEVELS.map((_, i) => (i === 0 ? 3 : 0)) });
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

    // EP13-FU-1 换形（旧尾句 = 「空槽虚线在场」）：Q15 合形 ⇒ 未解锁与越界同走锁格（闸门判据一字不动）。
    it('R1/R2 未解锁与越界格：同一闸门臂 ⇒ 零事件、零扣心、不消费；锁格合形（灰阵 + 锁 + 无虚线）', () => {
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
            expect(beadsIn(cmds, cell), `槽 ${cell.slot} 锁格 = 灰色珠阵`).toBeGreaterThan(0);
            expect(dashedIn(cmds, cell), `槽 ${cell.slot} 虚线退场`).toBe(0);
            expect(starIn(cmds, cell), `槽 ${cell.slot} 锁格⛔ 无星`).toBe(0);
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
        settleFx(r.shell);
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
        // 真机输入 = 屏幕坐标（左上原点）；热区 = 设计坐标（左下原点）⇒ 按 `Viewport.screenToDesign`
        // 的 y 翻转口径换算（本 rig 视口 1:1）。
        const poke = (phase: 'down' | 'move' | 'up', dx: number, dy: number, t: number) => {
            r.now.t = t;
            r.input.push({ id: 1, phase, x: dx, y: DESIGN_H - dy, time: t });
            r.shell.update(0.016);
            r.input.endFrame(0.016);
        };
        // UI-34 版式 P：墙已占满中部，旧「空白带」坐标（设计 y≈694–734）现落格内且同格 ⇒
        // 那是一次**正当点击**（不再是零副作用手势）。手势判据改钉**跨格拖拽**：
        // 按下 A 格、抬起 B 格 ⇒ 抬起提交门（id + slot 同钮）必须静默取消。
        const a = centerOf(wallCells()[0]!.box);
        const b = centerOf(wallCells()[2]!.box);
        poke('down', a.x, a.y, 1_100);
        poke('move', b.x, b.y, 1_150);
        poke('up', b.x, b.y, 1_200);
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.overlay).toBe('levels');
        expect(r.shell.meta!.stamina).toBe(before.stamina);
        expect(r.shell.play.levelIndex).toBe(before.idx);
    });

    it('R12 空橱窗页 = 无大关实体（S4 收口：图位零事件、不进入 overlay；空清单态本版不可达）', () => {
        const r = rig({ maxUnlocked: 9 });
        // 翻到空橱窗页（◀▶ 一颗 ⇒ 动画由 update 推完）。
        const next = metaLayout('none', WALL_ROWS, r.shell.menuAnchors).buttons.find((b) => b.id === 'carousel-next')!;
        const n = centerOf(next.box);
        // 末页 = `ARC_OPEN_MAX` 之后那一页 ⇒ 逐次点 next 并推完动画（单大关版旧文只需一轮）。
        for (let i = 0; i < ARC_OPEN_MAX; i += 1) {
            expect(r.shell.tapMeta(n.x, n.y)).toBe(true);
            r.now.t += 500;
            r.shell.update(0.016);
            r.now.t += 500;
            r.shell.update(0.016);
        }
        // 该页无 `levelRefs` ⇒ 图位零事件（R13：不切 `levels`、不发 `meta:overlay`）。
        const card = metaLayout('none', WALL_ROWS, r.shell.menuAnchors).buttons.find((b) => b.id === 'open-levels')!;
        const c = centerOf(card.box);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(false);
        expect(r.shell.overlay).toBe('none');
        expect(r.overlayEvents.length).toBe(0);
    });
});

/**
 * `[WXG-T-314]` 页面转场（ux §5：入 200 / 出 150，ease-out / ease-in）。
 * 只销三件事：时间窗口真在动、终点 = 无转场静息帧、淡出期间 overlay 仍归页（点击不误送菜单）。
 */
describe('[WXG-T-314] 选关页转场（入 200 / 出 150）', () => {
    it('进页：中点帧 ≠ 静息帧；200ms 终点 = 静息帧且后续帧逐字稳定', () => {
        const r = rig({ maxUnlocked: 9 });
        const menu = frameOf(r.shell);
        openLevels(r.shell);
        const rest = frameOf(r.shell);
        expect(rest, '整页已到').not.toEqual(menu);
        // 重新进页（不 settle）：中点仍在转场（既非纯菜单、亦非静息整页）。
        const back = metaLayout('levels', WALL_ROWS).buttons.find((b) => b.id === 'back')!;
        const bc = centerOf(back.box);
        expect(r.shell.tapMeta(bc.x, bc.y)).toBe(true);
        settleFx(r.shell);
        expect(frameOf(r.shell)).toEqual(menu);
        const c = centerOf(cardBox(r.shell).box);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        for (let i = 0; i < 6; i += 1) r.shell.update(1 / 60); // ≈100ms < 200ms
        const mid = frameOf(r.shell);
        expect(mid).not.toEqual(menu);
        expect(mid).not.toEqual(rest);
        for (let i = 0; i < 20; i += 1) r.shell.update(1 / 60); // 越 200ms
        expect(frameOf(r.shell)).toEqual(rest);
    });

    it('back：150ms 内 overlay 仍归页（零关闭事件）；到点才落 `none` + 发关闭事件', () => {
        const r = rig({ maxUnlocked: 9 });
        openLevels(r.shell);
        const before = r.overlayEvents.length;
        const back = metaLayout('levels', WALL_ROWS).buttons.find((b) => b.id === 'back')!;
        const bc = centerOf(back.box);
        expect(r.shell.tapMeta(bc.x, bc.y)).toBe(true);
        for (let i = 0; i < 6; i += 1) r.shell.update(1 / 60); // ≈100ms < 150ms
        expect(r.shell.overlay, '淡出中：命中仍归页').toBe('levels');
        expect(r.overlayEvents.length).toBe(before);
        for (let i = 0; i < 4; i += 1) r.shell.update(1 / 60); // 越 150ms
        expect(r.shell.overlay).toBe('none');
        expect(r.overlayEvents.at(-1)).toEqual({ open: false, name: 'none' });
    });

    it('[WXG-T-321] D1（reduceMotion）：进页 / 回菜单零转场，同帧即静息', () => {
        const r = rig({ maxUnlocked: 9 });
        r.shell.play.applySettingsAction('toggle-reduce-motion');
        const menu = frameOf(r.shell);
        const c = centerOf(cardBox(r.shell).box);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.overlay).toBe('levels');
        const rest = frameOf(r.shell);
        expect(rest, '整页已到').not.toEqual(menu);
        for (let i = 0; i < 30; i += 1) r.shell.update(1 / 60);
        expect(frameOf(r.shell), '无在途淡入：帧逐字不变').toEqual(rest);
        const back = metaLayout('levels', WALL_ROWS).buttons.find((b) => b.id === 'back')!;
        const bc = centerOf(back.box);
        expect(r.shell.tapMeta(bc.x, bc.y)).toBe(true);
        expect(r.shell.overlay, '同帧离页').toBe('none');
        expect(r.overlayEvents.at(-1)).toEqual({ open: false, name: 'none' });
        expect(frameOf(r.shell)).toEqual(menu);
    });
});
