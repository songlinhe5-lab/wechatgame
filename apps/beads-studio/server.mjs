#!/usr/bin/env node
/**
 * beads-studio 服务（WXG-T-179 续作）：照片转拼豆在线生成器。
 *
 * 零第三方依赖（纯 node:http）。生成核心 = `tools/scripts/beads-gen.mjs`
 * （子进程 spawn，`--in-raw` 免浏览器路径 ⇒ 服务器无需 playwright/chromium）。
 *
 * API：
 *   POST /api/generate?cols=&rows=&board=&shape=&palette=&colors=&colorsmode=&swaps=&noframe=&notrim=&skin=
 *        body = JSON `{ w, h, data: base64(RGBA), thumb?: dataURL }`
 *        图片由前端 canvas 本地解像（不上传原文件）；`thumb` = ≤256px JPEG 缩略图，
 *        **随结果存盘** ⇒ 历史条目也能回看原图（只存在前端内存里刷新/切条目就丢）。
 *        `notrim=1` = 关掉 beads-gen 的包围盒裁剪（空边保留为 void）⇒ 实际盘面 = 请求 cols×rows。
 *        关卡模式「按该关尺寸生成」用它：否则 13×12 请求会被裁成 11×8，替换回该关就改盘面尺寸。
 *   GET  /api/results         → 结果列表（按盘面分组、时间倒序）
 *   GET  /api/results/:id     → 单个 result.json（小游戏在线导入用）
 *   GET  /api/previews        → **预览草稿**列表（data/_draft/<id>/draft.json 的轻投影，`draft:true`）
 *   GET  /api/previews/:id    → 单条预览全文（生成页「点行应用为当前」用；未入库故不入 /api/results）
 *   GET  /api/results/:id/thumb → 原图缩略图二进制（管理页选图器用；无 thumb ⇒ 404）
 *   GET  /api/results/:id/paint → 拼豆图案（pattern + paletteHex，旧条目无原图缩略图时选图器自己画）
 *   GET  /api/results/:id/level → 直接回 levelDraft（小游戏字段最少化；不可入关 ⇒ 422 + 原因）
 *   DELETE /api/results/:id     → 删除该条结果（整目录；id 走 [a-z0-9-] 白名单，不可逆）。
 *        同一路径也删**预览草稿**（data/_draft/<id>）：前端只留右侧 ✕ 这一个删除入口，
 *        生成过的版面在确认保存前也不自动清理（2026-10-24 用户裁定）。
 *   POST /api/results/:id/ingest → 一键入关（WXG-T-341：body `{chapter}` 指定目标大关，插 boss 前）
 *   POST /api/manage/chapter/:id/import → 批量入关（body `{resultIds:[...]}`≤10 条，同一事务，失败整批回滚）
 *
 * —— 大关管理（WXG-T-341，全部仅本地仓、容器 501；每次写后自动 levels:sync + `DEMO_LEVEL_COUNT`
 *    联动，生成期断言失败 ⇒ 快照回滚并转达红字原文；真源正本 = design/proposals/level-content-pipeline §11）——
 *   GET  /api/drafts                           → 大关草稿列表（[WXG-T-364] 以大关为编辑单元的暂存区）
 *   GET  /api/drafts/:id                       → 草稿全文（含橱窗图）；POST 同路径 = upsert {title,resultIds,imageDataUrl?}
 *   DELETE /api/drafts/:id                     → 删草稿（不碰真源）
 *   POST /api/drafts/:id/publish               → 统一发布 {mode:'new'|'replace', target?}：单事务按草稿顺序入章，
 *        末位设 boss；replace 保留 title/章序/showcase 并把旧关文件整批归档 `design/levels/archive/<章id>-<时间戳>/`
 *   GET  /api/manage/state                     → 大关/小关列表（管理页数据源）
 *   POST /api/manage/verify                    → 复跑生成链（「校验 / 导入大关」按钮，幂等）
 *   POST /api/manage/chapter                   → 新建大关（含首关 boss，从结果导入；body {id,title,imageDataUrl,resultId}）
 *   POST /api/manage/chapter/:id/(rename|open|move|delete)
 *        → 改名 {title} / 开放开关 {open} / 上下降序 {dir} / 删章 {action:'move'|'delete', moveTo}
 *   POST /api/manage/level/:uid/(remove|move|rename|boss)
 *        → 删关 / 移动（章内 {dir} 或跨章 {chapter}，插 boss 前）/ 改名 {name} / 设为 boss
 *   GET  /api/bake-manifest?id=&style= → 当前关预烘清单（WXG-T-221 S3-lite）：扫 result 用到的色集，
 *        与 games/beads/assets/{bead,cell}/levels/ 已有文件求差，回 { bead:[{colorIdx,filename}], cell:[...] }（仅缺失项）。
 *   POST /api/bake-save         → body `{ kind:'bead'|'cell', filename, dataUrl }`；filename 严格白名单、
 *   GET  /api/tint-export?mode=holed|holeless → tint mask 双张 base64（WXG-T-222；base 已 v8.0 移除；服务端跑定稿
 *                                    烘焙脚本 tools/mask-preview/export-cocos-textures{,-holeless}.py，
 *                                    单一真源零移植；色无关 ⇒ 无逐色导出）
 *        解码 base64 PNG 落 games/beads/assets/{kind}/levels/{filename}。两端点仅本地仓开（容器 501）。
 *   GET  /                    → 静态页 public/index.html
 *
 * 存储：data/<board>/<id>/result.json（归类 = 目录即盘面档位）。
 */
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, renameSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { BEAD_COLOR_MAX, baseColorOfChar } from '../../tools/scripts/lib/bead-charset.mjs';
// 豆面可读性（WXG-T-357）：生成后二次优化修复；正本 games/beads/design/levels/pattern-legibility.md
import { analyze as analyzeLegibility, judge as judgeLegibility, repairLevel as repairLevelLegibility } from '../../tools/scripts/lib/pattern-legibility.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url)); // apps/beads-studio
const REPO = join(ROOT, '../..'); // workspace 根（本地跑）；容器内见 Dockerfile 布局
/** EP12-S9：皮肤 id 白名单（同源 = `games/beads/src/config/skins/registry.ts` 注册表；
 *  首位 = 默认肤）。⛔ 改游戏侧注册表必须同步此行（本服务不编译 TS，见 handleGenerate 注）。 */
const SKIN_IDS = ['warm-paper', 'cool-violet'];
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
        if (params.premedian > 0) args.push('--premedian', String(params.premedian));
        if (params.shape && params.shape !== 'square') args.push('--shape', params.shape);
        if (params.colors > 0) args.push('--colors', String(params.colors));
        if (params.noframe) args.push('--noframe');
        // 关包围盒裁剪：空边保留为 void，实际盘面 = 请求 cols×rows（关卡模式「按该关尺寸生成」）。
        if (params.notrim) args.push('--notrim');
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
                // 拒产（exit 4）的解释性证据 = beads-bot 的实测行（`M=… B_med=… taps=…（mv/放/直/取）`），
                // 它在 stderr **中段**（早于 beads-gen 的自检尾报）⇒ 旧版 `slice(-500)` 只留尾部，
                // 恰好把那行截掉，用户只剩「实测 N 次点击 > 420s」无从核对（2026-09-22 实测）。
                const bot = err.split('\n').find((l) => l.includes('taps=')) || '';
                const tail = err.replace(bot, '').trim().slice(-400);
                reject(new Error(`beads-gen 退出 ${code}：${[bot.trim(), tail].filter(Boolean).join(' ｜ ') || '(无 stderr)'}`));
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
                const blockers = importBlockers(r, { allowOversize: true }); // 与导入口径一致（大图可切块）
                out.push({
                    id: r.id, board: r.board, cols: r.cols, rows: r.rows, shape: r.shape,
                    palette: r.palette, colors: r.colors, swaps: r.swaps, misMode: r.misMode || 'swaps', createdAt: r.createdAt,
                    // 占槽：与 level-slice 同口径（每方向 ceil(n/32) 段），≤32 为 1
                    slots: Math.max(1, Math.ceil(r.cols / 32)) * Math.max(1, Math.ceil(r.rows / 32)),
                    // 判据实时重算（快照会因判据演进失效）；原因只带前 2 条，防列表膨胀
                    importable: blockers.length === 0,
                    blockers: blockers.slice(0, 2), blockerCount: blockers.length,
                    hasThumb: !!r.thumb,
                    // 「只看本关」的判据（生成时打标 / 替换时反向补标）；旧条目为空数组
                    linkedLevels: Array.isArray(r.linkedLevels) ? r.linkedLevels : [],
                });
            } catch {
                /* 跳过损坏条目 */
            }
        }
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
}

/** 列出 `data/_draft/<id>/draft.json`（未确认保存的预览；时间倒序，轻投影 + `draft:true`）。
 *  刻意**不进 `listResults`**：那条投影同时喂小游戏在线导入与管理页选图器，
 *  而预览还没搬进 `data/<board>/<id>/`（按 id 找 result.json 会 404）⇒ 由 /api/previews 单独供生成页。
 *  「生成过的版面一律留档，只有右侧 ✕ 能删」是 2026-10-24 用户裁定。 */
function listPreviews() {
    const dir = join(DATA, '_draft');
    if (!existsSync(dir)) return [];
    const out = [];
    for (const id of readdirSync(dir)) {
        try {
            const d = JSON.parse(readFileSync(join(dir, id, 'draft.json'), 'utf8'));
            out.push({
                id: d.id, board: d.board, cols: d.cols, rows: d.rows, shape: d.shape,
                palette: d.palette, colors: d.colors, swaps: d.swaps, misMode: d.misMode || 'swaps',
                createdAt: d.createdAt,
                slots: Math.max(1, Math.ceil(d.cols / 32)) * Math.max(1, Math.ceil(d.rows / 32)),
                importable: d.importable !== false ? true : false,
                hasThumb: !!d.thumb,
                draft: true,
                linkedLevels: Array.isArray(d.linkedLevels) ? d.linkedLevels : [],
            });
        } catch {
            /* 跳过损坏 / 非预览目录 */
        }
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
}

/** id 只允许 [a-z0-9-]，防目录穿越。 */
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
/**
 * demo 回落色板长度（= 游端 `LEVELS_DATA.palette`，真源 `design/levels/palette.json`）。
 * 不硬编：它才是「无品牌引用时索引能画到多远」的真实边界（§3.2 v1.55 连带）。
 * ⚠️ 不能改 import `tuning.ts`：本服务跑在纯 Node、不编译 TS；VPS 容器模式（无 `games/`）
 * 也不能假设文件存在 ⇒ 读不到时回退 10（= 当前 demo 色板实长，不致误拦）。
 */
const DEMO_PALETTE = (() => {
    try {
        const p = JSON.parse(readFileSync(join(REPO, 'games/beads/design/levels/palette.json'), 'utf8'));
        return Array.isArray(p.palette) ? p.palette : [];
    } catch {
        return [];
    }
})();
const DEMO_PALETTE_LEN = DEMO_PALETTE.length || 10;

/** 品牌色号 → hex（当前仅 artkal-s；容器无 games/ ⇒ 空表，管理页本身也 501）。 */
const BRAND_HEX = (() => {
    try {
        const p = JSON.parse(readFileSync(join(REPO, 'games/beads/design/art/specs/artkal-palette.json'), 'utf8'));
        return Object.fromEntries(p.codes.map((c, i) => [c, p.palette[i]]));
    } catch {
        return {};
    }
})();

/** 关卡图案 → 管理页画图数据：pattern 行 + 索引 1 起对应的 hex。
 *  口径同游戏端 BOOT：有品牌引用走 `paletteCodes` 查 hex，否则回落 demo 十色。 */
function paintOf(obj) {
    if (!Array.isArray(obj.pattern)) return null;
    const colors = obj.palette && obj.palette !== '10' && Array.isArray(obj.paletteCodes)
        ? obj.paletteCodes.map((c) => BRAND_HEX[c] || '#999999')
        : DEMO_PALETTE;
    return { pattern: obj.pattern, colors };
}

/**
 * 逐格数错位颗数（`report.mis` 缺失时的兜底）：两盘同序映射 ⇒ 直接比字符即可，
 * 不可填位（`.` / `x`）不计。轮廓已不匹配 ⇒ 返 null（不在此处定量，交给游端 BOOT 拦）。
 */
function misplacedCount(r) {
    const p = r.levelDraft?.pattern;
    const q = r.levelDraft?.misplaced;
    if (!Array.isArray(p) || !Array.isArray(q) || p.length !== q.length) return null;
    let n = 0;
    for (let i = 0; i < p.length; i++) {
        if (typeof q[i] !== 'string' || q[i].length !== p[i].length) return null;
        for (let c = 0; c < p[i].length; c++) {
            const ch = p[i][c];
            if (ch === '.' || ch === 'x') continue;
            if (q[i][c] !== ch) n++;
        }
    }
    return n;
}

/**
 * 「能不能入关」单一判据（值域全部来自 `systems-index §3` 冻结常量，不是 Studio 自定）：
 * 盘面 ≥ 6×5（下限来自 `GRID_MIN_*`，§3.3 v1.37）；≤**32** 为单图，任一维 >32 自动走
 * 组合图 Plate（均分切块，§3.3 v1.45 把切块阈值由 50 改为 32，见关卡内容管线 spec §0）。
 * 用色 3–**35**（`BEAD_COLOR_MAX`，§3.2 **v1.55** 由 10 抬到 35 = rowstring 单字符编码天花板）。
 *  · 交换对数 1–8（`MISPLACED_PAIRS_MIN/MAX`）。
 *
 * 色板不限（v1.40 品牌引用制，2026-09-21 用户拍板）：关卡写回 `palette`（slug）+
 * `paletteCodes`（紧凑序色号），游戏侧从品牌注册表查 hex 渲染 —— 无映射、无拦截。
 * ⚠️ **v1.55 后「索引 > demo 色板」的关仍必携品牌引用**（否则游端 BOOT 新校 B1 拒收、
 * 且不拒也会把越界索引静默画成炭黑）⇒ 本函数不拦「>demo 且无品牌引用」就会
 * dev 关表绿、产物红（正本 §5-B3）。
 */
function importBlockers(r, { allowOversize = false } = {}) {
    const b = [];
    // `max`（§3.2 批2 最大化错位）与 `full` 同属「misplaced 型初盘」：不覆盖则 max 盘会被
    // 当成 swaps 型误报（「草案缺 misplaced」/「交换对数 > 8」），与旧 `none` 被折叠成 `full` 同族。
    const misFullish = r.misMode === 'full' || r.misMode === 'max';
    if (!r.levelDraft) b.push('无关卡草案（全错位/最大化错位需能产出错位盘；交换模式需 k ≥ 1）');
    if (!misFullish && r.swaps > 8) b.push(`交换对数 ${r.swaps} > 8（\`MISPLACED_PAIRS_MAX\`）`);
    if (misFullish && r.levelDraft && !Array.isArray(r.levelDraft.misplaced))
        b.push(`${r.misMode} 模式但草案缺 misplaced 字段`);
    // max 档使 `M` 成为可变输出 ⇒ 补一条「M ≥ 1」（= 游端 BOOT「错位 ≥1」闸的入关期镜像）。
    // 无证据时**不判**（列表轻投影不带 report/levelDraft），否则每条 max 历史条目会被误拦。
    if (r.misMode === 'max') {
        const M = typeof r.report?.mis?.M === 'number'
            ? r.report.mis.M
            : (Array.isArray(r.levelDraft?.misplaced) ? misplacedCount(r) : null);
        if (M !== null && M < 1) b.push(`最大化错位档 M=${M} < 1 ⇒ 无错豆（游端 BOOT「错位 ≥1」必拒）`);
    }
    if (r.colors < 3) b.push(`用色 ${r.colors} < 3（BOOT 下限）`);
    if (r.colors > BEAD_COLOR_MAX) b.push(`用色 ${r.colors} > ${BEAD_COLOR_MAX}（\`BEAD_COLOR_MAX\`，§3.2 v1.55；rowstring 单字符编码天花板）`);
    // B1 的入关期镜像（正本 §5-B3）：pattern 最大色索引超 demo 色板 ⇒ 品牌引用从「可选」变「必携」。
    // 不补这一条，这种盘会先落进 design/levels 真源、再在游端 BOOT 被拒 = 内容源被写脏。
    const brandRef = Boolean(r.palette && r.palette !== '10') && Array.isArray(r.levelDraft?.paletteCodes);
    if (r.colors > DEMO_PALETTE_LEN && !brandRef)
        b.push(`用色 ${r.colors} > demo 色板 ${DEMO_PALETTE_LEN} ⇒ 必带品牌色板（\`palette\` + \`paletteCodes\`），否则游端 BOOT 拒收/越界索引静默兑炭黑`);
    if (r.cols < 6) b.push(`列数 ${r.cols} < 6（\`GRID_MIN_COLS\`）`);
    if (r.rows < 5) b.push(`行数 ${r.rows} < 5（\`GRID_MIN_ROWS\`）`);
    // >32 不是 blocker：plate 入口本就接受超限母版并自动切块，故**不得**无条件 push（会误杀 ingest）。
    // >32 仅 ingest 放行（已落码 plate 分支：sliceBoard 均分切块 + 逐格 bot 实测，管线 spec §0.2 v0.5）；
    // 列表投影 / `/level` / 生成快照默认拦 >32。
    // 否则小游戏 importLatest 会选中 >32 头 → validateBeadsLevel 失败且不回退下一条合法关（I1 回归）。
    if (!allowOversize && (r.cols > 32 || r.rows > 32))
        b.push(`盘 ${r.cols}×${r.rows} 超单图上限 32：此出口只出单图草案，>32 请走「一键入关」（自动切组合图 Plate）`);
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
    const tmpLevels = {
        levels: cells.map((c, i) => ({
            id: c.id ?? (9001 + i),
            name: c.name ?? `cell-${i}`,
            cols: c.cols, rows: c.rows, time: 0,
            cycleProfile: 'short', decoys: c.decoys ?? [],
            pattern: c.pattern, swaps: c.swaps ?? [],
            ...(c.misplaced ? { misplaced: c.misplaced } : {}),
            ...(c.palette ? { palette: c.palette, paletteCodes: c.paletteCodes } : {}),
        }))
    };
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
        if (!last || !last.startsWith('[')) {
            // 单格时 bot 回单对象（非数组）；兼容两者
            try {
                const one = JSON.parse(last);
                if (one && typeof one === 'object' && !Array.isArray(one))
                    return one.cleared && !one.blockers?.length
                        ? { ok: true, results: [one] }
                        : { ok: false, error: `格 ${one.name} bot 未通关（${one.blockers?.join('；') || 'cleared=false'}）` };
            } catch { /* 落到统一报错 */ }
            return { ok: false, error: `beads-bot 多关输出解析失败: ${String(last || '').slice(0, 80)}` };
        }
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

// ═══════════════════════ [WXG-T-341] 大关管理：快照事务编排 ═══════════════════════
// 所有写操作（含 ingest）走同一编排：快照 → mutate 写盘 → id 轴重编号 → DEMO_LEVEL_COUNT 联动
// → levels:sync + framework:sync → 失败恢复快照。真源正本 = design/proposals/level-content-pipeline §11。

const LEVELS_DIR = join(REPO, 'games/beads/design/levels');
const TUNING_PATH = join(REPO, 'games/beads/src/config/tuning.ts');
/** uid 格式白名单（路径段入参用；`assignUid` 输出为 [LP]+digits，宽号 >99999 也认）。 */
const UID_RE = /^[LP]\d{1,9}$/;
const CHAPTER_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** 管理操作的可预期拒绝（422 回显原文，不做 500）。 */
class ManageError extends Error {
    constructor(message, code = 422) { super(message); this.code = code; }
}

/** levels:sync + framework:sync（必须与 package.json 同参：--import=ts-js-resolve 把源码里的
 *  `.js` ESM 导入解析回 `.ts`；漏掉 ⇒ Node 找不到 tuning.js，人关误报"未通过、已回滚"，2026-10-07 实测坑）。 */
function runSync() {
    const a = spawnSync(process.execPath, ['--import=./tools/scripts/lib/ts-js-resolve.mjs', 'tools/scripts/sync-levels-data.mjs'], { cwd: REPO, encoding: 'utf8' });
    if (a.status !== 0) return a;
    return spawnSync(process.execPath, ['tools/scripts/sync-framework-to-cocos.mjs'], { cwd: REPO, encoding: 'utf8' });
}

/** 目录树快照（relPath → 原文 Buffer）——回滚 = 恢复存量 + 删除快照外新文件。 */
function snapshotTree(dir) {
    const snap = new Map();
    const walk = (d, rel = '') => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) walk(join(d, e.name), r);
            else snap.set(r, readFileSync(join(d, e.name)));
        }
    };
    if (existsSync(dir)) walk(dir);
    return snap;
}
function restoreTree(dir, snap) {
    const seen = new Set();
    const walk = (d, rel = '') => {
        if (!existsSync(d)) return;
        for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, e.name);
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) { walk(p, r); continue; }
            seen.add(r);
            const orig = snap.get(r);
            if (orig === undefined) rmSync(p); // 事务内新建 ⇒ 删
            else if (!orig.equals(readFileSync(p))) writeFileSync(p, orig); // 改过 ⇒ 恢复
        }
    };
    walk(dir);
    for (const [r, content] of snap) {
        if (!seen.has(r)) { mkdirSync(dirname(join(dir, r)), { recursive: true }); writeFileSync(join(dir, r), content); } // 被删 ⇒ 重建
    }
}

/** 从 tuning.ts 源码读 `export const N = <数字>`；读不到 → null（常量缺失不携断言，交给 sync）。 */
function readTuningConst(src, name) {
    const m = new RegExp(`export const ${name} = (\\d+)`).exec(src);
    return m ? Number(m[1]) : null;
}
/** 墙容量（tuning 派生式 `WALL_CAPACITY = WALL_COLS * WALL_ROWS` / 数字式两兼容）。 */
function readWallCapacity(src) {
    const c = readTuningConst(src, 'WALL_COLS');
    const r = readTuningConst(src, 'WALL_ROWS');
    return c && r ? c * r : (readTuningConst(src, 'WALL_CAPACITY') ?? 9);
}

/** 章内 slot 数映射（uid → 展开槽数；plate 多槽）——容量预检共用（⛔ 不再第二遍重数）。 */
function slotsOfMap(store, levelsDir, manifest) {
    return new Map(store.expandEntriesWithIds(levelsDir, manifest).map((e) => [e.uid, e.slots]));
}

/**
 * 生成期红字 → 人话（只翻实际会撞到的两类，其余原样进 `detail`，不假装全懂）。
 * 红字里的 `L5` 是 renumber 后的关号，用户完全不知道对应哪张图 ⇒ 交给 `nameOf` 对回落盘名。
 */
function humanizeGateError(raw, nameOf) {
    const say = [];
    for (const m of raw.matchAll(/门禁⑦ (普通关|boss) L(\d+) steps=(\d+) 越出 \[(\d+), (\d+)\]/g)) {
        const [, kind, id, steps, lo, hi] = m;
        say.push(`${nameOf(+id)}：实测 ${steps} 步，${kind}须落在 ${lo}–${hi} 步 ⇒ ` +
            (+steps > +hi ? '图案太密（珠子太多），换更小或更简单的图' : '图案太空（珠子太少），换更大或更复杂的图'));
    }
    const di = raw.match(/DI 非严格递增（L(\d+)=([\d.]+) → L(\d+)=([\d.]+)）/);
    if (di)
        say.push(`${nameOf(+di[1])} 与 ${nameOf(+di[3])} 难度分完全相同（都是 ${di[2]}）⇒ 关卡难度不允许并列，换一张难度差别更大的图`);
    return say;
}

/** 关号 → 本次落盘的名字（plate 用每格名，内含来源图尾号 `studio-<结果尾6位>-r<行>c<列>`）。 */
function gateNameOf(levelsDir, store, manifest) {
    const byId = new Map();
    for (const e of store.expandEntriesWithIds(levelsDir, manifest)) {
        const obj = JSON.parse(readFileSync(join(levelsDir, e.file), 'utf8'));
        if (e.kind === 'plate') e.ids.forEach((id, i) => byId.set(id, obj.cells[i]?.name || e.uid));
        else byId.set(e.ids[0], obj.name || e.uid);
    }
    return (id) => byId.get(id) || `第 ${id} 号关`;
}

/**
 * 管理事务（所有写端点的唯一编排入口）：
 *   快照（levels 真源树 + tuning 原文）→ mutate(ctx)（同步写盘，返回新 manifest + log）
 *   → manifest 落盘（contentVersion++）→ id 轴重编号 → `DEMO_LEVEL_COUNT` 联动
 *   → levels:sync + framework:sync。任一步失败：恢复快照 + 重跑 sync 兑平产物，转达红字。
 * mutate 内拒绝用 `throw new ManageError(...)`（4xx）；其余异常按 500。
 * `reply` 缺省走 JSON；批量导入传自定义回调（NDJSON 流已经写了响应头，不能再 writeHead）。
 */
async function applyManage(res, mutate, reply) {
    const respond = reply || ((code, body) => sendJson(res, code, body));
    if (!existsSync(LEVELS_DIR))
        return respond(501, { error: '大关管理仅在本地仓运行 beads-studio 时可用（容器/VPS 无 games/ 真源）' });
    // 动态 import：容器无 tools/ 时本服务仍可整体启动（同 ingest 原注）
    const store = await import('../../tools/scripts/chapter-store.mjs');
    const ls = await import('../../tools/scripts/level-store.mjs');
    const snap = snapshotTree(LEVELS_DIR);
    const tuningBefore = readFileSync(TUNING_PATH, 'utf8');
    const rollback = () => {
        restoreTree(LEVELS_DIR, snap);
        writeFileSync(TUNING_PATH, tuningBefore);
        runSync(); // 回滚产物（ponytail：重跑失败未再兑底，本地工具人工兵平）
    };
    try {
        const ctx = { levelsDir: LEVELS_DIR, store, ls, manifest: ls.readManifest(LEVELS_DIR), log: [] };
        const next = mutate(ctx);
        ls.writeManifest(LEVELS_DIR, { ...next.manifest, contentVersion: next.manifest.contentVersion + 1 });
        for (const c of store.renumberIds(LEVELS_DIR, next.manifest)) writeFileSync(join(LEVELS_DIR, c.file), c.content);
        // 门禁⑤ 联动：关数变了才写（同值 no-op ⇒ 不产 diff）
        const count = store.expandedCount(LEVELS_DIR, next.manifest);
        const tuned = store.syncDemoLevelCount(tuningBefore, count);
        if (tuned !== tuningBefore) writeFileSync(TUNING_PATH, tuned);
        const sync = runSync();
        if (sync.status !== 0) {
            const raw = String(sync.stderr || sync.stdout || '').trim().slice(-1200);
            // 名字必须在 rollback() 之前取（回滚后文件恢复原状，本次落盘计划就没了）
            const say = humanizeGateError(raw, gateNameOf(LEVELS_DIR, store, next.manifest));
            rollback();
            return respond(500, {
                error: '生成期断言未通过，真源已回滚（操作未生效，可安全修正重试）：\n' + (say.length ? say.join('\n') : raw),
                detail: raw,
            });
        }
        return respond(200, { ok: true, count, log: next.log ?? [], note: 'levels:sync + framework:sync 已跑；git diff 确认后提交' });
    } catch (e) {
        rollback();
        return respond(e.code || 500, { error: String(e.message || e) });
    }
}

/** 章节列表轻投影（管理页 state；pattern/色板已在批次④补上 → paint）。 */
function describeChapters(levelsDir, store, ls) {
    const manifest = ls.readManifest(levelsDir);
    const chapters = [...(manifest.chapters ?? [])].sort((a, b) => a.order - b.order);
    const docs = store.loadChapterMap(levelsDir, manifest);
    const byUid = new Map(manifest.entries.map((e) => [e.uid, e]));
    const expanded = new Map(store.expandEntriesWithIds(levelsDir, manifest).map((e) => [e.uid, e]));
    return chapters.map((c) => {
        const doc = docs.get(c.id) ?? { levels: [], title: '(章文件缺失)' };
        const levels = (doc.levels ?? []).map((uid) => {
            const e = byUid.get(uid);
            if (!e) return { uid, missing: true };
            const obj = JSON.parse(readFileSync(join(levelsDir, e.file), 'utf8'));
            const ex = expanded.get(uid);
            const base = { uid, kind: e.kind, file: e.file, slots: ex?.slots ?? 1, name: obj.name ?? '' };
            if (e.kind === 'plate')
                return { ...base, id: ex?.ids?.[0], idEnd: ex?.ids?.[(ex?.ids?.length ?? 1) - 1], cols: obj.gridCols, rows: obj.gridRows };
            return { ...base, id: obj.id, cols: obj.cols, rows: obj.rows, time: obj.time, paint: paintOf(obj) };
        });
        return {
            id: c.id, order: c.order, open: !!c.open, file: c.file,
            title: typeof doc.title === 'string' ? doc.title : '', showcase: doc.showcase,
            slots: levels.reduce((n, l) => n + (l.slots ?? 0), 0), levels,
        };
    });
}

async function handleManageState(res) {
    if (!existsSync(LEVELS_DIR))
        return sendJson(res, 501, { error: '大关管理仅在本地仓运行 beads-studio 时可用（容器/VPS 无 games/ 真源）' });
    const store = await import('../../tools/scripts/chapter-store.mjs');
    const ls = await import('../../tools/scripts/level-store.mjs');
    const tuning = readFileSync(TUNING_PATH, 'utf8');
    const manifest = ls.readManifest(LEVELS_DIR);
    return sendJson(res, 200, {
        contentVersion: manifest.contentVersion,
        count: store.expandedCount(LEVELS_DIR, manifest),
        demoLevelCount: readTuningConst(tuning, 'DEMO_LEVEL_COUNT'),
        wallCapacity: readWallCapacity(tuning),
        chapters: describeChapters(LEVELS_DIR, store, ls),
    });
}

/** 复跑生成链（幂等」；红字原文转达）。UI 的「校验 / 导入大关」按钮共用。 */
async function handleManageVerify(res) {
    if (!existsSync(LEVELS_DIR))
        return sendJson(res, 501, { error: '大关管理仅在本地仓运行 beads-studio 时可用' });
    const sync = runSync();
    if (sync.status !== 0)
        return sendJson(res, 500, { error: '校验未通过：\n' + String(sync.stderr || sync.stdout || '').slice(-1200) });
    return sendJson(res, 200, { ok: true, note: 'levels:sync + framework:sync 全绿：真源与产物一致，生成期断言全集通过' });
}

/** body 解析小工具（管理端点共用；空体 ⇒ {}）。 */
async function readJsonBody(req) {
    const raw = (await readBody(req)).toString('utf8');
    if (!raw.trim()) return {};
    try {
        return JSON.parse(raw);
    } catch (e) {
        throw new ManageError(`body 需为 JSON：${e.message}`, 400);
    }
}

/** 跨章/章内找 uid 的归属章（返回 {c, doc}；未找到 → null）。 */
function findChapterOf(store, levelsDir, manifest, uid) {
    for (const c of manifest.chapters ?? []) {
        const doc = store.readChapter(levelsDir, c.file);
        if ((doc.levels ?? []).includes(uid)) return { c, doc };
    }
    return null;
}

/** 目标章 + 容量预检（ingest 两分支共用）：超 `WALL_CAPACITY` ⇒ ManageError（早拦给红字，sync 兜底）。 */
function chapterForInsert(store, levelsDir, manifest, chapterId, addSlots) {
    const ch = (manifest.chapters ?? []).find((c) => c.id === chapterId);
    if (!ch) throw new ManageError(`大关 ${chapterId} 不存在`);
    const doc = store.readChapter(levelsDir, ch.file);
    const slots = slotsOfMap(store, levelsDir, manifest);
    const cur = (doc.levels ?? []).reduce((n, u) => n + (slots.get(u) ?? 1), 0);
    const cap = readWallCapacity(readFileSync(TUNING_PATH, 'utf8'));
    if (cur + addSlots > cap)
        throw new ManageError(`大关 ${chapterId} 容量不足：${cur}+${addSlots} > ${cap}（拆章或先腾位）`);
    return { ch, doc };
}

/**
 * 轻规划（事务外、不跑 bot）：存在性 / 入关判据 / 切片 tier 全在此拦下，同时算出占槽数。
 * 批量导入靠它先做容量预检——满章时不必白跑几十秒 bot 才报「容量不足」。
 */
async function planShape(id) {
    const found = findResultFile(id);
    if (!found) throw new ManageError(`结果 ${id} 不存在`, 404);
    const { r, file: resultFile } = found;
    // 判据实时重算（盘上 blockers/importable 是存盘时快照，判据演进后会失效）
    const blockers = importBlockers(r, { allowOversize: true });
    if (blockers.length) throw new ManageError(`${id} 不可入关：${blockers.join('；')}`);
    const d = r.levelDraft;
    if (!d || !Array.isArray(d.pattern)) throw new ManageError(`${id} 无 levelDraft（交换错位 k 需 ≥ 1）`);
    // v1.40 品牌引用制前置校验：slug + 紧凑序色号成对（旧记录缺色号 → 拒收）。
    const brandSlug = r.palette && r.palette !== '10' ? r.palette : null;
    if (brandSlug && (!Array.isArray(d.paletteCodes) || d.paletteCodes.length !== r.colors))
        throw new ManageError(`${id} 草案缺 paletteCodes（旧记录请重新生成；v1.40 关卡存品牌色号而非 hex）`);
    const nameBase = `studio-${String(r.id).slice(-6)}`;

    if (d.cols > 32 || d.rows > 32) {
        // P2b：切块后逐格重排错豆（spec §0.2）。不传 misplaced。
        const { sliceBoard } = await import('../../tools/scripts/level-slice.mjs');
        const { buildCellInitial } = await import('../../tools/scripts/level-derange.mjs');

        // 1. 切块：只裁 pattern，不传 misplaced
        const sliced = sliceBoard({ pattern: d.pattern, cols: d.cols, rows: d.rows, gridMax: 32 });

        // 2. 逐阶构造初盘（reg ≤60% 优先 → 甲 / 甲max / 乙 / 丙）
        // 组合图每宫按 `levels-spec §3.1①` 的「整区域就位 ≤60%」构造（E1 实测：全错位宫 176–178
        // taps 结构性不可入关）；不成则落回甲链。tierCounts 动态计数（旧写死四键，新 tier 会被算成 NaN）。
        const tierCounts = {};
        const cellEntries = [];
        for (const cell of sliced.cells) {
            const init = buildCellInitial(cell.pattern, { region: true });
            tierCounts[init.tier] = (tierCounts[init.tier] ?? 0) + 1;
            if (init.tier === '\u4e19') {
                throw new ManageError(`该图不适合拼豆组图：格(${cell.row},${cell.col}) 无法产生任何非恒等位移（${init.reason}），禁止导入`);
            }
            cellEntries.push({ cell, init, name: `${nameBase}-r${cell.row}c${cell.col}` });
        }
        const payloads = cellEntries.map(({ cell, init, name }, i) => ({
            id: 9001 + i, name, cols: cell.cols, rows: cell.rows,
            pattern: cell.pattern,
            ...(init.misplaced ? { misplaced: init.misplaced } : {}),
            swaps: init.swaps ?? [],
            decoys: d.decoys ?? [],
            ...(brandSlug ? { palette: brandSlug, paletteCodes: d.paletteCodes } : {}),
        }));
        return { kind: 'plate', slots: cellEntries.length, nameBase, sliced, cellEntries, payloads, tierCounts, brandSlug, d, thumb: r.thumb ?? null };
    }

    return { kind: 'single', slots: 1, nameBase, brandSlug, d, resultFile };
}

/** 实测（事务外）：plate 逐格单跑（每格前回显 `cell`），single 整板一次。返回带 measured 的落盘计划。 */
async function measureShape(shape, progress) {
    if (shape.kind === 'plate') {
        // 逐格单跑而非一次性批量：每格前能回显进度（`cell` 事件）与响应取消（大图动辙几十秒）
        const measured = { ok: true, results: [] };
        for (const [k, payload] of shape.payloads.entries()) {
            await progress?.({ phase: 'cell', k: k + 1, m: shape.payloads.length });
            const one = measureCells([payload]);
            if (!one.ok) throw new ManageError(`逐格实测失败（第 ${k + 1}/${shape.payloads.length} 格）：${one.error}`);
            measured.results.push(one.results[0]);
        }
        return { ...shape, measured };
    }
    // —— 单图关卡（≤32）：整板实测（time 只取真引擎值，§3.5 v1.41；测量在事务外）——
    const measured = measureWithBot(shape.resultFile);
    if (!measured) throw new ManageError(`${shape.nameBase} beads-bot 实测失败：入关时长必须来自真引擎实测（公式 v0.2），拒用静态估算兑底`, 500);
    if (measured.blockers.length) throw new ManageError(`${shape.nameBase} 不可入关：${measured.blockers.join('；')}`);
    return { ...shape, measured };
}

/**
 * 入关预检 + 实测（事务外，不动真源）：返回一条落盘计划；不可入关 ⇒ ManageError（4xx 回显原文）。
 * 单条 ingest 与批量 import 共用；`progress` 用于 plate 逐格回显。
 */
async function planIngest(id, progress) {
    return measureShape(await planShape(id), progress);
}

/** 入关 entry 的落位：插 boss 的 order 之前（章内关号与 id 同序）；无 boss 时追加。 */
function entryBeforeBoss(ls, manifest, doc, entry) {
    const bossUid = doc.levels?.[doc.levels.length - 1];
    return bossUid
        ? ls.insertEntryBefore(manifest, entry, bossUid)
        : ls.appendEntry(manifest, entry);
}

/**
 * 草稿发布专用的落位：**直接追加**（`append`）而非插 boss 前。
 * 为什么必须区分（WXG-T-364 实测）：`entryBeforeBoss` 只看章内末位、不看 kind ⇒ 章刚建/刚清空时
 * 第 1 条 append 后，第 2 条会被当成「boss 前」插到第 1 条**之前**，草稿顺序整段倒序
 * （实测草稿 [22×21, 14×8] 落成 levels [14×8, 22×21]）。草稿发布时章内还没有 boss，
 * 顺序真源就是草稿数组，逐条 append 才能保证 levels[] === 草稿顺序。
 */
function placeUid(store, doc, uid, append) {
    return append ? [...(doc.levels ?? []), uid] : store.insertBeforeBoss(doc.levels, uid);
}
function placeEntry(ls, manifest, doc, entry, append) {
    return append ? ls.appendEntry(manifest, entry) : entryBeforeBoss(ls, manifest, doc, entry);
}

/** 事务内落盘一条计划（同步）：写关卡文件 + 章 doc（boss 前）+ manifest entry。返回 {manifest, log}。
 *  容量逐条复检（同批多条靠累积 cur 拦住，超容 ⇒ 整批回滚）。 */
function commitIngest(ctx, ls, plan, chapterId, { append = false } = {}) {
    const { store, levelsDir } = ctx;
    if (plan.kind === 'plate') {
        const { ch, doc } = chapterForInsert(store, levelsDir, ctx.manifest, chapterId, plan.cellEntries.length);
        const plateUid = ls.assignUid('plate', ls.existingUids(ctx.manifest));
        // id 填 0 占位 ⇒ 收尾 renumber 统一分配
        const finalCells = plan.cellEntries.map(({ cell, init, name }, i) =>
            ls.buildCellLevel({
                cell, plateUid, id: 0, name,
                time: plan.measured.results[i].time,
                pricing: plan.measured.results[i].pricing,
                decoys: plan.d.decoys ?? [],
                swaps: init.swaps ?? [],
                ...(init.misplaced ? { misplaced: init.misplaced } : {}),
                ...(plan.brandSlug ? { palette: plan.brandSlug, paletteCodes: plan.d.paletteCodes } : {}),
            })
        );
        const plateFile = `plates/${plateUid}.json`;
        mkdirSync(join(levelsDir, 'plates'), { recursive: true }); // M3：建目录防 rmSync 后无目录
        ls.writeLevelFile(levelsDir, plateFile, ls.buildPlateFile({
            plateUid, name: plan.nameBase,
            gridCols: plan.sliced.gridCols, gridRows: plan.sliced.gridRows,
            sourcePreview: plan.thumb,
            cells: finalCells,
        }));
        store.writeChapter(levelsDir, ch.file, { ...doc, levels: placeUid(store, doc, plateUid, append) });
        const manifest = placeEntry(ls, ctx.manifest, doc, { uid: plateUid, kind: 'plate', file: plateFile, pack: 'main' }, append);
        return { manifest, log: `已入关 ${plateUid}（plate ${finalCells.length} 格 → 大关 ${chapterId} boss 前；tier ${JSON.stringify(plan.tierCounts)}）` };
    }
    const { ch, doc } = chapterForInsert(store, levelsDir, ctx.manifest, chapterId, 1);
    const uid = ls.assignUid('single', ls.existingUids(ctx.manifest));
    const file = `singles/${uid}.json`;
    const { d, brandSlug, measured } = plan;
    const leg = legibilityFix(d); // 生成后二次优化修复（WXG-T-357，守恒配套）
    d.pattern = leg.pattern;
    if (leg.misplaced) d.misplaced = leg.misplaced;
    ls.writeLevelFile(levelsDir, file, {
        id: 0, name: plan.nameBase, cols: d.cols, rows: d.rows, // id 填 0 占位 ⇒ 收尾 renumber 必修正
        time: measured.time, cycleProfile: 'short',
        // dev-only 定价溯源（动作数/下界/当时单价）；sync 装配时剔除，不进包体。
        pricing: measured.pricing,
        decoys: d.decoys || [], pattern: d.pattern, swaps: d.swaps || [],
        ...(d.misplaced ? { misplaced: d.misplaced } : {}),
        ...(brandSlug ? { palette: brandSlug, paletteCodes: d.paletteCodes } : {}),
    });
    store.writeChapter(levelsDir, ch.file, { ...doc, levels: placeUid(store, doc, uid, append) });
    const manifest = placeEntry(ls, ctx.manifest, doc, { uid, kind: 'single', file, pack: 'main' }, append);
    return { manifest, log: `已入关 ${uid}（single ${d.cols}×${d.rows}，实测 ${measured.time}s → 大关 ${chapterId} boss 前）｜${leg.note}` };
}

/**
 * 生成后二次优化修复（WXG-T-357）：豆面体检 → 能自动修的修（吞孤点 / 并细丝 / 填小孔）→ 回执文案。
 * 只在**新入关**路径调用（renumber 等纯重写路径不调，避免二次改写既有真源）。
 * ⛔ 不改盘尺寸、不新增颜色、不碰 `x` 锁定格；尺寸/色数不足（`sizing`）修不动 ⇒ 回执里明说要重生成或减色。
 */
function legibilityFix(draft) {
    const before = judgeLegibility(analyzeLegibility(draft.pattern));
    if (before.ok) return { pattern: draft.pattern, misplaced: draft.misplaced, note: '豆面体检 7 项全过' };
    // ⚠ 必须走 repairLevel（守恒配套）：只改 pattern 会破 levels-data.ts:56 的「每色珠数守恒」
    const out = repairLevelLegibility(draft);
    if (!out.ok)
        return {
            pattern: draft.pattern,
            misplaced: draft.misplaced,
            note: `豆面体检未过（${before.fails.map((f) => f.k).join('/')}）未修：${out.reason}`,
        };
    const after = judgeLegibility(analyzeLegibility(out.pattern));
    if (!out.changed)
        return { pattern: draft.pattern, misplaced: draft.misplaced, note: `豆面体检未过（${before.fails.map((f) => f.k).join('/')}）且无可自动修复项 ⇒ 须重生成/减色` };
    const residue = after.fails.map((f) => f.k).join('/');
    const tail = after.ok ? '修后 7 项全过' : `残留 ${residue}${after.kind === 'sizing' ? '（尺寸/色数不足，须重生成或减色）' : ''}`;
    return { pattern: out.pattern, misplaced: out.misplaced, note: `豆面修复 ${out.log.join('、')}；${tail}` };
}

/**
 * 一键入关（WXG-T-179；WXG-T-341 改造）：levelDraft → 写入 design/levels 真源 + **插到目标大关
 * boss 前** + `DEMO_LEVEL_COUNT` 自动联动 + levels:sync/framework:sync。失败 ⇒ 快照回滚（不留半截）。
 * 仅本地仓。测量（beads-bot）在事务外先跑（不动真源）；plate 仍走切片 + 逐格实测（P2b）。
 */
async function ingestLevel(res, id, chapterId) {
    const levelsDir = LEVELS_DIR;
    if (!existsSync(levelsDir)) return sendJson(res, 501, { error: '未找到 games/beads/design/levels：一键入关仅在本地仓运行 beads-studio 时可用' });
    if (!chapterId || !CHAPTER_ID_RE.test(String(chapterId)))
        return sendJson(res, 422, { error: '须指定目标大关：body JSON {chapter:"<章 id>"}（生成页「导入大关」已改走管理页 /manage.html）' });
    const ls = await import('../../tools/scripts/level-store.mjs');
    const plan = await planIngest(id);
    return applyManage(res, (ctx) => {
        const out = commitIngest(ctx, ls, plan, chapterId);
        return { manifest: out.manifest, log: [out.log] };
    });
}

/** 批量入关（WXG-T-341）：全部预检/实测在事务外，随后同一事务按勾选顺序插 boss 前；
 *  任一条不可入关或容量不足 ⇒ 整批回滚（真源不留半截）。
 *  `progress`：逐条测量回显（NDJSON 流式）；`reply`：事务最终结果的自定义出口。 */
async function importResults(res, chapterId, ids, progress, reply) {
    if (!existsSync(LEVELS_DIR)) {
        const err = { error: '大关管理仅在本地仓运行 beads-studio 时可用' };
        return reply ? reply(501, err) : sendJson(res, 501, err);
    }
    const ls = await import('../../tools/scripts/level-store.mjs');
    // 0) 轻规划：不可入关/不存在/切片 tier 在跑 bot 前拦下，同时算出总槽数
    //    逐条收集而不是首错即停：勾 5 条时一次列全所有问题（修一条试一条太磨人）
    const shapes = [];
    const shapeErrs = [];
    for (const id of ids) {
        try { shapes.push(await planShape(id)); }
        catch (e) {
            if (!(e instanceof ManageError)) throw e;
            shapeErrs.push(e);
        }
    }
    if (shapeErrs.length)
        throw new ManageError(
            `批量预检未通过（${shapeErrs.length}/${ids.length} 条，真源未改动）：\n` +
            shapeErrs.map((e) => `· ${e.message}`).join('\n'),
            shapeErrs.every((e) => e.code === 404) ? 404 : 422,
        );
    // 1) 容量预检前置：满章/超容不必白跑 bot（commit 内仍逐条复检，防同批累积偏差）
    const store = await import('../../tools/scripts/chapter-store.mjs');
    chapterForInsert(store, LEVELS_DIR, ls.readManifest(LEVELS_DIR), chapterId,
        shapes.reduce((n, s) => n + s.slots, 0));
    // 2) 逐条实测
    const plans = [];
    for (const [i, shape] of shapes.entries()) {
        const id = ids[i];
        await progress?.({ phase: 'measure', i: i + 1, n: ids.length, id });
        // plate 的逐格事件补上整批坐标（i/n/id），前端统一按「第 i/n 条 · 第 k/m 格」展示
        plans.push(await measureShape(shape, (o) => progress?.({ i: i + 1, n: ids.length, id, ...o })));
        await progress?.({ phase: 'measured', i: i + 1, n: ids.length, id });
    }
    // 写盘前最后一个断点：此前的取消不碰真源，之后的取消让事务跑完（中途停会留半截）
    await progress?.({ phase: 'commit', i: ids.length, n: ids.length });
    return applyManage(res, (ctx) => {
        let manifest = ctx.manifest;
        const log = [];
        for (const plan of plans) {
            const out = commitIngest({ ...ctx, manifest }, ls, plan, chapterId);
            manifest = out.manifest;
            log.push(out.log);
        }
        return { manifest, log };
    }, reply);
}

/** POST /api/manage/chapter/:id/import { resultIds: [...], stream?: true } —— 批量入关（≤10 条）。
 *  stream=true 时回 NDJSON：逐条 `{phase:'measure'|'measured',i,n,id}` → `{phase:'commit'}`，
 *  收尾 `{done:true,code,...}`。页面关闭/刷新（连接断开）⇒ 下一条开始前停，不进写盘事务、真源不动。 */
async function handleChapterImport(req, res, chapterId) {
    const body = await readJsonBody(req);
    const ids = Array.isArray(body.resultIds) ? [...new Set(body.resultIds.map(String))] : [];
    if (!ids.length) return sendJson(res, 422, { error: '须提供 resultIds（至少 1 条）' });
    if (ids.length > 10) return sendJson(res, 422, { error: `一次最多 10 条（本次 ${ids.length} 条）` });
    const bad = ids.find((id) => !ID_RE.test(id));
    if (bad) return sendJson(res, 422, { error: `非法结果 id：${bad}` });
    if (!body.stream) return importResults(res, chapterId, ids);

    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' });
    res.socket?.setNoDelay(true);
    // 断线感知：close 时 writableEnded 仍 false ⇒ 客户端主动取消（正常 end 后 close 不算）
    let aborted = false;
    const markAborted = () => { if (!res.writableEnded) aborted = true; };
    res.on('close', markAborted);
    req.socket?.on('close', markAborted);
    const gone = () => aborted || res.destroyed || !!res.socket?.destroyed;
    // 必须等 write 回调：planIngest 里的 spawnSync 会阻塞事件循环，不等回调则多条进度会滞在缓冲里合并成一坨。
    // 断线时回调可能永不到达 ⇒ 300ms 兑底 + 直接标记取消（只拖取消路径，不影响正常流）。
    const w = (o) => new Promise((r) => {
        const t = setTimeout(() => { markAborted(); r(); }, 300);
        const done = () => { clearTimeout(t); r(); };
        try { res.write(JSON.stringify(o) + '\n', done); } catch { done(); }
    });
    const progress = (o) => {
        if (gone()) throw new ManageError('已取消：页面已断开，后续条目不再测量（真源未改动）', 499);
        return w(o);
    };
    const finish = (code, o) => { w({ done: true, code, ...o }).then(() => res.end()); };
    try {
        return await importResults(null, chapterId, ids, progress, finish);
    } catch (e) {
        // close 事件可能晚于 destroyed 翻真（TCP RST 传播），两者的取消路径都按 e.code===499 识别
        if (aborted || e.code === 499) {
            console.log('[import] 客户端断开，批量导入已取消（真源未改动）');
            return; // 客户端已走，无需也无法回写
        }
        return finish(e.code || 500, { error: String(e.message || e) });
    }
}

// ── [WXG-T-341] 大关管理：章节 / 成员操作端点（全部走 applyManage 快照事务）─────

/** 章序 open 前缀校验（与 sync `assertOpenPrefix` 同判据；早拦给可读红字，sync 兜底）。 */
function assertOpenPrefixLocal(chapters) {
    const sorted = [...chapters].sort((a, b) => a.order - b.order);
    const firstClosed = sorted.findIndex((c) => !c.open);
    if (firstClosed >= 0 && sorted.slice(firstClosed).some((c) => c.open))
        throw new ManageError(`open 必须自第 1 章起连续开放（第 ${firstClosed + 1} 章已关闭，其后不能有开放章）`);
}

/** store 用户域断言（「已到边界」「boss 恒为章内末位」等）→ ManageError(422)；其余原样。 */
function storeReject(fn) {
    try {
        return fn();
    } catch (e) {
        throw e instanceof ManageError ? e : new ManageError(String(e.message || e));
    }
}

// ── [WXG-T-364] 大关草稿：以「大关」为编辑单元攒一批小关 → 一次性发布 ────────────
//
// 为什么需要草稿：现有链路是「单条结果 → 立刻插进某章 boss 前」，一次只能进 1 条（或 10 条批量），
// 关序只能**入关后**再用 ↑/↓ 挪。以大关为单元编辑时，顺序应先在草稿里排定，最后一次性落盘。
//
// 草稿只存 resultId 引用（不复制图案/像素），落 `data/drafts/<id>/draft.json`：
//   · `data/` 已在 .gitignore（运行时数据不入库），且 `listResults` 对非 result 目录 isDir 全吞 ⇒ 不污染 /api/results。
// 发布 = 单事务（applyManage）：任一条不可入关 / 超墙容量 ⇒ 整批回滚，真源不留半截。
// 排序真源 = 草稿 resultIds 顺序 ⇒ 落成章 doc `levels[]` 顺序，**末位即 boss**（与 arc 装配口径一致）。
// ponytail: 发布暂不走 NDJSON 流式（对齐批量导入的 stream 分支成本高）；N 关各跑一次 bot 实测，
//   前端只显示「实测中」。等单次发布经常 >6 关再加流式进度。

const DRAFTS_DIR = join(DATA, 'drafts');
const DRAFT_MAX = 40;                       // 单草稿关数上限（墙容量会先拦，这条只防跑飞）
const draftFile = (id) => join(DRAFTS_DIR, id, 'draft.json');

function assertDraftId(id) {
    if (!CHAPTER_ID_RE.test(id)) throw new ManageError('草稿/大关 id 非法（^[a-z0-9][a-z0-9-]{0,31}$：小写字母/数字/连字符）');
    return id;
}

function readDraft(id) {
    assertDraftId(id);
    const f = draftFile(id);
    if (!existsSync(f)) throw new ManageError(`草稿 ${id} 不存在`, 404);
    return JSON.parse(readFileSync(f, 'utf8'));
}

/** 橱窗图统一入口（新建章 / 草稿存图共用）：data:image/png base64 → Buffer，≤512KB。 */
function parsePngDataUrl(v) {
    const m = typeof v === 'string' ? v.match(/^data:image\/png;base64,([A-Za-z0-9+/\s=]+)$/) : null;
    if (!m) throw new ManageError('展示图需为 data:image/png;base64,...（前端 canvas 缩到 256² 后上传）');
    const buf = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
    if (!buf.length || buf.length > 512 * 1024) throw new ManageError(`展示图 PNG ${buf.length} 字节超限（≤512KB）`);
    return buf;
}

/** 草稿列表（管理页左栏）：不回 base64 大图，只回 `art` 有无。 */
function listDrafts() {
    if (!existsSync(DRAFTS_DIR)) return [];
    const out = [];
    for (const id of readdirSync(DRAFTS_DIR)) {
        try {
            const d = JSON.parse(readFileSync(join(DRAFTS_DIR, id, 'draft.json'), 'utf8'));
            out.push({
                id: d.id ?? id, title: d.title ?? '', count: (d.resultIds ?? []).length,
                art: !!d.imageDataUrl, updatedAt: d.updatedAt ?? null,
            });
        } catch { /* 半截/损坏草稿跳过（同 listResults 口径） */ }
    }
    return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/**
 * 章内旧关文件整批搬到 `archive/<章id>-<时间戳>/`（保留 `singles/` 相对结构 + 章 doc / manifest 片段副本），
 * 返回归档目录名。`archive/` 在所有校验的扫描面之外 —— sync 只扫 `singles/ plates/ chapters/` 顶层与
 * levels 顶层 `*.json`（sync-levels-data.mjs:487-493/669-675、levels-dir-pipeline.test.ts:96-101），
 * 与既存 `assets/` 同构 ⇒ 不触发「孤儿关卡文件」断言。
 * 事务回滚安全性：`snapshotTree` 含整个 levels 树，`restoreTree` 会把归档搬运后的原文件从快照重建、
 * 并删掉快照外新增的 archive 文件 ⇒ 回滚后磁盘与事务前逐字节一致。
 */
function archiveChapterLevels(levelsDir, chapterId, doc, manifest) {
    const name = `${chapterId}-${new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}`;
    const dir = join(levelsDir, 'archive', name);
    const entries = [];
    for (const u of doc.levels ?? []) {
        const e = manifest.entries.find((x) => x.uid === u);
        if (!e) continue;
        entries.push({ ...e });                                  // 留 manifest 片段，人工还原时照抄
        const src = join(levelsDir, e.file);
        if (!existsSync(src)) continue;
        const dest = join(dir, e.file);
        mkdirSync(dirname(dest), { recursive: true });
        renameSync(src, dest);
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '_chapter.json'), JSON.stringify(doc, null, 2) + '\n');
    writeFileSync(join(dir, '_entries.json'), JSON.stringify(entries, null, 2) + '\n');
    return name;
}

/** GET /api/drafts → { drafts: [{id,title,count,art,updatedAt}] } */
function handleDraftList(res) {
    return sendJson(res, 200, { drafts: listDrafts() });
}

/** GET /api/drafts/:id → 草稿全文（含橱窗图 base64，供编辑页预览）。 */
function handleDraftGet(res, id) {
    return sendJson(res, 200, { draft: readDraft(id) });
}

/** POST /api/drafts/:id —— upsert 草稿。body {title, resultIds:[按序], imageDataUrl?}。不动真源。 */
async function handleDraftSave(req, res, id) {
    assertDraftId(id);
    const body = await readJsonBody(req);
    const title = String(body.title ?? '').trim();
    if (!title || title.length > 40) throw new ManageError('大关标题需 1–40 字');
    const ids = Array.isArray(body.resultIds) ? body.resultIds.map(String) : [];
    if (ids.length > DRAFT_MAX) throw new ManageError(`草稿最多 ${DRAFT_MAX} 关（本次 ${ids.length} 关）`);
    if (new Set(ids).size !== ids.length) throw new ManageError('同一结果不得重复加入草稿（错位盘里同图案会出现两块同色，bot 判据必挂）');
    const bad = ids.find((x) => !ID_RE.test(x));
    if (bad) throw new ManageError(`非法结果 id：${bad}`);
    for (const x of ids) if (!findResultFile(x)) throw new ManageError(`结果 ${x} 不存在（草稿不留坏引用）`, 404);
    const png = body.imageDataUrl === undefined ? null : parsePngDataUrl(body.imageDataUrl); // undefined = 保留原图

    const prevPath = draftFile(id);
    const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, 'utf8')) : {};
    const art = png ? `data:image/png;base64,${png.toString('base64')}` : prev.imageDataUrl ?? null;
    const draft = { id, title, resultIds: ids, ...(art ? { imageDataUrl: art } : {}), updatedAt: new Date().toISOString() };
    mkdirSync(join(DRAFTS_DIR, id), { recursive: true });
    writeFileSync(prevPath, JSON.stringify(draft, null, 2) + '\n');
    return sendJson(res, 200, { ok: true, id, count: ids.length, art: !!art, updatedAt: draft.updatedAt });
}

/** DELETE /api/drafts/:id —— 删草稿（不碰真源；已发布的大关照旧存在）。 */
function handleDraftDelete(res, id) {
    assertDraftId(id);
    const dir = join(DRAFTS_DIR, id);
    if (!existsSync(dir)) throw new ManageError(`草稿 ${id} 不存在`, 404);
    rmSync(dir, { recursive: true, force: true });
    return sendJson(res, 200, { ok: true, deleted: id });
}

/**
 * POST /api/drafts/:id/publish —— 统一发布。body {mode:'new'|'replace', target?}。
 *   · `new`     ：章 id = 草稿 id（须未被占用），落 `assets/<id>-boss-256.png` + `chapters/<id>.json`
 *   · `replace` ：章 id = target（草稿 id 仅作草稿标识），**保留 title/章序/showcase**，旧关文件整批归档
 * 两种模式都：按草稿顺序逐条入关 → 末位设为 boss（组图不能作 boss，末尾是 plate ⇒ 事务前拦）。
 * 事务外先做「逐条预检 + bot 实测 + 总槽校验」，全部通过才进写盘事务。
 */
async function handleDraftPublish(req, res, id) {
    const draft = readDraft(id);
    const body = await readJsonBody(req);
    const mode = body.mode === 'replace' ? 'replace' : 'new';
    const target = String(body.target ?? '').trim();
    const ids = draft.resultIds ?? [];
    if (!ids.length) throw new ManageError('草稿为空：至少加 1 关再发布');
    if (!existsSync(LEVELS_DIR)) return sendJson(res, 501, { error: '大关发布仅在本地仓运行 beads-studio 时可用' });

    const ls = await import('../../tools/scripts/level-store.mjs');
    const store = await import('../../tools/scripts/chapter-store.mjs');
    const manifest0 = ls.readManifest(LEVELS_DIR);
    if (mode === 'new') {
        if ((manifest0.chapters ?? []).some((c) => c.id === id))
            throw new ManageError(`大关 ${id} 已存在：改草稿 id，或改用「替换」到该大关`);
        if (!draft.imageDataUrl) throw new ManageError('新建大关须有橱窗图：草稿里补一张 256² PNG 再发布');
    } else {
        if (!CHAPTER_ID_RE.test(target)) throw new ManageError('替换须指定目标大关（body.target）');
        if (!(manifest0.chapters ?? []).some((c) => c.id === target))
            throw new ManageError(`目标大关 ${target} 不存在（要新建请用 mode:'new'）`, 404);
    }

    // 事务外：逐条预检 + 实测（耗时全在这，此阶段真源不动）。逐条收集而非首错即停，一次列全问题。
    const plans = [];
    const errs = [];
    for (const rid of ids) {
        try { plans.push(await planIngest(rid)); }
        catch (e) {
            if (!(e instanceof ManageError)) throw e;
            errs.push(e);
        }
    }
    if (errs.length)
        throw new ManageError(
            `发布预检未通过（${errs.length}/${ids.length} 关，真源未改动）：\n` +
            errs.map((e) => `· ${e.message}`).join('\n'),
            errs.every((e) => e.code === 404) ? 404 : 422,
        );
    const lastPlan = plans[plans.length - 1];
    if (lastPlan.kind === 'plate')
        throw new ManageError('草稿末位是组图（plate）：boss 须单文件盘 ⇒ 把一张 ≤32 的单图拖到末位');
    const totalSlots = plans.reduce((n, p) => n + p.slots, 0);
    const wallCap = readWallCapacity(readFileSync(TUNING_PATH, 'utf8'));
    if (totalSlots > wallCap)
        throw new ManageError(`本批 ${totalSlots} 槽 > 墙容量 ${wallCap}：删几关或拆成两个大关`);

    const png = mode === 'new' || draft.imageDataUrl ? parsePngDataUrl(draft.imageDataUrl) : null;

    return applyManage(res, (ctx) => {
        const log = [];
        let manifest = ctx.manifest;
        let chapterId = id;

        if (mode === 'new') {
            const art = `${id}-boss-256`;
            mkdirSync(join(ctx.levelsDir, 'assets'), { recursive: true });
            writeFileSync(join(ctx.levelsDir, 'assets', `${art}.png`), png);
            store.writeChapter(ctx.levelsDir, store.chapterFile(id), {
                id, title: draft.title, levels: [],
                showcase: { bundle: 'themes', art, textureId: `bitmap__${id}_boss` },
            });
            manifest = store.addChapterTo(manifest, { id, open: false });
            log.push(`新建大关 ${id}「${draft.title}」+ assets/${art}.png`);
        } else {
            chapterId = target;
            const ch = (manifest.chapters ?? []).find((c) => c.id === target);
            const doc = store.readChapter(ctx.levelsDir, ch.file);
            const arch = archiveChapterLevels(ctx.levelsDir, target, doc, manifest);
            for (const u of doc.levels ?? []) manifest = store.removeEntryByUid(manifest, u);
            const showcase = png
                ? { bundle: 'themes', art: `${target}-boss-256`, textureId: `bitmap__${target}_boss` }
                : doc.showcase;
            if (png) {
                mkdirSync(join(ctx.levelsDir, 'assets'), { recursive: true });
                writeFileSync(join(ctx.levelsDir, 'assets', `${target}-boss-256.png`), png);
            }
            store.writeChapter(ctx.levelsDir, ch.file, { ...doc, levels: [], ...(showcase ? { showcase } : {}) });
            log.push(`整章替换大关 ${target}「${doc.title}」：旧 ${(doc.levels ?? []).length} 关已归档 archive/${arch}/（title/章序/showcase 保留）`);
        }

        for (const plan of plans) {
            // append：章内此刻还没有 boss，顺序真源 = 草稿数组（插 boss 前会把第 2 条插到第 1 条之前）
            const out = commitIngest({ ...ctx, manifest }, ls, plan, chapterId, { append: true });
            manifest = out.manifest;
            log.push(out.log);
        }
        // 章内现有关卡已清空 ⇒ levels 顺序 = 草稿顺序；末位升 boss（组图已在上面拦掉）
        const doc2 = store.readChapter(ctx.levelsDir, (manifest.chapters.find((c) => c.id === chapterId)).file);
        const bossUid = doc2.levels?.[doc2.levels.length - 1];
        if (bossUid && manifest.entries.find((x) => x.uid === bossUid)?.kind !== 'boss')
            manifest = store.setEntryKind(manifest, bossUid, 'boss');
        log.push(`${ids.length} 关按草稿顺序入章；末位 ${bossUid} 设为 boss`);
        return { manifest, log };
    });
}

/**
 * POST /api/manage/chapter —— 新建大关 + 首关 boss（从结果导入），**建章与首关原子同批**。
 * body {id, title, imageDataUrl, resultId}：id = 章 slug（`chapters/<id>.json`）；
 * imageDataUrl = 前端 canvas 缩到 256² 的 PNG（≤512KB，落 `assets/<id>-boss-256.png`）；
 * resultId = 可入关结果（须单图 ≤32 且过 beads-bot 实测，boss 时长口径同普通关）。
 * showcase 固定 `bundle:themes` + `textureId: bitmap__<id>_boss`（未注册纹理时游端程序化回退）。
 */
async function handleChapterCreate(req, res) {
    const body = await readJsonBody(req);
    const id = String(body.id ?? '').trim();
    const title = String(body.title ?? '').trim();
    if (!CHAPTER_ID_RE.test(id)) throw new ManageError('章 id 非法（^[a-z0-9][a-z0-9-]{0,31}$：小写字母/数字/连字符）');
    if (!title || title.length > 40) throw new ManageError('章标题需 1–40 字');
    const m = typeof body.imageDataUrl === 'string' ? body.imageDataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/\s=]+)$/) : null;
    if (!m) throw new ManageError('展示图需为 data:image/png;base64,...（前端 canvas 缩到 256² 后上传）');
    const imgBuf = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
    if (!imgBuf.length || imgBuf.length > 512 * 1024) throw new ManageError(`展示图 PNG ${imgBuf.length} 字节超限（≤512KB）`);
    const found = findResultFile(String(body.resultId ?? ''));
    if (!found) throw new ManageError('首关结果 id 不存在', 404);
    const { r, file: resultFile } = found;
    if (r.cols > 32 || r.rows > 32)
        throw new ManageError(`盘 ${r.cols}×${r.rows} 超单图上限 32：boss 须单文件盘（先切到 ≤32 再重生成）`);
    const blockers = importBlockers(r);
    if (blockers.length) throw new ManageError('该结果不可作首关 boss：' + blockers.join('；'));
    const d = r.levelDraft;
    if (!d || !Array.isArray(d.pattern)) throw new ManageError('结果无 levelDraft（交换错位 k 需 ≥ 1）');
    const brandSlug = r.palette && r.palette !== '10' ? r.palette : null;
    if (brandSlug && (!Array.isArray(d.paletteCodes) || d.paletteCodes.length !== r.colors))
        throw new ManageError('草案缺 paletteCodes（旧记录请重新生成）');
    const measured = measureWithBot(resultFile);
    if (!measured) throw new ManageError('beads-bot 实测失败：boss 时长必须来自真引擎实测（公式 v0.2）', 500);
    if (measured.blockers.length) throw new ManageError('该结果不可作首关 boss：' + measured.blockers.join('；'));

    const art = `${id}-boss-256`;
    const textureId = `bitmap__${id}_boss`;
    return applyManage(res, (ctx) => {
        const { store, levelsDir, ls } = ctx;
        if ((ctx.manifest.chapters ?? []).some((c) => c.id === id)) throw new ManageError(`大关 ${id} 已存在`);
        for (const c of ctx.manifest.chapters ?? []) {
            const doc0 = store.readChapter(levelsDir, c.file);
            if (doc0.showcase?.textureId === textureId) throw new ManageError(`textureId ${textureId} 与章 ${c.id} 重复`);
        }
        mkdirSync(join(levelsDir, 'assets'), { recursive: true });
        writeFileSync(join(levelsDir, 'assets', `${art}.png`), imgBuf);
        const uid = ls.assignUid('boss', ls.existingUids(ctx.manifest));
        const file = `singles/${uid}.json`;
        const leg = legibilityFix(d); // 生成后二次优化修复（WXG-T-357，守恒配套）
        d.pattern = leg.pattern;
        if (leg.misplaced) d.misplaced = leg.misplaced;
        ls.writeLevelFile(levelsDir, file, {
            id: 0, name: `${id}-boss`, cols: d.cols, rows: d.rows, // id 填 0 占位 ⇒ 收尾 renumber 必修正
            time: measured.time, cycleProfile: 'short',
            pricing: measured.pricing,
            decoys: d.decoys || [], pattern: d.pattern, swaps: d.swaps || [],
            ...(d.misplaced ? { misplaced: d.misplaced } : {}),
            ...(brandSlug ? { palette: brandSlug, paletteCodes: d.paletteCodes } : {}),
        });
        store.writeChapter(levelsDir, store.chapterFile(id), {
            id, title, levels: [uid],
            showcase: { bundle: 'themes', art, textureId },
        });
        let manifest = ls.appendEntry(ctx.manifest, { uid, kind: 'boss', file, pack: 'main' });
        manifest = store.addChapterTo(manifest, { id, open: false });
        return { manifest, log: [`新建大关 ${id}「${title}」：首关 boss ${uid}（${d.cols}×${d.rows}，实测 ${measured.time}s）→ chapters/${id}.json + assets/${art}.png`, `首关 boss 豆面：${leg.note}`] };
    });
}

/** POST /api/manage/chapter/:id/(rename|open|move|delete)。 */
async function handleChapterOp(req, res, id, op) {
    const body = await readJsonBody(req);
    return applyManage(res, (ctx) => {
        const { store, levelsDir } = ctx;
        const manifest = ctx.manifest;
        const ch = (manifest.chapters ?? []).find((c) => c.id === id);
        if (!ch) throw new ManageError(`大关 ${id} 不存在`, 404);
        const doc = store.readChapter(levelsDir, ch.file);
        if (op === 'rename') {
            const title = String(body.title ?? '').trim();
            if (!title || title.length > 40) throw new ManageError('标题需 1–40 字');
            store.writeChapter(levelsDir, ch.file, { ...doc, title });
            return { manifest, log: [`大关 ${id} 改名：「${doc.title}」→「${title}」`] };
        }
        if (op === 'open') {
            const open = !!body.open;
            const chapters = (manifest.chapters ?? []).map((c) => (c.id === id ? { ...c, open } : c));
            assertOpenPrefixLocal(chapters);
            return { manifest: { ...manifest, chapters }, log: [`大关 ${id} 开放开关 → ${open ? '开放' : '关闭'}（ARC_OPEN_MAX 随 sync 重生成）`] };
        }
        if (op === 'move') {
            const next = storeReject(() => store.moveChapter(manifest, id, String(body.dir ?? '')));
            return { manifest: next, log: [`大关 ${id} ${body.dir === 'up' ? '上移' : '下移'}（id/file 随位交换，open 留位）`] };
        }
        // delete：至少保留 1 章；action=move 时全关按原序并入目标章 boss 前（boss 降 single），否则级联删
        const chaptersAll = manifest.chapters ?? [];
        if (chaptersAll.length <= 1) throw new ManageError('至少保留 1 章（橱窗骨架不可清空）');
        const uids = doc.levels ?? [];
        if (body.action === 'move') {
            const moveTo = String(body.moveTo ?? '');
            if (moveTo === id) throw new ManageError('moveTo 不能是自身');
            const target = chaptersAll.find((c) => c.id === moveTo);
            if (!target) throw new ManageError(`目标大关 ${moveTo} 不存在`, 404);
            const tdoc = store.readChapter(levelsDir, target.file);
            const tl = tdoc.levels ?? [];
            if (!tl.length) throw new ManageError(`目标大关 ${moveTo} 章文件 levels[] 为空（真源已坏，先跑校验）`);
            const slots = slotsOfMap(store, levelsDir, manifest);
            const add = uids.reduce((n, u) => n + (slots.get(u) ?? 1), 0);
            const cur = tl.reduce((n, u) => n + (slots.get(u) ?? 1), 0);
            const cap = readWallCapacity(readFileSync(TUNING_PATH, 'utf8'));
            if (cur + add > cap) throw new ManageError(`目标大关 ${moveTo} 容量不足：${cur}+${add} > ${cap}（先删几关或拆目标章）`);
            store.writeChapter(levelsDir, target.file, { ...tdoc, levels: [...tl.slice(0, -1), ...uids, tl[tl.length - 1]] });
            let next = manifest;
            for (const u of uids) {
                if (next.entries.find((x) => x.uid === u)?.kind === 'boss') next = store.setEntryKind(next, u, 'single');
            }
            next = store.removeChapterFrom(next, id);
            rmSync(join(levelsDir, ch.file));
            return { manifest: next, log: [`大关 ${id} 删除（${uids.length} 关按原序并入 ${moveTo} boss 前，原 boss 降级 single）；showcase 图保留未删`] };
        }
        let next = manifest;
        for (const u of uids) {
            const e = next.entries.find((x) => x.uid === u);
            if (!e) throw new ManageError(`章 ${id} 引用 uid ${u} 不在 manifest（真源已坏，先跑校验）`);
            rmSync(join(levelsDir, e.file));
            next = store.removeEntryByUid(next, u);
        }
        next = store.removeChapterFrom(next, id);
        rmSync(join(levelsDir, ch.file));
        return { manifest: next, log: [`删除大关 ${id}：${uids.length} 关及其文件已删；showcase 图 assets/${doc.showcase?.art ?? '?'}.png 保留（archive）`] };
    });
}

/**
 * POST /api/drafts/commit { id } —— 把预览草稿转正：data/_draft/ → data/<board>/<id>/ 并落 result.json。
 * 只认**当前**草稿（id 不匹配即 409）：否则用户看到的是 A 的效果，却可能把后来覆盖的 B 存进历史。
 */
async function handleDraftCommit(req, res) {
    let body = {};
    try {
        body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    } catch { /* 空体 = 没有目标 id，下面按 409 拒 */ }
    // 草稿按 id 独立成目录（见 handleGenerate 注）：只认 body.id 指向的那一份，不再有"当前草稿"这种全局位
    if (!body.id || !ID_RE.test(body.id)) return sendJson(res, 409, { error: '缺 id 或 id 非法：确认时要带上「生成预览」返回的那条 id' });
    const draftDir = join(DATA, '_draft', body.id);
    const draftPath = join(draftDir, 'draft.json');
    if (!existsSync(draftPath)) return sendJson(res, 409, { error: `没有待确认的预览 ${body.id}（可能已确认过，或服务重启后草稿被清）` });
    let draft;
    try {
        draft = JSON.parse(readFileSync(draftPath, 'utf8'));
    } catch (e) {
        return sendJson(res, 422, { error: `草稿 draft.json 已损坏：${e.message}` });
    }
    const { board, id } = draft;
    if (!ID_RE.test(board) || !ID_RE.test(id) || id !== body.id) {
        return sendJson(res, 422, { error: '草稿内容与 id 不一致（draft.json 被改过）' });
    }
    const finalDir = join(DATA, board, id);
    if (existsSync(finalDir)) return sendJson(res, 409, { error: `结果 ${id} 已入库` });
    mkdirSync(join(DATA, board), { recursive: true });
    renameSync(draftDir, finalDir);                        // raw.json + pattern.json + draft.json 一并搬家
    const snapshot = JSON.parse(readFileSync(join(finalDir, 'draft.json'), 'utf8'));
    rmSync(join(finalDir, 'draft.json'), { force: true }); // 单文件删除，不触发批量删除守卫
    writeFileSync(join(finalDir, 'result.json'), JSON.stringify(snapshot, null, 2));
    return sendJson(res, 200, { id, board, saved: true, importable: snapshot.importable !== false });
}

/**
 * GET /api/levels/:uid —— 只读：把一关读成**生成页可载入**的形状（生成页 `?level=<uid>` 用）。
 * 与其它关卡端点同口径：容器/VPS 无 games/ 真源 ⇒ 501。plate 逐格展开（前端默认看第 1 格）。
 * `paint` 复用 `paintOf`（paletteCodes → hex），前端不需要第二套色板映射。
 */
async function handleLevelGet(res, uid) {
    if (!existsSync(LEVELS_DIR))
        return sendJson(res, 501, { error: '载入关卡仅在本地仓运行 beads-studio 时可用（容器/VPS 无 games/ 真源）' });
    const ls = await import('../../tools/scripts/level-store.mjs');
    const store = await import('../../tools/scripts/chapter-store.mjs');
    const manifest = ls.readManifest(LEVELS_DIR);
    const e = manifest.entries.find((x) => x.uid === uid);
    if (!e) return sendJson(res, 404, { error: `关卡 ${uid} 不在 manifest` });
    const obj = JSON.parse(readFileSync(join(LEVELS_DIR, e.file), 'utf8'));
    const cells = e.kind === 'plate' ? (obj.cells ?? []) : [obj];
    if (!cells.length) return sendJson(res, 422, { error: `${uid} 无图案数据（真源已坏，先跑校验）` });
    const hit = findChapterOf(store, LEVELS_DIR, manifest, uid);
    return sendJson(res, 200, {
        uid, kind: e.kind, file: e.file,
        chapter: hit ? { id: hit.c.id, order: hit.c.order, title: hit.doc.title } : null,
        cells: cells.map((c) => ({
            id: c.id, idEnd: c.idEnd ?? c.id, name: c.name ?? '', cols: c.cols, rows: c.rows,
            time: c.time ?? null, steps: c.pricing?.steps ?? null,
            paint: paintOf(c), misplaced: Array.isArray(c.misplaced) ? c.misplaced : null,
        })),
    });
}

/** POST /api/manage/level/:uid/(remove|move|rename|boss|replace)。 */
async function handleLevelOp(req, res, uid, op) {
    if (op === 'replace') return handleLevelReplace(req, res, uid);
    const body = await readJsonBody(req);
    return applyManage(res, (ctx) => {
        const { store, levelsDir, ls } = ctx;
        const manifest = ctx.manifest;
        const e = manifest.entries.find((x) => x.uid === uid);
        if (!e) throw new ManageError(`关卡 ${uid} 不在 manifest`, 404);
        const hit = findChapterOf(store, levelsDir, manifest, uid);
        if (!hit) throw new ManageError(`关卡 ${uid} 未被任何章覆盖（真源已坏，先跑校验）`);
        const { c, doc } = hit;
        if (op === 'remove') {
            if (e.kind === 'boss') throw new ManageError('boss 不可删：先把同章其他关设为 boss，或删整章');
            store.writeChapter(levelsDir, c.file, { ...doc, levels: store.removeFromLevels(doc.levels, uid) });
            rmSync(join(levelsDir, e.file));
            return { manifest: store.removeEntryByUid(manifest, uid), log: [`删关 ${uid}（${e.file} 已移除）；其后关号由 renumber 自动前移`] };
        }
        if (op === 'move' && body.chapter) {
            if (e.kind === 'boss') throw new ManageError('boss 不可移出所在章（先把同章其他关设为 boss）');
            const toId = String(body.chapter);
            if (toId === c.id) throw new ManageError('目标章与当前一致（章内调序请用 dir=up|down）');
            const target = (manifest.chapters ?? []).find((x) => x.id === toId);
            if (!target) throw new ManageError(`目标大关 ${toId} 不存在`, 404);
            const tdoc = store.readChapter(levelsDir, target.file);
            const slots = slotsOfMap(store, levelsDir, manifest);
            const add = slots.get(uid) ?? 1;
            const cur = (tdoc.levels ?? []).reduce((n, u) => n + (slots.get(u) ?? 1), 0);
            const cap = readWallCapacity(readFileSync(TUNING_PATH, 'utf8'));
            if (cur + add > cap) throw new ManageError(`目标大关 ${toId} 容量不足：${cur}+${add} > ${cap}`);
            store.writeChapter(levelsDir, c.file, { ...doc, levels: store.removeFromLevels(doc.levels, uid) });
            store.writeChapter(levelsDir, target.file, { ...tdoc, levels: store.insertBeforeBoss(tdoc.levels, uid) });
            return { manifest, log: [`移关 ${uid}：${c.id} → ${toId}（插 boss 前）`] };
        }
        if (op === 'move' && body.to !== undefined) {
            // 拖拽落点：`to` = 移动后该关在章内的下标（0 起）。boss 锁末位由 store 侧守。
            const levels = storeReject(() => store.moveInChapterTo(doc.levels, uid, Number(body.to)));
            store.writeChapter(levelsDir, c.file, { ...doc, levels });
            return { manifest, log: [`章内拖拽 ${uid} → 第 ${Number(body.to) + 1} 位（章 ${c.id}）`] };
        }
        if (op === 'move') {
            const levels = storeReject(() => store.moveInChapter(doc.levels, uid, String(body.dir ?? '')));
            store.writeChapter(levelsDir, c.file, { ...doc, levels });
            return { manifest, log: [`章内调序 ${uid} ${body.dir}（章 ${c.id}）`] };
        }
        if (op === 'rename') {
            const name = String(body.name ?? '').trim();
            if (!name || name.length > 60) throw new ManageError('关名需 1–60 字');
            const obj = JSON.parse(readFileSync(join(levelsDir, e.file), 'utf8'));
            obj.name = name;
            ls.writeLevelFile(levelsDir, e.file, obj);
            return { manifest, log: [`关 ${uid} 改名 →「${name}」`] };
        }
        if (op === 'boss') {
            if (e.kind === 'plate') throw new ManageError('plate（组合图）不可作 boss（boss 须单文件盘）');
            if (e.kind === 'boss') throw new ManageError(`${uid} 已是 boss`);
            const oldBoss = doc.levels.find((u) => manifest.entries.find((x) => x.uid === u)?.kind === 'boss');
            if (!oldBoss) throw new ManageError(`章 ${c.id} 无 boss（真源已坏，先跑校验）`);
            store.writeChapter(levelsDir, c.file, { ...doc, levels: store.swapToEnd(doc.levels, uid) });
            let next = store.setEntryKind(manifest, uid, 'boss');
            next = store.setEntryKind(next, oldBoss, 'single');
            return { manifest: next, log: [`${uid} 设为 boss（原 boss ${oldBoss} 降为普通关）`] };
        }
        throw new ManageError(`未知操作 ${op}`);
    });
}

/**
 * POST /api/manage/level/:uid/replace {resultId} —— 用另一份生成结果替换该关图案。
 * uid / 关号 / 章位 / 关名全不变，只有图案与实测时长（pricing 溯源）换新。
 * 只支持单文件关（single / boss）：plate 是多文件逐格产物，删后按「分大关导入」重建。
 * 测量在事务外；写盘由 applyManage 快照兜底。字段**显式重建**（不 spread 旧对象）——
 * 旧的 misplaced / paletteCodes 对新图案是脏数据。
 */
async function handleLevelReplace(req, res, uid) {
    const body = await readJsonBody(req);
    if (!existsSync(LEVELS_DIR))
        return sendJson(res, 501, { error: '大关管理仅在本地仓运行 beads-studio 时可用（容器/VPS 无 games/ 真源）' });
    const ls = await import('../../tools/scripts/level-store.mjs');
    const entry0 = ls.readManifest(LEVELS_DIR).entries.find((x) => x.uid === uid);
    if (!entry0) return sendJson(res, 404, { error: `关卡 ${uid} 不在 manifest` });
    if (entry0.kind === 'plate')
        return sendJson(res, 422, { error: '组合图（plate）暂不支持单关替换图案：请删该关后按大关导入重建（多格逐格实测）' });
    const found = findResultFile(String(body.resultId ?? ''));
    if (!found) return sendJson(res, 404, { error: '替换用结果 id 不存在' });
    const { r, file: resultFile } = found;
    if (r.cols > 32 || r.rows > 32)
        return sendJson(res, 422, { error: `结果盘 ${r.cols}×${r.rows} 超单图上限 32：超 32 请走大关导入（plate 切片）` });
    const blockers = importBlockers(r);
    if (blockers.length) return sendJson(res, 422, { error: '该结果不可替换：' + blockers.join('；') });
    const d = r.levelDraft;
    if (!d || !Array.isArray(d.pattern)) return sendJson(res, 422, { error: '结果无 levelDraft（交换错位 k 需 ≥ 1）' });
    const brandSlug = r.palette && r.palette !== '10' ? r.palette : null;
    if (brandSlug && (!Array.isArray(d.paletteCodes) || d.paletteCodes.length !== r.colors))
        return sendJson(res, 422, { error: '草案缺 paletteCodes（旧记录请重新生成；v1.40 关卡存品牌色号而非 hex）' });
    const measured = measureWithBot(resultFile);
    if (!measured) return sendJson(res, 500, { error: 'beads-bot 实测失败：入关时长必须来自真引擎实测（公式 v0.2），拒用静态估算兑底' });
    if (measured.blockers.length) return sendJson(res, 422, { error: '该结果不可替换：' + measured.blockers.join('；') });

    return applyManage(res, (ctx) => {
        const { levelsDir } = ctx;
        const entry = ctx.manifest.entries.find((x) => x.uid === uid);
        if (!entry) throw new ManageError(`关卡 ${uid} 不在 manifest`, 404);
        if (entry.kind === 'plate') throw new ManageError('组合图（plate）暂不支持单关替换图案');
        const old = JSON.parse(readFileSync(join(levelsDir, entry.file), 'utf8'));
        ctx.ls.writeLevelFile(levelsDir, entry.file, {
            id: old.id, name: old.name, cols: d.cols, rows: d.rows,
            time: measured.time, cycleProfile: 'short',
            pricing: measured.pricing,
            decoys: d.decoys || [], pattern: d.pattern, swaps: d.swaps || [],
            ...(d.misplaced ? { misplaced: d.misplaced } : {}),
            ...(brandSlug ? { palette: brandSlug, paletteCodes: d.paletteCodes } : {}),
        });
        // 反向补标：这条结果被本关采用 ⇒ 记进 linkedLevels，之后「只看本关」的列表能找回它
        // （源可能是 `/` 下生成的无标签条目）。result.json 属运行时运维数据、不在关卡真源事务里，
        // 标签只增不删 ⇒ 重复替换幂等，写失败也不回滚替换本身。
        const lv = Array.isArray(r.linkedLevels) ? r.linkedLevels : [];
        if (!lv.includes(uid)) {
            try {
                writeFileSync(resultFile, JSON.stringify({ ...r, linkedLevels: [...lv, uid] }, null, 2));
                r.linkedLevels = [...lv, uid];
            } catch { /* 忽略：不影响关卡写盘结果 */ }
        }
        return { manifest: ctx.manifest, log: [`替换 ${uid} 图案：${old.cols}×${old.rows} → ${d.cols}×${d.rows}，实测 ${measured.time}s（关名「${old.name}」、关号与章位不变）`] };
    });
}

// ── [WXG-T-221 / ADR-0027 S3-lite] 当前关预烘导出 ────────────────────────────
// 产物只落本地资源目录（games/beads/assets/{bead,cell}/levels/），不进 game.json /
// 不入主包 / 不入分包 ⇒ 本批不触发 S0 包体守卫。运行时烘臂不删（DEC-3 三层读序原样）。
const BAKE_ASSETS = join(REPO, 'games/beads/assets');
/**
 * 层集指纹 = 框架 `bake-schema-version.ts` 的镜像（本服务纯 Node、不编译 TS ⇒ 读不到源，
 * 手工同步）。⚠ 改框架层集时必须同改这一行，否则文件名 `__v<N>` 与运行时缓存 key 漂移。
 */
const BAKE_SCHEMA_VERSION = 1;
const BAKE_KINDS = new Set(['bead', 'cell']);
// 严格白名单：仅 `[a-z0-9_-]` + `.png` 结尾（首字符非 `-`/`_` 以免被当参数），禁 `/` `.` ⇒ 天然防穿越。
const BAKE_FILENAME_RE = /^[a-z0-9][a-z0-9_-]{0,123}\.png$/;

/** 扫 result 用到的色索引集合（1-based、去重升序）：levelDraft.pattern 优先、回落正解 pattern。 */
function usedColorIdxSet(r) {
    const rows = r.levelDraft?.pattern || r.pattern;
    if (!Array.isArray(rows)) return [];
    const set = new Set();
    for (const row of rows) {
        if (typeof row !== 'string') continue;
        for (const ch of row) {
            const ci = baseColorOfChar(ch); // '.'/'x'/非法 → 0 ⇒ 丢
            if (ci > 0) set.add(ci);
        }
    }
    return [...set].sort((a, b) => a - b);
}

/** 服务端权威生成文件名（前端只回填、不自拼，杜绝双源漂移）。 */
function bakeFilename(kind, styleId, colorIdx) {
    const slug = kind === 'cell' ? 'cell' : String(styleId).replace(/[^a-z0-9_-]/g, '-');
    return `${slug}__c${colorIdx}__v${BAKE_SCHEMA_VERSION}.png`;
}

/** 跨 board 目录按 id 找一条 result.json（返回 {r, file}；与 GET/DELETE 端点同口径）。 */
function findResultFile(id) {
    if (!existsSync(DATA)) return null;
    for (const board of readdirSync(DATA)) {
        const f = join(DATA, board, id, 'result.json');
        if (existsSync(f)) return { r: JSON.parse(readFileSync(f, 'utf8')), file: f };
    }
    return null;
}
const findResultById = (id) => findResultFile(id)?.r ?? null;

function handleBakeManifest(res, url) {
    // 仅本地仓（同 ingest 那条守卫的理由：服务无鉴权，这是不开公网的边界）。容器无 games/ ⇒ 501。
    if (!existsSync(join(REPO, 'games/beads')))
        return sendJson(res, 501, { error: '当前关预烘导出仅在本地仓运行 beads-studio 时可用（容器/VPS 无 games/ 资源目录）' });
    const id = url.searchParams.get('id');
    const styleId = url.searchParams.get('style') || 'facet-4';
    if (!id || !ID_RE.test(id)) return sendJson(res, 400, { error: 'id 缺失或非法（[a-z0-9-]）' });
    const r = findResultById(id);
    if (!r) return sendJson(res, 404, { error: 'not found' });
    const used = usedColorIdxSet(r);
    const listExisting = (dir) => { try { return new Set(readdirSync(dir)); } catch { return new Set(); } };
    const beadExisting = listExisting(join(BAKE_ASSETS, 'bead', 'levels'));
    const cellExisting = listExisting(join(BAKE_ASSETS, 'cell', 'levels'));
    const bead = [];
    const cell = [];
    for (const ci of used) {
        const bf = bakeFilename('bead', styleId, ci);
        if (!beadExisting.has(bf)) bead.push({ colorIdx: ci, filename: bf });
        const cf = bakeFilename('cell', styleId, ci);
        if (!cellExisting.has(cf)) cell.push({ colorIdx: ci, filename: cf });
    }
    return sendJson(res, 200, {
        styleId, schemaVersion: BAKE_SCHEMA_VERSION, usedColorIdx: used, bead, cell,
        counts: { used: used.length, beadMissing: bead.length, cellMissing: cell.length },
    });
}

async function handleBakeSave(req, res) {
    if (!existsSync(join(REPO, 'games/beads')))
        return sendJson(res, 501, { error: '当前关预烘导出仅在本地仓运行 beads-studio 时可用' });
    let body;
    try {
        body = JSON.parse((await readBody(req)).toString('utf8'));
    } catch (e) {
        return sendJson(res, 400, { error: `body 需为 JSON {kind,filename,dataUrl}：${e.message}` });
    }
    const { kind, filename, dataUrl } = body || {};
    if (!BAKE_KINDS.has(kind)) return sendJson(res, 400, { error: 'kind 只允 bead|cell' });
    if (typeof filename !== 'string' || !BAKE_FILENAME_RE.test(filename))
        return sendJson(res, 400, { error: 'filename 非法（^[a-z0-9][a-z0-9_-]{0,123}\.png$）' });
    const m = typeof dataUrl === 'string' ? dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/\s=]+)$/) : null;
    if (!m) return sendJson(res, 400, { error: 'dataUrl 需为 data:image/png;base64,...' });
    const buf = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
    if (!buf.length) return sendJson(res, 400, { error: 'base64 解码为空' });
    const dir = join(BAKE_ASSETS, kind, 'levels');
    mkdirSync(dir, { recursive: true });
    const target = join(dir, filename); // filename 已过白名单（无 `/`、无 `..`）⇒ 必落 dir 内
    let prevBytes = null;
    try { prevBytes = readFileSync(target).length; } catch { /* 新文件 */ }
    writeFileSync(target, buf);
    return sendJson(res, 200, { saved: `${kind}/levels/${filename}`, bytes: buf.length, overwroteBytes: prevBytes });
}

/**
 * GET /api/tint-export?mode=holed|holeless → tint mask 双张下载（WXG-T-222；base 已于 WXG-T-237 v8.0 移除）。
 *
 * **单一真源零移植**（2026-09-29）：烘焙逻辑不搬 JS——服务端子进程直接跑定稿脚本
 * `tools/mask-preview/export-cocos-textures{,-holeless}.py`（有孔 v1.0 / 无孔 v1.0-holeless，
 * 用户拍板冻结口径），读 cocos-assets 两张 mask PNG 回 base64，前端逐张触发浏览器下载。
 * ⚠ 依赖宿主 python3 + numpy + pillow（本地仓满足；容器/VPS 无 games/ ⇒ 501 同 bake 守卫）。
 * tint mask 是**色无关**的（一张 mask × 运行时 tint 色），故无逐色导出、与 bake-manifest 不同。
 * 透明度只由 mask 的 B(shape) 通道承担 ⇒ 无 `*-base.png`（v8.0 移除；v9.0 holed 改名 `*-hole-*`）。
 */
const TINT_MODES = {
    holed: {
        script: 'tools/mask-preview/export-cocos-textures.py',
        files: ['bead-hole-tint-128-mask.png', 'grid-hole-tint-128-mask.png'],
    },
    holeless: {
        script: 'tools/mask-preview/export-cocos-textures-holeless.py',
        files: ['bead-holeless-tint-128-mask.png', 'grid-holeless-tint-128-mask.png'],
    },
};

function handleTintExport(res, url) {
    if (!existsSync(join(REPO, 'games/beads')))
        return sendJson(res, 501, { error: 'tint 导出仅在本地仓运行 beads-studio 时可用（容器/VPS 无仓库资源）' });
    const mode = url.searchParams.get('mode');
    const conf = TINT_MODES[mode];
    if (!conf) return sendJson(res, 400, { error: 'mode 只允 holed|holeless' });
    const script = join(REPO, conf.script);
    if (!existsSync(script)) return sendJson(res, 500, { error: `定稿脚本缺失：${conf.script}` });
    const outDir = join(REPO, 'tools/mask-preview/cocos-assets');
    const r = spawnSync('python3', [script], { cwd: REPO, encoding: 'utf8', timeout: 60_000 });
    if (r.status !== 0)
        return sendJson(res, 500, { error: `烘焙脚本失败（rc=${r.status}；需 python3+numpy+pillow）：${(r.stderr || r.stdout || '').slice(-400)}` });
    const files = [];
    for (const name of conf.files) {
        const p = join(outDir, name);
        if (!existsSync(p)) return sendJson(res, 500, { error: `脚本未产出 ${name}` });
        files.push({ filename: name, dataUrl: `data:image/png;base64,${readFileSync(p).toString('base64')}` });
    }
    return sendJson(res, 200, { mode, files });
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
        return sendJson(res, 400, { error: `w/h 缺失或超限（≤4096×4096）` });
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
    // draft=1 = 预览：写进 data/_draft/<id>/，不落 result.json ⇒ 既不进「已存结果」，
    // 也不会出现在管理页「替换图案…」的选图器里；点「确认保存」才由 /api/drafts/commit 转正。
    // ⚠ 每次预览用**独立目录、绝不删旧草稿**：工作区删除守卫按「本 turn 累计条目数」计数（阈值 500，K-163），
    //   固定目录 + rmSync 会让常驻服务攒过线后永久报 SAFE_DELETE_BULK_CONFIRM_REQUIRED（2026-10-24 实测 502）。
    const isDraft = q.get('draft') === '1';
    const relOut = isDraft ? `_draft/${id}` : `${board}/${id}`;
    const outDir = join(DATA, relOut);
    mkdirSync(outDir, { recursive: true });
    const rawPath = join(outDir, 'raw.json');
    // 前端已按 cols×K × rows×K 平滑缩放到 w×h ⇒ 直接透传 base64，不再解码重编码
    writeFileSync(rawPath, JSON.stringify({ w, h, data: b64 }));
    // ⚠ mis 白名单必须与 beads-gen 一致（full/max/swaps/none）——此前只认 swaps|full，
    //    把前端的 none 静默折叠成 full，导致「不错位」永远不生效（2026-09-21 实测）。
    //    §3.2 批2 加 `max`：漏这一条 = 前端选「最大化错位」又被折叠回 full，低色数图照旧拒产。
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
        premedian: Math.max(0, parseInt(q.get('premedian') || '0', 10)),
        noframe: q.get('noframe') === '1',
        // 关包围盒裁剪（关卡模式「按该关尺寸生成」）：见 runGen / 文件头 API 注。
        notrim: q.get('notrim') === '1',
        mis: misRaw === 'swaps' || misRaw === 'none' || misRaw === 'max' ? misRaw : 'full',
    };
    // EP12-S9（裁定②）：生成页「风格」选项 → levelDraft.skin（**引用 id，不传数据本体**）。
    // 白名单 = 游戏侧已注册皮肤 id（`games/beads/src/config/skins/registry.ts`，本服务纯 Node
    // 读不到 TS ⇒ 手工同源；改注册表须同步此行）。未注册 / 缺省 ⇒ 取默认肤 'warm-paper'
    // （与游戏侧 importBlockers「未注册不拒收关卡本体」同口径：生成侧直接收敛，不产脏值）。
    const skinRaw = q.get('skin');
    const skin = SKIN_IDS.includes(skinRaw) ? skinRaw : SKIN_IDS[0];
    // 关卡标签（`?level=<uid>`，生成页在 `?level=` 模式下带过来）：为"只看本关的历史记录"提供依据。
    // ⚠ 只有**从关卡编辑页生成**的才带；`/` 下生成的不带 ⇒ 不会串进任何关的列表。
    //    数组而非单值：同一份结果可能被替换进多个关（见 handleLevelReplace 的反向标记）。
    const levelUid = /^[LP]\d{1,9}$/.test(q.get('level') || '') ? q.get('level') : '';
    if (params.mis === 'swaps' && params.swaps < 1) params.swaps = 1; // 交换模式下 k≥1
    let pattern;
    try {
        pattern = await runGen(rawPath, outDir, params);
    } catch (e) {
        // 失败不留残骸，**但拒产的证据除外**（2026-09-22）：beads-gen 先写 pattern.json、再由 beads-bot
        // `--patch` 回填 report.difficulty（taps/bMed/split/blockers），删目录 = 销毁判据；
        // 而 raw.json 是**重生同一盘的唯一输入**（改平滑/减色后拿同图对比）⇒ 一并保留，不省这点空间。
        // `data/` 已 gitignore。ponytail: 无 result.json ⇒ 列表不展示、API 不删，手动 `rm -rf data/<board>/<id>`
        if (existsSync(join(outDir, 'pattern.json'))) {
            return sendJson(res, 422, { error: `${String(e.message || e)} ｜ 证据：data/${relOut}/（pattern.json + raw.json）` });
        }
        // 预览目录每次独立且不删（删除会计入工作区守卫的 turn 累计数，见 handleGenerate 注）——
        // 空残骸最多占几 KB，清理由手动 rm 或后续清理脚本处理。
        if (!isDraft) rmSync(outDir, { recursive: true, force: true });
        return sendJson(res, 422, { error: String(e.message || e) });
    }
    // 盘面真实尺寸 = beads-gen 裁空边（trim）后的实际行列，而非请求档位（异形/去背景后更小，
    // 2026-09-21 实测：请求 21×21、trim 后 15×17 ⇒ 头不修正则前端按 21×21 画布画 15×17 直接错乱）。
    // EP12-S9：皮肤引用写入 levelDraft（/level 端点随草案原样下发；旧记录无此字段零影响）。
    if (pattern.levelDraft) pattern.levelDraft.skin = skin;
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
        // 错位规模（单一真源 = beads-gen 写进 pattern.json 的 `report.mis`：{mode,N,m,M,F,M_max}）。
        // 不另存一份字段：`report` 已随 result 存盘，双源就必漂移（K-047 口径）。
        createdAt: new Date().toISOString(),
        thumb, // 原图缩略图（dataURL）；**仅存单条详情**，不进列表投影
        levelDraft: pattern.levelDraft ?? null,
        pattern: pattern.pattern ?? null, // 正解盘（mis=none 无 levelDraft 时的唯一图源；体积小直接透传）
        paletteHex: pattern.paletteHex ?? null, // 色号 → 实际 hex（前端忠实预览 artkal 用）
        misplaced: pattern.misplaced, // 全错位参考盘（仅 swaps=0 时为真实初始盘）
        report: pattern.report ?? null,
        // 关卡标签：只有从关卡编辑页生成才有（见上 levelUid 注）
        ...(levelUid ? { linkedLevels: [levelUid] } : {}),
    };
    // 可入关判定在写盘时算一次（单一真源），前端与服务端拦截共用同一结果
    result.blockers = importBlockers(result);
    result.importable = result.blockers.length === 0;
    // 预览只写 draft.json（含与正式记录同一份 result 快照）⇒ 确认时原样搬成 result.json，不再重算
    if (isDraft) {
        writeFileSync(join(outDir, 'draft.json'), JSON.stringify(result, null, 2));
        return sendJson(res, 200, { ...result, draft: true });
    }
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
        // 预览 → 确认入库（生成页「确认保存这条结果」）
        if (req.method === 'POST' && path === '/api/drafts/commit') return await handleDraftCommit(req, res);
        // [WXG-T-221] 当前关预烘导出（仅本地仓，两 handler 内各自守 501）。
        if (req.method === 'GET' && path === '/api/bake-manifest') return handleBakeManifest(res, url);
        if (req.method === 'POST' && path === '/api/bake-save') return await handleBakeSave(req, res);
        if (req.method === 'GET' && path === '/api/tint-export') return handleTintExport(res, url);
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
            // 预览草稿同路径删（生成页只有右侧 ✕ 一个删除入口，预览/已存同一套动作）
            const draftDir = join(DATA, '_draft', del[1]);
            if (existsSync(join(draftDir, 'draft.json'))) {
                rmSync(draftDir, { recursive: true, force: true });
                return sendJson(res, 200, { deleted: del[1], board: '_draft', draft: true });
            }
            return sendJson(res, 404, { error: 'not found' });
        }
        // 预览草稿（未确认保存）：列表 + 单条全文。生成页靠它把预览也摆进「已存结果」一栏。
        if (req.method === 'GET' && path === '/api/previews') return sendJson(res, 200, { previews: listPreviews() });
        const pv = path.match(/^\/api\/previews\/([a-z0-9][a-z0-9-]{0,63})$/);
        if (req.method === 'GET' && pv) {
            const f = join(DATA, '_draft', pv[1], 'draft.json');
            if (!existsSync(f)) return sendJson(res, 404, { error: `预览 ${pv[1]} 不存在（可能已确认保存或已删除）` });
            try {
                return sendJson(res, 200, { ...JSON.parse(readFileSync(f, 'utf8')), draft: true });
            } catch (e) {
                return sendJson(res, 422, { error: `预览 draft.json 已损坏：${e.message}` });
            }
        }
        // 只读：生成页 `?level=<uid>` 载入该关图案（管理页点小关 → 跳生成页编辑）
        const ml = path.match(/^\/api\/levels\/([LP]\d{1,9})$/);
        if (req.method === 'GET' && ml) return await handleLevelGet(res, ml[1]);
        if (req.method === 'GET' && path === '/api/results') return sendJson(res, 200, { results: listResults() });
        // 原图缩略图二进制（管理页选图器逐个懒加载；dataURL 解码后直接回图片，省前端一次 base64 转换）
        const mt = path.match(/^\/api\/results\/([a-z0-9][a-z0-9-]{0,63})\/thumb$/);
        if (req.method === 'GET' && mt) {
            for (const board of existsSync(DATA) ? readdirSync(DATA) : []) {
                const f = join(DATA, board, mt[1], 'result.json');
                if (!existsSync(f)) continue;
                const r = JSON.parse(readFileSync(f, 'utf8'));
                const dm = typeof r.thumb === 'string' && r.thumb.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
                if (!dm) return sendJson(res, 404, { error: '该结果无缩略图' });
                res.setHeader('Cache-Control', 'public, max-age=86400'); // 结果存盘后不再变，选图器反复开关不重拉
                return send(res, 200, Buffer.from(dm[2], 'base64'), dm[1]);
            }
            return sendJson(res, 404, { error: 'not found' });
        }
        // 拼豆图案投影（旧条目没有原图 thumb，选图器用 pattern+paletteHex 自己画缩略图）
        const mp = path.match(/^\/api\/results\/([a-z0-9][a-z0-9-]{0,63})\/paint$/);
        if (req.method === 'GET' && mp) {
            for (const board of existsSync(DATA) ? readdirSync(DATA) : []) {
                const f = join(DATA, board, mp[1], 'result.json');
                if (!existsSync(f)) continue;
                const r = JSON.parse(readFileSync(f, 'utf8'));
                if (!Array.isArray(r.pattern) || !Array.isArray(r.paletteHex))
                    return sendJson(res, 404, { error: '该结果无图案数据' });
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return sendJson(res, 200, { pattern: r.pattern, colors: r.paletteHex });
            }
            return sendJson(res, 404, { error: 'not found' });
        }
        // [WXG-T-364] 大关草稿：以大关为编辑单元攒一批小关 → 一次性发布（新增 / 整章替换 + 旧关归档）。
        // 草稿本身只碰 data/drafts（不需要 501 守卫）；publish 才是写真源，其内单守 501。
        if (req.method === 'GET' && path === '/api/drafts') return handleDraftList(res);
        const mdp = path.match(/^\/api\/drafts\/([a-z0-9][a-z0-9-]{0,31})\/publish$/);
        if (req.method === 'POST' && mdp) return await handleDraftPublish(req, res, mdp[1]);
        const md = path.match(/^\/api\/drafts\/([a-z0-9][a-z0-9-]{0,31})$/);
        if (md && req.method === 'GET') return handleDraftGet(res, md[1]);
        if (md && req.method === 'POST') return await handleDraftSave(req, res, md[1]);
        if (md && req.method === 'DELETE') return handleDraftDelete(res, md[1]);
        // [WXG-T-341] 大关管理（全部仅本地仓；handler 内守 501）：状态/校验/建章/章操作/关操作。
        if (req.method === 'GET' && path === '/api/manage/state') return handleManageState(res);
        if (req.method === 'POST' && path === '/api/manage/verify') return handleManageVerify(res);
        if (req.method === 'POST' && path === '/api/manage/chapter') return await handleChapterCreate(req, res);
        const mimp = path.match(/^\/api\/manage\/chapter\/([a-z0-9][a-z0-9-]{0,31})\/import$/);
        if (req.method === 'POST' && mimp) return await handleChapterImport(req, res, mimp[1]);
        const mch = path.match(/^\/api\/manage\/chapter\/([a-z0-9][a-z0-9-]{0,31})\/(rename|open|move|delete)$/);
        if (req.method === 'POST' && mch) return await handleChapterOp(req, res, mch[1], mch[2]);
        const mlv = path.match(/^\/api\/manage\/level\/([LP]\d{1,9})\/(remove|move|rename|boss|replace)$/);
        if (req.method === 'POST' && mlv) return await handleLevelOp(req, res, mlv[1], mlv[2]);
        const mi = path.match(/^\/api\/results\/([a-z0-9][a-z0-9-]{0,63})\/ingest$/);
        if (req.method === 'POST' && mi) {
            let chapterId = null;
            try { chapterId = (await readJsonBody(req)).chapter ?? null; } catch { /* 空体/坏体 ⇒ ingestLevel 内统一报「须指定目标大关」 */ }
            return await ingestLevel(res, mi[1], chapterId);
        }
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
        // [WXG-T-221] 前端预烘需 import harness 编译产物（framework + beads 视图模块）。studio 静态根
        // 是 public/、dist 不在其内 ⇒ 单开一条只读映射（同 generic static 的防穿越；容器无 dist ⇒ 404）。
        if (req.method === 'GET' && path.startsWith('/harness-dist/')) {
            const HARNESS_DIST = join(REPO, 'dev/harness/dist');
            const file = join(HARNESS_DIST, path.slice('/harness-dist/'.length));
            if (!file.startsWith(HARNESS_DIST) || !existsSync(file))
                return sendJson(res, 404, { error: 'harness dist 缺失：先跑 `pnpm run harness:build`' });
            const ext = file.slice(file.lastIndexOf('.'));
            const type = ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.map' ? 'application/json; charset=utf-8' : 'application/octet-stream';
            return send(res, 200, readFileSync(file), type);
        }
        // 静态：/ 与 /index.html → public/；其余映射同路径（防穿越）
        const rel = path === '/' ? 'index.html' : path.slice(1);
        const file = join(PUBLIC, rel);
        if (!file.startsWith(PUBLIC) || !existsSync(file)) return sendJson(res, 404, { error: 'not found' });
        // 本地工具页每次协商：否则浏览器启发式缓存会让改动不生效（改动后没看到新按钮）
        res.setHeader('Cache-Control', 'no-cache');
        return send(res, 200, readFileSync(file), MIME[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream');
    } catch (e) {
        return sendJson(res, e.code || 500, { error: String(e.message || e) }); // ManageError.code 透传 4xx（body 坏 = 400 等）
    }
}

createServer(handle).listen(PORT, () => {
    console.log(`beads-studio → http://localhost:${PORT}（data: ${DATA}）`);
});
