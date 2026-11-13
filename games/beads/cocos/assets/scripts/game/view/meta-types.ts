/**
 * MetaView 的数据契约（WXG-T-420 T7 自 `meta-view.ts` 切出，⛔ 不改语义）。
 *
 * 视图侧唯一入参形状：{@link MetaViewData} 由 shell 每帧只读投影（L5：视图不持状态、不回写）；
 * {@link MetaButton} / {@link MetaLayout} 是「绘制与命中同一份几何」的载体（§20-4 精神）。
 * 版式在 `meta-layout.ts`，控件画法在 `meta-widgets.ts`，页面在 `meta-menu.ts` /
 * `meta-levels-page.ts`，装配门面 = `meta-view.ts`。
 */

import { type BeadSizeKind, type MenuAnchors } from '../config/tuning';
import { type BeadsLevelRaw } from '../config/levels-data';
import type { RankPanelView } from '../systems/rank-panel';
/**
 * 菜单侧呈现态。`skins`（**WXG-T-363**）= 装扮馆弹窗（与 `signin` / `settings` 同一
 * {@link overlayPlate} 容器）；入口 = 顶栏中档 `open-skins`（ux-spec §3.8 · 提案 P4-甲，
 * 由 **WXG-T-365** 自设置弹窗行5 左格上提）。
 */
export type MetaOverlay = 'none' | 'signin' | 'settings' | 'levels' | 'skins' | 'profile' | 'level-detail';

/** Everything the meta screens draw, assembled read-only by the shell. */
export interface MetaViewData {
    readonly stamina: number;
    readonly staminaMax: number;
    /**
     * 今日还剩几次「广告加心」（§3.14 v1.80 日限）。`undefined` = 未接线（旧字面量 / 无 meta）
     * ⇒ 资源条只显示 `心 n/n`，⛔ 不显示次数。
     */
    readonly heartAdsLeft?: number;
    readonly coins: number;
    readonly overlay: MetaOverlay;
    /**
     * `[WXG-T-314]` 选关页转场不透明度（0..1，缺省 = 无转场）。底页恒为主菜单：
     * 0 = 只见菜单、1 = 只见整页（且等于无转场帧）⇒ 金样本 / 封箱基线零漂移。
     */
    readonly pageFade?: number;
    /**
     * `[WXG-T-340]` 选关页空带大关名（`levels-spec §11.4` R1：shell 按 `ARCS[页].title` 塞入，
     * ⛔ 视图不查表、⛔ 不借 boss 关派生 `title` 作第二通道）。缺省 / 空串 ⇒ 空带留白，
     * **不创建文本节点**（R2，兜底不猜测）。
     */
    readonly chapterTitle?: string;
    /** 当日签到格（`claims % 7`）。 */
    readonly signinDay: number;
    readonly canClaim: boolean;
    // settings overlay（复用 S9 开关集，ux-spec v1.7 §2；debug-info 为 v1.19 菜单侧同串值入口）
    readonly bgmMuted: boolean;
    readonly sfxMuted: boolean;
    readonly reduceMotion: boolean;
    readonly largeText: boolean;
    readonly vibrate: boolean;
    readonly debugInfo: boolean;
    /** 设置 Debug 开关：菜单上画安全区顶 / 胶囊底 / 安全区底三条标定线。 */
    readonly debugGuides: boolean;
    /**
     * `[WXG-T-445]` Debug 下的**触点探针**：最近一次菜单点击被判定到的设计坐标 + 命中的钮 id。
     * 显示成十字 + 圆环 ⇒ 与手指实际位置一比即可分辨「热区画错」还是「手指→设计坐标换算偏了」。
     * **可选**：缺省 = 不画（金样本 / 正常帧零指令）。
     */
    readonly tapTrace?: { readonly x: number; readonly y: number; readonly label: string };
    /**
     * `[WXG-T-434]` E4 幽灵符号开关（只住暂停面板行5；此处保留同串值入口）。
     * **可选**：缺省 = 关（旧夹具 / 旧调用方免填，判读处一律 `=== true`）。
     */
    readonly ghostSymbol?: boolean;
    /** EP11-S5 行4 两钮的菜单侧同串值入口（与暂停面板共读同一对 game getter ⇒ 两入口恒一致）。 */
    readonly beadStyle: string;
    readonly beadSize: BeadSizeKind;
    /** EP12-S8 行4 第三钮回显（与暂停面板共读同一 game getter ⇒ 两入口恒一致）。 */
    readonly skinId: string;
    // levels overlay + 主菜单作品墙（选关，#1 · WXG-T-180；EP12-S6 上提进主菜单）——均每帧只读引用，不分配。
    readonly levelCount: number;
    /**
     * 当前关（0-based）= **解锁范围内第一个 0 星关**；全通 ⇒ 回落最高解锁关（进度前沿）。
     * `[WXG-T-912]` 用户令：高亮跟「该打哪一关」走，⛔ 不跟最后载入关（回放旧关后不漂回旧关）。
     */
    readonly currentLevelIndex: number;
    /** 最高解锁关（1-based）。索引 < maxUnlockedLevel 的关可点。 */
    readonly maxUnlockedLevel: number;
    /** 每关历史星（0-based 索引；稀疏时视图按 `?? 0`）。引用不拷贝。 */
    readonly starsByLevel: readonly number[];
    /**
     * **陈列序映射**（EP12-S6 Deliverable 2）：`wallSlots[槽位] = 关表 0-based 索引`。
     * 单源在 shell（按 `difficultyOf()` 的 DI **升序**、tie 关号升序 ⇒
     * `menu-architecture §3.3` / `level-difficulty §5.2` 九关墙序）；视图**只读引用**，
     * ⛔ 不排序、不拷贝、不持有（L5）。越界槽（`n > WALL_CAPACITY` 的溢出未实现 = S6 Out /
     * 关表短于槽）⇒ `undefined` ⇒ 画虚线空槽。主菜单与 `levels` overlay **共读同一张表**（单序口径）。
     */
    readonly wallSlots: readonly number[];
    /**
     * **槽位 → 关卡引用**（`wallLevels[槽位] = BeadsLevelRaw`，与 {@link wallSlots} 同序同长）。
     * EP12-S6 · T-2B 进场：珠拼缩略需要**关卡 `pattern` 本体**才能聚合（T-1 §3.1）。
     * ⚠ 视图侧**不得**自己 `import { LEVELS }`：宿主可下传自定义关表（`beads-shell.ts::_wallBaseLevels`
     *   判例），视图直读全局关表会与 `play` 实际所用关表漂移 ⇒ 陈列序对、画错图。
     * 表同样由 shell **一次性缓存**（随 `wallSlots` 同批重建）；本字段是每帧只读引用，
     * ⛔ 不拷贝、不持有、不排序（L5）。
     */
    readonly wallLevels: readonly (BeadsLevelRaw | undefined)[];
    /**
     * `[WXG-T-345]` **章入口闸门**只读布尔（S-4；`ux v1.10 §4.1（3-补）` 的「章锁态」）。
     * = 该章页门票成立 ∨ 既有推进位已越过章首（棘轮 I7）；首章无前置 ⇒ `true`。
     *
     * `[WXG-T-921]` 视图侧**不再消费**本字段：门票腿已并入 shell 的解锁前沿
     * （`_unlockedFrontier`，T-920）⇒ 选关格锁判据只剩 `maxUnlockedLevel` 一套。
     * 本字段保留为 shell 入口闸门 / 测试观测信号（`_openLevelsFromMenu` 读它）。
     * ⚠ 视觉呈现（是否画锁、画在哪）归美术批；本字段只给判断，⛔ 新热区、⛔ 弹窗。
     * 缺省（旧调用方 / 合成数据）⇒ `undefined`。
     */
    readonly arcTicketOpen?: boolean;
    /**
     * `[WXG-T-345]` **累计星进度件 已得/门槛**（S-4；`ux v1.11 §4.1` 甲臂）的分子 / 分母，**只读**。
     * 已得 = 该章历史最高星求和；门槛 = 满星容量 − floor(关数 × 2 / 3)（1–2 关短章 = 关数）。
     *
     * ⚠ **取值归属**（C 拍定）：恒指**阻断该页入口的上一章**（⛔ 被锁页自身：它恒 0★、无色可读）。
     * ⚠ **不创建**：门槛=0 / 首章无阻断 / 门票已达成 / 入口已得 ⇒ 两个字段均为 `undefined`
     * （⛔ 造 `0/0`）——「有进度件」的唯一标志 = `arcStarNeed !== undefined`。
     * ⚠ **落码读数**：现只渲染**一处** —— 选关页空带章名下方（`LEVELS_NAV_H / 2` 派生），数字直拼
     * `★ n/门槛`（与顶栏 `❤ n/n` 同族，⛔ 新文案令牌）。WXG-T-346 原有的「走马灯木牌次行」那条腿，
     * 已由 `[WXG-T-598]`（2026-11-07 用户令「应该是关序『第 N 关』」）换成关序 ⇒ **木牌不再消费本组**。
     * 锁图元未画：字段仅在未达成时创建 ⇒ 锁恒真、零信息量；位置与尺寸待 art 批（`§8.2 TODO-11`）。
     * 文案前缀 / 字号的视觉微调仍归 art 批（`§8.2 TODO-8`）。
     */
    readonly arcStarGot?: number;
    readonly arcStarNeed?: number;
    /**
     * **走马灯作品图位**（`[WXG-T-281]` 用户裁定：走马灯中间只展示作品图、未通关置灰、点图进选关）：
     * `carouselLevel` = 当前陈列关 —— `[WXG-T-913]` 起 = **本大关解锁范围内第一个 0 星关**（与
     * `currentLevelIndex` 同口径；全通 / 未解锁 ⇒ 回落大关收尾关 boss），用户 2026-11-12 令
     * 「主界面展示的应该是曼陀罗第三关，也就是推到的 0 星关」；**每帧零 `difficultyOf`**。
     * 无可陈列 ⇒ `undefined` ⇒ 虚线空槽。与 {@link wallLevels} 同理 ⇒ 视图 ⛔ 不 `import { LEVELS }`。
     */
    readonly carouselLevel: BeadsLevelRaw | undefined;
    /**
     * `[WXG-T-913]` 木牌关名 = **大关名**（`ARCS[页].title`，如「曼陀罗」）。陈列关变成中途小关后，
     * 小关自身没有展示名 ⇒ 关名由大关供给；缺省 ⇒ 视图回落 `carouselLevel.title`（旧合成数据兼容）。
     */
    readonly carouselTitle?: string;
    /**
     * `[WXG-T-914]` 木牌**第二行状态词**（缺省 ⇒ 视图照旧画 `第 {陈列关} 关`）：
     * 本章全通 ⇒「已通关」、整章未解锁 ⇒「未开启」；只在「陈列关回落 boss」时供给
     * （有在推的关 ⇒ 恒关序）。值来自 `COPY_TOKENS.plate_arc_*_label`。
     */
    readonly carouselSeqLabel?: string;
    /**
     * `[WXG-T-280]` 逐机落位锚（菜单链，落地单 §2）。shell 在 init/resize 时经
     * `menuAnchors()` 算定一次并恒存 ⇒ 每帧只读引用（⛔ 不得逐帧新建，L5/零分配）。
     * 不传（旧调用方/单测）⇒ 走模块级 {@link DEFAULT_MENU_ANCHORS}（SAFE 常量兑底的锚定档；
     * 第十四批静态档版面已整体退场，⛔ 不再存在第二套菜单几何）。
     * 绘制与 `hitTestMeta` **必须共读同一对象**。
     */
    readonly anchors?: MenuAnchors;
    /**
     * `[WXG-T-280]` Boss 图位三态（缺省视图按在册数据推定：有卡=cleared，有解锁=pushing，余=locked）。
     */
    readonly carouselState?: MetaBossState;
    /**
     * `[WXG-T-566]` 当前大关页的**已完成小关数 / 总小关数**（用户 2026-11-02 裁：
     * 「当前完成小关数量 / 总小关数量 = 当前大关的进度」）。原「木牌第二行直拼 `N/M`」已由
     * `[WXG-T-598]`（2026-11-07 用户令「木牌只留关名 + 关序」）摘下 ⇒ 现**唯一**消费面是橱窗竖向揭彩
     * 比例（`view/meta-menu.ts::wipeFx`，⛔ 不是死字段）。
     * shell 与 {@link carouselState} 同源遍历 `levelRefs` 产出；视图只渲染、⛔ 自算（L5）。
     * 空橱窗页 / 无归属 ⇒ `undefined`（⛔ 造 `0/0`）。
     */
    readonly carouselArcDone?: number;
    readonly carouselArcTotal?: number;
    /**
     * 当前大关页的橱窗图（EP13-S4：shell 按 `ARCS[页].textureId` 取图，⛔ 视图不查表）。
     * 缺省 ⇒ 落程序化缩略（旧调用方/合成数据兼容，不硬绑首个大关图）。
     */
    readonly carouselTextureId?: string;
    /** 相邻大关页的橱窗图（同上，按 `ARCS[相邻页]` 取）。 */
    readonly carouselPeerTextureId?: string;
    /**
     * 走马灯视觉偏移（设计 px，正 = 内容右移）。`reduceMotion` 时视图忽略它，改用 {@link carouselT} 淡变。
     * 缺省 0。
     */
    readonly carouselDx?: number;
    /** 0..1，朝相邻项走了多少。木牌文字按它做两段淡变。缺省 0。 */
    readonly carouselT?: number;
    /** 正在露出的相邻项。没有则不画。`[WXG-T-913]` 陈列关 = 该页解锁内第一个 0 星关（全通回落 boss）。 */
    readonly carouselPeer?: BeadsLevelRaw;
    /** `[WXG-T-913]` 相邻大关页木牌关名（大关名；缺省 ⇒ 回落 `carouselPeer.title`）。 */
    readonly carouselPeerTitle?: string;
    /** `[WXG-T-914]` 相邻大关页木牌第二行状态词（同主车口径；缺省 ⇒ `第 N 关`）。 */
    readonly carouselPeerSeqLabel?: string;
    readonly carouselPeerState?: MetaBossState;
    /**
     * `[WXG-T-566]` 相邻大关页的完成度（与 {@link carouselArcDone} 同源、同口径）。
     * 对页推关态的竖向揭彩按它算 ⇒ 滑动中的两页各自进度，⛔ 不借用主车进度（会跳变）。
     */
    readonly carouselPeerArcDone?: number;
    readonly carouselPeerArcTotal?: number;
    /** 相邻项在哪一侧：+1 在右（下一项），-1 在左。缺省按 `carouselDx` 的符号猜。 */
    readonly carouselPeerSign?: -1 | 1;
    /** 下标 = `ARC_OPEN_MAX` 的空橱窗。中间置灰花，木牌写「敬请期待」。 */
    readonly carouselComingSoon?: boolean;
    /**
     * `[BD-62]` 走马灯**边界可见性**：首张 = 无上一可翻，末张 = 无下一可翻。
     * 用户 2026-10-19 定的设计预期：「末张卡应左边有按钮、右边按钮消失」（首张对称）。
     * 旧行为 = 两端按钮**一直画**，点了被 `_nudge` clamp 掉 → 看着能点实际无反应。
     * 只影响**绘制**；热区表按 anchors 缓存（不能按数据裁），且边界处本就零效果 ⇒ 不可见热区为无害空点。
     */
    readonly carouselFirst?: boolean;
    readonly carouselLast?: boolean;
    readonly carouselPeerComingSoon?: boolean;
    /**
     * `[WXG-T-490]` 走马灯是否停在**起点页**（= 续玩关所属大关页，`menu-architecture §5.4` 条 4）。
     * 壳比较 `offset` 与起点页号得出；视图零语义只读。
     * **可选**：缺省（旧调用方 / 夹具）= 起点页 ⇒ 主钮文案与艺术字逐字不变。
     */
    readonly carouselOnStartPage?: boolean;
    /**
     * `[WXG-T-490]` 主钮浏览态文案的真实目标关号（续玩位 1-based = `play.currentLevel.id`）。
     * 仅 {@link carouselOnStartPage} 为 false 时被 {@link MetaAction} `start` 的文案腿消费；
     * 缺省 0 ⇒ 不替换（防 `{n}` 空插值）。
     */
    readonly startLevelSeq?: number;
    /** 宿主配了 beads-studio 服务地址 ⇒ 设置页画「在线导入」钮（WXG-T-179；缺省不画）。 */
    readonly studioEnabled?: boolean;
    /**
     * **按下态**（P3 · screens.md 控件矩阵「按下」列）：手指按住处的控件 = `hitTestMeta` 返回的
     * **同一缓存对象**（视图按引用比对 ⇒ 零分配）；未按 / 未命中 ⇒ `null` / 缺省。
     */
    readonly pressed?: MetaButton | null;
    /**
     * `[WXG-T-935]` 设置弹窗中间可视窗的已滚量（设计 px，≥0；缺省 0 = 未滚）。
     * shell 每帧只读投影；绘制与命中同读本值 ⇒ 滚动后「画 A 位、按 B 位」结构性不可能。
     */
    readonly settingsScroll?: number;
    /** `[WXG-T-432]` 好友榜面板只读视图（shell 每帧覆盖；缺省 = 关档 ⇒ 不画）。 */
    readonly rank?: RankPanelView;
    /**
     * `[WXG-T-470/471/472]` 批1 元游戏派生投影（shell 只读计算 → 视图零分配消费）。
     * 均从已有 `starsByLevel[]` / `meta.*` 派生，零新存档字段。
     */
    readonly totalStars?: number;
    readonly clearedCount?: number;
    /**
     * `[WXG-T-601]` 关卡详情弹窗（选关卡卡 → 详情 → 开始）：
     * `detailLevelIndex` = 展示中的关（0-based，缺省/`-1` = 未开）；`detailLevel` = 该关引用
     * （shell 在 `pick-level` 时从 `_wallBaseLevels` 解析，视图 ⛔ 自查关表，同 {@link wallLevels} 约束）。
     * `powerupStocks` = 三道具可用数（熨斗/筛子/扫帚各 0..1，账号级免费每型 1 次 ⇒ 未用=1），
     * shell 从 `meta.powerupFreeUsed` 三布尔派生（预分配常量表，零逐帧分配）。
     * 三字段均可选（缺省 = 未开详情 ⇒ 视图零命令），单测 mock 免补。
     */
    /**
     * `[WXG-T-602]` 详情副标题用**大关名**（`ARCS[levelsArc].title`，如「曼陀罗」）；
     * 缺省 ⇒ 视图只显「第 N 关」。shell 打开详情时投影，视图 ⛔ 自查关表（L5）。
     */
    readonly detailChapterTitle?: string;
    readonly detailLevelIndex?: number;
    readonly detailLevel?: BeadsLevelRaw;
    readonly powerupStocks?: readonly number[];
}

/**
 * **K-6 同帧差分装置的可测参参**（EP12-S6 · T-2B / Deliverable 4）。
 *
 * ⚠ 生产链路（`beads-shell`）**不传 ⇒ 永不命中本分支**，默认值逐字取 `tuning.ts` 的在册档
 * ⇒ 行为/热区/帧内容与本参引入前逐字节一致（`tests/menu-primitives-k6.test.ts` 钉「不传 ≡ 传默认值」）。
 * 存在理由 = 把「图元 +N」钉成**真跑帧的实测差分**（K-051 禁纸面值）：三组对照 =
 * 招牌 beadText on/off、陈列格 3→2 行、缩略 5/4/3 档（= T-1 §3.8 回退序 1/2/3/5）。
 * ⛔ 不得拿本参当运行时降本开关（那会把版面档塞进命路，且越回退序「逐级触发」的口径）。
 */
export interface MetaViewVariant {
    /** 招牌 beadText 开关（false ⇒ 不上珠拼，也不回落文字 ⇒ 纯差分基腿）。 */
    readonly signage?: boolean;
    /** 陈列行数（缺省 `WALL_ROWS`；2 = 回退序 1）。 */
    readonly wallRows?: number;
    /** 缩略字模阵（缺省 `THUMB_MATRIX_N`；4 / 3 = 回退序 2 / 3）。 */
    readonly thumbN?: number;
}

/** A tappable control on a meta screen. */
export type MetaAction =
    | 'start'
    | 'open-signin'
    | 'open-settings'
    | 'open-levels'
    | 'pick-level'
    | 'studio-import'
    /** `[WXG-T-280]` 橱窗 ◀▶ 翻页（落地单 §3；目标集合 = shell 的已通序，视图零语义）。 */
    | 'carousel-prev'
    | 'carousel-next'
    | 'back'
    | 'claim'
    | 'toggle-bgm'
    | 'toggle-sfx'
    | 'toggle-reduce-motion'
    | 'toggle-large-text'
    | 'toggle-vibrate'
    | 'toggle-debug-info'
    /** 设置 Debug：安全区标定线。与 `PausePanelAction` 同串值，shell 走 default → `applySettingsAction`。 */
    | 'toggle-debug-guides'
    /**
     * `[WXG-T-434]` E4 幽灵符号开关（暂停面板行5）。同串值通道：shell 走 default →
     * `applySettingsAction`；⛔ 不进设置弹窗 `MENU_ORDER`（5 行已满）。
     */
    | 'toggle-ghost-symbol'
    /** EP11-S5：与 `PausePanelAction` 同名同语义的选择器钮（行4）；shell 直串值入
     *  `BeadsGame.applySettingsAction`（既有通道，⛔ 不新造动作名）。 */
    | 'cycle-bead-style'
    | 'cycle-bead-size'
    /** EP12-S8 行4 第三枚选择器钮：整套皮肤（与暂停面板同一批 game setter，内容单源）。 */
    | 'cycle-skin'
    /**
     * `[WXG-T-363]` 装扮馆入口（顶栏中档 x=560，`[WXG-T-365]` 由设置弹窗行5 左格上提，提案 P4-甲）；
     * 受理归 shell（`PhaseRouteBinder.openModal('skins')`），⛔ 不进 `GameSettings.apply`。
     * 顶栏 = 无字圆钮 ⇒ 不走 `settingsContentLabel`（设置行5 左格已回到 `cycle-skin`）。
     */
    | 'open-skins'
    /** `[WXG-T-432]` 主菜单「好友榜」纸钮（CTA 左侧；查看总榜）。 */
    | 'open-rank'
    /**
     * `[WXG-T-363]` 装扮馆卡（点 = 已拥有则穿上 / 未拥有先买后穿，买断闭环归 shell）。
     * 卡序走 {@link MetaButton.slot}（= `registeredSkins()` 注册序下标），⛔ 视图不传 skinId。
     */
    | 'skin-tap'
    /** `[WXG-T-472]` 名片入口（批1）。 */
    | 'open-profile'
    /** `[WXG-T-601]` 关卡详情弹窗「开始」CTA → 进 `detailLevelIndex` 指向的关。 */
    | 'start-detail'
    /** `[WXG-T-604]` 关卡详情关闭：右上角 ✕ 角钮 / 点木牌外空白（遮罩带）⇒ 同「返回选关页」。 */
    | 'close-detail'
    | 'dismiss-detail'
    /**
     * `[WXG-T-605]` 选关弹窗关闭：沿用详情木牌 ⇒ 右上角 ✕ / 点木牌外空白同效，语义 = 回主菜单。
     * ⛔ 复用 `close-detail` 会让 shell 误清详情态；本页用独立动作名。
     */
    | 'close-levels'
    | 'dismiss-levels'
    /**
     * `[WXG-T-936]` 设置弹窗关闭：右上角 ✕ / 点木牌外空白，语义 = 关设置弹窗。
     * ⛔ 复用 `back` 会让底部返回与右上 ✕ 无法分画（`drawCloseInset` 的按下态按 id 判）。
     */
    | 'close-settings'
    | 'dismiss-settings';

export interface Box {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

export interface MetaButton {
    readonly id: MetaAction;
    readonly box: Box;
    /**
     * `pick-level` 携带的**墙槽位**（0-based，`0 .. WALL_CAPACITY-1`；其余 按钮 undefined）。
     * ⚠ 槽位 **≠ 关索引**：陈列序 = 配置文件顺序（EP12-S6 已退役 DI 升序，现码恒等），仍须经
     * shell 的 `wallSlots` 映射解析（视图内拿不到、也不该拿到关索引）。
     * 旧字段名 `levelIndex` 正是 `beads-shell.ts::_wallSlotsFor`「按槽当关」回归的温床，就此**更名根治**。
     * `[WXG-T-363]` `skin-tap` 共用本字段 = 皮肤**注册序下标**（解析腿 = `registeredSkins()[slot]`）。
     */
    readonly slot?: number;
}

export interface MetaLayout {
    readonly buttons: readonly MetaButton[];
    /** 签到 overlay 的 7 个日期格（只读展示，非按钮）。 */
    readonly signinCells: readonly Box[];
}

/**
 * `[WXG-T-280]` 橱窗 Boss 图位状态（语义归 shell，视图只读）。
 * `locked` 未开启 / `pushing` 推关中 / `cleared` 全通关 / `fullstar` 全满星（`[WXG-T-579]`，画珠圈框）。
 */
export type MetaBossState = 'locked' | 'pushing' | 'cleared' | 'fullstar';

