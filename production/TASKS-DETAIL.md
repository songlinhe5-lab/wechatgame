# WXG 任务台账 · 详情（标题制正文侧）

> **为什么拆开**：`production/TASKS.md` 曾**81% 的体积是任务行详情**（16 行 ≈ 5334 tok，中位行 389、最重 613），
> 而 `tasks:archive` 只清**已完成**行 ⇒ 每个新任务仍带入 400–600 tok ⇒ 反复撞 `ctx:check` **B 项单文件 8000**。
> 拆法：主表只留标题，正文落这里**一任务一节**（原文本原样搬，未改写）。
>
> **怎么读（协议，见 `ctx/ROUTES.md` 与主表头注）**：
> 1. **领号只读头注**：`grep -n '当前已分配至' production/TASKS.md` ⇒ 读那一行（≈30 tok）；要**看全部任务状态**才读主表（≈2.4k tok）；
> 2. 要某任务详情时，从 `ctx/index.json` 里**本文件该小节**的 `startLine`/`endLine` 取范围，
>    `read_file(path, offset, limit)` **只读那一节**（中位 ≈ 290 tok）——**不要整读本文件**。
>
> **配对纪律（由 `pnpm run check:tasks` 机械强制）**：主表有行 ⇔ 本文件有同名小节；
> 归档时**行与小节成对搬走** —— 由 `pnpm run tasks:archive` 机械执行（WXG-T-065：行进
> `archive/TASKS-archive.md`、节进 `archive/TASKS-DETAIL-archive.md`，节数 == 行数），故本文件只留在办 / 近期任务。

---

## WXG-T-179

**beads·照片转拼豆生成器 spike（调色板 / 限色 / 聚集 调优 + ADR-0016）** · 负责：主理人(CodeBuddy) · 状态：🔄 待用户裁定（甲案能力已具备；乙 / 丙挂起）

- **上位诉求（用户 2026-09-19/20 三项）**：①「豆子尽量同色大块集中，以触发连续填充」；②「颜色限制太少了，看不出来形状了」；③ 真实拼豆品牌色数调研（Artkal 200+ / Perler 100+ / Hama 60–90 / Nabbi 30–50 / IKEA-Pyssla 10–20），并要「根据这个方案进行调优」。
- **产物**：**ADR-0016**（`docs/architecture/adr/ADR-0016-beads-photo-to-pattern-palette.md`，Proposed）+ 生成器 spike `temp/beads-gen.mjs`（**不入库**，见"待办"）。
- **关键澄清（本轮最重要的认知修正）**：`BEAD_COLOR_MAX = 8` 是**单关用色数上限**，**不是**调色板大小 —— 调色板实为 **10 色**（`view/palette.ts::BEAD_PALETTE`，含深棕 `#6B3E1E` / 炭黑 `#33333D`）。此前生成侧只取前 8 色 ⇒ **照片暗部无落点**，是"看不出形状"里最便宜的一处可修项（已修）。
- **spike 能力（本单交付）**：
  - `--palette N`：≤10 = 游戏真源前 N 色（**可入关**）；>10 = 程序化色域（HSL 最远点采样，**仅调研**、产物不可入关）。
  - `--colors M` + `--colorsmode freq|error`：限色数 + 两种选色；`error` = 贪心 k-medoids，按**每格原始均色**最小化全盘色差（明显优于按面积选的 `freq`）。
  - `--sample K`（超采样 + 块内众数投票）/ `--smooth N`（众数滤波，平局保原色）/ `--minblock N`（8 连通碎块整体并入邻色）：三级**聚集度**旋钮，力度递增。
  - 背景去格改**自边框 4 连通 flood-fill**（旧"全局删同色"会把主体内的同色区域挖成洞 ⇒ 把大色块切成碎块）。
  - 报告并列四项判据：**色差**（保形）/ **同色相邻率**（聚集）/ 用色数 / **合规性**（>8 标红，防再产出不可入关的盘）。
- **实测权衡（同一样图 36×36，详见 ADR-0016 §1.3）**：8 色板（旧口径）**74.7 / 0.846**；10 色板 + 限 8 色 + error + 强聚集 **71.4 / 0.807（合规）**；程序化 32 色板 + 限 6 色 + error **63.3 / 0.844（不可入关）**；53 色板 **47.6 / 0.712**。⇒ 两条硬结论：**保形上限由色板大小支配**（色数只是放大器）、**保形与聚集始终反向**。
- **两个真 bug（本单修，均为"限制被绕过 / 失败仍报绿"型）**：① `balance()` 候选池写死全调色板 ⇒ 会把 `--colors` 刚禁掉的色**复活**（实测 `--colors 4` 产出 **5 色**）；已改为只在保留色集内选目标，无可用目标时如实返回 note。② 自检写成 `if (der.ok) { …断言… }` ⇒ 错位打乱失败时**整段断言被跳过、脚本仍打印「自检：通过」**，而产物是**全 void 废盘**（`--colors 2` 实测触发）；已改为失败即**非零退出**并打印原因。
- **门禁**：`check:tasks` / `check:links` / `ctx:check` 随本单跑；本单改动仅**文档**（ADR + 台账 + `architecture.md` 关联行），**零代码、零冻结值、零 §3 数值**。
- **待办**：① **用户裁定 ADR-0016**（甲 + 丁是否采纳；乙 / 丙是否评估）——这是解锁后续的唯一前置；② 生成器 spike **转正入 `tools/scripts/beads-gen.mjs`**（`temp/` 不进库、易丢）⇒ 须**另领施工单**，且转正前须补"产物合规性"守卫；③ 看图定档（产物目录：`temp/ok-p10c8e`（合规推荐）/ `temp/cmp-p10c8e`（10 色基线）/ `temp/bp32c6`（32 色程序化）/ `temp/beads-36-base`（旧口径对照））。

### 续作（Qoder · 2026-09-20）：beads-studio 在线生成器 + 小游戏导入

用户要求：「简单的后端服务和前端页面，能生成 + 展示 + 归类本地存储结果；最好能小程序一键导入」。两项拍板（AskUserQuestion）：**落位 = 本仓 `apps/beads-studio/`**、**发布 = Docker 镜像**；导入通道 = **在线地址拉列表下载关卡**。

- **生成核心不重写**（复用 T-179 已转正的 `beads-gen.mjs`），只加两处能力：`--in-raw`（JSON `{w,h,data:base64 RGBA}`，纯 Node 采样+量化，与 `readGrid` 同口径块内众数投票）+ `--no-png`；chromium 解析由顶层**惰性移入 `ensurePage()`** ⇒ 服务无需 playwright（VPS 镜像 node:20-alpine 即可）。CLI 原行为无回归（带 PNG / 免 PNG 双跑自验）。
- **服务端** `apps/beads-studio/server.mjs`（**零第三方依赖**，纯 `node:http`）：`POST /api/generate`（RGBA raw body → spawn beads-gen → 失败即 rmSync 不留残骸）/ `GET /api/results`（按盘面归类、时间倒序）/ `GET /api/results/:id[/level]` / 静态页；目录名与 id 走 `[a-z0-9-]` 白名单防穿越（已测 404）。
- **前端** `public/index.html`（单文件）：本地 `createImageBitmap`+canvas 解像到 ≤1024（**不上传原图文件**）、参数表单、canvas 预览 solved/misplaced 切换、已存结果分组列表、下载 levelDraft JSON / 复制 rowstrings。
- **部署**：`Dockerfile` + `docker-compose.yml`（context = 仓根，数据卷 `beads-studio-data`）+ `.github/workflows/beads-studio-deploy.yml`（paths 命中 → rsync 两部署单元 → 远端 `docker compose up -d --build` → 健康检查；**未配 secrets 时由 `vars.BEADS_STUDIO_DEPLOY` 守卫自动跳过**）。
- **小游戏导入**：`src/game/level-import.ts`（注入式 HTTP，L3 无平台依赖）+ `BeadsGame.importLevel()`（先过 `validateBeadsLevel` 才追加进关表，失败不改表）+ 设置页「导入」钮（`MetaViewData.studioEnabled`，**仅宿主配了地址时绘制**）。地址接线：微信侧 = 开发者工具启动参数 `studio=http://<IP>:8787`（`BeadsBootstrap`），harness 侧 = `?game=beads&meta=menu&studio=…`。不扣心（调试通道，不污染 §3.14 体力语义），结果经 `meta:studio-import` 事件回报。
- **E2E 揪出一个真缺陷（沉淀 K-064）**：`beads-gen` 的 `levelDraft` 把 `cycleProfile` 硬写 `'long'`，而交换法恒为 2-环 ⇒ BOOT「cycleProfile=long 与实际最长环 2 矛盾」**会拒收每一条在线导入**。生产端改 `'short'` + 消费端不再采信自报值（两面夹住），并补「谎报 long 仍产 short」反例判据。8 条单测全绿时它并不存在 —— 只有真产物过真校验器才暴露。
- **门禁**：`pnpm -w run verify` **17/17 PASS**（含 `framework:sync:check` 镜像门 / `cocos:check` / `harness:smoke`）；beads **521 例全绿**（本单新增 10 例：转换定价 / 谎报反例 / 不合规拒收 / HTTP 注入 / 空列表 / importLevel / 钮接线）。服务端另做真实 E2E 冒烟：POST 生成 → 列表 → `/level` → 过 `draftToLevel` + `validateBeadsLevel` 全绿。
- **沉淀统计（kb:sync --task=WXG-T-179）**：首轮**新增 1（K-064）**/ 修改 0 / 激活 0 / 归档 0；部署续作轮**修改 1（K-064 追记：本机全绿 ≠ 目标环境能跑）**/ 新增 0；发布实跑轮**新增 1（K-065：国内 VPS 镜像源 + 云安全组两层坑）**、**新增 1（K-066：squash 同步致全域冲突 + 静默重复定义，落 `[工具链]` 片）**。`kb:audit` 无归档相似命中；`ctx:build` 已刷。
- **部署补记（同日续作，用户「179 继续完成部署」）**：
  - **又揪出一个同型缺陷（追记进 K-064）**：上一轮宣称「`--no-png` 后服务端免浏览器」是**假绿** —— chromium 的 `ensurePage()` 写在 beads-gen **模块顶层**，本机装有 playwright 所以全绿，按 Dockerfile 布局拼的**无 chromium 容器目录**里直接退出码 1。修法：launch 下移到真正用它的 `readGrid` / `renderPng` 内部（按需创建），顶层零副作用；顺带修掉「`--no-png` 仍打印 solved.png/misplaced.png」的日志谎报。修后在 `/tmp`（无 node_modules）跑 `--in-raw --no-png` ⇒ **34ms 出盘、零浏览器** ✅。
  - **容器布局端到端已过**：`temp/studio-fakeimg/`（server.mjs + public/ + vendor/beads-gen.mjs + cwd/temp/artkal-palette.json）起服务 ⇒ 游戏 10 色与 **artkal** 两条生成路径均 200（artkal 色板按子进程 cwd 解析已对齐 Dockerfile 布局）。
  - **新增 `deploy.sh`**（本机一键发布，镜像构建在 VPS 上跑，本机只 rsync + ssh）：ssh 预建目录 → 三个部署单元 rsync → 远端 `docker compose up -d --build` → 回环健检（失败自动 tail 日志）。**stub 自测已过**（bash 3.2：无 KEY / 带 KEY / `PORT` 覆盖三轮，调用序列与参数逐条比对）；自测当场拓出两个真 bug：空数组 `"${ARR[@]}"` 在 `set -u` + bash 3.2 下报 unbound ⇒ 改守卫展开；**变量名后紧跟全角括号被当作变量名字符**（`$DEST（` → unbound）⇒ 全脚本变量输出加 `{}`。
  - **新增 `Dockerfile.dockerignore`**（BuildKit 按 Dockerfile 命名）：上下文从整仓缩到四个 COPY 源，且**逐级放行目录**（`*` 先排父目录则不遍历子项）。
  - **发布实况（同日，用户配好部署密钥后由本会话执行 `deploy.sh`）**：腾讯云 VPS `120.53.84.116`（docker 29.1.3，root 已在 docker 组）。
    1. 首次 rsync 成功但**构建失败**：`auth.docker.io` 超时 ⇒ 国内机拉不动 Docker Hub。**未改 `daemon.json`**（同机跑着 quant_agent / pgvector / redis，重启 docker 会牵连）；
       改为 `Dockerfile` 加 `ARG BASE_IMAGE` + compose 传 `BEADS_STUDIO_BASE_IMAGE`，deploy.sh/CI 透传 ⇒ 仓库默认值不变（GitHub Runner 可直连）。
       实测可用源：`public.ecr.aws/docker/library/node`、`docker.1ms.run`、`hub.rat.dev`；不可用：`mirror.ccs.tencentyun.com`（非 VPC 不可连）、`docker.1panel.live`（403）、`docker.m.daocloud.io`（unavailable）。
    2. 重跑 ⇒ **镜像建成 + 容器 `beads-studio` Started + VPS 回环健检 OK**（/api/results 200）。
    3. 外网访问 **000 超时**：已排查 = 容器监听 `0.0.0.0:8787` ✓、宿主 ufw inactive、`YJ-FIREWALL-INPUT` 只 REJECT 已知攻击 IP ⇒ **卡在腾讯云安全组/轻量防火墙**（需控制台开 TCP 8787 入站，SSH 做不到）；或不开端口走 **SSH 隧道** `ssh -N -L 8787:127.0.0.1:8787`（微信开发者工具请求本机等效可用）—— **隧道已实测**：本机 `-L 8788:…` 下 POST `/api/generate` 返回真实生成结果（14×14、5 色、swaps 6）且 `/api/results` 能列到它 ⇒ 容器内 beads-gen 子进程路径全通。两条均写入 README「国内 VPS 实战坑」章。
    4. 本轮脚本修正：**`PORT` 以前是谎报可覆盖**（compose 端口写死 8787）⇒ 改 `"${PORT:-8787}:8787"` 并在 deploy.sh/CI 透传；CI 健康检查同步用 `vars.BEADS_STUDIO_PORT`。
    5. 安全提醒已入档：本服务**无鉴权**，公网开端口 = 任何人可读列表/提交生成；默认建议走隧道或限源 IP。
    6. 这两道坑（镜像仓库不可达 + 云侧安全组与主机防火墙是两层）另沉淀为 **K-065**（`[环境]` 片）。
  - **发布链接通（用户选「推 develop + 开 PR」与「整批 develop→master」）**：提交 `1fc4be2`（beads-studio 全部交付，35 文件）已推 develop，PR **#4** = develop → master。
    过程中发现并处理三事：① **GitHub Variables 实际为空**（用户以为配好了；`gh variable list` 核实后由本会话补建三条，Secrets `SSH_*` 已就位）；② PR 初始 `mergeable_state=dirty`——上次同步（PR #3）用了 **squash**，导致本次全域冲突 ⇒ 在 develop 上 `git merge -X ours origin/master` 反向吸收（合并提交 `4efc511`，合并树与 develop 顶点 **零差异**）；③ `-X ours` 后核树抓到一处**静默重复定义**（`check-context-budget.mjs` 出现两个 `checkStagedFreshness`）与 `ctx/index.json` 陈旧 447 行 ⇒ 两文件取 develop 侧 + 重新生成。以上沉淀为 **K-066**（`[工具链]` 片 —— 讲的是 git/CI 同步链；原拟归 `[流程]` 会顶破该片 8000 上限，改归其真实域）。
    另：CI 健康检查改为**走 VPS 回环**（安全组未放行时公网 curl 会误判为红）；workflow 触发收窄为**只挂 master** + `workflow_dispatch`，并声明 `environment: production`（可选人审）。
  - **CI 发布已实跑通（PR #4 合并后）**：合并产生 master push ⇒ `beads-studio-deploy` 自动触发。首跑 **失败**：`Permission denied (publickey)` —— 排查到 TCP 已到 sshd（非安全组问题）⇒ 是 **`SSH_KEY` secret 内容坏了**（UI 粘贴丢行尾换行的典型形态）。用已验证可用的私钥 `gh secret set SSH_KEY --body "$(cat <key>; echo)"` 重写三条后 `gh run rerun --failed` ⇒ **deploy ✓ 58s、健康检查 `OK（回环）`**、VPS 上 `curl 127.0.0.1:8787/api/results` = 200。教训入 workflow 注释。
  - **同批踩到并修掉两处流程债**：① master 的 `commit-lint` 被我**跑红**。用户贴出 CI 日志后本地复现（`npx commitlint --from=083bb0f --to=6583191`）= **3 项违规**：`release:` 的 type-enum + scope-empty（标题本身，我上轮只说了这一层，**不完整**）、以及 `footer-max-line-length` —— 后者成因是 **squash 折叠时 GitHub 给每条子提交主题加 `* ` 前缀**，一颗 **99 字符的合规标题被拼成 101 字符 footer 行** ⇒ 与标题无关、整条同步必红。两道修：同步类 PR 标题固定 `chore(release): …`；`commit-lint.yml` 识别折叠同步提交（正文含 `* <type>(<scope>): `）**只校标题行**（子提交进 develop 时已逐条全量校过）。**曾按用户选择把 `header-max-length` 收到 96，落地前普查存量发现 develop 还有 98 / 99 字符历史标题 2 颗、而 PR 阶段逐条校全部提交 ⇒ 收紧会把下一次发布 PR 判红且不可追修，遂回退 100 改走工作流兜底**（该反悔已作为追记并入 K-066：改阈值前先量存量）；另修一处**文档自相矛盾**：§2.5 的「header 超长」反例只有 75 字符、实际拦不住（已换成 113 字符并 commitlint 实测报 `current length is 113`）；② PR #4 **又是 squash** ⇒ `master` 上再次出现与 develop 无血缘的提交（K-066 当场复发）⇒ 已按规则做**反向吸收**（合并提交，树与吸收前 **零差异**、master 恢复为 develop 祖先），并把「合并后立刻反向吸收」的四行命令写进 `docs/ci/commit-and-review-rules.md §4.1`。
- **前端预览缺陷与三视图（用户反馈「生成后无法预览图片和错位图片；应可显示原图/正解/错位」）**：
  - 真因是我写的索引 bug：`draw()` 用 `colors[y*cols+x]`，但 `pattern` 是**行字符串数组**（长度 = 行数）⇒ 14×14 盘上除前 14 个下标全取到 `undefined`，画布几乎空白（正解与错位同受损）。改 `colors[y][x]`，并补 `.`/`x` 字符与色号 `1-9A` → 色板下标映射。
  - 新增**三视图**：原图 / 正解图 / 错位图。原图靠**缩略图随结果存盘**（前端选图时本地压 ≤448px JPEG，~5KB；POST body 改为 JSON `{w,h,data:base64(RGBA),thumb}`）⇒ 点历史条目也能回看；旧 2 条无缩略图的显示「未存原图缩略图（旧数据）」而非谎报成功。
  - **列表接口改轻投影**（原本把每条的 `levelDraft`+report+thumb 全吐，小游戏拉列表也吃这个包）⇒ 只回元数据 + `hasThumb`，点条目再拉单条全量。
  - **屏幕层取证**（这类 bug 单测抓不到，K-037）：`temp/studio-uicheck.mjs` 真浏览器跑「造图→上传→生成→切三视图→逐像素数有色格」，含**变异自检**（旧索引写法重画 → 有色比例 2.4%，证明门槛断言有判别力）。结果：原图 100% / 正解 68.7% / 错位 68.7%（门槛 ≥25%）、分桶色数 5（≥3）、thumb 与轻投影均 ✓。
- **默认值改推荐值 + 异形只分长方形/非长方形（用户 2026-09-20）**：前端预选 standard29 / 10 色 / 用色 8 / k=8 / 滤波 1 / 误差最小 / 铺满整盘（默认勾选），每项 label 标「推荐」（理由入 README 表：8 = `BEAD_COLOR_MAX`、k 8 = `MISPLACED_PAIRS_MAX`、29×29 按 ADR-0018 仍属设计档已写清）。形状改为二级选择：「长方形 / 非长方形」→（非长方形时）圆/六边/心。
  - **异形「缺漏」真因两处（`beads-gen::shapeMask`）**：① `inset = 0.02` 把形状整体内缩 ⇒ 盘边一整圈空位；② 只按**格心**判定 ⇒ 半格在形内也被判空（阶梯缺角）。现 `inset = 0` + 「中心或任一角在形内即保留」（5 点采样）。实测 29×29：circle/hex/heart 形状内空洞 **0**；UI 侧圆形重生成亦验证「形状内 705 格、空洞 0、形状外误铺 0」（第一次报 ✗ 是**我的判据与掩码口径不一致**（用格心判形状外），改成与 `shapeMask` 同源 5 点口径后转绿）。
- **参数值域纠偏（用户追问「色板是什么概念、值域是否正确」后实测发现的真隐患）**：
  - 概念先分清：**色板 = 量化目标候选色集合**（`--palette`），**用色上限 = 实际从池里挑几种**（`--colors`）；UI 文案已改成「候选色集合（量化目标色）」/「实际用几种颜色」。
  - 值域核正：游戏 10 色与生成器 `GAME_PALETTE` **逐字节一致**（曾一度误判为 12 色 —— 多出的两串是 `BeadsPalette` 的 UI 面板色，不属珠色表）。可入关真域 = 色板 **10** / 用色 **3–8** / k **1–8** / 盘面 **6–29 × 5–29**（全取 `systems-index §3` 冻结常量）。
  - **真隐患：Artkal 不是“导入报错”，而是静默换色**。实测 artkal 限 8 色 ⇒ 色号仅 `.12345678`、用色 8，**BOOT 全过**；但游戏不读 `paletteHex`、按色号取 `BEAD_PALETTE` ⇒ 预览 `#249E6B…` 会变成 `#FDF6E9…`（图案在、颜色全变且不报错）。
  - 修法定单一真源：`server.mjs::importBlockers()` 写盘时算 `importable/blockers` ⇒ 前端结果卡与列表项标红 + `GET /api/results/:id/level` 对不合规产物 **422 + 原因**；`importLatest` 将原因**原样透传**（不降级成“无 levelDraft”），新增1 例单测钉住；色板选 Artkal 时用色域放开、选回游戏 10 色时**夹回 3–8**。
  - 两个参数关系一并实测入文档：**k 与用色数无关**（6×5 小盘 + 3 色 + k=8 仍配对达标；真配不满则 `der.ok=false` 非零退出 → 422，不静默出坏盘）；**smooth 经验值**：29×29 类照片 0/1/2/3 → 相邻率 0.891/0.896/0.899/0.899、色差 78.7/79.3/79.7/79.7 ⇒ 剪影图 0–1、照片 1、要整块同色才试 2（3 已收敛）。
  - 取证：`temp/studio-uicheck.mjs` 新增四断言（夹域、红标文案、/level 422+blockers、Artkal 域放开）均绿；屏幕层整套 18 条断言全绿。`beads-mvp-patterns.mjs` 手工作图不走这套采样 ⇒ 滤波/选色模式对其无意义（已写进 README防误用）。
- **错位密度模式（用户反馈“错位豆基本很少，要成片错豆”）**：根因不是算法错，而是面板只给了 **k 对交换**这一条路 —— 29×29 盘 k=8 仅 16 颗错位（实测占 348 可填格 = **4.6%**），其余全就位 ⇒ 看着像没打乱。接上引擎已有的 **`misplaced` 全错位初盘**（入库 8 关用的就是它，`applyMisplacedToGrid` misplaced 优先、`validateMisplacedGrid` 校轮廓/守恒/错位≥1）：
  - `beads-gen` 新增 `--mis full|swaps`（默认：给了 `--swaps` 就 swaps，否则 full）；full 模式 `levelDraft` 带 `misplaced`、`swaps: []`、`cycleProfile=long`。
  - **一个静默错东西的坑当场堵在构造前**：若 `--mis full` 同时带 `--swaps 8`，旧写法 `der = sw ? 交换 : derange()` 仍会走交换 ⇒ 拿到的还是 2k 颗。现把 `misMode` 提到 `swapsK` 之前定，full 模式强制 `swapsK = 0`。
  - 链路打通：`server.mjs` 收 `?mis=`（默认 full）并透传 `--mis`；`importBlockers()` 改为**按模式判**（full 不受 `MISPLACED_PAIRS_MAX=8` 约束，但校验草案确实带 `misplaced`）；`level-import.ts::draftToLevel` 恢复 `misplaced` 透传；面板新增「错位密度」二档（全错位默认 / 少量交换才出 k 输入）。
  - 实测：full = **348/348 = 100%** 可填格错位（屏幕层 705/705）vs swaps = 16/348 = 4.6%；新单测 1 例（草案带 misplaced ⇒ 原样透传且过 BOOT）；屏幕层取证新增 3 条断言（全错位密度、`/level` 200 不被 k≤8 拦、“少量交换”才出 k）均绿，整套 22 条全绿。可玩性提示已写进 README：密集全错位盘靠 board 直填周转（G-3 结论），真机手感待走查。
- **已存结果可删 + 导入不再盲取最新（用户：列表里不要的条目也会被导入）**：此前**根本没有删除能力**（无 `DELETE` 接口、无前端钮），只能手动 `rm -rf data/<board>/<id>`。
  - 服务端新增 `DELETE /api/results/:id`：id 走与建目录同一套 `[a-z0-9-]` 白名单（不拼用户传入路径），**不可逆**⇒ 前端 ✕ 必带二次确认；不提供批量/目录级删除。
  - `importLatest()` 从「取 `results[0]`」改为「**取最新一条 `importable !== false`**」：列表里常夹参考图/实验残品，盲取只会吃一个 422，用户看到的是“导入失败”而不是“该删/该选对条目”；全不可入关时报“N 条均不可入关”，不去碰 `/level`。
  - 取证：新单测 2 例（跳过不可入关、全不可入关不碰 /level）+ 屏幕层 2 条（✕ → 确认框 → 列表 3→2；不存在 id 与 `..%2f` 穿越型 id 均 404 不碰文件），共 14 例单测 / 24 条断言全绿。
- **公网放行已完成（2026-09-20 用户操作 + 本会话复核）**：CVM `ins-bnj9hmh3`（ap-beijing，`product_name=CVM` ⇒ 走安全组而非轻量防火墙）加 TCP 8787 入站后，**公网端到端全绿**：
  `GET /` = 200 → `POST /api/generate`（96×96 RGBA）得 `small14-1789910083144-e64a` → `GET /api/results/:id/level` 字段完整（14×14 / pattern 14 行 / swaps 6 对 / `cycleProfile=short` ⇒ 生产端修复已随发布上线）→ 过本仓 `draftToLevel` + `validateBeadsLevel` **通过 ✓**（时长按 k 定价 = 270s）。
- **待办（本单遗留，均属环外）**：① 若以后要**真机**导入：手机出口 IP 与本机不同，限源规则需放开到 `0.0.0.0/0`（本服务无鉴权，自行权衡）或改用 SSH 隧道；② 微信正式环境需 **https + 合法域名**，开发/体验版先勾「不校验合法域名」；③ 色板仍接 **ADR-0016** 待裁（`--palette artkal` 产物只出参考图，服务端已 422 拦下导入）；④ **develop→master 以后固定用 merge commit**，不要再 squash（K-066）；⑤ VPS 上仍是旧版（无全错位与删除能力），待发 `deploy.sh`。

---

## WXG-T-184

**beads·双写存档层（local + 云 KV + 合并策略）** · 负责：主理人(Qoder) · 状态：📝 立项留档（未开工，2026-09-21 用户令）

- **上位（用户 2026-09-21）**：「进度存储 + 账户关联，无自建后端」场景下，微信原生能力的立项确认；结论=可做，路径=**本地缓存做工作副本 + 小游戏用户云存储（CloudStorage KV）做跟账号的跨设备副本**。本单留档范围与硬约束，实施另行开工（可拆 Story）。
- **平台硬约束（2026-09-21 官方文档核实，实施时以文档页为准复核）**：
  1. `wx.setUserCloudStorage / getUserCloudStorage / removeUserCloudStorage`：小游戏专属、**客户端直调、无需自建后端/无需合法域名**；数据按 **openid×游戏** 托管 ⇒ 「进度跟微信号走」天然成立，换设备即恢复。
  2. 额度：每用户 ≤ **128 对 KV**；**每对 key+value ≤ 1024 字节**；key ≤ 128 字节；value 必须是 string（`JSON.stringify` 自理）⇒ 存档只放进度/星级/钱包类小数据，**图案/关卡数据严禁塞入**（那是关卡分发的事，见「范围外」）。
  3. 本地缓存 `wx.setStorage`：单 key ≤ 1MB、总量 10MB，按 用户×游戏 隔离；随代码包清理/用户删游戏而失。
  4. 开发者工具对云存储支持有限 ⇒ **判据必须真机取证**（同 K-046 取证层次教训：工具全绿不构反证）。
  5. 写入侧**客户端可伪造**：单机休闲期接受；一旦上排行榜/对抗，升级云开发（云函数校验）另立项。
- **范围（实施单四件）**：
  1. **存档抽象层**：框架 `services` 增 `persistence` 端口（get/set/flush），core 零 `wx`（L2/L3 纪律：平台调用只在宿主适配层，先例 = `BeadsBootstrap` 注入 `wx.request`，5635084）；
  2. **本地副本**：现有 meta 钱包/体力/解锁/星级落盘改走端口（现状直用 `wx.setStorage` 的位置收口）；
  3. **云副本**：结算/切后台时机把聚合快照写 CloudStorage（**1–2 个 key**，编码预算 ≤1KB/键，键名预留版本前缀）；
  4. **合并策略**：冷启动 `getUserCloudStorage` 与本地按**时间戳取新**、冲突字段表（哪些以云为准/哪些以本地为准）随 S10 元游戏 GDD 一并冻结；网络失败 ⇒ 静默降级纯本地，下次结算补传。
- **验收口径**：正式判据开工时从 S10/meta GDD §8 导出（本单不预写伪判据）；机械门 = verify 17/17 + 真机双设备同账号往返（A 机通关 → B 机恢复）。
- **范围外（登记去向）**：① **关卡数据分发**（新关卡下发给玩家）= 分包/云开发存储/CDN 三选一，属关卡管线，**另立单**（与本单解耦）；② 防作弊与好友榜（开放数据域 `getFriendCloudStorage`）待有排行榜需求再立项；③ beads-studio 玩家自助通道的正式版走 https 备案域名或云托管，见 T-179 遗留。

---

## WXG-T-185

**beads·关卡数据分发管线调研留档（分包/云存储/云托管）** · 负责：主理人(Qoder) · 状态：📝 调研留档（未开工，2026-09-21 用户令「存下调研与推荐方案，后续派生任务执行」）

- **问题**：新增关卡数据（`levels:sync` 产物 / 运营关包 / 未来 UGC 关）平台侧有什么能力可**存储并下发**给玩家，且尽量不自建后端。关卡 JSON 很小（rowstrings 一关数 KB），包体红线（本仓口径）：主包 ≤4MB、全部套餐 ≤30MB。
- **能力对比（2026-09-21 官方文档核实）**：
  | 路线 | 存放 | 下发 | 域名/后端 | 更新 |
  |---|---|---|---|---|
  | ① **分包加载** | 关卡打进子包（微信托管） | `wx.loadSubpackage({name})` 按需拉 | 全免 | **要发版过审** |
  | ② **云开发·云存储/数据库** | CloudBase 存储或集合 | `wx.cloud.downloadFile(fileID)` / 云函数查询，微信私有通道 | **免备案域名**，云函数=托管后端 | 后台/脚本随时写 |
  | ③ **微信云托管** | 自有容器服务（beads-studio 形态） | `wx.cloud.callContainer()` | 服务要有，免备案域名 | 随时 |
  | （对照）自建服务器 `wx.downloadFile` | 现 CVM | 直连 | ⚠️ https+**ICP 备案域名**+downloadFile 合法域名 | 随时 |
- **网络约束备忘（本轮实证/核实，派生单共用）**：合法域名只收 **https/wss 域名，禁 IP/localhost，必须 ICP 备案**（境外注册商域名需先转回国内，CF 仅做 DNS/代理不碍备案）；端口可配但配后仅放行该端口；开发工具勾「不校验合法域名」、真机开发版开「调试模式」可绕过；**小游戏运行时全局 `fetch` 不存在**（实测），平台通道一律 `wx.request` 注入（先例 5635084）。
- **推荐路线（拍板前立场）**：
  1. **短期（现状）**：关卡随 `levels:sync` 打进包，不动；
  2. **主包触 4MB 红线时**：`design/levels` 生成物挪**分包**（Cocos 侧目录配套改造）；
  3. **要「不发版上新关」时**：上 **云开发存储**——脚本上传 `levels:sync` 产物 + 客户端拉清单/下载/`wx.setStorage` 缓存（与 T-184 的 `persistence` 端口同地基）；
  4. **UGC 关互通**（A 生成分享给 B）才需真后端：云开发数据库原型即可；beads-studio 玩家自助正式通道另议（备案域名或云托管，见 T-179 遗留）。
- **派生执行单（均未领号，触发时另立）**：ⓐ 云开发环境开通与选型 spike（环境/额度/免费层核实）；ⓑ 关卡清单 JSON schema + 上传脚本（接 `levels:sync` 产物）；ⓒ 客户端远端关拉取 + 本地缓存 + 过 `validateBeadsLevel` 才入表（复用 `level-import` 校验面，L3 纪律：注入式通道）；ⓓ 分包改造（触发条件=主包尺寸，接 `check:size`）；ⓔ UGC 分享链路（依赖 ⓐⓑⓒ 与合规裁定）。
- **本单改动**：仅台账留档，**零代码零 §3**；正式判据待各派生单从对应 GDD §8 导出，本单不预写。

---

## WXG-T-210

**beads·皮肤/风格系统（方案 A 全程序化）§12 决议与四域文档对齐** · 负责：主理人(Qoder)｜林绘澄／文策渊／程基岩 分域交付 · 状态：🚧 文档对齐完成、**落码未开工**

- **决策真源**：`games/beads/design/proposals/bead-visual-style-spec.md` **§12**（v0.4，**七批**修订）＝ S1–S10 决议表 + **C1–C12 实现约束** + §12.5 修订记录 + §12.6 实测层数表 + §12.7 α 上限证据边界 + §12.8 冲突处置表（①–⑬）+ **§12.9 落码开工序（七步，供拆单）**。**本详情节不复述决议，只登记交付与阻塞。**
- **交付（六件，全部零代码、未 commit）**：① §12 v0.4 本体；② `art/assets-spec.md` **v1.5-r15**（§1.9.7 扩为风格插件双通道 + 7.2–7.10）；③ `art/accessibility.md` **v1.5-r15**（16/18 可切换非色相载体、小豆档无孔影响）；④ `design/ux/ux-spec.md` **v1.17**（设置面板行4 两钮、§4 矩阵 8 行、U14 丙案降遮罩、U15/U16 甲案；六批同步删 16/19 两档）；⑤ `ADR-0023`（风格插件化 + 双指标门禁 + 拦截即报，六批已把池数 6→4 全文回写、Q1/Q2 按「对象消失」结案）；⑥ `ADR-0024`（`RenderModelBuilder.polygon` 值拷贝改造，243 行）；⑦ 调研件 `design/proposals/bead-style-16-19-semantics.md`（275 行，含 `temp/beads-1619/probe.mjs` 实算，不入仓）。
- **核心决议摘要**：方案 A 全程序化矢量图元（禁纹理、禁位图，缩放无损）；十层卡退役、默认皮肤 = 复刻·四棱刻面+孔（实测 6 命令 / 0 真 α）；风格作用域 = 珠体 + 凹槽 + 托盘珠，B0 底图共享几何只随 inks 换色；满豆/小豆两档（满豆留孔、小豆不留孔 = 一种设计两套皮肤）；玩家设置实时切；双指标进池门禁 命令 ≤7 且 真 α ≤2；**C11 拦截即报**（触门必输出五项实测数值并请用户裁决，禁止静默放行与静默失败）；**C12 主体色不变式（L0 定理，七批采纳）**：珠体主体色必须 ≡ 本格 `base`，派生层可增删不得替换主体色（含 `L0`/`L1` 术语消歧；可机检，进开工序步 2）。
- **开工前置阻塞（三件，逐条解除后方可落码）**：
  1. **ADR-0024 未落地** ⇒ 四棱基线不得落码（`polygon` 现按引用存，共享 scratch 会串形且门禁全绿）；
  2. ~~16 / 19 挂「调研再定」~~ ⇒ **六批已裁：两套均不可用、直接移出风格池**（调研否证：16-b 撞档致异色珠全等、argmin 归位 8/10 错配；19 唯一可玩形态需 B0 同去色 ⇒ 破 S4 且对色觉障碍玩家是最坏档）。**净结果：池 = 4 套，玩家侧非色相通道只剩 18，A3① 明度欠账仍欠**；
  3. **α ≤ 2 无真机证据**：真机帧率从未测过（ADR-0022 DR-1），D1/D2 测量单 v1.0 全列 `[待填]` ⇒ 上限属纸面口径，跑完须回头复核。
- **门禁状态**：`check:links` OK（agents=7 / skills=39）；`check:tasks` 经本批补详情节闭合；`ctx:check` 的 C 项报 `memory/INDEX.md` 与索引不同源（非本批文件，pre-commit 自动重建处置）。
- **遗留待办（去向见 §12.8 表）**：art 纪律③「投影 α 不得为 0」适用面改写 · 逐风格凹槽层集 · `BEAD_DRAW_INSET` 小豆档定值 · 三角/顶点数并入 QA 埋点 · `pause-settings.md §2.2` S9 内容单源同步 · **C12 在 `assets-spec §1.9.7` 的引用行（art 下批）**。

---

## WXG-T-211

- **目标**：§12 风格池落码（Q1=甲 三套可即刻；06 只出池条件）——registry + 双门禁 + 四棱转正 + 13/18 + 行4 两钮 + 存档两字段 + 设置态遮罩分列（Q3=甲）。
- **编排链**：studio-orchestrator 阶段诊断 → 批1 A∥D∥E → 批2 G∥F → 步2 B1；用户四裁（Q-a 补措辞 / 门禁进常门 / 阀活到 S7、**注：B1 回报后按已裁 §12 孔口径甲执行，阀期维持活到 S7** / Sprint-01 不合批）。
- **已完成**：
  - **A**：ADR-0024 DEC-1~4 落码（arena+{offset,count}+polygon3；J-4 字面同步「暖帧增量===0+首帧翻倍≤12」）；十层盘 8 关 + FX 夹具 936 枚 SVG 逐字节等值；ADR-0023 文首差异表五处。
  - **D**：pause-settings v1.7（行4 两钮/行5 保留、§8-14~19）+ save-progress v1.1（§8-11~13）。
  - **E/E2**：assets-spec v1.5-r16/r17（三套层集 7.11–7.13、C12 引用、投影 α 纪律改述、06 出池门 P-1…P-4）+ C12 弱读统计域措辞钉死（§12.2 八批）。
  - **G**：`epics-beads-ep11.md`（EP-11 七 Story，宿主拆分 WXG-T-066 法）+ Sprint-01 建议。
  - **F**：test-cases v1.17 §K 族 + smoke v1.3 SC-ST-01~04 + playtest v1.2 第 4 轮 PT-SKIN-01~08（主对话代落盘，用户批准）。
  - **B1**：凹槽 y 向修复+断言先行（TC-SKT-01 红→绿+变异）；bead-styles/{contract,registry}.ts（仅 facet-4，盘面 3 复拍逐字节等值）；双门禁常量 + WAVE_LOD_LAYERS 拆名；`check-bead-style-pool.mjs` **进 verify 常门**（C11 五项/C12 弱读三臂/TC-STY-08 两反例臂）；TC-STY-11/SAVE-12腿①/SAVE-13 哨兵 18 例。verify 19 项 = PASS 18/SKIP 1（check:size 既有）；beads 610。
  - **S3（步 3 四棱转正，WXG-T-211-S3）**：`bead-styles/facet-4.ts` 提出为独立模块并注册为**默认 styleId**；`bead-render::drawFilledBead` 改为「算尺 → `DEFAULT_BEAD_STYLE.beadLayers()` → 逐层回放」（⛔ 不再硬编码层集，热路径零分配：模块级输入槽 + 风格 scratch + `polygon3` 定点参数）；十层逐字封入 `bead-styles/legacy-ten.ts` = **registry 外对照通道**（现契约「注册即出池」⇒ 不触 U16 玩家钮）；`BEAD_CARD` 真源上移 `tuning.ts`（破循环依赖 + C4），旧路径降为再导出；§7.12 五表外系数清算（`FACET4_PLATE_MIX` / `FACET4_FACET_RIGHT_MIX` / `FACET4_FACET_INSET` 命名常量，`FACET4_HOLE_RADIUS` 退役删除，凹槽 spike 系数已归位端点表）；`legacy-ten` 对照臂 8 关整帧 SVG 与 HEAD **逐字节等值**（方式 B wrapper 注入，bundle 防陈旧自证）；四棱臂字段级差异 = **有且仅有 #6 孔层 {r,fill}**（45 例全量；因补锚带改注释 ⇒ 两件取证在终树复跑：`18-svg-byte-equality-retree.txt`（diff 仍空、取证件 sha256 表与首跑相同）+ `19-hole-diff-table-retree.txt`，首跑件不删）；§K.5 十二行 + 附行逐行落 `bead-style-ledger.test.ts`（13 例）+ M01–M13 变异全判红；§11.2 旧 1587 作废、新基线 **1119 由差分复算产出**（`bead-style-seal.test.ts` 常驻进 verify + 夹具入库）；C12 台面值同步 25.2→25.3%（唯一来源 = 孔径，弱读式不变）；B0 生产样张重跑双臂（temp/，不判优）。⚠ **补建欠门（两处，同属 K-060「文档声称有门、实际无门」）**：① `tuning.ts` §7.12 与 `facet-4.ts` 文件头此前都声称「机械锚 = bead-style-pool 的 C4 裸系数扫描判据」而**该判据并不存在** ⇒ 本批补建静态扫描门（剔注释后扫 `bead-styles/` 全目录，`legacy-ten.ts` 逐字封箱豁免需自带注记）+ M-A/M-B 两型真码变异各判红一次（`temp/wxg-t-211-s3/16-c4-mutation.txt`）；② `contract.ts:119` 与 `bead-render.ts:372` 都声称「测试钉住两次调用返回同一实例」而该判据**同样不存在** ⇒ 本批补建 C2 零分配机械锚（腿① 实例同一 / 腿② 值真重算；腿③ = 被①∧② 蕴含的后果展示，**不冒充独立判别力**）+ M-C（`LAYERS.slice()`）/ M-D（`endpointOf(inks, 1)`，腿① 先过后腿② 才红 ⇒ 证腿② 非腿① 替身）各判红一次（`temp/wxg-t-211-s3/17-c2-mutation.txt`）。verify PASS 18/SKIP 1；beads **610 → 643**（+33）。⚠ 未 commit。
- **B1 停手点处置（编排代裁，依已裁真源）**：Q1 facet-4 实测 argmax=edge（四刻面近等面积、最大偏离 0.4pp）而非纸面 base ⇒ 采 (a)：断言维持「argmax ∈ base 同族端点集」+ 分布恒打台面（与 §12.2 八批裁定式文本一致，「base 占优」系纸面假设非裁定），art/QA 侧措辞订正列尾单；Q2 孔双口径 = **按 §12 已裁甲口径（单孔）**，步 3 转正时新立对拍基线；Q3 changed 自我比较怪癖随步 5 一并修；Q4 注释旧名字面接受留档。
  - **S4（步 4 13/18 入池，WXG-T-211-S4）**：`dual-tone-13.ts`（实测 3/0 = 纸面）+ `lineart-18.ts`（5/1）按 §7.11.2/3 正本落码入池，池序 §12.6 = facet-4→18→13；C12 三套 argmax 全过（13 = pit 100% ∈ 同族，预置停止点未触发）；E 单 C 组必改全落（孔 `pit` 透底/0.22S/零 hex 字面）；§11.2-b/c 两份 §6 差分复算落档（基准臂 = facet-4 现默认，非珠体族 Δ=0 机检闭合）；重叠哨兵改写四腿 + 臂 D 死层（旧泛阈反例 722px 新门判红 = 判别力净增）；TC-STY-11 计划内中间态登记（注册 3 ≥2 而钮未呈现，时序非违例）；beads 643→651，verify PASS 18/SKIP 1。
- **S4 四裁（主对话 2026-09-26，职权内）**：未决 1 = **采 A** 追认重叠哨兵改写（判据加严、未触裁定式）；未决 2 = **采 A** 孔底 `pit` 透色（K3/C5 已裁主线，`BEAD_HIGHLIGHT_HEX` 18 零消费者 ⇒ 7.11.3 行 ③ 措辞订正列 art 尾单）；未决 3 定稿名差异不回改 epic 正文、描述行已划线对齐；未决 7 tool-manager 维持不入库（前判）。策划建议 885/1041 不升基线 = **采**（默认盘维持 1119）。S5 落地后须重取 §11.2-b/c 差分（已注）。另：`13`/`18` 新文件 `.meta` 归编辑器（沿 S3 判例，不伪造）。
- **未开工**：~~步 3 四棱转正~~ ⇒ 已交付（`2ae973c`/`acb1b24`）→ ~~步 4 13/18~~ ⇒ **已交付（WXG-T-211-S4）**→ 步 5 两钮+存档+遮罩分列 → 步 6 06 [Blocked] → 步 7 真机回评（挂测量单轨；`legacy-ten` 回退阀**仍活到 S7 真机回评**，本批不删）。
- **红线**：全批未 commit（等用户令）；`check:size` SKIP ≠ 通过；C12 近并列脆弱性已打台面登记。
- **S3 遗留（回传未决，需主理人/用户阅后定）**：① `legacy-ten` 走 registry 外对照通道（与 ADR-0023 §6.3「在 registry 里翻默认」字面有出入，回退 = 改 `bead-render.ts` 调用点一行）；② 四棱下 `WAVE_BEAD_LOD_LAYERS` / `ZOOM_LOD_LAYERS` 与 G1 四通道（`contactAlpha/contactWidth/shadowAlpha/shadowDy`）**结构性 no-op**（字段保留 ⇒ 判据钉「传/不传逐字节等值」）⇒ 波浪降档与 G1 重量包络在默认皮肤下失效，是否另立工程单待裁；③ `cocos/assets/scripts/.../bead-styles/` 新增两文件暂无 `.meta`（sync 脚本永不触碰，归编辑器）；④ ADR-0023 §6.2 步 3 与 DEC-6 的**核销回写**未由本单动（属架构正本，待主理人定是否另批）；⑤ 本批发现**两处同型缺口**：「文档声称有机械锚而锚不存在」（C4 / C2，均已补建 + 变异自证）⇒ 同类声称是否还散布在其它模块（grep「机械锚」/「钉住」）待裁：本单未全仓扫（超范围）。
- **S3 遗留四裁（主对话 2026-09-26，职权内代裁，不另开往返）**：① = **采 (a)** 维持 registry 外对照通道，ADR-0023 §6.3 已补「落地形态裁定」注（契约不动）；② = **采 (c)** 押到步 4，13/18 入池后一并决定是否为各皮肤设计降档子集（若涉观感裁位再请 art）；③ = **采 (b)** 只扫 EP11 域，本批实扫结果：除 S3 自留痕外**无新增缺口**；④ = **采 (a)** QA 状态列本批复核翻转（主对话依 verify 常驻判据 seal/ledger/pool 三件 + M01–M13 变异矩阵代翻已落地 8 处，未落码条维持待执行）；另 ADR §6.2/DEC-6 核销回写随本次 §6.3 注同批并入（步 3 已交付 = 事实核销）。

---

## WXG-T-214

**beads·格内占比标准落档（满豆26/实心24/孔⌀12）+ 拦截判据**（CodeBuddy·用户逐项拍板，2026-09-26）

- **背景**：用户 2026-09-26 起对 beads 珠体渲染（facet-4 默认皮肤）多轮调研后逐项拍板：①「坑永远比豆小一圈，有豆时看不到豆坑」（旧坑画在格径 30 上、比珠面 22 还大）；②「满豆基本覆盖格子」（`BEAD_DRAW_INSET` 4→2，珠面 22→26）；③「实心档重定 8→3」（珠面 14→24，旧值系「2 倍满豆内缩」规则在满豆改 2 后失效的孤立遗产）；④「孔径取整、2 的倍数 px」（⌀11.44→12）；⑤格内占比标准确认并要求落档+拦截+变更纪律。
- **标准正本**：`games/beads/art/cell-standard.md`（§1 基准口径 / §2 确认值表 / §3 判据 J1–J7 / §4 变更纪律：改值须调研对照图+面积账（含圆角修正，方角近似不认）+原因说明+文档判据同批+台账登记 / §5 明确不做：颜色辨识度与相邻格可辨单开话题，J2 标注为代理指标非感知标准）。
- **拦截判据**：`games/beads/tests/bead-cell-standard.test.ts`（6 例全解析，只吃 tuning 真源）：两档钉值 + J1 环≥2 设计px / J2 底透≥30% 格径² / J4 孔径偶数 / J5 面≥70% 格径 / J6 珠:底∈[40,60] / J3·J7 锚点在场检查（防宿主判据与标准文档被删）。
- **落码连带**：`BEAD_DRAW_INSET` 4→2、`_SMALL` 8→3、坑外廓=珠面−2×relief（`SOCKET_CARD.relief 0.07`，旧坑 26.4>珠 22 的根因修复）、孔径取整（facet-4/13/18 三套同源，§7.11.6；十层对照臂不动）、plate 墨 −0.34→−0.44（下/右刻面与 B0 底图同色 CR 1.00 的轮廓修复，⛔ 不走 stroke：`KIND_POLICY.allowStroke=false`）。
- **判据同步（全往强改）**：坑⊂珠 包围盒判据新建（bead-render）；孔径取整期望+偶数性钉（bead-render/ledger/fill-pop）；同批性锁 2/0.44+派生 26/6.0；豆径档判据改写「凹槽随档恒⊂珠」（旧「凹槽不随档」与新裁定不可同真，属加强非放宽）；scene-vfx 等比判据改量化容差 ≤0.5px（判别力核过：真超发 +7.7% ⇒ 1.0px 仍红）；pool C12 钉值按实测同步（25.3→25.2%、facetPx 7576→7292 等）。
- **门禁状态**：typecheck/sync:check/cocos:check/check:arch/check:bead-style-pool 绿；beads **722/726**，4 红全在封箱件：腿 1（十层对照臂吃活常量 `BEAD_DRAW_INSET`）与腿 3（孔层 hash，珠体族键）= 本批珠体族视觉改动必然红，**须走 §K.5.1 复评归因通道（参考 T-212 对 plate 改动的先例），⛔ 禁自更新**；腿 4a/4b = 并发缩放控件批在飞红（非本单）。
- **遗留**：① 封箱腿 1/3 复评归因（待编排者/质检落笔）；② `assets-spec §1.10` 补 `cell-standard.md` 指针（建议 art owner）；③ 空坑 S4 受光线两端超出坑底圆角小瑕疵未修；④ 颜色辨识度（等亮度对/CVD/3:1 门）与相邻格可辨**单开话题**；⑤ 标准值未真机验证，按惯例 `[待真机]`。
- **⚠ 入库归属披露（2026-09-26）**：本批文件体（cell-standard.md / bead-cell-standard.test.ts / tuning / bead-render / facet-4 / 13 / 18 / view-model / assets-spec v1.5-r18 / TASKS 主表行等）因与 EP11-S5 批共用工作树，在本文档收口期间被并发提交 **`53d21ac`**（feat(beads): §12.9 步 5——换肤路径+行4 两钮+存档两字段+遮罩分列+五行扩容）的 `git add` 一并扫入；本单专有提交 **`633c4d8`** 仅载收尾增量（knowledge K-081–083 入册、ctx 三产物、本详情节统计行）。两批构成已在 `633c4d8` message 如实披露；后续引用本批代码改动时，**历史定位用 `53d21ac`，知识/ctx/台账尾差用 `633c4d8`**。未重写共享历史（对方 authored，且并发会话可能仍在飞）。
- **领号披露**：213 = 并发「缩放控件」批预留（T-212 注 10），尚未落主表；本单领 214 前已核主表/详情/工作树，`WXG-T-214` 此前仅本单源码注释自引用（现随本行一并正名）。
- **红线**：全程未 commit / 未 push；未动并发批次文件；实验产物已清理（仅留 `temp/bead-edge-ab/capture.mjs` 可复跑，旧观感对照图未入库、如需留档可从 git 历史回退重取）。
- **沉淀统计（kb:sync --task=WXG-T-214，2026-09-26）**：**新增 3 条** —— K-081〔工具链〕台账详情节标题只认整行形状；K-082〔判据〕珠体族视觉改动 ⇒ 封箱对照腿必然红是预期行为、通道 = 复评归因；K-083〔判据〕面积占比是代理指标非感知标准（感知判据 = 对比度 3:1 + 视角 ≥1°，面积账须含圆角修正）。修改/激活/归档 0。`kb:audit` 归档相似命中 0（无重复沉淀）；`ctx:build` 已跑，⚠ `cell-standard.md` 为未提交新文件暂不入索引 ⇒ 提交后须重跑。

- **r5 续批（2026-09-28 · Qoder 会话 · 用户四裁 + 五裁，本单规格线的延续）**：
  - **四裁（A 案 · 外缘制）**：`BEAD_CARD.holeRatio 0.44 → 0.538`，口径改钉**孔外缘**（描边中心线）⇒ 恒等档**外缘 ⌀14 / 真透 ⌀12**（旧 ⌀12/⌀10）；三套风格 + `legacy-ten` 同派生源 ⇒ 孔同步放大。面积账重钉 **珠轮廓 508.0（49.6%）/ 底透 516.0（50.4%）**，J2/J4/J6 全过线、⛔ 门槛零触碰。
  - **五裁（空槽对齐）**：`drawEmptySocket` S1 暗缘框 **宽 = 珠面外描边同 1 dp 绝对**（`SOCKET_CARD.edgeWidth` 作废删除）、**墨 = 孔边线同墨**（盘面格 `endpoints.hole` −0.58；托盘槽 `mix(slot, −0.58)`）；S2 坑底与 S3/S4 明暗线不动。
  - **文件拆分（用户令，同批）**：`cell-standard.md` 拆为母体 + **`cell-standard-holed.md` / `cell-standard-holeless.md`** 两分册，通用口径/判据/纪律只住母体。
  - **判据同步（按真实输出重钉，非放宽）**：`bead-cell-standard`（outerR/真透双口径 + 508.0/516.0）/ `bead-render`（J7 成对锁 `[2, 0.538]`、框墨、legacy 臂 `toBeCloseTo`）/ `scene-vfx`（容差 `0.5*z`，**诚实登记本腿 z=3 判别力降级**，根因 = 运行时连续缩放未实现）/ `bead-style-pool`（C12 台面全套重钉）。
  - **门禁态**：beads **727/736**，8 红 = seal 腿 1/3/4a/4b + 关卡存量 4（前会话线）；typecheck / harness:build / check:links / check:tasks 绿。
  - **新增欠账**：① **seal 第四次复评登记**——腿 3 归因叠四项（三裁墨/四裁线宽/四裁外缘几何；五裁不入封箱域），**腿 1 本批新增破口**（legacy 对照臂孔随 holeRatio 同变），⛔ 禁自更新 fixture；② `BAKE_SCHEMA_VERSION` 放量批烘前必须 bump；③ 纪律 #1 改前/改后对照图 = 待补件（归烘焙批）。

- **r6 续批（2026-09-28 · Qoder 会话 · 用户六裁「孔径 = 真透的区域」，语义回正批）**：
  - **六裁（真透制）**：用户原话「BEAD_DRAW_INSET 是包括真透的区域，孔径是真透的区域」⇒ 推翻四裁 A 案外缘口径：inset 内缩出的珠面 26 **含孔区**，`holeRatio` 派生的是**真透圆**，墨环**外扩吃珠面**。`holeRatio 0.538 → 0.4615`（= 12/26 精确）⇒ 恒等档**真透 ⌀12 / 外缘 ⌀14**，与四裁**同值同形**（描边中心线 r = 真透 r + 1dp ⇒ 墨带 6.5–7.5 逐 texel 等值）⇒ **面积账零变更**（508.0/516.0、珠:底 49.6:50.4 原样沿用）；**J4 取整对象改回真透半径**（真透恒偶，外缘同偶）。
  - **连带：facet-4 孔拆两枚层**：旧 #6 单命令 `fill+stroke` 表达不了「底真透 + 环外扩」⇒ 拆为 **stroke-only 孔环 + pit 孔底**两枚同心圆 ⇒ 层集 **6 → 7 命令 / 0 真 α** = C7 上限（`BEAD_STYLE_MAX_COMMANDS=7`）**压线、余量 0**；`contract.ts` `circle.fill` 转可选（rect/polygon 仍必填，⛔ 不引入 `line` 图元）。`13`/`18` 孔 = 同路径单命令（造型身份）不拆层 ⇒ 真透半径 7 → 6；`legacy-ten` 臂不取整 ⇒ holeR 11.0 → 11.5375。
  - **判据同步（换判别子非放宽）**：`scene-vfx` 孔径腿改**逐档零容差钉值 [5,9,19]**（残差真因 = `liftScaleGain 0.04` 致连续真透半径 6.2419·z，锚点 r=6 自身已含 0.2419 取整偏 ⇒ 任何恒定/×z 带宽皆事后凑数，旧两版带宽作废并如实注明）；`bead-style-pool` facet-4 命令 6→7、C11 两臂基线改 7/0、C12 台面重取（facet-4 顶面**不变**=墨带等值凭证；13/18 回到四裁前值）；`bead-style-ledger` 行 10/11「孔 = 恰 1 枚 circle」判别子失效 ⇒ 改**同心（圆心集 size=1）+ 孔域零真 α**两条负向门 + 孔底唯一 + 环半径 = 真透+1dp，配两条新变异自证（环被当第二枚孔上色 ⇒ 孔底数 2 判红；环抹偏 ⇒ 同心门红）；C7 越界臂 `slice(0,2)→slice(0,1)`（7+1=8）；`facetFills` 加类型窄化 filter（`circle.fill` 转可选的 TS 连带，⛔ 非语义放宽）。
  - **文档四层同批**：`cell-standard.md` 母体 **+v1.0-r6 批注**（含 r6 执行态与 cocos 镜像欠同步登记）/ J4 行取整对象改真透 / r4 索引表 holed 行 / 取整偏移句 46.15%；`cell-standard-holed.md` 三行重排（真透为派生主体、外缘降为派生值）+ J4/取整偏移；`bead-visual-style-spec.md` B14 行 + §13.11-a「不增命令」**自纠** + 图 1 ⑥ 行 + 图 2 标题；`assets-spec.md` §7.11.1 表头 6→7 + 行 6 三批改述沿革（C7 余量 1→0 硬句）+ D4 甲/乙口径修正句（旧「孔=恰 1 枚 circle」识别子失判别力的替代定义）。
  - **门禁态**：beads **728/736**，8 红 = seal 腿 1/3/4a/4b（欠第四次复评登记，归因改写为「三裁墨 + 四裁线宽 + 六裁语义回正与孔拆两枚」）+ 关卡存量 4（前会话线，非本单）；`pnpm run typecheck` / `harness:build` / `check:bead-style-pool` / `check:links` 绿。
  - **本批新拍板项（诚实呈报，未自决）**：`holeRatio` 取 **0.44** 还是 **0.4615**？两者恒等档同为真透 ⌀12，但 0.44 ⇒ `legacy-ten` 臂 = 11.0 = **HEAD 逐字节 ⇒ seal 腿 1 破口自动消失**（代价 = 孔径 +4.9% 取整偏、非恒等档另算，scene-vfx 三档将变 5/9/18）；0.4615 ⇒ ratio 字面即真透比例、语义自洽，但腿 1 仍欠一项。**本批已按 0.4615 落码**。cocos 镜像仍写 0.44（四裁批亦未同步）⇒ 归构建同步批登记。

- **r7 续批（2026-09-28 · Qoder 会话 · 用户七裁「holeRatio 取 0.44，计算后取整 dp」，定值批）**：
  - **七裁**：对上列拍板项选 **0.44 案**（用户原话「holeRatio 取 0.44，计算后取整 dp」）。r6 真透制语义（孔径 = 真透、取整对象 = 真透半径、J4 恒偶）**不动**；废精确值 0.4615，恒等档 `0.44×26/2 = 5.72 → round 6` ⇒ 真透 ⌀12 / 外缘 ⌀14 **逐字同形** ⇒ 面积账零变更、facet-4 拆层（7 命令/0 真 α，C7 压线）不动；代价 = 恒等档 +4.9% 取整偏（知情接受，文档改「名义 44% / 实落 46.15%」）；小豆档 ⌀10 零变。
  - **非恒等档与封箱连带（实测）**：`legacy-ten` 不取整臂 11.5375 → **11.0 ⇒ 逐字节回 HEAD**，全量复跑 **seal 腿 1 转绿**（欠账四项收三项 3/4a/4b）；**seal 归因改写**：「三裁墨 + 四裁线宽 + 六裁语义回正与拆层」，**腿 1 归因划除**；⛔ 仍禁自更新 fixture，第四次复评登记仍待拍板。
  - **判据同步**：成对锁 `[2, 0.44]`（标题同改）+ 派生读数 5.9995→5.72；连续臂 size 50 读数 11.5375→11.0；`bead-cell-standard` holeD=12 注改「0.44 派生 11.44 → 取整 12」；scene-vfx 三档**探针取证重钉 [4, 9, 18]**（连续真透半径 = 5.9616·z；⚠ **如实自纠**：旧六裁钉的 5/9/19 与本批预测的 5/9/18 皆系手推凑数——抬起珠 liftT 各档钉顶=1 ⇒ size = 27.04z，未取证即钉值属判据假账，已作废并在注中留痕）；pool/ledger 注释同批。
  - **文档四层**：`cell-standard.md` 母体新增 **v1.0-r7 批注**（①定值 ②非恒等档 ③封箱归因改写含腿 1 划除）+ r4 索引表行 + 取整偏移句 + **r7 执行态**；`cell-standard-holed.md` 真透行（名义 44%/实落 46.15%）与取整偏移句；`bead-visual-style-spec.md` B14 行七裁回定 + §13.11-a 七裁追注 + 图 2 标题；`assets-spec.md` §7.11.1 行 6 沿革改**四次改述**（④ 七裁段）。
  - **门禁态**：beads **729/736**（7 红 = seal 腿 3/4a/4b + 关卡存量 4，均非本批）；typecheck / harness:build / check:bead-style-pool STATUS OK / check:links / check:tasks 绿。
  - **遗留**：cocos 镜像数值反被七裁「追平」（0.44）但层集/线宽欠账仍在，归构建同步批；纪律 #1 对照图待补；未 commit。

---

## WXG-T-215

**beads·四棱刻面铺满珠面（描边边框）+ 孔边线**（主理人 Qoder·用户两轮看图裁定，2026-09-26）

- **触发（用户两轮看图裁定）**：① 四方刻面珠不得「四个三角画在另一枚圆角矩形里面」——圆角矩形本身即四面绘制；② 设计口径的 2px 边框与孔边线在效果图上不可见。第一轮只收环宽（0.09→0.077）后用户回报「还是圆角矩形框里的四棱正方形」⇒ 第二轮换机制（描边边框）。
- **根因（先取证后动手，证据 `temp/beads-facet-probe/`）**：① 框感真因 = plate 露环**内缘直边（刻面方边）/外缘圆弧**形状不一致，与环宽无关（第一轮只改宽度 0.09→0.077 仍同型失效）；② 边框墨 `mix(base,−0.44)` 与下刻面 `edge −0.30` 仅差 0.14 档，1× 下糊成一片；③ **孔边线代码里根本不存在**（#6 = 平涂 circle，无 stroke）。
- **落码（最终态）**：边框 = **plate 同路径 2px 描边**（新常量 `FACET4_BORDER_LW 0.0769` = 珠面 26 上 2 设计 px；墨 = fill 同值零新色；沿圆角路径 ⇒ 内外缘同形）；`FACET4_FACET_INSET` 0.09→**0.0615**（刻面塞到描边内缘下；实算角点越出弧线 1.05 ≈ 描边外沿 1.00 ⇒ 残差 +0.05px，直边缝 ≤0.6px）；#6 孔同路径 `stroke`（`BEAD_SHADOW_HEX`，同 2px 线族，小尺吃 `BEAD_CARD.minStroke` 地板）⇒ §7.11 读法② 命令数/真 α 不变（6/0，整帧 total 970/1126 逐字不变）；`13` 共用 inset 同受（无描边）。
- **门禁连带**：`KIND_POLICY['facet-4'].allowStroke` false→true（**仅 plate 描边 + 孔边线**；行 9 静态哨由「零 stroke」收窄为「stroke 只在 plate/hole」，`line` kind / rim 三系数防复活一分不让；变异臂 Ⅰ 改道 `13` 保参数化≠全放行的判别力）；C12 重叠登记 151→159（共边对角变长，实算重钉非阈值上调）；pool 顶面 px / facetPx 全实测重钉（7292→8940 等）。
- **封箱第四/五次复评重封**：官方复取器重抓（`provenance.s3_frame_recheck{5,6}` 归因）——`s3.facet{NonHole,Hole}Layers` 45+45 例全更、`s3.frame0/frame78` SHA 更（total 不变）；`head.*` 与 `s3AtFormalization` 史证段冻结不动。
- **文档**：`assets-spec` v1.5-r19（§7.11.1 行 2/6 + §7.11.6 内缩行落码订正，旧字划线留档）；tuning 常量注。
- **验证**：beads **726/726**（含 seal 9/9）；`framework:sync` 已跑（cocos 镜像同批）。
- **已知限制**：① 描边居中于路径 ⇒ 轮廓向外占 1 设计 px，目标色环最窄 3→2px（仍 ≥ J1 地板 2；若真机反馈拥挤可改内缩路径描边，另批）；② `13` 共用 inset 但无描边 ⇒ 对角三角角点越出 plate 弧线 ≈1.05px（真机 0.5 CSS px 量级），登记待 `13` 观感批；③ 边框/边线观感终判 `[待真机]`（承 §7.11.6 口径）。
- **红线**：未 commit / 未 push。

---

## WXG-T-217

- **名称**：beads·缩放上下限绝对倍率化 + 低倍点击档（`systems-index §3` v1.59 真源回写 + 落码 + 验证方案建档）
- **负责**：主理人（Qoder）串行落笔（冻结常量流程：用户拍板 → 主理人确认连带 → 回写 §3 + §6）
- **依据**：用户 2026-09-27 逐项提案（八行参数表 + 连续缩放验证方案原文），本单为其落档与落码批。
- **交付**：
  - **真源**：`design/gdd/systems-index.md` §3.1 盘带行 v1.59 注 / §3.3 缩放区间·低倍点击·控件净空三行 + `BEAD_CELL` 漂移修正 / 文首版本行 v1.59；`systems-index-changelog.md` v1.59 行。
  - **行为正本**：`design/gdd/input-control.md` **v2.11**（捏合行绝对区间 + 新增「棋盘区 tap·低倍档」路由行 + §8-4「z>1 取值 `[待确认]`」解除）。
  - **镜像回写**：`design/ux/ux-spec.md` §4 捏合行、§8 U10（⛔→✅ 已冻结）。
  - **烘焙侧**：`design/proposals/bead-visual-style-spec.md` §13.9 换源注 + 单烘焙论证改「与 fit 无关」。
  - **新建**：`design/proposals/zoom-bake-mip-validation.md` v0.1（五路径 V/S1/S2/M/M+ × 七项测试 × 判定流程 × 工具清单，含用户预测与两条未验面）。
  - **落码**：`src/config/tuning.ts`（`CAMERA_ZOOM_MIN/MAX`、`ZOOM_TAP_MIN`、`ZOOM_CTRL_BOARD_CLEARANCE` 换源、`zoomControlLayout` 注）；`src/systems/board-camera.ts`（`applyPinch`/`clampCamera` 绝对档、`zoomFromSliderT`/`sliderTFromZoom` 去 fit 参、新 `zoomAtPoint`）；`src/game/beads-game.ts`（`_commitBoardTap` 低倍门、滑轨/快照接线）；测试 `board-camera.test.ts`（绝对档口径 + `zoomAtPoint` 三例）/`tuning.test.ts`（净空符号式）。
- **验证**：`board-camera` + `tuning` 48/48 绿；beads 全量 **729/731**（2 红 = `bead-style-seal.test.ts` 腿 4a/4b，见「已知限制」②）；`framework:sync` 已刷 cocos 镜像 3 文件；`pnpm run verify` = **PASS 16 / SKIP 1（check:size 未覆盖）/ FAIL 2**（两条 FAIL 同源 = 封箱腿 4a/4b 的 test + selftest:fast），`check:links` OK、`typecheck`/`framework:sync:check`/`cocos:check`/`harness:smoke` 均 PASS。
- **知识库沉淀统计（kb:sync --task=WXG-T-217）**：**新增 2 / 修改 2 / 激活 0 / 归档 0** ⇒ 新条目 **K-084**（判据：冻结标量换源会翻转派生显示态分支，换源批需同批登记封箱复评）、**K-085**（测试：缩放/焦点几何必须从 `gridLayoutFor` 真源取数，手推屏幕式必漂）；`kb:audit` 无归档候选、无相似命中；`kb:check` 八重校验 PASS。当日骨架落 `memory/2026-09-27.md`。
- **已知限制（诚实登记）**：
  - ① `ZOOM_TAP_MIN` = 0.7 是 `[待真机]` 工程占位 ⇒ QA 不得据以实现判据；低倍档焦点放大的补偿量若越出新档平移悬挑量（板小于视口的盘尤其明显，如 22×17 @1.0 悬挑 = 0），会被 `clampCamera` 锁回边缘，被点格不严格跟手——是否放宽平移锁归体验 playtest / 另案。
  - ② **整帧封箱基线失效**：绝对档下初始 `zoomSliderT` 由 0 变 ≈0.375 ⇒ 滑轨「已选段」rect +1 条，腿 4a/4b 的 `s3.frame0/frame78` 两键与 Δ 常量（控件段 7 条）不再成立。**处置 = 交严守真按官方复取器（`tests/bead-style-seal-recapture.ts`）重抓并归因**，本单不代改基准数值（K-051 禁纸面推算基线）。
  - ③ 低倍段（0.2–0.7）画质/闪烁/mip 策略未验证 ⇒ 定案待 `zoom-bake-mip-validation` 执行批；`blit` kind 框架 ADR = 并发单 **T-216 / ADR-0025** 的产出，本单不代裁。
  - ④ `debugHitCell` / `tapDesign` 调试通道**不经低倍门**（探针保持可直接命中）；真机走 `_readInput` 才受 ZOOM_TAP_MIN 约束。
- **并发披露**：同一工作树存在在飞批次（`production/TASKS.md` 的 T-215 行、T-216/ADR-0025 烘焙缓存、`dev/harness/preview/*.svg`、`bead-visual-style-spec.md` §13 主体）；本单只动上表列出的缩放相关段落。领号按 K-046 先扫：216 已被 ADR-0025 占用未登主表 ⇒ 本单取 **217**，并在主表头注登记 216 的发现。
- **红线**：未 commit / 未 push；未改 §3 其他小节数值；未伪造 `.scene`/`.prefab`/`.meta`。

---

## WXG-T-218

- **名称**：beads·珠面烘焙 `§13` v0.6 四裁定收口（逐层清点 + 裁定落档，纯文档批、零代码）
- **负责**：主理人（Qoder）。用户 2026-09-27 逐项拍板（先问后写，未自行推定）。
- **为何开单**：用户要求「先把现役珠子每颗实际绘制几层、用几次半透明混合数清楚，再按层判断哪些适合烘焙」。
  清点结果与提案有 **7 处出入**（本批逐条入档），且发现 **两处并发批次不一致**。
- **用户四裁定**（逐项选，非推荐即采纳）：
  - ① 纹理平面 = **只烘单珠**（不采推荐外的整格）；就位/空格/锁定整格与单关图集四类不做 ⇒ `§13.8 N1–N4`（逐条给否因与重开条件）。
  - ② 烘焙基准 = **公式版**（珠体边长 × `CAMERA_ZOOM_MAX`(2.0) × min(比例, `BAKE_DPR_CAP`=2) + 1dip）⇒ 满豆恒等档 **≈112 px/纹理**；ADR-0025 DEC-4 的「64px/格」「低端 23dip/格」**作废**（比例 >1 机型在 zoom>1 进入放大区，违反同 ADR 缩放红线）。
  - ③ 孔 = **烘内壁 + live 孔底**（未采本会话推荐的「单珠纹理不烘孔」简化）⇒「孔径整数、2 的倍数」适用范围**收窄至基准烘焙档**，运行时连续半径 + 0.5px 盖缝。
  - ④ 配方基线 = **先恢复 WXG-T-215 再定烘焙**（立为 0 号前置）。
- **连带算清（裁定间的耦合，落笔前算而非事后补）**：选一→二⇒**预算不再是 8MB**：单珠平面 = 35 色 × 66.8KB（含 mip ×4/3）≈ **2.3MB**，B1 改定 **[暂定 2.5MB]**；`8MB` 只在整格平面成立 ⇒ 不得引用。选一⇒原提案 12 项验证义务**降至 6 项**（拼缝/路径切换跳变/`(c,t)` 组合/孔底挖空/阴影 α 五条随平面与阴影一并退出）。
- **逐层清点（实测口径，全部可定位到代码）**：已填格 7 / 0 α（B0 1 + plate 1 + polygon 4 + 孔 1）；空格 5 / 0 α（凹槽判据钉 4 枚）；锁定 3 / **2 α**（斜线吃 `withAlpha(bg,0.9)`，且**不画 B0**）；抬起影 +1/每颗抬起格（L1 实测最大连通组 62 颗）；状态环 +1/1 α；托盘珠 6。**七条更正**：① α 有两把尺（`isRealAlphaLayer` 两支式 vs 命令级 `alpha` 字段）→ 锁定格 2/0 两读；② 「0 次半透明混合」不得写（Canvas2D `drawImage` 仍 source-over，同 K-037）；③ 抬起影逐格 +1 不是 +1/帧；④ **溶解 / 咬合露缘 / 静息接触阴影 无现役承载体**（全仓只有 `AUDIO_CLIP_DISSOLVE` 音频事件）；⑤ 单珠平面下动画期**不需切分层**；⑥ 小豆档需纹理变体 ⇒ 改裁为走矢量臂；⑦ 格心可视窗剔除已在位 ⇒ 1024 格上界只在低 zoom 段。
- **四帧账（替代提案的单一「7,200→1,000–2,300」）**：空盘 5,120 → **5,120（零改善）**；半盘 6,144 → 4,096；终局满盘 7,168 → **3,072（−57%）**；错位为主同价 + 逐抬起格 1。**帧时间判据不得只取满盘帧**。
- **交付（四文）**：`bead-visual-style-spec.md` **§13 升 v0.6**（B5–B8 决议行 + 新增 §13.11 分层四判据与逐项分配（含 L-1…L-6 判据连锁清单）/ §13.12 清点与四帧账 / §13.13 验证义务 6 项，旧口径 `~~划线~~` 留档 K-053）；`ADR-0025` **v0.6 校准**（DEC-1 收窄、DEC-4 作废、内存/义务/复评触发重写）；`control-manifest §19` 七条（`blit` 定名、α 两支式、平面、四帧口径）；`zoom-bake-mip-validation.md` **升 v0.2**（新增 §3.5 测试 8–11 = T2/T3/T5/T6，三臂 A/B/C 定义，§4 补两条判定分支，测试 5 预测按单珠平面重写）。
- **两处并发披露（本批只披露不代改）**：
  - ⚠ **WXG-T-215 代码不在工作树**：三轮改动（plate 同路径描边 + 孔边线 + `FACET4_FACET_INSET` 0.09→0.0615→0、第三轮去 `PLATE.fill`）只活在 `temp/bead-relief-compare/wip-215-full-backup.patch`（`git apply --stat` = 20 文件）；现树 `FACET4_FACET_INSET` 仍 **0.09**、零描边、`assets-spec` 无 v1.5-r19，而主表 T-215 行写「已落（两轮）/beads 726/726」⇒ 台账与代码不一致（patch 内还有 `recheck_7`，主表只到 5/6）。烘焙纹理 = 层集编译产物 ⇒ 不归位就会把已判不合格形态烘进缓存（已写为 §13.9 / ADR-0025 §5-0 / validation 头注的 0 号前置）。
  - ⚠ **WXG-T-216 主表行仍未自登**（头注早已发现该号被 ADR-0025 占用）；本批不代登，仅追加披露。
- **未做（诚实登记）**：不落码（含不跑 patch）、不改 `tuning.ts`、不新增 `BAKE_DPR_CAP`/`bakeSchemaVersion` 常量、不立 ADR-0026（`blit` kind 框架 ADR）、不改 `cell-standard.md` J4 本体（属 L-1，归孔径收窄落码批同批走 §4 变更纪律）；⛔ 未 commit / 未 push / 未发布。
- **验证**：`kb:sync --task=WXG-T-218` 沉淀统计 = **新增 2 / 修改 2（去 `[K-xxx]` 占位残留 + 补判例引用）/ 激活 0 / 归档 0** ⇒ 新条目 **K-086**（测试：α 两个合法计数式不注明就得两套数）、**K-087**（跨IDE：台账「已落」vs 工作树代码缺失，下游消费真源前先 patch↔现树对账）；`kb:audit` 无相似命中、无归档候选；`kb:check` 八重校验 PASS；`ctx:build` + `ctx:check` **OK**（结构门 A/B/C/D/D2/E3 全过）；`check:links` OK；`check:tasks` OK。**零代码改动 ⇒ 未跑全量 `verify`**（测试腿不受本批影响，如实登记不假称绿）。
- **已知限制（诚实登记，提交时会响的门）**：
  - ① **工作树体积越 ctx B 门（8000）且无豁免的两个文件**：`docs/architecture/control-manifest.md` = 8509（§19 属 T-216 新增 + 本批改写净 +≈140）、`knowledge/lessons/criteria.md` = 8317（T-217 加 K-084 所致，非本批）。默认 `ctx:check` 按 **HEAD blob** 算以绿，但 **pre-commit 走 `--staged-blobs`** 时两处均会 FAIL；knowledge 分片按 INDEX §4 **不得新增豁免** ⇒ 只能片内再切子标签或归档，属他批内容 ⇒ 交主理人/质检裁决，本批不自裁、不自改。
  - ② 本批只改文档⇒ §13.13 六项验证义务均**未执行**；ADR-0025 仍属「已采纳、未开工」；⛔ 不得把 §13.12 的命令数账当性能结论（测量单禁令 3）。
  - ③ 参考图风格全矢量（B 臂）无承载配方 ⇒ 其「≈17 命令 / 6 α」仍是估算，需先有美术配方实现才准出数（K-051）。
- **下一批开工序（拆单建议，未入 Epic）**：0 T-215 归位（含封箱 `§K.5.1` 复评归因）→ 1 本批文档（已完）→ 2 ADR-0026 `blit` → 3 烘焙核心（framework core，L2 铁律）→ 4 Canvas2D 适配层 → 5 消费层 baked 臂 → 6 三臂验证（含真机 D2-E3 搭桥）。

---

## WXG-T-219

- **名称**：beads·预烘位图皮肤资产换轨（brand 集进主包 + 新关色集进分包，`§13` v0.7，纯文档批、零代码）
- **负责**：主理人（Qoder）。用户 2026-09-27 三裁定（先问后写，未自行推定）。
- **为何开单（用户提案）**：「我想在 studio 导入时直接烘焙当前品牌用到的颜色的珠子与底色槽纹理，存到游戏目录，是否合适？」
  ⇒ 取证后发现提案指向一个**真实空洞**：§13.5 现裁的「beads-studio 预热」烘进 **L2**，而 L2 = `wx.USER_DATA_PATH` /
  IndexedDB = **运行设备本地** ⇒ 开发者机器上烘出的字节**传不到玩家设备**。预热要触达玩家，只能**以文件分发**。
- **用户三裁定（逐项选，其中两项目标被我标注为「不推荐」仍被选定，故本批把负面全部登记）**：
  - ① 纹理定性 = **乙：位图皮肤资产**（包内 PNG 成为**独立视觉真源之一**）⇒ 须明文推翻 2026-09-25「禁用纹理与位图皮肤」
    裁定，并连带重审 C3／C12／双指标门禁适用面。**我不推荐**（推荐甲：纹理只作缓存分发形式、真源单一），用户选乙。
  - ② 烘焙范围 = **单珠 + 空格凹槽一起烘** ⇒ 重开 `§13.8 N2`，**推翻 v0.6 B5**（裁定①「只烘单珠」）与 ADR-0025 DEC-1。
  - ③ 交付 = **文档 + 落码方案一并** ⇒ 本批除四文换轨外，另出 ADR-0027 §6 的 S0–S8 实施路线（**只出方案不落码**）。
- **落位（用户直接指令）**：「进主包游戏目录，新关走分包」⇒ DEC-5：主包 = 仅 brand 集；新关色集随**该关**进分包，
  与关卡 manifest 版本号耦合发布（`bakeSchemaVersion` 变 ⇒ 相关分包全量重出，不做增量纹理补丁）。
- **取证实测（先算再写，非估算）**：
  - `games/beads/art/` **16 份品牌 JSON 合计 2104 色**（artkal-a 145／c 174／m 220／r 89／s 210／diamond-dotz 461／mard 291／hama-maxi 25 …）
    ⇒ **`BEAD_COLOR_MAX = 35` 是单关上限，不是品牌集规模** ⇒「brand 用到的颜色」口径未钉 = **DEC-6**，三档待拍：
    **P1** 首屏必用色并集 ≈0.16–0.4 MB／**P2** 单品牌整张（145 色 = 290 张）≈1.5–3.5 MB **已顶穿主包余量**／
    **P3** 全品牌 2104 色 = 4208 张 ≈20–50 MB **主包不可能、分包亦顶穿 ≤30 MB 总红线** ⇒ **P3 被数学否掉**。
  - **包体守卫当前无牙齿**：`check:size` 在 `pnpm run verify` 内 **SKIP**；`check-bundle-size.mjs` 仍硬编码
    `mainTargetKb: 2000` 且 A7 断言钉 2000（知情豁免）⇒ WARN 永不触发；而 §3.9 v1.51 内部目标已与 4096 KB 平台红线**合流**（缓冲消失）。
    ⇒ 定性为 DEC-1 的**前置义务 S0**（⛔ 等于在没有度量的前提下往主包加重物），登记为 §5-2 复评触发。
  - **同族先例在役**：`art/<slug>.json → tools/scripts/sync-palettes.mjs → src/config/palettes-data.ts`（头注 `GENERATED FILE`）
    + `palettes:check` 漂移守卫入 verify ⇒ 本 ADR 的生成工艺是这条链的**位图版**（DEC-4：必 import 游戏侧同一份层集模块
    + 同一 `bakeSchemaVersion`，⛔ studio 另写一份绘制实现 = 真源分叉）。
- **交付（五文，零代码）**：
  - **新建** `docs/architecture/adr/ADR-0027-beads-prebaked-bitmap-skin-assets.md`（**工程正本**）：DEC-1 推翻清单（四条，含
    2026-09-25 A 案禁令按其自订「重提须走 ADR」程序由本 ADR 解除；**AI 参考图仍不进仓不进包**）／DEC-2 门禁降级与翻案资格
    （性能型移出者 02／07／11／12／17 具备翻案资格；语义合规型 16／19 **不在**范围）／DEC-3 三层读序
    （主包 brand → 分包关卡色集 → L2 运行时烘 → 矢量兜底，四者共用同一 key）／DEC-4 生成工艺同源／DEC-5 分包落位／
    **DEC-6 口径**（二批改为**条件裁定**分支表）／**DEC-7 内存双张 ≈4.7 MB**；**DEC-8 八条纪律（二批自 §19 外移 ⇒ 正本）**；负面八条与复评触发 0–7；§6 落码路线 S0–S8 与分批建议。
  - `bead-visual-style-spec.md` **§13 升 v0.7**：B2／B5／B8 划线作废，新增 **B9–B12**；§13.5 新增 **L0 预烘资产层**并揭穿
    「studio 预热烘进 L2」空洞；§13.8 **N2 转生效**（三条义务：张数 ×2／两条机检必须重设／P7 降为工艺保证）；
    §13.12 空格行与四帧账 A 行作废（真数 **[待落码实测]**，⛔ 不得提前改成假定的 N2 数值）；§13.13 判定顺序更新；
    新增 **§13.14** 美术侧三约束并声明 ADR-0027 为工程正本。
  - `ADR-0025` **v0.7 再校准**：标题改「运行时烘 + 预烘资产双轨」；备选 D 改判（预产与运行时**共存**，运行时臂⛔ 不得删除）；
    DEC-1 扩类；§4.1 空盘帧「零改善」作废；§4.2 内存预算回 **[待定]**；§5-3 转已定事实；头注写明「⛔ 不得只读本 ADR
    就认为零包体与空盘帧零改善仍是现行结论」。
  - `control-manifest.md` **§19 换轨**：标题/决策/范围改三层字节来源；第 2 条加 v0.7 口径修正（双指标降级 + C12 统计域不可执行）；
    新增**第 8 条预烘资产纪律**（同源 import + `bake:check` + 守卫未归位则禁止向主包投放位图）。⇒ **二批**：为过体积门，八条纪律整体外移为 ADR-0027 **DEC-8**（该列为正本），§19 只留「标题 + 一行红线指针」。
  - `zoom-bake-mip-validation.md` **升 v0.3**：§3.5 四项→**八项**，新增测试 **12 同源性**／**13 分包到达时序**（⛔ 空帧）／
    **14「一张图」机检重设**／**15 包体实测**（brand 集 ≤ 主包余量 1/3）；测试 9「空盘帧零改善」作废；测试 10 预算改 [待定]
    并标出与测试 15 的张力（降 `BAKE_DPR_CAP` 同时改变预烘文件基准 ⇒ 必须同基准）；§4 步 8 开工前置。
- **二批裁定（同批续作，用户 2026-09-27 二次输入，非本批自推）**：
  - ① **DEC-6 收口 = 条件裁定**：用户原话「**实时烘焙如果能达到效果，那就这么办，否则 B**」；「B」存在两解（旧三案的 B = 全走分包/远程 vs 本轮选项第二项 P1）⇒ **未猜**，追加一问澄清后定为 **P1：主包只放首屏必用色小集**。
    ⇒ ADR-0027 DEC-6 由「三档待拍」改写为**分支表**：主路 = `§13.13` 的 **T1／T4／T5／T6 实测全绿 ⇒ 不投放包内位图**（ADR-0027 转「已采纳但挂起的备用案」，ADR-0025 仍为现行唯一实施路线）；
    兜底 = 任一不达 ⇒ **P1 档**开工。连带三处：§5-0 前置由「口径未钉」改「**运行时烘臂未实测**」；`§13.1` 新增 **B13**；验证档测试 15 加「只在预烘臂触发后才跑」前提 + §4 步 8 固定顺序 = **先测后投**（⛔ 不得先投资产再补测），升 **v0.3.1**。
  - ② **DEC-6 收口不解除 DEC-7**（当场复算）：两分支下运行时烘都是主路径 ⇒ N2 双张 ≈133.6 KB/色 ⇒ 35 色 ≈4.7 MB 仍在 ⇒ **L1 预算仍 [待定]**，两条出路待拍。
  - ③ **`control-manifest §19` 越限处置 = 用户选「片内瘦身」**⇒ 执行时**前提被实测推翻**：§19 只占 **991 tok**、HEAD 全文已 **7890** ⇒ **单靠压缩 §19 不可能回到 8000 以下**。改采「**细则外移 + 指针化**」：八条纪律整体移入 ADR-0027 成为 **DEC-8（正本）**，§19 压成「标题 + 一行红线指针」⇒ 文件 **8881 → 7973 tok**（fileMax 8000，**余量仅 27**）。
    ⚠ 结构性风险如实登记：该文件已无可持续压缩空间，下一次新增小节必先破门 ⇒ 建议**另批**把 §13–§19 细则拆片或外移 ADR，本批不扩范围动手。
- **三批裁定与图例入档（用户 2026-09-27 第三次输入：「孔内也需要描边区分与底色，选 A」）**：
  - **选 A** = 不新建文档，在 `§13.11` 就地扩写图例（避免第二真源）⇒ 新增 **§13.11-a 一格层栈图例**：图 1 层栈爆炸图（▣ 进纹理 / ⚙ 逐帧程序化，逐条标「不进纹理的理由」）、
    图 2 珠面俯视（plate 底衬 + 四刻面 + 孔边线 + 孔底，带几何真源 `BEAD_PITCH 32 / BEAD_CELL 30 / 珠边长 26 / 孔 ⌀ 12`）、图 3 凹槽剖视（S1–S4、暗上亮下、坑 ⊂ 珠）、账表（一格命令数随批次漂移）。
  - **B14 孔边线 = 必选层**：承载体 = `facet-4` #6 **同路径 stroke**（`BEAD_SHADOW_HEX #1E2033`、`FACET4_BORDER_LW = 0.0769` × S、小尺吃 `minStroke` 地板）⇒ 不增命令不增 α 零新 hex（§7.11 读法②）；
    ⇒ 它把 §13.3「烘孔内壁」的**内容真身钉住**：入纹理 = 描边 + 孔框，孔底 `pit` 仍 live；⛔ 不得推广成全风格开放 stroke（`KIND_POLICY['facet-4'].allowStroke` 仅 plate + hole）。
  - **取证副产品（新发现，已登 §13.9 末）**：`BEAD_STYLE_MAX_COMMANDS` 工作树 = **7**（`tuning.ts:1249`），而 T-215 patch 第四轮已改钉**11 命令 / 0 α**（刻面裁圆角 ⇒ 9 三角 + plate + hole）
    并同步上调该常量至 11 ⇒ **旧口径不自洽**：同 patch 内 assets-spec `v1.5-r19` 头注仍写「双指标仍 6/0」；且 `§13.12` 的「已填格 7 命令」是**归位前**读数（终态 = 12）。
    ⇒ 对本单的直接影响：烘焙收益比 §13.12 表更大（12→3），且 C7 进一步退成「配方复杂度上限」（= DEC-2／DEC-8-2 同向）；⛔ 本批不改 §13.12 真数（属 T-215 归位批的差分复算），只加警告指针。
- **裁定耦合当场复算（承 T-218 纪律）**：裁定②（N2 生效）⇒ 凹槽墨 `mix(base,−0.44)` 随**目标色**变 ⇒ 整格底 per-color
  ⇒ 张数 ×2 ⇒ 同基准 ≈133.6 KB/色 ⇒ **35 色 ≈4.7 MB** ⇒ v0.6 才刚定的 **[暂定 2.5 MB] 当场失效**，B12 改标 **[待定]**
  并声明「⛔ 不得再引用 8／2.5／2 MB 任一旧数」；两条出路（抬预算 vs 整格底降基准）交 DEC-7 待拍，本批不自裁。
- **未做（诚实登记）**：不落码（不建生成器、不加 `bake:check`、不动 `check-bundle-size.mjs`、不碰 `game.json` 分包配置、
  不产任何 PNG）、不立 ADR-0026（`blit` kind）、不跑 T-215 patch、不代拍 DEC-7／生成物入库与否（DEC-6 = 用户二批亲裁，本批只落档）；
  ⛔ 未 commit / 未 push / 未发布。
- **并发披露（承接 T-218，本批不代改）**：⚠ **WXG-T-215 代码仍不在工作树**（配方真源只在
  `temp/bead-relief-compare/wip-215-full-backup.patch`）⇒ 已写为 ADR-0027 §5-1「不归位不得烘任何资产」与 S1；
  ⚠ **WXG-T-216 主表行仍未自登**；⚠ **ADR-0026 仍未立** ⇒ S2 未完成前 `blit` 无框架承载，本批 ⛔ 不代立。
- **验证（已实跑）**：`kb:sync --task=WXG-T-219` 沉淀统计 = **新增 3 / 修改 0 / 激活 0 / 归档 0** ⇒ **K-088**（测试：渲染形态换轨使以图元为统计域的机检判据静默空转）、**K-089**（测试：守卫硬编码阈值与冻结真源脱钩 ⇒ 断言永不触发，投放重物前先实测「守卫能不能红」）、**K-090**（环境：设备本地存储不是分发通道）；`kb:audit` 无归档候选、无相似命中；`kb:check` 八重校验 **PASS**（活跃 87）；`ctx:build` + `ctx:check` **OK**（结构门 A/B/C/D/D2 与 E3 全部通过；新文件 4 个属未提交⇒本次未入索引，pre-commit 会以 `--staged-blobs` 重建）；`check:links` OK；`check:tasks` OK（主表/详情 31 对配对完整，名称列≤60 字）。**零代码改动 ⇒ 未跑全量 `verify`**（不假称绿）。
- **已知限制（提交时会响的门）**：
  - ① **`control-manifest.md` 体积（已按用户裁定处置，仍属提交时会响的门）**：本批 §19 换轨后工作树 **8881 tok**（HEAD 7890，fileMax 8000）⇒
    用户选「片内瘦身」⇒ 实际可行做法 = **八条纪律外移 ADR-0027 DEC-8 + §19 指针化** ⇒ 现 **7973 tok**（余量 27）；pre-commit `--staged-blobs` 可过。
    ⚠ 但**不解决根本问题**：文件已近零余量，下次新增必再破门 ⇒ 拆片建议已登记（见上「二批裁定③」）。同批实测未越限：`knowledge/lessons/testing.md` 7269（新增两条后仍余 731）、
    `knowledge/lessons/environment.md` 1455 ⇒ 本批沉淀特意避开已越限的 `criteria`（工树 8317）与 `process`（7889）两片。
  - ② 本批只改文档 ⇒ ADR-0027 属「已采纳、**不得进入落码**」（§5-0 v0.7.1：**运行时烘臂 T1／T4／T5／T6 未出实测** ⇒ 预烘臂不开工）；⛔ 不得把 §13.12 的命令数账当性能结论。
  - ③ DEC-6 三档体量按「单张 5–12 KB」估算区间给出 ⇒ **单张 PNG 真字节 [待实测]**（S0 后才能定量），本批不给结论；二批的 P1 小集（≈16 色 / 双张 32 张）**同样只给量级不给真数**（K-051）。

---

## WXG-T-220

- **名称**：beads·珠面烘焙管线框架层实施（blit kind + 烘焙核心 + 双臂分流）
- **负责**：主理人（Qoder）。
- **背景**：承 WXG-T-215/216/218/219 的珠面烘焙路线（ADR-0025 运行时烘 + ADR-0027 预烘）落框架层。
- **交付**（本续作会话按主表行 + 工作树代码补登，不虚构未做的交付）：
  - 阶段 0.3 ADR-0026 `blit` kind 框架改造（前置）；阶段 1 烘焙核心 `packages/framework/src/core/bake/`（bake-key / bake-lru / bake-budget / bake-surface）；阶段 2 Canvas2D `BakeSurface` 适配层（配方注入模式，框架不 import `drawFilledBead`，L2）；阶段 3 `bead-render` 双臂分流（`setBeadBakeRuntime` 注入启用烘焙臂，默认 undefined = 矢量臂不变）。
  - blit 命令三消费端同步（Canvas2D 实绘 + Cocos 静默跳过 + SVG 占位）；`BAKE_CANONICAL_SIZE = 112` 落 tuning；§13 / ADR-0025 状态标记已更新。
  - **三臂实验页联调期补修（本会话发现并修）**：① `bake-experiment.html` 缺 `@wxgame/framework` importmap + beads 相对路径指错源；② 烘焙臂 recipe 递归调 `drawFilledBead` ⇒ 加 `_baking` 重入守卫（try/finally）；③ 烘焙臂与矢量臂上下颠倒 = bake 端 `applyViewportTransform` 与 blit 端 y-flip 不匹配 ⇒ bake 预翻 y-up + blit 仅在 `_applyTransform` 时局部补偿，两臂 Δ 从 24.3% 降到 6.8%。
- **状态**：🚧 框架层落码完成、灰度未开启；余项 = 阶段 4 harness 三臂性能实测 / 阶段 5 放量。
- **配对说明**：主表 WXG-T-220 行早先已落、详情节漏登（K-046 同型）⇒ 本节由 WXG-T-221 会话补登以恢主表↔详情配对（`check:tasks` C 门）。

---

## WXG-T-221

- **名称**：beads-studio·当前关预烘导出（珠面 + 格面 PNG 落本地资源目录，S3-lite）
- **负责**：主理人（Qoder）。用户 2026-09-28 三裁定（先问后写，未自行推定）。
- **背景**：T-219 把预烘臂判为「条件裁定 = 运行时烘实测全绿则不投放包内位图」。用户本批直接推翻该条件裁定、令预烘臂开工，但**范围收窄至「当前关」**（非 brand 集全量）。
- **用户三裁**：
  - ① 开工时机 = **直接推翻 ADR-0027 DEC-6 条件裁定** ⇒ 预烘臂开工（已在 ADR 头注加「三批裁定」条 + §6 表 S3-lite 行）。
  - ② 渲染后端 = **浏览器端出图**（`Canvas2DBakeSurface`，不加 node-canvas / playwright）。
  - ③ 平面 = **珠面（styleId×colorIdx）+ 空格整格底（colorIdx only，孔 live）**（ADR-0027 DEC-1 双张）；存盘目标 = **写工程资源目录 `games/beads/assets/{bead,cell}/levels/`** 供 dev 读，不进 game.json / 不入主包 / 不入分包；「缺少」= 扫目标目录已有文件求差，只烘当前关用到的色集中缺的张。
- **交付（四触 + 一文档）**：
  - 框架层（同源前置）：`packages/framework/src/core/bake/bake-recipes.ts`（`makeBeadRecipe` / `makeCellRecipe`，注入式、L2 洁净）+ `bake-schema-version.ts`（`BAKE_SCHEMA_VERSION = 1`）+ core barrel export；`bead-render.ts::createDefaultBakeRuntime` 改吃 `BAKE_SCHEMA_VERSION`（不再硬编 1 = 单一真源）。**测试** `tests/core/bake-recipes.test.ts`（5 例，同源判据 = 调用契约逐字节等）。
  - Studio 服务：`server.mjs` 加 `GET /api/bake-manifest?id=&style=`（扫 result 用色集 ∖ 已有文件 ⇒ 回缺失清单，文件名服务端权威生成 `<slug>__c<idx>__v<schema>.png`）+ `POST /api/bake-save`（kind 白名单 `bead|cell`、filename 严格 `[a-z0-9][a-z0-9_-]{0,123}\.png`、base64 解码落盘、覆盖前报旧字节）；两路仅本地仓开（容器 501）。另开 `/harness-dist/*` 只读映射供前端 import 框架/beads 编译产物。
  - Studio 前端：`public/bake-export.js`（ES module，双 surface + 逐张 bake→PNG→POST）+ `index.html` 详情面板「烘焙本关纹理」按钮 + `#bake-status` + importmap（`@wxgame/framework` → `/harness-dist/packages/framework/src/`）。
  - 文档：ADR-0027 三批裁定头注 + §6 表 S3-lite 行；主表 WXG-T-221 行、下一可用号顶至 222。
- **范围外（显式不做，均登记为后续批）**：分包 game.json 接线 / 主包投放 / 包体守卫实跑（→放量批）；`bake:check` 漂移守卫；运行时消费这些 PNG（bead-render 只有 `_bakeRuntime` 槽位，本批不接文件加载器）；Cocos 端；**品牌色板（artkal/mard…）烘焙**（palette 注入未接 ⇒ 前端按 `palette==='10'` 判定，非 demo 置灰）；逐张 PNG 哈希一致性回归（元数据块跨浏览器不稳）。
- **验收（手工四项，本批无 node 集成测试基建）**：① 起 harness:build + studio server → 生成一条 14×14 demo 关 → 点按钮 → `assets/{bead,cell}/levels/` 出现 ≤ N 张 PNG；② 再点 → 状态显「全部已烘」；③ 改 pattern 一格换色 → 重烘 → 只多出该色两张；④ `git status` 显示 assets/ 新文件（不入主包 ≠ 不入仓，本批入库留证）。
- **已知限制**：同源 import 依赖 harness 产物 ⇒ 未 `harness:build` 时 `/harness-dist/*` 404、按钮报错；写盘无鉴权（与 ingest 同级，仅本地仓）；PNG 像素 vs 运行时同源性本批不测（→运行时读序接线批）。
- **r8 续批（2026-09-28 · Qoder 会话 · 用户八裁「运行时烘焙暂缓/改道 tint+mask，预制 mask 纹理；旧路线要么完全删除要么历史归档」，呈报三案后拍板 B = 历史归档）**：
  - **裁定**：运行时烘焙路线停止推进、整案转**历史归档**（≠ 抹除）；现行目标路线 = **ADR-0028**（每风格一张无色调 mask，key 去 `colorIdx`）；预烘臂与 S3-lite 产物**不废**（解剖样张 + `bake-recipes`/`bake:check` 生成链路复用，ADR-0028 §2.4）；代码**不物理删**（tint T1'–T4' 未证前的兜底参照），原地冻结。诚实边界：八裁定的是路线取向，⛔ 非实证——T2'（wx 侧 multiply/screen，仓内在役用量=零）未跑不得落码。
  - **文档面**：ADR-0025 头注 + DEC-3 行归档注；ADR-0027 头注（运行时烘兜底轨随归档、预烘不废）；ADR-0028 状态行升「采纳为现行目标路线（待验证批）」+ §2 决定句「现行主路径仍=0025/0027」划线划除；spec §13 头部 ⛔ 路线状态注 + 表尾新增 **B15** 八裁行（含 B7 在 tint 制下对应物 = 孔边线入 mask、pit 仍 live）。
  - **代码面（仅注释零逻辑变更）**：`bead-render.ts` BeadBakeRuntime 块头 + 框架 `bake-key.ts` 头加 ⛔ 冻结注（复活或删除均须新 ADR），其余 bake 模块由两正点注覆盖；cocos 镜像注欠账随既有镜像同步批。
  - **台账与记忆**：主表 WXG-T-221 行补八裁段；memory `2026-09-28.md` 新增 r8 段；记忆同步：c0015c0c 更正为八裁定案态、a7cfa892「孔不入纹理」改注路线史、44512002（v0.5 快照条）追加更正段。未 commit。
- **seal 封箱基准复评登记（2026-09-28 · 严守真·quality-lead · 由主理人调度，属本链下游 QA 单，归口 WXG-T-214 台账）**：
  - **定性**：四～八裁在**珠体族孔层**上落了四笔用户拍板（三裁孔边墨 `hole=mix(base,−0.58)` / 五裁孔边宽 1 dp 绝对 `BEAD_CARD.holeStrokeWidthPx` / 六裁 facet-4 孔拆两枚层 `HOLE_RING`+`HOLE`（层集 6→7）/ 七裁 `holeRatio` 定值 0.44 与 inset 成对锁）⇒ `tests/bead-style-seal.test.ts` **腿 3 / 4a / 4b 三例红**（非 flaky）。走**唯一例外通道（复评归因）**，⛔ 非刷绿；判据文件头原禁令「不得反向更新基准让它绿」（K-051/K-053）**原文未动**。一切新值出自**官方复取器**重抓（无一手填数，⛔ 未走 `capture.sh s3`）。
  - **可复现锚**：前态 = `git archive 21317d8` 隔离副本跑复取器，**逐字节复现**夹具 `recheck_4` 锁（`frame0 970/5c41e321…`、`frame78 1126/1b5c8639…`，且非孔/legacy 三键零差）；现态 = `927535c`（本单HEAD）。
  - **修订面（三处）**：`s3.facetHoleLayer` 45/45 重取（**键形不变、语义变** = #6 HOLE_RING + #7 HOLE 两枚串联，互异 sha 15→39）· `s3.frame0 = 971/53139dd…` · `s3.frame78 = 1205（circle 160）/e5c00786…`；`head.*` / `s3AtFormalization` / 非孔 45 例 / `s3.legacyFlow` / `fixture.*` **逐键全等未动**（写入脚本内 assert，非口径转述）；provenance **追加**新键 `s3_frame_recheck_5`（含变更源逐条 + 流级差分账 + 上游批自封失效）。
  - **b2 流级差分（逐条比较，未解释 0 条）**：`frame0 970→971` = 全等 783 + 改写 187 + 插入 1（五裁字段级 180 条 + WXG-T-217 控件带）；`frame78 1126→1205` = 全等 695 + 改写 431 + 插入 79（六裁 `circle/stroke ×78` 环 + WXG-T-218 polygon 重写 312 + 五裁 102 + 控件带）；**逐 kind Δ** = `rect +1 / circle +78 / line 0 / text 0 / polygon 0 / total +79`，与上游登记逐项对账。
  - **判据仓裁（只加不减）**：文件头四条腿口径改写 + 新增「唯一例外通道」注块；腿 3 标题改两枚串联 + **6 条键形自证**（层集长 7 / `slice(5)` 长 2 / 环 stroke-only 无 fill / 底无描边有 fill / `size=26` ⇒ 真透 ⌀12、外缘 ⌀14 / `recheck_5` 必含「第五次复评」+「HOLE_RING」）；「差分自洽」例 `circle` 桶 `78×−1 → 78×0`、纸面锁 `1127 → 1205`、新增 `kinds.circle = 160`；腿 4a/4b 标题与登记在案校验收紧。零删断言 / 零阈值软化 / 无 env 后门，用例数 9→9。
  - **结果**：`bead-style-seal.test.ts` **9/9 绿**（seal 腿 1/2/2b/3/4a/4b 全绿）；全量 `pnpm --filter beads test` = **732 passed / 4 failed / 55 files**（首跑 **729/7**，差 = seal 三红归零）；**剩 4 红 = 关卡存量**（`misplaced-assembler` / levels BOOT validator / `level-import` / `levels-dir-pipeline`），**非本批引入、本单不代翻**；`npx tsc --noEmit`（beads）**退出 0**；`pnpm run check:links` / `check:tasks` 绿。
  - **文档面**：QA `production/qa/beads/test-cases.md` 新增 **`K.5.1-补3`**（v1.19→**v1.20**，头部任务号 + 变更记录表行 + `K.5.0-补` 三处旧句**就地作废划线保留**）；主表 WXG-T-214 / T-221 行各追加一句。
  - **⚠ 转呈两件（本单不修）**：① **P2 上游批缺陷** = `927535c` 提交内已无锚自封整帧两键（抓取态 = `21317d8` + 未提交工作树 ⇒ 不可复现，本单隔离副本逐一否定该中间值）且**追改 `head.legacyFlow` 48/96 例**（机械归因 `liftShadowFade 0.4→0.55` ⇒ 抬起投影 α `0.09→0.0675`）而 **provenance 零新增键** ⇒ 踩 `head.*` 史证冻结口径；本单按铁律**不追改也不回退**，处置待裁。② **夹具键碰撞** = `temp/bead-relief-compare/wip-215-full-backup.patch`（T-215 未落地三轮，ADR-0027 行 153 已披露）内已写 `recheck_5/6/7` ⇒ 与本单已入库键 5 字面碰撞，归位批重编方案待裁。**【处置 2026-09-28 · 用户裁「按建议执行」】**① 迁入新子段（QA 建议③）已执行：`head.legacyFlow` 回补 `927535c^` 史证态，48 例现役值迁入夹具新档案段 `head_liftShadowFade_r5`（值 ≡ 官方重抓 `s3.legacyFlow` 同键，零手填），判据腿 1 改合并视图 + 双向锁，归因追加 `provenance.s3_frame_recheck_5` 末段；无锚自封的两整帧键已被本单可复现锚重封覆盖（历史提交不回改，登记在案即可）。② 补丁预写键已重编 `_6/_7/_8` 解除碰撞（正本 = K.5.1-补3 处置条）。
  - **取证边界**：`[Node]` only，⛔ 不作屏幕层 PASS（K-037）——两枚同心圆是否读作「真透孔」、1 dp 孔边在低倍率屏是否糊，均归 Playtest `[待真机]`。证据 = `temp/qa-wxg214-recheck5/`（不入库）。**未 commit / 未 push。**
- **未做**：⛔ 未 commit / 未 push / 未发布（r8 同此）。

### r9 批（2026-09-29 · 遗留三件收口：seal 复评 / ADR-0028 §5 回写 / 纪律 #1 对照图）

- **seal 第四次复评**：已由严守真（quality-lead）走 §K.5.1 唯一例外通道登记完毕（正本 = `production/qa/beads/test-cases.md` `K.5.1-补3` v1.20 + 夹具 `provenance.s3_frame_recheck_5`，官方复取器重抓，b2 流级差分未解释 0 条）⇒ seal **9/9 绿**、全量 **732/4**（余 4 红 = 关卡存量）。结论 CONCERNS，裁量点与上游批缺陷（`927535c` 无锚自封 + `head.legacyFlow` 48/96 追改零归因键）已转呈用户待裁，本会话不代处置。
- **ADR-0028 §5 回写**：标题/§2 章头残留的「候选、本轮不落码」措辞随八裁订正；新增**执行态段** = `temp/tint-probe/` 按现树整备（B15：孔族墨不入 mask、拆 live 层 A/B 同源重放；早前版把旧等比残留算进 ΔE 已修）后重跑：**mask-stable bead/cell 均 PASS、零族外墨、不透明芯 ΔE mean ≤0.44 / p95 ≤0.62（达 §13.13 T1 平均线）**；未达项如实登记（AA fringe 最劣 11.3、芯 max 4.62）；边界写死 = 本 PASS 仅浏览器通道可行性，**非 T1' 本体**，T2'–T4' 未跑、⛔ 不得外推。证据 `temp/tint-probe/results-r9.log`。
- **纪律 #1 对照图（WXG-T-214 欠件）**：`temp/bead-hole-ab/`（`compare.mjs` 可再生 + `ab.svg`/`ab.png`）= 恒等档有孔格改前（`53d21ac`，pit 单命令 ⌀12 当外缘）/ 改后（`927535c`，真透 ⌀12 + 1dp 环外缘 ⌀14，几何直读 `FACET4.beadLayers`）；面积账与 `bead-cell-standard::account` 同式复算 = 508.0/516.0 吻合钉值且两版同值 ⇒ 诚实结论：四～七裁真实视觉差 = 1dp 环墨，非孔洞变化；登记入 `cell-standard.md` §4 r9 执行态行。
- **r5 处置追加（同批 · 用户裁「按建议执行」2026-09-28）**：`head.legacyFlow` 48 例越界追改按 QA 建议③迁入夹具新档案段 `head_liftShadowFade_r5`（回补史证态 + 腿 1 合并视图双向锁，seal 复跑 9/9 绿）；T-215 备份补丁 `temp/bead-relief-compare/wip-215-full-backup.patch` 预写键 `recheck_5/6/7` 就地重编 `_6/_7/_8` 解除字面碰撞；ADR-0028 T2'–T4' 验证批**未立项**（待用户单独拍板，ADR §5 停「前置 PASS」态）。

---

## WXG-T-223

- **名称**：beads·空槽凹感改「槽内一周内阴影」（删 S1 描边 + 坑底边对齐珠面描边）
- **负责**：主理人（CodeBuddy）。用户 2026-09-28 三项裁定 + 两轮先问后写（未自行推定数值）。
- **背景**：前一轮 review 发现空槽凹感全靠 S1 暗缘框（1 dp stroke，`hole −0.58`），且该框与珠外描边**不同轮廓**（坑外廓 21.8 vs 珠面 26）；用户先后裁「槽暂时不要做描边」→「坑底不要描边，增加内边阴影；坑底边与珠面描边对齐」→「内阴影 3 层阶梯 −0.80/−0.68/−0.58」→「删框与内阴影同批替换，不留开关」。
- **用户裁定（四项）**：① **槽不做描边** ⇒ S1 暗缘框整笔删除（⛔ 不留开关，C4）；② **槽内一周内阴影**（非分层加深、非描边）；③ **坑底边与珠面描边对齐** ⇒ 盘面格 `relief` 退 0；④ **内阴影 = 3 层阶梯 −0.80 / −0.68 / −0.58**，每层 1 dp（承接我呈报的选项 C）。另：去框方式选「同批替换、不留开关」。
- **落码（四文件）**：
  - `src/config/tuning.ts`：`SOCKET_CARD` 删 S1 线宽注（连描边本身作废）+ 新增 `innerShadeStepDp = 1`；`relief` 注释重写为**仅托盘槽生效**（分叉）。
  - `src/view/palette.ts`：新增 `SOCKET_SHADE_OUTER_MIX 0.80` / `SOCKET_SHADE_MID_MIX 0.68`；`BeadEndpoints` 增 `shadeOuter` / `shadeMid` 两字段（`bakeEndpoints` / `FALLBACK_ENDPOINTS` 同步）；最内层**复用**既有 `hole` 档（−0.58，耦合已登记，省一个字段）。
  - `src/view/bead-render.ts`：`drawEmptySocket` 重写——删 S1 stroke；`relief = beadInset > 0 ? 0 : …`（托盘分叉）；4 枚同心圆角 rect **由大到小**依次 fill（后画覆盖内部 ⇒ 每层留外沿 1 dp 环），圆角逐层递减；S3/S4 改画在中心坑底内；**S3 墨 `pit → hole`**，`tilePainted` 分叉删除；`neutralEndpoints` 同步两字段；删 `FACET4_EDGE_INSET_PX` import（不再消费）。⛔ 热路径零分配：4 次直调、不建数组。
  - 命令账：盘面空格 **4 → 6**；托盘空槽 **5 → 7**（净 +2）。
- **判据同批改写（纪律 #3，⛔ 非放宽 = 换识别子）**：
  - `tests/bead-render.test.ts`：枚数 5→7 / 4→6；新增「**槽侧零 stroke**」断言；J3 由「坑外廓包围盒**严格小于**珠体」→「**外沿相等**（本裁）+ **中心坑底严格 ⊂ 珠**」（旧识别子 = stroke-only rect，随删框失效）。
  - `tests/bead-style-settings.test.ts`：凹槽由 2 档 → **4 档等差**（实测：满豆 26/24/22/20，小豆 24/22/20/18）；⚠ 凹槽外沿档与珠体宽度**合并** ⇒ 旧 `onlyFull.length = 3` 数轴实测掉到 **1**，若只改数字 = 假绿。新识别子 = 「直方图最窄 4 档 + 枚数分解（外沿枚数 = 已填 26 + 空格 39 = 65）」+ 阳性对照（第 5 档 418 > 凹槽档）⇒ 判别力强于旧口径。
  - `tests/bead-cell-standard.test.ts`：J3 锚点串 `/豆坑恒小于珠体/` → `/坑外沿与珠面轮廓对齐/`。
- **文档面（同批）**：`art/cell-standard.md` 新增 **v1.0-r8** 批注（六条：删框 / 内阴影 / 外沿对齐 / S3 墨 / 托盘分叉 / seal 欠账）+ **J3 行口径改写**；两分册（`cell-standard-holed` 21.8→**26**、`cell-standard-holeless` 19.8→**24**）各增内阴影行与 S3 墨行；`bead-visual-style-spec.md` B14 空槽对齐句追加 r8 取代注 + 空格命令账 5→7 + 凹槽 ASCII 图改内阴影 4 层。
- **验证（本会话实跑）**：`npx vitest run`（beads）= **730 passed / 6 failed (736)**；6 红 = **本批 seal 腿 4a/4b**（整帧层流 `rect 491 → 695`、sha 变）+ 关卡存量 4（`levels` / `misplaced-assembler` / `level-import` / `levels-dir-pipeline`，非本批、不代翻）。`bead-render` 34/34、`bead-cell-standard`、`bead-style-settings` 全绿。
- **⛔ 欠账（诚实登记）**：① **seal 腿 4a/4b 需第六次复评登记**（属视觉变更 ⇒ 封箱门按设计拦截；⛔ 禁自更新 fixture，K-051/K-053，须走 §K.5.1 复评归因通道）；② **纪律 #1 改前/改后对照图待补**（承前批余项，本批仍无出图）；③ `cocos/assets/scripts/**` 镜像待 `framework:sync`。
- **诚实边界**：内阴影是**实色阶梯**（层集无渐变图元），非真渐变；`base·d` 乘法本质 ⇒ **暗端退化未解决**（纯黑格 CR 仍 1.00，换载体不修）。未 commit / 未 push。

### r2 批（同日二轮 · 用户「槽的内阴影和孔的内阴影都是 tint 烘焙上纹理使用的」⇒ 零代码 + 三处登记）

- **槽侧：结论 = 已满足，无需改码**。内阴影落在 `drawEmptySocket` ⇒ DEC-4 同源纪律（`bake-recipes.ts::makeCellRecipe` 直接调它）⇒ cell mask **自动带这圈阴影**（每层 = d 通道一级灰阶）。仅补登记：`bead-visual-style-spec` §13 逐项分配表 + 表头读数适用面各加一句「空格凹坑（含内阴影）属 **cell mask**，孔底 `pit`/`targetColorIdx` 仍 live」。
- **孔侧：用户裁 **D = 不做**（维持现状：只有孔边线）。取证事实：现役 `facet-4` **无孔内壁阴影层**；`holeShadeOffset 0.22 / holeShadeAlpha 0.3` 只被退役对照臂 `legacy-ten` 消费，且是**真 α 0.3 + 恒定墨** ⇒ 进不了 ADR-0028 §2.1 的 d/l 双通道（探针判据钉 `[alpha-layers] bead=0`）。若要真做 = 新增实色阶梯层 ⇒ `facet-4` 已 **7 命令 = C7 上限、余量 0** ⇒ 触 **C11（门禁即报）**。**本批零代码 ⇒ C7 未被触碰**。
- **⚠ 自纠（登记防复发）**：本会话上一轮把 ADR-0028 §5 执行态 r9 段的「B15 口径：孔族墨 `mix(base,−0.58)` **不入 mask**、拆为 live 层 A/B 两路同源重放」**误读为归属裁定**，并据此向用户呈报了「孔不入 mask」——实际该句是探针为对比两路差异的 **A/B 整备口径**，归属正本 = `bead-visual-style-spec` **B15**（孔边线**入 mask**、`pit` 仍 live）。已在 ADR-0028 该句就地加 ⛔ 口径澄清注（含「勿据此认为孔不入 mask」与本自纠留痕）。
- **验证态（本轮）**：零代码 ⇒ 未重跑全量（上轮 beads 730/736 态不变）；`check:tasks` / `check:links` 绿。未 commit / 未 push。

### r3 批（同日三轮 · 纪律 #1 对照图，销本批欠账）

- **产物**（`temp/wxg-t-223/`，不入库）：`socket-ab.svg`（改前/改后并排，恒等档格径 32dp、目标色奶白 `#FDF6E9`、12 px/dp、同帧同源）+ `account.txt`（圆角修正面积账）+ `after-commands.json`（改后命令直读）+ `old-code-snippet.txt`（改前旧码出处 = git HEAD `bead-render.ts` 700–790 行 + `tuning.ts` 115–135 行）。
- **取证方式**：**改后 = 现役 `drawEmptySocket` 命令直读**（实测 `rect 26/24/22/20`、`r = 8/7/6/5`、墨 `#33312F`/`#514F4B`/`#6A6762`/`#8E8A82`，S3 在 `y = 208.8`（上）/ S4 `191.2`（下）⇒ 方向仍为「上暗下亮」）；**改前 = 按 HEAD 旧码公式复现**（`relief 0.07` / `pitInset 0.06` / S1 stroke 1dp）⇒ ⛔ **不是 git 隔离副本直读**，已写进图注与文档（防后人当逐字节证据用）。
- **面积账（`A(w,r) = w² − (4−π)r²`，格径² = 1024）**：坑总 **449.00 → 621.06**（占格 **43.85% → 60.65%**，+172.06）；中心坑底 **346.57 → 378.54**；旧 S1 单框环 **31.58** ⇒ 新 3 层递减环 **87.12 / 80.84 / 74.56**（合计 242.52）。
- **⚠ 归因分清（关键，勿混读）**：坑"变大"来自 **裁定③（外沿对齐，`relief` 退 0，每边 +2.1 dp）**，**不是**内阴影造成的；内阴影只占 3 dp 带宽。真实视觉差 = **坑整体放大 + 旧「1 dp 暗框」由「3 层递减实色环」取代**。
- **执行细节**：用临时 vitest spec（`tests/_tmp223-compare.test.ts`）作 TS 执行器取现役命令，**跑完即删**（`git status` 复核：tests 下只剩本批三个正式改动文件）；零新增依赖（未引入 node-canvas / playwright，与 WXG-T-221 二裁一致）。
- **登记**：`art/cell-standard.md` r8 执行态段（含产物路径 + 读数 + 诚实边界）+ 主表 T-223 行欠账销项。仍未 commit。

### r4 批（孔中心真透 + 孔口 d 渐变内阴影 · 甲案探针 = 浏览器通道实证 PASS）

- **命题**：tint 制下「孔中心无底色（真透）+ 孔口一圈内阴影」能否成立（用户点名甲案）。
- **做法**：新建 `temp/tint-probe/hole-shade-ab.mjs`（⛔ **不改 `run.mjs`**，保 r9 可复现）；三列对照 A=现状（孔 live）/ B=甲案（孔中心 `destination-out` 抠 α=0 + 孔口径向渐变 `d 0.42→1.0`，宽 3dp=12 texel）/ C=对照（孔中心填 `pit` 有底色），下层预铺 B0 目标色。浏览器真 Canvas2D 出像素（playwright）。
- **结果（五色 c1/2/5/8/10 全过）**：**① 孔中心 αmax = 0 ⇒ 真透成立**；**② D 图环带灰 138→162→187→211→236（跨度 98、单调）⇒ 真渐变成立**（⛔ 非实色阶梯）；**③ 五色 D 图逐值全等 ⇒ mask 仍色无关**。
- **⚠ 暗端退化依旧（与前判互证）**：合成后环带对比随 base 缩放 —— 近黑 `#33333D` 仅 23→47（跨度 24/255），近白 `#FDF6E9` 为 112→234 ⇒ **换 mask 载体不修暗端**。
- **三个坑（自纠）**：① 首版判据 `v ≥ prev−1` 对全等也 PASS = **假绿**（当时渐变其实没画上）⇒ 判据须带**跨度门**，单调性单独无判别力；② **`arc(x,y,r,0,7)` 的 7 rad > 一整圈 ⇒ 双弧环带 winding 被绕乱 ⇒ 填充区为空**（渐变"没画上"真因，改 `0,Math.PI*2` 即通）；③ `mono` 写成 `v ≥ v[i−1]`（取元素而非数组）⇒ 恒 false。
- **判据设计教训**：合成后像素随 base 缩放 ⇒ **判据取色无关的 D 图**，拿合成值判近黑色会因绝对跨度塌陷而假红。
- **⚠ 环境发现**：根 `node_modules` 无 `@wxgame/framework` ⇒ **`run.mjs` 现无法直接 `node` 跑（r9 复现路径在当前环境已断）**。本轮用 `--import` + resolve hook（`temp/tint-probe/loader.mjs`）映射 bare specifier → `dev/harness/dist/packages/framework/src/index.js` 绕过；后续复现照此，或补 workspace 链接。
- **边界**：浏览器 Canvas2D；wx 侧 `destination-in`/multiply/screen 未验（T2'）；孔中心透出的是 B0 目标色（≠ 现设计 `pit`）⇒ 孔辨识全靠该环，强度需 A/B。产物 `temp/tint-probe/hole-shade-ab.{html,png}`。未 commit。
### r9 批（预览工具链固化：temp/tint-mask-export → tools/mask-preview/）

- **用户指令**：固化预览三件套（`capture-layers.mjs` 捕获层集 / `preview-app.py` Streamlit 预览 / `layers.json` 中间产物），并对齐 tint-probe 终口径（V4 修正版 + r8 槽内阴影）。
- **落点**：`tools/mask-preview/`（repo 根 tools 下，不在 `games/` 内 ⇒ 不入 cocos 同步扫描域；目录深度与原 temp 版相同 ⇒ 路径逻辑零改动）。超点名收编 `loader.mjs`/`reg.mjs`（resolve hook：根 node_modules 无 `@wxgame/framework`，不收编则 capture 不可直跑——同 r9 复现断裂根因）。
- **对齐修复（capture-layers.mjs）**：① 墨档字典漏 `−0.58/−0.68/−0.80` ⇒ **槽内阴影 4 层在预览 mask 里 3 层塌成 d=1**（旧 layers.json 实证）⇒ 已补，重跑后 cell 7 层 d/l 全对（tile 0.70 = B0 `edge` 档 + 内阴影 0.20/0.32/0.42/0.56 + S3 0.42 + S4 l0.38）；② `line` 类整类丢弃（S3/S4 明暗线预览缺失）⇒ 已收编绘制；③ palette 补 `slot`；④ `captureBead` 不传 `hideHole`（孔几何进 JSON，预览按 B15 跳过 = 孔 live）。
- **对齐修复（preview-app.py）**：① B15：bead 侧跳过全部 circle；② `draw_layer` 支持 line；③ **mask 写入双翻转 bug**（d 路径多一次垂直翻转、l 路径不翻 ⇒ 两路坐标系不一致）统一为图像坐标直写；④ blend 后叠孔底 `pit`（对齐 tint-probe 收尾，孔 live）；⑤ 默认参数 = V4 修正版（0.56/0.42/0.70、lmax 1.0、环 4 texel = 2 本仓 dp、掩膜 0.55/0.85、conic 0=右顺时针四方向定标）。numpy 向量化重写逐像素循环。
- **未决（登记）**：conic 亮侧方向（现 = 上/左亮）与槽 TC-SKT-01「暗上亮下」相反 ⇒ 三口径（A 物理一致 / B 维持 / C 无方向）待用户拍板，预览按现口径固化、改 stops 即切。streamlit 实跑未验证（py_compile 已过）。
- temp/tint-mask-export 原目录保留（v1–v3 迭代与 PNG 供追溯，不入库）。未 commit。

### r9+ 批（有孔 tint mask 烘焙纹理定稿 v1.0）

- **定稿**：`tools/mask-preview/export-cocos-textures.py` 头部冻结口径块（v1.0，2026-09-29）——本轮 Cocos 探针迭代收敛的烘焙逻辑冻结为有孔档正式标准，⛔ 改参数须登记。
- **口径**：珠（26dp/角 8、真透 ⌀12、B14 环 1dp −0.58、外框 1dp、plate 0.56、lit 0.38、余弦光照）；格（30dp、槽口 24dp=珠面轮廓内缩 1dp 防漏、3dp 斜面背光上+左+右 0.32/受光下 0.70+lit、坑底 0.32=−0.68、格外 0.70、facet-4 同构光照）；编码 R=d/G=l/B=形状、A=255 免疫 Trim、512→LANCZOS×4→128。
- **验收轨迹**：混色 → 槽口=珠面轮廓 → 3dp 深度+光照 → 缩 1dp 防漏 → 坑底两档加深 → 三边同暗+下边光照；每步 1024 合并预览目视通过。
- 正式管线移植：照抄脚本公式（纯 numpy 确定性）。未 commit。

### r9+ 批 B（WXG-T-222：beads-studio 导出 tint 资源）

- **用户指令**：以定稿效果（截图四象限：有孔/无孔 × 珠/格）为准，studio 增加导出 tint 资源功能，选项「四向刻面 × 有孔/无孔」，导出四个纹理可下载。
- **领号**：WXG-T-222（TASKS.md 头注明示下一可用号 = 222）。
- **落码（apps/beads-studio）**：
  - `server.mjs` +`GET /api/tint-export?mode=holed|holeless`：**服务端子进程跑定稿烘焙脚本** `tools/mask-preview/export-cocos-textures{,-holeless}.py`（单一真源零移植——烘焙逻辑不搬 JS，杜绝与定稿 py 双实现漂移），读 cocos-assets 四张 PNG 回 base64；本地仓守卫同 bake（无 games/ ⇒ 501）。
  - `public/tint-export.js`（新）：选档 → fetch → 逐张触发浏览器下载（300ms 间隔防拦截）。
  - `public/index.html`：详情面板加档位 select（有孔/无孔）+ 导出按钮 + status。
- **关键设计点**：tint mask **色无关**（一张 mask × 运行时 tint 色，ADR-0028）⇒ 无逐色导出，与 bake-manifest（T-221 逐色位图）正交。
- **诚实边界**：① 服务端依赖 python3+numpy+pillow（本地满足；容器/VPS 无仓资源 ⇒ 501 同 bake 守卫，失败时 stderr 回显）；② 烘焙脚本跑一次覆盖 cocos-assets（定稿参数幂等，无害）；③ 领号前已核主表/详情/工作树无 222 引用。
- **验证**：测试实例（PORT=8799）两档端点实测各回 4 文件名正确、非法 mode 400 ✓。未 commit。
- **追加（同批）：tint 实时预览**。面板加 tint 色 picker + 珠/格双预览 canvas：选档拉四件套（服务端一次，按档缓存）→ 本地 Canvas 按 **shader 同款公式**逐像素合成（`rgb=c·d+(1−c)·l, a=形状`，mask 编码 R=d/G=l/B=形状同源）→ 改色即时重算零请求；导出复用缓存 dataUrl 免二次烘焙。**像素级验证**（playwright 类 eval 抽样）：孔中心 alpha=0 真透、坑底=色×0.32 逐位精确、格外=×0.70 精确、plate+lit 区三元公式吻合、无孔档中心实心 alpha=255 ✓；改色/切档实测即时生效（注：手动 dispatchEvent 须 bubbles:true，原生交互不受影响）。
- **追加 2（同批）：版面按 tint 档位渲染**。用户报版面未跟随 tint 档位 ⇒ `board-render.js` drawBoard 加 `opts.tint` 分支（珠格=bead sprite×珠色、空槽=grid sprite×目标色、locked 恒旧画法、sprite 未就绪逐格回退旧画法）；`tint-export.js` 暴露 `TintBoard.current()` 按色 sprite 工厂（per 档×色缓存）；档位 change 派发 `tint-change` ⇒ 棋盘自动重绘。浏览器实测有孔（孔透背景）/无孔（实心刻面）版面即时跟随 ✓。
- **追加 3（用户纠偏「布局都不能变，变的只是豆子样式」）**：首版 sprite 30dp 画布满格画 ⇒ 珠面占 80% 布局观感变了。修正：bead sprite 裁珠面窗口（26/24dp）画到旧珠体矩形（内缩 4/30）+ 珠格补垫（满格 mix(target,−0.30)）+ 空槽 grid 满幅 ⇒ **布局与旧版逐像素一致、仅豆子样式切换**。实测两档布局一致 ✓。
- **追加 4（垫环翻倍根因）**：珠体 inset 误用 board-render 旧快照 `BEAD_INSET_RATIO 4/30`（珠体 0.733 格）⇒ 与定稿珠面 26dp（0.867 格）冲突、垫环翻倍珠缩水。修正：inset = `(30−faceDp)/2/30`（TintBoard.faceDp 提供，有孔 2/30、无孔 3/30）。实测珠满占比、观感=定稿 ✓（board-render 与游戏的既存漂移见其头注，tint 路径以定稿口径为准）。
- **追加 5（空位不画格图）**：tint 分支空格仅当有目标色（盘面内待填槽）画 grid sprite；空位（'.'）不画露背景（与旧画法语义一致）。实测图案外干净 ✓。
- **追加 6（终式，用户拍板）**：版面渲染定式 = **合成图纹理填充**——盘面内格先铺「格图合成」（grid base+mask × 格色），有豆叠「拼豆合成」（bead base+mask × 珠色）；空位不画；平色垫退役。与运行时渲染结构同构（B0 格底 + 珠）。
- **甲/丙终调（同日）**：甲 D1（暗底 pit + 偏置环 2dp）左上壁 142 / Δ83 / 合成最暗 154；**丙 D2（conic，角度收窄 ±36° + LMAX 0.85）左上壁 142 / Δ94 / 合成最暗 106 ⇒ 深度与方向双超甲**；D3（3dp 同参）Δ90、暗壁更厚。宽度 2dp/3dp 两档均已出图（mask 侧纯几何，不受 C7 约束）；⚠ 2dp 在 dpr1 仅 0.5 物理 px ⇒ 建议 3dp 起步或加 dp 地板，真机 A/B。
- **验证态（r9）**：beads 全量 732/4（seal 0 红）/ tsc 0 错 / `check:links` / `check:tasks` 绿（终跑见收口段）；⛔ 未 commit / 未 push。

## WXG-T-224 · ctx hot-files 收录瘦身（test-cases 锚点摘要只留高频节）

> **状态**：🔄 立项待裁（主理人 2026-09-29 立项，交 quality-lead 裁定）
> **领号**：224（领号前已核：主表最大 223、工作树全局 grep 无 224 引用；K-046）

### 背景与实测依据（2026-09-29）

- 常驻总量观察哨：**14669 > 软阈值 13500**（不阻断）；`ctx/hot-files.md` **5062 / 上限 5150**（逼近）。
- **原瘦身对象已核销**：`context-index.mjs` 里 T-211 注记让「下次涨前先做 ux-spec/S9 版本链注记归并」——经复核：
  - `games/beads/design/ux/ux-spec.md` **不在 hot-files 收录**（现收 18 文件）；
  - 已在 `ctx/budget-exempt.json` 登记 B 项豁免（18657 tok，走章节锚点局部读）；
  ⇒ **瘦它对常驻开销零收益**。注记已就地订正（原注按 K-053 留痕不删）。
- **真实体积主体 = `production/qa/beads/test-cases.md` 的章节锚点摘要**（hot-files 内）：§A +261 / §K +184 / §I +106 / §G +111 / §A4c +68 / §G.4 +33 / §J +40 等；该文件本身已豁免 B 项（WXG-T-084）。

### 待裁项（交 quality-lead）

1. **裁哪些节**：高频节（如 §A 硬判据 / §G 可感知 / §K 风格族）保留，低频/一次性取证节（如 §A.0/§A.0b 回填表、§G.4/§G.5 复验回填、§H.4）是否移出 hot-files（仍可在 `ctx/index.json` 查到，机器读更划算）；
2. **判据可达性保全**：QA 逐条局部读依赖这些 offset/limit 锚点 ⇒ 移出后是否造成「找不到锚点就整读」的退化（这正是 B 项存在的原初理由）；
3. **替代路径**：降 hot-files 收录门槛由生成器自动裁撤低优先文件（无需手改锚点集合）vs 手裁节；
4. **或不裁**：接受常驻超软阈值（观察哨不阻断），只保留注记与监控。


### 裁定（quality-lead·严守真，2026-09-29 回传）：**CONCERNS** + 方案④

- **门禁**：A/B/C/D/D2/E3 全绿（hot-files 5062/5150）；G1–G4 不适用（零代码）。给 CONCERNS 两因：① A 项硬门**余量仅 88 tok（1.7%）**＝真红线；② 发现 **P1 索引缺陷**。终裁属编排者。
- **事实纠正（重要）**：主理人 brief 里「§A +261 / §K +184」是 test-cases **内部行数**，非 hot-files 成本。实测锚点条目成本：§A **23 tok** / §G **27** / §K **81**；整个 test-cases 块 = **1412 tok（占 hot-files 27.9%）**——**成本由锚点文字长度决定，与节体量无关**。
- **方案裁定**：
  - ① 裁节（brief 候选名单）→ **不推荐**：仅省 178 tok，但 §A.0/§G.4/§G.5/§I.2 的父节体量 9.5k–15.7k ⇒ 裁后只能读父节，**单次膨胀 9–15k 突破 B 项 8000**（正面撞 B 项原初理由），ROI 为负；且需新增节级手工名单机制＝新维护债。
  - ② 降收录门槛 → **机械不可能**：18 个收录中 `tier:hot` 必收 6 个（2478 tok）+ ROUTES 强制收录 12 个（2275）⇒ **可选池 = 0 文件**。test-cases 属 tier:hot ⇒ 本方案对它完全无效。（T-211 注记「门槛不可再降」应订正为「可选池已空」。）
  - ③ 接受不裁 → **不作终态**：A 项余量 88，test-cases 再增任一节即 FAIL；T-214/221 自设红线「第四次顶上限不被允许」。
  - ④ **推荐：规则化节级裁剪 + P1 修复**。**规则 R** = 只收 L1+L2；例外保留 L3 当且仅当（a）被 ROUTES 以 `文件#锚点` 引用，或（b）**父节 > 8000 tok（复用 B 项既有常量）**。实测模拟（51 条 L3 被裁）：hot-files 5062→**≈4034**、余量 88→**≈1116（21.6%）**、常驻总量 14669→**≈13641（超阈值收窄 88%）**、被裁条目父节中位 1534/最坏 7786（均 ≤8000）。**阈值一律未上调**。
  - **核心风险回答（不会退化成整读）**：被裁 L3 的父节（L2）仍在 hot-files ⇒ 第二跳闭环不破；由构造保证父节 ≤8000 ⇒ 最坏退化被 B 项不变量兜住；被裁 L3 在 `ctx/index.json` 仍可查；ROUTES 引用的 10 个锚点与 systems-index §3 全族（父节 17521）由例外保留（否则 15× 读放大）。
- **缺陷（落码清单）**：
  - **[P1]** `test-cases.md` L614 `## 变更记录`、L638 `## J · v2.0…` 实为顶层节却写 `##` ⇒ 被 index 嵌到 §I 下 ⇒ **§I 区间 572–677（11064 tok）误吞变更记录与整个 §J**，真实内容只到 613（≈2000）⇒ **每次协议读多 ~9000 tok**。修：升为 `#`/`##`；`### H.4` 同步升 `##`。
  - **[P2]** `ctx/index.json` 实测 2.23MB / ≈588,617 tok，而注释与 D2 文案仍写「≈195k、机器读更划算」⇒ 该说法已不成立，应改显式 grep/jq 配方。
  - **[P3]** T-211 注记表述订正（可选池已空）；`### H.4` 级别升。
- **执行顺序建议**：先落 **P1**（零体积代价、单次省 ~9k，比任何裁节收益都大），再落**规则 R**；两者互不依赖。规则 R = 生成器纯函数过滤，不删正文/不动判据值，回滚 = 去 filter 重 build。
- **拆 test-cases.md 另立单**（挂 WXG-T-084 撤销条件）：诚实说明拆分**不减** hot-files 体积（锚点文字守恒 + 每新文件多 ≈20 tok 表头），真价值 = 撤销 B 项豁免、消 69k 整读悬崖、让它脱离 tier:hot 重获生成器自调节。
- **收益精度**：规则 R 收益为估算 ±10%，落码后以 `ctx:check` 实测为准。常驻总量届时仍 +141 超软阈值（不阻断，不建议调 `residentTotalSoft`）。

### 边界（⛔）

- 装置侧**不得擅自裁** test-cases 锚点（动 QA 判据可达性）；
- 只动 hot-files 收录集合/生成器门槛，**不改判据值、不改 test-cases.md 正文**（K-051/K-053）；
- 裁定后如改生成器门槛，须与门禁共用常量（`LIMITS.hotFilesMaxTokens`）同步评估。

### WXG-T-224 · 执行结果（P1 + 规则 R 已落码，2026-09-29）

- **P1 已落**（`production/qa/beads/test-cases.md` 标题级别 6 处：`### H.4`→`##`、`## 变更记录`→`#`、`## J · v2.0`→`# §J · v2.0`、`### J.1/.2/.3`→`##`）：实测 **§I 区间 572–677 → 572–613（11064 → 2260 tok）** ✅；§变更记录（614–637, 7226）/ §J（638–677, 1534）各自 L1 独立；§H.4 → L2。单次按锚点读 §I **省 ≈8800 tok**。
  - ⚠ **副作用**：新增 3 个独立节锚点条目 ⇒ hot-files 5062→**5220 > 5150（A 项 FAIL）**——成本由锚点文字决定、与节体量无关（quality-lead 纠正过的事实）。
- **规则 R 已落**（`tools/scripts/lib/context-index.mjs`）：新增 `routesReferencedAnchors()`（锚点级）+ `parentTokens()`；`renderHotFileBlock` 节级过滤 `keep = level≤2 ∨ ROUTES#锚点 ∨ 父节 > LIMITS.fileMax(8000，复用 B 项既有常量，非新造)`。纯函数过滤，不删正文/不动判据值，回滚 = 去 filter。
- **实测（--working-tree）**：`ctx/hot-files.md` **5150 / 5150 ✅**、**D2 第二跳覆盖率 18/18 = 100%**（无退化）、`ctx:check OK` 全门绿。
- **与 quality-lead 预估的差异（如实登记）**：预估 4034 未出现——生成器**前缀扫描会填满预算** ⇒ 节变少后**收录文件 18 → 25**，收益体现为**覆盖更广 + 单块更精确**而非体积下降。⚠ 后果：**A 项余量 = 0**，下一批任何新增节/文件即 FAIL ⇒ 后续新增须同步评估（红线：阈值一律未上调，T-214/221 自设「第四次顶上限不被允许」）。
- **未执行（挂账）**：P2（index.json 体积描述失真 2.23MB/≈588k tok，注释与 D2 文案仍写 ≈195k）、P3（T-211 注记订正为「可选池已空」）、拆 test-cases.md 另立单（挂 WXG-T-084 撤销条件）。

## WXG-T-225 · 拆 `production/qa/beads/test-cases.md` 判据分片（撤销 WXG-T-084 的 B 项豁免）

> **状态**：🔄 立项待裁（2026-09-29 立；来源 = WXG-T-224 的 quality-lead 裁定移交项）
> **领号**：225（核：仅出现在主表头注「下一可用号」，无任务占用；K-046）

### 背景

- `production/qa/beads/test-cases.md` 现 **860 行 / 69479 tok**，靠 B 项豁免（WXG-T-084）苟住 ⇒ 一旦误整读即 **69k 上下文悬崖**。
- 它是 `tier:hot`（必收 6 件之一）⇒ WXG-T-224 的「降收录门槛」方案对它无效（可选池 = 0，Q 已证伪）。

### 价值（quality-lead 原话）

1. **撤销 B 项豁免**、消掉 69k 整读悬崖；
2. 让它**脱离 `tier:hot` 必收集**，重获生成器自调节能力（被裁撤的可能）。

⛔ **诚实边界**：**拆分不减 `ctx/hot-files.md` 体积**——锚点文字守恒，且每新增一个文件多约 20 tok 表头。
⇒ **它不是 WXG-T-224 的瘦身手段**，两单收益不得混计、不得双计证据（K-046 注 10 同型）。

### 待裁项（交 quality-lead）

1. **拆法**：按 §A–§K 章节族拆（判据族正交）vs 按系统域（S1–S9）拆 vs 只拆「回填/取证类」（§A.0、§A.0b、§G.4、§G.5、§I.2、§变更记录、§J）——注意裁 L3 的父节体量风险（WXG-T-224 已证：父节 9–15k 会撞 B 项）；
2. **文件名与锚点兼容**：`ctx/ROUTES.md` 与 `ctx/index.json` 的引用面同步更新；D2 覆盖率须保持 ≥90%；
3. **豁免撤销条件**：拆到每片 ≤8000 tok 后才可申请撤销 WXG-T-084 豁免；
4. **`g4-regression-report.md` / `playtest-plan.md` 等相关引用面**是否同步处理。

### 边界（⛔）

- 只做文档拆分与引用面同步，**不改判据值、不改判据语义**（K-051/K-053：禁自更新 fixture、禁静默删旧文案）；
- 拆分方案须由 quality-lead 裁定，装置侧不擅自动 QA 判据文档结构。

### WXG-T-226/227/228 · 豆面格面正式管线（三专家并行，2026-09-29 回传）

> 触发：主理人「根据最新盘面设计，指定专家实现最新豆面和格面」；按 `wxgame-orchestration` 诊断 = **阶段 5（制作）**，路由三成员并行 spawn。

**程基岩（226）** — 方案落盘 `production/plans/wxg-t-226-tint-pipeline-plan.md`（522 行 / 14 节 / EP-12 八 Story + 提议 ADR-0029）。三条决定性工程事实：
① **Cocos 侧目前没有纹理载体**（`Graphics` 不能画 image、`blit` 在 Cocos 静默跳过）⇒ tint 在生产通道尚未成立，推荐整盘单图元 + 自定义 effect（+1 draw call / +2 三角）；
② **Canvas2D 两路合成走不通**（`drawImage` 只吃 RGB，`l` 在 G 通道取不到）⇒ 务实解 CPU 预合成 + LRU(12)，该侧不享内存消解收益；
③ mask 生成**不是改 recipe 返回类型**，须新增 `MaskSpec`（纯数据）+ 场计算（core 纯数学）+ adapter 落盘三层。
包体实测：4 mask 18.8KB + 4 base 6.2KB = **25.0KB = 主包 0.61%**；⛔ `control-manifest §19` + ADR-0027 §5-2 两道前置未解除 ⇒ 现在不得投放。

**林绘澄（227）** — 资产规格 `games/beads/art/tint-mask-asset-spec.md`（352 行）。可访问性：二重编码仍成立但被区域压缩（珠面明度档 8→6；holeless 空槽 5 档/坑底 4 档 ⇒ 小豆档欠账加重）；**发现最高优先 D1**。

**严守真（228）** — 判据分册 `production/qa/beads/wxg-t-228-tint-criteria.md`。质量门裁定 **CONCERNS**：G1–G3 未执行（零落码 ⇒ 待执行预期红基线）、**G4 未过**（判据族未可执行 + D1 使 V-3 必红 + C7/C12 未裁 + R-9 未裁）。判据映射 TC-TINT-01…22（L.1 编码不变式 11 / L.2 静态等价 2 / L.3 运行时门禁 9）。

**★ 三方收敛的最高优先事项：D1 mask 编码落盘渗漏**
- 机理（`export-cocos-textures.py::render_mask` L139-148）：`dv>=1 and lv<=0` 层整层 `continue`、且 `dv>=1` 不写 R ⇒ 上扇实落 `(0.56, 0.38)`（应 `(1, 0.38)`）、左扇 `(0.56, 0)`（应 `(1,0)`）⇒ **珠面零纯本色像素**，与 `ADR-0028 §2.1` 自列层系数正面矛盾。
- 影响：T1'/V-3 静态等价**修复前不可能过**；C12-t 因 `plate 0.56 ≡ pit` 对其**结构性失明**（仍判过）⇒ 只能由 TC-TINT-09/19 拦。
- ⚠ 主理人复核补充：修成 `d=1` 会使上/左扇**变亮**（与矢量臂等价），但会改变 studio 已认可的观感 ⇒ **属观感裁定，不得由装置侧擅定**。

**待裁定（用户拍板）**：① D1 判缺陷并修（上扇变亮）vs 维持定稿观感另立等价口径；② Q1 Cocos 载体（整盘单图元 / Sprite 池 / 暂不接）；③ Q2 孔底（定稿 B0 tile 0.70 / 保留 live pit 0.44）；④ Q5 是否立 ADR-0029；⑤ R-9 AA fringe 分域；⑥ C7-b / C12-t 新值（QA 不自钉）。

---

## WXG-T-229

**beads tint mask：D1 编码渗漏修复 + 四扇/外框「甲」案改值落码（2026-09-29）**

**裁定链（用户逐轮看图拍板，⛔ 每改一处先出效果图、确认后才落码）**

1. **D1 先出图**：temp 沙箱复制定稿 py 两份（before/after），只改 `render_mask` ⇒ 对比图 `temp/tint-d1/ab-d1.png`
   （2 色：奶白/炭黑）。读数：上扇 (0.557,0.370)→(0.992,0.370)、左扇 (0.557,0)→(0.994,0)，
   珠面 d=1 面积 0→171.1 dp²，grid mask 前后差 **0.000000**（D1 只动 bead 分支）。
   ⇒ 用户判 **乙**（效果不对）：「奶白上**看不出光源方向**」。
2. **机理**：合成式 `out = c·d + (1−c)·l` ⇒ `l`（受光抬亮）在**亮色珠上数学无效**（c→1 时贡献→0，奶白 Δ≈4/255）；
   而层集应落值里 **上/左扇 d 同为 1（饱和）** ⇒ 亮色珠左上象限一整块平光 ⇒ 方向丢失。炭黑不受影响（上 0.504 vs 左 0.200）。
3. **候选三轮**（`ab-d1-variants.png` / `-variants2.png` / `-variants3.png`）：
   A=左扇 0.92｜B=右下加深（右 .78/下 .60）｜C=外围压暗加倍 ⇒ **C 实测无效**（四扇亮度几乎不变，只影响 1dp 环）；
   外框同因（V0/A+B 奶白外框 上 137.3 / 左 135.2 = 差 1.8，只有两档）⇒ 必须把外框 `d` 改按**四扇斜率**。
4. **用户拍板「甲」** = A+B + 框F1（外框 上 0.70/左 0.63/右 0.52/下 0.42，外缘 −0.10·t）。

**落码面（真源优先，⛔ 未改 `layers.json`——它是 capture 产物）**

| 文件 | 改动 |
|---|---|
| `games/beads/src/config/tuning.ts` | `FACET4_FACET_RIGHT_MIX` −0.16→**−0.22**；新增 `FACET4_FACET_LEFT_MIX −0.08`、`FACET4_FACET_BOTTOM_MIX −0.40` |
| `games/beads/src/view/bead-styles/facet-4.ts` | 左扇 `e.base`→`mix(base, LEFT_MIX)`；下扇 `e.edge`→`mix(base, BOTTOM_MIX)`；墨序注同步 |
| `tools/mask-preview/capture-layers.mjs` | coeffs 字典：`-0.30`（下扇）→ 两个新常量 + 右常量（否则新墨反解失败塌成 d=1） |
| `tools/mask-preview/export-cocos-textures.py` / `…-holeless.py` | ① `render_mask` R/G 无条件双写（D1）② `paint_frame_light` 改四扇斜率（框F1） |

**验证**：capture 两档重跑 ⇒ 四扇 **上 (1, 0.38) / 左 0.92 / 右 0.78 / 下 0.60** ✓；
正式四件套重烘 ⇒ 珠面四扇 0.992/0.914/0.759/0.591、奶白外框 上 147.5 / 左 130.0 / 右 101.4 / 下 81.1（跨度 66.5，单调 ✓）；
`tsc --noEmit` 0 错；终检图 `temp/tint-d1/final-ab.png`。

**红基线 11（⛔ 不自更新 fixture，交 QA 复评归因 K-051/K-053）**
`bead-render.test.ts` 2（墨序有序序列 lit→base→−0.16→edge ／ 底 rect 非主体色）·
`bead-style-ledger.test.ts` 4（§K.5 行 3/5/6/7 锚点钉旧墨序值）·
`bead-style-pool.test.ts` 2（TC-STY-09/10 C12 argmax）·
`bead-style-seal.test.ts` 3（腿 2 视觉变更必重封 + 腿 4a/4b 整帧两键）。
另 4 红 = 关卡存量（`levels` / `misplaced-assembler` / `levels-dir-pipeline` / `level-import`，非本单）。

**欠账（本批未做）**
① `assets-spec §7.11.1` 墨序表 + `cell-standard-{holed,holeless}` 同步新值；
② `accessibility.md` 复评（下扇 −0.30→−0.40 ⇒ 珠面明度可分档数需重算，左扇不再 = 本色平面）；
③ D5 头注漂移订正（坑底 0.32 vs 0.70 ×2、外框「−0.58 实色」vs 斜率）；
④ `games/beads/cocos/assets/textures/` 同步（该目录现 20 件全 `D`，来源待确认，D3）；
⑤ Q1（Cocos 载体）/ Q2（孔底）/ Q3（生成器真源）/ Q4（dpr 档位）/ Q5（ADR-0029）+ R-9 / C7-b / C12-t 仍待拍板。
⑥ **同批代补台账（用户 2026-09-29「下一批补登」）**：`check:tasks` 的既有欠账一并清——
补 `## WXG-T-224 / 225 / 226 / 227 / 228` 五节（⛔ 严格标题格式 `## WXG-T-0NN`，后缀会让解析器认不出）；
`WXG-T-225` 名称 67→32 字符（过 A 项）；`WXG-T-227` 行内 `` `bead|grid` `` / `` `holed|holeless` `` 的竖线致列数 7≠5 ⇒ 改全角 `／`。
五节写法 = **摘要 + 指针**（正文以各自交付正本为准，`production/plans/wxg-t-226-*.md` / `art/tint-mask-asset-spec.md` / `qa/beads/wxg-t-228-tint-criteria.md`），
并显式标注「由主理人（CodeBuddy）于 WXG-T-229 批次代补」，⛔ 不伪造原会话交付事实。
结果：`check:tasks` **PASS**（主表 40 行 / 详情 40 节配对完整），`ctx:check` OK。
### 红基线复评（严守真 · 2026-09-29 夜～09-30，QA 复评归因通道）

**背景**：本批落码后 beads 736 例 **15 红**（本批 11 + 关卡存量 4）。按 K-082「珠体族视觉改动 ⇒ 封箱对照腿必红是预期行为，唯一合法通道 = 复评归因（⛔ 禁自更新基准）」，变更方（CodeBuddy 会话）**未自更新任何 fixture**，全部交严守真复评。

**归因结论（11 条）**

| 组 | 条数 | 归因 | 处置 |
|---|---|---|---|
| `bead-render` 墨序有序序列 / 底 rect 非主体色 | 2 | 判据钉旧墨序（左=base、右=−0.16、下=edge） | 期望同步新真源 + 保住「四档互不相同 + 单调序」判别力 |
| `bead-style-ledger` §K.5 行 3 / 5 / 6 / 7 | 4 | 判据钉旧值；**行 5 语义脱钩**（下扇不再 = `endpoints.edge`） | 改指新承载体 + 标题与正文写清脱钩事实 |
| `bead-style-pool` TC-STY-09 / 10 | 2 | **C12 判别力退化**（非改数可解） | 见下「C12 退化登记」 |
| `bead-style-seal` 腿 2 | 1 | 本批视觉变更**预期红** | 重封 `s3.facetNonHoleLayers` 45/45 |
| `bead-style-seal` 腿 4a / 4b | 2 | **存量红 + 本批叠加** | 重封 `s3.frame0` / `s3.frame78` + 搭车补登记存量漂移 |

**封箱重封（第六次复评，键 `s3_frame_recheck_6`，QA 正本 = `test-cases.md K.5.1-补6`）**
- 前态锚 `8a32260^`（= 731100c）frame0 `1331/99f3bc76…` · frame78 `1409/f6cdff1a…`；现态锚 `8a32260` frame0 `1331/99f3bc76…`（**sha 全等 ⇒ 本批对空盘帧零贡献**）· frame78 `1409/69cf8800…`。
- 本批修订面 = `s3.facetNonHoleLayers` **45/45 重取**（四扇墨全变，几何零变）；**零追改** = `head.*` / `s3AtFormalization` / `head_liftShadowFade_r5` / `s3.facetHoleLayer`（45 例 0 差）/ `s3.legacyFlow`（96 例 0 差）/ `fixture.*`。
- 本批对整帧的贡献（流级差分，**未解释 0 条**）= frame78 **234 条 polygon 的 `fill`/`stroke` 两字段改写**（= 78 填格珠 × 3 扇〔左/右/下〕，上扇 `lit` 未动），**零插入 / 零删除 / 零几何改动**。
- **搭车补登记的存量漂移（非本批）** = frame0 `971→1331`（**+360**）、frame78 `1205→1409`（**+204**），来源 = `731100c`（用户 2026-09-28 裁定「槽内一周内阴影」把 `drawEmptySocket` 由「S2 坑底 rect + S1 暗缘框 rect」2 枚改为**内阴影阶梯 4 枚** ⇒ 每空槽 +2 rect）。两式独立吻合：`+360 = 2×(156 盘面空槽 + 24 托盘槽)`、`+204 = 2×(78 + 24)`。该批**未走复评通道** ⇒ 纪律缺陷开单 **WXG-T-230**。

**C12 退化登记（如实，不软化）**
- 甲案后**认定域（facet 族）内再无任何一层使用 `base`/`edge` 端点** ⇒ 参赛端点色由 3 枚降为 **1 枚（`lit`）**：argmax 由 `edge 25.2%` 变 `lit 25.0%`，`base` 占比 `24.7% → 0.0%`（最大偏离 `0.2pp → 25.0pp`）。
- `TC-STY-10` 臂 B 的「调小占优层 ⇒ argmax **让位**」在 1 枚参赛色下**结构上不可能** ⇒ 旧断言由反证退化为恒红。本轮改为断言两个仍可观测量（占优层**占比必降** 0.2499→0.0011 · `facetPx` 必降 8435→6334），两者同被「恒返写死值」的实现违反。
- ⛔ 弱读法口径（断言 = ∈ base 同族）**未放宽**，但**不再覆盖 argmax 跟随性** ⇒ 等价证明需工具侧新增「换墨反证」臂，列入 **WXG-T-230**。
- **主理人补的机械门（K-035：注释不是守卫）**：臂 B 内加一条「参赛端点色数 = 1」实算断言（数常门分布表中未标「非端点不参赛」的条目）⇒ 将来恢复 ≥2 枚时**本条必红**，强制回改「让位」强反证，不会静默停在弱档。

**复跑读数（如实）**
- `pnpm --filter @wxgame/beads run test`：**732/736 绿**，剩 **4 红 = 关卡存量**（`levels` / `misplaced-assembler` / `levels-dir-pipeline` / `level-import`，LEVELS 8 vs 9，**无专单**）。
- `tsc --noEmit`：**0 错**。本批 11 红**全部转绿**。


---

## WXG-T-224

**ctx·hot-files 收录瘦身（test-cases 锚点摘要只留高频节）** — 主理人 2026-09-29 立项，quality-lead（严守真）只读裁定。

> ⚠ **本行由主理人（CodeBuddy）于 WXG-T-229 批次代补**（原会话只占号未登详情节，`check:tasks` C 项拦）；
> 正文以各自交付件为准（本批无新事实，只做摘要 + 指针）。

- **起因**：常驻总量 14669 > 软阈值 13500、`ctx/hot-files.md` 5062/上限 5150。
- **关键纠正**：立项时的瘦身对象 `ux-spec.md` **已失效**（不进 hot-files 且已在 `ctx/budget-exempt.json` 豁免 B 项 ⇒ 瘦它零收益）；真实体积主体 = `production/qa/beads/test-cases.md` 的**锚点文字**（块 1412 tok = hot-files 27.9%；§A +261 / §K +184 / §I +106 / §G +111）。
- **裁定（严守真）**：CONCERNS + 方案④。裁节 ROI 为负（父节 9–15k 会突破 B 项）；降门槛机械不可能（可选池 = 0）；推荐**规则 R**（只收 L1/L2 + `ROUTES.md` 引用锚点，或父节 >8000 例外）。
- **P1 缺陷（同批发现）**：`test-cases.md` 标题级别错 ⇒ §I 区间误吞「变更记录」+ 整个 §J（11064 tok vs 真实 ~2000）⇒ 每次协议读多 ~9000 tok。
- **执行（用户选 A）**：P1 修 6 处标题级别 ⇒ §I 572–677→**572–613**（11064→2260）；规则 R 落码（`routesReferencedAnchors()` / `parentTokens()` + `renderHotFileBlock` 节级过滤）⇒ hot-files **5150/5150 ✅**、D2 100%、全门绿；收录文件 18→25。
- **遗留**：A 项余量归 0（下批新增即 FAIL）；P2/P3 挂账；拆单派生 ⇒ **WXG-T-225**。未 commit。

---

## WXG-T-225

**QA·拆 `production/qa/beads/test-cases.md` 判据分片（撤销 WXG-T-084 的 B 项豁免）** — 来源 = WXG-T-224 裁定移交，quality-lead 待裁。

> ⚠ 同 WXG-T-224：本行由主理人（CodeBuddy）于 WXG-T-229 批次代补（原会话只占号未登详情节）。

- **事实**：该件现 **69479 tok**，靠 B 项豁免（WXG-T-084）苟住 ⇒ **69k 整读悬崖**。
- **拆分价值**：① 撤销豁免、消整读风险 ② 脱离 `tier:hot` 必收 ⇒ 重获生成器自调节能力。
- ⛔ **拆分不减 `ctx/hot-files.md` 体积**（锚点文字守恒 + 每新文件多 ≈20 tok 表头）⇒ **它不是 WXG-T-224 的瘦身手段，不得混计收益**。
- **待裁**：拆法（按 §A–§K 族 / 按系统域）、文件名与锚点兼容、`g4-regression-report.md` 等引用面同步。

---

## WXG-T-226

**beads·豆面/格面正式管线落地（tint+mask 运行时渲染 + bake recipe 改产 d/l mask）** — 程基岩（engineering-lead），P0 关键路径。

> ⚠ 本行由主理人（CodeBuddy）于 WXG-T-229 批次代补；正文正本 = `production/plans/wxg-t-226-tint-pipeline-plan.md`（522 行 / 14.0k tok，EP-12 + ADR-0029 提议），下列为该件摘要。

- **范围**：把定稿 v1.1 / v1.0-holeless 接入正式管线——`drawFilledBead` / `drawEmptySocket` 走 tint 路径、`makeBeadRecipe` / `makeCellRecipe` 改产 **d/l mask**（非位图成品）、有孔/无孔双档位；⛔ 不得改定稿数值、不得动 `LIMITS`/判据。
- **三条工程事实**：① Cocos 侧**无纹理载体**（`Graphics` 不能画 image、`blit` 静默跳过）⇒ tint 生产通道未成立；② Canvas2D **两路合成不通**（`drawImage` 只吃 RGB）⇒ 需 tint+mask 而非叠加位图；③ mask 生成须 **spec + 场计算 + adapter** 三层。
- **结构要点**：B0 底图 tile **保留 rect**（mask 是格径 30dp 而 B0 是 pitch 32dp 满铺，`pitch − cell = 2dp` 缝无 mask 覆盖，且 §19 明禁运行时放大烘焙纹理）；孔真透 ⇒ 透出 B0 tile `edge`（−0.30），与 studio 定稿 v1.1 结构同构。
- **风险 R-1…R-12**：R-1 无载体（最高）· R-2 Sprite 池 draw call +N · R-3 孔底口径变化（K3 由 live `pit` −0.44 变 B0 `edge` −0.30，**不代拍** ⇒ Q2）· R-4 py/TS 双实现漂移 · R-5 判据不可执行（C7 命令门、C12 统计域在 tint 臂下失效）· R-6 包体守卫未归位 · R-7 dpr 无封顶 · R-8 风格覆盖 = 1 · R-9 AA fringe ΔE 11.3（T1' 本体未过）。
- **待裁 Q1–Q5**：Q1 载体（整盘单图元 / Sprite 池 / 暂不接）· Q2 孔底 · Q3 生成器真源（推荐丙·渐进）· Q4 dpr 档位 · Q5 是否立 ADR-0029（建议立）。
- **资产增量（实测）**：25.0 KB（mask 18.8 + base 6.2）= 主包红线 0.61%；**本单代码改动 0**（方案件，落码等批准）。

---


### Q1–Q5 拍板与 ADR-0029 落盘（2026-10-02，用户逐项裁决）

**裁决**：**Q1 ④**（本批只落命令层 + Canvas2D，Cocos 载体另批）· **Q2 ①**（接受定稿 v1.1：孔真透 ⇒ 透 B0 tile `edge` −0.30；托盘珠孔透明）· **Q3 ①**（丙·渐进：py 出图先入库可跑 → spec 化 → TS 场计算对拍绿后切源）· **Q4 ③**（zoom LOD 高倍段回矢量，⛔ 仍禁运行时放大）· **Q5 立 ADR**。

**落盘**：
- 新建 `docs/architecture/adr/ADR-0029-beads-tint-mask-pipeline-adoption.md`（**Accepted**）：DEC-1 载体（本批 = 命令层 + Canvas2D；⛔ 载体形态留待真机 T3'/T4'/显存数据再定，**不得无数据拍**）· DEC-2 孔底（定稿 v1.1；**矢量臂不变 ⇒ §3 冻结常量本次不动**，属渲染臂差异）· DEC-3 真源（丙·渐进，`mask:diff` 对拍绿前 TS 不得为唯一真源）· DEC-4 档位（128px 定档 + 高倍回矢量，阈值 `[待真机]` 不落数值）· DEC-5 白名单（未命中一律矢量回退，仅 facet-4）· DEC-6 编码沿用 ADR-0028 §2.1（不重开编码之争）。
- `control-manifest §19` 加**路线更新**指针：正本路线 = 灰度 mask tint（0028 编码 + 0029 接入）；0025／0027 两轨转历史归档；⛔ 八条纪律继续全部有效，「⛔ 运行时放大」由 DEC-4 的 zoom LOD 回退满足（⛔ 不以「显式豁免」绕过）。

**为什么 Q1 选 ④（推翻方案件原推荐 ① 的补充事实）**：2026-09-29 的 Cocos 探针已推翻「无载体」前提（`tint-mask.effect` + 4 张 128px 贴图 + `tint-probe.scene` 已接线），但**规模问题未解**：整盘单图元在 29×29 盘按 128px/格 = 3712² ≈ **55 MB 显存**（方案件未算此项）；Sprite 池 = **841 draw call**。而 T3'/T4' 本来就需要真机 ⇒ **无数据拍载体 = 违反 K-051 族**。

**本批开工序（EP-12，ADR-0029 §7）**：S1 `makeBeadRecipe`/`makeCellRecipe` 改产 d/l mask + `mask:diff` ✅本批 · S2 双臂注入 + 白名单 ✅ · S3 Canvas2D 合成通道 + harness 实验页 ✅ · S4 zoom LOD 回退机制（阈值可配、数值待真机）✅ · **S5 Cocos 生产载体 ⛔ 延后** · **S6 判据改写（C7-b / C12-t / K3 孔底文本）⛔ 交 QA**（WXG-T-230 / T-228）。

**⚠ 落码受阻记录（control-manifest §19 无法增补）**：曾尝试在 `control-manifest §19` 加「现行路线 = 灰度 mask tint」指针，但该文件实测 **7928 → 8008 tok**（B 项单文件上限 8000）⇒ 三次压缩后仍越线。**处置 = 不豁免、不硬塞**：§19 正文保持原样（仍写「正本 = ADR-0025／ADR-0027」，属历史轨表述），**路线指针改由 ADR-0029 头部「关联」字段承载**（已写明 `control-manifest §19`）。⛔ 若后续认为 §19 必须更新正本表述，须先按 WXG-T-073「拆单」路线瘦身该文件，不在本批硬改。

**登记的欠账**：① K3「孔底透出目标色」判据文本在 tint 臂下不逐字成立（透出的是 B0 tile `edge` 而非 `pit`）⇒ QA 改写；② 载体形态待真机数据；③ LOD 阈值 `[待真机]`；④ 192/256 档待真机测出可接受上限后再议。

### S1+S2 落码（程基岩，2026-10-02）

**范围**：只做 EP-12 **S1**（改产 d/l mask = spec 化 + 场计算 + `mask:diff` 对拍门禁）与 **S2**（双臂注入 + 白名单显式化）。⛔ S3/S4/S5/S6 未做。基线 `4227ffa`，⛔ 未 commit / 未 push。

**① 128px 核实（任务单点名先核处）**：`BAKE_CANONICAL_SIZE` **实值 = 128**（`games/beads/src/config/tuning.ts:271`；v1.57 由「珠体 26×2×2+pad ≈112」抬到「`BEAD_PITCH` 32 × dpr 2 × `ZOOM_MAX` 2.0 = 128」，112 只剩注释/旧测试里的历史字面量）⇒ **与定稿 py 的 `OUT = 128` 同值**，⛔ 无需对齐、未改 §3 冻结量。新立 `MASK_CANONICAL_SIZE = 128`，跨包单测钉住两者相等。

**② S1 落码**：`core/bake/mask-spec.ts`（新）＝定稿口径的 **spec 化载体**：两档 `MaskGaugeSpec`（holed v1.1＝珠 26/角 8/⌀12/孔边 1/羽化 0.5/槽口 12角 8/槽底 0.70/格外 0.70；holeless v1.0-holeless＝珠 24/角 7/无孔/槽口 11角 7/槽底 0.32/格外 0.70）、`MASK_SCHEMA_VERSION = 1`（EP12-S7 独立号，⛔ 不与 `BAKE_SCHEMA_VERSION` 合并）、外框四扇斜率（0.42+0.28×(1.0|0.75|0.35) ⇒ 0.70/0.63/0.52/0.42，外缘 −0.10·t）、`layers*.json` 的 `beadLayers` 内嵌快照。⛔ 未发明数值：逐字承 py 头注，层集逐字段取自 capture 产物。

**② S1 落码（续）**
- `core/bake/mask-field.ts`（新）＝纯数学场计算 → 已按 DEC-6 编码的交错 RGBA。**逐式复刻 PIL 12.x 位图语义**（`polygon_generic` 扫描线 + `ROUND_UP/DOWN`；`rounded_rectangle` 的 Python 层 `round()` + 4 段 90° `pieslice` + 竖带；`quarter/ellipse_state` 整数跨度状态机；`LANCZOS` support 3 + 系数归一化后量化 2²² + 横纵两遍）。
- `core/bake/bake-recipes.ts`：`makeBeadRecipe`/`makeCellRecipe` **加 `mode: 'mask'` 重载** ⇒ 返回 `(size?) => MaskField`（零绘制命令、忽略 `styleId`/`colorIdx` ⇒ V-1 mask 与色无关）。**默认仍是位图模式** ⇒ 旧调用方（`bake-export.js`）零破坏。
- `core/render/render-model.ts`：`BlitCommand` 增 `tint?: string` + `blit()` 第 6 参改**选项对象**（方案件 §3.3 选项 B；仓内仅 1 处调用，编译期捕获）。⛔ 无 `tint` ⇒ 字段不落 `JSON.stringify` ⇒ seal 基准零漂移。
- 工具：`tools/mask-preview/mask-diff.mjs`（对拍门禁）+ `lib/png-rgba.mjs`（零依赖 PNG 读入器，仅用 `node:zlib`）。

**③ S2 落码**
- `games/beads/src/view/bead-tint-mask.ts`（新）＝ **DEC-5 显式白名单**：`maskId = 白名单(kind, gauge, styleId)`，**当前只有 `facet-4`**，未命中 ⇒ `undefined` ⇒ 矢量回退。mask id **全部预建**（C2：每珠每帧零堆分配，⛔ 不用模板串拼 id）+ `typeof` 守卫挡原型链键（`'constructor'` 等）。
- `games/beads/src/view/bead-render.ts`：`setBeadTintRuntime`/`getBeadTintRuntime`/`createWhitelistBeadTintRuntime`（与既有 `_bakeRuntime` **并列同型**槽位，默认 `undefined` ＝ tint 臂不存在）。臂序 **① tint → ② 烘焙臂（代码一行未改）→ ③ 矢量臂**。命中 ⇒ 1 条 `blit(mask, tint = 本色)`，⛔ **不再画 live `pit` circle / 孔环**（DEC-2 孔区真透 ⇒ 透出 B0 tile 的 `edge` −0.30）。格面臂限**盘面格**（`beadInset > 0` 且有 `colorIdx`）⇒ 托盘空槽/锁定格恒矢量（§3.6）。新增 `FilledBeadOptions.maskGauge` + `drawEmptySocket` 末位 `options`：**不传 ⇒ tint 臂永不命中**（安全默认，矢量臂逐字节不变）。
- ⚠ **口径澄清（供复核）**：任务单把 `setBeadBakeRuntime` 写作「注入点已存在」，而该槽签名是 `getTextureId(styleId, colorIdx, bakeSize)`，与 DEC-5 要求的 `getMaskId(kind, gauge, styleId)` 不同型 ⇒ 我按**方案件 §3.2 与 ADR-0029 DEC-5** 在同文件**并列新增** tint 槽（同名同型同「未注入即不存在」语义），**未改**既有烘焙槽。**若主理人本意是复用同一槽，请裁**。

**④ 真实读数（本批实跑，非声称）**
- **`mask:diff` 逐字节一致**：四件套（bead/cell × holed/holeless）**R/G/B/A 全通道 mean = 0、max = 0、>1 量化步的像素 = 0/65536** —— 即 TS 场计算对定稿 py 产物**逐字节相等**，强于方案件 §4.3 的建议容差（mean ≤1/255、max ≤2/255，且该建议原文标注「落码前与 QA 对齐」，本批**未**与 QA 对齐，容差问题仍未闭）。编码不变式 I-1…I-8 全过（孔区洪泛 `B<250` 实测 **129.20 dp² ⇒ 等效 ⌀12.83dp**，落在判定带 [11.4, 13.2] 内）。⚠ 该面积比 T-227 `asset-spec §2.3 I-2` 报告的 **114.4 dp² / ⌀12.07dp 大 +14.8 dp²** —— 因 py 与 TS 产物**逐字节相等**，差异只可能来自**量测口径**（阈值/连通域边界取法），非 mask 本身；见未闭项 ③。
- **单测**：framework **383/383 绿**（36 文件，含新增 `mask-field` 24 + `mask-diff` 5）· beads **753 绿 / 1 skipped**（56 文件，含新增 `bead-tint-arm` 18）· **既有 beads 用例 735 绿 / 1 skipped 55 文件，与基线同结果**（V-5 绿线锚：`bead-style-seal`/`bead-render`/`bead-cell-standard` 零漂移）。
- **`pnpm -r run typecheck`** 0 错 · **`pnpm run verify`** = **PASS 18 / WARN 0 / SKIP 1（`check:size`，K-089 既有缺口未解除）/ FAIL 0** · `check:arch` OK（L2 无违规）· `check:es5spread` OK（110 文件无非数组展开）· `framework:sync` 已重生成 Cocos 副本（beads 写入 7 / breakout 写入 5）+ `framework:sync:check` 绿。

## WXG-T-227

**beads·tint mask 资产规格（入库/命名/包体预算/双档位）** — 林绘澄（art-director），P1。

> ⚠ 本行由主理人（CodeBuddy）于 WXG-T-229 批次代补；正文正本 = `games/beads/art/tint-mask-asset-spec.md`（352 行 / 9.4k tok）。
> ⚠ **本分册的 D1 已由 WXG-T-229 修复**（上/左扇实落 0.56 → 1.0），但其连带的 a11y/资产读数**尚未随修复重算**，见文末「待同步」。

- **编码与合成（唯一）**：`R = d / G = l / B = 形状 / A = 255`（A 恒满幅免疫 Trim）；`rgb = base·d + (1−base)·l`、`a = B/255`，**预乘 α**；tint 只吃颜色字符串，mask 侧零颜色（V-1 mask-stable 红线）；**逐层覆盖 = 双通道同写**（`d=1` 层须显式写 `R=255`）；未命中一律矢量回退。
- **不变式实测 I-1…I-9**：A=255 满幅 ×4 ✓ · 孔等效 ⌀12.07（理论 ⌀12 + 0.5dp 羽化）✓ · 槽底 holed 0.698 / holeless 0.318 ✓ · 格外 0.698/0.697 ✓ · 斜面 3dp 上内壁 0.424 / 下内壁 0.698 ✓ · I-8 四扇墨序方位正确但**系数有渗漏**（⇒ D1）。
- **可访问性（本分册最重结论）**：facet-4 珠面非平面 ⇒ `accessibility.md` A3① 的「本色平面」量化基准面**已失效**；珠面可分档 **8 → 6**（现役渗漏态再降，临界对余量 −28%）；空槽 holed 6 档（中性偏正）、holeless 整格 **5** / 坑底 **4**；CVD 阻塞未解除（无真机、无模拟工具）。
- **风险 D1–D9**：D1 渗漏（已由 T-229 修）· D2 探针件与交付件同目录（82.8 KB = 交付物 3.3×，投放前移出）· D3 资产在工作区被删（20 件全 `D`；疑守 §19 的有意清理，来源待确认）· D4 128px × dpr≥3 触发放大（dpr3 时 zoom 上界 1.42 < `ZOOM_MAX` 2.0）· D5 定稿 py 头注/行内注与代码不一致（三处）· D6 命名四冲突 · D7 风格覆盖 = 1 · D8 a11y 基准面失效 · D9 无真机 / `build:wx` 未通。
- **交付性质**：**零代码、零资产、零判据、零他文件改动**；只交 a11y 文案建议（回写另单）。
- **待同步（T-229 修复后）**：珠面四扇改值（左 0.92 / 右 0.78 / 下 0.60）⇒ 上表 a11y 档数与 D1 相关读数须重算。

---

## WXG-T-228

**beads·tint 正式管线验收判据（用例 + G 门挂载）** — 严守真（quality-lead），P1 **readonly**。

> ⚠ 本行由主理人（CodeBuddy）于 WXG-T-229 批次代补；正文正本 = `production/qa/beads/wxg-t-228-tint-criteria.md`（317 行 / 12.3k tok）。

- **可执行范围声明（先声明再给结论）**：无 wx 真机 ⇒ `ADR-0028 §5` 的 **T2'/T3'/T4' 一律 DEFERRED**（K-037/K-054）；`build:wx` 未通 ⇒ 入包字节/包体差分不可实测；**tint 运行时未落码**（`games/beads/src/**` 只命中旧件 `tint-mask.effect`）⇒ 凡依赖 tint 臂的判据 = **待执行（预期红基线）**，⛔ 不得预写绿（K-035）。
- **判据族**：L.1 编码与形状不变式（TC-TINT-01…11，承重 V-2）· L.2 静态等价（TC-TINT-12 ≈ T1' / V-3、TC-TINT-13 mask-stable，承重 `§13.13 T1`：整珠平均 ΔE < 2、孔边高光 ΔE < 5）· L.3 运行时与门禁（TC-TINT-14…19：命令流/真 α、档位切换、矢量臂逐字节不变、包体、守卫有效性、D1 四扇逐档）。
- **统计口径（与 §3 R-9 分域、C12-t 共用同一组常量）**：芯区 `B ≥ 250` / AA 带 `5 < B < 250` / 孔·格外 `B ≤ 5`；容差 = 8-bit 量化 ±2/255、面积 ±1%、长度 ±0.5 dp。
- ⛔ **r9 探针读数不得当 T1' 证据**：AA fringe 最劣 **ΔE 11.3**（> 「珠边缘 <5」线）、不透明芯 max 4.62。
- **质量门 = CONCERNS**：G1–G3 未执行/待执行红基线；**G4 未过**（D1 使 V-3 必红 + C7/C12 未裁 + R-9 未裁）。
- **纪律**：本单**未复算**任何测量（readonly + ⛔ 禁自更新 fixture，K-042/K-051），表中「实测」列一律 = 引 WXG-T-227 美术侧读数 ⇒ **不得读作 QA 证据**。

## WXG-T-230

**C12 判别力退化处置 + `731100c` 未走复评通道的纪律缺陷**（2026-09-29 由 WXG-T-229 第六次复评派生）

**① C12 判别力退化（WXG-T-229 甲案副作用）**
- 事实：`facet-4` 四扇改值后，珠面族（facet）内**再无任何层使用 `base` / `edge` 端点** ⇒ `identifyPrimary` 的参赛端点色由 3 枚降为 **1 枚（`lit`）**（argmax `edge 25.2%` → `lit 25.0%`；`base` 占比 `24.7%` → `0.0%`）。
- 已落缓解（复评批内）：`TC-STY-10` 臂 B 改为断言「占优层占比必降 + `facetPx` 必降」（仍可被「恒返写死值」违反 ⇒ 反证力在）；**主理人另补机械门**「参赛端点色数 = 1」实算断言 ⇒ 恢复 ≥2 枚时必红、强制回改「让位」强反证。
- **未闭项**：① argmax 跟随性的等价证明 = 工具侧新增「**换墨反证**」臂（把占优层墨换成他格 `base` ⇒ argmax 必须变为该色）—— 属 `tools/scripts/check-bead-style-pool.mjs` 改动，⛔ 复评批不改实现侧；② T-228 的 **C12-t 建议**（改纹理像素 argmax）随 tint 臂落码后再裁。

**② `731100c` 未走复评通道（纪律缺陷）**
- 事实：`731100c`（WXG-T-214/221 批）把 `drawEmptySocket` 由「S2 坑底 rect + S1 暗缘框 rect」2 枚改为**内阴影阶梯 4 枚**（每空槽 +2 rect），整帧基线因此漂移（frame0 `+360` / frame78 `+204`），但**未走 §K.5.1 复评通道** ⇒ 第六次复评只能「搭车补登记」。
- 处置：本单只登记缺陷与归因（已在 `provenance.s3_frame_recheck_6` 与 QA `K.5.1-补6` 落账）；**根治措施待裁**（候选：封箱腿对「未走复评的整帧漂移」自动报警 / 收口清单加「视觉批必配复评」门禁）⇒ 归主理人。

**台账**：`WXG-T-229` 复评小节已记 ① 的读数与 ② 的归因；本单为其执行入口。

### S1 + S2 落码（程基岩，2026-10-02 · 主理人代为收尾复核）

**交付面**（⛔ 未 commit，等主理人发话）

| 面 | 文件 |
|---|---|
| mask 规格（定稿口径的 TS spec 化） | `packages/framework/src/core/bake/mask-spec.ts`（含两档层集快照 + `MASK_SCHEMA_VERSION` 独立失效号） |
| mask 场计算（纯数学） | `packages/framework/src/core/bake/mask-field.ts`（PIL 12.x 栅格化/椭圆状态机/扫描线/LANCZOS ÷4 逐式复刻） |
| 配方改产 mask | `bake-recipes.ts` 的 `makeBeadRecipe` / `makeCellRecipe` 增 `mode:'mask'` 重载（**默认仍位图模式 ⇒ 既有调用方零破坏**） |
| 对拍门禁 | `tools/mask-preview/mask-diff.mjs` + `lib/png-rgba.mjs`（零依赖 PNG 读入）+ 单测形态 `framework/tests/core/mask-diff.test.ts` |
| 双臂注入 + 白名单 | `games/beads/src/view/bead-tint-mask.ts`（显式白名单，预建 id 表保 C2 零分配）+ `bead-render.ts` 的 `setBeadTintRuntime` / `createWhitelistBeadTintRuntime` / `FilledBeadOptions.maskGauge` / `drawEmptySocket` 末位 tint 选项 |
| `blit` 着色基色 | `render-model.ts` 的 `BlitCommand.tint` + `BlitOptions`（第 6 参改选项对象；**`undefined` 不落 `JSON.stringify` ⇒ seal 基准零漂移**） |
| 单测 | `framework/tests/core/mask-field.test.ts`（24 例）+ `mask-diff.test.ts`（5 例）+ `games/beads/tests/bead-tint-arm.test.ts`（18 例） |

**实测读数（主理人独立复核，非采信汇报）**
- `mask:diff` 四件套（bead/cell × holed/holeless）**逐字节一致**：R/G/B `mean=0.0000 max=0 >1步:0/65536`，编码不变式全过 ⇒ **R-4（py/TS 双实现漂移）在本批实测为零**。
- 关键实测坑（已修并注释在码）：外框左/右扇隶属度⛔不可用「四扇补集」`1−up−right−down`（对角 45° 上三扇全 0 ⇒ 补集给出 `left=1`，把外框 d 从 0.42 抬到 0.63）⇒ 造成四角弧各约 900 px、R 通道 Δ 最大 **57**；改为与定稿 py 同式直算后归零。
- 绿线锚 V-5：未注入 tint 运行时时「注入前 / 注入后 / 取消注入」三次输出**逐字节相同**；既有 beads 测试 735 绿 + 1 skipped（本批前基线）**零回归**；`bead-style-seal` / `bead-style-pool` / `bead-render` + 新增 tint 臂合计 **83 绿**。
- 全量 `pnpm run verify`：**PASS 18 / SKIP 1 / FAIL 0**（SKIP 仍 = `check:size`）。
- `tsc --noEmit` 两包 0 错；`check:arch` OK（1 warning = 既有 editor 产物提醒）；`check:es5spread` OK；`framework:sync:check` 绿（已同步 7 处镜像）。

**DEC 落实对照**
- DEC-1（本批 = 命令层 + Canvas2D 侧准备；Cocos 生产不接）✅ —— Cocos 载体**未做**。
- DEC-2（孔区真透、透 B0 tile）✅ —— tint 臂下不再画 live `pit`/孔环，**矢量臂保持不变** ⇒ §3 冻结常量未动。
- DEC-3（丙·渐进 + `mask:diff`）✅ —— 对拍已绿，但**TS 尚未成为唯一真源**（py 仍是资产产出源，DEC-3 第 ① 步保留）。
- DEC-4（128px + 高倍回矢量）**部分** ✅ 档位钉住 128（跨包单测钉 `BAKE_CANONICAL_SIZE === MASK_CANONICAL_SIZE`）；⛔ **LOD 回退阈值未落**（`[待真机]`，属 S4）。
- DEC-5（白名单显式、未命中矢量回退）✅ —— 当前仅 `facet-4`，未定稿风格一律 `undefined`。
- DEC-6（编码沿用 ADR-0028 §2.1）✅。

**未闭项 / 风险（如实）**
1. **S3 未做**：Canvas2D 合成通道（`base·d+(1−base)·l` 预乘的实际消费）+ harness 实验页 ⇒ **tint 臂目前无消费者，游戏内不可达**（调用方未接 `maskGauge`）。
2. **S4 未做**：zoom LOD 回退机制与阈值。
3. `mask:diff` **未挂进 `verify`**（容差为方案件 §4.3 的**建议值**，原文标注「落码前与 QA 对齐」；本批实测已达逐字节一致 ⇒ 门禁按更严的逐字节判）。挂载与否待主理人裁定。
4. **K3 判据文本**在 tint 臂下不逐字成立（透出的是 B0 tile `edge` 而非 `pit`）⇒ 仍挂 **WXG-T-230 / T-228**，本批未代改。
5. `mask-field.ts` 逐式复刻 PIL 12.2 的实现细节（取整/椭圆状态机/LANCZOS 定点）—— 漂移面收敛为「py 与本模块的平台/版本差异」一处，⚠ 若 py 侧升级 PIL 版本需重跑对拍。
6. `blit` 第 6 参签名变更（位置式 `alpha` → 选项对象）：仓内仅 1 处调用已同步，⛔ 外部调用方需按编译期报错适配。


## WXG-T-231

**beads·关卡存量 4 红立项（`DEMO_LEVEL_COUNT` 漂移 + 关卡快照判据过期）** — 2026-10-02 主理人（CodeBuddy）立项，**先确诊后建档**（不凭推测写单）。

## 现象与读数（`pnpm --filter @wxgame/beads run test`）

736 例 / **4 红**，长期使 `pnpm run verify` 的 `test` 项 FAIL（常态 PASS 16 / SKIP 1 / **FAIL 1**）：

| # | 用例 | 断言失败 |
|---|---|---|
| 1 | `tests/levels.test.ts` › BOOT validator › *accepts a well-formed level and every shipped level* | `expected LEVELS toHaveLength(8) but got 9` |
| 2 | `tests/misplaced-assembler.test.ts` › *MVP·全部出货关全错位初盘数据全过 BOOT* | 同上（`8 → 9`） |
| 3 | `tests/level-import.test.ts` › WXG-T-179 主菜单「导入」钮接线 | `expected 10 to be 9`（导入前 9 关 + 导入 1 = 10，而断言按 8+1=9 推） |
| 4 | `tests/levels-dir-pipeline.test.ts` › P1 目录化真源不变量 › *产物数据体逐字节等于迁移前快照* | 产物 `src/config/levels-data.ts` ≠ `tests/__fixtures__/levels-body.snapshot` |

## 根因（两类，**不是一个 bug**）

**A 类 · 冻结常量漂移（3 条红，同一根因）**
- `config/tuning.ts::DEMO_LEVEL_COUNT = 8`，而 `design/levels/manifest.json` 实为 **9 关**（`contentVersion 21`、order 1..9 连续、uid 唯一）。
- 变更源 = **`81b08ed`（WXG-T-203「关卡表 pre-release 全量重置，uid 序号改 5 位」，已入库且是 HEAD 祖先）** ⇒ 8→9 关时**未同步该常量**。
- ⛔ 不是笔误而是**已知耦合**：`DEMO_LEVEL_COUNT` 的常量注释自陈「再入/再移出关时本值需同步改，否则 `levels.test` / `misplaced-assembler.test` / `level-import.test` **三处断言即红**」⇒ 本红是这套耦合的第一次真实兑现。

**B 类 · 判据语义过期（1 条红）**
- `levels-dir-pipeline.test.ts` ① 的设计目的是**证明 P1 目录化迁移那一刀零行为漂移**（快照 = 迁移当时的数据体）。
- 关表在 P1 之后被**合法变更**（8→9 关）⇒ 该断言按设计**每次内容变更都会红** ⇒ 它锁的是**历史事件**，却被当作**持续不变量**使用。
- 同文件 ②③（`schemaVersion` 冻结 / manifest order·uid·引用齐全）仍是**活的结构不变量**，未受影响。

## 待裁（⛔ 工程侧不代拍）

**A 类修法**（机械一行，但值须确认）：`DEMO_LEVEL_COUNT` **8 → 9**。⚠ 前置确认：9 关是 pre-release 全量重置后的**终态**还是**中途态**（若后续还要入关，同类漂移会复发 ⇒ 建议同时裁「关数变化 ⇒ 常量必须同批同步」的门禁或把该断言改成读 manifest 长度）。

**B 类处置**（三选一，属判据语义域）：
- **甲**：重取快照（快，但**永久失去**「P1 迁移零漂移」的证据力 ⇒ 不推荐）；
- **乙**：① 降级为一次性历史断言（移入 `T-185` 归档段 + `[T-185 迁移期]` 标注），持续不变量交给 ②③（同文件已有）；
- **丙**：乙 + 把「关表内容变更 ⇒ 快照同步」写进关卡内容管线的收口清单（防同类复发）。

## 状态与影响

- 本单**只立项、不落码**；4 红维持原样，不因「看着像小事」就随手改数。
- 影响面：① `verify::test` 长期 FAIL ⇒ **绿线不可信**（K-089 同族：守卫/断言长期红会让人对整条门禁脱敏）；② 阻塞任何以「beads 全绿」为前置的验收（如 T-226 落码批的回归门）。
- 与本单无关、**不得混计**：WXG-T-229 复评后的 11 红已于 `565fa28` 全部转绿（剩 4 红即本单）。

### A 类处置落码（用户 2026-10-02 拍板「A」，2026-10-02 实施）

**前置已查清（结论对「只改值」不利，故同批加了门禁）**：`systems-index §3` 该行明写本值「**随表走 = 当前关数**」，且关表由 **beads-studio 逐张入关重建**（v1.48 入满 8 张）⇒ **9 是中途态、不是终态** ⇒ 只改值必然复发。

1. **`config/tuning.ts::DEMO_LEVEL_COUNT` 8 → 9**（注释记 v1.60 由来 + 门禁⑤ + 「9 是中途态」告警）。
2. **真源回写**：`systems-index` 版本行 → **v1.60**；§3 `DEMO_LEVEL_COUNT` 行值 8→9 + v1.60 注；`systems-index-changelog.md` 追加 **v1.60** 行（含①②③与「不并入 B 类」的显式声明）。
3. **新增生成期门禁⑤**（`tools/scripts/sync-levels-data.mjs::assembleFromManifest`）：声明了 `DEMO_LEVEL_COUNT` 的游戏，该值必须 == manifest 当前关数，不等即 `levels:check` 硬红。⛔ 只对声明该常量的游戏生效 ⇒ **breakout legacy 零影响**。
   - **门禁自证（K-089「先证守卫能红」）**：临时把常量改回 8 ⇒ `levels:check` 立即 exit 1；复原 9 ⇒ 绿。
   - 头注「覆盖面断言」清单 + `--help` 文本同步加 ⑤。
4. `framework:sync` 同步 Cocos 镜像（写入 1 = `tuning.ts`）。

**读数**：beads **735/736 绿**（A 类 3 红全转绿）· 剩 **1 红 = B 类**（`levels-dir-pipeline` ① 快照断言）· `levels:check` OK（beads + breakout）· `tsc --noEmit` 0 错。

**B 类仍待裁**（甲重取快照 / 乙降级为一次性历史断言 + ②③担纲 / 丙乙 + 写进关卡内容管线收口清单）——⛔ 本单未代裁。

### B 类处置落码（用户 2026-10-02 拍板「乙」）

**选项落地**：`tests/levels-dir-pipeline.test.ts` ① 由「常跑不变量」降级为 **`it.skipIf(env !== '1')` 的一次性历史断言**，标题改 `［T-185 迁移期一次性］`，注释写清：① 它原本证明什么（P1 迁移那一刀零漂移）② 为什么必须降级（锁历史事件却当持续不变量 ⇒ 关表任何**合法**变更即红，红因与被测行为无关）③ 现态由谁承担（同文件 ②③ 活结构不变量 + `levels:check` 的**字节一致性**；本条与它**同源重复**，按 K-042 不两处各钉一份）④ 复跑命令与**「复跑预期为红」**的正确性说明。

⛔ **丙项未做**：「关表内容变更 ⇒ 快照同步」写进关卡内容管线收口清单 —— 本批只按用户所选「乙」落，丙作为可选加强留待裁（快照已不再参与常跑门禁 ⇒ 丙的实际收益随之下降）。

**自证（不只看绿）**：默认跑 = `4 passed | 1 skipped`（不再污染绿线）；`WXG_T185_MIGRATION_RECHECK=1` 复跑 = **如实判红**（快照停在 8 关 / 产物已 9 关）⇒ 一次性断言仍可跑、且其红是正确信号。

**收口读数**：beads **735 passed / 1 skipped / 0 failed**（736 全消红）· `tsc --noEmit` 0 错 · `levels:check` OK。

### B3+B4 落码与四轮架构 review（CodeBuddy + 用户，2026-10-03）

**范围**：`B3` = Canvas2D 合成消费通道（`core/bake/tint-composite` + `adapters/canvas2d/tint-sprite-cache` + 渲染器 tint 分支 + 门禁）；`B4` = zoom LOD 回退机制（`TINT_LOD_MAX_UPSCALE = null` + `tintUpscaleAllowed()` + `BeadTintRuntime.allowTint()` + 两条臂序）。⛔ Cocos 生产载体（S5）与判据改写（S6）仍未做。基线 `4ef6317`，⛔ 未 commit。

**用户定的四条尺子**（延展性 / 可预见性 / 将来少改动 / 性能优异）⇒ 四轮 review 的收敛结果登记进 `ADR-0029 §8` 与延后册，要点：
- **合成权归宿主注入的 `BlitResolver`**（单方法）：渲染器不认识任何效果；未注入 = 今日行为（V-5）。
- **core 收口**：`tint` 是唯一具名效果字段，新增效果一律走 `BlitParams` 袋 ⇒ core 永不再为效果改动。
- **撤掉两处多余设计**：嵌套 `opts` 袋（X1，会引入分配 + 三态歧义）、`blitMode` 标记（X2）、`prewarm()` 专用 API（X3，注入式设计白送预热）。
- **性能口径**：单条 128² = 16384 px；单关卡 **7 色**（`design/levels/singles/*.json` 的 `palette` 恒 8 项）⇒ 7 条 = 448 KB，2.5 MiB 装 **40** 条 ⇒ **5.7× 余量**。⛔ 「品牌 2104 色」是**调色板规模**不是工作集（15 份品牌 25–461 色/份），先前引用口径有误，已更正。

**两个真 bug（单测抓出，非测试自身问题）**
1. **渲染器回落漏洞**：`cmd.tint` 存在但未注入合成器时，三元表达式回落到注册表 ⇒ **把未合成的 d/l mask 当成品贴出**（错色）。修法 = 带 tint 时永不回落（已升为 `ADR-0029 §8.3` 契约）。
2. **`drawEmptySocket` 漏挂 B4 阀**：只加在 `drawFilledBead` ⇒ 关阀时珠回退、格不退（不一致）。已补。

**LOD 数字**（`outer` = `BEAD_CELL 30` × zoom × dpr vs `MASK_CANONICAL_SIZE 128`）：`dpr = 2` 全区间安全（zoom 2.0 ⇒ 120px = 0.94×）；⛔ `dpr = 3` ⇒ zoom > **1.42** 即放大。阈值仍 `[待真机]`（`null`）。

**读数**：framework **410/410 绿**（新增 `tint-composite` 12 + `tint-sprite-cache` 13 + `canvas2d-renderer-tint` 5 = 30）· beads **761 绿 / 1 skipped**（新增 B4 判据 8）· `pnpm run typecheck` 0 错 · `framework:sync` 已同步 8+5 处 · `pnpm run verify` **PASS 18 / SKIP 1（`check:size`，K-089 既有缺口）/ FAIL 0**。

**未落 / 待裁**：⛔ `view-model` 未传 `maskGauge` ⇒ tint 臂仍**无调用方**（安全默认，屏上仍矢量臂）；⛔ 宿主未注入 resolver。接线作用域待用户裁：**甲 = 只接盘面**（托盘恒矢量，推荐）/ 乙 = 盘面 + 托盘珠。⛔ 未 commit。

## WXG-T-232

**beads·盘面 mask 形状通道去振铃 + 孔缘羽化收敛** — 2026-10-03 用户裁「甲」（缩范围）。⚠ **原立项前提被实测推翻，见下**。

### ⛔ 立项时的两处误判（自查发现，如实留档）

1. **「mask 珠径 27.2dp 偏大」= 误判**。原判据用 `shape > 0` 量得 solid 区 `x=6..121 = 116px`，据此以为珠径 27.2dp。
   实际：**solid 区 = `x=9..118/119` = 110–111px**，与理论 **26dp = 110.9px** 一致；
   多出来的 `x=6 (shape=4)` / `x=121 (shape=2)` 是 **LANCZOS 振铃斑点**（1.6% / 0.8% alpha），
   被 `>0` 阈值误计入。⇒ **珠径本来就是对的，不需要「重烘到 26dp」。**
2. **「亮刻面压格边界是 tint 臂缺陷」= 误判**。tint 珠 solid 26.0dp、矢量臂 plate = 30 − inset 2×2 = 26dp
   ⇒ **两臂缓冲同为 2.0dp**。该现象是 `BEAD_GAP = 2` + 珠径 26 的**设计结果**，两臂都会出现。

⇒ 原计划的「重烘到 26dp」**无对象**；用户裁「甲」= 缩范围为下面两项真缺陷。

### 落码范围（两项，均为技术修复，⛔ 不动物理几何、不动 §3）

| 项 | 修前（实测） | 修后（实测） | 做法 |
|---|---|---|---|
| **① 消振铃** | 珠外缘 2 个 `shape` 2–4 的斑点 | **0 个** | 缩回后对形状通道施加 **地板 8/255**（`applyShapeFloor`）；真 AA 边实测 128/190 ⇒ 不碰真边缘 |
| **② 收孔缘羽化** | 羽化 `0.5dp` + 振铃叠加 ⇒ 10–90% 过渡 ≈3.5px、含淡尾 6px | 羽化 **`0.25dp`** ⇒ 过渡 ≈2px | `mask-spec.holeFeatherDp` 0.5 → 0.25（单一真源，TS/py 两侧同改） |

⛔ **物理孔径未动**（`holeDp = 12`）—— 修后 **50% 交点 r≈25.8 ⇒ ⌀12.2dp** ✓ 与标称一致。
⚠ **判据口径自纠**：先前把「全透区 ⌀10.5dp」当成「侵蚀」是**误读** —— 任何 AA/羽化都会让全透区小于标称，
判据**必须用 50% 交点**，不是全透区直径。

### 判据（把「看着别扭」变成可测数）

`mask-field.test.ts` 新增 3 条：① 形状通道**无振铃斑点**（`0 < B < 8` 计数 = 0）② 珠 solid 区 = 26.0dp ± 1px 且
**缓冲 ≥ 1.5dp** ③ 孔缘 **50% 交点** ∈ [11, 13]dp + `holeFeatherDp = 0.25` 冻结。

### 读数

**`mask:diff` 四件套 mean=max=0（逐字节一致）** ⇒ py 与 TS 两侧改动完全对齐（`bead/cell × holed/holeless`）·
编码不变式 I-1…I-9 全过 · framework **421 绿** · 四扇亮度序 `上 255(l=96) > 左 234 > 右 198 > 下 153` 单调 ✓ ·
孔心 `shape = 0`（真透）✓

⛔ 未 commit。**归属**：资产域 + 工程域（已完成落码），观感复核待用户。

## WXG-T-233

**beads·抬起露槽（选中抬起时补画凹槽）** — 2026-10-03 用户裁定「另立故事」。

**现状与依据**：静止态**按裁定不画坑** —— `view-model.ts:912` 用户原裁定「坑外廓按『同格有豆时的珠体绘制边长』退一圈（**坑恒小于珠、有豆时看不到坑**）」；抬起高度只用**格级分离影**（`drawLiftGroundShadow`）表达，**没有**回收「坑」⇒ 抬起后露出**平色 B0 底图**（用户反馈：「选择珠子时候，珠子下面漏出的图案不是槽」）。

**要做（三处联动，⛔ 缺一不可）**：
1. **层序**：有豆 + `lift > 0` ⇒ 在 B0 底图之上、珠体之下补画坑（凹槽口 + pit + 受光缘）
2. **面积账**：`cell-standard §1/§4` 的「珠:底 49.6:50.4」必重算（抬起态多占一格内面积）
3. **DEC-2 孔底口径**：孔区真透（透出下层）⇒ 抬起时**坑底该显示什么**（现为 B0 的 `edge`）需重评

**验收**：抬起/落下两态的截图对照 + 面积账新值 + 判据（`cell-standard` J 系 + 孔底 K3 文本）由 QA 更新。
**归属**：美术定标（林绘澄）+ QA 复评（严守真）。⛔ 未开工。

### B3/B4 + 接线：收尾与决策归档（CodeBuddy + 用户逐轮，2026-10-03）

**四轮架构 review 的最终形态**（正本 = `ADR-0029 §8`）：合成权归宿主注入的 `BlitResolver`（**单方法**、渲染器零效果知识）+ core 收口为**唯一效果槽 `fx`**（键名表 = `§8.4`；⛔ 不引入 `kind` 闭集，⛔ `nested opts` 袋 / `blitMode` / `prewarm()` 三件多余设计已撤）。
**用户裁定的路线**：Q1 框架层 · Q2 保 26dp 珠径（⇒ **WXG-T-232** 重烘 mask）· Q3 `BEAD_GAP` **先不动** · Q4 **暂不做**常驻像素门禁 · Q5 **甲**（保 26）· **S5 载体 = 甲（按色图集）**。

**本批修掉的 5 个真 bug**（全部由判据/实测抓出，非测试自身问题）：
1. `putImageData` 传裸 `Uint8ClampedArray` ⇒ 真浏览器抛 `parameter 1 is not of type 'ImageData'` ⇒ **合成产出恒 0 而 410 单测全绿**。修法：`createImageData` 工厂**必填注入**（编译期强制）。
2. **y 翻转方向搞反（我的推理错）**：曾按「blit 会翻转 ⇒ sprite 需预镜像」落 `flipY: true`。**A/B 截图实测**：`flip=0` 上半 112.3 / 下半 88.6（光影在上 ✔）、`flip=1` 上半 99.7 / 下半 109.4（反 ✘）⇒ 正确是**不预镜像**（`blit` 的翻转与帧级 y 翻转相抵，纹理须为屏幕朝向）。已回退 + 反向教训写进 `§8.5`。
3. `flipRows` 原地改 `getImageData` 缓冲 ⇒ 若宿主返回共享缓冲会**污染宿主数据**。修法：先拷贝再翻。
4. `drawEmptySocket` **漏挂 LOD 阀** ⇒ 关阀时珠退格不退（不一致）。
5. **小豆档（holeless）珠体永远走不了 tint 臂**：臂序挂着 `!options.hideHole`（烘焙臂遗产）⇒ `bead-holeless` 定稿 mask 成**死资产**。修法：`(!hideHole || maskGauge === 'holeless')` + 改判据 + 加回归锚。

**观感侧的诚实结论（tint 臂首轮真实观感）**：孔**真透**（透出 B0 `edge`，合 DEC-2）✓、四扇刻面上/左亮→下暗 ✓、格间缝 = B0 底图（暗，非白）✓；但**已填格缺「豆子坐在凹槽里」的层次**（mask 珠径 27.2 几乎填满格）⇒ 与矢量臂 A/B 对照后立 **WXG-T-233**（抬起露槽）。

**新发现的既有缺陷（不在本批修）**：`facet-4`（默认/生产皮肤）**完全不消费 `lodLayers`** ⇒ **zoom LOD 对真正需要降档的场景（fit 档 2900 条命令）空转**；`legacy-ten` 有 3 处 `if (!lod)`。已登记延后册 **D11**。

**读数**：framework **418 绿**（新增 `ImageData` 实例判据 + `flipY` 判据）· beads **762 绿 / 1 skipped**（含 holeless 回归锚 + B4 阀 8 条）· `pnpm -r typecheck` 0 错 · `framework:sync` 已同步 · `verify` **PASS 18 / WARN 0 / SKIP 1（`check:size`，K-089 既有缺口）/ FAIL 0** · harness build ok。

**自测工具（本批新增，可复用）**：`temp/tint-wiring/sim-flip.mjs`（真 mask PNG → 合成 → 渲染器变换 → 屏幕朝向的离线模拟，A/B 定案用）、`temp/tint-wiring/annotated-cells.png`（用户截图的颜色 → 部件标注）、`/tmp/*.png` 的无头 Chrome 截图法（`--headless=new --force-device-scale-factor=N --window-size=W,H --virtual-time-budget=6000`）⇒ ⛔ Q4 裁「暂不做常驻门禁」，这些留在 `temp/` 供后续复用。

⛔ **本批未 commit**（等用户复核观感后提交）。

### harness 观感验证轮（CodeBuddy 无头 Chrome 逐像素，2026-10-03 下午）

**验证能力**：机器有 Chrome ⇒ 用 `--headless=new --force-device-scale-factor=N --window-size=W,H --virtual-time-budget=6000` 自己抓两臂截图 + 逐像素剖面，⛔ 不再靠用户肉眼转述。

**已验证通过**：① 光影方向（上/左亮→下暗，A/B 实测）② mask 通道 = `facet-4` 四扇的**忠实编码**（上 `d=1.0,l=0.376`=lit / 左 0.918 / 右 0.776 / 下 0.60，与 `mix(base,−0.08/−0.22/−0.40)` 逐位对应）③ 孔**真透**（`shape=0`）④ 格间 = B0 底色（暗，非白）。

**本轮又抓到 2 个真问题**：
6. **tint 基色取错索引**（S2 批埋）：`bead-render:681` 用 `targetColorIdx ?? colorIdx`，而**矢量臂 `facet-4:151` 用 `colorIdx`（珠色）**。错位/交换态（`beads-game.ts:2290` 判 `beadColorIdx !== colorIdx` 为合法态）⇒ **两臂渲出不同颜色**（实测逐扇 RGB 距离 **51.7 / 54.6 / 57.3**）。修法：改 `colorIdx` + 加错位态回归锚；**并发现旧判据「tint 基色 = 珠的本色」本身把 bug 断言进去了**（传 `colorIdx:1/targetColorIdx:2` 却期望目标色）⇒ 已按修正语义改写。**修复后逐扇 RGB 距离降到 0.0（上）/ 1.3（下）/ 7.8（左）/ 11.3（右）**。
7. **孔环缺失 + 孔径/羽化与标称不符**（并入 WXG-T-232）：mask 孔径向剖面 = 真透 `⌀≈10.3dp`（标称 12）+ 羽化带 **≈1.4dp**（标称 0.5）⇒ 合计到 `⌀≈13.6dp`；且孔缘是**亮晕**（`d` 125→210）而**矢量臂孔环 = `mix(base,−0.58)` 暗环**（`facet-4` #6 层）⇒ 两臂孔缘观感不同。

**残留差异归属**：左/右扇 7.8–11.3 RGB 距离的来源已定位 = ① 矢量臂有**同色自描边封对角 AA 缝**（`stroke===fill`，mask 无）② 珠径 27.2 vs 26（mask 覆盖到 B0 上，格间取样因此偏色）⇒ **两者都由 WXG-T-232 消解**。

## WXG-T-234

**beads·孔缘语义定标（mask 亮晕 vs 矢量暗环）** — 2026-10-03 用户裁定「另立故事」。

**事实（2026-10-03 实测）**：tint 臂的孔缘是**亮晕**（mask 孔缘 `d` 由 125 升到 210），而矢量臂孔环是
**暗环** `mix(base, −0.58)`（`facet-4` #6 层，族墨随 base）⇒ **同一颗珠在两臂下孔缘观感不同**。

**为什么工程侧不能自作主张**：孔环的**有无与明暗**是资产定稿口径（`cell-standard` J4 + 定稿 py 头注
「B14 孔边线 1dp 实色（hole −0.58 ⇒ d 0.42）」）⇒ 改它等于改资产定稿 ⇒ **须美术定标**。

**待裁**：
- 孔是否保留独立孔环？保留则 mask 需烘出 `d=0.42` 的 1dp 环；不保留则两臂都只留羽化
- 若保留，明暗是否沿用 `mix(base, −0.58)`（与矢量臂同值）
- 羽化与环的**先后关系**（环在内、羽化在外，还是环自身即边缘）

**验收**：重烘后与矢量臂的孔缘剖面逐像素对照 + 观感复核（美术 + 主理人）。
⛔ 未开工。**归属**：美术（林绘澄）主裁 + QA（严守真）复评。

## WXG-T-235

**beads·B0 底图 `TILE_BLEED` 外扩（消 AA 接缝白线）** — 2026-10-03 用户裁定「甲」。

### 起因：用户报「格子之间的白线看起来与放大缩小时采样有关」

用户初判方向**经实测成立**。三次实测把「看起来」变成数字：

1. **白线不在格间**（第一轮）：dpr=1 × 7 个窗口宽下逐行分段，格间与托盘**纯白 0px**；唯二的 2px 纯白线在
   盘面白底板外缘。ⓘ 我当时据此说「格间没有白线」——**错在阈值**：按「纯白 ≥248」筛，而该线混合后
   只有 lum 132 ⇒ 一直没被判成白。
2. **两臂对照**：同位置 `?tint=off`（矢量臂）亮度分布几乎一致（p99 均 157、max 184/185）⇒ 该线由
   `drawTargetTile` 的 B0 lattice **两臂共用**，**不是 tint 臂引入** ⇒ 不构成 tint 臂的阻塞项。
3. **剖面定位**（决定性）：`zoom 1.0 × dpr 2`、y=494 板面带逐像素 —— 板底 `(150,71,99) lum 97.8`，
   格边界 x=286 / x=329 各有 **1 device px** 的 `(172,112,133) lum 132.3`。三通道解混合一致
   （R 需 0.18 / G 0.22 / B 0.22）⇒ **约 20% 的白面板从相邻两个 B0 rect 的接缝漏上来**。

**成因**：格距在设备像素上多为分数（`gridPitch × zoom × dpr`），相邻 rect 的 AA 边缘各只覆盖一部分、
合计不足 100% ⇒ 缝里透出底下浅色板。⇒ **线的强弱是 `zoom × dpr × 窗口宽` 的相位函数**
（低倍率时格距变小、1px 缝占比最大 ⇒ 最显眼）。

### 落码（⛔ 只放大绘制边长，其余全不动）

- `config/tuning.ts` 新增 `TILE_BLEED = 0.5`（每边设计px）。附完整剖面、取值依据与判例。
- `view/bead-render.ts` `drawTargetTile`：`size` → `size + 2 * TILE_BLEED`。
- ⛔ **不动**布局格距 `gridPitch`、命中判定、`BEAD_GAP`（= 2）、珠体绘制边长（26dp）、`gridPitch` 快照。
- 取 0.5 的依据：相邻两格重叠 1 设计px ⇒ `dpr ≥ 1` 下恒 ≥ 1 device px，足够盖住实测的 1px 缝；
  再大只会让**相邻异色格**的色界多偏 0.5px（无收益）。
- 判例：**改 `BEAD_GAP` 是错的**——它治「珠与珠之间的缝」，本值治「底图与底图之间的缝」，层级不同。

### 配套测具（同批落，dev-only）

- `game/beads-game.ts` `setZoomForDebug(zoom)`：照 `setDebugOutlines` 同型，复用滑杆**同一条**
  `setCameraZoom` + `_recomputeLayout` ⇒ 状态完全同构，不持久化、不参与玩法。
- `dev/harness/main.ts` `?zoom=N`：headless 截图可按指定倍率出图（白线是相位现象，必须能定点复现）。
- ⚠ **实测坑**：harness 走 `dist/dev/harness/main.js` **预构建产物**，改 TS 不会自动生效 ⇒ 改完须
  `pnpm run harness:build`，否则参数静默不生效（三档 zoom 结果全同的假象即由此而来）。

### 修后实测（对照上表）

- 两处剖面点 lum `132.3 / 132.2` → **`97.8`**（= 底色本身，Δ −34.5 / −34.3）
- 全盘缝列普查 **7 条单像素缝列**（286/329/414/457/542/585/670）→ **0 条**
- 板面区「> 中位+20」像素 59211 → 55933（−3278 ≈ 20 条缝 × 180 行）；板面中位亮度 97.8 **未变**

### 测试口径变更（逐处留决策出处，非数字微调）

共 10 处「B0 底图 = 满格距、边缘重合」旧不变量：

- **5 处**「按字面量宽度筛 B0 tile」的过滤器改跟绘制边长 —— 其中 **2 处旧写法会静默退化为空断言**
  （筛出 0 条时「逐字段相等」永真，K-060 阳性对照失守）
- **4 处** `tile.w === 格距` 精确值加 `2 * TILE_BLEED`
- **1 处**「相邻砖**零重叠**」翻成「**恰好重叠 1px**」—— 旧零重叠正是漏白成因

### 封箱基准：第七次复评（严守真 · 官方复取器重抓）

- 现象：`bead-style-seal` 腿 4a/4b 红（整帧 sha 漂移）；`kinds` 与 `total` **未变** ⇒ 纯字段漂移。
- 处理：**未手填 sha** ⇒ 用官方复取器 `bead-style-seal-recapture.ts` 重抓
  （`capturedFrom = b84a1fd… · WXG-T-235 TILE_BLEED 工作树`）。
- **最强反证**：单珠命令流 `legacyFlow` **96/96 与前态全等**、`facetLayers` 45/45 全等
  ⇒ 本批**只动 B0 绘制边长，珠体一字未改**。
- 归因键 `provenance.s3_frame_recheck_7` 含：前态/现态锚、修订面（156 块 B0 rect 的 `w`/`h` +1）、
  实测剖面、**两臂对照（非 tint 引入）**、修后读数、配套测试口径变更清单。
- 零追改声明：`head.*` / `s3AtFormalization` / `head_liftShadowFade_r5` / `s3.legacyFlow` /
  `s3.facetNonHoleLayers` / `s3.facetHoleLayer` / `fixture.*` 全部不动；本批仅改 2 个 sha + 新增 1 归因键。
- 腿 4a/4b 补断言锁「无登记的基准追改视为红」⇒ 缺 `TILE_BLEED` / `不是 tint 臂引入` / `96/96` 任一即红。

### 接缝是「窄窗口现象」（本单最有价值的技术沉淀）

修后共测 12 个档位（dpr 1/2 × zoom {0.2, 0.5, 0.8, 1.0} + dpr 3），接缝**一律为 0**；
而修前**只在 `zoom = 1.0`（dpr 1 与 2）**检出。两点推论：

1. ⛔ **「重叠 ≥ 1 设备px 才盖得住缝」不成立为机理**：低 zoom 处重叠**更小**
   （`zoom 0.2 × dpr 1` = 0.2 设备px）却**未检出**接缝 ⇒ 接缝是否出现与 `zoom × dpr`
   **不是单调关系，尚未建立**。`TILE_BLEED = 0.5/边` 的依据是「**已实测有效**」，不是「算得出来」。
2. ⚠ **dpr 越高不等于越明显**（与直觉相反）：dpr 3 未检出，而 dpr 1/2 的 `zoom 1.0` 检出了
   ⇒ 白线是**窄窗口现象**，不是「低倍率必然出现」也不是「高 dpr 必然更明显」。

### 未闭（如实）

> **本单仅剩 1 项真机欠账**（异色格观感已于 2026-10-03 闭合；回归守卫已落 `check:board-seam` 进 verify）。

- ~~⛔ 只验了 `zoom 1.0 × dpr 2` 一档~~ —— **2026-10-03 已补测**（定点缝探针，zoom ∈ {0.2, 0.5, 0.8, 1.0}
  × dpr ∈ {1, 2}，修前/修后各一张，共 8 点）：
  - 修前**只在 `zoom = 1.0` 的两个 dpr 检出缝**（各 **8 条缝列**，Δlum **46 / 41**）；`zoom < 1.0` 四点**未检出**。
  - 修后 **8 点全为 0 条缝列** ⇒ 修复在「缝确实出现」的档位上被验证（8 → 0）。
  - ⚠ **推翻了我自己登记的推论**「低倍率格距变小 ⇒ 1px 缝占比最大 ⇒ 最显眼」：**不成立**。已同步更正
    知识库 `K-091` 的根因段（该错误论断已随前次提交入库，故必须改，不能留着）。
  - ⚠ **探针灵敏度在低倍率偏低**（珠子打断整列 ⇒ 缝列判据失效）⇒「低倍率无缝」单靠探针是**弱证据**。
- ✅ **肉眼确认（用户 2026-10-03，主理人实机目检）**：harness 下 **zoom 0.2 → 2.0 全区间无白线**。
  ⇒ 与探针**互补**：探针强在「缝确实出现」的档位给数字（8 → 0），肉眼强在**不受探针锚点限制**的全区间
  ⇒ 两者合并，「低倍率无缝」由弱证据升为**可采信**（探针的低倍率假阴性被肉眼覆盖）。
  ⛔ 口径边界：肉眼确认只覆盖 **harness（dpr 1/2、桌面 Chromium）**。
- ✅ **dpr ≥ 3 未验 → 已验**（用户 2026-10-03 主理人实测）：**dpr 3 下 Canvas2D 的 AA 接缝未出现**。
  ⇒ 叠加此前的 8 点（dpr 1/2 × zoom 0.2–1.0），**修后在 12 个测过的档位上接缝一律为 0**。
  ⚠ 口径边界：本条若为 harness/Chromium 口径，则 **iOS Safari 的 AA 规则是否同桌面 Chromium 一致仍未证**
  （Canvas2D 光栅化规则跨引擎无强规范）—— 如需彻底闭合，投放前在真机Safari 上过一遍即可。
- ✅ **异色相邻格色界平移 0.5px ⇒ 不可见**（用户 2026-10-03 主理人目检，harness zoom 0.2–2.0 全区间）。
  ⇒ 这条是 `TILE_BLEED` 外扩**唯一的潜在可见代价**（同色相邻格的重叠完全不可见，只有异色格的
  色界会平移 0.5px）⇒ 确认不可见即等于确认**本次修复无可见成本**（WXG-T-235 的「甲」方案
  从「修 1 条白线、代价 0.5px 色界」变成「修 1 条白线、代价 0」）。
- ✅ **无回归守卫 → 已闭合**（用户 2026-10-03 裁定「提升为 tools/ 测具并挂 verify」）：
  新增 `tools/scripts/check-board-seam.mjs`，**静态口径门进 `verify`**（无浏览器依赖 ⇒ CI 可跑），
  四条断言 —— C1 `TILE_BLEED > 0` / C2 `drawTargetTile` 真按外扩绘制 / C3 相邻重叠 ≥ 1 设计px /
  C4 测试口径无「字面量格距硬判」。**四种改法逐条实测能红**（K-089 先证守卫能红）：
  改 0 → C1 红；去掉外扩 → C2 红；外扩减半 0.5→0.2（重叠 0.4 < 1）→ C3 红；测试口径回退字面量
  格距 → C4 红。⛔ **像素复验（`--pixels`）不挂 verify**（本仓 CI 无浏览器 ⇒ 必假红），只作本地
  测具（实测 `zoom 1.0 × dpr 2` = 0 缝列）。
  ⚠ 落码时守卫**误报过一次**（正则只匹配 `2 * TILE_BLEED`，真实现是 `TILE_BLEED * 2`）⇒ 已改为
  乘法顺序无关，并留教训：**口径门要匹配语义而非写法**。

## WXG-T-236

**beads·抬起投影形态定标（接触影/投射阶梯 + 坑底暗底读法 + 光向唯一性）** — 2026-10-03 用户裁定「丙」。

> 📄 **美术侧裁定正本 = `games/beads/art/lift-socket-styling-decision.md`（v0.1 · A–G 七条）**。
> 本节是**工程侧取证与留档**；七条的**逐条呈现 / 候选 / 代价 / 需美术提供的参数**以定标单为准。
> ⚠ 定标单 §1.1 有一处**比本节更彻底的实测结论**：**生产网格的抬起珠当前「零影」** —— 珠自身 L0a/L0b
> 亦从未在生产网格消费（`drawFilledBead` 内 `shadow` 0 次；`drawLegacyTenBead` 在 `src/` 内只有定义无调用，
> 仅测试作封箱对照臂）。⇒ 本节「影层已删除」只涵盖格面影 / 槽内影，**引用「现状零影」时请引定标单 §1.1**。

### 用户报的现象与工程侧已落部分

用户报两条：① 「已抬起的珠子点击还会走一遍抬起动画」；② 「抬起珠子的阴影是一个横条，没有看到底部的槽的图案以及真实光线的阴影」。

**① 抬起动画重播 —— 已修（纯行为 bug）**
抬起量是**一个全局时钟**（`_liftElapsedMs` / `SELECT_LIFT_MS = 200ms`，`SELECT_LIFT_PX = 6`）⇒ 整组共用一个
`liftProgress`。原写法在 `selectBoardBead` 里**无条件**归零 ⇒ 点组内**另一颗已抬起**的珠时整组**掉回地面再抬起一遍**。
修法（用户裁定「甲」）：**组已完全抬起 且 新锚仍属当前组** ⇒ 不复位（锚照移，动画不重播）；越界（换组 / 未抬完）仍旧复位。

**② 投影形态 —— 工程侧可判定的三处已修**

取证方式：headless 截图像素剖面 + 一次性命令流诊断（临时测试，用完即删）。实测三个缺陷：

- **位置与注释相反**：原实现把影放在 `cy − 0.36×outer`（格心**上方** 8–14px），而字段注释写「落在格心**下方**」。
- **比珠子还宽**：原 `liftShadowW = 0.66` ⇒ 影宽 19.8dp，而珠的视觉直径只有 12–14dp ⇒ 两侧各露约 3.4dp ⇒ 读作**横条**。
- **用了最浅的一档墨**：`fill = pit`（端点族里 `pit −0.44` **最浅**）⇒ 淡而不暗，压根不读作影子。

新口径：**接触影 + 2 级投射阶梯**，每级朝**右下**偏移并放大（§6 左上顶光 ⇒ 影朝右下），
墨档梯**直接引用坑内阴影已定标的端点族**（`shadeOuter −0.80 → shadeMid −0.68 → hole −0.58`，越远越淡），
⛔ **不新造数值**；颜色直接引用端点对象已预混好的字段（本函数不混色，色值只进 palette）。
每颗抬起珠图元数 1 → 3；满组（~25 颗）上限 +50，相对盘面 450–841 命令基线仍属可接受，且**只在选中态存在**。

### 二轮反馈的追加修复（2026-10-03，用户：「槽还是看不到，仍有一个横条阴影，效果上看起来不好」）

- **「槽还是看不到」⇒ 已落**（不再推给美术）：抬起格现在**也画坑底** ——
  `view-model.ts` 的 `lift > 0` 分支调 `drawEmptySocket(..., tilePainted = true, beadDrawInset)`，
  ⛔ 不新造部件/墨色（坑底与同色空格**同源**），⛔ **只在 `lift > 0` 时画** ⇒ 静息帧逐字节不变（封箱基线不受影响）。
  ⚠ **D1 仍未核销**（暗底上可能读作凸起）⇒ 本批是**工程暂定版**，观感由用户判；若读作凸起，改的是**明暗关系**而非结构。
- **「仍是横条」⇒ 根因是形状不是方向**：我第一版修复做成 12.6×4.8 的**扁胶囊**（宽高比 **2.6:1**），
  最外级还比修前更宽（21.0 > 19.8）⇒ 横条感**根本没消**。被抬起的是**圆珠**，其投影在斜俯视下必然接近**圆**。
  改法：影改**宽高同值**（`liftShadowContactD`，`radius = d/2`），段数 2 → **1**（接触 + 1 层投射 = 2 图元），
  偏移改**以向下为主**（`castDy 0.09 > castDx 0.05`）⇒ 读作珠子下缘右侧的**月牙**而非横带。
- **测试判据相应加固**：① 影必须**圆**（`w ≈ h`，早先按「左缘右移」判会假红 —— 影逐级变大⇒左缘必左移，
  已改判**中心**）；② `castDy > castDy` 显式钉住「向下为主」；③ 墨档梯期望**按 `castSteps` 派生**
  （⛔ 不写死档数，否则调段数即假红）。
- **命令数**：静息 450 → 抬起 **458**（**+8/颗** = 坑底 6 + 影 2）⇒ 满组（~25 颗）上限 **+200**，
  相对 450 ≈ **+44%**（⚠ 比第一版的 +17% 高，因坑底 6 图元是新增的；**常态零开销**，`lift > 0` 门控）。

### 三轮：影层删除 + 两条定稿争议转为美术单（本节为最终状态）

**删除影层（用户裁定 Q1 甲）—— 实测依据**

三轮实测证明影层**在两臂都不可见**，逐条证据：

- tint 臂的 cell mask **`shape` 全 255 = 完全不透明** ⇒ 覆盖同格内其下所有图元；
- 矢量臂的槽 = **4 枚不透明同心 rect + 2 条线** ⇒ 同样盖住格内；
- **换绘制序前后画面逐字节相同**（仅 1/255 舍入差）⇒「影压住受光亮线」的说法不成立；
- **两臂槽内像素剖面逐字节相同**（y=424 `(221,152,177)` lum 175.5、y=428 `(65,31,43)` lum 42.5）。

⇒ 删除 `drawLiftGroundShadow` + 5 个常量（`liftShadowContactD` / `castSteps` / `castGrow` / `castDx` / `castDy`），
每颗抬起珠省 2 枚不透明 rect，**画面零变化**。测试改为**删除动作的回归守卫**（用已删除的旧值
`0.44` / `0.56` × 格径做否定断言）。⇒ 命令数从 458 回到 **456**（+6 = 槽部件，仍是抬起态唯一增量）。

⛔ **顺带纠正我自己的一个误判**：此前把抬起格下的「亮横条 + 暗横条」判为「槽的受光亮线 + 我的影」，
实测证明那两条是**槽自身底缘的受光亮线与下斜面暗部**（定稿资产几何、两臂一致）⇒ **与影无关**，
所以「换序修亮线被压」这条路本身是错的。

**「影物分离」若要重新实现的前置条件**（缺一不可）：① 槽能半透明（当前 **0 真 α** 基线不允许）；
或 ② 影画在**槽外圈的 B0 tile** 上 —— 但槽 27dp / 格 30dp ⇒ 余量仅约 **1.5dp**，实操不可行。

### 五轮：删影（甲）已落 + 抬高位移（丁）**撞封箱架构级阻塞**

**甲（删影）已落**：四轮实测证明「格面影」与「槽内影」**都不可见**（格面影被不透明槽/mask 完全遮住；
槽内影因可见槽带仅 5dp、且与槽自身底缘着色同色同带而撞色）⇒ 函数 + 5 常量 + 调用全删，
每颗省 1–2 图元、画面零变化。测试改为「抬起格仍画槽」守卫。

**丁（`SELECT_LIFT_PX` 6 → 11）已提出但未落码 —— 撞封箱架构级阻塞**：

- 提案理由（几何反推）：可见槽带 = `lift + 12 − 13` = `lift − 1` ⇒ 6dp 只有 5dp（读不出）、
  **11dp ⇒ 10dp** ≈ 槽内径 42% ⇒ 槽底缘着色完整露出；⛔ 上界 `11 < 半格 15` 珠不越格。
- ⛔ **阻塞**：`bead-style-seal` **腿 1** 断言「当前代码 ≡ `head.legacyFlow`(48 史证)
  ⊕ `head_liftShadowFade_r5`(48 现役存档)」逐字节相等；抬高位移影响**全部 96 例**
  （实测 `legacyFlow` **96/96 全变**；`frame78`/`frame0` **0 差** ⇒ 整帧不受影响）。
  仓内先例：`927535c` 越界改 `head.legacyFlow` 48 例 ⇒ 处置 = **新建只读档案段**存现役值、
  史证段不动、腿 1 改**三段合并视图** ⇒ 那是**修改封箱核心断言结构**，按 K-082 属 QA 复评范围。
- ⇒ 现值保持 **6**；已用官方复取器取到现态抓取件（`temp/wxg-t-211-s3/s3-seal.json`，
  `capturedFrom = c2d25fa…`）备用。**用户 2026-10-03 裁定「丁暂不实施」**。

**⚠ 六轮补算：抬起量伴生「越格」代价（前一版疏漏）**
珠半 13dp + 抬起 `L` ⇒ 珠上沿在格心上方 `L + 13`；格半 15dp ⇒ **只要 `L > 2` 珠就越格**，
越格量 = `L − 2`。⇒ 现值 6dp 越格 **4dp**（首行格直接插进白色面板，`?lift=1` 实拍可见）；
**11dp 方案会把越格量放大到 9dp** ⇒ 「露出更多槽」与「珠更深插进上一格/面板」**必须一起判**。
⇒ 后续若重启丁，需连同「槽可读性」与「越格量」两项一起交美术。

### ⛔ 转美术定标的两条争议（本单正本）

**争议 A · 定稿槽几何在小尺寸 + 抬起状态下的读法（用户 Q2 裁定「是」）**
抬起格下缘实测两条带：亮线 `(221,152,177)` lum 175.5 + 暗斜面 `(65,31,43)` lum 42.5
⇒ 读作「两根横条」而非凹陷。**同族已登记**：`tint-mask-asset-spec:279` 早有一条
「孔可辨**由 1dp 孔缘墨环承担**…`[待真机]`：1dp 环带 ≈ 2 device px ⇒ **薄带风险**」
⇒ 两者是同一族问题：**薄带在小尺寸下的可辨性**。请美术定标：抬起后槽底缘的亮线是否应减薄/减淡。

**争议 B · 零对比坑底在暗 B0 上是否可接受（用户 Q3 裁定「是」）**
`tint-mask-asset-spec` v1.1 明定「有孔档槽底 = 格底色 **0.70**」＝ 与 B0 底图 **同色（零对比）**，
理由是「透色可辨 + **取放零跳变**」；判据 **I-5** 钉住该值。
⚠ 我曾建议改为 `0.56`（对齐矢量臂 `endpoint.pit`）—— **该建议已撤回**（那是定稿决定，不是写错），
但「零对比坑底在暗 B0 上是否可接受」**本身仍是该定的问题** ⇒ 请美术裁定：
(a) 维持 0.70（接受零对比，靠斜面环与亮线承载凹陷）；(b) 改 0.56（两臂一致，但**取放出现色跳变** + I-5 需改）。

### ⛔ 本单正本 = 四件待美术定标（工程侧不自作主张）

- **`D1` 暗底坑底反读**（`assets-spec §7.11.7`）：现有共用坑底套依赖**近白底图**才读得出凹陷，落到生产 B0
  （`endpoints.edge −0.30` 暗底）上**会读作凸起** ⇒ **「抬起格露出真实槽图案」本批不做**。
- **`D6` 光向唯一性未核销**：`18` 风格投影 = 右下斜向 vs legacy `L0b` = 正下。本批只保证**本函数**符合 §6，
  不代裁两风格的历史分歧。
- **阶梯段数 / 各段 α 与偏移**的定标（现取 2 段、偏移 `outer×0.1`、放大 `+0.14/+0.06`，均为**工程暂定**）。
- **接触影与坑底暗缘的层级关系**（两者同在格面，孰上孰下未定）。

### ⚠ 顺带登记的既有缺口：封箱夹具**无选中态**

封箱夹具（13×12 / 78 填 / 78 空）**从不调用 `selectBoardBead` / `selectTraySlot`** ⇒ **影层与选中态不在封箱基线
覆盖范围内**。本批改动因此**不需要第八次复评**（已实测 `verify` PASS），但该缺口本身是真实边界：
**选中态的渲染变化无封箱保护**。处置二选一（待裁）：补一条含选中态的封箱腿，或显式登记为已知边界不再追。

### 性能（结论不变：不是瓶颈）

每颗抬起珠 3 图元（原 1）⇒ 满组 ~25 颗 = +75，相对 450/帧 ≈ +17%；抬起时钟 O(1)；热路径零分配。
常态（无选中）**零开销**（`if (groupLift > 0)` 守卫）。


### 七轮：用户裁「抬起态要影」+ 选型 C-3 ⇒ 影已落码（E/F 定案）

**前置问题**：用户 2026-10-03 裁「**抬起态要影**」⇒ 解除 E/F 的空悬。但 §3.2 的三个死结仍在
（格面被不透明 mask 全覆盖 · 槽内可见带仅 5dp 且已被槽自身着色占满 · 槽外余量 ≈1.5dp）
⇒ 影必须**落在这三块之外的地方**，故走「看图选型」。

**选型过程（用户逐轮否掉，共 8 个方案，全部有实测依据）**：

1. **格面影** —— 结构上不可能（tint mask `shape` 全 255 + 矢量 `PLATE` 满铺，换序前后逐字节相同）。
2. **影投越格 4dp** —— ⚠ **我先前列「越格」时方位说反了**：越格在**珠的上缘**（珠跨 `[格心−7, 格心+19]`、
   格跨 `[格心−15, 格心+15]`），而 §6 左上顶光 ⇒ 影朝右下 ⇒ 那是**背光面**，光学上错。
3. **珠内暗边**（L0a 语义）—— 首版宽度 = 珠宽 ⇒ 落在珠自身底缘暗边内 ⇒ **ΔL = 0 隐形**；
   加宽到 2.3× 半宽才可见，**用户判「不像投影」**。
4. **Stadium 圆角条**（首版甲）—— `radius = 高×0.5` 在 24×7 上等于药丸形 ⇒ **用户判「圆角轮廓不对」**。
5. **小圆角矩形** —— 仍是条。
6. **正圆但半径取 `bandH×0.78`** —— 半径取自**抬起量**（≈6）而非**珠半径**（≈13）⇒ 曲率只有珠的一半
   ⇒ **用户判「圆角与珠子不一致」**。
7. **宽椭圆**（`rx = 0.70~1.05 × 珠半径`）—— 影宽仅珠宽 67～77%，**曲率与珠对不齐**。
8. **圆角方 = 槽轮廓**（`r0 = round(边长×BEAD_CARD.radius 0.30)`）—— 严格贴槽，但读作「整片槽底变暗」。

**✅ 选型 C-3（用户裁）**：**正圆，`r ≡ 坑半宽`，居中**。
**为什么能同时满足用户两条要求（「与珠同形」+「最好符合槽的轮廓」）**：
盘面格 `beadInset > 0 ⇒ relief = 0` ⇒ `drawEmptySocket` 的坑外沿 **≡ 珠面轮廓** ⇒ **坑半宽 ≡ 珠半径**
（几何恒等）⇒ 取 `r = 坑边长/2` 即**精确内接于槽**、不外溢。不是凑数，是恒等式推论。

**落码**：
- `bead-render::drawLiftSocketShadow`（新导出）—— 与 `drawEmptySocket` **同一把尺**（`beadFace`/`relief`/`s`）
  算坑边长 ⇒ 任一侧改系数两侧同改，不会「影比槽大/比槽小」。
- `tuning::LIFT_SHADOW_ALPHA = 0.38` / `LIFT_SHADOW_SINK = 0.10`（圆心相对槽心下沉比例；取正值保持左右对称）。
- 墨 = `endpoints.shadeOuter`（−0.80，**族内**）**+ `withAlpha`** ⇒ **零新 hex / 零新 mix 系数**。
  用 α 而非实色：槽口 3 层内阴影阶梯与 S4 受光亮线在影之下，实色会整片盖掉。
- 绘制序**钉死**：槽之后、珠之前 ⇒ 影压在内阴影阶梯与受光亮线之上（物理正确）+ 珠体自然遮住影的上半
  ⇒ 只露下弧 ⇒ 读作「圆珠投在槽里」而非「半个圆饼」。

**⛔ 修掉预览的两处偏差（预览 ≠ 正式，留档）**：
① **半径大 1dp** —— 预览用 `(size − inset×1)/2`，`drawEmptySocket` 实为 `− inset×2`；
② **墨出族** —— 预览用 `mix(base, −0.88)`，正式改用族内 `shadeOuter −0.80`（影会浅一档）。

**⚠ 我自己的一处度量错（已纠正）**：预览期报「ΔL −4.4 ⇒ 甲/丙/丁 很弱」是**错的** ——
那个度量取「差分包围盒内的全局 `min(lum)`」，盒内 `min` 落到**珠自身底缘暗边**（≈27.8）而非影。
正式实现同口径重测 = **ΔL −45.0**（影区 19×16 设计px）⇒ **影的实际对比远强于我先前的报数**。
与 K-091 同族：**测暗部必须限定在影的形状内**，不能用差分盒的全局 min。

**测试**：
- 新增 4 条不变式（`bead-render.test.ts`）：正圆（`kind==='circle'` 且恰好一枚）· `r ≡ 坑半宽`（**同式复算**，
  不写死 13/11）· 圆心 x ≡ 槽心 x（左右对称）· 墨 = `withAlpha(shadeOuter, LIFT_SHADOW_ALPHA)`；
  外加一条**反向腿**（`r ≤ 坑半宽`，防内接被破坏）。满豆/小豆两档同跑。
- **测试辅助函数误匹配（连带修）**：`scene-vfx.test.ts::liftedBeadAt` 靠「取格内**第一枚**带 `fill` 的 circle = 珠的孔底」
  定位，而影圆**画在珠之前** ⇒ 命令序在前 ⇒ 3 条抬起腿把影误认成珠（误判值 `-1.3` = `−(r13 × 0.10)`，正是影的 y 偏移）。
  修法 = 加**半径比判别**（影 `r ≈ 0.43 × gridCell` vs 孔底 `r ≈ 0.20 × gridCell`，阈值 0.35 两侧余量充足）。
- **封箱：零复评（实证 G）**：`bead-style-seal` **9/9 全过** ⇒ 本批**不需要第八次复评** ——
  这**实证**了 G 缺口的后果：选中态/影层改动**无封箱保护**（夹具从不调 `selectBoardBead`）。

**两个连带项（用户未否 ⇒ 按默认落）**：① 影**压出槽下沿**（`r=13` 而可见槽带仅 ≈5dp ⇒ 影区高 16 设计px，
盖到格外 B0）—— 物理如此，接受；② 影**盖在**槽的内阴影阶梯 + S4 受光亮线**之上** —— 物理如此，接受，
用 `withAlpha` 保住二者可读性。

**⛔ 仍未闭**：A（薄带可辨性）· B（holed 档零对比坑底）· C（`D1` 暗底坑底反读）· D（`D6` 光向唯一性）
四条仍待美术定标；`G` 的甲/乙二选一待工程/QA 裁；`丁`（`SELECT_LIFT_PX 6→11`）用户已裁暂不实施。

### 八轮：「有珠 / 无珠格底统一」落码 + 封箱第九次复评

**用户裁定**（2026-10-03）：「现在有珠子的格底和没有珠子格底不是一个图，请都按照没有珠子的格底图来实现」，
并指认资产 `tools/mask-preview/cocos-assets/grid-tint-128-mask.png`（「有孔珠子格底应该用这张图」）。

**根因 = 一处参数漏传（⛔ 不是资产问题）**：
`drawEmptySocket` 的 tint 臂命中条件含 `options.maskGauge !== undefined`，而 **view-model 调有珠格时
漏传整个 `options`** ⇒ tint 臂永不命中 ⇒ **静默回退矢量臂**（不报错、不抛异常、命令流只是「多了 4 rect」）
⇒ 坑底取 `endpoints.pit`（`mix(base,−0.44)` = **0.56×base**）而非 mask 的 **0.698**。
**空格分支一直传了** ⇒ 同一张脸的两套实现 ⇒ 这就是「不是一张图」的根因。

资产侧复核结论：**mask 是对的** —— `grid-tint-128-mask.png` 坑底 = **0.698**、格外 = **0.698**
（判据 I-5 要求坑底 0.70、I-6 要求格外 0.70，角像素 0.698 ✅）；`grid-holeless` 坑底 = 0.318 ✅；
两张 `bead-*` 的 shape 通道 min = 0（孔真透 ✅）。

**落码（三项）**：① 有珠格**常画**坑底（`drawEmptySocket` 由 `lift > 0` 门控改为无条件）；
② 补 `maskGauge`（与空格分支逐字同参）；③ 补 `styleId: snap.beadStyle`（与 `drawFilledBead` 同源
—— 此前两处盘面调用都没传 `styleId` ⇒ 恒用 `DEFAULT_BEAD_STYLE_ID` 的 mask，而珠用当前风格
⇒ 换风格时「珠是新风格、槽是默认风格」，是**另一处**同族潜在错配，本批一并修）。
绘制序：**坑底 → 影 → 珠**（影仍夹在坑底与珠之间，半径仍跟珠轮廓）。

**实测（zoom 1.5 静息帧）**：

| | B0 `(150,71,99)` | 违规坑底 0.56 |
|---|---|---|
| 修前 | 122 403 px | **36 977 px** |
| 修后 | **156 438 px** | **3 579 px（−90%）** |

⇒ mask 坑底 0.698 ≈ B0 0.70 ⇒ **珠孔现在读作 B0，符合判据 I-5**。
ⓘ **纠正我自己的误报**：先前报的「静息帧 0 px 差异」是**默认小倍率 + 阈值 >6** 下的假象
（孔仅几 px、混色后差 < 6）；真实修正量 **106 248 px**（把错的 0.56 改成对的 0.70），**不是回归**。

**防静默回退守卫（这类 bug 此前无任何断言能发现）**：`bead-tint-arm.test.ts` 新增 3 条 ——
① 传 `maskGauge` **必**调 `getMaskId('cell', gauge, styleId)` 且只发 1 blit、⛔ 0 条矢量 rect；
② **漏传 `maskGauge` 必不调** `getMaskId`（把「静默回退」钉成显式判据，将来删掉守卫条件即红）；
③ `styleId` 缺省回落行为。`scene-vfx.test.ts` 把旧腿「抬起格**仍画**槽」（前提 = 槽只在 `lift>0` 画）
翻成「**有珠格也画坑底**（宽度多重集差恰为 1 枚珠面 PLATE）+ 抬起只多一枚影圆、rect 数不变」。

**封箱第九次复评（严守真 · 官方复取器重抓，未手填 sha）**：
- **最强反证链**：`legacyFlow` **96/96 全等**、`facetNonHoleLayers` **45/45**、`facetHoleLayer` **45/45**、
  `fixture.*` 全等、**`frame0` sha 逐字节不变**（frame0 = 无填格帧 ⇒ 本批对其**恒为 no-op**，机器自证）。
- 唯一修订面：78 有珠格 × **4 rect（内阴影阶梯）+ 2 line（S3/S4）** = **468**
  （`frame78` rect 695→1007、line 220→376、total 1409→**1877**；circle/text/polygon 不变）。
- ⛔ **旧不变式「填格下的槽不再绘制」被本裁定推翻** ⇒ 差分账两条等式已改写，新增登记常量
  `FILLED_SOCKET_PER_CELL = 6` / `FILLED_SOCKET_FRAME78 = 468`，**与 `SOCKET_INNER_SHADE_FRAME78`
  两段不得合并**（否则就是把两个不同裁定的账混成一个黑箱）。
- 归因键 `provenance.s3_frame_recheck_9`（2577 字）；腿 4a 补断言锁「无登记的基准追改视为红」。

**⛔ 未闭（如实登记）**：
① **矢量臂自身的坑底仍是 `endpoints.pit` 0.56，违反判据 I-5 的 0.70** —— 本批只保证「tint 臂命中时」合规；
tint 臂不可用时（有珠格仍走矢量）孔内偏暗。改它会动**全盘空格**渲染 ⇒ **待美术/工程裁**。
② 托盘槽（`view-model:1222`）按 `§3.6` 恒矢量、**未传** `maskGauge`/`styleId` ⇒ 不在本批范围。

### 九轮：影改「圆角正方形 + 只画在珠下缘以下」（用户判七轮正圆选型有误）

**用户裁定**：「选中珠子的阴影有问题，应该是**只有珠子下面有影子，孔不要有影子**，另外影子轮廓
**要与槽一致，是圆角正方形，而不是圆形**」⇒ **推翻七轮的 C-3 正圆选型**。

**缺陷①「孔不要有影子」的成因（几何实测）**：真透孔（`shape = 0`）在**珠内部**
（`y ∈ [格心, 格心 + 2·holeR]`）。七轮的正圆实现 `r = 边长/2`、圆心在格心略下沉 ⇒
影跨到 `格心 + 11.7`，**上半伸进珠轮廓内** ⇒ **正好从真透的孔里透出来**。
⇒ **不需要挖洞**：`polygon` 是单轮廓、`polygon3` 只是三角形简写，**都不支持多轮廓**
⇒ 改为把影**裁到 `y ≤ 珠下缘`**（`y ≤ cy + lift − 珠半宽`）⇒ **孔区恒不在影内**。

**缺陷② 轮廓**：⛔ 正圆 → **圆角正方形**，圆角半径 = **槽的圆角**
`round(边长 × BEAD_CARD.radius 0.30)`。
⚠ **判据坑（已写进单测）**：`抬起量 6 < 圆角半径 8` ⇒ 影的**上沿已在圆角弧内**，
实测上沿宽 **25.49 ≠ 26** ⇒ **不能用「上沿宽度 = 珠面全宽」当判据**，必须按圆角公式复算。
我第一版单测正是写了「上沿 ≡ 珠面边长」⇒ 假红，改成复算后才对。

**落码**：`drawLiftBeadShadow` 由 `builder.circle` 改为 **`builder.polygon`**（多段折线拟合
「圆角正方形 ∩ 珠下缘以下」，`N=8`），新增 `lift` 参；**删除 `LIFT_SHADOW_SINK`**
（裁剪取代了圆心下沉，少一个系数）。

**单测整块重写（四条不变式）**：
① **上沿 ≡ 珠下缘**（⇒ 孔无影）+ 下沿 ≡ 槽底沿 + 影高 ≡ 抬起量
② 轮廓 = 圆角正方形（**⛔ 不是 circle**）+ 左右对称 + 墨 = 族内 `shadeOuter` + **圆角真收窄**（防退化成直方块）
③ 边长跟珠不跟坑 ④ `lift = 0` ⇒ **零图元**（常态零开销）

**测试侧两处必要适配（非口径放松）**：
- polygon 顶点住**模型级 arena**（命令只带 `offset/count`，ADR-0024 值语义）⇒ 必须经
  `polygonVertices(model, cmd)` 解引用，⛔ 不能从命令里直接读 `points`；
- `scene-vfx` 那条腿的「抬起恰好多一枚**影圆**」判据同步改为数**多边形**，并加一条
  「抬起不得新增 circle」（旧圆影已删）。

**ⓘ 一次自暴露的实现 bug**：改写时先把顶点写成**相对格心**的 y 却没加 `cy` ⇒ 被 typecheck 的
「`cy` 声明但未读」抓到（`noUnusedParameters`）⇒ 修正为 `cy + y`。
**教训：把「中心相对量」改成「绝对量」时，编译器Unused 告警是唯一的免费网。**

**读数**：beads **769 绿 + 1 skipped** · verify **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** ·
`check:tasks` 26/26 · 定标单 **v0.4** · 对照图 `temp/shadow-preview/r9-lifted.png`。
**封箱未受影响**（影只存在于抬起格，夹具无选中态 ⇒ 腿 4a/4b 仍绿，**不需要第十次复评**）。

### 十轮：影 = 「珠底轮廓 ↔ 槽底轮廓之间的真实可见带」（用户问「是贴图吗？为何不连在一起」）

**用户问**：「这影子是贴图吗？**为什么不连在一起**」。

**① 性质：不是贴图。** 发的是 **`builder.polygon`**（26 顶点 = 上沿 13 + 下沿 13），
⛔ 不是 `blit`、⛔ 不用任何 mask/纹理；上下两条边界**共用同一套圆角公式**（圆角 ≡ 槽的
`round(边长 × BEAD_CARD.radius 0.30)`），彼此只差一个 `lift`。

**② 「不连在一起」的成因 = 九轮的实现缺陷**：九轮把影的**上沿钉成「过珠底心的直线」**
（`y = cy + lift − 半宽`），而珠是**圆角正方形** ⇒ 两侧珠底**向上弯**、直线不动
⇒ 中间贴合、**两侧各露出一条缝** ⇒ 读作**贴在下方的独立贴片**。

**修法：影 = 珠底轮廓 ↔ 槽底轮廓之间的那条真实可见带**。
- 下沿 ≡ 槽底轮廓 `bottomAt(x) = −半宽 + (圆角半径 − √(圆角半径² − d²))`，`d = max(0, |x| − (半宽 − 圆角半径))`
- 上沿 ≡ **珠底轮廓** = 下沿 + `lift`
- ⇒ **逐点厚度恒 = 抬起量**；影横向**铺满槽的绘制边长**（伸进两枚底角）
⇒ 恰好填满真实可见缝隙 ⇒ 严丝合缝、读作珠投下的影。

**单测按新几何逐点重写（四条）**：
① **逐点**钉「下沿 ≡ 槽底轮廓」+「上沿 ≡ 珠底轮廓」⇒ 同时证成「厚度恒 = 抬起量」
「上沿 ≡ 珠下缘 ⇒ **孔无影**」「严丝合缝 ⇒ **连成一体**」；上沿最高点 ≡ `cy + lift − 半宽 + 圆角`
② 轮廓 = 圆角正方形（⛔ 不是 circle）+ 左右对称 + **横向铺满槽宽** + 墨 = 族内 `shadeOuter`
③ 边长跟珠不跟坑 ④ `lift = 0` ⇒ 零图元

⚠ **测试侧第三处必要适配**：polygon 顶点序是「上沿 左→右（N+1）→ 下沿 右→左（N+1）」
⇒ 拆分上下沿后**下沿必须 `reverse()`** 才能与上沿按 x 配对。
我第一版漏了 ⇒ 报「x=−13 上沿须贴珠底：差 6」（正好等于一个 `lift`，因配对错位取到了珠心行）。

**封箱**：仍未受影响（影只在抬起格，夹具无选中态）⇒ 腿 4a/4b 绿，**不需要第十次复评**。

**读数**：beads **769 绿 + 1 skipped** · verify **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** ·
`check:tasks` 26/26 · 定标单 **v0.5** · 对照图 `temp/shadow-preview/r11-lifted.png`。

### 十一轮：影上沿改用「抬起后」珠尺寸（用户判「上沿形状与珠底不吻合」）

**根因 = 珠抬起时会放大 4%，而影的上沿按未放大的尺寸算。**
`drawFilledBead` 的珠面 = `(outer − inset×2) × scale × (1 + BEAD_CARD.liftScaleGain × liftT)`，
`liftScaleGain = 0.04`、满抬起 `liftT = 1` ⇒ **抬起后珠面 26 → 27.04（半宽 13 → 13.52）**。
十轮影上沿沿用未抬起的 26 ⇒

| | 抬起后珠底 | 十轮影上沿 | 差 |
|---|---|---|---|
| 中心 | `格心 − 7.52` | `格心 − 7` | 高 **0.52dp** |
| 外侧 \|x\|=13 | `格心 + 0.48` | `格心 + 1` | 高 0.52dp、**窄 0.52dp** |

⇒ 两侧各露约 **0.5dp** 槽底缝隙 ⇒ 读作「没连在一起 / 不吻合」。

**落码**：影的**上沿改用抬起后珠尺寸**，归一通道与 `drawFilledBead` **逐字同构**
（`liftT = min(1, lift·BEAD_CELL / (liftRef·size))`、`× (1 + liftScaleGain·liftT)`、圆角由该边长派生）
⇒ ⛔ 不另立第二套抬起归一公式（那会引入新的漂耦点）。

**顺带排除一项疑点（读资产文件，非像素考古）**：`bead-tint-128-mask.png` 的 **shape 通道** =
实体 **112×112px（26.25dp）**、中段 y=40..80 **恒宽 112**、两端各 ~8.4dp 收窄
⇒ **圆角方（⛔ 不是圆）**，且与矢量臂 plate（`round(26×0.30)=8`）**近等形**
⇒ **两臂一致，不是 tint/矢量差异**。（此前一轮的圆/方之争由此定案。）

**单测变更**：不变式由「上沿 = 下沿 + 抬起量」改为「上沿 ≡ **抬起后**珠底轮廓」；
并加**回归锚**：⛔ 上沿必须**低于**「槽底 + 抬起量」—— 删掉 `liftScaleGain` 通道即红
（否则「看起来贴合」但实为假绿）。

**⛔ 未闭（如实）**：影的**横向采样范围 = 槽宽（半宽 13）**，而抬起后珠半宽 **13.52**
⇒ 珠外伸的那 **0.52dp**（落在槽外的 B0 上）**不着影**。若要连它一起着影 ⇒ 采样范围改珠宽、
影会伸出槽外，与「轮廓与槽一致」那条要求冲突 ⇒ **待裁**。

**读数**：beads **769 绿 + 1 skipped** · verify **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** ·
`check:tasks` 26/26 · 定标单 **v0.6** · 对照图 `temp/shadow-preview/r12-lifted.png`。
**封箱未受影响**（影只在抬起格，夹具无选中态）⇒ 不需要第十次复评。

## WXG-T-237

**beads·托盘中性槽样式 + 专属 mask（美术定标单）** — 2026-10-03 用户裁「甲 + 另出中立样式与专属 mask」。

### 起因：托盘槽被矢量算法「焊死」，美术无法设计

用户裁「甲 · 现状保留」后追加要求「**需要美术给我设计一套中性托盘样式，然后做专属 mask**」。
核现状：托盘空槽走 `drawEmptySocket` 的**矢量臂** —— 恒画「4 层同心圆角内阴影 + S3/S4 两线」，
墨档由 **`neutralEndpoints(palette)` 锁死** ⇒ **美术没有任何自由度**。
而盘面格早已改用 tint mask（系数图 = 美术可美术导向的载体）⇒ **两臂的能力不对等**。

⚠ 顺带纠正我上一轮的措辞：我说「托盘槽未传 `maskGauge`/`styleId` ⇒ 不在本批范围」**不准确**
（听起来像漏传）。核完后准确表述是：**托盘槽恒矢量是 §3.6 的设计**（tint 臂的命中条件含
`colorIdx !== undefined`，托盘不传目标色 ⇒ 永不命中 ⇒ 补 `styleId` 是 **no-op**）。
**但「珠随风格、槽不随」这个错配是真的**，只是成因不同（不是漏传参数，是槽压根不接风格系统）。

### 交付面收窄的实测依据

- 托盘三态里只有**空槽（free）**归 mask：**未解锁虚位**是 `drawDashedRect` 合成的虚线框、
  **选中**是抬起 + 状态点/环 ⇒ 两者都是**叠加层**。
- 托盘坑外廓 ≈ **41.3dp** < 托盘珠 **44dp** ⇒ 「有豆时看不到坑」在托盘**同样成立**
  ⇒ 可见面只有空槽态。
⇒ **1 张 mask，不是 2×2 四件套。**

### 交付物：定标单已成文

`games/beads/art/tray-neutral-slot-mask-spec.md`（2953 tok，在 8000 B 门内）内容：
- **§1 工程契约**（美术只需知约束、不必重推）：托盘几何（`TRAY_SLOT 48` / 珠 `44` / 坑 ≈`41.3dp` /
  墨档 `neutralEndpoints`）· 三态归属 · 现有 `kind × gauge` 两轴的关系（**`gauge` 是豆径档轴、属盘面概念**）
  · 画布与预算（canonical 128、≈4.8 KB/张、upscale 阀现为 `null`）· 编码（沿用母体 `R=d/G=l/B=shape/A=255`）
- **§2 交付物 4 项**（T-1 样式 / T-2 系数图 / T-3 墨档表 / T-4 a11y 登记）
  + **7 道待美术裁的题**（Q1 新 `kind` · Q2 画布 · Q3 命名 · Q4 槽底明度 · Q5 坑口圆角 · Q6 斜面受光 · Q7「中性」含义）
- **§3 工程承诺** 6 条 · **§4 验收判据** A-1…A-10 · **§5 边界与风险** B-1…B-6

⛔ **本单不代裁任何视觉**。⛔ **T-2 系数图必须由定稿口径的 py 烘焙**（母体 §0 铁律）⇒
美术交的是**样式定义 + 墨档表**，⛔ 不手绘 d/l 数值。

### ⛔ 三条必须先登记的风险

1. **B-1 唯一结构性代码改动** = 放宽 tint 臂的 `colorIdx !== undefined` 门（托盘无目标色）
   ⇒ ⚠ 开错会让**盘面格在缺 `colorIdx` 时也去查 tray mask** ⇒ 须有**反向守卫单测**。
2. **B-4 托盘槽改 mask ⇒ 封箱必复评**（与 WXG-T-235/236 那两批不同：托盘**每帧都画** ⇒
   静息帧**像素**会变，不是「补画被完全遮住的图元」）⇒ 本单**不是**零复评单。
3. **B-2 `MASK_ID_TABLE` 增维 ⇒ 白名单语义扩大** —— 须明确「中性槽」**不受风格白名单管辖**，
   否则换皮肤会连带换掉托盘（违反 Q7 甲）。

### 领号

领号锚校准至 **WXG-T-237**，下一可用号 **WXG-T-238**。

### 十二轮：影宽裁定核销（用户裁「甲 · 保持现状」）

**争点**：影的横向采样范围 = **槽宽**（半宽 13），而抬起后珠半宽 **13.52**（`liftScaleGain 0.04` 放大 4%）
⇒ 珠外伸的那 **0.52dp**（落在**槽外的 B0 底面**上）**不着影**。

**用户裁定：「甲 · 保持现状（影严格在槽内，符合『轮廓与槽一致』）」。**
裁定理由落在规格上：① 轮廓须与槽一致；② **槽外本就是 B0 底面，不该有影**。
量级：0.52dp 在真机 dpr ≥ 2 下 ≈ **1 设备 px**。

**已落成显式锚（不是「顺带钉住」，而是命名的裁定锚）**：
单测新增腿「**影宽 ≡ 槽宽、⛔ 严格小于抬起后珠宽**」+ 记录珠外伸量
⇒ 把采样范围从「槽宽」改成「珠宽」**即红**，防止后来者「好心」扩大范围（这正是十一轮
「上沿用未放大尺寸 ⇒ 露 0.5dp 缝」那类缺陷的同型风险）。

**封箱**：未受影响（影只在抬起格，夹具无选中态）⇒ 不需要复评。
**读数**：beads **770 绿 + 1 skipped** · 定标单 **v0.7**。

### 范围扩括（同轮用户裁「乙 · 托盘珠也纳入」）

**追加实测（原先只核了槽、漏了珠）**：`drawFilledBead` 的 tint 门**同样含
`options.maskGauge !== undefined`**，而托盘珠调用点（`view-model:1245`）**不传 `maskGauge`**
⇒ **托盘珠现在也走矢量臂** ⇒ **托盘上珠与槽都不碰那 4 张 mask**。
（`styleId: snap.beadStyle` 只用于选**风格层集**，与是否用 mask 无关。）

⇒ **交付面由 1 张扩为 2 张**：**槽 1（中性）+ 珠 1（随风格）**。

**托盘珠实算几何**（`BEAD_CARD.holeRatio 0.44` / `radius 0.30`）：

| | 托盘珠 | 盘面 holed 珠（对照） |
|---|---|---|
| 绘制边长 | **44**（`inset = 0`，满幅） | 26（inset 2） |
| 圆角 | **13dp** | 8dp |
| 孔 | **⌀20dp**（孔边线 1dp 绝对） | ⌀12dp |
| 画布 | 48dp | 30dp |
| 豆径档 | **无** | 随档 |

⇒ ⛔ **不能复用 `bead-holed` mask**（尺寸体系不同）⇒ 托盘珠**必须另烘一张**。

⚠ **本单最易漏的一条：两侧风格语义相反**
- **托盘槽** = 中性 · 全局一张 · **不受风格白名单管辖** ⇒ 换皮肤**不变**
- **托盘珠** = **随风格** · 走白名单（与盘面 `bead` mask 同性质）⇒ 换皮肤**变**（矢量臂也随风格 ⇒ 一致）

⇒ mask 化**不得**改变这两条；验收判据已把 `A-7` 拆成 **A-7a（槽不变）/ A-7b（珠变）** 两条。

**新增两条待裁题**：**Q8** 托盘珠 mask 的风格覆盖数（甲 = 只做白名单当前那一张 `facet-4`；
乙 = 给未来风格预留命名位不出图）· **Q9** 托盘珠孔径（甲 = 按 `holeRatio 0.44` 等比到 ⌀20
= **矢量臂现状、mask 化零观感变化**；乙 = 美术另定 ⇒ 孔径是可辨性主通道，须过 a11y）。

**预算更新**：槽 ≈4.8 KB + 珠 ≈**8.8 KB**（`bead-holed` 实测 8750 B）⇒ **≈13.6 KB**。

**新增两条风险**：
- **B-7 托盘珠 mask 按风格交付 ⇒ 漏烘即静默回退矢量** ⇒ 新增风格若没烤托盘珠 mask，
  该风格托盘珠会回退矢量臂 ⇒ **同一风格两种观感**（与八轮修的「`styleId` 漏传 ⇒ 珠新风格/槽默认风格」同族）
  ⇒ 须有**清单校验**：白名单里每个有 `bead` mask 的风格是否都有 `trayBead` mask。
- **B-8 两侧风格语义相反** ⇒ 若将来有人「顺手」让槽也走风格白名单 ⇒ Q7 甲的语义被推翻
  （且换皮肤时托盘整块变色）。

**新增验收判据**：`A-11`（珠命中 = 恰好 1 blit / ⛔ 0 矢量刻面 polygon）· `A-12`（孔径 ≡ Q9 裁定值）。
定标单 2953 → **4156 tok**（仍在 8000 B 门内）。

### v2.0 范围坍缩：用户裁定「托盘完全随盘面 mask + 缩放」（本节为当前状态）

**用户裁定原文（逐字）**：
> 「**托盘完全随 mask 和格面绘制**，并**在绘制基础上缩放成合适比例的托盘**。
> **格面颜色与托盘底色一致**，**其他规格和盘面绘制保持一致**。」

拆成 4 条可执行口径：**R-1** 托盘槽/珠分别用盘面 `cell` / `bead` mask（⛔ 不做托盘专属 mask）·
**R-2** 按盘面画布比例**等比缩放**到托盘尺寸 · **R-3** 格面色 = 托盘底色（⛔ 两种读法，见 Q-B）·
**R-4** 坑底明度 / 坑口圆角 / 斜面受光 / 孔径比例 / 内阴影层数**全部沿用盘面**。

#### ⭐ 范围坍缩：九道题作废、0 张新资产

| 项 | 变化 |
|---|---|
| 原 Q1–Q9（新 kind / 画布 / 命名 / 槽底 / 圆角 / 斜面 / 中性含义 / 珠风格覆盖 / 珠孔径） | ⛔ **全部作废**（不再有资产可裁，规格全沿用盘面） |
| 原 **B-7**（珠 mask 按风格交付 ⇒ 漏烘即两种观感）· **B-2**（白名单语义扩大） | ⛔ **自动消失**（无托盘专属资产 ⇒ 无「漏烘」概念） |
| 原预算 **≈13.6 KB** | ⛔ **归零**（复用现有 4 张 ⇒ **+0 KB**） |

#### 缩放机制**已具备**

`builder.blit(maskId, x, y, size, size, …)` **本就按 `size` 缩放** ⇒ R-2 只需**把 `size` 传对**，
⛔ 不需要「缩放版 mask」或新采样模式。⚠ 代价：30dp 画布被 blit 到托盘 48dp（×1.6）⇒
高 dpr 大 zoom 下放大更明显 ⇒ 撞既有 upscale 闸（`TINT_LOD_MAX_UPSCALE` 现 `null` 不设限）。

#### ⚠ 两处冻结值会变（`k = 48/30 = 1.6`）

| 项 | 现状 | 改后（画布仍 48） | 变化 |
|---|---|---|---|
| 坑口 | 41.28dp | **24 × 1.6 = 38.4dp** | **−2.9dp** |
| 珠面 | 44dp | **26 × 1.6 = 41.6dp** | **−2.4dp** |
| 边缝 | 2.0dp/边 | **3.2dp/边** | **+1.2dp** |
| 孔径 | ⌀20（矢量算） | **12 × 1.6 = ⌀19.2dp** | −0.8dp |
| 「有豆时看不到坑」 | 41.28 < 44 ✓ | **38.4 < 41.6 ✓ 余量 3.2dp** | 仍成立 |

⚠ 若改为**保住珠 44dp** ⇒ 画布需 `44 × 30/26 = 50.8dp` ⇒ `TRAY_SLOT` **48 → 50.8（+2.8dp）**
⇒ 托盘整块变宽 33.6dp（12 格）⇒ 须复核托盘↔盘面宽度关系、触控命中、面板布局。⇒ 这就是 **Q-A**。

#### 3 道待裁口径题（⛔ 不涉视觉）

- **Q-A 缩放基准**：**甲（建议）** 画布 48 不变、珠缩到 41.6 ⇒ **零冻结值改动**、托盘总宽不变；
  边缝 2.0 → 3.2dp（**自然结果**：盘面边缝比 6.7%，托盘同比例即 3.2dp）。
  乙 保珠 44 ⇒ 画布 50.8 ⇒ **改 `TRAY_SLOT` 冻结值** + 复核布局/触控。
  ⚠ **B-2：若要求「边缝绝对值也一致」⇒ 与 R-2「完全随比例」互斥**，需明说。
- **Q-B ⭐「格面颜色与托盘底色一致」= 同一算法 or 同一像素值**（本单最大分叉）：
  **甲（建议）** 同一**算法**（托盘槽底 = `0.70 × 该槽目标色`，与盘面 `endpoints.edge` 同公式）
  ⇒ ✅ 保判据 **I-5**「孔内 = 透 B0 = 0.70×目标色」与「取放零跳变」；⛔ **托盘不再是中性底**。
  乙 同一**像素值**（盘面格面也改用 `palette.slot #F7F6FB`）⇒ ⛔ **盘面失去 per-cell 目标色底**
  ⇒ **判据 I-5 失效** + 「取放零跳变」前提被抽掉 + `assets-spec` 大量条款连带改。
  ⇒ **甲把改动限制在托盘内；乙会动全盘并使既有判据失效。**
- **Q-C** 若 Q-B 甲：托盘**面板底色**要不要一起改？甲 面板不动（接缝色差需目检 `[待真机]`）·
  乙 面板底改为 `0.70×目标色` ⇒ 面板是 **12×N 共用一整块** ⇒「目标色」取哪一个**未定** ⇒ **工程无法落地**。

#### 工程侧保留的技术工作

1. 托盘两个调用点补 `{ maskGauge: 'holed', styleId: snap.beadStyle }`（无 gauge 轴、满幅恒有孔 ⇒ 恒 `'holed'`）
2. ⛔ **唯一结构性改动**：放宽 tint 臂的 `colorIdx !== undefined` 门（托盘槽无 per-cell 目标色）
   ⇒ 须配 **A-4 反向守卫**（盘面格缺 `colorIdx` 时⛔ 不得命中托盘 mask）
3. 托盘槽的合成 base 按 Q-B 取
4. **封箱必复评**（托盘每帧都画 ⇒ 静息帧**像素**变 ⇒ 非「补画被遮住的图元」）
5. a11y 只登记影响面

#### 文档同步

定标单重写为 **v2.0**（2953 → **3311 tok**，B 门内）：§0 裁定逐字 + R-1…R-4 拆解 +
**§0.1 范围坍缩表** · §1 工程事实（画布比例 / 托盘现状 / **§1.3 两处冻结值变化表** / 缩放机制已具备）·
§2 **3 道题** · §3 工程承诺 · §4 判据 A-1…A-13 · §5 风险 B-1…B-7。
母体规格 §1.1 的 `+9/+10` 两行已标 ⛔ **作废**（并指向 v2.0 §1.3 / Q-A）。

#### 读数

定标单 **3311 tok** · verify **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** · check:tasks **27/27**。

### v3.0：缩放模型改为「按盘面 32dp 布局 + 整体缩放」（本节为当前状态）

**追加裁定（2026-10-03 用户原话）**：「**托盘还是按照 32dp 布局格面，然后整体缩放适配左右距离**」。

**布局常量**：`BEAD_PITCH = 32` · `BEAD_CELL = 32 − BEAD_GAP(2) = 30` · `TRAY_COLS = 12` ·
`TRAY_GAP = 6` · `TRAY_PANEL_PAD = 12` · `DESIGN_W = 750`。

**缩放公式**：`s = rowWidth_avail / (TRAY_COLS × BEAD_PITCH − TRAY_GAP)`，`rowWidth_avail` = 现状行宽 642dp
⇒ **`s = 642 / 378 = 1.6984`**。

| 项 | 现状（矢量臂 · 槽 48） | v3.0（32dp 布局 × s=1.6984） | 变化 |
|---|---|---|---|
| **总宽 rowWidth** | 642dp | **642dp** | **0（刻意保住）** |
| panelW | 666dp | 666dp | 0 |
| pitch | 54dp | 54.35dp | +0.35 |
| **格面** | 48dp | **50.95dp** | +2.95 |
| **珠面** | 44dp | **44.16dp** | **+0.16 ⇒ 视觉基本不变** |
| **坑口** | 41.28dp | 40.76dp | −0.52 |
| **孔** | ⌀20（矢量算） | ⌀20.38dp | +0.38 |
| **边缝** | 2.0dp/边 | **3.40dp/边** | +1.40 |
| 「有豆时看不到坑」余量 | 2.72dp | 3.40dp | 仍成立 ✓ |

⇒ ⭐ **关键收益**：珠面从 v2.0 的「缩到 41.6（−2.4dp）」**回到 44.16 ≈ 现状 44**
⇒ **托盘视觉基本不变得以保住**，同时几何来源完全改为盘面比例。
**v2.0 §1.3「画布 48 ⇒ 珠缩 2.4dp」的结论已被本裁定取代** ⇒ **Q-A 的旧二选一作废**。

**Q-A 改写为「格间距口径」**：**甲（建议）** 保留 `TRAY_GAP 6` ⇒ 自然宽 378 ⇒ `s = 1.6984` ⇒ 珠面 **44.16**
（≈现状 44）；乙 改用盘面 `BEAD_GAP 2` ⇒ 自然宽 382 ⇒ `s = 1.6806` ⇒ 珠面 43.69（−0.31）。
⇒ **两案视觉差异 < 0.5dp**。甲 论据 = 托盘是独立于盘面的控件、`TRAY_GAP` 语义不必动；
乙 论据 = R-4「其他规格和盘面绘制保持一致」。

**新增 Q-A2「缩放真源怎么钉」**：**甲（建议）** `s` 由**现状 rowWidth 642dp** 反算 ⇒ 托盘总宽不变
⇒ 布局 / 面板 / 命中 **零改动**；乙 `s` 由 `TRAY_BAND` 宽度实时算 ⇒ 更自适应但 `s` 随屏宽变
⇒ 触控命中与面板须同步改（工程面更大）。
⇒ 甲 ⇒ `TRAY_SLOT` / `TRAY_BEAD_SIZE` **退居派生量**（= `BEAD_CELL × s` / `26 × s`），
冻结常量表须标注（`systems-index §3`，⛔ 工程不代改）。

**⚠ B-2 仍成立**：**边缝由 2.0 → 3.40dp/边**（盘面边缝比 6.7%，托盘同比例即 3.40dp）。
**「边缝绝对值一致」与「完全随盘面比例」互斥** —— 若要 2.0dp 就不是「完全随比例」⇒ 需用户明说。

**读数**：定标单 **3892 tok**（B 门内）· verify **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** · check:tasks **27/27**。

### v4.0：托盘 1:1 格面已落码（本节为当前状态）

**用户裁定**：「**先按照 1:1 的格面实现效果，不做缩放。开始实现**」。

**四处落码**（详见定标单 §6）：
① `tuning` 托盘三常量改由**盘面常量派生**：`TRAY_SLOT = BEAD_CELL`（48→**30**）·
`TRAY_GAP = BEAD_GAP`（6→**2**）· `TRAY_BEAD_SIZE = TRAY_SLOT − 2×BEAD_DRAW_INSET`（44→**26**，
语义改为「绘制边长」而非 `drawFilledBead` 的 `outer`）⇒ `pitch` 54→**32** = `BEAD_PITCH`、
12 列行宽 642→**382**（−260 ⇒ 托盘整块变窄居中，左右留白大增 = 「不做缩放」的直接后果）。
② 托盘**槽**接线 `cell` mask：`maskGauge:'holed'` + `styleId` + `trayZone:true` +
`beadInset = BEAD_DRAW_INSET` ⇒ 坑外沿 ≡ 珠面轮廓（**与盘面同一恒等式**）；`tilePainted = false`（托盘无 B0 底图）。
③ 托盘**珠**接线 `bead` mask 且**与盘面珠同参**：`outer = TRAY_SLOT(30)` + `targetColorIdx` +
`drawInset = BEAD_DRAW_INSET` ⇒ 珠面 **26 = 盘面珠面**。
④ **唯一结构性改动**：`drawEmptySocket` tint 门 `colorIdx !== undefined` →
`colorIdx !== undefined || options.trayZone === true`（托盘空槽无目标色 ⇒ `base = palette.slot`）。

**⚠ ③ 的「同参」是必须的**：`drawFilledBead` 的 `inset` **只在 `targetColorIdx !== undefined` 时生效**
⇒ 不传则矢量臂按满幅 30 画、tint 臂按 26 画 ⇒ **两臂不同形**（与八轮修过的「`styleId` 漏传」同族）。

**实测**：托盘槽渲染出**与盘面一致的圆角方槽**（内阴影 + 受光缘）· 2 行 × 12 = 24 槽 ·
行宽 382dp（panelW 406）· pitch 32 · 格面 30 · 珠面 26 · 坑口 24 · 孔 ⌀13.2。
效果图 `temp/shadow-preview/tray-1to1-zoom.png`。

**封箱：第十次复评已落**（官方复取器）：
- `frame78` **total 1877 与逐 kind 全部不变**（rect 1007/circle 160/line 376/text 12/polygon 322）
  **仅 sha 变**（0b3f083e→27a4ae91）⇒ 托盘几何变化**只改命令内容、不改命令数量**
  （托盘槽/珠的图元数与盘面同构）。
- `frame0` total 1331 不变、仅 sha 变（11d95ead→73ace06a）。
- `facetNonHoleLayers` 45/45、`facetHoleLayer` 45/45、`fixture.*` 全等。
- ⛔ `legacyFlow` 96 例不全等 —— **合法且可归因**：复取矩阵含 `TRAY_BEAD_SIZE` 案
  （`bead-style-seal-recapture.ts:113`），托盘珠几何正是本批裁定要改的 ⇒ **不是珠体回归**
  （盘面 `BEAD_CELL` 案全部不变）。
- 归因键 `provenance.s3_frame_recheck_10`（2825 字）。

**测试口径变更（三处）**：
① `bead-render.test.ts` ③「托盘珠恒满幅」**前提被裁定推翻** ⇒ 改写为「**托盘珠 1:1 与盘面珠同尺**」
（`bodyW(tray) ≡ bodyW(board)` + 反向守卫 ⛔ 不得退回满幅）；
② `pause-settings.test.ts` 托盘点**返回值断言移除**：1:1 后槽位居中（`x 78→199`、`y 414→423`，实测）
⇒ 该点落入**暂停面板按钮行** ⇒ `tapDesign` 返回 true 是「面板钮响应」（PAUSED 允许行为），
改以**事件**为准（`tray:selected` 不新增 = §8 口径，比返回值更硬）；
③ `bead-tint-arm.test.ts` 新增 **`trayZone` 反向守卫**两条。

**⛔ 仍未闭**：**Q-B**（「格面颜色与托盘底色一致」的两种读法，本批先保 `palette.slot` 中性底）·
**Q-C**（面板底要不要随 Q-B 一起改）· `systems-index §3` 冻结表标注（⛔ 工程不代改）·
`TINT_LOD_MAX_UPSCALE = null` 的高 dpr 压力未复核。

**读数**：beads **772 绿 + 1 skipped** · verify **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** ·
check:tasks **27/27** · 定标单 **v4.0**（5107 tok，B 门内）。

### v5.0：托盘底 = 格底已落码（本节为当前状态）

**用户裁定**：「**托盘底色与格底色保持一致，托盘格子保持紧凑排列**」。

**四处落码**：
① `BeadsSnapshot` 新增 **`mainColorIdx`**（关卡主色 = 可填格目标色的**众数**，平票取首个；
`0` = 全盘无可填格）—— 在 `_syncSnapshot` 里**随 cells 同循环一次算好**（⛔ 视图不得重算，热路径规则）。
② 托盘**面板底** = `endpointOf(inks, snap.mainColorIdx).edge`（= `mix(主色, −0.30)`）
—— 与盘面格底**同一算法同一档**，实测逐位同值（`#964763` lum 97.8 ≡ 盘面格底 `#954763` lum 97.5，同 0.30 暗化档）；
`mainColorIdx 0` ⇒ 回退 `palette.panel`（中性兜底，不猜色）。
③ 托盘**空槽**坑基色 = 同一 `mainColorIdx`（端点族整体走彩色族，与盘面格的坑同源）；
`trayZone` 仍保留（兜底路径用，命中链不回归矢量臂）。
④ **紧凑排列 = 维持 pitch 32 / gap 2**（1:1 盘面口径）—— 无需改动。

**⚠ 预览误导实录（已纠正，留档）**：
甲案首版预览把主色取成 `snap.cells[0].colorIdx` ⇒ 那是**背景格** ⇒ panel 落 `#24242B`（lum 36.8），
比格底（97.5）**暗 60 lum** ⇒ 出图「托盘近黑」，我据此刻了「甲 = 托盘进暗色系统、层次消失」的判断
—— **该判断建立在错误取色上**。改众数后实测 `#964763`，与格底逐位同值 ⇒
「一致」的真实效果 = 托盘与盘面**同一暗紫红材质**，槽口仍可辨（行内 lum 极差 49.3：槽口 50 / 面板 99）。
⇒ **教训：预览取「代表色」必须先验证它真的是画面上的那个色**（差 60 lum 的错，量化一步就能发现）。

**封箱：第十一次复评已落**（官方复取器）—— **十一次里归因最干净的一次**：
- `frame78` **total 1877 与逐 kind 全部不变**（rect 1007/circle 160/line 376/text 12/polygon 322）
  **仅 sha 变**（27a4ae91→3ac8657b）⇒ 托盘底变色**只改 fill 内容、不改命令数量**。
- `frame0` total 1331 不变、仅 sha 变（73ace06a→969e4468）。
- **`legacyFlow` 96/96 全等** ⇒ **珠体零变化**（主色只影响托盘底/空槽 fill，不碰珠体渲染）。
- `facetNonHoleLayers` 45/45、`facetHoleLayer` 45/45、`fixture.*` 全等。
- 变化面 = 托盘面板 rect 的 fill + 空槽 blit 的 tint fx，逐类可数。
- 归因键 `provenance.s3_frame_recheck_11`（1844 字）。

**新增测试**（`selection-anchor.test.ts`「托盘底 = 格底」3 条不变式）：
① 面板 fill ≡ 主色 edge（同一算法同一档）· ② 主色 ≡ 众数（`cells[0]` 是背景格，钉死众数口径）·
③ `mainColorIdx 0` ⇒ 回退 `palette.panel`。

**⛔ 未闭**：**Q-C 余项** —— 托盘上的彩色控件（满槽告警 danger 描边等）在新暗底上的对比度未复核
`[待真机]`；**关卡切换时托盘跳色**是否要淡入未裁；异色格色界平移 0.5px 观感确认（T-235 遗留）仍未做。

**读数**：beads **772 绿 + 1 skipped**（含新增 3 条）· verify **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** ·
check:tasks **27/27** · 效果图 `temp/shadow-preview/v50-final.png`。
