/**
 * WXG-T-269-S6 · 子单 T-2A — EP12-S6 主菜单「拼豆小铺」**工程垂直切片**
 * ─────────────────────────────────────────────────────────────────────────────
 * 判据真源（⛔ 本文件零新判据、零新数值，全部为既有判据的机械复算）：
 *  - `production/epics/epics-beads-ep12.md` **§73–§78**：S6 验收①–⑦ + In/Out；
 *  - `games/beads/design/art/proposals/ui-style-redesign/menu-architecture.md` §5.1（版面）/ §5.4（三条硬口径）
 *    / §6（文案令牌）/ §7.4（P-5 次级行溢出）/ §8；
 *  - `games/beads/design/art/proposals/ui-style-redesign/level-difficulty.md` **§5.2 九关墙序**
 *    配置文件恒等序 `L1→L2→…→L9`（2026-10-10 用户裁定 #2 · 退役 EP12-S6 DI 升序 ⇒ 槽 i = 关索引 i）；
 *  - `games/beads/design/art/proposals/ui-style-redesign/tokens.md` §1（色）/ §5（字级）/ §7（对外称名）；
 *  - `docs/architecture/control-manifest.md` L4（零 RNG）/ L5（视图不持状态）/ §2（热路径零分配）。
 *
 * 本批边界（= S6 Out，⛔ 不在这里长）：珠拼 `beadText`、作品格缩略渲染、橱窗美术细案 ⇒ **T-2B**；
 * `ux-spec §4` 回写 ⇒ T-4。本文件只钉**纯工程可证面**。
 *
 * ⚠ **T-2B 进场后的口径刷新**（本文件同步改写，⛔ 不得留旧判据假绿）：
 *  - 「菜单帧只有容器图元（`line/rect/text`）」翻转为「容器族 + **珠体族**（每珠恒 7 命令）」；
 *  - 「格内编号文本」退场 ⇒ 陈列序的机械证据改为**缩略 oracle 对照**（把期望关的 `pattern` 聚合表
 *    单独画进干净 builder，与该格实测图元序列逐条 `deepEqual` ⇒ 同时钉住**位置与色**，比读编号更强）；
 *  - 「招牌 = `MENU_TITLE_Y` 处的 64px 文字」翻转为「招牌 = `beadText` 珠拼（文字令牌退居回落臂）」；
 *  - 「零新 hex」值域从 `DEFAULT_PALETTE` 扩为 `DEFAULT_PALETTE` ∪ **在册珠色族**（base + 七端点）。
 * 珠拼专属判据（位表行主序/反位探针、≤25 硬上限、三档差分实测）住
 * `menu-signage-beadtext.test.ts` / `menu-thumb-primitives.test.ts`（K-6 台账门禁已随锚定档唯一退场）。
 * [WXG-T-280] 第十四批静态档版面整体退场：主菜单 = 锚函数链唯一几何，顶栏/门楣牌逐机坐标钉
 * 与 §5.1b 落位表用例随之删除；逐机版面验收改由 `menu-anchors.test.ts` 表驱动钉不变式。
 *
 * 测试器口径：本仓 `tests/*.test.ts` = **vitest**（`pnpm -r run test`，已在 `pnpm run verify` 内），
 * 非 `node:test`；任务单「node --test 读数」按本仓惯例解读为「单测读数」。
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
    type DrawCommand,
    type EventMap,
    type GameServices,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { defaultBeadsSave } from '../src/game/save-schema.js';
import { LEVELS } from '../src/config/levels.js';
import { difficultyOf } from '../src/game/difficulty.js';
import { COPY_TOKENS } from '../src/config/copy-tokens.js';
import { buildMetaView, hitTestMeta, metaLayout, type MetaViewData } from '../src/view/meta-view.js';
import { drawLevelThumb, levelThumbCells, SIGN_INK_COLOR_IDX } from '../src/view/menu-signage.js';
import { drawFilledBead, type FilledBeadOptions } from '../src/view/bead-render.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS, beadGrayInksFor, beadInksFor } from '../src/view/palette.js';
import {
    DESIGN_H,
    DESIGN_W,
    LEVELS_CELL,
    LEVELS_GAP,
    LEVELS_THUMB_AREA,
    MENU_BOSS_SLOT,
    THUMB_MATRIX_N,
    WALL_CAPACITY,
    WALL_CELL,
    WALL_COLS,
    WALL_GAP,
    WALL_ROWS,
} from '../src/config/tuning.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
/** 网格总高（与视图同源算式，测试内自算 ⇒ ⛔ 不依赖视图私有量；验收⑥ 结构面用）。 */
const GRID_H = WALL_ROWS * WALL_CELL + (WALL_ROWS - 1) * WALL_GAP;
/** 源码级静态门用（判例 = `bead-style-settings.test.ts::SRC`）。 */
function SRC(rel: string): string {
    return readFileSync(resolve(ROOT, '..', 'src', rel), 'utf8');
}
/**
 * **去注释**后的源码（负面门专用）：史证注释里合法存在旧字面（如「旧 `'拼豆'` 已退」），
 * 不得因此把「代码里已不再有该字面」的门误红。
 */
function CODE(rel: string): string {
    return SRC(rel)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

const START = 1_700_000_000_000;
const META_KEY = 'test.t269s6.meta';
const PLAY_KEY = 'test.t269s6.play';

/** 九关墙序 = 配置文件恒等序（关号 = 索引+1；2026-10-10 #2 退役 EP12-S6 DI 升序）。 */
const WALL_ORDER_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
/** 换盘前 DI 升序（oracle 值）；仅作「⛔ 不得退回按 DI 重排」的反例基线。 */
const LEGACY_DI_ORDER = [6, 1, 8, 2, 5, 4, 3, 7, 9] as const;
/** maxUnlocked=1 时唯一已解锁关 = L1（id 1）；恒等序 ⇒ 墙槽 = 0。 */
const L1_SLOT = WALL_ORDER_IDS.indexOf(1);

interface Rig {
    readonly shell: BeadsShell;
    readonly overlayEvents: unknown[];
    readonly emitted: () => string[];
    readonly emitTo: (topic: string) => void;
    readonly staminaOf: () => number;
}

/**
 * 真框架服务 + 假钟 + 隔离存档。**`maxUnlocked` 可播种**：整墙陈列序只有在多关已解锁时
 * 才可观测（未解锁格按 §5.4 口径 2 画虚线空槽、不写编号）。
 */
function rig(opts: { maxUnlocked?: number; initialScreen?: 'play' | 'menu' } = {}): Rig {
    let now = START;
    const platform = new NodePlatform({ width: DESIGN_W, height: DESIGN_H, pixelRatio: 2 });
    const storage = platform.createStorage();
    if (opts.maxUnlocked !== undefined) {
        storage.set(PLAY_KEY, JSON.stringify({ ...defaultBeadsSave(), maxUnlockedLevel: opts.maxUnlocked }));
    }
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), staminaCur: 99 }));
    const events = new EventBus<EventMap>();
    const overlayEvents: unknown[] = [];
    (events as unknown as { on: (t: string, cb: (p: unknown) => void) => void }).on('meta:overlay', (p) =>
        overlayEvents.push(p),
    );
    // 事件采集（验收⑦）：shadow `emit`，把两腿（总线内部 `this.emit` / 外部 `services.events.emit`）都走同一入口。
    const topics: string[] = [];
    const bus = events as unknown as { emit: (t: string, p: unknown) => void };
    const origEmit = bus.emit.bind(bus);
    bus.emit = (t: string, p: unknown): void => {
        topics.push(t);
        origEmit(t, p);
    };
    const services: GameServices = {
        events,
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('t269s6-seed'),
        viewport: new Viewport(DESIGN_W, DESIGN_H),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({
        clock: () => now,
        metaKey: META_KEY,
        play: { saveKey: PLAY_KEY },
        ...(opts.initialScreen ? { initialScreen: opts.initialScreen } : {}),
    });
    shell.init(services);
    return {
        shell,
        overlayEvents,
        emitted: () => [...topics],
        emitTo: (t: string) => bus.emit(t, {}),
        staminaOf: () => shell.meta!.stamina,
    };
}

/** 走真渲染链（shell.buildRenderModel ⇒ buildMetaView），不手搜视图入参。 */
function frameOf(shell: BeadsShell): readonly DrawCommand[] {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    shell.buildRenderModel(builder);
    return builder.end().commands;
}
/** 菜单帧（shell 默认在菜单、`overlay = 'none'`）。 */
function menuFrame(shell: BeadsShell): readonly DrawCommand[] {
    return frameOf(shell);
}
/**
 * Boss 图位热区（`[WXG-T-281]` 白卡退场：点 Boss 图进选关 ⇒ 图位 = 菜单唯一选关入口，`id = 'open-levels'`）。
 * `[WXG-T-281]` 传入 shell ⇒ 用其 init 实锚（与 `tapMeta` 同源）；缺省走默认档只供结构/几何断言。
 */
function cardBox(shell?: BeadsShell) {
    return anchoredLayout(shell).buttons.find((b) => b.id === 'open-levels')!;
}
/** 锚定档主菜单版面：有 shell ⇒ 实锚；无 ⇒ 模块级默认档（⛔ 不混用两档坐标去 tap 另一档热区）。 */
function anchoredLayout(shell?: BeadsShell) {
    return metaLayout('none', WALL_ROWS, shell?.menuAnchors);
}
/** 把 shell 推进 `levels` overlay（点走马灯卡 ⇒ 墙所在屏）。 */
function openLevels(shell: BeadsShell): void {
    const c = centerOf(cardBox(shell).box);
    expect(shell.tapMeta(c.x, c.y), '卡 = 可点入口').toBe(true);
    expect(shell.overlay).toBe('levels');
}
/** **选关页帧**（先点卡开 overlay ⇒ 墙格内容在此可观测）。 */
function levelsFrame(shell: BeadsShell): readonly DrawCommand[] {
    openLevels(shell);
    return frameOf(shell);
}

/**
 * 作品墙格（墙下移 `levels` overlay 后住这里 ⇒ 与菜单共用同一 `levelsLayout` 几何）。
 * ⚠ EP13-S2 起**集合源已换**：墙 = 本大关清单（`arcs.ts::levelRefs` 展开），不再全量墙。
 * 本池恰 1 大关且清单含全池 ⇒ 本文件原断言**数值不变**（如实保留，不造假形）；集合源换形
 * 的真判据（池 12 > 清单 9 反例臂）在 `arc-level-select.test.ts`。
 */
function wallCells() {
    return metaLayout('levels').buttons.filter((b) => b.id === 'pick-level');
}

function centerOf(box: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
    return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** 同上，但成 tuple（供 `tapMeta(x, y)` / `hitTestMeta` 展开）。 */
function centerTuple(box: { x: number; y: number; w: number; h: number }): [number, number] {
    const c = centerOf(box);
    return [c.x, c.y];
}

/**
 * 珠体族图元的**空间签名**（格内 `circle` 序列 = 每珠两枚同心圆 ⇒ 珠心坐标 + 孔墨）。
 * T-2B 起「格内容 = 珠拼缩略」⇒ 编号文本已退场（本文件旧 `cellNumber()` 通道作废）；
 * 陈列序证据改由 {@link thumbOracle} 对照给出。
 */
function beadSignatureIn(
    cmds: readonly DrawCommand[],
    box: { x: number; y: number; w: number; h: number },
): string {
    return cmds
        .filter((k) => {
            if (k.kind !== 'circle') return false;
            const c = k as { x: number; y: number };
            return c.x >= box.x && c.x <= box.x + box.w && c.y >= box.y && c.y <= box.y + box.h;
        })
        .map((k) => {
            const c = k as { x: number; y: number; r: number; fill?: string };
            return `${c.x}|${c.y}|${c.r}|${c.fill ?? ''}`;
        })
        .join('\n');
}

/**
 * 把**期望关**的缩略单独画进干净 builder ⇒ 与该格实测序列逐条对撞（⛔ 不读屏上文字反推关号）。
 * ⚠ UI-34 起选关 = 整页版式 P：缩略边长走页专用 `LEVELS_THUMB_AREA`（134）
 * ⇒ oracle 必须**同参复算**，否则默认档 84 与生产签名恒失配（假红）。
 */
function thumbOracle(level: (typeof LEVELS)[number], box: { x: number; y: number; w: number; h: number }): string {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    drawLevelThumb(builder, level, box.x, box.y, box.w, box.h, THUMB_MATRIX_N, LEVELS_THUMB_AREA);
    return beadSignatureIn(builder.end().commands, box);
}

/**
 * 按实测缩略反读每格是哪一关（oracle 命中关号；无命中 ⇒ 0，断言会指名哪格失配）。
 * 本池九关的 5×5 缩略签名两两不同（由下节「阳性对照」例钉死 ⇒ 本反读无歧义）。
 */
function levelIdByThumb(cmds: readonly DrawCommand[], cell: { box: { x: number; y: number; w: number; h: number } }): number {
    const sig = beadSignatureIn(cmds, cell.box);
    for (let i = 0; i < LEVELS.length; i++) {
        if (sig !== '' && sig === thumbOracle(LEVELS[i]!, cell.box)) return i + 1;
    }
    return 0;
}

/** 格内珠体数（= 缩略实际画出的珠；未解锁 / 越界槽必为 0）。 */
function beadsInCell(cmds: readonly DrawCommand[], cell: { box: { x: number; y: number; w: number; h: number } }): number {
    return beadSignatureIn(cmds, cell.box).split('\n').filter((s) => s.length > 0).length / 2;
}

/** 格内星带文本数（★/☆ 串）——「锁格⛔ 无星」的机械证据（EP13-FU-1 · tls §4 Q15 合形）。 */
function starTextIn(cmds: readonly DrawCommand[], cell: { box: { x: number; y: number; w: number; h: number } }): number {
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

/** 格内虚线（`slot_dashed`）段数——「虚线空槽」的机械证据。 */
function dashedSegmentsIn(cmds: readonly DrawCommand[], cell: { box: { x: number; y: number; w: number; h: number } }): number {
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

describe('EP12-S6 前置 · 关表与 DI 真源（S5 消费面，⛔ 不复算公式）', () => {
    it('关号 = 索引+1（陈列序在本池无二义：视图显示的 `索引+1` 即 `id`）', () => {
        expect(LEVELS.map((lv) => lv.id)).toEqual(LEVELS.map((_, i) => i + 1));
    });

    it('DI 逐关实算且**本池无并列**（⇒ tie-break「关号升序」分支在九关池不可达，诚实登记）', () => {
        const dis = LEVELS.map((lv) => difficultyOf(lv).di);
        expect(new Set(dis).size, dis.join(',')).toBe(dis.length);
    });
});

describe('EP12-S6 Deliverable 2 · 陈列序 = 配置文件恒等序（#2 反转：退役 DI 升序重排）', () => {
    it('选关页九格**缩略逐位复现** §5.2：L1→L2→…→L9（恒等配置序，墙下移 `levels` overlay）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const cmds = levelsFrame(r.shell);
        const seq = wallCells()
            .slice(0, LEVELS.length)
            .map((cell) => levelIdByThumb(cmds, cell));
        expect(seq, `实读（oracle 反读） ${seq.join('→')}`).toEqual([...WALL_ORDER_IDS]);
    });

    it('**阳性对照**（K-060）：九关的 5×5 聚合表**两两不同** ⇒ 上一例的 oracle 反读不可能是“恒等空断言”', () => {
        // ⚠ 拿**归一化聚合表**（r,c,colorIdx 三元组）比，⛔ 拿屏上坐标比（坐标含格位 ⇒ 必然 81 个皆不同，断言无意义）。
        const sigs = new Set<string>();
        for (const lv of LEVELS) {
            const cells = levelThumbCells(lv, THUMB_MATRIX_N);
            expect(cells.length, `L${lv.id} 缩略不得为空表（本池九关均有色块）`).toBeGreaterThan(0);
            sigs.add(cells.join(','));
        }
        expect(sigs.size, '九关聚合表互异 ⇒ 错映射必失配').toBe(LEVELS.length);
    });

    it('**反例锁**（反转）：⛔ 不得退回 EP12-S6「按 DI 升序重排」（基线 = 换盘前 oracle 序）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const cmds = levelsFrame(r.shell);
        const seq = wallCells()
            .slice(0, LEVELS.length)
            .map((cell) => levelIdByThumb(cmds, cell));
        // 恒等序即正确（上一例「阳性对照」已证九格缩略两两不同 ⇒ 非空断言）。
        expect(seq, '若红 = 陈列又按 DI 重排（#2 反转失效）').toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(seq, '⛔ 不得等于换盘前 DI 升序').not.toEqual([...LEGACY_DI_ORDER]);
    });

    it('**行为腿**：点槽 1 → 落 L2（索引 1），陈列序 = 关索引（恒等配置序）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        openLevels(r.shell); // 墙下移 `levels` overlay ⇒ 先在选关页点格
        const c = centerOf(wallCells()[1]!.box);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.levelIndex, '槽 1 = 关索引 1（L2）').toBe(1);
        expect(r.shell.play.levelIndex + 1).toBe(WALL_ORDER_IDS[1]);
    });

    it('静态门：`MetaButton` 只携 `slot`（关索引在视图侧无从存在）⇒ 回归根因被结构封死', () => {
        const cells = wallCells();
        expect(cells.length).toBe(WALL_CAPACITY);
        for (const b of cells) {
            expect(b.slot, '槽位字段在场').toBeTypeOf('number');
            expect('levelIndex' in b, '⛔ 不得再有 levelIndex').toBe(false);
        }
        expect(CODE('game/beads-shell.ts')).toContain('btn.slot');
        expect(CODE('game/beads-shell.ts'), '旧「按槽当关」取值面必须消失').not.toContain('btn.levelIndex');
    });

    it('热路径：陈列序恒等 ⇒ 运行时零排序（`_rebuildWallSlots` 不再 `.sort(`、每帧腿零分配）', () => {
        const shellSrc = CODE('game/beads-shell.ts');
        const sorts = shellSrc.match(/\.sort\(/g) ?? [];
        expect(sorts.length, '全 shell 零 .sort(（2026-10-10 #2 反转：恒等序无需排序）').toBe(0);
        expect(CODE('view/meta-view.ts'), '视图侧⛔ 不排序').not.toContain('.sort(');
        // 版面缓存同一性（每帧 `metaLayout` 不得新建对象）。
        expect(metaLayout('none')).toBe(metaLayout('none'));
        expect(wallCells()[0]!.box).toBe(wallCells()[0]!.box);
        // 逐帧命令数恒等 ⇒ 无随帧增长的对象/字符串迹象。
        const r = rig({ maxUnlocked: LEVELS.length });
        const lens = [menuFrame(r.shell).length, menuFrame(r.shell).length, menuFrame(r.shell).length];
        expect(lens[1]).toBe(lens[0]);
        expect(lens[2]).toBe(lens[0]);
        // 星级标签走查表（旧每帧 `'★'.repeat(n)` 已收敛）。
        expect(CODE('view/meta-view.ts')).not.toContain("'★'.repeat");
    });
});

describe('EP12-S6 Deliverable 3 · 三条硬口径（§5.4）+ 未解锁零热区（验收⑥）', () => {
    it('口径①：主钮 = **当前关**（与墙格解耦，点格改关后主钮跟随该关）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        openLevels(r.shell); // 墙下移 `levels` overlay ⇒ 格在选关页可点
        const cell = wallCells()[2]!; // 槽 2 = L3 = 索引 2（恒等配置序）
        r.shell.tapMeta(...centerTuple(cell.box));
        expect(r.shell.play.levelIndex).toBe(2);
        r.shell.showMenu();
        const start = anchoredLayout(r.shell).buttons.find((b) => b.id === 'start')!;
        const sc = centerOf(start.box);
        expect(r.shell.tapMeta(sc.x, sc.y)).toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.levelIndex, '主钮开的是**当前关**（2），不是槽位号、也不是首关').toBe(2);
    });

    it('口径②：墙格 = **指定关**（点槽 8 直达 L9）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        openLevels(r.shell); // 墙住 `levels` overlay
        const cell = wallCells()[8]!;
        const c = centerOf(cell.box);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.play.levelIndex).toBe(WALL_ORDER_IDS[8]! - 1);
    });

    it('口径③：主菜单入口 = **走马灯卡**（`open-levels`）+ 主钮 + 顶栏设置钮（菜单主区⛔ 无墙格泄漏）', () => {
        const ids = new Set(metaLayout('none').buttons.map((b) => b.id));
        expect(ids.has('open-levels'), '§1.3：卡 = 菜单唯一选关入口').toBe(true);
        expect(ids.has('pick-level'), '菜单主区⛔ 不再排墙格（墙下移 overlay）').toBe(false);
        // §5.1b 第三批：右上两颗（公告 / 信箱）= 预留不实现 ⇒ **不注册热区**；底部次级行整行退役。
        // [WXG-T-280] 锚定档：橱窗卡两侧 ◀▶ 翻页两颗进热区集（落地单 §3）。
        expect([...ids].sort()).toEqual(['carousel-next', 'carousel-prev', 'open-levels', 'open-settings', 'start']);
        // 扫面（16×16 步长）：菜单全域可命中的动作集恰等于上面五个 ⇒ 无暗道。
        const scanned = new Set<string>();
        for (let x = 0; x <= DESIGN_W; x += 16) {
            for (let y = 0; y <= DESIGN_H; y += 16) {
                const b = hitTestMeta('none', x, y);
                if (b) scanned.add(b.id);
            }
        }
        expect([...scanned].sort()).toEqual(['carousel-next', 'carousel-prev', 'open-levels', 'open-settings', 'start']);
    });

    // EP13-FU-1 换形（旧口径 = 「未解锁格 = 虚线空槽」，~~无🔒字样~~ ⇒ Q15 2026-10-17 改裁**合形**）：
    it('未解锁格 = 锁格合形（灰阵 + 锁 + 无星 + 无虚线）+ 零热区零事件（墙住 `levels` overlay）', () => {
        const r = rig(); // maxUnlocked = 1 ⇒ 仅 L1 所在墙槽（恒等序 = 槽 0）已解锁，其余锁
        const before = r.staminaOf();
        const cmds = levelsFrame(r.shell); // 先点卡进选关页 ⇒ 墙格内容可观测
        const eventsBefore = r.overlayEvents.length; // 开页那一次 `meta:overlay` 已记录
        const cells = wallCells();
        const unlocked = cells[L1_SLOT]!;
        expect(levelIdByThumb(cmds, unlocked), `槽 ${L1_SLOT} = L1 已解锁 ⇒ 缩略命中 L1`).toBe(1);
        expect(beadsInCell(cmds, unlocked), '已解锁格有珠').toBeGreaterThan(0);
        expect(dashedSegmentsIn(cmds, unlocked)).toBe(0);
        for (const locked of cells.slice(0, LEVELS.length).filter((c) => c.slot !== L1_SLOT)) {
            const c = centerOf(locked.box);
            expect(r.shell.tapMeta(c.x, c.y), `槽 ${locked.slot} 未解锁 ⇒ 不被消费`).toBe(false);
            expect(beadsInCell(cmds, locked), '未解锁格 = 灰色珠阵（Q15 合形，⛔ 不再是空槽）').toBeGreaterThan(0);
            expect(dashedSegmentsIn(cmds, locked), '虚线空槽在墙格路径退场').toBe(0);
            expect(starTextIn(cmds, locked), '锁格⛔ 无星带').toBe(0);
        }
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.overlay, '点未解锁格不换页').toBe('levels');
        expect(r.staminaOf()).toBe(before);
        expect(r.overlayEvents.length, '零新增事件：未解锁格不发 `meta:*`').toBe(eventsBefore);
        // 未解锁格内⛔ 不出现「未解锁」类**教学文字**（§5.4 0 文字教学）；锁章字「锁」= 既有徽标回落语言（EP13-FU-1）。
        const texts = cmds.filter((k) => k.kind === 'text').map((k) => String((k as { text?: string }).text ?? ''));
        expect(texts.some((t) => t.includes('未解锁') || t.includes('🔒')), texts.join('|')).toBe(false);
    });

    // EP13-FU-1 换形（旧口径 = 「越界槽 = 虚线空槽」）：3×3 = 9 槽与现池 9 关**恰满** ⇒ 生产路径不再有越界槽。
    // 空循环会假绿 ⇒ 本臂改钉「不可达」这一事实；越界呈现由 `arc-wall-locked.test.ts` 用人为短清单覆盖。
    it('越界槽在本版不可达（容量 9 = 关池 9）；溢出不得误接关（S6 Out 不变）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const before = r.staminaOf();
        levelsFrame(r.shell);
        expect(wallCells(), '墙 = 容量格数').toHaveLength(WALL_CAPACITY);
        expect(WALL_CAPACITY, '3×3 改版后容量与关池齐满').toBe(LEVELS.length);
        expect(wallCells().slice(LEVELS.length), '容量 = 关数 ⇒ 无越界槽').toHaveLength(0);
        expect(r.shell.screen).toBe('menu');
        expect(r.staminaOf(), '不可达路径零扣心').toBe(before);
    });

    it('验收⑥：Boss 图位 = **单热区**（图内共一块、图外留白零热区；装饰层不建子钮）[WXG-T-281]', () => {
        const b = cardBox().box;
        // ① 图位内任意点（白板 / 豆画 / 四角）都命中同一块 `open-levels` 热区 ⇒ 图位零子钮。
        for (const [dx, dy] of [
            [6, 6],
            [b.w / 2, b.h / 2],
            [b.w - 6, 6],
            [6, b.h - 6],
        ] as const) {
            expect(hitTestMeta('none', b.x + dx, b.y + dy)?.id, `图位内 (${dx},${dy}) = 选关热区`).toBe('open-levels');
        }
        // ② 图位左/右留白落空（图位宽 468 ≪ 750 ⇒ 两侧各留白 141）。
        const outside: [number, number][] = [
            [b.x - 30, b.y + b.h / 2],
            [b.x + b.w + 30, b.y + b.h / 2],
        ];
        for (const [x, y] of outside) expect(hitTestMeta('none', x, y), `图位外 (${x},${y})`).toBeNull();
        // ③ 结构面：热区清单里没有任何「整屏 / 整墙」尺寸的对象（图位是唯一大块，尺寸恒 = `MENU_BOSS_SLOT` 预算）。
        for (const btn of metaLayout('none').buttons) {
            expect(btn.box.w >= DESIGN_W * 0.9 && btn.box.h >= GRID_H, '纸底级热区不得存在').toBe(false);
        }
        expect(b.w).toBe(MENU_BOSS_SLOT.w);
        expect(b.h).toBe(MENU_BOSS_SLOT.h);
    });
});

describe('EP12-S6 Deliverable 5 · P-7 文案令牌单源（⛔ 屏内字面散落）', () => {
    it('`COPY_TOKENS` 逐值对齐 `tokens.md §7` / `menu-architecture §6`（消费副本 ≠ 真源即红）', () => {
        expect(COPY_TOKENS.app_name).toBe('拼豆小铺');
        expect(COPY_TOKENS.app_slogan).toBe('一颗一颗，拼出你的小铺');
        expect(COPY_TOKENS.version_label).toBe('v1.x · 演示版');
        expect(COPY_TOKENS.btn_start_label, '§6：取实装值（原「开始拼豆」降为史证）').toBe('开始游戏');
        expect(COPY_TOKENS.btn_signin_label).toBe('签到');
        expect(COPY_TOKENS.btn_settings_label).toBe('设置');
        expect(COPY_TOKENS.btn_levels_label, '退役键：入口退役 ≠ 字面作废（levels overlay 仍读）').toBe('选关');
    });

    it('钮标签读令牌（主钮）；顶栏圆钮⛔ 无文字（§5.1b 图标件）；白卡文字带退场 [WXG-T-281]', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const texts = new Set(
            menuFrame(r.shell)
                .filter((k) => k.kind === 'text')
                .map((k) => String((k as { text?: string }).text)),
        );
        expect(texts.has(COPY_TOKENS.btn_start_label)).toBe(true);
        // `[WXG-T-281]` 用户裁定：走马灯中间只展示 Boss 图 ⇒ 菜单帧不再画进度/选关字面（令牌仍在，overlay 标题读）。
        expect(texts.has(COPY_TOKENS.btn_levels_label), '白卡文字带退场 ⇒ 菜单帧不再出现').toBe(false);
        // 底部次级行退役 + 设置改顶栏圆钮 ⇒ 菜单帧不再出现这两个字面（令牌本身仍在，overlay 标题读）。
        expect(texts.has(COPY_TOKENS.btn_signin_label), '签到纸钮退役 ⇒ 菜单帧不再出现').toBe(false);
        expect(texts.has(COPY_TOKENS.btn_settings_label), '设置 = 图标件（无文字）').toBe(false);
        expect(texts.has('开始拼豆'), '旧字面不得残留').toBe(false);
    });

    it('静态门：视图源内标题字面已退场 + 令牌 import 在场', () => {
        const mv = CODE('view/meta-view.ts');
        expect(mv).toContain("from '../config/copy-tokens.js'");
        expect(mv, "⛔ 代码里不再有 '拼豆' 裸字面（app_name 令牌单源）").not.toContain("'拼豆'");
        expect(mv, "⛔ 也不得出现旧钮字面 '开始拼豆'").not.toContain('开始拼豆');
    });
});

describe('EP12-S6 Deliverable 1 + Q5① · 墙单源在选关整页 / 主菜单不再排墙（几何只一份）', () => {
    it('墙 = 3×3 共 9 格（只住选关整页，版式 P）；主菜单 ⛔ 无墙格 ⇒ 几何单份、永不各排一份', () => {
        const overlay = metaLayout('levels').buttons.filter((b) => b.id === 'pick-level');
        expect(overlay.length).toBe(WALL_CAPACITY);
        for (const cell of overlay) {
            expect(cell.box.w, '格宽 = 页专用常量').toBe(LEVELS_CELL);
            expect(cell.box.h).toBe(LEVELS_CELL);
        }
        // 列/行步进同源自洽（同一 `levelsLayout` 一次算定）。
        const step = (list: typeof overlay, i: number) => list[i + 1]!.box.x - list[i]!.box.x;
        expect(step(overlay, 1), '列步进一致').toBe(step(overlay, 0));
        const rowStep = overlay[0]!.box.y - overlay[WALL_COLS]!.box.y;
        expect(rowStep, '行步进 = 格宽 + 缝').toBe(LEVELS_CELL + LEVELS_GAP);
        // 主菜单版面⛔ 无墙格（走马灯卡取代主区）⇒ 选关入口 = `open-levels`。
        expect(metaLayout('none').buttons.filter((b) => b.id === 'pick-level').length).toBe(0);
        expect(metaLayout('none').buttons.some((b) => b.id === 'open-levels')).toBe(true);
    });

    it('`levels` overlay 仍可渲染与命中（入口隐藏 ≠ 代码删除；此处直接驱动视图，宿主/测试同法）', () => {
        const data: MetaViewData = Object.freeze({
            stamina: 5,
            staminaMax: 5,
            coins: 0,
            overlay: 'levels' as const,
            signinDay: 0,
            canClaim: false,
            bgmMuted: false,
            sfxMuted: false,
            reduceMotion: false,
            largeText: false,
            vibrate: true,
            debugInfo: false,
            debugGuides: false,
            beadStyle: 'facet-4',
            beadSize: 'full' as const,
            skinId: 'tokens',
            levelCount: LEVELS.length,
            currentLevelIndex: 0,
            maxUnlockedLevel: LEVELS.length,
            starsByLevel: Object.freeze([3, 2, 1, 0, 0, 0, 0, 0, 0]),
            wallSlots: Object.freeze([...WALL_ORDER_IDS.map((id) => id - 1)]),
            // T-2B：珠拼缩略需关卡本体 ⇒ 与 wallSlots 同序同长（本例直接驱动视图，无 shell 可依）。
            wallLevels: Object.freeze(WALL_ORDER_IDS.map((id) => LEVELS[id - 1]!)),
            // 走马灯 Boss 图（[WXG-T-281]）：本例只渲 `levels` overlay ⇒ 图位字段不参与本帧渲染，补齐满足入参形状。
            carouselLevel: LEVELS[WALL_ORDER_IDS[2]! - 1],
        });
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        buildMetaView(builder, data, DEFAULT_PALETTE);
        const cmds = builder.end().commands;
        const title = cmds.find((k) => k.kind === 'text' && (k as { text?: string }).text === COPY_TOKENS.btn_levels_label);
        expect(title, 'overlay 标题仍读表').toBeDefined();
        const back = metaLayout('levels').buttons.find((b) => b.id === 'back')!;
        expect(hitTestMeta('levels', ...centerTuple(back.box))?.id).toBe('back');
        // overlay 的格也走**同一 renderer** ⇒ 陈列序一致、缩略与主菜单同源（同一 oracle 通道）。
        const seq = metaLayout('levels')
            .buttons.filter((b) => b.id === 'pick-level')
            .slice(0, LEVELS.length)
            .map((cell) => levelIdByThumb(cmds, cell));
        expect(seq).toEqual([...WALL_ORDER_IDS]);
    });

    it('L5：视图对**冻结入参**只读（两次调用输出全等 ⇒ 不持状态、不写回）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const a = menuFrame(r.shell);
        const b = menuFrame(r.shell);
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
        // 视图模块不得从 game 侧**值导入**状态对象（type-only 除外）。
        const mv = CODE('view/meta-view.ts');
        expect(mv, '⛔ 无 ../game/* 值导入').not.toMatch(/^import (?!type).*from '\.\.\/game\//m);
        expect(mv).not.toContain('import { BeadsGame');
        expect(mv).not.toMatch(/\bexport (let|var)\b/);
    });
});

/**
 * **珠体通道可发射色集**（零新 hex 门的另一半，口径 = 同通道可发射而非“端点表”）：
 * 把菜单帧实际走的同一条通道（`bead-render.ts::drawFilledBead`，传 `targetColorIdx` 的口径 B 分支）
 * 对**每一关 × 每一个色索引**跑一次，收集它发射的全部 fill/stroke。
 * ⇒ 本门的断言是「菜单帧的珠色 ⊆ 玩法珠体在同一墨源下本来就能发出的色集」，
 * 而不是把 facet-4 的棱面 mix 常数叉乘一遍（那会发明第二份色源）。⛔ 不造色值、不 mix 新档。
 */
function beadChannelColors(): Set<string> {
    const set = new Set<string>();
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    const opts: { size: number; inks: typeof DEMO_BEAD_INKS; targetColorIdx: number } = {
        size: 22,
        inks: DEMO_BEAD_INKS,
        targetColorIdx: 1,
    };
    const push = (inks: typeof DEMO_BEAD_INKS, idx: number): void => {
        opts.inks = inks;
        opts.targetColorIdx = idx;
        builder.begin();
        drawFilledBead(builder, 100, 100, idx, opts as FilledBeadOptions);
        for (const c of builder.end().commands) {
            const rec = c as { fill?: string; stroke?: string };
            if (rec.fill !== undefined) set.add(rec.fill);
            if (rec.stroke !== undefined) set.add(rec.stroke);
        }
    };
    for (const lv of LEVELS) {
        const inks = beadInksFor(lv);
        for (let i = 1; i <= inks.hexes.length; i++) push(inks, i);
        // `[WXG-T-281]` 在册灰度墨集（`palette.ts::beadGrayInksFor`，单源 = 关卡墨置灰）⇒ 同通道，非第二份色源。
        const gray = beadGrayInksFor(lv);
        for (let i = 1; i <= gray.hexes.length; i++) push(gray, i);
    }
    for (let i = 1; i <= DEMO_BEAD_INKS.hexes.length; i++) push(DEMO_BEAD_INKS, i);
    push(DEMO_BEAD_INKS, SIGN_INK_COLOR_IDX);
    return set;
}

describe('EP12-S6 边界与铁律自证 · 珠体族只进菜单帧 / 零新色 / L4 / §3 零变更', () => {

    it('零新 hex：菜单帧所有 fill/stroke ∈ `DEFAULT_PALETTE` ∪ **珠体通道可发射色集**（同通道、非第二份色源）', () => {
        const paletteColors = new Set(Object.values(DEFAULT_PALETTE).filter((v): v is string => typeof v === 'string'));
        const beadColors = beadChannelColors();
        const r = rig({ maxUnlocked: LEVELS.length });
        const cmds = menuFrame(r.shell);
        const offenders: string[] = [];
        for (const k of cmds) {
            const rec = k as { fill?: string; stroke?: string };
            for (const c of [rec.fill, rec.stroke]) {
                if (c === undefined) continue;
                if (paletteColors.has(c) || beadColors.has(c)) continue;
                offenders.push(`${k.kind}:${c}`);
            }
        }
        expect(offenders.slice(0, 8), `越界色值（共 ${offenders.length} 条）`).toEqual([]);
        // 橱窗语言的具体消费面（木框 = wood_face、纸底 = panel、空槽 = slot_dashed）。
        const frame = cmds.find((k) => k.kind === 'rect' && k.fill === DEFAULT_PALETTE.woodFace);
        expect(frame, '木框面读 wood_face（零新 hex）').toBeDefined();
        expect(DEFAULT_PALETTE.slotDashed, '空槽虚线 = tokens.md §1 slot_dashed').toBe('#C9C5DA');
        // 新文件本体也不得带 hex 字面（色值只准来自上述两条在册通道）。
        for (const f of ['view/menu-signage.ts', 'config/sign-glyphs.ts']) {
            const hexes = CODE(f).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
            expect(hexes, `${f} ⛔ 不得出现 hex 字面（零新色）`).toEqual([]);
        }
    });

    it('L4 零 RNG：本批改动文件不出现 Math.random / createRng（位表/聚合/陈列序均确定性）', () => {
        for (const f of [
            'view/meta-view.ts',
            'view/menu-signage.ts',
            'game/beads-shell.ts',
            'config/tuning.ts',
            'config/copy-tokens.ts',
            'config/sign-glyphs.ts',
        ]) {
            const src = CODE(f);
            expect(src, `${f} 不得含 Math.random`).not.toMatch(/Math\.random\s*\(/);
            expect(src, `${f} 不得引入 rng`).not.toContain('createRng');
        }
    });

    it('§3 零变更自证：本批新常量名不在 `systems-index.md` §3（新值只住 `tuning.ts` 派生区）', () => {
        const idx = readFileSync(resolve(ROOT, '..', 'design', 'gdd', 'systems-index.md'), 'utf8');
        for (const name of [
            // 顶栏一组（§5.1b，2026-10-13）：同样只住 `tuning.ts` 派生区，⛔ 不入 §3。
            'MENU_TOPBAR_X',
            'MENU_TOPBAR_VISUAL_D',
            'MENU_TOPBAR_RESERVED_ALPHA',
            'MENU_TOPBAR_TOP_FALLBACK',
            'MENU_TITLE_Y',
            'MENU_SLOGAN_Y',
            'MENU_VERSION_Y',
            'WALL_COLS',
            'WALL_ROWS',
            'WALL_CELL',
            'WALL_GAP',
            'WALL_CAPACITY',
            'WALL_FRAME_INSET',
            'WALL_GRID_TOP',
            'WALL_SLOT_DASH',
            // UI-34 选关整页版面（版式 P，正本 = `level-select-page-layout.md` v0.2）：页专用 ⇒ ⛔ 不入 §3。
            'LEVELS_CELL',
            'LEVELS_GAP',
            'LEVELS_GRID_LEFT',
            'LEVELS_GRID_TOP',
            'LEVELS_THUMB_AREA',
            'LEVELS_BACK_W',
            'LEVELS_BACK_BOTTOM',
            'LEVELS_NAV_H',
            'LEVELS_NAV_TOP',
            // T-2B 新增两组（SIGN_* / THUMB_*）同样只住 `tuning.ts` 派生区（判例 DIFFICULTY / PAUSE_PANEL_H）。
            'SIGN_MATRIX_N',
            'SIGN_BEAD_PITCH',
            'SIGN_GLYPH_BOX',
            'SIGN_GLYPH_GAP',
            'SIGN_TOTAL_W',
            'SIGN_AVAIL_W',
            'SIGN_FACE_FLOOR',
            'SIGN_FACE_RATIO',
            'SIGN_INK_IDX',
            'SIGN_PITCH_MIN_B',
            'SIGN_FALLBACK_MATRIX_N',
            'THUMB_MATRIX_N',
            'THUMB_AREA',
            'THUMB_BEADS_MAX',
            'THUMB_TIERS',
            'THUMB_STAR_BAND',
            'THUMB_TOP_INSET',
            'WALL_SLOT_FALLBACK_CELL',
            // 走马灯小卡一组（§1.3 第五轮）：同样只住 `tuning.ts` 派生区，⛔ 不入 §3。
            'CAROUSEL_W',
            'CAROUSEL_H',
            'CAROUSEL_TOP',
            'CAROUSEL_THUMB_N',
            'CAROUSEL_THUMB_AREA',
            'CAROUSEL_TEXT_BAND',
        ]) {
            expect(idx, `§3 不得被写入 ${name}（零 §3 变更）`).not.toContain(name);
        }
        // 冻结数值本体也未被搬动：`wall_capacity` 的**实装值** 12 仍是派生常量，不是 §3 新条目。
        expect(WALL_CAPACITY).toBe(WALL_COLS * WALL_ROWS);
    });
});
