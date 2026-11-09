# MiniMax-H3 文生视频工作流（内网 ComfyUI）

> 脚本：`tools/scripts/minimax-h3-t2v.py`（仅标准库）
> 服务：`http://192.168.1.16:8188`（Windows · RTX 2080 Ti 11GB · ComfyUI 0.40.0）
> 验证日期：2026-11-09

## 1. 结论先说

**链路已打通，模型未通过。** 提交、排队、采样、VAE 解码、下载、本地合轨全部跑通；
但当前服务器上的第三方 `MiniMax-H3-FL2VA-Pruned-Q3_K_M.gguf` 在 2080 Ti 上
输出**纯黑画面 + 饱和音频**（NaN 隐变量），换 steps / 分辨率 / 提示词 / 注意力后端 /
文本编码器 CPU / bf16 反量化均未修复。

**下一步只需换模型**：把 Comfy-Org 官方
`minimax_h3_fl2va_pruned_int8_convrot.safetensors` 放到
`ComfyUI/models/diffusion_models/`，然后用 `--loader safetensors` 重跑。
若官方模型仍黑，则是 2080 Ti（Turing，无原生 bf16）与 H3 的精度不匹配，需换 GPU 或走云 API。

## 2. 工作流（API 图）

```
UnetLoaderGGUF / UNETLoader
        │
        ├── LoraLoaderModelOnly（turbo 8-step，可关）
        │
        ├── BasicScheduler(simple, steps, denoise=1) ──┐
        └── BasicGuider(conditioning) ──┐              │
                                        ▼              ▼
CLIPLoader(minimax) ─┐        SamplerCustomAdvanced(res_multistep)
Video VAELoader ─────┼── MiniMaxH3ImageToVideo ──→ LATENT ─┘
                     │        │
                     │        └── positive ──→ BasicGuider
                     └── VAE
                              │
              ┌───────────────┴────────────────┐
        VAEDecode(video VAE)            VAEDecodeAudio(audio VAE)
              │                                │
        CreateVideo(fps=24) ───────────────────┘   ← `--audio-mode mux` 官方同款
              │                                     （本机 AAC 对 NaN 报 22）
        SaveVideo(format=auto, codec=auto)

        `--audio-mode separate`（默认）：
        CreateVideo 不接音频 → SaveVideo 静音 MP4
        VAEDecodeAudio → SaveAudioAdvanced(flac) → 本地 ffmpeg 合轨
```

关键约束（节点定义实测）：

| 项 | 值 |
|---|---|
| `width` / `height` | 32 的倍数；模板最小 0.2MP 档 = 608×352，默认 864×480，原生 1344×768 |
| `length` | 24fps 帧数，吸附到 `17k+5` 网格；124 ≈ 5.17s（训练区间 124–362） |
| turbo | 8 步 Lightning LoRA；非 turbo 20 步 |
| 采样器 | `res_multistep` + `simple` |
| 音频 | 32kHz 立体声，音频 VAE `minimax_h3_audio_vae_fp32` |

## 3. 用法

```bash
# 0) 探活 + 列出服务器上可用的 H3 权重/节点
python3 tools/scripts/minimax-h3-t2v.py --probe

# 1) 只看将提交的 API 图，不占 GPU
python3 tools/scripts/minimax-h3-t2v.py --dry-run --width 864 --height 480

# 2) 最小验证档（推荐先跑）
python3 tools/scripts/minimax-h3-t2v.py \
  --prompt "微距俯拍一颗红色拼豆珠子在暖白桌面上缓慢自转" \
  --width 608 --height 352 --seconds 5 --seed 42 \
  --audio-mode separate --out temp/minimax-h3-out

# 3) 官方 safetensors（下载后）
python3 tools/scripts/minimax-h3-t2v.py --loader safetensors \
  --width 864 --height 480 --seconds 5 --audio-mode separate
```

常用开关：

| 开关 | 说明 |
|---|---|
| `--no-turbo` | 关 LoRA，20 步主干（更慢） |
| `--steps N` | 覆盖默认 8（turbo）/ 20 |
| `--audio-mode mux` | 官方同款直封 MP4；本机对 NaN 音频报 `avcodec_send_frame() returned 22` |
| `--audio-mode separate` | 默认；静音 MP4 + FLAC，本地 ffmpeg 合轨 |
| `--audio-mode silent` | 只要画面 |
| `--attention "pytorch attention"` | 显式固定注意力后端 |
| `--clip-device cpu` | 文本编码器跑 CPU（排查 nvfp4） |
| `--gguf-dtype bfloat16` | GGUF 高级反量化（Turing 上实测极慢，不可用） |
| `--loader safetensors` | 改用 Comfy-Org 官方 int8 模型 |

产物落 `temp/minimax-h3-out/`（不入库），同名 `.json` 记录完整参数与 API 图。

## 4. 验证记录（2026-11-09）

| # | 配置 | 耗时 | 画面 | 音频 | 结论 |
|---|---|---|---|---|---|
| 1 | 512×288 / 124f / turbo 6 | 116s | 纯黑 | 饱和 | FAIL |
| 2 | 608×352 / 124f / turbo 8 | 498s | 纯黑 | 饱和 | FAIL |
| 3 | 512×288 / 124f / 20 步无 LoRA | 251s | 纯黑 | 饱和 | FAIL |
| 4 | 512×288 / 124f / clip CPU | 357s | 纯黑 | 饱和 | FAIL |
| 5 | 864×480 / 124f / 模板原提示词 | 321s | 纯黑 | 饱和 | FAIL |
| 6 | 512×288 / 124f / pytorch attention | 201s | 纯黑 | 饱和 | FAIL |
| 7 | 512×288 / bf16 反量化 | >19min 中断 | — | — | 不可用（Turing 无原生 bf16） |

辅助取证：

- **视频 VAE 正常**：`LoadImage → VAEEncode → VAEDecode` 往返输出 256×256、
  7485 种颜色、std 73.07，排除 VAE 权重损坏。
- **音频 VAE 正常**：FLAC 时长 5.175s、32kHz 立体声；坏的是隐变量（NaN）。
- **文本编码器排除**：GPU / CPU 两种跑法都黑。
- **注意力后端排除**：`pytorch attention` 仍黑。

## 5. 下一步（按优先级）

1. **换官方 int8 模型（最可能一次解决）**
   - 下载：`https://huggingface.co/Comfy-Org/MiniMax-H3/blob/main/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors`
   - 放到：`ComfyUI/models/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors`
   - 重跑：`--loader safetensors`
2. **若官方模型仍黑**：2080 Ti 无原生 bf16，H3 需要 bf16 数值范围 → 换 Ampere/Ada 显卡，
   或改用官方云 API（`api.minimax.cn`，768P ¥0.50/秒，4 秒约 ¥2）。
3. **若只是要低显存文生视频**：本机 ComfyUI 另装 Wan2.2-TI2V-5B / LTX-Video 2B，
   11GB 可跑；但那不是 MiniMax H3。

## 6. 已知坑

- **AAC + NaN**：`SaveVideo` 直封音频报 `avcodec_send_frame() returned 22`；
  `aformat=sample_fmts=s16` 可绕过编码器报错，但音频仍是饱和噪声。
- **`VAEDecodeAudioTiled`**：当前 ComfyUI 版本有张量维度 bug（`1600 vs 2`），不要用。
- **GGUF 加载器**：`UnetLoaderGGUF` 读 `models/unet/`（本机映射到 `model_gguf`）；
  `UnetLoaderGGUFAdvanced` 必须显式给 `patch_on_device`。
- **不要用 `--gguf-dtype bfloat16`**：Turing 上 8 步 512×288 跑 19 分钟仍未完成。
