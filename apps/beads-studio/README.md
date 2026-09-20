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
| `POST /api/generate?cols=&rows=&w=&h=&board=&shape=&palette=&colors=&colorsmode=&swaps=&smooth=&noframe=` | body = RGBA 原始字节（前端 `getImageData().data`，≤2048²）；返回 result.json |
| `GET /api/results` | 结果列表（按盘面分组、时间倒序）——**小游戏在线导入同源** |
| `GET /api/results/:id` | 单个 result.json |
| `GET /api/results/:id/level` | 直接回 levelDraft（小游戏字段最少化） |
| `GET /` | 静态页 |

存储：`apps/beads-studio/data/<board>/<id>/result.json`（运行时数据，已 gitignore）。

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
