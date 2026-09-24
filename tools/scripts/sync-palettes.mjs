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
 * 生成规则（逐字节固定）：HEADER（解码器+类型）+ RAW 表（slug → [b64(payload),source,note]）
 * + BRANDS 表（slug → {name,family,mm,dip,colors}，见下）。
 * payload = codes.join(',') + '|' + hexes（去 # 顺连）→ XOR(KEY) → base64。
 *
 * **「候选色系宏」= mm↔dip 单一真源（ADR-0021，WXG-T-206 续）**：
 *   真源 = 每份 `art/<slug>.json` 的顶层 `name / family / beadMm`（+ 可选 `pending`）；
 *   `dip(mm)` 纯函数（**本文件唯一实现**）由 mm 派生每颗标准像素；
 *   两份产物同一张表 —— ① 本文件的 `BRANDS`（游戏侧 `view/palette.ts` 只 re-export，
 *   **不参与 §3.3 渲染几何**），② `apps/beads-studio/public/brands.json`（studio 前端静态读，
 *   容器 `COPY public` 即得，服务端无需再算一遍）。**任何第三处硬编码 mm/dip 都是漂移**。
 *
 * 门禁：`--check` 比对**两份**产物重新生成结果（漂移报红）；verify 步骤表含 `palettes:check`。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** 仓根（已 normalize —— 用于日志里打相对路径，别用字符串拼 `../..` 去 replace，永不相等）。 */
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const rel = (p) => p.startsWith(REPO_ROOT + '/') ? p.slice(REPO_ROOT.length + 1) : p;
const ART_DIR = join(SCRIPT_DIR, '../../games/beads/art');
const OUT = join(SCRIPT_DIR, '../../games/beads/src/config/palettes-data.ts');
/** studio 前端可读的品牌表（与 `BRANDS` 同源同批生成；见 ADR-0021）。 */
const OUT_BRANDS_JSON = join(SCRIPT_DIR, '../../apps/beads-studio/public/brands.json');
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
 * 品牌色板注册表：游戏侧经 view/palette.ts re-export PALETTES / getBeadPalette 与
 * BRANDS / getBeadBrand 消费；beads-studio server 直读真源 JSON、前端读同批生成的 brands.json。
 * 关卡按 slug+色号引用本表渲染（v1.40）。
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

/**
 * 品牌物理元数据（「候选色系宏」派生表 · ADR-0021）：真源 = art/<slug>.json 的
 * name / family / beadMm；dip 由生成器唯一实现 dip(mm)=6.4 dip/mm 取偶算出，
 * 本文件只携带结果。**⚠ 不参与 §3.3 渲染几何**（BEAD_CELL/GAP/PITCH 各自冻结）：
 * mm/dip 是品牌物理口径，供 studio 由照片算珠数与成品尺寸、及未来选档使用。
 */
export interface BeadBrand {
  readonly slug: string;
  /** 显示名（不含 mm —— mm 只在数值字段住一次）。 */
  readonly name: string;
  /** 品牌家族（studio 下拉分组用）。 */
  readonly family: string;
  /** 豆子物理宽度 mm。 */
  readonly mm: number;
  /** 每颗标准像素（dip）= dip(mm)；源图/做图域，非渲染 cell。 */
  readonly dip: number;
  /** 收录色数（codes/palette 长度）。 */
  readonly colors: number;
  /** true = 目录在册但暂不开放功能（如 artkal-r，2026-09-21 用户裁定）。 */
  readonly pending?: boolean;
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

/**
 * mm → 每颗标准像素（dip）：**全仓唯一实现**（系数 6.4 dip/mm，结果取偶整数）。
 * 冻结阶梯（用户 2026-09-24 裁定）：2.6→16 / 2.88→18 / 3→20 / 5→32 / 10→64。
 * ⚠ 这是**源图 / 做图域**的品牌物理换算（照片算珠数、成品尺寸），不是游戏 §3.3 渲染
 *   常量（`BEAD_CELL=50 / GAP=2 / PITCH=52`）——两者无换算关系，不得互相推导（IMPACT-0020a K-A）。
 */
function dip(mm) {
    return 2 * Math.round((mm * 6.4) / 2);
}

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
    const brands = [];
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
        // 「候选色系宏」字段（ADR-0021）：**缺任一即 fail-closed** —— 新增品牌必须带 mm，
        //   否则会出现「studio 能选但物理口径不明」的第二套隐式真源（默认 5mm 那种）。
        if (typeof j.name !== 'string' || !j.name || typeof j.family !== 'string' || !j.family) {
            console.error(`sync-palettes: ${f} 缺顶层 name / family（候选色系宏必填）`);
            process.exit(1);
        }
        if (typeof j.beadMm !== 'number' || !Number.isFinite(j.beadMm) || j.beadMm <= 0) {
            console.error(`sync-palettes: ${f} 缺合法 beadMm（品牌豆径 mm，正数；唯一真源，不得只在 _note 里写）`);
            process.exit(1);
        }
        raw[slug] = [packEntry(j), j._source ?? '', j._note ?? ''];
        brands.push({
            slug,
            name: j.name,
            family: j.family,
            mm: j.beadMm,
            dip: dip(j.beadMm),
            colors: j.codes.length,
            ...(j.pending ? { pending: true } : {}),
        });
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
    const brandLines = brands
        .map((b) => `  ${JSON.stringify(b.slug)}: ${JSON.stringify(b)},`)
        .join('\n');
    const body = `const RAW: { readonly [slug: string]: readonly [string, string, string] } = {\n${rawLines}\n};\n\nexport const PALETTES: { readonly [slug: string]: BeadsPaletteEntry } = (() => {\n  const out: { [slug: string]: BeadsPaletteEntry } = {};\n  for (const slug in RAW) {\n    const r = RAW[slug]!;\n    const d = decodeEntry(r[0]);\n    out[slug] = { codes: d.codes, palette: d.palette, source: r[1], note: r[2] };\n  }\n  return Object.freeze(out);\n})();\n\n/** slug → 品牌物理元数据（mm/dip；生成于 art/<slug>.json，dip 由生成器唯一实现派生）。 */\nexport const BRANDS: { readonly [slug: string]: BeadBrand } = Object.freeze({\n${brandLines}\n});\n\n/** 按 slug 取品牌元数据；未知 slug → null。**只查表不算 mm→dip**（真源在生成期）。 */\nexport function getBeadBrand(slug: string): BeadBrand | null {\n  return BRANDS[slug] ?? null;\n}\n`;
    const rendered = HEADER + body;
    const renderedJson =
        JSON.stringify(
            {
                _generated:
                    '⚠️ GENERATED FILE — DO NOT EDIT BY HAND. 真源 games/beads/art/<slug>.json（name/family/beadMm）+ '
                    + 'tools/scripts/sync-palettes.mjs 的 dip(mm)。重生成: pnpm run palettes:sync ｜ 漂移门: pnpm run palettes:check ｜ 决策: ADR-0021',
                brands,
            },
            null,
            1,
        )
        + '\n';
    if (process.argv.includes('--check')) {
        for (const [file, text] of [[OUT, rendered], [OUT_BRANDS_JSON, renderedJson]]) {
            const current = readFileSync(file, 'utf8');
            if (current !== text) {
                console.error(`palettes:check FAIL：${rel(file)} 与 art/*.json 真源不一致（跑 \`pnpm run palettes:sync\` 重新生成）`);
                process.exit(1);
            }
        }
        console.log(`palettes:check PASS（${count} 个品牌色板 / ${colorCount} 色；色板与品牌 mm↔dip 表均与真源一致）`);
        return;
    }
    writeFileSync(OUT, rendered);
    writeFileSync(OUT_BRANDS_JSON, renderedJson);
    console.log(`sync-palettes: 生成 ${rel(OUT)} + ${rel(OUT_BRANDS_JSON)}（${count} 品牌色板 / ${colorCount} 色，紧缩+混淆；BRANDS ${brands.length} 条含 mm/dip）`);
}

main();
