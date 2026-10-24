#!/usr/bin/env node
/**
 * chapter-store.mjs — 大关（chapter）真源操作库（WXG-T-341，收 level-content-pipeline §11.9 挂出项）。
 *
 * 定位：studio 管理页的**纯逻辑半边**——章/成员的增删调序、boss 改标、id 轴重编号、
 * DEMO_LEVEL_COUNT 联动文本替换。编排（快照/回滚/sync）在 `apps/beads-studio/server.mjs`。
 *
 * ── 两条轴（模型，与 sync 断言全集对齐）─────────────────────────────────────
 *   ① 展示轴 = 章文件 `levels[]` 的**数组顺序**（章序 × 章内序）——墙上/走马灯按它铺。
 *      任意顺序都合法：`uidSlotsToLevelRefs` 对非连续装配段分段合并（sync 不报红）。
 *   ② id 轴 = `manifest.entries[].order` 升序展开的装配下标 + 1（sync 轴对齐断言
 *      `lv.id === i+1`）。**只有「加/删 entry」会动它** ⇒ 删除后必须整体重编号（renumberIds）。
 *   两者解耦是有意的：调序/移章只动轴①（局部、diff 小、id 稳定）；插入恒 append（order=max+1，
 *   新关 id = 末尾）；删除动轴②（其后所有关 id 前移）。
 *
 * ── 不变式（调用方保证，sync 兜底）──────────────────────────────────────────
 *   · 章内恒有且仅有一个 boss（entry.kind），且恒为 `levels[]` **末项**（sync 断言 3/4）
 *   · 章非空（断言 2）；未退役 entry 必须被某章覆盖（断言「覆盖完备」）
 *   · `open:true` 自章序最小起连续成前缀；moveChapter 只换 id/file、**open 留在位置** ⇒
 *     前缀对「删除」与「位序交换」均封闭，永不破（断言 7 的充分性由此免维护）
 *
 * 构造类为纯函数（无副作用，返回新对象不改入参）；read/write/renumber 为薄 IO。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CHAPTERS_DIR = 'chapters';

// ───────────────────────────────────────────── 章文档（chapter JSON） ──────

/** 章文件相对路径（与 sync 断言「file 与 id 成对」同源，⛔ 不另行拼）。 */
export function chapterFile(id) {
  return `${CHAPTERS_DIR}/${id}.json`;
}

export function readChapter(levelsDir, file) {
  return JSON.parse(readFileSync(join(levelsDir, file), 'utf8'));
}

export function writeChapter(levelsDir, file, doc) {
  writeFileSync(join(levelsDir, file), JSON.stringify(doc, null, 2) + '\n');
}

/** 全部章文档：Map(章 id → doc)。manifest.chapters 为真源，文件缺失交给 sync 断言报红。 */
export function loadChapterMap(levelsDir, manifest) {
  const map = new Map();
  for (const c of manifest.chapters ?? []) {
    map.set(c.id, readChapter(levelsDir, c.file));
  }
  return map;
}

// ───────────────────────────────────────────── 章内成员（levels[]）操作 ─────

/** 插到 boss 前（= 末项前）。新章首关（空章）⇒ 唯一成员即 boss，由调用方保证 kind。 */
export function insertBeforeBoss(levels, uid) {
  if (levels.includes(uid)) throw new Error(`${uid} 已在该章内`);
  if (levels.length === 0) return [uid];
  return [...levels.slice(0, -1), uid, levels[levels.length - 1]];
}

export function removeFromLevels(levels, uid) {
  if (!levels.includes(uid)) throw new Error(`${uid} 不在该章内`);
  return levels.filter((u) => u !== uid);
}

/** 章内上/下移：**末项（boss）锁死**——移动永不涉及末位（否则 boss 脱离末项，断言即红）。 */
export function moveInChapter(levels, uid, dir) {
  const i = levels.indexOf(uid);
  if (i < 0) throw new Error(`${uid} 不在该章内`);
  if (i === levels.length - 1) throw new Error('boss 恒为章内末位，不可移动');
  if (dir !== 'up' && dir !== 'down') throw new Error(`dir 只允 up|down，收到 ${dir}`);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0) throw new Error('已到边界');
  if (j === levels.length - 1) throw new Error('不可与 boss 交换位置（boss 恒为章内末位）');
  const out = [...levels];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/**
 * 章内移到指定下标（拖拽落点）：`to` = 移动后 uid 所在位置。
 * 约束与 `moveInChapter` 同源 —— **boss 锁末位**，故 `to` 只允许 `[0, len - 2]`：
 * 落到末位等于把 boss 顶掉，落到末位之后更是越界。
 */
export function moveInChapterTo(levels, uid, to) {
  const i = levels.indexOf(uid);
  if (i < 0) throw new Error(`${uid} 不在该章内`);
  if (i === levels.length - 1) throw new Error('boss 恒为章内末位，不可移动');
  const max = levels.length - 2;
  if (!Number.isInteger(to) || to < 0 || to > max) {
    throw new Error(`目标位置需 0–${max}（boss 恒为章内末位），收到 ${to}`);
  }
  const out = levels.filter((u) => u !== uid);
  out.splice(to, 0, uid);
  return out;
}

/** 与末项交换位置（「设为 boss」的第一步；kind 由调用方 setEntryKind 同步原子改）。 */
export function swapToEnd(levels, uid) {
  const i = levels.indexOf(uid);
  if (i < 0) throw new Error(`${uid} 不在该章内`);
  const out = [...levels];
  const last = out.length - 1;
  [out[i], out[last]] = [out[last], out[i]];
  return out;
}

// ───────────────────────────────────────────── manifest 结构操作（纯） ──────

export function setEntryKind(manifest, uid, kind) {
  if (!manifest.entries.some((e) => e.uid === uid)) throw new Error(`uid ${uid} 不在 manifest`);
  return { ...manifest, entries: manifest.entries.map((e) => (e.uid === uid ? { ...e, kind } : e)) };
}

export function removeEntryByUid(manifest, uid) {
  if (!manifest.entries.some((e) => e.uid === uid)) throw new Error(`uid ${uid} 不在 manifest`);
  return { ...manifest, entries: manifest.entries.filter((e) => e.uid !== uid) };
}

/** 追加章（order = max+1、open 默认 false）。file 恒派生 ⇒ 不与 id 脱对。 */
export function addChapterTo(manifest, { id, open = false }) {
  const chapters = manifest.chapters ?? [];
  const order = chapters.reduce((m, c) => Math.max(m, c.order), 0) + 1;
  return { ...manifest, chapters: [...chapters, { id, file: chapterFile(id), order, open }] };
}

export function removeChapterFrom(manifest, id) {
  if (!(manifest.chapters ?? []).some((c) => c.id === id)) throw new Error(`章 ${id} 不在 manifest`);
  return { ...manifest, chapters: manifest.chapters.filter((c) => c.id !== id) };
}

/**
 * 章序上/下移：交换相邻两章的 **id/file**（order 值留在原位）⇒ 数组顺序恒 = order 序；
 * `open` 留在位置（「前 N 章开放」是位置语义）⇒ open 前缀对交换封闭，永不破。
 */
export function moveChapter(manifest, id, dir) {
  const chapters = [...(manifest.chapters ?? [])].sort((a, b) => a.order - b.order);
  const i = chapters.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`章 ${id} 不在 manifest`);
  if (dir !== 'up' && dir !== 'down') throw new Error(`dir 只允 up|down，收到 ${dir}`);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= chapters.length) throw new Error('已到边界');
  const a = chapters[i];
  const b = chapters[j];
  chapters[i] = { ...a, id: b.id, file: b.file };
  chapters[j] = { ...b, id: a.id, file: a.file };
  return { ...manifest, chapters };
}

// ───────────────────────────────────────────── id 轴：展开 + 重编号 ─────────

/**
 * 按 order 序展开装配（与 sync 装配内核同口径：退役跳过、plate 按 cell 数占多槽），
 * 计算每 entry 的应有 id 区间。返回 [{uid, file, kind, slots, ids[]}]——**唯一**的
 * 「uid → id 轴」换算来源（server 的 DEMO 计数与重编号共用它，⛔ 不第二遍重数）。
 */
export function expandEntriesWithIds(levelsDir, manifest) {
  const entries = [...manifest.entries].sort((a, b) => a.order - b.order);
  const out = [];
  let id = 1;
  for (const e of entries) {
    if (e.retired) continue;
    const obj = JSON.parse(readFileSync(join(levelsDir, e.file), 'utf8'));
    const slots = e.kind === 'plate' ? (obj.cells ?? []).length : 1;
    const ids = [];
    for (let i = 0; i < slots; i++) ids.push(id++);
    out.push({ uid: e.uid, file: e.file, kind: e.kind, slots, ids });
  }
  return out;
}

/** 当前关数（= 产物 levels.length；门禁⑤ 的右端）。 */
export function expandedCount(levelsDir, manifest) {
  return expandEntriesWithIds(levelsDir, manifest).reduce((n, e) => n + e.slots, 0);
}

/**
 * id 轴重编号：按装配序写回每条 entry 的关卡 id（single→obj.id；plate→cells[i].id）。
 * **只算不写**——返回 [{file, content}] 仅含变化项（server 在同一事务里写盘）。
 * JSON 序列化格式与 `writeLevelFile` 恒同（2 空格缩进 + 尾换行）⇒ round-trip 无损。
 */
export function renumberIds(levelsDir, manifest) {
  const changed = [];
  for (const e of expandEntriesWithIds(levelsDir, manifest)) {
    const obj = JSON.parse(readFileSync(join(levelsDir, e.file), 'utf8'));
    let dirty = false;
    if (e.kind === 'plate') {
      (obj.cells ?? []).forEach((c, i) => {
        if (c.id !== e.ids[i]) { c.id = e.ids[i]; dirty = true; }
      });
    } else if (obj.id !== e.ids[0]) {
      obj.id = e.ids[0];
      dirty = true;
    }
    if (dirty) changed.push({ file: e.file, content: JSON.stringify(obj, null, 2) + '\n' });
  }
  return changed;
}

// ───────────────────────────────────────────── DEMO_LEVEL_COUNT 联动 ─────────

/** 门禁⑤ 常量同步：替换 `export const DEMO_LEVEL_COUNT = N` 的数字（纯文本变换）。 */
export function syncDemoLevelCount(src, n) {
  const re = /(export const DEMO_LEVEL_COUNT = )\d+/;
  if (!re.test(src)) throw new Error('tuning 源码缺 DEMO_LEVEL_COUNT 声明（门禁⑤ 无法联动）');
  return src.replace(re, `$1${n}`);
}