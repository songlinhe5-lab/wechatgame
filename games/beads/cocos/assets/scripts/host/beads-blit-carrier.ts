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
import { maskTileInnerPx } from '../framework/core/bake/mask-tile';
import { BEAD_PITCH, BOSS_THUMB_TEXTURES, MENU_TEXTURES, TILE_BLEED } from '../game/config/tuning';
import { OPEN_ARCS } from '../game/config/arcs';
import { tintFxBase } from '../framework/core/bake/tint-composite';
import { nineSliceFxRead } from '../framework/core/bake/nine-slice-fx';
import { createWhitelistBeadTintRuntime, setBeadTintRuntime } from '../game/view/bead-render';
import { requiredTintMaskIds } from '../game/view/bead-tint-mask';
import { setLevelThumbBitmapResolver } from '../game/view/menu-signage';
import { setMenuBitmapResolver } from '../game/view/meta-view';

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
const ARC_TEXTURE_IDS: ReadonlySet<string> = new Set(OPEN_ARCS.map((t) => t.textureId));

const BITMAP_ASSETS: Readonly<Record<string, { path: string; bundle?: string }>> = {
    ...Object.fromEntries(OPEN_ARCS.map((t) => [t.textureId, { path: t.art, bundle: t.bundle }])),
    // `[WXG-T-280]` 主菜单位图 16 件（正本 = `design/art/final/assets/menu/`，拷入现成 `textures` Bundle；
    // ⛔ 不新分包）。全部入库为调色板量化 PNG（微信包内白名单不含 webp，见代码包文档）；
    // 未导入/解不出 ⇒ 不登记 ⇒ 该元素程序化腿（同 boss 缩略语义，不 gate `_ready`）。
    [MENU_TEXTURES.logo]: { path: 'ui_menu_logo' },
    [MENU_TEXTURES.caseFrame]: { path: 'ui_showcase_frame' },
    [MENU_TEXTURES.plate]: { path: 'ui_showcase_plate' },
    [MENU_TEXTURES.cta]: { path: 'ui_btn_start_9s' },
    [MENU_TEXTURES.ctaPressed]: { path: 'ui_btn_start_9s_pressed' },
    [MENU_TEXTURES.btnCircle]: { path: 'ui_btn_circle_normal' },
    [MENU_TEXTURES.btnCirclePressed]: { path: 'ui_btn_circle_pressed' },
    [MENU_TEXTURES.btnArrow]: { path: 'ui_btn_arrow_bg_normal' },
    [MENU_TEXTURES.btnArrowPressed]: { path: 'ui_btn_arrow_bg_pressed' },
    [MENU_TEXTURES.iconSettings]: { path: 'ui_icon_settings' },
    [MENU_TEXTURES.iconSound]: { path: 'ui_icon_sound' },
    [MENU_TEXTURES.iconMail]: { path: 'ui_icon_mail' },
    [MENU_TEXTURES.iconRank]: { path: 'ui_icon_rank' },
    [MENU_TEXTURES.iconArrowLeft]: { path: 'ui_icon_arrow_left' },
    [MENU_TEXTURES.iconArrowRight]: { path: 'ui_icon_arrow_right' },
    [MENU_TEXTURES.iconCoin]: { path: 'asset-icon-coin' },
    [MENU_TEXTURES.iconStamina]: { path: 'asset-icon-stamina' },
    [MENU_TEXTURES.badgeLocked]: { path: 'ui_menu_badge_locked' },
    // v3.8：沙漏 / 通关飘带 / CTA 艺术字。未导入 ⇒ 该元素走程序化腿。
    [MENU_TEXTURES.badgeProgress]: { path: 'ui_menu_badge_progress' },
    [MENU_TEXTURES.sealCleared]: { path: 'ui_menu_seal_cleared' },
    [MENU_TEXTURES.ctaLabel]: { path: 'ui_menu_cta_label' },
};

/**
 * 必须画在 `Graphics` **之下**的静态位图（其余静态位图在其上，见 `accept`）。
 * harness 是单画布按命令序叠画：橱窗框先发、资源条/缩略珠后发，所以后者在框上。
 * Cocos 分层：Graphics（矢量）在 BlitLayer 之上，静态位图默认在 Graphics 之上 ⇒ 不透明的橱窗框
 * 会把框内的矢量图元（资源条板、缩略珠）整个盖住。把框放到 Graphics 之下，两端叠序一致。
 */
const BELOW_GRAPHICS: ReadonlySet<string> = new Set([MENU_TEXTURES.caseFrame]);

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
    private readonly _pool: Sprite[] = [];
    private _used = 0;
    private _ready = false;
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
                if (sf) this._bitmaps.set(texId, sf);
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

    beginFrame(): void {
        // 收上一帧**实际用过**的那批 `[0, _used)`：本帧命令尚未交出，收掉的只是上一帧模型的残留
        // ⇒ 不会有一帧残影（`Sprite` 显隐在引擎提交前生效）。
        // ⚠ 区间必须是 `[0, _used)` 而非 `[_used, pool.length)`：后者关的是「上帧没用的尾」（本就
        //   inactive），而本帧 blit 数 < 上帧时（play→menu 珠数骤减）`[本帧, 上帧)` 段既不被
        //   `_borrow` 复用、又没在此关掉 ⇒ 停在上帧盘面/托盘位置 = 残影。本帧要哪些由 `_borrow`
        //   重新 `active=true` 点亮（WXG-T-269 后 play→menu 暴露）。
        for (let i = 0; i < this._used; i++) {
            const node = this._pool[i]!.node;
            if (node.active) node.active = false;
        }
        this._used = 0;
        this._clipOn = false;
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
        // `[WXG-T-271 / ADR-0031 DEC=C′]` 两条腿：带 fx.base → tint 图集格；无 fx.base → 静态位图注册表（boss 缩略等全彩图）。
        const frame = base !== undefined
            ? this._cell(cmd.textureId, base)
            : this._bitmaps.get(cmd.textureId);
        if (frame === undefined) {
            return this._bail(base !== undefined ? '图集格解不出（缓存未命中或格用尽）' : '静态位图未装载（注册表腿未命中）', cmd);
        }
        if (ns !== undefined) this._ensureSliceBorder(cmd.textureId, frame, ns.capX, ns.capY);
        const sp = this._borrow();
        // 两条腿不同层：珠（tint 图集）在 `Graphics` 之下、静态位图在其上。池位是同一条，
        // 只在层真变了时 setParent（选关墙同屏仅此 1 条位图命令，热路径仍零分配）。
        const below = base !== undefined || BELOW_GRAPHICS.has(cmd.textureId);
        // `[UI-60 / ADR-0033 DEC-3]` 静态位图腿（above）跟着**作用域**走：容器内发出的位图
        // 挂到该容器自己的 `BlitLayerUI` 下，才不会被本容器的 `Graphics` 盖住、也不会跨容器
        // 串层。珠腿（below）**恒留全局 BlitLayer**（DEC-7：世界层不容器化）。
        // 框架未传（旧路径 / 未接作用域宿主）⇒ 沿用本载体自己的默认 `_uiLayer`，逐字节不变。
        const scoped = blitParent as Node | undefined;
        const parent = this._clipOn && this._clipLayer
            ? this._clipLayer
            : (below ? this._atlasNode() : (scoped ?? this._uiLayer));
        if (sp.node.parent !== parent) {
            sp.node.setParent(parent);
            // 框垫底：同层若有珠（同属 BlitAtlas），框必须在它们之下。
            if (base === undefined && below) sp.node.setSiblingIndex(0);
        }
        // border 全 0 的帧 SLICED ≡ SIMPLE ⇒ 恒按命令语义赋值（同帧混发两类也不残留）。
        sp.type = ns !== undefined ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
        // Boss 原图四周是透明边。默认 trim 会把花拉满内容框；关掉才按原图留白居中。
        if (sp.type === Sprite.Type.SIMPLE) {
            const trim = !ARC_TEXTURE_IDS.has(cmd.textureId);
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
        sp.node.getComponent(UITransform)!.setContentSize(drawW, drawH);
        if (sp.node.scale.x !== fit) sp.node.setScale(fit, fit, 1);
        if (sp.spriteFrame !== frame) sp.spriteFrame = frame;
        // blit 的 x/y 是左下角（设计系），Sprite 锚点是中心 ⇒ 补半宽高。
        sp.node.setPosition(x + cmd.w / 2, y + cmd.h / 2, 0);
        // `[WXG-T-280]` α 腿落地（旧 warn-once 占位退役）：菜单预留钮发 `alpha=0.5`。
        // 池位建时已挂 `UIOpacity` ⇒ 每帧只比值赋值，零分配；⛔ 不在热路径 getComponent。
        const opacity = sp.node.getComponent(UIOpacity);
        if (opacity) {
            const want = cmd.alpha === undefined || cmd.alpha === 1 ? 255 : Math.round(cmd.alpha * 255);
            if (opacity.opacity !== want) opacity.opacity = want;
        }
    }

    /**
     * 丢命令必须嚷（K-108：静默回退在屏幕上只表现为「那块没了」）。
     * 每种原因一次；⛔ 不逐帧刷。
     */
    private readonly _bailed = new Set<string>();
    private _bail(why: string, cmd: BlitCommand): void {
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
            node.addComponent(UITransform);
            // `[WXG-T-280]` α 腿常驻组件（菜单位图会发 alpha；珠层恒 255 零成本）。
            node.addComponent(UIOpacity);
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
        const name = 'BlitAtlas';
        const existing = this._layer.getChildByName(name);
        if (existing) return existing;
        const node = new Node(name);
        // [WXG-T-256 / S5′-3] 旧批的 `ponytail:` 注在此兑现：父节点不再是 GameRoot 末尾，
        // 而是专用 BlitLayer ⇒ `addChild` 天然落在底图与矢量 UI 之间（面板/遮罩能压住珠）。
        this._layer.addChild(node);
        node.addComponent(UITransform);
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
    carrier
        .warmup()
        .then((n) => {
            console.log(`[BeadsBlitCarrier] masks=${n}/${MASK_IDS.length} carrier=${n === MASK_IDS.length ? 'on' : 'off'}`);
        })
        .catch((e) => console.error('[BeadsBlitCarrier] 预热异常 ⇒ 保持矢量臂', String(e)));
    return carrier;
}
