#!/usr/bin/env node
/**
 * gen-sfx.mjs — 用本地 jsfxr 生成 beads 的 19 条 SFX，导出 base64 到 audioAssets.js。
 *
 * 零网络、零付费、确定性（jsfxr 内部无随机；本脚本不引入 Math.random，L4 同律）。
 *
 * 为什么绕开 jsfxr 的 WAV 封装：`sfxr.toWave()` 走浏览器 `RIFFWAVE` shim，在 Node 下
 * 产出的字节流不是合法 WAV（ffprobe 报 invalid）。本脚本只取 `getRawBuffer()` 的 PCM，
 * 自己写头 + 调 `lame` 编码 MP3 ⇒ 体积可控且产物可验。
 *
 * USAGE
 *   node my-skills/wxgame-audio-gen/scripts/gen-sfx.mjs                    # 写 assets + 打印实测表
 *   node my-skills/wxgame-audio-gen/scripts/gen-sfx.mjs --dry              # 只算不写
 *   node my-skills/wxgame-audio-gen/scripts/gen-sfx.mjs --sr 22050 --kbps 64
 */

import { writeFileSync, readFileSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..', '..');
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const arg = (f, d) => {
    const i = argv.indexOf(f);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const SR = parseInt(arg('--sr', '44100'), 10);
const KBPS = arg('--kbps', '96');
const OUT_JS = resolve(arg('--out', 'games/beads/src/config/audioAssets.ts'));
const AUDITION_DIR = resolve(arg('--clips-dir', 'temp/sfx-clips'));

/* ───────────────────────── 19 条音效配方 ─────────────────────────
 * 语义列 = `games/beads/design/audio/audio-spec.md §4.3` + `ux-spec.md §5` 音效列原文
 * （嗒 / 啵 / 咚 / 沙 / 叮 / 唰）。`durMs` 上限同样来自那里，不得凭手感放宽。
 * wave_type：0=square 1=sawtooth 2=triangle 3=noise —— **默认不用 0（方波）**：
 * `audio-spec §1` 负面清单①「不做 8-bit 方波爆裂音」⇒ 以三角/噪声 + 低通为主。
 */
const P = (o) => o;
export const SFX_TABLE = [
    { id: 'sfx_place', durMs: 120, desc: '软「嗒」落座', p: P({ wave_type: 2, p_env_attack: 0.002, p_env_sustain: 0.03, p_env_punch: 0.28, p_env_decay: 0.09, p_base_freq: 0.34, p_freq_ramp: -0.32, p_damp: 0.62, p_lp_filter_res: 0.22, sound_vol: 0.5 }) },
    { id: 'sfx_select', durMs: 100, desc: '「啵」选中', p: P({ wave_type: 2, p_env_attack: 0.002, p_env_sustain: 0.04, p_env_punch: 0.3, p_env_decay: 0.08, p_base_freq: 0.52, p_freq_ramp: 0.18, p_lp_filter_res: 0.3, sound_vol: 0.44 }) },
    { id: 'sfx_reject', durMs: 200, desc: '钝「咚」（不加失真）', p: P({ wave_type: 2, p_env_attack: 0.004, p_env_sustain: 0.09, p_env_punch: 0.12, p_env_decay: 0.16, p_base_freq: 0.11, p_freq_ramp: -0.06, p_lp_filter_freq: 0.1, sound_vol: 0.52 }) },
    { id: 'sfx_denied', durMs: 120, desc: '极轻闷「哒」', p: P({ wave_type: 2, p_env_attack: 0.004, p_env_sustain: 0.03, p_env_punch: 0.06, p_env_decay: 0.09, p_base_freq: 0.16, p_freq_ramp: -0.12, p_lp_filter_freq: 0.12, sound_vol: 0.3 }) },
    { id: 'sfx_dissolve', durMs: 200, desc: '「沙」（噪声扫频）', p: P({ wave_type: 3, p_env_attack: 0.01, p_env_sustain: 0.08, p_env_decay: 0.12, p_base_freq: 0.42, p_hp_filter_freq: 0.2, p_lp_filter_freq: 0.55, p_lp_filter_ramp: -0.28, sound_vol: 0.3 }) },
    { id: 'sfx_powerup', durMs: 400, desc: '钟琴「叮」长尾', p: P({ wave_type: 2, p_env_attack: 0.002, p_env_sustain: 0.06, p_env_punch: 0.2, p_env_decay: 0.34, p_base_freq: 0.72, p_vib_speed: 0.3, p_vib_strength: 0.006, p_lp_filter_res: 0.4, sound_vol: 0.42 }) },
    { id: 'sfx_combo_t1', durMs: 200, desc: '上行双音', p: P({ wave_type: 2, p_env_attack: 0.002, p_env_sustain: 0.05, p_env_decay: 0.12, p_base_freq: 0.6, p_freq_ramp: 0.12, p_arp_speed: 0.5, p_arp_mod: 0.3, sound_vol: 0.4 }) },
    { id: 'sfx_combo_t2', durMs: 150, desc: '三连', p: P({ wave_type: 2, p_env_attack: 0.002, p_env_sustain: 0.04, p_env_decay: 0.09, p_base_freq: 0.66, p_arp_speed: 0.62, p_arp_mod: 0.36, sound_vol: 0.4 }) },
    { id: 'sfx_combo_t3', durMs: 350, desc: '和弦铺满', p: P({ wave_type: 2, p_env_attack: 0.003, p_env_sustain: 0.12, p_env_punch: 0.22, p_env_decay: 0.2, p_base_freq: 0.68, p_arp_speed: 0.5, p_arp_mod: 0.42, p_lp_filter_res: 0.34, sound_vol: 0.42 }) },
    { id: 'sfx_combo_break', durMs: 150, desc: '下行单音', p: P({ wave_type: 2, p_env_attack: 0.003, p_env_sustain: 0.05, p_env_decay: 0.1, p_base_freq: 0.5, p_freq_ramp: -0.22, sound_vol: 0.34 }) },
    { id: 'sfx_urgent_beat', durMs: 240, desc: '心跳 lub-dub（1Hz 周期）', p: P({ wave_type: 2, p_env_attack: 0.006, p_env_sustain: 0.05, p_env_decay: 0.12, p_base_freq: 0.1, p_freq_ramp: -0.05, p_lp_filter_freq: 0.14, sound_vol: 0.44 }) },
    { id: 'sfx_tray_full', durMs: 500, desc: '轻提示（中性不威胁）', p: P({ wave_type: 2, p_env_attack: 0.02, p_env_sustain: 0.16, p_env_decay: 0.24, p_base_freq: 0.4, p_vib_speed: 0.4, p_vib_strength: 0.004, sound_vol: 0.3 }) },
    { id: 'sfx_stage', durMs: 500, desc: '「唰」两段镜像', p: P({ wave_type: 3, p_env_attack: 0.02, p_env_sustain: 0.2, p_env_decay: 0.24, p_base_freq: 0.4, p_lp_filter_freq: 0.5, p_lp_filter_ramp: 0.24, sound_vol: 0.3 }) },
    { id: 'sfx_star', durMs: 150, desc: '逐星「叮」上行', p: P({ wave_type: 2, p_env_attack: 0.002, p_env_sustain: 0.03, p_env_decay: 0.12, p_base_freq: 0.78, p_freq_ramp: 0.1, p_lp_filter_res: 0.42, sound_vol: 0.4 }) },
    { id: 'sfx_panel_in', durMs: 200, desc: '抽屉「唰」入', p: P({ wave_type: 3, p_env_attack: 0.008, p_env_sustain: 0.06, p_env_decay: 0.12, p_base_freq: 0.34, p_lp_filter_ramp: 0.2, sound_vol: 0.26 }) },
    { id: 'sfx_panel_out', durMs: 150, desc: '抽屉「唰」出', p: P({ wave_type: 3, p_env_attack: 0.006, p_env_sustain: 0.04, p_env_decay: 0.09, p_base_freq: 0.4, p_lp_filter_ramp: -0.2, sound_vol: 0.24 }) },
    { id: 'sfx_revive_ok', durMs: 250, desc: '明亮上滑「叮」', p: P({ wave_type: 2, p_env_attack: 0.002, p_env_sustain: 0.06, p_env_decay: 0.18, p_base_freq: 0.55, p_freq_ramp: 0.3, p_lp_filter_res: 0.36, sound_vol: 0.4 }) },
    { id: 'sfx_clear', durMs: 800, desc: '胜利琶音', p: P({ wave_type: 2, p_env_attack: 0.003, p_env_sustain: 0.14, p_env_punch: 0.24, p_env_decay: 0.6, p_base_freq: 0.62, p_arp_speed: 0.42, p_arp_mod: 0.5, p_lp_filter_res: 0.4, sound_vol: 0.44 }) },
    { id: 'sfx_ui_tap', durMs: 40, desc: '极短点音', p: P({ wave_type: 2, p_env_attack: 0.001, p_env_sustain: 0.012, p_env_decay: 0.03, p_base_freq: 0.62, sound_vol: 0.3 }) },
];

/* ─────────────────────────── 生成 ─────────────────────────── */
const J = (await import('jsfxr')).default ?? (await import('jsfxr'));
const Params = J.Params ?? J.jsfxr?.Params;
const SoundEffect = J.SoundEffect ?? J.jsfxr?.SoundEffect;
if (!Params || !SoundEffect) {
    console.error('未取到 jsfxr 的 Params/SoundEffect；当前导出：' + Object.keys((await import('jsfxr')).default ?? {}).join(','));
    process.exit(1);
}

function pcmOf(over) {
    const p = Object.assign(new Params(), { oldParams: false, sample_rate: SR, sample_size: 16 }, over);
    const raw = new SoundEffect(p).getRawBuffer();
    const data = raw?.normalized ?? raw?.buffer ?? raw;
    const arr = Array.from(data ?? []);
    if (!arr.length) return { samples: [], ms: 0 };
    const maxAbs = Math.max(...arr.map(Math.abs));
    const float = maxAbs > 1;
    const samples = new Int16Array(arr.length);
    if (float) {
        const peak = maxAbs || 1;
        for (let i = 0; i < arr.length; i++) samples[i] = Math.max(-32768, Math.min(32767, Math.round((arr[i] / peak) * 29000)));
    } else {
        // jsfxr 内部 0..255 无符号量化 ⇒ 以 128 为中心还原成 16-bit
        const mid = 128;
        for (let i = 0; i < arr.length; i++) samples[i] = Math.max(-32768, Math.min(32767, Math.round((arr[i] - mid) * 256)));
    }
    return { samples, ms: +((samples.length / SR) * 1000).toFixed(0) };
}

function wavOf(samples) {
    const n = samples.length;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + n * 2, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(SR, 24);
    header.writeUInt32LE(SR * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(n * 2, 40);
    const body = Buffer.alloc(n * 2);
    for (let i = 0; i < n; i++) body.writeInt16LE(samples[i], i * 2);
    return Buffer.concat([header, body]);
}

/**
 * 把时长贴合到 `ux-spec §5` 的上限：目标 ≈ 85% 上限，且**绝不越界**（那是规格硬上限）。
 * 只缩放包络（sustain/decay），不动音色参数 ⇒ 语义不变、只改长短。
 * 没有这一步时 jsfxr 默认包络会产出一堆 20 ms 的"咔哒"而不是"软嗒"。
 */
function fitDuration(base, capMs) {
    let best = base;
    for (let k = 0.5; k <= 24; k *= 1.6) {
        const trial = { ...base, p_env_sustain: Math.min(1, base.p_env_sustain * k), p_env_decay: Math.min(1, base.p_env_decay * k) };
        const { ms } = pcmOf(trial);
        if (!ms) continue;
        best = trial;
        if (ms >= capMs * 0.8) {
            if (ms <= capMs) return trial;
            break;
        }
    }
    // 只有"真的越界"才二分回收；没达到目标但没越界 ⇒ 保留最长的那一版（别反向缩回去）
    if (pcmOf(best).ms <= capMs) return best;
    let lo = 0.05, hi = 1;
    const p = { ...best };
    for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2;
        const trial = { ...base, p_env_sustain: base.p_env_sustain * mid, p_env_decay: base.p_env_decay * mid };
        const { ms } = pcmOf(trial);
        if (ms > capMs) hi = mid;
        else { lo = mid; Object.assign(p, trial); }
    }
    return p;
}

const kb = (b) => +(b / 1024).toFixed(1);
mkdirSync(AUDITION_DIR, { recursive: true });
const rows = [];
const assets = {};
for (const c of SFX_TABLE) {
    const tuned = fitDuration(c.p, c.durMs);
    const { samples, ms } = pcmOf(tuned);
    const wav = wavOf(samples);
    const wavPath = join(AUDITION_DIR, c.id + '.wav');
    const mp3Path = join(AUDITION_DIR, c.id + '.mp3');
    writeFileSync(wavPath, wav);
    const enc = spawnSync('lame', ['-m', 'm', '-b', KBPS, '-q', '2', wavPath, mp3Path], { encoding: 'utf8' });
    const over = ms > c.durMs;
    if (enc.status !== 0) {
        rows.push({ id: c.id, ms, 上限ms: c.durMs, 状态: 'lame 编码失败' });
        continue;
    }
    const base64 = readFileSync(mp3Path).toString('base64');
    const bytes = statSync(mp3Path).size;
    assets[c.id] = `data:audio/mpeg;base64,${base64}`;
    rows.push({ id: c.id, desc: c.desc, ms, 上限ms: c.durMs, mp3KB: kb(bytes), b64KB: kb(base64.length), 超上限: over ? '⚠ 是' : 'ok' });
    rmSync(wavPath);
}

console.table(rows);
const totalB64 = kb(Object.values(assets).reduce((a, s) => a + s.length, 0));
console.log(`base64 总量（进 JS 源码，主包按此计）= ${totalB64} KB`);

if (!flag('--dry')) {
    mkdirSync(dirname(OUT_JS), { recursive: true });
    const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    writeFileSync(OUT_JS, [
        '/* 自动生成，请勿手改 —— 改配方请改 my-skills/wxgame-audio-gen/scripts/gen-sfx.mjs 后重跑。',
        ' *',
        ' * ⚠ 为什么是 .ts 而不是 .js：本仓 harness 的 tsconfig 只收 TS 源文件，framework:sync 也只镜像',
        ' * .ts 进 Cocos 产物 —— 放 assets/ 下的 .js 永远不会被编译，等于「有文件但放不出」。',
        ` * 生成时间：${stamp} UTC ｜ 工具：jsfxr(本地) + lame ${KBPS}kbps mono @${SR}Hz`,
        ' * 语义依据：games/beads/design/audio/audio-spec.md §4.3 配方表 + ux-spec.md §5 时长上限',
        ' * 消费者：audio-voices.ts 的 withAssets() 把本表按 clip id 挂到 AudioVoice.asset，',
        ' *   后端（SynthAudioBackend）在 unlock 时解码一次；命中即优先于 notes 合成，',
        ' *   解码失败或 runtime 无 decodeAudioData ⇒ 自动回退合成（不静音）。weapp 侧解码能力属 `[R]` 真机待验。',
        ' *   规格与接线状态见 audio-spec §4.1（v1.52 改判）与 my-skills/wxgame-audio-gen/SKILL.md。',
        ' */',
        'export const AUDIO_ASSETS: Readonly<Record<string, string>> = {',
        ...Object.entries(assets).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`),
        '};',
        '',
        '/** 供设置面板/调试用：每条 base64 的字符长度（KB）——主包按此计。 */',
        `export const AUDIO_ASSET_SIZES: Readonly<Record<string, number>> = ${JSON.stringify(Object.fromEntries(rows.filter((r) => r.b64KB).map((r) => [r.id, r.b64KB])))};`,
        '',
    ].join('\n'));
    console.log(`已写入 ${OUT_JS}（${kb(statSync(OUT_JS).size)} KB）`);
}
