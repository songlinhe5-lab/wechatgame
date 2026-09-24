---
name: ax-runtime
description: Author and operate AX (google/ax) declarative agent workloads — Task / Workspace / Gateway / Model manifests, `ax apply/get/watch/ssh/suspend/resume` lifecycle, and egress allowlist hardening. Use when the user mentions AX, ax.io/v1alpha1, `ax apply`, atespace, Agent Substrate, or asks to run an agent workload in a sandboxed cluster rather than locally. Not for local-only automation and not for choosing an agent framework.
description_zh: 编写与操作 AX（google/ax）声明式 agent 负载：四类清单、CLI 生命周期命令、egress 白名单收紧。
metadata:
  author: 本仓库自撰（依据 google/ax 官方 README / DESIGN / docs 整理，非上游移植）
  upstream: https://github.com/google/ax
  doc-snapshot: "2026-09-24 @ main"
  license: Apache-2.0
---

# AX 运行时（ax.io/v1alpha1）

AX 是**声明式 agent 编排运行时**（Go，跑在 Kubernetes + Agent Substrate 之上），不是
agent skill 生态的一部分：上游仓库**没有 SKILL.md**。本文是把它的使用方式整理成的本地
skill，字段与命令一律取自上游 `README.md` / `DESIGN.md` / `docs/concepts.md` /
`docs/manifests.md`（快照 2026-09-24，`main`）。

> ⚠️ 上游自述仍在频繁改动核心规范，stable 之前**很可能引入破坏性变更**。本仓库无 Kubernetes
> 集群，**本文所有清单与命令均为文档整理稿、未在本机跑通**（整体视为未实测）；真集群上以
> `ax apply` 的实际校验结果为准。

## 何时用 / 何时不用

| 场景 | 走不走本 skill |
|---|---|
| 把不可信 agent 代码放进带 CPU/内存上限的沙箱跑 | ✅ 用 `Task` |
| 预先接好 Git 仓库 / MCP servers / skill 包，让 agent 开局即 warm | ✅ 用 `Workspace` |
| 把出网锁死到显式 host 白名单 | ✅ 用 `Gateway` |
| 集中管 LLM provider/model/密钥引用（轮换只改一处） | ✅ 用 `Model` |
| 本机 IDE 里跑脚本、纯本地自动化 | ❌ 不用；AX 需要集群，本地跑不起来 |
| 选 agent 框架 / 写 prompt | ❌ 不归本 skill |

## 前置（缺任一条都别往下写清单）

1. CLI：`go install github.com/google/ax/cmd/ax@latest`，二进制落在 `$(go env GOPATH)/bin`，需在 `PATH` 上。
2. 控制面：Kubernetes 集群 + `ko`（`brew install ko`）+ 集群可拉的容器镜像仓库 + 可达的
   Agent Substrate Control API（in-cluster 默认 `api.ate-system.svc.cluster.local:443`），
   然后 `make deploy AX_IMAGE_REPO=<your-registry>`（全部落在 `ax-system` 命名空间）。
3. 现状核对：`ax ctx` 看当前 kube context 与 ax 如何连控制面；`ax version`。

`ax` 跟随活跃 kube context（可与 `kubectx` 混用）；不切 context 就 `ax --context=<name> ...`。

## 四个原语（都在 `atespace` 里，默认 `default`）

| 原语 | 职责 | 关键事实 |
|---|---|---|
| `Task` | 最小隔离执行单元 | 声明 image / command / env / resources / `gateway` 引用 / `workspaces` 列表。每个 workspace 挂各自路径，**第一个即 `spec.command` 的工作目录**，路径必须唯一 |
| `Workspace` | 把文件系统与工具面铺好 | `git`（仓库→子目录）、`mcp`（registries + servers）、`skills`（registries + path）。绑定可带 `goal`（自然语言），首启由 runner 交给一个 agent 补齐环境（装工具链/依赖） |
| `Gateway` | 网络边界 | `listeners`（任务暴露的端口）+ `egress.allowlist`（沙箱可达的 host:port） |
| `Model` | 命名的模型配置 | `provider` / `model` / `parameters` / `secretKey`（指向 **Kubernetes Secret**）。AX 自身组件也读它 |

单元刻意做小：一个 Task 可以就是整个作业，也可以是 agent 拆解问题时派生的任务树的根；
每个节点拿同样的沙箱、同样的生命周期。

## 清单骨架

四份 kind 可写进同一个多文档 YAML（`ax apply -f` 支持文件或 stdin 多文档）。

```yaml
apiVersion: ax.io/v1alpha1
kind: Workspace
metadata: { name: my-service, atespace: default }
spec:
  git:
    - { name: origin, repo: "https://github.com/<org>/<repo>.git", branch: "main" }
  mcp:
    servers:
      - { name: git-tools, endpoint: "http://git-mcp.default.svc.cluster.local:8080" }
  skills:
    registries:
      - { provider: google, query: "skills.tags:nodejs" }
    path: "/.agents/skills"
---
apiVersion: ax.io/v1alpha1
kind: Gateway
metadata: { name: default-gateway, atespace: default }
spec:
  listeners:
    - { name: grpc, port: 8494, protocol: gRPC }
    - { name: http, port: 8080, protocol: HTTP }
  egress:
    allowlist:
      hosts:
        - { host: "*", port: 443 }      # 上游示例＝放行全部 443，生产必须收紧
---
apiVersion: ax.io/v1alpha1
kind: Model
metadata: { name: default-model, atespace: default }
spec:
  provider: google
  model: <model-id>
  secretKey: { name: gemini-api-secret, key: GEMINI_API_KEY }
  parameters: { temperature: 0.9 }
---
apiVersion: ax.io/v1alpha1
kind: Task
metadata: { name: task123, atespace: default }
spec:
  image: "ghcr.io/<org>/<agent-image>"
  command: ["python", "agent.py"]
  env:
    - { name: ENVIRONMENT, value: "production" }
  resources:
    requests: { cpu: "500m", memory: "1Gi" }
    limits: { cpu: "2", memory: "4Gi" }
  workspaces:
    - { name: my-service }                      # 挂 /workspace/my-service，且是工作目录
    - { name: team-tools, path: "/workspace/tools" }
  gateway: { name: default-gateway }
  debug: true                                   # 开 guest services，`ax ssh` 才可用；默认关
```

密钥一律走 Secret 引用，**绝不写进清单**：

```bash
kubectl create secret generic gemini-api-secret --from-literal=GEMINI_API_KEY="<你的 key>"
```

## 生命周期与命令

`status.phase` 是一词摘要（`Running` / `Suspended` / `Failed` / `Terminating` …），细节看
conditions：

| Condition | 为 True 表示 |
|---|---|
| `WorkspaceReady` | 所有 workspace 铺设完成（之后保持 True） |
| `GatewayReady` | gateway 的网络策略已应用到沙箱 |
| `Ready` | 任务在跑且 `WorkspaceReady` 为 True — **要等的就是它** |

挂起把 `Ready` 置 False、reason `TaskSuspended`；恢复置回。删除先进 `Terminating`（controller
拆沙箱），记录随后整体移除，`ax delete` 会阻塞到完成。

```bash
ax apply -f task.yaml            # 应用（多文档 YAML / 文件 / stdin）
ax get tasks                     # 列表；-a <atespace> 换作用域
ax get task task123              # 完整 spec + 实时 status（YAML）
ax describe task task123         # 人读详情
ax watch task task123            # 实时串流 phase / condition 变化
ax ssh task123                   # 交互 shell（需 spec.debug: true）
ax ssh task123 -- ls -la /workspace
ax suspend task task123          # 检查点并暂停
ax resume task task123           # 原地续跑
ax delete task task123
ax get gateways|workspaces|models   # 同套动词 describe / delete 通用
ax tunnel list                   # 后台隧道，状态在 ~/.ax/tunnels
```

全局旗标：`-a/--atespace`（默认 `default`）、`-n/--namespace`（默认 `ax-system`）、
`--context`、`--server`（绕过自动发现，或走 `$AX_SERVER`）。

## 交付纪律（本仓约定）

- 只产清单与命令序列，**不代跑** `make deploy`、不建 Secret、不改集群——需要用户明确授权与环境。
- `egress.allowlist` 里的 `host: "*"` 是上游示例的偷懒写法：交付时按「只放 LLM provider 与 Git host」
  收紧，并写明被裁掉的 host 列表。
- 上游未稳定：字段名有疑问时改读 `docs/manifests.md` 与 `examples/task.yaml`，不要凭本文臆造字段。
- 端到端生命周期演示见上游 `demo.sh`（apply → 等就绪 → `ax ssh` 跑命令 → suspend）。

## 出处

- 上游仓库：<https://github.com/google/ax>（Apache-2.0，`agentexecutor.io`）
- 事实来源：`README.md`（安装 / CLI / 全局旗标）、`docs/concepts.md`（四原语与 condition 语义）、
  `docs/manifests.md`（清单字段）、`DESIGN.md`（Redis + Streams 架构与 gRPC API）
- 本 skill 为**本仓库自撰整理稿**，非上游发布物；上游若改版，以官方文档为准并同步本文件。
