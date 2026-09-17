#!/usr/bin/env node
/**
 * WXG-T-128 · Cocos web-mobile `[Cocos]` 连拍取证 —— G3 道具扫光（400ms）+ G6 结算彩带（800ms）
 *
 * ── 定位（诚实口径）─────────────────────────────────────────────────────────
 * 产出 = **观感取证物**（png 序列 + 相位摘要），对应 `test-cases §G.2` TC-PER-21 / TC-PER-26 的
 * `[Cocos]` 连拍道次。**不判 PASS** —— 判据原文「[Cocos] 连拍看观感」的判读归 QA/主理人人眼复核；
 * 本脚本只保证「画面确实来自当前代码产物 + 相位窗口内抓帧」。
 *
 * ── 前置 ────────────────────────────────────────────────────────────────────
 *   pnpm run harness:build                             （tuning.js 单一真源）
 *   pnpm --filter @wxgame/beads run build:cocos:web    （产物须为当前代码，脚本自查 mtime）
 *
 * ── 运行 ────────────────────────────────────────────────────────────────────
 *   node tools/scripts/cocos-vfx-burst.mjs [--out=<dir>] [--allow-stale]
 *   默认输出 production/qa/beads/evidence/vfx-burst/
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PRODUCT = join(ROOT, 'games', 'beads', 'cocos', 'build', 'web-mobile');
const OUT_DIR = (() => {
    const hit = process.argv.find((a) => a.startsWith('--out='));
    return hit ? resolve(hit.split('=').slice(1).join('=')) : join(ROOT, 'production', 'qa', 'beads', 'evidence', 'vfx-burst');
})();

// tuning 单一真源 = harness dist（探针同款加载路径）
const distT = join(ROOT, 'dev', 'harness', 'dist', 'games', 'beads', 'src', 'config', 'tuning.js');
if (!existsSync(distT)) { console.error('❌ 缺 dev/harness/dist tuning.js（先 pnpm run harness:build）'); process.exit(3); }
const T = { ...(await import(`file://${distT}`)) };   // dist 为具名导出 ⇒ 聚合成 T（探针同口径）

// ── 产物新鲜度自查（反假绿；同 cocos-input-probe 口径）─────────────────────
function freshness() {
    const bundle = join(PRODUCT, 'src', 'chunks', 'bundle.js');
    if (!existsSync(bundle)) { console.error(`❌ 产物不存在：${PRODUCT}\n   先跑 pnpm --filter @wxgame/beads run build:cocos:web`); process.exit(3); }
    let newestSrc = 0;
    const walk = (d) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (/\.(ts|js)$/.test(e.name)) newestSrc = Math.max(newestSrc, statSync(p).mtimeMs);
        }
    };
    walk(join(ROOT, 'games', 'beads', 'src'));
    const prodM = statSync(bundle).mtimeMs;
    if (prodM < newestSrc) {
        console.error(`⛔ 产物陈旧：bundle ${new Date(prodM).toISOString()} < src ${new Date(newestSrc).toISOString()}\n   先跑 pnpm --filter @wxgame/beads run build:cocos:web（或加 --allow-stale 仅诊断）`);
        if (!process.argv.includes('--allow-stale')) process.exit(2);
    }
    return { prodM, newestSrc };
}
const { prodM, newestSrc } = freshness();

// ── 坐标真源（探针同款公式；tapDesign 直吃设计系 y-up 坐标，无需翻转）──────
const cards = T.powerupCardRects?.() ?? [];
if (!cards.length) { console.error('❌ powerupCardRects() 不可读'); process.exit(3); }
const CARD_CENTER = (i) => { const r = cards[i]; return [r.x + r.w / 2, r.bottom + r.h / 2]; };
const cellXY = (s, i) => [
    s.gridLeft + T.BEAD_CELL / 2 + T.BEAD_PITCH * (i % s.gridCols),
    s.gridTop - T.BEAD_CELL / 2 - T.BEAD_PITCH * Math.floor(i / s.gridCols),
];
const TRAY_PITCH099 = T.TRAY_SLOT + T.TRAY_GAP;
const TRAY_ROWS = Math.ceil(T.TRAY_BASE_SLOTS / T.TRAY_COLS);
const lay = T.trayLayout(TRAY_ROWS);
const SLOT_CENTERS = Array.from({ length: T.TRAY_BASE_SLOTS }, (_, i) => [lay.slotCenterX(i % T.TRAY_COLS), lay.slotCenterY(Math.floor(i / T.TRAY_COLS))]);

// ── playwright 解析（input-probe 同款多候选，含 workbuddy binaries）────────
const pwCands = [
    process.env.WXG_PLAYWRIGHT_MODULES,
    join(homedir(), '.workbuddy/binaries/node/workspace/node_modules'),
    join(ROOT, 'node_modules'),
].filter(Boolean);
const pwErrs = [];
let playwright = null;
for (const c of pwCands) {
    try { playwright = createRequire(join(c, 'package.json'))('playwright'); break; } catch (e) { pwErrs.push(`${c}: ${e.message.slice(0, 50)}`); }
}
if (!playwright) { console.error(`❌ playwright 不可解析：\n  ${pwErrs.join('\n  ')}`); process.exit(3); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.bin': 'application/octet-stream', '.plist': 'application/xml', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(PRODUCT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(PRODUCT)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file) || extname(file) === '') file = join(PRODUCT, 'index.html');
    try { res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }); res.end(readFileSync(file)); }
    catch { res.writeHead(404); res.end(); }
});
await new Promise((d) => server.listen(0, '127.0.0.1', d));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

// 页面内驱动（坐标由 Node 侧传入：SLOT_CENTERS / cellCenter(i, snap 常量)）
const PX_HELPERS = `
window.__game = () => {
    const cc = window.cc;
    const root = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');
    return root.getComponent(cc.js.getClassByName('BeadsBootstrap'))._app.game;
};
window.__solveBoard = (SLOT_CENTERS, BEAD_CELL, BEAD_PITCH) => {
    const g = window.__game();
    const cellCenter = (s, i) => [
        s.gridLeft + BEAD_CELL / 2 + BEAD_PITCH * (i % s.gridCols),
        s.gridTop - BEAD_CELL / 2 - BEAD_PITCH * Math.floor(i / s.gridCols),
    ];
    const misplaced = () => g.snapshot.cells.findIndex((c) => !c.void && c.state === 'filled' && c.beadColorIdx > 0 && c.beadColorIdx !== c.colorIdx);
    for (let k = 0; k < 40; k++) {
        const mi = misplaced();
        if (mi < 0) break;
        const s0 = g.snapshot;
        g.tapDesign(...cellCenter(s0, mi));                       // ① 选中错位珠
        const s1 = g.snapshot;
        const slot = s1.traySlots.findIndex((t) => t.state === 'free');
        if (slot < 0) return 'no-free-slot';
        g.tapDesign(...SLOT_CENTERS[slot]);                        // ② 取回入槽
        const s2 = g.snapshot;
        const held = s2.traySlots.findIndex((t) => t.state !== 'free');
        if (held < 0) continue;
        const color = s2.traySlots[held].colorIdx;
        let target = -1;
        for (let j = 0; j < s2.cells.length; j++) {
            const c = s2.cells[j];
            if (!c.void && c.state === 'empty' && c.colorIdx === color) { target = j; break; }
        }
        if (target < 0) continue;
        g.tapDesign(...SLOT_CENTERS[held]);                        // ③ 选中托盘珠
        g.tapDesign(...cellCenter(g.snapshot, target));            // ④ 归位
    }
    return g.snapshot.phase;
};
`;

const { chromium } = playwright;
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 750, height: 1334 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 140)));
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => {
        const cc = window.cc;
        if (!cc) return false;
        const root = cc.director.getScene()?.getChildByName('Canvas')?.getChildByName('GameRoot');
        const app = root?.getComponent?.(cc.js.getClassByName('BeadsBootstrap'))?._app;
        return !!app?.game?.snapshot?.phase;
    }, null, { timeout: 30000 });
    await page.evaluate(() => {
        try { const d = window.cc.debug; if (d) { d.setDisplayStats ? d.setDisplayStats(false) : (d.isDisplayStats = false); } } catch {}
        document.querySelectorAll('#stats, .stats').forEach((n) => n.remove());
    });
    await page.evaluate(PX_HELPERS);          // 先注入驱动（__game 等），再等 playing
    await page.waitForFunction(() => window.__game && window.__game().snapshot.phase === 'playing', null, { timeout: 15000 });
    mkdirSync(OUT_DIR, { recursive: true });

    const snapOf = () => page.evaluate(() => {
        const g = window.__game();
        return { phase: g.snapshot.phase, sweep: g.snapshot.sweepProgress ?? null, confetti: g.snapshot.confettiProgress ?? null };
    });

    // ── G3 道具扫光（400ms）：点**卡 0（solver 单颗）** ⇒ 若该关错位 ≥2 则不通关，
    //    扫光窗口不被彩带/通关打断（首跑教训：道具一次清完 ⇒ 同帧通关，
    //    `_stepSweepFx` 只在 playing 推进 ⇒ level-clear 下 sweep 恒 0）。
    //    `--level=N` 可换关（错位珠更多的关更易满足「生效但不通关」）。────────
    const lvlArg = process.argv.find((a) => a.startsWith('--level='));
    const lvl = lvlArg ? Number(lvlArg.split('=')[1]) : 0;
    if (lvl > 0) await page.evaluate((n) => { window.__game().goToLevel(n); }, lvl);
    await page.waitForFunction(() => window.__game().snapshot.phase === 'playing', null, { timeout: 10000 });
    const misplacedCnt = await page.evaluate(() => window.__game().snapshot.cells.filter((c) => !c.void && c.state === 'filled' && c.beadColorIdx > 0 && c.beadColorIdx !== c.colorIdx).length);
    const [cx3, cy3] = CARD_CENTER(0);
    const g3Shots = [];
    console.log(`\n🎬 G3 扫光：level=${lvl}（错位珠=${misplacedCnt}）tapDesign 道具卡 0 @设计(${cx3.toFixed(0)},${cy3.toFixed(0)})`);
    await page.evaluate(([x, y]) => { window.__game().tapDesign(x, y); }, [cx3, cy3]);
    for (let i = 0; i < 5; i++) {
        const f = join(OUT_DIR, `g3-sweep-${String(i).padStart(2, '0')}.png`);
        await page.screenshot({ path: f });
        g3Shots.push({ file: f, ...(await snapOf()) });
    }
    await page.waitForTimeout(600);

    // ── G6 结算彩带（800ms）：解算当前关 ⇒ level:cleared 同帧臂起 ⇒ 高密度连拍
    //    + **5 色像素检测**（定量回答「彩带在 Cocos 产物上是否真的画出来」—— 两帧人眼
    //    未见彩带 ⇒ 需排除「相位滞后 + 禁飞带跳画」的解释，色像素计数是硬证据）。──
    const paletteMod = await import(`file://${join(ROOT, 'dev/harness/dist/games/beads/src/view/palette.js')}`);
    const CCOLORS = (paletteMod.CONFETTI_COLORS ?? []).map((hex) => {
        const n = parseInt(hex.replace('#', ''), 16);
        return [hex, (n >> 16) & 255, (n >> 8) & 255, n & 255];
    });
    console.log('🎬 G6 彩带：解算当前关（两步式取回+归位）→ 通关臂起 → 10 帧连拍 + 5 色像素检测');
    const phaseAfterSolve = await page.evaluate(([sc, bc, bp]) => window.__solveBoard(sc, bc, bp), [SLOT_CENTERS, T.BEAD_CELL, T.BEAD_PITCH]);
    const g6Shots = [];
    for (let i = 0; i < 10; i++) {
        const f = join(OUT_DIR, `g6-confetti-${String(i).padStart(2, '0')}.png`);
        const buf = await page.screenshot({ path: f });
        const phase = await snapOf();
        const colorHits = await page.evaluate(async (payload) => {
            const bin = atob(payload.b64);
            const u8 = new Uint8Array(bin.length);
            for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
            const bmp = await createImageBitmap(new Blob([u8], { type: 'image/png' }));
            const c = new OffscreenCanvas(bmp.width, bmp.height);
            const g = c.getContext('2d');
            g.drawImage(bmp, 0, 0);
            const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
            const found = {};
            for (let k = 0; k < d.length; k += 16) {
                const r = d[k], gg = d[k + 1], b = d[k + 2];
                for (const [name, cr, cg, cb] of payload.colors) {
                    if (Math.abs(r - cr) < 14 && Math.abs(gg - cg) < 14 && Math.abs(b - cb) < 14) { found[name] = (found[name] ?? 0) + 1; break; }
                }
            }
            return found;
        }, { b64: buf.toString('base64'), colors: CCOLORS });
        g6Shots.push({ file: f, colorHits, ...phase });
    }

    // ── 摘要 ────────────────────────────────────────────────────────────────
    const summary = {
        product: PRODUCT,
        productMtime: new Date(prodM).toISOString(),
        srcNewestMtime: new Date(newestSrc).toISOString(),
        cardRects: cards,
        g3: g3Shots, g6: g6Shots,
        phaseAfterSolve,
        pageErrors,
        note: '观感取证物，不判 PASS（TC-PER-21/26 [Cocos] 道次；判读 = 人眼复核）',
    };
    const sf = join(OUT_DIR, 'burst-summary.json');
    writeFileSync(sf, JSON.stringify(summary, null, 2));
    console.log('');
    for (const s of [...g3Shots, ...g6Shots]) console.log(`  📸 ${s.file}  sweep=${s.sweep} confetti=${s.confetti} phase=${s.phase}`);
    console.log(`\n📝 ${sf}`);
    console.log(`   solve 后 phase = ${phaseAfterSolve}（期望 level-clear：彩带与面板同帧臂起）`);
    if (pageErrors.length) { console.error(`\n⚠️ page errors:`, pageErrors.slice(0, 3)); process.exit(3); }
} finally {
    await browser.close();
    server.close();
}
