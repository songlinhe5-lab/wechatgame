#!/usr/bin/env node
/**
 * Figma REST 取数 / 导出（PAT 鉴权，五 IDE 共用；不依赖 MCP，不依赖 Dev/Full 座位）
 *
 * Usage:
 *   node figma.mjs me
 *   node figma.mjs tree <url|fileKey> [--depth 2] [--max 200]
 *   node figma.mjs node <url> [--out <file.json>]
 *   node figma.mjs img  <url> --out <dir> [--format png|svg|pdf] [--scale 2]
 *   node figma.mjs selftest
 *
 * 凭证：环境变量 FIGMA_API_KEY 优先，回落到仓库根 .env.local（不入库）
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const API = 'https://api.figma.com/v1';

function token() {
  if (process.env.FIGMA_API_KEY) return process.env.FIGMA_API_KEY.trim();
  const env = join(ROOT, '.env.local');
  if (existsSync(env)) {
    const m = readFileSync(env, 'utf8').match(/^\s*FIGMA_API_KEY\s*=(.+)$/m);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  throw new Error('缺少 FIGMA_API_KEY（环境变量或仓库根 .env.local）');
}

function parseTarget(s) {
  const str = String(s).trim();
  const m = str.match(/figma\.com\/(?:design|file|proto|board|slides)\/([A-Za-z0-9]+)/);
  const key = m ? m[1] : /^[A-Za-z0-9]{10,}$/.test(str) ? str : null;
  if (!key) throw new Error(`无法解析 Figma 文件 key：${str}`);
  let nodeId = null;
  try {
    const nid = new URL(str).searchParams.get('node-id');
    if (nid) nodeId = nid.replace('-', ':');
  } catch {
    /* 纯 key 输入无 URL */
  }
  return { key, nodeId };
}

async function api(path) {
  const r = await fetch(API + path, { headers: { 'X-Figma-Token': token() } });
  if (!r.ok) {
    const body = (await r.text()).slice(0, 300);
    throw new Error(`HTTP ${r.status} ← ${path}\n${body}`);
  }
  return r.json();
}

const pad = (lv) => '  '.repeat(lv);

function walk(n, depth, max, out, lv = 0) {
  if (out.length >= max) return;
  const box = n.absoluteBoundingBox;
  const geo = box ? ` [${Math.round(box.width)}x${Math.round(box.height)} @${Math.round(box.x)},${Math.round(box.y)}]` : '';
  out.push(`${pad(lv)}${n.id}  ${n.type}  ${n.name}${geo}`);
  if (lv < depth && n.children) for (const c of n.children) walk(c, depth, max, out, lv + 1);
}

/** 节点瘦身：只留做还原/切图要用的字段，避免整份 JSON 灌进上下文 */
function slim(n) {
  const keep = {
    id: n.id,
    name: n.name,
    type: n.type,
    absoluteBoundingBox: n.absoluteBoundingBox,
    fills: n.fills,
    strokes: n.strokes,
    cornerRadius: n.cornerRadius,
    layoutMode: n.layoutMode,
    itemSpacing: n.itemSpacing,
    paddingLeft: n.paddingLeft,
    paddingTop: n.paddingTop,
    characters: n.characters,
    style: n.style,
    // 2026-11-09 补：文字投影 / 内阴影 / 发光等效果都在 `effects`（此前漏留 ⇒ 阴影参数读不出）。
    effects: n.effects,
  };
  const out = {};
  for (const [k, v] of Object.entries(keep)) if (v !== undefined) out[k] = v;
  if (n.children) out.children = n.children.map(slim);
  return out;
}

function parseArgs(argv) {
  const pos = [];
  const flag = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) flag[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
    else pos.push(argv[i]);
  }
  return { pos, flag };
}

function selftest() {
  const a = parseTarget('https://www.figma.com/design/AbC123xyz/Game?node-id=12-34&t=zz');
  if (a.key !== 'AbC123xyz' || a.nodeId !== '12:34') throw new Error(`URL 解析失败: ${JSON.stringify(a)}`);
  const b = parseTarget('XyZ9876543210');
  if (b.key !== 'XyZ9876543210' || b.nodeId !== null) throw new Error('裸 key 解析失败');
  let threw = false;
  try {
    parseTarget('not-a-figma-link');
  } catch {
    threw = true;
  }
  if (!threw) throw new Error('非法输入未报错');
  console.log('selftest ok: URL / 裸 key / 非法输入 三例通过');
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const { flag } = parseArgs(process.argv.slice(3));

  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    return;
  }
  if (cmd === 'selftest') return selftest();
  if (cmd === 'me') {
    const u = await api('/me');
    console.log(JSON.stringify({ id: u.id, handle: u.handle, email: u.email }, null, 2));
    return;
  }

  const { key, nodeId } = parseTarget(arg ?? flag.url ?? '');
  if (cmd === 'tree') {
    const depth = Number(flag.depth ?? 2);
    const max = Number(flag.max ?? 200);
    const f = await api(`/files/${key}?depth=${depth}`);
    const out = [];
    walk(f.document, depth, max, out);
    console.log(`${f.name}  (${key})`);
    console.log(out.join('\n'));
    if (out.length >= max) console.log(`… 已截断到 ${max} 行，用 node 命令取子树`);
    return;
  }
  if (cmd === 'node') {
    if (!nodeId) throw new Error('需要带 node-id 的链接');
    const res = await api(`/files/${key}/nodes?ids=${encodeURIComponent(nodeId)}`);
    const n = res.nodes[nodeId];
    if (!n) throw new Error(`节点不存在：${nodeId}`);
    const json = JSON.stringify(slim(n.document), null, 2);
    if (flag.out) {
      mkdirSync(dirname(resolve(flag.out)), { recursive: true });
      writeFileSync(resolve(flag.out), json);
      console.log(`已写入 ${resolve(flag.out)}  (${json.length} 字节)`);
    } else console.log(json);
    return;
  }
  if (cmd === 'img') {
    const ids = flag.ids ? String(flag.ids).split(',').map((s) => s.trim().replace('-', ':')) : [nodeId];
    if (!ids[0]) throw new Error('需要 --ids 或带 node-id 的链接');
    const format = flag.format ?? 'png';
    const scale = flag.scale ?? (format === 'png' ? 2 : 1);
    const outDir = resolve(flag.out ?? join(ROOT, 'temp/figma'));
    mkdirSync(outDir, { recursive: true });
    const res = await api(`/images/${key}?ids=${encodeURIComponent(ids.join(','))}&format=${format}&scale=${scale}`);
    if (res.err) throw new Error(`Figma 导出报错：${res.err}`);
    for (const id of ids) {
      const url = res.images[id];
      if (!url) {
        console.error(`跳过 ${id}：未返回图片（节点过大或类型不支持）`);
        continue;
      }
      const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
      const file = join(outDir, `${id.replace(':', '-')}.${format}`);
      writeFileSync(file, bin);
      console.log(`${file}  ${(bin.length / 1024).toFixed(1)} KiB`);
    }
    return;
  }
  throw new Error(`未知子命令：${cmd}`);
}

main().catch((e) => {
  console.error(String(e.message ?? e));
  process.exit(1);
});
