/**
 * `[WXG-T-1119]` 性能归因开关（覆层展开态最下一排 chip）：位翻转 / 快照门 / 限帧副作用。
 *
 * 三件必须钉死的事：
 * ① 覆层关着 ⇒ 位不可翻、快照恒 0（release 路径零行为变化，不是「界面藏起来」而是真的不生效）；
 * ② chip 点击走**同一条命中几何**（`config/perf-panel.ts`），点中即吞掉 tap，⛔ 不再落到盘面；
 * ③ `DBG_CAP_30` 是唯一有副作用的位：开 ⇒ `setPreferredFps(30)`、关 ⇒ 60；关覆层回落 60
 *    （否则限帧会留在正式玩法里，玩家看到的是 30fps 的成品）。
 */
import { describe, expect, it } from 'vitest';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    NullAssetProvider,
    NullAudioBackend,
    Viewport,
    createRng,
    type GameServices,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell } from '../src/game/beads-shell.js';
import {
    DBG_CAP_30,
    DBG_CHIP_BITS,
    DBG_CHIP_LABELS,
    DBG_HIDE_BEADS,
    DBG_HIDE_BOARD,
    DBG_HIDE_HUD,
} from '../src/config/debug-flags.js';
import { dbgChipWidth, dbgChipX, dbgChipY } from '../src/config/perf-panel.js';
import type { UiDebugState } from '../src/ui/ui-host.js';

const STEP = 1 / 60;
const DESIGN_H = 1334;

const OUT: UiDebugState = {
    enabled: false,
    frameMs: 0,
    drawMs: 0,
    paintCalls: 0,
    commands: 0,
    tickMs: 0,
    engineDrawMs: 0,
    idleMs: 0,
    breakdown: { vectorMs: 0, blitMs: 0, textMs: 0, scopeMs: 0, vectorCalls: 0, blitCalls: 0, textCalls: 0 },
    phase: '',
    level: '',
    detail: '',
    expanded: false,
    debugFlags: 0,
};

function rig(): {
    play: ReturnType<typeof createBeadsShell>['play'];
    update: () => void;
    fps: number[];
} {
    let now = 1_000;
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const fps: number[] = [];
    const services: GameServices = {
        events: new EventBus(),
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage: platform.createStorage(),
        rng: createRng('debug-flags'),
        viewport: new Viewport(750, 1334),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
        setPreferredFps: (v) => { fps.push(v); },
    };
    const shell = createBeadsShell({
        clock: () => now,
        metaKey: 'wxgame.beads.test.debugflags.meta',
        play: { saveKey: 'wxgame.beads.test.debugflags.play' },
        initialScreen: 'play',
    });
    shell.init(services);
    return {
        play: shell.play,
        update: () => {
            shell.update(STEP);
            now += 16.7;
        },
        fps,
    };
}

/** chip `i` 的中心（设计坐标；与绘制/命中同一套几何）。 */
function chipCenter(i: number): { x: number; y: number } {
    const bits = DBG_CHIP_BITS.length;
    return {
        x: dbgChipX(i, bits) + dbgChipWidth(bits) / 2,
        y: dbgChipY(DESIGN_H, false, false) + 13,
    };
}

describe('`[WXG-T-1119]` 归因开关位', () => {
    it('四枚 chip 的位互不重叠、顺序 = 珠 / 盘 / HUD / 30', () => {
        expect(DBG_CHIP_LABELS).toEqual(['珠', '盘', 'HUD', '30']);
        expect(DBG_CHIP_BITS).toEqual([DBG_HIDE_BEADS, DBG_HIDE_BOARD, DBG_HIDE_HUD, DBG_CAP_30]);
        const or = DBG_CHIP_BITS.reduce((a, b) => a | b, 0);
        expect(or).toBe(0b1111);
    });

    it('覆层关：位不可翻、快照恒 0（release 路径零行为变化）', () => {
        const r = rig();
        r.update();
        expect(r.play.toggleDebugFlag(DBG_HIDE_BEADS)).toBe(false);
        r.update();
        expect(r.play.snapshot.debugFlags).toBe(0);
        // 面板也不吃 tap（覆层没开就没有控制面）。
        expect(r.play.tapDebugPanel(chipCenter(0).x, chipCenter(0).y)).toBe(false);
    });

    it('覆层开：翻位 ⇒ 快照 / 覆层投影同步；chip 点击走同一命中几何并吞掉 tap', () => {
        const r = rig();
        r.play.setDebugInfo(true);
        r.play.debugState(OUT); // 首帧投影（segmented / probed 门在此落定）
        // 展开面板（默认收起）。
        expect(r.play.tapDebugPanel(160, DESIGN_H - 23)).toBe(true);
        r.update();

        // 点「盘」chip ⇒ 只置 DBG_HIDE_BOARD，面板保持展开。
        const c1 = chipCenter(1);
        expect(r.play.tapDebugPanel(c1.x, c1.y)).toBe(true);
        r.update();
        expect(r.play.snapshot.debugFlags).toBe(DBG_HIDE_BOARD);
        const st = r.play.debugState(OUT);
        expect(st.expanded).toBe(true);
        expect(st.debugFlags).toBe(DBG_HIDE_BOARD);

        // 再点同一位 ⇒ 翻回 0（chip 是开关，不是单选）。
        expect(r.play.tapDebugPanel(c1.x, c1.y)).toBe(true);
        r.update();
        expect(r.play.snapshot.debugFlags).toBe(0);

        // 面板矩形内、chip 行之外的点击仍走展开/收起。
        expect(r.play.tapDebugPanel(160, DESIGN_H - 23)).toBe(true);
    });

    it('`DBG_CAP_30` 开 ⇒ setPreferredFps(30)，关 ⇒ 60', () => {
        const r = rig();
        r.play.setDebugInfo(true);
        expect(r.play.toggleDebugFlag(DBG_CAP_30)).toBe(true);
        expect(r.fps.at(-1)).toBe(30);
        expect(r.play.toggleDebugFlag(DBG_CAP_30)).toBe(true);
        expect(r.fps.at(-1)).toBe(60);
        r.update();
        expect(r.play.snapshot.debugFlags).toBe(0);
    });

    it('关覆层 ⇒ 位清零 + 帧率上限复位到 60（限帧不许留在正式玩法里）', () => {
        const r = rig();
        r.play.setDebugInfo(true);
        r.play.toggleDebugFlag(DBG_CAP_30);
        r.play.toggleDebugFlag(DBG_HIDE_HUD);
        r.update();
        expect(r.play.snapshot.debugFlags).toBe(DBG_CAP_30 | DBG_HIDE_HUD);

        r.play.setDebugInfo(false);
        expect(r.fps.at(-1)).toBe(60);
        r.update();
        expect(r.play.snapshot.debugFlags).toBe(0);
        expect(r.play.debugState(OUT).debugFlags).toBe(0);
    });
});
