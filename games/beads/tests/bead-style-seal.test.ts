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
import { DESIGN_H, DESIGN_W } from '../src/config/tuning.js';
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
};

interface SealSide {
  legacyFlow?: Record<string, string>;
  facetNonHoleLayers: Record<string, string>;
  facetHoleLayer: Record<string, string>;
  frame0: { sha: string; total: number };
  frame78: { kinds: Record<string, number>; sha: string; total: number };
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

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

  it('腿 2 · 非孔零变更：`facet-4` #1–#5 共 45 例 ≡ HEAD（底衬与四枚刻面一字未动）', () => {
    const { nonHole } = layerSeal();
    const want = SEAL.head.facetNonHoleLayers;
    expect(Object.keys(nonHole).sort()).toEqual(Object.keys(want).sort());
    for (const k of Object.keys(want)) expect(nonHole[k], `${k} 非孔层集已被改动`).toBe(want[k]);
  });

  it('腿 3 · 仅孔变化：#6 共 45 例全 ≠ HEAD 且 ≡ S3 登记值（本单唯一被允许的变更源）', () => {
    const { hole } = layerSeal();
    const before = SEAL.head.facetHoleLayer;
    const after = SEAL.s3.facetHoleLayer;
    const changed = Object.keys(before).filter((k) => hole[k] !== before[k]);
    expect(changed).toHaveLength(45); // ⛔ 有任何一例"孔没变"⇒ 说明甲口径没落全
    for (const k of Object.keys(after)) expect(hole[k], `${k} 孔层与 S3 登记不符`).toBe(after[k]);
  });

  it('腿 4 · 新 §11.2 基线 ≡ S3 登记（整帧逐 kind 计数 + sha），且空盘与 HEAD 等值', () => {
    const f = frameSeal();
    expect(f.kinds).toEqual(SEAL.s3.frame78.kinds);
    expect(f.total).toBe(SEAL.s3.frame78.total);
    expect(f.sha).toBe(SEAL.s3.frame78.sha);
    expect(f.fillableTotal).toBe(156);
    // 空盘（0 填格）整帧 ≡ HEAD ⇒ 非珠体族（B0 / 凹槽 / 面板 / HUD）零变更。
    const empty = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ cols: 13, rows: 12, pattern: Array.from({ length: 12 }, () => '1231231231231') })],
      saveKey: 'wxgame.beads.test.s211-seal-empty-check',
    });
    const emptyFlow = serialize(renderModel(empty));
    expect(sha(emptyFlow.join('\n'))).toBe(SEAL.head.frame0.sha);
    expect(emptyFlow.length).toBe(SEAL.head.frame0.total);
    expect(SEAL.s3.frame0.sha).toBe(SEAL.head.frame0.sha);
  });

  it('差分自洽：Δtotal 全部可归因 78 颗填格（孔贡献 vs 刻面 kind 化），非珠体族 Δ = 0', () => {
    const h = SEAL.head.frame78.kinds;
    const s = SEAL.s3.frame78.kinds;
    const delta: Record<string, number> = {};
    for (const k of new Set([...Object.keys(h), ...Object.keys(s)])) {
      delta[k] = (s[k] ?? 0) - (h[k] ?? 0);
    }
    // 每颗填格：十层 5 rect + 5 line + 2 circle → 四棱 1 rect + 4 polygon + 1 circle。
    const per = (d: number) => d / 78;
    expect(per(delta.rect ?? 0)).toBe(-4); // 5 rect → 1 rect
    expect(per(delta.line ?? 0)).toBe(-5); // 5 line → 0（倒角/rim 族整体退役）
    expect(per(delta.circle ?? 0)).toBe(-1); // **孔贡献**：双孔 → 单孔
    expect(per(delta.polygon ?? 0)).toBe(4); // **刻面 kind 化**：0 → 4
    expect(delta.text ?? 0).toBe(0); // 非珠体族零变更（HUD/文案）
    const totalDelta = (SEAL.s3.frame78.total ?? 0) - (SEAL.head.frame78.total ?? 0);
    expect(Object.values(delta).reduce((a, b) => a + b, 0)).toBe(totalDelta);
    expect(totalDelta).toBe(78 * (-4 - 5 - 1 + 4));
    // ⛔ 禁止"纸面推算的新基线整帧数"入册（K-051）：本例只校**实测值之间**的自洽。
    expect(SEAL.s3.frame78.total).toBe(1119);
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
