/**
 * `[WXG-T-614]` 倒计时结束弹窗 **ViewModel**（`ui-architecture-beads §5`）。
 *
 * 契约：只含展示所需字段；View 侧类型 `readonly`；⛔ 不含可被 View 回写的权威状态，
 * ⛔ View 不 import 快照 / shell / 任何游戏对象。本弹窗属**持续型**（`pressedButton` /
 * `watchingAd` / `failHint` 逐帧可变）⇒ 宿主把快照投影进**同一个预分配对象**，热路径零分配。
 *
 * 投影边界：布局 / 命中同源的 `PanelRect` **直接引用** `failPanelLayout()` 的缓存对象
 * （不复制坐标、不新建框）；文案一律取 `systems/fail-panel` 的常量与纯函数 ⇒ 与命中侧同源。
 */
import type { BeadsSnapshot } from '../game/state';
import {
    FAIL_PANEL_TITLE,
    failPanelHint,
    failPanelLabel,
    failPanelLayout,
    type FailPanelAction,
} from '../systems/fail-panel';
import type { PanelRect } from '../systems/pause-panel';
import { pressOffset } from './ui-theme';

/** 单枚钮的展示数据（2 个预分配槽，逐帧覆写）。 */
export interface TimeoutButtonViewModel {
    readonly id: FailPanelAction;
    /** 绘制与命中共用的框（引用 `failPanelLayout` 缓存，⛔ 不复制）。 */
    readonly rect: PanelRect;
    /** 主行文案（「继续本关」/「重试本关」）。 */
    readonly label: string;
    /** 副行文案（仅续时钮；`''` = 不画）。 */
    readonly hint: string;
    /** 广告在播 ⇒ 主钮禁用态（可点性消失双通道：面 `woodFaceDisabled` + 字 60%）。 */
    readonly disabled: boolean;
    /** 按下态 y 位移（投影时按 `reduceMotion` 算好，View 不再读全局设置）。 */
    readonly pressDy: number;
}

/** 整窗展示数据。 */
export interface TimeoutViewModel {
    /** 木牌框（含逐机 `dialogShiftY()` 位移；两档牌高不同）。 */
    readonly plate: PanelRect;
    readonly title: string;
    /** 仅重试档的说明行（`''` = 不画）。 */
    readonly subtitle: string;
    /** 一次性提示（广告不可用等；`''` = 不画）。 */
    readonly hint: string;
    readonly largeText: boolean;
    /** 预分配 2 槽，但只画 `buttonCount` 个（⛔ 不把陈旧槽画出来）。 */
    readonly buttonCount: number;
    readonly buttons: readonly TimeoutButtonViewModel[];
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** 空框占位（模块级一份；首帧投影前的槽位引用，⛔ 不每帧新建）。 */
const EMPTY_RECT: PanelRect = { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };

/** 预分配一张 VM（模块级一次；⛔ 每帧不得新建）。 */
export function createTimeoutViewModel(): Mutable<TimeoutViewModel> {
    const buttons: Mutable<TimeoutButtonViewModel>[] = [];
    for (let i = 0; i < 2; i += 1) {
        buttons.push({ id: 'retry', rect: EMPTY_RECT, label: '', hint: '', disabled: false, pressDy: 0 });
    }
    return {
        plate: EMPTY_RECT, title: '', subtitle: '', hint: '',
        largeText: false, buttonCount: 0, buttons,
    };
}

/**
 * 每帧把快照投影进**同一张** VM。零数组分配、零字符串分配
 * （文案全是模块级常量或同一引用；`pressOffset` 返回数）。
 */
export function updateTimeoutViewModel(vm: Mutable<TimeoutViewModel>, snap: BeadsSnapshot): void {
    const layout = failPanelLayout(snap.reviveAvailable);
    vm.plate = layout.panel;
    vm.title = FAIL_PANEL_TITLE;
    vm.subtitle = layout.subtitle;
    vm.hint = snap.failHint;
    vm.largeText = snap.largeText;
    vm.buttonCount = layout.buttons.length;
    for (let i = 0; i < layout.buttons.length; i += 1) {
        const b = layout.buttons[i]!;
        const slot = vm.buttons[i]! as Mutable<TimeoutButtonViewModel>;
        slot.id = b.id;
        slot.rect = b.rect;
        slot.label = failPanelLabel(b.id);
        slot.hint = b.id === 'revive' ? failPanelHint() : '';
        slot.disabled = b.id === 'revive' && snap.watchingAd;
        slot.pressDy = pressOffset(snap.pressedButton === b.id, snap.reduceMotion);
    }
}