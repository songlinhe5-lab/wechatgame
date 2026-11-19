/**
 * S11 策略注册表（EP15-S1）：扩展点 = 新策略必须通过同一套契约测试
 * （确定性、无 RNG、只读观测、不越权写状态；见 `bot-replay §2.2.2`）。
 */

import { createGreedyAcbPolicy, type GreedyAcbOptions } from './policy-greedy-acb.js';
import type { BotPolicy } from './types.js';

export const BOT_POLICY_DEFAULT = 'greedy-acb';

export function createBotPolicy(id: string = BOT_POLICY_DEFAULT): BotPolicy {
  if (id === BOT_POLICY_DEFAULT) return createGreedyAcbPolicy();
  throw new Error(`createBotPolicy: 未知策略 ${JSON.stringify(id)}（首版仅 ${BOT_POLICY_DEFAULT}）`);
}

/** 取证/实验扫描用：同一内核的可调构造（⛔ 玩家入口不走这里）。 */
export function createBotPolicyForForensics(options: GreedyAcbOptions): BotPolicy {
  return createGreedyAcbPolicy(options);
}
