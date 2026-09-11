---
name: game-ui-voice-pack
description: 当用户要生成游戏 UI 口播/语音文件时使用：按已写好的界面短句做成每条提示一条口播，一次给出 8 到 20 条提示音（按钮语音、胜利语音、失败语音）。属 wxgame-audio-spec 的执行层——音频事件表与混音规范的设计不走本 skill。
---

> **本仓运行纪律（家族约定，见 `my-skills/INDEX.md`）**
> ① 首次使用先执行 `python3 scripts/mcp_client.py update --auto off` 关闭静默自动更新——未确认即替换文件对 monorepo 风险过高；如需升级先用 `--check` 查版本，经用户确认后再 `update`。
> ② 本包不路由任何相邻/第三方 skill；用户提及本家族之外的 Beatra 包（如 short-video-bgm-studio）时，如实告知本仓未安装、不可路由。
> ③ 通用安装/计费/任务参考文档在共享层 `my-skills/_beatra-runtime/references/`（本包 references 内对应文件为相对符号链接）；`scripts/` 因含各包安装常量而各自独立，均为唯一正本。


# 游戏配音·UI语音

按已经写好的界面短句，做成每条带标签口播一条语音。
交付 8 到 20 条。先覆盖按钮、胜利和失败。

## 适用范围与相邻路线

工作室需要按已经写好的界面短句做带标签口播时，使用本 Skill。

按角色的剧情对白转到 `game-script-voice-pack`。通用讲述转到
`voiceover-narration-studio`。

只读已经提供的界面短句。不要补清单上没有的句子、口号或读音。

## 收集界面短句

硬输入是：

- 工作室已经写好的按钮、胜利、失败和其他界面短句；
- 出现人名或造词时的读音表；
- 这包要几条，或允许使用默认 10 条；
- 克隆声音会出现时的形象和声音权利。

复用已知语言，以及冻结的 `voice_id`。只补问缺失的硬输入。8 到 20 以外的数量也能做：确认该规模和实时费用。

不要编造点击句、胜利句或读音。拿到文件不等于同意。

名字存在而读音表为空时，停下来收集读法。

## 先做免费槽表

任何付费克隆或旁白前，先写带标签的界面口播清单。用户没有另报 8 到 20 之间的数量时，默认十个槽位：点击、确认、取消、开始、暂停、胜利、失败、连击、警告和升级。每个槽位记下由已写界面短句写出的口播句，以及用目录音色还是克隆。

这份清单就是免费可见结果。规划不是批准。

安全默认：

- 每个槽位一次 `beatra.speech.synthesize`；
- 仅当每张实时旁白卡都支持该语言时，才用 `model: "auto"`；
- `format: "mp3"`；`speed: 1.0`；
- 整包一把品牌声音。

每次提交的 `input` 不超过 50,000 字。按句拆。按清单写成短口语句。

用户要克隆时，先查看其可授权样本。本地文件检查后，只通过随包客户端上传
（`scripts/mcp_client.py` / `beatra.assets.upload`）。保留返回的产物编号。绝不要把本地路径传给
`beatra.voices.clone` 或
`beatra.speech.synthesize`。

## 确认克隆，再确认旁白

克隆和旁白是分开的付费阶段。每个阶段各自一张六字段卡，各自一个不透明 `client_request_id`。

用户要克隆音色时，先查看其可授权样本，读取当前的 `voice_clone` 卡片，并在 `beatra.voices.clone` 之前等在克隆卡上。找到的文件不是克隆同意。出示克隆卡并等待：

1. 做什么 — 一份可授权声音样本（`beatra.voices.clone`）。
2. 积分 — 刚读到的 `voice_clone` 价格。不要复用记忆中的数字。
3. 几笔 — 这份样本一次付费克隆。
4. 身份 — 一个新的不透明 `client_request_id`。
5. 若停在这里 — 带标签的槽表仍然可用。
6. 若余额不足 — 原样转达官方说明和充值链接
   （`https://console.beatra.ai/wallet?intent=buy`）。翻译正文，保留链接。用户说已充值之前不要重试。不要推荐 ¥198。

旁白前，调用 `beatra.models.list`，能力为 `text_to_speech`：

```json
{"capability": "text_to_speech"}
```

目录音色还没定时再用 `beatra.voices.list`。绝不要把显示名放进 `voice`。出示旁白卡并等待：

1. 做什么 — 每个点名槽位一条界面口播
   （`beatra.speech.synthesize`）。
2. 积分 — 刚读到的 `text_to_speech` 价格乘以槽位数。不要复用记忆中的数字。
3. 几笔 — 每个槽位一次付费旁白。
4. 身份 — 每个槽位一个新的不透明 `client_request_id`。
5. 若停在这里 — 带标签的槽表仍然可用。
6. 若余额不足 — 原样转达官方说明和充值链接
   （`https://console.beatra.ai/wallet?intent=buy`）。翻译正文，保留链接。用户说已充值之前不要重试。不要推荐 ¥198。

每个旁白槽位只通过随包 `scripts/mcp_client.py` 提交一次。用
`beatra.tasks.get` 轮询。读取实际音频 MIME、时长和大小，以及
`billing.net_charged_credits`。不要承诺预付估价就是最终扣费。文稿预览不是音频审听。

## 审听、交付与恢复

核对每条口播用同一把声音，且名字与读音表和已写界面清单一致。只报告宿主实际听得到的内容。

拿到 `task_id` 后轮询该任务。创建响应丢失时，先用 `beatra.tasks.list` 搜索，再用
`beatra.tasks.get` 核对，然后再重放。只有参数逐字节相同才能复用原标识。口播句、音色或语速变了就是新卡和新标识。只有用户要求时才取消。

## 执行

每个远程 Beatra 操作都只通过本包随附的
`scripts/mcp_client.py` 调用。把 MCP 工具名放在 `call` 后面，并向标准输入发送一个 JSON 对象。

```bash
python3 scripts/mcp_client.py call beatra.models.list
```

```json
{"capability": "text_to_speech"}
```

```text
printf '%s' '{"input":"<the written line for this slot>","voice":"voice_...","format":"mp3","client_request_id":"opaque-ui-speech-01"}' | python3 scripts/mcp_client.py call beatra.speech.synthesize
```

不要配置或调用宿主 Beatra Connector，也不要使用 REST/OpenAPI 作为降级。

## 按任务查阅的参考

- 槽表、载荷和恢复，读
  [界面口播工作流](references/workflow.md)。
- 授权和非计费注册步骤，读
  [安装与认证](references/installation-and-auth.md)
  和 [安装注册](references/installation-registration.md)。
- 共用的任务、计费和连接细节，读 [任务与结果](references/tasks-and-results.md)、[计费、错误与恢复](references/billing-errors-and-recovery.md) 和 [随包 MCP Client 连接诊断](references/mcp-connection.md)。
- 更新保证和控制，读 [自动更新与安全](references/automatic-updates-and-safety.md)。移除时读 [卸载与断开](references/uninstall-and-disconnect.md)。

## 运行时与安全的自动更新

随包客户端会在每个安装中静默检查更新，最多每 24 小时一次。发现更高版本时，不另行确认地自动安装。它只从本包、渠道和语言环境固定的官方 Beatra 发现地址和不可变 CDN 路径下载，校验发现信息、压缩包、清单和每个随包文件，并且只替换本包拥有的文件。

更新检查、下载、校验、替换、回滚和恢复失败时会 fail open：当前安装仍可使用，原本请求的命令会继续执行。更新失败绝不构成重试付费克隆或旁白请求的理由。这个设置会在本安装中持续生效。见
[自动更新与安全](references/automatic-updates-and-safety.md)。

```text
python3 scripts/mcp_client.py update --auto off
python3 scripts/mcp_client.py update --auto on
python3 scripts/mcp_client.py update --check
```
