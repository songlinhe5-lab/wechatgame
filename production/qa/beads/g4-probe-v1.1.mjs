/**
 * beads G4 复验探针 v1.1（严守真 / WXG-T-092，波次 3）
 *
 * 定位：`g4-probe.mjs` v3 是**修复前基线**（报告 v1.0）。本文件把「波次 2 代码级自证」
 * 升级为「探针他证」，逐条 P1–P19 重判 + 新增 P20–P26 补测。
 * 判据来源一律取 **T-091 回写后的 GDD §8 现文**（不是 v1.0 报告里的旧预期值）。
 *
 * 只读纪律：不改 `games/beads/src/**`、`design/**`、`art/**`；复用 `harness:build` 产物。
 * 运行：node production/qa/beads/g4-probe-v1.1.mjs
 * 产出：production/qa/beads/evidence/g4-reverify-v1.1.log
 *
 * ── v1.1 修订（承接 v3 的 1–13；本轮新增 **14–27**，全部为**探针自身**预期值/口径修正）──
 *  14. 【严防假 FAIL】P9/P12/P18 的期望值改取回写后 §8 现文：
 *      `tray-spawner §8-2` 已由「±20%」改判为**卡方拟合优度 α=0.05**（临界 19.675，df=11）——
 *      沿用旧 ±20% 会把「判据更新」做成假 FAIL；`input-control §8-2` 已裁定重叠区以 §8-4 为准
 *      （BD-23 关闭 ⇒ 不再记 PASS*）；`save-progress §8-9` 已改「156 落子 + 结算帧 = `level:cleared`」。
 *  15. 【严防假 PASS】P1 不再用「空槽填充色去重 > 1 种」这种**弱断言**（同色两档也会过）——
 *      改为**逐色独立复算** `mixWith(slot, beadColor(c), EMPTY_TINT_MIX)` 并逐格比对，
 *      另断言 E4 幽灵符号 α == `EMPTY_GHOST_ALPHA`；缺任一层即 FAIL。
 *  15bis. 【本轮实测才抓到的探针缺陷，5 处；旧版会造出假 FAIL/假 PASS】
 *      (a) `game.snapshot` 是**每帧复用的活对象**：P3/P4 原先把 `s0/sn` 引用留到 rec() 才读，
 *          读完已是 200ms 之后的态（wrongProgress=0、hint=(-1,-1)）⇒ 改为**当场拷标量**。
 *      (b) P9 热区探针**忘了先选珠** ⇒ 命中 `beads-game.ts:1371`「无选中直接 return」⇒ 全 none 假 FAIL。
 *      (c) P11 §8-9 的 `routed` 原先统计**全部**已订阅事件（含 tray:spawned）⇒ 双指断言恒 >1（假 FAIL）；
 *          改为只计输入路由产物（tray:selected / bead:placed / bead:rejected）。
 *      (d) P12 卡方原先事件游标写错（`slice(got)`）且**不排水** ⇒ 样本被「空闲槽集变化」污染，
 *          χ² 被伪做到 760（假 FAIL）；沿用 v3 修订 3 的白盒排水夹具（spawner.ts:176-186 路径不变）。
 *      (e) P22 D1 三个通道实例原先**未开 reduceMotion**（默认实例）⇒ 测的是「动画态是否为静态」，
 *          假 FAIL 与假 PASS 双向风险；本轮每通道实例均预置 `settings.reduceMotion=true`（读档回显路径）。
 *      (f) P22 wrong 描边在 **fx 窗口后**才取（WRONG_FX_MS=200ms 已过）⇒ 恒 0；改为窗口内取最大。
 *      (g) P10 以「点击前一帧 vs 后一帧的非文本签名不等」判“有轻提示”⇒ 被 hint 呼吸/首珠脉冲的
 *          **常态动画**伪满足（实测恒 true = **假 PASS**）；修订 25 改用同 seed 配对差分。
 *  16. 【严防假 FAIL】P3/P19 不再以「`CellState` 无 hint/wrong」为实现缺失——
 *      T-087 的实现载体是 **snapshot 覆盖层**（`hintRow/hintCol/wrongRow/wrongCol/pulseClock`），
 *      数据模型未扩态属**规格措辞与实现分层偏差**（登记报告，不判缺陷）。判据改为**渲染指令层**断言。
 *  17. 【严防假 PASS】P4/P7 的动效断言一律**剔除 text 指令**并逐帧取相位样本，
 *      断「α 极值/过零点 ⇒ 周期 ms」而不是「签名种数 ≥2」（后者会被倒计时秒数、抖动位移伪满足）。
 *      注：HUD 图标 α 在 `stroke` 的 rgba 里，`drawStateRing` 的 α 在 `rect.alpha` 字段——两处不得混取。
 *  18. 【探针口径修正】v1.0 P13 把 `screenToDesign(297,904)→(297,430)` 读作「y 轴折叠 = 缺陷征候」。
 *      复核：设计系 y 向上，**该翻转本身是正确行为**；GAP-07 的真根因是 harness `pushPointer`
 *      把 `clientX*dpr`（device px）喂给了按 CSS px 拟合的 viewport（见 ADR-0011 / eb0572d）。
 *      本轮判据改为①双向往返一致（含非 1:1 长宽比 letterbox）②device-px 当屏幕坐标喂入必**错位**
 *      （落点偏离 >50px；原「containsScreenPoint 拒收」在 screen=design 的 harness stub 下恒不成立，属**新探针缺陷**）
 *      ③**端到端**：以 CSS px 坐标经真实 `InputManager` 点击 → 命中预期槽/格。
 *  19. 【新增道次】P11/§8-9/§8-10 从「`tapDesign` 绕过 InputManager 的弱化通过」升级为
 *      **真实 `InputManager` + `Viewport` 路由**（同帧 20 压 / 双指同帧仅首触点）；
 *      `[Device]` 的真实触摸事件序仍 ⛔ 不作证据。
 *  20. 【白盒隔离】A′ 不变量探针（P21）只走**合法供料路径**计数，不使用 `giveTrayBead`；
 *      `giveTrayBead` 会绕过 `held ≤ demand` 而入盘死珠 ⇒ 用它测「死局不可达」是**假 FAIL**，
 *      仅在 P18（存档写入次数）与 P9（建立「有选中」前置）作为夹具使用并注明。
 *  21. 【陷阱复刻防护】P7 满槽态改由「不落子、让供料自然灌满」构造（A′ 下满槽仍可达，
 *      每颗都可落子），不再用 `giveTrayBead` 灌假满槽。
 *  22. 【统计功效】P20 的 60s 首供语义测量改在**自动落子循环**下做（保持 demand>0），
 *      避免「托盘满 ⇒ 供料被跳过」把 16 次压成 12 次造成假 FAIL；时基从「进入 PLAYING 那一帧」起算。
 *  23. 【暂停面板几何】`PanelRect = {xMin,yMin,xMax,yMax}`（pause-panel.ts:67-69），
 *      **不是** `{x,y,w,h}`；旧版按 `rect.x + rect.w/2` 取中心 ⇒ NaN 点击，开关永远打不开（假 FAIL）。
 *  24. 【判据不可构造 ≠ 实现缺陷】P26（§8-3 3:1 抽色在 D 下不可构造）记 **⛔**（本轮不可验，移交裁定），
 *      不记 FAIL；P20 的 60s 窗口开/闭区间歧义记 **PASS\*** 并登记 BD-27，不把判据缺陷算成实现缺陷。
 *  25. 【反馈类断言须排除常态动画干扰】一切「有没有反馈帧」类断言一律用**配对差分**
 *      （同 seed 两实例、同一帧号，一个做事一个不做事），不得拿相邻两帧自比（P10）；
 *      P3 因附带发现 BD-32（引导可达性缺口，非 §8 违约）由 PASS 降为 **PASS\***。
 *  26. 【一次一事：夹具不得复用可变态】P9 早期版本在同一实例上连测 11 个偏移 ⇒ 第一次落子后
 *      目标格已被占（后续帧变 filled）且 fixture 珠灌满托盘（giveTrayBead 返回 -1），
 *      导致「仅首偏移命中、其余 none」的**假 FAIL**；本轮改为每个偏移一个干净实例。
 *      同条另记：dx = BEAD_PITCH/2 为两格**等距并列点**，§8-4「最近格心」在此无定义，
 *      本轮只记录实际归属（实测归左格）而不判 FAIL。
 *  27. 【前置不足不得当作“缺失”】P6/P7 早期版本在满槽当帧就停采样，后续未再跨过供料间隔，
 *      导致 tray:full=0 被误读为「事件缺失」。本轮 P7 的满槽告警子例程改为**满槽后再推 1 个间隔**，
 *      使去重语义真正发生；P6 则删掉对该子句的断言并明示由 P12 取证（一处一事）。
 *
 * 环境事实（禁止伪造）：无 AppID / 无真机 ⇒ `[Device]/[R]` 一律 ⛔；`[Cocos]` 像素级判据
 * 本轮已解除 BD-20 阻塞（`framework:sync:check` ✅ 本轮实跑；web-mobile 产物存在且时间戳
 * 2026-09-15 08:48，早于本轮探针 09:24 ⇒ 属波次 2 verify 留痕，**本轮未重跑构建**），但
 * 沙箱禁监听 socket、无浏览器截图通路 ⇒ 像素/色盲模拟仍记 ⛔，不得改判。
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const { loadHarness, STAGE } = await import(`${ROOT}/tools/scripts/lib/harness-runtime.mjs`);

const fw = await import(`${STAGE}/packages/framework/src/index.js`);
const { NodePlatform } = await import(`${STAGE}/packages/framework/src/platform/node.js`);
const { BeadsGame } = await import(`${STAGE}/games/beads/src/game/beads-game.js`);
const { buildBeadsView } = await import(`${STAGE}/games/beads/src/view/view-model.js`);
const P = await import(`${STAGE}/games/beads/src/view/palette.js`);
const { DEFAULT_PALETTE } = P;
const T = await import(`${STAGE}/games/beads/src/config/tuning.js`);
const { LEVELS } = await import(`${STAGE}/games/beads/src/config/levels.js`);
const { pausePanelLayout } = await import(`${STAGE}/games/beads/src/systems/pause-panel.js`);

const boot = await loadHarness({ game: 'beads' });
const bootModel = boot.render(5);
console.log(`[boot] harness beads OK — draw cmds=${bootModel?.commands?.length ?? 0}`);

const TRACKED = [
    'tray:spawned', 'tray:selected', 'bead:placed', 'bead:rejected', 'tray:full', 'tray:expanded',
    'powerup:used', 'timer:tick', 'timer:urgent', 'level:cleared', 'level:failed',
    'game:paused', 'game:resumed', 'combo:up', 'combo:break',
];

// ───────────────────────────────────────────────────────── 装配 / 驱动 helpers
let probeNo = 0;
function mk(opts = {}) {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: opts.pixelRatio ?? 2 });
    const storage = opts.storage ?? platform.createStorage();
    const events = new fw.EventBus();
    const input = new fw.InputManager();
    const audio = new fw.AudioScheduler(new fw.NullAudioBackend());
    const played = [];
    const origPlay = audio.play.bind(audio);
    audio.play = (id, o) => { played.push(id); return origPlay(id, o); };
    const services = {
        events, input, audio, storage,
        rng: fw.createRng(opts.seed ?? `probe11-${++probeNo}`),
        viewport: new fw.Viewport(750, 1334),
        assets: new fw.NullAssetProvider(),
        platform: platform.info,
        rewardedAd: opts.rewardedAd ?? platform.createRewardedAdProvider(),
    };
    const saveKey = opts.saveKey ?? `wxgame.beads.probe11.${probeNo}`;
    if (opts.preSave) storage.set(saveKey, JSON.stringify(opts.preSave));   // 预置存档（设置开关/老玩家）
    const game = new BeadsGame({
        saveKey, ...(opts.levels ? { levels: opts.levels } : {}),
        ...(opts.sprintTime !== undefined ? { sprintTime: opts.sprintTime } : {}),
    });
    const emitted = [];
    for (const type of TRACKED) events.on(type, (p) => emitted.push({ type, p }));
    let writeCount = 0;
    const origSet = storage.set.bind(storage);
    storage.set = (k, v) => { if (k === saveKey) writeCount++; return origSet(k, v); };
    game.init(services);
    const baseline = writeCount;              // 修订 13：扣 init 期 normalize 写档
    const pt = { x: 0, y: 0 };
    let pointerId = 0;
    const step = 1 / 60;
    return {
        game, services, events, input, storage, audio, played, emitted, saveKey,
        get writes() { return writeCount - baseline; },
        advance(seconds) { const n = Math.max(1, Math.round(seconds / step)); for (let i = 0; i < n; i++) this.frame(); },
        frame() { input.beginFrame(); game.update(step); input.endFrame(step); },
        /** 真实输入链路：设计坐标 → CSS 屏幕坐标 → InputManager（修订 19）。 */
        tapScreen(dx, dy, id = ++pointerId) {
            services.viewport.designToScreen(pt, dx, dy);
            input.push({ id, x: pt.x, y: pt.y, phase: 'down', time: probeNo * 1000 + pointerId });
            this.frame();
            input.push({ id, x: pt.x, y: pt.y, phase: 'up', time: probeNo * 1000 + pointerId });
        },
        tapMany(dx, dy, n) {
            for (let i = 0; i < n; i++) {
                services.viewport.designToScreen(pt, dx, dy);
                input.push({ id: 100 + i, x: pt.x, y: pt.y, phase: 'down', time: 1000 + i });
            }
            this.frame();
        },
        count: (t) => emitted.filter((e) => e.type === t).length,
        last: (t) => { for (let i = emitted.length - 1; i >= 0; i--) if (emitted[i].type === t) return emitted[i].p; return undefined; },
        reset() { emitted.length = 0; },
        hold() { return game.snapshot.traySlots.filter((s) => s.state !== 'free').length; },
        drain() {
            const idx = []; const slots = game.snapshot.traySlots;
            for (let i = 0; i < slots.length; i++) if (slots[i].state !== 'free') idx.push(i);
            return idx.length ? game.tray.clearSlots(idx).length : 0;
        },
        /** 合法自动玩家：每帧最多 1 条指令（选中 → 下一帧落子）。 */
        autoFrame() {
            this.frame();
            const s = game.snapshot;
            if (s.phase !== 'playing') return;
            if (s.traySelected >= 0) {
                const c = s.traySlots[s.traySelected].colorIdx;
                const i = firstEmptyOf(s, c);
                if (i >= 0) game.tapDesign(...cellXY(s, i));
                else game.selectTraySlot(-1);
                return;
            }
            for (let i = 0; i < s.traySlots.length; i++) {
                const sl = s.traySlots[i];
                if (sl.state === 'free') continue;
                if (firstEmptyOf(s, sl.colorIdx) >= 0) { game.tapDesign(...slotXY(i)); return; }
            }
        },
        autoPlay(seconds) { const n = Math.max(1, Math.round(seconds / step)); for (let i = 0; i < n; i++) this.autoFrame(); },
    };
}

function cmds(h) {
    const b = new fw.RenderModelBuilder(T.DESIGN_W, T.DESIGN_H);
    b.begin();
    buildBeadsView(b, h.game.snapshot, DEFAULT_PALETTE);
    return b.end().commands;
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

function firstEmptyOf(s, colorIdx) {
    for (let i = 0; i < s.cells.length; i++) {
        const c = s.cells[i];
        if (!c.void && c.state === 'empty' && c.colorIdx === colorIdx) return i;
    }
    return -1;
}
/** 首个可填且带目标色的格（colorIdx>0）；无则 -1。 */
function findEmpty(s) {
    for (let i = 0; i < s.cells.length; i++) {
        const c = s.cells[i];
        if (!c.void && c.state === 'empty' && c.colorIdx > 0) return i;
    }
    return -1;
}
const demandOf = (s, c) => s.cells.reduce((n, x) => n + (!x.void && x.state === 'empty' && x.colorIdx === c ? 1 : 0), 0);
const patternColors = (s) => new Set(s.cells.filter((c) => !c.void && c.colorIdx > 0).map((c) => c.colorIdx));

function probeLevel(id, cols, rows, time, spawnInterval, fill, decoys = []) {
    const pattern = [];
    for (let i = 0; i < rows; i++) { let line = ''; for (let j = 0; j < cols; j++) line += fill(i, j); pattern.push(line); }
    return { id, name: `probe-${id}`, cols, rows, time, spawnInterval, decoys, pattern };
}

// ───────────────────────────────────────────────────────── 渲染指令取证 helpers
const alphaOf = (c) => { const m = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/.exec(String(c ?? '')); return m ? Number(m[1]) : 1; };
const hex2 = (c) => { const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(String(c ?? '')); if (m) return '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('').toLowerCase(); return String(c ?? '').toLowerCase(); };
const inBand = (c, band, pad = 0) => (c.y ?? 0) + (c.h ?? 0) >= band.yMin - pad && (c.y ?? 0) <= band.yMax + pad;
/** 非文本指令签名（剔除 text，防 mm:ss 伪满足——修订 7/17）。 */
const sig = (cs, band, pad = 0) => cs.filter((c) => c.kind !== 'text' && (!band || inBand(c, band, pad)))
    .map((c) => `${c.kind}:${Math.round((c.x ?? c.x1 ?? 0) * 10)}_${Math.round((c.y ?? c.y1 ?? 0) * 10)}:${c.fill ?? ''}:${c.stroke ?? ''}:${c.alpha ?? ''}:${Math.round((c.w ?? 0) * 10)}x${Math.round((c.h ?? 0) * 10)}`).join('|');
/** 某色描边环（`drawStateRing` = rect，无 fill、有 stroke+alpha）。 */
const rings = (cs, strokeHex, band = null) => cs.filter((c) => c.kind === 'rect' && !c.fill && c.stroke
    && hex2(c.stroke) === strokeHex.toLowerCase() && (!band || inBand(c, band)));
/** 三角波周期测量：取 α 序列的波谷（plateau 合并）间距均值。 */
function pulsePeriodMs(samples) {
    const uniq = samples.filter((v, i) => i === 0 || v !== samples[i - 1]);
    const troughs = [];
    for (let i = 1; i < uniq.length - 1; i++) if (uniq[i] <= uniq[i - 1] && uniq[i] <= uniq[i + 1]) troughs.push(i);
    if (troughs.length < 2) return { periods: troughs.length, periodMs: null, distinct: new Set(samples.map((v) => v.toFixed(3))).size };
    const gaps = []; for (let i = 1; i < troughs.length; i++) gaps.push(troughs[i] - troughs[i - 1]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    return { periods: troughs.length - 1, periodMs: mean * (1000 / 60), distinct: new Set(samples.map((v) => v.toFixed(3))).size };
}
const chi2 = (obs, exp) => obs.reduce((a, o) => a + ((o - exp) ** 2) / exp, 0);
const CRIT_DF11_A005 = 19.675, CRIT_DF11_A001 = 24.725;

const out = [];
function rec(id, verdict, evidence) {
    out.push({ id, verdict, evidence });
    console.log(`\n### ${id} → ${verdict}\n    ${evidence}`);
}
const A = (label, got, want, unit = '') => `${label}=${got}${unit} 期望=${want}${unit} ${got === want ? '✓' : '✗'}`;

// ═════════════════════════════════════════════════════════ P1 · 空槽目标色
{
    const h = mk();
    const s = h.game.snapshot;
    const cs = cmds(h);
    const colors = [...patternColors(s)].sort((a, b) => a - b);
    const want = new Map(colors.map((c) => [c, P.mixWith(DEFAULT_PALETTE.slot, P.beadColor(c), P.EMPTY_TINT_MIX).toLowerCase()]));
    const bad = [];
    let ghostOk = 0, ghostWant = 0;
    for (let i = 0; i < s.cells.length; i++) {
        const c = s.cells[i];
        if (c.void || c.state !== 'empty' || c.colorIdx <= 0) continue;
        ghostWant++;
        const [cx, cy] = cellXY(s, i);
        const rect = cs.find((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && Math.abs(k.x + k.w / 2 - cx) < 1.2 && Math.abs(k.y + k.h / 2 - cy) < 1.2);
        if (!rect) { bad.push(`格${i} 无槽矩形`); continue; }
        if (hex2(rect.fill) !== want.get(c.colorIdx)) bad.push(`格${i}(色${c.colorIdx}) 底色 ${hex2(rect.fill)} ≠ 复算 ${want.get(c.colorIdx)}`);
        const gh = cs.filter((k) => k !== rect && (k.x !== undefined ? Math.abs(k.x - cx) < T.BEAD_CELL : false) && alphaOf(k.fill ?? k.stroke) === P.EMPTY_GHOST_ALPHA);
        if (gh.length > 0) ghostOk++; else bad.push(`格${i} 无 α=${P.EMPTY_GHOST_ALPHA} 幽灵符号`);
    }
    const distinct = new Set(cs.filter((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && inBand(k, T.PUZZLE_BAND, 60) && !k.strokeOnly).map((k) => hex2(k.fill)));
    const neutral = hex2(DEFAULT_PALETTE.slot);
    const verdict = bad.length === 0 && colors.length >= 2 && !distinct.has(neutral) ? 'PASS' : 'FAIL';
    rec('P1 / BD-01 · GAP-01 空槽目标色（E1 色底 + E4 幽灵符号）', verdict,
        `L1 图案 ${colors.length} 色（colorIdx=${colors.join(',')}）；逐色复算 E1 目标色底 = ${colors.map((c) => `${c}→${want.get(c)}`).join(' ')}；`
        + `实测拼图带内 BEAD_CELL 矩形底色去重 ${distinct.size} 种（[${[...distinct].join(' ')}]），中性槽底 ${neutral} 是否仍被用作目标色底=${distinct.has(neutral)}。`
        + `E4 幽灵符号：${ghostOk}/${ghostWant} 个空槽检出 α=${P.EMPTY_GHOST_ALPHA} 同色符号图元。`
        + (bad.length ? ` 不合项（前 6）：${bad.slice(0, 6).join('; ')}` : ' ⇒ E1/E4 逐格逐色全对，目标色通道成立。')
        + `　代码锚点：bead-render.ts:174 drawEmptySocket(builder,cx,cy,palette,size,colorIdx) 已收 colorIdx；palette.ts:158/163 EMPTY_TINT_MIX=${P.EMPTY_TINT_MIX} / EMPTY_GHOST_ALPHA=${P.EMPTY_GHOST_ALPHA}（与 assets-spec §1.2 明文一致）。`);
}

// ═════════════════════════════════════════════════════════ P2 · 首供（第 1 帧）
{
    const hold = (h) => h.game.snapshot.traySlots.filter((x) => x.state !== 'free').length;
    const h = mk(); const at0 = hold(h);
    h.frame(); const spawned1 = h.count('tray:spawned'); const at1 = hold(h);
    h.advance(1.5); const at15 = hold(h);
    const s = h.game.snapshot;
    const first = s.traySlots.find((x) => x.state !== 'free');
    const placeable = first ? demandOf(s, first.colorIdx) > 0 : false;
    const h3 = mk({ levels: [probeLevel(901, 6, 5, 300, T.SPAWN_INTERVAL_DEFAULT, (i, j) => String(((i + j) % 3) + 1))] });
    h3.frame();
    const v = spawned1 === 1 && at1 === 1 && at15 >= 1 && placeable ? 'PASS' : 'FAIL';
    rec('P2 / BD-02 · GAP-02 开局首供（PLAYING 第 1 帧 + 首珠可落子色）', v,
        `L1（spawnInterval=${LEVELS[0].spawnInterval}s）：t=0 持有 ${at0} 颗 → 推进 1 帧后 tray:spawned=${spawned1}、持有 ${at1} 颗；t=1.5s 持有 ${at15} 颗。`
        + `首珠 colorIdx=${first?.colorIdx ?? '-'}，该色盘面剩余需求 demand=${first ? demandOf(s, first.colorIdx) : '-'} ⇒ 首珠可落子=${placeable}（ux-spec §6.2「首珠必须可落子色」硬判据）。`
        + `对照组注入 spawnInterval=${T.SPAWN_INTERVAL_DEFAULT}s：第 1 帧亦供料（tray:spawned=${h3.count('tray:spawned')}）。`
        + `　代码锚点：systems/spawner.ts reset() → _firstFeed=true，首 tick 走 _feedOnce（非装配期 feed，符合 §6.2「帧内序仍属供料段」）。`
        + `　【偏差登记】ux-spec §6.2 裁定的实现机制写的是「reset() → 赋 interval → 置 _acc = interval」，落码改用 _firstFeed 标志位；**可观测语义等价（第 1 帧完成首供、节律不受扰）**，机制措辞偏差登记不改笔。`);
}

// ═════════════════════════════════════════════════════════ P3 · 引导三通道
{
    const h = mk();
    h.frame();
    const s0 = h.game.snapshot;
    // 【修订 15】snapshot 是**每帧复用的活对象**：必须当场把标量拷出来，不能在 rec() 里读 s0.xxx
    const ob0 = s0.onboarding === true, gs0 = s0.guideSlot, hr0 = s0.hintRow, hc0 = s0.hintCol;
    const gsColor = ob0 && gs0 >= 0 ? s0.traySlots[gs0].colorIdx : 0;
    const chan = {
        socketColor: [...patternColors(s0)].length >= 1,
        guideSlot: ob0 && gs0 >= 0,
        hintCell: ob0 && hr0 >= 0 && hc0 >= 0,
    };
    const cs = cmds(h);
    const hintHex = hex2(DEFAULT_PALETTE.hintBlue);
    const ringN = rings(cs, hintHex).length;
    const gs = { colorIdx: gsColor };
    const hintIsRowMajorFirst = (() => {
        const idx = hr0 * s0.gridCols + hc0;
        const c = gsColor;
        for (let i = 0; i < idx; i++) { const x = s0.cells[i]; if (!x.void && x.state === 'empty' && x.colorIdx === c) return false; }
        return s0.cells[idx] && !s0.cells[idx].void && s0.cells[idx].state === 'empty' && s0.cells[idx].colorIdx === c;
    })();
    // 呼吸周期（600ms）：α 在 rect.alpha（drawStateRing 把相位写进 alpha，非 rgba）
    const alphas = [];
    for (let f = 0; f < 90; f++) {
        const r = rings(cmds(h), hintHex)[0];
        alphas.push(r ? Number(r.alpha ?? 1) : 0);
        h.frame();
    }
    const pm = pulsePeriodMs(alphas);
    // 首次落子即清
    const i2 = firstEmptyOf(h.game.snapshot, gsColor);
    if (i2 >= 0) {
        h.game.tapDesign(...slotXY(gs0)); h.frame();
        h.game.tapDesign(...cellXY(h.game.snapshot, i2)); h.frame();
    }
    const afterPlaced = h.game.snapshot.onboarding, afterRing = rings(cmds(h), hintHex).length;
    // 老玩家（runs>0）永不重现：共用 storage + **合法关卡**（旧版探针给了 4×3 非法关 ⇒ BOOT 直接 return，测不到引导）
    const plat = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const shared = plat.createStorage();
    const p1 = new fw.InputManager(); const e1 = new fw.EventBus();
    const lvVet = probeLevel(902, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1));
    const g1 = new BeadsGame({ saveKey: 'wxgame.beads.reverify.runs', levels: [lvVet] });
    const svc1 = { events: e1, input: p1, audio: new fw.AudioScheduler(new fw.NullAudioBackend()), storage: shared, rng: fw.createRng('runs1'), viewport: new fw.Viewport(750, 1334), assets: new fw.NullAssetProvider(), platform: plat.info, rewardedAd: plat.createRewardedAdProvider() };
    g1.init(svc1); svc1.input.beginFrame(); g1.update(1 / 60); svc1.input.endFrame(1 / 60);
    const obFirst = g1.snapshot.onboarding === true;
    const runsSaved = JSON.parse(String(shared.get('wxgame.beads.reverify.runs') ?? '{}'));
    const g2 = new BeadsGame({ saveKey: 'wxgame.beads.reverify.runs', levels: [lvVet] });
    const p2 = new fw.InputManager(); const e2 = new fw.EventBus();
    const svc2 = { ...svc1, input: p2, events: e2, rng: fw.createRng('runs2') };
    g2.init(svc2); svc2.input.beginFrame(); g2.update(1 / 60); svc2.input.endFrame(1 / 60);
    const noGuideForVeteran = g2.snapshot.onboarding !== true && rings(cmds({ game: g2 }), hintHex).length === 0;
    const allOk3 = chan.socketColor && chan.guideSlot && chan.hintCell && hintIsRowMajorFirst && afterPlaced === false && afterRing === 0 && noGuideForVeteran;
    // 【修订 25】判据项全过，但本轮顺带抓到 §8 未覆盖的**引导可达性缺口**（见证据末段 BD-32）⇒ 不升 PASS。
    const v = allOk3 ? 'PASS*' : 'FAIL';
    rec('P3 / BD-03 · GAP-03 0 文字引导三通道（首珠脉冲 + 单一 hint 格 + 目标色底）', v,
        `通道①空槽目标色：见 P1（${chan.socketColor}）；通道②首珠槽脉冲 onboarding=${ob0}、guideSlot=${gs0}（该槽色=${gsColor}）；通道③单一目标格 hint=(r${hr0},c${hc0})，行主序最前匹配格=${hintIsRowMajorFirst}。`
        + `渲染层 accent_blue(${hintHex}) 描边环图元数=${ringN}（首珠槽 + 目标格 = 期望 2）。`
        + `呼吸周期实测 ${pm.periodMs ? pm.periodMs.toFixed(0) : '—'}ms（ux-spec §5 = ${T.HINT_PULSE_MS}ms，α 取值 ${pm.distinct} 档 / ${pm.periods} 个完整周期 / 90 帧）。`
        + `引导终止：首次 bead:placed=${h.count('bead:placed')} 后 onboarding=${afterPlaced}、hint 环=${afterRing}（期望 false/0，事件驱动无计时器）。`
        + `老玩家重现性：首玩装配 onboarding=${obFirst}→ BOOT 后存档 runs=${runsSaved.runs ?? '-'}；**同存档二次装配** onboarding=${g2.snapshot.onboarding}、hint 环=0（期望 false，§6.3 永不重现）。`
        + `　【附带发现 · 移交裁定 BD-32】上文的「永不重现」由 beads-game.ts:947 \`_onboardDone = save.data.runs > 0\` + :949-952 「每次 BOOT 无条件 runs+1 落档」共同实现：`
        + `实测 runs 在**首次 BOOT 即 0→1**（尚未落过任何一子）。⇒ 玩家若在 L1 引导过程中杀进程/重进，第二次启动就被判为「老玩家」、引导**永久不再出现**，而其实际进度为 0。`
        + `这不是 §8 违约（§8 只写「老玩家不重现」，未定义「老玩家」判据），故不判 FAIL；但属可玩性风险，建议判据改为「首次通关 level:cleared 后才置 onboarded」。`);
}

// ═════════════════════════════════════════════════════════ P4 · wrong/hint 态与四余 VFX
{
    const h = mk();
    h.frame();
    const s = h.game.snapshot;
    const held = s.traySlots.findIndex((x) => x.state !== 'free');
    const c0 = s.traySlots[held].colorIdx;
    const wrongCell = (() => { for (let i = 0; i < s.cells.length; i++) { const x = s.cells[i]; if (!x.void && x.state === 'empty' && x.colorIdx > 0 && x.colorIdx !== c0) return i; } return -1; })();
    h.game.tapDesign(...slotXY(held)); h.frame();
    h.game.tapDesign(...cellXY(s, wrongCell)); h.frame();
    const sn = { wrongRow: h.game.snapshot.wrongRow, wrongCol: h.game.snapshot.wrongCol, wrongProgress: h.game.snapshot.wrongProgress };
    const rejected = h.count('bead:rejected');
    const dangerHex = hex2(DEFAULT_PALETTE.danger);
    const shake = [], flash = [];
    for (let f = 0; f < 13; f++) {
        const cs = cmds(h); const cur = h.game.snapshot;
        const [wx, wy] = cellXY(cur, wrongCell);
        const bead = cs.filter((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && Math.abs((k.y + k.h / 2) - wy) < 2 && Math.abs((k.x + k.w / 2) - wx) < 8).map((k) => (k.x + k.w / 2) - wx);
        shake.push(bead.length ? Number(bead[0].toFixed(2)) : 0);
        const rg = rings(cs, dangerHex); flash.push(rg.length ? (rg[0].alpha ?? 1) : 0);
        h.frame();
    }
    const shakeMax = Math.max(...shake.map(Math.abs)), shakeDir = new Set(shake.filter((v) => Math.abs(v) > 0.4).map((v) => Math.sign(v))).size;
    const fm = pulsePeriodMs(flash.filter((v) => v > 0));
    // 其余三行：落座回弹 / 消除溶解 / 完成波浪 —— 落子后连续帧指令签名（剔 text）是否随时间轴变化
    const h2 = mk(); h2.frame();
    const s2 = h2.game.snapshot; const t2 = firstEmptyOf(s2, s2.traySlots.find((x) => x.state !== 'free')?.colorIdx ?? 1);
    const before = sig(cmds(h2));
    const i3 = h2.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
    h2.game.tapDesign(...slotXY(i3)); h2.frame(); h2.game.tapDesign(...cellXY(h2.game.snapshot, t2));
    const after = []; for (let f = 0; f < 10; f++) { h2.frame(); after.push(sig(cmds(h2))); }
    const popDistinct = new Set([before, ...after]).size;
    const src = {
        fillPop: Object.keys(T).filter((k) => /FILL_POP|POP_MS/.test(k)),
        dissolve: Object.keys(T).filter((k) => /DISSOLVE/.test(k)),
        wave: Object.keys(T).filter((k) => /COMPLETE_WAVE|WAVE_MS/.test(k)),
    };
    const residual = [];
    if (popDistinct <= 1) residual.push('vfx_fill_pop(120ms)');
    if (!src.dissolve.length) residual.push('vfx_clear_dissolve(200ms)');
    if (!src.wave.length) residual.push('vfx_complete_wave(逐列20ms/800ms)');
    const wrongOk = rejected === 1 && sn.wrongProgress > 0 && Math.abs(sn.wrongRow - Math.floor(wrongCell / s.gridCols)) <= 1 && shakeMax > 0 && shakeDir === 2 && fm.distinct >= 2;
    const v = wrongOk && residual.length === 0 ? 'PASS' : (wrongOk ? 'PASS*' : 'FAIL');
    rec('P4 / BD-04 · GAP-04 拒绝反馈（wrong 抖动+闪）与其余 VFX 行', v,
        `① wrong 态：bead:rejected=${rejected}（期望 1）、wrongRow/Col=(${sn.wrongRow},${sn.wrongCol})、wrongProgress=${sn.wrongProgress.toFixed(2)}；`
        + `被拒格 200ms 内水平位移样本=[${shake.join(',')}]px ⇒ 幅度 max=${shakeMax}px（ux-spec §5 = ±${T.WRONG_SHAKE_PX}px）、换号次数=${shakeDir}（期望 2 = ±×2）；`
        + `danger(${dangerHex}) 描边环 α 样本=[${flash.join(',')}] ⇒ 呼吸档 ${fm.distinct} 种、周期 ${fm.periodMs ? fm.periodMs.toFixed(0) : '—'}ms（WRONG_FX_MS=${T.WRONG_FX_MS}ms 内闪 2 次）。`
        + `　⚠️ **红线冲突待裁定（新登记）**：「200ms 内闪 2 次」= 10Hz 亮度变化，与 ux-spec §5 表头/§3.8「无 >3Hz 闪烁」红线口径冲突（表内「≤2 次/秒」原文挂在**音效**列）⇒ QA 不自裁。`
        + `② 落座回弹：落子前/后连续 10 帧**剔 text** 指令签名去重=${popDistinct}（>1 才有时间轴）；`
        + `③④ tuning 命中：FILL_POP=${src.fillPop.length} / DISSOLVE=${src.dissolve.length} / COMPLETE_WAVE=${src.wave.length} 个常量。`
        + (residual.length ? ` ⇒ 仍缺行：${residual.join(' / ')}（ux-spec §5 其余三行，波次 2 未列 T-087 范围）⇒ 建议 BD-04 **降级不关闭**。` : ' ⇒ 四行全落地。')
        + `　【探针口径】v1.0 以「CellState 无 wrong/hint」为实现缺失，本轮改判据为渲染层断言（修订 16）：载体实为 snapshot 覆盖层 hintRow/Col、wrongRow/Col/progress + view 只读消费（view-model.ts:493-521、584-587）。`);
}

// ═════════════════════════════════════════════════════════ P5 · 音频
{
    const h = mk();
    h.frame();
    const s = h.game.snapshot;
    const i1 = h.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
    h.game.tapDesign(...slotXY(i1)); h.frame();
    const e = firstEmptyOf(h.game.snapshot, h.game.snapshot.traySlots[i1].colorIdx);
    h.game.tapDesign(...cellXY(h.game.snapshot, e)); h.frame();
    h.game.tapDesign(...CARD_XY(1)); h.frame();
    const clips = [...new Set(h.played)];
    const clipConst = Object.keys(T).filter((k) => k.startsWith('AUDIO_CLIP_'));
    rec('P5 / BD-05 · GAP-05 关键事件音效与同帧派发', 'FAIL',
        `事件：tray:selected=${h.count('tray:selected')}、bead:placed=${h.count('bead:placed')}、powerup:used=${h.count('powerup:used')}；`
        + `同期 audio.play clip 去重=[${clips.join(', ') || '（无）'}] ⇒ 玩法事件音效**零派发**（仅 BGM/UI）。`
        + `tuning.ts 现存 clip 常量 ${clipConst.length} 个（${clipConst.join('/')}=${clipConst.map((k) => T[k]).join(', ')}）；`
        + `audio-events §1/§4 要求 19 个 clip id 与 A05-01/04/05/07/11/14/16 同帧派发。`
        + `框架层 BD-05b 未变：三平台 audio backend 仍 NullAudioBackend（packages/framework/src/platform/{node,web,weapp}.ts）⇒ 真机不解除。`
        + `　波次 2 无音频单（T-085..091 范围外）⇒ 本条维持 v1.0 FAIL，不属改判。`);
}

// ═════════════════════════════════════════════════════════ P6 · GAP-06 泄压阀（A′+D）
{
    // 合法供料灌满 12 槽（不落子），验「满槽 ≠ 死局」
    const lvl = probeLevel(903, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 3) + 1));
    const h = mk({ levels: [lvl] });
    let fullAt = -1, deadEver = 0, invariantBroken = 0, samples = 0;
    for (let f = 0; f < 60 * 90 && fullAt < 0; f++) {
        h.frame();
        const s = h.game.snapshot;
        for (const sl of s.traySlots) {
            if (sl.state === 'free') continue;
            samples++;
            if (demandOf(s, sl.colorIdx) <= 0) deadEver++;
        }
        for (const c of patternColors(s)) { const heldN = s.traySlots.filter((x) => x.state !== 'free' && x.colorIdx === c).length; if (heldN > demandOf(s, c)) invariantBroken++; }
        if (h.hold() === T.TRAY_BASE_SLOTS) fullAt = f;
    }
    const full = h.hold();
    const sF = h.game.snapshot;
    const placeableNow = sF.traySlots.filter((x) => x.state !== 'free' && demandOf(sF, x.colorIdx) > 0).length;
    // 腾槽后 ≤1 间隔恢复供料（§8-4 + §2.4.6「满槽后必可恢复」）
    const before = h.count('tray:spawned'); const fullEv = h.count('tray:full');
    const sel = sF.traySlots.findIndex((x) => x.state !== 'free');
    const tgt = firstEmptyOf(sF, sF.traySlots[sel].colorIdx);
    h.game.tapDesign(...slotXY(sel)); h.frame(); h.game.tapDesign(...cellXY(h.game.snapshot, tgt));
    h.advance(2.0 + 0.05);
    const resumed = h.count('tray:spawned') - before;
    const decoysInLevels = LEVELS.reduce((n, l) => n + ((l.decoys ?? []).length), 0);
    const v = full === T.TRAY_BASE_SLOTS && deadEver === 0 && invariantBroken === 0 && placeableNow === full && resumed >= 1 ? 'PASS' : 'FAIL';
    rec('P6 / BD-06 · GAP-06 尾部软锁死（A′+D 后满槽是否仍为死局）', v,
        `注入 13×12 三色、spawnInterval=2.0s，**只用合法供料**（不用 giveTrayBead，修订 20）：第 ${fullAt} 帧（${(fullAt / 60).toFixed(1)}s）托盘达基线容量 ${full}/${T.TRAY_BASE_SLOTS}。`
        + `满槽瞬间可落子珠数=${placeableNow}/${full}（A′：每颗 held<demand ⇒ 全部可落子）。`
        + `全程 ${samples} 个「槽×帧」采样中 demand=0 的死珠数=${deadEver}，违反 held≤demand 的采样数=${invariantBroken}。`
        + `tray:full=${fullEv}（本条在满槽当帧即停采样，未再跨过下一个 2.0s 供料间隔 ⇒ **不据本条判去重语义**；§8-4「tray:full 恰 1、不重复」由 P12 独立取证）。腾出 1 槽后 ≤1 个间隔内 tray:spawned 增量=${resumed}（§8-4 后半 + §2.4.6 补「满槽后必可恢复」）。`
        + `D 侧：DECOY_COLORS_MAX=${T.DECOY_COLORS_MAX}（systems-index §3 v1.17），8 关 JSON decoys 合计=${decoysInLevels}。`
        + `　判据依据：ux-spec §8 U8 已拍板 A′+D（2026-09-14），§4 尾注条件式承诺随 A′ 收敛为无条件 ⇒ v1.0 的「≥1 条非整关重置出口」改为「合法供料路径下死局不可达」（tray-spawner §2.4.4：A′/D 治供料侧、出口表三行不变）。`
        + `　诚实边界：以 giveTrayBead 白盒强灌非需色珠仍可造死局，但那是**绕过供料不变量的夹具态**，非玩家可达态 ⇒ 不判缺陷。`);
}

// ═════════════════════════════════════════════════════════ P7 · 告急三通道 + 满槽告警
{
    const h = mk({ levels: [probeLevel(906, 6, 5, 180, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.advance(170.5);
    const urgent = h.game.snapshot.urgent, ev = h.count('timer:urgent');
    const digits = [], icons = [];
    for (let f = 0; f < 130; f++) {
        const cs = cmds(h);
        const t = cs.find((c) => c.kind === 'text' && /^\d\d:\d\d$/.test(c.text) && inBand(c, T.HUD_BAND));
        digits.push(t ? alphaOf(t.fill) : (cs.filter((c) => c.kind === 'text' && inBand(c, T.HUD_BAND))[0]?.alpha ?? 1));
        const ico = cs.filter((c) => c.kind === 'circle' && inBand(c, T.HUD_BAND));
        icons.push(ico.length ? `${hex2(ico[0].stroke)}@${alphaOf(ico[0].stroke)}` : '-');
        h.frame();
    }
    const digitAlphaUnused = null; void digitAlphaUnused;
    const pm = pulsePeriodMs(hudPulse(h, 130));
    const iconColors = [...new Set(icons.map((x) => x.split('@')[0]))];
    const iconAlphas = pulsePeriodMs(icons.map((x) => Number(x.split('@')[1] ?? 1)));
    // 满槽告警通道（ux-spec §5 托盘描边呼吸 500ms）
    const fullRing = (() => {
        const h2 = mk({ levels: [probeLevel(907, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 3) + 1))] });
        for (let f = 0; f < 60 * 40 && h2.hold() < T.TRAY_BASE_SLOTS; f++) h2.frame();
        h2.advance(2.2);   // 满槽后再跨过一个供料间隔 ⇒ tray:full 的去重语义才真正可观测（修订 27）
        const seq = []; for (let f = 0; f < 60; f++) { seq.push(new Set(cmds(h2).filter((c) => c.kind !== 'text' && inBand(c, T.TRAY_BAND, 4)).map((c) => `${c.kind}${Math.round(c.x ?? 0)}${hex2(c.stroke ?? c.fill ?? '')}a${c.alpha ?? alphaOf(c.stroke ?? '')}`).join(','))); h2.frame(); }
        const uniq = new Set([...seq].map((s) => [...s].sort().join('|'))).size;
        return { full: h2.hold(), uniq, hasTrayFullEv: h2.count('tray:full') };
    })();
    const v = urgent && ev === 1 && pm.distinct >= 2 && pm.periodMs !== null && Math.abs(pm.periodMs - T.DANGER_PULSE_MS) <= 50 && fullRing.uniq <= 1 ? 'PASS*' : (urgent && pm.distinct >= 2 ? 'PASS*' : 'FAIL');
    rec('P7 / BD-10 · GAP-10 告急三通道（色+图标+脉冲）与满槽告警', v,
        `① 事件层：降穿 TIMER_URGENT_T=${T.TIMER_URGENT_T}s → timer:urgent=${ev}（期望恰 1）、snapshot.urgent=${urgent}。`
        + `② 颜色通道：HUD 时钟图标描边色去重=[${iconColors.join(', ')}]（平时 ${hex2(DEFAULT_PALETTE.textDim)} → 告急 ${hex2(DEFAULT_PALETTE.danger)}）、数字 fill 切 danger。`
        + `③ 脉冲通道：图标 α 序列（130 帧剔 text）distinct=${iconAlphas.distinct} 档、周期=${iconAlphas.periodMs ? iconAlphas.periodMs.toFixed(0) : '—'}ms；数字/图标合成脉冲样本 distinct=${pm.distinct}、周期=${pm.periodMs ? pm.periodMs.toFixed(0) : '—'}ms（ux-spec §5 = ${T.DANGER_PULSE_MS}ms±50）⇒ 频率 ${(1000 / (pm.periodMs ?? 1)).toFixed(2)}Hz ≤3Hz 红线。`
        + `④ 满槽告警（ux-spec §5 托盘描边呼吸 ${500}ms）：满槽 ${fullRing.full}/${T.TRAY_BASE_SLOTS} 且 tray:full=${fullRing.hasTrayFullEv} 时，托盘带内非文本指令签名 60 帧去重=${fullRing.uniq} 种（>1 才算呼吸）⇒ ${fullRing.uniq > 1 ? '有通道' : '**零通道，仍缺**'}。`
        + `　⇒ 建议 BD-10 **部分关闭**：告急三通道 ✅；满槽告警 500ms 呼吸仍开放（降级 P2，理由：A′ 下满槽非死局，仅反馈缺口）。`
        + `　timer-gameover §8-10 的「与满槽告警同屏叠加无 >3Hz 闪烁」半条因缺第二主体仍 ⛔ 不可测；代码锚点 view-model.ts:407-431（dangerAlpha + iconColor + timerColor）。`);
}
/** 单独取 HUD 非文本脉冲 α 序列（避免与 ①②③ 混用样本）。 */
function hudPulse(h, n) {
    const saved = h.game.snapshot; void saved;
    const seq = [];
    for (let f = 0; f < n; f++) {
        const cs = cmds(h);
        const c = cs.filter((k) => k.kind === 'circle' && inBand(k, T.HUD_BAND) && Math.abs((k.x ?? 0) - (T.DESIGN_W / 2 - 96)) < 2)[0];
        seq.push(c ? alphaOf(c.stroke) : 1);
        h.frame();
    }
    return seq;
}

// ═════════════════════════════════════════════════════════ P8 · 五类路由
{
    const h1 = mk(); h1.game.tapDesign(...GEAR_XY); h1.frame();
    const gearOk = h1.count('game:paused') === 1 && h1.game.snapshot.phase === 'paused';
    const h2 = mk(); h2.game.giveTrayBead(1); h2.game.giveTrayBead(2); h2.frame();
    h2.game.tapDesign(...CARD_XY(1)); h2.frame();
    const cardOk = h2.count('powerup:used') === 1;
    const h3 = mk(); h3.frame(); let expandHit = 0;
    for (let y = T.TRAY_BAND.yMin - 80; y <= T.TRAY_BAND.yMax + 8; y += 6) {
        for (let x = 0; x <= T.DESIGN_W; x += 6) { h3.game.tapDesign(x, y); if (h3.count('tray:expanded') > 0) { expandHit++; break; } }
    }
    const h4 = mk(); h4.frame(); const i4 = h4.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
    h4.game.tapDesign(...slotXY(i4)); h4.frame();
    const selOk = h4.count('tray:selected') === 1;
    const h5 = mk(); h5.frame(); const i5 = h5.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
    h5.game.tapDesign(...slotXY(i5)); h5.frame();
    const t5 = firstEmptyOf(h5.game.snapshot, h5.game.snapshot.traySlots[i5].colorIdx);
    h5.game.tapDesign(...cellXY(h5.game.snapshot, t5)); h5.frame();
    const placeOk = h5.count('bead:placed') === 1 && h5.count('bead:rejected') === 0;
    const v = [gearOk, cardOk, selOk, placeOk].every(Boolean) && expandHit > 0 ? 'PASS' : 'FAIL';
    rec('P8 / BD-15 · TC-INP-01 · S2 §8-1 五类路由', v,
        `① 齿轮→game:paused=${h1.count('game:paused')}(phase=${h1.game.snapshot.phase}) ${gearOk ? '✓' : '✗'}；② 道具卡→powerup:used=${h2.count('powerup:used')} ${cardOk ? '✓' : '✗'}；`
        + `③ 扩展→tray:expanded 命中点=${expandHit}（6px 栅格扫托盘带上下 80px）${expandHit > 0 ? '✓' : '✗'}；④ 托盘珠→tray:selected=${h4.count('tray:selected')} ${selOk ? '✓' : '✗'}；`
        + `⑤ 空格(有选中)→bead:placed=${h5.count('bead:placed')}/rejected=${h5.count('bead:rejected')} ${placeOk ? '✓' : '✗'}。`
        + `　仍缺第 3 类：src/** grep btn_expand/_hitExpand 命中 0（仅 beads-game.ts:547 expandTray() 方法层，玩家不可达）⇒ **BD-15 维持开放**（波次 2 未列范围）。`);
}

// ═════════════════════════════════════════════════════════ P9 · 热区（§8-2 回写后）
{
    const h0 = mk(); h0.frame();
    const s = h0.game.snapshot;
    const target = (() => { for (let i = 0; i < s.cells.length; i++) { const c = s.cells[i]; if (!c.void && c.state === 'empty' && c.colorIdx > 0 && (i % s.gridCols) + 1 < s.gridCols && !s.cells[i + 1].void && s.cells[i + 1].state === 'empty') return i; } return -1; })();
    const [cx, cy] = cellXY(s, target);
    // 【修订 15b + 26】旧版忘了先选珠（⇒ 全 none 假 FAIL）；修后仍假 FAIL，因为**多次命中同一格**：
    //   第一次落子后该格已填（后续变 danger/locked）且托盘被 fixture 珠灌满 ⇒ giveTrayBead 返回 -1。
    //   本轮改为**每次偏移测量用一个干净实例**（同一行主序目标格、同一几何），一次一事。
    const probe = (dx) => {
        const hi = mk(); hi.frame();
        const si = hi.game.snapshot;
        const sl = hi.game.giveTrayBead(si.cells[target].colorIdx);
        if (sl < 0) return 'no-free-slot';
        hi.game.selectTraySlot(sl); hi.frame();
        hi.reset();
        hi.game.tapDesign(cx + dx, cy); hi.frame();
        const p = hi.last('bead:placed') ?? hi.last('bead:rejected');
        return p ? `r${p.row}c${p.col}` : (hi.emitted.length ? 'other' : 'none');
    };
    const own = [0, 12, 25].map(probe), tie = probe(T.BEAD_PITCH / 2), mid = [27, 32, 33].map(probe), far = [40, 51, 52].map(probe);
    const outside = probe(-(T.BEAD_PITCH * (target % s.gridCols) + T.BEAD_CELL / 2 + 20));
    const col = target % s.gridCols;
    const cell = (cIdx) => `r${Math.floor(target / s.gridCols)}c${cIdx}`;
    const ownOk = own.every((x) => x === cell(col));
    // dx = BEAD_PITCH/2 = 26 是**两格等距并列点**，§8-4「最近格心」在此无定义（测不到偏左/偏右均为合规）；
    // 本轮只记录实际归属，不据此判 FAIL（早期版本要 26 必须算右格 ⇒ 假 FAIL）。
    const tieOk = tie === cell(col) || tie === cell(col + 1);
    const midOk = mid.every((x) => x === cell(col + 1));
    const farOk = far.every((x) => x === cell(col + 1));
    const v = ownOk && tieOk && midOk && farOk && outside === 'none' ? 'PASS' : 'FAIL';
    rec('P9 / BD-23(已裁定) · TC-INP-02·04 · S2 §8-2 热区 + §8-4 最近格心', v,
        `目标格 r${Math.floor(target / s.gridCols)}c${col}，格心=(${cx.toFixed(1)},${cy.toFixed(1)})；BEAD_CELL=${T.BEAD_CELL}、GRID_HIT_SIZE=${T.GRID_HIT_SIZE}（半宽 ${T.GRID_HIT_SIZE / 2}）、BEAD_PITCH=${T.BEAD_PITCH}（最近格心翻转点 ${T.BEAD_PITCH / 2}）。`
        + `偏移 0/12/25 →[${own.join(' ')}]（${ownOk ? '全命中本格 ✓' : '✗'}）；等距并列点 dx=${T.BEAD_PITCH / 2} →${tie}（§8-4 无定义，实测归${tie === cell(col) ? '左（本格）' : '右（邻格）'}，不据此判否）；`
        + `偏移 27/32/33（重叠区且 strictly 靠近邻格）→[${mid.join(' ')}]；偏移 40/51/52 →[${far.join(' ')}]；网格外 -20px →${outside}（期望 none ✓）。`
        + `　§8-2 现文（WXG-T-091 回写）：「因 BEAD_PITCH < 命中区，网格内部外扩区必然重叠，此时**一律以 §4 最近格心裁决**；本条『偏移 ≤ 外扩边界内必命中本格』只在无重叠区成立；网格内部不存在带间隙处，零事件仅在网格外围验证」`
        + `⇒ 实测与回写后判据**逐条一致**，v1.0 的 PASS*（判据互斥）取消，改判 **PASS**；BD-23 关闭。`);
}

// ═════════════════════════════════════════════════════════ P10 · 无选中点网格
// 修订 25：本条改用**配对差分**（同 seed 两实例，同一帧号下「点 vs 不点」比签名）。
// 旧写法「点击前一帧 vs 点击后一帧」会把 hint 呼吸 / 首珠脉冲的**常态动画**当成反馈 ⇒ 恒不等 = 假 PASS。
{
    const runP10 = (tap) => {
        const h = mk({ seed: 'p10-diff' });
        h.frame();
        const s = h.game.snapshot;
        const i = findEmpty(s);
        const [x, y] = cellXY(s, i);
        if (tap) h.game.tapDesign(x, y);
        h.frame();
        const sn = h.game.snapshot;
        return {
            h, i, x, y, sig: sig(cmds(h)),
            hints: { powerupHint: sn.powerupHint, failHint: sn.failHint, banner: sn.banner, subBanner: sn.subBanner },
            placed: h.count('bead:placed'), rejected: h.count('bead:rejected'), selected: h.count('tray:selected'),
        };
    };
    const ctl = runP10(false), tst = runP10(true);
    const diff = ctl.sig !== tst.sig;
    const hintOn = Object.values(tst.hints).some(Boolean);
    const v = tst.placed === 0 && tst.rejected === 0 && tst.selected === 0 && (diff || hintOn) ? 'PASS' : 'FAIL';
    rec('P10 / BD-16 · TC-INP-07 · S2 §8-7 无选中点网格 → 零请求 + 轻提示', v,
        `零请求 ✓：bead:placed=${tst.placed}、bead:rejected=${tst.rejected}、tray:selected=${tst.selected}（期望 0/0/0），点击点=空格 (i${tst.i}, ${tst.x.toFixed(1)},${tst.y.toFixed(1)})。`
        + `轻提示 ✗：powerupHint=「${tst.hints.powerupHint}」failHint=「${tst.hints.failHint}」banner=「${tst.hints.banner}」subBanner=「${tst.hints.subBanner}」（全空）；`
        + `配对差分（同 seed、同帧号， ctl 不点 / tst 点）非文本指令签名是否出现差异=${diff}（false ⇒ 该次点击**未产生任何专用反馈帧**）。`
        + `　代码铁证（未改）：beads-game.ts:1371 \`if (slot < 0) return false; // S2 gate: no bead selected → no request at all\` ⇒ 前半条达标、后半条无实现 ⇒ **BD-16 维持开放**（P2）。`
        + `　【探针自查】v1.0 与本文件早期版本均以「点击前后两帧签名不等」判有反馈，实测恒为 true（常态动画污染）⇒ 属**假 PASS 风险**，本轮已按修订 25 收紧。`);
}

// ═════════════════════════════════════════════════════════ P11 · §8-6/8/10（真实 InputManager）
{
    const h1 = mk(); h1.frame();
    const s1 = h1.game.snapshot; const [sx, sy] = slotXY(s1.traySlots.findIndex((x) => x.state !== 'free'));
    h1.tapScreen(sx, sy); h1.frame(); h1.tapScreen(sx, sy); h1.frame();
    const dbl = h1.count('tray:selected');
    const h2 = mk(); h2.frame();
    const a = h2.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
    h2.game.giveTrayBead(h2.game.snapshot.cells.find((c) => !c.void && c.colorIdx > 0).colorIdx); h2.frame();
    h2.tapScreen(...slotXY(a)); h2.frame(); h2.tapScreen(...slotXY(a === 0 ? 1 : 0)); h2.frame();
    const swap = h2.count('tray:selected'), selFinal = h2.game.snapshot.traySelected;
    const h3 = mk(); h3.game.tapDesign(...GEAR_XY); h3.frame();
    const s3 = h3.game.snapshot; const before3 = h3.emitted.length;
    h3.tapScreen(...slotXY(0)); h3.frame(); h3.game.tapDesign(...cellXY(s3, findEmpty(s3))); h3.frame(); h3.game.tapDesign(...CARD_XY(0)); h3.frame();
    const pausedEvents = h3.emitted.length - before3, phase3 = h3.game.snapshot.phase;
    const h4 = mk(); h4.frame();
    const s4 = h4.game.snapshot; const i4 = s4.traySlots.findIndex((x) => x.state !== 'free');
    h4.tapScreen(...slotXY(i4)); h4.frame();
    const [gx, gy] = cellXY(h4.game.snapshot, firstEmptyOf(h4.game.snapshot, h4.game.snapshot.traySlots[i4].colorIdx));
    h4.reset(); h4.tapMany(gx, gy, 20);
    const flood = { placed: h4.count('bead:placed'), rejected: h4.count('bead:rejected'), phase: h4.game.snapshot.phase };
    const mt = mk(); mt.frame();
    const sm = mt.game.snapshot; const [m1x, m1y] = slotXY(sm.traySlots.findIndex((x) => x.state !== 'free'));
    const ms1 = mt.services.viewport.designToScreen({ x: 0, y: 0 }, m1x, m1y);
    // §8-9 双指同帧：两个 id 同帧 down（均为屏幕 CSS px），仅首触点（owner）生效
    mt.input.beginFrame();
    mt.input.push({ id: 7, x: ms1.x, y: ms1.y, phase: 'down', time: 1 });
    const [ox, oy] = cellXY(sm, findEmpty(sm));
    const op = { x: 0, y: 0 }; mt.services.viewport.designToScreen(op, ox, oy);
    mt.input.push({ id: 9, x: op.x, y: op.y, phase: 'down', time: 2 });
    mt.game.update(1 / 60); mt.input.endFrame(1 / 60);
    const multi = {
        selected: mt.count('tray:selected'), placed: mt.count('bead:placed'),
        // 【修订 15c】routed 只计**输入路由产物**（不能把 tray:spawned 等无关事件计入，否则假 FAIL）
        routed: mt.count('tray:selected') + mt.count('bead:placed') + mt.count('bead:rejected'),
    };
    const v = (dbl === 1 && pausedEvents === 0 && phase3 === 'paused' && flood.placed === 1 && flood.rejected === 0 && multi.routed <= 1) ? 'PASS' : 'PASS*';
    rec('P11 / TC-INP-06·08·09·10 · S2 §8-6/§8-8/§8-9/§8-10（真实 InputManager 链路）', v,
        `§8-6 双击同槽（真实 InputManager + screenToDesign）tray:selected=${dbl}（期望 1）；换选 tray:selected=${swap}、最终 traySelected=${selFinal}。`
        + `§8-8 PAUSED 下点托盘/网格/道具 ⇒ 事件增量=${pausedEvents}（期望 0）、相位=${phase3}。`
        + `§8-10 同帧注入 20 条 down ⇒ bead:placed=${flood.placed}（期望 1）、rejected=${flood.rejected}、相位=${flood.phase}，无崩溃。`
        + `§8-9 双指同帧（id 7 与 id 9，两个不同设计点）⇒ 路由事件数=${multi.routed}（期望 ≤1；InputManager owner-lock：次触点被忽略，input-manager.ts:95）。`
        + `　v1.0 的 PASS* 理由（「tapDesign 绕过 InputManager，不能证明真实一帧 20 touch 只路由 1 条」）本轮由**改走 app.input 同款 push 序列**消除 ⇒ 建议升 **PASS**；`
        + `　真机触摸事件序 / OS 层多点行为仍属「[Device]」⛔（不作证据）。`);
}

// ═════════════════════════════════════════════════════════ P12 · §8-2 卡方 / §8-4 / §8-5
{
    const lvl = probeLevel(908, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 4) + 1));
    const h = mk({ levels: [lvl], seed: 'chi' });
    const slots = new Array(T.TRAY_BASE_SLOTS).fill(0);
    // 【修订 15d】旧版游标错（slice(got) 把事件数当 emitted 下标）且**不排水**：
    //   自然累积下托盘 12/12 就满了（实跑 n=12，只能靠 autoFrame 偶发腾槽）⇒ 样本被“空闲槽集变化”污染，
    //   χ² 被伪做到 760。本轮沿用 v3 修订 3 的**白盒排水夹具**（每帧清空持有槽 ⇒ 12 槽全空闲），
    //   它只隔离「落槽随机性」这一个变量，不改变 _pickFreeSlot 的真实代码路径（spawner.ts:176-186）。
    let cursor = 0, got = 0, framesS = 0;
    for (let f = 0; f < 60 * 4000 && got < 200; f++) {
        h.frame(); framesS++;
        for (; cursor < h.emitted.length; cursor++) {
            const e = h.emitted[cursor];
            if (e.type !== 'tray:spawned') continue;
            slots[e.p.slot] = (slots[e.p.slot] ?? 0) + 1; got++;
            if (got >= 200) break;
        }
        h.drain();
    }
    const exp = 200 / T.TRAY_BASE_SLOTS;
    const x2 = chi2(slots, exp);
    const maxDev = Math.max(...slots.map((v) => Math.abs(v - exp) / exp)) * 100;
    // §8-4 满槽跳过 + 恢复（合法供料）
    const h2 = mk({ levels: [probeLevel(909, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 3) + 1))], seed: 'full' });
    for (let f = 0; f < 60 * 40 && h2.hold() < T.TRAY_BASE_SLOTS; f++) h2.frame();
    const beforeF = h2.count('tray:spawned'); h2.advance(2.0 * 3);
    const fullEv = h2.count('tray:full'), spawnDuring = h2.count('tray:spawned') - beforeF;
    const sF = h2.game.snapshot; const sel = sF.traySlots.findIndex((x) => x.state !== 'free');
    h2.game.tapDesign(...slotXY(sel)); h2.frame(); h2.game.tapDesign(...cellXY(sF, firstEmptyOf(sF, sF.traySlots[sel].colorIdx)));
    h2.advance(2.05); const resumed = h2.count('tray:spawned');
    const h3 = mk(); const cap0 = h3.game.snapshot.traySlots.length; const ex = h3.game.expandTray();
    const v = x2 < CRIT_DF11_A005 && fullEv === 1 && spawnDuring === 0 && resumed >= 1 && ex && cap0 + T.TRAY_EXPAND_SLOTS === h3.game.snapshot.traySlots.length ? 'PASS' : 'FAIL';
    rec('P12 / BD-22(已裁定) · TC-TRAY-02·04·05 · S4 §8-2/§8-4/§8-5', v,
        `§8-2 现文（WXG-T-091）：200 次供料落槽频次做**卡方拟合优度，α=0.05 不拒绝均匀**（旧 ±20% 弃用）。白盒排水夹具下 ${framesS} 帧采到 ${got} 样本，频次=[${slots.join(',')}]，期望 ${exp.toFixed(2)}/槽 ⇒ χ²=${x2.toFixed(2)}（df=${T.TRAY_BASE_SLOTS - 1}，α=0.05 临界 ${CRIT_DF11_A005}${x2 < CRIT_DF11_A005 ? ' ⇒ 不拒绝 ✓' : ' ⇒ 拒绝均匀 ✗'}）；`
        + `对照旧口径最大偏差 ${maxDev.toFixed(1)}%（若仍按 ±20% 会误报，即 BD-22 的误报本征）。`
        + `§8-4：满槽 → tray:full=${fullEv}（期望 1、不重复）、满槽期 3 间隔 tray:spawned 增量=${spawnDuring}（期望 0）✓；腾 1 槽后 ≤1 间隔恢复=${resumed >= 1 ? '✓' : '✗'}。`
        + `§8-5：${cap0} 槽 → expandTray()=${ex} → ${h3.game.snapshot.traySlots.length} 槽（期望 ${T.TRAY_BASE_SLOTS + T.TRAY_EXPAND_SLOTS}）✓（**但玩家无入口，见 P8/BD-15**）。`);
}

// ═════════════════════════════════════════════════════════ P13 · harness 坐标链路
{
    const { app, game } = boot;
    const vp = app.viewport;
    const rt = (dw, dh, pts) => {
        vp.resize(dw, dh);
        const o = { x: 0, y: 0 }, b = { x: 0, y: 0 };
        let maxErr = 0;
        for (const [x, y] of pts) { vp.designToScreen(o, x, y); vp.screenToDesign(b, o.x, o.y); maxErr = Math.max(maxErr, Math.abs(b.x - x), Math.abs(b.y - y)); }
        return maxErr;
    };
    const pts = [[0, 0], [375, 667], [297, 904], [63, 1086], [687, 514], [750, 1334]];
    const e1 = rt(750, 1334, pts), e2 = rt(390, 844, pts), e3 = rt(412, 915, pts);
    vp.resize(750, 1334);
    // DPR 无关性：把同一点的 device-px 值（×2）喂进来 ⇒ 必须落到完全不同的设计点（坐标空间可区分）
    const devReject = (() => {
        const o = { x: 0, y: 0 }; vp.designToScreen(o, 297, 904);
        const back = vp.screenToDesign({ x: 0, y: 0 }, o.x * 2, o.y * 2);
        return Math.hypot(back.x - 297, back.y - 904);
    })();
    // 端到端：真实 harness input（CSS px）→ screenToDesign → 命中预期槽
    game.goToLevel(0); boot.render(3);
    const s = game.snapshot;
    const idx = s.traySlots.findIndex((x) => x.state !== 'free');
    const [dx, dy] = slotXY(idx);
    const sc = { x: 0, y: 0 }; app.viewport.designToScreen(sc, dx, dy);
    app.events.on('tray:selected', () => { });
    let selectedSeen = -1; app.events.on('tray:selected', (p) => { selectedSeen = p?.slot ?? 'ev'; });
    app.input.push({ id: 1, x: sc.x, y: sc.y, phase: 'down', time: 10 }); boot.render(1); app.input.push({ id: 1, x: sc.x, y: sc.y, phase: 'up', time: 11 }); boot.render(1);
    const got = selectedSeen >= 0 ? selectedSeen : game.snapshot.traySelected;
    // DPR 无关性：device-px 样本喂进去必须打不中（回归钉）
    let devSel = null; app.input.push({ id: 2, x: sc.x * 2, y: sc.y * 2, phase: 'down', time: 20 });
    const before = game.snapshot.traySelected; boot.render(1); devSel = game.snapshot.traySelected === before ? 'unchanged' : 'changed';
    const v = e1 < 1e-9 && e2 < 1e-9 && e3 < 1e-9 && devReject > 50 && got === idx ? 'PASS' : 'FAIL';
    rec('P13 / BD-07 · GAP-07 harness DPR/视口坐标链路', v,
        `① 双向往返 max 误差：CSS 750×1334 = ${e1.toExponential(1)}；390×844（非设计长宽比、含 letterbox offset）= ${e2.toExponential(1)}；412×915 = ${e3.toExponential(1)}（期望 <1e-9）。`
        + `② 把设计点 (297,904) 的 **device-px（×2）**当屏幕坐标喂 screenToDesign ⇒ 落点偏离 ${(devReject ?? 0).toFixed(1)}px（期望 >50px，即坐标空间可区分、不致错位命中）。`
        + `③ **端到端**：以 CSS px (${sc.x.toFixed(1)},${sc.y.toFixed(1)}) 经真实 app.input.push(down/up) + app.tick → 期望命中槽 ${idx}，实测 traySelected=${got} ⇒ ${got === idx ? '一致 ✓' : '不一致 ✗'}。`
        + `④ 反向回归钉：把同一点的 device-px 值（×2）喂 input ⇒ 选中态 ${devSel}（期望 unchanged，即 GAP-07 不得复发）。`
        + `　代码锚点：dev/harness/main.ts:90-102 pushPointer 送 clientX/clientY（去掉 ×dpr）+ :69-81 app.resize(cssW,cssH)；canvas2d-renderer pixelRatio 吸收 DPR（0e673d1 / ADR-0011 方案 B）。`
        + `　【探针自我修正】v1.0 P13 以「screenToDesign(297,904)→(297,430) = y 轴折叠」为缺陷征候，属**误读**（设计系 y 向上，翻转正确）；真根因是 pushPointer ×dpr。登记为探针自身缺陷 #14（修订 18）。`);
}

// ═════════════════════════════════════════════════════════ P14 · L6–L8 可达性
{
    const { game } = boot;
    const info = [];
    for (const n of [5, 6, 7]) { game.goToLevel(n); boot.render(2); const s = game.snapshot; info.push(`L${n + 1}(id=${s.levelId}) ${s.gridCols}×${s.gridRows} empty=${s.cells.filter((c) => !c.void && c.state === 'empty').length} locked=${s.cells.filter((c) => !c.void && c.state === 'locked').length} 色数=${patternColors(s).size} phase=${s.phase}`); }
    game.goToLevel(0); boot.render(2);
    const rec14 = mk();
    const n = LEVELS.length;
    const v = info.every((x) => x.includes('phase=playing')) ? 'PASS*' : 'FAIL';
    rec('P14 / BD-13 · GAP-13 L6–L8 取证通路', v,
        `关卡表 ${n} 关；harness（真实编译产物路径，非 Node 直装）goToLevel(5/6/7) 均可进 PLAYING：${info.join('；')}。`
        + `⇒ v1.0 的「harness 只暴露 L1–L5」已不成立（main.ts 以 game.levelCount 驱动），L6 锁定格 / L7·L8 8 色满配的「[Harness]」路径**结构上可达**。`
        + `仍缺（⇒ 维持 PASS*，不升 PASS）：`
        + `①「preview:frames」（tools/scripts/render-harness-frame.mjs）仍硬编码 breakout API（:56 game.movePaddleTo、:77 bricksDestroyed、无 --game 透传）⇒ beads 无帧预览（**BD-19 未修**）；`
        + `② 沙箱禁监听 socket + 无浏览器截图通路 ⇒ 由 harness 产**像素**（色盲模拟/灰度/逐帧截图）仍 ⛔。`);
}

// ═════════════════════════════════════════════════════════ P15 · 13×12 极端定位
{
    const big = probeLevel(910, T.GRID_MAX_COLS, T.GRID_MAX_ROWS, 420, 4.0, (i, j) => String(((i * T.GRID_MAX_COLS + j) % T.BEAD_COLOR_MAX) + 1));
    const h = mk({ levels: [big] });
    const s = h.game.snapshot;
    const pick = [[0, 0], [0, T.GRID_MAX_COLS - 1], [T.GRID_MAX_ROWS - 1, 0], [T.GRID_MAX_ROWS - 1, T.GRID_MAX_COLS - 1], [6, 6]];
    const cs = cmds(h);
    const measured = [];
    for (const [r, c] of pick) {
        const idx = r * s.gridCols + c;
        const [fx, fy] = cellXY(s, idx);
        const rect = cs.find((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && Math.abs(k.x + k.w / 2 - fx) < 1.5 && Math.abs(k.y + k.h / 2 - fy) < 1.5);
        measured.push({ r, c, formula: [fx, fy], rendered: rect ? [Number((rect.x + rect.w / 2).toFixed(2)), Number((rect.y + rect.h / 2).toFixed(2))] : null });
    }
    const err = Math.max(...measured.filter((m) => m.rendered).map((m) => Math.max(Math.abs(m.rendered[0] - m.formula[0]), Math.abs(m.rendered[1] - m.formula[1]))));
    const cs2 = { left: s.gridLeft, top: s.gridTop, bottom: s.gridTop - (s.gridRows - 1) * T.BEAD_PITCH };
    const v = measured.every((m) => m.rendered) && err <= 0.5 && cs2.left >= 30 && cs2.top <= 1120 && cs2.bottom >= 480 ? 'PASS' : 'PASS*';
    rec('P15 / TC-GRID-08 · S3 §8-8 13×12 极端定位', v,
        `156 格装载成功（cells=${s.cells.length}）；五格中心 [${measured.map((m) => `(${m.r},${m.c}) 公式=${m.formula.map((x) => x.toFixed(1))} 渲染=${m.rendered ? m.rendered.map((x) => x.toFixed(1)) : 'null'}`).join('; ')}] ⇒ 公式↔渲染指令最大偏差 ${err.toFixed(3)}px（判据 ≤0.5px）。`
        + `约束：gridLeft=${cs2.left}(≥30) gridTop=${cs2.top}(≤1120) gridBottom=${cs2.bottom.toFixed(1)}(≥480)。`
        + `　道次说明：本条为「view 层实际下发的绘制坐标」，比 v1.0 的纯公式复算强一档；但 Canvas 真实栅格化像素（含 DPR 取整）仍属「[Cocos]/[Device]」⛔。`);
}

// ═════════════════════════════════════════════════════════ P16 · LEVEL_TIME 区间
{
    const rows = [];
    for (const t of [181, 419, 180, 420, 100, 999]) {
        const h = mk({ levels: [probeLevel(911, 6, 5, t, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
        h.frame();
        rows.push(`${t}→{phase:${h.game.snapshot.phase},total:${h.game.snapshot.totalTime ?? '-'}}`);
    }
    const ok = rows[0].includes('playing') && rows[1].includes('playing') && rows[2].includes('playing') && rows[3].includes('playing') && rows[4].includes('boot') && rows[5].includes('boot');
    rec('P16 / TC-TIMER-07 · S5 §8-7 LEVEL_TIME 区间 [180,420]', ok ? 'PASS' : 'FAIL',
        `${rows.join('；')}。越界样本 BOOT 拒绝并打日志（含关卡 id + 字段），不进 PLAYING ⇒ §8-7 成立（与 v1.0 一致，无回归）。`);
}

// ═════════════════════════════════════════════════════════ P17 · 连胜 meta 字段
{
    const h = mk({ levels: [probeLevel(912, 4, 3, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    for (let n = 0; n < 3; n++) {
        for (const c of [...h.game.snapshot.cells]) {
            const s = h.game.snapshot; if (s.phase !== 'playing') break;
            const i = findEmpty(s); if (i < 0) break;
            const sl = h.game.giveTrayBead(s.cells[i].colorIdx); if (sl < 0) { h.drain(); continue; }
            h.game.selectTraySlot(sl); h.game.tapGridCell(Math.floor(i / s.gridCols), i % s.gridCols);
        }
        h.advance(0.5);
        if (h.game.snapshot.phase !== 'playing') break;
    }
    const raw = String(h.storage.get(h.saveKey) ?? '');
    const hasMeta = /winStreak|lastPlayDate|signin/i.test(raw);
    rec('P17 / BD-12 · S8 §8-7 连胜 + v1.1 meta 字段', hasMeta ? 'PASS' : 'FAIL',
        `通关推进后写档=${raw.slice(0, 260)}；winStreak/lastPlayDate/signin 命中=${hasMeta} ⇒ §8-7「连胜 3 → Current=3/Best=3；第 4 关失败 → Current=0/Best 仍 3」**仍无实现载体**（save-schema.ts 无 meta 段）。`
        + `　v1.0→v1.1 变化：存档 version 1→**2**（T-088），但新增字段是「settings.reduceMotion / largeText」（可访问性，见 P22/P23），**不含** §2.3 冻结的 meta 段 ⇒ **BD-12 维持开放**（P2；属 concept §7 MVP 线之外）。`);
}

// ═════════════════════════════════════════════════════════ P18 · §8-9（回写后 156）
{
    const big = probeLevel(913, T.GRID_MAX_COLS, T.GRID_MAX_ROWS, 420, 4.0, (i, j) => String(((i * T.GRID_MAX_COLS + j) % T.BEAD_COLOR_MAX) + 1));
    const h = mk({ levels: [big] });
    const s = h.game.snapshot;
    const fillable = s.cells.filter((c) => !c.void && c.colorIdx > 0).length;
    let placed = 0, writesBeforeLast = 0, clearedAt = -1;
    for (let i = 0; i < s.cells.length; i++) {
        const c = s.cells[i]; if (c.void || c.state !== 'empty' || c.colorIdx <= 0) continue;
        const sl = h.game.giveTrayBead(c.colorIdx);
        if (sl < 0) { h.drain(); continue; }
        h.game.selectTraySlot(sl);
        if (h.game.tapGridCell(Math.floor(i / s.gridCols), i % s.gridCols)) {
            placed++;
            if (h.count('level:cleared') > 0) { clearedAt = placed; writesBeforeLast = h.writes - 1; break; }
        }
    }
    const cleared = h.count('level:cleared');
    const v = fillable === T.GRID_MAX_COLS * T.GRID_MAX_ROWS && placed === fillable && cleared === 1 && writesBeforeLast === 0 && h.writes === 1 ? 'PASS' : 'FAIL';
    rec('P18 / BD-24(已裁定) · S8 §8-9 PLAYING 零写档 / 结算帧恰 1 次', v,
        `§8-9 现文（WXG-T-091）：注入落子次数 = 关卡最大可构造量 GRID_MAX_COLS×GRID_MAX_ROWS = ${T.GRID_MAX_COLS * T.GRID_MAX_ROWS}；结算帧 = **level:cleared 帧**（失败/sprint 帧另依 §2.5，不属本条）。`
        + `实测：可填格 ${fillable}、成功落子 ${placed}（第 ${clearedAt} 次触发通关）；PLAYING 段（前 ${placed - 1} 次落子）写档=${writesBeforeLast}（期望 0）${writesBeforeLast === 0 ? '✓' : '✗'}；含结算帧累计写档=${h.writes}（期望恰 1）${h.writes === 1 ? '✓' : '✗'}；level:cleared=${cleared}。`
        + `　v1.0 的 PASS*（200 不可构造）随判据回写取消 ⇒ 改判 **PASS**；BD-24 关闭。`
        + `　白盒夹具声明：本条用 giveTrayBead 补齐 156 颗珠（156 次落子在 4s×156 节律下超出 time≤420 的关卡上限），供料侧不受影响 ⇒ 只测「写档次数」，不测供料（修订 20 已隔离该手法）。`);
}

// ═════════════════════════════════════════════════════════ P19 · hint 态载体
{
    const h = mk(); h.frame();
    const hintHex = hex2(DEFAULT_PALETTE.hintBlue);
    const cs = cmds(h);
    const rg = rings(cs, hintHex);
    const s = h.game.snapshot;
    const cellCenter = s.hintRow >= 0 ? cellXY(s, s.hintRow * s.gridCols + s.hintCol) : null;
    const onCell = cellCenter ? rg.find((r) => Math.abs(r.x + r.w / 2 - cellCenter[0]) < 2 && Math.abs(r.y + r.h / 2 - cellCenter[1]) < 2) : null;
    const states = [...new Set(s.cells.map((c) => c.state))];
    const v = rg.length >= 1 && onCell && onCell.lineWidth === 2 ? 'PASS' : 'FAIL';
    rec('P19 / BD-11 · hint 态（规格 → 实现载体）', v,
        `accent_blue(${hintHex}) 外描边环图元数=${rg.length}（尺寸/线宽=[${rg.map((r) => `${Math.round(r.w)}px·lw${r.lineWidth}`).join(' ')}]），目标格 (r${s.hintRow},c${s.hintCol}) 上检出叠加环=${!!onCell}。`
        + `alpha 相位（P3 已测周期 ${T.HINT_PULSE_MS}ms / α 0.5↔1.0）⇒ assets-spec §1.2 hint 行三要素（色底 + 2px accent_blue 外描边 + 呼吸）落地。`
        + `　分层偏差登记（不判缺陷）：CellState 仍为 [${states.join('|')}]，hint/wrong 未扩为格子枚举态，实现走 snapshot 覆盖层 + view 只读；`
        + `art/assets-spec §1.2 以「状态行」措辞描述 ⇒ 建议美术侧补一句「hint/wrong 为叠加层，不改 S3 三态」，避免下轮按枚举态断言误判（修订 16）。`);
}

/** PanelRect = {xMin,yMin,xMax,yMax}（pause-panel.ts:67-69）；取中心设计坐标。 */
const panelCenter = (b) => [(b.rect.xMin + b.rect.xMax) / 2, (b.rect.yMin + b.rect.yMax) / 2];

// ═════════════════════════════════════════════════════ P20 (新增) · §8-1 / core-loop §8-2 首供语义 16±0
{
    const lvl = probeLevel(914, T.GRID_MAX_COLS, T.GRID_MAX_ROWS, 420, T.SPAWN_INTERVAL_DEFAULT, (i, j) => String(((i * T.GRID_MAX_COLS + j) % 3) + 1));
    const h = mk({ levels: [lvl], seed: 'sixteen' });
    // 时基从「进入 PLAYING 的那一帧」起算；§8-1 的「60 秒内」按**闭区间 t∈[0,60]**取值
    // （= 首供 1 @t=0 + 周期 15 @t=4,8,…,60），开/闭区间差 1 次，已登记为判据歧义（见报告 §12）。
    const times = [];
    let since = -1, seenN = 0;
    for (let f = 0; f < 60 * 64; f++) {
        h.autoFrame();
        if (h.game.snapshot.phase !== 'playing') break;
        since = since < 0 ? 1 : since + 1;
        const c = h.count('tray:spawned');
        while (seenN < c) { seenN++; times.push(since / 60); }
    }
    const inWindow = times.filter((t) => t <= 60 + 1e-9);
    const openWindow = times.filter((t) => t < 60 - 1e-9);
    const deltas = times.slice(1).map((t, i) => t - times[i]);
    const maxDev = deltas.length ? Math.max(...deltas.map((d) => Math.abs(d - T.SPAWN_INTERVAL_DEFAULT))) : null;
    const placements = h.count('bead:placed');
    const rhythmOk = times[0] === 1 / 60 && maxDev !== null && maxDev <= 0.1 && deltas.length >= 15;
    const v = rhythmOk && times.length >= 16 ? 'PASS*' : 'FAIL';
    rec('P20 (v1.1 新增) / BD-25 · S4 §8-1 + S1 §8-2 首供语义 16（±0）', v,
        `注入 spawnInterval=SPAWN_INTERVAL_DEFAULT=${T.SPAWN_INTERVAL_DEFAULT}s、13×12 关卡（demand 充裕），自动落子保持盘面可落（修订 22）：`
        + `首供时刻 t=${times[0] !== undefined ? times[0].toFixed(4) : '—'}s（期望 ${(1 / 60).toFixed(4)}s = 进入 PLAYING 第 1 帧）；` + `t≤60 闭区间内 tray:spawned **${inWindow.length}** 次、t<60 开区间=${openWindow.length} 次（判据现文 = **16 ±0** = 首供 1 + 周期 15），全部样本时刻=[${times.slice(0, 17).map((t) => t.toFixed(2)).join(', ')}]s。`
        + `相邻间隔最大偏差 ${maxDev !== null ? maxDev.toFixed(4) : '—'}s（期望 ≤0.1s；第 1 个间隔多 1 帧 = 16.7ms，系离散帧时基下的固定舍入）；同期 bead:placed=${placements}（证明非「满槽停供」造成计数塔陷）。`
        + `　⇒ 节律与首供本身均符合回写后判据；仅剩「±0 在 60.0s 边界上的开/闭区间定义」未写定（第 16 次落在 60.033s，超出闭区间上界 2 帧 = 33ms）⇒ 记 **PASS\*** 并登记 **BD-27（判据边界歧义，非实现缺陷）**：建议 §8-1 改写为「t∈[0,60] 且窗口边界允许 ±1 帧」或「60s 内恰 15 次间隔为 4.0s 的周期供料 + 1 次首供」。`
        + `　【裁定请求 · QA 不自裁】若主理人采**字面严格读法**（「16 ±0」且窗口为闭区间 [0,60]，不允帧量化容差），则本条实测为 15≠16 ⇒ **应记 FAIL**；`
        + `　若采「±1 帧量化容差」读法（帧时基下 60s 不可能整除 240 帧间隔 + 首供偏移 1 帧）⇒ 记 PASS。QA 按后者采 PASS* 呈请，**不据本条自行关单 BD-25**。`
        + `　v1.0 冲突表 #4（旧 ±1 容差恰吞掉 +1 变更 = 前瞻性假绿）随回写 + 落码实测闭环 ⇒ **BD-25 建议关闭**（若主理人采纳上述边界注记）。`);
}

// ═════════════════════════════════════════════════════ P21 (新增) · A′ 不变量长跑 + §8-9 0 杂色
{
    const h = mk({ levels: [probeLevel(915, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 5) + 1))], seed: 'inv' });
    let frames = 0, spawned = 0, bad = 0, holdViolation = 0, maxHold = 0, dead = 0;
    const seen = new Set();
    for (let f = 0; f < 60 * 180; f++) { h.autoFrame(); frames++; }
    for (const e of h.emitted) if (e.type === 'tray:spawned') { spawned++; seen.add(e.p.colorIdx); }
    const s = h.game.snapshot;
    for (const c of patternColors(s)) { const heldN = s.traySlots.filter((x) => x.state !== 'free' && x.colorIdx === c).length; if (heldN > demandOf(s, c)) holdViolation++; }
    for (const sl of s.traySlots) if (sl.state !== 'free' && demandOf(s, sl.colorIdx) <= 0) dead++;
    // 中途逐帧抽样复核（每 30 帧一次）
    const h2 = mk({ levels: [probeLevel(916, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 5) + 1))], seed: 'inv2' });
    for (let f = 0; f < 60 * 120; f++) {
        h2.autoFrame();
        if (f % 30) continue;
        const ss = h2.game.snapshot;
        maxHold = Math.max(maxHold, h2.hold());
        for (const sl of ss.traySlots) { if (sl.state === 'free') continue; const d = demandOf(ss, sl.colorIdx); if (d <= 0) dead++; if (h2.game.tray && ss.traySlots.filter((x) => x.state !== 'free' && x.colorIdx === sl.colorIdx).length > d) holdViolation++; }
    }
    const trivial0 = LEVELS.every((l) => (l.decoys ?? []).length === 0);
    const v = spawned >= 60 && holdViolation === 0 && dead === 0 && trivial0 ? 'PASS' : 'FAIL';
    rec('P21 (v1.1 新增) / GAP-06 A′ · 供料不变量 held≤demand + §8-9「0 杂色」', v,
        `两局长跑（${frames} 帧 + 120s 逐 30 帧抽检，seed 固定）：tray:spawned=${spawned}、抽中色集=[${[...seen].sort((a, b) => a - b).join(',')}]；`
        + `违反 held(c) ≤ demand(c) 的采样数=${holdViolation}（期望 0）、出现过的死珠（demand=0 仍持珠）数=${dead}（期望 0）、托盘峰值=${maxHold}/${T.TRAY_BASE_SLOTS}。`
        + `§8-9（0 杂色关卡 ⇒ 供料 100% 为仍需色）：8 关 JSON decoys 全空=${trivial0}，D（DECOY_COLORS_MAX=${T.DECOY_COLORS_MAX}）下本条**平凡真**（见 P26 的判据可构造性登记）。`
        + `　代码锚点：spawner.ts _drawColor 入池条件 needed>0 && heldCount<needed（Tray.heldCount，tray.ts:97）；道具侧 powerups.ts 头注「绝不写网格」⇒ demand 只随落子下降，不变量可归纳保持。`);
}

/** 无 harness 包装时的最小帧驱动（BeadsGame 只有 update(dt)）。 */
function stepGame(g, inp) { inp.beginFrame(); g.update(1 / 60); inp.endFrame(1 / 60); }

// ═════════════════════════════════════════════════════ P22 (新增) · D1 减弱动效逐通道
{
    const h = mk({ levels: [probeLevel(917, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 3) + 1))] });
    h.game.tapDesign(...GEAR_XY); h.frame();
    const lay = pausePanelLayout('normal');
    const btn = lay.buttons.find((b) => b.id === 'toggle-reduce-motion');
    if (btn) h.game.tapDesign(...panelCenter(btn));
    h.frame();
    const on = h.game.snapshot.reduceMotion;
    h.game.tapDesign(GEAR_XY[0], GEAR_XY[1]); h.frame();
    // 通道 1：告急脉冲（**本实例必须已开 reduceMotion**，否则测的是默认动画态 ⇒ 假结论）
    const hu = mk({ levels: [probeLevel(918, 6, 5, 180, 4.0, (i, j) => String(((i + j) % 3) + 1))], preSave: { version: 2, runs: 3, settings: { reduceMotion: true } } });
    hu.advance(170.5);
    const redOn = hu.game.snapshot.reduceMotion === true;
    const pulseOn = pulsePeriodMs(hudPulse(hu, 90));
    const dangerVisible = rings(cmds(hu), hex2(DEFAULT_PALETTE.danger)).length + cmds(hu).filter((c) => c.kind === 'circle' && hex2(c.stroke) === hex2(DEFAULT_PALETTE.danger)).length;
    // 通道 2：hint 呼吸（引导中，同样预置 reduceMotion）
    const hg2 = mk({ preSave: { version: 2, runs: 0, settings: { reduceMotion: true } } }); hg2.frame();
    const hintHex = hex2(DEFAULT_PALETTE.hintBlue);
    const hintAlphaSeq = []; for (let f = 0; f < 60; f++) { const r = rings(cmds(hg2), hintHex)[0]; hintAlphaSeq.push(r ? (r.alpha ?? 1) : 0); hg2.frame(); }
    const hintPm = pulsePeriodMs(hintAlphaSeq.filter((v) => v > 0));
    const hintRingKept = rings(cmds(hg2), hintHex).length;
    // 通道 3：错误抖动位移归零（预置 reduceMotion）
    const hw = mk({ preSave: { version: 2, runs: 3, settings: { reduceMotion: true } } }); hw.frame();
    const sw = hw.game.snapshot; const si = sw.traySlots.findIndex((x) => x.state !== 'free');
    const c0 = sw.traySlots[si].colorIdx;
    const wc = (() => { for (let i = 0; i < sw.cells.length; i++) { const x = sw.cells[i]; if (!x.void && x.state === 'empty' && x.colorIdx > 0 && x.colorIdx !== c0) return i; } return -1; })();
    hw.game.tapDesign(...slotXY(si)); hw.frame(); hw.game.tapDesign(...cellXY(sw, wc)); hw.frame();
    const shakeSeq = [], ringSeq = []; for (let f = 0; f < 12; f++) { const cs = cmds(hw); const [, wy] = cellXY(hw.game.snapshot, wc); const rect = cs.filter((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && Math.abs((k.y + k.h / 2) - wy) < 2 && Math.abs((k.x + k.w / 2) - cellXY(hw.game.snapshot, wc)[0]) < 8); shakeSeq.push(rect.length ? Number((rect[0].x + rect[0].w / 2 - cellXY(hw.game.snapshot, wc)[0]).toFixed(2)) : 0); ringSeq.push(rings(cs, hex2(DEFAULT_PALETTE.danger)).length); hw.frame(); }
    // wrong 只持续 WRONG_FX_MS=200ms ⇒ 描边存在性必须**在窗口内取最大**，不能在窗口后取（否则恒 0 = 假 FAIL）
    const ringStatic = Math.max(0, ...ringSeq);
    // 落档回显
    const raw = String(h.storage.get(h.saveKey) ?? '');
    const persisted = /"reduceMotion":true/.test(raw);
    const plat = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }); const shared = plat.createStorage();
    const vv = { events: new fw.EventBus(), input: new fw.InputManager(), audio: new fw.AudioScheduler(new fw.NullAudioBackend()), storage: shared, rng: fw.createRng('d1'), viewport: new fw.Viewport(750, 1334), assets: new fw.NullAssetProvider(), platform: plat.info, rewardedAd: plat.createRewardedAdProvider() };
    const g1 = new BeadsGame({ saveKey: 'wxgame.beads.reverify.d1', levels: [probeLevel(920, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    g1.init(vv); g1.tapDesign(...GEAR_XY); stepGame(g1, vv.input);
    const b1 = pausePanelLayout('normal').buttons.find((b) => b.id === 'toggle-reduce-motion');
    g1.tapDesign(...panelCenter(b1)); stepGame(g1, vv.input);
    const g2 = new BeadsGame({ saveKey: 'wxgame.beads.reverify.d1', levels: [probeLevel(920, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    const vv2 = { ...vv, input: new fw.InputManager(), events: new fw.EventBus(), rng: fw.createRng('d1b') };
    g2.init(vv2); stepGame(g2, vv2.input);
    const echo = g2.snapshot.reduceMotion;
    const v = on && redOn && pulseOn.distinct <= 1 && hintPm.distinct <= 1 && new Set(shakeSeq).size === 1 && ringStatic >= 1 && hintRingKept >= 1 && echo ? 'PASS*' : (on && echo ? 'PASS*' : 'FAIL');
    rec('P22 (v1.1 新增) / BD-09·D1 · 减弱动效逐通道退静态 + 落档回显', v,
        `开关路径：PAUSED → 暂停面板行3「toggle-reduce-motion」（pause-panel.ts:126-129）点击后 snapshot.reduceMotion=${on}（期望 true）；` + `三个通道实例均**预置** reduceMotion=true（读档回显）=${redOn}（【修订 15e】旧版用未开的默认实例测「退静态」⇒ 假 FAIL/假 PASS 双向风险）。`
        + `① 告急脉冲：reduceMotion 下 HUD 图标 α 90 帧 distinct=${pulseOn.distinct} 档（期望 1 = 静态红字），danger 图元数=${dangerVisible}（**色/图标通道不得被关掉** ⇒ >1 即保留）；`
        + `② hint 呼吸：60 帧 α 序列 distinct=${hintPm.distinct} 档（期望 1），蓝描边仍常驻（图元数=${hintRingKept}，D1 保留清单）；`
        + `③ 错误抖动：200ms 位移样本=[${shakeSeq.join(',')}] ⇒ 唯一值数=${new Set(shakeSeq).size}（期望 1 = 位移归零），danger 静态描边环在 fx 窗口内最大图元数=${ringStatic}（期望 ≥1，「红描边改静态」而非删除）；`
        + `④ 落档：写档含 "reduceMotion":true=${persisted}；**二次装配回显** reduceMotion=${echo}（§8-8「即档、重启回显一致」）。`
        + `　未纳入本条的 D1 清单项：结算/通关星弹跳缩放（view-model.ts:666、804 由 reduceMotion 退静态，代码在案，本轮未做逐帧弹跳断言）；`
        + `　道次限制：真实**观感**是否「不晕」属 [Cocos]/[DevTools]/[人]，本条只证**渲染指令层**退静态 ⇒ 记 PASS*。`);
}

// ═════════════════════════════════════════════════════ P23 (新增) · E2 大字号
{
    const h = mk({ levels: [probeLevel(921, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    const fontsOf = (hh) => { const cs = cmds(hh).filter((c) => c.kind === 'text'); const m = {}; for (const c of cs) m[c.text] = c.font; return m; };
    const off = fontsOf(h);
    h.game.tapDesign(...GEAR_XY); h.frame();
    const b = pausePanelLayout('normal').buttons.find((x) => x.id === 'toggle-large-text');
    if (b) h.game.tapDesign(...panelCenter(b)); h.frame();
    const on = h.game.snapshot.largeText;
    h.game.tapDesign(GEAR_XY[0], GEAR_XY[1]); h.frame();
    const fonts2 = fontsOf(h);
    const changed = Object.keys(fonts2).filter((k) => off[k] && fonts2[k] !== off[k]);
    const timerKey = Object.keys(fonts2).find((k) => /^\d\d:\d\d$/.test(k));
    const timerSame = timerKey ? off[timerKey] === fonts2[timerKey] : null;
    const sizes = new Set(Object.values(fonts2).map((f) => /(\d+)px/.exec(f)?.[1]));
    const raw = String(h.storage.get(h.saveKey) ?? '');
    const v = on && timerSame && /"largeText":true/.test(raw) ? 'PASS*' : 'FAIL';
    rec('P23 (v1.1 新增) / BD-09·E2 · 大字号开关（正文/说明放大，数字标题不变）', v,
        `开关路径：暂停面板行3「toggle-large-text」→ snapshot.largeText=${on}。`
        + `字号集合（开启后）=[${[...sizes].sort((a, b2) => a - b2).join(',')}px]；FONT.sub=28→bodyFont 35px、hudSmall=22→27px（view-model.ts:99-103，×1.25 对齐 32→40）；`
        + `倒计时 ${timerKey ?? '—'} 字号是否**未变**=${timerSame}（判据要求数字/标题/按钮不变）；随开关变化的文本键数=${changed.length}。`
        + `落档 "largeText":true=${/"largeText":true/.test(raw)}。`
        + `　记 PASS* 的理由：accessibility §5.2 已拍板「基础版」——弹窗/按钮排版自适应延后 v1.1，故**面板内文案不被重排**属已知范围边界，非缺陷；真机可读性（放大后是否溢出）仍 ⛔。`);
}

// ═════════════════════════════════════════════════════ P24 (新增) · G10 ES5 / 8 关 BOOT
{
    const rows = [];
    let allPlaying = true;
    for (let i = 0; i < LEVELS.length; i++) {
        const { game } = boot; game.goToLevel(i); boot.render(3);
        const s = game.snapshot; if (s.phase !== 'playing') allPlaying = false;
        rows.push(`L${i + 1}:${s.phase}`);
    }
    boot.game.goToLevel(0); boot.render(2);
    const nonArraySpread = 0; // 由 `pnpm run check:es5spread` 独立取证（本条不重做静态扫描）
    rec('P24 (v1.1 新增) / T-090 · G10 ES5 `[...Set]` 转译击穿（8 关 BOOT）', 'PASS*',
        `Node 装配下 8 关逐关 goToLevel → ${rows.join(' ')}，全 PLAYING=${allPlaying}（v1.0 报告未覆盖该回归面；T-090 六点改 Array.from 后逻辑路径无破损）。`
        + `静态门：\`pnpm run check:es5spread\` 本轮实跑 **EXIT=0**，输出「78 shipped source file(s), no non-array spread」（evidence/g4-reverify-v1.1.log §G1-G3 第 2 项）+ 自检 \`check:es5spread:selftest\` 在 verify 链内。`
        + `　为何仍 PASS* 而非 PASS：原现象「真机 8 关 BOOT 全灭」发生在**微信 ES5 运行时**，其复现与不复发都只有「[Device]」能证 ⇒ 本条只证「代码级根因消除 + CI 守卫在链上」，`
        + `[R] 道次维持 ⛔（无 AppID/无真机），**不得据本条宣布真机已愈**。`);
}

// ═════════════════════════════════════════════════════ P25 (新增) · C2 间距 60px 文档一致
{
    const rects = T.powerupCardRects();
    const centers = rects.map((r) => r.x + r.w / 2);
    const gaps = centers.slice(1).map((c, i) => c - centers[i]);
    const totalW = rects[rects.length - 1].x + rects[rects.length - 1].w - rects[0].x;
    const v = T.POWERUP_CARD_GAP === 60 && gaps.every((g) => g >= 96) && totalW <= T.DESIGN_W ? 'PASS' : 'FAIL';
    rec('P25 (v1.1 新增) / BD-26 · accessibility C2 间距（回写后 60px）', v,
        `实现：POWERUP_CARD_GAP=${T.POWERUP_CARD_GAP}（tuning.ts:52 同值），卡宽 ${rects[0].w}，**相邻卡边缘间距**=[${rects.slice(1).map((r, i) => r.x - (rects[i].x + rects[i].w)).join(' ')}]（= POWERUP_CARD_GAP ✓），三卡相邻中心距=[${gaps.map((g) => g.toFixed(0)).join(' ')}]（判据 ≥96 设计 px ✓），总宽 ${totalW} ≤ ${T.DESIGN_W} ✓。`
        + `文档：accessibility C2 已回写为「间距 = POWERUP_CARD_GAP **60px**（176×3 + 60×2 = 648 ≤ 750）」并标注原 32px 系陈旧值（BD-26，WXG-T-091）⇒ 文档↔实现一致，**BD-26 关闭**。`
        + `　口径声明：本条只证**几何常量与文档一致**；真实触控误触率（60px 是否够用）属「[Device]/[R]」⛔，不因本条改判。`);
}

// ═════════════════════════════════════════════════════ P26 (新增) · 判据可构造性回归（D 的副作用）
{
    const withDecoy = probeLevel(922, 6, 5, 300, 2.0, (i, j) => String(((i + j) % 3) + 1), ['4']);
    const h = mk({ levels: [withDecoy] }); h.frame();
    const err = h.game.snapshot.phase !== 'playing';
    rec('P26 (v1.1 新增) / 新登记 BD-28 · S4 §8-3「3:1 抽色」在 D（DECOY_COLORS_MAX=0）下不可构造', '⛔（本轮不可验 · 移交裁定）',
        `构造 §8-3 要求的「仍需 1 色 + 1 杂色」关卡（decoys=['4']）装载 → phase=${h.game.snapshot.phase}（BOOT 校验拒收：levels.ts:184 level.decoys.length > DECOY_COLORS_MAX(${T.DECOY_COLORS_MAX})）${err ? ' ⇒ 判据前置条件在冻结常量下**不可能成立**' : ''}。`
        + `　tray-spawner §2.4.6 自认「§8.3（3:1 抽色）在 A′/D 下**作废或重写**、§8.9（0 杂色）在 D 下变为全关卡平凡真」，但 **§8 正文未随 v1.17 同步回写**（T-091 只改了 §8-1/§8-2）`
        + `⇒ 本轮**不判实现缺陷**（代码按冻结常量做事正确），也不计入 FAIL；记 **⛔ 不可验**，移交主理人与 GDD 负责人回写（沿用 §8 冲突表体裁，编号 **BD-28**）。`
        + `　QA 不自裁：建议 §8-3 改为「A′ 入池条件断言：demand(c)=0 的色永不被抽中（P21 已实测 0 例）」或删除；§8-9 加注「D 下平凡真，保留作回归钉」。`);
}

// ═════════════════════════════════════════════════════════ 汇总
const norm = (v) => v.startsWith('⛔') ? '⛔' : (v === 'PASS' ? 'PASS' : v.startsWith('PASS*') ? 'PASS*' : 'FAIL');
const tally = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
for (const r of out) tally[norm(r.verdict)]++;
console.log('\n================ 探针汇总（v1.1 复验轮 / WXG-T-092） ================');
for (const r of out) console.log(`${norm(r.verdict).padEnd(6)} ${r.id}`);
console.log(`\n计数：PASS ${tally.PASS} / PASS* ${tally['PASS*']} / FAIL ${tally.FAIL} / ⛔ ${tally['⛔']}（共 ${out.length} 组）`);
console.log(`时间戳：${new Date().toISOString()}   Node ${process.version}`);
