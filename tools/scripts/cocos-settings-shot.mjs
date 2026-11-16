#!/usr/bin/env node
/**
 * cocos-settings-shot.mjs — **Cocos 产物腿**：点主菜单顶栏设置钮 → 截设置弹窗（WXG-T-967）。
 *
 * 为什么存在：`XWGG-T-967` 的缺陷（容器内静态位图腿零像素）在 harness 上**看不见** ——
 * harness 是 Canvas2D 单画布，没有 `UI:<容器>` 通道分层，也没有 `clipHost` 回落路径。
 * 只有真实引擎栅格化的 Cocos 产物才能暴露它。本脚本把那条取证链固化下来，
 * 让「设置弹窗有没有厚木底板」这件事可以一条命令复查，而不是每次现搭。
 *
 * 道次诚实：产出 = **[Cocos web-mobile 产物] 像素**。⛔ 不是真机（微信宿主）证据；
 * web 平台没有 `wx.*` 能力，只验证渲染。真机仍需 AppID + 设备。
 *
 * 依赖：本机 Chrome（headless）+ 已构建的 web-mobile 产物 + 一个静态服务。
 * 零 npm 依赖（复用 `lib/cdp-client.mjs`，Node ≥22 原生 WebSocket）。
 *
 * USAGE（仓根）
 *   # ① 产物（debug 版即可；⚠ 它会重写 build/web-mobile，但不递增 package.json 版本号）
 *   node tools/scripts/build-cocos.mjs --game=beads --platform=web-mobile
 *   # ② 静态服务
 *   cd games/beads/cocos/build/web-mobile && python3 -m http.server 4175
 *   # ③ 截图
 *   node tools/scripts/cocos-settings-shot.mjs [--url <url>] [--out <dir>] [--tap 58,168] [--wait 9000]
 *
 * 设计坐标口径：设置钮热区 88² 同心、热区左缘 `MENU_TOPBAR_X`=14 ⇒ 中心 x=58；
 * web 平台无胶囊信息 ⇒ 顶栏走 `MENU_TOPBAR_TOP_FALLBACK = SAFE_TOP_H(120) + SAFE_EDGE_MARGIN(4)` = 124
 * ⇒ 中心 y = 124 + 44 = **168**。harness 若模拟安全区则更靠下（实测 ≈196），用 `--tap` 覆盖。
 *
 * 判读：**设置弹窗里应能看到 10 枚厚木 cell 底板**（金高光边 + 圆角）。若只有文字 ⇒
 * 容器内位图腿又被 `clipHost` 回落路径劫持了，查 `bindings.ts::_createClip` 是否还在、
 * `UiScopeTreeHooks.createClip` 是否仍注册（静态判据见 `pnpm run cocos:check`）。
 *
 * 退出码：0 成功；2 参数/产物错；3 Chrome/CDP/页面错。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep, waitFor, launchChrome } from './lib/cdp-client.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('用法见文件头注释。');
  process.exit(0);
}

const URL_TARGET = argValue('--url', 'http://127.0.0.1:4175/index.html');
const OUT_DIR = resolve(ROOT, argValue('--out', 'temp/cocos-shot'));
const CDP_PORT = Number(argValue('--port', '9360'));
const WAIT_MS = Number(argValue('--wait', '9000'));
const TAP = argValue('--tap', '58,168').split(',').map(Number);
const CHROME = argValue('--chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

if (!existsSync(CHROME)) {
  console.error(`❌ 找不到 Chrome：${CHROME}（--chrome= 可指路）`);
  process.exit(2);
}
if (TAP.length !== 2 || TAP.some((n) => !Number.isFinite(n))) {
  console.error('❌ --tap 需形如 58,168（设计坐标）');
  process.exit(2);
}
mkdirSync(OUT_DIR, { recursive: true });

let cdp;
try {
  ({ cdp } = await launchChrome({
    chromePath: CHROME,
    port: CDP_PORT,
    profileDir: join(OUT_DIR, '.chrome-profile'),
  }));
} catch (e) {
  console.error(`❌ Chrome/CDP 启动失败：${String(e?.message ?? e)}`);
  process.exit(3);
}

try {
  await cdp.send('Page.navigate', { url: URL_TARGET });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 750, height: 1334, deviceScaleFactor: 1, mobile: true,
  });
  const box = await waitFor(
    cdp,
    `(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return r.width > 100 && r.height > 100 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    })()`,
    40000,
    'canvas 就绪',
  );
  console.log(`canvas ${Math.round(box.w)}×${Math.round(box.h)} @ (${box.x},${box.y})`);
  // 引擎首帧 + 资源 + 主菜单入场；调小会拍到入场黑屏。
  await sleep(WAIT_MS);

  // SHOW_ALL（`fitWidth && fitHeight`）：内容居中缩放。
  const s = Math.min(box.w / 750, box.h / 1334);
  const ox = box.x + (box.w - 750 * s) / 2;
  const oy = box.y + (box.h - 1334 * s) / 2;
  const pt = { x: Math.round(ox + TAP[0] * s), y: Math.round(oy + TAP[1] * s) };
  console.log(`scale ${s.toFixed(4)} · 点击设计坐标 (${TAP[0]},${TAP[1]}) ⇒ 屏幕 (${pt.x},${pt.y})`);

  const before = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT_DIR, '00-menu.png'), Buffer.from(before.data, 'base64'));

  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent', {
      type, x: pt.x, y: pt.y, button: 'left', clickCount: 1,
      buttons: type === 'mousePressed' ? 1 : 0,
    });
    await sleep(80);
  }
  await sleep(1500);
  const after = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT_DIR, '01-settings.png'), Buffer.from(after.data, 'base64'));
  console.log(`✅ ${join(OUT_DIR, '00-menu.png')}`);
  console.log(`✅ ${join(OUT_DIR, '01-settings.png')}  ← 判读：应有 10 枚厚木 cell 底板`);
  process.exit(0);
} catch (e) {
  console.error(`❌ 页面/截图失败：${String(e?.message ?? e)}`);
  process.exit(3);
}
