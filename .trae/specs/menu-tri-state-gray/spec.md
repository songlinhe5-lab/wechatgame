# 主菜单走马灯三态视觉重设计（竖向揭彩 · 去章 · 灯光随态）

- 台账：WXG-T-566（待登记 `production/TASKS.md`）
- 上游：`games/beads/design/art/final/prototypes/`（三张新原型）
- 状态：**已批准并落码**（2026-11-02 用户裁「按这个方案来，先实现竖向揭彩效果」；磨砂玻璃 2026-11-03 由 **WXG-T-567** 落地 = 预烘模糊 `frost`）

---

## 1. 问题诊断

现三态（未开启 / 推关中 / 通关）**全靠右上角贴章表达**，而 `drawShowcaseArt` 的 blit 分支不看 `state`：

- 有大关 PNG 时，三态底层图**完全相同**（都是全彩）；
- `locked` 只是再叠一枚锁徽章，`cleared` 只是再叠一条缎带；
- 章会挡作品、材质与橱窗不符；走马灯滑动时章随作品一起漂（`dx` 参与坐标）；
- 唯一的"状态感"来自贴纸，作品本身没有参与叙事。

## 2. 已拍板约束（用户原话，不再讨论）

| # | 裁定 |
|---|---|
| D1 | **所有状态标记全去掉**：右上角 `badgeLocked` / `sealCleared`，以及居中沙漏章 `badgeProgress`（2026-11-02 追加裁决）|
| D2 | 进度数据 = **当前大关已完成小关数 / 总小关数** |
| D3 | **三态都用同一张大关 PNG**，区别只有「全灰 / 部分灰 / 全彩」 |
| D4 | **先渲染对照**，确认观感再落码（已完成，见 §4.6） |
| D5 | **推关 = 竖向揭彩**：半灰不再是整图 0.55，而是**从下到上的彩色 mask**，彩色比例与进度相关（2026-11-02 最终裁决） |
| D6 | 未开启磨砂玻璃：2026-11-02 暂缓，2026-11-03 用户裁 **预烘模糊**（`frost`，WXG-T-567） |

## 3. 视觉语言（场景一致性：橱窗 = 展柜）

状态由**展品本身 + 柜灯**表达：灯灭看灰、灯亮看彩，不再往玻璃上贴纸。

| 状态 | 作品效果 | 柜灯强度 | 铭牌 |
|---|---|---|---|
| 未开启 locked | 整图全灰（`gray: 1`） | `0.35`（暗） | 「未开启」 |
| 推关中 pushing | **竖向揭彩**：底部 `progress = done/total` 比例全彩，顶部全灰，交界柔带 `soft = 0.08` | `0.70` | `N/M` |
| 已通关 cleared | 全彩（不传 fx） | `1.00`（亮） | 星数 |

**DEC-1（离散进度而非连续动画）**：`progress` 取 `done/total`（已完成小关数 / 总小关数），只在通关小关时变化 ⇒ 每纹理最多「章内关数 + 1」张灰化副本，显存可控。⛔ 不喂逐帧连续进度。`done === 0` 仍属推关（首关已解锁未通关），此时底部只有柔带渗透的一点彩。

## 4. 技术设计

### 4.1 框架：新增 `gray` + `grayWipe` fx

- `packages/framework/src/core/render/render-model.ts`：`BlitFx` 键表新增 `gray`（`0..1`，`1` = 全灰）与 `grayWipe`（`readonly number[] = [progress, soft]`）；同步登记 `docs/architecture/adr/ADR-0029 §8.4` 键名表（键名正本）。
- 新文件 `packages/framework/src/core/bake/gray-fx.ts`：
  - `GRAY_FX_KEY = 'gray'` / `GRAY_WIPE_FX_KEY = 'grayWipe'`
  - `grayFx(strength)` / `grayWipeFx(progress, soft)` —— 夹到 `[0,1]`、键序固定、JSON 安全、⛔ 不写 `undefined`
  - `grayFxRead(fx)` / `grayWipeRead(fx)`
- 与 tint 互斥：同一 `fx` 同时有 `base` 与灰度键 ⇒ `base` 优先（由 resolver 顺序结构性保证，文档注明）。

### 4.2 canvas2d：灰化 / 揭彩取图

文件 `packages/framework/src/adapters/canvas2d/tint-blit-resolver.ts`：

- 模块级 `_graySlices`，键 `textureId|gray`；`_wipeSlices` 键 `textureId`，值含 `{ p, s, canvas }`
  ⇒ **每纹理只留最新一档**（进度单调递增，旧档不再显示）。
- `bakeGray(...)`：离屏 canvas → `drawImage` → `getImageData` → 逐像素
  `luma = 0.2126R + 0.7152G + 0.0722B`，`out = c·(1−g) + luma·g` → `putImageData`；alpha 原样保留。
- `bakeGrayWipe(...)`：同一像素式，`g` 逐行取值——`boundary = H·(1−progress)`，
  `band = soft·H/2`，`t = clamp((y − (boundary − band)) / (2·band), 0, 1)`，`g = 1 − t`；
  `soft = 0` ⇒ 硬边。行序 = canvas 原生（自顶向下）⇒ 彩色区 `y ≥ boundary`。
- `resolve()` 顺序：**nineSlice → base(tint) → gray → grayWipe → 原图**；`fx` 有值但都不匹配 ⇒ `undefined`。
- ⛔ 不用 `ctx.filter = 'grayscale()'`：微信小游戏 Canvas 2D 的 filter 支持不保证，跨端不确定。
- 本地类型 `Ctx2DLike` 补 `getImageData` / `putImageData`。

### 4.3 cocos：CPU 预烘变体（⛔ 不用 `tint-mask.effect` 灰化）

- 既有 `tint-mask.effect` **只采样 `maskTexture`**（R/G/B 是 tint 系数），全彩 PNG 的 R 通道
  不是灰度暗系数 ⇒ 不能直接复用该 effect 做灰化。
- 改为在 `beads-blit-carrier.ts` 里**CPU 预烘** `SpriteFrame`：`_grayFrame` / `_wipeFrame`
  共用 `_bakeGrayFrame`（离屏 drawImage → 逐行灰化 → `Texture2D.uploadData`），缓存 `_grayBitmaps` /
  `_wipeBitmaps`。与 canvas2d 侧**同一行序、同一式**。
- ⛔ 不手改 `cocos/assets` 下框架副本：由 `pnpm run build:cocos` 同步。

### 4.4 数据侧（视图不持状态）

- `games/beads/src/view/meta-types.ts`：`MetaViewData` 新增 `carouselArcDone/Total` 与
  `carouselPeerArcDone/Total`（原始数值 ⇒ 每帧零对象分配）。
- `games/beads/src/game/beads-shell.ts`：`_metaViewData()` 复用 `_arcState` 既有 `levelRefs` 遍历产出
  `done/total`；主车与对页**各自算**（滑动中两页进度不借用）。
- `games/beads/src/config/tuning/menu.ts`：`MENU_GRAY = { locked: 1 }` +
  `MENU_GRAY_WIPE = { soft: 0.08 }`（⛔ 视图散写字面量）。

### 4.5 视图接线

`games/beads/src/view/meta-menu.ts`：

- `triStateFx(state, done, total)`：`locked → { gray: 1 }`；`pushing → WIPE_FX`（按 `progress`
  千分位缓存，模块级 `Map` ⇒ 同进度每帧零分配）；`cleared → undefined`。
- `drawShowcaseArt` / `drawShowcaseItem` 增加 `arcDone/arcTotal` 入参；主车传 `carouselArcDone/Total`，
  对页传 `carouselPeerArcDone/Total`。
- **删除** `state === 'cleared'` 的 `sealCleared` 分支、`state === 'locked'` 的 `badgeLocked` 分支，以及
  `state === 'pushing'` 的居中沙漏章 `badgeProgress`（D1 追加裁决）。

`drawCaseLight` 增加 `strength` 参数（`0.35 / 0.70 / 1.00`）；⛔ 不新增 palette 色（先只用既有 `woodText`，避免色表锁哈希变更）。

未用常量（`MENU_SEAL` / `MENU_TEXTURES.sealCleared` / `badgeLocked` / `badgeProgress` / `MENU_LOCK_D` / `MENU_PROGRESS`）**仅当全仓无其他引用**才删；有引用则保留并注记。

### 4.6 Phase 0 对照（本轮唯一动作）

不改框架、不改视图，只在 `dev/harness/main.ts` 加调试参数：

- 读 `?artGray=0..1`（缺省/非数字 ⇒ 不生效）；
- 在 `blitSource.get(textureId)` 外包一层：命中 `OPEN_ARCS[].textureId` 且 `artGray > 0` ⇒ 返回同公式烘好的灰化 canvas（缓存键 `id|gray`）；
- 产出 4 帧：`1.0` / `0.55` / `0` / 无参数（原彩），同机位同帧号，拼 `2×2` 对照图。

产物落 `temp/menu-states-v3/compare/`（gitignore）；裁决后证据转 `production/qa/menu-tri-state-gray-<日期>.md`。

## 5. 验收

**机械**

- `pnpm run verify` 全绿；`pnpm run check:links` 通过。
- 新增单测：`gray-fx.test.ts`（夹取 / 键序 / JSON 安全）、`gray-blit-resolver.test.ts`（像素公式 + 缓存命中）、`menu-tri-state.test.ts`（三档 fx + **无 seal/badge 命令**）、arc done/total 单测。
- 菜单帧图元差分（K-6）与 `ui-golden-capture.ts` 重抓；重抓前须在 `docs/architecture/ui-architecture-beads.md §12` 登记。

**目测**

- 同一帧三档并排：locked 一眼"熄灯"、pushing 一眼"半成品"、cleared 是画面最亮。

## 6. 风险与边界

- **显存**：灰化键 = 档 × 纹理（本版 locked 一档）；揭彩**每纹理只留最新一档** ⇒ 上限 ≈
  「开放大关数 × 2 份（灰 / 揭彩）」× `361×527×4 ≈ 0.76MB` ≈ 数 MB 级；⛔ 不按进度累加。
- **首帧抖动**：`getImageData` 只在纹理就绪 / 进度变化时预烘一次，⛔ 不进每帧路径。
- **锁语义变弱**：删除锁徽章后由铭牌「未开启」承担（D1 已拍板）。
- **磨砂玻璃**：**WXG-T-567 已落地**（2026-11-03）= `frost`（1/4 下采样 + 盒式模糊 + 全灰，产物 1/4 尺寸；两条宿主腿共用 `frostPixels`）。⛔ 实时 shader 模糊（`tint-mask.effect` 不采样美术图、harness 无 shader ⇒ 两端不等价）。
- **cocos 验证**：改 carrier 需构建验证；构建链阻塞时该条标 CONCERNS，不阻塞 harness 路径。

## 7. 明确不做

- 不做任何新的右上角/角落标记。
- 不做新美术资源（badge / seal / 新 PNG）。
- 不做连续灰度、不做金色等新 palette token。
- 不改走马灯几何、不改 `MENU_CLIP`。
