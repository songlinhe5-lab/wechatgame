/**
 * Game ⇏ View 解耦体检（WXG-T-420 T9）。
 *
 * 判据 = `docs/architecture/beads-arch-review-2026-10-26.md` §6 T9 行：
 * 「`buildBeadsView` 绑定上移到壳/组装层，Game 只出快照 ⇒ **Node 下不加载 view
 * 也能跑玩法测试**」。本单把这句判据落成**运行时可达性**断言：从 `game/beads-game.ts`
 * 出发，沿**非 type-only** 的相对 import / re-export 走一遍闭包，落点里
 * ⛔ 不得出现**绘制链**（门面 `view/view-model.ts`、页面 `play-page.ts`、图元
 * `bead-render.ts`、控件 `ui-widgets.ts`）；唯一登记例外是令牌表 `view/palette.ts`，
 * 理由见下方 `GAME_VIEW_ALLOWED`。
 *
 * 为什么测**传递闭包**而不是只测直接 import：`check:arch` L6 已逐条守直接边
 * （登记集只减不增）；但「跑玩法测试时 Node 实际加载了哪些文件」取决于闭包 ——
 * 中间层（如 `game/beads-game/feedback-fx.ts`）偷偷引 view 时，直接边看起来干净，
 * 玩法测试照样把渲染链装了进来。原 `view/combo-vfx.ts` 正是这条隐藏边
 *（纯逻辑、零绘制 ⇒ 本单归域到 `systems/`）。
 *
 * ⛔ 不复制被测真源（K-042 / K-152）：解析规则与 `tools/scripts/check-architecture.mjs`
 * 的 `beadImports` 同型（`import` / `export … from` + 剥注释 + `import type` 不算边），
 * 但**读的是 `src` 真文件**，图不由本文件手写；合成图只用于阳性对照（K-144）。
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const relOfPlain = (p: string): string => normalize(p).replace(/\\/g, '/');

/** src 相对路径（posix 风格、`.ts` 结尾），与 `check:arch` 的口径一致。 */
const relOf = (abs: string): string => relOfPlain(abs).replace(`${SRC}/`, '');

function listTs(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listTs(abs));
        else if (entry.name.endsWith('.ts')) out.push(relOf(abs));
    }
    return out;
}

const FILES = new Set(listTs(SRC));
const CACHE = new Map<string, string>();

function sourceOf(rel: string): string {
    let src = CACHE.get(rel);
    if (src === undefined) {
        src = readFileSync(resolve(SRC, rel), 'utf8');
        CACHE.set(rel, src);
    }
    return src;
}

/** 剥块注释与行注释（注释里的示例 import 不得算边）。 */
function stripComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** 一个源文的运行时出边（`import type` / `export type` 编译期擦除 ⇒ 不算边）。 */
function edgesFrom(rel: string, body: string): string[] {
    const dir = dirname(rel);
    const out: string[] = [];
    for (const match of stripComments(body).matchAll(/(?:^|\n)\s*(?:import|export)\s+([^;]+);/g)) {
        const statement = match[1]!.trim();
        if (/^type\b/.test(statement)) continue;
        const spec =
            statement.match(/\bfrom\s*['"](\.[^'"]+)['"]/) ?? statement.match(/^['"](\.[^'"]+)['"]/);
        if (!spec) continue; // 非相对（`@wxgame/framework` 等）不进本层图
        const target = relOfPlain(join(dir, spec[1]!)).replace(/\.js$/, '.ts');
        if (target.startsWith('../')) continue; // 走出 src 的相对边不算
        out.push(target);
    }
    return out;
}

const runtimeEdges = (rel: string): string[] => edgesFrom(rel, sourceOf(rel));

/** BFS：从 entry 出发的运行时可达集（含 entry 自身）。 */
function closure(entry: string, edges: (file: string) => string[]): string[] {
    const seen = new Set<string>([entry]);
    const queue = [entry];
    while (queue.length > 0) {
        const file = queue.shift()!;
        for (const next of edges(file)) {
            if (seen.has(next)) continue;
            seen.add(next);
            queue.push(next);
        }
    }
    return [...seen];
}

const realEdges = (file: string): string[] => (FILES.has(file) ? runtimeEdges(file) : []);
const viewOf = (files: string[]): string[] => files.filter((f) => f.startsWith('view/'));

/**
 * Game 侧**登记例外**：`config/skins/warm-paper.ts` 的暖纸肤令牌直引 `view/palette` 的
 * `DEFAULT_PALETTE`（数据表，非绘制），文件头已按 `arch.md` D1 判例裁定为皮肤系统的
 * 定向例外 ⇒ 令牌表归域（移出 `view/`）另开单，本单不搬运 31 个引用方。
 */
const GAME_VIEW_ALLOWED = ['view/palette.ts'];

describe('WXG-T-420 T9 · Game 运行时闭包不加载 view（Node 玩法测试判据）', () => {
    it('beads-game.ts 的闭包只余登记例外 —— 渲染门面已上移到组装层', () => {
        const reached = viewOf(closure('game/beads-game.ts', realEdges)).sort();
        expect(
            reached,
            `Game 侧新增加载了视图模块：${reached.filter((f) => !GAME_VIEW_ALLOWED.includes(f)).join(', ')}`,
        ).toEqual(GAME_VIEW_ALLOWED);
    });

    it('绘制链（门面 / 页面 / 图元 / 控件）对 Game 整片不可达', () => {
        const reached = new Set(closure('game/beads-game.ts', realEdges));
        const drawChain = [
            'view/view-model.ts',
            'view/play-page.ts',
            'view/bead-render.ts',
            'view/ui-widgets.ts',
        ];
        expect(drawChain.filter((f) => reached.has(f))).toEqual([]);
    });

    it('组装层确实持有门面边 —— 绑定只是上移，没有丢', () => {
        const reached = closure('ui/play-binding.ts', realEdges);
        expect(reached).toContain('view/view-model.ts');
        expect(reached).toContain('view/palette.ts');
    });

    it('壳的对局腿走组装层（不再经 play.buildRenderModel）', () => {
        const shell = stripComments(sourceOf('game/beads-shell.ts'));
        expect(shell).toContain('renderPlayPage(');
        expect(shell).not.toContain('this.play.buildRenderModel(');
    });

    it('combo-vfx 已从 view/ 归域 systems/（纯逻辑、零绘制 ⇒ Game 可直读）', () => {
        expect(FILES.has('systems/combo-vfx.ts')).toBe(true);
        expect(FILES.has('view/combo-vfx.ts')).toBe(false);
        expect(stripComments(sourceOf('systems/combo-vfx.ts'))).not.toMatch(/\bRenderModelBuilder\b/);
        expect(runtimeEdges('game/beads-game/feedback-fx.ts')).toContain('systems/combo-vfx.ts');
    });

    it('阳性对照 · 合成图：一条 game→view 运行时边就能被报出（K-144）', () => {
        const graph = new Map<string, string[]>([
            ['game/a.ts', ['game/b.ts']],
            ['game/b.ts', ['view/facade.ts']],
            ['view/facade.ts', []],
        ]);
        const edges = (file: string): string[] => graph.get(file) ?? [];
        expect(viewOf(closure('game/a.ts', edges))).toEqual(['view/facade.ts']);
        // 反向对照：同一 entry 换掉那条边就不报 ⇒ 上面的红不是「恒红」。
        graph.set('game/b.ts', ['systems/ok.ts']);
        expect(viewOf(closure('game/a.ts', edges))).toEqual([]);
    });

    it('阳性对照 · type-only 回边被擦除 ⇒ 不算加载（但改名成运行时边就报）', () => {
        const game = stripComments(sourceOf('game/beads-game.ts'));
        const typeLine = "import type { BeadsPalette } from '../view/palette.js';";
        // 渲染令牌类型仍以 type 进契约（`palette` 字段面不变），运行时无边。
        expect(game).toContain(typeLine);
        expect(viewOf(runtimeEdges('game/beads-game.ts'))).toEqual([]);
        // 同一行去掉 `type` ⇒ 同一个解析器必须把它当运行时边报出（否则「恒绿」）。
        const dirty = game.replace(typeLine, typeLine.replace('import type', 'import'));
        expect(viewOf(edgesFrom('game/beads-game.ts', dirty))).toEqual(['view/palette.ts']);
    });
});
