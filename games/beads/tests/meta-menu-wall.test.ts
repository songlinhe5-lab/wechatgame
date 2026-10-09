/**
 * WXG-T-269-S6 · 子单 T-2A — EP12-S6 主菜单「拼豆小铺」**工程垂直切片**
 * ─────────────────────────────────────────────────────────────────────────────
 * 判据真源（⛔ 本文件零新判据、零新数值，全部为既有判据的机械复算）：
 *  - `production/epics/epics-beads-ep12.md` **§73–§78**：S6 验收①–⑦ + In/Out；
 *  - `design/proposals/ui-style-redesign/menu-architecture.md` §5.1（版面）/ §5.4（三条硬口径）
 *    / §6（文案令牌）/ §7.4（P-5 次级行溢出）/ §8；
 *  - `design/proposals/ui-style-redesign/level-difficulty.md` **§5.2 九关墙序**
 *    `L1→L8→L4→L3→L7→L2→L6→L5→L9`（DI 升序 = `game/difficulty.ts::difficultyOf()` 实算）；
 *  - `design/proposals/ui-style-redesign/tokens.md` §1（色）/ §5（字级）/ §7（对外称名）；
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
 * `menu-signage-beadtext.test.ts` / `menu-thumb-primitives.test.ts` / `menu-primitives-k6.test.ts`。
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
import { drawLevelThumb, levelThumbCells, signBands, SIGN_INK_COLOR_IDX } from '../src/view/menu-signage.js';
import { drawFilledBead, type FilledBeadOptions } from '../src/view/bead-render.js';
import { signGlyphBeadsOf } from '../src/config/sign-glyphs.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS, beadInksFor } from '../src/view/palette.js';
import {
    DESIGN_H,
    DESIGN_W,
    CAROUSEL_H,
    CAROUSEL_W,
    MENU_SECONDARY_GAP,
    MENU_SECONDARY_W,
    MENU_SLOGAN_Y,
    MENU_TITLE_Y,
    MENU_VERSION_Y,
    SIGN_BEAD_PITCH,
    SIGN_MATRIX_N,
    THUMB_MATRIX_N,
    TOUCH_MIN,
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

/** §5.2 冻结九关墙序（关号；= 本池 `id` = 索引+1，见前置断言）。 */
const WALL_ORDER_IDS = [1, 8, 4, 3, 7, 2, 6, 5, 9] as const;

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
 * 走马灯卡热区（菜单唯一选关入口，`id = 'open-levels'`；§1.3 第五轮：墙已下移 `levels` overlay）。
 */
function cardBox() {
    return metaLayout('none').buttons.find((b) => b.id === 'open-levels')!;
}
/** 把 shell 推进 `levels` overlay（点走马灯卡 ⇒ 墙所在屏）。 */
function openLevels(shell: BeadsShell): void {
    const c = centerOf(cardBox().box);
    expect(shell.tapMeta(c.x, c.y), '卡 = 可点入口').toBe(true);
    expect(shell.overlay).toBe('levels');
}
/** **选关页帧**（先点卡开 overlay ⇒ 墙格内容在此可观测）。 */
function levelsFrame(shell: BeadsShell): readonly DrawCommand[] {
    openLevels(shell);
    return frameOf(shell);
}

/** 作品墙格（墙下移 `levels` overlay 后住这里 ⇒ 与菜单共用同一 `levelsLayout` 几何）。 */
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

/** 把**期望关**的缩略单独画进干净 builder ⇒ 与该格实测序列逐条对撞（⛔ 不读屏上文字反推关号）。 */
function thumbOracle(level: (typeof LEVELS)[number], box: { x: number; y: number; w: number; h: number }): string {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    drawLevelThumb(builder, level, box.x, box.y, box.w, box.h, THUMB_MATRIX_N);
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

describe('EP12-S6 Deliverable 2 · 陈列序 = DI 升序（九关墙序复现 + slot↔level 回归反例）', () => {
    it('选关页九格**缩略逐位复现** `level-difficulty §5.2`：L1→L8→L4→L3→L7→L2→L6→L5→L9（T-2B 口径，墙下移 `levels` overlay）', () => {
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

    it('**反例锁**：「按槽直索引」（墙序 = 1..9）必红 ⇒ 现读序列与恒等序逐位不等', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const cmds = levelsFrame(r.shell);
        const seq = wallCells()
            .slice(0, LEVELS.length)
            .map((cell) => levelIdByThumb(cmds, cell));
        expect(seq, '若红 = 又退回了「第 k 格当第 k 关」的旧口径').not.toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        // 逐位钉死才能拦「局部平移」型退化：本池 DI 序与恒等序**仅首末两位重合**
        // （槽 0 = L1 最易、槽 8 = L9 最难 ⇒ 天然同位），中间 7 位全部错位。
        const sameAsIdentity = seq.filter((v, i) => v === i + 1);
        expect(sameAsIdentity, `与恒等序的重合位：${sameAsIdentity.join(',')}`).toEqual([1, 9]);
    });

    it('**行为腿反例**：点槽 1 → 落 L8（索引 7），⛔ 不是索引 1（旧 `beads-shell.ts:258` 的错值）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        openLevels(r.shell); // 墙下移 `levels` overlay ⇒ 先在选关页点格
        const c = centerOf(wallCells()[1]!.box);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.levelIndex, '槽 1 = 次易关 L8 = 索引 7').toBe(7);
        expect(r.shell.play.levelIndex).not.toBe(1);
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

    it('热路径：排序只住在 `_rebuildWallSlots`（一次性），每帧腿（`_metaViewData`/视图）零 sort', () => {
        const shellSrc = CODE('game/beads-shell.ts');
        const sorts = shellSrc.match(/\.sort\(/g) ?? [];
        expect(sorts.length, '全 shell 恰一处 .sort(').toBe(1);
        expect(
            shellSrc.indexOf('.sort('),
            '且位于 _rebuildWallSlots 之内',
        ).toBeGreaterThan(shellSrc.indexOf('_rebuildWallSlots('));
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
        const cell = wallCells()[2]!; // 槽 2 = L4 = 索引 3
        r.shell.tapMeta(...centerTuple(cell.box));
        expect(r.shell.play.levelIndex).toBe(3);
        r.shell.showMenu();
        const start = metaLayout('none').buttons.find((b) => b.id === 'start')!;
        const sc = centerOf(start.box);
        expect(r.shell.tapMeta(sc.x, sc.y)).toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.levelIndex, '主钮开的是**当前关**（3），不是槽位号、也不是首关').toBe(3);
    });

    it('口径②：墙格 = **指定关**（点槽 8 直达 L9）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        openLevels(r.shell); // 墙住 `levels` overlay
        const cell = wallCells()[8]!;
        const c = centerOf(cell.box);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.play.levelIndex).toBe(WALL_ORDER_IDS[8]! - 1);
    });

    it('口径③：主菜单入口 = **走马灯卡**（`open-levels`）+ 主钮 + 次级 2 钮（菜单主区⛔ 无墙格泄漏）', () => {
        const ids = new Set(metaLayout('none').buttons.map((b) => b.id));
        expect(ids.has('open-levels'), '§1.3：卡 = 菜单唯一选关入口').toBe(true);
        expect(ids.has('pick-level'), '菜单主区⛔ 不再排墙格（墙下移 overlay）').toBe(false);
        expect([...ids].sort()).toEqual(['open-levels', 'open-settings', 'open-signin', 'start']);
        // 扫面（16×16 步长）：菜单全域可命中的动作集恰等于上面四个 ⇒ 无暗道。
        const scanned = new Set<string>();
        for (let x = 0; x <= DESIGN_W; x += 16) {
            for (let y = 0; y <= DESIGN_H; y += 16) {
                const b = hitTestMeta('none', x, y);
                if (b) scanned.add(b.id);
            }
        }
        expect([...scanned].sort()).toEqual(['open-levels', 'open-settings', 'open-signin', 'start']);
    });

    it('未解锁格 = 虚线空槽（无编号、无🔒字样）+ 零热区零事件（墙住 `levels` overlay）', () => {
        const r = rig(); // maxUnlocked = 1 ⇒ 仅槽 0 已解锁
        const before = r.staminaOf();
        const cmds = levelsFrame(r.shell); // 先点卡进选关页 ⇒ 墙格内容可观测
        const eventsBefore = r.overlayEvents.length; // 开页那一次 `meta:overlay` 已记录
        const cells = wallCells();
        expect(levelIdByThumb(cmds, cells[0]!), '槽 0 = L1 已解锁 ⇒ 缩略命中 L1').toBe(1);
        expect(beadsInCell(cmds, cells[0]!), '已解锁格有珠').toBeGreaterThan(0);
        expect(dashedSegmentsIn(cmds, cells[0]!)).toBe(0);
        for (const locked of cells.slice(1, LEVELS.length)) {
            const c = centerOf(locked.box);
            expect(r.shell.tapMeta(c.x, c.y), `槽 ${locked.slot} 未解锁 ⇒ 不被消费`).toBe(false);
            expect(beadsInCell(cmds, locked), '未解锁格⛔ 不画珠（也无编号占位）').toBe(0);
            expect(dashedSegmentsIn(cmds, locked), '虚线空槽在场').toBeGreaterThan(0);
        }
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.overlay, '点未解锁格不换页').toBe('levels');
        expect(r.staminaOf()).toBe(before);
        expect(r.overlayEvents.length, '零新增事件：未解锁格不发 `meta:*`').toBe(eventsBefore);
        // 未解锁格内⛔ 不出现「解锁/未解锁/🔒」字样（§5.4 口径 2 = 空槽语言，非文字提示）。
        const texts = cmds.filter((k) => k.kind === 'text').map((k) => String((k as { text?: string }).text ?? ''));
        expect(texts.some((t) => t.includes('解锁') || t.includes('🔒')), texts.join('|')).toBe(false);
    });

    it('越界槽（第 10–12 格，关表短于容量）同为虚线空槽 + 零事件（S6 Out 的溢出不得误接关）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const before = r.staminaOf();
        const cmds = levelsFrame(r.shell);
        for (const overflow of wallCells().slice(LEVELS.length)) {
            expect(overflow.slot! >= LEVELS.length).toBe(true);
            expect(beadsInCell(cmds, overflow), '越界槽不画珠').toBe(0);
            expect(dashedSegmentsIn(cmds, overflow), '越界槽 = 空槽语言').toBeGreaterThan(0);
            const c = centerOf(overflow.box);
            expect(r.shell.tapMeta(c.x, c.y)).toBe(false);
        }
        expect(r.shell.screen).toBe('menu');
        expect(r.staminaOf()).toBe(before);
    });

    it('验收⑥：走马灯卡 = **单热区**（卡内装饰共一块、卡外留白零热区；装饰层不建子钮）', () => {
        const b = cardBox().box;
        // ① 卡内任意点（边框 / 落位图 / 两行文字）都命中同一块 `open-levels` 热区 ⇒ 卡内零子钮。
        for (const [dx, dy] of [
            [6, 6],
            [b.w / 2, b.h / 2],
            [b.w - 6, 6],
            [6, b.h - 6],
        ] as const) {
            expect(hitTestMeta('none', b.x + dx, b.y + dy)?.id, `卡内 (${dx},${dy}) = 卡热区`).toBe('open-levels');
        }
        // ② 卡外左/右留白落空（卡宽 300 ≪ 750 ⇒ 两侧各留白 225）。
        const outside: [number, number][] = [
            [b.x - 30, b.y + b.h / 2],
            [b.x + b.w + 30, b.y + b.h / 2],
        ];
        for (const [x, y] of outside) expect(hitTestMeta('none', x, y), `卡外 (${x},${y})`).toBeNull();
        // ③ 结构面：热区清单里没有任何「整屏 / 整墙」尺寸的对象（卡是唯一大块，尺寸恒 = CAROUSEL_* 预算）。
        for (const btn of metaLayout('none').buttons) {
            expect(btn.box.w >= DESIGN_W * 0.9 && btn.box.h >= GRID_H, '纸底级热区不得存在').toBe(false);
        }
        expect(b.w).toBe(CAROUSEL_W);
        expect(b.h).toBe(CAROUSEL_H);
    });
});

describe('EP12-S6 Deliverable 4 · P-5 次级行 3→2 钮 + 间距入 tuning', () => {
    it('次级行恰 2 钮（签到 / 设置），总宽 504 ≤ 750 ⇒ P-5 溢出闭合', () => {
        const sec = metaLayout('none').buttons.filter((b) => b.id === 'open-signin' || b.id === 'open-settings');
        expect(sec.length).toBe(2);
        const total = MENU_SECONDARY_W * 2 + MENU_SECONDARY_GAP;
        expect(total, '线框口径 2×240 + 24').toBe(504);
        expect(total).toBeLessThanOrEqual(DESIGN_W);
        const [a, b] = [sec[0]!, sec[1]!];
        expect(a.box.x).toBeGreaterThanOrEqual(0);
        expect(b.box.x + b.box.h * 0 + b.box.w).toBeLessThanOrEqual(DESIGN_W);
        expect(b.box.x - (a.box.x + a.box.w), '两钮间距 = 命名常量').toBe(MENU_SECONDARY_GAP);
        for (const btn of [a, b]) {
            expect(btn.box.w).toBe(MENU_SECONDARY_W);
            expect(btn.box.h, '触控下限').toBeGreaterThanOrEqual(TOUCH_MIN);
            expect(centerOf(btn.box).x).toBeGreaterThan(0);
        }
    });

    it('数据驱动：`const gap = 24` 字面已从 `menuLayout()` 收进 `tuning.ts::MENU_SECONDARY_GAP`', () => {
        expect(SRC('config/tuning.ts')).toContain('export const MENU_SECONDARY_GAP = 24;');
        const mv = CODE('view/meta-view.ts');
        expect(mv).toContain('MENU_SECONDARY_GAP');
        expect(mv, '⛔ 视图内不得再散落该字面').not.toContain('const gap = 24');
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

    it('slogan / 版本号读令牌并落位 `MENU_*_Y` 锚；**招牌已换成珠拼**（文字腿退场）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const cmds = menuFrame(r.shell);
        const at = (y: number) =>
            cmds.filter((k) => k.kind === 'text' && k.y === y).map((k) => String((k as { text?: string }).text));
        expect(at(MENU_SLOGAN_Y)).toEqual([COPY_TOKENS.app_slogan]);
        expect(at(MENU_VERSION_Y)).toEqual([COPY_TOKENS.version_label]);
        // T-2B：`MENU_TITLE_Y` 不再挂 64px 系统字体（语义也已改为**外接框中心**）；
        // 文案仍**单源于 `app_name`**（视图把该令牌交给 `drawBeadText`，⛔ 未散字面）。
        expect(at(MENU_TITLE_Y), '系统字体标题已退场（位表就位 ⇒ 回落臂不应命中）').toEqual([]);
    });

    it('招牌 = **`beadText` 珠拼**（实测 148 珠 × 7 = 1036 命令落在 `MENU_TITLE_Y` 带内）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const cmds = menuFrame(r.shell);
        const band = signBands(COPY_TOKENS.app_name.length, MENU_TITLE_Y, SIGN_MATRIX_N, SIGN_BEAD_PITCH);
        const circles = cmds.filter((k) => {
            if (k.kind !== 'circle') return false;
            const c = k as { x: number; y: number };
            return c.y >= band.yMin && c.y <= band.yMax && c.x >= band.x && c.x <= band.x + band.w;
        });
        const beads = circles.length / 2;
        expect(beads, '菜单帧实测珠数 ≡ 位表自算珠数（⛔ 非纸面值）').toBe(signGlyphBeadsOf(COPY_TOKENS.app_name));
        expect(beads).toBe(148); // = 37+38+19+54（`menu-wall-signage-spec §1.5` 逐字珠数）
        // 四枚字模各自占位（字框 120 + 字间 60）⇒ 每字至少一枚珠心落在其字框内。
        for (let i = 0; i < COPY_TOKENS.app_name.length; i++) {
            const glyphLeft = band.x + i * (band.h + band.h * 0.5);
            const inGlyph = circles.filter((c) => (c as { x: number }).x >= glyphLeft && (c as { x: number }).x <= glyphLeft + band.h);
            expect(inGlyph.length, `第 ${i} 字槽有珠`).toBeGreaterThan(0);
        }
    });

    it('钮标签读令牌（主钮 + 次级 2 钮）', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const texts = new Set(
            menuFrame(r.shell)
                .filter((k) => k.kind === 'text')
                .map((k) => String((k as { text?: string }).text)),
        );
        expect(texts.has(COPY_TOKENS.btn_start_label)).toBe(true);
        expect(texts.has(COPY_TOKENS.btn_signin_label)).toBe(true);
        expect(texts.has(COPY_TOKENS.btn_settings_label)).toBe(true);
        expect(texts.has('开始拼豆'), '旧字面不得残留').toBe(false);
    });

    it('静态门：视图源内标题字面已退场 + 令牌 import 在场', () => {
        const mv = CODE('view/meta-view.ts');
        expect(mv).toContain("from '../config/copy-tokens.js'");
        expect(mv, "⛔ 代码里不再有 '拼豆' 裸字面（app_name 令牌单源）").not.toContain("'拼豆'");
        expect(mv, "⛔ 也不得出现旧钮字面 '开始拼豆'").not.toContain('开始拼豆');
    });
});

describe('EP12-S6 Deliverable 1 + Q5① · 墙单源在 `levels` overlay / 主菜单不再排墙（几何只一份）', () => {
    it('墙 = 4×3 共 12 格（只住 `levels` overlay）；主菜单 ⛔ 无墙格 ⇒ 几何单份、永不各排一份', () => {
        const overlay = metaLayout('levels').buttons.filter((b) => b.id === 'pick-level');
        expect(overlay.length).toBe(WALL_CAPACITY);
        for (const cell of overlay) {
            expect(cell.box.w, '格宽 = tuning 常量').toBe(WALL_CELL);
            expect(cell.box.h).toBe(WALL_CELL);
        }
        // 列/行步进同源自洽（同一 `levelsLayout` 一次算定）。
        const step = (list: typeof overlay, i: number) => list[i + 1]!.box.x - list[i]!.box.x;
        expect(step(overlay, 1), '列步进一致').toBe(step(overlay, 0));
        const rowStep = overlay[0]!.box.y - overlay[WALL_COLS]!.box.y;
        expect(rowStep, '行步进 = 格宽 + 缝').toBe(WALL_CELL + WALL_GAP);
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
            // 走马灯卡（§1.3）：本例只渲 `levels` overlay ⇒ 卡字段不参与本帧渲染，补齐满足入参形状。
            carouselLevel: LEVELS[WALL_ORDER_IDS[2]! - 1],
            carouselCleared: 3,
            carouselTotal: LEVELS.length,
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
    }
    for (let i = 1; i <= DEMO_BEAD_INKS.hexes.length; i++) push(DEMO_BEAD_INKS, i);
    push(DEMO_BEAD_INKS, SIGN_INK_COLOR_IDX);
    return set;
}

describe('EP12-S6 边界与铁律自证 · 珠体族只进菜单帧 / 零新色 / L4 / §3 零变更', () => {
    it('验收⑦ · `menu:零玩法事件`：菜单**惰性面**点扫（卡外留白/屏角）零事件', () => {
        // 惰性面口径比「零玩法事件」**更强**：菜单惰性点扫不得发任何事件；玩法族前缀闭集见下例。
        const r = rig(); // maxUnlocked = 1
        const card = cardBox().box;
        const probes: [number, number][] = [
            [card.x - 40, card.y + card.h / 2], // 卡左留白
            [card.x + card.w + 40, card.y + card.h / 2], // 卡右留白
            [card.x + card.w / 2, card.y + card.h + 20], // 卡上缘外（招牌/标语区无钮）
            [4, 4],
            [DESIGN_W - 4, DESIGN_H - 4],
        ];
        for (const [x, y] of probes) expect(r.shell.tapMeta(x, y), `(${x},${y}) 应零消费`).toBe(false);
        expect(r.emitted(), '菜单惰性面不得发**任何**事件（不只是零玩法事件）').toEqual([]);
        // 探针自检：同一个 shadow 入口确实能捕获玩法族事件（否则上面的「零事件」可能是探针失效的假绿）。
        r.emitTo('board:selected');
        expect(r.emitted(), '总线 emit 必须被同一入口记下').toEqual(['board:selected']);
        // 热区阳性对照：走马灯卡（唯一选关入口）仍可点 ⇒ 开 `levels` 选关页。
        const c = centerOf(card);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.overlay).toBe('levels');
    });

    it('验收⑦ 补 · 菜单三钮的合法侧效集 = `meta:overlay` + `stamina:changed`（⛔ 零玩法事件）', () => {
        const PLAY_PREFIXES = ['bead:', 'board:', 'combo:', 'game:', 'level:', 'powerup:', 'sprint:', 'timer:', 'tray:'];
        const r = rig({ maxUnlocked: LEVELS.length });
        const start = metaLayout('none').buttons.find((b) => b.id === 'start')!;
        const sc = centerOf(start.box);
        expect(r.shell.tapMeta(sc.x, sc.y)).toBe(true);
        r.shell.showMenu();
        for (const id of ['open-signin', 'open-settings'] as const) {
            const b = metaLayout('none').buttons.find((x) => x.id === id)!;
            const c = centerOf(b.box);
            expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
            const back = metaLayout(r.shell.overlay).buttons.find((x) => x.id === 'back')!;
            const bc = centerOf(back.box);
            expect(r.shell.tapMeta(bc.x, bc.y)).toBe(true);
        }
        const playish = r.emitted().filter((t) => PLAY_PREFIXES.some((p) => t.startsWith(p)));
        expect(playish, `菜单不得发玩法事件：${playish.join(',')}`).toEqual([]);
        expect([...new Set(r.emitted())].sort(), '菜单侧合法侧效闭集').toEqual(['meta:overlay', 'stamina:changed']);
    });

    it('图元族闭集：菜单帧 = 容器族 + **珠体族**（每珠恒 7 命令）；⛔ 无 `blit`，珠只住在招牌带与已解锁格内', () => {
        const r = rig({ maxUnlocked: LEVELS.length });
        const cmds = menuFrame(r.shell);
        const kinds = new Set(cmds.map((k) => k.kind));
        expect([...kinds].sort()).toEqual(['circle', 'line', 'polygon', 'rect', 'text']);
        expect(kinds.has('blit'), '⛔ 无贴图珠体（S0 约束①：只复用珠体**矢量**图元）').toBe(false);
        // facet-4 满层 = 1 rect + 4 polygon + 2 circle ⇒ 珠数可由 circle 反算，polygon 必等于 4×。
        const circles = cmds.filter((k) => k.kind === 'circle').length;
        const polygons = cmds.filter((k) => k.kind === 'polygon').length;
        expect(circles % 2, '每珠两枚同心圆').toBe(0);
        expect(polygons, '每珠四枚棱扇 ⇒ polygon ≡ 4 × beads').toBe((circles / 2) * 4);
        // 空间闭集：每颗珠必在「招牌带」或「某一已解锁格框」内 ⇒ 菜单帧不往别处洒珠。
        const band = signBands(COPY_TOKENS.app_name.length, MENU_TITLE_Y, SIGN_MATRIX_N, SIGN_BEAD_PITCH);
        const cells = wallCells();
        for (const k of cmds) {
            if (k.kind !== 'circle') continue;
            const c = k as { x: number; y: number };
            const inSign = c.y >= band.yMin && c.y <= band.yMax && c.x >= band.x && c.x <= band.x + band.w;
            const inCell = cells.some((cell) => {
                const b = cell.box;
                return c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h;
            });
            expect(inSign || inCell, `珠心 (${c.x},${c.y}) 越出招牌带与格框`).toBe(true);
        }
    });

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
            'MENU_SECONDARY_GAP',
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
