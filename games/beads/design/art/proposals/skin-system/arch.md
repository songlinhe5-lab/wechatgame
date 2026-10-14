# 皮肤系统架构（ADR 骨架）· WXG-T-267 · v1.0

> 作者：程基岩（工程）· 2026-10-08 · 正式 ADR 落 `docs/architecture/adr/` 时按编号递增占用（建议 ADR-0031「皮肤系统」或拆 D1–D4 数条；本档为骨架与论证正本）。
> 上游输入：`replaceable-inventory.md`（同目录）· tokens.md（甲案定稿）· assets-spec §1.9.7（风格插件双通道纪律）· EP11-S5 换肤先例（`settings.beadStyle/beadSize`）。

---

## 1. 上下文（Context）

- 用户需求：把「珠面生成 → 盘面呈现」全链路可替换元素参数化，支持**整套切换**（如「暖纸拼豆台」「瓷白工作台」「手绘蜡笔」各成一肤）。
- 平台铁律：微信主包 ≤4MB、**零外部资产** ⇒ 皮肤必须是**程序化参数**（hex / 系数 / 布尔），不是贴图包。
- 渲染：自研 `RenderModelBuilder` 命令流（rect/circle/ellipse/polygon/line/text/blit），无 shader；封箱体系（色表锁 + seal 四腿）对 hex 与图元数**极度敏感**。
- 既有换肤通道（不可重建、只可复用）：
  ① `BeadsPalette` **实例注入**（`beads-game.ts:631` / `beads-shell.ts:114` → `buildBeadsView` 逐参传递）；
  ② 珠色墨水 per-level 实例（`BeadInks` + `options.inks`，v1.40）；
  ③ 珠体风格注册表（`bead-styles/registry.ts`，EP11-S5，snapshot `beadStyle` → `options.styleId`，下一帧生效零过渡）；
  ④ 存档逐字段降级先例（`save-schema.ts::normalizeSettings`，SAVE_VERSION 不 bump）。
- 冲突源：assets-spec §1.9.7①「换肤不得改珠体基色（配色主题须另走色板裁定）」——皮肤系统的作用域必须显式裁定与它的关系（见 D4）。

## 2. 备选方案与决定（ADR 骨架，4 条）

### D1. 皮肤 = 纯数据包（TS 模块），不是代码包、不是 JSON、不是贴图包

- **方案 A（采纳）**：每肤一个 TS 模块，住 `games/beads/src/config/skins/<skin-id>.ts`（config 层持 hex 有先例：`palettes-data.ts` 品牌色板生成物）；类型 = `BeadsSkin`。
- **方案 B**：JSON 数据 + 运行时 `JSON.parse`。弃：丢类型检查、需写校验器、热路径反序列化风险；且 palettes 判例已走「生成脚本 → TS 模块」。
- **方案 C**：每肤一个渲染分支（代码包，if skin === 'crayon' …）。弃：L2/L3 与热路径纪律不可守，封箱面爆炸。

```ts
/** 皮肤包数据结构（字段与 inventory §1–§4 一一映射） */
export interface BeadsSkin {
  readonly id: string;            // 'warm-paper'（循环序 = 数组序，同 BEAD_SIZE_ORDER 判例）
  readonly label: string;         // 玩家侧名（同 BEAD_STYLE_LABELS 判例；缺省回落 id）
  readonly tokens: BeadsPalette;  // UI 令牌整实例（含 tokens.md 新增 wood_*/card_*/shadowInk 等扩字段）
  /** 端点/质感系数覆写（可缺省 ⇒ 逐字段回落默认肤档；同族内派生，⛔ 不允许携带 hex） */
  readonly endpointCoeffs?: Partial<BeadEndpointCoeffs>;
  /** 该肤默认珠体风格（可选；不填 = 玩家 beadStyle 设置原样生效 ⇒ 两维正交） */
  readonly beadStyleDefault?: string;
}
```

- **后果（4.2 负面，诚实记）**：TS 模块使「运营热更皮肤」不可行（需发版/热更包）；每肤常驻内存一份 `BeadsPalette` 实例（≈KB 级，可忽略但非零）；`tokens: BeadsPalette` 整实例复制使「两肤共享大部分 token」时存在重复字面（接受：显式优于派生魔法）。
- **包体影响**：每肤 ≈ 30–40 个字段 × 平均 8 chars + 注释，源码 ≈ 2–3 KB，minify 后 <1 KB `[待实测]`；10 肤 <10 KB，相对 4MB 红线可忽略。

### D2. 参数注入，而非全局替换 / 环境变量切换

- **决定**：换肤 = **构造时/切换时换引用**，渲染链签名零变更：
  1. `BeadsGameOptions` / `BeadsShellOptions` 增 `skin?: BeadsSkin`（缺省 = `DEFAULT_SKIN`，其 `tokens` = 现 `DEFAULT_PALETTE`）⇒ 内部 `this.palette = skin.tokens`。**`palette` 形参通道原样保留**——全部下游（`buildBeadsView`、`drawEmptySocket`、`drawLockedBead`）已经吃实例，零改动。
  2. 端点系数入肤：`bakeEndpoints(hexes, coeffs)` 增第二形参（缺省 = 现模块常量值，**默认肤烘焙结果逐字节不变** ⇒ seal 腿不受扰动）；`inksCache` 由 `WeakMap<level, BeadInks>` 改为 `WeakMap<level, Map<skinId, BeadInks>>`（每肤每关一次烘焙，非热路径；热路径仍查表零分配）。
  3. 残留模块级墨收编（inventory §4 清单）：`TRAY_PLATE.ink` → `tokens.shadowInk`；`CONFETTI_COLORS` → 按实例派生。`POWERUP_INK_*`/`STAR_GOLD` 等**资产色不动**（§1.4 判例）。
- **对照 v1.5-r4 ③ 核对结论**：当年结论「`drawFilledBead` 签名无 palette 形参 ⟹ 珠体十层对主题化零参数通道」——**已被后续演进实质超越，本方案不采纳「加 palette 形参」**：v1.40 起 `FilledBeadOptions.inks`（墨水+端点，`:286`）与 EP11-S5 `options.styleId`（`:324`）两条通道已覆盖珠体渲染的全部主题面；剩余缺口只有「端点烘焙系数」，在 **inks 生成侧**（`bakeEndpoints`）解决而非调用签名侧 ⇒ **`drawFilledBead` 签名不动**（990 行热路径 + 封箱基线零扰动）。方向与 v1.5-r4 ③ 一致（都是「把主题变成参数」），只是注入点从调用签名上移到数据生成层，改动面更小。
- **⛔ 明令禁止**：运行时 `Object.assign(DEFAULT_PALETTE, …)` 之类全局突变（破坏 L5 只读快照纪律与封箱可复现性）；skin 数据必须 immutable（模块级 `Object.freeze`，判例 `REGISTRY`）。
- **后果（4.2）**：系数经 `endpointCoeffs` 覆写后，「端点表 = palette.ts 预烘焙」的单一真源叙事多了一层间接（真源 = 默认系数 ∪ skin 覆写）⇒ 文档与 `bakeEndpoints` 注释须同步改写；`endpointCoeffs` 覆写面若失控会重新造出「第二把尺子」⇒ 由 seal 相对快照 + C4 扫描扩展到皮肤模块兜底。

### D3. 封箱体系：只锁「默认肤」，非默认肤走相对快照

- **方案 A（采纳）——「默认肤全封箱 + 其他肤相对快照」**：
  - seal 四腿（`tests/bead-style-seal.test.ts`：legacyFlow 96 例 / facetNonHole 45 例 / facetHole 45 例 / 整帧 frame0+frame78 kinds+total+sha）与色表锁（35 条 + sha1）**继续只跑默认肤**——史证段与复评通道（`provenance.s3_frame_recheck_*`）零结构性变更，K-082 边界不触碰。
  - 每个非默认肤登记**相对快照**（新 fixture `seal-skins.json` 分节）：断言两组——
    ① **结构恒等**：该肤整帧 `kinds` 计数与 `total` ≡ 默认肤（纯墨改写不增减图元；判例 = 第十六次复评 traySlot 纯墨改写「168 条纯墨改写、逐 kind 计数零变更」）；
    ② **sha ≠ + 归因注**：与默认肤 sha 不同且变更只来自 tokens/系数字段（流级差分归因，未解释 0 条）。
  - 快照抓取 = 官方复取器扩展 `tests/bead-style-seal-recapture.ts`（⛔ 手填，同复评纪律 ②）。
- **方案 B——每肤一套全封箱**。弃：`head.*` 史证对照（改码前基准）只对默认肤有意义；每肤复制四腿 = 复评工作量 ×N，且「什么都没变」的回退阀语义只在默认肤成立。
- **方案 C——封箱只留默认肤、其他肤零快照**。弃：换肤后整帧无人守护，回归（如图元数漂移、漏画层）静默逃逸，违背封箱体系设立初衷。
- **后果（4.2）**：相对快照不能证明「该肤历史基准没变」（它没有史证段）⇒ 皮肤自身的跨版本回归靠 ①② 组合间接钉住（结构恒等 + sha 稳定）；若某肤未来获准携带**几何类**覆写（layer/系数改变命令数），① 失效，须升级为该肤专属图元数基准 —— 划为**批 3 复评触发条件**（见 arch §5 / ADR §5）。
- **色表锁扩口径**：皮肤模块住 `config/skins/`，palette.ts 字面量集不动 ⇒ 35 条锁不变；`BeadsPalette` 接口**扩字段**（默认值仍写 palette.ts）会 +11 条左右 ⇒ 走 art 单同步快照通道（判例 v1.5-r21 34→35，`risks.md` R-6 同族）。

### D4. 皮肤作用域：**不含珠色基色**（§1.9.7① 纪律维持）；动效参数不入肤

- 珠体基色真源 = 关卡数据 + 品牌色板（`PALETTES`，beads-studio 入关写入），且 §1.9.7① 明文「换肤不得改珠体基色，改色属配色主题须另走色板裁定」。皮肤若要映射珠色（如「手绘蜡笔」把十色换成蜡笔十色），技术上可行（per-level inks 实例已通）但属**配色主题**，须走独立裁定 + ADR + 封箱全腿复评 ⇒ **不进本系统 MVP**，留为皮肤结构的**预留字段位**（`BeadsSkin.inkMap?: …` 不实现，仅注释占位）⇒ 复评触发条件见 ADR §5。
- 动效/几何参数（`SELECT_LIFT_*`、`GROUP_LAND_*`、`BEAD_CARD`、`TRAY_*`…）：**永久排除面**（inventory §5 三理由：语义/裁定成本/封箱架构级阻塞判例）。

### D5（并入 D2 记录）. 切换机制与持久化

- **运行时切换**：`drawFilledBead` 是每帧纯函数（`styleId` 先例：「下一帧生效、零过渡，⛔ 不得引入插值」）⇒ 换肤同型：设置页选择 → 写 settings → 下一帧全链路读新实例引用。无补间、无过渡帧。
- **合流 `beadStyle` 占位先例**：`snapshot.beadStyle`（`state.ts:140`）继续管珠体风格；新增 `snapshot.skinId` 并列（不合并——珠体风格与整套皮肤是**正交两维**：皮肤可带 `beadStyleDefault` 作为「换肤时的建议值」，但玩家显式选过的 `beadStyle` 优先 [待用户拍板：是否皮肤切换时重置 beadStyle]）。设置 UI：暂停面板/菜单设置各加第三枚选择器钮（`cycle-skin`，判例 `cycle-bead-style` 同型：循环、即写档、无确认钮、文案不写死款数）。
- **持久化**：`settings.skinId`（缺省 `'default'`），`normalizeSettings` 逐字段降级（未注册 id / 非字符串 ⇒ 回默认，其余字段不牵连），SAVE_VERSION **不 bump**（debugInfo 判例）。registry 未注册 skinId 的渲染侧最后防线 = `skinsById() ?? DEFAULT_SKIN`（同 `styleById` 回落判例，测试钉住）。

## 3. 数据流总览

```
skins/<id>.ts (BeadsSkin, frozen)
   │ options.skin (构造) / settings.skinId (运行时切换)
   ▼
BeadsGame.skin ──┬─ palette = skin.tokens ──► buildBeadsView(palette, inks)   [现有形参通道，零改动]
                 ├─ beadInksFor(level, skin) ─► bakeEndpoints(hexes, coeffs) [扩键，默认肤逐字节不变]
                 └─ snap.skinId ──► view 读 skin.beadStyleDefault（可选建议值）
                                          ▼
                        drawFilledBead(options.inks, options.styleId)  [签名不动]
```

## 4. 复评触发条件（Review Triggers，并入正式 ADR §5）

1. 任一皮肤获准携带几何类覆写（改变命令数/图元数）⇒ D3 方案 B 升级评审；
2. 珠色基色映射入肤（配色主题）⇒ §1.9.7① 重开 + 全腿复评；
3. `BeadsPalette` 字段数变动（tokens.md 再改版）⇒ 色表锁快照通道；
4. 真机实测包体增量 > 5 KB/肤 ⇒ 评估皮肤数据压缩/拆分；
5. 出现「皮肤 × 豆径档 × tint 臂」三叉组合的实渲分歧 ⇒ mask/tint 白名单需加 skinId 维度（`tintMaskId(kind, gauge, styleId)` 签名扩展 [待核：mask 资产与皮肤的关系——当前 mask 是风格定稿资产，皮肤不换 mask；若皮肤换珠体风格则随 styleId 走，零新 mask]）。

## 5. 未决问题（交主理人/用户拍板）

1. **皮肤切换是否重置 `beadStyle`**：A=各自独立记忆（推荐，正交）；B=皮肤带默认风格、切肤即重置。
2. **皮肤入口 UI**：暂停面板行 4 已有两钮（珠子风格/豆子尺寸），行高地板 88、面板已扩到 718 容 5 行——第三钮放行 4 并列改造 / 新行 / 复用现有行二选一循环，交 UX 单（路远行域）。
3. **第一肤命名与取值**：tokens.md 甲案「暖纸拼豆台」已定稿（用户 2026-10-07 裁 D-2），是否即第一肤（推荐：是——令牌真源现成）。
4. **`endpointCoeffs` 首批开放面**：全部 8 系数 vs 仅暗端族（shadeOuter/shadeMid/hole/pit）（推荐：全部，C4 扫描兜底）。
