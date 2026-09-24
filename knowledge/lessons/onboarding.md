# lessons · `onboarding` 分片（标签 `接入`）

> 新建一片的缘由：WXG-T-208 接外部 skill 批次时 `process.md` 越 ctx B 门（8919 tok），
> 按 `knowledge/INDEX.md` §4「再越阈 ⇒ 该标签内部按子标签再切、不得新增豁免」切出本标签。
> 收录范围：**外部能力接入本仓**（skill / 插件 / MCP / CLI 工具）的落位、验源与门禁口径。
> 本片条目**按 ID 升序**；引用只写 **K-0NN**，路径由 `knowledge/INDEX.md` §6 活跃表「分片」列机械解析。

## 接入

- **[接入][K-073] 外部 skill 批次接入：上游正文零改写 + 本地差异集中登记到 INDEX 批次节**（来源 WXG-T-208，2026-09-24）
  现象：四仓库外部 skill 入 `my-skills/` 时，惯性是「装完顺手改上游正文」以适配本仓（沙盒路径、宿主名、与同域既有 skill 的触发词）；而本仓同时要满足四 IDE 链接门、ctx 预算门与 INDEX 登记。实测：5 件（security-audit / open-code-review / open-code-review-delegate / browser-skill / 自撰 ax-runtime）**全部逐字落位即过** `check:links` 与 `ctx:check`，本地差异全部写进 `my-skills/INDEX.md §1b.1`。
  根因：上游正本是**可重拉覆盖**的对象，改写一次就等于永久放弃覆盖能力；而本地差异（宿主写盘限制、外部 CLI 前置、触发词分工）多为**当下环境**的属性，不是上游缺陷，写回正本反而会把本仓约束强加给下一次覆盖。
  做法：① 正本逐字不改，所有本仓注意（如沙盒拒写 `/tmp` ⇒ `ocr review --output` 改用仓内已 ignore 路径）一律入 INDEX 批次节，同 `my-plugins/README.md` 的「JSON 不支持注释 ⇒ 语义落 README」取向；② 拉取脚本随件跟踪，非 `.md` 产物（随带的 `.cjs` / `.json`）天然不入 ctx 索引面 ⇒ **不必为其登记 `vendor-skills` 预算豁免**，判豁免先看扩展名再算 tokens（覆盖面由生成器扩展名枚举决定，同 K-058 根因的反方向用法）；③ 四 IDE 链接目标字符串必须逐字 `../../my-skills/<name>`（`check-ide-links` 比的是 `readlink` 结果而非 realpath），且**目录名 == frontmatter `name`**；④ 与同域既有件的分工要在 INDEX 写死（本仓 `requesting-`/`receiving-code-review` + CodeReview 子代理 vs 外来 `open-code-review*`；`security-audit` vs 宿主内置 `security-scan`），否则触发词互相抢、下一位读者无从知道该走哪条。
  判例引用：K-033（symlink 正本判据 = 消费内容逐字相同）、K-058（排除面看生成器枚举不看 .gitignore）、K-031（人写清单需断言兜底）。

- **[接入][K-074] 接外部能力前先机械验源：「仓库存在」≠「有可转换的 SKILL.md」**（来源 WXG-T-208，2026-09-24）
  现象：用户点名接入四个 skill，其中 `google/ax` 全仓 **0 个 SKILL.md**——它是跑在 K8s 上的声明式 agent 编排运行时（`ax apply -f task.yaml`，需集群 + ko + 镜像仓）。若按名字硬转，只能伪造一份「看上去像 skill」的目录，或者静默跳过不报。
  根因：「仓库名带 -skill / 被宣传为 agent 能力」不等于「含可加载 SKILL.md」；skill 资产与 runtime 资产在装载面上不是一类（前者宿主扫目录、后者要集群）。不先确认存在可转换物就开工，交付必然退成伪造或默删。
  做法：① 一条命令判源：`curl https://api.github.com/repos/<o>/<r>/git/trees/<branch>?recursive=1` 过滤 `SKILL.md`，命中则取真实路径（常见五种布局之一），未命中即报「无可转换物」；② 未命中时给 2–4 个选项让主理人拍板（跳过 / 按官方 README・DESIGN・docs 自撰并**显式标「本仓自撰、非上游移植」+ 文档快照日期** / 换正确仓库），不得把「自撰」当默认路径；③ 自撰件首屏必写未实测面（本仓无集群 ⇒ 全文命令未跑通），字段只准抄官方文档、不臆造；④ 一仓多 skill 很常见（alibaba 拆 `open-code-review` 与 `-delegate` 两件，后者**不需配 LLM 端点**，恰好是本仓无 key 时可用的那件），转之前先把 `skills/*/SKILL.md` 全枚举再定取舍；⑤ 上游同一能力常有两份变体时，要比体积与引用面再选（browser-skill 取 CLI 捆绑的 `crates/bsk-cli/skill/` 全量版，而非宿主插件的精简版）。
  判例引用：K-071（并发会话 T-207 批沉淀「接入后必须跑一次真实产物冒烟」——本条同批复现：正是 `ocr review --preview` 与 `bsk doctor` 才扇出「LLM 未配」「扩展未装」两个真前置）、K-054（「未登记」不等于「已证伪」，也别把「缺通道」当预期写交付）。
