# WebP ↔ PNG 同名双版本 待裁清单（2026-10-18）

> 结论一句话：「一律 PNG」裁定（用户 2026-10-17）在执行层遇到的不是格式问题，而是**同名两件像素不同代次**；
> 用「Cocos 投放件反推父本」这条硬判据一测，**20 件正本面 webp 里 13 件现役真源已可判定 = PNG**，
> 只剩 **1 件（`ui_btn_arrow_bg_pressed`）需人眼裁**。本件不删任何文件，只给判据与对照图。

## 0. 执行状态（2026-10-18 晚，用户裁 A 项收口）

- **已退役 20 件 webp**（A 组 6 + B 组 14）→ 隔离区 `temp/webp-retired-20261018/` 按来源分目录（`final-assets-menu/` · `root-assets-menu/` · `levels-assets/`），**未硬删**（连同上一批共 27 件）。
- **harness `MENU_FILE` 余下 4 处已全部改指 PNG**（logo / badgeProgress / sealCleared / ctaLabel）⇒ 浏览器预览画面自此与上架格式同源。
- **正本面现零 webp**：B-10 已于 2026-10-18 晚裁定（结论 = 内容错件，非现役候选，见 §3 行 B-10 与 **BD-61**）；取证快照 53 件按用户令保持原样。
- 下表为裁定依据与旧读数，保留作史证（判据 = 「投放件反推父本」，⛔ 当作已验结论删行）。

## 1. 裁定链与本批已执行

| 时点 | 裁定 / 动作 |
|---|---|
| 2026-10-13 | 菜单资产规格据「招牌 PNG 558.3 KB → WebP q80 55.5 KB」认 WebP 为交付格式，同批登记**未验证前提**「Cocos 能否吃 webp 无先例 ⇒ 落码前实测」（未消除）。 |
| 2026-10-15 | 包体救援：16 件菜单纹理进主包 4520 KB > 红线 4096 KB ⇒ 11 件 PNG 经编辑器换入 WebP q90（1392 KB→89 KB），主包回落 3206.6 KB。 |
| 2026-10-16（WXG-T-282） | 代码侧确认「微信包内白名单不含 webp」（`games/beads/cocos/assets/scripts/host/beads-blit-carrier.ts:68`）⇒ 投放件回退量化 PNG。 |
| 2026-10-17 | **用户裁定：小程序不支持 WebP ⇒ 设计图到资源图一律 PNG**（`memory/MEMORY.md`、`menu-showcase-asset-spec.md` 交付格式行）。 |
| 2026-10-18（本批，用户三裁） | ① 现役链 7 件转码 + 退役；② 同名双版本**冻结待裁**（即本件）；③ 取证快照保持原样。教训入账 **K-139**。 |

**关键事实（先卸掉包体顾虑）**：运行时/上架链**已经零 WebP**——`cocos/assets/textures/` 24 件全为量化 P 模式 PNG，
`tools/mask-preview/cocos-assets/` 全 PNG。所以「一律 PNG」**不产生包体回弹**，欠账纯在设计正本与浏览器预览面。

## 2. 本批已转换的 7 件（现役链，零冲突）

无同名 PNG ⇒ 可机械转码；`.webp` 解码后逐位重编码（无 resample），**maxΔ = 0 自证**；原件移入
仓根 `temp/webp-retired-20261018/`（gitignore 区，git 侧记为删除，字节可恢复）。

| 件 | webp → PNG | 像素自证 | 引用面改动 |
|---|---|---|---|
| `final/prototypes/proto-v2-full-…-at2x` | 121.3 → 1478.3 KB | ✅ 逐位一致 | `menu-proto-coords.py:12` 输入改 PNG |
| `final/prototypes/proto-v3-{pushing,locked,done,swipe}-…-at2x`（4 张） | 151–203 → 1112–1425 KB | ✅ 逐位一致 | 台账行回写（README / 落地单） |
| `final/assets/menu/asset-icon-coin` | 35.6 → 397.1 KB | ✅ 逐位一致 | `dev/harness/main.ts` `MENU_FILE` 改 PNG |
| `final/assets/menu/asset-icon-stamina` | 16.1 → 146.7 KB | ✅ 逐位一致 | 同上 |

净增 **6.21 MB**（7.10 − 0.89）。**复跑自证**：`levelselect-proto-coords.py` 以新 PNG 为 BASE 重跑，
两张产物 md5 与重跑前**逐字节相同**（原型输出未受影响）。
⚠ `menu-proto-coords.py` **本批故意不重跑**：它的输出是用户已拍板的三态原型，而重跑会读进 §3 待裁的双版本切件 ⇒
裁定前重跑会静默改动拍板画面。

## 3. 同名双版本 20 件：判据与读数

**判据甲（硬）**：Cocos 投放件由设计正本量化而来 ⇒ 把投放件分别与设计侧 PNG / webp 比 RGB 均差，**差小者是父本**。
**判据乙**：alpha 形态是否一致（不透明底 = 旧代次）。**判据丙**：台账「已接运行时」记的是哪一件。

| # | 件（`final/assets/menu/` 除末两行） | 色数 w/p | RGB 均差 w↔p | 距投放件 w/p | 判据甲 | 建议 |
|---|---|---|---|---|---|---|
| B-1 | `ui_menu_logo`（960×772） | 99756/137408 | 3.42 | 4.67/1.98 | **PNG** | 退役 webp |
| B-2 | `ui_menu_cta_label`（964×253） | 22648/24808 | 4.48 | 5.76/2.51 | **PNG** | 退役 webp |
| B-3 | `ui_menu_seal_cleared`（441×610） | 26759/28537 | 5.10 | 5.64/1.55 | **PNG** | 退役 webp |
| B-4 | `ui_icon_mail` | 1876/1809 | 6.07 | 6.22/0.38 | **PNG** | 退役 webp |
| B-5 | `ui_btn_start_9s_pressed` | 4296/2505 | 11.44 | 12.32/1.56 | **PNG** | 退役 webp |
| B-6 | `ui_icon_sound` | 3647/2381 | 13.90 | 14.08/0.46 | **PNG** | 退役 webp |
| B-7 | `ui_icon_settings` | 1505/1096 | 15.02 | 15.08/0.18 | **PNG** | 退役 webp |
| B-8 | `ui_btn_circle_pressed` | 3495/1719 | 15.84 | 16.14/0.59 | **PNG** | 退役 webp |
| B-9 | `ui_btn_circle_normal` | 5584/1874 | 17.23 | 17.50/0.82 | **PNG** | 退役 webp |
| B-10 | `ui_btn_arrow_bg_pressed` | 1064/857 | 20.01 | **10.03/16.39** | **webp** | ❌ **已裁（2026-10-18 晚）：两件都不是「现役候选」——同一量化塌缩的两份产物**（初版误判为「webp 装了 normal 内容」，已订正，见 `test-cases.md §M.11` BD-61 订正块）⇒ 开单 **BD-61**，两件均已退役/重出 |
| B-11 | `ui_menu_badge_locked` | 1992/1152 | 24.56 | 24.99/0.87 | **PNG** | 退役 webp |
| B-12 | `ui_showcase_plate` | 2914/4129 | 3.24 | 4.16/1.72 | **PNG** | 退役 webp |
| B-13 | `assets/menu/ui_menu_logo`（`games/beads/` 根镜像件） | 99756/137408 | 3.42 | 同 B-1 | **PNG** | 与 B-1 同案，一并退役 |
| B-14 | `design/levels/assets/l9-boss-mandala-256` | 6303/4105 | 1.02（**α 均差 173.75**） | **0.00**/1.02 | **PNG（逐字节等值）** | 退役 webp：webp 为 α 全不透明的旧底（投放件与 PNG 的 α 非零占比同为 0.319）；对应「Boss 缩略图黑底透明化」旧案 |

**A 组 6 件（测得仅差有损编码损失，非双版本）**：`ui_btn_start_9s`(2.55) · `ui_menu_badge_progress`(1.46) ·
`ui_btn_arrow_bg_normal`(1.33) · `ui_showcase_frame`(1.07) · `ui_icon_arrow_right`(0.67) · `ui_icon_arrow_left`(0.33)
——均 α 零差、投放件父本同为 PNG ⇒ **PNG 是无损正本，webp 只是它的有损副本，可直接退役，无需逐件目视**。

**对照拼图**（`temp/webp-png-duality-20261018/<件名>-compare.png`，取证件不入库）：三栏 = **webp | PNG | 差值 ×8**，高 420。

## 4. 执行待裁时必须一并处理的两个连带项

1. **harness 仍有 4 处指 webp**（`dev/harness/main.ts` `MENU_FILE`：logo / badgeProgress / sealCleared / ctaLabel）。
   按「PNG 为现役」执行时要同批改指 PNG ⇒ **浏览器预览画面会变**（这 4 件正是 2026-10-17 顶栏总星数实拍签署所见的 webp 版，
   见 `production/qa/beads/evidence/wxg-t-288-s2-star-hud-evidence.md`）。建议改完后**重拍一张顶栏两态**做对屏确认，成本 ≈ 一次 harness 启动。
2. `serve-harness.mjs` 与 `cocos-vision-shot.mjs` 的 MIME 表含 `.webp` 属通用映射，**不必改**（留着不影响「新件不得落 webp」）。

## 5. 不动的 53 件（取证快照）

`design/art/shots/**` 22 件 + `production/qa/menu-b*/**` 31 件：**只经浏览器/读盘复核，不经小程序解码** ⇒ 不受裁定约束；
且换格式会破坏「当时读数对应交付字节」的逐字节复现（K-131 无损基准 + K-053 留痕改裁）。其中 `menu-b19/asset/plate-on-{cream,magenta}.webp`
与同名 PNG **连尺寸都不同**（790×346 vs 844×344），是不同批次产物，更不可互相覆盖。

## 6. 收口结果（2026-10-18 晚·全部裁定完毕）

- ✅ 已按本件判据一次性退役 **19 件**（A 组 6 + B 组 13，含 `ui_menu_logo` 根镜像件与 boss 旧底件），连带 harness 4 处改指 PNG。
- ✅ **B-10 已裁**（原定「唯一需目视」项）：三方对质后结论反转两次——初判「webp 装了 normal 内容（装错文件）」**也是错的**；实测 `octree(正本 pressed)` 与在册投放件**逐像素相等** ⇒ 没人复制错文件，真因 = **RGBA 八叉树量化把 alpha 算进色距，按下态的暗边被塌缩掉**（同族互异保持率 0.13）。⇒ 开单 **BD-61**（`test-cases.md §M.11`，含订正块），新增生成器 `quantize-cocos-textures.py` + 机检门两条判据。
- ✅ **正本面（`design/art/final/**` + `assets/menu/` + `design/levels/assets/`）现零 webp**；全仓在册 webp 仅剩 **53 件史证快照**（按用户令保持原样）。K-139 欠账格式面已闭合。
- ✅ **同类缺陷已有机检门拦截**：`check-cocos-mask.mjs` 现共三条腿——资产侧 ① 归属 ② 同族互异保持率（无产物也跑），产物侧 ③ **源 ↔ 包内件等值**（经 `.meta` uuid 定位）。已入 `pnpm run verify`；**无豁免，纯硬门**。
- ✅ **BD-61 已闭（2026-10-18）**：两件源经生成器重出后，又经编辑器自带 CLI **release 档重建**（`build-cocos.mjs --game=beads --release`，17.1s）⇒ 三条腿全绿、`verify` 22/22（两件共 +0.8 KB，不改判定档位）。本单初版「⛔ 本环境无编辑器」的阻塞断言被实测推翻（同 K-096：环境事实是快照不是现状）。
- 待补确认：换 PNG 后主菜单画面会变（招牌 / CTA 艺术字 / 沙漏章 / 金章飘带四件，变化像素占比 1.9%–15.7%、α 零差），需重拍一张对屏确认——旧签署件 = 2026-10-17 顶栏总星数实拍（`wxg-t-288-s2-star-hud-evidence.md`）。⚠ 2026-10-18 实拍尝试**未拿到画面级证据**：浏览器视图不可见时 `img.decode()` 悬挂 ⇒ 位图腿静默缺席（订正已记入该证据件 §5 第 4/5 行）。
