/**
 * EP14-S2 · 主界面总星数显示（R6/R8 显示腿，沿立项号 WXG-T-288）
 * ─────────────────────────────────────────────────────────────────────────────
 * 判据真源（⛔ 本文件零新判据）：
 *  - `games/beads/design/proposals/star-collect-rule.md` **R6**：总星数 = Σ 各关**历史最高**星
 *    （`starsByLevel` 零改动）；重玩刷出不比历史更高的星 ⇒ 总数不涨（防无限肝）；
 *  - 同文 **R8**：主界面显示总星数（新增 UI 位，落位与分母 `[待 UX 批]` ⇒ 本批按 Story 口径走 `★n` 最小臂，
 *    ⛔ 不自造 `/27` 分母，那随 EP14-S4 / §6-T1 定）；
 *  - `design/gdd/score-combo.md §2`（v1.78 行）「总星数 = Σ 各关历史最高（`starsByLevel` 零改动）」；
 *  - 控制清单 **L5** + 热路径零分配：数值只在快照构造里算，`update` 不 new/不 map。
 *
 * Story 的 DoD 三条 = 快照只读 + 零分配 + 数值 = Σ 最高（含「重玩不超历史则不涨」反例臂）。
 * ⚠ 口径登记：`meta-ui` / `score-combo` 的 §8 无「总星数显示」专条 ⇒ 判据取 §2 行 + R6/R8，
 *   本批不新增 §8 条目（新增属设计轨）。
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { createBeadsHarness, placeColor, simpleTestLevel } from './helpers';
import { HUD_BAND } from '../src/config/tuning.js';
import type { BeadsGame } from '../src/game/beads-game.js';
import type { Harness } from './helpers';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = (rel: string): string => readFileSync(resolve(ROOT, '..', 'src', rel), 'utf8');

/** 逐格正填整盘（逐字复用 `stars-tier.test.ts` 判例；用时 ≈ 已 advance 秒数）。 */
function fillBoard(game: BeadsGame): void {
    for (let row = 0; row < game.grid.rows; row++) {
        for (let col = 0; col < game.grid.cols; col++) {
            if (!game.grid.isFillable(row, col)) continue;
            placeColor(game, game.grid.requiredColor(row, col), row, col);
        }
    }
}

const LEVELS = [simpleTestLevel(), simpleTestLevel({ id: 91 })];

function harness(saveKey: string, storage?: Harness['storage']): Harness {
    return createBeadsHarness({ noAssemble: true, levels: LEVELS, saveKey, storage });
}

const textsOf = (game: BeadsGame): readonly DrawCommand[] => {
    const b = new RenderModelBuilder(750, 1334);
    b.begin();
    game.buildRenderModel(b);
    return b.end().commands;
};
const starText = (game: BeadsGame): Extract<DrawCommand, { kind: 'text' }> | undefined =>
    textsOf(game).find(
        (c): c is Extract<DrawCommand, { kind: 'text' }> => c.kind === 'text' && /^★\d+$/.test(c.text),
    );

describe('EP14-S2 总星数快照与 HUD（R6/R8）', () => {
    it('新开档 = 0★，HUD 画 `★0`，且快照对象身份跨帧不变（L5 只读、不新建）', () => {
        const h = harness('wxgame.beads.test.stars-total.fresh');
        expect(h.game.snapshot.starsTotal).toBe(0);
        const t = starText(h.game);
        expect(t?.text).toBe('★0');
        // 连续两帧：同一快照引用（视图只读消费，⛔ 不逐帧新建）。
        h.game.buildRenderModel(new RenderModelBuilder(750, 1334));
        expect(h.game.snapshot).toBe(h.game.snapshot);
    });

    it('Σ 各关历史最高：两关各 3★ ⇒ 总数 6，HUD 同值', () => {
        const h = harness('wxgame.beads.test.stars-total.sum');
        fillBoard(h.game);
        expect(h.game.phase).toBe('level-clear');
        expect(h.game.snapshot.starsTotal).toBe(3);
        h.game.goToLevel(1);
        fillBoard(h.game);
        expect(h.game.snapshot.starsTotal).toBe(6);
        expect(starText(h.game)?.text).toBe('★6');
    });

    it('重玩刷出更低星 ⇒ 总数不涨（R6 反例臂，防无限肝）', () => {
        const key = 'wxgame.beads.test.stars-total.nogrow';
        const h1 = harness(key);
        fillBoard(h1.game); // 快通 ⇒ 3★（当场跳档，R1）
        expect(h1.game.snapshot.starsTotal).toBe(3);
        expect(h1.game.starsByLevelRaw[0]).toBe(3);

        // 同档重进：历史最高 3 ⇒ 进场档封顶 3★（时钟 300，线 210/255/300）。
        const h2 = harness(key, h1.storage);
        expect(h2.game.snapshot.starsTotal).toBe(3); // 重开即从存档派生
        h2.game.goToLevel(0); // 显式重玩 L1（重开后默认停在已解锁的下一关，不回到 L1 就测不到「同关不涨」）
        for (let i = 0; i < 440; i++) h2.advance(0.5); // 耗 220s > 2★ 线 210 ⇒ 判 2★
        fillBoard(h2.game);
        expect(h2.game.starsByLevelRaw[0], '本局 2★ 不覆盖历史 3★').toBe(3);
        expect(h2.game.starsByLevelRaw[1], '未碰过的 L2 仍 0★').toBe(0);
        expect(h2.game.snapshot.starsTotal, '重玩更低星 ⇒ 总数不动').toBe(3);
        expect(starText(h2.game)?.text).toBe('★3');
    });

    it('落位：星数位住顶栏带内、且不压左齿轮热区（x ≥ 120）', () => {
        const h = harness('wxgame.beads.test.stars-total.placement');
        const t = starText(h.game)!;
        expect(t.y).toBeGreaterThanOrEqual(HUD_BAND.yMin);
        expect(t.y).toBeLessThanOrEqual(HUD_BAND.yMax);
        expect(t.x).toBeGreaterThanOrEqual(120); // 齿轮 Ø48 + 88² 热区止于 x ≈ 104（view-model F7②）
    });
});

describe('EP14-S2 热路径零分配（L5 / 控制清单）', () => {
    it('快照同步段内求和只用累加变量，无 map/filter/reduce/展开语法', () => {
        const src = SRC('game/beads-game.ts');
        const at = src.indexOf('private _syncSnapshot');
        expect(at).toBeGreaterThan(0);
        const body = src.slice(at, src.indexOf('\n  }', at));
        expect(body, 'starsTotal 求和不得新建数组/迭代器').not.toMatch(/\.map\(|\.filter\(|\.reduce\(|\[\s*\.\.\./);
        expect(body).toContain('starsTotal');
    });
});
