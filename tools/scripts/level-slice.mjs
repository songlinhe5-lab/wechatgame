#!/usr/bin/env node
/**
 * level-slice.mjs — 母版图案按纯尺寸均分切块（关卡内容管线 P2，spec §0）。
 * 每方向：k = ceil(n / gridMax)，base = floor(n / k)，余数 rem = n - base*k 加到
 * **末尾 rem 块** 各 +1（保证每块 ≤ gridMax 且尽量均匀）。横纵各独立算一次。
 * 纯函数，无 IO。pattern / misplaced 为 rowstring 数组（行优先，行长 = cols）。
 *
 * 验证：51→[25,26]，100→[50,50]，101→[33,34,34]，≤50 → 单段不切。
 */

/** 一维均分：返回各块长度（和 === n，每项 ≤ gridMax，余数加末尾）。 */
export function splitRuns(n, gridMax) {
  const k = Math.max(1, Math.ceil(n / gridMax));
  const base = Math.floor(n / k);
  const rem = n - base * k;
  return Array.from({ length: k }, (_, i) => base + (i >= k - rem ? 1 : 0));
}

/**
 * 母版 → { gridCols, gridRows, cells }，cells 行优先（r 外层、c 内层）。
 * @param {{pattern:string[], misplaced?:string[], cols:number, rows:number, gridMax?:number}} board
 * @returns {{gridCols:number, gridRows:number, cells:Array<{row:number,col:number,cols:number,rows:number,pattern:string[],misplaced?:string[]}>}}
 */
export function sliceBoard({ pattern, misplaced, cols, rows, gridMax = 50 }) {
  const colRuns = splitRuns(cols, gridMax);
  const rowRuns = splitRuns(rows, gridMax); // 纵横向同一均分规则（≤50 自然不切）
  const cells = [];
  let rowOffset = 0;
  for (let r = 0; r < rowRuns.length; r++) {
    const h = rowRuns[r]; // 本行块高（跨列恒定，须在外层行循环声明供 rowOffset 累加）
    let colOffset = 0;
    for (let c = 0; c < colRuns.length; c++) {
      const w = colRuns[c];
      const cell = {
        row: r,
        col: c,
        cols: w,
        rows: h,
        pattern: pattern.slice(rowOffset, rowOffset + h).map((line) => line.slice(colOffset, colOffset + w)),
      };
      if (Array.isArray(misplaced)) {
        cell.misplaced = misplaced
          .slice(rowOffset, rowOffset + h)
          .map((line) => line.slice(colOffset, colOffset + w));
      }
      cells.push(cell);
      colOffset += w;
    }
    rowOffset += h;
  }
  return { gridCols: colRuns.length, gridRows: rowRuns.length, cells };
}
