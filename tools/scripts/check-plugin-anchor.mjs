#!/usr/bin/env node
/**
 * check-plugin-anchor.mjs — MCP 版本锚一致性校验（WXG-T-035，ADR-0010）。
 *
 * 校验的不变量：
 *   P1  根 `.mcp.json` 与 `.cursor/mcp.json` 存在、合法 JSON、含 mcpServers 条目
 *   P2  两文件锚定的 MCP 包 spec 一致，且为「包名@确定 semver」——禁止 @latest / 裸包名 / *
 *   P3  锚定的包名与 my-plugins vendor 的 plugin.json 声明的 mcpServers 包名一致
 *       （vendor 留档记录的确实是同一个包，防止"留档 A 运行 B"）
 *   P4  vendor plugin.json 存在且含 version（留档完整性）
 *
 * 设计事实（ADR-0010）：vendor 快照版本（0.1.4，插件实体）与运行锚版本（0.1.13，npm
 * MCP 包）**有意不同**，两者是不同制品，不要求相等——只要求指向同一个包且各自显式锚定。
 *
 * 接线点（pre-commit，由主理人统一接入，本脚本不改 .githooks/）：
 *   在 .githooks/pre-commit 的 check:links 之后追加一行：
 *     pnpm run check:plugins   # 或 node tools/scripts/check-plugin-anchor.mjs
 *   package.json scripts.check:plugins 已就位。
 *
 * Usage:
 *   node tools/scripts/check-plugin-anchor.mjs [--json] [--selftest]
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const AS_JSON = process.argv.includes('--json');
const SELFTEST = process.argv.includes('--selftest');

const VENDOR_PLUGIN_JSON = 'my-plugins/weixin-minigame-helper/0.1.4/.codebuddy-plugin/plugin.json';
const CONFIG_FILES = ['.mcp.json', '.cursor/mcp.json'];
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;

/**
 * 解析 mcpServers 条目中的包 spec（在 args 里找含包名的元素）。
 * @returns {{ name: string, spec: string, version: string|null, raw: string } | null}
 */
function extractSpec(serverEntry) {
  const args = Array.isArray(serverEntry?.args) ? serverEntry.args : [];
  const raw = args.find((a) => typeof a === 'string' && a.startsWith('@') && a.includes('/'));
  if (!raw) return null;
  const at = raw.lastIndexOf('@');
  if (at <= 0) return { name: raw, spec: raw, version: null, raw }; // 裸 scoped 包名
  const name = raw.slice(0, at);
  const version = raw.slice(at + 1);
  return { name, spec: raw, version, raw };
}

/**
 * 在 rootDir 下执行全部校验（selftest 用临时 fixture 复用同一逻辑）。
 * @returns {{ ok: boolean, errors: string[], warnings: string[], info: string[] }}
 */
export function checkAt(rootDir) {
  const errors = [];
  const warnings = [];
  const info = [];

  // --- vendor plugin.json ---
  const vendorPath = join(rootDir, VENDOR_PLUGIN_JSON);
  if (!existsSync(vendorPath)) {
    errors.push(`vendor plugin.json 缺失: ${VENDOR_PLUGIN_JSON}`);
  } else {
    let vendor;
    try {
      vendor = JSON.parse(readFileSync(vendorPath, 'utf8'));
    } catch (e) {
      errors.push(`vendor plugin.json JSON 非法: ${e.message}`);
      vendor = null;
    }
    if (vendor) {
      if (typeof vendor.version !== 'string' || !vendor.version) {
        errors.push('vendor plugin.json 缺少 version 字段（留档不完整）');
      } else {
        info.push(`vendor 插件快照版本 = ${vendor.version}（插件实体，有意 ≠ 运行锚版本，ADR-0010 §2-D′）`);
      }
      const entry = vendor.mcpServers?.[Object.keys(vendor.mcpServers ?? {})[0] ?? ''];
      const vendorSpec = entry ? extractSpec(entry) : null;
      if (!vendorSpec) {
        errors.push('vendor plugin.json 未声明 mcpServers 包（留档与能力来源脱钩）');
      } else {
        info.push(`vendor 声明的 MCP 包 = ${vendorSpec.name}（上游 spec: ${vendorSpec.raw}）`);
        // --- 各 MCP 配置文件 ---
        const anchors = [];
        for (const rel of CONFIG_FILES) {
          const cfgPath = join(rootDir, rel);
          if (!existsSync(cfgPath)) {
            errors.push(`${rel}: 缺失`);
            continue;
          }
          let cfg;
          try {
            cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
          } catch (e) {
            errors.push(`${rel}: JSON 非法 → ${e.message}`);
            continue;
          }
          const servers = cfg.mcpServers ?? {};
          const serverName = Object.keys(servers).find((k) => {
            const s = extractSpec(servers[k]);
            return s && s.name === vendorSpec.name;
          });
          if (!serverName) {
            errors.push(`${rel}: 未找到包 \`${vendorSpec.name}\` 的 mcpServers 条目`);
            continue;
          }
          const spec = extractSpec(servers[serverName]);
          if (!spec.version) {
            errors.push(`${rel}: \`${spec.name}\` 未带版本号（禁止裸包名，须 \`包名@x.y.z\`）`);
            continue;
          }
          if (/latest|\*/i.test(spec.version) || !SEMVER_RE.test(spec.version)) {
            errors.push(`${rel}: 锚定版本 \`${spec.version}\` 非确定 semver（禁止 @latest/*，control-manifest §15）`);
            continue;
          }
          anchors.push({ file: rel, spec });
        }
        if (anchors.length === CONFIG_FILES.length) {
          const [a, b] = anchors;
          if (a.spec.raw !== b.spec.raw) {
            errors.push(`两份配置锚不一致: ${a.file}=${a.spec.raw} vs ${b.file}=${b.spec.raw}`);
          } else {
            info.push(`运行锚一致: ${a.spec.raw}（${CONFIG_FILES.join(' + ')}）`);
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, info };
}

// --- selftest：临时 fixture 正反用例 ---
function selftest() {
  const cases = [];
  const makeRoot = (vendorJson, mcpJson, cursorJson) => {
    const dir = mkdtempSync(join(tmpdir(), 'plugin-anchor-'));
    mkdirSync(join(dir, 'my-plugins/weixin-minigame-helper/0.1.4/.codebuddy-plugin'), { recursive: true });
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    if (vendorJson !== null) {
      writeFileSync(join(dir, VENDOR_PLUGIN_JSON), JSON.stringify(vendorJson));
    }
    if (mcpJson !== null) writeFileSync(join(dir, '.mcp.json'), mcpJson);
    if (cursorJson !== null) writeFileSync(join(dir, '.cursor/mcp.json'), cursorJson);
    return dir;
  };
  const goodVendor = {
    name: 'weixin-minigame-helper',
    version: '0.1.4',
    mcpServers: { 'weixin-minigame-helper': { command: 'npx', args: ['-y', '--prefer-online', '@weadmin/weixin-minigame-helper-mcp@latest'] } },
  };
  const mcp = (v) =>
    JSON.stringify({ mcpServers: { 'weixin-minigame-helper': { command: 'npx', args: ['-y', `@weadmin/weixin-minigame-helper-mcp@${v}`] } } });

  // 1. 正例
  {
    const dir = makeRoot(goodVendor, mcp('0.1.13'), mcp('0.1.13'));
    const r = checkAt(dir);
    cases.push({ name: '正例：双配置同锚 0.1.13', pass: r.ok, detail: r.errors.join('; ') });
    rmSync(dir, { recursive: true, force: true });
  }
  // 2. 反例：两配置锚不一致
  {
    const dir = makeRoot(goodVendor, mcp('0.1.13'), mcp('0.1.12'));
    const r = checkAt(dir);
    cases.push({ name: '反例：锚不一致应失败', pass: !r.ok, detail: r.errors.join('; ') });
    rmSync(dir, { recursive: true, force: true });
  }
  // 3. 反例：@latest
  {
    const dir = makeRoot(goodVendor, JSON.stringify({ mcpServers: { x: { command: 'npx', args: ['-y', '@weadmin/weixin-minigame-helper-mcp@latest'] } } }), mcp('0.1.13'));
    const r = checkAt(dir);
    cases.push({ name: '反例：@latest 应失败', pass: !r.ok, detail: r.errors.join('; ') });
    rmSync(dir, { recursive: true, force: true });
  }
  // 4. 反例：裸包名（无版本）
  {
    const dir = makeRoot(goodVendor, JSON.stringify({ mcpServers: { x: { command: 'npx', args: ['@weadmin/weixin-minigame-helper-mcp'] } } }), mcp('0.1.13'));
    const r = checkAt(dir);
    cases.push({ name: '反例：裸包名应失败', pass: !r.ok, detail: r.errors.join('; ') });
    rmSync(dir, { recursive: true, force: true });
  }
  // 5. 反例：vendor 缺失
  {
    const dir = makeRoot(null, mcp('0.1.13'), mcp('0.1.13'));
    const r = checkAt(dir);
    cases.push({ name: '反例：vendor plugin.json 缺失应失败', pass: !r.ok, detail: r.errors.join('; ') });
    rmSync(dir, { recursive: true, force: true });
  }
  // 6. 反例：配置 JSON 非法
  {
    const dir = makeRoot(goodVendor, '{not json', mcp('0.1.13'));
    const r = checkAt(dir);
    cases.push({ name: '反例：非法 JSON 应失败', pass: !r.ok, detail: r.errors.join('; ') });
    rmSync(dir, { recursive: true, force: true });
  }

  const failed = cases.filter((c) => !c.pass);
  for (const c of cases) {
    process.stdout.write(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}${c.pass ? '' : ` → ${c.detail}`}\n`);
  }
  process.stdout.write(`selftest: ${cases.length - failed.length}/${cases.length} 通过\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// --- main ---
if (SELFTEST) {
  selftest();
} else {
  const result = checkAt(resolve(ROOT));
  if (AS_JSON) {
    process.stdout.write(JSON.stringify({ ...result, vendor: VENDOR_PLUGIN_JSON, configs: CONFIG_FILES }, null, 2) + '\n');
  } else if (result.ok) {
    process.stdout.write(`check:plugins OK — ${CONFIG_FILES.join(' + ')} 锚一致，vendor 留档完整\n`);
    for (const i of result.info) process.stdout.write(`  · ${i}\n`);
    for (const w of result.warnings) process.stderr.write(`  warn: ${w}\n`);
  } else {
    process.stderr.write(`check:plugins FAILED (${result.errors.length})\n`);
    for (const e of result.errors) process.stderr.write(`  - ${e}\n`);
    process.exitCode = 1;
  }
}
