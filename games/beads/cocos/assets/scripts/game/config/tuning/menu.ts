import { ARCS } from '../arcs';
import { BEAD_CELL, BEAD_GAP, TOUCH_MIN } from './board';
import { DESIGN_H, DESIGN_W, MENU_TOPBAR_VISUAL_D, SAFE_BOTTOM_H, SAFE_TOP_H, menuTopbarTop } from './layout';
import { BEAD_DRAW_INSET } from './visual';

// ─────────────────────────────────────────────────────── §3.6b finish screen
/**
 * S7 通关画面（FINISH）几何。`ux-spec §3.6` 只给「全屏庆祝 + 星级总览（8 关星数和）
 * + 去冲刺 + 重玩第 1 关」一句话，**未给几何** ⇒ 本组是**派生常量**（沿用结算面板
 * 的常量族与设计空间约定），登记于台账。
 */
/** 总览每行高度。 */
export const FINISH_ROW_H = 64;
/** 总览行间距。 */
export const FINISH_ROW_GAP = 12;
/** 总览每行宽度（居中，含标签与 3 颗星）。 */
export const FINISH_ROW_W = 540;
/** 总览星尺寸（小于结算行的 `CLEAR_STAR_SIZE`，8 行竖列需紧凑）。 */
export const FINISH_STAR_SIZE = 34;
/** 总览行内星间距。 */
export const FINISH_STAR_GAP = 8;
/**
 * 总览**逐关**入场步长。`ux-spec §5` 的「逐颗 150ms」是结算行 3 颗的时序；
 * 总览最多 8×3 = 24 颗，逐颗要 3.6s ✗ ⇒ 改为逐关 150ms（8 关 = 1.2s），
 * 同一关的 3 颗同时入场（派生项，登记台账）。
 */
export const FINISH_LEVEL_STEP_MS = 150;
/**
 * S7 作品陈列条（EP12-S7 · screens.md S5「格 ≤160 见方、条宽 ≤560、落在彩带禁飞带外」）。
 * 条落在**总览末行与按钮行之间**的净空带（9 关档 ≈ 104 高 ⇒ 格 ≈ 53）；格边 = min(上限, 宽分, 高分)。
 * 派生版面值，⛔ 不进 §3。
 */
export const FINISH_SHELF = { w: 560, cellMax: 160, gap: 8, pad: 8, margin: 12 } as const;


// ──────────────────── §3.8 S9 暂停面板几何（来源：ux-spec §3.3 线框，本篇不派生）
/** Pause settings gear hit area — a TOUCH_MIN square anchored left in HUD_BAND. */
export const GEAR_HIT_SIZE = TOUCH_MIN;
/** Panel size: 560 × 480 (`panel_dialog`, ux-spec §3.3；结算/过关面板共底板). */
export const PANEL_SIZE = { w: 560, h: 480 } as const;
/**
 * 暂停面板专有高度（WXG-T-164 批0 由 480 扩至 600 容第 4 行 → **WXG-T-211-S5 扩至 718 容第 5 行**）。
 * 上位裁 = S9 v1.7 **Q2 = 甲「扩行」**（行4 =「珠子风格 / 豆子尺寸」两格，行5 =「性能信息 / 回主菜单」
 * 两格**原样下移**、语义与动作零改动）；ux §3.3「几何」条的 `PAUSE_PANEL_H` `[待定]` **由本值回填**
 * （S9 §5 授权「按行高地板 `TOUCH_MIN` 实测回填」，GDD/UX 两份正本都不钉值 ⇒ 本行即唯一真源）。
 * 不污染共享的 `PANEL_SIZE`（结算/失败/通关面板冻结几何不变）。
 *
 * **实算**（行高地板 `TOUCH_MIN = 88`，`PANEL_ROW_GAP = 30`，标题带 100）：
 *   自然高 = 100 + 5×88 + 4×30 = **660**；再加 **58 底衬**（= 四行时 600 − 542 的同一底衬值，
 *   行距与底衬**零改动**、只增一行）⇒ **718**。
 * **避让复核**（S9 §8-5，沿旧判据）：plate `yMax = (1334 + 718) / 2 = 1026 < CAPSULE_AVOID.yMin 1214`
 * ⇒ 不侵入微信胶囊区；`yMin = 308 > TRAY_BAND.yMax 450`？—— 否：308 < 450 ⇒ 面板**盖住托盘带**，
 *   这正是遮罩「防偷看」的既有语义（遮罩覆盖棋盘与托盘，ux §3.3），非新代价；行5 底 `366` 与
 *   plate 底 `308` 之间即那 58px 底衬，逐行间距 = 现行算式（`pause-panel.ts` 五行同一条链）。
 * 行重叠 / 避让的最终结论仍由 `tests/pause-settings.test.ts` 的 §8-5 腿跑实测（本注只登记算式）。 */
export const PAUSE_PANEL_H = 718;
/** Scrim over board+tray: rgba(42,46,67,0.5) (ux-spec §3.3). */
export const PANEL_SCRIM_RGB = { r: 42, g: 46, b: 67 } as const;
export const PANEL_SCRIM_ALPHA = 0.5;
/**
 * **设置态**背景遮罩 α（WXG-T-211-S5 / ux §3.3「遮罩」条，裁 = **丙案**（U14 已改丙）：
 * 面板含行4（珠子风格 / 豆子尺寸）的**设置态期间下调遮罩**，让玩家实时看见自己改档的效果）。
 * ⚠️ **[暂定·待 PT-SKIN-01 真机校准]**：ux ① 明文「具体 α 值本文不钉 `[待定]`、由落码单实测回填」
 * ⇒ 本行即落码回填位，取值依据 = 任务单已裁「**初值 0.3**（从 0.5 下调、非 0）」，
 *   同时守住 ux ②「下调不得为 0」（仍保住面板与背板的对比度下限，可辨程度 `[待真机]`）。
 * **射程（本批准入的两处，其余零改动）**：① 暂停面板 scrim（`view-model::drawPausePanel`）
 *   ② 菜单**设置** overlay scrim（`meta-view` 且**仅 `overlay === 'settings'`**；签到 / 选关
 *   overlay 不属设置态 ⇒ 恒读 `PANEL_SCRIM_ALPHA`）。**结算 / 失败 / 通关 / 冲刺结算四类面板
 *   继续读 `PANEL_SCRIM_ALPHA` 零改动**（ux ⑥「不得从本行读出全局遮罩变浅」）。
 * **RGB 三通道零改动**（面板侧仍 = `PANEL_SCRIM_RGB`；⚠ 登记既有不同源事实：菜单 overlay 的
 * scrim 一直硬编 `rgba(0,0,0,·)`，本批**只换 α 不洗 RGB**——洗 RGB 就是 ux ① 的「RGB 零改动」违例）。
 * **零新增毫秒值、§5 动效表零新行**；「防误触」不受影响（拦截由 §4 状态门禁保证，与 α 无因果）；
 * 「防偷看」语义弱化 = ux ④ **已接受代价**，不辩护。
 * **设置态判定所取（回传已注明）**：任务单已裁「两入口都算设置态」⇒ 判定面 = **overlay 打开期间**，
 *   暂停面板可见期间即设置态（暂停面板自身承担设置职，内容单源 S9），不引入第三种「子态」。 */
export const SETTINGS_SCRIM_ALPHA = 0.3;
/**
 * `[WXG-T-443]` **抬起容差**：「按下 → 抬起」之间手指在同一颗钮上漂出框仍算点中。
 *
 * 88 高的钮在真机 ≡ 44 css px，拇指下飘 10–20 css px 属常态 ⇒ 旧口径（抬手必须**精确**命中
 * 同一个盒）表现为「点上了却没反应」。`[WXG-T-450]` 改**屏幕尺度**：真机手感必须按手指实际
 * 移动量（css px）定，不能按设计 px 定 —— 16 设计 px 在 375 宽机只折 8.3 css px（太紧），
 * 在 430 宽机折 9.2；**12 css px** 与 Android `touch slop` 同量级，各档机型恒定。
 * ⛔ 只对**已登记的那颗钮**做外扩容差，不做跨钮宽容命中（顶栏三钮 pitch = `TOUCH_MIN`，放宽下行面互抢）。
 * 折算在消费点做：`slopDesign = TAP_SLOP_CSS / viewport.fit.scale`（design = css / scale）。
 */
export const TAP_SLOP_CSS = 12;

/** Panel button height — every row honours the TOUCH_MIN control floor (§3.8). */
export const PANEL_BUTTON_H = TOUCH_MIN;
/** Primary button ("继续") width (ux-spec §3.3: 240×88 主钮). */
export const PANEL_PRIMARY_W = 240;
/** Inner horizontal padding inside the panel. */
export const PANEL_PADDING = 20;
/** Vertical gap between panel rows. */
export const PANEL_ROW_GAP = 30;
/** Vertical space reserved above the primary row for the title band. */
export const PANEL_TITLE_BAND_H = 100;

// ─────────── §3.8-companion 结算·过关面板几何（来源：ux-spec §3.4 线框）
// 面板本体复用 `panel_dialog`（560×480）与 `PANEL_PADDING` / `PANEL_ROW_GAP`；
// 只有星与按钮的排布是本面板专有。
/** 每颗星入场的间隔（ms）—— ux-spec §5「结算星入场 逐颗 150ms（150×3）」。 */
export const CLEAR_STAR_STEP_MS = 150;
/** 单颗星的外接直径：ux-spec §3.4 未定尺寸 ⇒ 本项派生（三颗等距排在面板中部）。 */
export const CLEAR_STAR_SIZE = 72;
/** 星与星的水平间隔。 */
export const CLEAR_STAR_GAP = 32;

/** `[WXG-T-510]` 结算面板专用尺寸（A2 木挂牌；其他三面板仍用共享 `PANEL_SIZE`）。 */
export const CLEAR_PANEL_SIZE = { w: 520, h: 470 } as const;
/** `[WXG-T-509/510]` 结算双钮：主 300×92（木）/ 弱化 150×88（纸）。 */
export const CLEAR_ACTION_W = 300;
export const CLEAR_ACTION_H = 92;
export const CLEAR_SECONDARY_W = 150;
export const CLEAR_SECONDARY_H = 88;
/** `[WXG-T-510]` A2 标题木挂牌：200×64，骑在面板上沿。 */
export const CLEAR_PLAQUE_W = 200;
export const CLEAR_PLAQUE_H = 64;
/** 主/副钮宽度：240 + 30 + 240 = 510 ≤ 560 − 2×20（面板内边距）⇒ 可并排落地（通关/冲刺面板）。 */
export const CLEAR_BUTTON_W = PANEL_PRIMARY_W;
export const CLEAR_BUTTON_GAP = 30;

// ─────────────────────── 面板动效（来源：ux-spec §5「面板入 / 出 200 / 150」）
/** Panel enter animation duration (ms). */
export const PANEL_IN_MS = 200;
/** Panel exit animation duration (ms). */
export const PANEL_OUT_MS = 150;
/** Enter scale start → 1.0 (ux-spec §5: scale 0.9→1.0). */
export const PANEL_SCALE_FROM = 0.9;

// ══════════════ §3.8 / §3.14 meta 冻结常量镜像（真源：systems-index v1.28） ══════════════

/** §3.8 震动默认值：VIBRATE_DEFAULT = ON（用户 2026-09-18 拍板⑦）。 */
export const VIBRATE_DEFAULT = true;

/** §3.14 体力上限（宽容包 B：8 心）。 */
export const STAMINA_MAX = 8;
/** §3.14 体力恢复速率：8 分钟/心（离线恢复 f(Δt wallClock)，登录时钳上限）。 */
export const STAMINA_REGEN_MIN_MS = 8 * 60 * 1000;
/** §3.14 开局扣心：新局开局/重试各扣 1（PAUSED 恢复与菜单在途续进不重复扣）。 */
export const STAMINA_START_COST = 1;

/**
 * §3.14 v1.80（WXG-T-351，用户 2026-10-22 拍板）：广告加心**固定数量**（原「回满至
 * `STAMINA_MAX`」已废）。钳上限、**溢出即弃**（与签到送心同口径）；锚点**不重置**
 * （奖励不吃掉玩家已累积的恢复进度）。
 *
 * 3 = 8 分钟/心 × 3 = 24 分钟「时间等价」，落在品类惯例 20–30 分钟区间中位。
 */
export const HEART_AD_GAIN = 3;
/** §3.14 v1.80：广告加心**每日上限**（跨日按本地 `YYYY-M-D` 归零；满心不计次）。 */
export const HEART_AD_DAILY_LIMIT = 5;

/**
 * §3.14 签到奖励表（MF5 循环制：day cell = claims % 7，断签不清零）。
 * 冻结面只有第 3/5 天各 1 心（溢出即弃）；币数额**不冻结**（playtest 调参位）。
 */
export const SIGNIN_REWARDS: readonly { coins: number; hearts: number }[] = [
  { coins: 20, hearts: 0 },
  { coins: 30, hearts: 0 },
  { coins: 30, hearts: 1 },
  { coins: 40, hearts: 0 },
  { coins: 40, hearts: 1 },
  { coins: 60, hearts: 0 },
  { coins: 100, hearts: 0 },
];

// ─────────────────────── 结算按星发豆（§3.14 获取源「通关首通」落码；用户 2026-10-26 拍板）
/**
 * **首通奖励（按档、每档只发一次）**：索引 = `stars - 1`（1★/2★/3★），普通关 / Boss 关各自一组。
 *
 * ⚠ **发放 = 逐档累计，不是只看本次那一档**（用户 2026-10-26：「每个星级首通的奖励只会发放一次」）：
 * 直接 3★ 首通 ⇒ ★☆☆ 20 + ★★☆ 30 + ★★★ 40 = **90**（Boss 40+60+80 = **180**）；
 * 「先 1★ 后升 3★」⇒ 20 + 70 = 90（⛔ 同样总额，不存在先手生就永久少拿）。
 * 单关首通池上限 = 90 / 180；一章 9 普通 + 1 Boss 全满星 = 810 + 180 = **990**。
 * ⚠ v1.92 曾压到 660（单价减半），用户 2026-10-26 撤回：「~~990 → 660~~ 不需要，或者皮肤价格降低」
 * ⇒ **产出不砍，紧平衡改由皮肤定价达成**（见 §3.14 v1.93）。
 */
export const CLEAR_COIN_FIRST: readonly number[] = [20, 30, 40];
export const CLEAR_COIN_FIRST_BOSS: readonly number[] = [40, 60, 80];
/** **复刷奖励**（已通关过）：普通 / Boss。用户 2026-10-26：「每盘奖励还是恢复到 5/10」。 */
export const CLEAR_COIN_REPLAY_NORMAL = 5;
export const CLEAR_COIN_REPLAY_BOSS = 10;
/**
 * **超日上限后的安慰奖**（普通 / Boss）—— ⛔ 不清零（用户 2026-10-26 拍板「柔和，非硬顶」），
 * 但只有 1/2，且结算页必须写明「今日复刷已达上限」，否则玩家看不出为什么变少。
 */
export const CLEAR_COIN_REPLAY_CAPPED_NORMAL = 1;
export const CLEAR_COIN_REPLAY_CAPPED_BOSS = 2;
/**
 * 复刷日上限 = 签到日均 `320 / 7 ≈ 45.7` 取整 **45**（用户 2026-10-26 拍板「与签到一致」）。
 * 普通关 5🪙 ⇒ 9 盘到顶；Boss 10🪙 ⇒ 4.5 盘。按本地日期键（`dateKey`）归零，与签到同口径。
 */
export const CLEAR_COIN_REPLAY_DAILY_CAP = 45;

/**
 * §3.14 买心阶梯价（钱包 A 包）。**不冻结**——待 playtest 调参（systems-index
 * §3.14 明文「阶梯价不冻结」）；第 n 次购买（当日计数）取 `ladder[min(n, len-1)]`。
 *
 * @deprecated §3.14 v1.80（WXG-T-351）：豆子买心**下线**（改纯广告加心），
 * `MetaState.buyHeart()` 降为内部 API、UI 不得接 ⇒ 本常量**保留不删**（§3.14 明写），
 * 仅供 `MetaState.heartPrice` 与单测、旧调用；值本身仍未冻结 `[待 playtest]`
 * （判例 `SPRINT_K_CURVE`）。
 */
export const HEART_PRICE_LADDER: readonly number[] = [50, 100, 200];

/**
 * 皮肤买断价（§3.7 v1.83「外观 = 金币买断」，用户 2026-10-23 令「换皮肤也用豆子吧」）。
 * 形状先例 = {@link BEAD_STYLE_LABELS}（按 skinId 建表），⛔ 不拿注册序当下标
 * （注册序 = 玩家可见循环序，随手 append 会同时改价格 ⇒ 双错）。
 *
 * **未列入本表的 skinId = 不可购买**（`MetaState.buySkin` 直接拒），而非 0 价免费 ⇒
 * 新肤入注册表时必须同批在此加一档，否则玩家侧表现为「买不了」而不是「白送」。
 * 默认肤不靠本表获得，走存档初值 `ownedSkinIds = [DEFAULT_SKIN_ID]`（⛔ 不回收）。
 *
 * ⚠ 数值仍为 `[提案·Q3 待拍板]`，**不入 §3 冻结**（判例 `SPRINT_K_CURVE`：先落 tuning 可调参位）。
 * 150 = 提案 §4.1 首档（按 P1 稳态 ≈116🪙/天 = 约 1.3 天结余）；⚠ 但 P1 产出腿未落码，
 * 当下唯一产出 = 签到 ≈45.7🪙/天（§6.1）⇒ 实际到达第 3–4 天，需随首通币/每日任务一起看读数。
 */
export const SKIN_PRICES_COINS: Readonly<Record<string, number>> = Object.freeze({
  'cool-violet': 150,
});

/**
 * 装扮馆卡外框高（**WXG-T-363** · ux-spec v1.25 §3.8）。版面派生值 ⇒ ⛔ 不进 §3
 * （判例同 `SETTINGS_GRID` / `LEVELS_*`）。
 * 300 = 卡面两行内容（`skins-content` 的 2×40 行高 + 2×24 内缩 + 12 行距 = 152）
 * + 148 余量（留给真美术预览图位 `[待 art]`）。
 */
export const SKINS_CARD_H = 300;
/**
 * 卡顶缘自底板顶缘下缩（同上正本）。82 ⇒ 卡上缘 945，与设置弹窗「标题下缘 957 / 净空 12」
 * 同一避让口径（`meta-view::settingsLayout` 注）；卡下缘 645 > 返回钮上缘 445 ⇒ 净空 200。
 * ⚠ 底板高 720 不改，注册肤数 > `SETTINGS_GRID.cols`（第二行）会压进返回钮带 ⇒ 届时改卡高或转整页。
 */
export const SKINS_CARD_TOP_INSET = 82;

// ─────────── 主菜单（shell 屏）几何（来源：ux-spec v1.7 §2 流程 + meta-ui 线框；
//             EP12-S6 版面族扩充，来源 `menu-architecture.md §5.1/§7.4`——**派生版面值，⛔ 不进 §3**）
/** 主菜单主钮「开始游戏」宽 = mock 框 324（落地单 v3.5，用户 2026-10-15 裁；旧 320 作废）。 */
export const MENU_PRIMARY_W = 324;
/** 主菜单主钮左缘 x = mock 框 218（与橱窗/Boss 位同一套 mock 坐标，⛔ 不再按 750 居中重算）。 */
export const MENU_CTA_X = 218;
// 2026-10-13 用户裁定第二批：底部次级行（签到 / 设置纸钮）**整行退役** ⇒
// `MENU_SECONDARY_W` / `MENU_ROW_GAP` / `MENU_SECONDARY_GAP` 三常量零消费者已删
//（设置改左上顶栏圆钮，签到待信箱实装；`menu-architecture §5.1/§5.1b` 留档，需重建时读那里）。
// **第十四批静态锚（`MENU_TITLE_Y`/`MENU_SLOGAN_Y`/`MENU_PRIMARY_Y`/`MENU_VERSION_Y`）已随
// [WXG-T-280] 锚定档唯一整体退场**（零生产消费者；历史坐标与推导读 git 史 / 落地单 §6）。

// ─────────── 主菜单落位链（**WXG-T-280**；唯一施工依据 = `design/art/specs/menu-layout-implementation-spec.md` v3.4 §1–§2）
//   菜单几何自此**只有一套**：旧第十四批静态值（SE 档快照）已删，真值恒由 {@link menuAnchors}
//   逐机输出（系高 H 随 Viewport 动态档，⛔ 禁钉 1334）。
//   ⛔ 不进 systems-index §3（菜单屏版面派生值，判例同 `WALL_*`/`MENU_*` flat 命名；指针登记见落地单 §6 条 5）。
// ─────────── 主菜单落位链常量（真值算式见文件末尾 {@link menuAnchors}）
/** 顶隙（st → 结顶，已含边距语义 ⇒ 裸换算，⛔ 不再 +`SAFE_EDGE_MARGIN`，落地单 §1 防双加注）。 */
export const MENU_CHAIN_GAP_TOP = 16;
/**
 * 无刘海 / 无灵动岛时结顶距屏顶的下限（设计 px）。= 加长前的绳长：结顶至少这么远，原图那段绳子才完整露出。
 * 加长段只服务安全区更深的机型（灵动岛结顶 119，绳要接到屏顶），浅档多出来的绳允许被屏顶裁掉。
 */
export const MENU_BOW_MIN_FROM_TOP = 61;
/** 底隙（CTA 底缘 → safeBottom 上缘，同上已含边距）。 */
export const MENU_CHAIN_GAP_BOTTOM = 32;
/**
 * 招牌链高：结顶 `bow0` → 板底 `sign1`。v3.7 图内结顶 y=159、板底 y=586，等比 370/960 后链高 ≈ 165。
 * v3.9 只在图顶加了 150px 绳子，结与板的图内间距不变，链高仍是 165。
 */
export const MENU_SIGN_CHAIN_H = 165;
/**
 * 资源条体高。v3.9（用户 2026-10-16「太高、不能超过背景板」）：46 的顶缘探出橱窗木纹
 * （框图顶约 5px 透明 + 描边 3 居中）。顶板木纹厚约 22，但数值字是 28 的地板，条高收到 32 才能把字包住。
 */
export const MENU_BAR_H = 32;
/**
 * 条顶相对橱窗图框下移。框顶木盖约在图内 4–27px（亮面在上、立面在下）。
 * 7 时条顶还压在盖的亮面上，看起来骑在框外。14 让亮面留在条上方，条身嵌进上沿立面。
 */
export const MENU_BAR_TOP_INSET = 14;
/** 橱窗高（含楣，v3.3 裁定**恒定不拉伸**）。 */
export const MENU_CASE_H = 871;
/**
 * 纵向堆叠组高 = 橱窗 871。⚠ v3.6（用户 2026-10-15）：资源条**嵌在橱窗顶部**（覆盖楣的上 46 px），
 * 不再占堆叠高度；v3.4 的「条 46 + 缝 0 + 窗 871 = 917」作废。不变式 ⑤a 改为 `bar 顶 == case 顶`。
 */
export const MENU_CASE_GROUP_H = MENU_CASE_H;
/** 自由区分隙：组上隙 = (zone − 917)/3、下隙 = 2×上隙（柜隙上:下 = 1:2，v3.3 裁定迁整组口径）。 */
export const MENU_CASE_GAP_RATIO = 2;
/** 走马灯卡 / ◀▶ 圆心的窗内纵向分割（定稿实测：顶 = case0 + 0.42×871 + 卡半高）。 */
export const MENU_CASE_SPLIT = 0.42;
/**
 * CTA 视觉高（mock 实测框 324×92）。⚠ 热区仍 = `TOUCH_MIN` 88（同心）⇒ 视觉/热区差 4
 * 属落地单 §3 登记漂移（「高 92 或维持 88 开工时定」本批取 92：五档验收账即按此算）。
 */
export const MENU_CTA_H = 92;
/** Δ12 只作组隙下限（五档最小 gap_top = 39 ✓）⇒ 复用在册 `SIGN_BAND_PAD`，零新常量。 */

/**
 * 招牌整块（`ui_menu_logo`，含绳）图框：370×298 @x190（居中），**等比**（960×772 × 370/960）。
 * v3.9（用户 2026-10-16）：绳向上加长 150px（622→772），灵动岛档结顶 119 时绳顶接到屏顶。
 * `bowYOff` = 图顶到结顶（图内 y=309 → 119）。`boardCyOff` = 图顶到板心（图内 y≈560 → 216），无位图时字样居中。
 * 板体图内 x[11,948] 未动 ⇒ 绘制右缘 ≈ 556，与公告钮视觉左缘 564 留 8。
 */
export const MENU_SIGN_FRAME = { x: 190, w: 370, h: 298, bowYOff: 119, boardCyOff: 216 } as const;
/**
 * 资源条本体框 442×32 @x154（中心 375）。
 * 462 的圆角贴上框肩，描边探出木纹。收到 442 后，条顶那一行（木纹 x[151,597]）
 * 直边落在约 166–584，两端各留一截肩。
 */
export const MENU_BAR_FRAME = { x: 154, w: 442 } as const;
/** 橱窗框体 544×871 @x107（mock 实测框；`ui_showcase_frame` 重缩后目标框）。 */
export const MENU_CASE_FRAME = { x: 107, w: 544 } as const;
/** Boss 关图位（玻璃白板区）468×528 @x[146,614]，窗内偏移 y[130,658]（定稿实测）。点击热区仍是这块。 */
export const MENU_BOSS_SLOT = { x: 146, yOff: 130, w: 468, h: 528 } as const;
/** 走马灯裁切区 = 橱窗白底。`ui_showcase_frame` 白卡：x197、宽 361，距柜顶 168、高 527。 */
export const MENU_CLIP = { x: 197, yOff: 168, w: 361, h: 527 } as const;
/** 通关飘带：整枚落在裁切区内，右上内缩。跟内容一起滑。 */
export const MENU_SEAL = { w: 101, h: 140, inset: 12 } as const;
/** 未开启大锁边长（花心居中）。 */
export const MENU_LOCK_D = 220;
/**
 * 进行中沙漏。宽按源图 820×1008 等比。mx/my = 不透明像素重心占图幅的比例
 * （源图重心偏左，按外接框中心摆会偏约 20px）。换图后重测这两个数。
 */
export const MENU_PROGRESS = { h: 210, w: 171, mx: 0.381, my: 0.486 } as const;
/**
 * CTA 文案纹理：高 56，**框中心**落在钮面自顶 42%（原型口径，WXG-T-485 订正措辞）。
 * aspect = 源图 964/253。实测源图 alpha bbox 全幅、**零透明边**、重心 49.76% ≈ 正中
 * ⇒ 「中心」与「重心」等价，但落地单 v3.8 曾写「顶距钮顶 2」（与钮面 42% 互斥，已订正为 10.64）。
 */
export const MENU_CTA_LABEL = { h: 56, fromTop: 0.42, aspect: 964 / 253 } as const;
/**
 * 走马灯手感。`flickPxPerMs` / `endFollow` / `snapMs` 是临时值，真机验收后回填落地单 §8。
 * ponytail: 到头只乘一个系数、松手用三次缓出。手感不够再换曲线，别先加弹簧。
 */
export const MENU_CAROUSEL = {
  tapPx: 10,
  pageFrac: 0.3,
  flickPxPerMs: 0.6,
  endFollow: 0.35,
  snapMs: 180,
} as const;
/** 状态徽标 64² @x[538,602]，窗内偏移顶 y=142（玻璃区右上角、内缩 12；三态图形资产待裁 ⇒ 程序化占位）。 */
export const MENU_BADGE = { x: 538, yOff: 142, d: 64 } as const;
/** 完成态 boss icon Ø160，圆心 = 窗内偏移 y 394（cx 380，居中于 Boss 图位）。 */
export const MENU_DONE_ICON = { cx: 380, yOff: 394, d: 160 } as const;
/** 橱窗 Boss 原图边长。源图 256²，花约占 2/3；540 时花约 360，重心与盖章同心。 */
export const MENU_BOSS_ART_D = 540;
/** 橱窗内木牌（`ui_showcase_plate`）定稿含影实测框 214×100，中心 x 381、窗内偏移顶 y=652（§8.7 牌宽口径待对账）。 */
export const MENU_PLATE = { cx: 381, yOff: 652, w: 214, h: 100 } as const;
/**
 * 木牌标题行心（距牌顶，设计px；牌面心 ≈ 46，下缘为投影）。有关名 ⇒ 两行（关序 28 / 关名 30，E1 地板 28），
 * 无关名 ⇒ 关序单行居牌面心（用户 2026-10-16 裁「橱窗下板子补关卡标题」）。
 */
export const MENU_PLATE_TITLE = { line1Off: 30, line2Off: 62, singleOff: 46 } as const;
/** ◀▶ 翻页钮视觉 64² 左缘 x（右缘 = 750−26−64=660 ⇒ 镜像；热区 88² 同心）。 */
export const MENU_ARROW_X = { left: 26, right: 660 } as const;
/** ◀▶ 视觉边长（热区 `TOUCH_MIN` 同心包裹）。 */
export const MENU_ARROW_VISUAL_D = 64;
/** 位图腿的目标绘制尺寸（源图 @2x/高清 ⇒ 按屏上框重缩，落地单 §5「接线时按目标尺寸重缩」）。 */
/** 顶栏图标：`ui_icon_*` 画布与圆底同为 160² ⇒ 与圆同尺寸 80 绘制（字形自带留白，旧 40 会把字形缩到 ≈24）。 */
export const MENU_TOPBAR_ICON_D = MENU_TOPBAR_VISUAL_D;
/** 向标源图 58×87。方框 36² 会把字拉扁；高 36、宽 24（36×58/87）居中画在圆钮上。 */
export const MENU_ARROW_ICON = { w: 24, h: 36 } as const;
export const MENU_BAR_ICON_D = 24;
/** 顶栏钮视觉直径复用在册 `MENU_TOPBAR_VISUAL_D`；热区左缘复用 `MENU_TOPBAR_X`。 */

/**
 * 菜单位图 `textureId` 组（WXG-T-280 全量位图化，用户裁定；⚠ 资源条无条体资产 ⇒
 * 维持程序化 plaque，仅 coin/stamina 两 icon 走位图，落地单 §3）。
 * src 只存 id，⛔ 不存资产路径（bundle/path 属宿主：harness `main.ts` 注册表 /
 * Cocos `beads-blit-carrier.ts::BITMAP_ASSETS`）。后缀选型 = 宿主约定，不入本表。
 */
export const MENU_TEXTURES = {
  logo: 'bitmap__menu_logo',
  caseFrame: 'bitmap__menu_case_frame',
  plate: 'bitmap__menu_plate',
  cta: 'bitmap__menu_cta',
  ctaPressed: 'bitmap__menu_cta_pressed',
  btnCircle: 'bitmap__menu_btn_circle',
  btnCirclePressed: 'bitmap__menu_btn_circle_pressed',
  btnArrow: 'bitmap__menu_btn_arrow',
  btnArrowPressed: 'bitmap__menu_btn_arrow_pressed',
  iconSettings: 'bitmap__menu_icon_settings',
  /**
   * 喇叭（在册语义 = 公告，切图规格 B2）。[WXG-T-493] 起**零消费者**：该枚自 WXG-T-365
   * 被借去顶替装扮馆入口，本批装扮馆换上真图标 `iconSkins` ⇒ 本键不再被任何画法引用。
   * [WXG-T-494] 去向已裁（用户四案拍板「甲」）= **不入顶栏**，公告改作信封（消息中心）
   * 弹窗内的一类内容 ⇒ 本枚保留 = 将来「公告条目」图标的候选件（规格正本 `ux-spec §3.8` + `§8 U19`）。
   * [WXG-T-496] 归类澄清：图形 = **扩音喇叭（megaphone，带两道声波）**，中文游戏语境读作
   * 「公告 / 广播」，**⛔ 不作音量 / 静音开关**（设置内音效开关现为文字钮 `音效 开/关`）；
   * 将来若需音量类图标，**另绘扬声器**，⛔ 复用本枚（同图两义 = 玩家误读源）。
   */
  iconSound: 'bitmap__menu_icon_sound',
  /**
   * 信封（切图规格 B2）。`[WXG-T-497]` 起**零消费者**：顶栏签到钮改挂 `iconCalendar`
   * （用户 2026-10-29 裁「信封替换成日历 / 礼盒」）⇒ 本枚保留 = 将来消息中心（公告 / 奖励邮件）
   * 的候选件（方向见 `ux-spec §8 U19`，入口暂缓）。
   */
  iconMail: 'bitmap__menu_icon_mail',
  /**
   * `[WXG-T-497]` 签到 / 每日奖励（顶栏右上第一枚）：日历 + 对勾切图（规格 **B10**）。
   * 用户 2026-10-29 裁：原信封语义（消息中心）与「签到」错位 ⇒ 换专用日历形。
   */
  iconCalendar: 'bitmap__menu_icon_calendar',
  /** `[WXG-T-488]` 好友榜（顶栏左上第二枚）。缺 ⇒ 空圆底（⛔ 不自造替代图形）。 */
  iconRank: 'bitmap__menu_icon_rank',
  /** `[WXG-T-493]` 装扮馆（顶栏右下第二枚）= 衣架 + 圆领小衫切图，闭 WXG-T-365 的 `[待 UI 设计]`。 */
  iconSkins: 'bitmap__menu_icon_skin',
  iconArrowLeft: 'bitmap__menu_icon_arrow_left',
  iconArrowRight: 'bitmap__menu_icon_arrow_right',
  iconCoin: 'bitmap__menu_icon_coin',
  iconStamina: 'bitmap__menu_icon_stamina',
  /** 未开启大锁。 */
  badgeLocked: 'bitmap__menu_badge_locked',
  /** v3.8 进行中沙漏（花心）。 */
  badgeProgress: 'bitmap__menu_badge_progress',
  /** v3.8 通关飘带。 */
  sealCleared: 'bitmap__menu_seal_cleared',
  /** v3.8 CTA「开始游戏」艺术字。缺资产回退程序化字。 */
  ctaLabel: 'bitmap__menu_cta_label',
  /** `[WXG-T-512]` 卡通木纹条（云 qwen-image-3.0 seed 511 生成，1024×320 圆角）：结算木牌与主钮拉伸使用。 */
  woodGrain: 'bitmap__ui_wood_grain',
  /** `[WXG-T-514]` 结算外框木纹环（780×705 圆角环，12px 宽）；按钮不再用纹理。 */
  woodFrame: 'bitmap__ui_wood_frame',
} as const;

/**
 * 按下态整体下沉量（设计 px；art-bible-proposal §4 / §T7「按下 = y+2 位移」，y-up ⇒ 绘制减此值）。
 * `reduceMotion` ⇒ 不位移、只换面（accessibility D1 同族）。
 */
export const UI_PRESS_SINK = 2;

/**
 * CTA 9-slice 端帽（源纹 200×240 @2x 实测：corner~top 80/96、left 76 ⇒ 对称化取整，
 * 落码单位 = 源纹理 px，与 `nineSliceFx` 入参同口径）。
 */
export const MENU_CTA_SLICE = { capX: 76, capY: 96 } as const;
/** CTA pressed 源纹的台面下移量（源 px，menu-showcase-asset-spec §5.1「逐列下移 D=16」）⇒ 文案随台面同比下沉。 */
export const MENU_CTA_PRESSED_D = 16;
/** CTA 源纹高（源 px，同上 200×240）。 */
export const MENU_CTA_SRC_H = 240;

/** {@link menuAnchors} 入参（全部**屏幕逻辑 px / dp**，接口原值；宿主无该接口时传 **`null`** ⇒ 兜底）。 */
export interface MenuAnchorsInput {
  /** `safeArea.top`（dp）；**0 = 合法值**（非刘海机）；`null`（web/node 无接口）⇒ `SAFE_TOP_H` 兜底。 */
  readonly safeTopDp: number | null;
  /** `PlatformInfo.capsuleBottomDp`；`null`/≤0 ⇒ 顶栏走 `MENU_TOPBAR_TOP_FALLBACK`。 */
  readonly capsuleBottomDp: number | null;
  /** `PlatformInfo.safeAreaBottom`（= windowH − safeArea.bottom，dp，**窗口底基准** · WXG-T-447）；0 = 无 Home 条；`null` ⇒ `SAFE_BOTTOM_H`。 */
  readonly safeBottomDp: number | null;
  /** `getWindowInfo().windowWidth`（dp）⇒ 换算系数 k = 750/它；≤0 ⇒ k 无效全走兜底。 */
  readonly windowWidthDp: number;
  /** 系高 H（设计 px）= Viewport **动态档实际值**（宽恒定 ⇒ 逐机 1334~1630）；≤0 ⇒ `DESIGN_H`。 */
  readonly designHeight: number;
}

/**
 * 逐机锚输出。**链式算式在本文件**（顶部深度系，与落地单 §2 逐行同名可对着验），
 * 输出已翻成视图设计空间（**y 向上**、原点左下）。gap 留浮点（验收账按 `round` 读数，
 * 不变式② `gapBot == 2×gapTop` 在浮点域精确成立）；像素落位由消费侧各自 `round`。
 */
export interface MenuAnchors {
  readonly H: number;
  /** 顶隙换算后的 st（设计 px，裸换算）。 */
  readonly st: number;
  /** 底 inset（设计 px，裸换算）。 */
  readonly sb: number;
  /** 板底↔CTA顶 自由区高。 */
  readonly zone: number;
  readonly gapTop: number;
  readonly gapBot: number;
  /** 结顶（招牌整块上缘）。 */
  readonly signTopY: number;
  /** 板底（slogan 带、资源条组都从它往下排）。 */
  readonly signBotY: number;
  /** 资源条上缘 = 橱窗上缘（v3.6：条嵌在橱窗顶部，向下覆盖 MENU_BAR_H）。 */
  readonly barTopY: number;
  /** 橱窗上缘（= barTopY）。 */
  readonly caseTopY: number;
  /** 橱窗下缘（恒定高，⛔ 不拉伸）。 */
  readonly caseBotY: number;
  readonly ctaTopY: number;
  readonly ctaBotY: number;
  /** 顶栏钮**顶缘**（y-up）= H − bt，bt = cap+4（走 `menuTopbarTop`，+4 只此一处）。 */
  readonly btTopY: number;
  /** 走马灯卡 / ◀▶ 同心圆心 = caseTopY − 0.42×871。 */
  readonly caseCenterY: number;
}

/**
 * 四锚 → 全链落位（**纯函数**：只接五个数，不 import cc/wx/DOM ⇒ Node 可测，L2/L3）。
 *
 * 接口优先语义沿用 v1.75（判例 K-124）：接口在场就只信接口，⛔ 不 `max` 静态宏。
 * ⚠ 与 `safeEdgeInset` 的一处**有意差异**：顶/底 inset 的 **0 是合法接口值**（非刘海机顶隙 0/
 * 无 Home 条机底隙 0，落地单 §4 SE・Android 两档即此），只有 `null`（宿主读不到接口）才走兜底；
 * 胶囊底维持旧口径（真值恒 > 0，适配层已把脏值归一 `null`）。
 * ⚠ **裸换算**（`round(dp×k)`）：链隙值 16/32 已含边距语义 ⇒ 本函数内 ⛔ 不 +`SAFE_EDGE_MARGIN`
 * （唯一例外 = bt，经 `menuTopbarTop` 自带 +4，与落地单 `bt = cap + 4` 同值不双加）。
 */
export function menuAnchors(input: MenuAnchorsInput): MenuAnchors {
  const { safeTopDp, capsuleBottomDp, safeBottomDp, windowWidthDp, designHeight } = input;
  const k = windowWidthDp > 0 ? DESIGN_W / windowWidthDp : 0;
  const st = safeTopDp !== null && safeTopDp >= 0 && k > 0 ? Math.round(safeTopDp * k) : SAFE_TOP_H;
  const sb = safeBottomDp !== null && safeBottomDp >= 0 && k > 0 ? Math.round(safeBottomDp * k) : SAFE_BOTTOM_H;
  const H = designHeight > 0 ? designHeight : DESIGN_H;
  // ── 链式（顶部深度系，落地单 §2 逐行）
  // 结顶 = 安全区下固定 16；无刘海时不低于 MENU_BOW_MIN_FROM_TOP，否则绳子被屏顶裁掉、牌子贴顶。
  const bow0 = Math.max(st + MENU_CHAIN_GAP_TOP, MENU_BOW_MIN_FROM_TOP);
  const sign1 = bow0 + MENU_SIGN_CHAIN_H;
  const cta1 = H - sb - MENU_CHAIN_GAP_BOTTOM;
  const cta0 = cta1 - MENU_CTA_H;
  const zone = cta0 - sign1;
  const gapTopRaw = (zone - MENU_CASE_GROUP_H) / (1 + MENU_CASE_GAP_RATIO);
  // Δ12 只作组隙下限（落地单 §2）：五档接口档最小 gapTop ≈38（SE，v3.9 结顶下限 61）⇒ 钳位不触发、不变式② 在浮点域精确；
  // 只在 fallback 档（无接口 st=120/sb=68 叠 H=1334 ⇒ zone < 871）防负隙穿模。
  const gapTop = Math.max(gapTopRaw, SIGN_BAND_PAD);
  const gapBot = zone - MENU_CASE_GROUP_H - gapTop;
  // 资源条嵌在橱窗顶部：橱窗顶 = 招牌底 + gapTop；条顶 = 橱窗顶（条覆盖楣的上 MENU_BAR_H）。
  const case0 = sign1 + gapTop;
  const bar0 = case0;
  const case1 = case0 + MENU_CASE_H;
  const bt = menuTopbarTop(capsuleBottomDp, windowWidthDp);
  // ── 翻 y-up
  return {
    H, st, sb, zone, gapTop, gapBot,
    signTopY: H - bow0,
    signBotY: H - sign1,
    barTopY: H - bar0,
    caseTopY: H - case0,
    caseBotY: H - case1,
    ctaTopY: H - cta0,
    ctaBotY: H - cta1,
    btTopY: H - bt,
    caseCenterY: H - case0 - MENU_CASE_SPLIT * MENU_CASE_H,
  };
}


// ─────────── 作品墙（EP12-S6 §5.1 L1「木框橱窗」；主菜单与 `levels` overlay **共用**同一组几何
//             ⇒ 陈列序与格口径单源。旧 `meta-view::levelsLayout()` 内 `cols=4/cellSize=120/gap=22`
//             三枚字面即本组常量（§3.0 D-1「沿用实装值零新常量」的落点）。
/** 作品墙列数（`wall_capacity` 派生项之一；EP13-FU-1 · tls §3 v1.3 由 4 收到 **3** ⇒ 与现池 9 关恰满）。 */
export const WALL_COLS = 3;
/** 作品墙行数（9 关现状 = 单层墙，⛔ 轮播/分带归 S6 Out）。 */
export const WALL_ROWS = 3;
/** 作品格边长（≥ `TOUCH_MIN` 88 ⇒ 热区达标）。 */
export const WALL_CELL = 120;
/** 作品格间距。 */
export const WALL_GAP = 22;
/**
 * 一屏作品格容量 = `wall_capacity`（§3.0 D-1 实装值 12）。**容量语义（EP13-S2 起）**：
 * 墙集合 = 本大关清单（`arcs.ts::levelRefs` 展开）⇒ 本值只封**单大关清单**的展示上限；
 * 清单短于容量的槽由视图读成 `undefined` ⇒ 空槽、零事件；清单超容量本版 ⛔ 不实现分页
 * （`tls §8.2 TODO-2`：本版 9 ≤ 12 不触发 Q12）。
 */
export const WALL_CAPACITY = WALL_COLS * WALL_ROWS;
/** 木框内衬（纸底边缘 → 网格外沿），线框 22（与 `WALL_GAP` 同档，非新数值）。 */
export const WALL_FRAME_INSET = 22;
/**
 * 主菜单网格**上沿** y（= 第 1 行作品格的**上边**；本设计空间 y 向上，`meta-view::pushWallCells`
 * 由此逐行下推）。橱窗框带由它派生：
 * 顶 = `WALL_GRID_TOP + WALL_FRAME_INSET` = **920**，底 = 顶 −（墙高 404 + 2×INSET）= **472**。
 * ⚠ `[待实测]` 回填偏差登记：`menu-architecture §5.1` 建议橱窗带 y∈[540,940]（高 400），而
 * 墙高实算 `3×120 + 2×22 = 404` **放不下内衬** ⇒ 本批按「框带 ≥ 墙高 + 2×INSET」实算取
 * [472,920]（顶 −20、底 −68）；主钮顶 448 与框底 472 间隙 24，slogan 底（968−14）与框顶 920 间隙 34。
 */
export const WALL_GRID_TOP = 898;
/** 空槽虚线段长（`§5.4`「未解锁 = 虚线空槽（既有语言）」；同 `view-model::drawDashedRect` 的 6/4 判例值）。 */
export const WALL_SLOT_DASH = 6;
/** 空槽虚线间隔（同上；⚠ 与 `view-model` 私有实现的 6/4 **同值不同源**，归并需授权 ⇒ 本批不越界改该文件）。 */
export const WALL_SLOT_DASH_GAP = 4;

// ─────────── 走马灯小卡常量组（`CAROUSEL_W/H/THUMB_N/THUMB_AREA/TEXT_BAND`）已随白卡退场
//   （`[WXG-T-281]` 用户裁定：走马灯中间只展示 Boss 图、未通关置灰、点图进选关 ⇒
//   menu-architecture §1.3「单卡进度展示」被本裁覆盖；卡位/热区 = `anchoredGeo.bossBox`，历史坐标读 git 史）。


// ─────────── 招牌珠拼 `beadText` 档（EP12-S6 · 子单 T-2B · WXG-T-269-S6）
//   正本 = `games/beads/design/art/specs/menu-wall-signage-spec.md`（林绘澄 T-1）**§1.4 档公式重算 / §1.5 位表档 /
//          §0.4 珠面地板三口径 / §0.7 新常量落点**；版面口径 = `menu-architecture.md §5.3`（该节预登记
//          `SIGN_*` 命名 ⇒ 本组同名，回写行见 T-1 §6.4）。
// ⛔ **不进 `systems-index §3`**（菜单屏不在 §3.1 带表 ⇒ 零 §3 变更；art-owned 版面派生值，
//   判例同 `DIFFICULTY`（`Object.freeze` 组）与 `PAUSE_PANEL_H` / 本文件 `MENU_*`·`WALL_*`（`const` 冻结）
//   —— 本组沿用 `WALL_*` 同族 **flat `SIGN_*` 命名**，以便与 T-1 §0.7 建议名逐字对齐、零第二口径）。
// 不变式（T-1 §1.4，本组的**存在理由**）：令 `n·d = 120` ⇒ 总宽 `5.5·n·d = 660`、单字框 `120×120`、
//   字间 `(n/2)·d = 60` **皆与 `n` 无关** ⇒ 升档对版面零扰动，代价全落在 `d` 与珠数 `n²` 上。
/**
 * 字模阵边长 `n`（位表 = `n×n` 布尔方阵，真源 `config/sign-glyphs.ts`）。
 * **10** = 主理人裁定档（8×8 经 T-1 §1.3 判「行预算不足 + 三类结构损失」不可辨 ⇒ 升档落用户预授权）。
 */
export const SIGN_MATRIX_N = 10;
/**
 * 招牌珠距 `d`（= 字模格距，设计 px）。**12** 是「守宽上限」与「口径 B 地板下限」**恰好重合**的唯一一档
 * （`d_max = ⌊702 / (5.5·10)⌋ = 12 = d_min(B)`，T-1 §1.4 注 2）⇒ 既无放大余地也无缩小的余地（除非换 `n`）。
 * ⚠ 验收③ 的「`d ∈ [10,15]`」由 {@link signPitchFor} 的档换算式覆盖（`n=8→15`、`n=10→12`、`n=12→10` 破地板）。
 */
export const SIGN_BEAD_PITCH = 12;
/** 招牌字数（`app_name` = 拼豆小铺 ⇒ 4；⛔ 视图侧不散字面，串本体读 `copy-tokens.ts::app_name`）。 */
export const SIGN_GLYPH_COUNT = 4;
/** 字间 / 单字框 之比（`menu-wall-signage-spec §0.5`「字间 = 半字宽」⇒ 120×0.5 = 60）。 */
export const SIGN_GLYPH_GAP_RATIO = 0.5;
/**
 * 总宽系数（T-1 §1.4 重算式）：`总宽 = 4·n·d + 3·(n/2)·d = 5.5·n·d`；`n=8` 时退化 = 原 §5.3 的 `44d`。
 * ⇒ 由 {@link signPitchFor} 反解上界 `d ≤ 702 / (5.5·n)`。
 */
export const SIGN_WIDTH_COEF = 5.5;
/** 屏边距（`tokens.md §4` `space_screen_edge` = **24**，在册值 ⇒ 可用宽 `750 − 2×24 = 702`）。 */
export const SIGN_PAGE_EDGE = 24;
/**
 * 招牌带与橱窗框顶的净空下限 `Δ`（`tokens.md §4` `space_band_pad` = **12**）。
 * 关系不变式（T-1 §2.2，**这才是判据、具体 y 值不是**）：`sign.yMin ≥ frameTop + Δ`。
 */
export const SIGN_BAND_PAD = 12;
/** 珠面地板（T-1 §0.4 的 ≥8 下界；主理人裁**口径 B = 真几何**为准、A 为对照）。 */
export const SIGN_FACE_FLOOR = 8;
/**
 * 真几何内缩比（口径 B）：`1 − 2·BEAD_DRAW_INSET / BEAD_CELL` = **26/30 ≈ 0.8667**。
 * ⚠ 与 `drawFilledBead` 的等比内缩通道**同一条算式**（`bead-render.ts` `inset = drawInset·outer/BEAD_CELL`）
 *   ⇒ 传 `targetColorIdx` 即吃到它，本值不是新引入的尺子（`tuning.ts:67–72` 现装注）。
 * ⚠ T-1 §0.4 表内「珠面恒 = 0.733 × 外缘」= `BEAD_DRAW_INSET` **改 4→2 之前**的遗留读数；
 *   现值 26/30 与 §3.2 实测表（32.9 / 19.1 / 8.67）逐档吻合 ⇒ 差异列入回写清单（交主理人中转 art）。
 */
export const SIGN_FACE_RATIO = (BEAD_CELL - 2 * BEAD_DRAW_INSET) / BEAD_CELL;
/** 口径 B（真几何）下满足地板的最小 `d`（`(d−2)·26/30 ≥ 8 ⇒ d ≥ 11.23 ⇒ 12`）。 */
export const SIGN_PITCH_MIN_B = 12;
/** 口径 A（§5.3 字面 `d − BEAD_GAP`）下的最小 `d`（= 10）；仅作对照列，⛔ 不作落码判据。 */
export const SIGN_PITCH_MIN_A = 10;
/** 旧 §5.3 大档上限（`n=8` 时 `d = 15`；亦即验收③区间的上端）。 */
export const SIGN_PITCH_MAX = 15;
/** 回落档字模阵（T-1 §3.8 回退序 **5**：性能不达标时招牌回落 `8×8`，省 343 命令，代价 = 不可辨性回归）。 */
export const SIGN_FALLBACK_MATRIX_N = 8;
/** 回落档珠距（守不变式 `n·d = 120` ⇒ 版面 footprint 逐值不变；面 B = 11.27 合规）。 */
export const SIGN_FALLBACK_PITCH = 15;
/**
 * 招牌珠色索引（S0 硬约束③ ⇒ **既有珠色**，走 `beadInksFor`/`endpointOf` 通道，⛔ 不取 UI token）。
 * **0 = art 未定值**（T-1 §1.7 明文「本轮不写死」，索引待 `[待真机]` 观感裁定后由回写单定）
 *   ⇒ 视图侧按该节给出的**建议口径**确定性派生 = 「demo 十色中 `relativeLuminance` 最高的一档」；
 *   art 回写填 `1..10` 后即覆盖派生（一行改值、无第二通道）。⛔ 不得在此填十六进制。
 */
export const SIGN_INK_IDX = 0;
/** 单字外接框边长 = `n·d`（= **120**，与 `WALL_CELL` 同值但**不同语义**，勿互推）。 */
export const SIGN_GLYPH_BOX = SIGN_MATRIX_N * SIGN_BEAD_PITCH;
/** 字间 = `(n/2)·d`（= **60**；不变式下与 `n` 无关）。 */
export const SIGN_GLYPH_GAP = SIGN_GLYPH_BOX * SIGN_GLYPH_GAP_RATIO;
/** 招牌总宽 = `5.5·n·d`（= **660** ≤ {@link SIGN_AVAIL_W} 702 ⇒ 守宽上限）。 */
export const SIGN_TOTAL_W = SIGN_WIDTH_COEF * SIGN_MATRIX_N * SIGN_BEAD_PITCH;
/** 可用宽 `W_avail = DESIGN_W − 2·space_screen_edge`（= **702**）。 */
export const SIGN_AVAIL_W = DESIGN_W - 2 * SIGN_PAGE_EDGE;
/** 招牌带**左缘**（居中排布，`MENU_TITLE_Y` 语义 = 外接框中心 ⇒ 视图只加半宽/半高）。 */
export const SIGN_ORIGIN_X = (DESIGN_W - SIGN_TOTAL_W) / 2;

/**
 * 档换算（T-1 §1.4 上界反解）：给定字模阵 `n` ⇒ **守版面宽度上限**的 `d = ⌊W_avail / (5.5·n)⌋`，
 * 并钳进验收③区间 `[SIGN_PITCH_MIN_A, SIGN_PITCH_MAX]`。纯函数、零分配。
 */
export function signPitchFor(n: number): number {
  const raw = Math.floor(SIGN_AVAIL_W / (SIGN_WIDTH_COEF * n));
  return Math.min(SIGN_PITCH_MAX, Math.max(SIGN_PITCH_MIN_A, raw));
}
/** 口径 B（真几何，**主理人裁定的地板口径**）：`face = (d − BEAD_GAP) × 26/30`。 */
export function signFaceB(d: number): number {
  return (d - BEAD_GAP) * SIGN_FACE_RATIO;
}
/** 口径 A（`menu-architecture §5.3` 字面）：`face = d − BEAD_GAP`；仅对照，⛔ 不作判据。 */
export function signFaceA(d: number): number {
  return d - BEAD_GAP;
}
/** 该字模阵在口径 B 下是否可行（`d = signPitchFor(n)` ⇒ 面 ≥ {@link SIGN_FACE_FLOOR}）。 */
export function signTierOk(n: number): boolean {
  return signFaceB(signPitchFor(n)) >= SIGN_FACE_FLOOR;
}

// ─────────── L4 门楣价目牌（❤/🪙；`menu-architecture §5.1b-2` 第九批设计 / 第十一批落码 2026-10-13）
//   小铺语言 = 「上方麻绳吊招牌、**价目牌钉在展示窗门楣**」⇒ 运行时的「展示窗」= 走马灯小卡
//   （§1.3 第五轮：作品墙下移 `levels` overlay，卡为其继承者）。
// ⛔ **不进 `systems-index §3`**（菜单屏版面派生值，判例同 `SIGN_*` / `CAROUSEL_*`）。
// ⚠ **第九批那组坐标本批作废重登**（`menu-architecture §5.1b-2` 第九批表：牌体自顶 255–293
//   = y-up 1041–1079）：那是从**定稿图**门楣量出来的，从未对**现役程序化版面**核对 ⇒
//   与招牌珠拼带 `[980,1100]`（`MENU_TITLE_Y` 中心 ± 半字框 `SIGN_GLYPH_BOX/2`）**交集 38 px
//   = 整条牌全压在招牌字上**（第八批「非背景占比不构成不撞车的证据」同一根因重演）。
//   本批按 §7.4 P-6 **不变式 ⑤「资源条带让位优先于招牌缩字」**走让位腿（⛔ 不动 `SIGN_*` 档）。
// [WXG-T-280] 锚定档：牌体几何（W/H/X/Y）已退场 ⇒ 落位恒由 `anchoredGeo.barBox`（MENU_BAR_FRAME × MENU_BAR_H）算定；
//   下列只留**绘制细节档**（描边/铆钉/内缩，程序化腿与位图腿共用）。
/** 牌体描边宽（图内实测 3；圆角复用 `UI_CONTAINER.radiusChip` 12，不新造档）。 */
export const MENU_PLAQUE_STROKE = 3;
/** 图标中心距牌体端缘（实测 42 ⇒ 左 x 192 / 右 x 558）。 */
export const MENU_PLAQUE_ICON_INSET = 42;
/** 铆钉半径（图内实测 r 3.5）。 */
export const MENU_PLAQUE_RIVET_R = 3.5;
/** 铆钉距牌体端缘（实测 18）。 */
export const MENU_PLAQUE_RIVET_INSET = 18;
/** 上沿受光线两端内缩（不吃进 r12 圆角段 ⇒ 亮线在直边上）。 */
export const MENU_PLAQUE_BEVEL_INSET = 8;

// ─────────── 作品格珠拼缩略档（EP12-S6 · 子单 T-2B；正本 = `menu-wall-signage-spec` §3.1/§3.2/§3.3/§3.4）
//   主理人裁定：**案乙**（缩略区 84、现装占位几何不动）+ **5×5 主色块聚合** + **单格 ≤ 25 珠硬判据**。
//   同 `SIGN_*` 纪律：art-owned 派生版面值，⛔ 不进 §3。
/**
 * 缩略字模阵 `n`（**5** = 推荐档）。档上限由案乙的 84 区收到 **7**（面 8.67 压线；8×8 的 7.37 越地板，
 * T-1 §3.4）⇒ 回退杠杆（§3.8 序 2/3）走 **5 → 4 → 3**，⛔ 不越 7。
 */
export const THUMB_MATRIX_N = 5;
/** 缩略区顶内缩（格顶 → 缩略区顶，= 8；T-1 §3.4 案乙，值标 `[待实测]`）。 */
export const THUMB_TOP_INSET = 8;
/** 格底文字带（星位所在，= 28；⚠ 编号已随 T-2B「缩略 + 星」退场 ⇒ 本带只承载星 ⇒ 差值登记回写清单）。 */
export const THUMB_STAR_BAND = 28;
/** 缩略区边长 = `WALL_CELL − THUMB_TOP_INSET − THUMB_STAR_BAND`（= **84**，由三件派生 ⇒ 无第二份可漂移读数）。 */
export const THUMB_AREA = WALL_CELL - THUMB_TOP_INSET - THUMB_STAR_BAND;
/**
 * 单格珠数**硬上限** = `THUMB_MATRIX_N²`（= **25**，T-1 §3.3「K-6 关键输入，请作为判据入册」）。
 * ⚠ 本上限只押在 `n²`、与关卡规模**解耦**（聚合规则自动兜住 L10+ 的大盘）⇒ 这正是本规则的性能安全性来源，
 *   `tests/menu-thumb-primitives.test.ts` 以「任意 pattern ⇒ 珠数 ≤ 25」的构造反例正面钉住。
 */
export const THUMB_BEADS_MAX = THUMB_MATRIX_N * THUMB_MATRIX_N;

// ─────────── 选关版面（`[WXG-T-503]` 改判回弹窗；正本 = `design/ux/level-select-page-layout.md` v0.7 §2）
//   弹窗 600×720 内 3×3 格 = **`WALL_CELL`(120) / `WALL_GAP`(22)**（与作品墙同一套，⛔ 不造第二套格径），
//   缩略 = `THUMB_AREA`(84)；返回 240×88 @ 板底 +50。
//   ⚠ 原整页档 `LEVELS_CELL/GAP/GRID_*/THUMB_AREA/BACK_*/NAV_*` 已随 WXG-T-503 退场（ADR-0032 D5 改判）。

/**
 * `[WXG-T-271 / ADR-0031 DEC=C′]` boss 关缩略**静态位图**映射（`level.id` → `textureId`）。
 *
 * 命中**且**宿主已装载该 `textureId` ⇒ `drawLevelThumb` 发**一条** `blit` 将原图按面铺满缩略区；
 * 未命中 / 未就绪 ⇒ 逐字节回退程序化缩略（§19「未命中一律矢量回退」）。
 * ⛔ src 不存 Cocos 资产路径（bundle/path 属宿主 `beads-blit-carrier.ts`）；
 * `BeadsLevelRaw` 不带 `kind`（boss 只在生成期排序标）⇒ 映射按显式 `id` 键，新 boss 关追加条目。
 * EP13-S4：键/图**按大关表派生**（每行 `levelRefs` 末区间 `to` = 该大关收尾关，图 = 行内 `textureId`）；
 * 旧码硬取首行 `OPEN_ARCS[0]` ⇒ 多过大关时后几行会错用首关图，已消除。
 */
export const BOSS_THUMB_TEXTURES: Readonly<Record<number, string>> = (() => {
  const map: Record<number, string> = {};
  for (const arc of ARCS) {
    const last = arc.levelRefs[arc.levelRefs.length - 1];
    if (last !== undefined) map[last[1]] = arc.textureId;
  }
  return Object.freeze(map);
})();
/**
 * boss 关判定（`levelId` = **1-based 关号** = 某大关收尾关）。
 *
 * 与 {@link BOSS_THUMB_TEXTURES} **同源派生**（同一份 `ARCS.levelRefs` 末区间）——
 * ⛔ 不新建第二份 boss 真源：`BeadsLevelRaw` 本就不带 `kind`（boss 只在生成期排序标）。
 * 用途 = 结算发豆分档（Boss 关首通 40/60/80、复刷 10/2；普通关 20/30/40、5/1）。
 */
export function isBossLevelId(levelId: number): boolean {
  return Object.prototype.hasOwnProperty.call(BOSS_THUMB_TEXTURES, levelId);
}

/** 回退档序（§3.8 序 2/3 预置杠杆，逐级触发、不并行）。 */
export const THUMB_TIERS: readonly number[] = Object.freeze([5, 4, 3]);
/** 虚线空槽档回退（§3.8 序 4：空格改 48 档格径 ⇒ 48 条 line/格 降为 20 条）。 */
export const WALL_SLOT_FALLBACK_CELL = 48;

/** 缩略格距 = `THUMB_AREA / n`（5 档 = **16.8**，与 T-1 §3.2 实测表同值）。 */
export function thumbPitchFor(n: number): number {
  return THUMB_AREA / n;
}
/** 缩略珠的**绘制外缘**（喂给 `drawFilledBead` 的 `size`）= `d − BEAD_GAP` ⇒ 面 = 外缘 × 26/30 = 口径 B。 */
export function thumbOuterFor(n: number): number {
  return thumbPitchFor(n) - BEAD_GAP;
}


/* ── [EP12-S2 · 控件语言] 容器几何 token（2026-10-07 用户裁 P-3=24 同批）──
 * 真源 = `games/beads/design/art/proposals/ui-style-redesign/tokens.md` §2/§3/§4；墨一律读
 * `palette`（wood/card/shadowInk 族）。⛔ 只服务 UI 容器/控件；珠面/格面/托盘槽
 * 属 art-bible §7 不动项零消费。按下态（press）消费面归弹窗批 EP12-S4（playing
 * 无「按住」视觉态）。 */
export const UI_CONTAINER = Object.freeze({
  /** T1 纸面板圆角（**P-3 已裁 = 24**，assets-spec §1.3 口径，代码旧 18 漂移本批收敛）。 */
  radiusPanel: 24,
  /** T2 纸卡圆角（= 在册 `POWERUP_CARD_RADIUS` 同值，消费点直用后者）。 */
  radiusCard: 20,
  /** T3 木主钮圆角（弹窗主钮消费面 = EP12-S4）。 */
  radiusWood: 20,
  /** T4 次级木钮/缩放钮圆角（= 在册 `EXPAND_BTN_RADIUS` 同值）。 */
  radiusBtnSmall: 16,
  /** 新 `radius_chip`：LV 纸 chip / 开关 chip（tokens.md §2「新」行）。 */
  radiusChip: 12,
  /** 柔投影垂直偏移（tokens.md §4 `shadow_dy`；既有胶囊两处自有 dy 值不动）。 */
  shadowDy: 3,
  /** T1 纸面板投影 α（art-bible §5）。 */
  shadowAlphaPanel: 0.1,
  /** T2 纸卡投影 α。 */
  shadowAlphaCard: 0.08,
  /** 纸面板/纸卡描边（tokens.md §3 `stroke_panel`，art-bible §4「1px」；既有
   *  缩放钮 lineWidth 2 属 P-1 收编在册态，本批不重开）。 */
  strokePanel: 1,
  /** 木钮顶缘受光线（tokens.md §3 `stroke_sheen`）。 */
  strokeSheen: 1,
  /** 木钮底缘暗线（tokens.md §3 `stroke_wood_base`）。 */
  strokeWoodEdge: 2,
  /** 按下态整体下移（tokens.md §4 `press_dy`；运行时唯一真源 = {@link UI_PRESS_SINK}）。 */
  pressDy: UI_PRESS_SINK,
  /** LV 纸 chip 几何（screens.md S1「LV 纸 chip 96×48」；墨 = panel/panelBorder）。
   *  x = DESIGN_W − 22 − w（右缘对齐既有 22 留白）；仅普通模式呈现（sprint 自有 HUD 块）。 */
  lvChipW: 96,
  lvChipH: 48,
  lvChipRightInset: 22,
} as const);

/** Fail-panel primary/retry width (ux-spec §3.5: 480×88). */
export const FAIL_PRIMARY_W = 480;
export const FAIL_BUTTON_H = TOUCH_MIN;
export const FAIL_BUTTON_GAP = 24;

// ───── [WXG-T-256 · 用户 2026-10-05 拍板] §1.7 容器板 / §1.8 背景层常量整组退役 ─────
//
// 原 `PLATE_OUTSET` / `PLATE_RADIUS` / `PLATE_SHADOW_DY` / `PLATE_SHADOW_ALPHA` /
// `GLOW_BAND_ALPHAS` / `GLOW_BAND_OUT_MAX` / `GLOW_BAND_RADIUS_SCALE` /
// `PLATE_STICKER_OUTSET` / `BG_DEPTH_ALPHA` / `BG_LIFT_RECT` / `BG_CORE_RECT`
// 随 `drawPuzzlePlate` / `drawBackgroundLayers` 同批删除（⛔ 不留空转常量）。
// 现口径 = 统一单层底色 `palette.background`；正本 = ADR-0030 §5.2 裁②′ 与
// `assets-spec §1.7/§1.8` 退役条。**非 systems-index §3 冻结数值**（原组亦属反馈/呈现层参数）。

// art-bible §6 HUD：倒计时白胶囊（F7①）+ 设置 8 齿齿轮（F7②）。
export const TIMER_CAPSULE = { w: 220, h: 64, radius: 32 } as const;
/** 胶囊投影偏移 (0,−2) / α 0.10。 */
export const TIMER_CAPSULE_SHADOW_DY = 2;
export const TIMER_CAPSULE_SHADOW_ALPHA = 0.1;
/** 时钟图标外径（环 Ø36 3px，针同色）。 */
export const CLOCK_ICON_DIA = 36;
/** 齿轮：Ø48 = hub r13 + 8 齿线 r13→r21 线宽 6 + 中心孔 r5（F7②）。 */
export const GEAR_TEETH = 8;
export const GEAR_HUB_R = 13;
export const GEAR_TEETH_R0 = 13;
export const GEAR_TEETH_R1 = 21;
export const GEAR_TEETH_W = 6;
export const GEAR_HOLE_R = 5;
