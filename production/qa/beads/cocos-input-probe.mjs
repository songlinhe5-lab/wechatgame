#!/usr/bin/env node
/**
 * WXG-T-108 · Cocos 宿主输入坐标取证固化 —— R1 / R2 / R3 可复跑 + breakout `[B]` 目视
 * 作者：严守真（quality-lead）　日期：2026-09-15　只读：不写 `packages/**` / `games/**` / `docs/**`
 *
 * ── 这文件解决什么 ────────────────────────────────────────────────────────────
 * WXG-T-104 修掉了 Cocos 宿主 **y 轴镜像 + ×dpr**（缺陷 C1），但复证只存在于主理人的
 * 一次性浏览器会话里 ⇒ 下次回归仍靠人肉。本脚本把 R1/R2/R3 **固化为可复跑**、
 * **自带断言**、**带退出码**的机器证据，并把 breakout 的 `[B]` 目视机械化（浏览器像素级）。
 *
 * ── 判据来源（唯一真源，逐字取，不自创）────────────────────────────────────────
 *   · `production/TASKS-DETAIL.md` §WXG-T-104 · A4「修复判据（可机验）」R1/R2/R3
 *   · `packages/framework/src/adapters/cocos/touch-normalize.ts` 文件头（实测语义）
 *   · `docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md` §3(e)
 *
 * ── 预期值先写、后跑（反假绿）──────────────────────────────────────────────────
 * 下面 EXPECTATIONS 段是**跑之前**就写好的（判据的算术推论），不是看输出回填的。
 * 另设 **SELF-01「判据自检」**：把 T-104 记录的**修复前**实测数字喂给同一批判定函数，
 * 断言它们**必须判 FAIL** —— 用反例证明本探针有判别力（本仓历史上吃过「判别力为零的探针」）。
 *
 * ── 道次（lane）与诚实边界 ────────────────────────────────────────────────────
 *   [N]  Node/无头浏览器逻辑层（本脚本多数用例）
 *   [B]  浏览器真实渲染（产物 + 真实 mouse 事件 + 截图 + 像素级断言）
 *   ⛔   **本环境做不了**，一律显式登记「阻塞 + 解除条件」，**不记 PASS 也不记 FAIL**
 *        · DEV-01 `[R]` 微信小游戏宿主（需 AppID + 真机 + `build:cocos:wx`）
 *        · DEV-02 wechatgame 平台构建（无 AppID）
 *
 * ── 退出码（红 = 失败）───────────────────────────────────────────────────────
 *   0 = 全部可执行用例 PASS（DECLARED_BLOCKED 内的 ⛔ 属预期阻塞，不影响退出码）
 *   1 = 存在 FAIL（真回归）
 *   2 = 无 FAIL，但存在**未预期阻塞 / 探针无效**（产物陈旧、句柄取不到、判别力不足…）——**不得当绿**
 *   3 = 脚本级环境错误（playwright / python3 / 产物缺失）
 *
 * ── 运行 ─────────────────────────────────────────────────────────────────────
 *   export PATH="$HOME/.workbuddy/binaries/node/workspace/node_modules/.bin:$PATH"
 *   node production/qa/beads/cocos-input-probe.mjs
 *   前置：产物须为**当前代码**所构建（脚本会自查新鲜度 + 镜像一致性 + 产物含归一化函数）
 *         pnpm --filter @wxgame/beads    run build:cocos:web
 *         pnpm --filter @wxgame/breakout run build:cocos:web
 *   可选参数：--out=<dir> 证据目录（默认 production/qa/beads/evidence）
 *            --log=<file> 日志（默认 <out>/cocos-input-probe.log）
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
const LOG_FILE = path.resolve(ROOT, argOf('log', path.join(OUT_DIR, 'cocos-input-probe.log')));
const ALLOW_STALE = argv.includes('--allow-stale');

const GAMES = {
  beads: {
    boot: 'BeadsBootstrap',
    artifact: 'games/beads/cocos/build/web-mobile',
    cacheVersion: 'games/beads/cocos/build/web-mobile/assets/main/index.js',
    // 与本用例相关的最小源集（新鲜度判定的输入链路）
    sources: ['packages/framework/src', 'games/beads/cocos/assets/scripts', 'games/beads/src'],
    mirror: [
      ['packages/framework/src/adapters/cocos/touch-normalize.ts',
        'games/beads/cocos/assets/scripts/framework/adapters/cocos/touch-normalize.ts'],
      ['packages/framework/src/adapters/cocos/bindings.ts',
        'games/beads/cocos/assets/scripts/framework/adapters/cocos/bindings.ts'],
    ],
  },
  breakout: {
    boot: 'BreakoutBootstrap',
    artifact: 'games/breakout/cocos/build/web-mobile',
    cacheVersion: 'games/breakout/cocos/build/web-mobile/assets/main/index.js',
    sources: ['packages/framework/src', 'games/breakout/cocos/assets/scripts', 'games/breakout/src'],
    mirror: [
      ['packages/framework/src/adapters/cocos/touch-normalize.ts',
        'games/breakout/cocos/assets/scripts/framework/adapters/cocos/touch-normalize.ts'],
      ['packages/framework/src/adapters/cocos/bindings.ts',
        'games/breakout/cocos/assets/scripts/framework/adapters/cocos/bindings.ts'],
    ],
  },
};

/**
 * 容差（先写）。理由：
 *  · pushPx = 1.5 —— T-104 A4 原文给的就是「±1.5 px」，且 Cocos 取整会丢 ≤1px。
 *  · hostPx = 1.5 —— 同上（宿主 getLocation 恒等式实测「容差 ≤1 px，Cocos 取整」）。
 *  · designPx = 6 —— 落到设计空间的回读：槽心由 62² 热区 bbox 以 2px 网格扫出（bbox 自身
 *    因邻居切边会偏 ~2px），再叠加页面点击取整 ⇒ 6 设计 px 内即算「点在槽心上」。
 *  · pixelCenterPx = 10 —— 像素级簇心（浏览器渲染 + PNG 解码）允许的偏差；见各用例备注。
 */
const TOL = { pushPx: 1.5, hostPx: 1.5, designPx: 6, pixelCenterPx: 10, discriminantPx: 100 };

/** 本环境**永不可验**的道次：登记为阻塞，不计入退出码（见文件头）。 */
const DECLARED_BLOCKED = new Set(['DEV-01', 'DEV-02']);

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

/**
 * EXPECTATIONS —— **跑之前**写好的判据算术推论（不是输出回填）。
 * 每条与 TASKS-DETAIL §WXG-T-104 A4 的 R1/R2/R3 逐字对应。
 */
const expectations = {
  'ENV-01': '产物 mtime 晚于全部输入链路源；framework:sync:check（镜像一致）exit=0；产物内 normalizeCocosTouch 命中 ≥1 次',
  'ENV-02': '同 ENV-01（breakout）',
  'SELF-01': '把 T-104 记录的**修复前**实测数字喂给判定函数 ⇒ 每个判定函数都必须返回 ok=false（否则本探针无判别力）',
  'HOST-01': `getLocation() == (clientX−rect.x)×dpr , (rect.y+rect.height−clientY)×dpr（±${TOL.hostPx}px）；且**不是**左上原点（反证 ≥${TOL.discriminantPx}px）`,
  'HOST-02': '同 HOST-01 @ dsf=2（引擎 dpr=2；window dpr=2）',
  'HOST-03': '同 HOST-01 @ dsf=3：**window dpr=3 但引擎封顶 2** ⇒ 恒等式用 dpr=2 成立、用 3 必偏 >60px',
  'HOST-03b': '封顶反证：按未封顶 window dpr=3 套同一恒等式 ⇒ 判定函数必须**否决**（否则口径无判别力）',
  'R1-01+R1-02': '点 slot0 可见屏幕位置 ⇒ traySelected===0 且 slot0.state==="selected"；点其上下镜像位置 ⇒ traySelected===-1；_pointer 回读 ≈ 槽心（±6 设计px）；判别力 guard：可见 y 与镜像 y 相差 ≥100px',
  'R1-03+R1-04': '同 R1-01/R1-02 判据，但在 500×1000（offsetY>0 纵向信箱）下成立',
  'R3-02（=R1 端到端 @ dsf=2）': 'R1 端到端在 dsf=2 成立（可见点命中 / 镜像点不命中）',
  'R3-03（=R1 端到端 @ dsf=3）': 'R1 端到端在 dsf=3（引擎封顶 2）成立',
  'R1-01': '点 slot0 的**可见**屏幕位置 ⇒ traySelected===0 且 slot0.state==="selected"',
  'R1-02': '点其**上下镜像**位置 ⇒ traySelected===-1（修前此处才命中）',
  'R1-03': 'R1 同判据 @ 500×1000（offsetY>0 信箱）⇒ 可见点命中',
  'R1-04': 'R1 反证 @ 500×1000 ⇒ 镜像点不命中',
  'R2-01': `每次点击的 push.x≈pageX−rect.x、push.y≈pageY−rect.y（±${TOL.pushPx}px，两次点击都要成立：镜像点 + 可见点）；且 push.y **不等于** canvasH−pageY（差 ≥${TOL.discriminantPx}px）`,
  'R3-01': `dsf=1/2/3 同一页面点 ⇒ push 坐标两两一致且都 ≈ 页面坐标（±${TOL.pushPx}px）；且 dsf≥2 时 raw≈page×dpr（证明 ÷dpr 真被行使）`,
  'R3-02': 'R1 端到端在 dsf=2 成立（可见点命中 / 镜像点不命中）',
  'R3-03': 'R1 端到端在 dsf=3（引擎封顶 2）成立',
  'B-01': '[B] 点镜像位置后，托盘带（槽行屏幕行区间）像素**零变化**（渲染层反证）',
  'B-02': `[B] 点可见位置后，托盘带变化簇心 ≈ 该点屏幕 x（±${TOL.pixelCenterPx}px）且簇宽 ≤ 40px`,
  'B-03': `[B] breakout 挡板跟手（模型层）：paddle.x ≈ 点击点反解的设计 x（±${TOL.designPx} 设计 px），两个位置都要成立`,
  'B-04': `[B] breakout 像素级：挡板渲染亮像素簇心 ≈ 期望屏幕 x（±${TOL.pixelCenterPx}px），两位置位移差 ≈ 设计位移×scale`,
  'BR-01': 'breakout 数据流：dsf=1 与 dsf=2 下 push 均 ≈ 页面坐标（修前 dsf=2 为 ×2）',
  'DEV-01': '⛔ 阻断：无 AppID / 无真机 / 未跑 build:cocos:wx ⇒ 未实测，不得记 PASS 或 FAIL',
  'DEV-02': '⛔ 阻断：wechatgame 平台构建缺有效 AppID',
};

// ═══════════════════════════════════════════════════════════════ 判定函数（纯）
// 判定与取样解耦：同一批函数既判「现网样本」，也判 SELF-01 的「修复前反例样本」。

/** rect 允许 {x,y,width,height} 或 {x,y,w,h} 两种形状（getBoundingClientRect / 归一化后）。 */
const rectW = (r) => (r.width ?? r.w);
const rectH = (r) => (r.height ?? r.h);

function judgeHost(s) {
  const notes = [];
  const ex = { x: (s.clientX - s.rect.x) * s.engineDpr, y: (s.rect.y + rectH(s.rect) - s.clientY) * s.engineDpr };
  const d = { x: Math.abs(s.raw.x - ex.x), y: Math.abs(s.raw.y - ex.y) };
  notes.push(`raw=(${s.raw.x},${s.raw.y}) vs 左下原点 device-px 式=(${ex.x.toFixed(1)},${ex.y.toFixed(1)}) Δ=(${d.x.toFixed(1)},${d.y.toFixed(1)})`);
  const topLeft = { x: (s.clientX - s.rect.x) * s.engineDpr, y: (s.clientY - s.rect.y) * s.engineDpr };
  const disc = Math.abs(s.raw.y - topLeft.y);
  notes.push(`反证：与「左上原点」式 y=(${topLeft.y.toFixed(1)}) 相差 ${disc.toFixed(1)}px（须 ≥${TOL.discriminantPx}）`);
  const ok = d.x <= TOL.hostPx && d.y <= TOL.hostPx && disc >= TOL.discriminantPx;
  return { ok, notes };
}

function judgeR1(s) {
  const notes = [];
  const visOk = s.visible.traySelected === s.slot && s.visible.slotState === 'selected';
  const mirOk = s.mirror.traySelected === -1;
  const ptrOk = Math.abs(s.visible.pointer.x - s.P.x) <= TOL.designPx
    && Math.abs(s.visible.pointer.y - s.P.y) <= TOL.designPx;
  notes.push(`点可见点 (${s.visible.page.x.toFixed(1)},${s.visible.page.y.toFixed(1)}) ⇒ traySelected=${s.visible.traySelected}（期望 ${s.slot}）、slot${s.slot}.state=${s.visible.slotState}（期望 selected）、_pointer=(${s.visible.pointer.x.toFixed(2)},${s.visible.pointer.y.toFixed(2)}) vs 槽心 (${s.P.x},${s.P.y})`);
  notes.push(`点镜像点 (${s.mirror.page.x.toFixed(1)},${s.mirror.page.y.toFixed(1)}) ⇒ traySelected=${s.mirror.traySelected}（期望 -1）、_pointer=(${s.mirror.pointer.x.toFixed(2)},${s.mirror.pointer.y.toFixed(2)})、该点离槽心 ${Math.hypot(s.mirror.pointer.x - s.P.x, s.mirror.pointer.y - s.P.y).toFixed(1)} 设计px`);
  const disc = Math.abs(s.S.y - (s.canvasCssH - s.S.y));
  notes.push(`判别力 guard：可见 y=${s.S.y.toFixed(1)} vs 镜像 y=${(s.canvasCssH - s.S.y).toFixed(1)}，相差 ${disc.toFixed(1)}px（须 ≥${TOL.discriminantPx}）`);
  return { ok: visOk && mirOk && ptrOk && disc >= TOL.discriminantPx, notes };
}

/**
 * R2 数据流：每次点击的 push(down) 都必须 ≈ 该次点击的页面相对坐标（±1.5px），
 * 且**不得**等于旧口径 `canvasH − pageY`（差 ≥100px ⇒ 证明不是镜像值）。
 * 传入多次点击的样本（镜像点 + 可见点）——两次都要成立。
 */
function judgeR2(samples) {
  const notes = [];
  let ok = true;
  for (const s of samples) {
    const exX = s.page.x - s.rect.x;
    const exY = s.page.y - s.rect.y;
    const mirrorY = s.canvasCssH - exY;
    const d = { x: Math.abs(s.push.x - exX), y: Math.abs(s.push.y - exY) };
    const disc = Math.abs(s.push.y - mirrorY);
    const thisOk = d.x <= TOL.pushPx && d.y <= TOL.pushPx && disc >= TOL.discriminantPx;
    ok = ok && thisOk;
    notes.push(`点页面 (${s.page.x.toFixed(1)},${s.page.y.toFixed(1)}) ⇒ push(down)=(${s.push.x},${s.push.y}) vs 页面相对 (${exX.toFixed(1)},${exY.toFixed(1)}) Δ=(${d.x.toFixed(1)},${d.y.toFixed(1)})`
      + `；反镜像 guard：push.y vs 旧式 (canvasH−pageY)=${mirrorY.toFixed(1)} 相差 ${disc.toFixed(1)}px（须 ≥${TOL.discriminantPx}）${thisOk ? '' : ' ✗'}`);
  }
  return { ok, notes };
}

function judgeR3(samples) {
  const notes = [];
  let ok = true;
  for (const s of samples) {
    const d = { x: Math.abs(s.push.x - (s.pageX - s.rect.x)), y: Math.abs(s.push.y - (s.pageY - s.rect.y)) };
    const rawEx = s.pageX * s.engineDpr;
    const guard = s.engineDpr > 1 ? Math.abs(s.raw.x - rawEx) <= TOL.hostPx : true;
    ok = ok && d.x <= TOL.pushPx && d.y <= TOL.pushPx && guard && s.visible.traySelected === 0 && s.mirror.traySelected === -1;
    notes.push(`dsf=${s.dsf}（window dpr=${s.windowDpr} / 引擎 dpr=${s.engineDpr}，backing ${s.backing.w}×${s.backing.h}）: push=(${s.push.x},${s.push.y}) vs 页面 (${s.pageX - s.rect.x},${s.pageY - s.rect.y})；raw.x=${s.raw.x} vs page×dpr=${rawEx.toFixed(0)}；可见点 traySelected=${s.visible.traySelected}/镜像=${s.mirror.traySelected}`);
  }
  const xs = samples.map((s) => s.push.x);
  const ys = samples.map((s) => s.push.y);
  const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  notes.push(`三档 push 两两最大差 ${spread.toFixed(1)}px（须 ≤${TOL.pushPx}）`);
  ok = ok && spread <= TOL.pushPx;
  return { ok, notes };
}

// ═══════════════════════════════════════════════════════════════ 工具
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function newestMtime(dir, filter, skip = []) {
  let newest = { t: 0, f: null };
  const walk = (d) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (skip.some((s) => p.includes(s))) continue;
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
    try { return require(require.resolve('playwright', { paths: [c] })); } catch (e) { errs.push(`${c}: ${e.message.slice(0, 80)}`); }
  }
  try { return require('playwright'); } catch (e) { errs.push(`bare: ${e.message.slice(0, 80)}`); }
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

/**
 * 起静态服务并**校验服务的确是本产物**（防止：上次被强杀留下的服务占着端口，
 * 或端口上跑的是另一款游戏的产物 ⇒ 验错对象却报绿）。已存在且标记正确则沿用（不接管、不杀）。
 */
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

/** 浏览器内注册：PNG 解码 + 两个像素分析器（截图由 Node 侧拍，base64 传入）。 */
const PX_HELPERS = () => {
  const dec = async (b64) => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u8], { type: 'image/png' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    return { data: g.getImageData(0, 0, bmp.width, bmp.height), w: bmp.width, h: bmp.height };
  };
  window.__px = {
    /** 两图在 [y0,y1] 行区间内的逐列差异 → 连续簇 */
    async diffBand(a, b, y0, y1, minCol = 2) {
      const A = await dec(a), B = await dec(b);
      const w = Math.min(A.w, B.w), h = Math.min(A.h, B.h);
      const counts = new Array(w).fill(0);
      let changed = 0;
      for (let y = y0; y <= Math.min(y1, h - 1); y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * A.w + x) * 4;
          const j = (y * B.w + x) * 4;
          const d = Math.abs(A.data.data[i] - B.data.data[j])
            + Math.abs(A.data.data[i + 1] - B.data.data[j + 1])
            + Math.abs(A.data.data[i + 2] - B.data.data[j + 2]);
          if (d > 30) { counts[x]++; changed++; }
        }
      }
      const clusters = [];
      let run = null;
      for (let x = 0; x < w; x++) {
        if (counts[x] >= minCol) { if (!run) run = { x0: x, x1: x }; else run.x1 = x; }
        else if (run) { clusters.push(run); run = null; }
      }
      if (run) clusters.push(run);
      return {
        changed, size: { w, h }, rows: [y0, y1],
        clusters: clusters.map((c) => ({ ...c, width: c.x1 - c.x0 + 1, center: (c.x0 + c.x1) / 2 })),
      };
    },
    /** 单图在 [y0,y1]×[x0,x1] 窗口内的「亮像素」簇心（挡板类：浅色物体在近黑底上） */
    async brightBand(b64, y0, y1, x0, x1, thr = 90) {
      const A = await dec(b64);
      const X0 = Math.max(0, x0), X1 = Math.min(A.w - 1, x1);
      const Y1 = Math.min(A.h - 1, y1);
      let sum = 0, n = 0, minX = 1e9, maxX = -1e9;
      const colCount = new Array(A.w).fill(0);
      for (let y = y0; y <= Y1; y++) {
        for (let x = X0; x <= X1; x++) {
          const i = (y * A.w + x) * 4;
          const luma = 0.2126 * A.data.data[i] + 0.7152 * A.data.data[i + 1] + 0.0722 * A.data.data[i + 2];
          if (luma > thr) { sum += x; n++; colCount[x]++; if (x < minX) minX = x; if (x > maxX) maxX = x; }
        }
      }
      return { centroid: n ? sum / n : NaN, count: n, span: n ? [minX, maxX] : null, size: { w: A.w, h: A.h }, colCount };
    },
  };
};

// ═══════════════════════════════════════════════════════════════ 取样：beads 一个上下文
async function runBeadsContext(browser, url, { dsf, viewport }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
  const out = { dsf, viewport, pageErrors };
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction((boot) => {
      const cc = window.cc;
      if (!cc) return false;
      const s = cc.director.getScene();
      if (!s || !s.getChildByName('Canvas')) return false;
      const r = s.getChildByName('Canvas').getChildByName('GameRoot');
      if (!r) return false;
      const c = r.getComponent(cc.js.getClassByName(boot));
      return !!(c && c._app && c._app.game.snapshot.phase === 'playing');
    }, GAMES.beads.boot, { timeout: 25000 });
    await page.evaluate(PX_HELPERS);

    // 前置：槽 0 必须有珠（空槽 select() 恒 'invalid' —— T-104 已记录的坑）；打桩 push；记 raw
    out.pre = await page.evaluate((boot) => {
      const cc = window.cc;
      const app = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot')
        .getComponent(cc.js.getClassByName(boot))._app;
      const canvas = document.getElementById('GameCanvas');
      const rect = canvas.getBoundingClientRect();
      const g = app.game;
      if (g.snapshot.traySlots[0].state === 'free') g.giveTrayBead(1);   // debug hook，只影响槽内容
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, n = 0;
      for (let x = 0; x <= 750; x += 2) {
        for (let y = 0; y <= 1334; y += 2) {
          if (g._hitTraySlot(x, y) === 0) {
            n++;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      const P = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      const S = { x: 0, y: 0 };
      app.viewport.designToScreen(S, P.x, P.y);
      window.__pushes = [];
      const orig = app.input.push.bind(app.input);
      app.input.push = (ev) => { window.__pushes.push({ x: ev.x, y: ev.y, phase: ev.phase }); return orig(ev); };
      window.__raw = [];
      cc.director.getScene().getChildByName('Canvas').on('touch-start', (e) => {
        const l = e.getLocation();
        window.__raw.push({ x: l.x, y: l.y, t: Date.now() });
      });
      return {
        winDpr: window.devicePixelRatio,
        engineDpr: cc.screen.devicePixelRatio,
        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        canvasCss: { w: canvas.clientWidth, h: canvas.clientHeight },
        backing: { w: canvas.width, h: canvas.height },
        fit: { ...app.viewport.fit },
        P, S,
        slot0: g.snapshot.traySlots[0].state,
        traySig: g.snapshot.traySlots.map((s) => s.state).join(','),
        bbox: { minX, maxX, minY, maxY, n },
        phase: g.snapshot.phase,
      };
    }, GAMES.beads.boot);

    const visPage = { x: out.pre.rect.x + out.pre.S.x, y: out.pre.rect.y + out.pre.S.y };
    const mirPage = { x: out.pre.rect.x + out.pre.S.x, y: out.pre.rect.y + (out.pre.canvasCss.h - out.pre.S.y) };
    out.visPage = visPage; out.mirPage = mirPage;

    // 截图 A（未选中）→ 点镜像点 → 截图 C（应零变化）→ 点可见点 → 截图 B（槽 0 应变化）
    const shotA = await page.screenshot({ scale: 'css' });
    await page.mouse.click(Math.round(mirPage.x), Math.round(mirPage.y));
    await sleep(350);
    const shotC = await page.screenshot({ scale: 'css' });
    const afterMirror = await page.evaluate((boot) => {
      const cc = window.cc;
      const app = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot')
        .getComponent(cc.js.getClassByName(boot))._app;
      return {
        pushes: window.__pushes.slice(), raw: window.__raw.slice(),
        traySelected: app.game.snapshot.traySelected,
        slot0: app.game.snapshot.traySlots[0].state,
        pointer: { ...app.game._pointer },
        traySig: app.game.snapshot.traySlots.map((s) => s.state).join(','),
      };
    }, GAMES.beads.boot);
    await page.mouse.click(Math.round(visPage.x), Math.round(visPage.y));
    await sleep(350);
    const shotB = await page.screenshot({ scale: 'css' });
    const afterVisible = await page.evaluate((boot) => {
      const cc = window.cc;
      const app = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot')
        .getComponent(cc.js.getClassByName(boot))._app;
      return {
        pushes: window.__pushes.slice(), raw: window.__raw.slice(),
        traySelected: app.game.snapshot.traySelected,
        slot0: app.game.snapshot.traySlots[0].state,
        pointer: { ...app.game._pointer },
        traySig: app.game.snapshot.traySlots.map((s) => s.state).join(','),
        phase: app.game.snapshot.phase,
      };
    }, GAMES.beads.boot);

    out.afterMirror = afterMirror;
    out.afterVisible = afterVisible;
    // 只留「点可见点」这一次点击产生的 push（前一次是镜像点反证），供 R2/R3 取 push(down)
    out.visPushes = afterVisible.pushes.slice(afterMirror.pushes.length);

    // 像素分析（托盘槽行区间：槽心屏幕 y ± 10px，避开 HUD 与扩展按钮）
    const y0 = Math.round(visPage.y) - 10, y1 = Math.round(visPage.y) + 10;
    out.px = {
      band: [y0, y1],
      mirrorVsBase: await page.evaluate(([a, c, y0, y1]) => window.__px.diffBand(a, c, y0, y1), [shotA.toString('base64'), shotC.toString('base64'), y0, y1]),
      visibleVsBase: await page.evaluate(([a, b, y0, y1]) => window.__px.diffBand(a, b, y0, y1), [shotA.toString('base64'), shotB.toString('base64'), y0, y1]),
      visibleVsMirror: await page.evaluate(([c, b, y0, y1]) => window.__px.diffBand(c, b, y0, y1), [shotC.toString('base64'), shotB.toString('base64'), y0, y1]),
    };
    const tag = dsf === 1 && viewport.width === 1280 ? 'base' : `dsf${dsf}-${viewport.width}x${viewport.height}`;
    out.shots = {};
    for (const [k, buf] of [['A-base', shotA], ['C-mirror', shotC], ['B-visible', shotB]]) {
      const p = path.join(OUT_DIR, `cocos-input-beads-${tag}-${k}.png`);
      fs.writeFileSync(p, buf);
      out.shots[k] = path.relative(ROOT, p);
    }
  } catch (e) {
    out.error = String(e && e.stack ? e.stack : e).slice(0, 600);
  } finally {
    await ctx.close();
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════ 取样：breakout
async function runBreakout(browser, url, dsf) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
  const out = { dsf, pageErrors, probes: [] };
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction((boot) => {
      const cc = window.cc;
      if (!cc) return false;
      const s = cc.director.getScene();
      if (!s || !s.getChildByName('Canvas')) return false;
      const r = s.getChildByName('Canvas').getChildByName('GameRoot');
      if (!r) return false;
      const c = r.getComponent(cc.js.getClassByName(boot));
      return !!(c && c._app && c._app.game);
    }, GAMES.breakout.boot, { timeout: 25000 });
    await page.evaluate(PX_HELPERS);
    out.info = await page.evaluate((boot) => {
      const cc = window.cc;
      const app = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot')
        .getComponent(cc.js.getClassByName(boot))._app;
      const canvas = document.getElementById('GameCanvas');
      const rect = canvas.getBoundingClientRect();
      window.__pushes = [];
      const orig = app.input.push.bind(app.input);
      app.input.push = (ev) => { window.__pushes.push({ x: ev.x, y: ev.y, phase: ev.phase }); return orig(ev); };
      window.__raw = [];
      cc.director.getScene().getChildByName('Canvas').on('touch-start', (e) => {
        const l = e.getLocation();
        window.__raw.push({ x: l.x, y: l.y });
      });
      return {
        winDpr: window.devicePixelRatio, engineDpr: cc.screen.devicePixelRatio,
        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        canvasCss: { w: canvas.clientWidth, h: canvas.clientHeight },
        backing: { w: canvas.width, h: canvas.height },
        fit: { ...app.viewport.fit }, phase: app.game.snapshot.phase,
        paddle: { x: app.game.paddle.x, y: app.game.paddle.y, w: app.game.paddle.width },
      };
    }, GAMES.breakout.boot);

    for (const designX of [300, 600]) {
      const pt = await page.evaluate(([boot, dx]) => {
        const cc = window.cc;
        const app = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot')
          .getComponent(cc.js.getClassByName(boot))._app;
        const rect = document.getElementById('GameCanvas').getBoundingClientRect();
        const o = { x: 0, y: 0 };
        app.viewport.designToScreen(o, dx, 200);           // 挡板 y 固定 PADDLE_Y=200（breakout §3.1）
        return { sx: rect.x + o.x, sy: rect.y + o.y };
      }, [GAMES.breakout.boot, designX]);
      await page.mouse.move(Math.round(pt.sx), Math.round(pt.sy));
      await page.mouse.down();                             // 挡板只在 pointer down 时跟手（breakout _readInput）
      await page.mouse.move(Math.round(pt.sx), Math.round(pt.sy));
      await sleep(500);                                    // PADDLE_FOLLOW_TAU=0.06s ⇒ 0.5s 已收敛
      const st = await page.evaluate((boot) => {
        const cc = window.cc;
        const app = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot')
          .getComponent(cc.js.getClassByName(boot))._app;
        return { paddleX: app.game.paddle.x, phase: app.game.snapshot.phase, pushes: window.__pushes.slice(), raw: window.__raw.slice() };
      }, GAMES.breakout.boot);
      const shot = await page.screenshot({ scale: 'css' });
      await page.mouse.up();
      await sleep(120);
      const rows = [Math.round(pt.sy) - 8, Math.round(pt.sy) + 8];
      const bright = await page.evaluate(([b64, y0, y1]) => window.__px.brightBand(b64, y0, y1, 240, 2000, 90), [shot.toString('base64'), rows[0], rows[1]]);
      const png = path.join(OUT_DIR, `cocos-input-breakout-dsf${dsf}-x${designX}.png`);
      fs.writeFileSync(png, shot);
      out.probes.push({ designX, pt, st, rows, bright, png: path.relative(ROOT, png) });
    }
  } catch (e) {
    out.error = String(e && e.stack ? e.stack : e).slice(0, 600);
  } finally {
    await ctx.close();
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════ 主流程
let exitCode = 3;
let server = null;
let browser = null;
const startedAt = new Date();

// 被 Ctrl-C / kill 打断时也要收走静态服务（否则端口会留残服务，下一次复跑会撞端口）
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { killServers(); process.exit(130); });
}

try {
  say('===============================================================');
  say('WXG-T-108 · Cocos 宿主输入坐标取证固化（R1/R2/R3 + breakout [B]）');
  say(`时间戳: ${startedAt.toISOString()}`);
  say(`Node ${process.version} · ${os.platform()} ${os.release()} · cwd ${process.cwd()}`);
  say(`日志: ${path.relative(ROOT, LOG_FILE)}${ALLOW_STALE ? '  ⚠ --allow-stale：新鲜度门被跳过，本轮 PASS 不得作为门禁证据' : ''}`);
  say('判据来源: TASKS-DETAIL §WXG-T-104·A4 (R1/R2/R3) > touch-normalize.ts 头注 > ADR-0011 §3(e)');
  say('===============================================================');

  const { chromium } = loadPlaywright();

  // ── ENV：镜像一致（仓库权威检查）+ 产物新鲜度 + 产物含归一化函数 ──
  // 镜像不能按字节比对：framework:sync 会剥掉 import 的 `.js` 后缀（Cocos TS 解析差异），
  // 故改用仓库自身权威守卫 `framework:sync:check`（tools/scripts/sync-framework-to-cocos.mjs --check）。
  const syncCheck = await runCmd('node', ['tools/scripts/sync-framework-to-cocos.mjs', '--check']);
  say(`\n[镜像守卫] framework:sync:check ⇒ exit=${syncCheck.code}：${syncCheck.out.split('\n')[0]}`);
  for (const [name, g] of Object.entries(GAMES)) {
    const id = name === 'beads' ? 'ENV-01' : 'ENV-02';
    const lane = 'N';
    const art = path.resolve(ROOT, g.artifact);
    const bundle = path.resolve(ROOT, g.cacheVersion);
    const problems = [];
    const notes = [];
    if (!fs.existsSync(bundle)) problems.push(`产物缺失: ${g.cacheVersion}`);
    let artT = 0, srcNewest = { t: 0, f: null };
    if (fs.existsSync(bundle)) artT = fs.statSync(bundle).mtimeMs;
    for (const s of g.sources) {
      const n = newestMtime(s, (f) => /\.(ts|js|json)$/.test(f));
      if (n.t > srcNewest.t) srcNewest = n;
    }
    notes.push(`产物 assets/main/index.js mtime=${new Date(artT).toISOString()}；源最新=${srcNewest.f} @ ${new Date(srcNewest.t).toISOString()}`);
    if (artT && srcNewest.t > artT) problems.push(`产物陈旧（源 ${srcNewest.f} 晚于产物）⇒ 必须先 pnpm --filter @wxgame/${name} run build:cocos:web`);
    for (const [src, mir] of g.mirror) {
      const b = path.resolve(ROOT, mir);
      if (!fs.existsSync(b)) problems.push(`镜像缺失: ${mir}`);
    }
    notes.push(`镜像守卫 framework:sync:check exit=${syncCheck.code}`);
    if (syncCheck.code !== 0) problems.push(`framework:sync:check 未过（拷贝件与源码不一致）⇒ 先 pnpm run framework:sync`);
    let hits = -1;
    if (fs.existsSync(bundle)) {
      hits = fs.readFileSync(bundle, 'utf8').split('normalizeCocosTouch').length - 1;
      notes.push(`产物内 normalizeCocosTouch 命中 ${hits} 次（须 ≥1，证明产物含 T-104 修复）`);
      if (hits < 1) problems.push('产物不含 normalizeCocosTouch ⇒ 验的是修复前产物');
    }
    const staleOnly = problems.every((p) => p.includes('产物陈旧'));
    if (problems.length && (staleOnly && ALLOW_STALE)) {
      record(id, lane, '⛔', `${notes.join('；')}｜**陈旧被 --allow-stale 放过**，仅诊断用`);
    } else if (problems.length) {
      record(id, lane, '⛔', `${notes.join('；')}｜问题：${problems.join('；')}`);
    } else {
      record(id, lane, 'PASS', notes.join('；'));
    }
  }

  const envBlocked = results.some((r) => r.verdict === '⛔');
  if (envBlocked) {
    say('\n环境门未过 ⇒ 不进入取样（产物陈旧 / 镜像未同步下一律不得当绿）。');
    const idx = results.filter((r) => r.verdict === '⛔').map((r) => r.id).join(', ');
    say(`受影响：${idx} ⇒ 请重建产物后复跑。退出码 2。`);
    exitCode = 2;
    throw { __handled: true };
  }

  // ── SELF-01：判据自检（拿 T-104 记录的**修复前**数字做反例）──
  {
    const preFixHost = { clientX: 479, clientY: 497, rect: { x: 0, y: 0, w: 1280, h: 720 }, engineDpr: 1, raw: { x: 479, y: 497 } }; // 修复前 = 左上原点 passthrough
    const preFixR1 = {
      slot: 0, P: { x: 76, y: 414 }, S: { x: 478.62, y: 496.55 }, canvasCssH: 720,
      visible: { page: { x: 479, y: 497 }, traySelected: -1, slotState: 'holding', pointer: { x: 76.7, y: 920.8 } },
      mirror: { page: { x: 479, y: 223.45 }, traySelected: 0, pointer: { x: 76.7, y: 413.2 } },
    };
    const preFixR2 = [{ page: { x: 479, y: 497 }, rect: { x: 0, y: 0 }, canvasCssH: 720, push: { x: 479, y: 223, phase: 'down' } }];
    const preFixR3 = [1, 2, 3].map((dsf) => ({
      dsf, windowDpr: dsf, engineDpr: Math.min(dsf, 2), backing: { w: 1280 * Math.min(dsf, 2), h: 720 * Math.min(dsf, 2) },
      rect: { x: 0, y: 0 }, pageX: 479, pageY: 497,
      push: { x: 479 * Math.min(dsf, 2), y: (720 - 497) * Math.min(dsf, 2) },
      raw: { x: 479 * Math.min(dsf, 2), y: (720 - 497) * Math.min(dsf, 2) },
      visible: { traySelected: dsf === 1 ? 0 : -1 }, mirror: { traySelected: dsf === 1 ? -1 : 0 },
    }));
    const j1 = judgeHost(preFixHost), j2 = judgeR1(preFixR1), j3 = judgeR2(preFixR2), j4 = judgeR3(preFixR3);
    const ok = !j1.ok && !j2.ok && !j3.ok && !j4.ok;
    record('SELF-01', 'N', ok ? 'PASS' : 'FAIL',
      `反例（T-104 A4 记录的修复前数字）逐个喂判定函数 ⇒ judgeHost=${j1.ok ? 'PASS(错!)' : 'FAIL(对)'}、judgeR1=${j2.ok ? 'PASS(错!)' : 'FAIL(对)'}、judgeR2=${j3.ok ? 'PASS(错!)' : 'FAIL(对)'}、judgeR3=${j4.ok ? 'PASS(错!)' : 'FAIL(对)'}；`
      + `判定函数返回值须全为「不通过」⇒ 本探针具备判别力（不是「跑了但没判」）。`)
  }

  // ── 起静态服务 + 浏览器 ──
  server = await serve(GAMES.beads.artifact, 8131, 'BeadsBootstrap');
  SERVERS.push(server);
  const breakoutServer = await serve(GAMES.breakout.artifact, 8137, 'BreakoutBootstrap');
  SERVERS.push(breakoutServer);
  browser = await chromium.launch();
  say('');
  say(`静态服务: beads ${server.url} · breakout ${breakoutServer.url}`);

  // ── beads：dsf 1/2/3（1280×720）+ 信箱档（500×1000，offsetY>0）──
  const runs = {};
  for (const dsf of [1, 2, 3]) runs[dsf] = await runBeadsContext(browser, server.url, { dsf, viewport: { width: 1280, height: 720 } });
  const letterbox = await runBeadsContext(browser, server.url, { dsf: 1, viewport: { width: 500, height: 1000 } });

  const shape = (r) => ({
    dsf: r.dsf, windowDpr: r.pre.winDpr, engineDpr: r.pre.engineDpr, backing: r.pre.backing,
    rect: r.pre.rect, canvasCssH: r.pre.canvasCss.h, pageX: Math.round(r.visPage.x), pageY: Math.round(r.visPage.y),
    P: r.pre.P, S: r.pre.S,
    visible: { page: r.visPage, traySelected: r.afterVisible.traySelected, slotState: r.afterVisible.slot0, pointer: r.afterVisible.pointer },
    mirror: { page: r.mirPage, traySelected: r.afterMirror.traySelected, pointer: r.afterMirror.pointer },
    pushes: r.visPushes, raw: r.afterVisible.raw[r.afterVisible.raw.length - 1] ?? { x: NaN, y: NaN },
    slot: 0,
  });
  const firstDown = (list) => list.find((p) => p.phase === 'down');

  // HOST 语义（三档）
  for (const dsf of [1, 2, 3]) {
    const r = runs[dsf];
    const id = `HOST-0${dsf}`;
    if (r.error) { record(id, 'N', '⛔', `上下文取样失败：${r.error}`); continue; }
    const raw = r.afterVisible.raw[r.afterVisible.raw.length - 1];
    const s = { clientX: Math.round(r.visPage.x), clientY: Math.round(r.visPage.y), rect: r.pre.rect, engineDpr: r.pre.engineDpr, raw };
    const j = judgeHost(s);
    const extra = `window dpr=${r.pre.winDpr}、引擎 dpr=${r.pre.engineDpr}、canvas CSS ${r.pre.canvasCss.w}×${r.pre.canvasCss.h}、backing ${r.pre.backing.w}×${r.pre.backing.h}`;
    record(id, 'N', j.ok ? 'PASS' : 'FAIL', `${extra}；${j.notes.join('；')}`);
    if (dsf === 3) {
      const capped = { ...s, engineDpr: 3 };
      const jc = judgeHost(capped);
      record('HOST-03b', 'N', (!jc.ok) ? 'PASS' : 'FAIL',
        `封顶反证：若按 window dpr=3（未封顶）套恒等式 ⇒ Δy=${Math.abs(raw.y - (s.rect.y + s.rect.h - s.clientY) * 3).toFixed(1)}px ⇒ 判定函数 ${jc.ok ? '错误通过(FAIL)' : '正确否决(PASS)'}（证明「引擎封顶 2」这一口径必须与输入源同源）`);
    }
  }

  // R1（dsf=1 全量：可见命中 + 镜像反证 + push 数据流 + 像素级）
  {
    const r = runs[1];
    if (r.error) {
      for (const id of ['R1-01', 'R1-02', 'R2-01', 'B-01', 'B-02']) record(id, 'N', '⛔', `上下文取样失败：${r.error}`);
    } else {
      const s = shape(r);
      const j = judgeR1(s);
      record('R1-01+R1-02', 'N', j.ok ? 'PASS' : 'FAIL', j.notes.join('；'));
      const j2 = judgeR2([
        { page: s.mirror.page, rect: s.rect, canvasCssH: s.canvasCssH, push: firstDown(r.afterMirror.pushes) },
        { page: s.visible.page, rect: s.rect, canvasCssH: s.canvasCssH, push: firstDown(s.pushes) },
      ]);
      record('R2-01', 'N', j2.ok ? 'PASS' : 'FAIL',
        `${j2.notes.join('；')}；本会话全部 push=${JSON.stringify(r.afterVisible.pushes.map((x) => `${x.phase}(${x.x},${x.y})`))}（切分点=镜像点击后 ${r.afterMirror.pushes.length} 条）`);
      // [B] 像素级
      const band = r.px.band;
      const mirDiff = r.px.mirrorVsBase;
      const visDiff = r.px.visibleVsBase;
      const ok1 = mirDiff.changed === 0;
      record('B-01', 'B', ok1 ? 'PASS' : 'FAIL',
        `行区间 ${band.join('..')}（槽行）内，点镜像点前后 changedPixels=${mirDiff.changed}（期望 0）、簇=${JSON.stringify(mirDiff.clusters)}`
        + `；截图 A/C: ${r.shots['A-base']} / ${r.shots['C-mirror']}（期望：镜像位置的**被画出**的槽完全无响应）`);
      const cl = visDiff.clusters.find((c) => c.width <= 40);
      const ok2 = !!cl && Math.abs(cl.center - r.visPage.x) <= TOL.pixelCenterPx;
      record('B-02', 'B', ok2 ? 'PASS' : 'FAIL',
        `点可见点前后 changedPixels=${visDiff.changed}、簇=${JSON.stringify(visDiff.clusters)}`
        + `；期望簇心 ≈ 点击点屏幕 x=${r.visPage.x.toFixed(1)}（±${TOL.pixelCenterPx}px）⇒ 命中簇心=${cl ? cl.center.toFixed(1) : '（无合格簇）'}`
        + `；截图 A/B: ${r.shots['A-base']} / ${r.shots['B-visible']}（渲染层与命中层同位）`);
    }
  }

  // R1 @ 信箱档（offsetY>0）
  if (runs[1].error) { /* 已登记 */ }
  {
    const r = letterbox;
    const id = 'R1-03+R1-04';
    if (r.error) record(id, 'N', '⛔', `上下文取样失败：${r.error}`);
    else {
      const j = judgeR1(shape(r));
      record(id, 'N', j.ok ? 'PASS' : 'FAIL',
        `信箱档 500×1000：fit scale=${r.pre.fit.scale.toFixed(4)} offsetX=${r.pre.fit.offsetX.toFixed(2)} offsetY=${r.pre.fit.offsetY.toFixed(2)}（>0 ⇒ 纵向信箱）；${j.notes.join('；')}`);
    }
  }

  // R3 不变性
  {
    const bad = [1, 2, 3].filter((d) => runs[d].error);
    if (bad.length) record('R3-01', 'N', '⛔', `dsf=${bad.join(',')} 上下文取样失败`);
    else {
      const samples = [1, 2, 3].map((d) => ({ ...shape(runs[d]), push: runs[d].visPushes.find((x) => x.phase === 'down') }));
      const j = judgeR3(samples);
      record('R3-01', 'N', j.ok ? 'PASS' : 'FAIL', j.notes.join('；'));
      for (const d of [2, 3]) {
        const s = shape(runs[d]);
        const jj = judgeR1(s);
        record(`R3-0${d === 2 ? 2 : 3}（=R1 端到端 @ dsf=${d}）`, 'N', jj.ok ? 'PASS' : 'FAIL', jj.notes.join('；'));
      }
    }
  }

  // breakout 数据流 + [B]
  const boRuns = {};
  for (const dsf of [1, 2]) boRuns[dsf] = await runBreakout(browser, breakoutServer.url, dsf);
  {
    const errs = [1, 2].filter((d) => boRuns[d].error);
    if (errs.length) record('BR-01', 'N', '⛔', `breakout 上下文取样失败 dsf=${errs.join(',')}：${boRuns[errs[0]].error}`);
    else {
      const notes = [];
      let ok = true;
      for (const dsf of [1, 2]) {
        const r = boRuns[dsf];
        const pr = r.probes[0];
        const down = pr.st.pushes.find((p) => p.phase === 'down');
        const exX = Math.round(pr.pt.sx) - r.info.rect.x;
        const exY = Math.round(pr.pt.sy) - r.info.rect.y;
        const dx = Math.abs(down.x - exX), dy = Math.abs(down.y - exY);
        const okThis = dx <= TOL.pushPx && dy <= TOL.pushPx;
        ok = ok && okThis;
        notes.push(`dsf=${dsf}（引擎 dpr=${r.info.engineDpr}）：点页面 (${Math.round(pr.pt.sx)},${Math.round(pr.pt.sy)}) ⇒ push(down)=(${down.x},${down.y})，期望 (${exX},${exY})，Δ=(${dx.toFixed(1)},${dy.toFixed(1)})`);
      }
      const xs = [1, 2].map((d) => boRuns[d].probes[0].st.pushes.find((p) => p.phase === 'down').x);
      const spread = Math.abs(xs[0] - xs[1]);
      notes.push(`两档 push.x 差 ${spread.toFixed(1)}px（须 ≤${TOL.pushPx}；修前 dsf=2 会是 2 倍 ⇒ 差 ≈ ${xs[1]}px）`);
      record('BR-01', 'N', (ok && spread <= TOL.pushPx) ? 'PASS' : 'FAIL', notes.join('；'));
    }
  }
  {
    const r = boRuns[1];
    if (r.error) { record('B-03', 'B', '⛔', `取样失败：${r.error}`); record('B-04', 'B', '⛔', `取样失败：${r.error}`); }
    else {
      const notes = [];
      let ok = true;
      for (const pr of r.probes) {
        const ex = pr.designX;
        const got = pr.st.paddleX;
        const d = Math.abs(got - ex);
        const okThis = d <= TOL.designPx && pr.st.phase === 'playing';
        ok = ok && okThis;
        notes.push(`点设计 x=${ex} 的屏幕位置 ⇒ paddle.x=${got.toFixed(2)}（Δ=${d.toFixed(2)} 设计px）、phase=${pr.st.phase}`);
      }
      record('B-03', 'B', ok ? 'PASS' : 'FAIL',
        `${notes.join('；')}；口径：breakout 挡板**只吃 x**（y 镜像对它无判别力 —— 这正是 2026-09-13 漏检的成因）⇒ 本条只证「水平跟手」，y 向判别力由 R1/R2/B-01/B-02 提供`);
      const b0 = r.probes[0].bright, b1 = r.probes[1].bright;
      const want0 = r.probes[0].pt.sx, want1 = r.probes[1].pt.sx;
      const c0 = Math.abs(b0.centroid - want0), c1 = Math.abs(b1.centroid - want1);
      const expectedDelta = (r.probes[1].designX - r.probes[0].designX) * r.info.fit.scale;
      const realDelta = b1.centroid - b0.centroid;
      const okB4 = c0 <= TOL.pixelCenterPx && c1 <= TOL.pixelCenterPx && Math.abs(realDelta - expectedDelta) <= TOL.pixelCenterPx * 1.5;
      record('B-04', 'B', okB4 ? 'PASS' : 'FAIL',
        `行区间 ${r.probes[0].rows.join('..')}（挡板带）内「亮像素」簇心： x1 期望 ${want0.toFixed(1)} ⇒ 实测 ${b0.centroid.toFixed(1)}（Δ=${c0.toFixed(1)}）、n=${b0.count}、span=${JSON.stringify(b0.span)}；`
        + `x2 期望 ${want1.toFixed(1)} ⇒ 实测 ${b1.centroid.toFixed(1)}（Δ=${c1.toFixed(1)}）、n=${b1.count}、span=${JSON.stringify(b1.span)}；`
        + `位移：实测 ${realDelta.toFixed(1)}px vs 期望 设计位移×scale=${expectedDelta.toFixed(1)}px（±${(TOL.pixelCenterPx * 1.5).toFixed(0)}）`
        + `；截图 ${r.probes[0].png} / ${r.probes[1].png}（挡板确在点击的屏幕 x 处被画出 ⇒ 渲染层与点击层同位）`);
    }
  }

  // ── ⛔ 阻塞道次（诚实登记，不记 PASS/FAIL）──
  record('DEV-01', '⛔', '⛔',
    '[R] 微信小游戏宿主：`pal/input/minigame/touch-input.ts` 与 web **同形**（左下原点 + ×pixelRatio，且 `pal/screen-adapter/minigame` **无 2 封顶**），但**无真机、无 AppID ⇒ 未实测**。'
    + '解除条件：① 有效 AppID；② `pnpm --filter @wxgame/{beads,breakout} run build:cocos:wx` 出包；③ 微信开发者工具/真机可跑；④ 用本脚本 A6 同款探针在 `wx` 宿主复取三个 accessor 与 push 值（真机首验必须把「点击落点 / 托盘选中 / dpr 缩放」列为 P0 检查项，ADR-0011 §4.2(10)）。');
  record('DEV-02', '⛔', '⛔',
    'wechatgame 平台构建（`build:cocos:wx`）：缺有效 **AppID** ⇒ 无法出包 ⇒ 上条 [R] 的前置也不成立。解除条件同上 ①。');

  // ── 汇总 ──
  const norm = (v) => (v.startsWith('⛔') ? '⛔' : v);
  const tally = { PASS: 0, FAIL: 0, '⛔': 0 };
  for (const r of results) tally[norm(r.verdict)]++;
  say('');
  say('================ 汇总（WXG-T-108 · Cocos 输入取证固化）================');
  for (const r of results) say(`  ${norm(r.verdict).padEnd(4)} [${r.lane}] ${r.id}`);
  say(`\n计数：PASS ${tally.PASS} ｜ FAIL ${tally.FAIL} ｜ ⛔ ${tally['⛔']}（其中预期阻塞 ${[...DECLARED_BLOCKED].join(', ')}）`);
  const unexplainedBlocked = results.filter((r) => r.verdict === '⛔' && !DECLARED_BLOCKED.has(r.id)).map((r) => r.id);
  const fails = results.filter((r) => r.verdict === 'FAIL').map((r) => r.id);
  if (fails.length) { exitCode = 1; say(`\n⇒ 退出码 1：FAIL = ${fails.join(', ')}（红 = 回归，当绿即为假绿）`); }
  else if (unexplainedBlocked.length) { exitCode = 2; say(`\n⇒ 退出码 2：无 FAIL，但存在未预期阻塞 = ${unexplainedBlocked.join(', ')} ⇒ 不得当绿`); }
  else { exitCode = 0; say('\n⇒ 退出码 0：全部可执行用例 PASS；⛔ 仅为已声明的环境阻塞道次（DEV-01/DEV-02），未记 PASS。'); }
  say(`会话页错误：beads ${[1, 2, 3].map((d) => `dsf${d}:${runs[d].pageErrors?.length ?? '-'}`).join(' ')}｜breakout ${[1, 2].map((d) => `dsf${d}:${boRuns[d].pageErrors?.length ?? '-'}`).join(' ')}`);
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
