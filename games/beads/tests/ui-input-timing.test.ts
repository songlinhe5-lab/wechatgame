/**
 * WXG-T-295 ·「按钮抬起才提交」（正本 `input-control §2.1` v2.13 / `ux-spec §4` 控件矩阵「按下」列）
 *
 * 翻转前：区外控件一律**按下帧**提交（v2.5 的「未翻清单」）⇒ 按住后把手指拖出按钮、在按钮外
 * 抬起，动作照样已经发生。本版起：区外**按钮类控件**（HUD 齿轮 / 缩放「1:1」「适配」/ 道具卡 /
 * 扩展位 / 暂停・结算・通关・失败・冲刺结算五类面板钮 / 主菜单・选关・设置・签到页全部钮）=
 * **按下只登记，抬起点仍是同一颗钮才派发**。
 *
 * 每条「零响应」例子都必须配**同坐标同帧形的正向对照**（K-054：零响应断言的判据域选错就会永真），
 * 因此下面的用例一律先按正向路径打一遍，再打取消路径。
 *
 * ⛔ 未翻（本批刻意不动，逐条有守卫例）：托盘槽与棋盘格（落子/取回目标，非按钮）、缩放滑轨
 * （拖拽控件，按下即进拖拽态）、`tapDesign`/`tapMeta` 调试旁路（合成一次完整点击）。
 */
import { describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import { BeadsShell } from '../src/game/beads-shell.js';
import { metaLayout } from '../src/view/meta-view.js';
import { pausePanelLayout, type PanelRect } from '../src/systems/pause-panel.js';
import {
  GEAR_HIT_SIZE,
  HUD_BAND,
  TRAY_COLS,
  trayLayout,
  ZOOM_CONTROLS_VISIBLE,
  zoomControlLayout,
} from '../src/config/tuning.js';

const STEP = 1 / 60;

/** 一帧 = beginFrame → 投递本帧全部样本 → game.update → endFrame（与 App._fixedUpdate 同形）。 */
function frame(h: Harness, samples: Array<{ x: number; y: number; phase: 'down' | 'move' | 'up' }>): void {
  h.input.beginFrame();
  for (const s of samples) h.input.push({ id: 1, x: s.x, y: s.y, phase: s.phase, time: 0 });
  h.game.update(STEP);
  h.input.endFrame(STEP);
}

function screenOf(h: Harness, designX: number, designY: number): { x: number; y: number } {
  const s = { x: 0, y: 0 };
  h.services.viewport.designToScreen(s, designX, designY);
  return s;
}

/** 设计空间两点（一次按下 + 一次抬起/拖动）。 */
function poke(h: Harness, x: number, y: number, phase: 'down' | 'move' | 'up'): void {
  const s = screenOf(h, x, y);
  frame(h, [{ x: s.x, y: s.y, phase }]);
}

const centre = (r: PanelRect): { x: number; y: number } => ({
  x: (r.xMin + r.xMax) / 2,
  y: (r.yMin + r.yMax) / 2,
});

function gearPoint(): { x: number; y: number } {
  return { x: GEAR_HIT_SIZE / 2, y: (HUD_BAND.yMin + HUD_BAND.yMax) / 2 };
}

/** 进 PAUSED 并等面板淡入落定（面板钮 `interactive` 才生效）。 */
function pausedHarness(key: string): Harness {
  const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: key });
  h.advance(STEP);
  h.game.tapDesign(gearPoint().x, gearPoint().y); // 齿轮走调试旁路 = 合成完整点击，与被测门无关
  h.advance(1);
  expect(h.game.phase).toBe('paused');
  return h;
}

function panelButton(id: string): PanelRect {
  return pausePanelLayout('normal').buttons.find((b) => b.id === id)!.rect;
}

describe('区外按钮抬起才提交（WXG-T-295）', () => {
  it('面板主钮：down 帧不提交、up 帧才提交', () => {
    const h = pausedHarness('wxgame.beads.test.uit-resume');
    const p = centre(panelButton('resume'));
    poke(h, p.x, p.y, 'down');
    expect(h.game.phase).toBe('paused'); // 旧行为本帧已回 playing
    poke(h, p.x, p.y, 'up');
    expect(h.game.phase).toBe('playing');
  });

  it('面板钮：按住拖出热区后抬起 = 零响应（面板仍在、事件增量为 0）', () => {
    const h = pausedHarness('wxgame.beads.test.uit-cancel');
    const p = centre(panelButton('resume'));
    const before = h.emitted.length;
    poke(h, p.x, p.y, 'down');
    expect(h.game.phase).toBe('paused');
    poke(h, 5, 5, 'move'); // 拖到面板外（遮罩空白）
    poke(h, 5, 5, 'up');
    expect(h.game.phase).toBe('paused');
    expect(h.emitted.length).toBe(before);
    // 正向对照（同一条钮、同帧形）：原地抬起确实提交 ⇒ 上面的零响应不是脱靶造成的永真断言
    poke(h, p.x, p.y, 'down');
    poke(h, p.x, p.y, 'up');
    expect(h.game.phase).toBe('playing');
  });

  it('从 A 钮拖到 B 钮抬起 = A/B 都不生效（不跨钮触发）', () => {
    const h = pausedHarness('wxgame.beads.test.uit-cross');
    const a = centre(panelButton('cycle-bead-size'));
    const b = centre(panelButton('resume'));
    const size0 = h.game.beadSize;
    poke(h, a.x, a.y, 'down');
    poke(h, b.x, b.y, 'move');
    poke(h, b.x, b.y, 'up');
    expect(h.game.phase).toBe('paused'); // B（继续）未被触发
    expect(h.game.beadSize).toBe(size0); // A（循环珠径）未被触发
    // 正向对照：原地抬起 = A 生效一档
    poke(h, a.x, a.y, 'down');
    poke(h, a.x, a.y, 'up');
    expect(h.game.beadSize).not.toBe(size0);
  });

  it('齿轮：抬起才暂停；从 HUD 热区拖进盘面再抬起 = 不暂停', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.uit-gear' });
    const g = gearPoint();
    poke(h, g.x, g.y, 'down');
    expect(h.game.phase).toBe('playing');
    expect(h.count('game:paused')).toBe(0);
    poke(h, g.x, 5, 'move'); // 拖离齿轮热区（HUD 带外）
    poke(h, g.x, 5, 'up');
    expect(h.game.phase).toBe('playing');
    expect(h.count('game:paused')).toBe(0);
    // 正向对照
    poke(h, g.x, g.y, 'down');
    poke(h, g.x, g.y, 'up');
    expect(h.game.phase).toBe('paused');
    expect(h.count('game:paused')).toBe(1);
  });

  it('[WXG-T-462] 控件条隐藏：滑轨命中恒空——轨道点按不改档、不吃事件（缩放走盘面捏合）', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.uit-slider' });
    const track = zoomControlLayout().track;
    const y = track.y + track.h / 2;
    const zoom0 = h.game.debugGestureState().zoom;
    poke(h, track.x + track.w * 0.5, y, 'down');
    expect(h.game.debugGestureState().zoom).toBe(zoom0); // 隐藏 ⇒ 不改档
    poke(h, track.x + track.w * 0.9, y, 'up');
    expect(h.game.phase).toBe('playing'); // 事件穿透（⛔ 不留隐形热区）
  });

  it('对照·未翻清单：托盘槽仍按下帧提交', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.uit-tray' });
    const slot = h.game.giveTrayBead(0);
    expect(slot).toBeGreaterThanOrEqual(0);
    const lay = trayLayout(1);
    const p = {
      x: lay.slotCenterX(slot % TRAY_COLS),
      y: lay.slotCenterY(Math.floor(slot / TRAY_COLS)),
    };
    poke(h, p.x, p.y, 'down');
    expect(h.count('tray:selected')).toBe(1); // 按下帧已选中（抬起提交门不管托盘槽）
    poke(h, p.x, p.y, 'up');
    expect(h.count('tray:selected')).toBe(1);
  });

  it('主菜单钮：拖出热区抬起 = 不切 overlay、不扣心；原地抬起才切', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.uit-menu' });
    const shell = new BeadsShell({
      clock: () => 0,
      metaKey: 'wxgame.beads.test.uit-menu-meta',
      initialScreen: 'menu',
      play: { levels: [simpleTestLevel()] },
    });
    shell.init(h.services);
    const menu = (id: string) => metaLayout('none', undefined, shell.menuAnchors).buttons.find((b) => b.id === id)!;
    const gear = menu('open-settings');
    const stamina0 = shell.meta!.stamina;
    const press = (phase: 'down' | 'move' | 'up', x: number, y: number): void => {
      const s = screenOf(h, x, y);
      h.input.beginFrame();
      h.input.push({ id: 1, x: s.x, y: s.y, phase, time: 0 });
      shell.update(STEP);
      h.input.endFrame(STEP);
    };
    press('down', gear.box.x + gear.box.w / 2, gear.box.y + gear.box.h / 2);
    expect(shell.overlay).toBe('none'); // 旧行为本帧已开设置页
    press('move', 5, 5);
    press('up', 5, 5);
    expect(shell.overlay).toBe('none');
    expect(shell.meta!.stamina).toBe(stamina0);
    // 跨钮：从齿轮按住拖到主钮（CTA）抬起 ⇒ 既不开设置页、也不开局扣心
    //（本腿钉的是「抬起点须仍是同一颗钮」本身，而不是单纯靠抬起点落空）。
    const start = menu('start').box;
    press('down', gear.box.x + gear.box.w / 2, gear.box.y + gear.box.h / 2);
    press('move', start.x + start.w / 2, start.y + start.h / 2);
    press('up', start.x + start.w / 2, start.y + start.h / 2);
    expect(shell.overlay).toBe('none');
    expect(shell.screen).toBe('menu');
    expect(shell.meta!.stamina).toBe(stamina0);
    // 正向对照：同一钮原地抬起 ⇒ 开设置页
    press('down', gear.box.x + gear.box.w / 2, gear.box.y + gear.box.h / 2);
    press('up', gear.box.x + gear.box.w / 2, gear.box.y + gear.box.h / 2);
    expect(shell.overlay).toBe('settings');
  });
});
