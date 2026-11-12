#!/usr/bin/env node
/**
 * cocos-fail-shot.mjs — WXG-T-617：微信小游戏**浏览器预览**（weixin-minigame-helper
 * `run_game` 起的本地服务，或 web-mobile 静态服务 + Cocos 引擎真实栅格化）实帧取证。
 *
 * 道次 = **[Cocos 预览]**：比 harness Canvas2D 更接近真机（引擎渲染 + 包内位图），
 * ⛔ 仍非微信真机宿主。与 harness-bitmap-shot.mjs 共享 lib/cdp-client.mjs。
 *
 * 用法（仓根；先经 MCP run_game 起预览，默认 http://localhost:3847）：
 *   node tools/scripts/cocos-fail-shot.mjs --name menu --boot 8000
 *   node tools/scripts/cocos-fail-shot.mjs --name fail --tap 375,1140 --boot 8000 --wait 70000
 * --tap 可多次（按序点击）；--wait 为最后一次 tap 后的等待（倒计时归零需 ≥ 关卡时限）。
 * 守卫（WXG-T-617）：收集控制台，出现 `[BeadsBlitCarrier] 丢弃 blit` ⇒ exit 4
 * （九宫格死分支回归的机械判据，K-089 守卫要能红）。
 * 豁免「载体未就绪」：boot 瞬态竞态（菜单先画一帧、warmup 异步后自愈，菜单帧该钮在），
 * 非回归；其余丢弃原因一律红。
 * 诊断（WXG-T-617）：全量控制台落 `<name>-console.log`；截帧前 introspect 场景
 * （池位 B* / BlitLayer* 的 active/世界坐标/尺寸/spriteFrame）落 `<name>-scene.json`。
 * 退出码：0 成功；2 参数错；3 Chrome/CDP/页面错；4 carrier 丢弃告警。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep, launchChrome } from './lib/cdp-client.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const taps = argv
  .map((a, i) => (a === '--tap' ? argv[i + 1] : a.startsWith('--tap=') ? a.slice(6) : null))
  .filter(Boolean)
  .map((s) => s.split(',').map(Number));

const URL_TARGET = argValue('--url', 'http://localhost:3847');
const OUT_DIR = resolve(ROOT, argValue('--out', 'temp/ui-shot'));
const PORT = Number(argValue('--port', '9334'));
const NAME = argValue('--name', 'cocos');
const BOOT = Number(argValue('--boot', '8000'));
const WAIT = Number(argValue('--wait', '3000'));
const CHROME = argValue('--chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
if (!existsSync(CHROME)) {
  console.error(`❌ 找不到 Chrome：${CHROME}`);
  process.exit(2);
}
mkdirSync(OUT_DIR, { recursive: true });

// 每跑独立 profile：python http.server 只发 Last-Modified ⇒ Chrome 启发式缓存会跨跑供旧 bundle
// （WXG-T-617 实测：修了死分支复拍仍不画，栈行号与磁盘 bundle 对不上才确诊）。
const profileDir = join(OUT_DIR, `.chrome-profile-cocos-${process.pid}`);
let cdp, chrome, ws;
try {
  ({ cdp, chrome, ws } = await launchChrome({ chromePath: CHROME, port: PORT, profileDir }));
  const bails = [];
  const logs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled') {
      const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      logs.push(`[${m.params.type}] ${text}`);
      if (m.params.type === 'warning' && text.includes('丢弃 blit') && !text.includes('载体未就绪')) bails.push(text);
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push(`[exception] ${JSON.stringify(m.params.exceptionDetails).slice(0, 400)}`);
    }
  });
  // --mapdebug：注册表 miss 现场取证（WXG-T-617 诊断用；monkey-patch Map.get/set）。
  if (argv.includes('--mapdebug')) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        const g = Map.prototype.get, s = Map.prototype.set;
        Map.prototype.set = function(k, v) {
          if (typeof k === 'string' && k.includes('timeout_plaque')) console.log('MAPSET ' + k + ' size=' + this.size);
          return s.call(this, k, v);
        };
        Map.prototype.get = function(k) {
          const v = g.call(this, k);
          if (typeof k === 'string' && k.includes('timeout_plaque')) {
            console.log('MAPGET ' + k + ' size=' + this.size + ' hit=' + (v !== undefined));
          }
          return v;
        };
        const w = console.warn;
        console.warn = function(...a) {
          if (String(a[0]).includes('丢弃 blit')) w.call(console, ...a, 'STACK:' + new Error().stack);
          else w.call(console, ...a);
        };
      })()`,
    });
  }
  await cdp.send('Page.navigate', { url: URL_TARGET });
  await sleep(BOOT);
  const probe = await cdp.eval(
    `(() => ({ vis: document.visibilityState, canvas: !!document.querySelector('canvas'),
      w: document.querySelector('canvas') && document.querySelector('canvas').width }))()`,
  );
  console.log(`探针：vis=${probe.vis} canvas=${probe.canvas} backing=${probe.w}`);
  for (const [x, y] of taps) {
    await cdp.tap(x, y);
    console.log(`tap(${x},${y})`);
    await sleep(600);
  }
  await sleep(WAIT);
  // 场景 introspect：九宫格「修了仍不画」时区分「命令没到 / 池位没亮 / 画了但看不见」。
  const scene = await cdp.eval(
    `(() => {
      const cc = window.cc; if (!cc || !cc.director) return null;
      const out = [];
      cc.director.getScene().walk((n) => {
        if (!/^(B\\d+|Blit.*)$/.test(n.name)) return;
        const ut = n.getComponent(cc.UITransform); const sp = n.getComponent(cc.Sprite);
        const op = n.getComponent(cc.UIOpacity); const wp = n.worldPosition;
        out.push({ name: n.name, on: n.activeInHierarchy,
          pos: [Math.round(wp.x), Math.round(wp.y)],
          size: ut ? [Math.round(ut.contentSize.width), Math.round(ut.contentSize.height)] : null,
          scale: +n.scale.x.toFixed(3), op: op ? op.opacity : null,
          type: sp ? sp.type : null, trim: sp ? sp.trim : null,
          sf: sp && sp.spriteFrame ? (sp.spriteFrame.name || sp.spriteFrame.uuid || '?') : null,
          inset: sp && sp.spriteFrame ? [sp.spriteFrame.insetLeft, sp.spriteFrame.insetTop] : null,
          parent: n.parent ? n.parent.name : null });
      });
      return out;
    })()`,
  );
  writeFileSync(join(OUT_DIR, `cocos-617-${NAME}-scene.json`), JSON.stringify(scene, null, 1));
  console.log(`场景池位/层节点：${scene ? scene.length : 'cc 不可读'} 个 → scene.json`);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = join(OUT_DIR, `cocos-617-${NAME}.png`);
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  writeFileSync(join(OUT_DIR, `cocos-617-${NAME}-console.log`), logs.join('\n'));
  console.log(`📸 [Cocos 预览] → ${file}（控制台 ${logs.length} 条 → console.log）`);
  if (bails.length) {
    console.error(`❌ carrier 丢弃告警 ${bails.length} 条：${bails.join(' | ')}`);
    ws.close();
    chrome.kill();
    process.exit(4);
  }
  console.log('✅ 控制台零「丢弃 blit」告警');
  ws.close();
  chrome.kill();
  process.exit(0);
} catch (err) {
  console.error(`❌ ${err.message}`);
  try {
    chrome.kill();
  } catch {
    /* ignore */
  }
  process.exit(3);
}