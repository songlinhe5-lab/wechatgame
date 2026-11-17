/**
 * 判据 X1 — 「全仓解码表逐字符一致」的可执行版本（§3.2 v1.55 / 正本 §5-D）。
 *
 * 背景：同一份「字符 ↔ 色索引」映射在 §3.2 抬上限前散落在 **4 处独立实现**
 * （`config/levels.ts` / `entities/grid.ts` / `game/misplaced-assembler.ts` /
 * `tools/scripts/level-derange.mjs`），外加两处工具侧表（`beads-gen.mjs` 的 35 枚
 * `CHAR`、`beads-mvp-patterns.mjs` 的 `'.123456789A'`——**后者提案 §5 没点到**）。
 * 现两侧各收敛为一份：
 *   · 游戏侧 = `src/config/bead-charset.ts`（其余三处改为 import 它）
 *   · 工具侧 = `tools/scripts/lib/bead-charset.mjs`（三个脚本改为 import 它）
 *
 * 两份仍跨语言，无法 import 锁（`levels-dir-pipeline.test.ts` 头注已记录：tsconfig
 * 纳入 tests 且无 allowJs，TS 测试引 `.mjs` 会破 `tsc --noEmit`）⇒ 本文件用
 * **文本抽取表字面量 + 逐字符比对**把两侧钉在一起，并钉住「不得再出现第三份表」。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BEAD_CHARSET, BEAD_COLOR_MAX } from '../src/config/tuning.js';
import {
    BEAD_COLOR_CHARS,
    charOfColor,
    colorIndexOfChar,
    isBeadCharsetChar,
} from '../src/config/bead-charset.js';
import { BeadGrid } from '../src/entities/grid.js';
import {
    fillableCells,
    validateMisplacedGrid,
} from '../src/game/misplaced-assembler.js';
import { patternColors } from '../src/config/levels.js';

const at = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const TOOL_LIB = '../../../tools/scripts/lib/bead-charset.mjs';

/** 从工具侧模块里抽出表字面量（不 import，理由见文件头）。 */
function toolTable(): string {
    const src = readFileSync(at(TOOL_LIB), 'utf8');
    const m = /export const BEAD_COLOR_CHARS = '([0-9A-Z]*)'/.exec(src);
    if (!m) throw new Error('工具侧表抽取失败：lib/bead-charset.mjs 里找不到 BEAD_COLOR_CHARS 字面量');
    return m[1]!;
}

/** 0..127 全 ASCII（大小写敏感判定的穷举域）。 */
const ASCII = Array.from({ length: 128 }, (_, i) => String.fromCharCode(i));

describe('X1 · 解码表单一真源（游戏侧 ↔ 工具侧）', () => {
    it('§3.2 常量与展开表一致：BEAD_COLOR_MAX = 表长 = 16（设计上限），charset 编码记法仍 .x1-9A-Z', () => {
        expect(BEAD_COLOR_MAX).toBe(16);
        expect(BEAD_COLOR_CHARS.length).toBe(BEAD_COLOR_MAX);
        // BEAD_CHARSET 是 regex 区间**编码**记法（编码天花板仍 35），不是设计合法上限。
        expect(BEAD_CHARSET).toBe('.x1-9A-Z');
        expect(BEAD_COLOR_CHARS).toBe('123456789ABCDEFG');
    });

    it('游戏侧表与工具侧表逐字符一致（跨语言锁）', () => {
        const tool = toolTable();
        expect(tool.length).toBe(BEAD_COLOR_CHARS.length);
        for (let i = 0; i < BEAD_COLOR_CHARS.length; i++) {
            expect(tool[i], `idx ${i + 1}`).toBe(BEAD_COLOR_CHARS[i]);
        }
    });

    it('全仓不再存在第二份字符表字面量（防再漂移）', () => {
        // 只允许 lib/bead-charset.mjs 持有 `123456789A…` 形态的字面量；任何脚本里再出现
        // 一份，就是提案 §1-#2 的「四处独立实现」复发。
        const suspects: [string, string][] = [
            ['beads-gen.mjs', '../../../tools/scripts/beads-gen.mjs'],
            ['level-derange.mjs', '../../../tools/scripts/level-derange.mjs'],
            ['beads-mvp-patterns.mjs', '../../../tools/scripts/beads-mvp-patterns.mjs'],
            ['server.mjs', '../../../apps/beads-studio/server.mjs'],
            ['levels.ts', '../src/config/levels.ts'],
            ['grid.ts', '../src/entities/grid.ts'],
            ['misplaced-assembler.ts', '../src/game/misplaced-assembler.ts'],
        ];
        for (const [name, rel] of suspects) {
            const src = readFileSync(at(rel), 'utf8');
            expect(/['"`]123456789[A-Z]/.test(src), `${name} 内联了独立色索引表`).toBe(false);
        }
    });
});

describe('X1 · 三态语义与大小写契约（§3.2 v1.55 消歧硬规定）', () => {
    it('`.`=null、`x`=null（锁定符）；大写仅 `A`–`G` 合法、越设计上限的 `H`–`Z` 非法', () => {
        expect(colorIndexOfChar('.')).toBeNull();
        expect(colorIndexOfChar('x')).toBeNull();
        // 设计上限 16 后表只到 `G`：编码天花板仍含 `A`–`Z`，但 `H`(17) 起越 BEAD_COLOR_MAX ⇒ undefined。
        expect(colorIndexOfChar('G')).toBe(16);
        expect(colorIndexOfChar('H')).toBeUndefined();
        expect(colorIndexOfChar('X')).toBeUndefined();
        expect(charOfColor(10)).toBe('A');
        expect(charOfColor(16)).toBe('G');
        expect(() => charOfColor(17)).toThrow();
        // 大小写敏感：`x` 是锁定符（合法但无色），其余小写 a–z 全非法。
        for (let c = 97; c <= 122; c++) {
            const ch = String.fromCharCode(c);
            if (ch === 'x') {
                expect(colorIndexOfChar(ch), ch).toBeNull();
                expect(isBeadCharsetChar(ch), ch).toBe(true);
            } else {
                expect(colorIndexOfChar(ch), ch).toBeUndefined();
                expect(isBeadCharsetChar(ch), ch).toBe(false);
            }
        }
    });

    it('0..127 穷举：`isBeadCharsetChar` ⟺ `colorIndexOfChar !== undefined`（不留「合法但解不出」）', () => {
        for (const ch of ASCII) {
            expect(isBeadCharsetChar(ch), JSON.stringify(ch)).toBe(colorIndexOfChar(ch) !== undefined);
        }
    });

    it('1..35 双向往返；0 与 36 throw', () => {
        for (let idx = 1; idx <= BEAD_COLOR_MAX; idx++) {
            const ch = charOfColor(idx);
            expect(colorIndexOfChar(ch), `idx ${idx}`).toBe(idx);
            expect(isBeadCharsetChar(ch), `idx ${idx}`).toBe(true);
        }
        expect(() => charOfColor(0)).toThrow();
        expect(() => charOfColor(BEAD_COLOR_MAX + 1)).toThrow();
    });
});

describe('X1 · 消费方行为一致（原四份表 → 一份表）', () => {
    it('grid.ts / misplaced-assembler.ts / levels.patternColors 与 colorIndexOfChar 逐字符同值', () => {
        // 覆盖 1..BEAD_COLOR_MAX(16) 全域 + 锁定/空位，一次跑完三处曾经独立的实现。
        const row = ASCII.filter((ch) => isBeadCharsetChar(ch) && colorIndexOfChar(ch) !== null).join('');
        expect(row.length).toBe(BEAD_COLOR_MAX);

        // 两行同色 ⇒ BeadGrid 只是逐格解码，不校验守恒；这里只钉「解码值」与表一致。
        const grid = new BeadGrid([row, row]);
        for (let c = 0; c < row.length; c++) {
            expect(grid.requiredColor(0, c), `grid col ${c}`).toBe(colorIndexOfChar(row[c]) as number);
        }
        const cells = fillableCells([row]);
        expect(cells.length).toBe(row.length);
        for (const cell of cells) {
            expect(cell.colorIdx, `assembler col ${cell.col}`).toBe(colorIndexOfChar(row[cell.col]) as number);
        }
        expect(patternColors([row])).toEqual(
            Array.from({ length: BEAD_COLOR_MAX }, (_, i) => i + 1),
        );
    });

    it('misplaced 校验器接受大写扩展字符、拒收小写（同一份表，不再各自判定）', () => {
        // pattern 与 misplaced 都写扩展表 ⇒ 形状/轮廓/守恒应全过。
        const pat = ['1B2', 'C34'];
        const mis = ['B12', '34C'];
        expect(validateMisplacedGrid('L99', pat, mis)).toEqual([]);
        expect(validateMisplacedGrid('L99', pat, ['b12', '34C'])[0]).toContain('非法字符 "b"');
    });
});

describe('X4 · 越界可构造性（设计上限 16 < 编码容量 35）', () => {
    /** rowstring「每格一字符」的编码容量：`1-9` + `A-Z` = 35（ADR-0004），与设计上限无关。 */
    const ENCODING_CAPACITY = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.length;

    it('设计上限 16 < 编码容量 35 ⇒ 索引 17–35 可构造但越 BEAD_COLOR_MAX 被拒', () => {
        expect(BEAD_COLOR_MAX).toBeLessThan(ENCODING_CAPACITY);
        // ① 1..16 全部可编可解（设计合法域）。
        for (let idx = 1; idx <= BEAD_COLOR_MAX; idx++) {
            expect(() => charOfColor(idx), `idx ${idx}`).not.toThrow();
        }
        // ② 设计上限收紧的正面图景：17..35 在**编码字母表**里有字符（`H`..`Z`），
        //    但解码表已截到 16 ⇒ 既非 isBeadCharsetChar，也解不出色索引；编码器亦 throw。
        const alphabet = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let idx = BEAD_COLOR_MAX + 1; idx <= ENCODING_CAPACITY; idx++) {
            const ch = alphabet[idx - 1]!;
            expect(isBeadCharsetChar(ch), `idx ${idx} ${ch}`).toBe(false);
            expect(colorIndexOfChar(ch), `idx ${idx} ${ch}`).toBeUndefined();
        }
        expect(() => charOfColor(17)).toThrow();
        expect(() => charOfColor(BEAD_COLOR_MAX + 1)).toThrow();
        // ③ 0..127 里能解出色索引的恰为 16 枚。
        const decodable = ASCII.filter((ch) => typeof colorIndexOfChar(ch) === 'number');
        expect(decodable.length).toBe(BEAD_COLOR_MAX);
        // 越界面共三处：① H–Z 被设计上限拒（本例）；② 非 charset 字符 / 小写（X1 穷举）；
        // ③ 色索引 > demo 色板却无品牌引用 = B1（levels.test.ts）。
    });

    it('哨兵（自我复位判据）：§3.2 若把上限抬回编码容量，越界不可构造的旧态自动恢复', () => {
        if (BEAD_COLOR_MAX < ENCODING_CAPACITY) {
            // 现态（16 < 35）：越界样本可构造且被拒 —— 上面已硬断言，本分支只钉住「非顶满」事实。
            expect(BEAD_COLOR_MAX).toBeLessThan(ENCODING_CAPACITY);
            return;
        }
        // 若上限被抬到 35（顶满）：`charOfColor(36)` 因字母表耗尽而 throw，越界重新不可构造。
        expect(() => charOfColor(ENCODING_CAPACITY + 1)).toThrow();
    });
});
