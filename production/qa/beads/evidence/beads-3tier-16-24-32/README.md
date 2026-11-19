# 16 / 24 / 32 三档对照证据 · beads-3tier-16-24-32

- 任务号：**WXG-T-989**（用户令「3/ 1」选项 3：把 16/24/32 三档对照证据正式落盘）。派单时曾写作 WXG-T-986，该号与后续 987 / 988 在派单执行期间被并发会话连续占用，按台账 SSOT 二次改判，见 §7。
- 角色：严守真 / 质量负责人（readonly）拟稿；**落盘与汇编裁定由主理人执行**。
- 产物取证日：2026-11-18（源 `/tmp/beads-3tier/` 的 mtime）；落盘日：2026-11-19。
- 证据性质：**既有临时产物的原样归档 + 口径订正说明**；本单不新增实验、不重跑、不伪造实测。
- **入库体例（重要）**：按 [`.gitignore` §101–105](../../../../../.gitignore) 与 WXG-T-292 续批五裁定，本目录的 17 件 `.png` / `.json` 取证物**留盘不入库**（既有 `production/qa/beads/evidence/` 已跟踪的 13 件全是 `.md`）；**只有本 `README.md` 入库**，作为可复核的证据锚，内含逐件字节数、sha256、关键读数与复现命令。产物本体留在本地 `production/qa/beads/evidence/beads-3tier-16-24-32/` 与 `/tmp/beads-3tier/`，换机复核需重跑或取回该目录。
- 判据来源：GDD `core-loop.md §8` / [`systems-index.md §3`](../../../../../games/beads/design/gdd/systems-index.md)；方法件 [`wxgame-qa-gates/SKILL.md`](../../../../../my-skills/wxgame-qa-gates/SKILL.md)。
- 关联史证：[`level-difficulty.md §2.1`](../../../../../games/beads/design/art/proposals/ui-style-redesign/level-difficulty.md)（WXG-T-981 改判）、[`pattern-legibility.md §7 H-5/H-6`](../../../../../games/beads/design/levels/pattern-legibility.md)、[`TASKS-DETAIL.md`](../../../../TASKS-DETAIL.md) 的 WXG-T-980/981；纪律 K-025 / K-045 / K-092 / K-155 / K-192 / K-200。

> ⛔ 本件是**新增证据说明**，不是对已入 HEAD 史证行的修订。凡涉及旧读数的订正一律写在本件内，零回改 HEAD 任何文档行（K-025 / K-192 / K-200：只增不改、纯插入、逐字节自证）。

## 0. 本轮环境事实（可执行 vs 阻塞）

| 项 | 事实 |
|---|---|
| 平台 | pnpm monorepo / beads 微信小游戏；日常验证靠 Node + 浏览器 harness |
| 真机 / 编辑器 | **无**（AGENTS.md §1）；所有「手感 / 可完成性 / 可读性观感」类结论只能 `[待 playtest]` |
| 8787 studio | 旧进程，改源码不自动加载（**K-092**）⇒ 本单不重启服务、不重跑浏览器实验 |
| Token Plan 生图 | **0 次调用**；6 张 PNG 为程序化 plain 渲染（RGB，非 AI 生图） |
| 可执行核验 | 仅只读：文件计数 / 字节数 / sha256 / PNG 签名 / JSON 可解析 / 汇总字段对拍 |
| **G1–G4** | **未执行**（本单为证据归档，不改源码 / 用例 / 关卡，不进阶段裁决；不伪造绿） |

## 1. 实验目的

用同一张 **16×16 v5 母版**在三种请求档位（16 / 24 / 32）下，量化两张轴的对照：

1. **盘面裁边**：`notrim=1` 保留空边（keep，名义盘面 = 请求档）vs `notrim=0` 裁边（trim，盘面缩到实际图案幅面）；
2. **错位模式**：`mis=max` 最大化 / 全错位 vs `mis=swaps` 交换装盘。

目的：为 `level-difficulty.md §2.1`（WXG-T-981「分档锚点由名义盘面尺寸改判为实际可填珠数 N」）提供「名义 `cols×rows` 系统性虚高」的对照证据，并厘清 steps 读数口径。
⛔ 本证据**不用于**推导难度、定价，或放宽任何门禁判据。

## 2. 参数矩阵

| 轴 | 取值 | 产物侧落点 |
|---|---|---|
| 请求档位 | `16` / `24` / `32` | 三档，`request` 字段 |
| 裁边 `notrim` | `1` = 保留空边（keep）/ `0` = trim | `plain-*` + `resp-*` 各 6 件；`compare.json` 6 行 |
| 错位 `mis` | `max` = 全错位 / `swaps` = 交换装盘 | 主对照 `compare.json`（6 行均 `misMode:"max"` / `derangement:"MAXIMAL"`）；模式对照 `compare-mis.json`（6 行） |

**12 次量化**：主对照 **6 次**（16/24/32 × keep/trim，mis=max）+ 错位模式对照 **6 次**（16/24/32 × swaps / none）⇒ 对应 `compare.json` 6 行 + `compare-mis.json` 6 行。**0 次 Token Plan 调用**。

⚠️ 产物构成的诚实登记（不改写、不补跑）：

- `compare-mis.json` 的 6 行为 `16/24/32 × {swaps, none}`：`swaps` 3 行有解（steps 7/3/3）、`none` 3 行为**否定结果**（`importable:false`，blocker = 「交换模式需 k ≥ 1 / 需能产出错位盘」，steps/cleared/timeEst 全 `null`）。派单矩阵写 `mis=max / mis=swaps`，而该文件实含 `swaps` 与 `none` 两档；`none` 是 swaps 腿的对照，属既有产物构成，据实登记。
- `lv-*.json` 仅 3 件、且只覆盖 keep（`notrim=1`）组，无 trim 对应关卡草案。

## 3. 产物清单与指纹（17 件，原样搬运转存）

**原样转存、不改字节**：从 `/tmp/beads-3tier/` 复制到本目录，沿用原名，PNG 不重编码、JSON 不格式化、不增删字段。⚠️ 这 17 件按体例**留盘不入库**；本表是它们的入库替身（证据锚），复核时需能读到留盘目录。

| # | 文件名 | 字节数 | sha256 全文 |
|---|---|---:|---|
| 1 | `plain-16keep.png` | 2438 | `8df9d53741a9f39260f71d9fb7e7ab6fdc5952453ed573cb40501d9e7230ed18` |
| 2 | `plain-16trim.png` | 2020 | `99deb88f7d9233e1b1a758cf321bb9e7bd5c79fc19593dedd3e5317e57a058bd` |
| 3 | `plain-24keep.png` | 4303 | `c08827b9e29bb11f760f38521a092934835f1924eb36dcb1df879b40308c30aa` |
| 4 | `plain-24trim.png` | 3299 | `b02bc9053e9ff60914bb80d2e8f1b1b8c82d3f6552c4ea606b786337a8e643f6` |
| 5 | `plain-32keep.png` | 6520 | `a3981fc949774d21a85034abe46a7725068a78da15396b346c14b6beb1cca514` |
| 6 | `plain-32trim.png` | 4880 | `882bb79cf7f736963c5685fc4e108feb72beeaf4d21ffcd509b5e814b7b47a7c` |
| 7 | `resp-16keep.json` | 4657 | `e14ebfb695a43d5eb41444abcb8beafae96e441ebf0480a96bba6e7cb1ddfd72` |
| 8 | `resp-16trim.json` | 4233 | `f99a9e543632537f137b5f7cf60ca45c60c830b39e9d75d7a243927709a265e0` |
| 9 | `resp-24keep.json` | 6235 | `b24d7a595297a190268fa8bb77316e29e5366a8aebe704f5a413b9699039a172` |
| 10 | `resp-24trim.json` | 5227 | `727b555956fc124120059d28c675a12ee5ea1c0c17b61601ab4b1370e17eaa0f` |
| 11 | `resp-32keep.json` | 8322 | `18352225eb0f96fb2cb73cee918d5d35b35fcc1cd980d2d988ef559887dfe733` |
| 12 | `resp-32trim.json` | 6506 | `0f99aecb3faa8fbc3d9d02ec6a57c24979005cff4ece83f042df77ccdae5e40d` |
| 13 | `lv-16keep.json` | 830 | `3a71e336a884a8ebeeb85dd210a33d7c7602a1eea49a5816354c19ad89be58a6` |
| 14 | `lv-24keep.json` | 1534 | `d77d0568b838fbca6bc60ebd140bcf44509758cc0e6e6b8c5a4a5df70ce95ff7` |
| 15 | `lv-32keep.json` | 2494 | `a6c1b780a75559e355bfcf23c53d4f65daba05728ccc5f4a933e49c6db123ce9` |
| 16 | `compare.json` | 4050 | `5d38a6eb57f39b1f2a3ad20dfdbd9e301701fb8ddeedc8ac1f8f55ac92d58987` |
| 17 | `compare-mis.json` | 1777 | `9e5f92899cabe66efc94404615b7ed869d04e0c8579aba6e770bc3fb144dbef1` |

**计数闭合**：17 件 / 69325 字节（png 23460 + resp 35180 + lv 4858 + compare 5827）。
源指纹核验：6 张 PNG 均 `PNG 8-bit RGB`（512²、384×448、768²、576×640、1024²、768×832），11 个 JSON 全部 `JSON.parse` 通过。

⚠️ **指纹订正（不静默改数）**：质量成员回传清单里第 6 件 `plain-32trim.png` 的 sha256 全文漏抄 1 位（写成 63 字符的 `…f73696c5685f…`），本 README 初稿原样转写。落盘后逐件对拍发现不符，以**磁盘实际值**（64 字符 `…f736963c5685f…`）订正上表。`/tmp/beads-3tier/plain-32trim.png` 与落盘件的 sha256 逐字相同，证明**产物字节无损坏、仅清单抄写笔误**；前缀 16 位不受影响。其余 16 件对拍一次通过。

⚠️ **D-1 计数差异**：派单正文写「16 个产物」，但同一份派单自身的明细枚举（6 PNG + 6 resp + 3 lv + 2 compare）与磁盘实测均为 **17**。主理人裁定见 §7：按 17 件原样落盘，不删件、不凑数。

## 4. 关键量化读数（供 §5 订正引数，均出自 `compare.json` / `compare-mis.json`）

| tag | request | notrim | 盘面 | cells | **可填 N** | void% | colorError | T5/色 | **steps** | taps | timeEst | g7_normal | g7_boss |
|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 16keep | 16 | 1 | 16×16 | 256 | **116** | 54.7 | 31.6 | 29.0 | 45 | 90 | 220 | false | false |
| 16trim | 16 | 0 | 12×14 | 168 | **116** | 31.0 | 31.6 | 29.0 | 45 | 90 | 220 | false | false |
| 24keep | 24 | 1 | 24×24 | 576 | **236** | 59.0 | 36.3 | 59.0 | 70 | 140 | 342 | false | true |
| 24trim | 24 | 0 | 18×20 | 360 | **236** | 34.4 | 36.3 | 59.0 | 70 | 140 | 342 | false | true |
| 32keep | 32 | 1 | 32×32 | 1024 | **402** | 60.7 | 33.2 | 100.5 | 114 | 228 | 556 | false | true |
| 32trim | 32 | 0 | 24×26 | 624 | **402** | 35.6 | 33.2 | 100.5 | 114 | 228 | 556 | false | true |

`compare-mis.json`（trim 盘幅）：16/24/32 的 `swaps` 行 steps = 7 / 3 / 3、`none` 行 steps = `null`（否定结果）。

## 5. ⚠️ 关键口径订正（本件核心，勿略读）

**(1) `compare.json` 的 `steps`（45 / 70 / 114）是「12 槽基础档 + 单一 ACB 策略」的定价读数，不是玩家最省解，也不是「实测步数」。**

- 证据：`resp-16keep.json` 的 `pricing.baseCap = 12`、`stepsByCap = {"12":45, "24":29, "48":24}`、`source = "bot"`、`tierK = 0.85`、`secPerStep = 4.14`、`formula = "v0.4（真引擎实测 BAC 批量动作数 × SEC_PER_STEP）"`；`systems-index.md §3.5 v1.84` 明载「steps 改为**基础档 12 槽**实测值并装进 2★ 档」；`TASKS-DETAIL WXG-T-980` 明载「steps 为固定 ACB 贪心策略路径长**非最优**」「三星秒数是模型值」。
- 三个层次勿混：**45**（12 槽 + 单一策略定价读数）／**29**（同一策略在 24 槽的 `stepsByCap` 读数）／**≈20**（玩家最省解，见下条）。三者量纲不同，不能互替。
- ⚠️ 命名换代如实登记：`resp` 的 `formula` 字面写 **BAC**、`TASKS-DETAIL 980` 写 **ACB**、`systems-index §3.5` 记「定价分支序 **BAC→ACB**」。均属已入 HEAD 史证，本单不裁定、不改写，统一按派单权威口径称「单一 ACB 策略」。

**(2) 16×16 v5 母版在 24 槽下最省解约 20 步（与用户估算一致）。**

- 该数属**玩家最省解 / 用户估算口径**，正好印证「steps 列 ≠ 最省解」：同一 16 档，`compare.json` steps=45（12 槽定价）、`resp` 24 槽单一策略=29、玩家最省解≈20。
- ⚠️ 诚实边界：本目录 17 件产物**不含 20 步的独立实测文件**；该值来自派单 / 上轮实验结论，本单不重跑、不伪造、不外推，也不与 45/29 调和。

**(3) `steps` 与 `N` 不单调；不得据该列推导难度，不得据此放宽门禁⑦。**

- 本表内 N = 116 / 236 / 402 递增，steps = 45 / 70 / 114 看似递增，**纯属同一母版 + 同一错位档 + 同一策略的规模伴随**，不构成「N 决定 steps」的因果。反例见 `level-difficulty.md §2.1`：L00007 N=60⇒34 步、L00001 N=102⇒12 步（少 42 颗反而多 22 步）；同 N=797 的心形仅换错位档就从 3 步跨到 415 步；`TASKS-DETAIL 980` 亦明载此反例。
- ⛔ 门禁⑦ 判据（量纲＝真引擎实测 `steps`）**一字未动**：§2.1 明写「⛔ 不得拿 N 反推或放宽门禁⑦」，`TASKS-DETAIL 980/981` 明写「不得拿 N 反推或放宽门禁⑦ `[7,37]` / `49`」。本证据件不申请、不暗示任何放宽。

**(4) 上一轮表格把 45/70/114 标为「实测步数」是错的——在本新增证据件里订正，不回改史证。**

- 旧标混淆了「模型定价读数」与「玩家实测步数」。正确标注见 (1)。
- ⛔ 依 K-025 / K-192 / K-200：**零回改已入 HEAD 的任何文档行**（含 `TASKS-DETAIL.md` 历史批次快照、`systems-index.md` 头注、`level-difficulty.md §5` 快照），只在本新增 README 里写订正；修正后的读数与旧读数一起留档，只写新数。

## 6. 诚实分栏

### 6.1 成立（有本目录量化读数支撑）

- **trim 只改盘面尺寸、不改可填珠数 N**：三档 keep/trim 的 `fillable` 逐档相等（116 / 236 / 402），变的是 `board_cols_rows`（16×16→12×14 等）、`cells`、`void_pct`；连 steps / taps / timeEst 也逐档相等。这正面支撑 §2.1「名义 `cols×rows` 虚高、应以 N 为锚点」的改判。
- **升采样不等于色差单调变好**：`colorError_final` = 31.6 → **36.3** → 33.2，先升后降、非单调；档位升高 ≠ 色差单调改善。

### 6.2 成立（观感层，非量化层，须标注结论层级）

- **24 档可读性最干净**：属上一轮浏览器主观走查结论。⚠️ 量化列**不构成**其独立背书——24 档 `colorError_final` 反而最高（36.3）、`adjRate` 居中（0.759）。本件如实标注为「观感层结论，`[待 playtest]` 复核」，不拿 T5 单调（29/59/100.5）冒充「最干净」的证明，不伪造量化支撑。

### 6.3 仍待 playtest（本环境不可执行，登记阻塞 + 解除条件）

- §2.1 分档边界 200 / 800 是经验值、`[待 playtest]`、非冻结常量、非门禁阈值；大 N 可完成性与 64×64 性能未真机验证 ⇒ 不得据本证据宣称「已可玩」。
- 「24 档最干净」的观感、三档真实手感 / 触控可完成性（ADR-0018 29×29 裁定不变）。
- `SEC_PER_STEP = 4.14` 未经新 playtest 重标定；星账秒数为**模型值**，不是人类用时判据。
- 16 色 × 608 格外推档从未实测。
- **解除条件**：真机 + AppID + 可构建产物 + 大盘压力 fixture 入包（同 WXG-T-980 第 3 项「真机 t_act 校准链」阻塞口径）。

### 6.4 已知冲突 / 口径差异，未裁定（诚实登记，不消解）

- **H-6**（`pattern-legibility.md §7`）：§2.1 选图下限 **N ≥ 60** 与 T5 隐含 **N ≥ 100**（C≥4 × 每色≥25）之间的 **[60,100) 空白带**：带内图按 §2.1 可选、却必然命中 T5 判 `sizing`。两者均属已冻结 / 已改判史证，⛔ 不调门限凑绿、不回改 §2.1（K-025 / K-192）。本单只登记。
- **门禁⑦ 带宽两套史证数字并存**：`level-difficulty.md §7 G11 / §5.2`（2026-10-10 量纲）记普通关 `[18,90]` / boss `≥120`；`TASKS-DETAIL 980/981`（2026-11-18，换基准档后）记 `[7,37]` / `49`。属量纲换代前后不同快照，均属已入 HEAD 史证，本单不裁定、不写死、不修改；门禁判据一律以 GDD §8 / `tuning.ts` 现行真源为准。
- **BAC / ACB 命名换代**：见 §5(1)，不裁定。
- 本对照为 **mis=max / swaps 且固定 12 槽单一策略**，不能外推到「玩家最优解」「真机用时」或「其它错位档」。

## 7. 主理人汇编裁定（2026-11-19）

| 编号 | 事项 | 裁定 |
|---|---|---|
| D-1 | 派单写「16 个产物」，实测与明细枚举均为 17 | **派单正文笔误**（6 PNG + 6 resp + 3 lv + 2 compare = 17）。按 **17 件原样落盘**，不删件、不凑数、不改任何字节；本 §3 清单为唯一入库口径。 |
| D-2 | 派单任务号 `WXG-T-986` | 该号与后续 `987`（EP15-S1/S3）、`988`（EP15-S2）在派单执行期间被并发会话（Trae CN）连续占用。按台账 SSOT 二次改判为 **WXG-T-989**（本单）/ **WXG-T-990**（难度重构阶段 0），台账头注登记改判理由；**不回改**已入 HEAD 的 986/987/988 行。 |
| D-3 | 质量成员建议门禁 **CONCERNS** | 采纳：D-1 已裁定消解；剩余 CONCERNS 为「24 槽最省解 ≈20 步无独立实测文件」「24 档最干净属观感层」两条，均已在 §5(2) / §6.2 标注证据边界与 `[待 playtest]` 解除条件，不阻断归档。 |
| D-4 | G1–G4 | 维持「**未执行**」：本单无源码 / 用例 / 关卡改动，不进阶段裁决，不伪造绿。 |
| D-5 | 落盘后逐件对拍发现第 6 件指纹不符 | 定位为**回传清单抄写笔误**（63 字符，漏 1 位），非产物损坏：`/tmp` 源与落盘件 sha256 逐字相同。按磁盘实际值订正 §3 表格并在此登记，**不改任何产物字节**；其余 16 件一次通过。 |
| D-6 | 17 件产物按 `.gitignore` 被排除，未进暂存区 | **按仓库体例办理，不改 `.gitignore`、不用 `git add -f`**：`.gitignore §101–105` 明定 QA 取证物 json/png/jpg「留盘不入库」，WXG-T-292 续批五裁定「52 MB / 39 张不入库，同目录 README.md 保留入库」，既有 evidence 已跟踪 13 件全是 `.md`。故本单入库件 = 本 `README.md`（含逐件指纹与读数）+ 提案 + 台账两件；17 件产物留在本目录与 `/tmp` 供本地复核。 |

## 8. 史证声明（正面不变式）

- ⛔ **零改已入 HEAD 的任何文档行**：`TASKS.md` / `TASKS-DETAIL.md`（由主理人汇编登记新增节）、`systems-index.md`、`level-difficulty.md`、`pattern-legibility.md`、各 QA 五件套 —— 全部只读引用、不回改、不删除。
- ⛔ **零改门禁 / 冻结常量 / 公式**：门禁⑦ `[7,37]`/`49` 判据、§3 冻结表、`DI` 公式本体与 §3.1 系数、`SEC_PER_STEP`、`STAR_TIER_K`、T1–T7 门限（含 T5 ≥25、T7 11/14/16）、门禁⑧ 默认 WARN —— 一字未动。
- ⛔ **零改代码 / 资产**：不碰 `tools/scripts/`、`games/beads/src/`、`tests/` 任何文件；不跑 `levels:sync`。
- 17 件产物与原 `/tmp` 源逐字节一致，未重编码、未格式化、未增删字段（K-200 三段自证精神）；按 D-6 体例**留盘不入库**，故本单的入库改动面只有 `README.md` 等文本件。

## 9. 复现 / 验证命令（只读）

> ⚠️ 以下命令需先取回 17 件留盘产物（源 `/tmp/beads-3tier/`，或本地转存目录）；它们按 D-6 **不入库**，换机后本目录只会有本 `README.md`。

```bash
cd production/qa/beads/evidence/beads-3tier-16-24-32
ls -1 | wc -l                                  # 18 = 17 件源产物 + 本 README
for f in $(ls | grep -v '^README.md$' | sort); do printf '%s | %s | ' "$f" "$(stat -f '%z' "$f")"; shasum -a 256 "$f" | cut -c1-16; done
cat $(ls | grep -v '^README.md$') | wc -c      # 69325（排除 README）
for f in plain-*.png; do file -b "$f"; done
for f in *.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f OK"; done
```

> 落盘后已复跑 `pnpm run check:frozen-values`，读数 `STATUS: OK`；本件位于 `production/qa/`，不在该门 `design/**` 扫描面。⛔ 不声称「SKIP 计数不变」——本单未记录落盘前的 SKIP 基数，无对照即无自证（K-192）。

## 10. 与 G1–G4 的关系（QA 门纪律）

本单 = 证据归档，**不进阶段裁决**：G1 静态 / G2 单测 / G3 冒烟 / G4 硬判据 **全部「未执行」**，理由＝无源码 / 用例 / 关卡改动，且无真机 / 无编辑器（AGENTS.md §1）。不静默跳过、不伪造绿；环境阻塞已按 `wxgame-qa-gates` 登记「阻塞原因 + 解除条件」（见 §6.3）。阶段 PASS / CONCERNS / FAIL 的最终裁决属编排者，本件只提供可复核证据与建议。
