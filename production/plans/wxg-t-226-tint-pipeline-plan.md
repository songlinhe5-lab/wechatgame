# WXG-T-226 · 珠面/格面 tint mask 正式管线接入方案（含 Epic/Story 拆分）

- **执笔**：程基岩（engineering-lead） · **日期**：2026-09-29 · **任务号**：**WXG-T-226**（P0 关键路径）
- **状态**：**方案件——未落码**。本单只交付「方案 + 拆分」，⛔ 未获主理人批准前不动 `packages/framework/src/**` 与 `games/beads/src/**`。
- **派单原话范围**：把定稿 v1.1 / v1.0-holeless 接入正式管线——① `drawFilledBead`/`drawEmptySocket` 走 tint 路径、② `makeBeadRecipe`/`makeCellRecipe` 改产 d/l mask、③ 有孔/无孔双档位切换（豆径档驱动）、④ 包体与性能估算、⑤ 风险与回滚。

> ## ⛔ 本单三条铁律（贯穿全文，逐条不得违反）
> 1. **不改定稿数值**。定稿口径正本 = `tools/mask-preview/export-cocos-textures.py`（有孔 v1.1）+ `export-cocos-textures-holeless.py`（无孔 v1.0-holeless）；本文所有数值**逐字引用**这两个脚本与 `games/beads/art/cell-standard-{holed,holeless}.md`，**不发明、不"顺手优化"**。
> 2. **不动 `LIMITS`/判据**。包体阈值只引 `systems-index §3.9`；判据只引既有 §8 / J1–J7 / C1–C12 / ADR-0028 §5，**不新增硬判据**（新增判据属 QA/美术域，另单）。
> 3. **不提交代码**。本文不动任何源码；落码另单、经主理人批准。

---

## 0. 阅读约定与口径真源

### 0.1 真源清单（本单全部结论的出处）

| 口径 | 正本 |
|---|---|
| mask 烘焙口径（有孔 v1.1） | `tools/mask-preview/export-cocos-textures.py`（头注冻结块） |
| mask 烘焙口径（无孔 v1.0-holeless） | `tools/mask-preview/export-cocos-textures-holeless.py`（头注冻结块） |
| 几何/占比确认值 | `games/beads/art/cell-standard-holed.md` / `cell-standard-holeless.md`（母体 `cell-standard.md` 的 J1–J7） |
| 路线决策 | `docs/architecture/adr/ADR-0028-beads-grayscale-mask-tint.md`（现行目标路线，T1'–T4' 未证） |
| 层数据（DEC-4 同源直读） | `tools/mask-preview/capture-layers.mjs` → `layers.json` / `layers-holeless.json` |
| 运行时视图层 | `games/beads/src/view/bead-render.ts`、`view-model.ts::drawGrid/drawTray` |
| 烘焙 recipe 工厂 | `packages/framework/src/core/bake/bake-recipes.ts` |
| 控制清单 | `docs/architecture/control-manifest.md`（L1–L5、§8 渲染、§19 珠面烘焙管线） |

### 0.2 符号与缩写

- **mask**：系数图，编码 **R=d（暗系数）/ G=l（亮系数）/ B=形状 / A=255**（A=255 免疫 Trim；起因 = 3.x 自定义 effect 下引擎不绑定 `cc_spriteTexture`，形状 α 必须自带）。
- **d/l**：ADR-0028 §2.1 的封闭解 —— 暗端 `base·d`（`d = 1−k`）、亮端 `base + l(1−base)`（`l = k`）；合成式 **`out = base·d + (1−base)·l`**。
- **档（gauge）**：`holed`（满豆/有孔，`BEAD_DRAW_INSET=2` ⇒ 珠面 26dp）/ `holeless`（小豆/无孔，`BEAD_DRAW_INSET_SMALL=3` ⇒ 珠面 24dp），由 `snap.beadSize`（`BEAD_SIZE_FULL/SMALL`）驱动。
- **kind**：`bead`（珠面）/ `cell`（格面=空格凹槽，含格外）。
- **臂**：矢量臂（现役，逐层回放层集）/ 烘焙臂（`_bakeRuntime`，**已冻结的历史归档臂**）/ **tint 臂（本单新增，未注入即不存在）**。

### 0.3 环境事实（做不到的明说）

- **无 wx 真机** ⇒ ADR-0028 §5 的 **T2'（wx composite 支持与质量）/ T3'（命令带宽账实测）/ T4'（低端机帧时间）全部不属本单**，一律登记 `DEFERRED — 需真机`，⛔ 禁止伪造证据。
- **Cocos 编辑器可用**（探针已通、`.effect` 已实测出图）⇒ 桌面 web 预览可作 **`[N]` 桌面档旁证**，但按 K-037「指令流可证 ≠ 屏幕层可证」**不得抬升为结论**。
- **`pnpm run harness:build` 可用** ⇒ Canvas2D 通道（harness）是本单唯一可端到端实跑的渲染通道。
- **`build:wx` 构建链未通**（`games/beads/cocos/build/wechatgame/` 不存在）⇒ **包体实测（④的入包后字节）不可做**，只能给资产侧实测字节 + 入包后待实测。

---

## 1. 现状盘点（落笔前的事实基线）

### 1.1 现役渲染通道与命令流

| 项 | 事实 | 出处 |
|---|---|---|
| 生产渲染器 | **Cocos**（`CocosRenderModelRenderer`，**一块 `cc.Graphics` 承载全 UI**）；`canvas2d` 适配器**只有 dev/harness 在用** | `packages/framework/src/adapters/cocos/cocos-renderer.ts`；`adapters/` 下仅 cocos + canvas2d 两个 |
| `blit` 命令 | ADR-0026 已落（`{kind:'blit', textureId,x,y,w,h,alpha?}`）；**Cocos 侧静默跳过**（`Graphics` 不支持 `drawImage`）+ 一次 warn | `cocos-renderer.ts:201-211`、ADR-0026 §3.3 |
| 已填格现役 | **7 命令 / 0 真 α**（B0 rect 1 + plate 1 + polygon 4 + 孔 1） | `bead-visual-style-spec §13.12` |
| 空格现役 | **7 命令 / 0 真 α**（B0 1 + 内阴影 4 rect + S3 暗线 + S4 亮线） | 同上（r8 后读数） |
| 烘焙臂 | `_bakeRuntime` 注入槽在，但 **灰度从未开启**（无生产调用方）；八裁定为历史归档、不演进 | `bead-render.ts:109-165` |
| 豆径档 | `snap.beadSize` ⇒ `sizeSmall` ⇒ `beadDrawInset`（2/3）+ `hideHole`；**托盘珠不随档**（恒满幅、恒有孔） | `view-model.ts:851-852,983,1203-1206` |

### 1.2 资产现状（实测字节，本会话 `ls -la` 实读）

| 文件 | 字节 |
|---|---|
| `bead-tint-128-mask.png`（有孔珠） | 8 750 |
| `grid-tint-128-mask.png`（有孔格） | 3 395 |
| `bead-holeless-tint-128-mask.png`（无孔珠） | 4 281 |
| `grid-holeless-tint-128-mask.png`（无孔格） | 2 808 |
| **4 张 mask 小计** | **19 234 B ≈ 18.8 KB** |
| 4 张 `*-base.png`（Sprite 占位） | 6 365 B ≈ 6.2 KB |
| **八件套合计** | **25 599 B ≈ 25.0 KB** |

- 已入库：`games/beads/cocos/assets/textures/`（8 个 PNG + 8 个 `.meta`，`.meta` 由编辑器生成，合 L1）。
- 旧位图产物（S3-lite，逐色）：`games/beads/assets/{bead,cell}/levels/*.png` 共 4 张 ≈ 32 KB，**ADR-0027 S3-lite 明定「不进主包 / 不入分包」** ⇒ 当前零包体影响。

### 1.3 合成公式的现役参考实现

- Cocos 侧：`games/beads/cocos/assets/effects/tint-mask.effect`（`d=mask.r / l=mask.g / shape=mask.b`、预乘 α、`blendSrc:one`，编辑器 web 预览已出图）+ `scripts/spike/tint-mask-sprite.ts`（`getMaterialInstance` + `Vec4` 0–1 值域）。
- Studio 侧：`apps/beads-studio/public/board-render.js` —— **格底（B0 tile ×0.70 / 空槽 grid 合成）+ 珠合成纹理**、格满铺无缝、渲染画布 = 格数 × 128px。合成式与 shader 同款（`rgb = c·d + (1−c)·l`、`a = shape`）。**这是运行时要照抄的语义（结构同构、非代码复用）**。
- ⚠ `games/beads/src/view/tint-mask.effect` 是**旧编码**（RGB=d / A=l），与定稿三通道编码不一致 ⇒ 属待清理的旧件，⛔ 不得当作现行 shader 引用。

### 1.4 守卫现状（本单的前置债）

| 守卫 | 现状 | 对本单影响 |
|---|---|---|
| 包体守卫（S0） | `check-bundle-size.mjs` 在，但 **beads 侧产物不存在 ⇒ STATUS: SKIP**；内部目标脚本内硬编码 2000（`§3.9 v1.51` 已裁定合流 4096，脚本未跟进） | **`control-manifest §19`：包体守卫未归位前禁止向主包投放位图** ⇒ ④ 入包是**硬前置未解除** |
| `bake:check` 漂移守卫 | **未建**（ADR-0027 S4 欠账） | ② 的 mask 漂移守卫需与它同批建，否则「层集改了、mask 没重出」= 线上旧皮 |
| 封箱基准（`bead-style-seal`） | 在；K-082：**视觉改动 ⇒ 封箱腿红是预期**，唯一合法通道 = 复评归因 | tint 落码必然触发 ⇒ EP12-S6 必含复评 |
| C7 双指标门 | 命令 ≤7 / 真 α ≤2，统计域 = 珠体图元 | tint 臂下图元消失 ⇒ **判据当场不可执行**（K-088）⇒ 必重设 |

---

## 2. 方案总览

```
   定稿 py（口径正本·冻结）                现役层集（DEC-4 真源）
            │                                      │
            └──────────► MaskSpec ◄────────────────┘   ← ② 的收敛点（几何+系数+程序化参数，纯数据）
                           │
              ┌────────────┴────────────┐
              │                         │
    TS 场计算（core·纯数学）        py 定稿导出（现状唯一产出源）
    computeBeadMaskField /         （4 张 128px PNG）
    computeCellMaskField
              │                         │
              └──────► 对拍门禁 mask:diff ◄┘        ← 零漂移的唯一机械保证
                           │
                    资产入库（4 张 mask）
                           │
   ┌───────────────────────┴───────────────────────┐
   │ 运行时（① tint 臂，注入槽未注入 = 不存在）      │
   │  drawFilledBead  → blit(bead-mask, tint=base)  │
   │  drawEmptySocket → blit(cell-mask, tint=base)  │
   │  B0 tile         → 仍 rect(edge −0.30)（保留） │
   │  孔              → mask B 通道真透 ⌀12（不 live）│
   └───────────────┬───────────────┬───────────────┘
                   │               │
        Canvas2D（harness）    Cocos（生产）
        CPU 预合成 + LRU       自定义材质（单 pass）
                              候选：整盘单图元（推荐）/ Sprite 池
```

**三条不可逆的结构性事实（本单全部设计的起点）**：

1. **Cocos 侧没有纹理载体** —— `Graphics` 不能画 image，`blit` 在 Cocos 被静默跳过 ⇒ tint 在**生产通道**上能否成立，取决于新增载体（§3.4）。这是本单最大的工程风险，也是必须先立 ADR 的原因。
2. **`RenderModelBuilder` 不能写通道** —— 它只产 `rect/circle/polygon/line/text` + 颜色，`makeBeadRecipe` 的"画到 builder"形态**产不出 R=d/G=l/B=shape** ⇒ ② 不是"改输出对象"，而是**新增一条栅格化路径**（§4.1）。
3. **Canvas2D 两路合成在现行三通道编码下没有直路** —— 一次 `drawImage` 只吃 RGB；`multiply` 用 R=d ✔，但 `screen` 需要 `l`（在 G 通道）**取不到**（ADR-0028 §2.1 写的是"双通道 RGBA：RGB=d / A=l"，而定稿已改三通道）⇒ Canvas2D 侧务实解 = **CPU 预合成 + 有界 LRU**（§3.4.1）。

---

## 3. ① `drawFilledBead` / `drawEmptySocket` 的 tint 路径接入

### 3.1 目标命令流（每格）

| 格态 | 现役（矢量） | tint 臂（单 pass） | tint 臂（Canvas2D 两路，不采用，见 §3.4.1） |
|---|---|---|---|
| **已填格（有珠）** | B0 rect 1 + 珠 6 + 孔 1 = **7** | B0 rect 1 + `blit(bead-mask, tint=珠 base)` 1 = **2** | B0 1 + blit 2 = 3 |
| **空格** | B0 1 + 内阴影 4 + 明暗线 2 = **7** | B0 rect 1 + `blit(cell-mask, tint=本格 base)` 1 = **2** | 3 |
| 托盘珠 | 6 | `blit(bead-mask holed, tint=base)` **1** | 2 |
| 托盘空槽 | 5 | **保持矢量**（理由见 §3.6） | 5 |
| 锁定格 | 3 / 2 α | **保持矢量**（`drawLockedBead`，无 mask 档） | 3 |
| 状态环 / 抬起影 | +1 / +1 | **保持矢量**（live 层，不进 mask，同 ADR-0025 DEC-3 判例族） | +1 |

- **B0 底图 tile 保留 rect** 的理由（不可省）：mask 是**格径 30dp**（128px）而 B0 是 **pitch 32dp 满铺**；`pitch − cell = 2dp` 的缝隙没有 mask 覆盖，且 §19 明令 **⛔ 运行时放大烘焙纹理** ⇒ 不得把 30dp 的 mask 拉伸到 32dp。B0 rect 同时承担「相邻无缝」与「孔内真透的下层色」两职。
- **孔真透**：mask B 通道在孔区 = 0（有孔档真透 ⌀12，孔缘 0.5dp smoothstep 羽化）⇒ 珠 blit 后孔区透明 ⇒ 透出下层 **B0 tile（本格 `edge = mix(base, −0.30)` = 0.70×target）** ✔ 与 studio 定稿 v1.1「有珠格底 = B0 tile ×0.70、无坑」**结构同构**。
- **⚠ 口径变化（未决，见 §11-Q2）**：现役 K3 是「孔底透出目标格 `pit`（−0.44）」（`bead-render.ts:594` live circle）；tint 制下孔底透出的是 **B0 tile 的 `edge`（−0.30）**，且**托盘珠的孔由 live `pit` 变透明**。这是**观感与判据的分叉**，不由工程侧代拍。

### 3.2 注入槽与臂选择序（保持「矢量臂恒在」铁律）

在 `bead-render.ts` 与既有 `_bakeRuntime` **并列**新增（同型、同文件、同"未注入即不存在"语义）：

```ts
/** mask 档位：holed = 满豆有孔(26dp/⌀12) · holeless = 小豆无孔(24dp)。 */
export type BeadMaskGauge = 'holed' | 'holeless';
/** 面种：bead = 珠面 · cell = 格面（空格凹槽 + 格外 0.70）。 */
export type BeadMaskKind = 'bead' | 'cell';

export interface BeadTintRuntime {
  /** 未注册（风格无 mask / 档未烘）⇒ 返回 undefined ⇒ 矢量回退（control-manifest §19 纪律）。 */
  getMaskId(kind: BeadMaskKind, gauge: BeadMaskGauge, styleId: string): string | undefined;
}
let _tintRuntime: BeadTintRuntime | undefined;
export function setBeadTintRuntime(r: BeadTintRuntime | undefined): void { _tintRuntime = r; }
```

`drawFilledBead` / `drawEmptySocket` 的臂选择序（**自上而下，命中即返回**）：

1. `_tintRuntime` 已注入 ∧ `getMaskId(...)` 命中 ∧ 非 `_baking`（防 recipe 回调递归，同既有个 `_baking` 卫兵）⇒ **tint 臂**；
2. 否则 `_bakeRuntime` 已注入 ∧ 非 `hideHole` ⇒ **烘焙臂**（历史归档臂，**代码一行不改**）；
3. 否则 ⇒ **矢量臂**（输出与今日**逐字节相同**）。

⇒ **回滚 = 不注入 `setBeadTintRuntime`**（一行），矢量臂恢复、零删除、零数据迁移（§7.3）。

### 3.3 `RenderModel` 通道扩法（两选项，推荐 B）

| 选项 | 形态 | 评价 |
|---|---|---|
| **A** 位置式第 7 参：`blit(id,x,y,w,h,alpha?,tint?)` | 零破坏（既有 1 处调用与测试不变）；`BlitCommand` 增可选 `tint?: string` | 最小侵入，但 7 参可读性差、后续扩 `mode` 需再加参 |
| **B（推荐）** 选项对象：`blit(id,x,y,w,h,opts?: { alpha?: number; tint?: string })` | 既有 1 处位置式 `alpha` 调用需改（`bead-render.ts:589`），**TypeScript 编译期即可捕获**；`undefined` 字段不落 `JSON.stringify` ⇒ **既有 seal 基准零漂移**（本仓既有先例：`stroke` 透传同此技巧） | 可读、可扩展（`composite`/`mode` 后续加字段不破签） |

两条共同不变式：
- **`tint` 只存字符串**（hex），core 层不持引擎对象（L2）；
- 热路径零分配（C2）：`opts` 走**模块级 scratch 对象复用**（同现役 `styleInput` 槽写法），⛔ 每珠每帧新建字面量；
- 真 α 计数口径不变（K-086）：`tint` **不**计入 α 层数（它是颜色不是透明度）。

### 3.4 两适配器的实现形态

#### 3.4.1 Canvas2D（harness 通道）—— **CPU 预合成 + 有界 LRU**

- **为什么不走两路 `multiply`/`screen`**：定稿编码是 `R=d / G=l / B=shape`，而 `drawImage` 只能把 **RGB** 当源色；`multiply` 吃 R=d ✔，`screen` 需要 `l`（在 G 通道）**取不到**（除非再烘两张 d-only / l-only 派生图 + 局部 `destination-in` 抠形 ⇒ 每珠 3–4 次操作 + 离屏，成本远高于合成一次）。⇒ **两路版在本编码下不成立**，如实登记。
- **做法**：`case 'blit'` 且 `cmd.tint` 存在 ⇒ 查 `(textureId, tint)` 合成缓存：
  - miss ⇒ 取 mask 的 `ImageData`，逐像素算 `rgb = base·d + (1−base)·l`（`d=R/255`、`l=G/255`）、`a = B/255`，**预乘 α** 后写入一张离屏 canvas ⇒ 注册进纹理表；
  - hit ⇒ 一次 `drawImage`（每帧零运算）。
  - **LRU 有界**：上限建议 **12 张**（12 × 128² × 4 B = 768 KB），超限 ⇒ **该珠回落矢量臂**（不是丢弃最旧，避免抖动；两个策略二选一，落码前定）。
- **诚实代价**：Canvas2D 侧**不适用**「DEC-7 内存题消解」的收益——合成缓存是**逐色**的（当前关色数 × kind × 档）。内存上界 = `min(色数, LRU上限) × 2 kind × 1 档 × 64 KB`。⇒ 该收益只在 **Cocos（GPU 单 pass）侧成立**；Canvas2D 侧收益只剩**命令数/三角数下降**。⛔ 不得把 Cocos 的内存账外推到 harness（K-054 同类纪律）。

#### 3.4.2 Cocos（生产通道）—— 必须先立载体，两候选

| 候选 | 形态 | draw call | 依据 | 评价 |
|---|---|---|---|---|
| **甲** Sprite 池 + `tint-mask.effect` | 每珠一 Sprite 节点 + `getMaterialInstance` + `Vec4 baseColor`（0–1） | **+N（= 可见珠数）**；10×10=100、32×32=1024 ⇒ **不可接受** | `tint-mask-sprite.ts` 已在编辑器实测成立；`bead-field.effect` 已证预乘 α + `blendSrc:one` 必要 | 机械最小、复用已验 effect；**但自定义材质破合批，draw call 爆炸** ⇒ 只宜作过渡实证 |
| **乙（推荐主候选）** 整盘单图元 + 自定义 effect | 独立节点 + **一枚满幅 rect**，片元内按格解析：取「盘面数据纹理（一格一纹素：色索引 + 状态）」→ 色板 → 采样 mask（格内局部 UV）→ `out = base·d + (1−base)·l` | **+1**（ADR-0022 §11.2 D5 实测：v2 形态 `8/666 → 9/668`，整盘 10×10 = +1 draw call / +2 三角） | ADR-0022 §11.3 #2 载体②、#5（现役 21917 三角/帧 vs 载体② 2 三角）、#4（**格原点必须来自 `gridLayoutFor()`，硬约束**） | draw call 与现役同级、三角数降 4 个数量级；代价 = 新增「盘面数据纹理上传」通道 + 片元内格解析（**新子系统**） |

- **推荐路径**：**乙为主、甲为实证过渡**。先在编辑器 web 预览跑甲的桌面档出图旁证（`[N]`，不得记真机），同时按乙立项；**由 T4'（低端机帧时间）+ draw call 差分裁决**（ADR-0022 §11.2 D5 口径）。
- 乙 的额外约束（逐条登记，落码时逐条过）：
  - 布局 uniform（格原点/格距/圆角）**只能由 `gridLayoutFor()` 输出生成**（ADR-0022 §11.3 #4 硬约束，违反 = 画的不等于点的，K-054 判例族）；
  - 色板走**纹理通道**而非 uniform 数组（ADR-0022 §11.4 P-1：低端机 `MAX_FRAGMENT_UNIFORM_VECTORS` 只保证 16，且 WebGL1 下 UBO 摊平会膨胀，P-2）；
  - 珠外像素用 **α=0**（⛔ 不用 `discard`，P-4）；片元坐标传**格内局部坐标**（防 mediump 精度丢格索引，P-5）；
  - 色彩空间需**取色实算校准**（P-6，本单不做，归美术/QA）；
  - 珠场节点 sibling 序固定「背景之上、HUD 之下」（P-7）；
  - 首帧 program 编译尖峰 ⇒ 启动期预热一帧不可见 quad（P-3）。

### 3.5 档位与风格的寻址

```
maskId = getMaskId(kind, gauge, styleId)
  kind  = 'bead' | 'cell'
  gauge = (snap.beadSize === BEAD_SIZE_SMALL) ? 'holeless' : 'holed'   // 托盘珠恒 'holed'
  styleId 参与**白名单查表**：只有定稿过的风格有 mask（当前 = facet-4）
  ⛔ 未命中 ⇒ undefined ⇒ 矢量回退（control-manifest §19「未命中一律矢量回退」）
```

### 3.6 边界（本方案明确不做的面）

| 面 | 处置 | 理由 |
|---|---|---|
| 托盘空槽 | **保持矢量** | 定稿 grid mask 是「盘面格」口径（`beadInset>0` ⇒ `relief` 退 0、坑外沿=珠面）；托盘槽 `beadInset=0` 且 `TRAY_BEAD_SIZE 44 < TRAY_SLOT 48` **仍退一圈** ⇒ 两档不同形，无 mask 可对应（分叉已登记在 `cell-standard-*.md`） |
| 锁定格 | **保持矢量** | 无 mask 档，`palette.locked` 非端点族色 |
| 状态环 / 抬起影 / hint | **保持矢量** | live 层，依赖状态与时间 ⇒ 不满足 §13.11「入纹理四条硬判据」第 1 条（静态） |
| zoom / LOD | 本单不做 | 归 `zoom-bake-mip-validation`；⛔ 运行时放大烘焙纹理（§19） |
| 其余风格（`13`/`18`/…） | 矢量回退 | 只有 facet-4 有定稿 mask ⇒ **同屏可能出现「tint 珠 + 矢量珠」混用** ⇒ 观感一致性风险，登记（§7.1 R-8） |

---

## 4. ② `makeBeadRecipe` / `makeCellRecipe` 改产 **d/l mask**

### 4.1 硬约束：现有工厂形态产不出 mask

`BeadBakeRecipe = (builder, styleId, colorIdx, size) => void` 把结果**画进 `RenderModelBuilder`**，而 builder 只接受颜色 + 图元，**没有"写第 N 个通道"的能力**。且 mask 的**程序化段**（定稿 py 的余弦/facet 光照场、外框与孔边 1dp 斜面、槽口 SDF 3dp 斜面、孔缘 0.5dp 羽化、坑底定值）**根本不在层集里**，无法靠"回放层集"得到。

⇒ **结论**：不是"改 recipe 的返回类型"，而是**新增一条 mask 生成路径**，且它必须分两层：

```
① MaskSpec（纯数据）—— 几何层集（DEC-4 同源直读）+ 每层的 (d,l) 系数 + 程序化段参数
② MaskField（纯数学）—— computeBeadMaskField(spec, size) / computeCellMaskField(spec, size) → Uint8Array（RGBA 已编码）
③ 落盘/入库 —— 由 adapter（Canvas2D ImageData / 构建期脚本）把 Uint8Array 变成 PNG/纹理
```

### 4.2 `(d,l)` 系数从哪来（复用现役机制，不外造）

现役真源 = `capture-layers.mjs::buildDict`：**墨档字典 hex → {d,l}**，规则 `k<0 ⇒ d=1+k, l=0`；`k>0 ⇒ d=1, l=k`；`k=0 ⇒ d=1, l=0`。系数表 = `{0, FACET4_PLATE_MIX −0.44, FACET4_FACET_RIGHT_MIX −0.16, −0.30, −0.44 pit, −0.58 hole, −0.68 shadeMid, −0.80 shadeOuter, +0.38 lit}`。

⇒ **正本必须上移**：该字典现在只活在 `tools/mask-preview/capture-layers.mjs`（tools 层、不进构建、无单测）⇒ 升到 `games/beads/src/view/`（或框架 `core/bake/mask-ink-dict.ts`）并**加单测**（K-042：几何单一真源化后需另配不依赖该真源的不变量守卫——此处守卫 = 字典完备性：层集里出现的每个 hex 都能在字典里查到，查不到即红，防"内阴影整段塌成 d=1"复发）。

### 4.3 三个选项（推荐 丙：渐进）

| 选项 | 做法 | 优 | 劣 | 结论 |
|---|---|---|---|---|
| **甲** 单一产出源 = py（现状） | TS 侧**只读** 4 张 PNG；不写场计算 | 零移植风险、定稿数值只在一处 | 层集改了 mask 不会自动跟（**违反 DEC-4"层集即配方真源"**）；失效纪律退化为人工 bump；无 Node 侧可测性 | 短期可用，**不宜为终态** |
| **乙** TS 移植 + 对拍门禁 | 把 py 的 (a) 层集直读 + (b) 程序化段**逐式移植**进 TS；新增 `mask:diff` 守卫（py 产物 vs TS 产物逐像素/ΔE 对拍） | DEC-4 同源、CI 可守、可单测 | 两套实现**天然漂移**（K-051：规格数值是立项时点推论，落码须复算）；对拍容差需登记 | 推荐**中期形态** |
| **丙（推荐）** 先甲后乙，spec 化收口 | ① 先按甲交付（py 出 4 张 PNG 入库，运行时只读）⇒ 尽快可跑；② 同步把定稿口径常量从 py 头注**搬进 `MaskSpec`**（**只换载体、不改数值**），py 改为只消费 spec（`layers.json` = spec 序列化）；③ TS 场计算落地 + 对拍绿 ⇒ 切换产出源为 TS | 单一真源 + 零数值变更 + 全程可跑 | 工期最长 | **推荐** |

- 对拍门禁口径（建议，落码前与 QA 对齐）：逐像素 `|Δ| ≤ 1/255`（均值）、最大 `≤ 2/255`（8-bit 量化尾，参照 ADR-0028 §5 已登记的「不透明芯 max 4.62 单点族」现象）；**编码不变式**单独断言：A=255 全幅、孔区 B=0（有孔档）、槽底 `0.70`（有孔）/ `0.32`（无孔）、格外 `0.70`、真透 ⌀12 / 外缘 ⌀14（有孔，J4 同偶）。
- `makeBeadRecipe` / `makeCellRecipe` **保留位图模式**（`mode?: 'bitmap' | 'mask'`，默认 `'bitmap'`）⇒ 旧调用方（`apps/beads-studio/public/bake-export.js`）零破坏；mask 模式下工厂返回 **`MaskSpec`**（不是绘制函数），由 `MaskSurface` 消费。⛔ 不在 core 里碰 canvas/平台 API（L2）。

### 4.4 旧产物与 schema 的兼容策略

| 对象 | 处置 | 依据 / 理由 |
|---|---|---|
| `games/beads/assets/{bead,cell}/levels/*.png`（S3-lite 4 张 ≈32 KB） | **保留、不删、不进包**，标注「逐色位图路线史 / 解剖样张」 | ADR-0028 §2.4、ADR-0027 §2.4 原话（"不废——它是解剖样张与 P1 兜底的工艺验证"）；S3-lite 已明定不进主包/分包 ⇒ 零包体影响 |
| `BAKE_SCHEMA_VERSION`（现 = 1） | **不 bump 语义**，另立 **`MASK_SCHEMA_VERSION = 1`** | 位图 key 仍含 `colorIdx`、mask key 不含 ⇒ 两套命名/失效纪律混在一个号上必然互相牵连（ADR-0028 §4 已预警"⛔ 拆成三次 bump 三次重烘"） |
| 命名 | `mask__<kind>__<gauge>__v<MASK_SCHEMA_VERSION>.png` | 与旧 `<style>__c<idx>__v1.png` 天然不冲突 |
| `bake:check`（未建） | mask 漂移守卫**并入同一守卫**，一次建两个模式 | ADR-0027 S4 欠账；分两次建 = 两套漂移口径 |
| 生成物入库 vs CI 产出 | **本单不代拍**（ADR-0027 §4.2 明列"本 ADR 不代拍"）⇒ 现阶段沿用现状（入库，`.meta` 由编辑器生成，L1） | — |

---

## 5. ③ 有孔 / 无孔双档位切换机制（豆径档驱动）

### 5.1 驱动链（复用现役，不新增第二把尺子）

```
BeadsSettings.beadSize（存档 S9）
   → snap.beadSize
   → view-model:  sizeSmall   = snap.beadSize === BEAD_SIZE_SMALL
                  beadDrawInset = sizeSmall ? BEAD_DRAW_INSET_SMALL(3) : BEAD_DRAW_INSET(2)
                  hideHole      = sizeSmall                        // 矢量臂：按 role 跳孔层
   → tint 臂:     gauge         = sizeSmall ? 'holeless' : 'holed'  // 选 mask 档
```

- **两条通道并行、互不改写**：矢量臂用 `hideHole + drawInset`（ADR-0023 DEC-7 同一条"基准 × 格径 / `BEAD_CELL`"等比通道）；tint 臂用 `gauge` 选 mask。**⛔ 不新增第二套档位真源**。
- **切换语义**：与风格切换同口径 —— **下一帧生效、零过渡**（`bead-visual-style-spec §12.4`，ux §5 动效表零新行）。
- **托盘**：珠恒 `holed`（与现役「托盘不随档、恒满幅、恒有孔」一致，ux §3.3 ④ / `assets-spec §7.11`）；托盘空槽恒矢量（§3.6）。

### 5.2 两档的不可混用点（落码必须逐条守）

| 项 | holed（v1.1） | holeless（v1.0-holeless） |
|---|---|---|
| 珠面 / 角 | 26dp / 8dp | 24dp / 7dp |
| 孔 | 真透 ⌀12、孔边线 1dp（−0.58 ⇒ d 0.42）、孔缘 0.5dp 羽化 | **⛔ 无孔**（J4 不适用）、无羽化段 |
| 本体 / plate / lit | 24dp / 0.56 / 0.38 | 22dp / 0.56 / 0.38 |
| 槽口 / 角 | 24dp（= 珠面 −1dp 防漏）/ 8dp | 22dp（= 24 − 2×1 防漏）/ 7dp |
| **槽底（分叉点）** | **= 格底色 0.70**（v1.1：孔真透 ⇒ 透色可辨 + 取放零跳变） | **= 0.32（−0.68）深坑保留**（无孔珠不透底 ⇒ 深度感全额） |
| 格外 | 0.70（−0.30） | 0.70 |
| 槽内边沿 3dp 斜面 | 背光（上+左+右）0.32 / 受光（下）0.70+lit | 同构同值 |

⇒ **槽底分叉是有意设计**（有孔=透色需求 / 无孔=深度需求），⛔ 落码时不得"顺手统一"。

### 5.3 通用口径（两档共用）

- 编码 **R=d / G=l / B=形状 / A=255**；**512 超采样 → LANCZOS ÷4 → 128**（⛔ 非整数比 LANCZOS 会把内容压到顶部 1/4，已踩）；**距离计算完成后再取整 dp**（r7 纪律）。
- 光照：珠 = 余弦连续场（峰 = 图像左上，`atan2` y 向下 ⇒ 峰角 225°）；格 = **facet-4 同构亮度场**（上 1.0 / 右 0.74 / 下 0.37 / 左 0）。外框受光提亮用 **UP_W 上扇隶属度**（与本体上亮扇同构 ⇒ 上段恒 0.38 无缝），⛔ 不用余弦（正上 0.85 与本体 0.38 差 0.06 = 接缝台阶）。
- 孔内 R/G 写环带公式的**连续延拓**（⛔ 不硬清零 ⇒ 免 LANCZOS 振铃红点圈）。

---

## 6. ④ 包体与性能估算

### 6.1 包体（资产侧 = 实测；入包后 = 待实测）

| 项 | 值 | 口径 |
|---|---|---|
| 4 张 mask（128px） | **19 234 B ≈ 18.8 KB** | 实测（`ls -la tools/mask-preview/cocos-assets`，2026-09-29 产物） |
| 4 张 base 占位 | 6 365 B ≈ 6.2 KB | 实测；**仅 Sprite 池方案需要**（Sprite 无 spriteFrame 不渲染）；走整盘单图元则**可省** |
| **合计（八件套）** | **25 599 B ≈ 25.0 KB** | 实测 |
| 占主包红线比 | **0.61%**（25.0 KB / 4096 KB） | `systems-index §3.9`：红线 4096 KB；**内部目标 v1.51 已与红线合流 ⇒ 缓冲为 0**，任何增量都直接顶红线 |
| 引擎打包后字节 | **[待实测]** | `build:wx` 未通 + 纹理导入格式（是否压缩）未知 ⇒ ⛔ 不得把 PNG 字节当入包字节（K-051） |

**入包位置建议：主包**。理由：珠面是**首帧必需**的核心视觉，走分包 ⇒ 异步到达前要么黑珠、要么先矢量后跳变（观感跳变 = `§13.13 T2` 类问题）。增量 0.61% 可接受。
**⛔ 硬前置（未解除则不得投放）**：
1. `control-manifest §19` —— 包体守卫未归位前禁止向主包投放位图；
2. ADR-0027 §5-2 —— `check:size` 仍 SKIP、或 A7 仍钉 `mainTargetKb === 2000` ⇒ 禁止投放（当前**两者都未解除**）；
3. `framework:sync` / `cocos:check` / `check:es5spread` 全绿（提交前硬门）。

### 6.2 128px 档位是否够（风险，非结论）

`tuning.ts` 行 263 的定档依据：**128 = `BEAD_PITCH` 32dip × dpr cap 2 × `CAMERA_ZOOM_MAX` 2.0**（用户 2026-09-28 拍板）。但 `control-manifest §17` 实测指出：**微信小游戏 dpr 无封顶**（web 封顶 2）⇒ **dpr=3 设备上最大绘制 ≈ 32 × 2.0 × 3 = 192 device px > 128** ⇒ 会触发「运行时放大烘焙纹理」（§19 明禁）。
⇒ 处置选项（**不代拍**，交主理人 + 美术）：① 出 192/256 档（字节 ≈ ×1.5–2.5 ⇒ 约 +10–30 KB，仍 <1%）；② 维持 128 并接受 ≤1.5× 放大（须实测观感 + 显式豁免 §19）；③ 走 zoom LOD 在高倍段降档/回矢量。归 EP12-S2 实测项。

### 6.3 内存

| 项 | 值 | 口径 |
|---|---|---|
| GPU（Cocos，4 张未压缩 RGBA8） | 4 × 128 × 128 × 4 = **256 KB** | 算术恒等（未测引擎是否走压缩纹理） |
| 对比逐色位图路线（DEC-7） | 35 色 × 2 张 × 128² × 4 ≈ **4.7 MB** | ADR-0027 DEC-7 原估算 ⇒ **降 ≈94.5%**，DEC-7 在 Cocos 侧消解 |
| Canvas2D 合成缓存（harness） | LRU 12 × 64 KB = **768 KB** | 本方案自设上界（可调）⇒ **该侧不享内存收益**（§3.4.1） |

### 6.4 性能（命令 / 三角 / draw call / fill）

| 维度 | 现役矢量 | tint（Cocos 整盘单图元） | tint（Cocos Sprite 池） | 口径 |
|---|---|---|---|---|
| 已填格命令数 | 7 | **1**（整盘）/ 2（按格 blit 计） | 2 | C7 上限 7 ⇒ 富余；但**整盘单图元下命令门失去判别力** ⇒ 判据重设（K-088） |
| 空格命令数 | 7 | 1 / 2 | 2 | 同上 |
| 三角数 | **21 917 / 帧**（实测） | **2 / 盘** | 2 / 珠 | ADR-0022 §11.3 #5；**[待落码复算]**（K-051） |
| draw call | 8（现役全 UI） | **+1（⇒ 9）** | **+N（不可接受）** | ADR-0022 §11.2 D5 实测口径 |
| 真 α 层 | 0（珠/槽） | 0（合成在片元内） | 0 | K-086 口径 |
| fill rate | 现役每像素 ≈1–2 pass（四棱互不重叠、0 α） | 每像素 1 pass | 每像素 1 pass | 两路合成版 = **翻倍**（ADR-0028 §2.3 生死线）⇒ **本方案不采用** |
| CPU（Canvas2D） | — | 首次合成 16 K px ≈ 亚 ms；其后每帧 0 | 同 | [估算，待实测] |

⛔ 以上**除命令数与三角数出处外均为纸面账**：T3'/T4' 未跑、无真机 ⇒ **不得当作性能结论引用**（ADR-0027 §3 第 7 条同纪律）。

---

## 7. ⑤ 风险、验证义务与回滚

### 7.1 风险清单（诚实登记，含环境阻塞）

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| **R-1** | **Cocos 侧无纹理载体**：`Graphics` 不能画 image，`blit` 静默跳过 ⇒ tint 在生产通道尚未成立 | **最高** | 先立 ADR-0029；走载体②整盘单图元（+1 draw call，已实测形态）；过渡期 tint 臂只在 harness 可见（生产仍矢量） |
| **R-2** | Sprite 池 draw call 爆炸（+N） | 高 | 仅作实证过渡；由 T4' + draw call 差分裁决，不达即上整盘单图元 |
| **R-3** | **孔底口径变化**：K3 由 live `pit`（−0.44）变 B0 tile `edge`（−0.30）；托盘珠孔由 `pit` 变透明 | 高（判据 + 观感） | **不代拍** ⇒ §11-Q2 交主理人/策划/美术；落码前必须有裁定，否则 tint 臂只做命令层、不做观感切换 |
| **R-4** | **mask 生成器双实现漂移**（py vs TS） | 高 | 对拍门禁 `mask:diff` + 编码不变式断言；spec 化收口（丙方案） |
| **R-5** | **判据不可执行**（K-088）：C7 命令门、C12「统计域 = 珠面族图元」在 tint 臂下当场失效 | 高 | EP12-S6 判据重设（C12 改纹理像素 argmax，§13.14 已预告）；⛔ 不得沿用旧式当已验 |
| **R-6** | 包体守卫未归位（`check:size` SKIP + A7 钉 2000）+ `bake:check` 未建 | 高（阻断入包） | 入包前置；两守卫与 mask 同批建（K-089：先证守卫能红） |
| **R-7** | **dpr 无封顶** ⇒ 128px 在 dpr≥3 + zoom 2.0 下被放大（§19 明禁） | 中 | §6.2 三选项，落码前裁定 |
| **R-8** | **风格覆盖 = 1**：只有 facet-4 有 mask ⇒ 其余风格矢量回退 ⇒ 同屏 tint/矢量混用观感不一致 | 中 | mask 白名单显式化；混用观感由美术评；⛔ 不得"偷偷"给未定稿风格烘 mask |
| **R-9** | 量化与 AA：ADR-0028 §5 已登记 AA fringe 最劣 **ΔE 11.3**（> T1「珠边缘 <5」线）、不透明芯 max 4.62 | 中 | T1' 本体未过 ⇒ 落码后必须复测并如实登记；⛔ 不得引 r9 探针为 T1' 已过 |
| **R-10** | 无真机 ⇒ T2'/T3'/T4' 全 DEFERRED | 中（环境阻塞，不可解除） | 一律写 `DEFERRED — 需真机 playtest`；桌面档只记 `[N]`（K-037） |
| **R-11** | `build:wx` 未通 ⇒ 入包后字节/包体差分不可实测 | 中（环境阻塞） | ④ 的入包字节标 [待实测]；EP12-S2 标 `[Blocked: 待构建]` |
| **R-12** | 旧件误引：`games/beads/src/view/tint-mask.effect` 是**旧编码**（RGB=d/A=l） | 低 | 明确标为待清理；现行 shader 只认 `cocos/assets/effects/tint-mask.effect`（三通道） |

### 7.2 验证义务（本单新增，判据只引既有）

| # | 义务 | 通过线（引既有，不发明） | 通道 | 状态 |
|---|---|---|---|---|
| **V-1** | mask 与颜色无关（`mask-stable` 同型：换 tint 色 ⇒ mask 字节不变） | ADR-0028 §2.1 核心主张 | Node（场计算纯函数） | 可跑 |
| **V-2** | 编码不变式（A=255 / B=形状 / 孔区 B=0 / 槽底按档 0.70·0.32 / 格外 0.70 / ⌀12·⌀14 同偶） | `cell-standard-holed/holeless` J4 + 定稿 py 头注 | Node | 可跑 |
| **V-3** | 静态等价（tint 合成 vs 矢量臂逐像素） | `§13.13 T1` 平均 ΔE < 2、珠边缘 < 5（**R-9 已知未达项须如实登记**） | harness（浏览器 CPU 合成） | 可跑（非真机） |
| **V-4** | 命令流（tint 臂命令数 / 真 α 数 / `tint` 字段透传） | `§12.2 C7`（≤7 / ≤2）+ `C2` 零分配 | Node | 可跑 |
| **V-5** | 矢量臂逐字节不变（未注入 tint 运行时） | ADR-0026 §5 J-3 + K-082 | Node + 封箱 | 可跑 |
| **V-6** | 档位切换（`full↔small` ⇒ maskId 变、几何不变、托盘恒 holed） | `S9§8-14~19` / `§12.2 C8` 参数化口径 | Node | 可跑 |
| **V-7** | 包体（`check:size` 实跑 + 差分登记） | `systems-index §3.9` 4096 KB | `[Blocked: 待构建]` | 不可跑 |
| **V-8** | T2' / T3' / T4'（wx 支持面 / 命令带宽 / 低端机帧时间） | ADR-0028 §5 | 真机 | **DEFERRED** |
| **V-9** | 守卫有效性（先证守卫能红） | K-089 | Node | 可跑 |

### 7.3 回滚（与 ADR-0028 §4 回退预案同口径）

1. **一级回滚（零成本）**：不调用 `setBeadTintRuntime`（或传 `undefined`）⇒ 全部回落矢量臂，**逐字节 = 今日**；资产留在仓里不影响任何路径。
2. **二级回滚（删资产）**：删 `games/beads/cocos/assets/textures/*tint-128-*` 与其 `.meta`（⚠ `.meta` 由编辑器删除，⛔ 不手删）⇒ 包体回吐 25 KB。
3. **三级回滚（删码）**：若 T2'–T4' 终判不达 ⇒ **删净** mask 生成器、场计算模块、注入槽与资产，⛔ **不留"半条 tint 路"**（ADR-0028 §4 原文）。烘焙臂（`_bakeRuntime`）属历史归档件，**不在本单回滚范围**（其去留须另立 ADR）。

---

## 8. Epic / Story 拆分（新增 **EP-12**）

> **编号与序**：EP-01…EP-09 = `systems-index §2` 拓扑序（S1→S9）；EP-10 = 工程交付（Cocos 集成）；EP-11 = 呈现层风格池。**EP-12 = 呈现层渲染管线（本单）**，拓扑上依赖 EP-11（风格池/豆径档已转正）与 EP-10-S1（Cocos 工程），故排于末位。
> **验收口径**：只引既有判据 —— `S9§8-14~19` / `S8§8-11~13` / `§12.2 C1–C12` / `cell-standard §3 J1–J7` / `systems-index §3.9` / ADR-0026 §5 / ADR-0028 §5。**零新发硬判据**；本单新增的只有**机检不变式**（V-1/V-2/V-4/V-6 一类，属实现级断言，不是设计判据）。

### EP-12 珠面/格面 tint mask 管线（S3 呈现层 · 工程交付）

**EP12-S1 · mask 生成路径：spec + 场计算 + 对拍门禁**
- 描述：把定稿 py 的口径常量搬进 `MaskSpec`（**只换载体、不改数值**）；`MaskSpec` 由层集直读（DEC-4）+ 墨档字典（`buildDict` 正本上移并加单测）生成；`core/bake/mask-field.ts` 出 `Uint8Array`（纯数学、Node 可测、L2 合规）；新增 `mask:diff` 对拍守卫（py 产物 vs TS 产物）。
- 验收：V-1 / V-2 / V-9；对拍容差登记（均值 ≤1/255、最大 ≤2/255）；`§12.2 C3/C12` 在 mask 侧的新读法（mask 内**不得含任何色值**）。
- 依赖：EP-11（层集与档位已转正）。估点：**L**。

**EP12-S2 · 资产入库、命名与包体守卫**
- 描述：4 张 mask（+ base 占位若走 Sprite 池）按 `mask__<kind>__<gauge>__v<MASK_SCHEMA_VERSION>` 正名入库；`.meta` 由编辑器生成（L1）；`check-bundle-size` 覆盖 + 主包增量差分登记；**128 vs 192/256 档位实测**（§6.2）。
- 验收：`systems-index §3.9`（4096 KB 红线）+ `control-manifest §19`（守卫未归位 ⇒ 不得投放）+ L1。
- 依赖：EP12-S1、EP10-S1。估点：**M**。`[Blocked: 待构建]`（包体实测腿）。

**EP12-S3 · `RenderModel` tint 通道（命令层 + Canvas2D 实现）**
- 描述：`BlitCommand` 增可选 `tint?: string`（§3.3 选项 B）；`builder.blit(...)` 改选项对象（改 1 处调用，编译期捕获）；Canvas2D 实现 CPU 预合成 + 有界 LRU；Cocos 侧保持 warn 跳过（待 S5）；SVG 导出适配；`bead-style-seal` 零漂移验证。
- 验收：ADR-0026 §5 J-1（sha 计引用不计纹理内容）/ J-3（矢量臂逐字节不变）/ J-4（Cocos 跳过 + warn）；V-4 / V-5。
- 依赖：EP12-S1（可用桩纹理先行）。估点：**M**。

**EP12-S4 · `drawFilledBead` / `drawEmptySocket` tint 臂接入 + 双档位切换**
- 描述：`BeadTintRuntime` 注入槽 + 臂选择序（§3.2）；已填格/空格命令流（§3.1）；`gauge` 由 `snap.beadSize` 驱动、托盘恒 holed、托盘空槽与锁定格恒矢量（§3.6）；未命中矢量回退。
- 验收：`§12.2 C2`（热路径零分配：scratch 槽复用）/ `C7`（命令 ≤7、真 α ≤2）/ `C8`（按档参数化）/ V-4 / V-6；`cell-standard §3` J1–J7 由 mask 尺寸反算的锚点同步。
- 依赖：EP12-S3。估点：**L**。

**EP12-S5 · Cocos 侧纹理载体（整盘单图元为主 / Sprite 池为过渡）** `[部分 Blocked: 待编辑器·待真机]`
- 描述：结构化 `CocosTintSpriteSource`/节点宿主由 `bindings.ts` 注入（core 与 adapter 层 ⛔ 不 `import 'cc'`）；乙方案：独立节点 + 满幅 rect + 自定义 effect（色板走纹理通道、布局 uniform 只出 `gridLayoutFor`、α=0 不用 `discard`、预热首帧）；甲方案仅作桌面档实证。
- 验收：ADR-0022 §11.2 D5 口径的 draw call/三角差分登记（`[N]` 桌面档，**不得记真机**）；未注入 ⇒ 矢量臂不变（V-5）。
- 依赖：EP12-S3、EP10-S1。估点：**L**。

**EP12-S6 · 判据重设与封箱复评（K-088 族）**
- 描述：C7 命令门与 C12 主体色在 tint 臂的重设（C12 改**纹理像素 argmax**，§13.14 已预告）；`check-bead-style-pool` 增 tint 臂分支；`bead-cell-standard` / `view-model` 断言按新命令流重设；`bead-style-seal` 走**复评归因**（K-082：视觉改动 ⇒ 封箱腿红是预期，⛔ 禁自更新基准）；守卫有效性自测（K-089）。
- 验收：`pnpm run verify` 全绿 + 封箱复评归因记录 + 守卫红→绿双向可复现。
- 依赖：EP12-S4、EP12-S5。估点：**M**。

**EP12-S7 · 旧产物与 schema 处置（兼容策略）**
- 描述：`MASK_SCHEMA_VERSION` 立号；S3-lite 旧位图保留为路线史/解剖样张（不删、不进包）；`makeBeadRecipe`/`makeCellRecipe` 加 `mode`（默认 `bitmap`，旧调用方零破坏）；`bake:check` 与 mask 漂移守卫同批建。
- 验收：`framework:sync:check` / `cocos:check` / `check:es5spread` 绿；旧调用方编译期无损。
- 依赖：EP12-S1。估点：**S–M**。

**EP12-S8 · 真机验证批 T2'/T3'/T4'** `[Blocked: 无真机 · 本单不立项]`
- 描述：wx `multiply/screen` 支持面与质量、命令/带宽账、低端机帧时间（C ≥ A×1.5）。
- 验收：ADR-0028 §5 三条通过线。估点：**M**。**状态：DEFERRED — 需真机 playtest**。

---

## 9. 第一冲刺建议（最小可验垂直切片）

入选原则：**全链路可在 Node/vitest + harness 验证**，不依赖被阻塞的工具（无编辑器产物、无真机、无构建）。

| Story | 入选理由 | 验证通道 |
|---|---|---|
| EP12-S1（**收窄**：facet-4 × 有孔档先出，无孔档随后） | 一切的前置；场计算是纯函数 ⇒ Node 可验（L2 合规） | Node |
| EP12-S3 | 命令层改动 ⇒ Node 断言全绿；Canvas2D 在 harness 端到端可见 | Node + harness |
| EP12-S4（**收窄**：盘面珠/空格；托盘槽与锁定格保持矢量） | 观感切换的主干，harness 可截图比对 | Node + harness |
| EP12-S7（**收窄**：`MASK_SCHEMA_VERSION` + 旧产物标注） | 防止旧件误引与新号冲突 | Node |
| V-3（静态等价，CPU 合成 vs 矢量） | 唯一能在无真机下逼近 T1' 的通道；**未达项如实登记**（R-9） | harness |

**排除**：EP12-S2（待构建）、EP12-S5（待编辑器载体）、EP12-S6（依赖 S4/S5 落码）、EP12-S8（无真机）—— 一个都不删，留后续冲刺。
**切片出口**：`pnpm run verify` 全绿 + harness 截图 + V-1/V-2/V-4/V-5/V-6 断言绿 + V-3 报告（含未达项）。

---

## 10. 环境约束与阻塞声明

- **无 wx 真机** ⇒ T2'–T4'（EP12-S8）`[Blocked]`，全部记 `DEFERRED`，⛔ 禁止任何"浏览器可用 ⇒ 真机可用"的外推（K-054）。
- **Cocos 编辑器可用但 `build:wx` 未通** ⇒ EP12-S5 只能出**桌面 web 预览**旁证（`[N]`），EP12-S2 的包体实测腿 `[Blocked: 待构建]`。
- **`.scene` / `.prefab` / `.meta`** 一律由编辑器产生（L1）；本单新增资产须经编辑器刷新生成 `.meta`，⛔ 禁止手写或伪造。
- **无真机下的观感类结论**一律标 `[待真机]`，不得记 PASS。
- 包体：**平台红线（4096 KB）与内部目标（v1.51 后同为 4096）已合流、缓冲为 0** ⇒ 任何增量都直接顶红线，⛔ 不得把"内部目标"当缓冲用。

---

## 11. 待主理人裁决（未决问题 · ⛔ 工程侧不代拍）

**Q1 · Cocos 侧纹理载体取哪条？**
① **整盘单图元 + 自定义 effect**（推荐：+1 draw call、+2 三角，ADR-0022 §11.2 已实测同形态成立；代价 = 新子系统 + 盘面数据纹理通道）；② **Sprite 池 + 现役 `tint-mask.effect`**（机械最小、已出图；代价 = draw call +N ⇒ 大盘不可接受）；③ **本单只落命令层与 Canvas2D，Cocos 侧暂不接**（生产仍矢量，零风险但 tint 收益在生产侧为零）。

**Q2 · 孔底口径在 tint 制下怎么定？**（R-3）
① **接受定稿 v1.1**：孔真透透出 **B0 tile（`edge` −0.30 = 0.70×target）**，托盘珠孔**透明**（与 studio 定稿同构，改动最小）；② **保留 live 孔底 circle**（孔内仍 `pit` −0.44，+1 命令/珠，mask 孔区不再真透 ⇒ 与定稿"真透 ⌀12"语义冲突）；③ **由美术/策划重定孔底档**（重新走定稿流程）。
⇒ 无论哪条，**K3「孔底透出目标色」的现役判据文本都要改**，改判据属策划/QA 域，本单不做。

**Q3 · mask 生成器真源走哪条？**（§4.3）
① **丙·渐进**（推荐：先 py 出图入库可跑 ⇒ spec 化 ⇒ TS 场计算对拍绿后切源）；② **乙·直接 TS 移植 + 对拍**（快，但两套实现并行期长）；③ **甲·py 唯一真源**（最快可用，但放弃 DEC-4 同源与 CI 守卫）。

**Q4 · 128px 档位 vs dpr 无封顶**（§6.2，R-7）
① 出 **192/256 档**（+10–30 KB）；② 维持 128、接受 ≤1.5× 放大 + 显式豁免 §19（须实测观感）；③ 走 zoom LOD 在高倍段降档/回矢量。

**（附）Q5 · 是否为本单新立 ADR-0029**：见 §12，建议**立**。

---

## 12. 落码前须先立的文档动作（本单不执行，等批准）

| # | 动作 | 归属 | 说明 |
|---|---|---|---|
| 1 | **ADR-0029「tint mask 运行时载体与命令通道」** | 程基岩（`wxgame-adr-arch`） | 五节结构；§2 备选 = Sprite 池 / 整盘单图元 / 暂不接；**§4.2 负面后果必写**：Cocos 无 blit 载体、Sprite 池 draw call 爆炸、Canvas2D 侧内存收益不成立、判据需重设 |
| 2 | **ADR-0026 增补**：`BlitCommand.tint?` + builder 选项对象形态 | 程基岩 | 增补节，不改既有结论 |
| 3 | **ADR-0028 §5 回写**：本单执行态（V-1…V-9 读数，未达项如实登记） | 程基岩 | ⛔ 不得写"T1' 已过" |
| 4 | **mask 资产规格**（命名/入库/包体预算/双档位） | **林绘澄**（WXG-T-227 已派） | 与其单衔接：本单只提供字节实测与落位建议，⛔ 不侵占其域 |
| 5 | **判据重设**（C7/C12 在 tint 臂、封箱复评） | **严守真**（`wxgame-qa-gates`） | K-088 族，⛔ 工程侧不代写判据 |
| 6 | **`control-manifest` §19 前置核对**（守卫归位状态） | 主理人 + quality-lead | 未归位 ⇒ ④ 入包不得执行 |

---

## 13. 统计

| 项 | 数值 |
|---|---|
| 新增 Epic | **1**（EP-12，渲染管线·工程交付） |
| 新增 Story | **8**（EP12-S1…S8），其中 `[Blocked]` 2（S2 待构建 / S8 无真机）、部分 Blocked 1（S5 待编辑器载体） |
| 估点分布 | S × 0 · M × 3 · L × 4 · S–M × 1 |
| 第一冲刺入选 | **5 项**（S1 收窄 / S3 / S4 收窄 / S7 收窄 / V-3） |
| 新增机检不变式 | 6（V-1/V-2/V-4/V-5/V-6/V-9）——**实现级断言，非设计判据** |
| 引用既有判据 | `S9§8-14~19`、`S8§8-11~13`、`§12.2 C1–C12`、`cell-standard §3 J1–J7`、`systems-index §3.9`、ADR-0026 §5、ADR-0028 §5、ADR-0022 §11 |
| 资产增量（实测） | **25.0 KB**（mask 18.8 KB + base 6.2 KB）= 主包红线 **0.61%** |
| 未决问题 | **5**（Q1 载体 / Q2 孔底 / Q3 生成器真源 / Q4 档位 / Q5 ADR） |
| 本单代码改动 | **0**（方案件，落码等批准） |
