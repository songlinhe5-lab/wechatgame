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

- **[接入][K-075] 外部决策模型（Jev/System One 类）接入前先过四条件滤网；beads-studio 用例已证伪并拆除，候选场景留档待立项**（来源 Jev PoC 验证会话，2026-09-24，未挂 Task 号）
  现象：把 TypeSafe Jev（只答选择题、回概率不生成文本的决策 API）接进 beads-studio 做「盘面档位建议」，端到端通路全绿（OpenRouter `api/alpha/decisions`、真 key、置信度门控均验证生效），但判别体检判死：① 盘面档位本就是前端 `inferBoard` 的确定性除法（px ÷ 品牌 dip ÷ N× 密度），模型只能重新发明计算器；② 喂给模型的用色数/边缘密度/熵属**静态结构量**，同类量在难度公式 v0.1 已被 32/32 证伪（`beads-bot.ts` 头注：B_med 同为 6 结果相反 ⇒ 无分辨力）；③ 唯一没人做的「量化后像不像」审美判据无冻结标准，没有考纲的打分无意义。
  根因：决策模型的定位是「聪明的 if」——只该接在**代码写不出规则、又无需预测行为**的语义判断上；选型时若不问「这题是否已有确定性竞争者/真值来源」，会把可算题和预测题误托给模型。
  做法：接外部决策模型前四条件逐条核，缺一不接：**①语义题**（规则写不出）**②非预测题**（不拿静态量猜行为，数值可算进 tuning、行为可测交 bot）**③高频或即时**（多题并行一次前向才划算）**④低代价可兑底**（置信门+回退路径）。本仓过筛后的候选仅两个（用户裁定选留档、未立项）：**B. 玩家反馈/工单路由**（推荐首选：上线后有量、人工处置记录即标注真值、分错仅排队靠后）；**A. UGC 审核补充层**（昵称/自定义关名在 msgSecCheck 之外判乱码/引流，随 UGC 功能落地，与 B 共用接入形状）。反例登记：编排质量门 G1–G4 永不用概率判据（硬常量裁决）。
  接入事实备忘（复活 B/A 时免重查）：OpenRouter 通路免 waitlist，模型名 `typesafe/jev-1.13`（`jev-latest` 别名不存在，实测 400）；key 格式 `sk-or-v1-…`，格式不对会被拒成误导性的 "Missing Authentication header"；响应 `{answers:{q:{choice|noul|score, confidence}}, usage}` 与 TypeSafe 直连同构；国内出口实测延迟 ~1.4s（高于官方 70–500ms 口径）。
  判例引用：K-074（接前先验源——本条同族：接前先验「这题该不该模型答」）。
