/**
 * WXG-T-268 批 2 · EP12-S8 换肤通道 + EP12-S9 studio 导出链（皮肤引用）
 * ─────────────────────────────────────────────────────────────────────────────
 * 验收真源（断言只准引用下列条目，⛔ 不自造判据）：
 *  - `design/proposals/skin-system/mvp.md` 批 1 断言方向 **A1–A6**（EP12-S8 验收原样复用）；
 *  - **裁定①（用户 2026-10-07）**：运行时可设——暖纸即默认 + 冷紫灰收编可选肤
 *    `cool-violet`（注册进皮肤池，非退役）；`epics-beads-ep12.md` S8；
 *  - **裁定②（用户 2026-10-07）**：导出链路能携带风格——levelDraft 增可选 `skin`
 *    （引用 id，不传数据本体）；`epics-beads-ep12.md` S9；
 *  - **K-064**「谎报值不采信」：游戏侧以**本地注册表**复验 skin id，未注册 ⇒
 *    不拒收关卡本体、回落默认肤 + 一次性告警；
 *  - 判据写法判例 = `bead-style-settings.test.ts`（S9§8-14~19 / S8§8-11~13 同形）。
 *
 * 纪律：
 *  - **K-035**：一律驱动真实现物（`tapDesign` 打面板钮 / `importLevel` 真导入）；
 *  - **K-060**：缺位型断言必配阳性对照腿；
 *  - **珠面不动铁律（EP12 范围）**：切肤生效帧内珠体族输出零变更（本文件 ④ 腿）；
 *  - **U16 = 甲**：钮文案读 `skin.label`，禁写死款数。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    RenderModelBuilder,
    polygonVertices,
    type DrawCommand,
    type Storage,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import {
    DESIGN_H,
    DESIGN_W,
    GEAR_HIT_SIZE,
    HUD_BAND,
    PUZZLE_BAND,
    TRAY_BAND,
} from '../src/config/tuning.js';
import {
    DEFAULT_SKIN,
    DEFAULT_SKIN_ID,
    registeredSkins,
    registeredSkinIds,
    skinById,
    skinLabel,
} from '../src/config/skins/registry.js';
import { COOL_VIOLET_SKIN } from '../src/config/skins/cool-violet.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { pausePanelLayout, type PausePanelAction } from '../src/systems/pause-panel.js';
import { metaLayout } from '../src/view/meta-view.js';
import { buildBeadsView } from '../src/view/view-model.js';
import {
    SAVE_VERSION,
    normalizeSettings,
} from '../src/game/save-schema.js';
import {
    draftToLevel,
    importLatest,
    type LevelDraft,
} from '../src/game/level-import.js';
import { createBeadsHarness, simpleTestLevel, placeColor, type Harness } from './helpers.js';
import { resetSkinImportWarnings } from '../src/game/beads-game.js';
import type { BeadsGame } from '../src/game/beads-game.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SRC = (p: string): string => readFileSync(resolve(REPO, 'games/beads/src', p), 'utf8');

const SKIN_IDS = registeredSkinIds();
const FIRST_SKIN = SKIN_IDS[0];
const SECOND_SKIN = SKIN_IDS[1];

// ─────────────────────────────────────────────────────────────────── utilities

interface WriteLog {
    key: string;
    kind: 'set' | 'remove';
}

/** 计数 storage（与 `bead-style-settings.test.ts` 同族手法）⇒「即写 / 恰一次」可机检。 */
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

const SAVE_KEY = 'wxgame.beads.test.t268-skin';

function levelOf(): ReturnType<typeof simpleTestLevel> {
    return simpleTestLevel({
        cols: 13,
        rows: 5,
        pattern: Array.from({ length: 5 }, () => '1231231231231'),
    });
}

function boot(storage: Storage): Harness {
    return createBeadsHarness({ noAssemble: true, levels: [levelOf()], saveKey: SAVE_KEY, storage });
}

/** 进 PLAYING 稳定帧。 */
function ensurePlaying(harness: Harness): BeadsGame {
    harness.advance(1);
    expect(harness.game.phase).toBe('playing');
    return harness.game;
}

/** 进 PAUSED（齿轮），面板动画推到静息。 */
function enterPaused(harness: Harness): BeadsGame {
    const game = ensurePlaying(harness);
    const p = { x: GEAR_HIT_SIZE / 2, y: (HUD_BAND.yMin + HUD_BAND.yMax) / 2 };
    expect(game.tapDesign(p.x, p.y)).toBe(true);
    harness.advance(1);
    expect(game.phase).toBe('paused');
    return game;
}

function buttonPoint(id: PausePanelAction): { x: number; y: number } {
    const button = pausePanelLayout('normal').buttons.find((b) => b.id === id);
    if (!button) throw new Error(`panel: no button "${id}"`);
    return { x: (button.rect.xMin + button.rect.xMax) / 2, y: (button.rect.yMin + button.rect.yMax) / 2 };
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
    buildBeadsView(builder, harness.game.snapshot, harness.game.palette, DEMO_BEAD_INKS);
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

function cmdList(flow: readonly string[]): DrawCommand[] {
    return flow.map((line) => JSON.parse(line) as DrawCommand);
}

function cmdY(c: DrawCommand): number {
    return c.kind === 'line'
        ? ((c as unknown as { y1: number }).y1 + (c as unknown as { y2: number }).y2) / 2
        : (c as unknown as { y: number }).y;
}

/** 盘面带（PUZZLE_BAND = 棋盘唯一合法落位）内命令——珠体族观测窗。 */
function inPuzzle(c: DrawCommand): boolean {
    const y = cmdY(c);
    return y >= PUZZLE_BAND.yMin && y <= PUZZLE_BAND.yMax;
}

/** 托盘带命令——托盘珠体观测窗。 */
function inTray(c: DrawCommand): boolean {
    const y = cmdY(c);
    return y >= TRAY_BAND.yMin && y <= TRAY_BAND.yMax;
}

function settingsOf(storage: Storage): Record<string, unknown> {
    const raw = storage.get(SAVE_KEY);
    expect(typeof raw).toBe('string');
    return (JSON.parse(raw as string) as Record<string, unknown>)['settings'] as Record<string, unknown>;
}

afterEach(() => {
    vi.restoreAllMocks();
});

// ══════════════════ ① 注册表与史证（裁定 1 · A1 前提）

describe('EP12-S8 ① 皮肤注册表：暖纸即默认 + 冷紫灰收编（裁定 1）· frozen 纪律', () => {
    it('前提哨兵：注册数 ≥ 2、首位 = 默认肤 = warm-paper、DEFAULT_SKIN.tokens ≡ DEFAULT_PALETTE（同引用）', () => {
        expect(SKIN_IDS.length).toBeGreaterThanOrEqual(2); // <2 ⇒ cycle-skin 钮不呈现（S9§8-19 同形状）
        expect(FIRST_SKIN).toBe(DEFAULT_SKIN_ID);
        expect(DEFAULT_SKIN.id).toBe('warm-paper');
        // **同一实例引用** ⇒ 默认肤渲染逐字节不变（T-267 mvp A1 的结构前提）。
        expect(DEFAULT_SKIN.tokens).toBe(DEFAULT_PALETTE);
        expect(skinById(DEFAULT_SKIN_ID)).toBe(DEFAULT_SKIN);
    });

    it('cool-violet 取值史证（EP12-S1 改动前 DEFAULT_PALETTE 逐字段；git 史证 = HEAD e8b81a9）', () => {
        // 史证快照门：本表 = 冷紫灰肤的唯一合法值源，漂移即红（改值须走裁定 + 差分记账）。
        expect(COOL_VIOLET_SKIN.id).toBe('cool-violet');
        expect(COOL_VIOLET_SKIN.label).toBe('冷紫灰');
        const t = COOL_VIOLET_SKIN.tokens;
        expect(t.background).toBe('#ECEAF3'); // bg_base 冷紫灰
        expect(t.panel).toBe('#FFFFFF');
        expect(t.panelBorder).toBe('#E2DFF0');
        expect(t.slot).toBe('#F7F6FB');
        expect(t.slotBorder).toBe('#D8D5E6');
        expect(t.traySlot).toBe('#4A5060'); // 托盘槽底（WXG-T-261 二批定稿，与肤无关）
        expect(t.slotDashed).toBe('#C9C5DA');
        expect(t.locked).toBe('#B9B4CC');
        expect(t.text).toBe('#2A2E43');
        expect(t.textDim).toBe('#6E7288');
        expect(t.accentPrimary).toBe('#2A2E43'); // 深藏青（未并入木色）
        expect(t.accentPurple).toBe('#7C6FD9');
        expect(t.success).toBe('#3FBF6B');
        expect(t.danger).toBe('#E8434A');
        expect(t.hintBlue).toBe('#3D7BF5');
        expect(t.adBadge).toBe('#2A2E43');
        expect(t.bannerBackdrop).toBe('#33333D');
        expect(t.bannerText).toBe('#FDF6E9');
    });

    it('两肤 tokens 结构恒等（字段键集相同）+ 模块级 Object.freeze（immutable 纪律）', () => {
        const a = Object.keys(DEFAULT_SKIN.tokens);
        const b = Object.keys(COOL_VIOLET_SKIN.tokens);
        expect(b.length).toBe(a.length);
        for (const k of a) expect(b).toContain(k);
        expect(Object.isFrozen(DEFAULT_SKIN)).toBe(true);
        expect(Object.isFrozen(COOL_VIOLET_SKIN)).toBe(true);
        expect(Object.isFrozen(COOL_VIOLET_SKIN.tokens)).toBe(true);
        expect(Object.isFrozen(registeredSkins())).toBe(true);
    });
});

// ══════════════════ ② 存档降级（A4 · S8 §8-12 同形）

describe('EP12-S8 ② normalizeSettings skinId：缺字段 / 非字符串 / 未注册 / 空串 ⇒ 逐字段降级', () => {
    const LEGAL_BUT_UNREGISTERED = 'porcelain-white-not-registered';

    it('四构造各回落默认肤，其余字段无损（不弃整档）', () => {
        const base = normalizeSettings({ beadStyle: 'lineart-18', beadSize: 'small', vibrate: true, debugInfo: true });
        expect(base.skinId).toBe(DEFAULT_SKIN_ID); // 阳性基线：合法档缺 skinId 字段 ⇒ 默认肤
        // ① 缺字段（上例已覆盖）② 类型错：
        for (const bad of [42, null, true, {}, [], ['warm-paper']]) {
            const s = normalizeSettings({ skinId: bad, beadStyle: 'lineart-18' });
            expect(s.skinId).toBe(DEFAULT_SKIN_ID);
            expect(s.beadStyle).toBe('lineart-18'); // 互不牵连
        }
        // ③ 合法字符串但未注册（含空串）：
        for (const bad of [LEGAL_BUT_UNREGISTERED, '']) {
            const s = normalizeSettings({ skinId: bad });
            expect(s.skinId).toBe(DEFAULT_SKIN_ID);
        }
        expect(SKIN_IDS).not.toContain(LEGAL_BUT_UNREGISTERED); // 前置自检：确属未注册
    });

    it('合法已注册 id 原样保留（cool-violet 入档不被误降级）+ SAVE_VERSION 不为此 bump', () => {
        for (const id of SKIN_IDS) {
            expect(normalizeSettings({ skinId: id }).skinId).toBe(id);
        }
        expect(normalizeSettings({ skinId: 'cool-violet' }).skinId).toBe('cool-violet');
        expect(SAVE_VERSION).toBe(4); // debugInfo / beadStyle 判例：逐字段降级无需迁移
    });
});

// ══════════════════ ③ 运行时设置钮（裁定① · K-035 真实现物）

describe('EP12-S8 ③ cycle-skin 钮族：present · 循环 · 恰写档 1 次 · 不切相位 · 重启回显', () => {
    it('前提哨兵：注册数 ≥ 2 ⇒ 行4 三枚选择器钮 present（normal + sprint），cycle-skin 恰一次', () => {
        expect(SKIN_IDS.length >= 2).toBe(true); // <2 时本腿须回到「钮不呈现」口径（S9§8-19）
        for (const mode of ['normal', 'sprint'] as const) {
            const ids = pausePanelLayout(mode).buttons.map((b) => b.id);
            expect(ids).toContain('cycle-skin');
            expect(ids.filter((i) => i === 'cycle-skin').length).toBe(1);
        }
        // 菜单设置 overlay 同钮（内容单源判例）。
        expect(metaLayout('settings').buttons.map((b) => b.id)).toContain('cycle-skin');
    });

    it('点按循环 = 注册序回绕 · 每次恰写档 1 次 · PAUSED 保持 · 不推计时', () => {
        const { storage, log } = spyStorage(newStorage());
        const harness = boot(storage);
        const game = enterPaused(harness);
        expect(game.skinId).toBe(FIRST_SKIN);
        const remaining = game.snapshot.remaining;
        const phaseElapsed = game.snapshot.phaseElapsed;
        const resumedBefore = harness.count('game:resumed');
        const tickBefore = harness.count('timer:tick');

        for (let step = 1; step <= SKIN_IDS.length; step++) {
            const before = log.length;
            const p = buttonPoint('cycle-skin');
            expect(game.tapDesign(p.x, p.y)).toBe(true);
            expect(game.skinId).toBe(SKIN_IDS[step % SKIN_IDS.length]);
            expect(log.length - before).toBe(1); // 恰写档 1 次（S9§8-14 同判）
            expect(settingsOf(storage)['skinId']).toBe(game.skinId);
            expect(game.phase).toBe('paused'); // 不切相位
        }
        expect(game.skinId).toBe(FIRST_SKIN); // 走完一圈回起始肤
        expect(harness.count('game:resumed')).toBe(resumedBefore);
        expect(harness.count('timer:tick')).toBe(tickBefore);
        expect(game.snapshot.remaining).toBe(remaining);
        expect(game.snapshot.phaseElapsed).toBe(phaseElapsed);
    });

    it('杀进程重启：回显与关前一致（S8 §8-11 同形）· 两入口同源（shell 侧 getter）', () => {
        const store = newStorage();
        const h1 = boot(store);
        const g1 = enterPaused(h1);
        const p = buttonPoint('cycle-skin');
        g1.tapDesign(p.x, p.y);
        const saved = settingsOf(store)['skinId'] as string;

        const h2 = boot(store);
        expect(h2.game.skinId).toBe(saved);
        expect(h2.game.snapshot.skinId).toBe(saved); // 回显走 snapshot（L5）
        expect(h2.game.palette).toBe(skinById(saved)!.tokens); // 渲染层已换引用
    });

    it('文案 = `皮肤  ${skin.label}`（逐档实测，⛔ 不写死款数）+ 零新事件名', () => {
        const harness = boot(newStorage());
        const game = enterPaused(harness);
        const p = buttonPoint('cycle-skin');
        const seen: string[] = [];
        for (let step = 0; step < SKIN_IDS.length; step++) {
            game.tapDesign(p.x, p.y);
            const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
            builder.begin();
            buildBeadsView(builder, game.snapshot, game.palette, DEMO_BEAD_INKS);
            const texts = serialize(builder.end())
                .map((l) => JSON.parse(l) as { kind: string; text?: string })
                .filter((c) => c.kind === 'text' && typeof c.text === 'string' && c.text.startsWith('皮肤  '))
                .map((c) => c.text!);
            expect(texts.length).toBeGreaterThanOrEqual(1);
            seen.push(texts[0]!);
            for (const t of texts) expect(t).toBe(`皮肤  ${skinLabel(game.skinId)}`);
        }
        expect(new Set(seen).size).toBe(SKIN_IDS.length); // 逐档各异 ⇒ 未把肤名写死
        for (const t of seen) expect(t).not.toMatch(/\d+\s*\/\s*\d+|共\s*\d+|\d+\s*款/);
        // 零新事件名（S8 §8-12「不新造事件」；本测试事件流全来自既有族）。
        expect(harness.emitted.every((e) => !/skin|theme/i.test(e.type))).toBe(true);
    });

    it('静态门：`cycle-skin` 动作串值只住在入口/受理/回显侧（无第四入口，TC-STY-06 同形）', () => {
        const allow = new Set([
            'systems/pause-panel.ts', // 入口甲：行4 钮位
            'view/meta-view.ts', // 入口乙：菜单设置 overlay 同钮
            'game/beads-game.ts', // 唯一受理点
            'view/view-model.ts', // 钮文案回显
            'config/skins/registry.ts', // 注释（计数真源登记；同 bead-styles/registry 判例）
        ]);
        const srcDir = resolve(REPO, 'games/beads/src');
        const offenders: string[] = [];
        const walk = (dir: string): void => {
            for (const entry of readdirSync(dir)) {
                const full = resolve(dir, entry);
                if (statSync(full).isDirectory()) walk(full);
                else if (entry.endsWith('.ts')) {
                    const rel = full.slice(srcDir.length + 1).replace(/\\/g, '/');
                    if (!allow.has(rel) && SRC(rel).includes('cycle-skin')) offenders.push(rel);
                }
            }
        };
        walk(srcDir);
        expect(offenders).toEqual([]);
    });
});

// ══════════════════ ④ 渲染生效（A2 / A5 + 珠面不动铁律）

describe('EP12-S8 ④ 切肤渲染：下一帧生效零过渡 · 结构恒等 + sha ≠ · 珠体族零变更', () => {
    it('A2 前半：切肤前后整帧 kinds 逐 kind 计数与 total ≡（纯墨改写不增减图元）', () => {
        const harness = boot(newStorage());
        const game = enterPaused(harness);
        const f0 = frame(harness);
        game.tapDesign(buttonPoint('cycle-skin').x, buttonPoint('cycle-skin').y);
        const f1 = frame(harness);
        expect(kindCount(f1)).toEqual(kindCount(f0)); // 结构恒等（第十六次复评判例同构）
    });

    it('A2 后半 + A5：帧内容确实变（sha ≠）且下一帧生效、无中间态', () => {
        const harness = boot(newStorage());
        const game = enterPaused(harness);
        const f0 = frame(harness);
        const sha0 = createHash('sha1').update(f0.join('|')).digest('hex');
        game.tapDesign(buttonPoint('cycle-skin').x, buttonPoint('cycle-skin').y);
        const f1 = frame(harness);
        const sha1 = createHash('sha1').update(f1.join('|')).digest('hex');
        expect(sha1).not.toBe(sha0); // sha ≠（token 值确实进了命令流）
        expect(f1).not.toEqual(f0);

        harness.advance(1 / 60);
        expect(frame(harness)).toEqual(f1); // 第二帧不再变（无过渡）
        harness.advance(0.5);
        expect(frame(harness)).toEqual(f1); // 稳态收敛
    });

    it('UI 族确实变：帧 background 随肤切换（暖纸 ⇄ 冷紫灰，`setBackground` 消费 `palette.background`）', () => {
        const harness = boot(newStorage());
        const game = enterPaused(harness);
        expect(game.palette.background).toBe(DEFAULT_PALETTE.background); // 默认 = 暖纸
        const warmBg = DEFAULT_PALETTE.background;
        const buildBg = (): string | undefined => {
            const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
            builder.begin();
            buildBeadsView(builder, game.snapshot, game.palette, DEMO_BEAD_INKS);
            return builder.end().background;
        };
        expect(buildBg()).toBe(warmBg);
        game.tapDesign(buttonPoint('cycle-skin').x, buttonPoint('cycle-skin').y);
        expect(game.palette.background).not.toBe(warmBg);
        expect(buildBg()).toBe(game.palette.background); // 下一帧背景已是新肤
        expect(buildBg()).not.toBe(warmBg);
    });

    it('珠面不动铁律：切肤生效帧内，盘面带与托盘带命令**逐字节不变**（皮肤作用域 = UI 令牌族）', () => {
        const harness = boot(newStorage());
        const game = ensurePlaying(harness);
        // 先造盘面与托盘珠（PLAYING 期落子），在 **PLAYING 态**比较（PAUSED 面板图元
        // 会落入带 y 域造成污染；换肤动作走同一私有 setter 的公开入口 applySettingsAction，
        // 与 `bead-style-settings.test.ts` 豆径作用域腿同手法，K-035）。
        expect(placeColor(game, game.grid.requiredColor(0, 0), 0, 0)).toBe(true);
        expect(game.giveTrayBead(2)).toBeGreaterThanOrEqual(0);
        const f0 = frame(harness);
        const puzzle0 = cmdList(f0).filter(inPuzzle);
        const tray0 = cmdList(f0).filter(inTray);
        expect(puzzle0.length).toBeGreaterThan(0); // 阳性对照：观测窗非空
        expect(tray0.length).toBeGreaterThan(0);

        game.applySettingsAction('cycle-skin');
        const f1 = frame(harness);
        expect(cmdList(f1).filter(inPuzzle)).toEqual(puzzle0); // 盘面零变更（B0/凹槽/珠体全族）
        // 托盘带：**珠体族**（circle/polygon）零变更；托盘面板 rect 属 UI 族（应随肤变，
        // 见下一腿阳性对照）⇒ rect 不入本观测窗。
        const beadFamily = (cs: DrawCommand[]): DrawCommand[] =>
            cs.filter((c) => c.kind === 'circle' || c.kind === 'polygon');
        expect(beadFamily(cmdList(f1).filter(inTray))).toEqual(beadFamily(tray0));
        // 阳性对照（K-060）：托盘带内 UI 族 rect（托盘面板等）确实随肤变 ⇒ 上面的
        // 「珠体族不变」是作用域门禁，不是渲染坏死（⛔ 不写死面板几何，整体序列比较）。
        const trayRects = (cs: DrawCommand[]): DrawCommand[] => cs.filter(inTray).filter((c) => c.kind === 'rect');
        expect(JSON.stringify(trayRects(cmdList(f1)))).not.toBe(JSON.stringify(trayRects(tray0)));
    });
});

// ══════════════════ ⑤ EP12-S9 studio 导出链（裁定② · K-064 反例）

describe('EP12-S9 ⑤ levelDraft.skin：透传 · 结构校验 · 导入复验回落 · E2E', () => {
    function draftOf(over: Partial<LevelDraft> = {}): LevelDraft {
        const lv = simpleTestLevel();
        return {
            cols: lv.cols,
            rows: lv.rows,
            time: null,
            decoys: [],
            swaps: [[0, 0, 0, 1]],
            pattern: lv.pattern,
            ...over,
        };
    }

    it('draftToLevel：skin 引用原样透传；无 skin 字段（旧草案）⇒ 既有字段逐字节兼容', () => {
        const withSkin = draftToLevel(draftOf({ skin: 'cool-violet' }), 9001, 's9-a');
        expect(withSkin.ok).toBe(true);
        expect(withSkin.level!.skin).toBe('cool-violet');

        const noSkin = draftToLevel(draftOf(), 9002, 's9-b');
        expect(noSkin.ok).toBe(true);
        expect(noSkin.level!.skin).toBeUndefined(); // 旧草案照常导入
    });

    it('validateBeadsLevel：skin 非字符串 ⇒ 拒收；未注册字符串 ⇒ 放行（未注册 ≠ 非法关卡）', () => {
        const badType = draftToLevel({ ...draftOf(), skin: 42 } as unknown as LevelDraft, 9003, 's9-c');
        expect(badType.ok).toBe(false);
        expect(badType.errors.some((e) => e.includes('skin'))).toBe(true);

        const unknownId = draftToLevel(draftOf({ skin: 'porcelain-white' }), 9004, 's9-d');
        expect(unknownId.ok).toBe(true); // 不拒收关卡本体（422 面零新增）
    });

    it('importLevel（注册腿）：导入成功 ⇒ settings.skinId 应用 + 渲染层换引用', () => {
        const harness = boot(newStorage());
        const game = harness.game;
        expect(game.skinId).toBe(FIRST_SKIN);
        const r = draftToLevel(draftOf({ skin: SECOND_SKIN }), 9005, 's9-e');
        expect(game.importLevel(r.level!)).toEqual([]);
        expect(game.skinId).toBe(SECOND_SKIN);
        expect(game.snapshot.skinId).toBe(SECOND_SKIN);
        expect(game.palette).toBe(skinById(SECOND_SKIN)!.tokens);
        expect(settingsOf(harness.storage)['skinId']).toBe(SECOND_SKIN); // 已落盘
    });

    it('K-064 反例腿：谎报未注册 skin ⇒ 导入成功但回落默认肤 + 一次性告警', () => {
        resetSkinImportWarnings();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const harness = boot(newStorage());
        const game = harness.game;
        const r = draftToLevel(draftOf({ skin: 'porcelain-white' }), 9006, 's9-f');
        expect(game.importLevel(r.level!)).toEqual([]); // 导入成功（不拒收）
        expect(game.skinId).toBe(DEFAULT_SKIN_ID); // 回落默认肤
        expect(game.palette).toBe(skinById(DEFAULT_SKIN_ID)!.tokens);
        expect(settingsOf(harness.storage)['skinId']).toBe(DEFAULT_SKIN_ID);
        expect(warn.mock.calls.some((args) => String(args[0]).includes('porcelain-white'))).toBe(true);

        // 一次性门：第二次谎报不再刷告警（但仍回落）。
        warn.mockClear();
        const r2 = draftToLevel(draftOf({ skin: 'porcelain-white' }), 9007, 's9-g');
        expect(game.importLevel(r2.level!)).toEqual([]);
        expect(game.skinId).toBe(DEFAULT_SKIN_ID);
        expect(warn).not.toHaveBeenCalled();
    });

    it('无 skin 字段的草案导入 ⇒ settings.skinId 原样保留（零影响腿，K-060 阳性对照）', () => {
        const harness = boot(newStorage());
        const game = harness.game;
        game.applySettingsAction('cycle-skin'); // 先切到第二肤
        expect(game.skinId).toBe(SECOND_SKIN);
        const r = draftToLevel(draftOf(), 9008, 's9-h');
        expect(game.importLevel(r.level!)).toEqual([]);
        expect(game.skinId).toBe(SECOND_SKIN); // 未被重置
    });

    it('E2E（注入 HTTP）：/api/results → /level（携 skin）→ importLevel 全绿且 settings.skinId 生效', () => {
        const harness = boot(newStorage());
        const draft = draftOf({ skin: 'warm-paper', time: 300 });
        const get = async (url: string): Promise<unknown> => {
            if (url.endsWith('/api/results')) {
                return { results: [{ id: 'abc123', importable: true }] };
            }
            if (url.endsWith('/api/results/abc123/level')) return draft;
            throw new Error(`unexpected url ${url}`);
        };
        return importLatest('http://studio.test', get).then((outcome) => {
            expect(outcome.ok).toBe(true);
            expect(harness.game.importLevel(outcome.level!)).toEqual([]);
            expect(harness.game.skinId).toBe('warm-paper');
            expect(settingsOf(harness.storage)['skinId']).toBe('warm-paper');
        });
    });
});

// ══════════════════ ⑥ 未落码判据（K-035：记 SKIP，不假绿）

describe('EP12-S8 ⑥ T-267 mvp 批 1 未落码判据登记', () => {
    it.skip('A6 热路径零分配机械探针（C2 同款：切肤后连续两帧 buildRenderModel 无新增堆分配）——[SKIP: 仓内无既有探针先例，归另批补齐]', () => {
        expect.unreachable('K-035：未落码判据不假绿');
    });
});
