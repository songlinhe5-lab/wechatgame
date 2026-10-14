# 可替换元素全链路盘点（replaceable-inventory）· WXG-T-267 · v1.0

> 作者：程基岩（工程）· 2026-10-08 · 冲突口径：代码现状 > assets-spec > 提案（已按此核对）。
> 覆盖链路：**珠色墨水 → 珠面层集 → 格/槽/盘面 → UI 令牌 → 动效/布局参数**。
> 每行给：当前定义位置（文件:行）· 当前值形态 · 可替换维度（色/形/纹理/有无）· 替换难度与原因。
> 难度口径：**低** = 实例注入/数据包即可，无签名变更无封箱结构性风险；**中** = 需最小重构或扩缓存键；**高** = 动 §3 冻结常量/命中/封箱核心断言，默认不入肤。

---

## 0. 总账

| 分级 | 数量 | 结论 |
|---|---|---|
| **MVP 入肤**（低/中，纯数据可达） | **约 30 项**（UI 令牌 18 + 端点系数 8 + shadow/槽锚墨 2 + 珠体风格联动 1 + 兜底/阶梯 1） | 批 1–2 |
| **候选入肤**（需用户拍板） | 2 项：珠色基色映射、文案令牌 | 批 3 / 不建议 |
| **⛔ 不入肤**（高难度 / 语义不该换） | 约 40 项：布局带、格距、命中、动效毫秒、L4、资产色 | 永久排除面 |

---

## 1. 珠色墨水层（生成 → 渲染的数据流）

| 元素 | 当前定义位置 | 当前值形态 | 可替换维度 | 难度 |
|---|---|---|---|---|
| 关卡色板引用（slug + 色号） | `src/config/levels-data.ts`（`BeadsLevelRaw.palette/paletteCodes`，经 `src/config/palettes-data.ts::PALETTES`） | 字符串 slug + 色号数组（**品牌真值，beads-studio 入关写入**） | 色 | **高**——真源在关卡数据与品牌生成物，属「配色主题」，assets-spec §1.9.7① 明文：换肤不得改珠体基色，改色须另走色板裁定。**建议不入肤**（见 arch.md D4） |
| 墨水 hex 表 `BeadInks.hexes` | `src/view/palette.ts:115`（`beadInksFor`）/ `:133`（`resolveInkHexes`） | `readonly string[]`（hex，按关卡解析 + WeakMap 缓存） | 色 | 同上（高）。技术通道已通（per-level 实例），缺的只是**裁定**不是代码 |
| 端点派生系数族（8 个） | `palette.ts:424-443`：`SOCKET_EDGE_DARK_MIX 0.30`、`SOCKET_PIT_DARKEN 0.14`、`SOCKET_LIT_MIX 0.38`、`BEAD_HOLE_STROKE_MIX 0.58`、`SOCKET_SHADE_OUTER_MIX 0.80`、`SOCKET_SHADE_MID_MIX 0.68`（+ 内部组合） | 系数（mix 权重，模块级常量） | **纹理/质感**（端点明暗阶梯 = 槽与珠的凹凸光影） | **中**——`bakeEndpoints`（`palette.ts:90`）需加系数形参、`inksCache` 键需扩 skinId；零新 hex（同族内派生），属 §1.9.7④「系数可自由换」的合法作用面 |
| 端点表 `BeadEndpoints`（base/edge/pit/lit/hole/shadeOuter/shadeMid） | `palette.ts:455-469` | 预烘焙查找表 | 色+纹理 | 低（随上两项自动跟随；结构已参数化） |
| 兜底炭黑 `BEAD_FALLBACK_HEX` | `palette.ts:15`（`#33333D`） | hex 字面量 | 色 | **低但建议不动**——兜底语义（错误可见性），换肤换了会掩盖越界告警的辨识度 |
| demo 默认墨水组 `DEMO_BEAD_INKS` | `palette.ts:446` | 模块级预烘焙 | 色 | 低——随关卡色板走，不入肤；但封箱基准引用它 ⇒ 默认肤腿的锚 |

## 2. 珠面十层（含现役四棱层集）

> 现役默认 = **facet-4 四棱刻面**（7 命令 / 0 真 α）；旧十层已封入 `bead-styles/legacy-ten.ts` 作对照臂（⛔ 不进玩家池）。两层集都已是**风格插件**（`bead-styles/contract.ts::BeadStyle`，纯函数出层集）。

### 2a. 现役 facet-4 层集（`src/view/bead-styles/facet-4.ts`）

| 层 | 可变参数（真源） | 值形态 | 可替换维度 | 难度 |
|---|---|---|---|---|
| #1 plate 暗底（兼描边环） | `FACET4_PLATE_MIX −0.44`（`tuning.ts:1676`） | mix 系数 | 色调（族内） | 低（系数型换肤通道 §1.9.7④，判例 =「06 珐琅」） |
| #2–#5 四向刻面 | `FACET4_FACET_LEFT/RIGHT/BOTTOM_MIX`（−0.08/−0.22/−0.40，`tuning.ts:1684-1695`）+ `FACET4_FACET_INSET 0.09`（`:1704`） | mix 系数 + 比例 | 明暗序/立体感 | 低（同上；d 单调判据须复验） |
| 刻面几何 | `FACET4_EDGE_INSET_PX 1`、`FACET4_ARC_STEP_DEG 15`、`FACET4_SEAM_STROKE_PX 0.75`（`tuning.ts:1712-1719`） | 定值 px/度 | 形 | 中——动它=动层集形状 ⇒ 封箱腿 2/3 必重封，且门禁 C7 命令计数需复测 |
| #6 孔环 / #7 孔底 | `BEAD_CARD.holeRatio 0.44`、`holeStrokeWidthPx 1`（`tuning.ts:1545/1555`） | 比例 + 定值 px | 形/有无 | **高**——holeRatio 与 `BEAD_DRAW_INSET` 互为对冲（硬约束②，同批提交纪律）+ 封箱腿 3 专锁孔层；⛔ 不入肤 |
| 整体层集替换 | `registry.ts:54`（`REGISTRY`，注册序=循环序）、`DEFAULT_BEAD_STYLE:63` | TS 模块（纯函数） | **整套珠面形态** | **低**——这就是现成的珠体换肤通道（snapshot.beadStyle → options.styleId）；皮肤可携带 `beadStyleOverride` |

### 2b. legacy-ten 旧十层（对照臂，`bead-styles/legacy-ten.ts`）

| 层 | 可变参数（真源） | 值形态 | 难度 |
|---|---|---|---|
| L0a 接触阴影 | `BEAD_CARD.contactX/Y/W/H/RadiusScale`（`tuning.ts:1471-1475`）、`BEAD_CONTACT_SHADOW_ALPHA 0.12`（`palette.ts:349`） | 比例 + α | 中——但 facet-4 下**无承载体**（0 真 α），入肤无意义；⛔ 不动（封箱腿 1 锁 96 例） |
| L0b 投影 | `BEAD_SHADOW_HEX #1E2033`（`palette.ts:337`）、`BEAD_SHADOW_ALPHA 0.15`、`_SELECTED 0.40`（`:338/345`）、`shadowDy` | hex + α + 比例 | 中——hex 属 shadow_ink 族（tokens.md 换值 #3D2E1E）⇒ **应随 UI 令牌收编**（见 §4）；但该墨当前唯一珠面消费者是对照臂/`18` 孔描边 |
| L1 主体 | 端点表 `base`（随墨水） | hex | 高（配色主题，同 §1） |
| L2′ 侧壁 | `BEAD_CARD.wallRatio 0.1`、`wallDarkMix −0.42` | 比例+系数 | 中 |
| L2×2 / L3×2 倒角 | `BEAD_BEVEL_DARK_MIX −0.26`、`BEAD_BEVEL_LIGHT_MIX +0.28`（`palette.ts:372-373`）、`bevelInset*/Width*`（`tuning.ts:1479-1485`） | 系数+比例 | 低——§1.9.7④ 明文的「材质主题唯一合法作用面」原初清单 |
| L3b rim | `BEAD_RIM_MIX 0.50`（`palette.ts:375`）、`rimInset/rimWidth` | 系数+比例 | 低（同上） |
| L4a/b/c 软高光 | `BEAD_HIGHLIGHT_HEX #FFFFFF`（`:351`）、`BEAD_SOFT_HIGHLIGHT_ALPHAS [0.08,0.16,0.3]`（`:365`）、`BEAD_CARD.softHighlight` 三矩形（`tuning.ts:1514-1518`） | hex+α 数组+比例 | 中——§1.9.7② 硬纪律：α **只可下调不可上调**；形（矩形比例）可换 |

### 2c. `18`/`13` 两套池内风格
`LINEART_*` 系数组（`tuning.ts:1744-1773`：`LINEART_MIN_STROKE`〔PT-SKIN-02 A/B 位〕、比例 0.06、偏移/带宽/α 0.22 等）与 `13` 复用 `FACET4_FACET_INSET`。难度=低（系数型），但它们是**风格**不是**皮肤**维度；皮肤若换默认风格即整体生效，不建议皮肤再逐系数覆写它们（正交性破坏）。

## 3. 格 / 槽 / 盘面

| 元素 | 当前定义位置 | 值形态 | 可替换维度 | 难度 |
|---|---|---|---|---|
| **B0 连续目标色底图** | `bead-render.ts:473`（`drawTargetTile`）：fill = `endpointOf(inks,ci).edge`、`TILE_BLEED 0.5`（`tuning.ts:296`） | 端点派生色 + 定值 | 色（随墨水/端点） | 低——已随 inks 参数化；TILE_BLEED 是接缝实测校准值 ⛔ 不动 |
| **空槽内阴影阶梯**（4 层同心 rect） | `bead-render.ts:1116-1135`：墨 = `endpoints.shadeOuter/shadeMid/hole/pit`、带宽 `SOCKET_CARD.innerShadeStepDp 1` | 端点族色 + 定值 dp | 色调（随端点系数）/形 | 低（色）/中（形，动阶梯=动图元数 ⇒ 封箱已登记的 +360/+204 插入差须归因） |
| S3 暗线 / S4 亮线 | `bead-render.ts:1149-1166`：`endpoints.hole` / `endpoints.lit`、宽 `SOCKET_CARD.shadeWidth/litWidth 2.5/64`、`pitInset 0.06` | 端点色 + 比例 | 色（随端点） | 低 |
| 中性槽锚（盘面 `slot` / 托盘 `traySlot`） | `bead-render.ts:1050-1052`（`trayZone` 分流）+ `neutralEndpoints:1173` | palette 实例字段派生 | **色** | **低（样板判例已成立）**——WXG-T-261 已把托盘槽底参数化（`palette.traySlot`），证明「槽族换肤 = 换 BeadsPalette 实例」可行 |
| 坑外廓 `relief 0.07`、`tintBaseInset/Radius` | `tuning.ts:160/146-148`（`SOCKET_CARD`） | 比例 | 形 | 中——用户逐轮裁定物（「坑底边与珠面描边对齐」「托盘槽轮廓外不要有颜色」），入肤=再开裁定链，⛔ MVP 不入 |
| **locked 锁定格**（斜纹） | `bead-render.ts:1200`（`drawLockedBead`）：`palette.locked #B9B4CC` + hatch=`withAlpha(palette.background,0.9)` | palette 实例 | 色/形 | 低（色已实例化）；斜纹 45° 形=tokens.md 未覆盖 ⛔ 不扩 |
| **hint / wrong 状态环** | `bead-render.ts:1226`（`drawStateRing`）：stroke 由调用侧传 `palette.hintBlue / palette.danger`；α/线宽由 fx 包络 | palette 实例 + tuning 包络 | 色 | 低——已实例化 |
| **selected 抬起** | `tuning.ts:1101`（`SELECT_LIFT_PX 6`）、`SELECT_LIFT_ANGLE 15`、`SELECT_LIFT_MS 200`、`SELECT_LIFT_STAGGER 0.35`、`LIFT_SHADOW_ALPHA 0.52`（`:1136`）、`BEAD_CARD.liftScaleGain/liftRef/liftShadowBite` | 定值+比例+ms | 形/动 | **高**——「丁案 6→11」曾被封箱腿 1 架构级阻塞（96 例全变，K.5.1 复评通道）；入肤=每肤一套封箱档案段。⛔ 不入肤（见 §5 动效结论） |
| **托盘**（槽 48/缝 6/面板垫/微拱白瓷内阴影） | `tuning.ts:424-463`（`TRAY_SLOT/TRAY_GAP/TRAY_PANEL_PAD`）、`TRAY_PLATE:164`（ink `#1E2033` + 三段 α） | 定值 + hex + α | 色（ink）/形 | **ink=低**（tokens.md 已裁换 `shadow_ink #3D2E1E` ⇒ 收编进 tokens）；几何=高（§3 冻结 + WXG-T-261 刚裁定）⛔ |
| 缩放控件 / 道具卡 / 各面板几何 | `tuning.ts` §3.8 族（`POWERUP_CARD_*`、`PANEL_SIZE`、`PAUSE_PANEL_H`…） | 定值 | 形 | **高**——命中判定共用同一份（防漂移判例 `gridLayoutFor`），⛔ 不入肤 |
| 托盘珠 / 小豆档 | `BEAD_DRAW_INSET 2` / `_SMALL 3`（`tuning.ts:72/99`）、`hideHole`、`maskGauge` | 定值+枚举 | 形 | 高——inset 与 holeRatio 硬约束②对冲，⛔ |

## 4. UI 令牌（tokens.md 全表 → `BeadsPalette`）

> **现状核对（关键）**：`BeadsPalette` 已是**实例注入**——`beads-game.ts:631`（`options.palette ?? DEFAULT_PALETTE`）、`beads-shell.ts:114` 同型，`buildBeadsView(builder, snap, palette, inks)`（`view-model.ts:225`）全链逐参传递，**view 层不 import DEFAULT_PALETTE**（唯一例外：`CONFETTI_COLORS` 在模块级 freeze 时引用了 `DEFAULT_PALETTE.panel`，`palette.ts:392`——见下收编清单）。⇒ 「UI 令牌进 tokens 单源」= ① 扩 `BeadsPalette` 接口（tokens.md 新增字段）② 提供每肤一个实例 ③ 收编残留模块级 hex。

| 令牌组 | 消费现状 | 难度 |
|---|---|---|
| `bg_base / panel / panel_border / slot / slot_border / tray_slot / slot_dashed / locked / text / textDim / accentPrimary / accentPurple / success / danger / hintBlue / adBadge / banner*`（18 字段） | **已实例注入**（`BeadsPalette` 全字段有消费者） | **低**——换肤=换实例；`DEFAULT_PALETTE` 即「默认肤」 |
| tokens.md **新增字段**：`wood_face/pressed/disabled/edge/sheen/text/text_disabled`、`card_pressed/disabled/border`、`text_disabled`、`shadow_ink` | 尚无承载——`BeadsPalette` 需扩 ~11 字段；按钮按下/禁用态当前用硬编码逻辑（`meta-view.ts::drawButton`） | 低-中（字段+消费点接线；色表锁计数随之变动，走 art 同步快照通道，判例 v1.5-r21 34→35） |
| `radius_* / stroke_* / space_* / font_*`（tokens.md §2–§5） | 圆角/线宽/字号当前是 `view-model.ts`/`meta-view.ts` 内局部字面量（如 radius 14/16/24） | 中——需逐消费点收编成 palette 扩展或独立 tokens 表；**建议批 1 只转正「已定稿换值」的 hex，几何类令牌随 UI 重构批走** |
| 文案令牌（tokens.md §7：`app_name` 等） | 未令牌化 | 低-中；**建议不入肤**（文案=品牌非主题） |

**残留模块级 hex 收编清单（批 1 必做）**：

| 常量 | 位置 | 处置 |
|---|---|---|
| `TRAY_PLATE.ink #1E2033` | `tuning.ts:165` | → tokens 新字段 `shadowInk`（= tokens.md `shadow_ink`）|
| `CONFETTI_COLORS`（freeze 时引 `DEFAULT_PALETTE.panel`） | `palette.ts:392` | → 改为按 palette 实例派生的函数（`confettiColors(palette)`）或入肤数据 |
| `PANEL_SCRIM_RGB (42,46,67)` | `tuning.ts:917` | **不动**——= `text_primary`（tokens.md 承，不改）⇒ 换肤不改它；登记「若未来皮肤改 text_primary 则须派生化」 |
| `POWERUP_INK_* / EXPAND_BTN_INK / EXPAND_BTN_TEXT` | `palette.ts:495-517` | **不动**——§1.3/§1.4 资产色判例明文「不是主题 token」；但 `ad_badge 底` tokens.md 裁换 `wood_face` ⇒ `POWERUP_BADGE` 底色消费点改读 `palette.adBadge`（已是）⇓ 实际只差 wood 化的 token 换值 |
| `STAR_GOLD / CONFETTI 常量` | `palette.ts:385` | 承（资产色）；彩带 5 色若入肤随 `CONFETTI_COLORS` 收编一并处理 |
| `BEAD_SHADOW_HEX / BEAD_HIGHLIGHT_HEX` | `palette.ts:337/351` | 消费者仅 legacy 臂/`18` ⇒ **锁默认肤不动**（封箱腿 1 保护对象） |
| `DEBUG_OUTLINE_*` | `palette.ts:357-358` | 不动（诊断用） |

## 5. 动画参数（GROUP_LAND / FILL_POP / WRONG / 波浪等）——**建议全部不入肤**

`tuning.ts:1052-1400`（`FILL_POP_*`、`SELECT_LIFT_*`、`GROUP_LAND_*`、`WAVE_*`、`COLOR_WAVE_*`、`WRONG_*`、`SWEEP_*`、`CONFETTI_*`、`DENIED_*`、`HINT_PULSE_MS`…）。

**建议与理由（三点）**：
1. **语义**：动效是**交互反馈语言**（ux-spec §5 真源、≤3Hz 红线、D1 可访问性退化链），不是「视觉身份」——换肤换手感会破坏肌肉记忆与 `reduceMotion` 判据的完备性。
2. **成本**：几乎每个值都带用户逐批裁定史（`SELECT_LIFT_PX` 丁案曾遭封箱架构级阻塞、`GROUP_LAND_TOTAL_MS 200` 是用户硬上限）；入肤 = 每肤重走整条裁定 + 封箱档案段链。
3. **例外口**：若某肤确需差异化手感（如「手绘蜡笔」要更弹），只允许走「**整包覆盖 + 新 ADR**」，且⛔ 不得只覆盖毫秒不覆盖包络（包络与毫秒是同批裁定物）。

**布局/命中/冻结常量**（`PUZZLE_BAND`、`TRAY_BAND`、`BEAD_PITCH`、`GRID_HIT_SIZE`、§3.10 冲刺系数…）：⛔ 永久排除面（玩法域，非呈现域）。

---

## 6. 与封箱体系的接口（盘点侧小结）

| 封箱件 | 锁的对象 | 多肤影响 |
|---|---|---|
| 色表锁（`bead-render.test.ts`：35 条 hex + sha1） | `palette.ts` hex 字面量集合 | 皮肤数据若住 `config/`（先例 `palettes-data.ts` 持 hex）⇒ 不动 palette.ts 字面量集；`BeadsPalette` **接口扩字段**（默认值仍写在 palette.ts）会 +条数 ⇒ 走 art 同步快照通道 |
| `bead-style-seal.test.ts` 四腿 | 默认肤（`DEFAULT_PALETTE` + `DEMO_BEAD_INKS` + facet-4）的命令流 sha / 整帧 kinds+total+sha | 方案见 arch.md D3：腿 1–4 只跑默认肤；非默认肤走**相对快照**（kinds/total 恒等 + sha 归因注） |
| `bead-cell-standard.test.ts`（J1–J7） | 珠面/格内占比几何 | 不受纯墨肤影响；系数入肤（批 2）须复验 J4/J7 |
| `bead-style-pool.test.ts` C4 裸系数扫描 | 风格模块内禁 `mix(…,字面量)` | 皮肤模块同口径纳入扫描（防第二把尺子） |
