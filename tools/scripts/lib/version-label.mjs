/**
 * 发布档版本行单源（`[WXG-T-473 / USER 2026-10-28 裁 C：分环境]`）。
 *
 * 源码基线（`copy-tokens.ts::version_label`）**恒留**状态后缀 —— harness / 调试构建 / 金样本
 * 都显 `v1.0.0 · 演示版`；发布产物（`platform=wechatgame` 且非 `--debug`）打号时**连同后缀整体
 * 剥掉**，只显 `v1.0.3`。⛔ 不改源码值：发布文案单源仍在 copy-tokens，剥后缀只是版本腿的
 * 构建期动作（源码后缀由 `meta-menu-wall.test.ts` 钉住，两者成对才不假绿）。
 */

/** 版本段 = 任意 `vMAJOR.MINOR.BUILD`（⛔ 不按字面旧号找，见 T-473「二建起永不打号」判例）。 */
const VERSION_SEGMENT = /v\d+\.\d+\.\d+/;

/** 状态后缀 = ` · …`（「· 演示版」等）——发布档只显版本号，任何尾巴一并剥。 */
const STATUS_SUFFIX = /\s*·.*$/;

/**
 * 把源码基线 label 打成发布 label。
 *
 * @param {string} baseLabel 源码基线（如 `v1.0.0 · 演示版`）
 * @param {string} newVer 本次 build 号（如 `1.0.3`）
 * @returns {string|null} 发布 label（如 `v1.0.3`）；基线段缺失 ⇒ `null`（调用方 warn 不挡构建）
 */
export function stampReleaseLabel(baseLabel, newVer) {
    if (!VERSION_SEGMENT.test(baseLabel)) return null;
    return baseLabel.replace(VERSION_SEGMENT, `v${newVer}`).replace(STATUS_SUFFIX, '').trim();
}
