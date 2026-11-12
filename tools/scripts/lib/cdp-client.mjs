/**
 * cdp-client.mjs — 最小 Chrome DevTools Protocol 客户端（Node ≥22 原生 WebSocket，零依赖）。
 * WXG-T-615 从 harness-bitmap-shot.mjs 抽出共享；WXG-T-616 起 cocos-fail-shot.mjs 同用。
 * 安全口径：调用方传入的 expression 须为硬编码字面量（Runtime.evaluate 是 CDP 协议行为，非 Node eval）。
 */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve: ok, reject: bad } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) bad(new Error(JSON.stringify(msg.error)));
        else ok(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((ok, bad) => {
      this.pending.set(id, { resolve: ok, reject: bad });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          bad(new Error(`CDP 超时：${method}`));
        }
      }, 30000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(`页面异常：${JSON.stringify(r.exceptionDetails)}`);
    return r.result.value;
  }
  /** CDP 原生触摸（浏览器生成真 TouchEvent，比合成构造器稳）。 */
  async tap(x, y) {
    await this.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    await sleep(80);
    await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
}

export async function waitFor(cdp, expression, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    const v = await cdp.eval(expression);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`等待超时：${label}`);
    await sleep(300);
  }
}

/** 起 headless Chrome（独立 user-data-dir，⛔ 不碰用户主 profile），返回 { cdp, chrome, ws }。 */
export async function launchChrome({ chromePath, port, profileDir, width = 750, height = 1334 }) {
  const { spawn } = await import('node:child_process');
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${width},${height}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await sleep(300);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch {
      /* 尚未就绪 */
    }
  }
  if (!wsUrl) {
    chrome.kill();
    throw new Error('Chrome DevTools 端点未就绪');
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, bad) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => bad(new Error('WS 连接失败')), { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return { cdp, chrome, ws };
}