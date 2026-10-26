# WXG-T-432 · S-3 好友榜面板 harness 验收

- **锚**：代码 `f3726ef2`（S-3 批）+ `c8af2dc9`（纵向布局修正）；金样本 `02015845`
- **方式**：`pnpm run harness:build` → `loadHarness({ game: 'beads' })` → `shell.showMenu()` / `play.openRank('settle-total', '')` → `modelToSvg` → 无头 Chrome 截图。
  截图 PNG **不入库**（`.gitignore:103` `production/qa/*/evidence/**/*.png`），本机路径 = `/tmp/wxg-t-432-menu.png` / `/tmp/wxg-t-432-panel.png`。
- **读数**：
  - 主菜单 `total = 5638`（`WXG-T-298` 金样本同值）；「好友榜」纸钮 x 24..164、CTA x 218..542 ⇒ 零重叠。
  - 面板 560×480，纵向序自上而下 = 标题「好友榜」/ 副标「总榜」/ 状态行「正在加载…」/「返回」钮贴底；遮罩覆盖全屏、面板居中。
  - 修正前（`f3726ef2`）纵向序整版颠倒（返回钮在顶、标题在底）⇒ `c8af2dc9` 按设计空间 y 向上重排 + `rank-panel.test.ts` 纵向序守卫。
- **状态口径**：三宿主默认 `NoopOpenDataProvider` ⇒ 打开后面板停留 `loading`；`unsupported` 仅当 `services.openData` 未注入；S-5 接真 Provider 后才进 `ready` / `empty`。
- **复现命令**：
  `node --experimental-transform-types --import=./tools/scripts/lib/ts-js-resolve.mjs` 直跑 `render-harness-frame` 同款 `loadHarness` 入口即可；或浏览器打开 `http://127.0.0.1:4173/?game=beads&meta=menu`（harness 默认 `initialScreen=play`，必须带 `meta=menu`）。
