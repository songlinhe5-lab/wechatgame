# AGENTS.md — wechatgame 项目级 Agent 指引

> 本文件是**项目常驻记忆层**：新开对话应先读这里，再按需加载 skill / 深文档。
> 方法论细节在 `my-skills/`；工程细则在 `docs/architecture/control-manifest.md`。
> **不要**把本文件写成第二个 INDEX 或完整 GDD。

## IDE 常驻指针（alwaysApply）

提示词正文正本：`my-rules/agents-md.md`（并集 frontmatter）。各 IDE 路径为相对符号链接，**不要**在 `.cursor/rules` 等处改摘要：

| IDE | 链接路径 |
|---|---|
| Cursor | `.cursor/rules/agents-md.mdc` → `../../my-rules/agents-md.md` |
| CodeBuddy | `.codebuddy/rules/agents-md/RULE.mdc` → `../../../my-rules/agents-md.md` |
| WorkBuddy | `.workbuddy/rules/agents-md/RULE.mdc` → `../../../my-rules/agents-md.md` |
| Qoder | `.qoder/rules/agents-md.md` → `../../my-rules/agents-md.md` |

## 长期笔记 MEMORY（四 IDE 可索引）

| 角色 | 路径 |
|---|---|
| **正本** | `memory/MEMORY.md`（日记：`memory/YYYY-MM-DD.md`） |
| WorkBuddy | `.workbuddy/memory` → `../memory` |
| CodeBuddy | `.codebuddy/memory` → `../memory` |
| Qoder | `.qoder/memory` → `../memory` |
| Cursor | `.cursor/memory/MEMORY.md`（入口指针；内容请读正本） |

---

## 1. 项目是什么

- **pnpm monorepo**：共用框架 `packages/framework` + 每款游戏 `games/<game>/`（首款示例：`games/breakout`）。
- **目标平台**：微信小游戏为主；日常验证靠浏览器 harness（`dev/harness`），不依赖真机也能推进逻辑与渲染。
- **引擎策略**：玩法与框架 core **引擎无关**，可在纯 Node 单测；Cocos 仅作适配/启动壳（见 ADR）。
- **已知限制**：`build:wx` / Cocos Creator CLI 真机构建尚未接入；无编辑器时**禁止伪造** `.scene` / `.prefab` / `.meta`。

---

## 2. 默认怎么干活

| 意图 | 走哪里 |
|---|---|
| 全流程 / 跨域 / 阶段诊断 / 质量门裁决 | `wxgame-orchestration`（先读 `my-skills/wxgame-orchestration/SKILL.md`） |
| 单域交付物（GDD / UX / ADR / Epic / 美术 / QA / 发布…） | 对应 `my-skills/wxgame-*`；家族清单与优先级见 `my-skills/INDEX.md` |
| **工作室成员委派（SubAgent）** | 正本 `my-agents/`（6 成员 + `studio-orchestrator`）；委派时 `subagent_type` = `<name>`。四 IDE：`.cursor\|.codebuddy\|.workbuddy\|.qoder/agents/<name>.md` → `../../my-agents/<name>.md`。清单见 `my-agents/INDEX.md` |
| 生成配乐 / UI 口播**文件** | `indie-game-ost-pack` / `game-ui-voice-pack`（先查 `wxgame-audio-spec` 事件表） |
| Godot/Unity/Unreal 通用引擎查漏 | 仅当用户**明确点名** `game-studio`（已 `disable-model-invocation`） |
| 市场版「游戏开发助手免费版」 | **不用**；`game-dev-tool-free` 仅存档、未挂 IDE 链接 |

- **Hooks / 提交门禁**、**Headless / PR 流水线**、Cursor Hooks → 见 §8 分层阅读指引。

**主理人触发条件（条件式，非默认人格）**：

| 命中则… | 条件 |
|---|---|
| 先做阶段 0 诊断，或 `@studio-orchestrator` / 读 `wxgame-orchestration` | 跨 **≥2** 职责域；**新游戏 / 新系统**；发布决策；用户点名九阶段 / 专家团 / 编排 |
| **不要**拉满九阶段 | 孤立单域小改（修 typo、单文件、单 skill 交付）；直调对应 `wxgame-*` 或单成员 |

`studio-orchestrator` 是**可召唤的 SubAgent**，不会自动占据主对话。主对话遵守上表即可；需要完整编排人格时再显式委派。

**Skill 优先级（冲突时高者胜）**：

```text
orchestration > wxgame-* 域 skill > 执行 pack > 外来通用（仅点名）
```

**Skill 正本**：`my-skills/<name>/`。四处 IDE 链接（相对符号链接，随仓库提交）：

- `.cursor/skills/` · `.codebuddy/skills/` · `.workbuddy/skills/` · `.qoder/skills/`

新增 skill：正本进 `my-skills/`，四处各建 `../../my-skills/<name>` 链接。

跨域或「整款游戏从哪开始」→ 先交编排，不要自己跳着写全套文档。

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

包体：**平台红线**（微信主包 ≤4MB、主包+分包 ≤30MB）与**内部更紧目标**分清，勿混用。

---

## 5. 目录与产物落位

```text
packages/framework/src/
  core/        引擎无关（默认可单测）
  adapters/    cocos / canvas2d 桥接
  platform/    node / web / weapp
games/<game>/
  design/      概念 · GDD · UX · 关卡 JSON
  art/         美术圣经 · 资产规格 · 可访问性
  src/         玩法（引擎无关）
  tests/       vitest（纯 Node）
  cocos/       仅 Bootstrap 壳
docs/architecture/   主架构 · ADR · 控制清单
production/qa|release|epics|sprints/
dev/harness/         浏览器验证器
my-skills/           Agent Skills 正本 + INDEX.md
my-agents/           SubAgent 正本 + INDEX.md
my-rules/            跨 IDE alwaysApply 规则正本 + INDEX.md
knowledge/           知识库（教训 lessons / 模式 patterns + INDEX 读写协议）
tools/scripts/       架构守卫 · 关卡同步 · harness · 预览
```

关卡：**JSON 为准**（如 `games/breakout/design/levels/levels-01-05.json`）→ 生成 `src/config/levels-data.ts`，用 `pnpm run levels:sync` / `levels:check`。

---

## 6. 验证与常用命令

| 命令 | 用途 |
|---|---|
| `pnpm run verify` | 全量门禁：架构守卫 + 四 IDE 链接 + 关卡 check + typecheck + test + harness 编译 + 冒烟 |
| `pnpm run check:arch` | 架构守卫 |
| `pnpm run check:links` | 四 IDE agents/skills/memory/规则指针完整性（**pre-commit 必跑**） |
| `pnpm run harness` | 启动浏览器验证器 |
| `pnpm run harness:build` / `harness:smoke` | 只编译 / 运行时冒烟 |
| `pnpm run preview:frames` | 关卡 SVG 预览 |
| `pnpm run preview:clip --level 1 --seconds 8` | MP4 实录（需 ffmpeg 与可用的 `@resvg/resvg-js`） |

Node ≥ 20；包管理器以根 `package.json` 的 `packageManager` 为准（pnpm）。

---

## 7. 协作纪律

- **先问再写**：创建/大改文件前先确认路径与范围（编排铁律同此）。
- **不擅自** `git commit` / `push` / 发布 / 删除高影响产物，除非用户明确要求。
- **环境做不到的事**写明阻塞与解除条件；**禁止伪造**编辑器产物或「假绿」测试。
- 重大决策给 **2–4 个选项**让用户拍板；孤立小问题可直调对应域 skill，无需走满九阶段。
- QA 文档与判据走 `wxgame-qa-gates`（G1–G4）；阶段 **PASS / CONCERNS / FAIL** 裁决属编排者。

---

## 8. 分层阅读指引（避免一次灌进全文）

| 需要… | 读 |
|---|---|
| 找"该读哪个文件的哪一节" | ctx/ROUTES.md（章节级锚点路由表，先读它再分段读） |
| 项目入口与铁律 | **本文件**（`AGENTS.md`） |
| 长期笔记 / 脚本备忘 / 已知限制 | `memory/MEMORY.md` |
| Skill 清单 / 优先级 / 路径约定 | `my-skills/INDEX.md` |
| 九阶段 SOP / 成员→skill 路由 | `my-skills/wxgame-orchestration/SKILL.md` |
| 工程打回细则 | `docs/architecture/control-manifest.md` |
| 某域完整模板 | 对应 `my-skills/wxgame-*/SKILL.md` |
| 冻结数值 | `games/<game>/design/gdd/systems-index.md` §3 |
| SubAgent 角色设定 | `my-agents/<name>.md`（见 `my-agents/INDEX.md`） |
| 跨 IDE 常驻规则摘要 | `my-rules/agents-md.md`（见 `my-rules/INDEX.md`） |
| Cursor Hooks / 跨 IDE 提交门禁 | `docs/agent/hooks-best-practices.md` |
| Headless CI / 自动 PR 审查 | `docs/agent/headless-ci-pr-review.md` |
| 教训 / 可复用模式 | `knowledge/INDEX.md`（lessons / patterns，WXG-T-023） |

---

## 9. 知识库与调用透明（WXG-T-023）

**知识库读写协议**（`knowledge/`，正本 `knowledge/INDEX.md`）：
1. **开发前期**：实现/修复/接入/发布类任务开工前，先读 `knowledge/lessons.md` 同域条目，
   相关条目列入任务单必读（spawn 八要素的权威来源清单带上路径）。
2. **任务收尾**：执行者随交付回传 0–3 条沉淀候选（踩坑修复 / 反直觉行为 / 可复用做法；没有传「无」），
   由主理人去重汇编入 `lessons.md` / `patterns.md`，条目必须带 Task ID 可追溯。
3. 只追加不删改；废弃条目标 `[已过时：原因]`；沉淀动作在会话结论的工具调用清单中体现。

**工具调用报告纪律**（会话结论强制）：
1. 每次会话结论必须附**工具调用清单**：凡调用的 skill、spawn 的子代理（成员名 + Task ID + 产物路径）、
   脚本命令、外部能力（图像/音视频生成、web 检索等）逐条列出——格式见 `wxgame-quality-gate` skill §2。
2. 每条给**结果摘要**（成功/失败、passed/failed 数字、commit hash、产物路径），失败项必须给原因与下一步，
   禁止静默省略或「一切正常」式空话。
3. 实现任务收尾自验走 `wxgame-quality-gate`（verify 全量门禁），报告随 commit 回传。
