// chapter-store 单测（WXG-T-341）：章成员增删调序、boss 锁位、章序交换（open 留位）、
// id 轴重编号、DEMO_LEVEL_COUNT 联动。跑法：node --test tools/scripts/chapter-store.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  chapterFile, insertBeforeBoss, removeFromLevels, moveInChapter, swapToEnd,
  setEntryKind, removeEntryByUid, addChapterTo, removeChapterFrom, moveChapter,
  expandEntriesWithIds, expandedCount, renumberIds, syncDemoLevelCount,
} from './chapter-store.mjs';

test('insertBeforeBoss：插末项（boss）之前；空章 ⇒ 唯一成员；已存在 ⇒ throw', () => {
  assert.deepEqual(insertBeforeBoss(['L1', 'L2', 'L9'], 'L3'), ['L1', 'L2', 'L3', 'L9']);
  assert.deepEqual(insertBeforeBoss([], 'L1'), ['L1']);
  assert.throws(() => insertBeforeBoss(['L1', 'L9'], 'L1'), /已在该章内/);
  // 入参不被 mutate
  const src = ['L1', 'L9'];
  insertBeforeBoss(src, 'L2');
  assert.deepEqual(src, ['L1', 'L9']);
});

test('removeFromLevels：移除；不在 ⇒ throw', () => {
  assert.deepEqual(removeFromLevels(['L1', 'L2', 'L9'], 'L2'), ['L1', 'L9']);
  assert.throws(() => removeFromLevels(['L1'], 'L2'), /不在该章内/);
});

test('moveInChapter：末位（boss）锁死，移动永不涉及末位', () => {
  assert.deepEqual(moveInChapter(['L1', 'L2', 'L3', 'L9'], 'L2', 'down'), ['L1', 'L3', 'L2', 'L9']);
  assert.deepEqual(moveInChapter(['L1', 'L2', 'L3', 'L9'], 'L3', 'up'), ['L1', 'L3', 'L2', 'L9']);
  assert.throws(() => moveInChapter(['L1', 'L2', 'L9'], 'L9', 'up'), /boss 恒为章内末位/);
  assert.throws(() => moveInChapter(['L1', 'L2', 'L9'], 'L2', 'down'), /不可与 boss 交换位置/);
  assert.throws(() => moveInChapter(['L1', 'L2', 'L9'], 'L1', 'up'), /已到边界/);
  assert.throws(() => moveInChapter(['L1', 'L9'], 'L1', 'sideways'), /dir 只允 up\|down/);
});

test('swapToEnd：与末项交换（设为 boss 的位置步）；已是末项 ⇒ 原样', () => {
  assert.deepEqual(swapToEnd(['L1', 'L2', 'L3', 'L9'], 'L2'), ['L1', 'L9', 'L3', 'L2']);
  assert.deepEqual(swapToEnd(['L1', 'L9'], 'L9'), ['L1', 'L9']);
});

test('setEntryKind / removeEntryByUid：不可变返回新对象', () => {
  const m = {
    contentVersion: 1,
    entries: [
      { uid: 'L1', kind: 'single', file: 'singles/L1.json', pack: 'main', order: 1 },
      { uid: 'L9', kind: 'boss', file: 'singles/L9.json', pack: 'main', order: 9 },
    ],
  };
  Object.freeze(m.entries[0]);
  const k = setEntryKind(m, 'L1', 'boss');
  assert.equal(k.entries[0].kind, 'boss');
  assert.equal(m.entries[0].kind, 'single'); // 入参未变
  const r = removeEntryByUid(k, 'L9');
  assert.equal(r.entries.length, 1);
  assert.throws(() => setEntryKind(m, 'L404', 'single'), /不在 manifest/);
});

test('boss 改标原子用法：swapToEnd + setEntryKind 双键 → 恰 1 boss 且末项', () => {
  const m = {
    contentVersion: 1,
    entries: [
      { uid: 'L1', kind: 'single', file: 'singles/L1.json', pack: 'main', order: 1 },
      { uid: 'L2', kind: 'single', file: 'singles/L2.json', pack: 'main', order: 2 },
      { uid: 'L9', kind: 'boss', file: 'singles/L9.json', pack: 'main', order: 3 },
    ],
  };
  const levels = ['L1', 'L2', 'L9'];
  // 把 L2 设为 boss：位置交换 + 双 kind 原子改
  const nl = swapToEnd(levels, 'L2');
  const nm = setEntryKind(setEntryKind(m, 'L2', 'boss'), 'L9', 'single');
  assert.deepEqual(nl, ['L1', 'L9', 'L2']);
  assert.equal(nm.entries.find((e) => e.kind === 'boss').uid, 'L2');
  assert.equal(nl.at(-1), 'L2'); // boss == 末项
});

test('addChapterTo / removeChapterFrom：order=max+1、file 派生、不可变', () => {
  const m = { contentVersion: 5, entries: [], chapters: [{ id: 'mandala', file: 'chapters/mandala.json', order: 1, open: true }] };
  Object.freeze(m.chapters[0]);
  const n = addChapterTo(m, { id: 'neon' });
  assert.deepEqual(n.chapters[1], { id: 'neon', file: chapterFile('neon'), order: 2, open: false });
  assert.equal(n.chapters[0].order, 1);
  assert.equal(m.chapters.length, 1); // 入参未变
  const r = removeChapterFrom(n, 'mandala');
  assert.deepEqual(r.chapters.map((c) => c.id), ['neon']);
  assert.throws(() => removeChapterFrom(n, 'ghost'), /不在 manifest/);
});

test('moveChapter：只换 id/file，open 留在位置（前缀封闭）；边界 throw', () => {
  const m = {
    contentVersion: 1,
    entries: [],
    chapters: [
      { id: 'a', file: 'chapters/a.json', order: 1, open: true },
      { id: 'b', file: 'chapters/b.json', order: 2, open: false },
    ],
  };
  const n = moveChapter(m, 'b', 'up');
  // b 上移：位 1 处是 b（file 同步换），open 仍是位置语义（位 1 = true）
  assert.deepEqual(n.chapters[0], { id: 'b', file: 'chapters/b.json', order: 1, open: true });
  assert.deepEqual(n.chapters[1], { id: 'a', file: 'chapters/a.json', order: 2, open: false });
  assert.throws(() => moveChapter(m, 'a', 'up'), /已到边界/);
  assert.throws(() => moveChapter(m, 'b', 'down'), /已到边界/);
  // 'a' 在首位 down 是合法换位（非边界）——边界只在两端同侧越出时命中
  assert.deepEqual(moveChapter(m, 'a', 'down').chapters[1].id, 'a');
});

// ── id 轴：展开 + 重编号（IO，mkdtemp 实测） ────────────────────────────────

function makeTree() {
  const dir = mkdtempSync(join(tmpdir(), 'chstore-'));
  mkdirSync(join(dir, 'singles'), { recursive: true });
  mkdirSync(join(dir, 'plates'), { recursive: true });
  return dir;
}

test('expandEntriesWithIds：order 序展开、plate 占多槽、退役跳过', () => {
  const dir = makeTree();
  try {
    writeFileSync(join(dir, 'singles/L1.json'), JSON.stringify({ id: 1 }));
    writeFileSync(join(dir, 'plates/P1.json'), JSON.stringify({ cells: [{ id: 2 }, { id: 3 }] }));
    writeFileSync(join(dir, 'singles/L9.json'), JSON.stringify({ id: 4 }));
    const manifest = {
      entries: [
        { uid: 'L9', kind: 'boss', file: 'singles/L9.json', pack: 'main', order: 4 },
        { uid: 'L1', kind: 'single', file: 'singles/L1.json', pack: 'main', order: 1 },
        { uid: 'P1', kind: 'plate', file: 'plates/P1.json', pack: 'main', order: 2 },
        { uid: 'L0', kind: 'single', file: 'singles/gone.json', pack: 'main', order: 3, retired: true },
      ],
    };
    const ex = expandEntriesWithIds(dir, manifest);
    assert.deepEqual(ex.map((e) => [e.uid, e.slots]), [['L1', 1], ['P1', 2], ['L9', 1]]);
    assert.deepEqual(ex[1].ids, [2, 3]);
    assert.equal(expandedCount(dir, manifest), 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('renumberIds：删除中间关后其后 id 前移；只返回变化项；格式与 writeLevelFile 同', () => {
  const dir = makeTree();
  try {
    // 删掉 order=2 的关后：原 id 1,3,4,5 ⇒ 应为 1,2,3,4
    writeFileSync(join(dir, 'singles/L1.json'), JSON.stringify({ id: 1, name: 'a' }, null, 2) + '\n');
    writeFileSync(join(dir, 'singles/L3.json'), JSON.stringify({ id: 3, name: 'c' }, null, 2) + '\n');
    writeFileSync(join(dir, 'plates/P5.json'), JSON.stringify({ cells: [{ id: 4 }, { id: 5 }] }, null, 2) + '\n');
    const manifest = {
      entries: [
        { uid: 'L1', kind: 'single', file: 'singles/L1.json', pack: 'main', order: 1 },
        { uid: 'L3', kind: 'single', file: 'singles/L3.json', pack: 'main', order: 3 },
        { uid: 'P5', kind: 'plate', file: 'plates/P5.json', pack: 'main', order: 4 },
      ],
    };
    const changed = renumberIds(dir, manifest);
    assert.deepEqual(changed.map((c) => c.file).sort(), ['plates/P5.json', 'singles/L3.json']); // L1 未变不写
    const l3 = changed.find((c) => c.file === 'singles/L3.json');
    assert.equal(JSON.parse(l3.content).id, 2);
    assert.ok(l3.content.endsWith('\n')); // 尾换行（diff 稳）
    const p5 = changed.find((c) => c.file === 'plates/P5.json');
    assert.deepEqual(JSON.parse(p5.content).cells.map((c) => c.id), [3, 4]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('renumberIds：全对齐 ⇒ 零变化（no-op 不产 diff）', () => {
  const dir = makeTree();
  try {
    writeFileSync(join(dir, 'singles/L1.json'), JSON.stringify({ id: 1 }) + '\n');
    writeFileSync(join(dir, 'singles/L2.json'), JSON.stringify({ id: 2 }) + '\n');
    const manifest = {
      entries: [
        { uid: 'L1', kind: 'single', file: 'singles/L1.json', pack: 'main', order: 1 },
        { uid: 'L2', kind: 'boss', file: 'singles/L2.json', pack: 'main', order: 2 },
      ],
    };
    assert.deepEqual(renumberIds(dir, manifest), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── DEMO_LEVEL_COUNT 联动 ───────────────────────────────────────────────────

test('syncDemoLevelCount：替换数字、其余行不动；缺声明 ⇒ throw', () => {
  const src = 'export const A = 1;\nexport const DEMO_LEVEL_COUNT = 9; // 门禁⑤\nexport const B = 2;\n';
  const out = syncDemoLevelCount(src, 10);
  assert.ok(out.includes('export const DEMO_LEVEL_COUNT = 10; // 门禁⑤'));
  assert.ok(out.includes('export const A = 1;'));
  assert.equal(syncDemoLevelCount(src, 9), src); // 同值 ⇒ 逐字节同（no-op 不产 diff）
  assert.throws(() => syncDemoLevelCount('export const X = 1;', 3), /缺 DEMO_LEVEL_COUNT/);
});