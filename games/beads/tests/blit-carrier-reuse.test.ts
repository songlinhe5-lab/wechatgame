/**
 * WXG-T-1112 · blit 载体差分复用与热路径短路的**静态判据**。
 *
 * host 文件顶层 `import 'cc'`，Node 下不可导入（同 `blitdbg-switch.test.ts` 口径）⇒
 * 只能用源码门锁定改造形态。动机 = 真机分段读数 `位 10 ms` 为四段最大：旧实现
 * `beginFrame` 整池 `active=false` + `_borrow` 逐个 `=true` ⇒ 每渲染帧每珠 2 次完整
 * onEnable/onDisable 周期；稳态（拖动期 blit 数恒定）应零翻转。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'cocos/assets/scripts/host/beads-blit-carrier.ts',
);

describe('WXG-T-1112 载体差分复用（静态门）', () => {
    const src = readFileSync(HOST, 'utf8');

    it('beginFrame 不再整池翻转：active=false 只允许出现在 endFrame 里', () => {
        const begin = src.slice(src.indexOf('beginFrame(): void'), src.indexOf('endFrame(): void'));
        expect(begin).not.toContain('node.active = false');
        // 尾段收尾契约：endFrame 存在且只关 [本帧, 上帧) 区间
        const end = src.slice(src.indexOf('endFrame(): void'));
        expect(end).toMatch(/for \(let i = this\._used; i < this\._usedPrev; i\+\+\)/);
        expect(end).toMatch(/if \(node\.active\) node\.active = false;/);
        // beginFrame 记录上帧量（差分基准）
        expect(begin).toContain('this._usedPrev = this._used;');
    });

    it('accept 热路径零 getComponent：组件引用改吃池位档案', () => {
        expect(src).toContain('private readonly _poolUiT: UITransform[] = [];');
        expect(src).toContain('private readonly _poolUiO: UIOpacity[] = [];');
        expect(src).toContain('const uiT = this._poolUiT[this._used - 1]!;');
        expect(src).toContain('const uiO = this._poolUiO[this._used - 1]!;');
        expect(src).not.toContain('getComponent(UITransform)!.setContentSize');
        expect(src).not.toContain('getComponent(UIOpacity)');
    });

    it('引擎无短路的写法必须本地加守卫：setPosition 与 getChildByName', () => {
        // 引擎 3.8.8 `Node.setPosition` 每次必走 invalidateChildren ⇒ 本地比较
        expect(src).toContain('if (lp.x !== px || lp.y !== py || lp.z !== 0) sp.node.setPosition(px, py, 0);');
        // 图集容器节点缓存，⛔ 每条 blit 一次 getChildByName
        expect(src).toContain('private _atlasNodeRef: Node | null = null;');
        expect(src).toContain('if (this._atlasNodeRef && this._atlasNodeRef.isValid) return this._atlasNodeRef;');
        // setSiblingIndex 前置 O(1) 比较，省掉引擎内部每次必跑的 indexOf
        expect(src).toContain('if (sp.node.getSiblingIndex() !== sib) sp.node.setSiblingIndex(sib);');
    });

    it('真机底 tile 压珠面：tile blit 走独立底层节点，⛔ 逐帧钉兄弟位（WXG-T-1122）', () => {
        expect(src).toContain('MASK_TILE_SUFFIX');
        expect(src).toContain('private _tileNodeRef: Node | null = null;');
        expect(src).toMatch(/const tileBlit = base !== undefined && cmd\.textureId\.endsWith\(MASK_TILE_SUFFIX\)/);
        // 逐帧 setSiblingIndex(0) 会让几百块 tile 触发父节点兄弟数组重排（真机 位 65ms）。
        expect(src).not.toMatch(/endsWith\(MASK_TILE_SUFFIX\)[\s\S]{0,260}setSiblingIndex\(0\)/);
    });

    it('setContentSize 必须按池位做等值门，⛔ 每条 blit 无条件写', () => {
        expect(src).toContain('private readonly _poolSizeW: number[] = [];');
        expect(src).toContain('private readonly _poolSizeH: number[] = [];');
        expect(src).toMatch(/this\._poolSizeW\.push\(0\)/);
        expect(src).toMatch(
            /if \(this\._poolSizeW\[slot\] !== drawW \|\| this\._poolSizeH\[slot\] !== drawH\) \{[\s\S]{0,160}?uiT\.setContentSize\(drawW, drawH\);[\s\S]{0,120}?this\._poolSizeW\[slot\] = drawW;/,
        );
        expect(src).not.toMatch(/^        uiT\.setContentSize\(drawW, drawH\);$/m);
    });

    it('_cell 命中不得拼字符串键：嵌套 Map + 容量上限口径不变', () => {
        expect(src).not.toContain('const key = `${maskId}|${base}`;');
        expect(src).toContain('private readonly _cells = new Map<string, Map<string, SpriteFrame>>();');
        expect(src).toContain('private _cellCount = 0;');
        expect(src).toContain('let byBase = this._cells.get(maskId);');
        expect(src).toContain('const hit = byBase?.get(base);');
        expect(src).toContain('if (this._cellCount >= ATLAS_COLS * ATLAS_ROWS)');
        expect(src).toContain('const idx = this._cellCount;');
        expect(src).toContain('this._cellCount++;');
        expect(src).toContain('cache.get(maskId, base)');
    });
});
