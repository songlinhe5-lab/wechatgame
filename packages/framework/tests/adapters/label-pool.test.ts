/**
 * `[WXG-T-1118]` 池化 label 的 setter 脏门：帧间值不变 ⇒ 一次引擎调用都不发。
 *
 * 背景（真机分段读数）：覆层「文」段 9ms/帧，而 1117 条命令里逐帧不变的标签占多数
 * （LV / ★ / 标题 / 道具计数）；引擎每个 setter 都会把节点标脏（`color` / `string` /
 * `node.setPosition`），白烧重排与重绘。
 */
import { describe, expect, it } from 'vitest';
import { PooledLabelSource } from '../../src/adapters/cocos/label-pool.js';
import type { CocosLabelLike } from '../../src/adapters/cocos/cocos-renderer.js';

interface Log {
    readonly calls: string[];
}

/** 记录到「底层引擎」的每次调用（脏门没拦住才会出现在这里）。 */
function rig(): { source: PooledLabelSource; log: Log } {
    const calls: string[] = [];
    const source = new PooledLabelSource({
        // 不预建：预建件在构造期就走一次 reset（`visible:false`），会污染「底层调用」账。
        initial: 0,
        create: () => ({
            setText: (t: string) => void calls.push(`text:${t}`),
            setPosition: (x: number, y: number) => void calls.push(`pos:${x},${y}`),
            setFontSize: (s: number) => void calls.push(`size:${s}`),
            setColor: (c: { r: number; g: number; b: number; a: number }) =>
                void calls.push(`color:${c.r},${c.g},${c.b},${c.a}`),
            setAlign: (a: string) => void calls.push(`align:${a}`),
            setVisible: (v: boolean) => void calls.push(`visible:${v}`),
            setSiblingIndex: (i: number) => void calls.push(`sibling:${i}`),
            measureWidth: (t: string, s: number) => {
                calls.push(`measure:${t}@${s}`);
                return t.length * s;
            },
        }),
    });
    return { source, log: { calls } };
}

const COLOR = { r: 10, g: 20, b: 30, a: 255 };

describe('PooledLabelSource setter 脏门（WXG-T-1118）', () => {
    it('同一值重复写 ⇒ 只透传一次；值变 ⇒ 再透传', () => {
        const { source, log } = rig();
        const label = source.acquire();
        label.setText('LV 9/36');
        label.setText('LV 9/36');
        label.setFontSize(24);
        label.setFontSize(24);
        label.setColor(COLOR);
        label.setColor({ ...COLOR }); // 新对象同值：按通道比较，仍算「没变」
        label.setAlign('left');
        label.setAlign('left');
        label.setVisible(true);
        label.setVisible(true);
        label.setSiblingIndex!(3);
        label.setSiblingIndex!(3);
        label.setPosition(10, 20);
        label.setPosition(10, 20);

        // 注意 `setVisible` 的首次写入在 acquire 时不会被调；`initial: 1` 的 create 不写值。
        expect(log.calls).toEqual([
            'text:LV 9/36',
            'size:24',
            'color:10,20,30,255',
            'align:left',
            'visible:true',
            'sibling:3',
            'pos:10,20',
        ]);

        label.setText('LV 10/36');
        label.setPosition(11, 20);
        expect(log.calls.slice(-2)).toEqual(['text:LV 10/36', 'pos:11,20']);
    });

    it('池复用跨帧：回收后再借出，同值仍不发调用（缓存跟随节点）', () => {
        const { source, log } = rig();
        const first = source.acquire();
        first.setText('★ 21');
        first.setVisible(true);
        source.releaseAll(); // reset ⇒ setVisible(false) 透传一次
        const afterRelease = log.calls.length;
        expect(log.calls.at(-1)).toBe('visible:false');

        const again = source.acquire();
        expect(again).toBe(first); // 同一个池位（同一节点 + 同一份缓存）
        again.setText('★ 21'); // 与回收前同值：节点内容没变，照样拦
        again.setVisible(true);
        expect(log.calls.slice(afterRelease)).toEqual(['visible:true']);
    });

    it('首帧哨兵不吞内容：NaN / 空串初值下每个首次写入都透传', () => {
        const { source, log } = rig();
        const label = source.acquire();
        label.setText('');
        label.setAlign('center');
        label.setPosition(Number.NaN, 5); // NaN 永不相等 ⇒ 每次写都透传（不误拦）
        label.setPosition(Number.NaN, 5);
        expect(log.calls).toEqual(['text:', 'align:center', 'pos:NaN,5', 'pos:NaN,5']);
    });

    it('measureWidth 原样转发（不做脏门：宽度缓存归渲染器）', () => {
        const { source, log } = rig();
        const raw = source.acquire() as CocosLabelLike;
        expect(raw.measureWidth!('ABCD', 20)).toBe(80);
        expect(raw.measureWidth!('ABCD', 20)).toBe(80);
        expect(log.calls).toEqual(['measure:ABCD@20', 'measure:ABCD@20']);
    });
});
