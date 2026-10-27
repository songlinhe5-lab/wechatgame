/**
 * UI-32 · SigninModal 内容块（ADR-0032 §4「SigninModal 签到」）。
 *
 * 验收原文：「金样本对拍」（`ui-golden.test.ts` 的 signin 态逐字零差异）。
 * 本文件钉住内容块自身：7 格版式（4 + 3 居中）、三态格绘制（已领 / 今日 / 未领）、
 * 领取与返回两钮可命中，以及「标题 / 版式 / 绘制单源」静态门。
 *
 * ⚠ 签到入口已退役（Q5①，`ux-spec` §5.1b）：金样本与 metaLayout 仍经测试后门保留该态；
 * 本批不引入开合时钟（无真实开启动线，⛔ 不造死路径）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderModelBuilder } from '@wxgame/framework';
import { hitTestMeta, metaLayout } from '../src/view/meta-view.js';
import {
    SIGNIN_TITLE,
    drawSigninContent,
    signinCellLayout,
    type SigninBox,
} from '../src/view/signin-content.js';
import type { BeadsPalette } from '../src/view/palette.js';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PALETTE = {
    text: '#222222',
    textDim: '#666666',
    slot: '#cccccc',
    panel: '#ffffff',
    accentPrimary: '#e4572e',
    slotBorder: '#999999',
    success: '#4caf50',
} as unknown as BeadsPalette;

/** 静止态底板（`OVERLAY_PLATE`：750×1334 设计空间，600×720 居中）。 */
const PLATE: SigninBox = { x: 75, y: 307, w: 600, h: 720 };

interface Call {
    readonly kind: string;
    readonly args: readonly number[];
    readonly opts?: Record<string, unknown>;
    readonly text?: string;
}

function callsOf(fn: (b: RenderModelBuilder) => void): Call[] {
    const calls: Call[] = [];
    const b = {
        rect: (x: number, y: number, w: number, h: number, opts: Record<string, unknown>) =>
            calls.push({ kind: 'rect', args: [x, y, w, h], opts }),
        text: (x: number, y: number, text: string) =>
            calls.push({ kind: 'text', args: [x, y], text }),
    } as unknown as RenderModelBuilder;
    fn(b);
    return calls;
}

describe('UI-32 · SigninContent', () => {
    it('7 格版式：上行 4 / 下行 3，逐格居中且不重叠', () => {
        const cells = signinCellLayout(PLATE);
        expect(cells).toHaveLength(7);
        // 上行：4×110 + 3×18 = 494 宽 ⇒ 左缘 = 75 + (600−494)/2 = 128；y = 307+720−180 = 847。
        expect(cells[0]).toEqual({ x: 128, y: 847, w: 110, h: 110 });
        expect(cells[3]).toEqual({ x: 512, y: 847, w: 110, h: 110 });
        // 下行：3×110 + 2×18 = 366 宽 ⇒ 左缘 = 75 + (600−366)/2 = 192；y = 847−128 = 719。
        expect(cells[4]).toEqual({ x: 192, y: 719, w: 110, h: 110 });
        expect(cells[6]).toEqual({ x: 448, y: 719, w: 110, h: 110 });
        // 全部落在底板内。
        for (const c of cells) {
            expect(c.x).toBeGreaterThanOrEqual(PLATE.x);
            expect(c.x + c.w).toBeLessThanOrEqual(PLATE.x + PLATE.w);
            expect(c.y).toBeGreaterThanOrEqual(PLATE.y);
            expect(c.y + c.h).toBeLessThanOrEqual(PLATE.y + PLATE.h);
        }
    });

    // `[WXG-T-460]` 标题/格带分离守卫：格顶（上行上缘）必须在标题基线（板顶下 50，
    // `panelPage` 同款）之下 ≥20px —— 字形自基线向上延，格顶越线即读作「标题压格」。
    it('标题/格带分离：格顶落标题基线下 ≥20px，钮带与格带不交界', () => {
        const cells = signinCellLayout(PLATE);
        const titleBaseline = PLATE.y + PLATE.h - 50; // panelPage 标题基线同款
        const topRowTop = Math.max(...cells.map((c) => c.y + c.h));
        expect(titleBaseline - topRowTop).toBeGreaterThanOrEqual(20);
        // 钮带（板底 +60 起，60 高）与最下行格底不交界。
        const btnTop = PLATE.y + 60;
        const bottomRowBottom = Math.min(...cells.map((c) => c.y));
        expect(bottomRowBottom).toBeGreaterThanOrEqual(btnTop + 60);
    });

    it('弹窗布局同源：metaLayout 的 7 格 = signinCellLayout，领取 / 返回两钮可命中', () => {
        const layout = metaLayout('signin');
        expect(layout.signinCells).toEqual(signinCellLayout(PLATE));
        expect(layout.buttons.map((b) => b.id)).toEqual(['claim', 'back']);
        for (const b of layout.buttons) {
            const hit = hitTestMeta('signin', b.box.x + b.box.w / 2, b.box.y + b.box.h / 2);
            expect(hit?.id).toBe(b.id);
        }
    });

    it('三态格绘制：已领 ✓ / 今日 4px 主色描边 / 未领奖励文案', () => {
        const cells = signinCellLayout(PLATE);
        const calls = callsOf((b) => drawSigninContent(b, cells, 2, true, PALETTE));
        const rects = calls.filter((c) => c.kind === 'rect');
        const texts = calls.filter((c) => c.kind === 'text');
        expect(rects).toHaveLength(7);
        expect(texts).toHaveLength(14);
        // 第 1–2 天已领：✓ + α 0.6；第 3 天 = 今日：4px 主色描边。
        expect(texts.filter((c) => c.text === '✓')).toHaveLength(2);
        expect(rects[0]!.opts?.alpha).toBe(0.6);
        expect(rects[1]!.opts?.alpha).toBe(0.6);
        expect(rects[2]!.opts?.lineWidth).toBe(4);
        expect(rects[2]!.opts?.stroke).toBe(PALETTE.accentPrimary);
        expect(rects[3]!.opts?.lineWidth).toBe(2);
        // 未领格保留奖励文案（❤ 优先于 🪙）。
        expect(texts.some((c) => c.text?.startsWith('❤') || c.text?.startsWith('🪙'))).toBe(true);
    });

    it('不可领取时今日格按已领画（✓ 计数 +1）', () => {
        const cells = signinCellLayout(PLATE);
        const calls = callsOf((b) => drawSigninContent(b, cells, 2, false, PALETTE));
        expect(calls.filter((c) => c.kind === 'text' && c.text === '✓')).toHaveLength(3);
    });

    it('单源：标题 / 版式 / 绘制只住 signin-content，meta-view 不再自带签到字面', () => {
        expect(SIGNIN_TITLE).toBe('七日签到');
        // WXG-T-420 T7：菜单拆片后「签到不自带字面」的射程 = meta* 全部视图件（判例 K-183）。
        const meta = ['src/view/meta-view.ts', 'src/view/meta-layout.ts', 'src/view/meta-widgets.ts', 'src/view/meta-menu.ts']
            .map((p) => readFileSync(resolve(SRC_ROOT, p), 'utf8'))
            .join('\n');
        expect(meta).toContain('signinCellLayout(plate)');
        expect(meta).toContain('drawSigninContent(');
        expect(meta).toContain('SIGNIN_TITLE');
        expect(meta).not.toContain("'七日签到'");
        expect(meta).not.toContain('SIGNIN_REWARDS');
    });
});
