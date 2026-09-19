# wxgame skill 家族 INDEX

> 本文件是 `my-skills/` 全家族的统一约定（人读 + 编排者读）。
> 各 IDE 只扫描含 `SKILL.md` 的子目录，本文件不参与自动触发。

## 1. 清单（现役 33 个挂四 IDE 链接；存档 1 个仅本目录留档）

| 层级 | skill | 职责 |
|---|---|---|
| 编排 | `wxgame-orchestration` | 九阶段（0–8）流水线、spawn 模板（八要素，含必读 skill 路径）、成员→skill 路由表、PASS/CONCERNS/FAIL 与 G1–G4 挂钩 |
| 域·策划 | `wxgame-gdd-writer` | 一页纸概念 → systems-index（冻结常量）→ 八节 GDD → 十查评审；**§5 数值平衡核对**（CCGS `balance-check` 吸收，WXG-T-175） |
| 域·策划 | `wxgame-ux-spec` | Screen Flow、ASCII 线框、状态×输入矩阵、动效毫秒表、微信首 10 秒留存 |
| 域·技术 | `wxgame-adr-arch` | ADR 五节、主架构、控制清单 |
| 域·技术 | `wxgame-epic-split` | Epic 拓扑序、Story 四要素（引用式验收 S\<n\>§8-\<k\>）、垂直切片；**§7 Story 实现 + §8 ready/done 门禁**（CCGS `dev-story`/`story-readiness`+`story-done` 吸收，WXG-T-175） |
| 域·美术 | `wxgame-art-spec-programmatic` | 程序化美术三件套、色盲三重编码、包体预算承诺 |
| 域·音频 | `wxgame-audio-spec` | 音频五件套**框架版**（数值 `[TODO]`，实做后回写） |
| 域·QA | `wxgame-qa-gates` | 测试计划/硬判据用例/冒烟/缺陷分级/Playtest |
| 域·QA | `wxgame-quality-gate` | 执行 verify 全量门禁 + **强制工具调用报告表**（会话结论透明化，WXG-T-021） |
| 域·发布 | `wxgame-release-checklist` | 六阶段发布、微信上架、版本策略、回滚预案 |
| 域·数值 | `game-numeric-design` | 数值策划方法论（五特性模型 / 设定流程 / 公式工具库）；**冻结值仍以 systems-index §3 为准，本 skill 只供方法论** |
| 域·合规 | `game-material-precheck` | 中国大陆宣发素材合规审核（合法/IP/文化宗教/敏感日期/舆情）→ HTML 报告；发布阶段配套 |
| 域·平台 | `wxgame-minigame-bridge` | 微信小游戏**执行层·本仓适配**：预览 / 热重载 / 日志 / 真机二维码 / 上传开发版。能力同源 `@weadmin/weixin-minigame-helper-mcp@0.1.13`（根 `.mcp.json` + `.cursor/mcp.json` 锚定；vendor 留档 `my-plugins/`）。**现状：双前置未通——Cocos 编辑器未装、构建链未通（ADR-0009 P2），`games/<g>/build/wechatgame/` 不存在 → 全场景暂不可用**。原 `weixin-minigame-helper` 副本已改名改造消解同名双注册（ADR-0010） |
| 域·AI | `game-ai-design` | NPC AI 三层解耦（decide/steer/path）、行为树、寻路；当前无 NPC 玩法，备用 |
| 执行 | `indie-game-ost-pack` | 生成 8–15 首原创配乐（audio-spec 的执行层） |
| 执行 | `game-ui-voice-pack` | 生成 UI 口播语音文件（audio-spec 的执行层） |
| 点名兜底 | `game-studio` | 通用引擎知识库（Godot/Unity/Unreal）；`disable-model-invocation: true`，仅明确点名时加载；references 按需单文件读取 |
| 存档 | `game-dev-tool-free` | 市场 Boilerplate，不可用；未挂链接，留档备查 |

> **共享层 `_beatra-runtime/`**（下划线开头、无 SKILL.md，不参与触发）：存放 ost / voice
> 两包逐字一致的 7 份参考文档正本（安装/计费/任务/MCP 连接等）；两包 references 内对应
> 文件为相对符号链接，`scripts/` 因含各包安装常量而各自独立。运行纪律见两包 SKILL.md
> 开头（默认 `--auto off`、不路由第三方包）。

## 1b. 外来通用·AI 编程工作流（16 个，2026-09-16 装入，挂四 IDE 链接）

来源均为标准 SKILL.md 格式（MIT），安全审计通过（无危险命令/外传行为）。正本在本目录，git 克隆留档 `_repos/mattpocock-skills/`、`_repos/superpowers/`（更新方式：`cd _repos/<repo> && git pull` 后重新 `cp -R` 对应技能目录覆盖）。

| 来源 | skill | 职责 |
|---|---|---|
| mattpocock/skills | `grill-me` | 动手前对抗式拷问方案；仅显式触发（`disable-model-invocation: true`），**必须与 `grilling` 成对使用** |
| mattpocock/skills | `grilling` | grill-me 的方法本体：设计树分轮追问，每题附推荐答案 |
| obra/superpowers | `using-superpowers` | 技能链总入口/调度说明 |
| obra/superpowers | `brainstorming` | 任何创造性工作前的需求探索（附本地 Web 辅助脚本） |
| obra/superpowers | `writing-plans` / `executing-plans` | 设计 → 小步计划 → 批量执行 |
| obra/superpowers | `test-driven-development` | 强制红-绿-重构循环 |
| obra/superpowers | `subagent-driven-development` | 每任务派发子代理 + 两阶段审查 |
| obra/superpowers | `dispatching-parallel-agents` | 并行子代理派发 |
| obra/superpowers | `requesting-code-review` / `receiving-code-review` | 代码审查请求/回应 |
| obra/superpowers | `finishing-a-development-branch` | 分支收尾（合并/PR/清理） |
| obra/superpowers | `using-git-worktrees` | 隔离 worktree 分支开发 |
| obra/superpowers | `systematic-debugging` | 四阶段根因调查 |
| obra/superpowers | `verification-before-completion` | 宣称完成前强制验证 |
| obra/superpowers | `writing-skills` | 编写新 skill 的元技能 |

> 归类：优先级链中的「外来通用」层。与 `wxgame-*` 冲突时以后者为准；
> 链接为项目级 `.<ide>/skills/<name> → ../../my-skills/<name>`，仅在**本工程**生效。

## 2. 默认管线顺序与何时不走全 SOP

- **全 SOP**（新游戏/大功能）：`orchestration` 阶段诊断 → 按九阶段表 spawn
  对应成员（prompt 必附该成员的 SKILL.md 路径）→ 质量门 → 汇编。
- **不走全 SOP**（孤立小问题）：直调对应域 skill 或成员，无需阶段诊断；
  判断标准——问题是否横跨两个以上职责域，是则回全 SOP。
  各域 skill 正文均含「跨域或全流程请求先交 `wxgame-orchestration`」。

## 3. Skill 优先级（冲突时高者胜）

```
wxgame-orchestration（流程与裁决）
  > wxgame-* 域 skill（本仓方法论）
    > 外来现役（game-numeric-design / game-material-precheck /
      wxgame-minigame-bridge / game-ai-design——外部方法论与平台执行，
      与 wxgame-* 冲突时以后者为准：如数值冻结值一律以 systems-index §3 为准）
      > 执行 pack（indie-game-ost-pack / game-ui-voice-pack）
        > 外来通用（game-studio 等存档，仅点名）
```

> **CCGS 吸收件已并入 wxgame-\***（WXG-T-175，用户 2026-09-19 裁定）：原三件独立 skill
> （`wxgame-story-dev` / `wxgame-story-gate` / `wxgame-balance-check`）**已删除**，内容分别并入
> `wxgame-epic-split` §7/§8 与 `wxgame-gdd-writer` §5 —— 与现役 skill 同域同触发机制，
> 不再单列一层。上游留档在 `my-skills/_repos/Claude-Code-Game-Studios/`，**与
> `_repos/superpowers`、`_repos/mattpocock-skills` 同惯例：仅本地备查、不入库**
> （更新：`cd _repos/Claude-Code-Game-Studios && git pull`）。

## 4. 路径约定

| 产物 | 路径 |
|---|---|
| 游戏（策划/美术/源码） | `games/<game>/design` · `games/<game>/art` · `games/<game>/src` |
| 架构与 ADR | `docs/architecture/`（含 `adr/`、`control-manifest.md`） |
| QA 产物 | `production/qa/` |
| 发布产物 | `production/release/` |
| Epic/冲刺 | `production/epics/` · `production/sprints/` |
| skill 正本 | `my-skills/<name>/`（四 IDE 目录均为相对符号链接） |
| SubAgent 正本 | `my-agents/<name>.md`（四 IDE `.*/agents/` 相对符号链接；见 `my-agents/INDEX.md`） |
| 项目常驻记忆 | 根目录 `AGENTS.md`（四 IDE alwaysApply 指针见该文件文首） |
| 长期笔记 | `memory/MEMORY.md`（四 IDE 经 `.*/memory` 索引，见 `AGENTS.md`） |

## 5. 冲突裁决链

1. `games/<game>/design/gdd/systems-index.md` **§3 冻结常量** 是数值唯一真源
2. > 其他任何设计/美术/QA/发布文档
3. 本仓 `wxgame-*` 方法论 > 外来通用 skill
4. 文档冲突先改文档再改代码；代码与 §3 冲突以 §3 为准并登记漂移

## 6. Provenance 说明

除 `audio-spec`（框架版）外，各 `wxgame-*` 均提炼自 Breakout demo 的实际产物，
实例路径见各 SKILL.md 文末「实例参照」；本文件不再逐份重复出处。
