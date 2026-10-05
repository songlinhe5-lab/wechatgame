#!/usr/bin/env node
/**
 * carrier-bench.mjs — WXG-T-247 / ADR-0030 S0·S2 **三臂载体同宿主性能取证**驱动器。
 *
 * 宿主 = 真实 Cocos `web-mobile` 产物 + Chromium（真引擎、真 GPU 提交路径），
 * 页内探针 = `games/beads/cocos/assets/scripts/spike/carrier-bench.ts`（`?bench=1`）。
 * 三臂在**同一次页面加载、同一盘面状态**下依次采样（切臂只换载体，不换场景）。
 *
 * ⚠ 档位 = **`[E]` 桌面档**：⛔ 不得当作 `ADR-0022 D2` 的「≥2 台低端同向」达线证据。
 *
 * 前置：
 *   pnpm run harness:build
 *   pnpm run framework:sync && pnpm run framework:sync:check
 *   pnpm --filter @wxgame/beads run build:cocos:web
 *
 * 用法：
 *   node tools/scripts/carrier-bench.mjs [--arms=vector,canvas,atlas] [--zooms=0.6,1,2]
 *                                        [--frames=150] [--warmup=40] [--no-gpu] [--out=<dir>]
 *                                        [--gates=on,off] [--layers=full,beads]
 *
 * `--gates=off,on` = `[WXG-T-248]` 脏帧门控 A/B：同一把尺（同一探针、同一盘面、同一顺序）
 * 分别采「逐帧重画」与「干净帧不重画」两档。⚠ 关档时 `drawMs` 采的是**所有**帧，
 * 开档时只采**脏帧** ⇒ 两档的 `drawMs` 不可直接比大小，判收益看 `tick p50`（整帧 CPU）
 * 与 `drawn`（真重画了几帧）。
 *
 * `--layers=full,beads` = `[WXG-T-249]` 甲″ 收益**上界档** A/B（仅对 `atlas` 臂有意义，其余臂恒 `full`）：
 * `beads` = 非珠层整体不提交（`cc.Graphics` 组件停用 + `Label` 隐藏），画面不完整⇒
 * 该档只用来把 `dc` 拆成「矢量层 / 珠池」两份，⛔ 不是可 shipped 形态。
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PRODUCT = join(ROOT, 'games', 'beads', 'cocos', 'build', 'web-mobile');
const MASK_DIR = join(ROOT, 'tools', 'mask-preview', 'cocos-assets');
const arg = (k, d) => {
    const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.split('=').slice(1).join('=') : d;
};
const OUT_DIR = resolve(arg('out', join(ROOT, 'production', 'qa', 'beads', 'evidence', 'carrier-bench')));
const ARMS = arg('arms', 'vector,canvas,atlas').split(',');
const ZOOMS = arg('zooms', '0.6,1,2').split(',').map(Number);
const FRAMES = Number(arg('frames', 150));
const WARMUP = Number(arg('warmup', 40));
const PROBE_GPU = !process.argv.includes('--no-gpu');
// `--disturb`：最坏档（每帧拖动缩放 ⇒ 全盘几何都变），与静置档对照。
const DISTURB = process.argv.includes('--disturb');
// `--gates=off,on`：脏帧门控 A/B（WXG-T-248）。默认只采开档。
const GATES = arg('gates', 'on').split(',').map((s) => s.trim() !== 'off');
// `--layers=full,beads`：甲″ 上界档 A/B（WXG-T-249）。只对 atlas 臂采，其余臂恒 full。
const LAYERS = arg('layers', 'full').split(',').map((s) => s.trim());

// ── 产物新鲜度（对账真实构建输入 = assets/scripts 全树，含 spike 目录）────
const bundle = join(PRODUCT, 'src', 'chunks', 'bundle.js');
if (!existsSync(bundle)) {
    console.error(`❌ 产物不存在：${PRODUCT}\n   先跑 pnpm --filter @wxgame/beads run build:cocos:web`);
    process.exit(3);
}
let newest = 0, newestFile = '';
const walk = (d) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, name.name);
        if (name.isDirectory()) walk(p);
        else if (/\.(ts|js)$/.test(name.name)) {
            const m = statSync(p).mtimeMs;
            if (m > newest) { newest = m; newestFile = p; }
        }
    }
};
walk(join(ROOT, 'games', 'beads', 'cocos', 'assets', 'scripts'));
if (statSync(bundle).mtimeMs < newest && !process.argv.includes('--allow-stale')) {
    console.error(`⛔ 产物陈旧：bundle ${new Date(statSync(bundle).mtimeMs).toISOString()} < ${newestFile} ${new Date(newest).toISOString()}\n   重跑 build:cocos:web（或 --allow-stale 仅诊断）`);
    process.exit(2);
}

// ── playwright 解析（与 cocos-vfx-burst.mjs 同款多候选）───────────────────
const cands = [
    process.env.WXG_PLAYWRIGHT_MODULES,
    join(homedir(), '.workbuddy/binaries/node/workspace/node_modules'),
    join(ROOT, 'node_modules'),
].filter(Boolean);
let playwright = null;
const errs = [];
for (const c of cands) {
    try { playwright = createRequire(join(c, 'package.json'))('playwright'); break; }
    catch (e) { errs.push(`${c}: ${String(e.message).slice(0, 60)}`); }
}
if (!playwright) { console.error(`❌ playwright 不可解析：\n  ${errs.join('\n  ')}`); process.exit(3); }

// ── 静态服务：web-mobile 产物 + /mask-assets/ 白名单只读映射 ──────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.bin': 'application/octet-stream', '.plist': 'application/xml', '.wasm': 'application/wasm' };
const read = (f) => readFileSync(f);
const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = null;
    if (url.startsWith('/mask-assets/')) {
        const rel = url.slice('/mask-assets/'.length).replace(/^\/+/, '');
        const mapped = join(MASK_DIR, rel);
        if (mapped.startsWith(MASK_DIR) && existsSync(mapped)) file = mapped;
    } else {
        const cand = join(PRODUCT, url === '/' ? 'index.html' : url);
        file = cand.startsWith(PRODUCT) && existsSync(cand) && !statSync(cand).isDirectory() ? cand : join(PRODUCT, 'index.html');
    }
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(read(file));
});
await new Promise((d) => server.listen(0, '127.0.0.1', d));
const base = `http://127.0.0.1:${server.address().port}`;

const { chromium } = playwright;
// ⚠ headless 默认走 SwiftShader（软件光栅）⇒ GPU 读数无效。macOS 上强制 ANGLE Metal。
//   实证：`--use-angle=metal` → gpuRenderer = "ANGLE (Apple, ANGLE Metal Renderer: Apple M4)"。
const LAUNCH_ARGS = arg('launchargs', '--use-angle=metal').split(',').filter(Boolean);
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const results = [];
let host = null, caps = null, pageErrors = [];
try {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e && e.stack ? e.stack : e).slice(0, 400)));
    page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`console: ${m.text().slice(0, 200)}`); });
    await page.goto(`${base}/index.html?bench=1`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => !!window.__BENCH, null, { timeout: 60000 });
    host = await page.evaluate(() => window.__BENCH.host());
    caps = await page.evaluate(() => window.__BENCH.caps());
    console.log('── 宿主事实（[E] 档；含 S0 必采项 devicePixelRatio）──');
    console.log(JSON.stringify({ ...host, ...caps }, null, 2));
    if (host.gpuIsSoftware) console.log('⛔ GPU 后端是软件光栅（SwiftShader）⇒ 本组 GPU/填充读数无效，换 --launchargs 或真机。');

    // 盘面读数只在 play 屏有效（默认停主菜单 ⇒ cmds/blits 全 0）。
    const screen = await page.evaluate(() => window.__BENCH.enterPlay());
    await page.waitForFunction(() => { const p = window.__BENCH.phase(); return p.screen === 'play' && p.filled > 0; }, null, { timeout: 20000 }).catch(() => { });
    const phase = await page.evaluate(() => window.__BENCH.phase());
    console.log(`── 进盘：screen=${screen} phase=${JSON.stringify(phase)} ──`);
    if (phase.filled === 0) console.log('⛔ 未进盘（filled=0）⇒ 以下所有盘面读数无效。');

    // `--diag`：单发验证 GPU timer query 在本宿主到底能不能回结果（读数全空时的归因口）。
    if (process.argv.includes('--diag')) {
        const diag = await page.evaluate(async () => {
            const gl = document.querySelector('#GameCanvas').getContext('webgl2');
            const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
            const out = { hasExt: !!ext, target: null, proto: ext && Object.getOwnPropertyNames(Object.getPrototypeOf(ext)), steps: [] };
            if (!ext) return out;
            const target = ext.TIME_ELAPSED_EXT ?? ext.TIME_EXT ?? ext.TIME_RESULT_EXT;
            out.target = target;
            const q = gl.createQuery();
            gl.beginQuery(target, q);
            out.errAfterBegin = gl.getError();
            gl.endQuery(target);
            out.errAfterEnd = gl.getError();
            gl.flush();
            for (let i = 0; i < 20; i++) {
                await new Promise((d) => requestAnimationFrame(d));
                let avail; let ns; let err = null;
                try { avail = gl.getQueryParameter(q, 0x8867); if (avail) ns = gl.getQueryParameter(q, 0x8866); }
                catch (e) { err = String(e); }
                out.steps.push({ i, avail, ns: ns === undefined ? null : ns, err, glErr: gl.getError() });
                if (avail || err) break;
            }
            return out;
        });
        console.log('── timer 自检 ──\n' + JSON.stringify(diag, null, 2));
    }

    for (const arm of ARMS) {
        for (const zoom of ZOOMS) {
            for (const gate of GATES) {
                for (const layers of (arm === 'atlas' ? LAYERS : ['full'])) {
                    await page.evaluate((on) => window.__BENCH.setGate(on), gate);
                    await page.evaluate((v) => window.__BENCH.setAtlasLayers(v), layers);
                    const r = await page.evaluate((o) => window.__BENCH.runCase(o), { arm, zoom, frames: FRAMES, warmup: WARMUP, gpu: PROBE_GPU, disturb: DISTURB });
                    results.push(r);
                    const shot = join(OUT_DIR, `${DISTURB ? 'd-' : ''}${GATES.length > 1 ? `g-${gate ? 'on' : 'off'}-` : ''}${layers !== 'full' ? `l-${layers}-` : ''}${arm}-z${zoom}.png`);
                    mkdirSync(OUT_DIR, { recursive: true });
                    await page.screenshot({ path: shot });
                    console.log(`· ${arm} @zoom ${zoom} gate=${gate ? 'on' : 'off'} layers=${layers} → tick p50 ${r.tickMs.p50.toFixed(2)}ms / draw p50 ${r.drawMs.p50.toFixed(2)}ms drawn ${r.drawnFrames}/${FRAMES} / gpu p50 ${r.gpuMs ? r.gpuMs.p50.toFixed(2) : '—'}ms (${r.gpuMethod}) / dc ${r.drawCalls} / tris ${r.tris}`);
                }
            }
        }
    }
} finally {
    await browser.close();
    server.close();
}

// ── 输出 ─────────────────────────────────────────────────────────────────
const f2 = (v) => (v === undefined || v === null ? '—' : Number(v).toFixed(2));
const rows = [
    ['arm', 'zoom', 'gate', 'layers', 'cmds', 'blits', 'dc', 'tris', 'tick p50', 'tick p95', 'tick n', 'drawn', 'draw p50', 'draw p95', 'frame p50', 'gpu p50', 'gpu p95', 'gpu n', 'upload p50', 'upload B/f', 'cells', 'nodes', 'filled', 'chg'],
    ...results.map((r) => [
        r.arm, r.zoom, r.gate ? 'on' : 'off', r.atlasLayers, r.cmdsPerFrame, r.blitsPerFrame, r.drawCalls, r.tris,
        f2(r.tickMs.p50), f2(r.tickMs.p95), r.tickMs.n, r.drawnFrames,
        f2(r.drawMs.p50), f2(r.drawMs.p95), f2(r.frameMs.p50),
        r.gpuMs ? f2(r.gpuMs.p50) : '—', r.gpuMs ? f2(r.gpuMs.p95) : '—', r.gpuMs ? r.gpuMs.n : 0,
        r.uploadMs ? f2(r.uploadMs.p50) : '—',
        r.uploadBytesPerFrame, r.atlasCells, r.spriteNodes, r.filledCells, r.modelChanges,
    ]),
];
const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
const table = rows.map((r) => r.map((c, i) => String(c).padEnd(widths[i])).join(' | ')).join('\n');
console.log(`\n=== 三臂同宿主读数（frames=${FRAMES}, warmup=${WARMUP}, gpu=${PROBE_GPU}, disturb=${DISTURB}, 档位 [E]）===\n${table}`);

mkdirSync(OUT_DIR, { recursive: true });
const meta = { generatedAt: new Date().toISOString(), host, caps, opts: { ARMS, ZOOMS, FRAMES, WARMUP, PROBE_GPU, DISTURB, GATES: GATES.map((g) => (g ? 'on' : 'off')), LAYERS }, pageErrors, results };
writeFileSync(join(OUT_DIR, 'carrier-bench.json'), JSON.stringify(meta, null, 2));
writeFileSync(join(OUT_DIR, 'carrier-bench.md'), `# 三臂载体同宿主性能取证（WXG-T-247 / ADR-0030 S0·S2）\n\n`
    + `> 档位 = **\`[E]\` 桌面 web-mobile**（真引擎 + 真 GPU 提交，非低端机）；\n`
    + `> ⛔ 本组读数**不构成** \`ADR-0022 D2\` 的「≥2 台低端同向」达线证据。\n\n`
    + `生成：${meta.generatedAt} · frames=${FRAMES} · warmup=${WARMUP} · gpuProbe=${PROBE_GPU} · disturb=${DISTURB} · gates=${GATES.map((g) => (g ? 'on' : 'off')).join(',')} · layers=${LAYERS.join(',')}\n\n`
    + `## 宿主事实\n\n\`\`\`json\n${JSON.stringify({ ...host, ...caps }, null, 2)}\n\`\`\`\n\n`
    + `## 读数\n\n\`\`\`\n${table}\n\`\`\`\n\n`
    + `## 逐臂原始 JSON\n\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\`\n`);
console.log(`\n证据落盘：${OUT_DIR}/carrier-bench.{json,md} + 逐臂截图`);
if (pageErrors.length) console.log(`⚠ 页内错误 ${pageErrors.length} 条：\n  ${pageErrors.slice(0, 6).join('\n  ')}`);
