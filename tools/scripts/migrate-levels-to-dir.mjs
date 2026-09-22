#!/usr/bin/env node
/**
 * migrate-levels-to-dir.mjs — 一次性：把 beads 关卡单文件真源
 * `design/levels/levels-01-08.json` 拆成目录化真源（manifest.json + palette.json
 * + singles/ + plates/），供 sync 的「目录模式」装配（关卡内容管线 P1，WXG-T-185）。
 *
 * 关键纪律：
 *   · 每个 singles/L00NN.json = 原 levels[i] **逐字段原样**（JSON.parse 保键序），
 *     **不注入 uid** ⇒ 装配出的 LEVELS_DATA 数据体逐字节不变（零行为漂移）。
 *   · uid 只活在 manifest（entry.uid ↔ file ↔ order），作内容层稳定标识。
 *   · 幂等：重复跑覆盖同名产物（迁移期可反复调）；不删旧 json（删除在 P1 Task 4）。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../games/beads/design/levels');
const src = JSON.parse(readFileSync(join(dir, 'levels-01-08.json'), 'utf8'));
const uid = (id) => 'L' + String(id).padStart(4, '0');

mkdirSync(join(dir, 'singles'), { recursive: true });
mkdirSync(join(dir, 'plates'), { recursive: true });

writeFileSync(join(dir, 'palette.json'), JSON.stringify({ palette: src.palette }, null, 2) + '\n');
for (const lv of src.levels) {
  writeFileSync(join(dir, 'singles', `${uid(lv.id)}.json`), JSON.stringify(lv, null, 2) + '\n');
}

const manifest = {
  schemaVersion: src.version, // → LEVELS_DATA.version（保持 2）
  contentVersion: 1, // 增量计数（P2/B 用）
  gameId: src.gameId,
  description: src.description,
  paletteFile: 'palette.json',
  entries: src.levels.map((lv, i) => ({
    uid: uid(lv.id),
    kind: 'single',
    file: `singles/${uid(lv.id)}.json`,
    pack: 'main',
    order: i + 1,
  })),
};
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(
  join(dir, 'plates', 'README.md'),
  '# 组合图（Plate）真源占位\n\nP2 由 studio 均分切块产出（`kind:"plate"`，一 Plate 一文件含 cells[]）；P1 无 Plate 数据。\n',
);

console.log(`迁移完成：${src.levels.length} 关 → singles/ ；palette.json ；manifest.json`);
