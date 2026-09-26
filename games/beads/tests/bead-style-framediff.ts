/**
 * WXG-T-211-S4 初建 · **WXG-T-211-S5 改造走真实换肤分支** · 整帧差分复算工具
 * （非测试文件 —— 文件名不带 `.test.ts` ⇒ 不进 vitest 采集）
 * ─────────────────────────────────────────────────────────────────────────────
 * 用途 = 履行 `bead-visual-style-spec §12.2 C7` 的「**每风格一份 §6 差分记录**」义务：
 * 以 §11.2 同构夹具（13×12 / 78 填 / 78 空 / 156 可填）在**同一条渲染链**上逐风格复算
 * 整帧命令流的逐 kind 计数，并把「整帧 Δ」**机检闭合**到「每颗珠 Δkind × 78」。
 * ⛔ 禁引纸面值（K-051）⇒ 本脚本产出的数字才是 §11.2-a / -b / -c 的唯一数值源。
 *
 * **S5 改造（任务单 §11.2-b/c 重取的显式义务）**：生产链自 §12.9 步 5 起**已有换肤入口**
 * （`drawFilledBead` 读 `options.styleId`，其值由 `snapshot.beadStyle` 下发），故本脚本
 * 不应用「把 `DEFAULT_BEAD_STYLE.beadLayers` 运行期偷指向目标风格」的黑补丁。
 * 旧手法（S4，就地留档，K-053）：
 *   > 「只在测量期把 `DEFAULT_BEAD_STYLE.beadLayers` 临时指向目标风格的实现，跑完立刻还原」
 *   > —— 当时**无生产入口可走**（步 5 不越界造），失真的唯一风险 = 补丁未生效。
 * 现两条测量腿都走**玩家真实路径**：
 *   整帧腿 = `game.applySettingsAction('cycle-bead-style')` 循环到目标档 ⇒ snapshot ⇒
 *            `buildBeadsView` ⇒ `drawFilledBead(styleId)`；
 *   单珠腿 = 直接 `drawFilledBead(..., { styleId })`（同一入参通道）。
 * 生效自证因此从「函数引用读回」升为**断言 `game.beadStyle === 目标档`**（读的是 game 态，
 * 而非被打补丁的对象），并保留「臂间 total 必不同」的假阴护栏。
 *
 * 抓什么：
 *  1. `perBead[kind]`   —— 单珠命令流的逐 kind 计数（把层集**实测**映射到 builder 出口，
 *     ⛔ 不是数 `beadLayers().length`：描边同路径不额外发命令，纸面读法②要在此处落地）。
 *  2. `frame78[kind]`   —— 半盘夹具整帧逐 kind 计数（差分本体）。
 *  3. `frame0`          —— 空盘整帧 sha（逐臂）**必须全等** ⇒ 「非珠体族 Δ = 0」的正向自证；
 *     ⚠ 若臂间不等，说明 frame0 含珠体（托盘珠），本判据失效 ⇒ 如实回报，不得改说辞。
 *     ⚠ **S5 新增的失真风险（诚实登记）**：托盘珠自本批起**随风格**⇒ 一旦夹具给托盘供珠，
 *        frame0 不再全等。本脚本的夹具 = `noAssemble: true` 且不手动 `giveTrayBead` ⇒
 *        托盘无珠（与 S4 同口径），护栏仍成立；若后续改夹具，须同步重定本判据。
 *  4. `closure[kind]`   —— 整帧 Δ vs `78 ×` 每颗 Δkind 的等式逐 kind 成立与否。
 *  5. `perBeadSmall`    —— **S5 附带观测**（豆径档小豆臂的每颗计数）；⛔ 不进 §11.2 义务
 *     （§11.2-b/c 只要求三风格整帧差分），仅供真机校准 PT-SKIN-05 时对照，不做闭合断言。
 *
 * 跑法（仓根；`--experimental-transform-types` 必需，同 `bead-style-seal-recapture.ts` 注）：
 *   node --experimental-transform-types \
 *        --import=./tools/scripts/lib/ts-js-resolve.mjs \
 *        games/beads/tests/bead-style-framediff.ts
 * 产出 `temp/wxg-t-211-s5/framediff.json`（temp/ 属 gitignore，取证件不入库）。
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
import { DESIGN_H, DESIGN_W, BEAD_CELL, BEAD_DRAW_INSET_SMALL, BEAD_SIZE_SMALL } from '../src/config/tuning.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { drawFilledBead } from '../src/view/bead-render.js';
import { registeredStyleIds } from '../src/view/bead-styles/registry.js';
import { createBeadsHarness, placeColor, simpleTestLevel, type Harness } from './helpers.js';

const OUT_DIR = new URL('../../../temp/wxg-t-211-s5/', import.meta.url);
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
 * **换肤驱动（S5 改造核心）**：走玩家真实路径 —— `game.applySettingsAction('cycle-bead-style')`
 * 按 registry 注册序循环到目标档（该入口局外相位无关、不切相位、不推计时），再读 snapshot 出帧。
 * 生效自证因此是**断言游戏状态** `game.beadStyle === 目标档`，而非 S4 的「补丁函数引用读回」
 * （后者只证明对象属性被改过，不证明生产链会读它）。
 * ⛔ 不得回退黑补丁：那会把「渲染链是否真按 snapshot 分支」这一 S5 主命题测成真空。
 */
function driveStyleTo(game: Harness['game'], id: string): void {
    const ids = registeredStyleIds();
    const target = ids.indexOf(id);
    assert.ok(target >= 0, `${id} 未注册 ⇒ 差分无对象可跑（红基线）`);
    for (let i = 0; i < target; i++) game.applySettingsAction('cycle-bead-style');
    assert.equal(game.beadStyle, id, `真实换肤入口未生效（实际 ${game.beadStyle}）⇒ 臂间将全等、Δ 恒 0（假阴）`);
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

/** 整帧（半盘）：先把 harness 换肤到目标档，再出帧。 */
function frame78(id: string): { total: number; kinds: Record<string, number>; sha: string } {
    const { harness } = halfBoardHarness();
    driveStyleTo(harness.game, id);
    const flow = frameFlow(harness);
    return { total: flow.length, kinds: kindCount(flow), sha: sha(flow.join('\n')) };
}

/** 空盘整帧（非珠体族自证）。 */
function frame0(id: string): { total: number; sha: string } {
    const harness = createBeadsHarness({
        noAssemble: true,
        levels: [simpleTestLevel({ cols: 13, rows: 12, pattern: Array.from({ length: 12 }, () => '1231231231231') })],
        saveKey: 'wxgame.beads.test.s211-s4-framediff-empty',
    });
    driveStyleTo(harness.game, id);
    const flow = frameFlow(harness);
    return { total: flow.length, sha: sha(flow.join('\n')) };
}

/** 单珠命令流（把层集实测成 builder 出口；含 fill+stroke 同路径的读法）。 */
function perBead(id: string): { total: number; kinds: Record<string, number> } {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    drawFilledBead(builder, 100, 100, 1, { size: BEAD_CELL, inks: DEMO_BEAD_INKS, targetColorIdx: 2, styleId: id });
    const flow = serialize(builder.end());
    return { total: flow.length, kinds: kindCount(flow) };
}

/**
 * **S5 附带观测腿（小豆档）**：走 `drawInset` + `hideHole` 两个正交参数（豆径档与风格正交，
 * ADR-0023 DEC-7）。⛔ 不进 §11.2-b/c 义务、不做闭合断言 —— 只登记真机校准 PT-SKIN-05 前的实测基线。
 */
function perBeadSmall(id: string): { total: number; kinds: Record<string, number> } {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    drawFilledBead(builder, 100, 100, 1, {
        size: BEAD_CELL,
        inks: DEMO_BEAD_INKS,
        targetColorIdx: 2,
        styleId: id,
        drawInset: BEAD_DRAW_INSET_SMALL,
        hideHole: true,
    });
    const flow = serialize(builder.end());
    return { total: flow.length, kinds: kindCount(flow) };
}

const results: Record<string, { frame78: ReturnType<typeof frame78>; frame0: ReturnType<typeof frame0>; perBead: ReturnType<typeof perBead>; perBeadSmall: ReturnType<typeof perBeadSmall> }> = {};
for (const id of ARMS) results[id] = { frame78: frame78(id), frame0: frame0(id), perBead: perBead(id), perBeadSmall: perBeadSmall(id) };

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
    capturedFrom: `${process.env.WXG211_SOURCE_REV ?? 'unknown'} · ${process.env.WXG211_SOURCE_DESC ?? '工作树（WXG-T-211-S5）'}`,
    fixture: {
        cols: 13, rows: 12, pattern: '1231231231231 × 12',
        filled: FILLED_EXPECT, fillableTotal: 156, noAssemble: true,
        beadSize: BEAD_CELL, singleBeadOpts: { colorIdx: 1, targetColorIdx: 2, size: BEAD_CELL },
        // S5：两条测量腿都走真实换肤链（整帧腿 = 面板动作 → snapshot → view-model；单珠腿 = 同一 styleId 入参通道）。
        styleSwitch: "game.applySettingsAction('cycle-bead-style') 循环到目标档 → snapshot.beadStyle → drawFilledBead(options.styleId)",
        styleSwitchSelfProof: 'assert.equal(game.beadStyle, 目标档)（读游戏态，非补丁对象引用）',
        perBeadSmallOpts: { beadSize: BEAD_SIZE_SMALL, drawInset: BEAD_DRAW_INSET_SMALL, hideHole: true, note: '附带观测，不进 §11.2 义务' },
    },
    nonBeadFamilyClean,
    arms: results,
    diffs,
});

for (const id of ARMS) {
    const r = results[id];
    console.log(
        `[211-S5][diff] ${id.padEnd(13)} 每颗=${r.perBead.total} ${JSON.stringify(r.perBead.kinds)}` +
        ` | 小豆每颗=${r.perBeadSmall.total} ${JSON.stringify(r.perBeadSmall.kinds)}` +
        ` | 整帧=${r.frame78.total} ${JSON.stringify(r.frame78.kinds)}`,
    );
}
console.log(`[211-S5][diff] frame0 逐臂 sha 全等 = ${nonBeadFamilyClean}`);
for (const [id, d] of Object.entries(diffs)) {
    console.log(`[211-S5][diff] ${id} 整帧Δ=${(d as { totalDelta: number }).totalDelta} 闭合=${(d as { closureHolds: boolean }).closureHolds}`);
}
