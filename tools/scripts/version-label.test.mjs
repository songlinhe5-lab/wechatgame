import test from 'node:test';
import assert from 'node:assert/strict';

import { stampReleaseLabel } from './lib/version-label.mjs';

// 判别腿：USER 2026-10-28 裁 C（分环境）——开发/harness 显「演示版」，发布产物只显版本号。
// 源码侧「恒留后缀」由 `games/beads/tests/meta-menu-wall.test.ts` 钉住，两侧成对。

test('发布档：打本次 build 号 + 剥「· 演示版」', () => {
    assert.equal(stampReleaseLabel('v1.0.0 · 演示版', '1.0.3'), 'v1.0.3');
});

test('发布档：基线本无后缀 ⇒ 只打号', () => {
    assert.equal(stampReleaseLabel('v1.0.0', '1.0.3'), 'v1.0.3');
});

test('发布档：基线 build 段已与 package.json 漂移也能打号（T-473「永不打号」判例）', () => {
    assert.equal(stampReleaseLabel('v1.0.9 · 演示版', '1.0.10'), 'v1.0.10');
});

test('基线无版本段 ⇒ null（调用方 warn 不挡构建，⛔ 不静默当成功）', () => {
    assert.equal(stampReleaseLabel('演示版', '1.0.3'), null);
});
