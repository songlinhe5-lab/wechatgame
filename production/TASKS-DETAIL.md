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

### 收口（2026-09-19，CodeBuddy 会话 · 待裁③ 裁定 + QA 漏回写补记）

- **待裁③ 裁定 = 甲（用户 2026-09-19 拍板）**：「level-clear 下扫光是否应继续播完」由「规格未定义」改为**明文写入「臂起后恒播满、不因状态切换中断」**。
  - **技术事实（与旧登记相反，纠正本节约 `:110` 的③表述）**：原文曾登记「`_stepSweepFx` 只在 playing 推进 ⇒ sweep 相位恒 0」——**该登记不成立**。三级链路（步进 `beads-game.ts:2914` / 快照 `:3149` / 视图 `view-model.ts:1258`）**均无状态门**；`_stepSweepFx` 与 `_stepConfettiFx` 同属**表现层步进组**（`_update` 末尾，`:770`）。真相 = v2 期是**取证构造**问题（未臂起），v2.1 换构造后已 5/5 帧取得。
  - **决定性论据（与既有裁定同源）**：① 层序 `drawSweep` **在面板之下**（`view-model.ts:220` 注释）；② `CLEAR_PANEL_DELAY_MS = WAVE_MS = 800`（`tuning.ts:703`）⇒ **400ms 扫光必然在面板打开前播完**（`ux-spec §5:238` 裁定 1「庆祝先行放完再落遮罩」）；③ G6 彩带本就是「`level-clear` 臂起、播满 800ms」⇒ 扫光与其**同判例**。**「给扫光加 `playing` 门」= 错误修法**（与 ①②③ 全部分叉）。
  - **落码（零实现改动 = 以实现为准回写）**：`art/assets-spec §1.6.3` 新增「**状态无关性**」条（含三理由 + 判据指引）；`ux-spec` 升 **v1.13**（头注 + §5「道具生效」行补注）；**`§3` 冻结数值零改动、400ms 一字未改**。
- **判据（新 1 例 + K-036 变异自检）**：`tests/scene-vfx.test.ts` 新增「裁定『恒播满』…solver 归位致过关 ⇒ 扫光不被掐断、仍走完 400ms」（G3 命令层组 7→**8 例**）。
  - **构造难点与解法（诚实记录两次失败）**：① 首版用 `noAssemble: true` + 手动 `fill` ⇒ **solver 点名了但棋盘纹丝不动**（手动填充未建内部索引）⇒ 改**默认装配**；② 改默认装配后探针实测 **217ms 归位完毕、367ms 过关，此刻 `sweepProgress = 0.917 > 0`** ⇒ 观测窗口真实存在（过关早于 400ms 扫光归零）。
  - **⚠️ 变异自检暴露的自身缺陷（重要）**：给 `_stepSweepFx` 加 `playing` 门后，**首版判据仍会通过**（门令扫光**冻结在非零值** `0.79` 而非归零 ⇒ 「过关帧 `sweepProgress > 0`」这条**无判别力**）⇒ 判据主体改为**「过关后仍在推进（`> pAtClear`）+ 到点归零」**两条；复跑变异：该例红于 `expected 0.79 to be greater than 0.79` ✓ **判别力确认**。该自检记录已写入判据注释，防后人误把弱断言当主体。
- **QA 两处漏回写补记（属 2026-09-18 收口批遗留，非新判据）**：`test-cases` 升 **v1.16**——
  - **TC-PER-21**（G3 扫光）与 **TC-PER-26**（G6 彩带）的 `[Cocos]` 栏由「**待执行** ⇒ 整条不判 PASS」转「**已验（2026-09-18 人眼判读）**」，证据 = `evidence/vfx-burst{,-l1}/` v2.1 帧；**两条均附效力边界**：判读对象 = web-mobile 产物连拍、**非真机屏** ⇒ **不冒充 `[Device]`**（真机亮度/刷新率差异归首验包 P0-2/P1-6）。
  - **TC-PER-26 差异②闭合回填**：原「公式字面移植 = 上行出屏 / 待 art 复验」是**登记漂移**（2026-09-17 用户已认可）⇒ 改记「设计坐标 y 向上 ⇒ 公式递减 = 屏面下落，与『飘落』文案一致，**公式与规格本体零改动**」（`:105` 已清 `scene-vfx.ts` 注释，本次补齐 QA 表一侧）。
  - **零软化声明**：判据意图零软化、阈值零改动、本表其它行未动；变更记录表**仍缺 v1.10–v1.14 五行**（沿 v1.13 ⑦ 口径只登记不代写）。
- **落笔人非本域正主**：QA 表与 `ux-spec` 代落盘（承 T-146 / T-172-Q1 / T-173 判例），**待严守真 / 文策渊复验**。
- **收口结论**：本单**可推进项全部闭合**（落码 5 单 + 规格待裁归零 + `[Cocos]` 判读与状态回填 + 待裁③ 裁定）；**真机侧唯一余项 = 首验包 P1-8 集中走查轮**（2026-09-19 新挂，跨 T-164/165/168/169，依赖 AppID 扫码）⇒ **移交真机轨，不阻塞本单验收**；主表状态由「🔄 待真机首验」改 **✅ 完成**。

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
- **P1-8 缩放/平移与周边设备面（集中走查轮，2026-09-19 挂号）**：① **zoom≠1 时棋盘命中精度**（QA `test-cases.md §A4c` 真机 ⛔ 5 条，**P0**——屏→设→棋盘逆变换同 BD-48/T-129/T-161 一条通道，K-037）；② 单指拖拽不拖出屏 / 大盘初始居中不贴边（T-169 真机反馈①③修后复验）；③ 回主菜单弃本局棋盘（T-165）；④ 托盘 12 槽只显示 1 行实线 + 点槽定落位/部分收纳（T-168）；⑤ 菜单入口与体力回满广告链（T-164 收口移交项）。**仍靠 `build:cocos --release` 出包 + 扫码**（前置同本节头）。
- 以上全过 ⇒ G4 的 DEV-01 解除，可议升 PASS；任何一条红 ⇒ 按 BD-40 先例登记并回修。

---

## WXG-T-164

**beads·元游戏页族反转冻结回写 + 批0 落码（体力/钱包/振动）** · 负责：主理人(Qoder) · 状态：✅ 收口（2026-09-19：六文回写 + 批0 落码已随 `79f217a` 入库；真机首验其性 OK（P0-D 元游戏），菜单路由一项由 T-165 反转并已落码；收口批补完 T-165 漏回写面；批1/批2 另单）

- **用户八项拍板（2026-09-18 两轮）**：一轮 = B Shell 双对象 / 分批 0-1-2 / 本地榜+好友置灰 / 装体力+广告+钱包；二轮 = **体力宽容包 B**（上限 8、8 min/心）/ **钱包 A 包**（买心阶梯 + 头像框）/ **装触觉振动**（`VIBRATE_DEFAULT=ON`、仅 isMiniGame 显示行）/ 首启仍直进玩法。
- **冻结回写（六文，已落定）**：systems-index **v1.28**（新 §3.14 体力与钱包：`STAMINA_MAX=8` / `STAMINA_REGEN_MIN=8min/心`（离线恢复 f(Δt wallClock)、登录钳上限）/ `STAMINA_START_COST=1` / 回满 = 激励视频第二 live 位 / 签到第 3/5 天各 1 心（溢出即弃）/ 钱包获取仅签到币·周榜结算·通关首通、消耗 = 买心（阶梯价不冻结 `[待 playtest]`）+头像框 / Won't = 只发不耗·币购道具；§3.8 `VIBRATE_DEFAULT` 新冻结 + 屏震行语义钉死；§3.11 激励主位 1→2、体力移出 Won't；§1 S10 行 + S9 行；§4 meta 域事件 5 行）+ changelog v1.28 行；ux-spec **v1.7**（§1 原则 1 / §2 流程主菜单+overlay 栈 / §6.3 补注 / §8 更正，**启动路由零改动**）；concept **v1.4**（§5 / §7 meta 页族行 + Won't 改写 / D10 反转）；meta-framework **v1.1**（M4/M5 反转 + 三货币条件解除 + §7 分批计划）；pause-settings **v1.3**（回主菜单次钮 + 震动行 + §8 判据 11/12）。
- **语义裁定（本单新增澄清）**：扣心时机 = **新局开局/重试**；~~PAUSED 恢复与菜单在途续进不重复扣心（保留进度不惩罚）~~ → **后半句已随 WXG-T-165 反转**：回主菜单弃本局棋盘，菜单「开始游戏」恒全新开新局扣 1 心（局内暂停「继续游戏」仍不扣心）；签到送心溢出即弃；阶梯价表不冻结归 `tuning.ts` 候选（判例 `SPRINT_K_CURVE`）。
- **批0 落码范围（进行中）**：shell（BeadsShell 双对象）/ meta-state / meta-save-schema（sidecar v1；settings v4 = +vibrate）/ menu-route（暂停次钮→菜单、菜单主钮恢复/新开——**主钮「恢复」分支已随 T-165 反转删除**）；scenes = menu / settings overlay / signin overlay；services = signin（wallClock 自然日判定、循环制断签不清零）/ stamina（离线恢复钳上限）/ wallet（获取三源+买心消耗）；meta-view 只读 + ui-kit 程序化图元 + harness `?meta=` 注入；`gdd/meta-ui.md` GDD 同批建（S10 行预约；**实际未随批，已移交批1**，见收口批）。
- **retry/restart 逐次扣心（本单挂账已关闭，2026-09-18）**：玩法内 retry（normal）/ restartRun 经注入 `play` 的 `canStartRun` 闸门逐次扣 `STAMINA_START_COST`；sprint 不设门（§3.14 冲刺消耗不冻结）。**0 心拒绝路径 = 用户拍板 B（失败页看广告回满再重试）**：闸门拦下 → `_requestStaminaRefill` 拉起 `STAMINA_REFILL_PLACEMENT`（§3.11 第二 live 位，游戏侧字符串位不改冻结框架枚举）→ `onRewarded` 按 `_adKind` 分发（revive vs staminaRefill 共用单一订阅）→ `onStaminaRefill`→`MetaState.refillStamina()` 回满后重放 proceed 续体（MAX≥cost 必成功、无循环）。hook 而非事件（不动 §4 冻结表）；standalone BeadsGame（无 canStartRun）恒放行保 429 既有测试。新增 `tuning.STAMINA_REFILL_PLACEMENT` / `run-start-stamina.test.ts`（5 tests，真实 MetaState 端到端）。
- **门禁证据（本单 retry 扣心段）**：`framework:sync`（beads 写入 3）+ beads `tsc --noEmit` 净 + 全量 beads 测试 **458 passed**（453+5）+ `cocos:check` 两游戏过 + beads `--release` 重建（17.7s）+ `verify` **16/17**（唯一 FAIL = `check:secrets` project.config.json:22 AppID 既有挂账，非本单引入）+ ux-spec v1.8（§3.5 重试扣心注 + §4 矩阵 GAME_OVER 拆有心/0 心）。
- **待办（收口后口径）**：~~批0 落码与测试~~（已完成，`79f217a`：shell/meta-state/sidecar/settings v4/签到·体力·钱包内聚于 meta-state/menu 路由/meta-view/harness `?meta=`；458 绿）；~~真机复验（其性项）~~（2026-09-18 首验 P0-A..P1 五项均 OK，含 P0-D 元游戏：震动行/签到/体力扣心均正常；唯菜单路由一项当场裁定反转）；`gdd/meta-ui.md` GDD 与 ui-kit 独立图元层**未随批0 落盘**（已核 `ls` 证实不存在）→ **移交 backlog 无号行「beads 元游戏批1」**（前置 = 主理人裁 T-167 提案 Q1/Q2）；反转过后的设备面复验（回主菜单弃棋盘）→ **并入下次真机复验批**（与 T-165/168/169 的待复验项同批走查，不单开轮）；批1/批2 实施另单。
- **收口批（2026-09-19，本单关单依据）**：核账时发现 **T-165 的反转只改了 systems-index v1.29 / S9 行 / pause-settings v1.4，未跟 UX/概念两文**（正是判例 K-053 描述的「一对多回写漏点」），本批补齐：① `ux-spec.md` **v1.11** —— §2 流程图（次钮注 + 主钮分支两行）、§3.3 面板几何冻结注、§6.3 启动路径补注、§8 已裁定行共 **四处**旧「保留进度不惩罚 / 在途 PAUSED 恢复 / 不重复扣心」改注为**弃本局棋盘 + 菜单「开始游戏」恒全新开当前关扣 1 心**（旧裁定划线留档，启动三路径仍零改动）；② `concept.md` **v1.5** —— D10 行「有进度 → 续进在途局」作废；③ `proposals/meta-framework.md` **v1.2** —— §7 分批口径订正（体力/钱包服务改记已随批0 落码；批0 欠账明写归批1 并标 Q1/Q2 前置）；④ `systems-index.md` **v1.31** + changelog 同批 —— S10 行 `meta-ui.md` 待建归属由「批0」改记「批1」，并登记 v1.29 反转已镜像至下游。**代码零改动**；**§3 冻结值零改动**（无 `STAMINA_*` 漂移）。
- **收口批门禁与沉淀**：根 `verify` **17/17 PASS**（逐项不短路；含 `check:tasks` / `check:links` / `ctx:check` / `framework:sync:check` / test / `cocos:check` / `check:size`）；`kb:sync --task=WXG-T-164` 沉淀统计：**新增 0 / 修改 1（K-053 追加「反转批文档面不得写死枚举，须拿旧裁定特征短语全仓 grep 定范围 + 收口前复扫上位裁定」） / 激活 0 / 归档 0**；`kb:audit` 无归档候选、无相似命中（活跃 56 / 归档 0）；`ctx:build` 已刷索引面。**附带发现（不属本单，已回写 backlog）**：`ux-spec.md` 实测 **19587 tok**（HEAD 口径），而预算豁免 note 与 backlog 行仍写 8683 ⇒ 该到期条已据实刷新（本批增幅 +420，未触 >500 拆分线）。本批**未提交**（用户要求先看改动）。
- **入库（2026-09-18 提交会话）**：六文回写 + 批0 落码随 `79f217a` 提交（与 T-162 交织文件合笔，头注双挂）；本单 B4 门禁中 `check:secrets` 存量 FAIL 已由根配置 `.gitignore` 处置闭合（见 `## WXG-T-161` 处置核销，随 `2f62027`）。

---

## WXG-T-166

**beads·棋盘区双指缩放 + 单指拖拽（立项）** · 负责：程基岩(eng) + 文策渊(UX) · 主理人核销 · 状态：✅ **核销（2026-09-19）**——本单职责到「立项 + 报出前置阻塞」为止，阻塞与范围均已被 `ADR-0015` 应答、代码已由 WXG-T-169 交付；本单不再挂施工，余项已分流

- **缘起（P1 真机反馈）**：用户「缺个功能，可双指放大缩小、单指左右移动」。用户已钉范围 = **仅棋盘玩法区缩放/平移**（HUD/托盘/面板不缩放）。
- **设计已有意向**：concept v1.24/D13、systems-index v1.24 changelog③、ux-spec v1.6、input-control v2.2 已将「双指捏合缩放」列为 **Should**（无滑轨/按钮）。
- **前置阻塞（硬）**：框架 `InputManager` 为**单指针设计**（`_ownerId` 首指独占、`input-manager.ts:99`「Ignore secondary touches」），`InputSnapshot` 只暴露一组 x/y ⇒ **双指捏合无法在玩法层表达**。解锁需二选一（均需 ADR）：**(甲)** 扩 `core/input` 为多点快照（触 **L2** core 引擎无关 + 影响 breakout，面大）；**(乙)** Cocos 适配层新增第二条触摸通道→游戏专用服务（触 **L3**、适配层）。未裁。
- **高危面声明**：缩放后的「触摸→格子」需逆变换（屏→设→棋盘局部），**正是 BD-48/T-129/T-161 同一 hit-test 通道** ⇒ 不得绕过回归网直接实现（K-037 屏幕层取证）。
- **下一步**：待用户/主理人就甲/乙 定 ADR → 拆子任（框架输入扩展 / 棋盘变换建模 / hit-test 逆变换 / 缩放限幅与钓制 / 双拍复位）+ QA 判据。本会话不动 hit-test 通道。

- **核销记录（2026-09-19，Qoder 收口会话）——「范围 ↔ 交付」映射**（当时本单所列每一条阻塞都已有人做了，但本单行一直停在 📋，下一个读者会误以为还要再走一遍 ADR）：
  | 本单当初的阻塞/待决 | 现状态 |
  |---|---|
  | `InputManager` 单指针，双指无法玩法层表达；甲/乙未裁 | **甲′ 已落码**：`packages/framework/src/core/input/input-manager.ts` 第二指针槽（头注即标「WXG-T-169 / ADR-0015 甲′」），单指语义逐字不变、breakout 不受影响 |
  | 待 ADR | **ADR-0015 Accepted**：C-1=甲′ / C-2=丁-3 / C-3=(a)；C-4 并行开设计轨（T-167） |
  | 拆子任（输入/变换/hit-test/限幅/复位） | **T-169 Z1–Z6 全落**：`systems/board-camera.ts`（`computeFitZoom`/`fitCamera`/`applyPinch`/`applyPan`/`clampCamera`）+ `gridLayoutFor(camera?)` 命中同源 + `_readInput` 三态 + QA §A4c；含真机三反馈修正（①「只能缩放不能拖动」的 `onBoard` 域改判） |
  | 高危面：缩放后 hit-test 逆变换 | 按声明**未绕过回归网**：`layout-camera.test.ts` 回环 + 恒等档逐位锚 + 反例自检（半径不随缩必红） |
  | Z0 Cocos 多点派发取证 ⛔ | 经真机「能缩放」**反证解除** |
  | QA 查出的 F1/F2/F3 | 分别由 T-170 / T-171 / T-172 关闭（含 U11 由 T-173） |

- **余项分流（不并进本单，已逐处挂号）**：① **C-5 缩放后描边/缝隙随缩** → backlog 行（art 轨拍板，改后按 K-051 差分复算）；② **三个相机占位值 + F3-b 底线**（`BOARD_FIT_MARGIN=24` / `CAMERA_ZOOM_MAX_SPAN=2.5` / `BOARD_TAP_MOVE_THRESHOLD=8`）→ backlog 行归 §3 变更单（需 playtest 或用户给值，本批不伪冻结）；③ **pinch-focal 锚定**（现为中心缩放占位）→ 同属②的 playtest 项；④ **zoom≠1 棋盘命中真机 P0**（QA §A4c 真机 ⛔ 5 条）→ 已列入本节上方「真机首验包 P1-8」；⑤ GRID_MAX 扩容与图鉴宫格规格 → **设计轨** T-167（前置 Q1/Q2）。
- **本批同时清偿 F3-c**（T-172 当时选择「下一批顺带」）：`ADR-0015` 头部状态行原写「未改判据前棋盘区捏合不施工；本文仍不落码」——前置已解除、Z1–Z6 已入库，该字面已过期；现校正为「Accepted 且已施工落地」并保留裁定沿革与仍开放项。**代码零改动**（本批只改文档与台账）。
- **本批门禁与沉淀**：根 `verify` **17/17 PASS**（逐项不短路；含 `check:tasks` / `check:links` / `ctx:check` / `framework:sync:check` / test / `cocos:check` / `check:size`）。**诚实登记一次瞬时红**：首跑 `check:links` ❌，单跑同一命令即绿（skills 33 → **36**），真因 = **并发会话正在新建三个 skill**（`my-skills/wxgame-story-dev` / `wxgame-story-gate` / `wxgame-balance-check` + 四 IDE 链接，均为未跟踪文件），与本批零交集 ⇒ 取「复跑后绿」的 17/17 为本批证据（判例 K-045 并发竞写：共享门禁上的红要先分清是不是自己的）。**本批未跑新测试**（零代码改动，沿用 HEAD 现有 496 例绿底）。`kb:sync --task=WXG-T-166` 沉淀统计：**新增 1（K-057 [流程]「立项单」与「ADR 状态行」都不会被实施它们的另一张单自动收口，核销时要成对扫）/ 修改 0 / 激活 0 / 归档 0**；`kb:audit` 无归档候选、无相似命中（活跃 57 / 归档 0）；`ctx:build` 已刷索引面。**未提交**（沿用户口径：先看改动）。**遗留未清（用户本批未选）**：T-169 主表行尾仍写「⚠ QA 查出 F1 待修」（F1 已由 T-170 关），F3-a（ADR §3.4 快照口径）继续挂 backlog。

---

## WXG-T-167

**beads·缩放设计轨（C-3 判据翻转 + 图鉴/扩容盘面 concept 提案）** · 负责：文策渊(design-strategist)·主理人编排 · 状态：✅ **两笔交付均已入库**（(i) 判据翻转随 `e95a55f`/`1fefe3b`；(ii) `gdd/meta-ui.md` 草案 v0.2 随 `bcd1dcb`，同日已升 **v0.3**）；**Q1/Q2/Q4/Q5/Q7/Q7-b 六项已裁完**，未决仅余 Q3/Q6/Q8/Q9/Q10/Q11；**§3 冻结值零变更、零代码改动**，转正式 GDD 与拆 Story 待变更单

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
- **交互形态复确认（2026-09-19，用户）**：本单**不引入滑轨/缩放按钮**——`concept` **D13**（v1.24 / WXG-T-141 用户拍板「棋盘缩放只做双指捏合手势、无滑轨/按钮控件」）**维持原样**；对参考竞品「放大镜图标 + 竖向滑轨」的否案（`design/references/ref-video-2026-09-17-ui-ux-analysis.md` 10.8-1「不猜不抄」）也不变。缩放能力已随 T-169 落码可用，**本单真正的卡点是 Q1（是否引入第二个玩法内核，撞 D1/支柱 3）与 Q2（宫格同时可见 vs 顺序解锁，决定单相机丁-3 前提是否失效）**，不是输入形态。

- **执行批（2026-09-19，用户裁四项 → spawn 文策渊出草案）**：
  - **裁定**：**Q1 = 甲**（子版面 = 复用错位归位内核 ⇒ 不启用 S11、`concept` D1/支柱 3 不改判、S1/S3 判据不翻倍）· **Q2 = 逐格推进 / 点格放大**（单相机 丁-3 前提成立，`ADR-0015 §5-3` 丁-2 复评**不触发**；**提案表原义「甲 = 多格同屏可见」未被采纳** ⇒ 字母与本单选项不一致，已在文件头钉死「引用看正文不看字母」）· **Q4 = 甲**（主菜单页族内独立页，启动路径零改动）· **Q5 = 甲**（完成度纯显示 ⇒ 不发奖、不另立解锁门槛、不扩 S8 档面）。
  - **交付**：新建 `games/beads/design/gdd/meta-ui.md`（S10 + 图鉴八节，**185 行 / 7,992 估算 tokens**，B 门内达标、未申请豁免；余量仅 8 tok ⇒ **转正前须先把 §10 外移**，已挂 backlog），含三层 Screen Flow（§4.1）与 **CH-1…CH-7 §3 变更单草案**（数值列全空、**未提交**）；同笔索引登记 = `systems-index` **v1.33**（S10 行「待建 · 归批1」→「草案 v0.2 已落盘；**ui-kit 图元层仍待建**」）+ changelog v1.33 行。随 `bcd1dcb` 入库。
  - **本批边界**：**零 §3 变更、零新常量、零代码改动**；未改 `ux-spec.md`（19,587 tok 豁免条要求先评线框外移）；未拆 Epic/Story（程基岩拆前须见冻结值）。
  - **顺带发现的漂移已同批回写**：`concept.md` v1.5→**v1.6** —— 支柱 2 / MDA Dynamics / §7 MVP / D13 四处仍写「托盘 24 槽（2×12）+ 扩展 24」，而 `§3.4` v1.30（WXG-T-168）已改为 **12 + 12** ⇒ 四处划线留档改注现值（K-053 型回写遗漏；由本单执行批发现）。D13 的「仅双指捏合、无滑轨」部分按上条复确认维持。
  - **门禁**：`ctx:check` OK · `check:links` OK（agents=7 skills=33）· 根 `verify` **17/17 PASS**（当前态连跑两次均 exit 0；beads 499 / framework 306 / breakout 239）。**一次瞬态红未确诊（诚实登记）**：本批首次 verify 报 `test` exit 1而套件均报通过；当时只 tail 了摘要、**未留全量日志 ⇒ 证据丢失**。已排除「`zz-bis3.test.ts` 采集期消失」假设（该删除早于失败点 3 小时，随 `464afba` 09:13 入库）；最强候选 = CodeBuddy 会话 T-177 测试迁移的**在途写入窗口**（他们 11:58 提交，失败发生在 ≈12:05）。复跑两次均绿 ⇒ **不记为已确诊**；流程改法 = **以后跑全量门禁一律 `> temp/verify-*.log 2>&1` 再看 tail**（同 K-036：无逐项证据不下结论）。
  - **文策渊回执里的新缺项（本单新登记）**：**Q7-b = 子版面→整图页的退回通道语义**（v1.29 只裁了「回主菜单 = 弃本局棋盘」，从第三层退回第二层是保留还是重开无裁定）——提案 Q1–Q11 原本**没有**这一条，写 `ux-spec` 矩阵前必须先裁；与 Q7 体力口径同批裁。
  - **沉淀（`kb:sync --task=WXG-T-167`）**：**新增 1 / 修改 0 / 激活 0 / 归档 0** —— K-059 [流程]「用『甲/乙/丙』转述既有候选清单时必须带正文锚——字母会换义」（本次 Q2 字母与提案原义冲突的根治项）；`kb:audit` 无归档候选、无相似命中（活跃 59）。
  - **续批 v0.3（同日，用户补裁最后两项）**：**Q7 = 甲（逐格扣）**⇒ 一格 = 一次新局 = 扣 1 心，**§3.14 现文与数值零改动、不走反转批**；§2.5 转「已裁」并把读法二/三标为未采纳留档；**已知后果写进正文**（单图预算 = 格数 vs `STAMINA_MAX=8`/8 min-心 ⇒ 半图即碰 0 心门），列为 **playtest 首要观察项**，回调途径 = 变更单而非本文自改口径。**Q7-b = 甲（退回即弃本局）**⇒ 与 v1.29 同口径、不新增第三种语义，新增 **§8-9** 不变式（与 `pause-settings §8-11` 共用测试形状）；§8-7 转正并附反例。同时把 **§10 CH-1…CH-7 整表外移**为 `gdd/meta-ui-changelog.md`（v0.2 只剩 8 tok 余量 ⇒ 分片而非申请豁免，先例 = WXG-T-062 把 systems-index 变更记录分片），正文 §10 改为一行指针；**backlog 的「转正前须外移 §10」条已结项移除**。**仍零 §3 变更、零新常量、零代码改动。**
  - **下一步（建议序）**：**Q1/Q2/Q4/Q5/Q7/Q7-b 已全部裁完** ⇒ meta-ui 已具备**转正与 UX 回写条件**：① 主对话把未提交的 T-167 登记批（systems-index v1.33 + changelog / concept v1.6 / 两张台账 / K-059 / 本文件与分片）一并入库（避开并发会话同文件写入，判例 K-045）；② `ux-spec` 三层 Screen Flow + 矩阵行回写（**触达时先评 §3 线框外移**，该正本实测 19,587 tok）；③ §3 变更单（CH-1/2/3/5/7）须待 Q3/Q6/Q8/Q9/Q10/Q11 裁定；④ 美术轨答 `ADR-0015` C-5 与整图灰态/点亮态；⑤ 冻结值落定后由程基岩拆 Epic、QA 从转正后 §8 重导出五件套。**playtest 首要观察项 = 逐格扣与 8 心上限的冲突。**
- **下一步（旧口径，2026-09-19 已执行完毕，留档不删）**：~~主理人就 **Q1 / Q2** 拍板（其余依赖此两条）→ 文策渊出提案一页纸转正 + 新建 `gdd/meta-ui.md`（八节含图鉴）+ §3 变更单草案~~（✅ 已做：四项裁定 + `meta-ui.md` v0.2 + CH 草案）；~~UX 侧 `ux-spec` 抬起提交回写~~（✅ 已随 T-169 Z6：ux-spec v1.9/v1.10）；~~程基岩在 C-3 前置解除后开工 甲′+丁-3~~（✅ 已随 T-169 落码）。**现行下一步 = 上方「执行批」末条（裁 Q7/Q7-b → 转正 → 变更单 → 拆 Story）。**

---

## WXG-T-169

**beads·棋盘缩放平移落码（Z0–Z6）** · 负责：程基岩(eng)·主理人收口 · 状态：✅ **收口（2026-09-19）** · 上位决策：`ADR-0015`（Accepted，甲′+丁-3+C-3(a)）· 前置判据：`input-control.md` v2.5 / `core-loop.md` v2.1（已随 WXG-T-167 入库）

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

- **收口批（2026-09-19，Qoder）**：本单施工面（Z1–Z6）与缺陷批（T-170~173）均已入库，唯一**真欠账** = QA `test-cases.md §A4c.2`「判据已冻结、`[Node]` 可证、本轮无落点 ⇒ 待执行」（禁读作 PASS）那批。本批补齐：
  - **新落 4 条用例 + 1 条护栏锁**（全入 `tests/board-input-timing.test.ts`，该文件 4→9 例）：**TC-CAM-09** 相机旁路（PAUSED 态拖拽/次指/张开/抬起 ⇒ `snapshot.gridPitch/gridLeft/gridTop` 逐分量不变且零玩法指令）、**TC-SUB-03** 拖→捏不提交（次指落下后主指抬起被压）、**TC-SUB-04** 指令洪泛（每 down 帧 0 条、每 up 帧恰 1 条；实投 10+ 组，受 6×5 测试关盘面限制 ⇒ 规模下标写在用例内不冒充 20 组）、**TC-SUB-07** drag 途中跨格零选中（8 帧扫盘逐帧校）、**F5 几何护栏锁**（阈值 ≥ 带间隙即红）。
  - **五轮变异自检（K-036 / K-042）**：去 `playing` 门禁 ⇒ 唯 CAM-09 红；删 `!_pinched` ⇒ 唯 SUB-03 红；提交改回 down 帧 ⇒ CAM-06/07 + SUB-03/04/07 同红；阈值 8→40 ⇒ 仅护栏例红；阈值 8→100000 ⇒ SUB-07 + 护栏例红。**SUB-07 首版差点无判别力**：抬起点原选在拖拽终点（该格落子本就不合法）⇒ 变异不红；改回「已备珠格心」（同点单指 tap 会落子 = 共位正向对照）后才锁住——已作 **K-042 追记**入库。
  - **§A4c.4 行内回填**：F5 护栏锁已落；**F7 已改**（`denied-press.test.ts` / `selection-anchor.test.ts` 两处把 `tapDesign` 误称「真链」的注释改为「路由口径/旁路，不受也不覆盖 v2.5 时基」，零行为改动；`tapDesign` 已复核为直调 `_handleTap`）；**F8 已闭合**（`framework:sync:check` 恒绿）；**F6 不并入**（用户拍板）⇒ 挂 backlog，理由：复跑会改一大片历史 `[Probe]` 读数，属取证轨独立轮次。
  - **未转态（诚实）**：**TC-SUB-05 仍 `待执行`**——占位阈值 8 < 带间隙 30 ⇒「位移<阈值却跨带」不可构造，强构只能改占位值自证；§A4c.3 真机 ⛔ 5 条**零进账**（zoom≠1 命中已归真机首验包 **P1-8**）。
  - **取证边界**：本轮只跑 `[Node]` ⇒ 所有 `[Probe]`/`[Cocos]`/`[C]`/`[R]` 读数仍属旧轮次，不引用为本批证据。
  - **门禁与沉淀**：`verify` **17/17 PASS**；beads **501 例绿**（496+5）、framework 306 / breakout 239；`test-cases.md` v1.14→**v1.15**（严守真域由主对话代落盘，承 T-146/T-172 Q1 判例，待严守真复验）；`kb:sync --task=WXG-T-169` 沉淀统计：**新增 0 / 修改 1（K-042 追加「零事件类用例新写时同样会中招：先找共位正向对照再跑变异」）/ 激活 0 / 归档 0**，`kb:audit` 无归档候选、无相似命中（活跃 57）；`ctx:build` 已刷索引面；**变更记录表仍缺 v1.10–v1.14 五行**（沿 v1.13 ⑦ 口径只登记不代写）。**本批未提交**（沿用户口径）。
- **收口后余项（逐处挂号）**：三占位值 + F3-b 底线 + pinch-focal → backlog「§3 变更单」行；C-5 描边随缩 → backlog art 轨行；F6 探针升级 → backlog 新行；zoom≠1 命中真机 P0 → 真机首验包 P1-8；TC-SUB-05 → QA 表内标「阻塞 = §3 变更单未定值」；GRID_MAX 扩容/图鉴 → 设计轨 T-167（前置 Q1/Q2）。

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





---

## WXG-T-175

**外来 skill 集成 · A 档（Claude Code Game Studios 点菜式吸收）** · 负责：主理人(CodeBuddy) · 状态：✅ 落码（**待真跑一个 story 验证价值**）

- **缘起**：用户 2026-09-19 给出外部仓库 `Donchitos/Claude-Code-Game-Studios`（MIT，25.2k stars），
  要求调研 → 对比 → 评估 → 集成。全量 186 件（73 skills / 49 agents / 12 hooks / 11 rules / 41 templates）。
- **取证方式（诚实登记）**：`git clone` 两次因网络中断（`curl 52 Empty reply`）失败 ⇒ 改用
  **GitHub API 取全量目录清单 + raw 逐份取正文**取证（精读：`dev-story` / `story-readiness` /
  `story-done` / `balance-check` / `test-flakiness` / `test-evidence-review` / `soak-test` /
  `gameplay-code.md` / `systems-index.md` 模板 / `validate-commit.sh` / `technical-preferences.md` /
  `unity-shader-specialist.md` / `godot-specialist.md`）。**留档用 clone 最终成功**（5.4M）。
- **结论：不整包集成**（三条硬理由）：① 31% 的 agent（15/49）是 Godot/Unity/Unreal 专家，
  本仓引擎唯一（Cocos Creator + 微信小游戏）⇒ 无效；② CCGS 无「§3 冻结常量真源 + 变更记录 +
  冲突裁决链」，整包引入会稀释本仓最硬约束；③ 其 12 hooks 路径（`^src/gameplay/`、
  `^design/gdd/`、`^assets/data/*.json`）在本仓**一条都不命中**，且只 WARN 不阻断，强度低于本仓 pre-commit。
- **A 档落地（3 个新 skill，全部 `disable-model-invocation: true` 仅点名）**：
  - `wxgame-story-dev` ← `dev-story`：开工门禁 + 真源装载 + **控制清单版本漂移三选项** +
    **依赖门禁三选项** + 测试证据。改造：`tr-registry` → 本仓 **§8 验收条目 `S<n>§8-<k>`**（同构，
    无需新建 registry）；删引擎派工与 `director-gates`/`review-mode`；进度真源 = story 自身 `Status:`
    + `production/sprints/`（**不引入** `production/session-state/active.md` 第二套状态）。
  - `wxgame-story-gate` ← `story-readiness` + `story-done` 合并：子命令 `ready` / `done`。
    新增本仓特有关卡：**测试↔判据追溯表，>50% UNTESTED ⇒ BLOCKING**。
  - `wxgame-balance-check` ← `balance-check`：真源改 `systems-index §3`；**新增本仓硬纪律 ——
    只读、不得改冻结值**（改值必须走 §3 变更单），并新增「§3 ↔ `tuning.ts` 落码漂移」核对（上游没有）。
- **另两处吸收（不新建 skill）**：
  - `wxgame-qa-gates` 增 §6 测试不稳定性 / §7 测试证据评审 / §8 长跑 —— **已微信宿主化**：
    `wx.onMemoryWarning`、杀进程续进、帧时间漂移、BD-51 音频复发面；删原版 GdUnit4/NUnit/`stat memory` 引擎段。
  - `docs/architecture/control-manifest.md` 新增 **§18 外来吸收四条**（状态机显式转换表 /
    禁静态单例改 DI / 注释标注设计真源 / `TODO(<归属>)`），并**登记未吸收条款**免重复引入。
- **明确不引入（登记备查）**：15 引擎专家 agent（其 description **无引擎前置条件**，会误 spawn；
  `godot-specialist` 还强制读 `docs/engine-reference/godot/VERSION.md`，本仓是 `cocos/`）/
  `/setup-engine`（会污染 `technical-preferences.md` 的 `Engine:` 字段）/ 12 hooks /
  `systems-index.md` 模板（与本仓同名**冻结真源**冲突，只借鉴"高风险系统/进度跟踪"章节）/
  叙事·网络·安全·live-ops·本地化（无对应域或 Won't）。
- **工程事实**：四 IDE 链接 12 条（`.cursor|.codebuddy|.workbuddy|.qoder/skills/<name>` →
  `../../my-skills/<name>`）；`check:links` OK（skills=36）；上游留档
  `my-skills/_repos/Claude-Code-Game-Studios/`（5.4M，更新 = `cd _repos/<repo> && git pull`）。
- **门禁**：`ctx/budget-exempt.json` 新增 2 条 B 门豁免（`UPGRADING.md` 8918 tok、
  `docs/WORKFLOW-GUIDE.md` 14811 tok）—— 沿用 mattpocock/superpowers 同目录 vendor 先例，
  **不调阈值**，且双双登记债务：`git pull` 使留档显著膨胀时**优先精简 `_repos` 而非续加豁免**。
  `verify` **17/17 PASS**。
- **⚠️ 遗留（诚实登记）**：
  1. **动态切换机制未落码** —— `my-skills/INDEX.md §1d` 已定三档（hybrid/ccgs/wxgame），
     但本仓无 profile 文件，且 `AGENTS.md` 是 alwaysApply 静态文本**不会自动读档位文件生效**；
     真正的可回滚切换需新增 `tools/scripts/switch-skill-profile.mjs`（重写链接 + 批量改
     `disable-model-invocation`）。当前默认 hybrid，靠手工维护链接。
  2. **三个新 skill 尚未真跑过一次** —— 价值待证。建议下一个真实 story 走完整循环
     （`story-gate ready` → `story-dev` → `story-gate done`）验收。
  3. 用户级 vs 项目级：本次走**项目级**（与外来通用 16 个一致，可被 `check:links`/`verify` 守到）；
     各 IDE 的用户级扫描路径**未在本机核实**。

- **追加裁定（用户 2026-09-19）：三件并入 `wxgame-*`，独立件删除**
  - 处置：`my-skills/wxgame-story-dev` / `wxgame-story-gate` / `wxgame-balance-check`
    **三个正本目录删除，12 条四 IDE 链接全部摘除**（内容不丢，已并入同域 skill）。
  - 去向（按域就近，而非按来源就近）：
    - `wxgame-epic-split` **§7 Story 生命周期后半段·实现** + **§8 ready/done 门禁**
      ← `dev-story` + `story-readiness` + `story-done`
    - `wxgame-gdd-writer` **§5 数值平衡核对** ← `balance-check`（真源 = §3 冻结常量，属 GDD 域）
  - 连带：`my-skills/INDEX.md` §1c 整节删除；§1 表格两行加标注；§3 优先级链**不再单列 CCGS 层**；
    触发机制与现役 skill 完全一致（靠 `description` 自动命中，无 `disable-model-invocation`）。
  - 另按用户裁定**撤销**「两套 skill 档位动态切换」机制（hybrid/ccgs/wxgame 三档）——
    不为未发生的需求预建机制；将来真要并存，用「挂/摘四 IDE 链接」既有硬开关。
  - 门禁：`check:links` **skills=33**（与合并前一致）、`verify` **17/17 PASS**。
- **验证记录（同日真跑，非静态检查）**
  1. `balance-check` 核心动作：抽查 §3 ↔ `tuning.ts` 七组常量（`TRAY_BASE_SLOTS`/`TRAY_EXPAND_SLOTS`/
     `STAR3_RATIO`/`STAR2_RATIO`/`SPRINT_TIME_DEFAULT`/`STAMINA_MAX`/`STAMINA_REGEN`）⇒ **零漂移**。
  2. QA §7 证据评审抽样（44 文件 / 488 用例 / 2527 expect，均值 5.18）⇒ 抓到
     **`zz-bis3.test.ts`（3 用例 / 0 expect = 空过，按 §7 判 BLOCKING）**与
     `onboarded.test.ts`（2.0/用例，偏薄）。前者 `zz-` 前缀疑似临时诊断件，**待用户裁定处置**。
  3. QA §6 稳定性：连跑两次均 44 files / **501 passed** 一致 ⇒ 按 §6 自定口径（<3 次不得标 confirmed）
     只记「无 flaky 迹象，suspected 级」。
  4. **`story-dev`/`story-gate` 的路径假设被证伪并已修**：上游假设「一 Story 一文件 + 头部
     `Status:`/`Type:`/`Manifest Version:`」，本仓实为 `epics-<game>.md` 内 `EP<nn>-S<k>` 条目 +
     `epics-<game>-status.md` 对账 ⇒ 已改写为按编号定位、Type 按验收条目推断、证据落点用扁平
     `games/<game>/tests/<name>.test.ts`。**本仓 `验收：S1§8-6` 写法与 skill 的 `S<n>§8-<k>` 口径天然一致**（零改造）。

- **合并后三段验证（2026-09-19，真跑非静态）**
  - **§8 `ready` 真跑（靶子 `EP01-S3 暂停冻结编排（S1 单点门禁，ADR-0007）`）⇒ 判定 NEEDS WORK**，命中：
    1. **Story 内嵌引用与 GDD 现文本不一致 ×2** —— Story 写「剩余时间数值不变、**不供料**」，
       而 `core-loop §8-7` 现文本是「…**零取回零归位**」；Story 写「PAUSED 期间零 `tray:spawned`」，
       而 `tray-spawner §8-8` 现文本已标「原文『零 `tray:spawned`』**随供料作废**」。
       ⇒ **§7.2 第 ① 条「以 §8 现文本为准、不采信内嵌旧引用」被实证有效**（一次抓到两处）。
    2. 该 Story **无 In/Out of Scope 字段** ⇒ 标 NEEDS WORK。
  - **暴露两个「上游检查项在本仓不可判定」（已修 skill）**：
    ① 上游要求「ADR 为 `Accepted`」，但**本仓 ADR 无 `Status:` 字段**（格式 = `# ADR-NNNN — 标题` +
       `## 1. 上下文`）⇒ 改为「文件存在 + 正文无未决声明」；
    ② 上游要求「控制清单版本最新」，但 **`control-manifest.md` 无版本字段**（实跑确认）⇒ 本项标 N/A，
       并写明「若日后加 `版本:` 头则自动生效」；另「Out of Scope 缺失」改为不阻断（本仓 Story 普遍未写）。
  - **§7 上下文装载四件可达性**：Story 条目 ✓（`epics-beads.md:62`）、GDD §8 现文本 ✓
    （`core-loop.md:146` + `tray-spawner.md:129`）、ADR ✓（`ADR-0007*.md` 存在）、
    控制清单 ✓（`control-manifest.md` 存在）—— 四件均可定位，无死链。
  - **§7 依赖门禁可达性**：依赖 `EP03-S2`（`epics-beads.md:104`）、`EP05-S1`（`:144`）均可定位；
    状态件显示 S1–S5 已交付、无 DRAFT ⇒ 门禁不误判。
  - **§5 balance-check 扩展核对**：在原有 7 组之外加验 `BEAD_COLOR_MAX` 8/8、
    `MISPLACED_PAIRS_MIN` 1/1、`MISPLACED_PAIRS_MAX` 8/8 ⇒ **累计 10 组全零漂移**。
  - 修正后 `verify` **17/17 PASS**。

---

## WXG-T-176

**ctx 生成器 `SKIP_DIRS` 跳过 vendor `_repos`（索引产物瘦身）** · 负责：主理人(Qoder) · 状态：✅ 完成

- **缘起（用户裁定「写进 .gitignore 让生成器跳过」）**：本批先纠正前提 —— `.gitignore` **早已忽略**
  `my-skills/_repos/mattpocock-skills/` 与 `…/superpowers/`（理由写在注释里：内嵌 git 仓只能记 gitlink，
  内容会静默丢失），但 `pnpm run ctx:build` **仍然把它们写进 `ctx/index.json`**。
- **真因**：`tools/scripts/lib/context-index.mjs::listMarkdown()` 用 `readdirSync` 走全盘，只跳
  点目录与硬编码的 `SKIP_DIRS`（按 `entry.name` 逐段匹配），**从不读 `.gitignore`，也不问 git**。
  ⇒ 「进 .gitignore = 不进索引」在这条链上不成立。实例：vendor 快照入盘后一次重建即
  **+4.6 万行 / +1.17 MB**（2.51 MB → 3.68 MB），并随 `b68d40e` 被固化进提交。
- **落码（最小改动，一行）**：`SKIP_DIRS` 追加 `'_repos'`（与既有 `archive` / `temp` / `library`
  同一机械开关形态，零新机制）；JSDoc 补该目录的由来与"生成器不读 gitignore"这条反直觉事实，
  并按仓库体例留 `ponytail:` 注记上限与升级路径（改用 `git check-ignore` / `git ls-files` 做唯一真源，
  代价 = 多一层子进程与平台差异 ⇒ 现在不值当）。
- **效果（实测）**：`ctx/index.json` **136,369 → 60,271 行、3.68 MB → 1.7 MB**（`grep -c _repos` = 0）；
  文件 276 / 章节 4,119 仍全量覆盖本仓自建文档。**收益不止今天这一笔**：`_repos` 条目此前已长期
  占了约 3 万行索引（905f72e 版 90,450 行里就有 181 处命中），本次一并回收。
- **门禁**：`pnpm run verify` **17/17 PASS**（含 `ctx:check` 结构门 A/B/C/D/D2 + E3、`selftest:fast` 8/8、
  `check:links` skills=33、beads 501 / framework 306 / breakout 239）。C 项候选集与索引面**同口径**
  （`check-context-budget.mjs` 复用同一 `SKIP_DIRS`），故 `_repos` 下的文件今后既不进索引，也不会被
  新鲜度门要求入索引；`kb:check` ③ 只断言含 `archive`，不受影响。
- **未干（避免竞写，挂号待他人顺手清）**：`ctx/budget-exempt.json` 里 8 条 `_repos` 文件的 B 门豁免
  现已成**死条目**（永不命中）。该文件当前由 WXG-T-175 会话在途编辑 ⇒ 本单不碰，改挂 backlog 行。
- **并发避让登记**：本单领号前按 K-046 扫过工作树（主表 + GDD/ADR/skill 头注 + git 跟踪态）：175 已被
  并发会话登记且头注已顶到 176 ⇒ 本会话占 **176**，下一可用号 **177**。
- **沉淀统计（`kb:sync --task=WXG-T-176`）**：**新增 1 / 修改 0 / 激活 0 / 归档 0** —— K-058
  [工具链]「已写进 `.gitignore`」不等于「已排除出索引产物」（枚举型走盘生成器只认自己的硬编码
  跳过集）；`kb:audit` 无归档候选、无相似命中。本单另含一次**险些破坏他单登记的编辑失误**：
  插主表行时误把并发会话的 **WXG-T-175 整行覆盖**（残留其行尾文本），已当轮发现并原样恢复
  （恢复后 `check:tasks` 11 行/11 节配对绿）——判例同 K-045：共享台账上插入务必用**唯一足够长**
  的 lock 文本，不要拿邻行为锚。

- **提交后核实（`ee39498`，−77068 行）**：`ctx/index.json` 文件数 650 → **276**，**非内容丢失**：
  `_repos/Claude-Code-Game-Studios` 经 `git rm --cached` 撤销入库后**不再参与索引**
  —— `ctx:build` 默认是 **HEAD 锚定模式**（未跟踪文件不入索引，见 `ctx/ROUTES.md` ⑨），
  故留档 195 个文件的章节条目整体出索引，**属预期行为**。
  连带：`ctx/budget-exempt.json` 中为本留档加的 2 条 vendor 豁免**成为冗余**（该路径已不在索引面内）。
  **保留不删**，理由：① 与 `_repos/superpowers`、`_repos/mattpocock-skills` 同目录豁免条目现状一致
  （先例同样冗余）；② 若将来该留档入库，豁免即刻生效，避免重演本轮「撤销 → `ctx:check` 转红 → 恢复」
  的反复折腾。**教训（本轮第二次踩同一坑）**：判断 `_repos` 是否需要 B 门豁免，
  取决于「**是否在索引面内**」而非「是否入库」—— 入库（gitlink）时在面内需豁免，
  不入库时不在面内但保留豁免无害。

- **收尾：清理 `_repos` 死豁免 12 条（2026-09-19，随 WXG-T-176 落地）**
  `b6f2dd1`（WXG-T-176）把 `_repos` 加入 `context-index.mjs` 的 `SKIP_DIRS` 后，
  `my-skills/_repos/**` **不再参与索引**（实查：`ctx/index.json` 中 `my-skills/_repos` 出现 **0 次**）。
  连带 `ctx/budget-exempt.json` 中 **12 条**指向该路径的 B 门豁免成为**死配置**：
  10 条 `vendor-skills` 代登记（mattpocock / superpowers）+ **2 条本单所加**（CCGS）。
  - **处置**：全部清除，条目数 **47 → 35**；清后 `verify` **17/17 PASS**（反向印证 12 条确为死配置）。
  - **理由**：死条目会误导后人以为该路径仍在索引面内 —— 本单已因同一误判反复两次
    （先误加 gitlink、再误撤豁免），清理是消除该误导的根治手段。
  - **重建条件（写给将来）**：若日后把 `_repos` 从 `SKIP_DIRS` 移除（使其重回索引面），
    这 12 条豁免需按当时的超限文件**重建**；`_repos` 上游 `git pull` 后文件体积变化时同理。

---

## WXG-T-177

**beads·冲刺入口隐藏（「去冲刺」三处全隐藏，U1 反转）** · 负责：主理人(CodeBuddy) · 状态：✅ 落码（**待真机复验**）

- **用户裁定（2026-09-19）**：原话「去冲刺按钮先隐藏，咱不需要这个功能」⇒ **功能级隐藏**（三处入口同属一个功能，`ux-spec §8` U1 冻结的「三处都放」整体反转）。
- **变更性质 = 入口收敛，非功能删除**：冲刺模式实现（`sprint.ts` / `sprint-settle.ts` / `startSprint()` /
  `_setupSprintRun()`）与 `systems-index §3.10` 全部冻结常量（C1–C8）**一字未动**；
  入口收敛后冲刺模式**暂时不可达**（仅测试 / harness 注入可达）。
- **三处入口的处置**（各面板仅剩单按钮并**居中**）：
  1. `clear-panel.ts`（结算过关页）：原「下一关 / ▶去冲刺」2 格 → **仅「下一关」居中**（`startX` 由两格均分改单钮居中）。
  2. `finish-panel.ts`（通关画面）：原「▶去冲刺 / 重玩第 1 关」→ **仅「重玩第 1 关」居中**。
  3. `pause-panel.ts`（暂停面板行 4）：原「start-sprint / go-menu」→ **仅「go-menu」居中**
     （落位表达式与 `sprintLayout()` 同源 ⇒ 两模式一致）。
  - 三处均**保留** action 类型成员（`'sprint'` / `'start-sprint'`）与文案分支，仅供复建；
    布局不再产出 ⇒ 该动作**永不可达**（同位置点击零响应）。
  - 副作用：`CLEAR_BUTTON_GAP` 在 clear/finish 两面板成为未使用导入，已移除并留注（复建时重新引入）。
- **文档回写（先改文档后改代码）**：
  - `ux-spec` **v1.12**：§8 决策记录 U1 条**删划线留档 + 反转说明**（K-053）、§3.3 暂停面板图行 4、
    §3.4 结算面板图、§4 矩阵 `LEVEL_CLEAR` / `FINISH` 两行。
  - `systems-index` **v1.32**：§1 **S7 行**登记「入口三处隐藏 ⇒ 冲刺模式暂时不可达，
    §3.10 常量与实现保留不动」+ `systems-index-changelog` v1.32 行。**§3 数值零改动**。
  - `pause-settings`：§2.2 去冲刺行删划线 + 隐藏说明。
  - `input-control`：§2.1 路由表 + §8-8b/8c 判据原文（去冲刺改为"已隐藏"）。
- **判据迁移（8 处全绿）**：`clear-panel.test.ts`（布局 2→1 钮 + 单钮居中、命中改"原副钮位零命中"、
  链路改"出口不可达"）、`finish-panel.test.ts`（同型 3 处）、`pause-settings.test.ts`（文案断言
  `含去冲刺 true → false`、`start-sprint` 两模式均不产出）、另清理 `phase-input-realchain` /
  `audio-dispatch` 注释漂移。beads **498/498 绿**；`framework:sync` + `ctx:build` + `verify` **17/17 PASS**。
- **⚠️ 过程失误（诚实登记）**：追加 changelog v1.32 行时用 `node -e "…"`（shell 双引号包裹），
  内容里的反引号被 shell 当**命令替换**执行（`command not found: sprint.ts / ux-spec …`），
  导致该行所有 `` 包裹标识符被吞空。**当场发现并用脚本文件（不经 shell 解释）重写该行修复**。
  教训：**凡内容含反引号/`$` 的文本写入，必须走脚本文件或 `--stdin`，不得塞进 shell 双引号内**（K-002 同族）。
- **待办**：真机复验（① 结算页只剩「下一关」并居中；② 通关画面只剩「重玩第 1 关」；
  ③ 暂停面板行 4 只剩「回主菜单」并居中、无「去冲刺」文案）；恢复路径 = 按 `ux-spec §8` U1 原口径复建三处。

---

## WXG-T-178

**framework·真机「能缩放不能拖动」修复（输入位移改帧末结算）+ 相机/命中调试读回口** · 负责：主理人(Qoder)·程基岩复核 · 状态：✅ 落码待真机复扫

- **缘起**：用户在真机走查 P1-8 时回报「坐标没有问题；但是无法拖动」——即缩放与点击命中都对，单指平移完全不动。此症状与 T-169 真机反馈①（`onBoard` 起手域）同名不同因，不可复用旧结论。
- **取证过程（先定位再改，不猜）**：为把「哪一步没走通」变成可读数字，先加调试读回口（`BeadsBootstrap` 的 `__WXG_GAME_DEBUG` / `__WXG_HIT_DEBUG` / `__WXG_CELL_DEBUG` / `__WXG_GESTURE_DEBUG`，全部由既有 `__WXG_TOUCH_DEBUG` 开关控制、默认关；命中与格心一律走游戏自己的函数，避免探针与真源共用同一个错 = K-042）。首版探针结论**我自己写错了两次**：① 只往一个方向拖、又在该方向已顶到夹取上限时采样 ⇒ 把「顶格」读成「链断」；② 结论句用 `dLeft === 0` 直接判缺陷。改用「双方向 + 手指仍按下时采样逐帧累计量」后才拿到决定性读数：`panFrames=69`（分支每帧在跑）、`panDxSum=0`、`snapX` 确实在变 ⇒ **喂进 `applyPan` 的位移恒为 0**，断点在输入层而非几何或语义。
- **根因**：`InputManager.beginFrame()` 做 `_prevX = _x`，而事件驱动宿主（Cocos / 微信）的原生 `touch-move` 到达在**两个固定步之间**（上次 `endFrame` 之后、下次 `beginFrame` 之前）⇒ 拷贝时 `_x` 已是新值，`dx = _x - _prevX` 恒 0。同步宿主（Node 单测与浏览器 harness：`beginFrame → push → update → endFrame`）永远看不到该缺陷，故 501 例全绿也照不出来（K-037 / K-036）。
- **修法（一处，覆盖所有宿主）**：prev 推进从 `beginFrame` 移到 `endFrame`（一固定步 = 一输入帧；同步宿主逐位等价，事件驱动宿主拿得到真实位移）；`beginFrame()` 保留为帧边界标记并注明「故意为空」。
- **TDD**：新增契约用例 `reports the real delta when a move arrives between fixed steps`（`endFrame → push → beginFrame → 读 snapshot` 断言位移 = 40/20，并断言无新事件的下一帧位移归零）——**修前红** `expected +0 to be 40`，修后绿。
- **影响面核实**：`grep` 全仓确认 **breakout 不读 `snap.dx/dy`** ⇒ 本次时序修正只改 beads 拖拽行为；framework 307 / beads 500 / breakout 239 = 1046 例零回归；`framework:sync` 已镜像两游戏的 cocos 拷贝件。
- **修后实测（同一探针，web-mobile 产物 + CDP touch）**：`向右拖 → gridLeft −12.5 → 0`（`offsetX=+12.5`、`panDxSum=+357`）；`向左拖 → 0 → −25`（`offsetX=−12.5`、`panDxSum=−714`）⇒ 平移链通、且正确被 `clampCamera` 夹在内容边界。
- **同时入库的调试口**（供真机 Console 走查，非玩法状态、L5 合规）：`BeadsGame.debugHitCell/debugCellCenter/debugGestureState` + `board-input-timing.test.ts` 一例「读回口与 `gridLayoutFor` 真源逐位同构 + 越界 null」（**变异自检**：`colCenterX/rowCenterY` 行列互换 ⇒ 本例红）。
- **顺带修的文档债**：`beads-shell.ts` 文件头仍写「有在途 → 恢复、不扣心」，与 v1.29（T-165）反转后的实现自相矛盾 ⇒ 划线留档改注（第五处同类 K-053 漏回写）。
- **门禁**：`verify` **17/17 PASS**（全量留日志 `temp/verify-fix.log`）、`cocos:check` 2/2、`framework:sync:check` ✅、`check:size` 主包 **1955.0 KB ≤ 2000**（release 已重建，扫码请用新包）。
- **沉淀**：`kb:sync --task=WXG-T-178` **新增 1 / 修改 0 / 激活 0 / 归档 0** —— **K-062**「事件驱动宿主的输入位移必须进单测：prev 在帧首结算会把帧间到达的位移吞成 0」。
- **待办**：① 真机复扫（**请在大盘验拖动**：第 5 关起才有 ±338/±198 的可拖范围，第 1 关 6×5 只有 ±13/±3 设计 px ≈ 7 屏幕 px，属 `clampCamera` 规格而非缺陷）→ 回填 `test-cases.md §A4c.3` TC-CAM-DEV-01/02/03；② 若裁定「小盘也该能拖」，那是**规格变更**，并入 backlog 已有的「§3 变更单：相机三占位值」一行处理；③ 探针 `temp/drag-probe.mjs` / `temp/cam-hit-probe.mjs` 属一次性诊断物（temp 不入库），若要固化成长期 `[B]` 取证件，须另立项并配「产物新鲜度自查 + 反例自检」（判例 WXG-T-108）。

---

## WXG-T-179

**beads·照片转拼豆生成器 spike（调色板 / 限色 / 聚集 调优 + ADR-0016）** · 负责：主理人(CodeBuddy) · 状态：🔄 待用户裁定（甲案能力已具备；乙 / 丙挂起）

- **上位诉求（用户 2026-09-19/20 三项）**：①「豆子尽量同色大块集中，以触发连续填充」；②「颜色限制太少了，看不出来形状了」；③ 真实拼豆品牌色数调研（Artkal 200+ / Perler 100+ / Hama 60–90 / Nabbi 30–50 / IKEA-Pyssla 10–20），并要「根据这个方案进行调优」。
- **产物**：**ADR-0016**（`docs/architecture/adr/ADR-0016-beads-photo-to-pattern-palette.md`，Proposed）+ 生成器 spike `temp/beads-gen.mjs`（**不入库**，见"待办"）。
- **关键澄清（本轮最重要的认知修正）**：`BEAD_COLOR_MAX = 8` 是**单关用色数上限**，**不是**调色板大小 —— 调色板实为 **10 色**（`view/palette.ts::BEAD_PALETTE`，含深棕 `#6B3E1E` / 炭黑 `#33333D`）。此前生成侧只取前 8 色 ⇒ **照片暗部无落点**，是"看不出形状"里最便宜的一处可修项（已修）。
- **spike 能力（本单交付）**：
  - `--palette N`：≤10 = 游戏真源前 N 色（**可入关**）；>10 = 程序化色域（HSL 最远点采样，**仅调研**、产物不可入关）。
  - `--colors M` + `--colorsmode freq|error`：限色数 + 两种选色；`error` = 贪心 k-medoids，按**每格原始均色**最小化全盘色差（明显优于按面积选的 `freq`）。
  - `--sample K`（超采样 + 块内众数投票）/ `--smooth N`（众数滤波，平局保原色）/ `--minblock N`（8 连通碎块整体并入邻色）：三级**聚集度**旋钮，力度递增。
  - 背景去格改**自边框 4 连通 flood-fill**（旧"全局删同色"会把主体内的同色区域挖成洞 ⇒ 把大色块切成碎块）。
  - 报告并列四项判据：**色差**（保形）/ **同色相邻率**（聚集）/ 用色数 / **合规性**（>8 标红，防再产出不可入关的盘）。
- **实测权衡（同一样图 36×36，详见 ADR-0016 §1.3）**：8 色板（旧口径）**74.7 / 0.846**；10 色板 + 限 8 色 + error + 强聚集 **71.4 / 0.807（合规）**；程序化 32 色板 + 限 6 色 + error **63.3 / 0.844（不可入关）**；53 色板 **47.6 / 0.712**。⇒ 两条硬结论：**保形上限由色板大小支配**（色数只是放大器）、**保形与聚集始终反向**。
- **两个真 bug（本单修，均为"限制被绕过 / 失败仍报绿"型）**：① `balance()` 候选池写死全调色板 ⇒ 会把 `--colors` 刚禁掉的色**复活**（实测 `--colors 4` 产出 **5 色**）；已改为只在保留色集内选目标，无可用目标时如实返回 note。② 自检写成 `if (der.ok) { …断言… }` ⇒ 错位打乱失败时**整段断言被跳过、脚本仍打印「自检：通过」**，而产物是**全 void 废盘**（`--colors 2` 实测触发）；已改为失败即**非零退出**并打印原因。
- **门禁**：`check:tasks` / `check:links` / `ctx:check` 随本单跑；本单改动仅**文档**（ADR + 台账 + `architecture.md` 关联行），**零代码、零冻结值、零 §3 数值**。
- **待办**：① **用户裁定 ADR-0016**（甲 + 丁是否采纳；乙 / 丙是否评估）——这是解锁后续的唯一前置；② 生成器 spike **转正入 `tools/scripts/beads-gen.mjs`**（`temp/` 不进库、易丢）⇒ 须**另领施工单**，且转正前须补"产物合规性"守卫；③ 看图定档（产物目录：`temp/ok-p10c8e`（合规推荐）/ `temp/cmp-p10c8e`（10 色基线）/ `temp/bp32c6`（32 色程序化）/ `temp/beads-36-base`（旧口径对照））。

### 续作（Qoder · 2026-09-20）：beads-studio 在线生成器 + 小游戏导入

用户要求：「简单的后端服务和前端页面，能生成 + 展示 + 归类本地存储结果；最好能小程序一键导入」。两项拍板（AskUserQuestion）：**落位 = 本仓 `apps/beads-studio/`**、**发布 = Docker 镜像**；导入通道 = **在线地址拉列表下载关卡**。

- **生成核心不重写**（复用 T-179 已转正的 `beads-gen.mjs`），只加两处能力：`--in-raw`（JSON `{w,h,data:base64 RGBA}`，纯 Node 采样+量化，与 `readGrid` 同口径块内众数投票）+ `--no-png`；chromium 解析由顶层**惰性移入 `ensurePage()`** ⇒ 服务无需 playwright（VPS 镜像 node:20-alpine 即可）。CLI 原行为无回归（带 PNG / 免 PNG 双跑自验）。
- **服务端** `apps/beads-studio/server.mjs`（**零第三方依赖**，纯 `node:http`）：`POST /api/generate`（RGBA raw body → spawn beads-gen → 失败即 rmSync 不留残骸）/ `GET /api/results`（按盘面归类、时间倒序）/ `GET /api/results/:id[/level]` / 静态页；目录名与 id 走 `[a-z0-9-]` 白名单防穿越（已测 404）。
- **前端** `public/index.html`（单文件）：本地 `createImageBitmap`+canvas 解像到 ≤1024（**不上传原图文件**）、参数表单、canvas 预览 solved/misplaced 切换、已存结果分组列表、下载 levelDraft JSON / 复制 rowstrings。
- **部署**：`Dockerfile` + `docker-compose.yml`（context = 仓根，数据卷 `beads-studio-data`）+ `.github/workflows/beads-studio-deploy.yml`（paths 命中 → rsync 两部署单元 → 远端 `docker compose up -d --build` → 健康检查；**未配 secrets 时由 `vars.BEADS_STUDIO_DEPLOY` 守卫自动跳过**）。
- **小游戏导入**：`src/game/level-import.ts`（注入式 HTTP，L3 无平台依赖）+ `BeadsGame.importLevel()`（先过 `validateBeadsLevel` 才追加进关表，失败不改表）+ 设置页「导入」钮（`MetaViewData.studioEnabled`，**仅宿主配了地址时绘制**）。地址接线：微信侧 = 开发者工具启动参数 `studio=http://<IP>:8787`（`BeadsBootstrap`），harness 侧 = `?game=beads&meta=menu&studio=…`。不扣心（调试通道，不污染 §3.14 体力语义），结果经 `meta:studio-import` 事件回报。
- **E2E 揪出一个真缺陷（沉淀 K-064）**：`beads-gen` 的 `levelDraft` 把 `cycleProfile` 硬写 `'long'`，而交换法恒为 2-环 ⇒ BOOT「cycleProfile=long 与实际最长环 2 矛盾」**会拒收每一条在线导入**。生产端改 `'short'` + 消费端不再采信自报值（两面夹住），并补「谎报 long 仍产 short」反例判据。8 条单测全绿时它并不存在 —— 只有真产物过真校验器才暴露。
- **门禁**：`pnpm -w run verify` **17/17 PASS**（含 `framework:sync:check` 镜像门 / `cocos:check` / `harness:smoke`）；beads **521 例全绿**（本单新增 10 例：转换定价 / 谎报反例 / 不合规拒收 / HTTP 注入 / 空列表 / importLevel / 钮接线）。服务端另做真实 E2E 冒烟：POST 生成 → 列表 → `/level` → 过 `draftToLevel` + `validateBeadsLevel` 全绿。
- **沉淀统计（kb:sync --task=WXG-T-179）**：首轮**新增 1（K-064）**/ 修改 0 / 激活 0 / 归档 0；部署续作轮**修改 1（K-064 追记：本机全绿 ≠ 目标环境能跑）**/ 新增 0；发布实跑轮**新增 1（K-065：国内 VPS 镜像源 + 云安全组两层坑）**、**新增 1（K-066：squash 同步致全域冲突 + 静默重复定义，落 `[工具链]` 片）**。`kb:audit` 无归档相似命中；`ctx:build` 已刷。
- **部署补记（同日续作，用户「179 继续完成部署」）**：
  - **又揪出一个同型缺陷（追记进 K-064）**：上一轮宣称「`--no-png` 后服务端免浏览器」是**假绿** —— chromium 的 `ensurePage()` 写在 beads-gen **模块顶层**，本机装有 playwright 所以全绿，按 Dockerfile 布局拼的**无 chromium 容器目录**里直接退出码 1。修法：launch 下移到真正用它的 `readGrid` / `renderPng` 内部（按需创建），顶层零副作用；顺带修掉「`--no-png` 仍打印 solved.png/misplaced.png」的日志谎报。修后在 `/tmp`（无 node_modules）跑 `--in-raw --no-png` ⇒ **34ms 出盘、零浏览器** ✅。
  - **容器布局端到端已过**：`temp/studio-fakeimg/`（server.mjs + public/ + vendor/beads-gen.mjs + cwd/temp/artkal-palette.json）起服务 ⇒ 游戏 10 色与 **artkal** 两条生成路径均 200（artkal 色板按子进程 cwd 解析已对齐 Dockerfile 布局）。
  - **新增 `deploy.sh`**（本机一键发布，镜像构建在 VPS 上跑，本机只 rsync + ssh）：ssh 预建目录 → 三个部署单元 rsync → 远端 `docker compose up -d --build` → 回环健检（失败自动 tail 日志）。**stub 自测已过**（bash 3.2：无 KEY / 带 KEY / `PORT` 覆盖三轮，调用序列与参数逐条比对）；自测当场拓出两个真 bug：空数组 `"${ARR[@]}"` 在 `set -u` + bash 3.2 下报 unbound ⇒ 改守卫展开；**变量名后紧跟全角括号被当作变量名字符**（`$DEST（` → unbound）⇒ 全脚本变量输出加 `{}`。
  - **新增 `Dockerfile.dockerignore`**（BuildKit 按 Dockerfile 命名）：上下文从整仓缩到四个 COPY 源，且**逐级放行目录**（`*` 先排父目录则不遍历子项）。
  - **发布实况（同日，用户配好部署密钥后由本会话执行 `deploy.sh`）**：腾讯云 VPS `120.53.84.116`（docker 29.1.3，root 已在 docker 组）。
    1. 首次 rsync 成功但**构建失败**：`auth.docker.io` 超时 ⇒ 国内机拉不动 Docker Hub。**未改 `daemon.json`**（同机跑着 quant_agent / pgvector / redis，重启 docker 会牵连）；
       改为 `Dockerfile` 加 `ARG BASE_IMAGE` + compose 传 `BEADS_STUDIO_BASE_IMAGE`，deploy.sh/CI 透传 ⇒ 仓库默认值不变（GitHub Runner 可直连）。
       实测可用源：`public.ecr.aws/docker/library/node`、`docker.1ms.run`、`hub.rat.dev`；不可用：`mirror.ccs.tencentyun.com`（非 VPC 不可连）、`docker.1panel.live`（403）、`docker.m.daocloud.io`（unavailable）。
    2. 重跑 ⇒ **镜像建成 + 容器 `beads-studio` Started + VPS 回环健检 OK**（/api/results 200）。
    3. 外网访问 **000 超时**：已排查 = 容器监听 `0.0.0.0:8787` ✓、宿主 ufw inactive、`YJ-FIREWALL-INPUT` 只 REJECT 已知攻击 IP ⇒ **卡在腾讯云安全组/轻量防火墙**（需控制台开 TCP 8787 入站，SSH 做不到）；或不开端口走 **SSH 隧道** `ssh -N -L 8787:127.0.0.1:8787`（微信开发者工具请求本机等效可用）—— **隧道已实测**：本机 `-L 8788:…` 下 POST `/api/generate` 返回真实生成结果（14×14、5 色、swaps 6）且 `/api/results` 能列到它 ⇒ 容器内 beads-gen 子进程路径全通。两条均写入 README「国内 VPS 实战坑」章。
    4. 本轮脚本修正：**`PORT` 以前是谎报可覆盖**（compose 端口写死 8787）⇒ 改 `"${PORT:-8787}:8787"` 并在 deploy.sh/CI 透传；CI 健康检查同步用 `vars.BEADS_STUDIO_PORT`。
    5. 安全提醒已入档：本服务**无鉴权**，公网开端口 = 任何人可读列表/提交生成；默认建议走隧道或限源 IP。
    6. 这两道坑（镜像仓库不可达 + 云侧安全组与主机防火墙是两层）另沉淀为 **K-065**（`[环境]` 片）。
  - **发布链接通（用户选「推 develop + 开 PR」与「整批 develop→master」）**：提交 `1fc4be2`（beads-studio 全部交付，35 文件）已推 develop，PR **#4** = develop → master。
    过程中发现并处理三事：① **GitHub Variables 实际为空**（用户以为配好了；`gh variable list` 核实后由本会话补建三条，Secrets `SSH_*` 已就位）；② PR 初始 `mergeable_state=dirty`——上次同步（PR #3）用了 **squash**，导致本次全域冲突 ⇒ 在 develop 上 `git merge -X ours origin/master` 反向吸收（合并提交 `4efc511`，合并树与 develop 顶点 **零差异**）；③ `-X ours` 后核树抓到一处**静默重复定义**（`check-context-budget.mjs` 出现两个 `checkStagedFreshness`）与 `ctx/index.json` 陈旧 447 行 ⇒ 两文件取 develop 侧 + 重新生成。以上沉淀为 **K-066**（`[工具链]` 片 —— 讲的是 git/CI 同步链；原拟归 `[流程]` 会顶破该片 8000 上限，改归其真实域）。
    另：CI 健康检查改为**走 VPS 回环**（安全组未放行时公网 curl 会误判为红）；workflow 触发收窄为**只挂 master** + `workflow_dispatch`，并声明 `environment: production`（可选人审）。
  - **CI 发布已实跑通（PR #4 合并后）**：合并产生 master push ⇒ `beads-studio-deploy` 自动触发。首跑 **失败**：`Permission denied (publickey)` —— 排查到 TCP 已到 sshd（非安全组问题）⇒ 是 **`SSH_KEY` secret 内容坏了**（UI 粘贴丢行尾换行的典型形态）。用已验证可用的私钥 `gh secret set SSH_KEY --body "$(cat <key>; echo)"` 重写三条后 `gh run rerun --failed` ⇒ **deploy ✓ 58s、健康检查 `OK（回环）`**、VPS 上 `curl 127.0.0.1:8787/api/results` = 200。教训入 workflow 注释。
  - **同批踩到并修掉两处流程债**：① master 的 `commit-lint` 被我**跑红**。用户贴出 CI 日志后本地复现（`npx commitlint --from=083bb0f --to=6583191`）= **3 项违规**：`release:` 的 type-enum + scope-empty（标题本身，我上轮只说了这一层，**不完整**）、以及 `footer-max-line-length` —— 后者成因是 **squash 折叠时 GitHub 给每条子提交主题加 `* ` 前缀**，一颗 **99 字符的合规标题被拼成 101 字符 footer 行** ⇒ 与标题无关、整条同步必红。两道修：同步类 PR 标题固定 `chore(release): …`；`commit-lint.yml` 识别折叠同步提交（正文含 `* <type>(<scope>): `）**只校标题行**（子提交进 develop 时已逐条全量校过）。**曾按用户选择把 `header-max-length` 收到 96，落地前普查存量发现 develop 还有 98 / 99 字符历史标题 2 颗、而 PR 阶段逐条校全部提交 ⇒ 收紧会把下一次发布 PR 判红且不可追修，遂回退 100 改走工作流兜底**（该反悔已作为追记并入 K-066：改阈值前先量存量）；另修一处**文档自相矛盾**：§2.5 的「header 超长」反例只有 75 字符、实际拦不住（已换成 113 字符并 commitlint 实测报 `current length is 113`）；② PR #4 **又是 squash** ⇒ `master` 上再次出现与 develop 无血缘的提交（K-066 当场复发）⇒ 已按规则做**反向吸收**（合并提交，树与吸收前 **零差异**、master 恢复为 develop 祖先），并把「合并后立刻反向吸收」的四行命令写进 `docs/ci/commit-and-review-rules.md §4.1`。
- **前端预览缺陷与三视图（用户反馈「生成后无法预览图片和错位图片；应可显示原图/正解/错位」）**：
  - 真因是我写的索引 bug：`draw()` 用 `colors[y*cols+x]`，但 `pattern` 是**行字符串数组**（长度 = 行数）⇒ 14×14 盘上除前 14 个下标全取到 `undefined`，画布几乎空白（正解与错位同受损）。改 `colors[y][x]`，并补 `.`/`x` 字符与色号 `1-9A` → 色板下标映射。
  - 新增**三视图**：原图 / 正解图 / 错位图。原图靠**缩略图随结果存盘**（前端选图时本地压 ≤448px JPEG，~5KB；POST body 改为 JSON `{w,h,data:base64(RGBA),thumb}`）⇒ 点历史条目也能回看；旧 2 条无缩略图的显示「未存原图缩略图（旧数据）」而非谎报成功。
  - **列表接口改轻投影**（原本把每条的 `levelDraft`+report+thumb 全吐，小游戏拉列表也吃这个包）⇒ 只回元数据 + `hasThumb`，点条目再拉单条全量。
  - **屏幕层取证**（这类 bug 单测抓不到，K-037）：`temp/studio-uicheck.mjs` 真浏览器跑「造图→上传→生成→切三视图→逐像素数有色格」，含**变异自检**（旧索引写法重画 → 有色比例 2.4%，证明门槛断言有判别力）。结果：原图 100% / 正解 68.7% / 错位 68.7%（门槛 ≥25%）、分桶色数 5（≥3）、thumb 与轻投影均 ✓。
- **默认值改推荐值 + 异形只分长方形/非长方形（用户 2026-09-20）**：前端预选 standard29 / 10 色 / 用色 8 / k=8 / 滤波 1 / 误差最小 / 铺满整盘（默认勾选），每项 label 标「推荐」（理由入 README 表：8 = `BEAD_COLOR_MAX`、k 8 = `MISPLACED_PAIRS_MAX`、29×29 按 ADR-0018 仍属设计档已写清）。形状改为二级选择：「长方形 / 非长方形」→（非长方形时）圆/六边/心。
  - **异形「缺漏」真因两处（`beads-gen::shapeMask`）**：① `inset = 0.02` 把形状整体内缩 ⇒ 盘边一整圈空位；② 只按**格心**判定 ⇒ 半格在形内也被判空（阶梯缺角）。现 `inset = 0` + 「中心或任一角在形内即保留」（5 点采样）。实测 29×29：circle/hex/heart 形状内空洞 **0**；UI 侧圆形重生成亦验证「形状内 705 格、空洞 0、形状外误铺 0」（第一次报 ✗ 是**我的判据与掩码口径不一致**（用格心判形状外），改成与 `shapeMask` 同源 5 点口径后转绿）。
- **参数值域纠偏（用户追问「色板是什么概念、值域是否正确」后实测发现的真隐患）**：
  - 概念先分清：**色板 = 量化目标候选色集合**（`--palette`），**用色上限 = 实际从池里挑几种**（`--colors`）；UI 文案已改成「候选色集合（量化目标色）」/「实际用几种颜色」。
  - 值域核正：游戏 10 色与生成器 `GAME_PALETTE` **逐字节一致**（曾一度误判为 12 色 —— 多出的两串是 `BeadsPalette` 的 UI 面板色，不属珠色表）。可入关真域 = 色板 **10** / 用色 **3–8** / k **1–8** / 盘面 **6–29 × 5–29**（全取 `systems-index §3` 冻结常量）。
  - **真隐患：Artkal 不是“导入报错”，而是静默换色**。实测 artkal 限 8 色 ⇒ 色号仅 `.12345678`、用色 8，**BOOT 全过**；但游戏不读 `paletteHex`、按色号取 `BEAD_PALETTE` ⇒ 预览 `#249E6B…` 会变成 `#FDF6E9…`（图案在、颜色全变且不报错）。
  - 修法定单一真源：`server.mjs::importBlockers()` 写盘时算 `importable/blockers` ⇒ 前端结果卡与列表项标红 + `GET /api/results/:id/level` 对不合规产物 **422 + 原因**；`importLatest` 将原因**原样透传**（不降级成“无 levelDraft”），新增1 例单测钉住；色板选 Artkal 时用色域放开、选回游戏 10 色时**夹回 3–8**。
  - 两个参数关系一并实测入文档：**k 与用色数无关**（6×5 小盘 + 3 色 + k=8 仍配对达标；真配不满则 `der.ok=false` 非零退出 → 422，不静默出坏盘）；**smooth 经验值**：29×29 类照片 0/1/2/3 → 相邻率 0.891/0.896/0.899/0.899、色差 78.7/79.3/79.7/79.7 ⇒ 剪影图 0–1、照片 1、要整块同色才试 2（3 已收敛）。
  - 取证：`temp/studio-uicheck.mjs` 新增四断言（夹域、红标文案、/level 422+blockers、Artkal 域放开）均绿；屏幕层整套 18 条断言全绿。`beads-mvp-patterns.mjs` 手工作图不走这套采样 ⇒ 滤波/选色模式对其无意义（已写进 README防误用）。
- **错位密度模式（用户反馈“错位豆基本很少，要成片错豆”）**：根因不是算法错，而是面板只给了 **k 对交换**这一条路 —— 29×29 盘 k=8 仅 16 颗错位（实测占 348 可填格 = **4.6%**），其余全就位 ⇒ 看着像没打乱。接上引擎已有的 **`misplaced` 全错位初盘**（入库 8 关用的就是它，`applyMisplacedToGrid` misplaced 优先、`validateMisplacedGrid` 校轮廓/守恒/错位≥1）：
  - `beads-gen` 新增 `--mis full|swaps`（默认：给了 `--swaps` 就 swaps，否则 full）；full 模式 `levelDraft` 带 `misplaced`、`swaps: []`、`cycleProfile=long`。
  - **一个静默错东西的坑当场堵在构造前**：若 `--mis full` 同时带 `--swaps 8`，旧写法 `der = sw ? 交换 : derange()` 仍会走交换 ⇒ 拿到的还是 2k 颗。现把 `misMode` 提到 `swapsK` 之前定，full 模式强制 `swapsK = 0`。
  - 链路打通：`server.mjs` 收 `?mis=`（默认 full）并透传 `--mis`；`importBlockers()` 改为**按模式判**（full 不受 `MISPLACED_PAIRS_MAX=8` 约束，但校验草案确实带 `misplaced`）；`level-import.ts::draftToLevel` 恢复 `misplaced` 透传；面板新增「错位密度」二档（全错位默认 / 少量交换才出 k 输入）。
  - 实测：full = **348/348 = 100%** 可填格错位（屏幕层 705/705）vs swaps = 16/348 = 4.6%；新单测 1 例（草案带 misplaced ⇒ 原样透传且过 BOOT）；屏幕层取证新增 3 条断言（全错位密度、`/level` 200 不被 k≤8 拦、“少量交换”才出 k）均绿，整套 22 条全绿。可玩性提示已写进 README：密集全错位盘靠 board 直填周转（G-3 结论），真机手感待走查。
- **已存结果可删 + 导入不再盲取最新（用户：列表里不要的条目也会被导入）**：此前**根本没有删除能力**（无 `DELETE` 接口、无前端钮），只能手动 `rm -rf data/<board>/<id>`。
  - 服务端新增 `DELETE /api/results/:id`：id 走与建目录同一套 `[a-z0-9-]` 白名单（不拼用户传入路径），**不可逆**⇒ 前端 ✕ 必带二次确认；不提供批量/目录级删除。
  - `importLatest()` 从「取 `results[0]`」改为「**取最新一条 `importable !== false`**」：列表里常夹参考图/实验残品，盲取只会吃一个 422，用户看到的是“导入失败”而不是“该删/该选对条目”；全不可入关时报“N 条均不可入关”，不去碰 `/level`。
  - 取证：新单测 2 例（跳过不可入关、全不可入关不碰 /level）+ 屏幕层 2 条（✕ → 确认框 → 列表 3→2；不存在 id 与 `..%2f` 穿越型 id 均 404 不碰文件），共 14 例单测 / 24 条断言全绿。
- **公网放行已完成（2026-09-20 用户操作 + 本会话复核）**：CVM `ins-bnj9hmh3`（ap-beijing，`product_name=CVM` ⇒ 走安全组而非轻量防火墙）加 TCP 8787 入站后，**公网端到端全绿**：
  `GET /` = 200 → `POST /api/generate`（96×96 RGBA）得 `small14-1789910083144-e64a` → `GET /api/results/:id/level` 字段完整（14×14 / pattern 14 行 / swaps 6 对 / `cycleProfile=short` ⇒ 生产端修复已随发布上线）→ 过本仓 `draftToLevel` + `validateBeadsLevel` **通过 ✓**（时长按 k 定价 = 270s）。
- **待办（本单遗留，均属环外）**：① 若以后要**真机**导入：手机出口 IP 与本机不同，限源规则需放开到 `0.0.0.0/0`（本服务无鉴权，自行权衡）或改用 SSH 隧道；② 微信正式环境需 **https + 合法域名**，开发/体验版先勾「不校验合法域名」；③ 色板仍接 **ADR-0016** 待裁（`--palette artkal` 产物只出参考图，服务端已 422 拦下导入）；④ **develop→master 以后固定用 merge commit**，不要再 squash（K-066）；⑤ VPS 上仍是旧版（无全错位与删除能力），待发 `deploy.sh`。

---

## WXG-T-180

**beads·盘面规格档位落档（29×29 标准方形盘）+ 29×29 MVP 三关草案** · 负责：主理 人(CodeBuddy) · 状态：✅ 主体完成（2026-09-20 本会话收口）

- **✅ 续作记录（Qoder · 2026-09-20，接 ADR-0018 裁定后的收口）**：
  - **并发会话已落库（本单主体交付）**：`d4a36db`（ADR-0018 归档 + misplaced 全错位初盘规格回写）、`89f28e0`（引擎支持 misplaced 全错位初盘 + **8 关 MVP 图案入库**：关 1–4 = 14×14 / 关 5–8 = 18×18，≥4 色，时长按珠数>色数>聚集度公式；`tools/scripts/beads-mvp-patterns.mjs` 产真源 JSON + 级联感知逐分复算测试）。**生成器转正已完成**（`tools/scripts/beads-gen.mjs` + `beads-mvp-patterns.mjs`，原待办 ③ 销项）；**`GRID_MAX` 放开已在 `systems-index v1.34` 完成**（13/12 → 29/29，§3 变更单 + 三条连带登记，原待办 ① 销项）。
  - **留边模型裁定（用户 2026-09-20）**：`computeFitZoom` **保留固定 `BOARD_FIT_MARGIN=24`**，ADR-0018 §3.4.2 珠宽闭式解**搁置不落码**，复评触发 7 不触发；后续如需再落地另行立项。ADR-0018 已加搁置注记（本会话）。
  - **余项分流（均后续另立项）**：① 色板戊案接 ADR-0016（Proposed 待裁）；② B2/B4 顺序多盘 UX 规格 + `boards[]` 关卡 schema（ADR-0018 §3.2）；③ 29×29 解锁三条件（LOD 真机 + 触控验证 + `CAMERA_ZOOM_MAX_SPAN` §3 变更单，ADR-0018 §3.3）。
  - **本会话改动**：仅文档（ADR-0018 搁置注记 + 本台账），**零代码、零冻结值**；门禁 `check:tasks` / `check:links` / `verify` 随收口跑。

- **上位（用户 2026-09-20 盘面调研）**：5mm Midi 标准方盘 = **29×29 = 841 颗**；另有小号 14/16/18、异形（圆/六边/心形）、Mini 2.6mm ≈107×107、Maxi 10mm 29×29。用户要求「规则化落档 + MVP 先做几关 29×29」。
- **产物**：`design/proposals/board-size-29-mvp.md`（档位表 + 差距表 + 四项风险 + 前置顺序）/ `design/proposals/levels-29-mvp-draft.json`（3 关草案）/ `temp/lv29-0{1,2,3}/`（PNG 预览）。
- **与现状的差距**：`GRID_MAX_COLS/ROWS = 13/12`（= **156 格**）⇒ 29×29 是其 **5.39×**；750px 屏宽下单屏放不下 29 列（1508px）⇒ 必须缩放 ≈ **0.497**（珠屏上 25.9px）；静态图元 ≈ **8410**（现 ≈1560）⇒ **5.4×**。
- **四项风险（诚实登记，按严重度）**：① **图元最大** —— 现无「缩小视图时珠子整体降层」机制（`WAVE_LOD_LAYERS` 只在动画期按列降层）⇒ 前置项 = **zoom 自适应 LOD + 真机帧率验证**；② **触摸** —— 25.9px 珠必错点，靠缩放 + 最近格心判定缓解，须真机手感验证；③ **难度** —— 841 格的寻找成本远高于 156 格，`levels-spec §3` 的 k / time 曲线需**重推**；④ **冻结变更** —— `GRID_MAX` 属 `systems-index §3.3` 冻结值，放开须走 **§3 变更单**（含 changelog），不得就地改。
- **MVP 三关（草案）**：`--palette artkal --colors 8 --colorsmode error --swaps 8/12/18` ⇒ 841 格（可填 778 / void 63）、8 色、交换法错位 **16/24/36 颗**、色差 44.0、初始盘同色相邻率 0.771。**错位采用 `levels-spec §2.1` 交换构造法**（不是 spike 期的"全盘错位" —— 后者在 841 格上要求挪 841 颗，不可玩）。
- **⚠️ 不可直接入关（两条硬阻断，都须先裁）**：① `rows = 29 > GRID_MAX_ROWS = 12`（BOOT 校验会拒）；② 色值为 **Artkal 真值**，游戏 10 色板无对应珠色 ⇒ 接 **ADR-0016 戊案**（只换色值、不动结构）。
- **生成器侧连带修复（3 处，属 WXG-T-179 spike 能力）**：① 新增 `--swaps K`（游戏口径交换构造，输出 4 元组 + `levelDraft`）；② `toRowStrings` **紧凑重映射**修复 —— 大色板下限色后的色号是**原板索引**（可达 174），旧版直接查 35 字符表 ⇒ 29×29 首行输出 229 个 `undefined`（**同 K-056 追记的「维度泄漏」型**）；③ **自检口径分叉** —— 交换法只动 2k 颗、其余格**本就该就位**，旧的全盘错位断言在 k=8 时误报「存在就位珠 10」。
- **门禁**：`check:tasks` / `check:links` / `ctx:check` / `verify` 随本单跑；本单**零冻结值改动、零游戏代码改动**（产物全在 `design/proposals/` + `temp/`）。
- **原待办销项（2026-09-20）**：① `GRID_MAX` 放开 → v1.34 已完成；② zoom LOD → T-181 立项；③ 生成器转正 → 已入 `tools/scripts/`；④ 色板决策 → 余项分流接 ADR-0016；另加 ⑤ 留边模型 → 用户裁保留 24px 搁置（见上方续作记录）。**当前待办：无。**

---

## WXG-T-181

**beads·大盘 zoom 自适应 LOD 立项（ADR-0017，处置 §3.3 v1.34 的风险 1）** · 负责：主理人(CodeBuddy) · 状态：✅ 收口（2026-09-20 本会话，用户拍板）

- **✅ 收尾记录（Qoder · 2026-09-20）**：
  - **不阻塞裁定**：ADR-0018 已裁 MVP 实际用盘 = 14×14 / 18×18（每帧图元 2156/3564，与现行同量级、无需 LOD）⇒ 本立项的 LOD 需求**仅服务于 29×29/异形/2×2 拼图设计档**，转为 **29×29 解锁三条件之一**（ADR-0018 §3.3：LOD 真机 60fps + 触控错点率 < 10% + `CAMERA_ZOOM_MAX_SPAN` §3 变更单），后续解锁时**另立项**实施。
  - **ADR-0017 处置**：保持 **Proposed 留档**（层集/阈值/滞回形态结论有效，作为未来实施单的分析底稿）；本单不再持有待办，原待办 ①②③④ 全部随上述分流转出。
  - **初始取景口径（用户 2026-09-20 重申，二选一拍「维持现状」）**：初始游戏任何盘面**缩放居中**，大盘缩到含 `BOARD_FIT_MARGIN=24` 边距；**小盘（放得下视口）顶格 `zoom=1` 不放大**（留白多于 24px）——与 ADR-0018 §3.4.1「zoom=1 = 5mm Midi 参照、不放大超过参照」及 ADR-0015 §3.4 复位口径**完全一致，现状已实现**（`computeFitZoom = min(1, 含24px适配)`，`fitCamera` 落点 `_setupLevel`/`_loadStage`），**零代码、零文档漂移**；「一律恰好 24px（小盘放大）」方案未采。
  - **本会话改动**：仅台账，**零代码、零冻结值**。

- **上位**：用户 2026-09-20「zoom 自适应 LOD 立项（风险 1）」，并提出三种形态方向：① standard29 单盘；② 小盘单图或 **2×2 拼图**（small18 / small16 / small14）；③ 异形盘。
- **产物**：`docs/architecture/adr/ADR-0017-beads-zoom-adaptive-lod.md`（Proposed）+ `architecture.md` 关联决策行。
- **两种形态的关键判断（由数据直接得出，ADR §1.2）**：
  1. **小盘"单图"不需要 LOD**（small14 2156 / small18 3564 图元，与现行 156 珠的 1810 同量级）—— LOD 只标准确用于 **standard29 / 异形 / 2×2 拼图**；
  2. **2×2 拼图不是更省、而是更贵** —— small18 四盘 = **1296 格 > standard29 的 841**（图元 14256）⇒ **拼图模式对 LOD 的需求最高**，不能因"每块小"就豁免。
- **现状缺口**：已有 LOD 判例只有动画期的 `DISSOLVE_LOD_ALPHA=0.60` / `DISSOLVE_LOD_LAYERS=4`（层集 L1+L2+L3+L5）与 `WAVE_LOD_LAYERS=7`（按列）；**没有「按视图缩放降低静态珠层」的通道** —— 这正是 29×29 能装进去却可能跑不动的原因。
- **方案（ADR §3）**：**乙（视口裁剪）先落地 + 甲（zoom 档位降层）为主干**；丙（整盘一律降）仅作低端设备回退阀；丁（同色连通块合并绘制）登记为远期方向、本轮不做。建议档（均含红线）：满层 11 / 中档 6 / 低档 5 层。**滞回（hysteresis）列为必需项**（否则阈值附近缩放会跳变闪烁，且可能触 `accessibility` D2）。
- **不可降红线（与 ADR-0016 丙案同源）**：`filled` 珠 11 层中，**L11 目标色垫**（谜面载体）与 **L5 符号**（a11y 三重编码的符号维）**不得因性能砍掉** ⇒ 一句话：**LOD 砍的是「质感层」，不是「信息层」**。
- **诚实边界（勿视为已解决）**：① **层集由 art 冻结**、阈值均 `[待确认]` ⇒ 本单**未做真机帧率实测**，不能声称"性能已解决"；② 建议档 11→5 ⇒ 841 珠从 9251 降到 ~4205，**仍未达小盘单图量级**。
- **本单改动**：仅**文档**（新增 ADR-0017 + `architecture.md` 关联行 + 本台账），**零代码、零冻结值**（ADR 明确不引入 `systems-index §3` 新值）。
- **待办**：① art 冻结层集（林绘澄正主）+ 阈值定档；② **工程实施单**（视口裁剪 + zoom 档位 + 滞回）须**另领号**；③ 真机帧率实测（29×29 与三种形态）；④ playtest 观感（"远看变丑"与否）。

---

## WXG-T-183

**beads·board 锚直填消费序改写（选豆点固定 + 同序配对）** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-20，beads 511 例绿、verify 17/17）

- **上位（用户 2026-09-20 三则裁定）**：① `_boardSelected` 增稳定 `anchorRow/anchorCol`（**拾取那一下的坐标**），填珠过程不改——展示用「当前头珠」可另存（沿用 `row/col` 静默转移），但优先级基准恒为选豆点；② 消费序 = 距选豆点**切比雪夫**升序（与组选 8 向连通同度量，平局行主序）；批量填时目标空格按 BFS 序（离被点目标由近及远）、组员按离选豆点序，**同序配对**——最近组员填最近目标，视觉上「从选豆点一片揭起、由近及远归位」；③ 托盘侧不适用（托盘同色珠可互换、不在棋盘格坐标上，「离选豆点距离」只对 board 锚有意义）。
- **实现**（`games/beads/src/game/beads-game.ts`，cocos 镜像同步、两文件仅 import 行差异）：`_boardSelected` 增 `anchorRow/anchorCol`（建锚固化）；`retrieveSelectedGroup` 部分收纳基准改选豆点（`_nearestFirst` 度量保持欧氏² 未动、仅钉死基准）；`_tryDirectFillFromBoard` = 消费序 `consumption`（切比雪夫升序、平局行主序）× 目标序 `targets`（被点格 + `planGroupFill` BFS 由近及远）**按索引同序配对**，替代旧「逐目标就近取珠」O(n²) 扫描；锚更新 = 组空清、否则仅头珠转移、选豆点恒不变。**托盘侧 `_placeSelected`/`planGroupFill` 零改动**（裁定③）。
- **规格同源回写**：`bead-grid.md` v2.4（头注 + §2.2 组语义直填句 + §2.3 路径 A 收纳句 + §9 版本表）。
- **判据**：`misplaced-direct-fill.test.ts` 新增**选豆点基准例**——列 0 竖链 5 珠、拾取 (0,0)、点远端 (4,1)（(3,1) 预填就位堵 BFS 保单目标），断言消耗 (0,0)（新序）而非旧序会取的 (4,0)，直接区分新旧消费序（判据可判别性按 K-055④ 口径构造）。
- **领号披露（K-046 判例再+1）**：用户初令「任务号 182」，按 K-046 扫工作树发现 **182 已被占用**（`games/beads/design/forensics/wxg-t-182-g3-derangement-deadlock.md`，程基岩 2026-09-19 G-3 取证留档、结论已采纳、未登主表），经用户裁定**改领 183**（T-167 同型），头注校准至 184。
- **门禁**：`verify` 17/17 PASS；`kb:check` 八重校验 PASS；`ctx:build` 已刷新（含 forensics 新文件未入库提示，属并发会话产物、本单不代提交）。
- **沉淀**：`kb:sync --task=WXG-T-183` **新增 1 / 修改 0 / 激活 0 / 归档 0** —— **K-063**「会『静默转移』的锚不能当距离排序基准：消费序基准与展示坐标必须分离」（判据片；同族 K-055 下游）。
- **待办**：无（纯行为改写 + 规格回写，零 §3 数值；真机手感随下次真机复验批顺带走查）。

---

## WXG-T-184

**beads·双写存档层（local + 云 KV + 合并策略）** · 负责：主理人(Qoder) · 状态：📝 立项留档（未开工，2026-09-21 用户令）

- **上位（用户 2026-09-21）**：「进度存储 + 账户关联，无自建后端」场景下，微信原生能力的立项确认；结论=可做，路径=**本地缓存做工作副本 + 小游戏用户云存储（CloudStorage KV）做跟账号的跨设备副本**。本单留档范围与硬约束，实施另行开工（可拆 Story）。
- **平台硬约束（2026-09-21 官方文档核实，实施时以文档页为准复核）**：
  1. `wx.setUserCloudStorage / getUserCloudStorage / removeUserCloudStorage`：小游戏专属、**客户端直调、无需自建后端/无需合法域名**；数据按 **openid×游戏** 托管 ⇒ 「进度跟微信号走」天然成立，换设备即恢复。
  2. 额度：每用户 ≤ **128 对 KV**；**每对 key+value ≤ 1024 字节**；key ≤ 128 字节；value 必须是 string（`JSON.stringify` 自理）⇒ 存档只放进度/星级/钱包类小数据，**图案/关卡数据严禁塞入**（那是关卡分发的事，见「范围外」）。
  3. 本地缓存 `wx.setStorage`：单 key ≤ 1MB、总量 10MB，按 用户×游戏 隔离；随代码包清理/用户删游戏而失。
  4. 开发者工具对云存储支持有限 ⇒ **判据必须真机取证**（同 K-046 取证层次教训：工具全绿不构反证）。
  5. 写入侧**客户端可伪造**：单机休闲期接受；一旦上排行榜/对抗，升级云开发（云函数校验）另立项。
- **范围（实施单四件）**：
  1. **存档抽象层**：框架 `services` 增 `persistence` 端口（get/set/flush），core 零 `wx`（L2/L3 纪律：平台调用只在宿主适配层，先例 = `BeadsBootstrap` 注入 `wx.request`，5635084）；
  2. **本地副本**：现有 meta 钱包/体力/解锁/星级落盘改走端口（现状直用 `wx.setStorage` 的位置收口）；
  3. **云副本**：结算/切后台时机把聚合快照写 CloudStorage（**1–2 个 key**，编码预算 ≤1KB/键，键名预留版本前缀）；
  4. **合并策略**：冷启动 `getUserCloudStorage` 与本地按**时间戳取新**、冲突字段表（哪些以云为准/哪些以本地为准）随 S10 元游戏 GDD 一并冻结；网络失败 ⇒ 静默降级纯本地，下次结算补传。
- **验收口径**：正式判据开工时从 S10/meta GDD §8 导出（本单不预写伪判据）；机械门 = verify 17/17 + 真机双设备同账号往返（A 机通关 → B 机恢复）。
- **范围外（登记去向）**：① **关卡数据分发**（新关卡下发给玩家）= 分包/云开发存储/CDN 三选一，属关卡管线，**另立单**（与本单解耦）；② 防作弊与好友榜（开放数据域 `getFriendCloudStorage`）待有排行榜需求再立项；③ beads-studio 玩家自助通道的正式版走 https 备案域名或云托管，见 T-179 遗留。

---

## WXG-T-185

**beads·关卡数据分发管线调研留档（分包/云存储/云托管）** · 负责：主理人(Qoder) · 状态：📝 调研留档（未开工，2026-09-21 用户令「存下调研与推荐方案，后续派生任务执行」）

- **问题**：新增关卡数据（`levels:sync` 产物 / 运营关包 / 未来 UGC 关）平台侧有什么能力可**存储并下发**给玩家，且尽量不自建后端。关卡 JSON 很小（rowstrings 一关数 KB），包体红线（本仓口径）：主包 ≤4MB、全部套餐 ≤30MB。
- **能力对比（2026-09-21 官方文档核实）**：
  | 路线 | 存放 | 下发 | 域名/后端 | 更新 |
  |---|---|---|---|---|
  | ① **分包加载** | 关卡打进子包（微信托管） | `wx.loadSubpackage({name})` 按需拉 | 全免 | **要发版过审** |
  | ② **云开发·云存储/数据库** | CloudBase 存储或集合 | `wx.cloud.downloadFile(fileID)` / 云函数查询，微信私有通道 | **免备案域名**，云函数=托管后端 | 后台/脚本随时写 |
  | ③ **微信云托管** | 自有容器服务（beads-studio 形态） | `wx.cloud.callContainer()` | 服务要有，免备案域名 | 随时 |
  | （对照）自建服务器 `wx.downloadFile` | 现 CVM | 直连 | ⚠️ https+**ICP 备案域名**+downloadFile 合法域名 | 随时 |
- **网络约束备忘（本轮实证/核实，派生单共用）**：合法域名只收 **https/wss 域名，禁 IP/localhost，必须 ICP 备案**（境外注册商域名需先转回国内，CF 仅做 DNS/代理不碍备案）；端口可配但配后仅放行该端口；开发工具勾「不校验合法域名」、真机开发版开「调试模式」可绕过；**小游戏运行时全局 `fetch` 不存在**（实测），平台通道一律 `wx.request` 注入（先例 5635084）。
- **推荐路线（拍板前立场）**：
  1. **短期（现状）**：关卡随 `levels:sync` 打进包，不动；
  2. **主包触 4MB 红线时**：`design/levels` 生成物挪**分包**（Cocos 侧目录配套改造）；
  3. **要「不发版上新关」时**：上 **云开发存储**——脚本上传 `levels:sync` 产物 + 客户端拉清单/下载/`wx.setStorage` 缓存（与 T-184 的 `persistence` 端口同地基）；
  4. **UGC 关互通**（A 生成分享给 B）才需真后端：云开发数据库原型即可；beads-studio 玩家自助正式通道另议（备案域名或云托管，见 T-179 遗留）。
- **派生执行单（均未领号，触发时另立）**：ⓐ 云开发环境开通与选型 spike（环境/额度/免费层核实）；ⓑ 关卡清单 JSON schema + 上传脚本（接 `levels:sync` 产物）；ⓒ 客户端远端关拉取 + 本地缓存 + 过 `validateBeadsLevel` 才入表（复用 `level-import` 校验面，L3 纪律：注入式通道）；ⓓ 分包改造（触发条件=主包尺寸，接 `check:size`）；ⓔ UGC 分享链路（依赖 ⓐⓑⓒ 与合规裁定）。
- **本单改动**：仅台账留档，**零代码零 §3**；正式判据待各派生单从对应 GDD §8 导出，本单不预写。

---

## WXG-T-186

**beads·组珠消费序改剥皮序（沿组连通图上距离，直填/取回共用）** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-22 本会话按原用户裁定收口）

- **背景与裁定（用户 2026-09-22 四项）**：① 「最近」由几何距（v2.4 直填切比雪夫 / v2.3 取回欧氏²）改为**沿组连通的图上距离**；② **不设颗数上限**（拾取时一次算完整序，点击只取前缀）；③ 同层内「仍有下层邻居」的引路珠**押后**；④ 直填与取回落槽**共用同一份序**（两路口径一致由构造保证，不靠两处写成一样）。取证：`temp/metric-*.cjs`（两路口径 89.4% 组形给出不同序）/ `temp/peel-*.cjs`（跳 0% · 碎 42.2% 为各口径最优；短路版 47.6ms → Tarjan 版 0.71ms@144）。
- **交付**：`games/beads/src/systems/consume-order.ts`（新增 `planConsumeOrder`：一次 BFS 定层号 + 有序前沿增量维护 + 每步一次迭代 Tarjan 求割点；TypedArray 整次调用共用 ⇒ 零逐步分配；O(n²)）；`beads-game.ts` 接线（`_boardSelected.cells` → `.order`，`selectBoardBead` 拾取时算序，`retrieveSelectedGroup` 截前缀，`_tryDirectFillFromBoard` 删内联切比雪夫 sort，**删 `_nearestFirst`**）；快照 `boardGroupRows/Cols` 语义不变（渲染层只当集合用）。
- **规格回写**：`bead-grid.md` **v2.5** —— §2.2 新增「消费序」条（四档优先级表 + 级 1/2 互证不可兼得、让步固定为级 2）、§2.3 路径 A 第 2 步改「消费序前缀」、§9 补行。**§3 数值零改动**。
- **判据**：`tests/consume-order.test.ts` 7 例全绿（U 形不跳缺口 / 3×3 任意 k 剩余连通且中心珠最后 / 同层引路珠押后 / 单双珠 / 确定性 / 直填集成沿片揭起 / 取回与直填同前缀）；`misplaced-direct-fill.test.ts` 旧基准例仍绿（直链下图距 ≡ 几何距，仅注词迁移）。
- **验证**：beads 全量 `vitest` **543/543 绿**（47 文件）；`pnpm run framework:sync` 已产镜像（写入 2）；`pnpm run verify` **18/18 PASS**（首轮唯一 FAIL = `framework:sync:check`：T-187 会话在 sync 之后改了 `src/` 注释⇒ 重跑 sync 后转绿，非本单缺陷），`check:tasks` / `check:links` 绿。
- **沉淀**：**K-067**（判据）「就近」排序的度量必须与集合的连通定义同度量，且多消费口共用一份序（`kb:sync` 统计：新增 1 / 修改 1（去 `[K-tmp]` 残留标记）/ 激活 0 / 归档 0；`kb:audit` 无相似命中）。
- **号源追认（2026-09-22，注 8）**：本单开工时未及时向主表登记，T-187（托盘修复）会话核树时漏核未跟踪文件误领同号，用户拍板：186 归还消费序、187 归托盘修复。教训同注 7：领号前 `git status` 未跟踪文件也要核头注。
- **收口时澄清的追认页误记**：前记「`beads-game.ts` 已部分接线」为收口会话自身的中间态（当时仅完成 import + 字段改名），非并发会话遗留；前记「`grep consume-order` 在 `src/` 无 import 命中」同理已解除（接线完成后 import 存在）。

---

## WXG-T-187

**beads·托盘满槽死锁修复（§8-11 收窄到 4b，满槽可换选）** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-22，用户裁定 A）

- **症状**：用户真机实报「托盘完全无法选中」（棋盘/齿轮/道具卡正常）；自 T-161/T-178 修复后从未真机复验输入链。
- **根因（探针 100% 实锤，`tmp-tray-deadlock.mjs`）**：`_routeTraySlot` 4a 分支的旧 §8-11 门 `boardSelected !== null && freeCount === 0 → return` 把禁「取回（4b）」扩成禁「换选（4a）」；而 `selectBoardBead` 幂等无取消路径 ⇒ **满槽 + board 锚 = 玩法硬死锁**（托盘 12/12 时任何托盘点击被静默吞）。GDD 自相矛盾：§2.1 4a（v2.3 无条件换选）+ §8-12（换选即转移） vs §2.4/§8-11（v2.0 满槽吞任意槽），代码忠实实现了旧 §8-11。
- **修复口径（用户拍板 A）**：满槽时点 holding 槽 = 4a 正常同色全组换选（锚转移 tray）；满槽禁「取回」由 4b「无空槽可点」几何保证，无需状态门。
- **改动面**：① `beads-game.ts::_routeTraySlot` 删门（1 行）+ 头注；② `input-control.md` v2.9（§2.1 4a 标注满槽不例外 / §2.4 满槽取回条改写 / §8-11 判据收窄 / changelog）；③ `selection-anchor.test.ts` §8-11 用例改写为「满槽换选」断言（含 v2.6 部分收纳续段）。**§3 冻结常量零改动**。
- **门禁结果**：beads vitest **543/543 全绿**（本单验证期间曾两轮观到 consume-order 2 例红，后经实锤定性 = **T-186 并发会话正在同工作树接线中途的中间态**，其收口后稳定全绿——非本单回归；跨会话并发收口时「测试红 ≠ 存在 bug」，需先核并发写）；探针复跑（重建 dist 后）：满槽 + board 锚点 holding 槽 → `tray:selected +1、traySelected=0、boardAnchor=(-1,-1)`，死锁消除；`pnpm run verify` 全量未跑（本单仅动 beads 域，verify 收口随下次提交批）。
- **取证附带结论**：MCP 预览（wx-compat）无法注入合成触摸事件（`isTrusted:false` 不转发 wx 回调）⇒ 输入类真机问题取证走 Node 真链探针 + 用户设备，不走预览代理。
- **改号留痕**：本单初稿误标 186，GDD/代码注释/测试标题已同批改为 187（见注 8）。
- **待办移交**：微信产物重建后真机复测托盘（含满槽场景）；两份临时探针已删（复现步骤存本节 + GDD §8-11 可测形式）。

## WXG-T-208

**外部 skill 批次接入（4 仓 → 5 件）+ 知识库新标签「接入」分片** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-24，用户三项拍板：ax 由本仓自撰 / 落位 `my-skills/` 挂四 IDE 链接 / `ocr` 与 `bsk` 都装）

- **范围**：接入 `cloudflare/security-audit-skill`、`alibaba/open-code-review`、`Tencent/BrowserSkill`、`google/ax` 四个外部能力，走 `create-plugin` 转换流程后按用户裁定改以本仓 `my-skills/` 正本 + 四 IDE 链接落位（不产 `.qoder-plugin/` 包，不落 `my-plugins/` vendor）。
- **交付（5 件现役）**：`security-audit`（SKILL.md + 14 份域文档 + `report-schema.json` + 2 个 `.cjs` 校验器，**省略** 2 个 `.test.cjs`——校验器自带单测、SKILL.md 不引用）、`open-code-review`、`open-code-review-delegate`（同仓两件，后者**不需配 LLM 端点**）、`browser-skill`（取 CLI 捆绑的 `crates/bsk-cli/skill/` 全量版而非宿主插件精简版）、`ax-runtime`（**本仓自撰**）。四 IDE 链接 20 条 `.<ide>/skills/<name> -> ../../my-skills/<name>`；`my-skills/INDEX.md` 新增 §1b.1（来源/许可/省略件/安全审计结论/本地注意/与同域既有件的触发分工），现役计数 33→38；拉取脚本随件跟踪在 `my-skills/_repos/fetch-vendor-skills-2026-09.sh`。
- **上游无 SKILL.md 的处置**：`google/ax` 经 git trees API 全仓扫描确认 **0 个 SKILL.md**——它是 K8s 上的声明式 agent 编排运行时。按用户裁定改为自撰整理稿，正文只抄官方 `README/DESIGN/docs/concepts/manifests`（快照 2026-09-24 main），首屏显式标「本仓自撰、非上游移植」+「本仓无集群 ⇒ 全文未实测」。
- **CLI 安装与冒烟（真实产物）**：`ocr` **v1.12.9**（npm 全局，`/opt/homebrew/bin/ocr`）→ `ocr review --preview` 实跑通过（本仓 89 文件变更 / 50 待审，≥v1.10.0 故 `--output` 可用）；`bsk` **0.3.1**（官方 install.sh → `~/.local/bin/bsk`，登录 shell PATH 可达，安装脚本自带 checksum 校验）→ `bsk doctor` 报 daemon ok / protocol 1.3 ok / **`FAIL extension connected`（0 browsers）**。两件冒烟同时扇出真前置：**浏览器扩展须用户手工装**、**`ocr review` 须先配 LLM provider**（本仓无 key ⇒ 可用路径是 delegate 件）。
- **结构处置（沉淀越门）**：两条新条目使 `knowledge/lessons/process.md` 工作树读数 **8919 tok** 越 ctx B 门（8000），而 `knowledge/INDEX.md §4` 禁为分片加豁免 ⇒ 用户拍板**新建 `接入` 标签片** `knowledge/lessons/onboarding.md`（片内 `## 接入` 小标题保留，片头记新切缘由）。同步两处硬映射：`split-knowledge-lessons.mjs::TAG_TO_SHARD` + `lib/knowledge-ledger.mjs::LESSONS_SHARD_ORDER`（**均追加尾部**，不动既有补号序），并回写 `lessons.md` 指针页表与 `knowledge/INDEX.md` §2 类别枚举 / §3 分片表。结果：process **7627** / onboarding **1464**，`process.md` 与 HEAD 逐字一致（无净 diff）。
- **并发避让（K 号）**：本树 `ledger.nextId = 70`，而并发会话（beads 视觉样式批）已公布 **K-070–072** 且其入账未落本树 ⇒ 直接 sync 必撞号。做法 = 条目内手工写 **K-073 / K-074** 跳过该段，`kb:sync` 采纳既有 ID 并把 `nextId` 抬到 **75**；两边合并时 `ledger.json` / `CHANGELOG.md` 会冲突，由主理人以 `max(既有 ID)+1` 校准后重跑 `kb:sync`（幂等，不产新条）。若 T-207 批最终未入账，070–072 成永久跳空号（递增不回收，合规）。
- **门禁结果**：`check:links` OK（agents=7 / skills=39）、`check:secrets` OK、`check:plugins` / `check:mcp` OK、`ctx:build` + `ctx:check` OK、`kb:check` 八重校验 PASSED（活跃 71）、`kb:audit` 归档候选与相似命中均无、`selftest:fast` **8/8 PASS**（含 `knowledge:split:selftest` 45/45 断言，证两处映射同步未破装置）。预算面复核：新入 5 件 `.md` 最大 5608 tok（`security-audit/HUNTING.md`），全部 < 8000 ⇒ 无需登记 `vendor-skills` 豁免；且 ctx 只索引 `.md`，随件 `.cjs`（≈8.4k）天然不在 B 门覆盖面内。
- **沉淀**：K-073（外部 skill 批次接入：上游正文零改写 + 本地差异集中登记 INDEX 批次节）、K-074（接外部能力前先机械验源：「仓库存在」≠「有可转换的 SKILL.md」）。
- **余项移交**：① 用户在 Chrome/Edge 装 BrowserSkill 扩展后复跑 `bsk doctor` 至无 FAIL；② `ocr` LLM provider 由用户配置（`ocr config provider`）后方可用非 delegate 件；③ `bsk doctor` 冒烟已自启 daemon（pid 31294），本单未停，随宿主会话自然回收；④ 新 skill 生效需重启/新会话（技能清单在会话装配时读取）；⑤ 本单与 T-206/T-207 各产物**均未 commit**，提交批与 `verify` 全量随下次收口。

## WXG-T-209

**知识库同步批（`kb:sync`）** · 负责：知识库流程 · 状态：✅ 已执行（**本会话（Qoder）2026-09-25 追认入主表**）

- **追认理由**：该号只存在于 `knowledge/CHANGELOG.md`（`### WXG-T-209`）与 `knowledge/ledger.json`（`taskId`），当时未登 `TASKS.md` 主表 ⇒ 注 9 同族的又一实例（用了号未登主表）。
- **后果**：后续会话若按主表最大号领号必与知识库侧撞号。本会话（WXG-T-210）领号前按 **K-046** 口径扫工作树时发现，故取 210 并把 209 追认入表闭合。
- **本行不补交付细节**：原始事实以 `knowledge/CHANGELOG.md` 与 `ledger.json` 为准，不凭推测重写台账（承注 9 的「不代补」纪律）。

## WXG-T-210

**beads·皮肤/风格系统（方案 A 全程序化）§12 决议与四域文档对齐** · 负责：主理人(Qoder)｜林绘澄／文策渊／程基岩 分域交付 · 状态：🚧 文档对齐完成、**落码未开工**

- **决策真源**：`games/beads/design/proposals/bead-visual-style-spec.md` **§12**（v0.4，**七批**修订）＝ S1–S10 决议表 + **C1–C12 实现约束** + §12.5 修订记录 + §12.6 实测层数表 + §12.7 α 上限证据边界 + §12.8 冲突处置表（①–⑬）+ **§12.9 落码开工序（七步，供拆单）**。**本详情节不复述决议，只登记交付与阻塞。**
- **交付（六件，全部零代码、未 commit）**：① §12 v0.4 本体；② `art/assets-spec.md` **v1.5-r15**（§1.9.7 扩为风格插件双通道 + 7.2–7.10）；③ `art/accessibility.md` **v1.5-r15**（16/18 可切换非色相载体、小豆档无孔影响）；④ `design/ux/ux-spec.md` **v1.17**（设置面板行4 两钮、§4 矩阵 8 行、U14 丙案降遮罩、U15/U16 甲案；六批同步删 16/19 两档）；⑤ `ADR-0023`（风格插件化 + 双指标门禁 + 拦截即报，六批已把池数 6→4 全文回写、Q1/Q2 按「对象消失」结案）；⑥ `ADR-0024`（`RenderModelBuilder.polygon` 值拷贝改造，243 行）；⑦ 调研件 `design/proposals/bead-style-16-19-semantics.md`（275 行，含 `temp/beads-1619/probe.mjs` 实算，不入仓）。
- **核心决议摘要**：方案 A 全程序化矢量图元（禁纹理、禁位图，缩放无损）；十层卡退役、默认皮肤 = 复刻·四棱刻面+孔（实测 6 命令 / 0 真 α）；风格作用域 = 珠体 + 凹槽 + 托盘珠，B0 底图共享几何只随 inks 换色；满豆/小豆两档（满豆留孔、小豆不留孔 = 一种设计两套皮肤）；玩家设置实时切；双指标进池门禁 命令 ≤7 且 真 α ≤2；**C11 拦截即报**（触门必输出五项实测数值并请用户裁决，禁止静默放行与静默失败）；**C12 主体色不变式（L0 定理，七批采纳）**：珠体主体色必须 ≡ 本格 `base`，派生层可增删不得替换主体色（含 `L0`/`L1` 术语消歧；可机检，进开工序步 2）。
- **开工前置阻塞（三件，逐条解除后方可落码）**：
  1. **ADR-0024 未落地** ⇒ 四棱基线不得落码（`polygon` 现按引用存，共享 scratch 会串形且门禁全绿）；
  2. ~~16 / 19 挂「调研再定」~~ ⇒ **六批已裁：两套均不可用、直接移出风格池**（调研否证：16-b 撞档致异色珠全等、argmin 归位 8/10 错配；19 唯一可玩形态需 B0 同去色 ⇒ 破 S4 且对色觉障碍玩家是最坏档）。**净结果：池 = 4 套，玩家侧非色相通道只剩 18，A3① 明度欠账仍欠**；
  3. **α ≤ 2 无真机证据**：真机帧率从未测过（ADR-0022 DR-1），D1/D2 测量单 v1.0 全列 `[待填]` ⇒ 上限属纸面口径，跑完须回头复核。
- **门禁状态**：`check:links` OK（agents=7 / skills=39）；`check:tasks` 经本批补详情节闭合；`ctx:check` 的 C 项报 `memory/INDEX.md` 与索引不同源（非本批文件，pre-commit 自动重建处置）。
- **遗留待办（去向见 §12.8 表）**：art 纪律③「投影 α 不得为 0」适用面改写 · 逐风格凹槽层集 · `BEAD_DRAW_INSET` 小豆档定值 · 三角/顶点数并入 QA 埋点 · `pause-settings.md §2.2` S9 内容单源同步 · **C12 在 `assets-spec §1.9.7` 的引用行（art 下批）**。
