# beads · Epic/Story 状态时效声明（epics-beads 拆分件）

- **正本宿主**：`production/epics/epics-beads.md`（本块原为其顶部「⚠️ 状态时效声明」）
- **拆出缘由**：`epics-beads.md` 结构性贴 B 门（单文件 ≤8000 tokens）。据 `production/TASKS.md` backlog（WXG-T-066）standing 决定——「把顶部『状态时效声明』拆独立文件或按 Epic 拆文档；**不适用豁免、不得删信息凑体积**」——按 prescribed 方法抽出本件，原处留指针。本块**逐字保留、未删信息**。
- **对账口径**：`epics-beads.md` 的 Story 级标记**已过期**，一律以本声明为准（标记本身按原文保留，避免逐条改写引入新错）。

> ⚠️ **状态时效声明（2026-09-14，WXG-T-052 对账）**：本文档的 Story 级标记**已过期**，请以本声明为准，
> 标记本身按原文保留（避免逐条改写引入新错）：
>
> 1. **`[待 GDD §8]` 对 S6–S9 已全部解除** —— `design/gdd/` 下 `powerups.md`、`score-combo.md`、
>    `save-progress.md`、`pause-settings.md` **均已产出**（§0 阅读约定第 2 条的前提已消失）。
> 2. **`[Blocked: 待编辑器]`（EP-10）已不再是环境阻塞** —— Cocos Creator 3.8.8 已安装、预览与构建链
>    已实测跑通。
>    **⚠️ 证据引用修正（2026-09-14，WXG-T-082）**：本条此前引 `docs/engine-reference/cocos/VERSION.md` 作
>    「构建链已跑通」的证据，**结论对、证据错**——当时该文件开篇写的是「本轮开发环境**没有安装** Cocos
>    Creator 编辑器，因此无法编译、无法运行」，且 §2 能力清单 9 行全标「⚠️ 未验证」，**与结论相反**。
>    正确证据应为：① `tools/scripts/build-cocos.mjs` L51 硬编码 `/Applications/Cocos/Creator/3.8.8/`
>    且构建成功；② `memory/2026-09-14.md` L32「web-mobile 3.9s 构建成功」；③ `games/beads/cocos/README.md`
>    §1（工程已建、scene uuid 由编辑器生成）；④ **VERSION.md 本身已于 2026-09-14 据实修订**（开篇环境事实表
>    + §2 逐项⚠️→✅ + §5 补注），修订后才可作证据引用。
>    **同时修正：本条末尾「EP-10 的阻塞项变为**未立项建工程**」也已过时**——beads Cocos 工程已建
>    （`games/beads/cocos/assets/Main.scene` + `BeadsBootstrap.ts`，web-mobile 实测 17.1s 构建成功）。
>    **EP-10 当前的真实阻塞项是两条**：❶ 无微信开发者工具 + 无 AppID ⇒ 无真机预览/上传（环境阻塞，未解）；
>    ❷ **新登 P0：VERSION.md §3 G10**——Cocos 构建的 ES5 转译把 `[...非数组可迭代对象]` 编成 `[].concat(x)`，
>    导致 beads 在 web-mobile 产物里卡 BOOT、冲刺模式硬崩溃（**游戏逻辑无错**：Node 184 用例全绿、harness 正常进
>    PLAYING）⇒ EP-10 在 G10 修复前**不得记为验收通过**。
> 3. **实现进度**：S1–S5、S8（schema + 降级）、S9（暂停面板与音频开关）、冲刺模式已交付并有测试
>    （12 个测试文件 / 107 用例）；**EP-06（S6 道具）仍未实现**（`src/systems/powerups.ts` 不存在，
>    现仅 `view-model` 画了 3 张卡 + `ad_badge` 角标占位）；EP-07 星级/结算的评分函数已落地
>    （`tuning.ts` 的 C7 公式，有测试），**结算面板未做**。
> 4. **验收判据**：`[待 GDD §8]` 的引用位已可回填，但**回填属独立工作项**，本次对账不改写 Story 正文。
> 6. **EP-07（S7）关面已落地**（2026-09-14，WXG-T-063）：结算·过关面板按 `ux-spec §3.4/§4`
>    实现（`systems/clear-panel.ts`），`LEVEL_CLEAR` 由「1.4s 自动推进」占位改为**等按钮**
>    （下一关 / 去冲刺 U1），C7 结算分在过关当帧装配。**EP-07 仍未闭环**：冲刺结算面板
>    连击特效三档（`score-combo §2.5`；其判据 §8-9 属 DevTools 帧检）。
> 7. **EP-07 全部落地**：结算·过关面板（T-063）、FINISH（T-066）、冲刺结算（T-067）、连击特效可测半边（T-074；§8-9 帧检属真机）。
> 5. **EP-06（S6 道具）已实现**（2026-09-14，WXG-T-060）：`src/systems/powerups.ts` 落码，
>    `powerups.md §8` 十条判据全部有测试（`tests/powerups.test.ts`，16 条），S2 路由优先级 2
>    已接、整关重置与崩溃档字段已通。**仍属 EP-06 未闭环**：`AD_PLACEMENTS=4` 的角标位按
>    §2.6 布局 A **仅占位不拉起**（故原文「激励视频占位接线」语义未变），扩展位解锁路径仍缺
>    （`btn_expand` 无免费次数概念又无广告发奖，扩容只能在测试/harness 注入验证）。
>    **⚠️ 2026-09-14 追加（WXG-T-082）**：`powerups.ts` L106 与 L130 的 `[...this._holding]`（`Set`）在
>    Cocos 构建产物里退化为 `[].concat(Set)` ⇒ **持有道具列表恒空、道具到期清理失效**（见 VERSION.md §3 G10 #5/#6）。
>    这是**构建层缺陷而非 EP-06 实现缺陷**（Node 侧 16 条判据全绿），但 EP-06 的真机验收同样被 G10 卡住。
> 8. **G10 已修（2026-09-14，WXG-T-090 · 波次 2「真机可玩性第一锁」）⇒ 上述第 2 条的阻塞项 ❷ 与第 5 条末尾的
>    G10 追加注记均解除**：采用 **ADR-0012 方案甲**——入库源码一律 `Array.from(x)`（6 处真伤点：框架
>    `storage.keys()` / `ObjectPool.releaseAll()`；beads `patternColors()` / `buildStagePattern()` /
>    `PowerupSystem.get holding()` / `noteCapacity()`）+ 类型级守卫 `check-es5-spread.mjs`（已进 `verify`）。
>    重建产物已确认 `Array.from(seen)` 落地、`[].concat(seen)` 消失，**直接执行产物字节的 `patternColors` 得
>    L1–L8 = 3–8 个色**（BOOT 色数判据可过）⇒ **EP-06 / EP-10 不再被 G10 阻塞**（Node 与 harness 路径从未被阻）。
>    ⚠️ 诚实边界：EP-10 仍剩**环境阻塞 ❶**（无微信开发者工具 + 无 AppID ⇒ 无真机预览/上传），且本 Epic 的真机/浏览器
>    **加载级**复验尚未做（沙箱禁监听 socket）⇒ **EP-10 仍不得记为验收通过**，待运行时复验后由 QA/发布阶段关闭
>    （判据出处：各系统 GDD §8；本条不改写 Story 正文）。
>
> 9. **EP-11 珠体风格池与豆径档已立项（2026-09-26，WXG-T-211-G）；Story 正文见【**`production/epics/epics-beads-ep11.md`**】（按 Epic 拆件），EP-11 的对账以该件为准**。
>    ① **§12.9 步 1 已核销**（WXG-T-211-A）：ADR-0024 落地、J-1/J-2/J-4/J-5 绿、framework 330 / beads 592 / breakout 239 全绿、
>    十层盘 SVG 逐字节等值 ⇒ **默认皮肤转正的开工门已开**；ADR-0024 §6 **J-4 字面已随本批改述同步**（「暖帧后增量 === 0 + 首帧翻倍 ≤ 12」）。
>    ② **EP11-S1…S5 均未开工**：`src/view/bead-styles/` 不存在（无 `contract.ts`/`registry.ts`）、门禁常量未拆（`WAVE_LOD_LAYERS = 7` 仍一词两义）、
>    `save-schema.ts` 现 `SAVE_VERSION = 4` 且 `settings` **只六字段**（无 `beadStyle`、无豆径档）⇒ `S9§8-14~19` 与 `S8§8-11~13` **全为待实现判据，现在只能拿红基线**（K-035）。
>    ③ **E 单 P0 未修**：`drawEmptySocket` 的 S3/S4 **y 序反了**（`bead-render.ts:625-642`）且旧例从不判 y ⇒ 换向必假绿，已归 **EP11-S1（断言先行）**。
>    ④ **EP11-S6 / S7 阻塞**：同 EP-10 阻塞 ❶（无开发者工具 + 无 AppID）+ 06 选型 P-1 未裁 ⇒ `[Blocked]`；**EP11-S1…S5 不受此影响（纯 Node 可验）**。
>    ⑤ **用户已裁（不得重开）**：Q1–Q4 = 甲/甲/甲/甲；**C12 = 弱读法**（珠面 pixel 占比最大端点色），强读法作废；E 单 R1/R2 改造建议**不采纳不预落**；`polygon3` 不收编旧调用点。
>
> 10. **EP-13 / EP-14 首批 Story 已落码（2026-10-17，用户验收后提交；正文见各 Epic 拆分件）**：
>     ① **EP14-S1 星级结算引擎 = done**（提交 `435c8b0`，沿立项号 WXG-T-288）：§3.7 v1.78 档内按用时判星 +
>     续时保底档位星 + 档位单条件；四臂判据（score-combo §8-1）全绿，旧语义用例 K-053 换形；镜像同步核一致。
>     ② **EP13-S1 大关表承载关卡清单 + 术语改名 = done**（本批提交，沿拆分号 WXG-T-284）：`themes.ts`→`arcs.ts`，
>     新字段 `levelRefs = [[1, 9]]`（Q17=甲）；表侧不变式四臂 = `tests/arcs.test.ts`；现池零 diff；零 §3 变更。
>     ⚠ 偏差登记：Epic 引用点清单漏 `tests/menu-carousel.test.ts`（已一并改净）；走马灯字段名实测不含主题字样，
>     无可改，移交 S4。`arc-level-select-spec.md` L6「代码侧本批不动」句已成陈旧口径 ⇒ 移交设计轨下批订正。
>     ③ **EP13-S2 选关页 = 本大关清单 ∩ 闸门 = done**（提交本批，沿拆分号 WXG-T-284）：两入口记大关页上下文、
>     墙集合改 `levelRefs` 展开（1-based → 0-based，截断 `WALL_CAPACITY`）、`pick-level` 闸门逐字保留；
>     新测试九臂（R1–R5/R8–R12 + 12 关池反例臂），beads 1008 绿。偏差：本池 1 大关含全池 ⇒
>     `meta-menu-wall` 集合断言数值不可变形（加指针注释，真判据落新文件）；空橱窗页仍可进空墙 = 过渡态，
>     零事件归 S4-R13；3×3 改版经核归 `ep13-fu-wallcell` 跟进单。后续：S3（0 心回满）/ S4（走马灯按大关）待开。
>
> 11. **EP13-S3 0 心点格 → 拉起既有体力回满位 = done**（提交本批，沿拆分号 WXG-T-284）：
>     缺心进关不再静默 ⇒ 留本页、拉起既有 `stamina-refill` 广告（激励位内容/数值零改动），发奖只调
>     `refillStamina()`；跳过/报错清在途标可重拉；主钮与选关格同语义。**串道根因根治**：广告发奖是广播，
>     新增 `_abandoned` 弃局标（`showMenu` 置位、新局装配清除）＋续时腿守卫 ⇒「上局失败 → 回菜单 →
>     看体力广告」不再被拉回旧失败盘白得加时。新测试五臂（不回关零扣心 / 回满可点 / 跳过重拉 /
>     闸门优先 / 串道反例），beads 1013 绿。
>     ⚠ 偏差登记：改动面多出 `beads-game.ts`（不在 C-4 点名面，但串道风险源头在此，按 DoD 硬项做根因修）；
>     0 心点按返回值沿用「已消费」原码口径；harness 目视走查未做（Mock 广告自动完成且无调试面板），
>     真机目视项挂账。后续：S4（走马灯按大关）/ S5（按下态）待开。
>
> 12. **EP13-S4 走马灯按大关翻页 + 橱窗三态 = done**（提交本批，沿拆分号 WXG-T-284）：
>     页序按大关（`ARC_OPEN_MAX` 实体页 + 1 空橱窗），代表图 = 该大关收尾关的橱窗图
>     （`ARCS[页].textureId`，视图新增 `carouselTextureId` 入参）；三态由 `levelRefs` 归约
>     （任一关推关中 / 全通关 / 一关未开）。空橱窗页两入口（点图 / 松手）零事件（R13），S2 的
>     空墙过渡态收口；两处硬取首行（`MENU_TEXTURES.bossArt` / `BOSS_THUMB_TEXTURES`）消除，
>     后者改按大关表派生。新测试六臂（页数/取图/两态/零事件/可翻回），beads 1019 绿。
>     ⚠ 偏差登记：`locked` 分支落码但本版不可达（存档解锁进度 ≥1）⇒ 只登记不伪造观测；
>     页头大关名仍归 TODO-1（木牌显示收尾关）；删 `bossArt` 引发两处旧断言换形（K-053）；
>     选关页测试 R12 旧过渡态臂同步换形。后续：S5（按下态）待开，EP13 收尾。
>
> 13. **EP13-S5 选关格按下态 + 陈旧注释订正 = done**（提交本批，沿拆分号 WXG-T-284）：
>     `drawWallCell` 接入既有 `pressed` 机制（对象身份比对，格底/星带/缩略整体下沉 2px = `UI_PRESS_SINK`）；
>     `reduceMotion` ⇒ 位移归零但换面仍在（既有 `palette.cardPressed`，零新色）；
>     `MetaButton.slot` 注释「陈列序 = DI 升序」改为现码口径（配置文件顺序，仍经 `wallSlots` 映射）。
>     C-3② 「已通关」呈现按规格只核对不建设（符号串 ★ 通道 + 同形同尺）。新测试五臂，beads 1024 绿。
>     ⚠ 偏差登记：证据落 `qa/beads/evidence/`（仓内惯例，非 Story 所写 `qa/evidence/`）；
>     规格未钉按下换面色 ⇒ 取既有 `cardPressed` 补全口径；harness 按住截图与真机签署未做
>     ⇒ evidence 标 ADVISORY 未闭挂账。EP13 五条 Story 全 done。
>
> 14. **EP13-FU-1 选关墙 3×3 + 未解锁/越界锁格合形 = done**（提交 `044e96a`，另领 WXG-T-290）：
>     本档 = `epics-beads-ep13-fu-wallcell.md`（承规格 v1.3 3×3 与 Q15 10-17 改裁合形，**不属 EP13 拆分五 Story**）。
>     `WALL_COLS 4 → 3`（容量派生 9 = 现池 9 关）；新 `drawLockedWallCell` 替掉墙格路径的虚线腿 ⇒
>     未解锁与越界同走锁格（灰阵 + 小锁 + 无星 + **无虚线**），零新数值零新 hex（灰阵用既有未开启墨集
>     `beadFadedInksFor`，锁尺用 `MENU_BADGE.d`，位图未就绪回落圆章 +「锁」字）。新测六臂 + 三处旧断言换形。
>     ⚠ 偏差登记：① 越界槽拿不到关卡引用 ⇒ 只画格底 + 锁，与未解锁格仅“差一层珠阵”（数据驱动，
>     ⛔ 不拿别关图凑）；② 网格宽与 startX 实为**派生式** ⇒ 未手写跟进单的 173/404；③ `drawDashedSocket`
>     函数**保留**（橱窗空 Boss 位与另一腿仍在用），只拆墙格一条腿；④ 锁尺与位置规格未钉 ⇒ 取既有徽标档。
>     ⚠ 实测代价（A7 重采，`risks.md §4b`）：满载 1518 → **1423**，但首日 696 → **1423**（锁格也画灰阵，
>     +727 命令）⇒ “合形使首日不再比满载便宜”待美术与 QA 裁；读数出自视图直调腿，**生产腿终值待重取**。
>     另：越界臂原为“遍历第 10–12 格”的空循环（改容量后会假绿）⇒ 改钉“本版不可达”。
>     未闭：[TODO-ART-1] 灰阶具体值（本批只断言零饱和）/ 9 格内容版式三底稿待美术选版 / A8 真机观感。
