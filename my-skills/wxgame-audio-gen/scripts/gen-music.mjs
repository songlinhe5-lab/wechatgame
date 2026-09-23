#!/usr/bin/env node
/**
 * gen-music.mjs — 调阿里云百炼 **fun-music-v1** 生成 BGM，下载到工程并（可选）转码/裁剪。
 *
 * API 事实取自官方文档（2026-09-23 抓取，`help.aliyun.com/zh/model-studio/fun-music`）：
 *   POST https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/music/generation
 *   Header: Authorization: Bearer $DASHSCOPE_API_KEY ，Content-Type: application/json
 *   Body  : { model: "fun-music-v1", input: { prompt | lyrics, is_instrumental, gender }, ... }
 *   返回  : **同步** —— output.audio.url（一个下载链接，需再 GET 一次）
 *   v1 支持 is_instrumental（纯音乐，此时 lyrics/gender 被忽略）与 gender（仅 v1）
 *   输出格式 format：mp3 | wav
 *
 * 实测进度（2026-09-23 用假 key 探路）：**端点可达、请求确实发出、鉴权失败体是平铺的**
 *   `{request_id, code, message}`（网关对任意子域名都回 401 InvalidApiKey）⇒ 网络与 URL 形状已验。
 * ⚠ 仍未实测（必须等真 key 的**成功**响应才能确认，别当已验证事实）：
 *   ① 成功体里音频 url 的确切路径（本脚本按 `output.audio.url` 取，取不到时会打印真实结构）；
 *   ② `format` 的挂载位置（现按 `parameters.format` 发；若报未知字段改 `input.format`）；
 *   ③ 该 url 的有效期与是否需要同区域凭证。
 *
 * 凭证来源（**不要贴进对话**；两条都支持）：
 *   ① 环境变量：export DASHSCOPE_API_KEY=… / DASHSCOPE_WORKSPACE_ID=…
 *   ② 仓库根 `.env.local`（已在 .gitignore 第 60–61 行内，不会被提交）：
 *        DASHSCOPE_API_KEY=sk-xxx
 *        DASHSCOPE_WORKSPACE_ID=llt-xxxx
 *   本脚本不落盘、不打印 key；缺失时只报错退出。
 *
 * USAGE
 *   node my-skills/wxgame-audio-gen/scripts/gen-music.mjs \
 *     --prompt "手作拼豆治愈系，音乐盒与软电钢，舒缓不抢注意力，无鼓，游戏背景音乐" \
 *     --instrumental --out games/beads/assets/audio/bgm_main.mp3
 *   追加 --loop 40 可用 ffmpeg 裁成 40 s 整数倍并做首尾淡化（无缝循环要真听复验）
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const arg = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

// 轻量读 .env.local（不给脚本引入 dotenv 依赖；只取需要的两个键，不打印值）
function dotenv(p) {
  try {
    const out = {};
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}
const env = dotenv(resolve(process.cwd(), '.env.local'));
const KEY = process.env.DASHSCOPE_API_KEY ?? env.DASHSCOPE_API_KEY ?? '';
// 空串也算没填（`.env.local` 里 `KEY=` 留空是最常见的误填法，不能让坏 URL 溜过去）
const WS = [arg('--workspace', ''), process.env.DASHSCOPE_WORKSPACE_ID, env.DASHSCOPE_WORKSPACE_ID]
  .map((v) => (v ?? '').trim())
  .find((v) => v) ?? '{WorkspaceId}';
const MODEL = arg('--model', 'fun-music-v1');
const FORMAT = arg('--format', 'mp3');
const OUT = arg('--out', 'temp/bgm_generated.mp3');
const PROMPT = arg('--prompt', '');
const LYRICS = arg('--lyrics', '');
const SEC = Number(arg('--loop', '0'));

// 零计费自检：只验凭证是否被正确读到，**不发任何请求**（填完 key 先用它确认，别烧一次生成）
if (flag('--check')) {
  const shape = KEY ? `${KEY.slice(0, 3)}…${KEY.length} 位` : '（空）';
  console.log(JSON.stringify({
    envLocalFound: !!env.DASHSCOPE_API_KEY,
    apiKey: KEY ? `已读到：${shape}` : '未读到 ⇒ 检查 .env.local 键名与等号后空格',
    workspaceId: WS.includes('{WorkspaceId}') ? '未读到 ⇒ 填 DASHSCOPE_WORKSPACE_ID' : `已读到：${WS}`,
    endpoint: `https://${WS}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/music/generation`,
    billable: false,
  }, null, 2));
  process.exit(KEY && !WS.includes('{WorkspaceId}') ? 0 : 2);
}

if (!KEY) {
  console.error('缺 DASHSCOPE_API_KEY：写进仓库根 .env.local（已 gitignore）或 export 后再跑。本脚本不会替你写 key 到任何文件。');
  process.exit(2);
}
if (WS.includes('{WorkspaceId}')) {
  console.error('缺业务空间 ID：--workspace <id>、或 .env.local 里 DASHSCOPE_WORKSPACE_ID=…');
  process.exit(2);
}
if (!PROMPT && !LYRICS) {
  console.error('prompt 与 lyrics 至少给一个（v1 规则：同时给则只有 lyrics 生效）。');
  process.exit(2);
}

const input = {};
if (LYRICS) input.lyrics = LYRICS;
if (PROMPT) input.prompt = PROMPT;
if (flag('--instrumental')) input.is_instrumental = true;
if (arg('--gender', '')) input.gender = arg('--gender', '');

const body = { model: MODEL, input, parameters: { format: FORMAT } };
const url = `https://${WS}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/music/generation`;

const t0 = Date.now();
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.error(text.slice(0, 800));
  process.exit(1);
}
let json;
try {
  json = JSON.parse(text);
} catch {
  console.error('响应不是 JSON：' + text.slice(0, 400));
  process.exit(1);
}
const audioUrl = json?.output?.audio?.url ?? json?.output?.audio_url ?? json?.output?.url;
if (!audioUrl) {
  console.error('没在 output 里找到音频 url，实际结构如下（据此修正本脚本取值路径）：');
  console.error(JSON.stringify(json?.output ?? json, null, 2).slice(0, 900));
  process.exit(1);
}
const audio = await fetch(audioUrl);
if (!audio.ok) {
  console.error(`音频下载失败 HTTP ${audio.status}`);
  process.exit(1);
}
const buf = Buffer.from(await audio.arrayBuffer());
const { writeFileSync, mkdirSync } = await import('node:fs');
const { dirname } = await import('node:path');
mkdirSync(dirname(resolve(OUT)), { recursive: true });
writeFileSync(resolve(OUT), buf);
const kb = (buf.length / 1024).toFixed(0);
console.log(JSON.stringify({
  out: resolve(OUT), bytes: buf.length, KB: +kb, secs_wall: +((Date.now() - t0) / 1000).toFixed(1),
  model: MODEL, instrumental: !!input.is_instrumental, format: FORMAT,
  request_id: json?.request_id ?? null,
  next: '用 ffprobe 验时长；要无缝循环请 --loop 或手工折叠尾（并真听复验）',
}, null, 2));

if (SEC > 0) {
  const { spawnSync } = await import('node:child_process');
  const faded = resolve(OUT).replace(/(\.\w+)$/, '_loop$1');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-stream_loop', '-1', '-i', resolve(OUT),
    '-t', String(SEC), '-af', `afade=t=out:st=${(SEC - 0.08).toFixed(2)}:d=0.08`, resolve(faded)], { encoding: 'utf8' });
  console.log(r.status === 0 ? `已裁成 ${SEC}s 循环版：${faded}` : `裁剪失败：${(r.stderr || '').slice(0, 200)}`);
}
