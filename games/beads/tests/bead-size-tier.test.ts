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
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
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

/** 一颗珠的命令流（`(100,200)` 格心、`size = BEAD_CELL` = 静息档格径）。 */
function emit(opts: FilledBeadOptions): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  drawFilledBead(builder, 100, 200, 1, opts);
  return builder.end().commands;
}

const countByKind = (cs: readonly DrawCommand[], kind: DrawCommand['kind']): number =>
  cs.filter((c) => c.kind === kind).length;

/** 逐 kind 计数表（供「两档只差一枚孔」的等式比较）。 */
function profileMap(cs: readonly DrawCommand[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of cs) m[c.kind] = (m[c.kind] ?? 0) + 1;
  return m;
}

/** 珠体外缘代理 = 全部 rect 的最大宽（三套注册风格的 `plate`/`body` 均 = 珠面满幅）。 */
function maxRectW(cs: readonly DrawCommand[]): number {
  let max = 0;
  for (const c of cs) {
    if (c.kind === 'rect' && c.w > max) max = c.w;
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
      it('满豆档：恰 1 枚孔 `circle`（K3 透色通道在场）', () => {
        expect(countByKind(full, 'circle')).toBe(1);
      });

      // C5 右半：小豆档不含孔图元，且**只**少孔（其余层一族逐 kind 完全相等 ⇒ 档不是「顺手砍层」）。
      it('小豆档：0 枚孔 `circle`，且除孔外逐 kind 计数与满豆档相同', () => {
        expect(countByKind(small, 'circle')).toBe(0);
        const a = profileMap(full);
        const b = profileMap(small);
        delete a.circle;
        delete b.circle;
        expect(b).toEqual(a);
      });

      // C5 判别力自证：撤掉 flag ⇒ 孔必须回来。缺此腿则「小豆 0 circle」可能只是风格本来没孔。
      it('判别力自证：传 `drawInset` 不传 `hideHole` ⇒ 孔仍在（差值确由本参造成）', () => {
        expect(countByKind(smallNoFlag, 'circle')).toBe(1);
      });

      // S5 尺寸通道：两档共用同一条内缩通道（⛔ 不另立尺子 = ADR-0023 DEC-7），且静息档珠面精确可算。
      it('珠面：小豆 < 满豆 且两档均按 `格径 − 2×内缩基准` 精确收窄', () => {
        expect(maxRectW(full)).toBeCloseTo(faceAtRest(BEAD_DRAW_INSET), 9);
        expect(maxRectW(small)).toBeCloseTo(faceAtRest(BEAD_DRAW_INSET_SMALL), 9);
        expect(maxRectW(small)).toBeLessThan(maxRectW(full));
      });

      // A5 前提（逐风格）：含 `liftScaleGain` 的**满抬起**外缘仍 < 格心距 ⇒ 选中的组不糊成一片。
      it('A5 零重叠：满抬起增益后珠体外缘仍 < 格心距（BEAD_PITCH）', () => {
        const lifted = emit({ ...base, lift: SELECT_LIFT_PX });
        const liftedSmall = emit({
          ...base,
          drawInset: BEAD_DRAW_INSET_SMALL,
          hideHole: true,
          lift: SELECT_LIFT_PX,
        });
        expect(maxRectW(lifted)).toBeLessThan(BEAD_PITCH);
        expect(maxRectW(liftedSmall)).toBeLessThan(BEAD_PITCH);
        // 抬起确实放大了珠体（否则上一条 `< BEAD_PITCH` 可能因为「档根本没生效」而恒真）。
        expect(maxRectW(lifted)).toBeGreaterThan(maxRectW(full));
      });

      // 封箱友好性（S5 与 zoom 等比修复共用同一不变式）：默认档不传参 ⇒ 与静息基准同值。
      it('静息档零变更：满豆（不传参）与显式传 `BEAD_DRAW_INSET` 逐字节等值', () => {
        const explicit = emit({ ...base, drawInset: BEAD_DRAW_INSET });
        expect(JSON.stringify(explicit)).toBe(JSON.stringify(full));
      });
    });
  }
});
