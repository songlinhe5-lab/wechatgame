/**
 * WXG-T-211-S4 · **整帧差分复算工具**（非测试文件 —— 文件名不带 `.test.ts` ⇒ 不进 vitest 采集）
 * ─────────────────────────────────────────────────────────────────────────────
 * 用途 = 履行 `bead-visual-style-spec §12.2 C7` 的「**每风格一份 §6 差分记录**」义务：
 * 以 §11.2 同构夹具（13×12 / 78 填 / 78 空 / 156 可填）在**同一条渲染链**上逐风格复算
 * 整帧命令流的逐 kind 计数，并把「整帧 Δ」**机检闭合**到「每颗珠 Δkind × 78」。
 * ⛔ 禁引纸面值（K-051）⇒ 本脚本产出的数字才是 §11.2-b / §11.2-c 的唯一数值源。
 *
 * **为什么能换风格而不动渲染链**（诚实交代测量手段）：
 * 生产链 `bead-render::drawFilledBead` 直读 `DEFAULT_BEAD_STYLE.beadLayers(...)`，
 * **没有风格形参**（换肤入口属 §12.9 步 5，本批不越界造）。本脚本因此只在测量期把
 * `DEFAULT_BEAD_STYLE.beadLayers` 临时指向目标风格的实现，跑完立刻还原 ⇒
 * 被测量的仍是**真实整帧路径**（view-model → drawFilledBead → builder），只换层集来源。
 * ⚠ 该手法唯一的失真风险 = **补丁没生效**（那会得到「所有臂全等 ⇒ Δ 恒 0」的假阴），
 * 故 `withStyle()` 内含**生效自证**（读回函数引用 + 臂间 total 必不同 ⇒ 否则当场 throw）。
 *
 * 抓什么：
 *  1. `perBead[kind]`   —— 单珠命令流的逐 kind 计数（把层集**实测**映射到 builder 出口，
 *     ⛔ 不是数 `beadLayers().length`：描边同路径不额外发命令，纸面读法②要在此处落地）。
 *  2. `frame78[kind]`   —— 半盘夹具整帧逐 kind 计数（差分本体）。
 *  3. `frame0`          —— 空盘整帧 sha（逐臂）**必须全等** ⇒ 「非珠体族 Δ = 0」的正向自证；
 *     ⚠ 若臂间不等，说明 frame0 含珠体（托盘珠），本判据失效 ⇒ 如实回报，不得改说辞。
 *  4. `closure[kind]`   —— 整帧 Δ vs `78 ×` 每颗 Δkind 的等式逐 kind 成立与否。
 *
 * 跑法（仓根；`--experimental-transform-types` 必需，同 `bead-style-seal-recapture.ts` 注）：
 *   node --experimental-transform-types \
 *        --import=./tools/scripts/lib/ts-js-resolve.mjs \
 *        games/beads/tests/bead-style-framediff.ts
 * 产出 `temp/wxg-t-211-s4/framediff.json`（temp/ 属 gitignore，取证件不入库）。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import {
  RenderModelBuilder,
  polygonVertices,
  type DrawCommand,
  type RenderModel,
} from '@wxgame/framework';
import { DESIGN_H, DESIGN_W, BEAD_CELL } from '../src/config/tuning.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { drawFilledBead } from '../src/view/bead-render.js';
import { DEFAULT_BEAD_STYLE, styleById } from '../src/view/bead-styles/registry.js';
import type { BeadStyle } from '../src/view/bead-styles/contract.js';
import { createBeadsHarness, placeColor, simpleTestLevel, type Harness } from './helpers.js';

const OUT_DIR = new URL('../../../temp/wxg-t-211-s4/', import.meta.url);
/** 池序 = `registry.ts` 注册序（§12.6 正本行序）；`facet-4` = 现默认档 ⇒ 基准臂。 */
const ARMS = ['facet-4', 'lineart-18', 'dual-tone-13'] as const;
const BASELINE = 'facet-4';
/** 夹具参数与 `bead-style-seal-recapture.ts::halfBoardHarness` 逐字同构（⛔ 另造夹具）。 */
const FILLED_EXPECT = 78;

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function dump(name: string, value: unknown): void {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(new URL(name, OUT_DIR), JSON.stringify(value, null, 2));
}

function serialize(model: RenderModel): string[] {
  return model.commands.map((c: DrawCommand) =>
    c.kind === 'polygon'
      ? JSON.stringify({ ...c, points: Array.from(polygonVertices(model, c)) })
      : JSON.stringify(c),
  );
}

function kindCount(flow: readonly string[]): Record<string, number> {
  const kinds: Record<string, number> = {};
  for (const line of flow) {
    const kind = (JSON.parse(line) as { kind: string }).kind;
    kinds[kind] = (kinds[kind] ?? 0) + 1;
  }
  return kinds;
}

/**
 * 测量用的**去 readonly 视角**（不改生产类型、不给 `contract.ts` 开后门）：
 * `BeadStyle.beadLayers` 在契约上是 `readonly`（生产侧无人该换它），而本文件是**离线复算工具**，
 * 换的只是默认档对象的属性指向（对象未被 `Object.freeze`，`registry.ts::DEFAULT_BEAD_STYLE` 直引注册项本身）。
 * 与 `contract.ts` 的 `WritableMembers<T>` 同族手法（那个类型未导出，故本处自带一份映射）。
 */
type WritableStyleSlot = { -readonly [K in keyof BeadStyle]: BeadStyle[K] };
const styleSlot = DEFAULT_BEAD_STYLE as WritableStyleSlot;

/** 临时把默认档的层集来源换成 style（含生效自证），跑完还原。 */
function withStyle<T>(id: string, fn: () => T): T {
  const style = styleById(id);
  assert.ok(style, `${id} 未注册 ⇒ 差分无对象可跑（红基线）`);
  const target = (style as BeadStyle).beadLayers;
  const original = styleSlot.beadLayers;
  styleSlot.beadLayers = target;
  if (styleSlot.beadLayers !== target) {
    styleSlot.beadLayers = original;
    throw new Error(`补丁未生效 ⇒ 臂间将全等、Δ 恒 0（假阴）。style ${id} 的默认对象被冻结？`);
  }
  try {
    return fn();
  } finally {
    styleSlot.beadLayers = original;
  }
}

function halfBoardHarness(): { harness: Harness; filled: number } {
  const harness = createBeadsHarness({
    noAssemble: true,
    levels: [
      simpleTestLevel({
        cols: 13,
        rows: 12,
        pattern: Array.from({ length: 12 }, () => '1231231231231'),
      }),
    ],
    saveKey: 'wxgame.beads.test.s211-s4-framediff',
  });
  const { game } = harness;
  let filled = 0;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 13; col++) {
      if (placeColor(game, game.grid.requiredColor(row, col), row, col)) filled++;
    }
  }
  assert.equal(filled, FILLED_EXPECT);
  return { harness, filled };
}

function frameFlow(harness: Harness): string[] {
  const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
  builder.begin();
  buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
  return serialize(builder.end());
}

/** 整帧（半盘）。 */
function frame78(id: string): { total: number; kinds: Record<string, number>; sha: string } {
  const { harness } = halfBoardHarness();
  const flow = withStyle(id, () => frameFlow(harness));
  return { total: flow.length, kinds: kindCount(flow), sha: sha(flow.join('\n')) };
}

/** 空盘整帧（非珠体族自证）。 */
function frame0(id: string): { total: number; sha: string } {
  const harness = createBeadsHarness({
    noAssemble: true,
    levels: [simpleTestLevel({ cols: 13, rows: 12, pattern: Array.from({ length: 12 }, () => '1231231231231') })],
    saveKey: 'wxgame.beads.test.s211-s4-framediff-empty',
  });
  const flow = withStyle(id, () => frameFlow(harness));
  return { total: flow.length, sha: sha(flow.join('\n')) };
}

/** 单珠命令流（把层集实测成 builder 出口；含 fill+stroke 同路径的读法）。 */
function perBead(id: string): { total: number; kinds: Record<string, number> } {
  const build = () => {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    drawFilledBead(builder, 100, 100, 1, { size: BEAD_CELL, inks: DEMO_BEAD_INKS, targetColorIdx: 2 });
    return serialize(builder.end());
  };
  const flow = withStyle(id, build);
  return { total: flow.length, kinds: kindCount(flow) };
}

const results: Record<string, { frame78: ReturnType<typeof frame78>; frame0: ReturnType<typeof frame0>; perBead: ReturnType<typeof perBead> }> = {};
for (const id of ARMS) results[id] = { frame78: frame78(id), frame0: frame0(id), perBead: perBead(id) };

// ── 测量有效性护栏（⛔ 补丁失灵 / frame0 含珠体，两者都会把差分洗成 0）──
for (const id of ARMS) assert.ok(results[id].frame78.total > 0, `${id} 整帧为空`);
const totals = ARMS.map((id) => results[id].frame78.total);
assert.ok(new Set(totals).size === ARMS.length, `臂间整帧 total 出现相等（${totals.join('/')}）⇒ 检查换肤是否生效`);
const frame0Shas = new Set(ARMS.map((id) => results[id].frame0.sha));
const nonBeadFamilyClean = frame0Shas.size === 1;

/** 逐 kind 差分 + 闭合校验：整帧 Δ =? 78 × 每颗 Δkind（⛔ 不拿纸面算术代替实测）。 */
const allKinds = new Set<string>();
for (const id of ARMS) for (const k of Object.keys(results[id].frame78.kinds)) allKinds.add(k);
const diffs: Record<string, unknown> = {};
for (const id of ARMS) {
  if (id === BASELINE) continue;
  const rows: Record<string, Record<string, number | boolean>> = {};
  let closed = true;
  for (const kind of [...allKinds].sort()) {
    const base = results[BASELINE];
    const cur = results[id];
    const boardDelta = (cur.frame78.kinds[kind] ?? 0) - (base.frame78.kinds[kind] ?? 0);
    const beadDelta = (cur.perBead.kinds[kind] ?? 0) - (base.perBead.kinds[kind] ?? 0);
    const expect = beadDelta * FILLED_EXPECT;
    if (boardDelta !== expect) closed = false;
    rows[kind] = { boardDelta, beadDelta, expect, eq: boardDelta === expect };
  }
  diffs[id] = {
    totalDelta: curTotal(results[id]) - curTotal(results[BASELINE]),
    perBeadTotalDelta: results[id].perBead.total - results[BASELINE].perBead.total,
    closure: rows,
    closureHolds: closed,
  };
}

function curTotal(r: { frame78: { total: number } }): number {
  return r.frame78.total;
}

dump('framediff.json', {
  capturedFrom: `${process.env.WXG211_SOURCE_REV ?? 'unknown'} · ${process.env.WXG211_SOURCE_DESC ?? '工作树（WXG-T-211-S4）'}`,
  fixture: {
    cols: 13, rows: 12, pattern: '1231231231231 × 12',
    filled: FILLED_EXPECT, fillableTotal: 156, noAssemble: true,
    beadSize: BEAD_CELL, singleBeadOpts: { colorIdx: 1, targetColorIdx: 2, size: BEAD_CELL },
    styleSwitch: 'DEFAULT_BEAD_STYLE.beadLayers 运行期临时指向目标风格（步 5 前无生产换肤入口）',
  },
  nonBeadFamilyClean,
  arms: results,
  diffs,
});

for (const id of ARMS) {
  const r = results[id];
  console.log(
    `[211-S4][diff] ${id.padEnd(13)} 每颗=${r.perBead.total} ${JSON.stringify(r.perBead.kinds)}` +
      ` | 整帧=${r.frame78.total} ${JSON.stringify(r.frame78.kinds)}`,
  );
}
console.log(`[211-S4][diff] frame0 逐臂 sha 全等 = ${nonBeadFamilyClean}`);
for (const [id, d] of Object.entries(diffs)) {
  console.log(`[211-S4][diff] ${id} 整帧Δ=${(d as { totalDelta: number }).totalDelta} 闭合=${(d as { closureHolds: boolean }).closureHolds}`);
}
