---
name: wxgame-audio-gen
description: 为小游戏**生成**可入库的音频资产并接进工程：背景音乐走阿里云百炼 fun-music 模型（同步返回音频 url），音效走本地 jsfxr（零网络、零付费、确定性可复现），两者都产出 base64/文件与实测表。当用户要求"生成 BGM""做音效""接入音乐""换掉合成音""audioAssets""百炼 fun-music"时使用。互斥分工：音频规格（事件表/混音/循环要求）走 wxgame-audio-spec；本 skill 只产资产与接线清单；UI 口播走 game-ui-voice-pack；带 Beatra 依赖的 pack 属外部执行层（需授权与 credits，本 skill 不依赖）。
---

# wxgame 音频资产生成（BGM 云端 + 音效本地）

本 skill 属 wxgame 家族（管线顺序与冲突裁决见 `my-skills/INDEX.md`）。
**它是执行层**：先有 `wxgame-audio-spec` 的事件表与时长上限，本 skill 才照语义产资产。

## 0. 何时用 / 何时不用

| 用 | 不用 |
|---|---|
| 运行时合成音色达不到要求，需要真素材（本仓 beads 即此例：v1.51/v1.52 改判） | 只想要事件表、bus、循环要求、响度关系 → `wxgame-audio-spec` |
| 要一把生成整套 SFX 并出 base64 资产表 | 要 UI 口播语音 → `game-ui-voice-pack` |
| 要把资产算进包体预算并出实测表 | 要改玩法/时序数值 → 那是 `systems-index §3` 变更单 |

## 1. 两条产出路径

### 1.1 音效 —— 本地 jsfxr（推荐默认）

```bash
node my-skills/wxgame-audio-gen/scripts/gen-sfx.mjs            # 写 audioAssets.js + 打印实测表
node my-skills/wxgame-audio-gen/scripts/gen-sfx.mjs --dry --sr 22050 --kbps 64
```

- 依赖：`jsfxr`（pnpm workspace 根 devDependency）+ 本机 `lame`（缺则回退 `ffmpeg`）。
- **零网络、零付费、确定性**：同一份配方必得同一字节产物（已 md5 复验）。
- 配方表 `SFX_TABLE` 每条带 `id / desc / durMs`，**id 必须与 `tuning.ts` 的 `AUDIO_CLIP_*` 一致**，
  `durMs` 取自 `ux-spec §5` 的时长上限（不得凭手感放宽；脚本内置 `fitDuration` 自动贴合，绝不越界）。
- ⚠ 两个 jsfxr 的坑（已踩，勿重复）：
  ① 参数对象必须是 `new Params()`，裸对象会报 `p_base_freq of undefined`；
  ② **别用 `sfxr.toWave()` 的返回值** —— 它走浏览器 `RIFFWAVE` shim，Node 下产出的字节流不是合法 WAV。
     只取 `new SoundEffect(p).getRawBuffer()` 的 PCM，自己写头（脚本已实现）。
     内部采样率由 `sample_rate` 决定（`summands = 44100 / sampleRate`），44100 时是全速合成，可信。
- ⚠ 音色取向：jsfxr 自我定位含 `8-bit / chiptune / retro`，而 `audio-spec §1` 负面清单①写着
  「不做 8-bit **方波**爆裂音」⇒ 配方一律 `wave_type=2`（三角）或 `3`（噪声）+ 低通，**禁用 0（方波）**。
  治愈度不够时先加低通与减 `sound_vol`，仍不达意就该换素材来源，不要在配方上无限磨。

### 1.2 背景音乐 —— 阿里云百炼 fun-music

```bash
export DASHSCOPE_API_KEY="sk-xxx"        # 脚本不落盘、不打印 key
node my-skills/wxgame-audio-gen/scripts/gen-music.mjs \
  --prompt "手作拼豆治愈系，音乐盒与软电钢，舒缓、不抢注意力、无鼓，游戏背景音乐" \
  --instrumental --out games/beads/assets/audio/bgm_main.mp3 --loop 40
```

- 端点与语义（官方文档 2026-09-23 抓取）：`POST https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/music/generation`，
  `Authorization: Bearer $DASHSCOPE_API_KEY`，body `{model, input:{prompt|lyrics, is_instrumental, gender}}`，
  **同步**返回 `output.audio.url`（要再 GET 一次下载）；`format` = `mp3|wav`；
  `v1` 支持纯音乐 `is_instrumental`（此时 `lyrics`/`gender` 被忽略）与 `gender`（仅 v1）。
- 需要 **业务空间 ID**（`--workspace`，或环境变量 / 仓库根 `.env.local` 里的 `DASHSCOPE_WORKSPACE_ID`）。
- **计费**：属云端付费服务 ⇒ 首次调用前必须向用户报明并得到同意；一次一首，别默认批量。
- 已探路部分（2026-09-23 用假 key）：**端点可达、请求确实发出、失败体为平铺
  `{request_id, code, message}`**（网关回 401 `InvalidApiKey`）⇒ URL 形状与网络已验。
- ⚠ **成功路径仍未实测**（需真 key）：`output.audio.url` 的确切层级、`format` 挂在
  `parameters` 还是 `input`、url 有效期。脚本在取不到 url 时会**打印真实响应结构**要求改，
  而不是猜；首次真实调用请保留输出以便校准。
- ⚠ 该模型**不承诺无缝循环**：`--loop N` 只是裁到 N 秒并淡出；接缝质量必须真听复验，
  规格里（`audio-spec §3.2`）在验过之前不得写"无缝"。

## 2. 接线状态（诚实清单，别把"有文件"当"有声音"）

| 环节 | 状态 |
|---|---|
PCM/MP3/base64 产出 | ✅ 可用（SFX 侧已实测：19 条、base64 合计 **60.5 KB**） |
资产文件（base64 路线） | ✅ `games/beads/src/config/audioAssets.ts` —— **必须是 `.ts`**：harness 的 tsconfig 与 `framework:sync` 只收 TS 源文件，放 `assets/` 下的 `.js` 永远不会被编译/镜像进 Cocos 产物（= 又一个"有文件但放不出"） |
| 资产文件（文件路线） | ✅ 落 **`games/<game>/audio/`**，不要放 `cocos/assets/` 下（下一行是坑）；harness 靠 `dev/harness/audio` 符号链接读同一份真源，构建靠 `build-cocos.mjs::stageExtraAssets()` 入包
**运行时消费者** | ✅ **已接（方案 A）**：`audio-voices.ts::withAssets()` 把 asset 挂到 `AudioVoice.asset` ⇒ `SynthAudioBackend` 在 `unlock()` 解码一次进 `_assetBuffers`，命中即**优先于** notes 合成 |
播放通路 | ✅ WebAudio `decodeAudioData`，同时兼容 Promise 式与旧回调式签名；自带 base64 解码（不依赖 `atob` / `Buffer` —— weapp 两者都不保证有） |
解码不可用时 | ✅ **自动回退 notes 合成，绝不静音**（这条是刻意的：素材路线不能制造"有文件却放不出"的新缺陷） |
weapp 真机 | ⚠ `[R]` **未取证**：`wx.createWebAudioContext` 是否提供 `decodeAudioData` 未验 ⇒ 最坏是仍播合成音（不是静音）。真机过一遍前不得宣布"素材已可闻" |
包体口径 | ✅ 进**主包 JS** 60.5 KB（`§3.9` 内部目标已抬至 4096 KB）；数字取 `AUDIO_ASSET_SIZES` 实测，不预估 |
**长音频分流** | ✅ **BGM 走 `AudioVoice.assetFile` + 平台原生播放器**（weapp `InnerAudioContext` / web `Audio`）：40 s 走 `decodeAudioData` 会让 **≈7 MB PCM 常驻 JS 堆**；`assetFile` 优先于 `asset`，原生不可用 ⇒ 回退合成。⚠ 短音效**不要**用这条（并发多条撞原生实例池，且 45 KB 不值得起文件） |
| BGM 启用状态 | ✅ **已启用**（beads）：`games/beads/audio/bgm_porch.mp3` 703.8 KB / 60.03 s，voice 表 `assetFile: 'audio/bgm_porch.mp3'` |
| **⚠ Cocos 不打包"字符串引用的文件"** | 真机确诊的坑：文件放 `cocos/assets/<任意目录>/` ⇒ 构建产物里 **0 个 mp3**、真机整首没声。Cocos 只打包被场景/预制静态引用的资源与 `resources/`／bundle 目录；运行时用路径字符串交给原生播放器的文件**不在依赖图里**。解法：真源放工程外（`games/<game>/audio/`），由 `build-cocos.mjs::stageExtraAssets()` 在构建后拷进 `build/<platform>/audio/`，运行时相对串 `audio/xxx.mp3` 三端一致 |
| 播放失败可见性 | ✅ `SynthInnerAudio.onError` 必备：把 `errCode`/原因打进 `[audio]` 日志并永久回退合成。交付时若日志出现该行 ⇒ 是路径/格式问题，别当成"素材音色不好" |

⇒ 每次交付都要把这张表原样回给用户。**判据家底**：框架侧 6 条（`packages/framework/tests/platform/audio-synth.test.ts`「素材路线 v1.52」）+ 游戏侧 3 条（`audio-dispatch.test.ts`「v1.52 素材接线」）。


## 3. 交付与验证判据

1. 生成后必跑 `node my-skills/wxgame-audio-gen/scripts/gen-sfx.mjs`，把**实测表**（每条 ms / mp3 KB / base64 KB / 是否越 `§5` 上限）贴进会话结论，不报估算值。
2. 体积必须回写 `audio-spec §4.2` 与 `systems-index §3.9` 相关行（图元/包体类数值一律**落码后差分复算**，本仓既有纪律）。
3. 进仓前确认：格式白名单与体积上限以 `audio-spec §4.2` + 判据 A05-25 为**唯一真源**（本 skill 不复述具体格式清单，避免两处漂移）；`check:size` 绿；A05-25 与 `audio-dispatch.test.ts` 的 clip 断言随改判同步（**改，不是删**）。
4. 静音可玩红线（A05-23）不因换素材而放松：每条音频信息都必须有独立视觉通道。

## 4. 与其他音频件的关系

- `wxgame-audio-spec` = 规格（要什么音、多长、多响、什么红线）；**本 skill 不发明规格**，只照它产资产。
- `indie-game-ost-pack` / `game-ui-voice-pack` = 依赖 Beatra 授权与 credits 的外部 pack；本 skill **不依赖它们**，
  目的是在"无服务器、未开云账号"时也能交付音频资产（音效全本地；音乐可选百炼，需 key）。
- 与玩法数值无关：不改 `§3` 时长/时序冻结值；`AUDIO_CLIP_TOTAL` 之类是**闭合集**，加/减 clip 必须走变更单并六方原子批。
