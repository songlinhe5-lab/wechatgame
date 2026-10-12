# WXG-T-271 · boss 缩略静态位图臂 投放取证（2026-10-12）

> 结论一句话：**装载腿全绿、位图也确实进了主包，但选关墙上看不见**——被 `Graphics` 层盖住。
> 「无 warn + blit 命令已发出」**不能**当「已上屏」证据。裁定影响见 `ADR-0031 §6` 2026-10-12 行。

## 1. 环境与前置

| 项 | 实况 |
|---|---|
| 引擎 | Cocos Creator **3.8.8**（`/Applications/Cocos/Creator/3.8.8`），工程 `games/beads/cocos`，**编辑器实例开着也能 CLI 构建**（实测，见 `build-cocos.mjs` 头注） |
| MCP | `http://127.0.0.1:3000/mcp`（28 tools）。`asset_system.refresh` **能**驱动导入并生成 `.meta`；`project_build_system` **不能**触发构建（只有 get/open/check） |
| AppID | `build/project.config.json` = `wx63c62151a1c0cf3b` ⇒ wechatgame 平台可构建 |
| 资产 | `games/beads/design/levels/assets/l9-boss-mandala-256.png`（**38,386 B**，256²）→ 拷进 `cocos/assets/textures/`（已配 Bundle、已合并进主包） |

`.meta` 由编辑器生成（uuid `43806801-afc9-4115-99d3-2cd0ff13b715`），**未手写** ⇒ 合 L1。

## 2. 包体实测（`check:size`）

| 档 | 主包 | 文件数 | 判定 |
|---|---|---|---|
| 投放前基线（10-07 产物） | 2939.8 KB | 43 | ⚠ 越 2000 内部目标（既存） |
| 投放后 debug | 6246.5 KB | 46 | ❌ 数字**不可作基线**（含 sourcemap／未压缩，工具自标） |
| 投放后 **`--release`** | **2979.0 KB** | 46 | ✅ 未越 4096 平台红线；⚠ 仍越 2000 内部目标（**非本张造成**） |

净增量 **+39.2 KB**（= 原图 38,386 B + `import` 索引 72 B + `@f9941` 571 B）。产物结构实测：
`assets/textures/native/43/43806801-….png`、`assets/textures/import/43/43806801-….json`、`…@f9941.json`。

## 3. 运行时取证（web-mobile 产物 + 浏览器）

装载腿逐条命中（console 原文）：

```
[BeadsBlitCarrier] mask 装载腿 = bundle `textures`
[BeadsBlitCarrier] masks=4/4 carrier=on
```

**未出现**这一行（即装载没失败）：

```
[BeadsBlitCarrier] boss 位图 `bitmap__boss_l9`（l9-boss-mandala-256）未就绪 ⇒ 该关缩略走程序化回退
```

运行时对象核对：`ImageAsset l9-boss-mandala-256` = 256×256 已 complete；
`carrier._bitmaps = { bitmap__boss_l9 → SpriteFrame(256²) }`；选关墙那一帧 `_builder._commands`
内含 **1 条 blit**：`{kind:"blit", textureId:"bitmap__boss_l9", x:120, y:481, w:84, h:84}`。

**但截图上第 9 格是纯槽底色**：同坐标 `gl.readPixels` 测得 `avg(247,246,251) / 1 个色桶`，
而对角第 1、2 格同法测得 73／85 个色桶（= 有内容）。

## 4. A/B 互证（定位到层序，非资产、非加载）

| 对照 | 操作（仅页面运行时，未改文件） | 结果 |
|---|---|---|
| A | 从 `carrier._bitmaps` 摘掉该位图 ⇒ resolver 返 `undefined` ⇒ 走程序化臂 | 第 9 格**立刻出现**珠子网格缩略（`Graphics` 腿可见） |
| B | 隐藏 `Graphics` 节点 | 曼陀罗原图**立刻显形**（blit 腿一直在画，只是被盖） |
| C | 关动态图集 | 第 9 格仍空白（排除图集嫌疑） |

根因：`ADR-0030 S5′-3` 为「珠子不盖暂停/结算面板」定的层序是
`Background → BlitLayer → Graphics → Labels`（`bindings.ts:200-215`），
而选关墙卡片底与 9 个槽位矩形全由**后置**的 `Graphics` 绘制 ⇒ 挂在 `BlitLayer` 上的位图必然被盖。
**同一个 `drawLevelThumb` 的两条臂落在不同层，只有 `Graphics` 那条在 UI 上可见。**

## 5. 判据修订（本腿收工标准）

1. ❌ 旧口径（不足）：资产已导入 + 无「未就绪」warn + blit 命令已发出。
2. ✅ 新口径：**目标屏截图内该槽位有色桶数 > 1，且与程序化臂的 A/B 能互相切换**（本单 §3/§4 的形式）。
3. 前置缺口：位图臂需要落在 `Graphics` **之上**、`Labels` 之下的独立 UI blit 节点（或消费方声明层级）；
   闭合前投放 = +39.2 KB、**零视觉收益** ⇒ `control-manifest §19`「守卫未归位前禁止投放」仍成立。
4. 双实现缺口：`setLevelThumbBitmapResolver` 只有 Cocos host 调，**harness 未注入平行腿**
   ⇒ 日常浏览器 harness 里永远只看到程序化缩略（`ADR-0031 §4.2` 条 3 坐实）。

## 6. 复现法（证据可重跑）

```bash
pnpm --filter beads run build:cocos -- --release   # 包体数只对 release 有意义
pnpm run check:size games/beads/cocos/build/wechatgame
pnpm --filter beads run build:cocos:web            # 渲染取证走 web-mobile
python3 -m http.server 8899 -d games/beads/cocos/build/web-mobile
# 打开 http://127.0.0.1:8899/index.html，进选关墙看第 9 格；
# console 里查 carrier._bitmaps / _builder._commands 的 blit，再做 §4 的 A/B
```

原始截图 9 张在 `temp/evidence-0*.png`（`production/qa/*/evidence/**/*.png` 按 `.gitignore:100` 不入库，
可按本节复现）。关键三张：`05-level-wall-9`（空白）、`07-fallback-ab`（摘位图→网格）、`08-bossblit-zoom`（隐 Graphics→曼陀罗）。

---

## 7. 同日修复与复测（§5 条 3 缺口已闭合）

改动（层序新增一个节点，两条腿各落一层）：

| 文件 | 改了什么 |
|---|---|
| `packages/framework/src/adapters/cocos/bindings.ts` | 新增 `BlitLayerUI` 节点，插在 `Graphics` 之后、`Labels` 之前 ⇒ 实序 `Background → BlitLayer → Graphics → BlitLayerUI → Labels`；`createBlitCarrier(layer, uiLayer)` 多一个形参 |
| `games/beads/cocos/assets/scripts/host/beads-blit-carrier.ts` | `accept()` 按腿选父节点：tint 腿→`BlitAtlas`（珠下），静态位图腿→`_uiLayer`；池位共用，仅在 `parent` 真变时 `setParent`（热路径仍零分配）；装载成功新增一行 `console.log`（不再只靠「无 warn」） |
| `BeadsBootstrap.ts` + 框架镜像 | 透传第二形参；`sync-framework-to-cocos.mjs` 同步，`framework:sync:check` OK |

复测（同一产物重构建 + 浏览器，逐条对 §5 新口径）：

| 判据 | 结果 | 实测 |
|---|---|---|
| P1 装载日志 | ✅ | `[BeadsBlitCarrier] boss 位图 1/1 已装载 ⇒ 落 UI blit 层` |
| F1/F2 失败日志 | ✅ 零命中 | 无「未就绪」无「丢弃 blit」；`_bailed` 空集 |
| **P2 第 9 格有像素** | ✅ | 旧失败签名 `avg(247,246,251) / 1 色桶` → 现 **`avg(76,75,71) / bucket16=79 / exact=564`**；同法测**空白槽对照区仍精确复现旧值**（坐标与量法可信） |
| P3 A/B 可逆 | ✅ | 摘 `_bitmaps` ⇒ blit 命令 1→0、第 9 格立刻出 46 个 circle（网格臂）；还原 ⇒ 数字与首帧逐位一致 |
| P4 层序无回归 | ✅ | 局内盘面 `bucket16=153`、228 个珠 sprite 在跑；结算面板卡区**无一个珠色**；临时关 `Graphics` ⇒ 珠色立刻回来（遮挡方向仍为面板压珠） |

证据产物（新三张）：`temp/ax-bossblit-06-levelwall-bitmap-on.png`（第 9 格出图）、
`07-…-bitmap-removed-fallback.png`（A/B）、`08-…-restored.png`（还原）；`04-settle-panel-over-beads.png`（P4）。

**两条必须跟着环的保留意见**：

1. **取证环境**：本轮页面处于后台（`visibilityState=hidden` ⇒ rAF 冻结、引擎不起），取证是在
   手工泵帧 + 重跑 `cc.game.init/run` 下拿到的，中途画布降到半分辨率。方向明确（且产物 JS 内层序已
   静态核对为 `…Graphics → BlitLayerUI → Labels`），但**窗口置前复跑一次做双证**仍是待补项；真机那半未证。
2. **新层序的必然推论**（非回归，备案）：`BlitLayerUI` 在 `Graphics` 之上 ⇒ 将来若「位图缩略与
   暂停/结算面板同屏」，位图会盖面板。当前不可达（选关墙无面板、局内无位图 blit）。

## 8. 遗留：素材自带不透光黑底（美术账，不记在层序上）

`l9-boss-mandala-256.png` 实测：mode RGBA 但 **alpha=0 占比 0.00%（全不透光）**、**近黑像素（RGB<20）占 67.4%**、
四角 = (1,0,0)/(0,0,1) 纯黑。⇒ 屏上呈现为「浅色卡底里一个黑方块 + 中间彩色曼陀罗」（P2 的 53% 黑即此，
属忠实还原，**不是** alpha/混合 bug）。若要干净缩略，需抠图去黑底或加圆角遮罩——走 `wxgame-image-gen`
的本地 PIL 洪水填充那条腿，另开单。
