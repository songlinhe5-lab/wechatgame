#!/usr/bin/env node
/**
 * check-assets.mjs — `[WXG-T-1013]` 入包位图资产机械门（不依赖构建产物）。
 *
 * 补的缺口：`textures/` 与 `themes/` 都是整目录 Bundle ⇒ 文件放进目录就入包，
 * 而既有 `check:cocos-mask` 只做「登记件 → 产物」正向核查、`check:size` 只卡总量，
 * 两者都不回答「这个文件该不该在包里」。历史上删零消费件全靠人工逐键扫描
 * （WXG-T-578 / 581 / 587），本门把那条扫描固化。
 *
 * 硬判据（任一命中 ⇒ FAIL）：
 *   ① 孤儿：`cocos/assets/{textures,themes}/**` 里的图片，没有对应的运行时装载路径。
 *   ② 断链：登记了装载路径，但源目录里没有该文件。
 *   ③ 死登记：`BITMAP_ASSETS` 里 `[XXX.key]` 字面条的 key，在源码/测试/镜像里零消费
 *      ⇒ 说明 blit 腿已删但登记忘了删，warmup 仍会白预装载。
 *
 * 报告项（不 FAIL）：`.meta` 的 trim 元数据、透明边占比、超大图、总体积。
 * ⚠ 透明边**不判 FAIL**：九宫格中空框 / 珠圈 / 招牌底留白都是设计语义（K-118 只证像素属性）。
 *
 * 判例：K-051（包体增量须差分复算）/ K-108（动态装载资产须产物级门禁）/
 *       K-118（门是什么类型的门）/ K-120（删资产正本+拷贝件+.meta 三处成对）/
 *       K-156（产物读数须核新鲜度）。
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const GAMES_DIR = join(ROOT, 'games');

function walk(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

/** 去注释后的源码语料；注释里提到键名不算消费。 */
function stripComments(s) {
    return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function corpusOf(gameDir) {
    const dirs = [
        join(gameDir, 'src'),
        join(gameDir, 'tests'),
        join(gameDir, 'cocos/assets/scripts/game'),
        join(gameDir, 'cocos/assets/scripts/host'),
    ];
    return dirs.flatMap((d) => walk(d)).filter((p) => p.endsWith('.ts'))
        .map((p) => stripComments(readFileSync(p, 'utf8'))).join('\n');
}

/** 纯函数，便于自检：`have` 与 `refs` 的双向差集。 */
function diff(have, refs) {
    return {
        orphan: [...have].filter((k) => !refs.has(k)).sort(),
        broken: [...refs].filter((k) => !have.has(k)).sort(),
    };
}

function selfTest() {
    const a = diff(new Set(['x', 'y']), new Set(['x']));
    assert.deepEqual(a.orphan, ['y'], '孤儿差集应报未登记的 y');
    const b = diff(new Set(['x']), new Set(['x', 'z']));
    assert.deepEqual(b.broken, ['z'], '断链差集应报缺文件的 z');
    assert.deepEqual(diff(new Set(['x']), new Set(['x'])), { orphan: [], broken: [] }, '双向一致应为空');
    assert.equal(stripComments('// key\na /* key */ b'), '\na  b', '注释应被剥离');
    console.log('  自检：孤儿 / 断链 / 注释剥离 3 组断言 PASS');
}

function audit(game) {
    const gameDir = join(GAMES_DIR, game);
    const bundles = ['textures', 'themes'].map((b) => join(gameDir, 'cocos/assets', b));
    if (!bundles.some(existsSync)) return null;

    const have = new Set();
    let bytes = 0;
    const trim = [];
    const big = [];
    for (const root of bundles) {
        if (!existsSync(root)) continue;
        for (const p of walk(root)) {
            if (p.endsWith('.meta') || !IMG_EXT.has(extname(p).toLowerCase())) continue;
            have.add(relative(root, p).slice(0, -extname(p).length).split(sep).join('/'));
            bytes += statSync(p).size;
            const mp = p + '.meta';
            if (!existsSync(mp)) continue;
            const meta = JSON.parse(readFileSync(mp, 'utf8'));
            const ud = Object.values(meta.subMetas ?? {}).find((s) => s?.name === 'spriteFrame')?.userData;
            if (!ud?.rawWidth) continue;
            const w = ud.width ?? ud.rawWidth;
            const h = ud.height ?? ud.rawHeight;
            const rw = ud.rawWidth;
            const rh = ud.rawHeight;
            if (w !== rw || h !== rh) {
                trim.push({ name: relative(root, p).split(sep).join('/'), ratio: 1 - (w * h) / (rw * rh), size: `${rw}×${rh}` });
            }
            if (rw > 1024 || rh > 1024) big.push(`${relative(root, p).split(sep).join('/')} ${rw}×${rh}`);
        }
    }

    const carrier = join(gameDir, 'cocos/assets/scripts/host/beads-blit-carrier.ts');
    const carrierTxt = existsSync(carrier) ? readFileSync(carrier, 'utf8') : '';
    const refs = new Set([...carrierTxt.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]));
    const arcs = join(gameDir, 'src/config/arcs.ts');
    if (existsSync(arcs)) {
        for (const m of readFileSync(arcs, 'utf8').matchAll(/art:\s*["']([^"']+)["']/g)) refs.add(m[1]);
    }
    const { orphan, broken } = diff(have, refs);

    // 死登记：只查 `[XXX.key]: { path: '...' }` 字面条；OPEN_ARCS 展开条无 key，交给差集腿。
    const corpus = corpusOf(gameDir);
    const dead = [];
    for (const m of carrierTxt.matchAll(/\[([A-Z_]+)\.(\w+)\]:\s*\{\s*path:\s*'([^']+)'/g)) {
        if (!new RegExp(`\\b${m[2]}\\b`).test(corpus)) dead.push(`${m[1]}.${m[2]} → ${m[3]}`);
    }

    return { game, have, refs, orphan, broken, dead, bytes, trim, big, carrier: existsSync(carrier) };
}

const main = () => {
    selfTest();
    const games = existsSync(GAMES_DIR) ? readdirSync(GAMES_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory()).map((e) => e.name) : [];
    const results = games.map(audit).filter(Boolean);
    if (results.length === 0) {
        console.log('未发现 games/*/cocos/assets/{textures,themes} ⇒ 无入包位图可查');
        console.log('STATUS: OK');
        return;
    }

    const problems = [];
    for (const r of results) {
        console.log(`\n[${r.game}] 投放件 ${r.have.size} 件 / ${(r.bytes / 1024).toFixed(1)} KB ｜ 装载路径 ${r.refs.size} 条`);
        if (!r.carrier) problems.push(`${r.game}: 找不到 beads-blit-carrier.ts ⇒ 判据失真`);
        for (const k of r.orphan) problems.push(`${r.game}: 孤儿 ${k}（在 Bundle 里但无装载路径）`);
        for (const k of r.broken) problems.push(`${r.game}: 断链 ${k}（登记了但源件缺失）`);
        for (const k of r.dead) problems.push(`${r.game}: 死登记 ${k}（零消费却仍预装载）`);
        const top = r.trim.sort((a, b) => b.ratio - a.ratio).slice(0, 5);
        console.log(`  trim 元数据 ${r.trim.length} 件；透明边 TOP5：${top.map((t) => `${t.name} ${(t.ratio * 100).toFixed(0)}%`).join('、') || '无'}`);
        console.log(`  超大图(>1024) ${r.big.length} 件${r.big.length ? '：' + r.big.slice(0, 3).join('、') : ''}`);
        console.log(`  差集：孤儿 ${r.orphan.length} ｜ 断链 ${r.broken.length} ｜ 死登记 ${r.dead.length}`);
    }

    console.log('');
    if (problems.length) {
        for (const p of problems) console.log(`  ❌ ${p}`);
        console.log(`\n❌ 入包资产门：${problems.length} 项不合格`);
        console.log('STATUS: FAIL');
        process.exitCode = 1;
    } else {
        console.log('✅ 入包资产门：无孤儿 / 无断链 / 无死登记');
        console.log('STATUS: OK');
    }
};

main();
