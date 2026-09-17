#!/usr/bin/env node
/**
 * WXG-T-128 · Cocos web-mobile `[Cocos]` 连拍取证 v2.1 —— G6 结算彩带（800ms）+ G3 道具扫光（400ms）
 *
 * ── 定位（诚实口径，v1 不变）───────────────────────────────────────────────
 * 产出 = **观感取证物**（帧序列 + 相位/像素双定量摘要），对应 `test-cases §G.2`
 * TC-PER-21 / TC-PER-26 的 `[Cocos]` 连拍道次。**不判 PASS** —— 判读归 QA/主理人人眼复核。
 *
 * ── v2 修三处 v1 缺陷（WXG-T-156 排障登记）──────────────────────────────────
 * ① 时序：v1 Node 侧逐帧 screenshot（每帧 ~300ms 往返）抓 800ms 窗口 ⇒ 窗口耗光；
 *    且 G3 段在前，道具解完末珠同帧通关吃掉彩带窗口。v2 段序倒置（G6 先拍）。
 * ② 色检测：v1 纯色彩精确匹配对 MAIN 层（scrim 压暗混色）漏检 ⇒ 基线逐像素差分 +
 *    5 色近似 + 灰度计数（BD-50 黑化特征探针）。
 * ③ freshness：对账真实构建输入 = `games/<game>/cocos/assets/scripts`（非 src）。
 *
 * ── v2.1 换捕获通道（temp/burst-diag2 实测后定案）───────────────────────────
 * v2 的页内 `cc.screenshot.toCanvas` 在 Cocos **3.8.8 不存在**（实测 undefined，模块
 * 被构建剔除）。v2.1 = **CDP screencast**（`Page.startScreencast`）：
 *   · Node 侧连续收帧（实测 ≈37fps，合成器输出 ⇒ WebGL 画布天然非空白，无逐帧往返）；
 *   · 页内只挂**相位记录器**（代理 buildRenderModel，每帧记 {Date.now(), snapshot[field]}，
 *     零捕获开销）；
 *   · 收帧后按 `frame.metadata.timestamp` 与相位时序**最近邻对齐**，每个目标相位
 *     挑最近帧落盘（帧序单调递增）。
 * 诚实注记：screencast 为 **jpeg q90**（非无损 png），②的差分阈值放宽到 >10 以吸收
 * 压缩噪声；色彩近似判读仍有效（tol 30 ≫ jpeg 色度抖动的验收影响主要在人眼复核）。
 * ④ **G6 触发器 = 解环器卡**（v2.1 重拍轮实测）：手动 tap 风暴遇到「目标格被另一颗
 *    错位珠占据」的环会滞留托盘（实测 filled=21/tray=1 静置 6s ⇒ 永不清关）。
 *    `usePowerup` 点名全部错位珠、相 B 含**交换归位**、每颗落座判 isComplete ⇒ 通关
 *    必然（temp/burst-diag3 定位）。两卡各自 `POWERUP_FREE_USES=1`、换关复位
 *    （beads-game.ts §3.5 复位），G6/G3 段互不抢卡。
 *
 * ── 前置 ────────────────────────────────────────────────────────────────────
 *   pnpm run harness:build                             （tuning/palette 单一真源 dist）
 *   pnpm run framework:sync && pnpm run framework:sync:check
 *   pnpm --filter @wxgame/beads run build:cocos:web    （产物须为当前镜像代码）
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
const T = { ...(await import(`file://${distT}`)) };

// ── 产物新鲜度自查（v2③：对账真实构建输入 = Cocos 镜像目录）────────────────
function freshness() {
    const bundle = join(PRODUCT, 'src', 'chunks', 'bundle.js');
    if (!existsSync(bundle)) { console.error(`❌ 产物不存在：${PRODUCT}\n   先跑 pnpm --filter @wxgame/beads run build:cocos:web`); process.exit(3); }
    let newest = 0;
    const walk = (d) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (/\.(ts|js)$/.test(e.name)) newest = Math.max(newest, statSync(p).mtimeMs);
        }
    };
    walk(join(ROOT, 'games', 'beads', 'cocos', 'assets', 'scripts'));
    const prodM = statSync(bundle).mtimeMs;
    if (prodM < newest) {
        console.error(`⛔ 产物陈旧：bundle ${new Date(prodM).toISOString()} < assets/scripts ${new Date(newest).toISOString()}\n   先跑 pnpm run framework:sync && pnpm --filter @wxgame/beads run build:cocos:web（或加 --allow-stale 仅诊断）`);
        if (!process.argv.includes('--allow-stale')) process.exit(2);
    }
    return { prodM, newest };
}
const { prodM, newest } = freshness();

// ── 坐标真源（v1 同款）─────────────────────────────────────────────────────
const cards = T.powerupCardRects?.() ?? [];
if (!cards.length) { console.error('❌ powerupCardRects() 不可读'); process.exit(3); }
const CARD_CENTER = (i) => { const r = cards[i]; return [r.x + r.w / 2, r.bottom + r.h / 2]; };
const TRAY_ROWS = Math.ceil(T.TRAY_BASE_SLOTS / T.TRAY_COLS);
const lay = T.trayLayout(TRAY_ROWS);
const SLOT_CENTERS = Array.from({ length: T.TRAY_BASE_SLOTS }, (_, i) => [lay.slotCenterX(i % T.TRAY_COLS), lay.slotCenterY(Math.floor(i / T.TRAY_COLS))]);

// ── playwright 解析（v1 同款多候选）────────────────────────────────────────
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

// ── 页内驱动 v2.1：只挂相位记录器（捕获全部移到 Node 侧 screencast）────────
const HELPERS = `
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
        g.tapDesign(...cellCenter(s0, mi));
        const s1 = g.snapshot;
        const slot = s1.traySlots.findIndex((t) => t.state === 'free');
        if (slot < 0) return 'no-free-slot';
        g.tapDesign(...SLOT_CENTERS[slot]);
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
        g.tapDesign(...SLOT_CENTERS[held]);
        g.tapDesign(...cellCenter(g.snapshot, target));
    }
    return g.snapshot.phase;
};
/**
 * 相位记录器（一段一挂）：代理 buildRenderModel，每帧记 {t: Date.now(), p}。
 * 零捕获成本；Node 侧按 t 与 screencast 帧 metadata.timestamp 对齐。
 */
window.__armBurst = (field) => {
    const g = window.__game();
    if (!g.__burstOrig) g.__burstOrig = g.buildRenderModel;
    const orig = g.__burstOrig;
    window.__phaseLog = [];
    window.__burst = { field };
    g.buildRenderModel = function (builder) {
        orig.call(this, builder);
        if (window.__burst) window.__phaseLog.push({ t: Date.now(), p: this.snapshot[window.__burst.field] ?? 0 });
    };
    return true;
};
`;

const { chromium } = playwright;
const browser = await chromium.launch();
try {
    const ctx = await browser.newContext({ viewport: { width: 750, height: 1334 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 140)));
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => {
        const cc = window.cc;
        if (!cc) return false;
        const root = cc.director.getScene()?.getChildByName('Canvas')?.getChildByName('GameRoot');
        return !!root?.getComponent?.(cc.js.getClassByName('BeadsBootstrap'))?._app?.game?.snapshot?.phase;
    }, null, { timeout: 30000 });
    await page.evaluate(() => {
        try { const d = window.cc.debug; if (d) { d.setDisplayStats ? d.setDisplayStats(false) : (d.isDisplayStats = false); } } catch { }
        document.querySelectorAll('#stats, .stats').forEach((n) => n.remove());
    });
    await page.evaluate(HELPERS);
    await page.waitForFunction(() => window.__game && window.__game().snapshot.phase === 'playing', null, { timeout: 15000 });
    mkdirSync(OUT_DIR, { recursive: true });

    const paletteMod = await import(`file://${join(ROOT, 'dev/harness/dist/games/beads/src/view/palette.js')}`);
    const CCOLORS = (paletteMod.CONFETTI_COLORS ?? []).map((hex) => {
        const n = parseInt(hex.replace('#', ''), 16);
        return [hex, (n >> 16) & 255, (n >> 8) & 255, n & 255];
    });

    const cdp = await ctx.newCDPSession(page);
    const tsOf = (f) => (f.metadata && f.metadata.timestamp ? f.metadata.timestamp * 1000 : f.__recv);

    /**
     * v2.1 段执行器：挂记录器 → 开 screencast → 触发 → 等末相位达标 → 停帧流。
     * 对齐：BASE = 触发前最近帧；每个 target = 相位日志首次越界时刻的最近帧（索引单调）。
     */
    async function burstSegment(prefix, field, targets, trigger) {
        await page.evaluate((f) => window.__armBurst(f), field);
        const frames = [];
        const onFrame = (f) => { f.__recv = Date.now(); frames.push(f); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => { }); };
        cdp.on('Page.screencastFrame', onFrame);
        await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 750, maxHeight: 1334, everyNthFrame: 1 });
        const t0 = Date.now();
        const trigResult = await trigger();
        const lastTarget = targets[targets.length - 1];
        await page.waitForFunction(
            ([f, lt]) => { const L = window.__phaseLog; return !!L.length && L[L.length - 1].p >= lt; },
            [field, lastTarget], { timeout: 9000 },
        ).catch(() => console.warn(`⚠️ ${prefix}：${field} 未在窗口内到达 ${lastTarget}，按已收数据出报告`));
        await page.waitForTimeout(120);
        await cdp.send('Page.stopScreencast');
        cdp.off('Page.screencastFrame', onFrame);
        const log = await page.evaluate(() => { const l = window.__phaseLog; window.__burst = null; window.__phaseLog = []; return l; });
        const fps = frames.length ? (frames.length / Math.max(1, (tsOf(frames[frames.length - 1]) - t0))) * 1000 : 0;

        // 相位越界时刻表
        const crossings = targets.map((tg) => { const hit = log.find((s) => s.p >= tg); return hit ? { target: tg, t: hit.t, p: hit.p } : { target: tg, t: null, p: null }; });
        const pick = (tTarget, fromIdx) => {
            let bi = -1, bd = Infinity;
            for (let i = fromIdx; i < frames.length; i++) {
                const d = Math.abs(tsOf(frames[i]) - tTarget);
                if (d < bd) { bd = d; bi = i; }
            }
            return bi >= 0 && bd <= 150 ? bi : -1;   // >150ms 视为无对应帧
        };
        const baseIdx = pick(t0 + 60, 0) >= 0 ? pick(t0 + 60, 0) : 0;
        const picked = [{ idx: baseIdx, target: 0, p: 0, base: true }];
        let cursor = baseIdx;
        for (const c of crossings) {
            if (c.t == null) { picked.push({ idx: -1, target: c.target, p: null, err: 'phase-never-crossed' }); continue; }
            const idx = pick(c.t, cursor + 1);
            if (idx < 0) { picked.push({ idx: -1, target: c.target, p: c.p, err: 'no-frame-in-150ms' }); continue; }
            cursor = idx;
            const near = log.reduce((a, s) => (Math.abs(s.t - tsOf(frames[idx])) < Math.abs(a.t - tsOf(frames[idx])) ? s : a), log[0]);
            picked.push({ idx, target: c.target, p: near ? near.p : c.p });
        }
        const rows = [];
        for (let k = 0; k < picked.length; k++) {
            const s = picked[k];
            const f = join(OUT_DIR, `${prefix}-${String(k).padStart(2, '0')}${s.base ? '-BASE' : ''}.jpg`);
            if (s.idx >= 0) writeFileSync(f, Buffer.from(frames[s.idx].data, 'base64'));
            rows.push({ frame: k, target: s.target, p: s.p, base: !!s.base, err: s.err ?? null, file: s.idx >= 0 ? f : null, bytesKB: s.idx >= 0 ? Math.round(frames[s.idx].data.length / 1024) : 0 });
        }
        // 基线差分（v2②口径，jpeg q90 ⇒ 阈值 10）
        const b64 = picked.map((s) => (s.idx >= 0 ? frames[s.idx].data : null));
        const diffs = await page.evaluate(async (payload) => {
            const load = async (u) => {
                if (!u) return null;
                const bin = atob(u); const u8 = new Uint8Array(bin.length);
                for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
                const bmp = await createImageBitmap(new Blob([u8], { type: 'image/jpeg' }));
                const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                return g.getImageData(0, 0, bmp.width, bmp.height).data;
            };
            const base = await load(payload.urls[0]);
            const out = [];
            for (let idx = 1; idx < payload.urls.length; idx++) {
                const d = await load(payload.urls[idx]);
                if (!d || !base) { out.push(null); continue; }
                let diff = 0, colorish = 0, gray = 0;
                for (let k = 0; k < d.length; k += 16) {
                    if (Math.abs(d[k] - base[k]) > 10 || Math.abs(d[k + 1] - base[k + 1]) > 10 || Math.abs(d[k + 2] - base[k + 2]) > 10) {
                        diff++;
                        if (Math.abs(d[k] - d[k + 1]) <= 4 && Math.abs(d[k + 1] - d[k + 2]) <= 4) gray++;
                        for (const [, cr, cg, cb] of payload.colors) {
                            if (Math.abs(d[k] - cr) < 30 && Math.abs(d[k + 1] - cg) < 30 && Math.abs(d[k + 2] - cb) < 30) { colorish++; break; }
                        }
                    }
                }
                out.push({ diff, colorish, gray });
            }
            return out;
        }, { urls: b64, colors: CCOLORS });
        for (let k = 1; k < rows.length; k++) rows[k].vsBase = diffs[k - 1] ?? null;
        const first = crossings.find((c) => c.t != null);
        const last = crossings[crossings.length - 1];
        const span = first && first.t != null && last.t != null ? last.t - first.t : null;
        return { rows, framesRecv: frames.length, fps: Math.round(fps * 10) / 10, logSamples: log.length, windowSpanMs: span, trigResult };
    }

    // ══ 段 1 · G6 彩带（800ms）：解环器卡整板归位 → 通关臂起，8 相位对齐帧 ════
    console.log('🎬 G6 彩带：解环器卡（点名单颗→相 B 交换归位→必通关）→ screencast 连拍 + 8 相位对齐帧');
    const g6 = await burstSegment('g6-confetti', 'confettiProgress', [0.1, 0.2, 0.32, 0.45, 0.58, 0.7, 0.82, 0.94],
        async () => { const [x, y] = CARD_CENTER(0); return page.evaluate(([xx, yy]) => { window.__game().tapDesign(xx, yy); return window.__game().snapshot.phase; }, [x, y]); });

    // ══ 段 2 · G3 扫光（400ms）：goToLevel(1) 新板；若同帧通关如实记 phase ════
    console.log('🎬 G3 扫光：goToLevel(1) 新板 → 道具卡 0 → 5 相位对齐帧');
    await page.evaluate(() => { window.__game().goToLevel(1); });
    await page.waitForFunction(() => window.__game().snapshot.phase === 'playing', null, { timeout: 10000 });
    const misplaced1 = await page.evaluate(() => window.__game().snapshot.cells.filter((c) => !c.void && c.state === 'filled' && c.beadColorIdx > 0 && c.beadColorIdx !== c.colorIdx).length);
    const g3 = await burstSegment('g3-sweep', 'sweepProgress', [0.15, 0.35, 0.55, 0.75, 0.92],
        async () => { const [x, y] = CARD_CENTER(0); return page.evaluate(([xx, yy]) => { window.__game().tapDesign(xx, yy); }, [x, y]); });
    const phaseAfterSweep = await page.evaluate(() => window.__game().snapshot.phase);

    // ── 摘要与终端表 ─────────────────────────────────────────────────────────
    const summary = {
        tool: 'v2.1',
        capture: 'cdp-screencast(jpeg q90) + 页内相位日志最近邻对齐',
        product: PRODUCT,
        productMtime: new Date(prodM).toISOString(),
        scriptsNewestMtime: new Date(newest).toISOString(),
        g6: { ...g6, frames: undefined, rows: g6.rows },
        g3: { level: 1, misplaced: misplaced1, phaseAfterSweep, ...g3, frames: undefined, rows: g3.rows },
        pageErrors,
        note: '观感取证物，不判 PASS（TC-PER-21/26 [Cocos] 道次；判读 = 人眼复核）。帧 0 = 触发前基线（BASE）；vsBase = 对基线每 4 像素采样的差分计数（阈值 10 吸收 jpeg q90 压缩噪声），gray = 差分中 R≈G≈B 像素（BD-50 黑化特征探针，修复后应远低于 colorish）。',
    };
    const sf = join(OUT_DIR, 'burst-summary.json');
    writeFileSync(sf, JSON.stringify(summary, null, 2));
    for (const r of [...g6.rows, ...g3.rows]) {
        const v = r.vsBase;
        console.log(`  📸 ${r.file ? r.file.split('/').pop() : '(无帧:' + r.err + ')'}  p=${typeof r.p === 'number' ? r.p.toFixed(3) : r.p}${v ? `  diff=${v.diff} 5色近似=${v.colorish} 灰度=${v.gray}` : ''}`);
    }
    console.log(`\n📝 ${sf}`);
    console.log(`   G6 收帧=${g6.framesRecv}（≈${g6.fps}fps）窗口跨度=${g6.windowSpanMs}ms；G3 收帧=${g3.framesRecv} 窗口=${g3.windowSpanMs}ms`);
    console.log(`   G3（level 1，错位珠=${misplaced1}）扫光后 phase = ${phaseAfterSweep}`);
    if (pageErrors.length) { console.error(`\n⚠️ page errors:`, pageErrors.slice(0, 3)); process.exit(3); }
} finally {
    await browser.close();
    server.close();
}
