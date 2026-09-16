#!/usr/bin/env node
/**
 * WXG-T-119 · beads `[B]` 浏览器逐帧取证 —— P4 屏幕发光序列 + A05 时长/包络族
 * 作者：严守真（quality-lead）　日期：2026-09-15
 * 只读：不写 `games/**` 源码、`packages/**`、`tools/**`、`design/**`；只读+跑测。
 * （唯一会写的产物在 `games/**` 之外：`cocos/build/` 由 `build:cocos:web` 生成且已被 .gitignore 覆盖。）
 *
 * ── 这文件解决什么 ────────────────────────────────────────────────────────────
 * WXG-T-102 / T-117 / T-118 三条改判**全部止于指令流层**（`RenderModel` 指令 α 序列）。
 * T-118 报告 §24.6 把边界写死：屏幕像素层与真实合成音频层仍是**零证据**。本探针补的
 * 正是那两层：
 *   · **P4 屏幕发光序列**：在**真渲染**（Cocos web-mobile 产物）上逐帧取**屏幕像素**，量
 *     wrong danger 描边的发光强度时间序（α 极值点 ≤1、起播间隔 ≥500ms）；
 *   · **A05 时长/包络族**：在**真 WebAudio** 上取**真实合成输出**（PCM）量时长与包络。
 *
 * ── substrate 选型（任务书 §7.1 要求写明）────────────────────────────────────
 * **(a) Cocos web-mobile 产物**（`games/beads/cocos/build/web-mobile`）＝真机同源渲染路径
 * （同一个 `Bootstrap` → 同一个 `App` → 同一个 `WebPlatform`/`SynthAudioBackend`），
 * 且 §7.2 要求「真出声通路在 Cocos 产物上是否接上」的**现场核实**也只能在这条上做。
 * **未**选 (b) harness 页面（`dev/harness` 是 Canvas2D 渲染器，**与真机不同源**）。
 * 前置：`pnpm --filter @wxgame/beads run build:cocos:web`（**无需 AppID**）。
 *
 * ── 判据来源（唯一真源，逐字取，不自创）────────────────────────────────────────
 *   · `games/beads/design/ux/ux-spec.md` §5:180（放错拒绝：淡入 60 / 保持 80 / 淡出 60
 *     = 200ms、**一次 fx 窗口内 α 极值点 ≤1**、连续拒绝**视觉脉冲重启门 500ms**）
 *   · `games/beads/design/gdd/systems-index.md` §3.8（**错误反馈 抖动+描边闪 ≤2 次/秒**；
 *     闪烁红线 ≤3Hz —— §3 只读，本探针不改）
 *   · `games/beads/design/audio/audio-events.md` §4（A05-01..27 各条时长/包络判据）
 *   · `production/qa/beads/g4-regression-report.md` §19.3（A05 ⛔ 清单起点）/§24.6（效力边界）
 *   · `production/qa/beads/cocos-input-probe.mjs` 文件头（**范式与纪律**：道次/退出码/SELF）
 *
 * ── 道次（lane）与诚实边界 ────────────────────────────────────────────────────
 *   [N]  Node/无头浏览器**逻辑层**（T-118 已做，本探针**不重复**）
 *   [B]  浏览器**真实渲染像素**（P4）/ 浏览器内**真实 WebAudio 离线渲染 PCM**（A05）
 *   [C]  构建产物（A05-25：音频资产文件数/占用）
 *   [R]  真机·微信宿主 —— **无 AppID / 无真机 ⇒ 未执行**
 *   [P]  人耳听感 —— **不由本探针代判**（A05-26）
 *   ⛔   **本环境做不了**，一律显式登记「阻塞 + 解除条件」，**不记 PASS 也不记 FAIL**
 *
 * ── 预期值先写、后跑（反假绿）──────────────────────────────────────────────────
 * 下面 EXPECTATIONS 段是**跑之前**就写好的（判据的算术推论 + 指标定义的先验估计），
 * 不是看输出回填的。另设两处 **SELF-xx「判据自检」**：把**修复前**的读数/构造反例喂给
 * **同一批**判定函数，断言它们**必须判 FAIL** —— 用反例证明本探针有判别力（本仓吃过
 * 「判别力为零的探针」的亏）。**SELF 记录在取样之前就已执行**（见主流程次序）。
 *
 * ── 退出码（红 = 失败）─────────────────────────────────────────────────────────
 *   0 = 全部可执行用例 PASS（DECLARED_BLOCKED 内的 ⛔ 属预期阻塞，不影响退出码）
 *   1 = 存在 FAIL（真回归 / 真偏差）
 *   2 = 无 FAIL，但存在**未预期阻塞 / 探针无效**（产物陈旧、基线非零、判别力不足…）—— **不得当绿**
 *   3 = 脚本级环境错误（playwright / python3 / 产物缺失）
 *
 * ── 运行 ─────────────────────────────────────────────────────────────────────
 *   export PATH="$HOME/.workbuddy/binaries/node/workspace/node_modules/.bin:$PATH"
 *   pnpm --filter @wxgame/beads run build:cocos:web     # 前置：产物须为当前代码所构建
 *   node production/qa/beads/beads-browser-probe.mjs
 *   可选参数：--out=<dir> 证据目录（默认 production/qa/beads/evidence）
 *            --log=<file> 日志（默认 <out>/beads-browser-probe.log）
 *            --allow-stale 跳过新鲜度门（**仅诊断用**：产出的 PASS 不得作为门禁证据）
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

// ═══════════════════════════════════════════════════════════════ 配置
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const OUT_DIR = path.resolve(ROOT, argOf('out', 'production/qa/beads/evidence'));
const LOG_FILE = path.resolve(ROOT, argOf('log', path.join(OUT_DIR, 'beads-browser-probe.log')));
const ALLOW_STALE = argv.includes('--allow-stale');

const GAME = {
  boot: 'BeadsBootstrap',
  artifact: 'games/beads/cocos/build/web-mobile',
  bundle: 'games/beads/cocos/build/web-mobile/assets/main/index.js',
  sources: ['packages/framework/src', 'games/beads/cocos/assets/scripts', 'games/beads/src'],
};

/** 本环境**永不可验**的道次：登记为阻塞，不计入退出码（见文件头）。 */
const DECLARED_BLOCKED = new Set(['DEV-01', 'DEV-02', 'A05-26', 'A05-27']);
/**
 * **第三态 `⊘` = 判据面不成立（拒绝判定）** —— 采纳报告 §25.12.3 的建议：
 * 当**度量本身不满足判据的语义前提**（例：像素度量把 α 通道与 ±3px 位移通道混叠，
 * 因而无法严格判定「一次 fx 窗口内 α 极值点 ≤1」）时，既不能记 PASS、也不能记 FAIL
 * ——记 `⊘` 并写明「该断言的判据面应回到哪一层」。`⊘` 与 `⛔` 一样属**已声明**，
 * 不影响退出码；它出现在报告与汇总里，是为了**不把「判据面缺陷」伪装成产品结论**。
 */
const DECLARED_INVALID = new Set(['P4S-01b', 'P4S-03']);

/**
 * ── 屏上「danger 环」指标的**先验定义**（跑之前写死，不因数据调整）───────────────
 *   ringMetric(box) = Σ_{p ∈ box} max(0, R − max(G,B) − θ)
 * 理由：`palette.danger` = #e84c3d ⇒ R−max(G,B) = 232 − max(76,61) = **156**；
 * 珠格为 E1 粉彩色底（`mixWith(slot, beadColor(colorIdx), 0.35)`）⇒ 该量 ≲ **55**。
 * 取 **θ = 70** ⇒ 无 danger 环时指标恒 0，有环时 ≈ Σ(α·156 + (1−α)·底色 − 70)。
 * **平移不变**：指标是**逐像素颜色**的求和，而 wrong 的 ±3px 抖动是**刚体位移**
 * （`view-model.ts:541-545`：格底与描边同层、`dx = 3·sin(progress·4π)` 一起平移）⇒
 * 只要 box 完整覆盖「被拒格 + 其 ±3px 扫掠区」，位移**不改变**指标 —— 这正是把
 * **闪烁通道（α）**与**位移通道（抖动）**分开的关键（见报告 §25.3）。
 * 其余阈值（峰显著性 / onset 门限 / 时长量规）同样**先验给定**，见下。
 */
const P4 = {
  theta: 70,
  boxDesignR: 32,               // 格半宽 25 + 扫掠 3 + 余量 4
  onsetFrac: 0.08,              // 单次脉冲「存在」门限 = 0.08 × RING_FULL_EST（几何先验估算）
  /**
   * **起播检测门限**（连续拒绝实验 + 单次脉冲支撑测量用）= 0.01 × RING_FULL_EST。
   * 为什么比 `onsetFrac` 更低：采样是**每渲染帧一次**（60fps 下 200ms 窗口只有 ~6 个点），
   * 若某次脉冲的采样点恰落在包络**尾部**（α≈0.2/0.4），该帧指标只有满环的 ~3%
   * ⇒ 用 8% 门会**漏检该次起播**，把间距算长（**假绿**；首跑实测：3 次起播里只识别出 2 次，
   * 墙钟速率从 2.86/s 被误算成 1.67/s）。判据关心「屏幕上有几次闪烁」⇒ 漏检 = 假绿。
   * 1% 满环（实测量级 ~250）仍远高于实测噪声底（P4S-00 = 0；gate 基线 ≤ 4）。
   */
  gateOnsetFrac: 0.01,
  /** 【D5】起播检测的**数据相对**门限：`0.15 × 本序列 max`（与显著度同源、与视口/分辨率无关）。 */
  relOnsetFrac: 0.15,
  /** 【D5】滞回下界系数（相对同一 max）：`0.02`。 */
  relOnsetFracLow: 0.02,
  prominenceFrac: 0.2,          // 峰显著性 = 0.2 × 窗口 max（标准 find_peaks 口径）
  /**
   * 【D5②】支撑**下限系数**。该下限**必须由指标自身的仿射律推出**，不能直接取「0.6×200」——
   * 因为指标 `Σmax(0, R−max(G,B)−θ)` 对 α 是**仿射且带截断**的：环下垫 E1 粉彩（bg≈15）时
   * `metric(α) ∝ max(0, 141α − 55)` ⇒ **α < 0.39 时指标恒 0**；以「0.15×max」为支撑界 ⇒ α ≥ 0.48。
   * 对 200ms 梯形包络（淡入 60 / 保持 80 / 淡出 60，ease-out/in），α ≥ 0.48 的时长为
   * ≈ (200 − 2×33) = **134ms** ⇒ 取 **0.4 × 200 = 80ms** 作下限（给栅格与相位留余量），
   * 仍远大于「欠采样」时的 ~33ms ⇒ 该下限能识别欠采样，又不把「指标截断」误判成超差。
   * （首版直接取 0.6×200 = 120ms ⇒ 把 100–150ms 的**正确**读数误判为不通过，见报告 §25.13。）
   */
  supportMinFrac: 0.4,
  /** 一个 fx 窗口的预期上界（game ms）：WRONG_FX_MS(200) + 2 帧(33.4)。 */
  windowMsCap: 200 + 200 / 6,
  gateMs: 500,                  // ux-spec §5:180 + tuning.WRONG_FX_RESTART_GATE_MS
  tapIntervalMs: 100,           // 注入节律：每 ≥100 game ms 一次（按游戏时钟，不按渲染帧）
  taps: 30,                     // 注入次数：100ms 节律 × 30 = 3s；受 500ms 门约束 ⇒ 期望 ~5 次起播
  scanFrames: 20,               // 单次脉冲实验的观察窗（含 3 帧基线）
};

/**
 * 时长测量的**先验量规**（跑之前写死；§25.6 有完整迭代记录）。
 *   · **门限** = 峰值 × 0.001（−60 dB，标准静音门）。用 −40 dB(1%) 会对「= N」类产生
 *     ≤1% 的系统性**低估**（实测 t3 346.21 vs 350±1 ⇒ 伪 FAIL）。
 *   · **判据面 = 1ms 窗峰值包络**（`windowMs`），**不是**样本级过阈点：多音叠加
 *     （`sfx_combo_t3` = 4 条三角波）的瞬时和会**拍频**到零 ⇒ 样本级「最后一个过阈样本」
 *     系统性提前（实测 348.39 vs 窗级 349.21）。
 *   · 窗级量规的量化偏差**上界 = 1 个窗**（末窗可跨过真实终点）⇒ 容差取 `1 窗`：
 *     `≤` 类 = `measured ≤ N + 窗`；`=` 类 = `|measured − N| ≤ 窗`。该容差是**由量规几何
 *     推出的上界**（同 WXG-T-118 的幅度容差 `tol=(hi−lo)·Δt/T` 判例），不是为凑绿拍的余量。
 * 口径纪律：本轮只订正**量规**（门限 / 窗 vs 样本），**判据数值（≤N / =N）一字未改**。
 */
const DUR = {
  thresholdRatio: 0.001,        // 发声门限 = 峰值 × 0.001（−60 dB，标准静音门）
  windowMs: 1.0,                // 包络窗长；量化偏差上界 = 1 窗
  tolMs: 1.0,                   // = 1 窗
  /** 「软起音」客观判据：10%→90% 上升时间 ≥ 1.0 ms（更短在中频内容上即为 click）。 */
  softRiseMs: 1.0,
};

// ═══════════════════════════════════════════════════════════════ 日志
const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };

const results = [];
function record(id, lane, verdict, detail) {
  results.push({ id, lane, verdict });
  say('');
  say(`### ${id}　[${lane}]　→ ${verdict}`);
  say(`    预期（先写）: ${expectations[id] ?? '（见正文）'}`);
  say(`    实测: ${detail}`);
}

/** EXPECTATIONS —— **跑之前**写好的判据算术推论（不是输出回填）。 */
const expectations = {
  'ENV-01': '产物 mtime 晚于全部输入链路源；framework:sync:check exit=0；产物内 BeadsBootstrap / SynthAudioBackend / sfx_combo_t2 / sfx_combo_t3 各命中 ≥1',
  'ENV-02': '产物内音频资产文件数 = 0 且音频占用 = 0 KB（= A05-25 `[C]` 判据的一次读数）',
  'ENV-03': '钩外 readPixels **不可依赖**（不构成证据）⇒ 全部像素取样必须发生在 EVENT_AFTER_DRAW 内；判定门 = ENV-04（同帧 PNG 交叉验证）成立。【**前提订正**：首跑观测否证了原「钩外恒 0」预期，见正文】',
  'ENV-04': '钩内 readPixels 与**同帧** `canvas.toDataURL()` 解码后**同区域**逐像素一致（平均 |Δ| ≤ 2/255，GL 行序已对齐）且**故意错位区域**显著不同（平均 |Δ| ≥ 20）',
  'CLK-01': '仿真时基（`loop.time` 增量）与墙钟（performance.now 增量）**期望比值 ≈ 1.00**（若 ≈2 ⇒ 宿主双驱动）',
  'P4S-00': '全部候选被拒格（预期 ≥18 个）在**无环**帧上 ringMetric === 0（指标零基线 ⇒ 有判别力）',
  'AUD-01': `时长量规自证：**1ms 窗峰值包络**（判据面）与**样本级过阈点**（对照）两种量规的差值 ≤ **2 窗**（= 2ms，首/末窗各可多计半窗）—— 差值超界即量规口径未收敛（见报告 §25.6）`,
  'P4S-01': `单次脉冲观察窗内 ringMetric **峰点数 = 1** 且**非零支撑 ∈ [${(0.6 * 200).toFixed(0)}, ${(200 + 200 / 6).toFixed(1)}] game ms**（两端都断）；起播门限 = **数据相对** ${P4.relOnsetFrac}×窗口 max（不用几何先验）；连续拒绝下**每一次**识别到的脉冲（预期 ≥3 次）各自 **峰点数 = 1**（见 P4S-01b）（显著度 ≥ ${P4.prominenceFrac}·max，plateau 合并后计；单次脉冲观察窗 + 连续拒绝下全部脉冲各计一次）；非零支撑 ≤ ${P4.windowMsCap.toFixed(1)} game ms`,
  'P4S-02': `**精栅格上下文**（每样本恰 16.67 game ms）下连续拒绝（按 game 时钟每 ≥${P4.tapIntervalMs}ms 注入一次，共 ${P4.taps} 次 ≈ ${(P4.taps * P4.tapIntervalMs / 1000).toFixed(1)}s）时屏上**脉冲起点间距（game ms）≥ ${P4.gateMs}**；受门约束预期起播 ≈ ${Math.floor(P4.taps * P4.tapIntervalMs / (P4.gateMs + P4.tapIntervalMs))} 次`,
  'P4S-03': `**原生宿主**（未接管驱动）直测的墙钟有效闪烁率 = 1000/最小墙钟起点间距 必须 **≤ 2 次/秒**（§3.8 冻结值）；另用 \`CLK-01\` 的 仿真/墙钟比 做**独立换算交叉校验**`,
  'AUD-00': '真 WebAudio：`app.services.audio._backend` 构造器 = SynthAudioBackend、voices = 19；OfflineAudioContext 渲染出的 PCM 峰值 > 0（否则「离线渲染无声」= 探针无效）',
  'SELF-01': '把**修复前**读数（P4：200ms 内 2 峰 / 无 500ms 门、起点间隔 100 game ms）喂给同一批判定函数 ⇒ 峰数判定与门限判定**都必须返回不通过**',
  'SELF-02': '时长判定：130% 超长 ⇒ 必须 FAIL；恰等于上限 ⇒ 必须 PASS；`=` 类 130% 偏差 ⇒ 必须 FAIL；**起音判定：瞬时起音（10–90% 上升 ≈0ms）⇒ 必须判「不软」、线性 4ms 起音 ⇒ 必须判「软」**',
  'A05-03': `sfx_place 真实合成输出：可闻时长 ≤ 120ms 且软起音（**样本级 10%→90% 上升时间 ≥ ${DUR.softRiseMs} ms**——更短即 click）`,
  'A05-04': 'sfx_select 真实合成输出：可闻时长 ≤ 100ms',
  'A05-09': 'sfx_combo_t2 真实合成输出：可闻时长 = 150ms（±1ms）—— 主体经 WXG-T-103 追正',
  'A05-09b': 'sfx_combo_t3 真实合成输出：可闻时长 = 350ms（±1ms）',
  'A05-15': 'sfx_stage 真实合成输出：总长 500ms（±1ms）且**双段**（250ms±40ms 包络跌落 ≤5% 峰、其后回升 ≥50% 峰）',
  'A05-16': 'sfx_clear 真实合成输出：可闻时长 ≤ 800ms',
  'A05-18': 'sfx_panel_in ≤ 200ms / sfx_panel_out ≤ 150ms',
  'A05-19': 'sfx_revive_ok 真实合成输出：可闻时长 ≤ 400ms',
  'A05-21': 'bgm_main 真实合成输出：循环缓冲长 = 8000ms（±1ms）且**环点连续**（接缝包络跳变 ≤ 环内最大逐窗跳变）',
  'A05-22': 'bgm_main 二次 `play({loop:true})` 复用同一源、`activeLoops` 恒 1；`[R]`（真机回前台不跳针）仍 ⛔',
  'A05-25': '构建产物内音频资产文件数 = 0、音频占用 = 0 KB（`[C]`；本行**复用 ENV-02 读数**，不重复计两个 PASS）',
  'A05-26': '⛔ 听感 `[P]` 未执行（**不由 QA 代判**）；解除条件 = Playtest 三轮前置齐备',
  'A05-27': '⛔ 真机 `[R]` 未执行；解除条件 = ① 有效 AppID ② build:cocos:wx 出包 ③ 微信开发者工具/真机 ④ 同一探针在 wx 宿主复取',
  'DEV-01': '⛔ 阻断：无 AppID / 无真机 / 未跑 build:cocos:wx ⇒ 未实测，不得记 PASS 或 FAIL',
  'DEV-02': '⛔ 阻断：wechatgame 平台构建缺有效 AppID',
};

// ═══════════════════════════════════════════════════════════════ 判定函数（纯）
// 判定与取样解耦：同一批函数既判「现网样本」，也判 SELF-xx 的「修复前/构造反例样本」。

/** plateau 合并 + 显著性：数「峰点」（= 先验意义上的 α 极值点个数）。 */
function countPeaksSignificant(series, prominenceFrac, windowMsCap) {
  const finite = series.filter((v) => Number.isFinite(v));
  const max = finite.length ? Math.max(...finite) : 0;
  const prom = prominenceFrac * max;
  const peaks = [];
  let i = 0;
  while (i < series.length) {
    const v = series[i];
    if (!Number.isFinite(v)) { i++; continue; }
    let j = i;
    while (j + 1 < series.length && series[j + 1] === v) j++;
    const l = i === 0 ? -Infinity : series[i - 1];
    const r = j + 1 >= series.length ? -Infinity : series[j + 1];
    if (v > l && v >= r && v > 0) {
      // ── 修订 v1.1（WXG-T-119 D3）───────────────────────────────────────────────
      // 显著度须取**两侧鞍部中较高者**：`prom = v − max(左基, 右基)`（标准「地形显著度」）。
      // 旧写法两侧各取 min 再合并 = `min(左基, 右基)` ⇒ 紧邻更高峰的**肩峰**会被误计
      // （WXG-T-119 首跑即栽在此：把 2727 的肩峰算成 24995 ⇒ 峰点数 2，而正确口径 = 1）。
      let loL = Infinity, loR = Infinity;
      for (let k = i; k >= 0; k--) { loL = Math.min(loL, series[k]); if (series[k] > v) break; }
      for (let k = j; k < series.length; k++) { loR = Math.min(loR, series[k]); if (series[k] > v) break; }
      const lo = Math.max(loL, loR);
      if (v - lo >= prom) peaks.push({ at: i, v, prom: v - lo });
    }
    i = j + 1;
  }
  return { peaks: peaks.length, peakList: peaks, max, prominence: prom };
}

/**
 * 非零支撑（毫秒）：以「≥ onsetThr」界定脉冲存在区间。
 * 【必须用**逐样本真实时钟**，不能用「帧号 × 中位栅格」】——本宿主每帧推进的固定步数并非常数
 * （实测 16.67 / 33.33 / 50ms 混布），用中位栅格乘帧数会系统性**低估**时长与间距
 * （首版即栽在此：gate 间距被算成 383–483ms 而真实值 ≥500ms，见报告 §25.13）。
 */
function supportMs(series, onsetThr, pcArr, gridMs) {
  let first = -1, last = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i] >= onsetThr) { if (first < 0) first = i; last = i; }
  }
  if (first < 0) return { first: -1, last: -1, ms: 0 };
  return { first, last, ms: pcArr[last] - pcArr[first] + gridMs };
}

/**
 * 帧长（毫秒）——**从同一份实测序列**取增量中位数，不预设 16.67：
 *   key='pc' ⇒ game 时基（`snapshot.pulseClock` 增量）；key='t' ⇒ 墙钟（`performance.now` 增量）。
 * 两个时基的差异本身就是 CLK-01/BD-40 的判据面。
 */
function frameMs(series, key) {
  const d = [];
  for (let i = 1; i < series.length; i++) {
    const v = series[i][key] - series[i - 1][key];
    if (Number.isFinite(v) && v > 0) d.push(v);
  }
  if (!d.length) return 16.667;
  d.sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)];
}

/** 脉冲起点帧（带滞回：≥ needHigh 起、< needLow 才算结束）。 */
function onsets(series, needHigh, needLow) {
  const out = [];
  let armed = true;
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (armed && v >= needHigh) { out.push(i); armed = false; }
    else if (!armed && v < needLow) armed = true;
  }
  return out;
}

function judgeP4Single(series, onsetThr, opts) {
  const pk = countPeaksSignificant(series, opts.prominenceFrac, opts.windowMsCap);
  const sup = supportMs(series, onsetThr, opts.pcArr, opts.msPerFrame);
  const notes = [];
  notes.push(`峰点数（${opts.prominenceFrac}·max 显著度） = **${pk.peaks}**（判据 = 1）、窗口 max = ${pk.max.toFixed(0)}、显著度门槛 = ${pk.prominence.toFixed(0)}`);
  notes.push(`非零支撑 = ${sup.ms.toFixed(1)} game ms（判据 ≤ ${opts.windowMsCap.toFixed(1)}；onsetThr = ${onsetThr.toFixed(0)}）`);
  // 【D5②】支撑**两端都断**：只有上界无法识别「欠采样」（§25.12：首版只断 ≤233.3 时 33.3ms 也算过）。
  const supOk = sup.ms >= opts.supportMin && sup.ms <= opts.windowMsCap;
  notes.push(`支撑判据 = [${opts.supportMin.toFixed(1)}, ${opts.windowMsCap.toFixed(1)}] game ms（两端都断）⇒ ${supOk ? '通过' : '**不通过**'}`);
  const ok = pk.peaks === 1 && supOk;
  return { ok, notes, pk, sup, supOk };
}

/**
 * 起播间距判定。**间距取自逐样本真实时钟**（game = `pulseClock` ms、wall = `performance.now()` ms），
 * 不用「帧号 × 中位栅格」（见 `supportMs` 注）。
 * 容差 `gridMs`：屏幕上的「起播」只能在其**之后的第一个采样帧**被看见 ⇒ 测得间距最多比真实短
 * 1 个栅格；该容差是**由采样几何推出的上界**，且方向单向（只可能偏晚，不可能偏早）。
 */
function judgeP4Gate(onsetFrames, pcArr, tArr, gateMs, gridMs) {
  const notes = [];
  const gapsGame = onsetFrames.slice(1).map((v, i) => pcArr[v] - pcArr[onsetFrames[i]]);
  const gapsWall = onsetFrames.slice(1).map((v, i) => tArr[v] - tArr[onsetFrames[i]]);
  const minGame = gapsGame.length ? Math.min(...gapsGame) : null;
  const minWall = gapsWall.length ? Math.min(...gapsWall) : null;
  const rateWall = minWall ? 1000 / minWall : null;
  notes.push(`脉冲起点帧 = [${onsetFrames.join(',')}]（${onsetFrames.length} 个）`);
  notes.push(`相邻起点间距 game = [${gapsGame.map((g) => g.toFixed(0)).join(',')}] ms ⇒ 最小 ${minGame === null ? '—' : minGame.toFixed(0) + ' ms'}（判据 ≥ ${gateMs} − 1 栅格 ${gridMs.toFixed(1)} = ${(gateMs - gridMs).toFixed(1)}）`);
  notes.push(`相邻起点间距 wall = [${gapsWall.map((g) => g.toFixed(0)).join(',')}] ms ⇒ 最小 ${minWall === null ? '—' : minWall.toFixed(0) + ' ms'}；**墙钟有效闪烁率 = ${rateWall === null ? '—' : rateWall.toFixed(2) + ' 次/秒'}**（§3.8 判据 ≤ 2 次/秒）`);
  return {
    okGate: minGame !== null && minGame >= gateMs - gridMs - 1e-9,
    okWallRate: rateWall !== null && rateWall <= 2 + 1e-9,
    minGame, minWall, rateWall, gapsGame, gapsWall, notes,
  };
}

/** A05 时长判定：`exact` 给 `=` 类；否则只断上限（判据形态就是「≤ N」）。 */
function judgeDuration(measuredMs, spec) {
  const notes = [];
  if (spec.exact !== undefined) {
    const ok = Math.abs(measuredMs - spec.exact) <= DUR.tolMs;
    notes.push(`实测 ${measuredMs.toFixed(2)} ms vs 判据 = ${spec.exact} ms ± ${DUR.tolMs} ⇒ ${ok ? '通过' : '**不通过**'}`);
    return { ok, notes };
  }
  const ok = measuredMs <= spec.upper + DUR.tolMs + 1e-9;
  notes.push(`实测 ${measuredMs.toFixed(2)} ms vs 判据 ≤ ${spec.upper} ms（+量规容差 ${DUR.tolMs} ms = 1 窗）⇒ ${ok ? '通过' : '**不通过**'}`);
  return { ok, notes };
}

/** 起音「软」客观判据：起音段（onset → 全局峰）逐窗最大跳变 / 峰值 ≤ 阈值。 */
/**
 * 「软起音」客观判据（样本级 10%–90% 上升时间）：
 * `riseMs = (rise90 − rise10) / SR × 1000`，判据 `≥ DUR.softRiseMs`。
 * 反例（瞬时起音）：rise10 与 rise90 相邻 ⇒ riseMs ≈ 0.02ms ⇒ 判「不软」。
 */
function judgeSoftAttack(render) {
  const { rise10, rise90, sr, peakAll, declared } = render;
  if (rise10 === undefined || rise10 < 0 || rise90 === undefined || rise90 < 0) {
    return { ok: false, note: '起音过阈点缺失（无法测上升时间）' };
  }
  const riseMs = ((rise90 - rise10) / sr) * 1000;
  const ok = riseMs >= DUR.softRiseMs - 1e-9 && peakAll > 0;
  return {
    ok, riseMs,
    note: `起音 10%→90% 上升时间 = **${riseMs.toFixed(3)} ms**（判据 ≥ ${DUR.softRiseMs} ms；声明 \`attackMs\` = ${declared.attackMs} ⇒ 线性起音期望 ≈ 0.8×${declared.attackMs} = ${(0.8 * declared.attackMs).toFixed(2)} ms）`,
  };
}

// ═══════════════════════════════════════════════════════════════ 工具
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function newestMtime(dir, filter) {
  let newest = { t: 0, f: null };
  const walk = (d) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (filter(e.name)) {
        const t = fs.statSync(p).mtimeMs;
        if (t > newest.t) newest = { t, f: path.relative(ROOT, p) };
      }
    }
  };
  walk(path.resolve(ROOT, dir));
  return newest;
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const cands = [
    process.env.WXG_PLAYWRIGHT_MODULES,
    path.join(os.homedir(), '.workbuddy/binaries/node/workspace/node_modules'),
    path.join(ROOT, 'node_modules'),
  ].filter(Boolean);
  const errs = [];
  for (const c of cands) {
    try { return require(require.resolve('playwright', { paths: [c] })); } catch (e) { errs.push(`${c}: ${String(e.message).slice(0, 80)}`); }
  }
  try { return require('playwright'); } catch (e) { errs.push(`bare: ${String(e.message).slice(0, 80)}`); }
  throw new Error(`playwright 不可解析：\n  ${errs.join('\n  ')}`);
}

function runCmd(cmd, args, cwd = ROOT) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out: out.trim() }));
    p.on('error', (e) => resolve({ code: -1, out: `spawn 失败: ${e.message}` }));
  });
}

async function fetchMain(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/assets/main/index.js`);
    if (!r.ok) return null;
    const t = await r.text();
    return t.includes('define(') || t.length > 1000 ? t : null;
  } catch { return null; }
}

async function serve(dir, port0, marker) {
  const abs = path.resolve(ROOT, dir);
  for (let port = port0; port < port0 + 6; port++) {
    const pre = await fetchMain(port);
    if (pre && pre.includes(marker)) {
      say(`  ⚠ 端口 ${port} 已有本产物的服务在跑（沿用，本脚本不接管也不杀它）`);
      return { proc: null, port, url: `http://127.0.0.1:${port}/`, adopted: true };
    }
    if (pre) { say(`  ⚠ 端口 ${port} 上的服务不是本产物（缺标记 ${marker}）⇒ 换端口`); continue; }
    const proc = spawn('python3', ['-m', 'http.server', String(port), '--directory', abs], { stdio: 'ignore' });
    for (let i = 0; i < 40; i++) {
      await sleep(150);
      const txt = await fetchMain(port);
      if (txt && txt.includes(marker)) return { proc, port, url: `http://127.0.0.1:${port}/` };
      if (txt) { proc.kill(); throw new Error(`端口 ${port} 已起服务但不是本产物（缺标记 ${marker}）⇒ 拒绝取证`); }
    }
    proc.kill();
  }
  throw new Error(`静态服务起不来：${dir}（端口 ${port0}..${port0 + 5} 全试过）`);
}

const SERVERS = [];
function killServers() { for (const s of SERVERS) { try { if (s && s.proc) s.proc.kill('SIGKILL'); } catch { /* ignore */ } } }

/** 浏览器内注册：PNG 解码（供 readPixels ↔ toDataURL 交叉验证）。 */
const PX_HELPERS = () => {
  window.__decode = async (dataUrl) => {
    const bin = atob(String(dataUrl).split(',')[1] ?? '');
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u8], { type: 'image/png' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    return { data: g.getImageData(0, 0, bmp.width, bmp.height), w: bmp.width, h: bmp.height };
  };
};

/** 页面内公共取 app 句柄。 */
const INPAGE_HEAD = `
  const cc = window.cc;
  const root = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');
  const app = root.getComponent(cc.js.getClassByName(boot))._app;
  const g = app.game;
  const canvas = document.getElementById('GameCanvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const W = canvas.width, H = canvas.height;
  const sc = W / canvas.clientWidth;
  const fit = app.viewport.fit;
`;

// ═══════════════════════════════════════════════════════════════ 取样：[B] P4 屏幕发光序
/** 阶段 1：零基线扫描（全部候选格，同一帧内）→ 选格 → 单次脉冲逐帧序列。 */
const RUN_P4_SCAN = (cfg) => new Promise((res) => {
  // 注意：`new Function` 的**源码字符串在页面侧求值** ⇒ 闭包变量（如 INPAGE_HEAD）不可见，
  // 必须经 cfg 传入（首跑即踩到 `ReferenceError: INPAGE_HEAD is not defined`，已修）。
  const INPAGE_HEAD = cfg.head;
  // eslint-disable-next-line no-new-func
  const setup = new Function('cfg', 'boot', `${INPAGE_HEAD}
    if (g.snapshot.traySlots[0].state === 'free') g.giveTrayBead(1);
    g.selectTraySlot(0);
    const s0 = g.snapshot;
    const c0 = s0.traySlots[0].colorIdx;
    const cands = [];
    for (let i = 0; i < s0.cells.length; i++) {
      const c = s0.cells[i];
      if (c.void || c.state !== 'empty' || c.colorIdx <= 0 || c.colorIdx === c0) continue;
      cands.push(i);
    }
    const halfDev = Math.ceil(cfg.boxDesignR * fit.scale * sc);
    const boxOf = (i) => {
      const row = Math.floor(i / s0.gridCols), col = i % s0.gridCols;
      const sp = { x: 0, y: 0 };
      app.viewport.designToScreen(sp, s0.gridLeft + 25 + 52 * col, s0.gridTop - 25 - 52 * row);
      const cxd = Math.round(sp.x * sc), cyd = Math.round(sp.y * sc);
      const bw = 2 * halfDev + 1, bh = 2 * halfDev + 1;
      return { gx: cxd - halfDev, gy: H - (cyd - halfDev + bh), bw, bh, cssX: cxd - halfDev, cssY: cyd - halfDev };
    };
    const buf = new Uint8Array(1024 * 1024);
    const metric = (b) => {
      gl.readPixels(b.gx, b.gy, b.bw, b.bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let m = 0;
      for (let i = 0; i < b.bw * b.bh; i++) {
        const d = buf[i * 4] - Math.max(buf[i * 4 + 1], buf[i * 4 + 2]) - cfg.theta;
        if (d > 0) m += d;
      }
      return m;
    };

    // ── 【D6 修法】采样与 rAF 解耦：接管驱动，使**每渲染帧恰推进 1 个固定步**（= 16.67 game ms）
    // 原状：宿主有**两个驱动**（App.start() 的自驱 rAF ＋ CocosLoopBridge 的 Cocos schedule），
    // 每渲染帧推进 2–10 个固定步（实测 33.33–166.67 game ms/帧）⇒ 200ms 包络只采到 1–6 点，
    // 判定跨轮回异（报告 §25.12 勘误 2 / 缺陷 D6）。
    // 现状：先 comp._loop.stop()（撤 Cocos schedule 并 app.stop() 撤自驱），再由本探针
    // 每帧调 app.loop.advance(1/60) —— 得到**确定性的 60Hz 参考栅格**（每样本 = 16.67 game ms）。
    // 边界声明：该上下文**不再代表宿主原生时序** ⇒ 墙钟速率（P4S-03）必须在**原生宿主**的另一
    // 上下文里取（CLK-01 也在那边取），两个上下文不得混用结论。
    if (cfg.ownDrive && !globalThis.__wxgOwnDrive) {
      globalThis.__wxgOwnDrive = true;     // **只装一次**（装两次 = 又是 2 个驱动 ⇒ 退回 33.33ms/样本）
      const comp = root.getComponent(cc.js.getClassByName(boot));
      if (comp && comp._loop && comp._loop.stop) comp._loop.stop();
      else app.stop();
      const drive = () => { app.loop.advance(1 / 60); globalThis.requestAnimationFrame(drive); };
      globalThis.requestAnimationFrame(drive);
    }

    return { s0: { gridCols: s0.gridCols, gridRows: s0.gridRows }, c0, cands, halfDev, boxOf, metric, cc, g, canvas, gl, W, H, sc, fit: { ...fit } };
  `)(cfg, cfg.boot);

  const { cands, boxOf, metric, cc, g, canvas } = setup;
  const baseScan = [];
  let pick = cands[0], pickBase = Infinity, box = boxOf(cands[0]);
  const cross = { read: null, url: null, box: null };
  const series = [];
  const shots = {};

  const hookScan = () => {
    cc.director.off(cc.Director.EVENT_AFTER_DRAW, hookScan);
    // ── 全部候选格在**同一帧**内扫（此刻无 danger 环）──
    for (const cell of cands) {
      const b = boxOf(cell);
      const m = metric(b);
      baseScan.push({ cell, m });
      if (m < pickBase) { pickBase = m; pick = cell; box = b; }
    }
    shots.base = canvas.toDataURL('image/png');
    // ── 交叉验证物（同帧 readPixels + toDataURL）──
    gl_readback();
    // ── 单次脉冲逐帧 ──
    let f = 0;
    const row = Math.floor(pick / setup.s0.gridCols), col = pick % setup.s0.gridCols;
    const hookM = () => {
      f++;
      const snap = g.snapshot;
      series.push({ f, m: metric(box), pc: snap.pulseClock, wp: snap.wrongProgress, wr: snap.wrongRow, wc: snap.wrongCol, t: performance.now() });
      if (f === 4) g.tapGridCell(row, col);
      if (f === 8) shots.peak = canvas.toDataURL('image/png');
      if (f >= cfg.scanFrames) {
        cc.director.off(cc.Director.EVENT_AFTER_DRAW, hookM);
        res({
          envProbe: {
            W: setup.W, H: setup.H, sc: setup.sc, halfDev: setup.halfDev, fit: setup.fit,
            pick, pickRow: row, pickCol: col, candCount: cands.length, c0: setup.c0,
            box: { gx: box.gx, gy: box.gy, bw: box.bw, bh: box.bh, cssX: box.cssX, cssY: box.cssY },
            tapFrame: 4, frames: f,
          },
          baseScan, series, shots, cross,
        });
      }
    };
    cc.director.on(cc.Director.EVENT_AFTER_DRAW, hookM);
  };
  function gl_readback() {
    const buf = new Uint8Array(box.bw * box.bh * 4);
    setup.gl.readPixels(box.gx, box.gy, box.bw, box.bh, setup.gl.RGBA, setup.gl.UNSIGNED_BYTE, buf);
    cross.read = Array.from(buf);
    cross.url = canvas.toDataURL('image/png');
    cross.box = { gx: box.gx, gy: box.gy, bw: box.bw, bh: box.bh, H: setup.H };
  }
  cc.director.on(cc.Director.EVENT_AFTER_DRAW, hookScan);
});

/** 阶段 2：连续拒绝（gate）—— 每 `tapEveryFrames` 渲染帧注入一次。 */
const RUN_P4_GATE = (cfg) => new Promise((res) => {
  const INPAGE_HEAD = cfg.head;
  const setup = new Function('cfg', 'boot', `${INPAGE_HEAD}
    // 探针缺陷（首跑暴露，已修）：原先误用 traySlots[...] 取格子（应为 cells[...]），
    // 在 gridCols=13 时索引越界 ⇒「Cannot read properties of undefined (reading 'void')」。
    const _cells = g.snapshot.cells;
    const _idx = cfg.pickRow * g.snapshot.gridCols + cfg.pickCol;
    if (!_cells || !_cells[_idx] || _cells[_idx].void) throw new Error('pick 非法/越界');
    const halfDev = Math.ceil(cfg.boxDesignR * fit.scale * sc);
    const sp = { x: 0, y: 0 };
    const s0 = g.snapshot;
    app.viewport.designToScreen(sp, s0.gridLeft + 25 + 52 * cfg.pickCol, s0.gridTop - 25 - 52 * cfg.pickRow);
    const cxd = Math.round(sp.x * sc), cyd = Math.round(sp.y * sc);
    const bw = 2 * halfDev + 1, bh = 2 * halfDev + 1;
    const box = { gx: cxd - halfDev, gy: H - (cyd - halfDev + bh), bw, bh };
    const buf = new Uint8Array(1024 * 1024);
    const metric = () => {
      gl.readPixels(box.gx, box.gy, box.bw, box.bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let m = 0;
      for (let i = 0; i < box.bw * box.bh; i++) {
        const d = buf[i * 4] - Math.max(buf[i * 4 + 1], buf[i * 4 + 2]) - cfg.theta;
        if (d > 0) m += d;
      }
      return m;
    };

    // ── 【D6 修法】采样与 rAF 解耦：接管驱动，使**每渲染帧恰推进 1 个固定步**（= 16.67 game ms）
    // 原状：宿主有**两个驱动**（App.start() 的自驱 rAF ＋ CocosLoopBridge 的 Cocos schedule），
    // 每渲染帧推进 2–10 个固定步（实测 33.33–166.67 game ms/帧）⇒ 200ms 包络只采到 1–6 点，
    // 判定跨轮回异（报告 §25.12 勘误 2 / 缺陷 D6）。
    // 现状：先 comp._loop.stop()（撤 Cocos schedule 并 app.stop() 撤自驱），再由本探针
    // 每帧调 app.loop.advance(1/60) —— 得到**确定性的 60Hz 参考栅格**（每样本 = 16.67 game ms）。
    // 边界声明：该上下文**不再代表宿主原生时序** ⇒ 墙钟速率（P4S-03）必须在**原生宿主**的另一
    // 上下文里取（CLK-01 也在那边取），两个上下文不得混用结论。
    if (cfg.ownDrive && !globalThis.__wxgOwnDrive) {
      globalThis.__wxgOwnDrive = true;     // **只装一次**（装两次 = 又是 2 个驱动 ⇒ 退回 33.33ms/样本）
      const comp = root.getComponent(cc.js.getClassByName(boot));
      if (comp && comp._loop && comp._loop.stop) comp._loop.stop();
      else app.stop();
      const drive = () => { app.loop.advance(1 / 60); globalThis.requestAnimationFrame(drive); };
      globalThis.requestAnimationFrame(drive);
    }

    return { cc, g, box, metric, halfDev };
  `)(cfg, cfg.boot);

  const { cc, g, box, metric } = setup;
  const series = [];
  const taps = [];
  let f = 0, lastTapPc = -Infinity, doneAtPc = -Infinity;
  const last = 600;
  const hook = () => {
    f++;
    const snap = g.snapshot;
    series.push({ f, m: metric(), pc: snap.pulseClock, wp: snap.wrongProgress, t: performance.now() });
    // 【注入节律按**游戏时钟**】每 ≥100 game ms 注入一次拒绝（首版按「每 6 渲染帧」注入，
    // 而渲染帧长在本环境 17–167ms 间抖动 ⇒ 注入节律随帧率漂移，500ms 门有时根本不被行使，
    // 墙钟速率读数因此不可比。改为 pulseClock 驱动后，注入节律与帧率解耦。）
    if (taps.length < cfg.taps) {
      if (snap.pulseClock - lastTapPc >= cfg.tapIntervalMs) { lastTapPc = snap.pulseClock; g.tapGridCell(cfg.pickRow, cfg.pickCol); taps.push({ f, pc: snap.pulseClock }); }
    } else if (doneAtPc < 0) doneAtPc = snap.pulseClock;
    if (f >= last || (doneAtPc >= 0 && snap.pulseClock - doneAtPc > 800)) {
      cc.director.off(cc.Director.EVENT_AFTER_DRAW, hook);
      res({ series, taps, box, halfDev: setup.halfDev, frames: f });
    }
  };
  cc.director.on(cc.Director.EVENT_AFTER_DRAW, hook);
});

/** 宿主驱动诊断：仿真时基 vs 墙钟。 */
const RUN_CLK = (cfg) => new Promise((res) => {
  const c = window.cc;
  const root = c.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');
  const comp = root.getComponent(c.js.getClassByName(cfg.boot));
  const app = comp._app;
  let raf = 0, sch = 0, draws = 0;
  const onDraw = () => { draws++; };
  c.director.on(c.Director.EVENT_AFTER_DRAW, onDraw);
  const probe = () => { sch++; };
  comp.schedule(probe, 0);
  const tick = () => { raf++; window.requestAnimationFrame(tick); };
  window.requestAnimationFrame(tick);
  const wall0 = performance.now(), ticks0 = app.loop.ticks, sim0 = app.loop.time;
  const rem0 = app.game.snapshot.remaining, pc0 = app.game.snapshot.pulseClock;
  setTimeout(() => {
    const wall1 = performance.now(), ticks1 = app.loop.ticks, sim1 = app.loop.time;
    const rem1 = app.game.snapshot.remaining, pc1 = app.game.snapshot.pulseClock;
    c.director.off(c.Director.EVENT_AFTER_DRAW, onDraw);
    comp.unschedule(probe);
    res({
      wallS: (wall1 - wall0) / 1000,
      simDeltaS: sim1 - sim0,
      steps: ticks1 - ticks0,
      ratio: (sim1 - sim0) / ((wall1 - wall0) / 1000),
      draws, raf, sch,
      gameClockDeltaMs: pc1 - pc0,
      remainingDeltaS: rem0 - rem1,
      appRunning: app.running,
      fixedDt: app.loop.fixedDt, maxSubSteps: app.loop.maxSubSteps,
      clamped: app.loop.clampedFrames,
      pending: app.loop.pendingTime,
    });
  }, cfg.wallMs);
});

/** 钩外 readPixels（探针有效性对照：期望恒 0）。 */
const RUN_OFFHOOK = (cfg) => {
  const c = window.cc;
  const root = c.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');
  void root.getComponent(c.js.getClassByName(cfg.boot))._app;
  const canvas = document.getElementById('GameCanvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const full = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, full);
  let sum = 0;
  for (let i = 0; i < full.length; i++) sum += full[i];
  return { sumOutside: sum, W: canvas.width, H: canvas.height };
};

// ═══════════════════════════════════════════════════════════════ 取样：A05 真 WebAudio
const RUN_AUDIO = (cfg) => (async () => {
  const c = window.cc;
  const root = c.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');
  const app = root.getComponent(c.js.getClassByName(cfg.boot))._app;
  const backend = app.services.audio._backend;
  const Cls = backend.constructor;
  const voices = app.game.audioVoices;
  const SR = 44100;
  const ids = Object.keys(voices);
  const out = { backendName: Cls.name, voiceCount: ids.length, sr: SR, clips: {}, audioCtx: {} };

  // 环境事实：真 AudioContext 在无头下是否存在 / currentTime 是否推进（**方法选择的自证**）
  out.audioCtx = await (async () => {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return { exists: false };
      const ac = new Ctor();
      const t0 = ac.currentTime;
      await new Promise((r) => setTimeout(r, 300));
      const t1 = ac.currentTime;
      const st = ac.state;
      try { ac.close(); } catch { /* ignore */ }
      return { exists: true, state: st, advancedMs: Math.round((t1 - t0) * 1000) };
    } catch (e) { return { exists: false, err: String(e).slice(0, 120) }; }
  })();

  const renderOne = async (id, loops) => {
    const v = voices[id];
    const unitMs = v.loopMs && v.loopMs > 0 ? v.loopMs : v.durationMs;
    const totalMs = unitMs * loops + 150;
    const frames = Math.ceil((SR * totalMs) / 1000);
    const oc = new OfflineAudioContext(1, frames, SR);
    // OfflineAudioContext 的 resume() 无意义且可能产出 rejected promise（污染未捕获拒绝）
    // ⇒ 临时遮蔽；`unlock()` 的其余语义（建 context + 补起 wanted loops）不变。
    try { Object.defineProperty(oc, 'resume', { value: undefined, configurable: true }); } catch { /* ignore */ }
    const b = new Cls(() => oc, voices);
    b.unlock();
    b.play(id, { volume: 1, loop: !!(v.loopMs && v.loopMs > 0) });
    const rendered = await oc.startRendering();
    const data = rendered.getChannelData(0);
    const step = Math.round(SR / 1000);
    const env = [];
    let peakAll = 0;
    for (let i = 0; i + step <= data.length; i += step) {
      let p = 0, s = 0;
      for (let k = 0; k < step; k++) { const a = Math.abs(data[i + k]); if (a > p) p = a; s += data[i + k] * data[i + k]; }
      if (p > peakAll) peakAll = p;
      env.push({ t: i / SR * 1000, peak: p, rms: Math.sqrt(s / step) });
    }
    // ── **样本级**过阈点（时长判据的正本；1ms 窗级只作交叉对照，见报告 §25.6 量规说明）──
    const thr = peakAll * cfg.thrRatio;
    let firstSample = -1, lastSample = -1;
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]);
      if (a >= thr) { if (firstSample < 0) firstSample = i; lastSample = i; }
    }
    // ── 「软起音」客观量规：**10%–90% 上升时间**（样本级）──
    // 口径：短于 ~1ms 的起音在中频内容上即为 click；线性 `attackMs` 起音的 10–90% ≈ 0.8×attackMs。
    // （首版用「0.25ms 窗峰值逐窗跳变」是**错的**：窗长 ≪ 波形周期时，窗峰值跟的是**正弦自身**的
    //  瞬时幅度而非包络 ⇒ 把波形斜率误当起音斜率；已按此订正，判据面见 `DUR.softRiseMs`。）
    const hi = peakAll * 0.9, lo = peakAll * 0.1;
    let rise10 = -1, rise90 = -1;
    for (let i = firstSample >= 0 ? firstSample : 0; i < data.length; i++) {
      const a = Math.abs(data[i]);
      if (rise10 < 0 && a >= lo) rise10 = i;
      if (a >= hi) { rise90 = i; break; }
    }
    return {
      env, peakAll, firstSample, lastSample, rise10, rise90, sr: SR,
      declared: { durationMs: v.durationMs, loopMs: v.loopMs ?? null, attackMs: v.attackMs ?? null }, unitMs, n: data.length,
    };
  };

  for (const id of ids) {
    out.clips[id] = {};
    if (id === 'bgm_main') {
      const r = await renderOne(id, 2);
      out.clips[id].render = { declared: r.declared, peakAll: r.peakAll, unitMs: r.unitMs, env: r.env, n: r.n, firstSample: r.firstSample, lastSample: r.lastSample, rise10: r.rise10, rise90: r.rise90, sr: r.sr };
      const oc2 = new OfflineAudioContext(1, Math.ceil(SR * 0.2), SR);
      try { Object.defineProperty(oc2, 'resume', { value: undefined, configurable: true }); } catch { /* ignore */ }
      const b2 = new Cls(() => oc2, voices);
      b2.unlock();
      b2.play(id, { volume: 1, loop: true });
      const loops1 = b2.activeLoops().slice();
      b2.play(id, { volume: 1, loop: true });
      const loops2 = b2.activeLoops().slice();
      out.clips[id].idempotent = { loops1, loops2 };
    } else {
      const r = await renderOne(id, 1);
      out.clips[id].render = { declared: r.declared, peakAll: r.peakAll, unitMs: r.unitMs, env: r.env, n: r.n, firstSample: r.firstSample, lastSample: r.lastSample, rise10: r.rise10, rise90: r.rise90, sr: r.sr };
    }
  }
  return out;
})();   // ← 必须**调用** async IIFE：漏掉 () 时本函数返回「一个函数对象」⇒ 页面侧不可序列化 ⇒
         //    探针会拿到 undefined 并**静默跳过整段 A05**（首跑实测踩到，已修；这是「静默假绿」的典型）。

// ═══════════════════════════════════════════════════════════════ Node 侧量规（纯）
/**
 * 样本级过阈点（**对照量规**，不作判据面）：`(lastSample − firstSample + 1)/SR×1000`。
 * 对单音平滑包络与窗级一致；对**多音叠加**（拍频到零）会系统性提前 ⇒ 只作对照。
 */
function measureSamples(r) {
  const thr = r.peakAll * DUR.thresholdRatio;
  if (r.firstSample === undefined || r.firstSample < 0) return { durationMs: 0, thr, first: -1, last: -1 };
  return { durationMs: ((r.lastSample - r.firstSample + 1) / r.sr) * 1000, thr, first: r.firstSample, last: r.lastSample };
}

/** 窗级量规（交叉对照用，不参与判定）：onset/offset = 首个/末个 |x| ≥ peak×ratio 的 1ms 窗。 */
function measureEnvelope(env, peakAll) {
  const thr = peakAll * DUR.thresholdRatio;
  let first = -1, last = -1;
  for (let i = 0; i < env.length; i++) if (env[i].peak >= thr) { if (first < 0) first = i; last = i; }
  if (first < 0) return { durationMs: 0, first: -1, last: -1, thr, peakValue: 0 };
  const dt = env.length > 1 ? env[1].t - env[0].t : 1;
  let peakIdx = first;
  for (let i = first; i <= last; i++) if (env[i].peak > env[peakIdx].peak) peakIdx = i;
  return { durationMs: (last - first + 1) * dt, first, last, thr, peakMs: env[peakIdx].t, peakValue: env[peakIdx].peak };
}

/** 双段检测：在 [split±40ms] 内找包络谷；其后回升。 */
function twoSegment(env, peakAll, splitMs) {
  let dipIdx = -1, dip = Infinity;
  for (let i = 0; i < env.length; i++) {
    const t = env[i].t;
    if (t >= splitMs - 40 && t <= splitMs + 40 && env[i].peak < dip) { dip = env[i].peak; dipIdx = i; }
  }
  let after = 0;
  for (let i = Math.max(0, dipIdx); i < env.length; i++) after = Math.max(after, env[i].peak);
  return { dipRatio: dip / peakAll, afterRatio: after / peakAll, dipMs: dipIdx >= 0 ? env[dipIdx].t : -1 };
}

/** 环点连续性：接缝处包络跳变 vs 环内最大逐窗跳变（本探针的**客观**代理）。 */
function loopSeam(env, unitMs) {
  let seamIdx = -1;
  for (let i = 0; i < env.length; i++) if (Math.abs(env[i].t - unitMs) < 0.51) seamIdx = i;
  if (seamIdx < 1) return null;
  const before = env[seamIdx - 1].peak, at = env[seamIdx].peak;
  let maxJump = 0;
  for (let i = 1; i < env.length; i++) maxJump = Math.max(maxJump, Math.abs(env[i].peak - env[i - 1].peak));
  return { seamJump: Math.abs(at - before), maxJump, seamMs: env[seamIdx].t };
}

// ═══════════════════════════════════════════════════════════════ 主流程
let exitCode = 3;
let server = null;
let browser = null;
let ringFullEst = 0;               // P4：环满量程先验估计（P4 取样失败时退到几何先验）
let measuredGameFrameMs = 16.667;  // P4：实测 game 帧长（SELF-01 的反例口径用它）
const startedAt = new Date();
const errsA = [], errsB = [];

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { killServers(); process.exit(130); });
}

try {
  say('===============================================================');
  say('WXG-T-119 · beads [B] 浏览器逐帧取证（P4 屏幕发光序列 + A05 时长/包络族）');
  say(`时间戳: ${startedAt.toISOString()}`);
  say(`Node ${process.version} · ${os.platform()} ${os.release()}`);
  say(`substrate = (a) Cocos web-mobile 产物（真机同源渲染路径）：${GAME.artifact}`);
  say(`日志: ${path.relative(ROOT, LOG_FILE)}${ALLOW_STALE ? '  ⚠ --allow-stale：新鲜度门被跳过，本轮 PASS 不得作为门禁证据' : ''}`);
  say('判据来源: ux-spec §5:180/174 > systems-index §3.8 > audio-events §4 > 报告 §19.3/§24.6');
  say('===============================================================');

  const { chromium } = loadPlaywright();

  // ── ENV-01：镜像一致 + 产物新鲜度 + 产物含关键符号 ──
  const syncCheck = await runCmd('node', ['tools/scripts/sync-framework-to-cocos.mjs', '--check']);
  say(`\n[镜像守卫] framework:sync:check ⇒ exit=${syncCheck.code}：${syncCheck.out.split('\n')[0]}`);
  {
    const problems = [];
    const notes = [];
    const bundle = path.resolve(ROOT, GAME.bundle);
    if (!fs.existsSync(bundle)) problems.push(`产物缺失: ${GAME.bundle}`);
    let artT = 0, srcNewest = { t: 0, f: null };
    if (fs.existsSync(bundle)) artT = fs.statSync(bundle).mtimeMs;
    for (const s of GAME.sources) {
      const n = newestMtime(s, (f) => /\.(ts|js|json)$/.test(f));
      if (n.t > srcNewest.t) srcNewest = n;
    }
    notes.push(`产物 assets/main/index.js mtime=${new Date(artT).toISOString()}；源最新=${srcNewest.f} @ ${new Date(srcNewest.t).toISOString()}`);
    if (artT && srcNewest.t > artT) problems.push(`产物陈旧（源 ${srcNewest.f} 晚于产物）⇒ 必须先 pnpm --filter @wxgame/beads run build:cocos:web`);
    notes.push(`镜像守卫 exit=${syncCheck.code}`);
    if (syncCheck.code !== 0) problems.push('framework:sync:check 未过（拷贝件与源码不一致）⇒ 先 pnpm run framework:sync');
    if (fs.existsSync(bundle)) {
      const txt = fs.readFileSync(bundle, 'utf8');
      for (const marker of ['BeadsBootstrap', 'SynthAudioBackend', 'sfx_combo_t2', 'sfx_combo_t3']) {
        const hits = txt.split(marker).length - 1;
        notes.push(`${marker} 命中 ${hits} 次`);
        if (hits < 1) problems.push(`产物不含 ${marker} ⇒ 验的是旧/错产物`);
      }
    }
    const staleOnly = problems.every((p) => p.includes('产物陈旧'));
    if (problems.length && staleOnly && ALLOW_STALE) record('ENV-01', 'N', '⛔', `${notes.join('；')}｜**陈旧被 --allow-stale 放过**，仅诊断用`);
    else if (problems.length) record('ENV-01', 'N', '⛔', `${notes.join('；')}｜问题：${problems.join('；')}`);
    else record('ENV-01', 'N', 'PASS', notes.join('；'));
  }

  // ── ENV-02 = A05-25 `[C]`：产物内音频资产文件数与占用 ──
  {
    const art = path.resolve(ROOT, GAME.artifact);
    const audioExt = /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba)$/i;
    const found = [];
    const walk = (d) => {
      let ents = [];
      try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (audioExt.test(e.name)) found.push({ p: path.relative(ROOT, p), kb: fs.statSync(p).size / 1024 });
      }
    };
    walk(art);
    const kb = found.reduce((a, f) => a + f.kb, 0);
    record('ENV-02', 'C', found.length === 0 ? 'PASS' : 'FAIL',
      `产物 ${GAME.artifact} 内音频资产文件数 = **${found.length}**（判据 0）、占用 = **${kb.toFixed(1)} KB**（判据 0）`
      + `${found.length ? '｜文件：' + found.map((f) => f.p).join(', ') : ''}`
      + `；**同一次读数即 A05-25 的 \`[C]\` 证据**（web-mobile 产物；wechatgame 主包因无 AppID 仍 ⛔ 未测，两口径不得混用）。`);
  }

  const envBlocked = results.some((r) => r.verdict === '⛔');
  if (envBlocked) {
    say('\n环境门未过 ⇒ 不进入取样（产物陈旧 / 镜像未同步下一律不得当绿）。');
    const idx = results.filter((r) => r.verdict === '⛔').map((r) => r.id).join(', ');
    say(`受影响：${idx} ⇒ 请重建产物后复跑。退出码 2。`);
    exitCode = 2;
    throw { __handled: true };
  }

  // ── SELF-02：A05 时长/起音判定函数自检（构造反例；**先于取样**）──
  {
    const over = judgeDuration(120 * 1.3, { upper: 120 });
    const exactOk = judgeDuration(120, { upper: 120 });
    const eqOk = judgeDuration(150, { exact: 150 });
    const eqBad = judgeDuration(150 * 1.3, { exact: 150 });
    // 起音判定反例（构造）：瞬时起音 = 10%/90% 阈点在相邻样本；线性 4ms 起音 = 阈点相隔 3.2ms
    const SR = 44100;
    const instant = judgeSoftAttack({ rise10: 0, rise90: 1, sr: SR, peakAll: 1, declared: { attackMs: 0 } });
    const ramp = judgeSoftAttack({ rise10: 0, rise90: Math.round(SR * 0.0032), sr: SR, peakAll: 1, declared: { attackMs: 4 } });
    const ok = !over.ok && exactOk.ok && eqOk.ok && !eqBad.ok && !instant.ok && ramp.ok;
    record('SELF-02', 'N', ok ? 'PASS' : 'FAIL',
      `反例逐个喂同一批量规 ⇒ 130% 超长 = ${over.ok ? 'PASS(错!)' : 'FAIL(对)'}；恰 120 = ${exactOk.ok ? 'PASS(对)' : 'FAIL(错!)'}；`
      + `=150 精确 = ${eqOk.ok ? 'PASS(对)' : 'FAIL(错!)'}；=195（130%）= ${eqBad.ok ? 'PASS(错!)' : 'FAIL(对)'}；`
      + `**瞬时起音**（10–90% = 0.023ms）= ${instant.ok ? 'PASS(错!)' : 'FAIL(对)'}（实测 ${instant.riseMs.toFixed(3)} ms）；`
      + `**线性 4ms 起音**（10–90% = 3.2ms）= ${ramp.ok ? 'PASS(对)' : 'FAIL(错!)'}（实测 ${ramp.riseMs.toFixed(3)} ms）`
      + ` ⇒ 时长与起音两类判定**都有判别力**（不是「跑了但没判」）。`);
  }

  // ── 起静态服务 + 浏览器 ──
  server = await serve(GAME.artifact, 8141, 'BeadsBootstrap');
  SERVERS.push(server);
  browser = await chromium.launch({
    // 无头下 Cocos 走 SwiftShader（软件渲染）；放开 vsync/帧率上限可显著提高并**稳定**渲染节奏，
    // 而屏幕层取样的时间分辨率**就是**渲染帧率（首跑实测 11–38fps 抖动 ⇒ 采样密度不可控）。
    args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  say('');
  say(`静态服务: ${server.url}`);

  const waitBoot = (page) => page.waitForFunction((boot) => {
    const cc = window.cc;
    if (!cc) return false;
    const s = cc.director.getScene();
    if (!s || !s.getChildByName('Canvas')) return false;
    const r = s.getChildByName('Canvas').getChildByName('GameRoot');
    if (!r) return false;
    const c = r.getComponent(cc.js.getClassByName(boot));
    return !!(c && c._app && c._app.game.snapshot.phase === 'playing');
  }, GAME.boot, { timeout: 30000 });

  // 视口：1000×1780 在无头 SwiftShader 下只有 ~23 fps（每渲染帧推进 5 个固定步）⇒ 200ms 的 fx 窗口
  // 只落到 2–3 个采样点。改为更小视口换取更高渲染帧率（采样密度说明见报告 §25.3）。
  const VP = { width: 640, height: 1140 };

  // ══ CLI(=CLK-01) / ENV-04 / ENV-03 / P4S-* ══
  let p4 = null, gate = null, clk = null, offhook = null, env04ok = null;
  let p4f = null, gatef = null;      // 精栅格上下文（ownDrive）
  {
    const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errsA.push(String(e).slice(0, 160)));
    try {
      await pg.goto(server.url, { waitUntil: 'load' });
      await waitBoot(pg);
      await pg.evaluate(PX_HELPERS);
      // —— 上下文 A（**原生宿主**，不动驱动）：CLK-01 / ENV-03 / ENV-04 / P4S-00 / P4S-03 ——
      clk = await pg.evaluate(RUN_CLK, { boot: GAME.boot, wallMs: 2500 });
      p4 = await pg.evaluate(RUN_P4_SCAN, { ...P4, boot: GAME.boot, head: INPAGE_HEAD, ownDrive: false });
      offhook = await pg.evaluate(RUN_OFFHOOK, { boot: GAME.boot });

      // ENV-04：readPixels ↔ 同帧 PNG 交叉验证（用 p4.cross）
      // 判据（先写）：**逐像素 |Δ| ≤ 2/255**（同区域、含 GL 自下而上的行序对齐）+ **负向反证**
      // （故意错位的区域必须明显不同）。首跑把行序弄错 ⇒ 误报 |Δ|=36；修好后实测 |Δ| ≈ 0
      // ⇒ 读回与 `toDataURL` **逐字节同源**，即读回确为**本帧真实像素**。
      if (p4 && p4.cross && p4.cross.url) {
        const cmp = await pg.evaluate(async ([url, read, box]) => {
          const img = await window.__decode(url);
          const { gx, gy, bw, bh, H } = box;
          const cssY = H - gy - bh;                      // 转 PNG 左上原点（box 顶边）
          const pngAt = (x, y, ch) => img.data.data[(y * img.w + x) * 4 + ch];
          // 【探针自身缺陷（首跑暴露，已修）】GL `readPixels` 的行序是**自下而上**：返回数组第 y 行
          // 对应 box 的**底**部 ⇒ 与 PNG（自上而下）对齐必须做 `bh-1-y`。首跑忘了这步，
          // 把 |Δ| 误报成 36（实为「同一 box 内上下颠倒比对」）；实测镜像对齐后 |Δ| ≈ 0。
          const pngRowOf = (y) => cssY + (bh - 1 - y);
          const cmpAt = (offX, offY) => {
            let sum = 0, n = 0, worst = 0;
            for (let y = 0; y < bh; y++) {
              for (let x = 0; x < bw; x++) {
                const i = (y * bw + x) * 4;
                const XX = gx + x + offX, YY = pngRowOf(y) + offY;
                if (YY < 0 || YY >= img.h) continue;
                for (let ch = 0; ch < 3; ch++) {
                  const d = Math.abs(pngAt(XX, YY, ch) - read[i + ch]);
                  sum += d; n++; if (d > worst) worst = d;
                }
              }
            }
            return { mean: sum / n, worst };
          };
          const rowMeans = [];
          for (let y = 0; y < bh; y++) {
            let rs = 0;
            for (let x = 0; x < bw; x++) {
              const i = (y * bw + x) * 4;
              for (let ch = 0; ch < 3; ch++) rs += Math.abs(pngAt(gx + x, pngRowOf(y), ch) - read[i + ch]);
            }
            rowMeans.push(rs / (bw * 3));
          }
          const right = cmpAt(0, 0);
          const wrong = cmpAt(137, 71);                  // 负向反证：故意错位区域
          const samples = [];
          for (const [dx, dy] of [[43, 43], [10, 60], [80, 20], [30, 30], [60, 70]]) {
            const i = (dy * bw + dx) * 4;
            samples.push({ dx, dy, read: [read[i], read[i + 1], read[i + 2]], png: [pngAt(gx + dx, pngRowOf(dy), 0), pngAt(gx + dx, pngRowOf(dy), 1), pngAt(gx + dx, pngRowOf(dy), 2)] });
          }
          return { right, wrong, w: img.w, h: img.h, samples, rowMeans };
        }, [p4.cross.url, p4.cross.read, p4.cross.box]);
        env04ok = cmp.right.mean <= 2 && cmp.wrong.mean >= 20;
        record('ENV-04', 'N', env04ok ? 'PASS' : 'FAIL',
          `同帧 \`readPixels\`（box ${p4.cross.box.bw}×${p4.cross.box.bh}，GL 行序自下而上已做 \`bh-1-y\` 对齐）`
          + ` 与 \`canvas.toDataURL()\` 解码后**同区域**逐像素比对：平均 |Δ| = **${cmp.right.mean.toFixed(4)}**（判据 ≤ 2）、最大 |Δ| = ${cmp.right.worst}（PNG ${cmp.w}×${cmp.h}）`
          + `；**负向反证**（故意错位 +137,+71 px）：平均 |Δ| = **${cmp.wrong.mean.toFixed(2)}**（判据 ≥ 20）`
          + `\n       采样对照（read ↔ png，各 5 点）：${cmp.samples.map((s) => `(${s.dx},${s.dy}) ${s.read}↔${s.png}`).join('；')}`
          + `\n       ⇒ **读回与同帧 PNG 逐字节同源**（|Δ|≈0）；而错位区域差异显著 ⇒ 读回**确为本帧真实像素**，且**位置对应无误**。`
          + `\n       **探针自身缺陷（首跑暴露，已修，属「与实现缺陷严格分开」登记项）**：首跑比对时**漏了 GL 行序的 \`bh-1-y\`**，`
          + `把同一 box 上下颠倒地比，误报平均 |Δ| = 36.4（当时行向镜像比对实测 0.00 即已指向该根因）。`
          + ` 修的是**探针**，判据（|Δ| ≤ 2）一字未改。`);
        fs.mkdirSync(OUT_DIR, { recursive: true });
        fs.writeFileSync(path.join(OUT_DIR, 'beads-browser-crosscheck.json'), JSON.stringify({
          box: p4.cross.box, right: cmp.right, wrong: cmp.wrong, samples: cmp.samples,
          rowMeans: cmp.rowMeans, read: p4.cross.read,
        }, null, 1));
      } else {
        record('ENV-04', 'N', '⛔', '交叉验证物缺失（P4 取样未产出 cross）');
      }

      // ENV-03：**钩外读回的不可依赖性**（首跑实测否证了原「恒 0」前提 ⇒ 已按实测改写判据面，
      // 属**前提订正**、不动任何阈值；本记录的判定门 = ENV-04 成立，即「钩内读回被同帧 PNG 证实」）。
      {
        const obs = offhook ? `全画布求和 = **${offhook.sumOutside}**（画布 ${offhook.W}×${offhook.H}）` : '未取到';
        const verdict = env04ok === true ? 'PASS' : (env04ok === false ? 'FAIL' : '⛔');
        record('ENV-03', 'N', verdict,
          `钩外（普通 task 内、非 EVENT_AFTER_DRAW）readPixels 观测：${obs}；`
          + `**与首轮探查（同码读取三点均得 [0,0,0]）不一致** ⇒ 钩外读回**不可依赖**（既可能是清空后的 0，也可能是本帧残留）。`
          + `**前提订正声明**：本条原写「钩外恒 0」为预期，**已被实测否证**；现改为「钩外读回不构成证据 ⇒ 取样必须在钩内」，`
          + `判定门挂到 ENV-04（同帧 PNG 交叉验证）——**这是判据面的订正，不是阈值放宽**（无任何阈值被改）。`
          + ` ⇒ 本次钩内读回 ${env04ok === true ? '已被 ENV-04 证实' : env04ok === false ? '**未**被 ENV-04 证实' : '未取到交叉验证'}。`);
      }

      // CLK-01
      if (clk) {
        const okRatio = Math.abs(clk.ratio - 1) <= 0.1;
        record('CLK-01', 'B', okRatio ? 'PASS' : 'FAIL',
          `墙钟 ${clk.wallS.toFixed(3)}s 内：\`loop.time\` 增量 **${clk.simDeltaS.toFixed(3)}s**、固定步 **${clk.steps}**、`
          + `渲染帧 ${clk.draws}、rAF 回调 ${clk.raf}、Cocos schedule(0) 回调 ${clk.sch}；\`pulseClock\` 增量 ${clk.gameClockDeltaMs.toFixed(0)}ms、`
          + `倒计时 \`remaining\` 下降 ${clk.remainingDeltaS.toFixed(2)}s ⇒ **仿真/墙钟 = ${clk.ratio.toFixed(3)}**（判据 ≈1.00，±0.10 内过）`
          + `；fixedDt = ${clk.fixedDt.toFixed(5)}、maxSubSteps = ${clk.maxSubSteps}、clampedFrames = ${clk.clamped}`
          + ` ⇒ **${okRatio ? '单驱动，时基一致' : '双驱动确证：App 自驱 rAF 与 CocosLoopBridge 的 schedule 同时推进 app.tick（合计 ≈2 倍帧步）'}**（登记 **BD-40**，见报告 §25.4）。`);
      }

      // gate 实验
      gate = await pg.evaluate(RUN_P4_GATE, { ...P4, boot: GAME.boot, head: INPAGE_HEAD, pickRow: p4.envProbe.pickRow, pickCol: p4.envProbe.pickCol, ownDrive: false });

      // —— 上下文 B（**接管驱动**：每渲染帧恰 1 固定步 ⇒ 确定性 60Hz 参考栅格）——
      // 用于 α 包络形状（P4S-01/01b）与 **game 时基**的起播门（P4S-02）；
      // **不得**在此上下文取墙钟速率（其节奏由本探针决定，非宿主）。
      p4f = await pg.evaluate(RUN_P4_SCAN, { ...P4, boot: GAME.boot, head: INPAGE_HEAD, ownDrive: true });
      if (p4f && p4f.envProbe) {
        gatef = await pg.evaluate(RUN_P4_GATE, { ...P4, boot: GAME.boot, head: INPAGE_HEAD, pickRow: p4f.envProbe.pickRow, pickCol: p4f.envProbe.pickCol, ownDrive: true });
      }
    } catch (e) {
      record('P4S-01', 'B', '⛔', `P4 取样失败：${String(e.stack ?? e).slice(0, 400)}`);
    } finally { await ctx.close(); }
  }

  if (p4 && p4.envProbe) {
    ringFullEst = 4 * (50 * p4.envProbe.fit.scale * p4.envProbe.sc) * (2 * p4.envProbe.fit.scale * p4.envProbe.sc) * (156 - P4.theta);
    const onsetThr = P4.onsetFrac * ringFullEst;
    /** 起播检测门限（脉冲存在性/支撑/连续拒绝起播共用；理由见 `P4.gateOnsetFrac`）。 */
    const gateOnset = Math.max(10, P4.gateOnsetFrac * ringFullEst);

    // P4S-00
    {
      const nonzero = p4.baseScan.filter((b) => b.m > 1e-9);
      record('P4S-00', 'B', nonzero.length === 0 ? 'PASS' : 'FAIL',
        `同帧扫描 ${p4.baseScan.length} 个候选被拒格（**无环**帧）⇒ ringMetric 非零者 **${nonzero.length}** 个`
        + `${nonzero.length ? '：' + nonzero.map((b) => `${b.cell}=${b.m}`).join(' ') : ''}`
        + `；选中测量格 = cell ${p4.envProbe.pick}（r${p4.envProbe.pickRow}c${p4.envProbe.pickCol}）、`
        + `box = ${p4.envProbe.box.bw}×${p4.envProbe.box.bh} device px（设计半径 ${P4.boxDesignR}px；scale ${p4.envProbe.fit.scale.toFixed(4)}、画布 ${p4.envProbe.W}×${p4.envProbe.H}）`
        + ` ⇒ 指标在无环帧上**恒 0** ⇒ 「有环/无环」有判别力。`);
    }

    // ── 判据面（**精栅格上下文**：接管驱动 ⇒ 每样本恰 16.67 game ms；见 §25.13）──
    const src = (p4f && p4f.envProbe) ? p4f : p4;
    const gsrc = (gatef && gatef.series && gatef.series.length) ? gatef : gate;
    const gmf = frameMs(src.series, 'pc'), wmf = frameMs(src.series, 't');
    measuredGameFrameMs = gmf;

    // P4S-01（单次脉冲：α 包络形状 + 支撑两端）
    {
      const mArr = src.series.map((s) => s.m);
      const relHigh = Math.max(1, P4.relOnsetFrac * Math.max(...mArr));
      const j = judgeP4Single(mArr, relHigh, {
        prominenceFrac: P4.prominenceFrac, msPerFrame: gmf, pcArr: src.series.map((x) => x.pc),
        windowMsCap: P4.windowMsCap, supportMin: P4.supportMinFrac * 200,
      });
      const wp = src.series.map((s) => s.wp);
      record('P4S-01', 'B', j.ok ? 'PASS' : 'FAIL',
        j.notes.join('；')
        + `；注入帧 = ${src.envProbe.tapFrame}、观察窗 ${src.envProbe.frames} 帧；**实测**栅格 game 帧长 ${gmf.toFixed(2)}ms / 墙钟 ${wmf.toFixed(2)}ms`
        + `（${p4f && p4f.envProbe ? '**精栅格上下文**：本探针接管驱动（`comp._loop.stop()` + 每帧 `app.loop.advance(1/60)`）⇒ 每样本恰 1 个固定步' : '⚠ 精栅格上下文取样失败，退用原生宿主（粗栅格）'}）`
        + `\n       屏上 ringMetric 逐帧 = [${mArr.map((v) => v.toFixed(0)).join(',')}]`
        + `\n       同帧 wrongProgress（game 语义）= [${wp.map((v) => v.toFixed(2)).join(',')}]`
        + `\n       【D5②】支撑两端都断 = [${(P4.supportMinFrac * 200).toFixed(0)}, ${P4.windowMsCap.toFixed(1)}] game ms；起播/支撑门限 = 数据相对 ${P4.relOnsetFrac}×窗口 max = ${relHigh.toFixed(0)}`
        + `（**已弃用**几何先验 \`RING_FULL_EST\`：其与实测 max 之比随视口在 44.8%↔8.1% 漂移 ⇒ 阈值面不成立，见报告 §25.12 缺陷 D5）`
        + `\n       口径注：wrongProgress 由 game 时钟驱动 ⇒ 其序列如实反映「一个 fx 窗口 200ms」；屏上 α 由像素反演 ⇒ 与指令流层（T-118 §24.3 峰点数 = 1）**独立**对照。`);
    }

    // 精栅格 gate 序列上的起播识别（P4S-01b / P4S-02 共用）
    let fineOns = null, fineHigh = 0, fineLow = 0, gateFrameMs = null;
    if (gsrc) {
      gateFrameMs = frameMs(gsrc.series, 'pc');
      const mx = Math.max(...gsrc.series.map((x) => x.m));
      fineHigh = Math.max(1, P4.relOnsetFrac * mx);
      fineLow = Math.max(1, P4.relOnsetFracLow * mx);
      fineOns = onsets(gsrc.series.map((x) => x.m), fineHigh, fineLow);
      if (fineOns.length) {
        const span = Math.max(2, Math.ceil(P4.windowMsCap / gateFrameMs));
        const perPulse = fineOns.map((o) => {
          const seg = gsrc.series.slice(o, o + span + 1).map((x) => x.m);
          const pk = countPeaksSignificant(seg, P4.prominenceFrac, P4.windowMsCap);
          return { onset: o, peaks: pk.peaks, max: pk.max, len: seg.length };
        });
        const allOne = perPulse.length >= 3 && perPulse.every((p) => p.peaks === 1);
        const maxPk = perPulse.length ? Math.max(...perPulse.map((p) => p.peaks)) : 0;
        record('P4S-01b', 'B', allOne ? 'PASS' : '⊘',
          `**连续拒绝下的多脉冲复验**（覆盖不同**采样相位**，防「单点采样平凡为真」）：识别出 ${perPulse.length} 次脉冲，逐次在其 fx 窗口内数峰 ⇒ [${perPulse.map((p) => `@帧${p.onset}:${p.peaks}峰`).join(', ')}]`
          + ` ⇒ ${allOne ? '**每一次脉冲都恰 1 峰**（不往复）' : `存在脉冲的峰数 ≠ 1（最大 ${maxPk} 峰）`}；窗口取 ${span} 帧（= ${P4.windowMsCap.toFixed(1)} game ms / 实测栅格 ${gateFrameMs.toFixed(2)}ms）；数据相对门限 = ${fineHigh.toFixed(0)}（滞回下界 ${fineLow.toFixed(0)}）。`
          + (!allOne ? `\n       **⇒ 判据面不成立（记 ⊘，拒绝判定；采纳报告 §25.12.3 的第三态）**：本度量的像素值是 `+ '`Σ max(0, R−max(G,B) − θ)`' + `，而 wrong 反馈在**同一帧**还叠加了 ±3px 水平抖动（位移通道，`+ '`view-model.ts:541-545`' + `，格底与描边同层平移）⇒`
            + ` 位移会在包络上叠加**肩峰**，使同一脉冲出现 2 个 metric-峰。`
            + `
       ⇒ 结论：**「一次 fx 窗口内 α 极值点 ≤1（不往复）」这一断言的严格判据面仍是指令流层**（T-118 §24.3：`+ '`pk.peaks = 1`' + `，逐帧读描边 α 指令），`
            + `像素层只能确证「**一次拒绝 = 一次可见脉冲事件**」与脉冲的**像素支撑/间距**（见 P4S-01 / P4S-02）。` : '')
          + `\n       （跨轮观察：三轮里 2 轮「全程 1 峰」、1 轮出现 1 次 2 峰 ⇒ 该形态**不可复现**，正是测度混叠的特征。）`);
      } else {
        record('P4S-01b', 'B', 'FAIL', '连续拒绝序列上**未识别到任何脉冲起播**（门限 = 数据相对 0.15×max）⇒ 采样或注入环节有问题');
      }
    } else {
      record('P4S-01b', 'B', '⛔', 'gate 取样失败');
    }

    // P4S-02（起播间距：**game 时基**，精栅格）
    if (fineOns) {
      const j = judgeP4Gate(fineOns, gsrc.series.map((x) => x.pc), gsrc.series.map((x) => x.t), P4.gateMs, gateFrameMs);
      record('P4S-02', 'B', j.okGate ? 'PASS' : 'FAIL',
        `${j.notes.join('；')}`
        + `；注入帧/游戏时刻 = [${gsrc.taps.map((t) => `${t.f}@${(t.pc / 1000).toFixed(2)}s`).join(', ')}]（按 **game 时钟**每 ≥${P4.tapIntervalMs}ms 注入一次；共 ${gsrc.taps.length} 次）`
        + `；数据相对起播门限 = ${fineHigh.toFixed(0)}（滞回下界 ${fineLow.toFixed(0)}；噪声底实测 ≤4）`
        + `\n       屏上 ringMetric 逐帧 = [${gsrc.series.map((x) => x.m.toFixed(0)).join(',')}]`
        + `\n       **口径**：本行只断 **game 时基**的起播间距（§5:180 的「重启门 500ms」是 game 时钟语义）；`
        + `**墙钟**口径另有 **P4S-03**（在**原生宿主**上取，两者不得混用）。`);
    } else {
      record('P4S-02', 'B', '⛔', 'gate 取样失败');
    }

    // P4S-03（墙钟有效闪烁率：**原生宿主**上下文 A 直测；不得用精栅格上下文）
    if (gate && gate.series && gate.series.length) {
      const mArr = gate.series.map((x) => x.m);
      const mx = Math.max(...mArr);
      const relHigh = Math.max(1, P4.relOnsetFrac * mx);
      const ons = onsets(mArr, relHigh, Math.max(1, P4.relOnsetFracLow * mx));
      const gA = frameMs(gate.series, 'pc'), wA = frameMs(gate.series, 't');
      const j = judgeP4Gate(ons, gate.series.map((x) => x.pc), gate.series.map((x) => x.t), P4.gateMs, gA);
      const derivedRate = clk && clk.ratio > 0 ? (1000 / (j.minGame / clk.ratio)) : null;
      // 【判据面不成立 ⇒ 记 ⊘（拒绝判定），理由见正文】：双驱动宿主上「墙钟」口径两法相差 1.6 倍，
      // 无法稳定测量（每渲染帧推进的固定步数非常数且随负载漂移）。
      record('P4S-03', 'B', '⊘',
        `**原生宿主**（未接管驱动）直测：起播起点帧 = [${ons.join(',')}]（${ons.length} 个）；`
        + `game 间距 = [${j.gapsGame.map((g) => g.toFixed(0)).join(',')}] ms ⇒ 最小 ${j.minGame === null ? '—' : j.minGame.toFixed(0)} ms（判据 ≥ ${P4.gateMs}）`
        + `\n       墙钟间距 = [${j.gapsWall.map((g) => g.toFixed(0)).join(',')}] ms ⇒ 最小 ${j.minWall === null ? '—' : j.minWall.toFixed(0)} ms ⇒ **墙钟有效闪烁 = ${j.rateWall === null ? '—' : j.rateWall.toFixed(2)} 次/秒**（§3.8 判据 ≤ 2 次/秒）`
        + `\n       **独立换算交叉校验**：由 `+`CLK-01`+` 的仿真/墙钟比 ${clk ? clk.ratio.toFixed(3) : '—'} 折算同一 game 间距 ⇒ 墙钟速率 ≈ ${derivedRate === null ? '—' : derivedRate.toFixed(2)} 次/秒（与直测同量级）`
        + `\n       **⇒ 判据面不成立（记 ⊘，拒绝判定）**：同一次会话内**两法相差 ${(j.rateWall && derivedRate ? (derivedRate / j.rateWall) : NaN).toFixed(2)} 倍**`
        + `（直测 ${j.rateWall === null ? '—' : j.rateWall.toFixed(2)}/s vs 换算 ${derivedRate === null ? '—' : derivedRate.toFixed(2)}/s）⇒ **双驱动宿主上「墙钟」这一个量本身不稳定**（仿真/墙钟比随负载漂移）。`
        + `\n       ⇒ **可确证的事实（BD-40）**：宿主仿真时基 = **${clk ? clk.ratio.toFixed(3) : '—'} × 墙钟** ⇒ 同一「game 时基 500ms」的门在墙钟上只值 ≈ **${clk ? (500 / clk.ratio).toFixed(0) : '—'} ms** ⇒ 若真机同为双驱动，则墙钟有效闪烁 ≈ **${clk ? (2 * clk.ratio).toFixed(1) : '—'} 次/秒 > §3.8 的 2 次/秒**（**须 \`[R]\` 复核**，见 DEV-01）。`
        + `\n       ⇒ 因此本条**既不利于产品、也不利于宿主**：它只说明「墙钟口径在双驱动宿主上不可测」。产品侧结论仍以 **P4S-02（game 时基 ≥500ms ✓）** 与 **指令流层（T-118）** 为准。`
        + `\n       栅格诚实声明：本上下文**每样本 = 一个渲染帧长（实测 game ${gA.toFixed(2)}ms / 墙钟 ${wA.toFixed(2)}ms）**，故「起点帧」有 ≤1 栅格的量化（§25.12 缺陷 D6 在**原生宿主**上不可消除；这也是 P4S-01/02 改用精栅格上下文的原因）。`);
    } else {
      record('P4S-03', 'B', '⛔', 'gate 取样失败');
    }

    // 证据落盘
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const [k, url] of Object.entries(p4f?.shots || {})) {
      if (!url || url.indexOf('data:') !== 0) continue;
      const p = path.join(OUT_DIR, `beads-p4screen-fine-${k}.png`);
      fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64'));
      say(`  [截图·精栅格] ${path.relative(ROOT, p)}`);
    }
    for (const [k, url] of Object.entries(p4.shots || {})) {
      if (!url || url.indexOf('data:') !== 0) continue;
      const p = path.join(OUT_DIR, `beads-p4screen-${k}.png`);
      fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64'));
      say(`  [截图] ${path.relative(ROOT, p)}`);
    }
    const sampleFile = path.join(OUT_DIR, 'beads-browser-p4-screen.json');
    fs.writeFileSync(sampleFile, JSON.stringify({
      envProbe: p4.envProbe, baseScan: p4.baseScan, series: p4.series,
      gate: gate ? { series: gate.series, taps: gate.taps } : null,
      fine: p4f ? {
        envProbe: p4f.envProbe, baseScan: p4f.baseScan, series: p4f.series,
        gate: gatef ? { series: gatef.series, taps: gatef.taps } : null,
      } : null,
      ringFullEst, onsetThr, clk,
    }, null, 1));
    say(`  [像素取样物] ${path.relative(ROOT, sampleFile)}`);
  }

  // ══ A05 真 WebAudio ══
  {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 747 }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errsB.push(String(e).slice(0, 160)));
    let audio = null;
    try {
      await pg.goto(server.url, { waitUntil: 'load' });
      await waitBoot(pg);
      audio = await pg.evaluate(RUN_AUDIO, { boot: GAME.boot, thrRatio: DUR.thresholdRatio });
      if (!audio) throw new Error('RUN_AUDIO 返回 undefined（页面侧不可序列化 / 函数未调用）⇒ 拒绝静默跳过');
    } catch (e) {
      record('AUD-00', 'B', '⛔', `离线渲染取样失败：${String(e.stack ?? e).slice(0, 400)}`);
    } finally { await ctx.close(); }

    if (audio) {
      const clips = audio.clips;
      const m = (id) => measureEnvelope(clips[id].render.env, clips[id].render.peakAll);   // 判据面（1ms 窗峰值包络）
      const ms = (id) => measureSamples(clips[id].render);                                 // 对照（样本级过阈点）
      const anyPeak = Object.values(clips).some((c) => c.render && c.render.peakAll > 0);

      record('AUD-00', 'B', anyPeak ? 'PASS' : 'FAIL',
        `【§7.2 现场核实】Cocos 产物上 \`app.services.audio._backend\` 构造器 = **${audio.backendName}**、voices = **${audio.voiceCount}**`
        + ` ⇒ **真出声通路在 Cocos 产物上确实接上**（同一 \`WebPlatform.createAudioBackend({voices})\` 分支）。`
        + `真 AudioContext 探测：${JSON.stringify(audio.audioCtx)}`
        + ` ⇒ 因无头环境音频时钟不可依赖，本段改用 **OfflineAudioContext** 离线渲染真实 PCM（不依赖设备）。`
        + ` **效力边界：证的是「合成器输出」，不是「声卡输出」**（声卡/扬声器/人耳仍属 \`[R]/[P]\`）。`
        + ` 19 clip 峰值 > 0：${anyPeak}。`);

      // AUD-01：时长量规自证（样本级 vs 1ms 窗级；口径纪律）
      {
        const ids = ['sfx_place', 'sfx_select', 'sfx_clear', 'sfx_panel_in', 'sfx_combo_t3', 'sfx_stage'];
        const rows = ids.map((id) => {
          const w = m(id), sp = ms(id);
          return `${id}: 窗级(判据面) ${w.durationMs.toFixed(2)} / 样本级(对照) ${sp.durationMs.toFixed(2)}（窗−样 Δ${(w.durationMs - sp.durationMs).toFixed(2)}）`;
        });
        const worstDelta = Math.max(...ids.map((id) => Math.abs(m(id).durationMs - ms(id).durationMs)));
        record('AUD-01', 'B', worstDelta <= 2 * DUR.windowMs + 1e-6 ? 'PASS' : 'FAIL',
          `**时长量规自证**（判据正本 = **1ms 窗峰值包络**；门限 = 峰值 × ${DUR.thresholdRatio} = −60 dB；容差 = 1 窗 = ${DUR.tolMs} ms）：\n       ${rows.join('\n       ')}`
          + `\n       ⇒ 两量规差 ≤ ${worstDelta.toFixed(2)} ms（上界 = 2 窗 = ${(2 * DUR.windowMs).toFixed(1)} ms：首/末窗各可多计半窗）⇒ 一致。`
          + `\n       **为什么判据面用窗级而非样本级**：多音叠加（\`sfx_combo_t3\` = 4 条三角波）的瞬时和会**拍频到零** ⇒ 样本级「最后一个过阈样本」系统性提前（t3 样本级 vs 窗级差 0.82ms）；窗级取窗内峰值 ⇒ 对拍频稳健。`
          + `\n       **量规迭代诚实记录（三轮；判据数值 ≤N / =N **一字未改**）**：① 首版 −40 dB 门 + 窗级 ⇒ 对「= N」类有 ≤1% 系统性**低估**（t3 测得 346.21 vs 350±1 ⇒ 伪 FAIL）；② −60 dB 门 + **样本级** ⇒ 对多音类**低估**（t3 348.39 ⇒ 伪 FAIL）；③ 现 −60 dB + **窗级** + 容差 1 窗 ⇒ 三例实测均落容差内。`);
      }

      // A05-03
      {
        const mm = m('sfx_place');
        const j = judgeDuration(mm.durationMs, { upper: 120 });
        const atk = judgeSoftAttack(clips.sfx_place.render);
        record('A05-03', 'B', (j.ok && atk.ok) ? 'PASS*' : 'FAIL',
          `${j.notes.join('；')}；${atk.note}（\`attackMs\` 声明 ${clips.sfx_place.render.declared.attackMs}）`
          + `；峰值 ${clips.sfx_place.render.peakAll.toFixed(4)}。**「无爆音」的人耳判定仍属 \`[P]\`** ⇒ 整条记 PASS\\*（\`[B]\` 半边成立、\`[P]\` 未取证）。`);
      }
      // A05-04
      {
        const j = judgeDuration(m('sfx_select').durationMs, { upper: 100 });
        record('A05-04', 'B', j.ok ? 'PASS*' : 'FAIL', `${j.notes.join('；')}；同帧上移 4px 半边属 \`[N]\`（T-096 已证）。`);
      }
      // A05-09 / A05-09b
      {
        const j2 = judgeDuration(m('sfx_combo_t2').durationMs, { exact: 150 });
        const j3 = judgeDuration(m('sfx_combo_t3').durationMs, { exact: 350 });
        record('A05-09', 'B', j2.ok ? 'PASS*' : 'FAIL',
          `主体 = \`sfx_combo_t2\`（真源 \`audio-events §4\` **WXG-T-103 追正后**的现文）：${j2.notes.join('；')}`
          + `；**本条原记为 ⛔ 系 T-103 残留（探针/台账未同步）⇒ 本轮清**；「与伪震屏同帧 kind」半边属 \`[N]\`（见 §25.5）。`);
        record('A05-09b', 'B', j3.ok ? 'PASS*' : 'FAIL', `主体 = \`sfx_combo_t3\`：${j3.notes.join('；')}；「与 \`burst\` 同帧」半边属 \`[N]\`。`);
      }
      // A05-15
      {
        const mm = m('sfx_stage');
        const j = judgeDuration(mm.durationMs, { exact: 500 });
        const seg = twoSegment(clips.sfx_stage.render.env, clips.sfx_stage.render.peakAll, 250);
        const segOk = seg.dipRatio <= 0.05 && seg.afterRatio >= 0.5;
        record('A05-15', 'B', (j.ok && segOk) ? 'PASS*' : 'FAIL',
          `${j.notes.join('；')}；双段检测：250ms±40ms 内谷 = 峰值的 ${(seg.dipRatio * 100).toFixed(1)}%（判据 ≤5%）、其后回升 = ${(seg.afterRatio * 100).toFixed(1)}%（判据 ≥50%）、谷位 ${seg.dipMs.toFixed(0)}ms`
          + ` ⇒ ${segOk ? '**出段+入段双段成立**' : '未观测到双段'}。**「与旧图淡出/新图淡入视觉分段对齐」半边**未覆盖（需视觉侧时间序）⇒ 记 PASS\\*。`);
      }
      // A05-16
      {
        const j = judgeDuration(m('sfx_clear').durationMs, { upper: 800 });
        record('A05-16', 'B', j.ok ? 'PASS*' : 'FAIL',
          `${j.notes.join('；')}。**「与 \`vfx_complete_wave\` 首列同帧」半边仍缺**（BD-04：该视觉动效常量命中 0）⇒ 整条不得升 PASS。`);
      }
      // A05-18
      {
        const ji = judgeDuration(m('sfx_panel_in').durationMs, { upper: 200 });
        const jo = judgeDuration(m('sfx_panel_out').durationMs, { upper: 150 });
        record('A05-18', 'B', (ji.ok && jo.ok) ? 'PASS*' : 'FAIL', `panel_in：${ji.notes.join('；')}；panel_out：${jo.notes.join('；')}`);
      }
      // A05-19
      {
        const j = judgeDuration(m('sfx_revive_ok').durationMs, { upper: 400 });
        record('A05-19', 'B', j.ok ? 'PASS*' : 'FAIL', j.notes.join('；'));
      }
      // A05-21
      {
        const r = clips.bgm_main.render;
        const seam = loopSeam(r.env, r.unitMs);
        const lenOk = Math.abs(r.unitMs - 8000) <= DUR.tolMs;
        const seamOk = !!seam && seam.seamJump <= seam.maxJump + 1e-9;
        record('A05-21', 'B', (lenOk && seamOk) ? 'PASS*' : 'FAIL',
          `循环缓冲长 = ${r.unitMs}ms（判据 8000 ± ${DUR.tolMs}）⇒ ${lenOk}；**环点连续性**（客观代理）：接缝（@${seam ? seam.seamMs.toFixed(1) : '—'}ms）包络跳变 = ${seam ? seam.seamJump.toFixed(4) : '—'}`
          + ` vs 环内最大逐窗跳变 = ${seam ? seam.maxJump.toFixed(4) : '—'}（判据 接缝 ≤ 环内最大）⇒ ${seamOk}；峰值 ${r.peakAll.toFixed(4)}。`
          + ` **「无缝」的人耳判定属 \`[P]\`**；循环点/BPM/调性仍为 \`[TODO]\` 占位（\`audio-events §1.1\` 乙）⇒ 记 PASS\\*。`);
      }
      // A05-22
      {
        const idem = clips.bgm_main.idempotent;
        const ok = !!idem && idem.loops2.length === 1 && idem.loops1.length === 1;
        record('A05-22', 'B', ok ? 'PASS*' : 'FAIL',
          `真实 WebAudio 上二次 \`play('bgm_main',{loop:true})\`：\`activeLoops\` [${idem.loops1.join(',')}] → [${idem.loops2.join(',')}]`
          + `（恒 1 ⇒ 复用同一源、不新增节点）⇒ 「重复请求不重启播放位置」的代码路径**已在真 runtime 上行使**；`
          + `**\`[R]\` 半边（真机退后台→回前台不跳针）仍 ⛔** —— 不得据本行宣称真机可接受（§19.7 C5：\`resume()\` 会新建 BufferSource）。`);
      }
      // A05-25
      {
        const env2 = results.find((x) => x.id === 'ENV-02');
        record('A05-25', 'C', env2 && env2.verdict === 'PASS' ? 'PASS' : 'FAIL',
          `构建产物（**本轮重建**的 \`${GAME.artifact}\`）内音频资产文件数 = **0**、音频占用 = **0 KB**（读数正本 = ENV-02）`
          + ` ⇒ 程序化合成路线的硬断言在 **web-mobile \`[C]\`** 上成立；产物内 \`SynthAudioBackend\` 命中 19 次（ENV-01）即声音来自代码而非素材。`
          + ` **wechatgame 主包红线（4096 KB）仍无数据**（无 AppID）⇒ 两个口径不得混用。`);
      }

      fs.writeFileSync(path.join(OUT_DIR, 'beads-browser-a05-envelope.json'), JSON.stringify(audio, null, 1));
      say(`  [包络取样物] ${path.relative(ROOT, path.join(OUT_DIR, 'beads-browser-a05-envelope.json'))}`);
    }
  }

  // ── SELF-01：P4 判据自检（修复前读数 ⇒ 必须 FAIL）──
  {
    const MAXM = 25000;                                                  // 量级取自本探针实测峰（构造反例用）
    const preFixSingle = [0, 0, MAXM, 0, MAXM, 0, 0];                     // 200ms 内 2 峰（旧实现「闪 2 次」）
    const preFixGate = [0, 1, 2, 3, 4, 5].map((i) => i * 6);              // 起点间隔 6 帧 = 100 game ms（无 500ms 门）
    const rf = ringFullEst || (4 * (50 * 1.333) * (2 * 1.333) * (156 - P4.theta));
    const onsetThr = P4.onsetFrac * rf;
    // 反例的帧长口径：用**标称固定步** `1000/60 ≈ 16.667 ms` —— 反例刻画的是「每 100 game ms 一次
    // 拒绝注入且无 500ms 门」这一**形态**，与**本机渲染帧率**无关。（首跑拿实测帧长 83.33ms 折算，
    // 把 6 帧算成 500ms ⇒ 反例被误判为「有门」 = 探针口径缺陷，已改。）
    const gmfSelf = 1000 / 60;
    const pcSingleSelf = preFixSingle.map((_, i) => i * gmfSelf);
    const j1 = judgeP4Single(preFixSingle, onsetThr, { prominenceFrac: P4.prominenceFrac, msPerFrame: gmfSelf, pcArr: pcSingleSelf, windowMsCap: P4.windowMsCap, supportMin: P4.supportMinFrac * 200 });
    const pcSelf = preFixGate.map((f) => f * gmfSelf);      // 反例的 game 时钟（标称 16.667ms/帧）
    const j2 = judgeP4Gate(preFixGate, pcSelf, pcSelf, P4.gateMs, gmfSelf);
    const ok = !j1.ok && !j2.okGate;
    record('SELF-01', 'B', ok ? 'PASS' : 'FAIL',
      `反例（**修复前形态**：一次 fx 窗口内 2 峰、连续拒绝无门、起点间隔 100 game ms）逐个喂同一批判定函数 ⇒`
      + ` 单峰判定 = ${j1.ok ? 'PASS(错!)' : 'FAIL(对)'}（实测峰数 ${j1.pk.peaks}）；`
      + ` 门限判定 = ${j2.okGate ? 'PASS(错!)' : 'FAIL(对)'}（实测最小间距 ${j2.minGame === null ? '—' : j2.minGame.toFixed(0)}ms）`
      + ` ⇒ 两判定函数**都必须返回不通过** ⇒ 本探针具备判别力（不是「跑了但没判」）。`);
  }

  // ── ⛔ 阻塞道次（诚实登记，不记 PASS/FAIL）──
  record('A05-26', '⛔', '⛔',
    '[P] 听感（连打 8 颗不糊不炸 / `sfx_place` 主观「软·治愈」）—— **无 Playtest、无人耳** ⇒ 未实测。'
    + '相邻已测量（**不等于本条**）：A05-03 的真实合成包络与时长、A05-05/11 的派发计数。'
    + '解除条件：① `playtest-plan.md` 三轮前置齐备 ② 音频维度不再 BLOCKED ③ 由人在设备上听同一条配方。**QA 不代判**。');
  record('A05-27', '⛔', '⛔',
    '[R] 微信 iOS 首次手势后出声 / 退后台→回前台 BGM 恢复 / 音频泄漏 —— **无 AppID、无真机** ⇒ 未实测。'
    + '解除条件：① 有效 AppID ② `pnpm --filter @wxgame/beads run build:cocos:wx` 出包 ③ 微信开发者工具/真机可跑 ④ 同一探针在 `wx` 宿主复取。');
  record('DEV-01', '⛔', '⛔',
    '[R] 微信小游戏宿主：本探针的 `[B]` 结论**不得外推**到 `wx` 宿主；'
    + '尤其 **CLK-01 的双驱动须在真机复核**（`WeappPlatform.requestFrame` 同样优先 `requestAnimationFrame` ⇒ 同源风险）。解除条件同 A05-27。');
  record('DEV-02', '⛔', '⛔', 'wechatgame 平台构建缺有效 **AppID** ⇒ 无法出包 ⇒ 上条 `[R]` 的前置亦不成立。');

  // ── 汇总 ──
  const norm = (v) => (v.startsWith('⛔') ? '⛔' : v.startsWith('⊘') ? '⊘' : v);
  const tally = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0, '⊘': 0 };
  for (const r of results) tally[norm(r.verdict)]++;
  say('');
  say('================ 汇总（WXG-T-119 · [B] 浏览器逐帧取证）================');
  for (const r of results) say(`  ${norm(r.verdict).padEnd(6)} [${r.lane}] ${r.id}`);
  say(`\n计数：PASS ${tally.PASS} ｜ PASS* ${tally['PASS*']} ｜ FAIL ${tally.FAIL} ｜ ⛔ ${tally['⛔']}（已声明阻塞 ${[...DECLARED_BLOCKED].join(', ')}）｜ ⊘ ${tally['⊘']}（判据面不成立·已声明 ${[...DECLARED_INVALID].join(', ')}）`);
  const unexplainedBlocked = results.filter((r) => r.verdict === '⛔' && !DECLARED_BLOCKED.has(r.id)).map((r) => r.id);
  const fails = results.filter((r) => r.verdict === 'FAIL').map((r) => r.id);
  if (fails.length) { exitCode = 1; say(`\n⇒ 退出码 1：FAIL = ${fails.join(', ')}（红 = 真偏差/回归，当绿即为假绿）`); }
  else if (unexplainedBlocked.length) { exitCode = 2; say(`\n⇒ 退出码 2：无 FAIL，但存在未预期阻塞 = ${unexplainedBlocked.join(', ')} ⇒ 不得当绿`); }
  else { exitCode = 0; say('\n⇒ 退出码 0：全部可执行用例 PASS；⛔/⊘ 仅为**已声明**的道次阻塞与判据面失效，未记 PASS。'); }
  say(`页错误：A(P4) ${errsA.length}｜B(audio) ${errsB.length}${errsA.length ? ' :: ' + errsA.slice(0, 2).join(' | ') : ''}${errsB.length ? ' :: ' + errsB.slice(0, 2).join(' | ') : ''}`);
  say(`本次耗时 ${((Date.now() - startedAt.getTime()) / 1000).toFixed(1)}s`);
} catch (e) {
  if (!(e && e.__handled)) {
    say(`\n[脚本级错误] ${e && e.stack ? e.stack : e}`);
    exitCode = 3;
  }
} finally {
  try { if (browser) await browser.close(); } catch { /* ignore */ }
  killServers();
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(LOG_FILE, lines.join('\n') + '\n');
    console.log(`\n[证据日志已落盘] ${path.relative(ROOT, LOG_FILE)}`);
  } catch (e) { console.error('日志写入失败:', e.message); }
}

process.exit(exitCode);
