/**
 * `[WXG-T-607]` 选关弹窗 View/ViewModel 契约（用户令「按照 view-viewmodel 模式实现」）。
 * 判据只钉工程可证面：① 持续型 VM 逐帧复用同一预分配对象；② `grid-1` 模板九格复用、
 * 与命中同源；③ 纹理未注册 ⇒ 程序化木托盘降级腿（零 blit）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { DESIGN_H, DESIGN_W, BELOW_GRAPHICS_TEXTURE_IDS, LEVEL_DETAIL_TEXTURES, LEVEL_SELECT_GEO, LEVEL_SELECT_TEXTURES, WALL_ROWS } from '../src/config/tuning.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { UI_FONT } from '../src/view/ui-theme.js';
import { metaLayout } from '../src/view/meta-view.js';
import { setMenuBitmapResolver } from '../src/view/meta-widgets.js';
import { createLevelSelectViewModel, updateLevelSelectViewModel } from '../src/view/level-select-view-model.js';
import { drawLevelsView } from '../src/view/level-select-view.js';
import type { MetaViewData } from '../src/view/meta-types.js';

const data = (): MetaViewData => Object.freeze({
    stamina: 5, staminaMax: 5, coins: 0, overlay: 'levels' as const,
    signinDay: 0, canClaim: false, bgmMuted: false, sfxMuted: false,
    reduceMotion: false, largeText: false, vibrate: true, debugInfo: false, debugGuides: false,
    beadStyle: 'facet-4', beadSize: 'full' as const, skinId: 'tokens',
    levelCount: LEVELS.length, currentLevelIndex: 0, maxUnlockedLevel: LEVELS.length,
    starsByLevel: [], wallSlots: [0, 1, 2, 3, 4, 5, 6, 7, 8], wallLevels: LEVELS.slice(0, 9),
    chapterTitle: '曼陀罗', arcStarGot: 3, arcStarNeed: 9,
}) as unknown as MetaViewData;

const buttons = metaLayout('levels', WALL_ROWS).buttons;
const frame = (ready: (id: string) => boolean, override: Partial<MetaViewData> = {}): readonly DrawCommand[] => {
    setMenuBitmapResolver(ready);
    const vm = createLevelSelectViewModel();
    updateLevelSelectViewModel(vm, { ...data(), ...override } as MetaViewData, buttons, DESIGN_H, 5);
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    drawLevelsView(b, vm, DEFAULT_PALETTE);
    return b.end().commands;
};
const cellBlits = (cmds: readonly DrawCommand[]) => cmds.filter(
    (c) => c.kind === 'blit' && (c as { textureId: string }).textureId === LEVEL_SELECT_TEXTURES.cell,
) as readonly { x: number; y: number; w: number; h: number }[];

afterEach(() => setMenuBitmapResolver(undefined));

describe('WXG-T-607 选关弹窗 View/ViewModel', () => {
    it('持续型 VM：逐帧写入同一预分配对象，九格零新建', () => {
        const vm = createLevelSelectViewModel();
        const cell0 = vm.cells[0];
        updateLevelSelectViewModel(vm, data(), buttons, DESIGN_H, 5);
        updateLevelSelectViewModel(vm, data(), buttons, DESIGN_H + 1, 4);
        expect(vm.cells).toHaveLength(9);
        expect(vm.cells[0]).toBe(cell0);
        expect(vm.screenH).toBe(DESIGN_H + 1);
        expect(vm.thumbN).toBe(4);
        expect(vm.cells[0]!.locked).toBe(false);
        expect(vm.cells[0]!.current).toBe(true);
    });

    it('`grid-1` 模板九格复用：9 格程序化底 rect 命中九格位置', () => {
        // `[FIX: BlitLayerUI 压 Graphics]` cell 位图 blit 已删，统一走程序化腿。
        // 九格底 rect 以 cell.box 为锚，与命中框同源。
        const cmds = frame((id) => id === LEVEL_SELECT_TEXTURES.cell || id === LEVEL_DETAIL_TEXTURES.plaque);
        const picks = buttons.filter((b) => b.id === 'pick-level');
        for (let i = 0; i < 9; i += 1) {
            const box = picks[i]!.box;
            const hasBottomRect = cmds.some(
                (c) => c.kind === 'rect' && c.x === box.x && c.y === box.y && c.w === box.w && c.h === box.h,
            );
            expect(hasBottomRect, `cell[${i}] 有木框底 rect`).toBe(true);
        }
    });

    it('纹理未注册 ⇒ 程序化木托盘降级腿（零 cell blit）', () => {
        expect(cellBlits(frame(() => false))).toHaveLength(0);
    });

    const countBlit = (cmds: readonly DrawCommand[], id: string): number =>
        cmds.filter((c) => c.kind === 'blit' && (c as { textureId?: string }).textureId === id).length;

    it('`[WXG-T-610/611]` 位图腿：背板 / 编号牌背景 ×9 / 双星 / 底部关闭按钮全部就位（三态格底 + 锁图改程序化腿）', () => {
        const cmds = frame(() => true);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.tray), '九宫格背板').toBe(1);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.closeBtn), '底部关闭按钮').toBe(1);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cell), '旧通用模板退场').toBe(0);
        // `[FIX: BlitLayerUI 压 Graphics]` 三态格底 blit 会盖住 drawBeadFace 的珠面缩略图（rect 走 Graphics
        // 低层，blit 走 BlitLayerUI 高层），统一改为程序化腿（同 Graphics，顺序正确）。
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellCurrent), '当前关改程序化腿').toBe(0);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellLocked), '未解锁格不再有专属灰底').toBe(0);
        // `[WXG-T-1016]` 判据方向翻转：全格统一木纹底 ⇒ 不再按锁定态挑格，九格各一条。
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellNormal), '全格统一 normal 底 ×9').toBe(9);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.brand), '编号牌背景 ×9（`T-611` 稿 `176:22`）').toBe(9);
        expect(
            countBlit(cmds, LEVEL_SELECT_TEXTURES.starFilled) + countBlit(cmds, LEVEL_SELECT_TEXTURES.starEmpty),
            '9 格 × 3 枚星',
        ).toBe(27);
        // `[WXG-T-612·三轮]` 高亮环（稿 grid-4 实例 override `highlight-ring`）：#FFF0B0 内描边 4px
        // + 金色柔光宽 stroke，仅当前关 1 组（组件本体渲染不带 ⇒ ⛔ 烘不进导出图，数据驱动）。
        const rings = cmds.filter(
            (c) => c.kind === 'rect' && 'stroke' in c && c.stroke === '#FFF0B0' && c.lineWidth === 4,
        );
        expect(rings, '高亮环主描边 ×1（当前关）').toHaveLength(1);
        expect(
            cmds.some((c) => c.kind === 'rect' && 'stroke' in c && typeof c.stroke === 'string' && c.stroke.startsWith('rgba(255,224,138')),
            '金色柔光层在环之下',
        ).toBe(true);
    });

    it('[WXG-T-1016 方向翻转] 位图就绪臂：九格背板改由段外容器层统一发，段内不再有同几何程序化底板', () => {
        // K-115 同批登记判据方向翻转：旧断言「每格段内有同几何 rect」是两条背板腿并存时的口径；
        // 用户令「全格统一木纹底」后，位图臂的背板提到段外容器 `BlitLayerUI`，段内只留内容件。
        const cmds = frame(() => true);
        const segAt = cmds.findIndex((c) => c.kind === 'segment');
        const segEndAt = cmds.findIndex((c) => c.kind === 'segmentEnd');
        const picks = buttons.filter((b) => b.id === 'pick-level');
        for (let i = 0; i < 9; i += 1) {
            const box = picks[i]!.box;
            expect(
                cmds.some((c, idx) => c.kind === 'rect' && idx > segAt && idx < segEndAt
                    && c.x === box.x && c.y === box.y && c.w === box.w && c.h === box.h),
                `cell[${i}] 段内不再重复画同几何底板（珠面不被不透明底盖住）`,
            ).toBe(false);
        }
    });

    it('`[2026-11-20]` 锁定态：未解锁格 = normal 位图底 + 锁纹理，星带只剩当前格', () => {
        const cmds = frame(() => true, { maxUnlockedLevel: 1 });
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellLocked), '未解锁格不用灰底').toBe(0);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellCurrent), '当前关改程序化腿').toBe(0);
        // `[WXG-T-1016]` 方向翻转：normal 底不再只给未解锁格 ⇒ 九格统一。
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.cellNormal), '九格统一 normal 底').toBe(9);
        expect(countBlit(cmds, LEVEL_SELECT_TEXTURES.lockImage), '锁纹理替代灰珠面').toBe(8);
        expect(
            countBlit(cmds, LEVEL_SELECT_TEXTURES.starFilled) + countBlit(cmds, LEVEL_SELECT_TEXTURES.starEmpty),
            '锁格隐藏三星 ⇒ 只剩当前格 3 枚',
        ).toBe(3);
        expect(
            cmds.filter((c) => c.kind === 'rect' && 'stroke' in c && c.stroke === '#FFF0B0' && c.lineWidth === 4),
            '高亮环仍只随当前关（`T-612·三轮`）',
        ).toHaveLength(1);
    });
});

/**
 * `[WXG-T-915]` 编号牌口径 = **全局关号**（`level.id`，用户 2026-11-12 裁）。
 * 判据取绘制形态：编号牌文字 = 页内唯一 `UI_FONT.button` 文字腿（关闭钮位图就位时不落文字）
 * ⇒ 按「文字内容 + 牌心坐标」对撞；⛔ 不按格位推号。
 */
describe('WXG-T-915 选关页编号牌 = 全局关号', () => {
    const brandTexts = (cmds: readonly DrawCommand[]) => cmds.filter(
        (c) => c.kind === 'text' && (c as { font?: string }).font === UI_FONT.button,
    ) as readonly { x: number; y: number; text: string }[];
    const pickBoxes = () => buttons.filter((b) => b.id === 'pick-level');

    it('第一章（九关全是真实关）⇒ 牌面仍 1..9（视觉零变化），锁格也印真实关号', () => {
        expect(brandTexts(frame(() => true)).map((t) => t.text)).toEqual(
            ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        );
        expect(brandTexts(frame(() => true, { maxUnlockedLevel: 1 })).map((t) => t.text), '锁格不改口径').toEqual(
            ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        );
    });

    it('第二章（清单 1 关，boss 全局关号 10）⇒ 牌面「10」，越界空槽不印数字', () => {
        const texts = brandTexts(frame(() => true, {
            wallSlots: [9],
            wallLevels: [LEVELS[9]!],
            chapterTitle: '照片冒烟 32',
        }));
        expect(texts.map((t) => t.text), '唯一编号 = 全局关号，⛔ 不是格位「1」').toEqual(['10']);
        const a = LEVEL_SELECT_GEO.cellArt;
        const box = pickBoxes()[0]!.box;
        expect(texts[0]!.x, '牌心 x').toBe(box.x + box.w / 2);
        expect(texts[0]!.y, '牌心 y').toBe(box.y + box.h - a.brandH / 2);
    });
});

describe('选关页大背景位图层序', () => {
    it('木牌压在 Graphics 之下；九宫格背板改走容器 UI 层 [2026-11-21 方向翻转，断言数不变 · K-115]', () => {
        expect(BELOW_GRAPHICS_TEXTURE_IDS.has(LEVEL_DETAIL_TEXTURES.plaque), '木牌不得压住九格底图/缩略').toBe(true);
        // `[2026-11-21]` 实帧证据：tray 压到**全局** `BlitAtlas` 时，被底页整屏不透明
        // `backdropFull`（`BlitLayerUI`）整片盖住 ⇒ 深棕背板完全不上屏。提到容器 UI 层才可见。
        expect(BELOW_GRAPHICS_TEXTURE_IDS.has(LEVEL_SELECT_TEXTURES.tray), '九宫格背板不得再压到全局 BlitAtlas').toBe(false);
        expect(BELOW_GRAPHICS_TEXTURE_IDS.has(LEVEL_SELECT_TEXTURES.cell), '单格模板若复用也应在矢量层之下').toBe(true);
        expect(BELOW_GRAPHICS_TEXTURE_IDS.has(LEVEL_SELECT_TEXTURES.brand), '编号牌是格内小件，仍应压在矢量层之上').toBe(false);
    });

    it('[2026-11-21] 背板在段前发、九格整体落段层 ⇒ 当前关程序化红心不被背板盖住', () => {
        // 容器子节点序 = Graphics → BlitLayerUI → Labels → Segments。背板提到 `BlitLayerUI` 后
        // 会盖住容器默认 Graphics 里的亮金内窗 / 红心；把九格改发到 `Segments` 下的段层，
        // 段层整棵（含自己的 Graphics）恒在父容器 BlitLayerUI 之上 ⇒ 两侧同时成立。
        const cmds = frame(() => true);
        const trayAt = cmds.findIndex((c) => c.kind === 'blit' && (c as { textureId?: string }).textureId === LEVEL_SELECT_TEXTURES.tray);
        const segAt = cmds.findIndex((c) => c.kind === 'segment');
        const segEndAt = cmds.findIndex((c) => c.kind === 'segmentEnd');
        const ringAt = cmds.findIndex((c) => c.kind === 'rect' && 'stroke' in c && c.stroke === '#FFF0B0' && c.lineWidth === 4);
        const brands = cmds.filter((c, i) => c.kind === 'blit'
            && (c as { textureId?: string }).textureId === LEVEL_SELECT_TEXTURES.brand
            && i > segAt && i < segEndAt);
        expect(trayAt, '背板必须发出').toBeGreaterThanOrEqual(0);
        expect(segAt, '九格须开段层，且背板在段之前发').toBeGreaterThan(trayAt);
        expect(segEndAt, '段须闭合').toBeGreaterThan(segAt);
        expect(ringAt, '当前关高亮环（Graphics）须落在段内').toBeGreaterThan(segAt);
        expect(ringAt, '当前关高亮环须在段闭合前').toBeLessThan(segEndAt);
        expect(brands.length, '九格编号牌位图须整体在段层').toBe(9);
    });

    it('[2026-11-21] normal 格底是格内容底，须与锁纹理同在 UI 层（K-115 方向翻转）', () => {
        // 实帧证据：cellNormal 入白名单压到 BlitAtlas（Graphics 之下）后被整片不透明 tray 盖住，
        // 9 格可见的只有深棕背板 ⇒ 浅木格底完全不上屏（K-109 层序死结：删冲突对象，不扩层标记）。
        expect(BELOW_GRAPHICS_TEXTURE_IDS.has(LEVEL_SELECT_TEXTURES.cellNormal), 'normal 底压到 Graphics 之下会被 tray 盖住').toBe(false);
        expect(BELOW_GRAPHICS_TEXTURE_IDS.has(LEVEL_SELECT_TEXTURES.lockImage), '锁是格内内容件，须在矢量层之上').toBe(false);
    });

    // `[WXG-T-1016]` 用户令「背板还是没有，格子里的高亮背板尺寸与 normal 态尺寸不一致，要同步」。
    // 裁定 = 全格统一木纹底：九格背板提到段外容器 UI 层各发一次，几何逐格 = cell.box；
    // 当前关只叠高亮环，⛔ 不再用 4/8px 内缩的亮金内窗表达高亮态（那是尺寸差的来源）。
    const pickBoxes = () => buttons.filter((b) => b.id === 'pick-level');
    const normalBacks = (cmds: readonly DrawCommand[]) => cmds.filter(
        (c) => c.kind === 'blit' && (c as { textureId?: string }).textureId === LEVEL_SELECT_TEXTURES.cellNormal,
    ) as readonly { x: number; y: number; w: number; h: number }[];

    it('[WXG-T-1016] 位图就绪臂：九格统一木纹底在段前各发一次，几何逐格 = cell.box', () => {
        const cmds = frame(() => true);
        const segAt = cmds.findIndex((c) => c.kind === 'segment');
        const backs = normalBacks(cmds.filter((c) => cmds.indexOf(c) < segAt));
        expect(backs, '九格背板各一条，⛔ 不按锁定态挑格').toHaveLength(9);
        for (let i = 0; i < 9; i += 1) {
            const box = pickBoxes()[i]!.box;
            expect(backs[i]!.x, `cell[${i}] 背板 x`).toBe(box.x);
            expect(backs[i]!.y, `cell[${i}] 背板 y（含按下位移）`).toBe(box.y);
            expect(backs[i]!.w, `cell[${i}] 背板 w`).toBe(box.w);
            expect(backs[i]!.h, `cell[${i}] 背板 h 与 normal 态同步（⛔ 不再 177）`).toBe(box.h);
        }
    });

    it('[WXG-T-1016] 锁定态同样九格：normal 底不再只给锁格 / 越界空槽', () => {
        expect(normalBacks(frame(() => true, { maxUnlockedLevel: 1 })), '当前关与已解锁格也铺木纹底').toHaveLength(9);
    });

    it('[WXG-T-1016] 尺寸同步：段内不再画 4/8px 内缩内窗，缺图臂仍各有一条同几何背板', () => {
        const cmds = frame(() => false);
        const segAt = cmds.findIndex((c) => c.kind === 'segment');
        const segEndAt = cmds.findIndex((c) => c.kind === 'segmentEnd');
        const box = pickBoxes()[0]!.box;
        expect(
            cmds.filter((c) => c.kind === 'rect' && (c.w === box.w - 4 || c.w === box.w - 8)),
            '⛔ 不再内缩 4/8px 造与 normal 态不同尺寸的高亮背板',
        ).toHaveLength(0);
        for (let i = 0; i < 9; i += 1) {
            const b = pickBoxes()[i]!.box;
            const hit = cmds.findIndex((c) => c.kind === 'rect'
                && c.x === b.x && c.y === b.y && c.w === b.w && c.h === b.h);
            expect(hit, `cell[${i}] 缺图仍有同几何程序化背板（K-108 不裸格）`).toBeGreaterThanOrEqual(0);
            expect(hit, `cell[${i}] 背板须在段内，否则被容器 BlitLayerUI 的 tray 盖住`).toBeGreaterThan(segAt);
            expect(hit, `cell[${i}] 背板须在段闭合前`).toBeLessThan(segEndAt);
        }
        expect(
            cmds.filter((c) => c.kind === 'rect' && 'stroke' in c && c.stroke === '#FFF0B0' && c.lineWidth === 4),
            '当前关只叠高亮环',
        ).toHaveLength(1);
    });
});

describe('[2026-11-20] 选关格图案放大居中 + 锁纹理下移', () => {
    const a = LEVEL_SELECT_GEO.cellArt;
    const grid = LEVEL_SELECT_GEO.grid;

    it('图案槽比 126×94 更大、水平居中、底缘下探进星带（允许星覆盖一点）', () => {
        expect(a.imageW).toBeGreaterThan(126);
        expect(a.imageH).toBeGreaterThan(94);
        expect(a.imageLeft).toBe((grid.cellW - a.imageW) / 2);
        const slotBottom = grid.cellH - a.imageTopDown - a.imageH;
        expect(slotBottom).toBeLessThan(a.starBandY + a.starH / 2);
        expect(slotBottom).toBeGreaterThan(0);
    });

    it('锁纹理等比不拉伸，且比图案槽靠下（锁格无三星）', () => {
        expect(a.lockDrop).toBeGreaterThan(0);
        const cmds = frame(() => true, { maxUnlockedLevel: 1 });
        const locks = cmds.filter(
            (c) => c.kind === 'blit' && (c as { textureId: string }).textureId === LEVEL_SELECT_TEXTURES.lockImage,
        ) as readonly { x: number; y: number; w: number; h: number }[];
        expect(locks).toHaveLength(8);
        const cell = buttons.filter((b) => b.id === 'pick-level')[1]!.box;
        const slotY = cell.y + (cell.h - a.imageTopDown - a.imageH);
        const lock = locks.find((l) => l.x >= cell.x && l.x < cell.x + cell.w)!;
        expect(lock).toBeTruthy();
        expect(lock.w / lock.h).toBeCloseTo(a.lockW / a.lockH, 5);
        expect(lock.y).toBe(slotY - a.lockDrop);
    });
});
