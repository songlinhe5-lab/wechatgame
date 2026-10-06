/**
 * `[WXG-T-226 EP12-S2 / ADR-0029 DEC-2 · DEC-5]` tint 臂：双臂分流 / 白名单回退 / 绿线锚。
 *
 * ## 本文件的判据性质
 *
 * 全部是**机检不变式**（V-4 命令流 / V-5 矢量臂逐字节不变 / 白名单显式性 / DEC-2 孔底），
 * ⛔ **不是新发设计硬判据**（EP-12 §8 验收口径：零新发硬判据）。
 * ⛔ 不改、不放宽任何现役 QA 判据与 fixture（K-051 / K-053）。
 */
import { describe, expect, it, afterEach } from 'vitest';
import { RenderModelBuilder, MASK_CANONICAL_SIZE, tintFxBase, type BlitCommand } from '@wxgame/framework';

import {
    drawEmptySocket,
    drawFilledBead,
    drawTargetTile,
    setBeadBakeRuntime,
    setBeadTintRuntime,
    getBeadTintRuntime,
    createWhitelistBeadTintRuntime,
    type BeadTintRuntime,
} from '../src/view/bead-render.js';
import { tintMaskId, tintUpscaleAllowed, whitelistedTintStyles, TINT_MASK_STYLE_ID, resolveTintGauge, requiredTintMaskIds, tintTileMaskId } from '../src/view/bead-tint-mask.js';
import { BEAD_CARD, BEAD_CELL, BEAD_DRAW_INSET, BEAD_PITCH, BAKE_CANONICAL_SIZE, SOCKET_CARD, TILE_BLEED, TINT_LOD_MAX_UPSCALE, TRAY_SLOT } from '../src/config/tuning.js';
import { beadColorOf, DEFAULT_PALETTE, DEMO_BEAD_INKS, type BeadsPalette } from '../src/view/palette.js';

/** 记录调用的 tint 运行时桩（白名单可开关）。 */
function stubTintRuntime(opts: { hit: boolean } = { hit: true }): {
    runtime: BeadTintRuntime;
    calls: Array<{ kind: string; gauge: string; styleId: string }>;
} {
    const calls: Array<{ kind: string; gauge: string; styleId: string }> = [];
    const runtime: BeadTintRuntime = {
        getMaskId(kind, gauge, styleId) {
            calls.push({ kind, gauge, styleId });
            return opts.hit ? `tex:${kind}:${gauge}:${styleId}` : undefined;
        },
    };
    return { runtime, calls };
}

const palette = DEFAULT_PALETTE as BeadsPalette;

function build(fn: (b: RenderModelBuilder) => void) {
    const b = new RenderModelBuilder(1000, 1000);
    b.begin();
    fn(b);
    return b.end();
}

afterEach(() => {
    setBeadTintRuntime(undefined);
    setBeadBakeRuntime(undefined);
});

// ── [WXG-T-236 八轮] `drawEmptySocket` 的 tint 臂**命中条件守卫** ──────────────────
//
// ## 为什么要有这组腿（这正是 bug 能活到今天的原因）
// `drawEmptySocket` 的 tint 臂命中条件里有一条 **`options.maskGauge !== undefined`**。
// view-model 调有珠格时**漏传 `options`** ⇒ 条件不成立 ⇒ **静默回退矢量臂**（⛔ 不报错、不抛异常、
// 白名单照样命中不了、命令流只是「多了 4 条 rect」）⇒ **没有任何既有断言发现**。
// 实测后果：坑底取 `endpoints.pit`（mix(base,−0.44) = 0.56×base）而**非** `grid-hole-tint-128-mask.png`
// 的 **0.698**（规格判据 I-5/I-6 要求 0.70）⇒ ① 珠孔内露出 0.56 而非 B0 的 0.70
// ⇒ ② 空格走 mask、有珠格走矢量 ⇒ **「有珠 / 无珠的格底不是一张图」**。
//
// ## 三条腿
//  ① 传 `maskGauge` ⇒ **必**调 `getMaskId('cell', gauge, styleId)` 且命令流只有 1 条 blit；
//  ② ⛔ 漏传 `maskGauge` ⇒ **不**调 `getMaskId`（把「静默回退」这件事本身钉成显式判据，
//     将来若有人删掉该守卫条件，本腿会红）；③ `styleId` **同源**（与 `drawFilledBead` 一致）。
describe('drawEmptySocket · tint 臂命中条件（八轮：maskGauge 漏传 = 静默回退）', () => {
    it('① 传 maskGauge + styleId ⇒ 命中 cell mask，且只发 1 条 blit（⛔ 无矢量内阴影 rect）', () => {
        for (const gauge of ['holed', 'holeless'] as const) {
            const { runtime, calls } = stubTintRuntime();
            setBeadTintRuntime(runtime);
            const cmds = build((b) =>
                drawEmptySocket(b, 100, 100, palette, BEAD_CELL, 1, DEMO_BEAD_INKS, true, 2,
                    { maskGauge: gauge, styleId: TINT_MASK_STYLE_ID }),
            ).commands;
            expect(calls, `gauge=${gauge} 未调 getMaskId ⇒ tint 臂没命中`).toEqual([
                { kind: 'cell', gauge, styleId: TINT_MASK_STYLE_ID },
            ]);
            expect(cmds.filter((c) => c.kind === 'blit').length, '应恰好 1 条 blit').toBe(1);
            expect(cmds.filter((c) => c.kind === 'rect').length, '⛔ 命中 tint 臂后不得再发矢量内阴影 rect').toBe(0);
        }
    });

    it('② ⛔ 漏传 maskGauge ⇒ 不调 getMaskId（把「静默回退」钉成显式判据）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        build((b) => drawEmptySocket(b, 100, 100, palette, BEAD_CELL, 1, DEMO_BEAD_INKS, true, 2));
        // 这条断言是本组的**核心**：它让「漏传 ⇒ 悄悄走矢量」这件事变成**机检可见**，
        // 而不是一个只有肉眼能发现的观感问题。
        expect(calls, '漏传 maskGauge ⇒ tint 臂必然不命中（此为已知回退，view-model 侧不得漏传）').toEqual([]);
    });

    it('③ styleId 由调用方给 ⇒ 不传时回落到 DEFAULT（非默认风格 ⇒ 与珠不同源，须由 view-model 显式传）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        build((b) =>
            drawEmptySocket(b, 100, 100, palette, BEAD_CELL, 1, DEMO_BEAD_INKS, true, 2,
                { maskGauge: 'holed' }),
        );
        // 不传 styleId ⇒ 落 `DEFAULT_BEAD_STYLE_ID`；⛔ 这与「珠用 snap.beadStyle」在换风格时不同源
        // （view-model 已显式补传，本腿守住函数层的缺省行为不被人悄悄改掉）。
        expect(calls[0]?.styleId).toBe(TINT_MASK_STYLE_ID);
    });
});

// ── [WXG-T-237 v4.0 · S5′-4 恢复] `trayZone` 的**方向守卫** ────────────────────
//
// 沿革（留档，别再翻烧饼）：
// · **v4.0**：`trayZone === true` **放宽** `colorIdx` ⇒ 托盘空槽（无 per-cell 目标色）也能进 tint 臂。
// · **S5′-3 后置批**：在 Cocos 构建产物里实测否掉了它——blit 载体只有一层 sprite、整层压在
//   `Graphics` 之下，而托盘白瓷面板底在 `Graphics` 里 ⇒ 探针 `cell(6,0) n=24` 确实发了 blit
//   却被自家面板盖掉（用户报「托盘只剩两排灰色月牙」= 珠的接触影）⇒ 当时把托盘收回矢量。
// · **S5′-4（本批）**：面板底 + 白瓷内阴影改打 `back` 图元，Cocos adapter 把它们路由到 blit 之下的
//   `backGraphics` ⇒ 两道排他门已拆，托盘与盘面**同一套图元语言**（换风格时托盘跟随 `beadStyle`）。
//
// 四条腿：① 托盘槽缺 `colorIdx` 但带 trayZone ⇒ **必命中**（放宽在）；② 盘面格缺 `colorIdx`
// 且无 trayZone ⇒ 必不命中（防误用中性色）；③ 盘面格带 `colorIdx` ⇒ 必命中；
// ④ 托盘珠 ⇒ **必命中**（方向与 S5′-3 那批相反：当年它只能留在矢量）。
describe('trayZone 方向守卫（S5′-4：面板底走 back ⇒ 托盘区与盘面同臂）', () => {
    it('① 托盘槽缺 colorIdx + trayZone ⇒ 必命中（1 底 rect + 1 blit；⛔ 槽底透面板回潮即红）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const cmds = build((b) =>
            drawEmptySocket(b, 100, 100, palette, BEAD_CELL, undefined, DEMO_BEAD_INKS, false, BEAD_DRAW_INSET,
                { maskGauge: 'holed', styleId: TINT_MASK_STYLE_ID, trayZone: true }),
        ).commands;
        expect(calls, '⛔ 托盘槽不得再被排他（面板底已在 blit 之下，不会再被盖）').toEqual([
            { kind: 'cell', gauge: 'holed', styleId: TINT_MASK_STYLE_ID },
        ]);
        expect(cmds.filter((c) => c.kind === 'blit').length, '恰好 1 条 blit').toBe(1);
        // [WXG-T-261 三批 · 2026-10-06] 格 mask 内部 shape=0 ⇒ blit 后槽底全透明；托盘无 B0 ⇒
        // 命中臂必须先铺**自带亮底** rect（用户报「槽底没变化，只有边缘在加深」= 本 rect 被 early-return 跳过）。
        // rect 总数钉 1 ⇒ 矢量内阴影 ramp（shadeOuter/…/pit）仍不得回潮。
        const rects = cmds.filter((c) => c.kind === 'rect');
        expect(rects.length, '托盘槽命中 tint ⇒ 须补 1 条自带底 rect（⛔ 底透面板）').toBe(1);
        expect((rects[0] as { fill?: string }).fill, '底墨须 = traySlot（二批深灰 #4A5060）').toBe(palette.traySlot);
        // [WXG-T-261 四批 · 用户裁「托盘槽轮廓外不要有颜色」] 底边须走环带中线（非全格径）。
        const baseRect = rects[0] as { w: number; radius: number };
        expect(baseRect.w, '⛔ 四批「轮廓外零色」回潮（全格径底边 = 环外色带）').toBe(BEAD_CELL * (1 - 2 * SOCKET_CARD.tintBaseInset));
        expect(baseRect.radius, '底 rect 圆角须与环带中线同心（27.5/128 制）').toBe(BEAD_CELL * SOCKET_CARD.tintBaseRadius);
        expect(cmds.filter((c) => c.kind === 'line').length, '⛔ 命中 tint 臂后不得再发矢量内阴影线').toBe(0);
    });

    it('② ⛔ 盘面格缺 colorIdx 且无 trayZone ⇒ 必不命中（防误用中性色渲染盘面槽）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        // 与 ① 唯一的差别 = **不传 trayZone**（模拟「有人忘了传」或「盘面格误走此路径」）
        build((b) =>
            drawEmptySocket(b, 100, 100, palette, BEAD_CELL, undefined, DEMO_BEAD_INKS, false, BEAD_DRAW_INSET,
                { maskGauge: 'holed', styleId: TINT_MASK_STYLE_ID }),
        );
        expect(calls, '⛔ 缺 trayZone ⇒ 必不命中（否则盘面槽会被中性色误渲染）').toEqual([]);
    });

    it('③ 盘面格带 colorIdx 且无 trayZone ⇒ 必命中（收回放宽不许顺手关掉盘面）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const cmds = build((b) =>
            drawEmptySocket(b, 100, 100, palette, BEAD_CELL, 1, DEMO_BEAD_INKS, false, BEAD_DRAW_INSET,
                { maskGauge: 'holed', styleId: TINT_MASK_STYLE_ID }),
        ).commands;
        expect(calls).toEqual([{ kind: 'cell', gauge: 'holed', styleId: TINT_MASK_STYLE_ID }]);
        expect(cmds.filter((c) => c.kind === 'blit').length, '恰好 1 条 blit').toBe(1);
    });

    it('④ 托盘珠（无目标色以外的普通传参）⇒ 必命中 blit', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const cmds = build((b) =>
            drawFilledBead(b, 100, 100, 1, {
                maskGauge: 'holed', styleId: TINT_MASK_STYLE_ID, inks: DEMO_BEAD_INKS,
            }),
        ).commands;
        expect(calls, '⛔ 托盘珠必须问 mask（与盘面同臂）').toEqual([
            { kind: 'bead', gauge: 'holed', styleId: TINT_MASK_STYLE_ID },
        ]);
        expect(cmds.filter((c) => c.kind === 'blit').length, '恰好 1 条 blit').toBe(1);
        expect(cmds.filter((c) => c.kind === 'polygon').length, '⛔ 命中后不得再发矢量扇面层').toBe(0);
    });
});

// ── [用户 2026-10-05 裁定「格底回中性 ⇒ 珠自补 live 孔」→ **2026-10-06 二批推翻补孔口径**] ──
//
// 沿革（留档，别再翻烧饼）：一张格面 tile 只有一个基色 ⇒ 一版合解 = 珠自己补 live 孔
//   （`liveHole`），修的是「格底近白 ⇒ 真透透出近白」。二批槽底加深为 `traySlot` 深灰后
//   前提消失 ⇒ **补孔撤除（`liveHole` 参随删）**，托盘孔与盘面珠同构 = mask 真透、透出下层槽底。
// 本腿钉现口径：托盘珠 tint 臂 ⇒ 1 blit + **零 circle**（补孔回潮即红）。
// ⛔ 不另写盘面珠对照腿：同文件「双臂分流 · DEC-2」那条已锁盘面珠 1 blit 零 circle（YAGNI）。
describe('托盘珠孔真透（WXG-T-261 二批撤 liveHole ⇒ 透出槽底）', () => {
    it('tint 臂命中 ⇒ 1 blit + 0 circle（⛔ 不得再补孔盖住槽底）', () => {
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => drawFilledBead(b, 100, 100, 2, {
            size: TRAY_SLOT, targetColorIdx: 2, drawInset: BEAD_DRAW_INSET,
            maskGauge: 'holed', styleId: TINT_MASK_STYLE_ID, inks: DEMO_BEAD_INKS,
        }));
        expect(model.commands.filter((c) => c.kind === 'blit')).toHaveLength(1);
        expect(model.commands.filter((c) => c.kind === 'circle'),
            '⛔ live 补孔回潮 = 又盖住槽底（二批病灶反向）').toHaveLength(0);
    });
});

describe('白名单（DEC-5 · 显式化）', () => {
    it('当前只有 facet-4 在白名单里', () => {
        expect(whitelistedTintStyles()).toEqual([TINT_MASK_STYLE_ID]);
    });

    it('maskId = 白名单(kind, gauge, styleId)，带 MASK_SCHEMA_VERSION', () => {
        expect(tintMaskId('bead', 'holed', 'facet-4')).toBe('mask__bead__holed__v1');
        // `[WXG-T-255]` 档位宏现役 = `null`（Bundle 落地后四张齐进产物）⇒ **按档位取**，两档不同源。
        expect(tintMaskId('cell', 'holeless', 'facet-4')).toBe('mask__grid__holeless__v1');
    });

    it('档位宏（WXG-T-255）：null ⇒ 按档位取；钉住 ⇒ 两档同源（表本体未改）', () => {
        expect(resolveTintGauge('holeless')).toBe('holeless');
        expect(resolveTintGauge('holeless', 'holed')).toBe('holed');
        expect(resolveTintGauge('holed', 'holeless')).toBe('holeless');
        expect(tintTileMaskId('holeless', TINT_MASK_STYLE_ID)).toBe('mask__grid__holeless__v1__tile');
        expect(tintTileMaskId('holeless', 'lineart-18')).toBeUndefined();
    });

    it('需求集 = 宏实际要的那几张（宿主装载 / warmup 阈值唯一真源）', () => {
        // 在册 `null` ⇒ 四张全要（门禁 `check:cocos-mask` 据同口径验 4/4）。
        expect(requiredTintMaskIds()).toEqual([
            'mask__bead__holed__v1',
            'mask__grid__holed__v1',
            'mask__bead__holeless__v1',
            'mask__grid__holeless__v1',
        ]);
        expect(requiredTintMaskIds('holed')).toEqual([
            'mask__bead__holed__v1',
            'mask__grid__holed__v1',
        ]);
    });

    it('⛔ 未定稿风格一律 undefined（不得给未定稿风格偷烘 mask）', () => {
        for (const style of ['lineart-18', 'legacy-ten', 'thirteen', '', 'FACET-4']) {
            expect(tintMaskId('bead', 'holed', style)).toBeUndefined();
        }
    });

    it('createWhitelistBeadTintRuntime：白名单未命中 或 未注册 ⇒ undefined（矢量回退）', () => {
        const all = createWhitelistBeadTintRuntime(() => 'tex:x');
        expect(all.getMaskId('bead', 'holed', 'facet-4')).toBe('tex:x');
        expect(all.getMaskId('bead', 'holed', 'lineart-18')).toBeUndefined();

        const none = createWhitelistBeadTintRuntime(() => undefined);
        expect(none.getMaskId('bead', 'holed', 'facet-4')).toBeUndefined();
    });
});

describe('双臂分流（V-4 命令流 / DEC-2 孔底）', () => {
    it('tint 臂命中 ⇒ 已填格 = 1 条 blit，⛔ 无 live pit circle（孔区真透）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(calls).toEqual([{ kind: 'bead', gauge: 'holed', styleId: TINT_MASK_STYLE_ID }]);
        // DEC-2：孔底不再画 live `pit` circle ⇒ 只有 1 条命令（blit）。
        expect(model.commands).toHaveLength(1);
        const cmd = model.commands[0] as BlitCommand;
        expect(cmd.kind).toBe('blit');
        expect(cmd.textureId).toBe('tex:bead:holed:facet-4');
        expect(tintFxBase(cmd.fx)).toBeDefined();
        expect(cmd.w).toBe(BEAD_CELL);
        // ⛔ 孔边线环也不画（孔由 mask B 通道自带 + 0.5dp 羽化）
        expect(model.commands.filter((c) => c.kind === 'circle')).toHaveLength(0);
    });

    it('tint 基色 = 珠的**本色**（⛔ 不是 edge/pit/lit 派生色）', () => {
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            // ⚠ `colorIdx` = 珠色；此处与 `targetColorIdx` 同值（已匹配态）。
            // ⛔ 旧版本条传 `colorIdx:1 / targetColorIdx:2` 并期望**目标色** ⇒ **把 bug 断言进去了**
            // （矢量臂 `facet-4` 用 `colorIdx`）；已由 WXG-T-226 接线批修正 + 另立错位态用例。
            drawFilledBead(b, 100, 100, 2, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        const cmd = model.commands[0] as BlitCommand;
        // ⛔ 不用 `hexes[idx]` 硬编：色板索引是 **1-based**（`beadColorOf` 口径）。
        expect(tintFxBase(cmd.fx)).toBe(beadColorOf(DEMO_BEAD_INKS, 2));
    });

    it('tint 基色取**珠色**（⛔ 不取 targetColorIdx）—— 错位态两臂必须同色', () => {
        // 回归锚（WXG-T-226 接线批）：错位/交换态下 `beadColorIdx !== colorIdx`
        // （`beads-game.ts:2290` 判它为合法态）⇒ 若 tint 取 targetColorIdx，
        // 矢量臂（`facet-4` 用 colorIdx）会渲出**另一种颜色**（实测 ΔE ≈ 52）。
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawFilledBead(b, 100, 100, /* colorIdx */ 3, {
                size: BEAD_CELL, targetColorIdx: 5, maskGauge: 'holed',
            });
        });
        expect(tintFxBase((model.commands[0] as BlitCommand).fx)).toBe(beadColorOf(DEMO_BEAD_INKS, 3));
        // ⛔ 显式反证：不是目标色
        expect(tintFxBase((model.commands[0] as BlitCommand).fx)).not.toBe(beadColorOf(DEMO_BEAD_INKS, 5));
    });

    it('空格（盘面格）tint 臂命中 ⇒ 1 条 blit，⛔ 无 4 内阴影 + 2 明暗线', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawEmptySocket(
                b, 100, 100, palette, BEAD_CELL, 2, DEMO_BEAD_INKS,
                true, // tilePainted = 盘面格
                4, // beadInset > 0 = 盘面格
                { maskGauge: 'holed' },
            );
        });
        expect(calls).toEqual([{ kind: 'cell', gauge: 'holed', styleId: TINT_MASK_STYLE_ID }]);
        expect(model.commands).toHaveLength(1);
        const cmd = model.commands[0] as BlitCommand;
        expect(cmd.textureId).toBe('tex:cell:holed:facet-4');
        expect(tintFxBase(cmd.fx)).toBe(beadColorOf(DEMO_BEAD_INKS, 2));
    });

    it('⛔ 托盘空槽（beadInset = 0）恒矢量（两档不同形，无 mask 可对应 · §3.6）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawEmptySocket(
                b, 100, 100, palette, BEAD_CELL, undefined, DEMO_BEAD_INKS,
                false, 0, { maskGauge: 'holed' },
            );
        });
        expect(calls).toHaveLength(0);
        expect(model.commands.some((c) => c.kind === 'blit')).toBe(false);
    });

    it('白名单未命中 ⇒ 矢量臂（逐字节 = 今日）', () => {
        const { runtime } = stubTintRuntime({ hit: false });
        setBeadTintRuntime(runtime);
        const withMiss = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        setBeadTintRuntime(undefined);
        const baseline = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(JSON.stringify(withMiss.commands)).toBe(JSON.stringify(baseline.commands));
        // 未命中时仍是矢量臂的 6 命令（facet-4 珠面）
        expect(withMiss.commands.length).toBeGreaterThan(1);
    });

    it('⛔ 不传 maskGauge ⇒ tint 臂永不命中（安全默认，矢量臂逐字节不变）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2 });
        });
        expect(calls).toHaveLength(0);
        expect(model.commands.some((c) => c.kind === 'blit')).toBe(false);
    });

    it('`holed` 档 + hideHole ⇒ tint 臂跳过（该档 mask 自带孔，hideHole 的档没有对应形状）', () => {
        const { runtime, calls } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed', hideHole: true });
        });
        expect(calls).toHaveLength(0);
    });

    it('臂序：tint 命中时**不**回落烘焙臂（① 优先于 ②）', () => {
        setBeadTintRuntime(stubTintRuntime().runtime);
        setBeadBakeRuntime({ getTextureId: () => 'bake:tex' });
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(model.commands).toHaveLength(1);
        expect((model.commands[0] as BlitCommand).textureId).toBe('tex:bead:holed:facet-4');
    });
});

describe('绿线锚 V-5 · 矢量臂逐字节不变', () => {
    it('`holeless` 档 + hideHole ⇒ tint 臂**命中**（无孔 mask 就是小豆档形状；WXG-T-226 接线批修正）', () => {
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, {
                size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holeless', hideHole: true,
            });
        });
        // ⛔ 回归锚：`bead-holeless` 定稿 mask 必须有消费者（否则是死资产）
        expect(model.commands.filter((c) => c.kind === 'blit')).toHaveLength(1);
        expect(tintFxBase((model.commands[0] as BlitCommand).fx)).toBeDefined();
    });

    it('未注入 tint 运行时：注入前 / 注入后 / 取消注入 三次输出逐字节相同', () => {
        const draw = (b: RenderModelBuilder) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, inks: DEMO_BEAD_INKS });
        };
        const before = build(draw);
        setBeadTintRuntime(stubTintRuntime().runtime);
        const during = build(draw);
        setBeadTintRuntime(undefined);
        const after = build(draw);
        expect(JSON.stringify(during.commands)).toBe(JSON.stringify(before.commands));
        expect(JSON.stringify(after.commands)).toBe(JSON.stringify(before.commands));
    });

    it('getBeadTintRuntime 默认 undefined（= tint 臂不存在）', () => {
        expect(getBeadTintRuntime()).toBeUndefined();
    });

    it('空格矢量臂同样逐字节不变（tint 运行时在场也不改未命中路径）', () => {
        const draw = (b: RenderModelBuilder) => {
            drawEmptySocket(b, 100, 100, palette, BEAD_CELL, 2, DEMO_BEAD_INKS, true, 4);
        };
        const before = build(draw);
        setBeadTintRuntime(stubTintRuntime().runtime);
        const during = build(draw);
        expect(JSON.stringify(during.commands)).toBe(JSON.stringify(before.commands));
    });

    it('烘焙臂（历史归档臂）blit 命令不含 fx 效果槽（位图成品路线）', () => {
        setBeadBakeRuntime({ getTextureId: () => 'bake:tex' });
        const model = build((b) => drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL }));
        const blit = model.commands[0] as BlitCommand;
        expect(blit.kind).toBe('blit');
        expect(blit.fx).toBeUndefined();
        // `undefined` 字段不落 JSON ⇒ 既有 seal 基准零漂移
        expect(JSON.stringify(model.commands)).not.toContain('"fx"');
    });
});

describe('档位接线（DEC-4 · 本批只落「机制 + 可配阈值」）', () => {
    it('mask 档位与烘焙基准尺寸同源（128 = 定稿 py 的 OUT）', () => {
        // 跨包钉住：若有人改 BAKE_CANONICAL_SIZE 而没同步 MASK_CANONICAL_SIZE，此用例红。
        expect(BAKE_CANONICAL_SIZE).toBe(MASK_CANONICAL_SIZE);
    });

    it('孔径仍取 BEAD_CARD（矢量臂口径，tint 臂不改 §3 冻结量）', () => {
        const holeR = Math.round((BEAD_CELL * BEAD_CARD.holeRatio) / 2);
        const model = build((b) => drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL }));
        expect(model.commands.some((c) => c.kind === 'circle')).toBe(true);
        expect(holeR).toBeGreaterThan(0);
        expect(BEAD_PITCH).toBeGreaterThan(BEAD_CELL);
    });
});

/**
 * `[WXG-T-226 EP12-B4 / ADR-0029 DEC-4]` zoom LOD 回退阀：阈值判据 + 臂序落点。
 *
 * 纪律：阈值 `null`（`[待真机]` 不落数值）⇒ **永不回退**；本组只钉机制与臂序，
 * ⛔ 不钉任何具体阈值数值（K-051：纸面推论须实测复算）。
 */
describe('EP12-B4 · 放大回退阀（DEC-4）', () => {
    it('阈值位存在但为 null（[待真机] ⇒ 不落数值）', () => {
        expect(TINT_LOD_MAX_UPSCALE).toBeNull();
    });

    it('null 阈值 ⇒ 永不回退（任意放大倍数都放行）', () => {
        expect(tintUpscaleAllowed(128)).toBe(true);
        expect(tintUpscaleAllowed(100_000)).toBe(true);
        // 缺省参数走同一个冻结常量
        expect(tintUpscaleAllowed(100_000)).toBe(tintUpscaleAllowed(100_000, TINT_LOD_MAX_UPSCALE));
    });

    it('给定阈值时按 `mask 设备像素 ≤ MASK_CANONICAL_SIZE × 阈值` 判定（1.0 = 不许放大）', () => {
        expect(tintUpscaleAllowed(128, 1.0)).toBe(true);
        expect(tintUpscaleAllowed(129, 1.0)).toBe(false);
        expect(tintUpscaleAllowed(64, 1.0)).toBe(true);
    });

    it('实测口径：dpr=2 全区间安全（zoom 2.0 ⇒ 120px = 0.94×），dpr=3 高倍才放大', () => {
        // 阈值 1.0（仅作判据算例，⛔ 非冻结值）下核对本仓真源常量
        expect(tintUpscaleAllowed(BEAD_CELL * 2.0 * 2, 1.0)).toBe(true); // 120 ≤ 128
        expect(tintUpscaleAllowed(BEAD_CELL * 2.0 * 3, 1.0)).toBe(false); // 180 > 128
        expect(MASK_CANONICAL_SIZE).toBe(BAKE_CANONICAL_SIZE); // 两套号同值（T-226 S1 已核）
    });

    it('⛔ 未实现 allowTint ⇒ tint 臂照常命中（V-5：默认阀闭合 = 今日行为）', () => {
        const { runtime } = stubTintRuntime();
        expect(runtime.allowTint).toBeUndefined();
        setBeadTintRuntime(runtime);
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(model.commands).toHaveLength(1);
        expect((model.commands[0] as BlitCommand).kind).toBe('blit');
    });

    it('allowTint() ⇒ false ⇒ 本帧 tint 臂停用、落矢量臂（⛔ 零 blit）', () => {
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime({ ...runtime, allowTint: () => false });
        const model = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(model.commands.filter((c) => c.kind === 'blit')).toHaveLength(0);
        expect(model.commands.length).toBeGreaterThan(0);
    });

    it('allowTint() ⇒ false 时空格同样落矢量臂（4 内阴影 + 明暗线回来）', () => {
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime({ ...runtime, allowTint: () => false });
        const model = build((b) => {
            drawEmptySocket(
                b, 100, 100, palette, BEAD_CELL, 2, DEMO_BEAD_INKS,
                true, 4, { maskGauge: 'holed' },
            );
        });
        expect(model.commands.filter((c) => c.kind === 'blit')).toHaveLength(0);
    });

    it('V-5 绿线锚：阀开与阀关两条矢量臂输出逐字节相同', () => {
        const { runtime } = stubTintRuntime({ hit: false });
        // 白名单未命中 ⇒ 两条路径都走矢量臂，本就同形；这里钉「关阀」不改变矢量输出
        setBeadTintRuntime({ ...runtime, allowTint: () => true });
        const open = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        setBeadTintRuntime({ ...runtime, allowTint: () => false });
        const closed = build((b) => {
            drawFilledBead(b, 100, 100, 1, { size: BEAD_CELL, targetColorIdx: 2, maskGauge: 'holed' });
        });
        expect(JSON.stringify(open.commands)).toBe(JSON.stringify(closed.commands));
    });
});

// ── [WXG-T-254 / ADR-0030 S5′-2] `drawTargetTile` 的底 tile 臂 ──────────────────
//
// 合并的**几何口径**是本单的全部风险所在（用户裁定：画布 = 格距 + 出血 = 33dp，
// 内容仍是格径 30dp，⛔ 不跟着画布放大）。腿 ① 把 blit 的边长与纹理 id 钉死；
// 腿 ②③ 钉住「宿主没实现 / 白名单未命中 ⇒ 逐字节 = 今日那条 rect」（V-5 绿线锚同款）。
describe('drawTargetTile · 底 tile 臂（WXG-T-254）', () => {
    const tileRuntime = (hit: boolean): BeadTintRuntime => ({
        getMaskId: () => undefined,
        getTileMaskId: (gauge) => (hit ? `mask__grid__${gauge}__v1__tile` : undefined),
    });

    it('① 命中 ⇒ 1 条 blit（边长 = 格距 + 2×出血 = 33dp、0 条 rect）且返回 true', () => {
        setBeadTintRuntime(tileRuntime(true));
        for (const gauge of ['holed', 'holeless'] as const) {
            let merged: boolean | undefined;
            const cmds = build((b) => {
                merged = drawTargetTile(b, 100, 100, 1, DEMO_BEAD_INKS, BEAD_PITCH,
                    { maskGauge: gauge, styleId: TINT_MASK_STYLE_ID });
            }).commands;
            expect(merged, `gauge=${gauge} 未合并`).toBe(true);
            expect(cmds.filter((c) => c.kind === 'rect').length, '⛔ 合并后不得再发 B0 rect').toBe(0);
            const blits = cmds.filter((c) => c.kind === 'blit') as BlitCommand[];
            expect(blits.length).toBe(1);
            const c = blits[0]!;
            expect(c.w).toBe(BEAD_PITCH + TILE_BLEED * 2);
            expect(c.h).toBe(c.w);
            expect(c.textureId).toContain('__tile');
            // `fx.base` = 本格目标色本色 ⇒ 与 `drawEmptySocket` 的 tint 臂同源（零新色）。
            expect(tintFxBase(c.fx!)).toBe(beadColorOf(DEMO_BEAD_INKS, 1));
        }
    });

    it('② 宿主未实现 getTileMaskId ⇒ 输出逐字节 = 今日（1 条 rect、返回 false）', () => {
        const { runtime } = stubTintRuntime();
        setBeadTintRuntime(runtime);
        let merged: boolean | undefined;
        const withTile = build((b) => {
            merged = drawTargetTile(b, 100, 100, 1, DEMO_BEAD_INKS, BEAD_PITCH,
                { maskGauge: 'holed', styleId: TINT_MASK_STYLE_ID });
        });
        setBeadTintRuntime(undefined);
        const today = build((b) => drawTargetTile(b, 100, 100, 1, DEMO_BEAD_INKS, BEAD_PITCH));
        expect(merged).toBe(false);
        expect(JSON.stringify(withTile.commands)).toBe(JSON.stringify(today.commands));
    });

    it('③ 白名单未命中（未定稿风格）⇒ 不合并；阀关（allowTint false）⇒ 不合并', () => {
        setBeadTintRuntime(tileRuntime(false));
        const cmds = build((b) =>
            drawTargetTile(b, 100, 100, 1, DEMO_BEAD_INKS, BEAD_PITCH,
                { maskGauge: 'holed', styleId: 'lineart-18' }),
        ).commands;
        expect(cmds.filter((c) => c.kind === 'blit').length).toBe(0);

        setBeadTintRuntime({ ...tileRuntime(true), allowTint: () => false });
        const blocked = build((b) =>
            drawTargetTile(b, 100, 100, 1, DEMO_BEAD_INKS, BEAD_PITCH,
                { maskGauge: 'holed', styleId: TINT_MASK_STYLE_ID }),
        ).commands;
        expect(blocked.filter((c) => c.kind === 'blit').length, '关阀 ⇒ 整体落矢量').toBe(0);
        expect(blocked.filter((c) => c.kind === 'rect').length).toBe(1);
    });

    it('④ 不传 maskGauge（托盘槽 / 未接档）⇒ ⛔ 不调 getTileMaskId、照旧 rect', () => {
        const calls: string[] = [];
        setBeadTintRuntime({
            getMaskId: () => undefined,
            getTileMaskId: (gauge) => { calls.push(gauge); return 'mask__grid__holed__v1__tile'; },
        });
        build((b) => drawTargetTile(b, 100, 100, 1, DEMO_BEAD_INKS, BEAD_PITCH));
        expect(calls, '⛔ 托盘槽恒 30dp 矢量形态（§3.6），不得被 tile 吞掉').toEqual([]);
    });
});

describe('createWhitelistBeadTintRuntime · tile（WXG-T-254）', () => {
    it('可用性按**去后缀的源 id** 问宿主，返回的却是 tile id（注册表零新增条目）', () => {
        const asked: string[] = [];
        const rt = createWhitelistBeadTintRuntime((id) => {
            asked.push(id);
            return id === 'mask__grid__holed__v1' ? 'tex:x' : undefined;
        });
        expect(rt.getTileMaskId!('holed', TINT_MASK_STYLE_ID)).toBe('mask__grid__holed__v1__tile');
        expect(asked).toEqual(['mask__grid__holed__v1']);

        const none = createWhitelistBeadTintRuntime(() => undefined);
        expect(none.getTileMaskId!('holeless', TINT_MASK_STYLE_ID)).toBeUndefined();
        expect(rt.getTileMaskId!('holed', 'lineart-18')).toBeUndefined();
    });
});
