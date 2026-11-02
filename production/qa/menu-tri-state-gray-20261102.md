# 主菜单三态灰度 · Phase 0 对照取证（WXG-T-566）

- 日期：2026-11-02
- 状态：**Phase 0 已完成 → 用户已裁「竖向揭彩」并落码**（见 §6；磨砂玻璃暂缓）
- 规格：`.trae/specs/menu-tri-state-gray/spec.md`

## 1. 目的

用户拍板「先渲染对照」，确认同一张大关 PNG 在 **全灰 / 部分灰 / 全彩** 三档下的观感，
再决定是否把 `gray` fx 落进框架。本轮**不改框架、不改视图**。

## 2. 配方（可复现）

1. 构建：`pnpm harness:build`
2. 服务：`pnpm harness`（默认 `http://127.0.0.1:4173/`）
3. 取图（同机位、同帧号，仅 `artGray` 不同）：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars --no-first-run \
  --user-data-dir=/tmp/chrome-wxg-<g> \
  --window-size=752,1344 --force-device-scale-factor=1 \
  --virtual-time-budget=8000 \
  --screenshot=temp/menu-states-v3/compare/raw-<g>.png \
  "http://localhost:4173/?game=beads&meta=menu&hud=off&artGray=<g>"
```

- `artGray` 缺省 / 非数字 / `0` ⇒ 不生效（与今日逐字节一致）。
- 参数实现只在 `dev/harness/main.ts` 的 `blitSource.get()` 外包一层，命中的是 `OPEN_ARCS[].textureId`。
- 灰化公式 `out = c·(1−g) + luma·g`，`luma = 0.2126R + 0.7152G + 0.0722B`（Rec.709），alpha 原样保留。

## 3. 产物

| 档 | 文件（`temp/menu-states-v3/compare/`，gitignore） |
|---|---|
| 原彩（cleared） | `raw-none.png` |
| 部分灰 `g=0.55` | `raw-gray-0.55.png` |
| 全灰 `g=1.0` | `raw-gray-1.png` |
| 三档拼图 | `sheet-gray-3tiers.png` |

长期证据（入库）：`production/qa/beads/evidence/menu-tri-state-gray-20261102.png`（= 三档拼图副本）。

## 4. 实测

作品区（截图坐标 `130,310–470,680`）平均饱和度 `|r−g|+|g−b|`：

| 档 | 平均饱和度 |
|---|---|
| 原彩 | **34.3** |
| `g=0.55` | **22.4** |
| `g=1.0` | **12.4** |

⇒ 三档在数值与目测上都可区分；全灰仍保留明暗层次，读作"未上色"而非"黑掉"。

## 5. 观测（影响裁决的两条）

1. **居中沙漏章 `badgeProgress` 不随作品变灰**：全灰帧里它仍是高饱和的彩色补丁，
   直接破坏"整件展品熄灯"的语义。建议与右上二章一并移除（右上二章已由用户拍板删除）。
2. **现役 `final/assets/menu/` 缺 `ui_menu_backdrop` / `ui_menu_logo` / `ui_showcase_frame`**
   （33 件在 `v1/assets/menu/`）⇒ 本轮截图无背景/木框/木牌装饰。

## 6. 最终裁决与落码验证（2026-11-02）

用户裁：**推关不再是整图 0.55，而是「从下到上的彩色 mask」，比例 = 当前大关已完成小关 / 总小关**；
未开启仍全灰；通关全彩；三枚状态章全删；磨砂玻璃暂缓（先实现揭彩）。

落码判据（`pnpm --filter @wxgame/beads exec vitest run` + `pnpm --filter @wxgame/framework exec vitest run`）：

| 腿 | 文件 | 结果 |
|---|---|---|
| fx 键 / 夹取 / JSON | `packages/framework/tests/core/gray-fx.test.ts` | PASS（含 `grayWipe`） |
| 逐行像素 / 缓存 / 无离屏 | `packages/framework/tests/adapters/gray-blit-resolver.test.ts` | PASS（含 `grayWipe` 5 例） |
| 三态 fx / 进度 3/8、6/8 / 对页独立 | `games/beads/tests/menu-tri-state.test.ts` | PASS |
| 走马灯三态 / 章退场 | `menu-carousel.test.ts` / `arc-carousel.test.ts` / `showcase-single.test.ts` | PASS |
| 金样本 | `ui-golden.test.ts` | PASS（已在干净 commit 锚上按登记复取，菜单族 5 态 total −2） |
| 全量 | `pnpm run verify` | PASS 23 / WARN 0 / FAIL 0（含 `cocos:check`） |

⏳ **cocos 构建验证（`build:cocos:web`）= CONCERNS（环境阻塞，非代码问题）**：
2026-11-02 23:56 在沙箱外重跑，编辑器启动即报
`TypeError: (0 , browser_1.init) is not a function`（`@editor/creator/dist/startup/protected/browser`），
构建进程挂起且 `build/web-mobile` 未更新（mtime 仍是 2026-10-28）。
解除条件：用 CocosCreator GUI 打开 `games/beads/cocos` 后由 GUI 构建，或修复本机 CLI 启动环境；
`cocos:check`（类型面）已 PASS，载体代码本身无类型阻塞。⛔ 未真机。
