# 《砖阵》资产规格表（Asset Spec）

> 项目：微信小游戏矩阵 · 首款 demo《砖阵》（Breakout）
> 引擎：Cocos Creator 3.8 LTS ｜ 平台：微信小游戏
> 版本：v2.0（对齐策划定稿，demo 阶段程序化绘制占位）｜ 作者：林绘澄
> 配套：`art-bible.md`（视觉身份）、`accessibility.md`（可访问性）、`runtime/README.md`（目录约定）
> 权威常量来源：`design/gdd/systems-index.md` §3

---

## 0. 前置约定（程基岩落码直接引用）

| 项 | 值 |
|---|---|
| 设计分辨率 | **750 × 1334（竖屏）** |
| 适配策略 | **`FIXED_WIDTH`**（宽度铺满 750，纵向按安全区留白/裁切） |
| 屏幕方向 | `portrait` |
| 坐标原点 | **画布左下角，y 轴向上**；x∈[0,750]，y∈[0,1334] |
| 渲染方式 | Cocos `Graphics` 组件 + 纯色 `Sprite`；**不加载任何外部图片** |
| 颜色空间 | sRGB，直接使用文档中的 HEX 值 |

**关键坐标常量（落码直接引用，勿自造）**：

| 常量 | 值 | 常量 | 值 |
|---|---|---|---|
| `WALL_LEFT_X` | 30 | `BRICK_W × BRICK_H` | 62 × 34 |
| `WALL_RIGHT_X` | 720 | `BRICK_COLS × BRICK_MAX_ROWS` | 10 × 6 |
| `CEILING_Y` | 1240 | `BRICK_GAP_X / Y` | 6 / 6 |
| `PADDLE_Y` | 200 | `BRICK_START_X` | 38 |
| `PADDLE_W × PADDLE_H` | 140 × 24（加宽 196） | `BRICK_TOP_Y` | 1200 |
| `DEATH_Y` | 100 | `BALL_R` | 12 |
| `HUD_BAND_Y` | 1240 ~ 1334 | 列中心 | `69 + 68j` |

---

## 1. 资产清单（可见元素规格表）

> 单位均为**设计像素**（设计分辨率下的逻辑像素）。全部程序化绘制，外部美术文件 0 个。

### 1.1 背景 / 场地

| # | 名称 | 类型 | 目标尺寸 (设计 px) | 绘制方式 | 来源 | 备注 |
|---|---|---|---|---|---|---|
| 1 | `bg_base` | 背景填充 | 750 × 1334 | Graphics 纯色矩形 | 程序化 | 填充 `#0C0B1E` |
| 2 | `bg_grid` | 背景网格 | 750 × 1334 | Graphics 线 | 程序化 | 线宽 1px，40px 间距，`#1A1836` @50% |
| 3 | `bg_vignette` | 暗角 | 750 × 1334 | Graphics 四边叠层 | 程序化 | `#050410` @60% |
| 4 | `wall_border` | 墙体边框 | 围合线（左30/右720/顶1240） | Graphics 描边 | 程序化 | 线宽 4px，`#2C3355`，受击闪白 80ms |

### 1.2 砖块（5 类型）

| # | 名称 | 类型 | 目标尺寸 (设计 px) | 绘制方式 | 来源 | 备注 |
|---|---|---|---|---|---|---|
| 5 | `brick_n` | 普通砖 | 62 × 34，圆角 4 | Graphics 圆角矩形 | 程序化 | 填充 `#35C2F0`，**纯色无标记** |
| 6 | `brick_t_default` | 加固砖（满血） | 62 × 34，圆角 4 | Graphics + 裂纹 | 程序化 | 填充 `#A96BFF`，裂纹 1px |
| 7 | `brick_t_damaged` | 加固砖（受损，−30%） | 62 × 34，圆角 4 | Graphics + 裂纹 | 程序化 | 填充 `#7649B3`，**裂纹加粗至 2px + 2 条** |
| 8 | `brick_s` | 钢砖（不可破坏） | 62 × 34，圆角 4 | Graphics + 斜纹铆钉 | 程序化 | 填充 `#8892A6`，45° 高光斜纹 + 四角铆钉 + **双层描边**（内亮 `#C6CEDD`／外深 `#4A5266`） |
| 9 | `brick_b` | 炸弹砖 | 62 × 34，圆角 4 | Graphics + 图标 | 程序化 | 填充 `#FF6B3D` + **炸弹图标** |
| 10 | `brick_g` | 金砖 | 62 × 34，圆角 4 | Graphics + 图标 | 程序化 | 填充 `#FFCB3D` + **金币标记（铜钱形：深棕金圆盘 `#7A5210` Ø18 + 中孔 8×8 透底色）** |

### 1.3 挡板 / 球

| # | 名称 | 类型 | 目标尺寸 (设计 px) | 绘制方式 | 来源 | 备注 |
|---|---|---|---|---|---|---|
| 11 | `paddle_body` | 挡板主体 | **140 × 24**，圆角 12；加宽态 **196 × 24** | Graphics 圆角矩形 | 程序化 | 填充 `#EAF6FF`，宽度可变 |
| 12 | `paddle_glow` | 挡板辉光 | 156 × 40；加宽态 212 × 40 | Graphics ADD 叠层 | 程序化 | `#38E1FF` @45%，撞球 →80% |
| 13 | `ball` | 球主体 | Ø 24（R12） | Graphics 圆 | 程序化 | 填充 `#FFFFFF` + 2px `#0C0B1E` 描边 |
| 14 | `ball_highlight` | 球偏心高光 | Ø 8，偏移中心 6 | Graphics 圆 | 程序化 | `#9BEBFF`，用于让球旋转可见 |
| 15 | `ball_glow` | 球辉光 | Ø 36 | Graphics ADD 叠层 | 程序化 | `#9BEBFF` @55% |
| 16 | `ball_trail` | 球拖尾 | Ø 24 × 8 层 | Graphics ADD 叠层 | 程序化 | `#7FE9FF`，alpha 55%→0 |

### 1.4 道具图标（64 × 64，**靠图标形状区分**）

> **⚠️ 规格 6 种 / MVP 实装 3 种（加宽 `expand` / 三球 `multi` / 加命 `life`）。**
> 下列第 20–22 项（`slow` / `sticky` / `laser`）**仅出规格与预留资源位，demo 不得实装**；程序侧只需为 `expand`/`multi`/`life` 落码，其余 3 种留接口不接逻辑。

| # | 名称 | 对应道具 | 目标尺寸 | 图标形状 | 分层 | 底色 / 图标色 |
|---|---|---|---|---|---|---|
| 17 | `item_expand` | 加宽挡板 | 64 × 64 | 横条 + 左右外向箭头 | **MVP 实装** | `#171A33` / `#38E1FF` |
| 18 | `item_multi` | 三球 | 64 × 64 | 三个圆 | **MVP 实装** | `#171A33` / `#4CE07A` |
| 19 | `item_life` | 加命 | 64 × 64 | 心形 + 「+」 | **MVP 实装** | `#171A33` / `#FF6E8A` |
| 20 | `item_slow` | 减速球 | 64 × 64 | 下箭头 / 沙漏 | 规格·不实装 | `#171A33` / `#5B8CFF` |
| 21 | `item_sticky` | 磁吸挡板 | 64 × 64 | 马蹄形磁铁 / U | 规格·不实装 | `#171A33` / `#B06BFF` |
| 22 | `item_laser` | 激光挡板 | 64 × 64 | 竖直光束 | 规格·不实装 | `#171A33` / `#FF9F3D` |

> 图标统一圆角矩形底 `#171A33` + 2px 描边 `#2C3355` + 柔光；上下浮动 0.6s 周期。**色相仅为辅助，形状为唯一识别依据。**

### 1.5 VFX 粒子

| # | 名称 | 用途 | 单粒尺寸 (设计 px) | 数量 / 寿命 | 来源 |
|---|---|---|---|---|---|
| 23 | `vfx_brick_burst` | 砖块破碎（同色） | ≤ 10 × 10 | 8~12 粒 / 160ms | 程序化 |
| 24 | `vfx_steel_spark` | 钢砖火花 | ≤ 8 × 8（短线） | 6 粒 / 120ms | 程序化 |
| 25 | `vfx_bomb_shock` | 炸弹冲击波 | **半径 68px（直径 136）** | 1 环 / 400ms | 程序化 |
| 25b | `vfx_bomb_hit` | 爆炸受影响砖块高亮 | 覆盖 62 × 34 × 5（自身 + 四邻） | 与冲击波同步 | 程序化 |

> **炸弹特效约束（对齐 `bricks.md` §2.6 `B`）**：冲击波环**半径恒为 `EXPLODE_R` = 68px（Ø136），不得放大**；因 68px 仅覆盖正交四邻（对角 ≈79px 不被波及），须以 `vfx_bomb_hit`（"十字形"5 块高亮/碎裂）为**主表现**、圆环为装饰，避免"对角也被炸"的误判。
> **判定比较符（与程序同符）**：受影响砖块 = 中心欧氏距离 **`d ≤ EXPLODE_R(68)`（含边界）**；先按此选定范围，再**排除 `S` 钢砖**（免疫）。视觉高亮与伤害判定**同符同范围**，禁止"高亮含边界、伤害不含"。
> **钢砖免疫的视觉**：冲击波/高亮经过 `S` 钢砖时，钢砖**不高亮碎裂**，改为 120ms 金属防护闪光 + 火花（复用 `vfx_steel_spark`）。
| 26 | `vfx_confetti` | 过关彩带 | ≤ 8 × 16 | 24 粒 / 800ms | 程序化 |

### 1.6 HUD 与 UI

| # | 名称 | 类型 | 目标尺寸 (设计 px) | 绘制方式 | 来源 | 备注 |
|---|---|---|---|---|---|---|
| 27 | `hud_score` | 分数文字 | 字号 48 | Cocos Label（系统字体） | 程序化 | `#FFFFFF`，左上 |
| 28 | `hud_combo` | 连击倍率 | 字号 32 | Cocos Label | 程序化 | `#FF6EC7`，combo≥3 才显示 |
| 29 | `hud_lives` | 生命点 | Ø 20 × N（空心=已失） | Graphics 圆环 | 程序化 | `#FFFFFF` 实心 / `#2C3355` 空心 |
| 30 | `hud_level` | 关卡号 | 字号 32 | Cocos Label | 程序化 | `#A6AEC8`，如 `3/5` |
| 31 | `btn_pause` | 暂停按钮 | **88 × 88**（最小热区） | Graphics 圆角矩形 + 图标 | 程序化 | 底 `#171A33`，描边 `#2C3355`，右上 |
| 32 | `overlay_dimmer` | 遮罩 | 750 × 1334 | Graphics 纯色矩形 | 程序化 | `#050410` @65% |
| 33 | `panel_dialog` | 面板 | 560 × 480，圆角 16 | Graphics 圆角矩形 | 程序化 | 底 `#171A33` + 2px `#2C3355` 描边 |
| 34 | `text_title` | 面板标题 | 字号 56 | Cocos Label | 程序化 | `#FFFFFF` |
| 35 | `text_body` | 正文 | 字号 32（**最小 28**） | Cocos Label | 程序化 | `#A6AEC8` |
| 36 | `btn_primary` | 主按钮 | **520 × 120**（菜单）/ 240 × 88（面板） | Graphics 圆角矩形 | 程序化 | 底 `#38E1FF`，文字 `#0C0B1E` |
| 37 | `toast_combo` | 分数/连击飘字 | 字号 40 | Cocos Label | 程序化 | `#FF6EC7` / `#FFFFFF`，600ms 上浮淡出 |

**统计**：可见元素主项 **37 项** + 炸弹子特效 `vfx_bomb_hit`（编号 25b）1 项，**外部美术文件 0 个，全部程序化绘制**。

---

## 2. 未来真实资产替换提示词（AI 生成备用）

> demo 阶段**不生成**，仅登记，供后期替换时直接投喂图像生成工具。替换时文件名与尺寸须与 §1 一致。

| 目标资产 | AI 生成提示词（英文，风格锚定 art-bible §2） |
|---|---|
| `brick_set` | `minimalist neon arcade breakout brick set, 5 rounded-rect bricks 62x34, solid flat emissive colors cyan purple steel-gray orange gold on deep blue-violet background, type markers: solid, crack lines, metallic highlight streaks with rivets, bomb icon with fuse, coin mark (dark-bronze disk with square hole), high contrast, flat vector, no text, game sprite sheet` |
| `paddle` | `minimal neon arcade paddle, rounded capsule bar 140x24, near-white core with cyan outer glow, flat vector, transparent background, game asset` |
| `ball` | `glowing white energy ball radius 12, dark thin outline, small off-center cyan highlight, soft cyan halo, flat vector, transparent background, game asset, centered` |
| `bg_playfield` | `deep space blue-violet arcade background, subtle 40px grid lines, corner vignette, minimal neon, flat, seamless, 750x1334` |
| `powerup_icons` | `set of 6 minimal neon arcade powerup icons 64x64 on rounded dark card, shapes: extend bar, three balls, heart plus, slow arrow, magnet, laser beam, flat vector, transparent background, icon sheet` |
| `ui_kit` | `minimal neon arcade UI kit, rounded rect buttons and panel, dark blue-violet surface with thin border, flat vector, 9-slice friendly, transparent background` |
| `vfx_brick_burst` | `small flat geometric shard particles, 8-12 pieces, solid emissive color, arcade brick break effect, flat vector, transparent background sprite sheet` |

---

## 3. 图集策略

| 阶段 | 策略 |
|---|---|
| **demo（当前）** | **不建图集**。全部 `Graphics` 绘制，主包内美术位图占用 = 0 KB。 |
| 后期替换（v1.1+） | 按 **1024 × 1024** 切分，**UI 与 gameplay 分开**成图，最多 2 张：`atlas_gameplay_01`、`atlas_ui_01`；padding 2px；砖块/挡板**关闭 trim**（保证尺寸一致，避免碰撞盒错位），UI 图标可 trim。 |

---

## 4. 命名规范

- **字符集**：全小写字母、数字、下划线；**禁止**空格、中文、大写字母、连字符。
- **模式**：`{域}_{实体}_{变体}_{状态}.{ext}`
- **域（domain）**：`bg` / `brick` / `ball` / `paddle` / `item` / `vfx` / `ui` / `audio`
- **示例**：
  - `brick_n_default.png`、`brick_t_default.png`、`brick_t_damaged.png`
  - `brick_s_default.png`、`brick_b_default.png`、`brick_g_default.png`
  - `paddle_body_normal.png`、`paddle_body_expanded.png`
  - `item_expand.png`、`item_multi.png`、`item_life.png`
  - `ui_btn_pause_normal.png` / `ui_btn_pause_pressed.png`
  - `vfx_brick_burst_sheet.png`
- **源文件**：与导出同名，置于 `art/source/`，扩展名 `.psd` / `.aseprite` / `.ase`。
- **禁止**在文件名中出现版本号（版本由 git 管理）；禁止 `final` / `v2` / `new` 等词。

---

## 5. 包体预算表（微信小游戏铁律）

**约束**：主包 ≤ 4 MB（4096 KB），主包 + 分包合计 ≤ 30 MB（30720 KB）。

### 5.1 主包预算分配（demo 目标）

| 项 | 预算上限 | 本 demo 预计 | 说明 |
|---|---|---|---|
| Cocos 引擎运行时（裁剪后） | ≤ 1800 KB | 待工程确认 | 仅勾选 2D / Graphics / Tween / Label 等必需模块 |
| 业务代码（含程序化绘制逻辑） | ≤ 400 KB | — | 不含引擎 |
| 美术位图资源 | **0 KB** | **0 KB** | 全程序化，本表核心结论 |
| 音频（若主包内） | ≤ 400 KB | 0 KB（demo 无音频） | 音频归阮和鸣，此处仅预留 |
| 其他（配置/字体等） | ≤ 100 KB | — | 使用系统字体，无字体文件 |
| **主包合计目标** | **≤ 4096 KB** | **目标 ≤ 2000 KB** | 留 ≥ 2000 KB 安全余量 |
| 主包安全余量 | **≥ 2000 KB** | — | 应对引擎增长与审核波动 |

### 5.2 分包与未来资产预算

| 项 | 上限 | 说明 |
|---|---|---|
| 分包合计 | ≤ 30720 KB | 未来关卡、贴图、音频放分包 |
| 单张贴图图集（1024² RGBA PNG） | 300 – 800 KB | 视压缩率；建议 ASTC 压缩后再降 50%+ |
| 未来图集总预算（2 张） | ≤ 1600 KB | `atlas_gameplay_01` + `atlas_ui_01` |
| 未来单关音乐（mp3，30s） | ≤ 400 KB | 放分包 |

### 5.3 美术对包体的承诺

- demo 阶段美术资产对主包贡献 = **0 KB**，**不占用任何主包空间**。
- 未来替换真实资产时，**单游戏美术预算 ≤ 10 MB**，且优先放分包。
- 每张图集入库前须通过压缩（PNG-8 / ASTC），并在本表登记实际大小。

---

## 6. 「减弱动效」规格（demo 实装 · 可实现级）

> 主理人裁定：**demo 实装**（计入可访问性 Standard 落地项）。程序侧读取布尔开关 `reduceMotion: boolean`（设置页 toggle，持久化走 S8 存档），各效果按下表分支。**原则：关掉"运动/粒子/震动"，保留"碰撞可读性"反馈**（白闪、颜色变化、得分飘字不得删，否则玩家失去命中反馈）。

### 6.1 关停清单（`reduceMotion = true` 时关闭）

| 效果 | 默认（false） | 减弱后（true） | 说明 |
|---|---|---|---|
| 屏幕震动（炸弹） | 120ms / ≤6px | **关闭**（幅度 = 0） | 前庭不适主要来源 |
| 砖块破碎粒子 `vfx_brick_burst` | 8~12 粒 / 160ms | **关闭**（粒子数 = 0），砖块仅 160ms 缩放淡出 | 保留砖块消失本身 |
| 钢砖火花 `vfx_steel_spark` | 6 粒 / 120ms | **关闭**（0 粒） | — |
| 过关彩带 `vfx_confetti` | 24 粒 / 800ms | **关闭**（0 粒） | — |
| 球拖尾 `ball_trail` | 8 层残影 | **关闭**（层数 = 0） | 球本体与描边保留 |
| 炸弹冲击波圆环 `vfx_bomb_shock` | Ø136 圆环 / 400ms | **关闭圆环**，仅保留砖块连锁消失 + 一次 120ms 局部亮闪 | 保留"炸了"的空间可读性 |
| 面板入/出 缩放 | scale 0.9→1.0 / 200ms | **改为纯淡入** α 0→1 / 200ms（去掉缩放） | 出场同理 150ms |
| 主菜单标题霓虹呼吸 | 2000ms 循环 | **关闭**（静态发光） | 周期性运动 |
| 连击倍率脉冲 | 1.3× / 120ms | **关闭**（数字静态切换） | — |

### 6.2 保留清单（减弱后**必须仍生效**）

| 效果 | 保留原因 |
|---|---|
| 撞砖白闪 80ms / 撞墙高亮 80ms | 命中可读性；属局部闪，非全屏，且 <3Hz（D2 红线内） |
| 砖块 160ms 缩放淡出 | 破碎反馈 |
| 得分飘字 600ms、连击数字变化 | 计分可读性 |
| 砖块受损态（亮度 −30% + 裂纹） | 血量可读性 |
| 生命点增减、关卡号更新 | 状态可读性 |
| UI 淡入淡出、暂停遮罩 150ms | 轻量、非运动 |
| 球的匀速运动与反弹 | 核心玩法，必然保留 |

### 6.3 与可访问性红线的一致性

- 减弱动效**不得**移除色盲三重编码、对比度、文字放大等特性（§`accessibility.md` A1/B2/D2）。
- 所有保留的闪烁 ≤3Hz、单次 ≤300ms，符合光敏安全（D2）。
- 建议在设置页加一句说明文案：**「减弱动效：关闭屏幕震动与粒子特效」**（避免玩家误解为"画质降低"）。

---

## 7. 交付与验收

- [ ] 37 项可见元素（+ 炸弹子特效 `vfx_bomb_hit`）全部由程序化绘制实现，无外部图片引用。
- [ ] 所有尺寸、颜色与 `art-bible.md` §3/§4 及 `systems-index.md` §3 一致。
- [ ] 5 种砖块在黑白模式下可 100% 区分，加固砖受损态可辨（见 `accessibility.md`）。
- [ ] 钢砖三线索（斜纹+铆钉+双层描边）第一眼可辨；命中仅金属闪+火花，无碎裂/无飘分。
- [ ] 炸弹冲击波半径 = 68px（Ø136）**不放大**，受影响砖块按"十字形"高亮；钢砖免疫有视觉体现。
- [ ] 炸弹判定比较符 `d ≤ 68`（含边界）与程序一致，视觉与伤害同范围。
- [ ] `G` 金币标记为铜钱形（实心盘 + 方孔），50% 缩放灰度下与 `B` 炸弹剪影可区分。
- [ ] 球带高对比描边 + 偏心高光（旋转可见）+ 拖尾。
- [ ] 挡板基础 140×24、加宽 196×24，辉光随宽度拉伸。
- [ ] 道具图标规格 6 种、**仅实装 3 种**（expand/multi/life）。
- [ ] 「减弱动效」按 §6 关停/保留清单落码，且不影响核心反馈。
- [ ] 构建后主包 ≤ 2000 KB（业务代码 ≤ 400 KB）。
- [ ] 文件命名符合 §4 规范。

---

*本文件为资产生产与替换的权威规格。任何新增可见元素须先登记本表再落码。*
