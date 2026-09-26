/**
 * WXG-T-211-S3 · **封箱基准复取工具**（非测试文件 —— 文件名不带 `.test.ts` 后缀
 * ⇒ 不进 vitest 采集，⛔ 也不给 verify 增加 SKIP 项）
 * ─────────────────────────────────────────────────────────────────────────────
 * 用途 = 抓「改码前 HEAD」与「改后 S3」两侧的**封箱基准**（seal），产出
 * `temp/wxg-t-211-s3/<TAG>-seal.json`（temp/ 属 gitignore，取证件不入库；入库的是
 * `tests/__fixtures__/wxg-t-211-s3-seal.json` 那份**已核对**的基准）。
 *
 * 为什么留工具而不是留一次性脚本：`bead-style-seal.test.ts` 的判据**全部**引用本文件
 * 产出的基准；S7（真机回评后撤 `legacy-ten`）必然要重取一次 ⇒ 没有可跑的复取器，
 * 基线就成了不可再生的孤值（K-042 真源单一 + K-051 禁引纸面值）。
 *
 * 抓什么（对应任务单工作项 4 / 6）：
 *  1. `legacyFlow`  —— 96 例参数矩阵下**单颗珠的命令流**逐例 sha256。
 *     HEAD 侧 = 十层 `drawFilledBead`；S3 侧 = 封箱后的 `drawFilledBead`（层集来自
 *     `legacy-ten.ts`）⇒ 两者等值即「什么都没变」。
 *  2. `facetLayers` —— 45 例下 `facet-4` 层集，拆 `nonHole`（#1–#5）与 `hole`（#6）
 *     两把 sha ⇒ 「四棱臂 diff 有且仅有孔族变化」可机械判定。
 *  3. `frame78`     —— §11.2 同构夹具（13×12 / 78 填 / 78 空 / 156 可填）整帧逐 kind 计数
 *     ⇒ 新基线**差分复算**的唯一数值源（K-051：禁引纸面值）。
 *  4. `frame0`      —— 空盘整帧 sha ⇒ 证明非珠体族（B0 / 凹槽 / 面板 / HUD）零变更。
 *
 * ⚠ 每次抓取都跑**两遍自证确定性**；**夹具参数连参数一起登记**（breakout `--frames 180` 判例）。
 *
 * 跑法（两行都从仓根执行；`head` 侧需先用 `temp/wxg-t-211-s3/capture.sh head` 换出 HEAD 码）：
 *   WXG211_CAPTURE=s3  WXG211_SOURCE_REV=$(git rev-parse HEAD) \
 *   WXG211_SOURCE_DESC='S3 工作树' \
 *   node --experimental-transform-types \
 *        --import=./tools/scripts/lib/ts-js-resolve.mjs \
 *        games/beads/tests/bead-style-seal-recapture.ts
 * ⚠ `--experimental-transform-types` **必需**：本件经 `helpers.ts` 拉进整个 framework，
 *   而 Node 24 默认的 type-stripping 不认 `save/storage.ts` 的 constructor parameter
 *   property（⇒ ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX）。（工具链约束，非本单改动。）
 * ✅ 自检（2026-09-26）：重跑产出的 `s3-seal.json` 与已核对基准**深比较仅 1 处差异 =
 *   `capturedFrom` 溯源标签**⇒ 基准可再生（证据 `temp/wxg-t-211-s3/12-…selfcheck.txt`）。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { RenderModelBuilder, polygonVertices, type DrawCommand, type RenderModel } from '@wxgame/framework';
import { DESIGN_H, DESIGN_W, BEAD_CELL, TRAY_BEAD_SIZE, SELECT_LIFT_PX } from '../src/config/tuning.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { type FilledBeadOptions } from '../src/view/bead-render.js';
import { drawLegacyTenBead } from '../src/view/bead-styles/legacy-ten.js';
import { styleById } from '../src/view/bead-styles/registry.js';
import type { BeadStyleInput, BeadStyleLayer } from '../src/view/bead-styles/contract.js';
import { createBeadsHarness, placeColor, simpleTestLevel, type Harness } from './helpers.js';

/** `WXG211_CAPTURE=head|s3`；未设 ⇒ 直接退出（防误覆盖基准，本单踩过一次，K-035 同族自伤）。 */
const TAG = process.env.WXG211_CAPTURE ?? '';
if (!TAG) {
    console.error('❌ 需显式 WXG211_CAPTURE=head|s3（防止用当下代码静默覆盖基准）');
    process.exit(1);
}
const OUT_DIR = new URL('../../../temp/wxg-t-211-s3/', import.meta.url);

function sha(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function dump(name: string, value: unknown): void {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(new URL(name, OUT_DIR), JSON.stringify(value, null, 2));
}

function renderModel(harness: Harness): RenderModel {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
    return builder.end();
}

/** 命令 → 稳定文本（polygon 顶点经 `polygonVertices` 解引用 = ADR-0024 值语义的读法）。 */
function serialize(model: RenderModel): string[] {
    return model.commands.map((c: DrawCommand) =>
        c.kind === 'polygon'
            ? JSON.stringify({ ...c, points: Array.from(polygonVertices(model, c)) })
            : JSON.stringify(c),
    );
}

/** §11.2 同构夹具：13×12，前 6 行填满 = 78 填 / 78 空 / 156 可填。 */
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

/** 96 例单珠矩阵（3 色 × 有无目标色 × lift × scale × lod × 基尺）。 */
const LEGACY_FX: { label: string; colorIdx: number; opts: FilledBeadOptions }[] = [];
for (const ci of [1, 2, 3]) {
    for (const target of [undefined, 4]) {
        for (const lift of [0, SELECT_LIFT_PX]) {
            for (const scale of [1, 1.06]) {
                for (const lod of [undefined, 7]) {
                    for (const size of [BEAD_CELL - 8, TRAY_BEAD_SIZE]) {
                        LEGACY_FX.push({
                            label: `ci${ci}-t${target ?? 'none'}-l${lift}-s${scale}-lod${lod ?? 'full'}-z${size}`,
                            colorIdx: ci,
                            opts: { size, inks: DEMO_BEAD_INKS, lift, scale, lodLayers: lod, targetColorIdx: target },
                        });
                    }
                }
            }
        }
    }
}

/** 45 例层集矩阵（5 色 × 三种 target 口径 × 三个边长档）。 */
const STYLE_FX: { label: string; input: BeadStyleInput }[] = [];
for (const ci of [1, 2, 3, 4, 5]) {
    for (const target of [undefined, 1, 5]) {
        for (const size of [22, 30, 44]) {
            STYLE_FX.push({
                label: `ci${ci}-t${target ?? 'none'}-s${size}`,
                input: { inks: DEMO_BEAD_INKS, colorIdx: ci, targetColorIdx: target, size },
            });
        }
    }
}

function legacyFlowSeal(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const fx of LEGACY_FX) {
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        drawLegacyTenBead(builder, 100, 200, fx.colorIdx, fx.opts);
        out[fx.label] = sha(serialize(builder.end()).join('\n'));
    }
    return out;
}

function layerSeal(): { nonHole: Record<string, string>; hole: Record<string, string> } {
    const style = styleById('facet-4');
    assert.ok(style, 'facet-4 未注册 ⇒ 无从抓层集基准');
    const nonHole: Record<string, string> = {};
    const hole: Record<string, string> = {};
    for (const fx of STYLE_FX) {
        const layers = style!.beadLayers(fx.input);
        // ⚠ 层集在 S3 起是**模块级 scratch** ⇒ 必须先深拷贝成文本再算 sha（⛔ 存引用）。
        nonHole[fx.label] = sha(layers.slice(0, 5).map((l: BeadStyleLayer) => JSON.stringify(l)).join('\n'));
        hole[fx.label] = sha(layers.slice(5).map((l: BeadStyleLayer) => JSON.stringify(l)).join('\n'));
    }
    return { nonHole, hole };
}

function frameSeal(): {
    total: number; kinds: Record<string, number>; sha: string; filled: number; fillableTotal: number;
} {
    const { harness, filled } = halfBoardHarness('wxgame.beads.test.s211-seal-frame');
    assert.equal(filled, 78);
    const flow = serialize(renderModel(harness));
    const kinds: Record<string, number> = {};
    for (const line of flow) {
        const kind = (JSON.parse(line) as { kind: string }).kind;
        kinds[kind] = (kinds[kind] ?? 0) + 1;
    }
    return { total: flow.length, kinds, sha: sha(flow.join('\n')), filled, fillableTotal: harness.game.grid.fillableTotal };
}

const a = { legacy: legacyFlowSeal(), layers: layerSeal(), frame: frameSeal() };
const b = { legacy: legacyFlowSeal(), layers: layerSeal(), frame: frameSeal() };
assert.deepEqual(b, a); // 两遍等值 ⇒ 无隐藏状态 / 无随机（L4）

const empty = createBeadsHarness({
    noAssemble: true,
    levels: [simpleTestLevel({ cols: 13, rows: 12, pattern: Array.from({ length: 12 }, () => '1231231231231') })],
    saveKey: 'wxgame.beads.test.s211-seal-empty',
});
const emptyFlow = serialize(renderModel(empty));
const snap = empty.game.snapshot;

dump(`${TAG}-seal.json`, {
    capturedFrom: `${process.env.WXG211_SOURCE_REV ?? 'unknown'} · ${process.env.WXG211_SOURCE_DESC ?? ''}`,
    fixture: {
        legacyFx: LEGACY_FX.map((f) => f.label),
        legacyFxParams: LEGACY_FX.map((f) => ({
            label: f.label,
            colorIdx: f.colorIdx,
            size: f.opts.size,
            lift: f.opts.lift,
            scale: f.opts.scale,
            lodLayers: f.opts.lodLayers,
            targetColorIdx: f.opts.targetColorIdx,
        })),
        styleFx: STYLE_FX.map((f) => f.label),
        styleFxParams: STYLE_FX.map((f) => ({
            colorIdx: f.input.colorIdx,
            targetColorIdx: f.input.targetColorIdx,
            size: f.input.size,
        })),
        frame: {
            cols: 13,
            rows: 12,
            pattern: '1231231231231 × 12',
            filled: a.frame.filled,
            fillableTotal: a.frame.fillableTotal,
            noAssemble: true,
            gridPitch: snap.gridPitch,
            gridCell: snap.gridCell,
            traySlots: snap.traySlots.length,
            trayBeads: snap.traySlots.filter((s) => s.colorIdx > 0).length,
            design: [DESIGN_W, DESIGN_H],
        },
    },
    legacyFlow: a.legacy,
    facetLayers: a.layers,
    frame78: a.frame,
    frame0: { total: emptyFlow.length, sha: sha(emptyFlow.join('\n')) },
});
console.log(
    `[211-S3][seal:${TAG}] frame78 total=${a.frame.total} kinds=${JSON.stringify(a.frame.kinds)}` +
    ` frame0=${emptyFlow.length} cases=${LEGACY_FX.length}/${STYLE_FX.length}`,
);
