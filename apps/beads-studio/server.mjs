#!/usr/bin/env node
/**
 * beads-studio 服务（WXG-T-179 续作）：照片转拼豆在线生成器。
 *
 * 零第三方依赖（纯 node:http）。生成核心 = `tools/scripts/beads-gen.mjs`
 * （子进程 spawn，`--in-raw` 免浏览器路径 ⇒ 服务器无需 playwright/chromium）。
 *
 * API：
 *   POST /api/generate?cols=&rows=&board=&shape=&palette=&colors=&colorsmode=&swaps=&noframe=
 *        body = JSON `{ w, h, data: base64(RGBA), thumb?: dataURL }`
 *        图片由前端 canvas 本地解像（不上传原文件）；`thumb` = ≤256px JPEG 缩略图，
 *        **随结果存盘** ⇒ 历史条目也能回看原图（只存在前端内存里刷新/切条目就丢）。
 *   GET  /api/results         → 结果列表（按盘面分组、时间倒序）
 *   GET  /api/results/:id     → 单个 result.json（小游戏在线导入用）
 *   GET  /api/results/:id/level → 直接回 levelDraft（小游戏字段最少化；不可入关 ⇒ 422 + 原因）
 *   DELETE /api/results/:id     → 删除该条结果（整目录；id 走 [a-z0-9-] 白名单，不可逆）
 *   GET  /                    → 静态页 public/index.html
 *
 * 存储：data/<board>/<id>/result.json（归类 = 目录即盘面档位）。
 */
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const ROOT = dirname(fileURLToPath(import.meta.url)); // apps/beads-studio
const REPO = join(ROOT, '../..'); // workspace 根（本地跑）；容器内见 Dockerfile 布局
const GEN = existsSync(join(REPO, 'tools/scripts/beads-gen.mjs'))
    ? join(REPO, 'tools/scripts/beads-gen.mjs')
    : join(ROOT, 'vendor/beads-gen.mjs'); // 容器：beads-gen 拷到 vendor/（见 Dockerfile）
// 子进程 cwd：容器 = /app（artkal 色板按 cwd/temp/ 解析，与 Dockerfile 布局对齐）；本地 = 仓根
const SPAWN_CWD = existsSync(join(ROOT, 'vendor/beads-gen.mjs')) ? ROOT : REPO;
const DATA = join(ROOT, 'data');
const PUBLIC = join(ROOT, 'public');
const PORT = parseInt(process.env.PORT || '8787', 10);
const MAX_BODY = 4096 * 4096 * 4 * 1.5 + 1024; // RGBA 4096² + base64 膨胀余量（v1.5 不缩图，与前端解像上限对齐）
const MAX_PIXELS = 4096 * 4096; // v1.5（2026-09-21 用户拍板）：不缩图，原始 px 是测格/豆数输入；上限仅拦异常体

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
};

function send(res, code, body, type = 'application/json; charset=utf-8') {
    res.writeHead(code, {
        'Content-Type': type,
        'Access-Control-Allow-Origin': '*', // 小游戏 wx.request / 本地调试跨域友好（工具服务，无鉴权）
    });
    res.end(body);
}
const sendJson = (res, code, obj) => send(res, code, JSON.stringify(obj));

/** 读取请求体（上限 MAX_BODY）。 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY) {
                reject(new Error('body too large'));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

/** spawn beads-gen（--in-raw --no-png），resolve pattern.json 对象。 */
function runGen(rawPath, outDir, params) {
    return new Promise((resolve, reject) => {
        const args = [
            GEN,
            '--in-raw', rawPath,
            '--no-png',
            '--out', outDir,
            '--cols', String(params.cols),
            '--rows', String(params.rows),
            '--palette', params.palette,
            '--colorsmode', params.colorsmode,
            '--cellmode', params.cellmode,
            '--swaps', String(params.swaps),
            '--smooth', String(params.smooth),
            // 错位模式：full = 全盘错位（成片错豆，引擎 misplaced 初盘）/ swaps = k 对交换
            '--mis', params.mis,
        ];
        if (params.shape && params.shape !== 'square') args.push('--shape', params.shape);
        if (params.colors > 0) args.push('--colors', String(params.colors));
        if (params.noframe) args.push('--noframe');
        const child = spawn('node', args, { cwd: SPAWN_CWD, timeout: 60_000 });
        let err = '';
        child.stderr.on('data', (d) => (err += d));
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                try {
                    resolve(JSON.parse(readFileSync(join(outDir, 'pattern.json'), 'utf8')));
                } catch (e) {
                    reject(e);
                }
            } else {
                reject(new Error(`beads-gen 退出 ${code}：${err.trim().slice(-500) || '(无 stderr)'}`));
            }
        });
    });
}

/** 列出 data/ 下全部 result.json（按 createdAt 倒序）。
 *  只回**轻投影**（不含 thumb / levelDraft / misplaced / report）：列表要同时给前端与小游戏拉，
 *  携带 pattern 与缩略图会随条数线性膨胀；点条目时再 `GET /api/results/:id` 取全量。 */
function listResults() {
    if (!existsSync(DATA)) return [];
    const out = [];
    for (const board of readdirSync(DATA)) {
        const dir = join(DATA, board);
        for (const id of readdirSync(dir)) {
            try {
                const r = JSON.parse(readFileSync(join(dir, id, 'result.json'), 'utf8'));
                out.push({
                    id: r.id, board: r.board, cols: r.cols, rows: r.rows, shape: r.shape,
                    palette: r.palette, colors: r.colors, swaps: r.swaps, misMode: r.misMode || 'swaps', createdAt: r.createdAt,
                    // 旧条目（本次字段上线前存盘）没有 importable ⇒ 回落实算，与 /level 端点同口径
                    hasThumb: !!r.thumb, importable: r.importable ?? (importBlockers(r).length === 0),
                });
            } catch {
                /* 跳过损坏条目 */
            }
        }
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
}

/** id 只允许 [a-z0-9-]，防目录穿越。 */
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * 「能不能入关」单一判据（值域全部来自 `systems-index §3` 冻结常量，不是 Studio 自定）：
 * 盘面 ≥ 6×5（下限来自 `GRID_MIN_*`，§3.3 v1.37）；≤50 为单图，任一维 >50 自动走
 * 组合图 Plate（均分切块，见关卡内容管线 spec §0）。用色 3–10（`BEAD_COLOR_MAX=10`）。
 *  · 交换对数 1–8（`MISPLACED_PAIRS_MIN/MAX`）。
 *
 * 色板不限（v1.40 品牌引用制，2026-09-21 用户拍板）：关卡写回 `palette`（slug）+
 * `paletteCodes`（紧凑序色号），游戏侧从品牌注册表查 hex 渲染 —— 无映射、无拦截。
 */
function importBlockers(r, { allowOversize = false } = {}) {
    const b = [];
    const full = r.misMode === 'full';
    if (!r.levelDraft) b.push('无关卡草案（全盘错位需满足主导色 ≤ 可填半数；交换模式需 k ≥ 1）');
    if (!full && r.swaps > 8) b.push(`交换对数 ${r.swaps} > 8（\`MISPLACED_PAIRS_MAX\`）`);
    if (full && r.levelDraft && !Array.isArray(r.levelDraft.misplaced)) b.push('全错位模式但草案缺 misplaced 字段');
    if (r.colors < 3) b.push(`用色 ${r.colors} < 3（BOOT 下限）`);
    if (r.colors > 10) b.push(`用色 ${r.colors} > 10（\`BEAD_COLOR_MAX\`，§3.2 v1.36）`);
    if (r.cols < 6) b.push(`列数 ${r.cols} < 6（\`GRID_MIN_COLS\`）`);
    if (r.rows < 5) b.push(`行数 ${r.rows} < 5（\`GRID_MIN_ROWS\`）`);
    // >50 仅 ingest 放行（走 plate：当前 501 待 P2b）；列表投影 / `/level` / 生成快照默认拦 >50。
    // 否则小游戏 importLatest 会选中 >50 头 → validateBeadsLevel 失败且不回退下一条合法关（I1 回归）。
    if (!allowOversize && (r.cols > 50 || r.rows > 50))
        b.push(`盘 ${r.cols}×${r.rows} 超 50：组合图 Plate 待 P2b，此端不支持`);
    return b;
}

/**
 * 入关期真引擎实测（§3.5 v1.41 · 公式 v0.2）：把 result.json 交 `tools/scripts/beads-bot.ts`，
 * 拿到实测点击数 → 时长，以及硬拦 blockers。
 *
 * **为何不在本文件算**：旧副本 `estimateLevelTime`（v0.1 按颗定价）已删 —— 它在 32 盘
 * 语料上 32/32 触顶 420s，隐含 s/tap 跨 150 倍（证据 `games/beads/design/forensics/
 * diff-v02/grid.log.txt`）。正本唯一 = `level-import.ts measuredLevelTime`，本端只消费。
 * 入关本就仅本地仓（容器 501）⇒ bot 必不可用则拒收，**不回落静态估算**。
 * bot 吃 result.json 的 `levelDraft`（pattern 模式），无需临时文件。
 *
 * @returns 实测结果对象；bot 不可用/崩溃 ⇒ null。
 */
function measureWithBot(resultFile) {
    const r = spawnSync(process.execPath, [
        '--experimental-transform-types',
        '--import=./games/beads/design/forensics/g3/g3-hooks.mjs',
        'tools/scripts/beads-bot.ts', resultFile,
    ], { cwd: REPO, encoding: 'utf8' });
    const last = (r.stdout || '').trim().split('\n').pop();
    return last && last.startsWith('{') ? JSON.parse(last) : null; // stdout 最后一行 = 结果 JSON
}

/**
 * 逐格实测（P2b）：把 cells[] 包装成 {levels: [...]} 临时文件喂 beads-bot，取每格实测 time。
 * 任一格 cleared!==true 或 blockers 非空 ⇒ ok=false（整板拒收）。
 * @param {Array} cells 每格需含 id/name/cols/rows/pattern/swaps?/misplaced?/decoys?/palette?/paletteCodes?
 */
function measureCells(cells) {
    const tmpLevels = { levels: cells.map((c, i) => ({
        id: c.id ?? (9001 + i),
        name: c.name ?? `cell-${i}`,
        cols: c.cols, rows: c.rows, time: 0,
        cycleProfile: 'short', decoys: c.decoys ?? [],
        pattern: c.pattern, swaps: c.swaps ?? [],
        ...(c.misplaced ? { misplaced: c.misplaced } : {}),
        ...(c.palette ? { palette: c.palette, paletteCodes: c.paletteCodes } : {}),
    }))};
    const tmpFile = join(REPO, 'temp', `beads-p2b-${Date.now()}.json`);
    mkdirSync(join(REPO, 'temp'), { recursive: true });
    writeFileSync(tmpFile, JSON.stringify(tmpLevels));
    try {
        const r = spawnSync(process.execPath, [
            '--experimental-transform-types',
            '--import=./games/beads/design/forensics/g3/g3-hooks.mjs',
            'tools/scripts/beads-bot.ts', tmpFile,
        ], { cwd: REPO, encoding: 'utf8' });
        const last = (r.stdout || '').trim().split('\n').pop();
        if (!last || !last.startsWith('['))
            return { ok: false, error: `beads-bot 多关输出解析失败: ${String(last || '').slice(0, 80)}` };
        const results = JSON.parse(last);
        for (const res of results) {
            if (!res.cleared)
                return { ok: false, error: `格 ${res.name} bot 未通关（${res.blockers?.join('；') || 'cleared=false'}）` };
            if (res.blockers?.length)
                return { ok: false, error: `格 ${res.name}: ${res.blockers.join('；')}` };
        }
        return { ok: true, results };
    } finally {
        try { rmSync(tmpFile); } catch { /* 临时文件清理失败可忽略 */ }
    }
}

/**
 * 一键入关（WXG-T-179）：levelDraft → 追加 design/levels 真源 → 跑 levels:sync + framework:sync，
 * harness/Cocos 构建即刻能玩。关卡入表正路 = `levels:sync` 管线（非运行时魔改），本端点只是把
 * 三步收进一次点击。**仅本地仓模式**（VPS 容器无 games/ ⇒ 501；服务无鉴权，这也是不开到公网的理由）；
 * sync 失败 ⇒ 回滚真源原文并重 sync，不留半截状态。
 */
async function ingestLevel(res, id) {
    const levelsDir = join(REPO, 'games/beads/design/levels');
    if (!existsSync(levelsDir)) return sendJson(res, 501, { error: '未找到 games/beads/design/levels：一键入关仅在本地仓运行 beads-studio 时可用' });
    let r = null;
    let resultFile = null;
    for (const board of existsSync(DATA) ? readdirSync(DATA) : []) {
        const f = join(DATA, board, id, 'result.json');
        if (existsSync(f)) { r = JSON.parse(readFileSync(f, 'utf8')); resultFile = f; break; }
    }
    if (!r) return sendJson(res, 404, { error: 'not found' });
    // 判据实时重算（盘上 blockers/importable 是存盘时快照，判据演进后会失效）
    const blockers = importBlockers(r, { allowOversize: true });
    if (blockers.length) return sendJson(res, 422, { error: '该结果不可入关：' + blockers.join('；') });
    const d = r.levelDraft;
    if (!d || !Array.isArray(d.pattern)) return sendJson(res, 422, { error: '结果无 levelDraft（交换错位 k 需 ≥ 1）' });
    // v1.40 品牌引用制前置校验：slug + 紧凑序色号成对（旧记录缺色号 → 拒收）。
    const brandSlug = r.palette && r.palette !== '10' ? r.palette : null;
    if (brandSlug && (!Array.isArray(d.paletteCodes) || d.paletteCodes.length !== r.colors))
        return sendJson(res, 422, { error: '草案缺 paletteCodes（旧记录请重新生成；v1.40 关卡存品牌色号而非 hex）' });
    
    // 目录模式真源（P2）：动态 import 避免容器（无 games//tools 时）整服务加载即崩。
    // plate 切块/逐格实测（sliceBoard + measureCells）随 P2b「切块后逐格重排错豆」接回，见 spec §0。
    const {
        readManifest, existingUids, assignUid, nextNumericId, appendEntry, writeLevelFile, writeManifest,
    } = await import('../../tools/scripts/level-store.mjs');
    const manifest = readManifest(levelsDir);
    const uids = existingUids(manifest);
    let idCursor = nextNumericId(levelsDir, manifest);
    const nextId = () => idCursor++;
    
    const runSync = () => {
        const a = spawnSync(process.execPath, ['tools/scripts/sync-levels-data.mjs'], { cwd: REPO, encoding: 'utf8' });
        if (a.status !== 0) return a;
        return spawnSync(process.execPath, ['tools/scripts/sync-framework-to-cocos.mjs'], { cwd: REPO, encoding: 'utf8' });
    };
    const beforeManifest = readFileSync(join(levelsDir, 'manifest.json'), 'utf8');
    const createdFiles = [];
    const rollback = () => {
        for (const f of createdFiles) { try { rmSync(join(levelsDir, f)); } catch { /* 已不在 */ } }
        writeFileSync(join(levelsDir, 'manifest.json'), beforeManifest);
        runSync(); // 回滚产物（ponytail：重跑失败未再兑底，本地工具人工兵平）
    };
    
    const isPlate = d.cols > 50 || d.rows > 50;
    const nameBase = `studio-${String(r.id).slice(-6)}`;

    if (isPlate) {
        // P2b：切块后逐格重排错豆（spec §0.2）。不传 misplaced。
        const { sliceBoard } = await import('../../tools/scripts/level-slice.mjs');
        const { buildCellInitial } = await import('../../tools/scripts/level-derange.mjs');
        const { buildPlateFile: mkPlate, buildCellLevel: mkCell } = await import('../../tools/scripts/level-store.mjs');

        // 1. 切块：只裁 pattern，不传 misplaced
        const sliced = sliceBoard({ pattern: d.pattern, cols: d.cols, rows: d.rows, gridMax: 50 });

        // 2. 逐格三阶构造初盘（甲/乙/丙）
        const tierCounts = { '\u7532': 0, '\u4e59': 0, '\u4e19': 0 };
        const cellEntries = [];
        for (const cell of sliced.cells) {
            const init = buildCellInitial(cell.pattern);
            tierCounts[init.tier]++;
            if (init.tier === '\u4e19') {
                return sendJson(res, 422, {
                    error: `\u8be5\u56fe\u4e0d\u9002\u5408\u62fc\u8c46\u7ec4\u56fe\uff1a\u683c(${cell.row},${cell.col}) \u65e0\u6cd5\u4ea7\u751f\u4efb\u4f55\u975e\u6052\u7b49\u4f4d\u79fb\uff08${init.reason}\uff09\uff0c\u7981\u6b62\u5bfc\u5165`,
                });
            }
            cellEntries.push({ cell, init, id: nextId(), name: `${nameBase}-r${cell.row}c${cell.col}` });
        }

        // 3. 逐格实测（beads-bot）
        const botInput = cellEntries.map(({ cell, init, id, name }) => ({
            id, name, cols: cell.cols, rows: cell.rows,
            pattern: cell.pattern,
            ...(init.misplaced ? { misplaced: init.misplaced } : {}),
            swaps: init.swaps ?? [],
            decoys: d.decoys ?? [],
            ...(brandSlug ? { palette: brandSlug, paletteCodes: d.paletteCodes } : {}),
        }));
        const measured = measureCells(botInput);
        if (!measured.ok) return sendJson(res, 422, { error: `\u9010\u683c\u5b9e\u6d4b\u5931\u8d25\uff1a${measured.error}` });

        // 4. 组装 I3 cell 对象（回填实测 time）
        const plateUid = assignUid('plate', uids);
        const finalCells = cellEntries.map(({ cell, init, id, name }, i) =>
            mkCell({
                cell, plateUid, id, name,
                time: measured.results[i].time,
                decoys: d.decoys ?? [],
                swaps: init.swaps ?? [],
                ...(init.misplaced ? { misplaced: init.misplaced } : {}),
                ...(brandSlug ? { palette: brandSlug, paletteCodes: d.paletteCodes } : {}),
            })
        );

        // 5. 写 plate 文件 + manifest
        const plateFile = `plates/${plateUid}.json`;
        const plateObj = mkPlate({
            plateUid, name: nameBase,
            gridCols: sliced.gridCols, gridRows: sliced.gridRows,
            sourcePreview: r.thumb ?? null,
            cells: finalCells,
        });
        mkdirSync(join(levelsDir, 'plates'), { recursive: true }); // M3：建目录防 rmSync 后无目录
        writeLevelFile(levelsDir, plateFile, plateObj);
        createdFiles.push(plateFile);
        const finalManifest = appendEntry(manifest, { uid: plateUid, kind: 'plate', file: plateFile, pack: 'main' });
        writeManifest(levelsDir, finalManifest);

        const sync = runSync();
        if (!sync || sync.status !== 0) {
            rollback();
            return sendJson(res, 500, { error: 'levels:sync/framework:sync \u672a\u901a\u8fc7\uff0c\u771f\u6e90\u5df2\u56de\u6eda\uff1a' + String((sync && sync.stderr) || '').slice(-300) });
        }
        return sendJson(res, 200, {
            ingested: plateUid, kind: 'plate', cells: finalCells.length,
            tierCounts, note: 'harness \u5373\u65f6\u53ef\u73a9\uff1b\u786e\u8ba4\u540e\u8bf7 git \u5ba1 diff \u5e76\u63d0\u4ea4',
        });
    }

    // —— 单图关卡（≤50）：整板实测（time 只取真引擎值，§3.5 v1.41）——
    const measured = measureWithBot(resultFile);
    if (!measured) return sendJson(res, 500, { error: 'beads-bot 实测失败：入关时长必须来自真引擎实测（公式 v0.2），拒用静态估算兑底' });
    if (measured.blockers.length) return sendJson(res, 422, { error: '该结果不可入关：' + measured.blockers.join('；') });
    const uid = assignUid('single', uids);
    const file = `singles/${uid}.json`;
    const level = {
        id: nextId(), name: nameBase, cols: d.cols, rows: d.rows,
        time: measured.time, cycleProfile: 'short',
        decoys: d.decoys || [], pattern: d.pattern, swaps: d.swaps || [],
        ...(d.misplaced ? { misplaced: d.misplaced } : {}),
        ...(brandSlug ? { palette: brandSlug, paletteCodes: d.paletteCodes } : {}),
    };
    const finalManifest = appendEntry(manifest, { uid, kind: 'single', file, pack: 'main' });
    writeLevelFile(levelsDir, file, level);
    createdFiles.push(file);

    writeManifest(levelsDir, finalManifest);
    const sync = runSync();
    if (!sync || sync.status !== 0) {
        rollback();
        return sendJson(res, 500, { error: 'levels:sync / framework:sync 未通过，真源已回滚：' + String((sync && sync.stderr) || '').slice(-300) });
    }
    return sendJson(res, 200, { ingested: uid, kind: 'single', id: level.id, file, time: level.time, note: 'harness 即时可玩；确认后请 git 审 diff 并提交' });
}

async function handleGenerate(req, res, url) {
    const q = url.searchParams;
    const cols = Math.min(107, Math.max(2, parseInt(q.get('cols') || '14', 10)));
    const rows = Math.min(107, Math.max(2, parseInt(q.get('rows') || '14', 10)));
    // body = JSON { w, h, data: base64(RGBA), thumb? }（缩略图只存不管生成，供前端三视图回看）
    let payload;
    try {
        payload = JSON.parse((await readBody(req)).toString('utf8'));
    } catch (e) {
        return sendJson(res, 400, { error: `body 需为 JSON {w,h,data:base64(RGBA)}：${e.message}` });
    }
    const w = Math.max(1, parseInt(payload.w || 0, 10));
    const h = Math.max(1, parseInt(payload.h || 0, 10));
    if (!w || !h || w * h > MAX_PIXELS) {
        return sendJson(res, 400, { error: `w/h 缺失或超限（≤2048×2048）` });
    }
    const b64 = typeof payload.data === 'string' ? payload.data : '';
    const rgba = Buffer.from(b64, 'base64');
    if (rgba.length < w * h * 4) {
        return sendJson(res, 400, { error: `data 解码后 ${rgba.length} 字节 < ${w}×${h}×4（需 RGBA base64）` });
    }
    const thumb = typeof payload.thumb === 'string' && payload.thumb.startsWith('data:image/') ? payload.thumb : null;
    if (thumb && thumb.length > 300_000) {
        return sendJson(res, 400, { error: `thumb 过大（${thumb.length} 字符，上限 300k）` });
    }
    const board = q.get('board') || `${cols}x${rows}`;
    if (!ID_RE.test(board)) return sendJson(res, 400, { error: 'board 仅允许 [a-z0-9-]' });
    const id = `${board}-${Date.now()}-${randomBytes(2).toString('hex')}`;
    const outDir = join(DATA, board, id);
    mkdirSync(outDir, { recursive: true });
    const rawPath = join(outDir, 'raw.json');
    // 前端已按 cols×K × rows×K 平滑缩放到 w×h ⇒ 直接透传 base64，不再解码重编码
    writeFileSync(rawPath, JSON.stringify({ w, h, data: b64 }));
    // ⚠ mis 白名单必须与 beads-gen 一致（full/swaps/none）——此前只认 swaps|full，
    //    把前端的 none 静默折叠成 full，导致「不错位」永远不生效（2026-09-21 实测）。
    const misRaw = q.get('mis');
    const params = {
        cols,
        rows,
        shape: q.get('shape') || 'square',
        palette: q.get('palette') || '10',
        colors: parseInt(q.get('colors') || '0', 10),
        colorsmode: q.get('colorsmode') || 'error',
        cellmode: q.get('cellmode') === 'avg' ? 'avg' : 'mode',
        swaps: Math.max(0, parseInt(q.get('swaps') || '8', 10)),
        smooth: Math.max(0, parseInt(q.get('smooth') || '1', 10)),
        noframe: q.get('noframe') === '1',
        mis: misRaw === 'swaps' || misRaw === 'none' ? misRaw : 'full',
    };
    if (params.mis === 'swaps' && params.swaps < 1) params.swaps = 1; // 交换模式下 k≥1
    let pattern;
    try {
        pattern = await runGen(rawPath, outDir, params);
    } catch (e) {
        rmSync(outDir, { recursive: true, force: true }); // 失败不留残骸
        return sendJson(res, 422, { error: String(e.message || e) });
    }
    // 盘面真实尺寸 = beads-gen 裁空边（trim）后的实际行列，而非请求档位（异形/去背景后更小，
    // 2026-09-21 实测：请求 21×21、trim 后 15×17 ⇒ 头不修正则前端按 21×21 画布画 15×17 直接错乱）。
    const pat = pattern.pattern ?? [];
    const result = {
        id,
        board,
        cols: pat[0]?.length || cols,
        rows: pat.length || rows,
        shape: params.shape,
        palette: params.palette,
        colors: pattern.report?.colorsUsed ?? params.colors,
        swaps: params.mis === 'swaps' ? params.swaps : 0,
        misMode: params.mis,
        createdAt: new Date().toISOString(),
        thumb, // 原图缩略图（dataURL）；**仅存单条详情**，不进列表投影
        levelDraft: pattern.levelDraft ?? null,
        pattern: pattern.pattern ?? null, // 正解盘（mis=none 无 levelDraft 时的唯一图源；体积小直接透传）
        paletteHex: pattern.paletteHex ?? null, // 色号 → 实际 hex（前端忠实预览 artkal 用）
        misplaced: pattern.misplaced, // 全错位参考盘（仅 swaps=0 时为真实初始盘）
        report: pattern.report ?? null,
    };
    // 可入关判定在写盘时算一次（单一真源），前端与服务端拦截共用同一结果
    result.blockers = importBlockers(result);
    result.importable = result.blockers.length === 0;
    writeFileSync(join(outDir, 'result.json'), JSON.stringify(result, null, 2));
    // 诊断期保留 raw（源图像素底稿）：thumb 是缩略图会掩盖压缩伪影，
    // 需要 raw 才能定位「同图不同结果」类问题（2026-09-21 树冠块状偏色）。
    // ponytail: 诊断后若嫌体积可改回 rmSync(rawPath, { force: true })
    sendJson(res, 200, result);
}

async function handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    try {
        if (req.method === 'OPTIONS') return send(res, 204, '');
        if (req.method === 'POST' && path === '/api/generate') return await handleGenerate(req, res, url);
        // 删除一条已存结果（整目录）：id 走与建目录同一套 `[a-z0-9-]` 白名单，**不碰用户传入的路径片段**。
        // 不可逆（磁盘上唯一副本），所以前端必须二次确认；不提供批量/目录级删除。
        const del = path.match(/^\/api\/results\/([a-z0-9][a-z0-9-]{0,63})$/);
        if (req.method === 'DELETE' && del) {
            for (const board of existsSync(DATA) ? readdirSync(DATA) : []) {
                const dir = join(DATA, board, del[1]);
                if (existsSync(join(dir, 'result.json'))) {
                    rmSync(dir, { recursive: true, force: true });
                    return sendJson(res, 200, { deleted: del[1], board });
                }
            }
            return sendJson(res, 404, { error: 'not found' });
        }
        if (req.method === 'GET' && path === '/api/results') return sendJson(res, 200, { results: listResults() });
        const mi = path.match(/^\/api\/results\/([a-z0-9][a-z0-9-]{0,63})\/ingest$/);
        if (req.method === 'POST' && mi) return await ingestLevel(res, mi[1]);
        const m = path.match(/^\/api\/results\/([a-z0-9][a-z0-9-]{0,63})(\/level)?$/);
        if (req.method === 'GET' && m) {
            for (const board of existsSync(DATA) ? readdirSync(DATA) : []) {
                const f = join(DATA, board, m[1], 'result.json');
                if (existsSync(f)) {
                    const r = JSON.parse(readFileSync(f, 'utf8'));
                    if (m[2]) {
                        // 关卡端点：判据实时重算；v1.40 品牌引用制 —— 草案原样返回
                        //（palette+paletteCodes 随关卡走，游戏侧从注册表查 hex）。
                        const blockers = importBlockers(r);
                        if (blockers.length) {
                            return sendJson(res, 422, { error: '该结果不可入关：' + blockers.join('；'), blockers });
                        }
                        return sendJson(res, 200, r.levelDraft);
                    }
                    // 详情：blockers/importable 实时重算（旧存盘快照不回写，展示层恒为当前判据）
                    r.blockers = importBlockers(r);
                    r.importable = r.blockers.length === 0;
                    return sendJson(res, 200, r);
                }
            }
            return sendJson(res, 404, { error: 'not found' });
        }
        // 静态：/ 与 /index.html → public/；其余映射同路径（防穿越）
        const rel = path === '/' ? 'index.html' : path.slice(1);
        const file = join(PUBLIC, rel);
        if (!file.startsWith(PUBLIC) || !existsSync(file)) return sendJson(res, 404, { error: 'not found' });
        return send(res, 200, readFileSync(file), MIME[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream');
    } catch (e) {
        return sendJson(res, 500, { error: String(e.message || e) });
    }
}

createServer(handle).listen(PORT, () => {
    console.log(`beads-studio → http://localhost:${PORT}（data: ${DATA}）`);
});
