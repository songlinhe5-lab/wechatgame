# 《拼豆》资产规格表（Asset Spec）

> 项目：微信小游戏矩阵 · 第二款《拼豆填色消除》
> 引擎：Cocos Creator 3.8 LTS ｜ 平台：微信小游戏
> 版本：v1.1（demo 阶段，程序化绘制占位）｜ 作者：林绘澄
> 配套：`art-bible.md`（视觉身份）、`accessibility.md`（可访问性）
> **纪律**：`[待 systems-index §3 对齐]` 项不自行发明；本表其余数值可直接落码。

---

## 0. 前置约定（程基岩落码直接引用）

| 项 | 值 |
|---|---|
| 设计分辨率 | **750 × 1334（竖屏）**（已裁定） |
| 适配策略 | **`FIXED_WIDTH`** |
| 坐标原点 | **画布左下角，y 轴向上** |
| 渲染方式 | Cocos `Graphics` + 纯色 `Sprite`；**不加载任何外部图片** |
| 颜色空间 | sRGB；`mix(A,B,t)` = 线性插值两 HEX，t 为 B 的占比 |
| 珠子单元尺寸 | `BEAD` = **50**（`systems-index.md` §3.3 冻结值，pitch 52 = 50+2）；下文参数卡以 **BEAD = 64** 为示例值演算展示比例，落码按公式等比换算 |

---

## 1. 资产清单（可见元素规格表）

### 1.1 珠子绘制参数卡（**核心，逐层落码**）

> 单颗珠 = 以下 6 层按序绘制。所有层均为圆角矩形/矢量，无贴图无模糊。

```
常量：BEAD = 珠子边长（冻结值 50，来源 systems-index §3.3；下方以 64 演算仅展示比例）
      r    = round(BEAD × 0.22)          // 圆角半径，示例 14
      base = 珠子基色（art-bible §3.2 十色之一）

L0 投影    roundRect(x, y−3, BEAD, BEAD, r)
           fill #1E2033, α 0.15
L1 主体    roundRect(x, y, BEAD, BEAD, r)
           fill base
L2 暗倒角  沿下边+右边内缘描边（内缩 1.5px）
           lineWidth 3, color mix(base, #000, 0.22)
L3 亮倒角  沿上边+左边内缘描边（内缩 1px）
           lineWidth 2, color mix(base, #FFF, 0.18)
L4 高光条  roundRect(x + BEAD×0.10, y + BEAD×0.62, BEAD×0.80, BEAD×0.26, BEAD×0.13)
           fill #FFFFFF, α 0.38
L5 符号    居中，尺寸 BEAD×0.40（示例 26px），线宽 ≥ 2px
           color = (base 亮度 > 0.6) ? mix(base, #000, 0.55) : #FFFFFF @ 0.90
```

**符号矢量定义**（程序化 path，不依赖字体；占珠面 40%）：

| 珠色 | 符号 | path 定义 |
|---|---|---|
| 奶白 `#FDF6E9` | ○ 圆环 | 圆 r=13，stroke 3，不填充 |
| 柠黄 `#FFD23F` | ★ 五角星 | 5 角星路径，外接圆 r=13，填充 |
| 活力橙 `#F59B23` | ● 实心圆 | 圆 r=11，填充 |
| 草绿 `#3FBF6B` | ■ 实心方 | 方 20×20 圆角 4，填充 |
| 玫红 `#E84C3D` | ♥ 心形 | 双圆(r=6, 圆心±6x) + 下三角，填充 |
| 丁香紫 `#8E6FD9` | ◐ 半圆 | 半圆弧（左半）填充 + 直径线 |
| 湖蓝 `#3D7BF5` | ▽ 下三角 | 等边下三角，边 24，填充 |
| 赭棕 `#A5652C` | ▲ 上三角 | 等边上三角，边 24，填充 |
| 深棕 `#6B3E1E` | ◆ 菱形 | 菱形对角线 26/16，填充 |
| 炭黑 `#33333D` | ✚ 十字 | 两矩形 22×6 正交，填充 |

**最小特征约束**：符号线宽 ≥ 2px、最窄填充 ≥ 6px、高光条高 ≥ 0.26×BEAD → 50% 缩放下仍可辨；**禁止**给符号加 <2px 细节。

### 1.2 珠子状态参数

| 状态 | 绘制差异（其余同 §1.1） |
|---|---|
| `filled` 已填 | 完整 6 层 |
| `empty` 空位（**含目标色底**） | 分层绘制（无 L0 投影 / L2–L4 倒角高光 / L5 满符号 → 不可误读为已填珠）：<br>**E1 目标色底** `mixWith(slot_fill, beadColor(colorIdx), EMPTY_TINT_MIX=0.35)` — 目标色占 35% 权重混入中性槽底色，产出柔和粉彩色调；<br>**E2 描边** `slot_border #D8D5E6` 1px（保持凹陷边界）；<br>**E3 内上阴影** 上缘内侧 3px `#E4E1F0` 条（凹陷感不变）；<br>**E4 幽灵符号** 居中，尺寸 BEAD×0.32，ink = `beadColor(colorIdx)` @ α `EMPTY_GHOST_ALPHA=0.20`；与 L5 相同矢量 path 但缩小 80%、低不透明度 → 色盲冗余通道 + 解决奶白近白问题。<br>**设计意图**：「an unfilled cell must not read as a bead」——无高光条 / 无倒角 / 无投影 / 符号极淡 → 形态语言=「凹陷待填槽」而非「凸起已填珠」。<br>**与 `hint` 叠加**：hint 态 = 本 empty 全层 + **外描边** `accent_blue #3D7BF5` 2px + 600ms 呼吸（α 0.5↔1.0），外描边覆盖 E2、目标色底与幽灵符号保留可见。
| `locked` 锁定 | 主体 `palette.locked`（`#B9B4CC`）**平涂**（locked 格 colorIdx=0 无语义基色，无法执行原规格 `mix(base,#B9B4CC,0.60)`，正式追认此偏差）+ 45° X 斜纹（`palette.background` @ α0.9，线宽 2，两条对角线）；**无高光无符号**。非颜色通道由 X 斜纹承担。 |
| `hint` 提示 | 目标色底 `empty`（E1–E4 全层）+ 外描边 `accent_blue #3D7BF5` 2px + 600ms 呼吸（α 0.5↔1.0）；叠加优先级：外描边 > E2 描边 > E1 色底（毫秒与循环频率以 `ux-spec §5` 为权威（600ms α 0.5↔1.0）；原 `[待 ux-spec 对齐]` 占位经 WXG-T-091 删除） |
| `wrong` 错误 | 当前珠 + 描边 `danger #E8434A` 2px 闪 2 次（≤2 次/秒）+ 位移 ±3px 抖动 200ms |
| `selected` 选中 | 完整 6 层 + 整体上移 4px + L0 投影 α 0.15→0.25 + 珠下 6px 处 Ø8 圆点 `accent_blue` |

### 1.3 槽位托盘

| 名称 | 规格（设计 px） | 参数 |
|---|---|---|
| `tray_panel` | 690 × 190 `[待 systems-index §3 对齐]` | 白 `#FFFFFF`，圆角 24，描边 `panel_border` 1px，投影 = 圆角矩形 (0,−3) `#1E2033` α0.10。**WXG-T-097 注**：本行与 §3.4 仍未对齐（实装按槽簇派生：宽 12×54−6+2×12 = 666、高 rows×54−6+24；垂直锚定 v1.20 由「带内居中」改「**贴带上沿**」），尺寸修正属美术侧待办，本次只同步锚定口径，不改本行原值 |
| `tray_slot` | 同 BEAD（示例 64，内缩 4） | `empty` 态绘制（§1.2） |
| `tray_slot_dashed` | 同上 | 描边 `slot_dashed #C9C5DA` 2px，dash 6/4，无填充 → 可扩展位 |
| `btn_expand` | 132 × 48，圆角 24 | 底 `#2A2E43`，白色 ▶ 三角 12px + 「扩展」28px 白字（参考图同款）。**落位（WXG-T-097/BD-15）**：`TRAY_BAND` 带下沿居底，视觉 y∈[250,298] / 热区 y∈[230,318]（源 `systems-index §3.4` v1.20 + `accessibility C1`）；右上角常驻 `ad_badge`（参数继承 §1.4 同 token：28×28 圆角 8、白 ▶ 边 10、内缩 (8,8)）。本节未定的两项已标为派生：▶ 与文字间隔 12px、「扩展」宽 56px（CJK 等宽近似，RenderModel 无文本度量），见 `tuning.ts::EXPAND_BTN_*` |

### 1.4 道具图标（64 × 64，**靠形状区分**）

| # | 名称 | 对应道具 | 图标形状（程序化 path） | 主色 |
|---|---|---|---|---|
| 1 | `item_area_clear` | 区域消除 | 斜置魔法棒（矩形 6×40 旋转 −45°）+ 顶端五角星 r=12 | 棒 `#8E6FD9` / 星 `#FFD23F` |
| 2 | `item_tray_clear` | 槽位清空 | 扫帚：柄（矩形 5×34 旋转 −30° `#A5652C`）+ 刷毛扇形（`#FFD23F`，3 条分缝线） | `#FFD23F` |
| 3 | `item_random_clear` | 随机消除 | 马蹄磁铁：U 形（外弧 r=18/内弧 r=8）+ 两极白/浅蓝端帽 | `#E84C3D` / 端帽 `#D8D5E6` |
| 4 | `item_reserved_04` | `[待 GDD 对齐]` | 预留位，不实装 | — |

- 图标底：白卡 `#FFFFFF` 圆角 20（卡 **176 × 116**），描边 `panel_border` 1px，投影 α0.10。
  - ⚠️ **卡高 150 → 116（WXG-T-062 主理人裁定，方案 A「改卡高、不动带位」）**：原「176×150 + **卡下方**标签 28px」需 182 > `systems-index §3.1` 的 `POWERUP_BAND` 高 **152**，两条冻结规格**无法同时成立**。取 116 + 间隔 4 + 标签 28 = **148 ≤ 152** ⇒ `§3.1` 与底部留白 48 **一字不动**，A4 的「文字标签并列」得以落地。工程侧同源常量见 `tuning.ts` 的 `POWERUP_CARD_*` / `POWERUP_LABEL_*`。
- 卡下方标签：28px `text_primary`（「区域消除 / 槽位清空 / 随机消除」），与卡间隔 **4px**（本节原未规定间隔，本项派生）。
- **视频角标 `ad_badge`**：28 × 28 圆角 8，底 `#2A2E43`，白色 ▶（边 10px），贴卡**右上角**内缩 (8,8)。
- 触控热区：整卡 ≥ 88 × 88（实际 **176×116** 达标）。

### 1.5 HUD 元素

| 名称 | 规格 | 参数 |
|---|---|---|
| `hud_timer_capsule` | 220 × 64，全圆角 | 白底 + `panel_border` 1px + 投影；内：时钟图标 Ø36（圆环 `accent_blue` 3px + 指针 2px）+ 数字 44px `text_primary` |
| `hud_timer_danger` | 同上 | 数字/图标切 `#E8434A` + 1000ms α 脉冲**循环**（周期/时长以 `ux-spec §5`「倒计时告急」行为权威，与 `ux-spec §3.1` HUD 告急条款同源；α 幅度两文均未定义 → 本表不自行发明。原 `[待 ux-spec 对齐]` 占位经 WXG-T-098 删除） |
| `tray_panel_danger` | 沿 `tray_panel` 边缘 2px 描边（圆角随面板实装值 18） | `danger #E8434A` + **500ms α 呼吸循环**（周期以 `ux-spec §5`「满槽告警」行为权威 = 500ms/循环，≈2Hz 在 §3.8 ≤3Hz 红线内；α 幅度 ux-spec 未定 ⇒ **沿用同族既有实现值 0.6↔1.0**（`view-model.ts::dangerAlpha()` 已用的那组，本行不新造第三档；同上行口径，若 ux-spec 日后冻结幅度则以 ux-spec 为准）。WXG-T-097/BD-10 落地；`reduceMotion` 下退为**静态描边 α=1**，见 `accessibility` D1） |
| `btn_settings` | 图标 Ø48，热区 88×88 | `accent_purple` 齿轮（8 齿，外径 48/内孔 r=10），左上 |
| `panel_dialog` | 560 × 480，圆角 24 | 白 + `panel_border` + 投影（弹窗/结算） |
| `btn_primary` | 240 × 88，圆角 20 | 底 `accent_blue`，白字 32px |
| `text_body` | 字号 32（**最小 28**） | `text_secondary` |

### 1.6 VFX

| 名称 | 用途 | 参数 |
|---|---|---|
| `vfx_fill_pop` | 珠子落座 | scale 1.06→1.0，120ms ease-out-back |
| `vfx_clear_dissolve` | 消除 | scale 1.0→0.6 + α→0，200ms ease-in |
| `vfx_wrong_shake` | 错误 | 位移 ±3px ×2，200ms |
| `vfx_complete_wave` | 完成庆祝 | 按列波浪弹跳（scale 1→1.08→1），每列延迟 20ms，800ms |

**统计**：可见元素约 **21 项 + 10 珠色 × 6 状态矩阵**，**外部美术文件 0 个，全部程序化绘制**。

---

## 2. 未来真实资产替换提示词（AI 生成备用）

| 目标资产 | 提示词 |
|---|---|
| `bead_set` | `candy-like 3d perler bead set, rounded square beads, soft top gloss highlight, beveled edges, 10 candy colors, matte plastic, top-left light, flat vector rendering, sprite sheet, transparent background` |
| `tray` | `white rounded tray panel for bead slots, soft shadow, minimal casual game UI, flat vector, 9-slice friendly` |
| `item_icons` | `3 casual game item icons 64x64: star magic wand, broom, horseshoe magnet, glossy candy style, flat vector, transparent background` |
| `bg_playfield` | `very light lavender-gray plain background, no texture, soft and clean, casual mobile game, flat color` |

---

## 3. 图集策略

| 阶段 | 策略 |
|---|---|
| **demo（当前）** | **不建图集**，全 `Graphics`，主包美术位图 = 0 KB |
| 后期（v1.1+） | 1024×1024 × 2 张：`atlas_gameplay_01`（珠子 10 色 × 状态）/ `atlas_ui_01`（托盘/图标/HUD）；padding 2px；珠子**关闭 trim**（保证尺寸一致） |

---

## 4. 命名规范

- 全小写 + 下划线；模式 `{域}_{实体}_{变体}_{状态}.{ext}`。
- **域**：`bg` / `bead` / `tray` / `item` / `hud` / `vfx` / `ui` / `audio`
- 示例：`bead_orange_filled.png`、`bead_lime_locked.png`（`bead_` + 色名英文）、`tray_panel.png`、`item_area_clear.png`、`hud_timer_normal.png`。
- 色名英文对照：`white/lime/orange/green/red/purple/blue/brown/darkbrown/black`。
- 禁止版本号、`final`、空格、中文、大写。

---

## 5. 包体预算表（微信红线 vs 内部目标，**分清两条线**）

| 线 | 项 | 值 |
|---|---|---|
| **微信红线（不可越）** | 主包 | ≤ **4096 KB** |
| | 主包 + 分包合计 | ≤ **30720 KB** |
| **内部目标（自我约束）** | 主包合计 | ≤ **2000 KB**（systems-index §3.9） |
| | Cocos 引擎运行时（裁剪后·实测 `cocos-js`） | **1500 KB** |
| | 业务代码 + 构建资源（实测 `assets` 384 + `src` 68） | **452 KB** |
| | 美术位图（demo，全程序化） | **0 KB** |
| | 音频（demo，程序化合成，产物内零文件；采样走分包） | **0 KB**（原「预留 ≤400 KB」不可兑现，audio-spec §4.1/§7.3；WXG-T-091 重算） |
| | ⇒ 实测合计（web-mobile release、`du -sk`） | **1968 KB**（audio-spec §4.2，2026-09-14） |
| | 安全余量 = 内部目标 − 实测合计 | **32 KB**（原「≥ 2000 KB」系分项和超目标的自相矛盾值，已废弃） |
| **未来资产（放分包）** | 图集 ×2（1024² RGBA PNG） | ≤ 1600 KB |
| | 单游戏美术总预算 | ≤ 10 MB |

---

## 6. 交付与验收

- [ ] 全部元素程序化绘制，无外部图片引用。
- [ ] 珠子按 §1.1 六层参数卡绘制，全局受光方向一致（左上）。
- [ ] 10 色珠子在黑白模式下仅凭符号+明度 100% 可辨。
- [ ] **空槽目标色底可辨**：开局静帧中，所有可填格的 E1 色底肉眼可区分不同目标色（3 色关卡 ≥ 3 类，5 色关卡 ≥ 5 类）；E4 幽灵符号在 deuteranopia 模拟下仍可区分。
- [ ] `locked`/`empty`/`hint`/`wrong`/`selected` 状态不依赖颜色可辨。
- [ ] 道具图标 3 实装 + 1 预留，靠形状区分；视频角标右上角。
- [ ] 触控热区 ≥ 88×88；文字最小 28px。
- [ ] 主包 ≤ 2000 KB（内部目标），红线 4096 KB 不越。
- [ ] 命名符合 §4。

---

*本文件为资产生产与替换的权威规格。§3 网格/托盘/告急常量按 `systems-index.md` **v1.0（2026-09-11）** 冻结值回写；§3 现版为 **v1.18（2026-09-15）**（唯一真源 `systems-index-changelog.md`），经核 v1.1→v1.18 该三组常量**零改动**（改动集中于 §3.2 `DECOY_COLORS_MAX`→0（v1.17）、§3.7 星级（v1.10）、§3.8 空槽常量（v1.16）、§3.12 音频（v1.16/v1.18））。§1.2 `empty` 行于 WXG-T-080 修订（增目标色底 E1–E4）、`locked` 行追认实现偏差（2026-09-14）。**UX 规格（WXG-T-081）早已产出**，动效毫秒与循环频率一律以 `ux-spec §5` 为权威：`hint`（:73，经 WXG-T-091）与 `hud_timer_danger`（:106，经 WXG-T-098）两处 `[待 ux-spec 对齐]` 占位均已回写删除，不再有「待 UX 规格产出」之说；本表现存续待对齐项仅 :81 `tray_panel`（§3 未直接冻面板几何）与 :93 道具 4 预留（待 GDD），均非 UX 域。*
