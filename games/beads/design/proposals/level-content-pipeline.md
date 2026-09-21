# 提案 · 已定方向待落码｜关卡内容管线（单图/组合图 + 版本化增量分包）

- 项目：`games/beads` · 任务号 **WXG-T-XXX（待主理人分配，防撞号）** · 状态：**方向已定（用户 2026-09-22 拍板），待落码**
- 上位来源：`gdd/meta-ui.md` v0.3（Album→Plate→Cell-Level 三层对象）· `ADR-0004`（行字符串数据形态）· `design/levels/levels-spec.md` · `systems-index §3.3`（`GRID_MAX=50`，v1.37）
- 触发：beads-studio「一键入关」（WXG-T-179 续作）现往**唯一** JSON `levels-01-08.json` 尾部 append，已致文件名语义漂移（"01-08" 装了 10 关），且 `systems-index-changelog.md v1.35` 明确登记「文件名暂不改，随下次管线演进一并处理」——**本文即该"管线演进"**。
- 数值纪律：`systems-index §3` 是唯一数值真源；本文**只引用常量名、不新增/不改任何冻结数值**。凡触及冻结量与已裁 GDD 者，一律进 §7「变更单清单」，**本文不自行落笔**。

---

## 0. 决策基线（已锁，用户 2026-09-21/22 拍板）

| 维度 | 结论 |
|---|---|
| 投放机制 | **A · 微信分包（subpackage）**：构建期把关卡分批切进主包/分包，发版上新。**B 远程热更暂不做**，数据层预留接口（`contentVersion`）。 |
| 组合图定义 | **纯尺寸驱动切块**。抛弃"刻意凑 3×3"。 |
| 切块算法 | 每方向珠子数 `n`：切块数 `k = ceil(n / 50)`；`base = floor(n / k)`；余数 `rem = n - base*k` 加到**末尾 rem 块**各 +1。横纵独立各算一次。 |
| 单图 / 组合图判定 | 横纵**都 ≤ 50** = 单图（single）；**任一方向 > 50** = 组合图（Plate），切成 `kx × ky` 宫，每宫 = 一个 Cell-Level。 |
| 文件粒度 | 单图 = 一关一文件；Plate = **一文件打包全部子版面 + 母版整图预览元数据**。 |
| 选关页 UX | **多宫平铺**，每宫一关；Plate 子格按母版顺序连续排列 + 视觉归组（显示所属整图缩略）；图鉴收藏页**并存**（`Q5=甲` 纯显示不变）。UI 细节后期再设计。 |

**切块算法验证**（与用户口径逐例对齐）：

| n | k=ceil(n/50) | base | rem | 结果 |
|---|---|---|---|---|
| 36 | 1 | 36 | 0 | `[36]` → 该方向不切 |
| 50 | 1 | 50 | 0 | `[50]` → 不切（=上限合规） |
| 51 | 2 | 25 | 1 | `[25, 26]` ✓ |
| 100 | 2 | 50 | 0 | `[50, 50]` |
| 101 | 3 | 33 | 2 | `[33, 34, 34]` ✓ |

组合示例：`51×101` → 横 `[25,26]` × 纵 `[33,34,34]` = **2×3 = 6 宫**（6 个 Cell-Level，尺寸分别 25×33 / 25×34 / 26×33 …）。

---

## 1. 层 1 · 关卡内容仓（真源数据模型 + 目录布局）

### 1.1 目录布局（从"单文件"改"目录化、一物一文件"）

```
games/beads/design/levels/
├── manifest.json          ← 内容清单：版本 + 有序条目 + 分包归属（唯一顺序真源）
├── palette.json           ← 共享色板（原 levels-01-08.json 顶层 palette 抽出；v1.40 品牌引用制已支持）
├── levels-data.header.txt ← TS 接口模板（沿用现有机制，手工维护）
├── singles/
│   ├── L0001-sweet-heart.json   ← 单图关卡，一关一文件
│   └── ...
└── plates/
    ├── P0001-xxx.json           ← 组合图，一 Plate 一文件（含 cells[] + 母版预览）
    └── ...
```

> **迁移**：现 `levels-01-08.json` 的 10 关拆成 `singles/L0001..L0010.json`（内容逐字节保留），顶层 `palette` 抽到 `palette.json`。原文件删除；`beads-gen.mjs` / `sync-palettes.mjs` 里硬编码的 `levels-01-08.json` 路径改指 `palette.json`（见 §7-7）。

### 1.2 标识符策略（关键取舍：uid 与运行时索引并存）

- **内容层用稳定字符串 `uid`**：单图 `L####`（4 位零填充，如 `L0001`）；Plate `P####`；Plate 内子版面 `P####-r{row}c{col}`（如 `P0001-r0c0`）。uid 一经分配**永不复用、永不改**，作文件名与 manifest key。
- **运行时仍用 order 索引**：manifest `entries[]` 按 `order` 展开成有序关卡数组（Plate 展开为其 N 个 cell，占 N 个连续下标），`levelIndex` = 数组下标（**沿用现状**，存档 `unlockedLevel` / `stars[]` 语义不变，避免大改引擎 `id: number` 类型）。
- **不变式**：manifest `order` **只追加、不改序、不中间插入** ⇒ 下标稳定 ⇒ 存档兼容。删除关卡 = 标 `retired`（保留 order 占位），不物理重排。

### 1.3 数据模型（字段级；内核沿用 `BeadsLevelRaw`，扩图鉴元数据）

**Cell-Level（单图与 Plate 子版面共用同一形态）**：
```
{ uid, name, cols, rows, time, cycleProfile,
  decoys[], swaps[], pattern[], misplaced[]?,
  palette?, paletteCodes?,           // v1.40 品牌引用制，沿用
  previewRef?,                        // 图鉴缩略引用（图形），可选
  plateUid?, cellPos?: {row, col} }   // 属某 Plate 时带上；单图为空
```
> 现有字段（`name/pattern/misplaced/swaps/time/cycleProfile/palette/paletteCodes`）**一字不改**（`name` 即图鉴/选关展示名，不新造 `title`），BOOT 校验（`config/levels.ts`）对 Cell-Level 逐条同样成立。新增字段（`uid/previewRef/plateUid/cellPos`）全部**可选**，向后兼容。

**Plate（组合图，一文件）**：
```
{ plateUid, name,
  sourcePreview,             // 母版整图预览（图鉴缩略 / 选关归组背景）
  gridCols: kx, gridRows: ky,
  cells: [ Cell-Level, ... ] // 有序，长度 == kx*ky；每 cell 带 cellPos
}
```
- 整图完成度 = **派生量**（`cells` 全 cleared），**不落档**（守 `meta-ui Q5=甲` + L5 + S8 §2.3「可派生的值不入档」）。

### 1.4 manifest.json（顺序与版本单一真源）
```
{ contentVersion: <int>,
  entries: [
    { uid, kind: "single"|"plate", file, pack: "main"|"sub-01"|..., order: <int>, unlockAfter?: <uid> }
  ] }
```
- `kind:plate` 的 entry 指向 Plate 文件；运行时按 `gridRows*gridCols` 展开成 N 个连续 order 的 Cell-Level。
- `pack` = 分包归属（层 3/4 用）；`contentVersion` = 内容集版本（层 2 用）。

---

## 2. 层 2 · 版本 + 增量

- **增量添加**：studio 出关 → 写新 single/plate 文件 + 追加 manifest entry（`order = 当前max+1`）+ `contentVersion++`。**老 entry 字节不动** ⇒ git diff 干净、真增量。
- **平滑识别所有关卡**：运行时**只读 manifest** → 按 `order` 展开（Plate 展开成 N cell）→ 全量关卡列表。单一入口，不散落多处枚举（守 K-031 族教训：清单是枚举就会漏项静默报绿，故以 manifest 为唯一顺序真源 + sync 期断言覆盖）。
- **版本概念**：`contentVersion` 现用于打包批次界定；**后期 B 远程热更**直接拿它做"本地 vs 远程"差量拉取——接口现在就预留（层 4 的 `LevelSourceProvider` 抽象即为此留口）。

---

## 3. 层 3 · sync 管线改造（真源 → 产物，产物形态 = 乙·按包分片）

改造 `tools/scripts/sync-levels-data.mjs`：

1. **反转断言④**「每游戏恰 1 JSON」→ 改为「以 `manifest.json` 为入口，遍历 `singles/`+`plates/`」。反转理由登记进 §7-4（K-031 族：反转门禁必须留痕）。
2. **按 pack 分片产物**（推荐乙）：
   - 主包产物 `src/config/levels-data.ts`：`LEVELS_DATA` = 所有 `pack:"main"` 的关卡，按 order。
   - 每分包一份产物（如 `src/config/levels-data.sub-01.ts`）：该包关卡数据。
   - 新增运行时清单产物 `src/config/levels-manifest.ts`：`entries[]`（uid/kind/pack/order/展开后的 cell 序列），供选关页与按需加载读。
3. **保留**：header 模板机制、逐字节确定性渲染（`render()`）、`--check` 门禁、`buildModuleSource()`/`describeGame()` 导出与「仅直接调用才写盘」副作用守卫。
4. **断言扩面**（任一不成立即 `exit 1`）：
   - manifest 引用的每个 `file` 必须存在；每个真源文件必须被 manifest 引用（无孤儿）。
   - `uid` 全局唯一；`order` 唯一且连续可展开。
   - Plate：`cells.length == gridCols*gridRows`；每 cell `cols/rows ≤ 50`（`GRID_MAX`）；`cellPos` 覆盖 `0..kx-1 × 0..ky-1` 无重复无缺。
   - 每 Cell-Level 过 `validateBeadsLevel`（BOOT 同套判据，不放宽）。

---

## 4. 层 4 · 分包投放 + 加载顺序

- **主包**：`levels-manifest.ts`（小）+ `pack:"main"` 首批关卡（保证**离线首屏即玩**红线：demo 前 N 关 + 第一张 Plate）。
- **分包**：后续批次切进 `subpackages/`（`sub-01/`, `sub-02/` …），产物为各 `levels-data.sub-XX.ts`。
- **运行时按需加载**：进某关前，若其数据在**未加载分包** → `wx.loadSubpackage()` → 合并进内存关卡表。选关页读 manifest 全量 entries（未下载的也展示，进关时触发加载）。
- **守铁律**：`wx.loadSubpackage` 属平台通道，走**注入式**（仿 `level-import.ts` 的 `HttpGet`）——定义 `LevelSourceProvider` 抽象（`loadPack(pack): Promise<LevelData>`），微信实现注入 `wx.loadSubpackage`、harness/Node 实现直接 import 分片产物。core / `games/*/src` **不碰 `wx`**（L2/L3）；选关页只读 render model（L5）。
- **`LevelSourceProvider` = 后期 B 的接入点**：远程热更只需再加一个实现（`wx.request` + 缓存），按 `contentVersion` 差量拉取，上层零改。

> ⚠️ **前置阻塞（诚实标注，不伪造能力）**：微信构建链路（`build:wx` / Cocos Creator CLI）**未接入**、分包配置未落地、Cocos 3.8.8 微信产物目录结构**未实测**（`check-bundle-size.mjs` G7 / AGENTS.md §1）。故层 4 的**真机分包加载当前无法端到端验证**。禁止伪造 `.scene`/`.prefab`/`game.json` 分包结构（L1）。

---

## 5. studio 侧改造（beads-studio）

- **切块生成**：`beads-gen.mjs` 增「母版 > 50 自动均分切块」——复用已验证的母版切块 spike（`temp/beads-gen.mjs`，记忆：九宫母版 36×36→9×12×12 已 spike，T-180 待固化），把切块数从"固定 3×3"改成本文 §0 的 `k=ceil(n/50)` 均分算法。
- **导出目标**：从"append 唯一 JSON"改成「写 single/plate 文件 + 追加 manifest entry + 分配 uid」。
- **`ingestLevel`（server.mjs）改造**：现 `max(id)+1` 自增 id 逻辑 → 改为分配稳定 uid + 写独立文件 + 更新 manifest + `contentVersion++` + 跑 `levels:sync`。仍守「sync 失败回滚真源」。
- **组合图预览**：Plate 文件带 `sourcePreview`（母版整图），供选关归组与图鉴缩略。

---

## 6. 分阶段落地（先做可独立验证的，阻塞项后置）

| 阶段 | 内容 | 可验证性 |
|---|---|---|
| **P1** | 目录化真源 + manifest + palette 抽出 + 迁移现有 10 关；sync 管线改造（反转断言④、按 pack 分片产物、断言扩面） | **纯 Node 可单测**（`levels:check` + vitest），现在就能做 |
| **P2** | studio 切块生成（均分算法）+ `ingestLevel` 改造（写文件/追加 manifest/uid） | Node 端到端可测（studio 本地仓模式） |
| **P3** | 分包配置 + 运行时 `loadSubpackage` 接线 + 选关页多宫 UI + 图鉴收藏页 | **阻塞**：待微信构建链路（`build:wx`）打通 + 真机取证 |
| **P4** | B 远程热更（`LevelSourceProvider` 远程实现 + `contentVersion` 差量） | 后期演进 |

> 建议先做 **P1**（数据层 + 管线，平台无关、可单测、解锁 P2），P3 待构建环境就绪再接。符合用户"先按一种方案实现后再调整"。

---

## 7. 需走的 GDD / §3 变更单清单（本文不自行落笔，待主理人确认）

1. **meta-ui Q2 修订**：选关侧改**多宫平铺**（甲·并存）；Q4 图鉴仍独立页、Q5 纯显示不变。走 `gdd/meta-ui.md` 文档变更单（记 §9 变更记录）。
2. **`DEMO_LEVEL_COUNT` + 解锁链上界**：现 `unlockedLevel`/`stars[]` 硬绑 `DEMO_LEVEL_COUNT`；关卡动态增长后语义要改 → `systems-index §3` 变更单 + §6 变更记录 + 主理人确认（**冻结量，禁擅改**）。
3. **levels-spec / §3.3 扩面**：新增"组合图切块"数据形态与 manifest 契约（对应 meta-ui 挂账的 **CH-5 校验器扩面**）。
4. **sync 断言④反转留痕**：`sync-levels-data.mjs` 头注释登记反转理由（K-031 族纪律）。
5. **存档 schema**：收集进度 / Plate 完成派生归属（S8 域；`Q5=甲` ⇒ 只读派生不扩档，若需收藏字段另议）。
6. **`ingestLevel` 契约变更**：uid 分配 + 多文件写入（WXG-T-179 续作的演进）。
7. **硬编码路径修正**：`beads-gen.mjs:105`、`sync-palettes.mjs`、`levels.ts`/`levels-data.header.txt` 注释、`systems-index §3.2`、`levels-spec.md` 里对 `levels-01-08.json` 的引用，随迁移改指 `palette.json` / 新目录。

---

## 8. 未决 / 待后期（不阻塞 P1）

- 选关页与图鉴页的**具体 UI**（多宫布局、归组视觉、缩略图源）——用户明示后期再设计。
- Plate 母版**图案来源**：当前定为"一张大图切块"（乙）；是否允许"独立小图拼成一 Plate"（甲）暂不支持，需要时再扩 manifest `kind`。
- 分包**批次策略**（多少关一个分包、主包首批容量上限）——待 §3.9 包体预算 + 首次真机产物实测后定，本文不给具体数字（K-051：增量型数值须落码后差分复算）。

---

## 9. 变更记录

| 版本 | 日期 | 变更 | 任务 |
|---|---|---|---|
| v0.1 | 2026-09-22 | 建档：四层方案（内容仓 / 版本 manifest / sync 分片 / 分包投放）+ studio 改造 + 分阶段落地 + 变更单清单。方向经用户 2026-09-21/22 拍板（投放=A 分包、切块=纯尺寸均分、选关=多宫并存）。**零 §3 变更、零新常量、未改任何既有代码/文档。** | WXG-T-XXX（待分配） |
