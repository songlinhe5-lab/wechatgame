# ADR-0021 — 品牌物理珠径 mm↔dip 挂在「候选色系宏」（art/<slug>.json）上做唯一真源

> 状态：Accepted（2026-09-24，程基岩 / engineering-lead；用户裁定「单一真源」，WXG-T-206 续单）
> 关联：ADR-0016（照片→图纸色板）、ADR-0018（盘面尺寸可玩性）、IMPACT-0020a §7.1 K-A（源图域 vs 渲染域）、
> 门禁 `palettes:check`（`tools/scripts/sync-palettes.mjs`）、判例 K-012（冻结常量 SSOT）/ K-042（真源化后须另配独立锚点守卫）

## 1. 上下文（Context）

「候选色系宏」= `games/beads/art/<slug>.json` 这组品牌色板（现 15 份在册：artkal-s/c/a/m/r、
hama-midi/mini/maxi、perler/perler-mini/perler-caps、nabbi、yant、mard、diamond-dotz）。
它已经是**色板数据的唯一真源**（游戏侧经 `sync-palettes.mjs` 编译期打包成
`src/config/palettes-data.ts`，studio server 与 beads-gen 直读 JSON）。

但「一颗豆子有多宽」这条物理事实此前**同时住在四处**：

1. `art/<slug>._note` 的自由文本（"Artkal S 系列 5mm 硬豆…"）；
2. `apps/beads-studio/public/index.html` 的 `BRAND_MM` + `DIP_BY_MM` 两张硬表（WXG-T-206 上一轮引入），
   外加「下拉标签里再写一遍 mm」的第三种副本（`beadMm()` 在表未命中时**正则解析 label 文本**兜底）；
3. `tools/scripts/beads-gen.mjs` 的 `BOARD_PRESETS[*].beadMm`（standard29/small18/… 各写 5，
   maxi29 写 10，mini107 写 2.6），用于报告里的「物理约 X×Y cm」注记 —— 与品牌色板**互不知情**；
4. 文档口径 `levels-spec §3.1`「每颗像素标准 32px」（= 5mm 档特例，但当时被当成恒定量写成 `PER_BEAD_PX=32`）。

后果是可复现的漂移：新增品牌只补色板不补 mm ⇒ studio 静默按 5mm 推断格数与成品尺寸；
改一处 mm 另一处不动 ⇒ 同一张图在不同副本下算出不同珠数（`--board mini107` 说 2.6mm、
`--palette artkal-s` 说 5mm，同一份报告里两个 mm 并存）。用户裁定：**mm↔dip 挂到色系宏上，
studio 与游戏都从它派生，不得再有多处硬编码。**

约束：

- 微信小游戏运行时不能 `import` 包外 JSON ⇒ 游戏侧只能是**编译期生成物**（既有判例）。
- beads-studio 前端（浏览器）与 server（零依赖 node）也不能 import TS 生成物；容器镜像只 `COPY public/`
  与 `server.mjs`，**不带 `games/beads/art/`** ⇒ studio 侧必须拿到一份**静态产物**，不能在运行时读真源。
- `systems-index §3.3` 渲染常量（`BEAD_CELL=50 / GAP=2 / PITCH=52`）**不在本单范围**：
  mm/dip 属源图 / 做图域（照片算珠数、成品尺寸、未来选档），任何「游戏按 dip 渲染 cell」都是另一条 §3 变更。

## 2. 备选方案（Alternatives）

| 方案 | 做法 | 事实性对比 |
| --- | --- | --- |
| **A1（采纳）A 的变体** | `art/<slug>.json` 加顶层 `name / family / beadMm`（+ 可选 `pending`）；`sync-palettes.mjs` 内**唯一** `dip(mm)` 在生成期算，**追加**进既有生成物 `palettes-data.ts` 的 `BRANDS` 表，并同批产出 `apps/beads-studio/public/brands.json`；游戏 `view/palette.ts` re-export，studio 前端 fetch 该 JSON，`beads-gen` 直读同一 JSON 的 `beadMm` | 复用既有管线与既有 `palettes:check` 漂移门（改 `--check` 覆盖两份产物即可）；**不新增 src 文件 ⇒ 不新增 cocos 镜像件、不需要新 `.meta`**（L1：`.meta` 只能编辑器生成，这是当前环境下的硬阻塞）；改动面 6 个代码/文档件 + 15 份数据 |
| A2（原始推荐路径） | 同 A1，但生成物**另起一个小文件** `src/config/palettes-brands.ts` | 与 A1 等义，但在 `games/beads/src/**` 新增文件 ⇒ `cocos/assets/scripts/game/config/` 出现无 `.meta` 的拷贝件（须开一次 Cocos Creator 才补齐，环境未装编辑器 = 无法自证）；且把「一个宏」拆成两个生成物，阅读成本更高 |
| B（退路） | 单独一份「候选色系宏」文件（品牌→mm），art JSON 与 studio 各自引用它 | 真源从「色板宏本身」分裂成「色板 + 尺寸表」两份人写数据：同一品牌要改两次，正是本单要消除的形状。否决 |
| C | 运行时派生：把 `dip(mm)` 实现进游戏 TS 模块，studio 经 `server.mjs` 暴露 `/api/brands`（server 直读 art JSON） | 逻辑上最"纯"，但**违反约束第 2 条**：容器无 `games/beads/art/` ⇒ 线上 studio 直接失效；且 server 需 spawn `--experimental-transform-types` 才能复用 TS 实现（现服务是零依赖纯 node:http）。否决 |

## 3. 决定（Decision）

采 **A1**：品牌 `mm` 作为 `art/<slug>.json` 的顶层字段与 `name / family` 一起成为「候选色系宏」的一部分；
`dip(mm) = 2 × round(mm × 6.4 / 2)`（偶数整数阶梯，冻结五档 2.6→16 / 2.88→18 / 3→20 / 5→32 / 10→64）
**只实现一次，住在 `tools/scripts/sync-palettes.mjs`**，在生成期把结果烘进两份产物
（游戏 `BRANDS` / studio `brands.json`）；下游一律**查表不再算**。

一句话理由：**沿用已经存在且已被门禁保护的「art JSON → 生成物」管线，把 mm 变成宏的数据、把 dip 变成生成期的纯函数，
就无需新增镜像文件与新门禁，也不给 studio 容器引入运行时依赖 —— 这是唯一同时满足「一处真源」和「当前环境可自证」的形状。**

同时删除 `index.html` 的 `BRAND_MM` / `DIP_BY_MM` 两张硬表与「正则解析下拉标签文本」的兜底路径，
下拉选项（含 mm 与色数标签）改为由 `brands.json` 生成，并把格数推断抽成 `inferBoard()`——**选图后换品牌当场重推**
（旧形状下只有选图那一次推断，换品牌后屏上仍挂着旧 dip 算出的格数，等于把“第二个真源”以时间差的形态留在屏幕上）；
品牌表拉不到时推断与「生成」均**硬拒**（不拿空 slug 让 beads-gen 静默用默认品牌）；
并删除 `beads-gen.mjs` 的
`BOARD_PRESETS[*].beadMm` 硬表 —— 盘具档位回归它该管的「格数」，豆径改由 `--palette` 品牌的
`beadMm` 提供（显式 `--beadMm` 仍可覆盖；两者皆无 ⇒ 省略尺寸注记，**不默认 5mm**）。

## 4. 后果（Consequences）

### 4.1 正面

- mm↔dip 的人写副本从 **4 处降到 1 处**（真源）；其余两份是**同批生成物**，由 `palettes:check` 一扇门锁住。
- 新增品牌若漏 `beadMm` ⇒ `palettes:sync` 与 `palettes:check` **直接 fail-closed**（不再可能静默默认 5mm）。
- studio 与游戏读到的 dip **同源同批**：2.6mm 品牌与 5mm 品牌在同一张图上必然推出约 2 倍格数，
  成品尺寸（cm）也随之从 mm 算，不再依赖"32px/颗"这一硬编码特例。
- 下拉标签里的 mm/色数由数据渲染，改 mm 不会再出现「表和标签各说一套」。
- 未新增 `games/beads/src/**` 文件 ⇒ cocos 镜像零新件、零新 `.meta` 欠账。
- **实测（2026-09-24，本仓 studio，同一 480×480 标准设计图，浏览器实测非口头推断）**：
  Artkal S 5mm ⇒ 15×15（成品 7.5×7.5 cm）；Perler Mini 2.6mm ⇒ 30×30（7.8×7.8 cm）；
  Hama Maxi 10mm ⇒ 8×8（8.0×8.0 cm）。**每轴 2 倍格数、总珠数 4 倍**，且三档成品物理尺寸几乎相等
  （反证 dip ≈ 6.4 px/mm 自洽）；换品牌时**无需重选图**，格数即时重推。
  负路径：把 `brands.json` 移出 public → 下拉空、选图报红不推断、点「生成」被拒（均不回落默认值）。

### 4.2 负面（已知成本，非风险）

1. **dip 只存在于生成期，运行时代码里没有 `dip(mm)` 函数**。若将来要按"任意未在表内的 mm"实时换算，
   必须另立实现 —— 届时须把 `dip(mm)` 提为共享模块并让生成器 `import` 它（否则就是第二处实现）。
2. **产物仍是两份**（`palettes-data.ts` 的 `BRANDS` + `public/brands.json`）。跨产物一致性由
   `palettes:check`（逐字节比对两份）与 `games/beads/tests/brands.test.ts`（把 brands.json 与 BRANDS
   逐字段对齐）双门覆盖，但**它们是门，不是结构**：手改 brands.json 而不改真源，靠门禁抓，不靠类型系统。
3. **测试侧的 mm/dip 字面量表（`FROZEN_MM` / `DIP_LADDER`）是本仓第 4 份 mm 文本**，但它是**判据锚点、不被生产代码消费**
   （判例 K-042：真源单一化后测试会失去自证能力，须另配不依赖该真源的期望值）。代价：改 mm 必须同时改测试，否则红。
4. **`beads-gen` 的物理尺寸注记行为变了**（两处）：① `--board mini107 --palette artkal-s` 旧输出按预设说 2.6mm，
   现按品牌说 5mm —— 这是**修正**（你用的是 5mm 豆子），但会改变历史报告的可读比对；② `--palette <数字>`（程序化色板，
   本就无实体豆）且不写 `--beadMm` 时，`｜物理约 X×Y cm` 整段省略。仓内无测试断言该注记串（已 grep 核），
   但**外部脚本若正则抓「豆径」需注意缺省分支**。
5. **studio 品牌下拉分组顺序变了**：由手写的「Artkal / Hama / Perler / 其他」改为 slug 字典序下的 family 首现序
   （Artkal / Diamond Dotz / Hama / MARD / Nabbi / Perler / Yant），"其他"组消失 —— 属可感知的视觉回归，无功能损失。
6. **旧容器镜像 + 新前端 = `/brands.json` 404**（镜像只 `COPY public/`，须重新 build 部署）。前端处置是
   **报红 + 跳过格数推断，不回落 5mm**（盘面尺寸仍可手填），所以线上漏 build 的表现是"选了图不自动测格"，
   而不是"悄悄算错"。
7. **文档口径落后半拍**：`levels-spec §3.1`「每颗像素标准 32px」现降为「5mm 品牌的特例」。本单**未改策划文档**
   （跨域），漂移登记在案，见 §5 与回传「未决问题」。
8. **游戏侧 `BRANDS` 目前无生产消费方**（只 re-export，约 1KB 量级入包）。属"预备接口"性质的死代码风险，
   按 §5 触发条件清理或转正。
9. `artkal-r` 需要 mm 才能过 fail-closed 门禁，故给它补了 `beadMm: 5`（源自其 `_note`）并另加 `pending: true`
   维持 2026-09-21「保留选项暂不做功能输出」的裁定 —— 即"在册但不开放"这条语义现在也多了一个字段要维护。
10. **本单往 `docs/architecture/control-manifest.md` §3 加的那一条，把该文件推到 `ctx:check` B 项上限的边缘**：
    实测 7699 → **7890 tokens**（单文件硬门 8000，余量仅 110）⇒ **下一个往该文件加条款的人必红**，
    届时须按先例（WXG-T-206 / density-tiers）在 `ctx/budget-exempt.json` 登记豁免或拆页，**不要塞进本单顺手做**
    （本单已实测 `ctx:check` 通过，不预先改仓库配置）。

### 4.3 中性 / 待观察

- `server.mjs` 未改：`/brands.json` 走既有静态 `public/` 路由（零依赖 node，MIME 表已含 `.json`），
  `/api/generate` 仍只收 cols/rows —— **服务端不算 mm/dip**，容器无需带 `art/`。
- mm 精度（2.88 这类两位小数）在 dip 阶梯下无歧义；若将来出现 4.8mm/6mm 等档，阶梯会外推到 30/38（取偶公式），
  是否要冻结这些新档待观察。
- **既有缺陷登记（非本单引入、本单未修）**：`index.html` 的 `selfTestBeadGrid()` 在浏览器里**恒告警**
  （“珠栅检测自检失败”）。实测原因：自检图是 **平坦随机色块**（无珠面高光/阴影纹理），而 `detectBeadGrid()`
  靠「平移自相关取最小差」找栅距 —— 平坦色块在 p = 真栅距处恰恰**踩到相邻异色格**（实测差值 61.5，
  而 p=8 处 28.7），自相关原理上测不出。对生产影响有限：标准设计图走 dip 整除分支（优先级 1），
  实拍物理盘有珠面纹理且 `sugOk` 还卡了 `gx≥15`。属 QA 待办（修自检图或改检测算法），已登记待裁定。
- 生成物 `brands.json` 落在 `apps/beads-studio/public/`（studio 静态域）而非 `art/`，路径上「离消费方更近」；
  代价是 `palettes:check` 需跨 apps/ 与 games/ 两棵树比对，已由脚本内绝对路径常量固定。

## 5. 复评触发条件（Review Triggers）

| 触发 | 动作 |
| --- | --- |
| 游戏要按品牌档位改变盘面几何（§3.3 `BEAD_CELL/GAP/PITCH` 变更） | **另立 §3 变更单**（本 ADR 明确不管渲染域，IMPACT-0020a K-A 仍成立） |
| 需要运行时按任意 mm 算 dip | 把 `dip(mm)` 从生成器提为共享模块（生成器 `import` 它），保持全仓一份实现 |
| `levels-spec §3.1` 由策划回写为「每颗像素 = 品牌 dip，32px 为 5mm 特例」 | 关闭 4.2-6 的漂移登记 |
| 品牌数 > 20 或包体敏感（`check:size` 逼近内部目标） | 复评 `BRANDS` 是否仍随包发布（当前无消费方 ⇒ 可考虑改为 studio-only 产物） |
| studio 部署形态改为「server 直读真源」且容器带 `art/` | 可评估方案 C（`/api/brands`），删除 `brands.json` 产物 |
