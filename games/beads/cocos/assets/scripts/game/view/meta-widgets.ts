/**
 * MetaView 通用控件与文案（WXG-T-420 T7 切出）：钮画法 / 作品格 / 文案表 / 按下态 /
 * 位图可用性注入（`setMenuBitmapResolver`）。主菜单与选关页共用 ⇒ 位于二者之下、⛔ 不反依赖页面。
 */

import { DESIGN_W, LEVEL_DETAIL_TEXTURES, LEVEL_SELECT_GEO, LEVEL_SELECT_TEXTURES, UI_CONTAINER } from '../config/tuning';
import { COPY_TOKENS } from '../config/copy-tokens';
import { type RenderModelBuilder } from '../../framework/index';
import { beadFadedInksFor, withAlpha, type BeadsPalette } from './palette';
import { drawBeadFace, resetSignageWarnings } from './menu-signage';
import { scrimFill, UI_FONT, UI_SCRIM, pressOffset } from './ui-theme';
import { drawButton } from './ui-widgets';
import { settingsContentLabel } from './settings-content';
import type { Box, MetaAction, MetaButton, MetaViewData } from './meta-types';
import type { LevelSelectCellViewModel, LevelSelectViewModel } from './level-select-view-model';
/**
 * `[WXG-T-937]` 位图可用性注入点已下沉 `view/bitmap-ready.ts`（避免与 `settings-content`
 * 互相引用成环）；本件仅 re-export，宿主注入点与查询口径不变。
 */
export { menuBitmapReady, setMenuBitmapResolver } from './bitmap-ready';
import { menuBitmapReady } from './bitmap-ready';


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
        // `[WXG-T-993]` EP15 机器人演示入口（主菜单 CTA 左侧纸钮）。
        case 'bot-demo':
            return COPY_TOKENS.btn_bot_demo_label;
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

/** 测试专用：复位本模块的一次性告警门。 */
export function resetMetaViewWarnings(): void {
    resetSignageWarnings();
}

/**
 * `[WXG-T-606]` **木托盘凹槽格**（选关页专用；Token Plan 两 seed 定稿）：
 * 木框 → 2px 深槽线 → 内窗 → 顶缘受光；三带分离：编号牌顶 / 图案槽中 / 星带底。
 * `[FIX: BlitLayerUI 压 Graphics]` 三态格底位图腿已删，恒走程序化腿；当前关 = 亮金内窗 + 高亮环。
 * `[WXG-T-611]` 未解锁 = drawBeadFace 灰色珠面、无星；黄铜描边已随「高亮态就是高亮图」令退场。
 */
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
    // `[WXG-T-613]` 缩略切完整豆面档（盘面真实行列）⇒ `vm.thumbN`（聚合档参数）不再进本函数；
    // `[WXG-T-621]` 用户令「用当前应用的珠面效果绘制缩略图」⇒ 从 VM 取 `beadStyle`
    // （宿主每帧由 `MetaViewData.beadStyle` 投影）透传给珠面腿与盘面同肤。
    vm: LevelSelectViewModel,
    palette: BeadsPalette,
): void {
    const st = LEVEL_SELECT_GEO.gridStyle;
    const { x, w, h } = cell.box;
    const y = cell.box.y + cell.pressDy;

    // `[2026-11-20]` 用户令「未解锁格子应该是 normal 背景」⇒ 稿面 `183:38 Normal` 位图底恢复入包。
    // `[2026-11-21]` 实帧修正（K-109 / K-115）：normal 底是**格内容底**，须与锁纹理同挂 `BlitLayerUI`
    // 才不会被整片不透明 tray 盖住（此前压到 Graphics 之下时 9 格只剩深棕背板，浅木底零上屏）。
    // 但同层不透明底会盖住已解锁格的 `drawBeadFace` 珠面 ⇒ 只给「无珠面」的锁格 / 越界空槽铺，
    // 已解锁非当前格继续走下面的程序化木框；当前关仍是亮金内窗 + 高亮环。缺图 ⇒ 同样回退。
    const normalBg = (cell.locked || cell.levelIdx === undefined)
        && menuBitmapReady(LEVEL_SELECT_TEXTURES.cellNormal);
    if (normalBg) {
        builder.blit(LEVEL_SELECT_TEXTURES.cellNormal, x, y, w, LEVEL_SELECT_GEO.cellArt.h);
    } else {
        // `[WXG-T-606]` 程序化木托盘：木框 → 深槽线 → 内窗 → 顶缘受光。
        builder.rect(x, y, w, h, { fill: palette.woodSheen, radius: st.radius });
        builder.rect(x + st.frame / 2, y + st.frame / 2, w - st.frame, h - st.frame, {
            stroke: palette.shadowInk, lineWidth: st.groove, radius: st.radius - 2,
        });
        builder.rect(x + st.frame, y + st.frame, w - st.frame * 2, h - st.frame * 2, {
            // `[WXG-T-611]` 用户令「高亮态就是高亮图，不需要加框」⇒ 当前关以亮金内窗表达。
            fill: cell.pressed ? palette.cardPressed : (cell.current ? palette.plateSubInk : palette.slot),
            radius: st.radius - 4,
        });
        builder.line(x + 8, y + h - st.frame - 1, x + w - 8, y + h - st.frame - 1, withAlpha(palette.woodSheen, 0.6), 1);
        // `[WXG-T-612·三轮]` 高亮环（当前关）：程序化腿也画，保持视觉同源。
        if (cell.current) {
            const r = LEVEL_SELECT_GEO.cellArt.ring;
            const rx = x + r.insetX, ry = y + r.insetY, rw = w - r.insetX * 2, rh = h - r.insetY * 2;
            builder.rect(rx, ry, rw, rh, { stroke: withAlpha(r.glow, r.glowAlpha), lineWidth: r.glowW, radius: r.radius });
            builder.rect(rx, ry, rw, rh, { stroke: r.stroke, lineWidth: r.strokeW, radius: r.radius });
        }
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
    // `[WXG-T-915]` 编号牌口径 = **全局关号**（`level.id`，用户 2026-11-12 裁）：与详情副标题 /
    // HUD `LV n/N` / 大关木牌关序同轴。此前印**章内格位** `slot + 1` ⇒ 第二章 boss（id 10）读成
    // 「1」，同一关两个号。越界空槽无关卡引用 ⇒ 只留牌底、不印数字（⛔ 不拿格位冒充关号）。
    if (cell.level !== undefined) {
        builder.text(x + w / 2, by + a.brandH / 2, `${cell.level.id}`, {
            fill: palette.plateSubInk, font: UI_FONT.button, align: 'center', baseline: 'middle',
        });
    }

    // 内容层：全部由 ViewModel 驱动（⛔ 不读 MetaViewData）。
    // `[WXG-T-607]` 三带按稿分离：编号牌在格顶、图案槽在格中、星带在格底。
    // `[2026-11-20]` 用户令「直接用锁纹理代替缩略图，锁的位置靠下一点，因为下面没有三个星星」
    // ⇒ 未解锁/越界空槽格：位图就绪时整枚铺稿面圆珠锁（等比，⛔ 不拉伸），相对图案槽下移
    // `lockDrop`（锁格隐藏三星，星带空出的高度还给锁）；缺图 ⇒ 灰珠阵 / slot 占位降级腿。
    const ix = x + a.imageLeft;
    const iy = y + (h - a.imageTopDown - a.imageH);
    if (cell.locked || cell.levelIdx === undefined) {
        if (menuBitmapReady(LEVEL_SELECT_TEXTURES.lockImage)) {
            const lh = a.imageH;
            const lw = lh * a.lockW / a.lockH;
            builder.blit(LEVEL_SELECT_TEXTURES.lockImage, x + (w - lw) / 2, iy - a.lockDrop, lw, lh);
        } else if (cell.level !== undefined) {
            drawBeadFace(builder, cell.level, ix, iy, a.imageW, a.imageH, palette, beadFadedInksFor(cell.level), vm.beadStyle, vm.beadSize, 'center', true);
        } else {
            builder.rect(ix, iy, a.imageW, a.imageH, { fill: palette.slot, radius: 6 });
        }
        return;
    }
    if (cell.level !== undefined) {
        drawBeadFace(builder, cell.level, ix, iy, a.imageW, a.imageH, palette, undefined, vm.beadStyle, vm.beadSize, 'center', true);
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


/**
 * `[WXG-T-612]` 选关 / 详情两弹框**背景框共用绘制**（用户令「背景框绘制…需要共用逻辑」）：
 * 遮罩 → 木牌位图 blit（`LEVEL_DETAIL_TEXTURES.plaque`，缺图 ⇒ 纸面板同几何回退）。
 * 两页层序与浓度单源 ⇒ 改一处两页生效；`plate` 传宿主位移后的实际框（两页容器同件 581×1044）。
 * `[WXG-T-935]` `scrimAlpha` 可选：设置弹窗沿用 `UI_SCRIM.settingsAlpha`（0.3），缺省 = 通用 0.5。
 */
export function drawModalPlate(
    builder: RenderModelBuilder,
    palette: BeadsPalette,
    plate: Box,
    screenH: number,
    scrimAlpha: number = UI_SCRIM.alpha,
): void {
    builder.rect(0, 0, DESIGN_W, screenH, { fill: scrimFill(UI_SCRIM.overlay, scrimAlpha) });
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
