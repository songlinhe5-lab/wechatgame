# WXG 任务台账（SSOT）

> 单号递增不回收。任何会话（WorkBuddy/Cursor/Qoder/CodeBuddy）开工前**先读本文件领号**，完成后回填状态——根治跨 IDE 撞号（教训：2026-09-12 CodeBuddy 独立会话撞用 T-013/T-014）。
> 建档：2026-09-12，主理人游承峰。当前已分配至 **WXG-T-015**，下一可用号 **WXG-T-017**。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | breakout 框架搭建 | 程基岩 | ✅ 完成 | packages/framework 24 模块 + games/breakout |
| WXG-T-002 | breakout 概念+设计文档 | 文策渊 | ✅ 完成 | games/breakout/design/* |
| WXG-T-003 | breakout 美术三件套 | 林绘澄 | ✅ 完成 | games/breakout/art/* |
| WXG-T-004 | breakout QA 五件套 | 严守真 | ✅ 完成 | games/breakout/../production/qa（月度 G4 门） |
| WXG-T-005 | breakout 发布清单 | 路远行 | ✅ 完成 | 发布四件套 |
| WXG-T-006 | beads 概念+美术+GDD 首批 | 文策渊/林绘澄 | ✅ 完成 | concept / art-bible / systems-index 等 |
| WXG-T-007 | beads systems-index 冻结 | 文策渊 | ✅ 完成 | §3 冻结常量（现 v1.5） |
| WXG-T-008 | beads 美术回写冻结常量 | 林绘澄 | ✅ 完成 | art-bible/assets-spec/accessibility v1.2 |
| WXG-T-009 | beads 架构+ADR+QA+发布 | 程基岩/严守真/路远行 | ✅ 完成 | architecture-beads / ADR-0004~0007 / qa / release |
| WXG-T-010 | beads 架构三件套 | 程基岩 | ✅ 完成 | 同上（归并记账） |
| WXG-T-011 | beads QA 五件套 | 严守真 | ✅ 完成 | 62 用例覆盖 50/50 判据 |
| WXG-T-012 | breakout G4 回归测试 | 程基岩 | ✅ 完成 | g4-regression.test.ts（13 P0 判据） |
| WXG-T-013 | breakout D-01/D-02 修复 | 程基岩(2) | 🔄 进行中 | reduceMotion + slow/sticky → G4 升 PASS |
| WXG-T-014 | beads S6 道具系统 GDD | 文策渊 | ✅ 完成 | gdd/powerups.md（Q1–Q5 已裁决） |
| WXG-T-015 | beads S7 计分连击/S8 存档/S9 暂停 GDD + levels-spec + 8 关 JSON + UX 规格（A+ 扩容：冲刺模式/连击并入 S7，元游戏框架提案另立） | 文策渊 | 🔄 进行中 | gdd/score-combo.md 等（见任务单） |
| WXG-T-016 | beads 每日挑战设计草案（原 CodeBuddy 侧误编 013，改名） | 文策渊 | ✅ 完成（v0.1 挂起） | proposals/daily-challenge.md |
| WXG-T-017 | beads STAR3_RATIO 0.50→0.40 改值（原 CodeBuddy 侧误编 014，改名） | 文策渊/程基岩/严守真 | ✅ 完成 | systems-index §6 v1.5（commit ae11106） |
| WXG-T-018 | beads art-bible §7 动效对齐 ux-spec §5 + 连击三档特效增补 | 林绘澄 | ✅ 完成 | art-bible.md v1.1 |
| WXG-T-019 | breakout G4 门独立复验（D-01/D-02 修复后） | 严守真 | 🔄 进行中 | G4 裁决（CONCERNS→PASS 待签字） |
| WXG-T-020 | beads 30 项决策点冻结回写（用户 2026-09-12 全按推荐拍板） | 文策渊 | 🔄 进行中 | systems-index v1.7 + 六文档冻结标注 |

> 注：T-016/T-017 的产出实际由 CodeBuddy 侧会话完成（用户授权路径），本台账为跨 IDE 统一追认。
