#!/usr/bin/env node
/**
 * sync-palettes.mjs — 从 `games/beads/art/*.json` 品牌色板资产生成
 * `games/beads/src/config/palettes-data.ts`（游戏侧可读的色板注册表）。
 *
 * WHY（v1.39→v1.40，用户拍板）：
 *   · 色板真源 = games/beads/art/<slug>.json（studio server / beads-gen 直读；
 *     游戏运行时 Cocos/浏览器无法 import assets 外 JSON ⇒ 编译期打包成 TS 生成物，
 *     经 framework:sync 镜像进 cocos/assets 树 —— JSON 与生成物一致性由 --check 门禁强制）。
 *   · v1.40：珠色渲染改「关卡品牌引用制」（level.palette + paletteCodes），
 *     game-10.json 删除 —— demo 十色降级为 levels-01-08.json 顶层 palette 数据。
 *   · v1.40（用户要求）：生成物**紧缩编码 + XOR 混淆**压包体（190KB → ~30KB 级）。
 *     ⚠️ ponytail/诚实边界：客户端代码不存在真加密 —— 解码器随包发布、密钥在包内，
 *     这只是提高提取门槛的混淆（防直接 grep 明文），防不了决心逆向的人；
 *     色板 hex 本身是社区公开数据，无真实秘密。
 *
 * 生成规则（逐字节固定）：HEADER（解码器+类型）+ RAW 表（slug → [b64(payload), source, note]）。
 * payload = codes.join(',') + '|' + hexes（去 # 顺连）→ XOR(KEY) → base64。
 *
 * 门禁：`--check` 比对产物重新生成结果（漂移报红）；verify 步骤表含 `palettes:check`。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ART_DIR = join(SCRIPT_DIR, '../../games/beads/art');
const OUT = join(SCRIPT_DIR, '../../games/beads/src/config/palettes-data.ts');
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const EXCLUDED = new Set(['artkal-palette']); // spike 期老副本（与 artkal-s 重复），不入注册表
const KEY = 'beads-art-v1';

const HEADER = `/**
 * ⚠️ GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: games/beads/art/<slug>.json（品牌色板真源）
 * Regenerate:      node tools/scripts/sync-palettes.mjs
 * Drift guard:     pnpm run palettes:check（pnpm run verify 内）
 *
 * 品牌色板注册表：游戏侧经 view/palette.ts re-export PALETTES / getBeadPalette 消费；
 * beads-studio server 直读真源 JSON。关卡按 slug+色号引用本表渲染（v1.40）。
 * 存储形态：每品牌一条 payload = codes '|'-连接 hex（去 #）→ XOR 密钥流 → base64，
 * 模块加载期自解码。⚠️ 这是**混淆**不是加密（客户端无真加密，密钥随包发布），
 * 仅防明文提取；色板数据本身是公开色号/色值。
 */

export interface BeadsPaletteEntry {
  /** 品牌色号字符串（与 palette 同序；如 "S01"）。 */
  readonly codes: readonly string[];
  /** hex 列表（与 codes 同序，#RRGGBB）。 */
  readonly palette: readonly string[];
  /** 数据来源说明（社区校准库 / 官方页等）。 */
  readonly source: string;
  /** 收录状态备注（如与官方色数差异）。 */
  readonly note: string;
}

const KEY = '${KEY}';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 → 二进制串；再 XOR 密钥流 → payload；拆出 codes 与 hex 列表。 */
function decodeEntry(raw: string): { codes: string[]; palette: string[] } {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < raw.length; i++) {
    const v = B64.indexOf(raw.charAt(i));
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  let payload = '';
  for (let i = 0; i < bytes.length; i++) {
    payload += String.fromCharCode(bytes[i]! ^ KEY.charCodeAt(i % KEY.length));
  }
  const bar = payload.indexOf('|');
  const codes = payload.slice(0, bar).split(',');
  const hexBlob = payload.slice(bar + 1);
  const palette: string[] = [];
  for (let i = 0; i < hexBlob.length; i += 6) {
    palette.push('#' + hexBlob.slice(i, i + 6));
  }
  return { codes, palette };
}
`;

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64encode(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : NaN;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : NaN;
        out += B64_CHARS[b0 >> 2];
        out += B64_CHARS[((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4)];
        out += isNaN(b1) ? '=' : B64_CHARS[((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6)];
        out += isNaN(b2) ? '=' : B64_CHARS[b2 & 63];
    }
    return out;
}

function packEntry(j) {
    const payload = j.codes.join(',') + '|' + j.palette.map((h) => h.slice(1)).join('');
    const bytes = [];
    for (let i = 0; i < payload.length; i++) {
        bytes.push(payload.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
    }
    return b64encode(bytes);
}

function main() {
    const files = readdirSync(ART_DIR).filter((f) => f.endsWith('.json')).sort();
    const raw = {};
    let count = 0;
    let colorCount = 0;
    for (const f of files) {
        const slug = f.replace(/\.json$/, '');
        if (EXCLUDED.has(slug)) continue;
        const j = JSON.parse(readFileSync(join(ART_DIR, f), 'utf8'));
        if (!Array.isArray(j.codes) || !Array.isArray(j.palette) || j.codes.length !== j.palette.length || j.palette.length < 2) {
            console.error(`sync-palettes: ${f} schema 非法（需 codes[] 与 palette[] 同长且 ≥2 色）`);
            process.exit(1);
        }
        for (const hex of j.palette) {
            if (!HEX_RE.test(hex)) {
                console.error(`sync-palettes: ${f} 含非法 hex：${hex}`);
                process.exit(1);
            }
        }
        raw[slug] = [packEntry(j), j._source ?? '', j._note ?? ''];
        count++;
        colorCount += j.palette.length;
    }
    if (!count) {
        console.error('sync-palettes: art/ 下无可用品牌色板 JSON');
        process.exit(1);
    }

    const rawLines = Object.keys(raw)
        .map((slug) => {
            const [b64, source, note] = raw[slug];
            return `  ${JSON.stringify(slug)}: [${JSON.stringify(b64)}, ${JSON.stringify(source)}, ${JSON.stringify(note)}],`;
        })
        .join('\n');
    const body = `const RAW: { readonly [slug: string]: readonly [string, string, string] } = {\n${rawLines}\n};\n\nexport const PALETTES: { readonly [slug: string]: BeadsPaletteEntry } = (() => {\n  const out: { [slug: string]: BeadsPaletteEntry } = {};\n  for (const slug in RAW) {\n    const r = RAW[slug]!;\n    const d = decodeEntry(r[0]);\n    out[slug] = { codes: d.codes, palette: d.palette, source: r[1], note: r[2] };\n  }\n  return Object.freeze(out);\n})();\n`;
    const rendered = HEADER + body;
    if (process.argv.includes('--check')) {
        const current = readFileSync(OUT, 'utf8');
        if (current !== rendered) {
            console.error('palettes:check FAIL：palettes-data.ts 与 art/*.json 真源不一致（跑 `pnpm run palettes:sync` 重新生成）');
            process.exit(1);
        }
        console.log(`palettes:check PASS（${count} 个品牌色板 / ${colorCount} 色，与真源一致）`);
        return;
    }
    writeFileSync(OUT, rendered);
    console.log(`sync-palettes: 生成 ${OUT.replace(SCRIPT_DIR + '/', '')}（${count} 品牌色板 / ${colorCount} 色，紧缩+混淆）`);
}

main();
