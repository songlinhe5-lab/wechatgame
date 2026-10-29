/**
 * **UI 金样本只读对拍（WXG-T-298 / UI-02）**
 * ─────────────────────────────────────────────────────────────────────────────
 * 正本 = `docs/architecture/ui-architecture-beads.md` §5 / §9.4 / §12 UI-02：
 * 「每界面 × 关键状态抓取现行 RenderModel 指令序列」；验收 = 覆盖十个单元 + 对拍工具可重复运行。
 * 覆盖集 = 十单元各一帧 + `level-select-mid`（选关页转场中点，不新增单元）。
 * 迁移纪律（ADR-0032 DEC-6）= 逐条对拍，**不得有无登记的差异**。
 *
 * 数据源 = `__fixtures__/wxg-t-298-ui-golden.json`（checked-in）。复取只能走
 * `tests/ui-golden-capture.ts` 在可复现锚重抓。
 *
 * ⛔ 本文件**只读不算基准**（不写夹具、不需 env 开关）⇒ 可进全量 `vitest run`。
 * ⛔ 任一腿红时先查是否有人改了 UI 渲染路径；**不得反向改夹具让它绿**（K-051 / K-053）。
 *    失败时 actual 全量流会 dump 到 `temp/ui-golden/<id>.actual.jsonl` 供逐条差分。
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    UI_GOLDEN_PIXEL_RATIO,
    UI_GOLDEN_SEED,
    UI_GOLDEN_STEP,
    runUiGoldenState,
    uiGoldenStateIds,
    type UiGoldenStateRecord,
} from './ui-golden-scenes.js';
import { checkUiContainerOrder } from '@wxgame/framework';
import { DESIGN_H, DESIGN_W } from '../src/config/tuning.js';

/**
 * 容器边界口径（`[WXG-T-437/438]`，ADR-0033 DEC-1）：**哪些态必须发容器边界**。
 *
 * 有面板 / 弹窗 ⇒ 恰 1 个容器（`settings`/`signin` 弹窗路由；对局五态 = `panel` 容器）；
 * 纯页面 ⇒ 0（页面走默认层，恒在容器树之下）。
 *
 * ⛔ 改这张表 = 改层级契约（要先过 ADR 与 UX 登记），不是「让测试变绿」的手续（K-051）。
 * 它同时是「相位面板搬栈（`WXG-T-440`）后仍必须包容器」的机械替身：谁绕过路由表直接发面板
 * 命令、或让页面路由也去包容器，这里当场红。
 */
const CONTAINER_EXPECT: Readonly<Record<string, number>> = {
    'main-menu': 0,
    // `[WXG-T-503]` 选关改回弹窗 ⇒ 整页/转场中点都自持一个容器。
    'level-select': 1,
    'level-select-mid': 1,
    settings: 1,
    signin: 1,
    play: 0,
    pause: 1,
    clear: 1,
    fail: 1,
    'sprint-settle': 1,
    finish: 1,
};

interface GoldenFixture {
    _readme: string;
    task: string;
    unit: string;
    spec: string;
    codeBaseline: string;
    capturedFrom: string;
    fixture: {
        viewport: { width: number; height: number; pixelRatio: number };
        seed: string;
        clock: number;
        step: number;
        level: string;
        menuSeed: { staminaCur: number; maxUnlockedLevel: number };
        stepPolicy: string;
    };
    states: UiGoldenStateRecord[];
}

const GOLDEN = JSON.parse(
    readFileSync(new URL('./__fixtures__/wxg-t-298-ui-golden.json', import.meta.url), 'utf8'),
) as GoldenFixture;

/** §5 的十个界面单元（字面量：夹具少一个 / 多一个 / 改名都当场红）。 */
const TEN_UNITS = [
    'ClearResultModal',
    'FailResultModal',
    'FinishModal',
    'LevelSelectPage',
    'MainMenuPage',
    'PauseModal',
    'PlayPage',
    'SettingsModal',
    'SigninModal',
    'SprintSettleModal',
].sort();

/**
 * 失败诊断：把 actual 全量命令流写到 temp（gitignored），返回带处置指引的断言文案。
 * 只在真要红的时候写，绿态零副作用。
 */
function actualDump(id: string, flow: readonly string[]): string {
    const dir = new URL('../../../temp/ui-golden/', import.meta.url);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const file = new URL(`${id}.actual.jsonl`, dir);
    writeFileSync(file, `${flow.join('\n')}\n`);
    return fileURLToPath(file);
}

function failMessage(want: UiGoldenStateRecord, what: string, flow: readonly string[]): string {
    const path = actualDump(want.id, flow);
    return (
        `⛔ ${want.unit}（${want.id}）${what}与金样本不符。actual 流已 dump：${path}\n` +
        '处置：① 确认改动有 UX 裁定且在 docs/architecture/ui-architecture-beads.md §12 登记；' +
        '② 仅可由 tests/ui-golden-capture.ts 在可复现锚重抓；⛔ 不得手改夹具（K-051 / K-053）。'
    );
}

/** 记录逐项等值（序列化比较足够：字段全是 JSON 值）。 */
function recordDiffers(a: UiGoldenStateRecord, b: UiGoldenStateRecord): boolean {
    return (
        JSON.stringify([a.proof, a.total, a.kinds, a.background, a.transform, a.sha]) !==
        JSON.stringify([b.proof, b.total, b.kinds, b.background, b.transform, b.sha])
    );
}

describe('WXG-T-298 UI-02 金样本（十界面 × 关键状态整帧对拍）', () => {
    it('覆盖腿：十个界面单元齐全且唯一，夹具顺序 ≡ 场景顺序，夹具参数未漂移', () => {
        expect(GOLDEN.task).toBe('WXG-T-298');
        expect(GOLDEN.unit).toBe('UI-02');
        expect(GOLDEN._readme).toContain('ui-golden-capture.ts');
        expect(GOLDEN.states.map((s) => s.id)).toEqual(uiGoldenStateIds());
        expect(GOLDEN.states).toHaveLength(11);
        expect([...new Set(GOLDEN.states.map((s) => s.unit))].sort()).toEqual(TEN_UNITS);
        // 复现参数必须与驱动常量同源（改夹具参数而不改驱动 = 不可复现的基准）。
        expect(GOLDEN.fixture.viewport).toEqual({ width: DESIGN_W, height: DESIGN_H, pixelRatio: UI_GOLDEN_PIXEL_RATIO });
        expect(GOLDEN.fixture.seed).toBe(UI_GOLDEN_SEED);
        expect(GOLDEN.fixture.step).toBe(UI_GOLDEN_STEP);
        expect(GOLDEN.fixture.menuSeed).toEqual({ staminaCur: 99, maxUnlockedLevel: 9 });
        // 场景自证必须记全（防「抓到的其实是另一屏」）。
        for (const s of GOLDEN.states) expect(s.proof.screen).toMatch(/^(menu|play)$/);
    });

    it('容器边界口径：十一帧结构门全空，且「有面板 ⇒ 恰一个容器」', () => {
        // 口径表必须与场景集逐一对齐（少一态 / 多一态 ⇒ 当场红，不会静默漏覆盖）。
        expect(Object.keys(CONTAINER_EXPECT).sort()).toEqual([...uiGoldenStateIds()].sort());
        for (const id of uiGoldenStateIds()) {
            const { commands } = runUiGoldenState(id);
            // DEC-8① 结构门首次覆盖**全部十一帧**（含对局面板容器）。
            expect(checkUiContainerOrder(commands), `${id} 结构门`).toEqual([]);
            const containers = commands.filter((c) => c.kind === 'container').length;
            expect(containers, `${id} 容器数`).toBe(CONTAINER_EXPECT[id]);
        }
    });

    for (const want of GOLDEN.states) {
        it(`对拍：${want.unit}（${want.id}）`, () => {
            const { record, flow } = runUiGoldenState(want.id);
            // 绿态零副作用：只有真要红时才 dump actual 全量流。
            const msg = recordDiffers(record, want) ? failMessage(want, '记录', flow) : `⛔ ${want.unit}（${want.id}）与金样本不符`;
            // 先比 proof：场景跑偏（进错屏/相位）时，后面 sha 的差异只是噪声。
            expect(record.proof, `${msg} [proof]`).toEqual(want.proof);
            expect(record.total, `${msg} [total]`).toBe(want.total);
            expect(record.kinds, `${msg} [kinds]`).toEqual(want.kinds);
            expect(record.background, `${msg} [background]`).toBe(want.background);
            expect(record.transform, `${msg} [transform]`).toEqual(want.transform);
            expect(record.sha, `${msg} [sha]`).toBe(want.sha);
        });
    }
});
