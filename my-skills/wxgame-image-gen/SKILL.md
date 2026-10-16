---
name: wxgame-image-gen
description: 生成或修改小游戏图像（原型、二级页、切图、局部微调、抠图）时使用。触发：出图、生图、抠图、去背、inpaint、model-matrix。美术规格走 wxgame-art-spec-programmatic，音频走 wxgame-audio-gen。
---

# wxgame AI 生图执行路由（四能力 · 云/本地 · 判据）

本 skill 属 wxgame 家族（管线顺序与冲突裁决见 `my-skills/INDEX.md`）。**它是执行层**：
选型结论的正本永远是 `games/beads/design/ai-workflows/model-matrix.md`，本文件只把
"用哪个模型 + 敲什么命令 + 怎么验收"排好；两者冲突**以矩阵为准**并回头改本文件。

## 0. 开工前置（三件事，缺一走歪）

| 项 | 内容 |
|---|---|
| 真源 | `games/beads/design/ai-workflows/model-matrix.md`（§1 首选、§3 排除、§4 判据、§5 本地能力边界、§6.1 待授权下载） |
| 脚本 | 云 `games/beads/design/ai-workflows/dashscope-generate.py`；本地 `submit-comfyui.py`（服务 `192.168.1.16:8188`，ComfyUI 0.39.0、显存 11.8GB）；局部重绘 `temp/menu-states/inpaint-add.py`；程序化擦除 `remove-box-fill.py`（同目录，见 §3.1） |
| 铁规 | ① 改判门槛＝同一判据 **≥2 个 seed 复测且结论一致**，单 seed 不得翻案；② 本端**无 SSH/无写接口**，要权重只能出清单让用户在服务端下（`/upload/image` 只进 `input/`） |

## 1. 四条能力 → 用哪个模型（top2）

| 能力 | 首选 | 第二（及限制） | 关键参数 | 单价 |
|---|---|---|---|---|
| **① 原型设计**（新页面首稿、版面探索） | 云 **qwen-image-2.1-turbo** | 云 **qwen-image-3.0**（要更贴成品平涂时；RPM 20 需串行） | `--size 1152*2048 --seed`；版面三轮 6/6 全绿 | 0.10 / 0.18 元/张 |
| **② 固定风格二级页**（延续首页身份） | 云 **qwen-image-3.0**（`--ref` 首页基线） | 云 **qwen-image-2.1-turbo**（版面稳、平涂度稍逊） | 平涂度两轮唯一最贴基线（26.66/27.03 vs 27.10），**须配目测** | 同上 |
| **③ 单元素切图** | **本地 qwen-image-2.1 t2i** | 云 **qwen-image-3.0**（要背景最纯时，环 std 0.1–0.3） | `--ratio "1:1 (Square)" --mp 1`，25 步；出图**一律 bbox 自动裁** | 本地 0 元 / 云 0.18 |
| **④ 定稿局部微调**（擦/换，别处不许动） | **本地 qwen-image-2.1 + mask inpaint** | 本地 **SDXL inpaint**（`sdxl-inpaint.api.json`，steps 32；像素锁同样 0，但 mask 内平涂填充不稳、会刷渐变纹理，写中文必乱 → 只在非平涂素材上兜底） | `backend=qwen shape=point feather=0` | 0 元 |

## 2. 命令模板（照抄可用）

**云 · 文生图**（`--ref` 才是图生图；`--seed` 会自动关掉 `prompt_extend`，否则云侧改写你的提示词）

```bash
python3 games/beads/design/ai-workflows/dashscope-generate.py \
  --model qwen-image-2.1-turbo --size 1152*2048 --seed 42 --text "<正向提示词>"
```

**本地 · t2i**（描述体，**不能吃编辑指令**；提交器只认 `--host/--workflow/--prompt/--seed/--ratio/--mp/--out/--image/--override`，**没有 `--local` / `-p` / `--prefix`**——那是云脚本的参数）

```bash
python3 games/beads/design/ai-workflows/submit-comfyui.py \
  --host http://192.168.1.16:8188 \
  --workflow games/beads/design/ai-workflows/workflows/qwen-image-2.1-t2i.api.json \
  --prompt "<描述体提示词>" --ratio "1:1 (Square)" --mp 1 --seed 42 --out <产物目录>
```

**局部重绘**（shape=point 时**坐标换义**：`(x0,y0)`＝元素内一个种子点，`(x1,y1)`＝搜索半径，传 0 → 默认 320；半径只需大到包住元素，**不必贴合**）

```bash
python3 temp/menu-states/inpaint-add.py <tag> <seed_x> <seed_y> <半径> <半径> \
  <prompt-file> 6.0 qwen point 0 1.0
```

脚本尾行自带判据，必须看到 **`硬区外 maxdiff = 0  外溢像素 = 0`**；不等于 0 就是 mask 漏了或羽化没设 0。

⚠ 本仓约定「一次性批跑与判据脚本住 `temp/`、不入库」⇒ 上面这条入口脚本与它的 qwen 后端工作流
（`temp/menu-states/qwen-turbo-inpaint.api.json`）**没有版本兜底**，temp 一清即断；丢了按
矩阵 §6「局部重绘入口」行的节点清单重建（骨架用已入库的 `workflows/sdxl-inpaint.api.json`）。

## 3. 抠图：默认本地代码，**默认不上大模型**

- **平色 UI 走 `shape=point`**（纯 PIL/numpy，零 GPU、零下载、确定性）：种子点
  `ImageDraw.floodfill(thresh=24)` → 品红哨兵 `(255,0,255)` 反解布尔图 → **在二值图上**从四角灌
  `128` 找"灌不到的洞"（自动填文字/图标）→ `MaxFilter(7)`＝半径 3 膨胀吃抗锯齿边。
  实测：轮廓＝手输矩形面积的 **56.8%（CTA 胶囊）/ 38.2%（箭头钮）**，重绘时少刷 43%/62% 无关背景。
- 批量切图走连通域（`cut-sprites-local` / `badge-contour.py`），缩放靠 40px 标准口径。
- **为什么不用模型抠**：① 本地 2.1 输出**确为 RGBA 但 alpha 无语义**（`alpha=0` 占 0.00%、`alpha>128` 占 100%）；② SAM2 auto 在扁平 UI 只出**合并单 mask**、点提示 `coordinates_positive` 不可脚本化；③ 只要让模型重绘边界，它就刷一圈更亮的奶油色（接触阴影外环亮度 **+18.4** vs 程序化叠放 **−10.8**）→ **加法贴章一律不走 AI**。
- **何时才值得上分割模型**：照片级/渐变背景。此时唯一建议下载的权重＝ **SAM3.1 fp16（<2GB）**，用通用 `CheckpointLoaderSimple` 驱动 `SAM3_Detect`（提示词 `button:4` 可出多个**独立** mask）。GroundingDINO / ControlNet / 超分 / Layered 均判为不下（依据矩阵 §6.1）。
- 两个必踩过的坑：`Image.fromarray()` 返回的图 `readonly=1`，`floodfill` 写入**静默落到副本**（必须 `.convert("L")`）；numpy 索引是 `[y, x]` 与 PIL 的 `(x, y)` 相反。

### 3.1 程序化擦除元素（remove-box-fill，零模型）

平涂 UI 背景带上的矩形元素（如橱窗里的木牌）不走 AI inpaint，直接逐行中位数回填：

```bash
python3 games/beads/design/ai-workflows/remove-box-fill.py <in.png> <out.png> \
  --box x0,y0,x1,y1 [--left lx0,lx1] [--right rx0,rx1]
python3 games/beads/design/ai-workflows/remove-box-fill.py --check   # 内置合成自检，改过算法必跑
```

算法：对擦除域逐行取干净采样带（缺省＝缘外 30..200px）的**中位数色**回填（中位数抗采样带内高光/纹理离群；逐行保纵向渐变），alpha 随行复制；背景横向不均（如有斜向玻璃高光）时给 `--right` 走左右缘中位数插值。⚠ **禁用平移贴补**——会把玻璃高光整块复制进擦除区（橱窗 mock 首版实错）。适用前提：牌框先实测（色相剖面 `r−b` 判据）且背后带横向近均匀；背景有结构（非单调带）时不适用，回到 §2 局部重绘。实证：橱窗高清正本去牌（`final/assets/menu/ui_showcase_frame.png`，复现 maxΔ 0）。

## 4. 出图后必跑判据（能排序的只有这些）

| 判据 | 口径 | 用在哪 |
|---|---|---|
| mask 外 maxdiff | 遮罩外逐通道差最大值，**必须 0** | 局部编辑④ |
| 平涂度 | `\|梯度\| ∈ (2,25)` 中调像素占比，对首页基线比贴近度 | 风格延续②；⚠ 过曝图能刷出漂亮假指标，**必须配目测** |
| 背景环 std | 四边 4% 环的中位色标准差 | 资产可切性③ |
| 版面正确率 / 语义正确率 | 全屏 UI・无手机壳・无实物道具 n/n；指定文案逐字对 | 原型①、小字裁定 |

- **禁用 md5 当像素判据**：ComfyUI 把 prompt 元数据写进 PNG，改 `filename_prefix` 必改 md5。要比像素用 `ImageChops.difference().getbbox() is None`。
- **已作废**（换 seed 后排序洗牌，不得用于选型）：像素漂移均值、色板 Lab 距离、bbox 占比/画布利用率。
- 同 seed 重跑只验证**流水线确定性**，测不出抽样运气 → 反漂移复测**必须换 seed**。

## 5. 硬禁忌（均已实测确诊，勿重走）

本地 i2i 做单元素资产（构图污染，bbox 77%）｜本地 i2i 做固定风格（锚不动版式）｜整图 `denoise=0.85` 当局部编辑（只会贴字）｜SDXL 写中文（必乱）｜矩形/椭圆 mask 做贴章（背景被一起重绘出白边接缝）｜**本地 8 步档做 t2i**（欠采样，高光 >250 占比 73–80%；8 步只在有底图约束的 inpaint/i2i 合法）｜小字：整屏多标签一律运行时程序化绘制（2.1 系出伪汉字、3.0 写拉丁、wan 留空），**单元素短文案可烧进图**（本地 25 步 4/4 全对，代价＝改文案要重出）。

## 6. 交付纪律

1. 每轮报数：**本地几张 / 云几张几元**（云最差价已由用户指示封顶 0.25 元/张）。
2. 判据证据**不得只存 `temp/`**（`temp/` 被 gitignore，本仓已因此丢过整个对比图目录）→ 需长期复核的产物落 `production/qa/**` 或至少在文档写死可复现配方（脚本 + workflow + seed + 尺寸参数）。
3. 不擅自 `git commit`；需要新权重先给清单（体积/放置目录/解锁能力/验收命令）让用户拍板。
4. 本地队列是单卡：一轮 20–30 张 ≈ 10–75min，批量迭代走本地，"版面/文案语义必须正确"的定稿张走云。
