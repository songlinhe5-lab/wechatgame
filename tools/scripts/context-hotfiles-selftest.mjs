#!/usr/bin/env node
/**
 * context-hotfiles-selftest.mjs — 第二跳速查表的装置自测（WXG-T-293，quality-lead 验收判据 U4）。
 *
 * 为什么必须有：本表新加了两件控量（锚点标题截断 / 台账型文件条数上限）+ 一道新门 D3。
 * 「跑过 ≠ 有效」（K-036）——所以这里既要证**正例**（截断不算断链），也要证**反例必红**
 * （行号说谎、ROUTES 引用锚点被削、退路未声明、巨族孤锚），否则 D3 就是一条无牙守卫（K-089）。
 *
 * 用法：`pnpm run ctx:hotfiles:selftest`（已挂进 `selftest:fast`）。零外部依赖、只用合成样本。
 */

import {
  hopHit,
  parseHotBlocks,
  secondHopIssues,
  renderHotFileBlock,
} from './lib/context-index.mjs';

const S = '\u00a7';           // 锚点前缀 §
const ELL = '\u2026';          // 截断后缀 …
const SEP = ' \u00b7 ';         // 条目分隔符

const results = [];
const ok = (name, cond) => results.push({ name, pass: !!cond });

/** 合成 index：一个「巨族 + 两子节」的文件 + 一个「L1+L2+L3」的文件。 */
const big = {
  path: 'docs/big.md',
  lines: 900,
  tokens: 12000,
  sections: [
    { anchor: `${S}巨族`, level: 1, startLine: 1, endLine: 900, tokens: 12000 },
    { anchor: `${S}巨族.1 甲`, level: 2, startLine: 10, endLine: 499, tokens: 6000 },
    { anchor: `${S}巨族.2 乙`, level: 2, startLine: 500, endLine: 900, tokens: 6000 },
  ],
};
const small = {
  path: 'docs/small.md',
  lines: 30,
  tokens: 500,
  sections: [
    { anchor: `${S}根`, level: 1, startLine: 1, endLine: 30, tokens: 500 },
    { anchor: `${S}中`, level: 2, startLine: 5, endLine: 20, tokens: 300 },
    { anchor: `${S}中.1 末`, level: 3, startLine: 8, endLine: 20, tokens: 120 },
  ],
};
const files = [big, small];
const routed = new Map([
  ['docs/small.md', new Set([`${S}中.1 末`])],
  ['docs/big.md', new Set([`${S}巨族.2 乙`])],
]);

// ── 解析器：锚点名含分隔符时不许碎 ──────────────────────────────────────────
const parsed = parseHotBlocks(
  ['## `docs/x.md` — 9 行 / 100 tok', '', `${S}A1 · 核心循环（S1）=1+5${SEP}${S}B=6+2`, ''].join('\n'),
);
const px = parsed.get('docs/x.md')?.entries ?? [];
ok('A1 锚点名内含分隔符「 · 」时解析不碎（2 条）', px.length === 2);
ok('A2 首条 label 完整', px[0]?.label === `${S}A1 · 核心循环（S1）`);
ok('A3 次条 label 不含分隔符前缀', px[1]?.label === `${S}B` && px[1]?.start === 6 && px[1]?.limit === 2);

// ── 命中判定：行号不得说谎 ──────────────────────────────────────────────────
const sec = { anchor: `${S}A1 · 核心循环（S1）— 来源`, startLine: 1, endLine: 5 };
ok('B1 全名相等 + 行号一致 ⇒ 命中', hopHit({ label: sec.anchor, start: 1, limit: 5 }, sec));
ok('B2 截断前缀 + 行号一致 ⇒ 命中（截断不算断链）', hopHit({ label: `${S}A1 · 核心循环（S…`, start: 1, limit: 5 }, sec));
ok('B3 行号不一致 ⇒ 不命中（反例能红）', !hopHit({ label: sec.anchor, start: 1, limit: 4 }, sec));
ok('B4 前缀对但行号漂 ⇒ 不命中', !hopHit({ label: `${S}A1 · 核心循环（S…`, start: 2, limit: 5 }, sec));

// ── D3 正例：完整表 0 问题 ──────────────────────────────────────────────────
const good = [
  `## \`${big.path}\` — 900 行 / 12000 tok`, '',
  `${S}巨族=1+900 · ${S}巨族.1 甲=10+490 · ${S}巨族.2 乙=500+401`, '',
  `## \`${small.path}\` — 30 行 / 500 tok`, '',
  `${S}根=1+30 · ${S}中=5+16 · ${S}中.1 末=8+13`, '',
].join('\n');
ok('C1 完整表 ⇒ D3 无问题', secondHopIssues(files, good, routed, new Set()).length === 0);

// ── D3 反例：四类各能红 ─────────────────────────────────────────────────────
const u1 = secondHopIssues(files, [
  `## \`${small.path}\` — 30 行 / 500 tok`, '', `${S}根=1+30 · ${S}中=5+16`, '',
].join('\n'), routed, new Set());
ok('U1 能红：ROUTES 引用锚点被削 ⇒ 报 U1', u1.some((x) => x.startsWith('U1')));

const u2 = secondHopIssues(files, [
  `## \`${small.path}\` — 30 行 / 500 tok`, '', `${S}中=5+16`, '',
].join('\n'), new Map(), new Set());
ok('U2 能红：既未列也不被覆盖、且无退路声明 ⇒ 报 U2', u2.some((x) => x.startsWith('U2')));
const u2ok = secondHopIssues(files, [
  `## \`${small.path}\` — 30 行 / 500 tok`, '', `${S}中=5+16`, '',
].join('\n'), new Map(), new Set([small.path]));
ok('U2 豁免生效：ROUTES 声明「先查 index.json」的文件不受条数退路断言', u2ok.filter((x) => x.startsWith('U2')).length === 0);

const u3 = secondHopIssues(files, [
  `## \`${big.path}\` — 900 行 / 12000 tok`, '', `${S}巨族=1+900`, '',
].join('\n'), new Map(), new Set());
ok('U3 能红：巨族只留孤锚无子节行号 ⇒ 报 U3', u3.some((x) => x.startsWith('U3')));
const u3ok = secondHopIssues(files, [
  `## \`${big.path}\` — 900 行 / 12000 tok`, '', `${S}巨族=1+900 · ${S}巨族.2 乙=500+401`, '',
].join('\n'), new Map(), new Set());
ok('U3 不误报：留了任一子节 ⇒ 不再报 U3', !u3ok.some((x) => x.startsWith('U3')));

// ── 生成器侧：截断 / 条数上限 / 尾注 / 不受上限 ─────────────────────────────
const wide = {
  path: 'docs/wide.md', lines: 200, tokens: 4000,
  sections: [{ anchor: `${S}根`, level: 1, startLine: 1, endLine: 200, tokens: 4000 }]
    .concat(Array.from({ length: 25 }, (_, i) => ({
      anchor: `${S}节 ${String(i).padStart(2, '0')} 一个很长的标题需要截断处理`, level: 2,
      startLine: 10 + i * 7, endLine: 14 + i * 7, tokens: 40,
    }))),
};
const longAnchor = `${S}一个长到需要被截断的锚点标题名称示例ABCDEFGH`;
const truncBlock = renderHotFileBlock({
  ...small,
  sections: [{ anchor: longAnchor, level: 2, startLine: 5, endLine: 20, tokens: 300 }],
}, 0, { labelMaxChars: 20, anchorMax: 12, preferred: false });
const truncLine = truncBlock.find((l) => l.startsWith(S));
ok('G1 截断生效且行号原样', truncLine.startsWith(`${longAnchor.slice(0, 20)}${ELL}=5+16`));
ok('G1b 未超长的锚点不被截断（全名保留）', renderHotFileBlock(
  { ...small, sections: [{ anchor: `${S}短`, level: 2, startLine: 5, endLine: 20, tokens: 300 }] },
  0, { labelMaxChars: 20, anchorMax: 12, preferred: false },
).find((l) => l.startsWith(S)) === `${S}短=5+16`);

const capped = renderHotFileBlock(wide, 0, {
  labelMaxChars: 20, anchorMax: 12, preferred: true,
  routed: new Set([`${S}节 03 一个很长的标题需要截断处理`]),
}).join('\n');
const listed = (parseHotBlocks(`## \`docs/wide.md\`\n\n${capped.split('\n').find((l) => l.startsWith(S)) ?? ''}`).get('docs/wide.md')?.entries ?? []);
ok('G2 preferred 文件 = L1 族父 + ROUTES 引用(不计入) + 12 条补足', listed.length === 1 + 1 + 12);
ok('G3 尾注「余 N 节」与实际裁掉的条数一致（26 − 14 = 12）', capped.includes('其余 12 节 → ctx/index.json'));
ok('G4 补足取的是尾部编号最大的节（倒序），不是文档开头', listed.some((e) => e.label.includes('节 24')) && !listed.some((e) => e.label.includes('节 01')));

const uncapped = renderHotFileBlock(wide, 0, { labelMaxChars: 20, anchorMax: 12, preferred: false }).join('\n');
const uncappedListed = (parseHotBlocks(`## \`docs/wide.md\`\n\n${uncapped.split('\n').find((l) => l.startsWith(S)) ?? ''}`).get('docs/wide.md')?.entries ?? []);
ok('G5 非 preferred 文件不受条数上限（25 节全列）', uncappedListed.length === 26);

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`);
console.log(`\n${failed.length === 0 ? '✅' : '❌'} check-hotfiles 自测 ${results.length - failed.length}/${results.length}`);
if (failed.length > 0) process.exit(1);
