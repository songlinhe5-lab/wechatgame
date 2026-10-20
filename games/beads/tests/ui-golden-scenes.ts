/**
 * **UI 金样本共享场景驱动（WXG-T-298 / UI-02）**
 * ─────────────────────────────────────────────────────────────────────────────
 * 正本 = `docs/architecture/ui-architecture-beads.md` §5（十个界面单元）、§9.4（迁移逐条对拍）、
 * §12 UI-02（「每界面 × 关键状态抓取现行 RenderModel 指令序列」；验收 = 覆盖十个单元 + 对拍工具
 * 可重复运行）、ADR-0032 DEC-6（迁移期零视觉漂移）。
 *
 * 本文件只负责**驱动**：每态都走玩家真实入口（`createBeadsShell` + `tapMeta` / `play.tapDesign` /
 * 通关填盘 / 倒计时），不直接拼 view-model 入参 ⇒ 金样本锁的是宿主拿到的整帧指令流。
 * 写夹具 = `ui-golden-capture.ts`；只读对拍 = `ui-golden.test.ts`（⛔ 测试不得自更新基准）。
 *
 * ⚠ 签到（`signin`）当前**无菜单入口**（Q5① 退役，`beads-shell.test.ts` 明确「菜单不得有签到热区」），
 *   只能经测试后门把 `signin` 弹窗路由压栈（`PhaseRouteBinder.openModal`）。该态为迁移基线保留，
 *   恢复入口后本场景才回到真实路径。
 */
import { createHash } from 'node:crypto';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    NullAssetProvider,
    NullAudioBackend,
    RenderModelBuilder,
    Viewport,
    createRng,
    polygonVertices,
    type DrawCommand,
    type GameServices,
    type RenderModel,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import type { PhaseRouteBinder } from '../src/ui/phase-route-binder.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { defaultBeadsSave } from '../src/game/save-schema.js';
import { metaLayout } from '../src/view/meta-view.js';
import { CLEAR_PANEL_DELAY_MS, DESIGN_H, DESIGN_W, GEAR_HIT_SIZE, HUD_BAND, PANEL_IN_MS, WALL_ROWS } from '../src/config/tuning.js';
import { clearPanelLayout } from '../src/systems/clear-panel.js';
import { simpleTestLevel } from './helpers.js';

/** 固定步长 / 时钟 / 种子：金样本可重复性的三根钉子。 */
export const UI_GOLDEN_STEP = 1 / 60;
export const UI_GOLDEN_CLOCK = 1_700_000_000_000;
export const UI_GOLDEN_SEED = 'beads-ui-golden';
export const UI_GOLDEN_PIXEL_RATIO = 2;

const META_KEY = 'wxgame.beads.ui-golden.meta';
const SAVE_KEY = 'wxgame.beads.ui-golden.save';

interface RigOptions {
    /** 关卡表；省略 = 不启动对局（菜单态）。 */
    levels?: ReturnType<typeof simpleTestLevel>[];
    /** 冲刺时长（秒）；仅 sprint 场景需要。 */
    sprintTime?: number;
    /** 菜单态解锁进度（选关页要看到多页卡片）。 */
    unlocked?: number;
    /** 空盘启动：通关/结算场景必须先清空 BOOT 装配的错位珠。 */
    noAssemble?: boolean;
}

function rig(opts: RigOptions = {}): BeadsShell {
    const platform = new NodePlatform({ width: DESIGN_W, height: DESIGN_H, pixelRatio: UI_GOLDEN_PIXEL_RATIO });
    const storage = platform.createStorage();
    if (opts.unlocked !== undefined) {
        storage.set(SAVE_KEY, JSON.stringify({ ...defaultBeadsSave(), maxUnlockedLevel: opts.unlocked }));
    }
    // 体力给满：菜单态不因体力横幅的变化换出另一种帧。
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), staminaCur: 99 }));
    const services: GameServices = {
        events: new EventBus(),
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng(UI_GOLDEN_SEED),
        viewport: new Viewport(DESIGN_W, DESIGN_H),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({
        clock: () => UI_GOLDEN_CLOCK,
        metaKey: META_KEY,
        play: {
            saveKey: SAVE_KEY,
            ...(opts.levels ? { levels: opts.levels } : {}),
            ...(opts.sprintTime !== undefined ? { sprintTime: opts.sprintTime } : {}),
            ...(opts.noAssemble ? { noBootAssembly: true } : {}),
        },
    });
    shell.init(services);
    return shell;
}

function advance(shell: BeadsShell, seconds: number): void {
    const steps = Math.max(1, Math.round(seconds / UI_GOLDEN_STEP));
    for (let i = 0; i < steps; i++) shell.update(UI_GOLDEN_STEP);
}

/** 与封箱夹具同式序列化：polygon 顶点解引用内联（命令本身只存 offset/count）。 */
export function serializeUiGolden(model: RenderModel): string[] {
    return model.commands.map((c: DrawCommand) =>
        c.kind === 'polygon'
            ? JSON.stringify({ ...c, points: Array.from(polygonVertices(model, c)) })
            : JSON.stringify(c),
    );
}

export function uiGoldenSha(flow: readonly string[]): string {
    return createHash('sha256').update(flow.join('\n')).digest('hex');
}

export function uiGoldenKinds(flow: readonly string[]): Record<string, number> {
    const kinds: Record<string, number> = {};
    for (const line of flow) {
        const kind = (JSON.parse(line) as { kind: string }).kind;
        kinds[kind] = (kinds[kind] ?? 0) + 1;
    }
    return kinds;
}

function frame(shell: BeadsShell): RenderModel {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    shell.buildRenderModel(builder);
    return builder.end();
}

function tapMeta(shell: BeadsShell, id: string): void {
    const btn = metaLayout('none', WALL_ROWS, shell.menuAnchors).buttons.find((b) => b.id === id);
    if (!btn) throw new Error(`菜单热区缺失：${id}`);
    if (!shell.tapMeta(btn.box.x + btn.box.w / 2, btn.box.y + btn.box.h / 2)) {
        throw new Error(`菜单热区点击未命中：${id}`);
    }
}

function requireScreen(shell: BeadsShell, screen: 'menu' | 'play', overlay: string, phase?: string): void {
    if (shell.screen !== screen) throw new Error(`screen=${shell.screen} ≠ ${screen}`);
    if (shell.overlay !== overlay) throw new Error(`overlay=${shell.overlay} ≠ ${overlay}`);
    if (phase !== undefined && shell.play.phase !== phase) throw new Error(`phase=${shell.play.phase} ≠ ${phase}`);
}

/** 填满整块棋盘（同 `clear-panel.test.ts` 口径；需 `noAssemble` 空盘）。 */
function fillBoard(shell: BeadsShell): void {
    const game = shell.play;
    for (let r = 0; r < game.grid.rows; r++) {
        for (let c = 0; c < game.grid.cols; c++) {
            if (!game.grid.isFillable(r, c)) continue;
            const slot = game.giveTrayBead(game.grid.requiredColor(r, c));
            if (slot < 0) throw new Error(`托盘满：(${r},${c})`);
            game.selectTraySlot(slot);
            if (!game.tapGridCell(r, c)) throw new Error(`落珠失败：(${r},${c})`);
        }
    }
}

function startGame(shell: BeadsShell): void {
    if (!shell.startGame()) throw new Error('startGame 未生效');
}

interface GoldenStateDef {
    id: string;
    /** §5 界面单元名（十个必须齐全且唯一）。 */
    unit: string;
    /** 关键状态说明（进夹具，供失败时读）。 */
    note: string;
    build: () => BeadsShell;
}

/**
 * 十态 = §5 的十个界面单元各取一个关键状态。顺序即夹具顺序（测试逐条对拍）。
 * 加/删/改任何一态都会改变覆盖集 ⇒ 对拍测试的覆盖腿当场红。
 */
const STATES: readonly GoldenStateDef[] = [
    {
        id: 'main-menu',
        unit: 'MainMenuPage',
        note: '菜单首页：体力 99 + 解锁到第 9 关（卡片/轮播满档）',
        build: () => {
            const shell = rig({ unlocked: 9 });
            requireScreen(shell, 'menu', 'none');
            return shell;
        },
    },
    {
        id: 'level-select',
        unit: 'LevelSelectPage',
        note: '选关页：从菜单点 Boss 图位 `open-levels` 进入',
        build: () => {
            const shell = rig({ unlocked: 9 });
            tapMeta(shell, 'open-levels');
            requireScreen(shell, 'menu', 'levels');
            // `[WXG-T-314]` 进页淡入 200ms（ux §5）：推到静息再取帧（终点 = 无转场帧，sha 零漂移）。
            advance(shell, PANEL_IN_MS / 1000 + UI_GOLDEN_STEP);
            return shell;
        },
    },
    {
        id: 'settings',
        unit: 'SettingsModal',
        note: '设置弹窗：从菜单点齿轮 `open-settings` 进入',
        build: () => {
            const shell = rig({ unlocked: 9 });
            tapMeta(shell, 'open-settings');
            requireScreen(shell, 'menu', 'settings');
            return shell;
        },
    },
    {
        id: 'signin',
        unit: 'SigninModal',
        note: '签到弹窗：⚠ 入口已退役（Q5①），经测试后门压 `signin` 路由，为迁移基线保留',
        build: () => {
            const shell = rig({ unlocked: 9 });
            (shell as unknown as { _phase: PhaseRouteBinder })._phase.openModal('signin');
            requireScreen(shell, 'menu', 'signin');
            return shell;
        },
    },
    {
        id: 'play',
        unit: 'PlayPage',
        note: '对局中：6×5 测试关，开局 0.2s（HUD/盘面/托盘静置态）',
        build: () => {
            const shell = rig({ levels: [simpleTestLevel()] });
            startGame(shell);
            advance(shell, 0.2);
            requireScreen(shell, 'play', 'none', 'playing');
            return shell;
        },
    },
    {
        id: 'pause',
        unit: 'PauseModal',
        note: '暂停弹窗：对局中点 HUD 齿轮后推进 1s',
        build: () => {
            const shell = rig({ levels: [simpleTestLevel()] });
            startGame(shell);
            advance(shell, 0.2);
            if (!shell.play.tapDesign(GEAR_HIT_SIZE / 2, (HUD_BAND.yMin + HUD_BAND.yMax) / 2)) {
                throw new Error('齿轮点击未命中');
            }
            advance(shell, 1);
            requireScreen(shell, 'play', 'none', 'paused');
            return shell;
        },
    },
    {
        id: 'clear',
        unit: 'ClearResultModal',
        note: '过关结算：空盘填满 30 格 → 过波浪延迟后面板全开（3★）',
        build: () => {
            const shell = rig({ levels: [simpleTestLevel()], noAssemble: true });
            startGame(shell);
            advance(shell, 0.2);
            fillBoard(shell);
            if (shell.play.phase !== 'level-clear') throw new Error(`phase=${shell.play.phase} ≠ level-clear`);
            advance(shell, CLEAR_PANEL_DELAY_MS / 1000 + 0.6);
            requireScreen(shell, 'play', 'none', 'level-clear');
            return shell;
        },
    },
    {
        id: 'fail',
        unit: 'FailResultModal',
        note: '失败结算：30s 关卡倒计时归零后推进 1s',
        build: () => {
            const shell = rig({ levels: [simpleTestLevel({ time: 30 })] });
            startGame(shell);
            advance(shell, 31);
            advance(shell, 1);
            requireScreen(shell, 'play', 'none', 'game-over');
            return shell;
        },
    },
    {
        id: 'sprint-settle',
        unit: 'SprintSettleModal',
        note: '冲刺结算：90s 冲刺跑到时间耗尽（结算面板为最后一关口径）',
        build: () => {
            const shell = rig({ levels: [simpleTestLevel()], sprintTime: 90 });
            startGame(shell);
            shell.play.startSprint();
            let guard = 0;
            while (shell.play.phase === 'playing' && guard++ < 200) advance(shell, 1);
            if (shell.play.phase !== 'game-over') throw new Error(`phase=${shell.play.phase} ≠ game-over`);
            advance(shell, 1);
            requireScreen(shell, 'play', 'none', 'game-over');
            return shell;
        },
    },
    {
        id: 'finish',
        unit: 'FinishModal',
        note: '通关结算：最后一关过关后点主钮 `next` → finish 面板',
        build: () => {
            const shell = rig({ levels: [simpleTestLevel()], noAssemble: true });
            startGame(shell);
            advance(shell, 0.2);
            fillBoard(shell);
            advance(shell, CLEAR_PANEL_DELAY_MS / 1000 + 0.6);
            const rect = clearPanelLayout({ lastLevel: true }).buttons.find((b) => b.id === 'next')!.rect;
            if (!shell.play.tapDesign((rect.xMin + rect.xMax) / 2, (rect.yMin + rect.yMax) / 2)) {
                throw new Error('通关主钮点击未命中');
            }
            advance(shell, 1);
            requireScreen(shell, 'play', 'none', 'finish');
            return shell;
        },
    },
];

export interface UiGoldenStateRecord {
    id: string;
    unit: string;
    note: string;
    /** 场景自证：抓到帧时宿主真的停在该界面/相位（防场景静默跑偏成另一屏）。 */
    proof: { screen: string; overlay: string; phase: string | null };
    total: number;
    kinds: Record<string, number>;
    sha: string;
    /** 宿主消费的整帧底色（不进命令流，故单独锁）。 */
    background: string | null;
    /** 整帧变换（若有）；宿主会消费，故单独锁。 */
    transform: unknown;
}

export function uiGoldenStateIds(): string[] {
    return STATES.map((s) => s.id);
}

/** 跑一态：返回登记用记录 + 全量命令流（后者仅 capture `--dump` 与失败诊断用）。 */
export function runUiGoldenState(id: string): { record: UiGoldenStateRecord; flow: string[] } {
    const def = STATES.find((s) => s.id === id);
    if (!def) throw new Error(`未登记的金样本状态：${id}`);
    const shell = def.build();
    const model = frame(shell);
    const flow = serializeUiGolden(model);
    return {
        record: {
            id: def.id,
            unit: def.unit,
            note: def.note,
            proof: { screen: shell.screen, overlay: shell.overlay, phase: shell.play.phase },
            total: flow.length,
            kinds: uiGoldenKinds(flow),
            sha: uiGoldenSha(flow),
            background: model.background ?? null,
            transform: model.transform ?? null,
        },
        flow,
    };
}

export function runAllUiGoldenStates(): Array<{ record: UiGoldenStateRecord; flow: string[] }> {
    return STATES.map((s) => runUiGoldenState(s.id));
}
