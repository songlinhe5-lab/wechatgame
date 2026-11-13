/**
 * `[WXG-T-937]` 菜单位图**可用性注入点**（自 `meta-widgets` 拆出，定义与查询同源）。
 *
 * 拆分理由：`settings-content` 需要 `menuBitmapReady` 来选木钮位图腿，而 `meta-widgets`
 * 又反向引用 `settings-content::settingsContentLabel` ⇒ 若查询留在 `meta-widgets`
 * 会形成 `settings-content → meta-widgets → settings-content` 运行时环（`check:arch` L6）。
 *
 * 对外 API 不变：`meta-widgets` / `meta-view` 继续 re-export `setMenuBitmapResolver` /
 * `menuBitmapReady`，宿主（harness / Cocos carrier）注入点逐字不变。
 * 缺省全 `false` ⇒ 全部腿走程序化回退（旧测试套件钉住该等价）。
 */
let _menuBitmapReady: (textureId: string) => boolean = () => false;

export function setMenuBitmapResolver(fn?: (textureId: string) => boolean): void {
    _menuBitmapReady = fn ?? (() => false);
}

/** 位图可用性查询（读取走本函数 ⇒ 注入点与消费点分居各文件时仍同源）。 */
export function menuBitmapReady(textureId: string): boolean {
    return _menuBitmapReady(textureId);
}
