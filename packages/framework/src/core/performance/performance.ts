/**
 * Runtime performance snapshot (WXG-T-414).
 *
 * All values are optional — not every host can produce every metric. WeChat
 * gives us `wx.getPerformance()` (foundation 2.11.0+), while web/node hosts
 * can only approximate FPS from their own loop and know nothing of JS heap.
 *
 * The snapshot is a **pull** model: the game shell calls
 * `services.getPerformance?.()` at its own cadence (e.g. every 10 s or on
 * pause) rather than the platform pushing events. This matches the
 * telemetry use case — we want a periodic "how's the run?" sample, not a
 * flood of per-frame updates.
 */

export interface PerformanceSnapshot {
  /**
   * Frames per second over the last sample window (weapp/web) or null if
   * the host cannot measure. Derived from wall-clock frame deltas.
   */
  readonly fps: number | null;
  /**
   * JS heap used in bytes (weapp `performance.memory.usedJSHeapSize`).
   * null on hosts with no memory introspection.
   */
  readonly heapBytesUsed: number | null;
  /** JS heap size in bytes (weapp only). */
  readonly heapBytesTotal: number | null;
  /**
   * Number of fixed-step loop frames whose wall-clock delta was clamped
   * during this session (spiral-of-death protection). High values correlate
   * with GC pauses or backgrounding. Derived from `FixedStepLoop.clampedFrames`.
   */
  readonly clampedFrames: number;
  /** Total fixed-step ticks executed during this session. */
  readonly ticks: number;
  /** Wall-clock seconds the loop has been running. */
  readonly loopTimeSeconds: number;
  /** Host-reported preferred frame rate (weapp via `setPreferredFramesPerSecond`). */
  readonly targetFps: number;
  /** True when the host dropped below target FPS for the last sample window. */
  readonly frameBudgetMiss: boolean;
}

/**
 * Compute FPS from a circular buffer of recent frame deltas.
 * exported for tests — hosts keep their own buffers; we just provide math.
 */
export function computeFps(deltasSeconds: readonly number[]): number {
  if (deltasSeconds.length === 0) return 0;
  const sum = deltasSeconds.reduce((a, b) => a + b, 0);
  if (sum <= 0 || !Number.isFinite(sum)) return 0;
  return deltasSeconds.length / sum;
}

// ── WXG-T-1075 逐帧运动节奏取样（诊断「帧耗时稳定但视觉卡顿」）────────────────
//
// 与上面的 `PerformanceSnapshot` 正交：快照量的是**每帧成本**（fps / heap / 掉帧
// 钳位），本模块量的是**位移在时间轴上的分布**。二者可以一个正常一个坏 —— 真机
// 反馈正是「面板帧耗时稳，拖动却一顿一顿」，所以光看 fps 永远查不出来。
//
// 采样口径（三列就够分辨工况，⛔ 在这里加耗时计时，那是快照那条腿的事）：
//   `dtMs`  本渲染帧的墙钟间隔；`steps` 本帧跑掉的固定步数（0 = 仿真没推进）；
//   `drew`  本帧是否真下发了重绘（脏帧门 `WXG-T-248` 会跳过干净帧）；
//   `dPos`  被跟踪点（棋盘相机 offsetX）相对上一帧的增量。

/** 一帧的运动节奏样本（`MotionRecorder` 环形槽位，字段可写以便覆写零分配）。 */
export interface MotionFrame {
  dtMs: number;
  steps: number;
  drew: boolean;
  dPos: number;
}

export type MotionVerdict =
  | 'insufficient'
  | 'smooth'
  | 'refresh-halved'
  | 'accumulator-jitter'
  | 'stall';

export interface MotionJudder {
  /** 判定结论（见 `judgeMotionJudder` 的判定表）。 */
  verdict: MotionVerdict;
  n: number;
  dtMedianMs: number;
  dtMaxMs: number;
  /** 帧间隔变异系数 std/mean：>0.05 说明宿主根本没锁住 vsync。 */
  dtCv: number;
  /** 零步帧占比：高刷屏（帧快于 fixedDt）的直接指纹。 */
  zeroStepShare: number;
  /** 一步以上（含补 2 步）的帧数：累加器抖动的指纹。 */
  multiStepFrames: number;
  /** 真重绘帧占比：脏帧门跳过了多少帧。 */
  drewShare: number;
  /** 相邻两次真重绘之间最大的墙钟间隔（ms）；≈ 2×dtMedian 即「同图连贴两帧」。 */
  presentGapMaxMs: number;
  /** 真重绘帧之间位移增量的非零 max/min：>1.5 即眼睛读得到的一顿一顿。 */
  moveIrregularity: number;
}

/**
 * 环形取样器：容量封顶（默认 240 帧 ≈ 高刷屏 2s / 60Hz 4s），热路径**只覆写预分配
 * 槽位、不新建对象**（工程铁律：热路径零分配）。未 `start` 时宿主不接线 ⇒ 零成本。
 */
export class MotionRecorder {
  readonly cap: number;
  private readonly _buf: MotionFrame[];
  private _w = 0;
  private _n = 0;
  private _last = 0;
  private _armed = false;

  constructor(capacity = 240) {
    this.cap = capacity > 0 ? Math.round(capacity) : 240;
    this._buf = [];
    for (let i = 0; i < this.cap; i += 1) {
      this._buf.push({ dtMs: 0, steps: 0, drew: false, dPos: 0 });
    }
  }

  /**
   * 每渲染帧调一次。`pos` = 被跟踪的屏幕位置（设计 px，如棋盘相机 `offsetX`）；
   * 首帧只立基线（`dPos = 0`），⛔ 把「开始记录」当成一次跳变。
   */
  frame(dtMs: number, steps: number, drew: boolean, pos: number): void {
    const slot = this._buf[this._w]!;
    slot.dtMs = dtMs;
    slot.steps = steps;
    slot.drew = drew;
    slot.dPos = this._armed ? pos - this._last : 0;
    this._armed = true;
    this._last = pos;
    this._w = (this._w + 1) % this.cap;
    if (this._n < this.cap) this._n += 1;
  }

  /** 按时间正序读出（诊断面专用，允许分配；不在每帧路径调用）。 */
  frames(): readonly MotionFrame[] {
    const out: MotionFrame[] = [];
    const start = (this._w - this._n + this.cap) % this.cap;
    for (let i = 0; i < this._n; i += 1) {
      const f = this._buf[(start + i) % this.cap]!;
      out.push({ dtMs: f.dtMs, steps: f.steps, drew: f.drew, dPos: f.dPos });
    }
    return out;
  }

  reset(): void {
    this._w = 0;
    this._n = 0;
    this._armed = false;
    this._last = 0;
  }

  /** 一行可粘贴的读数（贴给主理人/QA 用，⛔ 让人自己算）。 */
  report(): string {
    const j = judgeMotionJudder(this.frames());
    return `verdict=${j.verdict} n=${j.n} dt中位=${j.dtMedianMs.toFixed(2)}ms `
      + `dt最大=${j.dtMaxMs.toFixed(1)}ms cv=${j.dtCv.toFixed(3)} `
      + `零步帧=${(j.zeroStepShare * 100).toFixed(1)}% 多步帧=${j.multiStepFrames} `
      + `重绘帧=${(j.drewShare * 100).toFixed(1)}% 重绘间隔max=${j.presentGapMaxMs.toFixed(1)}ms `
      + `位移不均度=${j.moveIrregularity.toFixed(2)}`;
  }
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * 判定表（自上而下先命中先出，每条都对应用户能观察到的一种现象）：
 *   1. `n < 24`              ⇒ `insufficient`（拿十几帧判卡顿是猜）；
 *   2. 存在 `dtMs > 40`      ⇒ `stall`（真掉帧/GC/后台，走性能快照那条腿查）；
 *   3. `dt中位 < 12ms` 且零步帧 ≥25% ⇒ `refresh-halved`（屏幕比 1/60 快，同图连贴
 *      两帧 ⇒ 画面实际只有 dtMedian 倒数的一半在更新；ProMotion/120Hz 屏的指纹）；
 *   4. 帧间隔 cv > 5% 且出现补步 ⇒ `accumulator-jitter`（vsync 没锁住，累加器被推成
 *      0/2 步循环 ⇒ 「一帧不动、下一帧走两倍」）；
 *   5. 其余 ⇒ `smooth`（时间轴均匀 ⇒ 卡顿感得换假因，⛔ 赖在这条管线上）。
 */
export function judgeMotionJudder(frames: readonly MotionFrame[]): MotionJudder {
  const n = frames.length;
  const dts = frames.map((f) => f.dtMs);
  const dtMedianMs = median(dts);
  const dtMaxMs = n > 0 ? Math.max(...dts) : 0;
  const mean = n > 0 ? dts.reduce((a, b) => a + b, 0) / n : 0;
  const std = n > 0 ? Math.sqrt(dts.reduce((a, b) => a + (b - mean) ** 2, 0) / n) : 0;
  const dtCv = mean > 0 ? std / mean : 0;
  const zeroStepShare = n > 0 ? frames.filter((f) => f.steps === 0).length / n : 0;
  const multiStepFrames = frames.filter((f) => f.steps >= 2).length;
  const drewShare = n > 0 ? frames.filter((f) => f.drew).length / n : 0;

  // 相邻两次真重绘之间的墙钟间隔（跳过脏帧门没放行的帧）。
  let presentGapMaxMs = 0;
  let lastDrawAt = Number.NaN;
  let clock = 0;
  for (const f of frames) {
    clock += f.dtMs;
    if (f.drew) {
      if (Number.isFinite(lastDrawAt)) presentGapMaxMs = Math.max(presentGapMaxMs, clock - lastDrawAt);
      lastDrawAt = clock;
    }
  }
  // 位移不均度只看真重绘帧（没重绘的帧画面本来就没变，不算"顿"）。
  const moves = frames.filter((f) => f.drew && f.dPos !== 0).map((f) => Math.abs(f.dPos));
  const moveIrregularity = moves.length > 1
    ? Math.max(...moves) / Math.min(...moves)
    : moves.length === 1 ? 1 : 0;

  const base = { n, dtMedianMs, dtMaxMs, dtCv, zeroStepShare, multiStepFrames, drewShare, presentGapMaxMs, moveIrregularity };
  if (n < 24) return { verdict: 'insufficient', ...base };
  if (dtMaxMs > 40) return { verdict: 'stall', ...base };
  if (dtMedianMs < 12 && zeroStepShare >= 0.25) return { verdict: 'refresh-halved', ...base };
  if (dtCv > 0.05 && multiStepFrames >= 2) return { verdict: 'accumulator-jitter', ...base };
  return { verdict: 'smooth', ...base };
}

// ── [WXG-T-1077] 宿主接线片：把 recorder 挂到 App 的每帧钩子上 ──────────────
//
// 放在 core 而不是各 adapter，是为了让 **Cocos 宿主 / 微信真机 / 浏览器 harness**
// 共用同一条取样口径（同一判据表，⛔ 各写一遍统计）。本文件只依赖结构类型，
// 不 import `compose/app.js`（方向：compose → core，不许反向）。

/** 接线片所需的最小宿主面（`App` 结构满足；测试可用假对象）。 */
export interface MotionProbeHost {
  motionProbe: ((dtMs: number, steps: number, drew: boolean) => void) | null;
}

export interface MotionProbeOptions {
  /** 环形容量，默认 600 帧。 */
  readonly capacity?: number;
  /** 被跟踪位置（如棋盘相机 offsetX）；不传 ⇒ 位移列恒 0，节奏三列照常判。 */
  readonly readPos?: () => number;
  /** 采到该帧数自动打一行读数（真机远程日志可直接 grep），只打一次。 */
  readonly autoReportFrames?: number;
  /** 输出道子；不传 ⇒ 即使设了 `autoReportFrames` 也不自动打（core ⛔ 塞 console）。 */
  readonly log?: (line: string) => void;
}

export interface MotionProbe {
  /** 是否已自动打过读数。 */
  readonly reported: boolean;
  frames(): readonly MotionFrame[];
  report(): string;
  /** 摘钩（此后热路径不再回调）。 */
  stop(): void;
}

export function armMotionProbe(host: MotionProbeHost, options: MotionProbeOptions = {}): MotionProbe {
  const rec = new MotionRecorder(options.capacity ?? 600);
  const readPos = options.readPos ?? (() => 0);
  const auto = options.autoReportFrames && options.autoReportFrames > 0 ? options.autoReportFrames : 0;
  const log = options.log;
  let seen = 0;
  let fired = false;
  host.motionProbe = (dtMs: number, steps: number, drew: boolean): void => {
    rec.frame(dtMs, steps, drew, readPos());
    seen += 1;
    if (auto > 0 && !fired && log && seen >= auto) {
      fired = true;
      log(rec.report());
    }
  };
  return {
    get reported(): boolean { return fired; },
    frames: (): readonly MotionFrame[] => rec.frames(),
    report: (): string => rec.report(),
    stop: (): void => { host.motionProbe = null; },
  };
}

// ── WXG-T-1110 宿主绘制成本（P0 诊断：把「画一帧花多少」送上覆层）──────────────
//
// 与上面两条腿正交：`PerformanceSnapshot` 是周期快照（fps/heap），`MotionRecorder`
// 是位移分布；本投影量的是**一帧内部的成本拆分**——`onRender` 里那段时间（宿主
// `Graphics` 逐图元重建几何 + 提交）到底吃掉多少毫秒、这帧一共下了几次笔。
//
// 为什么必须由 App 计时：`buildRenderModel` 只产命令流，真正的几何重建发生在宿主
// `onRender` 内部（Cocos 侧在 `renderer.draw` 的 `fill()/stroke()` 里同步跑完）；
// 游戏层看不到那段，所以只能由 `App._render` 卡表并投影给游戏读。
//
// ⛔ 不要把它做成模块级单例：那是隐式全局状态，harness/多 App 并存时读数会串台。
//    本投影经 `GameServices.readDrawCost` 显式下发，谁持有 App 谁才读得到。

/** 一帧绘制成本读数（只读投影；`App` 每渲染 tick 更新）。 */
export interface DrawCostReading {
  /**
   * `onRender` 内墙钟毫秒的 EMA（α = 0.1）。含宿主渲染器的**全部**同步成本：
   * Cocos 侧 = 逐图元路径写入 + 三角化 + 描边扩张 + mesh 上传提交。
   *
   * ⚠️ 三项在「还没量过」时全为 `0`（首帧前 / 刚有人读的第一帧）：0 只表示无样本，
   * 消费端 `> 0` 才显示（⛔ 不要拿 0 当「本帧零耗时」）。
   */
  readonly drawMs: number;
  /**
   * 本帧**真下笔**次数 = 像素图元（rect / circle / line / polygon）的
   * `fill` 次数 + `stroke` 次数。文字 / 位图 / 容器命令**不计**（它们不走
   * `Graphics.fill/stroke`）。
   */
  readonly paintCalls: number;
  /** 本帧命令总条数（含 text / blit / 容器与裁切命令），用于分辨「命令多但下笔少」。 */
  readonly commands: number;
  /**
   * `[WXG-T-1111]` 宿主分段时间；未接线的宿主恒为全 0（消费端据此隐藏细分行）。
   * 与上面三项共用同一个对象 ⇒ 读取零分配。
   */
  readonly breakdown: DrawCostBreakdown;
  /**
   * `[WXG-T-1113]` `App.tick` 全程墙钟 EMA（α = 0.1）：固定步循环 + 建模 + `onRender`
   * （即 `drawMs` 含在内）。引擎调度的 update 相位就在这段里。`0` = 还没量过
   * （loop-bridge 未注入 clock / 无人读过成本 ⇒ 未接线），消费端 `> 0` 才显示。
   */
  readonly tickMs: number;
  /**
   * `[WXG-T-1113]` 引擎渲染段墙钟 EMA（α = 0.1）：`Director.EVENT_BEFORE_DRAW` →
   * `EVENT_AFTER_DRAW`（batcher 提交 + mesh 上传 + present）。与 `tickMs` 不重叠
   * （引擎 render 相位在 update 之后）⇒ `tickMs + engineDrawMs` ≈ 整帧。`0` = 未接线。
   */
  readonly engineDrawMs: number;
  /**
   * `[WXG-T-1114]` 帧间空档 EMA（α = 0.1）：上帧 `EVENT_AFTER_DRAW` 终点 → 本帧
   * `tick` 起点。该段 JS 不执行——理想 ≈ 0，读数大 ⇒ GPU/present 反压或宿主调度
   * 推迟了 rAF（引擎每帧提交的顶点量超过 GPU 吞吐时的指纹）。`0` = 未量过
   * （首帧前 / 探针未接线），消费端 `> 0` 才显示。
   */
  readonly idleMs: number;
}

/**
 * `[WXG-T-1111]` 绘制成本分段时间（宿主渲染器测量，经 `App.reportDrawBreakdown` 回投）。
 *
 * 四段之和 ≈ `drawMs`（宿主只计自己的分派段；段外开销归 `scopeMs`）。每段是**本帧**
 * 的墙钟毫秒，⛔ 不做 EMA —— 要与总数同帧对齐，才能判断 22.8 ms 到底落在哪条腿。
 */
export interface DrawCostBreakdown {
  /** 矢量图元段：rect / circle / line / polygon 的路径写入 + `fill()/stroke()`。 */
  readonly vectorMs: number;
  /** 位图段：`blitCarrier.accept(...)` 内的节点属性更新 / 纹理绑定 / 上传。 */
  readonly blitMs: number;
  /** 文字段：Label 借用、测宽、setText / setPosition。 */
  readonly textMs: number;
  /** 其余：帧首清屏、容器/段/裁切切换、变换、底图提交体。 */
  readonly scopeMs: number;
  /** 落到各段的命令条数（矢量 / 位图 / 文字），用于分辨「少而贵」还是「多而快」。 */
  readonly vectorCalls: number;
  readonly blitCalls: number;
  readonly textCalls: number;
}
