# knowledge/ — 工作室知识库（WXG-T-023）

> 本目录是跨任务、跨会话、跨 IDE 的**长期知识沉淀层**：教训、模式、平台坑。
> 与其他载体的分工：GDD/design = 产品设计；ADR = 架构决策（为什么）；`production/qa/` = 判据与缺陷；
> 本目录 = **怎么避开已踩过的坑、怎么复用已验证的做法**。

## 1. 读取协议（开发前期）

- **任务开工前**：成员与主对话先读本 INDEX 的**活跃表**（含「分片」列）定位同域条目，再只读
  `lessons/<片>.md` 里那几条（spawn 八要素的「权威来源清单」应包含相关知识条目）。
- 触发词：看到「实现/修复/接入/发布」类任务时，先查本库有无同域条目，有则列入任务单必读。
- **分片后的引用口径（WXG-T-111）**：条目正文在 `knowledge/lessons/<标签>.md`，
  `lessons.md` 只是**指针页**；文档 / 代码注释 / 台账里引用一律写 **K-0NN**（可附任务号），
  **不写文件路径**——路径由活跃表「分片」列机械解析，写死路径迟早跟布局漂移（判例 K-047）。
- **与 `memory/` 的分工**：本目录答「**该怎么做**」（可复用、跨任务的结论，开工前按域查）；`memory/` 答「**当初为什么这么做 / 到哪一步 / 谁拍的板**」（时间序过程账），只在**改旧政 / 接续未完 / 追溯用户裁定 / 排障找确诊法**四种触发下才查。判不准就问：**「下个月做别的功能还用得上吗？」** 用得上 → 本目录；只是这个仓的历史 → `memory/`。

## 2. 写入协议（任务收尾）

- **每个 WXG 任务收尾时**，执行者随交付回传 0–3 条沉淀候选（没有可传「无」）；主理人汇编去重后入账。
- 触发判定：踩坑修复、非显而易见的做法、平台/工具反直觉行为、复用价值 > 一次性的经验。
- 条目格式（必须带**行内 ID** 与任务号可追溯；ID 由 `pnpm run kb:sync` 分配，**递增不回收**，类比 `WXG-T-xxx`）：

```markdown
- **[类别][K-xxx] 一句话标题**（来源 WXG-T-xxx / commit abc1234，2026-09-12）
  现象：…
  根因：…
  规避/做法：…
```

- 类别（= 条目**行内标签**，与分片文件一一对应）：`工具链` / `跨IDE` / `平台微信` / `引擎Cocos`
  / `测试` / `流程` / `判据` / `环境` / `构建`。**新标签 = 新建一片**（`knowledge/lessons/<标签>.md`，
  片内 `## <标签>` 小标题必留）：`ACTIVE_FILES` 动态枚举该目录，新片无需改码即被 `kb:*` 全套采集；
  未知标签在 `knowledge:split` 里是 **fail loud**，不会静默丢条目。
- **新增/修改条目后必跑三步**：① `pnpm run kb:sync --task=WXG-T-0xx`（分配 ID + 刷新活跃表 + **产出沉淀统计**）
  ② `pnpm run kb:audit` —— 若新条目与**归档**条目相似度 ≥ 0.34，按 §5.3 走「重新激活并合并」，避免同一坑沉淀两份
  ③ `pnpm run ctx:build`（`knowledge/*.md` 属被索引文件，改完须刷新索引面）。
- **沉淀统计是强制产物**：`kb:sync` 输出「**新增 / 修改 / 激活 / 归档**」四类各多少条（逐条给 ID + 标题），
  主理人须把它**摘入会话结论与台账**（`production/TASKS.md` 该 Task 的产出列），并在 `knowledge/CHANGELOG.md`（生成物）留档。
  —— 统计口径：「新增/修改」由 `contentHash` 对比现算；「激活/归档」由 `kb:reactivate` / `kb:archive` 写入 `events` 后汇总。

## 3. 文件分工

| 文件 | 内容 |
|---|---|
| `lessons.md` | **指针页（不再放条目正文）**：标签 → 分片文件表 + 引用口径 |
| `lessons/` | 教训分片（WXG-T-111 按行内标签切）：`toolchain` / `process` / `criteria` / `testing` / `cross-ide` / `environment`；片内条目**按 ID 升序**，`## <标签>` 小标题保留（`kb:reactivate` 靠它定位） |
| `patterns.md` | 模式库：本仓已验证可复用的实现/流程模式（未分片，1.4k tok） |
| `ledger.json` | **条目台账（产物，勿手改）**：ID / 状态 / 类别 / 来源 / `lastAccess` / `accessCount` / `seen` / 归档与激活留痕；由 `kb:*` 命令维护，键序固定 |
| `archive/` | **归档区**：`lessons-archived.md` / `patterns-archived.md` / `INDEX.md`（归档清单）；**已被 ctx 索引排除**（`SKIP_DIRS` 含 `archive`），开工查询看不到。lessons 各分片**共用单份** `lessons-archived.md` |

## 4. 维护

- 主理人负责汇编与去重；条目不删改只追加，废弃条目标 `[已过时：原因]`。
- **分片不越红线**：每片同受 ctx B 门（8000 tok）约束，**不得为分片新增豁免**；某片再越阈
  ⇒ 该标签内部按子标签再切（取向同 WXG-T-041 对 memory 豁免的「豁免不是长期方案」声明）。
- **K-0NN 命名空间全局单一**（真源 = `ledger.json::nextId`）：分片只改正文落位，不改编号语义、
  不回收旧号；补号顺序 = `ACTIVE_FILES` 列表序（lessons 各片按指针页表序 → `patterns.md`）。
- 新条目提交进 commit（带 Task ID，过 commit-msg 钩子）。
- **归档不等于删除**：条目原文完整搬入 `archive/`（标题行下留 `> 归档于 YYYY-MM-DD（原因：…）`），可随时重新激活。

## 5. 生命周期（访问记账 → 归档 → 重新激活）

### 5.1 命令表

| 命令 | 作用 |
|---|---|
| `pnpm run kb:sync` | 解析两个 md → 分配新条目 ID → 刷新 `ledger.json` 与下方活跃表（**只重写标记块内**） |
| `pnpm run kb:collect` | **自动**从 `ctx/reads-ledger.jsonl` 归属 `knowledge/*.md` 的读取（按 offset/limit 命中条目）；**幂等**：同一 `(会话, 条目)` 经 `seen` 持久去重，重复运行不改变计数 |
| `pnpm run kb:touch -- K-001 K-003` | **显式** +1 次访问（可选 `--date=YYYY-MM-DD` / `--task=WXG-T-0xx`）——用于其他 IDE 或手工补录 |
| `pnpm run kb:audit` | ① **归档候选**（闲置 ≥ 90 天且访问 ≤ 1 次）② **归档相似命中**（新条目 vs 归档条目相似度 ≥ 0.34）——**只出清单，不自动归档** |
| `pnpm run kb:archive -- --ids=K-004 --reason="…"` | **人工确认后**执行归档（`--reason` 必填） |
| `pnpm run kb:reactivate -- --ids=K-004 --reason="…"` | 从归档搬回原文件并激活（保留历史访问计数，+1 次激活留痕） |
| `pnpm run kb:check` | 六重一致性校验（ID 唯一 / ledger↔md 双向 / archive 排除生效 / 活跃表一致 / 阈值存在 / `accessCount === seen.length` 严格成立） |

### 5.2 归档阈值（用户 2026-09-12 裁定，存于 `ledger.json.thresholds`）

闲置 **90 天** 且访问次数 **≤ 1** → 列入归档候选；**必须人工确认**后才移动。
脚本侧不自动归档的理由：`kb:collect` 只覆盖写转录的 IDE（Cursor / WorkBuddy），**未观测 ≠ 未访问**。

> ⚠️ **口径限制**：`lastAccess` 为**观察日粒度**（读入账本不含时间戳，采集时记运行日）；
> `lessons.md` 条目的 `addedDate` 来自其标题行日期，`patterns.md` 部分条目无日期 →
> 显示 `—` 且在 `kb:audit` 中单列「无法判定（缺日期）」，**不参与候选**，可用 `kb:touch --date` 回填。

### 5.3 重新激活与合并

1. 新增条目后跑 `pnpm run kb:audit`，若命中归档条目（相似度 ≥ 0.34）：
2. **优先合并**：把新现象/新规避补进归档条目正文，再 `pnpm run kb:reactivate -- --ids=K-xxx --reason="新踩坑 WXG-T-0yy 复现，补充 Z"`；
3. 二者确实不同 → 保留双条，并在新条目标注「与归档 K-xxx 的区别」防再次误判；
4. 激活后原条目回到活跃表，下次任务即可被索引到。

### 5.4 `accessSources` 截断（R4，WXG-T-038）

- 条目来源标签 `accessSources` **只保留最近 N=12 个**（保留尾部最新、弃头部最旧）；截断在
  lib 层 `normalizeLedgerEntry`（所有写盘路径的必经点）统一收口，写入方统一走 `appendAccessSource`。
- **语义不变**：`accessCount` 仍累计所有访问、`seen` 不截断（`accessCount === seen.length` 严格
  一致的前提）、`lastAccess` 不变；截断只影响展示性来源留痕。
- **存量回填**：由 `kb:sync` 幂等完成（超限条目收敛并打印「R4 accessSources 收敛」报告）；
  重跑无超限 → 不打印、不写盘。
- N=12 依据：标签已按 `kind:值` 去重，增长上限 ≈ 每条目每天 1 个 `ledger:<日>` + 显式动作；
  12 个最近来源足够覆盖两周级访问追溯（`kb:audit` 只用 `lastAccess` / `accessCount`）。

## 6. 活跃条目（自动生成）

<!-- kb:active:start（由 pnpm run kb:sync 生成，勿手改）-->
| ID | 类别 | 分片 | 标题 | 来源 | 最后访问 | 次数 | 状态 |
|---|---|---|---|---|---|---|---|
| K-001 | 工具链 | toolchain | commitlint 自定义规则必须经 plugins 数组注册 | WXG-T-021 | 2026-09-12 | 0 | active |
| K-002 | 工具链 | toolchain | bash heredoc 定界符未加引号 + JSON 内写注释 = 双重坑 | WXG-T-021 | 2026-09-12 | 0 | active |
| K-003 | 工具链 | toolchain | 常驻上下文预算阈值必须与 token 估算公式同口径 | WXG-T-024 | 2026-09-12 | 0 | active |
| K-004 | 工具链 | toolchain | 改过被索引的 `.md` 后必须重跑 `ctx:build`，否则 C 门必红 | WXG-T-026 | 2026-09-12 | 0 | active |
| K-005 | 工具链 | toolchain | 含「活动会话」的采集型基线必须用比率口径，计数容忍带必然误报 | WXG-T-026 | 2026-09-12 | 0 | active |
| K-006 | 工具链 | toolchain | 冻结样本做 schema 升级，用「侧车重算」而不是全量重采 | WXG-T-026 | 2026-09-12 | 0 | active |
| K-007 | 跨IDE | cross-ide | Qoder 把 `model: inherit` 当具体模型 ID 解析 | — | 2026-09-11 | 0 | active |
| K-008 | 跨IDE | cross-ide | 跨 IDE 并行会话会撞任务号与 §6 版本号 | WXG-T-016 | 2026-09-12 | 0 | active |
| K-009 | 跨IDE | cross-ide | 派单范围表述必须对照冻结真源复核 | WXG-T-013 | 2026-09-12 | 0 | active |
| K-010 | 环境 | environment | WorkBuddy 沙箱内 bash grep/链式命令会假阴性（空输出 + exit 1） | WXG-T-020 | 2026-09-12 | 0 | active |
| K-011 | 流程 | process | 质量门复验者 ≠ 实现者 | WXG-T-019 | 2026-09-12 | 0 | active |
| K-012 | 数值与真源 | patterns | 冻结常量 SSOT 模式 | — | — | 0 | active |
| K-013 | 数值与真源 | patterns | 关卡覆盖全局基线 | — | — | 0 | active |
| K-014 | 代码结构 | patterns | 决策表模式 | — | — | 0 | active |
| K-015 | 代码结构 | patterns | 事件总线 payload 约定 | — | — | 0 | active |
| K-016 | 代码结构 | patterns | 同帧冲突固定结算序 | — | — | 0 | active |
| K-017 | 上下文与工程基建 | patterns | 章节级上下文索引（`ctx/` 体系，WXG-T-024） | WXG-T-024 | — | 0 | active |
| K-018 | 上下文与工程基建 | patterns | 导航表锚点必须被守卫校验 | — | — | 0 | active |
| K-019 | 上下文与工程基建 | patterns | 新增 CI job 一律并入 `gate` 收口 | — | — | 0 | active |
| K-020 | 上下文与工程基建 | patterns | 指标分层治理：结构门硬、行为门软 | WXG-T-026 | — | 0 | active |
| K-021 | 上下文与工程基建 | patterns | 「纯查表门禁」模式 | — | — | 0 | active |
| K-022 | 流程 | patterns | 八要素 spawn 模板 | — | — | 0 | active |
| K-023 | 流程 | patterns | 双层验证 | — | — | 0 | active |
| K-024 | 流程 | patterns | 裁决留痕 | — | — | 0 | active |
| K-025 | 工具链 | toolchain | 门禁里的「特殊豁免」要早删——它会把真实数据不一致静默吞掉 | WXG-T-029 | 2026-09-12 | 0 | active |
| K-026 | 工具链 | toolchain | 留痕日志混装多来源主体时，去重键必须按「主体类型」分流 | WXG-T-029 | 2026-09-12 | 0 | active |
| K-027 | 流程 | patterns | 旁挂式生命周期层升级存量 md 沉淀层 | WXG-T-029 | — | 0 | active |
| K-028 | 流程 | patterns | 访问计数「自动 + 显式」双通道 | WXG-T-029 | — | 0 | active |
| K-029 | 工具链 | toolchain | 自增 ID 的下界必须取自既有数据，不能只看计数器 | WXG-T-029 | 2026-09-12 | 0 | active |
| K-030 | 工具链 | toolchain | 产物进索引前先确认「新鲜度契约」——脚本自测会假绿 | WXG-T-029 | 2026-09-12 | 0 | active |
| K-031 | 工具链 | toolchain | 多产物生成器新增产物时，必须同任务登记 pre-commit 的 `git add` 清单 | WXG-T-036 | 2026-09-13 | 0 | active |
| K-032 | 工具链 | toolchain | 「逃生阀」两侧都支持时，文档必须写成 | WXG-T-036 | 2026-09-13 | 0 | active |
| K-033 | 工具链 | toolchain | 能否用符号链接做「一处正本」，判据是 | WXG-T-043 | 2026-09-13 | 0 | active |
| K-034 | 工具链 | toolchain | 协议第二跳的准入条件不能沿用「热度 + 体积」——引用面覆盖率必须独立成硬门（D2） | WXG-T-044 | 2026-09-13 | 0 | active |
| K-035 | 流程 | process | 文档状态列混淆「规格已写」与「代码已实现」= 可访问性假绿的温床 | WXG-T-084 | 2026-09-14 | 0 | active |
| K-036 | 流程 | process | 多项串联的门禁若「失败即短路」且「缺对象仍报绿」，它的 ✅ 不构成任何证据 | WXG-T-084 | 2026-09-15 | 0 | active |
| K-037 | 流程 | process | 「指令流层可证」≠「屏幕层可证」：Node 探针全绿不得抬升表现层结论 | WXG-T-092 | 2026-09-15 | 0 | active |
| K-038 | 测试 | testing | 自动化统一走「便捷旁路 API」，真输入链可以整段断链而全绿 | WXG-T-096 | 2026-09-15 | 0 | active |
| K-039 | 流程 | process | 报绿之后又动了源码：交付自述必须与最终状态同一时点 | WXG-T-096 | 2026-09-15 | 0 | active |
| K-040 | 判据 | criteria | 判据回写轮的三个读数陷阱：改严≠回归、作废≠平凡真、文档一致≠代码一致 | WXG-T-098 | 2026-09-15 | 0 | active |
| K-041 | 判据 | criteria | 容差写法：不得吞掉被测变更，帧量化只进时刻轴 | WXG-T-098 | 2026-09-15 | 0 | active |
| K-042 | 测试 | testing | 几何单一真源化后测试失去自证能力，须另配不依赖该真源的不变量守卫 | WXG-T-097 | 2026-09-15 | 0 | active |
| K-043 | 工具链 | toolchain | 取证脚本里「装载动作」必须写在模块 import 之前，否则拿到上一轮旧产物造出假 FAIL | WXG-T-097 | 2026-09-15 | 0 | active |
| K-044 | 判据 | criteria | 判定上限由「判据完备性」决定，不由实现进度决定；且不得把「缺通道」当预期写进 PASS 条件 | WXG-T-097 | 2026-09-15 | 0 | active |
| K-045 | 流程 | process | 同一台账文件被并发会话同时写时，`git add <整文件>` 会把别人的 WIP 捎进本单提交 | WXG-T-097 | 2026-09-15 | 0 | active |
| K-046 | 流程 | process | 领号必须读「工作树全文」的全局最大号，只读已提交的头注必撞号 | WXG-T-106 | 2026-09-15 | 0 | active |
| K-047 | 判据 | criteria | 幂等判据必锁「自己写出的产物字形」，写方与读方不同源时假绿与自毁同时存在 | WXG-T-106 | 2026-09-15 | 0 | active |
| K-048 | 工具链 | toolchain | 装置自指文件必须让索引取工作树字节，否则重建-add-校单遍不收敛 | WXG-T-112 | 2026-09-15 | 0 | active |
| K-049 | 工具链 | toolchain | 自测夹具必须由被测生成器播种、依赖按整目录拷贝，否则门禁一扩就整片假红 | WXG-T-121 | 2026-09-16 | 0 | active |
| K-050 | 流程 | process | 缺陷号（`BD-NN`）与任务号同规：领号须读工作树全文，且「已登记 BD-xx」的声明必须回查台账是否真有正本行 | WXG-T-119 | 2026-09-16 | 0 | active |
| K-051 | 判据 | criteria | 规格里的「图元/包体增量」数值是立项时点的推论，落码后必须差分复算、不得沿用 | WXG-T-150 | 2026-09-17 | 0 | active |
| K-052 | 判据 | criteria | 动效时长常量一旦决定「事件发生在哪一帧」，它就是玩法时序而非表现层参数，判据与守卫都得换档 | WXG-T-150 | 2026-09-17 | 0 | active |
| K-053 | 流程 | process | 冻结「语义/行为」反转（数值不变）走「反转批」固定顺序，防漏回写散落的旧裁定 | WXG-T-165 | 2026-09-18 | 0 | active |
| K-054 | 判据 | criteria | 「未登记」不等于「已证伪」：纸面缺账不能推翻真机实证，回滚前必须分清这两种缺失 | WXG-T-129 | 2026-09-18 | 0 | active |
| K-055 | 判据 | criteria | 「连通块」API 的返回序是行主序、不是距锚序：「就近/最近」语义取前 N 前必须显式重排 | WXG-T-168 | 2026-09-18 | 0 | active |
| K-056 | 判据 | criteria | 渲染里「未解锁/扩展」的视觉语言必须随容量语义常量派生：裸行号判定会把已开放行画成未开放，并反噬成「假容量」缺陷报告 | WXG-T-168 | 2026-09-18 | 0 | active |
<!-- kb:active:end -->
