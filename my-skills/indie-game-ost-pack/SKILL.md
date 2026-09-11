---
name: indie-game-ost-pack
description: 当用户要生成游戏配乐/BGM 音频文件时使用：一次做出 8 到 15 首可循环原创器乐（标题/探索/战斗/商店/胜利等槽位），交付带标签原声带。属 wxgame-audio-spec 的执行层——生成前先查其音频事件表（SFX/BGM 事件 ID）；音频规格与混音设计不走本 skill。
---

> **本仓运行纪律（家族约定，见 `my-skills/INDEX.md`）**
> ① 首次使用先执行 `python3 scripts/mcp_client.py update --auto off` 关闭静默自动更新——未确认即替换文件对 monorepo 风险过高；如需升级先用 `--check` 查版本，经用户确认后再 `update`。
> ② 本包不路由任何相邻/第三方 skill；用户提及本家族之外的 Beatra 包（如 short-video-bgm-studio）时，如实告知本仓未安装、不可路由。
> ③ 通用安装/计费/任务参考文档在共享层 `my-skills/_beatra-runtime/references/`（本包 references 内对应文件为相对符号链接）；`scripts/` 因含各包安装常量而各自独立，均为唯一正本。


# 游戏配乐·独立游戏原声带

把游戏简报做成带标签的原创原声带。常规交付是 8 到 15 首器乐底乐，不是一首歌。

## 适用范围与边界

独立游戏、小游戏或互动作品需要一套可复用、便于循环、工作室可商用的原创器乐时，使用本 Skill。

**本仓未安装的相邻 Beatra 包一律不路由**（成片单曲、直播歌单、品牌 jingle、短剧配乐、带词歌曲、剧情对白等）。用户提出这类需求时：停止并如实告知「本仓未安装对应包、不可伪调用」；不要发明回退路径或 REST 调用。UI 口播走本仓已安装的 `game-ui-voice-pack`；音频规格设计走 `wxgame-audio-spec`。

## 输入与默认值

硬输入是：

- 游戏的设定或品类；
- 原声带要几首，或允许使用默认 10 首；
- 原声带要守住的气质。

复用已知世界观、战斗强度、界面需要和排除项。只有答案会改变包规模或付费槽位时才问。
8 到 15 以外的数量也能做：确认该规模和实时费用，不要当成做不到。

安全默认：

- 用户没点名 8 到 15 之间的数量时，用 10 首。
- 槽位搭配：标题、探索、战斗、商店、胜利、失败和安静据点底乐。
- `instrumental: true` 且不带歌词。
- `model: "suno-5.5"`。绝不省略模型，也绝不悄悄使用 `auto`。
- 没有 `duration` 字段可用在 `beatra.music.generate` 上。时长只写进提示词。不要加 duration 参数。
- 便于循环写成提示词方向，而不是单独控件。不要承诺无缝循环或采样级精确秒数。以实际返回时长为准。

原声带规划免费。每次 `beatra.music.generate` 都收费。

## 标准路径

1. 写游戏卡片和带标签的槽位表。每个槽位有用途、情绪、节奏感、乐器、能量和目标时长。
2. 调用 `beatra.models.list` 并传入 `{"capability":"text_to_music"}`，按实时信息卡给整包报价。
3. 确认冻结原声带：槽位数、每个槽位的提示词和曲名、`instrumental: true`、模型、整包当前最高费用，以及每个槽位一个不透明且稳定的 `client_request_id`。做方案不等于批准。
4. 每个槽位只通过随包的 `scripts/mcp_client.py` 提交一次。示例：

   ```text
   printf '%s' '{"model":"suno-5.5","prompt":"Indie game explore bed, warm acoustic fantasy, loop-friendly, about 90 seconds, no vocals.","instrumental":true,"title":"Explore 01","client_request_id":"opaque-game-explore-01"}' | python3 scripts/mcp_client.py call beatra.music.generate
   ```

   不要配置、调用或使用宿主 Beatra Connector。不要使用 REST/OpenAPI 作为回退。
5. 用 `beatra.tasks.get` 轮询每个任务。按槽位顺序交付带标签原声带，附上真实时长、MIME 类型、大小、URL 或产物 ID、解析出的模型，以及 `billing.net_charged_credits`。
6. 复核每首底乐是否便于循环、是否贴合槽位。读真实时长。说明宿主 Agent 听不到什么。

## 需要确认的决策

第一次付费调用前，确认原声带规模和实时整包估价。槽位提示词、曲名、模型或数量一变，只对变化的槽位用新的请求 ID 做新的付费工作。

## 故障恢复

创建响应丢失时，只重放该槽位冻结后的同一载荷和 ID。任务 ID 丢失时，用 `beatra.tasks.list` 列出文生音乐任务，用 `beatra.tasks.get` 检查候选，先找回原槽位再做新工作。只有用户要求取消该槽位时才用 `beatra.tasks.cancel`；遇到 409 继续轮询。

## 按任务查阅参考

- 槽位卡片、载荷、轮询、恢复和复核，读[独立游戏原声带工作流](references/workflow.md)。
- 授权需要处理时，再读[安装与认证](references/installation-and-auth.md)。
- 首次注册读[安装注册](references/installation-registration.md)。
- 任务和计费事实读[任务与结果](references/tasks-and-results.md)和[计费、错误与恢复](references/billing-errors-and-recovery.md)。
- 随包客户端连不上时读[随包 MCP Client 连接诊断](references/mcp-connection.md)。
- 更新开关读[自动更新与安全](references/automatic-updates-and-safety.md)。
- 用户要求移除本包时，再读[卸载与断开连接](references/uninstall-and-disconnect.md)。

## 运行时与安全的自动更新

每个 Beatra 操作都使用或调用随包的 `scripts/mcp_client.py`。随包客户端会在每个安装中静默检查更新，最多每 24 小时一次。发现更高版本时，不另行确认地自动安装。

它只使用针对本包、渠道和语言环境固定的 Beatra 官方发现地址和不可变 CDN 路径，在替换前校验发现信息、压缩包、清单和每个随包文件，并且只替换本包拥有的文件。它拒绝重定向、降级、错误的包/渠道/语言/版本数据、意外 URL、不安全压缩包，以及目标目录外的文件。

更新检查、下载、校验、替换、回滚和恢复失败时会 fail open：当前安装仍可使用，原本请求的命令会继续执行。更新失败绝不构成重试付费生成的理由。这个设置会在后续命令中持续生效：

```text
python3 scripts/mcp_client.py update --auto off
python3 scripts/mcp_client.py update --auto on
python3 scripts/mcp_client.py update --check
```

`--auto off` 关闭静默检查，`--auto on` 恢复，`--check` 报告官方可用版本但不替换文件。
