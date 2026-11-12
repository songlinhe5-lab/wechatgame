#!/usr/bin/env node
/**
 * harness-bitmap-shot.mjs — WXG-T-615：harness **位图腿实帧**像素取证（headless Chrome + CDP）。
 *
 * 为什么存在：IDE 内置浏览器视图处于 hidden 时 img.decode() 挂起 / rAF=0（K-215），
 * 位图腿拿不到像素证据；bsk 无浏览器连接时同样无解。本脚本改用**系统 Chrome 的
 * headless 模式**（页面可见、解码与 rAF 正常），经 CDP 直驱 harness：
 *   ① 探针 visibilityState / rAF / 位图注册表（自证「这次不是 hidden」）
 *   ② 快进倒计时到 GAME_OVER（走游戏自己的 update(dt)，⛔ 不改任何游戏代码）
 *   ③ 截双钮档；再把 reviveCount 置满截仅重试档（404 高九宫格压缩腿）
 *
 * 道次诚实：产出 = **[harness Canvas2D] 位图腿像素**，⛔ 不是真机（微信宿主）证据；
 * 与 cocos-vision-shot.mjs（Cocos 产物腿）互补。零 npm 依赖（Node ≥22 原生 WebSocket）。
 *
 * USAGE（仓根，需先有 harness 服务与新鲜 dist）
 *   node tools/scripts/serve-harness.mjs --build-only   # 或已在跑的服务
 *   node tools/scripts/harness-bitmap-shot.mjs [--url http://localhost:5173/?game=beads]
 *                                              [--out temp/ui-shot] [--port 9333]
 * 退出码：0 成功；2 参数/产物错；3 Chrome/CDP/页面错。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('用法见文件头注释。');
  process.exit(0);
}

const URL_TARGET = argValue('--url', 'http://localhost:5173/?game=beads&dbg=off');
const OUT_DIR = resolve(ROOT, argValue('--out', 'temp/ui-shot'));
const PORT = Number(argValue('--port', '9333'));
const CHROME =
  argValue('--chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
if (!existsSync(CHROME)) {
  console.error(`❌ 找不到 Chrome：${CHROME}（--chrome= 可指路）`);
  process.exit(2);
}
mkdirSync(OUT_DIR, { recursive: true });

// ── CDP 最小客户端（原生 WebSocket，请求/响应按 id 配对）─────────────────────
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve: ok, reject: bad } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) bad(new Error(JSON.stringify(msg.error)));
        else ok(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((ok, bad) => {
      this.pending.set(id, { resolve: ok, reject: bad });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          bad(new Error(`CDP 超时：${method}`));
        }
      }, 30000);
    });
  }
  async eval(expression) {
    // 安全归因：本文件所有 expression 均为**硬编码字面量**（无外部输入插值）；
    // 这里是 CDP Runtime.evaluate 协议调用（浏览器内执行），非 Node eval。
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(`页面异常：${JSON.stringify(r.exceptionDetails)}`);
    return r.result.value;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(cdp, expression, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    const v = await cdp.eval(expression);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`等待超时：${label}`);
    await sleep(300);
  }
}

// ── 启动 headless Chrome（独立 user-data-dir，⛔ 不碰用户主 profile）─────────
const profileDir = join(OUT_DIR, '.chrome-profile');
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=750,1334',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let cdp;
try {
  // 等 DevTools 端点起来，取 page target 的 ws 地址
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await sleep(300);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch {
      /* 尚未就绪 */
    }
  }
  if (!wsUrl) throw new Error('Chrome DevTools 端点未就绪');
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, bad) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => bad(new Error('WS 连接失败')), { once: true });
  });
  cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 750,
    height: 1334,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Page.navigate', { url: URL_TARGET });

  // ① 就绪 + 位图腿自证：三枚 timeout 图 complete 且 naturalWidth>0
  await waitFor(
    cdp,
    `(() => { const b = window.__beads; return !!(b && b.game && b.game.update && b.menu); })()`,
    20000,
    'harness 就绪',
  );
  const probe = await waitFor(
    cdp,
    `(() => {
      const b = window.__beads;
      const keys = [...b.menu.registry.keys()].filter(k => k.includes('timeout'));
      if (keys.length < 3) return null;
      const imgs = keys.map(k => { const i = b.menu.registry.get(k); return { k, complete: i.complete, w: i.naturalWidth }; });
      if (!imgs.every(x => x.complete && x.w > 0)) return null;
      return { vis: document.visibilityState, imgs, phase: b.game.snapshot.phase };
    })()`,
    30000,
    '三枚 timeout 位图解码完成',
  );
  const raf = await cdp.eval(
    `new Promise(res => { let n = 0; const t0 = performance.now();
      const tick = () => { n++; if (performance.now() - t0 < 500) requestAnimationFrame(tick); else res(n); };
      requestAnimationFrame(tick); })`,
  );
  console.log(`探针：visibilityState=${probe.vis} · rAF/500ms=${raf} · phase=${probe.phase}`);
  for (const x of probe.imgs) console.log(`  位图 ${x.k} complete=${x.complete} ${x.w}px`);
  if (probe.vis !== 'visible' || raf === 0) throw new Error('页面仍处后台态，取证无效');

  // ② 快进倒计时 → GAME_OVER（游戏自己的 update，非旁路改状态）
  await cdp.eval(`(() => { const g = window.__beads.game; g.update(600); return g.phase; })()`);
  const failState = await waitFor(
    cdp,
    `(() => { const s = window.__beads.game.snapshot;
      return s.phase === 'game-over' && s.mode === 'normal' ? { phase: s.phase, reviveAvailable: s.reviveAvailable } : null; })()`,
    10000,
    'GAME_OVER 态',
  );
  await sleep(800); // 面板入场动效落定
  const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file1 = join(OUT_DIR, 'fail-615-bitmap-two-button.png');
  writeFileSync(file1, Buffer.from(shot1.data, 'base64'));
  console.log(`📸 双钮档（reviveAvailable=${failState.reviveAvailable}）→ ${file1}`);

  // ③ 仅重试档：reviveCount 置满（REVIVE_MAX_PER_LEVEL=1）⇒ 牌高 404 九宫格压缩腿
  await cdp.eval(`(() => { const g = window.__beads.game; g._reviveCount = 1; return g._reviveCount; })()`);
  const retryState = await waitFor(
    cdp,
    `(() => { const s = window.__beads.game.snapshot; return s.reviveAvailable === false ? { reviveAvailable: false } : null; })()`,
    10000,
    '仅重试档',
  );
  await sleep(500);
  const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file2 = join(OUT_DIR, 'fail-615-bitmap-retry-only.png');
  writeFileSync(file2, Buffer.from(shot2.data, 'base64'));
  console.log(`📸 仅重试档（reviveAvailable=${retryState.reviveAvailable}）→ ${file2}`);

  console.log('✅ 位图腿实帧取证完成（道次 = harness Canvas2D，⛔ 非真机）');
  ws.close();
  chrome.kill();
  process.exit(0);
} catch (err) {
  console.error(`❌ ${err.message}`);
  try {
    chrome.kill();
  } catch {
    /* ignore */
  }
  process.exit(3);
}