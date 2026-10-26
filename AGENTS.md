# AGENTS.md — wechatgame 项目级 Agent 指引

> 本文件是**项目常驻记忆层**：新开对话先读这里。
> 已瘦身拆分（WXG-T-032）：只保留常驻铁律与触发条件；分节路由见 `ctx/ROUTES.md`。本文件受 `ctx:check` **A 项硬上限**，往里加内容前先等量外移，⛔ 不要直接调阈值。

## 常驻注入与长期笔记

- **提示词正本** = `my-rules/agents-md.md`（每会话强制注入）；**长期笔记正本** = `memory/MEMORY.md`（日记 `memory/YYYY-MM-DD.md`）。各 IDE 路径均为相对符号链接，⛔ 不要在 `.cursor/rules` 等处改摘要。
- **逐条路径表**（规则件 + 记忆件 × 四 IDE；Trae 本地可选）→ `docs/agent/routing.md` §规则件与 MEMORY 件的四 IDE 落位（+ Trae 本地）；链接完整性由 `pnpm run check:links` 机械守。

---

## 1. 项目是什么

- **pnpm monorepo**：共用框架 `packages/framework` + 每款游戏 `games/<game>/`。
- **目标平台**：微信小游戏为主；日常验证靠浏览器 harness（`dev/harness`），不依赖真机也能推进逻辑与渲染。
- **引擎策略**：玩法与框架 core **引擎无关**，可在纯 Node 单测；Cocos 仅作适配/启动壳（见 ADR）。
- **已知限制**：**构建可用** = `pnpm run build:cocos`（**默认即 release 基线档**，排错显式 `--debug`，判例 K-111）；缺真机/上传（AppID + 密钥）。⛔ 无编辑器禁止伪造 `.scene`/`.prefab`/`.meta`。细则见 `memory/MEMORY.md` §已知限制。

---

## 2. 默认怎么干活（路由表）

| 意图 | 走哪里 |
|---|---|
| 全流程 / 跨域 / 质量门裁决 | `wxgame-orchestration`（先读其 `SKILL.md`） |
| 单域交付物（GDD/UX/ADR/Epic/美术/QA/发布…） | 对应 `my-skills/wxgame-*`；清单 `my-skills/INDEX.md` |
| 成员委派（SubAgent） | 正本 `my-agents/`；`subagent_type` = `<name>` |
| 生成配乐 / UI 口播**文件** | `indie-game-ost-pack` / `game-ui-voice-pack`（先查 `wxgame-audio-spec` 事件表） |
| Godot/Unity/Unreal 查漏 · 市场版「游戏开发助手免费版」 | 前者仅当用户**明确点名** `game-studio`（已 `disable-model-invocation`）；后者**不用**（`game-dev-tool-free` 仅存档） |
| 四 IDE 路径 / skill 优先级 | `docs/agent/routing.md` |

**主理人触发条件（条件式，非默认人格）**：

| 命中则… | 条件 |
|---|---|
| 先做阶段 0 诊断，或 `@studio-orchestrator` / 读 `wxgame-orchestration` | 跨 **≥2** 职责域；**新游戏 / 新系统**；发布决策；用户点名九阶段 / 专家团 / 编排 |
| **不要**拉满九阶段 | 孤立单域小改（修 typo、单文件、单 skill 交付）；直调对应 `wxgame-*` 或单成员 |

---

## 3. 不可违反的工程铁律

完整表与评审清单：`docs/architecture/`（`control-manifest.md`、`architecture.md`、`adr/`）。摘要：

| # | 规则 |
|---|---|
| **L1** | 禁止手工编辑 `.scene` / `.prefab` / `.meta`；场景只允许 `GameRoot` + `Bootstrap` |
| **L2** | `packages/framework/src/core/**` 禁止 `cc` / DOM / `wx` / `window` / `document` |
| **L3** | `games/*/src` 禁止 `import 'cc'`（玩法脱离编辑器可验证） |
| **L4** | 禁止 `Math.random()`；用 `services.rng` / `createRng(seed)` |
| **L5** | UI/渲染不持有游戏状态；`buildRenderModel()` 只读 |

另记（同属控制清单精神）：

- **热路径零分配**：`update` / `step` / `buildRenderModel` 内不随意 `new` / `map`/`filter` 造集合。
- **数据驱动**：魔法数字进 `tuning` / 关卡 JSON；颜色进 `palette.ts`。
- **Cocos bindings**（`adapters/cocos/bindings.ts`）**不进**框架 barrel，harness 不可直接编译它。

---

## 4. 冲突裁决与数值真源

1. `games/<game>/design/gdd/systems-index.md` **§3 冻结常量** = 数值唯一真源  
2. 其他设计 / 美术 / QA / 发布文档服从 §3  
3. 本仓 `wxgame-*` 方法论 > 外来通用 skill  
4. 文档冲突先改文档再改代码；代码与 §3 冲突以 §3 为准并**登记漂移**

包体：**平台红线**（主包 ≤4MB、主包+分包 ≤20MB，资质未开通）≠ **内部目标**（各游戏 §3 另列）。

---

## 5. 目录与产物落位

→ `docs/agent/repo-layout.md`。

## 6. 验证与常用命令

→ `docs/agent/commands.md`。

---

## 7. 协作纪律

- **先问再写**：创建/大改文件前先确认路径与范围。
- **完成即提交**：每次修改完成即 `commit` + `push` 并回传提交总结（用户 2026-10-20 令）；发布 / 删除高影响产物仍须用户明确要求；禁强推 / `--no-verify`。
- **推送取证**：以 `git ls-remote` + `git reflog show origin/<branch>` 为准，⛔ 靠 `git status` 推定（正本 `memory/MEMORY.md` §Hooks，判例 K-142）。
- **环境做不到的事**写明阻塞与解除条件。
- 重大决策给 **2–4 个选项**让用户拍板。
- QA 文档走 `wxgame-qa-gates`（G1–G4）；阶段裁决属编排者（见 §2）。

---

## 8. 分层阅读指引（已精简）

第一跳 `ctx/ROUTES.md`（意图 → 锚点）→ 第二跳 `ctx/hot-files.md`（锚点 → `offset`/`limit`）。

---

## 9. 知识库与调用透明（WXG-T-023 摘要）

- **读**：实现/修复/接入/发布类任务开工前，先查 `knowledge/INDEX.md` 活跃表（含「分片」列）定位同域条目，
  只读 `knowledge/lessons/<标签>.md` 里那几条，列入必读。**条目正文已按行内标签分片**（WXG-T-111），
  `knowledge/lessons.md` 只是指针页；引用一律写 **K-0NN**。
- **写**：收尾回传 0–3 条沉淀候选；`kb:sync` 的**沉淀统计（新增/修改/激活/归档）**必须摘入会话结论与台账。
- 完整协议（记账/归档/激活与工具调用报告纪律）：`knowledge/INDEX.md §1/§2/§5`。
- **读（memory）**：日志详情**只在四种触发下查** —— ① 改冻结常量/协议/裁定**前**（查当初为什么）② 接续未完成工作 ③ 追溯**用户原话与裁定** ④ 排障找**当初的确诊法**。入口 `memory/INDEX.md`（定位到节 → 按「详情」列分流：已外移则读 `memory/details/<…>.md`）；`MEMORY.md` 可常读，完整协议见其 §1。
