/**
 * **豆径档 × 风格 矩阵的闭合判据（补缺口）**
 * ─────────────────────────────────────────────────────────────────────────────
 * 正本 = `bead-visual-style-spec §12 C5`「**孔存在性判据按档断言**（满豆含孔、小豆输出不含孔图元）」
 *      + `§12 C8`「判据按 **styleId 与豆径档**参数化」+ `assets-spec §7.11`（豆径作用域）。
 *
 * **本文件补的是哪一块**：既有按档闭合断言在 `tests/bead-style-settings.test.ts`，但它走
 * `boot()` 的**默认档**（`facet-4`）整帧 ⇒ 二维矩阵 6 个组合只钉住 2 个；`13` / `18` 的小豆档
 * 此前只出现在 `tests/bead-style-framediff.ts` 的**观测腿**，而该文件自陈「⛔ 不进 §11.2 义务、
 * 不做闭合断言」⇒ C5/C8 的「逐风格按档断言」实际无承载体（K-060：声称有门、实际无门）。
 * 本文件把「每套注册风格 × 两档」钉成闭合断言，且带**判别力自证**（例 5）。
 *
 * ⛔ **入库同批性**：本判据依赖 `FilledBeadOptions.hideHole` 与 `BEAD_DRAW_INSET_SMALL`
 *   （EP11-S5 未提交工作树物）⇒ **不得单独入 HEAD**，必须与 S5 那批源码同笔提交，否则 typecheck 即红。
 * ⚠ 只测**盘面通道**（托盘珠按设计恒满幅恒有孔 = ux §3.3 ④，归 settings 那条整帧判据管）。
 */
import { describe, it, expect } from 'vitest';
import { RenderModelBuilder, type DrawCommand, type RenderModel } from '@wxgame/framework';
import {
  BEAD_CELL,
  BEAD_DRAW_INSET,
  BEAD_DRAW_INSET_SMALL,
  BEAD_PITCH,
  SELECT_LIFT_PX,
} from '../src/config/tuning.js';
import { DEMO_BEAD_INKS } from '../src/view/palette.js';
import { drawFilledBead, type FilledBeadOptions } from '../src/view/bead-render.js';
import { registeredStyles } from '../src/view/bead-styles/registry.js';

/** 一颗珠的命令流（`(100,200)` 格心、`size = BEAD_CELL` = 静息档格径）。返回 model：
 * polygon 外缘代理需顶点 arena（`vertices`），只回 commands 读不到。 */
function emit(opts: FilledBeadOptions): RenderModel {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  drawFilledBead(builder, 100, 200, 1, opts);
  return builder.end();
}

const countByKind = (m: RenderModel, kind: DrawCommand['kind']): number =>
  m.commands.filter((c) => c.kind === kind).length;

/** 逐 kind 计数表（供「两档只差一枚孔」的等式比较）。 */
function profileMap(m: RenderModel): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const c of m.commands) acc[c.kind] = (acc[c.kind] ?? 0) + 1;
  return acc;
}

/**
 * 珠体外缘距（格心 → 最外墨）——`maxRectW` 的泛化代理：旧版只看 rect 宽，
 * 对 `handdrawn`（歪多边形豆体 + stroke-only 内环，无 rect）恒返 0 ⇒ 假绿/假红双向失效。
 * 三图元全覆盖：rect = 半宽/半高；circle = r + 线宽/2（描边外沿）；polygon = 顶点 x 最大轴距 +
 * y 向展幅之半（**平移不变**：lift 是整珠 y 位移，不是胀出，不得计入外缘）。
 */
function maxOuter(m: RenderModel): number {
  let max = 0;
  for (const c of m.commands) {
    if (c.kind === 'rect') max = Math.max(max, c.w / 2, c.h / 2);
    else if (c.kind === 'circle') max = Math.max(max, c.r + (c.lineWidth ?? 0) / 2);
    else if (c.kind === 'polygon') {
      const v = m.vertices;
      let yMin = Infinity;
      let yMax = -Infinity;
      for (let k = c.offset; k < c.offset + c.count * 2; k += 2) {
        max = Math.max(max, Math.abs(v[k]! - 100));
        yMin = Math.min(yMin, v[k + 1]!);
        yMax = Math.max(yMax, v[k + 1]!);
      }
      max = Math.max(max, (yMax - yMin) / 2);
    }
  }
  return max;
}

/** 静息档（`size = BEAD_CELL`）珠面 = 格径 − 2×内缩基准（等比归一在基准格径下 = 恒等，K-077）。 */
const faceAtRest = (insetBase: number): number => BEAD_CELL - 2 * insetBase;

const styles = registeredStyles();

describe('豆径档 × 风格 矩阵（§12 C5 孔存在性按档 + C8 判据按 styleId 参数化）', () => {
  // 阳性对照：矩阵必须真有多个消费者被跑到，⛔ 允许「池空 ⇒ 循环零次 ⇒ 全绿」的假绿（K-060）。
  it('前置：注册池非空且逐风格都进矩阵（防空跑假绿）', () => {
    expect(styles.length).toBeGreaterThanOrEqual(2);
    const ids = styles.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // id 唯一 ⇒ 不会同一风格测两遍冒充矩阵
  });

  for (const s of styles) {
    describe(`风格 ${s.id}`, () => {
      // **六裁（WXG-T-221）**：facet-4 的孔拆为同心两枚 circle（pit 底 + stroke-only 环）⇒ 满豆档孔图元 2 枚；
      // 其余风格孔 = 同路径单命令 ⇒ 1 枚。hideHole 跳 `role==='hole'` 全部层。
      const HOLE_CIRCLES = s.id === 'facet-4' ? 2 : 1;
      // **handdrawn（MVP 原型批）**：第二枚 circle = 手绘内环（`plate` 职能，stroke-only），
      // ⛔ 不是孔 ⇒ circle 总数 ≠ 孔数的风格用本表补非孔枚数（代理诚实化，不改跳层语义）。
      const PLATE_CIRCLES = s.id === 'handdrawn' ? 1 : 0;
      const base: FilledBeadOptions = {
        size: BEAD_CELL,
        targetColorIdx: 2,
        inks: DEMO_BEAD_INKS,
        styleId: s.id,
      };
      const full = emit(base); // 满豆档 = 不传两参（现状路径）
      const small = emit({ ...base, drawInset: BEAD_DRAW_INSET_SMALL, hideHole: true });
      const smallNoFlag = emit({ ...base, drawInset: BEAD_DRAW_INSET_SMALL });

      // C5 左半：满豆档恒留孔（K3 孔透色是满豆档底盘可读的唯一通道）。
      it('满豆档：孔 `circle` 枚数按风格（facet-4 六裁拆环+底=2，其余=1；非孔环单列）', () => {
        expect(countByKind(full, 'circle')).toBe(HOLE_CIRCLES + PLATE_CIRCLES);
      });

      // C5 右半：小豆档不含孔图元，且**只**少孔（其余层一族逐 kind 完全相等 ⇒ 档不是「顺手砍层」）。
      it('小豆档：孔 circle 全跳（仅剩非孔 plate 环），且除孔外逐 kind 计数与满豆档相同', () => {
        expect(countByKind(small, 'circle')).toBe(PLATE_CIRCLES); // hideHole 跳 role==='hole' 全部（facet-4 环+底同跳）
        const a = profileMap(full);
        const b = profileMap(small);
        delete a.circle;
        delete b.circle;
        expect(b).toEqual(a);
      });

      // C5 判别力自证：撤掉 flag ⇒ 孔必须回来。缺此腿则「小豆 0 circle」可能只是风格本来没孔。
      it('判别力自证：传 `drawInset` 不传 `hideHole` ⇒ 孔仍在（差值确由本参造成）', () => {
        expect(countByKind(smallNoFlag, 'circle')).toBe(HOLE_CIRCLES + PLATE_CIRCLES);
      });

      // S5 尺寸通道：两档共用同一条内缩通道（⛔ 不另立尺子 = ADR-0023 DEC-7），且静息档珠面精确可算。
      // ⚠ 精确等式只对「珠面 = 满幅 − inset」的 rect 珠体风格成立；`handdrawn` = 歪多边形自有
      //   FACE_RATIO 尺（MVP 原型登记），通道闭合性由「小 < 满」首断言承接（两档共用同一条 size 入参）。
      it('珠面：小豆 < 满豆；rect 珠体风格另按 `格径 − 2×内缩基准` 精确断言', () => {
        expect(maxOuter(small)).toBeLessThan(maxOuter(full));
        if (s.id !== 'handdrawn') {
          expect(maxOuter(full) * 2).toBeCloseTo(faceAtRest(BEAD_DRAW_INSET), 9);
          expect(maxOuter(small) * 2).toBeCloseTo(faceAtRest(BEAD_DRAW_INSET_SMALL), 9);
        }
      });

      // A5 前提（逐风格）：含 `liftScaleGain` 的**满抬起**外缘仍 < 格心距之半 ⇒ 选中的组不糊成一片。
      // （旧代理 `maxRectW < BEAD_PITCH` = 宽 < 格心距，与本判据「外缘距 < 半格心距」数值等价，泛化不改语义。）
      it('A5 零重叠：满抬起增益后珠体外缘仍 < 格心距之半（BEAD_PITCH/2）', () => {
        const lifted = emit({ ...base, lift: SELECT_LIFT_PX });
        const liftedSmall = emit({
          ...base,
          drawInset: BEAD_DRAW_INSET_SMALL,
          hideHole: true,
          lift: SELECT_LIFT_PX,
        });
        expect(maxOuter(lifted)).toBeLessThan(BEAD_PITCH / 2);
        expect(maxOuter(liftedSmall)).toBeLessThan(BEAD_PITCH / 2);
        // 抬起确实放大了珠体（否则上一条 `< BEAD_PITCH/2` 可能因为「档根本没生效」而恒真）。
        expect(maxOuter(lifted)).toBeGreaterThan(maxOuter(full));
      });

      // 封箱友好性（S5 与 zoom 等比修复共用同一不变式）：默认档不传参 ⇒ 与静息基准同值。
      it('静息档零变更：满豆（不传参）与显式传 `BEAD_DRAW_INSET` 逐字节等值', () => {
        const explicit = emit({ ...base, drawInset: BEAD_DRAW_INSET });
        expect(JSON.stringify(explicit.commands)).toBe(JSON.stringify(full.commands));
      });
    });
  }
});
