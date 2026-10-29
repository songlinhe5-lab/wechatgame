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
- **标准正本**：`games/beads/design/art/specs/cell-standard.md`（§1 基准口径 / §2 确认值表 / §3 判据 J1–J7 / §4 变更纪律：改值须调研对照图+面积账（含圆角修正，方角近似不认）+原因说明+文档判据同批+台账登记 / §5 明确不做：颜色辨识度与相邻格可辨单开话题，J2 标注为代理指标非感知标准）。
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
  - `games/beads/design/art/specs/` **16 份品牌 JSON 合计 2104 色**（artkal-a 145／c 174／m 220／r 89／s 210／diamond-dotz 461／mard 291／hama-maxi 25 …）
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
  - **修订面（三处）**：`s3.facetHoleLayer` 45/45 重取（**键形不变、语义变** = #6 HOLE_RING + #7 HOLE 两枚串联，互异 sha 15→39）· `s3.frame0 = 971/53139dd…` · `s3.frame78 = 1211（circle 160）/e5c00786…`；`head.*` / `s3AtFormalization` / 非孔 45 例 / `s3.legacyFlow` / `fixture.*` **逐键全等未动**（写入脚本内 assert，非口径转述）；provenance **追加**新键 `s3_frame_recheck_5`（含变更源逐条 + 流级差分账 + 上游批自封失效）。
  - **b2 流级差分（逐条比较，未解释 0 条）**：`frame0 970→971` = 全等 783 + 改写 187 + 插入 1（五裁字段级 180 条 + WXG-T-217 控件带）；`frame78 1126→1211` = 全等 695 + 改写 431 + 插入 79（六裁 `circle/stroke ×78` 环 + WXG-T-218 polygon 重写 312 + 五裁 102 + 控件带）；**逐 kind Δ** = `rect +1 / circle +78 / line 0 / text 0 / polygon 0 / total +79`，与上游登记逐项对账。
  - **判据仓裁（只加不减）**：文件头四条腿口径改写 + 新增「唯一例外通道」注块；腿 3 标题改两枚串联 + **6 条键形自证**（层集长 7 / `slice(5)` 长 2 / 环 stroke-only 无 fill / 底无描边有 fill / `size=26` ⇒ 真透 ⌀12、外缘 ⌀14 / `recheck_5` 必含「第五次复评」+「HOLE_RING」）；「差分自洽」例 `circle` 桶 `78×−1 → 78×0`、纸面锁 `1127 → 1211`、新增 `kinds.circle = 160`；腿 4a/4b 标题与登记在案校验收紧。零删断言 / 零阈值软化 / 无 env 后门，用例数 9→9。
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

### r9+ 批 C（限色口径 = N 或 N−1）

- **用户拍板**：限色设定 N ⇒ 实际用色 ∈ {N, N−1}，不允许其他结果。
- **bug1（超限根因）**：`separateAdjacent`（相邻 ΔE 去噪，默认 minadj=20 生效）在全色板取色 ⇒ 复活禁用色（实测 4→8、8→9）。修复：加 allow 白名单，调用点传 allowSet。
- **bug2（候选缩水）**：k-means 簇吸附品牌色去重后 kept 可能 << N。修复：每簇贪心取最近未占用品牌色 ⇒ 候选 = N 或 N−1。
- **用色保底**：终段把 0 格候选择优落 1 格（代价 Lab² 最小），ΔE>25 弃置；弃置欠额 report.colorShortfall 标注（源图可达色数不足 = 图像极限，不强塞）。
- **验证**：4→3 / 8→7 / 12→10（欠额=图像极限）· mis=full 回归正常。studio 独立 spawn 无需重启。未 commit。
- **追加 6（终式，用户拍板）**：版面渲染定式 = **合成图纹理填充**——盘面内格先铺「格图合成」（grid base+mask × 格色），有豆叠「拼豆合成」（bead base+mask × 珠色）；空位不画；平色垫退役。与运行时渲染结构同构（B0 格底 + 珠）。
- **甲/丙终调（同日）**：甲 D1（暗底 pit + 偏置环 2dp）左上壁 142 / Δ83 / 合成最暗 154；**丙 D2（conic，角度收窄 ±36° + LMAX 0.85）左上壁 142 / Δ94 / 合成最暗 106 ⇒ 深度与方向双超甲**；D3（3dp 同参）Δ90、暗壁更厚。宽度 2dp/3dp 两档均已出图（mask 侧纯几何，不受 C7 约束）；⚠ 2dp 在 dpr1 仅 0.5 物理 px ⇒ 建议 3dp 起步或加 dp 地板，真机 A/B。
- **验证态（r9）**：beads 全量 732/4（seal 0 红）/ tsc 0 错 / `check:links` / `check:tasks` 绿（终跑见收口段）；⛔ 未 commit / 未 push。

## WXG-T-224 · ctx hot-files 收录瘦身（test-cases 锚点摘要只留高频节）

> **状态**：✅ 已结案（2026-10-25 主理人重估；09-29 的 quality-lead 裁定「④ 规则 R + P1」已落码并实测达标 ⇒ 无剩余施工项；用户当日选 T-225 收尾第 1 项）
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

### 结案重估（2026-10-25，主理人）

**触发**：WXG-T-225 判据分片落库（`bf22ef5`）后，本单唯一收益点「hot-files 内 test-cases 锚点摘要」的题面前提已变 ⇒ 按新事实重估（用户 2026-10-25 在 T-225 收尾三选项中选 1）。

**新事实读数**（`ctx/hot-files.md` @ `bf22ef5`，与生成器同一 `estimateTokens` 口径逐块实测）：

| 项 | 09-29 裁定基线 | 2026-10-25 实测 | 说明 |
|---|---:|---:|---|
| hot-files · QA 判据块 | 1412 tok / 27.9% | **423 tok / 7.6%** | = 79（索引页）+ 127（a-core）+ 117（a-input）+ 100（b-f） |
| hot-files · 单块最大 | — | 280（systems-index） | 前三 = systems-index 280 / control-manifest 278 / art-bible 261 |
| hot-files 全表 | 5062 / 5150 | 5552 / 5600 | 36 个文件块 + 390 tok 表头 ⇒ **A 项余量 48** |
| 常驻总量 | 14669 | **15343** | = ROUTES 7217 + hot-files 5552 + AGENTS 1837 + rules 737 |

⚠ **归因纪律（K-046 注 10 同型，不得双计）**：423 的降幅来自 **09-29 已落码的规则 R**（只收 L1/L2 + ROUTES 锚点例外），**不是分片的贡献**；分片反向多花 ≈60 tok（3 个新文件头）。与 WXG-T-225 详情节「拆分不减 hot-files 体积」的诚实边界一致。

**三案逐条处置（全部维持 09-29 裁定，无翻案）**：

1. **① 手裁节 → 继续否决**：仅省 178 tok，而被裁 L3 的父节体量 9.5k–15.7k ⇒ 单次读膨胀直接撞 B 项 8000，ROI 为负、且新增手工名单维护债；
2. **② 降收录门槛 → 继续否决**：`tier:hot` 6 件 + ROUTES 引用文件强制收录 ⇒ **可选池 = 0**；T-225 后 ROUTES 引用的 3 个分片仍属强制收录，池仍为空；
3. **③ 接受不裁 → 不作终态**：其实效已由规则 R 代替（现 48 tok 余量、A 项 ✅）；
4. **④ 规则 R + P1 → 已落码生效**，本单据此结案。

**结论**：交付面（P1 标题层级修正 + 规则 R 节级裁剪）全部落地且 10-25 实测达标，**无剩余施工项** ⇒ 结案。以下三笔**移出本单**：

- 「拆 test-cases.md 另立单」（上方「未执行（挂账）」第 3 项）→ **已由 WXG-T-225 完成**（`bf22ef5`，13 片 + 撤销 B 项豁免）；
- P2（index.json 2.23MB 与「≈195k」文案失真）/ P3（T-211 注记订正为「可选池已空」）→ 仍未动，随下一次 ctx 单处理（不在本单重开）；**（后记 2026-10-25：已由 WXG-T-378 闭合 —— P2 六处口径与取节配方、P3 经核 09-29 已订正，详见 `## WXG-T-378`）**
- 常驻总量 **15343 > 13500** → 入 `production/TASKS.md` §待排（backlog 一行）；`test-cases.md` 现为纯索引页、已无判据正文，是否仍留在 `HOT_FILES` 必收 6 件 → 下一轮 ctx 单评估（省 79 tok，属协议面而非 QA 面，本轮不动）。

## WXG-T-225 · 拆 `production/qa/beads/test-cases.md` 判据分片（撤销 WXG-T-084 的 B 项豁免）

> **状态**：✅ 已完成（2026-10-25；2026-09-29 立，来源 = WXG-T-224 的 quality-lead 裁定移交项；施工口径 = quality-lead 拆法裁定 + 用户 2026-10-25 选「§K 甲（标题层级提升）」与「一次做完」）
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

### 裁定（quality-lead，2026-10-25）

- **阈值**：判据件硬阈 **16,000 tok**（`production/qa/**` 归 ledger 档，≠ spec 的 8,000），施工目标 **≤14,000**。否决 8,000 的理由：变更记录单节即 9.4k、§A4/A4b/A4c 必须同片，硬切会造出 5–6 个「半节」文件。
- **切分**：**13 片** = 索引页 + 12 片；§K 按台账切 3 片（style / ledger-1 / ledger-2），切点 = K.4 末（L748|749）、第 2 次补登末（L811|812）。
- **§K 前置**：26 个块首伪标题（`> ### K.x` / `> **K.x 标题**`）必须先提升为真标题，否则三片零锚点。
- **锚点**：逐处改路径，⛔ 不建 stub（stub 会造成 D3-U1 假绿）；`check:links` 不是锚点门，真凭据 = `ctx:check` 的 D/D2/D3。
- **撤豁免**：判据 = `ctx/budget-exempt.json` 中该 path **零命中**；「过期豁免只记 note」不算撤销。

### 施工（2026-10-25）

| # | 文件 | 内容 | tok |
|---:|---|---|---:|
| 1 | `test-cases.md` | 索引页（§分片索引 / §锚点迁移表 / §引用与追加规则） | 3485 |
| 2 | `test-cases-a-core.md` | §A 头 + §A.0 / A.0b / A1–A3 | 4949 |
| 3 | `test-cases-a-input.md` | §A4 / A4b / A4c / A5 | 11941 |
| 4 | `test-cases-b-f.md` | §B–§F | 5359 |
| 5 | `test-cases-g-perceptual.md` | §G | 9670 |
| 6 | `test-cases-h-i.md` | §H + §I | 5740 |
| 7 | `test-cases-history.md` | 变更记录 + §J | 9519 |
| 8 | `test-cases-k-style.md` | §K 头 + K.0–K.4 | 7238 |
| 9 | `test-cases-k-ledger-1.md` | K.5 台账前段（至第 2 次补登） | 9149 |
| 10 | `test-cases-k-ledger-2.md` | 第 3–11 次补登 + K.6 / K.7 | 13585 |
| 11 | `test-cases-l-tint.md` | §L | 1192 |
| 12 | `test-cases-m-menu.md` | §M 头 + M.1–M.9 | 11261 |
| 13 | `test-cases-m-gate.md` | §M.10 / M.11 / BD-61 / §N / §O | 6286 |

- **§K 标题提升**：`> ### K.x` → `### K.x`；`> **K.x 标题**尾文` → `### 标题` + `> 尾文`；`K.1a` 降一级为 `####`（H4 不进索引）。零丢失校验 = 去标记后字符流逐字相等（157,700 字符）。
- **正文搬迁**：零改动零删除；校验 = 12 片正文逐行对比 `HEAD + §K 提升`（12/12 全等，1180 行）。
- **索引页**：迁移表只到 § 级且 ⛔ 不写 `K.5.1-补N` 字面（避免给 seal 测试造 substring 假绿）；版本行 v1.24/2026-10-22 → **v1.25/2026-10-25**。
- **机器依赖**：`bead-style-seal.test.ts` 的 `qaDoc()` 由单文件改为 `test-cases*.md` 集合拼接（qaAnchor 落在任一分片即在案，断言强度不变），失败文案同步。
- **引用面**：`ctx/ROUTES.md` §1.5 七行（行数不变）+ L90 反模式行；
- **文档引用 9 处**：art `final/README.md`、`docs/architecture/ui-architecture-beads.md`、`knowledge/lessons/criteria.md`、`assets-spec.md` ×2、`art-bible.md`、`menu-layout-implementation-spec.md`、`smoke-tests.md` ×3、`wxg-t-228-tint-criteria.md`。

### 验证

- `pnpm run check:tasks` **OK**——主表 99 行 ⇔ 详情 99 节，归档 184 成对。
- `ctx:build --staged-blobs` → **490 文件 / 6985 节**；`ctx:check --staged` **OK**（A/B/C/D/D2 + E3 全过）。
- A 项：`ctx/hot-files.md` **5552 / 5600** ✅；常驻总量 **15343** > 软阈值 13500（观察哨 WARN，不阻断）。
- `ctx/budget-exempt.json` **53 → 52 条**，`production/qa/beads/test-cases.md` path **零命中**。
- `npx vitest run tests/bead-style-seal.test.ts`（beads）= **12/12 passed**（读取面改集合后零降级）。
- 全量 `pnpm run verify`（22 项，不短路）：**PASS 20 / FAIL 2**。
  - `test`（exit 1）：beads **6 failed / 1255 passed / 3 skipped**，名单 = `difficulty.test.ts` 3 条（EP12-S5 §5.1 逐值 / DI 序 / Spearman）+ `ui-golden.test.ts` 3 条（level-select / level-select-mid / sprint-settle）。**归因 = 并发在制 level 数据**：工作树 `L00001.json`（time 46→30、pattern 两次改行）与 `levels-data.ts`（同源两处）为另一会话未完成改动（K-045）；干净检出（`git worktree` @ `HEAD`）复跑 beads 全量 = **1261 passed / 3 skipped / 0 failed（104/104 文件）**，两个红文件单跑 23/23 passed ⇒ 非本批引入。
  - `selftest:fast`（exit 1）：内嵌 `ctx:check` 0.6s exit 1，**红因 = 未提交态**——`ctx:check` 默认模式按 HEAD blob 比对，本批 24 个被索引 .md 尚未提交 ⇒ C 项逐件报过期（结构性，非缺陷）。同内容用 pre-commit 同款 `ctx:check --staged` 已验 **OK**（见上条）；提交后即收敛。

### 遗留

- 12 片均为 `tier:normal`（仅索引页仍 hot）⇒ 若某片被裁撤，ROUTES 会经 D2 报红（预期行为）；`tier:hot` 集合是否随分片重定，留给下一轮 ctx 单。
- 索引页 tokens 列为估算值（不计入门禁）；超 16k 须人工看 B 项，新一轮新增判据后需回写。
- `smoke-tests.md` 的 `test-cases-m-menu.md §M.0` 为历史悬空锚点（原 `test-cases.md §M.0` 本就不存在），本轮只改文件路径、不造节。
- 拼图/切点依赖行号：若后续在 §K 前段插节，三个 K 分片的切点需重算（索引页 §分片索引 为准）。
- `production/qa/test-cases.md`（非 beads）与本次同名不同件，未动。

### WXG-T-226/227/228 · 豆面格面正式管线（三专家并行，2026-09-29 回传）

> 触发：主理人「根据最新盘面设计，指定专家实现最新豆面和格面」；按 `wxgame-orchestration` 诊断 = **阶段 5（制作）**，路由三成员并行 spawn。

**程基岩（226）** — 方案落盘 `production/plans/wxg-t-226-tint-pipeline-plan.md`（522 行 / 14 节 / EP-12 八 Story + 提议 ADR-0029）。三条决定性工程事实：
① **Cocos 侧目前没有纹理载体**（`Graphics` 不能画 image、`blit` 在 Cocos 静默跳过）⇒ tint 在生产通道尚未成立，推荐整盘单图元 + 自定义 effect（+1 draw call / +2 三角）；
② **Canvas2D 两路合成走不通**（`drawImage` 只吃 RGB，`l` 在 G 通道取不到）⇒ 务实解 CPU 预合成 + LRU(12)，该侧不享内存消解收益；
③ mask 生成**不是改 recipe 返回类型**，须新增 `MaskSpec`（纯数据）+ 场计算（core 纯数学）+ adapter 落盘三层。
包体实测：4 mask 18.8KB + 4 base 6.2KB = **25.0KB = 主包 0.61%**；⛔ `control-manifest §19` + ADR-0027 §5-2 两道前置未解除 ⇒ 现在不得投放。

**林绘澄（227）** — 资产规格 `games/beads/design/art/specs/tint-mask-asset-spec.md`（352 行）。可访问性：二重编码仍成立但被区域压缩（珠面明度档 8→6；holeless 空槽 5 档/坑底 4 档 ⇒ 小豆档欠账加重）；**发现最高优先 D1**。

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
- **搭车补登记的存量漂移（非本批）** = frame0 `971→1331`（**+360**）、frame78 `1211→1409`（**+204**），来源 = `731100c`（用户 2026-09-28 裁定「槽内一周内阴影」把 `drawEmptySocket` 由「S2 坑底 rect + S1 暗缘框 rect」2 枚改为**内阴影阶梯 4 枚** ⇒ 每空槽 +2 rect）。两式独立吻合：`+360 = 2×(156 盘面空槽 + 24 托盘槽)`、`+204 = 2×(78 + 24)`。该批**未走复评通道** ⇒ 纪律缺陷开单 **WXG-T-230**。

**C12 退化登记（如实，不软化）**
- 甲案后**认定域（facet 族）内再无任何一层使用 `base`/`edge` 端点** ⇒ 参赛端点色由 3 枚降为 **1 枚（`lit`）**：argmax 由 `edge 25.2%` 变 `lit 25.0%`，`base` 占比 `24.7% → 0.0%`（最大偏离 `0.2pp → 25.0pp`）。
- `TC-STY-10` 臂 B 的「调小占优层 ⇒ argmax **让位**」在 1 枚参赛色下**结构上不可能** ⇒ 旧断言由反证退化为恒红。本轮改为断言两个仍可观测量（占优层**占比必降** 0.2499→0.0011 · `facetPx` 必降 8435→6334），两者同被「恒返写死值」的实现违反。
- ⛔ 弱读法口径（断言 = ∈ base 同族）**未放宽**，但**不再覆盖 argmax 跟随性** ⇒ 等价证明需工具侧新增「换墨反证」臂，列入 **WXG-T-230**。
- **主理人补的机械门（K-035：注释不是守卫）**：臂 B 内加一条「参赛端点色数 = 1」实算断言（数常门分布表中未标「非端点不参赛」的条目）⇒ 将来恢复 ≥2 枚时**本条必红**，强制回改「让位」强反证，不会静默停在弱档。

**复跑读数（如实）**
- `pnpm --filter @wxgame/beads run test`：**732/736 绿**，剩 **4 红 = 关卡存量**（`levels` / `misplaced-assembler` / `levels-dir-pipeline` / `level-import`，LEVELS 8 vs 9，**无专单**）。
- `tsc --noEmit`：**0 错**。本批 11 红**全部转绿**。

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

---

## WXG-T-227

**beads·tint mask 资产规格（入库/命名/包体预算/双档位）** — 林绘澄（art-director），P1。

> ⚠ 本行由主理人（CodeBuddy）于 WXG-T-229 批次代补；正文正本 = `games/beads/design/art/specs/tint-mask-asset-spec.md`（352 行 / 9.4k tok）。
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

---

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
3. `mask:diff` **未挂进 `verify`**（容差为方案件 §4.3 的**建议值**，原文标注「落码前与 QA 对齐」；本批实测已达逐字节一致 ⇒ 门禁按更严的逐字节判）。挂载与否待主理人裁定。**〔已结：WXG-T-230 续批（下方「mask 三方对齐」节）已恢复挂载并全绿〕**
4. **K3 判据文本**在 tint 臂下不逐字成立（透出的是 B0 tile `edge` 而非 `pit`）⇒ 仍挂 **WXG-T-230 / T-228**，本批未代改。
5. `mask-field.ts` 逐式复刻 PIL 12.2 的实现细节（取整/椭圆状态机/LANCZOS 定点）—— 漂移面收敛为「py 与本模块的平台/版本差异」一处，⚠ 若 py 侧升级 PIL 版本需重跑对拍。
6. `blit` 第 6 参签名变更（位置式 `alpha` → 选项对象）：仓内仅 1 处调用已同步，⛔ 外部调用方需按编译期报错适配。

### mask 三方对齐 + `mask:diff` 复绿挂载（程基岩，WXG-T-230 续 · 用户已拍板执行）

**① 三方核对表**（开工实测，非采信汇报；探针 = md5 + 像素读数 + `mask:diff` 数值 diff）

| 维度 | py 代码（`export-cocos-textures{,-holeless}.py`） | 现役产物（`games/beads/cocos/assets/textures/`，258 批改名） | TS spec / field |
|---|---|---|---|
| 槽底 R | 有孔 0.70（`int(0.70*255)`，v1.1 已在码）｜无孔 0.32 | 有孔 **178**｜无孔 **81** | `slotFloorD` 0.7 / 0.32 ✓ |
| 格外 R/B | 0.70 / B=0（237 v7.0 起） | **178 / 0** | `outsideD` 0.7 ✓ |
| 格面 B 结构 | 128 空间直接判定：有孔＝3dp 环带（`sd8<=0 & sd8>=-3dp`）／无孔＝槽口内整块 | 实测有孔槽底 B=0、环带 B=255；无孔槽底 B=255 | `mask-field.ts::cellShapePlane` 已同构分叉（`ringOnly = gauge!=='holeless'`） |
| py 输出 vs 现役产物 | 四件套 md5 **逐字节一致**（grid-hole = `8e2deda1…`，恰为 258 定标单记载新 md5） | 同左 | — |
| py vs TS 数值 diff | 四件套 R/G/B `mean=0.0000 max=0` | 同左 | — |

⇒ **真正的漂移只有两处、都在「断言/注释」层**：`mask-diff.mjs` I-4 断言停在 237 v7.0「槽底 B=255」旧口径（对有孔档必红）；py 头注/行内注释混着 v1.0（坑底 0.32、槽底 0.56、孔缘 0.5dp）旧字。**像素行为三方本就一致，无设计口径漂移。**

**② 定标矛盾核清（结论：非矛盾，无需停下回传）**
- 查证 WXG-T-258 定标单（v10.0）原文：用户裁定「两张图的格底应该是透明，可以和纯色底混合」⇒ 有孔档 shape 只留 3dp 环；且定标单**明文**：「128 空间判定改 `(sd8<=0)&(sd8>=-EDGE_DP*pxs)`（⚠ **512 空间那笔被它覆盖，改它无效**——首轮重跑 md5 一字不变才发现）⇒ 新 md5 `8e2deda1`」。
- 查证 WXG-T-237（v7.0）原文：格面 B 在 128 空间直接判定（当时槽内 255）⇒ 已被 258 对**有孔档**取代；无孔档 258 明文不跟随（I-5 分叉）。
- ⇒ py 头注「[WXG-T-258] 格底与格外 B=0」与 py 代码 L292「槽底 B=255」**不构成口径矛盾**：L292 是被 128 空间覆写的**死笔**（留笔仅为 git 溯源对齐 258 批 md5，删与不删产物逐字节不变——本轮已实测验证）。

**③ 改动面**（全部未 commit；未触碰并发会话文件）
| 文件 | 改动 |
|---|---|
| `tools/mask-preview/export-cocos-textures.py` | **纯注释清理**（像素零变化，重烘 md5 四件套逐一复验 = 重烘前）：① 头注【冻结口径】格段「坑底 0.32（−0.68）· 格外 0.70（−0.30）」→「槽底 0.70（−0.30，格底色；v1.1 变更，旧 v1.0 坑底 0.32 已废）· 格外 0.70」+ 补 [WXG-T-258] B 纯结构件两条；② 头注「孔缘 0.5dp smoothstep 羽化」→「0.25dp（WXG-T-232 收紧，物理孔径 ⌀12 未动）」；③ 槽段行注「槽底（斜面以内）= −0.44 纯色（0.56）」→「格底色 0.70（−0.30；v1.1，旧 −0.44/0.56 已废）」；④ L292 死笔注 → 「**死笔 [WXG-T-258] 定标单明文**……留笔仅为 git 溯源对齐 258 批 md5 `8e2deda1`」 |
| `tools/mask-preview/export-cocos-textures-holeless.py` | **零改动**（头注本就写明「不跟随有孔档 v1.1」；注释与码一致） |
| `tools/mask-preview/mask-diff.mjs` | I-4 复核定档（依据 = 258 定标单 v10.0）：分档断言——有孔槽底 B=0 + **环带正向腿 B=255**（中心正上 10.5dp，防「整格透明」假绿，258 交付表原文要求）／无孔槽底 B=255（I-5 分叉）／格外 B=0（两档）／纯二值（两档）；头注「格面 `B ≡ 255`」同步改纯结构件口径 |
| `tools/mask-preview/cocos-assets/*.png` ×4 | 重烘复验，md5 = `222a82d6 / 8e2deda1 / af49e7a9 / 51f17b3d`（逐字节不变）；已 `cp` 同步到 `games/beads/cocos/assets/textures/` |
| `tools/scripts/verify-all.mjs` | **恢复挂载**：STEPS 表 `[WXG-T-230 ⏸ 暂缓挂载]` 注释位原样恢复为 `'mask:diff'`（`harness:build` 之后）；`--validate` 过（步骤表 22 项） |
| `packages/framework/src/core/bake/mask-spec.ts` | **零改动**——R 已对齐（`slotFloorD` 0.7/0.32）勿动；B 语义未变（TS `cellShapePlane` 已跟随 258），触发条件「若 B 语义变化」不成立 |

**④ 复测读数**
- `pnpm run mask:diff`：**PASS**，四件套 R/G/B `mean=0.0000 max=0 >1步:0/65536`，编码不变式 I-1…I-6 全过（I-4 按新档）。
- `verify --steps=mask:diff`：**PASS 1 / WARN 0 / SKIP 0 / FAIL 0** ⇒ 挂载生效。
- framework `mask-field.test.ts`(27) + `mask-diff.test.ts`(5)：**32/32 绿**（零回归）。

**⑤ 未闭项 / 风险（如实）**
1. 容差语义未变：门禁实测按逐字节判（diff 恒 0），`--mean/--max` 默认值仍为方案件 §4.3 建议值，「与 QA 对齐」未闭（挂载不改变这一点，仅把现状钉进门禁）。
2. WXG-T-258 遗留「CPU vs GPU 羽化带 `l·shape` 分叉待裁」（258 §真机一致性）与本单无关，未动。
3. `tools/mask-preview/cocos-assets/new-mask.png` 等非现役文件未清理（不在本单范围）。
4. 全量 `pnpm run verify` 未在本批跑（工作树有其它会话并发半成品，`test` 项可能红在其域）⇒ 由主理人在合并窗口统一跑。

### 续二落码：C12 换墨反证臂 + 封箱腿整帧漂移自动报警（程基岩，WXG-T-230 续二 · 主理人已拍板）

**改动面**（⛔ 未 commit；并发 M 态文件 `tuning.ts` / `bead-render.ts` / `registry.ts` / `bead-size-tier.test.ts` / `bead-style-pool.test.ts` 零触碰）

| 文件 | 改动 |
|---|---|
| `tools/scripts/check-bead-style-pool.mjs` | **【A】** 最小增量三处：① 新增导出纯函数 `reinkDominantArm()`（换墨反证臂：实算取得占优层墨，整体换成 colorIdx=2 的 base 端点色后重跑 `identifyPrimary` ⇒ argmax 必须变为该色；换墨走 map+展开**拷贝**，C2 复用槽零变异）；② `main()` 常门与 `--fixtures` 模式均实跑 facet-4，自证读数恒打（C11），不跟色 ⇒ 计入违规停在待确认态；③ 文件头目录补 C 项 |
| `games/beads/tests/__fixtures__/wxg-t-211-s3-seal.json` | **【B】** additive 增设顶层 `recheckLedger`（机器可读复评台账，5 项入账：S3 转正珠体族 −390 / 缩放控件 ±8 / 空槽内阴影 +360·+204 / 有珠格坑底 +468 / 容器板退役 −9；逐帧 Σ = 359 / 281 ≡ 帧差）；**既有键值零改动** |
| `games/beads/tests/bead-style-seal.test.ts` | **【B】** additive：`recheckLedger` 类型 + 三条新腿（台账覆盖 / 防绕过反证 / 分类报警）+ 两个纯函数 `ledgerCoverageViolations()` / `classifyTotalDrift()`；**既有 9 例零触碰** |

**A · 换墨反证臂（自证读数，本批实跑）**
- 常门：`换墨 = 占优墨 #fef9f1 → #FFD23F（=colorIdx=2 的 base 端点）×1 层；argmax #fef9f1(25.0%) → #FFD23F(25.0%)；facetPx 9207 → 9207 ⇒ argmax 跟随 ✓` ⇒ `STATUS: OK` / exit 0。
- **变异自证（K-060，临时拷贝跑完即删）**：把 `identifyPrimary` 变异成恒返 `#fef9f1` ⇒ 臂输出 `argmax 跟随 ✗` + 判红行指认「argmax = #fef9f1 ≠ 换入色 #FFD23F」⇒ `STATUS: FAIL`。堵「恒返写死值」假绿的判别力实锤。
- **与既有门协同**：TC-STY-10 机械门（参赛端点色数=1 必红）在恢复 ≥2 枚时强制回改「让位」强反证；本臂**不依赖参赛色数**，1 枚退化档与 ≥2 恢复档都是持续反证；与臂 A（他格色夹具证「会判红」）、`--probe-argmax`（证「占比随像素变」）合起来闭合判别力链。pool 判据 22/22 绿（既有断言零破）。

**B · 封箱腿整帧漂移自动报警（731100c 根治「机器拦」）**
- **机制**：台账（fixture `recheckLedger`，与 provenance 同件 checked-in）= 整帧漂移**唯一合法入账口**；报警腿对整帧实算漂移分类——台账有同额入账 ⇒ `console.warn` WARN+指引（官方复取器重封）；无入账 ⇒ 抛错 FAIL+指路 §K.5.1 复评流程（禁自改基准，K-051/K-053）。
- **防伪三锁**：① 逐帧 Σ 必 ≡ `s3.total − head.total`（未入账漂移无容身之所）；② 每项 witness 必须逐字在 provenance[key]；③ 声明 qaAnchor 的必须在 `production/qa/beads/test-cases.md` 在案（本批核得 补～补9 全在案）。
- **防绕过自证（K-060，内存克隆四篡改）**：拆项 / 伪 witness / 伪 qaAnchor（`K.5.1-补999`）/ 手改基准 +1，覆盖核对逐条指认「未入账 / 归因断裂 / 手续不全」。
- **协同与边界**：⚠ WARN ≠ 放行——腿 4a 整帧字节锁全效力，红就是红（零放宽既有断言）；⛔ 诚实限制：协调性伪造（基准+台账+provenance+QA 文号四处同改）机械上不可分辨，与整套 provenance 体系同信任级，本哨兵把绕过成本从「改一个常数」抬到「三处互锁 + QA 文号 + 全 diff 可见」。

**实测读数**：seal `12/12 绿`（9 既有 + 3 新增）· pool `22/22 绿` · ledger `14/14 绿` · `tsc --noEmit` 0 错 · 常门 exit 0。全量 verify 未跑（并发半成品，同上条由主理人合并窗口统一跑）。

**遗留 / 未闭项**：① 换墨臂的常驻断言腿（TC-STY-10 组内 spawn 断言其读数行）因 `bead-style-pool.test.ts` 处于并发冻结未补，暂由常门自跑 + 既有 22 例兜底 ⇒ 并发批合入后可补（一行 regex）；② 台账 qaAnchor 映射仅对确证项声明（recheck_1/6），其余项 witness 锁已足，QA 侧如需全量对号归 QA；③ B 的分类按 total 差匹配（同额异 kind 漂移会被 WARN 误分类，但腿 4a 逐 kind 锁仍红）——限制已登记。

---

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

---

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

---

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

---

## WXG-T-236

**beads·抬起投影形态定标（接触影/投射阶梯 + 坑底暗底读法 + 光向唯一性）** — 2026-10-03 用户裁定「丙」。

> 📄 **美术侧裁定正本 = `games/beads/design/art/specs/lift-socket-styling-decision.md`（v0.1 · A–G 七条）**。
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

---

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

`games/beads/design/art/specs/tray-neutral-slot-mask-spec.md`（2953 tok，在 8000 B 门内）内容：
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

### v6.0：托盘颜色还原为中性（v5.0 整体回滚 · 本节为当前状态）

**用户裁定**：「**托盘还是还原之前颜色**」（看了 v5.0「托盘底 = 格底」的效果图后）。

**回滚内容**：
- 托盘**面板底**回 `palette.panel`（#FFFFFF）
- 托盘**空槽**回 `colorIdx = undefined` + `trayZone: true`（基色 `palette.slot` #F7F6FB 中性）
- **保留** v4.0 的 1:1 几何（格面 30 / 珠面 26 / pitch 32）与 `cell`/`bead` mask 路径
  —— 用户只裁「颜色」，未裁几何。

⛔ **`mainColorIdx`（关卡主色字段）一并删除**：v5.0 回滚后无人消费 ⇒ 不留死代码。
清除面 = `state.ts` 接口字段 + `createSnapshot` 初始化 + `_syncSnapshot` 里的每帧众数计算
+ 视图两处引用 + `view-model` 不再需要的 `endpointOf` 导入。

**✅ 回滚完整性有硬证据（本批最值得记的读数）**：
重抓的 `frame78` sha = `27a4ae918fe92f49`、`frame0` sha = `73ace06a5739597e`
**逐位复现第十次（v4.0）登记值**；`legacyFlow` 96/96 全等、`facetNonHoleLayers` 45/45、
`facetHoleLayer` 45/45、`fixture.*` 全等 ⇒ **v5.0 的痕迹被逐字节清除**，
不是「改回近似值」而是**真的回到原状态**。
⇒ 本批把 fixture 的两个 sha **复位为 v4.0 值**（与第十次登记逐字相同 —— 这是 sha 复现后的必然，
因为登记值本就该等于重抓值）。
⇒ **归因法**：`v5.0 → v6.0` 是一对**互逆**提交，净效果在封箱上应为**恒等** ——
sha 复现即该恒等的实证，也是「封箱能拦住来回横跳」的一次正面验证。

**测试口径反转**（v5.0 的 3 条「托盘底 = 格底」不变式 → 中性守卫 2 条）：
① 面板 fill ≡ `palette.panel`（中性，不随关卡变）；
② **反向守卫**：面板 fill **不得等于任何关卡色的 `edge`** ⇒ 把 v5.0 的回归方向**封死**
（若有人再把托盘底接回主色/目标色，此腿当场红）。

**沿革（四次裁定，供后来者读）**：1:1 几何（v4.0）→ 看甲/乙效果图（Q-B）→ 「格底一致」（v5.0）
→ 看图后「还原」（v6.0）⇒ **最终 = 格面与托盘底色刻意不一致**，保「托盘 = 中性收纳区」的读感。

**⛔ 未闭**：异色格色界平移 0.5px 观感确认（T-235 白线遗留）仍未做。
（v5.0 曾记的「满槽告警描边对比度」「关卡切换跳色」两项随本回滚**自动作废** —— 托盘回中性底，
控件对比度回到 v4.0 已验状态。）

**读数**：beads **774 绿 + 1 skipped** · verify **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** ·
check:tasks **27/27** · 效果图 `temp/shadow-preview/v60-revert.png`。

### v7.0：格面 mask 槽外透明（资产变更 · 本节为当前状态）

**用户裁定**：「格底的 base 图，**槽外面部分的格面要做成透明**，在绘制格面时候**先绘制一层 −0.30 的底色**
再绘制格面的 base 和 mask 混合纹理。**托盘用的 mask 格面的颜色就可以透明**」。

**编码事实**（`packages/framework/src/core/bake/tint-composite.ts`）：
`out = base·d + (1−base)·l·shape`，**`alpha = shape = B 通道`**
⇒ 「槽外透明」= **把格外区域的 B 置 0**（资产侧改动，非代码侧裁剪）。

**落码（资产侧为主）**：
- `tools/mask-preview/export-cocos-textures{,-holeless}.py`：`gm[...,2] = 0`（格外），
  斜面区与**槽底**保留 255。
- `packages/framework/src/core/bake/mask-field.ts`：`computeCellPlanes` 的 b 平面改由新函数
  `cellShapePlane` 生成，与 py **逐字节一致**（`mask-diff.test.ts` 对拍门禁绿）。
- **绘制顺序无需改**：盘面 `drawTargetTile`（`edge = mix(base,−0.30)`）本就在 mask 之前画
  ⇒ 既有实现即符合裁定；托盘**无**那层底色（露面板）亦符合「托盘格面透明」。

**⛔ 必守约束：槽底不得透明** —— 无孔档槽底是 `0.32` 深坑，透明化会抹平
**判据 I-5** 钉的「有孔 0.70 / 无孔 0.32」分叉。⇒ shape 只在**格外**置 0。

**为什么盘面视觉零变化**（实测证实）：原 mask 格外 = `base·0.70`，而底色层
`drawTargetTile` 的 `edge = mix(base,−0.30) = round(base×0.7)` ⇒ **两者同值（±1/255）**
⇒ 改透明后露出的底色与原合成值一致。**实测：新旧截图盘面区差异 = 0px。**

**仅托盘变**（实测 16680px）：格外由 `palette.slot×0.70`（#ADACB0 灰）→ 面板白（#FFFFFF），
槽的凹陷感由保留下来的 3dp 斜面 + 槽底承担。效果 = 白板上一排排凹进去的小坑。

**封箱零追改**：封箱比较**命令流**，mask 像素是**资产内容**、不进命令流（blit 只带 `fx.base`，
未变）⇒ `frame78`/`frame0` 的 total/kinds/sha **全不变**，`legacyFlow`/`facet*` 全等。
登记键 `s3_mask_asset_recolor_v70`（属「资产变更但命令流不变」，非复评）。

**两处实现坑（已治根，留档）**：
1. **LANCZOS 振铃不对等**：v7.0 的 0↔255 硬台阶长达一整圈，**PIL 的 LANCZOS 与 TS 自实现 LANCZOS
   振铃幅度不同**（实测残留 1–9/255）⇒ 单靠 `SHAPE_RINGING_FLOOR`（清 <8）**清不掉对方残留**
   ⇒ 对拍门禁红（max diff 7）。**治根 = shape 在 128 空间直接判定、不经缩放** ——
   形状本就是**二值语义**，边缘 AA 由 R/G 的斜面光照承担，shape 只决定「实底 or 透明」。
2. **holeless 槽口参数不同**：22dp / 角 7dp（⛔ 不可硬编码有孔档的 12/8）⇒ py 侧 128 判定必须用
   本档自身的 `SLOT_HALF_DP`/`SLOT_CORNER_DP`，否则 shape 比槽口大 1dp ⇒ 门禁红。

**测试口径变更**：`mask-field.test.ts` 的 **I-4「格面 B 满幅实底（零 AA 带）」前提被推翻**
⇒ 改写为「**槽口内 255 / 格外 0 / 纯二值零振铃**」三条（新口径的反向守卫）。

**`mask:diff` 定稿门禁：PASS（收尾时补跑并修好）**。四张图 R/G/B **mean=max=0**、编码不变式全过。
⚠ **我此前报的「该脚本 `ERR_MODULE_NOT_FOUND` = 既有缺口」是误报** —— 那是**漏了 `--import` flag**
（正确用法写在脚本头注：`node --import ./tools/scripts/lib/ts-js-resolve.mjs tools/mask-preview/mask-diff.mjs`）。
同时发现该 CLI 的 **I-4 检查也按旧口径**（格面 B 须 = 255）⇒ 已同步为 v7.0 新口径
（槽心 255 / 角落 0 / 纯二值），与 `mask-field.test.ts` 一致。**教训：报「既有缺口」前先按头注跑一次。**

**⛔ 未闭**：异色格色界平移 0.5px 观感确认（T-235 白线遗留）仍未做。

**读数**：framework **421 绿** · breakout **239 绿** · beads **774 绿 + 1 skipped** ·
verify **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** · 效果图 `temp/shadow-preview/v70-final.png`。


### 收尾补跑（v7.0 收尾确认）

| 项 | 结果 |
|---|---|
| 工作树 | **干净**（无临时文件入库；旧 mask 备份在 `temp/mask-bak-v6/`，未入库） |
| `mask:diff` CLI（定稿门禁） | ✅ **PASS** —— 四张图 R/G/B mean=max=**0**；**I-4 检查已同步 v7.0 口径** |
| `mask-diff.test.ts`（对拍单测） | ✅ 5/5 |
| framework / breakout / beads | ✅ **421 / 239 / 774**（+1 skipped） |
| `verify` | ✅ **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** |
| `check:tasks` | ✅ 主表 27 行 27 节配对完整 |
| 定标单 | 补 **§7 v5.0→v7.0 沿革**，**v4.0 → v7.0**（**6358 tok / B 门 8000**） |

**本轮收尾纠正的两处自身失误**：
1. **「`mask:diff` CLI 有既有缺口」是误报** —— 实为漏 `--import` flag（用法写在脚本头注）。
2. **I-4 编码不变式在 CLI 与单测两处口径分叉** —— 本批只改了单测、漏了 CLI ⇒ 收尾时补齐。
   ⇒ **教训：同一不变式在「单测 + CLI」两处实现时，改一处必须同步另一处**（与 v5.0 那次
   「`view-model` 改了、`harness` 接线漏了」同型）。

### v8.0：base 四件移除（生成过程 + 资产一并去掉）

**触发**：用户问「`base.png` 在绘制纹理时是否真实需要？透明度是否 mask 就可以满足？如果不需要就去掉生成过程」。

**结论：base 不需要 —— 透明度完全由 mask 承担。**

**五处核实（逐条读数，非推断）**：

| 核查点 | 读数 |
|---|---|
| `dev/harness/main.ts` 的 `MASK_FILE[gauge][kind]` | blit **只**加载 `*-mask.png` |
| `packages/framework/src/adapters/canvas2d/tint-blit-resolver.ts:36` | 有 `fx` 时走 `cache.get(cmd.textureId, base)` —— **只用 maskId + 着色基色** |
| 烘焙层 `bake-recipes.ts` / `bake-surface.ts` / `bake-key.ts` | **不涉及**任何 base PNG |
| `mask-diff.mjs` / `mask-diff.test.ts` | 门禁**只**比 4 个 mask 文件 |
| Cocos 侧 `assets/scripts/` | **无** base 引用（原引用只在编辑器缓存 `cocos/temp` / `cocos/library`） |

**为什么透明度不需要 base**：

```
out = fx.base · d + (1 − fx.base) · l · shape        alpha = shape
```

- **`alpha = shape = mask 的 B 通道`** ⇒ 透明与否**只由 mask 决定**
- 公式里的 `base` 是 **`fx.base` 着色基色（hex 字符串**，`colorIdx === undefined ? palette.slot : beadColorOf(inks, colorIdx)`**）**，
  ⛔ **与任何 `*_base.png` 无关**
- 「−0.30 底色层」也不是 base.png，而是**代码画的 rect**（`drawTargetTile` 的 `edge`）

**与原规约的一致性**：`tint-mask-asset-spec §1.1` 原文已把 base 标「**条件交付**」并写明
「走**整盘单图元**（Q1 选项①，推荐）后 base 四件**可省 ⇒ 回吐 KB 级**」
⇒ 本次是**执行该已写明的条件**，**不是新决策**。

**动作**：
- `tools/mask-preview/export-cocos-textures{,-holeless}.py`：**删掉** `bead_base` / `grid_base` 的生成与输出元组，
  头注改为「base 四件已停止生成并从库中删除」+ 回退条件
- 删 4 个 `*_base.png`（**实测 5 769 B ≈ 5.63 KB**；⚠ 原规约写「6 365 B」有误，已更正）
  + Cocos 侧 2 个 png + 2 个 `.meta`（成对删，避免编辑器报丢失资源）
- 规约 §1.1：**八件套 → 四件套**（**19 234 B ≈ 18.78 KB**），新增 **§1.1.1 base 移除裁定**
  （五处核实表 + 「为什么透明度不需要 base」+ 字节更正 + 回退条件）；§1.2 命名清单 8 件 → 4 件

**⚠ 回退条件（如实登记）**：真机侧若改走「**Sprite 池载体**」路径（Sprite 无 `spriteFrame` 不渲染 ⇒ 需占位图），
base 四件须重新生成 —— 代码在 git 历史（`8d7889a` 之前的 `export-cocos-textures*.py`）里，
或按 §1.1.1 规格重写（`bead` 占位 = A 通道取 `shape_b`；`grid` 占位 = 纯白 128²）。

**门禁**：`mask:diff` **PASS**（4 张 mask 编码不变式全过、R/G/B mean=max=0）·
framework **421** / breakout **239** / beads **774**（+1 skipped）· `verify` **PASS 19 / FAIL 0**。

### v9.0：mask 资产改名 —— gauge 显式化（`hole` / `holeless` 对称）

**用户裁定**：「改成 `bead-hole-tint` 前缀的名字，并改引用」。

**改名**：

| 旧名 | 新名 |
|---|---|
| `bead-tint-128-mask.png` | **`bead-hole-tint-128-mask.png`** |
| `grid-tint-128-mask.png` | **`grid-hole-tint-128-mask.png`** |
| `bead-holeless-tint-128-mask.png` | 不变 |
| `grid-holeless-tint-128-mask.png` | 不变 |

⇒ **顺带部分实现规约 §1.2 的 N-1 冲突建议**（原「`gauge` 未显式化：holed 靠无后缀隐式表达」）。
⚠ **用词与规约原建议不同**：规约写 `holed`，用户裁的是 `hole` ⇒ **以用户为准**，规约 §1.2 已同步
（命名清单 + 模式行改为 `{kind}-{gauge}-tint-{尺寸}-{角色}.png`）。

**⛔ 逻辑 id 不变**：`mask__grid__holed__v1` / `mask__bead__holed__v1` 等**不动** ——
那是 `BeadMaskGauge` 键经 `MASK_SCHEMA_VERSION` 拼的，与文件名解耦。

**动作**：
- `git mv` **6 个文件**：`tools/mask-preview/cocos-assets/` 2 png +
  `games/beads/cocos/assets/textures/` 2 png + **2 个 `.meta`（png 与 .meta 必须成对改名**，
  否则 Cocos 编辑器丢 uuid 引用）
- **17 处引用**同步：`dev/harness/main.ts`（`MASK_FILE`）· `tools/mask-preview/mask-diff.mjs`（TARGETS）·
  `packages/framework/tests/core/mask-diff.test.ts` · `export-cocos-textures.py`（头注 + 输出元组）·
  `preview-combined.py` · `games/beads/src/view/view-model.ts`（注释）·
  `games/beads/tests/bead-tint-arm.test.ts` · 规约 §1.2
- ⛔ **历史记录不改**：`memory/2026-10-03.md` 里的旧文件名保持原样（日记是时间快照）

**运行时加载链实测**（改名最易漏处 —— 文件名错 ⇒ mask 静默不命中 ⇒ 画面退回矢量臂，**单测不一定红**）：
- HTTP `/mask-assets/`：**新名 4 个全 200**，**旧名 2 个全 404** ⇒ 确按新名加载
- ⚠ **截图逐像素对比在此不可用**：改名后 vs 改名前差 1680px，但**遍布全图** ⇒ 是关卡/动画相位差异
  （同 v60 vs v5.0 那次 63536px）⇒ **已第二次踩这个坑**，验收改名一律用 HTTP 状态码或日志，不用截图。

**门禁**：`mask:diff` **PASS**（重导出后 4 mask 编码不变式全过、R/G/B mean=max=0）·
framework **421** / breakout **239** / beads **774**（+1 skipped）· `verify` **PASS 19 / FAIL 0** ·
`check:tasks` 27/27。

---

## WXG-T-239

**beads·首屏引导（GAP-03/04）留档 + 实现屏蔽** — 2026-10-04 用户裁「先把新手引导留档，实现上先屏蔽掉，后期统一调整」。

**用户裁定**：「先把新手引导留档，实现上先屏蔽掉，后期统一调整」。

### 落码（一处开关）

`beads-game.ts` 新增 `private static readonly ONBOARDING_ENABLED = false`，并在 `s.onboarding`
判定里**放在短路最前**：

```ts
s.onboarding =
  BeadsGame.ONBOARDING_ENABLED
  && this._mode === 'normal'
  && s.phase === 'playing'
  && !this._onboardDone;
```

⛔ **短路顺序刻意「开关在前」**：关闭时**完全不进**引导算法（`hintRow` / `hintCol` / `guideSlot`
保持 −1）⇒ 零额外计算，且从根上排除「引导半途生效」。

### 用户看到的「闪烁蓝框」是什么

`drawStateRing`（圆角方框描边 `lineWidth 2`）+ `palette.hintBlue`（**#3D7BF5**），
α 呼吸 `breathe(clock, HINT_PULSE_MS, 0.5, 1)` ⇒ **α 在 0.5↔1.0 循环**（用户观感「闪烁」）。
**两处同时闪**：盘面目标格（首珠该放的那格）+ 托盘首珠所在槽。
原显示条件：`普通模式 && PLAYING && !_onboardDone`（新玩家 v3 新档 `onboarded: false` 时激活）。

### 留档（⛔ 明确没动的）

- **规格一字未删**：`ux-spec §6.3` GAP-03/04 原样保留
- `_onboardDone` 判定链**未动**：仍从 `save.data.onboarded` 读、首次落子仍落盘 `onboarded: true`
- `hintRow` / `hintCol` / `guideSlot` / `firstColor` 的**算法未动**
- 「减弱动效」时呼吸转静态（α=1）的分支**未动**

### ⚠ 恢复时必须知道的两件事

1. **屏蔽期首次落子照旧写 `onboarded: true`** ⇒ 恢复后老玩家不会看到引导（本身合理：引导只给新玩家）
   ⛔ 但**内部要看效果必须先清存档**或把 `onboarded` 置 `false`，
   否则「恢复后没人看到引导」会被**误判为功能坏了**。
2. **既有缺陷（本次不修，留档）**：`this._onboardDone = save ? save.data.onboarded : true`
   —— **无存档时默认 `true`（不引导）** ⇒ 「卸载重装 / 清缓存后首次进入」拿不到首玩提示。
   后期统一调整时应一并修（无 save 时应默认 `false`）。

### 测试口径变更（四处，均为前提被推翻 ⇒ 改写不删）

| 文件 | 原断言 | 改写为 |
|---|---|---|
| `feedback-vfx` 首玩腿 | `onboarding === true` + 有蓝环 | 屏蔽态：`onboarding === false` + 三指针全 −1 + **无** `hintBlue` 环 |
| `feedback-vfx` 落子清引导腿 | 落子后 `true → false` | 屏蔽态落子后**仍**无指针（无「先显示后消失」中间态） |
| `feedback-vfx` D1 reduceMotion 腿 | 环 α `0.5` / 静态 `1` | **反向守卫**：两种取值下**都不存在** `hintBlue` 环（该通路无消费者，不是被改坏） |
| `onboarded` 两条迁移腿 | `onboarding === true` | **双重断言**：存档 `onboarded === false`（**真正被测对象** = 迁移逻辑）+ `onboarding === false`（显示屏蔽） |

⚠ **口径要点**：那两条迁移腿本意是验证**存档迁移**（BD-32「BOOT 自增 `runs` 不得吃掉引导」），
不是验证显示 ⇒ 改看**存档字段**后，屏蔽与否都不影响它们继续守护迁移逻辑。

### ⚠ headless 未能复现「闪烁」（如实记录）

屏蔽前后各截一张对比：**蓝色像素 1270 → 1270（完全相同）** ⇒ 该 harness 存档本就
`onboarded: true`，引导从未激活 ⇒ **我截到的「蓝」不是引导框**。按形状定位（列投影 `x=69–73` 与
`x=86–90` 两条竖线相距 17px + 行投影 `y=92–111`）确认：那是**左上角 harness 调试浮层里的小圆环**，
且两帧亮度差 **0**（**不闪烁**）。
⇒ **用户所述的闪烁蓝框未能在 headless 复现**；若它在真机出现，需在真机侧定位（可能属真机专属 UI 路径）。

### 门禁

beads **774 绿 + 1 skipped** · framework 421 / breakout 239 绿 · `verify` **PASS 19 / FAIL 0** ·
`check:tasks` 28/28 配对完整

---

## WXG-T-240

**beads·托盘选中态补画槽** — 2026-10-04 用户三项反馈之一（另两项见 §三）。

### ① 槽不显示（✅ 已修）

**病因**：`drawTray` 里 `if (slot.state === 'free')` 才画槽 ⇒ **有珠的槽从不画坑**。
静息时珠正好盖住坑，看不出来；但**选中时珠抬起 `TRAY_SELECTED_LIFT_PX`** ⇒ 坑底位置暴露成
一片空白 ⇒ 读作「珠悬在半空」。

**修法**：**选中态在珠之前补画槽**，口径与空槽路径**逐字同源**（同 `TRAY_SLOT` /
`BEAD_DRAW_INSET` / `maskGauge:'holed'` / `styleId` / `trayZone`）⇒ 不引入第二套坑绘制。

⛔ **层序是本质**：画在 `drawFilledBead` **之后**会被珠面完全盖住 = 等于没画
（同 WXG-T-236 盘面「抬起格也画坑底」的层序结论）。

**实测**：槽 0 附近图元 **未选中 3 → 选中 8**（+5 = 坑底/斜面/亮线）。
**守卫**（`selection-anchor.test.ts`）：选中后槽区**不得为空白**且图元数**增加**。

### ①-补 托盘静息态也画槽（✅ 已落，同日第三项裁定）

**用户续报**：「托盘上珠子**非抬起状态**，没有槽绘制」。

**⇒ 补画范围由「仅选中态」扩到「所有有珠的槽」**（去掉 `if (selected)` 包裹层）。

**为什么静息也该画**：珠面 **26** / 格面 **30** ⇒ 本该露出 **4dp 坑沿**；
此前不画槽 ⇒ 珠四周**什么都没有** ⇒ 读作「浮在白面板上的孤立方块」。

**实测**（托盘横切 lum，每槽重复）：
`255(面板) → 105(坑沿暗) → 172×6(珠面) → 145(坑沿暗) → 255(面板)`
⇒ **静息态 4dp 坑沿可见**；且两种状态语言统一（静息「坐进坑里」/ 抬起「从坑里升起」）。

**守卫改写**（`selection-anchor.test.ts`）：⛔ 旧腿「选中后图元数**增加**」**前提被本裁定推翻**
（未选中已画槽 ⇒ 选中不再增加）⇒ 改为「**静息与选中两态都不得为空白**」两条正向断言。

效果图：`temp/shadow-preview/v241-tray-slot-always.png`

### ② 多了一个蓝点 —— ✅ **已裁撤**（同日追加，用户裁「蓝点 去掉」）

**裁撤对象**：原 F6 托盘选中点
`builder.circle(cx, slotBottom - 8, 4, { fill: palette.hintBlue })`
（F6 规格：「选中点 → accent_blue，§3.5 环状提示 ≤8px 圆点」）。

**裁撤理由**：该点正好落在**同批补画的坑底**上（§①）⇒ 读作「坑底里有个蓝点」，
与坑的明暗语言混在一起；且抬起动画已足够表达选中
⇒ 选中信号改为**纯几何语言**（珠抬起 + 坑可见）。

**落码**：
- `view-model.ts::drawTray`：该 `if (selected) { circle(...) }` 块**整块删除**，
  原地留**裁撤说明注释**（含原实现代码与理由）
- ⛔ **非死变量**：`slotBottom` 仍被上方 `drawDashedRect`（扩展行虚线槽）使用
- 规格侧：`art/assets-spec.md` 的 `selected` 行**已留档裁撤**
  （⚠ 明确「盘面侧圆点语义不变，裁撤仅针对托盘」）

**实测**：选中后槽区 **8 个图元，其中 `hintBlue` 圆点 0 个** ✓
**零回归**：删除后 beads **776 绿原样通过** ⇒ **无任何测试依赖该点**（说明它纯是视觉元素）。
**反向守卫已加**（`tray-spawner.test.ts`）：托盘选中态**不得**出现 `hintBlue` 圆点。

选中时在槽下方 `slotBottom - 8` 画一枚 4px `palette.hintBlue` 圆点
（**F6 规格**：「选中点 → accent_blue，§3.5 环状提示 ≤8px 圆点」）。
**规格要求存在，但用户判「多余」** ⇒ 三选项待裁：
甲 去掉该点 · 乙 保留但移到珠内/改形 · 丙 保留（用户只是觉得突兀，实际不动）。
⛔ 本批**未动**（等裁）。

### ③ 再点击取消 —— ✅ **已按用户裁定去掉 toggle**（同日追加）

⚠ **我曾把该句读成「报 bug」，实为「提要求」** —— 用户要的是「选中后**不该**能取消」。
**教训：用户说「不能 X」时先确认是「报 bug」还是「提要求」** —— 中文否定句方向歧义是真实风险，
本次因方向读反多做了一轮无用诊断。

**落码**：
- `entities/tray.ts`：`select()` 的「同色再点 ⇒ `deselectAll` + 返回 `deselected`」**分支删除**，
  改为 `return 'unchanged'`（**幂等保持选中**、零副作用）
- `SelectResult` 新增 `'unchanged'`；`'deselected'` **保留在类型里**（⛔ 不破坏外部穷举分支）
  但 `select()` 已不再产生它
- `beads-game.ts::selectTraySlot`：加 `unchanged` 分支 ⇒ **零事件、锚不动**

**取消选中的唯一路径** = ① 换选（点他色）② 落子（`bead:placed`）③ 取回（`retrieveBead` 侧清组）。

**测试**：
- §8-6 腿的「整组静默取消」段**反转**为幂等语义（组仍 `selected`、零新广播、锚 `tray`）
- **新增正向守卫**：同色连点 **3 次**，断言 `selectedCount` / 槽 state / 事件数 / `selection`
  **逐字不变** ⇒ 把「不取消」这条新语义钉死，防回归

**实测**：同色再点 ⇒ `selectedCount` 保持 2、`tray:selected` 计数保持 1、`selection` 保持 `tray` ✓

#### ③ 原诊断留档（方向读反的那次）

| 操作 | 槽状态 | `traySelected` |
|---|---|---|
| 点槽 0（色 1） | `ss`（**同色组**选中） | 0 |
| 再点槽 0（同色） | `hhh`（全回） | −1 |
| 点槽 2（**异色**） | `hhs`（换选） | 2 |

⇒ 当时判「toggle 逻辑正常，疑为语义差」⇒ **方向判反**：那个 toggle 正是用户要**去掉**的。

**实测三例**（直接驱动 `Tray.select`）：

| 操作 | 槽状态 | `traySelected` |
|---|---|---|
| 点槽 0（色 1） | `ss`（**同色组**选中） | 0 |
| **再点槽 0（同色）** | `hhh`（全回） | **−1 ⇒ 能取消** ✓ |
| 点槽 2（**异色**） | `hhs`（换选） | 2 ✓ |

⇒ **toggle 逻辑本身正确**。`Tray.select` 的取消判据是「**同色**」
（`prev >= 0 && 同色 ⇒ deselectAll`），且 `selectedSlot` 是**动态 getter**
（遍历找 `state === 'selected'`）⇒ 取消后自然回 −1。

**用户观感「不能取消」的最可能成因**：点到**异色**珠 ⇒ 那是**换选**（旧色落下、新色抬起），
观感上「都是选中的」⇒ 像没反应。⚠ 需用户确认是否要改成「点**同一颗**才取消」
（而非「点任意同色都取消」）—— 那是**语义变更**，不是修 bug。

### 读数

beads **777 绿 + 1 skipped** · `check:tasks` 29/29 · `verify` **PASS 19 / FAIL 0**

---

## WXG-T-243

**工程单：`wrong` 单槽 500ms 门吞连点（T-241 扩面后第二个错色格无反馈）**

**来源**：T-242 art review 挖出（第二重真因），用户裁「单槽门工程单 开」。

**问题**：`_armWrongFx` 全局单槽 + 500ms 重启门（`systems-index §3.8`「错误反馈 ≤2 次/秒」的实现载体）。T-241 把触发面从「托盘落子失败」扩到「board 选中态下点任意错色空格」后，**连点两个不同错色格，第二个格毫无反应**（门内静默吞掉，零反馈帧）。

**候选解法（主理人定）**：甲 单槽 → 按格去重（每格独立 500ms 窗，全局仍 ≤2 次/秒）；乙 门内第二次命中改播更轻的替代反馈（如 denied-press 轻压）而非静默；丙 维持现状登记已知限制。

⛔ 涉及 §3.8 冻结口径，美术不单方放宽；实施时须过封箱复评（wrong 通道在 fixture 孔层/整帧有足迹）。

---

## WXG-T-247

**beads·Cocos 生产通道同源绘制（ADR-0030 载体决策）**

**来源**：2026-10-04 用户令「Cocos 生产通道 需要解决 与 harness 同样的绘制逻辑」；
真机症状由用户自述 =「使用的是矢量绘制逻辑」。决策件 = `docs/architecture/adr/ADR-0030-beads-cocos-production-blit-carrier.md`
（程基岩委草、编排者复核并改领号）。**本批只出文档，零实现代码。**

### 定性（⛔ 不是回归缺陷）

真机没有 tint = 当前架构的**正确行为**，三条事实叠加后结构上不可能发生：

| 事实 | 锚 |
|---|---|
| `case 'blit'` 在 Cocos 分支 = warn 一次后静默跳过 | `packages/framework/src/adapters/cocos/cocos-renderer.ts:201–211`（承 `ADR-0026 §4.2`） |
| Cocos 侧**没有 blit 抽象**（`CocosRendererOptions` 无 `blitResolver`/`textureRegistry`，两者只在 canvas2d 存在） | 对照 `canvas2d-renderer.ts:63/84/107/112/131` |
| tint 链（装 mask → 注运行时 → 预烘）**只有 dev harness 一个调用点** | `dev/harness/main.ts:120–175`；`setBeadTintRuntime`/`setBeadBakeRuntime` 在 Cocos 侧零调用 |

所以本单的性质是**补一段从未存在的生产通道**，不是修坏掉的东西。

### 推荐路线（待用户裁定后生效）

**丙′「同源 Canvas2D 帧通道」**：Cocos 宿主内实例化现役 `Canvas2DRenderer`（与 harness 逐字同一份代码，
含同一 `createTintBlitResolver` / `TintSpriteCache` / `compositeTintMask` / `computeMaskField`）产帧
→ 上传一张 `Texture2D` → Cocos 只显示这一张。**同源 = 同代码，不是同规格**（DEC-3：⛔ 禁止在 Cocos 侧写第二套合成公式）。
前置 **丁**（carrier 抽象，S1，与载体选型解耦）。落位承 `ADR-0022 §8.1`：触 `cc` 只住 `games/beads/cocos/assets/scripts/`，
⛔ 不进 framework 镜像 / 不进框架 barrel。

四条支撑与四条硬约束详见 ADR §0 / §3（DEC-4 mask 走运行时程序化 ⇒ 零位图投放、`§19` 与包体守卫不触发；
DEC-5 纹理尺寸 = 盘面 bounding box × dpr；DEC-6 每帧按当前变换重量绘，⛔ 不用节点缩放；DEC-7 渲染/输入同口径）。

### 最大未知（诚实记录）

- 每帧一次 CPU 2D 填充 + 一次 canvas→GPU 上传，**耗时与显存全 `[待实测]`**；`ADR-0029 §0` 的「真机帧时间与显存」
  由**采纳门禁降为换代门禁**（DEC-9），边界条件 = 丙′ 在 S2 出数前**不得默认开**（呈现层开关默认关，关 = 与今日逐字节等价）。
- **单点故障**：离屏 2D canvas 在 Cocos wechatgame 下的可得性、canvas→`Texture2D` 运行时上传——本仓零实测、
  引擎取证面（`api-verified.md`）无覆盖，⛔ 不得由 web-mobile 浏览器档外推（`ADR-0028 T2'`）。任一不通 ⇒ 丙′ 出局、转 甲′/乙。
- `[R]` 真机腿仍被环境阻塞（无微信开发者工具 + 无 AppID）⇒ S2 桌面绿**不得**记作「真机通过」（K-037/K-054）。

### 待用户拍板四刀（ADR §7）

1. **Q1 载体**：(a) 先丙′、S2 出数后再决定换不换（推荐）／(b) 直接押 甲′（`ADR-0029 §9` 在册采纳项）／(c) 押 乙（⛔ 不满足诉求本体）。
2. **Q2 zoom**：(a) 每帧重量绘保锐利（推荐，代价每帧上传）／(b) 缩放期容忍糊 + 停稳重量绘（须 art 复评）／(c) 节点缩放（⛔ 违 §19，须显式豁免）。
3. **Q3 真机资源**：拿不到 3 台 + 开发者工具时，是否允许 S5 只做「开关默认关的可用通道」并只记 `[E]`（建议：允许）。
4. **Q4 mask 来源**：(a) 运行时 `computeMaskField`（推荐，零投放）／(b) 用已就位 4 张 PNG（需编辑器产 `.meta`，且 `holeless` 两张缺 ⇒ 今天开不了工）。

### 实施拓扑（裁定后才动码）

S1 carrier 抽象 → S2 取数 Spike（`?parity=1` 默认关）→ {S3 两端同帧像素对拍, S4 mask 运行时接线} → S5 生产宿主接线 → S6 性能复评/换代判据。
验收一律引用在册工具与在册 TC-ID（`TC-TINT-13/14a/14b/15/16/17/18`），新判据拟 **TC-TINT-23** 交严守真落册，本单不自钉阈值。

### 2026-10-05 用户四刀回话与 ADR 相应改写（本会话实测取证，⛔ 零实现代码）

| 刀 | 用户口径 | ADR 落点 | 本会话新增实测 |
|---|---|---|---|
| **Q1 载体** | 「先评估方案的性能后再决定是否与 harness 同源」 | **DEC-1 标注「暂不生效」**；新增 **§5.0 S0 性能评估先行批**；拓扑序改 `S0 → 裁载体 → S1 → …` | 纸面账（可算，无需实测）：丙′ 每脏帧上传 = 可见区 × dpr ⇒ **dpr3 档 6.6 MiB（fit）～12.9 MiB（zoom 2.0 clip）** = **0.4–0.8 GiB/s @60fps**；甲′ = 图集 **458 KB** 一次性 + **零每帧上传**；乙 = mask 128² + 1 draw call。今日矢量臂基线 = 每帧 ≈ **2031 条命令**重放 |
| **Q2 zoom** | 「需要解释清楚再决定」 | 新增 **§7.1**：拆成**两个正交源**——源 A 帧纹理分辨率（= Q2 三选项）／源 B 珠子本体档位（= 与 Q2 无关的第二刀） | `BEAD_CELL=30`、`CAMERA_ZOOM ∈ [0.2, 2.0]`、`MASK_CANONICAL_SIZE=128`、`TINT_LOD_MAX_UPSCALE=null` ⇒ 珠子物理边长 `30×2×3 = 180 px` = **1.41× 放大**，**harness 今日已如此** ⇒ 选 (a) 也救不了珠子；本单初稿「(a) = 保锐利唯一解」**不准确，已如实修正** |
| **Q3 真机** | 「具体说明下再决定」 | **F-11 整条改写为「阻塞已不成立」**；§4.2-10 与拓扑说明同步更正；`VERSION.md` 环境表追加 10-05 复核更正块 | `ls /Applications` → `wechatwebdevtools.app`（CLI 在 `Contents/MacOS/cli`，support dir mtime 10-04 23:55）；AppID 在仓（根 `wx63c62151a1c0cf3b` / 构建档 `wx8cf9f756e5390749`）；`build/wechatgame` mtime **10-04 23:54**。**真实设限 = 样本面**：在册 `render-perf-device-baseline.md` 的 L-A/L-B 双低端锚点不齐 ⇒ S0 只能出**方向性预读**，⛔ 不得记 D1/D2「≥2 台低端同向」达线 |
| **Q4 mask** | 「从主包里来；以后变更皮肤用增量包替换 mask 纹理，换肤功能之后再实现」 | **DEC-4 整条改写**（推翻本单初稿推荐的运行时程序化）；`computeMaskField` 由「运行时」挪到「构建期」（正本产地不变） | 资产实测：四张 128² mask = 8,750 + 4,210 + 3,395 + 2,872 B = **19.2 KB**；`textures.meta` = directory importer 无 bundle 标记 ⇒ 落 `assets/main` **计入主包**（正是所求）。包体实测（`check:size`）：主包 **2866.8 KB / 32 文件**（gzip 1334.6 KB）⇒ 距红线余 **1229 KB**，⚠ **已超内部目标 2000 KB**（守卫仅 WARN，K-089 在数上成立）。换肤前置 = `textures` 目录**改 bundle**（编辑器动作，L1 禁手编 `.meta`）+ 当前 `game.json` **无 `subpackages`** |
| **第五刀（同日追加）档位规范** | 「按 `BEAD_CELL 32 × zoom 2 × dpr 2` 规范实现 `MASK_CANONICAL_SIZE`；小程序兼顾高低设备，**不特做 dpr3 资源**」 | **DEC-4 新增「档位规范」条** + **§7.1 源 B 改写为已裁、决策 II 关闭**（(D) 加投 256² 标 ⛔ 已否）+ §7 Q2 拆清「仅指源 A」 | 口径订正：32 = `BEAD_PITCH`、**`BEAD_CELL = 30`** 才是 blit 外框（`tuning.ts:316` 与单测 `bead-tint-arm.test.ts:384–389` 早已逐字算过 `120 ≤ 128` / `180 > 128`）⇒ 安全包络 `zoom × dpr ≤ 4.27`（按 32 则只剩 4.0 = dpr2 满 zoom **零余量**）。**遗留冲突**：资产决策管不住真机 DPR ⇒ (A) 保持 `null`（需 §19 例外登记）/ (B) 填 `1.0`（降级正好落在主判低端机 = 最重矢量臂）/ (C) 降 `CAMERA_ZOOM_MAX` 1.4（属 §3 冻结常量变更）**待裁**；⚠ 真机 DPR **在册零实读**且 web 档**引擎封顶 2**（`TC-COORD-03`）⇒ 桌面取证看不到 dpr3，已列为 **S0 真机腿必采项**（现降为 (A) 的**复评依据**，不再是定档前置） |
| **第六刀（同日）§19 冲突处置** | 「**直接 (A)，之后有问题再调整**」 | **§7.1 三选标 ✅ 已裁 (A)**（(B)/(C) 降为备选、保留机制不删）；**DEC-4 新增「(A) 的落地账」**；**附录 A 新增 §19 tint mask 档位例外文案**（含四条边界，只解「放大」半、不解「投放位图」半）；**S5 新增硬前置** | 代码成本 = **零**（`TINT_LOD_MAX_UPSCALE` 已是 `null`，现状即 (A)；回退机制与单测保留 ⇒ 填 `1.0` 即可调整）。⚠ 换来三笔账：① **`control-manifest §19` 正本待工程单落表** ⇒ 未落表前 S5 呈现层开关**不得默认开**；② `tuning.ts:310`「不靠『显式豁免』绕过」在本裁定下**语义反转** ⇒ 列为 **S1 顺带更正项**（含镜像副本，本批不动码）；③ 例外跟**「128 唯一档」**走、不跟载体走 ⇒ S6 换 甲′/乙 后 (A) 照用，不得当作已解决而重开决策 II |

**新增门禁（Q4 直接后果，⛔ 不可跳）**：投放位图命中 `control-manifest §19` ⇒ 须先过 `TC-TINT-18`（V-9 先证包体守卫**能红**）且 `verify --strict`；
并须回写 `architecture.md §5.1`「首屏 0 图片」的**例外登记**（首屏唯一位图 = 四张 mask），⛔ 不得留作隐性漂移。
两张 `holeless` 的 `.meta` 仍待编辑器导入 = (b) 路线今天唯一真阻塞。

**下一步**：S0 三步（① 离屏 canvas 与 canvas→`Texture2D` 的**二值可行性**——最省力的一刀，不通则丙′ 直接出局；② [E]/[SIM] 量级对照，
跑进在册 D8b「每帧全量 vs 仅脏格上传」口径，⛔ D8b 明文「无通过线，不得自造」⇒ 只出登记值；③ [R] 方向性预读）。
S0 出数后才回 Q1 选载体、Q2 定 zoom 口径（+ 决策 II 珠档位），可同批一并裁。

### 2026-10-05 → 10-06 第七刀：S0 开工，三臂同宿主实测出数（⚠ 本批**解除「零实现代码」**，限取证面）

用户三令：① §19 例外**现在就落正本**；② 三臂优缺点 + 推荐 + 是否有更优方案；③「**实现后两个方案，并打印真实性能数据做对比后选择**」。

| 项 | 本批交付 | 实测锚 |
|---|---|---|
| ① §19.1 例外 | `control-manifest.md` **§19.1** 已落表（四条边界 + 「未落表前开关不得默认开」）⇒ `ADR-0030` S5 硬前置的**文书半边已清**（真机半边仍须 `TC-TINT-18`）；ADR 附录 A 与头注同步标「已落表」 | `docs/architecture/control-manifest.md:343` |
| ② 载体实现 | 新增 `games/beads/cocos/assets/scripts/spike/carrier-bench.ts`（三臂 = V/C/A 同一页面同一盘面态，`?bench=1` 门，默认零开销）+ `tools/scripts/carrier-bench.mjs`（服务产物 + mask 白名单 + zoom 矩阵 + 表/JSON/MD/截图）；`BeadsBootstrap.ts` +3 行挂载 | `pnpm run cocos:check` 绿 · `framework:sync:check` 绿 · `build:cocos:web` 12.5 s（`.meta` 由编辑器自动生成，⛔ 未手改） |
| ③ 测量宿主 | **打通一条无需真机、无需人工点按钮的取证通路**：Creator 3.8.8 CLI 产 web-mobile → `node:http` 服务 → playwright chromium **`--use-angle=metal`** → 页内 `EXT_disjoint_timer_query_webgl2` 取真 GPU 时间 + `director.root.device.numDrawCalls/numTris` | 实读 `ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`、dpr **2**、backbuffer 824×1830 |
| ④ 读数 | 静置档 + 最坏档（`--disturb`）各一份，9 格矩阵（3 臂 × 3 zoom），两轮复跑同向；证据落 `production/qa/beads/evidence/carrier-bench/`（+ `disturb/`） | 详表 = `ADR-0030 §5.0.1` |

**读数要点（三句）**：① **H-CPU 已证**：V 每帧 CPU 重放 3.0–3.9 ms = C/A 的 3–4×，且唯一随 zoom 上升（tris 37k→55k）；
② **H-FILL 本档判不了**：三臂 GPU p50 不随 zoom 变 ⇒ 假设仍未裁，必走 `[R]` 低端机；
③ **意外读数 `chg = 3–4/150`**：静置期渲染模型几乎不变 ⇒ **三臂都在每帧做无效重放**（V 白烧 3 ms、C 白传 6 MB）⇒ 脏帧门控是与载体无关、收益更大的前置。

**推荐（数据侧，⛔ 不是裁定）**：先 **脏帧门控** → 主选 **甲′**（引擎原生、零每帧上传、tris 1/11、无任何未证平台能力）；
**丙′ 降第二候选**（本档最快但 `S0-1` 二值门未过 + 实测每帧 **6,031,680 B** 上传）；**更优形态 = 甲″**（静态底图烘纹理 + 珠层 Sprite 池 + UI 层 Graphics，目标 `dc` 16→≈3）。
⇒ `ADR-0030` DEC-1（采纳丙′）与 §2.5 结论行已标数据修订与指向 §5.0.1；改裁归用户/主理人。

**未闭环（下一步候选，供拍板）**：① S0 第 1 步 wx 侧二值可行性（`wx.createCanvas` + canvas→纹理）——不通则丙′ 直接出局；
② 脏帧门控（可单独开单）；③ 甲′ 正式接线 = S1 carrier 抽象 + 分层修 `dc`；④ `[R]` 真机方向性预读（含 DPR 实读）。⛔ 本批未 commit。

---

## WXG-T-248

**beads·脏帧门控（内容指纹判脏，干净帧不重画）**

**来源**：用户 2026-10-05 令「**先开 WXG-T-248「脏帧门控」**」——采纳 T-247 第七刀数据侧推荐次序的第一项（结论 6：`chg=3–4/150` ⇒ 三臂都在每帧无效重放相同几何）。
本单的性质 = **与载体选型无关的前置收益**：无论最后选 V/C/A 哪条臂，「这帧没变就别重画」都成立。

### 落点裁定（ponytail 阶梯，三条否决给全）

| 候选 | 结论 | 理由 |
|---|---|---|
| **甲：`App._render` 跳过 `onRender`** | ✅ **采纳** | 一处生效两宿主（Cocos + canvas2d 同源）；适配器不需要持有任何跨帧状态 |
| 乙：游戏侧声明 revision（`game.revision` 变了才重画） | ⛔ 否决 | 改动面 = 每个游戏 + 每条动画通道；**漏标一次 = 永久冻屏**，失效面比内容指纹宽 |
| 丙：把 `signature` 塞进 `RenderModel` 返回值 | ⛔ 否决 | `RenderModel` 形状一变 ⇒ `wxg-t-211-s3-seal.json` **整帧封箱基线漂移**（该基线判据是 `JSON.stringify`），要走 QA 复评；本单零必要 |
| 丁：在各渲染器内部各自判脏 | ⛔ 否决 | 两份跨帧状态、两个宿主两套失效口；且 `CocosRenderModelRenderer.draw()` 的 `g.clear()` 与命令重放是原子的，跳过只能从「不调 draw」这一侧跳 |

**指纹实现** = `RenderModelBuilder.signature()`（`packages/framework/src/core/render/render-model.ts`）：
32 位 FNV 风格混合（`Math.imul(h, 16777619)`），数值量化到 **1/64 设计 px**（亚像素抖动按设计**不重画**，⚠ 是契约不是精度损失），
命令字段走 `for...in` 按**插入序**混值（不按键名 ⇒ 新增字段自动纳入，⛔ 无 per-kind switch 需维护），
`polygon` 顶点另走 arena（命令里只有 `offset/count`，不混 arena 会漏判）。

**四条契约**（写在 `signature()` 的 doc 上）：① 只在 `end()` 与下一个 `begin()` 之间有效；② 32 位碰撞的代价 = **一帧陈旧**（非状态损坏）；
③ 1/64 量化按设计；④ `blit` 帧**不参与门控**——`fx` 袋不哈希，掺一个每帧自增的 `_frameSeq` ⇒ 含 blit 的帧**恒判脏**（宁多画不漏画），
   ⚠ **本条已于同日由 WXG-T-250 作废**（`fx` 逐键入门 ⇒ 恒判脏规则与 `_frameSeq` 均删），原文不删留作契约改道证据；
以 `ponytail:` 注释登记上限与升级路径（将来要省这档须给 fx 定义可哈希口径）。

**kill switch** = `App.dirtyGate`（默认 `true`）：既是真机「画面不动」类缺陷的**免重构建诊断口**，也是本批 A/B 的**同一把尺**（探针 `?gate=off` / `setGate(false)`）。
**失效注入点**：`_init()` / `onShow`（微信回前台表面可能已释放）/ `resize()`（设计尺寸不变但宿主表面已换）/ `dirtyGate` 由 false 翻回 true ⇒ 四处一律置 `_lastSig = Number.NaN`（**NaN 永不自等 ⇒ 必重画**，不用 `null` 哨兵是为了让「比较」这条路径零分支）。

### ⚠ 契约变化（宿主侧必读，已登 `control-manifest §8`）

`onRender` **不再是逐帧钩子**：干净帧不回调 ⇒ 宿主不得在 `onRender` 里推进状态、不得依赖 `alpha` 每帧变化（插值补偿须挪到自己的帧回调）。本仓两条现役宿主（`bindings.ts`、harness `harness-runtime.mjs:236`）均已核：前者是纯 `draw()` 转发，后者包 `onRender` 只为捕获 model、内容相同 ⇒ 安全。

### 判据与实测

单测两组（全绿）：`tests/core/render-model.test.ts` 新增 `signature` 六条（同内容同哈希、位置/颜色/文本/尺寸变则变、亚阈值不变、blit 恒变）；
`tests/compose/app.test.ts` 新增门控六条（同内容 5 帧只画 1 次但 `renderCount==5`、内容再变再画、只改墨也算脏、blit 帧 4/4 必画、`resize` 后必画、关档逐帧 3 画且再开不继承旧哈希）。

**A/B 取证**（`[E]` Apple M4 · dpr2 · backbuffer 824×1830 · frames=150 warmup=40 · gpu=timer · 矢量臂 V）：

| zoom | gate | cmds | dc | tris | **tick p50** | tick p95 | **drawn** | draw p50 | gpu p50 | chg |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.6 | off | 2031 | 14 | 37170 | 4.40 | 4.60 | 150 | 3.00 | 2.26 (n149) | 4 |
| 0.6 | **on** | 2031 | 14 | 37170 | **1.20** | 1.40 | **3** | 5.70 (n=3) | 2.51 (n3) | 3 |
| 1.0 | off | 2031 | 14 | 38194 | 4.50 | 5.00 | 150 | 3.20 | 2.45 (n149) | 3 |
| 1.0 | **on** | 2031 | 14 | 38194 | **1.30** | 1.50 | **2** | 5.20 (n=2) | 2.91 (n2) | 2 |
| 2.0 | off | 1916 | 15 | 55145 | 5.00 | 5.90 | 150 | 3.90 | 2.87 (n149) | 4 |
| 2.0 | **on** | 1916 | 15 | 55145 | **1.10** | 1.80 | **3** | 7.30 (n=3) | 2.80 (n3) | 3 |

**最坏档 `--disturb`**（每帧 ±0.004 zoom 抖动 ⇒ 全盘几何都变）：tick `4.40/4.30/5.00` → `4.80/4.80/5.70`，`drawn 150/150`、`chg 150/150`；
`draw p50` 两档持平（3.00/3.00、3.00/2.90、3.80/4.00）⇒ 多出来的部分是**纯指纹代价 ≈ +0.4–0.7 ms/帧**，不是重画变贵。
（⚠ 该档首格 `z0.6-off` 采样窗只收到 **n=125**，`tick n == drawn == 125` 内部自洽，跨组比较时按 n 读。）

**读数结论（四条）**：

1. **省的是 JS/CPU，不是 GPU**：整帧 CPU `4.4–5.0 → 1.1–1.3 ms`（≈**3.6–4.5×**），而 `dc 14/15`、`tris`、GPU p50 `2.26–2.91` **两档一致**
   ⇒ 引擎每帧仍提交同一份 Graphics buffer，门控只省下 JS 侧重放。**不得写成「GPU 减半」**。
2. **开档 `draw p50` 读数反而更高（5.2–7.3 ms）无判别力**：样本只剩 2–3 个脏帧 ⇒ ⛔ 不得与关档 3.0–3.9 比大小；判收益只看 `tick p50` 与 `drawn`（已写进驱动器头注）。
3. **剩余 1.1–1.3 ms = 定步模拟 + `buildRenderModel`**（每帧仍产 2031 个命令对象 + 数组/arena 拷贝）⇒ 门控跳过的是「画」，跳不过「建」。
   想再赚要让玩法侧声明 revision 以跳过「建」，**属下一单不属本单**（正是被否决的候选乙，代价面已记上表）。
4. **`frame p50` 三档恒 ≈16.6–16.8 ms**（vsync 锁定）⇒ 本档对帧耗无判别力，⛔ 不得进性能结论。

**截图差分归因（诚实登记，⛔ 不写成「逐像素相同」）**：开/关两档截图差分有 **0.25–0.34%** 非零像素，
8×10 带直方图定位 = 差异只落在 y10–20 / y70–90 三小簇（HUD 计时文本 + 托盘），**盘面中段 y20–70 逐像素为 0**；
控制对照 = 门控**前**的 `vector-z1.png` vs 今日 g-on（4823 px）/ g-off（3361 px）落在**同样的带**
⇒ 归因为两次运行间的**自然状态漂移**（`createRng(Date.now())` 抽珠 + 计时文本），**非陈旧帧缺陷**。

### 交付物与验证

| 项 | 文件 |
|---|---|
| 指纹 | `packages/framework/src/core/render/render-model.ts`（`signature()` + `_frameSeq`）⚠ `_frameSeq` 已于 **WXG-T-250** 删除 |
| 门控 + kill switch | `packages/framework/src/compose/app.ts`（`dirtyGate` / `_lastSig` / `_render` 分支 / 三处失效 / `onRender` jsdoc 警示） |
| 单测 | `tests/core/render-model.test.ts`、`tests/compose/app.test.ts` |
| 镜像 | `games/{beads,breakout}/cocos/assets/scripts/framework/**`（`pnpm run framework:sync` 写入，各 2 文件） |
| 取证件 | `spike/carrier-bench.ts`（`_tickMs`/`_drawnFrames`/`setGate`/`?gate=off`）、`tools/scripts/carrier-bench.mjs`（`--gates=off,on` 维度 + tick/drawn 列） |
| 契约登记 | `control-manifest.md §8` 两条；`ADR-0030 §5.0.2`（读数与「省 CPU 不省 GPU」） |
| 证据 | `production/qa/beads/evidence/carrier-bench/gate-ab/` 与 `gate-ab-disturb/`（各 json + md + 6 张截图） |

验证：`pnpm run verify` 全量 **PASS 20 / WARN 0 / SKIP 0 / FAIL 0**（含 `framework:sync:check` / `cocos:check` / `check:size` / `harness:smoke` / `check:host-tests` / `check:board-seam`）；
`pnpm -r run typecheck` 三包 Done；`pnpm -r run test` ⇒ framework **433** / breakout **239** / beads **801**(+1 skipped)；⛔ 本批未 commit。
收口轮（文档编辑后）复跑：`verify` **PASS 20 / FAIL 0**·`check:tasks` 主表/详情 **37/37** 配对完整·`check:links` OK·`ctx:build` 已刷索引面。

**沉淀统计（`kb:sync --task=WXG-T-248`）**：**新增 3 / 修改 0 / 激活 0 / 归档 0** ⇒ **K-101**〔判据〕节流类优化会让被优化量样本数骤降而失去判别力；**K-102**〔判据渲染〕跳帧优化落点选回调时机而非返回值形状（形状一变击穿整帧封箱基线）；**K-103**〔测试〕截图差分非零不直接计缺陷（先带直方图定位 + 历史对照）。更正日期口径后二次跑：**新增 0 / 修改 3**；`kb:audit` 无归档候选、无相似命中。

**未闭环（下一步候选）**：① 「建」侧的 revision 通道（跳过 `buildRenderModel`，收益上限 = 再省 1.1 ms）；
② 回 `ADR-0030 §7 Q1` 裁载体（门控先吃掉了静置期的无效重放 ⇒ 换臂增量收益需按门控后重算，C↔A 的纯载体对比此时才干净）；
③ wx 侧 `S0-1` 二值可行性；④ `[R]` 低端机方向性预读（本组全部为 `[E]`，⛔ 不得记 D1/D2 达线）。

---

## WXG-T-249

**beads·甲″ 分层上界实测（取证面新档）**

**来源**：用户 2026-10-05 在「（离屏 canvas + 上传）vs（按色图集 + Sprite 池）」对照之后择 **(A)「开 甲″ 三层工程单」**。
外部调研同向（业界把「每帧全量纹理上传」列为移动端反模式、2D 网格类走图集 + 渲染序连续 + UI 分层），故本单的目标不是选型，
而是**把「甲″ 三层到底能省多少」钉成数**，再决定值不值得申请生产接线。

### 落位裁定（ponytail full 阶梯，三档给全）

| 候选 | 实装面 | 裁 |
|---|---|---|
| **甲** 取证面新档：`carrier-bench` 加 `layers=full,beads` 维度（`beads` = 非珠层整体停用） | 一个开关 + 一行分支 + 一处显隐收口 | ✅ **采纳**。零生产改动即可出上界数 |
| **乙** 直接把三层接到生产（静态底图烘纹理 + 珠池 + UI 位置同步） | `cocos-renderer` / `beads-shell` / 场景节点树 | ⛔ 否：`DEC-1` 未裁，ADR-0030 明文「代码在裁定前不动」；**没有数就上三层 = 把最大一笔改动裸做** |
| **丙** 先让 `signature()` 能判 blit 脏（本批结论 3 的修法） | 框架 `render-model.ts` + 单测 | ⛔ 不属本单（框架单需独立领号 + 单测）；但本批读数正是它的立项理由 |

**为什么用「关组件」而不是「不喂命令」**：`CocosRenderModelRenderer.draw()` 内部才做 `g.clear()`，不喂命令只会让上一帧内容继续提交
⇒ 读数变成「冻住的矢量层」而非上界。两处显隐（`setArm` 与 `setAtlasLayers`）收进**同一个** `_syncLayers()`（⛔ 两处各写一遍必漂）。

### `[E]` 实测（Apple M4 · dpr2 · 824×1830 · frames=150 warmup=40 · gate=on · 三档 zoom）

| zoom | layers | dc | tris | draw p50 | GPU p50 | tick p50 | drawn | chg |
|---|---|---|---|---|---|---|---|---|
|0.6|full|15|3354|1.00|2.15|1.40|150|4|
|0.6|beads|**2**|**740**|**0.10**|**0.81**|0.90|150|4|
|1.0|full|15|3354|0.90|2.17|1.30|150|3|
|1.0|beads|**2**|**740**|**0.10**|**0.79**|0.90|150|3|
|2.0|full|15|3137|0.90|2.26|1.40|150|4|
|2.0|beads|**2**|**708**|**0.10**|**0.42**|0.70|150|4|

### 读数结论（四条 + 一处自我更正）

1. **甲″ 收益真实且大**：`dc 15 → 2`、tris −78%、draw CPU −90%、GPU −63～−81% ⇒ 非珠层（静态底图 + HUD 矢量）在甲′ 里
   占了 **13 dc + ≈0.8 ms CPU + 1.3–1.8 ms GPU**，且**三档 zoom 恒定**（与内容无关）⇒ 纯节点树形态，零平台押注。
2. ⚠ **归因更正（推翻 §5.0.1 结论 7）**：`dc 16/15` **不是**「Sprite 与 `cc.Graphics` 交错 ⇒ 合批被打断」，而是**相加**
   （非珠层 13 + 珠池 **2**；280 个 Sprite 自己就合成 2 批 ⇒ 图集/合批在本档已实证，`ADR-0022 D6` 的怀疑桌面部分可销）。
   待修项随之从「排序避免打断」改为「**别让非珠层每帧全量重放**」。
3. 🔴 **门控对含 `blit` 的模型恒判脏**：两档 `drawn` 都 **150/150** 而 `chg` 只 3–4 ⇒ `render-model.ts:500` 那条在册 `ponytail:`
   上限今天撞到，而且**正好撞在推荐主选臂**——其登记理由「它们的成本在上传不在重放 ⇒ 损失小」被本批读数推翻：
   **甲′/丙′ 目前完全拿不到 §5.0.2 的门控收益**。下一口最小收益单 = `signature()` 逐键走 `fx`，收益上限 = 本表 `beads` 那行。
   可行前提已核：blit 的 `textureId` 等身份字段是字符串、已被现有 `for...in` 混入，缺的只是 `fx` 这层对象（当前只混 number/string）。
4. **抖动如实登记**：本次 `full` 档 `dc=15`，§5.0.1 那次 A 臂 `dc=16` ⇒ 差 1 批（节点态/Label 属件抖动），⛔ 不得据此说「改动生效」。

### 交付物与验证

| 项 | 落点 |
|---|---|
| 上界档开关 | `games/beads/cocos/assets/scripts/spike/carrier-bench.ts`（`_atlasLayers` / `setAtlasLayers` / `_syncLayers` / `?layers=beads` / `atlasLayers` 列） |
| 驱动 | `tools/scripts/carrier-bench.mjs`（`--layers=full,beads` 维度，仅对 `atlas` 臂展开 ⇒ ⛔ 不为其余臂白跑同档） |
| 回写 | `ADR-0030`：新增 **§5.0.3**、头注**第九刀**、§5.0.1 结论 7 就地加更正（原文不删）、三臂优缺点表 A 行加两条 ⚠ |
| 证据 | `production/qa/beads/evidence/carrier-bench/layers-ab/`（json + md + 6 张截图，`beads` 档截图可见底图/HUD 缺失 = 上界档的画面代价） |
| 台账 | `TASKS.md` 头注 → **250** + 本行；本详情节 |

生产代码**零改动**（含框架镜像）⇒ `framework:sync` 无需重跑。验证（文档定稿后复跑）：`pnpm run verify` **PASS 20 / WARN 0 / SKIP 0 / FAIL 0**（逐项 20/20，含 `typecheck` / `test` / `cocos:check` / `framework:sync:check` / `harness:*`）· `check:tasks` 主表↔详情配对 OK · `check:links` OK（agents=7 skills=39）· `build:cocos:web` ✅（13.1 s）· `node --check carrier-bench.mjs` ✅ · `ctx:build` 已刷索引面；⛔ 本批未 commit。

### 未闭环（下一步候选）

① `signature()` 逐键走 `fx` ⇒ 让甲′/丙′ 吃到门控（**收益上限已有数 = 本表 `beads` 行**，属框架新单）；
② 第三档实测（只烘静态底图、UI 照旧重放）⇒ 定甲″ 三层里「底图 vs HUD」的拆分比例；
③ `DEC-1` 改裁（若裁 甲′，实施面须按**甲″ 三层**写，否则把 13 dc 带进生产）；
④ wx 侧 `S0-1` 二值门；⑤ `[R]` 低端机方向性预读（本组全部 `[E]`，⛔ 不得记 D1/D2 达线）；
⑥ `render-model.ts` 里那句 `ponytail:` 注释的**理由**已被本批实测推翻（「损失小」不成立）——正文只改理由不改上限，与 ① 同一框架单内完成（本批零生产改动 ⇒ 不在本批动）。

### 沉淀统计（`kb:sync --task=WXG-T-249`）

- **新增 1**：**K-104**（`[引擎Cocos]`）——上界档必须**停用组件本身**而非「不喂命令」：`clear()` 在绘制入口内部，不喂 = 上一帧内容继续提交 ⇒ 读数成一份冻住的旧画面；并附「多档显隐收敛单一 `_syncLayers()`」与「驱动脚本按臂收敛循环」两条做法。
- **修改 1**：**K-102**（`[判据渲染]`）——追加追记：其 ④ 项给含 blit 帧判脏写的上限理由「每帧成本在上传不在重放 ⇒ 损失小」已被本批推翻（非珠层仍付 13 dc + ≈0.9 ms CPU）；做法升级为「`ponytail:` 上限必写可验前提，拿到相反数先改理由再回写 ADR，并升格为硬前置」。
- **激活 0 / 归档 0**；`kb:audit` 无归档候选、无相似命中。

---

## WXG-T-250

### beads·blit 帧可判脏（`fx` 逐键入指纹 ⇒ 门控覆盖 C/A）

**来源**：用户 2026-10-05 在 WXG-T-249 汇报后择 **(A)**（「甲」= 开框架单让 `blit` 可判脏）。承 `ADR-0030 §5.0.3` 结论 3 与未闭环 ①/⑥。

**落位（ponytail 阶梯）**：rung 2——不新建机制。`signature()` 已在册，只是字段遍历只认 number/string ⇒ 对象被跳过。
⇒ 最短正解 = **把「只混两个类型」换成一个递归 `mixVal`**，并**删掉**旧的保守出口（`_frameSeq` 字段 + `begin()` 自增 + `if (hasBlit) mix(...)`）。
⛔ 不加 fx 键名白名单、⛔ 不加 revision 通道（那属另一单）。

**为何合法（先核再改）**：`BlitFx` 值域本就是 JSON 安全封闭联合（`string | number | boolean | readonly number[]`），且类型文档规则 4 明文「键序由构造方固定」
⇒ 与现有「命令字段按插入序混」同口径；数组走 `for...in` 即索引序，无需特例。**热路径零新增分配**（无新集合，仅递归调用）。
**安全前提已核**：blit 内容是否可能「同 `textureId` 就地变」？两条链都不会——tint 走 `cache.get(textureId, base)`（`base` 在 `fx` 里，本批入门），
bake 走 `bake:<styleId>:<colorIdx>` 且 `bakeSize = BAKE_CANONICAL_SIZE`（常量，不随 zoom/dpr）⇒ 不会因换档而「同 id 换像素」。

**实测（`[E]` Apple M4 · dpr2 · frames=150 warmup=40 · gate=on · zoom 1.0）**

| 臂 | 修前 drawn | 修后 drawn | 修前 tick p50 | 修后 tick p50 | dc | tris | 上传 |
|---|---|---|---|---|---|---|---|
| V（无 blit，对照） | 2–3 | **3** | 1.30 | 1.30 | 14 | 38194 | 0 |
| C 丙′ | **150** | **3** | — | **0.40** | 2 | 182 | 6,031,680 B × **3 帧** |
| A 甲′ full | **150** | **2** | 1.30 | **0.40** | 15 | 3354 | 0 |
| A 甲′ beads（上界） | **150** | **2** | 0.90 | **0.40** | 2 | 740 | 0 |

最坏档（`--disturb`，每帧都变）tick：V **5.10** / C **1.40** / A **1.40** ms ⇒ 递归走 `fx` 的代价读不出（每 blit 一个键）。
⚠ 无判别力的列（承 K-101）：开档 `draw p50` / `gpu p50` 样本只剩 **2–3 帧** ⇒ 判收益只看 `tick p50` + `drawn`。
⚠ V 本轮 disturb 5.10 vs §5.0.2 的 4.80 = 运行间漂移（V 不含 blit），⛔ 不得归因为本批。
**画面正确性**：`drawn=2–3` 的静置截图目测仍为**完整盘**（128 珠 + HUD + 托盘），非黑帧/非缺珠。

**交付物**

| 项 | 文件 |
|---|---|
| 指纹换档 | `packages/framework/src/core/render/render-model.ts`（`signature()` 递归 `mixVal`；删 `_frameSeq`；`ponytail:` 上限改写为「计引用不计像素」） |
| 单测 | `tests/core/render-model.test.ts`（blit 四腿：同内容同指纹 / `fx` 值变 / 数组载荷变 / 有无 `fx`）、`tests/compose/app.test.ts`（blit 四 tick 只画 1 次，改 `fx` 必再画） |
| 镜像 | `games/{beads,breakout}/cocos/assets/scripts/framework/core/render/render-model.ts`（`framework:sync` 各写 1） |
| 回写 | `ADR-0030`：头注**第十刀** + 新增 **§5.0.4** + §5.0.2 机制句就地标作废 + §5.0.3 结论 3 标关闭与硬前置已满足 + §5.1 标题改指 |
| 台账 | `TASKS.md` 头注 → **251** + 本行；T-248 详情节两处就地括注；本详情节 |
| 证据 | `production/qa/beads/evidence/carrier-bench/gate-blit-ab{,-disturb}/`（json + md + 逐臂截图） |

**验证**：`pnpm run framework:sync` ⇒ beads 写 1 / breakout 写 1；`pnpm --filter @wxgame/framework test` **433 passed**；beads **801 passed + 1 skipped**；
`build:cocos:web` ✅ · `node tools/scripts/carrier-bench.mjs` 两轮（静置 + disturb）✅ · 文档定稿后 `pnpm run verify` **PASS 20 / WARN 0 / SKIP 0 / FAIL 0**（含 `framework:sync:check` 镜像齐 / `typecheck` / `cocos:check`）· `check:tasks` 39/39 · `check:links` OK · `ctx:build` ✅；⛔ 本批未 commit。

**沉淀统计（`kb:sync --task=WXG-T-250`）**：**新增 0 / 修改 1 / 激活 0 / 归档 0**，`kb:audit` 无候选。
修改的 **K-102** 追加「追记二」：① 上限换档（`fx` 本就属 JSON 安全封闭联合且键序由构造方钉住 ⇒ 「无可哈希口径」不成立，一个递归 `mixVal` 即可）；
② 可复用判据：**保守出口（恒判脏）往往是「没查值域」而非「查了做不到」**；③ 新上限的登记格式 = 同时列出「为何今日安全」与「何时失效」。

**未闭环**：① 本批只修地基，**`DEC-1` 仍待裁**（`§7 Q1`）⇒ ✅ **同日 WXG-T-251 已裁 = 甲′ / 甲″ 三层**；② 甲″ 三层的**生产接线**未做（取证面仍是 `beads` 上界档）；③ 第三档（静态底图 vs HUD 拆分比例）仍未测；
④ wx 侧 `S0-1` 二值门；⑤ `[R]` 低端机（含本批的指纹递归代价）。

---

## WXG-T-252

### framework·S1 blit carrier 缝（Cocos 侧宿主注入出口）

**来源**：用户 2026-10-05 令「先解释下甲的方案，再开始实施」⇒ 甲 = `ADR-0030` 裁后路由里的 **S1**（第十一刀标为「第一优先、⛔ 唯一硬前置」）。

**先核后写（ponytail 梯子 rung 2）**：`case 'blit'` 在 `cocos-renderer.ts:201` 已是 warn-once + skip；canvas2d 侧同一条命令已有「注入一个钩子、渲染器不认识效果」的成熟形状（`BlitResolver`，`ADR-0029 §8.1`）
⇒ 本单**不发明新机制**，只把同一形状从「取图」换成「交出」（Cocos `Graphics` 无 `drawImage`，blit 在此根上无法自行落地）。

**交付（三个文件面，共 +37 行）**：

| 位置 | 改动 |
|---|---|
| `packages/framework/src/adapters/cocos/cocos-renderer.ts` | 新增结构类型 `CocosBlitCarrierLike { accept(cmd: BlitCommand, x: number, y: number): void }` + `CocosRendererOptions.blitCarrier?` + 字段赋值；`case 'blit'` 改为「有 carrier ⇒ `accept(cmd, cmd.x + ox, cmd.y + oy)` 后 `break`；无 carrier ⇒ 原 warn-once 一字不改」 |
| `packages/framework/tests/adapters/cocos-renderer.test.ts` | 两腿判据：① 注入必交接，且 `taken[0].cmd` **`toBe`** 原命令对象（零拷贝，`fx` 槽原样在内）、坐标 `(-90, -180)` 走同一套居中换算、`calls` 等于 `['clear']`；② 未注入 ⇒ `['clear','clear']` + `console.warn` **恰一次** |
| 两镜像副本 | `pnpm run framework:sync` ⇒ beads 写 1 / breakout 写 1 |

**三个刻意的不做什么**：
① ⛔ **不加 `beginFrame()` 帧边界回调**——宿主自己驱动 `draw()`，生命周期信号它本来就有（已在代码里留 `ponytail:` 注释与升级路径）；
⇒ ✅ **该升级路径已于 WXG-T-253 触发**：实现体需要「本帧开头收上一帧用剩的 `Sprite`」，而 `draw()` 是 `bindings.ts` 驱动的、载体看不见帧头
⇒ 补的是**可选**钩子 `beginFrame?()`：不实现的载体零调用，本单那两腿判据不变。
② ⛔ `accept` **返回 `void`**，不返回 `boolean` —— 返回布尔就是在诱使渲染器「没接住就回落」，而带 `fx` 的命令回落 = 用错色（`ADR-0029 §8.1` 总责语义）；
③ ⛔ 不拆 `cmd.fx`、⛔ 不抄只读字段进参数 —— `BlitFx` 键名不进类型，传原对象 ⇒ 以后加第 N 种效果改框架 **0 处**。
铁律合规：⛔ 不 import `cc`、不进 `core`、不进框架 barrel（L2/L3）；热路径零分配（无 `new`、无拷贝）。

**验证**：`framework:sync` ✅ → `pnpm --filter @wxgame/framework test` **435 passed**（+2 条新判据）· beads **801 passed + 1 skipped**（含 `bead-style-seal` = **TC-TINT-16 矢量臂逐字节不变**腿绿）
· `typecheck` ✅ · `cocos:check` ✅（检查 2 / 失败 0）· `framework:sync:check` ✅（镜像一致，含 §12 ES5 契约）· 收口复跑 `pnpm run verify` **PASS 20 / WARN 0 / SKIP 0 / FAIL 0**（含 `check:tasks` 41/41 配对、`check:es5spread`、`check:size`）；⛔ 本批未 commit。

**沉淀统计**：**0 条新增**——本批可复用判据均已在册（「加一种效果改几处 = 0」属 `ADR-0029 §8.2`；「未注入腿零漂移」属 K-082 封箱家族；「领号认头注 + 主表 5 列」属 K-046 与上一批的 K-105），⛔ 不注水。

**未闭环**：① carrier **实现体**未交（图集 + `Sprite` 池 + 材质 = **S5′**，需先裁 §5.2 末三条门禁）⇒ ✅ **已由 WXG-T-253 交 L1 珠层**（S5′-1），L0/L2 归 S5′-2/-3；② 现网尚未注入 ⇒ 真机仍走矢量臂（本单不改行为）；
③ S3 两端对拍；④ `[R]` 低端机；⑤ wx 侧 `S0-1`。

---

## WXG-T-253

- **名称**：beads·S5′-1 blit 载体实现体（按色图集 + `Sprite` 池）
- **负责**：主理人(Qoder) ⇒ 程基岩域（工程实现）
- **状态**：🚧 已落码、未 commit
- **上游**：`ADR-0030 §3 DEC-1`（甲′）/ `DEC-2`（载体缝）· `§5.2` 三条门禁 · `§5.3` S5′ 分段 · WXG-T-252（S1 缝）

**用户原话与流程**：「甲」（= 上批四选项之 (A)：裁 §5.2 末三条门禁 ⇒ 出 S5′ 实施计划 ⇒ 落 carrier 实现体）。
三条门禁不代裁：先取四个硬事实（命令 2990 条里 blit 只占 148 条＝ 5%、现网**只有一块 `Graphics`**（`bindings.ts:177`）、
`drawBackgroundLayers` 不含 clock、`Graphics.clear()` 无局部擦除），再以选项题求裁 ⇒ 三项均取推荐项。

**交付面（净增 ≈335 行）**：

| 文件 | 内容 |
|---|---|
| `host/beads-blit-carrier.ts`（新 285 行） | 实现体：4 张 mask 走 `assetManager.loadAny({uuid})`（正本 = `assets/textures/*.png.meta`，⛔ 不新造资源）→ `TintSpriteCache`（**与 harness 同一份** CPU 预合成）→ 8×8×128² 图集纹理 → `Sprite` 池（`setContentSize(w,h)` + `setPosition(x+w/2, y+h/2)`） |
| `framework/src/adapters/cocos/cocos-renderer.ts` | `CocosBlitCarrierLike` 加**可选** `beginFrame?()`；`draw()` 开头在有该钩子时调一次（无钩子 ⇒ 零调用） |
| `framework/src/adapters/cocos/bindings.ts` | `protected createBlitCarrier(root: Node): CocosBlitCarrierLike \| null`（默认 `null`），`_bindRenderer()` 读一次入 options |
| `BeadsBootstrap.ts` | 覆写钩子 ⇒ `maybeCreateBeadsBlitCarrier(root)` |
| `tests/adapters/cocos-renderer.test.ts` | 第一腿加帧边界断言：`draw()` 两次 ⇒ `beginFrame` 两次、且先于该帧第一条 blit |

**两个不分段就会坑人的约束**：

1. **默认关**：`?carrier=on`（web）/ 启动参数 `carrier=on`（wx）才接线；关 / 离屏 canvas 不可用 / mask 不足 4 张 ⇒ 都返回 `null`
   ⇒ 不注入 ⇒ 框架走 warn-once skip ⇒ **现网逐字节不变**。翻默认的时机 = S3 对拍过。
2. **tint 运行时晚于载体就绪**：`setBeadTintRuntime()` 只在 4 张 mask 全就绪后注入。反序会出现「blit 已发出而载体未备」
   ⇒ `Graphics` 画不出 blit ⇒ **珠子静默消失**；本约束把失败模式锁成「保持矢量臂」。

**ponytail 选了什么 / 拒了什么**：取 `TintSpriteCache`（已在册、与 harness 同源）而非重写合成；取 `ctx.createImageData` 降级链而非猜全局 `ImageData`；
`cmd.alpha` **不实现**（珠层 tint 臂只挂 `fx`）但出现即 `console.warn` 一次，⛔ 不静默画成不透明；⛔ 一次写三层（已拒：不可验证）；
⛔ 不加 `__WXG_CARRIER_DEBUG` 读数口（S3 对拍自有 bench 读数口，等真需要时再加）。

**残留缺陷（明文）**：珠层节点排在 `Graphics` / `Labels` **之后** ⇒ sprite 会盖住 HUD 面板；根因 = 现网只有一块 `Graphics`，盘面底图与 HUD 同体提交
⇒ 插前插后都错一侧。解除 = S5′-2 把 B0 挪出 `Graphics` 后改插之前（已写在 `_atlasNode()` 的 `ponytail:` 注释）。

**验证**：`framework:sync`（两镜像各写 2）→ framework **435 passed** · beads **801 passed + 1 skipped**（含 `bead-style-seal` = TC-TINT-16 矢量臂腿）
· `typecheck` 4 包 ✅ · `cocos:check` **检查 2 / 失败 0**，并用 `tsc --listFiles` 核到新文件**确实在检查程序内**（⛔ 不假定「跑了 = 检了」）
· `framework:sync:check` ✅ · 收口 `pnpm run verify` **PASS 20 / WARN 0 / SKIP 0 / FAIL 0**；⛔ 本批未 commit。

**沉淀统计**：`kb:sync --task=WXG-T-253` ⇒ **新增 1 / 修改 1 / 激活 0 / 归档 0**：新增 **K-106**（[工具链]「门禁跑过」≠「新文件被门禁看到」，`--listFiles` 自证法）；修改 **K-057**（追记：上一批的「⛔ 不加 X」禁令被下一批触发时必须同批回写原处）。`kb:audit` 无归档候选。

**未闭环**：① **S5′-2（L0 烘底图）** 未开 ⇒ 2842 条/帧矢量命令大头仍在；② **S5′-3 层序** 未核；③ 默认关 ⇒ 真机尚未跑 sprite 臂；
④ **mask 在打包产物里是否保留**未验（`loadAny({uuid})` 编辑器 Preview 可用，构建侧未接）；⑤ S3 两端对拍；⑥ `[R]` 低端机（含 280 个 `Sprite` 节点成本）。

---

## WXG-T-254

- **名称**：beads·S5′-2 L0 底 tile（盘面每格 B0 + 格面槽合并为一条 blit）
- **负责**：主理人(Qoder) ⇒ 程基岩域（框架 + 视图 + 两个宿主）
- **状态**：🚧 已落码、未 commit
- **上游**：`ADR-0030 §5.3` S5′ 分段 / `§5.4` 本刀实录 · DEC-3（同源 = 同代码）· WXG-T-253（S5′-1 L1 珠层）

**用户原话（三刀，最后一刀为准）**：① 「甲，但是要先和我确认 L0 烘哪些内容在底图上再实施」；
② 「128px mask 绘制在 33dp 的 L0 上」；③ **决定性纠正**：「你搞错了，为了将格子之间的缝隙给掩盖住，
格子合成纹理的**画布设定为 33dp**，但是 **mask 图片只是绘制 32dp 的区域，在画布居中绘制**，
33dp 主要目的是**背景色统一**，绘制的纹理**还是保持之前的状态**」。

⇒ 落地口径 = **画布 33dp / 内容居中不放大**。第二处口径订正沿用 2026-10-04 二十六批那一条：
用户写的 `32` = `BEAD_PITCH`（格距），blit 内容的正本外框 = **`BEAD_CELL 30`**（= PITCH − GAP 2）
⇒ 像素域 `inner = round(128 × 30/33) = 116px`（off 6px），**128² 图集格零改动、零显存增量**。

**为什么不是「把 128px mask 拉伸铺满 33dp」**（我前两轮的误读，A/B 推翻）：槽口 ⌀24→26.4dp、斜面 3→3.3dp，
而珠体静息只有 26dp ⇒ 每颗珠四周露出一圈槽底。实测：静息最大差 90/255、差 >8 占 4.1%（抬起 14.1%）。

**A/B 四组读数**（脚本 `tools/scripts/l0-tile-ab.mjs` → 图 `production/qa/beads/evidence/l0-tile-ab/`；真 mask PNG + 真 `compositeTintMask` + **将要上线的** `composeMaskTile`；判据 = 36×36dp 裁块，阈值「差 >8/255」占比）：

| 方案 | 静息 | 抬起 6.72dp |
|---|---|---|
| 甲 33dp（144px 扩边缩放） | 6 / 0.0% | 68 / 1.7% |
| 甲 原生 33.75dp（144px 不缩放） | 136 / 2.1% | 136 / 2.9% |
| 128px 直接铺 33dp（⛔ 拉伸） | 90 / 4.1% | 90 / 14.1% |
| **本刀：128px 画布 + 内容 116px 居中** | **8 / 0.0%** | **23 / 0.6%** |

⚠ **取证脚本自纠（本单最重要的一条方法论）**：首版 `now` 臂把「有珠格」建模成 `rect + 珠`，漏了 WXG-T-236 八轮起
「**有珠格也画坑底**」这一层 ⇒ 差值图里那一弯新月是**脚本少画一层**、不是合并代价。补层后本刀抬起读数 **8.1% → 0.6%**。
教训 = A/B 的「基线臂」必须逐层对齐现役代码，否则会把取证工具的缺陷卖给设计裁定。

**交付面（7 文件，净增 ≈150 行）**：

| 文件 | 内容 |
|---|---|
| `packages/framework/src/core/bake/mask-tile.ts`（新 102 行） | `MASK_TILE_SUFFIX` / `isMaskTileId` / `maskTileSourceId` / `maskTileInnerPx` / `composeMaskTile`（**纯 TS 双线性**：边缘色铺满 + 内容居中缩小。⛔ 宿主 `drawImage` ⇒ 采样核随宿主变，两端字节不等，违 DEC-3） |
| `packages/framework/src/core/index.ts` | `export * from './bake/mask-tile.js'` |
| `adapters/canvas2d/tint-sprite-cache.ts` | 可选 `tileInnerPx`；`_maskPixelsOf` 见 `__tile` ⇒ 吃**源 mask 像素**派生（未配 ⇒ `undefined` = 宁落矢量臂，⛔ 不猜缩放比）；抽出 `_storeMask()` 共用入缓存路径 |
| `games/beads/src/view/bead-tint-mask.ts` | `MASK_TILE_ID_TABLE` + `tintTileMaskId()`（单开一表，⛔ 不扩 `BeadMaskKind` —— 那个联合同时是**烘焙面种**，tile 只是新包装不是新面） |
| `games/beads/src/view/bead-render.ts` | `BeadTintRuntime.getTileMaskId?()`（可选 ⇒ 未实现 = 今日）；`createWhitelistBeadTintRuntime` 按**去后缀 id** 问宿主、返回 tile id ⇒ 宿主注册表零新增条目；`drawTargetTile` 返回 `void→boolean` + 第 7 参 `TargetTileOptions` |
| `games/beads/src/view/view-model.ts` | 循环外建**一枚** `tileOpts`（空格 / 有珠格共用 ⇒ 两分支同参由对象字面量结构性保证）；命中 ⇒ 跳过本格 `drawEmptySocket`；⛔ `isWrong` 那一格不合并 |
| `host/beads-blit-carrier.ts` + `dev/harness/main.ts` | 各传 `tileInnerPx = maskTileInnerPx(BEAD_PITCH + TILE_BLEED×2)`（同一式子）；harness 预热集由 4 张源 mask 改为「2 珠面 + 2 底 tile」 |

**ponytail 选了什么 / 拒了什么**：取「tile = 源 mask 的**派生形态**（后缀分流）」而非新造资产 ⇒ 图集与打包零改动；
取「纯 TS 双线性」而非 `drawImage`；⛔ 不扩 `BeadMaskKind`、⛔ 不给 tile 单开一张资产表、⛔ 不为 tile 加 LOD 阀（缩小居中不属于放大回退管的事）；
⛔ 不扩 Cocos 图集（`ATLAS_COLS` 只记 30/60 格账，等真机读数拍板）。

**三条不能省的约束**：① DEC-3 同源 ⇒ 派生逻辑住框架共享层；② **wrong 抖动格不合并**（坑住进底图就吃不到 `dx`，
推到 `bx` 就是 T-242 的「地皮在抖」）；③ **预热集只换不加**（预算 2.5 MiB ≈ 40 张 sprite，6 面都烘 = 60 张会把热路径珠面挤出 LRU ⇒ 首帧反而 miss）。

**验证**：`framework:sync`（写 6 / 未变 94）→ framework **443 passed**（新增 `mask-tile` 6 条 + cache tile 分流 2 条）
· beads **806 passed + 1 skipped**（新增 `drawTargetTile` tile 臂 4 条 + 白名单 1 条；`bead-style-seal` = TC-TINT-16 矢量臂逐字节不变腿仍绿）
· `typecheck` ✅ · `cocos:check` 检查 2 / 失败 0 · `framework:sync:check` ✅ · `check:board-seam` OK
· 收口 `pnpm run verify` **PASS 20 / WARN 0 / SKIP 0 / FAIL 0**；⛔ 本批未 commit。

**沉淀统计**：`kb:sync --task=WXG-T-254` ⇒ **新增 1 / 修改 0 / 激活 0 / 归档 0**（新增 **K-107**：像素 A/B 的基线臂必须逐层对齐现役绘制序）。

**未闭环**：① **S5′-3 层序**未开（珠层仍排 `Graphics` 之后；本刀把 B0 从 rect 变 blit ⇒ 层序问题没变好也没变坏）；
② 默认关 ⇒ 真机尚未跑 sprite 臂，S3 两端对拍未做；③ `[R]` 低端机（含图集 60/64 余量与 LRU 工作集）；
④ mask 是否进打包产物未验；⑤ 抬起 0.6% 残差（116/128 重采样在斜面边缘 ≤1 device px 软化）若美术要清零，改的是 mask 档位（256²）而非本包装。

---

## WXG-T-267

**皮肤替换系统架构设计（🔵 架构设计中，程基岩）**

用户令：考虑现有整体珠面**从生成到盘面产生**的所有可替换元素，设计**皮肤替换能力**，
可设计**一整套元素**做替换。

### 背景：把 A/B 之争升级为皮肤系统

此前「UI 适配盘面（A）/ 盘面适配 UI（B）」的方向之争，用户升维为：
**两套都做 —— 作为可整套切换的皮肤**（如「暖纸拼豆台」/「瓷白工作台」/「手绘蜡笔」各成一肤）。

### 关键先例（工程已探明）

- **WXG-T-131 ③**：`beadStyle` 换肤占位已落（demo 阶段：解锁判定 + 一套占位皮肤）
- **v1.5-r4 ③ 结论**：`BEAD_PALETTE`（Object.freeze 模块级）+ `drawFilledBead` **签名无 palette 形参**
  ⟹ 珠体十层对主题化零参数通道 ⟹ **需工程最小重构**（当时已给最小改法建议）
- 封箱体系对 hex 敏感（色表锁 35 条 + sha1；整帧 provenance）

### 范围（待程基岩产出）

1. 全链路可替换元素**盘点**（珠面十层 / 格 / 槽 / UI 令牌 / 形状参数）
2. 皮肤包**数据结构与切换机制**（palette 参数化 / recipe 参数化路径）
3. 与封箱体系的关系（每肤一套封箱？归一化？）
4. MVP 拆分

### 用户四裁（2026-10-07，全部关闭）

- **Ⅰ 切肤不重置珠体风格**（beadStyle 独立记忆）✅
- **Ⅱ 皮肤入口 UI 暂不实现**：切换走**宏定义**（构建期），无运行时选择、无持久化 UI
  ⟹ D3 切换机制随之简化：无「运行时切换 vs 启动时选择」之辨，宏定值即当前肤
- **Ⅲ 第一肤 = tokens.md 甲案「暖纸拼豆台」** ✅
- **Ⅳ `endpointCoeffs` 首批 8 系数全开** ✅

---

## WXG-T-264

**主界面 UI 重设计提案「手作治愈系」+ 游戏名备选（📋 未排期）**

用户令：重新设计主界面 UI，需整体风格、体现玩法、游戏名备选；按钮按现有功能定义。

### 设计稿

`games/beads/design/art/proposals/ui-redesign-mock.png`（两屏并排，实验页 `temp/ui-redesign/index.html`）。

### 风格：「手作治愈系」

奶油纸纹底 + 木牌容器（HUD/托盘：木色渐变+深木边+木钉）+ 纸板卡（道具/缩放）+
手绘蜡笔珠面（**依赖 WXG-T-263 先行**）。珠子高饱和色 = 唯一鲜艳来源 ⟹ 作品自动成为焦点。

### 玩法表达三处

① 标题文字**用拼豆拼出来**（玩法即品牌；`beadText` 点阵字组件，设计稿已验证可读、字号需加大）；
② 对局页目标提示条「把绿色豆豆放进同色空格」；③ 现有 hint 虚线目标环沿用。

### 现有功能映射（零新功能）

boot 标题页（开始按钮）；playing：木牌 HUD（计时/LV/暂停）、画布、木槽托盘 6+6（`expandTray`）、
纸板道具三卡（解环/补豆/随机）、缩放条（`drawZoomControls`）、目标提示条（纯显示）。
`restartRun` 与 paused/game-over/finish 相位页留待后续换肤。

### 游戏名 6 备选（均含品类词利于微信搜索）

豆豆森林（⭐推荐：树主题+系列化）/ 拼豆小铺 / 拼豆物语 / 拼豆工坊 / 豆趣拼拼 / 颗粒成画。

### 实施路径（届时）

263 质感先行 → palette 换肤（纸底+木牌）→ boot 标题页新增 → 道具卡/HUD 换肤 → 封箱复评。

---

## WXG-T-263

**珠面「手绘蜡笔质感」程序化调研留档（📋 未排期）**

用户提供关卡页面整体 UI 参考图（树形拼豆 + HUD + 托盘 + 道具卡），问「能否程序化实现」。

### 核对结论

**该图约 90% 已是工程程序化渲染**（就是 harness 的输出：pattern 关卡 / drawHud /
drawZoomControls / drawTray / drawExpandButton / drawPowerupBand+Glyph / 十层珠面）。
唯一差距 = 珠面「手绘蜡笔质感」（粗墨描边 + 斑驳噪点 + 双色区带）。

### 调研结论：程序**能**画出手绘质感

独立 Canvas 实验页（`temp/handdraw-lab/index.html`，零侵入生产渲染）四档对比：

| 档 | 手法 | 观感 |
|---|---|---|
| A | 现状：纯几何 + 1px 同色自描边 | 干净「塑料感」 |
| B | 描边 `0.11×R` + 轮廓顶点 ±4.5% 抖动（14 边形近似圆） | 立刻手绘感 |
| C | B + 每珠 5 个伪随机深浅斑（压暗 16%/提亮 12%，α≈0.3） | 蜡笔颗粒感 |
| **D** | C + 对角双色渐变（左上提亮/右下压暗） | **最接近参考图** |

对比稿：`games/beads/design/art/proposals/handdraw-bead-texture-compare.png`（四档并排 + 整树远看）。

### 工程要点

1. 抖动描边 `circle → polygon` ⟹ **图元数不变**，封箱压力最小
2. 噪点斑 +5 `circle`/珠 ⟹ 满盘 156 珠 ≈ **+900 图元** ⟹ 实施需重算静态基线四口径（①~④）
   + 过封箱复评（T-211 体系，流程有先例）
3. ⛔ **帧一致性硬约束**：所有随机必须 `seed = 格坐标`（mulberry32 等确定性 PRNG），
   **绝不可 `Math.random()`**——否则每帧闪烁，LOD/帧一致判据直接爆

### 踩坑

首版描边 `0.22×R` + 近黑色 → 远看糊成黑块 ⟹ 收到 `0.11×R` + 深绿 `#2a4630`。

### 待决策点（届时问主理人）

- 选 **C**（只要颗粒）还是 **D**（颗粒 + 双色区带）？
- 噪点密度/描边粗细参数真机复核
- 托盘珠是否同批（托盘与盘面 1:1 同图元，建议同批）

---

## WXG-T-269

### EP12-S6 主菜单「拼豆小铺」作品墙（批 6、双轨并行、QA §M 代落）

- **领号**：269 = 本会话（Qoder）。领号已核：此前仅现于 TASKS.md 头注「下一可用号」，工树/在册无占用（承 WXG-T-268 拆分，按批 6 续，不另拆单）。
- **范围**：EP12-S6 = R-12 闭合案落码（**不新增独立 boot 屏**，S0 内容就地落已实装 `meta-view`）：招牌 `beadText` 珠拼「拼豆小铺」 + slogan + 木框橱窗 4×3 + 陈列序 = DI 升序（消费 S5） + 主钮语义不变 + 次级行 3→2 钮。估点 L，跨 view + 美术字形/缩略 + QA 封箱复算；依赖 S2✅ S5✅。判据正本 = ep12 §89–95 验收①–⑦ + menu-architecture §5.1–§5.4。
- **编排（主理人九阶段、双轨并行）**：T-1 林绘澄（招牌字形/橱窗/缩略绘制规格 `art/menu-wall-signage-spec.md`）∥ T-2A 程基岩（工程垂直切片：DI 墙 + 映射 + 3→2 钮 + 令牌）→ G-art 汇合门 PASS（升 10×10@12 落预授权，整树 verify 22/0）→ T-2B 程基岩（beadText 招牌 + 缩略渲染 + K-6 实测台账，四键 MATCH）→ T-3 严守真（§M 硬判据 + G1–G4 独立复验）→ T-4 文策渊（ux-spec §4 两行回写 + tokens 冲突裁定）。round 2b art/design 回写已落工作树。
- **落码事实（主理人亲验）**：首屏分流 `beads-shell.ts:156 this._screen = options.initialScreen ?? 'menu'`（红线由 WXG-T-180 反转、S6 T-2A reinforce）；招牌 `view/menu-signage.ts::drawBeadText` + `config/sign-glyphs.ts`（T-1 §1.5 `10×10@d=12` 位表逐字转写，⛔ 工程侧不自拟字形）；缩略 `drawLevelThumb`（案乙 `THUMB_AREA = 120−8−28 = 84`、5×5 主色块聚合、单格 ≤ 25 珠硬判据）；`SIGN_*`/`THUMB_*` 档进 `tuning.ts`（Object.freeze，判例 DIFFICULTY）⇒ **零 §3 变更**。
- **K-6 实测读数（⛔ 非纸面；risks.md 旧「+77~115 推算」作废）**【→ 下方「走马灯改造」后部分数值作废，以重采为准】：满载菜单生产帧 `total=2563 / beads=341`；Δ招牌 beadText = +1036（148 珠 × 7，增量闭于珠体三族 rect+148/circle+296/polygon+592、text/line +0）；Δ格 3→2 = −307；Δ缩略 5→4/4→3/5→3 = −427/−378/−805；地板 513；~~**成本比 = 2563/1871 = 1.370×**~~（菜单非玩法热循环 ⇒ 接受）。口径 B 面：`10@12` 面 8.667 ≥ 地板 8（采用）/ `12@10` 面 6.933 破地板 ⇒ 不做；总宽 `5.5·n·d = 660 ≤ 702`。
- **走马灯改造（T-2B·menu-architecture §1.3 第五轮）**：主菜单主区由整墙→**单张走马灯小卡**（内容=闯关进度 + 已通最高 DI 关落位图，`drawCarouselCard`；未通⇒虚线空卡）；**卡=菜单唯一选关入口**（点击→`open-levels`，⛔ 不设显性选关钮）；**作品墙整体下移 `levels` 选关 overlay**（同源渲染）。⇒ K-6 台账**重采**（`capturedFrom 8514d20a9adf…`）拆两屏：主菜单帧 `1145 / 148`（满载≡首日，卡未通⇒零缩略珠）、选关页墙 `wall.rows3` `1518 / 193`（首日 `696 / 23 / line 528`）；**地板 513→504**、**成本比 1.370× 作废**（新主菜单 0.61×/选关页墙 0.81×）；Δ招牌/Δ格/Δ缩略 命令值不变（腿分组重定向至选关页墙帧）。正本以 `risks.md` §4b / ep12 S6 状态行为准。
- **验收④（封箱复评）**：playing 四键逐字节 MATCH — frame0 `1325/3269d92b…`、frame78 `1871/749b3ada…`；两条独立腿互证（K-6 装置内复取 + 官方复取器 `WXG211_CAPTURE=t269s6-seal`）+ import 图静态门（view-model/bead-render/beads-shell/beads-game 零引用 menu-signage）⇒ 珠拼/缩略未渗进盘面命令流。
- **QA 代落（用户批准全量代落）**：⚠ subagent 返回文本**不落持久转录**（grep 转录 TC-MN/SC-MN/§M = 0）⇒ 按铁律 1 + K-051 不凭记忆伪造 38 例，**重新 spawn quality-lead（readonly）对已落码真实代码重生可逐字落盘草稿**后代落。落 `test-cases.md §M`（TC-MN-01..40 九分组 + M.0 效力边界 + M.10 门结论 G1–G4 映射 + BD 表）+ `smoke-tests.md`（SC-MN-01/02 + SC-01/SC-11 K-053 划线留档订正：旧「冷启动无菜单直进 L1」随首屏红线反转改写为「首屏 = 主菜单」 + v1.4 变更行）。主理人代落时**误缩短已有 v1.3 变更记录行** ⇒ 立即逐字复原（lossy 编辑自查修正）。
- **BD 领号（K-050 复核纠正 quality-lead off-by-one）**：quality-lead 报最大 = BD-51，主理人读工作树全局实得最大 = **BD-52**（BD-51 iOS 音频、BD-52 珠缝）⇒ 新缺陷从 **BD-53** 起，BD-MN-01..08 → BD-53..60 落盘时重编。
- **主理人亲验两处默认值**：shell 默认 `'menu'` ✓；harness `dev/harness/main.ts:60` 默认 `'play'`（注释仍写旧红线）⇒ **BD-56 真实不一致**，本批**只文档化不擅改代码**。
- **终裁 = CONCERNS**（G1/G2 PASS · G3/G4 CONCERNS：菜单冒烟本轮 ⛔ 未执行 + 观感/真机/屏幕 6 项 `[待真机]` 未闭合 + BD-53..60 在册；九关 DI 无并列 ⇒ tie-break 分支不可达，诚实登记）。commit ≠ 闭合宣告，S6 状态行保持 🚧。
- **阶段 8 汇编**：ctx:build 重跑（387 文件/5917 章节；menu-wall-signage-spec.md 未入索引，dirty 按 HEAD，提交时 pre-commit 自动重建）· check:links OK（agents=7 skills=39）· epics-beads-ep12 S6 状态行 🚧 · epics-beads-status 无 EP-12 行（该件为 EP-01~10 时效声明，不动）。
- **在册挂账**：BD-53（验收⑤缺静态门）/ BD-56（harness 分流，已核不改码）/ BD-57（镜像 3 文件无 `.meta`，无编辑器阻塞不伪造）/ BD-58（K-6 台账副本入库，主理人倾向批准转正）· `[待真机]` 5 项 · ux-spec §4 两行 + core-loop §2.1 首屏行回写归 T-4。
- **待 commit**（用户批准「汇编完就提交」）：feat(beads) 整批 S6（代码 + 镜像 + art + design 回写 + QA 文档）。

---

## WXG-T-271

### beads·boss 关缩略静态位图臂落码（ADR-0031 DEC=C′）

- **领号**：271 = 本会话（Qoder）。领号已核：真实台账最大 = 270（270 系归档占用未列主表）⇒ +1 领 271，全仓无占用（grep `WXG-T-271` 命中仅本单自身）（判例 K-046）。
- **决断背景（承上轮）**：用户 2026-10-10 三裁——① 「只补一张 boss PNG」（目标收敛）；② 问「cocos creator 的 MCP 能否代做」；③「暂不开通体积扩展资质」。`cocos-creator` MCP 工具 `action` 枚举实测：**能**驱动导入 + 生成 `.meta`（`asset_operations{import,create,reimport,save}` / `asset_manage{import,save_meta}` / `asset_system{refresh}`），**不能**配 Asset Bundle / 勾选微信分包（枚举无对应项），**不能**触发构建（ADR-0009）；叠 `check:size` 已从 K-089 的 SKIP 转为本机实测有牙（beads 主包 2939.8 KB，+38 KB → ~2978 KB 仍 <4096）⇒ ADR-0031 由方案 A（新建分包）改裁为 **方案 C′（进现成 `assets/textures` Bundle→主包）**。
- **范围（本批 = 先写码、暂不 import/重建）**：core **零改动**（blit 腿已存，ADR-0026）。三处落码：
  - `src/config/tuning.ts::BOSS_THUMB_TEXTURES`：`level.id → textureId` 数据驱动表（boss=L00009=**id 9**）。`BeadsLevelRaw` **无 `kind`**（boss 只在生成期排序标、不同步进运行时）⇒ 按显式 id 键，⛔ 不新造字段。
  - `src/view/menu-signage.ts`：注入式可用性臂 `setLevelThumbBitmapResolver`（与 tint 运行时同型，默认 `undefined` = 逐字节程序化缩略⇒**绿线锚**，既有菜单输出零变更）；`drawLevelThumb` 命中返 textureId ⇒ **恰 1 条 `blit`**（左下原点、铺满 `THUMB_AREA`）后 `return`，未命中落下方程序化。src 不知 boss 是谁 / 资产在哪。
  - `cocos/assets/scripts/host/beads-blit-carrier.ts`：`accept()` 双腿——带 `fx.base`→tint 图集格，无 `fx.base`→静态位图注册表腿 `_bitmaps`（替旧「注册表腿未实现」bail）；`loadBitmapSpriteFrame`（走 bundle `textures` 按 path 取、**不依赖 uuid**）；warmup 装载注入（**可选臂、不 gate `_ready`**，资产未导入时自然空转）。
- **镜像**：src 改动经 `pnpm run framework:sync` 传播（写入 2：`game/config/tuning.ts` + `game/view/menu-signage.ts`），carrier 属 host 手写非镜像。`framework:sync:check` 绿。
- **判据**（ponytail 一个可运行检查）：`tests/boss-thumb-bitmap.test.ts` 三条——未注入 resolver ⇒ 零 blit + 程序化（绿线锚）；命中 ⇒ 恰 1 条 blit + 无叠绘 + 几何（左下原点/铺满 THUMB_AREA）；非位图关 ⇒ 仍程序化。
- **验证**：typecheck ✓ · test ✓（含新判据）· framework:sync:check ✓ · check:size ✓（本批未重建、产物未变）· check:cocos-mask ✓（零触 mask）· check:links ✓。**封箱不受扰动**（默认 resolver=undefined ⇒ 菜单逐字节不变）。
- **余项（受 §19 红线 + 真机取证 gate，本批不做）**：MCP `asset_operations.import` 导 PNG→`asset_system.refresh` 生成 `.meta`→CLI `build:cocos` 重建→`check:size` 复核主包 +38KB→真机扫码取证 `Texture2D.image=` 运行时构造（ADR-0031 §4.2 条 4）。受控正文（`control-manifest §19`「向主包投放位图」 + `systems-index §3.8` 总包 30720→20480）另走 §3.9 变更单，本单只记录裁定（ADR-0031 §1.2/§6）、不擅改。
- **未 commit**（用户未点名提交）。

---

## WXG-T-335

**工程·beads 大关（chapter）配置层设计批（Q1=b 正交 / Q2 暂不做 zip / title 上移 chapter） · 负责：主理人(Qoder)·程基岩域+文策渊域（spawn 双成员并行） · 状态：📝 设计完成（2026-10-21）；落码（CH-S1/S2）待开单**

- **背景**：用户「singles 我看现在还是只有单关的概念，没有大关的概念，需要组织一个二级的配置结构，让大关独立成目录和包，最好能打包成 zip 包，在资源里增加配置大关文件，按照这个文件来索引橱窗内容。」四项拍板：**Q1=b（大关与 pack 正交）/ Q2 暂不做 zip、投放仍走微信分包 / title 上移 chapter 级 / 走 B（spawn 专家）**。
- **现状核实（关键纠偏）**：大关**已有代码实体** `games/beads/src/config/arcs.ts`（`ARCS` 每行 id/title/bundle/art/textureId/levelRefs + `ARC_OPEN_MAX`），走马灯/墙集合/boss 图/解锁归约/缩略图映射/bitmap 表 共 6 处消费 —— 缺的不是「大关概念」而是「大关进内容仓」（**硬编码 TS → 数据驱动**）。任务单里我写的两处假设也经子代理实测纠偏：manifest `kind` 已是 single/plate/boss 三值（L00009 已是 boss）；`phase-route-binder` 在 `src/ui/` 非 `src/config/`。
- **工程子单（程基岩 → `games/beads/design/proposals/level-content-pipeline.md` §11，+195 行）**：chapter 真源 = `design/levels/chapters/<id>.json` **一物一文件** `{id,title,levels[uid],showcase{bundle,art,textureId}}`（boss 不设字段 = manifest kind 唯一真源；空章禁止）；manifest 增 `chapters[{id,file,order,open}]`（`schemaVersion` 不升，仍 2，依 317 行注 + 测试冻结）；**与 pack 正交三条**：① 分片不看 chapters ② 改 pack 不改章语义（夹具臂判据）③ 唯一横切 = **同章同 pack（禁跨包）**，解除条件 = 分包落地 + 懒加载复评（本批恒真「先绿后守」）；`arcs.ts` 改**生成物**（同路径同导出名；`ARC_OPEN_MAX`/`OPEN_ARCS` 生成派生、`ARC_COMING_SOON` 留手写 header）；产物用 1-based 区间合并且**真源用 uid 列表**（区间漂移从源头消失）；**title 上移方案**：`BeadsLevelRaw.title` **降级为生成期派生字段**（仅章收尾关注入，`drawPlateTitle` 零改动、⛔ 视图不查表）；**Story 拓扑 CH-S1（真源）→ CH-S2 生成器 = 第一垂直切片（纯 Node 可验、6 消费点零运行时改动）→ CH-S3（title 上移，L00009 字段序会变 ⇒ 必重跑 sync）→ CH-S4（断言夹具：区间合并边界/空章/跨包/open 洞/boss 非末/孤儿关/超容量）→ CH-S5（分包，⛔ 阻塞 build:wx）**；zip 写死「本批不做、仅作将来作者侧分发候选」；不加新 ADR（0 条，数据层扩展 + 生成物有 ADR-0004 先例；下个空号 = ADR-0034）。
- **设计子单（文策渊 → `games/beads/design/levels/levels-spec.md` §11，+163 行，头版本 v1.14→v1.15）**：**三处显示矩阵**（木牌 = chapter title；选关页页头 TODO-1 同源；**玩法屏零章名、零关名**——0 文字教学豁免只到页族，⛔ 不塞 HUD/toast/字幕）；字段「该进」四项（id/title/levels/showcase）与「不该进」五项（表 B 第二真源防线：order·open 归 manifest、解锁归规则、boss 归 kind、pack 归正交、空章禁）；空橱窗页 = 恒末页、「敬请期待」、点图零事件、**空章 ≠ 空橱窗**（5 条真章判据）；**TODO-1 解口径** = 读 chapter title、无 title **不建文本节点**（⛔ 不回落 slug/关序/硬编）；**单关不再自带展示名**（唯一来源 = 所属 chapter；仅 boss 关可携派生 title，四判据）；验收 A1–A6（各带前置状态，避免早期误判红）。
- **两处事实订正（登记不回改他文）**：① `meta-ui §2.7` 写 `WALL_CAPACITY` (12)、实测 3×3 = **9**（tuning/选关规格/版式单三处均 9）⇒ 子单按实测引用；② `levels-data.header.txt` 与 `levels-data.ts:19` 注释仍写「木牌第二行」，与现码单行口径漂移 ⇒ 随 CH-S3 同批订正。
- **一处口径矛盾（需用户确认）**：`arc-level-select-spec §8.2` TODO-1 括注「位置 = 标题带」 vs `level-select-page-layout.md §2/§3`（空带留给 TODO-1、标题带仅「选关」）⇒ 子单按**数值正本**（空带 [822,1122]）解，并写明「若反向改判须用户确认并重开版式数值」。
- **未决（7 项，子代理均荐甲/丙）**：工程 Q-A 产物区间 vs 直出下标（荐甲保留 `levelRefs`）/ Q-B 章超 9 槽（荐甲生成期硬拦 throw）/ Q-C `ARC_COMING_SOON` 迁移（荐甲不迁、登记遗留）/ Q-D `open` 字段（荐甲本批就上、否则 `ARC_OPEN_MAX` 仍手写=第二真源）；设计 ① 页头落点（荐甲空带）/ ② 章名长度硬门（荐甲不设门）/ ③ 玩法 HUD `LV n/N` 分母（荐丙多章前再定，登记 `[TODO]`）。
- **验证**：纯文档批、零代码、零产物、零 §3 变更；`verify` 22 绿；两份正本互引一致（chapter schema / boss 归属 / 空章 / 禁跨包四口径逐条对齐）。
- **未做**：①设置重叠、①返回钮、①半透（UI-60）、②BD-62、③橱窗灯光、④暗线 未混做；23 个编辑器生成 `.meta` 仍未入库（独立决定）。

---

## WXG-T-326

**beads·真机 P3 续：ADR-0033 三裁回写（含段粒度） · 负责：主理人(Qoder)·程基岩域 · 状态：文档回写（2026-10-20，零代码）**

- **用户三裁（原话）**：「Q1 分期确认」「Q2 容器粒度含 hud/toast 段」「Q3 过渡态：P1 前维持这个止血观感」。
- **Q2 对设计的实际影响（不是加个词）**：段维度进来后，Cocos 层树从「容器 × 通道」变成 **容器 × 段 × 通道**；同容器内「先画 HUD（矢量 + 文字）再压一道遮罩」要求后面的 `Graphics` 能盖住前面的 `Labels` ⇒ **只拆 Labels 不够，段必须拆全通道**（与 ADR-0030 为 `model.background` 碰过的同一个坑）。代价如实登记：`Graphics` draw call 预估从现状 2 升至 ≤6 ⇒ **P0 验收必须实测**（harness 计数 + 真机 DG 基线），并新增 **DEC-9** 三级降级杆（拆半段 → 弹窗与底页合一个容器靠段保序 → 丙案剪影底），⛔ 不得用「删段」换预算。
- **收口方式的选择**：采纳「段」但**不用逐命令 `layer` 字段** —— 改为容器内成对的 `beginSegment(seg)` / `endSegment()` + 枚举 `page|hud|modal|toast` + **默认段兜底**（`page` 容器默认 page、`modal` 容器默认 modal）。理由：默认段与现行为一致 ⇒ 视图层只需在真需跨通道叠序处开一段，抖掉「漏标即错乱、机检难覆盖」这一否因（原 §3 乙案已改注）。
- **Q3 落档**：`meta-view` 弹窗分支维持「不透明底（没半透）」，注释里那句「⛔ 不得在遮罩前直接补画底页」继续有效，直到 UI-60 P1 解开 `dialog-center.test.ts` 的 skip 层序例。
- **不阻塞的留项**：S1 段枚举是否再加 `debug`（`DebugLayer` 必须永远最顶，推荐复用 `toast` 之上的隐式末位）；S2 跨容器段序按「容器序优先、段只在容器内起作用」执行，P1 接线时逐个验证。
- **验收（本批）**：纯文档 ⇒ `check:tasks` 87/87 配对、`check:links`、ctx A–E 全绿（`ui-architecture-beads.md` 仍 ≤ 8000 tokens）；代码与测试零改动，故不重跑构建与真机码（`b9c047d` 的产物仍有效）。
- **仍阻塞的事项**：UI-60 P0 开工前置 = 另一会话的 UI 架构迁移 WIP 入库（本轮实测 `git status` = 47 个未提交 / 未跟踪件在场）。

---

## WXG-T-325

**beads·真机 P3：弹窗层级错乱回退 + 容器层立项 · 负责：主理人(Qoder)·程基岩域 · 状态：回退 + 立项（2026-10-20，本批零新行为）**

- **用户裁定（原话存档）**：「设置页不在最上面，设置页和主界面需要层级清晰，现在看绘制错乱了，需要架构上调整。」→「每个页面和对话框是一个 UI 容器，里面按照层级绘制，事件按照层级透传；层级是一个顺序关系，不能错乱。」同轮确认：**上下居中已对**（WXG-T-323 在设备侧生效），本批不重开居中。
- **根因（两端语义不一致，非猜测）**：Cocos 层序是**写死五段通道**（`adapters/cocos/bindings.ts` L229–L262「层序三叠」注：子节点序 = Cocos UI 绘制序）：`Background` Graphics → `BlitLayer`（珠） → `Graphics`（全部矢量） → `BlitLayerUI`（静态位图腿） → `Labels`（全部文字） ⇒ **指令流的跨通道相对序在设备侧丢失**。324 的「先画底页」在 canvas2d（immediate mode）里正确 ⇒ Node/金样本全绿；真机上主菜单的位图腿（WXG-T-280 菜单全量位图化）与文字仍浮在遮罩与弹窗之上。**局内暂停一直正常** = 棋盘走 `BlitLayer`（本就在遮罩下）。
- **第二处违反**：`CocosRenderer._drawText` 只 `acquire()` + `setPosition()`，**不按帧重排 sibling** ⇒ 同层文字叠序取决于池节点创建历史，跨帧可变。
- **处置（回退）**：`meta-view` 弹窗分支去掉 324 那行补画，注释写明「⛔ 不得在遮罩前直接补画底页」+ 根因 + 正解指针（防后来者再踩，K-046/K-053）；层序断言不删，改 **`it.skip` + 解开前置指针**（它正是 UI-60 的验收腿）。
- **回退可证**：金样本复取 `settings` 3686→**25**、`signin` 3689→**28**，与 `9f267b6`（322/323 批）**sha 逐字全等**、十一态集合全等 ⇒ 字节级回到上一稳定态。
- **立项**：开 [`ADR-0033`](../docs/architecture/adr/ADR-0033-ui-container-layer-ordering.md)（DEC-1 容器=渲染单元 / DEC-2 `beginContainer`·`endContainer`（与 `clip`/`unclip` 同族，旧 adapter 忽略即兼容）/ DEC-3 按容器建层树，可见容器 ≤3 ⇒ Graphics draw call ≤3 / DEC-4 不引入 zIndex / DEC-5 sibling 序确定化 / DEC-6 事件按容器逆序透传（接 `blocksBelow`）/ DEC-7 珠世界层不容器化 / DEC-8 **设备侧层序进验收**；备选甲 barrier / 乙 逐命令 layer / 丙 剪影底 / 丁 只回退 均写明否因）；`ui-architecture-beads §12` 新增 **P6 / UI-60**（规模 L，P0–P3 四批），UI-50 行原「已解除」改写为「曾解除 ⇒ 已回退，重开为 UI-60」（同时按先例把 UI-40/50/34/30 行的过程细节压成指针以过 ctx B 门）。
- **验收（本批）**：beads **1137 passed + 3 skipped**（新增 1 skip = 层序待容器层）；金样本 11 例绿（复取后对拍）；typecheck 0；`framework:sync:check` 一致；`check:tasks` / `check:links` / ctx A–E 门。容器层的真验收在 UI-60 P1（解开 skip 例）与 P3（设备读数）。
- **阻塞与前置**：⚠ 另一会话正在同一层做 UI 架构迁移（`ui-root.ts` / `ui-host.ts` / `modal-frame.ts` / `play-page.ts` 等 44 个未提交文件）⇒ UI-60 须等其入库，否则双写。待用户裁 ADR-0033 §5 Q1（四批分期）/ Q2（容器粒度：只 page/modal 还是含 hud/toast）/ Q3（过渡态是否维持「没半透」）。

---

## WXG-T-324

**beads·真机 P2：菜单弹窗无半透（遮罩下未画底页） · 负责：主理人(Qoder)·程基岩域 · 状态：⚠ 曾完成（2026-10-20）⇒ 已由 WXG-T-325 回退（问题定性仍成立，终解归 UI-60 / ADR-0033）**

- **触发**：用户复验 WXG-T-323 后同机报「**主界面设置页面，没有半透**」（前两项已确证：遮罩整屏无漏、齿轮/继续仍可点）。
- **根因（systematic-debugging）**：`buildMetaView` 函数开头先 `builder.setBackground(palette.background)`（实色纸底），而 `overlay === 'none'` 分支早退 ⇒ signin/settings 分支**从未调 `drawMenuAnchored`**，只画「实色底 + 遮罩 + 面板」。金样本坐实：`settings` 整帧 **25 条**（{rect:13, text:12}）、`signin` 28 条，而 `main-menu` **3661** 条 ⇒ 0.3/0.5 的半透遮罩下面根本无可透之物。代码注释（“先压暗底层菜单”）与 `phase-route-binder.test.ts` 用例名（「设置是弹窗路由（透明，底下仍是菜单）」）都在说应当透 ⇒ **属代码与文档意图不一致的缺陷，不是新政策**；对照局内弹窗一直画底页（`pause` 676 ≈ `play` 654 + 面板 22）。本件同时解除 WXG-T-317 登记的 ⚠「逐单元路由绘制（弹窗下画菜单）待 UX 裁定」。
- **落码（一行）**：`meta-view` 弹窗分支在遮罩**前**补 `drawMenuAnchored(builder, data, palette, anchoredGeo(A), withSignage)`（与 `'none'` / 转场分支同一入口、同一参）；遮罩 RGB 与双档 α（settings 0.3 / 其余 0.5）**零改动**；纸面板/按钮/热区未动 ⇒ 命中面不变。
- **验收**：新增 1 例（`dialog-center.test.ts` 尾节）——遮罩 rect **之前**必须已有 `polygon`/`circle`（主菜单独有图元，弹窗自身不画这两个 kind）；**反证**：摸掉那行底页绘制 ⇒ `遮罩下必须已画出底层主菜单: expected 0 to be greater than 100` 即红，再按 sha256 逐字节还原。金样本按纪律先在 `docs/architecture/ui-architecture-beads.md` UI-50 行登记视觉变更，再两遍确定性重抓：**`settings` 25→3686、`signin` 28→3689**（增量逐类全等：3661 + 原 25 / 原 28 ⇒ circle 965 / polygon 1912 / line 295 与主菜单行完全一致），其余**九态 sha 逐字未变**；`capturedFrom` = `9f267b6 · 含菜单弹窗透出底页重抓 settings/signin（WXG-T-324）`。beads 98 文件 **1138 passed + 2 skipped**、typecheck 0。
- **性能读数（诚实）**：设置/签到页每帧指令从 25/28 条升到 3686/3689 条（≈ 主菜单本帧成本）。与主菜单同量级、属既有包络内（菜单页本来就要画 3661 条），但确实是“开弹窗后变贵”——若真机发热/卡页，回退杆 = 弹窗期只画静态底（走马灯不更新）或烘一张底图。
- **登记漂移（本批不改的件）**：`src/ui/phase-route-binder.ts` 头注「菜单遮罩态不画底页，属既有视觉」已过时 ⇒ 该件当前属另一在途会话的未提交 WIP，本批不夹带改动（同文件镜 1 件），待该会话或后续单把注释改成本口径。

---

## WXG-T-348

**beads·主菜单签到入口回归（信封实装 + 未领小圆点）** · 2026-10-22 · 主理人(CodeBuddy)

- **用户拍板（三点）**：① `canClaim` ⇒ 信封右上 1 枚小圆点（全局唯一提示位）；② 已领当日仍可打开看进度；③ 不做开合动画（零新毫秒值）。
- **落码**：顶栏信箱从禁用空圆（α0.5）改正常态（白圆 + `ui_icon_mail` + 按下纹），公告位保持禁用预留；`open-signin` 热区注册（`mailHit` 与绘制同源 `anchoredGeo`）；小圆点 `MENU_SIGNIN_DOT_R=9`（色读既有 `danger`，零新 hex）。签到弹窗本体、`claimSignin`、7 日奖励表**零改动**（页面早已完整，仅入口退役）。
- **口径变更**：推翻 Q5①「签到入口退役」；`ui-architecture-beads.md` §12 已登记视觉变更（K-051/K-053/DEC-6）。
- **测试**：`beads-shell` / `meta-menu-wall` 动作集五元→六元 + 反断言反转；新常量纳入「零 §3 变更」自证。全量 1221 passed，仅金样本 `main-menu`（3662 vs 3661）/ `level-select-mid`（5085 vs 5084）因小圆点 +1 命令待复取。
- **未决**：金样本须在可复现锚（本批 commit）后由 `tests/ui-golden-capture.ts` 重抓；真机观感（红点位置/大小）待验收。

---

## WXG-T-367

**beads·金样本复取前置侦查与 §12 归因订正（复取阻塞于 BOOT 锁）（用户令「金样本三态复取」⇒ 侦查后选甲案 = 本批不复取）**

### 1. 领号与来源（K-046）

- 三路核验：头注「下一真可用号 **WXG-T-367**」且该串在 `TASKS.md` 仅 1 处自指；主表无 `^| WXG-T-367` 行；无 `## WXG-T-367` 节；`git log --all --grep=WXG-T-367` 零命中 ⇒ 领号合规。
- 来源 = WXG-T-366 收尾三选项之 **1**「金样本三态复取」，用户 2026-10-24 令。

### 2. 侦查手段：怎么在共享脏工作树里量到「HEAD 自身」

- `git worktree add --detach temp/wxg367-anchor HEAD`（`temp/` 属 gitignore，不进版本库）+ 手搭 `games/beads/node_modules/@wxgame/framework` 的**相对**软链（原仓库该链接本就是相对路径 ⇒ 在检出内解析到检出自己的 `packages/framework`）；复取器只靠裸 node + `--experimental-transform-types` + `tools/scripts/lib/ts-js-resolve.mjs`，零第三方依赖 ⇒ 不必 `pnpm install` 即可跑。
- 要 vitest 读数时把根 `node_modules` 软链进检出，`npx vitest run --root <检出>/games/beads` ⇒ 拿到 HEAD 的权威全量读数。
- ⛔ 不 `git add` 对方在制品、⛔ 不 `stash` 共享工作树（会打断对方会话）；侦查期间曾在主树跑过一次复取，随后 `git checkout --` 还原夹具。

### 3. 四条实测

1. **拐点 = 单点 `aa5c85e`（WXG-T-362，已入库）**：逐 rev 复取 —— `dc60d54`/`3611904`/`09adcc7` 均 `main-menu` 3662 · `level-select` 1423 · phase `playing`；`aa5c85e` 起 5636 · 1409 · phase `boot`（`level-select-mid` 随 menu 腿 +1960）；其后的 `ff8efe4`（363）/`a1ef23f`（365）/`0733976`（366）零影响。
2. **视觉腿与关卡数据无关**：干净 HEAD、HEAD+对方三件、主树+WIP 三次复取 ⇒ 十一态 **sha 逐字全等**（新 `settings` sha `d8b5c527…` 恰与 §12 里 339 批登记的定稿值一致，反向印证复取器可信）。
3. **但 `proof.phase` 是数据相关的**：`beads-game.ts::_boot()` 对**每一关**跑 `validateBeadsLevel`，`_bootErrors` 非空即 `console.warn('[beads] level validation failed — refusing PLAYING')` 并 return（注释自陈 "Invalid level data keeps the game in BOOT forever"；`config/levels.ts:63` 另有 "rejected all 8 levels and BOOT never finished" 的同形状先例注）。HEAD 上 `L3` 14 行 / `L4` 12 行 misplaced 非字符串 ⇒ 启动永久停在 BOOT。
4. **HEAD 权威读数 = beads 22 failed / 1239 passed / 3 skipped（1264）**：`pause-settings` 10（失败信息清一色 `expected 'boot' to be 'playing'` = 纯连锁）+ `ui-golden` **5** + `misplaced-assembler` 2 + `difficulty` 2 + `levels` 1 + `board-camera` 1 + `beads-shell` 1；主树（含对方未入库三件）= 6 failed / 1255 ⇒ **差 16 条全由那件数据修复所掩盖**。

**订正记（不静默删原文，K-053）**：

- ux §12 的 WXG-T-365 条目原写「既存三笔红 ⇒ 归并发会话在制品」**错**，本批就地改写并留痕（K-096 同型：把当日快照的推测当永久事实）。
- 365 / 366 两节所记「金样本三例」「6 failed」均为**主树脏工作树口径**，在该口径下成立、不改写；新增的是 **HEAD 口径**：ui-golden 实为 5 例红（`settings`/`signin` 只差相位）、beads 全量实为 22 例红。两者不矛盾，引用时须注明口径。

### 4. 交付清单（3 件文档，⛔ 不动夹具、不动数据）

| 件 | 改动 |
|---|---|
| `docs/architecture/ui-architecture-beads.md` §12 | 订正 WXG-T-365 条的归因半句 + 新增「金样本复取前置登记（WXG-T-367）」 |
| `production/TASKS.md` | 367 主表行 + 头注推进为「已分配至 367 / 下一真可用号 368」 |
| `production/TASKS-DETAIL.md` | 本节（原子暂存：HEAD 铺底 + 只插我方节） |
| `games/beads/tests/__fixtures__/wxg-t-298-ui-golden.json` | **零改动**（侦查产物已还原为 HEAD 版） |

### 5. 三条关键判断（全部实测后写）

1. 「能不能复取」的判据不是登记齐不齐，而是**取到的相位是不是设计意图态**：金样本把 `proof = {screen, overlay, phase}` 一并纳入等值判据 ⇒ 任何让游戏进不了 `PLAYING` 的数据缺陷都会伪装成"视觉变更"。分离办法 = sha/total/kinds 与 proof 两轴分别比（本轮即由此拆出②③两条结论）。
2. 并发共享工作树下，**"当前读数" ≠ "HEAD 读数"**；不做独立检出就得不出可归因的数（365 批的错归因正是缺这一步）。
3. ⛔ 用「先复取一次、回头再复一次」替代「等前置」：两次基线漂移即毁掉金标准的意义，且第一次会把卡死态写成正确答案。

### 6. 读数

| 项 | 读数 |
|---|---|
| 复取器确定性自证 | 每次跑两遍逐态记录全等 = PASS（含 sha 与 proof） |
| HEAD 干净检出 beads 全量 | 22 failed / 1239 passed / 3 skipped（1264） |
| 主树（含对方 WIP）beads 全量 | 6 failed / 1255 passed / 3 skipped（1264） |
| 十一态 sha 三跑比对 | 逐字全等（视觉腿就绪） |
| `pnpm run levels:check` @ HEAD | OK —— 即该门不查 misplaced 行形状（缺口已记 §12） |
| 夹具与工作树 | `wxg-t-298-ui-golden.json` 与 HEAD 逐字一致；对方四件脏文件全程未入暂存 |

### 7. 遗留与后续批

1. **P0（不属本批，归并发会话的关卡数据轨）**：develop HEAD 启动即卡 BOOT（L3/L4 misplaced 形状非法）。我方不代改数据以免撞车；若该件长期不入库，需另立项处置。
2. **复取五态**（解除条件 = 上一条入库）：`main-menu`/`level-select`/`level-select-mid` 视觉+相位、`settings`/`signin` 仅相位，⛔ 分批、⛔ 手改（K-051 / K-053）。
3. 顶栏装扮馆真图标 `[待 UI 设计]`（承 365，与复取同批最省一次抓取）。
4. `check:tasks` I 项：`WXG-T-362` 署号未在册（K-137 ⇒ 只披露不代填）。
5. `[待裁定]` 是否给 `levels:check` 补一条 misplaced 行形状判据（本批未扩门禁）。

---

## WXG-T-368

**beads·L3 misplaced 全错覆盖率与第一章数值同步（HEAD 启动即卡 BOOT 的后续，= WXG-T-367 复取的真前置）**

### 1. 领号与来源（K-046）

- 三路核验：头注「已分配至 367 / 下一真可用号 368」；主表无 `^| WXG-T-368` 行；无 `## WXG-T-368` 节；`git log --all --grep` 零命中。
- 来源 = 用户在 WXG-T-367 收尾三选项里选 **1**（处置 HEAD 启动即卡 BOOT 的 P0）。

### 2. 本批为什么不改数据（边界）

- 修复该数据缺陷的工作**已在并发会话的手上**：`games/beads/src/config/levels-data.ts`（含 Cocos 镜像）与 `design/levels/singles/L00003.json`、`L00004.json` 四件均为其未提交在制品，其中关表包已是 −784 行的整表重写。
- 我方若在同一批文件上落自己的修复，= 覆盖其未保存工作（K-045），且提交后会被其后续提交盖掉 ⇒ 双重无益。**本批一行数据不改。**
- 也不放宽 BOOT 锁：`_boot()` 的全表预校验是刻意设计（core-loop §2.1「⛔ 带坏数据进 PLAYING」），而关卡切换路径 `_setupLevel` 不再校验 ⇒ 全局预校验是唯一防线，改成"只拒当前关"会把坏数据推到 mid-run。**查证后否决。**

### 3. 做了什么：把「其入库之后」预演出来（零碰撞）

在干净检出（`temp/wxg367-anchor`，detached @ `0733976`）里拷入那四件在制品，跑复取器 + beads 全量：

| 项 | HEAD 现状 | 预演（其入库后） |
|---|---|---|
| `_boot()` | `refusing PLAYING` + 26 条 misplaced 形状错 | **零出现**（形状已由字符数组改为行字符串） |
| 菜单族五态 `proof.phase` | `boot` | `playing` ⇒ 金样本五态可全绿 |
| beads 全量 | 22 failed / 1239 passed | **3 failed / 1258 passed / 3 skipped（1264）** |

预演仍剩的三条红（= 复取解除前必须一并清掉的账，均不属金样本腿）：

1. `tests/misplaced-assembler.test.ts:346`「L3 全错」：装配后错位格 **88**，L3 可填格 **108** ⇒ 357 批「成片全错」不变式未满足。
2. `tests/difficulty.test.ts` EP12-S5 验收①：L3 难度指数实测 **42.2** vs §5.1 冻结表 **73.7**。
3. 同文件：按 DI 升序的九关墙序 = `L6→L1→L8→L2→L3→L5→L4→L7→L9`，与 §5.2 冻结序 `L6→L1→L8→L2→L5→L4→L3→L7→L9` 在 L3/L5 两处换位。

**订正（同日 · WXG-T-369 实测）**：上列第 1 条判定反转 —— L3 的 88 是 §3.13 冻结式 `M_max = min(N, 2(N − m))` 的正解（N=108、m=64 ⇒ 强制原位 20 = 2m − N），「整片全错」在主导色过半时数学上不存在；欠账在测试判据（MVP 单档时代的 blanket 断言）而非数据，已随 WXG-T-369 按冻结式改判 ⇒ **本任务实剩第 2、3 条**（DI 与墙序）。

### 4. 关键判断（两条）

1. **「形状修好」≠「数据修好」**：形状只是校验器的一项，全错覆盖率与冻结数值同步才是这批数据的实质判据；只看 BOOT 锁解没解会误判为已清零。
2. 复取的解锁点应当用**这三条红转绿**来判，而不是用「对方有没有提交」来判 —— 预演把判据从事件换成了读数，后续批可直接照此验收。

### 5. 待裁定与后续

- **待用户裁定**：若那四件长期不入库，是否授权我方接管（接管 = 明确丢弃其未提交工作），或另开一条按现成工具（`tools/scripts/level-derange.mjs`）重生成 L3 misplaced 的独立批。
- 367 的复取动作在本批三条红清零后执行，工具与步骤已就绪（干净检出 + 相对软链 + 裸 node 复取器），预计一次 `cp` 夹具 + 一次对拍即完。
- 本批产生的干净检出已删除（⛔ 留一个钉在旧 commit 的检出 = 下一轮读数的隐患）；重建 = `git worktree add --detach temp/<名> HEAD` + 手搭 `games/beads/node_modules/@wxgame/framework` 相对软链。

---

## WXG-T-372

**beads·九关定价实测——L3/L4 的 `steps/taps/time` 仍是 362 换盘前的旧盘读数（只报不裁）**

### 1. 领号与来源

用户在 WXG-T-369 收尾三选项里选 **1**（「裁定 L3 的难度冲突：先用现成工具把新旧图案的 DI 分量拆开，再给 2–4 个方案」）。领号时并发会话（CodeBuddy）正在同一工作树追写台账：其先领 **370**（`c7fc2d1` harness 暂存树增量同步）、再领 **371**（`d2aa7ab` L3/L4 `misplaced` 字符串行修复入库 + §5.1 九关 DI 漂移取证）。本批按 K-046 领号 = 头注「下一真可用号 **WXG-T-372**」，且主表 / 详情节 / `git log --grep=372` 三路零占用。

**与 371 的分工**：371 §4 已把 DI 三行漂移（L3 42.2 / L4 65.0 / L9 426.7 vs §5.1 表）列表登记，并在其 §5 明写「⛔ 不动 `tests/difficulty.test.ts`（并发会话正在改）」。本批的独家产出 = **定价面**（`pricing.steps/taps/time`）与那条断言的落库，371 未覆盖。

### 2. 取证（现成工具实跑，零新脚本）

跑法 = `tools/scripts/beads-bot.ts`（真引擎装盘，单盘 0.1–0.4s；`--patch` 一律未加 ⇒ 只读）。十关全测与文件记录逐字对拍：

| 关 | 文件记录 `steps/taps/time` | bot 实测（现图案） | 判定 |
|---|---|---|---|
| L1 | 10/20/30 | 10/20/30 | ✓ |
| L2 | 30/58/51 | 30/58/51 | ✓ |
| **L3** | **60/120/101** | **43/83/73** | ✗ **陈账**（记录比真盘乐观 40%） |
| **L4** | **42/84/71** | **106/211/179** | ✗ **陈账**（限时只有需求的 40%） |
| L5–L8 | 68/136/115 · 19/38/32 · 41/80/69 · 22/41/37 | 逐字相同 | ✓ |
| L9 | 183/366/309 | 183/366/309 | ✓（362 重建后确测过） |
| L10 | 1001/2002/1692 | 1001/2002/1692 | ✓ |

全十关 `cleared=True`（可解性由 bot 真引擎逐格实跑证明，非「结构展开正确」的静态推断）。

**陈账定位到批次**：取 `aa5c85e^`（362 批之前）的 L3/L4 定价 = `60/120/101`、`42/84/71`，与今日文件**逐字相同** ⇒ 362 批重测了重建的 L9，却漏改了图案的 L3/L4。违反既定规程 `levels-spec.md` §写盘入口唯一（第 449 行「写盘入口 = `beads-bot.ts::pricingOf`」）。

**DI 分量拆解**（369 选项 1 的直接要求，`difficultyOf()` 三口径对拍）：

| 关 | §5.1 冻结（= 换盘后旧图案） | 现图案 | 掉在哪 |
|---|---|---|---|
| L3 | `A=0.592 K=0.408 M=108 fK=0.853` → DI 73.7 | `A=0.750 K=0.250 M=88 fK=0.600` → DI 42.2 | ① 同色成块 ⇒ 碎片度 K 腰斩；② 主色占比 45%→59% ⇒ 按 §3.13 强制原位 20 颗（M=88） |
| L4 | `A=0.745 K=0.255` → 66.8 | `A=0.755 K=0.245` → 65.0 | 同向微动（主色恰 50%，全错仍可达） |
| L9 | 22×21 `N=328 C=6` → 289.7 | 30×30 `N=612 C=9` → 426.7 | 重建放大 +47% |

⇒ 三条漂移都属「可读性修复与重建」的**必然代价**（同色成块 = 碎片度下降 = DI 下降），不是实现缺陷；§5.1 表停在 2026-10-10 那次换盘（表头自记「换盘后 bot 重测 · contentVersion 31」），362 批没跟上。

### 3. 改动（本批仅 1 件源码，零数据、零夹具）

- `games/beads/tests/difficulty.test.ts` +5 −1：逐值比对由 `expect(p.di).toBe(表值)` 改为**先收集差异、末尾一次性断言**。原写法首条失败即抛出 ⇒ 表只报 L3，L4/L9 同样不符却看不见（本批实测正是三条同时漂）。取整校验（因子三位 / DI 一位）逐字保留，严格度未动。
- 台账两件（本表行 + 本节）。

### 4. 读数

- `npx vitest run tests/difficulty.test.ts` = **2 failed / 9 passed**，与改前红数相同，可见漂移由 1 条增至 3 条（`L3 DI=42.2 ≠ 73.7` / `L4 DI=65 ≠ 66.8` / `L9 DI=426.7 ≠ 289.7`）。
- HEAD 起 `d2aa7ab`（371 入库）beads 全量 = **5 failed / 1256 passed / 3 skipped**：368 预演的 BOOT 锁**已解除**（`refusing PLAYING` 零出现），余红 = `difficulty` 2 条（待裁）+ `ui-golden` 3 态。
- **金样本三态的挂点换了腿**：现在失败在 `[total]`（视觉腿，指令数 main-menu / level-select / level-select-mid 三态均不符），而 `proof` 相位轴**先通过** ⇒ 证实 367 登记的「解除条件 = 形状入库」只解了相位轴；视觉轴仍欠 `docs/architecture/ui-architecture-beads.md §12` 的 UX 裁定登记（K-051 / K-053 明令：先登记裁定、后由 `ui-golden-capture.ts` 重抓，⛔ 手改夹具）。

### 5. 待裁（四案，均已核代价）

| 案 | 内容 | 后果与门槛 |
|---|---|---|
| **甲** | 全量 `beads-bot --patch` 重测 + `sync-levels-data` + §5.1/§5.2 回写 | 一次到底、消灭陈账；但真读数落盘后 **L4 steps=106 > `NORMAL_STEPS_MAX=90`**（`tuning.ts:722`）⇒ 撞门禁⑦ CI 必红 ⇒ **甲必须配丙** |
| **乙** | 手工只改 `time` 不改 `steps`（给 L4 补足限时） | ⛔ 不合规：`pricingOf` 里 `time = round(steps × SEC_PER_STEP)`，二者同源；绕过写盘入口正是 362 漏测的病根 |
| **丙** | 改 L4 图案把批量效率压回 steps ≤ 90，再走甲 | 保住门禁⑦ 语义（普通关明显轻于 boss），要动关卡内容 = 数值/关卡双轨 |
| **丁** | 放宽 `NORMAL_STEPS_MAX` | ⛔ 不建议：全局系数牵动九关 + 门禁⑦ 判据本体，为一个关动全表违反最小干预 |

另须一并裁的第二问：**L9 boss DI 289.7 → 426.7（+47%）**是否是要的难度曲线形状（DI 不管价 ⇒ 无定价连带；门禁⑥ 只要求 DI 可排严格序，实测九关互异 ⇒ 仍绿）。

### 6. 连带遗留

- 复取金样本的真前置由 367/368 记的「形状入库」推进为**两条**：`difficulty` 两红随本批裁定落档而绿 + `§12` 视觉变更登记。
- L3/L4 数据文件现属干净状态（371 已收口），甲/丙案我方已可独立执行，⛔ 不再涉在制品归属（K-045 约束解除）。
- `tuning.ts:716` 注释「现池最高普通关 L5=68 通过」「现池 boss L9=282」均已过期（真值 L4=106 / L9=183），随甲案一并回写。
### 7. 补测（2026-10-24，用户选 372 收尾选项 1「甲+丙一起做」⇒ 先把丙的实测数字做出来）

探针 = `temp/wxg373-cand.mjs`（23 行，只读）：候选图案由现盘机械变换产生，`misplaced` 一律交现成装配器 `tools/scripts/level-derange.mjs::buildCellInitial` 重新装配（与正式入关同一条初盘链 ⇒ 对照公平），DI 走 `difficultyOf`，steps/taps/time 走 `beads-bot.ts` 真引擎（⛔ 未加 `--patch`）。三候选 + 现盘同口径：

| 形态 | 盘幅 / N | 初盘档位 | steps | taps | time | DI（A/K/fC/fK） | 门禁⑦ |
|---|---|---|---|---|---|---|---|
| 现盘重测 | 12×12 / 122 | 文件自带 | **106** | 211 | 179s | 65.0 | ⛔ 越界 |
| **A 四色各聚一块**（行带极端版，仅测下限，图不可交付） | 12×12 / 122 | 甲 M=122 F=0 | **31** | 61 | 52s | 52.4（0.827/0.173/0.9/0.477） | ✓ |
| **B 减色**：4 号 14 颗并入 2 号（构图其余不动） | 12×12 / 122 | 甲max **F=28** M=94 | 26 | 51 | 44s | 35.3（0.832/0.168/0.8/0.469） | ✓ 但序乱 |
| **C 缩盘**：裁掉四周各一圈 | 10×10 / 98 | 甲 M=98 F=0 | 40 | 80 | 68s | 56.2（0.727/0.273/0.9/0.637） | ✓ |

三关 `cleared` 全为 Y ⇒ **丙 成立且余量极大**（把 steps 从 106 压进 90 不需要牺牲盘幅或色数，聚块一项就够）；§3.13 甲′ 在 B 上复现（主色 75/122 过半 ⇒ 强制就位 F = 2×75 − 122 = 28 颗），与 L3 的 88 同式。

**由此订正 §5 两处**：

1. 「升成 boss 档 / 挪到章末」这条我上批列为待问选项，现用代码判死：`sync-levels-data.mjs:775-783` 按 kind 分流，boss 须 steps **≥ 120** ⇒ 现盘 106 **既超普通上限 90、又不达 boss 下限 120**，两头都不合规 ⇒ 升档单独走不通，除非同时降 `BOSS_STEPS_MIN`（= 丁案变体，为一个关动全表）。
2. 丙 案不再是「要动关卡内容 = 双轨」的模糊项，收敛成 A / C 二选一（B 与升档已由实测否决）：
   - **A**（保 12×12、保 4 色、保各色颗数，只把 1 号 4 个碎域与 4 号 4 个碎域各聚成整块）⇒ 下游改动面最小（缩略图尺寸、渲染档、`cols/rows`、包体都不动），DI 52.4 仍稳在 L5 43.7 之上、L7 76.8 之下 ⇒ 墙序不变。
   - **C**（10×10）⇒ steps 40 与 L3 实测 43 贴得更近（第一章节奏 43→40 平顺），DI 56.2 亦不改墙序，但要动 `cols/rows` 与关表缩略图，改面更大。
   - B（35.3）会把 L4 插到 L1 与 L8 之间，墙序变 [6,1,4,8,2,3,5,7,9] ⇒ 第一章第 4 关比第 2 关还简单，不推荐。

**甲的装置结论**（上批未核清）：`singles/L000NN.json` **不是** `beads-bot.ts` 的合法输入（它只吃 beads-gen 的 `pattern.json` 或 `{"levels":[…]}` 聚合，见 `beads-bot.ts:196-235`），所以全量重测定价必须借现成写盘器 `tools/scripts/level-store.mjs::writeLevelFile` —— studio 的 `POST /api/manage/level/:uid/replace`（`apps/beads-studio/server.mjs:1334` 起，注释明写「uid / 关号 / 章位 / 关名全不变，只有图案与实测时长（pricing 溯源）换新」）正是这条链的封装 ⇒ **丙 的换图与甲 的定价写回是同一个入口**，两案天然合并，⛔ 不需要新脚本。

本批仍 ⛔ 零主树数据改动、⛔ 零夹具改动（候选与 bundle 全在 `temp/`，被 gitignore）。待裁收敛成一句话：**L4 取 A（保盘幅聚块）还是 C（缩到 10×10）**；定了即一笔落完「换图 + 全量定价 `--patch` + §5.1/§5.2 回写 + `tuning.ts:716/723` 过期注释」，difficulty 两红随之转绿。

**后记（2026-10-24）**：用户拍 **A** ⇒ 已由 **WXG-T-374** 一笔落完（换图 + 全池重定价 + §5 回写 + `tuning.ts` 注释），`difficulty.test.ts` 11/11 转绿；本行状态随之闭合，详见 `## WXG-T-374`。

---

## WXG-T-401

**框架微信能力缺口 + beads 架构优化 TODO 提案（📋 待拍板，未开工）**

- **产出**：架构评审（读码取证，零代码改动）。正本 = `production/plans/2026-10-26-arch-review-weapp-framework-and-beads.md`（16 条 TODO 分 P0–P3 + 拍板点 D1–D4）。
- **结论摘要**：core 分层健康（引擎无关 / buildRenderModel 只读 / 平台抽象边界干净 / dirtyGate 已实测省 3.0–3.9ms 重放）；铁律 L3/L4 全仓 grep 零违规；beads 106 测试文件 / ≈1312 用例护体。短板两处：
  - **微信平台能力面**（P0 两项：① weapp 激励视频恒 Noop——`weapp.ts:280` 返回 `NoopRewardedAdProvider`，全仓无 `createRewardedVideoAd` 包装，而 beads 加心闭环已依赖它（`beads-shell.ts:455-462`），真机点「看广告加心」永远无效；② 振动是空设置——设置页有开关有持久化有事件（`game-settings.ts:123-127`），但框架 `Platform` 无 haptics 抽象、weapp 无 `vibrateShort`，`beads-game.ts:2118` 注释明说「批0 不接」。P1：分享 / 热更 UpdateManager / onMemoryWarning→bake LRU 收缩 / HTTP 通道（正式环境微信无全局 fetch）/ 帧率档与性能上报 / 开放数据域（建议挂 backlog））。
  - **beads 巨型文件**（P2：`beads-game.ts` 3022 行再拆（快照投影 / BOOT 装配）；`tuning.ts` 3283 行按域拆 + barrel 保 §3 单源；`beads-shell.ts` 987 行菜单投影下沉 MenuProjection；`spawner.ts` documented dead path 仍在公开 barrel；事件总线类型扩展点消除 shell 两处 `as unknown as` 强转；视图三大件 meta-view/play-page/bead-render 按金样本护体切分）。
  - **P3**：真机帧率 R1 风险未实测（Cocos Graphics 900+ 指令/帧，ADR-0005 复评触发）；菜单静止帧构建短路（dirtyGate 只省 draw 重放，build+hash 每帧仍跑）先量化再决定。
- **下一步**：用户拍板 D1（激励视频：实现 weapp wrapper vs 继续占位） / D2（振动：接通 vs 移除设置项） / D3（spawner：整删 vs 仅摘 barrel） / D4（开放数据域：backlog vs 本里程碑）后，执行任务逐条另领号（T-402+）入表；本单在拍板后转排期或关闭。

### 5. 首通改为「按档累进」（v1.90，用户 2026-10-26 澄清）

用户原话：「需要把首通的奖励都发放给玩家，如果玩家直接跳过 1 星或者 2 星首通就完成了 3 星首通，但是每个星级首通的奖励只会发放一次。」

即 v1.89 的「按本次星级一次性（3★=40）」**漏发了被跳过的低档** ⇒ 改为逐档累计：

| 首通星级 | 普通关 | Boss 关 | 说明 |
|---|---|---|---|
| 1★ | 20 | 40 | ★☆☆ 一档 |
| 2★ | **50** | **100** | ★☆☆ + ★★☆ |
| 3★ | **90** | **180** | 三档全发 |

- **等价性**：直接 3★（90）与「先 1★ 再升 3★」（20 + 补发 70 = 90）总额相同 ⇒ 不惩罚第一次手生；
- **边际不变**：3★ 相对 2★ 仍多 40 ⇒ 打满激励强度零变化；
- **池子翻倍并已记账**：单关 40→90（Boss 80→180），一章全满星 = **990**（≈21.7 天签到；皮肤三套 1100 ⇒ 覆盖 90%）。
  用户未选池子调整项（甲 660 / 乙 2200 / 丙 990）⇒ 默认按 **丙（990，单价不动）**，如后续觉得皮肤太便宜，改 `SKIN_PRICES_COINS` 或单档即可。
- 落码：`grantClearCoins` 第三参 `firstClear: boolean` → `prevStars: number`（内部 `cum(star) − cum(prev)`）；原因句三态（首通 / 补发 / 复刷两态）；测试 9 例。

---

## WXG-T-413

**内容打穿后接续预案**（📋 提案未排期 · 2026-10-26 立）

### 1. 触发背景
用户 2026-10-26 裁：「是否一定要防止用户打穿？还是让 99% 的用户能够有东西可玩，才是真实游戏要考虑的」⇒ 放弃「防打穿」目标、改为覆盖 99%（见 `star-economy-and-retention.md` §14.3）。首期 8 大关 / 72 关下，重度玩家（39 局/天，估 <5%）约 **4.6 天**打穿，需接续手段。

### 2. 硬约束（决定预案形态）
微信小游戏版本更新需审核 1–7 天 ⇒ **「紧急加关」物理上不可行**。接续只能靠**游戏内本身再生、无需发版**的内容。

### 3. 三层响应
| 层 | 时间 | 手段 | 状态 |
|---|---|---|---|
| **T+0** | 当天，零发版 | 每日挑战（`proposals/daily-challenge.md` v0.2）· 星级/时间挑战（本单邻单 WXG-T-414）· 排行榜 | 均未落码 |
| T+7 | 一个版本内 | beads-studio 批量出关（生成器已上线）· 外观分级升级（§14.6） | 未排期 |
| T+30 | 正常节奏 | 按 §14.5 配比更新 1 章 + 2–3 款外观 | 已定 |

### 4. 监控指标与启动条件
| 指标 | 危险信号 | 动作 |
|---|---|---|
| 打穿天数分布（P50 / P90） | P50 < 7 天 | 内容太少，下次加量 |
| **打穿后 7 日留存** | **< 30%** | **启动 T+7 层** |
| 打穿后日均时长 | 持续下降 | 可再生内容不足 |

核心判断：打穿玩家 7 日留存**不低于**未打穿玩家 ⇒ 说明其他系统接住了，**什么都不做**。

### 5. 遗留
1. 「打穿」判据未定：通关最后一关算打穿，还是全 3★ 才算？（建议：通关即算打穿，全 3★ 另计「毕业」，两者分开统计）
2. 指标采集需埋点，当前**无数据链路**（本单不实现，仅登记需求）
3. ⛔ 本单不做任何代码，纯预案

---

## WXG-T-484

> **撞号订正（2026-10-28，WXG-T-483）**：本节原为 `## WXG-T-414`。414 的另一份是 `3bae99b1`
> 「帧率档 + 性能快照」（WorkBuddy，2026-10-26 18:54 入库），该号**已写进 14 个源文件的注释**
> （`packages/framework/{core/game/game.ts, core/performance/performance.ts, platform/*.ts, compose/app.ts}`
> + `games/beads/src/game/beads-shell.ts` + 两游戏 cocos 镜像）。
>
> 裁定 = **本提案改领 484**，依据：① 判例 K-046 的「入库者保号」口径落在**提交信息署号**上 ——
> 414 的正式署号是 `3bae99b1 (WXG-T-414)`；本提案的登记提交 `c28c706f` 署的是 **WXG-T-413**
> （正文写「登记 413/414」），414 从未在提交信息里被本提案署用过；② 改号代价差一个数量级
> （本提案零代码引用，帧率档 14 处注释均需动）。⛔ 提交历史不回改，以本台账为准。

**「本关最快时间」展示位最小设计**（📋 提案未排期 · 含设计、未落码）

### 1. 定位
T-413 的 T+0 层里成本最低的一条：**不新增任何关卡内容**，靠「同一关打得更快」提供可玩性。同类判例：数独/扫雷靠一张内容活很多年的做法。

### 2. 数据设计
- 新增 `MetaState.bestTimes: Record<levelId, number>`（毫秒，仅记成功局）
- 写入点：`level:cleared` 时比较取小；**只对 `stars === 3` 的局记录**（避免低星快局污染「最快」语义）
- ⚠ **存档迁移**：`save-schema` 加字段须走版本升级，缺省 `{}`；旧档读入不报错

### 3. 展示位（最小面）
| 位置 | 内容 | 条件 |
|---|---|---|
| 关卡选择卡 | 星标旁一行 `text_secondary` 小字「最快 1:47」 | 仅该关已 3★ 时渲染 |
| 结算面板 | 「新纪录 +1.2s」一行 | 仅本次破纪录时 |

- 视觉只用 `text_primary` / `text_secondary`，⛔ 不新增色值、不新增图标资产
- ⛔ 不做半透明遮罩外的额外图层（避免重演 WXG-T-324/325 的层级事故）

### 4. 判据（可单测）
1. 无 3★ 记录时该行**零渲染**（不占位、不留空行）；
2. 同一成绩重复进入不重复写入（幂等）；
3. 跨设备 / 清缓存后丢失**可接受**（纯本地，⛔ 不接云同步）；
4. 非 3★ 局不得写入 `bestTimes`。

### 5. 刻意不做
- 好友/自身最佳对比：⛔ 不做（concept §7 已砍社交）
- 最快时间给豆子奖励：⛔ 不做（会给经济新增产出腿，冲击 §14 配比表）

---

## WXG-T-414

### 1. 触发

架构评审提案 TODO-7（P1 批次）：帧率档 + 性能上报。证据：无 `setPreferredFramesPerSecond` / `wx.getPerformance` 消费，低端机（R1 风险机型）无降帧策略与量化上报。方案：weapp 平台档位 API（默认 60Hz，可降 30Hz）+ `getPerformance` 跑时快照，为 TODO-15 真机帧率实测提供数据腿。

### 2. 改动面

**Core 层**（类型放 core，避免逆向依赖）：
| 文件 | 变更 |
|---|---|
| `core/performance/performance.ts` | **新建**。`PerformanceSnapshot` 接口（fps/heapBytes/loopStats/targetFps/frameBudgetMiss）+ `computeFps()` 数学工具 |

**Platform 层**：
| 文件 | 变更 |
|---|---|
| `platform/platform.ts` | Platform 接口加 `setPreferredFps?(30\|60)` + `getPerformance?()`（零参数，平台自攒数据）；BasePlatform 抽象 FPS 滑动窗口（`_recordFrame` protected）+ loop 缓存（`_feedLoopStats` 内部） |
| `platform/weapp.ts` | WxApi 补 `setPreferredFramesPerSecond?` + `getPerformance?`；构造函数 init 调 `setPreferredFramesPerSecond(60)`（与 showShareMenu 同区块）；requestFrame 里 `_recordFrame(dt/1000)` 喂 FPS；getPerformance 合并 FPS + `wx.getPerformance().memory` + loop 计数器 |
| `platform/web.ts` | setPreferredFps noop（Web 无 API）；getPerformance FPS 自算、heap 字段 null；requestFrame 也加 `_recordFrame` |
| `platform/node.ts` | setPreferredFps noop；getPerformance FPS=null（Node 无 rAF 喂数据）；heap 字段 null |

**Compose + GameServices**：
| 文件 | 变更 |
|---|---|
| `core/game/game.ts` | GameServices 加 `setPreferredFps?` + `getPerformance?` 两个可选字段 |
| `compose/app.ts` | 组装 bind；`tick()` 末尾调 `platform._feedLoopStats(ticks, time, clampedFrames)` 缓存 loop 计数器 |

**beads 侧**：
| 文件 | 变更 |
|---|---|
| `game/beads-shell.ts` | shell.update() 每 600 帧（≈10s @60Hz）拉 `services.getPerformance?.()` → emit `system:perf-sample` 事件 |

### 3. 架构说明

- **FPS 滑动窗口在哪喂数据**：各平台 `requestFrame` 实现内部（weapp/web）每次回调前调 `this._recordFrame(dt/1000)`，零侵入游戏层；NodePlatform 无 rAF 所以 FPS=null。
- **Loop 计数器在哪缓存**：App.tick() 每次 FixedStepLoop.advance() 后调 `platform._feedLoopStats()`（BasePlatform 默认实现存 protected 字段）——platform 不持有 loop 实例，但缓存其数据用于 getPerformance 快照。
- **getPerformance 零参数设计**：FPS 是内部滑动窗口自己算的、heap 是平台自己查的、loop 计数器是 App 推来的——调用方只拿结果，无需传参。
- **setPreferredFps 降级链**：微信有 API 真调；Web/Node 直接 noop 静默吞。

### 4. 微信 API 形状

```typescript
// 帧率档（基础库 2.11.0+）
wx.setPreferredFramesPerSecond(60); // 或 30

// 性能内存（基础库 2.11.0+；不同版本字段可选性不同，全做 ?. 防御）
const perf = wx.getPerformance();
perf.memory.usedJSHeapSize;   // 已用
perf.memory.totalJSHeapSize;  // 分配上限
```

### 5. getPerformance 返回字段

```typescript
interface PerformanceSnapshot {
  fps: number | null;              // 滚动 60 帧窗口均值
  heapBytesUsed: number | null;    // weapp 独有
  heapBytesTotal: number | null;    // weapp 独有
  clampedFrames: number;           // FixedStepLoop 累计被钳帧
  ticks: number;                   // FixedStepLoop 累计 step 数
  loopTimeSeconds: number;         // 模拟世界秒
  targetFps: 30 | 60;              // 当前档位
  frameBudgetMiss: boolean;        // fps < target * 0.9 → 预算未达
}
```

### 6. 验证

- typecheck ✅
- framework tests **518/518** ✅
- beads tests **1277 passed + 3 skipped** ✅
- framework:sync ✅（beads 写入 7 + breakout 写入 7）

### 7. 撞号披露

WXG-T-412 = Qoder 会话隔离工作树配方（已入库）。WXG-T-413 = beads 消耗品文档（已入库）。**WXG-T-414 零占用**，直接领。

---

## WXG-T-422

**beads·冲刺榜（二期）：冲刺模式恢复后再上第二榜** · 负责：主理人(Qoder)·beads + 工程 · 状态：📋 提案未排期

- **用户原话（2026-10-26）**：「Q1 定为 B，冲刺模式我建议作为二期的需求，先上普通模式。」
- **裁定**：一期榜 = **普通模式品质分**（分关榜 + 总榜，见 `ADR-0035 §3.2`）；**冲刺榜 = 二期需求**，一期不排期、不预留冲刺入口。
- **前置（三条，缺一不可）**：
  1. **冲刺入口复建**：`U1` 三处入口自 WXG-T-177 起全部隐藏（过关面板只剩「下一关」/ 通关画面不产冲刺钮 / 暂停面板左格换「性能信息」），恢复属产品决策。
  2. **主域上报冲刺成绩**：`sprintBestScore` 已在 save v5，需按 `ADR-0035 §5.2` 形状写 `wx.setUserCloudStorage`（建议独立 KV `beads_sprint_best`，⛔ 不混进 `beads_settle`）。
  3. **子域加 `sprint` 榜**：`RankBoard` 已预留 `'sprint'` 成员（ADR §3.1），榜单 UI 与数值说明行随二期设计。
- **红线**：本提案**零代码**；⛔ 不改 §3 冻结常量（冲刺分取值沿用 `systems-index §3`）；⛔ 一期榜不得出现指向冲刺的入口或空榜。
- **启动条件**：用户恢复冲刺入口并拍二期排期后，整行搬回主表并改状态标记（BACKLOG 四条纪律④）。

---

## WXG-T-469

**发布版本号机制（首发 1.0.x、x = build 号）+ 真机走查新增美术设计走查节 · 负责：主理人(CodeBuddy) · 状态：🔄 机制已落码、验证进行中（2026-10-28）**

**背景**：MVP（首发提审）未完成清单盘点（用户令「继续找 mvp 未完成任务」+ 三项输入：版本号裁定「首发 1.0.x、x = build 号、生成最终产物时递增」+ 授权「现在可做」+ 指出「还缺一个美术设计走查」）。

**① 版本号机制**（USER 2026-10-28 裁定）：
- **真源** = `games/beads/package.json` `version`（第三段 = build 号），基线 `0.1.0` → **`1.0.0`**；
- **版本腿**（`tools/scripts/build-cocos.mjs::bumpAndStampVersion`）：release 档 `wechatgame` 构建成功后 ① 递增 package.json（**单行文本替换**，保 CRLF/键序，diff 只有一行；⛔ 整文件 JSON.stringify 会掀 CRLF）；② 给产物 `assets/main/index.js` 的 `version_label` 打实际 build 号（源码基线串 `v1.0.0` → `v1.0.{N}`；任一环节对不上 ⇒ warn 不失败，不挡构建）；③ **仅 beads**（`game !== 'beads'` return——`pnpm -r` 并行构建下防其他游戏被无裁定递增）；
- **源码基线对齐**：`copy-tokens.ts::version_label` `v1.x · 演示版` → **`v1.0.0 · 演示版`**（占位 v1.x 退役，注释原标注「归发布单」即本单）+ `meta-menu-wall.test.ts` 断言同步（30/30 绿）；
- **验证状态**：递增已实证（首建 1.0.0→1.0.1 写回）；产物打号**待复证**（首建被 idle 超时中断于产物阶段 + 并行 WIP 挡 `framework:sync`，重跑前置红「拷贝件与源码不一致」——⛔ 不代并行会话 sync）；
- **挂账**：「演示版」字样提审前去留 = USER 裁；微信后台版本号 = 首次 `cli upload` 填当次 build 号。

**② 美术设计走查**（用户指出缺口）：`device-walkthrough.md` 新增 **Session 4b**（S4 技术渲染线之外的设计符合度审查）：art-bible v1.5-r27 对照六维度（色彩体系 / 版式与间距 / 字体阶梯 / 风格一致性 / 动效观感 / 文案含 version_label 实显），逐屏 6 屏，USER 逐屏看图拍板；`release-checklist` §1.1 版本号行现状更新 + 阶段三挂「美术设计走查」门。

**⚠ 领号披露**：468 已被并行会话（crash-snapshot）在制品引用（T-246 行「WXG-T-468 验证闭环」，工作树未提交）⇒ 本单避让领 **469**（K-046）。

**待办**：干净构建后复证产物打号（`v1.0.1 · 演示版` 上屏）；「演示版」去留；随真机走查批次推进 MVP 清单（release-checklist NO-GO ①③⑤）。
（收口注：产物打号已于同日 T-473 批复证上屏——`v1.0.3 · 演示版`，版本腿打号 bug 修复后全链通。）

---

## WXG-T-473

**X-07 选 B：无广告位隐藏复活钮 + 版本腿打号修复 · 负责：主理人(CodeBuddy) · 状态：🔄 判据已落码、金样本复评进行中（2026-10-28）**

**背景**：MVP 清单 ③（X-07 激励视频首发处理）用户拍板 **B（无广告位隐藏复活钮）**。取证：T-402 已实装 `WxgRewardedAdProvider`（缺 adUnitId ⇒ load 失败 onError，不静默）；复活链路「点击才 load+show」，Noop 下 failHint「即将开放」——运行时 `isReady()` 判据会逼出预载腿（M 级）⇒ 改**配置级判据**。

**判据贯通**（五层）：
1. `PlatformInfo.rewardedAdConfigured?: boolean`——weapp = `Boolean(this._adUnitId)`（无 adUnitId ⇒ false）；web/node 不声明 ⇒ undefined；
2. `GameServices.rewardedAdAvailable?: boolean`——compose 从 info 透传；
3. beads `_reviveAdUsable()` = `this._services?.rewardedAdAvailable ?? true`（**未声明语义平台 `?? true` 保 harness/独立 BeadsGame 旧演示语义**）；
4. `_reviveAvailable()` = 次数未用 && 可用——`_snapshotSource` 与 `ControlMapHost` 两个 host 同源消费；
5. 投影 `s.reviveAvailable` 加 `&& src.reviveAdUsable`——渲染与命中同真源（无「画了点不了」分裂）。
将来接真广告位：shell 配 adUnitId ⇒ 按钮自然回归，零结构变更。

**验证**：判别测试 `revive.test` 新例（`rewardedAdAvailable=false` ⇒ 快照隐藏 + revive 位不命中）；framework **550/550**、beads 定向 63/63、beads 全量 1387 passed（5 红 = 金样本 4 + scrim 静态门 1，见下）。

**红分域裁决**：① 金样本四态（main-menu/level-select/settings/signin）= **T-469 账**（version_label `v1.x`→`v1.0.0` 文案漂移，Meta 四屏底部版本行文本变 ⇒ sha 漂）⇒ 本单走复评通道重抓（教训：改 view 消费文案必须跑金样本，T-469 只跑了 meta-menu 单文件漏了金样本对拍）。② scrim 静态门（`expected 5 to be 2`）——**已结清（2026-10-28 收尾）**：根因不是 ui-theme/modal-frame 而是 `1b4649cc`（T-470/471/472 批 1）在 `meta-view.ts::META_PAGES` 新增 `album/localRank/profile` 三页，均按 design 取默认 `UI_SCRIM.alpha`（0.5），而 `bead-style-settings.test.ts` 的**穷尽计数**仍留在改造前的 2 ⇒ 属「pin 过期」不是该域逻辑回归。处置 = 把裸计数换成**具名集合判据** `['album','localRank','profile','signin','skins']`（约定不变：只有 `settings` 下调 `settingsAlpha`；将来再加页仍红且报错点名是哪一页）——⛔ 不是放宽门限、未动 α 取值。复跑：`bead-style-settings` 38/38、全量 `verify` **PASS 23 ｜ FAIL 0**。

**⚠ 领号披露**：`f7dd6ac2` 提交信息误署 **WXG-T-470**（提交时本会话台账视图滞后，470-472 已被并行 Trae 会话 Meta 页族批1 占用并登主表）⇒ 本单纠正为 **473**（提交信息内嵌旧号不回改，以台账为准——同 T-462 对表口径）。

**版本腿打号 bug 修复**（T-469 机制缺陷，实测暴露）：打号原按字面 `v{oldVer}` 找——package.json 每建递增、源 label 基线静态 ⇒ **二建起永不打号**（`v1.0.1` 找不进 `v1.0.0` 的 label）。修 = 正则 `/v\d+\.\d+\.\d+/` 替换任意旧 build 段；复证 1.0.2 → **1.0.3**，产物 `v1.0.3 · 演示版` 上号 ✓。

**待办（本单已无）**：金样本四态复评 ✅ `70f1f33c`（§12 登记）；scrim 静态门 ✅（见上②）；「演示版」字样去留 + 真机走查主会话 + `cli upload` 密钥 —— 三项**不在本单**，随 MVP 收尾推进（产物已就绪：v1.0.3 + 含判据 + 版本号实显）。

---

## WXG-T-474

**发布文案分环境：「演示版」后缀仅开发腿显、发布产物剥除 · 负责：主理人(CodeBuddy) · 状态：🟢 已交付（2026-10-28）**

**动因**：T-473 待办里挂着的「「演示版」字样去留」＝发布文案裁定项，USER 2026-10-28 选 **C（分环境）**。**为什么不选 B（现在就删后缀）**：`version_label` 参与主菜单/选关/设置/签到四屏底部版本行的帧对拍，改源码值 ⇒ 金样本四屏必重抓（T-469 教训）；C 把差异压在构建期 ⇒ **零金样本重抓**，且发布包干净。

**落码**：
1. `tools/scripts/lib/version-label.mjs::stampReleaseLabel(baseLabel, newVer)` = 打号 + 剥后缀单源（版本段任意 `vMAJOR.MINOR.BUILD`，⛔ 不按字面旧号找——T-473「二建起永不打号」判例；后缀 `/ \s*·.*$/` 一并剥，基线段缺失 ⇒ `null` 由调用方 warn 不挡构建）。
2. `tools/scripts/build-cocos.mjs` 版本腿改用该函数（仅 `platform=wechatgame*` 且非 `--debug`）；日志改为打印最终 label。
3. `copy-tokens.ts::version_label` **值不动**（`v1.0.0 · 演示版`）——源码基线/harness/金样本/debug 恒显演示版，注释改记裁定 C。
4. 判别测试 `tools/scripts/version-label.test.mjs`（4 例：打号剥后缀 / 无后缀只打号 / 基线漂移仍打号 / 无版本段 ⇒ null）并**挂进根 `test` 步**（`node --test … version-label.test.mjs`）——否则不会被 `verify` 看到。
5. 文档同步：`release-checklist.md §1.1` 待办① 结清、`copy-tokens` 注释改记裁定。

**验证**：新测试 4/4；全量 `verify` 待跑（本单提交后复跑）。⚠ **未做**：真 release 构建产物复证——本机此刻跑 release 构建会把 build 号顶到 `1.0.4` 并覆盖 `games/beads/cocos/build/wechatgame`（真机走查待用的 `v1.0.3` 产物），故留给下一次干净发布构建，已写进 release-checklist §1.1 待办②。

---

## WXG-T-475

**真机走查 Session 0 前置重核（`v1.0.3` 现包）+ 走查单 v1.7 · 负责：主理人(CodeBuddy) · 状态：🔄 前置已绿、待 USER 真机读数（2026-10-28）**

**动因**：用户选「真机走查主会话」。走查单 §1 前置的读数全是 10-19 的包（3201.0 KB / 108 文件），而现包是今天 12:12 的 `v1.0.3`（含 T-473 的 X-07 判据、T-474 之前的口径）——**旧前置不可直接复用**，先按现包重核一遍再开工。

**前置实测（全部机械取证）**：
1. **AppID**：`wx8cf9f756e5390749` ×4 处（profiles / cocos project.config / build 产物 project.config）⇒ 三处一致。
2. **预览通道**：`cli islogin` = `{"login":true}`；`cli preview --project <abs build/wechatgame> --qr-output <abs>` ✔ **TOTAL 3,460,013 B**，扫码图 `temp/wxg474-preview-qr.png`（ABS 路径，相对路径坑同 v1.1）。
3. **构建新鲜**：产物 `assets/main/index.js` mtime **10-28 12:12**；其后唯一运行源码改动 = `copy-tokens.ts` **注释**（`16996e92`）⇒ 内容等价 ⇒ 按「已知良性例外」接受，**不重建**（release 构建会把 build 号顶到 `1.0.4`，与本轮 `v1.0.3` 口径冲突）。`framework:sync:check` ✅。
4. **包体**：主包 **3419.8 KB / 111 文件**，距 4096 红线 **余量 676.2 KB**，无「疑似 debug」。⚠ 对 10-19 包 **+218.8 KB / +3 文件**，增量未逐件溯源（余量充足，登记为待解释项）。
5. **判据真在包内**（同源 grep，防「仓里改了包里仍旧」）：`rewardedAd`×4 / `reviveAvailable`×7（T-473 X-07）· `uiPressTarget`×1 / `menuPress`×1（D-79 抬起提交门）· `drawSafeGuideLines`×3 / `capsuleBottom`×11（安全区+胶囊避让）· 版本行 `v1.0.3 · 演示版`。`check:cocos-mask` OK。
6. **取证目录** `production/qa/beads/device/2026-10-28/` 已建（空目录不入库）。

**走查单 v1.7 改动**：① §1 前置四行换为上述实测；② **新增 D-80** = Meta 批 1 三弹窗页（图鉴 / 本地榜 / 名片，`1b4649cc` 今日交付但走查单**此前零覆盖**，线未定义 ⇒ 上限 `PASS*`）；③ **新增 D-81** = D-79 的 **6b 道具卡 / 6c 结算主钮**残留腿（沿用同一判据，只补腿不新造线，仍 `PASS*`）；④ §6 统计 S1 8→9、S3 12→13；⑤ §7 变更记录 v1.7。

**为什么分两次提交**：前置重核属机械读数（本单已完成），真机读数是另一件事（需 USER 扫码 + 手指）。⛔ 不把机械读数写成判定，判定列**一字未动**。

**待 USER**：① 扫 `temp/wxg474-preview-qr.png`；② **先做「标定线定性」**（10-19 遗留、命中发布清单 §1.1 调试入口不进线上）：清微信小游戏缓存或换未玩过的新微信号冷启 —— 标定线仍在 ⇒ 开 BD；不再现 ⇒ 记存档态；③ 按 Session 1 → 4b 顺序回传读数（截图落 `device/2026-10-28/`）。

---

## WXG-T-476

**新增 `wxgame-art-review` skill + 首轮美术还原 review · 负责：主理人(CodeBuddy) · 状态：🟢 已交付（2026-10-28）**

**动因**：用户令「开始 review 美术设计还原，增加美术设计相关 skill」。现状 = 域·美术只有 `wxgame-art-spec-programmatic`（**写**规格），没有审还原的只读面；而 `域·策划` 有 `gdd-review`、`域·技术` 有 `arch-review` 两个定期审计先例（WXG-T-455/456）⇒ 补第三块。

**skill 设计（`my-skills/wxgame-art-review/SKILL.md` v1.0）**：
1. **分层真源**（⛔ 不是单一文件）：UI token → `art-bible §3.1`（含 §3.1.1 名映射 + `wood_*/card_*` 消费声明）· 珠色 → `§3.2`（委托 `systems-index §3.2`）· 版式几何 → 落地单 + `final/prototypes` 原型定稿 PNG + `final/coordinates` · 资产 → `assets-spec §1/§4/§5` + `final/README.md` 接线台账 · 动效 → `§7`（服从 `ux-spec §5`）。
2. **机械层 8 步**：机械门（`palettes:check`/`check:a11y`/`check:cocos-mask`/`check:bead-style-pool`/`framework:sync:check`/游戏 test 含金样本）→ hex 越界扫描 → **已登记漂移白名单对账** → token 覆盖 → 版式常量对账 → 资产接线 → 出图比对 → 观感裁定。
3. **判定上限表**：`PASS` 需「机械门全绿 + 无 P0/P1 + 每屏有出图证据」；只有 harness 图 ⇒ `PASS*`；六屏缺图 ⇒ `CONCERNS`；出图通道不通 ⇒ `⛔`（⛔ 不得用「代码看着对」冒充）。
4. **§6 常见误判 5 条**：已登记漂移当新债 · 名映射误判 token 新增 · harness 图当真机证据 · 在途件当缺陷 · 只跑门不看图（P3 那次门全绿而真机层级错乱）。
5. 四 IDE 链接 + `.trae` 本地链接 + `my-skills/INDEX.md` 行（`check:links` = skills 49→50 绿）。

**首轮 review（报告 `production/qa/beads/art-restoration-review.md`，现包 `v1.0.3`）**：
- 机械门 6 项全绿（palettes 15 品牌/2104 色、a11y、bead-style-pool、cocos-mask、framework:sync:check、beads test 1391 passed）。
- **hex 越界 = 0**：`src/view/**` 除 `palette.ts`（49 处消费副本）外，两处命中都在注释里 ⇒ token 单一真源纪律成立。
- **菜单版式常量 8/8 一致**（CTA 324×92@218 · 招牌链 165 · 组 871 · 柜隙 1:2 · 顶/底隙 16/32 · 框 544×871@107 · 钮行 bt≥cap）。
- **F1（P2）文案未入册**：`meta-view.ts:166-168` 三页标题 `'图鉴'/'本地榜'/'名片'` 内联字面；而 `signin`/`skins` 走 `SIGNIN_TITLE`/`SKINS_TITLE` 单源常量 ⇒ 新三页既无 `tokens.md §7` 键、也未收常量。
- **判定 `CONCERNS`**：机械与版式层零 P0/P1，但六屏**缺现包真机图**（10-19 那批取自旧包，按「同一时点」纪律不可挪用）⇒ 不得给 `PASS`。
- **反误报一条**（写进报告）：落地单「条 46」vs 代码 `MENU_BAR_H=32` 初看差 14px，实读注释才知 46 = `MENU_BAR_TOP_INSET 14` + 32 ⇒ 与 skill §6-2 名映射误判同族，**先查语义再报**。

**未覆盖（坦白）**：六屏出图比对（待真机走查同场取）· 观感层（`§5`/`§7` 无线，需 art-director 或用户拍板）· `assets-spec §1` 逐件清单对账（字节层已由 `check:cocos-mask` 覆盖）。

---

## WXG-T-477

**修 F1：Meta 批 1 三页标题补单源常量 + `tokens.md §7` 补三键 · 负责：主理人(CodeBuddy) · 状态：🟢 已交付（2026-10-28）**

**动因**：WXG-T-476 首轮美术还原 review 的唯一实质偏差 F1（P2）——`meta-view.ts:166-168` 三页标题 `'图鉴'/'本地榜'/'名片'` 是**视图内联字面**，而 `signin`/`skins` 早已走 `SIGNIN_TITLE`/`SKINS_TITLE` 单源常量。用户选下一步选项 1 修它。

**落码**：
1. `tokens.md §7` 新增三键：`panel_album_title` = `图鉴` · `panel_local_rank_title` = `本地榜` · `panel_profile_title` = `名片`（状态「新·已落码」，用途列标注消费副本位置）。
2. `view/meta-pages-content.ts` 导出 `ALBUM_TITLE` / `LOCAL_RANK_TITLE` / `PROFILE_TITLE`（真源 = §7，本处 = 消费副本，注释写明判例同 `SIGNIN_TITLE`）。
3. `view/meta-view.ts` 改 `import` 三常量，`META_PAGES` 三行由字面量改写常量；注释记明「原为内联字面 = T-476 F1」。

**守卫（K-144 正负配对 + K-089 先证能红）**：`meta-menu-wall.test.ts` 新增静态门
「Meta 批 1 三页标题走单源常量」——
- 正向：三常量在册且值 = §7；视图侧 `import` 在场且 `panelPage(ALBUM_TITLE` 等三处消费。
  （⛔ 只做负向时「常量被删也绿」）
- 负向：视图内不得再有 `panelPage('图鉴'` / `'本地榜'` / `'名片'` 裸字面。
  （⛔ 只做正向时「又内联一遍也绿」）
- **变异测试实证**：把 `ALBUM_TITLE` 改回 `'图鉴'` ⇒ `1 failed | 30 passed`；复原 ⇒ `31 passed`。

**验证**：`meta-menu-wall` 31/31；全量 `verify` 的 `test` 步 **PASS**，**金样本十界面整帧 sha 未变**
（本轮只换字符串来源、不改值 ⇒ 符合预期，不需重抓）。
⚠ **全量 verify 仍有 3 红**（`typecheck` / `cocos:check` / `harness:build`），根因**全部**是
`games/beads/src/game/beads-game.ts:1532` 的 `CellState` vs `"void"` 类型不匹配 —— 那是**并行会话的在制品**
（该文件 src 与 mirror 均未纳入本单提交），⛔ 不是本单引入、也不代修。

**接手修（同日 · 用户授权，2026-10-28 追加）**：先核意图再动 —— `git diff` 显示对方在修 P1
「同色多颗托盘珠归宿格重复」（`_powerupInputs` 改按色消费式分配），新增两条回归腿
**不依赖 `'void'`**；而 `CellState` = `'empty' | 'filled' | 'locked'`（`grid.ts:27`）**无 `'void'`**。
⇒ 该条件为多余笔误，删之**语义不变**（`locked` 已是唯一「不可填」态）。处置 = 工作树改
`if (cell.state === 'locked') continue;`（附注释点名判例）+ `framework:sync` 刷 mirror。
**复跑全量 `verify` = `PASS 23 ｜ WARN 0 ｜ SKIP 0 ｜ FAIL 0`（exit 0）**，四门全转绿
（`typecheck` / `cocos:check` / `test` / `harness:build`）。

**为什么不把这一行提交入库**（关键事实）：`git show HEAD:…/beads-game.ts | grep -c "state === 'void'"` = **0**
⇒ **HEAD 本身没有这个错，红只存在于未提交的在制品**。局部提交 src 一行会与「mirror 整文件同步」
冲突（HEAD 里 src 与 mirror 将不一致 ⇒ `framework:sync:check` 反被搞红）⇒ 正解 = 留在工作树，
由对方提交其功能时一并带走。⚠ 遗留风险：对方若 `git checkout -- beads-game.ts` 或整文件覆盖，本行修正会丢
（症状 = 三红复现，按本段处置即可）。

---

## WXG-T-478

**美术 review 第 2 步：出图装置 + 骨架层比对 · 负责：主理人(CodeBuddy) · 状态：🟢 已交付（2026-10-28）**

**动因**：WXG-T-476 首轮 review 判定卡在「六屏缺图」。`device-walkthrough` 只到 Session 0 前置（无真机读数），
故先把**确定性出图通道**建起来，别干等设备。

**新装置（本轮建成，可复用）**：
1. `games/beads/tests/ui-golden-scenes.ts::buildUiGoldenFrames()` —— 复用十一帧金样本态构 `RenderModel`。
   ⛔ 只**读** `STATES`：不写 sha、不改覆盖集 ⇒ `ui-golden.test.ts` 与夹具零影响（`test` 步复跑仍绿）。
2. `tools/scripts/render-ui-shots.mjs` —— 十一帧 → `temp/ui-shot/<stateId>.svg`。与金样本**同源同种子** ⇒ 实现自证。
3. 光栅化：**无头 Chrome** `--window-size=750,1334 --screenshot`。
   ⚠ 实坑：`qlmanage -t -s 750` 只产**正方形缩略图**（长边铺满即把画面下半裁掉），第一版图因此看起来「底部缺失」——
   判图前必须 `sips -g pixelWidth -g pixelHeight` 核尺寸（本条已写入 skill §2 步 7）。

**硬发现 F2 · P1 · 批 1 三页玩家不可达**：
- `open-album` / `open-local-rank` / `open-profile` 全仓只在 `view/meta-types.ts:248/250/252`（`MetaAction` 联合）
  与 `game/beads-shell.ts:666/672/678`（`switch` 分支）出现 —— **没有任何布局文件发射这些热区 id**。
- 探针实证：主菜单热区 = `open-levels/open-rank/start/open-settings/open-skins/open-signin/carousel-prev/carousel-next`；
  `levels` / `settings` / `signin` / `skins` 四屏热区表也无上述三 id。
- 后果：图鉴 / 本地榜 / 名片**有页、有绘制、有动作分支，但没入口** ⇒ `device-walkthrough` D-80（本轮新增）**当前不可能被执行**；
  美术侧也无法上屏验。归属工程（入口接线遗漏 or 计划在批 2），美术侧只登记不自修。

**骨架层比对（harness 出图 ↔ `proto-v2-full` 原型定稿）**：
- 可判且一致：CTA 324×92@x218 落点与原型同区 · 棋盘居中/橱窗白板层次正确 · 左右轮播箭头对称 · 底左「好友榜」与主 CTA 相对关系正确。
- ⛔ 不可判（已在报告写死证据等级）：**纹理层全缺**（rig 用 `NullAssetProvider`，招牌木板/木框/玻璃/贴纸/高光都不出图，
  而美术主体正在这层）；**顶部区几何不作数**（`menuAnchors()` 吃 `capsuleBottomDp`，无胶囊走 `MENU_TOPBAR_TOP_FALLBACK`，
  初看「齿轮圆钮压题字」大概率是 fallback 位，按 `§0-4` 不当 P0）；**`boot` 屏不在金样本十一态内**。

**判定**：仍 `CONCERNS`，**上限未提高**（只到骨架层自证）。解除条件 = 六屏真机截图 + 观感拍板，
并新增前置：**批 1 三页入口须先接上**，否则 D-80 无法进走查。

---

## WXG-T-479

**修 F2：批 1 三页入口接线（乙·拆分） · 负责：主理人(CodeBuddy) · 状态：🟢 已交付（2026-10-28）**

**动因**：WXG-T-478 的 F2（P1）——图鉴/本地榜/名片有页、有绘制、有 `switch` 分支，但**无任何布局发射热区** ⇒ 玩家不可达、D-80 无法走查。

**落位裁定**：USER 2026-10-28 选 **乙·拆分**。三处现有版式都无空位（设置弹窗底行距「返回」仅 12px 净空，加行必撞；顶栏三颗已满），故按语义拆：
- **图鉴 / 本地榜 → 选关页底排**（语义对位十关墙与每关星级）：与「返回」(240×88 @x255) **同行两侧**，
  侧钮 207×88，边距 24 + 间隔 24，左右镜像 @x24 / @x519 ⇒ 三钮共中线对称，⛔ 不压关卡墙。
- **名片 → 签到弹窗**：两钮改**三钮一行**（3×200 + 2×25 = 650 居中 @x50，左右各 50 边距），
  顺位 **名片｜领取｜返回**（主行动居中，退出仍最右，与改前「领取在左 / 返回在右」相对序一致）。

**落码**：`copy-tokens.ts` 新增 `btn_album_label` / `btn_local_rank_label` / `btn_profile_label`（`tokens.md §7` 同步三键）·
`meta-layout.ts::levelsLayout` + `signinLayout` 加热区 · `meta-widgets.ts::label()` 加三条 case（⛔ 视图不落字面）·
壳 `_applyMetaAction` 的三个 `case` 早就在（本轮不需改）。

**功能实证（9/9，逐 step 推进 0.5s 排转场）**：主菜单→选关 ✅ →图鉴 ✅ →返回选关 ✅ →本地榜 ✅ →返回选关 ✅ →
返回主菜单 ✅ →签到 ✅ →名片 ✅ →返回签到 ✅。（探测脚本走 `metaLayout` 热区 + `shell.tapMeta`，与真实输入同一条腿。）

**金样本（K-051/K-053/ADR-0032 DEC-6 登记在 `ui-architecture-beads`）**：`level-select` 1409→**1413**、
`level-select-mid` 7048→**7052**、`signin` 5668→**5670**；其余八态 sha/total **逐字未变**（⇒ 改动局部化自证）。
夹具由 `ui-golden-capture.ts` 在提交锚重抓（两遍确定性自证 PASS），⛔ 未手改。

**守卫（防回退/防重叠）**：`signin-content.test.ts` 断言三钮等宽、间隔 25、触控地板、可命中；
`arc-level-select-page.test.ts` 新增「底排入口」例：同行、镜像、间隔 24、边距 24、宽 ≥ TOUCH_MIN、可命中。
⚠ 首版把 `hitTestMeta` 第 4 参误传 `WALL_ROWS`（签名要 `MenuAnchors`）⇒ typecheck + test 双红，已改正。

**残留**：`metaLayout('album'|'localRank'|'profile')` 仍复用 `skinsLayout`（纯展示、只有通用返回钮热区，`[WXG-T-470/471/472]` 已注明）——本批不新增页内热区，故不扩张。

---

## WXG-T-480

**美术 review 第 3 步：资产逐件对账 · 负责：主理人(CodeBuddy) · 状态：🟢 已交付（2026-10-28）**

**口径更正（重要）**：首轮把 `assets-spec §1` 当「资产清单」是**误用**——它是珠子/槽位/道具/HUD 的**绘制参数卡**（程序化），
不是文件清单。文件级对账的真源是 `final/README.md` 的「assets/menu 台账」⇒ 本节起改用它。

**四处对账**：`final/README.md` 台账 ↔ `final/assets/menu/`（原件）↔ `cocos/assets/textures/`（接线件）↔
`cocos/build/wechatgame`（产物）。

| 方向 | 结果 |
|---|---|
| 已接线件是否真在盘面 | **漏接线 0**：台账 21 件除 `ui_menu_signboard` 外，全部在 `cocos/assets/textures/` 有同名 `.png + .meta` |
| 在途 | **1**：`ui_menu_signboard.png`（带绳整块版 vs「绳不随切图走」旧裁 ⇒ 双轨待 runtime 选型，台账已标 ⏳） |
| 盘面有台账无 | **0** |
| **P2 文档漂移** | README 写「`menu/` 18 件」，盘面实 **21 件**（含 `ui_menu_cta_label` / `ui_menu_seal_cleared` / `ui_menu_signboard`）⇒ 归 art 侧一字勘误，⛔ 本单不代改 art 正本 |

**反误报（同样是「先查语义再报」）**：
1. 四个 `{bead,grid}-hole{,less}-tint-128-mask.png` 看着像「未入账」，实为 blit 着色管线件，
   **已在 `design/art/specs/tint-mask-asset-spec.md` + `ADR-0030`** 登记，消费方 `host/beads-blit-carrier.ts:85-88` ⇒ 不报。
2. **命名口径差非缺陷**：`MENU_TEXTURES.caseFrame` ↔ 文件 `ui_showcase_frame.png`、`plate` ↔ `ui_showcase_plate.png`、
   `cta`/`ctaPressed` ↔ `ui_btn_start_9s(_pressed)` ⇒ **token 名 ≠ 文件名**，对账必须按 `MENU_TEXTURES` id 表查，
   ⛔ 按词面匹配会一口气假报 3 条（与 skill §6-2 同族）。
3. 产物内 28 张图 ≠ 源件数：Cocos 导入改 uuid 命名，无法与源件一一对；字节等值层由 `check:cocos-mask` 与
   `mask:diff` 机械守，本单不重复造轮子。

**结论**：资产层**无 P0/P1**。整体判定仍 `CONCERNS`（六屏真机图未取，而纹理层正是美术主体）。

---

## WXG-T-481

**勘误 art 台账：`menu/` 件数 18→21 + 补三行 · 负责：主理人(CodeBuddy) · 状态：🟢 已交付（2026-10-28）**

**动因**：WXG-T-480 资产对账发现 `final/README.md` 的「`menu/` 18 件」与盘面 **21 件**不符。用户 2026-10-28 授权代改 art 正本。

**先查再改（关键）**：核台账逐行 → `ui_menu_cta_label` / `ui_menu_seal_cleared` / `ui_menu_badge_progress` 三件**在台账里连行都没有**（`grep -c` 全为 0）。
⇒ 若只把 18 改成 21 = **假勘误**（数字对了、来源仍黑箱）。故按「补行 + 改数」两步做。

**来源取证（不编历史）**：三件均在同一提交入仓 ——
`git log --diff-filter=A -- <path>` 三处一致 = **`9c553e0c`（2026-10-16「菜单走马灯 v3.5–v3.9 实装、主题 themes 分包与纹理换代 PNG」· WXG-T-282）**；
接线状态不是抄旧记，而是**实核代码**：`MENU_TEXTURES.{badgeProgress,sealCleared,ctaLabel}`
→ `cocos/assets/scripts/host/beads-blit-carrier.ts:132/133/134` 三条 path 映射齐备，且 `cocos/assets/textures/` 有同名件 ⇒ 均**已接**。

**落笔**：README「三类目录」行改「`menu/` **21 件**」并留勘误注（点名三件 + 本单号）；台账表在 `ui_menu_badge_locked` 行后补三行，列「来源批次 / 接线状态（含 carrier 行号）」。
台账行数 ≠ 件数（多行是多件合并，如 `ui_btn_circle_normal/pressed + ui_icon_sound/mail/settings` 行 = 5 件）⇒ 件数校验以 `ls` 为据：**21 = 18 + 3** ✓。

**影响**：不涉代码、不涉金样本。WXG-T-480 报告里该 P2 项标已闭。

---

## WXG-T-470

**Meta 页族批1①：图鉴（album）· 负责：主理人(Trae) · 状态：🟡 立项（2026-10-28）**

**背景**：concept.md §7 Meta 页族（v1.4 新增）——图鉴 = 10 关缩略图墙 + 每关星级。批 0（主菜单 shell/关卡选关/签到/设置 overlay/体力钱包顶栏）已 100% 落码，meta-ui overlay 值域转正（v1.96），批 1 启动。

**真源与约束**：
- `systems-index.md` §3.14 `meta:overlay` v1.96 值域 `none|signin|settings|levels|skins` 需回加 `album`（8 值）
- 零新存档字段：数据源复用 `starsByLevel[]`（`beads-game.ts:1059 flattenStars`）+ `ARCS[].textureId` / `ARCS[].levelRefs`（10 关缩略图）
- L5 纪律：`buildMetaView` 只读 `MetaViewData` 投影，视图不持状态、不查表
- 弹窗态叠主菜单：`BASE_PAGE['album'] = null`，复用 `panelPage` 容器

**代码改动清单**：
1. `meta-types.ts:18` — `MetaOverlay` 加 `| 'album'`；`:197` `MetaAction` 加 `| 'open-album'`；`MetaViewData` 加可选投影字段
2. `meta-view.ts:152-164` — `META_PAGES` 加 `album: panelPage(COPY_TOKENS.btn_album_label, UI_SCRIM.alpha, drawAlbumContent)`；`:170-176` `BASE_PAGE` 加 `album: null`
3. `beads-shell.ts:_applyMetaAction` — 加 `case 'open-album'`：`_cancelPageFx()` + `_phase.openModal('album')` + `_emitOverlay(true)`
4. **新文件** `games/beads/src/view/meta-pages-content.ts::drawAlbumContent(builder, layout, data, palette)` — 10 关缩略图 2×5 网格 + 每关星级（通关 ★/未通关 灰点 + 锁定态）
5. 主菜单入口：复用走马灯右侧或顶栏区三颗现有钮扩容，`open-album` 入口钮画法 / 几何 / 路由

**验证**：`pnpm typecheck` 绿 + `drawAlbumContent` 不创建新分配（L5）+ 零新存档 + `_emitOverlay({open:true, name:'album'})` 发事件

---

## WXG-T-471

**Meta 页族批1②：本地榜（localRank）· 负责：主理人(Trae) · 状态：🟡 立项（2026-10-28）**

**背景**：concept.md §7 — 本地榜 = 每关星级展开排序 + 自己（当前关）高亮。与对局内好友榜 `rank-panel.ts` 分属不同通道（meta overlay ≠ rank panel）。

**真源与约束**：
- overlay 值域回加 `localRank`（8 值）
- 零新存档：展开 `starsByLevel[]` 为 `{levelIdx, stars, cleared}` 数组 → 按 `stars DESC, levelIdx ASC` 排序
- 与 WXG-T-432 好友榜区分：好友榜是「好友排名」用 `rank-panel.ts`（对局内），本地榜是「自己每关历史」用 meta overlay

**代码改动清单**：
1. `meta-types.ts:18` — `MetaOverlay` 加 `| 'localRank'`；`:197` `MetaAction` 加 `| 'open-local-rank'`
2. `meta-view.ts` — `META_PAGES` + `BASE_PAGE` 各加 1 行（同 album 模式）
3. `beads-shell.ts:_applyMetaAction` — 加 `case 'open-local-rank'`
4. `beads-shell.ts::buildRenderModel` — 从 `starsByLevel` 派生 `localRankItems` 数组（只读，零分配热路径）
5. **同文件** `meta-pages-content.ts::drawLocalRankContent` — 排名列表（序号 / 大关名 / ★n / 自身高亮行）

**验证**：排序逻辑单元断言（零新常量）+ 自身高亮正确 + `_emitOverlay({open:true, name:'localRank'})`

---

## WXG-T-472

**Meta 页族批1③：名片（profile）· 负责：主理人(Trae) · 状态：🟡 立项（2026-10-28）**

**背景**：concept.md §7 — 名片 = 累计星 / 通关关数 / 体力胶囊 / 钱包胶囊 / 签到周期一览。

**真源与约束**：
- overlay 值域回加 `profile`（8 值）
- 零新存档字段：派生投影 = `totalStars = starsByLevel.reduce(a+b)` + `clearedCount = starsByLevel.filter(s>0).length`
- 数据源：`meta.stamina / meta.coins`（顶栏已在用）+ `starsByLevel[]` + `signinDay`

**代码改动清单**：
1. `meta-types.ts:18` — `MetaOverlay` 加 `| 'profile'`；`:197` `MetaAction` 加 `| 'open-profile'`
2. `meta-view.ts` — `META_PAGES` + `BASE_PAGE` 各加 1 行（同 album 模式）
3. `beads-shell.ts:_applyMetaAction` — 加 `case 'open-profile'`
4. `beads-shell.ts::buildRenderModel` — 派生 `totalStars` / `clearedCount`（热路径零分配：用 `data.starsByLevel` 只读引用原地 reduce）
5. **同文件** `meta-pages-content.ts::drawProfileContent` — 统计卡（累计星 ★ / 通关关数 / 体力胶囊 ♥ n/n / 钱包胶囊 ◆ n / 签到周期 7 格）

**验证**：派生值单元断言（totalStars / clearedCount 从 starsByLevel 正确算出）+ `_emitOverlay({open:true, name:'profile'})` + 与顶栏胶囊同串值（复用 drawButton / heartBarLabel）

---

## WXG-T-482

**台账瘦身：头注沿革原文外移 + 86 行归档（`production/TASKS.md` 77,150 → 17,147 tok）**（✅ 完成 · 2026-10-28 · 主理人(CodeBuddy)·治理轨）

### 1. 触发

用户在本单三选项（A 只归档 / **B 归档＋头注外移** / C 只外移头注）中拍板 **B**。

前置诊断顺带订正了上一轮的两处量纲混用：① `tasks:archive --until-under=20` 的 20 是 **token** 阈值（`estimateTokens` 返回值），不是行数，也不是千 tok ⇒ 它要求「压到 20 tok」，永远达不到（全归档地板 56,660）；② `check:tasks` 的「**观察哨 20**」是**主表行数**（`check-tasks.mjs:57-58` 注释：「……使『行数观察哨 20』成为不可达目标」），与 token 无关。

### 2. 诊断——为什么单靠归档治不动

| 段 | tokens | 归档器能否搬 |
|---|---:|---|
| 行 3–4 格式说明 + 行 5 锚头 + 行 8 勘误 | 248 | ❌ 非表行 |
| 行 5 沿革尾 + **行 6** + 行 7 | **39,909** | ❌ 只认 `^\| WXG-T-\d+` 且状态列 ✅ |
| 正文 127 任务行 | 36,815 | ✅ 其中 87 行可归档 |

行 6 单行即 **775 段「NNN = 本会话…」/ 67,097 字符 / 36,452 tok**。⇒ 归档**地板** = 56,660（87 行全搬空仍在此数），而台账 77,150 / 80,000 余量只剩 2,850。

旁证口径：`lib/context-index.mjs:535` 对 tasksIndex 档的设计预期写「**领号头注 ≈2 万 tok** + 主表」，实测头注 40,078 tok = 预期的 2 倍。

### 3. 动作

1. **头注外移**：行 5 锚头保留（机械校准锚 —— `tasks:archive` 的 `headerIdx`/`headerLeadMax` 与 `check:tasks` F 项都靠 `当前已分配至 **WXG-T-\d+**` 解析），沿革尾 + 行 6 + 行 7 **逐字节原文**搬进 `production/archive/TASKS-ledger-notes.md`（§A 沿革流水 / §B 建档沿革 + ADR 编号表）。落 `production/archive/` ⇒ 命中 `SKIP_DIRS` **不进 ctx 索引面**（先例 T-029 / T-040 / T-065）。
2. **活跃欠账留主表**：新增一行「**用过号未自登主表清单**」（222 / 257 / 280·281 / 282 / 283 / 285 / 286·287 / 289 + 203–207 区间披露）——号清单一字不减、明细指 §A；否则后续领号会话再也读不到这条 K-137 欠账。
3. **归档 86 行**：`--until-under=17200 --skip-ids=414 --write` ⇒ 主表 127 → **41** 行、详情 149 → **63** 节，守恒通过（86 行 == 86 节）。
4. **去重**：删 `TASKS-DETAIL.md` 第二个 `## WXG-T-415` 节（与首份 **md5 逐字节相同** `557265114fc7`，各 57 行 / 4,670 字符；成因 = 两次提交各插一份 `db90a8bf` 19:08:56 / `5573d034` 19:09:10 ⇒ K-182「解冲既能丢行也能 dup 行」的另一面）。
5. **工具补齐**：`archive-tasks.mjs` 新增 **`--skip-ids=<a,b>`**。

### 4. `--skip-ids` 为什么必要（本单实测暴露）

`takeDetailSections` 只按 ID 匹配 ⇒ 同一个号在详情里有两节时会被**一并**搬走，节数 ≠ 行数 ⇒ 守恒 fail loud、**整批不落盘**（首次实测：87 行 vs 89 节）。而撞号归属需人判（判例明令 ⛔ 不代填 / 不自动合并）⇒ 归档器必须能**绕开**待裁定行继续治理其余部分，而不是被一行卡死。过滤点 = `eligibleRows()`（三种策略共用的唯一选行口径）+ 年龄档循环各一处，语义单源在 `SKIP_IDS`。

### 5. 读数

| 门 / 文件 | 读数 |
|---|---|
| `check:tasks` | ✅ OK —— 主表 41 行 / 详情 63 节配对完整；归档 322 节与行成对；H 项 note（41 > 观察哨 20）、I 项「最近 40 笔共署 20 号，全部在册」 |
| `production/TASKS.md` | **77,150 → 17,147**（/80,000，余 62,853；占 21.4%） |
| `production/TASKS-DETAIL.md` | **233,135 → 120,774**（/205,000，余 84,226 ⇒ **T-446 的 tasksDetail 超限豁免可撤**，原 114%） |
| `production/BACKLOG.md` | 11,613 / 16,000（本单未动） |
| `production/archive/TASKS-ledger-notes.md` | 新增 40,257 tok（archive 目录：不进索引面、不吃 B 项） |
| `tasks:archive` 空转自证 | 迁移后跑默认档 → 「0 行、头注号与全局最大号一致」（锚仍可定位） |

### 6. 遗留

1. **T-414 撞号未处置（⛔ 本单不代填）**：`c28c706f`（CodeBuddy「本关最快时间」展示位提案，2026-10-26 **13:47** 入库）与 `e0443c03`（WorkBuddy 帧率档实现，同日 **18:54** 入库）各取一次 414；主表只有帧率档那条、`BACKLOG.md:38` 是提案 ⇒ 详情两节内容不同（810 vs 3,007 字符），**非重复**。按 K-046「入库者保号」提案在前 ⇒ 帧率档应改号，但那是内容判定，需人拍。本单以 `--skip-ids=414` 让行与两节原样留主表。
2. **主表行数观察哨 20 仍不可达**（现 41 行 = 40 活跃 + 1 个 414）。40 个非 ✅ 行（🚧19 / 🟢8 / 🔄6 / ⛔3 / 🟡3 / 📋1）是真实工作负载、非可归档项 ⇒ 该观察哨在现活跃度下与 T-407 拆 BACKLOG 前**同型不可达**。⛔ 本单不改阈值（门限 = 安全余量设计，须设计侧裁定）。
3. **`check:tasks` 不查「详情同号多节」**：本单遇到的 415 重复与 414 撞号都是它看不见的形态（K-182 同族），建议另开单补一腿。
4. 头注沿革外移后，`production/archive/TASKS-ledger-notes.md` 需**手工维护**（归档器不管它）；新领号若要写沿革，写进该文件而非主表头注。

---

## WXG-T-483

**台账三件收口：T-414 撞号裁定 + 行数观察哨量纲钉死 + `check:tasks` L 项新门**（✅ 完成 · 2026-10-28 · 主理人(CodeBuddy)·治理轨）

### 1. 触发

用户令「处理 T-414 撞号未处置 /「观察哨 20」是主表行数 / check:tasks」—— 即 T-482 §6 遗留 1–3 三条一次收口。领号已核：头注下一可用 483，且 483 全树零引用。

### 2. T-414 撞号裁定 ⇒ 提案改领 `WXG-T-484`

| 面 | 提交 | 入库时间 | **提交信息署号** | 代码引用 |
|---|---|---|---|---|
| 「本关最快时间」展示位提案（BACKLOG） | `c28c706f` | 2026-10-26 **13:47** | **WXG-T-413**（正文写「登记 413/414」） | **0 处** |
| 帧率档 + 性能快照（主表 ✅） | `3bae99b1` | 2026-10-26 **18:54** | **WXG-T-414** | **14 处**（framework ×7 + `beads-shell.ts` + 两游戏 cocos 镜像） |

**两条依据**：

1. **K-046 的「入库者保号」口径落在「提交信息署号」上，不是「台账行登记」** —— 414 的正式署号在 `3bae99b1`；本提案的登记提交 `c28c706f` **自己署的是 413**，414 从未在提交信息里被本提案署用过 ⇒ 按判例本提案就不是「入库者」，改号不破 K-046。
2. **改号代价差一个数量级** —— 帧率档要动 14 处源码注释（含两游戏 cocos 镜像），提案零代码引用。

⚠ 若只看台账行 blame（13:47 先于 18:54）会得出**相反**结论；这正是「入库」二字必须按**提交信息**解的原因。已在小节标题下留订正注（K-053，⛔ 提交历史不回改，以本台账为准）。

### 3. 行数观察哨量纲（行数，不是 token）

`check-tasks.mjs` 的 H 项量的是**主表行数**，与 `tasks:archive --until-under=<N>` 的 **token** 阈值是两把不相干的尺子。10-28 曾混用（把 20 当 token 门槛）⇒ 得到「压到 20 token 以下」这种永远达不到的假目标（全归档地板 56,660）。

本批改法（**⛔ 不动阈值**）：
- 文案头一句显式写「主表 **N 行** > 行数观察哨 20（⚠ 本哨量**行数**，与 `--until-under` 的 token 阈值无关）」；
- 加分解「✅ 可归档 X 行 ／ 活跃 Y 行」—— 哨兵只对**可归档**那部分有杠杆；
- `活跃行 ≥ 哨兵` 时明报「**结构性不可达**（非台账债务；改它属门限裁定，⛔ 本门不自调、⛔ 不据此催归档）」，与 T-407 拆 BACKLOG 前的形态同源。

### 4. `check:tasks` 新增 **L 项**「详情同号多节」

盲区成因：`detailIds = new Set(sections.map(s ⇒ s.id))` 把「几节」这一维丢掉了 ⇒ C 项只判「有没有」，`## WXG-T-414` 出现两次这类形态长期隐身。实际代价 = `tasks:archive` 的成对搬运按 ID 匹配 ⇒ 同号两节一并搬走 ⇒ 节数 ≠ 行数 ⇒ 守恒 fail loud、**整批不落盘**（T-482 实测 87 vs 89）。

判据设计（**只报不裁**）：
- 同 id 出现 ≥ 2 次 ⇒ FAIL，并**顺带区分** dup（逐字节相同 ⇒ 删副本即可）与撞号（内容不同 ⇒ K-046 人工改号后改标题）；
- 诊断直接点名 `⛔ 不要靠 tasks:archive --skip-ids=<号> 长期绕开`（那是应急阀门，不是处置）。
- 汇总行同步改为「详情 N 节（唯一 ID M）」⇒ dup 数量一眼可见。

判别力实证（先红后绿）：加门当场红出 `L: production/TASKS-DETAIL.md 有 2 个 ## WXG-T-414 小节 —— 同号多节（**内容不同 = 撞号**…）`；改号后转绿。

### 5. 读数

| 门 / 文件 | 读数 |
|---|---|
| `check:tasks` | ✅ OK —— 主表 **43** 行 / 详情 **66** 节（唯一 66）配对完整；L 项 0 命中；H 项改报「✅ 可归档 2 ／ 活跃 41 ⇒ 结构性不可达」 |
| `production/TASKS.md` | 17,322 → **17,583**（本单 1 行 + 头注 482→484） |
| `production/BACKLOG.md` | 414 → 484（行长 119 ≤ 160） |
| 414 引用面 | **14 处源码注释零改动**（号未变） |

### 6. 遗留

1. **行数观察哨 20 是否重裁**（属设计侧门限裁定，本批未擅改）三选项：甲 保持 20 + 纯披露（= 本批现状）／乙 按「活跃行 + 常数」派生（判例 K-089 追记批评过「可执行数字阈值过期」形态，须慎）／丙 只对 ✅ 行计数（改语义）。
2. 帧率档那节末尾仍写「**WXG-T-414 零占用**，直接领」—— 那是当时的取证原文（K-053 ⛔ 不回改），与本批裁定并读即可。

---

## WXG-T-485

**art-review P1-1 / P1-2 收口：落地单两处自相矛盾数值订正**（✅ 完成 · 2026-10-28 · 主理人(CodeBuddy)·治理轨）

### 1. 触发

用户点选 art-review 偏差表里的两条 P1。两条共同特征：**代码没错，落地单数值与本件自身几何 / 纹理事实互斥** ⇒ 按 AGENTS.md §4「文档冲突先改文档再改代码」处置，**代码零改动**。

### 2. P1-1 通关飘带

落地单 §3 元素表原写「在裁切区右上角内缩 12（**x477, case0+142**）」，三处互斥：

| 判据 | 计算 | 结论 |
|---|---|---|
| x 右界 | 477 + 101 = **578** vs 裁切区右界 197+361 = **558** | 溢出 **20px**，与同行「内缩 12」自相矛盾 |
| x 派生 | `197+361−12−101` = **445** | = 代码 `g.clipBox.x + g.clipBox.w − inset − MENU_SEAL.w` |
| y 来源 | `case0+142` = v3.7 作废徽标 `MENU_BADGE.yOff` | 旧值残留 |
| y 派生 | 顶 = `(case0+168+527) − 12 − 140` = **case0+543** | = 代码 `clipTop − inset − h` |

⇒ 订正为 `x445` / 顶 `case0+543`，并把「运行时尚未改」改为「已按派生值实现」（核实 `meta-menu.ts` cleared 分支）。

### 3. P1-2 CTA 文案

落地单原写「高 56、水平居中、**顶距钮顶 2**」；代码 `MENU_CTA_LABEL = {h:56, fromTop:0.42}` ⇒ `cy = 钮底 + 92×0.58` ⇒ **框顶距钮顶 10.64**（Δ8.64）。

消歧证据（PIL 直测源图，非估算）：

```
纹理 964×253  alpha bbox = (0, 0, 964, 253)   ⇒ 零透明边
上透明 0.0%  下透明 0.0%  有效字高 253px (100.0%)
alpha 重心 y = 125.9px = 框内 49.76%            ⇒ 重心 ≈ 中心
```

三种摆法的落位对比（钮高 92、绘制高 56）：

| 摆法 | 字顶距钮顶 | 底留白 | 字重心距钮顶 |
|---|---:|---:|---:|
| 落地单「顶距 2」 | 2.00 | 34.00（钮高 61%） | 29.86 |
| **代码「框中心 = 42%」** | **10.64** | **25.36** | **38.64** = 钮面 42% ✅ |
| 算术居中 | 18.00 | 18.00 | 45.86 |

⇒ 零透明边使「顶距 2」等价于「字顶距 2」，会把字重心压到钮面 **32.5%** 且底留白达钮高 61%（视觉明显失衡）；代码的 42% 口径与 `MENU_CTA_LABEL` 注释「重心落在钮面自顶 42%（原型）」**自洽**。判「顶距 2」为程序化 `builder.text`（`baseline='middle'`）时代残留 ⇒ **订正文档为 10.64，代码不动**。

同批把 `tuning/menu.ts` 的注释措辞「重心」改为「**框中心**」（实测重心 49.76% ≈ 中心，两词在此等价，但「中心」与 `cy` 公式字面一致），并注明零透明边与 v3.8 旧值。

### 4. 改动面（**零代码逻辑改动**）

| 文件 | 改动 |
|---|---|
| `design/art/specs/menu-layout-implementation-spec.md` | §3 飘带行（3 处：括号数值 / 锚点列 / 偏移列 + 末尾「运行时尚未改」）；§3 CTA 行文案口径；文件头新增 **v3.9 文档订正**引用块 |
| `games/beads/src/config/tuning/menu.ts` | 仅 `MENU_CTA_LABEL` 上方注释（4 行 → 5 行），**常量值未变** |

### 5. 遗留

1. P1-3（招牌右界 560 与顶栏中档图标左界 560 **净空 0**）仍待**设计裁定** —— 属 §3 链常量冲突，非实现 bug，本批未动。
2. P2 六条（条高双值 / 作废 64² 徽标死值 / 注释 917 陈旧 / `assets-spec §1` 无位图清单 / `MENU_FILE` 台账腿失效 / 4 孤儿件）未处置。
3. 本批只订正**数值**，未重跑出图复验（改动为文档 + 注释，渲染不变）。

---

## WXG-T-486

**P1-3 收口：顶栏 `skins` 自 x560 改挂左侧第二枚**（✅ 完成 · 2026-10-28 · 主理人(CodeBuddy)·治理轨）

### 1. 用户裁定

「右侧按钮可以放到左侧第二个布局」⇒ 顶栏由「一排三枚 24/560/648」改为「**左列两枚 + 右上单枚**」。

### 2. 改动

| 面 | 改动 |
|---|---|
| `tuning/layout.ts` | `MENU_TOPBAR_X.skins` 560 → **24**；新增 `MENU_TOPBAR_ROW2_DY = 88`（= `TOUCH_MIN`，热区边贴边） |
| `view/meta-layout.ts` | `skinsHit.y` 再减 `MENU_TOPBAR_ROW2_DY`（下移一行） |
| `view/meta-menu.ts` | `skcy` 减 `MENU_TOPBAR_ROW2_DY`（视觉圆心跟热区同源） |
| 落地单 §3 顶栏行 | 热区左缘 `24/560/648` → **`24/24/648`** + 根因与判据 |

### 3. 净空（P1-3 的量化解）

| 量 | 改前 | 改后 |
|---|---:|---:|
| 招牌板体左缘 vs 左列右缘 | 194.2 vs 108 → **+86** | 不变 |
| 招牌板体右缘 555.4 vs 右侧钮左缘 | **+4.6**（skins x560） | **+92.6**（mail x648） |
| 招牌框右界 560 vs 右侧钮 | **0（相切，字被压）** | +88 |

### 4. 测试处置（**设计变更的正当后果，非为过测改判据**）

| 测试 | 处置 |
|---|---|
| `beads-shell.test.ts` 入口腿 | 中心 x `[68,604,692]`+「y 全等」→ `[68,68,692]` +「skins 低 88、mail 同行」 |
| 同上「画法腿」 | 旧按 `x≈604` 筛 1 枚圆 → 按 `x≈68` 筛该列 ≥2 枚且**全部无 alpha**（保留原文「不得留 α0.5 残影」原意） |
| `menu-layout-v35.test.ts` 净空腿 | 对 `skins(560)` 取净空 → 对 `mail(648)` 取，并加「`mail − 板体右缘 > 80`」 |
| `ui-golden` 十一帧 | **重出基线**：`WXG298_SOURCE_REV=$(git rev-parse --short HEAD) node … ui-golden-capture.ts`（该 env 是脚本自带的防误重基线守卫，缺失即拒写 —— 本次实测触发过，属正向守卫） |

### 5. 读数

`pnpm run test` = framework **550** / breakout **239** / beads **1411**（+2 skipped）**全绿**；十一帧确定性自证 PASS。

### 6. 遗留

1. 顶栏图标语义错位仍在：`skins` 位图标暂用 `iconSound`（喇叭）顶替，`[待 UI 设计]`（原样未动）。
2. 左列两枚纵向间距取 88（= 热区边贴边），**视觉**上是否要在两圆之间留 8px 隙（如 pitch 96）未定 —— 现为热区最小合规值，观感待真机。
3. P2 六条仍待处置（条高双值 / 死值徽标 / 注释 917 / assets-spec §1 / MENU_FILE 腿 / 4 孤儿件）。

---

## WXG-T-487

**顶栏改四钮两列两行：好友榜自 CTA 左侧上提为左上第二枚**（✅ 完成 · 2026-10-28 · 主理人(CodeBuddy)·治理轨）

### 1. 用户裁定

「把好友榜放到左上设计一个图标按钮，让左上右上分别有两个按钮，平衡入口」⇒ 顶栏从「左列 2 + 右单单 1」改为**对称四钮**。

### 2. 布局

```
左列 x24            右列 x648
settings (行1)      mail   (行1)
rank     (行2)      skins  (行2)     行距 MENU_TOPBAR_ROW2_DY = 88 = TOUCH_MIN
```

| 面 | 改动 |
|---|---|
| `tuning/layout.ts` | `MENU_TOPBAR_X = { settings:24, rank:24, mail:648, skins:648 }`（新增 `rank` 键；`skins` 由 24 复位 648） |
| `view/meta-layout.ts` | `rankBox` 由 `box(24, ctaBox.y+(92−88)/2, **140**, 88)` → `box(24, btTopY−88−88, 88, 88)`；`rankHit = rankBox` 同对象保留 |
| `view/meta-menu.ts` | 删左下纸面文字钮 `drawButton(...'paper', '好友榜')`；`drawTopbar` 增第四枚（底圆 + 按下纹） |
| 落地单 §3 顶栏行 | 热区左缘改「左列 24 / 右列 648」+ 四钮两列两行说明 |

### 3. 净空（P1-3 的持续守护）

`x560` 已不是任何钮的坐标 ⇒ 招牌两侧净空同时为正：左列右缘 108 vs 板体左缘 194.2（+86）、右列左缘 652 vs 板体右缘 555.4（+96.6）。

### 4. ⚠ P1 遗留：好友榜图标缺图

`MENU_TEXTURES` 只有 `iconSettings` / `iconSound` / `iconMail` 三枚图标，**没有** `ui_icon_rank`。按信封判例「⛔ 程序化腿不自造图标（切图规格权威）」⇒ 该钮目前**只画空圆底**，不画替代图形。

**后果**：玩家看到一个无标识圆钮，**不可识别**。上线前必须补切图 `ui_icon_rank`（160² @2x ⇒ 绘制 40²），落到 `MENU_TEXTURES.iconRank` 后在 `drawTopbar` 第四枚处 `blit` 即可（位置已就绪）。

⚠ 四钮只对应三枚图标 ⇒ 必然有一枚语义错位：现 `skins` 仍借 `iconSound`（`[待 UI 设计]`，T-365 遗留）。补齐 rank 后仍缺「装扮」图标，建议与 `ui_icon_rank` 同批出图。

### 5. 测试处置（设计变更的正当后果，非为过测放宽）

| 测试 | 处置 |
|---|---|
| `beads-shell` 入口腿 | 中心 x `[68,68,692]` → `[68,692,692]`（skins 复位右列）；「skins 低 88 / mail 同行」保留 |
| `menu-anchors` ×5 档 | ② 段由「rankHit.y === ctaBot+2（与 CTA 底缘同源）」→「rank 落顶栏：x=24、y=settingsHit.y−88、w/h=88」；③ 段删 rank 底部两行（已不在底部） |
| `menu-layout-v35` | 「右两颗横向 pitch 88」断言作废 → 「`rank.x===settings.x`、`skins.x===mail.x`、`ROW2_DY ≥ 视觉 80 且 === TOUCH_MIN`」 |
| `ui-golden` 十一帧 | `WXG298_SOURCE_REV` 重出基线（确定性自证 PASS） |

### 6. 读数

`pnpm run test` = framework **550** / breakout **239** / beads **1411**（+2 skipped）全绿。

### 7. 遗留

1. **P1** 好友榜图标缺图（见 §4）—— 需切图 `ui_icon_rank`。
2. `skins` 图标仍借 `iconSound`（T-365 遗留），建议与上条同批出图。
3. 左列/右列两枚纵向间距 88 = 热区贴边，视觉是否留 8px 隙待真机观感。
4. 原「好友榜 = CTA 左侧」的布局不再存在 ⇒ 若日后要在 CTA 侧恢复任何入口，需重新领号评估（⛔ 不要与顶栏钮并存造成双入口）。

---

## WXG-T-488

**生成 `ui_icon_rank` 图标资源与效果图（云 qwen-image-3.0）**（✅ 完成 · 2026-10-28 · 主理人(CodeBuddy)·治理轨）

### 1. 触发

解 T-487 §4 的 **P1 遗留**：好友榜钮已上提顶栏左上第二枚，但 `MENU_TEXTURES` 只有 iconSettings/iconSound/iconMail 三枚，该钮只能画空圆、对玩家不可识别。用户令「用在线生图 qwen 生成 ui_icon_rank 图表效果图和资源」。

### 2. 可复现配方（skill 交付纪律 §6-2：证据不得只存 temp/）

```bash
# 定稿（v1）
python3 games/beads/design/ai-workflows/dashscope-generate.py \
  --model qwen-image-3.0 --size "1024*1024" --seed 101 \
  --text "单个图标：好友排行榜（ranking）。圆润扁平 2D 卡通风格，粗描边。画面是一个领奖台 podium：
          三个并排的圆角矩形台阶，中间最高、左右两侧对称稍低，每个台阶顶面正中有一个小圆点作为名次位。
          台阶填充柔和紫色 #7C6FD9，轮廓用深紫色 #4A3FA0 粗描边。正视图，无透视，无渐变，无高光，
          无投影，无文字。图形整体居中，占画幅约 60%，四周留出充足空白。
          背景必须纯白 #FFFFFF 且完全均匀，无纹理、无渐变、无阴影、无光晕。"
```

切图（`temp/gen-rank-icon.py`，一次性脚本、⛔ 不入库）：
- 白底 `ImageDraw.floodfill(thresh=24)` 从四角灌 → 品红哨兵反解外部布尔图
- alpha **`MinFilter(3)` 边缘内退 1px 去白边** —— ⛔ 不用 `MaxFilter`（skill §3 描述的是"膨胀吃抗锯齿边"，但那是针对深色描边图；本图边缘外侧是纯白，扩张会把白像素拉进 alpha=255 造成白边）
- 裁 alpha bbox → **长边**归一 50%（按宽归一会让占高冲到 54%，明显大于原三枚的 38–49%）→ 居中贴 160×160 透明画布
- `LANCZOS` 重采样

### 3. 两版对比与选型

| 版本 | seed | 构图 | 判定 |
|---|---|---|---|
| **v1** | **101** | 领奖台三台阶：中间最高、左侧次之、右侧最低（真实 1/2/3 名高度序），台阶顶面正中嵌小圆点作名次位，顶面有极浅的立体暗示 | **定稿** |
| v2 | 202 | 纯平面三竖条，左右等高对称，圆点浮在竖条**上方**与主体分离 | 弃用：左右等高丢了名次序；圆点分离后视觉读作「三个人物」而非排行榜 |

v1 的顶面浅色层次在 80px 绘制下仅约 4–5px，起「台阶 = 名次位」的暗示作用，不糊。

### 4. 判据读数（对照既有三枚，均为 160² @2x）

| 图标 | alpha bbox 占宽 | 占高 | 不透明像素 | 主色 |
|---|---:|---:|---:|---|
| settings | 44% | 44% | 2129 | `#A19C99` 金属灰 |
| sound | 56% | 49% | 3098 | `#FDCA67` 橙黄 |
| mail | 48% | 38% | 3810 | `#B3DAFA` 浅蓝 + `#4C87BB` 描边 |
| **rank（本件）** | **46%** | **50%** | **4127** | `#7C6FD9` 紫 + `#4A3FA0` 描边 |

四枚**四色**（灰/橙/蓝/紫）⇒ 顶栏四钮在 80px 下靠色相即可区分，语义色策略与既有三枚一致。

### 5. 产出

| 文件 | 说明 |
|---|---|
| `games/beads/design/art/final/assets/menu/ui_icon_rank.png` | 160×160 成品（art 正本） |
| `games/beads/cocos/assets/textures/ui_icon_rank.png` | 运行时同件 |
| `games/beads/design/art/final/assets/menu/ui_icon_rank_source-1024.png` | 1024 源图（供日后重切/换色） |
| `games/beads/design/art/final/assets/menu/effect-topbar.png` | 效果图 A：顶栏四钮全貌（左列 settings/rank、右列 mail/skins，含招牌占位） |
| `games/beads/design/art/final/assets/menu/effect-closeup.png` | 效果图 B：rank 与 mail/settings 并排风格对比 |

**成本**：云 2 张 × 0.18 元 = **0.36 元**；本地 0 张。

### 6. 收口（2026-10-29：待办 1/2 已落地）

1. ✅ **`.meta` 已由编辑器生成**（2026-10-29 08:49 编辑器导入产出，uuid `b01fa1bb-273f-4730-9e25-b47e5a458872`，sprite-frame trim 74×80 / offset 0,0）⇒ L1 合规（非手编）。
2. ✅ **接线完成**：`MENU_TEXTURES.iconRank = 'bitmap__menu_icon_rank'`（`config/tuning/menu.ts`）；`drawTopbar` 在好友榜底圆之后按 `MENU_TOPBAR_ICON_D`（= 圆 80²）blit，缺图仍只留空圆底（信封判例不变）；两个宿主的 texId → 资产表同步：Cocos `host/beads-blit-carrier.ts::BITMAP_ASSETS`（`ui_icon_rank`）、harness `dev/harness/main.ts::MENU_FILE`（`ui_icon_rank.png`；`/menu-assets/` 本就是**目录映射**白名单 ⇒ 无需逐件登记）。
3. ⏳ **真机 80px 目检（仅剩项）**：管线侧已证「进包且字节一致」，但「像不像排行榜」是观感判据，须真机/编辑器预览确认；若被读作「三个人物」，用 `ui_icon_rank_source-1024.png` 重切（加大台阶描边间距）或改「奖杯」语义。
4. **口径修正（推翻原文第 4 条）**：「harness 无法验证」不成立 —— 只有 **Node 帧导出**（`preview:frames:beads`）看不见位图腿（`menuBitmapReady` 在 Node 侧恒 false ⇒ 程序化腿），**浏览器 harness** 会经 `/menu-assets/` 真加载菜单纹理；故目检应在浏览器 harness / 真机做。

### 7. 验证（2026-10-29）

| 门 | 结论 |
|---|---|
| `typecheck`（beads） | ✅ 0 错 |
| `test`（beads） | ✅ 118 文件 / 1413 通过 + 2 skip |
| `framework:sync:check` | ✅ 拷贝件与源码一致（game 108） |
| `check:cocos-mask` | ✅ STATUS: OK（`ui_icon_rank` 字节相同、已进包；**重构建前为 FAIL「不进包」**） |
| `build:cocos` | ✅ 55.7s（构建顺带把 beads `package.json` 记到 v1.0.5） |
| `check:size` | ✅ beads 主包 3430.3 KB（距 4096 红线余量 665.7 KB） |

## WXG-T-489

### 1. 触发

用户 2026-10-29 问「启动时候为什么设置面板盖在主界面」——指 harness 截图里压在左上角那块深色板。核对：那是 `dev/harness/index.html` 的调试层（`#hud` 信息条 + `#controls` 按钮组 + `#help` 说明块），
**不是游戏 UI，也不进 Cocos 构建产物 / 微信包**。

### 2. 遮挡量测（750x1334 视口实拍）

| 对象 | 占位（CSS px） |
| --- | --- |
| `#controls` | x 10..~270、y 56..~180（含「说明」行时更高） |
| 设置钮 bbox | x 28..108、y 119..199 |
| 相交 | 约八成 ⇒ 齿轮只剩底部一条 |

好友榜在第二行（y 199..279）恰好避开。

### 3. 根因

面板定位是**按旧顶栏**放的：`index.html` 里 T-113 注释原文写「1280x720 下齿轮中心 screen(461.3, 32.4) 正落在本条 y∈[10,46] 内」——那时设置钮在画面中部 x≈461。
T-486/T-487 把设置、好友榜挪到**左上列 x=24** 之后，面板正面压上来；而 T-113 只做了「不许吃掉画布点击」（`pointer-events: none`，仅控件 `auto`）⇒ **点得着但看不见**，视觉遮挡这一半没管。

### 4. 改动（harness 侧，零包体影响）

| 文件 | 改动 |
| --- | --- |
| `dev/harness/index.html` | 新增 `body.hud-off` 规则：`#hud` / `#controls` / `#help` 一律 `display: none`；注释记遮挡成因与量测 |
| `dev/harness/main.ts` | `?hud=off`（或 `0` / `false`）⇒ `document.body?.classList?.add('hud-off')`；⛔ 默认不隐藏 |

选型理由：加开关优于改默认布局（开发仍要靠 HUD 读 fps / 关卡 / 重开），也优于每次截图用 CDP 临时抹层（不可复现、无记录）。

### 5. 验证（同一 URL 两档对照）

| 档 | 结果 |
| --- | --- |
| 默认 `?game=beads&meta=menu` | ✅ 调试层照旧存在（齿轮仍被压）⇒ 无回归 |
| `&hud=off` | ✅ 调试层全隐，顶栏四钮（齿轮 / 好友榜 / 信箱 / 喇叭）全部露出 |
| `pnpm run harness:smoke` | ✅ 双游戏通过（`document.body?.` 可选链保证 DOM stub 下不炸） |

### 6. 用法

`http://127.0.0.1:4173/?game=beads&meta=menu&hud=off` —— 目检 / 截图 / 交给无头浏览器取证时加这一个参数即可。

## WXG-T-490

### 1. 触发

用户 review 主界面，第二轮就抛出核心疑问：橱窗走马灯该不该让人左右滑看「打过的 / 即将打的」大关，而「开始游戏」又要打当前推进的小关 —— 左右可滑会不会不聚焦、误解？我给的两问分解（问题1 开机停哪页：甲/乙/丙；问题2 浏览与 CTA 的聚焦补偿：A/B/C），用户 2026-10-29 拍板「**甲 + A**」。

### 2. 判据（三处既有裁定，本批只是接通，⛔ 不新裁）

- `menu-architecture.md §5.4` 条 1：主钮 = 唯一 1 次交互「继续」通道，**语义不变** ⇒ CTA 目标不跟随滑动是既有口径（本批新增条 4 写清「橱窗默认页 = 起点页」）。
- `arc-level-select-spec.md §6`：翻页只换列表 = **浏览行为**，不计进关成本 ⇒ 左右滑合法。
- `menu-showcase-asset-spec.md §1`：主 CTA 与橱窗同属「当前主题」语义组 ⇒ 开机必须让两者同屏成立（旧行为违背此不变式）。
- `tokens.md §7`：`btn_start_resume_label` 新键 `继续 · 第{n}关`，`{n}` 渲染期替换（判例 = `powerup_buy_confirm_title`）。

### 3. 落码（六件 + 镜像）

- `ui/main-menu-presenter.ts`：新增 `seek(page)`（无动画绝对落位，钳到 `[0, pages)`；⛔ 走 `nudge` 会带吸附动画 = 开机逐页划过）。
- `game/beads-shell.ts`：`init()` 在 `play.init`（`_boot` 解出续玩位）之后 `this._menu.seek(this._startArcPage())`；新增私有 `_startArcPage()` = 复用既有 `_arcIndexOfLevel(play.levelIndex)`，无归属（dev 导入关）⇒ 首页兜底；`_metaViewData()` 每帧投影 `carouselOnStartPage` / `startLevelSeq`（两 int 比较，零分配）。
- **同批根因修**：`_wallSlotsFor()` 的门票重算腿原取 `_phase.levelsArc`（菜单态恒 0），与 `_refreshArcGateOnMenuPage`（WXG-T-346 裁定 = 菜单态取橱窗当前页）互相矛盾 ⇒ 开机落在章 2 页时，首帧绘制把木牌 `★ n/N` 擦成 `undefined`（下一帧才自纠 = 一帧错值）。改为 `overlay === 'none' ? _menu.offset : levelsArc`。
- `view/meta-types.ts`：两枚**可选**字段（缺省 = 起点页 ⇒ 旧调用方/夹具/金样本零漂移）。
- `view/meta-widgets.ts`：`label('start')` 动态腿 —— 离开起点页 ⇒ `btn_start_resume_label` 替换 `{n}`（无关号的异常夹具回退原令牌，⛔ 空插值）。
- `view/meta-menu.ts`：CTA 艺术字位图 `ui_menu_cta_label` 恒写「开始游戏」⇒ 浏览态不画该位图，让位文字腿（切图不重出）。

### 4. 测试与验证

`main-menu-presenter.test.ts` +1（seek 落位/钳边/不启吸附）；`meta-menu-wall.test.ts` +1（浏览态文案四臂：动态/显式 true/缺省/无关号回退 + rig 帧仍出「开始游戏」）+ 令牌逐值行；`arc-ticket-gate.test.ts` 的 `goPage` helper 由「逐次点 ◀▶」改为 `seek` 绝对落位（旧 helper 隐含「启动恒停第 1 页」假设，本批后该假设不再成立；◀▶ 行为面仍由 presenter 测试钉住），并保留 `draw()` 以钉住 §3 那条一帧错值的修复。`pnpm run framework:sync` 已同步镜像；`pnpm run verify` = **22 PASS / 1 FAIL**，唯一 FAIL 是 `check:cocos-mask` 的 `ui_icon_rank`（他会话今日换源未 reimport，与本批无关）。金样本网测（`ui-golden.test.ts`）随全量绿 ⇒ 未重抓。

### 5. 撞号与并发披露（⚠ 教训件）

- **撞号**：开工前上下文里的旧头注记「下一可用号 489」，落码期间发现 **489 已被 CodeBuddy 会话占用并入库**（harness `?hud=off`）⇒ 本批改领 **490**，代码/文档标签已全量改号。教训 = 领号必须在**动手那一刻**重读 `TASKS.md` 头注，不能沿用上一轮结论（注 3 的「立即回填占位」我做到了完成时才登，跨会话窗口期内被占用）。
- **文件被外部回滚**：`src/game/beads-shell.ts` 的编辑先后两次被精确还原成 HEAD 内容（mtime 落在测试/同步时刻；Cocos Creator 3.8.8 正开着本工程 + 疑同文件在编辑器内有旧缓冲）。第三次落码后先 `git add` 留副本再验 ⇒ 保住。**并行会话改同一文件时的自保口径 = 落码后立即 `git add` 并把改动面压到最小 hunk。**
- 工作树内另有他人 in-flight 改动（`beads-game.ts` / `board-tap-router.ts` / `powerups-v2.md` / `meta-pages-content.ts` / `ui_icon_rank*.png`）⇒ 本批提交按 pathspec 只收自己的 17 件（代码 6 + 测试 3 + 设计文档 2 + Cocos 镜像 6），另加台账 2 件。

## WXG-T-491

### 1. 触发

T-488 第 3 项目检结论：`ui_icon_rank` 在 80px 下读作**三个人并排站**，不读作排行榜（6x 放大 + 四枚真尺寸并排取证），
且实物形态与 T-488 记述的「领奖台三台阶、圆点嵌顶面」不符 —— 实际就是当时被驳的「柱 + 悬浮圆点」形态。
用户 2026-10-29 裁定**选项 A：改奖杯**（排行榜通用符号，80px 最稳）。

### 2. 生成

| 项 | 值 |
| --- | --- |
| 模型 | 云 `qwen-image-3.0`（单元素切图第二选；本地 ComfyUI `192.168.1.16:8188` 探活 connection refused ⇒ 走云） |
| seed / 尺寸 | `101` / `1024*1024`，1 张 |
| 提示约束 | 正视对称；倒梯形杯体 + 两侧对称弧形把手 + 细颈 + 方底座；单色 `#7C6FD9` 平涂 + `#4A3FA0` 描边；纯白均匀背景；居中约 60%；无透视 / 渐变 / 高光 / 投影 / 光晕 / 文字 |
| 成本 | 云 **1 张 × 0.18 = 0.18 元**；本地 0 张 |

### 3. 切图口径（沿用 T-488；脚本 `temp/gen-rank-trophy.py`，⛔ 不入库）

四角 `floodfill(thresh=24)` 品红哨兵取外部背景 ∪ 近白 `min(r,g,b) ≥ 244` 补封闭孔（杯把内圈）→ alpha `MinFilter(3)` 内退 1px 去白边（⛔ 不用 `MaxFilter`）→ alpha bbox 裁 → **长边归一 50%** → 居中落 160² 透明画布 → `LANCZOS`。

### 4. 判据读数（160² @2x）

| 图标 | 占宽 | 占高 | 不透明像素 | 主色 |
| --- | ---: | ---: | ---: | --- |
| settings | 44% | 44% | 2129 | `#A19C99` |
| sound | 56% | 49% | 3098 | `#FDCA67` |
| mail | 48% | 38% | 3810 | `#B3DAFA` |
| **rank 新（奖杯）** | **40%** | **50%** | **2678** | `#8070C0` / 描边 `#5040A0` |
| ~~rank 旧（三人）~~ | 46% | 50% | 4127 | `#7C6FD9` / `#4A3FA0` |

奖杯天然窄高 ⇒ 占宽 40% 是全族最窄，占高 50% 与旧件持平（上界）。主色与既有紫族 `#7C6FD9` 同色相。

### 5. 真渲染目检（不是 mock）

`?game=beads&meta=menu&hud=off` → headless Chrome DPR 2 截图（1500×2668）：

- **6x 放大**：杯体 + 双手把 + 颈 + 底座清晰，白描边零残留，紫色与另三枚同族；
- **四枚真尺寸并排**：齿轮（灰）/ **奖杯（紫）** / 信封（蓝）/ 喇叭（橙）—— 语义互不混淆；
- 已知差异：奖杯为纯平涂，另三枚带轻微体积感（渐变 / 内阴影）。按 T-488 同档接受 —— 切图管线要求「无渐变 / 无高光」才能干净抠白底，两者互斥。

### 6. 产出与替换

| 文件 | 状态 |
| --- | --- |
| `design/art/final/assets/menu/ui_icon_rank.png` | 覆盖（旧件见 git `d8cc556d`） |
| `design/art/final/assets/menu/ui_icon_rank_source-1024.png` | 覆盖为奖杯源图 |
| `design/art/final/assets/menu/effect-topbar.png` | 覆盖为**真渲染**顶栏条带 750×380（替代原手工 mock，且原 mock 记的是旧形态） |
| `design/art/final/assets/menu/effect-closeup.png` | 覆盖为四枚真尺寸并排（3x 展示） |
| `cocos/assets/textures/ui_icon_rank.png` | 同字节（md5 一致） |
| `cocos/assets/textures/ui_icon_rank.png.meta` | 编辑器 reimport **自动重写**：`trimX 48 / trimY 40 / 64×80`（size 变了 trim 必变）——⛔ 非手编，L1 合规 |

### 7. 验证

| 门 | 读数 |
| --- | --- |
| `check:cocos-mask` | ✅ `STATUS: OK`（`ui_icon_rank` 字节相同、已进包） |
| `build:cocos` | ✅ 18.1s（增量重构建；build 顺带把 `package.json` patch ++，该文件属他人基线，本笔未纳入） |
| `check:size` | ✅ beads 主包 3430.4 KB（距 4096 红线余量 665.6 KB） |
| 单测 | ⚠ 1414 通过 / **1 红**：`arc-ticket-gate.test.ts` S-4「走马灯翻到章 2 页」期望 `[20,24]` 得 `[undefined,undefined]`。**归因 `7a4ecda9`（T-490「开机定位到当前大关」改了走马灯初始页位）**，非本笔 —— 本笔零 `src` 改动，且在 `2922b90a` 时该套件 1413 全绿 |

## WXG-T-492

### 1. 触发

主界面 review 的 UI 面（B 组）第二项：顶栏实装自 **WXG-T-486 / 487**（用户 2026-10-28 两裁）已改为 **2×2 四钮**，
但 UX 规格与三份美术规格文档仍记「三颗 / 中档 x=560 / Ø59」⇒ **在册 ≠ 在码**。用户 2026-10-29 批准 **B2 甲方案 = 纯文档回写批**。

### 2. 取证判据（改文档前先核现状）

| 项 | 读数 | 出处 |
| --- | --- | --- |
| 热区左缘 | `settings:24 / rank:24 / mail:648 / skins:648` | `games/beads/src/config/tuning/layout.ts:132`（`MENU_TOPBAR_X`） |
| 视觉圆 / 行距 | Ø80（`MENU_TOPBAR_VISUAL_D`）· 88（`MENU_TOPBAR_ROW2_DY` = `TOUCH_MIN`） | 同文件 `:144` / `:149` |
| 绘制与热区同源 | `anchoredGeo` 同一对象 ⇒ 「画 A 位按 B 位」结构性不可能 | `games/beads/src/view/meta-layout.ts:288+` |
| 装扮馆图标 | 用 `MENU_TEXTURES.iconSound`（喇叭占位） | `games/beads/src/view/meta-menu.ts:180`（注释 `:162-163` 已登 `[待 UI 设计]`） |
| 出图取证 | `tools/scripts/render-ui-shots.mjs` → SVG → `qlmanage` PNG；脚本头注自证「实现自证，⛔ 非真机像素」 | `temp/ui-shot/main-menu.svg{,.png}` |

⚠ **纠正上一轮说过重的一句**：主工作树金样本 = `games/beads/tests/__fixtures__/wxg-t-298-ui-golden.json`，对拍的是 **RenderModel 指令流**（不含贴图层级）⇒ 「ui-golden 跑绿 ⇒ 视觉未漂移」不成立，本批以常量实算 + SVG 出图为据。

### 3. 四份文档落点

| 文档 | 改动 |
| --- | --- |
| `design/ux/ux-spec.md` | 升 **v1.32**：§2 路由表 `skins` 行改记「顶栏·右列第二枚钮」；§3.8 追加回写段（旧「中档 x=560 / 三颗」转史证，不删）；文末新增「变更记录 · v1.32」含红线自证 |
| `design/art/proposals/ui-style-redesign/menu-architecture.md` | §5.1b 三颗表下加 ⚠ 史证提示；新增 **「第十三批回写」** 节 = 落位链四次改政表 + 现行四钮读数 + 四钮同构口径 + 与招牌净空复算（78 / 88）+ 未清债四条 |
| `design/art/specs/menu-showcase-asset-spec.md` | **B2** 行追加 `[WXG-T-492 现状订正]`（喇叭自 WXG-T-365 被装扮馆借走 ⇒ 在册「公告」≠ 在码「装扮馆」）；**新增 B8** = 顶栏第四枚 `ui_icon_rank`（原 B1–B3 漏登；含 T-488→T-491 沿革、切图管线、80px 读数、平涂 vs 体积感的已接受差异） |
| `design/art/specs/menu-layout-implementation-spec.md` | **v3.11**：元素清单两行订正 = 顶栏行（行标题「三钮」→「四枚 2×2」；图标列补 `ui_icon_rank`，「喇叭暂代公告」订正为「现挂装扮馆 = `[待 UI 设计]` 占位」）+ 招牌行（旧称「公告钮视觉左缘 564」订正为 2×2 档读数 652 ⇒ 净空 96 / 左列 108 ⇒ 净空 86，**结论不变、旧值划线留档**） |

### 4. 红线自证

零 `src/**` 改动 · 零 GDD §3 冻结常量 · 零新毫秒/新几何值 · 金样本与单测零扰动（未重跑 `verify`）· 旧口径一律 `~~划线~~` 留档不静默删（K-053）· 未改坐标总图（其自认过期，另单）。

### 5. 未清债（结转，本批只登记不裁）

1. 装扮馆真图标 `ui_icon_skin` = `[待 UI 设计]`（喇叭借位自 WXG-T-365 至今）；
2. 公告语义位去向 = `[待产品]`（B2 在册为「公告」，顶栏已无该位）；
3. 顶栏左右不对称：左列视觉左缘 24 vs 右列距屏边 14（§5.1b 第十三批回写已记，非违例、属观感）；
4. 版本水印在无 Home 条机型上下各仅 2 设计px（`versionY = r(a.ctaBotY)/2`，字号 28）= B3 项，未在本批范围。

### 6. 本批事故自纠（工具用法，⛔ 不入库为判例，理由见 §7）

SearchReplace 的 JSON 参数用 `\u` 转义写中文 ⇒ 落盘成「三铢/四铢」（颗 U+9897 误作 铢 U+94E2）；另一处 `original_text` 含 `### 5.2` 标题而 `new_text` 未回写 ⇒ **小节标题被删**。均以 python 带 `assert count==1` 修复并复核（铢残留 0、标题计数 1）。**后续纪律：中文一律直写字符，不用转义；插入型替换的标题行必须原样回写。**

### 7. 沉淀统计

本批 **未跑 `kb:sync`**：工作树 `knowledge/`（INDEX / ledger / CHANGELOG / lessons 两文件）含并行会话 **WXG-T-434** 未提交在制品，同提即混账（K-137 只披露不代填）。§6 两条工具用法教训作为**候选**回传用户，待其拍板后由下一次干净 kb 批入账。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-493

### 1. 触发

WXG-T-492 收尾时给出的三个后续选项，用户 2026-10-29 选 **1 = B1 甲「补装扮馆真图标 `ui_icon_skin`」** ⇒ 结清自 **WXG-T-365**（2026-10-24）起「装扮馆入口借喇叭图标顶替」这笔 `[待 UI 设计]` 债（§5.1b 未清债第 ① 条 / ux-spec §3.8 债目）。

**开工前先核阻塞是否仍存在**（判例 K-096：勿把快照日限制当永久事实）：v1.25 曾记「无编辑器做不出 `.meta`」，已被 v1.26 证伪 ⇒ 本批实测 `pgrep` 查到 **Cocos Creator 3.8.8 在跑**（pid 3391 · project = `games/beads/cocos`），`.meta` 可由编辑器/构建导入合法生成 ⇒ **L1 不构成阻塞**。

### 2. 造型裁定（用户拍板，四案对比后进账）

| 案 | 图形 | 判定 |
| --- | --- | --- |
| **甲（采纳）** | 衣架 + 圆领小衫 | 与入口名「装扮馆」同一隐喻（店招 = 衣架），80px 内两形不糊 |
| 乙 | 魔法棒 + 星闪 | 「变换」语义强，但与「装扮 = 买外观」的商品属性偏 |
| 丙 | 双门衣柜 | 家具语义压过「换装」，且 80px 内门缝/把手易丢 |
| 丁 | 一颗大珠子 + 色点 | 语义最贴（馆内实卖珠子材质外观，GDD v1.83），**但会被读成货币/关卡**⇒ 未采纳 |

### 3. 生产口径与读数

| 项 | 读数 | 出处 |
| --- | --- | --- |
| 出图 | 云 `qwen-image-3.0` · 1024² · seed 202 · **0.18 元** | 本地 ComfyUI 探活返回 `000` ⇒ 走云；提示词 `temp/prompt-skin.txt` |
| 切图 | bbox **占宽 49% / 占高 50%**；不透明像素 **3618**；填充众数 **#97CF9A**（草绿） | 复用 T-491 一次性脚本 `temp/gen-rank-trophy.py`（⛔ 不入库） |
| 入库 | `design/art/final/assets/menu/ui_icon_skin.png`（160²@2x）+ `_source-1024.png`；`cocos/assets/textures/ui_icon_skin.png` 与正本 **md5 一致** | `check:cocos-mask` → 「ui_icon_skin 字节相同」STATUS: OK |
| `.meta` | uuid `03dd1236-e5de-4a0b-811d-29e44e0cbb10`，由 `pnpm run build:cocos`（CLI 自带资产导入）**生成**，非手写 | GUI 编辑器 `touch` + 等 20s 未自动 reimport ⇒ 改走构建路径；L1 合规 |
| 接线 | 四处：`MENU_TEXTURES.iconSkins` → `meta-menu.ts::drawTopbar` → `dev/harness/main.ts::MENU_FILE` → `beads-blit-carrier.ts::BITMAP_ASSETS`；`cocos/assets/scripts/game/**` 两件镜像由 `pnpm run framework:sync` 产出 | 坐标 / 尺寸 / 热区 **零改动**（沿用右下位 648·第二行·Ø80） |

### 4. 真渲染目检（80px）

取证链两次改道：① Chrome `--screenshot --virtual-time-budget` 在 RAF 恒动的游戏页永不收敛（180s 超时被杀）⇒ 自写 `temp/cdp-shot.mjs` 走 CDP；② Cocos 编辑器预览（7456）在 headless 下只有调试条 + 黑画布 ⇒ 改打 `pnpm run harness`（4173），URL `?game=beads&meta=menu&hud=off`，1500×2668（DPR2）。
**读数**：小衫主体清晰、衣架钩可辨；与灰齿轮 / 紫奖杯 / 蓝信封四色不混 ⇒ 通过。同批刷新 `effect-topbar.png`（750×380）/ `effect-closeup.png`（2010×480）为真渲染（先采样旧 closeup 四格主色 `#A19D99/#8676CD/红点/#FECB67` 复现版式与顺序，⛔ 不沿用上批被批评的 mock 口径）。

### 5. 门禁读数

beads 单测 **118 文件 / 1415 通过 / 2 跳过** · `tsc --noEmit` **0 错** · `check:cocos-mask` **OK** · `check:size` beads 主包 **3437.4 KB / 117 文件**（距 4096 红线余量 658.6 KB）· `build:cocos` 18.0s（release 档，beads 版本 v1.0.7 → v1.0.8，⚠ 该 `package.json` bump 不随本批提交，归构建轨另计）· `check:links` / `check:tasks` 见收尾。

### 6. 文档落点（四份 + 本台账）

| 文档 | 改动 |
| --- | --- |
| `menu-showcase-asset-spec.md` | **新增 B9** = `ui_icon_skin` 全规格（造型裁定链 / 切图管线 / 80px 目检 / `.meta` 生成路径）；**B2** 行追加「借腿已撤、本枚零消费者在册」 |
| `ux-spec.md` | 升 **v1.33**：§3.8 债目第 ① 条改结清（旧句 `~~划线~~`）；文末「变更记录 · v1.33」 |
| `menu-architecture.md` | §5.1b「未清债」第 ① 条闭账注（指向 B9 / v1.33），②③④ 原样保留 |
| `menu-layout-implementation-spec.md` | **v3.12**：顶栏行资源列 `…/sound` → `…/skin`；同行顺带订正「可点」旧记「现仅设置」（四热区与处理器均在 `meta-layout.ts` / `beads-shell.ts` 在册） |

### 7. 红线自证与未清债

零 GDD §3 冻结常量 · 零几何/新毫秒 · 热区与绘制同源未动 · `.meta` 为编辑器产物 · 旧口径划线留档（K-053）· 镜像件只由 `framework:sync` 写。
**未清债（结转）**：① 公告语义位去向 = `[待产品]`（喇叭枚现零消费者，删它收益仅 2.9 KB，本批保留在册）；② 顶栏左右不对称 10 设计px = 另单；③ 版本水印贴底 = B3 项未做；④ 顶栏观感与误触 = `[待真机]`。

### 8. 本批事故自纠（工具用法，⛔ 不入库）

① zsh 通配吞参：`--size 1024*1024` / `--include=*.md` 报 `no matches found` ⇒ 一律加引号；② 后台启动用 `(... &)` 触沙箱 `nice(5) failed` ⇒ 改工具的 `is_background`；③ TS 注释误用 markdown `**` ⇒ 改「」。中文仍按上批纪律直写。

### 9. 沉淀统计

本批 **未跑 `kb:sync`**（同 T-492 口径：`knowledge/` 五件仍含并行会话 **WXG-T-434** 未提交在制品，K-137）。候选 2 条待干净 kb 批入账：「GUI 编辑器不自动 reimport 时，CLI 构建的资产导入同样满足 L1」、「headless 截 RAF 游戏页要用 CDP，`--virtual-time-budget` 永不收敛」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-494

### 1. 触发与上位债

WXG-T-493 收尾时给出的三个后续选项，用户 2026-10-29 选 **1 = 公告位产品裁定** ⇒ 收掉顶栏最后一笔语义债：自 **WXG-T-365**（2026-10-24）结转、ux-spec **v1.26** 登记的 `[待产品]`「公告语义位去向」（§5.1b 未清债第 ② 条 / ux-spec §3.8 债目）。领号 = 494（K-046：读工作树全局最大号，核实 494 仅在头注「下一可用号」出现、无表行、无 `git log` 引用）。

**先立事实基线**（避免在误读上裁定）：「公告」**从未实装** —— 历史上该位一直是禁用态空圆（α0.5、⛔ 不注册热区），WXG-T-365 只是把位置从预留位 `notice` 升格给装扮馆入口，**被占用的是一只空壳**；喇叭枚 `ui_icon_sound` 自 T-493 起代码侧**零消费者**（仅 harness / carrier 两处注册表在册）。

### 2. 四案与实测定因

| 案 | 内容 | 实测代价 | 判定 |
| --- | --- | --- | --- |
| **甲（采纳）** | 公告并入信封（消息中心）弹窗，⛔ 不占顶栏位 | 零改动 —— 信封容器 `overlayPlate()` 600×720 已在册，公告属内容层；顶栏四枚几何与热区一字不动 | ✅ 用户拍板 |
| 乙 | 喇叭枚彻底下线（删资产） | 实测确认它**确在微信产物内**（`cocos/build/wechatgame/assets/textures/config.json` 命中；拷贝件 **2955 B**、design 正本 9411 B 不进包）⇒ 收益仅 **≈2.9 KB**（主包余量 658.6 KB，非瓶颈）；将来做公告要重出图（0.18 元）+ 重导 `.meta`，且按 K-120 须「正本 + 拷贝件 + `.meta`」三处成对删 | ⛔ 不采 |
| 丙 | 顶栏扩第五枚（公告回岗） | **复算否决**：第五枚须落右列第三行 ⇒ 热区左缘 648 vs 橱窗框右缘 651（橱窗 544×871 @x107）相交 **3 px**，垂直方向第三行热区下缘（约自顶 380）与橱窗顶（约 264）相交 **116 px** ⇒ 压橱窗右上 **约 3×116 px**，且与「选关」入口热区相邻（误触面）；另需重出五档落位账 | ⛔ 实测否决 |
| 丁 | 维持挂账 | 债在三份文档长期挂红，且「⛔ 预留不实现」的顶栏位语义永远悬空 | ⛔ 不采 |

内容源同步侦察（决定「能裁到哪一层」）：`packages/framework/src/platform/platform.ts:90` 已有平台无关 HTTP GET（weapp 走 `wx.request`）；本地静态可走 `src/config/copy-tokens.ts`；**当前无后端**、微信后台未配 request 合法域名白名单 ⇒ 本批**只裁方向、不预写面板内容行**（K-035：上游未裁 ⇒ 预写 = 假绿）。

### 3. 裁定内容与约束（回写 ux-spec §8 **U19**）

**方向已裁**：公告 = 信封弹窗内的**一类内容**，⛔ 不另开二级弹窗、⛔ 不回岗顶栏、⛔ 不新增第二颗全局红点（全局唯一提示位仍是信封小圆点 `MENU_SIGNIN_DOT_R`，2026-10-22 裁）；`ui_icon_sound` **保留在册** = 将来「公告条目」图标的候选件。

**未定三事**（登 U19，归后续实装批）：① 内容源（本地文案表 vs 远端接口）；② 实装节点（上线前 vs 运营期）；③ 提示位口径（公告入信后「有未读」是否共用现有信封红点）。

### 4. 代码侧改动 = 零功能（两处注释订正 + 镜像）

| 文件 | 改动 |
| --- | --- |
| `games/beads/src/config/tuning/layout.ts::MENU_TOPBAR_X` | `[WXG-T-365]` 段重写：补登「493 暂替已卸」+「494 公告去向已裁」。**同时修 WXG-T-493 的一处漏订** —— 原注释仍写「图标暂用 `MENU_TEXTURES.iconSound`（喇叭）顶替 ⇒ `[待 UI 设计]`」，与已入库的真图标事实矛盾（本批如实披露） |
| `games/beads/src/config/tuning/menu.ts::iconSound` | JSDoc 由「去向仍 `[待产品]`」改「[WXG-T-494] 已裁 = 不入顶栏，保留作公告条目图标候选」 |
| `cocos/assets/scripts/game/config/tuning/{layout,menu}.ts` | 由 `pnpm run framework:sync` 产出（输出「写入 2 · 未变 173 · 删除 0」），⛔ 手写镜像 |

坐标 / 尺寸 / 热区 / 资源 id 值 **一字未动**（注释不入指令流 ⇒ 金样本与单测理论零扰动，收尾复跑取证）。

### 5. 文档落点（四份 + 本台账）

| 文档 | 改动 |
| --- | --- |
| `ux-spec.md` | 升 **v1.34** 五处：头注；§2 路由表「签到弹窗」→「消息中心（现 = 签到弹窗）」并登记容器职责；§3.8 债目公告笔闭账（旧句 `~~划线~~`，K-053）；§8 新增 **U19** 行；计数注开放项 **5 → 6**；文末「变更记录 · v1.34」 |
| `menu-showcase-asset-spec.md` | **B2** 行追加「[WXG-T-494] 去向已裁」：身份改登「公告条目图标候选」+ 丙案否决实测读数 |
| `menu-architecture.md` | §5.1b 未清债第 **②** 条闭账（并入信封、⛔ 不回岗顶栏，指向 ux-spec v1.34 / §8 U19）；①③④ 原样保留 |
| `menu-layout-implementation-spec.md` | **v3.13**：顶栏行资源列「去留 = `[待产品]`」划线改已裁；纯注记改口 ⇒ 对落位与尺寸**零影响** |

### 6. 红线自证与未清债

零 GDD §3 冻结常量 · 零新几何值 · 零新资产 · 零新 hex · 零热区改动 · 镜像只由 `framework:sync` 写 · 旧口径划线留档 · 无内容源 ⇒ 不预写面板行（K-035）。
**未清债（结转）**：① 公告**实装本体** = `[待实装]`，阻塞在 U19 三事；② 顶栏左右不对称（左列距屏边 24 / 右列 14 ⇒ 差 10 设计px）= 另单；③ 版本水印贴底 = B3 项未做；④ 坐标总图 v3.8 自认过期待重烤（`design/ai-workflows/menu-proto-coords.py`）；⑤ 顶栏观感与误触 = `[待真机]`。

### 7. 门禁读数

`check:tasks` **OK**（主表 53 行 / 详情 76 节，配对完整；另注行数观察哨 51 活跃行属结构性不可达，非本批债务）· `check:links` **OK** · `tsc --noEmit`（beads）**0 错** · 顶栏几何相关单测 `menu-layout-v35` + `menu-anchors` **25 通过 / 0 红**（证注释改动零扰动）· `check:cocos-mask` **STATUS: OK** · `check:size` 沿 T-493 读数 3437.4 KB / 117 文件（本批无产物变化，⛔ 不重复构建）。

### 8. 沉淀统计

本批 **未跑 `kb:sync`**（`knowledge/` 五件仍含并行会话 **WXG-T-434** 未提交在制品，K-137；沿 T-492/T-493 同口径登记）。候选 2 条待干净 kb 批入账：「产品悬案的裁定要给**实测代价表**而不是形容词 —— 面积相交、字节数、重出图成本各算一遍，否决才有约束力」、「订正注释也是账：上一批改了事实、注释仍写旧状态 ⇒ 同类『事实与注释漂移』应在收尾 grep 旧常量名一并扫」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-495

### 1. 触发与裁定

用户确认前提（公告是否必须后端）后下令：「首版不做强运营，用公告跟着版本走（版本说明、维护通知）即可，可以按照这个思路实现配置」。⇒ U19 ①（内容源）闭账 = **本地随包文案表**；② 面板实装节点与 ③ 提示位口径仍开放。领号 495（核实仅头注「下一可用号」在册，无表行、无入库提交引用）。

### 2. 落码（零 UI，只落配置层）

| 文件 | 内容 |
| --- | --- |
| `games/beads/src/config/announcements.ts`（新增） | 类型 `AnnouncementEntry { id, date, title, body }` + `ANNOUNCEMENTS` **空表**。口径写进文件头：顺序即展示顺序（新在上）、发版时头部加一条；id 一经发布不改不删不复用（同 `arcs.ts` 稳定 id 判例）；date = 对外可见日 `YYYY-MM-DD`；body 单段纯文本、无换行/富文本/跳转引导 |
| `games/beads/tests/announcements.test.ts`（新增） | 四条不变式：id 全表唯一且非空 / date 合法 `YYYY-MM-DD`（含 2 月 30 日类越界日拒绝）/ title·body 非空 / 日期非递增（新在上）。表空时恒真，**新增条目即自动进入校验** |

### 3. 三个「为何」

- **为何空表**：当前没有已发生的对外发布事件，写日期就是造假（K-035 同精神）⇒ 首条在提审前由运营填，形状已写在文件头。
- **为何不进 `copy-tokens.ts`**：那份的文件头自定纪律 = 只收设计表已登记的界面文案、不得自加键；公告是**随版本变的运营内容**，不同源不同生命周期。
- **为何不预建远端**：远端三档（云开发 / 静态 JSON / 自建接口）分别卡在 AppID 与备案域名（见 U19），且条目形状即远端返回形状 ⇒ 将来换源只换读取方，面板与本表零改。

### 4. 文档落点

`design/ux/ux-spec.md` 升 **v1.35** 五处：头注；§8 **U19** ① 改已裁（点明远端三档与「当前未就绪」）、未定三事 → 两事；同行「本文不拍板、也不预写面板行」改「不拍板面板与提示位」；计数注追加 v1.35 注（开放项仍 6）；文末「变更记录 · v1.35」。台账：`production/TASKS.md` 头注 495/496 + 主表 495 行；本节。

### 5. 门禁读数

`tests/announcements.test.ts` **4/4** · beads `tsc --noEmit` 0 错 · `check:tasks` / `check:links` 见收尾。零构建、零包体变化（`check:size` 沿 3437.4 KB）。

### 6. 红线自证与未清债

**零 UI、零几何、零新资产、零新毫秒值、零新 hex、零 §3 冻结常量**；未新增快照字段与热区；`copy-tokens` / `tuning` 两处纪律边界未破。
**未清债**：① **公告面板未实装**（U19 ②）—— 消息中心弹窗现已被 7 日签到占满，公告列表需设计侧先出版式；② **提示位口径**（U19 ③）—— 有未读公告是否共用信封那颗红点；③ 首条公告内容 = 提审前由运营写（含日期）；④ 顶栏左右不对称 10 设计px、B3 版本水印、坐标总图重烤 = 三笔旧账不变。

### 7. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条待干净 kb 批入账：「只要内容要“不发版就能改”，就必然需要代码之外的远端内容源；但“远端”不等于“自建后端”——云开发免域名与白名单，静态托管只需备案域名」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-496

### 1. 裁定

用户 2026-10-29：「先裁提示位（U19③，一行决定）：**不做任何提示**」。⇒ U19 ③ 闭账；U19 仅剩 ② 面板实装节点。

### 2. 回写落点

| 文件 | 改动 |
| --- | --- |
| `design/ux/ux-spec.md` | 升 **v1.36** 四处：头注；§8 **U19** ③ 改已裁、「未定两事」→「未定一事」；约束②追加「⛔ 为公告点亮现有信封点」、约束③追加「§提示纪律含『公告不提示』一句」；计数注追加 v1.36 注（开放项仍 6） |
| `src/config/tuning/menu.ts` | `iconSound` JSDoc 追加**归类澄清**（用户同批追问图标归类）：图形 = 扩音喇叭（megaphone，带两道声波），中文语境 = 公告/广播；⛔ 作音量开关；将来要音量类图标须另绘扬声器（同图两义 = 误读源）。镜像随 `framework:sync` |

### 3. 归类澄清的取证与结论（本批实质产出）

- **看图核实**（非按文件名猜）：`design/art/final/assets/menu/ui_icon_sound.png` 实际是**扩音喇叭 + 两道声波**，不是扬声器；中文游戏语境里读作「公告 / 广播 / 世界频道」。**故语义本身没歧义，歧义在文件名 id（`iconSound` 叫 sound）与它曾被借去当公告占位这段历史**。
- **音量开关不可复用本枚**：设置面板内音效开关现为**文字钮**（`settings-content.ts` 返回 `音效  开/关`），不依赖图标；若将来要图标，须另绘扬声器。
- **漏斗验证：真正的期待落差 = 信封**：信封图标承诺「消息」，实际内容只有七日签到 ⇒ 归 **U19 ②** 面板批解决（面板标题/分区）；公告并入信封后正好补齐这个隐喻。
- **其余三枚无歧义**：齿轮 = 设置、奖杯 = 好友榜、衣架 = 装扮馆；「本地榜」在选关页底排，与顶栏「好友榜」是**两个不同榜** ⇒ 属入口分散而非语义歧义（本批不动）。

### 4. 红线自证

**零代码行为改动**（仅注释）、**零提示位改动**（`MENU_SIGNIN_DOT_R` 与 `meta-menu.ts::drawTopbar` 一字未动、红点仍 `canClaim` 单驱）、零几何、零新资产、零新 hex、零毫秒值、`systems-index §3` 零改动。

### 5. 门禁读数

`check:tasks` / `check:links` / `tsc --noEmit`（beads）/ `framework:sync`（应仅写 1 件镜像）见收尾。

### 6. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条：「图标归类以**看图核实**为准，不以资源名/id 为准 —— 本例 `ui_icon_sound` 实为 megaphone（公告），长期被文件名误读为音量开关」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-497

### 1. 触发与三条裁定

用户 2026-10-29 三句口述：「版本信息放到设置里」「信封我想替换成专门做日历 / 礼盒 签到、每日奖励」「现在没有运营后台，暂时不需要这个入口」；版本位置经追问选 **「放到设置页面关于信息里」**，签到图标四案选 **甲 日历 + 对勾**，公告入口三案选 **甲 暂缓入口、保留配置**。

### 2. 签到图标（B10）

| 项 | 读数 |
| --- | --- |
| 出图 | 云 `qwen-image-3.0` · 1024² · seed 301 · **0.18 元**（提示词：正面台历 + 顶部两小圆环装订 + 页中粗对勾；米白历页 + 深棕描边 + 珊瑚红装订条 + 草绿对勾；纯白底、无投影无文字） |
| 切图 | 复用 `temp/gen-rank-trophy.py`：bbox **占宽 45% / 占高 50%**；不透明像素 **5382**；填充众数 **#FFF7E9** |
| 入库 | `design/art/final/assets/menu/ui_icon_calendar.png`（160²@2x）+ `_source-1024.png`；`cocos/assets/textures/ui_icon_calendar.png` 与正本同源 |
| `.meta` | 由 `pnpm run build:cocos`（18.5s，release 档，beads v1.0.8 → v1.0.9）资产导入生成；已实测进包（`build/wechatgame/assets/textures/config.json` 命中 `ui_icon_calendar`） |
| 接线 | 四处：`MENU_TEXTURES.iconCalendar` → `meta-menu::drawTopbar`（签到钮）→ `dev/harness/main.ts::MENU_FILE` → `beads-blit-carrier.ts::BITMAP_ASSETS`；信封 `iconMail` 转零消费者（保留作消息中心候选） |

### 3. 版本号迁设置页脚

- **删除**主菜单屏底版本行（`meta-menu` 末段）+ `meta-layout::versionY` 字段（无第二消费者）。
- **新增** `settings-content::drawSettingsAbout`：`关于 · {COPY_TOKENS.version_label}`，居中对齐、`palette.textDim`、`UI_FONT.label`（28px）、y = `plate.y + SETTINGS_GRID.footerFromBottom`（**30**）。
  避让实算：返回钮下缘 = 板底 +50，页脚字面上下缘 = 30±14 ⇒ 与返回钮净空 6px、距板底 16px；**不注册热区**。
- 结果：**全局仅一处版本号**（设置弹窗内），主菜单屏底净空带维持无文字。

### 4. 公告入口暂缓（U19②）

用户：「现在没有运营后台，暂时不需要这个入口」⇒ 面板实装 **暂缓**；`src/config/announcements.ts`（空表）与 `tests/announcements.test.ts` **保留不删**（零成本，将来重启直接用）；零 UI、零入口、零提示位。重启条件写进 ux-spec：有运营后台或有需发版的运营内容时，再定容器（原「并入信封」方向需随信封改日历一并重议）。

### 5. 文档落点

| 文档 | 改动 |
| --- | --- |
| `design/ux/ux-spec.md` | 升 **v1.37**：§2 `settings` 行增页脚「关于·版本」；`signin` 行改「签到弹窗（每日奖励）」+ 图标换日历 + 实装暂缓；§8 U19 ② 改「暂缓」+ 重启条件；计数注追加 v1.37；文末变更记录 |
| `design/art/specs/menu-showcase-asset-spec.md` | 新增 **B10**（日历全规格 + 四案裁定 + 删图读数）；**B2** 行补「信封也转零消费者」 |
| `design/art/specs/menu-layout-implementation-spec.md` | 资产表顶栏行：`settings/sound/mail` → `settings/rank/mail/skin/calendar`（`sound`/`mail` 零消费者） |
| `docs/architecture/ui-architecture-beads.md` | §12 视觉变更登记：顶栏签到钮 + 设置页脚（金样本四态影响） |
| `production/TASKS.md` / 本台账 | 头注 497/498 + 主表行 + 本节 |

### 6. 红线自证与未清债

**零 §3 冻结常量**、零新毫秒值、顶栏 2×2 坐标/热区/Ø80 **一字未动**；新增仅 1 枚切图 + 1 个资源 id + 1 个页脚常量（`footerFromBottom`）+ 1 个文本页脚。`.meta` 为构建产物（L1 合规）；镜像只由 `framework:sync` 写（写入 5 件）。旧口径划线留档（K-053）。
**未清债**：① 公告面板（U19②）**暂缓**；② 首条公告内容待提审前填；③ 顶栏左右不对称 10 设计px；④ 坐标总图重烤；⑤ 顶栏观感与误触 `[待真机]`。

### 7. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条：「换入口图标前先看图：`iconMail`/`iconSound` 这类按旧语义命名的资源，实际图形可能是另一回事；命名与形状对不上时，以图为准并在注释里钉死两种语义」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-498

### 1. 裁定与几何定因

用户 2026-10-29 选「1 = 顶栏左右对称」。**左列外移 10**（`settings` / `rank` 24 → **14**），右列 648 不动 ⇒ 两侧热区距屏边 **14**、视觉圆（Ø80）距屏边 **18**，差额归零。

**为何不动右列**（关键约束）：右列视觉左缘 `648 + 4 = 652`，橱窗框右缘 `107 + 544 = 651` ⇒ 仅 **1px** 净空；内移 10 会让视觉圆压住柜体右上角。左列外移反而把左侧视觉右缘从 **108**（与橱窗左缘 107 重 1px）退到 **98**（净空 9px）⇒ **两侧均改善**。

`space_screen_edge = 24`（`tokens.md §4`）只约束**版面内容带**（招牌 / 橱窗，`W_avail = 750−2×24`）；顶栏圆钮属**浮层控件**，不参与该带 —— 右列自 2026-10-13 即按 14 排（当时为避免两热区纵向贴边误触）。

### 2. 落码与测试

| 文件 | 改动 |
| --- | --- |
| `src/config/tuning/layout.ts` | `MENU_TOPBAR_X = { settings: 14, rank: 14, mail: 648, skins: 648 }` + 注释重写（对称口径 / 右列不可内移 / 24 只约束内容带） |
| `tests/menu-anchors.test.ts` | `rankBox.x` 24 → **14**（顶栏位硬编码断言） |
| `tests/beads-shell.test.ts` | 顶栏中心 x 硬编码 `[68,692,692]` → **`[58,692,692]`**、同列过滤 `x−68` → **`x−58`**（含注释同步） |
| `tests/menu-layout-v35.test.ts` | 仅注释改口（断言为守恒式，不变即过） |
| Cocos 镜像 | `framework:sync` 产出（`game/config/tuning/layout.ts`） |

零尺寸改动：热区仍 88²（`TOUCH_MIN`）、视觉仍 80（`MENU_TOPBAR_VISUAL_D`）、行距仍 88（`MENU_TOPBAR_ROW2_DY`）。

### 3. 文档落点

`menu-architecture.md` §5.1b 未清债 ③ 改闭账（K-053 划线留档）；`menu-layout-implementation-spec.md` 顶栏行 x 值与口径同步；`ui-architecture-beads.md` §12 新登视觉变更；台账 498 行 + 本节。

### 4. 红线自证与未清债

零 §3 冻结常量、零新毫秒值、零新资产；热区大小与视觉直径一字未动；只改两个 x 值与三处硬编码断言。
**未清债**：① 公告面板（U19②）暂缓；② 首条公告内容待提审前填；③ 坐标总图重烤；④ 顶栏观感与误触 `[待真机]`；⑤ 左列 x=14 若在真机上被圆角/手势区干扰，需回看（已登 `[待真机]`）。

### 5. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条：「对称需求先核另一侧的硬约束：本例右侧被橱窗 1px 卡死，只能把左侧外移；而外移后的左列反而离橱窗更远 → 对称与净空同时改善」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-499

### 1. 触发

用户 2026-10-29 选「1 + 看调整后的坐标图」⇒ 重烤坐标总图，把 T-497（签到日历 / 版本号进设置页脚）与 T-498（左列 14 对称）反映到图上。

### 2. 脚本改动（`design/ai-workflows/menu-proto-coords.py`，零运行时）

| 项 | 旧（v3.8 三钮时代） | 新（现势） |
| --- | --- | --- |
| 顶栏坐标 | `TOPBAR_X = (24, 560, 648)` | `TOPBAR_ITEMS` = **(14, 0, settings) / (14, 88, rank) / (648, 0, calendar) / (648, 88, skin)**；`TOPBAR_ROW_DY = 88` |
| 图标 | settings / sound / mail | settings / rank / **calendar** / skin（信封退役） |
| 绘制 | 单行三钮 | 2×2 四钮（行2 y + 88） |
| 标注 | 画布内一行「x24/560/648」压资源条 | 挤入右侧规范栏：「顶栏 2×2：x 左 14 / 右 648，行距 88；热区 88 / 视觉 80」 |
| 标题 | 布局规范 v3.8 | **v3.13**；图末「本次改图」改为四钮 2×2 / 日历 / 版本号进设置三条 |

### 3. 输出（10 件，均重烤）

- `design/art/final/coordinates/`：`menu-master-coords.png`（2160×2668）+ `menu-coords-{se375,android360,iphonex375,island393,max440}.png`
- `design/art/final/prototypes/`：`proto-v3-{pushing,locked,done,swipe}-750x1334-at2x.png`

### 4. 目检

- 主图：顶栏 2×2 四钮位置正确（左 14 / 右 648）、右上为日历、右下为衣架；规范栏读数完整不截断；画布内不再有压资源条的标注。
- SE 档：同样四钮落位正确，缩放与标注未破。

### 5. 红线自证

**零运行时改动**（脚本只出标注图，不入包、不接线）；零 §3 冻结常量、零资产新增；真源仍 = `tuning/layout.ts`（图上已印「本图只标注，不驱动运行时」）。

### 6. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条：「坐标标注图要与代码同源更新：脚本里硬编码的坐标会随裁定过期，重烤前先 grep 一遍旧坐标值（本例 24/560/648 已停用两个月）」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-500

### 1. 触发

用户 2026-10-29 选「1 = 二级页坐标图重烤」。`levelselect-coords-750x1334-at2x.png` 停在 **2026-10-18**，而选关页已在 10-20 改整页（ADR-0032 D5）、10-23 加判星对照行、10-28 加图鉴/本地榜入口 ⇒ 图与实装三处对不上。

### 2. 旧形态 → 新形态

| 项 | 旧（10-18 弹框） | 新（现势整页） |
| --- | --- | --- |
| 底 | 主菜单底图 + 50% 黑遮罩 + 600×720 纸面板 | **整页不透明底**（无遮罩、无面板） |
| 格 | 120 / 间距 22（3×3 弹框内） | **170 / 间距 30**（x 90/290/490，行带 [652,822]/[452,622]/[252,422]） |
| 空带 | 无（只有标题 + 大关名示意） | **三行**：章名 972 / 累计星 928 / 判星对照 884 |
| 底排 | 返回 240 @(255,357) 一枚 | **三枚**：图鉴 207 @24 · 返回 240 居中 · 本地榜 207 @519，同 y=116 |
| 状态 | 锁格 / 空槽分形（虚线） | **锁格与越界合形**（Q15 已落码：灰褪 + 锁 + 无星） |
| 标注 | 逐格两行读数（互压） | 网格参数 + 列/行刻度（x90/290/490、y822/652/452/252）+ 单格拆解 |

### 3. 产出与清理

- 重烤 `coordinates/levelselect-coords-750x1334-at2x.png`（2300×2668）与 `prototypes/levelselect-v1-page-750x1334-at2x.png`（1500×2668）
- **改名**：`levelselect-v1-popup-*` → `levelselect-v1-page-*`（旧名已不成立）；旧 popup 件删除
- `art/final/README.md` 选关节同步：几何真源指向 `level-select-page-layout.md` v0.6 §2 + `LEVELS_*`，并写清判星行/锁格合形/底排三钮

### 4. 目检

主图已看：四角坐标与刻度可读、九个格状态区分清楚（2★ / 0★ 当前 / 锁×6 / BOSS）、底排三钮位置正确、右侧规范栏不截断；特殊符号（→）均正常显示。

### 5. 红线自证

**零运行时改动**（脚本只出标注图）；零 §3 常量、零资产新增（仅删一张旧草稿图）；真源仍 = `tuning/menu.ts` + `meta-layout.ts`。

### 6. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条：「标注脚本要把『形态变更』当重大版本：选关从弹框改整页时，旧脚本没改，图在两版之后仍在发 ⇒ 重烤前先对一遍脚本开头的形态描述」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-501

### 1. 裁定

用户 2026-10-29：「好友榜在首页已经有了，本地榜应该没啥用」+「图鉴现在设计是主界面的 boss 图，没有给每个小关做设计；是否真的有这个需求对每个小关都做记录并陈列？」⇒ 两个入口**下线**；未来图鉴若重启，按**大关级作品图**重新设计，不做每小关陈列。

### 2. 改动面

| 文件 | 改动 |
| --- | --- |
| `view/meta-layout.ts` | `levelsLayout` 删两枚侧钮（原 24 边距 + 24 间隔 = 207 宽）⇒ 底排只剩居中返回；`LAYOUT_BUILDERS` 删两行 |
| `view/meta-types.ts` | `MetaOverlay` 减 2 值；`MetaAction` 减 2 值；删 `albumLevels` 字段 |
| `view/meta-view.ts` | 删两页 import / `META_PAGES` 两行 / `BASE_PAGE` 两行 |
| `view/meta-pages-content.ts` | 删 `drawAlbumContent` + `drawLocalRankContent` 与全部 ALBUM_*/RANK_* 常量（423 → 160 行，只剩名片） |
| `view/meta-widgets.ts` | 删两个 label case |
| `game/beads-shell.ts` | 删两个 case；删 `albumLevels` 默认值与赋值 |
| `ui/phase-route-binder.ts` | `MenuOverlay` 与路由表各减两项 |
| `config/copy-tokens.ts` | 删 `btn_album_label` / `btn_local_rank_label` |
| `design/.../tokens.md` | 四行（两标题 + 两钮标）划线留档（K-053） |
| 测试 | `meta-album-thumb.test.ts` 删除；`meta-menu-wall` / `arc-level-select-page` / `bead-style-settings` 三处断言改写 |

### 3. 门禁与金样本

- `tsc --noEmit` 0 错；全量 **117 文件 / 1415 通过**（删掉的 `meta-album-thumb` 含 2 例）
- 金样本 `level-select` / `level-select-mid` **各 −4**（两枚纸钮的 rect + text）；其余九态不变

### 4. 未做 / 后续

- 图鉴若重启：按**大关级作品图**（复用 boss/大关图）+ 通关印章重新设计，不再做每小关缩略图墙
- 选关形态（弹窗 vs 整页）仍待单独裁定（本批只摘入口，不动版面形态）

### 5. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条：「下线一个入口要连通『热区 + 行动 id + overlay 类型 + 路由表 + 绘制 + 令牌 + 测试 + 金样本』八处一起摘，漏一处就是死代码或类型假阳性」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-502

### 1. 裁定

用户 2026-10-29：「珠子样式可以在缩略图里面不展示，只是展示盘面即可」⇒ 缩略图的程序化腿**只画盘面纯色格**，不调珠子绘制。

### 2. 实现（单点改动）

`view/menu-signage.ts::drawLevelThumb` 程序化腿：

| 项 | 旧 | 新 |
| --- | --- | --- |
| 每块图元 | `drawFilledBead`（`facet-4` 口径 = 7 命令/颗） | **1 条 `rect`**（边长 `pitch − BEAD_GAP`） |
| 取色 | 珠子端点 mix 派生 | **`beadColorOf(inks, colorIdx)`**（墨集基色，C3 单源） |
| alpha | <0.5 硬切（无逐珠 alpha） | `rect` 直接带 alpha（转场可真淡） |

**不变**：5×5 主色聚合规则与缓存（`levelThumbCells`）、缩略区几何（`THUMB_AREA` / 顶内缩 / 星带）、墨源（`beadInksFor` / `beadFadedInksFor`）、位图臂（命中 = 恰 1 条 `blit`）。

### 3. 影响面

四处调用同步生效：选关 9 格（含置灰格）、主菜单 Boss 图位**回退腿**、通关画面书架。
命令数：缩略族 **1351 → ≤225**（5×5×9 上限，按空格位实际更少）。

### 4. 测试改写

| 文件 | 改动 |
| --- | --- |
| `menu-thumb-primitives.test.ts` | 渲染断言由「circle 对 / 7 命令」改为「一块一条 rect」；参照流改 `rect` + `beadColorOf` |
| `arc-wall-locked.test.ts` | 锁格 / 解锁格的缩略图元过滤由 polygon/circle 改为**缩略区内 rect** |
| `arc-level-select.test.ts` | `beadsIn` 改为统计缩略区内 rect |
| `meta-menu-wall.test.ts` | 缩略签名改 rect（格底 rect 用严格 `>` 排除）；零新 hex 门补入**墨集基色**（同源，非新色） |

### 5. 金样本（6 态）

`main-menu`（Boss 回退）、`settings` / `signin` / `level-select-mid`（菜单垫底）、`level-select`（9 格）、`finish`（通关书架）——total 与 sha 全变；在可复现锚重取，两遍逐态全等。

### 6. 红线与沉淀

零新 hex（基色来自墨集）、零 §3 常量、零资产、零布局改动；规格回写 `menu-wall-signage-spec §3.7 / §3.8 / §3.8.1`（含「与硬约束①的关系」与已接受代价）。
**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条：「缩略图与盘面共享聚合表、不共享画法：想降图元数只换绘制腿，聚合/缓存/几何一行不动」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-503

### 1. 裁定

用户 2026-10-29：「选关页面看起来使用对话框也可以，做二级页面过重，而且二级页面不适合做底部按钮」⇒ 四案中选 **甲·回弹窗（格 120，信息两行）**。这项推翻了 ADR-0032 D5（用户 2026-10-20 裁的「整页」）。

### 2. 版面（现役 = 版式 Q）

| 项 | 值（750 设计 px，y 向上） |
|---|---|
| 板 | 600×720 @(75,307)；遮罩 α0.5 |
| 格 / 间距 | **120 / 22**（= `WALL_CELL` / `WALL_GAP`） |
| 网格 | 3×3；左缘 **173**、上沿 **861**；列 173/315/457；行下缘 741/599/457 |
| 缩略 | **84**（= `THUMB_AREA`） |
| 信息 | 章名 925（居中）+ 星进度 925（右对齐 x=635，同行）；判星对照 885 |
| 返回 | 240×88 @ x=255, y=**357**（板底 +50） |

### 3. 落码

- 路由：`levels` page → **modal**（并入 `_modals` 表；`UiRoot` 包容器，遮罩能压住底页位图腿）；`BASE_PAGE.levels = null`。
- 视图：`LEVELS_PAGE = panelPage(标题, α0.5, drawLevelsContent)`；内容块只画两行文字 + 格墙；返回由 `panelPage` 通用钮循环铺。
- 过渡：`pageFade`（200ms/150ms）保留，改为在 `buildMetaModal` 内只对弹窗命令施加（菜单底页不淡）。
- 常量：整页专用 `LEVELS_CELL/GAP/GRID_*/THUMB_AREA/BACK_*/NAV_*` **全删**；弹窗度量集中在 `levelsPanelMetrics()` 单源。

### 4. 为何两行（实算）

720 板内：返回 88 + 净空 12 + 网格 404 ⇒ 网格上沿 861；标题基线 977（字面 957..997）。章名 30 字面在 925（907..943），判星 28 在 885（871..899）⇒ 与网格顶 861 留 10px。若保留三行（章名/进度/判星），必需再压 40px ⇒ 要么压字号、要么压行距，两者都破坏 28px 无障碍地板。故 **章名与星进度同行**。

### 5. 测试与金样本

- 测试改写：`arc-level-select-page`（整页 → 弹窗断言）、`arc-wall-locked` / `arc-cell-pressed` / `ui-warm-paper`（帧改弹窗腿）、`meta-menu-wall`（签名按 5×5 块尺寸过滤底页回退缩略）、`ui-golden`（容器数 0→1）、`phase-route-binder`（kind page→modal）。
- 全量 **117 文件 / 1410 通过**（2 跳过）；仅 `level-select` / `level-select-mid` 金样本待重取。

### 6. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条：「弹窗化后底页会被一起画：按坐标/尺寸扫描命令的测试会把底页图元误收进来，必须用『块尺寸 + 范围』双条件区分同屏两层」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-504

### 1. 触发

T-503 改回弹窗后，选关坐标图仍是 T-500 的整页版（README 已标「待重烤」）⇒ 本批把 `levelselect-proto-coords.py` 改回弹窗并重出两张图。

### 2. 脚本改动

| 项 | 旧（T-500 整页） | 新（弹窗 Q） |
| --- | --- | --- |
| 底 | 纯色页底，无遮罩/无板 | **主菜单原图 + 50% 遮罩 + 600×720 纸板** |
| 格 / 网格 | 170 / 30 @90,822 | **120 / 22 @173,861** |
| 缩略 | 134 | **84** |
| 信息 | 三行（972/928/884） | **两行**（章名+星进度同行 925 / 判星 885） |
| 返回 | 240×88 @y116 + 图鉴/本地榜两侧 | **240×88 @357（板内居中）** |
| 缩略画法 | 圆珠示意 | **盘面方块**（对齐 T-502 平涂化） |

### 3. 产出

- 重出 `coordinates/levelselect-coords-750x1334-at2x.png`（2300×2668）与 `prototypes/levelselect-v1-popup-750x1334-at2x.png`（1500×2668）
- 删除旧 `prototypes/levelselect-v1-page-750x1334-at2x.png`；`art/final/README.md` 改回弹窗口径

### 4. 目检

主图：板/网格/两行/返回位置正确，刻度 x173/315/457、y861/719/577 可读，规范栏不截断，缩略为盘面方块。

### 5. 红线与沉淀

**零运行时改动**（脚本只出标注图）；零 §3 常量、零资产新增。
**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条：「标注脚本要跟着**形态改判**换底：弹窗重烤必须把底图从纯色页底换回『主菜单 + 遮罩 + 板』，否则图上的层级关系是错的」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-505

### 1. 触发

用户选「1 = 发布前置清单」。目标 = 把 AppID / 上传密钥 / 备案域名 / 云开发四件事变成可勾选清单，解除真机验证与远端公告两大阻塞。

### 2. 关键事实订正（先查旧账）

| 项 | 旧口头假设 | 实测事实（2026-10-19 发布清单） |
|---|---|---|
| AppID | 缺 | ✅ **已有** `wx8cf9f756e5390749`；`cli preview` 已跑通（包 3.1 MB） |
| 上传密钥 | 缺 | ❌ 确实未配置；但**只影响 `cli upload`**，preview 不需要 |
| 备案域名 | 缺 | ❌ 无；**首版不需要**（公告本地随包，无任何 `wx.request` 调用方） |
| 云开发 | 缺 | ❌ 未开通；**首版不需要**，仅「公告要能不发版就改」时可选 |

⇒ 首版发布**只差上传密钥 + IP 白名单**；域名/云开发是「公告远端」的可选支线，二选一（云开发门槛更低）。

### 3. 产出

`production/release/beads/launch-prerequisites.md`：

- §0 四项结论表（现状 / 首版是否必需 / 解锁什么 / 谁做）
- §1 逐项说明（含官方入口、密钥不入仓纪律、域名硬要求、云开发免域名机制）
- §2 可勾选清单（8 条，含可选支线）
- §3 依赖顺序图（上传密钥 → 开发版 → 体验版/真机 → 提审）

并从 `release-checklist.md §1.3` 顶部链入，避免两份清单各说各话。

### 4. 未做（属 USER 平台操作）

- 后台生成上传密钥、配 IP 白名单（AI 不可代办，且不得记录密钥）
- 开通云开发 / 买域名走备案（可选项，待用户拍板）
- 主体 / 类目 / 版号 / 软著核实（官方口径，见 `wechat-submission.md`）

### 5. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行会话 WXG-T-434 在制品，K-137）。候选 1 条：「发布阻塞要先对旧账再列清单：『缺 AppID』可能早已解决，真正的阻塞往往只剩一个上传密钥」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-506

### 1. 触发

用户选「1 = 闭合版本号漂移」。发布清单 §1.1 把「版本号三处一致」列为 NO-GO 项：`package.json`、游戏内 `version_label`、微信后台版本号。

### 2. 实测（漂移在哪）

| 处 | 收口前 | 收口后 |
|---|---|---|
| `games/beads/package.json` | 仓内 **1.0.3**；工作树 **1.0.9**（六次 release 构建的递增一直未提交） | **1.0.9 已入库** |
| 游戏内 `version_label`（源码基线） | `v1.0.0 · 演示版`（harness/金样本用的基线，按裁定保留） | 不变（分环境，符合预期） |
| 发布产物 `version_label` | `cocos/build/wechatgame/assets/main/index.js` = **v1.0.9**，全文「演示版」**0 次** | 同左（已复证） |
| 微信后台版本号 | 未设置（首次 `cli upload` 时填） | 仍属上传动作（不阻塞仓内） |

**结论**：打号腿（`build-cocos.mjs::bumpAndStampVersion`）与剥后缀腿（`version-label.mjs::stampReleaseLabel`）在现产物上**同时成立**；真正的漂移只是 `package.json` 的递增没入库。

### 3. 为何不重跑一次 release 构建

工作树存在并行会话在制品（`beads-game.ts` / `board-tap-router.ts` / `powerups-v2.md` / `announcements.test.ts` / `knowledge/*`），此时重跑会把未完成的改动烘进产物。**本次只做「已发生构建的产物取证 + 版本真源入库」**；下一次干净 release 构建（上传前）会自然递增到 **1.0.10**，届时以那一次产物为准再核一次即可。

### 4. 文档同步

- `release-checklist.md` §1.1：现值 1.0.3 → **1.0.9**；待办② 销账（附产物路径与读数）；待办①（后台版本号）保留为上传时动作。
- 同文前置声明 #2：NO-GO 第②条改为**已收口**。
- 同文变更记录新增 **v1.7**。

### 5. 并行在制品披露

工作树另有并行会话改动（`games/beads/src/game/beads-game.ts`、`game/beads-game/board-tap-router.ts`、镜像两件、`design/gdd/powerups-v2.md`、`tests/announcements.test.ts`、`knowledge/*`）**未纳入本笔**（K-137 只披露不代填）。

### 6. 沉淀统计

**未跑 `kb:sync`**（同上，`knowledge/` 含并行在制品）。候选 1 条：「版本腿会自动递增 `package.json`，但构建者常忘了提交它 ⇒ 版本漂移的真正形态是『产物已新、真源仍旧』；收口动作 = 把构建后的 package.json 入库，而不是重跑构建」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-507

### 1. 触发

用户选「1 = 真机走查执行卡」。全量走查单 `device-walkthrough.md` 停留在 v1.7（2026-10-28 / 包 `v1.0.3`），不含 2026-10-29 这批 UI 改判（选关弹窗 / 顶栏对称 / 缩略平涂 / 设置页脚）。

### 2. 产出

`production/qa/beads/device/2026-10-29/execution-card.md`：

| 段 | 内容 |
|---|---|
| §0 三关前置 | 工作树干净 / 新包（1.0.10）/ 新扫码；现包 16:33 **早于 T-503** ⇒ 必须重建 |
| §2 三分钟冒烟 | 冷启动 / 开工扣心 / 开弹窗 / 返回 |
| §3 选关弹窗 | **D-82** 形态遮罩 · **D-83 屏幕层序（重点）** · D-84 网格 · D-85 84px 缩略可辨 · D-86 两行信息 · D-87 返回与点外 · D-88 转场与弱动效 |
| §4 顶栏四钮 | D-89 2×2 对称 · D-90 可点性/胶囊 · D-91 签到红点 |
| §5 设置页脚 | D-92 「关于 · 版本」唯一落点 |
| §6 回归 | D-93 旧档升级 · D-94 扣心/回菜单 · D-95 选关帧观感 |

### 3. 为什么单开一张卡

全量单 253 行、多数条目与本批无关；单开卡只装「这批改动可能碰坏的路径」，并把最容易漏的**真机屏幕层序**（遮罩能否压住菜单位图腿）单列为 D-83。二者关系 = 增量卡 + 全量单指针，不复制既有判定。

### 4. 前置现状（写卡时）

- 工作树有并行在制品 ⇒ 三关中的「干净」**未过**，此时构建会把半成品烘进包。
- 现产物 `assets/main/index.js` mtime 10-29 16:33 **早于 T-503**；必须重建后才可走查。
- 新包版本预期 **1.0.10**（构建时自动递增），产物不得带「演示版」。

### 5. 边界

**零真机读数**（本批只出卡）；判定与证据由执行人回填。定量性能仍回全量单 D-01/D-07，本卡只记观感。

### 6. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行在制品）。候选 1 条：「UI 改判批次要单开增量执行卡，并把『遮罩压不压得住位图腿』列为真机专项：这条只有真机容器层序能证，Node/harness 截图看不出来」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。

---

## WXG-T-508

### 1. 触发

用户令「把新包做出来」（执行卡第一关）。目标 = 产出含 10-29 全部 UI 改判的 release 包 + 新扫码图。

### 2. 并行在制品的处理

工作树有并行批次未提交改动。构建前先做**内容判定**：

```
git diff -w -- games/beads/src games/beads/cocos/assets/scripts/game
# 输出为空
```

⇒ 运行时改动为**纯格式**（缩进/空格），内容与 HEAD 等价；其余未提交项为 `powerups-v2.md` / `announcements.test.ts` / `knowledge/*` / `check-frozen-values.mjs` 等，**不进包**。因此无需另开 worktree，直接在当前树构建。

### 3. 实跑读数

| 步 | 结果 |
|---|---|
| `pnpm run verify` | **PASS 23 / WARN 0 / SKIP 0 / FAIL 0** |
| `framework:sync` | 写入 0 / 未变 176（镜像已同步） |
| `build:cocos`（release） | ✅ 16.2s；版本腿 `v1.0.9 → v1.0.10` |
| `check:size` | 主包 **3440.7 KB / 120 文件**；距 4096 KB 红线 **655.3 KB** |
| 产物 `version_label` | **v1.0.10**；全包「演示版」**0 次** |
| 新界面入包 | `选关` ×1、`关于 · ` ×1（minify 后字符串仍在） |
| `cli preview` | ✅ TOTAL **3,481,429 B**；扫码图 `temp/wxg-t508-preview-qr.png`（本机，不入库） |

### 4. 文档同步

- 执行卡 §0 四关全部打勾；新增「构建记录（21:03）」；变更记录 v1.2。
- `release-checklist` §1.1 现值 → 1.0.10；变更记录 v1.8 登记新包体与新扫码。

### 5. 真机待办

扫码图指向 **1.0.10**（含选关弹窗）；执行卡 D-82~D-95 待 USER 真机执行与回填。**本批零真机读数**。

### 6. 沉淀统计

**未跑 `kb:sync`**（`knowledge/` 仍含并行在制品）。候选 1 条：「并行会话下要构建，先跑 `git diff -w -- <运行目录>`：输出为空就证明未提交改动是纯格式，可直接构建；非空则需隔离，⛔ 不能硬构」。统计 = 新增 0 / 修改 0 / 激活 0 / 归档 0（本批）。
