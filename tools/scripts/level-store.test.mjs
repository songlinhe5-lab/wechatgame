// level-store 单测（关卡内容管线 P2）：uid 续号、order 追加、contentVersion++、数字 id 跳 plate cells。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assignUid, nextNumericId, appendEntry } from './level-store.mjs';

test('assignUid 取该 kind 现有最大号 +1', () => {
  assert.equal(assignUid('single', new Set(['L0001', 'L0009'])), 'L0010');
  assert.equal(assignUid('plate', new Set(['P0003'])), 'P0004');
  assert.equal(assignUid('single', new Set()), 'L0001');
  assert.equal(assignUid('plate', new Set(['L0001', 'L0002'])), 'P0001'); // 混集只认 P
  assert.equal(assignUid('single', new Set(['L9999'])), 'L10000'); // >9999 不回绕
  assert.equal(assignUid('single', new Set(['L10000'])), 'L10001'); // 宽号仍参与取最大
});

test('appendEntry 只追加、order 续、contentVersion++、老 entry 不动', () => {
  const m = {
    contentVersion: 3,
    entries: [{ uid: 'L0001', kind: 'single', file: 'singles/L0001.json', pack: 'main', order: 1 }],
  };
  Object.freeze(m.entries[0]); // 冻结老 entry：appendEntry 若 in-place mutate 会抛（strict）
  const n = appendEntry(m, { uid: 'L0002', kind: 'single', file: 'singles/L0002.json', pack: 'main' });
  assert.equal(n.entries.length, 2);
  assert.equal(n.entries[1].order, 2);
  assert.equal(n.contentVersion, 4);
  assert.equal(n.entries[0].order, 1); // 老 entry 未被改动
  assert.equal(m.contentVersion, 3); // 入参未被 mutate
});

test('nextNumericId 取 single.id 与 plate cell.id 全局最大 +1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lvstore-'));
  try {
    mkdirSync(join(dir, 'singles'), { recursive: true });
    mkdirSync(join(dir, 'plates'), { recursive: true });
    writeFileSync(join(dir, 'singles/L0001.json'), JSON.stringify({ id: 1 }));
    writeFileSync(join(dir, 'plates/P0001.json'), JSON.stringify({ cells: [{ id: 7 }, { id: 9 }] }));
    const manifest = {
      entries: [
        { uid: 'L0001', kind: 'single', file: 'singles/L0001.json' },
        { uid: 'P0001', kind: 'plate', file: 'plates/P0001.json' },
      ],
    };
    assert.equal(nextNumericId(dir, manifest), 10);
    assert.equal(nextNumericId(dir, { entries: [] }), 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
