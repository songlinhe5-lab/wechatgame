/**
 * WXG-T-1102 · blitdbg 开关自证的最小静态判据。
 *
 * host 文件顶层 `import 'cc'`，Node 下不可导入 ⇒ 只能用源码门锁定公开开关契约。
 * 目标是让真机 Console 调用 `__BLITDBG(true)` 后有回显，且 `__BLITDBG()` 能查状态。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'cocos/assets/scripts/host/beads-blit-carrier.ts',
);

describe('WXG-T-1102 blitdbg 开关自证', () => {
    it('__BLITDBG 支持无参查询且翻转时打 warn 回显', () => {
        const src = readFileSync(HOST, 'utf8');
        expect(src).toContain('__BLITDBG?: (on?: boolean) => boolean');
        expect(src).toMatch(/__BLITDBG = \(on\?: boolean\): boolean => \{[\s\S]{0,240}?if \(on !== undefined\) _blitDbg = !!on;/);
        expect(src).toMatch(/console\.warn\(`\[blitdbg\] switch \$\{_blitDbg \? 'on' : 'off'\}`\)/);
        expect(src).toContain('return _blitDbg;');
    });
});
