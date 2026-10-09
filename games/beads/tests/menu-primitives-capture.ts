/**
 * **K-6 菜单帧图元取数装置（捕获腿）** — WXG-T-269-S6 · 子单 T-2B / Deliverable 4
 * ─────────────────────────────────────────────────────────────────────────────
 * 非测试文件（无 `.test.ts` ⇒ 不进 vitest 采集，⛔ 不给 `verify` 增加 SKIP 项）。
 * 产出 = `temp/wxg-t-269-s6/<TAG>-k6-ledger.json`（temp/ 属 gitignore，取证件不入库）
 * + 一份**已核对**的台账副本入库 `tests/__fixtures__/wxg-t-269-s6-k6-ledger.json`（入库需主理人批准）。
 *
 * 它把 `risks.md K-6` 的「菜单帧图元 +N」从纸面推算钉成**实测断言**：
 *  1. **逐 kind 计数腿**：菜单帧按 `rect/line/text/circle/polygon` 逐类计数 + 珠数（`circle/2`）+ 整帧 sha；
 *  2. **同帧差分三组对照**（同一 data、同一帧链路，只换 `MetaViewVariant`）：
 *     招牌 beadText on/off、陈列格 3→2 行、缩略 5/4/3 档 ⇒ Δ 由两次真跑相减得出；
 *  3. **playing 封箱复取**：以 `tests/__fixtures__/wxg-t-211-s3-seal.json` 的 `fixture.frame` **参数**
 *     复现空盘 / 78 填两帧，四键（frame0/frame78 的 total + sha）与该件 `s3.*` 逐字节对撞 ⇒
 *     证明「珠拼 / 缩略没有渗进盘面命令流」（S0 约束⑤ / L5；S4/S5 先例的复评口径）。
 *
 * ⚠ 三处**结构自证**内置（不满足即 throw，⛔ 不带病出数）：每珠恒 7 命令、菜单帧零 `blit`、两遍跑全等（L4）。
 *
 * 跑法（从仓根；`WXG269_CAPTURE` 未设 ⇒ 直接退出，防误覆盖台账）：
 * ```
 * WXG269_CAPTURE=t269s6 WXG269_SOURCE_REV=$(git rev-parse HEAD) \
 * WXG269_SOURCE_DESC='T-2B 工作树（beadText 招牌 + 作品格珠拼缩略）' \
 * node --experimental-transform-types --import=./tools/scripts/lib/ts-js-resolve.mjs \
 *      games/beads/tests/menu-primitives-capture.ts
 * ```
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { RenderModelBuilder } from '@wxgame/framework';
import {
    BEAD_GAP,
    BEAD_STYLE_MAX_COMMANDS,
    DESIGN_H,
    DESIGN_W,
    SIGN_AVAIL_W,
    SIGN_BEAD_PITCH,
    SIGN_FACE_FLOOR,
    SIGN_MATRIX_N,
    SIGN_TOTAL_W,
    THUMB_AREA,
    THUMB_BEADS_MAX,
    THUMB_TIERS,
    signFaceA,
    signFaceB,
    signPitchFor,
    signTierOk,
    thumbOuterFor,
    thumbPitchFor,
} from '../src/config/tuning.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { levelThumbBeads, thumbFaceB } from '../src/view/menu-signage.js';
import { createBeadsHarness, placeColor, simpleTestLevel } from './helpers.js';
import {
    CAPTURE_LEGS,
    DEFAULT_EXPLICIT,
    SIGN_BEADS_FROM_GLYPHS,
    SIGN_COMMANDS_FROM_GLYPHS,
    countFrame,
    countPrimitives,
    createMenuShell,
    menuModel,
    viewDataOf,
    type MenuRigState,
    type PrimitiveCount,
} from './menu-primitives-lib.js';
import { buildMetaView } from '../src/view/meta-view.js';
import type { RenderModel } from '@wxgame/framework';

const TAG = process.env.WXG269_CAPTURE ?? '';
if (!TAG) {
    console.error('❌ 需显式 WXG269_CAPTURE=<tag>（防止用当下代码静默覆盖台账）');
    process.exit(1);
}
const OUT_DIR = new URL('../../../temp/wxg-t-269-s6/', import.meta.url);
const SEAL_FIXTURE = new URL('__fixtures__/wxg-t-211-s3-seal.json', import.meta.url);

const RIG_STATES: readonly MenuRigState[] = ['full', 'first'];

/** 一腿的读数（同一 state 内逐腿只换 variant ⇒ 差分可比）。 */
interface LegReading extends PrimitiveCount {
    readonly label: string;
    readonly variant: object | null;
    readonly note: string;
}

function captureOnce(): Record<MenuRigState, Record<string, LegReading>> {
    const out = {} as Record<MenuRigState, Record<string, LegReading>>;
    for (const state of RIG_STATES) {
        const shell = createMenuShell(state);
        const table: Record<string, LegReading> = {};
        for (const leg of CAPTURE_LEGS) {
            const model = menuModel(shell, leg.variant ?? undefined, leg.overlay);
            table[leg.label] = { ...countPrimitives(model), label: leg.label, variant: leg.variant, note: leg.note };
        }
        out[state] = table;
    }
    return out;
}

/** 逐 kind 相减（Δ 只在两腿都有的 kind 上给出，正负都保留）。 */
function delta(a: LegReading, b: LegReading): { total: number; beads: number; kinds: Record<string, number> } {
    const kinds: Record<string, number> = {};
    for (const k of new Set([...Object.keys(a.kinds), ...Object.keys(b.kinds)])) {
        const d = (a.kinds[k] ?? 0) - (b.kinds[k] ?? 0);
        if (d !== 0) kinds[k] = d;
    }
    return { total: a.total - b.total, beads: a.beads - b.beads, kinds };
}

function diffTable(state: MenuRigState, t: Record<string, LegReading>) {
    // 菜单腿 Δ 以 `production` 为基；选关页腿（行数/缩略/地板）以墙生产档 `wall.rows3` 为基。
    return {
        signage: delta(t['production']!, t['signage.off']!),
        wallRows: delta(t['wall.rows3']!, t['wall.rows2']!),
        thumb5to4: delta(t['wall.rows3']!, t['thumb.n4']!),
        thumb4to3: delta(t['thumb.n4']!, t['thumb.n3']!),
        thumb5to3: delta(t['wall.rows3']!, t['thumb.n3']!),
        allVsFloor: delta(t['wall.rows3']!, t['floor.allOff']!),
        state,
    };
}

// ───────────────────────────────────────────── playing 封箱复取（四键自证）

interface SealFixture {
    fixture: { frame: { cols: number; rows: number; pattern: string; filled: number; noAssemble: boolean } };
    s3: { frame0: { total: number; sha: string }; frame78: { total: number; sha: string } };
}

/** 整帧读数（sha 与逐 kind 计数与菜单腿同一口径 ⇒ 可同表对撞；⚠ 裸计数，结构自证只对菜单帧成立）。 */
function frameSeal(model: RenderModel): PrimitiveCount {
    return countFrame(model);
}

/**
 * 参数**取自封箱件本体**（`fixture.frame`），⛔ 不在本脚本另立一套夹具数值（K-042）；
 * 基准四键也取自同件 `s3.*` ⇒ 「MATCH / MISMATCH」是同一文件内的自洽对撞。
 */
function playingSealRecheck(): Record<string, unknown> {
    const seal = JSON.parse(readFileSync(SEAL_FIXTURE, 'utf8')) as SealFixture;
    const f = seal.fixture.frame;
    const rowPattern = f.pattern.split(' × ')[0]!;
    const rows: string[] = [];
    for (let i = 0; i < f.rows; i++) rows.push(rowPattern);
    const level = simpleTestLevel({ cols: f.cols, rows: f.rows, pattern: rows });

    const frameOf = (harness: ReturnType<typeof createBeadsHarness>): PrimitiveCount => {
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
        return frameSeal(builder.end());
    };

    const empty = createBeadsHarness({ noAssemble: f.noAssemble, levels: [level], saveKey: 'wxgame.beads.test.t269s6-seal-frame0' });
    const half = createBeadsHarness({ noAssemble: f.noAssemble, levels: [level], saveKey: 'wxgame.beads.test.t269s6-seal-frame78' });
    let filled = 0;
    const rowsToFill = Math.round(f.filled / f.cols);
    const { game } = half;
    for (let row = 0; row < rowsToFill; row++) {
        for (let col = 0; col < f.cols; col++) {
            if (placeColor(game, game.grid.requiredColor(row, col), row, col)) filled++;
        }
    }
    assert.equal(filled, f.filled, '夹具填充数须与封箱件登记一致（否则对撞无意义）');

    const frame0 = frameOf(empty);
    const frame78 = frameOf(half);
    const keys = [
        { key: 'frame0.total', now: frame0.total, base: seal.s3.frame0.total },
        { key: 'frame0.sha', now: frame0.sha, base: seal.s3.frame0.sha },
        { key: 'frame78.total', now: frame78.total, base: seal.s3.frame78.total },
        { key: 'frame78.sha', now: frame78.sha, base: seal.s3.frame78.sha },
    ];
    const allMatch = keys.every((k) => String(k.now) === String(k.base));
    if (!allMatch) {
        throw new Error(`playing 封箱四键 MISMATCH：${keys.filter((k) => String(k.now) !== String(k.base)).map((k) => k.key).join(',')} ⇒ 珠拼/缩略渗进盘面命令流（S0 约束⑤），返工`);
    }
    return {
        source: 'tests/__fixtures__/wxg-t-211-s3-seal.json · s3.*',
        fixtureParams: { cols: f.cols, rows: f.rows, rowPattern, filled: f.filled, noAssemble: f.noAssemble },
        now: {
            frame0: { total: frame0.total, kinds: frame0.kinds, beads: frame0.beads, sha: frame0.sha },
            frame78: { total: frame78.total, kinds: frame78.kinds, beads: frame78.beads, sha: frame78.sha },
        },
        keys,
        allMatch,
        verdict: 'MATCH（四键逐字节等 ⇒ playing 命令流零渗漏）',
    };
}

// ───────────────────────────────────────────── 档位读数（验收③：d ∈ [10,15] 的真几何口径）

function tierReadings() {
    const tiers = [8, SIGN_MATRIX_N, 12].map((n) => {
        const d = signPitchFor(n);
        return {
            n,
            d,
            totalW: 5.5 * n * d,
            faceB: signFaceB(d),
            faceA: signFaceA(d),
            okUnderB: signTierOk(n),
            verdict: signTierOk(n) ? '口径 B 过地板' : `口径 B 破地板（${signFaceB(d).toFixed(3)} < ${SIGN_FACE_FLOOR}）`,
        };
    });
    const thumbs = THUMB_TIERS.map((n) => ({
        n,
        pitch: thumbPitchFor(n),
        outer: thumbOuterFor(n),
        faceB: thumbFaceB(n),
        ok: thumbFaceB(n) >= SIGN_FACE_FLOOR,
    }));
    const perLevel: Record<string, unknown> = {};
    for (const lv of LEVELS) {
        perLevel[`L${lv.id}`] = {
            n5: levelThumbBeads(lv, 5),
            n4: levelThumbBeads(lv, 4),
            n3: levelThumbBeads(lv, 3),
        };
    }
    return {
        note: '面 = (d − BEAD_GAP) × 26/30（口径 B 真几何，`BEAD_DRAW_INSET = 2` ⇒ ratio 26/30）；地板 SIGN_FACE_FLOOR',
        beadGap: BEAD_GAP,
        availW: SIGN_AVAIL_W,
        pageBudget: { totalW_n10d12: SIGN_TOTAL_W, availW: SIGN_AVAIL_W, slack: SIGN_AVAIL_W - SIGN_TOTAL_W },
        adopted: { n: SIGN_MATRIX_N, d: SIGN_BEAD_PITCH, faceB: signFaceB(SIGN_BEAD_PITCH), commands: SIGN_COMMANDS_FROM_GLYPHS },
        tiers,
        thumbTiers: thumbs,
        thumbArea: THUMB_AREA,
        thumbBeadsMax: THUMB_BEADS_MAX,
        perLevelThumbBeads: perLevel,
        signGlyphs: { beads: SIGN_BEADS_FROM_GLYPHS, commandsPerBead: BEAD_STYLE_MAX_COMMANDS, total: SIGN_COMMANDS_FROM_GLYPHS },
    };
}

// ───────────────────────────────────────────── 跑 + 落盘

const a = captureOnce();
const b = captureOnce();
assert.deepEqual(b, a, '两遍跑全等（L4 确定性自证；不等 ⇒ 取数装置含隐藏状态）');

const shellProbe = createMenuShell('full');
const prodViaShell = countPrimitives(menuModel(shellProbe));
const prodViaView = countPrimitives(menuModel(shellProbe, DEFAULT_EXPLICIT));
assert.equal(prodViaView.sha, prodViaShell.sha, '不传 variant ≡ 传默认值（差分腿与生产腿同源）');
{
    // L5 结构自证：视图对**同一 data** 二次调用输出全等（不持状态、不写回）。
    const data = viewDataOf(shellProbe);
    const paint = (): string => {
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        buildMetaView(builder, data, shellProbe.play.palette, DEFAULT_EXPLICIT);
        return countPrimitives(builder.end()).sha;
    };
    const first = paint();
    assert.equal(paint(), first, '同 data 二次调用全等（L5）');
    assert.equal(first, prodViaShell.sha, '视图直调（显式默认档）≡ 生产真链路');
}

const ledger = {
    task: 'WXG-T-269-S6 · 子单 T-2B（K-6 菜单帧图元实测台账）',
    capturedAt: new Date().toISOString(),
    capturedFrom: `${process.env.WXG269_SOURCE_REV ?? 'unknown'} · ${process.env.WXG269_SOURCE_DESC ?? ''}`,
    rerun: 'WXG269_CAPTURE=<tag> node --experimental-transform-types --import=./tools/scripts/lib/ts-js-resolve.mjs games/beads/tests/menu-primitives-capture.ts',
    method: {
        primitiveUnit: '1 图元 = 1 条 RenderModel 命令（T-1 §0.2）',
        commandsPerBead: BEAD_STYLE_MAX_COMMANDS,
        beadsReadout: 'beads = circle / 2（facet-4 每珠两枚同心圆；菜单帧非珠图元无 circle）',
        rigStates: { full: `maxUnlocked = ${LEVELS.length}（满载）`, first: 'maxUnlocked = 1（首日）' },
        determinism: '同进程两遍全等 + 生产腿 sha 等价自证（本文件 assert，失败不出数）',
        forbidden: '⛔ 纸面值入册（K-051）；⛔ 反向改基准求绿（K-053）',
    },
    frames: a,
    diffs: { full: diffTable('full', a.full!), first: diffTable('first', a.first!) },
    tiers: tierReadings(),
    playingSeal: playingSealRecheck(),
    menuFrameNonRegression: {
        // 与本批进场前的容器语言对照：非珠图元族不变（line/rect/text 三族仍住在菜单帧；circle/polygon 只来自珠体）。
        kindsObserved: Object.keys(a.full!['production']!.kinds).sort(),
        blitCount: a.full!['production']!.kinds['blit'] ?? 0,
    },
};

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const outFile = new URL(`${TAG}-k6-ledger.json`, OUT_DIR);
writeFileSync(outFile, JSON.stringify(ledger, null, 2));

const t = a.full!;
console.log(`[269-S6][K-6:${TAG}] 菜单帧图元实测（state=full，满载 ${LEVELS.length} 关已解锁）`);
for (const leg of CAPTURE_LEGS) {
    const r = t[leg.label]!;
    console.log(
        `  ${leg.label.padEnd(14)} total=${String(r.total).padStart(5)} beads=${String(r.beads).padStart(4)} ` +
        `kinds=${JSON.stringify(r.kinds)}`,
    );
}
const d = diffTable('full', t);
console.log(`  Δ 招牌 beadText     = ${d.signage.total} 命令（${d.signage.beads} 珠 × ${BEAD_STYLE_MAX_COMMANDS}）`);
console.log(`  Δ 陈列格 3→2 行     = ${d.wallRows.total} 命令（${d.wallRows.beads} 珠）`);
console.log(`  Δ 缩略 5→4 / 4→3    = ${d.thumb5to4.total} / ${d.thumb4to3.total} 命令`);
console.log(`  Δ production−floor  = ${d.allVsFloor.total} 命令（${d.allVsFloor.beads} 珠）`);
const ps = ledger.playingSeal as { verdict: string; keys: { key: string; now: unknown; base: unknown }[] };
console.log(`  playing 封箱四键     = ${ps.verdict}`);
for (const k of ps.keys) console.log(`    ${k.key.padEnd(14)} now=${k.now} base=${k.base}`);
console.log(`  台账 → ${outFile.pathname}`);
