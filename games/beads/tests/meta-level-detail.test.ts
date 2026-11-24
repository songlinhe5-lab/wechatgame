/**
 * `[WXG-T-601 / T-602]` 关卡详情弹窗（选关墙格 → 详情 → 开始）—— **判据只钉工程可证面**：
 *  ① 流程：点已解锁格开详情（不扣心）→ 「开始」进关（扣 1 心）；「返回」回选关页。
 *  ② 版面不变式：几何 = Figma `92:36` 原值（木牌 581×1044 @89 / 开始 326×154 @212 / 返回 È Ð80 同中线）；
 *     内容带不压板标题、不压开始钮。
 *  ③ 绘制面：无位图宿主 ⇒ 程序化回退腿（副标题 / 时限 / 文字星 / 三枚内缩徽章 / 返回圆）；
 *     注入位图宿主 ⇒ 木牌 / 开始 / 三枚星 / 返回木圆全部走 blit。
 *
 * 设计真源：Figma 关卡详情弹窗（file `PBIK3RbfGlfzFsAnd97ZsP` / node `92:36`）；
 * 几何单源：`config/tuning/level-detail.ts`（绘制与热区共读）。
 * 语义判据（闸门/体力/事件）仍住 `arc-level-select.test.ts` / `arc-stamina-refill.test.ts`，
 * ⛔ 本文件不重复造判据，只补「详情弹窗自身」的形状门。
 */

import { afterEach, describe, it, expect } from 'vitest';
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
import { hitTestMeta, metaLayout, setMenuBitmapResolver } from '../src/view/meta-view.js';
import { levelDetailPlate } from '../src/view/meta-layout.js';
import { COPY_TOKENS } from '../src/config/copy-tokens.js';
import { DESIGN_H, DESIGN_W, LEVEL_DETAIL_GEO, LEVEL_DETAIL_TEXTURES, LEVEL_DETAIL_TITLE_SHADOW, MENU_TEXTURES, POWERUP_ICON_SCALE, POWERUP_RESTORE_BASE_TILE, POWERUP_TILE_TEXTURES, STAMINA_START_COST, WALL_ROWS } from '../src/config/tuning.js';

const META_KEY = 'test.t602.meta';
const PLAY_KEY = 'test.t602.play';

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
        rng: createRng('t602-seed'),
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
    return b.end().commands as unknown as {
        kind: string;
        text?: string;
        r?: number;
        x?: number;
        y?: number;
        w?: number;
        h?: number;
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
        lineWidth?: number;
        textureId?: string;
        shadow?: { offsetX: number; offsetY: number; blur?: number };
    }[];
}

afterEach(() => setMenuBitmapResolver());

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

    it('右上 ✕ 关闭回选关页（不是回主菜单），详情态清零', () => {
        const r = rig();
        openLevels(r.shell);
        openDetail(r.shell, 8);

        const [x, y] = center(btn('level-detail', 'close-detail'));
        expect(r.shell.tapMeta(x, y), '✕ = 可点').toBe(true);
        expect(r.shell.overlay, '退回下一层 = 选关页').toBe('levels');
        expect(r.shell.screen, '不离开菜单壳').toBe('menu');

        // 详情态已清：再开一次仍是新会话（不是上一次的残留关）。
        openDetail(r.shell, 3);
        const b = btn('level-detail', 'start-detail');
        expect(b.box.w, '开始钮宽 = Figma 326').toBe(326);
    });

    it('点木牌外空白关闭；点木牌内空白不关', () => {
        const r = rig();
        openLevels(r.shell);
        openDetail(r.shell, 8);

        const plate = levelDetailPlate();
        // 牌内空白（左上角内侧，不在任何钮上）⇒ 不关。
        expect(r.shell.tapMeta(plate.x + 10, plate.y + plate.h - 10), '牌内空白 = 零命中').toBe(false);
        expect(r.shell.overlay, '仍停在详情').toBe('level-detail');

        // 牌外（左侧留白）⇒ 关。
        expect(r.shell.tapMeta(20, plate.y + plate.h / 2), '牌外空白 = 关闭').toBe(true);
        expect(r.shell.overlay, '关闭 = 回选关页').toBe('levels');
    });
});

describe('[WXG-T-602] 关卡详情弹窗 — 版面不变式（Figma 92:36 原值）', () => {
    it('木牌 / 开始 / 右上 ✕ 的绝对几何与稿面一致，点牌外可关、点牌内空白不关', () => {
        const plate = levelDetailPlate();
        expect(plate, '木牌 581×1044 @ x89 / y_up 124').toEqual({ x: 89, y: 124, w: 581, h: 1044 });

        const cta = btn('level-detail', 'start-detail').box;
        expect(cta, '开始 326×154 @ x212 / y_up 153').toEqual({ x: 212, y: 153, w: 326, h: 154 });

        const close = btn('level-detail', 'close-detail').box;
        expect(close.w, '刻槽热区 = TOUCH_MIN 88').toBe(88);
        expect(close.x + close.w / 2, '✕ 在牌右上（中心 622）').toBe(622);
        expect(close.y + close.h / 2, '✕ 中心 y_up = 1121').toBe(1121);
        expect(close.y, '✕ 不压开始钮').toBeGreaterThan(cta.y + cta.h);

        // 开始钮在牌内（含底缘留白 29）；✕ 刻槽同样落在牌面右上。
        expect(cta.x).toBeGreaterThanOrEqual(plate.x);
        expect(cta.x + cta.w).toBeLessThanOrEqual(plate.x + plate.w);
        expect(cta.y).toBeGreaterThanOrEqual(plate.y);

        // 点牌外 = 关闭（四条遮罩带）；点牌内空白 = 零命中。
        const dismiss = metaLayout('level-detail', WALL_ROWS).buttons.filter((b) => b.id === 'dismiss-detail');
        expect(dismiss.length, '牌外四条贴边带').toBe(4);
        expect(hitTestMeta('level-detail', 20, plate.y + plate.h / 2)?.id, '左边空白').toBe('dismiss-detail');
        expect(hitTestMeta('level-detail', 375, plate.y + plate.h - 20), '牌内空白').toBeNull();

        // 内容带：道具行下缘（牌内 214）高于开始钮顶；标题中线（牌内 932）低于牌顶。
        expect(plate.y + 214, '道具行与开始钮不抢位').toBeGreaterThan(cta.y + cta.h);
        expect(plate.y + 932, '板标题在牌内').toBeLessThan(plate.y + plate.h);

        // 稿面几何表自证：星行 / 道具行尺寸与净距（改稿只改 tuning 一处）。
        expect(LEVEL_DETAIL_GEO.stars.size).toBe(58);
        expect(LEVEL_DETAIL_GEO.stars.gap).toBe(9);
        expect(LEVEL_DETAIL_GEO.items.size).toBe(84);
        expect(LEVEL_DETAIL_GEO.items.gap).toBe(9);
    });
});

describe('[WXG-T-602] 关卡详情弹窗 — 绘制面', () => {
    it('回退腿：大关名·第 N 关 / 时限 / 文字星 / 三枚 r=42 道具 / 右上 ✕ 圆', () => {
        const r = rig();
        openLevels(r.shell);
        openDetail(r.shell, 8);
        for (let i = 0; i < 40; i += 1) r.shell.update(1 / 60); // 等淡入到 1（否则整层 alpha=0）

        const cmds = frame(r.shell);
        const texts = cmds.filter((c) => c.kind === 'text').map((c) => c.text ?? '');
        expect(texts, '副标题 = 大关名 + 关序').toContain('曼陀罗·第 9 关');
        expect(texts, '板标题').toContain('关卡详情');
        expect(texts, 'CTA 文案复用主菜单令牌').toContain(COPY_TOKENS.btn_start_label);
        expect(texts.some((t) => t.startsWith('时限：')), '时限行').toBe(true);
        expect(texts, '无星 ⇒ 空心文字档').toContain('☆☆☆');

        // 板标题投影（Figma 95:59 DROP_SHADOW +9,+7 blur3）：单条文字命令携带 shadow。
        const titles = cmds.filter((c) => c.kind === 'text' && c.text === '关卡详情');
        expect(titles.length, '标题 = 单条带 shadow 的命令').toBe(1);
        const titleShadow = titles[0]!.shadow;
        expect(titleShadow, '标题必须带投影').toBeDefined();
        expect(titleShadow!.offsetX, '投影 x 偏移 = 稿面 +9').toBe(LEVEL_DETAIL_TITLE_SHADOW.dx);
        expect(titleShadow!.offsetY, '投影 y 偏移 = 稿面 +7（y-up 取负）').toBe(-LEVEL_DETAIL_TITLE_SHADOW.dyDown);
        expect(titleShadow!.blur, '投影 blur = 稿面 3').toBe(LEVEL_DETAIL_TITLE_SHADOW.blur);

        const plate = levelDetailPlate();
        // `[WXG-T-1049]` 缺图臂同口径内缩：r = 84 ×(160/336)/2，⛔ 不再是满格 42（会把背景木框盖掉）。
        const badgeR = (LEVEL_DETAIL_GEO.items.size * POWERUP_ICON_SCALE) / 2;
        const badges = cmds.filter(
            (c) => c.kind === 'circle' && c.r === badgeR && c.y !== undefined && c.y > plate.y && c.y < plate.y + plate.h,
        );
        expect(badges.length, '三枚道具徽章（内缩到背景中央道具区）').toBe(3);
        // 关闭件：右上框带内嵌 38² 凹槽（框 + 底 + 米白 ✕ 嵌线），不是凸起底板。
        const inset = cmds.find((c) => c.kind === 'rect' && c.x === 603 && c.y === 1102 && c.w === 38 && c.h === 38);
        expect(inset, '38² 凹槽外框').toBeDefined();
        const inlay = cmds.filter((c) => c.kind === 'line' && c.lineWidth === 3 && c.x1 === 614 && c.x2 === 630);
        expect(inlay.length, '米白 ✕ 两笔').toBe(2);
        const under = cmds.filter((c) => c.kind === 'line' && c.lineWidth === 5 && c.x1 === 614 && c.x2 === 630);
        expect(under.length, '✕ 深色垫底两笔').toBe(2);
        expect(texts.includes('✕'), '✕ 走嵌线，不再是文字').toBe(false);
        expect(cmds.some((c) => c.kind === 'blit' && c.textureId === LEVEL_DETAIL_TEXTURES.plaque), '无位图 ⇒ 木牌不 blit').toBe(false);
    });

    it('位图腿：木牌 / 开始 / 三枚空心星全部走 blit（关闭件为程序化凹槽）', () => {
        setMenuBitmapResolver((id) => id.startsWith('bitmap__detail_') || id === MENU_TEXTURES.btnCircle);
        const r = rig();
        openLevels(r.shell);
        openDetail(r.shell, 3);
        for (let i = 0; i < 40; i += 1) r.shell.update(1 / 60);

        const cmds = frame(r.shell);
        const ids = cmds.filter((c) => c.kind === 'blit').map((c) => c.textureId);
        expect(ids, '木牌').toContain(LEVEL_DETAIL_TEXTURES.plaque);
        expect(ids, '开始钮').toContain(LEVEL_DETAIL_TEXTURES.start);
        expect(
            ids.filter((id) => id === LEVEL_DETAIL_TEXTURES.starEmpty).length,
            '零得星 ⇒ 三枚空心',
        ).toBe(3);
        expect(ids.includes(LEVEL_DETAIL_TEXTURES.starFilled), '零得星 ⇒ 无实心').toBe(false);
    });

    it('[WXG-T-1019] 道具行拆分共背景：位图臂 = 背景件 ×3 + 道具件 ×3 两段 blit', () => {
        // 用户裁定「拆分共背景（单源化）」：三件 336² tile 环带逐像素同源 ⇒ 背景件 + 三件
        // 160² 道具件；旧整图键 `bitmap__powerup_window_tile` 等退场（资产 −3 +4，净 −12.5 KB）。
        setMenuBitmapResolver((id) => id.startsWith('bitmap__detail_')
            || id === POWERUP_RESTORE_BASE_TILE
            || id.startsWith('bitmap__powerup_restore_icon')
            || id === MENU_TEXTURES.btnCircle);
        const r = rig();
        openLevels(r.shell);
        openDetail(r.shell, 3);
        for (let i = 0; i < 40; i += 1) r.shell.update(1 / 60);

        const cmds = frame(r.shell);
        const ids = cmds.filter((c) => c.kind === 'blit').map((c) => c.textureId) as string[];
        expect(
            ids.filter((id) => id === POWERUP_RESTORE_BASE_TILE).length,
            '三枚共用背景件各一条（环带单源化）',
        ).toBe(3);
        expect(
            ids.filter((id) => id.startsWith('bitmap__powerup_restore_icon')).length,
            '三件道具件各一条',
        ).toBe(3);
        expect(
            ids.some((id) => Object.values(POWERUP_TILE_TEXTURES).includes(id)),
            '道具件键在场（值已改指拆分件）',
        ).toBe(true);
        expect(
            ids.some((id) => id.startsWith('bitmap__powerup_window_tile')
                || id.startsWith('bitmap__powerup_random_tile')
                || id.startsWith('bitmap__powerup_tray_tile')),
            '⛔ 旧整图 tile 键零消费',
        ).toBe(false);
    });

    it('[WXG-T-1049] 道具件内缩到背景框米底区内 ⇒ 木框露出（⛔ 与背景件同尺寸被实底完全盖住）', () => {
        // 用户报「关卡详情的道具图标缺少背景框」：背景件 336²（木框内沿 60/336、米底 217/336=0.646）
        // 与道具件 160²（自带宽米色实底、不透明范围 0..152 ≈ 铺满）此前**同尺寸同位**绘制 ⇒
        // 道具件的实底把木框整圈盖掉。判据 = 道具件窄于背景框且居中。
        setMenuBitmapResolver((id) => id.startsWith('bitmap__detail_')
            || id === POWERUP_RESTORE_BASE_TILE
            || id.startsWith('bitmap__powerup_restore_icon')
            || id === MENU_TEXTURES.btnCircle);
        const r = rig();
        openLevels(r.shell);
        openDetail(r.shell, 3);
        for (let i = 0; i < 40; i += 1) r.shell.update(1 / 60);

        const blits = frame(r.shell).filter((c) => c.kind === 'blit');
        const bases = blits.filter((c) => c.textureId === POWERUP_RESTORE_BASE_TILE);
        const icons = blits.filter((c) => c.textureId?.startsWith('bitmap__powerup_restore_icon'));
        expect([bases.length, icons.length], '三对件齐发').toEqual([3, 3]);
        for (let i = 0; i < 3; i += 1) {
            const b = bases[i]!;
            const ic = icons[i]!;
            const ratio = (ic.w ?? 0) / (b.w ?? 1);
            // 背景件 336² 的中央 (88,88,248,248) 道具区 = 160²，道具件就是该区原图 ⇒ 160/336。
            expect(ratio, `第 ${i + 1} 件：道具件 = 背景件中央道具区（160/336）`).toBeCloseTo(160 / 336, 2);
            expect((ic.x ?? 0) - (b.x ?? 0), '水平居中').toBeCloseTo(((b.w ?? 0) - (ic.w ?? 0)) / 2, 1);
            expect((ic.y ?? 0) - (b.y ?? 0), '垂直居中').toBeCloseTo(((b.h ?? 0) - (ic.h ?? 0)) / 2, 1);
        }
    });
});
