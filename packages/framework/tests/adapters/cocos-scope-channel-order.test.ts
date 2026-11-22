/**
 * `[WXG-T-1028]` Cocos 宿主两层工厂的**真节点顺序静态门**。
 *
 * `bindings.ts` 因 import `cc` 被 Node 测试排除（文件头明禁直接 import）⇒ 用源码级断言把
 * `_createScope` / `_createClip` 的 `addChild` 顺序钉死到 {@link UI_SCOPE_CHANNEL_ORDER}，
 * 防止两处真源再次漂移（T-1026 起 `_createScope` 就把 blit 排在 graphics 之后 ⇒ 木牌盖掉
 * 程序化关闭叉，2026-11-22 用户实测四项缺失）。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UI_SCOPE_CHANNEL_ORDER } from '../../src/adapters/cocos/ui-scope-tree.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(resolve(ROOT, 'src/adapters/cocos/bindings.ts'), 'utf8');

/**
 * 从一个方法体里抽出所有 `addChild` 的 Node 名，按出现序。
 * 兼容两种写法：`addChild(new Node('X'))` 与 `const v = new Node('X'); addChild(v)`。
 */
function childOrder(method: string): string[] {
  const start = src.indexOf(`private ${method}(`);
  if (start < 0) throw new Error(`找不到方法 ${method}`);
  const body = src.slice(start, src.indexOf('\n  }', start));
  const varToName = new Map<string, string>();
  const decl = /const\s+(\w+)\s*=\s*new Node\('([^']+)'\)/g;
  for (let m = decl.exec(body); m; m = decl.exec(body)) varToName.set(m[1]!, m[2]!);
  const names: string[] = [];
  const inline = /addChild\(new Node\('([^']+)'\)\)/g;
  for (let m = inline.exec(body); m; m = inline.exec(body)) names.push(m[1]!);
  const viaVar = /addChild\((\w+)\)/g;
  for (let m = viaVar.exec(body); m; m = viaVar.exec(body)) {
    const name = varToName.get(m[1]!);
    if (name) names.push(name);
  }
  return names;
}

const CANONICAL = ['BlitLayerUI', 'Graphics', 'Labels', 'Segments'];

describe('Cocos 容器通道层序（真源 = UI_SCOPE_CHANNEL_ORDER）', () => {
  it('顺序常量 = blit → graphics → labels → segments', () => {
    expect(UI_SCOPE_CHANNEL_ORDER).toEqual(['blit', 'graphics', 'labels', 'segments']);
  });

  it('_createScope：位图腿在矢量 Graphics 之前（否则木牌盖掉程序化关闭叉）', () => {
    expect(childOrder('_createScope')).toEqual(CANONICAL);
  });

  it('_createClip：与 _createScope 同序（两处真源不得漂移）', () => {
    expect(childOrder('_createClip')).toEqual(CANONICAL);
  });
});
