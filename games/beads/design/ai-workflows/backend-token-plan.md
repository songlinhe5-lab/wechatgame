# 阿里云 Token Plan 后端接入事实单（图 / 音 / 视频 / 领域模型）

> **本件只管"端点怎么敲、参数挂哪、实测什么数"**——是执行层事实单。
> **选型裁定正本仍是 `model-matrix.md`**（§1 四方向 / §2 价目），冲突以矩阵为准。
> 建件：2026-10-31，用户接入 Token Plan 订阅并要求把可用能力集成进 skill。

## 1. 三条计费通道互不相通（先记住，否则白花钱）

| 通道 | Key 变量 | Base URL | 备注 |
|---|---|---|---|
| 按量付费（专属 MaaS 实例） | `DASHSCOPE_API_KEY` | `https://llm-<WorkspaceId>.cn-beijing.maas.aliyuncs.com` | 现有产线，`model-matrix §2` 的元/张口径全部来自这条 |
| **Token Plan 订阅** | `TOKEN_PLAN_API_KEY` | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | 本件主题；**Credits 计量**，元/张口径不适用 |
| Coding Plan | — | — | 未开通 |

⛔ **混用必坏**：Token Plan 的 key 拿去打专属实例 → `401 InvalidApiKey`（实测）；反向则会
**走按量通道意外扣费**。`.env.local` 里三组变量并列且 gitignore 覆盖，切后端＝切 profile，
**不是**切 key 值。

> ⚠ 安全债：本轮用户把 key **明文贴进对话**（会进会话历史）。`.env.local` 本身不入库，
> 但仍建议**轮换**该 key；轮换后只改 `.env.local`，脚本无需改动。

## 2. 在册 21 个模型（`GET {BASE}/models` 实测返回）

| 能力 | 在册 | 本仓态度 |
|---|---|---|
| 生图 / 图像编辑 | `qwen-image-3.0-pro` | ✅ 已实测（§3、§3.1）|
| 生图 / 交互式编辑 | `wan2.7-image` | ✅ 已实测（§3.2，2026-11-01）——**走同一个同步端点，脚本零改造** |
| 生图 | `wan2.7-image-pro` | ⚪ **在册但一次未跑**（按量口径 0.50 元/张；4K / `color_palette` / 组图 / `thinking_mode` 均**未实测**）。⚠ 官方**输出段未声明带不带 alpha**（「PNG 不支持透明通道」那句属**输入**格式限制，⛔ 勿误引为输出结论）⇒ 透明终判待发（配方 `production/qa/cloud-image-directions-20261101.md §4-C1`）|
| 语音合成 | `qwen-audio-3.0-tts-plus` | ✅ 已实测（§4） |
| 语音识别 | `qwen-audio-3.0-asr-flash` | ⚪ 端点存在，**未实跑** |
| 实时语音 | `qwen-audio-3.0-realtime-plus` | ⚪ 未实跑（小游戏无实时语音场景） |
| 视频生成 | `wan3.0-video` | ⚠ **只支持异步**，未实跑（§5） |
| 文本 / 推理 / 视觉理解 | `auto`、`qwen3.8-max`、`qwen3.8-flash`、`qwen3.7-max`、`qwen3.7-plus`、`qwen3.6-flash`、`deepseek-v4-pro[-0813]`、`deepseek-v4.1-flash[-1017]`、`deepseek-v4-flash-0731`、`glm-5.2`、`glm-5.3` | ⚪ 端点存在，未纳入产线 |
| **领域模型** | `decision-model-preview` | ✅ 已标定，**限时免费**（§6） |

**两个直接影响选型的缺口**（与 `model-matrix §1` 的在册首选不重合）：

- ⛔ **qwen-image-2.1 系（pro / turbo）不在册** ⇒ 矩阵 §1 ①「原型设计」首选 **2.1-turbo 在 Token Plan 上调不到**。
- ⛔ **非 pro 的 `qwen-image-3.0` 不在册**（只有 pro）⇒ 矩阵 §1 ②⑤「基准稿产线」用的正是非 pro 3.0。
- ⛔ `happyhorse-1.1-r2v/t2v/i2v` **不在册**（用户清单里有，网关模型列表里没有 ⇒ 可能未开通权限）。
- ⛔ `fun-music` **不在册** ⇒ `wxgame-audio-gen §1.2` 的 BGM 腿仍只能走按量付费通道。

⇒ **「pro 版按用户指示排除」这条在册裁定（`model-matrix §2` 注、§3 表两行划掉）是按量付费
价格（0.25–0.50 元/张）下做的**。**2026-11-01 用户裁定：仅在 Token Plan（Credits）通道解除**⇒ 两通道
分别记账，⛔ 混价；三方向 × 三腿整合判决 → `production/qa/cloud-image-directions-20261101.md`。

## 3. 生图与图像编辑（已实测 ✓）

**请求格式与专属实例逐字兼容**，所以脚本不新增，只加 `--profile`：

```bash
# 文生图
python3 games/beads/design/ai-workflows/dashscope-generate.py \
  --profile token-plan --model qwen-image-3.0-pro --text "<正向提示词>" --size '768*1024'
# 图像编辑（＝同一端点 + 参考图；--ref 把图 base64 内联进 content）
python3 games/beads/design/ai-workflows/dashscope-generate.py \
  --profile token-plan --model qwen-image-3.0-pro --ref <底图.png> --text "<编辑指令>" --size '768*1024'
```

| 实测项 | 值 |
|---|---|
| 端点 | `POST {host}/api/v1/services/aigc/multimodal-generation/generation` |
| 成功体 | `output.choices[0].message.content[0].image`（OSS url，**会过期** ⇒ 脚本已当场下载） |
| `--size` | **自由档位，不吃枚举**：`768*1024`、`512*512` 均直接出图，`usage.output_width/height` 回显实尺寸 |
| 计费记号 | `usage.input_image_type/output_image_type = qima_input_1k / qima_output_1k`（⇒ 1K 档；2K 是否另一档 **未取证**） |
| 编辑腿 | `input_image_count: 1` 确认 ref 被吃进去；752×1344 底图 + 指令 → 200，**10.8 s** |
| t2i | 512² 200，**23.9 s** |
| `--seed` | 传 seed 会同时置 `prompt_extend=False`（脚本既有行为，`rewrite_status` 回 `not_use` 已验） |

⚠ 与旧记录的耗时差异（专属实例 3.0 是 26.1 s、pro 是 36.7 s）**不作为改判依据**：不同后端
实例的排队时间不可比，且单 seed 单次不得翻案（`model-matrix` 文首铁规）。

### 3.1 pro 3.0 的能力边界（2026-11-01 实测，两条都是**结构性**的）

| 项 | 实测结论 |
|---|---|
| **无 mask 输入** | `parameters.mask_image_url` 传进去不报错也不生效（`input_image_count` 仍为 1）⇒ 只能**指令编辑**，整图重绘；要锁框外必须配程序化回贴。带 mask 的局部重绘属**万相系**（`description_edit_with_mask`），不属千问 |
| **无 alpha 输出** | 指令写「背景完全透明（alpha=0）」⇒ 回图 `mode=RGB`，且背景被**画成灰白棋盘格**（假透明的另一形态：`wxgame-image-gen §3` 记的是「alpha 全 255 无语义」，本条是「棋盘格被画进 RGB」）⚠ 比「没透明」危险：不知情的话会直接当成品入库 |
| 官方口径印证 | 模型选型建议里「能根据提示词自动决定输出普通图像或**带透明通道的图像**」只写在 **qwen-image-2.1-pro / 2.1-turbo** 两行；3.0-pro 那行无此描述（而 2.1 系在本通道**不在册**） |
| 输入图数 | 3.0 系 **1–3 张**（2.1 系 1–10 张）；建议宽高 384–3072 px，面积 512²–2048²，宽高比 1:8–8:1 |
| 尺寸行为 | `size` 与底图同给（752*1344）时输出尺寸**逐像素一致**，但内容会整体平移（实测 dx +8）⇒ 回贴前必须做最佳平移对齐 |

读数与完整实验设置（两 seed 对照 + 目测）→ `production/qa/pro30-edit-cut-20261101.md`。

**能力位补充**（同日续测 ① 新页面首稿 / ② 固定风格二级页，各两 seed vs 按量腿）：**均未优于现首选**
—— ② 机检两项反向、目测持平（两者都直接继承参考图实景背景）；① 只赢在「两张已拥有」这类**数量词**
精确遵循（2/2 vs 0/2），输在把**实景道具**画进界面（0/2 vs 2/2）。⇒ 本通道图像的价值 =
「背景有结构时的剔除」那一张，**不是「更好的生图」**。证据 `production/qa/pro30-proto-bench-20261101.md`。

### 3.2 wan2.7-image（2026-11-01 实测：补上千问缺的半条腿）

**同一个 `multimodal-generation/generation` 同步端点直接可用**（4/4 成功），`--size` 走「像素值方式」逐像素命中。
官方参数表里 **`bbox_list` 是千问没给的框选能力**（`[x1,y1,x2,y2]` 原图绝对像素、单图最多 2 框、
列表长度必须＝输入图数），脚本已加 `--bbox` 透传（带 `--check`）。

| 实测项 | 值 |
|---|---|
| 耗时 | t2i **12.3–13.4 s**；i2i + bbox **8.9 s**（本仓目前最快的云编辑腿）|
| `size` 下限 | 总像素 ∈ **[768², 2048²]**、比例 1:8–8:1 ⇒ ⚠ 设计稿 @2x 小件（CTA 640×176）**不达标**，需按比例放大（本轮取 1500×412）|
| 有图输入时 | 输出宽高比**跟输入图一致**再缩放到选定规格 ⇒ 编辑腿不能自由改比例 |
| **bbox 效果** | 框外 meanΔ **7.57**（千问无 mask = 13.26，**降 43%**）、**dx+0 dy+0 零平移**；但框外 maxΔ **165** ⇒ **是指引不是像素锁**，回贴仍必需、只是可省对齐那一步 |
| 中文短文案 | **3/3 全对**（「拼豆小铺」×2 seed + 「开始游戏」）；整屏多标签仍判负（不翻案）|
| 透明通道 | ⛔ 无，且形态更险：**`mode=RGBA` 但 `alpha=0` 占 0.00%、min 253** ⇒ 验收必须查 **alpha 分布**，只查 `mode` 会被骗 |
| 未取证 | `prompt_extend`（qwen 线参数，官方 wan 表无此键）传了不报错，**是否被忽略未证** ⇒ 脚本已把 wan 线置空 `{}` |

读数、四发配方与官方参数全表 → `production/qa/wan27-token-plan-20261101.md`。

## 4. UI 口播 TTS（已实测 ✓）

```bash
python3 my-skills/wxgame-audio-gen/scripts/gen-tts.py --list <lines.tsv> --out games/beads/audio/voice/
```

| 实测项 | 值 |
|---|---|
| 端点 | `POST {host}/api/v1/services/audio/tts/SpeechSynthesizer` —— service 段是 **`audio`**，写成 `aigc` 会回 `url error`（**不是鉴权问题**） |
| 参数 | `input.text`（写 `text_prompt` 回 400 `Please ensure input text is valid.`）+ `parameters{voice, format}` |
| 音色 | `longanhuan_v3.6` 可用；**非法值回 `Engine error [411]` 且不吐枚举** ⇒ 其余音色名 `[TODO]`，查官方页再填，别猜 |
| 产物 | `output.audio.url`（http，**24h 过期**）；脚本当场下载并 `ffprobe` 报实测时长 |
| 实测表 | 「开始游戏」1248 ms / 24.5 KB · 「这一关过了，去下一关」2304 ms / 45.1 KB（均 mp3，单条 1.1–1.8 s） |

体积口径提醒：`wxgame-audio-gen §2` 已确诊「短音效不要走文件路线（撞原生实例池）」与
「BGM 长音频走 `assetFile`」——口播属哪一档，接进 `audio-voices.ts` 前按那两条判，本件不复述。

## 5. 视频（未实跑，别当可用）

- 原生 `POST {host}/api/v1/services/aigc/video-generation/video-synthesis` 对同步调用回
  **`403 AccessDenied: current user api does not support synchronous calls`**（实测）⇒ **必须异步**：
  带 `X-DashScope-Async: enable` 拿 `task_id`，再轮询 `GET {host}/api/v1/tasks/{task_id}`。
- 该链路**未实跑**（真跑即产一条视频、吃 Credits），**需用户明确要求再做**。
- 当前无视频素材需求 ⇒ 不写脚本（YAGNI），要时按上面两行建。

## 6. 领域决策模型（已标定 ✓ · 限时免费）

`decision-model-preview` 不是聊天模型：一次前向返回 `choice / noul / score` 三类判定 +
概率分布，**零输出 token**（实测 262–275 input tokens、服务端 46–75 ms）。

```bash
python3 tools/scripts/decision-model.py --check            # 离线自检，不联网
python3 tools/scripts/decision-model.py \
  --cases production/qa/decision-model-cases.jsonl \
  --questions production/qa/decision-model-questions.json  # 18 条真实缺陷分级样本
```

接线裁定（**可接哪 / 不能接哪，含四条"不进运行时"的理由**）见正本：
**`production/qa/decision-model-calibration-20261031.md`**。三条最硬的：`owner` 归口可接（17/18）；
`severity` 分级只当预分类提示（MAE 1.00 档）；`blocks_release` **不接**（漏判 P0 代价不可逆）。

## 7. 文本 / ASR（端点存在，未纳入产线）

`{BASE}/chat/completions`、`{BASE}/responses`、Anthropic 兼容 `{host}/v1/messages`、
`{BASE}/audio/transcriptions` 均以"非法模型名探测法"验过存在（回 `Model not exist` 而非
path 404 ⇒ 端点在、鉴权已过、**零成本**）。本仓暂无调用场景，**不预先接线**。

> 探测法记一句：`POST` 一个 `{"model":"__probe__"}`，看错误码是 `Model not exist` 还是 404，
> 就能在不花钱的前提下区分「路径错」与「模型不在这个通道」。本轮四条腿全靠它定位。
