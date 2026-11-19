/**
 * EP15-S3 · 关卡内容指纹（ADR-0038 DEC-3 / `bot-replay §2.3.1`）。
 *
 * 目的 = 防「关卡数据已更新、旧录像重演到另一张盘」：指纹不一致 ⇒ 录像 `invalid`，
 * 不做兼容迁移。算法 = 框架 `hashSeed`（FNV-1a），输入 = **固定字段序**的规范化串
 * （JSON 键序不参与 ⇒ 同内容跨构建稳定）。
 */

import { hashSeed } from '../../framework/index';
import { levelIdOf, type BeadsLevelRaw } from '../config/levels';

/** 稳定关卡身份串 —— 复用框架面 `levelIdOf`（`l<id>`，与 `observeGame().levelId` 同口径）。 */
export { levelIdOf };

/**
 * 规范化串：字段序**写死**在本函数（⛔ 用 `JSON.stringify(level)` 直接拍——
 * 键序/可选字段在场性会随构建漂移）。
 */
export function canonicalLevelString(level: BeadsLevelRaw): string {
  return [
    level.uid,
    level.id,
    level.cols,
    level.rows,
    level.time,
    (level.starTierK ?? []).join(','),
    level.cycleProfile,
    level.decoys.join(','),
    (level.misplaced ?? []).join('|'),
    level.swaps.map((s) => s.join(',')).join('|'),
    level.pattern.join('|'),
    level.palette ?? '',
    (level.paletteCodes ?? []).join(','),
    level.skin ?? '',
    level.name,
  ].join('\u0001');
}

/** 关卡指纹（16 进制 FNV-1a）。 */
export function levelHash(level: BeadsLevelRaw): string {
  return hashSeed(canonicalLevelString(level)).toString(16);
}
