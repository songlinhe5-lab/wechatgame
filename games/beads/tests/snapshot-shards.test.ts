/**
 * 快照分片体检（WXG-T-420 T8）。
 *
 * 判据 = `docs/architecture/beads-arch-review-2026-10-26.md` §6 T8 行（快照分片
 * 对局/面板/菜单/调试 + 预分配子对象；渲染指令逐字节一致；热路径分配不升）。
 * 本单**不**把投影逐行复制成第二份真源（K-042 / K-152），只立四条独立不变量：
 *   ① 契约 ↔ 分片同构：`createSnapshot` 的键全集与五张清单互为镜像（每字段恰好一片）；
 *   ② 阳性对照：合成「漏登记 / 双登记 / 陈旧字段」三种病态都能被同一函数当场报出
 *      （K-144：只测「真的通过」不足以证明体检有效）；
 *   ③ 写出面纯度 + 完备性：每个片投影函数（含 `FeedbackFx.writeSnapshot`）**只写本片
 *      字段**，且本片字段除构造期常量外**都被写出** ⇒ 「加一个字段动四层」变「动一层」；
 *   ④ 热路径分配不升：跨帧稳定缓冲同实例（T8 新增：无进珠动画时 `trayLand*` 亦同实例，
 *      原逐帧 `[]` 已改共享空数组）。
 * 端到端逐字段值与渲染指令仍由既有 `ui-golden`（十态对拍）+ `view-model` / `play-page`
 * 等 20+ 读 `game.snapshot` 的用例集体守 ⇒ 本单只补「分片」这一新契约的机械证据。
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSnapshot } from '../src/game/state.js';
import {
    inspectShardCoverage,
    FX_SHARD_FIELDS,
    MENU_SHARD_FIELDS,
    PANEL_SHARD_FIELDS,
    PLAY_SHARD_FIELDS,
    DEBUG_SHARD_FIELDS,
    SNAPSHOT_SHARDS,
    type SnapshotFx,
    type SnapshotPlay,
} from '../src/game/snapshot-shards.js';
import { DEFAULT_TUNING } from '../src/config/tuning.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = (rel: string): string => readFileSync(resolve(ROOT, '..', 'src', rel), 'utf8');

/** 空盘起一局 6×5 测试关（与 T6 投影对拍同局面）。 */
function booted(): Harness {
    return createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel({ id: 91 })] });
}

/**
 * 取**定义处**起的花括号配对函数体（顶层函数与类方法同口径：`projectPlayShard` / `writeSnapshot`）。
 * 只认定义行（含 `name(` 且行末是 `{`）——⛔ 直接 `indexOf('name(')` 会先命中调用点
 *（如分片调度里的那五行），取到隔壁片体 ⇒ 纯度与完备性两条腿一起假红。
 * 找不到就抛：五段任一改名 ⇒ 断言腿当场炸，⛔ 静默跳过（K-152）。
 */
function fnBody(file: string, name: string): string {
    const lines = SRC(file).split('\n');
    const lineIndex = lines.findIndex((l) => l.includes(`${name}(`) && l.trimEnd().endsWith('{'));
    if (lineIndex < 0) throw new Error(`函数定义未找到：${file}::${name}`);
    const at = lines.slice(0, lineIndex).join('\n').length + 1;
    const src = lines.join('\n');
    const open = src.indexOf('{', at + name.length);
    if (open < 0) throw new Error(`函数体未起始：${file}::${name}`);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return src.slice(at, i + 1);
        }
    }
    throw new Error(`函数体未闭合：${file}::${name}`);
}

/** 抽出函数体内被**写**的快照字段名（`s.foo =` / `s.foo.bar =` / `s.foo[i] =`，⛔ `==` 比较）。 */
function writtenFields(body: string): string[] {
    const out = new Set<string>();
    for (const m of body.matchAll(/\bs\.([A-Za-z0-9_]+)(?:\.[A-Za-z0-9_]+|\[[^\]]*\])?\s*=(?!=)/g)) {
        out.add(m[1]!);
    }
    return [...out];
}

/** 各片的写出来源（特效片由协作类 `FeedbackFx.writeSnapshot` 承接，T6 既有分工）。 */
const SHARD_SOURCES = {
    play: [['game/beads-game/snapshot-projection.ts', 'projectPlayShard']],
    panel: [['game/beads-game/snapshot-projection.ts', 'projectPanelShard']],
    menu: [['game/beads-game/snapshot-projection.ts', 'projectMenuShard']],
    debug: [['game/beads-game/snapshot-projection.ts', 'projectDebugShard']],
    fx: [
        ['game/beads-game/snapshot-projection.ts', 'projectFxShard'],
        ['game/beads-game/feedback-fx.ts', 'writeSnapshot'],
    ],
} as const;

/** 只在构造期注入、投影恒不写的字段（有理由才登记，⛔ 用它掩盖漏写）。 */
const CONSTRUCT_ONLY_FIELDS = new Set(['tuning']);

describe('WXG-T-420 T8 · 快照分片契约（同构 / 纯度 / 完备性 / 零重分配）', () => {
    const contractKeys = Object.keys(createSnapshot(DEFAULT_TUNING));

    it('① 五张清单与契约键集同构（无漏登记、无双登记、无陈旧字段）', () => {
        const report = inspectShardCoverage(contractKeys);
        expect(report.missing, `未登记的字段：${report.missing.join(', ')}`).toEqual([]);
        expect(report.duplicated, `归属未定的字段：${report.duplicated.join(', ')}`).toEqual([]);
        expect(report.unknown, `契约里不存在的字段：${report.unknown.join(', ')}`).toEqual([]);
        expect(report.ok).toBe(true);
    });

    it('① 字段数对账：五片之和 = 契约键数（每字段恰好一片的等价表述）', () => {
        const summed =
            PLAY_SHARD_FIELDS.length + PANEL_SHARD_FIELDS.length + MENU_SHARD_FIELDS.length +
            DEBUG_SHARD_FIELDS.length + FX_SHARD_FIELDS.length;
        expect(summed).toBe(contractKeys.length);
        expect(new Set(contractKeys).size).toBe(contractKeys.length); // 前置：契约本身无重复键
    });

    it('② 阳性对照 · 合成病态（漏登记 / 双登记 / 陈旧）都能被报出（K-144）', () => {
        const keys = ['a', 'b', 'c'];
        expect(inspectShardCoverage(keys, { one: ['a', 'b'] }).missing).toEqual(['c']);
        expect(inspectShardCoverage(keys, { one: ['a'], two: ['b', 'c', 'a'] }).duplicated).toEqual(['a']);
        expect(inspectShardCoverage(keys, { one: ['a', 'b', 'c', 'ghost'] }).unknown).toEqual(['ghost']);
        // 反向对照：健康清单不报任何病 ⇒ 上面三条红不是「恒红」。
        expect(inspectShardCoverage(keys, { one: ['a'], two: ['b', 'c'] }).ok).toBe(true);
    });

    it('③ 写出面纯度 · 每个片投影函数只写本片字段（越片 = 红）', () => {
        for (const [shard, sources] of Object.entries(SHARD_SOURCES)) {
            const owned = new Set<string>(SNAPSHOT_SHARDS[shard as keyof typeof SNAPSHOT_SHARDS]);
            const writes = sources.flatMap(([file, name]) => writtenFields(fnBody(file, name)));
            expect(writes.length, `${shard} 片投影没写到任何字段 ⇒ 提取腿失效`).toBeGreaterThan(0);
            const foreign = writes.filter((f) => !owned.has(f));
            expect(foreign, `${shard} 片投影越片写了：${foreign.join(', ')}`).toEqual([]);
        }
    });

    it('③ 写出面完备性 · 本片字段都被投影触达（漏写 = 红，构造期常量除外）', () => {
        for (const [shard, sources] of Object.entries(SHARD_SOURCES)) {
            const owned = new Set<string>(SNAPSHOT_SHARDS[shard as keyof typeof SNAPSHOT_SHARDS]);
            const writes = new Set(sources.flatMap(([file, name]) => writtenFields(fnBody(file, name))));
            const neverWritten = [...owned].filter((f) => !writes.has(f) && !CONSTRUCT_ONLY_FIELDS.has(f));
            expect(neverWritten, `${shard} 片字段无人写：${neverWritten.join(', ')}`).toEqual([]);
        }
    });

    it('③ 调度接线 · projectSnapshot 按对局→面板→菜单→调试→特效顺序委派五片', () => {
        const body = fnBody('game/beads-game/snapshot-projection.ts', 'projectSnapshot');
        const order = ['projectPlayShard', 'projectPanelShard', 'projectMenuShard', 'projectDebugShard', 'projectFxShard'];
        let cursor = -1;
        for (const name of order) {
            const at = body.indexOf(`${name}(s, src);`);
            expect(at, `调度缺腿：${name}`).toBeGreaterThan(cursor);
            cursor = at;
        }
    });

    it('③ 分片面即读侧最小可见面 · 整份快照可直接赋给任一分片', () => {
        const snap = booted().game.snapshot;
        // 结构子类型 ⇒ 消费方按需窄化（编译期只看见该片字段，运行期同一对象、零拷贝）。
        const play: SnapshotPlay = snap;
        const fx: SnapshotFx = snap;
        expect(typeof play.phase).toBe('string');
        expect(play.gridRows).toBe(5);
        expect(fx.deniedCount).toBe(0);
        expect(fx.deniedRows.length).toBeGreaterThan(0);
    });

    it('④ 热路径零重分配 · 跨帧稳定缓冲同实例（含 T8 新增的 trayLand 共享空数组）', () => {
        const h = booted();
        h.advance(1); // 先跑一帧：trayLand / finishStars 缓冲已由所属片写过
        const first = h.game.snapshot;
        const trayLandSlots = first.trayLandSlots;
        const trayLandSteps = first.trayLandSteps;
        const finishStars = first.finishStars;
        expect(trayLandSlots.length).toBe(0); // 前置：无进珠动画 ⇒ 走共享空数组腿
        expect(finishStars.length).toBe(1); // 前置：关卡数已落缓冲 ⇒ 下面才是「不重建」腿
        h.advance(2);
        const again = h.game.snapshot;
        expect(again).toBe(first);
        expect(again.trayLandSlots).toBe(trayLandSlots); // 原逐帧 `: []` ⇒ 现同实例
        expect(again.trayLandSteps).toBe(trayLandSteps);
        expect(again.finishStars).toBe(finishStars); // 关卡数未变 ⇒ 缓冲不重建
    });

    it('④ 逐片预分配 · createSnapshot 合并五片初始值且键序稳定', () => {
        const a = createSnapshot(DEFAULT_TUNING);
        const b = createSnapshot(DEFAULT_TUNING);
        expect(Object.keys(a)).toEqual(Object.keys(b)); // 同形状 ⇒ 逐帧键集差分不引入新键
        expect(a.boardGroupRows.length).toBe(64);
        expect(a.solverLandRows.length).toBeGreaterThan(a.solverCellRows.length); // 定长槽按片预分配
        expect(a.trayLandSlots).not.toBe(b.trayLandSlots); // 实例之间不共用缓冲
    });
});
