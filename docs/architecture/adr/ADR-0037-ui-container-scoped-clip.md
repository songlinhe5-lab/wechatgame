# ADR-0037 · 容器内逐容器裁切：`clip` 在容器内建裁切子树 + 后置层

- **状态**：Accepted（用户 2026-11-14 裁定「做逐容器裁切」，替代 ADR-0033 / WXG-T-439 的「容器内零 clip」降级）
- **日期**：2026-11-14
- **关联**：ADR-0033（UI 容器层 / 容器 × 段层树）、ADR-0030（Cocos blit 载体，同款 stencil 蒙版）、ADR-0026（`blit` kind）
- **判例链**：WXG-T-942（半露行整行不画 + 松手吸附）→ 用户否决「跳过半行」⇒ **WXG-T-944（本 ADR）**
- **负责域**：工程负责人（框架内核 + Cocos 宿主）· 设计策略（滚动窗视觉口径）

---

## 1. 上下文

**需求**：设置弹窗的单列 cell 列表可拖拽滚动。滚动停在任意位置时，窗顶 / 窗底会出现**半行 cell**，
必须按可视窗**裁像素**显示（用户原话：「现在拖动整个 cell 完整显示才能渲染，没有办法做到 clip cell
的部分区域显示」）。

**为什么以前不行**：ADR-0033 / WXG-T-439 定过「容器内零 `clip`」。原因是 Cocos 端 `clip` 走**全局**
`clipHost`（`bindings.ts` 的 `menuClip`）——它把被裁内容挂在容器**外**的固定子树，容器内的位图腿 / 文字
仍画在容器自己的通道里 ⇒ 层序错乱。视图侧因此只能手工裁剪：半露行「整行不画」，再由 shell 松手吸附到
整行 pitch（WXG-T-942）——用户明确不接受这个折中。

**关键约束**：裁切必须同时罩住**三类命令**（矢量 `Graphics` / 静态位图 `BlitLayerUI` / 文字 `Labels`），
且被裁内容仍要留在容器层序内（不能像全局 `clipHost` 那样跳出容器）。

## 2. 决策（DEC）

- **DEC-1 裁切是容器能力，不是全局能力**。`clip` 落在某个容器内时，内核（`UiScopeTree.enterClip`）在
  **该容器的分组节点下**建（或复用）一棵裁切子树，返回 true ⇒ 渲染器不再走全局 `clipHost`。
  容器外（菜单走马灯）仍走全局 `clipHost`，行为逐字不变。
- **DEC-2 裁切子树 = 模板矩形 + 三通道子节点**。宿主工厂 `createClip(key, group, x, y, w, h)` 建：
  `UI:<容器>·clip`（父节点自身 `Graphics` 画 α0 模板矩形、`stencilStage = ENTER`）→ 子 `Graphics` /
  `BlitLayerUI` / `Labels`。三类命令同属模板子树 ⇒ 同罩。⛔ 不引 `cc.Mask`（mask 模块关闭，
  `addComponent(Mask)` 会打崩真机——同 `beads-blit-carrier` 判例）。
- **DEC-3 裁切后置层**。`unclip` 不能简单回到容器默认层（那会把收尾 chrome 画到被裁内容**下面**）。
  内核在裁切子树之后追加同组后置层 `UI:<容器>·post`，`unclip` 后的命令落在这里 ⇒ 滚动条 / 固定 chrome
  仍压在被裁内容之上。
- **DEC-4 每容器每帧一次裁切，不叠套**。重复 `enterClip` 返回 false（warn-once）⇒ 渲染器回落全局
  `clipHost`；结构门把这种写法判红（见 DEC-6）。
- **DEC-5 帧首复位模板**。`beginFrame` 除了清三通道，还调 `UiClipChannels.reset()` 清模板 + stencil
  stage 归零（同 `beads-blit-carrier::beginFrame`）——本帧没用裁切时，上一帧的模板不得罩住后续兄弟层。
  裁切矩形跨帧复用，`setRect` 只重画模板、不重建节点。
- **DEC-6 结构门改判**。`checkUiContainerOrder` 第 4 条由「容器内零 `clip`」改为「`clip` / `unclip` 成对且
  不叠套」；容器内裁切合法，叠套 / 悬空 / 帧尾未闭合仍判红。

## 3. 备选与取舍

| 案 | 内容 | 拒因 |
|---|---|---|
| 甲 | 保持「跳过半行 + 松手吸附」 | 用户已明确否决：拖动过程必须看到半行被裁切显示 |
| 乙 | 让全局 `clipHost` 在容器内也能正确工作（把位图 / 文字挂进全局蒙版） | 蒙版在容器外 ⇒ 被裁内容跳出容器层序，ADR-0033 的容器边界失效 |
| 丙 | 只用 `Labels` / 位图的节点裁剪，不裁矢量 | 半行 cell 的厚木底板是 `blit`、名称是 `text`，只裁一类仍会露出另一类 |

## 4. 后果

- **改动面**：`packages/framework/src/adapters/cocos/ui-scope-tree.ts`（内核）→ `cocos-renderer.ts`
  （`clip` / `unclip` 分支优先逐容器）→ `games/beads/cocos/.../bindings.ts`（cc 薄壳）→
  `games/beads/src/view/meta-settings-page.ts`（发 `clip` / `unclip`）→
  `settings-content.ts`（只跳过完全在窗外的行）→ `beads-shell.ts`（删松手吸附）。
- **draw call**：每个用到裁切的容器 +1 个 `Graphics`（模板）。当前仅设置页 1 处 ⇒ 可忽略；
  模板子树在容器内，不改变容器间层序。
- **金样本**：`settings` 帧 +2 条命令（`clip` / `unclip`）⇒ total / sha 变化，按
  `tests/ui-golden-capture.ts` 在提交锚重抓（K-051 / K-053）。
- **真机**：stencil 模板腿沿用 `beads-blit-carrier` 的已证形态，但「容器内 + 位图 + 文字同罩」的
  读数仍需真机确认（`[R]`）。本 ADR 的 Node 侧证据 = 内核单测 + 结构门 + 金样本。
