#!/usr/bin/env node
/**
 * level-store.mjs — manifest 读写 + uid 分配 + 关卡落盘对象构造（关卡内容管线 P2，spec §1/§5）。
 * 构造类为纯函数（无副作用）；write* 为薄 IO。server.mjs 的 ingestLevel 编排调用。
 *
 * 纪律：appendEntry 只追加、不改老 entry（返回新对象）；uid 稳定字符串只进 manifest/文件名，
 * 关卡对象本身仍带唯一数字 id（运行时/存档语义，见 spec §1.2）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function readManifest(levelsDir) {
  return JSON.parse(readFileSync(join(levelsDir, 'manifest.json'), 'utf8'));
}

/** 现有 uid 集（manifest entries）。 */
export function existingUids(manifest) {
  return new Set(manifest.entries.map((e) => e.uid));
}

/** kind→前缀（single=L / plate=P）：取该前缀现有最大号 +1，零填充 4。 */
export function assignUid(kind, uids) {
  const p = kind === 'plate' ? 'P' : 'L';
  let max = 0;
  for (const u of uids) {
    const m = /^([LP])(\d{4})$/.exec(u);
    if (m && m[1] === p) max = Math.max(max, Number(m[2]));
  }
  return p + String(max + 1).padStart(4, '0');
}

/** 下一个数字 id：扫 manifest 各 file（single→obj.id；plate→max(cell.id)）取全局最大 +1。 */
export function nextNumericId(levelsDir, manifest) {
  let max = 0;
  for (const e of manifest.entries) {
    const obj = JSON.parse(readFileSync(join(levelsDir, e.file), 'utf8'));
    if (e.kind === 'plate') for (const c of obj.cells) max = Math.max(max, c.id ?? 0);
    else max = Math.max(max, obj.id ?? 0);
  }
  return max + 1;
}

export function buildPlateFile({ plateUid, name, gridCols, gridRows, cells }) {
  return { plateUid, name, gridCols, gridRows, cells };
}

/** 追加 entry：order = max+1、contentVersion++；老 entry 原样（返回新对象，不改入参）。 */
export function appendEntry(manifest, entry) {
  const order = manifest.entries.reduce((m, e) => Math.max(m, e.order), 0) + 1;
  return {
    ...manifest,
    contentVersion: manifest.contentVersion + 1,
    entries: [...manifest.entries, { ...entry, order }],
  };
}

export function writeLevelFile(levelsDir, relFile, obj) {
  writeFileSync(join(levelsDir, relFile), JSON.stringify(obj, null, 2) + '\n');
}

export function writeManifest(levelsDir, manifest) {
  writeFileSync(join(levelsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}
