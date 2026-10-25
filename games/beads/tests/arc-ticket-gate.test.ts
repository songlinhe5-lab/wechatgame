/**
 * WXG-T-345 · S-4：大关门票**闸门接入** + 只读告知件（ADR-0034 §6 S-4 行 / §6.1 M-12 / M-15 / M-16）。
 *
 * 判据源（逐字）：
 * - §3.7「解锁规则」v1.79：章内小关线性「过一开一」⛔ 不变；跳章受门票（前一章全通关 ∧ 累计星 ≥ 门槛）。
 * - `meta-ui v0.5 §2.7`：两层分家——门票只在**跳章那一刻**作为闸门参与解锁位推进，
 *   ⛔ 运行期活锁；三态归约（≥1★）逐字不动。
 * - `arc-level-select-spec v1.11 §4.1（3-补）`：两枚只读字段只答「还差几星」与「还锁不锁」，
 *   已得/门槛恒指**阻断该页入口的上一章**；门槛=0 / 已达成 ⇒ 不创建（⛔ 0/0）；⛔ 新热区。
 *
 * 本文件只销 S-4 的行为面：闸门（章首唯一放行点）、棘轮（M-15）、两层不混用、
 * 章内线性不变（M-12）、M-16 静态臂。门票归约纯函数本体归 `arc-ticket.test.ts`（S-3）。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { defaultBeadsSave, SAVE_VERSION } from '../src/game/save-schema.js';
import { LEVELS, levelIdentityKeys } from '../src/config/levels.js';
import { ARCS } from '../src/config/arcs.js';
import { DESIGN_H, DESIGN_W, PANEL_IN_MS, WALL_ROWS } from '../src/config/tuning.js';
import { metaLayout, type MetaViewData } from '../src/view/meta-view.js';
import { starsLedger } from './helpers.js';

const PLAY_KEY = 'test.arc-ticket-gate.play';
const META_KEY = 'test.arc-ticket-gate.meta';
const REPO = resolve(__dirname, '../../..');
const KEYS = levelIdentityKeys(LEVELS);
/** 章 2 首关（0-based）——本版清单 = 1–9 / 10–10（`arcs.ts` 生成物）。 */
const CH2_FIRST = ARCS[1]!.levelRefs[0]![0] - 1;

interface Rig {
    readonly shell: BeadsShell;
    readonly storage: ReturnType<NodePlatform['createStorage']>;
    readonly overlayEvents: { open: boolean; name: string }[];
    readonly now: { t: number };
}

/**
 * `pointer` / `stars` 都按**关号（1-based）**给，夹具内一次换算成身份键（K-152：
 * ⛔ 手抄 token；本文件不出现任何 `L000NN` 字面）。
 */
function rig(opts: { pointer?: number; stars?: readonly number[] } = {}): Rig {
    const now = { t: 1_000 };
    const platform = new NodePlatform({ width: DESIGN_W, height: DESIGN_H, pixelRatio: 2 });
    const storage = platform.createStorage();
    const pointer = opts.pointer ?? 1;
    storage.set(
        PLAY_KEY,
        JSON.stringify({
            ...defaultBeadsSave(),
            runs: 1,
            maxUnlockedKey: KEYS[pointer - 1] ?? '',
            lastPlayedKey: KEYS[pointer - 1] ?? '',
            ...(opts.stars !== undefined ? { starsByUid: starsLedger(opts.stars) } : {}),
        }),
    );
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), staminaCur: 99 }));
    const events = new EventBus<EventMap>();
    const overlayEvents: { open: boolean; name: string }[] = [];
    (events as unknown as { on: (t: string, cb: (p: unknown) => void) => void }).on('meta:overlay', (p) =>
        overlayEvents.push(p as { open: boolean; name: string }),
    );
    const input = new InputManager();
    const services: GameServices = {
        events,
        input,
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('wxg-t-345-s4'),
        viewport: new Viewport(DESIGN_W, DESIGN_H),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({ clock: () => now.t, metaKey: META_KEY, play: { saveKey: PLAY_KEY } });
    shell.init(services);
    return { shell, storage, overlayEvents, now };
}

/** 只读字段的唯一读取面：shell 塞给 `buildMetaView` 的同一对象（L5：视图只渲染、不推导）。 */
function viewData(shell: BeadsShell): MetaViewData {
    return (shell as unknown as { _viewData: MetaViewData })._viewData;
}

/** 跑一帧绘制：`carousel*` 等只在 `_metaViewData` 里覆写的字段靠这一下就位。 */
function draw(shell: BeadsShell): void {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    shell.buildRenderModel(builder);
    builder.end();
}

const centerOf = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

function cardBox(shell: BeadsShell) {
    return metaLayout('none', WALL_ROWS, shell.menuAnchors).buttons.find((b) => b.id === 'open-levels')!;
}

/** 菜单 ► 卡片 → 打开当前走马灯页的选关页，并推进到转场静息（断言读终态）。 */
function openLevels(shell: BeadsShell, rigRef: Rig): void {
    const c = centerOf(cardBox(shell).box);
    expect(shell.tapMeta(c.x, c.y), 'R14：点橱窗图仍能进该章列表（⛔ 新增拦截）').toBe(true);
    expect(shell.overlay).toBe('levels');
    const steps = Math.ceil(PANEL_IN_MS / 1000 / (1 / 60)) + 1;
    for (let i = 0; i < steps; i += 1) shell.update(1 / 60);
    rigRef.now.t += 500;
    draw(shell); // `chapterTitle` 等由 `_metaViewData` 每帧覆写 ⇒ 读值前先跑一帧
}

/** 翻到第 `page` 页（逐次点 ◀▶，动画推完）。 */
function goPage(r: Rig, page: number): void {
    for (let i = 0; i < page; i += 1) {
        const next = metaLayout('none', WALL_ROWS, r.shell.menuAnchors).buttons.find((b) => b.id === 'carousel-next')!;
        const c = centerOf(next.box);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        r.now.t += 500;
        r.shell.update(0.016);
        r.now.t += 500;
        r.shell.update(0.016);
    }
}

function wallCell(slot: number) {
    return metaLayout('levels', WALL_ROWS).buttons.filter((b) => b.id === 'pick-level')[slot]!;
}

function clickCell(r: Rig, slot: number): boolean {
    const c = centerOf(wallCell(slot).box);
    return r.shell.tapMeta(c.x, c.y);
}

function savedDoc(r: Rig): Record<string, unknown> {
    return JSON.parse(String(r.storage.get(PLAY_KEY))) as Record<string, unknown>;
}

/* ═════════════ ① 门票未达：章 2 页只读件 + 零事件/零扣心/不消费 ═════════════ */

describe('S-4 闸门：门票未达', () => {
    it('章 2 页：arcTicketOpen=false、累计星 = 上一章 20/24；点章首格零事件 / 零扣心 / 不消费', () => {
        // 前 9 关全通关但只得 20★（门槛 24★）⇒ 门票不成立。
        const r = rig({ pointer: 9, stars: [3, 3, 2, 2, 2, 2, 2, 2, 2, 0] });
        goPage(r, 1);
        openLevels(r.shell, r);
        const data = viewData(r.shell);
        expect(data.chapterTitle, '确在章 2 页').toBe(ARCS[1]!.title);
        expect(data.arcTicketOpen, '门票归约为假 ⇒ 章锁').toBe(false);
        expect([data.arcStarGot, data.arcStarNeed], 'C 拍定：已得/门槛取阻断该页入口的上一章').toEqual([20, 24]);

        const before = { stamina: r.shell.meta!.stamina, idx: r.shell.play.levelIndex, events: r.overlayEvents.length };
        expect(clickCell(r, 0), '章未开 ⇒ 不消费（零热区零事件的机械面）').toBe(false);
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.overlay).toBe('levels');
        expect(r.shell.meta!.stamina, '零扣心').toBe(before.stamina);
        expect(r.shell.play.levelIndex, '不推进关指针').toBe(before.idx);
        expect(r.overlayEvents.length, '零事件').toBe(before.events);
    });

    it('走马灯翻到章 2 页（未开选关）⇒ 木牌进度件数据已就位；翻回首章 ⇒ 清空（WXG-T-346 取证补漏）', () => {
        const r = rig({ pointer: 9, stars: [3, 3, 2, 2, 2, 2, 2, 2, 2, 0] });
        goPage(r, 1);
        const onPage = viewData(r.shell);
        expect([onPage.arcStarGot, onPage.arcStarNeed], '页位落定即算，⛔ 等开选关页').toEqual([20, 24]);
        const prev = metaLayout('none', WALL_ROWS, r.shell.menuAnchors).buttons.find((b) => b.id === 'carousel-prev')!;
        const c = centerOf(prev.box);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        r.now.t += 500;
        r.shell.update(0.016);
        r.now.t += 500;
        r.shell.update(0.016);
        expect(viewData(r.shell).arcStarNeed, '首章无阻断 ⇒ 不创建（⛔ 残留上一页数字）').toBeUndefined();
    });

    it('首章无阻断：arcTicketOpen=true 且进度件不创建（⛔ 0/0），章内格照旧线性', () => {
        const r = rig({ pointer: 2, stars: [] });
        openLevels(r.shell, r);
        const data = viewData(r.shell);
        expect(data.chapterTitle).toBe(ARCS[0]!.title);
        expect(data.arcTicketOpen, '首章无前置 ⇒ 放行').toBe(true);
        expect(data.arcStarGot, '门槛=0 ⇒ 不创建进度件（⛔ 0/0）').toBeUndefined();
        expect(data.arcStarNeed).toBeUndefined();
    });
});

/* ═════════════ ② 门票达成 + 指针停在章末：章首格唯一放行点 ═════════════ */

describe('S-4 闸门：门票达成 ⇒ 章首授权', () => {
    it('点章首格 ⇒ 进关 + 推既有两根指针（maxUnlockedKey / lastPlayedKey），不新增布尔', () => {
        const r = rig({ pointer: 9, stars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 0] });
        goPage(r, 1);
        openLevels(r.shell, r);
        const data = viewData(r.shell);
        expect(data.arcTicketOpen, '门票达成 ⇒ 章开').toBe(true);
        expect(data.arcStarGot, '已达成 ⇒ 不创建进度件（⛔ 0/0）').toBeUndefined();
        expect(data.arcStarNeed).toBeUndefined();

        const staminaBefore = r.shell.meta!.stamina;
        expect(clickCell(r, 0), '章首格放行').toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.levelIndex).toBe(CH2_FIRST);
        expect(r.shell.play.maxUnlockedLevel, '解锁位推进到章首').toBe(CH2_FIRST + 1);
        expect(r.shell.meta!.stamina, '正常扣 1 心').toBe(staminaBefore - 1);

        const doc = savedDoc(r);
        expect(doc['maxUnlockedKey'], '推进位 = 身份 token（S-2b 的两根指针）').toBe(KEYS[CH2_FIRST]);
        expect(doc['lastPlayedKey']).toBe(KEYS[CH2_FIRST]);
        expect(doc['maxUnlockedLevel'], '⛔ 双轨并存').toBeUndefined();
        expect(doc['currentLevel']).toBeUndefined();
        expect(doc['version'], 'DEC-7 补条①：留 5').toBe(SAVE_VERSION);
    });

    it('不是章首的线性未开格 ⇒ ⛔ 用门票越权放行', () => {
        // 章 2 只有 1 关（本版），此臂取章 1：pointer=1 ⇒ 槽 1 线性未开；首章门票恒真。
        const r = rig({ pointer: 1, stars: [] });
        openLevels(r.shell, r);
        expect(clickCell(r, 1), '门票只授予章首，不授予「下一个」').toBe(false);
        expect(r.shell.screen).toBe('menu');
    });
});

/* ═════════════ ③ M-15 棘轮：已得入口不因内容变更回收 ═════════════ */

describe('M-15 棘轮（I7 / §8-20）', () => {
    it('已进章 2 + 章 1 实时门票转假 ⇒ 章首格仍可进（门票只在跳章那一刻参与）', () => {
        // 夹具语义 =「推平并已进下一章后，那一章被追加一关（0 星）」的等价后态：
        // 章 1 不再是全 3★（8×3★ + 1×2★），而两根指针已在章 2（pointer = 10）。
        const r = rig({ pointer: 10, stars: [3, 3, 3, 3, 3, 3, 3, 3, 2, 3] });
        goPage(r, 1);
        openLevels(r.shell, r);
        expect(viewData(r.shell).arcTicketOpen, '显示层：入口已得 ⇒ 章开（由既有推进位判定）').toBe(true);
        const before = r.shell.meta!.stamina;
        expect(clickCell(r, 0), '已得入口不回收').toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.levelIndex).toBe(CH2_FIRST);
        expect(r.shell.meta!.stamina).toBe(before - 1);
    });
});

/* ═════════════ ④ M-12 章内线性不变（「过一开一」） ═════════════ */

describe('M-12 章内线性解锁不变', () => {
    it('pointer=3 ⇒ 章 1 第 2/3 关可进、第 4 关仍拦（门票⛔ 混进章内判定）', () => {
        const r1 = rig({ pointer: 3, stars: [] });
        openLevels(r1.shell, r1);
        expect(clickCell(r1, 1), '第 2 关（0-based 1）线性已开 ⇒ 可进').toBe(true);
        expect(r1.shell.screen).toBe('play');
        expect(r1.shell.play.levelIndex).toBe(1);

        const r2 = rig({ pointer: 3, stars: [] });
        openLevels(r2.shell, r2);
        const stamina = r2.shell.meta!.stamina;
        expect(clickCell(r2, 2), '第 3 关线性已开 ⇒ 可进').toBe(true);
        expect(r2.shell.play.levelIndex).toBe(2);

        const r3 = rig({ pointer: 3, stars: [] });
        openLevels(r3.shell, r3);
        const events = r3.overlayEvents.length;
        expect(clickCell(r3, 3), '第 4 关线性未开 ⇒ 仍拦').toBe(false);
        expect(r3.shell.meta!.stamina).toBe(stamina);
        expect(r3.overlayEvents.length).toBe(events);
    });
});

/* ═════════════ ⑤ 两层不混用（§8-10 / meta-ui §2.7） ═════════════ */

describe('两层不混用：显示层三态 ≠ 推进层门票', () => {
    it('章 1 全通关但累计星不足：carouselState=cleared 而同源门票为假（M-11 的壳层镜像）', () => {
        // 全通关（≥1★）但只得 20★ < 24★ ⇒ 显示层 cleared、推进层票不开。
        const r = rig({ pointer: 9, stars: [3, 3, 2, 2, 2, 2, 2, 2, 2, 0] });
        draw(r.shell);
        expect(viewData(r.shell).carouselState, '≥1★ 三态口径一字不动').toBe('cleared');
        // 同一份星账的推进层面：票不开、累计星 = 20/24（两层各算各的，⛔ 互相改造）。
        goPage(r, 1);
        openLevels(r.shell, r);
        expect(viewData(r.shell).arcTicketOpen, '同源门票归约为假').toBe(false);
        expect([viewData(r.shell).arcStarGot, viewData(r.shell).arcStarNeed]).toEqual([20, 24]);
    });
});

/* ═════════════ ⑥ M-16 静态臂（S-4 接线完成后仍须成立） ═════════════ */

describe('M-16 静态臂：门票归约输入里没有章 id', () => {
    it('归约调用点 = (展平星账, 上一章槽位) 两参；闸门函数体无章 id / 字面章节名', () => {
        const src = readFileSync(resolve(REPO, 'games/beads/src/game/beads-shell.ts'), 'utf8');
        // 截「闸门三函数」本体：_refreshArcGate / _arcTicketSatisfied / _canAdvanceAcrossArc。
        const start = src.indexOf('private _refreshArcGate(');
        expect(start, 'S-4 闸门函数已落地').toBeGreaterThan(0);
        const end = src.indexOf('private _metaViewData(', start);
        expect(end).toBeGreaterThan(start);
        const body = src.slice(start, end);
        expect(body).toContain('arcEntryTicket(this.play.starsByLevelRaw');
        // 章 id（`ArcEntry.id` / `arcId` / 字面 id）⛔ 进归约；章节清单只经 levelRefs 展开。
        expect(/arcId|chapterId|\barc\.id\b|\.id\s*===|mandala|photo32/.test(body), '⛔ 章 id 进门票').toBe(false);
    });

    it('行为随臂：只改章 id（levelRefs / 存档不动）⇒ 门票与累计星进度不变', () => {
        // 前 9 关全通关但只得 20★ ⇒ 门票未达，进度件有值可观测。
        const r = rig({ pointer: 9, stars: [3, 3, 2, 2, 2, 2, 2, 2, 2, 0] });
        goPage(r, 1);
        openLevels(r.shell, r);
        const before = viewData(r.shell);
        const baseline: readonly unknown[] = [before.arcTicketOpen, before.arcStarGot, before.arcStarNeed];
        expect(baseline, '夹具基线：章 2 门票假 + 上一章 20/24').toEqual([false, 20, 24]);
        // "只改章 id"：就地重命名当前页的章条目，存档 / levelRefs 一字不动；跑完还原。
        const entry = ARCS[1] as unknown as { id: string };
        const originalId = entry.id;
        try {
            entry.id = 'renamed-by-m16';
            const gate = r.shell as unknown as { _phase: { levelsArc: number }; _refreshArcGate(arc: number): void };
            gate._refreshArcGate(gate._phase.levelsArc);
            const after = viewData(r.shell);
            expect(
                [after.arcTicketOpen, after.arcStarGot, after.arcStarNeed],
                '§8-18 / M-16：章 id ⛔ 参与门票归约',
            ).toEqual(baseline);
        } finally {
            entry.id = originalId;
        }
    });
});
