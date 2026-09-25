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
