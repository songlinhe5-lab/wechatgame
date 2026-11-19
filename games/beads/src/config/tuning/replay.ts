/**
 * EP15 · 机器人 / 回放常量 —— 镜像 `design/gdd/systems-index.md §3.15`（v2.01）。
 *
 * ⚠️ AUTHORITY：数值真源是 §3.15，本文件只是镜像；冲突以 §3 为准并登记漂移。
 * `[TODO]` / `[待 playtest]` 项不得当作冻结值引用（见 ADR-0038 §4.3）。
 */

/** §3.15 · 单份录像事件数上限；超限 ⇒ `truncated=true`、整份作废。 */
export const REPLAY_MAX_EVENTS = 8192;

/** §3.15 · 单份录像内存上限（字节）`[TODO：真机实测后冻结]`。 */
export const REPLAY_MAX_BYTES = 262144;

/** §3.15 · 回放/演示倍速档。只改影子时钟倍率，命令仍按 `step` 注入。 */
export const REPLAY_SPEEDS: readonly number[] = [1, 2, 4];

/** §3.15 · 固定步长（派生自框架 `GameLoop.fixedDt`）；`atMs` 量化到本步长。 */
export const REPLAY_FIXED_DT_MS = 1000 / 60;

/** §3.15 · seek 目标上钳 = `LEVEL_TIME_MAX(2500s) × 1000`。 */
export const REPLAY_SEEK_MAX_MS = 2500000;

/**
 * 字节口径的**逐事件确定性估算**（ADR-0038 DEC-3 授权实现常量随 S3 落码）：
 * 8 个数字字段 × 8B 的保守上界。`REPLAY_MAX_BYTES` 仍标 `[TODO]`。
 */
export const REPLAY_EVENT_BYTES_ESTIMATE = 64;

/** §3.15 · 单局机器人动作上限（来源 = `g3-lib.ts::runBot` 的 `maxMoves ?? 4000`）。 */
export const BOT_MAX_MOVES = 4000;

/** §3.15 · 演示/托管两次 `BotAction` 间隔（1x）。`[待 playtest]` 真机体感定档。 */
export const BOT_STEP_INTERVAL_MS = 450;

/** §3.15 · 连续 `decide()==null` 上限；=1 即首次无合法动作就停。 */
export const BOT_STUCK_LIMIT = 1;

/** §3.15 · 演示固定 seed 盐：`seed = hash(levelId + salt)`，同关每次演示逐帧一致。 */
export const REPLAY_DEMO_SEED_SALT = 'beads-demo-v1';
