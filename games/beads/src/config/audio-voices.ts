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

import type { AudioVoice, AudioVoices } from '@wxgame/framework';
import { AUDIO_ASSETS } from './audioAssets.js';

import {
  AUDIO_CLIP_BGM,
  AUDIO_CLIP_CLEAR,
  AUDIO_CLIP_COMBO_BREAK,
  AUDIO_CLIP_COMBO_T1,
  AUDIO_CLIP_COMBO_T2,
  AUDIO_CLIP_COMBO_T3,
  AUDIO_CLIP_DENIED,
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
} from './tuning.js';

/**
 * BGM 循环乐句长度（ms）—— **`[TODO]` 的工程占位**。
 * `audio-spec §4.3` 给的是「循环 30–60 s（建议区间）」、§8 T2 把循环点/BPM/调性
 * 全列为待定。取 8 s 而不是 30 s 的理由是内存：离线渲染的 mono buffer ≈
 * `sampleRate × 8 × 4 B`（44.1 kHz 下约 1.4 MB），30 s 就是 5.6 MB，真机（`[R]`）
 * 未取证前不先撑这么大。定档后由 阮和鸣 回写 §4.3 再改本值。
 *
 * **v1.5-r11（2026-09-23）：占位五声琶音 → 真曲子 `bgm_main` Track 1（F 大调 / ♩=72）。**
 * 曲谱正本 = `design/audio/bgm-main-composition.md` §3；本处是其 **6 小节 / 20.000 s** 版：
 * 完整 12 小节 = 40 s 会把常驻缓冲推到 **≈ 7.0 MB**，跨过上面那条“真机取证前不先撑”
 * 的既有保守裁决 ⇒ 默认取 6 小节（**≈ 3.5 MB**，与旧注释里“30 s = 5.6 MB”同一量级口径）。
 * 升级到 12 小节 = 改本常量为 40000 + 两张表按谱补全小节（一行的事）。
 *
 * 时长恒等式（改 BPM 必须同步改小节数，否则循环点脱离乐句边界）：
 *   `loopMs = 小节数 × 4 拍 ÷ BPM × 60000` ⇒ 6 小节 @72 = 20.000 s；12 小节 @72 = 40.000 s。
 */
const BGM_LOOP_MS = 20_000;
/**
 * BGM 曲式常量：♩=72、4/4、6 小节。
 *
 * ⚠ **v1.5-r13：和声垫已废弃**——引擎渲染是 `env = 1 − (rel−atk)/decay`，即
 * **attack→线性衰到 0 的拨奏引擎，没有 sustain**。上一版写的“3.3 s 长音 pad”在这个引擎里
 * 物理上不成立：18 个长音 = **18 个正在死掉的蜂鸣**，那是“难听 / midi 味”的根因，
 * 不是调参能救的。⇒ 现在整首写成**音乐盒点描**（全音 durMs ≤ 2 拍），顺着引擎能力写。
 *
 * 音区下限仍守 **≥ 170 Hz**（给 `sfx_reject` 与 1Hz 心跳让位）；低音拨弦用 `triangle`
 * ⇒ 奇次泛音（3×175 = 525 Hz）在小喇叭上仍可辐射，不会“写了但听不到”（D3 = 146.8 越线，已上置八度）。
 */
const BGM_BEAT_MS = 60_000 / 72;

/** 低音拨弦：`[拍位(0-based), 时值(拍), 频率, 力度]`，每小节开头一下。 */
const BGM_BASS: readonly (readonly [number, number, number, number])[] = [
  [0, 1.5, 174.61, 0.3], // F3  · Fmaj7
  [4, 1.5, 293.66, 0.3], // D4  · Dm7（D3 = 146.8 越 170 下限 ⇒ 上置八度）
  [8, 1.5, 233.08, 0.3], // B♭3 · B♭maj7
  [12, 1.5, 261.63, 0.3], // C4 · C6
  [16, 1.5, 233.08, 0.3], // B♭3 · B♭maj7
  [20, 1.5, 261.63, 0.3], // C4 · C6 → 循环回 F
];

/** 旋律拨弦：`[拍位, 时值(拍), 频率, 力度]`。音值下限 8 分 ⇒ 最密 2.4 音/秒 < 3Hz 红线。 */
const BGM_MELODY: readonly (readonly [number, number, number, number])[] = [
  [2.0, 0.5, 880.0, 0.7], // A5
  [2.5, 0.5, 783.99, 0.6], // G5
  [5.0, 1.0, 698.46, 0.65], // F5
  [9.0, 0.5, 783.99, 0.7], // G5 —— 乐句 A
  [9.5, 0.5, 880.0, 0.7], // A5
  [10.0, 1.0, 932.33, 0.75], // B♭5 —— 小高点
  [13.0, 0.5, 880.0, 0.7], // A5 —— 乐句 B（同材料转位，不写新旋律）
  [13.5, 0.5, 783.99, 0.6], // G5
  [14.0, 1.0, 659.25, 0.6], // E5
  [17.0, 1.0, 1174.66, 0.75], // D6 —— 全曲最高音
  [18.0, 1.0, 1046.5, 0.7], // C6
  [21.0, 1.5, 880.0, 0.65], // A5 —— 悬在循环点前，靠回到 Fmaj7 完成回归
];

/**
 * 力度（note gain × voice gain = 有效峰值）：
 * 旋律 0.7 ⇒ **0.196**；低音 0.3 ⇒ 0.084；同峰叠加 ≤ 0.28。
 * 对比：`sfx_place` 有效峰值 0.55 ⇒ BGM 比落座音低约 **7 dB**（SFX ≥ Music 仍成立）。
 * 上一版是 0.039 ⇒ **差 23 dB**，“听不清 / 太小”的真正原因在此。
 * voice 总 `gain: 0.28` **一字未改** ⇒ 总线电平关系（与 SFX 的相对响度档）不变，
 * 改的只是谱子内部的力度分（上限 0.75，判据钉住）。
 */

/**
 * BGM 音符表（确定性手工排布 ⇒ 可 Node 断言、可复现；L4 禁 `Math.random()`）。
 * ⚠ 谱子 §3.4 里的“失谐双正弦合唱 pad”**本批不做** —— `AudioVoice` 无 per-note detune 位，
 *   加它要动框架侧形状 ⇒ 以“三音和弦长音”近似同一功能（宽、软、不抢前景）。
 */
function bgmPhrase(): AudioVoice['notes'] {
  const notes: { freq: number; startMs: number; durMs: number; gain: number }[] = [];
  for (const src of [BGM_BASS, BGM_MELODY]) {
    for (const [beat, durBeats, freq, gain] of src) {
      notes.push({
        freq,
        startMs: Math.round(beat * BGM_BEAT_MS),
        durMs: Math.round(durBeats * BGM_BEAT_MS),
        gain,
      });
    }
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
  // §5「不可填格轻压 120ms｜极轻闷『哒』」（WXG-T-128 裁定 3 / WXG-T-152）：
  // 非惩罚语义 = 更低增益 + 更短时长 + 更低频（对照 reject 的 0.6/200ms）。
  // ⚠️ Hz/增益 = 工程占位（§4.3 只冻结结构：正弦 + 下滑 + 极低通）；唯一硬值 =
  // 时长上限 120ms（引 `ux-spec §5`「不可填格轻压」行，与视觉同窗）。
  [AUDIO_CLIP_DENIED]: {
    bus: 'sfx',
    durationMs: 120,
    wave: 'sine',
    freq: 120,
    glideTo: 88,
    gain: 0.25,
    attackMs: 6,
    filter: 'lowpass',
    filterFreq: 420,
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
  // §5「连击 ×3（Lv2）150ms｜三连上行音」。**伪震屏（scale 1.015）与本 clip 同帧**（A05-09）
  // ——梯级归属经 WXG-T-103 / 冲突 C1 追正：旧注误把伪震屏记在 T3（`combo-vfx.ts` tier=2→pseudoShake、tier=3→burst）。
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
  // §5「连击 ×5（Lv3）350ms｜和弦爆发」（与 `comboVfxKind === 'burst'` 同帧，A05-09b；伪震屏属 Lv2，见 T2 注——WXG-T-103 追正）。
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
  // BGM：`bgm_main` = Track 1（F 大调 ♩=72，6 小节无缝循环，A05-21/22）。
  // 曲谱正本 = design/audio/bgm-main-composition.md §3；总 gain 沿用占位表旧值 0.28（**未提高响度**）。
  [AUDIO_CLIP_BGM]: {
    bus: 'music',
    /**
     * 文件路线（v1.52 分流）：BGM 走平台原生播放器 ⇒ JS 堆不驻 60 s × 44.1 kHz × 4 B ≈ 10 MB PCM。
     * 同一相对串两侧通吃：web/harness 解析为站点根 `/audio/…`（`dev/harness/audio` 是指向
     * cocos 资产目录的符号链接），weapp 解析为包内相对路径（需 Cocos 构建把该目录带进产物，`[R]` 未验）。
     * ⚠ `loopMs` 在文件路线下只当「是否走 loop 分支」的门用，**实际循环长度 = 文件自身 60.03 s**；
     *   它同时仍是下方 notes 合成回退的渲染周期（20 s 乐句），两个用途同源但值不同，改值前先看判据。
     */
    assetFile: 'audio/bgm_porch.mp3',
    durationMs: BGM_LOOP_MS,
    loopMs: BGM_LOOP_MS,
    wave: 'triangle',
    gain: 0.28,
    attackMs: 4,
    releaseMs: 120,
    filter: 'lowpass',
    filterFreq: 2000,
    notes: bgmPhrase(),
  },
};

/**
 * 交给 `Game.audioVoices` 的只读配方表。
 * key 集 = `audio-events §1` 的 20 个 clip id（A05-24 由 `audio-dispatch.test.ts` 机验；
 * v1.26 起 +`sfx_denied`，WXG-T-152）。
 */
/**
 * v1.52 素材接线：把 `audioAssets.ts`（jsfxr 离线生成、base64 mp3）按 clip id 挂到 voice 上。
 * 后端在 unlock 时解码，命中即**优先于 notes 合成**；解码失败/无 `decodeAudioData`
 * ⇒ 自动回退下面的 notes（**不会静音**，weapp 侧能力属 `[R]` 真机待验）。
 * BGM 素材尚未生成（需百炼 key）⇒ 只有 `bgm_main` 目前无 asset，继续走合成。
 */
function withAssets(table: AudioVoices): AudioVoices {
  const out: Record<string, AudioVoice> = {};
  for (const [id, voice] of Object.entries(table)) {
    const asset = (AUDIO_ASSETS as Record<string, string>)[id];
    out[id] = asset ? { ...voice, asset } : voice;
  }
  return out;
}

export const BEADS_AUDIO_VOICES: AudioVoices = withAssets(VOICE_TABLE);
