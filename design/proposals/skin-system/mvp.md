# MVP 拆分（skin-system MVP）· WXG-T-267 · v1.0

> 作者：程基岩（工程）· 2026-10-08 · 验收判据只给**可测试的断言方向**，具体用例归 QA 单（严守真 / wxgame-qa-gates）。
> 总原则：每批独立可验收、封箱影响可控（批内默认肤封箱零改动或仅走已登记快照通道）。

---

## 0. MVP 范围裁定（先答任务单点名问题）

**第一肤只动「色系 + UI 令牌」，几何/纹理不动 —— 此建议成立，采纳。** 理由（四条）：

1. **令牌真源现成**：tokens.md 甲案「暖纸拼豆台」全套 hex 已定稿（用户 2026-10-07 裁 D-2），第一肤 = 把定稿值填进 `BeadsSkin.tokens`，零新设计、零新裁定。
2. **封箱风险最低**：纯 hex 改写不增减图元 ⇒ 整帧 kinds/total 恒等、sha 可归因（第十六次复评同构判例）；动几何/纹理则每批都要碰 seal 腿 2/3 或 J1–J7。
3. **通道已验证**：`BeadsPalette` 实例注入 + `neutralEndpoints` 槽锚参数化（WXG-T-261 判例）证明「换实例 = 换槽/UI 族」可行；几何入肤没有等价判例。
4. **反论（诚实记）**：只动色系的肤「气质差异」有限——「手绘蜡笔」类肤最终必然要动端点系数（质感）甚至珠体风格；本 MVP 的价值在**把通道与封箱组织先立起来**，让后续批变成纯数据追加。

---

## 批 1：皮肤数据结构 + 第一肤「暖纸拼豆台」（色系 + UI 令牌）

**内容**：
1. `src/config/skins/` 目录 + `BeadsSkin` 类型 + `DEFAULT_SKIN`（tokens = 现 `DEFAULT_PALETTE`）+ `warm-paper.ts`（tokens.md 甲案全套：换值 4 项 + 新增 wood_*/card_*/text_disabled/shadowInk 约 14 字段）。
2. `BeadsPalette` 接口扩字段（默认值写 palette.ts ⇒ 色表锁 +N 条，走 art 同步快照通道）。
3. 注入接线：`BeadsGameOptions.skin` / `BeadsShellOptions.skin`；运行时切换 `snap.skinId`；`normalizeSettings` 增 `skinId` 逐字段降级（SAVE_VERSION 不 bump）。
4. 残留模块级墨收编：`TRAY_PLATE.ink` → `tokens.shadowInk`；`CONFETTI_COLORS` → 实例派生。
5. 设置入口：暂停面板 + 菜单设置各一枚 `cycle-skin` 选择器钮（文案走 `skin.label`，禁写死款数）。
6. 封箱：seal 四腿 + 色表锁**保持只跑默认肤**；新增 `seal-skins.json` 相对快照（warm-paper：kinds/total ≡ 默认肤 + sha 归因注）。

**验收判据（断言方向）**：
- A1：默认肤（不传 skin / skinId='default'）下，seal 四腿与色表锁**逐字节不变**（回归零扰动门）。
- A2：切 warm-paper 后整帧 `kinds` 逐 kind 计数与 `total` ≡ 默认肤；sha ≠ 且 diff 全部落在 token 消费图元（流级归因，未解释 0 条）。
- A3：`buildBeadsView` 及全部 draw* 函数对 tokens 的消费点断言：无模块级 `DEFAULT_PALETTE` 直接引用（除其自身定义与测试）。
- A4：`normalizeSettings`：缺字段 / 非字符串 / 未注册 id / 空串 四态各回落 `DEFAULT_SKIN.id`，其余 settings 字段无损；非法 skinId 下渲染回默认肤（最后防线断言）。
- A5：切肤下一帧生效、无过渡帧（连续两帧命令流：帧 N=旧肤、帧 N+1=新肤，无中间态）。
- A6：热路径零分配机械锚：切肤后 `buildRenderModel` 连续两帧无新增堆分配（C2 同款探针）。

## 批 2：端点系数入肤（质感阶梯差异化）

**内容**：
1. `bakeEndpoints(hexes, coeffs = DEFAULT_ENDPOINT_COEFFS)`；`inksCache` 键扩 skinId（每肤每关一次烘焙）。
2. warm-paper 的端点覆写值 [待美术：林绘澄给「暖纸」的明暗阶梯档；工程先开放 8 系数通道，美术只填想动的字段]。
3. C4 裸系数扫描扩展到 `config/skins/`（禁 `mix(…, 字面量)` 第二把尺子）。
4. `bead-cell-standard`（J4 真透偶数 / J7 成对锁）在覆写系数下的复验跑通。

**验收判据**：
- B1：默认系数下 `bakeEndpoints` 输出与今日**逐字节相同**（seal 腿 1–4 零扰动复验）。
- B2：覆写档端点全部 = `mix(base, ±coeff)` 族内派生（零新 hex；端点断言 = 对每色算期望值比对）。
- B3：每肤每关烘焙恰一次（缓存命中断言）；热路径查表零分配。
- B4：槽/珠凹凸方向可辨判据（§1.9.7③ 现行文本两条硬判据：珠凸/槽凹明暗方向可辨、凹侧明暗线在场）在每肤通过。

## 批 3（可选，需用户拍板后再立项）：珠体风格联动 / 珠色映射 / 文案令牌

- 3a `beadStyleDefault` 联动策略落地（独立记忆 vs 切肤重置，见 arch.md §5-1）。
- 3b 珠色基色映射：**须先推翻/扩展 §1.9.7① 纪律**（配色主题裁定）+ seal 全腿重评 + 新 ADR；预留字段位不实现。
- 3c 文案令牌入肤：低价值高歧义，建议**不做**（文案=品牌非主题）。

---

## 依赖与拓扑

```
批1（数据结构+注入+第一肤）
 ├─► 批2（系数通道）──► 批3b（配色主题，需裁定）
 └─► 批3a（风格联动，独立小批）
```

- 批 1 是后续一切 UI 批（ui-style-redesign 落码）的**前提架构**（P0 因由）：甲案换值与新 token 消费点全部走 skin 通道而非直接改 `DEFAULT_PALETTE`。
- 环境阻塞：无真机 ⇒ 包体增量与切肤帧耗均标 `[待实测]`；不阻塞批 1/2 逻辑与封箱验证（harness 可全量跑）。
