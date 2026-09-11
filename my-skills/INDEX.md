# wxgame skill 家族 INDEX

> 本文件是 `my-skills/` 全家族的统一约定（人读 + 编排者读）。
> 各 IDE 只扫描含 `SKILL.md` 的子目录，本文件不参与自动触发。

## 1. 现役清单（11 个，四 IDE 链接生效）与存档（2 个，仅本目录留档）

| 层级 | skill | 职责 |
|---|---|---|
| 编排 | `wxgame-orchestration` | 九阶段（0–8）流水线、spawn 模板（含第 8 要素"必读 skill 路径"）、成员→skill 路由表、质量门判定 |
| 域·策划 | `wxgame-gdd-writer` | 一页纸概念 → systems-index（冻结常量）→ 八节 GDD → 十查评审 |
| 域·策划 | `wxgame-ux-spec` | Screen Flow、ASCII 线框、状态×输入矩阵、动效毫秒表、微信首 10 秒留存 |
| 域·技术 | `wxgame-adr-arch` | ADR 五节、主架构、控制清单 |
| 域·技术 | `wxgame-epic-split` | Epic 拓扑序、Story 四要素（引用式验收 S\<n\>§8-\<k\>）、垂直切片 |
| 域·美术 | `wxgame-art-spec-programmatic` | 程序化美术三件套、色盲三重编码、包体预算承诺 |
| 域·音频 | `wxgame-audio-spec` | 音频五件套**框架版**（数值 `[TODO]`，实做后回写） |
| 域·QA | `wxgame-qa-gates` | 测试计划/硬判据用例/冒烟/缺陷分级/Playtest |
| 域·发布 | `wxgame-release-checklist` | 六阶段发布、微信上架、版本策略、回滚预案 |
| 执行 | `indie-game-ost-pack` | 生成 8–15 首原创配乐（audio-spec 的执行层） |
| 执行 | `game-ui-voice-pack` | 生成 UI 口播语音文件（audio-spec 的执行层） |
| 存档 | `game-studio` | 通用引擎知识库（Godot/Unity/Unreal）；与本仓方法论冲突，已下链接，点名查档；references 按需单文件读取 |
| 存档 | `game-dev-tool-free` | 市场 Boilerplate，不可用；留档备查 |

> **共享层 `_beatra-runtime/`**（下划线开头、无 SKILL.md，不参与触发）：存放 ost / voice
> 两包逐字一致的 7 份参考文档正本（安装/计费/任务/MCP 连接等）；两包 references 内对应
> 文件为相对符号链接，`scripts/` 因含各包安装常量而各自独立。运行纪律见两包 SKILL.md
> 开头（默认 `--auto off`、不路由第三方包）。

## 2. 默认管线顺序与何时不走全 SOP

- **全 SOP**（新游戏/大功能）：`orchestration` 阶段诊断 → 按九阶段表 spawn
  对应成员（prompt 必附该成员的 SKILL.md 路径）→ 质量门 → 汇编。
- **不走全 SOP**（孤立小问题）：直调对应域 skill 或成员，无需阶段诊断；
  判断标准——问题是否横跨两个以上职责域，是则回全 SOP。

## 3. Skill 优先级（冲突时高者胜）

```
wxgame-orchestration（流程与裁决）
  > wxgame-* 域 skill（本仓方法论）
    > 执行 pack（indie-game-ost-pack / game-ui-voice-pack）
      > 外来通用（game-studio 等存档，仅点名）
```

## 4. 路径约定

| 产物 | 路径 |
|---|---|
| 游戏（策划/美术/源码） | `games/<game>/design` · `games/<game>/art` · `games/<game>/src` |
| 架构与 ADR | `docs/architecture/`（含 `adr/`、`control-manifest.md`） |
| QA 产物 | `production/qa/` |
| 发布产物 | `production/release/` |
| Epic/冲刺 | `production/epics/` · `production/sprints/` |
| skill 正本 | `my-skills/<name>/`（四 IDE 目录均为相对符号链接） |

## 5. 冲突裁决链

1. `games/<game>/design/gdd/systems-index.md` **§3 冻结常量** 是数值唯一真源
2. > 其他任何设计/美术/QA/发布文档
3. 本仓 `wxgame-*` 方法论 > 外来通用 skill
4. 文档冲突先改文档再改代码；代码与 §3 冲突以 §3 为准并登记漂移

## 6. Provenance 说明

除 `audio-spec`（框架版）外，各 `wxgame-*` 均提炼自 Breakout demo 的实际产物，
实例路径见各 SKILL.md 文末「实例参照」；本文件不再逐份重复出处。
