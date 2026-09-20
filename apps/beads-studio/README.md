# beads-studio · 照片转拼豆在线生成器（WXG-T-179 续作）

上传照片 → 量化到拼豆色板 → 配色平衡 → 交换法错位 → **关卡草案 JSON**（预览 + 归类存储 + 小游戏在线导入）。

- **生成核心**：复用 `tools/scripts/beads-gen.mjs`（子进程 `--in-raw --no-png` 免浏览器路径，服务器无需 playwright/chromium）。
- **零第三方依赖**：服务端纯 `node:http`；前端单页 `public/index.html`（canvas 预览，本地解像不上传原图文件）。
- **定位（诚实）**：调试/出关工具，无鉴权、单实例；产物是**关卡数据草案**，能否入关仍由 `levels.ts` BOOT 校验决定。

## 本地跑

```bash
node apps/beads-studio/server.mjs          # → http://localhost:8787
```

## API

| 方法/路径 | 说明 |
|---|---|
| `POST /api/generate?cols=&rows=&board=&shape=&palette=&colors=&colorsmode=&swaps=&smooth=&noframe=` | body = JSON `{w, h, data: base64(RGBA), thumb?: dataURL}`（≤2048²，图片由前端本地解像，**不上传原文件**；`thumb` 随结果存盘供「原图」视图回看）；返回 result.json |
| `GET /api/results` | 结果列表（按盘面分组、时间倒序）——**小游戏在线导入同源**；只回**轻投影**（元数据 + `hasThumb`，不含 pattern/缩略图，避免随条数膨胀），点条目时再取单条全量 |
| `GET /api/results/:id` | 单个 result.json |
| `GET /api/results/:id/level` | 直接回 levelDraft（小游戏字段最少化） |
| `GET /` | 静态页 |

存储：`apps/beads-studio/data/<board>/<id>/result.json`（运行时数据，已 gitignore）。

## 默认值 = 推荐值（前端预选，每项 label 已标注）

| 参数 | 推荐 | 为何 |
|---|---|---|
| 盘面档位 | **standard29（29×29）** | 5mm Midi 标准方盘（`systems-index §3.3` 上限 29/29）。⚠️ ADR-0018：**29×29 = 设计档**（可装配不可发布），要出可玩关卡选 14×14 / 18×18 |
| 色板 | 游戏 10 色 | 产物色值可直接入关（Artkal 真值需先接 ADR-0016 戊案） |
| 用色上限 | **8** | = `BEAD_COLOR_MAX`（超了就过不了 BOOT） |
| 交换错位 k | **8** | = `MISPLACED_PAIRS_MAX`（错位 16 颗）；**仅在“少量交换”模式下生效**，默认走全错位 |
| 众数滤波 | 1 | 去噪同时保住轮廓 |
| 选色模式 | 误差最小 | 实测保形优于频次优先 |
| 铺满整盘 | **勾选** | 不扣背景 ⇒ 整盘可填无缺漏（取消则四边框主色被当背景挖空） |

盘面形状只分两档：**长方形** / **非长方形**（选中后者再出圆/六边/心的轮廓子选）。
非长方形由 `beads-gen::shapeMask` 保证**形状内铺满无空洞**：不再默认内缩（旧 `inset=0.02` 会挖掉边缘一圈），
且改为“格的中心或任一角在形状内即保留”（旧口径只测格心 ⇒ 半格被判空，轮廓阶梯缺角）。
实测 29×29 圆形：形状内 705 格、空洞 0、形状外误铺 0。

## 错位密度：全错位（默认）vs 少量交换

用户反馈：“错位豆子基本很少，应该尽可能最大化、成片的错位豆”。根因不是算法错，而是**默认只用了 k 对交换**：
29×29 盘上 k=8 ⇒ 仅 16 颗错位（实测 348 可填格中占 **4.6%**），其余珠全部就位 ⇒ 看上去几乎没打乱。

| 模式 | 面板选项 | 初盘构造 | 实测错位颗数（29×29） | 关卡字段 |
|---|---|---|---|---|
| **全错位（默认）** | 「全错位」 | 按色排序 + 循环左移 maxFreq（`derange()`，Hall 条件由 `balance()` 保证） | **348/348 = 100%**（屏幕层实测 705/705） | `misplaced` 初盘（`swaps: []`） |
| 少量交换 | 「少量交换（k 对）」 | k 对异色互换 | 16/348 = 4.6% | `swaps` 4 元组 |

全错位不是新发明：**入库那 8 关用的就是 `misplaced` 全错位初盘**（引擎 v1.3 起支持，
`applyMisplacedToGrid` 见 misplaced 优先、`validateMisplacedGrid` 校轮廓匹配 + 每色守恒 + 错位≥1）。
因此它**不受 `MISPLACED_PAIRS_MAX=8` 约束**，也不受 `cycleProfile` 2-环校验约束。

> ⚠ 可玩性提示：密集全错位盘靠 **board 直填**（不吃托盘容量）才能周转（G-3 取证结论）；
> 真机手感待走查。

## 参数取值与经验值（实测，不是口头建议）

**“可入关”判据单一真源 = `server.mjs::importBlockers()`**，值域全部取自 `systems-index §3` 冻结常量：
盘面 6–29 × 5–29、用色 3–8、交换对数 1–8、**色板必须 = 游戏 10 色真源**。不满足则结果标红，且
`GET /api/results/:id/level` 直返 **422 + 原因** ⇒ 小游戏导入不会拿到一张“看起来成功”的盘。

> **为何色板要硬拦**：游戏不读 `paletteHex`，而是按**色号索引**取 `BEAD_PALETTE`。
> 所以 Artkal/程序化色板只要限色到 ≤8 就能**过 BOOT**，但导入后**图案不变、颜色全变**（实测：
> 预览 `#249E6B…` → 游戏画成 `#FDF6E9…`）。静默换色比报错难查，故在入口就拒。

| 旋钮 | 取值关系 / 经验值 |
|---|---|
| **k 与用色数无关** | 两者是独立轴：用色数 = 图案属性，k = 难度属性（初始盘 2k 颗错位）。实测 6×5 小盘 + 3 色 + k=8 仍能配对达标（`buildSwaps` 要求两格异色，平衡后总存在足够配对）；真配不满时 `der.ok=false` **非零退出** ⇒ 服务返 422，不静默出坏盘 |
| **众数滤波 `--smooth`** | 29×29 类照片（渐变+噪）实测：0 → 相邻率 0.891 / 色差 78.7；1 → 0.896 / 79.3（改判 9 格）；2 → 0.899 / 79.7（改判 13 格）；3 ≡ 2（已收敛）。**经验值：扁平剪影图 0–1；照片默认 1；背景很碎、要“整块同色”时才试 2**（代价：轮廓变糊、细线消失；1→2 的相邻率只 +0.003，性价比低）。去噪主力其实是 `--sample`（每格 8×8 块内众数投票，未进面板） |
| **选色模式** | `error` 误差最小·**保形**（默认）/ `freq` 频次优先·**保大块**；UI 选项文案已直接写“保形/保大块” |
| **用色上限** | 色板=10 时面板夹在 3–8（超 8 过不了 BOOT，<3 也不合法）；选 Artkal 后放开到 64（仅参考图） |

> 手工剪影关卡（`beads-mvp-patterns.mjs`，入库 8 关真源）**不走这套采样** ⇒ 滤波/选色模式对它们无意义。

## VPS 发布

### 路径 A：一键脚本（不需先配 CI，不需本机装 Docker）

镜像构建发生在 VPS 上，本机只做 rsync + ssh：

```bash
VPS=root@<你的IP> ./apps/beads-studio/deploy.sh              # 可选 KEY / PORT / DEST
```

前置：VPS 已装 Docker + compose 插件，部署用户可免 sudo 跑 docker。
脚本会 rsync 三个部署单元（`apps/beads-studio/` + `tools/scripts/beads-gen.mjs` + `games/beads/art/artkal-palette.json`）
到仓库根镜像布局（默认 `/opt/beads-studio`），然后远端 `docker compose up -d --build` + 健检。

### 路径 B：GitHub Actions 自动发布（**只在 develop → master 合入时**）

1. repo **Variables**：`BEADS_STUDIO_DEPLOY=true`（未配 ⇒ workflow 自动跳过）；国内 VPS 再加
   `BEADS_STUDIO_BASE_IMAGE`（= 上文路径 A 的镜像源）与可选 `BEADS_STUDIO_PORT`。
2. repo **Secrets**：`SSH_HOST` / `SSH_USER` / `SSH_KEY`（私钥全文）。
3. 发布时机：workflow **只挂 `master`**。把 `develop` 的 PR 合进 `master` 后，若本批 PR 改到
   `apps/beads-studio/**` 或 `tools/scripts/beads-gen.mjs` ⇒ 自动跑：rsync 两部署单元 →
   远端 `docker compose up -d --build` → 健检（context = 仓库根，compose 已按此配置）。
   `develop` 上的日常合入**不上线**；也可在 Actions 里 `Run workflow` 手动补发。
4. 想要「合完不自动上线、经人批准再发」：Settings → Environments → `production` → Required reviewers
   （作业已声明 `environment: production`，配了审阅人就生效；URL 会显示在部署记录里）。
5. 首次构建若报 `file not found`，先看 `Dockerfile.dockerignore` 的逐级放行。

### 本机验镜像（需本地 Docker）

```bash
docker compose -f apps/beads-studio/docker-compose.yml build   # 在仓根执行
PORT=8787 docker compose -f apps/beads-studio/docker-compose.yml up -d
curl -s localhost:8787/api/results
```

> **实跑状态（2026-09-20）**：镜像已在腾讯云 VPS（docker 29.1.3）上**真实构建 + 启容器成功**，进程内部回环健检 OK；
> 开发机本身未跑 `docker build`（Docker Desktop 在 agent 环境拉不起）。已依次过：`compose config` 语法 → Dockerfile COPY 源存在性
> → 容器目录布局下的服务端到端（含 artkal）→ `deploy.sh` stub 自测（bash 3.2）→ **VPS 实构建上线**。

服务端口 `8787`（`PORT` env 可改）；数据卷 `beads-studio-data` → `/app/data`。

## 国内 VPS 实战坑（已踩定）

1. **拉不到 Docker Hub**（`auth.docker.io` 超时）⇒ 不要改 `daemon.json` 重启 docker（同机其他容器会跟着 restart）；
   用构建参数换基础镜像（`Dockerfile` 的 `ARG BASE_IMAGE`）：
   ```bash
   VPS=root@<IP> BASE_IMAGE=public.ecr.aws/docker/library/node:20-alpine ./apps/beads-studio/deploy.sh
   ```
   实测可用源：`public.ecr.aws/docker/library/node`、`docker.1ms.run/library/node`、`hub.rat.dev/library/node`；
   不可用：`mirror.ccs.tencentyun.com`（非 VPC 内不可连）、`docker.1panel.live`（403）、`docker.m.daocloud.io`（unavailable）。
2. **安全组没放行 ⇒ 服务已起但外网连不上**（表现：容器内/宿主回环 curl 得 200，从外网超时）。
   腾讯云需在控制台开入站规则（**SSH 里做不到**）：
   - 轻量应用服务器：控制台 → 防火墙 → 添加规则 `TCP : 8787`
   - CVM：安全组 → 入站规则 → `TCP : 8787` 源 `0.0.0.0/0`
3. **不想开端口时用 SSH 隧道**（微信开发者工具能请求本机，跟开公网等效）：
   ```bash
   ssh -N -L 8787:127.0.0.1:8787 -i ~/.ssh/beads_studio_deploy root@<IP>
   # 前端 http://localhost:8787/ ｜ 小游戏参数 studio=http://127.0.0.1:8787
   ```
4. **本服务无鉴权**（定位：调试/出关工具）。一旦开了公网端口，任何人都能读 `/api/results` 与提交生成；
   不需要公网时请优先走第 3 条的隧道，或只对自身 IP 开放。

## 小游戏导入（WXG-T-179 Phase 4）

- 小游戏侧「调试导入入口」输入本服务地址（`http://<IP>:8787` 或域名），拉 `/api/results` 列表 → 选关 → 下载 level → 转换进局试玩。
- **域名约束**：微信正式环境 `wx.request` 需 **https + 合法域名**；开发/体验版可在项目设置勾「不校验合法域名」先用 `http + IP:8787` 调试。
- levelDraft（rowstrings pattern + swaps 4 元组）与 `levels-spec §2` 口径一致；`palette=10`（游戏 10 色）的产物色值合规可直接装配，`artkal` 需先接 ADR-0016 戊案。
