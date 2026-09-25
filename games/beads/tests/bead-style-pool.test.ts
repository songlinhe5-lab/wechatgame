/**
 * 风格池门禁判据（WXG-T-211-B1 / EP11-S2 · QA `test-cases.md §K.2` TC-STY-08/09/10）
 * ─────────────────────────────────────────────────────────────────────────────
 * 判据白名单：`§12.2 C7/C11/C12`（弱读法·八批钉正本）+ TC-STY-08/09/10 判据原文。
 *
 * 道次 = `[Node]`（门禁脚本 spawn，CI 腿判据 = **失败输出文本必须含五项**，
 * 「只给退出码」即判红，C11/TC-STY-08 原文）。
 *
 * ⚠ 实现住真源（`tools/scripts/check-bead-style-pool.mjs` + registry），本文件
 *   只 spawn + 断言输出 —— ⛔ 不在测试内重跑采样/重推占比（K-042），也
 *   ⛔ 不在测试里 import 游戏 TS 再手算（两套口径 = 假绿温床）。
 * ⚠ 反例夹具（8/0、5/3、他格色）只活在门禁脚本 `--fixtures` 模式，
 *   **永不进 registry**（epics S2 字面）。
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const HOOK = 'tools/scripts/lib/ts-js-resolve.mjs';
const SCRIPT = 'tools/scripts/check-bead-style-pool.mjs';

function runPool(args: string[]): { code: number; out: string } {
    const proc = spawnSync('node', ['--import', `./${HOOK}`, SCRIPT, ...args], {
        cwd: REPO,
        encoding: 'utf8',
        timeout: 60_000,
    });
    return { code: proc.status ?? -1, out: `${proc.stdout ?? ''}${proc.stderr ?? ''}` };
}

describe('TC-STY-08 · C11 触门五项 + 双反例臂（§12.2 C7/C11）', () => {
    const fixtures = runPool(['--fixtures']);

    it('反例臂注入下 exit 非 0 且 STATUS: FAIL（停在待确认态，不静默放行）', () => {
        expect(fixtures.code).toBe(1);
        expect(fixtures.out).toMatch(/^STATUS: FAIL$/m);
    });

    it('臂 1「8 命令 / 0 α」（只超命令）⇒ 五项数值齐且 ④ 指命令', () => {
        const seg = fixtures.out.split('C11 触门 [fixture-8cmd-0alpha]')[1]?.split('C11 触门')[0];
        expect(seg, 'fixture-8cmd-0alpha 触门段存在').toBeTruthy();
        expect(seg).toContain('① 实测命令数 = 8');
        expect(seg).toContain('② 实测真 α 层数 = 0');
        expect(seg).toContain('③ 两项上限 = 命令 ≤ 7 / 真 α ≤ 2');
        expect(seg).toContain('④ 超出 = 命令数超 1（8 > 7）');
        // ⛔ 单臂构造无法证明④判别力 ⇒ 本臂 ④ **不得**同时报 α 超（另一臂对称断言）。
        expect(seg).not.toContain('真 α 层超');
        expect(seg).toMatch(/⑤ 与基线四棱 6\/0 差值 = 命令 \+2 \/ 真 α \+0/);
    });

    it('臂 2「5 命令 / 3 α」（只超 α）⇒ 五项数值齐且 ④ 指 α', () => {
        const seg = fixtures.out.split('C11 触门 [fixture-5cmd-3alpha]')[1]?.split(/C12 |^C11|共 \d+ 条违规/m)[0];
        expect(seg, 'fixture-5cmd-3alpha 触门段存在').toBeTruthy();
        expect(seg).toContain('① 实测命令数 = 5');
        expect(seg).toContain('② 实测真 α 层数 = 3');
        expect(seg).toContain('③ 两项上限 = 命令 ≤ 7 / 真 α ≤ 2');
        expect(seg).toContain('④ 超出 = 真 α 层超 1（3 > 2）');
        expect(seg).not.toContain('命令数超');
        expect(seg).toMatch(/⑤ 与基线四棱 6\/0 差值 = 命令 -1 \/ 真 α \+3/);
    });

    it('真实 registry（facet-4）常门过 = 合规不误伤（臂 C 的门禁侧，测面在 TC-STY-10）', () => {
        const ok = runPool([]);
        expect(ok.code).toBe(0);
        expect(ok.out).toMatch(/^STATUS: OK$/m);
        // 数值表恒打（K-051 禁引纸面值）：facet-4 实测 6 命令 / 0 真 α。
        expect(ok.out).toMatch(/\[facet-4\] 命令=6 真α=0/);
    });
});

describe('TC-STY-09 · C12 主体色不变式·主判据（弱读法，逐 inks 色）', () => {
    const ok = runPool([]);

    it('facet-4 逐色（10 色全跑）珠面占比最大端点色 ∈ 本格 base 同族 ⇒ 零「∉」输出', () => {
        // 判定式（八批正本）：主体色 = 珠面 pixel 占比最大端点色；统计域排除底衬/描边 rect 与孔。
        for (let ci = 1; ci <= 10; ci++) {
            const line = ok.out.match(new RegExp(`colorIdx=${ci} argmax=#\\w+`));
            expect(line, `colorIdx=${ci} 认定行存在且 argmax 非空`).toBeTruthy();
        }
        expect(ok.out).not.toContain('∉ 本格 base 同族');
        expect(ok.out).not.toContain('C12 判红');
    });

    it('⛔ 非强读法：实测 argmax = edge（族内非 base）不判红，且近并列数值恒打台面', () => {
        // 实测（本单钉值，步 3 转正时按差分复算重钉）：四枚刻面几近等面积，
        // 占比序 = edge 2140px > 右刻面 mix(−0.16) 2135px（非端点不参赛）> base 2105px > lit 2100px
        // ⇒ argmax ∈ base 同族但**不是** base。若实现滑回「最大可见面积者必须 ≡ base」
        // 的强读法（已作废），本常门会直接 FAIL ⇒ 此处以实测值守绿，⛔ 不写永真断言。
        expect(ok.code).toBe(0);
        expect(ok.out).toMatch(/^STATUS: OK$/m);
        // ① 全量分布表在场（数值上台面，不静默消解）：逐色 4 条目，非端点层显式标「不参赛」。
        for (let ci = 1; ci <= 10; ci++) {
            expect(ok.out, `colorIdx=${ci} 分布表行`).toMatch(
                new RegExp(`colorIdx=${ci} argmax=#\\w+\\(\\d+\\.\\d%\\) facetPx=\\d+/\\d+ 分布=`),
            );
        }
        // ② 近并列注记在场（ci=1 实钉值：argmax=#b1aca3 25.2% vs base #FDF6E9 24.8%）。
        expect(ok.out).toMatch(/C12 近并列登记 \[facet-4\]：10\/10 色/);
        expect(ok.out).toMatch(/argmax=#b1aca3 25\.2% vs base #FDF6E9 24\.8%/);
        // ③ 弱读口径下无一条 C12 判红（注记文案本身含「不滑回强读法判红」字样 ⇒ 只钉违规标记）。
        expect(ok.out).not.toContain('C12 判红');
    });
});

describe('TC-STY-10 · C12 反例三臂（验收门：臂 B 不过 ⇒ 门禁不得判「已就位」）', () => {
    it('臂 A（色违规）：珠面主体色换为**他格 base** ⇒ 判红 + 指认越界色与它所属 colorIdx', () => {
        const fixtures = runPool(['--fixtures']);
        expect(fixtures.code).toBe(1);
        const line = fixtures.out.match(/C12 \[fixture-c12-foreign-base\] colorIdx=1：.*\n?/);
        expect(line, '臂 A 判红行存在').toBeTruthy();
        expect(line![0]).toContain('#FFD23F'); // 越界色值
        expect(line![0]).toContain('colorIdx=2 的 base'); // 它所属 colorIdx（不给归属 = 静默失败）
        expect(line![0]).toContain('C12 判红');
        // 非端点锚色（#00FF00）臂同样指认（归属枚举的第三分支）。
        expect(fixtures.out).toMatch(/#00FF00 = 非任何格端点色（锚色派生类，C3 同样违规）/);
    });

    it('臂 B（识别反证·防恒返 base 自证）：调小占比最大层 ⇒ 认定函数返回值必须随之变', () => {
        const probe = runPool(['--probe-argmax']);
        expect(probe.code).toBe(0);
        const json = probe.out.match(/^\{.*\}$/m);
        expect(json, '探针 JSON 行').toBeTruthy();
        const { argmaxBefore, argmaxAfter, shareBefore, shareAfter, facetPxBefore, facetPxAfter } = JSON.parse(
            json![0],
        ).probe as Record<string, number | string>;
        // 判别力核心：若 identifyPrimary 恒返 base（或任何写死值），前后两次输出必然相同 ⇒ 红。
        expect(argmaxAfter).not.toBe(argmaxBefore);
        expect(Number(shareAfter)).toBeGreaterThan(Number(shareBefore)); // 让位者占比抬升
        expect(Number(facetPxAfter)).toBeLessThan(Number(facetPxBefore)); // 缩层实锤（像素变少）
    });

    it('臂 C（合规正例不误伤）：facet-4 弱读必过（注册侧即本单基线；13/18 臂归步 4 同条复跑）', () => {
        const ok = runPool([]);
        expect(ok.code).toBe(0);
        expect(ok.out).toContain('全部过双指标与 C12 弱读断言');
    });
});

describe('TC-STY-11 · 行4 钮先行哨兵（S9 §8-19 + K.1a 阳性对照腿）', () => {
    // 腿 A（呈现门 + 阳性对照）：PAUSED 面板钮表**不含**「珠子风格」「豆子尺寸」，
    // **但含**对照钮「性能信息」「回主菜单」（view-model.ts:196/:200 已落码锚）⇒
    // 以对照钮在场证明「面板确实渲染了」，使缺位断言可判红（K-060，⛔ 永真断言）。
    it('腿 A：PAUSED 帧 text 图元无两新钮字样、有对照钮字样（阳性对照在场）', async () => {
        const { createBeadsHarness, simpleTestLevel } = await import('./helpers.js');
        const { RenderModelBuilder } = await import('@wxgame/framework');
        const { DESIGN_H, DESIGN_W, GEAR_HIT_SIZE, HUD_BAND } = await import('../src/config/tuning.js');
        const { DEFAULT_PALETTE, DEMO_BEAD_INKS } = await import('../src/view/palette.js');
        const { buildBeadsView } = await import('../src/view/view-model.js');

        const harness = createBeadsHarness({
            noAssemble: true,
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.sty11-a',
        });
        // 点齿轮进 PAUSED（S9 §8-1 既有绿判据的路径，本例只借用其态）。
        harness.game.tapDesign(GEAR_HIT_SIZE / 2, (HUD_BAND.yMin + HUD_BAND.yMax) / 2);
        expect(harness.game.phase).toBe('paused');

        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
        const texts = builder
            .end()
            .commands.filter((c) => c.kind === 'text')
            .map((c) => String((c as { text?: unknown }).text));

        expect(texts.join('¦')).not.toMatch(/珠子风格|豆子尺寸/);
        // 阳性对照腿：两枚已落码对照钮必须在场，否则「不含」只是面板没渲染。
        expect(texts.some((t) => t.includes('性能信息'))).toBe(true);
        expect(texts.some((t) => t === '回主菜单')).toBe(true);
    });

    // 腿 B（文案静态门）：面板/overlay/风格模块文案源不得命中「共 N 款」写死款数。
    // ⛔ 规则可能恒不命中而假绿 ⇒ 变异自证（注入反例可命中→撤销）见
    //   temp/wxg-t-211-b1/07-* 证据，与 S1/臂 B 变异同批。
    it('腿 B：文案源 grep「共 N 款」零命中（静态门本体）', () => {
        const sources = [
            'games/beads/src/view/view-model.ts',
            'games/beads/src/systems/pause-panel.ts',
            'games/beads/src/view/bead-styles/registry.ts',
            'games/beads/src/view/bead-styles/contract.ts',
        ];
        for (const file of sources) {
            const text = readFileSync(resolve(REPO, file), 'utf8');
            expect(text, `${file} 不得写死款数文案`).not.toMatch(/共\s*\d+\s*款/);
        }
    });

    // §8-19 计数侧：注册数 ≤ 1 ⇒ 钮不呈现的前提（注册数）如实成立；本单禁新增钮。
    it('前提哨兵：registry 注册数 ≤ 1（=1 即 facet-4 骨架；钮呈现归步 5，本单不得新增）', async () => {
        const registry = await import('../src/view/bead-styles/registry.js');
        expect(registry.registeredStyleIds().length).toBeLessThanOrEqual(1);
        expect(registry.registeredStyleIds()).toEqual(['facet-4']);
    });
});
