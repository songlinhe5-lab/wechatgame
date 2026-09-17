#!/usr/bin/env node
/**
 * check:a11y — 可访问性「代码符号锚点」机械守卫（WXG-T-155 / K-035 / backlog 转正）。
 *
 * 防什么：accessibility.md 状态列混淆「规格已写」与「代码已实现」= 第 5 轮假绿的温床
 *（判例 K-035，WXG-T-084/091）。本脚本把「声称落地」降级为**可机检凭证**：
 *   ① 锚点表（games/<game>/art/a11y-anchors.md）id 集合 == 矩阵（games/<game>/art/accessibility.md §2）行 id 集合；
 *   ② 锚点表状态列为 ✅ 的行 ⇒ 锚点列非空；
 *   ③ 任意行给出的非 `-` 锚点 ⇒ 在该游戏 src 下全部 .ts 字面命中 ≥1（多锚点 `;` 分隔，全须命中）。
 * 诚实边界（不掩饰）：矩阵状态列 ↔ 锚点表状态列的语义一致性不做机检——矩阵长文本行内
 * 嵌 `|` 公式（ΔL、绝对值记法）致表格切分不可靠；该面仍归 QA 评审 + §3 小结对账。
 * 输出契约：末行 `STATUS: OK|FAIL`（verify-all 聚合器解析）。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const errors = [];

/** 递归收集某游戏 src 下全部 .ts 文本（拼接为一个大海绵，字面量检索）。 */
function collectSrc(dir) {
  if (!existsSync(dir)) return null;
  let blob = '';
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) blob += collectSrc(p) ?? '';
    else if (ent.name.endsWith('.ts')) blob += readFileSync(p, 'utf8') + '\n';
  }
  return blob;
}

/** 解析 markdown 表格行 → cells 数组（简单切分；仅用于**无内嵌竖线**的锚点表）。 */
function tableRows(text, idRe) {
  const rows = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|/);
    if (!m || !idRe.test(m[1].trim())) continue;
    rows.push(m[1].trim());
  }
  return rows;
}

const gamesDir = join(ROOT, 'games');
let checkedGames = 0;
for (const game of readdirSync(gamesDir)) {
  const anchorPath = join(gamesDir, game, 'art', 'a11y-anchors.md');
  const matrixPath = join(gamesDir, game, 'art', 'accessibility.md');
  if (!existsSync(anchorPath) && !existsSync(matrixPath)) continue;
  checkedGames += 1;
  const gid = `games/${game}`;

  if (!existsSync(anchorPath)) {
    errors.push(`${gid}: 有 accessibility.md 但缺锚点表 art/a11y-anchors.md（K-035 纪律）`);
    continue;
  }
  if (!existsSync(matrixPath)) {
    errors.push(`${gid}: 有锚点表但缺矩阵 accessibility.md`);
    continue;
  }

  const matrix = readFileSync(matrixPath, 'utf8');
  const anchors = readFileSync(anchorPath, 'utf8');
  const srcBlob = collectSrc(join(gamesDir, game, 'src')) ?? '';

  // ① id 集合相等。矩阵行 id：行首单元格恰为特性编号（A1/A2b/…），该位置无内嵌竖线，可靠。
  const idRe = /^[A-H][0-9]+b?$/;
  const matrixIds = new Set(tableRows(matrix, idRe));
  // 锚点表行：`| id | 状态 | 锚点 | 备注 |`
  const anchorRows = [];
  for (const line of anchors.split('\n')) {
    const m = line.match(/^\|\s*([A-H][0-9]+b?)\s*\|([^|]*)\|([^|]*)\|/);
    if (m) anchorRows.push({ id: m[1], status: m[2].trim(), anchor: m[3].trim() });
  }
  const anchorIds = new Set(anchorRows.map((r) => r.id));
  for (const id of matrixIds) if (!anchorIds.has(id)) errors.push(`${gid}: 矩阵行 ${id} 在锚点表缺行`);
  for (const id of anchorIds) if (!matrixIds.has(id)) errors.push(`${gid}: 锚点表行 ${id} 在矩阵无对应`);

  // ② + ③
  for (const { id, status, anchor } of anchorRows) {
    const isClaim = status.includes('✅');
    const syms = anchor === '-' || anchor === '' ? [] : anchor.split(';').map((s) => s.replace(/`/g, '').trim()).filter(Boolean);
    if (isClaim && syms.length === 0) {
      errors.push(`${gid}: ${id} 状态 ✅（声称落地）但锚点列为空 —— 假绿防线失守`);
      continue;
    }
    for (const sym of syms) {
      if (!srcBlob.includes(sym)) {
        errors.push(`${gid}: ${id} 锚点 \`${sym}\` 在 ${gid}/src 下 .ts 零命中（声称与实现脱节，K-035）`);
      }
    }
  }
}

if (checkedGames === 0) {
  console.log('STATUS: SKIP');
  console.log('check:a11y —— 未找到任何 games/*/art/accessibility.md，无可检面对象');
  process.exit(0);
}

if (errors.length) {
  console.log(`❌ check:a11y FAILED（${errors.length}）`);
  for (const e of errors) console.log(`  - ${e}`);
  console.log('STATUS: FAIL');
  process.exit(1);
}
console.log(`✅ check:a11y OK —— ${checkedGames} 个游戏的锚点全部在 src 命中（✅ 行均有非空锚点）`);
console.log('STATUS: OK');
