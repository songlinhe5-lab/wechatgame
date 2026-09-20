# lessons · `environment` 分片（标签 `环境`）

> 由 `knowledge/lessons.md`（WXG-T-111 按行内标签分片）逐字节搬运而来；本片条目**按 ID 升序**。
> 引用只写 **K-0NN**；口径正本（B 门不豁免 / 新标签 = 新片）见 `knowledge/INDEX.md` §1–§4。

## 环境

- **[环境][K-010] WorkBuddy 沙箱内 bash grep/链式命令会假阴性（空输出 + exit 1）**（来源 WXG-T-020 验收，2026-09-12）
  现象：bash 里 `grep` 明明有匹配却返回空输出，差点误判「成员交付未落盘」。
  根因：沙箱对管道/链式命令的执行怪象（本会话出现 ≥3 次）。
  规避：核验文件内容一律用专用 Grep/Read 工具；bash 只用于跑构建/测试/git。

- **[环境][K-065] 国内云 VPS 上 Docker 部署必踩的两道坎：镜像仓库不可达 + 云侧安全组（与主机防火墙是两层）**（来源 WXG-T-179 beads-studio 发布实测，2026-09-20）
  现象：① `docker compose build` 在 VPS 上卡在 `failed to fetch anonymous token: Get "https://auth.docker.io/token…": i/o timeout` —— 拉不到 Docker Hub；② 镜像建成、容器 `Started`、**VPS 回环 `curl 127.0.0.1:8787` 得 200**，但从外网（含本机与 VPS 自己的公网 IP）访问一律超时。
  根因：① 国内出站到 `*.docker.io` / `auth.docker.io` 被限；② 云厂商的**安全组 / 轻量防火墙在 hypervisor 层**，主机里 `ufw`/`iptables` 全绿也照样不通 —— 表现就是「服务像起来了但连不上」，极易被误判成容器或应用问题。
  规避：① **不要为了换镜像源去改 `/etc/docker/daemon.json` 并 restart docker** —— 同机其他容器会跟着重启（本次同机跑着数据库/队列容器）；把基础镜像做成**构建参数**（`ARG BASE_IMAGE` + compose `${VAR:-node:20-alpine}`），仓库默认值保持 Docker Hub 正名（CI Runner 可直连），只在 VPS 侧覆盖。实测可用源：`public.ecr.aws/docker/library/*`、`docker.1ms.run/library/*`、`hub.rat.dev/library/*`；不可用：`mirror.ccs.tencentyun.com`（仅 VPC 内）、`docker.1panel.live`（403）、`docker.m.daocloud.io`（unavailable）；探测要给足超时（默认 25s 会把可用源误判成不可用）。② 排查顺序固定为**容器端口 → 宿主监听 `0.0.0.0` → 主机防火墙 → 云安全组**，最后一条只能在云控制台开（列明路径：轻量「防火墙」/ CVM「安全组-入站规则」）；③ 安全组不想开时，**SSH 隧道 `ssh -N -L <本地端口>:127.0.0.1:<服务端口>` 等效可用**（浏览器与微信开发者工具请求本机即可）——比为了调试把端口长期对公网敞开更安全。
  判例引用：`apps/beads-studio/Dockerfile`（`ARG BASE_IMAGE`）、`apps/beads-studio/docker-compose.yml`、`apps/beads-studio/deploy.sh`、`apps/beads-studio/README.md`「国内 VPS 实战坑」章；同族 K-064（本机全绿 ≠ 目标环境能跑）。
