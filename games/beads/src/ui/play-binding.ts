/**
 * 对局页的视图绑定（组装层，WXG-T-420 T9）。
 *
 * 立单判据 = `docs/architecture/beads-arch-review-2026-10-26.md` §6 T9：「`buildBeadsView`
 * 绑定上移到壳/组装层，Game 只出快照 ⇒ **Node 下不加载 view 也能跑玩法测试**」。
 *
 * 拆分前 `BeadsGame.buildRenderModel` 一人干两件事：① 把权威态投影进快照（game 的本职）、
 * ② 直调渲染门面 `view/view-model.ts`（view 的本职）。② 让 `game/` 对 `view/` 的运行时边
 * 把**整条渲染链**（实测闭包 20 个视图模块）挂进了玩法侧的模块图 ⇒ 任何读玩法的 Node 用例
 * 都得先把视图层装进来。本模块只接走 ②：Game 到此不再知道「怎么画」，只出快照。
 *
 * 依赖方向：`ui/`（组装层）→ `view/` 是**正向消费**；`game/` 侧的两条运行时边
 * （`-> view/view-model.ts`、`-> view/palette.ts` 的 `beadInksFor`）就此摘除 ⇒
 * `check:arch` L6 的登记集只减不增（`tools/scripts/check-architecture.mjs`）。
 * 读侧只声明**结构面**（⛔ 不 import `BeadsGame`，免得 game ↔ ui 成运行时环）。
 *
 * 逐字节一致：本函数体与原 `buildRenderModel` 的调用同序同参（读 `play.snapshot` 即原地
 * 投影，`beadInksFor` 走 WeakMap 缓存 ⇒ 热路径零分配）；判据回 `tests/ui-golden*.test.ts` 十态。
 */

import type { RenderModelBuilder } from '@wxgame/framework';

import { beadInksFor, type BeadsPalette } from '../view/palette.js';
import { buildBeadsView } from '../view/view-model.js';
import type { BeadsSnapshot } from '../game/state.js';
import type { BeadsLevelRaw } from '../config/levels-data.js';

/** 绑定所需的最小读取面（`BeadsGame` 结构上满足 ⇒ 视图参数全部来自权威态投影）。 */
export interface PlayRenderSource {
    /** 只读快照：**读即投影**（getter 内部走 `projectSnapshot`，⛔ 视图不读游戏对象）。 */
    readonly snapshot: Readonly<BeadsSnapshot>;
    /** 当前渲染令牌集（换肤 = 换引用，真源在 game 的皮肤/设置侧）。 */
    readonly palette: BeadsPalette;
    /** 当前关卡原始数据（珠色墨水组 v1.40 按关解析）。 */
    readonly currentLevel: BeadsLevelRaw;
}

/** 对局页本帧的绘制入口：快照 → 门面 → 指令流（壳的对局腿与玩法侧测试共用）。 */
export function renderPlayPage(play: PlayRenderSource, builder: RenderModelBuilder): void {
    buildBeadsView(builder, play.snapshot, play.palette, beadInksFor(play.currentLevel));
}
