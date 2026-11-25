// A01 试点 · 批量计算候选珠面的真实档位（difficultyOf 单一真源，⛔ 不复刻公式）。
// 用法（仓根）：node --experimental-transform-types \
//   --import=./games/beads/design/forensics/g3/g3-hooks.mjs \
//   games/beads/design/art/proposals/levels-20arcs-selection-20261117/pilot-a01-difficulty-20261125/tier-all.ts
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { difficultyOf } from '../../../../../src/game/difficulty.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'evidence');

const rows: string[] = [];
for (const f of readdirSync(OUT).filter((x) => x.endsWith('-response.json')).sort()) {
    const r = JSON.parse(readFileSync(join(OUT, f), 'utf8'));
    const ld = r.levelDraft;
    const d = difficultyOf({ pattern: ld.pattern, misplaced: ld.misplaced, swaps: ld.swaps ?? [] });
    const tag = f.slice(0, 3).toUpperCase();
    const base = Number(f.split('-b')[1].split('-')[0]);
    rows.push(`${tag} b${base} N=${d.n} C=${d.c} G=${d.g[0]} tier=${d.tier}(${d.label}) DI=${d.di}`);
}
console.log(rows.sort().join('\n'));
