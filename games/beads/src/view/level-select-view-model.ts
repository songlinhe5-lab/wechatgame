/**
 * `[WXG-T-607]` 选关弹窗 **ViewModel**（`ui-architecture-beads §5`）。
 *
 * 契约：只含展示所需字段；View 侧类型 `readonly`；⛔ 不含可被 View 回写的权威状态，
 * ⛔ View 不 import `MetaViewData` / shell / 任何游戏对象。选关页属**持续型**
 * （每帧可能变）⇒ 宿主把数据写进**同一个预分配对象**，热路径零分配。
 *
 * 投影边界：本文件把 `MetaViewData`（全局只读投影）收窄成该页专属 VM；
 * 布局 / 命中同源的 `MetaButton.box` 直接引用（不复制坐标）。
 */
import type { BeadsLevelRaw } from '../config/levels-data.js';
import { COPY_TOKENS } from '../config/copy-tokens.js';
import { DEFAULT_BEAD_STYLE_ID } from '../config/bead-styles/registry.js';
import { BEAD_SIZE_DEFAULT, type BeadSizeKind } from '../config/tuning.js';
import type { Box, MetaButton, MetaViewData } from './meta-types.js';
import { levelDetailPlate } from './meta-layout.js';
import { pressOffset } from './ui-theme.js';

/** 单格展示数据（9 个预分配对象，逐帧覆写）。 */
export interface LevelSelectCellViewModel {
    readonly slot: number;
    /** 绘制与命中共用的框（引用 `levelsLayout` 缓存里的 `MetaButton.box`）。 */
    readonly box: Box;
    readonly levelIdx: number | undefined;
    readonly level: BeadsLevelRaw | undefined;
    readonly locked: boolean;
    readonly stars: number;
    readonly current: boolean;
    readonly pressed: boolean;
    /** 按下态 y 位移（投影时按 `reduceMotion` 算好，View 不再读全局设置）。 */
    readonly pressDy: number;
}

/** 整页展示数据。 */
export interface LevelSelectViewModel {
    /** 复用的关卡详情木牌框（含逐机 `dialogShiftY()` 位移）。 */
    readonly plate: Box;
    readonly title: string;
    readonly chapter: string;
    readonly starProgress: string;
    /** 预分配 9 个格对象，但只画 `cellCount` 个（逐机行数档，⛔ 不把陈旧格画出来）。 */
    readonly cellCount: number;
    readonly cells: readonly LevelSelectCellViewModel[];
    readonly closePressed: boolean;
    readonly screenH: number;
    readonly largeText: boolean;
    readonly thumbN: number;
    /**
     * `[WXG-T-621]` 当前应用的珠体风格（玩家设置档）⇒ 缩略珠面与盘面同肤。
     * 由 `updateLevelSelectViewModel` 从 `MetaViewData.beadStyle` 投影（每帧只读引用）。
     */
    readonly beadStyle: string;
    /** `[WXG-T-910]` 豆径档同投影（缩略珠面与盘面同参：小豆档无孔）。 */
    readonly beadSize: BeadSizeKind;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** 预分配一张 VM（模块级一次；⛔ 每帧不得新建）。 */
export function createLevelSelectViewModel(): Mutable<LevelSelectViewModel> {
    const cells: Mutable<LevelSelectCellViewModel>[] = [];
    for (let i = 0; i < 9; i += 1) {
        cells.push({
            slot: i, box: { x: 0, y: 0, w: 0, h: 0 }, levelIdx: undefined,
            level: undefined, locked: true, stars: 0, current: false, pressed: false, pressDy: 0,
        });
    }
    return {
        plate: { x: 0, y: 0, w: 0, h: 0 }, title: '', chapter: '', starProgress: '',
        cellCount: 0, cells, closePressed: false, screenH: 0, largeText: false, thumbN: 0,
        beadStyle: DEFAULT_BEAD_STYLE_ID,
        beadSize: BEAD_SIZE_DEFAULT,
    };
}

/**
 * 每帧把 `MetaViewData` 投影进**同一张** VM。零数组分配（只遍历缓存的按钮表）。
 * `buttons` 来自 `metaLayout('levels', rows)`（绘制与命中同源）。
 */
export function updateLevelSelectViewModel(
    vm: Mutable<LevelSelectViewModel>,
    data: MetaViewData,
    buttons: readonly MetaButton[],
    screenH: number,
    thumbN: number,
): void {
    vm.plate = levelDetailPlate();
    vm.title = COPY_TOKENS.btn_levels_label;
    vm.chapter = data.chapterTitle ?? '';
    vm.starProgress = data.arcStarNeed === undefined
        ? '' : `★ ${data.arcStarGot ?? 0}/${data.arcStarNeed}`;
    vm.closePressed = data.pressed?.id === 'close-levels';
    vm.screenH = screenH;
    vm.largeText = data.largeText;
    vm.thumbN = thumbN;
    vm.beadStyle = data.beadStyle;
    vm.beadSize = data.beadSize;

    let i = 0;
    for (const b of buttons) {
        if (b.id !== 'pick-level' || i >= vm.cells.length) continue;
        const c = vm.cells[i]! as Mutable<LevelSelectCellViewModel>;
        const slot = b.slot ?? i;
        const levelIdx: number | undefined = data.wallSlots[slot];
        const gateOpensFirst = slot === 0 && data.arcTicketOpen === true;
        c.slot = slot;
        c.box = b.box;
        c.levelIdx = levelIdx;
        c.level = levelIdx === undefined ? undefined : data.wallLevels[slot];
        c.locked = levelIdx === undefined
            || (levelIdx + 1 > data.maxUnlockedLevel && !gateOpensFirst);
        c.stars = levelIdx === undefined ? 0 : (data.starsByLevel[levelIdx] ?? 0);
        c.current = levelIdx !== undefined && levelIdx === data.currentLevelIndex;
        c.pressed = data.pressed === b;
        c.pressDy = pressOffset(c.pressed, data.reduceMotion);
        i += 1;
    }
    vm.cellCount = i;
}
