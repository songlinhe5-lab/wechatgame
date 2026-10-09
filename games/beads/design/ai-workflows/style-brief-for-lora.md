# 拼豆关卡底图 · 美术风格规格书（LoRA 选型用）

> 用途：外部 LoRA 调研（Civitai 等）的需求单。真源：`games/beads/art/art-bible.md` §1/§2/§5/§8、
> 本目录 `README.md` 转化铁规、qwen v5 达标批（`temp/comfyui-out/teaching-set/`）、
> SDXL 失败证据链（`temp/comfyui-out/sdxl-test/` 00010–00022）。
> 数据（2026-10-09）

## 0. 先分清两层风格（最容易调研错的地方）

| 层 | 是什么 | 描边 | 谁负责 |
|---|---|---|---|
| **A. 游戏内成品风格** | 冷调静底 + 糖果 3D 珠（程序化 10 层合成：倒角/rim 光/三层软高光），**无外描边** | ⛔ 重描边卡通是美术圣经**明确排除**的反面参照 | 渲染管线程序化合成，**不需要 LoRA** |
| **B. AI 生成的关卡底图**（LoRA 的目标） | 平面限色原画，喂给 k-means + 网格采样转化器拆成珠子 | ✅ 粗黑描边是**转化采样骨架**（帮算法分区），不是审美本身 | **LoRA 要符合的是这一层** |

> 调研时别被「糖果质感」带偏去找 3D 渲染 LoRA——那是成品层，底图要的是**极端平面**。

## 1. 底图四条硬指标（转化器判据，缺一即 FAIL）

1. **纯白背景**：单色纯净底，便于抠图；灰渐变底/纹理纸底都过不了。
2. **黑色闭合粗轮廓**：每个色块边界清晰闭合，描边偏细会漏分区（v5 遗留 CONCERN）。
3. **大色块平涂**：每区域一块纯色——零渐变、零高光、零阴影、零纹理、零 3D
   （v3 实测教训：高光渐变被 k-means 压出碎色，不可拆解）。
4. **正视角单主体居中**：front view、一个物体、剪影大胆清晰。

## 2. 色彩与尺寸预算（限色是硬约束）

| 档位 | 原画尺寸 | 目标格数 | 色数上限（大色块计） |
|---|---|---|---|
| 普通关 1–8 | 1024px | 16×16 | **≤8 色** |
| Boss 关 | 1024px | 32×32 | **≤16 色** |

> 2026-10-09 换制：原画全 1024 直出（旧 boss=2048 废）；格数由转化器采样决定，1024 对 32×32 档每格 32px 采样足够；2048 直出在 SDXL/Flux 均易出问题。

> 2026-10-09 用户换制：旧 ≤5/≤7 作废（两模型对自然语言限色约束均不服，收紧预算只会制造伪 FAIL；限色真正的执行层在转化器 k-means）。

- 细节必须少到缩到目标格数仍可辨（大形状、少小件）。
- 色相走主题糖果系（低饱和干净底、高饱和主体色），但**具体色板由转化器对齐 10 色珠子色板**，LoRA 不需管 HEX。

## 3. 题材清单（教学 9 关）

心形 / 雏菊 / 五角星 / 笑脸 / 苹果 / 蝴蝶（对称翅膀）/ 彩虹拱（3 色带 + 2 云）/ 小房子 /
曼陀罗徽章（boss，对称嵌套环）——全是**简单几何剪影**，这正是 SDXL 线挂掉的软肋（见 §6）。

## 4. 达标参照物（正向锚点）

qwen-image 2.1 v5 现行 prompt 风格尾（已 9/9 达标，可直接当「你想要的样子」描述）：

```
flat 2D vector-style illustration, bold clean black outlines around every shape,
sticker style, solid uniform color fills, flat cel shading, front view,
absolutely no gradients, no highlights, no shadows, no glossy reflections,
no 3D rendering, no surface texture, at most eight distinct flat colors total,
isolated on pure white background
```

证据图：`temp/comfyui-out/teaching-set/`（A/B 素材库）。

## 5. 禁词表（踩过的坑，选 LoRA 时反向筛）

| 禁 | 原因（实测教训） |
|---|---|
| `bead / pegboard / pixel grid` | 模型会画出自带珠格的伪像素图，转化器没法拆 |
| `glossy / sheen / highlight / soft lighting / realistic material / 3D render` | v3 批：出立体产品渲染，高光渐变→碎色 |
| `1solo` 等 danbooru 人物 tag | SDXL 读作「单人角色」→ 直接出动漫少女 |
| `sticker sheet` 类训练目标的 LoRA | 出**多贴纸排版合集**（StickerSheet 实测：降权 0.35、负面词全压不住） |
| lineart 类 LoRA（高强度） | 带「场景线稿」先验 → 背景画出整条街道 |

## 6. SDXL 线失败根因（选型时必须绕开的坑）

**sd_xl_base 对「简单实心图形」的结构 prior 太弱**——11 轮冒烟（00010–00022）确诊：

- 心形被理解成 logo 空心环 / 白心红徽章 / 波点装饰画 / 空心涂鸦；
- **换风格 LoRA 治不了结构理解**：LoRA 只改画风，不改「一个实心红心」画不画得对。

⇒ **重启判据**（README 已登记）：

1. **带结构约束方案**（ControlNet canny/lineart 先给干净轮廓再上色）——最靠谱方向；
2. 或**更强图标底模**（训练集就是 simple icon / flat vector 数据集的底模或 LoRA）；
3. 单 LoRA 不够时考虑组合：**结构 LoRA（或 ControlNet）+ 平涂风格 LoRA** 分工，
   别指望一个 LoRA 既管结构又管风格。

## 7. Civitai 调研关键词（按 §6 判据翻译）

- 风格侧：`flat illustration` `flat color` `vector art` `minimal icon` `cel shading`
  `sticker`（⚠️ 单个 sticker 词要验训练集是**单张贴纸**还是**贴纸合集**——本仓已栽在后者）。
- 结构侧：`controlnet canny` `lineart`（作上色约束用，不是作风格用）。
- 筛样张法：直接看模型页有没有 **heart / star / smiley 这类几何小物的样例**——
  只出人物/风景的模型大概率结构 prior 不行。

## 8. 验收流程（找到候选后怎么测）

1. 单题冒烟：heart（seed 4201，与 qwen v5 同题同种子）；
2. 过 §1 四硬指标 + §2 色数预算 → 目验；
3. 达标再放 9 关全套（`temp/comfy-sdxl-batch.sh` 改 STYLE/NEG 即可复用）；
4. 与 qwen v5 版并排出对照表，比转化友好度（喂 `beads-studio` localhost:8787 实测拆珠）。
