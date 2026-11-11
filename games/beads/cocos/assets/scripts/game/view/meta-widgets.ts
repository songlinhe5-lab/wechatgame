/**
 * MetaView 通用控件与文案（WXG-T-420 T7 切出）：钮画法 / 作品格 / 文案表 / 按下态 /
 * 位图可用性注入（`setMenuBitmapResolver`）。主菜单与选关页共用 ⇒ 位于二者之下、⛔ 不反依赖页面。
 */

import { DESIGN_W, LEVEL_DETAIL_TEXTURES, LEVEL_SELECT_GEO, LEVEL_SELECT_TEXTURES, MENU_BADGE, MENU_LOCKED_ICON, MENU_SEAL, MENU_TEXTURES, THUMB_AREA, THUMB_STAR_BAND, UI_CONTAINER } from '../config/tuning';
import { COPY_TOKENS } from '../config/copy-tokens';
import { type RenderModelBuilder } from '../../framework/index';
import { beadFadedInksFor, withAlpha, type BeadsPalette } from './palette';
import { drawLevelThumb, resetSignageWarnings } from './menu-signage';
import { type BeadsLevelRaw } from '../config/levels-data';
import { scrimFill, UI_FONT, UI_SCRIM, pressOffset } from './ui-theme';
import { drawButton } from './ui-widgets';
import { settingsContentLabel } from './settings-content';
import type { Box, MetaAction, MetaButton, MetaViewData } from './meta-types';
import type { LevelSelectCellViewModel, LevelSelectViewModel } from './level-select-view-model';
/**
 * 菜单位图可用性查询（宿主注入：harness 纹注册表 / Cocos carrier）。
 * 缺省全 `false` ⇒ 菜单全部腿走程序化占位 ⇒ 帧内容与位图化之前一致（旧测试套件钉住该等价）。
 */
let _menuBitmapReady: (textureId: string) => boolean = () => false;
export function setMenuBitmapResolver(fn?: (textureId: string) => boolean): void {
    _menuBitmapReady = fn ?? (() => false);
}

// ── 走马灯小卡（menu-architecture §1.3 第五轮终裁：主菜单主区 = 单卡进度展示，卡 = 唯一选关入口）。
//    几何由 {@link anchoredGeo} 逐机算定（`bossBox` 图位 ⇒ `[WXG-T-281]` 旧白卡退场）⇒ 静态档 `CAROUSEL_BOX` 已随锚定档退场。
/** 星级_label 查表（取代旧每帧 `'★'.repeat(n)+'☆'.repeat(3-n)` ⇒ 逐字同串、每帧零字符串分配）。 */
export const STAR_LABELS: readonly string[] = ['☆☆☆', '★☆☆', '★★☆', '★★★'];
/** 顶栏三颗全部实装（`[WXG-T-365]`：中档由公告预留位升格为装扮馆入口 ⇒ 预留数组与禁用态退场）。 */

export function label(id: MetaAction, data: MetaViewData): string {
    switch (id) {
        // EP12-S6 · P-7：**钮标签一律读文案表**（`tokens.md §7` / `menu-architecture §6`），⛔ 不落字面。
        case 'start':
            // `[WXG-T-593]` 2026-11-07 用户令：**去掉续关字样**（原 `继续 · 第{n}关`）⇒ 主钮恒为 `开始游戏`。
            // 原 `[WXG-T-490]` 浏览态自证（走马灯离开起点页时换文案）随之退场；且 CTA 整枚位图已烘「开始」，
            // 视觉上只剩烙字。`btn_start_resume_label` 令牌保留（K-053 留档）但**当前无引用、不上屏**。
            return COPY_TOKENS.btn_start_label;
        case 'open-signin':
            return COPY_TOKENS.btn_signin_label;
        case 'open-settings':
            return COPY_TOKENS.btn_settings_label;
        case 'open-levels':
            // §6 标**退役**（主菜单钮已删 = Q5①「入口隐藏」），但 `levels` overlay 代码保留 ⇒ 仍读表。
            return COPY_TOKENS.btn_levels_label;
        case 'studio-import':
            return '导入';
        case 'claim':
            return data.canClaim ? '领取' : '已领取';
        case 'back':
            return '返回';
        // `[WXG-T-601]` 关卡详情「开始」CTA（文案与主菜单 `btn_start_label` 同令牌族；「关卡详情」弹窗
        // 语义 = 确认进入该关 ⇒ 复用同一文案真源，⛔ 不新造「进入本关」第二套）。
        case 'start-detail':
            return COPY_TOKENS.btn_start_label;
        // `[WXG-T-472]` 名片入口钮（[WXG-T-501] 图鉴 / 本地榜两入口下线）。
        case 'open-profile':
            return COPY_TOKENS.btn_profile_label;
        // UI-30：设置内容块（文案 / 绘制）由 `view/settings-content.ts` 单源；
        // 暂停面板 `view-model::panelLabel` 读同一函数 ⇒ 两入口档位名永不漂移。
        case 'toggle-bgm':
        case 'toggle-sfx':
        case 'toggle-reduce-motion':
        case 'toggle-large-text':
        case 'toggle-vibrate':
        case 'toggle-debug-info':
        case 'toggle-debug-guides':
        case 'cycle-bead-style':
        case 'cycle-bead-size':
        case 'cycle-skin':
            return settingsContentLabel(id, data);
        default:
            return '';
    }
}

/** 按下态绘制 y 偏移（算法在 `ui-theme::pressOffset`，本包装只取视图数据字段）。 */
export function pressDy(data: MetaViewData, pressed: boolean): number {
    return pressOffset(pressed, data.reduceMotion);
}

/** 当前按住的是否为该动作（主菜单锚定档每动作唯一一枚钮 ⇒ 按 id 比对即可）。 */
export function isPressed(data: MetaViewData, id: MetaAction): boolean {
    return data.pressed?.id === id;
}

/**
 * L4 资源条 = **钉在展示窗门楣的一条价目牌**（`menu-architecture §5.1b-2` 第十一批语义 /
 * `[WXG-T-280]` 锚定档几何）。牌体 = `geo.barBox`（条窗一体缝 0，坐在橱窗顶缘） ⇒ 只读、**零热区**。
 *
 * - **图标腿**（落地单 §3 B5/B6）：`iconStamina` / `iconCoin` 位图就绪 ⇒
 *   两端各 blit 一枚 `MENU_BAR_ICON_D`，数值文本**去 emoji**；未就绪 ⇒ 旧 `❤`/`🪙` 文本腿；
 * - **数值字号** = `UI_FONT.label` 28 = accessibility **E1 地板**。⚠ 第九批登记的「26 px」低于
 *   地板 ⇒ 作废（同批注）；图标与数值合为一条 text ⇒ 每端 1 命令（共 2 条，非 4 条）；
 * - **墨色全读 palette**：牌面 `plaque_face` / 描边 `plaque_edge` / 亮线与铆钉 `plaque_bevel` /
 *   字 `wood_text`（对牌面 5.3:1 ✓）⇒ 视图内零 hex 字面（control-manifest §3）。
 */
/**
 * 资源条「心」端文案（§3.14 **v1.99**，用户 2026-11-07 裁定）：
 *
 * - **只出 `cur/max`**，⛔ 不再追 ` ▶N` 广告次数（v1.80 的日限可见尾段**已废**，K-053 留档）——
 *   加心入口不再挂在心的数量旁，改由「点开始按钮时」判断体力并给出提示；
 * - `stamina` 可 **> max**（看广告加心可突破上限）⇒ **如实显示**，如 `11/8`（⛔ 不钳成 `8/8`）。
 *
 * 单条 text ⇒ 每端仍是 1 条绘制命令（`menu-architecture §5.1b-2` 第十一批口径不变）。
 */
export function heartBarLabel(stamina: number, max: number): string {
    // §3.14 **v1.99**（用户 2026-11-07 裁定）：广告加心入口**不再挂在心的数量旁**
    // （原 `3/8 ▶2` 的尾段），改由「点开始按钮时」判断体力并弹框提示 ⇒ 本函数只出 `cur/max`。
    // ⚠ `stamina` 可 > `max`（看广告加心允许突破上限）⇒ 如实显示，如 `11/8`。
    return `${stamina}/${max}`;
}

/** 防御臂告警门（一次性；判例 = `palette.ts::resetPaletteFallbackWarnings`）。 */
let warnedMissingThumbLevel = false;

/** 测试专用：复位本模块的一次性告警门。 */
export function resetMetaViewWarnings(): void {
    warnedMissingThumbLevel = false;
    resetSignageWarnings();
}

/**
 * 作品格（选关**整页**唯一消费；主菜单已改走马灯小卡 ⇒ 不再共享本 renderer）。
 * - **已解锁** = 纸格容器 + **珠拼缩略**（T-1 §3.1 聚合，`view/menu-signage.ts::drawLevelThumb`）+ 星；
 * - **未解锁 / 越界槽** = 锁格合形（灰阵 + 小锁 + 无星；⛔ 不画虚线）。
 *
 * ⚠ **T-2B 换了格内内容：编号文本退场**（`menu-wall-signage-spec §3.4` 案乙：格几何与热区零变动，
 * 只换内容物）。编号是 T-2A 的**占位**（当时无珠可画）；珠拼缩略就位后它与图竞争同一 84×84 区、
 * 且不传达任何关卡差异 ⇒ 删。陈列序的机械证据改由「缩略与 `wallLevels[slot]` 的聚合表逐条对撞」
 * 提供（见 `tests/meta-menu-wall.test.ts`，比读编号**更强**）。
 * 星位：从旧「格中心 +28」改为**底部星带中心** `box.y + THUMB_STAR_BAND/2`（案乙的分区口径）。
 *
 * @param thumbN 缩略字模阵（生产恒 `THUMB_MATRIX_N`；4 / 3 = K-6 差分与回退序 2/3）
 */
/**
 * 锁格（EP13-FU-1 · tls §4「未解锁格 / 越界空槽」两行，Q15 = 2026-10-17 改裁**合形**）：
 * 灰色珠阵（有关卡引用时，走橱窗未开启同一墨集 `beadFadedInksFor`）+ 小锁 + **无星**；⛔ 不画虚线空槽。
 * 越界槽拿不到关卡引用 ⇒ 画不出珠阵（数据驱动，⛔ 不拿别关的图凑），只留格底 + 锁。
 * 锁尺与回落口径逐字复用走马灯徽标（`MENU_BADGE.d` / 位图未就维 = 圆章 +「锁」字），零新数值零新色。
 */
/**
 * 锁角章（未解锁格共用；`[WXG-T-606]` 从 `drawLockedWallCell` 抽出）：位图腿优先，
 * 缺图 = 圆章 +「锁」字（零新数值零新色）。`cell` 传**未位移**框 ⇒ 按下位移不撕角章。
 */
function drawWallLockBadge(builder: RenderModelBuilder, palette: BeadsPalette, cell: Box): void {
    const d = MENU_BADGE.d;
    const inset = MENU_SEAL.inset;
    const cx = cell.x + cell.w - d / 2 - inset;
    const cy = cell.y + cell.h - d / 2 - inset;
    if (menuBitmapReady(MENU_TEXTURES.lock)) {
        // `[WXG-T-578]` 锁形按纹理宽高比出高（Figma v2 竖长件），底边维持原内缩 ⇒ 只向上长。
        const h = d / MENU_LOCKED_ICON.aspect;
        builder.blit(MENU_TEXTURES.lock, cx - d / 2, cell.y + cell.h - inset - h, d, h);
        return;
    }
    builder.circle(cx, cy, d / 2, { fill: palette.slot, stroke: palette.slotBorder, lineWidth: 2 });
    builder.text(cx, cy, '锁', { fill: palette.textDim, font: UI_FONT.cell, align: 'center', baseline: 'middle' });
}

function drawLockedWallCell(
    builder: RenderModelBuilder,
    cell: Box,
    palette: BeadsPalette,
    level: BeadsLevelRaw | undefined,
    thumbN: number,
): void {
    builder.rect(cell.x, cell.y, cell.w, cell.h, {
        fill: palette.slot,
        stroke: palette.slotBorder,
        lineWidth: 2,
        radius: UI_CONTAINER.radiusChip,
    });
    if (level !== undefined) {
        drawLevelThumb(builder, level, cell.x, cell.y, cell.w, cell.h, thumbN, THUMB_AREA, beadFadedInksFor(level));
    }
    drawWallLockBadge(builder, palette, cell);
}

export function drawWallCell(
    builder: RenderModelBuilder,
    b: MetaButton,
    data: MetaViewData,
    palette: BeadsPalette,
    thumbN: number,
): void {
    const slot = b.slot;
    const levelIdx: number | undefined = slot === undefined ? undefined : data.wallSlots[slot];
    // `[WXG-T-345]` S-4：章首格在「门票已达成、但推进位尚未越过章界」时也是可进格（shell 的
    // `pick-level` 会在点击那一刻推既有两根指针）⇒ 锁判据追加章首豁免。
    // ⚠ 只认 `=== true`：旧调用方 / 合成数据不传该字段 ⇒ 锁判据逐字不变（零漂移）。
    const gateOpensFirst = slot === 0 && data.arcTicketOpen === true;
    if (levelIdx === undefined || (levelIdx + 1 > data.maxUnlockedLevel && !gateOpensFirst)) {
        // EP13-FU-1 · Q15 合形：未解锁与越界空槽同走锁格（虚线空槽在墙格路径退场；零热区不变）。
        drawLockedWallCell(builder, b.box, palette, slot === undefined ? undefined : data.wallLevels[slot], thumbN);
        return;
    }
    const isCurrent = levelIdx === data.currentLevelIndex;
    const stars = data.starsByLevel[levelIdx] ?? 0;
    // EP13-S5 · tls §4-R6：按住已解锁格 ⇒ 整格下沉（对象身份比对）；reduceMotion ⇒ 位移归零、换面仍在。
    const pressed = data.pressed === b;
    const dy = pressDy(data, pressed);
    const y = b.box.y + dy;
    builder.rect(b.box.x, y, b.box.w, b.box.h, {
        fill: pressed ? palette.cardPressed : palette.slot,
        stroke: isCurrent ? palette.accentPrimary : palette.slotBorder,
        lineWidth: isCurrent ? 4 : 2,
        radius: UI_CONTAINER.radiusChip,
    });
    const cx = b.box.x + b.box.w / 2;
    const level = slot === undefined ? undefined : data.wallLevels[slot];
    builder.text(cx, y + THUMB_STAR_BAND / 2, STAR_LABELS[stars] ?? STAR_LABELS[0]!, {
        fill: stars > 0 ? palette.text : palette.textDim,
        font: UI_FONT.cell,
        align: 'center',
        baseline: 'middle',
    });
    if (level === undefined) {
        // 防御臂（不应发生）：shell 的 `wallLevels` 与 `wallSlots` 同批重建 ⇒ 已解锁槽必有引用。
        // 若宿主只下传了关索引表（旧调用方）⇒ 回落**编号占位**（T-2A 语言，格不空画），一次性告警。
        if (!warnedMissingThumbLevel) {
            warnedMissingThumbLevel = true;
            console.warn(
                '[beads] meta-view: wallSlots 有值但 wallLevels 缺项 ⇒ 该格回落编号占位（珠拼缩略需关卡 pattern 本体，' +
                '见 beads-shell::_rebuildWallSlots；本条仅告警一次）',
            );
        }
        builder.text(cx, y + b.box.h / 2 - 8, `${levelIdx + 1}`, {
            fill: palette.text,
            font: UI_FONT.button,
            align: 'center',
            baseline: 'middle',
        });
        return;
    }
    drawLevelThumb(builder, level, b.box.x, y, b.box.w, b.box.h, thumbN, THUMB_AREA);
}

/**
 * `[WXG-T-606]` **木托盘凹槽格**（选关页专用；Token Plan 两 seed 定稿）：
 * 木框 → 2px 深槽线 → 内窗 → 顶缘受光；三带分离：编号牌顶 / 图案槽中 / 星带底。
 * `[WXG-T-611]` 未解锁 = 图案槽贴稿面锁图（缺图灰珠阵）、无星；当前关 = 亮金格底（位图腿）
 * / 亮金内窗（降级腿）——黄铜描边已随「高亮态就是高亮图」令退场。
 */
/** `[WXG-T-610]` 三态格底（稿 `183:38/41/44`：橙 = 普通 / 亮金 = 当前 / 灰 = 锁定）。 */
function cellTexture(cell: LevelSelectCellViewModel): string {
    if (cell.locked || cell.levelIdx === undefined) return LEVEL_SELECT_TEXTURES.cellLocked;
    if (cell.current) return LEVEL_SELECT_TEXTURES.cellCurrent;
    return LEVEL_SELECT_TEXTURES.cellNormal;
}

/** `[WXG-T-610]` 三星位图（32×30 / 净距 9）贴格底；缺图 ⇒ 旧文字档。 */
function drawCellStars(
    builder: RenderModelBuilder,
    cell: LevelSelectCellViewModel,
    palette: BeadsPalette,
): void {
    const { x, w } = cell.box;
    const y = cell.box.y + cell.pressDy;
    const a = LEVEL_SELECT_GEO.cellArt;
    // `[WXG-T-611]` 锁格不再进本函数（图案槽 + 星带隐藏）⇒ 旧锁判退场，n 恒 = stars。
    const n = cell.stars;
    if (menuBitmapReady(LEVEL_SELECT_TEXTURES.starFilled) && menuBitmapReady(LEVEL_SELECT_TEXTURES.starEmpty)) {
        const total = 3 * a.starW + 2 * a.starGap;
        const left = x + (w - total) / 2;
        const sy = y + a.starBandY - a.starH / 2;
        for (let i = 0; i < 3; i += 1) {
            builder.blit(i < n ? LEVEL_SELECT_TEXTURES.starFilled : LEVEL_SELECT_TEXTURES.starEmpty,
                left + i * (a.starW + a.starGap), sy, a.starW, a.starH);
        }
    } else {
        builder.text(x + w / 2, y + a.starBandY, STAR_LABELS[n] ?? STAR_LABELS[0]!, {
            fill: n > 0 ? palette.plateSubInk : palette.textDim,
            font: UI_FONT.cell, align: 'center', baseline: 'middle',
        });
    }
}

export function drawLevelSelectCell(
    builder: RenderModelBuilder,
    cell: LevelSelectCellViewModel,
    vm: LevelSelectViewModel,
    palette: BeadsPalette,
    cellTextureId: string,
): void {
    const st = LEVEL_SELECT_GEO.gridStyle;
    const { x, w, h } = cell.box;
    const y = cell.box.y + cell.pressDy;

    const tex = cellTexture(cell);
    if (menuBitmapReady(tex)) {
        // `[WXG-T-610]` 三态稿面格底 158×177：底对齐格框（格高 181，顶部 4px 让编号牌溢出）。
        builder.blit(tex, x, y, w, LEVEL_SELECT_GEO.cellArt.h);
    } else if (menuBitmapReady(cellTextureId)) {
        // 次级降级：`T-607` 通用木纹模板（K-053 留档）。
        builder.blit(cellTextureId, x, y, w, LEVEL_SELECT_GEO.cellArt.h);
    } else {
        // 缺图降级腿（`[WXG-T-606]` 程序化木托盘）：木框 → 深槽线 → 米白内窗 → 顶缘受光。
        builder.rect(x, y, w, h, { fill: palette.woodSheen, radius: st.radius });
        builder.rect(x + st.frame / 2, y + st.frame / 2, w - st.frame, h - st.frame, {
            stroke: palette.shadowInk, lineWidth: st.groove, radius: st.radius - 2,
        });
        builder.rect(x + st.frame, y + st.frame, w - st.frame * 2, h - st.frame * 2, {
            // `[WXG-T-611]` 用户令「高亮态就是高亮图，不需要加框」⇒ 降级腿旧黄铜描边退场（K-053），
            // 当前关以亮金内窗（plate_sub_ink，稿面编号数字同族暖金）表达。
            fill: cell.pressed ? palette.cardPressed : (cell.current ? palette.plateSubInk : palette.slot),
            radius: st.radius - 4,
        });
        builder.line(x + 8, y + h - st.frame - 1, x + w - 8, y + h - st.frame - 1, withAlpha(palette.woodSheen, 0.6), 1);
    }

    // 编号牌（稿 `182:75 grid-brand`，65×35 贴格视觉顶）：`[WXG-T-611]` 背景读稿面资源；
    // 数字仍由 VM 程序化（稿 `176:67` 烘死「1」，九格复用会写死，⛔ 不切字）。缺图 ⇒ 程序化木牌回退。
    const a = LEVEL_SELECT_GEO.cellArt;
    const bx = x + (w - a.brandW) / 2, by = y + h - a.brandH;
    if (menuBitmapReady(LEVEL_SELECT_TEXTURES.brand)) {
        builder.blit(LEVEL_SELECT_TEXTURES.brand, bx, by, a.brandW, a.brandH);
    } else {
        builder.rect(bx, by, a.brandW, a.brandH, { fill: palette.woodEdge, radius: 8 });
    }
    builder.text(x + w / 2, by + a.brandH / 2, `${cell.slot + 1}`, {
        fill: palette.plateSubInk, font: UI_FONT.button, align: 'center', baseline: 'middle',
    });

    // 内容层：全部由 ViewModel 驱动（⛔ 不读 MetaViewData）。
    // `[WXG-T-607]` 三带按稿分离：编号牌在格顶、图案槽在格中、星带在格底。
    // `[WXG-T-611]` 图案槽 = 稿 `176:21 grid-image` 69×76 @格内 (44, 距视觉顶 49)：锁定 = 稿面锁
    // 图案位图（缺图 ⇒ 灰珠阵降级），解锁 = 程序化珠拼；两态都**隐藏三星** + 旧锁角章退场（K-053）。
    const ix = x + a.imageLeft;
    const iy = y + (h - a.imageTopDown - a.imageH);
    if (cell.locked || cell.levelIdx === undefined) {
        if (menuBitmapReady(LEVEL_SELECT_TEXTURES.lockImage)) {
            builder.blit(LEVEL_SELECT_TEXTURES.lockImage, ix, iy, a.imageW, a.imageH);
        } else if (cell.level !== undefined) {
            drawLevelThumb(builder, cell.level, ix, iy, a.imageW, a.imageH, vm.thumbN, a.imageW, beadFadedInksFor(cell.level));
        }
        return;
    }
    if (cell.level !== undefined) {
        drawLevelThumb(builder, cell.level, ix, iy, a.imageW, a.imageH, vm.thumbN, a.imageW);
        drawCellStars(builder, cell, palette);
    }
    // `[WXG-T-610]` 当前关由亮金格底表达；旧黄铜描边随 T-611 降级腿一并退场（K-053 留档）。
}

/**
 * 通用钮绘制（`signin` / `settings` 弹窗与选关页共用）：主/次档、禁用、按下位移、宽字档。
 * 抽出自 `buildMetaView` 旧循环体（WXG-T-314）；表达式逐字搬运 ⇒ 静息帧零漂移。
 */
export function drawMetaButton(builder: RenderModelBuilder, palette: BeadsPalette, data: MetaViewData, b: MetaButton): void {
    // `[WXG-T-601]` `start-detail`（关卡详情 CTA）与 `claim` 同列主行动档。
    const primary = b.id === 'claim' || b.id === 'start-detail';
    const disabled = b.id === 'claim' && !data.canClaim;
    // EP11-S5 行4：选择器钮带现档名（如「珠子风格  经典四棱」）⇒ 30px 字模宽于 colW 248，
    // 沿用暂停面板同族做法：小字档（不动已冻结的 plate 几何）。
    const wide = b.id === 'cycle-bead-style' || b.id === 'cycle-bead-size';
    const pressed = data.pressed === b && !disabled;
    drawButton(
        builder,
        palette,
        b.box.x,
        b.box.y + pressDy(data, pressed),
        b.box.w,
        b.box.h,
        primary ? 'accent' : 'ghost',
        14,
        label(b.id, data),
        wide ? UI_FONT.cell : UI_FONT.button,
        pressed,
        disabled,
    );
}


/** 位图可用性查询（读取走本函数 ⇒ 注入点与消费点分居各文件时仍同源）。 */
export function menuBitmapReady(textureId: string): boolean {
    return _menuBitmapReady(textureId);
}

/**
 * `[WXG-T-612]` 选关 / 详情两弹框**背景框共用绘制**（用户令「背景框绘制…需要共用逻辑」）：
 * 遮罩 → 木牌位图 blit（`LEVEL_DETAIL_TEXTURES.plaque`，缺图 ⇒ 纸面板同几何回退）。
 * 两页层序与浓度单源 ⇒ 改一处两页生效；`plate` 传宿主位移后的实际框（两页容器同件 581×1044）。
 */
export function drawModalPlate(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    plate: Box,
    screenH: number,
): void {
    builder.rect(0, 0, DESIGN_W, screenH, { fill: scrimFill(UI_SCRIM.overlay, UI_SCRIM.alpha) });
    if (menuBitmapReady(LEVEL_DETAIL_TEXTURES.plaque)) {
        builder.blit(LEVEL_DETAIL_TEXTURES.plaque, plate.x, plate.y, plate.w, plate.h);
    } else {
        builder.rect(plate.x, plate.y, plate.w, plate.h, { fill: palette.panel, radius: UI_CONTAINER.radiusPanel });
    }
}

/**
 * `[WXG-T-604 / T-605]` 木牌右上角**深实底凹槽 ✕**（关卡详情与选关页共用同一件）。
 * 层序 = 深实底 → 3px 框槽线 → 下内壁 1px 受光 → ✕（深色垫底 5px + 米白 3px）。
 * ⛔ 不做上内壁阴影（用户令「去掉框内阴影」）；光向只留底缘受光，读作浅凹槽。
 */
export function drawCloseInset(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    cx: number,
    cy: number,
    w: number,
    h: number,
    arm: number,
    pressed: boolean,
): void {
    const x = cx - w / 2;
    const y = cy - h / 2;
    const radius = 10;
    // 1) 深实底（按下再压深）
    builder.rect(x, y, w, h, { fill: pressed ? palette.shadowInk : palette.woodEdge, radius });
    // 2) 框槽线：3px 切进木面的凹缝
    builder.rect(x, y, w, h, { stroke: palette.shadowInk, lineWidth: 3, radius });
    // 3) 只留下内壁 1px 受光
    builder.line(x + 4, y + 2, x + w - 4, y + 2, withAlpha(palette.woodSheen, 0.7), 1);
    // 4) ✕ 嵌线：深色 5px 垫底（下移 1px）+ 米白 3px 面线 ⇒ 嵌进深底
    builder.line(cx - arm, cy - arm - 1, cx + arm, cy + arm - 1, palette.shadowInk, 5);
    builder.line(cx - arm, cy + arm - 1, cx + arm, cy - arm - 1, palette.shadowInk, 5);
    builder.line(cx - arm, cy - arm, cx + arm, cy + arm, palette.woodText, 3);
    builder.line(cx - arm, cy + arm, cx + arm, cy - arm, palette.woodText, 3);
}
