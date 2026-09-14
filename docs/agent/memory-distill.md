# memory 日志 30 天蒸馏规程（R2 · WXG-T-041）

> 对策 R2（2026-09-13 上下文膨胀审计）落地文档。命令：`pnpm run memory:distill`（`tools/scripts/distill-memory.mjs`）。

## 1. 为什么需要这个机制

`memory/YYYY-MM-DD.md` 是 AI 会话日记：每日追加、只增不减。审计认定这是真雷——`memory/2026-09-12.md` 已 10141 tokens，B 门（单文件 8000）当时靠豁免放行。**日志的长期价值只有一个出口：蒸馏进 `memory/MEMORY.md`（长期精选正本）**；没有蒸馏价值的原始流水，30 天后不应继续占常驻索引面。

## 2. 核心裁决：脚本只做机械部分，蒸馏责任在人/会话

蒸馏是**语义工作**，脚本能做的只是**机械轮转 + 防丢护栏**。因此：

- **绝不允许无人蒸馏就把原始日志删掉/移走不管**；
- 归档 = **移动即归档**：原文逐字节保留在 `memory/archive/<同名>`（脚本写入后回读校验，字节不等则 fail loud 不删原件），git 里永久可查；
- `--write` 会在 `MEMORY.md` 末尾追加「⏳ 归档待蒸馏提醒」占位段——**提醒不消化不删除**，蒸馏完成后由人/会话删除对应行。

## 3. 标准流程

```
日志满 30 天
  → pnpm run memory:distill            # dry-run：看候选（文件、字节/≈tokens、天数）
  → AI/人工阅读候选日志，把长期有效内容蒸馏进 memory/MEMORY.md 相应章节
  → pnpm run memory:distill --write    # 归档落盘 + MEMORY.md 追加待蒸馏占位
  → 提交 memory/（含 memory/archive/）；候选从下次 dry-run 中消失（幂等）
  → 蒸馏完成后删除 MEMORY.md 中对应「待蒸馏」行
```

dry-run 会为每个候选报告**蒸馏弱证据**：`MEMORY.md` 最近修改时间与该日志日期的先后——MEMORY.md 晚于日志更新 ≈ 可能已蒸馏（弱证据，仍需人工确认）；自日志后未更新 ≈ 大概率未蒸馏（先蒸馏再归档）。

## 4. 归档路径与索引排除（裁决）

归档目录为 **`memory/archive/`**：命中 `tools/scripts/lib/context-index.mjs` 的 `SKIP_DIRS`（`archive` 一项，WXG-T-029 先例，注释已预告覆盖未来的 `memory/archive/`）——**零代码改动**即被排除 ctx 索引面。归档文件**永不进常驻面**（不会撞 B 门单文件上限），但 git 里永久可查。追溯老日志直接读文件 / git 即可。

## 5. B 门豁免联动裁决（WXG-T-041）

`ctx/budget-exempt.json` 中 `memory/2026-09-12.md` 的 B 门豁免（WXG-T-030）应随本机制**收窄**：

- **豁免仅对 ≤30 天的日志生效**——日志满 30 天后应先蒸馏再由 `memory:distill --write` 归档，不得靠豁免硬扛；
- 该裁决已写入 `ctx/budget-exempt.json` 相应条目的 `note` 字段；**本轮不改豁免行为本身**（09-12 日志距今仅 1 天，不触发）；
- 下次 ctx 审计时，若某日志已满 30 天仍留在 `memory/` 顶层且仍靠豁免放行，应视为违规并推动蒸馏+归档。

## 6. 安全边界（脚本保证）

- 默认 **dry-run**，`--write` 才落盘；0 候选时空转不落盘（连 archive 目录、MEMORY.md 都不碰）；
- 只认文件名严格匹配 `YYYY-MM-DD.md` 且日期可解析的日志；命名不符 / 日期非法一律不动（宁漏勿错）；
- `<30 天` 的文件**只读不碰**（连内容都不读）——当日日志正被其他会话并发追加，保证并发安全；
- 防重复归档：`memory/archive/` 已有同名 → 跳过告警，不覆盖；
- 归档副本回读校验失败 → fail loud exit 1，原件保留；`--write` 时 `MEMORY.md` 必须已存在（不代建）；
- **可选治理**：不挂 pre-commit / CI 强制执行（与 tasks:archive 同口径）。

## 7. 并行会话提交纪律

仓库多 IDE 会话并行，`memory/2026-09-13.md`（当日日志）可能有外来未提交改动——提交本机制产物时**不要 add 当日日志文件**（除非确认只含自己的记录）。

## 8. 分级读取：`memory/INDEX.md` 摘要层（WXG-T-068）

- **为什么**：`memory/` 的日记合计 ≈3.2 万 tok，整读不可行 ⇒ 摘要层入口 `memory/INDEX.md`
  由 `pnpm run ctx:build` 生成（标记块 `<!-- memory:index:start -->` 内为生成内容，**勿手改**）。
- **怎么读**：先读 `INDEX.md` 的摘要表 → 命中某节 → `read_file(path, offset=行首, limit=行尾−行首+1)`
  **只读那一节**。表里每篇标注**蒸馏到期**（文件名日期 + 30 天）。
- **口径**：摘要 = `ctx/index.json` 里 `firstSentence()` 的**节首句摘取**（非人工提要）；
  故 `INDEX.md` 与索引**同源同口径**，由 `ctx:check` 的 C 子项逐字节校验并与本脚本的默认天数对账。
- **与本规程的关系**：蒸馏（30 天归档）不变；本层只解决**读取成本**。日志归档后其摘要行随索引自动消失。

