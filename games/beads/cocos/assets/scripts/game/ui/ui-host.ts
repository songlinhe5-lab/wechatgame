/**
 * UiHost — 宿主 ↔ UI 根的窄接口（ADR-0032 §6，UI-25）。
 *
 * 迁移期只暴露调试层需要的只读投影（L5：UI 根不读游戏对象，由宿主填）。
 * 意图回传（`applyPanelAction` / `usePowerup`）随 P3 Presenter 落地再加——
 * 现在没有执行者，先造动作联合会是空脚手架。
 */

/** 调试层三行数据的宿主投影；字段与 `drawPerfOverlay` 入参一一对应。 */
export interface UiDebugState {
    /** 统一调试开关（`settings.debugInfo`）。 */
    enabled: boolean;
    /** 帧耗时 EMA（ms）。 */
    frameMs: number;
    /** 相位，菜单腿为 `'menu'`。 */
    phase: string;
    /** 关卡标签，菜单腿为空。 */
    level: string;
    /** 附加行（pitch / LOD），菜单腿为空。 */
    detail: string;
}

export interface UiHost {
    /**
     * 每帧调用一次。实现方返回**同一个**预分配对象（热路径零分配），
     * UI 根只读不回写。
     */
    debugState(): UiDebugState;
}
