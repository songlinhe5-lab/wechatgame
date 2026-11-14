/**
 * UI-60 · DEC-8① 容器 / 段命令流结构机检（`src/core/render/ui-container-order.ts`）
 * 正本 = `docs/architecture/adr/ADR-0033-ui-container-layer-ordering.md` DEC-8①。
 *
 * 正样本证明「相邻、各自闭合的容器块」通过（⇔ 「容器 A 全部命令索引 < 容器 B」）；
 * 负样本逐条咬合每种畸形（各断言一条具体违规串 ⇒ 改坏判定即转红，非空跑）。
 */
import { describe, expect, it } from 'vitest';
import type { DrawCommand } from '../../src/core/render/render-model.js';
import { checkUiContainerOrder } from '../../src/core/render/ui-container-order.js';

/**
 * 一帧「页面层 clip + 主菜单容器 + 设置弹窗容器（内含 modal 段与一次逐容器裁切）」
 * ——结构良构，应零违规。
 * `[ADR-0037]` 容器内 clip 已解禁（渲染器建裁切子树）；要求只剩「成对、不叠套」。
 */
const WELL_FORMED: DrawCommand[] = [
    { kind: 'clip', x: 0, y: 0, w: 750, h: 1334 },
    { kind: 'unclip' },
    { kind: 'container', id: 'menu' },
    { kind: 'containerEnd' },
    { kind: 'container', id: 'settings' },
    { kind: 'segment', segment: 'modal' },
    { kind: 'segmentEnd' },
    { kind: 'clip', x: 36, y: 218, w: 509, h: 744 },
    { kind: 'unclip' },
    { kind: 'containerEnd' },
];

describe('WXG-T-329 — checkUiContainerOrder（UI-60 DEC-8① 结构机检）', () => {
    it('相邻、各自闭合的容器块 + 段 ⇒ 零违规（容器 A 命令整体 < 容器 B）', () => {
        expect(checkUiContainerOrder(WELL_FORMED)).toEqual([]);
    });

    it('空命令流 ⇒ 零违规（未发容器命令 = 旧单层路径，不误报）', () => {
        expect(checkUiContainerOrder([])).toEqual([]);
    });

    it('反证 1：新容器在上一个未闭合时打开 ⇒ 判「重叠/嵌套」', () => {
        const errs = checkUiContainerOrder([
            { kind: 'container', id: 'menu' },
            { kind: 'container', id: 'settings' },
            { kind: 'containerEnd' },
            { kind: 'containerEnd' },
        ]);
        expect(errs.some((e) => e.includes('未闭合时打开'))).toBe(true);
    });

    it('反证 2：容器到帧尾未闭合 ⇒ 判「仍未闭合」', () => {
        const errs = checkUiContainerOrder([{ kind: 'container', id: 'menu' }]);
        expect(errs.some((e) => e.includes('到帧尾仍未闭合'))).toBe(true);
    });

    it('反证 3：段出现在任何容器之外 ⇒ 判「容器之外」', () => {
        const errs = checkUiContainerOrder([
            { kind: 'segment', segment: 'modal' },
            { kind: 'segmentEnd' },
        ]);
        expect(errs.some((e) => e.includes('任何容器之外'))).toBe(true);
    });

    it('反证 4：endContainer 无配对 ⇒ 判「无配对的 beginContainer」', () => {
        const errs = checkUiContainerOrder([{ kind: 'containerEnd' }]);
        expect(errs.some((e) => e.includes('无配对的 beginContainer'))).toBe(true);
    });

    it('反证 5：段未闭合时开新段 ⇒ 判「段不叠套」', () => {
        const errs = checkUiContainerOrder([
            { kind: 'container', id: 'settings' },
            { kind: 'segment', segment: 'modal' },
            { kind: 'segment', segment: 'toast' },
            { kind: 'segmentEnd' },
            { kind: 'containerEnd' },
        ]);
        expect(errs.some((e) => e.includes('段不叠套'))).toBe(true);
    });

    it('反证 6：容器在段未闭合时结束 ⇒ 判「段 ... 未闭合时结束」', () => {
        const errs = checkUiContainerOrder([
            { kind: 'container', id: 'settings' },
            { kind: 'segment', segment: 'modal' },
            { kind: 'containerEnd' },
        ]);
        expect(errs.some((e) => e.includes('未闭合时结束'))).toBe(true);
    });

    it('正样本：页面层 clip（容器外）成对 ⇒ 零违规', () => {
        expect(checkUiContainerOrder([
            { kind: 'clip', x: 0, y: 0, w: 750, h: 1334 },
            { kind: 'unclip' },
        ])).toEqual([]);
    });

    it('正样本：容器内 clip 成对（`[ADR-0037]` 逐容器裁切）⇒ 零违规', () => {
        expect(checkUiContainerOrder([
            { kind: 'container', id: 'settings' },
            { kind: 'clip', x: 36, y: 218, w: 509, h: 744 },
            { kind: 'unclip' },
            { kind: 'containerEnd' },
        ])).toEqual([]);
    });

    it('反证 7：clip 叠套 ⇒ 判「同一层一帧只许一次裁切」', () => {
        const errs = checkUiContainerOrder([
            { kind: 'container', id: 'settings' },
            { kind: 'clip', x: 0, y: 0, w: 750, h: 1334 },
            { kind: 'clip', x: 0, y: 0, w: 100, h: 100 },
            { kind: 'unclip' },
            { kind: 'unclip' },
            { kind: 'containerEnd' },
        ]);
        expect(errs.some((e) => e.includes('clip 叠套'))).toBe(true);
    });

    it('反证 8：unclip 无配对 / clip 到帧尾未闭合 ⇒ 各判一条', () => {
        const danglingUnclip = checkUiContainerOrder([{ kind: 'unclip' }]);
        expect(danglingUnclip.some((e) => e.includes('unclip 无配对的 clip'))).toBe(true);
        const unclosed = checkUiContainerOrder([{ kind: 'clip', x: 0, y: 0, w: 10, h: 10 }]);
        expect(unclosed.some((e) => e.includes('到帧尾仍未闭合'))).toBe(true);
    });
});
