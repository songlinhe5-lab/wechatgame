/**
 * WXG-T-290（EP13-FU-1）— 选关墙「虚线空槽 → 锁格合形」+ 3×3 收墙
 * ─────────────────────────────────────────────────────────────────────────────
 * 判据真源（⛔ 本文件零新判据）：
 *  - `games/beads/design/ux/arc-level-select-spec.md` **§4**「未解锁格」「越界空槽」两行
 *    （Q15 = 2026-10-17 改裁**合形**：灰色珠阵图 + 小锁 + 零热区；星带按 WXG-T-606 用户令改为**逐格显示 ☆☆☆**）；
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
import { buildMetaModal, metaLayout, setMenuBitmapResolver, type MetaButton, type MetaViewData } from '../src/view/meta-view.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import {
    DESIGN_H, DESIGN_W, LEVEL_SELECT_GEO, LEVEL_SELECT_TEXTURES, WALL_COLS, WALL_CAPACITY, WALL_ROWS,
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

/**
 * 图案槽框（稿 `176:21 grid-image`，`[WXG-T-616]` 放大为 126×94，`[WXG-T-620]` 判据同步）：
 * `drawBeadFace` 以槽宽高为界等比铺珠 ⇒ 槽 = `cellArt.imageW × imageH`。
 */
const thumbBox = (b: MetaButton): { x: number; y: number; w: number; h: number } => {
    const a = LEVEL_SELECT_GEO.cellArt;
    return {
        x: b.box.x + a.imageLeft,
        y: b.box.y + b.box.h - a.imageTopDown - a.imageH,
        w: a.imageW,
        h: a.imageH,
    };
};

/**
 * `[WXG-T-620]` 缩略珠面 = 盘面同款 `drawFilledBead`（facet-4：rect 底 + 四 polygon + 两 circle）⇒
 * 本判据只收 **rect 底 / 孔圆** 两形（顶点住 `RenderModel.vertices`，不在命令对象上；
 * 两者的色都出自同一墨集 ⇒ 灰/彩判定不失真）。
 * `[WXG-T-607]` 位图模板腿的 65×35 编号牌 rect 会落进缩略框 ⇒ 按珠体尺寸（≤20）过滤，
 * ⛔ 不把 UI 装饰误判成盘面珠（K-053 判据迁移）。
 */
const inThumbRect = (c: DrawCommand, box: { x: number; y: number; w: number; h: number }): boolean => {
    if (c.kind !== 'rect' && c.kind !== 'circle') return false;
    const d = c.kind === 'circle' ? c.r * 2 : c.w;
    if (d > 20) return false;
    const x = c.kind === 'circle' ? c.x - c.r : c.x;
    const y = c.kind === 'circle' ? c.y - c.r : c.y;
    return x >= box.x - 1 && x <= box.x + box.w + 1 && y >= box.y - 1 && y <= box.y + box.h + 1;
};

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
    // `[WXG-T-503]` 选关 = 弹窗：本文件只测墙格内容 ⇒ **只画弹窗腿**（底页菜单不参与断言）。
    buildMetaModal(b, data, DEFAULT_PALETTE);
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

describe('EP13-FU-1 墙几何 3×3（A1；`[WXG-T-605]` 起 = 详情木牌版式）', () => {
    it('列数 3 ⇒ 容量 9、热区 9 格、格墙 474 宽（格 158×181 / 列无缝 / 行 pitch 194）', () => {
        expect(WALL_COLS).toBe(3);
        expect(WALL_CAPACITY).toBe(9);
        const cs = cells();
        expect(cs).toHaveLength(WALL_COLS * WALL_ROWS);
        const left = cs[0]!.box.x;
        const cell = cs[0]!.box.w;
        const gap = cs[1]!.box.x - (cs[0]!.box.x + cell);
        expect(cs[cs.length - 1]!.box.x + cell - left).toBe(WALL_COLS * cell + (WALL_COLS - 1) * gap);
        // `[WXG-T-607]` 旧 128 / 16 / 416 方形格随 Figma `159:3` 稿退场（K-053 划线留档）。
        expect(cell).toBe(158);
        expect(cs[0]!.box.h).toBe(181);
        expect(gap).toBe(0);
        expect(WALL_COLS * cell + (WALL_COLS - 1) * gap).toBe(474);
        // 行序按稿面 pitchY（≠ 格宽，非正方形格）。
        expect(cs[3]!.box.y).toBe(cs[0]!.box.y - LEVEL_SELECT_GEO.grid.pitchY);
    });
});

describe('EP13-FU-1 锁格合形（A2 / §7 锁形通道；`[WXG-T-611]` 图案槽稿面化）', () => {
    it('未解锁格 = 图案槽贴稿面锁图（等比居中于放大槽）+ 星带隐藏 + 无虚线（`slotDashed` 图元退场）', () => {
        // `[WXG-T-611]` 位图臂：resolver 开 lockImage ⇒ 锁格图案槽 blit 稿 `176:21`，无星无旧锁角章。
        setMenuBitmapResolver((id) => id === LEVEL_SELECT_TEXTURES.lockImage);
        const cs = cells();
        const locked = cs[4]!; // maxUnlocked = 1 ⇒ 第 5 格未解锁
        const cmds = frame(dataFor({ maxUnlockedLevel: 1 }));

        // ① 虚线退场：该格框内不存在 `slotDashed` 描边的线段。
        const dashed = cmds.filter((c) => dashedInCell(c, locked));
        expect(dashed).toHaveLength(0);
        // ② 锁形通道：`[WXG-T-616]` 放大槽内按原生 69×76 **等比**居中（⛔ 不拉伸铺槽）。
        const a = LEVEL_SELECT_GEO.cellArt;
        const lockBlits = cmds.filter(
            (c) => c.kind === 'blit' && (c as { textureId: string }).textureId === LEVEL_SELECT_TEXTURES.lockImage && inCell(c, locked),
        ) as { x: number; y: number; w: number; h: number }[];
        expect(lockBlits, '每锁格恰 1 枚锁图案').toHaveLength(1);
        const lockW = a.imageH * (a.lockW / a.lockH);
        expect(lockBlits[0]).toMatchObject({
            x: locked.box.x + a.imageLeft + (a.imageW - lockW) / 2,
            y: locked.box.y + (locked.box.h - a.imageTopDown - a.imageH),
            w: lockW,
            h: a.imageH,
        });
        // ③ 星带隐藏（`T-611` 用户令「锁关…同时隐藏 3 个星星」）。
        expect(cmds.some((c) => c.kind === 'text' && inCell(c, locked) && c.text === '☆☆☆')).toBe(false);
        // ④ 旧锁角章退场（`T-611` 用户令「单独展示的锁图案去掉」，K-053）。
        expect(cmds.some((c) => c.kind === 'text' && inCell(c, locked) && c.text === '锁')).toBe(false);
    });

    it('缺图降级腿：锁格灰珠阵落图案槽位（零饱和）+ 星带隐藏', () => {
        setMenuBitmapResolver(() => false);
        const cs = cells();
        const locked = cs[4]!;
        const cmds = frame(dataFor({ maxUnlockedLevel: 1 }));

        const blocks = cmds.filter((c) => inThumbRect(c, thumbBox(locked)));
        expect(blocks.length).toBeGreaterThan(0);
        expect(blocks.every((c) => isGrayHex('fill' in c ? c.fill : undefined))).toBe(true);
        expect(cmds.some((c) => c.kind === 'text' && inCell(c, locked) && c.text === '☆☆☆')).toBe(false);
    });

    it('越界空槽（清单短于槽）与未解锁格同判据：图案槽锁图 + 星带隐藏', () => {
        setMenuBitmapResolver((id) => id === LEVEL_SELECT_TEXTURES.lockImage);
        const cs = cells();
        const overflow = cs[7]!;
        const cmds = frame(dataFor({ wallSlots: [0, 1], wallLevels: [LEVELS[0]!, LEVELS[1]!] }));

        const dashed = cmds.filter((c) => dashedInCell(c, overflow));
        expect(dashed).toHaveLength(0);
        expect(cmds.some((c) => c.kind === 'blit' && (c as { textureId: string }).textureId === LEVEL_SELECT_TEXTURES.lockImage && inCell(c, overflow))).toBe(true);
        expect(cmds.some((c) => c.kind === 'text' && inCell(c, overflow) && c.text === '☆☆☆')).toBe(false);
    });

    it('已解锁格不回退：彩色珠阵（图案槽位）+ 星带仍在（A3）', () => {
        // `[WXG-T-611]` 本臂测**缺图降级腿**（文字星档 / 程序化珠拼）；位图腿由 level-select-view-model.test.ts 承担。
        setMenuBitmapResolver(() => false);
        const cs = cells();
        const open = cs[0]!;
        const cmds = frame(dataFor({ starsByLevel: [2] }));

        expect(cmds.some((c) => c.kind === 'text' && inCell(c, open) && c.text === '★★☆')).toBe(true);
        const blocks = cmds.filter((c) => inThumbRect(c, thumbBox(open)));
        expect(blocks.length).toBeGreaterThan(0);
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
        buildMetaModal(b, data, DEFAULT_PALETTE, { wallRows });
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
            buildMetaModal(b, dataFor({ maxUnlockedLevel: 1 }), DEFAULT_PALETTE, { wallRows: 2, thumbN: 3, signage: false });
            return b.end().commands;
        })();
        console.info(
            `[K-6 重采] 选关页满载墙帧 = ${tally(full)}\n` +
            `[K-6 重采] 选关页首日墙帧 = ${tally(first)}\n` +
            `[K-6 重采] 回退序 1（wallRows = 2）= ${tally(twoRows)}\n` +
            `[K-6 重采] 全回落地板（序 1+2+5）= ${tally(floor)}`,
        );
        // `[WXG-T-611]` 锁格 = 图案槽单 blit、无星带无章 ⇒ 每锁格反而比解锁格便宜
        //（Q15 时代「首日 = 满载 + 8 锁章」口径反转，K-053 留档）。
        expect(first.length, '锁格更便宜：首日 < 满载').toBeLessThan(full.length);
        expect(twoRows.length, '回退序 1（少画一行）必须真省命令，否则台账杠杆是纸面备选').toBeLessThan(full.length);
        expect(floor.length, '地板必须低于满载（回退序真有牙）').toBeLessThan(twoRows.length);
    });
});
