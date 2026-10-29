/**
 * EP13-S5 — 选关格按下态（C-3 ①③，附带 ② 核对）
 * ─────────────────────────────────────────────────────────────────────────────
 * 判据真源（⛔ 本文件零新判据、零新数值）：
 *  - `games/beads/design/ux/arc-level-select-spec.md` **§4-R6**「任意格 · 按下态」行：
 *    沿用既有 `pressedButton` 机制（`data.pressed` **对象身份比对**）+ `pressDy` = −`UI_PRESS_SINK`（2px）；
 *    `reduceMotion` 开 ⇒ 位移归零、只换面；
 *  - 同文 **§4 格状态×呈现矩阵**「按下」列（推关中 / 已通关 / 当前关三行 = 同上 −2px）；
 *  - 同文 **§5**「格按下态」行：2px、**无时长**（逐帧态）⇒ 不占 §5 红线；
 *  - 同文 **§7** 非色相通道：已通关 = **符号串** `★/☆`（`STAR_LABELS`）通道，⛔ 不得只靠颜色；
 *  - C-3 ②「已通关呈现现码已成立」⇒ 本文件只做**形状核对断言**，⛔ 不新增呈现。
 *
 * 口径：`metaLayout` 对 `levels` 走模块级缓存 ⇒ 热区返回的按钮对象与 `buildMetaView` 绘制用的是
 * **同一引用**，因此对象身份比对（`data.pressed === b`）在本测试与生产同构，无需特判。
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaModal, metaLayout, type MetaButton, type MetaViewData } from '../src/view/meta-view.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { DESIGN_H, DESIGN_W, UI_PRESS_SINK, WALL_ROWS } from '../src/config/tuning.js';

const NEAR = 0.01;
const near = (a: number, b: number): boolean => Math.abs(a - b) < NEAR;

/**
 * `levels` overlay 的**已解锁格**热区（模块级缓存 ⇒ 与 `buildMetaView` 同引用）。
 * 墙 4×3 = 12 槽、现池 9 关 ⇒ 尾部 3 槽 = 越界空槽（规格 §4 矩阵「无（该槽本就不消费）」）。
 */
const cells = (): readonly MetaButton[] =>
    metaLayout('levels', WALL_ROWS).buttons.filter(
        (b) => b.id === 'pick-level' && (b.slot ?? 0) < LEVELS.length,
    );

const dataFor = (extra: Partial<MetaViewData> = {}): MetaViewData => {
    const cs = cells();
    return {
        stamina: 5, staminaMax: 5, coins: 0, overlay: 'levels', signinDay: 0, canClaim: false,
        bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true,
        debugInfo: false, debugGuides: false, beadStyle: 'facet-4', beadSize: 'full', skinId: 'tokens',
        levelCount: LEVELS.length,
        currentLevelIndex: 0,
        maxUnlockedLevel: LEVELS.length,
        starsByLevel: [],
        wallSlots: cs.map((b) => b.slot!),
        wallLevels: cs.map((b) => LEVELS[b.slot!]!),
        carouselLevel: LEVELS[0],
        carouselState: 'pushing',
        ...extra,
    };
};

const frame = (data: MetaViewData): readonly DrawCommand[] => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    // `[WXG-T-503]` 选关 = 弹窗：本文件只测格按下态 ⇒ 只画弹窗腿（底页菜单不参与断言）。
    buildMetaModal(b, data, DEFAULT_PALETTE);
    return b.end().commands;
};

const rectAt = (cmds: readonly DrawCommand[], x: number, y: number): DrawCommand | undefined =>
    cmds.find((c) => c.kind === 'rect' && near(c.x, x) && near(c.y, y));

/** 以格热区为上界推断它的「格底矩形」：常态在 `box.y`，按下在 `box.y − UI_PRESS_SINK`。 */
const cellRect = (cmds: readonly DrawCommand[], b: MetaButton, dy: number): DrawCommand | undefined =>
    rectAt(cmds, b.box.x, b.box.y + dy);

describe('选关格按下态（§4-R6 / §5 / §7 非色相通道）', () => {
    it('按住一格：整格下沉 UI_PRESS_SINK，对象身份比对 ⇒ 仅该格位移', () => {
        const cs = cells();
        const target = cs[1]!;
        const rest = frame(dataFor());
        const pressed = frame(dataFor({ pressed: target }));

        // 常态：每格都在原位。
        for (const b of cs) expect(cellRect(rest, b, 0)).toBeTruthy();
        expect(cellRect(rest, target, -UI_PRESS_SINK)).toBeFalsy();

        // 按下：目标格离开原位、落到 −2px；其余格原地不动（id 相同 ⇒ 必须靠对象身份区分）。
        expect(cellRect(pressed, target, 0)).toBeFalsy();
        expect(cellRect(pressed, target, -UI_PRESS_SINK)).toBeTruthy();
        const shifted = cs.filter((b) => cellRect(pressed, b, -UI_PRESS_SINK) !== undefined);
        expect(shifted).toHaveLength(1);
        expect(shifted[0]).toBe(target);
    });

    it('按下换面：常态 slot、按下 cardPressed（既有按压面色，零新色）', () => {
        const cs = cells();
        const target = cs[2]!;
        const rest = frame(dataFor());
        const pressed = frame(dataFor({ pressed: target }));

        expect((cellRect(rest, target, 0) as { fill?: string }).fill).toBe(DEFAULT_PALETTE.slot);
        expect((cellRect(pressed, target, -UI_PRESS_SINK) as { fill?: string }).fill).toBe(DEFAULT_PALETTE.cardPressed);
    });

    it('reduceMotion：位移归零，但换面仍在（弱动效不丢按下反馈）', () => {
        const cs = cells();
        const target = cs[4]!;
        const cmds = frame(dataFor({ pressed: target, reduceMotion: true }));

        for (const b of cs) expect(cellRect(cmds, b, -UI_PRESS_SINK)).toBeFalsy();
        const inPlace = cellRect(cmds, target, 0) as { fill?: string };
        expect(inPlace).toBeTruthy();
        expect(inPlace.fill).toBe(DEFAULT_PALETTE.cardPressed);
    });

    it('按住其他钮（back）不波及任何格', () => {
        const back = metaLayout('levels', WALL_ROWS).buttons.find((b) => b.id === 'back')!;
        const cmds = frame(dataFor({ pressed: back }));
        for (const b of cells()) {
            expect(cellRect(cmds, b, 0)).toBeTruthy();
            expect(cellRect(cmds, b, -UI_PRESS_SINK)).toBeFalsy();
        }
    });

    it('C-3② 核对：已通关 = 符号串 ★ 通道 + 与推关中同形同尺（零新呈现）', () => {
        const cs = cells();
        const cmds = frame(dataFor({ starsByLevel: [3, 0] }));

        const cleared = cs[0]!;
        const pushing = cs[1]!;
        const textAt = (b: MetaButton): DrawCommand | undefined =>
            cmds.find(
                (c) =>
                    c.kind === 'text' &&
                    near(c.x, b.box.x + b.box.w / 2) &&
                    // 星带中心（`THUMB_STAR_BAND / 2` = 14，现码已在）
                    near(c.y, b.box.y + 14),
            );
        const clearedText = textAt(cleared) as { text?: string; fill?: string };
        const pushingText = textAt(pushing) as { text?: string; fill?: string };
        expect(clearedText?.text).toBe('★★★');
        expect(clearedText?.fill).toBe(DEFAULT_PALETTE.text);
        expect(pushingText?.text).toBe('☆☆☆');
        expect(pushingText?.fill).toBe(DEFAULT_PALETTE.textDim);

        // 同形同尺：两格底矩形宽高一致（不因通关另立尺寸）。
        const a = cellRect(cmds, cleared, 0) as { w: number; h: number };
        const b = cellRect(cmds, pushing, 0) as { w: number; h: number };
        expect(a.w).toBe(b.w);
        expect(a.h).toBe(b.h);
    });
});
