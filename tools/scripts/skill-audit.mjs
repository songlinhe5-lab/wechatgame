#!/usr/bin/env node
/**
 * skill 调用审计 —— 读 CodeBuddy IDE 会话历史，输出 `use_skill` 调用明细。
 *
 * ## 为什么需要它
 * skill 加载是**模型侧主动 `use_skill`**（无 hook、无门禁）⇒ 「该用的用没用」事后无法查证。
 * 但 IDE **本地历史里有完整 tool-call 记录**（字段 = `toolName` / `args` / `toolCallId`，
 * 块类型 `tool-call`；⚠ 每个 message 的 `message` 字段是**字符串化 JSON**，需二次 parse）。
 * 本脚本是这份数据唯一的读取口。
 *
 * ## 用法
 *   node tools/scripts/skill-audit.mjs            # 明细 + 汇总 + 零调用清单
 *   node tools/scripts/skill-audit.mjs --json     # 机器可读
 *   node tools/scripts/skill-audit.mjs --conv <会话id前缀>   # 只看某个会话
 *
 * ## 数据源
 *   ~/Library/Application Support/CodeBuddyExtension/Data/<实例>/CodeBuddyIDE/<实例>/history/<会话>/<turn>/messages/*.json
 *   （Windows 侧路径不同；本脚本按 macOS 布局，缺失时静默输出 0 条并提示）
 *
 * ⛔ 只读本地文件，不写任何东西。
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DATA_ROOT = join(
  homedir(),
  'Library/Application Support/CodeBuddyExtension/Data',
);
const REPO_SKILLS_DIR = join(process.cwd(), 'my-skills');
const USER_SKILLS_DIR = join(homedir(), '.codebuddy/skills');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const convFilterIdx = argv.indexOf('--conv');
const convFilter = convFilterIdx >= 0 ? argv[convFilterIdx + 1] : null;

/** @returns {string[]} 所有 history 目录 */
function findHistoryRoots() {
    if (!existsSync(DATA_ROOT)) return [];
    return readdirSync(DATA_ROOT)
        .map((d) => join(DATA_ROOT, d, 'CodeBuddyIDE', d, 'history'))
        .filter((p) => existsSync(p));
}

/** 会话 id → { name, lastMessageAt } */
function readConvNames(root) {
    const out = new Map();
    for (const conv of safeReaddir(root)) {
        const idx = join(root, conv, 'index.json');
        if (!existsSync(idx)) continue;
        try {
            for (const c of JSON.parse(readFileSync(idx, 'utf8')).conversations ?? []) {
                out.set(`${conv}/${c.id}`, { name: c.name ?? '', lastMessageAt: c.lastMessageAt ?? '' });
            }
        } catch { /* 坏文件跳过：不因单文件中断整次审计 */ }
    }
    return out;
}

function safeReaddir(p) {
    try { return readdirSync(p).filter((f) => statSync(join(p, f)).isDirectory()); } catch { return []; }
}

/** 已安装的 skill 名（frontmatter `name:`）——用于「零调用」判定 */
function installedSkills() {
    const names = new Set();
    for (const [dir, label] of [[USER_SKILLS_DIR, 'user'], [REPO_SKILLS_DIR, 'repo']]) {
        for (const s of safeReaddir(dir)) {
            const f = join(dir, s, 'SKILL.md');
            if (!existsSync(f)) continue;
            try {
                const m = /^---\r?\n[\s\S]*?^name:\s*(\S+)/m.exec(readFileSync(f, 'utf8'));
                names.add(m ? m[1] : s);
            } catch { names.add(s); }
        }
    }
    return names;
}

const roots = findHistoryRoots();
if (roots.length === 0) {
    console.error('⚠ 未找到 CodeBuddy 会话历史（路径不存在）。macOS 期望：%s', DATA_ROOT);
    process.exit(0);
}

const toolCount = new Map();
const skillRows = [];
let totalCalls = 0;

for (const root of roots) {
    const convNames = readConvNames(root);
    for (const conv of safeReaddir(root)) {
        for (const turn of safeReaddir(join(root, conv))) {
            const msgDir = join(root, conv, turn, 'messages');
            let files = [];
            try { files = readdirSync(msgDir).filter((f) => f.endsWith('.json')); } catch { continue; }
            for (const f of files) {
                let inner; let createdAt = '';
                try {
                    const d = JSON.parse(readFileSync(join(msgDir, f), 'utf8'));
                    createdAt = String(d.createdAt ?? '');
                    // ⚠ message 是**字符串化 JSON**（第二版解析才拿得到 content）
                    inner = typeof d.message === 'string' ? JSON.parse(d.message) : d.message;
                } catch { continue; }
                for (const m of inner?.content ?? []) {
                    if (m?.type !== 'tool-call') continue;
                    const name = String(m.toolName ?? '?');
                    totalCalls += 1;
                    toolCount.set(name, (toolCount.get(name) ?? 0) + 1);
                    if (!name.toLowerCase().includes('skill')) continue;
                    let args = m.args ?? {};
                    if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = { raw: args }; } }
                    const brief = args.command ?? args.skill ?? args.subagent_name ?? args.path ?? '';
                    skillRows.push({
                        at: createdAt.slice(0, 19).replace('T', ' '),
                        conv,
                        turn,
                        skill: String(brief),
                        convName: convNames.get(`${conv}/${turn}`)?.name ?? '',
                    });
                }
            }
        }
    }
}

skillRows.sort((a, b) => (a.at < b.at ? -1 : 1));
const filtered = convFilter ? skillRows.filter((r) => r.conv.startsWith(convFilter)) : skillRows;
const usedSkills = new Set(skillRows.map((r) => r.skill));
const zeroUse = [...installedSkills()].filter((s) => !usedSkills.has(s)).sort();

if (asJson) {
    console.log(JSON.stringify({ totalCalls, skillCalls: filtered, usedSkills: [...usedSkills].sort(), zeroUse }, null, 2));
    process.exit(0);
}

console.log('══ CodeBuddy skill 调用审计 ══\n');
console.log('历史目录   : %d 个实例', roots.length);
console.log('tool-call  : %d 条（其中 skill 类 %d 条）\n', totalCalls, skillRows.length);

if (filtered.length === 0) {
    console.log('（无 skill 调用记录%s）', convFilter ? ` · 会话过滤 ${convFilter}` : '');
} else {
    let lastConv = null;
    for (const r of filtered) {
        if (r.conv !== lastConv) {
            lastConv = r.conv;
            console.log('── 会话 %s  「%s」', r.conv.slice(0, 8), (r.convName || '').slice(0, 30));
        }
        console.log('   %s  %s', r.at, r.skill);
    }
}

const top = [...toolCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('\n工具调用 TOP8：', top.map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('用过的 skill（%d）：%s', usedSkills.size, [...usedSkills].sort().join(', ') || '无');
console.log('零调用 skill（%d）：%s', zeroUse.length, zeroUse.join(', ') || '无');
