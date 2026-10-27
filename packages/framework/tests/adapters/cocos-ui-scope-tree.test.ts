/**
 * UI-60 P1（可证部分）· 容器 × 段层树的**引擎无关**内核
 * （正本 = `docs/architecture/adr/ADR-0033-ui-container-layer-ordering.md` DEC-1…4 / DEC-9）。
 *
 * 为什么单独立一个内核：`bindings.ts` 的 cc 腿只能由设备证，而「层怎么排、什么时候建、
 * 越界怎么办」这四条规则可以在 Node 里逐条钉死 ⇒ cc 侧只剩工厂薄壳。
 *
 * 钉死的规则：
 *  ① **懒建**：`enter` 不等于建层，只有真落笔（读 `current`）才建 ⇒ 与 `lastScopeCount`
 *     同口径，⛔ 不得按预估虚报 draw call（DEC-3 / 用户 Q2）；
 *  ② **容器序 = 出现序**（栈自下而上），**段序 = `UI_SEGMENT_ORDER` 枚举序**（不是绘制先后）；
 *  ③ 段作用域挂在容器作用域**之下**（父子，不是平铺兄弟）；
 *  ④ 越界与不配对不崩、不误建层（未进容器就开段 ⇒ 忽略；空栈退出 ⇒ no-op）。
 */

import { describe, expect, it } from 'vitest';
import {
  UI_DEBUG_SCOPE_ID,
  UI_SCOPE_TOP_MOST_SIBLING,
  UiScopeTree,
  type UiScopeTreeHooks,
} from '../../src/adapters/cocos/ui-scope-tree.js';
import type { CocosGraphicsLike, CocosLabelSource, CocosUiScopeLike } from '../../src/adapters/cocos/cocos-renderer.js';
import type { UiScopeChannels } from '../../src/adapters/cocos/ui-scope-tree.js';

interface Created {
  key: string;
  parent: string;
  sibling: number;
  clears: number;
  releases: number;
}

/** 记一笔所有被建出来的作用域；`parent` 用可读字符串而非节点对象，方便逐条断言拓扑。 */
function makeTree(extra: Partial<UiScopeTreeHooks> = {}) {
  const created: Created[] = [];
  const nodeKey = new Map<unknown, string>();
  const stats = { defaultClears: 0, defaultReleases: 0 };
  const defaultGraphics = { clear: () => { stats.defaultClears += 1; } } as unknown as CocosGraphicsLike;
  const defaultLabels = {
    acquire: () => { throw new Error('unused'); },
    releaseAll: () => { stats.defaultReleases += 1; },
  } as unknown as CocosLabelSource;
  const root = { name: 'root' };
  const defaultBlitParent = { name: 'blit-ui' };
  const defaultScope: CocosUiScopeLike = { graphics: defaultGraphics, labels: defaultLabels };

  const hooks: UiScopeTreeHooks = {
    root,
    defaultScope,
    defaultBlitParent,
    create: (key, parent, sibling): UiScopeChannels => {
      const rec: Created = { key, parent: nodeKey.get(parent) ?? String(parent), sibling, clears: 0, releases: 0 };
      created.push(rec);
      const handle = { name: key };
      nodeKey.set(handle, key);
      return {
        handle,
        blitParent: handle,
        graphics: { clear: () => { rec.clears += 1; } } as unknown as CocosGraphicsLike,
        labels: { acquire: () => { throw new Error('unused'); }, releaseAll: () => { rec.releases += 1; } } as unknown as CocosLabelSource,
      };
    },
    ...extra,
  };
  const tree = new UiScopeTree(hooks);
  nodeKey.set(root, 'root');
  nodeKey.set(defaultBlitParent, 'blit-ui');
  return { tree, created, stats, defaultScope, defaultBlitParent };
}

describe('UI-60 P1 — 层树内核', () => {
  it('未发层级命令 ⇒ 当前层就是旧那两个提交体，一个节点也不建', () => {
    const { tree, created } = makeTree();
    tree.beginFrame();
    expect(tree.current).toBe(tree.defaultScope);
    expect(tree.blitParent).toBeDefined();
    expect(created).toHaveLength(0);
  });

  it('懒建：只 enter 容器未落笔（不读 current）⇒ 不建层，与 lastScopeCount 同口径', () => {
    const { tree, created } = makeTree();
    tree.beginFrame();
    tree.enterContainer('menu');
    tree.enterSegment('hud');
    tree.exitSegment();
    tree.exitContainer();
    expect(created).toHaveLength(0);
    expect(tree.current).toBe(tree.defaultScope);
  });

  it('落笔才建，且同帧重复读复用同一作用域（⛔ 每命令建节点）', () => {
    const { tree, created } = makeTree();
    tree.beginFrame();
    tree.enterContainer('menu');
    const a = tree.current;
    const b = tree.current;
    expect(a).toBe(b);
    expect(created).toHaveLength(1);
    expect(created[0]!.key).toBe('menu');
  });

  it('容器序 = 出现序（栈自下而上），父节点都是 UI 根', () => {
    const { tree, created } = makeTree();
    tree.beginFrame();
    tree.enterContainer('menu'); void tree.current; tree.exitContainer();
    tree.enterContainer('play'); void tree.current; tree.exitContainer();
    expect(created.map((c) => [c.key, c.parent, c.sibling])).toEqual([
      ['menu', 'root', 0],
      ['play', 'root', 1],
    ]);
  });

  it('段序 = UI_SEGMENT_ORDER 枚举序，不是绘制先后；且段挂在容器之下', () => {
    const { tree, created } = makeTree();
    tree.beginFrame();
    tree.enterContainer('menu');
    tree.enterSegment('toast'); void tree.current; tree.exitSegment();
    tree.enterSegment('page'); void tree.current; tree.exitSegment();
    tree.enterSegment('modal'); void tree.current; tree.exitSegment();
    tree.exitContainer();
    const byKey = new Map(created.map((c) => [c.key, c]));
    expect(byKey.get('menu·modal')!.sibling).toBe(2);
    expect(byKey.get('menu·page')!.sibling).toBe(0);
    expect(byKey.get('menu·toast')!.sibling).toBe(3);
    // 三个段都挂在容器作用域下（父子），容器作用域自己是 root 的第 0 个子
    expect(byKey.get('menu·modal')!.parent).toBe('menu');
    expect(byKey.get('menu·page')!.parent).toBe('menu');
    expect(byKey.get('menu·toast')!.parent).toBe('menu');
    expect(byKey.get('menu')!.parent).toBe('root');
  });

  it('容器未开段 ⇒ 归本容器默认段（画在容器层自己，段层在它之上）', () => {
    const { tree, created } = makeTree();
    tree.beginFrame();
    tree.enterContainer('menu');
    const containerScope = tree.current;      // 未标段
    tree.enterSegment('hud');
    const hudScope = tree.current;
    expect(containerScope).not.toBe(hudScope);
    expect(created.map((c) => [c.key, c.sibling])).toEqual([['menu', 0], ['menu·hud', 1]]);
  });

  it('帧首清层：每个已建作用域清一次图形、归还一次标签；栈回到默认层', () => {
    const { tree, created, stats } = makeTree();
    tree.beginFrame();
    tree.enterContainer('menu'); tree.enterSegment('modal'); void tree.current;
    expect(created).toHaveLength(2);
    tree.beginFrame();
    expect(created.every((c) => c.clears === 1 && c.releases === 1)).toBe(true);
    // 默认层也一起清（它就是旧那两个提交体）：本例跳过了两次 beginFrame ⇒ 2 次
    expect(stats.defaultClears).toBe(2);
    expect(stats.defaultReleases).toBe(2);
    expect(tree.current).toBe(tree.defaultScope);
    expect(created).toHaveLength(2);
  });

  it('越界与不配对：未进容器就开段 ⇒ 忽略不建层；空栈退出不抛', () => {
    const { tree, created } = makeTree();
    tree.beginFrame();
    tree.enterSegment('modal');
    expect(tree.current).toBe(tree.defaultScope);
    expect(created).toHaveLength(0);
    expect(() => { tree.exitSegment(); tree.exitContainer(); tree.exitSegment(); }).not.toThrow();
    expect(tree.current).toBe(tree.defaultScope);
  });

  it('位图腿归属随作用域切换（P1 的静态位图要挂进本层，不再压不住遮罩）', () => {
    const { tree, created, defaultBlitParent } = makeTree();
    tree.beginFrame();
    expect(tree.blitParent).toBe(defaultBlitParent);   // 未进层级 ⇒ 旧 BlitLayerUI
    tree.enterContainer('menu'); tree.enterSegment('modal');
    void tree.current;                                  // 落笔才建层
    const scoped = tree.blitParent;
    expect(created.some((c) => c.key === 'menu·modal' && c.parent === 'menu')).toBe(true);
    expect(scoped).not.toBe(defaultBlitParent);
    tree.exitSegment(); tree.exitContainer();
    expect(tree.blitParent).toBe(defaultBlitParent);    // 出层即回落
  });
});

/**
 * `[ADR-0033 §S1]` 恒置顶容器（调试层：性能覆层 + 安全区标定线必须永远看得见）。
 * 序仍由内核决定 —— 宿主只拿到一个哨兵值去 clamp 到末位，⛔ 不在宿主侧另算序。
 */
describe('UI-60 P1 — 恒置顶容器（topMost）', () => {
  it('建层时兄弟位取哨兵值，而不是出现序', () => {
    const { tree, created } = makeTree({ topMost: UI_DEBUG_SCOPE_ID });
    tree.beginFrame();
    tree.enterContainer('settings');
    void tree.current;                  // 落笔才建层
    tree.exitContainer();
    tree.enterContainer(UI_DEBUG_SCOPE_ID);
    void tree.current;
    expect(created.map((c) => [c.key, c.sibling])).toEqual([
      ['settings', 0],
      [UI_DEBUG_SCOPE_ID, UI_SCOPE_TOP_MOST_SIBLING],
    ]);
  });

  it('每次进入都压回末位（后来新建的容器会把它顶下去）；非置顶容器不触发', () => {
    const raised: string[] = [];
    const { tree } = makeTree({
      topMost: UI_DEBUG_SCOPE_ID,
      raise: (scope) => raised.push((scope.handle as { name: string }).name),
    });
    tree.beginFrame();
    tree.enterContainer('settings');
    void tree.current;
    tree.exitContainer();
    tree.enterContainer(UI_DEBUG_SCOPE_ID);
    expect(raised, '首次进入时层还没建 ⇒ 无 raise').toEqual([]);
    void tree.current;
    tree.exitContainer();
    tree.beginFrame();
    tree.enterContainer('settings');
    tree.enterContainer(UI_DEBUG_SCOPE_ID);
    expect(raised, '已建层后每次进入都重压').toEqual([UI_DEBUG_SCOPE_ID]);
  });
});
