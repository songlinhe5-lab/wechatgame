# WXG-T-182 · G-3 取证：密集大盘「全错位」首步死锁可行性

> 状态：**取证完成，结论已采纳进设计决策**。本文件是决策证据链留档（`temp/` 被 gitignore，故归档于此）。
> 关联：WXG-T-180（§3.13 全错位变更草案）、meta-ui v0.3 / v2-album-dense-boards（九宫格图鉴在途单）。
> 取证执行：程基岩（engineering-lead），2026-09-19。全部经**真引擎 Node 判定**，未改生产码，`vitest run` 43 files / 500 tests 全绿。

## 1. 背景与待证命题

需求拟改为：每关初始**全错位**（derangement-max），关卡图案采**密集母版、无 void、每关 12×12=144 格全可填**，配色硬约束 `MISPLACED_COLOR_CAP=0.5`（任一底色 ≤ ⌊N/2⌋，全错位充要条件）。

文策渊草案 §五 提出的**构造式死锁命题**：

> 满盘开局（无空格）+ 全错位 + 强制整组取回（`count = min(组大小, freeRunFrom(起点))`）+ 满槽禁取（`TRAY_BASE_SLOTS=12`）
> ⇒ 玩家点中一块 ≥12 颗的同色错位连通块 → 一次收满 12 槽 → 该批珠目标格底色 ≠ 该色 → 全盘唯一空格 = 刚挖的格 → 无格可放、无槽可取 ⇒ **死锁**。

并附一条安全论证：「逐环周转峰值占用仅 2 颗 ⇒ 12 槽永远够」。

## 2. 结论（证据摘要，见 `g3/g3-repro.log.txt` §1–§8、`g3/g3-solver.log.txt` §A–§E）

| 口径 | 结论 |
|---|---|
| **现行规则（含 board 直填 T-162）** | 命题**不成立**：`restrictedDeadlock=true` 但 `strictDeadlock=false`。直填不吃托盘容量、不受满槽禁取门约束 → 21/21 配置全通关。 |
| **托盘中心模型（玩家不知/不用直填）** | 命题**成立且更严重**：开局无洞无托盘珠 ⇒ 唯一动作族=整组取回；净盘 144 颗错位珠逐个当首步锚点 → **144/144 首步即灌满 12 槽死锁**（无选择可逃）。 |
| **「逐环周转峰值 2 颗」论证** | **证伪**：真链无「只取 1 颗」入口（`count=min(组, freeRunFrom)`），R=2 时 21 配置中 18 个首步即无珠可取。§3.13 不得沿用「可解性由构造保证」这句。 |
| **可发现性风险** | 逃生需额外一步「换选到棋盘」；托盘选中态下点洞走 `_placeSelected` ⇒ **托盘锚遮蔽直填**（实测返回 false、misplaced 不变）。 |

**临界尺寸**：死锁 ⇔ 被点同色错位块 ≥ `TRAY_BASE_SLOTS`。块 11 不死、块 12 死 → **临界 = 12**。扩容 24 在玩法内**不可达**（`btn_expand` 仅占位提示，`expandTray()` 只测试可达）。

**`MISPLACED_BLOB_MAX` 判定**：块 ≤11 只消除「首步即死」，累计死锁在 B=6–10 仍 25%–100% → **不是充分安全阀**。若仍要生成器硬约束，候选 [2,5]（需 dither 化母版，冲突可读性）。

| 策略（12×12 密集全错位，21 配置） | 死锁率 |
|---|---|
| 贪心取最大组 + 直填 | **0%** |
| 贪心取最大组 · 禁直填 | 95% |
| 逐环周转(≤2) + 直填 | 86%（大块盘首步不可执行） |
| 贪心 · 禁直填 + 道具各1次 | 71%（道具 solver 系不产生新空槽、不改洞色集合 → 不解此局） |

## 3. 采纳的设计决策（用户 2026-09-19 拍板）

- **Q1 直填定位 = 核心机制**：棋盘直填（T-162）确认为新模型主通道之一。→ **不引入 `MISPLACED_BLOB_MAX`**（死锁率 0%）；保留 T-168 现行「点槽定落位」取回规则，**不推翻**。代价：「**直填可发现性**」升为 QA/Playtest 硬判据。
- **Q3 密集母版优先可读**：色块成团、块大（接受依赖直填机制保可玩），不 dither 化。
- **Q4 证据归档**：本目录 `games/beads/design/forensics/`。

## 4. 对 §3.13 冻结文本的具体修订要求（交文策渊，落 §3 正文前）

- **B1**：删除「可解性由构造保证 / 逐环峰值 2 颗」表述（已证伪）。装配/校验口径改为「按色排序 + 循环左移 `maxFreq`」，生成器校验三则：`maxFreq ≤ ⌊N/2⌋`、`无固定点(全错位自检)`、（若采纳才有的）块上限——**本决策不采块上限**。
- **B2（关键）**：「满槽禁取」正文必须补例外——**board 直填不吃托盘容量、不受满槽禁取门约束（T-162）**。这是命题与实现偏差的根因，不写清则 §3.13 与实际可玩性自相矛盾。
- **B3**：可玩性论证从「构造保证」改押在「直填为核心 + 可发现」上 → §8/UX 须有直填教学与可发现性判据承接（见 §5）。

## 5. 交 quality-lead 转正式判据（拟落路径待批，见 §八）

- TC-G3-1 首步死锁复现（12×12 密集全错位 + ≥12 块 → 满 12 槽 → 族 A/B 穷举全拒）
- TC-G3-2 临界参数化：块 = cap−1 / cap，断言「空槽=0 才有 restricted 死锁」
- **TC-G3-3 回归护栏**：直填不受满槽禁取门约束（托盘满 + 无空槽 ⇒ 直填仍成功、`holdingCount` 不变）
- TC-G3-4 道具不变式：solver 系不产生新空槽、不改洞色集合
- TC-G3-5 生成器校验三则（须走生产 BOOT 装配路径，不得沿用本轮 `noAssemble` 夹具）
- **Playtest 观测量**：首步后 30s 内玩家能否自行发现「换选棋盘直填」逃生（本轮最大未知）。

## 6. 未覆盖 / 阻塞（诚实登记）

- **[阻塞] 真机**：无微信开发者工具 / AppID ⇒ 触控命中带（`TRAY_HIT_SIZE=62` / `EXPAND_BTN_HIT_H=88` 净空 11px）真手指误触能否改变死锁结论，未验。
- **策略近似 ≠ 可解性证明**：机器人失败只证该策略失败；「restricted 模型下 B<12 的盘是否一定可解」未做 144 格状态空间搜索证明。
- **夹具失真**：`mount()` 用 `noAssemble` + 手工 `fill` 绕过 BOOT；正式 TC-G3-5 须走新装配路径重跑。

## 7. 复现

```
node --experimental-transform-types --import=./temp/g3-hooks.mjs temp/g3-repro.ts
node --experimental-transform-types --import=./temp/g3-hooks.mjs temp/g3-solver.ts
```
归档脚本见 `g3/`（`*.log.txt` 为运行输出）。生成器 spike：`g3/beads-gen.mjs`、`g3/beads-ref.mjs`；代表图见 `img/`（flower 均衡 / heart 单色主导 的正反例）。

## 8. 归档清单

- `g3/`：`g3-hooks.mjs` `g3-probe.ts` `g3-lib.ts` `g3-repro.ts` `g3-repro.log.txt` `g3-solver.ts` `g3-solver.log.txt` `beads-gen.mjs` `beads-ref.mjs`
- `img/`：`flower.png` `heart.png` `flower-solved.png` `flower-misplaced.png` `heart-solved.png` `heart-misplaced.png`
- 说明：`g3/*.ts` 为取证脚本，`design/` 不在任何 tsconfig `include` 内（`games/beads/tsconfig.json` 只收 `src/**` `tests/**`），不参与 typecheck/构建。
