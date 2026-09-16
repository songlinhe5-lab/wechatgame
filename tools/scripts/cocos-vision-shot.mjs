#!/usr/bin/env node
/**
 * cocos-vision-shot.mjs — WXG-T-099 / B1：无头截图 + 色盲/灰度滤镜矩阵取证。
 *
 * 目的：解锁 §G 10 条像素半边、TC-PER-13/14 整条、P15 真实栅格化的取证面 ——
 * 对 **Cocos web-mobile 产物**（真实引擎栅格化，非 RenderModel SVG）截图，
 * 并输出 protanopia / deuteranopia / tritanopia / 灰度 四种视觉滤镜矩阵，
 * 供 QA 判定「非颜色通道可辨」（accessibility A2/A3）与色盲可辨性。
 *
 * 道次诚实：本脚本产出的是 **[Cocos] 产物像素**取证物；`[R]` 真机（微信宿主）
 * 仍需 AppID + 真机，本脚本不伪验。
 *
 * USAGE
 *   node tools/scripts/cocos-vision-shot.mjs --game=beads|breakout [--wait 5000] [--out <dir>]
 *   node tools/scripts/cocos-vision-shot.mjs --help
 *
 * 退出码：0 = 全部截图成功；2 = 产物缺失/参数错误；3 = playwright 不可用/页面错误。
 * 滤镜实现：SVG feColorMatrix（sRGB 常用线性化近似矩阵）经 CSS filter 应用后截图，
 * 零新增 npm 依赖。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
function argValue(flag, fallback) {
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

if (hasFlag('--help') || argv.length === 0) {
  console.log(
    'cocos-vision-shot.mjs — Cocos 产物无头截图 + 色盲/灰度滤镜矩阵（WXG-T-099 / B1）\n\n' +
      'USAGE\n' +
      '  node tools/scripts/cocos-vision-shot.mjs --game=beads|breakout [--wait 5000] [--out <dir>]\n\n' +
      'OPTIONS\n' +
      '  --game <name>   REQUIRED. beads | breakout（产物路径 games/<game>/cocos/build/web-mobile）\n' +
      '  --wait <ms>     引擎启动后的额外等待（默认 5000）\n' +
      '  --out <dir>     输出目录（默认 production/qa/<game>/evidence/vision）\n' +
      '  --help          本帮助\n\n' +
      '退出码：0 成功；2 产物缺失/参数错误；3 playwright 不可用/页面错误。\n',
  );
  process.exit(0);
}

const GAME = argValue('--game', '');
if (GAME !== 'beads' && GAME !== 'breakout') {
  console.error(`❌ --game 必须为 beads 或 breakout（got "${GAME || '(none)'}"）`);
  process.exit(2);
}
const WAIT = Number(argValue('--wait', 5000));
const OUT_DIR = resolve(ROOT, argValue('--out', `production/qa/${GAME}/evidence/vision`));
const PRODUCT = join(ROOT, 'games', GAME, 'cocos', 'build', 'web-mobile');
const INDEX = join(PRODUCT, 'index.html');

if (!existsSync(INDEX)) {
  console.error(
    `❌ 产物缺失：${INDEX}\n` +
      `   先构建：pnpm --filter @wxgame/${GAME} run build:cocos:web`,
  );
  process.exit(2);
}

// 标准 sRGB 线性化近似矩阵（Protanopia/Deuteranopia/Tritanopia 常用值 + WCAG 亮度灰度）。
const FILTERS = [
  {
    name: 'protanopia',
    matrix: '0.567 0.433 0 0  0.558 0.442 0 0  0 0.242 0.758 0',
  },
  {
    name: 'deuteranopia',
    matrix: '0.625 0.375 0 0  0.7 0.3 0 0  0 0.3 0.7 0',
  },
  {
    name: 'tritanopia',
    matrix: '0.95 0.05 0 0  0 0.433 0.567 0  0 0.475 0.525 0',
  },
  {
    name: 'grayscale',
    matrix: '0.2126 0.7152 0.0722 0  0.2126 0.7152 0.0722 0  0.2126 0.7152 0.0722 0',
  },
];

async function main() {
  const { createRequire } = await import('node:module');
  const candidates = [
    join(process.env.HOME ?? '', '.workbuddy', 'binaries', 'node', 'workspace'),
    join(process.env.HOME ?? '', '.codebuddy', 'binaries', 'node', 'workspace'),
    process.cwd(),
  ];
  let playwright = null;
  const errs = [];
  for (const c of candidates) {
    try {
      const req = createRequire(join(c, 'package.json'));
      playwright = req('playwright');
      break;
    } catch (e) {
      errs.push(`${c}: ${e.message.slice(0, 80)}`);
    }
  }
  if (!playwright) {
    try {
      playwright = (await import('playwright')).default ?? (await import('playwright'));
    } catch (e) {
      errs.push(`bare: ${e.message.slice(0, 80)}`);
    }
  }
  if (!playwright) {
    console.error(`❌ playwright 不可解析：\n  ${errs.join('\n  ')}`);
    process.exit(3);
  }

  // 静态服务：file:// 会拦 Cocos 的模块/资源加载，起本地 http 最稳。
  const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm', '.pvr': 'application/octet-stream',
    '.bin': 'application/octet-stream', '.ttf': 'font/ttf', '.plist': 'application/xml',
  };
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(PRODUCT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(PRODUCT)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file) || extname(file) === '') file = join(PRODUCT, 'index.html');
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html`;

  const { chromium } = playwright;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 750, height: 1334 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 120)));

    console.log(`🎬 opening ${url} (wait ${WAIT}ms for engine boot)`);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 20000 });
    await page.waitForTimeout(WAIT);
    // 关闭 Cocos debug stats 浮层（默认开启，会遮挡取证画面）
    await page.evaluate(() => {
      try {
        const d = window.cc && window.cc.debug;
        if (d) { d.setDisplayStats ? d.setDisplayStats(false) : (d.isDisplayStats = false); }
      } catch {}
      document.querySelectorAll('#stats, .stats').forEach((n) => n.remove());
    });
    await page.waitForTimeout(300);

    mkdirSync(OUT_DIR, { recursive: true });
    const written = [];

    // 原图（无滤镜）
    const raw = join(OUT_DIR, 'raw.png');
    await page.screenshot({ path: raw });
    written.push(raw);

    for (const f of FILTERS) {
      const id = `wxg-vision-${f.name}`;
      await page.evaluate(({ id, matrix }) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
        svg.style.position = 'absolute';
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', id);
        const m = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
        m.setAttribute('type', 'matrix');
        m.setAttribute('values', matrix);
        filter.appendChild(m); svg.appendChild(filter);
        document.body.appendChild(svg);
        const style = document.createElement('style');
        style.textContent = `html { filter: url(#${id}); }`;
        style.dataset.visionFilter = id;
        document.head.appendChild(style);
      }, { id, matrix: f.matrix });
      const out = join(OUT_DIR, `${f.name}.png`);
      await page.screenshot({ path: out });
      written.push(out);
      // 移除本滤镜，避免叠加到下一个
      await page.evaluate((id) => {
        document.querySelector(`style[data-vision-filter="${id}"]`)?.remove();
      }, id);
    }

    console.log('');
    for (const w of written) console.log(`  📸 ${w}`);
    if (pageErrors.length) {
      console.error(`\n⚠️ page errors (${pageErrors.length}):`, pageErrors.slice(0, 3));
      process.exit(3);
    }
    console.log(`\n🎉 wrote ${written.length} shots (raw + ${FILTERS.length} vision filters) to ${OUT_DIR}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(`❌ ${e?.message ?? e}`);
  process.exit(3);
});
