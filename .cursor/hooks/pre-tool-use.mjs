#!/usr/bin/env node
/**
 * Cursor preToolUse：拦截对 .scene / .prefab / .meta 的写入（L1）。
 * Matcher: Write|Delete|StrReplace
 */

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(chunks.join('')));
  });
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj));
}

const raw = await readStdin();
let input = {};
try {
  input = JSON.parse(raw || '{}');
} catch {
  out({
    permission: 'deny',
    user_message: 'Hooks: 无法解析 tool 输入',
    agent_message: 'preToolUse hook invalid JSON; denying.',
  });
  process.exit(0);
}

const toolInput = input.tool_input ?? input.arguments ?? input.input ?? {};
const candidates = [
  toolInput.path,
  toolInput.file_path,
  toolInput.filePath,
  toolInput.target_file,
  ...(Array.isArray(toolInput.paths) ? toolInput.paths : []),
].filter(Boolean).map(String);

const banned = candidates.filter((p) => /\.(scene|prefab|meta)$/i.test(p));
if (banned.length > 0) {
  out({
    permission: 'deny',
    user_message: `L1：禁止手工编辑编辑器产物：${banned.join(', ')}`,
    agent_message:
      'Blocked by L1 (AGENTS.md / control-manifest): do not create or edit .scene / .prefab / .meta. Scenes must stay GameRoot + Bootstrap only.',
  });
  process.exit(0);
}

out({ permission: 'allow' });
process.exit(0);
