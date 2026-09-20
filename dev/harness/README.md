# dev/harness — 浏览器验证器

在**浏览器里直接跑真实游戏**，不需要 Cocos Creator 编辑器，也不需要微信开发者工具。

它加载的不是"演示版"代码，而是与微信小游戏构建**完全相同**的那套模块图：
真实的 `App` 组合根、真实的 `GameServices`、真实的关卡数据 —— 只是把渲染换成了
Canvas2D 适配器。

> ⚠️ **「在这里看到的行为就是真机上的行为」这句话需要限定（2026-09-14，WXG-T-082）。**
> 它对**玩法逻辑**成立（同一份 `games/*/src`、同一份 core），但对**坐标与文字渲染不成立**：
> harness 是仓内唯一违反「屏幕坐标 = CSS px」契约的宿主（**GAP-07**），且 Canvas2D 适配器的
> `text` 分支未补偿 y 翻转（**GAP-08**）。两者均**仅存于 harness**，已在 Cocos web-mobile 产物上
> 反证（详见 **ADR-0011** §1.3/§1.4）：
>
> | 症状 | 在 harness | 在 Cocos 产物 |
> |---|---|---|
> | GAP-07 点击全不中（DPR=2 时设计坐标偏差 dx=+1025 / dy=−482） | ❌ **复现** | ✅ 不复现（`fit` = CSS px 754×456，backing 1508×912 分层正确） |
> | GAP-08 文字垂直镜像 | ❌ **复现**（3 帧 24 次 `fillText`，CTM 均为 `d = −0.3418`） | ✅ 不复现（文字走 8 个原生 `Label` 节点，y 为正=上，无 ctx 变换） |
>
> **⇒ 在 T-087 修好之前，任何基于 harness 目视/点击的结论都必须标注 `[Harness-坐标未修]`。**
> 可用的是：状态机、数值、事件、快照、`snapshot` 断言、以及**不依赖坐标的绘制计数**。

---

## 快速开始

```bash
# 1) 编译 + 启动（默认 http://127.0.0.1:4173/）
node tools/scripts/serve-harness.mjs

# 也可以走 pnpm 别名
pnpm harness
```

启动后浏览器打开 <http://127.0.0.1:4173/>。

不需要 `pnpm install` 之外的任何依赖：脚本自己调用仓库里的 `tsc` 编译，
再用一个约 120 行的静态文件服务器把产物喂给浏览器。**没有打包器。**

### 常用参数

| 参数 | 作用 |
|------|------|
| `--port 3000` | 换端口（默认 4173） |
| `--host 0.0.0.0` | 让同一局域网内的手机访问真机调试 |
| `--no-build` | 跳过编译，直接服务磁盘上已有的产物（启动更快） |
| `--build-only` | 只编译、不启动服务（CI / 提交前检查用） |

---

## 操作方式（breakout）

| 输入 | 行为 |
|------|------|
| `←` `→` | 移动挡板（键盘） |
| 拖拽 / 触摸 | 移动挡板（指针，设计空间坐标） |
| `空格` 或 `Enter` | 发球 · 失败后重试 · 通关后重开 · 暂停后继续 |
| `1`–`5` | 直接跳到第 N 关 |
| 左上角按钮 | 同上（L1–L5 / 重新开始） |

左上角 HUD 实时显示：`phase`、关卡、分数、剩余生命、连击（倍率）、剩余砖块数、球半径。

---

## beads（拼豆填色消除）

### 开两款 / 切换

| URL | 进入 |
|------|------|
| <http://127.0.0.1:4173/> | breakout（默认） |
| <http://127.0.0.1:4173/?game=beads> | beads·普通模式 |
| <http://127.0.0.1:4173/?game=beads&mode=sprint> | beads·冲刺模式 |

页面右上角有一个 `beads` / `breakout` 切换链（`index.html` L115）。两款共用同一个 `App` 实例与同一个
canvas，因此**切款 = 重新加载页面**，不是热切换。

### 操作（与 breakout 不同，别沿用上一节的表）

| 输入 | 行为 | 实现位置 |
|------|------|------|
| 点托盘珠 | 选中该槽（再点一次取消） | `selectTraySlot(i)` |
| 点盘面子格 | 落子（颜色不匹配则被拒） | `tapGridCell(row, col)` |
| `空格` / `Enter`（**game-over**） | 重试本关 | `main.ts` L143-145 |
| `空格` / `Enter`（**finish**） | 重开整轮 | `main.ts` L146-148 |
| `空格` / `Enter`（**playing**） | **无作用**（`default: break`） | `main.ts` L149-150 |
| `空格` / `Enter`（**paused**） | **无作用**——`onResume()` 是故意的 no-op | `beads-game.ts` L450（WXG-T-055 D-04） |
| HUD 齿轮 | **暂停的唯一入口** | `gdd/pause-settings.md` §2.1 单通道原则 |
| 面板按钮 | **离开 PAUSED 的唯一出口** | `gdd/pause-settings.md` §2.2 |

> ⚠️ **文案与实现曾经相反（WXG-T-082 已对齐）**：`main.ts` L276 的 console 提示原写「`Space pauses/resumes`」，
> 而 beads 分支（L138-152）在 `playing` 态根本不处理空格；`paused` 态虽调了 `onResume()`，但那是 D-04 刻意保留的
> 空实现。**按 GDD 单通道原则，实现是对的、文案是错的**，故本轮只改文案（未改行为）。
> ❗ **同源错文案仍在 `index.html` L126**（「空格 暂停/继续」），该文件不在 WXG-T-082 的 Output Path 内，
> **待主理人批准后一并对齐**。

### 控制台

```js
window.__beads.game.snapshot        // 当前状态快照（phase / cells / traySlots / comboVfxKind …）
window.__beads.app                  // 组合根（services / viewport / input）
window.__beads.app.viewport.fit     // ← 查 GAP-07：screenWidth/Height 应为 CSS px，不是 canvas.width
window.__beads.fitCanvas()

// 常用注入（无公开入口的验证只能走这里）
window.__beads.game.giveTrayBead(5)     // 向首个空槽注入一颗色 5 的珠（返回槽位，-1 = 满）
window.__beads.game.goToLevel(3)
window.__beads.game.startSprint()
window.__beads.game.usePowerup('region')  // PowerupType 只有三个值：'region' | 'clearAll' | 'random'（tuning.ts L125）
window.__beads.game.tapDesign(x, y)     // 直接送设计空间坐标，绕过指针链路
```

> `window.__breakout` 与 `window.__beads` **两个全局同时存在**（`main.ts` L265-268），但只有 URL 选中的
> 那一款被 `app.start()` 接管；另一款的 `game` 对象存在但不在帧循环里。

### beads 在 harness 上的已知缺口（不要当产品缺陷上报）

| 缺口 | 归属 | 备注 |
|------|------|------|
| GAP-07 点击全不中 | **仅 harness** | 真因：`main.ts` L92-93 送 `clientX * dpr`（device px）而 viewport 是 CSS px。裁决见 **ADR-0011**，落码归 **T-087** |
| GAP-08 文字垂直镜像 | **仅 harness** | 真因：`canvas2d-renderer.ts` L133-141 未补偿 L82 的 y 翻转。修法必须**收窄在 `case 'text'` 内部**，禁改 L82 全局变换（会破坏 ▲/▽/♥/◐ 的形状编码） |
| GAP-01 空槽无目标色 | **产品缺陷**（两路径同复现） | `view/bead-render.ts::drawEmptySocket` 签名无 `colorIdx`，一律 `palette.slot`。实测：22 个空槽、3 种目标色、fill 只有一种 |
| GAP-02 开局空托盘 | **产品缺陷**（两路径同复现） | `_setupLevel` 只 `reset()` + 设 `spawnInterval`，无立即供料。实测 t=0 时 12 槽全空 |

⚠️ 另：Cocos 产物侧有一个 **harness 不会出现**的 P0（ES5 转译把 `[...Set]` 编成 `[].concat(Set)`，
导致 beads 卡 BOOT、冲刺崩溃）——见 `docs/engine-reference/cocos/VERSION.md` §3 **G10**。
**它在 harness 上不复现**（`tsconfig.harness.json` 用 `lib: ES2022`，保留原生迭代器），
所以「harness 能玩」不能用来推断「真机能玩」。

---

## 验证器验证了什么

```bash
node tools/scripts/smoke-harness.mjs
```

这个冒烟测试是**运行时**验证，不是"文件存在性"检查。它把浏览器将要加载的
同一份产物（`dev/harness/dist/**`）在 Node 里执行一遍，用最小 DOM/Canvas 桩，
然后断言：

1. **整条模块图可以求值** —— 没有顶层 `window` / `cc` / 缺 `.js` 扩展名之类的
   隐藏地雷（这类问题在浏览器里表现为"白屏 + 一行 console 报错"）；
2. **组合根能启动真实游戏** —— 平台被识别为 Web、存档被正规化、关卡被编译；
3. **一帧真的画出了东西** —— 渲染模型非空，且画布上发生了实际的绘制调用。

它还会检查：产物里除了 `@wxgame/framework`（由 `index.html` 的 importmap 映射）
之外，**不允许出现任何其它裸模块标识符**。这一条专门防守"框架 barrel 某天被
误加了静态 `import ... from 'cc'`"——那会让整个浏览器验证器连带崩溃。

---

## 它是怎么工作的

```
index.html ──<script type="importmap">
   │            "@wxgame/framework" → ./dist/packages/framework/src/index.js
   │
   └─<script type="module" src="./dist/dev/harness/main.js">
                    │
                    ├─ @wxgame/framework            （importmap 解析）
                    ├─ ../../games/breakout/src/... （普通相对路径）
                    └─ ../../games/beads/src/...    （普通相对路径）
```

- **编译**：`tsconfig.harness.json` 是仓库里唯一 `noEmit: false` 的配置，
  它把 `packages/framework/src` + `games/breakout/src` + **`games/beads/src`** + `dev/harness` 一起
  编译到 `dev/harness/dist`，并**排除** `adapters/cocos/bindings.ts`
  （那个文件静态导入 `cc`，只能在 Cocos 编辑器里解析）。
  ⚠️ **`lib` 是 `ES2022`，与 Cocos 构建的 ES5 转译不同**——这正是 G10（`[].concat(Set)`）在 harness 上
  不暴露的原因，也是「harness 全绿 ≠ 真机全绿」的一个具体例证。
- **模块解析**：`frameworks` 的裸标识符 `@wxgame/framework` 交给 importmap；
  其余全部是带 `.js` 扩展名的相对路径，浏览器原生就能解析。
- **main.ts 只做三件事**：把 DOM 事件喂给 `InputManager`、驱动帧循环、
  画一个调试 HUD。**这里没有任何游戏逻辑。**

### 改了代码之后

`serve-harness.mjs` 每次启动都会重新编译，并且 HTTP 响应带 `cache-control: no-store`，
所以改完源码刷新页面即可，不用重启服务。若只想重新编译：

```bash
node tools/scripts/serve-harness.mjs --build-only
```

---

## 目录约定

| 路径 | 是否提交 | 说明 |
|------|----------|------|
| `dev/harness/index.html` | ✅ | 页面骨架 + importmap |
| `dev/harness/main.ts` | ✅ | DOM 接线（唯一手写入口） |
| `dev/harness/dist/` | ❌ | `tsc` 产出，已被 `dist/` 规则忽略 |
| `dev/harness/.smoke/` | ❌ | 冒烟测试的临时副本 |

> 注意：这个验证器**不替代**微信开发者工具。它验证的是游戏逻辑与渲染，
> 不覆盖小游戏运行时（`wx.*` API、分包、开放数据域、真机性能）。发布前
> 仍必须走一次真机验证。
