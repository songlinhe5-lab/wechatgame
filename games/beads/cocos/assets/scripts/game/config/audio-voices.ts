/**
 * audio-voices.ts — beads 的 clip → 合成配方表（WXG-T-096 / BD-05b）。
 *
 * **为什么住在游戏侧而不是框架**：框架的 `SynthAudioBackend` 是引擎，不是素材库。
 * 一旦 `sfx_place` 这类玩法 id 进了 `packages/framework`，框架就认识了一款游戏
 * （违反 ADR-0002 的分层方向）。因此游戏通过 `Game.audioVoices` 把配方交给
 * `Platform.createAudioBackend({ voices })` 渲染 —— 决策记录：ADR-0013。
 *
 * **数值的地位（必读）**：`systems-index §3.12` 明确「音色实现参数不属于 §3」，
 * 而 `audio-spec §4.3` 只冻结**结构**（波形候选 / 包络段 / 滤波类型），所有数值
 * 一律 `[TODO]`（待 `[B]` 后端可听 + `[P]` 人耳定档，见 §8 T1–T3）。所以本文件里
 * 的 Hz / ms / 增益全是**工程占位**：能响、结构对得上 §4.3，但**不得被任何文档
 * 回引为规格值**。唯一硬数值 = 时长上限，引自 `ux-spec §5`（下表每条注明）。
 *
 * `sfx_ui_tap` 的时长在 §5 **无行**（Q-A05-1 待文策渊归位）⇒ 40 ms 是纯占位，
 * 记账在案，不参与 A05-03/09/15/16 的 `[B]` 验收。
 */

import type { AudioVoice, AudioVoices } from '../../framework/index';

import {
  AUDIO_CLIP_BGM,
  AUDIO_CLIP_CLEAR,
  AUDIO_CLIP_COMBO_BREAK,
  AUDIO_CLIP_COMBO_T1,
  AUDIO_CLIP_COMBO_T2,
  AUDIO_CLIP_COMBO_T3,
  AUDIO_CLIP_DISSOLVE,
  AUDIO_CLIP_PANEL_IN,
  AUDIO_CLIP_PANEL_OUT,
  AUDIO_CLIP_PLACE,
  AUDIO_CLIP_POWERUP,
  AUDIO_CLIP_REJECT,
  AUDIO_CLIP_REVIVE_OK,
  AUDIO_CLIP_SELECT,
  AUDIO_CLIP_STAGE,
  AUDIO_CLIP_STAR,
  AUDIO_CLIP_TRAY_FULL,
  AUDIO_CLIP_UI_TAP,
  AUDIO_CLIP_URGENT_BEAT,
} from './tuning';

/**
 * BGM 循环乐句长度（ms）—— **`[TODO]` 的工程占位**。
 * `audio-spec §4.3` 给的是「循环 30–60 s（建议区间）」、§8 T2 把循环点/BPM/调性
 * 全列为待定。取 8 s 而不是 30 s 的理由是内存：离线渲染的 mono buffer ≈
 * `sampleRate × 8 × 4 B`（44.1 kHz 下约 1.4 MB），30 s 就是 5.6 MB，真机（`[R]`）
 * 未取证前不先撑这么大。定档后由阮和鸣回写 §4.3 再改本值。
 */
const BGM_LOOP_MS = 8000;

/** 三和弦琶音骨架（确定性音高表，L4：不用 `Math.random()`）。 */
const PENTATONIC: readonly number[] = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];

/**
 * BGM 音符表：8 秒乐句，4/4 拍、约 120 BPM（**占位**，BPM 属 §8 T2 `[TODO]`）。
 * 每音 `startMs/durMs` 手工排布 ⇒ 可 Node 断言、可复现。
 */
function bgmPhrase(): AudioVoice['notes'] {
  const beat = 500; // ms／拍（占位）
  const notes: { freq: number; startMs: number; durMs: number; gain: number }[] = [];
  const steps: readonly number[] = [0, 2, 4, 5, 4, 2, 0, 3, 5, 4, 2, 0, 1, 3, 2, 0];
  for (let i = 0; i < steps.length; i++) {
    const idx = steps[i]!;
    notes.push({
      freq: PENTATONIC[idx % PENTATONIC.length]! * 2, // 高八度，垫在前景之上
      startMs: i * beat * 2,
      durMs: beat * 1.6,
      gain: 0.32,
    });
  }
  return notes;
}

/** §4.3 结构列 → 本表逐条落点；时长列 = `ux-spec §5` 硬上限。 */
const VOICE_TABLE: Record<string, AudioVoice> = {
  // §5「珠子落座 120ms｜软『嗒』」：膜质 = 低频正弦下滑 + 极低通。
  [AUDIO_CLIP_PLACE]: {
    bus: 'sfx',
    durationMs: 120,
    wave: 'sine',
    freq: 190,
    glideTo: 118,
    gain: 0.55,
    attackMs: 4,
    filter: 'lowpass',
    filterFreq: 900,
  },
  // §5「托盘选中 100ms｜轻『啵』」：正弦轻微上滑。
  [AUDIO_CLIP_SELECT]: {
    bus: 'sfx',
    durationMs: 100,
    wave: 'sine',
    freq: 520,
    glideTo: 640,
    gain: 0.4,
    attackMs: 3,
    filter: 'lowpass',
    filterFreq: 2600,
  },
  // §5「放错拒绝 200ms｜低『咚』（≤2 次/秒）」：低频钝击，**不加失真**。
  [AUDIO_CLIP_REJECT]: {
    bus: 'sfx',
    durationMs: 200,
    wave: 'sine',
    freq: 138,
    glideTo: 92,
    gain: 0.6,
    attackMs: 8,
    filter: 'lowpass',
    filterFreq: 520,
  },
  // §5「消除（道具）200ms｜溶解『沙』」：噪声 + 带通。
  [AUDIO_CLIP_DISSOLVE]: {
    bus: 'sfx',
    durationMs: 200,
    noise: true,
    gain: 0.34,
    attackMs: 12,
    releaseMs: 60,
    filter: 'bandpass',
    filterFreq: 1800,
  },
  // §5「道具生效 400ms｜魔法『叮』」：基音 + 泛音同起（钟琴叠音），高通去浊。
  [AUDIO_CLIP_POWERUP]: {
    bus: 'sfx',
    durationMs: 400,
    wave: 'sine',
    gain: 0.4,
    attackMs: 3,
    filter: 'highpass',
    filterFreq: 700,
    notes: [
      { freq: 659.25, durMs: 400, gain: 1 },
      { freq: 1318.5, startMs: 0, durMs: 200, gain: 0.38 },
      { freq: 1979.0, startMs: 0, durMs: 120, gain: 0.18 },
    ],
  },
  // §5「连击 ×2（Lv1）200ms｜上行双音」。
  [AUDIO_CLIP_COMBO_T1]: {
    bus: 'sfx',
    durationMs: 200,
    wave: 'triangle',
    gain: 0.36,
    attackMs: 3,
    filter: 'lowpass',
    filterFreq: 3200,
    notes: [
      { freq: 523.25, durMs: 100 },
      { freq: 659.25, startMs: 100, durMs: 100 },
    ],
  },
  // §5「连击 ×3（Lv2）150ms｜三连上行音」。
  [AUDIO_CLIP_COMBO_T2]: {
    bus: 'sfx',
    durationMs: 150,
    wave: 'triangle',
    gain: 0.36,
    attackMs: 3,
    filter: 'lowpass',
    filterFreq: 3600,
    notes: [
      { freq: 523.25, durMs: 50 },
      { freq: 659.25, startMs: 50, durMs: 50 },
      { freq: 783.99, startMs: 100, durMs: 50 },
    ],
  },
  // §5「连击 ×5（Lv3）350ms｜和弦爆发」（与伪震屏同帧，A05-09）。
  [AUDIO_CLIP_COMBO_T3]: {
    bus: 'sfx',
    durationMs: 350,
    wave: 'triangle',
    gain: 0.34,
    attackMs: 4,
    filter: 'lowpass',
    filterFreq: 4200,
    notes: [
      { freq: 523.25, durMs: 350, gain: 1 },
      { freq: 659.25, startMs: 0, durMs: 350, gain: 0.8 },
      { freq: 783.99, startMs: 0, durMs: 350, gain: 0.7 },
      { freq: 1046.5, startMs: 0, durMs: 300, gain: 0.45 },
    ],
  },
  // §5「连击断连 150ms｜下行单音」（两 `reason` 同音，A05-10）。
  [AUDIO_CLIP_COMBO_BREAK]: {
    bus: 'sfx',
    durationMs: 150,
    wave: 'sine',
    freq: 440,
    glideTo: 233,
    gain: 0.3,
    attackMs: 5,
    filter: 'lowpass',
    filterFreq: 2200,
  },
  // §5「倒计时告急 1000ms/循环｜心跳节拍」：lub-dub 双击，周期由 §3.12 限流保证。
  [AUDIO_CLIP_URGENT_BEAT]: {
    bus: 'sfx',
    durationMs: 240,
    wave: 'sine',
    gain: 0.5,
    attackMs: 4,
    filter: 'lowpass',
    filterFreq: 360,
    notes: [
      { freq: 98, durMs: 70, gain: 1 },
      { freq: 82, startMs: 140, durMs: 90, gain: 0.8 },
    ],
  },
  // §5「满槽告警 500ms（音只 1 次）｜轻提示音」：中性上行双音，**不带威胁感**。
  [AUDIO_CLIP_TRAY_FULL]: {
    bus: 'sfx',
    durationMs: 500,
    wave: 'triangle',
    gain: 0.32,
    attackMs: 6,
    filter: 'lowpass',
    filterFreq: 3000,
    notes: [
      { freq: 659.25, durMs: 220 },
      { freq: 880, startMs: 220, durMs: 280 },
    ],
  },
  // §5「stage 切换 250+250｜换场『唰』」：噪声双段镜像（出段 + 入段，A05-15）。
  [AUDIO_CLIP_STAGE]: {
    bus: 'sfx',
    durationMs: 500,
    noise: true,
    gain: 0.3,
    attackMs: 20,
    filter: 'bandpass',
    filterFreq: 1400,
    notes: [
      { freq: 0, durMs: 250, gain: 1 },
      { freq: 0, startMs: 250, durMs: 250, gain: 1 },
    ],
  },
  // §5「过关庆祝 800ms｜胜利琶音」（单条，不逐列分层——§5 未纳入清单）。
  [AUDIO_CLIP_CLEAR]: {
    bus: 'sfx',
    durationMs: 800,
    wave: 'triangle',
    gain: 0.36,
    attackMs: 3,
    filter: 'highpass',
    filterFreq: 500,
    notes: [
      { freq: 523.25, durMs: 180 },
      { freq: 659.25, startMs: 140, durMs: 180 },
      { freq: 783.99, startMs: 280, durMs: 180 },
      { freq: 1046.5, startMs: 420, durMs: 220 },
      { freq: 1318.5, startMs: 560, durMs: 240, gain: 0.7 },
    ],
  },
  // §5「结算星入场 150ms×3｜每星『叮』上行」（音高递增表 = §4.3 `[TODO]`）。
  [AUDIO_CLIP_STAR]: {
    bus: 'ui',
    durationMs: 150,
    wave: 'sine',
    gain: 0.36,
    attackMs: 3,
    filter: 'highpass',
    filterFreq: 700,
    notes: [
      { freq: 1046.5, durMs: 150 },
      { freq: 1568, startMs: 0, durMs: 90, gain: 0.35 },
    ],
  },
  // §5「面板入 200ms｜抽屉音」：短噪 + 低通（入/出镜像）。
  [AUDIO_CLIP_PANEL_IN]: {
    bus: 'ui',
    durationMs: 200,
    noise: true,
    gain: 0.22,
    attackMs: 18,
    filter: 'lowpass',
    filterFreq: 1200,
  },
  // §5「面板出 150ms｜抽屉音」。
  [AUDIO_CLIP_PANEL_OUT]: {
    bus: 'ui',
    durationMs: 150,
    noise: true,
    gain: 0.18,
    attackMs: 14,
    filter: 'lowpass',
    filterFreq: 900,
  },
  // §5「续时成功 150 出 + ≤400 反馈红线｜轻『叮』」：明亮上滑（与 reject 语义相反）。
  // bus 由 `audio-events §0` 的**前缀派生规则**给出（`sfx_revive_ok` 不属 `sfx_ui_*` /
  // `sfx_panel_*` / `sfx_star` 三个 UI 例外）⇒ sfx，与 `audio-spec §2.1` 的通道归属一致；
  // 它同样走 `_sfx()` 门控（`settings.sfxMuted`），归 ui 会让总线增益与静音开关错位。
  [AUDIO_CLIP_REVIVE_OK]: {
    bus: 'sfx',
    durationMs: 250,
    wave: 'sine',
    freq: 523.25,
    glideTo: 1046.5,
    gain: 0.4,
    attackMs: 3,
    filter: 'highpass',
    filterFreq: 600,
  },
  // §5 **无行**（Q-A05-1 / §8 T4 `[TODO]`）⇒ 时长为工程占位，不参与 `[B]` 验收。
  [AUDIO_CLIP_UI_TAP]: {
    bus: 'ui',
    durationMs: 40,
    wave: 'triangle',
    freq: 880,
    gain: 0.22,
    attackMs: 2,
    filter: 'lowpass',
    filterFreq: 4000,
  },
  // BGM：`bgm_main` 单曲全程无缝循环（A05-21/22）；循环点/BPM/调性 = `[TODO]`。
  [AUDIO_CLIP_BGM]: {
    bus: 'music',
    durationMs: BGM_LOOP_MS,
    loopMs: BGM_LOOP_MS,
    wave: 'sine',
    gain: 0.28,
    attackMs: 40,
    releaseMs: 120,
    filter: 'lowpass',
    filterFreq: 2000,
    notes: bgmPhrase(),
  },
};

/**
 * 交给 `Game.audioVoices` 的只读配方表。
 * key 集 = `audio-events §1` 的 19 个 clip id（A05-24 由 `audio-dispatch.test.ts` 机验）。
 */
export const BEADS_AUDIO_VOICES: AudioVoices = VOICE_TABLE;
