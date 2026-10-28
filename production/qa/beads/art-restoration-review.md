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
