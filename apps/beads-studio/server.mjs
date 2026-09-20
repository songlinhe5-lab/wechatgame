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
 *   GET  /api/results/:id/level → 直接回 levelDraft（小游戏字段最少化）
 *   GET  /                    → 静态页 public/index.html
 *
 * 存储：data/<board>/<id>/result.json（归类 = 目录即盘面档位）。
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
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
const MAX_BODY = 2048 * 2048 * 4 + 1024; // RGBA 上限（2048² + 余量）
const MAX_PIXELS = 2048 * 2048;

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
            '--swaps', String(params.swaps),
            '--smooth', String(params.smooth),
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
                    palette: r.palette, colors: r.colors, swaps: r.swaps, createdAt: r.createdAt,
                    hasThumb: !!r.thumb,
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
    const params = {
        cols,
        rows,
        shape: q.get('shape') || 'square',
        palette: q.get('palette') || '10',
        colors: parseInt(q.get('colors') || '0', 10),
        colorsmode: q.get('colorsmode') || 'error',
        swaps: Math.max(0, parseInt(q.get('swaps') || '0', 10)),
        smooth: Math.max(0, parseInt(q.get('smooth') || '1', 10)),
        noframe: q.get('noframe') === '1',
    };
    let pattern;
    try {
        pattern = await runGen(rawPath, outDir, params);
    } catch (e) {
        rmSync(outDir, { recursive: true, force: true }); // 失败不留残骸
        return sendJson(res, 422, { error: String(e.message || e) });
    }
    const result = {
        id,
        board,
        cols,
        rows,
        shape: params.shape,
        palette: params.palette,
        colors: pattern.report?.colorsUsed ?? params.colors,
        swaps: params.swaps,
        createdAt: new Date().toISOString(),
        thumb, // 原图缩略图（dataURL）；**仅存单条详情**，不进列表投影
        levelDraft: pattern.levelDraft ?? null,
        misplaced: pattern.misplaced, // 全错位参考盘（仅 swaps=0 时为真实初始盘）
        report: pattern.report ?? null,
    };
    writeFileSync(join(outDir, 'result.json'), JSON.stringify(result, null, 2));
    rmSync(rawPath, { force: true }); // 像素底稿不留盘（体积大）
    sendJson(res, 200, result);
}

async function handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    try {
        if (req.method === 'OPTIONS') return send(res, 204, '');
        if (req.method === 'POST' && path === '/api/generate') return await handleGenerate(req, res, url);
        if (req.method === 'GET' && path === '/api/results') return sendJson(res, 200, { results: listResults() });
        const m = path.match(/^\/api\/results\/([a-z0-9][a-z0-9-]{0,63})(\/level)?$/);
        if (req.method === 'GET' && m) {
            for (const board of existsSync(DATA) ? readdirSync(DATA) : []) {
                const f = join(DATA, board, m[1], 'result.json');
                if (existsSync(f)) {
                    const r = JSON.parse(readFileSync(f, 'utf8'));
                    return sendJson(res, 200, m[2] ? r.levelDraft : r);
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
