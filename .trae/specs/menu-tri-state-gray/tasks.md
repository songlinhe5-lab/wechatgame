# 任务拆解（主菜单三态灰度重设计）

> 闸门：**Phase 0 出图 → 用户裁决灰度档 → 才允许进 Phase 1**。
> 台账：WXG-T-566（开工前登记 `production/TASKS.md` + `TASKS-DETAIL.md`）。

## Phase 0 — 对照渲染（只读，不改框架/视图）

- [x] **T0.1** 登记台账 WXG-T-566。
- [x] **T0.2** `dev/harness/main.ts` 加 `?artGray=0..1` 调试参数：
  - 在 `blitSource.get()` 外包一层（约 L221 `const blitSource: TextureRegistry` 处）；
  - 命中 `OPEN_ARCS[].textureId` 且 `artGray > 0` ⇒ 返回灰化 canvas（`luma = 0.2126R+0.7152G+0.0722B`，`out = c·(1−g) + luma·g`）；
  - 模块级缓存 `Map<string, Canvas>`，键 `id|gray`。
- [x] **T0.3** 起 harness（`pnpm run harness`），同机位截 4 帧：
  `artGray=1` / `0.55` / `0` / 无参数。
- [x] **T0.4** 拼 2×2 对照图 → `temp/menu-states-v3/compare/`；给用户看，等待裁决。
- [x] **T0.5** 裁决落 `production/qa/menu-tri-state-gray-<日期>.md`（含复现配方：参数 / 脚本 / 帧号）。

**验收**：4 帧同机位可复现；用户对"全灰 / 部分灰 / 全彩"的观感给出通过或改档。

---

## Phase 1 — 框架 `gray` fx

- [x] **T1.1** 新建 `packages/framework/src/core/bake/gray-fx.ts`（`GRAY_FX_KEY` / `grayFx` / `grayFxRead`）。
- [x] **T1.2** `render-model.ts` 的 `BlitFx` 键表加 `gray`；`ADR-0029 §8.4` 同步登记。
- [x] **T1.3** barrel 导出（与 `tintFx` 同址）。
- [x] **T1.4** `tint-blit-resolver.ts`：`_grayCache` + `bakeGray` + `resolve()` 顺序 `nineSlice → base → gray → 原图`；`Ctx2DLike` 补 `getImageData/putImageData`。
- [x] **T1.5** 新测 `gray-fx.test.ts`、`gray-blit-resolver.test.ts`（像素公式、缓存命中、与 tint 互斥）。

- [x] **T1.6**（最终方案）`gray-fx.ts` 加 `GRAY_WIPE_FX_KEY` / `grayWipeFx(progress, soft)` / `grayWipeRead`；`render-model.ts` 键表与 `ADR-0029 §8.4` 同步登记 `grayWipe`。
- [x] **T1.7** `tint-blit-resolver.ts` 加 `bakeGrayWipe`（逐行 `g = 1 − t`，每纹理只留最新一档）并接在 `gray` 之后；补 `grayWipe` 像素判据（顶灰 / 底彩 / 柔带 / 缓存）。

**验收**：单测全绿；未命中 fx 的路径逐字节不变。

## Phase 2 — cocos 适配

- [x] **T2.1**（方案订正）⛔ 不改 `tint-mask.effect`（其只采样 maskTexture，全彩 PNG 灰化不可用）。
- [x] **T2.2** `beads-blit-carrier.ts`：`_grayFrame` + `_wipeFrame` 共用 `_bakeGrayFrame`（CPU 预烘 `SpriteFrame`）；揭彩换档复用同一 `Texture2D` 重新 upload。
- [ ] **T2.3** `pnpm run build:cocos:web` 确认 carrier 可编译；构建链阻塞则标 CONCERNS 并写阻塞条件。

## Phase 3 — 数据 + 视图

- [x] **T3.1** `meta-types.ts` 加 `carouselArcDone/Total` + `carouselPeerArcDone/Total`。
- [x] **T3.2** `beads-shell.ts::_metaViewData()` 填充主车与对页各自进度（复用 `levelRefs` 遍历，零对象分配）。
- [x] **T3.3** `tuning/menu.ts`：`MENU_GRAY = { locked: 1 }` + `MENU_GRAY_WIPE = { soft: 0.08 }`。
- [x] **T3.4** `meta-menu.ts`：`triStateFx(state, done, total)`（pushing ⇒ `grayWipe`，进度 = done/total，模块级千分位缓存）；`drawShowcaseArt` / `drawShowcaseItem` 增加进度入参并分传主/对页；删 `sealCleared` / `badgeLocked` / `badgeProgress` 分支。
- [x] **T3.5** `drawCaseLight` 加 `strength`（0.35 / 0.70 / 1.00）。
- [x] **T3.6** 清理仅剩无引用的常量；有引用则保留注记。
- [x] **T3.7** 新测 `menu-tri-state.test.ts`（三档 fx、揭彩进度 3/8 与 6/8、对页不借用主车、无章命令）。
- [x] **T3.8**（后续）未开启态磨砂玻璃 — 已由 **WXG-T-567** 落地（预烘模糊 `frost`，2026-11-03）。

## Phase 4 — 收口

- [ ] **T4.1** `pnpm run verify`；修红。
- [ ] **T4.2** K-6 菜单帧图元差分 + `ui-golden-capture.ts` 重抓（先登记 `ui-architecture-beads.md §12`）。
- [ ] **T4.3** `pnpm run check:links`。
- [ ] **T4.4** 提交（含 WXG-T-566）+ push + 回传提交总结。
- [ ] **T4.5** 沉淀候选 0–3 条（写入 `knowledge/` 待审）。
