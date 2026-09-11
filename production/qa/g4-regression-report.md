# Breakout G4 正式回归报告（WXG-T-012）

> 日期：2026-09-12 · 执行：严守真（quality-lead）· 依据：`test-cases.md` §C1 最小验证集（13 条 P0 承重墙）
> 红线遵守：本轮仅新增 `games/breakout/tests/g4-regression.test.ts`，**未改动 `games/breakout/src/**` 任何文件**。

## 1. 结论

**G4 = CONCERNS**（11 条 PASS / 2 条不可测，不可测项为 P0 级缺口 D-01）。

- 可测的 11 条判据**全部一次对齐通过**（含边界例），未发现任何实现缺陷。
- 2 条不可测：减弱动效开关（TC-A11Y-01/02）——`reduceMotion` 在实现中不存在。

## 2. 逐条结果

| # | 用例 ID | 判据（来源） | 结果 | 证据 |
|---|---|---|---|---|
| 1 | TC-BOMB-01 | 边界 d²=4624 ≤ 4624 **波及**（`bricks.md §2.6 B`） | ✅ PASS | `withinBlast` 用整数 `dx²+dy² ≤ radius²`；4624 处判真，resolver 同步确认 |
| 2 | TC-BOMB-02 | 对角 d²=6224 **不波及** | ✅ PASS | 判假；对角砖 hp 无损 |
| 3 | TC-BOMB-04 | 净结果 = 十字 5 块 | ✅ PASS | seed+水平 2+垂直 2 破坏；对角(6224)与钢砖(136px)完好；seed 不被自身波及；`blastReach` 独立探针=4 |
| 4 | TC-STEEL-02 | 钢砖只发命中事件、永不 damaged/destroyed（`bricks.md §2.6 S`） | ✅ PASS* | `steel:hit`≥1，`brick:damaged`=0，`brick:destroyed`=0，hp 不变，得分为 0，球镜面反弹。*事件名为实现命名，见 §3.1 |
| 5 | TC-STEEL-03 | 清空可破坏砖即清关，钢砖不计入（§6.7） | ✅ PASS | `brickCount` 编译期排除 indestructible；仅剩钢砖时仍进 `level-clear` |
| 6 | TC-SAVE-03 | `currentLevel` 越界 → 不崩溃、进 L1、回写 1（`save-progress §6.8`） | ✅ PASS | 预置 `currentLevel:99` → 启动 levelIndex 0，存储回写 1 |
| 7 | TC-SAVE-01 | `version>1` → 重置初始存档（§6.3） | ✅ PASS | 预置 `version:2` → 全字段回默认值并持久化 |
| 8 | TC-COMBO-01 | 阶梯 `min(5, 1+floor(combo/3))`（`score-combo §2.2`） | ✅ PASS | `COMBO_STEP=3`、`COMBO_MULT_MAX=5` 与 §3 冻结值一致；全梯位逐点断言；Scorer 实际计分（10/10/20）+ 接挡板断连 |
| 9 | TC-LIFE-03 | 3 命耗尽**准确**触发 GameOver（`life-gameover §8`） | ✅ PASS | 第 1/2 次失球→`life-lost`，第 3 次→`game-over`；`game:over` 恰好 1 次（多帧 update 不重复触发） |
| 10 | TC-PAUSE-01 | 暂停期间玩法计时/世界冻结（`pause-settings §2.1/§8`） | ✅ PASS | 暂停 2s：球坐标逐位不变、零事件、零分漂移；恢复后从冻结点继续 |
| 11 | TC-PAUSE-03 | 恢复**不重置**相位计时（§6.2，Q8 风险点） | ✅ PASS* | `onPause` 暂存 elapsed、`onResume` 精确回填（含暂停期间 5s 不老化）；banner 按剩余时间走完。*见 §3.2 的 READY 语义偏差 |
| 12 | TC-A11Y-01 | 减弱动效关停 9 项（`assets-spec §6.1`） | ⛔ 不可测 | **`reduceMotion` 不存在于实现**（src 零命中）→ 缺陷 D-01；已留 skip 测试占位，落地即激活 |
| 13 | TC-A11Y-02 | 保留 7 项仍播放（`assets-spec §6.2`） | ⛔ 不可测 | 同 D-01 |

## 3. 命名/语义偏差（非缺陷，避免误报，按主理人要求记录实际口径）

1. **事件名**：`systems-index §4` 规定的 `ball:hitBrick` 在实现中拆分为 **`steel:hit`**（钢砖专属火花）+ **`brick:damaged`**（普通受击）+ **`brick:destroyed`**（摧毁）。语义全覆盖，**建议回写文档**而非改代码（文档自身标注"最终以实现为准，需回写"）。
2. **READY 自动发球计时**：`pause-settings §2.1/§6.2` 提到"READY 自动发球计时从剩余时间继续"，但实现 READY 态为**纯 tap-to-launch、无计时器**（与 `ux-spec` 流程一致）。计时器保留机制本身已验证（banner 相位 PASS）。**需策划裁定**：删掉 §2.1/§6.2 的"自动发球"表述，或补实现。已计入待澄清 D-03。
3. **钢砖 hp 数据模型**：测试用例数据中 hp=∞（`Infinity`），代码以 `indestructible` 标志为准、从不扣减。判据按"hp 不变"断言，不依赖 ∞ 表示法。

## 4. 缺陷条目（按 `bug-severity.md` 分级）

| ID | 级别 | 描述 | 复现 | 建议 |
|---|---|---|---|---|
| **D-01** | **Major** | 「减弱动效」开关整体缺失：`assets-spec §6.1/§6.2` 的 9+7 项清单与 `save-progress` 的 `settings.reduceMotion` 字段均未实现（src 零命中），TC-A11Y-01/02 不可测。主理人裁定 ② 明确"要做"。 | 启动游戏 → 设置面板无该开关；grep `reduceMotion` src=0 | 派工程侧：settings 增加 `reduceMotion` + view 层按清单关停 9 项动效 |
| **D-02** | Major（G4 范围外，P1 链路） | 道具系统未实现：`expand/multi/life` 仅存常量与掉率定义（tuning），无掉落/拾取/效果代码与测试（src 关键词零命中）。不阻塞本 13 条，但 §C2 的 TC-PWR-01..03 全部不可测。 | grep `powerup` src=0（仅 tuning 常量） | 派工程侧排期；落地后按 §C2 回归 |
| **D-03** | 待澄清（设计） | pause-settings §2.1/§6.2 的"READY 自动发球计时"在实现中不存在（tap-to-launch）。 | — | 提 design-strategist 裁定文档口径 |

## 5. 回归基线（C4）证据

| 检查 | 结果 |
|---|---|
| `tsc --noEmit`（breakout + framework） | 两包零错误 |
| vitest（breakout，含新增回归文件） | **10 文件 214 项：212 passed + 2 skipped（即 A11Y 占位）** |
| vitest（framework） | 24 文件 226 passed |
| `check-architecture.mjs` | OK — no violations |
| `validate-levels.mjs`（复用 validateLevel 版） | 全 5 关通过，退出码 0 |

新增文件：`games/breakout/tests/g4-regression.test.ts`（13 条判据 + 1 条 READY 语义钉死 + 2 条 A11Y skip 占位，每条标注 QA 用例 ID 与 GDD 来源）。

## 6. 升 PASS 的剩余条件

1. D-01 落地 → TC-A11Y-01/02 激活并通过。
2. （可选，非 G4 阻塞）D-03 文档口径裁定；D-02 落地后按 §C2 回归。
