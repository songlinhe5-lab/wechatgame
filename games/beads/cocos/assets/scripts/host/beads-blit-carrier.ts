/**
 * Beads 的 Cocos **blit 载体实现体**（WXG-T-253 / ADR-0030 S5′-1）。
 *
 * 在册裁定：`§3 DEC-1 = 甲′`（按色图集 + `Sprite` 池），`§5.2` 三条门禁已裁，其中**裁② 已由
 * WXG-T-256 改判（裁②′）**：容器板与三层背景整块退役 ⇒ 底图 = 单层 `palette.background`，
 * 由宿主底图提交体铺满屏（⛔ 不烘、不占显存、零包体）；L2 整层重放 + 脏帧门控不变。
 * **S5′-1 珠层 + S5′-3 层序已落**（本文件节点挂在 `bindings.ts` 的 `BlitLayer` 下 ⇒ 恒在底图之上、
 * 矢量 UI 之下）；L0 离屏烘（裁② 原形）归 [R] 读数后的换代。
 *
 * 灰度闸：默认**开**（用户 2026-10-05 裁）。`?carrier=off`（web）或启动参数
 * `carrier=off`（wx）才不接线 ⇒ 回矢量臂（`off`/`0` 两个写法都收，`on`/`1` 仍兼容旧习惯）。
 * 开关关闭、离屏 canvas 不可用、mask 加载失败——三种情况都返回 `null` ⇒ 不注入载体
 * ⇒ 渲染走今日矢量臂（DEC-2 的「无载体 = 逐字节等价」，见 `cocos-renderer.ts`）。
 *
 * ⛔ **不留静默丢珠的中间态**：tint 运行时（`setBeadTintRuntime`）只在**需求集的 mask 全部就绪后**才注入
 * （需求集 = `requiredTintMaskIds()`，由档位宏派生，见 WXG-T-255）。反序就会出问题：blit 命令已经发出而载体还没备好 ⇒ 珠子
 * 既不画 sprite 也回不了矢量（`Graphics` 画不出 `blit`）= 静默消失。
 *
 * 取证同源：`spike/carrier-bench.ts` 的 `atlas` 臂（ADR-0030 §5.0.1 `[E]` 档读数
 * 就是这条路径）。本文件是它的生产化——⛔ 不重造合成，只换资产来源与生命周期。
 */

import { AssetManager, assetManager, Color, Graphics, ImageAsset, Node, Rect, Size, Sprite, SpriteFrame, sys, Texture2D, UIOpacity, UITransform } from 'cc';

import type { CocosBlitCarrierLike, CocosClipHostLike } from '../framework/adapters/cocos/cocos-renderer';
import type { BlitCommand } from '../framework/core/render/render-model';
import {
    TintSpriteCache,
    type TintCanvasLike,
    type TintContext2DLike,
    type TintImageDataLike,
} from '../framework/adapters/canvas2d/tint-sprite-cache';
import { MASK_CANONICAL_SIZE } from '../framework/core/bake/mask-spec';
import { MASK_TILE_SUFFIX, maskTileInnerPx } from '../framework/core/bake/mask-tile';
import { BEAD_PITCH, BELOW_GRAPHICS_TEXTURE_IDS, BOSS_THUMB_TEXTURES, LEVEL_DETAIL_TEXTURES, LEVEL_SELECT_TEXTURES, MENU_TEXTURES, POWERUP_RESTORE_BASE_TILE, POWERUP_TILE_TEXTURES, TILE_BLEED, TIMEOUT_TEXTURES } from '../game/config/tuning';
import { OPEN_ARCS } from '../game/config/arcs';
import { tintFxBase } from '../framework/core/bake/tint-composite';
import { frostGrayCombined, frostPixels, frostRead, grayFxRead, grayWipeRead } from '../framework/core/bake/gray-fx';
import { nineSliceFxRead } from '../framework/core/bake/nine-slice-fx';
import { createWhitelistBeadTintRuntime, setBeadTintRuntime } from '../game/view/bead-render';
import { requiredTintMaskIds } from '../game/view/bead-tint-mask';
import { setLevelThumbBitmapResolver } from '../game/view/menu-signage';
import { setMenuBitmapResolver } from '../game/view/meta-view';

/**
 * 单帧 bead 消失的宿主腿取证（默认关，关时零分配；K-216：harness 腿对此结构性盲）。
 *
 * 开法：web `?blitdbg=1` / 微信启动参数 `blitdbg=1` / 真机 console `__BLITDBG(true)`。
 * 每帧一行 `tile/bead/used/bail/inactive` 计数 + 相邻 tile→bead 的层序检查；
 * 一帧 `bead` 掉 1 而 `tile` 不变 ⇒ 标 `BEAD_DROP`（= 用户所见「槽突然空了」）。
 * 每个被 `_bail` 的 textureId 都单独打（K-216：warn-once 按原因会掩盖后犯 id）。
 */
type BlitDbgRec = { tex: string; kind: 'tile' | 'bead' | 'other'; x: number; y: number; parent: string; sib: number; active: boolean };
let _blitDbg = false;
let _blitDbgRecs: BlitDbgRec[] = [];
let _blitDbgBails: string[] = [];
let _blitDbgFrame = 0;
let _blitDbgPrevTile = -1;
let _blitDbgPrevBead = -1;
const _dbgHost = globalThis as unknown as {
    __BLITDBG?: (on?: boolean) => boolean;
    wx?: { getLaunchOptionsSync?: () => { query?: Record<string, string> } };
    location?: { search?: string };
};
let _dbgWxFlag: string | undefined;
try { _dbgWxFlag = _dbgHost.wx?.getLaunchOptionsSync?.()?.query?.blitdbg; } catch { /* 宿主未就绪 ⇒ 仅 web/console 开关 */ }
const _dbgFlag = _dbgWxFlag ?? /[?&]blitdbg=([^&]+)/.exec(_dbgHost.location?.search ?? '')?.[1];
_blitDbg = _dbgFlag === '1' || _dbgFlag === 'true';
// [WXG-T-1102] 回显 + 无参查询：真机远程 Console 能自证开关是否生效（默认关时零开销）。
_dbgHost.__BLITDBG = (on?: boolean): boolean => {
    if (on !== undefined) _blitDbg = !!on;
    console.warn(`[blitdbg] switch ${_blitDbg ? 'on' : 'off'}`);
    return _blitDbg;
};

/**
 * 图集网格：8×8 格 × 128 px = 1024²（一格 = 一个 `maskId|base` 组合）。
 *
 * `[WXG-T-254]` **底 tile 带来的键数增量（记账，⛔ 本批不扩图集）**：热路径 `maskId` 从
 * 4 个变 6 个（bead / grid tile / grid 原图 × 两档）。`maskGauge` 由 `snap.beadSize` 全局定档
 * ⇒ **单关只用一档** ⇒ 常规工作集 `3 面 × BEAD_COLOR_MAX 10 = 30 格`；两档交汇的瞬时最坏
 * `60 格 ≤ 64`——仍装得下，但只剩 4 格余量。
 * 越界的后果不是崩而是 `_cell()` 打一条 warn 后不落新配色 ⇒ 观感缺一块。
 * ponytail: 余量真被吃掉时再抬 `ATLAS_ROWS` 到 12（+2 MiB）或按关切换色集清空 `_cells`，
 * 二者均需真机读数拍板。⛔ 不要为此把 grid 原图从图集里剔掉 —— 它是 wrong 抖动格的回退路径。
 */
const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;

/**
 * `[WXG-T-254 / S5′-2]` **L0 底 tile** 画布里格面内容占的像素（128 × 30/33 ≈ 116）。
 *
 * 画布边长 = 格距 + 2×出血（= 旧 B0 rect 的 33dp，负责盖格缝），内容恒为格径 30dp
 * ⇒ ⛔ 不拉伸。口径与动因见框架 `core/bake/mask-tile.ts`；图集格仍 128² ⇒ **零显存增量**。
 */
const TILE_INNER_PX = maskTileInnerPx(BEAD_PITCH + TILE_BLEED * 2);

/**
 * mask 逻辑名 → Cocos 资产坐标（正本 = `tools/mask-preview/cocos-assets/*.png`，入包件恒为**定稿原样 RGBA PNG**
 * （mask 的 R/G/B 是 shader 系数，⛔ 不过调色板量化；视觉件才走量化 PNG，微信白名单不含 webp `[WXG-T-282]`）
 * `[WXG-T-281]`：编码输入只允许 lossless（已验逐位一致），⛔ 不新造资源）。
 *
 * 两个字段各有用（WXG-T-255）：
 * - `path` = **bundle 内路径**（相对 bundle 根 = 文件夹本身，无扩展名）⇒ `Bundle.load()` 认的形式；
 * - `uuid` = 全局形式 ⇒ 只作回退腿（`assetManager.loadAny({ uuid })`：bundle 取不到时兼容旧产物），
 *   同时是构建产物门禁（`tools/scripts/check-cocos-mask.mjs`）的定位锚。
 *
 * `[WXG-T-255]` 本表是**四张完整目录**（两档全量）⇒ 档位宏（`TINT_MASK_GAUGE_PIN`）无论钉哪一档本文件
 * **零改动**；实际装载哪几张由下面的需求集定（在册 = `null` ⇒ 四张全要，产物已验 4/4）。
 *
 * ⚠ `assets/textures` **已配成 Bundle**（2026-10-05 编辑器落地）⇒ 产物实测：两张 `holeless` **只在**
 * `assets/textures/native/`（两张 `holed` 因被 `.mtl` 引用而另有一份在 `main/`）⇒ 装载腿走
 * `assetManager.loadBundle(MASK_BUNDLE)`。两条腿哪条生效会在 warmup 里打一行日志（⛔ 不许静默）。
 * 产物级校验收在 `pnpm run check:cocos-mask`。
 */
const MASK_ASSETS: Readonly<Record<string, { uuid: string; path: string }>> = {
    'mask__bead__holed': { uuid: 'b1330826-5069-49dd-aec6-15ca127c80d1', path: 'bead-hole-tint-128-mask' },
    'mask__bead__holeless': { uuid: '29396c51-96d5-47ac-b365-34d9f1cc599a', path: 'bead-holeless-tint-128-mask' },
    'mask__grid__holed': { uuid: 'f384842f-4f57-469c-a088-e07e16dd3fd1', path: 'grid-hole-tint-128-mask' },
    'mask__grid__holeless': { uuid: '53ccf050-9caa-4bc5-9a95-5cb8562f4db4', path: 'grid-holeless-tint-128-mask' },
};

/**
 * 本宿主**实际要装**的那几张（`[WXG-T-255]` 由档位宏派生，⛔ 不写死 4 张）。
 *
 * 为什么需要它：构建产物实测只包得到 `holed` 两张（另两张无构建期引用），而 warmup
 * 旧前提「4/4 齐才注入」⇒ `carrier=on` 在**任何构建档**都永不到 4 张 ⇒ 永远静默回退矢量臂。
 * 需求集改为跟随宏 ⇒ 注入前提当场可达（编辑器和构建档同一条结论），且与 harness 同源。
 */
const MASK_IDS: readonly string[] = requiredTintMaskIds();

/**
 * `[WXG-T-271 / ADR-0031]` 静态位图表（`textureId` → bundle 内路径）。
 *
 * 菜单 UI 走现成 `textures`（已合并进主包）。大关橱窗图走 `OPEN_ARCS`（本版开放的前 N 个）。
 * 以 `loadAny({bundle, path})` 按路径取，**不依赖 uuid**。path 无扩展名。
 * 装载失败 / 资产未导 ⇒ 不登记 ⇒ 该元素回退程序化（不 gate `_ready`）。
 */
const ARC_TEXTURE_IDS: ReadonlySet<string> = new Set(
    OPEN_ARCS.filter((t) => t.textureId !== undefined).map((t) => t.textureId as string),
);
/**
 * `[WXG-T-585]` **必须 `trim = false` 的帧**（四周有透明边，靠原图留白对齐）。
 * 起因：`Sprite.trim = true` 时 Cocos 用导入后的 trimmed rect 当 uv 并**铺满节点 contentSize**
 * ⇒ 内容被拉伸、留白丢失。招牌 1098×722 的实测裁剪是 548×343（底部 18 设计 px 透明带），
 * 拉满 549×361 会纵向 +5.2% 变形；关掉 trim 才按 originalSize 居中。
 * ⛔ 新增「四周透明边」的帧必须同时登记到这里，判断口径 = meta 的 `width/height ≠ rawWidth/rawHeight`。
 */
const NO_TRIM_TEXTURE_IDS: ReadonlySet<string> = new Set<string>([
    ...ARC_TEXTURE_IDS,
    MENU_TEXTURES.signboard,
]);

const BITMAP_ASSETS: Readonly<Record<string, { path: string; bundle?: string }>> = {
    // `[WXG-T-1023]` boss 展品装载派生行退场（用户裁定「没用」轻量清理：themes 运行时副本
    // `l9-boss-mandala-256` / `photo32-smoke-boss-256` 已删）——原行
    // `...Object.fromEntries(OPEN_ARCS.map((t) => [t.textureId, { path: t.art, bundle: t.bundle }]))`
    // 不再登记 ⇒ `BOSS_THUMB_TEXTURES` 命中但 `_bitmaps` 无键 ⇒ resolver 返 undefined
    // ⇒ 橱窗 / boss 格走在册程序化缩略臂（ADR-0031 绿线锚）。未来换稿零代码接回：
    // 恢复本派生行 + 投放 themes 副本（ARCS.showcase 与母版 `design/levels/assets/` 均未动）。
    // `[WXG-T-280]` 主菜单位图 16 件（正本 = `design/art/final/assets/menu/`，拷入现成 `textures` Bundle；
    // ⛔ 不新分包）。全部入库为调色板量化 PNG（微信包内白名单不含 webp，见代码包文档）；
    // 未导入/解不出 ⇒ 不登记 ⇒ 该元素程序化腿（同 boss 缩略语义，不 gate `_ready`）。
    [MENU_TEXTURES.btnCircle]: { path: 'ui_btn_circle_normal' },
    [MENU_TEXTURES.btnCirclePressed]: { path: 'ui_btn_circle_pressed' },
    [MENU_TEXTURES.iconSettings]: { path: 'ui_icon_settings' },
    // `[WXG-T-1013]` iconSound 件出包：tuning 键保留为「公告条目图标」候选件 + 旧文案债留档，
    // 但 WXG-T-493 起零画法消费 ⇒ 不再预装载（原 `ui_icon_sound.png` 2.9 KB 已删）。
    // `[WXG-T-581]` iconMail / woodFrame 两件零消费者已删键出包（日志登记过期，见 tuning 注）。
    [MENU_TEXTURES.iconCalendar]: { path: 'ui_icon_calendar' },
    [MENU_TEXTURES.iconRank]: { path: 'ui_icon_rank' },
    [MENU_TEXTURES.iconSkins]: { path: 'ui_icon_skin' },
    // WXG-T-577：path 仍为 Cocos 扁平原名（投放件未改名），键按语义改名；未导入 ⇒ 走程序化腿。
    // WXG-T-578：旧 `frame`（沙漏圆牌）/ `seal`（通关飘带）两条映射随件退场 —— 两件已出包。
    [MENU_TEXTURES.lock]: { path: 'ui_menu_badge_locked' },
    // `[WXG-T-579]` 满星态珠圈框（正本 854² → 投放 518² pal-256，1x；@2x 需 158 KB 超出主包余量）。
    [MENU_TEXTURES.arcRing]: { path: 'ui_menu_arc_ring' },
    [MENU_TEXTURES.beam]: { path: 'ui_menu_beam' },
    // `[P0 静态温暖 · 2026-10-31]` 整屏木屋背板。未导入 ⇒ 不登记 ⇒ `drawMenuBackdrop` 走程序化底。
    [MENU_TEXTURES.backdrop]: { path: 'ui_menu_backdrop' },
    // `[WXG-T-585]` 甲案整张扩图（750×1750，JPEG q85）。只在 baked 腿消费 ⇒ 未导入时自动回退三图。
    [MENU_TEXTURES.backdropFull]: { path: 'ui_menu_backdrop_expanded' },
    // `[WXG-T-585]` 2026-11-07 宿主接入批：v2 件**独立 key**（v1 腿仍用上面的老件，⛔ 不许换 key 共用）。
    // 招牌 1098×722（绳 118）；开始钮整枚 378×179（「开始」已烘进图，源 756×358）。
    [MENU_TEXTURES.signboard]: { path: 'ui_menu_signboard' },
    [MENU_TEXTURES.ctaV2]: { path: 'ui_menu_cta' },
    [MENU_TEXTURES.ctaPressedV2]: { path: 'ui_menu_cta_highlight' },
    // 翻页钮四件两两成族（normal ↔ highlight）+ 通关章：`drawArrow` / 盖章处本来就有 baked 分支
    // ⇒ 登记后 v2 档走整枚位图，未登记时仍回退 v1「圆底 + 向标」与「不盖章」，零回归。
    [MENU_TEXTURES.prevBtn]: { path: 'ui_menu_arrow_left' },
    [MENU_TEXTURES.prevBtnPressed]: { path: 'ui_menu_arrow_left_highlight' },
    [MENU_TEXTURES.nextBtn]: { path: 'ui_menu_arrow_right' },
    [MENU_TEXTURES.nextBtnPressed]: { path: 'ui_menu_arrow_right_highlight' },
    [MENU_TEXTURES.seal]: { path: 'ui_menu_seal' },

    // `[WXG-T-601]` 关卡详情道具行框图（336² @4x）。`[WXG-T-1019]` 用户裁定「拆分共背景」：
    // 三件 tile 环带逐像素同源 ⇒ 背景件 + 三件道具件（两段 blit）。投放件未导入 `textures`
    // Bundle 前 ⇒ `loadBitmapSpriteFrame` 返 null ⇒ 不登记 ⇒ 详情页走程序化单字徽章（零回归）。
    [POWERUP_RESTORE_BASE_TILE]: { path: 'powerup_restore_base' },
    [POWERUP_TILE_TEXTURES.windowRestore]: { path: 'powerup_restore_icon_window' },
    [POWERUP_TILE_TEXTURES.randomRestore]: { path: 'powerup_restore_icon_random' },
    [POWERUP_TILE_TEXTURES.trayRestore]: { path: 'powerup_restore_icon_tray' },

    // `[WXG-T-602]` 关卡详情四件（投放件均 @2x：木牌 1162×2088 / 开始钮 652×308 / 星 116×120）。
    // 未导入 `textures` Bundle ⇒ 不登记 ⇒ 详情页逐元素回退（纸面板 / 通用主钮 / 文字星），零回归。
    [LEVEL_DETAIL_TEXTURES.plaque]: { path: 'detail/ui_dialog_bg_tall' },
    // `[WXG-T-1027]` 通用长背景 = 木牌图，独立键走容器 UI 层（真机可见），不入 below 白名单。
    [LEVEL_DETAIL_TEXTURES.dialogBg]: { path: 'detail/ui_dialog_bg_tall' },
    [LEVEL_DETAIL_TEXTURES.start]: { path: 'detail/ui_detail_start' },
    [LEVEL_DETAIL_TEXTURES.starFilled]: { path: 'detail/ui_detail_star_filled' },
    [LEVEL_DETAIL_TEXTURES.starEmpty]: { path: 'detail/ui_detail_star_empty' },
    // `[WXG-T-607]` 选关九宫格单格模板。⚠ `.meta` 须由 Cocos 编辑器 reimport 签发（L1）；
    // 未签发 ⇒ `textures` Bundle 不含此件 ⇒ `_bitmaps` 未命中 ⇒ 自动走程序化木托盘降级腿。
    [LEVEL_SELECT_TEXTURES.cell]: { path: 'detail/ui_level_select_cell' },
    // `[WXG-T-609/1027]` 橱窗面板（玻璃 + 射灯 + 圆台）；T-1025 曾误改名为 `ui_dialog_bg_tall`，
    // 用户订正后还原 `ui_detail_showcase`（长背景是木牌件）。玻璃半透明 ⇒ 保留完整 alpha。
    [LEVEL_DETAIL_TEXTURES.showcase]: { path: 'detail/ui_detail_showcase' },
    // `[WXG-T-610]` 选关弹窗稿面补件（Figma `159:3`）。⚠ `.meta` 待编辑器签发（L1）；
    // 未签发 ⇒ 逐元素走程序化降级腿（格 / 星文字档 / 木钮），零功能回归。
    [LEVEL_SELECT_TEXTURES.tray]: { path: 'detail/ui_level_select_tray' },
    // `[WXG-T-1013]` 三态格底 + 锁图共 4 件出包（程序化腿接管）。`[2026-11-20]` 用户裁定恢复
    // 其中 2 件：normal 格底给非当前格铺底（整片不透明 ⇒ `BELOW_GRAPHICS_TEXTURE_IDS` 白名单
    // 压到 Graphics 之下）、稿面圆珠锁替代灰珠阵（`BlitLayerUI` 正常叠）；`cellCurrent` /
    // `cellLocked` 仍不回归，tuning 键留作「断言不画」哨兵。两件 `.meta` 从 `cf681f0b^`
    // 取回编辑器签发原件（⛔ 非手造，L1）。
    [LEVEL_SELECT_TEXTURES.cellNormal]: { path: 'detail/ui_level_select_cell_normal' },
    [LEVEL_SELECT_TEXTURES.lockImage]: { path: 'detail/ui_level_select_lock' },
    [LEVEL_SELECT_TEXTURES.starFilled]: { path: 'detail/ui_level_select_star_filled' },
    [LEVEL_SELECT_TEXTURES.starEmpty]: { path: 'detail/ui_level_select_star_empty' },
    [LEVEL_SELECT_TEXTURES.closeBtn]: { path: 'detail/ui_level_select_close' },
    [LEVEL_SELECT_TEXTURES.brand]: { path: 'detail/ui_level_select_brand' },
    // `[WXG-T-614]` 倒计时结束弹窗三件（木牌九宫格 capX120/capY300 源纹 px，走引擎 SLICED）。
    // ⚠ `.meta` 待编辑器签发（L1）；未签发 ⇒ 木牌回纸面板、钮回纯色圆角面，零功能回归。
    // `[2026-11-21]` 用户令通用化改名：plaque 件 → `ui_dialog_bg_short`（对话框短背景）。
    [TIMEOUT_TEXTURES.plaque]: { path: 'detail/ui_dialog_bg_short' },
    [TIMEOUT_TEXTURES.continueBtn]: { path: 'detail/ui_timeout_continue' },
    [TIMEOUT_TEXTURES.retryBtn]: { path: 'detail/ui_timeout_retry' },

    // `[2026-11-21]` v2 结算整张木牌 + 金星入包（sharp 调色板量化，`.meta` 由编辑器 asset-db 签发）。
    // 配套投放金星：木牌挂容器 `BlitLayerUI`，程序化五角星（`Graphics`）会被整片不透明木牌盖住。
    [MENU_TEXTURES.clearPanelBoard]: { path: 'ui_clear_panel_board' },
    [MENU_TEXTURES.clearStar]: { path: 'ui_clear_star' },
    // v1 纸面板 / 9-slice 木框已清理；以下两枚按钮底图是设置页缺图腿共用件 ⇒ 保留
    //（`[WXG-T-1019]` 按下态专用纹 `btnWoodPressed` 已随「连腿清理」裁定退场）。
    [MENU_TEXTURES.btnWood]: { path: 'ui_btn_wood_9s' },
    [MENU_TEXTURES.btnPaper]: { path: 'ui_btn_paper_9s' },
    // `[WXG-T-938 / -960]` 设置弹窗按钮底板（无字厚木 9-slice，源 235×210、capX 70）。
    // `.meta` 已由 Cocos 编辑器签发（uuid `6eb9947a-1b98-45d2-a21d-03e569e7a751`，2026-11-16）
    // ⇒ 本条已注册，设置腿自 `btnWood` 过渡换正式底板（`settings-content.ts::drawSettingsWoodButton`）。
    [MENU_TEXTURES.btnSettings]: { path: 'ui_btn_settings_9s' },
    // `[2026-11-20]` 结算双钮九宫格（端帽见 `CLEAR_NEXT_SLICE` / `CLEAR_MENU_SLICE`；.meta 已由编辑器签发）。
    [MENU_TEXTURES.clearNextBtn]: { path: 'ui_btn_clear_next_9s' },
    [MENU_TEXTURES.clearMenuBtn]: { path: 'ui_btn_clear_menu_9s' },
    // `[WXG-T-941 收尾]` 设置项 cell 的四枚图标 + 两枚开关（正本 = `final/assets/menu/settings/`，
    // 投放件去掉 `@2x` 后缀；像素尺寸与 `settings-content.ts::ICON_SRC` 逐一对应：109×115 / 116×105 /
    // 114×125 / 125×127，开关 168×95）。`.meta` 已由编辑器签发（2026-11-16）
    // ⇒ 「不画图标 / 程序化开关」的缺图腿不再命中。
    [MENU_TEXTURES.settingsIconMusic]: { path: 'ui_icon_music' },
    [MENU_TEXTURES.settingsIconSound]: { path: 'ui_icon_sound_settings' },
    [MENU_TEXTURES.settingsIconMotion]: { path: 'ui_icon_motion' },
    [MENU_TEXTURES.settingsIconVibrate]: { path: 'ui_icon_vibrate' },
    [MENU_TEXTURES.settingsToggleOn]: { path: 'ui_toggle_on' },
    [MENU_TEXTURES.settingsToggleOff]: { path: 'ui_toggle_off' },
};

/**
 * 必须画在 `Graphics` **之下**的静态位图（其余静态位图在其上，见 `accept`）。
 * harness 是单画布按命令序叠画：橱窗框先发、资源条/缩略珠后发，所以后者在框上。
 * Cocos 分层：Graphics（矢量）在 BlitLayer 之上，静态位图默认在 Graphics 之上 ⇒ 不透明的橱窗框
 * 会把框内的矢量图元（资源条板、缩略珠）整个盖住。把框放到 Graphics 之下，两端叠序一致。
 */

type AnyObj = Record<string, any>;

/**
 * 离屏 canvas：web = `document.createElement`，微信 = `wx.createCanvas`（无参 = 离屏）。
 * 返回 `null` = 本宿主没有 2D 离屏能力 ⇒ 调用方放弃载体（不是放弃珠子：矢量臂照旧）。
 *
 * ⚠ 与丙′ 的 `S0-1` 不是同一风险面：这里只在**预热期**用离屏 canvas 烘一次图集，
 * 不进每帧上传路径（丙′ 挂的正是「每帧整张 canvas 上传」）。
 */
function createOffscreen(w: number, h: number): TintCanvasLike | null {
    const host = globalThis as AnyObj;
    let c: AnyObj | null = null;
    if (host.document && host.document.createElement) {
        c = host.document.createElement('canvas');
    } else if (host.wx && host.wx.createCanvas) {
        c = host.wx.createCanvas();
    }
    if (!c) return null;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx || !ctx.getImageData || !ctx.putImageData || !ctx.drawImage) return null;
    return c as TintCanvasLike;
}

/**
 * 灰度开关（**默认开**，用户 2026-10-05 裁「默认 carrier=on，需要关闭才用 carrier=off」）：
 * `?carrier=off` / `0`（web）或启动参数同名（wx）才关；`on` / `1` 显式开（旧写法兼容）。
 */
function carrierSwitchOn(): boolean {
    const host = globalThis as unknown as {
        location?: { search?: string };
        wx?: { getLaunchOptionsSync?: () => { query?: Record<string, string> } };
    };
    const q = host.wx?.getLaunchOptionsSync?.()?.query?.carrier;
    const v = q ?? host.location?.search?.match(/(?:^|[?&])carrier=([^&]*)/)?.[1];
    return v !== 'off' && v !== '0';
}

class BeadsBlitCarrier implements CocosBlitCarrierLike {
    /** `maskId|base` → 图集格（首见即合成 + 整张重传；⚠ 只在换色时发生）。 */
    private readonly _cells = new Map<string, SpriteFrame>();
    private readonly _masks = new Map<string, object>();
    /** `[WXG-T-271 / ADR-0031 C′]` `textureId` → 预载全彩位图 `SpriteFrame`（静态位图注册表腿）。 */
    private readonly _bitmaps = new Map<string, SpriteFrame>();
    /**
     * `textureId` → 可 `drawImage` 的原图（`ImageAsset.data`）。
     * 真机/模拟器上 `SpriteFrame.texture.image` 可能不可读（bake 取不到像素 ⇒ 揭彩帧烘不出），
     * 这里与 `loadImageAsset` 同源另存一份，供 gray / wipe / frost 预烘读取。
     */
    private readonly _bitmapImages = new Map<string, object>();
    /**
     * `[WXG-T-566]` `textureId|gray` → 预烘灰化 `SpriteFrame`（菜单三态）。
     *
     * 为什么在 CPU 烘而不是走 `tint-mask.effect`：那张 effect 只采样 `maskTexture`
     * （R/G/B 是 tint 系数），全彩 PNG 进它的 R 通道不是暗系数 ⇒ 灰化结果错。
     * 大关原图仅 256²（`OPEN_ARCS[].art`）⇒ 每纹理一档，显存可接受；且与既有
     * `TintSpriteCache` 的 CPU 合成架构同源（零 material / 零编辑器资产）。
     * `[WXG-T-567]` 菜单未开启态已改走 `frost`（模糊 + 全灰），本腿保留为框架通用档位。
     */
    private readonly _grayBitmaps = new Map<string, SpriteFrame>();
    /**
     * `[WXG-T-566]` **每纹理最新一档**竖向揭彩帧（推关三态）。进度单调递增 ⇒ 旧档不再显示，
     * 只留最新；换档时**复用同一 `Texture2D` 重新 upload**（`carrier-bench` 同款做法）⇒
     * 显存上限 = 大关纹理数，不是「关数 × 档数」。
     */
    private readonly _wipeFrames = new Map<string, { frame: SpriteFrame; p: number; s: number }>();
    /**
     * `[WXG-T-567]` **每纹理（radius+gray 组合）**磨砂帧（未开启态）。gray=1 默认全灰；
     * gray<1 是叠加管线产物（frost 后叠 gray，保留部分原色）。
     * 缓存键 = `textureId|frost:${r},gray:${g}` ⇒ 每 (r,g) 组合一份，显存 ≈29 KiB/张。
     */
    private readonly _frostFrames = new Map<string, { frame: SpriteFrame; radius: number; gray: number }>();
    private readonly _pool: Sprite[] = [];
    /**
     * `[WXG-T-1112]` 池位组件缓存：`accept` 每条 blit 都要 setContentSize / 设 α，
     * 旧写法每帧两次 `getComponent`（线性扫组件表）。池位创建时组件恒定 ⇒ 建档时存引用。
     */
    private readonly _poolUiT: UITransform[] = [];
    private readonly _poolUiO: UIOpacity[] = [];
    private _used = 0;
    /**
     * `[WXG-T-1112]` 上一帧借用量（差分复用：`beginFrame` 不再整池 `active=false`，
     * 本帧前缀复用仍 active 的池位；`endFrame` 只关 `[本帧, 上帧)` 尾段 ⇒ 稳态零翻转）。
     */
    private _usedPrev = 0;
    /** `[WXG-T-1112]` 图集容器节点缓存：旧写法每条 blit 都 `getChildByName`（O(children) 线性扫）。 */
    private _atlasNodeRef: Node | null = null;
    /** `[WXG-T-1122]` 整格底 tile 的独立底层节点：建一次即恒在珠图集之下，热路径零兄弟重排。 */
    private _tileNodeRef: Node | null = null;
    private _ready = false;
    /** [WXG-T-1005] Bootstrap launch 拿它 await 再 start loop，避免菜单第一帧闪 v1 矢量腿。 */
    public warmupPromise: Promise<number> | null = null;
    private _overflowWarned = false;

    private _atlasCanvas: TintCanvasLike | null = null;
    private _atlasCtx: TintContext2DLike | null = null;
    private _atlasTex: Texture2D | null = null;
    private _tintCache: TintSpriteCache | null = null;

    /**
     * @param _layer `bindings.ts` 的 BlitLayer 节点（底图之上、`Graphics` 之下；= GameRoot 子节点 ⇒ 继承整屏缩放）。
     * @param _uiLayer `bindings.ts` 的 BlitLayerUI 节点（`Graphics` 之上、`Labels` 之下）：
     *   `[WXG-T-271 / ADR-0031 §6]` 全彩静态位图腿落这里。旧写法两条腿同挂 BlitLayer
     *   ⇒ 选关墙的卡底/槽位矩形由后置的 `Graphics` 画，位图被底色整个盖住（装载全绿但屏上零像素）。
     */
    constructor(private readonly _layer: Node, private readonly _uiLayer: Node, private readonly _clipLayer: Node | null = null) { }
    /** 裁切期间的 blit 改挂到蒙版下（坐标与 UI 层相同）。 */
    private _clipOn = false;

    /**
     * 预热：载**需求集**（`MASK_IDS`，由档位宏派生）的 mask → 建合成缓存 → **成功后**才打开 tint 运行时。
     * @returns 就绪的 mask 张数（< 需求集 ⇒ 调用方按失败处理，⛔ 不留半套注入态）
     */
    async warmup(): Promise<number> {
        // WEBP 能力只认引擎的 sys.hasFeature(WEBP)，不做真图探测（用户 2026-10-16 裁定）。
        console.log(`[BeadsBlitCarrier] WEBP 能力 sys.hasFeature=${sys.hasFeature(sys.Feature.WEBP)}`);
        const images = await Promise.all(
            MASK_IDS.map(async (id) => {
                const img = await loadImageAsset(MASK_ASSETS[id.split('__v')[0]!]!);
                if (img) this._masks.set(id, img);
                return img ? 1 : 0;
            }),
        );
        const loaded = images.reduce((a, b) => a + b, 0);
        if (loaded < MASK_IDS.length) return loaded;

        const canvas = createOffscreen(MASK_CANONICAL_SIZE, MASK_CANONICAL_SIZE);
        if (!canvas) return 0;
        const maskSource = { get: (id: string): object | undefined => this._masks.get(id) };
        this._tintCache = new TintSpriteCache(
            { createCanvas: (w: number, h: number) => createOffscreen(w, h) as TintCanvasLike },
            maskSource,
            {
                // `ImageData` 是宿主能力（真实浏览器 `putImageData` 只收实例、不收裸数组）：
                // 优先全局构造器，没有则取上下文的 `createImageData`（小游戏的 2D 上下文有）。
                createImageData: (w: number, h: number): TintImageDataLike => {
                    const Ctor = (globalThis as AnyObj).ImageData;
                    if (Ctor) return new Ctor(w, h);
                    const c = createOffscreen(w, h) as TintCanvasLike;
                    return (c.getContext('2d') as AnyObj).createImageData(w, h);
                },
                // 定稿 mask 已是屏幕朝向（`tint-sprite-cache.ts` §flipY 的 A/B 实测）⇒ 不预镜像。
                flipY: false,
                tileInnerPx: TILE_INNER_PX,
            },
        );
        this._ready = true;
        // 载体就绪 ⇒ 打开 tint 臂（此后珠面发 `blit` 而不是 12 条矢量命令）。
        setBeadTintRuntime(
            createWhitelistBeadTintRuntime((maskId: string) => (this._masks.has(maskId) ? maskId : undefined)),
        );
        // `[WXG-T-271 / ADR-0031 DEC=C′]` boss 缩略位图（**可选臂**，不 gate `_ready`）：装载成功即登记，
        // 缺资产 / 失败 ⇒ 该关回退程序化缩略（与未注入等价）。资产未导入时本腿自然空转（先写码、暂不 import）。
        await Promise.all(
            Object.entries(BITMAP_ASSETS).map(async ([texId, a]) => {
                const sf = await loadBitmapSpriteFrame(a.path, a.bundle);
                if (sf) {
                    this._bitmaps.set(texId, sf);
                    const img = await loadBitmapImage(a.path, a.bundle);
                    if (img) this._bitmapImages.set(texId, img);
                }
                else console.warn(`[BeadsBlitCarrier] 静态位图 \`${texId}\`（${a.bundle ?? 'textures'}/${a.path}）未就绪 ⇒ 该元素走程序化回退`);
            }),
        );
        // 装载成功也要嚷：只靠「无 warn」反推「已上屏」本批已被实测证伪（ADR-0031 §6）。
        if (Object.keys(BITMAP_ASSETS).length > 0) {
            console.log(`[BeadsBlitCarrier] 静态位图 ${this._bitmaps.size}/${Object.keys(BITMAP_ASSETS).length} 已装载 ⇒ 落 UI blit 层`);
        }
        // 注入位图缩略可用性查询（宿主侧唯一知资产在哪）；未命中关 ⇒ resolver 返 undefined ⇒ 程序化。
        setLevelThumbBitmapResolver((level) => {
            const texId = BOSS_THUMB_TEXTURES[level.id];
            return texId !== undefined && this._bitmaps.has(texId) ? texId : undefined;
        });
        // `[WXG-T-280]` 菜单腿同源：按 id 查存在性 ⇒ 缺件只退该元素程序化腿，不影响其余。
        setMenuBitmapResolver((textureId: string) => this._bitmaps.has(textureId));
        return loaded;
    }

    /** 只在 `_blitDbg` 时调用：把刚结束那一帧的池位真相打到 console。 */
    private _dbgDump(): void {
        const recs = _blitDbgRecs;
        const bails = _blitDbgBails;
        _blitDbgFrame++;
        let tiles = 0;
        let beads = 0;
        let inactive = 0;
        const bad: string[] = [];
        const rank = (p: string): number => p === 'atlas' ? 0 : p === 'clip' ? 2 : 1;
        for (const r of recs) {
            if (r.kind === 'tile') tiles++;
            else if (r.kind === 'bead') beads++;
            if (!r.active) inactive++;
        }
        // 间隙 ≤1px = 同一格（tile 带 bleed，中心仍同位）；bead 必须在 tile 之上
        for (let i = 0; i + 1 < recs.length; i++) {
            const t = recs[i]!;
            const b = recs[i + 1]!;
            if (t.kind !== 'tile' || b.kind !== 'bead') continue;
            if (Math.abs(t.x - b.x) > 1 || Math.abs(t.y - b.y) > 1) continue;
            if (rank(b.parent) < rank(t.parent) || (b.parent === t.parent && b.sib <= t.sib)) {
                if (bad.length < 4) bad.push(`${t.tex} ${t.parent}/${t.sib} -> ${b.tex} ${b.parent}/${b.sib}`);
            }
        }
        const dB = _blitDbgPrevBead < 0 ? 0 : beads - _blitDbgPrevBead;
        const dT = _blitDbgPrevTile < 0 ? 0 : tiles - _blitDbgPrevTile;
        console.log(
            `[blitdbg] f${_blitDbgFrame} used=${this._used} tile=${tiles} bead=${beads} ` +
                `dT=${dT} dB=${dB} inactive=${inactive} bail=${bails.length}` +
                (dB < 0 && dT === 0 ? ' BEAD_DROP' : '') +
                (bad.length ? ` INV=${bad.join(' | ')}` : ''),
        );
        if (bails.length) console.warn(`[blitdbg] BAIL f${_blitDbgFrame}: ${bails.join(' | ')}`);
        _blitDbgPrevTile = tiles;
        _blitDbgPrevBead = beads;
        _blitDbgRecs = [];
        _blitDbgBails = [];
    }

    beginFrame(): void {
        if (_blitDbg) this._dbgDump();
        // `[WXG-T-1112]` 差分复用：旧写法在这里把 `[0, _used)` 全部 `active=false`、`_borrow`
        // 再逐个 `active=true` ⇒ 每个渲染帧每颗珠吃 **2 次完整 onEnable/onDisable 周期**
        // （组件回调 + batcher 重登记），~890 blit/帧时实测占「位」段 10 ms 的大头。
        // 现口径：借用是**顺序前缀**（第 i 次借 = 池位 i），上帧借过的 `[0, _usedPrev)` 保持
        // active 直接复用；本帧没用到的尾段 `[本帧, 上帧)` 由 `endFrame`（同 tick、引擎渲染前）
        // 关掉 ⇒ 稳态（前后帧 blit 数相同，拖动期正是如此）**零翻转**，play→menu 骤减也由
        // endFrame 收尾，无残影（WXG-T-269 案例同口径闭合）。
        this._usedPrev = this._used;
        this._used = 0;
        this._clipOn = false;
    }

    /**
     * `[WXG-T-1112]` 帧末钩子（框架 `draw()` 末尾调，`CocosBlitCarrierLike.endFrame`）。
     * 只关「上帧借过、本帧没借到」的尾段；稳态这段为空 ⇒ 循环空转、零 toggle。
     */
    endFrame(): void {
        for (let i = this._used; i < this._usedPrev; i++) {
            const node = this._pool[i]!.node;
            if (node.active) node.active = false;
        }
    }

    pushClip(): void {
        this._clipOn = this._clipLayer !== null;
    }

    popClip(): void {
        this._clipOn = false;
    }

    accept(cmd: BlitCommand, x: number, y: number, blitParent?: unknown): void {
        if (!this._ready) return this._bail('载体未就绪', cmd);
        // 总责语义（ADR-0029 §8.1）：带 fx 的命令一律由本载体负责，⛔ 不回落矢量。
        const base = tintFxBase(cmd.fx);
        // `[WXG-T-280]` 第三条腿：nine-slice fx ⇒ 静态位图 + 引擎原生 SLICED（端帽首见时烘进
        // SpriteFrame border，同纹恒一值 ⇒ 一次算定）。canvas2d 腿是预烘单张，这里零离屏成本。
        const ns = base === undefined ? nineSliceFxRead(cmd.fx) : undefined;
        const tint = base === undefined ? undefined : base;
        // `[WXG-T-566]` 三态灰度：`gray` fx 走 CPU 预烘变体（与 tint/nineSlice 同属总责语义）；
        // 推关态走 `grayWipe`（按行烘竖向揭彩，见 `_wipeFrame`）。
        const gray = base === undefined && ns === undefined ? grayFxRead(cmd.fx) : undefined;
        const wipe = base === undefined && ns === undefined && gray === undefined
            ? grayWipeRead(cmd.fx)
            : undefined;
        // `[WXG-T-567]` 磨砂玻璃 + 叠加管线：frost 单独 ⇒ 全灰（gray=1，保持旧语义）；
        // frost + gray 同时存在（gray<1）⇒ 叠加管线。
        const frost = base === undefined && ns === undefined && wipe === undefined && gray === undefined
            ? frostRead(cmd.fx)
            : undefined;
        // 叠加管线判定共享自 gray-fx.ts（frost + gray(0..1)）。
        const combined = frostGrayCombined(cmd.fx);
        // `[WXG-T-271 / ADR-0031 DEC=C′]` 效果叠加管线（frost+gray 组合）→ 先 frost 再叠 gray；
        // 其余效果腿（tint / nineSlice / gray 单独 / grayWipe / frost 单独）保持互斥。
        let frame: SpriteFrame | undefined;
        if (tint !== undefined) frame = this._cell(cmd.textureId, tint);
        else if (ns !== undefined) frame = this._bitmaps.get(cmd.textureId); // nineSlice = 静态位图 + 引擎 SLICED（border 由 _ensureSliceBorder 首见写入）
        // `[WXG-T-617]` 回归修复：T-567 效果管线重构误把本支写成 frame=undefined，
        // 随即被下方空帧守卫 _bail ⇒ 所有九宫格位图（木牌/托盘）在 Cocos 腿静默回退。
        // 判据 = cocos-fail-shot.mjs 控制台「丢弃 blit」零告警 + 实帧目视。
        else if (wipe !== undefined) frame = this._wipeFrame(cmd.textureId, wipe[0]!, wipe[1]!);
        else if (combined !== undefined) frame = this._frostFrame(cmd.textureId, combined.frost, combined.gray);
        else if (frost !== undefined) frame = this._frostFrame(cmd.textureId, frost, 1);
        else if (gray !== undefined && gray > 0) frame = this._grayFrame(cmd.textureId, gray);
        else frame = this._bitmaps.get(cmd.textureId);
        if (frame === undefined) {
            return this._bail(
                base !== undefined
                    ? '图集格解不出（缓存未命中或格用尽）'
                    : gray !== undefined && gray > 0
                        ? '灰度变体烘不出（纹理不可读或离屏不可用）'
                        : wipe !== undefined
                            ? '揭彩变体烘不出（纹理不可读或离屏不可用）'
                            : frost !== undefined
                                ? '磨砂变体烘不出（纹理不可读或离屏不可用）'
                                : '静态位图未装载（注册表腿未命中）',
                cmd,
            );
        }
        if (ns !== undefined) this._ensureSliceBorder(cmd.textureId, frame, ns.capX, ns.capY);
        const sp = this._borrow();
        // `[WXG-T-1112]` 组件引用从池位档案取（`_borrow` 建档时已存），⛔ 热路径 getComponent。
        const uiT = this._poolUiT[this._used - 1]!;
        const uiO = this._poolUiO[this._used - 1]!;
        // 两条腿不同层：珠（tint 图集）在 `Graphics` 之下、静态位图在其上。池位是同一条，
        // 只在层真变了时 setParent（选关墙同屏仅此 1 条位图命令，热路径仍零分配）。
        // `[2026-11-20]` 珠腿（tint 图集）与「承着内容的整片底图」都在 Graphics 之下：
        // 木牌 / 九宫格背板若留在 BlitLayerUI 会盖住后发的程序化格底与缩略珠面。
        // `[UI-60 / ADR-0033 DEC-3]` 静态位图腿（above）跟着**作用域**走：容器内发出的位图
        // 挂到该容器自己的 `BlitLayerUI` 下，才不会被本容器的 `Graphics` 盖住、也不会跨容器
        // 串层。珠腿（below）**恒留全局 BlitLayer**（DEC-7：世界层不容器化）。
        // 框架未传（旧路径 / 未接作用域宿主）⇒ 沿用本载体自己的默认 `_uiLayer`，逐字节不变。
        // `[WXG-T-1096]` **容器内 tint blit 改判 above**：同容器通道序 blit < graphics，tint blit
        // 留全局图集会被容器树下方的默认 `Graphics`（托盘面板）盖住（T-1093 层序互斥根因）。
        // 判别 = 作用域递来的 blitParent 是否**真容器**（默认作用域递来的就是本载体自己的
        // `_uiLayer`，以节点身份区分；框架不透传「是否默认」这一信息）。未容器化 tint
        // （世界珠腿）与 `BELOW_GRAPHICS_TEXTURE_IDS` 白名单腿行为逐字节不变。
        const scoped = blitParent as Node | undefined;
        const unscooped = scoped === undefined || scoped === this._uiLayer;
        const below = (base !== undefined && unscooped) || BELOW_GRAPHICS_TEXTURE_IDS.has(cmd.textureId);
        // `[WXG-T-1122]` tile 走独立底层节点：与珠图集分属两个父节点，层序由节点树固定，
        // ⛔ 不再逐帧 setSiblingIndex(0)（真机每帧几百次父节点兄弟数组重排 ⇒ 位 65ms）。
        const tileBlit = base !== undefined && cmd.textureId.endsWith(MASK_TILE_SUFFIX);
        const parent = this._clipOn && this._clipLayer
            ? this._clipLayer
            : tileBlit ? this._tileNode()
                : below ? this._atlasNode()
                    : (scoped ?? this._uiLayer);
        if (sp.node.parent !== parent) {
            sp.node.setParent(parent);
            // 框垫底：同层若有珠（同属 BlitAtlas），框必须在它们之下。
            if (base === undefined && below) sp.node.setSiblingIndex(0);
        }
        // `[WXG-T-1048]` 跨容器池位复用后兄弟序会残留旧容器的追加历史：详情帧借走 dialogBg/
        // cellNormal 等池位挂到详情容器，返回帧它们 setParent 回选关容器时插到锁之后 ⇒ 不透明
        // 格底盖住锁。above 池位每帧按命令序（= 借位序）钉死兄弟位，⛔ 不依赖 setParent 追加历史。
        // below 腿保持原样（珠层垫底语义不变）。
        if (!below && sp.node.parent === parent) {
            // `[WXG-T-1112]` `getSiblingIndex` 是 O(1) 读缓存位，先比再调可省掉引擎
            // `setSiblingIndex` 内部每次必跑的 `siblings.indexOf(this)`（O(children)）。
            const sib = this._used - 1;
            if (sp.node.getSiblingIndex() !== sib) sp.node.setSiblingIndex(sib);
        }
        // border 全 0 的帧 SLICED ≡ SIMPLE ⇒ 恒按命令语义赋值（同帧混发两类也不残留）。
        sp.type = ns !== undefined ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
        // Boss 原图四周是透明边。默认 trim 会把花拉满内容框；关掉才按原图留白居中。
        if (sp.type === Sprite.Type.SIMPLE) {
            const trim = !NO_TRIM_TEXTURE_IDS.has(cmd.textureId);
            if (sp.trim !== trim) sp.trim = trim;
        }
        // Cocos 把 inset（源纹 px）直接当内容 px 摆顶点。目标比源纹矮时圆角被压扁。
        // 内容放大到源纹空间再整体缩回，端帽跟高度同比，只拉中间。池位复用 ⇒ 非九宫格必须回到 1。
        let drawW = cmd.w;
        let drawH = cmd.h;
        let fit = 1;
        if (ns !== undefined) {
            const sw = frame.rect.width;
            const sh = frame.rect.height;
            const vs = sw > 0 && sh > 0 ? Math.min(cmd.w / sw, cmd.h / sh) : 1;
            if (vs > 0 && vs < 1) {
                fit = vs;
                drawW = cmd.w / vs;
                drawH = cmd.h / vs;
            }
        }
        uiT.setContentSize(drawW, drawH);
        if (sp.node.scale.x !== fit) sp.node.setScale(fit, fit, 1);
        if (sp.spriteFrame !== frame) sp.spriteFrame = frame;
        // blit 的 x/y 是左下角（设计系），Sprite 锚点是中心 ⇒ 补半宽高。
        // `[WXG-T-1112]` 引擎 `setPosition` **无等值短路**（3.8.8 实核：每次必走
        // `invalidateChildren(POSITION)`）⇒ 本地加比较，静止池位（托盘珠）零开销。
        const px = x + cmd.w / 2;
        const py = y + cmd.h / 2;
        const lp = sp.node.position;
        if (lp.x !== px || lp.y !== py || lp.z !== 0) sp.node.setPosition(px, py, 0);
        // `[WXG-T-280]` α 腿落地（旧 warn-once 占位退役）：菜单预留钮发 `alpha=0.5`。
        // 池位建时已挂 `UIOpacity` ⇒ 每帧只比值赋值，零分配；⛔ 不在热路径 getComponent。
        const opacity = uiO;
        if (opacity) {
            const want = cmd.alpha === undefined || cmd.alpha === 1 ? 255 : Math.round(cmd.alpha * 255);
            if (opacity.opacity !== want) opacity.opacity = want;
        }
        if (_blitDbg) _blitDbgRecs.push({
            tex: cmd.textureId,
            kind: /tile/.test(cmd.textureId) ? 'tile' : /bead/.test(cmd.textureId) ? 'bead' : 'other',
            x: x + cmd.w / 2,
            y: y + cmd.h / 2,
            parent: this._clipOn && this._clipLayer ? 'clip' : (below ? 'atlas' : 'ui'),
            sib: sp.node.parent?.children.indexOf(sp.node) ?? -1,
            active: sp.node.active,
        });
    }

    /**
     * 丢命令必须嚷（K-108：静默回退在屏幕上只表现为「那块没了」）。
     * 每种原因一次；⛔ 不逐帧刷。
     */
    private readonly _bailed = new Set<string>();
    private _bail(why: string, cmd: BlitCommand): void {
        if (_blitDbg) _blitDbgBails.push(`${cmd.textureId}:${why}`);
        if (this._bailed.has(why)) return;
        this._bailed.add(why);
        console.warn(`[BeadsBlitCarrier] 丢弃 blit \`${cmd.textureId}\`：${why}`);
    }

    /** 图集格（含首见合成）。⛔ 不在热路径 `new`：命中缓存时零分配。 */
    private _cell(maskId: string, base: string): SpriteFrame | undefined {
        const key = `${maskId}|${base}`;
        const hit = this._cells.get(key);
        if (hit) return hit;
        if (this._cells.size >= ATLAS_COLS * ATLAS_ROWS) {
            if (!this._overflowWarned) {
                console.warn(`[BeadsBlitCarrier] 图集 ${ATLAS_COLS * ATLAS_ROWS} 格用尽 ⇒ 新配色不落珠面`);
                this._overflowWarned = true;
            }
            return undefined;
        }
        const cache = this._tintCache;
        if (!cache || !this._ensureAtlas()) return undefined;
        const tex = this._atlasTex!;
        const ctx = this._atlasCtx!;
        const sprite = cache.get(maskId, base) as TintCanvasLike | undefined;
        if (!sprite) return undefined;
        const idx = this._cells.size;
        const dx = (idx % ATLAS_COLS) * MASK_CANONICAL_SIZE;
        const dy = Math.floor(idx / ATLAS_COLS) * MASK_CANONICAL_SIZE;
        ctx.drawImage(sprite, dx, dy, MASK_CANONICAL_SIZE, MASK_CANONICAL_SIZE);
        tex.uploadData(this._atlasCanvas as never);
        const sf = new SpriteFrame();
        sf.reset({
            texture: tex,
            originalSize: new Size(MASK_CANONICAL_SIZE, MASK_CANONICAL_SIZE),
            rect: new Rect(dx, dy, MASK_CANONICAL_SIZE, MASK_CANONICAL_SIZE),
        });
        sf.packable = false;
        this._cells.set(key, sf);
        return sf;
    }

    /**
     * `[WXG-T-566]` 灰度变体：首见即烘（`out = c·(1−g) + luma·g`，alpha 原样），缓存到
     * `_grayBitmaps`。⛔ 不进每帧路径；缺纹理 / 离屏不可用 ⇒ `undefined`（调用方 `_bail` 嚷一次）。
     *
     * 键含强度：`gray` 是框架保留的通用档位（本游戏菜单已改走 `frost`），缓存大小 = 纹理数 × 档数。
     */
    private _grayFrame(textureId: string, g: number): SpriteFrame | undefined {
        const key = `${textureId}|${g}`;
        const hit = this._grayBitmaps.get(key);
        if (hit) return hit;
        const frame = this._bakeGrayFrame(textureId, () => g);
        if (frame !== undefined) this._grayBitmaps.set(key, frame);
        return frame;
    }

    /**
     * `[WXG-T-566]` 竖向揭彩变体：底部 `progress` 比例原色、顶部灰度、交界按 `soft` 线性过渡。
     * 与 canvas2d 适配层 `bakeGrayWipe` **同一行序与同一式**（像素数组自顶向下）。
     * 换档复用同一 `Texture2D`（重新 `uploadData`）⇒ 每纹理只占一份显存。
     */
    private _wipeFrame(textureId: string, progress: number, soft: number): SpriteFrame | undefined {
        const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
        const s = soft < 0 ? 0 : soft > 1 ? 1 : soft;
        const hit = this._wipeFrames.get(textureId);
        if (hit !== undefined && hit.p === p && hit.s === s) return hit.frame;
        const frame = this._bakeGrayFrame(textureId, (y, h) => {
            const boundary = h * (1 - p);
            const band = s > 0 ? Math.max(1, (s * h) / 2) : 0;
            if (band <= 0) return y >= boundary ? 0 : 1;
            const t = y < boundary - band ? 0 : y > boundary + band ? 1 : (y - (boundary - band)) / (2 * band);
            return 1 - t;
        }, hit?.frame);
        if (frame !== undefined) {
            if (hit !== undefined) {
                hit.p = p;
                hit.s = s;
            } else {
                this._wipeFrames.set(textureId, { frame, p, s });
            }
        }
        return frame;
    }

    /**
     * `[WXG-T-567]` 磨砂玻璃变体：`frostPixels`（1/4 下采样 + 盒式模糊 + 灰度）→ 1/4 尺寸纹理。
     * 与 canvas2d 适配层 `bakeFrost` **共用同一纯函数** ⇒ 两条宿主腿像素级同源。
     * 半径 + 灰度强度组成缓存键（gray=1 默认全灰；gray<1 保留部分原色供叠加管线）。
     * 节点仍按命令 `w/h` 放大贴，双线性插值补足柔和。
     */
    private _frostFrame(textureId: string, radius: number, gray: number): SpriteFrame | undefined {
        const r = radius < 0 ? 0 : radius > 32 ? 32 : radius;
        const g = gray < 0 ? 0 : gray > 1 ? 1 : gray;
        const key = `${textureId}|frost:${r},gray:${g}`;
        const hit = this._frostFrames.get(key);
        if (hit !== undefined && hit.radius === r && hit.gray === g) return hit.frame;
        const baseFrame = this._bitmaps.get(textureId);
        if (baseFrame === undefined) return undefined;
        const tex = baseFrame.texture;
        const w = tex.width;
        const h = tex.height;
        const image = this._bitmapImages.get(textureId)
            ?? (((tex as unknown as AnyObj).image as AnyObj | null)?.data as object | undefined);
        if (!image || w === 0 || h === 0) return undefined;
        const read = createOffscreen(w, h);
        const readCtx = read ? read.getContext('2d') : null;
        if (!read || !readCtx) return undefined;
        readCtx.drawImage(image, 0, 0, w, h);
        const baked = frostPixels(readCtx.getImageData(0, 0, w, h).data, w, h, r, g);
        const canvas = createOffscreen(baked.width, baked.height);
        const ctx = canvas ? canvas.getContext('2d') : null;
        if (!canvas || !ctx) return undefined;
        const pixels = ctx.getImageData(0, 0, baked.width, baked.height);
        pixels.data.set(baked.data);
        ctx.putImageData(pixels as object, 0, 0);
        const outTex = new Texture2D();
        outTex.reset({ width: baked.width, height: baked.height });
        outTex.uploadData(canvas as never);
        const sf = new SpriteFrame();
        sf.reset({
            texture: outTex,
            originalSize: new Size(baked.width, baked.height),
            rect: new Rect(0, 0, baked.width, baked.height),
        });
        sf.packable = false;
        this._frostFrames.set(key, { frame: sf, radius: r, gray: g });
        return sf;
    }

    /**
     * `_grayFrame` / `_wipeFrame` 的共用烘体：`grayAt(y, h)` 返回该行灰度强度（0–1）。
     * 缓存未命中才进来 ⇒ 闭包 / 离屏分配都不在每帧路径。
     * `reuse` 非空 ⇒ 复用它已有的 `Texture2D`（同尺寸）重新上传，只换像素不换显存。
     */
    private _bakeGrayFrame(
        textureId: string,
        grayAt: (y: number, h: number) => number,
        reuse?: SpriteFrame,
    ): SpriteFrame | undefined {
        const baseFrame = this._bitmaps.get(textureId);
        if (baseFrame === undefined) return undefined;
        const tex = baseFrame.texture;
        const w = tex.width;
        const h = tex.height;
        const image = this._bitmapImages.get(textureId)
            ?? (((tex as unknown as AnyObj).image as AnyObj | null)?.data as object | undefined);
        if (!image || w === 0 || h === 0) return undefined;
        const canvas = createOffscreen(w, h);
        const ctx = canvas ? canvas.getContext('2d') : null;
        if (!canvas || !ctx) return undefined;
        ctx.drawImage(image, 0, 0, w, h);
        const pixels = ctx.getImageData(0, 0, w, h);
        const px = pixels.data;
        for (let y = 0; y < h; y++) {
            const raw = grayAt(y, h);
            const g = raw < 0 ? 0 : raw > 1 ? 1 : raw;
            const keep = 1 - g;
            for (let i = y * w * 4; i < (y + 1) * w * 4; i += 4) {
                const r = px[i]!;
                const gg = px[i + 1]!;
                const b = px[i + 2]!;
                const luma = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
                px[i] = r * keep + luma * g;
                px[i + 1] = gg * keep + luma * g;
                px[i + 2] = b * keep + luma * g;
            }
        }
        // 真实宿主只收 `ImageData` 实例；`getImageData` 的返回值就是实例（⛔ 不重造）。
        ctx.putImageData(pixels as object, 0, 0);
        if (reuse !== undefined) {
            // `SpriteFrame.texture` 的类型面是基类 `TextureBase`（无 `uploadData`）；运行时实例是
            // `Texture2D`（本文件创建），且 `carrier-bench` 已验证重复 upload 同尺寸可行。
            (reuse.texture as unknown as { uploadData(src: never): void }).uploadData(canvas as never);
            return reuse;
        }
        const outTex = new Texture2D();
        outTex.reset({ width: w, height: h });
        outTex.uploadData(canvas as never);
        const sf = new SpriteFrame();
        sf.reset({ texture: outTex, originalSize: new Size(w, h), rect: new Rect(0, 0, w, h) });
        sf.packable = false;
        return sf;
    }

    /** 已配过 border 的 `textureId`（一纹理一值 ⇒ 只写一次；键 = 裸串，热路径命中零分配）。 */
    private readonly _sliced = new Set<string>();
    /**
     * `[WXG-T-280]` 九宫格端帽 → SpriteFrame inset（源纹 px）。
     * Cocos 3.8 没有 `border.left`；端帽是 `insetLeft/Right/Top/Bottom`，写入会重算 sliced UV。
     */
    private _ensureSliceBorder(textureId: string, frame: SpriteFrame, capX: number, capY: number): void {
        if (this._sliced.has(textureId)) return;
        this._sliced.add(textureId);
        frame.insetLeft = frame.insetRight = capX;
        frame.insetTop = frame.insetBottom = capY;
    }

    /** 借一个池位（不够就长；上限 = 同屏珠数，实测 ~280 见 §5.2 伴随义务 (iii)）。 */
    private _borrow(): Sprite {
        let sp = this._pool[this._used];
        if (!sp) {
            const node = new Node(`B${this._pool.length}`);
            this._atlasNode().addChild(node);
            this._poolUiT.push(node.addComponent(UITransform));
            // `[WXG-T-280]` α 腿常驻组件（菜单位图会发 alpha；珠层恒 255 零成本）。
            this._poolUiO.push(node.addComponent(UIOpacity));
            sp = node.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.type = Sprite.Type.SIMPLE;
            this._pool.push(sp);
        }
        this._used++;
        const node = sp.node;
        if (!node.active) node.active = true;
        return sp;
    }

    /** 图集容器节点（懒建；挂在 BlitLayer 下 ⇒ 继承 WXG-T-132 的整屏节点缩放且层序正确）。 */
    private _atlasNode(): Node {
        // `[WXG-T-1112]` 缓存命中 ⇒ 不再每条 blit 一次 `getChildByName` 线性扫。
        if (this._atlasNodeRef && this._atlasNodeRef.isValid) return this._atlasNodeRef;
        const name = 'BlitAtlas';
        const existing = this._layer.getChildByName(name);
        if (existing) {
            this._atlasNodeRef = existing;
            return existing;
        }
        const node = new Node(name);
        // [WXG-T-256 / S5′-3] 旧批的 `ponytail:` 注在此兑现：父节点不再是 GameRoot 末尾，
        // 而是专用 BlitLayer ⇒ `addChild` 天然落在底图与矢量 UI 之间（面板/遮罩能压住珠）。
        this._layer.addChild(node);
        node.addComponent(UITransform);
        this._atlasNodeRef = node;
        return node;
    }

    /**
     * `[WXG-T-1122]` 整格底 tile 专用底层节点（建一次 ⇒ 热路径零兄弟重排）。
     * 挂在 BlitLayer 首位 ⇒ 恒在 `BlitAtlas`（珠 / 坑 mask）之下，也在所有矢量之上。
     */
    private _tileNode(): Node {
        if (this._tileNodeRef && this._tileNodeRef.isValid) return this._tileNodeRef;
        const name = 'BlitTiles';
        const existing = this._layer.getChildByName(name);
        if (existing) {
            this._tileNodeRef = existing;
            return existing;
        }
        const node = new Node(name);
        node.addComponent(UITransform);
        this._layer.addChild(node);
        node.setSiblingIndex(0);
        this._tileNodeRef = node;
        return node;
    }

    /**
     * 图集画布 + 纹理（与节点无关）。
     *
     * ⚠ **必须先于首格可用**：旧写法把建纹理放在 `_atlasNode()` 里，而 `_atlasNode()`
     * 只被 `_borrow()` 调、`_borrow()` 又只在 `_cell()` 出格之后才走 ⇒ 首格永远拿不到
     * ctx ⇒ 一条 blit 也落不了地（产物实测：盘面整块空白 + warn-once 只响一次）。
     */
    private _ensureAtlas(): boolean {
        if (this._atlasTex && this._atlasCtx) return true;
        const w = ATLAS_COLS * MASK_CANONICAL_SIZE;
        const h = ATLAS_ROWS * MASK_CANONICAL_SIZE;
        const canvas = createOffscreen(w, h) as TintCanvasLike | null;
        const ctx = canvas ? (canvas.getContext('2d') as TintContext2DLike) : null;
        if (!canvas || !ctx) return false;
        const tex = new Texture2D();
        tex.reset({ width: w, height: h });
        tex.uploadData(canvas as never);
        this._atlasCanvas = canvas;
        this._atlasCtx = ctx;
        this._atlasTex = tex;
        return true;
    }
}

/**
 * mask 资产所在的 **Cocos bundle**（WXG-T-255 用户裁定 = 把 `assets/textures` 配置为 Bundle、合并进主包）。
 * ⛔ 不得用内置名 `main` / `internal` / `resources` / `start-scene`；编辑器里改了 Bundle 名称就改这一处。
 */
const MASK_BUNDLE = 'textures';

type MaskBundle = AssetManager.Bundle;

/**
 * bundle 只取一次；取不到（= 编辑器动作尚未落地）也记住这个结论，⛔ 不逐张重试。
 *
 * ⚠ 记的是**那个 Promise**，不是「试过」标志位：warmup 对四张 `Promise.all` 并发调本函数，
 * 旧写法（`_maskBundleTried` + 结果槽）让后三个调用方当场拿到 `null` ⇒ 它们走全局 uuid 腿，
 * 而对不在 main 里的 `holeless` 两张＝解不出的资产（产物实测 `masks=2/4 carrier=off`）。
 */
let _maskBundlePromise: Promise<MaskBundle | null> | null = null;

const _extraBundlePromises = new Map<string, Promise<MaskBundle | null>>();

/** 菜单位图走 `textures`；大关关卡原图走各自的包（现在只有 `themes`）。 */
function ensureNamedBundle(name: string): Promise<MaskBundle | null> {
    if (name === MASK_BUNDLE) return ensureMaskBundle();
    const hit = _extraBundlePromises.get(name);
    if (hit) return hit;
    const pending = new Promise<MaskBundle | null>((resolve) => {
        assetManager.loadBundle(name, (err: Error | null, bundle: MaskBundle) => {
            if (err || !bundle) {
                console.warn(`[BeadsBlitCarrier] bundle \`${name}\` 不可用（未配成 Bundle？）⇒ 该包位图不登记：${String(err)}`);
                resolve(null);
                return;
            }
            console.log(`[BeadsBlitCarrier] 位图装载腿 = bundle \`${name}\``);
            resolve(bundle);
        });
    });
    _extraBundlePromises.set(name, pending);
    return pending;
}

function ensureMaskBundle(): Promise<MaskBundle | null> {
    if (_maskBundlePromise) return _maskBundlePromise;
    _maskBundlePromise = new Promise((resolve) => {
        assetManager.loadBundle(MASK_BUNDLE, (err: Error | null, bundle: MaskBundle) => {
            if (err || !bundle) {
                console.warn(`[BeadsBlitCarrier] bundle \`${MASK_BUNDLE}\` 不可用（未配成 Bundle？）⇒ 装载回落按 uuid：${String(err)}`);
                resolve(null);
                return;
            }
            console.log(`[BeadsBlitCarrier] mask 装载腿 = bundle \`${MASK_BUNDLE}\``);
            resolve(bundle);
        });
    });
    return _maskBundlePromise;
}

/**
 * mask 资产 → 可 `drawImage` 的对象（web = HTMLImageElement，经 `ImageAsset.data`）。两条装载腿：
 * 1. bundle 可用 ⇒ `assetManager.loadAny({ bundle, path })`（跨包按需加载的**文档形式**；配成 Bundle 后四张已离开 main bundle）；
 * 2. bundle 不可用 / 本 bundle 里解不出 ⇒ `assetManager.loadAny({ uuid })`（编辑器 Preview 走这条）。
 *
 * ⚠ **不要**改回 `bundle.load(path, ImageAsset, cb)`：3.8.8 的 `Bundle.load` 第三参是 **options**
 * ⇒ 回调被当配置（`this.onProgress is not a function`）；补成四参后在**构建产物**里能取到
 * `import/<uuid>.json` 但**永不回调**（web-mobile 实测，含被 redirect 回 main 的那两张）。
 * ⇒ bundle 句柄只用于「注册」这条 bundle，取资产一律经 `assetManager`。
 *
 * ⚠ 哪条生效会打日志，⛔ 不许静默（K-108：静默回退在屏幕上看不出来）。
 */
async function loadImageAsset(entry: { uuid: string; path: string }): Promise<object | undefined> {
    const bundle = await ensureMaskBundle();
    const take = (asset: ImageAsset | null): object | undefined => {
        if (!asset) return undefined;
        const data = (asset as ImageAsset).data as unknown as object | undefined;
        return data ?? (asset as unknown as object);
    };
    if (bundle) {
        const viaBundle = await new Promise<ImageAsset | null>((resolve) =>
            assetManager.loadAny({ bundle: MASK_BUNDLE, path: entry.path },
                (err: Error | null, asset: ImageAsset) => resolve(err ? null : asset)),
        );
        const hit = take(viaBundle);
        if (hit) return hit;
        console.warn(`[BeadsBlitCarrier] bundle 里解不出 \`${entry.path}\` ⇒ 回落按 uuid 取`);
    }
    return new Promise((resolve) => {
        assetManager.loadAny({ uuid: entry.uuid }, {}, (err: Error | null, asset: ImageAsset | null) => {
            const hit = take(err ? null : asset);
            if (!hit) console.warn(`[BeadsBlitCarrier] mask 加载失败 ${entry.uuid} (${entry.path}): ${String(err)}`);
            else if (!bundle) console.log('[BeadsBlitCarrier] mask 装载腿 = 全局 uuid（未走 bundle）');
            resolve(hit);
        });
    });
}

/**
 * `[WXG-T-271 / ADR-0031 DEC=C′]` 静态位图 → 构建产物里的 `SpriteFrame`。
 * 真机上 `new Texture2D(); tex.image = imageAsset` 拿到的是导入 json 里的 0×0，
 * 帧矩形跟着变成 0，程序化回退又被「已装载」关掉，图就空了。
 * 改取 `${path}/spriteFrame`（导入时已经写好像素矩形）。尺寸仍是 0 则不登记，让该元素回程序化。
 */
async function loadBitmapSpriteFrame(path: string, bundleName: string = MASK_BUNDLE): Promise<SpriteFrame | undefined> {
    const bundle = await ensureNamedBundle(bundleName);
    if (!bundle) return undefined;
    const sf = await new Promise<SpriteFrame | null>((resolve) =>
        assetManager.loadAny({ bundle: bundleName, path: `${path}/spriteFrame` },
            (err: Error | null, a: SpriteFrame) => resolve(err ? null : a)),
    );
    const tex = sf?.texture;
    if (!sf || !tex || tex.width === 0 || tex.height === 0) {
        console.warn(`[BeadsBlitCarrier] bundle \`${bundleName}\` 里解不出位图 \`${path}\`（未导入或尺寸为 0）`);
        return undefined;
    }
    // 小图导入时 packable=true，上屏后被收进空动态图集。关掉才画自己的纹理。
    sf.packable = false;
    // 导入帧裁过透明边。blit 按整图盒子拉伸，拉回整张纹理，和 harness 同一张图。
    sf.rect = new Rect(0, 0, tex.width, tex.height);
    sf.originalSize = new Size(tex.width, tex.height);
    return sf;
}

/**
 * 位图原图 → 可 `drawImage` 的对象（与 `loadImageAsset` 同腿）。
 * 真机 / 模拟器上 `SpriteFrame.texture.image` 可能拿不到像素（gray / wipe / frost 预烘会失败），
 * 故装载时另存一份 `ImageAsset.data`。
 */
async function loadBitmapImage(path: string, bundleName: string = MASK_BUNDLE): Promise<object | undefined> {
    const bundle = await ensureNamedBundle(bundleName);
    if (!bundle) return undefined;
    const asset = await new Promise<ImageAsset | null>((resolve) =>
        assetManager.loadAny({ bundle: bundleName, path },
            (err: Error | null, a: ImageAsset) => resolve(err ? null : a)),
    );
    const data = (asset as unknown as AnyObj | null)?.data as object | undefined;
    return data ?? (asset ?? undefined);
}

/** 引擎 `stencil-manager` 的 ENTER_LEVEL。不引用 `cc.Mask`：mask 模块关着，`addComponent(Mask)` 会把真机打崩。 */
const STENCIL_ENTER = 2;

function setStencil(g: Graphics, stage: number): void {
    (g as unknown as { stencilStage: number }).stencilStage = stage;
}

/**
 * 橱窗走马灯蒙版。模板矩形画在本节点，被裁的 sprite / 矢量是它的子节点。
 * 矩形每帧由 `clip` 命令重画；α=0 所以蒙版本身不显色。
 */
export function createShowcaseClip(parent: Node): { host: CocosClipHostLike; blitLayer: Node } {
    const node = new Node('ShowcaseClip');
    parent.addChild(node);
    const mask = node.addComponent(Graphics);
    const ink = new Color(255, 255, 255, 0);

    const blitLayer = new Node('ShowcaseClipBlit');
    node.addChild(blitLayer);
    const penNode = new Node('ShowcaseClipGraphics');
    node.addChild(penNode);
    const pen = penNode.addComponent(Graphics);

    return {
        blitLayer,
        host: {
            graphics: pen,
            beginFrame(): void {
                pen.clear();
                mask.clear();
                setStencil(mask, 0);
            },
            push(x: number, y: number, w: number, h: number): void {
                setStencil(mask, STENCIL_ENTER);
                mask.fillColor = ink;
                mask.rect(x, y, w, h);
                mask.fill();
            },
            pop(): void { /* 子树画完由引擎退出模板 */ },
        },
    };
}

/**
 * 注入点（`BeadsBootstrap.createBlitCarrier()` 调）。
 * @param layer `bindings.ts` 的 BlitLayer 节点（⛔ 不是 GameRoot，层序见 [WXG-T-256]）
 * @param uiLayer `bindings.ts` 的 BlitLayerUI 节点（`Graphics` 之上，静态位图腿专用，[WXG-T-271]）
 * @returns 载体；**任何**前置不满足 ⇒ `null`（= 不注入 = 今日行为）
 */
export function maybeCreateBeadsBlitCarrier(layer: Node, uiLayer: Node, clipLayer?: Node): CocosBlitCarrierLike | null {
    if (!carrierSwitchOn()) return null;
    const carrier = new BeadsBlitCarrier(layer, uiLayer, clipLayer ?? null);
    // 预热是异步的；就绪前 tint 运行时不打开 ⇒ 该窗口内游戏仍发矢量命令，载体一条也收不到。
    // [WXG-T-1005] 把 Promise 暴露给 Bootstrap launch，等它 resolve 再 start loop ——
    // 菜单第一帧的 setMenuBitmapResolver 已经注入 ⇒ 招牌/CTA/背景直接走位图。
    carrier.warmupPromise = carrier
        .warmup()
        .then((n) => {
            console.log(`[BeadsBlitCarrier] masks=${n}/${MASK_IDS.length} carrier=${n === MASK_IDS.length ? 'on' : 'off'}`);
            return n;
        })
        .catch((e) => {
            console.error('[BeadsBlitCarrier] 预热异常 ⇒ 保持矢量臂', String(e));
            return 0;
        });
    return carrier;
}
