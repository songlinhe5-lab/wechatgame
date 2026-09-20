/**
 * In-level crash snapshot (D-03 落码轮，WXG-T-059).
 *
 * 设计真源：`games/beads/design/proposals/in-level-snapshot.md`（v0.1，T-055 产出）。
 * 该提案自身写明「本轮禁止改 `save-schema.ts` / 禁止落运行时写档」并标 §7「落码时，非本轮」
 * —— 本轮是**新轮次**：提案的「不做」条款约束的是 T-055 那一轮，不是本模块。
 *
 * 核心口径（提案 §5 方案 A、主理人裁定）：
 *   1. **另键**：`wxgame.beads.crash.v1`，与 S8 常规档 `wxgame.beads.save.v1` 物理隔离。
 *      S8 仍只存长期进度；`save-schema.ts` 一字未改，S8 `version` 未升。
 *   2. **可丢**：损坏/越界/版本不符 → 静默丢整份快照（玩家无感），**不中断启动**、
 *      **绝不动 S8**。快照丢了最坏是重打本关。
 *   3. **不是进度真源**：图案字符/关卡表/调参/`needed[]` 一律**不入快照**——
 *      BOOT 用 `levelIndex` + 现行关卡表重建，快照只负责"盖回去"。
 *
 * ⚠️ 对提案 §2 字段表的**必要增补**（2 项，均有既有冻结依据，不是发明）：
 *   · `reviveCount` —— T-057 已冻结 `REVIVE_MAX_PER_LEVEL = 1`（失败页续时每关上限）。
 *     若不入快照，杀进程恢复后 `_reviveCount` 归零 ⇒ 玩家可**再续一次**，
 *     直接绕过那条冻结规则。存它 = 遵守规则的前提。
 *   · `reviveBonusSec` —— 续时奖励秒参与过关星级计算（`computeClearStars`）。
 *     不存则恢复后过关**多给星**（用 `reviveCount > 0` 判定复活、却丢了奖励秒）。
 *   提案 §2 的其余字段**原样采用**；`writtenAtMs` 按提案默认**不设 TTL**。
 */

import { POWERUP_FREE_USES, TRAY_BASE_SLOTS, TRAY_EXPAND_SLOTS } from '../config/tuning.js';
import type { Storage } from '@wxgame/framework';

/** 另键（提案 §5 方案 A）。终稿归代码，此处为落码值。 */
export const CRASH_KEY = 'wxgame.beads.crash.v1';
export const CRASH_VERSION = 1;

export type CrashMode = 'normal' | 'sprint';
export type CrashPauseIntent = 'manual' | 'system';

/** 托盘槽：`colorIdx = 0` 表示 free（提案 §2）。 */
export interface CrashTraySlot {
  readonly colorIdx: number;
}

/**
 * S6 三计数 —— 语义 = **已用次数**（`0..POWERUP_FREE_USES`；WXG-T-060 起写真值，
 * 此前恒 0）。字段**可缺省**，缺省 = 三项 0；越界按**字段级**钳到
 * `[0, POWERUP_FREE_USES]` 而不丢整份快照（提案 §4 降级矩阵）。上限钳制所需的
 * `POWERUP_FREE_USES` 已随 S6 落码可用，故 T-059 留的「待补」在本轮关闭。
 */
export interface CrashPowerupUses {
  readonly solver: number;
  readonly solverPlus: number;
  readonly solverRandom: number;
}

/** 冲刺运行时态（仅 `mode === 'sprint'` 时非 null）。 */
export interface CrashSprintState {
  readonly streak: number;
  readonly multiplier: number;
  readonly tier: number;
  readonly score: number;
  readonly stageIndex: number;
  readonly bestStage: number;
  /**
   * 本局最高连击（`ux-spec §3.5` 左列的展示量，WXG-T-067 增补；缺省 ⇒ 0，**不弃整份快照**
   * ——纯展示量不值得为它丢一局恢复档）。
   */
  readonly bestStreak: number;
  readonly windowRemaining: number;
}

/** 校验通过后的崩溃快照（调用方拿到的就是"可信"的）。 */
export interface CrashSnapshot {
  readonly version: typeof CRASH_VERSION;
  readonly writtenAtMs: number;
  readonly mode: CrashMode;
  readonly levelIndex: number;
  readonly pauseIntent: CrashPauseIntent;
  /** 只覆盖**可填格**的位串，行主序；`'0'` = empty，`'1'` = filled。 */
  readonly gridFilled: string;
  readonly traySlots: readonly CrashTraySlot[];
  readonly trayExpanded: boolean;
  readonly traySelected: number;
  readonly remaining: number;
  readonly timeTotal: number;
  readonly spawnAcc: number;
  readonly spawnInterval: number;
  readonly spawnFullReported: boolean;
  readonly powerupUses: CrashPowerupUses;
  /** T-057 冻结规则的必要载体，见文件头。 */
  readonly reviveCount: number;
  readonly reviveBonusSec: number;
  readonly sprint: CrashSprintState | null;
}

/** 校验所需的外部事实（都由现有关卡表 / 常量导出，不额外存）。 */
export interface CrashContext {
  /** 现行关卡表长度（越界即丢）。 */
  readonly levelCount: number;
  /**
   * **可填格数**（= 快照位图应有长度）；越界 / 非法索引应返回 0。
   *
   * ⚠️ 必须带 `mode`：**冲刺模式的棋盘来自舞台图案**（`buildStagePattern(stageIndex)`），
   * 与 `levelIndex` 指向的普通关卡**毫无关系**。WXG-T-059 首版只传 `levelIndex`，
   * 导致冲刺快照的位图长度校验必然失败、整份被静默丢弃 —— 由 §8-15 判据抓出。
   */
  readonly fillableCountFor: (spec: {
    readonly mode: CrashMode;
    readonly levelIndex: number;
    readonly stageIndex: number;
  }) => number;
}

/** 读档结果：`snapshot === null` 时 `reason` 说明丢弃原因（仅供 logger，玩家无感）。 */
export interface CrashReadResult {
  readonly snapshot: CrashSnapshot | null;
  readonly reason: string;
}

// ───────────────────────────────────────────────────────── 位图（提案 §2）────

/**
 * 编码「可填格」填充位图：行主序，`'0'` = empty，`'1'` = filled。
 *
 * 只含可填格——`locked`（`x`）与 `.` void 由关卡图案重建，**禁止另存**（防双真源）。
 */
export function encodeFilledBits(filled: readonly boolean[]): string {
  let out = '';
  for (const bit of filled) out += bit ? '1' : '0';
  return out;
}

/**
 * 解码位图。长度必须精确等于 `expectedLength`，否则返回 `null`（调用方丢快照）。
 * 只接受 `0` / `1` 字符——出现其他字符即视为损坏。
 */
export function decodeFilledBits(bits: unknown, expectedLength: number): boolean[] | null {
  if (typeof bits !== 'string') return null;
  if (bits.length !== expectedLength) return null;
  const out: boolean[] = [];
  for (const ch of bits) {
    if (ch === '0') out.push(false);
    else if (ch === '1') out.push(true);
    else return null;
  }
  return out;
}

// ───────────────────────────────────────────────────────── 校验/降级 ─────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** 非负整数，否则 null。 */
function nonNegInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/** 逐字段钳制（越界钳到 `[0, POWERUP_FREE_USES]`，不丢整份快照——提案 §4）。 */
function clampPowerups(raw: unknown): CrashPowerupUses {
  const pick = (key: keyof CrashPowerupUses): number => {
    if (!isRecord(raw)) return 0;
    const n = nonNegInt(raw[key]);
    return n === null ? 0 : Math.min(n, POWERUP_FREE_USES);
  };
  return { solver: pick('solver'), solverPlus: pick('solverPlus'), solverRandom: pick('solverRandom') };
}

/**
 * 解析 + 校验（提案 §4 降级矩阵逐条落字段）。**永不抛异常**。
 *
 * 任一硬条件不满足 → `snapshot: null` + 原因；`powerupUses` 子字段越界只**钳**
 * 不丢；`traySelected` 越界钳 `-1`。
 */
export function parseCrashSnapshot(raw: unknown, ctx: CrashContext): CrashReadResult {
  const bad = (reason: string): CrashReadResult => ({ snapshot: null, reason });
  try {
    if (!isRecord(raw)) return bad('非对象');

    const version = finiteNumber(raw['version']);
    if (version !== CRASH_VERSION) return bad(`version 缺失或不符（${String(raw['version'])}）`);

    const mode = raw['mode'];
    if (mode !== 'normal' && mode !== 'sprint') return bad(`mode 非法（${String(mode)}）`);

    const levelIndex = nonNegInt(raw['levelIndex']);
    if (levelIndex === null || levelIndex >= ctx.levelCount) {
      return bad(`levelIndex 越界（${String(raw['levelIndex'])} / 共 ${ctx.levelCount}）`);
    }

    // 冲刺：棋盘由舞台图案决定 ⇒ 位图长度必须按 `stageIndex` 算（见 CrashContext 注释）。
    const sprintPeek = mode === 'sprint' && isRecord(raw['sprint']) ? raw['sprint'] : null;
    const stagePeek = sprintPeek === null ? 0 : (nonNegInt(sprintPeek['stageIndex']) ?? 0);
    const fillable = ctx.fillableCountFor({ mode, levelIndex, stageIndex: stagePeek });
    const bits = decodeFilledBits(raw['gridFilled'], fillable);
    if (bits === null) {
      return bad(`gridFilled 长度不符（应为 ${fillable}）`);
    }

    const traySlotsRaw = raw['traySlots'];
    if (!Array.isArray(traySlotsRaw)) return bad('traySlots 非数组');
    const traySlots: CrashTraySlot[] = [];
    for (const slot of traySlotsRaw) {
      if (!isRecord(slot)) return bad('traySlots 元素非对象');
      const colorIdx = nonNegInt(slot['colorIdx']);
      if (colorIdx === null) return bad('traySlots.colorIdx 非非负整数');
      traySlots.push({ colorIdx });
    }
    const maxTray = TRAY_BASE_SLOTS + TRAY_EXPAND_SLOTS;
    if (traySlots.length !== TRAY_BASE_SLOTS && traySlots.length !== maxTray) {
      return bad(`traySlots 长度 ${traySlots.length} 不属 {${TRAY_BASE_SLOTS}, ${maxTray}}`);
    }

    const trayExpanded = raw['trayExpanded'];
    if (typeof trayExpanded !== 'boolean') return bad('trayExpanded 非布尔');
    if (trayExpanded !== (traySlots.length === maxTray)) {
      return bad(`trayExpanded(${trayExpanded}) 与托盘长度(${traySlots.length}) 矛盾`);
    }

    const timeTotal = finiteNumber(raw['timeTotal']);
    if (timeTotal === null || timeTotal <= 0) return bad(`timeTotal 非法（${String(raw['timeTotal'])}）`);
    const remaining = finiteNumber(raw['remaining']);
    if (remaining === null || remaining < 0 || remaining > timeTotal) {
      return bad(`remaining 非法（${String(raw['remaining'])} / total ${timeTotal}）`);
    }

    const spawnInterval = finiteNumber(raw['spawnInterval']);
    if (spawnInterval === null || spawnInterval <= 0) {
      return bad(`spawnInterval 非法（${String(raw['spawnInterval'])}）`);
    }
    const spawnAccRaw = finiteNumber(raw['spawnAcc']);
    if (spawnAccRaw === null || spawnAccRaw < 0) return bad('spawnAcc 非法');
    const spawnAcc = Math.min(spawnAccRaw, spawnInterval); // 钳到 [0, interval)

    const traySelectedRaw = raw['traySelected'];
    const traySelected =
      typeof traySelectedRaw === 'number' &&
      Number.isInteger(traySelectedRaw) &&
      traySelectedRaw >= -1 &&
      traySelectedRaw < traySlots.length
        ? traySelectedRaw
        : -1;

    const sprintRaw = raw['sprint'];
    let sprint: CrashSprintState | null = null;
    if (mode === 'sprint') {
      if (!isRecord(sprintRaw)) return bad('sprint 缺失或非对象（sprint 模式必需）');
      const need = (key: string): number | null => {
        const n = finiteNumber(sprintRaw[key]);
        return n === null || n < 0 ? null : n;
      };
      const streak = nonNegInt(sprintRaw['streak']);
      const multiplier = need('multiplier');
      const tier = nonNegInt(sprintRaw['tier']);
      const score = need('score');
      const stageIndex = nonNegInt(sprintRaw['stageIndex']);
      const bestStage = nonNegInt(sprintRaw['bestStage']);
      const bestStreak = nonNegInt(sprintRaw['bestStreak']) ?? 0;
      const windowRemaining = need('windowRemaining');
      if (
        streak === null ||
        multiplier === null ||
        tier === null ||
        score === null ||
        stageIndex === null ||
        bestStage === null ||
        windowRemaining === null
      ) {
        return bad('sprint 子字段缺失或非法');
      }
      sprint = {
        streak,
        multiplier,
        tier,
        score,
        stageIndex,
        bestStage,
        bestStreak,
        windowRemaining,
      };
    } else if (sprintRaw !== null && sprintRaw !== undefined) {
      return bad('普通关携带了非空 sprint（提案 §4：丢）');
    }

    const writtenAtMs = finiteNumber(raw['writtenAtMs']) ?? 0;
    const pauseIntent = raw['pauseIntent'] === 'manual' ? 'manual' : 'system';
    const spawnFullReported = raw['spawnFullReported'] === true;

    // 增补字段（见文件头）：缺省按 0，越界按标记丢/钳。
    const reviveCount = nonNegInt(raw['reviveCount']) ?? 0;
    const reviveBonusSecRaw = finiteNumber(raw['reviveBonusSec']);
    const reviveBonusSec = reviveBonusSecRaw !== null && reviveBonusSecRaw >= 0 ? reviveBonusSecRaw : 0;

    return {
      snapshot: {
        version: CRASH_VERSION,
        writtenAtMs,
        mode,
        levelIndex,
        pauseIntent,
        gridFilled: raw['gridFilled'] as string,
        traySlots,
        trayExpanded,
        traySelected,
        remaining,
        timeTotal,
        spawnAcc,
        spawnInterval,
        spawnFullReported,
        powerupUses: clampPowerups(raw['powerupUses']),
        reviveCount,
        reviveBonusSec,
        sprint,
      },
      reason: '',
    };
  } catch {
    // 提案 §4：「读/写抛错 → 捕获，当缺失」。守在此处保证调用方永不因快照崩溃。
    return bad('解析抛错');
  }
}

/** 序列化为可写入 storage 的 JSON 字符串。 */
export function serializeCrashSnapshot(snapshot: CrashSnapshot): string {
  return JSON.stringify(snapshot);
}

/**
 * 另键读写器（提案 §5 方案 A）。**全部方法都不抛异常**：
 * 读失败/校验失败 → `null`（并清掉坏档）；写失败（配额）→ 返回 `false` 由调用方静默。
 */
export class CrashSnapshotStore {
  constructor(
    private readonly _storage: Storage,
    private readonly _key: string = CRASH_KEY,
  ) {}

  /**
   * 读 + 校验。任何失败路径都会**删除**该键（提案 §4：缺失/坏档/version 不符 →
   * 删除崩溃档，走常规 `_boot()`），避免坏档每局都被重读一次。
   */
  read(ctx: CrashContext): CrashSnapshot | null {
    let rawText: string | null = null;
    try {
      rawText = this._storage.get(this._key);
    } catch {
      return null;
    }
    if (rawText === null || rawText === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      this.clear(); // JSON 坏 → 丢
      return null;
    }

    const { snapshot } = parseCrashSnapshot(parsed, ctx);
    if (snapshot === null) this.clear();
    return snapshot;
  }

  /**
   * 写入（只在 `onPause` 路径调用，提案 §3）。返回 `false` 表示写失败——
   * 调用方**静默**处理（与 S8 §6「存储满不向玩家报错」同口径），本局内存态继续。
   */
  write(snapshot: CrashSnapshot): boolean {
    try {
      this._storage.set(this._key, serializeCrashSnapshot(snapshot));
      return true;
    } catch {
      return false;
    }
  }

  /** 删除（结算/过关/失败/重玩路径；提案 §3「禁止的时机」表）。永不抛。 */
  clear(): void {
    try {
      this._storage.remove(this._key);
    } catch {
      /* 配额/平台异常：忽略——快照是可丢的 */
    }
  }
}
