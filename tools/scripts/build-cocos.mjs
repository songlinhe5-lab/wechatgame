#!/usr/bin/env node
/**
 * build-cocos.mjs — Cocos 构建：前置检查 + **命令行构建** + 产物校验（WXG-T-048 ① / T-049）。
 *
 * ── 能力来源（两轮实测，结论被修正过一次，两轮都记在这里）─────────────────
 * 🚫 **MCP 通道不能构建**（`ADR-0009 §3.2` P2 偏差登记）：`cocos-mcp-server` v1.5.4 的
 *    `project_build_system` 只有 `get_build_settings` / `open_build_panel` /
 *    `check_builder_status` 三个 action，唯一含 `build` 的 `project_manage` 被白名单禁用，
 *    其实现也只 `Editor.Message.request('builder','open')`。
 *    （那条只说明 **MCP** 不可，**不**说明构建不可自动化 —— 见下。）
 * ✅ **编辑器自带 CLI 可以构建**（2026-09-14 实测）：官方手册《命令行发布项目》给出
 *    `CocosCreator --project <proj> --build "platform=<p>;debug=true"`；
 *    本机 `app-asar` 内含 `--project` / `--build` / `buildConfig`；
 *    实测 `platform=web-mobile` **3.9 秒构建成功**，产物含 `index.html` / `cocos-js/` /
 *    `assets/`，日志 `build Task (web-mobile) Finished in (3 s)`，
 *    **且编辑器实例同时开着也不冲突**。
 *
 * ── 副作用与前置（如实声明）──────────────────────────────────────────────
 * · 构建会写 `games/<game>/cocos/build/<platform>/`（已被 `.gitignore` 覆盖）。
 * · 构建日志：`<cocos>/temp/logs/cli-build-<platform>.log`（temp 亦被忽略）。
 * · 本脚本**不碰** AppID / 上传密钥（红线见 `control-manifest §10` / `ADR-0010 §4.2-5`）。
 * · 微信小游戏平台（默认）需要有效 AppID 才能构建成功；仅看渲染/手感用 `--platform=web-mobile`。
 *
 * ── CLI 参数 ────────────────────────────────────────────────────────────
 * （Cocos 的 `--build` 是**分号分隔的 k=v 串**，不是多个 shell 参数。）
 *
 * ── 多游戏调用约定（WXG-T-048）───────────────────────────────────────────
 * 本脚本按游戏声明在各游戏自己的 `package.json`，根层 `pnpm -r` 聚合：
 *   games/<game>/package.json  "build:cocos":     "node ../../tools/scripts/build-cocos.mjs"
 *                              "build:cocos:web": "node ../../tools/scripts/build-cocos.mjs --platform=web-mobile"
 *   package.json               "build:cocos":     "pnpm -r run build:cocos"
 *                              "build:cocos:web": "pnpm -r run build:cocos:web"
 * ⇒ cwd 自带 game 身份（名字不歧义）、新增游戏零改根脚本。
 *
 * ── 用法 ────────────────────────────────────────────────────────────────
 *   node tools/scripts/build-cocos.mjs                       # 默认 platform=wechatgame
 *   node tools/scripts/build-cocos.mjs --platform=web-mobile # 手机浏览器预览用
 *   node tools/scripts/build-cocos.mjs --no-build            # 只做前置检查，不构建
 *   node tools/scripts/build-cocos.mjs --open-panel          # 改经 MCP 打开构建面板（不构建）
 *   node tools/scripts/build-cocos.mjs --game=breakout       # 显式指定游戏（任意 cwd）
 *
 * 退出码：0 = 成功；1 = 前置或构建失败；2 = 用法错误。
 */

import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const COCOS_APP = '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator';
const MCP_HEALTH = 'http://127.0.0.1:3000/health';
const MCP_ENDPOINT = 'http://127.0.0.1:3000/mcp';

/** 平台 → 产物入口文件（构建成功的最小判据）。 */
const PLATFORM_ENTRY = {
  'web-mobile': 'index.html',
  'web-desktop': 'index.html',
  wechatgame: 'game.js',
  'wechat-mini-game': 'game.js',
};

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  printHelp();
  process.exit(0);
}

const gameArg = argv.find((a) => a.startsWith('--game='));
const platform = argv.find((a) => a.startsWith('--platform='))?.slice('--platform='.length) ?? 'wechatgame';
const NO_BUILD = argv.includes('--no-build');
const OPEN_PANEL = argv.includes('--open-panel');
/**
 * 默认 debug=true（便于看报错）。**测包体基线必须用 --release**——
 * debug 产物含 sourcemap 且不压缩，与 §3.8 的红线/目标没有可比性。
 */
const RELEASE = argv.includes('--release');

/** 判定游戏：`--game=` 优先，否则取 cwd 的 basename（per-package 调用的正常路径）。 */
const game = gameArg ? gameArg.slice('--game='.length) : basename(process.cwd());
const gameDir = join(ROOT, 'games', game);
const cocosDir = join(gameDir, 'cocos');

if (!game || !existsSync(gameDir)) {
  console.error(`❌ 无法定位游戏：cwd=${process.cwd()} 推导出 "${game}"，但 ${rel(gameDir)} 不存在。`);
  console.error('   正常用法是经 games/<game>/package.json 的 "build:cocos" 调用；');
  console.error('   手工调用请显式指定：node tools/scripts/build-cocos.mjs --game=breakout');
  process.exit(2);
}
if (!existsSync(COCOS_APP)) {
  console.error(`❌ 未找到 Cocos Creator CLI：${COCOS_APP}`);
  console.error('   安装见 docs/agent/cocos-setup.md §3。');
  process.exit(2);
}

console.log(`Cocos 构建 — game=${game} platform=${platform}${NO_BUILD ? '（--no-build：仅检查）' : ''}`);
console.log('');

const problems = [];
const hints = [];

// ── ① 工程与场景 ────────────────────────────────────────────────────────
if (!existsSync(cocosDir)) {
  problems.push(`${rel(cocosDir)} 不存在 —— 该游戏尚无 Cocos 工程`);
  hints.push('工程创建见 games/<game>/cocos/README.md（编辑器 GUI 步骤）');
} else {
  console.log(`  ✅ Cocos 工程存在：${rel(cocosDir)}`);
  if (existsSync(join(cocosDir, 'assets', 'Main.scene'))) console.log('  ✅ Main.scene 存在');
  else hints.push('未找到 assets/Main.scene —— 起始场景依赖它，先在编辑器里打开并保存');
}

// ── ② 框架/玩法拷贝件是否最新（构建前把可提前发现的漂移先发现）──────────
if (existsSync(cocosDir)) {
  const sync = spawnSync(process.execPath, [join(ROOT, 'tools/scripts/sync-framework-to-cocos.mjs'), '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (sync.status === 0) console.log('  ✅ 框架/玩法拷贝件与源码一致（framework:sync:check）');
  else {
    problems.push('拷贝件与源码不一致 —— 直接构建会编出旧代码');
    hints.push('先跑：pnpm run framework:sync');
  }
}

// ── ③ 编辑器 / MCP 状态（只是提示，不阻断 CLI 构建）──────────────────────
const health = await probeHealth();
console.log(
  health.ok
    ? `  ℹ️  编辑器 MCP 在线（${health.body}）—— 与 CLI 构建可并存（实测）`
    : `  ℹ️  编辑器 MCP 未探测到（${health.reason}）—— CLI 构建不依赖它`,
);

if (problems.length) {
  console.error('');
  console.error('❌ 前置检查未通过：');
  for (const p of problems) console.error(`   · ${p}`);
  for (const h of hints) console.error(`   → ${h}`);
  process.exit(1);
}

// ── ④ 构建（或按要求跳过）───────────────────────────────────────────────
const productDir = join(cocosDir, 'build', platform);
const entry = PLATFORM_ENTRY[platform] ?? null;

if (NO_BUILD) {
  console.log('');
  console.log('✅ 前置检查通过（--no-build：未执行构建）。');
  printNextSteps({ cocosDir, gameDir, platform, productDir });
  process.exit(0);
}

if (OPEN_PANEL) {
  const res = health.ok
    ? await callMcp('project_build_system', { action: 'open_build_panel' })
    : { ok: false, detail: 'MCP 不可达' };
  console.log(res.ok ? `  ✅ 已请求编辑器打开构建面板（${res.detail}）` : `  ⚠️  打开面板失败（${res.detail}）`);
  console.log('');
  console.log('（--open-panel 已生效，不再执行 CLI 构建。）');
  printNextSteps({ cocosDir, gameDir, platform, productDir });
  process.exit(0);
}

const logDir = join(cocosDir, 'temp', 'logs');
const logFile = join(logDir, `cli-build-${platform}${RELEASE ? '-release' : ''}.log`);
mkdirSync(logDir, { recursive: true });

console.log('');
console.log(
  `  🔨 命令行构建中（${platform}${RELEASE ? ' · release' : ' · debug'}）… 日志：${rel(logFile)}`,
);
const started = Date.now();
const run = spawnSync(
  COCOS_APP,
  ['--project', cocosDir, '--build', `platform=${platform};debug=${RELEASE ? 'false' : 'true'}`],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const secs = ((Date.now() - started) / 1000).toFixed(1);
try {
  writeFileSync(logFile, `${run.stdout ?? ''}\n${run.stderr ?? ''}`, 'utf8');
} catch {
  /* 日志写失败不影响结论 */
}

const built = entry ? existsSync(join(productDir, entry)) : existsSync(productDir);
console.log(built ? `  ✅ 构建完成（${secs}s）` : `  ❌ 构建未产出预期入口（${entry ?? '产物目录'}，${secs}s）`);

if (!built) {
  console.error('');
  console.error('构建失败的常见原因（按概率）：');
  console.error('  1. AppID 未填 / 无效（platform=wechatgame 必需；先试 --platform=web-mobile 排除平台因素）');
  console.error(`  2. 脚本编译错误 —— 直接看编辑器控制台或 ${rel(join(cocosDir, 'temp', 'logs', 'project.log'))}`);
  console.error('  3. 构建配置缺字段（本工程 cocos/settings/v2/packages/builder.json 目前为空壳）');
  console.error(`  完整 CLI 输出已落 ${rel(logFile)}`);
  process.exit(1);
}

printSummary({ game, platform, productDir, entry, secs });
printNextSteps({ cocosDir, gameDir, platform, productDir });
process.exit(0);

// ─────────────────────────────────────────────────────────── 报告 ───────────

function printSummary({ game, platform, productDir, entry, secs }) {
  console.log('');
  console.log(`产物：${rel(productDir)}（入口 ${entry}，${secs}s）`);
  if (platform === 'web-mobile' || platform === 'web-desktop') {
    console.log('  手机预览（同 Wi-Fi）：');
    console.log(`    npx --yes serve -l tcp://0.0.0.0:8080 ${productDir}`);
    console.log(`    然后手机开 http://<本机局域网IP>:8080 （取 IP：ipconfig getifaddr en0）`);
  }
  void game;
}

function printNextSteps({ cocosDir, gameDir, platform, productDir }) {
  if (platform === 'wechatgame' || platform === 'wechat-mini-game') {
    console.log('');
    console.log('  微信小游戏后续：');
    console.log(`    · 包体校验：pnpm run check:size ${rel(productDir)}`);
    console.log('      ⚠️ 包体数字只对 **release** 产物有意义：debug 含 sourcemap 且不压缩，');
    console.log('         测基线请用 pnpm run build:cocos --release 后再跑 check:size。');
    console.log('    · 真机预览：微信开发者工具打开产物目录 —— 需 AppID + 上传密钥 + IP 白名单');
    console.log('      （密钥严禁入仓；见 control-manifest §10 / ADR-0010 §4.2-5）');
  } else {
    console.log('');
    console.log('  注意：web 平台的产物**不是微信运行时**——没有 wx.* 能力，');
    console.log('        只用于验证渲染/手感/性能档位，不代表微信兼容性。');
  }
  void cocosDir;
}

// ─────────────────────────────────────────────────────────── helpers ────────

/** GET /health（MCP 服务有该端点；`/mcp` 的 GET 恒 404，不可用于探活）。 */
async function probeHealth() {
  try {
    const res = await fetch(MCP_HEALTH, { signal: AbortSignal.timeout(1500) });
    const body = (await res.text()).trim().slice(0, 80);
    return res.ok ? { ok: true, body } : { ok: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err?.name === 'TimeoutError' ? '超时' : '连接被拒' };
  }
}

/** 极简 MCP 调用（initialize → tools/call），仅供 open_build_panel 这类低风险动作。 */
async function callMcp(toolName, args) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  const post = async (payload) => {
    const res = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
    const text = await res.text();
    const jsonLine = text.split('\n').find((l) => l.trim().startsWith('{') || l.startsWith('data:'));
    try {
      return JSON.parse(jsonLine ? jsonLine.replace(/^data:\s*/, '') : text);
    } catch {
      return null;
    }
  };
  try {
    await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'build-cocos', version: '1' } },
    });
    const out = await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: toolName, arguments: args } });
    const text = out?.result?.content?.[0]?.text;
    return { ok: !out?.error, detail: out?.error ? out.error.message : String(text ?? '').slice(0, 100) };
  } catch (err) {
    return { ok: false, detail: err?.message ?? String(err) };
  }
}

function rel(p) {
  const r = resolve(p).replace(`${ROOT}/`, '');
  return r.startsWith('/') ? p : r;
}

function printHelp() {
  console.log(`Cocos 构建（前置检查 + 命令行构建 + 产物校验）

用法：
  node tools/scripts/build-cocos.mjs [选项]

  --platform=<p>   构建平台，默认 wechatgame（可选 web-mobile / web-desktop）
  --release        debug=false（**测包体基线必须用它**；默认 debug=true 含 sourcemap 且不压缩）
  --no-build       只做前置检查，不执行构建
  --open-panel     改经 MCP 打开编辑器构建面板（不执行 CLI 构建）
  --game=<name>    显式指定游戏（默认取 cwd 的 basename —— per-package 调用的正常路径）
  -h, --help       本帮助

构建能力来源（两轮实测）：
  🚫 MCP 的 project_build_system 无构建 action（ADR-0009 §3.2 P2 偏差）
  ✅ 编辑器自带 CLI：CocosCreator --project <proj> --build "platform=<p>;debug=true"
     实测 web-mobile 3.9s 成功；编辑器开着也可并存。

多游戏调用：
  per-package 声明（games/<game>/package.json 的 build:cocos / build:cocos:web）
  + 根层 pnpm -r 聚合，见脚本头注释。`);
}
