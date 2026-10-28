---
name: wxgame-art-review
description: 定期 review 小游戏美术设计还原度（art-bible / 原型定稿 / 落地单 / assets-spec ↔ 实现出图、调色板、字号、资产接线），出偏差表 + PASS/CONCERNS/FAIL，只读不改。触发：美术 review、还原度、设计还原、对设计稿、美术跑偏、art review。写美术规格走 wxgame-art-spec-programmatic；生成/改图走 wxgame-image-gen。
---

# wxgame 美术设计还原 review（偏差审计，只读）

本 skill 属 wxgame 家族（管线顺序、优先级与冲突裁决见 `my-skills/INDEX.md`）。
跨域或全流程请求先交 `wxgame-orchestration`；本 skill 只出评审报告，**不改美术规格、不改代码**
（修复按类型分派并另开施工单）。

核心原则：**美术真源是分层的，不是单一文件** ——「UI token → `art-bible §3.1`」「珠色 → `§3.2`
（委托 `systems-index §3.2`）」「版式与几何 → 落地单 + 原型定稿 PNG」「资产 → `assets-spec §1`」。
review 的价值是证明**实现仍指向这四层**，而不是重画一套设计。

## 0. 什么时候跑（触发节奏）

- 每个 Sprint / 里程碑收口前；发布门 **G2 / G4** 前（与 `wxgame-quality-gate` 并行，互不替代）
- **新屏 / 新页落地后**（例：Meta 批 1 三页 = `1b4649cc`，落码当日走查单零覆盖 ⇒ 首轮 review 必查）
- 资产换代 / 重烘后（PNG↔WebP 换代、BD-61 类量化塌缩、`mask:diff` 重出）
- 用户说「review 一下美术还原」「对一下设计稿」「美术是不是跑偏了」

## 1. 输入（只读，分层真源）

| 层 | 真源 | 位置 |
|---|---|---|
| UI token | `art-bible §3.1`（**唯一真源**，含 §3.1.1 `wood_*`/`card_*` 消费声明与名映射） | `design/art/specs/art-bible.md` |
| 珠色 10 色 | `art-bible §3.2`（委托 `systems-index §3.2`，⛔ 不由本节改） | 同上 / `design/gdd/systems-index.md` |
| 版式 / 几何 | 落地单（现行版号见其头注）+ 原型定稿 PNG + 坐标规格图 | `menu-layout-implementation-spec.md`、`final/prototypes/`、`final/coordinates/` |
| 资产 | `assets-spec §1` 清单 / §4 命名 / §5 包体预算；接线台账 | `specs/assets-spec.md`、`final/README.md` |
| 动效 | `art-bible §7`（毫秒值，服从 `ux-spec §5`） | 同上 |
| 可访问 | `accessibility.md` + `a11y-anchors.md` | `specs/` |
| 实现 | `games/<game>/src/view/**`（`palette.ts` = **消费副本**）、运行时 assets、产物 | 仓内 |

冲突裁决（`AGENTS.md §4` 精神）：`art-bible §3.1` > `palette.ts` 现值；
但**已登记漂移不得重复当新债报**（见 §2 步 3）。

## 2. 审计步骤（机械层先行，人只补门看不见的）

1. **机械门（只记录退出码与关键输出，⛔ 不修）**：`palettes:check`、`check:a11y`、
   `check:cocos-mask`、`check:bead-style-pool`、`framework:sync:check`、`harness:smoke`、
   该游戏 `test`（**金样本整帧对拍在其中** —— 改 view 消费面必跑，T-469 漏跑判例）。
2. **hex 越界扫描**：`src/view/**` 里 `'#RRGGBB'` 只允许出现在两处 —— `palette.ts`
   （消费副本）与 `bead-styles/*`（珠色通道）。其它文件出现 hex = **token 越界**，
   逐条登记 `file:line`。
3. **已登记漂移对账**：先读 `art-bible §3.1.1` 第 3 条与 §9 变更记录的「只登记、不代改」项，
   建成白名单；review **只报白名单之外**的偏差。⛔ 把已登记项重复报新债 = 噪声淹没真问题。
4. **token 覆盖**：新增屏的颜色 / 字号 / 间距是否走 `palette` / `tokens`；出现字面量（如
   `panelPage('图鉴', …)` 的标题串）时按 `tokens.md §7` 有无对应键判断 —— 无键则登记
   「**文案未入册**（沿用 signin/skins 判例）」，⛔ 不直接判缺陷。
5. **版式对账**：落地单的链常量 / 热区 / 净空 ↔ 代码常量（`menu-layout*`、`menu-anchors*`），
   偏差登记 `file:line` 与两值。
6. **资产接线**：`assets-spec §1` ↔ `final/assets/<页面>/` ↔ 运行时 `assets/` ↔ 产物。
   字节等值由 `check:cocos-mask` 机械守；**未转正 / 双轨待拍板**件（如 `ui_menu_signboard`、
   levelselect 草稿）登记为「在途」，⛔ 不当缺陷。
7. **出图比对（人工层）**：六屏（boot / 主菜单 / 选关 / 玩法+托盘 / 设置 / 签到）截图 ↔
   原型定稿 PNG，逐屏比对构图 / 间距 / 对齐 / 层级。
   **证据等级**：`harness` 截图只能证明「实现自证」；⛔ **不得当真机证据**（`device-walkthrough §0-4`）。
8. **观感裁定**：`§5 形状语言` / `§7 动效气质` / 冷暖对撞等**无通过线**的项，只出
   `PASS*` + 观察记录，交 `art-director` 或用户拍板；⛔ 不在 review 现场临时定线。

## 3. 偏差表（报告主体）

| # | 类型 | 真源（节号） | 实现现状 | 证据 `file:line` | 级别 | 归属 |
|---|---|---|---|---|---|---|

- 类型 ∈ token 漂移 / 未登记漂移 / hex 越界 / 版式偏差 / 资产未接线 / 文案未入册 / 观感待裁
- 级别：P0 = 玩家可感知的视觉错误（错位、压格、层级倒置、错色）；P1 = token 或几何不符；
  P2 = 命名、文档、次要间距
- 级别不写「待定」：判不了就降级，并在证据列写清缺什么证据

## 4. 判定（上限由证据等级决定）

| 判定 | 条件 |
|---|---|
| `PASS` | 机械门全绿 + 偏差表无 P0/P1 + **每屏都有出图证据**（真机优先） |
| `PASS*` | 线未定义或只有 harness 证据 ⇒ 附观察记录，⛔ 不得升 `PASS` |
| `CONCERNS` | 任一 P1 未闭合，或六屏中有屏缺图 |
| `FAIL` | 任一 P0，或实现与原型在构图/层级上冲突 |
| `⛔ BLOCKED` | 出图通道不通（编辑器 / 产物缺失）⇒ 写解除条件；⛔ 不得用「代码看着对」冒充 |

判定权归编排者（`wxgame-orchestration`）；本 skill 只产逐条读数与判定上限。

## 5. 边界（与兄弟 skill 分工）

| 想做的事 | 走哪里 |
|---|---|
| 写美术规格 / 色盲编码 / 包体预算承诺 | `wxgame-art-spec-programmatic` |
| 生成或修改图像资产 | `wxgame-image-gen` |
| 数值真源 / 设计漂移 | `wxgame-gdd-review`（§3 冻结常量） |
| 分层架构 / 依赖红线 | `wxgame-arch-review` |
| 真机逐条走查取证 | `production/qa/beads/device-walkthrough.md`（Session 4 / 4b） |

## 6. 常见误判（每条都踩过）

1. **把已登记漂移当新债**：`palette.ts` 与 §3.1 的换代差（`bg_base`/`panel_surface`/`panel_border`/
   `accent_primary`/`ad_badge` 五项）早已在 §3.1.1 第 3 条登记归 T1–T6 批 ⇒ 只在白名单外找问题。
2. **名映射误判「token 新增」**：`bg_base`↔`background`、`panel_surface`↔`panel`、`slot_dashed`↔`slotDashed` 等 10 组。
3. **拿 harness 截图当真机证据**（`§0-4`：模拟器 / 开发者工具 / web-mobile 一律不作真机证据）。
4. **把「在途 / 待拍板」件当缺陷**（signboard 双轨、levelselect 弹框草稿）。
5. **只跑门不看图**：机械门管得了 hex 与字节等值，**管不了构图、间距观感、层级顺序** ——
   这正是本 skill 存在的原因（P3 那次 `CONCERNS→回退` 就是门全绿而真机层级错乱）。

## 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-10-28 | 初版：分层真源 + 机械层/人工层双段审计 + 偏差表 + 判定上限；与 `gdd-review`/`arch-review` 同族（只读审计，修复另开单） |
