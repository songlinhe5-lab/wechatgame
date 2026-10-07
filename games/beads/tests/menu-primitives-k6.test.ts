/**
 * **[EP12-S6 · T-2B]** K-6 菜单帧图元实测判据套（WXG-T-269-S6 子单 T-2B / Deliverable 4 + 5）。
 * ─────────────────────────────────────────────────────────────────────────────
 * 真源：`risks.md` **K-6**（菜单帧图元 +N 的性能敞口）；`design/proposals/ui-style-redesign/screens.md`
 * S0 **§42 约束⑤**（⛔ 不进 playing `buildRenderModel` 盘面/托盘命令流）；
 * `production/epics/epics-beads-ep12.md` §73–§78（验收④「实测差分 / 封箱复评」）。
 *
 * ## 本套的存在理由（⛔ 禁纸面值，判例 K-051）
 * `risks.md` 里「菜单帧 +77~115 图元」是**推算**。本套不搬那个数：所有 Δ 都由**同帧两次真跑相减**得出
 * （与取数脚本共用 `menu-primitives-lib.ts` ⇒ K-042 真源单一），并另设**反例臂**证明结构自证真的会炸
 * （不是恒绿的门）。checked-in 台账 `__fixtures__/wxg-t-269-s6-k6-ledger.json` 同时是**回归门**：
 * 谁改了菜单版面（图元数漂移）而未重取台账并经主理人批准，这里先红。
 *
 * 复跑取数：
 * ```
 * WXG269_CAPTURE=<tag> WXG269_SOURCE_REV=$(git rev-parse HEAD) WXG269_SOURCE_DESC='…' \
 * node --experimental-transform-types --import=./tools/scripts/lib/ts-js-resolve.mjs \
 *      games/beads/tests/menu-primitives-capture.ts
 * ```
 *
 * 层级：tests（⛔ 不写业务状态；菜单帧经公开链路 `shell.buildRenderModel` 取）。
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type RenderModel } from '@wxgame/framework';
import {
    BEAD_STYLE_MAX_COMMANDS,
    DESIGN_H,
    DESIGN_W,
    SIGN_BEAD_PITCH,
    SIGN_MATRIX_N,
    THUMB_MATRIX_N,
    WALL_ROWS,
} from '../src/config/tuning.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { buildMetaView } from '../src/view/meta-view.js';
import { drawFilledBead } from '../src/view/bead-render.js';
import { levelThumbBeads } from '../src/view/menu-signage.js';
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

const LEDGER_FIXTURE = '__fixtures__/wxg-t-269-s6-k6-ledger.json';
const SEAL_FIXTURE = '__fixtures__/wxg-t-211-s3-seal.json';
const readJson = <T>(path: string): T =>
    JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

interface LegReading extends PrimitiveCount {
    readonly label: string;
    readonly variant: object | null;
    readonly note: string;
}
type LegTable = Record<string, LegReading>;
interface Ledger {
    frames: Record<MenuRigState, LegTable>;
    diffs: Record<MenuRigState, Record<string, { total: number; beads: number; kinds: Record<string, number> }>>;
    playingSeal: { keys: { key: string; now: number | string; base: number | string }[]; allMatch: boolean };
    tiers: {
        adopted: { n: number; d: number };
        tiers: { n: number; d: number; totalW: number; okUnderB: boolean }[];
    };
}
interface SealFixture {
    fixture: { frame: { cols: number; rows: number; pattern: string; filled: number; noAssemble: boolean } };
    s3: { frame0: { total: number; sha: string }; frame78: { total: number; sha: string } };
}

const LEDGER = readJson<Ledger>(LEDGER_FIXTURE);
const SEAL = readJson<SealFixture>(SEAL_FIXTURE);

/** 现算一态全腿（与台账同一实现 ⇒ 对撞有意义，⛔ 不是抄台账）。 */
function liveLegTable(state: MenuRigState): LegTable {
    const shell = createMenuShell(state);
    const out: LegTable = {};
    for (const leg of CAPTURE_LEGS) {
        out[leg.label] = { ...countPrimitives(menuModel(shell, leg.variant ?? undefined)), label: leg.label, variant: leg.variant, note: leg.note };
    }
    return out;
}

const LIVE: Record<MenuRigState, LegTable> = { full: liveLegTable('full'), first: liveLegTable('first') };

/** 只比对读数四元组（`variant/note` 是档案文本，漂移不该红）。 */
const numbers = (r: LegReading): PrimitiveCount => ({ total: r.total, kinds: r.kinds, beads: r.beads, sha: r.sha });

describe('[T-2B][K-6] 差分腿与生产腿同源（⛔ 测试侧不复算陈列序）', () => {
    it('不传 variant ≡ 传默认值 ⇒ 整帧 sha 等（差分只换三个形参，数据同源）', () => {
        const shell = createMenuShell('full');
        const viaShell = countPrimitives(menuModel(shell));
        const viaView = countPrimitives(menuModel(shell, DEFAULT_EXPLICIT));
        expect(viaView.sha).toBe(viaShell.sha);
        expect(viaView.total).toBe(viaShell.total);
    });

    it('L4：同进程两遍取数全等；L5：视图对同一 data 二次调用输出全等', () => {
        expect(liveLegTable('full')).toEqual(LIVE.full);
        expect(liveLegTable('first')).toEqual(LIVE.first);
        const shell = createMenuShell('full');
        const data = viewDataOf(shell);
        const paint = (): string => {
            const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
            builder.begin();
            buildMetaView(builder, data, shell.play.palette, DEFAULT_EXPLICIT);
            return countPrimitives(builder.end()).sha;
        };
        expect(paint()).toBe(paint());
        expect(paint()).toBe(countPrimitives(menuModel(shell)).sha);
    });

    it('台账读数 ≡ 现算（checked-in 件是回归门，⛔ 不只是档案）', () => {
        for (const state of ['full', 'first'] as const) {
            for (const leg of CAPTURE_LEGS) {
                expect(numbers(LIVE[state][leg.label]!), `${state}/${leg.label}`).toEqual(numbers(LEDGER.frames[state][leg.label]!));
            }
        }
    });
});

describe('[T-2B][K-6] Δ 招牌 beadText = 「图元 +N」的实测断言（验收④）', () => {
    for (const state of ['full', 'first'] as const) {
        it(`state=${state}：Δ(production − signage.off) ≡ 位表自算珠数 × ${BEAD_STYLE_MAX_COMMANDS}，且增量是**纯珠体族**`, () => {
            const prod = LIVE[state]['production']!;
            const off = LIVE[state]['signage.off']!;
            const dBeads = prod.beads - off.beads;
            expect(dBeads, 'Δ 珠数 ≡ 位表自算').toBe(SIGN_BEADS_FROM_GLYPHS);
            expect(prod.total - off.total, 'Δ 命令 ≡ 珠数 × 系数').toBe(SIGN_COMMANDS_FROM_GLYPHS);
            expect(dBeads * BEAD_STYLE_MAX_COMMANDS).toBe(prod.total - off.total);
            // 增量族闭于珠体三族 ⇒ 系统字体标题腿确实**退场**（不是与珠拼叠加）。
            expect(prod.kinds['text'] ?? 0, 'text 族零增量').toBe(off.kinds['text'] ?? 0);
            expect(prod.kinds['line'] ?? 0, 'line 族零增量').toBe(off.kinds['line'] ?? 0);
            expect(prod.kinds['rect']! - off.kinds['rect']!, 'plate').toBe(dBeads);
            expect(prod.kinds['circle']! - off.kinds['circle']!, '同心孔两枚').toBe(dBeads * 2);
            expect(prod.kinds['polygon']! - off.kinds['polygon']!, '四棱扇').toBe(dBeads * 4);
            expect(LEDGER.diffs[state].signage).toEqual({ total: prod.total - off.total, beads: dBeads, kinds: {
                rect: dBeads, circle: dBeads * 2, polygon: dBeads * 4,
            } });
        });
    }

    it('满载菜单帧的缩略珠数 ≡ 九关聚合表求和 ⇒ beads 读数不是另一套账', () => {
        const expected = LEVELS.reduce((sum, lv) => sum + levelThumbBeads(lv, THUMB_MATRIX_N), 0);
        const prod = LIVE.full['production']!;
        expect(prod.beads - SIGN_BEADS_FROM_GLYPHS, 'production 珠数 − 招牌珠数 = 缩略珠数').toBe(expected);
        expect(LIVE.full['signage.off']!.beads, 'signage.off 只剩缩略珠').toBe(expected);
    });
});

describe('[T-2B][K-6] 五级回退杠杆的差分单调（T-1 §3.8）', () => {
    it('缩略 5→4→3：珠数与命令**逐级严格下降**（两态皆然），且不污染文字/线族', () => {
        for (const state of ['full', 'first'] as const) {
            const t = LIVE[state];
            const prod = t['production']!;
            const n4 = t['thumb.n4']!;
            const n3 = t['thumb.n3']!;
            expect(prod.beads).toBeGreaterThan(n4.beads);
            expect(n4.beads).toBeGreaterThan(n3.beads);
            expect(prod.total).toBeGreaterThan(n4.total);
            expect(n4.total).toBeGreaterThan(n3.total);
            expect(prod.kinds['text'], '换缩略档不动 text 族').toBe(n4.kinds['text']);
            expect(prod.kinds['line'], '换缩略档不动 line 族').toBe(n4.kinds['line']);
            const d = prod.total - n3.total;
            expect(d).toBe((prod.beads - n3.beads) * BEAD_STYLE_MAX_COMMANDS);
            expect(d).toBe(LEDGER.diffs[state].thumb5to3!.total);
        }
    });

    it('陈列格 3→2 行：命令下降；**首日态**（仅 1 关有珠）的 Δ 只落 `line`（虚线空槽）族', () => {
        const prodFull = LIVE.full['production']!;
        const rows2Full = LIVE.full['wall.rows2']!;
        expect(prodFull.total).toBeGreaterThan(rows2Full.total);
        expect(prodFull.total - rows2Full.total).toBe(LEDGER.diffs.full.wallRows!.total);

        const prod = LIVE.first['production']!;
        const rows2 = LIVE.first['wall.rows2']!;
        const beadKinds = ['text', 'rect', 'circle', 'polygon'] as const;
        for (const k of beadKinds) expect(prod.kinds[k]! - rows2.kinds[k]!, `${k} 族应零增量`).toBe(0);
        expect(prod.total - rows2.total, '首日 Δ ≡ line 族减量').toBe(prod.kinds['line']! - rows2.kinds['line']!);
        expect(prod.total - rows2.total).toBe(LEDGER.diffs.first.wallRows!.total);
    });

    it('全回落地板（招牌 off + 2 行 + 3 档）≪ 生产档 ⇒ 杠杆确有可退空间', () => {
        const prod = LIVE.full['production']!;
        const floor = LIVE.full['floor.allOff']!;
        expect(floor.total).toBeLessThan(prod.total);
        expect(floor.beads).toBeLessThan(prod.beads);
        expect(prod.total - floor.total).toBe(LEDGER.diffs.full.allVsFloor!.total);
    });
});

describe('[T-2B][K-6] 验收③ 珠距档读数（真几何口径 B）', () => {
    it('8 / 10 / 12 三档：`5.5·n·d` 恒等、`n·d = 120` 不变式；10@12 过地板、12@10 破地板', () => {
        const rows = LEDGER.tiers.tiers;
        expect(rows.map((r) => r.n)).toEqual([8, 10, 12]);
        for (const r of rows) {
            expect(r.totalW).toBe(5.5 * r.n * r.d);
            expect(r.n * r.d).toBe(SIGN_MATRIX_N * SIGN_BEAD_PITCH); // 不变式 = 现装 120
        }
        expect(rows.find((r) => r.n === 10)!.okUnderB).toBe(true);
        expect(rows.find((r) => r.n === 12)!.okUnderB, '12×12 在口径 B 下破地板 ⇒ 不做该档').toBe(false);
        expect({ n: LEDGER.tiers.adopted.n, d: LEDGER.tiers.adopted.d }).toEqual({ n: SIGN_MATRIX_N, d: SIGN_BEAD_PITCH });
    });
});

describe('[T-2B][S0 ⑤] playing 封箱复评：珠拼/缩略未渗进盘面命令流', () => {
    it('playing 四键（frame0/frame78 的 total + sha）≡ 封箱基准，逐字节 MATCH', () => {
        const f = SEAL.fixture.frame;
        const level = simpleTestLevel({
            cols: f.cols,
            rows: f.rows,
            pattern: Array.from({ length: f.rows }, () => f.pattern.split(' × ')[0]!),
        });
        const frameOf = (harness: ReturnType<typeof createBeadsHarness>): RenderModel => {
            const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
            builder.begin();
            buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
            return builder.end();
        };
        const empty = createBeadsHarness({ noAssemble: f.noAssemble, levels: [level], saveKey: 'wxgame.beads.test.t269s6.k6-frame0' });
        const half = createBeadsHarness({ noAssemble: f.noAssemble, levels: [level], saveKey: 'wxgame.beads.test.t269s6.k6-frame78' });
        let filled = 0;
        for (let row = 0; row < Math.round(f.filled / f.cols); row++) {
            for (let col = 0; col < f.cols; col++) {
                if (placeColor(half.game, half.game.grid.requiredColor(row, col), row, col)) filled++;
            }
        }
        expect(filled, '夹具填充数须与封箱件登记一致').toBe(f.filled);
        const frame0 = countFrame(frameOf(empty));
        const frame78 = countFrame(frameOf(half));
        expect(frame0.total).toBe(SEAL.s3.frame0.total);
        expect(frame0.sha).toBe(SEAL.s3.frame0.sha);
        expect(frame78.total).toBe(SEAL.s3.frame78.total);
        expect(frame78.sha).toBe(SEAL.s3.frame78.sha);
    });

    it('台账的 playing 复取腿自证 MATCH（同一份取证件的两处读数不得互相打脸）', () => {
        expect(LEDGER.playingSeal.allMatch).toBe(true);
        for (const k of LEDGER.playingSeal.keys) expect(String(k.now), k.key).toBe(String(k.base));
    });

    it('import 图静态门：`menu-signage` 只被菜单视图引用，玩法侧零引用（L5 / §42⑤）', () => {
        const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
        for (const path of ['../src/view/view-model.ts', '../src/view/bead-render.ts', '../src/game/beads-shell.ts', '../src/game/beads-game.ts']) {
            expect(read(path).includes('menu-signage'), `${path} 不得引用 menu-signage`).toBe(false);
        }
        expect(read('../src/view/meta-view.ts').includes('menu-signage'), '装配点在菜单视图').toBe(true);
    });

    it('菜单帧图元族闭于五族且无 blit（S0 约束①）', () => {
        const prod = LIVE.full['production']!;
        expect(Object.keys(prod.kinds).sort()).toEqual(['circle', 'line', 'polygon', 'rect', 'text']);
        expect(prod.kinds['blit']).toBeUndefined();
    });

    it('反例臂：结构自证真的会炸（奇数 `circle`）⇒ 门非恒绿；真帧过得去 ⇒ 红在结构不在形式', () => {
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        drawFilledBead(builder, 100, 100, 1, { size: 20, inks: DEMO_BEAD_INKS });
        builder.circle(300, 300, 4, { fill: DEFAULT_PALETTE.text }); // 混入非珠圆 ⇒ 圆数变奇
        const polluted = builder.end();
        expect(() => countPrimitives(polluted)).toThrow();
        expect(() => countPrimitives(menuModel(createMenuShell('first'), { signage: true, wallRows: WALL_ROWS, thumbN: THUMB_MATRIX_N }))).not.toThrow();
        // playing 帧**不走**菜单结构自证（含非珠 polygon）⇒ 裸计数腿可用，口径不串。
        expect(() => countFrame(polluted)).not.toThrow();
    });
});

describe('[T-2B][K-6] 成本读数（供 epics 状态行引用，⛔ 不引纸面值）', () => {
    it('菜单满载帧 / 玩法 78 填帧 ≈ 1.37×（主理人「接受 5×5 直接落码」的实测复核）', () => {
        const menu = LIVE.full['production']!.total;
        const play = SEAL.s3.frame78.total;
        const ratio = menu / play;
        expect(ratio).toBeGreaterThan(1.3);
        expect(ratio).toBeLessThan(1.45);
        expect(menu).toBe(LEDGER.frames.full['production']!.total);
    });

    it('逐 kind 求和 ≡ 整帧 total（同一帧的两套读数不得分家）', () => {
        for (const state of ['full', 'first'] as const) {
            for (const leg of CAPTURE_LEGS) {
                const r = LIVE[state][leg.label]!;
                const sum = Object.values(r.kinds).reduce((a, b) => a + b, 0);
                expect(sum, `${state}/${leg.label} kinds 求和`).toBe(r.total);
            }
        }
        // 菜单帧非珠族只有 rect/line/text（珠体占去 circle/polygon）⇒ 上面的 1.37× 读数口径可靠。
        const prod = LIVE.full['production']!;
        const nonBeadRects = prod.kinds['rect']! - prod.beads;
        expect(nonBeadRects + prod.kinds['line']! + prod.kinds['text']! + prod.beads * BEAD_STYLE_MAX_COMMANDS).toBe(prod.total);
    });
});
