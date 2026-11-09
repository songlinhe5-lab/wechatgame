#!/usr/bin/env node
/**
 * import-cocos-metas.mjs — 让 **Cocos 编辑器自己**为指定资产目录生成 `.meta`，然后校验。
 *
 * 为什么不用脚本直接写 `.meta`：工程铁律 **L1**（`AGENTS.md` §3 / `control-manifest.md`）
 * 禁止手工编辑 `.meta`；`.meta` 里的 `uuid` / `importer` / 子资源表由编辑器资产库签发，
 * 手写会和资产库状态分叉。本脚本只做两件事：
 *   ① 调编辑器自带 CLI（`--project <proj> --build ...`）触发一次资产导入；
 *   ② 复核每个资产是否已落 `.meta`，缺则非零退出。
 *
 * 用法：
 *   node tools/scripts/import-cocos-metas.mjs --check                 # 只检查，不调编辑器
 *   node tools/scripts/import-cocos-metas.mjs                         # 缺则触发导入（默认 beads / textures/detail）
 *   node tools/scripts/import-cocos-metas.mjs --game=beads --dir=assets/textures/detail
 *   node tools/scripts/import-cocos-metas.mjs --platform=wechatgame   # 换平台（默认 web-mobile，快且不需 AppID）
 *
 * 说明：
 * - 默认 `platform=web-mobile;debug=true`：仅触发资产导入，产物落 `games/<game>/cocos/build/web-mobile/`
 *   （`.gitignore` 已忽略，不会覆盖微信发布基线产物）。
 * - 编辑器路径可用 `COCOS_CREATOR` 环境变量覆盖；缺编辑器时打印手工步骤并以 2 退出。
 * - CI 建议只跑 `--check`（不依赖本机编辑器）。
 *
 * 实测注意（2026-11-09）：
 * - 编辑器启动时要写 `~/.CocosCreator/editor/*.json`，**受限沙箱里会 EACCES** ⇒ 需在普通终端
 *   （或对工具沙箱放行该目录）运行；`--check` 不受影响。
 * - 同一工程已在 GUI 编辑器打开时，CLI 主进程可能报 `browser_1.init is not a function` 并非零退出，
 *   但 asset-db 仍可能已完成导入 ⇒ 退出码非零时本脚本**以 `.meta` 是否落盘为准**复核，不直接判死。
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_COCOS_APP = '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator';

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    process.exit(0);
}
const game = argv.find((a) => a.startsWith('--game='))?.slice('--game='.length) ?? 'beads';
const dirArg = argv.find((a) => a.startsWith('--dir='))?.slice('--dir='.length) ?? 'assets/textures/detail';
const platform = argv.find((a) => a.startsWith('--platform='))?.slice('--platform='.length) ?? 'web-mobile';
const checkOnly = argv.includes('--check');
const timeoutMs = Number(argv.find((a) => a.startsWith('--timeout='))?.slice('--timeout='.length) ?? 10 * 60 * 1000);

const cocosDir = join(ROOT, 'games', game, 'cocos');
const targetDir = resolve(cocosDir, dirArg);

if (!existsSync(cocosDir)) fail(`找不到 Cocos 工程：${cocosDir}`, 2);
if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) fail(`找不到资产目录：${targetDir}`, 2);

const assets = readdirSync(targetDir)
    .filter((f) => !f.endsWith('.meta') && !f.startsWith('.'))
    .sort();
const missing = assets.filter((f) => !existsSync(join(targetDir, `${f}.meta`)));

console.log(`📦 ${game} · ${dirArg}`);
console.log(`   资产 ${assets.length} 件 · 已有 .meta ${assets.length - missing.length} 件 · 缺失 ${missing.length} 件`);
for (const f of missing) console.log(`   ✗ ${f}  →  ${f}.meta`);

if (missing.length === 0) {
    console.log('✅ 全部资产已有 .meta（编辑器签发件，⛔ 不手写）');
    process.exit(0);
}
if (checkOnly) {
    console.log('⛔ --check：存在缺失 .meta（跑不带 --check 的本脚本让编辑器导入）');
    process.exit(1);
}

const cocosApp = process.env.COCOS_CREATOR || DEFAULT_COCOS_APP;
if (!existsSync(cocosApp)) {
    console.log(`\n⚠️  找不到 Cocos Creator：${cocosApp}`);
    console.log('   手工步骤：打开 Cocos Dashboard → 打开工程 games/' + game + '/cocos → 等资产栏刷新 → 关闭编辑器。');
    console.log('   （或用 COCOS_CREATOR=<可执行文件路径> 重跑本脚本）');
    process.exit(2);
}

console.log(`\n🔨 触发编辑器资产导入：${platform} / debug（产物落 cocos/build/${platform}/，gitignored）`);
const buildConfig = [`platform=${platform}`, 'debug=true'].join(';');
const res = spawnSync(cocosApp, ['--project', cocosDir, '--build', buildConfig], {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: timeoutMs,
});
if (res.error) fail(`调用编辑器失败：${res.error.message}`, 1);

// 退出码不可全信：GUI 已开同工程时主进程会报 browser_1.init 并非零退出，asset-db 却已完成导入。
// 以文件系统事实为准，退出码只作为失败时的诊断信息。
const stillMissing = assets.filter((f) => !existsSync(join(targetDir, `${f}.meta`)));
if (stillMissing.length > 0) {
    for (const f of stillMissing) console.log(`   ✗ 仍缺 ${f}.meta`);
    fail(
        `编辑器退出码 ${res.status ?? 'null'}，且 .meta 仍不齐（看 games/${game}/cocos/temp/logs/；`
            + '确认资产目录在 assets/ 下，或关掉该工程的 GUI 编辑器后重试）',
        1,
    );
}
if (res.status !== 0) {
    console.log(`⚠️ 编辑器主进程退出码 ${res.status ?? 'null'}，但 .meta 已由 asset-db 签发，按成功处理`);
}
console.log(`✅ 编辑器已签发 ${missing.length} 件 .meta；可提交（.meta 属工程正本）`);
process.exit(0);

function fail(msg, code) {
    console.error(`\n❌ ${msg}`);
    process.exit(code);
}

function printHelp() {
    console.log(`import-cocos-metas.mjs — 用 Cocos 编辑器 CLI 触发资产导入并校验 .meta

  --check              只检查 .meta 是否齐全（不调编辑器；CI 用）
  --game=<name>        游戏目录名（默认 beads）
  --dir=<rel>          相对 cocos/ 的资产目录（默认 assets/textures/detail）
  --platform=<p>       触发导入用的构建平台（默认 web-mobile，快且不需 AppID）
  --timeout=<ms>       编辑器超时（默认 600000）
  COCOS_CREATOR=<path> 编辑器可执行文件路径覆盖

铁律 L1：脚本只调编辑器生成 .meta，⛔ 不手写 .meta。`);
}
