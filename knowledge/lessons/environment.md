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

- **[环境][K-090] 设备本地存储（`wx.USER_DATA_PATH` / IndexedDB）不是分发通道：开发机预热的缓存在玩家设备上恒为空**（来源 WXG-T-219 取证，2026-09-27）
  现象：beads 珠面纹理烘焙方案里有一条「beads-studio 导入时预热烘进 L2」，被当成「玩家首屏不必再付烘焙成本」的依据写进设计档；
  核对载体后发现 L2 = `wx.USER_DATA_PATH`（小游戏）/ IndexedDB（harness），两者都是**运行设备本地目录** ⇒
  开发者机器上烘出的字节**不会随包出去**，该裁定只兑现「设计预览一致」，对玩家首屏零收益。
  根因：把「我机器上已经有的缓存」与「玩家机器上会有的缓存」混为一谈。缓存层（L1/L2）的语义是**本机可丢弃的重算加速**，
  天然不参与分发；能到玩家手上的只有构建产物（主包 / 分包 / 远程资源）。
  规避：① 任何以「预热 / 预生成 / 提前算好」为收益的裁定，先问一句「**字节住在谁的磁盘上**」，
  住在开发机 = 分发问题（要文件进包或走远程），住在运行设备 = 缓存问题（要失效键与兜底）；② 两条路不要互相冒充：
  本例的正解是**预烘资产文件进包（brand 集主包 / 关卡色集分包）+ 运行时烘兜底**的三层读序，而不是保留一条到不了人的预热；
  ③ 写档时把「不触达玩家」的边界显式写进被作废的原文旁边（`~~划线~~` 留档），否则下一个读者会重复相信它。
  判例引用：`games/beads/design/proposals/bead-visual-style-spec.md §13.5`（L0 层与作废说明）、
  `docs/architecture/adr/ADR-0027-beads-prebaked-bitmap-skin-assets.md` §1；同族 K-064（本机全绿 ≠ 目标环境能跑）。
- **[环境][K-092] 走预构建产物的 dev 工具：改源码不会自动生效，参数表现为「静默不生效」而不是报错**（来源 WXG-T-235，2026-10-03）
  现象：给 harness 加了定点复现参数 `?zoom=N`（`dev/harness/main.ts` 解析后调游戏侧 debug setter），重跑 headless 截图取三档倍率 ⇒ **三档结果逐字节相同**（格距、板面位置、像素剖面完全一致）。第一反应是「参数无效 / 被 clamp 了」，真因是 harness 服务的是**预构建产物** `dist/dev/harness/main.js`，改 `.ts` 不会触发重编。
  根因：预构建边界**没有失效信号** —— 旧 bundle 照常运行，新加的 query 参数被解析但走进的是旧代码路径，于是失败表现为「参数被吞」，而不是「构建过期」。这类失败与「参数真的无效」在观测上**不可区分**，除非事先知道有预构建这一层。
  规避：① 改 dev 工具源码后**先重建再取图**（本仓 `pnpm run harness:build`），并**用一条 grep 确认新标识已进包**（`curl -s <url>/dist/…/main.js | grep -c '<新符号>'` ⇒ 期望 ≥ 1）——这一步比"重跑一遍看结果"可靠得多。② 批量取图时若**多组参数的结果完全一致**，第一嫌疑是构建/缓存，其次才是参数语义。③ 截图类测量开工前先留一张**基线截图**并记下其像素指纹，后续每轮都应能一眼看出差异；否则「结果没变」既可能是没修好，也可能是根本没跑到新代码。
  判例引用：`dev/harness/main.ts`（`?zoom=N` 解析，置于 `app.start()` 之后以免首帧用旧 zoom 闪一帧）、`tools/scripts/serve-harness.mjs`（`--build-only`）；同族 K-091（定位相位类问题必须能定点复现 ⇒ 参数本身就是前提）、K-001（构建/提交钩子的规则要经官方入口确认，别照报错文案猜）。
