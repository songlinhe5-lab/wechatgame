import { describe, expect, it } from 'vitest';
import {
  polygonVertices,
  RenderModelBuilder,
  type PolygonCommand,
  type RenderModel,
} from '../../src/core/render/render-model.js';

describe('RenderModelBuilder', () => {
  it('starts empty and records the design size', () => {
    const b = new RenderModelBuilder(750, 1334);
    const model = b.end();
    expect(model.designWidth).toBe(750);
    expect(model.designHeight).toBe(1334);
    expect(model.commands).toEqual([]);
  });

  it('emits rect/circle/line/text/polygon commands', () => {
    const b = new RenderModelBuilder(100, 100);
    b.begin('#000');
    b.rect(0, 0, 10, 10, { fill: '#fff', radius: 2 });
    b.circle(5, 5, 3, { fill: '#f00' });
    b.line(0, 0, 10, 10, '#0f0', 2);
    b.text(1, 2, 'hi', { align: 'center' });
    b.polygon([0, 0, 10, 0, 5, 10], { fill: '#00f' });
    const model = b.end();
    expect(model.background).toBe('#000');
    expect(model.commands.map((c) => c.kind)).toEqual([
      'rect',
      'circle',
      'line',
      'text',
      'polygon',
    ]);
  });

  it('omits the background when unset', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    expect('background' in b.end()).toBe(false);
  });

  it('begin() clears previous commands', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.rect(0, 0, 1, 1, { fill: '#fff' });
    expect(b.count).toBe(1);
    b.begin();
    expect(b.count).toBe(0);
    expect(b.end().commands).toEqual([]);
  });

  it('supports setBackground and resize', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.setBackground('#123456');
    b.resize(200, 300);
    const model = b.end();
    expect(model.background).toBe('#123456');
    expect(model.designWidth).toBe(200);
    expect(model.designHeight).toBe(300);
  });

  it('freezes the produced model and its command list', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.circle(0, 0, 1, { fill: '#fff' });
    const model = b.end();
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.commands)).toBe(true);
  });

  // F-9 / ADR-0024 §6-J2：本条在 arena 改造前只验 circle 标量 ⇒ 对 polygon 载荷无判别力。
  // 改造后它成为「否证零拷贝视图实现」的 discriminating 判据（DEC-2 选拷贝正是为了这条必绿）。
  it('J-2 returns a snapshot independent of later mutations (ADR-0024 §6-J2)', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.circle(0, 0, 1, { fill: '#fff' });
    b.polygon([0, 0, 10, 0, 5, 10], { fill: '#0f0' });
    const first = b.end();
    b.begin();
    b.circle(9, 9, 2, { fill: '#000' });
    b.polygon([1, 1, 2, 2, 3, 3], { fill: '#f00' }); // 同 arena 后续帧改写
    const second = b.end();

    expect(first.commands).toHaveLength(2);
    expect((first.commands[0] as { x: number }).x).toBe(0);
    // 红法（变异自证已实测，ADR-0024 §6「变异自证」条）：
    //  · 退回「按引用存 points」⇒ 本条读不回旧值（拿到最后一枚）；
    //  · 改 `end()` 交 `subarray` 零拷贝视图 ⇒ first 的顶点变成 [1,1,2,2,3,3]。
    expect(Array.from(polygonVertices(first, first.commands[1] as PolygonCommand)))
      .toEqual([0, 0, 10, 0, 5, 10]);
    expect(Array.from(polygonVertices(second, second.commands[1] as PolygonCommand)))
      .toEqual([1, 1, 2, 2, 3, 3]);
  });

  // ── WXG-T-211-A / ADR-0024：polygon 值语义（顶点 arena + 构建时拷贝）──────

  /** 4 枚三角形（含小数与负值 ⇒ 覆盖 `number[]` 的 Float64 语义面）。 */
  const J1_TRIS: readonly (readonly number[])[] = [
    [1, 2, 3, 4, 5, 6],
    [7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18],
    [0.5, 0.25, -1.5, 2.5, 3.5, -0.125],
  ];

  /**
   * J-1 主锚判据：**故意复用同一块 scratch**（今天最危险的写法），逐枚入列前把入参
   * 抄进期望表，`end()` 后逐命令读回比对。实现退回「按引用 push」即整组全红
   * （每条命令都读到最后一枚的顶点）。
   */
  function j1Round(label: string, scratch: number[] | Float32Array): void {
    it(`J-1 ${label} scratch 被复用时逐命令仍是建令当刻的值（ADR-0024 §6-J1）`, () => {
      const b = new RenderModelBuilder(100, 100);
      const want: number[][] = [];
      b.begin();
      for (const tri of J1_TRIS) {
        for (let k = 0; k < 6; k += 1) scratch[k] = tri[k]!;
        // 关键：期望值在**下一次覆写之前**取，且取的是入参数组本身（不是命令）。
        want.push([scratch[0]!, scratch[1]!, scratch[2]!, scratch[3]!, scratch[4]!, scratch[5]!]);
        b.polygon(scratch, { fill: '#fff' });
      }
      const model = b.end();
      expect(model.commands).toHaveLength(J1_TRIS.length);
      model.commands.forEach((cmd, i) => {
        const poly = cmd as PolygonCommand;
        expect(poly.kind).toBe('polygon');
        // DEC-1：`points` 字段取消（不留兼容 getter ⇒ adapter 循环不逐命令分配视图）。
        expect('points' in poly).toBe(false);
        expect(Array.from(polygonVertices(model, poly)), `第 ${i} 枚串形`).toEqual(want[i]);
      });
    });
  }
  j1Round('number[]', [] as number[]);
  // Float32 → Float64 是无损方向（DEC-1 选 Float64 arena 的理由），故等值断言不需 ε。
  j1Round('Float32Array subarray', new Float32Array(8).subarray(0, 6));

  it('J-1b polygon3 标量入口与旧签名同载荷、且不读调用方数组', () => {
    const b = new RenderModelBuilder(100, 100);
    b.begin();
    b.polygon3(1, 2, 3, 4, 5, 6, { fill: '#0f0', alpha: 0.5 });
    b.polygon3(-0.5, 0.25, 1.5, -2.5, 3.5, 0.125, { fill: '#f00' });
    const model = b.end();
    const [a, c] = model.commands as [PolygonCommand, PolygonCommand];
    expect(a.count).toBe(3);
    expect(Array.from(polygonVertices(model, a))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Array.from(polygonVertices(model, c))).toEqual([-0.5, 0.25, 1.5, -2.5, 3.5, 0.125]);
    expect(a.alpha).toBe(0.5);
  });

  it('J-4 arena 跨帧复用：writes 恒等 Σ count×2、水位线稳定后零扩容、空帧共享同一空表', () => {
    const b = new RenderModelBuilder(100, 100);
    const FRAMES = 200;
    const POLYS = 4096; // 满盘量级：32×32 格 × 4 枚/珠（tuning GRID_MAX_*）
    const scratch: number[] = [0, 0, 0, 0, 0, 0];

    const writes0 = b.vertexWrites;
    const reallocs0 = b.arenaReallocs;
    let reallocsAfterWarm = 0;
    let lastPolyModel: RenderModel | null = null;
    for (let f = 0; f < FRAMES; f += 1) {
      b.begin();
      for (let i = 0; i < POLYS; i += 1) {
        for (let k = 0; k < 6; k += 1) scratch[k] = (i + k) * 0.5;
        b.polygon(scratch, { fill: '#fff' });
      }
      lastPolyModel = b.end();
      if (f === 0) {
        // 暖帧后水位线必须已经稳定：ADR-0024 §6-J4 ①「水位线稳定后为 0」。
        // 注：字面 `arenaReallocs ≤ 1` 在「懒扩容 + 翻倍」下不可满足（首帧要 log2 次翻倍），
        //     且预分配一整帧会破「无 polygon 帧恒零分配」⇒ 判据写成**增量 0**（更强且不假绿）。
        reallocsAfterWarm = b.arenaReallocs;
        expect(reallocsAfterWarm - reallocs0, '首帧翻倍次数').toBeLessThanOrEqual(12);
      } else {
        expect(b.arenaReallocs, `第 ${f} 帧发生扩容 ⇒ arena 未被复用`).toBe(reallocsAfterWarm);
      }
    }

    // ② 口径锚：写入浮点数 === Σ count×2（逐命令独立可核）。
    expect(b.vertexWrites - writes0).toBe(FRAMES * POLYS * 6);
    const model = lastPolyModel!;
    let sum = 0;
    for (const cmd of model.commands) sum += (cmd as PolygonCommand).count * 2;
    expect(sum).toBe(POLYS * 6);
    expect(model.vertices.length).toBeGreaterThanOrEqual(sum);

    // ③ 无 polygon 帧：不分配、且与「上一空帧」同一引用（模块级 EMPTY_VERTS）。
    b.begin();
    b.rect(0, 0, 1, 1, { fill: '#fff' });
    const emptyA = b.end();
    expect(emptyA.vertices.length).toBe(0);
    const writes1 = b.vertexWrites;
    const reallocs1 = b.arenaReallocs;
    b.begin();
    b.rect(0, 0, 1, 1, { fill: '#fff' });
    const emptyB = b.end();
    expect(emptyB.vertices).toBe(emptyA.vertices); // 同一引用 ⇒ 恒零分配
    expect(b.vertexWrites).toBe(writes1); // 空帧不写顶点
    expect(b.arenaReallocs).toBe(reallocs1);
  });

  it('begin() 复位顶点游标但不丢容量（第二帧不再扩容）', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.polygon([0, 0, 1, 1, 2, 0], { fill: '#fff' });
    const cap0 = b.arenaCapacity;
    const reallocs0 = b.arenaReallocs;
    b.begin();
    b.polygon([0, 0, 1, 1, 2, 0], { fill: '#fff' });
    expect(b.arenaCapacity).toBe(cap0);
    expect(b.arenaReallocs).toBe(reallocs0);
    expect(b.vertexWrites).toBe(12);
  });

  it('passes through optional alpha on every primitive', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.rect(0, 0, 1, 1, { fill: '#fff', alpha: 0.5 });
    b.circle(0, 0, 1, { fill: '#fff', alpha: 0.25 });
    b.line(0, 0, 1, 1, '#fff', 1, 0.75);
    b.text(0, 0, 'x', { alpha: 0.1 });
    b.polygon([0, 0, 1, 1, 2, 0], { fill: '#fff', alpha: 0.9 });
    const model = b.end();
    expect(model.commands.map((c) => (c as { alpha?: number }).alpha)).toEqual([
      0.5, 0.25, 0.75, 0.1, 0.9,
    ]);
  });

  // ── WXG-T-132 / ADR-0014：全局变换通道 ──────────────────────────────

  it('emits no transform field by default (identity frames stay byte-old)', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.rect(0, 0, 1, 1, { fill: '#fff' });
    const model = b.end();
    expect('transform' in model).toBe(false);
  });

  it('setTransform embeds scale + design-space anchor', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.setTransform(1.015, 5, 5);
    expect(b.end().transform).toEqual({ scale: 1.015, anchorX: 5, anchorY: 5 });
  });

  it('scale === 1 keeps the frame identity (no transform field)', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.setTransform(1, 3, 4);
    expect('transform' in b.end()).toBe(false);
  });

  it('begin() resets the transform to identity', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.setTransform(1.015, 5, 5);
    b.begin();
    expect('transform' in b.end()).toBe(false);
  });

  it('the produced transform object is frozen', () => {
    const b = new RenderModelBuilder(10, 10);
    b.begin();
    b.setTransform(1.015, 5, 5);
    const t = b.end().transform!;
    expect(Object.isFrozen(t)).toBe(true);
  });
});
