# dev/harness — 浏览器验证器

在**浏览器里直接跑真实游戏**，不需要 Cocos Creator 编辑器，也不需要微信开发者工具。

它加载的不是"演示版"代码，而是与微信小游戏构建**完全相同**的那套模块图：
真实的 `App` 组合根、真实的 `GameServices`、真实的关卡数据 —— 只是把渲染换成了
Canvas2D 适配器。所以在这里看到的行为，就是真机上的行为。

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

## 操作方式

| 输入 | 行为 |
|------|------|
| `←` `→` | 移动挡板（键盘） |
| 拖拽 / 触摸 | 移动挡板（指针，设计空间坐标） |
| `空格` 或 `Enter` | 发球 · 失败后重试 · 通关后重开 · 暂停后继续 |
| `1`–`5` | 直接跳到第 N 关 |
| 左上角按钮 | 同上（L1–L5 / 重新开始） |

左上角 HUD 实时显示：`phase`、关卡、分数、剩余生命、连击（倍率）、剩余砖块数、球半径。

调试时可以在控制台直接操作：

```js
window.__breakout.game.snapshot   // 当前状态快照
window.__breakout.app             // 组合根（services / viewport / input）
window.__breakout.game.goToLevel(2)
window.__breakout.fitCanvas()
```

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
                    └─ ../../games/breakout/src/... （普通相对路径）
```

- **编译**：`tsconfig.harness.json` 是仓库里唯一 `noEmit: false` 的配置，
  它把 `packages/framework/src` + `games/breakout/src` + `dev/harness` 一起
  编译到 `dev/harness/dist`，并**排除** `adapters/cocos/bindings.ts`
  （那个文件静态导入 `cc`，只能在 Cocos 编辑器里解析）。
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
