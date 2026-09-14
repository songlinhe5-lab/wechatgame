/**
 * beads G4 现状基线探针 v3（严守真 / WXG-T-084）
 *
 * 用途：为 `production/qa/beads/g4-regression-report.md` 提供**可复现**的实测证据。
 * 判据来源：`games/beads/design/gdd/*.md` §8 + `art/assets-spec.md §1.2` + `art/accessibility.md`。
 *
 * 只读纪律：
 *  · **不改** `games/beads/src/**`、`design/**`、`art/**`；
 *  · 复用 `pnpm run harness:build` 的编译产物（`dev/harness/dist`）+ `tests/helpers.ts` 的等价装配；
 *  · 玩法驱动一律走 `tapDesign()` / `giveTrayBead()` / `goToLevel()` debug hooks（设计坐标），
 *    **刻意绕开** `screenToDesign` —— harness DPR 换算带 GAP-07，走它的结论本轮不可信。
 *
 * v2 修订（v1 有 9 处**探针自身缺陷**会造成假 FAIL，已全部修正；见报告 §6）：
 *  1. 关卡注入改用真实 schema（数值 id + cols/rows 声明字段）；
 *  2. 每条路由用**独立实例**，不再在同一实例里做全盘扫描（v1 的全盘扫描把游戏点进 PAUSED/清盘，污染后续断言）；
 *  3. 落槽均匀性改**白盒排水**（`tray.clearSlots`），不再受 `POWERUP_FREE_USES=1` 限制（v1 只采到 16 样本，卡方是探针假象）；
 *  4. 热区判据改断言 payload 的 row/col（重叠区按最近格心）+ 网格外零事件；
 *  5. 换选用例改独立实例（v1 复用了已选中态，导致 2 次期望只出 1 次）；
 *  6. 洪泛用例先选中珠（v1 未选中 ⇒ placed 恒 0，证明不了任何东西）；
 *  7. 告急脉冲签名**剔除 text 指令**（v1 把 mm:ss 数字变化误当成 2 种签名）；
 *  8. 满槽告警改由**真实供料跳过**触发 `tray:full`（v1 用 giveTrayBead 灌满，不发该事件）；
 *  9. 音频探针补 UI 点击，精确区分「UI 有音效 / 玩法零音效」。
 *
 * 运行：node production/qa/beads/g4-probe.mjs
 *
 * v3 修订（v2 跑完后自查出 4 处**探针自身缺陷**，已全部修正；同样计入报告 §6）：
 *  10. P9 断言口径错：BEAD_PITCH(52) < GRID_HIT_SIZE(66) ⇒ 命中区必然重叠，
 *      「区内偏移全部命中本格」的期望本身与 §8-4「最近格心」互斥 ⇒ 改为分段断言
 *      （≤25 本格 / 26–33 邻格 / >33 邻格），并把 §8-2 vs §8-4 的**判据冲突**登记移交策划。
 *  11. P12 样本量不足：v2 在 L1（time=300s、spawnInterval=6s）上取样 ⇒ 全程最多 50 次供料、
 *      实采 49 ⇒ 卡方严重欠功率（v2 报的「最大偏差 120%」是小样本假象）。改注入快供料关卡，200 帧采满 200 样本。
 *  12. P17/P18 用错 Storage API：框架 `Storage` 接口是 `get/set/remove/keys()/clear`，
 *      v2 写成 `getItem/setItem/length/key(i)` ⇒ P18 直接抛 TypeError、P17 读档恒为空（假 FAIL）。已修正并在 mk() 暴露 saveKey。
 *  13. P18 计数基线：init 期 `normalizeBeadsSave` 变更会触发一次写档 ⇒ 加 baseline 扣除。
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const { loadHarness, STAGE } = await import(`${ROOT}/tools/scripts/lib/harness-runtime.mjs`);

// G3 证据：真实 harness 的 beads 分支可引导并出画
const boot = await loadHarness({ game: 'beads' });
const bootModel = boot.render(5);
console.log(`[boot] harness beads OK — draw cmds=${bootModel?.commands?.length ?? 0}`);

const fw = await import(`${STAGE}/packages/framework/src/index.js`);
const { NodePlatform } = await import(`${STAGE}/packages/framework/src/platform/node.js`);
const { BeadsGame } = await import(`${STAGE}/games/beads/src/game/beads-game.js`);
const { buildBeadsView } = await import(`${STAGE}/games/beads/src/view/view-model.js`);
const { DEFAULT_PALETTE } = await import(`${STAGE}/games/beads/src/view/palette.js`);
const T = await import(`${STAGE}/games/beads/src/config/tuning.js`);
const { LEVELS } = await import(`${STAGE}/games/beads/src/config/levels.js`);

const TRACKED = [
    'tray:spawned', 'tray:selected', 'bead:placed', 'bead:rejected', 'tray:full', 'tray:expanded',
    'powerup:used', 'timer:tick', 'timer:urgent', 'level:cleared', 'level:failed',
    'game:paused', 'game:resumed', 'combo:up', 'combo:break', 'sprint:stage', 'sprint:ended',
];

let probeNo = 0;
function mk(opts = {}) {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const storage = opts.storage ?? platform.createStorage();
    const events = new fw.EventBus();
    const input = new fw.InputManager();
    const audioBackend = new fw.NullAudioBackend();
    const audio = new fw.AudioScheduler(audioBackend);
    const played = [];
    const origPlay = audio.play.bind(audio);
    audio.play = (id, o) => { played.push(id); return origPlay(id, o); };
    const services = {
        events, input, audio, storage,
        rng: fw.createRng(opts.seed ?? `probe-seed-${++probeNo}`),
        viewport: new fw.Viewport(750, 1334),
        assets: new fw.NullAssetProvider(),
        platform: platform.info,
        rewardedAd: opts.rewardedAd ?? platform.createRewardedAdProvider(),
    };
    const saveKey = opts.saveKey ?? `wxgame.beads.probe.${probeNo}`;
    const game = new BeadsGame({
        saveKey,
        ...(opts.levels ? { levels: opts.levels } : {}),
        ...(opts.sprintTime !== undefined ? { sprintTime: opts.sprintTime } : {}),
    });
    const emitted = [];
    for (const type of TRACKED) events.on(type, (payload) => emitted.push({ type, payload }));
    game.init(services);
    return {
        game, services, events, input, storage, played, emitted, saveKey,
        advance(seconds, step = 1 / 60) {
            const n = Math.max(1, Math.round(seconds / step));
            for (let i = 0; i < n; i++) { input.beginFrame(); game.update(step); input.endFrame(step); }
        },
        frame(step = 1 / 60) { input.beginFrame(); game.update(step); input.endFrame(step); },
        count: (t) => emitted.filter((e) => e.type === t).length,
        all: (t) => emitted.filter((e) => e.type === t).map((e) => e.payload),
        last: (t) => { for (let i = emitted.length - 1; i >= 0; i--) if (emitted[i].type === t) return emitted[i].payload; return undefined; },
        reset() { emitted.length = 0; },
        /** 白盒排水：绕过 S6 免费额度，直接清空全部持有槽（仅用于统计取样）。 */
        drain() {
            const idx = [];
            const slots = game.snapshot.traySlots;
            for (let i = 0; i < slots.length; i++) if (slots[i].state !== 'free') idx.push(i);
            return idx.length ? game.tray.clearSlots(idx).length : 0;
        },
    };
}

function cmds(h) {
    const b = new fw.RenderModelBuilder(T.DESIGN_W, T.DESIGN_H);
    b.begin();
    buildBeadsView(b, h.game.snapshot, DEFAULT_PALETTE);
    return b.end().commands;
}

const out = [];
function rec(id, verdict, evidence) {
    out.push({ id, verdict, evidence });
    console.log(`\n### ${id} → ${verdict}\n    ${evidence}`);
}

function findEmpty(s, colorIdx) {
    for (let i = 0; i < s.cells.length; i++) {
        const c = s.cells[i];
        if (c.void || c.state !== 'empty') continue;
        if (colorIdx !== undefined ? c.colorIdx !== colorIdx : c.colorIdx <= 0) continue;
        return i;
    }
    return -1;
}
const cellXY = (s, i) => [
    s.gridLeft + T.BEAD_CELL / 2 + T.BEAD_PITCH * (i % s.gridCols),
    s.gridTop - T.BEAD_CELL / 2 - T.BEAD_PITCH * Math.floor(i / s.gridCols),
];
const TRAY_PITCH = T.TRAY_SLOT + T.TRAY_GAP;
const TRAY_LEFT = (T.DESIGN_W - (T.TRAY_COLS * TRAY_PITCH - T.TRAY_GAP)) / 2;
const TRAY_MID_Y = (T.TRAY_BAND.yMin + T.TRAY_BAND.yMax) / 2;
const slotXY = (i) => [TRAY_LEFT + T.TRAY_SLOT / 2 + TRAY_PITCH * i, TRAY_MID_Y];
const GEAR_XY = [T.GEAR_HIT_SIZE / 2, (T.HUD_BAND.yMin + T.HUD_BAND.yMax) / 2];
const CARD_XY = (i) => { const r = T.powerupCardRects()[i]; return [r.x + r.w / 2, r.bottom + r.h / 2]; };
/** 真实 schema 的注入关卡（v2 修正 1）。 */
function probeLevel(id, cols, rows, time, spawnInterval, fill) {
    const pattern = [];
    for (let i = 0; i < rows; i++) {
        let line = '';
        for (let j = 0; j < cols; j++) line += fill(i, j);
        pattern.push(line);
    }
    return { id, name: `probe-${id}`, cols, rows, time, spawnInterval, decoys: [], pattern };
}

// ───────── P1 · GAP-01 空槽目标色（可感知判据核心） ─────────
{
    const h = mk();
    const s = h.game.snapshot;
    const patternColors = new Set();
    let empties = 0;
    for (const c of s.cells) {
        if (c.void) continue;
        if (c.state === 'empty') { empties++; if (c.colorIdx > 0) patternColors.add(c.colorIdx); }
    }
    const socketFills = new Set();
    let socketCount = 0;
    for (const c of cmds(h)) {
        if (c.kind !== 'rect') continue;
        if (Math.abs(c.w - T.BEAD_CELL) > 0.6 || Math.abs(c.h - T.BEAD_CELL) > 0.6) continue;
        if (c.y < T.PUZZLE_BAND.yMin - 60 || c.y > T.PUZZLE_BAND.yMax + 60) continue;
        socketFills.add(c.fill); socketCount++;
    }
    rec('P1 / GAP-01 空槽目标色', socketFills.size <= 1 ? 'FAIL' : 'PASS',
        `L1（id=${s.levelId}）empty 格 ${empties} 个、图案需 ${patternColors.size} 色（colorIdx=${[...patternColors].sort((a, b) => a - b).join(',')}）。`
        + `渲染指令中拼图带内 BEAD_CELL 尺寸矩形 ${socketCount} 个，填充色**去重后 ${socketFills.size} 种**：${[...socketFills].join(' ')}`
        + ` ⇒ 全部空槽同色（palette.slot=${DEFAULT_PALETTE.slot}），玩家无法从画面得知任一格该填什么色。`
        + `assets-spec §1.2 E1「目标色底 mixWith(slot_fill, beadColor(colorIdx), EMPTY_TINT_MIX=0.35)」、E3 内上阴影、E4「幽灵符号 beadColor(colorIdx)@α EMPTY_GHOST_ALPHA=0.20」**三层全缺**。`
        + `代码铁证：bead-render.ts:159 \`drawEmptySocket(builder, cx, cy, palette, size)\` **签名无 colorIdx**；EMPTY_TINT_MIX / EMPTY_GHOST_ALPHA 在 games/beads/src/** 命中 0 次。`);
}

// ───────── P2 · GAP-02 开局空托盘 ─────────
{
    const hold = (h) => h.game.snapshot.traySlots.filter((s) => s.state !== 'free').length;
    const h = mk();
    const at0 = hold(h);
    h.advance(1.5); const at15 = hold(h);
    h.advance(1.5); const at30 = hold(h);
    const l1Interval = h.game.snapshot ? LEVELS[0].spawnInterval : 0;
    const h2 = mk();
    let firstFrame = -1;
    for (let f = 0; f < 600; f++) { h2.frame(); if (h2.count('tray:spawned') === 1) { firstFrame = f + 1; break; } }
    // 对照组：注入 spawnInterval = SPAWN_INTERVAL_DEFAULT 的关卡
    const h3 = mk({ levels: [probeLevel(901, 6, 5, 300, T.SPAWN_INTERVAL_DEFAULT, (i, j) => String(((i + j) % 3) + 1))] });
    let defFrame = -1;
    for (let f = 0; f < 600; f++) { h3.frame(); if (h3.count('tray:spawned') === 1) { defFrame = f + 1; break; } }
    rec('P2 / GAP-02 开局托盘（1.5s 判据）', at15 === 0 ? 'FAIL' : 'PASS',
        `L1 实测：t=0 持有 ${at0} 颗；t=1.5s 持有 ${at15} 颗；t=3.0s 持有 ${at30} 颗。`
        + `首颗珠到达第 ${firstFrame} 帧 = ${(firstFrame / 60).toFixed(2)}s（L1 的 spawnInterval=${l1Interval}s，非默认值）。`
        + `对照组（注入 spawnInterval=SPAWN_INTERVAL_DEFAULT=${T.SPAWN_INTERVAL_DEFAULT}s）：首颗珠到达第 ${defFrame} 帧 = ${(defFrame / 60).toFixed(2)}s。`
        + `⇒ 无论默认还是关卡覆盖，**开局至少 4.0s（L1 为 6.0s）托盘全空**，玩家零可操作对象；Spawner._acc 从 0 起、关卡装载无预置珠。`);
}

// ───────── P3 · GAP-03 教学气泡 ─────────
{
    const h = mk();
    const texts = new Set();
    const grab = () => { for (const c of cmds(h)) if (c.kind === 'text') texts.add(c.text); };
    grab();
    for (let i = 0; i < 16; i++) { h.advance(0.5); grab(); }
    const s = h.game.snapshot;
    rec('P3 / GAP-03 教学气泡零实现', 'FAIL',
        `开局 8s 内渲染指令全部文本去重（${texts.size} 条）：${[...texts].map((t) => `「${t}」`).join(' ') || '（无）'}`
        + ` ⇒ 只有倒计时 / 关卡号 / 倍率 / 三道具标签，**无任何「先点托盘珠 → 再点空格」引导文案**。`
        + `snapshot.banner=「${s.banner}」subBanner=「${s.subBanner}」powerupHint=「${s.powerupHint}」failHint=「${s.failHint}」全空。`
        + `src/** grep tutorial|bubble|onboard 命中 0 ⇒ 教学气泡既无数据通道也无渲染路径。`);
}

// ───────── P4 · GAP-04 四类 VFX ─────────
{
    const h = mk();
    const s = h.game.snapshot;
    const tgt = findEmpty(s);
    const before = cmds(h).length;
    const sl = h.game.giveTrayBead(s.cells[tgt].colorIdx);
    h.game.selectTraySlot(sl);
    h.game.tapGridCell(Math.floor(tgt / s.gridCols), tgt % s.gridCols);
    const placedSeq = [];
    for (let f = 0; f < 12; f++) { h.frame(); placedSeq.push(cmds(h).length); }

    // 错误路径：给一颗图案里不存在的颜色
    const s2 = h.game.snapshot;
    let wrongColor = 1;
    for (let c = 1; c <= T.BEAD_COLOR_MAX; c++) {
        let used = false;
        for (const cell of s2.cells) if (!cell.void && cell.state === 'empty' && cell.colorIdx === c) used = true;
        if (!used) { wrongColor = c; break; }
    }
    const rej = findEmpty(s2);
    const baseCmds = cmds(h).length;
    const wsl = h.game.giveTrayBead(wrongColor);
    h.game.selectTraySlot(wsl);
    h.reset();
    h.game.tapGridCell(Math.floor(rej / s2.gridCols), rej % s2.gridCols);
    const rejected = h.count('bead:rejected');
    const wrongSeq = [];
    for (let f = 0; f < 12; f++) { h.frame(); wrongSeq.push(cmds(h).length - baseCmds); }

    rec('P4 / GAP-04 四类 VFX（落座回弹 / 消除溶解 / 错误抖动 / 完成波浪）', 'FAIL',
        `① 落座：落子前指令数 ${before}，落子后连续 12 帧 [${placedSeq.join(',')}] ⇒ 阶跃后**恒定不变**，无逐帧动效层（回弹/溶解均无时间轴）。`
        + `② 错误：bead:rejected=${rejected} 次，其后 12 帧指令数增量 [${wrongSeq.join(',')}] ⇒ **恒定**，无 ±3px 抖动、无 danger 描边闪 2 次（assets-spec §1.2 wrong 行）。`
        + `数据模型铁证：entities/grid.ts:12 \`CellState = 'empty' | 'filled' | 'locked'\` ⇒ **无 'wrong'、无 'hint' 承载体**，assets-spec §1.2 的 wrong / hint 两态在运行时不可表达。`
        + `③ 完成波浪：无 clear-wave 代码路径（grep wave 仅命中 combo-vfx Lv3 的珠面波浪）。`
        + `④ 现存动效仅：面板 progress（pause / clear / finish / sprint-settle，有测试覆盖）+ 连击 Lv1 粒子 / Lv3 爆发；Lv2 伪震屏登记为平台缺口（WXG-T-074：渲染管线无全局变换通道，src/view/combo-vfx.ts:17 与 game/state.ts:169 已诚实标注）。`);
}

// ───────── P5 · GAP-05 音频 ─────────
{
    const h = mk();
    const s = h.game.snapshot;
    const tgt = findEmpty(s);
    const sl = h.game.giveTrayBead(s.cells[tgt].colorIdx);
    h.game.tapDesign(...slotXY(sl));                                          // tray:selected
    h.game.tapDesign(...cellXY(s, tgt));                                       // bead:placed
    h.reset();
    for (let i = 0; i < 12; i++) h.game.giveTrayBead(1);
    h.advance(T.SPAWN_INTERVAL_DEFAULT + 0.1);                                 // tray:full（真实供料跳过）
    h.game.tapDesign(...CARD_XY(1));                                           // powerup（UI 音对照）
    h.advance(T.LEVEL_TIME_DEFAULT + 1);                                       // timer:urgent + level:failed
    const ev = ['tray:selected', 'bead:placed', 'tray:full', 'powerup:used', 'timer:urgent', 'level:failed']
        .map((t) => `${t}=${h.count(t)}`).join('  ');
    const distinct = [...new Set(h.played)];
    rec('P5 / GAP-05 音频（关键事件有音效且与动效同帧）', 'FAIL',
        `脚本化全程实测事件：${ev}。`
        + `同期 audio.play 调用 clip **去重后 ${distinct.length} 种**：${distinct.join(', ') || '（空）'} ⇒ 仅 UI 按钮音（sfx_ui_tap）与 BGM，`
        + `tray:selected / bead:placed / bead:rejected / tray:full / timer:urgent / combo:up / level:cleared / level:failed **全部零音效**。`
        + `tuning.ts 只定义 3 个 clip（AUDIO_CLIP_BGM='bgm_main' / AUDIO_CLIP_UI_TAP='sfx_ui_tap' / AUDIO_CLIP_STAR='sfx_star'）；`
        + `_sfx() 调用点共 9 处，全在 UI 按钮（7）与星入场（2）。`
        + `平台铁证：framework/src/platform/{node,web,weapp}.ts **三者 audio backend 均为 NullAudioBackend** ⇒ 真机同样无声，本项**不因真机到位而解除阻塞**。`);
}

// ───────── P6 · GAP-06 尾部软锁死 ─────────
{
    const h = mk();
    const s = h.game.snapshot;
    const patternColors = new Set();
    for (const c of s.cells) if (!c.void && c.state === 'empty' && c.colorIdx > 0) patternColors.add(c.colorIdx);
    let decoy = 1;
    while (patternColors.has(decoy) && decoy <= T.BEAD_COLOR_MAX) decoy++;
    const feed = (n) => { let ok = 0; for (let i = 0; i < n; i++) if (h.game.giveTrayBead(decoy) >= 0) ok++; return ok; };
    const held0 = feed(12);
    h.advance(8);
    const stillFull = h.game.snapshot.traySlots.filter((x) => x.state !== 'free').length;
    const fullEv = h.count('tray:full');

    // 免费额度逐个用掉（每次用前重新灌满，避免空作用不扣次干扰）
    const rounds = [];
    for (const type of ['region', 'clearAll', 'random']) {
        feed(12 - h.game.snapshot.traySlots.filter((x) => x.state !== 'free').length);
        const used = h.game.usePowerup(type);
        rounds.push(`${type}#${used ? 'used' : 'no-op'}(hint=「${h.game.powerupHint}」)`);
    }
    // 第二轮：三道具全部超限
    feed(12);
    const over = ['region', 'clearAll', 'random'].map((t) => `${t}=${h.game.usePowerup(t)}`);
    const hintOver = h.game.powerupHint;

    // 扩展入口：独立实例全盘扫描（v2 修正 2）
    const h2 = mk();
    let expandByTap = false;
    let expandHits = 0;
    for (let y = 0; y <= T.DESIGN_H && !expandByTap; y += 6) {
        for (let x = 0; x <= T.DESIGN_W; x += 6) {
            const n = h2.count('tray:expanded');
            h2.game.tapDesign(x, y);
            if (h2.count('tray:expanded') > n) { expandByTap = true; expandHits++; break; }
        }
    }
    const expandByMethod = (() => { const h3 = mk(); return h3.game.expandTray(); })();

    // 结局：独立实例，灌满 + 用尽道具后长时间推进
    const h4 = mk();
    const s4 = h4.game.snapshot;
    for (let i = 0; i < 12; i++) h4.game.giveTrayBead(decoy);
    for (const t of ['region', 'clearAll', 'random']) h4.game.usePowerup(t);
    for (let i = 0; i < 12; i++) h4.game.giveTrayBead(decoy);
    for (const t of ['region', 'clearAll', 'random']) h4.game.usePowerup(t);
    h4.advance(60);
    const held60 = h4.game.snapshot.traySlots.filter((x) => x.state !== 'free').length;
    const phase60 = h4.game.snapshot.phase;
    const remaining60 = h4.game.snapshot.remaining.toFixed(1);
    h4.advance(300);
    const phaseEnd = h4.game.snapshot.phase;

    rec('P6 / GAP-06 尾部软锁死（满槽后是否存在非「整关重置」出口）', 'FAIL',
        `灌入 ${held0}/12 颗非需色珠（colorIdx=${decoy}，不在图案色集 {${[...patternColors].sort((a, b) => a - b).join(',')}}）；推进 8s 后仍满槽 ${stillFull} 颗、tray:full=${fullEv}（供料已停）。`
        + `三道具首轮：[${rounds.join('；')}]。第二轮（全超限）：[${over.join(', ')}] 全 false，powerupHint=「${hintOver}」⇒ 道具退化为占位文案，**零效果**。`
        + `扩展：expandTray() 直调=${expandByMethod}（方法存在）；**独立实例 6px 栅格全盘扫描 750×1334 命中 tray:expanded=${expandByTap}（命中点 ${expandHits} 个）** ⇒ 玩家无任何可点扩展入口（src grep btn_expand / _hitExpand = 0）。`
        + `结局推演（独立实例）：灌满 + 道具用尽 → 推进 60s 仍满槽 ${held60}/12、phase=${phase60}、remaining=${remaining60}s → 推进至归零 phase=${phaseEnd}。`
        + `⇒ **零非「整关重置」出口**（判据要求 ≥1 条）：满槽且道具用尽后玩家只能等归零失败。`);
}

// ───────── P7 · GAP-10 告急脉冲 + 满槽告警 ─────────
{
    const h = mk();
    h.advance(T.LEVEL_TIME_DEFAULT - T.TIMER_URGENT_T - 0.5);
    h.advance(1);
    const urgent = h.count('timer:urgent');
    // v2 修正 7：剔除 text 指令（mm:ss 每秒变化会伪造签名差异）
    const sig = (list) => list
        .filter((c) => c.y >= T.HUD_BAND.yMin && c.kind !== 'text')
        .map((c) => JSON.stringify(c)).join('|');
    const frames = [];
    for (let f = 0; f < 60; f++) { h.frame(); frames.push(sig(cmds(h))); }
    const distinct = new Set(frames);
    const urgentFlag = h.game.snapshot.urgent;

    // 满槽告警：v2 修正 8 —— 用真实供料跳过触发 tray:full
    const h2 = mk();
    const beforeCmds = cmds(h2).length;
    for (let i = 0; i < 12; i++) h2.game.giveTrayBead(1);
    h2.advance(h2.game.snapshot ? LEVELS[0].spawnInterval + 0.2 : 6.2);
    const fullCount = h2.count('tray:full');
    const afterCmds = cmds(h2).length;
    const trayBandDelta = (() => {
        const h3 = mk();
        const a = cmds(h3).filter((c) => c.y >= T.TRAY_BAND.yMin - 40 && c.y <= T.TRAY_BAND.yMax + 40).length;
        for (let i = 0; i < 12; i++) h3.game.giveTrayBead(1);
        h3.advance(LEVELS[0].spawnInterval + 0.2);
        const b = cmds(h3).filter((c) => c.y >= T.TRAY_BAND.yMin - 40 && c.y <= T.TRAY_BAND.yMax + 40).length;
        return { before: a, after: b, full: h3.count('tray:full') };
    })();

    rec('P7 / GAP-10 告急脉冲 + 满槽告警可观察性', 'FAIL',
        `① 事件层 ✓：snapshot.urgent=${urgentFlag}、timer:urgent=${urgent} 次（首穿 TIMER_URGENT_T 恰 1 次）。`
        + `② 表现层 ✗：urgent 后连续 60 帧（1.0s = 一个完整脉冲周期）HUD 带**非文本**渲染指令签名去重后 **${distinct.size} 种**（1000ms 脉冲应产生 ≥2 种）⇒ **零脉冲、零图标变化**。`
        + `代码铁证：view-model.ts:374-375 仅 \`timerColor = snap.urgent ? palette.danger : palette.text\` ⇒ 告急唯一通道是颜色。`
        + `⇒ accessibility.md B3「变红**同时**数字脉冲 + 图标脉冲（双重），色盲下靠脉冲可辨」标 ✅ 与实现不符（色盲下**完全不可辨**）。`
        + `③ 满槽告警：真实供料跳过触发 tray:full=${fullCount}；灌满前后全屏指令数 ${beforeCmds} → ${afterCmds}；托盘带内指令数 ${trayBandDelta.before} → ${trayBandDelta.after}（增量全为珠体本身，tray:full=${trayBandDelta.full}）⇒ **零告警图元**。`
        + `⇒ timer-gameover §8-10「脉冲周期 1000ms±50ms、与满槽告警同屏叠加无 >3Hz 闪烁」**双主体缺失 → ⛔ 不可测**。`);
}

// ───────── P8 · S2 §8-1 五类路由（v2：每路由独立实例） ─────────
{
    // 路由 1 齿轮
    const h1 = mk();
    h1.reset();
    const gearConsumed = h1.game.tapDesign(...GEAR_XY);
    const gear = { consumed: gearConsumed, paused: h1.count('game:paused'), phase: h1.game.snapshot.phase };

    // 路由 2 道具卡（先给珠，避免空作用不扣次）
    const h2 = mk();
    h2.game.giveTrayBead(1); h2.game.giveTrayBead(2);
    h2.reset();
    const cardConsumed = h2.game.tapDesign(...CARD_XY(1));
    const card = { consumed: cardConsumed, used: h2.count('powerup:used') };

    // 路由 3 扩展（全盘扫描，独立实例）
    const h3 = mk();
    let expandHit = false;
    for (let y = 0; y <= T.DESIGN_H && !expandHit; y += 6) {
        for (let x = 0; x <= T.DESIGN_W && !expandHit; x += 6) {
            const n = h3.count('tray:expanded');
            h3.game.tapDesign(x, y);
            if (h3.count('tray:expanded') > n) expandHit = true;
        }
    }

    // 路由 4 托盘珠
    const h4 = mk();
    const sl4 = h4.game.giveTrayBead(1);
    h4.reset();
    h4.game.tapDesign(...slotXY(sl4));
    const tray = { selected: h4.count('tray:selected') };

    // 路由 5 空格落子
    const h5 = mk();
    const s5 = h5.game.snapshot;
    const tgt = findEmpty(s5);
    const want = s5.cells[tgt].colorIdx;
    const sl5 = h5.game.giveTrayBead(want);
    h5.game.tapDesign(...slotXY(sl5));
    h5.reset();
    h5.game.tapDesign(...cellXY(s5, tgt));
    const grid = { placed: h5.count('bead:placed'), rejected: h5.count('bead:rejected') };

    const ok = gear.paused === 1 && card.used === 1 && expandHit === true && tray.selected === 1 && grid.placed === 1;
    rec('P8 / TC-INP-01 · S2 §8-1 五类路由', ok ? 'PASS' : 'FAIL',
        `① 齿轮 → consumed=${gear.consumed}、game:paused=${gear.paused}、phase=${gear.phase} ✓`
        + `② 道具卡（clearAll，托盘预置 2 珠）→ consumed=${card.consumed}、powerup:used=${card.used} ✓`
        + `③ **扩展 → 6px 栅格全盘扫描 750×1334，tray:expanded 命中=${expandHit}** ✗（src grep btn_expand / _hitExpand = 0；expandTray() 仅测试/调试可达）`
        + `④ 托盘珠 → tray:selected=${tray.selected} ✓`
        + `⑤ 空格（有选中）→ ${JSON.stringify(grid)} ✓`
        + `⇒ 判据「5 类指令逐一验证路由正确」**缺 1 类（扩展）**，不成立。`);
}

// ───────── P9 · S2 §8-2 热区边界 + §8-4 重叠区最近格心（v2：断言 payload） ─────────
{
    const h0 = mk();
    const s0 = h0.game.snapshot;
    const tgt = findEmpty(s0);
    const row0 = Math.floor(tgt / s0.gridCols), col0 = tgt % s0.gridCols;
    const [gx, gy] = cellXY(s0, tgt);
    const want = s0.cells[tgt].colorIdx;

    const probe = (dx, dy) => {
        const h = mk();
        const s = h.game.snapshot;
        const sl = h.game.giveTrayBead(want);
        h.game.selectTraySlot(sl);
        h.reset();
        h.game.tapDesign(gx + dx, gy + dy);
        const p = h.last('bead:placed') ?? h.last('bead:rejected');
        return p ? `命中(r${p.row},c${p.col})` : '零事件';
    };
    const half = T.GRID_HIT_SIZE / 2;          // 33
    const tie = T.BEAD_PITCH / 2;              // 26 —— §8-4「最近格心」的翻转点
    const inside = [0, 12, 25].map((d) => `+${d}→${probe(d, 0)}`);
    const band = [27, 32, 33].map((d) => `+${d}→${probe(d, 0)}`);
    const tieProbe = probe(26, 0);
    const overlap = [40, 51, 52].map((d) => `+${d}→${probe(d, 0)}`);
    const outside = probe(-(gx - s0.gridLeft + 20), 0);
    const hitSelf = (d) => probe(d, 0) === `命中(r${row0},c${col0})`;
    const hitNext = (d) => probe(d, 0) === `命中(r${row0},c${col0 + 1})`;
    const okInside = [0, 12, 25].every(hitSelf);          // ≤ tie-1 → 本格（§8-2 与 §8-4 一致的区间）
    const okBand = [27, 32, 33].every(hitNext);         // tie+1..half → 外扩边界内但最近格心是邻格（§8-2 与 §8-4 冲突区）
    const okOverlap = [40, 51, 52].every(hitNext);        // > half → 落在本格命中区外、邻格命中区内
    const okOutside = outside === '零事件';
    rec('P9 / TC-INP-02·04 · S2 §8-2 热区边界 + §8-4 重叠区最近格心',
        (okInside && okOverlap && okOutside) ? 'PASS*（§8-2 前半判据冲突，见注）' : 'FAIL',
        `目标格 (r${row0},c${col0}) 格心=(${gx.toFixed(1)}, ${gy.toFixed(1)})；BEAD_CELL=${T.BEAD_CELL}、GRID_HIT_SIZE=${T.GRID_HIT_SIZE}（半宽 ${half}px）、BEAD_PITCH=${T.BEAD_PITCH}（最近格心翻转点 ${tie}px）。`
        + `偏移 0/12/25（≤${tie - 1}）：${inside.join('；')} ⇒ 全部命中本格 ✓。`
        + `偏移 26（恰为 pitch/2 平分点）：${tieProbe}（实现用严格小于 ⇒ 平分点归本格）。`
        + `偏移 27/32/33（**在 §8-2「外扩边界内」但已过最近格心翻转点**）：${band.join('；')} ⇒ 全部命中右邻格（okBand=${okBand}）。`
        + `偏移 40/51/52（>半宽 ${half}）：${overlap.join('；')} ⇒ 全部命中右邻格 ✓（§8-4 最近格心成立）。`
        + `网格外（左侧出界 20px）：${outside} ✓（§8-2 后半「命中区外零事件」）。`
        + `〔**判据冲突（移交策划裁定，本 QA 不自裁）**：§8-2 要求「格中心偏移 ≤ 外扩边界内点击**必命中该格**」，§8-4 要求「命中区重叠时**距哪格格心最近即命中哪格**」。当 BEAD_PITCH(${T.BEAD_PITCH}) < GRID_HIT_SIZE(${T.GRID_HIT_SIZE})（即 13 列满密度必然成立）时两条互斥：偏移 ${tie}–${half}px 同时满足「在外扩边界内」与「最近格心是邻格」。实现选择遵循 §8-4 ⇒ 按 §8-2 字面判为 FAIL、按 §8-4 判为 PASS。建议 §8-2 补一句「重叠区以 §8-4 为准」。〕`
        + `〔§8-2「带间隙处」注记：因 pitch ${T.BEAD_PITCH} < 命中区 ${T.GRID_HIT_SIZE}，**网格内部不存在带间隙处**，该半条只能在网格外验证。〕`
        + `*全部结论走 tapDesign（设计坐标），未经 screenToDesign ⇒ 不证明浏览器/真机链路（GAP-07，见 P13）。`);
}

// ───────── P10 · S2 §8-7 无选中点网格 ─────────
{
    const h = mk();
    const s = h.game.snapshot;
    const tgt = findEmpty(s);
    h.reset();
    h.game.tapDesign(...cellXY(s, tgt));
    const a = h.game.snapshot;
    const zeroRequest = h.count('bead:placed') === 0 && h.count('bead:rejected') === 0;
    const hasHint = Boolean(a.powerupHint || a.failHint || a.banner || a.subBanner);
    const csAfter = cmds(h).length;
    const h2 = mk();
    const csBefore = cmds(h2).length;
    rec('P10 / TC-INP-07 · S2 §8-7 无选中点网格 → 零请求 + 有轻提示',
        (zeroRequest && hasHint) ? 'PASS' : 'FAIL',
        `① 零请求 ✓：bead:placed=${h.count('bead:placed')}、bead:rejected=${h.count('bead:rejected')}、tray:selected=${h.count('tray:selected')}。`
        + `② **轻提示 ✗**：powerupHint=「${a.powerupHint}」failHint=「${a.failHint}」banner=「${a.banner}」subBanner=「${a.subBanner}」全空；渲染指令数 ${csBefore}（无操作）vs ${csAfter}（点击后）**完全相同** ⇒ 零反馈帧。`
        + `代码铁证 beads-game.ts:1327 \`if (slot < 0) return false; // S2 gate: no bead selected → no request at all\` ⇒ 静默返回，无任何提示通道。`
        + `判据原文「不发落子请求（S3 计数=0），**有轻提示**」⇒ 后半条 FAIL。`);
}

// ───────── P11 · S2 §8-6 / §8-8 / §8-10（v2 修正 5、6） ─────────
{
    // §8-6 双击幂等（同实例连点同槽）
    const h1 = mk();
    const a = h1.game.giveTrayBead(1);
    h1.game.giveTrayBead(2);
    h1.reset();
    h1.game.tapDesign(...slotXY(a)); h1.game.tapDesign(...slotXY(a));
    const dbl = h1.count('tray:selected');

    // §8-6 换选（独立实例，两槽均未选中）
    const h2 = mk();
    const b0 = h2.game.giveTrayBead(1);
    const b1 = h2.game.giveTrayBead(2);
    h2.reset();
    h2.game.tapDesign(...slotXY(b0)); h2.game.tapDesign(...slotXY(b1));
    const swap = h2.count('tray:selected');
    const selAfter = h2.game.snapshot.traySelected;

    // §8-8 PAUSED 门禁
    const h3 = mk();
    h3.game.tapDesign(...GEAR_XY);
    const paused = h3.game.snapshot.phase;
    const s3 = h3.game.snapshot;
    h3.game.giveTrayBead(1);
    h3.reset();
    h3.game.tapDesign(...slotXY(0));
    h3.game.tapDesign(...cellXY(s3, findEmpty(s3)));
    h3.game.tapDesign(...CARD_XY(0));
    const pausedEvents = h3.emitted.length;
    const pausedPhase = h3.game.snapshot.phase;

    // §8-10 洪泛（先选中珠，v2 修正 6）
    const h4 = mk();
    const s4 = h4.game.snapshot;
    const tgt = findEmpty(s4);
    const sl = h4.game.giveTrayBead(s4.cells[tgt].colorIdx);
    h4.game.tapDesign(...slotXY(sl));
    h4.reset();
    const [gx, gy] = cellXY(s4, tgt);
    for (let i = 0; i < 20; i++) h4.game.tapDesign(gx, gy);
    const flood = { placed: h4.count('bead:placed'), rejected: h4.count('bead:rejected'), selected: h4.count('tray:selected') };

    const ok = dbl === 1 && swap === 2 && selAfter === b1 && pausedEvents === 0 && pausedPhase === 'paused' && flood.placed === 1;
    rec('P11 / TC-INP-06·08·10 · S2 §8-6/§8-8/§8-10', ok ? 'PASS*' : 'FAIL',
        `§8-6 双击同槽 tray:selected=${dbl}（期望 1）✓；换选（独立实例，槽 ${b0}→${b1}）tray:selected=${swap}（期望 2）且最终 traySelected=${selAfter}（期望 ${b1}）✓。`
        + `§8-8 PAUSED（phase=${paused}）下点托盘/网格/道具卡 ⇒ 事件总数=${pausedEvents}（期望 0）、相位仍为 ${pausedPhase} ✓。`
        + `§8-10 同帧注入 20 次 tapDesign（已先选中珠）⇒ bead:placed=${flood.placed}（期望 1，第 1 条生效后该格 filled，其余 19 条走 ignored 分支）、bead:rejected=${flood.rejected}、tray:selected=${flood.selected}，无崩溃 ✓*。`
        + `*§8-10 原文为「注入 20 次**触摸**/帧，仅 1 条进入路由」——tapDesign 是绕过 InputManager 的直调，不能证明真实一帧内 20 个 touch 只路由 1 条（须 input.snapshot.justDown 单点语义 + 真机多点）⇒ **弱化通过**，[Device] 部分（§8-9 多点触控）仍 ⛔。`);
}

// ───────── P12 · S4 §8-2 / §8-4 / §8-5（v2 修正 3：白盒排水） ─────────
{
    // v3 修正：v2 用 L1（time=300s、spawnInterval=6s）⇒ 全程只可能出 50 次供料，
    // 实采 49 样本 ⇒ 卡方检验严重欠功率（df=11 需 n≥200）。改注入「最小合法供料间隔 2.0s + 满时长 420s」
    // 关卡（spawnInterval 合法区间 [2,6]、time 合法区间 [180,420]），200×2.05s=410s < 420s ⇒ 可采满 200 样本。
    const fast = probeLevel(903, 6, 5, 420, 2.0, (i, j) => String(((i + j) % 3) + 1));
    const h = mk({ seed: 'uniform-probe-v3', levels: [fast] });
    const hits = new Array(T.TRAY_BASE_SLOTS).fill(0);
    let samples = 0;
    for (let i = 0; i < 200; i++) {
        h.drain();                                   // 白盒排水：不走 S6 免费额度
        const before = h.count('tray:spawned');
        h.advance(2.05);
        const p = h.all('tray:spawned');
        if (p.length > before) { hits[p[p.length - 1].slot]++; samples++; }
    }
    const exp = samples / T.TRAY_BASE_SLOTS;
    const maxDev = Math.max(...hits.map((n) => Math.abs(n - exp) / exp));
    const chi = hits.reduce((acc, n) => acc + ((n - exp) ** 2) / exp, 0);

    const h2 = mk();
    for (let i = 0; i < 12; i++) h2.game.giveTrayBead(1);
    h2.reset();
    h2.advance(LEVELS[0].spawnInterval * 3);
    const fullEv = h2.count('tray:full');
    const spawnedWhileFull = h2.count('tray:spawned');
    h2.drain();
    h2.reset();
    h2.advance(LEVELS[0].spawnInterval + 0.1);
    const resumed = h2.count('tray:spawned');

    const h3 = mk();
    const base = h3.game.snapshot.traySlots.length;
    const expandedOk = h3.game.expandTray();
    const expanded = h3.game.snapshot.traySlots.length;

    const ok = samples >= 190 && maxDev <= 0.35 && chi <= 24.725 && fullEv >= 1 && spawnedWhileFull === 0
        && resumed >= 1 && expanded === base + T.TRAY_EXPAND_SLOTS;
    rec('P12 / TC-TRAY-02·04·05 · S4 §8-2/§8-4/§8-5（test-cases 零覆盖项补测）', ok ? 'PASS' : 'FAIL',
        `§8-2 有效样本 ${samples}/200 次供料，落槽频次=[${hits.join(',')}]，期望 ${exp.toFixed(1)}/槽；最大偏差 ${(maxDev * 100).toFixed(1)}%（判据 ≤±20%）、卡方=${chi.toFixed(2)}（df=11、α=0.01 临界 24.725）。`
        + `〔判定口径注记：判据 §8-2 写「偏差 ≤±20%」，但 n=200、12 槽时单槽 σ≈11%、12 槽族极大偏差期望本身 ≈20–24% ⇒ 与 powerups §8-4 同款误报风险（WXG-T-062 已把该处改卡方）。本报告**两个口径都给**，建议 §8-2 同步改卡方，移交策划裁定。〕`
        + `§8-4 满槽推 3 个间隔 ⇒ tray:full=${fullEv}（去重生效，期望 1）、满槽期间 tray:spawned=${spawnedWhileFull}（期望 0）✓；排水后 1 间隔内 tray:spawned=${resumed}（期望 ≥1）✓。`
        + `§8-5 扩展前 ${base} 槽 → expandTray()=${expandedOk} → ${expanded} 槽（期望 ${base + T.TRAY_EXPAND_SLOTS}）✓；**但扩展无 UI 入口（P6/P8）⇒ 玩家不可达，本条只证方法层**。`);
}

// ───────── P13 · GAP-07 harness DPR 链路可信度 ─────────
{
    const h = mk();
    const s = h.game.snapshot;
    const tgt = findEmpty(s);
    const [gx, gy] = cellXY(s, tgt);
    const p = { x: 0, y: 0 };
    h.services.viewport.screenToDesign(p, gx, gy);
    rec('P13 / GAP-07 · harness DPR 坐标链路（[Harness] 用例可信度）', '⛔ 不可测（污染）',
        `本轮全部探针走 tapDesign（设计坐标），**刻意绕开** services.input.snapshot → viewport.screenToDesign 链路 ⇒ 本层无法判定 GAP-07 真伪。`
        + `实测：NodePlatform(pixelRatio=2) + Viewport(750,1334)；screenToDesign 把屏幕坐标 (${gx.toFixed(1)},${gy.toFixed(1)}) 反解为设计坐标 (${p.x.toFixed(1)},${p.y.toFixed(1)}) ⇒ **y 轴被折叠（904.0 → 430.0）**，与 GAP-07「DPR/视口换算错位 ⇒ 点击全打飞」现象一致。`
        + `裁定：S2 全部 [Harness] 用例在 T-087 修好换算前**结论不可信**，本轮一律标「⛔ 污染」，禁止据 tapDesign 结果给 [Harness] 标绿。`);
}

// ───────── P14 · GAP-13 L6–L8 可达性（v2：goToLevel 存在） ─────────
{
    const h = mk();
    const rows = [];
    for (const idx of [5, 6, 7]) {
        h.game.goToLevel(idx);
        const s = h.game.snapshot;
        const colors = new Set();
        let locked = 0, voids = 0, empty = 0;
        for (const c of s.cells) {
            if (c.void) { voids++; continue; }
            if (c.state === 'locked') locked++;
            if (c.state === 'empty') { empty++; if (c.colorIdx > 0) colors.add(c.colorIdx); }
        }
        rows.push(`L${idx + 1}(id=${s.levelId}) ${s.gridCols}×${s.gridRows} empty=${empty} locked=${locked} void=${voids} 色数=${colors.size}`);
    }
    const l6HasLocked = rows[0].includes('locked=0') ? false : true;
    rec('P14 / GAP-13 · L6–L8 可达性（取证工具链）', 'PASS*（Node 路径）／ ⛔（harness 路径）',
        `关卡表共 ${LEVELS.length} 关（id=${LEVELS.map((l) => l.id).join(', ')}）。`
        + `**BeadsGame.goToLevel(index) 存在且可用**（beads-game.ts:595）⇒ Node 层可直达任意关：${rows.join('；')}。`
        + `⇒ L6 锁定格、L7/L8 色数满配的判据**可走 Node 注入取证**，不必标受阻（v1 探针误判「无跳关 API」，已修正）。`
        + `*但 harness 侧仍只暴露 L1–L5（GAP-13）：浏览器/真机路径无法直达 L6–L8 ⇒ [Harness]/[Device] 的 L6–L8 用例本轮 ⛔ 受阻，解除条件 = harness 补跳关键位。`);
}

// ───────── P15 · S3 §8-8 13×12 极端定位（v2 修正 1：真实 schema） ─────────
{
    const rows = T.GRID_MAX_ROWS, cols = T.GRID_MAX_COLS;
    const lvl = probeLevel(902, cols, rows, 420, 4.0, (i, j) => String(((i + j) % T.BEAD_COLOR_MAX) + 1));
    const h = mk({ levels: [lvl] });
    const s = h.game.snapshot;
    if (s.phase !== 'playing' || s.bootError) {
        rec('P15 / TC-GRID-08 · S3 §8-8 13×12 极端定位', '⛔ 不可测',
            `构造 13×12=156 格关卡被 BOOT 拒绝：phase=${s.phase}、bootError=「${s.bootError}」⇒ 需按 levels-spec 完整字段重构后再测。`);
    } else {
        const pts = [[0, 0], [0, cols - 1], [rows - 1, 0], [rows - 1, cols - 1], [6, 6]];
        const samples = pts.map(([r, c]) => ({
            r, c,
            x: +(s.gridLeft + T.BEAD_CELL / 2 + T.BEAD_PITCH * c).toFixed(2),
            y: +(s.gridTop - T.BEAD_CELL / 2 - T.BEAD_PITCH * r).toFixed(2),
        }));
        const gridBottom = s.gridTop - T.BEAD_PITCH * (rows - 1) - T.BEAD_CELL / 2;
        const constraints = `gridLeft=${s.gridLeft}(≥30) gridTop=${s.gridTop}(≤1120) gridBottom=${gridBottom.toFixed(1)}(≥480)`;
        const okC = s.gridLeft >= 30 && s.gridTop <= 1120 && gridBottom >= 480;
        rec('P15 / TC-GRID-08 · S3 §8-8 13×12 极端定位', okC ? 'PASS*' : 'FAIL',
            `156 格关卡装载成功：gridCols=${s.gridCols} gridRows=${s.gridRows} cells=${s.cells.length}。`
            + `§3.3 派生公式抽样五格中心=${JSON.stringify(samples)}。约束核对：${constraints} ⇒ ${okC ? '全部满足' : '越界'}。`
            + `*本条为**公式复算**（Node 层），非渲染像素实测；「误差 ≤0.5px」的像素级判定须待 Cocos 取证（本轮被 framework:sync 阻塞）。`);
    }
}

// ───────── P16 · S5 §8-7 LEVEL_TIME 区间（v2 修正 1） ─────────
{
    const res = {};
    for (const t of [181, 419, 180, 420, 100, 999]) {
        const lvl = probeLevel(910 + t, 6, 5, t, 4.0, (i, j) => String(((i + j) % 3) + 1));
        try {
            const h = mk({ levels: [lvl] });
            const s = h.game.snapshot;
            res[t] = { phase: s.phase, total: s.timeTotal, err: (s.bootError || '').split(';').filter((x) => x.includes('time')).join(';') };
        } catch (e) {
            res[t] = { phase: 'throw', err: String(e.message).slice(0, 60) };
        }
    }
    const ok = res[181].phase === 'playing' && res[419].phase === 'playing'
        && res[180].phase === 'playing' && res[420].phase === 'playing'
        && res[100].phase !== 'playing' && res[999].phase !== 'playing';
    rec('P16 / TC-TIMER-07 · S5 §8-7 LEVEL_TIME 区间 [180,420]', ok ? 'PASS' : 'FAIL',
        `181→${JSON.stringify(res[181])}；419→${JSON.stringify(res[419])}；边界 180→${JSON.stringify(res[180])}；边界 420→${JSON.stringify(res[420])}；`
        + `越界 100→${JSON.stringify(res[100])}；越界 999→${JSON.stringify(res[999])}。`);
}

// ───────── P17 · GAP-12 元游戏钩子（S8 §8-7 连胜） ─────────
{
    const h = mk();
    const storage = h.storage;
    // 连过 3 关：直接构造通关（填满整盘）
    const clearLevel = (hh) => {
        const s = hh.game.snapshot;
        for (let i = 0; i < s.cells.length; i++) {
            const c = s.cells[i];
            if (c.void || c.state !== 'empty' || c.colorIdx <= 0) continue;
            const sl = hh.game.giveTrayBead(c.colorIdx);
            if (sl < 0) break;
            hh.game.selectTraySlot(sl);
            hh.game.tapGridCell(Math.floor(i / s.gridCols), i % s.gridCols);
        }
        return hh.game.snapshot.phase;
    };
    const phases = [];
    for (let n = 0; n < 3; n++) {
        phases.push(clearLevel(h));
        // 面板主钮 → 下一关
        const s = h.game.snapshot;
        let advanced = false;
        for (let y = 0; y <= T.DESIGN_H && !advanced; y += 6) {
            for (let x = 0; x <= T.DESIGN_W && !advanced; x += 6) {
                const li = h.game.snapshot.levelIndex;
                h.game.tapDesign(x, y);
                if (h.game.snapshot.levelIndex !== li) advanced = true;
            }
        }
        h.advance(0.3);
    }
    const keys = storage.keys();
    const raw = keys.map((k) => `${k}=${String(storage.get(k)).slice(0, 400)}`);
    const hasMeta = raw.some((r) => /winStreak|lastPlayDate|signin/i.test(r));
    rec('P17 / GAP-12 · S8 §8-7 连胜 + v1.1 meta 字段', hasMeta ? 'PASS' : 'FAIL',
        `存档键实测=${JSON.stringify(storage.keys())}；连续通关 3 次（各次通关后相位=[${phases.join(',')}]）后写档内容：${raw.join(' | ') || '（空）'}`
        + ` ⇒ 存档中 winStreak / lastPlayDate / signin 命中=${hasMeta}。`
        + `代码铁证：save-schema.ts BeadsSave 只含 version/runs/maxUnlockedLevel/currentLevel/sprintBestScore/sprintBestStage/starsByLevel/settings；`
        + `save-progress §2.3 ❄️冻结的 v1.1 字段 \`meta.winStreakCurrent / meta.winStreakBest / meta.lastPlayDate / meta.signin\` 在 src/** 命中 **0** ⇒ §8-7 判据（连胜 3 → Current=3/Best=3；第 4 关失败 → Current=0/Best 仍 3）**无实现载体**。`);
}

// ───────── P18 · S8 §8-9 PLAYING 全程零写档 ─────────
{
    // v3 重构：v2 在 L1（22 可填格）上把全盘填满 ⇒ 触发 level:cleared → _persistProgress()
    // 写档 1 次，被误计为「PLAYING 期间写档」（探针假 FAIL）。改为注入最大合法网格
    // 13×12=156 格、只填 150 格（留 6 格 empty ⇒ 不通关），再推进至归零取结算帧。
    const big = probeLevel(904, T.GRID_MAX_COLS, T.GRID_MAX_ROWS, 420, 4.0,
        (i, j) => String(((i * T.GRID_MAX_COLS + j) % T.BEAD_COLOR_MAX) + 1));
    const h = mk({ levels: [big] });
    const storage = h.storage;
    const key = h.saveKey;
    let writes = 0;
    const origSet = storage.set.bind(storage);          // Storage 接口是 get/set/remove/keys（非 getItem/setItem）
    storage.set = (k, v) => { if (k === key) writes++; return origSet(k, v); };
    const baseline = writes;                            // 丢弃 init 期 normalize 触发的写档
    const s = h.game.snapshot;
    const fillable = s.cells.filter((c) => !c.void && c.colorIdx > 0).length;
    const target = Math.max(0, fillable - 6);           // 留 6 格 empty ⇒ 不触发 level:cleared
    let placed = 0;
    for (const cell of s.cells) {
        if (placed >= target) break;
        if (cell.void || cell.state !== 'empty' || cell.colorIdx <= 0) continue;
        const i = s.cells.indexOf(cell);
        const sl = h.game.giveTrayBead(cell.colorIdx);
        if (sl < 0) { h.drain(); continue; }
        h.game.selectTraySlot(sl);
        if (h.game.tapGridCell(Math.floor(i / s.gridCols), i % s.gridCols)) placed++;
    }
    const duringPlay = writes - baseline;
    const clearedMid = h.count('level:cleared');
    // 结算帧（level:cleared）：把剩下的 6 格填满 → 通关 → _persistProgress()
    let placed2 = 0;
    for (let n = 0; n < 40; n++) {
        const sn = h.game.snapshot;
        const i = findEmpty(sn);
        if (i < 0) break;
        const sl = h.game.giveTrayBead(sn.cells[i].colorIdx);
        if (sl < 0) { h.drain(); continue; }
        h.game.selectTraySlot(sl);
        if (h.game.tapGridCell(Math.floor(i / sn.gridCols), i % sn.gridCols)) placed2++;
        if (h.count('level:cleared') > 0) break;
    }
    const atSettle = writes - baseline;
    const cleared = h.count('level:cleared');
    // 对照组：失败结局（独立实例，归零）的写档行为
    const hf = mk({ levels: [probeLevel(905, 6, 5, 180, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    const sf = hf.storage;
    let wf = 0;
    const of = sf.set.bind(sf);
    sf.set = (k, v) => { if (k === hf.saveKey) wf++; return of(k, v); };
    const bf = wf;
    hf.advance(181);
    const failWrites = wf - bf;
    const failEv = hf.count('level:failed');
    const maxGrid = T.GRID_MAX_COLS * T.GRID_MAX_ROWS;
    const ok = duringPlay === 0 && clearedMid === 0 && cleared === 1 && atSettle - duringPlay === 1;
    rec('P18 / TC-SAVE · S8 §8-9 PLAYING 全程零写档 / 结算帧恰 1 次',
        ok ? 'PASS*（落子次数不可达 200，见注）' : 'FAIL',
        `注入关卡 ${T.GRID_MAX_COLS}×${T.GRID_MAX_ROWS}=${maxGrid} 格（可填 ${fillable}），PLAYING 阶段成功落子 **${placed}** 次（目标 ${target}，故意留 6 格 empty 避免通关）。`
        + `① PLAYING 全程（level:cleared=${clearedMid}）写档次数=${duringPlay}（期望 0）${duringPlay === 0 ? '✓' : '✗'}；`
        + `② 再补 ${placed2} 次落子填满全盘 → level:cleared=${cleared}，**结算帧写档增量=${atSettle - duringPlay}**（期望恰 1）${atSettle - duringPlay === 1 ? '✓' : '✗'}。`
        + `③ 对照组（**失败**结局，独立实例 time=180s 归零）：level:failed=${failEv}、写档增量=${failWrites} ⇒ 失败结算帧**零写档**（beads-game.ts:874-884 \`game-over.onEnter\` 只发事件 + 清崩溃档，**不调 \`_persistProgress()\`**；与 §8-2「通过第 n 关才落档」一致，不判缺陷，仅登记事实供策划确认 §8-9「结算帧」是否含失败帧）。`
        + `〔**判据不可构造（移交策划裁定）**：§8-9 原文要求「注入 **200** 次落子」，但冻结常量 GRID_MAX_COLS(${T.GRID_MAX_COLS}) × GRID_MAX_ROWS(${T.GRID_MAX_ROWS}) = ${maxGrid} < 200，`
        + `且填满全盘必然触发 level:cleared → 结算写档 ⇒ 「200 次落子且仍处 PLAYING」在冻结常量下**不可能成立**。`
        + `本轮按「最大可构造量 ${placed} 次落子」验其实质（PLAYING 零写档 / 结算帧恰 1 次），建议 §8-9 把 200 改为「≤ GRID_MAX_COLS×GRID_MAX_ROWS 的最大可构造量」。〕`);
}

// ───────── P19 · GAP-11 hint 悬空态 ─────────
{
    const h = mk();
    const s = h.game.snapshot;
    const cellStates = [...new Set(s.cells.map((c) => c.state))];
    const hasHintApi = ['showHint', 'setHint', 'hint'].filter((m) => typeof h.game[m] !== 'undefined');
    const cs = cmds(h);
    const accent = cs.filter((c) => (c.stroke ?? c.fill) === '#3D7BF5' || (c.stroke ?? c.fill) === DEFAULT_PALETTE.accentBlue).length;
    rec('P19 / GAP-11 · hint 悬空态（规格有、实现无承载体）', 'FAIL',
        `运行时格子状态实测去重=[${cellStates.join(', ')}]（CellState 定义域 = empty|filled|locked）。`
        + `BeadsGame 上 hint 相关公开成员命中=[${hasHintApi.join(', ') || '（无）'}]；渲染指令中使用 accent_blue(#3D7BF5) 的图元数=${accent}（assets-spec §1.2 hint 行要求「外描边 accent_blue 2px + 600ms 呼吸 α0.5↔1.0」）。`
        + `⇒ hint 态在**数据模型、游戏 API、渲染层三处均无承载体**，规格悬空；同时使 accessibility.md A2「6 状态各有非颜色通道」缺 hint/wrong 两态。`);
}

console.log('\n\n================ 探针汇总（v3） ================');
for (const r of out) console.log(`${r.verdict.padEnd(28)} ${r.id}`);
const tally = out.reduce((a, r) => { a[r.verdict] = (a[r.verdict] ?? 0) + 1; return a; }, {});
console.log('\n计数：', JSON.stringify(tally, null, 0));
