#!/usr/bin/env node
// 文本失真扫描（K-160 / K-162 的执行层）：只扫 `git diff` 的**新增行**，区分「本批新引入」与「历史遗留」。
// 用法：node tools/scripts/scan-text-distortion.mjs [diff 参数…] [--paths=a,b]
//   默认范围 = `git diff HEAD -U0`（工作树 vs HEAD）；例：… --staged ｜ … origin/develop HEAD
//   ⚠ 并发会话共用同一棵工作树 ⇒ `git diff HEAD` 会把**别人的 WIP**一并扫进来（不报错、只是假命中），
//     因此本批自己改的文件请用 `--paths=` 限定（多个用逗号，前缀匹配）；不传则扫全树并在头部提示文件数。
// 判据来自两条判例：① 中文近形字/生僻符号肉眼复核无效 ⇒ 按码点机械扫；② 命中必须打印**所在行 + 归属文件**。
// ⛔ 本脚本不做门禁（无消费者前不进 verify），只作改中文文档后的当场自证。
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const pathsArg = argv.find((a) => a.startsWith('--paths='));
const paths = pathsArg ? pathsArg.slice('--paths='.length).split(',').map((p) => p.trim()).filter(Boolean) : [];
const diffArgs = argv.filter((a) => !a.startsWith('--paths='));
if (diffArgs.length === 0) diffArgs.push('HEAD');
const out = execFileSync('git', ['diff', ...diffArgs, '-U0', ...(paths.length ? ['--', ...paths] : [])], {
  maxBuffer: 1 << 28,
}).toString();

// 逐行携带归属文件（`+++ b/<path>` 之后到下一个文件头之间的新增行都属于它）
const added = [];
let file = '?';
for (const line of out.split('\n')) {
  if (line.startsWith('+++ ')) {
    file = line.slice(4).replace(/^b\//, '').trim();
    if (file === '/dev/null') file = '(new) ' + file;
    continue;
  }
  if (line.startsWith('+') && !line.startsWith('+++')) added.push({ file, text: line.slice(1) });
}

const ZERO_WIDTH = { 'U+200B': '\u200b', 'U+200C': '\u200c', 'U+200D': '\u200d', 'U+FEFF': '\ufeff', 'U+2060': '\u2060' };
// 近形集：本仓实测踩过的字形对（左 = 正确字，右 = 误写字）。逐/塌/锚 vs 逢/塔/锤/锢、顿号 vs 中点
const CONFUSABLES = [
  { ok: '逐 U+9010', bad: '逢 U+9022', ch: '\u9022' },
  { ok: '塌 U+584C', bad: '塔 U+5854', ch: '\u5854' },
  { ok: '锚 U+951A', bad: '锤 U+9524', ch: '\u9524' },
  { ok: '锚 U+951A', bad: '锢 U+9522', ch: '\u9522' },
  { ok: '、 U+3001', bad: '・ U+30FB', ch: '\u30fb' },
  { ok: '≺ U+227A', bad: '⋺ U+22FA', ch: '\u22fa' },
];
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const COMMON = new Set(
  '「」『』（）《》【】·、，。：；！？—–…→←↑↓⇒⇐⛔≤≥×÷±｜‖█░▓★☆●○◆◇□■▲▼①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮' +
    '＝≈′″²³™⚠✓✗§α△▲⋺⊺'.split(''),
);

const hits = [];
const push = (kind, h, detail) => hits.push({ kind, file: h.file, detail: `${detail} :: ${h.text.trim().slice(0, 80)}` });

for (const h of added) {
  for (const [cp, ch] of Object.entries(ZERO_WIDTH)) if (h.text.includes(ch)) push('零宽', h, cp);
  for (const c of CONFUSABLES) if (h.text.includes(c.ch)) push('近形', h, `应为 ${c.ok} ⇒ 出现 ${c.bad}(${c.ch})`);
  if (/[\u4e00-\u9fff][ \u00a0]+[\u4e00-\u9fff]/.test(h.text)) push('词内空格?', h, 'CJK 间夹空格');
}

// 非常用符号盘点：列出新增行里所有「非 ASCII · 非汉字 · 不在常见标点白名单」的码点，逐条人工判归属
const odd = new Map();
for (const h of added) {
  for (const ch of h.text) {
    if (ch.codePointAt(0) < 128 || CJK.test(ch) || COMMON.has(ch)) continue;
    const key = `${ch} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
    const prev = odd.get(key) ?? { n: 0, files: new Set() };
    odd.set(key, { n: prev.n + 1, files: new Set([...prev.files, h.file.split('/').pop()]) });
  }
}

console.log(
  `扫描范围 = git diff ${diffArgs.join(' ')} -U0${paths.length ? ` -- ${paths.join(' ')}` : ''} ｜ 新增行 ${added.length} 行 / ${new Set(added.map((a) => a.file)).size} 个文件`,
);
if (!hits.length) {
  console.log('命中：零宽 0 ｜ 近形 0 ｜ 词内空格 0');
} else {
  for (const kind of ['零宽', '近形', '词内空格?']) {
    const list = hits.filter((h) => h.kind === kind);
    console.log(`\n【${kind}】${list.length} 处`);
    for (const h of list) console.log(`  ${h.file}\n    ${h.detail}`);
  }
}
console.log(
  '\n非常用符号盘点（非 ASCII·非汉字·非白名单，逐条判「是本批写的还是引文」）：',
  [...odd.entries()]
    .map(([k, v]) => `${k} ×${v.n}@{${[...v.files].join(',')}}`)
    .join('  ') || '（无）',
);
console.log('\n判读口径：命中落在「自纠条目／回归例的引文」里属**刻意引用**，⛔ 当活错字改掉；' +
  '同一轮扫描数与全文 grep 数不等并不矛盾（本文件会自引用），⛔ 拿字面计数断言「零残留」。');
