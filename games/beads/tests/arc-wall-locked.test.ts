/**
 * WXG-T-290（EP13-FU-1）— 选关墙「虚线空槽 → 锁格合形」+ 3×3 收墙
 * ─────────────────────────────────────────────────────────────────────────────
 * 判据真源（⛔ 本文件零新判据）：
 *  - `games/beads/design/ux/arc-level-select-spec.md` **§4**「未解锁格」「越界空槽」两行
 *    （Q15 = 2026-10-17 改裁**合形**：灰色珠阵图 + 小锁 + 无星；零热区不变）；
 *  - 同文 **§3** 线框 v1.3（3×3 = 9 格）与 **§9 分片 §11 v1.3 行**（列数 4→3、容量 12→9、网格宽 546→404）；
 *  - 同文 **§7** 非色相通道：未解锁 = **锁形**通道（⛔ 不得只靠灰度表达状态）；
 *  - `production/epics/epics-beads-ep13-fu-wallcell.md` **§3 A1/A2/A3/A4**。
 *
 * 灰度规则 [TODO-ART-1] 未定 ⇒ 按跟进单 §4 兜底口径：只断言**零饱和**（R=G=B），⛔ 不写死具体灰阶；
 * 9 格内容版式（云端基底 vs 原型脚本 vs 线框）未选定 ⇒ 本文件**数据驱动**，格内容由
 * `levelRefs` 展开 + 解锁闸门派生，⛔ 不钉美术版式。
 */

import { describe, it, expect, afterEach } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaView, metaLayout, setMenuBitmapResolver, type MetaButton, type MetaViewData } from '../src/view/meta-view.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import {
    DESIGN_H, DESIGN_W, LEVELS_CELL, LEVELS_GAP, LEVELS_THUMB_AREA, MENU_TEXTURES, THUMB_TOP_INSET, WALL_COLS, WALL_CAPACITY, WALL_ROWS,
} from '../src/config/tuning.js';

/** 单点图元是否落在该格框内（框含 1px 容差，锁章与珠阵均按格心布点）。 */
const inCell = (c: DrawCommand, b: MetaButton): boolean =>
    'x' in c && c.x >= b.box.x - 1 && c.x <= b.box.x + b.box.w + 1 &&
    'y' in c && c.y >= b.box.y - 1 && c.y <= b.box.y + b.box.h + 1;

/**
 * `line` 命令只有 `x1/y1/x2/y2`（无 `x/y`）⇒ 不能走上面的单点判定，否则虚线永远“不在框内”= 假绿。
 * 口径：`slotDashed` 描边且**任一端**落在该格框内 ⇒ 计作该格虚线图元。
 */
const dashedInCell = (c: DrawCommand, b: MetaButton): boolean => {
    if (c.kind !== 'line' || c.stroke !== DEFAULT_PALETTE.slotDashed) return false;
    const inside = (x: number, y: number): boolean =>
        x >= b.box.x - 1 && x <= b.box.x + b.box.w + 1 && y >= b.box.y - 1 && y <= b.box.y + b.box.h + 1;
    return inside(c.x1, c.y1) || inside(c.x2, c.y2);
};

/** 缩略区框（与 `drawLevelThumb` 同取顶口径）⇒ 只统计盘面色块，不把格底/星带算进来。 */
const thumbBox = (b: MetaButton): { x: number; y: number; w: number; h: number } => ({
    x: b.box.x + (b.box.w - LEVELS_THUMB_AREA) / 2,
    y: b.box.y + b.box.h - THUMB_TOP_INSET - LEVELS_THUMB_AREA,
    w: LEVELS_THUMB_AREA,
    h: LEVELS_THUMB_AREA,
});

/** `[WXG-T-502]` 缩略图只画盘面 ⇒ 色块是 `rect`（非 polygon/circle）。 */
const inThumbRect = (c: DrawCommand, box: { x: number; y: number; w: number; h: number }): boolean =>
    c.kind === 'rect' && c.x >= box.x - 1 && c.x <= box.x + box.w + 1 &&
    c.y >= box.y - 1 && c.y <= box.y + box.h + 1;

const dataFor = (extra: Partial<MetaViewData> = {}): MetaViewData => {
    const slots: number[] = [];
    const levels: (typeof LEVELS)[number][] = [];
    for (let i = 0; i < WALL_CAPACITY; i++) { slots.push(i); levels.push(LEVELS[i]!); }
    return {
        stamina: 5, staminaMax: 5, coins: 0, overlay: 'levels', signinDay: 0, canClaim: false,
        bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true,
        debugInfo: false, debugGuides: false, beadStyle: 'facet-4', beadSize: 'full', skinId: 'tokens',
        levelCount: LEVELS.length,
        currentLevelIndex: 0,
        maxUnlockedLevel: LEVELS.length,
        starsByLevel: [],
        wallSlots: slots,
        wallLevels: levels,
        carouselLevel: LEVELS[0],
        carouselState: 'pushing',
        ...extra,
    };
};

const frame = (data: MetaViewData): readonly DrawCommand[] => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaView(b, data, DEFAULT_PALETTE);
    return b.end().commands;
};

const cells = (): readonly MetaButton[] =>
    metaLayout('levels', WALL_ROWS).buttons.filter((b) => b.id === 'pick-level');

/** hex 是否零饱和（R=G=B ⇒ 灰）。非 hex（如 undefined）不参与判定。 */
const isGrayHex = (fill: unknown): boolean => {
    if (typeof fill !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(fill)) return true;
    const r = parseInt(fill.slice(1, 3), 16), g = parseInt(fill.slice(3, 5), 16), b = parseInt(fill.slice(5, 7), 16);
    return r === g && g === b;
};

afterEach(() => setMenuBitmapResolver());

describe('EP13-FU-1 墙几何 3×3（A1；UI-34 起 = 整页版式 P）', () => {
    it('列数 3 ⇒ 容量 9、热区 9 格、网格 570×570（格 170 / 间距 30）', () => {
        expect(WALL_COLS).toBe(3);
        expect(WALL_CAPACITY).toBe(9);
        const cs = cells();
        expect(cs).toHaveLength(WALL_COLS * WALL_ROWS);
        const left = cs[0]!.box.x;
        const right = cs[cs.length - 1]!.box.x + LEVELS_CELL;
        expect(right - left).toBe(WALL_COLS * LEVELS_CELL + (WALL_COLS - 1) * LEVELS_GAP);
        // 行序与竖向几何不变（逐行下推一格 + 一缝）。
        expect(cs[3]!.box.y).toBe(cs[0]!.box.y - (LEVELS_CELL + LEVELS_GAP));
    });
});

describe('EP13-FU-1 锁格合形（A2 / §7 锁形通道）', () => {
    it('未解锁格 = 灰阵 + 小锁 + 无星 + 无虚线（`slotDashed` 图元退场）', () => {
        setMenuBitmapResolver(() => true);
        const cs = cells();
        const locked = cs[4]!; // maxUnlocked = 1 ⇒ 第 5 格未解锁
        const cmds = frame(dataFor({ maxUnlockedLevel: 1 }));

        // ① 虚线退场：该格框内不存在 `slotDashed` 描边的线段。
        const dashed = cmds.filter((c) => dashedInCell(c, locked));
        expect(dashed).toHaveLength(0);
        // ② 锁形通道在位（非色相通道，§7）。
        expect(cmds.some((c) => c.kind === 'blit' && c.textureId === MENU_TEXTURES.badgeLocked && inCell(c, locked))).toBe(true);
        // ③ 盘面零饱和（灰度值本身未裁 ⇒ 只断言非彩色，跟进单 §4 兜底）。
        const blocks = cmds.filter((c) => inThumbRect(c, thumbBox(locked)));
        expect(blocks.length).toBeGreaterThan(0);
        expect(blocks.every((c) => isGrayHex('fill' in c ? c.fill : undefined))).toBe(true);
        // ④ 无星：格内不写 ★/☆。
        expect(cmds.some((c) => c.kind === 'text' && inCell(c, locked) && /[★☆]/.test(String(c.text ?? '')))).toBe(false);
    });

    it('越界空槽（清单短于槽）与未解锁格同判据：无虚线 + 有锁 + 无星', () => {
        setMenuBitmapResolver(() => true);
        const cs = cells();
        const overflow = cs[7]!;
        const cmds = frame(dataFor({ wallSlots: [0, 1], wallLevels: [LEVELS[0]!, LEVELS[1]!] }));

        const dashed = cmds.filter((c) => dashedInCell(c, overflow));
        expect(dashed).toHaveLength(0);
        expect(cmds.some((c) => c.kind === 'blit' && c.textureId === MENU_TEXTURES.badgeLocked && inCell(c, overflow))).toBe(true);
        expect(cmds.some((c) => c.kind === 'text' && inCell(c, overflow) && /[★☆]/.test(String(c.text ?? '')))).toBe(false);
    });

    it('已解锁格不回退：彩色珠阵 + 星带仍在（A3）', () => {
        setMenuBitmapResolver(() => true);
        const cs = cells();
        const open = cs[0]!;
        const cmds = frame(dataFor({ starsByLevel: [2] }));

        expect(cmds.some((c) => c.kind === 'text' && inCell(c, open) && c.text === '★★☆')).toBe(true);
        const blocks = cmds.filter((c) => inThumbRect(c, thumbBox(open)));
        expect(blocks.some((c) => !isGrayHex('fill' in c ? c.fill : undefined))).toBe(true);
    });

    it('锁格零事件：热区仍在（`pick-level` 槽位不变），闸门由 shell 承担（A4 前置）', () => {
        // 视图只负责呈现；不发事件 = shell 闸门臂（`arc-level-select.test.ts` 既有测）⇒ 本臂只钉「格几何未被删」。
        expect(cells()).toHaveLength(WALL_CAPACITY);
    });
});

/**
 * K-6 图元台账重采（跟进单 A7）：墙从 4×3 收到 3×3、且虚线空槽换成锁格 ⇒
 * `design/art/proposals/ui-style-redesign/risks.md §4b` 的 `wall.rows3` 三组读数全部失效，需现算重取。
 * 本臂只打印读数（⛔ 不发明新预算判据）+ 钉住两条单调关系防假绿。
 */
describe('K-6 台账重采（capturedFrom = 本文件现算）', () => {
    const tally = (cmds: readonly DrawCommand[]): string => {
        const by: Record<string, number> = {};
        for (const c of cmds) by[c.kind] = (by[c.kind] ?? 0) + 1;
        return `${cmds.length} ｜ ${Object.entries(by).map(([k, v]) => `${k} ${v}`).sort().join(' / ')}`;
    };

    const frameVariant = (data: MetaViewData, wallRows: number): readonly DrawCommand[] => {
        const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        b.begin();
        buildMetaView(b, data, DEFAULT_PALETTE, { wallRows });
        return b.end().commands;
    };

    it('满载（9 格全解锁）与首日（仅 L1）两档现算，行数杠杆仍省命令', () => {
        setMenuBitmapResolver(() => true);
        const full = frame(dataFor({ starsByLevel: LEVELS.map(() => 3) }));
        const first = frame(dataFor({ maxUnlockedLevel: 1 }));
        const twoRows = frameVariant(dataFor({ starsByLevel: LEVELS.map(() => 3) }), 2);
        const floor = (() => {
            const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
            b.begin();
            buildMetaView(b, dataFor({ maxUnlockedLevel: 1 }), DEFAULT_PALETTE, { wallRows: 2, thumbN: 3, signage: false });
            return b.end().commands;
        })();
        console.info(
            `[K-6 重采] 选关页满载墙帧 = ${tally(full)}\n` +
            `[K-6 重采] 选关页首日墙帧 = ${tally(first)}\n` +
            `[K-6 重采] 回退序 1（wallRows = 2）= ${tally(twoRows)}\n` +
            `[K-6 重采] 全回落地板（序 1+2+5）= ${tally(floor)}`,
        );
        // Q15 合形的**实测代价**：锁格也画灰阵 ⇒ 首日档与满载同价（旧「1 实格 + 11 虚线槽 = 696」作废）。
        expect(first.length, '首日不省图元（锁格 = 灰阵）').toBe(full.length);
        expect(twoRows.length, '回退序 1（少画一行）必须真省命令，否则台账杠杆是纸面备选').toBeLessThan(full.length);
        expect(floor.length, '地板必须低于满载（回退序真有牙）').toBeLessThan(twoRows.length);
    });
});
