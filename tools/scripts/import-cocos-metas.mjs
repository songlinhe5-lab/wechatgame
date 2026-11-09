#!/usr/bin/env node
/**
 * import-cocos-metas.mjs — 让 **Cocos 编辑器自己**为指定资产目录生成 `.meta`，然后校验。
 *
 * 为什么不用脚本直接写 `.meta`：工程铁律 **L1**（`AGENTS.md` §3 / `control-manifest.md`）
 * 禁止手工编辑 `.meta`；`.meta` 里的 `uuid` / `importer` / 子资源表由编辑器资产库签发，
 * 手写会和资产库状态分叉。本脚本做三件事：
 *   ① 可选：从 `--from=<源目录>` 批量导入**别处编辑器已签发**的 `.meta`（按相对路径对位，目标同名资产须已存在）；
 *   ② 调编辑器自带 CLI（`--project <proj> --build ...`）触发一次资产导入，补齐剩余缺失；
 *   ③ 复核每个资产是否已落 `.meta`，缺则非零退出。
 *
 * 用法：
 *   node tools/scripts/import-cocos-metas.mjs --check                 # 只检查，不调编辑器
 *   node tools/scripts/import-cocos-metas.mjs                         # 缺则触发导入（默认 beads / textures/detail）
 *   node tools/scripts/import-cocos-metas.mjs --game=beads --dir=assets/textures/detail
 *   node tools/scripts/import-cocos-metas.mjs --platform=wechatgame   # 换平台（默认 web-mobile，快且不需 AppID）
 *   node tools/scripts/import-cocos-metas.mjs --from=../export/detail # 从源目录批量导入 .meta（可配 --recursive / --force）
 *
 * 说明：
 * - `--from` 只拷 `.meta`，不拷资产本体：目标目录里必须有同名资产（含目录 meta 对应的目录）；
 *   源件须是编辑器签发件（脚本校验 JSON 可解析且含 `uuid`），⛔ 不手写、不猜 uuid。
 * - `--from` 默认**不覆盖**目标已有 `.meta`（换 uuid 会断引用）；`--force` 才覆盖，慎用。
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

import { copyFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
const fromArg = argv.find((a) => a.startsWith('--from='))?.slice('--from='.length);
const recursive = argv.includes('--recursive');
const force = argv.includes('--force');
const timeoutMs = Number(argv.find((a) => a.startsWith('--timeout='))?.slice('--timeout='.length) ?? 10 * 60 * 1000);

const cocosDir = join(ROOT, 'games', game, 'cocos');
const targetDir = resolve(cocosDir, dirArg);

if (!existsSync(cocosDir)) fail(`找不到 Cocos 工程：${cocosDir}`, 2);
if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) fail(`找不到资产目录：${targetDir}`, 2);

const fromPending = fromArg
    ? importFromSource({
          sourceDir: resolve(process.cwd(), fromArg),
          targetDir,
          recursive,
          force,
          checkOnly,
      })
    : 0;

const assets = readdirSync(targetDir)
    .filter((f) => !f.endsWith('.meta') && !f.startsWith('.'))
    .sort();
const missing = assets.filter((f) => !existsSync(join(targetDir, `${f}.meta`)));

console.log(`📦 ${game} · ${dirArg}`);
console.log(`   资产 ${assets.length} 件 · 已有 .meta ${assets.length - missing.length} 件 · 缺失 ${missing.length} 件`);
for (const f of missing) console.log(`   ✗ ${f}  →  ${f}.meta`);

if (missing.length === 0) {
    if (fromPending > 0) {
        console.log(`⛔ --check：源目录还有 ${fromPending} 件可导入 .meta（去掉 --check 执行）`);
        process.exit(1);
    }
    console.log('✅ 全部资产已有 .meta（编辑器签发件，⛔ 不手写）');
    process.exit(0);
}
if (checkOnly) {
    console.log('⛔ --check：存在缺失 .meta（跑不带 --check 的本脚本补：有 --from 先拷源 .meta，剩余交编辑器）');
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

/**
 * 从源目录批量导入现成 `.meta`（按相对路径对位）。
 * 只导 `.meta`，不搬资产本体；目标同名资产（或目录）必须已存在。
 */
function importFromSource({ sourceDir, targetDir, recursive, force, checkOnly }) {
    if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
        fail(`找不到源目录：${sourceDir}`, 2);
    }
    if (sourceDir === targetDir) fail('源目录与目标资产目录相同，无需导入', 2);

    const metas = collectMetas(sourceDir, recursive);
    console.log(`\n📥 源目录：${sourceDir}`);
    console.log(`   发现 .meta ${metas.length} 件${recursive ? '（含子目录）' : '（仅顶层；子目录加 --recursive）'}`);
    if (metas.length === 0) return;

    let imported = 0;
    let overwritten = 0;
    let keptExisting = 0;
    const planned = [];
    const plannedOverwrite = [];
    const orphans = [];
    const invalid = [];

    for (const rel of metas) {
        const srcMeta = join(sourceDir, rel);
        const destMeta = join(targetDir, rel);
        const destAsset = destMeta.slice(0, -'.meta'.length);

        let parsed;
        try {
            parsed = JSON.parse(readFileSync(srcMeta, 'utf8'));
        } catch {
            invalid.push(rel);
            continue;
        }
        // 编辑器签发件的最小特征：可解析 JSON 且带 uuid；⛔ 不替它猜 uuid
        if (typeof parsed?.uuid !== 'string' || parsed.uuid.length === 0) {
            invalid.push(rel);
            continue;
        }
        if (!existsSync(destAsset)) {
            orphans.push(rel);
            continue;
        }
        const destExists = existsSync(destMeta);
        if (destExists && !force) {
            keptExisting++;
            continue;
        }
        if (checkOnly) {
            (destExists ? plannedOverwrite : planned).push(rel);
            continue;
        }
        copyFileSync(srcMeta, destMeta);
        if (destExists) overwritten++;
        else imported++;
    }

    if (checkOnly) {
        console.log(`   · --check：可导入 ${planned.length} 件 / 可覆盖 ${plannedOverwrite.length} 件（未落盘）`);
    } else {
        console.log(`   ✓ 导入 ${imported} 件${overwritten > 0 ? `；↻ 覆盖 ${overwritten} 件（--force）` : ''}`);
    }
    if (keptExisting > 0) console.log(`   ↷ 跳过 ${keptExisting} 件：目标已有 .meta（--force 才覆盖）`);
    if (orphans.length > 0) {
        console.log(`   ✗ 跳过 ${orphans.length} 件：目标无对应资产（本脚本只导 .meta，不搬资产本体）`);
        for (const rel of orphans) console.log(`      · ${rel}`);
    }
    if (invalid.length > 0) {
        console.log(`   ✗ 跳过 ${invalid.length} 件：非法 .meta（JSON 解析失败或缺 uuid，⛔ 不可手写冒充）`);
        for (const rel of invalid) console.log(`      · ${rel}`);
    }

    // --check 时把「本该导入但未落盘」的件数回传给主流程定退出码
    return checkOnly ? planned.length : 0;
}

function collectMetas(dir, recursive) {
    const out = [];
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
        if (ent.name.startsWith('.')) continue;
        if (ent.isDirectory()) {
            if (recursive) {
                for (const rel of collectMetas(join(dir, ent.name), true)) out.push(join(ent.name, rel));
            }
            continue;
        }
        if (ent.name.endsWith('.meta')) out.push(ent.name);
    }
    return out;
}

function fail(msg, code) {
    console.error(`\n❌ ${msg}`);
    process.exit(code);
}

function printHelp() {
    console.log(`import-cocos-metas.mjs — 用 Cocos 编辑器 CLI 触发资产导入并校验 .meta

  --check              只检查 .meta 是否齐全（不调编辑器；CI 用）
  --from=<dir>         从源目录批量导入现成 .meta（相对当前工作目录；只导 .meta，目标同名资产须已存在）
  --recursive          配合 --from：递归源目录子层级
  --force              配合 --from：覆盖目标已有 .meta（⚠ uuid 会变，可能断引用）
  --game=<name>        游戏目录名（默认 beads）
  --dir=<rel>          相对 cocos/ 的资产目录（默认 assets/textures/detail）
  --platform=<p>       触发导入用的构建平台（默认 web-mobile，快且不需 AppID）
  --timeout=<ms>       编辑器超时（默认 600000）
  COCOS_CREATOR=<path> 编辑器可执行文件路径覆盖

铁律 L1：脚本只调编辑器生成 .meta，⛔ 不手写 .meta。`);
}
