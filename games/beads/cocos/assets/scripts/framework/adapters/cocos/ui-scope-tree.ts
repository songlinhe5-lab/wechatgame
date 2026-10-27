/**
 * UI-60 P1（可证部分）· **容器 × 段层树内核**（引擎无关）
 * 正本 = `docs/architecture/adr/ADR-0033-ui-container-layer-ordering.md` DEC-1…4 / DEC-9。
 *
 * 为什么切成「内核 + cc 薄壳」：`bindings.ts` 那条腿只能由设备证（真节点、真叠序、真
 * draw call），而「层怎么排 / 何时建 / 越界怎么办」是纯逻辑，可以在 Node 里逐条钉死。
 * 本文件因此⛔ 不 import `cc`（L3 同源纪律），宿主只通过 {@link UiScopeTreeHooks.create}
 * 交出一个作用域的通道三件套。
 *
 * 四条规则（每条都有单测，改之前先想清楚要动哪条）：
 *  1. **懒建**：`enter*` 不建层，只有真落笔（读 {@link UiScopeTree.current}）才建 ⇒
 *     与 `CocosRenderModelRenderer.lastScopeCount` 同口径，⛔ 不得按预估虚报预算。
 *     唯一例外：段作用域需要父节点，故建段时顺带把容器层建出来（它必然会被用到）。
 *  2. **容器序 = 出现序**（栈自下而上，首次出现时定兄弟位，跨帧复用不重排）；
 *     **段序 = `UI_SEGMENT_ORDER` 枚举序**（`page < hud < modal < toast`），
 *     ⛔ 不是绘制先后——这正是 Cocos 端把指令序压成通道序那类缺陷的反面教材。
 *  3. 段作用域挂在容器作用域**之下**（父子）：父层自带 Graphics，子层天然画在它之上 ⇒
 *     「未标段 = 容器默认段」与「hud 在 page 之上」用同一棵树表达，不需要 zIndex（DEC-4）。
 *  4. 越界与不配对不抛、不误建层（未进容器就开段 ⇒ warn-once 并忽略；空栈退出 ⇒ no-op）。
 */

import { UI_SEGMENT_ORDER, type UiSegment } from '../../core/render/render-model';
import type { CocosUiScopeHostLike, CocosUiScopeLike } from './cocos-renderer';

/**
 * 一个作用域 = 一对全通道提交体（矢量 + 标签）＋ 承载节点 ＋ 可选位图腿父节点。
 * `handle` 由宿主创建（cc 侧 = 那个 `Node`），内核只把它当不透明值转交，⛔ 不解读。
 */
export interface UiScopeChannels extends CocosUiScopeLike {
  readonly handle: unknown;
  /** 静态位图腿（`BlitLayerUI` 一类）本帧应挂到哪个节点；缺省 ⇒ 宿主沿用默认位图层。 */
  readonly blitParent?: unknown;
}

/** 宿主注入的四件事：根节点、旧单层那两个提交体、默认位图父、建层工厂。 */
export interface UiScopeTreeHooks {
  readonly root: unknown;
  /** **必须是今天那两个提交体**（主 `Graphics` + 主标签池）⇒ 视图未发层级命令时逐字等价。 */
  readonly defaultScope: CocosUiScopeLike;
  readonly defaultBlitParent: unknown;
  /**
   * 建一个作用域。`siblingIndex` 由内核按规则 2 算好，宿主直接
   * `node.setSiblingIndex(siblingIndex)`（⛔ 宿主不得自行决定序，否则两处真源）。
   *
   * ⚠ 该值可能是 {@link UI_SCOPE_TOP_MOST_SIBLING}（= 恒置顶容器，见 `topMost`）⇒ 宿主**必须
   * clamp 到末位**（`Math.min(v, parent.children.length - 1)`），⛔ 不得把超大数直接交给引擎。
   */
  create(key: string, parent: unknown, siblingIndex: number): UiScopeChannels;
  /**
   * `[ADR-0033 §S1]` **恒置顶容器 id**（调试层一类：必须永远在一切容器之上）。省略 ⇒ 纯出现序。
   *
   * 语义只有两条：① 该容器建层时兄弟位取 {@link UI_SCOPE_TOP_MOST_SIBLING}（宿主 clamp 到末位）；
   * ② 每次 `enterContainer` 它都重新压回末位（否则后来新建的容器会把它顶下去）。序仍由内核决定，
   * 宿主只按给定值落位。
   */
  readonly topMost?: string;
  /** 把某作用域重新压回末位（**仅** `topMost` 容器会被调；不提供 ⇒ 只在建层时置顶一次）。 */
  raise?(scope: UiScopeChannels): void;
}

/** 恒置顶容器建层时用的兄弟位哨兵（宿主 clamp 到末位，见 {@link UiScopeTreeHooks.create}）。 */
export const UI_SCOPE_TOP_MOST_SIBLING = Number.MAX_SAFE_INTEGER;

/**
 * `[ADR-0033 §S1]` 调试层容器 id（性能覆层 / 安全区标定线）：**必须永远在最顶**
 * （`bindings.ts` 把它登记为 `topMost`）。视图只发这一个 id，⛔ 不得另造第二份。
 */
export const UI_DEBUG_SCOPE_ID = '__debug';

/** 一个容器在一帧里的状态：当前段、容器默认段层、各段层（跨帧复用）。 */
class ContainerFrame {
  segment: UiSegment | null = null;
  own: UiScopeChannels | null = null;
  readonly segments = new Map<UiSegment, UiScopeChannels>();

  constructor(readonly key: string, readonly sibling: number) {}
}

export class UiScopeTree implements CocosUiScopeHostLike {
  private readonly _frames = new Map<string, ContainerFrame>();
  private readonly _stack: ContainerFrame[] = [];
  private readonly _all: UiScopeChannels[] = [];
  private _warnedSegmentWithoutContainer = false;

  constructor(private readonly _hooks: UiScopeTreeHooks) {}

  /** 旧单层那两个提交体（宿主可直接用作 `CocosRenderer` 的第一参）。 */
  get defaultScope(): CocosUiScopeLike {
    return this._hooks.defaultScope;
  }

  beginFrame(): void {
    // 帧首：清栈（跨帧复用已建的层），并把**所有**曾建出来的层清空归还——包括默认层。
    // 未被本帧使用的层因此不留上帧像素（DEC-3 的「帧首清层」义务在这里兑现）。
    this._stack.length = 0;
    const scopes = this._all;
    for (let i = 0; i < scopes.length; i += 1) {
      scopes[i]!.graphics.clear();
      scopes[i]!.labels.releaseAll();
    }
    this._hooks.defaultScope.graphics.clear();
    this._hooks.defaultScope.labels.releaseAll();
  }

  enterContainer(id: string): void {
    let frame = this._frames.get(id);
    if (!frame) {
      // 兄弟位 = 首次出现序（容器栈自下而上；⛔ 不按 id 字母序、也不每帧重排）
      frame = new ContainerFrame(id, this._frames.size);
      this._frames.set(id, frame);
    }
    frame.segment = null;
    this._stack.push(frame);
    // `[ADR-0033 §S1]` 恒置顶容器每次进入都压回末位：后来新建的容器是 addChild 追加
    // ⇒ 不重压就会被顶到它下面（调试层必须永远看得见）。
    if (id === this._hooks.topMost && frame.own) this._hooks.raise?.(frame.own);
  }

  /** 未进容器时开段 = 语义错误：忽略（warn-once），仍画默认层，⛔ 不猜父层。 */
  enterSegment(segment: UiSegment): void {
    const frame = this._stack[this._stack.length - 1];
    if (!frame) {
      if (!this._warnedSegmentWithoutContainer) {
        this._warnedSegmentWithoutContainer = true;
        console.warn(`[UiScopeTree] \`beginSegment("${segment}")\` 出现在任何 \`beginContainer\` 之前，已忽略（ADR-0033 DEC-2）。`);
      }
      return;
    }
    frame.segment = segment;
  }

  exitSegment(): void {
    const frame = this._stack[this._stack.length - 1];
    if (frame) frame.segment = null;
  }

  exitContainer(): void {
    this._stack.pop();
  }

  /** 当前作用域；栈空 = 默认层。**读它即视为「要落笔」⇒ 层在此刻才建**（规则 1）。 */
  get current(): CocosUiScopeLike {
    return this._resolve();
  }

  /** 本帧静态位图腿应挂的节点（P1 的菜单位图 / 卡底缩略走这里，不再固定盖住遮罩）。 */
  get blitParent(): unknown {
    const scope = this._resolve();
    if (scope === this._hooks.defaultScope) return this._hooks.defaultBlitParent;
    const bp = (scope as UiScopeChannels).blitParent;
    return bp === undefined ? this._hooks.defaultBlitParent : bp;
  }

  private _resolve(): CocosUiScopeLike {
    const frame = this._stack[this._stack.length - 1];
    if (!frame) return this._hooks.defaultScope;
    const own = this._ownScope(frame);
    const segment = frame.segment;
    if (segment === null) return own;
    const hit = frame.segments.get(segment);
    if (hit) return hit;
    // 段序 = 枚举序（不是进入先后）；父节点 = 容器层，子层天然画在它之上 ⇒ 无需 zIndex。
    const scope = this._hooks.create(`${frame.key}·${segment}`, own.handle, UI_SEGMENT_ORDER.indexOf(segment));
    frame.segments.set(segment, scope);
    this._all.push(scope);
    return scope;
  }

  private _ownScope(frame: ContainerFrame): UiScopeChannels {
    const hit = frame.own;
    if (hit) return hit;
    const sibling = frame.key === this._hooks.topMost ? UI_SCOPE_TOP_MOST_SIBLING : frame.sibling;
    const scope = this._hooks.create(frame.key, this._hooks.root, sibling);
    frame.own = scope;
    this._all.push(scope);
    return scope;
  }
}
