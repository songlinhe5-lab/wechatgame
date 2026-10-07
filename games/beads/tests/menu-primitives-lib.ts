/**
 * **K-6 菜单帧图元取数装置 · 共用件**（WXG-T-269-S6 · 子单 T-2B / Deliverable 4）
 * ─────────────────────────────────────────────────────────────────────────────
 * 本文件**不是**测试（无 `.test.ts` ⇒ 不进 vitest 采集），也**不是**取数脚本本体；
 * 它是「捕获脚本 `menu-primitives-capture.ts`」与「判据 `menu-primitives-k6.test.ts`」的
 * **同一份实现**（K-042 真源单一）：台账里的每一个数都由这里算出，测试再用同一算法现场复算对撞。
 * ⇒ 「图元 +N」是**可复跑命令的输出**，不是注释、不是纸面推算值（K-051 禁纸面值入册）。
 *
 * 复跑命令（从仓根）：
 * ```
 * WXG269_CAPTURE=t269s6 WXG269_SOURCE_REV=$(git rev-parse HEAD) \
 * WXG269_SOURCE_DESC='T-2B 工作树（beadText 招牌 + 珠拼缩略）' \
 * node --experimental-transform-types --import=./tools/scripts/lib/ts-js-resolve.mjs \
 *      games/beads/tests/menu-primitives-capture.ts
 * ```
 * ⚠ `--experimental-transform-types` 必需（Node 24 默认 type-stripping 不认 framework 的
 *   constructor parameter property；同 `bead-style-seal-recapture.ts` 的工具链约束）。
 *
 * ## 为什么差分腿走 `buildMetaView(…, variant)` 而不是 shell 真链路
 * 生产链路（`shell.buildRenderModel`）**不传 variant**（那才是上线形态，= 台账的 `production` 腿）。
 * 三组对照只需换 `MetaViewVariant` 的三个形参 ⇒ 它们必须与生产腿**同源同数据**，否则差分会混进
 * 「数据不同」的噪声。故：`viewDataOf(shell)` 取 shell **每帧真正喂给视图的同一个对象**
 * （私有面只读取、不构造 ⇒ ⛔ 不在测试侧重算陈列序，避免第二份真源）。
 * **同源自证**：`menuModel(shell)` 与 `menuModel(shell, {signage:true, wallRows:WALL_ROWS, thumbN:THUMB_MATRIX_N})`
 * 的整帧 sha 必等（`tests/menu-primitives-k6.test.ts` 腿 1）。
 *
 * ## 每珠 7 命令的结构自证（T-1 §0.3）
 * `facet-4` 满层 = 1 `rect`（plate）+ 4 `polygon`（扇）+ 2 `circle`（孔环 / 孔底）
 * = `BEAD_STYLE_MAX_COMMANDS`（7）。菜单帧的**非珠**图元只有 `rect` / `line` / `text`（容器、虚线槽、
 * 文字令牌），**不含 `circle` / `polygon`** ⇒ `circle` 计数是纯珠体读数：`beads = circle / 2`，
 * 且 `polygon` 必等 `beads × 4`；不满足即 throw（口径被破坏时先在这里炸，⛔ 静默出数）。
 *
 * 层级：tests（可 import `cc`-free 的 src 与 framework；⛔ 不写业务状态）。
 */

import { createHash } from 'node:crypto';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    NullAssetProvider,
    NullAudioBackend,
    RenderModelBuilder,
    Viewport,
    createRng,
    polygonVertices,
    type DrawCommand,
    type EventMap,
    type GameServices,
    type RenderModel,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { defaultBeadsSave } from '../src/game/save-schema.js';
import { LEVELS } from '../src/config/levels.js';
import {
    BEAD_STYLE_MAX_COMMANDS,
    DESIGN_H,
    DESIGN_W,
    SIGN_BEAD_PITCH,
    SIGN_MATRIX_N,
    THUMB_MATRIX_N,
    WALL_ROWS,
} from '../src/config/tuning.js';
import { COPY_TOKENS } from '../src/config/copy-tokens.js';
import { signGlyphBeadsOf } from '../src/config/sign-glyphs.js';
import { buildMetaView, type MetaViewData, type MetaViewVariant } from '../src/view/meta-view.js';

const CLOCK_START = 1_700_000_000_000;
const META_KEY = 'wxgame.beads.test.t269s6k6.meta';
const PLAY_KEY = 'wxgame.beads.test.t269s6k6.play';

/** 已解锁关数两态：`full` = 九关全解锁（满载上界，K-6 关心项）；`first` = 仅首关（首日形态）。 */
export type MenuRigState = 'full' | 'first';

export const RIG_UNLOCK: Record<MenuRigState, number> = {
    full: LEVELS.length,
    first: 1,
};

/**
 * 真框架服务 + 假钟 + 隔离存档（判例 = `meta-menu-wall.test.ts::rig()`，此处只留取数所需面）。
 * ⚠ 菜单帧的图元数**只**由「已解锁关数 + 关表 + variant 三参」决定，与时间无关 ⇒ 假钟恒定。
 */
export function createMenuShell(state: MenuRigState): BeadsShell {
    const platform = new NodePlatform({ width: DESIGN_W, height: DESIGN_H, pixelRatio: 2 });
    const storage = platform.createStorage();
    storage.set(
        PLAY_KEY,
        JSON.stringify({ ...defaultBeadsSave(), maxUnlockedLevel: RIG_UNLOCK[state] }),
    );
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), staminaCur: 99 }));
    const events = new EventBus<EventMap>();
    const services: GameServices = {
        events,
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('t269s6k6-seed'),
        viewport: new Viewport(DESIGN_W, DESIGN_H),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({ clock: () => CLOCK_START, metaKey: META_KEY, play: { saveKey: PLAY_KEY } });
    shell.init(services);
    return shell;
}

/**
 * shell 每帧喂给视图的**同一对象**（私有面只读取）。⛔ 不在这里复算陈列序 / 关卡引用
 * ⇒ 差分腿与生产腿同源（`K-042`）；这也是「视图不持状态」（L5）的反向自证入口：
 * 同一 data 二次调用输出全等。
 */
export function viewDataOf(shell: BeadsShell): MetaViewData {
    return (shell as unknown as { _metaViewData(): MetaViewData })._metaViewData();
}

/** 一帧菜单：`variant === undefined` ⇒ 走 **shell 生产真链路**（上线形态）；否则走视图直调 + 差分参。 */
export function menuModel(shell: BeadsShell, variant?: MetaViewVariant): RenderModel {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    if (variant === undefined) {
        shell.buildRenderModel(builder);
    } else {
        buildMetaView(builder, viewDataOf(shell), shell.play.palette, variant);
    }
    return builder.end();
}

/** 命令流 → 稳定文本（`polygon` 经 `polygonVertices` 解引用 = ADR-0024 值语义；判例 = S3 复取器）。 */
export function serializeFlow(model: RenderModel): string[] {
    return model.commands.map((c: DrawCommand) =>
        c.kind === 'polygon'
            ? JSON.stringify({ ...c, points: Array.from(polygonVertices(model, c)) })
            : JSON.stringify(c),
    );
}

export function sha256(text: string): string {
    // ⚠ 这是**取证工具的摘要算法**（`node:crypto`，确定性），⛔ 不是游戏内随机源（与 L4 无关）。
    return createHash('sha256').update(text).digest('hex');
}

/** 逐 kind 计数 + 珠数 + 整帧 sha。 */
export interface PrimitiveCount {
    readonly total: number;
    readonly kinds: Record<string, number>;
    /**
     * 珠数读数 = `circle / 2`（facet-4 每珠两枚同心圆）。
     * ⚠ 只在**菜单帧**上是纯珠数（非珠图元族无 `circle`）；playing 帧含 UI 圆 ⇒ 仅作裸读数。
     */
    readonly beads: number;
    readonly sha: string;
}

/**
 * 逐 kind 计数 + 珠数 + 整帧 sha（**裸计数**，不含结构自证）。
 * sha 口径与 `bead-style-seal-recapture.ts::serialize + sha` **逐字相同** ⇒ playing 腿的四键
 * 可直接与封箱件 `s3.frame0/frame78` 对撞（同一摘要算法、同一序列化，⛔ 不是两套口径）。
 */
export function countFrame(model: RenderModel): PrimitiveCount {
    const kinds: Record<string, number> = {};
    for (const c of model.commands) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
    const flow = serializeFlow(model);
    return { total: flow.length, kinds, beads: (kinds['circle'] ?? 0) / 2, sha: sha256(flow.join('\n')) };
}

/**
 * **菜单帧**的逐 kind 图元计数腿（= {@link countFrame} + 结构自证）：
 * - `circle` 必为偶数（每珠 2）；`polygon` 必为 `beads × 4` ⇒ 否则 throw（口径被破坏不出数）；
 * - 非珠图元只准是 `rect` / `line` / `text`（菜单帧⛔ 无 `blit`，S0 约束①）。
 *
 * ⚠ **playing 帧不走这里**：盘面命令流含非珠 `polygon`（实测 `polygon=322 ≠ 80×4`），
 *   本自证只对「非珠图元族 = rect/line/text」的菜单帧成立 ⇒ 玩法腿用 {@link countFrame}。
 */
export function countPrimitives(model: RenderModel): PrimitiveCount {
    const counted = countFrame(model);
    const kinds = counted.kinds;
    const circles = kinds['circle'] ?? 0;
    const polygons = kinds['polygon'] ?? 0;
    if (circles % 2 !== 0) {
        throw new Error(`K-6 口径破坏：circle=${circles} 非偶数 ⇒ 菜单帧混入非珠圆图元（facet-4 每珠恒 2 圆）`);
    }
    const beads = circles / 2;
    if (polygons !== beads * 4) {
        throw new Error(`K-6 口径破坏：polygon=${polygons} ≠ beads×4=${beads * 4} ⇒ 每珠 7 命令系数（${BEAD_STYLE_MAX_COMMANDS}）不再成立`);
    }
    if (kinds['blit'] !== undefined) {
        throw new Error(`K-6 口径破坏：菜单帧出现 blit=${kinds['blit']}（S0 约束①：只复用珠体矢量图元，⛔ 无贴图珠）`);
    }
    return counted;
}

/** 一腿 = 命名 + variant 参（`null` ⇒ 生产真链路）。台账与测试共读本表（⛔ 两处各写一份）。 */
export interface CaptureLeg {
    readonly label: string;
    readonly variant: MetaViewVariant | null;
    readonly note: string;
}

export const CAPTURE_LEGS: readonly CaptureLeg[] = [
    { label: 'production', variant: null, note: '生产真链路（shell.buildRenderModel ⇒ 招牌珠拼 + 5×5 缩略 + 3 行陈列）' },
    { label: 'signage.off', variant: { signage: false }, note: '差分对照 A 基腿：招牌 beadText 不上屏（也不回落文字）' },
    { label: 'wall.rows2', variant: { wallRows: 2 }, note: '差分对照 B：陈列格 3→2 行（T-1 §3.8 回退序 1）' },
    { label: 'thumb.n4', variant: { thumbN: 4 }, note: '差分对照 C-2：缩略 5→4 档（回退序 2）' },
    { label: 'thumb.n3', variant: { thumbN: 3 }, note: '差分对照 C-3：缩略 5→3 档（回退序 3）' },
    { label: 'floor.allOff', variant: { signage: false, wallRows: 2, thumbN: 3 }, note: '全回落地板（回退序 1+2+5 同时生效的净底座）' },
];

/** 生产默认档的显式写法（用于「不传 ≡ 传默认值」的等价自证）。 */
export const DEFAULT_EXPLICIT: MetaViewVariant = {
    signage: true,
    wallRows: WALL_ROWS,
    thumbN: THUMB_MATRIX_N,
};

/** 位表侧的分子（真源 = `config/sign-glyphs.ts` 自算，非抄来的纸面值）。 */
export const SIGN_BEADS_FROM_GLYPHS: number = signGlyphBeadsOf(COPY_TOKENS.app_name);
export const SIGN_COMMANDS_FROM_GLYPHS: number = SIGN_BEADS_FROM_GLYPHS * BEAD_STYLE_MAX_COMMANDS;
export const SIGN_GLYPH_N_FROM_TABLE: number = SIGN_MATRIX_N;
export const SIGN_PITCH: number = SIGN_BEAD_PITCH;
