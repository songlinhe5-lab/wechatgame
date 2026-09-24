# lessons · 沉淀正本（已按标签分片）

> **本文件不再存放条目正文**（WXG-T-111）。原单体已**逐字节**拆入 `knowledge/lessons/`；
> 分片同受 ctx B 门（8000 tok）约束，**不设豁免**。

| 行内标签 | 分片文件 |
|---|---|
| `工具链` | `knowledge/lessons/toolchain.md` |
| `流程` | `knowledge/lessons/process.md` |
| `判据` | `knowledge/lessons/criteria.md` |
| `测试` | `knowledge/lessons/testing.md` |
| `跨IDE` | `knowledge/lessons/cross-ide.md` |
| `环境` | `knowledge/lessons/environment.md` |
| `接入` | `knowledge/lessons/onboarding.md` |

- **引用口径**：一律写 **K-0NN**（可附任务号），**不写文件路径**；ID → 分片由
  `knowledge/INDEX.md` 活跃表的「分片」列机械解析。
- **编号**：K-0NN 命名空间**全局单一**（真源 = `ledger.json::nextId`）；分片只改正文落位，
  不改编号语义、不回收旧号。补号顺序 = 上表行序（`ACTIVE_FILES` 列表序）→ `patterns.md`。
- **归档**：各分片**共用单份**归档面 `knowledge/archive/lessons-archived.md`。
- **再膨胀处置**：某分片越阈 ⇒ 该标签内部按子标签再切，**不得**新增豁免（判例 WXG-T-041）。
