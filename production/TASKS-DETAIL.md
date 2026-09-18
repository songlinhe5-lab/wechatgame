# WXG 任务台账 · 详情（标题制正文侧）

> **为什么拆开**：`production/TASKS.md` 曾**81% 的体积是任务行详情**（16 行 ≈ 5334 tok，中位行 389、最重 613），
> 而 `tasks:archive` 只清**已完成**行 ⇒ 每个新任务仍带入 400–600 tok ⇒ 反复撞 `ctx:check` **B 项单文件 8000**。
> 拆法：主表只留标题，正文落这里**一任务一节**（原文本原样搬，未改写）。
>
> **怎么读（协议，见 `ctx/ROUTES.md` 与主表头注）**：
> 1. **领号只读头注**：`grep -n '当前已分配至' production/TASKS.md` ⇒ 读那一行（≈30 tok）；要**看全部任务状态**才读主表（≈2.4k tok）；
> 2. 要某任务详情时，从 `ctx/index.json` 里**本文件该小节**的 `startLine`/`endLine` 取范围，
>    `read_file(path, offset, limit)` **只读那一节**（中位 ≈ 290 tok）——**不要整读本文件**。
>
> **配对纪律（由 `pnpm run check:tasks` 机械强制）**：主表有行 ⇔ 本文件有同名小节；
> 归档时**行与小节成对搬走** —— 由 `pnpm run tasks:archive` 机械执行（WXG-T-065：行进
> `archive/TASKS-archive.md`、节进 `archive/TASKS-DETAIL-archive.md`，节数 == 行数），故本文件只留在办 / 近期任务。

---

## WXG-T-128

**beads 美术 v1.4「动态质感章」风格单（G1–G9 动效欠账清偿）** · 负责：林绘澄(art) + 主理人(Qoder) · 状态：🔄 待真机首验（可推进项**全部闭合** 2026-09-18：落码 5 单 + 规格待裁归零 + `[Cocos]` 判读 ✅；余 = 真机首验包 B4 ⛔ + 低优先 UX 待裁③）

- 起因：用户「review 美术设计，提出优化方案，要求有质感、对比竞品要吸引人、要有及时的互动」。主理人**三方对账（规格 × 代码 × 竞品）**得 G1–G9。
- **v1.3 已达标面（不重复动）**：静态质感十层卡、冷底 token 真源、暖光 band 三级色温、背景层次、HUD 白胶囊/8 齿齿轮、a11y 假绿根治；竞品差异化辨识（冷紫灰 × 唯一暖焦点）已立住。
- **缺口清单（全部有代码证据，grep 零命中）**：
  - **G1 落座零视觉反馈（P0）**：art-bible §2「落座感」+ §7 `vfx_fill_pop` 120ms + assets-spec §1.6 + ux-spec §5 四处规格已冻结，但 view 侧 `bead:placed` **零消费**（仅音效 `_sfx(AUDIO_CLIP_PLACE)` 已实装）⇒ 最高频交互画面纹丝不动。
  - **G2 消除无溶解（P1）**：`vfx_clear_dissolve` 200ms 零命中 ⇒ 与「溶解沙」音效**音画不同步**。
  - **G3 道具生效无全屏扫光（P1）**：400ms 规格零命中（唯一 sweep 属 combo Lv3 burst，语义不同）。
  - **G4 过关无庆祝高潮（P1）**：`vfx_complete_wave` 800ms 逐列弹跳零命中 ⇒ 填满直接跳结算面板。
  - **G5 连击 Lv2 伪震屏空缺（P2·工程）**：渲染管线无全局变换通道（`_commands` 私有，WXG-T-074 登记），视图不假造。
  - **G6 结算无彩带礼花（P2·竞品差）**：**规格本身无此条**（assets-spec §1.6 仅 4 条 VFX）⇒ 需先补规格。竞品 = 全屏彩带 + 缎带 + 礼盒轨道。
  - **G7 不可填格纯静默（P2）**：ux-spec §4 已裁定「零反馈」，与竞品 pop-it「按下总有凹陷态」有差 ⇒ **用户拍板：加极轻非惩罚反馈**（改 ux-spec §4 矩阵行，属设计裁定）。
  - **G8 根因归纳**：v1.3 做满**静态**质感，**动态**质感四项（G1–G4）全欠账 ⇒ 珠子仍像贴图而非有质量的物体。
  - **G9 a11y 连带**：accessibility §2 D1 把「落座回弹/消除溶解」标 **N/A**（理由：无对应动画通道）⇒ G1/G2 落地后该 N/A 自动失效，须改「关停项」，防下次假绿。
- **用户裁定（2026-09-16）**：方案 = **丙案·全量 v1.4 风格单**（派林绘澄出「动态质感章」草案 → 主理人三方复核 → 用户拍板 → 落码，同 v1.3 丙案流程）；G7 = **加极轻非惩罚反馈**（守 D2 ≤3Hz + 零惩罚语义）。
- **可行性关键**：`_wrongFx` 是现成可 1:1 复用判例（表现层计时 `{row,col,elapsedMs}` + view 消费 + 重启门 + PAUSED 不冻结 + 快照字段）；毫秒值全部已冻结在 ux-spec §5 权威表 ⇒ G1–G4 **不需新冻结变更、不动 framework**。
- **性能口径（须入草案）**：动画期图元增量 G1 单颗 / G2 按批（数十颗）/ G4 全场 ≤156 珠逐列 scale；建议回退阀 = 动画进行中的珠子降层绘制（如溶解期只画 L1+L5），静态珠维持十层。
- **诚实口径**：评审结论全部基于代码事实（grep 零命中 + 已实装项核对），**未经真机截图验证**（Cocos 构建阻塞，同 T-124/T-125 口径）。



### 裁定与回写记录（2026-09-16，主理人复核 + 用户拍板 7 项）

**主理人三方复核结论**：改动范围合规（零代码、零 gdd/ux、零冻结常量、palette 零新增 hex）；林绘澄自报纠错的四类数字**逐条对代码复算验真**——彩带 5 色（`STAR_GOLD #FFD23F` == 珠色2 柠黄）、scratch 352 float（44×4×2）、A5 线宽 2.48/2.0/2.53/2.25（`SYMBOL_REF_SIZE 64` + `stroke(3)=max(2,size×3/64)` + `TRAY_BEAD_SIZE=TRAY_SLOT−4=44`）、图元净 −141/−580（基线 1810→1669/1230）；G6 禁飞带 `y∈[447,787]` 按 `clearPanelLayout()` **逐像素验过**（`panel.yMin=(1334−480)/2=427`、`rowY=427+20=447` = 按钮顶、缎带 `titleY 745 ± 84/2 = [703,787]`）。

**复核另抓 4 处缺陷（已全部修净，v1.4-r2）**：① **G2 LOD 阈值 126ms → 80ms**（卡内 `α = 1−q` 线性 ⇒ α≥0.6 ⇔ τ≤200×0.40=80ms；旧值系误把线性 α 当 easeIn 反解，落码按 126 会多画 46ms 十层）——错在 `assets-spec §1.6.2/§1.6.9` + `art-bible §7.4` 三处；② `§1.6.9`「砍掉的四层」→ **六层**（十层−保留 L1/L2/L3/L5）；③ `accessibility` A5⑦ G7 间隙 **4px → 3px**（`52−48/2−50/2`；只有被点那颗缩，4px 是「两颗都缩」的误用）；④ **改号 7 处**（`WXG-T-127` → `WXG-T-128`）。林绘澄另自查出 2 处同型残留并同批修净：A5① 取整写法 `27+25=52 相切` → `26.5+25=51.5<52 间隙 0.5px`（五处）、v1.3 遗留松口径「下压谷 ≥0.95」→ 收紧为 **0.96**（与 `FILL_POP_SCALE_TROUGH` 同源）。

**用户 7 项裁定（2026-09-16）**：

| # | 裁定 | 落笔处 |
|---|---|---|
| 1 | **G4 结算面板延迟 800ms 开**（庆祝先行放完再落遮罩；代价 = 过关到可点按钮多等 800ms） | `ux-spec §5`「过关庆祝」行 + `bead-grid §4` 表注 + `art-bible §7.3.4` / `assets-spec §1.6.4` 由「前提」改定案陈述 |
| 2 | **G5 采案 B（改框架，案 A 作废且不作降级预案）** | `art-bible §7.3.5` 全节重写 + `§7.1` Lv2「整屏 scale 1.015」**措辞不动**（案 B 下规格与实现一致，假绿种子消解）+ `accessibility` D1/D2/A5⑤/§2⑥；工程单 = **WXG-T-132**（原定 T-131，因并发会话占用改领） |
| 3 | **G7 加音效 = 新增第 20 个剪辑 `sfx_denied`**（非零音效、非复用 `sfx_place` 降 volume） | `ux-spec §5` 新行音效列「极轻闷「哒」」+ `audio-events §1` 注/§2.1/§5 Q-A05-5・6 + `art-bible §7.5` 注改写（**G6 仍无音效**，BD-16 判例保留）+ `assets-spec §1.6.7` 原子约束块 |
| 4 | **G6/G7 毫秒入 `ux-spec §5`**（「结算彩带」800 /「不可填格轻压」120，均复用既有行值、不新造时长） | `ux-spec §5` 增两行 ⇒ art 三件「§5 无此行 / 未决项 3」标注全清 |
| 5 | **LOD 只预埋 G4 的 6 层档**（G2 的 α<0.6 降 4 层与 G6 的 44→24 枚**规格保留、本轮不预埋**，只留回退阀②/③） | `art-bible §7.4` + `assets-spec §1.6.9/§1.6.10/§1.8末`；**图元改双口径**（规格口径 1669/−141；本轮落码口径 **1813/+3**，庆祝期 −580 本轮即成立） |
| 6 | **G3「全屏」限玩法区 `y∈[0,1214]`**（不侵入 `HUD_BAND`；白扫过 HUD 会让倒计时瞬时发白触 B1/E1） | `art-bible §7.3.3` + `assets-spec §1.6.3/§6`；⚠️ **主理人派单信里「HUD 在屏底」是错的**——`systems-index §3` 冻结「原点左下 / **y 向上**」+ §3.1「**顶部** HUD 带」，林绘澄拒绝照抄、按冻结真源写「顶部」（裁定实质与数值一字未改） |
| 7 | **1.06 = 规格起点值、非过冲量**（`ux-spec §5` 的 `1.06→1.0 / 120ms` 一字未改） | `art-bible §7` 主表由「ease-out-back，过冲 ≤1.05」改分段口径 + `§7.3.1` / `assets-spec §1.6.1` 读法声明块；谷 0.96 = **中间插值**，不违 §5（§5 只冻总时长与起止值） |

**主理人串行落笔的四域回写（非冻结规格文本，美术侧不改）**：

- **ux 域**：`ux-spec §4` 矩阵行「点锁定/已填格」由「静默忽略（零反馈）」→「**极轻非惩罚反馈**」；`§5` 增「结算彩带」「不可填格轻压」两行 + 「过关庆祝」行层序裁定 + **「珠子落座」行分段细化**（起点 1.06 → 谷 0.96@40ms → 终 1.00@120ms、L0a/L0b 联动、**重启门 120ms**）——补源依据：`§5` 事实纪律本就载有分段与门（「放错拒绝」行 60/80/60ms + 500ms 门），不补则 G1 的 40ms/门属「无源毫秒」。
- **GDD 域**：`input-control §2.4` + `§8-5` + `§8-7` + **v1.2 变更记录**（**§8-5 硬判据主体由「零反馈」转为「零事件」**，并显式写明「QA 不得再按旧文把 G7 轻压判成缺陷」；§8-7 与 §8-5 的 v1.1 期互斥随判据改写**消解**）；`bead-grid §4`（新增「（无事件）表现层轻压」行 + level:cleared 层序注）+ `§6` + `§8-4`（「零事件、零反馈」→「**零事件**」）。
- **audio 域**：`audio-events §1` 增变更注 + `§2.1` 两行归位（结算彩带 = 有意不做；轻压 = 预约）+ `§5` 新增 **Q-A05-5 / Q-A05-6**。⚠️ **冻结值 `AUDIO_CLIP_TOTAL` 19→20 本轮不动**：A05-24 是**活测试**（`audio-dispatch.test.ts` 断言 `SPEC_CLIPS.length === AUDIO_CLIP_TOTAL` 且 voice 表 ≡ clip 集），单独改 §3.12 会当场测试红 ⇒ 必须与 `tuning.ts` 常量 + `audio-voices.ts` 配方 + 测试 `SPEC_CLIPS` + §1 表行**同批原子提交**（解除条件六项见 Q-A05-5）。音频为**程序化合成** ⇒ 0 KB、不占包体、无需生成音频文件。
- **QA 域**：`test-cases.md` TC-GRID-04 / TC-INP-05 两条判据镜像（均「待实现」⇒ 改了零成本，防将来假 FAIL）；`g4-probe-v1.1.mjs` 增**修订 44** + P10 证据串叙述镜像（**不动任何断言/阈值/判定分支**；P10 测的是 §8-7 无选中点 empty 格，与 §8-5 锁定/已填格互斥 ⇒ 既有证据不失效、无需重跑）。

**落码拆分（5 单，施工时各自领号，不在本单预占号）**：

1. **G1 落座回弹（P0，首单）**——图元 +0、零冻结常量、零框架改动，`_wrongFx` 骨架 1:1 可复用（`assets-spec §1.6.10` 给 game 侧 5 步 + view 侧 4 步）；规格侧**已就绪**（林绘澄自评）。需工程定：`drawFilledBead` 的 `FilledBeadOptions` 扩 6 字段签名与默认值、`bead:placed` 的 view 侧消费者新建（现为零 = G1 P0 根因）。**D1 分支须同步接通**，否则 `accessibility` D1 由「N/A 诚实」转「✅ 假绿」。
2. **G2/G3/G4（P1）**——G4 含**面板延迟 800ms 开**（裁定 1）与唯一预埋的 `lodLayers=6`（裁定 5）；G2 作用对象**钉死为托盘槽位珠**（`powerups.ts`「绝不写网格」），照「消除网格珠」落码即破坏玩法状态机。
3. **G7 轻压 + `sfx_denied` 音频原子批**——含 `systems-index §3.12` 19→20 冻结变更单 + changelog 新行（主理人串行落笔）+ A05-24 五项同批；QA 侧须**新增 §8-5 独立探针用例**（事件增量 0 **且** 命令流出现 scale 覆写，按修订 25 用配对差分）。
4. **G6 结算彩带（P2）**——零 RNG lattice、44 枚 polygon、预分配 scratch 352 float；禁飞带 `[447,787]`。
5. **G5 案 B = WXG-T-132**（跨 `packages/framework`，**前置验证项 = `FIXED_WIDTH` 下整屏 1.015 是否露黑边**，未验证不得当已解决）。

**真机验证前置（阻塞项，登记不假装已解）**：v1.4 全部为**纸面几何核算**，真机未验（Cocos 构建阻塞，ADR-0009 P2，同 T-124/T-125 口径）。G1 落码后**首个真机抽检项** = L0a/L0b 接触阴影呼吸的观感（会不会读作「脏」而非「接触」）+ 峰值 0.5px 间隙；案 B 落码后须抽检整屏缩放致 HUD 文字 / 1px 描边的**亚像素抖动**（影响 E1/B1 观感）。若不先解构建阻塞，会重演 v1.3「F5 真机偏淡」那类事后才暴露的问题。

### `[Cocos]` 连拍取证推进（2026-09-17，CodeBuddy 会话）

- **新增工具** `tools/scripts/cocos-vfx-burst.mjs`：Cocos web-mobile 产物内**动画窗口连拍**取证（playwright 真实产物 + `tapDesign` 白盒驱动 + 逐帧相位读数 + 产物新鲜度门）。**观感取证物，不判 PASS**（判读 = 人眼复核）。
- **G6 结算彩带（TC-PER-26）**：✅ 取得有效连拍 —— `evidence/vfx-burst*/`（confetti 相位 0.10→0.83→0 = 播放→自清，两帧落在 800ms 窗口内）；solve 后 `phase=level-clear`（彩带与面板同帧臂起 ✓）。`[Cocos]` 道次取证物已备，判读待 QA/主理人。
- **G3 扫光（TC-PER-21）**：⛔ **连拍前置不足，如实登记**：① 首关错位珠少，道具（solverPlus/solver）一次归位即达成零错位 ⇒ **同帧 `level-clear`**，而 `_stepSweepFx` 只在 playing 推进 ⇒ sweep 相位恒 0（非实现缺陷，是取证构造约束；`--level=1` 换关后 phase 保持 playing 但 sweep 仍读 0，疑点 = `tapDesign` 是否命中卡 / Cocos 环境臂起差异，**未深挖**）；② 解除条件 = 换「错位 ≥4 且道具不致通关」的关卡构造，或裁决「level-clear 下扫光是否应继续播完」（规格未定义，属 UX 侧待裁）。
- **连带发现（线索级，未定性）**：A05-07 已确认音频 handler 读旧字段 `affectedSlots`（道具音效恒零发声，T-151 登记）；扫光视图消费（view-model.ts:1245 `sweepProgress`）读的是**快照字段**、与 payload 字段无关 ⇒ 与 A05-07 不同族，G3 缺口更可能是臂起/推进的相位面问题。
- **产物状态**：`games/beads/cocos/build/web-mobile` 已随本轮 `framework:sync` + `build:cocos:web` 重建为当前代码；脚本与连拍产物**未 commit**。

### 用户裁定执行（2026-09-17，CodeBuddy 会话 · 两项规格差异拍板）

- **裁定 ①（scratch 契约）= B「改实现保规格」→ ✅ 已执行**：
  - `packages/framework/src/core/render/render-model.ts`：`PolygonCommand.points` 与 `polygon()` 签名放宽为 `readonly number[] | Float32Array`（契约注载明「命令按引用持有 ⇒ scratch 段下一帧前不得改写；彩带每帧 44 枚固定段、当帧构建当帧消费 = 安全」）。
  - `games/beads/src/view/scene-vfx.ts`：`confettiQuad` 增 `off` 段偏移参数（默认 0，旧调用兼容）。
  - `games/beads/src/view/view-model.ts`：**`CONFETTI_POINTS = new Float32Array(44×8) = 352-float 预分配**（规格字面兑现），每枚固定段 + `subarray` 视图引用（零拷贝零复制）；原「逐枚新建 8-float」作废。
  - `tests/view-model.test.ts` 两处 points 联合类型收窄（`Array.from`）。
  - **验证**：`tsc --noEmit` 双包零错误；beads **409/409** 绿、framework **295/295** 绿；`framework:sync`+`:check` OK。
- **裁定 ②（彩带方向）= C「先看连拍再定」→ ⏸ 判读前置未满足，暂缓**：人眼复核 4 帧（含色像素定量检测）**均未见彩带**，且 `snapshot.confettiProgress` 读数 0 与上一轮同通路相位推进（0.10→0.79）**不稳定复现** ⇒ 疑点 = 「Cocos 产物上彩带未渲染 / 臂起不稳定」，需正式排障后重拍，方向裁定（上行 vs 飘落）在此之前无从谈起。排障起点：`_stepConfettiFx` 在通用表现层步进（beads-game.ts:698）✓ 已核对；臂源 = `_stepLevelClear` 门满帧（:1912）✓ 已核对；下一个排查面 = Cocos 绑定层 `drawConfetti` 的分派/裁剪（`polygon`+`Float32Array` 视图在 cocos-renderer:178 索引遍历天然兼容，但需确认命令流中确实出现）。
- **⚠️ 连带实测暴露（非本单引入，登记移交）**：`check:size` 从 SKIP 转实跑后首次结果 = **beads `cocos/build/wechatgame` 主包 4647.2 KB > 平台红线 4096 KB（超 551KB）**（breakout 1815KB 达标）。主体为引擎 bundle/资源面，与本单 3 函数改动无关 ⇒ 归 **T-128 真机首验包 P0-4**（原登记「check:size 从 SKIP 转 OK」——现转 OK 后即暴露超标）+ 包体治理（分包/裁剪）移交发布/工程域。
  - **✅ P0-4 澄清收口（2026-09-17，CodeBuddy 会话）——零治理改动即达标**：4647KB 是 **debug 产物基线被误读**（`build-cocos.mjs` 默认 `debug=true`：含 sourcemap 且不压缩，脚本头注明文「测包体基线必须用 --release」）。**release 重建后复测：beads 主包 1927.9 KB**（红线 4096 ✓、内部目标 2000 ✓ 达标；breakout 1815.1KB 达标）；`verify` **PASS 16 ｜ WARN 0 ｜ SKIP 0 ｜ FAIL 0**。
  - **守卫加固（防再误读）**：`tools/scripts/check-bundle-size.mjs` 新增 **debug 产物侦测** —— `cocos-js/cc.js ≥ 2500 KB`（debug ≈3.3MB / release ≈1.5–1.8MB，取空档）⇒ 报告输出「疑似 debug 构建，包体数字不可作为基线，请用 --release 重建复测」，且 `anyFail` 提示里优先指向 release 重建；脚本内建自测 19/19 绿。
  - **教益（K 候选）**：「首次转实跑的守卫」第一次实测结果要**先核测量前提**（此处 = 产物 debug/release 形态）再下「超红线」结论——测量前提不成立时，FAIL 读数是伪信号而非缺陷信号。
- **✅ P0-4 澄清收口（2026-09-17，CodeBuddy 会话）——零治理改动即达标**：4647KB 是 **debug 产物基线被误读**（`build-cocos.mjs` 默认 `debug=true`：含 sourcemap 且不压缩，脚本头注明文「测包体基线必须用 --release」）。**release 重建后复测：beads 主包 1927.9 KB**（红线 4096 ✓、内部目标 2000 ✓ 达标；breakout 1815.1KB 达标）；`verify` **PASS 16 ｜ WARN 0 ｜ SKIP 0 ｜ FAIL 0**。
  - **守卫加固（防再误读）**：`tools/scripts/check-bundle-size.mjs` 新增 **debug 产物侦测** —— `cocos-js/cc.js ≥ 2500 KB`（debug ≈3.3MB / release ≈1.5–1.8MB，取空档）⇒ 报告输出「疑似 debug 构建，包体数字不可作为基线，请用 --release 重建复测」，且 `anyFail` 提示里优先指向 release 重建；脚本内建自测 19/19 绿。
  - **教益（K 候选）**：「首次转实跑的守卫」第一次实测结果要**先核测量前提**（此处 = 产物 debug/release 形态）再下「超红线」结论——测量前提不成立时，FAIL 读数是伪信号而非缺陷信号。

**美术规格侧未决项：零**（林绘澄回传 ⑤ 明述；三件文档内无条件句/待裁结构残留）。

### 收口推进（2026-09-18，CodeBuddy 会话）

- **差异②闭合确认（对账 §1.6.6 回写注）**：系登记时误按 y 向下读（设计坐标 **y 向上** ⇒ 公式递减本就是屏面下落，目视「飘落」与卡文案一致），用户 2026-09-17「认可」⇒ **公式不改、规格本体不改、无 v1.5 修订项** ⇒ 本单**规格侧待裁项归零**（「美术规格侧未决项：零」维持成立）。连带清理 stale 注释：`scene-vfx.ts`（src + cocos 镜像**同批**）旧注「差异已登记待 art 复验」→ 改为闭合口径。
- **`[Cocos]` 连拍 v2.1 在当前代码复跑（本单余下可推进项的执行）**：产物自 T-157/T-158 后已陈旧 ⇒ 按脚本前置 `framework:sync` + `build:cocos:web` 重建（`web-mobile/index.html` mtime 2026-09-18 09:28）后复跑，**14/14 相位帧全取得**：
  - **G6 结算彩带（TC-PER-26）**：8/8 帧，p 0.125→0.958 覆盖 800ms 窗口；每帧 5 色近似差分 ≈44.4k px（基线 0）且**灰度 ≈42k < 彩色** ⇒ 彩带持续渲染、**BD-50 黑化特征不复现**（T-156 修复在当前代码仍成立）。
  - **G3 道具扫光（TC-PER-21）**：5/5 帧，p 0.167→0.958；level 1（错位珠 4）用 v2.1 触发器（道具卡 0）后 **phase=playing** ⇒ v2 期「同帧 level-clear 吃掉扫光窗口」的**取证构造约束已解决**，非实现缺陷的定性获得新证据。
  - **诚实口径**：取证物 ≠ 判读 —— PASS/FAIL 归 QA/主理人**人眼复核**（`evidence/vfx-burst/` v2.1，JPEG q90）。
- **本单剩余（显式移交，不假装已解）**：① **真机首验包 P0-1..P1-7**（前置 = 有效 AppID，用户侧 B4，⛔）；~~② G6/G3 连拍判读~~ **已闭合（2026-09-18 收口，见下）**；③ 低优先 UX 待裁：「level-clear 下扫光是否应继续播完」规格仍未定义（现取证已不依赖该点，不再阻塞）。

### 收口（2026-09-18，Qoder 提交会话 · 主理人人眼判读）

- **余项② G6/G3 连拍判读 = 执行完毕，两项均判 ✅ 视觉达标**（对象 = `evidence/vfx-burst/` v2.1 帧，产物 mtime 09:28）：
  - **G6 彩带（TC-PER-26）**：BASE 无彩带 → p≈0.13/0.21 顶部密集带（五色：黄/绿/红/紫/白）→ p≈0.42 中段整体下移（飘落轨迹与卡文案一致，差异②闭合口径得目视佐证）→ p≈0.83+ 自清零残留；**禁飞带 `[447,787]` 内零彩带**（面板/按钮/缎带全程干净）；BD-50 黑化不复现（彩色像素鲜亮，与定量 colorish>gray 读数互证）。
  - **G3 扫光（TC-PER-21）**：三层斜带（20°）自左向右扫过全程可辨（p≈0.17 左侧 → p≈0.58 中部 → p≈0.96 右侧出屏）→ 尾帧自清；**顶部 HUD 带零侵入**（计时胶囊/齿轮/LV 字全程不受光带经过，裁定 6 达标）。⚠️ **底部道具带被扫到属规格内**：核对 `assets-spec §1.6.3` 裁定回写行明文「限定玩法区 **y∈[0,1214]**」+ 实现 `SWEEP_Y_MAX = HUD_BAND.yMin`（tuning L670）⇒ 非违规，登记以免后续判读误报。
  - **效力边界（诚实）**：判读对象 = web-mobile 产物连拍（非真机屏）；真机亮度/刷新率差异仍归首验包 P0-2/P1-6。
- **T-129 连带核销（出包内容物白盒实证）**：`build/wechatgame`（mtime 09-18 14:27）bundle 内 `normalizeCocosTouchWx` 已是勘误后式（`i.y = windowHeight − n.y/dpr`），且含 T-162 离线渲染（`_shotBuffers`）与 T-164 批0（`createBeadsShell`/`refillStamina`/`stamina-refill`）⇒ **真机复测包就绪**，扫码复测为用户侧动作（B4），本单施工半至此无可再推项。

---

## 真机首验包（待 AppID · 2026-09-16 登记 · 解除 DEV-01/B4）

> 前置：① 有效 AppID ② `pnpm --filter @wxgame/beads run build:cocos --release` 出包（⚠️ 2026-09-18 订正：仓库无 `build:cocos:wx` 脚本名，`build:cocos` 默认 platform=wechatgame，测包体必须 `--release`） ③ 微信开发者工具 + 真机扫码 ④ 本包随包执行并回填。

- **P0-1 时基同源复核（BD-40 关单前提）**：真机跑 `production/qa/beads/beads-browser-probe.mjs` 的 CLK-01 等价面 —— 仿真/墙钟须 **≈1.00±0.10**（修复后 web 实测 1.002/0.997；**若真机 ≈2 ⇒ BD-40 复活升产品级 P1**）。
- **P0-2 光敏性观感**：wrong 态连点（观察单次脉冲非往复、无高频闪）+ 告急脉冲 + 满槽呼吸 —— 屏幕像素层 web 已验，真机亮度/刷新率差异须人眼复核。
- **P0-3 T-124 丙案视觉**：十层卡/冷底/F6 白字路由/NEW BEST 角标（T-127 修后 168 底衬）/STAGE 标签（T-127 修后 `DESIGN_W−30` 锚）—— 真机字体回退下不回溢（T-127 风险条款）。
- **P0-4 主包红线**：`build:cocos --release` 实测包体 ≤4096 KB（§3 冻结；程序化合成 ⇒ 音频 0 KB 应天然满足）+ `check:size` 从 SKIP 转 OK。
- **P0-5 四相位真链**：暂停/结算/失败面板真指针可用（web 已验，微信 touch 语义须复验）。
- **P1-6 性能**：T-124 单帧最坏 +624 图元的帧率回退阀（林绘澄预授权条款）真机实测。
- **P1-7 音频**：A05-26 听感（`[P]`）+ 首次手势后出声（A05-27）。
- 以上全过 ⇒ G4 的 DEV-01 解除，可议升 PASS；任何一条红 ⇒ 按 BD-40 先例登记并回修。

---

## WXG-T-164

**beads·元游戏页族反转冻结回写 + 批0 落码（体力/钱包/振动）** · 负责：主理人(Qoder) · 状态：🔄 批0 完成待收口（六文回写 + 批0 落码已随 `79f217a` 入库；真机复验 + 批1/批2 未完）

- **用户八项拍板（2026-09-18 两轮）**：一轮 = B Shell 双对象 / 分批 0-1-2 / 本地榜+好友置灰 / 装体力+广告+钱包；二轮 = **体力宽容包 B**（上限 8、8 min/心）/ **钱包 A 包**（买心阶梯 + 头像框）/ **装触觉振动**（`VIBRATE_DEFAULT=ON`、仅 isMiniGame 显示行）/ 首启仍直进玩法。
- **冻结回写（六文，已落定）**：systems-index **v1.28**（新 §3.14 体力与钱包：`STAMINA_MAX=8` / `STAMINA_REGEN_MIN=8min/心`（离线恢复 f(Δt wallClock)、登录钳上限）/ `STAMINA_START_COST=1` / 回满 = 激励视频第二 live 位 / 签到第 3/5 天各 1 心（溢出即弃）/ 钱包获取仅签到币·周榜结算·通关首通、消耗 = 买心（阶梯价不冻结 `[待 playtest]`）+头像框 / Won't = 只发不耗·币购道具；§3.8 `VIBRATE_DEFAULT` 新冻结 + 屏震行语义钉死；§3.11 激励主位 1→2、体力移出 Won't；§1 S10 行 + S9 行；§4 meta 域事件 5 行）+ changelog v1.28 行；ux-spec **v1.7**（§1 原则 1 / §2 流程主菜单+overlay 栈 / §6.3 补注 / §8 更正，**启动路由零改动**）；concept **v1.4**（§5 / §7 meta 页族行 + Won't 改写 / D10 反转）；meta-framework **v1.1**（M4/M5 反转 + 三货币条件解除 + §7 分批计划）；pause-settings **v1.3**（回主菜单次钮 + 震动行 + §8 判据 11/12）。
- **语义裁定（本单新增澄清）**：扣心时机 = **新局开局/重试**；PAUSED 恢复与菜单在途续进**不重复扣心**（保留进度不惩罚）；签到送心溢出即弃；阶梯价表不冻结归 `tuning.ts` 候选（判例 `SPRINT_K_CURVE`）。
- **批0 落码范围（进行中）**：shell（BeadsShell 双对象）/ meta-state / meta-save-schema（sidecar v1；settings v4 = +vibrate）/ menu-route（暂停次钮→菜单、菜单主钮恢复/新开）；scenes = menu / settings overlay / signin overlay；services = signin（wallClock 自然日判定、循环制断签不清零）/ stamina（离线恢复钳上限）/ wallet（获取三源+买心消耗）；meta-view 只读 + ui-kit 程序化图元 + harness `?meta=` 注入；`gdd/meta-ui.md` GDD 同批建（S10 行预约）。
- **retry/restart 逐次扣心（本单挂账已关闭，2026-09-18）**：玩法内 retry（normal）/ restartRun 经注入 `play` 的 `canStartRun` 闸门逐次扣 `STAMINA_START_COST`；sprint 不设门（§3.14 冲刺消耗不冻结）。**0 心拒绝路径 = 用户拍板 B（失败页看广告回满再重试）**：闸门拦下 → `_requestStaminaRefill` 拉起 `STAMINA_REFILL_PLACEMENT`（§3.11 第二 live 位，游戏侧字符串位不改冻结框架枚举）→ `onRewarded` 按 `_adKind` 分发（revive vs staminaRefill 共用单一订阅）→ `onStaminaRefill`→`MetaState.refillStamina()` 回满后重放 proceed 续体（MAX≥cost 必成功、无循环）。hook 而非事件（不动 §4 冻结表）；standalone BeadsGame（无 canStartRun）恒放行保 429 既有测试。新增 `tuning.STAMINA_REFILL_PLACEMENT` / `run-start-stamina.test.ts`（5 tests，真实 MetaState 端到端）。
- **门禁证据（本单 retry 扣心段）**：`framework:sync`（beads 写入 3）+ beads `tsc --noEmit` 净 + 全量 beads 测试 **458 passed**（453+5）+ `cocos:check` 两游戏过 + beads `--release` 重建（17.7s）+ `verify` **16/17**（唯一 FAIL = `check:secrets` project.config.json:22 AppID 既有挂账，非本单引入）+ ux-spec v1.8（§3.5 重试扣心注 + §4 矩阵 GAME_OVER 拆有心/0 心）。
- **待办**：~~批0 落码与测试~~（已完成，`79f217a`：shell/meta-state/sidecar/settings v4/签到·体力·钱包内聚于 meta-state/menu 路由/meta-view/harness `?meta=`；458 绿）；真机复验（震动行仅 weapp 显示、签到跨天、菜单路由、扣心/续进口径）；`gdd/meta-ui.md` GDD 与 ui-kit 独立图元层**未随批0 落盘**（S10 行仍标待建，归批1 同批补）；批1/批2 另单。
- **入库（2026-09-18 提交会话）**：六文回写 + 批0 落码随 `79f217a` 提交（与 T-162 交织文件合笔，头注双挂）；本单 B4 门禁中 `check:secrets` 存量 FAIL 已由根配置 `.gitignore` 处置闭合（见 `## WXG-T-161` 处置核销，随 `2f62027`）。

---

## WXG-T-166

**beads·棋盘区双指缩放 + 单指拖拽（立项）** · 负责：待程基岩(eng) + 文策渊(UX) · 状态：📋 已立项、**施工阻塞待 ADR**（框架多点输入前置）

- **缘起（P1 真机反馈）**：用户「缺个功能，可双指放大缩小、单指左右移动」。用户已钉范围 = **仅棋盘玩法区缩放/平移**（HUD/托盘/面板不缩放）。
- **设计已有意向**：concept v1.24/D13、systems-index v1.24 changelog③、ux-spec v1.6、input-control v2.2 已将「双指捻合缩放」列为 **Should**（无滑轨/按钮）。
- **前置阻塞（硬）**：框架 `InputManager` 为**单指针设计**（`_ownerId` 首指独占、`input-manager.ts:99`「Ignore secondary touches」），`InputSnapshot` 只暴露一组 x/y ⇒ **双指捻合无法在玩法层表达**。解锁需二选一（均需 ADR）：**(甲)** 扩 `core/input` 为多点快照（触 **L2** core 引擎无关 + 影响 breakout，面大）；**(乙)** Cocos 适配层新增第二条触摸通道→游戏专用服务（触 **L3**、适配层）。未裁。
- **高危面声明**：缩放后的「触摸→格子」需逆变换（屏→设→棋盘局部），**正是 BD-48/T-129/T-161 同一 hit-test 通道** ⇒ 不得绕过回归网直接实现（K-037 屏幕层取证）。
- **下一步**：待用户/主理人就甲/乙 定 ADR → 拆子任（框架输入扩展 / 棋盘变换建模 / hit-test 逆变换 / 缩放限幅与钓制 / 双拍复位）+ QA 判据。本会话不动 hit-test 通道。

---

## WXG-T-167

**beads·缩放设计轨（C-3 判据翻转 + 图鉴/扩容盘面 concept 提案）** · 负责：文策渊(design-strategist) · 状态：📝 草案待裁（**§3 零冻结、未落码、未提交**）

- **缘起**：ADR-0015（WXG-T-166）主理人裁定 C-3=(a)「棋盘区抬起才提交 + 位移阈值」＋ C-4=「图鉴/扩容盘面设计轨现在开、与缩放并行」。本单承接这两条的**设计侧交付**，不动代码。
- **领号说明（并发避让·判例见 T-168）**：本会话（Qoder design-strategist）在 `input-control.md` v2.5 头注占用 167；CodeBuddy 会话据此改领 168。头注「167 归属」由 T-168 会话代为登记，主表行/详情节由本会话补齐（即本节）。
- **交付物 (i) · C-3 判据翻转（缩放施工前置）**：
  - `input-control.md` **v2.5**：§2.1 路由入口翻为「棋盘区 tap = 按下→抬起且位移<阈值；drag = ≥阈值→平移不发玩法指令；双指=捏合缩放；HUD/托盘/面板仍按下即响应」；§8 判据 **2/4/9/10 以删划线留档翻转**，§8 头新增「未翻清单」防 QA 全量重跑；§6 补新增手势边界 5 条。**位移阈值 `BOARD_TAP_MOVE_THRESHOLD` 仅给形态不给值 `[待确认]`**。
  - `core-loop.md` **v2.1**：`bead:placed` 发射帧 down→up，§8 末「时基位移注」点名下游（落座回弹/扫光/`level:cleared` 判定帧/连击间隔）并标注**连带 K-052 时长常量重跑**。诚实登记一处旧错引（ADR-0015 所称 core-loop §8-3 实为满槽禁取珠，按 §2.2.2+§8-4 实质落点钉，未改判据编号）。
  - **归属共存**：与 T-168 的 `input-control` v2.6（取回分支）交错但互不影响（T-168 详情已确认「v2.5 时基翻转不受影响」）。
- **交付物 (ii) · 图鉴 + 扩容盘面 concept（新系统，仅提案未裁）**：新建 `games/beads/design/proposals/v2-album-dense-boards.md`（106 行，标题含「提案 · 待裁」）。
  - 理解：每张「图」= 一个拼豆画作，由 3×3（9 宫格）或 4×4（16 宫格）**子拼图版面**组成，每子版面是一个可玩关卡（Album → Plate → Cell-Level 三层树）；全部子版面完成 → 整图完成 → 图鉴收入。落 S10 元游戏页族（`gdd/meta-ui.md` 仍待建）。
  - **开放问题 Q1–Q11**（只列不自答）：**Q1 子版面是否复用「错位归位」内核**（若否 = 加第二玩法内核，S1/S3 判据翻倍、须改判 concept D1）／**Q2 宫格同时可见 vs 顺序解锁**（决定「一屏是否需 N 个独立缩放版面」，直接判定 ADR-0015 丁-3 单相机前提是否失效、是否须提前投资丁-2 分组变换）／盘面扩容档位（GRID_MAX 从 13×12 扩到多少）、图鉴入口位置、整图进度显示、珠子密度/连续性规则、体力扣减口径、与 demo 8 关关系等。
- **不冻结清单**：位移阈值、缩放档位上下限、`GRID_MAX_*` 扩容值、宫格规格、体力口径 —— 全部 `[待确认]`，待主理人裁 Q1/Q2 后再进 GDD。
- **下一步**：主理人就 **Q1 / Q2** 拍板（其余依赖此两条）→ 文策渊出提案一页纸转正 + 新建 `gdd/meta-ui.md`（八节含图鉴）＋ §3 变更单草案 → UX 侧 `ux-spec` 抬起提交回写 + 三层 Screen Flow → 程基岩在 C-3 前置解除后开工 甲′+丁-3（先取证 Cocos 多点派发形态）。

---

## WXG-T-169

**beads·棋盘缩放平移落码（Z0–Z6）** · 负责：程基岩(eng) · 状态：🔄 开工中 · 上位决策：`ADR-0015`（Accepted，甲′+丁-3+C-3(a)）· 前置判据：`input-control.md` v2.5 / `core-loop.md` v2.1（已随 WXG-T-167 入库）

- **范围**：仅落「棋盘区双指缩放 + 单指平移 + 抬起才提交」能力。**不含** GRID_MAX 扩容、图鉴/meta-ui、C-5 描边随缩裁定、位移阈值与缩放档位数值冻结（后三者分别走设计轨 WXG-T-167 / art 轨 / §3 变更单）。
- **Story 依赖序**：Z0（Cocos 多点派发真机取证，⛔ 无设备/编辑器挂账）‖ Z1（InputManager 多槽化甲′）→ Z2（gridLayoutFor 参数化 + 命中半径随缩 + 回环/反例自检）→ Z3（view-model 参数化 + 格心剔除）‖ Z5（board-camera.ts 纯函数）→ Z4（_readInput 抬起提交状态机 + 相机门禁/复位 + 迁移真链用例）→ Z6（QA test-cases 迁移 + 门禁全跑 + framework:sync）。
- **关键不变式**：`gridLayoutFor` 恒等档（camera=undefined 或 zoom=1/offset=0）产出与今日**逐位相同**（旧 460 例、快照差分、command 流零漂移）；单指旧输入序列在 InputManager 改动前后逐帧 snapshot 全等（向后兼容锚）。
- **假设（若错回炉）**：C-5 未裁→视图占位「不随缩」标 [R]/[P]；Cocos 逐指派发假设成立（Z0 否证则 bindings.ts 补 getTouches 遍历，不触 core）；owner 不迁移为工程自裁（ADR-0015 §3.2-3 附复评）。

- **落码结果（2026-09-18 本会话续）**：Z1–Z5 代码全部落地，`verify` **17/17 PASS**、beads **486 例绿**（+15 回环/恒等锚/反例 +9 手势 +2 抬起提交正面判据）、`framework:sync` 已镜像（input-manager→两游戏；beads tuning/game/state/view-model + 新 board-camera.ts）。
  - Z1 `input-manager.ts` 第二指针槽（甲′，owner 语义逐字不变、次指不产 justDown、owner 抬起不迁移）+ `input-manager.test.ts` 6 例含单指回归锚。
  - Z2 `gridLayoutFor(cols,rows,camera?)` + 抽 `hitGridCell(layout,zoom,x,y)`（`_hitGridCell` 委托，命中半径 ×zoom）+ `layout-camera.test.ts`（回环 / 恒等档逐位 / 反例自检半径不随缩必红 / DPR 2·3 桩）。
  - Z3 `view-model.ts` 几何读 `snap.gridPitch/gridCell`（=layout.cell/pitch，恒等档=常量）+ 格心可视窗剔除（免 clip）；`state.ts` 快照扩两字段；bead-render 零改动。
  - Z4 `beads-game.ts` `_readInput` 三态（棋盘区 tap 抬起提交、区外按下不变、单指 drag→平移、双指→捏合）+ `_camera`/`_gesture` 字段 + setup 复位；`frame-order` fo-3 / `phase-input-realchain` game-over 两处帧账按 2 帧 tap 语义迁移（诚实改，非凑绿）；新增 `board-input-timing.test.ts` 正面证 down 不落/up 才落 + drag 不落。
  - Z5 `board-camera.ts`（`createGesture/applyPinch/applyPan/clampCamera/resetCamera`，纯函数、pinch 相对倍率、ponytail 注：中心锚 zoom，focal 待 playtest）+ `board-camera.test.ts` 9 例。
- **未完（诚实登记，未打假勾）**：
  - **Z0 真机 spike ⛔**：Cocos 逐指点 `touch-start`/`getID()` 形态未取证（无编辑器/无 AppID/无真机，ADR-0009 P2）；解除前 甲′ 在 Cocos 侧「未证可行」，若否证则 `bindings.ts` 补 `getTouches()` 遍历（不触 core）。
  - **Z6 QA/UX 派生文档回写**：`production/qa/beads/test-cases.md` §A2/§A3 抬起提交形态 + zoom/pan Node 用例 + 真机 P0（zoom≠1 棋盘命中）挂账；`ux-spec §4/§5` 抬起提交 + 动效起算点后移回写（GDD `input-control v2.5`/`core-loop v2.1` 已翻转，派生文档待镜像，属 K-053 反转批收尾）。
  - **§3 数值**：位移阈值 `BOARD_TAP_MOVE_THRESHOLD=8`、`CAMERA_ZOOM_MIN/MAX=1/3` 均为 tuning 工程占位 `[待确认]`，未进 §3；最终值走 §3 变更单 + playtest。
- **门禁**：`framework:sync:check` ✅ · `cocos:check` ✅ · `check:size` ✅ · `typecheck` ✅ · `test` ✅。

- **真机三反馈修正（2026-09-18 用户复验后，同单续做）**：
  - **①「只能缩放不能拖动」根因确诊**：`_readInput` 的 `onBoard` 旧判据 = `_hitGridCell != null`（须命中某格半径），真机拖拽从格间隙/盘面留白起手 ⇒ 判为区外 ⇒ 从不进拖拽态。**改**：`onBoard` = 落点在 `PUZZLE_BAND` 整块（起手域，非命中格）；tap 提交仍走 `_handleTap` 内部命中裁决。
  - **②「缩放要有限度 / 拖不出屏」**：`clampCamera(cam, cols, rows)` 重写为内容边界夹取——缩放界 `[fit, fit×CAMERA_ZOOM_MAX_SPAN]`；平移 `maxOff = max(0,(boardPx − viewport)/2)`：棋盘 ≤ 视口时 offset 锁 0（居中、拖不动也拖不出屏），> 视口时可滚到四角但棋盘边缘永不离开视口、不露空白。`clamp` 归一 `-0`（防渗进快照）。
  - **③「初始居中不贴边」**：新增 `computeFitZoom(cols,rows)=min(1, 含 BOARD_FIT_MARGIN 适配)` + `fitCamera`；`_setupLevel`/`_loadStage` 初始相机改 `fitCamera`（大盘缩到含边距居中；小盘 fit=1 恒等 ⇒ 旧基线/测试零漂移）。
  - **数值全部 `[待确认]` 工程占位**（`BOARD_FIT_MARGIN=24`、`CAMERA_ZOOM_MAX_SPAN=2.5`、`BOARD_TAP_MOVE_THRESHOLD=8`），未进 §3；真机手感调参走 §3 变更单。**pinch-focal 锚定仍 ponytail 占位（中心缩放）**。
  - **验证**：beads **489 例绿**（`board-camera.test.ts` 12 例锁 fit/夹取/相对倍率；`layout-camera` 回环+恒等锚+反例；`board-input-timing` 抬起提交正面判据）、`verify` **17/17**、`framework:sync` 镜像。Cocos 逐指点派发经本轮真机「能缩放」反证成立 ⇒ **Z0 `[C]` 前置解除**。

- **Z6 派生文档（2026-09-18 续，本单末批）**：
  - `production/qa/beads/test-cases.md` v1.13（严守真）：§A2/§A3/§A4 输入判据按 `input-control v2.5` 抬起提交改写（旧口径删除线留档）；新增 §A4c 缩放/平移用例，分 **Node 可证 9**（回环 / 反例自检 / 恒等锚 / 输入槽 / 抬起提交，落点 = 本单四测试文件）+ **待执行 7** + **真机 ⛔ 5**（zoom≠1 命中 = P0）；三数值 `[待确认]` 不作判据。
  - `games/beads/design/ux/ux-spec.md` v1.9（文策渊）：§4 状态×输入矩阵 抬起提交 + 新增 drag/捏合 两行 + 区外「按下即响应不变」标注；§5 动效表 11 处「起算点 down→up 后移注」+ K-052 重跑清单 + 未加注白名单（防全表重跑）；§3 零改动。
  - **工作树卫生**：期间 `board-camera.ts`/`.test.ts` 被编辑器自动 2→4 空格重排致 `framework:sync:check` 转红（`git diff -w` 空＝纯空白），已 `git checkout HEAD` 回退（仓库 2 空格约定），镜像复一致。
- **⚠ QA 本单查出、待主理人处置的缺陷/漂移（未在本单改码）**：
  - **F1（P1，代码真缺陷）**：同一固定步内 `down+up` 到达时，`_readInput` 的 `if(justDown){…return}` 吞掉同快照 `justUp` ⇒ 棋盘区快速点击丢提交 + `_tapActive` 悬挂。真机 <16ms 快点概率低不为 0、自动化探针 100% 触发。修法建议：justDown 分支内若同帧 `justUp` 则位移恒 0＝即时 tap，当场抬起提交。**⇒ 已修于 WXG-T-170**（用户 2026-09-18 授权）。
  - **F2（P3）**：位移度量口径——GDD §2.1 写切比雪夫，实现为曼哈顿 `|dx|+|dy|`；阈值未冻结不判 FAIL，但形态须先于定值裁定。**⇒ 已修于 WXG-T-171**（用户 2026-09-18 拍板**甲 · 切比雪夫 L∞**，代码 `sum`→`max` 1 行）。
  - **F3（P3）**：ADR-0015 §3.4 / GDD「相机复位归**恒等**」与本单真机反馈③改用的 `fitCamera`（第 8 关 fit≈0.9518）措辞漂移；须回写 ADR/GDD 复位口径为「归 fit 初始」。
  - **U11（文策渊登记）**：`core-loop v2.1` 注②称扫光整链挂抬起帧，但道具卡属区外（按下即响应）⇒ 两上位口径张力，待主理人裁。

---

## WXG-T-170

**beads·F1 同固定步 down+up 丢 tap 修复** · 负责：主理人(Qoder) · 状态：✅ 完成 · 上位决策：`WXG-T-169 §A4c.4-F1` 移交、用户 2026-09-18 直接授权「执行 F1」（修法预先写定，未选其他方案）· 前置判据：`input-control.md` v2.5 §2.1、`ADR-0015` C-3(a)

- **背景**：`WXG-T-169` 收尾时严守真 QA 轨发现 `beads-game.ts::_readInput` 首分支 `if(snap.justDown){…onBoard…return}` 吞掉同快照 `justUp` ⇒ 同一固定步内 `down+up` 到达（真机 <16ms 快点、自动化探针 `tapChain()` 同形）时，棋盘区快速点击丢提交且 `_tapActive` 悬挂（`endFrame` 即清一次性标记，下一帧 `_prevDown=false`，`justUp` 不再复现）。`TC-SUB-06` 无落点。
- **修法**（一行守卫，就地提交）：`onBoard` 分支内登记完成后不直接 `return`，而改为 `if (!snap.justUp) return;`。同帧 `down+up` 时不 `return` ⇒ 下面 `_tapActive && snap.isDown` 守卫自然跳过（owner 已抬 ⇒ isDown=false）⇒ 进入 `justUp` 分支：`_tapActive && !_tapMoved && !_pinched` 成立（刚登记后三者均为 false）→ 就地提交，随后复位。**语义与旧行为向后兼容**：区外 `justDown` 仍当场提交（包入 `else` 分支，行为逐字不变）；多帧 tap（down 帧不提交、up 帧才提交）仍走原分支。
- **落码**：`games/beads/src/game/beads-game.ts::_readInput` onBoard 分支（+8/− 2）；新回归例：`games/beads/tests/board-input-timing.test.ts` “同固定步 down+up” 一例（先跑→红→修→绿，另含后续空帧不重复提交反验）。
- **验证**：beads **490 例绿**（489 旧例零改动 + 本例，`verify` 中）、`framework:sync:check` ✅（本单不触 `packages/framework/**`、无需镜像）、`typecheck` ✅。
- **未干（不属本单）**：`TC-CAM-DEV-03`（Cocos 逐指派发形态与亚帧事件归属）仍 `[C]`⬜，不属本单 Node 可证范围。F2/F3/U11 属口径/设计轨裁决，不在本单。
- **门禁**：`framework:sync:check` ✅·`cocos:check` ✅·`check:size` ✅·`typecheck` ✅·`test` ✅。

---

## WXG-T-171

**beads·F2 棋盘 tap/drag 位移度量形态裁决** · 负责：主理人(Qoder)→文策渊(design)+程基岩(eng)+严守真(QA) · 状态：📋 已立项待裁（形态四选一，推荐甲）· 上位决策：`WXG-T-169 §A4c.4-F2` 移交、用户 2026-09-18「派发任务」· 前置：`input-control.md` v2.5 §2.1、`ADR-0015` C-3(a)、`beads-game.ts:1849-1851`

- **背景**：v2.5 GDD `input-control §2.1` 明写「切比雪夫位移判定」（第 26 行：`BOARD_TAP_MOVE_THRESHOLD`（**切比雪夫**位移判定，单位 px））；`beads-game.ts::_readInput` 实现为 **曼哈顿** `Math.abs(dx) + Math.abs(dy) ≥ BOARD_TAP_MOVE_THRESHOLD`。QA §A4c.4-F2 可构反例：偏移 `(5, 5)` ⇒ L1=10≥8 判 drag，L∞=5<8 应判 tap（当前行为与 GDD 字面语义不一致）。因阈值 `BOARD_TAP_MOVE_THRESHOLD=8` 属 `[待确认]` 工程占位、未进 `systems-index §3` ⇒ **不判 FAIL**；但形态先于定值（否则定值时测得手感与运行行为不同形，K-053 同族风险）。
- **范围与不范围**：
  - **范围**：仅裁**度量形态**（L∞ / L1 / L2）；不裁**阈值数值**（数值仍 `[待确认]`，属另一批走 `systems-index §3` 变更单 + playtest）。
  - **不范围**：不拓其他输入判据（`§2.1` 区外/捏合/拖拽逐帧行为均不变）；不重新基定命中半径与格度。
- **裁决四选一（待用户拍板）**：
  - **甲（推荐）· 切比雪夫 L∞ = max(|dx|,|dy|)**：与 GDD v2.5 字面一致；代码改 1 行（`sum`→`max`）；判定域 = 正方形（与盘面格子自然对齐，手指抖动「不越格」直觉）；斜向 5,5 不越阈 → 判 tap（对手指拖抽宽限）。
  - **乙 · 曼哈顿 L1 = |dx|+|dy|（实现为准）**：代码不动，GDD 回写 1 行（切比雪夫→曼哈顿）+ 变更记录；判定域 = 菱形；斜向 5,5 位移 L1=10≥8 → 判 drag（drag 对斜向更敏感）。
  - **丙 · 欧氏 L2 = hypot(dx,dy)**：直觉「真距离」；代码 1 行 (`Math.hypot`)；判定域 = 圆；需同时改 GDD 与代码；引入开方，热路径性能轻微下负（但本分支已仅手势帧，不属固定每帧热路径）。
  - **丁 · 延后**：与阈值定值一批处理（playtest 时同形同值一起测）。**风险**：GDD 与实现长期并存漂移，下游阅读 GDD 的任何人（包括本仓自身未来会话、新成员）需自行判断哪个为准，K-053 同族。
- **依赖序（拍板后启动）**：
  1. **主理人（用户）**拍板甲/乙/丙/丁。
  2. 若 **甲** ⇒ spawn **程基岩(eng)** 改 `beads-game.ts:1849-1851`（`Math.abs(…) + Math.abs(…)` → `Math.max(Math.abs(…), Math.abs(…))`），GDD 不动；同时 spawn **严守真(QA)** 新增反例判据（`(5,5)` 偏移应判 tap、`(9,0)` 应判 drag），`TC-CAM-*` 补一行，`board-input-timing.test.ts` 或新例。
  3. 若 **乙** ⇒ spawn **文策渊(design)** 回写 GDD `input-control §2.1`（切比雪夫→曼哈顿 + §7 变更记录）+ **主理人确认冻结**；代码不动；QA 补反例同 2。
  4. 若 **丙** ⇒ 同时 spawn 设计轨（回写 GDD：切比雪夫→欧氏）+ 工程轨（`Math.hypot`），QA 同 2。
  5. 若 **丁** ⇒ 本单挂起、不 spawn，入 backlog（需带一个「不先裁漂移风险已接受」的注）。
- **不触及**：`systems-index §3`（阈值未冻结，本单不动 §3）；ADR-0015（度量形态属实现细节，不属架构）。
- **预计交付面**：代码或 GDD 中一边改（**不会**两边同时改）；QA 补 1 反例（与裁决同形）；本单一行回写（裁决后自动）。
- **风险**：丁（延后）一旦选，下个接触阈值定值的任务（playtest 批）必须同时重开本单，拖链 K-053 反转批周期。
- **完成定义**：裁决选定 → 对应成员交付 → `verify` 17/17 → 本单 ✅（包括反例绿）。

- **完成记录（2026-09-18 本会话）**：用户拍板 **甲 · 切比雪夫 L∞**（同推荐）。实际交付与依赖序中「甲」分支一致：
  - **工程轨（程基岩，主对话直行）**：`beads-game.ts::_readInput` L1849–1851 `Math.abs(dx) + Math.abs(dy)` → `Math.max(Math.abs(dx), Math.abs(dy))`（+5/− 2行，含注释）。`tuning.ts::BOARD_TAP_MOVE_THRESHOLD` 注释同步补「**切比雪夫 L∞ = max(|dx|,|dy|)**」；阈值数值仍 `8 [待确认]`，**未进 `systems-index §3`**（属另一批）。GDD `input-control §2.1` v2.5 不动（实现与 GDD 现已一致）。
  - **QA 轨（严守真，主对话直行）**：`board-input-timing.test.ts` 新增 1 例「位移度量 = 切比雪夫 L∞（F2 回归例：(5,5) 应判 tap）」；先跑→红（L1 下判 drag ⇒ 不提交）→修→绿。反验区选 L1=10 / L∞=5 中间阈值 8 的分歧区；(5,5) 仍在盘格内部（格≈46 px），不会因跨格失败。
  - **镜像**：`framework:sync` 写入 2 件（beads-game.ts + tuning.ts），`framework:sync:check` ✅。
  - **验证**：beads **491 例绿**（490 旧例零改动 + 本例）、`verify` **17/17 PASS**。
  - **台账回写**：主表行状态 升 ✅；T-169 §A4c.4-F2 行标「已修于 WXG-T-171」；`production/qa/beads/test-cases.md` §A4c.4-F2 同步。

---

## WXG-T-172

**beads·F3 相机复位口径回写（GDD/ADR vs fitCamera）** · 负责：`studio-orchestrator` → 文策渊(design) + 程基岩(eng) + 严守真(QA) · 状态：🔄 已派单，待阶段 0 诊断与裁决 · 上位：`WXG-T-169 §A4c.4-F3` 移交、用户 2026-09-18 「走完整 spawn」 · 前置判据：`input-control.md` v2.5 §6、`ADR-0015` §3.4、`beads-game.ts:1724 / 1760`、`board-camera.ts::fitCamera / computeFitZoom`

- **背景（漂移）**：`input-control.md §6` 与 `ADR-0015 §3.4` 写「换关/重试/回菜单相机**归恒等**」（zoom=1）；但 T-169 真机反馈③将初始相机改为 `fitCamera`（大盘缩放适配，第 8 关 fit≈0.9518），代码与字面语义不等价。
- **候选口径（待主理人拍板，推荐以实现为准）**：
  - **甲（推荐）· 以实现为准**：回写 GDD/ADR 「归恒等」→「归 fit 初始」（fit=min(1, 含边距适配)），小盘 fit=1 与旧恒等档等价。与 T-169 真机反馈③ 同方向。
  - **乙 · 以 GDD 为准**：代码回退到恒等（fitCamera 仅用于首次入场，复位回恒等）。风险：重新引入 T-169 真机反馈③「初始不贴边」问题；169 已删旧行为基线、回退会拆基线。
- **三成员任务（待 orchestrator 阶段 0 确认拆分）**：
  - **文策渊(design)**：基于裁决结果回写 `input-control.md §6` + `ADR-0015 §3.4`（含变更记录）；不自动定稿，需主理人确认。
  - **程基岩(eng)**：若甲，核对 `beads-game.ts` 复位代码与 GDD 新口径一致，必要时补注释（不改行为）；若乙，回退代码到恒等（需与 T-169 真机反馈③ 同方向）。
  - **严守真(QA)**：`TC-CAM-08` 目前「待执行」，裁决后补落点（Node 可证：相机 `_setupLevel`/重试/回菜单后 zoom==fit）。
- **不触及**：`systems-index §3`（fit 本身不是新常量）；`board-camera.ts` 内部实现。

- **完成记录（2026-09-18 本会话，三成员 spawn 交付）**：用户拍板**甲 + 附裁 5→2**（同 orchestrator 推荐）。实际拆分与派单方案完全一致。
  - **D1·文策渊**（design-strategist spawn）：`input-control.md §6` 相机复位行 回写「归 fit 初始」（不钉数值，不删原行标签），头注升 v2.7、§9 新增 v2.7 行。§8-4 中的「恒等档」（= zoom=1 取值档）与本次不同口径，**未改**，行号与理由入 §9 v2.7。
  - **E1·程基岩**（engineering-lead spawn）：`ADR-0015 §3.4` 回写：复位档=fit 初始（非恒等）+ 5 个复位点收敛为实际 2 点（`_setupLevel` / `_loadStage`）+ 回菜单/后台隐藏归「下次装配兜住」+ `InputManager.reset()` 非复位点（原文误列已删）+ `resetCamera()` 保留（测试工具，不在复位链上）；头部新增修订行（沿 ADR-0011 既有约定，不新造修订史节）。
  - **E2·程基岩**：`beads-game.ts:1724 / :1760` 各补 2 行注释（零行为改动）；`computeFitZoom` 头注已含「initial view」口径，不重复加。
  - **E3·程基岩**：`board-camera.test.ts` 新增 5 例（TC-CAM-08 新落点）：13×12 大盘归 fit（fit<1）、**6×5 小盘 fit=1 与旧恒等逐位相同**（回归锚，与 layout 逐项比）、重试（大盘 120s 烧穿 → retry → 归 fit）、冲刺换 stage（真链 stage0→1 + 大盘 stage7）、**后台隐藏当帧不复位→下次装配兜住**（新口径负向锁）。**变异自检**（K-036）：临时注掉复位点① `fitCamera` ⇒ 5 例中 4 例必红（stage 例仍绿因走复位点②）⇒ 证真实判别力，两点各自有独立覆盖。
  - **Q1·主对话代落笔**（严守真 readonly）：`test-cases.md` TC-CAM-08 升 ✅ 已验（WXG-T-172）；§A4c.4-F3 行标「已修于 WXG-T-171」。新判据正文 = E3 实际断言，不钉字面值。
- **验证**：beads **496 例绿**（491 旧例零改动 + 5 新例）、`framework:sync:check` ✅、`typecheck` ✅、`check:arch` ✅（1 warning 属既有编辑器产物）、`check:es5spread` ✅、`ctx:check` ✅、`verify` **17/17 PASS**。
- **同批新发现移交（不并入本单、需另单或归现有轨）**：
  - **F3-a**（`ADR-0015 §3.4` L168「相机三标量进快照」同类文档漂移）：实现中快照不含 zoom/offset（相机烘进 `gridLayoutFor`，非下发）⇒ **另开一单清偿**（避免本单范围吹大）。
  - **F3-b**（`ADR-0015 §3.4` 钳位条 z<1 与 `TOUCH_MIN=88` 底线未裁）：`TC-CAM-DEV-05` 属 §3 变更单一批（连带 `BOARD_FIT_MARGIN` / `CAMERA_ZOOM_MAX_SPAN` / `BOARD_TAP_MOVE_THRESHOLD` 三占位值），不在本单。
  - **F3-c**（`ADR-0015` 头部状态行「本文仍不落码」，T-169 已施后未回写）：属事实校正一句话，下一批 ADR 回写时顺带。
  - **F3-d**（`ctx/index.json` 中本 ADR token 估计现值 11343 为改前）：ctx:check 仍 OK，留给下一次统一 ctx 刷新（避免为同批其他未收尾文件生成索引）。
- **与 T-169/T-170/T-171 一致性自查**（orchestrator 阶段 0 预定检查点）：
  - `fitCamera` 语义与 `board-camera.ts` 头注 V5「initial view + zoom-out floor」同向✅；小盘 fit=1 与旧恒等逐位相同一句写在 GDD/ADR 正文与 E3 例② 中，**486→496 基线不拆**。
  - `input-control §2.1` 中「切比雪夫」（T-171 F2）未触碰✅。
  - `_readInput:1834` sub-frame tap 提交（T-170 F1）与 `_readInput:1849–1855` L∞（T-171 F2）**不属本单接口**，未碰✅。
  - ADR-0015 §3.5 C-3(a) 分区 未触碰（本单只改 §3.4）✅。


---

## WXG-T-173

**beads·U11 扫光链起算帧归属裁决** · 负责：`studio-orchestrator` → 文策渊(design) + 程基岩(eng) + 严守真(QA) · 状态：🔄 已派单，需用户先裁 · 上位：`WXG-T-169` 中 `U11` 条目（文策渊登记）· 前置判据：`core-loop.md` v2.1 §8 末「时基位移注」② 、`input-control.md` v2.5 §2.1、`ADR-0015` §3.5 C-3

- **背景（两上位口径张力）**：`core-loop v2.1 §8` 注② 写「扫光与道具链整链挂**抬起帧**」（包括解环器相 A 200ms → 逐颗 80ms → 落座收尾）；但道具卡属**区外**，`input-control v2.5 §2.1` 明写「HUD / 托盘 / 道具卡 / 扩展钮 / 面板 仍**按下帧响应**」（T-169 C-3(a) 分区提交）。两上位口径对「`powerup:used` 发射与扫光链起点」归属不一致。
- **候选方向（待文策渊出完整三方案 + 主理人拍板）**：
  - **甲 · 拆两套扫光链**（推荐先评估）：棋盘区扫光（归位/取回引发）挂抬起帧；区外扫光（解环器引发）挂按下帧。`core-loop §8` 注② 改写为拆两套。
  - **乙 · 道具卡例外后移**：道具卡提交时基从按下改到抬起（破坏 T-169 C-3(a) 分区），与棋盘区同。
  - **丙 · 拆事件不拆时基**：`powerup:used` 仍在按下帧（区外不变）；扫光链的「与珠互动部分」（如逐颗 80ms 重启门）挂抬起帧（仅当同帧也有棋盘提交时）。
- **三成员任务（拆阶段）**：
  - **阶段 1（前置）**：spawn **文策渊** 产出三方案完整利弊（MDA/手感、K-052 同族时长常量影响面、下游判据影响）→ 主理人拍板 → 阶段 2。
  - **阶段 2**：按裁决 spawn：
    - **文策渊**回写 `core-loop.md` 注②（拆/不拆两套）与相关判据（如 `input-control §8-11`）。
    - **程基岩** 若需改行为（乙）→ 改 `_readInput` / `_handleTap` 中道具卡提交时基；否则仅注释。
    - **严守真** 补/改 QA 判据（扫光链起算帧的下游时长实测口径，`TC-*`，真机 playtest 部分仍 `[R]`）。
- **不触及**：`systems-index §3`；`ADR-0015` 本体（属实现细节口径，不改架构）。
- **风险**：三方案中乙会直接推翻 T-169 C-3(a) 已裁分区，风险最高；丙需确认「事件拆不拆」与 K-052 同族时长实测可验；甲保留两套机制但下游口径需拆。

- **阶段 1·D0 回传（2026-09-18）**：文策渊报告排序 = **丁 ≫ 甲 > 乙 > 丙**；**丙不推荐**（「同帧既有道具链又有棋盘提交」与 `core-loop §2.2.2`「每帧 ≤1 条输入指令」冲突，且「逐颗 80ms 重启门」在代码不存在——80ms = stagger 间隔，120ms 门属手动连点侧独立队列）。**关键洞察**：「一旦把甲的前提修正为「只有一套扫光、挂按下帧」，甲塌缩为丁」。代码事实确认扫光唯一源 = `_armSweepFx` 定义 `beads-game.ts:2904`、**全库唯一调用 `:1022`**（`powerup:used` 同栈）；区外走 `:1835–1837` 按下帧；逐颗链由 `_stepSolverFx:2868–2881` 计时驱动与 tap 无耦合。用户拍板 **丁**。

- **阶段 2·完成记录（2026-09-18 本会话，三成员 spawn 交付）**：
  - **D1·文策渊**：`core-loop.md` 升 **v2.2**，§8 注② 摘出，**保留编号 ② 占位不重排**（防断 ux-spec / test-cases 对注 ①③④ 的引用），新增 U11 修正声明（含代码事实 4 项 + K-053 反转精神——「注② = 勘误、属修正性撤注」）；K-052 重跑清单**仅撤销「解环器 200ms 重启门」一项**（因其起算点未位移），三族重启门 120/250/500ms 与 §3.8「≤2 次/秒」预算重跑令**不撤销**。`ux-spec.md` 升 **v1.10**，§4:163（保留「区外·按下即响应」分区正面标注）、§5:222/§5:225 **逐字节回到 v1.9 前**（与 `git show 79f217a` 比对确认）；§5 表头与「未加后移注行日」同步；§8 U11 行 升 ✅ 已闭合。
  - **E1·程基岩**：`beads-game.ts:2904` `_armSweepFx` 头注 JSDoc 内补 **2 行注释**（零行为改动），信息要素：扫光起点 = 按下帧 + 全库唯一调用点 `:1022` + 引用 `core-loop v2.2 §8` 注②。`framework:sync` 镜像。**未碰**：T-170/T-171/T-172 已锁基线（`:1834` sub-frame tap 提交 / `:1849–1855` L∞ / `:1724/:1760` fitCamera 注释）均原样。
  - **Q1·主对话代落笔**（严守真 readonly）：`test-cases.md` 升 **v1.14**，头部 L3 任务号列追加 T-170/171/172 修复批 + T-173 U11；**L140 下游后移清单 摘②**（与 `core-loop v2.2 §8` 新正文逐字镜像，QA 不自造）；TC-PER-21 / TC-PER-23 **已验读数全继续有效**（零迁移）。
- **验证**：beads **496 例绿**（零新例、零旧例迁移），`framework:sync:check` ✅、`typecheck` ✅、`check:arch` ✅、`check:es5spread` ✅、`ctx:check` ✅（hot-file 行号/超限门全过）、`check:links` ✅、`verify` **17/17 PASS**。
- **与 T-169/T-170/T-171/T-172 一致性自查**（orchestrator 预定检查点）：
  - `input-control §2.1` 中「切比雪夫」（T-171）与「区外按下即响应」（T-169 C-3(a)）**均未触碰**——本单**加强** C-3(a) 分区而非推翻✅。
  - `_readInput:1834/:1849–1855/:1835–1837` 三处锁基线未碰✅。`ux-spec §5:210` 未加后移注行白名单与 §4/§5 其他 9 处真后移族行逐行未动✅。
- **同批新发现移交（不并入本单，需另单或归现有轨）**：
  - **U11-a（重要）**：`core-loop v2.2 §8` 注③「过关判定帧」仍写「`level:cleared` 恒挂 `bead:placed` 同栈⇒随抬起后移」——但 `beads-game.ts:1017–1019` 明文解环器「本帧只点名不动手 ⇒ `bead:placed` 与过关判定全部推到相 B 到点帧」⇒ 解环器支路下的 `level:cleared` 不以 tap 时基起算，**③** 在支路上不成立。**推荐另批一单为 ③ 补「支路例外」半句**（与本次同构、代价最小、不动判据 5）。本单只登不裁。
  - **U11-b**：「解环器 200ms 重启门」在代码里其实是 `SOLVER_HINT_MS`（相 A 时长）而非门。本单不改数值、不裁术语；撤销理由只挂在「起算点未位移」上。是否重命名属下一批。
  - **U11-c**（行号锚型注释）：本次代码注释引 `:1022` 作为锚（位于注释之上），属可接受的长期可度量式锁定（行号锚本系仓内惯例）；若上方未来插行将漂。缓解方案（主对话行号锚型注释行号预验）可归 `knowledge/lessons` 候选。
- **风险声明**：真机手感（按压时长 → 后移量 `[待确认]`）无 AppID / 无真机 ⇒ `[R]` 未验；本裁决只锁帧归属，不声称已验手感。与 `TC-CAM-DEV-01..05` 挂账同族。




