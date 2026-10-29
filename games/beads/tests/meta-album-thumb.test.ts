/**
 * `[WXG-T-478]` 图鉴缩略接通 —— album 格从「语义色块占位」升级为 `drawLevelThumb` 珠拼缩略。
 *
 * 机械锚（不钉美术版式、不重推格几何）：
 *  - 不给 `albumLevels`（旧调用方 / 合成数据）⇒ 回落占位：**零珠阵指令**；
 *  - 给 `albumLevels` ⇒ 每关格内新增珠阵指令（指令数至少 + 关数，即每关 ≥ 1 条）。
 * 珠色灰阶 / 版式细节走 `drawLevelThumb` 既有测试与金样本，不在本文件重钉。
 */

import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaModal, type MetaViewData } from '../src/view/meta-view.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { DESIGN_H, DESIGN_W } from '../src/config/tuning.js';

const dataFor = (extra: Partial<MetaViewData> = {}): MetaViewData => ({
    stamina: 5,
    staminaMax: 5,
    coins: 0,
    overlay: 'album',
    signinDay: 0,
    canClaim: false,
    bgmMuted: false,
    sfxMuted: false,
    reduceMotion: false,
    largeText: false,
    vibrate: true,
    debugInfo: false,
    debugGuides: false,
    beadStyle: 'facet-4',
    beadSize: 'full',
    skinId: 'tokens',
    levelCount: LEVELS.length,
    currentLevelIndex: 0,
    maxUnlockedLevel: LEVELS.length,
    // 全零星 ⇒ 十格都走「未通关」臂（灰墨集 + 锁形）。
    starsByLevel: LEVELS.map(() => 0),
    wallSlots: [],
    wallLevels: [],
    carouselLevel: LEVELS[0],
    carouselState: 'pushing',
    ...extra,
});

const frame = (data: MetaViewData): readonly DrawCommand[] => {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    // 只量弹窗自身（底页主菜单由 `buildMetaView` 另画，与本页内容无关）。
    buildMetaModal(builder, data, DEFAULT_PALETTE);
    return builder.end().commands;
};

describe('[WXG-T-478] 图鉴缩略接线', () => {
    it('不给 albumLevels ⇒ 回落语义底占位（与接通前同构）', () => {
        const commands = frame(dataFor());
        // 面板 chrome（标题 / 返回钮 / 底槽）+ 10 格底 + 10 组星条 + 合计文案；
        // 珠阵不出现 ⇒ 指令数与「每格 1 底槽 + 1 锁形 + 3 星条 + 关号」一致。
        expect(commands.length).toBeLessThan(120);
    });

    it('给 albumLevels ⇒ 每关格内新增珠阵（指令数至少 + 关数）', () => {
        const plain = frame(dataFor());
        const withThumbs = frame(dataFor({ albumLevels: LEVELS }));
        const cells = Math.min(10, LEVELS.length);
        expect(withThumbs.length).toBeGreaterThanOrEqual(plain.length + cells);
    });
});
