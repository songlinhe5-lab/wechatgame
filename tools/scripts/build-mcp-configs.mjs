#!/usr/bin/env node
/**
 * build-mcp-configs.mjs — MCP 配置「语义正本 → 各 IDE 方言」生成器（WXG-T-043）。
 *
 * WHY THIS EXISTS
 * ---------------
 * 一条 MCP 服务器此前要在 3 份文件里各写一遍（`.mcp.json` / `.cursor/mcp.json` /
 * `.codebuddy/mcp.json`），改一处要同步三处 —— 漏改即「IDE 侧静默失效」。
 *
 * 为什么不像 `my-skills` 那样用符号链接：skills 共享的是**内容完全相同**的目录，
 * 而 MCP 配置**各 IDE 方言不同**（Cursor 官方文档：stdio 的 `type` 必填、远程示例
 * 只给 `url`；CodeBuddy 官方文档：建议显式 `type`）。symlink 会把一份方言强加给
 * 所有 IDE。故改用「语义正本 + 方言序列化」。
 *
 * 正本：`my-mcp/servers.json`（servers 语义 + targets 清单）
 * 产物：`targets[].path`（机器生成，勿手改）
 *
 * USAGE
 *   node tools/scripts/build-mcp-configs.mjs             # 生成 / 更新产物
 *   node tools/scripts/build-mcp-configs.mjs --check     # 校验漂移（exit 1）
 *   node tools/scripts/build-mcp-configs.mjs --selftest  # 正反用例自测
 *
 * 校验项（--check / --selftest 共用）：
 *   C1  正本存在且为合法 JSON
 *   C2  targets 非空、path 唯一、dialect 已实现
 *   C3  servers 语义合法（stdio→command+args / http→url），且 http **主机必须回环**
 *       （control-manifest.md §14 红线 2「HTTP 仅回环」的机械化）
 *   C4  每份产物内容 == 正本渲染结果（漂移 → FAIL）
 *   C5  已知 MCP 配置位置中「存在但未登记 targets」→ FAIL（防清单漏项静默失效，
 *       knowledge/lessons.md K-031）
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCE_REL = 'my-mcp/servers.json';
const AS_JSON = process.argv.includes('--json');
const CHECK_ONLY = process.argv.includes('--check');
const SELFTEST = process.argv.includes('--selftest');

/**
 * 各 IDE 方言：语义 → 该 IDE 官方文档认可的字段写法。
 * 新增方言前须先确认目标 IDE 文档，不要凭猜测加字段（见 my-mcp/README.md §6）。
 */
const DIALECTS = {
  /** 显式 type（CodeBuddy 文档"建议显式指定"；通用 CLI 亦接受） */
  explicit(s) {
    return s.transport === 'stdio'
      ? { type: 'stdio', command: s.command, args: s.args }
      : { type: 'http', url: s.url };
  },
  /** Cursor：stdio 的 type 必填；远程服务器官方示例只给 url（不写 type） */
  cursor(s) {
    return s.transport === 'stdio'
      ? { type: 'stdio', command: s.command, args: s.args }
      : { url: s.url };
  },
};

/** 已知 MCP 配置候选位置；存在却未登记 targets → C5 FAIL。不含 .vscode（本仓 gitignore） */
const KNOWN_MCP_PATHS = [
  '.mcp.json',
  '.cursor/mcp.json',
  '.codebuddy/mcp.json',
  '.workbuddy/mcp.json',
  '.qoder/mcp.json',
];

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/** 渲染单个 target 的完整文件文本（含末尾换行；比对与生成共用，保证格式唯一） */
export function renderTarget(source, target) {
  const render = DIALECTS[target.dialect];
  if (typeof render !== 'function') {
    throw new Error(
      `未实现的方言 \`${target?.dialect}\`（已实现：${Object.keys(DIALECTS).join(' / ')}）`,
    );
  }
  const mcpServers = {};
  for (const [name, s] of Object.entries(source.servers ?? {})) {
    mcpServers[name] = render(s);
  }
  return `${JSON.stringify({ mcpServers }, null, 2)}\n`;
}

/**
 * 在 rootDir 下执行全部校验（selftest 用临时 fixture 复用同一逻辑）。
 * @returns {{ ok: boolean, errors: string[], warnings: string[], info: string[] }}
 */
export function checkAt(rootDir) {
  const errors = [];
  const warnings = [];
  const info = [];

  // --- C1 正本 ---
  const sourcePath = join(rootDir, SOURCE_REL);
  if (!existsSync(sourcePath)) {
    errors.push(`C1 ${SOURCE_REL} 缺失（MCP 配置的单一正本）`);
    return { ok: false, errors, warnings, info };
  }
  let source;
  try {
    source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  } catch (e) {
    errors.push(`C1 ${SOURCE_REL} JSON 非法 → ${e.message}`);
    return { ok: false, errors, warnings, info };
  }

  // --- C2 targets ---
  const targets = Array.isArray(source.targets) ? source.targets : [];
  if (targets.length === 0) errors.push('C2 targets 为空（无产物可生成）');
  const registered = new Set();
  for (const t of targets) {
    if (!t || typeof t.path !== 'string' || !t.path) {
      errors.push('C2 target 缺少 path');
      continue;
    }
    if (registered.has(t.path)) errors.push(`C2 target 重复登记：${t.path}`);
    registered.add(t.path);
    if (!Object.hasOwn(DIALECTS, t.dialect)) {
      errors.push(
        `C2 ${t.path}: 未知方言 \`${t.dialect}\`（已实现：${Object.keys(DIALECTS).join(' / ')}）`,
      );
    }
  }

  // --- C3 servers 语义 + 回环红线 ---
  const servers = source.servers ?? {};
  if (Object.keys(servers).length === 0) errors.push('C3 servers 为空');
  for (const [name, s] of Object.entries(servers)) {
    if (s?.transport === 'stdio') {
      if (typeof s.command !== 'string' || !s.command) {
        errors.push(`C3 ${name}: stdio 缺少 command`);
      }
      if (!Array.isArray(s.args)) errors.push(`C3 ${name}: stdio 缺少 args 数组`);
      continue;
    }
    if (s?.transport === 'http') {
      if (typeof s.url !== 'string' || !s.url) {
        errors.push(`C3 ${name}: http 缺少 url`);
        continue;
      }
      let host = null;
      try {
        host = new URL(s.url).hostname.toLowerCase();
      } catch {
        errors.push(`C3 ${name}: url 非法 → ${s.url}`);
      }
      if (host && !LOOPBACK_HOSTS.has(host)) {
        errors.push(
          `C3 ${name}: url 主机 \`${host}\` 非回环 —— control-manifest §14 红线「HTTP 仅回环」`,
        );
      }
      continue;
    }
    errors.push(`C3 ${name}: transport \`${s?.transport}\` 无效（须 stdio / http）`);
  }

  // --- C4 产物漂移 ---
  if (errors.length === 0) {
    for (const t of targets) {
      const expected = renderTarget(source, t);
      let actual = null;
      try {
        actual = readFileSync(join(rootDir, t.path), 'utf8');
      } catch {
        actual = null;
      }
      if (actual === null) {
        errors.push(`C4 ${t.path} 缺失（应由正本生成）`);
      } else if (actual !== expected) {
        errors.push(`C4 ${t.path} 与正本不一致（漂移）→ 跑 \`pnpm run mcp:build\``);
      } else {
        info.push(`${t.path} (${t.dialect}) 与正本一致`);
      }
    }
  }

  // --- C5 漏登记 ---
  for (const rel of KNOWN_MCP_PATHS) {
    if (registered.has(rel)) continue;
    if (existsSync(join(rootDir, rel))) {
      errors.push(
        `C5 ${rel} 存在但未登记到 targets —— 漏登记即永不被生成/校验；先在 ${SOURCE_REL} 登记再 \`pnpm run mcp:build\``,
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings, info };
}

/** 默认模式：按正本重新渲染并落盘（内容相同则跳过） */
function writeAll(rootDir) {
  const source = JSON.parse(readFileSync(join(rootDir, SOURCE_REL), 'utf8'));
  const targets = source.targets ?? [];
  let wrote = 0;
  for (const t of targets) {
    const expected = renderTarget(source, t);
    const path = join(rootDir, t.path);
    let actual = null;
    try {
      actual = readFileSync(path, 'utf8');
    } catch {
      actual = null;
    }
    if (actual === expected) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected, 'utf8');
    process.stdout.write(`✍️  ${t.path} (${t.dialect})\n`);
    wrote += 1;
  }
  return wrote;
}

// --- selftest：临时 fixture 正反用例 ---
function selftest() {
  const cases = [];
  const base = {
    version: 1,
    targets: [
      { path: '.mcp.json', dialect: 'explicit' },
      { path: '.cursor/mcp.json', dialect: 'cursor' },
      { path: '.codebuddy/mcp.json', dialect: 'explicit' },
    ],
    servers: {
      'weixin-minigame-helper': {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@weadmin/weixin-minigame-helper-mcp@0.1.13'],
      },
      'cocos-creator': { transport: 'http', url: 'http://127.0.0.1:3000/mcp' },
    },
  };

  /** 建 fixture：写正本 + 按正本渲染全部产物（可覆写某份产物内容） */
  const makeRoot = (mutate = (s) => s, overrides = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-configs-'));
    mkdirSync(join(dir, 'my-mcp'), { recursive: true });
    const source = mutate(JSON.parse(JSON.stringify(base)));
    writeFileSync(join(dir, SOURCE_REL), `${JSON.stringify(source, null, 2)}\n`);
    // 渲染失败（如用例故意构造的未知方言）时写占位内容，把诊断权交给 checkAt 的 C2
    const safeRender = (s, t) => {
      try {
        return renderTarget(s, t);
      } catch {
        return '{}\n';
      }
    };
    for (const t of source.targets ?? []) {
      const p = join(dir, t.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, overrides[t.path] ?? safeRender(source, t));
    }
    for (const [rel, body] of Object.entries(overrides)) {
      if ((source.targets ?? []).some((t) => t.path === rel)) continue;
      const p = join(dir, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, body);
    }
    return dir;
  };
  const run = (name, dir, shouldPass) => {
    const r = checkAt(dir);
    cases.push({
      name,
      pass: r.ok === shouldPass,
      detail: r.errors.join('; ') || '(无错误)',
    });
    rmSync(dir, { recursive: true, force: true });
  };

  run('正例：三份产物与正本一致', makeRoot(), true);
  run(
    '反例：产物漂移应失败',
    makeRoot((s) => s, { '.cursor/mcp.json': '{ "mcpServers": {} }\n' }),
    false,
  );
  run(
    '反例：非回环 url 应失败（§14 红线）',
    makeRoot((s) => {
      s.servers['cocos-creator'].url = 'http://0.0.0.0:3000/mcp';
      return s;
    }),
    false,
  );
  run(
    '反例：未登记配置存在应失败（K-031 漏项）',
    makeRoot((s) => s, { '.qoder/mcp.json': '{ "mcpServers": {} }\n' }),
    false,
  );
  run(
    '反例：未知方言应失败',
    makeRoot((s) => {
      s.targets[2].dialect = 'vscode';
      return s;
    }),
    false,
  );
  run(
    '反例：stdio 缺 command 应失败',
    makeRoot((s) => {
      delete s.servers['weixin-minigame-helper'].command;
      return s;
    }),
    false,
  );

  const failed = cases.filter((c) => !c.pass);
  for (const c of cases) {
    process.stdout.write(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}${c.pass ? '' : ` → ${c.detail}`}\n`);
  }
  process.stdout.write(`selftest: ${cases.length - failed.length}/${cases.length} 通过\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// --- main ---
// 仅在被直接执行时运行；被 import 时只暴露 renderTarget / checkAt（否则单测 import 会意外写盘）
const INVOKED_DIRECTLY =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (!INVOKED_DIRECTLY) {
  // no-op：作为模块被导入
} else if (SELFTEST) {
  selftest();
} else if (CHECK_ONLY) {
  const result = checkAt(resolve(ROOT));
  if (AS_JSON) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.ok) {
    process.stdout.write(`check:mcp OK — ${result.info.length} 份产物与 ${SOURCE_REL} 一致\n`);
    for (const i of result.info) process.stdout.write(`  · ${i}\n`);
  } else {
    process.stderr.write(`check:mcp FAILED (${result.errors.length})\n`);
    for (const e of result.errors) process.stderr.write(`  - ${e}\n`);
    process.stderr.write('\n修复：改 my-mcp/servers.json 后跑 `pnpm run mcp:build`（勿手改产物）\n');
    process.exitCode = 1;
  }
} else {
  const wrote = writeAll(resolve(ROOT));
  process.stdout.write(
    wrote === 0 ? '✅ 已是最新，无需改动\n' : `✅ 已更新 ${wrote} 份产物（正本 → 各 IDE 方言）\n`,
  );
}
