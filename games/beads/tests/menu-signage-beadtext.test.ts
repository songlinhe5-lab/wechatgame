/**
 * **[EP12-S6 · T-2B]** 招牌 `beadText` 位表渲染判据套（WXG-T-269-S6 子单 T-2B / Deliverable 5）。
 * ─────────────────────────────────────────────────────────────────────────────
 * 真源：`games/beads/art/menu-wall-signage-spec.md`（林绘澄 T-1）**§0.5 位表语义** + **§1.5 `10×10 @ d=12` 位表**；
 * 换算实现 = `src/view/menu-signage.ts::drawBeadText`；位表数据 = `src/config/sign-glyphs.ts`。
 *
 * ## 本套盯的三个失败模式
 * 1. **反位**（T-1 §0.5 明文「位序歧义是首要风险」）：把 `rows[0]` 当底行 / 把 `c00` 当最右列 ⇒ 字形上下或左右镜像，
 *    `小` 的卧钩与 `铺` 的底横翻到字顶。⇒ 腿 2 用「期望集合 ≡ 实测」**加**「反位集合 ≢ 实测」双向锁
 *    （判例 = `bead-style-pool.test.ts` TC-STY-10 臂 B：只钉正面会让「恒返基准」自证）。
 * 2. **抄错位表**：本工程文件是 T-1 位表的**逐字转写**，珠数计数是最廉价的指纹
 *    ⇒ 腿 1 把每枚字模的 `#` 计数与 T-1 §1.6 登记表逐字对撞。
 *    ⚠ 这里引 T-1 数字是**转写保真门**（对撞「我方数据 ≠ 规格件数据」），与 K-6 禁的「纸面推算值入册」（K-051）
 *      不是同一件事 —— 后者归 `menu-primitives-k6.test.ts`，全部用实测帧相减。
 * 3. **私造通道**：招牌若不走 `drawFilledBead` 既有珠体通道，系数 7 / 口径 B / 色源唯一三条都会飘
 *    ⇒ 腿 4 用「同一条通道、同样入参」画参照珠做逐字节流对撞。
 *
 * 层级：tests（⛔ 不写业务状态；本套全为纯渲染断言，无 shell、无存档）。
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import {
    BEAD_GAP,
    BEAD_STYLE_MAX_COMMANDS,
    DESIGN_H,
    DESIGN_W,
    MENU_TITLE_Y,
    SIGN_BEAD_PITCH,
    SIGN_FACE_FLOOR,
    SIGN_GLYPH_GAP_RATIO,
    SIGN_MATRIX_N,
    SIGN_PITCH_MAX,
    SIGN_PITCH_MIN_B,
    SIGN_TOTAL_W,
    SIGN_WIDTH_COEF,
    signFaceB,
} from '../src/config/tuning.js';
import { COPY_TOKENS } from '../src/config/copy-tokens.js';
import { SIGN_GLYPHS, SIGN_GLYPH_MATRIX_N, signGlyphBeadsOf, signGlyphOf } from '../src/config/sign-glyphs.js';
import {
    SIGN_INK_COLOR_IDX,
    drawBeadText,
    resetSignageWarnings,
    signTierReady,
    signBands,
} from '../src/view/menu-signage.js';
import { drawFilledBead, type FilledBeadOptions } from '../src/view/bead-render.js';
import { DEMO_BEAD_INKS } from '../src/view/palette.js';

const APP = COPY_TOKENS.app_name;

type CircleCmd = Extract<DrawCommand, { kind: 'circle' }>;
type RectCmd = Extract<DrawCommand, { kind: 'rect' }>;
type PolyCmd = Extract<DrawCommand, { kind: 'polygon' }>;

/** 只画招牌的一帧 ⇒ 命令流无噪声（容器 / 文字令牌不进场）。 */
function paintSign(
    text: string = APP,
    centerY: number = MENU_TITLE_Y,
    n: number = SIGN_MATRIX_N,
    d: number = SIGN_BEAD_PITCH,
): { beads: number; circles: CircleCmd[]; rects: RectCmd[]; polys: PolyCmd[]; flow: string[] } {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    const beads = drawBeadText(builder, text, centerY, n, d);
    const commands = builder.end().commands;
    return {
        beads,
        circles: commands.filter((c) => c.kind === 'circle') as CircleCmd[],
        rects: commands.filter((c) => c.kind === 'rect') as RectCmd[],
        polys: commands.filter((c) => c.kind === 'polygon') as PolyCmd[],
        flow: commands.map((c) => JSON.stringify(c)),
    };
}

/**
 * 位表 → 期望珠心（T-1 §0.5 口径，`control-manifest §8`：y 向上、原点左下）。
 * `flip` 用于生成**反位**对照集（`v`=上下翻、`h`=左右翻）——它们都必须与实测**不等**。
 * `sorted` ⇒ 集合对撞用；`false` ⇒ 保持扫描序（与 `drawBeadText` 的发射序逐行同 ⇒ 流级对撞用）。
 */
function expectedCenters(
    text: string,
    centerY: number,
    n: number,
    d: number,
    flip: 'none' | 'v' | 'h' | 'both' = 'none',
    sorted = true,
): string[] {
    const box = n * d;
    const gap = box * SIGN_GLYPH_GAP_RATIO;
    const totalW = text.length * box + Math.max(0, text.length - 1) * gap;
    const left0 = (DESIGN_W - totalW) / 2;
    const top = centerY + box / 2;
    const out: string[] = [];
    for (let i = 0; i < text.length; i++) {
        const glyph = signGlyphOf(text.codePointAt(i)!);
        if (glyph === undefined) continue;
        const glyphLeft = left0 + i * (box + gap);
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (glyph.rows[flip === 'v' || flip === 'both' ? n - 1 - r : r]!.charCodeAt(
                    flip === 'h' || flip === 'both' ? n - 1 - c : c,
                ) !== 0x23) continue;
                out.push(`${glyphLeft + (c + 0.5) * d}|${top - (r + 0.5) * d}`);
            }
        }
    }
    return sorted ? out.sort() : out;
}

/**
 * 该字模在 `flip` 下是否**自身对称**（逐格位与镜像位同值）。用于把反例锁写成双向恒等式：
 * 「移位 ⟺ 非自对称」——否则会把「豆」这种摆上左右对称的字误判为「反位未暴露」。
 */
function selfSymmetric(rows: readonly string[], n: number, flip: 'v' | 'h' | 'both'): boolean {
    const rv = flip === 'v' || flip === 'both';
    const rh = flip === 'h' || flip === 'both';
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (rows[r]!.charCodeAt(c) !== rows[rv ? n - 1 - r : r]!.charCodeAt(rh ? n - 1 - c : c)) return false;
        }
    }
    return true;
}

const actualCenters = (circles: CircleCmd[]): string[] =>
    // facet-4 每珠两枚**同心**圆 ⇒ 按 (x,y) 去重后就是珠心集。
    [...new Set(circles.map((c) => `${c.x}|${c.y}`))].sort();

beforeEach(() => {
    resetSignageWarnings();
});

describe('[T-2B] 位表数据完整性（T-1 §1.5 逐字转写的保真门）', () => {
    it('四枚字模 = n×n 方阵，字符集闭于 {# , .}，且 n ≡ SIGN_MATRIX_N', () => {
        expect(SIGN_GLYPHS.length).toBe(4);
        for (const g of SIGN_GLYPHS) {
            expect(g.n, `「${g.char}」边长`).toBe(SIGN_MATRIX_N);
            expect(SIGN_GLYPH_MATRIX_N).toBe(SIGN_MATRIX_N);
            expect(g.rows.length).toBe(g.n);
            for (const row of g.rows) {
                expect(row.length).toBe(g.n);
                expect(/^[#.]+$/.test(row), `位表非法字符：${row}`).toBe(true);
            }
        }
    });

    it('每枚字模珠数 ≡ T-1 §1.6 登记表（37 / 38 / 19 / 54；合计 148）', () => {
        // 转写保真门：本工程文件是规格件的逐字转写，计数是最廉价的指纹（见文件头「失败模式 2」）。
        const counted = Object.fromEntries(SIGN_GLYPHS.map((g) => [g.char, g.beads]));
        expect(counted).toEqual({ 拼: 37, 豆: 38, 小: 19, 铺: 54 });
        expect(signGlyphBeadsOf(APP)).toBe(37 + 38 + 19 + 54);
    });

    it('app_name 的每个码点都有字模（⇒ 生产链路不会静默跳字、不会走文字回落臂）', () => {
        for (let i = 0; i < APP.length; i++) {
            expect(signGlyphOf(APP.codePointAt(i)!), `第 ${i} 字无字模`).toBeDefined();
        }
    });
});

describe('[T-2B] 位表行主序 / y 向（防反位，T-1 §0.5）', () => {
    it('实测珠心集 ≡ 位表按「rows[0] = 视觉顶行 / c00 = 视觉最左列」换算的期望集', () => {
        const { circles } = paintSign();
        expect(actualCenters(circles)).toEqual(expectedCenters(APP, MENU_TITLE_Y, SIGN_MATRIX_N, SIGN_BEAD_PITCH));
    });

    it('反例锁：上下翻 / 左右翻 / 双翻三套反位期望集**全部** ≢ 实测（防「恒返基准」式自证）', () => {
        const seen = actualCenters(paintSign().circles);
        const n = SIGN_MATRIX_N;
        for (const flip of ['v', 'h', 'both'] as const) {
            const flipped = expectedCenters(APP, MENU_TITLE_Y, n, SIGN_BEAD_PITCH, flip);
            expect(flipped, `反位（${flip}）不得与实测相等`).not.toEqual(seen);
            // 逐枚字模的**双向**恒等式：移位 ⇔ 非自对称（`豆` 本身左右对称 ⇒ h 翻不移位是事实，不是漏网）。
            for (const g of SIGN_GLYPHS) {
                const one = expectedCenters(g.char, MENU_TITLE_Y, n, SIGN_BEAD_PITCH, flip);
                const straight = expectedCenters(g.char, MENU_TITLE_Y, n, SIGN_BEAD_PITCH);
                const moved = one.length !== straight.length || one.some((v, i) => v !== straight[i]);
                expect(moved, `「${g.char}」在 ${flip} 翻下是否移位`).toBe(!selfSymmetric(g.rows, n, flip));
            }
            // 每个反位至少有一枚字模移位 ⇒ 「整串能拒反位」不是靠巧合。
            expect(SIGN_GLYPHS.some((g) => !selfSymmetric(g.rows, n, flip)), `${flip} 翻可被拒`).toBe(true);
        }
    });

    it('y 向单调：位表顶行（r00）珠心 y > 底行（r09）珠心 y（原点左下、y 向上）', () => {
        const circles = actualCenters(paintSign().circles).map((s) => Number(s.split('|')[1]));
        const topRowY = MENU_TITLE_Y + (SIGN_MATRIX_N * SIGN_BEAD_PITCH) / 2 - 0.5 * SIGN_BEAD_PITCH;
        const bottomRowY = MENU_TITLE_Y - (SIGN_MATRIX_N * SIGN_BEAD_PITCH) / 2 + 0.5 * SIGN_BEAD_PITCH;
        expect(Math.max(...circles)).toBe(topRowY);
        expect(Math.min(...circles)).toBe(bottomRowY);
        expect(topRowY).toBeGreaterThan(bottomRowY);
    });
});

describe('[T-2B] 招牌几何（`MENU_TITLE_Y` = 外接框中心；主理人裁定）', () => {
    it('外接框中心 = MENU_TITLE_Y，高 = n·d，顶/底沿关于中心对称 ⇒ 非 baseline 语义', () => {
        const bands = signBands(APP.length, MENU_TITLE_Y);
        expect((bands.yMin + bands.yMax) / 2).toBe(MENU_TITLE_Y);
        expect(bands.h).toBe(SIGN_MATRIX_N * SIGN_BEAD_PITCH);
        const centers = paintSign().circles;
        expect(Math.max(...centers.map((c) => c.y)) < bands.yMax).toBe(true);
        expect(Math.min(...centers.map((c) => c.y)) > bands.yMin).toBe(true);
    });

    it('总宽 = `SIGN_WIDTH_COEF · n · d`（4 枚字槽 + 3 个半字宽间隙），且 ≡ tuning 常量、≤ 页面可用宽', () => {
        const bands = signBands(APP.length, MENU_TITLE_Y);
        const manual =
            APP.length * SIGN_MATRIX_N * SIGN_BEAD_PITCH +
            (APP.length - 1) * SIGN_MATRIX_N * SIGN_BEAD_PITCH * SIGN_GLYPH_GAP_RATIO;
        expect(bands.w).toBe(manual);
        expect(SIGN_TOTAL_W).toBe(SIGN_WIDTH_COEF * SIGN_MATRIX_N * SIGN_BEAD_PITCH);
        expect(bands.w).toBe(SIGN_TOTAL_W); // 字数 ≡ SIGN_GLYPH_COUNT ⇒ 无第二份宽公式
        expect(SIGN_TOTAL_W).toBeLessThanOrEqual(DESIGN_W);
        expect(bands.x).toBe((DESIGN_W - SIGN_TOTAL_W) / 2);
        expect(bands.x).toBeGreaterThan(0);
        // 水平居中 ⇒ 首/末珠心关于 DESIGN_W/2 对称。
        const xs = paintSign().circles.map((c) => c.x);
        expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(DESIGN_W / 2, 6);
    });

    it('四枚字槽等差 = n·d·(1 + SIGN_GLYPH_GAP_RATIO)，逐字珠数与位表一致', () => {
        const circles = paintSign().circles;
        const step = SIGN_MATRIX_N * SIGN_BEAD_PITCH * (1 + SIGN_GLYPH_GAP_RATIO);
        const left0 = signBands(APP.length, MENU_TITLE_Y).x;
        for (let i = 0; i < SIGN_GLYPHS.length; i++) {
            const g = SIGN_GLYPHS[i]!;
            const inBand = circles.filter((c) => c.x >= left0 + i * step - 1e-6 && c.x < left0 + i * step + SIGN_MATRIX_N * SIGN_BEAD_PITCH - 1e-6);
            // 每枚字模恰 2×beads 枚同心圆 ⇒ 该槽有珠（不退场、不重叠）。
            expect(inBand.length / 2, `第 ${i} 枚「${g.char}」珠数`).toBe(g.beads);
        }
    });
});

describe('[T-2B] 珠体通道与口径 B（S0 约束①③④）', () => {
    it('每颗珠恒 7 命令（1 rect + 4 polygon + 2 circle），且系数 ≡ BEAD_STYLE_MAX_COMMANDS', () => {
        const { beads, circles, rects, polys, flow } = paintSign();
        expect(beads, '渲染实测珠数 ≡ 位表自算珠数').toBe(signGlyphBeadsOf(APP));
        expect(circles.length).toBe(beads * 2);
        expect(polys.length).toBe(beads * 4);
        expect(rects.length).toBe(beads);
        expect(flow.length).toBe(beads * BEAD_STYLE_MAX_COMMANDS); // 整帧只有珠 ⇒ 系数 7 是实测而非声明
    });

    it('逐字节 ≡ 直接调 `drawFilledBead`（size = d − BEAD_GAP，targetColorIdx 触发等比内缩）的参照流', () => {
        // 同一条通道、同样入参 ⇒ 「招牌没造第二套 UI 简化珠」是机械事实，不是注释。
        const outer = SIGN_BEAD_PITCH - BEAD_GAP;
        const ref = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        ref.begin();
        // 不排序 ⇒ 与 `drawBeadText` 的发射序（字 / 行 / 列）逐行对齐，流级 diff 才有意义。
        for (const key of expectedCenters(APP, MENU_TITLE_Y, SIGN_MATRIX_N, SIGN_BEAD_PITCH, 'none', false)) {
            const [x, y] = key.split('|')!;
            const opts: FilledBeadOptions = {
                size: outer,
                inks: DEMO_BEAD_INKS,
                targetColorIdx: SIGN_INK_COLOR_IDX,
            };
            drawFilledBead(ref, Number(x), Number(y), SIGN_INK_COLOR_IDX, opts);
        }
        const refFlow = ref.end().commands.map((c) => JSON.stringify(c));
        expect(paintSign().flow).toEqual(refFlow);
        // 口径 B 真几何面 = (d − GAP) × 26/30 ⇒ 过地板（`SIGN_FACE_FLOOR`），与 d=12 推荐档同值。
        expect(signFaceB(SIGN_BEAD_PITCH)).toBeGreaterThanOrEqual(SIGN_FACE_FLOOR);
    });

    it('招牌零新 hex：发射色集 ≡ 同一珠体通道在该墨下的可发射色集（⛔ 不列第二份色表）', () => {
        // 色源只准来自「既通道的产物」（K-042）：用同一 `drawFilledBead` 通道跑一颗参照珠取集，
        // ⇒ 全量菜单帧的值域门（DEFAULT_PALETTE 并集）住在 `meta-menu-wall.test.ts`，本腿只钉「没多余色」。
        const { circles, rects, polys } = paintSign();
        const collect = (cmds: readonly DrawCommand[]): string[] => {
            const out: string[] = [];
            for (const c of cmds) {
                const fill = (c as { fill?: string }).fill;
                const stroke = (c as { stroke?: string }).stroke;
                if (typeof fill === 'string') out.push(fill);
                if (typeof stroke === 'string') out.push(stroke);
            }
            return [...new Set(out)].sort();
        };
        const ref = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        ref.begin();
        drawFilledBead(ref, 100, 100, SIGN_INK_COLOR_IDX, {
            size: SIGN_BEAD_PITCH - BEAD_GAP,
            inks: DEMO_BEAD_INKS,
            targetColorIdx: SIGN_INK_COLOR_IDX,
        });
        const allowed = collect(ref.end().commands);
        expect(collect([...circles, ...rects, ...polys])).toEqual(allowed);
    });

    it('墨索引为确定性派生（SIGN_INK_IDX=0 ⇒ 走 T-1 §1.7 relativeLuminance 通道），且在色表值域内', () => {
        expect(SIGN_INK_COLOR_IDX).toBeGreaterThanOrEqual(1);
        expect(SIGN_INK_COLOR_IDX).toBeLessThanOrEqual(DEMO_BEAD_INKS.hexes.length);
    });
});

describe('[T-2B] 缺失字模的降级臂（⛔ 不猜字形、⛔ 不同屏两份标题）', () => {
    it('未知字符 ⇒ 跳过该字但**保留字槽**（版面不移位）；全未知 ⇒ 返回 0 让调用方回落文字', () => {
        const known = paintSign(APP);
        const damaged = `${APP.slice(0, 2)}？${APP.slice(3)}`; // 「小」位置换成无字模的码点
        const withUnknown = paintSign(damaged);
        expect(withUnknown.beads).toBe(known.beads - signGlyphOf(APP.codePointAt(2)!)!.beads);
        // 按字槽分箱：前三槽位置全等（未塌、未左移），缺字槽无珠，末槽照旧在该位置。
        const step = SIGN_MATRIX_N * SIGN_BEAD_PITCH * (1 + SIGN_GLYPH_GAP_RATIO);
        const bandOf = (t: string, i: number): number[] => {
            const left0 = signBands(t.length, MENU_TITLE_Y).x;
            return [...new Set(
                paintSign(t).circles
                    .filter((c) => c.x >= left0 + i * step - 1e-6 && c.x < left0 + i * step + SIGN_MATRIX_N * SIGN_BEAD_PITCH - 1e-6)
                    .map((c) => c.x),
            )].sort((a, b) => a - b);
        };
        for (const i of [0, 1, 3]) expect(bandOf(damaged, i), `第 ${i} 槽`).toEqual(bandOf(APP, i));
        expect(bandOf(damaged, 2), '缺字模的那一槽应无珠').toEqual([]);
        expect(bandOf(APP, 2).length, '正常那一槽应有珠（反证：上一行不是空集对空集）').toBeGreaterThan(0);
        expect(paintSign('？？？？').beads).toBe(0); // ⇒ meta-view 走 FONT_TITLE 回落臂（互斥腿）
    });

    it('档不符（位表 n ≠ 传入 n）⇒ 整串不画 + 一次性告警（不静默半画）', () => {
        const warns: string[] = [];
        const original = console.warn;
        console.warn = (...args: unknown[]) => { warns.push(args.join(' ')); };
        try {
            expect(drawBeadText(new RenderModelBuilder(DESIGN_W, DESIGN_H), APP, MENU_TITLE_Y, 8, SIGN_BEAD_PITCH)).toBe(0);
        } finally {
            console.warn = original;
        }
        expect(warns.length).toBe(1); // 一次性门：⛔ 每帧刷屏
        expect(warns[0]).toContain('sign-glyphs.ts');
    });

    it('`signTierReady()` 自审：现档过；档被改而位表未跟上 ⇒ 先红在这里', () => {
        expect(signTierReady()).toBe(true);
        expect(signTierReady(8, SIGN_PITCH_MAX)).toBe(false); // 回落档：位表未入册（T-1 §3.8 序 5 需 art 回单）
        expect(signFaceB(SIGN_PITCH_MIN_B)).toBeLessThan(signFaceB(SIGN_PITCH_MAX));
        expect(signFaceB(SIGN_BEAD_PITCH)).toBeLessThan(signFaceB(SIGN_PITCH_MAX));
    });
});
