/**
 * **WXG-T-298 / UI-02 金样本复取器**（非测试文件 —— 文件名不带 `.test.ts` ⇒ 不进 vitest 采集）
 * ─────────────────────────────────────────────────────────────────────────────
 * 唯一职责：跑 `ui-golden-scenes.ts` 的十一帧（十单元 + 转场中点），产出 checked-in 夹具
 * `tests/__fixtures__/wxg-t-298-ui-golden.json`。只读对拍在 `ui-golden.test.ts`。
 *
 * 跑法（仓根；`--experimental-transform-types` 与 `bead-style-framediff.ts` 同）：
 *   WXG298_SOURCE_REV=$(git rev-parse --short HEAD) \
 *   node --experimental-transform-types \
 *        --import=./tools/scripts/lib/ts-js-resolve.mjs \
 *        games/beads/tests/ui-golden-capture.ts [--dump]
 * `--dump` 另把十一帧全量命令流写到 `temp/ui-golden/<id>.jsonl`（temp/ 属 gitignore）。
 *
 * 纪律：
 *  - 脚本连跑两遍自证确定性，逐态 sha 不一致即拒写（「对拍工具可重复运行」的机械证据）；
 *  - ⛔ 只在**可复现锚**（commit）复取；⛔ 手改 sha/total/种类数；视觉变更须先有 UX 裁定并
 *    在 `docs/architecture/ui-architecture-beads.md` 登记（K-051 / K-053 / ADR-0032 DEC-6）。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
    UI_GOLDEN_CLOCK,
    UI_GOLDEN_PIXEL_RATIO,
    UI_GOLDEN_SEED,
    UI_GOLDEN_STEP,
    runAllUiGoldenStates,
    uiGoldenStateIds,
} from './ui-golden-scenes.js';
import { DESIGN_H, DESIGN_W } from '../src/config/tuning.js';

const OUT = new URL('./__fixtures__/wxg-t-298-ui-golden.json', import.meta.url);
const DUMP_DIR = new URL('../../../temp/ui-golden/', import.meta.url);
const shouldDump = process.argv.includes('--dump');

const runs = [runAllUiGoldenStates(), runAllUiGoldenStates()];
assert.equal(runs[0]!.length, 11, `状态数 ${runs[0]!.length} ≠ 11（十单元 + 转场中点）`);
assert.deepEqual(
    runs[0]!.map((r) => r.record.sha),
    runs[1]!.map((r) => r.record.sha),
    '两次复取 sha 不一致 ⇒ 场景含非确定源（时钟 / 随机 / 迭代顺序），拒绝写夹具',
);
assert.deepEqual(runs[0]!.map((r) => r.record), runs[1]!.map((r) => r.record));

const records = runs[0]!.map((r) => r.record);
assert.deepEqual(records.map((r) => r.id), uiGoldenStateIds());
assert.equal(new Set(records.map((r) => r.unit)).size, 10, '界面单元不唯一');

if (shouldDump) {
    if (!existsSync(DUMP_DIR)) mkdirSync(DUMP_DIR, { recursive: true });
    for (const { record, flow } of runs[0]!) {
        writeFileSync(new URL(`${record.id}.jsonl`, DUMP_DIR), `${flow.join('\n')}\n`);
    }
}

const fixture = {
    _readme: [
        'WXG-T-298 / UI-02 金样本（十界面单元 × 关键状态整帧 RenderModel 指令流；另含选关页转场中点一帧）。',
        '锁的是什么：每态 `sha256(命令流 join("\\n"))` + `total` + 逐 kind 计数 + 宿主消费的 background/transform + 场景自证（screen/overlay/phase）。',
        'polygon 命令的 vertices 已在序列化时按 polygonVertices() 内联为 points ⇒ 顶点漂移同样进 sha。',
        '⛔ 本件只能由 tests/ui-golden-capture.ts 在可复现锚（commit）重抓；⛔ 不得手改 sha/total/kinds。',
        '⛔ 视觉漂移必须先有 UX 裁定并在 docs/architecture/ui-architecture-beads.md §12 登记，再重抓（K-051 / K-053 / ADR-0032 DEC-6）。',
        'UI-02 口径 =「现行 RenderModel 指令序列」；codeBaseline 记 §11 架构基线 bd964a0（其代码态与本件 capturedFrom 的首提交一致，之上仅文档提交）。',
        '⚠ signin 当前无菜单入口（Q5① 退役），该态经测试后门压 `signin` 路由，为迁移基线保留。',
    ].join('\n'),
    task: 'WXG-T-298',
    unit: 'UI-02',
    spec: 'docs/architecture/ui-architecture-beads.md §5 / §9.4 / §12',
    codeBaseline: 'bd964a0',
    capturedFrom: `${process.env.WXG298_SOURCE_REV ?? 'unknown'} · ${process.env.WXG298_SOURCE_DESC ?? '工作树（WXG-T-298）'}`,
    fixture: {
        viewport: { width: DESIGN_W, height: DESIGN_H, pixelRatio: UI_GOLDEN_PIXEL_RATIO },
        seed: UI_GOLDEN_SEED,
        clock: UI_GOLDEN_CLOCK,
        step: UI_GOLDEN_STEP,
        level: 'simpleTestLevel() 6×5（fail 场景 time=30，冲刺场景 sprintTime=90）',
        menuSeed: { staminaCur: 99, maxUnlockedLevel: 9 },
        stepPolicy: 'shell.update(1/60) 固定步长；菜单态不推进对局',
    },
    states: records,
};

writeFileSync(OUT, `${JSON.stringify(fixture, null, 2)}\n`);

for (const r of records) {
    console.log(
        `[298][golden] ${r.id.padEnd(14)} ${r.unit.padEnd(18)} total=${String(r.total).padStart(5)} ` +
        `bg=${r.background ?? '-'} ${JSON.stringify(r.kinds)}`,
    );
}
console.log(`[298][golden] 十一帧确定性自证 = PASS（两遍逐态记录全等）→ ${OUT.pathname}${shouldDump ? '（含 --dump）' : ''}`);
