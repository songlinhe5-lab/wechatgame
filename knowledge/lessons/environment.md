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
- **[环境][K-096] 环境事实表记的是「快照日」不是「现状」，下游当永久事实引用会造出根本不存在的结构性阻塞**（来源 WXG-T-247，2026-10-05）
  现象：ADR-0030（Cocos 生产通道与 harness 同源绘制）据 `docs/engine-reference/cocos/VERSION.md` 2026-09-14 的环境表，把「微信开发者工具未安装 + 无 AppID」写成**结构性阻塞**（承 `ADR-0029 §0` 的推迟理由），并据此把真机腿 `[R]` 判为「不可跑，只能出桌面档」。用户回话要求「真机腿拿不到，具体说明下」后实测：`/Applications/wechatwebdevtools.app` **在**（CLI 在 `Contents/MacOS/cli`，support dir mtime 前一天 23:55）、AppID **在仓两处**（根 `project.config.json` + Cocos 构建档）、`build/wechatgame` 产物 mtime = **前一天 23:54**。⇒ 三条阻塞**全部不成立**，评估路线里一整段「因为拿不到真机所以如何如何」的前提是虚构的。
  根因：事实表标注的是**取证日期**，读者把它读成**当前状态**；而「装没装工具 / 有没有产物 / 有没有账号」恰恰是两周里会自然变的那类状态。跨会话、跨 IDE 的 ADR 与测量单只 grep 文档，不复核文档。
  规避：① 引用任何「环境事实表」下结论前，先跑一次**廉价复核**——本例三条 = `ls /Applications | grep -i wechat` / `grep -n appid project.config.json games/*/cocos/build/*/project.config.json` / `ls -ldT games/*/cocos/build/*`，合计 **< 1 秒**，远比写一段"受阻塞所以下一步如何"的论证便宜。② 事实表本身要把日期声明成**快照日**并附**复核命令**（本次已在 `VERSION.md` 补更正块，内含这三条）。③ 文档里凡「阻塞」必须是**带时间的观测**，不能是无时间的断言；否则作废它时无人知道从何时起已失效。④ 推论链上游的一条环境断言一旦被下游 ADR 反复引用，错误会**指数放大**（本例：VERSION → ADR-0029 §0 → ADR-0030 初稿三处），发现时要把**引用链上游**一并改，不能只改手里这份。
  判例引用：`docs/engine-reference/cocos/VERSION.md`（2026-10-05 复核更正块）、`docs/architecture/adr/ADR-0030-beads-cocos-production-blit-carrier.md` F-11；同族 K-064（本机全绿 ≠ 目标环境能跑）、K-092（预构建产物静默不生效——同样是"文档说的状态与实际跑的不同"）。

- **[环境][K-098] headless Chromium 取「真 GPU」计时读数的三个坑：默认是软件光栅、扩展枚举名不按文档惯例、帧间隔被 vsync 锁死**（来源 WXG-T-247 / ADR-0030 §5.0.1 三臂实测，2026-10-06）
  现象：① 页内 `WEBGL_debug_renderer_info` 读出 `ANGLE (Apple, SwiftShader…)` 之外的期望值拿不到，GPU 计时扩展 `EXT_disjoint_timer_query_webgl2` **直接查不到**（`timerQuery:false`），而页面照常渲染、其余读数全绿——看起来像「宿主不支持」，其实是默认走了软件光栅；② 加了 `--use-angle=metal` 后扩展拿到了，`beginQuery` 却报 `INVALID_ENUM 1280` / 后续 `INVALID_OPERATION 1282`，读数恒空、`gpu n=0`；③ 另一路降级 `gl.finish()` 包住的抽样计时**每条样本都读 ≈0 ms**，看起来「GPU 几乎不花时间」。
  根因：① headless 默认 SwiftShader（软件光栅，无硬件 timer query）；② Chromium 的该扩展对象上**没有** `TIME_RESULT_EXT`——实测原型只有 `[QUERY_COUNTER_BITS_EXT, TIME_ELAPSED_EXT, TIMESTAMP_EXT, GPU_DISJOINT_EXT, queryCounterEXT]`，`beginQuery` 的 target 必须是 `TIME_ELAPSED_EXT`；结果读取也不走扩展枚举，走 WebGL2 核心 `QUERY_RESULT_AVAILABLE(0x8867)` / `QUERY_RESULT(0x8866)`；③ `gl.finish()` 在真 GPU 宿主上因为提交与回收的时序错开而**系统性读空**，不是「GPU 快」，是**无判别力**（等价于没测）。
  规避：① 取证前先在页内打印 `renderer` 串与**扩展对象的 own keys**，把「后端是谁」和「扩展暴露了哪些枚举」当**首跑必打印项**，不要按 MDN/WebGL 文档惯例直接写枚举名；② 异步 query 的结果不可当帧取，必须 `endQuery` 后**逐 rAF 轮询 `AVAILABLE`** 并按队列序收，且轮询失败要**降级并显式标 `gpuMethod`**（`timer` / `finish` / `none`）——降级档不得与被测档混在同一列里；③ 「所有样本都 ≈0」或「所有样本都相同」先怀疑测量装置而不是被测物（同 K-092）；④ **帧间隔（frame p50）在浏览器宿主被 vsync 锁在 ≈16.7 ms，对载体对比零判别力**，只能用作「有没有跑起来」的心跳，⛔ 不得写进性能结论。
  判例引用：`games/beads/cocos/assets/scripts/spike/carrier-bench.ts`（`TQ_TARGET` / `_findGl` / `gpuMethod` 三态降级）、`tools/scripts/carrier-bench.mjs`（`--use-angle=metal` 启动参数、`--diag` 单发自检口）；同族 K-092（静默不生效）、K-089（守卫能不能红）。
