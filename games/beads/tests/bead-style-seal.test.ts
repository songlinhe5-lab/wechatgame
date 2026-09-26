/**
 * **封箱基准常驻判据（WXG-T-211-S3 / EP11-S3 · §12.9 步 3 验收「零视觉自证」）**
 * ─────────────────────────────────────────────────────────────────────────────
 * 正本 = `production/qa/beads/test-cases.md` §K.5.1 ④（`legacy-ten` 对照臂 = 「什么都没变」，
 * SVG/命令流**逐字节等值**，方法 = `ADR-0024` J-5）+ 任务单工作项 4 / 6。
 *
 * 数据源 = `tests/__fixtures__/wxg-t-211-s3-seal.json`（**checked-in 封箱件**）：
 *  - `head.*` = 改码前 HEAD（`d058e5d`）实测基准，由 `git` 回退态重抓（`temp/wxg-t-211-s3/capture.sh head`）；
 *  - `s3.*`   = 转正后实测；
 *  - `fixture.*` = **夹具参数连参数一起登记**（breakout `--frames 180` 判例：不登记参数的基准不可复现）。
 *
 * 本文件**只读不算基准**（⛔ 不写文件、⛔ 不需 env 开关）⇒ 可以进全量 `vitest run`。
 * 四条腿：
 *  1. **什么都没变**：`drawLegacyTenBead` 的 96 例命令流 sha ≡ `head.legacyFlow`；
 *  2. **非孔零变更**：`facet-4` 层集 #1–#5 的 45 例 sha ≡ `head.facetNonHoleLayers`
 *     （⇒ 底衬与四枚刻面的几何/墨水与 S2 内联版逐字节同）；
 *  3. **仅孔变化**：#6 的 45 例 sha **全部 ≠** `head.facetHoleLayer` 且 ≡ `s3.facetHoleLayer`
 *     （双孔→单孔 + 孔底 `base`→目标色 `pit` + 半径 0.17→派生自卡）= 本单唯一被允许的视觉变更源；
 *  4. **基线差分自洽**：整帧 §11.2 同构夹具逐 kind 计数 ≡ golden，且 Δ 全部可归因到 78 颗填格。
 *
 * ⛔ 若任一腿红：先查是否**又有人改了封箱代码**（`facet-4.ts` / `legacy-ten.ts` / `bead-render.ts`
 *   的珠体路径），⛔ 不得反向"更新基准让它绿"（K-051 / K-053）。
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { RenderModelBuilder, polygonVertices, type DrawCommand, type RenderModel } from '@wxgame/framework';
import { DESIGN_H, DESIGN_W, HUD_BAND, PUZZLE_BAND, ZOOM_CTRL_HOT, zoomControlLayout } from '../src/config/tuning.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { type FilledBeadOptions } from '../src/view/bead-render.js';
import { drawLegacyTenBead } from '../src/view/bead-styles/legacy-ten.js';
import { styleById } from '../src/view/bead-styles/registry.js';
import type { BeadStyleInput, BeadStyleLayer } from '../src/view/bead-styles/contract.js';
import { createBeadsHarness, placeColor, simpleTestLevel, type Harness } from './helpers.js';

const SEAL = JSON.parse(
    readFileSync(new URL('__fixtures__/wxg-t-211-s3-seal.json', import.meta.url), 'utf8'),
) as {
    fixture: {
        legacyFx: string[];
        legacyFxParams: Array<{
            label: string;
            colorIdx: number;
            size: number;
            lift: number;
            scale: number;
            lodLayers?: number;
            targetColorIdx?: number;
        }>;
        styleFx: string[];
        styleFxParams: Array<Record<string, number | undefined>>;
        frame: Record<string, unknown>;
    };
    head: SealSide;
    s3: SealSide;
    /** S3 转正时刻登记（史证段，不追改；腿 2b 的锚）。 */
    s3AtFormalization?: SealSide & { _readme?: string };
    provenance: Record<string, string>;
};

interface SealSide {
    legacyFlow?: Record<string, string>;
    facetNonHoleLayers: Record<string, string>;
    facetHoleLayer: Record<string, string>;
    frame0: { sha: string; total: number };
    frame78: { kinds: Record<string, number>; sha: string; total: number };
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

/* ───── 复评登记常量（213 控件/盘带换尺；原稿因共享树 checkout 事故丢失，本套由换肤线
 * 2026-09-26 依会话记录重建并经用户指令接管，归因链 = provenance.s3_frame_recheck{,_2,_3}）───── */

/** 已登记的**非珠体族**插入差：缩放控件条 = 7 条（静息档 `zoomSliderT = 0`，底图另计）。 */
const HUD_ZOOM_CTRL_DELTA: Record<string, number> = { rect: 3, circle: 1, text: 3 };
const HUD_ZOOM_CTRL_TOTAL = 7;
/** 历史档案常量：HEAD 盘带中心 = (480+1120)/2，只作 Δ 基准，非现值。 */
const HEAD_PUZZLE_BAND_MID_Y = 800;
/** 盘带族平移矢量：由**现役** `PUZZLE_BAND` 派生（⛔ 非手填）⇒ 同时校带尺与渲染跟随。 */
const BOARD_BAND_SHIFT_Y = (PUZZLE_BAND.yMin + PUZZLE_BAND.yMax) / 2 - HEAD_PUZZLE_BAND_MID_Y;

const Y_FIELDS = ['y', 'y1', 'y2'] as const;
type Cmd = Record<string, unknown>;

/** 一条命令的全部 y 分量（含 polygon 展平 `points` 的奇数位 = y）。 */
function yFields(c: Cmd): number[] {
    const out: number[] = [];
    for (const k of Y_FIELDS) if (typeof c[k] === 'number') out.push(c[k] as number);
    const pts = c.points;
    if (Array.isArray(pts)) for (let i = 1; i < pts.length; i += 2) out.push(pts[i] as number);
    return out;
}

/** 缩放控件段：全部 y 落在 `zoomControlLayout()` 的 88 热区带内。 */
function inZoomStrip(c: Cmd): boolean {
    const y0 = zoomControlLayout().reset.y;
    const v = yFields(c);
    return v.length > 0 && v.every((y) => y >= y0 && y <= y0 + ZOOM_CTRL_HOT);
}

/** 盘带族：全部 y 落在 `[PUZZLE_BAND.yMin, HUD_BAND.yMin)`。 */
function inPuzzleBand(c: Cmd): boolean {
    const v = yFields(c);
    return v.length > 0 && v.every((y) => y >= PUZZLE_BAND.yMin && y < HUD_BAND.yMin);
}

function shiftY(c: Cmd, dy: number): void {
    for (const k of Y_FIELDS) if (typeof c[k] === 'number') c[k] = (c[k] as number) - dy;
    const pts = c.points;
    if (Array.isArray(pts)) for (let i = 1; i < pts.length; i += 2) pts[i] = (pts[i] as number) - dy;
}

/** 现役空盘整帧流（0 填格）。 */
function emptyBoardFlow(): string[] {
    const empty = createBeadsHarness({
        noAssemble: true,
        levels: [simpleTestLevel({ cols: 13, rows: 12, pattern: Array.from({ length: 12 }, () => '1231231231231') })],
        saveKey: 'wxgame.beads.test.s211-seal-empty-check',
    });
    return serialize(renderModel(empty));
}

/** 反演：drop 控件段 + 盘带族回移 dy ⇒ 应逐字节 ≡ HEAD 空盘锁；逐段计数供登记核对。 */
function reconcileToHead(flow: string[], dy: number) {
    const kept: string[] = [];
    const droppedKinds: Record<string, number> = {};
    const shiftedKinds: Record<string, number> = {};
    let dropped = 0;
    let shifted = 0;
    for (const line of flow) {
        const c = JSON.parse(line) as Cmd;
        if (inZoomStrip(c)) {
            dropped++;
            droppedKinds[c.kind as string] = (droppedKinds[c.kind as string] ?? 0) + 1;
            continue;
        }
        if (inPuzzleBand(c)) {
            shifted++;
            shiftedKinds[c.kind as string] = (shiftedKinds[c.kind as string] ?? 0) + 1;
            shiftY(c, dy);
        }
        kept.push(JSON.stringify(c));
    }
    return { flow: kept, dropped, droppedKinds, shifted, shiftedKinds };
}

/** 与抓取侧**同式**的序列化（polygon 顶点经 `polygonVertices` 解引用 = ADR-0024 值语义读法）。 */
function serialize(model: RenderModel): string[] {
    return model.commands.map((c: DrawCommand) =>
        c.kind === 'polygon'
            ? JSON.stringify({ ...c, points: Array.from(polygonVertices(model, c)) })
            : JSON.stringify(c),
    );
}

/* ───────────────────── 腿 1：96 例单珠矩阵（⛔ 参数只能来自夹具登记） ───────────────────── */

/**
 * 从 seal 文件的 `legacyFxParams` **逐字段直读**还原矩阵。
 * ⛔ 不得用 label 正则反推参数（那是把基准文本当输入，K-051 同族）；
 *    label 与参数的对应关系改由 `labelOf()` 单独自证（见「夹具登记自证」例）。
 * ⚠ `lodLayers` / `targetColorIdx` 为 `undefined` 时 JSON 不落字段 ⇒ 缺字段即真 `undefined`。
 */
function legacyMatrix(): Array<{ label: string; colorIdx: number; opts: FilledBeadOptions }> {
    return SEAL.fixture.legacyFxParams.map((p) => ({
        label: p.label,
        colorIdx: p.colorIdx,
        opts: {
            size: p.size,
            inks: DEMO_BEAD_INKS,
            lift: p.lift,
            scale: p.scale,
            lodLayers: p.lodLayers,
            targetColorIdx: p.targetColorIdx,
        },
    }));
}

/** 抓取侧的 label 拼式（复算 ⇒ 参数与 label 若漂移当场红）。 */
const labelOf = (p: { colorIdx: number; lift: number; scale: number; size: number; lodLayers?: number; targetColorIdx?: number }): string =>
    `ci${p.colorIdx}-t${p.targetColorIdx ?? 'none'}-l${p.lift}-s${p.scale}-lod${p.lodLayers ?? 'full'}-z${p.size}`;

function legacyFlowSeal(draw: (b: RenderModelBuilder, opts: FilledBeadOptions, ci: number) => void) {
    const out: Record<string, string> = {};
    for (const fx of legacyMatrix()) {
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        draw(builder, fx.opts, fx.colorIdx);
        out[fx.label] = sha(serialize(builder.end()).join('\n'));
    }
    return out;
}

/* ───────────────────── 腿 2 / 3：45 例层集矩阵（同样从登记还原） ───────────────────── */

function styleMatrix(): Array<{ label: string; input: BeadStyleInput }> {
    return SEAL.fixture.styleFxParams.map((p) => ({
        label: `ci${p.colorIdx}-t${p.targetColorIdx ?? 'none'}-s${p.size}`,
        input: {
            inks: DEMO_BEAD_INKS,
            colorIdx: p.colorIdx as number,
            targetColorIdx: p.targetColorIdx,
            size: p.size as number,
        },
    }));
}

function layerSeal(): { nonHole: Record<string, string>; hole: Record<string, string> } {
    const style = styleById('facet-4');
    if (!style) throw new Error('facet-4 未注册 ⇒ 无从复算层集基准');
    const nonHole: Record<string, string> = {};
    const hole: Record<string, string> = {};
    for (const fx of styleMatrix()) {
        const layers = style.beadLayers(fx.input);
        // ⚠ 层集是**模块级 scratch** ⇒ 必须先转文本再比 sha（⛔ 存引用，ADR-0024 J-2）。
        nonHole[fx.label] = sha(layers.slice(0, 5).map((l: BeadStyleLayer) => JSON.stringify(l)).join('\n'));
        hole[fx.label] = sha(layers.slice(5).map((l: BeadStyleLayer) => JSON.stringify(l)).join('\n'));
    }
    return { nonHole, hole };
}

/* ───────────────────── 腿 4：§11.2 同构夹具整帧 ───────────────────── */

/** §11.2 原夹具的**同构**重立：13×12、前 6 行填满 = 78 填 / 78 空 / 156 可填。 */
function halfBoardHarness(saveKey: string): { harness: Harness; filled: number } {
    const harness = createBeadsHarness({
        noAssemble: true,
        levels: [
            simpleTestLevel({
                cols: 13,
                rows: 12,
                pattern: Array.from({ length: 12 }, () => '1231231231231'),
            }),
        ],
        saveKey,
    });
    const { game } = harness;
    let filled = 0;
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 13; col++) {
            if (placeColor(game, game.grid.requiredColor(row, col), row, col)) filled++;
        }
    }
    return { harness, filled };
}

function renderModel(harness: Harness): RenderModel {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
    return builder.end();
}

function frameSeal(): SealSide['frame78'] & { fillableTotal: number } {
    const { harness, filled } = halfBoardHarness('wxgame.beads.test.s211-seal-frame-check');
    if (filled !== 78) throw new Error(`夹具同构自证失败：填格 ${filled} ≠ 78`);
    const flow = serialize(renderModel(harness));
    const kinds: Record<string, number> = {};
    for (const line of flow) {
        const kind = (JSON.parse(line) as { kind: string }).kind;
        kinds[kind] = (kinds[kind] ?? 0) + 1;
    }
    return {
        total: flow.length,
        kinds,
        sha: sha(flow.join('\n')),
        fillableTotal: harness.game.grid.fillableTotal,
    };
}

describe('WXG-T-211-S3 封箱基准（§K.5.1 ④ 零视觉自证 + §11.2 差分基线）', () => {
    it('夹具登记自证：矩阵规模与 label 集未漂移（参数变了就必须重抓，⛔ 手改基准）', () => {
        expect(SEAL.fixture.legacyFx).toHaveLength(96);
        expect(SEAL.fixture.legacyFxParams).toHaveLength(96);
        expect(new Set(SEAL.fixture.legacyFx).size).toBe(96); // label 唯一 ⇒ 96 例 sha 归档不互盖
        expect(SEAL.fixture.styleFxParams).toHaveLength(45);
        // 阳性对照（K-060）：矩阵真在按 6 轴变化（3色×目标×lift×scale×lod×基尺 = 96），
        // ⛔ 不得只校 label 唯一（那只是字符串不同）⇒ 参数字段本身必须 96 个不重样。
        expect(
            new Set(
                SEAL.fixture.legacyFxParams.map(
                    (p) => `${p.colorIdx}/${p.targetColorIdx ?? 'none'}/${p.lift}/${p.scale}/${p.lodLayers ?? 'full'}/${p.size}`,
                ),
            ).size,
        ).toBe(96);
        // 参数登记 ↔ label 自洽（直读字段复算抓取侧拼式）：参数漂移 / label 集改动当场红。
        expect(SEAL.fixture.legacyFxParams.map(labelOf)).toEqual(SEAL.fixture.legacyFx);
        expect(SEAL.fixture.styleFxParams.map((p) => `ci${p.colorIdx}-t${p.targetColorIdx ?? 'none'}-s${p.size}`))
            .toEqual(SEAL.fixture.styleFx);
        expect(SEAL.fixture.frame).toMatchObject({ cols: 13, rows: 12, filled: 78, fillableTotal: 156, noAssemble: true });
    });

    it('腿 1 · 什么都没变：`drawLegacyTenBead` 96 例命令流 ≡ HEAD 逐字节', () => {
        const got = legacyFlowSeal((b, opts, ci) => drawLegacyTenBead(b, 100, 200, ci, opts));
        const want = SEAL.head.legacyFlow ?? {};
        expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
        const diff = Object.keys(want).filter((k) => got[k] !== want[k]);
        expect(diff, `命令流不等的例：${diff.slice(0, 5).join(', ')}`).toEqual([]);
        // 阳性对照（K-060）：96 例 sha 互不相同 ⇒ 本判据不是一条恒等的空断言。
        expect(new Set(Object.values(got)).size).toBe(96);
    });

    it('腿 2 · 非孔零变更（第三次复评口径）：现役 `facet-4` #1–#5 ≡ s3 登记（后续批改动须经复评归因才能进比较基）', () => {
        const { nonHole } = layerSeal();
        // 口径史：初版比 `head.*`（= 「S3 转正零越界」的**时点事实**）；c7d157d 等比 inset + WXG-T-214
        // plate 墨值（均用户拍板）合法改动了非孔层 ⇒ 比较基改指 `s3.*`（provenance.s3_frame_recheck_3
        // 全量归因）；时点事实不丢 —— 下条腿 2b 钉史证段。
        const want = SEAL.s3.facetNonHoleLayers;
        expect(Object.keys(nonHole).sort()).toEqual(Object.keys(want).sort());
        for (const k of Object.keys(want)) expect(nonHole[k], `${k} 非孔层集与登记不符（改动未经复评归因）`).toBe(want[k]);
    });

    it('腿 2b · 转正史证（不随复评漂移）：head ≡ s3AtFormalization 非孔 45 例（S3 当时一字未动的时点事实）', () => {
        const hist = SEAL.s3AtFormalization?.facetNonHoleLayers;
        expect(hist, '史证段缺失 ⇒ 不得删').toBeDefined();
        const h = SEAL.head.facetNonHoleLayers;
        expect(Object.keys(hist!).sort()).toEqual(Object.keys(h).sort());
        for (const k of Object.keys(h)) expect(hist![k], `${k} 史证段被追改（K-053）`).toBe(h[k]);
    });

    it('腿 3 · 仅孔变化：#6 共 45 例全 ≠ HEAD 且 ≡ S3 登记值（本单唯一被允许的变更源）', () => {
        const { hole } = layerSeal();
        const before = SEAL.head.facetHoleLayer;
        const after = SEAL.s3.facetHoleLayer;
        const changed = Object.keys(before).filter((k) => hole[k] !== before[k]);
        expect(changed).toHaveLength(45); // ⛔ 有任何一例"孔没变"⇒ 说明甲口径没落全
        for (const k of Object.keys(after)) expect(hole[k], `${k} 孔层与 S3 登记不符`).toBe(after[k]);
    });

    it('腿 4a · 整帧两键 ≡ 第三次复评登记（逐 kind + total + sha），帧长差 = 登记的控件插入段', () => {
        const f = frameSeal();
        expect(f.kinds).toEqual(SEAL.s3.frame78.kinds);
        expect(f.total).toBe(SEAL.s3.frame78.total);
        expect(f.sha).toBe(SEAL.s3.frame78.sha);
        expect(f.fillableTotal).toBe(156);
        const emptyFlow = emptyBoardFlow();
        expect(sha(emptyFlow.join('\n'))).toBe(SEAL.s3.frame0.sha);
        // 非珠体族现口径：帧长差 = 控件条数（平移 = 条数中不变，不得拿它抵充增减）。
        expect(emptyFlow.length - SEAL.head.frame0.total).toBe(HUD_ZOOM_CTRL_TOTAL);
        expect(SEAL.s3.frame0.total - SEAL.head.frame0.total).toBe(HUD_ZOOM_CTRL_TOTAL);
        // 反面自证（K-060）：新锁与 HEAD 旧锁必不等，且不等量已在上面逐项登记。
        expect(SEAL.s3.frame0.sha).not.toBe(SEAL.head.frame0.sha);
        expect(SEAL.s3.frame78.sha).not.toBe(SEAL.head.frame78.sha);
    });

    it('腿 4b · 反演闭合（降级版，⚠ 限制已登记）：控件段身份 + 登记差必须各有 provenance', () => {
        // ⚠ 限制（接管收口时如实登记，provenance.s3_frame_recheck_3 末段）：213 原稿的「逐字节闭合到
        // HEAD 锁」最强形态因 checkout 事故原稿丢失，且 c7d157d（已入库）把 B0 底图/凹槽随格径重推 ⇒
        // 差集不再是「插入 + 纯平移」两类可反演形状。本腿降为**身份核对**（未登记漂移仍由腿 4a 字节锁兑住，
        // 不会静默放行）；最强反演形态待 213 批按新基线重建（TASKS-DETAIL 已登欠账）。⛔ 不得把本腿读作「闭合已证」。
        const r = reconcileToHead(emptyBoardFlow(), BOARD_BAND_SHIFT_Y);
        expect(r.dropped).toBe(HUD_ZOOM_CTRL_TOTAL);
        expect(r.droppedKinds).toEqual(HUD_ZOOM_CTRL_DELTA);
        // 两笔登记差都须有 provenance 归因（⛔ 无登记基准追改视为红）。
        expect(SEAL.provenance.s3_frame_recheck, '控件段无归因登记').toContain('缩放控件');
        expect(SEAL.provenance.s3_frame_recheck_3, '换尺/墨值/底图重推无归因登记').toContain('盘带换尺');
        // 反演后的流仍不得等于任何旧锁（防「把基准刷回 HEAD」的静默通道）。
        expect(sha(r.flow.join('\n'))).not.toBe(SEAL.head.frame0.sha);
        expect(sha(emptyBoardFlow().join('\n'))).toBe(SEAL.s3.frame0.sha);
    });

    it('差分自洽：Δtotal 全部可归因 78 颗填格（孔贡献 vs 刻面 kind 化）+ 控件登记段，非珠体族残余 Δ = 0', () => {
        const h = SEAL.head.frame78.kinds;
        const s = SEAL.s3.frame78.kinds;
        const delta: Record<string, number> = {};
        for (const k of new Set([...Object.keys(h), ...Object.keys(s)])) {
            delta[k] = (s[k] ?? 0) - (h[k] ?? 0);
        }
        // 每颗填格：十层 5 rect + 5 line + 2 circle → 四棱 1 rect + 4 polygon + 1 circle；
        // 另加**登记在案**的控件插入段（rect+3 / circle+1 / text+3）。
        const ctrl = HUD_ZOOM_CTRL_DELTA;
        expect(delta.rect - ctrl.rect).toBe(78 * -4);
        expect(delta.line).toBe(78 * -5);
        expect(delta.circle - ctrl.circle).toBe(78 * -1); // **孔贡献**：双孔 → 单孔
        expect(delta.polygon).toBe(78 * 4); // **刻面 kind 化**
        expect(delta.text - ctrl.text).toBe(0); // 非珠体族除登记段外零变更
        const totalDelta = SEAL.s3.frame78.total - SEAL.head.frame78.total;
        expect(Object.values(delta).reduce((a, b) => a + b, 0)).toBe(totalDelta);
        expect(totalDelta).toBe(78 * (-4 - 5 - 1 + 4) + HUD_ZOOM_CTRL_TOTAL);
        // ⛔ 禁止「纸面推算的新基线整帧数」入册（K-051）：以下均**复评登记实测值**自洽核对。
        expect(SEAL.s3.frame78.total).toBe(1126);
        expect(SEAL.s3AtFormalization!.frame78.total).toBe(1119); // 转正时刻史证（不随复评漂移）
        expect(SEAL.head.frame78.total).toBe(1587); // 旧值仅作历史档案（§K.5.0 作废登记）
    });

    it('HEAD 侧夹具同构自证：HEAD 逐 kind 计数 ≡ 旧 §11.2 基线 1587（K-051 前置）', () => {
        expect(SEAL.head.frame78.total).toBe(1587);
        expect(SEAL.head.frame78.kinds).toEqual({
            rect: 799,
            circle: 159,
            line: 610,
            text: 9,
            polygon: 10,
        });
    });
});
