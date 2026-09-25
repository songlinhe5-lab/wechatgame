# ADR-0024 — RenderModel `polygon` 改值语义：框架内顶点 arena + 构建时拷贝（结构性消除「共享 scratch 串形」缺陷族）

- **状态**：**Accepted · 已落地（§7.2 步 1–3，WXG-T-211-A，2026-09-25，执笔同步核销）** —— DEC-1/2/3/4 与判据 **J-1 / J-2 / J-4 / J-5** 全部落码并绿（framework 330/330、beads 592/592、breakout 239/239）；§7.1 A/B/D/E/G 五组迁移面收清，两镜像经 `framework:sync` 重生成后 `framework:sync:check` + `cocos:check` 绿；零视觉自证门成立（十层盘 8 关 + FX 夹具 24 文件 / 936 枚 polygon **逐字节等值**，证据 `temp/wxg-t-211/03-svg-byte-diff.txt`）。⇒ **ADR-0023 §6.2 步 3（`facet-4` 转正）的开工门自此打开（DEC-6）。** 尚**未**落：§6-J3（多珠不串形几何判据，属 §7.2 步 4，与四棱转正同批）；§9 控制清单增补文案仍**不入库**（待主理人拍板）。
- **落码期对本文的两处加严细化（不改判，只把写不严的断言写实）**：① **J-4 的 `arenaReallocs`** —— 字面 `≤ 1` 在「懒扩容 + 翻倍从 0 起」下不可满足（满盘 24576 float 首帧需 ~8 次翻倍），且预分配一整帧会破「无 polygon 帧恒零分配」⇒ 断言改写为**「暖帧后增量 === 0」+「首帧翻倍 ≤ 12」**（严格不假绿，红法不变）；② **`builder.stats` 对象 → 三个标量只读 getter**（`vertexWrites` / `arenaCapacity` / `arenaReallocs`）—— 对象形态「读取即分配」，与本文自己的 §2 口径冲突。两者均采 §10-Q1 的 (a) 方向（计数常驻生产代码）。
- **原裁定文本**：本文只冻结「载荷形态、入口形态、兼容序、判据落位与代价」，**不含实现**；实现由主理人按 §7.2 迁移序分派（wxgame-epic-split 拆 Story）。
- **日期**：2026-09-25 · 执笔：程基岩（engineering-lead） · 任务号 **WXG-T-210**（承 §12.8-① 的 ADR-0024 挂名）
- **决策真源**：`games/beads/design/proposals/bead-visual-style-spec.md` **§12（v0.4 五批，2026-09-25）** —— 重点 **C2**、**C7**、**§12.8-①②⑫**。**已拍板议题（S1 路线 / S8 退役 / S9 分档 / §12.8-①「走框架接口改造、不走视图层缓冲池、不改 rect+line 近似」）本文一律不重开**，只做接口形态化与代价登记。
- **关联（只引用，不修改）**：ADR-0023（本文承接其 §4.2-4 的 (b) 分支，见 §8）、ADR-0014（`RenderModel.transform` 标量槽的同一套「热路径不 new 对象」手法，本文沿用）、ADR-0012（构建层语言契约，见 §4.2-9）、ADR-0005（程序化每帧重建）、ADR-0017（zoom LOD，`lodCutSet` 与本载荷无关）、控制清单 **L2/L5/§2/§8/§11/§15**。
- **实测证据**：`temp/beads-facet/styles.mjs::facetBead` + `tools/scripts/lib/render-model-svg.mjs`（gitignore 内，可引为试验证据、不可提交）。

---

## 0. 结论一句话

**`RenderModelBuilder.polygon()` 从「按引用存 points」改为「构建时把顶点拷进 builder 自持的顶点 arena，命令只存 `{offset, count}`，`RenderModel` 多一个 `vertices` 字段」**——共享 scratch 从「会串形」变成「不可能串形」，热路径增量分配从「每多边形 1 个数组」变成「每帧 1 块缓冲」。代价白纸黑字：这是**框架公开类型的破坏性变更**（`PolygonCommand.points` 消失，波及 2 个 adapter + 1 个离线工具 + 7 处测试读点 + 两份镜像）、`RenderModel` 不再是「命令自包含」的结构、以及 **四棱基线在本文落地并全绿之前不得落码**。

---

## 1. 上下文（Context）

### 1.1 为什么现在必须定

新默认皮肤「复刻·四棱刻面」把 `polygon` 从**低频特效图元**变成**主力逐珠图元**（4 枚/珠）。今天接口是 `this._commands.push({ kind:'polygon', points, ...cmd })`（按引用），于是只有两条路，且**都会咬人**：

- 逐颗新建顶点数组 ⇒ 满盘 1024 格 × 4 = **4096 个小数组/帧**，正面违反控制清单 §2；
- 复用一块 scratch ⇒ 全盘多边形渲染成**最后一颗珠的形状**：**条数不变 ⇒ ADR-0023 双指标门禁全绿**、harness 截图对拍也只在画错的那一侧自洽、类型系统一声不响。

第二种是**值型缺陷**（数据错位，不抛错、不减帧），恰是本仓判例族里最贵的那一类（C1「点击上下镜像」、G10「8 关全卡 boot」同族：**症状与原因不同层，第一现场必然误判**）。用户 2026-09-25 五批裁定（§12.8-①）：**修接口，不在视图层绕**。

### 1.2 仓库事实（读码所得，非推测）

| # | 事实 | 位置 |
|---|---|---|
| F-1 | `polygon(points, cmd)` **按引用** push；`PolygonCommand.points: readonly number[] \| Float32Array` 是 `[v1.4·WXG-T-128 裁定 B]` 放宽来的，注释明文要求「传 scratch 视图时该段在下一帧前不得改写」 | `packages/framework/src/core/render/render-model.ts:68-83, 197-199` |
| F-2 | 两个适配器都在 `render()` 内**同步索引遍历**消费（`pts.length` / `pts[i]`），退化门写的是 `pts.length < 4` | `adapters/cocos/cocos-renderer.ts:185-192`、`adapters/canvas2d/canvas2d-renderer.ts:153-161` |
| F-3 | **既有共享 arena 判例**：G6 彩带 `CONFETTI_POINTS = new Float32Array(44*8)`，每枚固定占 8-float 段、`subarray` 视图入命令 ⇒ 「调用方自持 arena + 分段」这条路今天就在跑，且是裁定 B 的产物 | `games/beads/src/view/view-model.ts:1331, 1354`；`scene-vfx.ts:255-268` |
| F-4 | **同一判例的反面**：G3 扫光的 `sweepQuad(i, cx, [0,0,0,0,0,0,0,0])` **逐层新建**，注释明写「`polygon()` 按引用存 ⇒ 不能跨帧共用 scratch」；`scene-vfx.ts:104-105` 重复同一条警告 | `view-model.ts:1311-1314`、`scene-vfx.ts:100-106` |
| F-5 | 四棱的 4 枚 polygon 每枚是 **三角形（3 顶点 = 6 float）**，且**第三点恒为该珠格心 `(cx,cy)`** ⇒ 「每枚多边形的顶点集含格心」是串形的直接杀手判据；同文件另有多处三字面量三角形（角标 ▶、展开钮 ▶） | `temp/beads-facet/styles.mjs::facetBead`（`tri()`）、`view-model.ts:1098-1099, 1108-1109` |
| F-6 | 盘面格数上限 `GRID_MAX_COLS = GRID_MAX_ROWS = 32` ⇒ 1024 格 | `games/beads/src/config/tuning.ts:198-200` |
| F-7 | builder **今天就逐命令 new 一个对象字面量**（`rect/circle/line/text` 全是 `push({...})`），`end()` 另做一次数组拷贝 ⇒ 「热路径零分配」在 builder 内部**从来不是字面零**（本文不解决这条，登记 §4.3-1） | `render-model.ts:176-199, 216` |
| F-8 | `RenderModelBuilder` 契约注释：每帧只应有一个活模型，renderer 要留的东西自己拷 | `render-model.ts:120-127` |
| F-9 | `RenderModelBuilder` 既有单测里有一条 **「returns a snapshot independent of later mutations」**（当前只验 circle 标量）⇒ 载荷改 arena 后这条**自动升级成 discriminating 判据**（见 J-2） | `packages/framework/tests/core/render-model.test.ts:68-77` |
| F-10 | `core/index.ts:22` 用 `export *` 全量导出 ⇒ `PolygonCommand` 是**公开类型**，不是内部实现 | `packages/framework/src/core/index.ts` |
| F-11 | `bindings.ts` **不碰** polygon/points（只 `new CocosRenderModelRenderer`）⇒ Cocos 侧唯一连带是 `cocos-renderer.ts` | `adapters/cocos/bindings.ts:38, 204` |
| F-12 | 镜像：`games/{beads,breakout}/cocos/assets/scripts/framework/**` 由 `framework:sync` 物理拷贝、`framework:sync:check` 只验一致（**只拦不写**）；`verify` 链含 `framework:sync:check → cocos:check → check:size → test → harness:build → harness:smoke` | `tools/scripts/sync-framework-to-cocos.mjs`、`verify-all.mjs:52-75` |

### 1.3 约束（引用，不重开）

**L2**（`core/**` 禁 `cc`/DOM/`wx`/`window`/`document` ⇒ arena 只能用 ECMAScript 原生 TypedArray）、**L5**（`buildRenderModel` 只读）、**§2** 热路径零分配、**§8** 五原语与坐标系口径不变、**§15/ADR-0012**（禁非数组展开：`[...points]` 在守卫下**必红**，`Float32Array` 属不可证明为数组）、**§11** 新增 `core/` 模块须有 framework 单测。**systems-index §3 不动**（本文纯呈现层机制）。

---

## 2. 备选方案（Alternatives）

### 2.1 甲｜框架内顶点 arena + 构建时值拷贝 —— **选定**

builder 自持一块 `_verts` 顶点缓冲，`begin()` 只复位游标不重分配；`polygon()` 在**入列那一刻**把顶点逐索引拷进 arena，命令只存 `{offset, count}`；`end()` 把已用段交进模型（`RenderModel.vertices`）。串形从「纪律问题」变成「类型上写不出来」：调用方想共享就共享，反正框架当场拷走。旧签名 `polygon(points, cmd)` **原样保留**（含 F-3 的 `subarray` 传法），语义由「按引用」变「值拷贝」= 只变强。热路径逐珠再给一个**标量入口**（`polygon3`，见 §3 DEC-3）省掉 scratch 中转。

### 2.2 乙｜视图层预分配缓冲池（容量 = 最坏盘面多边形数，`begin()` 复位游标）—— **用户已否（§12.8-①），本文如实登记其真实代价**

即 ADR-0023 §4.2-4 选的 (a)。**它技术上完全可行且最便宜**：F-3 证明同款模式（44×8 float 定长 arena + 分段）在本仓已上线，零框架改动、零契约变更、零镜像/测试迁移；每帧 4096 枚只需 `new Float32Array(4096*6)` = 98KB **一次**预分配。**它被否的理由不是性能，是「易错纪律常驻面」**：① 分段游标 bookkeeping 要活在**每个风格模块**里（C1 契约希望 `drawFilled(...)` 只算几何），风格越加越多 ⇒ 漏一段/重叠一段的后果就是 §1.1 那种静默串形；② 它把「按引用」这条契约继续留给未来所有调用方（breakout、下一款游戏、下一个特效），**坑没填，只是本处绕开**；③ 池容量 = 盘面 × 每珠枚数 × 顶点数是**跨域耦合**（美术改层数 ⇒ 视图池常量跟着改，而 ADR-0023 C7 双指标已在管层数），三件可变的事互相之间多一条隐式契约。**本文按裁定不采**，但明写：否决买到的是**鲁棒性**，付出的是**框架变更风险**（§4.2 全部账单）。

### 2.3 丙｜现接口不动 + 强制值拷贝（`points.slice()` 入命令）—— 最小正确修复，但分配只是搬家

一行改动即可消除整类串形，旧调用点零破坏、`cmd.points` 读点零迁移。**代价**：每帧仍是 **4096 个小对象**（每个约 70–120 B 量级 ⇒ 粗估 300–400 KB/帧短命垃圾），只是分配点从玩法搬到框架，§2 的违规原样保留；而且框架成为「违 §2 的替罪羊」，将来查 GC 抖动第一现场会误判玩法。**结论：可作紧急止血（线上真出现串形时），不作本批方案**——它不满足用户拍板里的「定点参数重载」诉求。

### 2.4 丁｜只加标量重载 `polygon3/polygon4`，旧 `points` 载荷原样保留 —— 少做半件事

命令内联标量确实零额外分配（和 `rect` 一样只有一个对象字面量），但它①**不修**旧签名那条按引用路径（坑仍在，只是四棱不用它）；②必须新增 kind 或新增命令形状 ⇒ **`kind === 'polygon'` 判据口径分裂**：`scene-vfx.test.ts:64` 计数、`bead-render.test.ts:132`「不得出现 polygon」、ADR-0023 M-5 的白名单改写、C7 双指标计数、`render-model-svg.mjs` 渲染分支**全都要同时认两种**，四枚顶点的 `polygon4` 与十顶点星形还得并存第三形态。**结论：本末倒置——为省一个字段付出判据体系分叉。**

### 2.5 戊｜四棱改用 rect+line 近似（根本不引入 polygon）—— **用户已否（§12.8-①）**

顺带登记：它会把 §12.6 基线「6 命令 / 0 α」的口径推翻（rect+line 逼近刻面必然增条数或丢明暗方向），ADR-0023 DEC-5/DEC-6 的**基线对照值 6/0** 与 C11 第⑤项差值表随之全部重记 ⇒ 代价是既成门禁体系，不采。

### 2.6 对比

| 维度 | 甲 arena+值拷贝 | 乙 视图层池 | 丙 `slice()` | 丁 仅标量重载 | 戊 rect+line |
|---|---|---|---|---|---|
| 串形是否**结构性消除** | ✅ 全局 | ❌ 只保 beads | ✅ 全局 | ❌ 旧路径仍可错 | ⚠ 绕开 |
| 每帧增量分配 | 1 块缓冲（+0 对象/命令） | 1 块缓冲 | **+4096 小数组** | +0（仅新入口） | +0 |
| 旧调用点（14 处）改动 | 0（语义变强） | 部分迁移到池 | 0 | 0 | — |
| `cmd.points` 读点（7 处）改动 | **7 处 + 1 工具** | 0 | 0 | 0 | 0 |
| `kind` 口径 | **单一** | 单一 | 单一 | **分裂（2–3 形态）** | 无 polygon |
| 框架契约面 | **动 §8 载荷** | 不动 | 不动 | 动 | 不动 |
| 任意顶点数（星形 10 点） | ✅ | ✅ | ✅ | ❌ 需并存旧路径 | — |
| 用户拍板一致性 | ✅ ① | ❌ 已否 | ✅ ③（量级不达标） | 部分 | ❌ 已否 |

---

## 3. 决定（Decision）

**DEC-1｜载荷 = 顶点 arena + 定位子。** `PolygonCommand` 改为 `{ kind:'polygon', offset: number, count: number, fill?, stroke?, lineWidth?, alpha? }`（`count` = **顶点数**，非 float 数）；`RenderModel` 新增 `readonly vertices: Float64Array`。**`points` 字段取消。**
- **选 Float64 不选 Float32**（诚实理由 = 精度零回归，不是性能）：今天 14 个调用点里 12 个传 `number[]`（Float64 语义，含 `starPoints` 的小数与 `withAlpha` 派生坐标），只有 F-3 彩带传 Float32。塞进 Float32 arena 会让**既有 SVG 差分层**（§11.2 基线 1587 的来源工具 `render-model-svg.mjs`）与所有等值坐标断言出现末位漂移 ⇒ 被迫给一批判据引入 ε，而 ε 一进门就是「假绿温床」（K-042 谱系）。Float32→Float64 是无损方向。代价（容量翻倍）见 §4.2-2。
- 无 polygon 的帧（breakout 全部帧、beads 大多数 UI 帧）共享一个模块级 `EMPTY_VERTS`（长度 0 的常量）⇒ **恒零分配**，不新增缓冲。

**DEC-2｜arena 生命周期。** `_verts` 懒扩容（翻倍到「历史水位线」后不再长）；`begin()` 只把游标归零、**不清数据不重分配**；`end()` 交出 `_verts.slice(0, cursor)` 的独立拷贝。
- ⚠ 这里是本文唯一一处**明知更贵仍选保守**的取舍：交出 `subarray` 视图可再省掉每帧一次 memcpy，但那会让 F-9 那条「快照独立」契约**由真变假**，并把 §1.1 的错位缺陷从「per-command 粒度」换成「per-frame 粒度」继续留着（QA 两路径对拍、跨帧差分脚本正是跨帧持有模型的场景）。选拷贝 ⇒ 模型继续自包含。双缓冲退路见 §5-R1。

**DEC-3｜入口 = 旧签名保留 + 一个标量入口。**
- `polygon(points, cmd)`：**签名与类型不动**，实现改为逐索引拷进 arena。**禁用展开**（`[...points]` 被 ADR-0012 守卫 fail-closed 判红，`Float32Array` 属「不可证明为数组」；`Array.from` 也不取，直接索引循环）。F-3 彩带 `subarray` 传法继续有效。
- `polygon3(x0,y0,x1,y1,x2,y2, cmd)`：热路径逐珠主力（F-5 证实四棱是三角形，另可收编 4 处现有三字面量调用）。
- **`polygon4` 暂不加（YAGNI）**：sweep/confetti 走旧签名即已零分配（拷贝进 arena），加第四个入口只是多一条待测路径。若将来出现「每帧大批量四边形」再按 §5-R2 复评。
- **不保留 `points` 兼容 getter**：getter 每次读都要现造一个视图对象，adapter 的渲染循环会因此逐命令分配 ⇒ 等于偷偷把 §2.3 的代价塞回生产路径。要么改完，要么不做。

**DEC-4｜退化多边形语义留在 adapter。** builder 不静默丢弃 `count < 3`（否则 C7 双指标与 §11.2 差分层**少计一条**，口径漂移无人看见）。既有两条「skips degenerate polygons」测试（`cocos-renderer.test.ts:188-192`、`canvas2d-renderer.test.ts:101-106`）必须**继续绿且红法不变**。⚠ 顺带登记现存三处口径不一致：adapter 用 `length < 4`、SVG 工具用 `length < 6`、几何上「多边形」应 ≥3 顶点（=6 float）⇒ 本文不统一它们（改判据要守 §11.3「同强度或更强」，另单处理），只要求**迁移前后各判据行为逐字不变**。

**DEC-5｜判据四件套落位见 §6**（含要求的「质心==格心」与零分配回归判据）。

**DEC-6｜与 ADR-0023 的先后序（详见 §8）**：ADR-0023 §6.2 步 1（`bead-styles/contract.ts` + `registry.ts` + 把十层原样封成 `legacy-ten`）**不依赖本文**，可先行；**步 3（四棱转正）硬依赖本文落地并全绿**。⇒ **四棱基线（含 `facet-4.ts`、12 条新层序判据以四棱为基线的那次重立、C7 基线值 6/0 的回填）在本文落地前不得开工。**

**DEC-7｜本 ADR 不授权代码变更**，也不修改任何既有 ADR（含 ADR-0023；需它回写的条目列在 §8.2）。

---

## 4. 后果（Consequences）

### 4.1 正面

1. **整类静默缺陷关门**：任何调用方、任何未来游戏共享 scratch 都不会再串形；`§12.8-①` 点名的「条数不变、内容错位、门禁全绿」这一族从此**写不出来**。
2. 热路径增量分配：4096 个小对象/帧 → **1 块缓冲/帧**（对象数 −3 个数量级；字节数只约 −2×，但短命小对象才是分代回收与暂停的主因）。
3. F-4 那两处「必须每次新建数组」的注释与随之而来的逐层 `new` **失去存在理由** ⇒ 彩带/扫光可回收为复用一块 scratch（净收益，非必需项）。
4. 视图层零池、零游标：**C1 风格契约保持干净**（`drawFilled` 只算几何，不管缓冲分段），ADR-0023 DEC-3 的注入式契约不被 bookkeeping 污染。
5. 旧签名 14 个调用点**一行不改**即获得安全语义；F-9 那条既有单测从「只验标量」升格为真正有判别力的契约锁。
6. `RenderModel` 仍然自包含（DEC-2 拷贝路线）⇒ harness 对拍、SVG 差分层、跨帧比较脚本继续按现有假设工作。

### 4.2 负面（**已知成本，不是风险**——白纸黑字）

1. **框架公开类型破坏性变更**：`PolygonCommand.points` 消失（F-10 全量导出 ⇒ 游戏侧可 import）。连带面 = 2 个 adapter（`cocos-renderer.ts:186`、`canvas2d-renderer.ts:154`）+ 1 个离线工具（`tools/scripts/lib/render-model-svg.mjs:76`，**它是 §11.2 图元基线与 spike 出图的口径来源**）+ 7 处测试读点（§7.1 E 组）。**好在全部是编译期/运行期可发现的红，不是静默**——这条与 §1.1 的缺陷族性质相反，是本单花钱买的东西。
2. **每帧一次 memcpy**：满盘 32×32 × 4 枚 × 3 顶点 × 2 float = 24576 float ⇒ **Float64 ≈ 196 KB/帧**（典型夹具 13×12 = 624 枚 ⇒ ≈ 30 KB/帧）。⚠ 这是**按 F-5/F-6 字面算的量级估算，未实测**；落码必须用 §6-J4 计数 + `pnpm run preview:clip:beads` 复核，若真机证明是负担走 §5-R1（双缓冲）复评。**注意别把「字节数」当唯一指标**：本文把 4096 个短命对象换成 1 个长寿缓冲，换来的是对象图与 GC 压力，不是分配字节数。
3. **`RenderModel` 语义变复杂**：五原语从「每条命令自带数据」变成「polygon 需外部顶点表」。`check-architecture.mjs`、L2、§8 坐标系契约都不受影响，但**新 renderer（若有一天 WebGL/烘图路径）必须懂 arena 索引**——这条认知成本是本文新增的，不给它打折。
4. **`Float32Array` 与 `number[]` 的适配层差异并未消失，只是被吸收进 builder**：入参仍两种形态（索引读同形、`.length` 同形 ⇒ 拷贝循环通吃），但出参从此**只有 `Float64Array`**。凡在测试/工具里对 `points` 做过 `Array.from(...)`（`view-model.test.ts:51,174`）、下标读（`confetti.test.ts:103-134`）的地方，迁移后拿到的是 Float64 视图 ⇒ 链式 `.filter/.map` 的返回类型从 typed array 变 array 或反之 ⇒ **迁移是逐处看类型，不是全局替换**。诚实说：这是本单最容易「改绿了但改成了另一种东西」的地方。
5. **精度混用从此单向**：彩带（Float32）经 arena 变 Float64 = 无损；但若将来有人为了省容量把 arena 换回 Float32（§5-R1 的一条实现路线），**所有走旧签名的 `number[]` 小数顶点会被舍入**，差分层与判据可能同时漂 ⇒ 换容量必须走本文 §5 复评，不许就地改类型。
6. **镜像与产物的固定开销**：`framework:sync:check` 只验一致、**只拦不写**（控制清单 §15）⇒ 改完 framework 必须手工 `pnpm run framework:sync`，两份镜像（beads + breakout）与 `dev/harness/dist` 各自跟着变；`cocos:check`、`check:size`、`harness:smoke` 同批重跑。**刻意不新增 framework 源文件**（只改 `render-model.ts` + 2 个 adapter）以免触发「新 `.meta` 须编辑器生成」的 L1 工作流——本文落地时**不要**把 arena 拆成 `render-model-arena.ts` 之类新文件，除非用户明确接受一次编辑器导入步骤。
7. **`bindings.ts` 无需连带改动**（F-11 实测无 polygon/points 引用）；**L2 不受威胁**（`Float64Array` 是 ECMAScript 原生，非 `cc`/DOM/`wx`）。诚实登记：这条「不用改」是本文核过代码得到的，不是假设——若后续把退化门从 adapter 上移到 builder（DEC-4 的反向选择），`bindings` 依旧不动，但两条 skip 测试必须搬家。
8. **阻塞成本**：本文落地前 **四棱基线不得落码** ⇒ ADR-0023 §6.2 步 3–7 全部顺延；期间只有步 1–2（契约 + 门禁 + `legacy-ten`）可推进。也就是说**换肤这件事的关键路径上多了一个框架工程单**，这是用户 §12.8-① 选择「修接口」必然付的账，不重新议价。
9. **ADR-0012 的隐性约束**：拷贝实现只能用索引循环（§15 展开守卫对 `Float32Array`/`number[]` 联合类型 **fail-closed 判红**）；而 `end()` 里既有的 `[...this._commands]` 属「真数组展开」，ADR-0012 明文**安全且不要顺手清理**。
10. **为可数化「零分配」而引入的生产代码计数**（J-4 的 `builder.stats` 三个标量）属「为测试而生的常驻代码」，本文选择接受它（成本 = 每命令几次标量自增），并把「不许为此开环境变量分支」写进约束——一旦允许 `if (PROBE)` 分叉，热路径就成了「测的不是跑的那条」。

### 4.3 中性 / 待观察

1. **builder 今天逐命令 new 一个对象字面量 + `end()` 一次数组拷贝**（F-7）⇒「热路径零分配」在框架内部从来不是字面零。命令对象池化是更大的杠杆，但它会破坏 F-9 的快照独立契约与 §8 冻结语义 ⇒ **另立 ADR**，本文不动。
2. 四棱基线值（6 命令 / 0 α）**不因本文改变**——本文改的是载荷形态，不是条数口径。
3. `polygon3` 是否收编既有 4 处三字面量调用（§7.1 C 组）= 落码期口味，收与不收都不改判据；不强制。
4. 单枚三角形「顶点算术平均 ≠ 格心」（F-5：顶点是两外角点 + 格心）⇒ §6-J3 的定义必须按「同珠 4 枚并集」或「含格心」来写，属**判据写法**问题，不是本文遗留缺陷。

---

## 5. 复评触发条件（Review Triggers）

- **R1**：真机（低端、32×32 满盘四棱）测出 `end()` 拷贝成本敏感 ⇒ 复评「双缓冲 / 三段轮转 arena」（可零拷贝，但要把 F-9 快照契约改写成「模型有效期 = N 帧」并同步改文档与判据）。同一条触发也覆盖「为省容量把 arena 换回 Float32」的提案（§4.2-5）。
- **R2**：出现新的**大批量逐帧多边形**消费者（排线族、粒子多边形、>4 顶点热路径图元）⇒ 复评是否需要 `polygon4` / 通用 `polygonN(buf, off, count, cmd)` 入口。
- **R3**：新增第三 renderer（WebGL / RenderTexture 烘图，ADR-0005 §5 或 ADR-0022 丙案）⇒ 顶点载荷格式（locator vs array）复评；烘图路径可能反而偏好连续 typed array，本文的 arena 对此是**加分项**，但契约要重写。
- **R4**：`RenderModel` 要跨帧持有（录像、回放、逐帧差分产品化）⇒ DEC-2 的「每帧交出拷贝」必须复评（拷贝正是为这个场景买的）。
- **R5**：第三/四款游戏开始直接读 polygon 载荷 ⇒ §4.2-1 破坏性变更影响面复评（届时应考虑是否恢复一个**离线专用**视图 helper 的公开位置）。
- **R6**：ADR-0022 的 D1/D2 真机数据跑完（ADR-0023 §5-R1 同一门）⇒ 双指标上限与本文 arena 水位线**一起**回头复核，勿两条 ADR 各自复评打架。
- **R7**：若有人以「本文太重、先止血」为由提丙案（`slice()`）⇒ 允许作为**线上串形的紧急止血**单独评审，但必须同时登记「§2 违规原样保留」，不得当终态。

---

## 6. 判据与门禁落位（DEC-5 的展开；**要求「不串形」与「零分配」两类都必须可机检**）

| # | 判据 | 层位（跑在哪） | 内容与红法 |
|---|---|---|---|
| **J-1** | **值语义（不共享引用）** | `packages/framework/tests/core/render-model.test.ts` | 同一 builder 连续 push N 枚 polygon，**故意复用同一个 `number[]` scratch 与同一个 `Float32Array` 各一轮**（正是今天最危险的写法），每次 push 前把入参抄进期望表；`end()` 后逐命令用 `Array.from(polygonVertices(model, cmd))` 与期望**逐值等值**。⇒ 实现退回按引用即全红（读到最后一枚）。**这是本 ADR 的主锚判据。** |
| **J-2** | **快照独立（否证零拷贝视图实现）** | 同上，扩既有 F-9 那条 | `first = end()` → `begin()` → push 不同顶点 → `end()`；断言 `first` 的多边形顶点**仍是旧值**。DEC-2 选「交出拷贝」正是为了让这条**必须绿**；若改零拷贝视图，此条必红 ⇒ 门自动拒绝该实现。 |
| **J-3** | **多珠多边形不串形（几何）** | `games/beads/tests/`（新建 `bead-polygon-geometry.test.ts` 或并入 `bead-render.test.ts`，四棱转正同批） | 满夹具（≥ 2 盘：多色多格）逐珠取 polygon 命令，按**格 bbox 聚类**（A5 零重叠前提保证邻格可分；**不得为聚类扩命令字段**——框架不认玩法语义）：① **每枚 polygon 的顶点集含该珠格心**（F-5 结构事实，串形时格心会重复/缺席 ⇒ 直接红）；② **同珠 4 枚顶点的并集质心 == 格心（±1e-6）**，即任务单要求的「质心==格心」的正确写法；⚠ **禁止**写成「单枚多边形顶点均值 == 格心」（四棱是三角形，均值本就不等于格心，照字面写第一天就红或被改成恒真）；③ 逐珠 4 枚**计数**恒等。几何量一律 `import` 真源（`gridLayoutFor`/`BEAD_CELL`），**不许在测试里重推公式**（K-042）。 |
| **J-4** | **零分配回归（可数化）** | framework 单测 + `pnpm run test`（常门） | `RenderModelBuilder` 暴露**三个只读标量 getter**（`vertexWrites` / `arenaCapacity` / `arenaReallocs`，标量自增、无开关分叉；原写的「`stats` 对象」已于落码时否证——**读取即分配**，与本文 §2 口径冲突，采 §10-Q1 (a) 方向）：跑 200 帧满盘形状 ⇒ 断言 ① **暖帧后 `arenaReallocs` 增量 === 0**（**证明 arena 复用**）**且首帧翻倍次数 ≤ 12** ——〔**字面同步（2026-09-26，WXG-T-211-G，用户追认）**：原字面 `arenaReallocs ≤ 1` 在「懒扩容 + 翻倍从 0 起」下**不可满足**（满盘 24576 float 首帧需 ~8 次翻倍），而预分配一整帧又会破「无 polygon 帧恒零分配」⇒ 改述为上述双断言，**严格不假绿、红法不变**；与本件文首「落码期两处加严细化」① 同一段〕② `vertexWrites == Σ count×2`（口径锚）③ 无 polygon 帧 `vertices.length === 0` 且与上一帧同一引用（`EMPTY_VERTS`）。⚠ 不用 RSS/`heapUsed` 做常门判据（GC 噪声 ⇒ 假红/假绿双向）；堆增长有界测试只走 `selftest:heavy` 档作旁证。 |
| **J-5** | **退化与条数口径不变** | framework adapters 测试（既有 2 条）+ beads 差分 | `cocos-renderer.test.ts:188` / `canvas2d-renderer.test.ts:101` 的 skip 行为逐字保持；`tools/scripts/lib/render-model-svg.mjs` 迁移后**重跑一次十层盘**，SVG 输出与迁移前逐字节 diff = 空（证明载荷改造零视觉漂移）；再跑四棱盘出 §11.2 体例差分（ADR-0023 C7 那份）。 |
| — | `framework:sync:check`（漂移门）的**角色边界** | `pnpm run framework:sync:check` | 它只保证两份镜像逐字节等于源，**不证行为**；不得拿它的绿替 J-1/J-3 交差（控制清单 §15 口径）。 |

**「拦截即报」沿用 ADR-0023 DEC-6**：J-3/J-4 任一失败时输出必须带**实测值**（串形珠的 index/格心/读回顶点，或 `arenaReallocs` 实际数），只给退出码视为门禁未实现。**变异自证**：每条新判据须先注入反例（改回按引用 / 改零拷贝视图 / 把质心断言换成均值）确认可红再绿——K-060 判例（存在性断言无判别力，判别力必须落在差值/终值上）。

---

## 7. 兼容面与迁移序

### 7.1 全仓 `polygon` 调用/消费点清单（本文 grep 实测，**排除 `node_modules` / `dist` / 镜像拷贝件**）

| 组 | 位置 | 形态 | 本文影响 |
|---|---|---|---|
| **A 定义/契约** | `packages/framework/src/core/render/render-model.ts:68-83`（`PolygonCommand`）、`:197-199`（`polygon()`）、`:216`（`end()`）、`core/index.ts:22`（`export *`） | — | **改**（DEC-1/2/3） |
| **B 生产者·beads** | `games/beads/src/view/view-model.ts:1098, 1108, 1208, 1314, 1354, 1427, 1522, 1582, 1584, 1605, 1610, 1626`（**12 个调用点**；含 `starPoints()` 10 顶点 ×3、角标/展开钮三字面量三角形 ×2、`CONFETTI_POINTS.subarray` ×1、`sweepQuad` ×1 —— 后两处在循环内，逐帧实际分派 ≤44 枚 / 3 枚） | 传 points | **零改动**（语义变强）；`1311`、`1354` 两处注释与 `scene-vfx.ts:104-105, 255-260` 的「不得跨帧共用」警告**变为错误，必改**（§4.1-3） |
| **C 生产者·breakout** | `games/breakout/src/view/view-model.ts:109, 368`（2 处，字面量三角形，每帧 ≤2 枚） | 传 points | **零改动**（每帧多 2×6 float 拷贝，可忽略） |
| **D 消费者·adapter** | `adapters/cocos/cocos-renderer.ts:185-192`、`adapters/canvas2d/canvas2d-renderer.ts:153-161` | 读 `cmd.points` | **改**：`const v = model.vertices; for (i = offset; ...)`；skip 行为不变（DEC-4） |
| **E 测试读载荷** | framework：`tests/core/render-model.test.ts:20, 86`（仅入参，不读回）；`tests/adapters/cocos-renderer.test.ts:181,192,243`、`tests/adapters/canvas2d-renderer.test.ts:105,106`（经 renderer 间接消费，**入参形态不变 ⇒ 无需改**）。beads：`tests/confetti.test.ts:103, 109-112, 134`、`tests/view-model.test.ts:51, 174` | 读 `cmd.points` | **7 处必改**（helper 化） |
| **F 测试读 kind/计数** | beads `tests/scene-vfx.test.ts:64, 146`、`tests/bead-render.test.ts:132`（「不得出现 polygon」）、`tests/view-model.test.ts:221`；breakout `tests/view-model.test.ts:189` | 只读 `kind` | **零改动**（kind 单一，DEC-1 不分裂 ⇒ 这正是压掉丁案的理由）。`bead-render.test.ts:132` 的改写属 ADR-0023 M-5，不属本单 |
| **G 离线工具** | `tools/scripts/lib/render-model-svg.mjs:76`（`pts.length < 6` 守卫 + 顶点串拼接） | 读 `cmd.points` | **必改**；改后按 J-5 做逐字节 diff 自证 |
| **H 镜像与产物** | `games/beads/cocos/assets/scripts/framework/**`、`games/breakout/cocos/assets/scripts/framework/**`、`dev/harness/dist/**` | 拷贝件 | **由 `framework:sync` / `harness:build` 重生成，禁手改**（§15） |
| **I 试验脚本** | `temp/beads-facet/{styles,lowcost,ab}.mjs`（经 G 出图） | 传 points | 零改动；重跑一次出 §12.6 对照即自证未漂 |

**结论**：旧**签名**全保留 ⇒ B/C/I 三组共 14 个生产调用点**零破坏**；破坏集中在「**读载荷**」的 3 处（D）+ 7 处（E）+ 1 处（G）。缓解：framework 提供导出 helper `polygonVertices(model: RenderModel, cmd: PolygonCommand): Float64Array`（返回 arena 切片的 `subarray` 视图，**仅供测试与离线工具**，注释明文「生产热路径勿调，每命令分配一个视图」），迁移即「把 `cmd.points[k]` 换成 `const p = polygonVertices(model, cmd); p[k]`」。

### 7.2 建议迁移序（供 wxgame-epic-split 拆 Story；本文不写验收正文）

1. **framework 单测先行**（只加 J-1/J-2/J-4 的**期望**，此步必红 ⇒ 红基线登记）；
2. 实现 DEC-1/2/3（仅 `render-model.ts`，不新增文件）+ 2 个 adapter + `render-model-svg.mjs` + helper ⇒ J-1/J-2/J-4 转绿、E 组 7 处迁移；
3. **零视觉变更自证**：`framework:sync` → `cocos:check` → 十层盘 SVG 逐字节 diff（J-5）→ `pnpm run verify` 全绿 → `harness:smoke`；
4. beads 侧 J-3（十层盘上先建立「含格心/并集质心」判据的形式，此时只对既有 polygon 生效）；
5. **此后** ADR-0023 §6.2 步 3（`facet-4` 转正）才具备开工门（DEC-6）。

---

## 8. 与 ADR-0023 / §12 的关系

### 8.1 依赖图（**先后序，不是重开**）

- ADR-0023 **DEC-3（风格插件契约）的骨架**（`contract.ts` + `registry.ts` + `legacy-ten` 封装）**不依赖本文**；其 **DEC-3 的图元型实现（`facet-4.ts`）与 DEC-4（十层退役、四棱转正为默认）硬依赖本文**。
- ADR-0023 **DEC-5 基线值 6/0 的回填**（C7 门禁常量）依赖四棱落码 ⇒ 间接依赖本文。
- §12 C2 的验收口径「**ADR-0024 绿** + framework 全量单测与 `framework:sync:check` 通过 + 新增『多珠多边形不串形』几何判据」由本文 §6 逐条兑现（J-1/J-2/J-3/J-4）。

### 8.2 需由 ADR-0023 下一次修订（或主理人回写）承接的条目 —— **本文不改它，只登记**

| ADR-0023 位置 | 现状文字 | 冲突/去向 |
|---|---|---|
| §4.2-4 | 「本文选 **(a) 预分配小缓冲池** 为默认，(b) 框架层变更列为 §5-R5 触发项」 | **已被 §12.8-① 用户裁定推翻**（采 (b) 方向）⇒ 该段需标注「由 ADR-0024 承接，(a) 不采」 |
| §5-R5 | 触发项 = 「缓冲池不够用时才做框架 arena」 | 触发提前发生（用户直接拍框架改造）⇒ 记 Superseded-by-0024 |
| §6.2 步 3 | 「`facet-4` + 多边形缓冲池（§4.2-4 (a) 解法）」 | 改指「+ ADR-0024 落地」 |
| §10 反模式表第 1 行 | 「共用 scratch ⇒ 用小缓冲池 + 质心判据」 | 正解变为「小缓冲池**与**共用 scratch 都不再必要；接口已是值语义」；反模式改述为「在判据里用存在性断言锁串形」（§6 变异纪律） |
| §11-Q4 | C5「两枚 circle」vs §12.6 计数 | 与本文无关（§12.8-③ 已裁「一枚」），不重开 |

其余关联文件待回写（同 ADR-0023 §9-5 口径，本文不代改）：`docs/architecture/architecture.md` 关联决策行仍停在 0017；`control-manifest.md §8/§15`（建议增补文案见 §9）。

---

## 9. 控制清单增补建议文案（**不入库**，交主理人拍板后由工程单落表）

```markdown
# 建议 §8（渲染）追加两条：
- ✅ `polygon` 顶点由 RenderModelBuilder 的顶点 arena 承载（命令只存 {offset,count}，模型带 vertices）
  ⇒ 调用方可自由复用 scratch，值语义在建令时即完成；勿再依赖「该段下一帧前不得改写」式纪律。（ADR-0024 DEC-1/2/3）
- ✅ 每帧无 polygon 时 vertices 恒为共享空表 ⇒ 恒零分配；`end()` 交出定长拷贝以保「模型自包含」，
  改零拷贝视图须先过 render-model 的「快照独立」判据。（ADR-0024 DEC-2 / §6-J2）
# 建议 §13（反模式表）追加两行：
| 为多边形共用 scratch 而「每颗新建数组」或「视图层池 + 游标分段」 | 接口已是值语义，直接复用一块 scratch（ADR-0024） |
| 用「存在 polygon」这类存在性断言锁串形 | 锁差值：含格心 / 同珠并集质心==格心 / 入参-读回逐值等值 + 变异自证（ADR-0024 §6、K-060） |
```

---

## 10. 未决问题（交主理人 → 用户；均属 §12 未覆盖的工程歧义，不重开已拍板议题）

- **Q1｜J-4 计数要不要常驻生产代码**：(a) `builder.stats` 三标量常驻（**本文建议**，成本 = 几次自增，换来「零分配」第一次可数）；(b) 不常驻，改只在 `selftest:heavy` 档跑堆增长有界测试（假绿风险高、噪声大）；(c) 两者都做。(b) 的实质是把 §2 继续留在「靠人 grep `new `」的自查层。
- **Q2｜`polygon3` 是否同批收编既有三字面量调用**（B/C 组 6 处）：(a) 只做四棱新路径（**本文建议**，改动面最小、diff 最干净）；(b) 顺手全收（可读性↑，但让「零视觉变更自证」那一步的 diff 变大，一旦 SVG 不逐字节等值就难归因）。
- **Q3｜四棱基线开工门的形式**：(a) 以「本文 §7.2 步 3 的 `verify` 全绿 + SVG 十层盘逐字节等值」为唯一门（**本文建议**，可机检）；(b) 再加一次人工三档缩放目视（0.75×/1.5×/3×，沿用 §12 C10 口径）⇒ 多一道人工但抓不住新串形。
- **Q4｜紧急止血是否预先获准**：若四棱落码窗口顶不住、线上或 harness 先出现串形，(a) 允许先上丙案（`points.slice()`，一行）再续做本文（**本文建议**，但必须同批登记「§2 违规保留」+ 排期）；(b) 禁止，等本文整单完成。
