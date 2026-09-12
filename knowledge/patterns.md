# patterns.md — 模式库（本仓已验证可复用的做法，追加式）

## 数值与真源

- **冻结常量 SSOT 模式**（breakout/beads 双实例验证）
  `systems-index.md §3` 表格 = 唯一真源；代码 `src/config/tuning.ts` 只做镜像 + `as const`；
  其他文档一律引用**常量名**不抄值；改值走 §6 变更记录 + 全仓 grep 旧值残留。
  变体：`IMPLEMENTED_POWERUPS` 派生语义——数据里可存在未实装 ID，运行时 `pool ∩ IMPLEMENTED` 交集 + 权重重归一，裁剪不改数据。

- **关卡覆盖全局基线**：§3 常量是底线，per-level JSON 字段覆写调优；
  `validate-levels.mjs` 在 CI 里守卫（单调性/上限/字符集/行宽）。

## 代码结构

- **决策表模式**（breakout `src/systems/motion.ts` 实例）
  多开关 × 多效果的组合行为收敛成纯函数 `resolveMotionEffects()`（输入开关，输出逐项 bool），
  表驱动测试逐项断言，视图层只读结果不做条件散落。适用于 a11y/画质/难度分级类正交开关。

- **事件总线 payload 约定**：`<域>:<事件>` 命名、payload 一律带 `levelId`（beads 约定）、
  事件表即 `systems-index §4`（实现与文档一一对应，新增事件走 §6 变更）。

- **同帧冲突固定结算序**（breakout powerups 实例）：多来源同帧到达时按 `life→multi→expand`
  固定顺序结算——「写死并测试」（GDD 判据 + 实现常量 `PICKUP_SETTLE_ORDER` 同名对齐，
  测试 import 实现常量断言，勿在测试里自比较字面量）。

## 上下文与工程基建

- **章节级上下文索引（`ctx/` 体系，WXG-T-024）**
  生成器扫描全部 `.md` → 每节存「**标题路径为主键**（`§3.7 星级与结算`）+ 行号区间为辅 + 首句摘要 + token 估算 + 关键词」；
  生成物**不含时间戳、键序固定**才字节稳定，可入库做新鲜度守卫；读取协议 = 先查 `ctx/ROUTES.md` 路由表 → `read_file(offset, limit)` 只取命中节。
  实测收益：读单节比全文省 87%–98%；守卫 `ctx:check` 四重（常驻预算/单文件上限/索引新鲜度/ROUTES 锚点）。

- **导航表锚点必须被守卫校验**：`路径#锚点` 形式的引用会随标题改名**静默漂移**——
  把「锚点可命中」并入守卫脚本，以索引文件为唯一真源（与生成器共享模块，禁 shell 外调）；
  整文件引用用行级豁免语法（如 `<!-- no-anchor -->`）显式声明，不靠约定俗成。

- **新增 CI job 一律并入 `gate` 收口**：job 用 paths-filter 增量触发，`gate` 以 `needs` + 逐 job `success|skipped` 判定；
  分支保护**只挂 `gate` 一个 required check**——新增/调整 job 不必反复改保护名单。

## 流程

- **八要素 spawn 模板**：角色声明 / Task ID / 项目上下文 / 环境事实（做不了的要明说）/ 权威来源清单
  （含 knowledge 相关条目路径）/ Deliverables 逐文件 / 精确 Output Path / 必读 skill 仓库路径。
  成员间不直连，产出经主理人中转。

- **双层验证**：实现者自验（跑全套测试）→ 独立成员复验（fresh eyes 读断言真实性 + 对照 §3 常量）。
  复验发现记缺陷台账（D-xxx 阻塞 / F-xx Minor），Minor 可随下次提交带上、不重开门。

- **裁决留痕**：用户/主理人的每次拍板落 §6 变更记录（豁免理由逐条照录 + 生效依据），
  commit message 与 §6 条目互相可追溯。
