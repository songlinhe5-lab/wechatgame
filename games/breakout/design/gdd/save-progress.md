# GDD · S8 存档与进度（Save & Progress）

> 版本 v1.0 · 依赖：S5（最高分）、S6（通关进度）· 被依赖：S9（设置持久化）

---

## 1. 目标
用**本地存储**持久化最小必要数据（进度、最高分、设置），做到"退出再回来，一切照旧"，无需登录、无需后端。

## 2. 机制
- 存储介质：框架 `Storage` 抽象（微信端 `wx.setStorageSync`，Web 端 `localStorage`）。
- 单个 JSON 键：**`wxgame.breakout.save`**（带 `wxgame.` 平台命名空间，避免与宿主或其他小游戏存储键冲突）。
  > ⚠️ **键名以代码 `save-schema.ts` 为准**（存档键名/结构属 `systems-index §3`「唯一真源」的**刻意例外**，归代码侧管理）。原设计稿中的 `bp.save.v1` **已作废**。项目从未发布、零玩家数据 → **不涉及迁移**，直接统一。
- **写入时机**：仅在**关键事件**写入（避免每帧写盘）。
  - 关卡通关（更新 `maxUnlockedLevel`）
  - 游戏结束 / 通关（更新 `bestScore`）
  - 设置变更（音量等）
  - 拾取到进度类变更（如有）
- **读取时机**：BOOT 阶段一次性读入内存，之后运行时读内存、按需写盘。

## 3. 输入
- 事件：`level:cleared`、`game:over`、设置变更。
- 存储抽象 API：`Storage.get(key)` / `Storage.set(key, value)`。

## 4. 存档结构（**最终版 · 工程侧照此实现**）与启动续进

> **字段集以此为准**（主理人裁定：本设计版为最终版，代码侧按此补齐）。字段名、类型、默认值**均不得歧义**，可直接落码。
> 代码侧已有的 `bestCombo` / `runs` / `bricksDestroyed` 作为 `stats` 保留（见下）——**因此统计项统一命名为 `runs`**（首次判定依据）。

```ts
export interface SaveDataV1 {
  version: 1;                    // schema 版本（当前支持版本 = 1）
  maxUnlockedLevel: number;      // 已解锁的最高关卡（1..5），初始 1
  allCleared: boolean;           // 是否 5 关全部通关（初始 false）→ 判定是否进"通关画面"
  currentLevel: number;          // 上次未通关的关卡（1..5），初始 1 → 启动"直接续进"的依据
  bestScore: number;             // 历史最高分，初始 0
  settings: {
    sfx: boolean;                // 音效开关，初始 true
    music: boolean;              // 音乐开关，初始 true
    vibrate: boolean;            // 震动开关，初始 true
    controlMode: 'absolute' | 'relative'; // 拖拽模式，初始 'absolute'
  };
  stats?: {                      // 可选统计（分析/成就用；缺失不影响启动）
    runs: number;                // 累计开局数（**首次判定依据：runs == 0**）
    clears: number;              // 累计通关数
    bricksDestroyed: number;     // 累计破砖数
    bestCombo: number;           // 历史最高连击
    lastPlayedAt: number;        // 上次游玩时间戳(ms)
  };
}
```

**字段说明（逐字段落码依据）**

| 字段 | 类型 | 默认 | 语义 | 校验/降级 |
|---|---|---|---|---|
| `version` | `1`（字面量） | 1 | 存档 schema 版本 | 见 §6.3 版本矩阵 |
| `maxUnlockedLevel` | number | 1 | 已解锁最高关卡 | clamp 1~5；非数字→1 |
| `allCleared` | boolean | false | 是否 5 关全通关 | 非布尔→false |
| `currentLevel` | number | 1 | 启动续进目标关 | 越界/非数字→降级进 L1 并回写 1（§6.8） |
| `bestScore` | number | 0 | 历史最高分 | 非数字/负数→0 |
| `settings.sfx` | boolean | true | 音效开关 | 非布尔→true |
| `settings.music` | boolean | true | 音乐开关 | 非布尔→true |
| `settings.vibrate` | boolean | true | 震动开关 | 非布尔→true |
| `settings.controlMode` | `'absolute'\|'relative'` | `'absolute'` | 拖拽模式 | 非法值→`'absolute'` |
| `stats.*` | number | 0 | 统计（可选） | 缺失整块可接受；单项非数字→0 |

**启动续进（BOOT 分流，无菜单）**
- `stats.runs == 0`（首次） → **第 1 关**
- `allCleared == false` 且有进度 → **直接续进 `currentLevel`（"上次未通关的那一关"）**
- `allCleared == true` → **通关画面 FINISH**
- 任何异常/降级情况 → 一律当作"首次"，进第 1 关（§6）。

**输出与反馈**
- 无直接视觉反馈（静默保存）。
- 本系统只需提供"读存档 → 给出入口关卡"的接口，**不再需要菜单态判断**。

## 5. 数值
| 参数 | 值 |
|---|---|
| 存储键 | **`wxgame.breakout.save`**（以代码 `save-schema.ts` 为准） |
| 备份键 | `wxgame.breakout.save.bak` |
| schema 版本 | 1 |
| 序列化 | JSON.stringify / parse |
| 单条写入体积 | < 1 KB |
| 写盘时机 | 通关 / GameOver / 设置变更（非每帧） |
| 默认 `maxUnlockedLevel` | 1 |
| 默认 `allCleared` | `false` |
| 默认 `currentLevel` | 1 |
| 默认 `bestScore` | 0 |
| 容错默认值 | 见 §4 字段说明表 |

## 6. 边界条件
1. **存储为空/首次运行**：使用默认值建仓，不报错。
2. **数据损坏/半截 JSON**：`try/catch` 包裹解析，失败则回退默认值并**保留旧数据备份**（写 `wxgame.breakout.save.bak`）。
3. **存档版本处理（版本矩阵）**：
   | 情况 | 处理 |
   |---|---|
   | `version == 1`（当前支持） | 正常读取 |
   | `version < 1`（更旧、可理解） | 迁移：缺失字段补默认值，**保留 `bestScore` 等已知字段** |
   | `version > 1`（来自更新版本） | **安全降级 → 重置为初始存档，进 L1**；不解析未知字段、不抛异常 |
   | 无 `version` / 非数字 / 无法识别 | 同上（**未知版本一律重置为初始存档**） |
   **策略：降级优先于报错** —— 任何情况下都不得因存档问题中断启动。
4. **存储配额满**（微信 10MB 上限）：本游戏数据极小，但写入失败需 `try/catch` 且不阻断游戏。
5. **微信端同步 API 阻塞**：写入用 `setStorageSync`（数据小，可接受）；如遇卡顿，改为异步 + 队列。
6. **多实例/多标签页**（Web 调试）：以后写覆盖为准，不做并发合并。
7. **隐私合规**：只存"游戏数据 + 开关"，**不存任何用户身份信息**。
8. **字段越界 / 非法值降级（降级优先于报错）**：BOOT 读取后必须逐字段校验，任一不合法 → **不得崩溃**，静默修正并回写：
   | 字段 | 非法情形 | 降级处理 |
   |---|---|---|
   | `currentLevel` | 不在 1~5 / 指向不存在的关卡 / 非数字 | **降级为"首次"处理（进入 L1）**，回写为 `1` |
   | `maxUnlockedLevel` | 不在 1~5 / 非数字 | clamp 到 1~5，非数字→`1` |
   | `bestScore` | 非数字 / 负数 | → `0` |
   | `allCleared` | 非布尔 | → `false` |
   **本系统不提供"报错并中断"的分支**：宁可静默修正，不可让玩家卡在启动。修正后立即落盘，避免每次启动重复修正。
9. **`currentLevel` 与 `allCleared` 的一致性**：若 `allCleared == true` 而 `currentLevel` 非法 → 以"重置为初始存档、进 L1"为准（宁可让玩家重打，不可卡死或跳关）。

## 7. 依赖
- **上游**：S5（bestScore）、S6（maxUnlockedLevel）。
- **下游**：S9（设置读写）、S1（BOOT 读取）。
- **框架假设**：`Storage` 抽象、兼容微信与 Web。

## 8. 验收标准
- [ ] 首次运行无存档时不崩溃，使用默认值。
- [ ] 通关第 N 关后 `maxUnlockedLevel = N+1` 并落盘，重启后仍生效。
- [ ] 最高分在 GameOver 后落盘，重启后保留。
- [ ] 损坏的存档能自动回退默认值且不崩溃。
- [ ] 设置项（音效/音乐/震动/拖拽模式）重启后保持。
- [ ] **`currentLevel` 越界/非法（0、99、非数字、指向不存在的关卡）时不崩溃，降级进 L1 并回写为 1。**
- [ ] **存档 `version` 高于当前支持版本时不崩溃：重置为初始存档、进 L1，且不解析未知字段。**
- [ ] **存档无 `version` 字段或 version 无法识别 → 同上（重置初始存档、进 L1）。**
- [ ] **降级路径优先于报错：以上任一非法情形下均无异常抛出、启动不中断。**
- [ ] 存档 JSON 中**不含任何个人身份信息**。
