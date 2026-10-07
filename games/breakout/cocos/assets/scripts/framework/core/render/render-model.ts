/**
 * Render model — the contract between gameplay and any renderer.
 *
 * Gameplay produces a *description* of what should be on screen (a flat list of
 * draw commands in design space). Renderers consume it. Gameplay never knows
 * whether the consumer is Cocos `Graphics`, Canvas2D, or a test spy.
 *
 * This is the mechanism behind the rule "the UI layer holds no game state"
 * (control-manifest.md): the model is produced fresh each frame from the
 * authoritative state, and thrown away afterwards. It is never mutated by UI
 * code and never read back by gameplay.
 */

export interface RectCommand {
  readonly kind: 'rect';
  /** Bottom-left corner X in design space. */
  readonly x: number;
  /** Bottom-left corner Y in design space. */
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly lineWidth?: number;
  /** Corner radius; 0 (default) means square corners. */
  readonly radius?: number;
  /** 0..1 opacity applied to fill (and stroke). */
  readonly alpha?: number;
  /**
   * `[WXG-T-256 / ADR-0030 S5′-4]` **底图通道**：本图元必须落在 blit 载体**之下**
   * （托盘白瓷面板底、盘面 B0 一类「承着珠子的桌面」）。
   *
   * - canvas2d：一帧按命令序单趟绘制，视图本来就先铺桌面再画珠 ⇒ 本标记**无副作用**。
   * - Cocos：只有一层 `Graphics` 且整层在 blit 之上，故由 adapter 路由到 `backGraphics`
   *   （宿主挂在 blit 之下的那个提交体）。⛔ 未注入 ⇒ 回落普通 `Graphics`，与旧宿主逐字节等价。
   *
   * ⛔ 它**不是** z-index，也不是通用层序表达：只有「必须在 blit 之下」的桌面级图元用。
   * ⛔ 缺省不落字段（`JSON.stringify` 语义）⇒ 既有 seal / 帧 diff 基准零漂移。
   */
  readonly back?: boolean;
}

export interface CircleCommand {
  readonly kind: 'circle';
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly lineWidth?: number;
  readonly alpha?: number;
}

export interface LineCommand {
  readonly kind: 'line';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke: string;
  readonly lineWidth: number;
  readonly alpha?: number;
  /** 同 {@link RectCommand.back}：桌面级图元（面板内阴影线）需要跟底一起沉到 blit 之下。 */
  readonly back?: boolean;
}

export type TextAlign = 'left' | 'center' | 'right';
export type TextBaseline = 'top' | 'middle' | 'bottom';

export interface TextCommand {
  readonly kind: 'text';
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly fill?: string;
  readonly font?: string;
  readonly align?: TextAlign;
  readonly baseline?: TextBaseline;
  readonly alpha?: number;
}

/**
 * `[WXG-T-211-A / ADR-0024 DEC-1]` A polygon command is now a **locator**, not a
 * container: the vertices live in one per-frame arena on the model
 * ({@link RenderModel.vertices}) and the command only remembers where its slice
 * starts and how many vertices it owns.
 *
 * Why not `points` (the old shape): `polygon()` used to push the caller's array
 * **by reference**, so sharing one scratch buffer across commands silently made
 * every command point at the last written shape (defect F-1). Value semantics in
 * the arena make that class of bug unrepresentable, while a whole frame still
 * costs one buffer instead of one array per polygon.
 */
export interface PolygonCommand {
  readonly kind: 'polygon';
  /** Index of this polygon's first float in {@link RenderModel.vertices}. */
  readonly offset: number;
  /**
   * **Vertex** count (not float count). The command owns the half-open float
   * range `[offset, offset + count * 2)`. Degenerate payloads are *not* dropped
   * here (ADR-0024 DEC-4): renderers keep their own skip thresholds, so the
   * command count stays a faithful reflection of what was submitted.
   */
  readonly count: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly lineWidth?: number;
  readonly alpha?: number;
}

/**
 * `[WXG-T-220 / ADR-0026]` A texture-rect blit command. The core layer only
 * stores `textureId` (a string); the adapter resolves it to a concrete image
 * source via an injected `TextureRegistry`. This keeps the core engine-agnostic
 * (L2: no `cc` / DOM / `wx` imports in `core/**`).
 *
 * Does NOT participate in the vertex arena — blit carries no geometry payload
 * beyond position and size.
 */
export interface BlitCommand {
  readonly kind: 'blit';
  /** Texture resource identifier (adapter resolves to concrete image source). */
  readonly textureId: string;
  /** Bottom-left corner (design space, same convention as `rect`). */
  readonly x: number;
  readonly y: number;
  /** Draw size (design space; texture is scaled to fit). */
  readonly w: number;
  readonly h: number;
  readonly alpha?: number;
  /**
   * `[WXG-T-226 EP12-B3 / ADR-0029 §8.2]` **唯一效果槽**（取代原具名字段 `tint`）。
   *
   * 着色语义搬到**效果模块**（`bake/tint-composite.ts` 的 `tintFx()` / `tintFxBase()`）；
   * 权威文本见 `ADR-0029 §8.2` 键名约定表 ⇄ `ADR-0028 §2.1`（编码定义）。
   *
   * ⛔ core 不持引擎对象（L2）；⛔ 无 `fx` 的 blit 语义**逐字节不变**（`undefined` 不落
   * `JSON.stringify` ⇒ 封箱基准零漂移，同 `stroke` 透传先例）。
   */
  readonly fx?: BlitFx;
}

/**
 * `[WXG-T-226 / ADR-0029 §8.2]` **blit 唯一效果槽的值域**。
 *
 * 为什么是「封闭联合」而不是 `unknown`：命令会被 `JSON.stringify` 后取 sha
 * （`ADR-0026` J-1「sha 计引用不计纹理内容」+ 封箱 / 回放 / 帧 diff）
 * ⇒ **可哈希性是硬要求**；`unknown` 会让「不小心塞进不可序列化值」变成静默的基准漂移。
 *
 * 为什么含 `readonly number[]`：`colorMatrix` / 多段渐变一类效果的自然载荷
 * ⇒ 现在收进来，就少一类「将来必须回来扩联合」的返工。
 */
export type BlitFxValue = string | number | boolean | readonly number[];

/**
 * `[WXG-T-226 / ADR-0029 §8.2]` **blit 唯一效果槽**（键名不进类型 ⇒ core 永不再为效果改动）。
 *
 * ## 规则（硬约束，违反 = 打回）
 *
 * 1. ⛔ **效果一律写 `fx`；core 不得为具体效果加字段、加键名联合**。
 *    ⛔ 特别地：**不要**引入 `kind: 'tint' | 'blend' | …` 这种闭集 ——
 *    闭集会把「core 永不再动」重新打开（加一种效果 = 改一次 core）。
 * 2. ⛔ **键名约定登记在 `ADR-0029 §8.2`**，不在 core；生产者用效果模块的具象化 helper
 *    （如 `tintFx()`），⛔ 不要手写字面量对象。
 * 3. ⛔ 值必须 **JSON 安全**（见 `BlitFxValue` 的理由）；⛔ 不得放 `undefined`
 *    （`JSON.stringify` 会**静默丢弃** `undefined` 值 ⇒ 同语义不同 sha）。
 * 4. ⛔ **键序由构造方固定**：同一效果用同一份**模块级常量**，⛔ 不得按遍历顺序动态建键
 *    （`JSON.stringify` 按插入序输出 ⇒ 同语义不同 sha ⇒ 封箱基准误报失败）。
 * 5. ⛔ `alpha` **不是**效果（blit 图元参数）⇒ 保持在 `alpha`，⛔ 不进 `fx`。
 *
 * ## 现状键名（正本 = `ADR-0029 §8.2`）
 *
 * | 键 | 含义 | 状态 |
 * |---|---|---|
 * | `base` | 着色基色（hex） | ✅ 本批（原 `tint` 迁入） |
 * | `strength` | 着色强度 0–1 | 预留（core 0 改动） |
 * | `blend` | blend 模式名 | 将来 |
 * | `matrix` | color matrix（`number[]`） | 将来 |
 */
export type BlitFx = Readonly<Record<string, BlitFxValue>>;

/** `[WXG-T-226 / 方案件 §3.3 选项 B]` `blit` 的选项对象。 */
export interface BlitOptions {
  readonly alpha?: number;
  readonly fx?: BlitFx;
}

export type DrawCommand =
  | RectCommand
  | CircleCommand
  | LineCommand
  | TextCommand
  | PolygonCommand
  | BlitCommand;

/** A full frame description, in design-space units. */
export interface RenderModel {
  readonly designWidth: number;
  readonly designHeight: number;
  /** Optional background fill applied before the command list. */
  readonly background?: string;
  /**
   * Optional whole-frame transform (WXG-T-132 / ADR-0014) applied by renderers
   * **before** background and commands — i.e. the background participates, so a
   * scale > 1 about an interior anchor can never open black bands inside the
   * design rect. Absent ⇒ identity. Design-space anchor point; uniform scale.
   */
  readonly transform?: RenderTransform;
  readonly commands: readonly DrawCommand[];
  /**
   * Vertex arena shared by every `polygon` command of this frame (design-space
   * floats, y-up). The model owns a **private copy** — later frames reusing the
   * builder's arena can never mutate a model already handed to a renderer
   * (ADR-0024 §6-J2). Frames without polygons expose the module-level empty
   * table, so an idle frame allocates nothing.
   */
  readonly vertices: Float64Array;
}

/**
 * Read the vertices of one polygon back out of the arena.
 *
 * ⚠️ **Test / offline-tool helper only.** It allocates a `subarray` view per
 * call, so production hot paths (adapters, gameplay) must index
 * `model.vertices` directly with `cmd.offset` / `cmd.count`.
 */
export function polygonVertices(model: RenderModel, cmd: PolygonCommand): Float64Array {
  return model.vertices.subarray(cmd.offset, cmd.offset + cmd.count * 2);
}

/**
 * Whole-frame uniform scale about a design-space anchor:
 * `p' = anchor + (p − anchor) · scale`. Translation/rotation are deliberately
 * **not** offered — the only specced consumer is beads G5 「伪震屏」
 * (`art-bible §7.3.5`, scale-only red line: no dx/dy may ever appear).
 */
export interface RenderTransform {
  readonly scale: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

/**
 * The one empty vertex table shared by every polygon-free frame (ADR-0024 DEC-2).
 * Module-private and never exported on purpose: {@link RenderModelBuilder.end}
 * hands out *this exact object*, so "an idle frame allocated nothing" is
 * observable as reference identity in tests (J-4 ③).
 */
const EMPTY_VERTS: Float64Array = new Float64Array(0);

/** First arena size; doubling from here keeps reallocations at log₂ per frame. */
const ARENA_MIN_FLOATS = 256;

/**
 * Accumulator that builds a {@link RenderModel} without per-frame allocation of
 * intermediate arrays: `begin()` clears the backing array, systems `push()`,
 * `end()` returns a frozen view.
 *
 * > Only ONE `RenderModel` should be alive per frame; it is reused, not stored.
 * > Renderers must copy anything they need to keep beyond the current frame.
 *
 * ⚠️ The exception that proves the line: polygon vertices live in an arena, and
 * `end()` copies that arena out (see {@link RenderModel.vertices}) — a model
 * stays self-contained across frames precisely so gameplay may hand the same
 * builder to the next frame without aliasing the previous model.
 */
export class RenderModelBuilder {
  private readonly _commands: DrawCommand[] = [];
  // Vertex arena (ADR-0024 DEC-1/2): grown lazily by doubling up to the high
  // water mark and *never* per command. `begin()` rewinds the cursor only, so a
  // steady-state frame writes into an already-allocated buffer.
  private _verts: Float64Array = EMPTY_VERTS;
  private _vCursor = 0;
  // Counters backing the J-4 judgement (scalars — no stats object, because an
  // object read would itself allocate on the hot path).
  private _vertexWrites = 0;
  private _arenaReallocs = 0;
  private _background: string | undefined;
  // Transform slots stay as scalars (hot-path zero-allocation, ADR-0014):
  // `setTransform` is called every active frame; identity frames must not
  // allocate anything and emit no `transform` field at all.
  private _tScale = 1;
  private _tAx = 0;
  private _tAy = 0;
  private _width: number;
  private _height: number;

  constructor(designWidth: number, designHeight: number) {
    this._width = designWidth;
    this._height = designHeight;
  }

  resize(w: number, h: number): void {
    this._width = w;
    this._height = h;
  }

  begin(background?: string): void {
    this._commands.length = 0;
    // Rewind the arena cursor; the buffer itself (and its capacity) is kept.
    this._vCursor = 0;
    this._background = background;
    this._tScale = 1;
    this._tAx = 0;
    this._tAy = 0;
  }

  /** Set/replace the frame background fill. */
  setBackground(color: string | undefined): void {
    this._background = color;
  }

  /**
   * Request a whole-frame uniform scale about a design-space anchor
   * (WXG-T-132 / ADR-0014). Scalar params on purpose — an object argument would
   * allocate every active frame. `scale === 1` keeps the frame identity (no
   * `transform` field in {@link end}, renderers take the exact old path).
   * Reset to identity by {@link begin}.
   */
  setTransform(scale: number, anchorX: number, anchorY: number): void {
    this._tScale = scale;
    this._tAx = anchorX;
    this._tAy = anchorY;
  }

  rect(x: number, y: number, w: number, h: number, cmd: Omit<RectCommand, 'kind' | 'x' | 'y' | 'w' | 'h'> = {}): void {
    this._commands.push({ kind: 'rect', x, y, w, h, ...cmd });
  }

  circle(x: number, y: number, r: number, cmd: Omit<CircleCommand, 'kind' | 'x' | 'y' | 'r'> = {}): void {
    this._commands.push({ kind: 'circle', x, y, r, ...cmd });
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke: string, lineWidth = 1, alpha?: number, back?: boolean): void {
    this._commands.push({
      kind: 'line', x1, y1, x2, y2, stroke, lineWidth,
      ...(alpha !== undefined ? { alpha } : {}),
      ...(back !== undefined ? { back } : {}),
    });
  }

  text(
    x: number,
    y: number,
    text: string,
    cmd: Omit<TextCommand, 'kind' | 'x' | 'y' | 'text'> = {},
  ): void {
    this._commands.push({ kind: 'text', x, y, text, ...cmd });
  }

  /**
   * Append a polygon. **Signature unchanged** from the by-reference era
   * (ADR-0024 DEC-3): `number[]` and a `Float32Array` scratch `subarray` are both
   * still accepted — the difference is that the values are now copied into the
   * arena *at call time*, so reusing one scratch buffer for the next polygon can
   * no longer bend earlier commands.
   *
   * The copy is an index loop, deliberately: a spread of `readonly number[] |
   * Float32Array` is a union with a non-array branch, which control-manifest §15
   * / ADR-0012 fail-closed rejects (`Array.from` is not taken either — it
   * allocates a throwaway array).
   *
   * Odd-length payloads drop the trailing float (`count = floor(n/2)`), matching
   * what the renderers already ignored, so migration is byte-neutral (§6-J5).
   */
  polygon(
    points: readonly number[] | Float32Array,
    cmd: Omit<PolygonCommand, 'kind' | 'offset' | 'count'> = {},
    // 可选显式浮点数（WXG-T-262 后续手绘原型批）：调用方传**复用缓冲**（如世界系
    // 平移 arena）时，points.length = 缓冲高水位而非本形顶点数 ⇒ 旧实现由 length
    // 派生 count 会吃进上一形的残留（串形）。传本参 ⇒ count/拷贝长度以显式值为准。
    floatCount?: number,
  ): void {
    const count = Math.floor((floatCount ?? points.length) / 2);
    const floats = count * 2;
    const offset = this._reserve(floats);
    const verts = this._verts;
    for (let k = 0; k < floats; k += 1) verts[offset + k] = points[k]!;
    this._vertexWrites += floats;
    this._commands.push({ kind: 'polygon', offset, count, ...cmd });
  }

  /**
   * Scalar entry point for a triangle — the hot-path shape (beads facets, breakout
   * paddles) and the one that lets a caller skip owning an array at all
   * (ADR-0024 DEC-3). Six scalars, no argument object beyond the optional paint.
   */
  polygon3(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cmd: Omit<PolygonCommand, 'kind' | 'offset' | 'count'> = {},
  ): void {
    const offset = this._reserve(6);
    const v = this._verts;
    v[offset] = x0;
    v[offset + 1] = y0;
    v[offset + 2] = x1;
    v[offset + 3] = y1;
    v[offset + 4] = x2;
    v[offset + 5] = y2;
    this._vertexWrites += 6;
    this._commands.push({ kind: 'polygon', offset, count: 3, ...cmd });
  }

  /**
   * `[WXG-T-220 / ADR-0026]` Append a texture-rect blit command. Does NOT
   * participate in the vertex arena (blit carries no geometry payload beyond
   * position and size). The core layer only stores `textureId`; the adapter
   * resolves it to a concrete image source.
   *
   * `[WXG-T-226 EP12-S2]` 第 6 参由位置式 `alpha` 改为选项对象（方案件 §3.3 选项 B，
   * **推荐项**）：既有的位置式 `alpha` 调用会被 TypeScript 编译期捕获（仓内仅 1 处），
   * 且 `undefined` 字段不落 `JSON.stringify` ⇒ seal 基准零漂移。
   */
  blit(textureId: string, x: number, y: number, w: number, h: number, opts?: BlitOptions): void {
    this._commands.push({
      kind: 'blit', textureId, x, y, w, h,
      ...(opts?.alpha !== undefined ? { alpha: opts.alpha } : {}),
      ...(opts?.fx !== undefined ? { fx: opts.fx } : {}),
    });
  }

  /**
   * Make room for `floats` vertex floats and return the start index. Grows by
   * doubling from the high water mark; the copy forward is an index loop for the
   * same reason {@link polygon} is (§15).
   */
  private _reserve(floats: number): number {
    const cursor = this._vCursor;
    const needed = cursor + floats;
    if (needed > this._verts.length) {
      let cap = this._verts.length;
      while (cap < needed) cap = cap === 0 ? ARENA_MIN_FLOATS : cap * 2;
      const next = new Float64Array(cap);
      const old = this._verts;
      for (let i = 0; i < cursor; i += 1) next[i] = old[i]!;
      this._verts = next;
      this._arenaReallocs += 1;
    }
    this._vCursor = needed;
    return cursor;
  }

  get count(): number {
    return this._commands.length;
  }

  /** Vertex floats written since construction (J-4 口径锚：=== Σ count×2）。 */
  get vertexWrites(): number {
    return this._vertexWrites;
  }

  /** Current arena capacity in floats (0 ⇒ never grown yet). */
  get arenaCapacity(): number {
    return this._verts.length;
  }

  /** Number of arena reallocations since construction. */
  get arenaReallocs(): number {
    return this._arenaReallocs;
  }

  /**
   * `[WXG-T-248 / ADR-0030 §5.0.2]` Cheap content hash of the frame that was just
   * built — the mechanism behind the **脏帧门控**: the carrier bench measured
   * 146/150 idle frames replaying byte-identical geometry (`chg = 3–4`), so hosts
   * compare consecutive signatures and skip the whole `clear()` + replay of ~2 000
   * commands when nothing changed.
   *
   * Contract (read it before using it for anything else):
   *  - **valid between `end()` and the next `begin()`** — it reads the builder's
   *    own command list and vertex arena, both of which `begin()` rewinds;
   *  - 32-bit FNV-style mix ⇒ a collision costs one stale frame, not a corrupt
   *    state. Numbers are quantised to 1/64 design px: a sub-pixel delta is below
   *    the visibility floor by design, and a *fractional* pitch change must not
   *    force a repaint every frame;
   *  - values are mixed in **insertion order**, keys are not. Same `kind` ⇒ same
   *    shape ⇒ same order, so the walk is order-stable; new command fields are
   *    picked up automatically (no per-kind switch to maintain). Nested bags
   *    (`fx`) are walked the same way — legal because `BlitFx` is JSON-safe by
   *    contract and its producers pin key order (rule 4 in the type doc);
   *  - frames with no difference return the same number, and the polygon arena is
   *    covered too (commands only carry `offset`/`count`).
   *
   * ponytail: the hash covers a texture **reference** (`textureId`), never its
   * pixels ⇒ a texture re-baked *in place* under an unchanged id is invisible to
   * the gate. Safe as long as every producer keys content into the id — today
   * both do (`tint`: `cache.get(textureId, base)`, and `base` lives in `fx`;
   * bake: `bake:<styleId>:<colorIdx>` at the constant `BAKE_CANONICAL_SIZE`).
   * If a producer ever re-bakes in place, mix a per-id content revision here.
   */
  signature(): number {
    let h = 2166136261;
    const mix = (v: number): void => {
      h = (Math.imul(h, 16777619) + ((v * 64) | 0)) | 0;
    };
    const mixStr = (s: string): void => {
      for (let i = 0; i < s.length; i += 1) h = (Math.imul(h, 16777619) + s.charCodeAt(i)) | 0;
    };
    // Field values, one level of nesting (`fx` bags and `number[]` payloads both
    // walk as objects ⇒ index/key order is the insertion order).
    const mixVal = (v: unknown): void => {
      if (typeof v === 'number') mix(v);
      else if (typeof v === 'string') mixStr(v);
      else if (typeof v === 'boolean') mix(v ? 1 : 0);
      else if (v !== null && typeof v === 'object') {
        const bag = v as Record<string, unknown>;
        for (const k in bag) mixVal(bag[k]);
      }
    };

    mix(this._width);
    mix(this._height);
    if (this._background !== undefined) mixStr(this._background);
    mix(this._tScale);
    mix(this._tAx);
    mix(this._tAy);

    for (const cmd of this._commands) {
      const rec = cmd as unknown as Record<string, unknown>;
      for (const key in rec) mixVal(rec[key]);
    }

    const verts = this._verts;
    for (let i = 0; i < this._vCursor; i += 1) mix(verts[i]!);

    return h >>> 0;
  }

  /** Freeze and return the current frame. */
  end(): RenderModel {
    // One copy of the arena per frame (DEC-2): the model owns its vertices, so a
    // renderer still holding the previous model sees the shape it was given.
    const vertices = this._vCursor === 0 ? EMPTY_VERTS : this._verts.slice(0, this._vCursor);
    return Object.freeze({
      designWidth: this._width,
      designHeight: this._height,
      ...(this._background !== undefined ? { background: this._background } : {}),
      // The one small per-frame transform object only exists on *active*
      // effect frames (beads G5: a 150 ms window); identity frames allocate none.
      ...(this._tScale !== 1 ? {
        transform: Object.freeze({ scale: this._tScale, anchorX: this._tAx, anchorY: this._tAy }),
      } : {}),
      commands: Object.freeze([...this._commands]),
      vertices,
    });
  }
}

/** An empty model — handy default/placeholder. */
export const EMPTY_RENDER_MODEL: RenderModel = Object.freeze({
  designWidth: 0,
  designHeight: 0,
  commands: Object.freeze([]),
  vertices: EMPTY_VERTS,
});
