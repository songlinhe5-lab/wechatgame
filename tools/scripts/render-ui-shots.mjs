/**
 * render-ui-shots.mjs — 把 beads 的 UI 帧导成 SVG，供**美术还原 review** 逐屏比对
 * （`my-skills/wxgame-art-review/SKILL.md` §2 步 7「出图比对」的取证装置）。
 *
 * 数据来源 = `games/beads/tests/ui-golden-scenes.ts::buildUiGoldenFrames()`（十一帧金样本态：
 * main-menu / level-select / level-select-mid / settings / signin / play / pause / clear / fail /
 * sprint-settle / finish）。⇒ 出图与金样本对拍**同源同种子**，是「实现自证」，⛔ **不是真机证据**
 * （`device-walkthrough §0-4`）。
 *
 * 跑法（仓根）：
 *   node --experimental-transform-types \
 *        --import=./tools/scripts/lib/ts-js-resolve.mjs \
 *        tools/scripts/render-ui-shots.mjs
 * 产物：`temp/ui-shot/<stateId>.svg`（`temp/` 属 gitignore）。
 * 转 PNG 供人眼/模型比对：`qlmanage -t -s 750 -o <dir> <file.svg>`（macOS）。
 *
 * 已知缺口（⛔ 别当已覆盖）：
 *  - **boot 屏不在金样本态**里（`ui-golden-scenes` 无该态）⇒ 六屏走查的 boot 只能真机取；
 *  - **album / localRank / profile 三页当前不可达**：`open-album`/`open-local-rank`/`open-profile`
 *    只存在于 `meta-types.ts` 动作联合 + `beads-shell.ts` switch，**没有布局文件发这些热区**
 *    ⇒ 无入口、无法出图，也无法真机走查（2026-10-28 WXG-T-478 实测）。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { modelToSvg } from './lib/render-model-svg.mjs';
import { buildUiGoldenFrames } from '../../games/beads/tests/ui-golden-scenes.js';

const OUT_DIR = new URL('../../temp/ui-shot/', import.meta.url);

mkdirSync(OUT_DIR, { recursive: true });

const frames = buildUiGoldenFrames();
for (const frame of frames) {
    writeFileSync(new URL(`${frame.id}.svg`, OUT_DIR), modelToSvg(frame.model), 'utf8');
}

console.log(`🖼  ${frames.length} 帧 → ${fileURLToPath(OUT_DIR)}`);
console.log(`    ${frames.map((f) => f.id).join(' · ')}`);
