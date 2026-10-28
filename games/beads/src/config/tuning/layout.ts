// ──────────────────────────────────────── §3.1 canvas, safe area & layout bands
/** Design resolution width (px). */
export const DESIGN_W = 750;
/** Design resolution height (px), portrait. */
export const DESIGN_H = 1334;
/**
 * 逐机**实际设计高**（WXG-T-323 用户裁定：对话框中心 = 手机中心）。
 *
 * `dynamicHeight` 档下 viewport 按屏幅把设计高算到 1334~1630，而各对话框历史上按静态
 * `DESIGN_H` 居中 ⇒ 高屏机整块**偏下** `(H−1334)/2`（畅享 1625 档实测 145.5 设计 px ≈ 屏高 9%）。
 * 本值由 `BeadsShell.init` 与菜单链锚**同点一次写入**（`services.viewport.designHeight`），此后
 * 全程不变 ⇒ 居中只需一个加数，各对话框共用 {@link dialogShiftY}（⛔ 不得回写成各处自算）。
 *
 * ⛔ 热路径不得逐帧改值。真机侧 `App.resize()` 不触发（`_fitToGameCanvas` 无 `document` ⇒ 空转），
 *   故不设运行期失效；若将来 H 可变，随 `menuAnchors` 一起重算并补各面板缓存失效。
 */
let liveDesignH = DESIGN_H;

/** 写入逐机实际设计高（≤0 忽略 ⇒ 维持基准档，位移恒 0）。 */
export function setLiveDesignHeight(designHeight: number): void {
  if (designHeight > 0) liveDesignH = Math.round(designHeight);
}

/** 当前逐机实际设计高（基准档 = `DESIGN_H`）。 */
export function liveDesignHeight(): number {
  return liveDesignH;
}

/**
 * 居中对话框的**底缘位移**（设计 px）= 顶部多出量之半。基准档与更矮档恒 **0** ⇒ 1334 夹具逐字
 * 不变（金样本十态零漂移）；1625 档 = 146。底缘加它 ⇔ 面板中心从 667 移到实际屏中心。
 */
export function dialogShiftY(): number {
  const extra = liveDesignH - DESIGN_H;
  return extra > 0 ? Math.round(extra / 2) : 0;
}
/**
 * Top safe-area fallback (design px). **⚠ 角色 = fallback，不是下限（v1.75）**：真机顶栏位置由
 * `getWindowInfo()` / `getMenuButtonBoundingClientRect()` 的**接口值**决定，本值只在**接口给不出有效值**时
 * 顶上（无 wx 的 harness / node，以及官方明令「部分机型不返回 safeArea 字段」的兼容路径）。
 * 定稿图版面按本档绘制 ⇒ 无接口时与定稿图一致。
 */
export const SAFE_TOP_H = 120;
/** HUD band: settings gear left, timer capsule centre, capsule-avoid right. */
export const HUD_BAND = { yMin: 1214, yMax: 1334 } as const;
/** WeChat capsule avoidance zone (top-right). */
export const CAPSULE_AVOID = { xMin: 560, xMax: 750, yMin: 1214, yMax: 1334 } as const;
/**
 * Bottom safe-area **fallback** (design px) — iOS Home Indicator **34 dp × 750/375 = 68**。
 * ⚠ v1.75：角色 = 接口无效时的兜底值，**不是下限**（真机一切以 `safeAreaBottom` 换算为准）。
 *
 * ⚠ **新增（WXG-T-265 ①iii）**：本仓此前**没有**底部安全常量（breakout 亦无），且现落码最贴底元素
 * = `TRAY_BAND.yMin 216`（距画布底 216 ≫ 68；**v1.97 同步：旧写 230**）⇒ **本值是预防性兜底，不是补漏**；它存在的意义是
 * 「贴底元素以后会加（广告条 / 底部工具条）」且接口拿不到值时，不再走顶部 120 的老路（无推导写死）。
 *
 * 取 68 的推导（后人可重算）：Home Indicator 高 **iOS 全机型恒定 34 dp**（非刘海机 = 0），
 * `FIT_MODE = FIXED_WIDTH` ⇒ 设计 px = dp × 750/屏宽dp ⇒ 最窄全面屏档 375 dp 时最大 = **68**，
 * 屏越宽换算值越小（430 dp → 59，**真机走接口就得 59，本值不再参与**）。
 * **Android 三键导航栏 48 dp ⇒ 100 设计 px** ⇒ 底部遮挡本质上逐机变化，只可能从接口拿。
 * 已登 `systems-index §3.1`（**v1.74 新增值 · v1.75 改注角色**，与顶栏 `SAFE_TOP_H` 同构）。
 */
export const SAFE_BOTTOM_H = 68;
/**
 * Edge-avoidance margin (design px)。沿用既存顶栏口径 `124 = SAFE_TOP_H + 4` ⇒ **零新发明**，
 * 上批已用该 4 px（`menu-architecture.md §5.1b-2`）。
 */
export const SAFE_EDGE_MARGIN = 4;

/**
 * 导航栏（UI-23）机制默认值：图标键边长 / 控件间距（设计 px）。
 *
 * ⚠ 迁移期无消费面（UI-25 总装才接线），暂不入 `systems-index §3`；
 *   接线时按 tokens 定稿校准，届时补冻结登记。
 */
export const NAV_BAR_ICON = 56;
export const NAV_BAR_GAP = 8;

/**
 * 单边安全偏移（**设计 px**，自屏幕边缘向内）= **接口值优先**；接口给不出有效值才用 fallback。
 *
 * **纯函数**：只接三个数，不 import `cc` / `wx` / DOM（L2/L3 ⇒ 可在 Node 单测直接跑）。
 * 顶/底**共用同一算式**，不留第二份换算（判例 = `menu-signage::signBands` 与绘制共用算式）。
 *
 * ⚠ **v1.75 改语义**：旧式 `max(floor, 接口换算)` 会让**静态宏在真机上也赢过接口**（非刘海档胶囊底
 * 112 被 120 顶到 124；Pro Max 底部换算 59 被 68 顶到 72）⇒ 等于宏当家，已撤回。现式：**接口 > 0 就只信接口**。
 *
 * | 边 | `edgeDp` 取什（**全部来自小程序接口**） | 拿不到时的 fallback | 逐机结果（设计 px） |
 * |---|---|---|---|
 * | 顶 | `getMenuButtonBoundingClientRect().bottom`（胶囊底缘，**吞点击硬约束**） | `SAFE_TOP_H` | 116（非刘海）/ 137（Android）/ 164（X–14）/ 176（灵动岛）/ 161（Pro Max） |
 * | 底 | `PlatformInfo.safeAreaBottom`（= `windowHeight − safeArea.bottom`，**窗口底基准** · WXG-T-447） | `SAFE_BOTTOM_H` | 72（34 dp @375）/ **63**（@430）/ 104（Android 三键）/ 72（inset 0 → fallback） |
 *
 * **fallback 触发条件 = `edgeDp ≤ 0` 或 `windowWidthDp ≤ 0`**（含 NaN）。这一条同时兜住三种现实：
 * ① web / node 无 wx；② 官方兼容点「部分机型不返回 safeArea」（框架此时给 0）；
 * ③ **Android `targetSdkVersion` 35/36 社区实测 `safeArea` 虚报**（bottom == screenHeight ⇒ inset 算成 0）
 * ⇒ 脏值走 fallback，**不会**把控件贴到屏幕边。不返回 0、不出 NaN。
 *
 * @param edgeDp        该边遮挡深度（**屏幕逻辑 px / dp**，接口原值，不是设计 px）。
 * @param windowWidthDp 屏幕宽（dp），`getWindowInfo().windowWidth`；`FIXED_WIDTH` 下的换算分母。
 * @param fallbackH     该边静态兜底值（设计 px），**仅接口无效时生效**。
 */
export function safeEdgeInset(edgeDp: number, windowWidthDp: number, fallbackH: number): number {
  const interfaceOk = edgeDp > 0 && windowWidthDp > 0;
  const designPx = interfaceOk ? Math.round(edgeDp * (DESIGN_W / windowWidthDp)) : fallbackH;
  return designPx + SAFE_EDGE_MARGIN;
}

// ─────────── 顶栏三钮（`menu-architecture §5.1b` 2026-10-13 用户裁定 · 版面派生值，⛔ 不进 §3）
/**
 * 顶栏热区**顶缘自顶**深度（设计 px）= 胶囊底缘接口值换算 + 余量。
 * 两个入参全部来自小程序接口（`PlatformInfo.capsuleBottomDp` / `viewport.fit.screenWidth`），
 * `null`（web / node / 无该 API）⇒ 走 `SAFE_TOP_H` 兜底 ⇒ **harness 与定稿图版面一致**。
 * ⛔ 不在本函数里 `max` 静态带（判例 K-124）。
 */
export function menuTopbarTop(capsuleBottomDp: number | null, windowWidthDp: number): number {
  return safeEdgeInset(capsuleBottomDp ?? 0, windowWidthDp, SAFE_TOP_H);
}
/**
 * 顶栏深度**兜底档** = 124（= `SAFE_TOP_H + SAFE_EDGE_MARGIN`）= 定稿图版面基准。
 * 供无平台接口可读的场合（单测查版面、未 `init` 的 shell）显式取用，⛔ 不得当真机值。
 */
export const MENU_TOPBAR_TOP_FALLBACK = SAFE_TOP_H + SAFE_EDGE_MARGIN;
/**
 * 三颗热区**左缘** x（热区尺寸 = `TOUCH_MIN` 88，不新常量）。逐档实测依据 = §5.1b 落位表：
 * 左上那颗不受胶囊约束（x∈[24,112] 在定稿图内非背景占比 0.00%）；右上两颗按 **pitch = 88**
 * 排（定稿图视觉 pitch 70 ⇒ 两热区会重叠 18 px 误触），外颗右缘 736 ⇒ 距屏边 14。
 *
 * `[WXG-T-365]` 中档由预留位 `notice` 升格为 `skins`（装扮馆入口 = 提案 P4-甲，正本
 * `design/proposals/main-menu-entry-strategy.md` §P4-甲）⇒ **坐标零改动**，只换语义；
 * 代价 = 公告位被占用（提案已列，回滚 = 键名与一颗钮改回预留空圆）。图标暂用该位原
 * 有的 `MENU_TEXTURES.iconSound`（喇叭）顶替 ⇒ `[待 UI 设计]`，见 `meta-view::drawTopbar`。
 */
export const MENU_TOPBAR_X = { settings: 24, skins: 24, mail: 648 } as const;
/**
 * 顶栏**第二行**下移量（`WXG-T-486`，用户 2026-10-28 裁「右侧按钮可以放到左侧第二个布局」）：
 * `skins` 自 `x560` 改挂左侧第二枚（设置正下方），行距 = `TOUCH_MIN`（88，热区边贴边）。
 *
 * 动机 = art-review P1-3：`x560` 与招牌框右界 `190+370=560` **净空 0**（边界相切），出图上
 * 「拼豆小铺」第 4 字右端被该钮圆形压住。改挂左列后：两枚左钮右缘 112 < 招牌左界 190（净空 78），
 * `mail` 仍 `x648` > 560（净空 88）⇒ 招牌左右两侧同时净空为正。
 *
 * ⚠ 左列两枚的 `settings` 仍在第一行、`mail` 仍在右上第一行 —— 顶栏由「一排三枚」变「左列两枚 + 右上单枚」。
 */
export const MENU_TOPBAR_ROW2_DY = 88;
/**
 * 顶栏视觉圆直径 = 80（落地单 v3.5，用户 2026-10-15 裁：`ui_btn_circle_*` 与三枚 `ui_icon_*` 同为
 * 160×160 px @2x ⇒ 80 设计 px；旧 59/64 作废）。热区 88 同心包裹（视觉比热区小 8，邻钮视觉隙 8）。
 */
export const MENU_TOPBAR_VISUAL_D = 80;
/**
 * 签到信封「未领」小圆点半径（2026-10-22 用户裁：`canClaim` 时信封右上画 1 枚，**全局唯一提示位**
 * ——不铺红点、不闪烁）。Ø18 ≈ 图标 40 的 45%，压在视觉圆（Ø80）右上 45° 内缘，色读 `palette.danger`
 * （既有 token，零新 hex）。
 */
export const MENU_SIGNIN_DOT_R = 9;
/** Puzzle band — the pattern matrix is centred inside it (both axes).
 *
 * ⚠ **§3.1 换尺（本轮用户拍板）：下沿 480 → 560**（带高 640 → 560）。动的理由只有一个：
 * 底部要给缩放控件条让出 **合规 88 热区**（§3.8 C1 / `TOUCH_MIN`）且**不与任何可点元素抢**。
 * 旧布局下「盘面下沿 480 → 托盘槽热区顶 444」只有 36px（含放大态热区下探则 ≤ 23px），
 * 88 无论如何放不下 ⇒ 只能从盘带让高。
 * ⚙ **取值 560 而不是 568 的理由（用户选定）**：可用区间为 `yMin ∈ [552, 562]`（下界 =
 * 控件条底沿不得碰托盘槽热区 444，上界 = `r_max` 须仍 ≥ 16 行）⇒ 取中值 560 同时保住
 * **顶格档 16 行**与热区，代价是控件条底与槽热区只剩 **8px** 富余（旧取 568 为 16px）⇒ `[待真机]`。
 * **连带（实测，非推定）**：`r_max` 18 → **16**；关卡池 6 尺寸（12×16 / 8×15 / 14×14 /
 * 10×14 / 14×13 / 14×12）**全部仍 fit=1**（最大盘 12×16：`natH=510 ≤ 560−48=512`）⇒ **零缩放代价**。
 * ⚙ 真源回写 = `design/gdd/systems-index.md §3.1/§3.3` + 变更单（与代码同批，非事后补票）。
 */
export const PUZZLE_BAND = { yMin: 560, yMax: 1120 } as const;
/** Tray band (white rounded panel). **§3.1 v1.97（WXG-T-459）**：下沿 230→216 —— v1.24 冻结的
 * 4 行扩展态（panelH 234）必须完整落带（推导见 design/proposals/tray-24-layout-derivation.md，
 * 变更单 `design/proposals/sec3-tray-band-216-change.md`）。⚠️ 号位勘误：旧注释写「v1.25」，
 * 该号已由 `REVIVE_BONUS_SEC` 占用 ⇒ 本改判实际登记于 **v1.97**。
 * 基础态 2 行（panelH 120，y∈[330,450]）与 `btn_expand` 热区净空随按钮整体 −14 ⇒ 12→**26px**。 */
export const TRAY_BAND = { yMin: 216, yMax: 450 } as const;
/** Powerup band (3 white cards — S6 landed in WXG-T-060). */
