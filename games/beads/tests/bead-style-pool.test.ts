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
import { readFileSync, readdirSync } from 'node:fs';
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

    it('真实 registry（三套已注册风格）常门过 = 合规不误伤（臂 C 的门禁侧，测面在 TC-STY-10）', () => {
        const ok = runPool([]);
        expect(ok.code).toBe(0);
        expect(ok.out).toMatch(/^STATUS: OK$/m);
        // 数值表恒打（K-051 禁引纸面值）：facet-4 实测 6 命令 / 0 真 α。
        expect(ok.out).toMatch(/\[facet-4\] 命令=6 真α=0/);
        // **WXG-T-211-S4（步 4）新增两行的实测钉值**（⛔ 不是把 `assets-spec §7.11.2/7.11.3`
        // 的纸面值 3/0 与 5/1 抄进来当断言 —— 纸面值只是**本次复算的对照物**；两行不符即红，
        // 与本文件头注的 K-051 纪律同构：以实测为准，不符如实回报，不反改判据）。
        expect(ok.out).toMatch(/\[dual-tone-13\] 命令=3 真α=0/);
        expect(ok.out).toMatch(/\[lineart-18\] 命令=5 真α=1/);
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
        // 实测钉值（WXG-T-211-S3 步 3 转正后**差分复算**重钉，⛔ 非「跑一遍把打印值抄进来」）：
        //   facetPx 7576/14641；占比序 = edge 1913px > 右刻面 mix(−0.16) 1906px（非端点不参赛）
        //   > base 1882px > lit 1875px ⇒ argmax ∈ base 同族但**不是** base。若实现滑回
        //   「最大可见面积者必须 ≡ base」的强读法（已作废），本常门会直接 FAIL。
        // 旧钉值（S2/乙口径，K-053 作废留档）：facetPx 8480，2140/2135/2105/2100 ⇒ argmax 25.2%。
        //   两值之差**唯一来源 = 孔径 0.17S→0.22S**（被孔移出统计域 904 px）：复算证据
        //   `temp/wxg-t-211-s3/c12-delta.mjs` 臂 A 逐像素复现旧值 2140/2135/2105/2100，
        //   臂 B ≡ 臂 C ⇒ 孔底换色 `base`→`pit` 对 C12 **零贡献**（统计域只计 `role:'facet'` 顶面）。
        //   份额 25.2358%→25.2508% 跨过 `toFixed(1)` 的 25.25 进位线 ⇒ 台面显示 25.2%→25.3%；
        //   近并列偏离 0.41pp 基本未变 ⇒ C12 脆弱性仍按 §12.2 已裁口径登记，⛔ 不改成阈值。
        expect(ok.code).toBe(0);
        expect(ok.out).toMatch(/^STATUS: OK$/m);
        // ① 全量分布表在场（数值上台面，不静默消解）：逐色 4 条目，非端点层显式标「不参赛」。
        for (let ci = 1; ci <= 10; ci++) {
            expect(ok.out, `colorIdx=${ci} 分布表行`).toMatch(
                new RegExp(`colorIdx=${ci} argmax=#\\w+\\(\\d+\\.\\d%\\) facetPx=\\d+/\\d+ 分布=`),
            );
        }
        // ② 近并列注记在场（ci=1 实钉值：argmax=#b1aca3 25.2% vs base #FDF6E9 24.8%）。
        //   ⚠ WXG-T-214 同步：孔径取整（⌀11.44→12）⇒ 四枚刻面各让 ~70px² 给孔 ⇒ 25.3→25.2。
        expect(ok.out).toMatch(/C12 近并列登记 \[facet-4\]：10\/10 色/);
        expect(ok.out).toMatch(/argmax=#b1aca3 25\.2% vs base #FDF6E9 24\.8%/);
        // ②′ 占比台面上的 facetPx 也是实测值（统计域尺寸变了 ⇒ 一并钉，⛔ 不只钉百分数）。
        expect(ok.out).toMatch(/colorIdx=1 argmax=#b1aca3\(25\.2%\) facetPx=7292\/14641/);
        // ③ 弱读口径下无一条 C12 判红（注记文案本身含「不滑回强读法判红」字样 ⇒ 只钉违规标记）。
        expect(ok.out).not.toContain('C12 判红');
    });

    /**
     * **三套逐风格腿（`QA §K.2 TC-STY-09`「三套逐风格跑（Q1=甲）」的步 4 侧，WXG-T-211-S4）**
     * ─────────────────────────────────────────────────────────────────
     * 逐套预期（裁定式 = argmax ∈ 本格 base 同族 {base, lit, edge, pit}，含 pit 派生）：
     *  - **`13` 双色对角**：层集只有 1 枚 `role:'facet'`（对角三角，墨 = `pit`），亮底 rect 的
     *    职能 = 底衬 ⇒ `role:'plate'` 排除出统计域（与四棱 #1 同一口径，`§7.11.2` C12 列 +
     *    `FACET4_PLATE_MIX` 注）⇒ **argmax 预期 = `pit`**，属同族 ⇒ **应过**，且必打近并列注记。
     *    ⚠ 这与 E 单 `§7.11.2` 行 1 的「最大可见面积者（≈63%）非 base」不矛盾：那是**强读法**
     *    口径，已按 `QA §K.1`（主理人 2026-09-26 转述裁定）作废，⛔ 不得据此对 `13` 判红。
     *  - **`18` 线稿描边**：#2 主体 rect = `facet`（base）+ 其上两条明暗带 ⇒ **argmax 预期 = base**
     *    （池内唯一两读法均 ✅ 者）⇒ **不应打近并列注记**。
     * 判别力构造（K-060：⛔ 单条「无注记」是缺位断言）：同一输出里 **facet-4 与 `13` 两条注记行
     * 必须在场**（正面对照），`18` 一条必不在 ⇒ 三套的注记**有无**彼此区分，不是恒真也不是恒假。
     */
    it('三套逐风格腿（步 4）：13 argmax = pit（族内⇒过+注记在场）、18 argmax = base（注记不在场）、零判红', () => {
        expect(ok.code).toBe(0);
        // 每套都真被逐色审计（10 色 × 3 套）：三套的 ci=1 认定行各自在场。
        for (const id of ['facet-4', 'dual-tone-13', 'lineart-18']) {
            const seg = ok.out.split(`[${id}] 命令=`)[1];
            expect(seg, `${id} 审计段在场`).toBeTruthy();
            expect(seg).toContain('colorIdx=1 argmax=#');
            expect(seg).toContain('colorIdx=10 argmax=#');
            expect(seg).not.toContain('∉ 本格 base 同族');
        }
        // 正面对照腿（阳性）：两套族内非 base ⇒ 注记必在（`13` 的 argmax = pit，10/10 色）。
        expect(ok.out).toMatch(/C12 近并列登记 \[dual-tone-13\]：10\/10 色/);
        expect(ok.out).toMatch(/C12 近并列登记 \[facet-4\]：10\/10 色/);
        // 缺位腿：`18` 的 argmax 即 base ⇒ 不近并列（与上方两条在场对照，本条才有判别力）。
        expect(ok.out).not.toMatch(/C12 近并列登记 \[lineart-18\]/);
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

    // 臂 D（**步 4 新增反例臂** = 本批判据改写的变异自证）：一枚被完全遮蔽的 facet ⇒ 死层硬门必红。
    // 为何需要它：本批把「facet 重叠 > 10% 即红」改写为「逐风格钉值 + 死层硬门」。
    // 若新门只是把阈值抬高一档，改写就是换个写法而无判别力增量 ⇒ 本臂的重叠量**故意做小**
    // （实测 722px = 全盘 4.9%，**低于**旧 10% 阈 1464px）：旧门放行、新门判红，
    // 且新门能**指认到层号与墨色**（旧门只报一个总量，说不出哪一层失效）。
    it('臂 D（死层反例·步 4 新门）：顶面可见像素 = 0 的 facet 被指认到层号与墨色（且重叠量在旧阈下）', () => {
        const fixtures = runPool(['--fixtures']);
        expect(fixtures.code).toBe(1);
        const line = fixtures.out.match(/C12 死层 \[fixture-dead-facet\] #\d+[^\n]*/);
        expect(line, '死层判红行存在（顶面 0 px 的 facet 未被静默放行）').toBeTruthy();
        expect(line![0]).toMatch(/#1（role=facet, fill=#\w+）：顶面可见像素 = 0/); // 指认到层号 + 墨色
        expect(line![0]).toContain('covered='); // 遮蔽了多少像素的几何事实（⛔ 不只报退出码）
        // 旧门对本臂放行的凭证（⇒ 本臂的红只能来自新门）：重叠 722px < 旧 10% 阈 1464px。
        const ov = Number(fixtures.out.match(/\[fixture-dead-facet\][^\n]*facet重叠px=(\d+)/)?.[1] ?? -1);
        expect(ov).toBeGreaterThanOrEqual(0);
        expect(ov < 0.1 * 121 * 121).toBe(true);
    });
});

/**
 * **C12 统计域自洽性哨兵的改写（WXG-T-211-S4 / 步 4）** —— 本文件唯一「判据本体被改动」处
 * ─────────────────────────────────────────────────────────────────────────────
 * 旧门：`facet` 族重叠像素 > 全盘 10% ⇒ 判红，理由 = 「重叠使占比语义失真」。
 * 前提已不成立：主体色认定走 `topLayerAt` **顶面胜出** ⇒ 每样本只计一次、占比恒归一
 * （实测 `18`：9135 + 1658 + 1623 = 12416 = facetPx，三枚占比 73.6 + 13.4 + 13.1 = 100.0%），
 * 而 `§7.11.3` 的 `18` 层集本身就是叠压式（满格主体 rect 上压两条明暗带）⇒ 旧门在新套上
 * **必然误伤**（实算 3453px = 23.6%）。两条出路只有一条合法：⛔ 为重造型过门而删掉正本
 * 的明暗带（改掉风格身份），故改为「逐风格钉值 + 死层硬门 + 未登记默认拒绝」。
 * ⛔ C12 **裁定式**（argmax ∈ base 同族）与占比表一字未改 —— 停手门只由裁定式触发。
 * 政策全文与三项设计取舍住在真源侧（`check-bead-style-pool.mjs::FACET_OVERLAP_REGISTER` 注）。
 */
describe('C12 重叠哨兵改写 · 逐风格钉值 + 死层硬门（§12.2 C12 / assets-spec §7.11.3 层集形状）', () => {
    const ok = runPool([]);

    it('腿 ①（前提失效的台面凭证）：18 重叠 3453px ≫ 旧 10% 阈值，但常门仍 OK 且占比归一', () => {
        expect(ok.code).toBe(0);
        // 旧门在这行上会判红（14641×10% = 1464 < 3453）⇒ 本条即「前提失效」的可复现登记。
        expect(ok.out).toMatch(/\[lineart-18\] 命令=5 真α=1 facet重叠px=3453/);
        // 顶面胜出实测逐层 px 钉值（= §6 差分记录的输入，K-051：实算值，⛔ 非解析推导值）。
        expect(ok.out).toMatch(/\[lineart-18\][^\n]*facet顶面px=#2:8961 #3:1592 #4:1579/);
        // 占比归一自证：三枚顶面之和 == 统计域总像素（叠压不重复计数）。
        // ⚠ WXG-T-214 同步：孔径取整（⌀ 变化）⇒ 18 的孔边缘让出像素 ⇒ 三枚顶面 px 全变。
        expect(8961 + 1592 + 1579).toBe(12132);
    });

    it('腿 ②（其余两套钉值在场 + 零死层）：facet-4 四枚、13 单枚顶面均 > 0', () => {
        // ⚠ WXG-T-214 同步：孔径取整（⌀11.44→12）⇒ 四枚刻面各让 ~70px² 给孔（1875→1805 等）。
        expect(ok.out).toMatch(/\[facet-4\][^\n]*facet重叠px=151 facet顶面px=#2:1805 #3:1811 #4:1835 #5:1841/);
        expect(ok.out).toMatch(/\[dual-tone-13\][^\n]*facet重叠px=0 facet顶面px=#2:3676/);
        expect(ok.out).not.toContain('C12 死层');
        expect(ok.out).not.toContain('C12 重叠登记缺失');
        expect(ok.out).not.toContain('C12 重叠钉值漂移');
    });

    it('腿 ③（默认拒绝，⛔ 不得默认放行）：未在 FACET_OVERLAP_REGISTER 登记的风格即红', () => {
        const fixtures = runPool(['--fixtures']);
        expect(fixtures.code).toBe(1);
        // 三支反例夹具（8cmd/5cmd/foreign-base/dead-facet）全部未登记 ⇒ 逐支指认。
        for (const id of ['fixture-8cmd-0alpha', 'fixture-5cmd-3alpha', 'fixture-c12-foreign-base', 'fixture-dead-facet']) {
            expect(fixtures.out, `${id} 未登记 ⇒ 默认拒绝`).toContain(`C12 重叠登记缺失 [${id}]`);
        }
    });

    it('腿 ④（旧口径不得复活）：脚本内不再存在「> 全盘 10%」泛阈值', () => {
        const text = readFileSync(resolve(REPO, SCRIPT), 'utf8');
        expect(text).not.toMatch(/0\.1 \* \(SAMPLE_GRID/);
        // 阳性对照（K-060：⛔ 缺位断言）：同一份文本必须仍含替代它的三道新判据名。
        expect(text).toContain('FACET_OVERLAP_REGISTER');
        expect(text).toContain('C12 死层');
    });
});

describe('TC-STY-11 · 行4 钮先行哨兵（S9 §8-19 + K.1a 阳性对照腿）', () => {
    // 腿 A（呈现门 + 阳性对照）。**WXG-T-211-S5（步 5）翻转本例**（K-053：旧文字不净删，就地留档）：
    // 旧断言（步 4 时点）= PAUSED 帧 text 图元 `not.toMatch(/珠子风格|豆子尺寸/)`，
    // 它钉的是「注册 ≥ 2 而面板无钮 = §12.9 步 5 的**计划内时序**」（S4 登记）。
    // 步 5 已落码行4 两钮 ⇒ 前提哨兵按 S9 v1.7 §8-19 收口为**反向**：注册数 ≥ 2 ⇒ 钮必 present。
    // 阳性对照腿（K-060）保留且不可删：两枚对照钮（性能信息 / 回主菜单）必须在场，
    // 否则「present」会因面板整体未渲染而假绿（历史同族缺陷）。
    it('腿 A（步 5 已翻转）：注册 ≥ 2 ⇒ PAUSED 帧两钮 present，且现档名入文案', async () => {
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

        // 翻转后的主断言：两钮字样必在。
        expect(texts.some((t) => t.includes('珠子风格'))).toBe(true);
        expect(texts.some((t) => t.includes('豆子尺寸'))).toBe(true);
        // §8-14「钮文案 = 现档显示」：默认档下必带风格名与豆径名（⛔ 不是只有标题）。
        expect(texts.some((t) => t === '珠子风格  经典四棱')).toBe(true);
        expect(texts.some((t) => t === '豆子尺寸  标准')).toBe(true);
        // 阳性对照腿（旧口径原样保留）：两枚已落码对照钮必须在场。
        expect(texts.some((t) => t.includes('性能信息'))).toBe(true);
        expect(texts.some((t) => t === '回主菜单')).toBe(true);
    });

    // 腿 B（文案静态门）：面板/overlay/风格模块**与钮文案表**不得命中「共 N 款」写死款数。
    // **WXG-T-211-S5 扩射程**：行4 钮文案自本批起同时出自 `meta-view.ts`（菜单设置 overlay）
    // 与 `tuning.ts`（`BEAD_STYLE_LABELS` / `BEAD_SIZE_LABELS` 单源）⇒ 不扩则门只盖住一半。
    // ⛔ 规则可能恒不命中而假绿 ⇒ 变异自证（注入反例可命中→撤销）见
    //   temp/wxg-t-211-b1/07-* 证据，与 S1/臂 B 变异同批；本批改射程后的重跑证据
    //   = `temp/wxg-t-211-s5/`（收工报告登记编号）。
    it('腿 B：文案源 grep「共 N 款」零命中（静态门本体）', () => {
        const sources = [
            'games/beads/src/view/view-model.ts',
            'games/beads/src/systems/pause-panel.ts',
            'games/beads/src/view/bead-styles/registry.ts',
            'games/beads/src/view/bead-styles/contract.ts',
            'games/beads/src/view/meta-view.ts',
            'games/beads/src/config/tuning.ts',
        ];
        for (const file of sources) {
            const text = readFileSync(resolve(REPO, file), 'utf8');
            expect(text, `${file} 不得写死款数文案`).not.toMatch(/共\s*\d+\s*款/);
        }
    });

    // §8-19 计数侧前提。**WXG-T-211-S4（步 4）翻转本例**（K-053：旧前提不净删，就地留档）：
    // 旧断言 = `registeredStyleIds().length ≤ 1` 且 `toEqual(['facet-4'])`，它钉的是「步 3 时点
    // 注册数仍为 1 ⇒ 钮必不呈现」这一**前提**。步 4 把 `13`/`18` 入池后该前提**如实失效** ⇒
    // 若继绩钉 ≤ 1，等于禁止入池（与 §12.9 步 4 本身相突）。改钉两件事：
    //  ① 注册数 ≥ 2（入池事实）与**注册序 = `§12.6` 池序**（表行序剔除已移出的 16/19）；
    //  ② 注册数 ≥ 2 且默认档不飘。**步 4 当时另钉的「面板仍无钮 = 计划内时序」后半句已随
    //     EP11-S5（行4 两钮落码）收口** ⇒ 该句现由上方腿 A 的反向断言接管（present）。
    it('前提哨兵（步 4 已翻转）：注册数 ≥ 2 且序 = §12.6 池序；「面板无钮」已随步 5 收口（腿 A 断）', async () => {
        const registry = await import('../src/view/bead-styles/registry.js');
        const ids = registry.registeredStyleIds();
        expect(ids.length).toBeGreaterThanOrEqual(2);
        // 序真源 = `bead-visual-style-spec §12.6` 入选池表行序（16/19 已移出）：四棱 → 18 → 13。
        expect(ids).toEqual(['facet-4', 'lineart-18', 'dual-tone-13']);
        // 默认档不得随入池飘移（直引 facet-4 ⇒ 盘面与 seal 基准不受本批影响）。
        expect(registry.DEFAULT_BEAD_STYLE_ID).toBe('facet-4');
    });
});

/**
 * **C4 裸系数扫描·风格模块静态门**（`§12.2 C4` / `assets-spec §7.12`）
 * ────────────────────────────────────────────────
 * 本判据 = `tuning.ts` §7.12 清算表与 `facet-4.ts` 文件头所声称的**那个机械锚本体**
 * （WXG-T-211-S3 补齐：上一批只在文档里写了「机械锚 = 本文件的 C4 扫描判据」而**判据不存在**
 *  ⇒ 属 K-060「文档声称有门、实际无门」的同族，不得再犯）。
 *
 * 射程：`src/view/bead-styles/` 下**全部**风格模块（扫目录而非写死文件名 ⇒ 步 4 的 `13`/`18`
 * 落码即自动受门）；⛔ 不得以「反正没新 hex」（C3）放行系数越界（`§7.12` 原句）。
 *
 * ⚠ **先剔注释再扫**：本仓风格模块的注释里**大量**出现 `0.17S`/`−0.34` 等历史口径值
 *   （作档案用）⇒ 不剔则必假红；剔法 = 去块注释与行注释两种。该剔法不解析字符串，
 *   故**理论上可被字符串字面量绕过** ⇒ 诚实登记为限制，不冒充完整 AST 门。
 * ⚠ **豁免名单**：`legacy-ten.ts` = 十层**逐字封箱**件（改动即对照失真，§K.5.1 ④）；
 *   其裸系数属旧基线档案，淘汰归 S7 回评后的删除批，⛔ 不顺手洗成“合规”。
 * ⚠ **变异自证（K-060）**：向 `facet-4.ts` 注一枚真码裸系数（`mix(e.base, -0.16)`）
 *   ⇒ 本条必红；证据 = `temp/wxg-t-211-s3/16-c4-mutation.txt`。
 */
describe('C4 裸系数扫描 · 风格模块静态门（§12.2 C4 / assets-spec §7.12 机械锚）', () => {
    const STYLE_DIR_REL = 'games/beads/src/view/bead-styles';
    const EXEMPT = new Set(['legacy-ten.ts']);
    const stripComments = (text: string): string =>
        text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    const RULES: ReadonlyArray<readonly [RegExp, string]> = [
        [/\bmix\(\s*[^,()]+\s*,\s*-?\d[^,()]*\)/g, 'mix(<色>, <字面量>) ⇒ 系数必须住 tuning 命名常量'],
        [/[*\/]\s*0?\.\d+\b/g, '几何比率字面量（孔径/内缩/半径等）⇒ 必须引 BEAD_CARD / tuning 常量'],
    ];

    it('风格模块零裸系数（mix 第二参 + 比率字面量；剔注释后扫）', () => {
        const files = readdirSync(resolve(REPO, STYLE_DIR_REL)).filter(
            (f) => f.endsWith('.ts') && !EXEMPT.has(f),
        );
        // 阳性对照腿（K-060）：目录非空且**确实扫到了 facet-4**，否则「零命中」只是没开门。
        expect(files).toContain('facet-4.ts');
        const hits: string[] = [];
        for (const f of files) {
            const code = stripComments(readFileSync(resolve(REPO, STYLE_DIR_REL, f), 'utf8'));
            for (const [re, why] of RULES) {
                for (const m of code.matchAll(new RegExp(re.source, 'g'))) {
                    hits.push(`${STYLE_DIR_REL}/${f}: ${JSON.stringify(m[0])} —— ${why}`);
                }
            }
        }
        expect(hits, 'C4 越界裸系数清单（非空即停手，⛔ 不得改判据求绿）').toEqual([]);
    });

    it('豁免名单只能缩小射程 ⇒ 豁免项必须逐字封箱件且自带封箱注记', () => {
        for (const f of EXEMPT) {
            const text = readFileSync(resolve(REPO, STYLE_DIR_REL, f), 'utf8');
            expect(text, `${f} 声称豁免但未带封箱注记 ⇒ 不得静默扩豁免`)
                .toMatch(/封箱对照臂|逐字搬家/);
        }
    });
});

/**
 * **C2 零分配机械锚·`beadLayers` 返回复用槽**（`§12.2 C2` / ADR-0024 值语义）
 * ────────────────────────────────────────────────
 * 本判据 = `contract.ts:119` 与 `bead-render.ts:372` 所声称的**那个锚本体**
 * （两处均写「`tests/bead-style-pool.test.ts` 钉住两次调用返回同一实例」，
 *   而 WXG-T-211-S3 开工核门时该判据**不存在** ⇒ 与上方 C4 同一属：文档声称有门、实际无门，
 *   K-060 同族 ⇒ 本批一并补建。
 *   **变异自证（K-060）**：M-C `return LAYERS.slice()` → 腿① 判红；M-D `endpointOf(inks, 1)`
 *   → 腿① 先过后腿② 判红；证据 = `temp/wxg-t-211-s3/17-c2-mutation.txt`。
 *
 * 两腿各钉一个不同的退形：
 *  ① **数组/层对象/顶点元组实例同一** ⇒ 钉住「每次新建」（`.slice()` / `map()` / 展开）；
 *  ② **值真的重算**（换 `colorIdx` 后墨色变）⇒ 钉住「返回冻结常量或 memo 缓存」的空转实现。
 * ③ 是**被①∧②蕴含的后果展示**（⇒ 无独立判别力，不冒充第三道门）：把契约的硬后果
 *    「⛔ 不得跨调用持有 ⇒ 测试留档必先深拷贝」当可读文档钉在测试里，防后来者误用。
 * ⚠ 若将来改成「按入参缓存」的实现，腿② 亦红 ⇒ 那是把零分配换成随入参增长的一次性分配，
 *   需另立 ADR 才准改本判据（⛔ 不得为了变绿而改判据，`§11.3`）。
 */
describe('C2 零分配机械锚 · beadLayers 返回复用槽（§12.2 C2 / ADR-0024）', () => {
    it('腿①②：同一数组实例与层对象与 points 元组 + 换色必重算（腿③ = 后果展示，无独立判别力）', async () => {
        const { DEFAULT_BEAD_STYLE } = await import('../src/view/bead-styles/registry.js');
        const { DEMO_BEAD_INKS } = await import('../src/view/palette.js');
        const { BEAD_CELL } = await import('../src/config/tuning.js');
        const layerFill = (l: unknown): string => (l as { fill: string }).fill;
        const layerPoints = (l: unknown): readonly number[] =>
            (l as { points: readonly number[] }).points;

        const a = DEFAULT_BEAD_STYLE.beadLayers({
            inks: DEMO_BEAD_INKS, colorIdx: 1, targetColorIdx: undefined, size: BEAD_CELL,
        });
        // 留档必先深拷贝（契约字面）——否则下面比不了「上一次调用的值」。
        const snapshot = a.map((l) => layerFill(l));
        const pointsRef = layerPoints(a[1]);

        const b = DEFAULT_BEAD_STYLE.beadLayers({
            inks: DEMO_BEAD_INKS, colorIdx: 5, targetColorIdx: undefined, size: BEAD_CELL,
        });

        // 腿① 零分配：数组/层对象/顶点元组均为同一实例。
        expect(b).toBe(a);
        expect(b[1]).toBe(a[1]);
        expect(layerPoints(b[1])).toBe(pointsRef);
        // 腿② 值真重算（⛔ 不是同一冻结常量的两个名字）。
        expect(layerFill(b[2])).not.toBe(snapshot[2]);
        // 腿③ 后果展示（被①∧② 蕴含 ⇒ 不单独主张判别力）：`a` 自己的字段已被第二次调用改掉。
        expect(layerFill(a[2])).not.toBe(snapshot[2]);
    });

    /**
     * **步 4 扩展射程**：上方两腿原本只测 `DEFAULT_BEAD_STYLE`（四棱）⇒ `13`/`18` 入池后
     * 「热路径零分配」（§2 / L3 / ADR-0024）只对**一支**成立。本腿把**同一对判据**逐套跑：
     * ⛔ 不另起口径（口径真源 = 上方腿），⛔ 不因为「新模块照着 facet-4 抄的」就免检。
     * ⚑ 不钉具体层号（四棱腿已钉）：本腿只钉「数组/层对象/polygon 顶点元组三类实例」
     *    与「换色后至少一层墨色重算」⇒ 对新套的几何改动不脆，但仍能抓两类退形。
     */
    it('腿①②对全部注册风格成立（步 4：13/18 同样走复用槽）', async () => {
        const registry = await import('../src/view/bead-styles/registry.js');
        const { DEMO_BEAD_INKS } = await import('../src/view/palette.js');
        const { BEAD_CELL } = await import('../src/config/tuning.js');
        const styles = registry.registeredStyles();
        expect(styles.length).toBeGreaterThanOrEqual(3); // 阳性对照：射程确实不止四棱一支
        for (const style of styles) {
            const a = style.beadLayers({ inks: DEMO_BEAD_INKS, colorIdx: 1, targetColorIdx: 2, size: BEAD_CELL });
            const fillsA = a.map((l) => (l as { fill: string }).fill);
            const refs = a.slice();
            const b = style.beadLayers({ inks: DEMO_BEAD_INKS, colorIdx: 5, targetColorIdx: 6, size: BEAD_CELL });
            // 腿①：数组本体 + 每层对象 + polygon 顶点元组均为同一实例（=0 分配）。
            expect(b, `${style.id} 腿① 数组实例同一`).toBe(a);
            for (let i = 0; i < refs.length; i++) {
                expect(b[i], `${style.id} 腿① 层 #${i + 1} 实例同一`).toBe(refs[i]);
                if ((b[i] as { points?: unknown }).points !== undefined) {
                    expect(
                        (b[i] as { points: unknown }).points,
                        `${style.id} 腿① 层 #${i + 1} points 元组同一`,
                    ).toBe((refs[i] as { points: unknown }).points);
                }
            }
            // 腿②：换色后确有重算（全层墨色不变 = 冻结常量/缓存空转 ⇒ 红）。
            const changed = b.filter((l, i) => (l as { fill: string }).fill !== fillsA[i]).length;
            expect(changed, `${style.id} 腿② 换色后至少一层重算`).toBeGreaterThan(0);
        }
    });
});
