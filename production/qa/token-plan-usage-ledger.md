# Token Plan 生图用量台账（建账 2026-11-01）

> **本件只管「花了多少次、出了几张图、留在哪」**，是追加型台账（按时间序加行，⛔ 不回改历史行）。
> 端点/参数/在册模型 → `games/beads/design/ai-workflows/backend-token-plan.md`；
> 选型裁定正本 → `games/beads/design/ai-workflows/model-matrix.md`。
> 建账动机 = 用户 2026-11-01 令「统计 Token Plan 每个生图模型出了多少张图」时发现**用量只散在四份取证件里**，
> 每问一次就要重翻一遍；并要求此后**每轮总结必须报「调用几次 / 出图几张」**。

## 1. 三条口径（先统一，否则数字对不上）

| 口径 | 定义 | 为什么必须分开 |
|---|---|---|
| **调用次数** | 一次 HTTP 请求 = 一次 Credits 扣费（本仓一律 `n=1`，一次一张） | 唯一能对账 Credits 的量 |
| **出图张数** | 成功回图并当场落盘为 PNG 的张数 | 有几次请求成功但产物**被覆盖/未留样** ⇒ 小于调用数 |
| **留档张数** | 现在还能翻出来的原始 PNG（或已入库的 webp）张数 | 判据证据不得只存 `temp/`（`wxgame-image-gen §6.2`） |

⚠ **元/张不适用**：Token Plan 是 **Credits 计量**，本仓读不到 Credits 单价。表里的「按量对照」只是拿同一模型
的按量价算出的**量级参照**，⛔ 不是实际花费。单价正本 = `model-matrix.md §2` 价目表。

## 2. 账目

| 日期 | 批次 / 任务号 | 模型 | 档位 | 调用 | 出图 | 留档 | 备注 |
|---|---|---|---|---|---|---|---|
| 2026-11-07 | 关卡详情弹窗 V1 暖纸平台（风格作废） | `qwen-image-3.0-pro` | 1K | 2 | 2 | **2** | ⚠ **2 次浪费**：prompt 锚定 v1 暖纸扁平，主界面 v1.7 已升档 3D 拟物「拼豆小铺」。版面五要素全绿但风格漂移，判「作废」，仅留档作反例。量 0.18×2=0.36 元量级 |
| 2026-11-07 | 关卡详情弹窗 V2 拼豆小铺（纯文生图，已作废，改用 --ref 锚定） | `qwen-image-3.0-pro` | 1K | 1 | 1 | **1** | ⚠ **1 次浪费**：纯文生图 s42 判全绿，但 §1·② 固定风格二级页 明确「--ref 首页基线」才是正路——i2i 锁风格比 t2i 稳得多。作废，改跑 V3。量 0.18 元量级 |
| 2026-11-07 | 关卡详情弹窗 V3 --ref 锚定（定稿） | `qwen-image-3.0-pro` | 1K | 2 | 2 | **2** | ✅ **零浪费**。两 seed（42/7）一致全绿：i2i + `--ref menu-design-baseline-cat-topbar-final-slotbar-20261102.png` 彻底锁定厚木纹+顶缘高光+底缘深棕阴影+四角铆钉+招牌绳挂+橱窗暖黄灯光+CTA 木棕立体字+星级木牌铆钉+徽章角标 容器语言；中文逐字对（关卡详情/三星 用时≤00:41/两星 用时≤00:50/一星 完成拼图/开始）。铁规① 改判门槛达成（两 seed 结论一致）。量 0.18×2=0.36 元量级 |
| 2026-11-07 | 关卡详情弹窗 V4 用户反馈修改版（定稿） | `qwen-image-3.0-pro` | 1K | 2 | 2 | **2** | ✅ **零浪费**。用户反馈 5 条修改全落实：① 招牌改轻无绳挂→轻量薄木色横条+四角小铆钉；② 加关卡名「曼陀罗·第5关」；③ 图案简化→简单木框无橱窗灯光；④ 星级简化→只放星星无文字；⑤ 去桌布→背景纯深木纹。两 seed（42/7）一致全绿，容器语言完整保留。量 0.18×2=0.36 元量级 |
| 2026-11-07 | 大关内小关选关弹窗 V4 用户反馈修改版（定稿） | `qwen-image-3.0-pro` | 1K | 2 | 2 | **2** | ✅ **零浪费**。与关卡详情同步修改：招牌轻量无绳挂、卡片网格简化无灯光、去桌布。两 seed 一致全绿，三态卡片清晰，容器语言完整。量 0.18×2=0.36 元量级 |
| 2026-11-07 | 通用对话框壳 Dialog Shell V1 | `qwen-image-3.0-pro` | 1K | 2 | 2 | **2** | ✅ **零浪费**。`--ref` 主界面原型锁风格，三通用槽位全绿：① 面板背景（厚木纹+顶缘高光+底缘深棕阴影+四角铆钉，纯深木纹背景无桌布）；② 标题槽（轻量薄木色横条无绳挂+小铆钉+米白立体字，文字可替换）+ 可选次级标题（深藏青小字）；③ 底部按钮槽（面板底部固定位置+木棕胶囊+顶缘高光+底缘阴影+米白立体字+铆钉，按钮数量/文字可换）；内容区纯开放插槽（极浅边界），放任何内容都能套。两 seed（42/7）一致全绿，铁规① 达成。量 0.18×2=0.36 元量级 |
| 2026-11-07 | Dialog Shell 套关卡详情 | `qwen-image-3.0-pro` | 1K | 2 | 2 | **2** | ✅ **零浪费**。Dialog Shell V1 三槽位严格复用（面板背景/标题槽/按钮槽样式与选关弹窗完全一致），内容区填关卡详情：像素预览木框 + 三条只放星星（无文字）+ 三徽章。两 seed（42/7）一致全绿，中文逐字对（关卡详情/曼陀罗·第5关/开始）。量 0.18×2=0.36 元量级 |
| 2026-11-07 | Dialog Shell 套大关内小关选关 | `qwen-image-3.0-pro` | 1K | 2 | 2 | **2** | ✅ **零浪费**。Dialog Shell V1 三槽位严格复用（与关卡详情弹窗样式完全一致），内容区填选关：九格进度条 + 三行三列木板卡 + 三徽章 + 三态（已通关/当前/未解锁）清晰。两 seed 一致全绿，中文逐字对（曼陀罗 选关/返回）。量 0.18×2=0.36 元量级 |
| 2026-11-07 | Dialog Shell V2 轻量壳 + 9sprites + 按钮双模式 + 自适应高度 | `qwen-image-3.0-pro` | 1K | 4 | 4 | **4** | ✅ **零浪费**。V2 核心变化全落实：① 壳轻量化（浅暖米纸色+极细深棕描边+极浅外投影+无厚木纹+无铆钉）；② 标题槽轻量化（薄木色横条+细描边+中等深棕字+无厚牌匾+无铆钉）；③ 按钮槽双模式（A 单按钮居中/B 双按钮左右并排）；④ 面板高度自适应（关卡详情矮/选关高，肉眼可见）；⑤ 9sprites 九宫格（四角圆角固定+边缘薄+中心浅米纸色+自适应高度不变形）。套关卡详情（s42/s7）+ 套选关（s42/s7）各 2 seed，两 seed 一致全绿。量 0.18×4=0.72 元量级 |
| 2026-11-07 | Dialog Shell V2.5b 去「拼豆小铺」污染 | `qwen-image-3.0-pro` | 1K | 8 | 8 | **8** | ✅ 修 prompt 硬约束：绝对禁止「拼豆小铺」四字、禁止绳挂、禁止彩色拼豆点缀。关卡详情（s42/s7）+ 选关（s42/s7）各 2 seed，两 seed 一致全绿。容器语言回归 V1：厚木纹3D拟物+顶缘高光+底缘深棕阴影线+四角金属铆钉+米白立体浮雕字+厚木棕胶囊按钮。量 0.18×8=1.44 元量级 |
| 2026-11-07 | Dialog Shell V2.5c 修内容细节 + V2.5d 修三星行 | `qwen-image-3.0-pro` | 1K | 6 | 6 | **6** | ✅ V2.5c 修 3 个系统 bug：① 关卡详情预览卡去橱窗灯光；② 选关九格卡片加三态区分（前4不同图+金星/第5厚框+空星/后4灰+锁）；③ 选关加进度条。选关两 seed 全绿完美定稿。V2.5d 修关卡详情三星行（从3×5=15颗改成正确的3/2/1颗三条横向），两 seed 全绿。最终两个弹窗全部完美定稿。量 0.18×6=1.08 元量级 |
| 2026-11-07 | Dialog Shell V2.5e 修标题槽宽度（从铺满横条→居中独立木牌匾） | `qwen-image-3.0-pro` | 1K | 4 | 4 | **4** | ✅ 标题槽宽度修复成功：从铺满面板宽度(100%)的横条→居中独立木牌匾(约65%宽+左右明显留白)，跟主界面招牌容器语言对齐。但出现内容细节瑕疵（s42 预览卡图案被小猫咪污染、三星行丢失第三条；选关九格卡片三态混乱），s7 相对好很多（曼陀罗回归、三态大体对）。量 0.18×4=0.72 元量级 |
| 2026-11-07 | Dialog Shell V2.5f 标题槽砍半（50%） + 内容全修 | `qwen-image-3.0-pro` | 1K | 6 | 6 | **2** | ⚠️ **4 次浪费**：前 4 次用弹窗 V2.5e 当 --ref → 模型被大标题锚住，**完全不听**「35% 宽度/50% 大小/small tag label」等任何缩小指令，标题始终铺满。关键转折：换用主界面 baseline 当 --ref → 模型从 baseline 小招牌"学到"标题应该窄，两个 s7 全部完美。最终版：标题槽 ~60% 宽居中独立木牌匾（跟 baseline 招牌同比例），关卡详情曼陀罗+3/2/1 三星+三徽章全对，选关前 4 格不同图案（猫/花/蝴蝶/鱼）+ 进度条九星位 + 三态清晰。**重要发现**：弹窗迭代不能用弹窗自己当 ref，会陷入"大标题锚定"正反馈循环。量 0.18×6=1.08 元量级 |
| 2026-11-08 | 木牌背板纹理 · wan2.7 bbox 两 seed（plaque-src-v3 参考） | `wan2.7-image` | 1K | 2 | 2 | **2** | `--bbox 198,226,576,330`。框外漂移 maxΔ≈196 ⇒ 必须 paste-back；seed 7 经 tone 修正为采用版（`out/comp-tone06-s7.png`），seed 42 留样未采用。零浪费。留档 → `plaque-texture-20261108/raw/` |
| 2026-11-08 | 木牌背板纹理 · wan2.7 原图直擦（测试） | `wan2.7-image` | 1K | 1 | 1 | **1** | 带字原图 + `--bbox`：字影残留成幽灵凸起、整体偏暗需 −8 色调 ⇒ **判负弃件**（非调用失败，不计浪费）。留档 → `raw/wan-orig-s7.png` |
| 2026-11-08 | 木牌背板纹理 · qwen-3.0-pro 去字（1536×456 crop，i2i） | `qwen-image-3.0-pro` | 1K | 2 | 2 | **2** | 去字 ✅；qwen 无 mask、bbox 不生效（`bbox_guard` 拦截）；输出上移 ≈4 px 需 DY 对齐。seed 7 为 AI 高频来源（定稿 `out/ai-grain-plate4.png`，已上 Figma `92:37`/`97:36`），seed 42 留样。零浪费。留档 → `raw/q3pro-s7.png` · `raw/q3pro-s42.png` |
| 2026-11-08 | 开始按钮去除 · wan2.7 bbox 擦除（seed 7） | `wan2.7-image` | 1K | 1 | 1 | **1** | `--bbox 208,1022,544,1184`。按钮外形残留为幽灵凸起（wan 对原形有锚定）⇒ **判负弃件**，改走确定性去除。留档 → `btn/`（temp，待入库） |
| 2026-11-08 | 开始按钮去除 · qwen-3.0-pro 去按钮（1536×816 crop，seed 7） | `qwen-image-3.0-pro` | 1K | 1 | 1 | **1** | 只去了文字，**保留了按钮外形**（参考图里有按钮 ⇒ 模型照着画回）⇒ **判负弃件**。改用平底参考（见下一行）。 |
| 2026-11-08 | 开始按钮去除 · qwen-3.0-pro 补木纹（平底参考，seed 7） | `qwen-image-3.0-pro` | 1K | 1 | 1 | **1** | 参考图改为已去按钮的平底板（无可锚定的形状）⇒ 整块补出自然厚木纹、无按钮。HF 叠到确定性平底上（K=1.3，粗纹 σ 4/12，渐隐 10 px）。**采用** → 背景 `bg-no-button.png` 已替换 Figma `92:37`/`97:36` |
| 2026-11-08 | 开始按钮样式 · qwen-3.0-pro 左右双按钮（1536×512，seed 7） | `qwen-image-3.0-pro` | 1K | 1 | 1 | **1** | i2i 以原按钮裁图为风格参考，要求两个空白同风格按钮、纯绿底（#00FF00）、无文字。**采用**：绿度键出 RGBA（左 705×320 / 右 700×319），已上 Figma `117:36`/`117:37`。文字之后用文字图层叠加 |
| 2026-10-31 | 接入探针（`backend-token-plan.md` 建件，未单领号） | `qwen-image-3.0-pro` | 1K | 2 | 2 | **0** | t2i 512²（23.9s）+ 编辑腿 752×1344（10.8s），只为验端点，产物未留样 |
| 2026-11-01 | WXG-T-527 局部修改 + 抠图 | `qwen-image-3.0-pro` | 1K | 4 | 4 | **3** | 第 4 次是 `mask_image_url` 参数探针（验「吃不吃 mask」），回图未作样本留档；留存 A1/A2/B1 |
| 2026-11-01 | WXG-T-528 ① 原型 / ② 固定风格对照 | `qwen-image-3.0-pro` | 1K | 5 | 5 | **4** | ⚠ **1 次浪费**：输出 slug 猜错（实为 `qwen_image_30_pro.png`）致 s42 被 s7 覆盖后重跑 |
| 2026-11-01 | WXG-T-529 wan2.7 探针包 | `wan2.7-image` | 1K | 4 | 4 | **4** | 招牌「拼豆小铺」×2 seed + CTA「开始游戏」+ `--bbox` 框选编辑；零浪费（每发后立即 `mv`） |
| 2026-11-01 | WXG-T-530 续测 ①② | `wan2.7-image` | 1K | 4 | 4 | **4** | 商店页 ×2（纯文生图）+ 设置页 ×2（`--ref` 首页）；零浪费 |
| 2026-11-01 | WXG-T-532 透明通道终判 | `wan2.7-image-pro` | 1K | 2 | 2 | **2** | seed 7 / 42 各一发，判据 = alpha 分布；**判负**（`alpha=0` 占 0.00%），原图只在 `temp/pro-wan27-alpha/` |
| 2026-11-01 | WXG-T-532 `color_palette` 风格锁定 | `wan2.7-image` | 1K | 7 | 6 | **6** | 两 seed × 三条件（无 palette / 中位切分棕板 / `palette.ts` token 板）。⚠ **1 次浪费**：`--palette` 参数形状猜错 → 400（服务端要 `{"hex":…,"ratio":"20.00%"}`）。读数 → `wan27-token-plan-20261101.md` §9 |
| 2026-11-01 | WXG-T-532 6 色板批次稿 | `wan2.7-image` | 1K | 4 | 4 | **4** | 主菜单 + 设置页 × 两 seed，零浪费；跨页面 ΔE ≤ 3.5 → 同文件 §10 |
| 2026-11-08 | 道具图标 · 三件 qwen 重生（设计系统 §1.4 程序化图标被否决后）· 魔法棒 / 扫帚 / 磁铁各 1 次，seed 42 | `qwen-image-3.0-pro` | 1K（1024×1024） | 3 | 3 | **3** | 零浪费。三张均白底 3D 拟物（留档 `temp/fullstar-gacha/powerup/item_*-qwen3pro-s42.png`，未入库，待用户逐件确认后再入 `design/art/proposals/` 并补 `generation-record.txt`）。提示词正本 `temp/fullstar-gacha/powerup/prompts.txt`。量 0.18×3=0.54 元量级 |
| 2026-11-08 | 道具图标 · 魔法棒二次重生（seed 7，提示词不变） | `qwen-image-3.0-pro` | 1K（1024×1024） | 1 | 1 | **1** | 零浪费。留档 `temp/fullstar-gacha/powerup/item_area_clear-qwen3pro-s7.png`，未入库；用户对 s42 版判不通过。量 0.18 元量级 |
| 2026-11-08 | 道具图标 · 按 GDD v1.95 命名补画两件（熨贴片=熨斗 / 抖豆筛=筛子），seed 42 | `qwen-image-3.0-pro` | 1K（1024×1024） | 2 | 2 | **2** | 零浪费。留档 `temp/fullstar-gacha/powerup/item_window_restore-qwen3pro-s42.png` · `item_random_restore-qwen3pro-s42.png`，未入库。量 0.18×2=0.36 元量级 |
| 2026-11-09 | 选关页面设计稿（木牌版）· wan 两 seed + qwen i2i 两 seed | `wan2.7-image` / `qwen-image-3.0-pro` | 1K（752×1344） | 4 | 4 | **4** | 零浪费。wan s7（纯 t2i）构图不合格（顶栏 + 下方留白）；wan s42（补硬约束）构图修复但 ✕ 浮于牌外、九卡三态不分；qwen s42/s7 以 `compare-A.png` 草图 i2i，**版面还原两 seed 一致**（全要素对位），遗留三态未分 / s7 出现重复 ✕。留档与配方 → `games/beads/design/art/proposals/level-select-redesign-20261109/`（`generation-record.txt` + `prompt-A.txt` / `prompt-A2.txt`）。量 0.18×4=0.72 元量级 |
| 2026-11-09 | 选关九宫格样式重生成（局部编辑）· qwen i2i 两 seed | `qwen-image-3.0-pro` | 1K（752×1344） | 2 | 2 | **2** | 零浪费。以落码帧 `preview-implemented.png` 为 `--ref`，指令只改九宫格区（木托盘凹槽 / 星带 / 锁 / 当前关黄铜描边），其余不动；两 seed 样式一致（s42 九格、s7 误出 12 格但材质同）。落码采用「木托盘凹槽」层序。留档 → `level-select-redesign-20261109/grid-qwen-s42.png` · `grid-qwen-s7.png`（`prompt-grid.txt`）。量 0.18×2=0.36 元量级 |
| 2026-11-09 | 选关九宫格四通道重生成 · qwen i2i 两 seed | `qwen-image-3.0-pro` | 1K（752×1344） | 2 | 2 | **2** | 零浪费。以 `preview-grid-implemented.png` 为 `--ref`，指令只改底托+九宫格，要求逐格四通道（豆面/星级/开启/当前推关）；两 seed 一致：锁格带 `☆☆☆` 灰星、当前关黄铜描边 + 光晕。落码 `drawWoodWallCell` 补锁格星带与当前关外发光。留档 → `states-qwen-s42.png` · `states-qwen-s7.png`（`prompt-grid-states.txt`）。量 0.18×2=0.36 元量级 |
| — | 在册未跑 | `wan2.7-image-pro` | — | **0** | 0 | 0 | 剩余未取证：4K / 组图 / `thinking_mode`（`color_palette` 已在 `-image` 上取证） |

### 累计（截至 2026-11-01）

| 模型 | 调用 | 出图 | 留档 | 按量对照 |
|---|---|---|---|---|
| `qwen-image-3.0-pro` | **11** | 11 | **7** | 11 × 0.25 = **≈2.75 元量级**（1K 档价；2K 档另按 0.50） |
| `wan2.7-image` | **19** | 18 | **18** | 19 × 0.20 = **≈3.80 元量级** |
| `wan2.7-image-pro` | 2 | 2 | 2 | 2 × 0.50 = **≈1.00 元量级**（pro 价；本仓已按 0.25 封顶排除，仅量级参照） |
| **合计** | **32** | **31** | **27** | **≈7.55 元量级**（非实际花费） |

**Token Plan 通道只有这三 + 一个 `wan2.7-image-pro` 是生图模型**；矩阵 §1 的在册首选 `qwen-image-3.0`（非 pro）
与 `qwen-image-2.1-turbo` **不在订阅白名单上**，它们的对照图全走按量付费通道，⛔ 不计入本账。

## 3. 一处更正（建账时确诊，此前口径有误）

`qwen-image-3.0-pro` 的按量对照价应为 **0.25 元/张（1K 档）**，此前口头报数时误取了 `wan2.7-image-pro` 的
0.50 元/张（矩阵 §2 第 47 行为准，本仓实测全部落在 `qima_output_1k` 档）。⇒ pro 侧对照量级由「≈5.50 元」
更正为 **≈2.75 元**。教训：对照价要**按模型逐行取**，⛔ 不按「都是 pro」套用。

## 4. 追加规则（谁跑谁记，一轮一行）

1. 每批云图跑完，在本表**追加一行**（同批次多模型则多行），字段照表头，⛔ 不合并不同模型的行。
2. 浪费必须写明原因（覆盖 / 试错 / 参数报错），单独计一次调用，**不留档**。
3. 会话或提交总结的报数格式固定为：**「本地 N 张 / 云 M 次调用、出图 K 张（其中浪费 W 次），台账已追加」**；
   Token Plan 与按量两通道**分开报**，不混加。
4. 原始 PNG 若只在 `temp/`（被 gitignore、无版本兜底），备注里写清；判据证据需长期复核的按 `wxgame-image-gen §6.2`
   转 webp 入 `production/qa/<同名目录>/`（⚠ 有损，⛔ 不得拿它复算像素判据）。
5. **决策模型（`decision-model-preview`）调用也要在会话总结报数**（用户 2026-11-12 令）：报
   「调用 N 次 / 成功 N / 服务端 ms 区间 / `input_tokens` 区间 / 计费口径」。它**不产图** ⇒
   ⛔ 不进 §2 图像账目表，在总结里单列一行；`--check` 为离线自检，不计调用。

## 5. 复算方法（想自己核一遍时）

```bash
grep -rn "本地 .* 张 / 云\|Token Plan Credits" production/qa/pro30-edit-cut-20261101.md \
  production/qa/pro30-proto-bench-20261101.md production/qa/wan27-token-plan-20261101.md
ls temp/wan27-probe-20261101 temp/wan27-full-20261101 \
   temp/pro30-verify-20261101 temp/pro30-bench-20261101   # 原始 PNG 留存现状
```
⚠ 单次会话的用量探针（`GET {BASE}/models`、领域模型、TTS）**不产生图像**，不进本账；按量通道与 Coding Plan 亦另账。

## 6. temp 生图存量（2026-11-01 清理一次，用户令「把 temp 里的生图都清理掉」）

| 项 | 读数 |
|---|---|
| 清理前 | **3642 张 / temp 共 2.3 GB** |
| 已删 | **3443 张**（约 1.62 GB）——均为无文档引用的一次性试验图；清单逐路径留存 `temp/clean-20261101-del-list.txt` |
| 保留 | **94 张**：① 本周判据原始 PNG **45 张**（`temp/wan27-probe-20261101` 7 + `wan27-full-20261101` 18 + `pro30-verify-20261101` 8 + `pro30-bench-20261101` 12，共 71MB，⚠ 仍在 temp **无版本兜底**）；② 在册文档点名引用的历史证据图 47 张；③ **尚未入库的阶段性正本 2 张**（`temp/plate-cut-20261031/master-single-bg.png`、`hero2x-e1.png`） |
| 未误删 | 浏览器 profile 缓存 105 项**已从清单剔回**（不是生图）；两个在册入口脚本（`temp/menu-states/inpaint-add.py`、`temp/plate-cut-20261031/cloudpaste.py`）**均纯参数化**，不硬编码输入图 ⇒ 删图不影响复用 |

三条后果（不可逆，后人找图时先看这里）：

1. **矩阵与 skill 里所有像素读数目前仍可复算**，因为靠的就是上面那 45 张原始 PNG（入库的 webp 有损，⛔ 不能拿来算 maxdiff）。⇒ 本批木牌/箭头接线收口前不要清这四个目录；收口后一并删除并在此追加一行。
2. temp 一次性脚本里共 150 条写死的图路径，其中 **148 条已不在磁盘** ⇒ 重跑旧脚本必须换新输入图（它们不自动失败，只是需重指）。
3. **代码侧证据链未受影响**（删后复查）：`games/` `packages/` `dev/` `tools/` 源码注释共引用 temp 路径 15 条，其中**图片类断链 0 条**（本次只删图，剩下 4 条断的是 `.txt`/`.mjs` 类引用，早于本次已不在磁盘）；三门全绿且无一个构建/测试产物读 temp 图。

**追加（2026-11-01 WXG-T-532 · 透明通道终判）**：补上 `wan2.7-image-pro` 那一格在册标「未测」的读数。Token Plan 通道 **2 次调用**（`--size 1024*1024`，seed 7 / 42 各一发，36.7 s / 20.3 s，套餐内零额外花费），出图 2 张落 `temp/pro-wan27-alpha/{s7,s42}.png`。判据 = alpha 分布：**`mode=RGBA` 但 `alpha=0` 占 0.00%、`alpha` min 254、连通域 1（整幅）**；所谓「透明背景」被画成灰白底，且底色跨 seed 不稳（左上 16×16 均值 211 ↔ 245）。⇒ **判负**，云生成线四模型（`qwen-image-3.0` / `-3.0-pro` / `wan2.7-image` / `-pro`）**无一能输出真透明**，与 `qwen-image-2.1-pro` 35 次「透明只能继承不能生成」同律。本批零新增资产，仅作方向关闭；⛔ 清 `temp/pro-wan27-alpha/` 前先看这一条。

**追加（2026-11-01 WXG-T-531）**：上面 ③ 那两张「尚未入库正本」（`master-single-bg.png`、`hero2x-e1.png`）**已转正入库** → `games/beads/design/art/proposals/menu-3d-style-20261030/plate-cut-20261031/`（连同编辑指令正本 `p-master-single.txt` 与抠件源稿 `menu-design-master-20261031.png`）；6 个生成脚本同期由 temp 转正入 `ai-workflows/`。① 那 **45 张判据原 PNG 仍在 temp**（本批零花费、零出图，未动）。⇒ 本次清理暴露的口径已立为硬纪律：**归档件的原图与产出脚本须与图同批入库**，统一登记面 = `production/qa/asset-provenance.md`。

**追加（2026-11-01 WXG-T-532 · `color_palette` 风格锁定实测）**：Token Plan 通道 **7 次调用**（`wan2.7-image`，`--size 752*1344`，seed 7 / 42 × 三条件：无 palette / 中位切分棕板 / `palette.ts` token 板），**6 出图 + 1 次 400 浪费**（参数形状：服务端要 `{"hex":…,"ratio":"20.00%"}` 字符串带百分号，写成 `color` + 数字即报错），单发 15.5–16.4 s，套餐内零额外花费。结论：跨 seed 整幅平均色 ΔE **10.6 → 0.6 / 1.1** ⇒ **色彩一致性可交给 `color_palette`**（详情与五条边界 → `wan27-token-plan-20261101.md` §9）。本批零新增资产，仅作能力开关登记；⛔ 清 `temp/palette-lock-20261101/` 前先看本条与下一条（同目录还续跑了第四批）。

**追加（2026-11-01 WXG-T-532 · 6 色板批次稿）**：接上条的配方跑第四批，Token Plan **4 次调用、出图 4 张、零浪费**（`wan2.7-image`，`--size 752*1344`，主菜单 + 设置页 × seed 7 / 42，单发 14.5–17.5 s）。主判据 = 跨页面 × 跨 seed 两两 ΔE **≤ 3.5**（对照无 palette 同页面跨 seed 就得 10.6）⇒ **「同色温 + 不同版面」批量出稿成立**；同时确诊一条新边界：**`color_palette` 不排他**（色板剔掉蓝紫仍出现深蓝窄边 / 绿色开关）⇒ ⛔ 当禁色闸门。详情 → `wan27-token-plan-20261101.md` §10。`temp/palette-lock-20261101/` 现含 **10 张判据原图** + `run.sh` / `run-batch.sh` / `palette-design6.json` / 两份提示词正本（**均无版本兜底**，配方已写进 §10）；⛔ 清理前先看这两条。

**追加（2026-11-02 WXG-T-564 · 三态章 v2 i2i 重绘）**：Token Plan **5 次调用、出图 4 张、浪费 1 次**——首次把 128² 原图直传 `--ref` 被 `HTTP 400 Error validating image` 拒（**底图须先放大到长边 ≥1024 再传**）。`wan2.7-image` i2i，`--size 1024*1024 / 768*1024`，单发 5.6–6.4 s。留档 3 张（`lock-s11` / `hourglass-s33` / `seal-s11`），弃 2 张（s11 沙色薄荷绿+粉、s22 骨架光滑塑料感）。判据：木刻语言统一（深棕 `#5A2606` + 奶油 `#F1E0C0` 描边）+ 中文「通关」逐字正确 1/1。产物与配方 → `design/art/proposals/menu-3d-style-20261030/badge-v2-20261102/`（`generation-record.txt`）。本批**不入 final/cocos**（T-522 单一作品腿不画这三件 + 主包余量 29.6 KB）。

**追加（2026-11-05 WXG-T-584 ③a · 顶板 logo 改名重出）**：Token Plan **3 次调用 / 出图 3 张 / 浪费 0 次**（`wan2.7-image` i2i + `bbox_list`，`--size '960*772'`，单发 7.3–8.1 s；s4201 属**判负弃件**——框上沿切进旧字顶行，不是调用失败）。套餐内零额外花费。本地 0 张。合成与量化全零模型（`logo-rename-compose.py` 确定性 paste + 现役 octree）。产物与配方 → `design/art/proposals/logo-rename-20261105/generation-record.txt`；逐件来源账 → `asset-provenance.md §10`。新边界一条：**bbox 上沿必须实测旧字顶行**（本件旧字与蝴蝶结底沿重叠 ⇒ 需额外一段「蝴蝶结矩形从原图取回」的 paste）。

**追加（2026-11-10 · 选关弹窗「九宫格背板」补上下边框 + 四角圆角）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` i2i，`--size '1012*1194'`，seed 42 / 7，单发 11.5–11.8 s）。底图**不是模型产物**：Figma 节点 `164:63` 导出件先经零模型脚本 `make-grid-backplate.py` 程序化补齐四边金线与 24dp 圆角（SDF 法，内部区 maxdiff=0），再交模型只做材质统一。判据：四边金线峰值坐标漂移 ≤3px @2x（基准 L11/R1000/T11/B1182）；模型线输出恒为 RGB，四角 alpha 由基准 alpha 回切。留档 `temp/levelselect-9slice/out/tp-qwen3pro-{s42,s7}-rgba.png`；提示词正本 `temp/levelselect-9slice/prompt-tokenplan.txt`。

**追加（2026-11-16 · 小游戏新头像 144²）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42 / 7，单发 8.9–9.0 s）。采用 seed 7（珠面颗粒明确、缩略可读）；seed 42 留样反例（表面过平滑、拼豆辨识弱）。产物 → `design/art/proposals/avatar-20261116/`；最终 → `design/art/final/assets/avatar/beads-avatar-144.png`（144² RGB PNG，23,915 B）。

**追加（2026-11-16 · 换皮肤头像 144²）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` i2i，`--ref` 原头像 seed 7，`--size '1024*1024'`，seed 42 / 7，单发 10.2–11.1 s）。采用 seed 42（双皮肤分区清晰、换色箭头不抢主体）；seed 7 留样反例（整环箭头 + 纸纹在 144 下过密）。最终 → `design/art/final/assets/avatar/beads-avatar-skin-144.png`（144² RGB PNG，21,716 B）。

**追加（2026-11-16 · 拼豆豆人品牌头像 144²）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42 / 7，单发 8.0–8.4 s）。采用 seed 42（豆形角色 + 拼豆板 + 左暖右冷双皮肤 + 开口细箭头；144 缩略清楚）；seed 7 留样反例（整环三箭头 + 身形偏窄，144 下过密）。最终 → `design/art/final/assets/avatar/beads-avatar-144.png`（144² RGB PNG，27,231 B）。

> **2026-11-16 头像口径修正**：前两批「花」头像已按用户裁定退场（花只是某一关 Boss 图案，不适合品牌头像），文件移入各自 `proposals/<batch>/rejected/`；采用件改为第三批「拼豆豆人」。上文旧路径仅作调用留痕，不再指向现役 final。

**追加（2026-11-16 · 头像三方向探索）**：Token Plan **3 次调用 / 出图 3 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42，单发 8.3–8.9 s）。D1 双豆人并排 / D2 拼豆衣架 / D3 拼豆板半成品；均未替换 final，候选留档 → `design/art/proposals/avatar-directions-20261116/`（raw 1024² + preview 144²）。

**追加（2026-11-16 · 豆面风格头像探索）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42，单发 8.0–9.2 s）。A 2×2 大颗豆面特写 / B 3×3 豆面网格；均未替换 final，候选留档 → `design/art/proposals/avatar-bead-surface-20261116/`（raw 1024² + preview 144²）。A 的哑光 / 亮面 / 金属 / 闪粉四种豆面在 144 下区分清楚，推荐；B 的豆簇外形像花，不建议。

> **2026-11-16 再次修正**：用户要求不要小人物/衣服，豆形角色头像退场（移入 `proposals/avatar-skin-v2-20261116/rejected/`）；采用件改为 A（2×2 豆面特写），final = `design/art/final/assets/avatar/beads-avatar-144.png`（144² RGB PNG，34,314 B）。

**追加（2026-11-16 · 真实豆形头像）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42 / 7，单发 8.7–8.9 s）。真实拼豆短圆柱平顶 + 薄壁中心孔 + 四种豆面（哑光 / 亮面 / 金属 / 闪粉）；采用 seed 42，final 更新为 34,035 B；seed 7 留样备选。上一版圆环/圆润豆形移入 `proposals/avatar-bead-surface-20261116/rejected/`。

**追加（2026-11-16 · 豆面图案背景头像）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42 / 7，单发 8.4–8.5 s）。背景暖白拼豆田 + 珊瑚斜纹；前景四颗平顶短圆柱（哑光青 / 亮面紫 / 金属金 / 透明闪粉）。采用 seed 42，final 更新为 37,924 B；seed 7 留样备选；球体前景版（`avatar-bead-pattern-20261116`）不采用，留作反例。

**追加（2026-11-16 · 5×5 豆面网格背景头像）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42 / 7，单发 8.2–9.6 s）。背景严格 5×5 大豆网格 + 对角珊瑚线，孔位更明显；前景四颗平顶短圆柱。采用 seed 42，final 更新为 36,141 B；seed 7 留样备选；密集豆田背景版移入 rejected。

**追加（2026-11-16 · 心形豆面背景头像）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42 / 7，单发 8.5–8.9 s）。背景小豆网格（提示词 9×9，实际约 10×10）+ 珊瑚心形；前景四颗平顶短圆柱。采用 seed 7，final 更新为 36,352 B；seed 42 留样备选；5×5 大豆网格版移入 rejected。

**追加（2026-11-16 · 黄色五角星背景头像）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42 / 7）。背景小豆网格 + 黄色五角星，前景三颗平顶短圆柱（珊瑚哑光 / 青绿亮面 / 薰衣草珠光闪粉），配色按用户令改为扁平插画、不写实。采用 seed 42，final 更新为 34,767 B（md5 `fc76336962fee4203082d088b36b1dc8`）；seed 7 留样备选（33,583 B）；心形版移入 `proposals/avatar-bead-heart-20261116/rejected/`。**今日累计 23 次调用**（11 批）。

**追加（2026-11-16 · 豆形三色背景头像）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42 / 7，单发 8.6 s ×2）。背景改为豆形（圆豆 + 中心孔）小豆图案，珊瑚粉 / 青绿 / 暖黄三色分区；前景三颗豆改用游戏风格池三套豆面（四棱刻面 / 18 线稿描边 / 13 双色对角，真源 `config/bead-styles/registry.ts`）。采用 seed 7，final 更新为 37,950 B（md5 `6cbb3319a15e20a4b112085c39a8229c`）；seed 42 留样备选（39,695 B）；五角星版移入 `proposals/avatar-bead-star-20261116/rejected/`。**今日累计 25 次调用**（12 批）。

**追加（2026-11-16 · 腰形豆三色背景头像）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '1024*1024'`，seed 42 / 7，单发 8.4–8.5 s）。背景改为**真实腰形豆轮廓（无中心孔）**+ 珊瑚粉 / 青绿 / 暖黄三色；前景三颗按游戏俯视豆片口径（圆角方片 + 四向刻面 + 中心孔 + 深棕细缝，非 3D 圆柱），豆面 = 四棱刻面 / 18 线稿描边 / 13 双色对角。采用 seed 42，final 更新为 35,739 B（md5 `d0fc5791c5070b9f72d863befcabbc33`）；seed 7 留样备选（35,332 B）；带孔圆豆形版移入 `proposals/avatar-bead-bean-20261116/rejected/`。**今日累计 27 次调用**（13 批）。

**口径修正（同日，用户选定）**：用户从两张预览中选定 **seed 7** ⇒ final 改为 35,332 B（md5 `02e01b11f08acf417187a5ea5eea7009`）；seed 42 移入 `proposals/avatar-bead-kidney-20261116/rejected/beads-avatar-144-kidney-s42.png`。调用数不变（仍 2 次 / 2 张 / 零浪费）。

**零模型后处理（同日 · 去外框）**：用户令「把周围边框去掉」⇒ 对 seed 7 母版内裁 (36,36,987,987) → 951² → 144²，**0 次调用**；final 36,518 B（md5 `49e2582b3ffaf4deba8d324cd01b3466`），带框版移入 `rejected/beads-avatar-144-kidney-s7-bordered.png`。今日累计仍 **27 次调用**（13 批）。

**追加（2026-11-17 · 20 大关生图第 0 张探路）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '2048*2048'`，seed 42、`prompt_extend=False`，单发 16.0 s）。**不占 180 张名额**，中性几何测试体，仅验通道四事。读数：`usage.output_width/height=2048/2048`、`output_image_type=**qima_output_2k**`、`input_image_type=qima_input_2k` ⇒ 2K 档确实存在并已计费（历史 1K 档为 `qima_output_1k`）。**0 次调用**的本地后处理：floodfill 抠 alpha（阈值 72 = 24×3），六道验收全绿（四角全透明 / 主体单连通 / 主体内近黑残留 0 px / RGB 零重绘 / 二值硬边 alpha / 四边留白 15.6–18.8%）。实测发现背景非精确 `#000000`（精确纯黑仅 21.04%，0–24 近黑占 58.85%，四角 max=3、环带 mean≈0.2），故验收判据须按「近黑」而非「精确纯黑」。产物与生成史：`games/beads/design/art/proposals/levels-20arcs-selection-20261117/probe-2048/`（含 `generation-record.txt` / `extract-alpha.py` / `response-meta.json` / 原图 / RGBA 图 / metrics）。⛔ 未入 `final/`、未入库关卡、未提交 git。

**追加（2026-11-17 · 20 大关 A01-P01 雏菊 2048² 正式母版第 1 张）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i，`--size '2048*2048'`，seed 42、`prompt_extend=False`，单发 16.4 s）。读数：`usage.output_width/height=2048/2048`、`output_image_type=**qima_output_2k**`、`input_image_type=qima_input_2k` ⇒ 2K 档计费。**0 次调用**的本地后处理：`probe-2048/extract-alpha.py` floodfill 抠 alpha（阈值 72）+ 六道验收 + studio `mis=full` 本地量化（`draft=1`，`importable=true`、`voidCells=0`、用色恰为 A01 四色）。产物 `games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P01-daisy/`，**不入 `final/`**（§5 效果确认未完成）。⚠️ 效果偏差：主体高 87.9% / 宽 58% 超 G9 的 70–82%；`colorError.final=59.8`；单连通严格判 false 仅因 2 个 1×1 孤立像素。**是否重生待用户裁定**：若重生，本行「浪费 0 次」须追加订正为 1 次。


**追加（2026-11-18 · A01-P01 豆面效果 2 张 · 收口补登）**：Token Plan **0 次调用 / 出图 0 张 / 浪费 0 次**。
`a01p01-beads-studio.png`（68,084 B）与 `a01p01-beads-plain.png`（98,542 B）由
`apps/beads-studio/public/board-render.js` 的 `drawBoard` 在浏览器 canvas 本地确定性渲染，
非模型产物、不占 180 张名额、不追加累计调用数。方法与参数见
`games/beads/design/art/proposals/levels-20arcs-selection-20261117/A01-P01-daisy/generation-record.txt`
「补收 2026-11-18」段。⚠️ 效果确认未完成（用户令「豆面效果 ok 才算认可」），
未入关、未进 `final/`；重渲染产物与已存文件逐字节一致，sha256 前缀 `d889e880afc76210` / `d2c88780c2d2a242`。

**追加（2026-11-18 · A01-P01 雏菊 v2–v5 重生＋锁定）**：Token Plan **4 次调用 / 出图 4 张 / 浪费 3 次**（v2/v3/v4 各 1 次浪费、v5 留档；`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 16.2–17.2 s，`qima_output_2k`）。**订正**：上一行（2026-11-17 正式母版第 1 张）「浪费 0 次」订正为 **1 次浪费**（v1 不采用、用户裁定重生）。本张累计 **5 次调用 / 5 张 / 4 浪费 / 1 留档**。v5 效果确认 **PASS**（用户 2026-11-18 裁定锁定，名额 1/180 效果确认完成）；系列量化口径裁定 **mis=max**（色号零改动）。0 次调用本地后处理：去 4 个噪点域（5px）＋NEAREST 统缩 ×0.9082 ⇒ G9 73.68/77.98 首次达标；studio 双口径 draft=1 均 importable=true（max 改色 0 / full 改色 6）。证据：批目录 `A01-P01-daisy/`（generation-record.txt「v2–v5 重生史与终裁」段、`studio-full-response-v5.json` / `-v5-max.json`）。未入关、未进 `final/`。

**追加（2026-11-18 · A01-P02 向日葵 v1–v3 ＋分段修复锁定）**：Token Plan **3 次调用 / 出图 3 张 / 浪费 2 次**（v1/v2 各 1 次浪费、v3 修后留档；`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 16.5–17.4 s，`qima_output_2k`）。三轮云生图被茎植物先验锁定（白环≈0.5格/茎≈0.9格/高≈88–95%），用户批准**分段确定性修复**（0 调用）：分段径向（盘×1.11/白环×3.32/瓣带×1.87）＋叶带×1.49＋茎带×2.66＋花心下移/叶带平移＋统缩×0.8035 ⇒ G9 72.71/77.98、六道全绿、studio mis=max 改色 0、4 色、cleared=true。效果确认 **PASS**（用户 2026-11-18 裁定锁定，名额 2/180）；catalog §A01 已登记 P02 花心例外（深棕盘＋奶白环）。证据：批目录 `A01-P02-sunflower/`（generation-record.txt、fix-a01p02-piecewise.py、studio-full-verify-v3-max.json）。未入关、未进 `final/`。

**追加（2026-11-18 · A01-P03 郁金香 v1 ＋分段仿射修复锁定）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 16.4 s，`qima_output_2k`）。v1 形态完美（三瓣杯/双缺口/棕底带/上挑双叶）但整株窄条（杯34.2%/叶span31.4%/茎3.32%/高87.3%），用户批准**分段仿射修复**（0 调用）：杯纵×1.3横×1.23、棕带纵×3、下段纵×0.81、叶横×2.56（锚定茎缘）、茎横×5、统缩×0.8368 ⇒ G9 74.27/77.98、六道全绿（含单连通，修复中确诊并解决叶基并茎合并区截止坑）、studio mis=max 改色 0、4 色（棕带 4 格存活）、cleared=true。效果确认 **PASS**（用户 2026-11-18 裁定锁定，名额 3/180）。证据：批目录 `A01-P03-tulip/`（generation-record.txt、fix-a01p03-piecewise.py、studio-full-verify-v1-max.json）。未入关、未进 `final/`。

**追加（2026-11-18 · A01-P04 玫瑰 v1–v2 ＋花瓣语法/格级化/五色均衡锁定）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 1 次**（v1 弃用、v2 修后留档；`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 16.5 s ×2，`qima_output_2k`）。v1 三色同心环被用户判「单调和平面化」弃用 ⇒ v2 改**花瓣形态语法**（外6宽瓣尖深V缺口/内5瓣错位/奶白螺旋crescent/柠黄芯/绿萼短桩）。0 调用本地后处理三段：① 格级化修复 fix-a01p04-piecewise.py（四色硬snap→细尾归并→分段径向 k=[1.7,0.5,4.5,0.85]→去噪→统缩×0.8483；披露修正：批准表 k3=3.0 被实测螺旋中位 20px 推翻，首跑 k3=7/k4=0.47 压没瓣尖后回调）⇒ G9 76.03×77.98、G7 留白≥10.99、六道全绿；② 用户令珠面基准 **32×32**（cell=64px）；③ 用户令色数+面积均衡 ⇒ recolor-a01p04-5color.py 外瓣红/活力橙#F59B23 交替染（轮廓缺口角扇区、>80°中点补界、parity择优）⇒ 5 色面积 46.15/40.98/8.43/2.84/1.6%。**k-means 丢簇坑**：colors=5 丢黄芯簇 ⇒ colors=6 请求解决（实选5色），系列口径 colors=目标+1。studio 32×32/colors=6/mis=max：importable=true、voidCells=0、balancedChanged=0、5 色（红194/橙190/奶白30/黄12/绿12）、**derangement MAXIMAL M=438/438、F=0 全错豆达成**、pricing steps=117/taps=234/cleared=true。效果确认 **PASS**（用户 2026-11-18 裁定「通过，锁定本张」，名额 4/180）。本张为**系列五令试点张**（茎弱化/花瓣语法/32基准/色数均衡G12/colors余量），已登记 series-spec §5＋G12＋§4，catalog §A01 五处（活力橙入宪/玫瑰旧禁忌作废/色数5–6），并裁定**回溯重修 P01–P03**（优先本地确定性重修）。证据：批目录 `A01-P04-rose/`（generation-record.txt、三脚本归档、studio-full-verify-v2-max-32-c6.json；16×16 与 c5 产物留档对照）。未入关、未进 `final/`。

**追加（2026-11-18 · A01-P01 雏菊回溯 v6 锁定替换旧 v5）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 17.0 s，`qima_output_2k`）。系列五令回溯：旧 v5 同心环心＋圆瓣＋无茎属形态不足 ⇒ 云重生花瓣语法（15 细瓣尖 V 缺口＋赭棕基带＋黄盘棕心＋绿萼桩）。0 调用修复六步＋两补丁（fix-a01p01-v6.py）：五色 snap→萼桩重塑 160×112px→去噪→盘外深棕描边清理→奶白瓣 15 扇区交替染柠黄→各向异性统缩居中；披露修正：首跑萼桩脱连（旧桩描边棕污染 head_bot）改瓣体掩膜解决、珠面孤棕格＝描边残加清理步。终值：单连通✓、头高 94.22%、G9 74.02×78.03、留白≥10.94、5 色主导 45.12%；studio 32×32/colors=6/mis=max：importable=true、voidCells=0、balancedChanged=0、**F=0 全错豆 M=420/420**、steps=134/taps=268/cleared=true。效果确认 **PASS**（用户 2026-11-18 裁定「通过，锁定本张」，回溯替换名额仍 1/180，旧 v1–v5 留档）。本张累计 **6 调用/6 出图/4 浪费/2 留档**。catalog §A01 赭棕入宪＋P01 回溯令；series-spec §5 进度 P01 完成。证据：批目录 `A01-P01-daisy/`（generation-record.txt「回溯 v6」段、四脚本归档、studio-full-verify-v6-max-32-c6.json）。未入关、未进 `final/`。

**追加（2026-11-18 · A01-P02 向日葵回溯 v4）**：Token Plan **0 次调用 / 出图 0 张 / 浪费 0 次**（本地确定性修复，输入=v3 锁定版）。系列五令回溯：茎叶弱化（萼桩 160×112px＋横薄叶）＋第五色活力橙（12 瓣黄橙交替）＋32×32 基准。六步修复＋两条披露修正（fix-a01p02-v4bt.py）：环外半径改径向直方图阈值法（首跑腐蚀半径被瓣尖描边推到 580 致橙 0.9%）、瓣缘描边清理 5718px（珠面孤奶白格）。终值：单连通✓、头高 87.39%、G9 74.02×78.03、留白≥10.99、5 色主导 29.51%；studio 32/colors=6/mis=max：**F=0 全错豆 M=438/438**、balancedChanged=0、steps=93/taps=186/cleared=true。效果确认 **PASS**（用户 2026-11-18 裁定「通过，锁定本张」，回溯替换名额仍 2/180，旧 v1–v3 留档）。本张累计 **3 调用/3 出图/2 浪费/2 留档**。证据：批目录 `A01-P02-sunflower/`（generation-record.txt「回溯 v4」段、三脚本归档、studio-full-verify-v4-max-32-c6.json）。未入关、未进 `final/`。

**追加（2026-11-18 · A01-P03 郁金香回溯 v2）**：Token Plan **0 次调用 / 出图 0 张 / 浪费 0 次**（本地确定性修复，输入=v1 锁定版）。系列五令回溯：茎叶弱化（萼桩 160×112px＋横薄叶≈0.9行）＋第五色活力橙（右侧瓣，左红右橙）＋32×32 基准；三瓣杯＋顶双缺口花瓣语法保留不重生。六步修复＋首跑三脱连根因修正＋两视觉补丁（fix-a01p03-v2bt.py）：描边清理界改杯区/带界、清茎全清、薄叶实底化、杯外廓描边剥离 1660px。终值：单连通✓、头高 85.83%、G9 74.02×77.98、留白≥10.99、5 色主导 35.51%；studio 32/colors=6/mis=max：**F=0 全错豆 M=420/420**、balancedChanged=0、steps=72/taps=144/cleared=true。效果确认 **PASS**（用户 2026-11-18 裁定「通过，锁定本张」，回溯替换名额仍 3/180，旧 v1 留档）。本张累计 **1 调用/1 出图/0 浪费/2 留档**。P01–P03 回溯全毕。证据：批目录 `A01-P03-tulip/`（generation-record.txt「回溯 v2」段、三脚本归档、studio-full-verify-v2-max-32-c6.json）。未入关、未进 `final/`。

**追加（2026-11-22 · A01-P07 仙人掌 v4 球形方案）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 16.8 s，`qima_output_2k`）。v1–v3 因细高柱构图退场，用户批准**球形方案**：球宽 68%、五色瓜棱、宽口浅盆。**0 调用**本地后处理：球体行级横向拉伸 1.33＋重绘宽口浅盆＋花冠内盘放大（白 52% / 黄 32%）⇒ G9 **77.1%×73.8%**、单连通、留白 11.4–13.1%；studio 32×32/colors=5/mis=max：`importable=true`、`voidCells=0`、**F=0（N=425）**、最大色面 35.8%、5 色、`cleared=true`。**待用户效果确认，未锁版 / 未入关**。本张累计 **4 调用 / 4 出图 / 3 浪费**（v1–v3 未采用）。证据：批目录 `A01-P07-cactus/`（generation-record.txt、fix-a01p07-v4.py、studio-full-verify-v4-max-32-c5.json）。⚠️ P05 / P06 两批用量未登记，本行只记 P07，缺口待单独补登。

**订正（同日 2026-11-22 · A01-P07 仙人掌 v4）**：用户确认 **PASS 并锁版**（球形方案）；上条状态「待用户效果确认，未锁版 / 未入关」更新为**已锁版**，调用/出图/浪费数不变（本张累计 4 调用 / 4 出图 / 3 浪费）。A01 进度 7/9。

**补登（原批次 2026-11-21 · A01-P05 三叶草 v1–v7；2026-11-22 回填）**：Token Plan **5 次调用 / 出图 5 张 / 浪费 4 次 / 留档 5 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 16.3–21.9 s，均 `qima_output_2k`）。版本链：v1（绿叶＋白/橙 V 纹，16.7 s / `0061d129…`）与 v2（叶簇撑满画布，16.6 s / `15ecb418…`）未采用；v3 = v2 本地确定性修复（**0 调用**）；v4（左叶改橙 4 色，21.9 s / `455d9e18…`）未采用；v5 = v4 本地修复（**0 调用**）；v6（全绿叶＋深棕叶心，16.6 s / `c13e0293…`）32×32 绿色 81.2% ⇒ F=233 退场；v7（三色叶绿/橙/黄＋白 V 纹＋深棕叶心/茎基，16.3 s / `33209583…`）**用户 2026-11-21 PASS 锁定**：32×32、5 色、**F=0（356/356）**、最大色面 34.6%。证据：`A01-P05-clover/`（generation-record.txt、response-meta-v1/2/4/6/7.json、a01p05-v7-max-32-c5-beads-plain.png）。

**补登（原批次 2026-11-21 · A01-P06 荷花 v1–v2；2026-11-22 回填）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 1 次 / 留档 2 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 16.5 / 16.6 s，`qima_output_2k`）。v1（16.5 s / `b2a01121…`）G9 84.96%×85.06% 超上限、单连通 false、32×32 棕点散 ⇒ 退场；v2（16.6 s / `d7b19910…`）经 **0 调用**本地修复（alpha 2px 腐蚀＋13px 绿桥＋80% 归一化）⇒ G9 80.03%×77.83%、5 色、**F=0（416/416）**、最大色面 35.8%，**用户 2026-11-21 PASS 锁定**。证据：`A01-P06-lotus/`（generation-record.txt、response-meta-v1/v2.json、a01p06-v2-max-32-c5-beads-plain.png）。

**追加（2026-11-22 · A01-P08 蒲公英 v1 ＋确定性修复锁定）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 17.6 s，`qima_output_2k`，request_id `57731d0f…`）。设计：28 条严格白/黄交替射线绒球＋深棕花盘＋橙斑＋草绿短茎，五色分区。原始抠图 G9 61.72%×93.36%、单连通 false（15 颗 1–4 px 飞絮碎点）。**0 调用**本地修复（fix-a01p08-v1.py）：去孤点→茎裁 y=1570→横纵独立拉伸（k_x 1.199 / k_y 1.114）→深色 halo 1,118 px 用最近主体 RGB 就地填补（不置 α=0，避免体内空洞成近黑孤岛）→**4 连通**主分量过滤（与 extract-alpha 同口径）。终值：G9 **73.93%×77.98%**、单连通 true、四角透明、近黑 0 px、alpha0 60.048%。studio 32×32/colors=5/mis=max：`importable=true`、`blockers=[]`、`voidCells=0`、**F=0（N=458，MAXIMAL）**。⚠️ **G12 偏差**：只聚 **4 色**（缺活力橙）、最大色面 **46.1%** 超 40%——v1 白+黄实测 ≈87%（设计 42%），橙斑仅 1.1%（设计 7%）；recolor 修复尝试（白→棕 30.7 万 px／黄→橙 9.3 万 px）致 studio 只聚 3 色、importable=false，放弃。用户 2026-11-22 裁定**锁版 v1**，G12 欠账登记为已知例外，P09 boss 后统一评估是否出 v2。A01 进度 **8/9**。证据：批目录 `A01-P08-dandelion/`（generation-record.txt、fix-a01p08-v1.py、recolor-v1.py、studio-full-verify-v1-max-32-c5.json、a01p08-v1-max-32-c5-beads-plain.png）。

**追加（2026-11-22 · A01-P09 花之王 boss v1 ＋确定性修复锁定）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 次**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 16.9 s，`qima_output_2k`，request_id `9f9c3d2a…`）。设计：五角王冠（柠黄＋深棕底带）＋外层 12 瓣玫红/奶白交替＋内层 8 瓣柠黄/橙交替＋深棕花心盘（柠黄点睛）＋草绿萼桩，6 色。原始抠图 G9 70.95%×90.28%、单连通 false（4 px）、近黑 1,659 px（冠下暗红阴影）。**0 调用**本地修复（fix-a01p09-v1.py）：4 连通主分量→深色就地填补 2,773 px→萼桩截短（切 y=1813）→横纵独立拉伸（k_x 1.022 / k_y 0.940）→halo 填补→**边缘抗锯齿压平** 14,721 px（消掉 2 个孤立深棕珠格）。终值：G9 **72.51%×79.49%**、单连通 true、近黑 0 px、alpha0 65.307%。studio 32×32/colors=6/mis=max：`importable=true`、`blockers=[]`、`voidCells=0`、**6 色**（奶白137/玫红103/柠黄83/橙51/棕26/绿10）、**F=0（N=410，MAXIMAL）**、最大色面 33.4%、steps 109 / taps 218 / cleared=true。⚠️ colors=7 首跑多出 1 格赭棕杂色，改 colors=6 干净。用户 2026-11-22 裁定**锁版 v1**（已知取舍：32×32 王冠融为城垛状，接受不重生）。**A01 9/9 全锁**。证据：批目录 `A01-P09-flower-king/`（design-plan.md、generation-record.txt、fix-a01p09-v1.py、studio-full-verify-v1-max-32-c6.json、a01p09-v1-max-32-c6-beads-plain.png）。

**追加（2026-11-24 · A02「林中友」全章 9 关批量产线 ＋建章入库）**：Token Plan **20 次调用 / 出图 20 张 / 浪费 11 次 / 锁定 9 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 16.8–17.6 s，`qima_output_2k`）。版本链：P1 狐狸 4 调（v1/v2 正面构图窄高弃用 → **v3 改 3/4 侧视 G9 首达标** → v4 腹白分区锁定）；P2 棕熊 4 调（v1–v3 弃用 → v4 分区+纵向统缩锁定）；P3 小鹿 5 调（v1–v4 弃用，v4 白斑仅 1.15 格违反章禁忌 → 本地确定性重塑 5 颗 200px 圆斑 → v5 分区锁定）；P4 兔子 2 调（v1 弃用 → v2 分区锁定）；P5 松鼠 / P6 刺猬 / P7 浣熊 / P8 小狼 / P9 鹿王各 1 调。**产线三新工具**（0 调用层，均归档批目录）：`fix-a02-points.py`（点睛炭黑 d104–150 格心对齐重画＋耳内深棕重画，修 k-means 小质量簇丢失）、`fix-a02-rescale.py`（各向异性统缩到 G9 目标，⚠️ 画布必须全透明——不透明黑底毁 alpha 已踩坑）、`fix-a02-g12.py`（G12 主导色 pattern 引导边界染色）。**studio 口径裁定**：32×32 / mis=max / colors=目标数（4–6，含炭黑点睛）/ P9 鹿王改 `quantizer=median-hue`（kmeans 确定性合并橙鞍毯簇，median-hue 一击通过）。终值 9 关全绿：**F=0 全错豆、主导色 35–49%（G12 ≤50% 达标）、4–6 色含炭黑点睛、importable=true、voidCells=0**、steps 39–122（boss 122 ≥ BOSS_STEPS_MIN=68）。**建章**：singles L00021–29（id=order 19–27，boss=L00029 鹿王 kind=boss）、chapters/A02.json（order 4 / open）、manifest contentVersion 42→43、DEMO_LEVEL_COUNT 18→27、arcs.ts+levels-data.ts levels:sync 重生成＋cocos 镜像同批。ⓘ 工具链登记：`probe-2048/extract-alpha.py` 单连通判定改 ndimage 4 连通精确计数（旧「画布中心播种」启发式在主体不居中构图误报 False，A02 全章踩中）。**verify 24/24 绿**。证据：批目录 `A02-P01-fox/`…`A02-P09-deerking/`（prompt-vN.txt、母版/rgba/metrics、fix 脚本、studio-full-response/verify、beads-plain 预览）、`build-a02-chapter.py`、singles/chapters/manifest 真源件。已入关（L00021–29），未走用户逐张效果确认（用户 2026-11-24 批 1 确认问询跳过＝默许推进，珠面预览均已出）。

**追加（2026-11-24 · A03-P09 鲸之王 boss v1 · 首个 48×48 档样张）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 次 / 留档 1 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，单发 17.4 s，`qima_output_2k`）。母版 `a03p09-v1-s42.png`＋抠图 `-rgba.png`＋`-rgba-metrics.json` 均落批目录 `A03-P09-whaleking/`。原始抠图：`subject_bbox=[0,80,2047,2047]`、**bbox_pct 96.09%**（G9 超标）、`four_corners_transparent=false`、单连通 true、近黑 0 px、alpha0 51.937%。逐色（主体像素）：**深棕 35.1%（越 35% 上限）**、湖蓝 30.2%、丁香紫 15.9%、奶白 15.2%、**柠黄 0.8%**、**炭黑 0.3%**、杂色 2.6%。目视问题：尾鳍被右缘裁切、海水带/深水槽通栏出血、腹褶画成 10+ 条细线（违 G4「≥3 格」与 T4）、喷柱为细折线（<3 格宽）、双眼过小（T5 风险）、浪冠与鲸身分离。**判定：重生 v2**（`prompt-v2.txt` 已按上述六项改硬约束：包围盒 76%×76%／四边留白 ≥12%／水带与尾鳍禁触边、腹褶 3 条宽带每条约 3 格、喷柱 11%×20% 约 5 格、面积改 湖蓝30／奶白23／紫22／棕17／黄4／黑4）。后续版本在本行追加，不另开行。

**追加（2026-11-24 · A03-P09 鲸之王 boss v2 ＋0 调用确定性修复链）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 次 / 留档 1 张**（同模型同 seed 42、`--size '2048*2048'`）。v2 修好 v1 四项（包围盒面积 96.09→76.61%、四角透明 true、尾鳍完整不裁切、水带不再通栏；深棕 35.1→23.4%），但 W 87.45% / H 87.60% 仍超 G9、奶白 14.53%（<15%）、柠黄 1.11%、炭黑 1.09%，腹褶仍 10+ 条细线、喷柱仍细如闪电、双眼过小 ⇒ **走 0 调用确定性修复**（`fix-a03p09-v2.py`：78%×78% 归一 + 吞 7 个孤格 + 喷柱补到 3 格 + 3×3×2 双眼重画），按 `colors=0` 全色板投票量化定稿（⚠ 该底图上 `colors=6` 的 k-means 会把湖蓝整簇并进丁香紫，colorError 47.5，勿用）：**G9 79.17%×79.17%、F=0、N=848、6 色 蓝30.7/紫24.2/棕22.4/白18.3 + 黄2.4/黑2.1、importable=true、void=0、steps=162、time=572；可读性 T1–T7 全绿（blocks 12、blocksPerColor 2.0、specks 0、silks 1、parts 1；W1 psn 8.24 仅 warn，池内 L00029 为 10.88）**。脚本重跑图案逐格一致（确定性自证）。产物与配方 → `A03-P09-whaleking/generation-record.txt`。

**追加（2026-11-24 · A03-P09 鲸之王 v2 → 42×42 定稿口径；用户追裁「珠面不用 48×48 那么宽，难度靠增加颜色」）**：Token Plan **0 次调用 / 出图 0 张 / 浪费 0 次 / 留档 1 张**（同一 v2 母版 2048²，全部本地确定性量化；上一条 48 读数降为弃档对照）。实测链：48 档 N=848 但盘面过宽（弃）；40 档 N=617、G 比 1.212<1.25 ⇒ G 降档 ⇒ **tier 2**（弃）；**42 档 N=708（≥700 ⇒ 档₀=3）+ C=6 升一档、G 比 1.136<1.25 降一档 ⇒ tier 3（超难）**，DI=3070800060067。定稿口径 `build-a03p09-42.py`：喷柱左缘描边并黄（rows5-7×cols10-11，中段 2→4 格）+ 近眼溢出格并蓝（13,11）+ 吞 ≤2 格孤块两轮；studio 42×42/colors=0/mis=max：`importable=true`、`blockers=[]`、void=0、**6 色**、**F=0**、steps **144**（≥68）、time 509、cleared=true；色占比 湖蓝 30.6 / 深棕 24.0 / 紫 21.2 / 白 19.1 / 黄 2.5 / 黑 2.5（G12 主色 4×15–35%、炭黑 2–8%、配色 2 种）；G9 79.49×77.98、四角透明、近黑(max<30) 0；可读性 **T1–T7 全绿**（specks 0、silks 0、parts 1；psn 8.19 仅 warn）。**待用户效果确认**，未锁版 / 未建章。证据：批目录 `A03-P09-whaleking/`（generation-record.txt、build-a03p09-42.py、studio-full-response-v2-g42final-42-c0.json、a03p09-v2-g42final-max-42-c0-beads-plain.png）。

**追加（2026-11-24 · A03-P09 鲸之王 42 档 · 水带→左右两簇浪花二追裁）**：Token Plan **0 次调用 / 出图 0 张 / 浪费 0 次 / 留档 1 张**（同一 v2 母版本地重排，上一条水带读数降为留档对照）。用户 2026-11-24 原话「可以不要水带，导致图片上下割裂」→ 选「改左右两簇浪花（推荐）」。改法（`build-a03p09-42.py` ③）：清旧水带 rows27-37 全宽（起点 -1px，防 studio floor 栅格把旧水带顶边暗抗锯齿算进 row27、曾生 1 颗中缝黑珠孤点）；左右两簇 cols4-17 / 24-37、中间 cols18-23 rows27-37 留空（鲸从两浪之间浮出，**无横贯水带**）；奶油浪冠 rows27-29 / 紫 rows30-33 / 棕 rows34-37；上涌阶梯（左 4-9、右 35-37、鳍下 14-17、腹尾间 25-27）只落鲸格外空格。studio 42×42/colors=0/mis=max：`importable=true`、`blockers=[]`、void=0、colorError 15.1、`balancedChanged=0`、**6 色**、**F=0**、**N=760**、steps **146**（≥68）、time 516、taps 292、cleared=true；色占比 白 31.2 / 蓝 28.6 / 棕 19.7 / 紫 15.8 / 黄 2.4 / 黑 2.4（G12 主色 4×15–35%、炭黑 2–8%、配色 2 种、主导 ≤40）；G9 **80.96%×79.49%**、四边留白 9.5–11%（≥8%）、四角透明、近黑(max<30) 0；难度 N=760（≥700 ⇒ 档₀=3）+C=6 升一档、G 比 1.141<1.25 降一档 ⇒ **tier 3（超难）**、DI=3076000060073；可读性 **T1–T7 全绿**（blocks 10、珠/块 76.0、块/色 1.67、specks 0、silks 0、parts 1、珠/色 126.7；psn 8.20 仅 warn，BOSS 结构项豁免）。ⓘ studio 栅格按 floor 取边界，每块涂色右/下沿各多计 1 格（N 比涂色格数多 58），非缺陷。**待用户效果确认**，未锁版 / 未建章 / 不改 contentVersion。证据：批目录 `A03-P09-whaleking/`（generation-record.txt 浪花版读数、build-a03p09-42.py、studio-full-response-v2-g42final-42-c0.json、v2-g42final-pattern.txt、a03p09-v2-g42final-max-42-c0-beads-plain.png）。

**追加（2026-11-25 · A03-P09 鲸之王 42 档 · 三追裁「不要有中缝，底部高度收窄」）**：Token Plan **0 次调用 / 出图 0 张 / 浪费 0 次 / 留档 1 张**（同一 v2 母版本地重排，上一条两簇读数降为留档对照）。改法（`build-a03p09-42.py` ④）：海面 rows29-37 全宽 cols4-37 **连续无中缝**（比两簇版矮 2 行，顶缘 row27→row29）；奶油 rows29-30 / 紫 31-34 / 棕 35-37；浪冠三块 row28（cols5-13 / 17-24 / 29-36）顶缘起伏；连接柱 row27 鳍下 10-13、尾下 29-33 接鲸身（G3）；鳍侧/腹尾间上涌阶梯保留。studio 42×42/colors=0/mis=max：`importable=true`、`blockers=[]`、void=0、`balancedChanged=0`、**6 色**、**F=0**、**N=803**、steps **149**（≥68）、time 526、taps 298、cleared=true；色占比 白 33.6 / 蓝 27.0 / 紫 17.4 / 棕 17.4 / 黄 2.2 / 黑 2.2（G12 主色 4×15–35%、炭黑 2–8%、配色 2 种、主导 ≤40）；G9 **80.96%×79.49%**、四边留白 9.5–11%（≥8%）、四角透明、近黑(max<30) 0；难度 N=803（≥700 ⇒ 档₀=3）+C=6 升一档、G 比 1.090<1.25 降一档 ⇒ **tier 3（超难）**、DI=3080300060073；可读性 **T1–T7 全绿**（blocks 8、珠/块 100.4、块/色 1.33、specks 0、silks 0、parts 1、珠/色 133.8；psn 8.40 仅 warn，BOSS 结构项豁免）。**待用户效果确认**，未锁版 / 未建章 / 不改 contentVersion。证据：批目录 `A03-P09-whaleking/`（generation-record.txt 海面版读数、build-a03p09-42.py、studio-full-response-v2-g42final-42-c0.json、v2-g42final-pattern.txt、a03p09-v2-g42final-max-42-c0-beads-plain.png）。

**追加（2026-11-25 · A03-P09 鲸之王 42 档 · 四追裁「鲸面增加颜色覆盖，减少底部颜色」）**：Token Plan **0 次调用 / 出图 0 张 / 浪费 0 次 / 留档 1 张**（同一 v2 母版本地重排，上一条海面版读数降为留档对照）。前因：用户先提「紫色带减 2 行、深棕减 2 行」，算术判定 N≈663<700 ⇒ tier 掉 2，故改走鲸面加色。改法（`build-a03p09-42.py` ⑤）：海面收窄到 rows23-34（泡沫奶白贴鲸身下缘上涌 rows23-27 共 100 格 + 浪冠 row28 三块 cols5-12/17-24/29-36；丁香紫 rows29-31、深棕 rows32-33、底缘浪谷 row34 三段 cols8-14/19-25/30-36）；鲸背鞍斑 rows16-19 cols19-27 改丁香紫（28 格）、尾鳍 rows20-27 cols29-38 整片改深棕（22 格 + 尾尖收口），只改原图鲸格（A0 快照）。studio 42×42/colors=0/mis=max：`importable=true`、`blockers=[]`、void=0、`balancedChanged=0`、**6 色**、**F=0**、**N=706**、steps **138**（≥68）、time 488、taps 274、cleared=true；色占比 白 30.7 / 棕 24.2 / 蓝 20.4 / 紫 19.5 / 黄 2.5 / 黑 2.5（G12 主色 4×15–35%、炭黑 2–8%、配色 2 种、主导 ≤40）；G9 **80.96%×72.36%**、四边留白 左9.52/右9.57/上10.99/下16.70%（≥8%，底部偏大）、四角透明、近黑(max<30) 0；难度 N=706（≥700 ⇒ 档₀=3）+C=6 升一档、G 比 1.136<1.25 降一档 ⇒ **tier 3**、DI=3070600060067；可读性 **T1–T7 全绿**（blocks 12、珠/块 58.8、块/色 2.00、specks 0、silks 0、parts 1、珠/色 117.7；psn 7.83 仅 warn，BOSS 结构项豁免）。**已被同日五追裁覆盖（留档）**，未锁版 / 未建章 / 不改 contentVersion。证据：批目录 `A03-P09-whaleking/`（generation-record.txt v3 段、build-a03p09-42.py、studio-full-response-v2-g42v3-42-c0.json、v3-g42-pattern.txt、a03p09-v2-g42v3-max-42-c0-beads-plain.png）。

**追加（2026-11-25 · A03-P09 鲸之王 42 档 · 五追裁「减少海面比例，鲸鱼与海面紧密结合」· v5 定稿）**：Token Plan **0 次调用 / 出图 0 张 / 浪费 0 次 / 留档 1 张**（同一 v2 母版本地重排，上一条四追裁读数降为留档对照）。改法（`build-a03p09-42.py` ⑥）：全鲸（喷柱到腹底）纵向 ×1.2、鲸底 row26→row32（鲸形不变、面积 +20%）；胸腹下缘透明楔口 rows24-31 补奶白腹色，鲸腹与浪冠同色相接；海面收窄到 rows31-37 共 7 行（浪冠奶白 2 行三块 + row32 补 cols25-28 连块 / 丁香紫 3 行 / 深棕 2 行）；尾鳍内抗锯齿蓝碎片（尾尖 2×2、col33 rows28-30 细条）并回深棕，压 T2 块/色至 2.00。studio 42×42/colors=0/mis=max：`importable=true`、`blockers=[]`、void=0、`balancedChanged=0`、**6 色**、**F=0（M=706/706）**、**N=706**、steps **132**（≥68）、time 466、taps 264、cleared=true；色占比 奶白 29.2 (206) / 湖蓝 23.4 (165) / 深棕 23.1 (163) / 丁香紫 17.8 (126) / 炭黑 3.4 (24) / 柠黄 3.1 (22)（G12 主色 4×15–35%、炭黑 2–8%、配色 2 种、主导 ≤40）；G9 **80.96%×77.29%**、四边留白 左9.52/右9.52/上13.18/下9.52%（≥8%）、四角透明、近黑(max<30) 0；难度 N=706（≥700 ⇒ 档₀=3）+C=6 升一档、G 比 64/59=1.085<1.25 降一档 ⇒ **tier 3（超难）**、DI=3070600060064；可读性 **T1–T7 全绿**（blocks 12、珠/块 58.8、块/色 2.00、specks 0、silks 0、parts 1、珠/色 117.7；W1 psn 7.23 仅 warn，BOSS 结构项豁免）。**用户 2026-11-25 已确认 v5 定稿**（效果确认 PASS），未建章 / 不落库 / 不改 contentVersion。证据：批目录 `A03-P09-whaleking/`（generation-record.txt v5 定稿段、build-a03p09-42.py ⑥、studio-full-response-v2-g42v5-42-c0.json、v5-g42-pattern.txt、a03p09-v2-g42v5-max-42-c0-beads-plain.png）。

**追加（2026-11-25 · A03-P01 小鱼 32 档 · 批 1 首关）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 1 张 / 锁定 1 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`）。v1 构图过扁（bbox 82.9%×59.6%、左右留白 8.5%）、紫中带画成细缝（≈1.2 珠格）、眼仅约 55px（<1 珠格）⇒ 弃用，出 `prompt-v2.txt`（躯干改浑圆 50%×52%、紫带硬性厚 12%≈4 珠格、眼 9.5%≈195px、整体高 72%）；v2 达标（bbox 81.2%×66.9%、宽高均值 74.1 过 G9 均值口径、四边留白 9.23–17.68%、单连通 true、近黑 0）。量化 `colors=0/mis=max` 首轮紫 35.5% 越限、眼 2×2、4 颗尾巴杂散炭黑珠 ⇒ **0 调用修复** `fix-a03p01-v2.py`（眼重画 3×3、杂珠并邻色、紫带顶 8 格改蓝）：**importable=true、blockers=[]、void=0、4 色、F=0、N=344、steps 58、cleared=true；占比 奶白34.6/紫34.6/蓝28.2/黑2.6；blocks 5、块/色1.25、tiny 0；DI=2034400040119（tier 2）**。G7/G9 偏差留档：左右留白 9.23–9.52%（过 8% 硬门、未达本批 11–12% 目标）、高度单维 66.9%（<70，均值口径达标）。**待用户效果确认**。证据：`A03-P01-fish/`（prompt-v1/v2、a03p01-v1/v2/v2fix 母版与 rgba/metrics、studio-full-response/verify、beads-plain 预览、generation-record.txt）、`studio-a03.py`、`fix-a03p01-v2.py`。

**追加（2026-11-25 · A03-P02 小鲸 32 档 · 批 1 第二关）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 1 张 / 锁定 1 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`）。v1 构图过扁（bbox 86.1%×56.7%、右留白 5.4%<8%）、喷柱细且分叉、眼仅约 1.5 珠格 ⇒ 弃用，出 `prompt-v2.txt`（删「横向舒展」自相矛盾句、躯干浑圆 52%×48%、主体高 ≥70%、喷柱单根粗柱 10%≈205px、眼 10%≈205px、尾鳍距右边缘 ≥12%）；v2 色带/喷柱达标但构图仍偏扁（84.8%×57.4%、右留白 6.4%）⇒ **0 调用几何修复** `fix-a03p02-v2.py`（bbox 裁切 → NEAREST 横压 0.90 / 纵拉 1.25 → 上留白 12.5% 贴回 → 喷柱加宽 192px）：bbox **76.3%×71.8%**（宽高双双落 70–82）、四边留白 11.8/12.5/11.9/15.7、单连通、近黑 0。首轮量化柠黄 40.3% 越限、眼 1 珠、3 颗杂色珠 ⇒ 三轮珠格修复（眼 3×3、旧眼并黄、杂珠并邻色、黄带底行改奶白 24 格、深棕珠归黄、旧眼残弧清零）：**importable=true、blockers=[]、void=0、4 色、F=0（M=318/318）、N=318、steps 54、cleared=true；占比 奶白33.6/柠黄34.9/湖蓝28.6/炭黑2.8；blocks 6、块/色1.5、tiny 0；DI=2031800040092（tier 2）**。留档偏差：柠黄 34.9 贴上限、喷柱 4 珠宽（设计 3）、黄带底行珠格级硬直线。**待用户效果确认**。证据：`A03-P02-whale/`（prompt-v1/v2、a03p02-v1/v2/v2fix…v2fix4 母版与 rgba/metrics、studio-full-response/verify、beads-plain 预览、generation-record.txt）、`studio-a03.py`、`fix-a03p02-v2.py` / `-v2fix.py` / `-v2fix2.py` / `-v2fix3.py`。

**追加（2026-11-25 · A01-P01 雏菊 v7 对称化重做 · WXG-T-1064）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 张 / 锁定 1 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`，15.5s）。动机 = 用户真机报「A01 第一关图形对称但豆面不对称」，复测确诊 v6 锁定版提示词要 12 瓣、模型实画 **15 瓣（奇数）**⇒ 珠面左右不对称 153/512。v7 提示词加「以画布垂直中线严格镜像＋正上正下两瓣骑轴、其余左右各 5 一一镜像」，出图墨形像素镜像不对称 **2.43 %**（v6 = 31.6 %）；⚠ 模型仍画细长茎（bbox 82.0×94.3 % 超 G9），由 `fix-a01p01-v7.py` 程序化收尾（0 调用）：去茎 6 格＋萼桩重塑＋强制镜像＋`|扇区|` 奇偶交替染＋**统缩后再以画布中心 1024 为轴镜一次**。终值：瓣数 12、格化镜像差 0/512、bbox 73.93×77.98 %、留白 ≥10.94 %、5 色主导 41.55 %；studio 32×32/c6/mis=max 珠面**墨形与色层镜像差均 = 0**（0 次调用）。证据 `A01-P01-daisy/generation-record.txt`「v7」段 / `studio-full-verify-v7-max-32-c6.json`。本张累计 7 调用 / 7 出图 / 4 浪费 / 3 留档。

**追加（2026-11-25 · A03-P03 海豚 32 档 · 批 1 第三关）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 2 张 / 锁定 0 张（待裁）**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`）。v1 bbox 83.1%×68.6%、填充 16.7%、眼约 30px、背鳍长钩；v2 按「躯干 40%、短宽三角背鳍、眼 10%≈205px、填充 ≥24%」重写后形态未改善（bbox 88.0%×74.4% 宽超 G9、单连通 false）。两版量化均被 2★ 预算拒产（v1 `50>26`、v2 `61>36`），与 WXG-T-1068 全池拦停同族 ⇒ 待用户裁定预算口径，未锁版。记录 `design/art/proposals/levels-20arcs-selection-20261117/A03-P03-dolphin/generation-record.txt`。

**追加（2026-11-25 · A03-P04 章鱼 32 档 · 批 1 第四关）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 张 / 锁定 1 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`）。v1 母版 bbox 63.7%×82.4%、填充 52.6%；量化初值 6 色 / 橙 39.2% / tiny 15 ⇒ 0 调用修复两轮（双 3×3 眼→2×2、左右各切 2 道 2 格深槽细分腕、清杂色、并碎块、橙与奶白各回 ≤35%）⇒ importable=true、4 色、F=0、N=393、steps 68、time 144s、色占比 29.0/34.4/34.6/2.0、tiny 0；用户确认锁版。记录 `design/art/proposals/levels-20arcs-selection-20261117/A03-P04-octopus/generation-record.txt`。

**追加（2026-11-25 · A03-P05 水母 32 档 · 批 1 第五关）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 张 / 锁定 1 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`）。v1 母版 bbox 60.7%×86.3%、填充 53.4%；量化初值 奶白 38.9% / 草绿 38.6% / 蓝 19.9%、colorError 34.9、tiny 5 ⇒ 0 调用重排（伞盖三带改 蓝 1–8 / 奶白 9–10 / 草绿 11–12、触手截到 26 行即高 81.3% 合 G9、单眼 2×2→3×3、清 6 颗杂黑、逐格重涂设计绿）⇒ importable=true、4 色、F=0、N=325、steps 61、time 129s、色占比 32.3/32.6/32.3/2.8、colorError 0、tiny 0；用户确认锁版。记录 `design/art/proposals/levels-20arcs-selection-20261117/A03-P05-jellyfish/generation-record.txt`。

**追加（2026-11-25 · A03-P06 海龟 32 档 · 批 1 第六关）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 张 / 锁定 1 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`）。v1 母版主体 42.09%；量化初值 5 色（多 #6B3E1E 0.3%）/ 蓝 37.1% / 黑 1.6% / tiny 6 / colorError 32.1 ⇒ 0 调用修（清杂色与眼外黑、头 4→6 格落双 2×2 眼、蓝压到 33.8%、逐格重涂设计色）+ 用户令整盘上下翻转（头朝上）⇒ importable=true、4 色、F=0、N=311、steps 54、time 130s、色占比 33.8/30.5/33.1/2.6、colorError 0、tiny 0；用户确认锁 v1fix2。记录 `design/art/proposals/levels-20arcs-selection-20261117/A03-P06-turtle/generation-record.txt`。

**追加（2026-11-26 · A03-P07 螃蟹 32 档 · 批 1 第七关）**：Token Plan **2 次调用 / 出图 2 张 / 浪费 1 张 / 锁定 1 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`）。v1 母版棕 62.2%、F=110 ⇒ 作废；v2 母版大壳贴壳钳可用，但珠格后棕 50.3% ⇒ 0 调用链：v2fix（棕 33.6%）→ 用户令「身小、腿粗、壳面改」得 v3（棕 41.2%，曾拟 G12 例外）→ 用户改令「腿改蓝/奶白」⇒ 例外作废、v4 腿改奶白/湖蓝 + 壳三横带 + 口部奶白 3 格 ⇒ 四色 31.1/30.7/34.9/3.4 全达标、F=0、N=238、steps 77、time 163s、tiny 0；用户确认锁 v4。记录 `.../A03-P07-crab/generation-record.txt`。

**追加（2026-11-26 · A03-P08 贝壳 32 档 · 批 1 第八关）**：Token Plan **1 次调用 / 出图 1 张 / 浪费 0 张 / 锁定 1 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'` seed 42、`prompt_extend=False`）。v1 母版构图对，但玫红 61.2%、F=119（单色过半无解）、5 色 ⇒ 用户选方案 A，0 调用珠格重排（珍珠 r=6.8 直径约 14 珠格、4 条蓝纹改放射楔形半宽 8°、黑铰合 6×3）⇒ 4 色 34.3/34.5/27.8/3.4 全达标、F=0、N=533、steps 106、time 223s、tiny 0；用户确认锁 v1fix。记录 `.../A03-P08-shell/generation-record.txt`。

**追加（2026-11-26 · A03-P02 换海马 + P06 壳改环状）**：P02 重抽 **1 次调用 / 1 图 / 0 浪费 / 1 锁定**（原鲸鱼与 P09 鲸之王重复，用户令换海马）；量化初值 6 色（#A5652C/#6B3E1E 各 0.5%）、黑 1.0% ⇒ 0 调用修（清杂色、眼 3×2、并碎珠）⇒ importable=true、4 色 33.0/32.5/31.6/2.9、F=0、N=206、steps 38、time 72s、tier 0、tiny 0。P06 壳面改同心环（r>0.84 蓝 / r>0.52 奶白 / 心棕）**0 调用** ⇒ N=311、steps 68、time 163s、tier 2、色占比 35.0/32.2/30.2/2.6、tiny 0；锁定件 v1fix2 → v1fix4。记录 `.../A03-P02-seahorse/generation-record.txt`、`.../A03-P06-turtle/generation-record.txt`。

**追加（2026-11-26 · A03-P09 鲸之王十色改档 · 批 1 第九关 boss）**：Token Plan **3 次调用 / 出图 3 张 / 浪费 2 张 / 锁定 1 张**（`qwen-image-3.0-pro` t2i `--size '2048*2048'`、`prompt_extend=False`；v4/v4b seed 42、v4c seed 43）。用户令「超难起码 10～12 色」（WXG-T-1060 新四档 D = C + N/250）⇒ 6 色 v5 升级 10 色：v4 尾鳍断/眼碎、v4b 炭黑 0.7% 均作废；v4c（seed 43）形态最好但 bbox 96.55% 触边 ⇒ 0 调用内缩 82% + fix2–fix4 修双眼（3×3）/散点/喷柱 ⇒ 10 色全 ≥2.6%、F=0、N=735、steps@24=184、time 535s、tier 3；用户确认锁 v4c-fix4。记录 `games/beads/design/art/proposals/levels-20arcs-selection-20261117/A03-P09-whaleking/generation-record.txt`。
