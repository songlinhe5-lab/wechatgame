# ADR-0012 — 构建层语言契约：源码层禁用对非数组的展开（Array.from 替代）+ 类型级 CI 守卫

- 编号：ADR-0012（0008 预约给「每日挑战」未落盘 = 跳空合规；0009/0010/0011 已用）
- 状态：**Accepted**（2026-09-14，WXG-T-090 · 波次 2「真机可玩性第一锁」；修法策略由主理人/用户拍板）
- 关联：`docs/engine-reference/cocos/VERSION.md §3 G10`（根因取证，WXG-T-082）、`control-manifest.md §15`、ADR-0002（core 纯 Node 可测）
- 零冻结常量改动：**不触** `systems-index §3`（G10 是语言契约缺陷，非数值改动）

## 1. 上下文（Context）

Cocos Creator 3.8.8 的脚本打包（packer-driver + Babel）在**所有平台**上把 TS 源码降到 **ES5**。降到 ES5 本身可接受，问题是它引入了一处**语言语义不对称**（本轮已定位到产物字节，非推测）：

| 构造 | 产物形态 | 对 `Set` / `Map` / `Map.keys()` / 字符串是否保语义 |
|---|---|---|
| `for (const x of iterable)` | `_createForOfIteratorHelperLoose(o)`，**先查 `o[Symbol.iterator]`** | ✅ 正常 |
| `[...iterable]`（数组展开） | **`[].concat(x)`**（loose 展开；产物里根本没有 `_toConsumableArray` 助手） | ❌ **不展开**：`concat` 只把非数组实参当单个元素追加 ⇒ 长度恒 1 |

`[].concat(new Set([1,2,3]))` ⇒ `[Set]`（length 1）；`[].concat(map.keys())` ⇒ `[MapIterator]`（length 1，且迭代器已被消费）；`[].concat("555555")` ⇒ `["555555"]`（**整串当一个字符**）。

后果链（G10，真机/浏览器加载 `build/web-mobile` 实测）：
`patternColors()`（`beads/src/config/levels.ts:78`）恒返回长度 1 ⇒ `validateBeadsLevel` 的「色数 ∈ [3, BEAD_COLOR_MAX]」全灭 ⇒ `_boot()`（`beads-game.ts:903-906`）早退 ⇒ **8 关全卡 `phase = "boot"`，真机完全不可玩**；`buildStagePattern`（同文件 `:245`）的字符串展开另致 **sprint 模式硬崩溃**（锯齿 pattern ⇒ `grid.ts:50` 读到 `undefined` ⇒ `charCodeAt` 抛错）。

三路径对照证明这是**构建层缺口，不是游戏逻辑缺陷**：Node/vitest ✅ 184 全绿、harness（`tsc` ES2020）✅ 可玩、**Cocos 产物 ❌**。

约束（决定备选可行性的硬事实，本轮逐条核实）：

1. **无工程级构建目标开关**。`games/beads/cocos/settings/v2/packages/builder.json` 与 `program.json` 已只剩 `__version__` 字段；ES5 降级烧在 packer-driver 内部、按平台固定。⇒ 提 target 属**编辑器产物面 + 引擎内部行为**，本仓库不可控（且改 `settings/**` 越出 L1 精神）。
2. **目标 runtime 具备 ES2015 built-ins**。产物里 `new Set()` / `new Map()` 原生出现、全 bundle 无 core-js polyfill ⇒ Babel 只做语法降级、不注入 built-in。`Array.from` 与 `Set`/`Map` 同为 ES2015 built-in static，Babel **不转译 built-in static**（产物已实证：修复后 `Array.from(` 命中 6 次、原样保留，恰等 6 处真伤点）⇒ 可用。
3. 框架 core 有 L2 契约（纯 Node 可跑）；游戏 src 有 L3 契约（不 import `cc`）。守卫必须能**在无 Cocos 的情况下**给出红/绿判定。

## 2. 备选方案（Alternatives）

**方案甲（采用）：源码层 `Array.from(x)` 替换 + 类型级静态守卫**
- 事实：改动面 = 6 处真伤点（框架 2 + beads 4），纯 JS 语义等价改写，不碰构建配置、不碰引擎、不碰 `.scene/.prefab/.meta`；`Array.from` 走 built-in（见约束 2）。守卫 `tools/scripts/check-es5-spread.mjs` 用 **TypeScript 真实类型检查器**（仓库已有 TS 5.9.3）在 AST 上遍历三类展开位（数组展开 / 调用展开 / rest 解构），**不可证明为数组即红（fail-closed）**，1.8s 跑完 78 个入库源文件，零 Cocos 依赖。
- 成本：6 处改写 + 一条常驻守卫（每次 `verify` 都跑）。

**方案乙：纯显式循环（`for` + `push`，彻底不用任何展开/`Array.from`）**
- 事实：对 runtime built-in 缺失的容错最强（只依赖 `Array.prototype.push`）。
- 否因：改动面从 6 处膨胀到「凡涉及集合快照处」（含 `releaseAll` 边遍历边删的快照语义）；可读性下降，且**不消除**语言契约缺口——下一位开发者写 `[...set]` 一样崩，仍必须有守卫。守卫既然无论如何都要建，乙相对甲无额外收益，只有噪声。

**方案丙：提 Cocos 构建 target 到 ES2015+（保留原生迭代器语义）**
- 事实：`builder.json` / `program.json` 仅剩 `__version__`（§1 约束 1）⇒ **无仓库内可编辑开关**；要改只能动编辑器内部配置或等上游 packer 版本，构建产物面不可控、不可复现（且与 L1「不手改编辑器产物」冲突）。
- 另：即便可提，也只解决**本工程**；`Array.from` 写法在 harness/Node/微信 runtime 下一致，target 提级会同时改变其余语法降级面（class/async 等），回归面远大于收益。
- 否因：**不可控**。本 ADR 不予采用；若未来 Cocos 暴露工程级 target 开关，按 §5 复评。

## 3. 决定（Decision）

1. **全仓入库源码（framework `src/**` + `games/*/src/**`）禁止对非数组可迭代对象使用展开语法**；一律 `Array.from(x)`。本轮修复 6 处真伤点（清单见 §4.1 与 VERSION.md §3 G10 表）。
2. **守卫即契约**：`tools/scripts/check-es5-spread.mjs` 挂进根 `package.json` 的 `verify` 链（`check:arch` 之后、`check:secrets` 之前），违规 exit 1 阻断；类型不可判定同样判红（fail-closed），逃生阀为行内 `// es5-spread: allow <原因>`（可 grep、需评审）。
   - **有效性自测**：`pnpm run check:es5spread:selftest`（`tools/scripts/check-es5-spread-selftest.sh`）——基线绿 → 种植 5 类缺陷（ES-01 Set / 迭代器 / 字符串、ES-02 调用展开、ES-03 rest 解构）**必得恰好 5 条红** → 清理回绿且工作树无残留；同次断言**安全数组展开与逃生阀行不得误报**。对应 lessons **K-030**（“脚本自测会假绿”——必须实测到红）。
   - **扫描面不得静默落空**：某游戏有 `src/` 却无 `tsconfig.json` → 直接红；登记在册的 program 扫出 0 个入库源文件 → 直接红。对应 lessons **K-031 / K-033**（枚举清单漏项 → 静默失效）。
3. **只改 SSOT 源**，`games/*/cocos/assets/scripts/**` 镜像副本一律经 `pnpm run framework:sync` 产出，禁手改（BD-20 教训），并靠 `framework:sync:check` 保证一致。
4. **不改任何 `games/*/cocos/settings/**`、不碰引擎配置、不改 `systems-index §3`**。

## 4. 后果（Consequences）

**4.1 正面**
- G10 解除：真机/浏览器产物 BOOT 校验通过，8 关可进 PLAYING；sprint 不再硬崩溃。改动点（含被 `framework:sync` 带出的镜像副本）：
  | # | 位置 | 展开对象 | 改法 |
  |---|---|---|---|
  | 1 | `packages/framework/src/core/save/storage.ts` `MemoryStorage.keys()` | `Map.keys()` 迭代器 | `Array.from(this._map.keys())` |
  | 2 | `packages/framework/src/core/pool/object-pool.ts` `releaseAll()` | `Set`（`_inUse`） | `for (const item of Array.from(this._inUse))` |
  | 3 | `games/beads/src/config/levels.ts` `patternColors()` | `Set`（`seen`） | `Array.from(seen).sort(...)` |
  | 4 | `games/beads/src/config/levels.ts` `buildStagePattern()` | `string`（`row`） | `Array.from(row).map(...)` |
  | 5 | `games/beads/src/systems/powerups.ts` `get holding()` | `Set`（`_holding`） | `Array.from(this._holding).filter(...)` |
  | 6 | `games/beads/src/systems/powerups.ts` `noteCapacity()` | `Set`（`_holding`） | `for (const slot of Array.from(this._holding))` |

  **数量未变（6 → 6）**：本轮以 AST 遍历全量复扫（含调用展开与 rest 解构、含 breakout 与 framework 其余文件），无第 7 处真伤点；其余 8 处展开的对象本就多数组（`render-model.ts` / `curve.ts` / `levels.ts` 的 `STAGE_PATTERN_POOL` / `beads-game.ts` 两处 / `powerups.ts` 两处 / `view-model.ts` 的 `arcPoints` 调用展开），**刻意不动**（改它们是噪声）。breakout 侧受影响的是 #1 #2（框架 core 共用），一并由 sync 带出。
- 契约可执行、可阻断、无引擎依赖：守卫不依赖 Cocos 编辑器/CLI，本地与 CI 同速（1.8s）；类型级判定 ⇒ **注释里的 `[...set]` 字样不会误报**（已实测：文档注释含该串时守卫仍绿）。
- 未来同类缺陷（新代码展开一个 `Set`）在 PR 阶段即红，而不是在真机上「全部卡 boot」。
- 语义等价，Node/vitest 基线不动（无行为变更，184 + framework 全量仍绿）。

**4.2 负面（已知成本，白纸黑字——不是「风险」）**
- **本修法不消除构建层的固有不对称**：语法照旧降级到 ES5、built-in 照旧不 polyfill。我们只是**绕开**了「展开」这一处触发面。`for-of`/`Array.from`/`Set`/`Map` 能活，靠的是「runtime 恰好具备 ES2015 built-ins」这一**外部事实**，不是构建配置的保证。
- 若某个更老的真机 runtime（或未来某次 Cocos 版本变更）**真的缺 `Array.from`**，同一位置会以另一种形式复现（`Array.from is not a function`）；本 ADR 的兜底是「守卫挡住新写法的展开 + 复评触发条件」，**不是**运行时兼容证明。⇒ 已知未证事项见 §4.3。
- 守卫的判定强度依赖类型信息：**框架 core 刻意 fail-closed**，因此 `ArrayLike<T>`、`NodeList` 这类 array-like 也要么改 `Array.from`、要么写行内 `es5-spread: allow` 注释——逃生阀一旦被滥用，规则形同软约束（靠评审与 grep 兜底）。按 lessons **K-025**（「门禁里的特殊豁免要早删」）的口径：本豁免是**临时口而非长期机制**，一旦连续两个任务出现无理由使用，应收紧为「豁免必须同批写入 ADR 复评记录」或直接删除。
- 「安全展开不要改」这条判断本身要人读：同一文件内 `levels.ts` 的数组展开（保留）与字符串展开（必改）并存，认知成本高，靠守卫免除了人工记忆，但**代码评审时仍可能被误"清理"回去**（注释已标 ADR-0012）。
- **入库源码的注释里不得写字面形式**（既无 `[...x]` 也无 `[].concat(x)`）：注释会随 debug 构建进产物，从而**污染产物 grep 取证**（本轮实测踩过两次：一度 12 处 `[].concat(` 命中里有 4 处、`Array.from(seen)` 命中里有 1 处来自我自己的注释）。代价是注释只能写描述性语言，表达上有限折损；产物旁证因此保持“数字等于修复点数”的可读性。
- 每次 `verify` 多 1.8s；三处 tsconfig 各建一个 `ts.Program`，守卫比正则版重（换来零误报/零漏报）。

**4.3 中性 / 待观察**
- **微信小游戏 runtime（iOS JavaScriptCore / Android V8）与 web-mobile 浏览器是否都原生具备 `Array.from` + 可迭代 `Set`/`Map`**：本仓库无 AppID/真机，**未做真机实测**；spike 只证明了「产物已原生使用 `new Set`/`new Map` 且无 polyfill」。判定为「同级别 built-in，风险低」，但**证据等级低于源码修复本身**，须由真机 BOOT 复验（GAP/发布阶段）关闭。
- 主包内 `build/` 产物不入库（`.gitignore`），产物级复验只在本地留下结论；CI 侧以源码守卫为准。
- **两侧构建产物均已重建核对**（beads web-mobile 17.4s / breakout web-mobile 13.8s）：框架 #1 #2 在 breakout 产物里也已从 concat 形态转为 `Array.from`（各自剩余命中均为真数组展开）。**唯一未刷新**：`games/breakout/cocos/build/wechatgame/`（release、已压缩）仍为旧产物，内含一处 `[].concat(n)` 无法静态判定 ⇒ 重建需 AppID，待发布阶段一并处理并复核。
- `--dist` 后置扫描（同脚本）只做「列出 `[].concat(` 供人看」，**不做红/绿判定**——因为多数组展开本就该编成 `[].concat(arr)`，硬判必误报。

## 5. 复评触发条件（Review Triggers）

- **真机出现 `Array.from is not a function`**（或最低支持机型跌破 ES2015 built-ins）⇒ 本修法失效，必须重开方案讨论（polyfill 注入 / 方案乙显式循环 / 自建 `toArray()` 工具函数）。
- **Cocos 工程级暴露构建 target / Babel 配置开关**（或 packer-driver 升级后 spread 转译带 iterable 分支）⇒ 复评方案丙，并把守卫降级为「提醒」而非「阻断」。
- **出现第二例「构建层与源码层语义不一致」缺陷**（非展开类：如 optional chaining/`??`/class fields/`useDefineForClassFields` 在产物里变形）⇒ 说明「绕开单个语法面」策略已到上限，应升为**构建产物冒烟**（提审前在目标 runtime 跑一次核心 BOOT 断言）作为独立质量门。
- 新游戏（第三款）接入时若守卫误报频发或逃生阀被反复使用 ⇒ 复评守卫判据（是否引入 `ArrayLike` 白名单、或改由框架提供统一 `toArray()`）。
- 若未来 `framework:sync` 改为「构建期生成镜像」或镜像入库策略变化 ⇒ 复评 §3.3 的 SSOT 纪律表述。
