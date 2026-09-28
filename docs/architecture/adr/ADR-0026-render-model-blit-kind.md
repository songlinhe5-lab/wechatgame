# ADR-0026 — RenderModel 新增 `blit` 命令（纹理矩形 blit，烘焙管线前置）

- **状态**：**Proposed · 烘焙管线（WXG-T-220）开工前置** —— 本文只冻结接口形态与兼容序，不含实现；落码由 WXG-T-220 阶段 1–3 分步交付。
- **日期**：2026-09-27 · 执笔：程基岩（engineering-lead） · 任务号 **WXG-T-220**
- **上游**：ADR-0025（运行时烘焙缓存管线，DEC-3 明确「渲染层新增 `blit` 命令，框架接口改造另立 ADR-0026」）、ADR-0024（顶点 arena 值语义，`blit` 不走 arena）、ADR-0002（框架引擎解耦，RenderModel 五 kind 原始清单）。
- **关联**：`control-manifest §8`（渲染命令清单，需追加 `blit`）、`bead-visual-style-spec §13.6`（命令 kind 名定为一处）。

---

## 0. 结论一句话

**`RenderModel` 新增第六种命令 `blit`**：`{ kind: 'blit', textureId, x, y, w, h, alpha? }` —— 引用预烘焙纹理的矩形 blit。代价：框架公开类型破坏性变更（`DrawCommand` 联合类型扩一种、两 renderer + SVG 第三消费端各加一个 `case` 分支、seal/pool 门禁适配）；Cocos 端 `Graphics` **不支持绘制 image**，本期不覆盖（ADR-0025 §4.2 已登记）。

---

## 1. 上下文（Context）

### 1.1 为什么需要新 kind

ADR-0025 的运行时烘焙管线把珠体矢量配方（facet-4 系 6 命令）编译为一张预烘焙纹理，运行时命中缓存后只需 **1 条 blit 命令 + 1 条孔 circle**（已填格 7 → 3 命令的核心杠杆）。现有五种 kind（`rect` / `circle` / `line` / `text` / `polygon`）均无法表达「引用外部纹理资源」的语义：

- `rect` + `fill` 只能画纯色/圆角矩形，不能贴纹理；
- `polygon` 的顶点 arena 只存几何坐标，不承载纹理引用；
- 若用 `rect` 模拟 blit（`fill = url(...)`），Canvas2D 的 `fillStyle` 支持 `CanvasPattern`，但 Cocos `Graphics` **无 image 能力**（ADR-0025 §4.2），两端口径必分裂 ⇒ 违反 ADR-0002 渲染器可替换契约。

结论：**必须新增独立 kind**，让两 renderer 各自走自己的纹理通路（Canvas2D `drawImage` / Cocos Sprite 池），SVG 第三消费端用 `<image>` 元素或占位 rect 表达。

### 1.2 约束

- **L2 铁律**：`packages/framework/src/core/**` 禁止 `cc` / DOM / `wx` / `window` / `document` ⇒ `blit` 命令只存 `textureId: string`（不存 `HTMLImageElement` / `Texture2D` 等引擎对象）；纹理资源的解析与绑定由适配层负责。
- **热路径零分配（C2）**：`blit` 命令与 `rect` 同型（纯数据对象），`builder.blit()` 走 `push` 不进 arena。
- **seal 口径**：`blit` 命令的 sha 计入整帧（`JSON.stringify` 自然包含 `textureId` / `x` / `y` / `w` / `h`），**纹理内容不参与 sha**（只计引用）⇒ 封箱基准与纹理文件解耦。

---

## 2. 备选方案（Alternatives）

| 方案 | 描述 | 结论 |
|---|---|---|
| A 复用 `rect` + `CanvasPattern` | `fill = ctx.createPattern(image)` | 否：Cocos `Graphics` 无 image 能力，两端口径分裂 |
| B 复用 `polygon` + 纹理坐标 | 扩展 arena 存 UV | 否：过度设计（只需矩形 blit），且 UV 进 arena 破值语义 |
| **C 新增 `blit` kind（本 ADR）** | 独立命令，`textureId` 字符串引用 | **采纳**：最小侵入、两 renderer 各自适配、SVG 可表达 |

---

## 3. 决定（Decision）

### 3.1 接口形态

```ts
/** 纹理矩形 blit 命令（ADR-0026）。*/
export interface BlitCommand {
  readonly kind: 'blit';
  /** 纹理资源标识符（由适配层解析为具体引擎对象；核心层只存字符串）。*/
  readonly textureId: string;
  /** 左下角坐标（设计空间，同 `rect` 约定）。*/
  readonly x: number;
  readonly y: number;
  /** 绘制尺寸（设计空间；纹理按此尺寸缩放绘制）。*/
  readonly w: number;
  readonly h: number;
  /** 可选全局透明度（同 `rect` / `circle` 的 `alpha` 口径）。*/
  readonly alpha?: number;
}
```

`DrawCommand` 联合类型追加 `BlitCommand`：

```ts
export type DrawCommand =
  | RectCommand
  | CircleCommand
  | LineCommand
  | TextCommand
  | PolygonCommand
  | BlitCommand;  // ← 新增
```

### 3.2 Builder 入口

```ts
// RenderModelBuilder 新增方法
blit(textureId: string, x: number, y: number, w: number, h: number, alpha?: number): void {
  this._commands.push({
    kind: 'blit', textureId, x, y, w, h,
    ...(alpha !== undefined ? { alpha } : {}),
  });
}
```

不进 arena（`blit` 无顶点载荷）；命令数 +1，真 α 计数按既有规则（`alpha !== undefined && alpha < 1` ⇒ +1）。

### 3.3 三消费端适配

| 消费端 | 文件 | 适配方式 |
|---|---|---|
| Canvas2D renderer | `packages/framework/src/adapters/canvas2d/canvas2d-renderer.ts` | `case 'blit'`: 从纹理注册表查 `textureId` ⇒ `ctx.drawImage(tex, x, y, w, h)` |
| Cocos renderer | `packages/framework/src/adapters/cocos/cocos-renderer.ts` | **本期不覆盖**（ADR-0025 §4.2 已登记）；`case 'blit'` 暂走 `break`（静默跳过）+ 控制台 warn |
| SVG 离线导出 | `tools/scripts/lib/render-model-svg.mjs` | `case 'blit'`: `<image href="..." x="..." y="..." width="..." height="..."/>` 或占位 `<rect>` + 注释 |

### 3.4 纹理注册表（适配层职责）

核心层**不持有**纹理资源，只存 `textureId` 字符串。适配层负责：

```ts
/** 纹理注册表（适配层注入，核心层通过接口消费）。*/
interface TextureRegistry {
  get(textureId: string): CanvasImageSource | undefined;
  register(textureId: string, source: CanvasImageSource): void;
}
```

Canvas2D renderer 构造时接收 `TextureRegistry`；未注册 `textureId` ⇒ 跳过绘制 + 控制台 warn（不抛异常，保证矢量回退通路不被纹理缺失阻断）。

---

## 4. 后果（Consequences）

### 4.1 正面

- **命令数与美术层数解耦**：烘焙后已填格 = `blit` 1 + `rect`(B0) 1 + `circle`(孔底) 1 = 3 命令（原 7）。
- **seal 口径清晰**：`blit` 命令的 sha 只计 `textureId` 引用，纹理文件变更不影响封箱基准（只需 `bakeSchemaVersion` 递增触发缓存失效）。
- **矢量回退恒在**：`blit` miss 时走矢量臂（逐字节 = 现役 facet-4），两臂可灰度切换（`useBakedBead` 选项）。

### 4.2 负面

- **框架公开类型破坏性变更**：`DrawCommand` 联合类型扩一种 ⇒ 所有 `switch (cmd.kind)` 必须加 `case 'blit'`（漏加 = TypeScript exhaustive check 报错，编译期可捕获）。
- **Cocos 端本期不覆盖**：`blit` 在 Cocos renderer 静默跳过 ⇒ 真机验证只能走 Canvas2D（harness + wx 小游戏）；Cocos 端改造（Sprite 池）属独立立项（约 1–2 story）。
- **纹理注册表新增适配层接口**：`TextureRegistry` 的注入与生命周期管理由烘焙管线（WXG-T-220 阶段 2）交付，本文不定实现细节。
- **seal 基准漂移**：baked 臂的 seal 需单独登记（`SEAL.baked.frame78` 等），矢量臂 seal 不变（K-082 纪律）。

### 4.3 中性

- **SVG 导出的 `<image>` 元素**：浏览器可直接渲染，但 `tools/scripts/lib/render-model-svg.mjs` 的测试消费端需适配（seal 测试的 `JSON.stringify` 自然包含新字段，无需改断言）。
- **`control-manifest §8` 需追加**：`blit` 入渲染命令清单，L2 铁律不变（核心层不持引擎对象）。

---

## 5. 判据与门禁连锁

| 判据 | 描述 | 落位 |
|---|---|---|
| **J-1** | `blit` 命令的 sha 计入整帧，纹理内容不参与 | `bead-style-seal.test.ts` baked 臂单独登记 |
| **J-2** | C7 双指标：baked 珠 = `blit` 1 + `circle` 1 = 2 ≤ 7 | `check-bead-style-pool.mjs` 新增 baked 臂分支 |
| **J-3** | 矢量回退恒在：`useBakedBead = false` 臂逐字节不变 | `bead-render.test.ts` 既有测试零改动 |
| **J-4** | Cocos renderer 静默跳过 `blit` + warn | `cocos-renderer.test.ts` 新增 `blit` skip 测试 |
| **J-5** | SVG 导出 `<image>` 或占位 `<rect>` | `render-model-svg.test.ts`（若存在）新增 `blit` case |

---

## 6. 复评触发条件（Review Triggers）

1. Cocos 端立项 Sprite 池改造 ⇒ 复评 `blit` 在 Cocos 的实现路径（本文 §3.3 的「静默跳过」转正式实现）。
2. 美术配方引入**跨格纹理**（单张纹理覆盖多格）⇒ 复评 `blit` 的 `w` / `h` 是否需要扩为 `{srcX, srcY, srcW, srcH}` 子矩形。
3. wx 基础库 `CanvasRenderingContext2D.drawImage` 行为变更 ⇒ 复评 Canvas2D renderer 的 `blit` 实现。
4. 烘焙管线的 `bakeSchemaVersion` 递增纪律被违反（线上旧皮）⇒ 复评封箱测试是否需追加 `blit` 纹理内容校验（当前只计 `textureId` 引用）。

---

## 7. 开工序

本文只冻结接口形态与判据；实现由 **WXG-T-220** 分步交付：

1. **阶段 1**：`packages/framework/src/core/render/render-model.ts` 新增 `BlitCommand` 接口 + `builder.blit()` 方法。
2. **阶段 2**：Canvas2D renderer + SVG 导出适配；Cocos renderer 静默跳过。
3. **阶段 3**：`bead-render.ts` 双臂分流（baked 臂发 `blit` + 孔 `circle`；矢量臂逐字节不变）。
4. **阶段 4**：seal / pool 门禁适配（J-1…J-5 判据落码）。

每阶段完成后跑 `pnpm run verify` 确保零回归。
