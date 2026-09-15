# 验证与常用命令（docs/agent/commands.md）

> **来源**：自 `AGENTS.md` §6「验证与常用命令」**逐字迁出** · 日期 2026-09-13 · Task ID WXG-T-032（AGENTS.md 瘦身拆分）。
> 正文与迁出前完全一致（仅另加本指针与标题），语义未改动。AGENTS.md 中保留 1 行指针。

## 验证与常用命令

| 命令 | 用途 |
|---|---|
| `pnpm run verify` | 全量门禁 **聚合器** `tools/scripts/verify-all.mjs`（WXG-T-095 / 缺陷 BD-17）：**逐项执行、永不短路**（**步骤数以 `--list` 为准，勿硬编码计数**），末尾打 `PASS/WARN/SKIP/FAIL` 汇总表并据汇总定退出码。旧写法是 `&&` 串链 ⇒ 第一项红就短路、后面各项**从未跑过却看似已测**，故**禁止**把 `verify` 改回 `&&` 串链（`--validate` 会拦这种回退）。子命令可自报 `STATUS: OK\|WARN\|SKIP\|FAIL` 机读标记（`WARN` = **观察期守卫**：发现缺口但**不计通过、不影响退出码**，`--strict` 亦不判红；WXG-T-110 新增第 4 态，详见 `check:host-tests` 行）；`SKIP` **不是通过，是没测**（BD-18），会进汇总表点名。常用参数：`--steps=a,b` 只跑子集 / `--list` 列步骤表 / `--validate` 校验步骤表与 `package.json` 未脱钩 / `--strict` 把 SKIP 判失败 / `--selftest` 合成自测。自测：`pnpm run verify:selftest`（红→绿实测，含「注入失败项后后续仍执行」） |
| `pnpm run check:arch` | 架构守卫 |
| `pnpm run check:es5spread` | **构建层语言契约守卫**（ADR-0012 / 根因 G10）：用 TypeScript 类型检查器 + AST 禁掉对 Set/Map/迭代器/字符串的展开语法（含调用展开与 rest 解构），不可证明为数组即红；**不依赖 Cocos 即可跑**。`--dist` 为可选的产物扫描后置（只列命中不判红） |
| `pnpm run check:host-tests` | **宿主行为测试守卫**（`control-manifest §17` / 根因 缺陷 C1，WXG-T-110）：扫 `packages/framework/src/adapters/<引擎>/` 中含输入归一化模块的适配器，检查是否配对**真正的 Node 行为测试**（判定 = 测试文件**解析到该模块** + **值导入** + **实际调用** + 有 `it(`；**只 `import type`、只读源码跑正则均不算**）。默认 **WARN 且不阻断**（发现缺口退出码仍为 **0**）—— 用户裁定「先观察一轮」，升级条件见脚本输出（**含归一化模块的宿主适配器 ≥ 2 个**时才有真阳性）；`--fail-on-gap` 为**预留**的升级开关，`verify` 当前**不传**它。`--selftest` 桩自测（含反例必报），`pnpm run check:host-tests:selftest` |
| `pnpm run check:size` | 包体校验（阈值真源 `systems-index §3.8`，红线 4096/30720 KB 与内部目标 2000 KB **分列不混用**）。WXG-T-095 / **BD-18**：覆盖面按 `games/*` **逐游戏**计算，缺产物的游戏被列为**未覆盖**，总结论降为 `SKIP`（旧版在此静默打「✅ OK」）；`--strict` 把未全覆盖判失败，`--json` 机读，`--selftest` 桩自测（`pnpm run check:size:selftest`）。注：`wechatgame` 产物需有效 **AppID**（见 `build-cocos.mjs` 头注），无产物属**环境阻塞**而非可忽略空项 |
| `pnpm run check:links` | 四 IDE agents/skills/memory/规则指针完整性（**pre-commit 必跑**） |
| `pnpm run harness` | 启动浏览器验证器 |
| `pnpm run harness:build` / `harness:smoke` | 只编译 / 运行时冒烟 |
| `pnpm run ctx:rotate` | 读账本 `ctx/reads-ledger.jsonl` 分窗轮转（WXG-T-037 R1；默认窗口 20 会话，溢出才落盘） |
| `pnpm run tasks:archive` | 任务台账 `production/TASKS.md` 完成 ≥30 天的 ✅ 行归档（WXG-T-040 R3；默认 dry-run，`--write` 落盘；头注号校准为「主表∪归档全局最大号+1」防并行重号；**成对搬运**（WXG-T-065）：行 → `archive/TASKS-archive.md`、详情节 → `archive/TASKS-DETAIL-archive.md`，**节数 == 行数**否则不落盘；自测 `archive-tasks-selftest.sh`） |
| `pnpm run check:tasks` | 台账格式门（WXG-T-064，已进 `verify`）：主表名称 ≤60 字符 / 任务行连续 / **行⇔详情小节配对** / 无残留已归档小节 / 详情归档不脱钩；`--prune` 把残留小节**搬入**详情归档（搬，不删） |
| `pnpm run memory:distill` | memory 日志满 30 天蒸馏轮转（WXG-T-041 R2；默认 dry-run，`--write` 移入 `memory/archive/` 并在 MEMORY.md 追加待蒸馏提醒；脚本只做机械轮转，蒸馏进 MEMORY.md 由人/会话负责，规程见 `docs/agent/memory-distill.md`；**连座归档**（WXG-T-106）：该天的 `memory/details/<日期>-*` 一同进 `archive/details/`，组内任一重名则整组跳过；自测 `pnpm run memory:distill:selftest`） |
| `pnpm run memory:split` | memory 日记「长节 → 二级详情文件」外移（WXG-T-106）：单节 >600 tok 即逐字节搬到 `memory/details/<日期>-<slug>.md`（含原 `##` 标题行 ⇒ 锚点不失效），日记只留「标题 + 指针」骨架；详情件 H1 即隶属标记（索引「详情」列由它派生，`ctx:check` C-③ 双向硬拦孤儿/断链）；**默认 dry-run**，`--date=<YYYY-MM-DD>` 必填、`--write` 才落盘、目标重名则 fail loud；自测 `pnpm run memory:split:selftest` |
| `pnpm run knowledge:split` | `knowledge/lessons.md` 按**行内标签**逐字节分片到 `knowledge/lessons/<标签>.md`，源文件降为指针页（WXG-T-111；**默认 dry-run**，`--write` 才落盘；未知标签 / 缺 `[K-0NN]` ⇒ fail loud 且零产物；落盘后与 `git show HEAD:` 回拼逐字节自证。**一次性迁移工具**，不挂 `verify`；自测 `pnpm run knowledge:split:selftest`） |
| `pnpm run kb:selftest` | 知识库生命周期（`kb:*` 七脚本）本地桩自测：假仓库跑 sync/collect/touch/audit/archive/reactivate/check 八重校验与负例（原仅 `bash tools/scripts/knowledge-selftest.sh` 可跑、无入口 ⇒ 夹具腐烂 4 项长期无人见，WXG-T-111 修复） |
| `pnpm run selftest:fast` / `selftest:heavy` | **装置自测分档执行器** `tools/scripts/selftests.mjs`（WXG-T-121 / 缺陷 BD-39 · BD-40）：11 件 `*:selftest` 按**实测耗时**分两档 —— fast ≈6.7s（六件自测 **+ 非自测的 `ctx:check`**，BD-40 并入本档）／ heavy ≈25s（五件）。分档理由：全挂进 `verify` 会让本地全量验证 14s → 43s，反而诱发绕开 ⇒ `verify` 目标只挂 fast，**CI 两档都跑**（`ci.yml` unit job 已加两步）。三条规矩：① 逐项执行不短路（K-036：短路后的 ✅ 不构成证据）；② 打 `STATUS: OK\|SKIP\|FAIL` 机读行 ⇒ `verify` 接入只需往 `STEPS` 加一项；③ **完整性守卫** —— 磁盘上冒出未入档的 `*-selftest.sh`、或 package.json 里未入档的 `*:selftest` 入口 ⇒ 当场红；确实挂不上的须写进源码 `AWAITING` 并给理由，它降为 SKIP（**不是通过，是没测**），`--strict` 下判失败。⚠️ 本轮 `verify` 步骤表**尚未**含 `selftest:fast`：`verify-all.mjs` 正被 WXG-T-110 在飞改动（同文件串行）⇒ 待其入库补一行；执行器每次运行都点名该缺口，不会静默 |
| `pnpm run preview:frames` | 关卡 SVG 预览 |
| `pnpm run preview:clip --level 1 --seconds 8` | MP4 实录（需 ffmpeg 与可用的 `@resvg/resvg-js`） |

Node ≥ 20；包管理器以根 `package.json` 的 `packageManager` 为准（pnpm）。
