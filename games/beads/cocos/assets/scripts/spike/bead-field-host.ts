/**
 * SPIKE v2（ADR-0022 判据 D4/D5/D7）：整盘一个图元 + 程序化片元。
 *
 * v1 否证：全 UI 共用一块 `cc.Graphics`，给它换材质 ⇒ 面板/按钮/背景一起被重绘成珠子。
 * v2 改走「**独立 Graphics 节点 + 只画一枚满幅 rect**」：几何 = 2 三角，整盘珠子在片元里算，
 *      UI 那块 Graphics 完全不碰。这是载体②的最小可证形态（不需要 Sprite/内置图集，
 *      零新载体 API 风险，顶点流仍是 Graphics 那一套）。
 *
 * ⚠ 试错件，**默认关**：只有 URL 带 `?spike=1`（或宿主置 `__WXG_SPIKE_SHADER = true`）生效。
 *   不进玩法状态、不改 RenderModel、不进 framework 镜像（sync 只覆盖 scripts/framework 与 scripts/game）。
 */

import {
  assetManager, Color, director, EffectAsset, Graphics, Material, Node, UITransform, Vec4,
} from 'cc';

const EFFECT_UUID = 'ca05f110-626e-48a5-ad6b-0e3f2ecaea86';
const SPIKE_NODE = 'BeadFieldSpike';
// 满幅演示块：660×660 居中 ⇒ 与 effect 里 `grid` 默认值 (−330,−330,66,20) 对齐
const SPAN = 660;
const CELL = 66;

type AnyObj = Record<string, any>;

function spikeWanted(): boolean {
  const g = globalThis as AnyObj;
  if (g.__WXG_SPIKE_SHADER === true) return true;
  const search: string = (g.location && g.location.search) || '';
  return /[?&]spike=1\b/.test(search);
}

function walk(nodes: AnyObj[], fn: (n: AnyObj) => boolean): AnyObj | null {
  for (const n of nodes) {
    if (fn(n)) return n;
    const hit = walk((n.children || []) as AnyObj[], fn);
    if (hit) return hit;
  }
  return null;
}

function findNode(name: string): AnyObj | null {
  const scene = director.getScene() as unknown as AnyObj;
  return walk((scene?._children || scene?.children || []) as AnyObj[], (n) => n.name === name);
}

/** 设备能力（D7 桌面档 —— ⚠ 不能替代真机读数，只做冒烟）。 */
function glCaps(): AnyObj {
  const g = globalThis as AnyObj;
  const canvas = (g.document && g.document.querySelector && g.document.querySelector('canvas')) || null;
  if (!canvas) return { gl: 'no-canvas' };
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return { gl: 'no-context' };
  const q = (p: number): number => {
    const v = gl.getParameter(p);
    return typeof v === 'number' ? v : -1;
  };
  const isGL2 = !!(g.WebGL2RenderingContext && gl instanceof g.WebGL2RenderingContext);
  return {
    version: isGL2 ? 'WebGL2' : 'WebGL1',
    maxFragmentUniformVectors: q(0x8DFD), // ⚠ 0x8DF4 是错的 enum，会报 INVALID_ENUM
    maxTextureImageUnits: q(0x8872),
    derivativesExt: isGL2 ? 'core' : (gl.getExtension && gl.getExtension('OES_standard_derivatives') ? 'OES ok' : 'MISSING'),
    renderer: (() => {
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)).slice(0, 48) : 'n/a';
    })(),
  };
}

function counters(): AnyObj {
  const dev = (director.root as unknown as AnyObj).device as AnyObj;
  return { drawCalls: dev.numDrawCalls, tris: dev.numTris };
}

function report(payload: AnyObj): void {
  console.log(`[SPIKE] ${JSON.stringify(payload)}`);
}

export function installBeadFieldSpike(): void {
  if (!spikeWanted()) return;
  (globalThis as AnyObj).__SPIKE_STATS = (): AnyObj => ({ ...counters(), ...glCaps() });
  let tries = 0;
  const boot = (): void => {
    const gameRoot = findNode('GameRoot');
    if (!gameRoot) {
      if (++tries < 60) setTimeout(boot, 100);
      else report({ step: 'findGameRoot', error: 'not found after 6s' });
      return;
    }
    const before = counters();
    assetManager.loadAny({ uuid: EFFECT_UUID }, {}, (err: Error | null, loaded: EffectAsset | null) => {
      if (err || !loaded) { report({ step: 'loadEffect', error: String(err || 'empty') }); return; }
      const mat = new Material();
      try {
        mat.initialize({ effectAsset: loaded });
      } catch (e) {
        report({ step: 'initialize', error: String(e) });
        return;
      }
      const passes = (mat as unknown as AnyObj).passes;
      if (!passes || !passes.length) { report({ step: 'initialize', error: 'no passes' }); return; }

      // uniform 通道实测：格原点 + 格距（v1 的错位就出在没传原点）
      let uniformOk = true;
      try {
        mat.setProperty('grid', new Vec4(-SPAN / 2, -SPAN / 2, CELL, CELL * 0.3));
        mat.setProperty('pal2', new Vec4(0.24, 0.48, 0.96, 1));
      } catch (e) {
        uniformOk = false;
        report({ step: 'setProperty', error: String(e) });
      }

      // 独立节点：只承载一枚满幅 rect，UI 那块 Graphics 不碰
      const node = new Node(SPIKE_NODE);
      gameRoot.addChild(node);
      node.addComponent(UITransform).setContentSize(SPAN, SPAN);
      const gfx = node.addComponent(Graphics);
      gfx.fillColor = new Color(255, 255, 255, 255);
      gfx.rect(-SPAN / 2, -SPAN / 2, SPAN, SPAN);
      gfx.fill();
      (gfx as unknown as AnyObj).customMaterial = mat;

      report({
        step: 'attached-v2',
        effect: (loaded as unknown as AnyObj).name,
        passes: passes.length,
        uniformOk,
        props: Object.keys(((passes[0] as AnyObj)._propertyHandleMap || {})).filter((k) => !k.startsWith('cc_')),
        before,
      });
      setTimeout(() => report({ step: 'steady-v2', counters: counters() }), 600);
    });
  };
  setTimeout(boot, 200);
}
