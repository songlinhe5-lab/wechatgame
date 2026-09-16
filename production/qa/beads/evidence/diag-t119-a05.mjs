#!/usr/bin/env node
/**
 * WXG-T-119 诊断脚本（**非门禁证据本体**，体例同 `evidence/diag-p5-fixtures.mjs`）
 * 目的：判定 `beads-browser-probe.mjs` 的 A05 段为何得到 `pg.evaluate(...) === undefined`。
 * 只读：起静态服务 + 无头浏览器；不改任何源码。
 * 运行：node production/qa/beads/evidence/diag-t119-a05.mjs
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const ART = path.join(ROOT, 'games/beads/cocos/build/web-mobile');

const require = createRequire(import.meta.url);
const cands = [
  process.env.WXG_PLAYWRIGHT_MODULES,
  path.join(os.homedir(), '.workbuddy/binaries/node/workspace/node_modules'),
  path.join(ROOT, 'node_modules'),
].filter(Boolean);
let chromium = null;
for (const c of cands) { try { chromium = require(require.resolve('playwright', { paths: [c] })).chromium; break; } catch { /* next */ } }
if (!chromium) { try { chromium = require('playwright').chromium; } catch { /* ignore */ } }
if (!chromium) { console.error('playwright 不可解析'); process.exit(3); }

const PORT = 8151;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ART], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => { console.log(s); };

try {
  for (let i = 0; i < 30; i++) {
    await sleep(150);
    try { const r = await fetch(`http://127.0.0.1:${PORT}/assets/main/index.js`); if (r.ok) break; } catch { /* retry */ }
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 747 }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await pg.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await pg.waitForFunction(() => {
    const cc = window.cc;
    if (!cc) return false;
    const s = cc.director.getScene();
    if (!s || !s.getChildByName('Canvas')) return false;
    const r = s.getChildByName('Canvas').getChildByName('GameRoot');
    const c = r && r.getComponent(cc.js.getClassByName('BeadsBootstrap'));
    return !!(c && c._app && c._app.game.snapshot.phase === 'playing');
  }, null, { timeout: 30000 });
  log('[1] boot ok；pageerrors=' + errs.length);

  // ── 步骤 1：句柄与 voice 表（小对象，必定可序列化） ──
  const small = await pg.evaluate((boot) => {
    const cc = window.cc;
    const r = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');
    const app = r.getComponent(cc.js.getClassByName(boot))._app;
    const b = app.services.audio && app.services.audio._backend;
    const voices = app.game && app.game.audioVoices;
    return {
      hasBackend: !!b,
      backendName: b ? (b.constructor && b.constructor.name) : null,
      hasVoices: !!voices,
      voiceCount: voices ? Object.keys(voices).length : -1,
      voiceKeysSample: voices ? Object.keys(voices).slice(0, 4) : [],
      hasUnlock: !!(b && typeof b.unlock === 'function'),
      hasPlay: !!(b && typeof b.play === 'function'),
      hasActiveLoops: !!(b && typeof b.activeLoops === 'function'),
      ctxFactoryArity: b ? b.constructor.length : -1,
    };
  }, 'BeadsBootstrap');
  log('[2] 句柄小对象 = ' + JSON.stringify(small));

  // ── 步骤 2：最小离线渲染（单 clip），返回小对象 ──
  const min = await pg.evaluate((boot) => {
    try {
      const cc = window.cc;
      const r = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');
      const app = r.getComponent(cc.js.getClassByName(boot))._app;
      const backend = app.services.audio._backend;
      const Cls = backend.constructor;
      const voices = app.game.audioVoices;
      const oc = new OfflineAudioContext(1, 44100 * 0.4, 44100);
      const b = new Cls(() => oc, voices);
      b.unlock();
      b.play('sfx_place', { volume: 1, loop: false });
      return oc.startRendering().then((buf) => {
        const d = buf.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
        return { ok: true, peak: +peak.toFixed(6), n: d.length };
      }).catch((e) => ({ ok: false, where: 'render', err: String(e).slice(0, 200) }));
    } catch (e) {
      return { ok: false, where: 'construct', err: String((e && e.stack) || e).slice(0, 300) };
    }
  }, 'BeadsBootstrap');
  log('[3] 最小离线渲染 = ' + JSON.stringify(min));

  // ── 步骤 3：返回「大对象」是否可序列化（复现 undefined 的候选原因） ──
  const big = await pg.evaluate(() => {
    const env = [];
    for (let i = 0; i < 20000; i++) env.push({ t: i, peak: Math.sin(i) * 0.5, rms: 0.1 });
    return { env, n: env.length };
  });
  log('[4] 大对象（20000 项 × 3 字段）typeof=' + typeof big + ' keys=' + (big ? Object.keys(big).join(',') : '-'));

  // ── 步骤 4：JSON 字符串返回（对照组） ──
  const j = await pg.evaluate(() => {
    const env = [];
    for (let i = 0; i < 20000; i++) env.push({ t: i, peak: Math.sin(i) * 0.5 });
    return JSON.stringify({ env });
  });
  log('[5] JSON 字符串 typeof=' + typeof j + ' len=' + (typeof j === 'string' ? j.length : '-'));

  await ctx.close();
  await browser.close();
  log('[6] pageerrors = ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 2).join(' | ') : ''));
} catch (e) {
  log('[脚本级错误] ' + ((e && e.stack) || e));
} finally {
  try { srv.kill('SIGKILL'); } catch { /* ignore */ }
}
