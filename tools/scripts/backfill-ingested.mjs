#!/usr/bin/env node
/**
 * backfill-ingested.mjs — 存量结果批量回填「已入章」标记（WXG-T-978 ③ 补）
 *
 * 背景：`ingested:{chapter,at}` 是 2026-11-17 入章回写才加的字段；此前的入章没有标记，
 * 刷新/重启后会被当成「未入章」。本脚本按**关卡来源反查**：关卡 pattern（cols×rows +
 * rowstrings）与结果/草稿的 pattern **全等** ⇒ 该结果进过这一关，写回 ingested。
 *
 * 不猜歧义：同一 pattern 命中多条时（批量重跑/预览残留），优先取**已确认保存**的
 * result.json；仍多于 1 条就用关卡名的 4 位短后缀（studio-1-f57f）对结果 id 后缀，
 * 只有**恰好 1 条**才落标记，否则整组跳过并打印，交人工核。
 * 草稿（_draft）只在「没有任何已保存结果命中、且草稿恰好 1 条」时才标记（旧流程允许预览直接入章）。
 *
 * 用法：
 *   node tools/scripts/backfill-ingested.mjs                  # 只读预览（默认）
 *   node tools/scripts/backfill-ingested.mjs --write          # 落盘
 *   node tools/scripts/backfill-ingested.mjs --write --force  # 覆盖已有标记（默认跳过）
 *
 * 写入面只有 apps/beads-studio/data 下的 result.json / draft.json（gitignore 的开发数据），不碰关卡真源。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEVELS = join(REPO, 'games/beads/design/levels');
const DATA = join(REPO, 'apps/beads-studio/data');
const WRITE = process.argv.includes('--write');
const FORCE = process.argv.includes('--force');
const at = new Date().toISOString();

const sig = (cols, rows, pattern) => `${cols}x${rows}|${pattern.join('\n')}`;
const suffixOf = (s) => (String(s).match(/-([0-9a-f]{4,})$/i) || [])[1]?.toLowerCase() ?? '';

// ── 关卡（manifest 入口；chapter 由 chapters/*.json 反查）────────────────────
const manifest = JSON.parse(readFileSync(join(LEVELS, 'manifest.json'), 'utf8'));
const chapterOf = {};
for (const f of readdirSync(join(LEVELS, 'chapters'))) {
    if (!f.endsWith('.json')) continue;
    const c = JSON.parse(readFileSync(join(LEVELS, 'chapters', f), 'utf8'));
    for (const uid of c.levels ?? []) chapterOf[uid] = c.id;
}
const levels = [];
const bySig = new Map();
for (const e of manifest.entries) {
    const lv = JSON.parse(readFileSync(join(LEVELS, e.file), 'utf8'));
    if (!Array.isArray(lv.pattern)) continue;
    const entry = { uid: e.uid, name: lv.name ?? '', chapter: chapterOf[e.uid] ?? '(未挂章)', sig: sig(lv.cols, lv.rows, lv.pattern) };
    levels.push(entry);
    bySig.set(entry.sig, entry); // 关卡间 pattern 全等极罕见；后者覆盖时会在预览里体现
}

// ── 结果 / 预览草稿聚合（data/<board>/<id>/result.json 与 data/_draft/<id>/draft.json）──
const groups = new Map(); // sig → { result: [], draft: [] }
const add = (kind, file, obj) => {
    const pattern = obj.pattern ?? obj.levelDraft?.pattern;
    if (!Array.isArray(pattern)) return false;
    const key = sig(obj.cols ?? obj.levelDraft?.cols, obj.rows ?? obj.levelDraft?.rows, pattern);
    const g = groups.get(key) ?? { result: [], draft: [] };
    g[kind].push({ file, obj });
    groups.set(key, g);
    return true;
};
let scanned = 0, noPattern = 0;
for (const board of readdirSync(DATA)) {
    if (board === 'drafts' || board.startsWith('.')) continue; // drafts = 大关草稿，不是图案结果
    const dir = join(DATA, board);
    if (!statSync(dir).isDirectory()) continue;
    for (const id of readdirSync(dir)) {
        const f = join(dir, id, 'result.json');
        if (!existsSync(f)) continue;
        scanned++;
        try { if (!add('result', f, JSON.parse(readFileSync(f, 'utf8')))) noPattern++; } catch { /* 跳过损坏件 */ }
    }
}
const draftDir = join(DATA, '_draft');
if (existsSync(draftDir)) {
    for (const id of readdirSync(draftDir)) {
        const f = join(draftDir, id, 'draft.json');
        if (!existsSync(f)) continue;
        scanned++;
        try { if (!add('draft', f, JSON.parse(readFileSync(f, 'utf8')))) noPattern++; } catch { /* 跳过损坏件 */ }
    }
}

// ── 逐关挑唯一来源；有歧义就跳过 ────────────────────────────────────────────
const hitLevels = new Set();
const ambiguous = [];
let matched = 0, already = 0, written = 0;
const take = (lv, rec) => {
    hitLevels.add(lv.uid);
    matched++;
    const { file, obj } = rec;
    if (obj.ingested && !FORCE) { already++; return; }
    obj.ingested = { chapter: lv.chapter, at, levelUid: lv.uid, backfilled: true };
    if (WRITE) writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
    written++;
    console.log(`${WRITE ? '已标记' : '将标记'} ${obj.id ?? file} → ${lv.chapter}/${lv.uid}`);
};

for (const lv of levels) {
    const g = groups.get(lv.sig);
    if (!g) continue;
    const saved = g.result;
    const drafts = g.draft;
    if (saved.length === 1) { take(lv, saved[0]); continue; }
    if (saved.length === 0 && drafts.length === 1) { take(lv, drafts[0]); continue; }

    // 多条候选：用关卡名后缀做唯一决断（恰 1 条命中才落）
    const pool = saved.length ? saved : drafts;
    const suffix = suffixOf(lv.name);
    const tied = suffix ? pool.filter((c) => suffixOf(c.obj.id ?? '') === suffix) : [];
    if (tied.length === 1) { take(lv, tied[0]); continue; }

    hitLevels.add(lv.uid);
    ambiguous.push(`${lv.uid}（${saved.length} 结果 / ${drafts.length} 草稿）`);
}

const unmatched = levels.filter((lv) => !hitLevels.has(lv.uid)).map((lv) => lv.uid);
console.log(
    `\n${WRITE ? '回填完成' : '预览（加 --write 落盘）'}：扫描 ${scanned} 个结果/草稿` +
    `（无 pattern ${noPattern}）｜命中关卡 ${hitLevels.size}｜已标记跳过 ${already}｜写入 ${written}`,
);
if (ambiguous.length) console.log(`⚠ 同 pattern 多候选、无法唯一定源，已跳过 ${ambiguous.length} 关：${ambiguous.join('、')}`);
if (unmatched.length) console.log(`未匹配关卡 ${unmatched.length} 个：${unmatched.join('、')}（来源结果可能已删除，或关卡图入章后被手改）`);
