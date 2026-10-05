# lessons · `engine-cocos-build` 分片（标签 `引擎Cocos构建`）

> `引擎Cocos` 片越 ctx B 门（8000 tok，WXG-T-260 沉淀批 8618）⇒ 按 `knowledge/INDEX.md` §4
> 「该标签内部再切」取向，把**构建产物 / 资产装载**类条目（K-108/111/112/113）子切为
> `引擎Cocos构建` 新标签新片；条目正文逐字节搬运，仅行内标签换名。
> ⛔ 本片**不新增任何豁免**（判例 WXG-T-041 + K-025「特殊豁免要早删」）。
> 引用只写 **K-0NN**；口径正本见 `knowledge/INDEX.md` §1–§4。

## 引擎Cocos构建

- **[引擎Cocos构建][K-108] 运行时按 uuid 字符串加载的资产不会进 Cocos 构建产物 ⇒ 「静默降级」必须配一条产物级门禁，源码引用 grep 与 config.json 明文 grep 都不算取证**（来源 WXG-T-255 / ADR-0030 §5.5，2026-10-05）
  现象：tint mask 四张定稿 PNG 齐备、`.meta` 在册、宿主 `MASK_UUID` 表四条都在，但构建产物里只有两张 ⇒ `warmup()` 恒凑不齐 ⇒
  注入前提永不满足 ⇒ 渲染臂静默落回回退路径，屏幕上看不出任何异常，而 `?carrier=on` 的收益在任何构建档都拿不到（编辑器 Preview 是唯一跑得通的环境）。
  根因：Cocos **构建期依赖分析**只打包被 `.prefab` / `.scene` / `.material(.mtl)` 静态引用的资产；代码里的 uuid **字符串**不构成引用。
  那两张"进了包"的图只是被某个材质/探针场景顺带带进去的假象——不是宿主引用生效。
  规避：① 凡"运行时按 uuid / 路径动态加载"的资产，一律配**产物级门禁**（在 `build/<平台>/assets/main/native/<uuid 前 2 位>/<uuid>.png` 逐张核在不在），
  ⛔ 不要靠"源码里 import 了 / assets 目录里有"推断已打包；② 取证面选择：`wechatgame` 档 `config.json` 的 `uuids` 存**压缩 base64** 形式
  ⇒ 明文 grep uuid 是**假阴性**（会误判成"一张都没进"）；`native/` 目录文件名就是明文 uuid，是无解索引的最短取证面；③ 注入前提写成「需求集齐张」而非「目录全量齐张」
  ⇒ 需求集由**单一纯函数**派生（两宿主共同消费），这样"缺张"能被临时接线绕过而验证闸门不被关闭；④ 门禁必须测**负腿**（放开宏 ⇒ 报缺张 FAIL），只会绿的门不算门；
  无产物时结论写 `SKIP` 并给解除条件，⛔ 静默报绿；⑤ **出路有两层，别把它们混成一层**：引擎侧 = 把资源所在**目录配成 Asset Bundle**（Creator 3.8：属性检查器「配置为 Bundle」，
  默认收录整个目录不看引用）或逐张补一条静态引用（后者每新增一张都要再挂一次材质，不自然）；
  「合并进主包」与「微信分包」不是一回事 —— 压缩类型默认「合并依赖」时 bundle 仍是**主包内的本地目录**（`assets/<bundle>/`），
  ⛔ 只有选「小游戏分包」才会挪进 `subpackages/`（那时才撞上微信分包规则）。Bundle 化有连带：资产离开 `main` ⇒ 全局 `loadAny({uuid})` 不再命中
  ⇒ 加载面需改 `loadBundle(name).load(path)`，⛔ 门禁也得逐 bundle 扫（只扫 `main/` 会把「已落地」误报成「没进包」）。
  判例引用：`tools/scripts/check-cocos-mask.mjs`、`games/beads/cocos/assets/scripts/host/beads-blit-carrier.ts`（`MASK_ASSETS` 头注与两腿装载）、`ADR-0030 §5.5`；同族 K-036/K-037（跑过 ≠ 检了）、K-106（门禁跑过 ≠ 新文件被看到）。

- **[引擎Cocos构建][K-111] 「顺手重建产物」前先确认构建档：脚本默认档（debug）≠ 门禁基线档（release）⇒ 一次重建就能原地覆盖在册产物并把包体门禁打红**（来源 WXG-T-256 / ADR-0030 §5.6，2026-10-05）
  现象：源码改动后为验证「产物里到底有没有生效」跑了一次 `pnpm -C games/<game> run build:cocos`（默认 `debug=true`）⇒ 产物主包由 2866.8 KB 涨到 6074.3 KB、`check:size` 当场 **FAIL**（超微信主包红线 4096 KB），
  而 `verify` 之前是 21/0 全绿——被覆盖的是**唯一一份**包体基线证据，且旧数字无法逐文件复算。
  根因：构建脚本默认 `debug=true`（含 sourcemap、不压缩），而包体红线只对 release 有意义；产物目录是**覆盖式**输出，没有档名分区，也没有「覆盖前备份/比对」的步骤。
  规避：① 目标是**验证代码是否进产物** ⇒ 用 debug（保留注释与符号名，`grep <函数名>` 只剩注释命中即证明函数已删）；目标是**刷新基线证据** ⇒ 必须 `-- --release`；
  ② 跑前先看真相源 = `cocos/temp/logs/cli-build-<platform>-release.log` 的 mtime（比 `build/` 目录时间更能说明上一次是什么档）；
  ③ 用户报「改了但画面上还在」时，**第一步比 `build/` 与 `src/` 的 mtime**，别先怀疑漏删——产物时间戳早于源码 = 必然旧画面；
  ④ 覆盖后 `check:size` 若报「疑似 debug」（`cc.js` ≥ 2500 KB 启发）⇒ 先换 release 复测再谈治理，⛔ 不要按 debug 数字去动分包。
  判例引用：`tools/scripts/build-cocos.mjs`（`RELEASE = argv.includes('--release')`，默认 debug）、`tools/scripts/check-bundle-size.mjs`（`debugSuspect` 启发 + K-089 内部目标口径）、`ADR-0030 §5.6`；同族 K-036/K-037（跑过 ≠ 检了）。

- **[引擎Cocos构建][K-112] 异步资源的「只取一次」memo 要记 Promise，不能记「试过」标志位 + 结果槽**（来源 WXG-T-256 / ADR-0030 §5.6，2026-10-05）
  现象：载体 warmup 对四张 mask `Promise.all` 并发调 `ensureMaskBundle()`；该函数第一行 `_maskBundleTried = true` 后立刻返回，后三个调用方进来看见 flag 已置、结果槽还是 `null` ⇒ **当场拿到 `null`** 走「按 uuid 全局取」回退腿；而两张已离开 `main` 的资产在全局腿解不出 ⇒ 产物实测 `masks=2/4 carrier=off`（灰度闸明明打开，画面仍是矢量臂）。
  根因：把「同步返回一个值」的 memo 模式（flag + 槽）套到了**异步**求值上——槽只在回调里被填，而并发调用方不等它。
  规避：① 单例异步初始化一律缓存 **Promise 本身**（`if (!p) p = new Promise(...); return p;`），失败结论也缓存（把 `null` resolve 出去，⛔ 不逐张重试）；
  ② 判据：只要一个函数被 `Promise.all` / `map` 并发调用过，它的 memo 就必须是 Promise 级的；
  ③ 这类 bug **屏幕上看不出来**（回退臂照常渲染）⇒ 必须留一行「哪条腿生效」的日志，并且**在构建产物里**跑一次，编辑器 Preview 会掩盖它（编辑器资产库按 uuid 全局可解，回退腿在编辑器里也是绿的）。
  判例引用：`games/beads/cocos/assets/scripts/host/beads-blit-carrier.ts`（`ensureMaskBundle` / `loadImageAsset`）、`ADR-0030 §5.6` 装载腿更正行；同族 K-108（资产"在目录里" ≠ "进了包"）、K-036/K-037（跑过 ≠ 检了）。

- **[引擎Cocos构建][K-113] 跨 Bundle 按需加载用 `assetManager.loadAny({ bundle, path }, cb)`；`Bundle.load(path, Type, cb)` 三参在 3.8.8 把回调当 options**（来源 WXG-T-256 / ADR-0030 §5.6，2026-10-05）
  现象：`bundle.load(entry.path, ImageAsset, cb)` 在构建产物里抛 `this.onProgress is not a function`（第三参被当 `options`）；补成四参 `bundle.load(path, ImageAsset, {}, cb)` 后**不抛错但永不回调**——只请求到 `import/<uuid>.json`，原生 png 一次都不请求，warmup 卡死（连被 `redirect` 回 `main` 的那两张也挂）。同一时刻 `assetManager.loadAny({ bundle: 'textures', path }, cb)` 直接返回 `ImageAsset` + 128px `HTMLImageElement`。
  根因：`Bundle` 实例上的 `load` 与 `assetManager.loadAny` 是两套重载解析；Bundle 腿的 URL 组装依赖 bundle 句柄的注册态，产物里（`settings.assets.server = ''`）会退化成缺前缀的路径。
  规避：① 跨包取一张图 = 先 `loadBundle(name)` **只为注册**，取资产一律 `assetManager.loadAny({ bundle: name, path }, cb)`（`loadAny` 的 `{bundle, path}` 形式要求 bundle 已注册，未注册直接报 `Can not parse this input`）；
  ② 子资产路径要写全（`<name>/spriteFrame`、`<name>/texture`），只写 `<name>` 时 `paths` 里登记的是 `cc.ImageAsset` ⇒ 按 `SpriteFrame`/`Texture2D` 取会报 "Bundle doesn't contain"；
  ③ 判哪种写法可用**必须在构建产物里试**（web-mobile 产物 + Chromium 即可复现），编辑器 Preview 的资产库会替你把错误抹平；
  ④ 加载腿改动后至少留一条**产物级**证据（日志里的 `4/4`），⛔ 用「文件在包里」当「能加载」的证据。
  判例引用：`games/beads/cocos/assets/scripts/host/beads-blit-carrier.ts`（`loadImageAsset` 两条腿）、`tools/scripts/check-cocos-mask.mjs`（只核 native png = 弱取证面）、`ADR-0030 §5.6`；同族 K-108、K-111（产物档 ≠ 编辑器档）。
