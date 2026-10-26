/**
 * Persisted Beads save document — minimal sprint-slice schema
 * (full S8 field set is a later sprint; the **key** is the deliberate
 * exception that code owns — systems-index §3 note).
 *
 * Design rules carried over from the breakout 判例:
 * 1. **Degrade, never throw.** Corrupt/out-of-range documents are repaired and
 *    written back exactly once.
 * 2. **Only progression is stored** — never mid-run state (combo, tray, grid).
 */

import type { Migration, SaveDocument, Storage } from '../../framework/index';
import {
  BEAD_SIZE_DEFAULT,
  BEAD_SIZE_ORDER,
  type BeadSizeKind,
  STAR_MAX,
  VIBRATE_DEFAULT,
} from '../config/tuning';
// **换肤三字段的注册真源**：珠体风格 id = `config/bead-styles/registry.ts`；
// **整套皮肤 = skins registry**（EP12-S8：`config/skins/registry.ts`，用户 2026-10-07 裁定 1
// 「暖纸即默认 + 冷紫灰收编可选肤」）。S8 §8-12 构造 ③ 「字符串合法但未注册 ⇒ 单独回落
// 默认」只能在读档层判，否则非法值会一路走到渲染侧被「静默兜底」，档内永远留着脏值。
// 方向说明：本行是 game → config 的**只读函数**引用（registry 仅 import 两个皮肤模块，
// 无环）；默认档 id 与渲染默认**同一真源**（`DEFAULT_SKIN_ID`），⛔ 不得在存档层另写
// `'warm-paper'` 字面量。
import { DEFAULT_BEAD_STYLE_ID, isRegisteredStyleId } from '../config/bead-styles/registry';
import { DEFAULT_SKIN_ID, skinById } from '../config/skins/registry';

/**
 * Persisted toggles (save-progress §2.2 + accessibility D1/E2, WXG-T-088): four
 * independent channels, persisted the instant they are toggled. Missing fields
 * degrade **per field** to false — a document is never discarded because
 * `settings` lacks a key. This per-field default is exactly what lets the v1→v2
 * bump (adding `reduceMotion` / `largeText`) stay backward compatible.
 */
export interface BeadsSettings {
  /** Music channel muted (`bgmMuted`). */
  readonly bgmMuted: boolean;
  /** Sfx channel muted (`sfxMuted`). */
  readonly sfxMuted: boolean;
  /** D1 减弱动效：关停非必要位移 / 脉冲（accessibility §4）。 */
  readonly reduceMotion: boolean;
  /** E2 大字号：正文 / 说明类文本放大（accessibility §5）。 */
  readonly largeText: boolean;
  /**
   * 触觉震动开关（§3.8 VIBRATE_DEFAULT = ON，WXG-T-164 拍板⑦）：默认 **true**，
   * 仅 isMiniGame 平台显示行（pause-settings v1.3 §8-12）；屏震语义不受本开关控制。
   */
  readonly vibrate: boolean;
  /**
   * DEBUG 性能覆层开关（pause-settings v1.6 §2.2）：真机 QA 无 console / query 可用，
   * 需跨重启保留。缺字段逐字段降级 false（同 v1→v2 判例，无需版本 bump）；仅控制覆层
   * 绘制，不碰玩法与存档数据。
   */
  readonly debugInfo: boolean;
  /**
   * 菜单安全区标定线（设置里的 Debug 开关）。缺字段逐字段降级 false，
   * ⛔ SAVE_VERSION 不 bump（同 `debugInfo`）。只控制菜单上的三条标定线。
   */
  readonly debugGuides: boolean;
  /**
   * 换肤两字段（**EP11-S5 / S8 v1.1 §8-11~13**）：珠子风格与豆径档的末值。
   * - `beadStyle`：string styleId，默认 `DEFAULT_BEAD_STYLE_ID`（= `facet-4`）；
   * - `beadSize`：枚举 BeadSizeKind，默认 BEAD_SIZE_DEFAULT（= 'full' 满豆）。
   * 两者均住 `settings` 对象，随**即写**落盘（§2.5 即写族，与四开关同一写入通道），
   * **不新造事件名**，**不存历史栈**（只存末值）。
   * ⛔ **SAVE_VERSION 不 bump**：逐字段降级 = debugInfo 判例，缺字段按单字段默认处理，
   *   无需版本迁移（S8 §8-12「version 无需为此 bump」）。
   */
  readonly beadStyle: string;
  readonly beadSize: BeadSizeKind;
  /**
   * **整套皮肤 id**（EP12-S8 · WXG-T-268 批 2 裁定①；T-267 mvp 批 1）：
   * string skinId，默认 `DEFAULT_SKIN_ID`（= `'warm-paper'`，注册序首位即默认肤）。
   * 与 `beadStyle`（珠体风格）**正交两维**（arch.md D5：不合并）；随**即写**落盘
   * （同上族），不存历史栈。非法值逐字段降级（四构造同 `beadStyle` 判例），
   * ⛔ **SAVE_VERSION 不 bump**（同上判例）。
   */
  readonly skinId: string;
}

export interface BeadsSave extends SaveDocument {
  version: 5;
  /** Runs started — the "first launch" test is `runs === 0` (S1 §8-1). */
  runs: number;
  /**
   * 显式「已完成首屏引导」标记（WXG-T-097 · BD-32）：`runs` 每次 BOOT 自增、
   * 不能作「是否见过引导」的真源（首玩落子前杀进程 ⇒ runs=1 ⇒ 旧判定永久失
   * 引导）。首次落子置 true 并落盘；`normalizeBeadsSave` 对**无字段的 v2 存量档**
   * 以 `runs > 0` 一次性迁移（老玩家不重看引导）。
   */
  onboarded: boolean;
  /**
   * 已解锁最远关的**稳定身份 token**（ADR-0034 **DEC-7** / S-2b）——「解锁位」。
   * `''` = 无身份指针（出厂默认 / 尚无推进）。⛔ 存 1-based 位置数：位置会在
   * 「章内插一关 / 调展示序」时把语义挪到别的关（§8-23）；数值形态只剩 v4 旧档的
   * **一次性入口**（旧键 `maxUnlockedLevel`，写回时点名清除）。
   * 身份只住档内：BOOT 由 `normalizeBeadsSave` 解析成 **0-based 下标镜像**，
   * 视图契约继续吃 1-based 数值（L5 零改动）。
   */
  maxUnlockedKey: string;
  /** 续玩点的身份 token（「推进位」）；`''` 同义。与解锁位**各自判定、各自降级**（DEC-7）。 */
  lastPlayedKey: string;
  /** Best sprint score ever (S8 v1.1 field, minimal slice). */
  sprintBestScore: number;
  /** Best sprint stage index ever reached (0-based). */
  sprintBestStage: number;
  /**
   * 每关**历史最高星**，按关卡**稳定内容身份**记账（ADR-0034 **DEC-1**；判据 =
   * `design/gdd/save-progress.md` v1.3 §2.6.2 **I2**）—— S8 GDD §2.2 的 `stars`，
   * 键名与序列化形态住代码（该文文首「刻意例外」）。
   * - 键 = 生成期注入的稳定身份 token（`L000NN`，plate 第 c 格 = `L000NN#c`），
   *   值 = 该关历史最高星 ∈ `[0, STAR_MAX]`；语义 = 过关时 `max(旧, 新)`（§8-2）不变。
   * - v5 文档内 ⛔ **不再并存位置型 `starsByLevel`**（两套并存 = 第二真源，`changed`
   *   无法自洽）；旧数组只作 §2.6.5 一次性入口的**输入侧**兼容。
   * - 终态 = 按 `levelKeys` **稠密物化**（含 0 值），⇒ 形状确定、幂等可自证（DEC-5 规则 4）。
   */
  starsByUid: Record<string, number>;
  /** S9 audio toggles (save-progress §2.2; written on every switch). */
  settings: BeadsSettings;
}

/** Storage key — namespaced (architecture-beads §2: `wxgame.beads.save.v1`). */
export const SAVE_KEY = 'wxgame.beads.save.v1';
/** Where an unreadable document is preserved before being discarded. */
export const BACKUP_KEY = 'wxgame.beads.save.v1.bak';
/**
 * v5（ADR-0034 **DEC-4**）：星账从「位置别名数组」换制为「身份→星数映射」——
 * 与 v1→v2 / v2→v3 / v3→v4 的「加可选字段 + 逐字段降级」不同档，属
 * `control-manifest §5`「schema 变更 ⇒ 升版本 + 写迁移」，⛔ 不 bump 会让「version 仍写 4、
 * 形态已是 5」的档在多包共存期无法判别。
 */
export const SAVE_VERSION = 5;

/**
 * v1 → v2（WXG-T-088）：新增可访问性开关 `reduceMotion`（D1）与 `largeText`
 * （E2）。迁移**只升版本号并原样透传旧字段**——缺省的新字段交由 `normalizeSettings`
 * 逐字段降级为 false，因此旧档进度与原 settings 全保留、绝不重置（旧档不炸）。
 *
 * **S-7 改严**（ADR-0034 §6 S-7）：每级迁移必须返回 `n+1`（本函数 ⇒ `2`），
 * ⛔ 再返回 `SAVE_VERSION`。旧行为「一条跳到底」会让 v1–v3 档根本不流经后续迁移，
 * 后续任何一级结构迁移都会被静默跳过。
 */
export function migrateV1ToV2(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, version: 2 };
}

/**
 * v2 → v3（WXG-T-097 · BD-32）：新增显式引导标记 `onboarded`。迁移**只升版本号
 * 并原样透传旧字段**——缺省字段交由 `normalizeBeadsSave` 判定：无 `onboarded` 的
 * v2 存量档以 `runs > 0` 一次性迁移（玩过的 = 已引导），新档由 default 显式 false。
 */
export function migrateV2ToV3(doc: Record<string, unknown>): Record<string, unknown> {
  // ⚠ 迁移必须在**本函数**内落 `onboarded`：SaveManager.load 会先用 defaults 补
  // 缺字段再交给 normalize ⇒ normalize 层无法区分「v2 无字段」与「显式 false」。
  // 存量玩家（runs>0）一次性迁移为已引导；v3 后字段由 default/写入恒在。
  // S-7：返回 `3`（⛔ `SAVE_VERSION`）。
  return {
    ...doc,
    onboarded: doc['onboarded'] !== undefined ? doc['onboarded'] === true : num(doc['runs'], 0) > 0,
    version: 3,
  };
}

/**
 * v3 → v4（WXG-T-164 拍板⑦）：settings 新增 `vibrate`（默认 ON）。同 v1→v2
 * 判例：**只升版本号透传旧字段**，缺省字段由 `normalizeSettings` 逐字段降级。
 */
export function migrateV3ToV4(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, version: 4 };
}

/**
 * v4 → v5（ADR-0034 **DEC-4**）：**只做版本标记 + 旧字段原样透传**（沿 v1→v2 判例）。
 * ⛔ 不在迁移函数里做 uid 换算：`Migration` 签名是 `Record → Record`
 * （`packages/framework/src/core/save/save-manager.ts`），**拿不到关表轴**；真正的
 * 对位换算住 `normalizeBeadsSave` 的形态探测（DEC-5）——那是唯一持有关表轴的层。
 * ⚠ 历史事实（DEC-5）：S-7 之前本族四条迁移均返回 `SAVE_VERSION` 而非 `n+1` ⇒ 一条迁移
 *   即跳到底，v1/v2/v3 老档根本不流经 `migrations[4]`。**S-7 已改严**：每级各返回
 *   `n+1`，v1 档逐级走完 1→2→3→4→5（形态探测仍必须能兼住旧档，二者不互斥）。
 */
export function migrateV4ToV5(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, version: 5 };
}

/**
 * 迁移链的**单一真源**（S-7）：`SaveManager` 与测试都从这里取，⛔ 两处各写一张 map
 * （否则「测试注册全链、生产漏一级」这类漂移在测试里看不见）。
 * 键 = 源版本，值 = 升到 `键 + 1` 的迁移；缺任何一级 ⇒ `load()` 在缺位处 reset。
 */
export const BEADS_MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
};

export function defaultBeadsSave(): BeadsSave {
  return {
    version: SAVE_VERSION,
    runs: 0,
    onboarded: false,
    maxUnlockedKey: '',
    lastPlayedKey: '',
    sprintBestScore: 0,
    sprintBestStage: 0,
    // 星账在 `normalizeBeadsSave(raw, levelCount, levelKeys)` 里按身份表稠密物化
    //（出厂默认不知关表 ⇒ 空映射；与旧 `starsByLevel: []` 同型）。
    starsByUid: {},
    settings: {
      bgmMuted: false,
      sfxMuted: false,
      reduceMotion: false,
      largeText: false,
      vibrate: VIBRATE_DEFAULT,
      debugInfo: false,
      debugGuides: false,
      beadStyle: DEFAULT_BEAD_STYLE_ID,
      beadSize: BEAD_SIZE_DEFAULT,
      skinId: DEFAULT_SKIN_ID,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read one boolean field, degrading per-field (save-progress §2.2: 缺字段按单
 * 字段默认 false，不弃整档).
 */
function boolField(raw: unknown, key: string, fallback: boolean): boolean {
  if (!isRecord(raw)) return fallback;
  const value = raw[key];
  return typeof value === 'boolean' ? value : fallback;
}

/** Normalise the `settings` sub-document — never throws, never drops the save. */
export function normalizeSettings(raw: unknown): BeadsSettings {
  // 换肤字段的**逐字段**降级（S8 §8-12 四构造：①缺字段 ②类型错 ③未注册 ④越界）：
  // - `beadStyle`：非字符串 / 空串 / **未在 registry 注册** ⇒ 单独回落 `DEFAULT_BEAD_STYLE_ID`；
  // - `beadSize`：非枚举值 ⇒ 单独回落 `BEAD_SIZE_DEFAULT`（= 满豆）；
  // - `skinId`（EP12-S8）：非字符串 / 空串 / **未在 skins registry 注册** ⇒ 单独回落
  //   `DEFAULT_SKIN_ID`（= 暖纸）。三者**互不牵连**，也不牵其余字段
  //  （S9 §8-18「不弃整档、其余字段无损」）；
  // 本函数只在 BOOT / 写档兜底路径上跑，⛔ 不进每帧热路径（故 `includes` 与
  // `styleById`/`skinById` 的开销可接受；渲染侧每帧取皮肤走实例引用，Map 查表零分配）。
  const styleRaw = isRecord(raw) ? raw['beadStyle'] : undefined;
  const sizeRaw = isRecord(raw) ? raw['beadSize'] : undefined;
  const skinRaw = isRecord(raw) ? raw['skinId'] : undefined;
  return {
    bgmMuted: boolField(raw, 'bgmMuted', false),
    sfxMuted: boolField(raw, 'sfxMuted', false),
    reduceMotion: boolField(raw, 'reduceMotion', false),
    largeText: boolField(raw, 'largeText', false),
    // §3.8 VIBRATE_DEFAULT = ON：缺字段降级为 true（与其余四开关的 false 相反）。
    vibrate: boolField(raw, 'vibrate', VIBRATE_DEFAULT),
    debugInfo: boolField(raw, 'debugInfo', false),
    debugGuides: boolField(raw, 'debugGuides', false),
    beadStyle:
      typeof styleRaw === 'string' && isRegisteredStyleId(styleRaw)
        ? styleRaw
        : DEFAULT_BEAD_STYLE_ID,
    beadSize: (BEAD_SIZE_ORDER as readonly string[]).includes(sizeRaw as string)
      ? (sizeRaw as BeadSizeKind)
      : BEAD_SIZE_DEFAULT,
    skinId:
      typeof skinRaw === 'string' && skinRaw !== '' && skinById(skinRaw) !== undefined
        ? skinRaw
        : DEFAULT_SKIN_ID,
  };
}

/** Non-negative finite number, else `fallback`. */
function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** A 1-based level index inside `[1, levelCount]`, else `null` when invalid. */
function levelIndex(value: unknown, levelCount: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > levelCount) return null;
  return value;
}

/** 指针解析结果：`>= 0` = 命中下标；{@link POINTER_MISMATCH} = 身份已不在关表；{@link POINTER_ABSENT} = 无身份键。 */
const POINTER_MISMATCH = -1;
const POINTER_ABSENT = -2;

/**
 * 解析一根身份指针（**只读键比对**，不读任何星值）：
 * - 非字符串 / `''` ⇒ `POINTER_ABSENT`（走 v4 旧数值入口或兜底）；
 * - 字符串且在当前关表里 ⇒ 命中下标；
 * - 字符串但关表认不出 ⇒ `POINTER_MISMATCH`（进入 Q8 丙档降级）。
 */
function resolvePointer(rawKey: unknown, levelKeys: readonly string[]): number {
  if (typeof rawKey !== 'string' || rawKey === '') return POINTER_ABSENT;
  const index = levelKeys.indexOf(rawKey);
  return index >= 0 ? index : POINTER_MISMATCH;
}

export interface NormalizeResult {
  readonly save: BeadsSave;
  /** True when anything was repaired — the caller should write back. */
  readonly changed: boolean;
  /**
   * 存在于原始文档、但 v5 形态里不该再有的键名（ADR-0034 **DEC-1**「⛔ 两套并存」的执行腿）。
   * ⚠ 为什么单列一份清单：`SaveManager.patch` 是**浅合并、不删键**
   * （`packages/framework/src/core/save/save-manager.ts:121`），而框架 core 在本单授权外
   * ⇒ 只把新字段塞进 `save` 无法把旧位置型数组从档里**物理抹掉**（双轨并存）。
   * 调用方须把本清单交给 `toBeadsSavePatch`；它同时是 `changed` 的一条成因（DEC-5 规则 4
   * 幂等臂：旧键未清除前，第二次读必须仍报 changed）。
   */
  readonly staleKeys: readonly string[];
  /** 解锁位的 **0-based 下标镜像**（运行时唯一消费形态；身份只住档内）。 */
  readonly maxUnlockedIndex: number;
  /** 续玩位的 0-based 下标镜像（`bootLevel` 用它 + 1 还原 1-based）。 */
  readonly lastPlayedIndex: number;
}

/** 旧形态键名（只作**输入侧**一次性兼容与写回清除用，⛔ 不再作字段）。 */
const STALE_STARS_KEY = 'starsByLevel';
/**
 * 旧**数值指针**键（v4 及以前）。S-2b 后它们只是 v4 档的一次性入口 ——
 * ⚠ 必须点名清除：框架 `patch` 浅合并**不删键**，不清则旧键永久留在档里
 * （沿 M-6 / M-19 同一课）。
 */
const STALE_POINTER_KEYS = ['maxUnlockedLevel', 'currentLevel'] as const;

/** 单值钳：非有限数 → 0；小数**向下取整**；再钳 `[0, STAR_MAX]`（S8 §6 口径逐字不变）。 */
function clampStar(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(STAR_MAX, Math.floor(value)));
}

interface StarLedger {
  readonly stars: Record<string, number>;
  /** 档内**有条目**、当前关表对不上号 ⇒ 逐条作废的条数（= `I3`「可枚举」的丢弃维，DEC-9）。 */
  readonly dropped: number;
  /** 当前关表**有槽**、档内无条目 ⇒ 补 0 的槽数（新关 / 档短于关表）。 */
  readonly missing: number;
  /** 形态探测结果（DEC-5）：`uid` = v5 直读 · `legacy` = v4 一次性入口 · `none` = 无星账。 */
  readonly form: 'uid' | 'legacy' | 'none';
  readonly changed: boolean;
}

/**
 * 星账归一化 = **身份轴**上的读档换算（ADR-0034 **DEC-5** 形态探测三级，唯一裁定；
 * 判据 = `design/gdd/save-progress.md` v1.3 §2.6.2 **I2** / §2.6.5 / **§8-16 ～ §8-17、§8-21**）。
 *
 * 1. 档内 `starsByUid` 是**非空记录** ⇒ v5 直读：逐键对位，当前关表认不出的键 = 孤儿
 *    ⇒ **该条单独作废**（`dropped++`），⛔ 不挪给别的关、⛔ 不弃整档、⛔ 不抛异常（§2.4 v1.3 行 +
 *    §8-17）；能能对位的逐条无损。
 * 2. 否则档内 `starsByLevel` 是数组 ⇒ **v4 一次性入口**：旧第 i 位 = 写档那一刻关表第 i 关
 *    （DEC-6 的一次性假设：未上架 + v1.22 已把轴对齐到当前关表），按 `levelKeys[i]` 对位搬运。
 *    ⛔ 这是位置型字段最后的用途，v5 之后不再有位置轴（§8-21「⛔ 与 §8-14 双轨并存则红」）。
 * 3. 两者皆无 ⇒ 全槽 0（沿旧「非数组 ⇒ 全 0」臂语义），新档由调用方一次写回稠密终态。
 *
 * 终态 = 按 `levelKeys` **稠密物化**（尾趟统一补 0）⇒ 形状确定、幂等可自证；单值仍逐条钳
 * `[0, STAR_MAX]`（**DEC-1** 末条）。无身份槽（`''`，= dev 导入草案）不占键位；旧档映射到
 * 这类槽的条目计作 `dropped`（该位无处落键）。`dropped > 0` 也计入 `changed`：孤儿留在档里
 * = 「写回裁剪」没兑现已（DEC-9），且会让 §8-17 幂等臂失去归因。
 *
 * ⚠ 只在 BOOT 读档边界跑（每启动 ≤1 次）；函数局部 `Set` 建表已得到 DEC-3 明文放行
 *   （`control-manifest §2` 例外：存档读写、初始化），⛔ 不得进 `update` / `buildRenderModel`。
 */
function normalizeStarLedger(
  raw: Record<string, unknown>,
  levelKeys: readonly string[],
): StarLedger {
  const out: Record<string, number> = {};
  const ids = new Set<string>();
  for (let i = 0; i < levelKeys.length; i += 1) {
    const key = levelKeys[i];
    if (key !== '') ids.add(key);
  }
  const doc = raw['starsByUid'];
  const legacy = raw[STALE_STARS_KEY];
  let dropped = 0;
  let changed = false;
  let form: StarLedger['form'] = 'none';

  if (isRecord(doc) && Object.keys(doc).length > 0) {
    form = 'uid';
    const keys = Object.keys(doc);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (!ids.has(key)) {
        dropped += 1;
        continue;
      }
      const value = clampStar(doc[key]);
      out[key] = value;
      if (doc[key] !== value) changed = true;
    }
  } else if (Array.isArray(legacy)) {
    form = 'legacy';
    const carry = Math.min(legacy.length, levelKeys.length);
    for (let i = 0; i < carry; i += 1) {
      const key = levelKeys[i];
      if (key === '') {
        dropped += 1;
        continue;
      }
      out[key] = clampStar(legacy[i]);
    }
    dropped += Math.max(0, legacy.length - levelKeys.length);
    // 旧形态只进一次：无论对位结果如何，写回都必须是新字段（§8-21「写回恰一次」）。
    changed = true;
  }

  // 稠密尾趟：有槽无账 ⇒ 补 0（新关无记录 = 正常事实，不是异常）。⛔ 三条规则各自散着
  // 补位（旧写法只有规则 3 补 ⇒ 规则 1/2 产出稀疏账，夹具的「完好档幂等」臂无法自证）。
  let missing = 0;
  for (let i = 0; i < levelKeys.length; i += 1) {
    const key = levelKeys[i];
    if (key === '' || out[key] !== undefined) continue;
    out[key] = 0;
    missing += 1;
  }
  if (missing > 0 || dropped > 0) changed = true;
  return { stars: out, dropped, missing, form, changed };
}

/** 逐字段比较（含 normalize 兜底的缺字段 / 类型错场景），⛔ 不对整个 settings 对象做序列化比较。 */
function settingsEqual(a: BeadsSettings, b: BeadsSettings): boolean {
  return (
    a.bgmMuted === b.bgmMuted &&
    a.sfxMuted === b.sfxMuted &&
    a.reduceMotion === b.reduceMotion &&
    a.largeText === b.largeText &&
    a.vibrate === b.vibrate &&
    a.debugInfo === b.debugInfo &&
    a.debugGuides === b.debugGuides &&
    a.beadStyle === b.beadStyle &&
    a.beadSize === b.beadSize &&
    a.skinId === b.skinId
  );
}

/**
 * Repair a loaded document into a valid one (degrade, never throw).
 *
 * 第三参 `levelKeys`（ADR-0034 **DEC-3**）= 与 `levelCount` 同轴的**稳定身份表**，
 * 由 `BeadsGame` 在 BOOT 装配关表时构造一次并存为只读镜像（身份表构造式见
 * `config/levels.ts`；第 i 项 = 第 i 关的身份 token；无身份槽为 `''`）。星账换算只在此层发生；
 * ⛔ 视图 / 结算路径不得再构造（否则 = 第二条读取路径，被 `§8-22-④` 静态臂拒收）。
 * 取**必填**而非可选：强制每个调用点显式对账身份轴，防止「忘传⇒默默走前缀搬运」。
 */
export function normalizeBeadsSave(
  raw: unknown,
  levelCount: number,
  levelKeys: readonly string[],
): NormalizeResult {
  const boundedCount = Math.max(1, Math.floor(levelCount));
  const fallback = defaultBeadsSave();

  if (!isRecord(raw)) {
    return { save: fallback, changed: true, staleKeys: [], maxUnlockedIndex: 0, lastPlayedIndex: 0 };
  }

  // ── 两根进度指针（S-2b / DEC-7 / Q8 丙档 · v1.3-R4 锚源收窄）──────────────
  // 解析序：身份键命中 > v4 旧数值键一次性入口 > 兜底。
  // **两根各自判定、各自降级**，⛔ 把一根的语义搬给另一根。
  // Q-A 拍定 A1：v4 旧数值入口**可**作另一根的锚（混合档只出现在开发期，写回即清）。
  const maxResolved = resolvePointer(raw['maxUnlockedKey'], levelKeys);
  const lastResolved = resolvePointer(raw['lastPlayedKey'], levelKeys);
  // 旧数值键（1-based）只对「无身份键」的 v4 档生效；越界 / 非整数 ⇒ 视为无。
  const legacyMax = levelIndex(raw['maxUnlockedLevel'], boundedCount);
  const legacyLast = levelIndex(raw['currentLevel'], boundedCount);
  // 「可作锚的另一根」：只认命中或旧数值入口，⛔ 把失配值当锚。
  const maxKnown = maxResolved >= 0 ? maxResolved : legacyMax !== null ? legacyMax - 1 : -1;
  const lastKnown = lastResolved >= 0 ? lastResolved : legacyLast !== null ? legacyLast - 1 : -1;

  let maxUnlockedIndex: number;
  let lastPlayedIndex: number;
  let downgraded = 0;

  if (maxResolved === POINTER_MISMATCH) {
    // Q8 丙档（判据源 `save-progress §2.6.4.1` 定义 1/2）：失配 ⇒ 回落到**另一根仍可解析的
    // 指针**所指的关；⛔ 静默回 1（乙档已否）。
    // 星账键集⛔ 作锚（v1.3-R4）：终态星账**稠密物化**（每关补 0）⇒ 键存在性恒真，取「装配序
    // 最靠后」必落**表末位** = 禁止实现②「白送全章」；读星值又被④封死 ⇒ 星账在本档无证据。
    // 另一根也指不回 ⇒ 定义 4 兜底首个开放章首关（本版 = 第 1 关）。
    maxUnlockedIndex = lastKnown >= 0 ? lastKnown : 0;
    downgraded += 1;
  } else {
    maxUnlockedIndex = maxKnown >= 0 && maxKnown < levelKeys.length ? maxKnown : 0;
  }

  if (lastResolved === POINTER_MISMATCH) {
    // 同上（各自判定）：锚 = 解锁位；两根都指不回 ⇒ 定义 4 兜底。
    lastPlayedIndex = maxKnown >= 0 ? maxKnown : 0;
    downgraded += 1;
  } else {
    lastPlayedIndex = lastKnown >= 0 && lastKnown < levelKeys.length ? lastKnown : 0;
  }

  // 身份只住档内：写回值 = 下标镜像反查回 token（⛔ 反解 token、⛔ 自造 token）。
  const maxUnlockedKey = levelKeys[maxUnlockedIndex] ?? '';
  const lastPlayedKey = levelKeys[lastPlayedIndex] ?? '';

  const ledger = normalizeStarLedger(raw, levelKeys);
  // 旧位置型数组与**旧数值指针**都必须在写回时物理消失（DEC-1「⛔ 双轨」/ M-19）。
  const staleKeys: string[] = [];
  if (raw[STALE_STARS_KEY] !== undefined) staleKeys.push(STALE_STARS_KEY);
  for (let i = 0; i < STALE_POINTER_KEYS.length; i += 1) {
    const key = STALE_POINTER_KEYS[i];
    if (raw[key] !== undefined) staleKeys.push(key);
  }
  // 可观测性 = `I3`「孤儿记录可枚举」与 §2.4「不弹错、不中断启动」的平衡点：只在
  // **档内真有条目被丢弃**时留一行汇总（`missing` 作信息量同行报出：新关无记录 = 正常事实，
  // ⛔ 不单独触发告警，否则每次出厂新档都会误报）；一次性、⛔ 逐条刷屏、⛔ 不新增玩家可见
  // 反馈（S8 §4「降级静默」）。测试臂用**注入桩捕该 warn**，不用源码正则（§17 教训）。
  if (ledger.dropped > 0) {
    console.warn(`[beads] save uid unmatched: dropped=${ledger.dropped}, missing=${ledger.missing}`);
  }
  // Q8 可观测（§2.6.4.1 定义 6）：失配次数进 logger，⛔ 玩家可见反馈。
  // ⚠ 射程边界②的 `grant_chapter_unknown` **本批未实现**：它需章维信息（「锚是否落在
  //   原已获准进入的那一章」），而存档层拿不到章表；按统一规则回落并如实登记。
  if (downgraded > 0) {
    console.warn(
      `[beads] save pointer downgraded: count=${downgraded}, maxUnlocked=${maxUnlockedKey || '(none)'}, lastPlayed=${lastPlayedKey || '(none)'}`,
    );
  }
  // 一次性取出原始 settings 引用（归一入参、`changed` 比较与注释均读它，⛔ 不二次下标）。
  const rawSettings = raw['settings'];

  const save: BeadsSave = {
    version: SAVE_VERSION,
    runs: num(raw['runs'], 0),
    onboarded: raw['onboarded'] === true,
    maxUnlockedKey,
    lastPlayedKey,
    sprintBestScore: num(raw['sprintBestScore'], 0),
    sprintBestStage: num(raw['sprintBestStage'], 0),
    starsByUid: ledger.stars,
    settings: normalizeSettings(rawSettings),
  };

  const changed =
    raw['runs'] !== save.runs ||
    // 身份指针：v4 档无新键（undefined ≠ token）或失配降级（旧 token ≠ 新 token）都报真。
    raw['maxUnlockedKey'] !== save.maxUnlockedKey ||
    raw['lastPlayedKey'] !== save.lastPlayedKey ||
    raw['sprintBestScore'] !== save.sprintBestScore ||
    raw['sprintBestStage'] !== save.sprintBestStage ||
    // 星账侧的 changed 全部由 `normalizeStarLedger` 裁定（形态 ≠ v5 直读、孤儿丢弃、缺条目、
    // 逐键钳正任一即真）；旧形态键未清除也必须报真，否则幂等臂无法自证（DEC-5 规则 4）。
    ledger.changed ||
    staleKeys.length > 0 ||
    rawSettings === undefined ||
    !isRecord(rawSettings) ||
    // **B1-Q3 `changed` 自我比较怪癖修正**（EP11-S5）：旧写法将 `normalizeSettings(raw)`
    // 与 `save.settings`（**同一次 normalize 的产物**）手展开逐字段比较 ⇒ 两恒相等，
    // settings 字段除了「整体缺失」外永不报 changed（单字段缺失 / 非法值不补写回）。
    // 现按**原始文档 vs 归一结果**比较 ⇒ 缺字段与非法值都能触发一次补写回。
    // 口径不变项：仍为 patch 型全量写档、只存末值、不 bump `SAVE_VERSION`（S8 §8-12）。
    // 下转安全：上一行 `isRecord` 已保证它是对象；字段缺失 / 类型错读出 `undefined` 或不
    // 等值 ⇒ 恰好是要报 changed 的场景（本处不需要归一后的类型，比较的就是原始脏值）。
    !settingsEqual(rawSettings as unknown as BeadsSettings, save.settings);

  return { save, changed, staleKeys, maxUnlockedIndex, lastPlayedIndex };
}

/**
 * **展平**（uid 账 → 下标稠密数组）：ADR-0034 **DEC-3** 第一条转换，
 * 唯一调用点 = `beads-game.ts` BOOT 读档边界（每启动 ≤1 次）。
 * 运行时（7 处按下标取数与全部视图）继续吃下标数组 ⇒ 身份**不进热路径**
 * （`control-manifest §2`）；入参已是 `normalizeBeadsSave` 的钳正产物 ⇒ 本函数只投影，
 * ⛔ 不再钳（双钳 = 两条口径，钳臂 M-7 会失去归因）。
 */
export function flattenStars(
  stars: Readonly<Record<string, number>>,
  levelKeys: readonly string[],
): number[] {
  const out = new Array<number>(levelKeys.length).fill(0);
  for (let i = 0; i < levelKeys.length; i += 1) {
    const key = levelKeys[i];
    if (key === '') continue;
    const value = stars[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[i] = value;
  }
  return out;
}

/**
 * **收拢**（下标数组 → uid 账）：**DEC-3** 第二条转换，唯一调用点 = `_persistProgress()`
 * （每局 ≤1 次，S8 §2.5「结算写」）。无身份槽（`''`）不入档 ⇒ ⛔ 不发明 token 格式、
 * 也不污染别的记录。身份唯一性已由生成期断言保证（S-1 断言①），故不存在同键两槽。
 */
export function collapseStars(
  slots: readonly number[],
  levelKeys: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  const n = Math.min(slots.length, levelKeys.length);
  for (let i = 0; i < n; i += 1) {
    const key = levelKeys[i];
    if (key === '') continue;
    out[key] = slots[i];
  }
  return out;
}

/**
 * 组装写档补丁 = v5 全字段 + **物理删除**旧形态键。
 *
 * ⚠ 为何需要本函数（而不是直接 `patch(save)`）：框架 `patch` 浅合并且不删键，
 * 而 `JSON.stringify` 会**省略值为 `undefined` 的键**（`storage.ts` 的 `JsonStorage.setJSON`）
 * ⇒ 把 `staleKeys` 逐个置 `undefined` 是当前授权面内唯一能把旧数组从档里物理抹掉、
 * 又不去改 `packages/framework/src/core/**` 的做法（DEC-1「⛔ 两套并存」的执行腿）。
 */
export function toBeadsSavePatch(
  save: BeadsSave,
  staleKeys: readonly string[],
): Partial<BeadsSave> {
  const out: Record<string, unknown> = { ...save };
  for (let i = 0; i < staleKeys.length; i += 1) out[staleKeys[i]] = undefined;
  return out as unknown as Partial<BeadsSave>;
}

/**
 * Preserve an unparseable document before `SaveManager` discards it.
 * Best-effort: a failure here must never block boot.
 */
export function preserveCorruptBackup(storage: Storage, key: string = SAVE_KEY): boolean {
  try {
    const raw = storage.get(key);
    if (raw === null || raw === undefined) return false;
    try {
      JSON.parse(raw);
      return false; // parseable — nothing to preserve
    } catch {
      storage.set(`${key}.bak`, raw);
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Which level to enter on boot (S1 §8-1, no menu)：
 *   - `runs === 0` → level 1 (first launch)
 *   - otherwise    → 续玩位身份解析出的 **0-based 下标** + 1（还原 1-based 契约）
 *
 * 签名变化（S-2b）：不再吃 `save.currentLevel`（位置数已从档里消失）；
 * 身份 → 下标的换算**只**发生在 `normalizeBeadsSave` 一处（DEC-3），
 * 本函数只做 1-based 还原，⛔ 第二处换算。
 */
export function bootLevel(save: Pick<BeadsSave, 'runs'>, lastPlayedIndex: number): number {
  if (save.runs === 0) return 1;
  return lastPlayedIndex + 1;
}
