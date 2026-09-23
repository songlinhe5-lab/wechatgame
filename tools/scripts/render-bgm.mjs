#!/usr/bin/env node
/**
 * render-bgm.mjs — **离线**渲染 BGM 样带（WAV → MP3）。
 *
 * 为什么存在（`audio-spec §4.1` v1.51 改判）：运行时那台 `SynthAudioBackend` 是
 * `env = 1 − (rel−atk)/decay` 的**拨奏引擎，没有 sustain**，`wave`/`filter` 还是 voice 级
 * ⇒ 持续音、真实器乐感、空间感都在它能力之外。离线渲染不受该限制。
 *
 * v2「去 midi 味」的六个针对性手段（每一条都对应合成音暴露出"机器"的一个特征）：
 *   ① **分泛音独立衰减**：高次泛音比基频死得快（真弦/金属/音叉都如此）。
 *      v1 所有泛音共用一条包络 ⇒ 听感就是"带和声的正弦"= organ/MIDI 味主因。
 *   ② **起振瞬态（bloom）**：极短的滤波噪声爆发（2%~4%）。零瞬态 =  sequencer 感。
 *   ③ **微失谐 + 慢颤音**：pad 用 ±0.4% 双声 + 5.2 Hz、±0.15% vibrato ⇒ 合唱呼吸感。
 *   ④ **人类化处理**：onset 抖动 ±11 ms、力度 0.78–1.0（种子 PRNG，**不用 Math.random**）。
 *   ⑤ **旋律触键感**：电钢式 FM 颤幅（4.6 Hz）+ tine 亮头，替代"匀速长鸣 beep"。
 *   ⑥ **总线柔化**：4.2 kHz 一阶低通削掉数码毛刺 + tanh 软限幅替代硬顶 + 旋律触发 pad duck。
 *
 * 产物目前只作**试听样带**（默认落 `temp/`）。入库需先定资产落位规范（本仓首次引入二进制资产）。
 *
 * USAGE
 *   node tools/scripts/render-bgm.mjs                          # → temp/bgm_main_v1.{wav,mp3}
 *   node tools/scripts/render-bgm.mjs --secs-stereo 0 --kbps 128
 *
 * 确定性：全程种子 PRNG ⇒ 同参数必得同字节产物（已用 md5 复验）。
 */

import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const SR = 44_100;
const BPM = parseInt(arg('--bpm', '68'), 10); // v2 放慢：72 → 68，稀疏感更软
const BARS = parseInt(arg('--bars', '6'), 10);
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LOOP_SECS = BARS * BAR;
const TAIL_SECS = 3.6;
const OUT = resolve(arg('--out', 'temp/bgm_main_v1'));
const KBPS = arg('--kbps', '96');
const STEREO = arg('--stereo', '1') !== '0';
const CH = STEREO ? 2 : 1;

let _s = 0x9e3779b9;
const rng = () => ((_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296);
const total = Math.round((LOOP_SECS + TAIL_SECS) * SR);
const L = new Float64Array(total);
const R = new Float64Array(total);

const hz = (semisFromA4) => 440 * Math.pow(2, semisFromA4 / 12);
const m = (midi) => hz(midi - 69);

// ─────────────────────────── 编曲（曲谱正本 = bgm-main-composition.md §3）───────────────────────────
// 和声 Fmaj7 · Dm7 · B♭maj7 · C6 · B♭maj7 · C6→(回 F)：无属七强解决，plagal 回归。
const CHORDS = [
    [53, 57, 60, 64],
    [50, 57, 60, 65],
    [58, 62, 65, 69],
    [52, 56, 59, 64],
    [58, 62, 65, 69],
    [52, 56, 60, 64],
];
const BASSES = [41, 38, 46, 48, 46, 48]; // 渲染时一律 +12 ⇒ 全部 ≥ 170 Hz（低频让位给 reject/心跳）
// 旋律：绝对拍号。音值全部 ≥ 8 分 ⇒ 密度上限 2.4 音/秒 < 3Hz 听觉闪烁红线（BPM 变了也要重核）。
const MELODY = [
    [2.0, 0.5, 81], [2.5, 0.5, 79], [3.5, 1.0, 76],
    [6.0, 1.5, 74],
    [10.0, 0.5, 81], [10.5, 0.5, 83], [11.5, 1.0, 84],
    [14.0, 1.0, 83], [15.5, 0.5, 81],
    [18.0, 2.0, 79], // 收在 B♭5（和弦内音，不解决）
    [22.0, 1.0, 76], [23.0, 1.5, 74],
];

// ───────────────────────────────── 声部 ─────────────────────────────────
/**
 * 一个音 = 若干条**各自独立衰减**的泛音 + 可选起振噪声 + 可选 vibrato / FM 颤幅。
 * `partialDecay[k]` 是第 k+1 次泛音的衰减时间常数相对基频的倍率（<1 = 死得更快）。
 */
function note(
    at, dur, freq,
    { partials = [1], partialDecay = [], gain = 0.2, attackMs = 4, hold = 0, tau = 1.1,
        bloom = 0, vibrato = 0, tremolo = 0, detune = 0, pan = 0.5, stretch = 0.0006 },
) {
    const jitter = (rng() - 0.5) * 0.022; // ④ 人类化：±11 ms
    const vel = 0.78 + rng() * 0.22; // ④ 力度律动
    const start = Math.round((at + jitter) * SR);
    const len = Math.round(dur * SR);
    const atk = Math.max(1, Math.round((attackMs / 1000) * SR));
    const holdN = Math.max(0, Math.round(hold * SR));
    // 等功率声像（mono 时两路系数都是 1）
    const atL = STEREO ? Math.cos(pan * Math.PI * 0.5) : 1;
    const atR = STEREO ? Math.sin(pan * Math.PI * 0.5) : 1;
    let noiseState = 0;
    for (let i = 0; i < len; i++) {
        const idx = start + i;
        if (idx >= total) break;
        const t = i / SR;
        let env;
        if (i < atk) env = i / atk;
        else if (i < atk + holdN) env = 1;
        else env = Math.exp(-(i - atk - holdN) / SR / tau);
        env *= Math.min(1, (len - i) / (SR * 0.008)); // 关断防滑音
        // ⑥ 旋律触键：缓慢颤幅（电钢 characteristic）
        const amp = tremolo > 0 ? 1 + tremolo * Math.sin(2 * Math.PI * 4.6 * t) : 1;
        // ③ 慢颤音（音高微漂）
        const det = vibrato > 0 ? 1 + vibrato * Math.sin(2 * Math.PI * 5.2 * t) : 1;
        let s = 0;
        for (let k = 0; k < partials.length; k++) {
            const g = partials[k];
            if (!g) continue;
            const dk = partialDecay[k] ?? 1;
            const e = dk === 1 ? env : Math.pow(env, 1 / dk); // 高次泛音衰减更快
            const fk = freq * (k + 1) * (1 + stretch * k * k) * det;
            s += g * e * Math.sin(2 * Math.PI * fk * t + k * 0.8);
        }
        if (detune !== 0) {
            // ③ 微失谐第二声：制造合唱/空气感
            const f2 = freq * (1 + detune / 100);
            s += 0.62 * env * Math.pow(env, 1.6) * Math.sin(2 * Math.PI * f2 * t * det);
        }
        if (bloom > 0 && i < Math.round(0.02 * SR)) {
            // ② 起振瞬态：一阶低通白噪（听不见的"空气"，但去掉了 sequencer 的干净）
            noiseState += (rng() * 2 - 1 - noiseState) * 0.35;
            s += noiseState * bloom * (1 - i / (0.02 * SR));
        }
        const v = s * env * amp * gain * vel;
        L[idx] += v * atL;
        R[idx] += v * atR;
    }
}

/** 旋律 = 软电钢触键：基频 + 二次（柔）+ tine 亮头 + 颤幅 + 快速死掉的高次。 */
function ep(at, dur, midi, gain, pan) {
    note(at, dur * 1.5, m(midi), {
        partials: [1, 0.26, 0.09, 0.03], partialDecay: [1, 0.62, 0.34, 0.2],
        gain, attackMs: 3, hold: 0.02, tau: 0.85, bloom: 0.02, tremolo: 0.05, pan,
    });
}
/** 和声垫 = 双失谐慢起振长音（真 sustain）。 */
function pad(at, dur, midi, gain, pan) {
    note(at, dur, m(midi + 12), {
        partials: [1, 0.3, 0.12, 0.05], partialDecay: [1, 0.78, 0.5, 0.3],
        gain, attackMs: 260, hold: dur * 0.5, tau: 0.9, detune: 0.4, vibrato: 0.0014, pan,
    });
}
/** 低音 = 基频 + 少量二次泛音，起振柔、尾长。 */
function bass(at, dur, midi, gain) {
    note(at, dur, m(midi + 12), {
        partials: [1, 0.28, 0.07], partialDecay: [1, 0.7, 0.42],
        gain, attackMs: 14, hold: dur * 0.25, tau: 0.8, pan: 0.5,
    });
}

for (let b = 0; b < BARS; b++) {
    const t0 = b * BAR;
    bass(t0, BAR * 0.95, BASSES[b], 0.2);
    const ch = CHORDS[b];
    for (let k = 1; k < ch.length; k++) {
        pad(t0 + (k - 1) * 0.1, BAR * 1.02, ch[k], 0.052, 0.28 + k * 0.12);
    }
}
for (const [beat, durBeats, midi] of MELODY) {
    ep(beat * BEAT, Math.max(0.3, durBeats * BEAT), midi, 0.135, 0.58);
}

// ─────────────── ⑥ pad duck：旋律触键时把背景轻轻压下一点，避免"糊成一片" ───────────────
{
    // 用一条与旋律 onset 对齐的下潜包络乘在两个总线上（简单、确定性、无副作用）。
    const duck = new Float64Array(total).fill(1);
    const DUCK = 0.86, HOLD = Math.round(0.28 * SR), REL = Math.round(0.55 * SR);
    for (const [beat] of MELODY) {
        const c = Math.round(beat * BEAT * SR);
        for (let i = c; i < Math.min(total, c + HOLD + REL); i++) {
            const k = i < c + HOLD ? 1 : 1 - (i - c - HOLD) / REL;
            duck[i] = Math.min(duck[i], 1 - (1 - DUCK) * k);
        }
    }
    // duck 只作用于偏中的 pad 能量：这里以"整体轻压 + 高频先压"近似
    for (let i = 0; i < total; i++) { L[i] *= 0.82 + 0.18 * duck[i]; R[i] *= 0.82 + 0.18 * duck[i]; }
}

// ───────────────────────── 空间：双耳去相关 comb + 2 allpass ─────────────────────────
function reverb(input, delayBase, fb, damp, mix) {
    const n = input.length;
    const wet = new Float64Array(n);
    const delays = [delayBase, delayBase + 41, delayBase + 89, delayBase + 137];
    for (const d of delays) {
        const line = new Float64Array(d);
        let i = 0, lastOut = 0;
        for (let k = 0; k < n; k++) {
            const store = line[i];
            const dampOut = store + (lastOut - store) * damp;
            lastOut = dampOut;
            line[i] = input[k] + dampOut * fb;
            wet[k] += store;
            i = i + 1 < d ? i + 1 : 0;
        }
    }
    for (const [d, g] of [[227, 0.7], [389, 0.68]]) {
        const line = new Float64Array(d);
        let i = 0;
        for (let k = 0; k < n; k++) {
            const bufout = line[i];
            const outv = -g * wet[k] + bufout;
            line[i] = wet[k] + g * bufout;
            wet[k] = outv;
            i = i + 1 < d ? i + 1 : 0;
        }
    }
    for (let k = 0; k < n; k++) wet[k] *= mix;
    return wet;
}
const wetL = reverb(L, 1489, 0.78, 0.3, 0.1);
const wetR = reverb(R, 1571, 0.78, 0.3, 0.1); // ⑥ 与 L 不同的延迟组 ⇒ 去相关，比 mono 更不"电子"
for (let k = 0; k < total; k++) { L[k] += wetL[k]; R[k] += wetR[k]; }

// ───────────────── 折叠混响尾（样本级无缝）+ 一阶低通 + 软限幅 + 归一化 ─────────────────
const loopN = Math.round(LOOP_SECS * SR);
const outL = new Float64Array(loopN);
const outR = new Float64Array(loopN);
for (let i = 0; i < total; i++) {
    outL[i % loopN] += L[i];
    outR[i % loopN] += R[i];
}
function toneRolloff(buf) {
    // ⑥ 一阶低通 ≈ 4.2 kHz：数码毛刺与"太亮"的高次是 midi 味的一半来源
    const a = Math.exp((-2 * Math.PI * 4200) / SR);
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
        y += (1 - a) * (buf[i] - y); // 标准一阶低通
        buf[i] = y;
    }
}
toneRolloff(outL);
toneRolloff(outR);
let peak = 0;
for (let i = 0; i < loopN; i++) {
    outL[i] = Math.tanh(outL[i] * 1.25); // ⑥ 软限幅：削峰时是压缩感而不是破音
    outR[i] = Math.tanh(outR[i] * 1.25);
    peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
}
const norm = peak > 0 ? 0.5 / peak : 1;
const fadeIn = Math.round(0.01 * SR), fadeOut = Math.round(0.03 * SR);
for (let i = 0; i < loopN; i++) {
    let f = 1;
    if (i < fadeIn) f = i / fadeIn;
    if (i > loopN - fadeOut) f = Math.min(f, (loopN - i) / fadeOut);
    outL[i] *= norm * f;
    outR[i] *= norm * f;
}

function writeWav(path, a, b, sr, ch) {
    const n = a.length;
    const bytes = n * 2 * ch;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + bytes, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(ch, 22);
    header.writeUInt32LE(sr, 24);
    header.writeUInt32LE(sr * 2 * ch, 28);
    header.writeUInt16LE(2 * ch, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(bytes, 40);
    const data = Buffer.alloc(bytes);
    for (let i = 0; i < n; i++) {
        const put = (v, off) => data.writeInt16LE(Math.max(-32768, Math.min(32767, (v * 32767) | 0)), off);
        if (ch === 1) put(a[i], i * 2);
        else { put(a[i], i * 4); put(b[i], i * 4 + 2); }
    }
    writeFileSync(path, Buffer.concat([header, data]));
}

mkdirSync(dirname(OUT), { recursive: true });
writeWav(`${OUT}.wav`, outL, outR, SR, CH);
let enc = spawnSync('lame', ['-m', STEREO ? 's' : 'm', '-b', KBPS, '-q', '2', `${OUT}.wav`, `${OUT}.mp3`], { encoding: 'utf8' });
if (enc.status !== 0) {
    enc = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${OUT}.wav`, '-b:a', `${KBPS}k`, `${OUT}.mp3`], { encoding: 'utf8' });
}
const kb = (p) => { try { return (statSync(p).size / 1024).toFixed(0) + ' KB'; } catch { return '—'; } };
console.log(JSON.stringify({
    loopSecs: +(loopN / SR).toFixed(3), bars: BARS, bpm: BPM, channels: CH,
    events: MELODY.length + BARS * 4,
    wav: `${OUT}.wav`, wavSize: kb(`${OUT}.wav`),
    mp3: enc.status === 0 ? `${OUT}.mp3` : `编码失败：${(enc.stderr || enc.error || '').toString().slice(0, 120)}`,
    mp3Size: kb(`${OUT}.mp3`),
    budget: 'A05-25：BGM 文件 ≤3、总大小 ≤1536 KB',
}, null, 2));
