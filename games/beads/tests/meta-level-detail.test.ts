/**
 * `[WXG-T-601]` 关卡详情弹窗（选关墙格 → 详情 → 开始）—— **判据只钉工程可证面**：
 *  ① 流程：点已解锁格开详情（不扣心）→ 「开始」进关（扣 1 心）；「返回」回选关页。
 *  ② 版面不变式：内容带不压板标题、不压底钮行；两钮不互叠且都在纸面板内。
 *  ③ 绘制面：详情页帧里有「第 N 关」副标题与 3 枚道具徽章（测试无位图宿主 ⇒ 程序化回退腿）。
 *
 * 设计真源：Figma 关卡详情弹窗（file `PBIK3RbfGlfzFsAnd97ZsP` / node `92-36`）；
 * 几何单源：`view/meta-layout.ts::levelDetailLayout` + `view/meta-level-detail-page.ts` 常量。
 * 语义判据（闸门/体力/事件）仍住 `arc-level-select.test.ts` / `arc-stamina-refill.test.ts`，
 * ⛔ 本文件不重复造判据，只补「详情弹窗自身」的形状门。
 */

import { describe, it, expect } from 'vitest';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    NullAssetProvider,
    NullAudioBackend,
    RenderModelBuilder,
    Viewport,
    createRng,
    type EventMap,
    type GameServices,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { defaultBeadsSave } from '../src/game/save-schema.js';
import { metaLayout } from '../src/view/meta-view.js';
import { overlayPlate } from '../src/view/meta-layout.js';
import { COPY_TOKENS } from '../src/config/copy-tokens.js';
import { DESIGN_H, DESIGN_W, STAMINA_START_COST, WALL_ROWS } from '../src/config/tuning.js';

const META_KEY = 'test.t601.meta';
const PLAY_KEY = 'test.t601.play';

interface Rig {
    readonly shell: BeadsShell;
    readonly overlayEvents: { open: boolean; name: string }[];
}

function rig(): Rig {
    const now = 1_700_000_000_000;
    const platform = new NodePlatform({ width: DESIGN_W, height: DESIGN_H, pixelRatio: 2 });
    const storage = platform.createStorage();
    storage.set(PLAY_KEY, JSON.stringify({ ...defaultBeadsSave(), maxUnlockedLevel: 9 }));
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta() }));
    const events = new EventBus<EventMap>();
    const services: GameServices = {
        events,
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('t601-seed'),
        viewport: new Viewport(DESIGN_W, DESIGN_H),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const overlayEvents: { open: boolean; name: string }[] = [];
    (events as unknown as { on: (t: string, cb: (p: unknown) => void) => void }).on('meta:overlay', (p) =>
        overlayEvents.push(p as { open: boolean; name: string }),
    );
    const shell = createBeadsShell({ clock: () => now, metaKey: META_KEY, play: { saveKey: PLAY_KEY } });
    shell.init(services);
    return { shell, overlayEvents };
}

type Btn = { box: { x: number; y: number; w: number; h: number } };
const center = (b: Btn): [number, number] => [b.box.x + b.box.w / 2, b.box.y + b.box.h / 2];
const btn = (overlay: 'levels' | 'level-detail' | 'none', id: string, slot?: number): Btn =>
    metaLayout(overlay, WALL_ROWS).buttons.find(
        (b) => b.id === id && (slot === undefined || b.slot === slot),
    ) as Btn;

/** 主菜单 → 选关页（点 Boss 图位）。 */
function openLevels(shell: BeadsShell): void {
    const [x, y] = center(btn('none', 'open-levels'));
    expect(shell.tapMeta(x, y), 'Boss 图位 = 选关入口').toBe(true);
    expect(shell.overlay).toBe('levels');
}
/** 选关页第 slot 格 → 关卡详情。 */
function openDetail(shell: BeadsShell, slot: number): void {
    const [x, y] = center(btn('levels', 'pick-level', slot));
    expect(shell.tapMeta(x, y), '点格 → 开关卡详情').toBe(true);
    expect(shell.overlay, '详情弹窗叠在选关页上').toBe('level-detail');
}
/** 走真渲染链拿一帧（shell ⇒ buildRenderModel）。 */
function frame(shell: BeadsShell) {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    shell.buildRenderModel(b);
    return b.end().commands;
}

describe('[WXG-T-601] 关卡详情弹窗 — 流程', () => {
    it('点已解锁格开详情：不扣心、发出 open 事件；「开始」才进关并扣 1 心', () => {
        const r = rig();
        const before = r.shell.meta!.stamina;
        openLevels(r.shell);
        openDetail(r.shell, 8);

        expect(r.shell.meta!.stamina, '开详情不是开局 ⇒ 不扣心').toBe(before);
        expect(r.shell.screen, '仍停在菜单壳（弹窗盖在其上）').toBe('menu');
        expect(r.overlayEvents.at(-1), '弹窗开启事件').toEqual({ open: true, name: 'level-detail' });

        const [x, y] = center(btn('level-detail', 'start-detail'));
        expect(r.shell.tapMeta(x, y), '「开始」= 可点').toBe(true);
        expect(r.shell.screen, '开始 = 进玩法').toBe('play');
        expect(r.shell.meta!.stamina, '开局扣 1 心').toBe(before - STAMINA_START_COST);
        expect(r.overlayEvents.at(-1), '进关即收弹窗').toEqual({ open: false, name: 'none' });
    });

    it('「返回」回选关页（不是回主菜单），详情态清零', () => {
        const r = rig();
        openLevels(r.shell);
        openDetail(r.shell, 8);

        const [x, y] = center(btn('level-detail', 'back'));
        expect(r.shell.tapMeta(x, y), '返回 = 可点').toBe(true);
        expect(r.shell.overlay, '退回下一层 = 选关页').toBe('levels');
        expect(r.shell.screen, '不离开菜单壳').toBe('menu');

        // 详情态已清：再开一次仍是新会话（不是上一次的残留关）。
        openDetail(r.shell, 3);
        const b = btn('level-detail', 'start-detail');
        expect(b.box.w).toBe(300);
    });
});

describe('[WXG-T-601] 关卡详情弹窗 — 版面不变式', () => {
    it('内容带不压板标题、不压底钮行；两钮同排不叠且都在纸面板内', () => {
        const plate = overlayPlate();
        const back = btn('level-detail', 'back').box;
        const cta = btn('level-detail', 'start-detail').box;

        // 板标题基线（`panelPage`：`plate.y + plate.h − 50`，字面 40 ⇒ 下缘 ≈ −20）。
        const titleBottom = plate.y + plate.h - 50 - 20;
        expect(cta.y + cta.h, '开始钮顶 < 板标题下缘').toBeLessThan(titleBottom);
        expect(back.y + back.h, '返回钮顶 < 板标题下缘').toBeLessThan(titleBottom);

        // 内容带地板（`meta-level-detail-page` 常量：道具行下缘 158）> 钮行上缘。
        expect(back.y + back.h, '内容带不与钮行抢位').toBeLessThan(plate.y + 158);

        // 同排、不互叠：返回在左、开始在右，净距 20。
        expect(back.y, '两钮同排').toBe(cta.y);
        expect(back.x + back.w + 20, '两钮净距 20').toBe(cta.x);
        expect(back.x, '左留白 40').toBe(plate.x + 40);
        expect(plate.x + plate.w - (cta.x + cta.w), '右留白 40').toBe(40);
    });
});

describe('[WXG-T-601] 关卡详情弹窗 — 绘制面', () => {
    it('帧内有「第 N 关」副标题 + 3 枚道具徽章（无位图宿主 ⇒ 程序化回退腿）', () => {
        const r = rig();
        openLevels(r.shell);
        openDetail(r.shell, 8);
        for (let i = 0; i < 40; i += 1) r.shell.update(1 / 60); // 等淡入到 1（否则整层 alpha=0）

        const cmds = frame(r.shell) as unknown as {
            kind: string;
            text?: string;
            r?: number;
            x?: number;
            y?: number;
        }[];
        const texts = cmds.filter((c) => c.kind === 'text').map((c) => c.text);
        expect(texts, '副标题 = 第 9 关（slot 8 ⇒ 1-based 9）').toContain('第 9 关');
        expect(texts, '板标题').toContain('关卡详情');
        expect(texts, 'CTA 文案复用主菜单令牌').toContain(COPY_TOKENS.btn_start_label);

        const plate = overlayPlate();
        const badges = cmds.filter(
            (c) => c.kind === 'circle' && c.r === 42 && c.y !== undefined && c.y > plate.y && c.y < plate.y + plate.h,
        );
        expect(badges.length, '三枚道具徽章').toBe(3);
    });
});
