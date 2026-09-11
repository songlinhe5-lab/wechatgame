# 关卡数据规范（Levels Spec）

- 项目：`breakout` · 版本 v1.0
- 数据文件：`levels-01-05.json`
- 类型定义：`levels.schema.ts`（TypeScript 接口，供 `src/` 直接 `import type`）
- 消费方：S3（球速）、S4（砖块布局/类型）、S5（基础分）、S7（掉率/道具池）、S1（清关）

---

## 1. 文件结构总览

```
LevelsFile
├─ version / gameId / description      元信息
├─ designResolution                     画布 750×1334 FIXED_WIDTH
├─ grid                                 网格常量（全关卡共用）
├─ brickTypes                           砖块类型目录（单一数据源）
├─ powerupPool                          道具目录（单一数据源）
└─ levels[]                             5 个 LevelDef
```

> **单一数据源原则**：砖块 HP/分数只在 `brickTypes` 定义一次，道具参数只在 `powerupPool` 定义一次；关卡仅通过**代码字符**与**ID 引用**组合，避免数值重复漂移。

## 2. 字段说明

### 2.1 `grid`（网格 → 像素坐标）
| 字段 | 类型 | 值 | 含义 |
|---|---|---|---|
| `cols` | number | 10 | 列数 |
| `brickW` | number | 62 | 砖块宽 px |
| `brickH` | number | 34 | 砖块高 px |
| `gapX` | number | 6 | 列间距 px |
| `gapY` | number | 6 | 行间距 px |
| `originX` | number | 38 | 第 0 列左边缘 x |
| `topY` | number | 1200 | 第 0 行上边缘 y |
| `rowPitch` | number | 40 | 行间距 = 34+6 |

**坐标派生公式**（已导出为 `levels.schema.ts` 工具函数）：
```
colCenterX(j) = originX + brickW/2 + j*(brickW+gapX) = 69 + 68*j     // j = 0..9
rowCenterY(i) = topY − brickH/2 − i*rowPitch        = 1183 − 40*i   // i = 0..5
```
校验：最右砖右边缘 = 69+68*9+31 = 712 ≤ `WALL_RIGHT_X`(720) ✓

### 2.2 `brickTypes`（砖块类型目录）
| code | 名称 | hp | score | 不可破坏 | 特殊 |
|---|---|---|---|---|---|
| `N` | 普通砖 | 1 | 100 | 否 | — |
| `T` | 硬砖 | 2 | 250 | 否 | `damagedVisual: true` |
| `S` | 钢砖 | `null`(∞) | 0 | **是** | 不计入清关 |
| `B` | 炸弹砖 | 1 | 150 | 否 | `explode {radius:68, damage:1, maxChain:8}` |
| `G` | 金砖 | 1 | 500 | 否 | `dropRateMultiplier: 3` |

**特殊砖块行为补充（字段语义，详细定义见 `gdd/bricks.md` §2.6）**：

| code | 行为要点 | 关键边界 |
|---|---|---|
| `S` 钢砖 | 不可破坏、**不受任何道具影响**（炸弹/激光均无效）、**不计入通关条件**（可破坏砖清空即清关）；命中只播放火花音效，**永不派发 `brick:destroyed`** | 关卡内钢砖总量须 ≤20%；可破坏砖清空而钢砖残留时立即判清关 |
| `B` 炸弹砖 | 破碎时对**中心半径 68px 内其他砖块**造成 1 点伤害并递归连锁（上限 8 层）；**会波及己方砖块**（普通/硬/炸弹/金砖），**不伤钢砖、不影响玩家**；连锁破碎正常计分与连击 | 范围按砖块中心判定；可连环；连锁炸毁最后一块可破坏砖即触发清关 |
| `G` 金砖 | 分值 500（普通砖 5 倍）；掉落率 = `powerupDropRate × 3`（封顶 1.0），**非必掉**（已终裁维持，理由见 `gdd/bricks.md` §2.6） | 可被炸弹连锁引爆且掉落倍率仍生效；场上道具满 3 时丢弃；色盲下靠星标区分 |

### 2.3 `powerupPool`（道具目录）
| id | 名称 | weight | durationMs | params |
|---|---|---|---|---|
| `expand` | 加宽挡板 | 30 | 15000 | `paddleWidthMultiplier:1.4` |
| `multi` | 三球 | 25 | 0(瞬时) | `splitCount:3, splitAngleDeg:25, maxBalls:9` |
| `life` | 加命 | 8 | 0(瞬时) | `maxLives:5, overflowScore:500` |
| `slow` | 减速球 | 20 | 10000 | `speedMultiplier:0.75, minSpeed:240` |
| `sticky` | 磁吸挡板 | 10 | 12000 | — |
| `laser` | 激光挡板 | 7 | 10000 | `cooldownMs:500` |

> **MVP 实装集合**：`IMPLEMENTED_POWERUPS = ['expand','multi','life']`（`systems-index §3.6`）。
> **抽取规则**：实际掉落候选 = `level.powerupPool ∩ IMPLEMENTED_POWERUPS`；白名单中未实装 ID **静默忽略、不报错**，权重在剩余候选中重新归一化。故 L3/L4 的 `slow`、L5 的 `sticky` **MVP 阶段不掉落**（数据保留，便于后续实装，无需改 JSON）。

### 2.4 `levels[]`（单关）
| 字段 | 类型 | 必填 | 含义 |
|---|---|---|---|
| `id` | number | ✓ | 关卡序号，从 1 连续递增 |
| `name` | string | ✓ | 关卡名 |
| `ballSpeed` | number | ✓ | 本关基础球速 px/s |
| `paddleWidth` | number | ✓ | 本关挡板基础宽 px |
| `powerupDropRate` | number | ✓ | 破砖掉道具基础概率 0~1 |
| `livesOnEnter` | number | ✗ | 进入本关初始生命（仅第 1 关） |
| `clearCondition` | string | ✓ | 固定 `"all-destructible"` |
| `powerupPool` | PowerupId[] | ✓ | 本关可掉落道具白名单（**实际抽取须 ∩ MVP 实装集合**，见 §2.3） |
| `hint` | string | ✗ | 新手提示（仅第 1 关） |
| `rows` | string[] | ✓ | 布局，行序**从上到下**，每行长度 = `cols`。**字符集固定为 `.NTSBG`**：`.`=空位，`N`/`T`/`S`/`B`/`G`=砖型（对应 `brickTypes` 的 key）。出现集合外字符 = 错误 |

## 3. 前 5 关参数总表

> **R1 裁定（C 方案）已落地**：L4 压缩为 4 行、L5 压缩为 5 行，同时提高硬砖占比以维持难度。改动仅涉及 `levels-01-05.json` 中 L4/L5 的 `rows`；`ballSpeed`/`paddleWidth`/`powerupDropRate` 与其余 3 关**均未变动**。

| 关卡 | 名称 | 行×列 | 砖块数 | 可破坏HP | 硬砖T占比 | 球速 px/s | 挡板宽 | 掉率 | 引入的新变量 |
|---|---|---|---|---|---|---|---|---|---|
| L1 | 热身 | 3×10 | 30 | 30 | 0% | 480 | 140 | 10% | **基础玩法 + 道具** |
| L2 | 硬骨头 | 4×10 | 40 | 50 | 25% | 500 | 140 | 14% | **硬砖（2 HP）** |
| L3 | 钢之回廊 | 5×10 | 44 | 44 | 9% | 520 | 140 | 12% | **钢砖（不可破坏）+ 空位** |
| L4 | 连锁爆破 | 4×10 | 40 | 56 | **40%** | 540 | 140 | 14% | **炸弹砖（连锁）** |
| L5 | 霓虹终章 | 5×10 | 48 | 58 | **29%** | 560 | 140 | 12% | **金砖 + 综合考验** |

**砖块构成明细（逐关权威核对表，供 QA / 工程直接引用，避免手工数错）**

| 关卡 | 砖块总数 | 其中 `S` | 可破坏砖数 | `N` | `T` | `B` | `G` | **可破坏 HP** | 算式 |
|---|---|---|---|---|---|---|---|---|---|
| L1 | 30 | 0 | 30 | 30 | 0 | 0 | 0 | **30** | 30×1 |
| L2 | 40 | 0 | 40 | 30 | 10 | 0 | 0 | **50** | 30 + 10×2 |
| L3 | 44 | **4** | 40 | 36 | 4 | 0 | 0 | **44** | 36 + 4×2 |
| L4 | 40 | 0 | 40 | 20 | 16 | 4 | 0 | **56** | 20 + 16×2 + 4×1 |
| L5 | 48 | **4** | 44 | 24 | 14 | 4 | 2 | **58** | 24 + 14×2 + 4×1 + 2×1 |

> **口径提醒（易错点）**：
> 1. **`S` 钢砖不计 HP，但计入"砖块总数"**——故 L3 出现"总数 44 = HP 44"的巧合（40 块可破坏砖 + 4 块钢砖；40 可破坏砖里 4 块 `T` 各贡献 2 HP，恰好补回 4 块钢砖的 0 HP 空缺）。**这不是把总数当 HP。**
> 2. **L3 的钢砖是 4 块**（row0 `SSNNNNNNSS` 两端各 2 块），非 2 块。
> 3. **L5 的炸弹砖是 4 块**（row2 `NBBNNNNBBN`），另含 2 块金砖；HP 必须把 `B`/`G` 一起算入。L5 逐行：`S×4=0, T×6=12` / `T×4=8, N×4=4, G×2=2` / `N×6=6, B×4=4` / `N×6=6, T×4=8` / `N×8=8` → 合计 **58**。

**难度单调性校验**：球速单调递增（480→500→520→540→560）；HP 总量 30→50→44→56→58（L3 因无硬砖略回落，以钢砖+空位布局补偿操作难度）；**L4/L5 以"硬砖占比"作为难度主旋钮**（40% / 29%，显著高于 L2 的 25%），实现"内容量下降、挑战性不降反升"；新变量**每关只加一个**，符合"一关一节奏"支柱。

**预估清关时长（待实测校准）**：按 1.6~2.5 秒/砖估算：

| 关卡 | 预估时长 | 说明 |
|---|---|---|
| L1 | 60~75 s | 教学关，允许偏长 |
| L2 | 70~85 s | 硬砖使有效工作量提升 |
| L3 | 70~85 s | 空位迫使改变角度 |
| L4 | **72~90 s** | R1-C 后（4 行 / 硬砖 40%）；炸弹连锁可显著缩短，方差大 |
| L5 | **78~90 s** | R1-C 后（5 行 / 硬砖 29%）；上限与 `concept.md` 单关 ≤90s 对齐（DOC-T004-01） |

## 4. 各关布局可视化

> 图例：`■`=普通砖 N　`▩`=硬砖 T　`▦`=钢砖 S　`✸`=炸弹砖 B　`★`=金砖 G　`·`=空位

### L1 热身（3×10，全普通）
```
行0  ■■■■■■■■■■
行1  ■■■■■■■■■■
行2  ■■■■■■■■■■
```

### L2 硬骨头（4×10，顶行全硬砖）
```
行0  ▩▩▩▩▩▩▩▩▩▩
行1  ■■■■■■■■■■
行2  ■■■■■■■■■■
行3  ■■■■■■■■■■
```

### L3 钢之回廊（5×10，钢砖封角 + 阶梯空位）
```
行0  ▦▦■■■■■■▦▦     ← 钢砖：列0,1,8,9
行1  ■■▩▩■■▩▩■■     ← 硬砖：列2,3,6,7
行2  ■■■■■■■■■■
行3  ·■■■■■■■■·
行4  ··■■■■■■··
```
特殊砖位置：钢砖 (r0,c0)(r0,c1)(r0,c8)(r0,c9)；硬砖 (r1,c2)(r1,c3)(r1,c6)(r1,c7)。

### L4 连锁爆破（4×10，炸弹砖成对 · R1-C）
```
行0  ▩▩▩▩▩▩▩▩▩▩     ← 硬砖：列0-9
行1  ▩▩■■■■■■▩▩     ← 硬砖：列0,1,8,9
行2  ■✸✸■■■■✸✸■     ← 炸弹：列1,2,7,8
行3  ■■▩■■■■▩■■     ← 硬砖：列2,7
```
特殊砖位置：炸弹 (r2,c1)(r2,c2)(r2,c7)(r2,c8)；硬砖 (r0,c0-c9)(r1,c0,c1,c8,c9)(r3,c2,c7)。
> 炸弹砖两两相邻（c1-c2、c7-c8），破碎其一可连锁引爆另一，形成"双响"爽点。R1-C 后硬砖占比由 24% 提升至 **40%**（16/40）。

### L5 霓虹终章（5×10，全类型综合 · R1-C）
```
行0  ▦▦▩▩▩▩▩▩▦▦     ← 钢砖：列0,1,8,9；硬砖：列2-7
行1  ▩▩■■★★■■▩▩     ← 硬砖：列0,1,8,9；金砖：列4,5
行2  ■✸✸■■■■✸✸■     ← 炸弹：列1,2,7,8
行3  ■■▩■■▩■■▩▩     ← 硬砖：列2,5,8,9
行4  ·■■■■■■■■·
```
特殊砖位置：
- 钢砖：(r0,c0)(r0,c1)(r0,c8)(r0,c9)（4 块，仅封顶行两角）
- 硬砖：(r0,c2-c7)(r1,c0,c1,c8,c9)(r3,c2,c5,c8,c9)，共 14 块 → 占比 **29%**
- 金砖：(r1,c4)(r1,c5)（**上下左右均被硬砖包围，需先破外围**）
- 炸弹砖：(r2,c1)(r2,c2)(r2,c7)(r2,c8)

## 5. 关卡设计约束（新增关卡时必须遵守）

1. **可破坏砖不可被钢砖完全封闭**：任意可破坏砖必须存在一条球可达路径（AABB 连通性检查），否则无法清关。
2. **每行长度 === `cols`**：不足补 `.`，超出为错误（`validateLevel()` 会在开发期断言）。
3. **最大行数 6**：受 `BRICK_MAX_ROWS` 与顶墙 `CEILING_Y(1240)` 限制，超出行会与 HUD 重叠。
4. **首行不得紧贴顶墙**：`topY=1200` 与 `CEILING_Y=1240` 之间留 40px，给球留出反弹空间。
5. **至少 1 行完整可破坏砖**：保证球有初期命中目标，避免开局空转。
6. **每关只引入一个主新变量**（支柱 3）。
7. **球速上限 720**：关卡 `ballSpeed` 不得超过 `BALL_SPEED_MAX`。
8. **钢砖总量 ≤ 20%**：过量的不可破坏砖会让节奏拖沓。
9. **字符集限定 `.NTSBG`**：关卡 `rows` 只允许这 6 个字符（`.`=空位，`N/T/S/B/G`=砖型）。出现其他任何字符（含空格、小写字母、中文、数字）均视为**错误**，`validateLevel()` / 校验器应报错。

### 5.1 校验分工（validateLevel vs QA validate-levels.mjs）

> 裁定来源：主理人 2026-09-11「`validateLevel()` 为 per-level 结构校验唯一权威」。
> `validate-levels.mjs` **不得硬编码第二份字符集/结构规则**，必须消费 `LEVEL_CHARSET` 并复用 `validateLevel()`。

| 校验层 | 归属 | 内容 | 时机 |
|---|---|---|---|
| **per-level 结构校验（唯一权威）** | `levels.schema.ts::validateLevel()` | ① 字符集 ⊆ `LEVEL_CHARSET`（错误信息含 level.id + 行号 + 列号 + 违规字符）② 每行长度 === `grid.cols` ③ 行数 ≤ `BRICK_MAX_ROWS` ④ rows 非空 | BOOT / 开发期断言 |
| **文件级 / 跨关校验** | QA `validate-levels.mjs` | 关卡数、id 连续、可破坏 HP 序列、ballSpeed 序列单调、S 占比 ≤20%、≥1 行可破坏砖、AABB 连通性（§5 约束 1/5/8 等玩法约束） | CI / 提交前 |

> 分工原则：**结构（能解析、能落格）归 `validateLevel()`；玩法（能玩、难得住）归 `validate-levels.mjs`**。运行时合法性（如"可破坏砖清空即判清关"）归 S1/S3 类系统，不属静态校验。

## 6. 程序消费伪代码（供程基岩参考）

```ts
import raw from './levels-01-05.json';
import type { LevelsFile, BrickTypeDef } from './levels.schema';
import { colCenterX, rowCenterY, validateLevel } from './levels.schema';

const data = raw as LevelsFile;
data.levels.forEach(lv => {
  const errs = validateLevel(lv, data.grid);
  if (errs.length) throw new Error(errs.join('\n'));
});

function buildBricks(level: LevelDef, grid: GridDef, catalog: Record<BrickTypeCode, BrickTypeDef>) {
  const bricks = [];
  level.rows.forEach((row, i) => {
    [...row].forEach((ch, j) => {
      if (ch === '.') return;                 // 空位跳过
      const def = catalog[ch as BrickTypeCode];
      bricks.push({
        id: `${i}-${j}`,
        type: def.code,
        hp: def.indestructible ? Infinity : def.hp,
        score: def.score,
        x: colCenterX(grid, j),
        y: rowCenterY(grid, i),
        w: grid.brickW,
        h: grid.brickH,
      });
    });
  });
  return bricks;
}
```

## 7. 扩展预留（v2 方向，本期不实现）
- 单关覆盖 `grid`（不同网格密度的关卡）。
- 砖块 `hitSoundId` / `spriteId` 字段（下放给美术配置驱动）。
- `timeLimitSec`（限时关卡）、`movePattern`（砖块整体移动）。
- 关卡 `difficulty` 标签（用于关卡选择排序与推荐）。
