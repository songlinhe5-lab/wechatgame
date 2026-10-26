/**
 * 效果派发（协作模块）—— BeadsGame 与平台副作用服务（音频 / 触觉 / 激励广告 / 分享）
 * 之间的**唯一派发面**。自 `beads-game.ts` 抽出（WXG-T-420 T5）：`_subscribe` 的音频
 * 订阅块、`_emit` 的触觉派生表、`_share` 的透传，以及三处 `ad.load()+ad.show()` 的
 * 广告 / 体力弹窗点火。
 *
 * 为什么是**模块函数**而非协作类：本模块**零实例状态**（只做「事件 → 副作用」的查表与
 * 转发），与 `hit-test.ts`（无状态命中几何）同型；上游 `feedback-fx.ts` 那类持时钟态的
 * 才需要类。⛔ 不为「统一形态」造无状态的壳（ponytail / YAGNI）。
 *
 * 边界（⛔ 不在本模块，留在 BeadsGame）：
 *   · 广告发奖的**状态路由** —— `_adKind` / `_watchingAd` / `_pendingRunStart` / 续时账 /
 *     相位机转移 / `_onAdRewarded` 的三岔裁决 / `_gateRunStart` 与体力闸门决策；
 *   · 广告回调（onRewarded / onClose / onError）的**装配** —— 它们把服务事件接回上述状态，
 *     属状态机接线而非副作用派发，仍住 `_subscribe`（订阅序不变）；
 *   · 何时发声 / 何时点火 / 何时分享的**判据**（相位、限流、闸门）—— 本模块只负责「发出去」。
 *
 * 行为红线：音频订阅序、clip 映射、触觉映射、ad load→show 序、share 透传口径**逐字保持**；
 * 端到端时序与限流由 `audio-dispatch.test.ts` 守，模块契约由 `effects-dispatch.test.ts` 守。
 */
import type {
  EventBus,
  EventMap,
  GameServices,
  HapticKind,
  RewardedAdPlacement,
  RewardedAdProvider,
} from '../../../framework/index';
import {
  AUDIO_CLIP_CLEAR,
  AUDIO_CLIP_COMBO_BREAK,
  AUDIO_CLIP_COMBO_T1,
  AUDIO_CLIP_COMBO_T2,
  AUDIO_CLIP_COMBO_T3,
  AUDIO_CLIP_DISSOLVE,
  AUDIO_CLIP_PLACE,
  AUDIO_CLIP_POWERUP,
  AUDIO_CLIP_REJECT,
  AUDIO_CLIP_SELECT,
  AUDIO_CLIP_STAGE,
  AUDIO_CLIP_TRAY_FULL,
  AUDIO_CLIP_URGENT_BEAT,
  TIMER_URGENT_T,
} from '../../config/tuning';

/**
 * 事件 → haptic kind 映射表（WXG-T-403）。
 *
 * 选则准则：
 * - 轻量连续反馈 → light（放珠 = 微振动确认）
 * - 中等反馈 → medium（连击递进、道具 = 值得"注意"的正反馈）
 * - 强反馈 → heavy（碰撞反弹、连击断裂 = 值得"警惕"的负反馈）
 * - 结算 → success / warning（过关/失败各一端）
 *
 * 故意不映射：tray/*, timer/*, settings/*, meta/*, game/*, sprint/* —
 * 要么太细要么是元事件。
 */
const HAPTIC_MAP: ReadonlyMap<string, HapticKind> = new Map<string, HapticKind>([
  ['bead:placed', 'light'],
  ['bead:rejected', 'heavy'],
  ['combo:up', 'medium'],
  ['combo:break', 'heavy'],
  ['level:cleared', 'success'],
  ['level:failed', 'warning'],
  ['powerup:used', 'medium'],
]);

/**
 * 事件类型 → 触觉 kind（`undefined` = 不派生）。`_emit` 在广播源事件后**同步**查此表并补发
 * `haptic:trigger`（时基不变：仍在 `_emit` 尾部，晚于该事件的所有总线订阅者）。
 * 调用方负责 `type === 'haptic:trigger'` 的防递归早退。
 */
export function hapticKindFor(type: string): HapticKind | undefined {
  return HAPTIC_MAP.get(type);
}

/**
 * 音频派发订阅（WXG-T-096 / BD-05）：clip 选择**只**按 `audio-events §1` 的触发源事件，
 * 时长与限流不在这里发明（真源 = §1 表 + §3.2 分档 + §3.12 冻结值，均在 `GameSettings.sfx`
 * 与 tuning）。返回的 unsub 数组由调用方并入 `_unsubs`，`dispose()` 时统一解绑。
 *
 * ⛔ 注册序即原 `_subscribe` 音频块序，逐条对齐；调用点须在数据投影订阅（bead:placed →
 * tray.consumeNeeded）之后，保持同一事件上「投影先于发声」的既有先后。
 */
export function attachAudioCues(
  bus: EventBus<EventMap>,
  sfx: (clipId: string) => void,
): (() => void)[] {
  return [
    bus.on('bead:placed', () => sfx(AUDIO_CLIP_PLACE)),
    bus.on('tray:selected', () => sfx(AUDIO_CLIP_SELECT)),
    bus.on('bead:rejected', () => sfx(AUDIO_CLIP_REJECT)),
    // A05-07：道具生效帧两条并存（id 不同 ⇒ 不被同帧去重吞掉）；
    //         `affectedCells` 为空 ⇒ **零发声**（powerups §4 零噪声原则）。
    //         BD-49（WXG-T-151 实证 / WXG-T-154 修复）：v1.22 payload 改名旧字段
    //         `affectedSlots` 残留读本分支恒 undefined 早退 ⇒ 真链零发声；现读 L171 契约字段。
    bus.on('powerup:used', (payload) => {
      const cells = (payload as { affectedCells?: readonly { row: number; col: number }[] }).affectedCells;
      if (!cells || cells.length === 0) return;
      sfx(AUDIO_CLIP_POWERUP);
      sfx(AUDIO_CLIP_DISSOLVE);
    }),
    // A05-08：三档分流不串音；`tier=0`（未升档）零发声。
    bus.on('combo:up', (payload) => {
      const tier = (payload as { tier: number }).tier;
      if (tier === 3) sfx(AUDIO_CLIP_COMBO_T3);
      else if (tier === 2) sfx(AUDIO_CLIP_COMBO_T2);
      else if (tier === 1) sfx(AUDIO_CLIP_COMBO_T1);
    }),
    // A05-10：两种 `reason` 同一 clip（§5 只一行）；`wrong` 时与 `sfx_reject` 同帧
    //         并存不互斥（双通道红线优先，Q-A05-3 采推荐项）。
    bus.on('combo:break', () => sfx(AUDIO_CLIP_COMBO_BREAK)),
    // A05-D7：首拍由 `timer:urgent` **边沿**驱动，后续每拍由 `timer:tick` 驱动；
    //         同帧两条都到 ⇒ scheduler 入队去重 + 0.9s 限流 ⇒ 仍恰一拍。
    bus.on('timer:urgent', () => sfx(AUDIO_CLIP_URGENT_BEAT)),
    bus.on('timer:tick', (payload) => {
      const remaining = (payload as { remaining: number }).remaining;
      if (remaining <= TIMER_URGENT_T) sfx(AUDIO_CLIP_URGENT_BEAT);
    }),
    // A05-14：每次 `tray:full` 恰 1 次（**不循环**；500ms 呼吸属视觉，互不驱动）。
    // ⛔ v2.0 供料关停（WXG-T-136）：`tray:full` 玩法侧零发射（systems-index §4 作废），
    // 本监听为**死路径保留**——满槽告警视觉改由槽态驱动（view-model 读 `freeSlots`），
    // 不经本事件；供料复活时自动恢复发声。`AUDIO_CLIP_TRAY_FULL` 仍留在 A05-24
    // 19-clip 闭合集内（audio-events §1 未删行，音频域文件本单禁改）。
    bus.on('tray:full', () => sfx(AUDIO_CLIP_TRAY_FULL)),
    bus.on('sprint:stage', () => sfx(AUDIO_CLIP_STAGE)),
    bus.on('level:cleared', () => sfx(AUDIO_CLIP_CLEAR)),
  ];
}

/**
 * 激励广告 / 体力弹窗点火单点：`load(placement)` → `show()`（序即真机契约）。
 * 「宿主无广告位」「已在飞」「相位不符」等**降级 / 闸门判据**由调用方先决（属状态机），
 * 本函数只在已决定点火后把两步入服务。
 */
export function fireRewardedAd(ad: RewardedAdProvider, placement: RewardedAdPlacement): void {
  ad.load(placement);
  ad.show();
}

/**
 * 分享透传（WXG-T-405）：直接交给平台层 `services.share?.()`，宿主无分享能力（Node/harness）
 * 时静默 noop，分享抛错一律吞掉（⛔ 分享失败不得打断玩法）。卡片内容待真机验证后定制，
 * 当前只透传空 opts。
 */
export function fireShare(services: GameServices): void {
  const share = services.share;
  if (!share) return;
  try {
    share({});
  } catch {
    /* ignore */
  }
}
