/**
 * 严守真 QA · 只读诊断（P5 夹具修复前置核查）
 * 目的：① 确认探针自造关卡能被 BOOT 校验接受（v1.2 首跑 A05-11..23 假 FAIL 的根因排查）
 *      ② 实测齿轮点击 → PAUSED 面板 → toggle-bgm 的真实路径（A05-21）
 *      ③ 实测 fillBoardAudio 走直投 API 能否真过关（A05-17/23）
 * 只写 evidence/，不触碰任何源文件。用法：node production/qa/beads/evidence/diag-p5-fixtures.mjs
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const { loadHarness, STAGE } = await import(`${ROOT}/tools/scripts/lib/harness-runtime.mjs`);
const fw = await import(`${STAGE}/packages/framework/src/index.js`);
const { NodePlatform } = await import(`${STAGE}/packages/framework/src/platform/node.js`);
const { BeadsGame } = await import(`${STAGE}/games/beads/src/game/beads-game.js`);
const T = await import(`${STAGE}/games/beads/src/config/tuning.js`);
const { validateBeadsLevel, LEVELS } = await import(`${STAGE}/games/beads/src/config/levels.js`);

const FR = 1 / 60;
function probeLevel(id, cols, rows, time, spawnInterval, fill, decoys = []) {
    const pattern = [];
    for (let i = 0; i < rows; i++) { let line = ''; for (let j = 0; j < cols; j++) line += fill(i, j); pattern.push(line); }
    return { id, name: `probe-${id}`, cols, rows, time, spawnInterval, decoys, pattern };
}
function mk(opts = {}) {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const events = new fw.EventBus(), input = new fw.InputManager();
    const dispatched = [], stops = [];
    const raw = new fw.NullAudioBackend();
    const backend = { play: (id) => dispatched.push(id), stop: (id) => stops.push(id), stopAll: () => stops.push('*') };
    const audio = new fw.AudioScheduler(backend);
    const services = {
        events, input, audio, storage: platform.createStorage(),
        rng: fw.createRng(opts.seed ?? 'diag'), viewport: new fw.Viewport(750, 1334),
        assets: new fw.NullAssetProvider(), platform: platform.info,
        rewardedAd: new fw.MockRewardedAdProvider(),
    };
    const game = new BeadsGame({ saveKey: `wxgame.beads.diag.${Math.random()}`, ...(opts.levels ? { levels: opts.levels } : {}) });
    game.init(services);
    let pid = 0;
    const tf = (dx, dy, phase, id, t) => {
        const p = { x: 0, y: 0 }; services.viewport.designToScreen(p, dx, dy);
        input.beginFrame(); input.push({ id, x: p.x, y: p.y, phase, time: t });
        game.update(FR); audio.flush(FR); input.endFrame(FR);
    };
    const tapAt = (dx, dy) => { const id = ++pid, t = 1e6 + pid; tf(dx, dy, 'down', id, t); tf(dx, dy, 'up', id, t); };
    const tick = () => { input.beginFrame(); game.update(FR); audio.flush(FR); input.endFrame(FR); };
    return { game, audio, services, input, dispatched, stops, tapAt, tick };
}
const GEAR_XY = [T.GEAR_HIT_SIZE / 2, (T.HUD_BAND.yMin + T.HUD_BAND.yMax) / 2];

console.log('== validateLevel ==');
const cand = probeLevel(901, 6, 5, 180, 6.0, (i, j) => String(((i + 2 * j) % 3) + 1));
console.log('  pattern:', cand.pattern.join(' / '));
console.log('  errors:', JSON.stringify(validateBeadsLevel(cand)));
console.log('  shipped LEVELS n=', LEVELS.length, 'first cols/rows/time=', LEVELS[0].cols, LEVELS[0].rows, LEVELS[0].time);

console.log('\n== A05-11 探针关卡能否进 playing ==');
{
    const h = mk({ levels: [cand] });
    h.tick();
    console.log('  phase after 1 tick =', h.game.phase, '| remaining =', h.game.remaining?.toFixed?.(2));
    console.log('  bgm dispatched =', h.dispatched.filter((x) => x === T.AUDIO_CLIP_BGM).length, h.dispatched.join(','));
}

console.log('\n== A05-17 直投 fillBoardAudio 过关 ==');
{
    const h = mk({ levels: [cand, probeLevel(902, 6, 5, 180, 6.0, (i, j) => String(((i + 2 * j) % 3) + 1))] });
    h.tick();
    const g = h.game.grid;
    let placed = 0, failed = null;
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
        if (!g.isFillable(r, c)) continue;
        const slot = h.game.giveTrayBead(g.requiredColor(r, c));
        if (slot < 0) { failed = `giveTrayBead < 0 @${r},${c}`; break; }
        h.game.selectTraySlot(slot);
        if (!h.game.tapGridCell(r, c)) { failed = `tapGridCell false @${r},${c}`; break; }
        placed++;
    }
    console.log('  placed =', placed, 'failed =', failed, 'phase =', h.game.phase, 'lastStars =', h.game.lastStars, 'remaining =', h.game.remaining.toFixed(2));
    const before = h.dispatched.length;
    for (let i = 0; i < 90; i++) h.tick();
    console.log('  1.5s 内 sfx_star 派发 =', h.dispatched.slice(before).filter((x) => x === T.AUDIO_CLIP_STAR).length);
}

console.log('\n== A05-21 齿轮 → PAUSED → toggle-bgm ==');
{
    const h = mk({ levels: [cand] });
    h.tick();
    console.log('  bgmMuted@boot =', h.game.bgmMuted, '| sfxMuted =', h.game.sfxMuted, '| dispatched =', h.dispatched.join(','));
    h.dispatched.length = 0;
    h.tapAt(...GEAR_XY);
    console.log('  after gear: phase =', h.game.phase, '| dispatched =', h.dispatched.join(',') || '(none)');
    const { pausePanelLayout } = await import(`${STAGE}/games/beads/src/systems/pause-panel.js`);
    const lay = pausePanelLayout('normal');
    console.log('  layout buttons =', lay.buttons.map((b) => `${b.id}[${b.rect.xMin.toFixed(0)},${b.rect.yMin.toFixed(0)}..${b.rect.xMax.toFixed(0)},${b.rect.yMax.toFixed(0)}]`).join(' '));
    console.log('  panel: state =', h.game._panel['_state'], 'interactive =', h.game._panel.interactive,
        '| hitTest(toggle-bgm center, mode=\'normal\') =', h.game._panel.hitTest(375, 645, 'normal'),
        '| snapshot.panelInteractive =', h.game.snapshot.panelInteractive, 'mode =', h.game.snapshot.mode ?? h.game._mode);
    h.dispatched.length = 0;
    const bgmBtn = lay.buttons.find((b) => /bgm/i.test(b.id));
    if (bgmBtn) {
        const cx = (bgmBtn.rect.xMin + bgmBtn.rect.xMax) / 2, cy = (bgmBtn.rect.yMin + bgmBtn.rect.yMax) / 2;
        console.log('  tap center =', cx, cy, '→ screen =', JSON.stringify((() => { const p = { x: 0, y: 0 }; h.services.viewport.designToScreen(p, cx, cy); const q = { x: 0, y: 0 }; h.services.viewport.screenToDesign(q, p.x, p.y); return { screen: [p.x.toFixed(2), p.y.toFixed(2)], back: [q.x.toFixed(2), q.y.toFixed(2)] }; })()));
        h.tapAt(cx, cy);
        console.log('  after toggle-bgm(tap chain): bgmMuted =', h.game.bgmMuted, '| dispatched =', h.dispatched.join(',') || '(none)', '| stops =', h.stops.join(','));
        h.dispatched.length = 0;
        h.game.tapDesign(cx, cy); h.tick();
        console.log('  after toggle-bgm(tapDesign): bgmMuted =', h.game.bgmMuted, '| dispatched =', h.dispatched.join(',') || '(none)', '| stops =', h.stops.join(','));
        h.dispatched.length = 0;
        h.game.tapDesign(cx, cy); h.tick();
        console.log('  第二次 tapDesign（应切回）: bgmMuted =', h.game.bgmMuted, '| dispatched =', h.dispatched.join(',') || '(none)', '| stops =', h.stops.join(','), '| pending =', h.audio.pendingCount);
    }
    // 直接 API 对照
    h.dispatched.length = 0; h.stops.length = 0;
    if (typeof h.game.setBgmMuted === 'function') { h.game.setBgmMuted(true); h.tick(); console.log('  API setBgmMuted(true) → bgmMuted =', h.game.bgmMuted, 'stops =', h.stops.join(',')); }
    else console.log('  no public setBgmMuted; keys =', Object.getOwnPropertyNames(Object.getPrototypeOf(h.game)).filter((k) => /bgm|sfx|mute/i.test(k)).join(','));
}
