# beads 美术设计还原 review（定期审计 · 只读）

> 方法正本 = `my-skills/wxgame-art-review/SKILL.md`（WXG-T-476 新建）。
> 本文件只放**逐轮读数**；不改美术规格、不改代码。修复按类型分派另开单。
> 判定权归编排者（`wxgame-orchestration`）；本文件只产读数与判定上限。

## 判定上限口径（先读）

| 证据等级 | 能证明什么 | 能判什么 |
|---|---|---|
| 机械门（`palettes:check` 等） | 色板生成物 ↔ 真源一致、资产字节等值 | token / 资产类 PASS |
| 代码 ↔ 规格常量对账 | 几何 / 链 / 比例与落地单一致 | 版式类 PASS |
| `harness` 出图 | 实现自证（渲染链跑得通） | ⛔ **不得当真机证据**（`device-walkthrough §0-4`） |
| 真机截图 | 上屏真值 | 观感 / 层级 / 构图可判 |

无图 ⇒ 最多 `CONCERNS`；线未定义 ⇒ 最多 `PASS*`。

---

## 第 1 轮 · 2026-10-28（WXG-T-476 · 现包 `v1.0.3`）

### 机械门读数

| 门 | 结果 |
|---|---|
| `palettes:check` | ✅ PASS（15 个品牌色板 / 2104 色，色板与 mm↔dip 表均与真源一致） |
| `check:a11y` | ✅ OK |
| `check:bead-style-pool` | ✅ OK |
| `check:cocos-mask` | ✅ OK（菜单纹理字节相同，含归属腿） |
| `framework:sync:check` | ✅ 拷贝件与源码一致（beads framework 67 + game 108） |
| beads `test` | ✅ 1391 passed / 2 skipped（金样本整帧对拍在内） |

### 审计结果

**① hex 越界 = 0（正）**：`src/view/**` 的 `'#RRGGBB'` 只出现在 `palette.ts`（49 处，**消费副本**）
与 `bead-styles/{dual-tone-13,lineart-18}.ts`（各 1 处，**均在注释里**引用来讲「字面量违 K3/C5」）。
⇒ UI token 单一真源纪律在实际代码上成立。

**② 已登记漂移 = 白名单（不报）**：`palette.ts` 与 `art-bible §3.1` 的五点换代
（`bg_base` / `panel_surface` / `panel_border` / `accent_primary` / `ad_badge`）早已在
**§3.1.1 第 3 条**登记归 T1–T6 批 ⇒ 按 skill §2 步 3 不重复计债。

**③ 菜单版式常量 = 8/8 一致（正）**：落地单 v3.9 常量表 ↔ `config/tuning/menu.ts`

| 项 | 落地单 | 代码 | 判 |
|---|---|---|---|
| CTA 尺寸 | 324×92 @x218 | `MENU_PRIMARY_W=324` / `MENU_CTA_H=92` / `MENU_CTA_X=218` | ✅ |
| 招牌链 | 165 | `MENU_SIGN_CHAIN_H=165` | ✅ |
| 橱窗 / 组高 | 871 / 871（不拉伸） | `MENU_CASE_H=871` / `MENU_CASE_GROUP_H=MENU_CASE_H` | ✅ |
| 柜隙比例 | 上:下 = 1:2 | `MENU_CASE_GAP_RATIO=2` | ✅ |
| 顶隙 / 底隙 | 16 / 32 | `MENU_CHAIN_GAP_TOP=16` / `MENU_CHAIN_GAP_BOTTOM=32` | ✅ |
| 资源条覆盖 | 条 46（嵌窗顶） | `MENU_BAR_TOP_INSET=14` + `MENU_BAR_H=32` = 46 | ✅（**口径表述差，非漂移**——差点误报，见下） |
| 橱窗框 | 544×871 @x107 | `MENU_CASE_FRAME={x:107,w:544}` | ✅ |
| 钮行 | `bt ≥ cap` | 由 `menuAnchors` 公式给出，`menu-anchors.test.ts` 钉值 | ✅ |

> **反误报记录**：落地单常量表写「条 46」，代码 `MENU_BAR_H=32`，初看像 14px 漂移；
> 实读注释后才知 46 = **条顶内移 14 + 条体高 32**（用户 2026-10-16「太高」后从 46 收到 32）。
> 与 skill §6-2「名映射误判」同族 ⇒ **先查语义再报漂移**。

**④ 偏差 F1 · 文案未入册 + 未走单源（P2）**

| 项 | 事实 |
|---|---|
| 真源 | `tokens.md §7`「UI 侧**不散落字面**，落码一律读本表」 |
| 现状 | `meta-view.ts:166-168` 三页标题 `'图鉴' / '本地榜' / '名片'` **内联字面** |
| 同类既有做法 | `signin` / `skins` 走**单源常量**（`SIGNIN_TITLE` / `SKINS_TITLE`，`meta-view.ts:43,45` 导入） |
| 差别 | 既有两页 = 「无令牌键但收在单源常量」（判例）；新增三页 = **既无键、也未收常量** |
| 归属 | `wxgame-art-spec-programmatic` 定键（或按 signin 判例补 `*_TITLE` 常量），工程另开单落码 |
| **处置** | ✅ **已修（WXG-T-477，2026-10-28）**：`tokens.md §7` 补 `panel_album_title` / `panel_local_rank_title` / `panel_profile_title` 三键；`meta-pages-content.ts` 导出 `ALBUM_TITLE` / `LOCAL_RANK_TITLE` / `PROFILE_TITLE` 单源常量；`meta-view.ts` 改 import 消费。守卫 `meta-menu-wall.test.ts` 正负两腿成对（常量在册 + 视图 import 消费 / 裸字面退场），**已做变异测试证明能红**（改回内联 ⇒ 1 failed，复原 ⇒ 31 passed）。金样本 sha 未变（值不变，只换来源） |

**⑤ 在途件（不判缺陷）**：`ui_menu_signboard` 未转正双轨（落地单 §5-C4 待拍板）·
选关弹框原型 `levelselect-v1-popup` 仍为草稿（未进运行时）。

### 未覆盖（本轮坦白）

- **六屏出图比对（skill §2 步 7）= 未做**：现包零真机截图（10-19 那批取自**旧包**，按「产物必须同一时点」纪律不可挪用现包）；`harness` 出图只能作实现自证。
- 观感层（`§5` 形状语言 / `§7` 动效气质 / 冷暖对撞）= 无通过线，需 `art-director` 或用户拍板。
- `assets-spec §1` 全量 ↔ `final/assets/` ↔ 运行时资产的逐件对账 = 未做（字节等值层已由 `check:cocos-mask` 覆盖，清单层未逐件核）。

### 本轮判定（上限）

**`CONCERNS`** —— 机械层与版式层零 P0/P1，唯一实质偏差 = F1（P2，文案纪律）；
但**六屏缺现包真机图** ⇒ 按判定上限不得给 `PASS`。解除条件 = 六屏真机截图 + 观感拍板
（并入 `device-walkthrough` Session 4 / 4b 同场执行）。

---

## 第 2 轮 · 2026-10-28（WXG-T-478 · 出图装置 + 骨架层比对）

### 新装置：可复现出图腿（本轮建成）

| 件 | 位置 | 说明 |
|---|---|---|
| 导出钩子 | `games/beads/tests/ui-golden-scenes.ts::buildUiGoldenFrames()` | 复用十一帧金样本态构 `RenderModel`；⛔ 不写 sha、不改覆盖集、不影响 `ui-golden.test.ts` |
| 出图脚本 | `tools/scripts/render-ui-shots.mjs` | 十一帧 → `temp/ui-shot/<stateId>.svg`（与金样本同源同种子 ⇒ 实现自证） |
| 光栅化 | 无头 Chrome `--window-size=750,1334 --screenshot` | ⚠ `qlmanage -t` 只出**正方形缩略图**（长边铺满即裁掉画面下半）⇒ 判图前必须核 `sips -g pixelWidth/pixelHeight` |

### 硬发现 F2 · `P1` 批 1 三页**玩家不可达**

| 项 | 事实 |
|---|---|
| 证据 | `open-album` / `open-local-rank` / `open-profile` 全仓仅出现在 `view/meta-types.ts:248/250/252`（动作联合）与 `game/beads-shell.ts:666/672/678`（`switch` 分支）——**没有任何布局文件发射这些热区 id** |
| 反证 | 探针实测各屏热区表：主菜单 `open-levels/open-rank/start/open-settings/open-skins/open-signin/carousel-prev/carousel-next`；`settings` / `signin` / `skins` / `levels` 均无上述三 id |
| 后果 | 图鉴 / 本地榜 / 名片**有页面、有绘制、有动作分支，但无入口** ⇒ 真机走查无法验、美术还原无法上屏验；`device-walkthrough` D-80（本轮新增条目）当前**不可能被执行** |
| 归属 | 工程（入口接线 = 批 2 或遗漏）；美术侧只需待入口就位后补验 |

### 骨架层比对（harness 出图 ↔ 原型定稿 `proto-v2-full`）

**可判（不依赖胶囊/纹理）**：CTA 位置与尺寸吻合（750 宽设计下 324×92 @x218，落点与原型粉色钮同区）·
棋盘居中、橱窗内白板区层次正确 · 左右轮播箭头两侧对称 · 底左「好友榜」与主 CTA 的相对关系正确。

**不可判（必须真机，本轮不给判定）**：
1. **纹理层全缺**——金样本 rig 用 `NullAssetProvider` ⇒ 招牌木板、橱窗木框/玻璃、贴纸、珠子高光一律不出图；
   而**美术主体恰恰在这一层**。
2. **顶部区几何不作数**——`menuAnchors()` 吃 `capsuleBottomDp`（`tuning/menu.ts:406`），harness 无胶囊 ⇒ 走
   `MENU_TOPBAR_TOP_FALLBACK`。初看「齿轮/公告圆钮压到题字」的差异，**大概率是 fallback 位而非实现缺陷**，
   按 `device-walkthrough §0-4` 不作证据，⛔ 不当 P0 报。
3. `boot` 屏不在金样本十一态内 ⇒ 骨架图也拿不到，只能真机取。

### 本轮判定（更新）

仍为 **`CONCERNS`**，且上限**没有提高**：出图装置只到「骨架层自证」，纹理与顶部区都要真机。
新增 **F2（P1，不可达）** 已转工程；F1（P2）已闭。解除条件不变（六屏真机截图 + 观感拍板），
并新增一条前置：**批 1 三页入口须先接上**，否则 D-80 无法进走查。

**F2 处置（2026-10-28 · WXG-T-479 已闭）**：USER 裁「乙·拆分」——图鉴/本地榜并入选关页底排（与「返回」同行两侧，
207×88、边距 24 / 间隔 24 镜像），名片并入签到弹窗（三钮一行，顺位 名片｜领取｜返回）。九步可达链实证 9/9；
金样本 `level-select`/`level-select-mid`/`signin` 三态按 K-051 登记重抓，其余八态零漂移。
⇒ **`device-walkthrough` D-80 恢复可执行**，但门槛不变：纹理层与顶部区仍须真机，`CONCERNS` 未解除。

---

## 第 3 轮 · 2026-10-28（WXG-T-480 · 资产逐件对账）

**口径**：`final/README.md`「assets/menu 台账」↔ `final/assets/menu/`（原件）↔ `cocos/assets/textures/`（接线件）↔ 产物 `build/wechatgame`。
⚠ `assets-spec §1` **不是文件清单**（是绘制参数卡）⇒ 文件级对账只能以 `final/README.md` 台账为真源，本条修正首轮把 §1 当清单的误用。

| 方向 | 结果 |
|---|---|
| 台账声明的已接线件 → 盘面 | **漏接线 0**：台账 21 件（除 `ui_menu_signboard`）**全部**在 `cocos/assets/textures/` 有同名 `.png + .meta` |
| 在途件 | **1 件**：`ui_menu_signboard.png`（带绳整块版，与「绳不随切图走」旧裁冲突 ⇒ 双轨待 runtime 选型，台账已标 ⏳，⛔ 不算缺陷） |
| 盘面有、台账无 | **0 件**（`tint-mask-asset-spec.md` 专项台账） |
| 台账件数 | **漂移**：README 写「`menu/` 18 件」，盘面实为 **21 件**（含 `ui_menu_cta_label` / `ui_menu_seal_cleared` / `ui_menu_signboard`）⇒ **已闭（WXG-T-481）**：件数改 21 + 补三行台账（`badge_progress`/`seal_cleared`/`cta_label`，来源 `9c553e0c`·WXG-T-282，均已在 `MENU_TEXTURES` → carrier:132-134 接线） |
| 反误报 | 4 个 `{bead,grid}-hole{,less}-tint-128-mask.png` 看似「未入账」，实为 blit 着色管线件，**已入 `design/art/specs/tint-mask-asset-spec.md` + ADR-0030**，消费方 `host/beads-blit-carrier.ts:85-88` ⇒ ⛔ 不报 |

**命名口径差（非缺陷）**：`MENU_TEXTURES` 的 `bitmap__menu_case_frame` 对应文件 `ui_showcase_frame.png`、`plate` ↔ `ui_showcase_plate.png`、`cta`/`ctaPressed` ↔ `ui_btn_start_9s(_pressed)` ⇒ **token 名 ≠ 文件名**，与 skill §6-2「名映射误判」同族，对账时按 id 表查而非按词面匹配。

**判定影响**：资产层 **无 P0/P1**。整体仍 `CONCERNS`（六屏真机图仍未取，纹理层是美术主体）。
