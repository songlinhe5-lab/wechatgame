/**
 * **[WXG-T-271 / ADR-0031 DEC=C′]** boss 缩略位图臂判据（本单唯一可运行检查）。
 * ─────────────────────────────────────────────────────────────────────────────
 * 真源：`ADR-0031` §3.1（DEC=C′，进现成 `assets/textures` Bundle）；实现 =
 * `src/view/menu-signage.ts::{setLevelThumbBitmapResolver, drawLevelThumb}` + `tuning.ts::BOSS_THUMB_TEXTURES`。
 * 盯三个失败模式：
 * 1. **未注入 resolver 就画空 / 改变既有输出**：默认臂必须逐字节 = 今日程序化缩略（绿线锚）。
 * 2. **命中后仍叠程序化**（双绘）：命中 ⇒ **恰 1 条** blit、程序化分支 `return` 掉。
 * 3. **几何错位**：blit 左下原点 = `x+(w-面)/2`、`顶缘−面`（面 = `THUMB_AREA`），与程序化缩略区同框。
 * 层级：tests（纯渲染断言，⛔ 不写业务状态；不依赖 Cocos 资产——装载腿属宿主真机步）。
 */
import { describe, expect, it, afterEach } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import {
    DESIGN_H,
    DESIGN_W,
    THUMB_AREA,
    THUMB_TOP_INSET,
    WALL_CELL,
} from '../src/config/tuning.js';
import { LEVELS } from '../src/config/levels.js';
import { drawLevelThumb, setLevelThumbBitmapResolver } from '../src/view/menu-signage.js';

const BOSS_ID = 9;
const boss = LEVELS.find((l) => l.id === BOSS_ID)!;
const first = LEVELS.find((l) => l.id === 1)!;

function paint(level: (typeof LEVELS)[number]): readonly DrawCommand[] {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    drawLevelThumb(b, level, 100, 200, WALL_CELL, WALL_CELL);
    return b.end().commands;
}

describe('boss 缩略位图臂（ADR-0031 C′）', () => {
    afterEach(() => setLevelThumbBitmapResolver(undefined));

    it('未注入 resolver ⇒ 程序化缩略、零 blit（绿线锚 = 今日）', () => {
        setLevelThumbBitmapResolver(undefined);
        const cmds = paint(boss);
        expect(cmds.some((c) => c.kind === 'blit')).toBe(false);
        expect(cmds.length).toBeGreaterThan(0);
    });

    it('命中 resolver ⇒ 恰 1 条 blit、按面铺满缩略区、无程序化叠绘', () => {
        setLevelThumbBitmapResolver((lvl) => (lvl.id === BOSS_ID ? 'bitmap__boss_l9' : undefined));
        const cmds = paint(boss);
        const blits = cmds.filter((c) => c.kind === 'blit');
        expect(blits.length).toBe(1);
        expect(cmds.length).toBe(1); // ⛔ 不叠程序化珠
        const b = blits[0]!;
        if (b.kind === 'blit') {
            expect(b.textureId).toBe('bitmap__boss_l9');
            expect(b.w).toBe(THUMB_AREA);
            expect(b.h).toBe(THUMB_AREA);
            expect(b.x).toBe(100 + (WALL_CELL - THUMB_AREA) / 2);
            expect(b.y).toBe(200 + WALL_CELL - THUMB_TOP_INSET - THUMB_AREA);
        }
    });

    it('非位图关（resolver 返 undefined）⇒ 该关仍程序化、零 blit', () => {
        setLevelThumbBitmapResolver((lvl) => (lvl.id === BOSS_ID ? 'bitmap__boss_l9' : undefined));
        const cmds = paint(first);
        expect(cmds.some((c) => c.kind === 'blit')).toBe(false);
    });
});
