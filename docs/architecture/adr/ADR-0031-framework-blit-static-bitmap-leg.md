# ADR-0031 · 框架位图子系统：外部静态位图资产的 blit「注册表腿」

- **编号 / 命名**：接 `ADR-0030`；框架级决策，文件名不带游戏前缀（对齐 `ADR-0024 render-model-polygon` / `ADR-0026 render-model-blit-kind` 惯例）。
- **日期 / 作者**：2026-10-10 · 程基岩（engineering-lead）
- **任务号**：**WXG-T-271**（领号已核：真实台账最大 = 270（归档占用未列主表）⇒ +1 领 271，全仓无占用，判例 K-046）。本单为决策文书；**实施码已另落于 WXG-T-271**（boss 缩略位图臂，用户 2026-10-10 裁「先写码、暂不 import/重建」，主表行见 `production/TASKS.md`）。
- **状态**：**已改裁（2026-10-10 复评 → DEC = 方案 C′，原 DEC-1 方案 A 降为备选）**。⛔ 裁定生效 ≠ 已实施：C′ 落码前置见 §4.2 / §5；`control-manifest §19`「向主包投放位图」红线与 `systems-index §3.8` 总包口径的**正文回改另走 §3.9 变更单**（用户 2026-10-10 裁：本单只记录，不擅改受控正文）。
- **需求锚（用户原话，2026-10-10）**：「#1 重决 A1：坚持上屏照片原图」——boss 关卡的**原始照片 PNG 要原样上屏**（橱窗格 / 走马灯卡），不接受程序化近似。前置调研结论：关卡 JSON 数据已完整进主包，**唯一没进包的是 boss 原图 PNG**（38 KB，躺在 `design/levels/assets/`，从未拷入 cocos 资源）。

---

## 1. 上下文（Context）

### 1.1 为什么不是「从零造位图子系统」

框架**早已有位图腿**——本单的前提修正：`#1-A1` 起手被当作「框架无位图原语」是**误判**。在册事实链：

| 既有件 | 出处 | 能力 |
|---|---|---|
| `BlitCommand { kind:'blit', textureId, x,y,w,h, alpha?, fx? }` | `core/render/render-model.ts:120`（ADR-0026） | 渲染模型层的位图图元；core 只存 `textureId` 字符串，适配器解析（守 L2） |
| `TextureRegistry { get(textureId): object\|undefined }` | `adapters/canvas2d/canvas2d-renderer.ts:63` | 注入式解析钩子；`BlitResolver` 单一钩子（ADR-0029 §8.1） |
| canvas2d 纯 blit 腿 | `adapters/canvas2d/tint-blit-resolver.ts:34` | **无 `fx` ⇒ `registry.get(textureId)` 直接 `drawImage`**——harness 侧「原样显示位图」**已成立** |
| Cocos 生产 blit 载体 | `host/beads-blit-carrier.ts`（ADR-0030） | 载 mask PNG → 烘 tint 图集 → `Sprite` 池；**仅处理带 `fx.base` 的着色珠面** |

⇒ 缺口收窄为一处：`beads-blit-carrier.accept()` 第 211–212 行——`tintFxBase(cmd.fx) === undefined` 时 `_bail('fx 无 base（注册表腿未实现）')`。**全彩、不经 tint 的位图 blit 在 Cocos 生产臂没有落点**，且没有「静态位图资产 → textureId」的装载腿（现有装载腿只服务 4 张 mask）。

### 1.2 硬约束（本单必须在这些框内做）

- **L1**：`.scene`/`.prefab`/`.meta` 禁手写、禁伪造；新资产 `.meta` **只能由编辑器生成**（`control-manifest.md:211`）。boss PNG 进工程须走编辑器导入。
- **L2 / L3**：`core/**` 与 `games/*/src` 不碰 `cc`/`wx`/DOM。⇒ `textureId` 留在 core，位图装载 + 解析一律在**适配器/host 层**。
- **`control-manifest §19`（现役红线）**：「⛔ **包体守卫未归位前向主包投放位图**；未命中一律矢量回退。前置：T-215 归位、S0 守卫、ADR-0026 `blit`」。
  - §19.1 tint mask 档位例外**只解「放大」半，不解「向主包投放位图」半**（`control-manifest.md:354`）。
- **K-089（知识库确诊）**：`check:size` 在 `pnpm run verify` 里当前为 **SKIP**（`verify-all.mjs:21/63`；构建链未打通 ⇒ 无实测产物 ⇒ 主包真实余量今天测不出）；且脚本 `mainTargetKb:2000` 与 §3.9 v1.51 脱钩。**「无牙守卫」不得用来背书向主包加位图**。K-089 规避 ③ 明写：复评触发里须写「守卫仍 SKIP / 仍钉旧值 ⇒ 禁止投放主包」。
- **数值真源**：包体红线住 `systems-index §3.8/§3.9`。**用户 2026-10-10 裁定「暂不开通体积扩展资质」** ⇒ 有效总包红线按 **20 MB**（`§3.8` 现值 30720 KB 系按开通假设写的，须走 `§3.9` 变更单回改 30720→20480；回改前本单以 **20 MB** 为决策依据）。主包红线 4096 KB 不受此裁定影响。本单不新增冻结量。

---

## 2. 备选方案（Alternatives）

### 方案 A · 扩既有 blit 腿补「注册表腿」，位图资产进**分包 Bundle**（推荐）

- **core**：**零改动**。纯位图 = 不带 `fx` 的 `blit`，`BlitCommand` 已足够。
- **canvas2d harness**：注册表腿已存在（`tint-blit-resolver` 无 fx 走 `registry.get`）⇒ 只需把 boss `textureId` 注册到一个离屏 `Image`（本地直接 import，无分包概念）。
- **Cocos 生产**：给 `beads-blit-carrier.accept()` 增一条**注册表腿**——`fx` 缺失且 `textureId` 命中「静态位图注册表」时，直接取预载 `SpriteFrame`（**不进 tint 图集、不参与 `_cell()` 64 格预算**），按 `w/h` 贴 `Sprite`；未命中才 `_bail`。
- **资产位**：boss 原图放入**独立 Cocos Asset Bundle，并在编辑器配成微信小游戏「分包」**（不复用进主包的 `textures` mask bundle）⇒ **不触碰 §19「向主包投放」红线**；产物由构建器生成 `game.json.subpackages`，运行时 `assetManager.loadBundle` 按需拉取。`.meta`/uuid 由编辑器导入生成。
- 与上轮「章节完整打包」调研闭环：分包 Bundle + `loadBundle` 预热，正是 `level-content-pipeline.md` 层 4（P3）预留的同一条通道。

### 方案 B · 走 tint 腿伪实现（把 PNG 当 mask，`fx.base=白`）

复用现成图集通道，改动最小。但 tint 腿语义是**灰度 mask × 基色着色**——全彩照片会被压成单色着色 ⇒ **直接失真**，与「坚持原图」诉求正面对立；且每配色吃图集格（ADR-0030 实测 64 格仅剩 4 格余量）。

### 方案 C · 投主包（复用现成 `textures` Bundle，`loadBundle('textures')` 已就位）

改动比 A 更小（加载腿现成、无需配分包）。但**正面撞 §19 现役红线 + K-089**：向主包投放位图，而主包余量守卫此刻是 SKIP（测不出）。要走 C，前置是「先把 build:wx 打通 + `check:size` 从 SKIP 变真阻断（守卫归位）」——把一笔尚未还的前置债务焊进本决策生效条件。

### 方案 D · 继续程序化（`menu-signage.drawLevelThumb`，现状）

零包体、零风险，harness/cocos 天然同源。但**用户已明确否决**（坚持上屏照片原图，不接受程序化近似）。列出仅为对比完整，排除。

### 事实性对比

| 维度 | A 分包注册表腿 | B tint 伪实现 | C 投主包 | D 程序化 |
|---|---|---|---|---|
| core 改动 | 无 | 无 | 无 | 无 |
| 原图保真 | ✅ | ❌ 单色失真 | ✅ | ❌ 非原图 |
| 撞 §19 主包位图红线 | 否（走分包） | 否 | **是（现役阻断）** | 否 |
| 吃 tint 图集预算 | 否 | **是** | 否 | — |
| 前置债务 | 编辑器配分包 Bundle | 无 | 守卫归位（build:wx） | 无 |
| 满足用户诉求 | ✅ | ❌ | ✅（但违红线） | ❌ |
| 复用于未来章节美术 | ✅ 顺带打通 P3 | 否 | 部分 | 否 |

---

## 3. 决定（Decision）

**采方案 A**（**原文保留；已于 2026-10-10 复评改裁为方案 C′，见下与 §6**）：框架位图子系统 = 在**既有 blit 腿**上补一条「静态位图注册表腿」（Cocos 适配器侧），core 零改动；boss 原图作为**独立 Asset Bundle、配置为微信分包**的资产经编辑器导入（`.meta` 由编辑器生成），运行时 `loadBundle` 预热后以不带 `fx` 的 `blit` 原样上屏。canvas2d harness 用本地直接 import 的平行腿承接同一 `textureId` 命名。

一句话（原）：**不新造位图子系统，只补它缺的那条不经过 tint 的腿；位图放分包不放主包。**

### 3.1 改裁（DEC = 方案 C′，2026-10-10）

**改裁后决定**：位图子系统机制**不变**（仍是「在既有 blit 腿补静态注册表腿、core 零改、harness 本地 import 平行腿」）；**只改资产落点**——由「新建微信分包 Bundle」改为「进**现成 `assets/textures` Bundle**（已配好、已合并进主包）」。

**改裁依据（三证合一，详见 §6）**：① 用户裁定「只补一张 boss PNG」；② `cocos-creator` MCP 工具枚举实测——**能**驱动导入+生成 `.meta`、**不能**配 Bundle/分包（⇒ 方案 A 的分包装配置是**不可自动的人工门槛**，C′ 因 Bundle 已存在而绕开）；③ `check:size` 已从 K-089 的 SKIP 转为**本机实测有牙**（beads 主包 2939.8 KB，+38 KB → ~2978 KB 仍 <4096 红线）。

**C′ 相对 A 的负面（诚实记）**：向主包投放位图正面撞 `§19` 现役红线——该红线写于守卫无牙（SKIP）时代，现守卫本机已可证伪；**正文回交编排者走 `§3.9` 变更单**重裁 §19（本单只记录裁定、不擅改受控文档）。异步加载腿（A 的条 2/3）在 C′ **消失**（textures 随主包启动加载，无分包异步窗）。

---

## 4. 后果（Consequences）

### 4.1 正面

- core **零改动**（`BlitCommand` 现成）；harness 纯 blit 腿**已存在**，只差注册 `textureId`。
- 原图**不失真**（不经 tint 着色）；**不占** tint 图集 64 格预算。
- **不违反 §19**：位图落分包而非主包，绕开「向主包投放位图」现役红线，也绕开 K-089「无牙守卫」。
- 顺带打通「外部位图经 Cocos 分包 Bundle 按需加载」这条能力，对未来章节美术与 P4 远程热更**复用同一注入式腿**（守 L2/L3：`loadBundle` 属平台通道，走注入式，core/src 不碰 `wx`）。

### 4.2 负面（已知成本，白纸黑字）

1. **工序的自动化可行性分层**（MCP 工具 `action` 枚举实测，`cocos-creator` MCP）：
   - ✅ **导入 PNG + 生成 `.meta`**：MCP **可驱动**——`asset_operations{import,create,reimport,save}` / `asset_manage{import,save_meta}` / `asset_system{refresh}`（编辑器侧生成 `.meta`，合 L1）。
   - ❌ **配成 Asset Bundle / 勾选微信分包**：MCP **无对应 action**（枚举里没有 bundle/subpackage 项）⇒ **必须在编辑器 Inspector 人工配**（`ADR-0030 §5.5` 当时即人工落地）。**这是方案 A 的硬门槛，方案 C 可绕开**（见下）。
   - ❌ **触发构建**：MCP 不可（`ADR-0009 §3.2` 实测），走 CLI `build-cocos.mjs`。
2. **异步加载窗**：分包按需下载 ⇒ 首屏/进关/展示前有一个未就绪窗口，期间必须**矢量/占位回退**（§19「未命中一律矢量回退」精神），不能白屏或静默丢图。
3. **双实现维护面**：harness（本地 import）与 Cocos（loadBundle 分包）各一条静态位图腿，`textureId` 命名口径必须两处对齐，否则 harness 绿、真机空。
4. **真机产物结构未实测**：Cocos 3.8.8 微信分包产物的真实目录结构尚未取证（`ADR-0030` G7 / `check-bundle-size.mjs:28` 头注），构建链（`build:wx` CLI）本身也未打通 ⇒ 端到端只能真机扫码验证，当前无法 CI 全绿背书。
5. **总包预算压力**：位图进分包即计入主包+分包合计，受 `§3.8` 总包红线（30 MB，含体积扩展资质假设）约束；美术增多时需回 `§3.9` 走变更单重算分包批次。

### 4.3 中性 / 待观察

- 分包**批次策略**（多少美术 / 几关一图一包）未定——待首次真机分包产物实测后定，本单不给具体数字（K-051：增量型数值须落码后差分复算）。
- boss 缩略**分辨率档位**（橱窗小图 vs 走马灯大图是否需多档 or 单档缩放）待真机 DPI 取证。
- 「注册表腿」是否值得从 `beads-blit-carrier`（游戏 host）**上移到 `adapters/cocos` 通用层**——出现第二个非 tint 位图使用方时再定，现阶段 beads 单一使用方不上移（YAGNI）。

---

## 5. 复评触发条件（Review Triggers）

出现以下任一情况时**重新评估本决策**：

1. **`build:wx` 打通 + `check:size` 从 SKIP 转为真阻断**（守卫归位，K-089 前置解除）⇒ 重估「小型位图直接进主包（方案 C）是否比分包异步更划算」。触发词：`check:size` 在 verify 里报出**实测主包 KB 数**而非 SKIP。
2. **Cocos 微信分包产物目录结构首次实测**（填 `ADR-0030` G7 空白）⇒ 回填注册表腿的 bundle 路径 / `loadBundle` 装载口径。
3. **出现第二个静态位图使用方**（不止 boss 缩略，如图鉴大图 / 皮肤位图）⇒ 把注册表腿从 beads host 上移到框架 `adapters/cocos` 通用层，并定 `textureId` 命名规范。
4. **P4 远程热更启动** ⇒ 用 `level-content-pipeline.md §4` 的 `LevelSourceProvider` 抽象**统一**位图与关卡数据的加载来源，本单的分包腿收敛为其一个实现。
5. **总包逼近 §3.8 红线** ⇒ 位图资产的档位/压缩/分包切分须重算并走 §3.9 变更单。

> ⛔ 本 ADR 生效不等于可落码：实施单开工门禁 = §4.2 条 1（`.meta` 由 MCP 驱动 + 分包配置人工 GUI）+ 条 4（真机产物取证路径）已就位；且**若 `check:size` 仍 SKIP，禁止改用方案 C 向主包投放位图**（§19 + K-089 硬约束，随本单复评触发 1 联动）。

---

## 6. 复评记录（触发式追加）

| 日期 | 触发项 | 实况证据 | 对 DEC 的影响 |
|---|---|---|---|
| 2026-10-10 | **触发 1（部分兑现）** | `node tools/scripts/check-bundle-size.mjs` 现报 **`STATUS: OK`**：beads 主包实测 **2939.8 KB**（未越 4096 红线，越 2000 内部目标）、breakout 1886 KB。⇒ K-089 当时「SKIP 无牙」的**本机腿已兑现为有牙守卫**（>4096 会 FAIL）。**注意**：CI / 干净检出仍无产物 ⇒ 仍 SKIP，本机可测 ≠ CI 可门。 | **重开 A↔C 取舍**：向主包投放 38 KB 现可被本机守卫证伪（2940→~2978 KB，仍远低红线）；叠加「MCP 只能驱动导入+.meta、不能配分包」与「用户要只补一张图」，**方案 C′（进现成 `assets/textures` Bundle，该 Bundle 已在主包）成为更省且 MCP 全程可驱动的路**——它免了新建分包 Bundle的人工 GUI 步，复用 `loadBundle('textures')` 已有装载腿。 |

> **待用户/编排者裁**：是否将 DEC 由方案 A 改裁为 **方案 C′**。改裁的前置义务 = 把 `control-manifest §19`「向主包投放位图」红线按「守卫已从 SKIP 转本机实测」重新裁定（§19 原文写于无牙守卫时代）。若维持方案 A，则须接受分包配置为**不可 MCP 自动化的人工门槛**，且为单张图引入异步加载腿。
