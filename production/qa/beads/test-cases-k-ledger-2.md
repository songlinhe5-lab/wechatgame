> **本片 = `production/qa/beads/test-cases.md` 的分片（WXG-T-225，2026-10-25）。**
> 判据**零改动、零删除**，原文逐字搬迁（K-051/K-053）；差异仅限标题标记与本头注。
> 本片 = §K.5.1 第 3–11 次补登 + §K.6 / §K.7；§L 起在下一片。
> 上片 `test-cases-k-ledger-1.md` ← 本片 → 下片 `test-cases-l-tint.md`｜总索引 `test-cases.md#§分片索引（WXG-T-225 · 13 片，先看这张表）`

### K.5.1-补3 整帧基线第三次复评修订（WXG-T-214 四～八裁批，2026-09-28，严守真 · 变更源 = 珠体族「孔层」三→五→六→七裁拍板链）
>
> - **触发与定性**：四～八裁收口单提交 `927535c`（孔径规格 r5–r8 + 缩放绝对倍率 + 烘焙双轨改道 tint）在**珠体族孔层**上落了四笔用户拍板的合法改动 ⇒ `tests/bead-style-seal.test.ts` **腿 3 / 4a / 4b 三例红**（连续同三条，**非 flaky**）；腿 1 / 2 / 2b 复评前后均绿（非孔 #1–#5 ≡ `s3` 登记仍成立）。定性 = **复评归因通道**（唯一例外通道，本轮为第四次落笔）；判据文件头「⛔ 不得反向更新基准让它绿」（**K-051 / K-053**）的原禁令**原文未动、效力未减** —— 一切新值出自**官方复取器** `tests/bead-style-seal-recapture.ts` 在可复现 commit 上的重抓，⛔ 无一手填数。
> - **编号口径（落笔前已核占用）**：夹具 `provenance` 现键序 = `head / method / s3 / s3_frame_recheck / _2 / _3 / _4`。**键 4 = 「cc41aff+合流树」批**，而该批在本文**无 `K.5.1-补` 编号**（其归因只在 provenance 与判据注释里）⇒ 本轮落 **provenance 键 `s3_frame_recheck_5` + 本文 `K.5.1-补3`（v1.20）**。⚠ 两套编号自此**不一一对应**（`补`↔recheck、`补2`↔recheck_2、**（无文号）↔recheck_3 / recheck_4**（r10 已追补为 `补4`↔recheck_3、`补5`↔recheck_4，2026-09-28 闭合）**、`补3`↔recheck_5）⇒ 引用时请**一律附 provenance 键名**免歧义。核占用命令：`grep -rn "K\.5\.1-补3\|s3_frame_recheck_5" --include="*.md" --include="*.ts" --include="*.json" .`（落笔前 = 0 命中）。⚠ **未入树补丁的同号预约（本轮新发现，转呈主理人）**：`temp/bead-relief-compare/wip-215-full-backup.patch`（WXG-T-215 三轮看图裁定的未落地备份，ADR-0027 行 153 / 主表 T-218 行均已披露「代码只活在 temp」）内**已写死 `s3_frame_recheck_5 / _6 / _7` 三键** ⇒ 与本单已入库的键 5 **字面碰撞**（现树工作区不碰：该批代码未进 `927535c`，`tuning.ts::FACET4_FACET_INSET` 仍 = `0.09`）。本单以**已入库夹具为真源**保键 5；建议归位批重编为 `_6/_7/_8`（或拆为独立命名空间）。**【已执行 2026-09-28】**主理人采纳该方案，补丁预写键已就地重编（详见遗留登记 ⑦ 处置条）。**兼作为防护**：判据腿 3 断言 `provenance.s3_frame_recheck_5` 必含「第五次复评」+「HOLE_RING」⇒ 若该补丁以后直接覆盖同名键，判据立即响红（JSON 重复键取后者），不会静默吞掉本单登记。
> - **变更源逐条（用户拍板链，非 QA 自造）**：
>   | 裁次 | 裁定内容 | 落点（真源）| 对命令流的后果 |
>   |---|---|---|---|
>   | 三裁 | 孔边线族墨 `hole = mix(base, −0.58)` 取代恒定阴影墨 | `view/palette.ts::endpointOf().hole` | 环墨逐色变化（⇒ 45 例跨色撞值消解）|
>   | 五裁 | 孔边线宽 = **1 dp 绝对** `BEAD_CARD.holeStrokeWidthPx`，废等比式 `max(minStroke, 0.0769×size)`；空槽 S1 暗缘框**同墨同宽** | `bead-styles/facet-4.ts` + `bead-render.ts:730/748–754`（`frameInk` / `FACET4_EDGE_INSET_PX`）| 孔层 `lineWidth`；整帧空槽框 **字段级**改写（`lineWidth 2→1`、`#8e8a82→#6a6762`），**不改条数** |
>   | 六裁 | facet-4 孔拆**两枚层**：`HOLE_RING`（stroke-only）+ `HOLE`（pit）⇒ 层集 6→7 命令 | `bead-styles/facet-4.ts`（LAYERS 冻结序末两位 = HOLE_RING / HOLE，C7 压线余量 0）| 每颗填格珠 **+1 circle**（frame78 `circle +78`）；`layerSeal()` 的 `slice(5)` 天然吞两枚 |
>   | 七裁 | `holeRatio` 定值 **0.44** + 与 inset 成对锁（语义 = **真透半径**）| `BEAD_CARD.holeRatio` / `facet-4.ts::holeR = round(size×0.44/2)` | 在 45 例矩阵上 **几何净贡献 0**（`round(0.22S) ≡ round(0.44S/2)`）⇒ 只回正语义与真源，⛔ 不得读作「七裁白改」|
>   | （邻批）| WXG-T-217 缩放绝对倍率化（控件轨道 +1 rect）/ WXG-T-218 圆角扇几何重写（312 条 polygon 重写）| `config/tuning.ts` / `bead-render.ts` | 整帧 `rect +1` 与 polygon 字段/顶点重写（非本单修订面，但**入本单流级差分账**，见下条）|
> - **键形语义（本轮最大仓裁点）**：`s3.facetHoleLayer` 的 **45 个 label 键形不变**（仍一例一 sha），但**语义由「#6 单命令」更替为「#6 HOLE_RING + #7 HOLE 两枚层 JSON 串联后取 sha」** —— 判据分组口径（`slice(5)`）**未改** ⇒ 不新建 `facetHoleRingLayer` / `facetHolePitLayer` 两键的理由 = 保持夹具形状与历史可比、且复取器与判据共用同一 `layerSeal()` ⇒ 拆键反需改工具。机械副证：孔层 45 例的**互异 sha 数 15 → 39**（旧单孔只随目标色 `pit` 变 ⇒ 大量跨色撞值；新环吃逐色 `hole` 墨 ⇒ 撞值消解）。
> - **可复现锚（前态必须能再生，否则差分不算证）**：`git archive` 隔离副本 **`21317d8`** 跑官方复取器 ⇒ `frame0 970/5c41e321…` · `frame78 1126/1b5c8639…` **逐字节 ≡ 夹具 `recheck_4` 登记锁**，且同副本的 `legacyFlow` / `facetNonHoleLayers` / `facetHoleLayer` 与夹具@`21317d8` **零差** ⇒ 「前」干净。现态锚 = **`927535c`**（同法复现 `frame0 971/53139dd…` · `frame78 1205/e5c00786…`）。⛔ 未走 `temp/wxg-t-211-s3/capture.sh s3`（它会 `cp work/` 旧快照**覆盖工作树**）；产物落 `temp/wxg-t-211-s3/s3-seal.json`（原件已备份至取证目录）。
> - **修订面（三处，其余一律不动）**：`s3.facetHoleLayer` 45/45 重取 · `s3.frame0 = {total 971, sha 53139dd632af…e8f05}`（**total 与上一登记态相同** ⇒ 差为纯字段级改写）· `s3.frame78 = {total 1205, kinds rect491/circle160/line220/text12/polygon322, sha e5c00786c755…f8d20}`。**零追改机械复核**（写入脚本内 assert，非口径转述）：`head.*` 与 `s3AtFormalization` 两整段 / `s3.facetNonHoleLayers` 45 例 / `s3.legacyFlow` 96 例 / `fixture.*` 参数段 = **逐键全等**；`provenance` **追加不覆盖**（`_readme` 在 `s3AtFormalization` 段内，未动）。
> - **流级差分（b2 类，逐条比较，未解释 0 条）**：前态双侧均由隔离副本导出逐条命令原文（`temp/qa-wxg214-recheck5/flows/*.jsonl`），差分器 = `diff-flows.py`（difflib 对齐 + 字段级桶 + 账目核对）。**frame0 `970→971`** = 全等 783 + 改写 187 + 插入 1 + 删除 0；桶 = `rect/stroke lineWidth 2→1 ×180` + `rect/stroke stroke #8e8a82→#6a6762 ×180`（**五裁**；同一批 180 条 = 盘面 156 空槽 + 托盘 24 槽）+ 控件带 7 条（difflib 把「插入一条轨道 rect」对齐成 `circle⇄rect` / `text⇄circle` 的伪改写，语义 = 轨道 rect 插入 + 整带 `y +4` + knob `x 448→302.67`，**WXG-T-217**）⇒ **未解释 0**。**frame78 `1126→1205`** = 全等 695 + 改写 431 + 插入 79 + 删除 0；桶 = `polygon.count 3→8 ×312` / `points 6→16 ×312` / `stroke 无→#fef9f1 ×312` / `lineWidth 无→0.75 ×312`（**WXG-T-218 圆角扇自描边**）+ `polygon.offset 6→16 ×311` 与 `1872→4992 ×10`（顶点 arena 随每扇 3→8 顶点重排，坐标槽单位 ⇒ **Δ = 312×(8−3)×2 = 3120**，与观测逐位吻合）+ `rect/stroke lineWidth 2→1 ×102` / `stroke ×102`（**五裁**：78 空格 + 24 托盘）+ 控件带 7 + 插入 `circle/stroke ×78`（**六裁 HOLE_RING**）与 `text ×1`（控件带）⇒ **未解释 0**。
> - **逐 kind Δ 表（前态锚 `21317d8` → 现态锚 `927535c`）**：
>   | kind | recheck_4 | recheck_5 | Δ | 归因 |
>   |---|---|---|---|---|
>   | `rect` | 490 | **491** | **+1** | WXG-T-217 控件轨道（判据常量 `HUD_ZOOM_CTRL_DELTA.rect 3→4` / `TOTAL 7→8` 已由该批登记）|
>   | `circle` | 82 | **160** | **+78** | **六裁** HOLE_RING（78 颗填格珠各 +1 stroke-only 环；`pit` 圆逐字节未变）|
>   | `line` | 220 | 220 | 0 | — |
>   | `text` | 12 | 12 | 0 | — |
>   | `polygon` | 322 | 322 | 0 | 条数不变；312 条重写为 8 顶点圆角扇 + 10 条 arena `offset` 位移 |
>   | `total` | 1126 | **1205** | **+79** | = 78（环）+ 1（轨道），与上两行逐项对齐 |
>   | `frame0.total` | 970 | **971** | **+1** | 空盘无填格珠 ⇒ 无 `circle` 贡献；**另 sha 变**（五裁字段级改写 180 条，不改条数）|
> - **恒等档孔径核对（与 art 口径对齐，不反向发明数值）**：`size=26` ⇒ pit `r=6` = **真透 ⌀12**、ring `r=7` = **外缘 ⌀14**（`games/beads/design/art/specs/cell-standard.md`）；矩阵档 22 / 30 / 44 ⇒ ⌀10/⌀12、⌀14/⌀16、⌀20/⌀22。机械核对 45/45：`pit ≡ 改前单命令`、`ring = {r: pit_r+1, stroke: e.hole, lineWidth: 1, 无 fill}`。
> - **判据仓裁清单（本轮改了 `bead-style-seal.test.ts`，逐条可追）**：① **文件头**四条腿口径改写（腿 2 指针补记为「比较基自第三次复评起 = `s3.*`」、腿 3 写清两枚串联键形语义、腿 4 改「逐 kind + total + sha 三件」），并**新增「唯一例外通道」注块**（四条件：拍板 / 官方复取器 + 可复现锚 / b2 流级差分未解释 0 / QA 段 + provenance 新键）；原禁令**原文未动**。② **腿 3** 标题改「孔层组（#6 HOLE_RING + #7 HOLE 两枚串联）」并**加 6 条键形自证**（层集长 7、`slice(5)` 长 2、环 stroke-only 无 fill、底无描边有 fill、`size=26` 恒等档 ⌀14/⌀12、`provenance.s3_frame_recheck_5` 必含「第五次复评」+「HOLE_RING」）⇒ 均为**加严**。③ **「差分自洽」例**：`delta.circle − ctrl.circle` 由 `78×−1` 改 **`78×0`**（六裁拆两枚的直接后果，⛔ 非删断言 —— 等式仍逐项钉住）、`totalDelta` 式 `78×(−4−5−1+4)` → `78×(−4−5−0+4)`、纸面锁 `1127` → **`1205`**、**新增** `kinds.circle = 160`。④ **腿 4a** 标题「第三次复评登记」→「第五次复评登记」；**腿 4b** 增校 `recheck_4` 含「第四次复评」、`recheck_5` 含「流级差分」。**⛔ 零删断言、零阈值软化、零恒真、无 env 后门、无跳过绘制开关；用例数 9→9（只增断言不增例）。**
> - **⚠ 上游批流程缺陷登记（P2，本单不修、不背书，转呈主理人）**：`927535c` 提交内已自行重封整帧两键为 `frame0 971/2253472…` · `frame78 1127/b56d5867…`，但其抓取件 `capturedFrom` 指向「`21317d8` + **未提交**工作树（T-218 圆角扇）」⇒ **无 commit 锚、不可复现**（本单用隔离副本逐一验证：`21317d8` 复现的是 `recheck_4` 锁，而非该中间值）；同批又**追改 `head.legacyFlow` 48/96 例**（改变项全部落在 `l6` 半边，机械归因 = `BEAD_CARD.liftShadowFade 0.4→0.55` ⇒ 抬起投影 α `0.09→0.0675`，基数 `BEAD_SHADOW_ALPHA 0.15` 未变，证据 `temp/qa-wxg214-recheck5/{legacy-21317d8.json,legacy-927535c.json,probe-legacy.ts}`）而 **provenance 零新增键** ⇒ 踩 `head.*` 史证段冻结口径（K-053 同族）+ 踩「无登记基准追改」红线。本单按铁律**不追改也不回退 `head.*`**，该 48 例的处置（保留 / 回退 / 迁入史证子段）待裁。**【处置记录 2026-09-28 · 主理人按本单建议③执行】**越界追改已迁入夹具新档案段 `head_liftShadowFade_r5`（48 键 = lift=6 半边，值 ≡ 本单官方重抓的 `s3.legacyFlow` 同键，零手填），`head.legacyFlow` 回补 `927535c^` 史证态 ⇒ 冻结口径恢复；判据腿 1 改以「`head.legacyFlow` ⊕ 该段」合并视图对照并加双向锁（档案值 ≢ 史证值、现役值 ≡ 档案值），归因已追加于 `provenance.s3_frame_recheck_5` 末段。
> - **既存口径差闭合（`K.5.1-补2` 遗留条今日不再成立）**：该条记「复取器 `legacyFlow` 抓 `drawFilledBead`，与判据腿 1 的 `drawLegacyTenBead` 不同源 ⇒ 96 例永不等 `head.legacyFlow`」；现实测复取器已改取 `drawLegacyTenBead`（`bead-style-seal-recapture.ts:45/139`）⇒ 本轮抓取 96/96 **逐字节 ≡ `head.legacyFlow`** ⇒ **工具与判据同源化，该差不存在**（但注意：它 ≡ 的是被上游追改后的 `head.legacyFlow`，见上条）。
> - **本轮取证边界（诚实）**：`[Node]` only。**G1** = `npx tsc --noEmit`（beads，`include` 含 `tests/**`）退出 0；**G2 / G4** = `tests/bead-style-seal.test.ts` **9/9 绿** + 全量 `pnpm --filter beads test` = **732 passed / 4 failed / 55 files**（首跑对照 **729 passed / 7 failed**，差 = seal 三红归零）；**剩余 4 红 = 关卡存量**（`misplaced-assembler` / `levels` BOOT validator / `level-import` / `levels-dir-pipeline`），**非本单引入、不归本单、本单不代翻**。存证：`temp/qa-wxg214-recheck5/{00-test-before-full.txt,20-test-after-full.txt,21-tsc-after.txt,22-check-tasks.txt,23-check-links.txt,24-seal-final.txt,25-test-final-full.txt}`（另含差分器与取证件 `diff-flows.py` / `probe-flows.ts` / `probe-legacy.ts` / `patch-fixture.py` / `flows/` / `tree-*/` / `s3-seal.prev-artifact.json`，目录内 `00-INDEX.txt` 为入口清单）。**红集合逐条对账**（`grep "FAIL  tests"` 去重）：首跑 7 红文件 = {seal, level-import, levels-dir-pipeline, levels, misplaced-assembler}，收口 4 红 = 后四项，**差集 = {bead-style-seal.test.ts} 唯一且方向正确**（无新红）。**⛔ G3 屏幕层与真机层未验**（K-037）：本轮只能证明「命令流几何/墨水与登记一致」，**不能**证明「两枚同心圆在屏上读作真透孔」「1 dp 孔边在低倍率屏不糊」⇒ 归 Playtest（皮肤族 `[待真机]` 项）。
> - **遗留登记（本单不闭）**：① 关卡存量 4 红待关卡批；② ~~腿 4b 的「最强反演闭合」欠账延续~~ **【已闭合 2026-09-28 r10】**：分桶类型化逆变换重建前态流，**逐字节全等（sha256）**：frame0 `970/5c41e321…` PASS · frame78 `1126/1b5c8639…` PASS；探针 = `temp/probe-seal-inversion-closure.mjs`（不入库）；③ `head.legacyFlow` 48 例追改已按建议③处置完毕（迁入 `head_liftShadowFade_r5`，见上缺陷条处置记录，2026-09-28），本条闭合；④ ~~三裁 / 四裁（即 `recheck_3` / `recheck_4`）在本文无 `K.5.1-补` 编号，是否补登归主理人裁定~~ **【已裁定 2026-09-28 r10】**：主理人裁定补登，见 `K.5.1-补4`（recheck_3）和 `K.5.1-补5`（recheck_4）历史追补段；⑤ `config/tuning.ts` 注释仍写「α 衰减（40%）」与现值 `liftShadowFade = 0.55` 漂移（P4 文档侧，归该批改订）；⑥ 恒等档 ⌀12/⌀14 已写进判据（加严面）⇒ `cell-standard` 若再改孔径口径须**同批**复评本判据；⑦ **provenance 键 5 与 `temp/` 内 WIP-T-215 补丁的 `recheck_5/6/7` 同号预约碰撞**（见上「编号口径」条）⇒ 归位批开工前由主理人裁定重编方案，QA 不代改他人登记。**【已归位 2026-09-28】**主理人采纳「建议归位批重编为 `_6/_7/_8`」方案：`temp/bead-relief-compare/wip-215-full-backup.patch` 内预写键 `s3_frame_recheck_5/6/7` 已就地重编为 `_6/_7/_8`（该补丁属本链下游 T-215 自有预约，非他人登记），与已入库键 5 的字面碰撞解除；腿 3 防护断言保留。
>
### K.5.1-补4 整帧基线第三次复评修订（历史追补 · 2026-09-28 r10 补登 · 正本 = provenance `s3_frame_recheck_3`，事件日期 2026-09-26）
>
> - **追补口径声明**：本段对应的第三次复评，其归因正文已写入夹具 `provenance.s3_frame_recheck_3`（2026-09-26 收口当时），但本文 `K.5.1-补` 系列**未建文号**——今由 r10 批按主理人指令裁定补登。**⛔ 史证正文不原地改写**，本段仅指回 provenance 正本并补充文号索引。
> - **变更源**（摘录自 `recheck_3`）：① WXG-T-213 盘带换尺 v1.58 终稿 `yMin` 480→**560**（盘带族 Δ+40，坐标级纯平移）+ 缩放控件 7 条插入段；② WXG-T-214 轮廓可读性批（用户 2026-09-26 拍板）加深 `FACET4_PLATE_MIX` ⇒ facet **非孔层 45/45 墨值漂移**（孔层 45/45 未漂，默认满豆 `hideHole` 不触）；③ `c7d157d` B0 底图/凹槽随格径等比重推 ⇒ 差集超出「插入+纯平移」两类，**腿 4b 反演闭合降级为身份核对**，未登记漂移由腿 4a 字节锁兜住。
> - **层键比较基更替**：`s3.facet{NonHole,Hole}Layers` 比较基自此改指 `s3.*`（转正时点史证移入 `s3AtFormalization` 段，腿 2b 守护）。
> - **收口中止登记**（原文保留不删）：并发会话在抓取后继续写入 ⇒ 本段 frame/层键值已过期，s3 frame 键与非孔登记由后续批次按冻结基线重封；腿 4a 字节锁保证未登记漂移不放行。
> - **可复现锁**：`provenance.s3_frame_recheck_3` 是当时复评的唯一正本，本文不重复写入数值，仅给 `K.5.1-补4` 文号供后续引用时索引。
>
### K.5.1-补5 整帧基线第四次复评修订（历史追补 · 2026-09-28 r10 补登 · 正本 = provenance `s3_frame_recheck_4`，事件日期 2026-09-26）
>
> - **追补口径声明**：第四次复评（cc41aff+合流树）的归因正文已写入 `provenance.s3_frame_recheck_4`，本批同按主理人指令补登，**⛔ 史证正文不改**。
> - **变更源**（摘录自 `recheck_4`）：**合流树** = `c7d157d` 等比 inset + T-213 控件/盘带 + T-247 plate 墨 + S5 换肤链。具体：`head.legacyFlow` 随 `c7d157d` 更新（legacy 路径未改但 inset 共享 ⇒ **坐标级漂移**）；`s3.frame0/frame78` SHA 更新（kind 计数不变、total 不变）；`s3.facet{NonHole,Hole}Layers` 随 inset 等比改 ⇒ 全 45 例重取；`s3AtFormalization` 与 `head.frame{0,78}` **冻结不动**（史证段）。
> - **腿 4b 反演闭合接续欠账**：本段 `recheck_4` 中的 inset 等比漂移属**非插入非平移**类型 ⇒ `recheck_3` 收口中止后登记为欠账；由 r10 批（v1.21 · `K.5.1-补3` 遗留条② 闭合登记）正式闭合（最强形态 = 分桶类型化逆 ⇒ 逐字节 sha256 全等）。
> - **可复现锁**：`provenance.s3_frame_recheck_4` 是当时重封的唯一正本；本文 `K.5.1-补5` 供引用索引，不重复写入数值。
>
### K.5.1-补6 珠体族/整帧基线第六次复评修订（2026-09-29 · WXG-T-229 四扇「甲」案 · 严守真 · 正本 = provenance `s3_frame_recheck_6`）
> 
> - **通道声明（K-082）**：WXG-T-229 属**珠体族视觉改动**（左/右/下三扇墨值）⇒ 封箱腿红为**预期行为**；变更方不自更新基准，**更新权在 QA**。本次用官方复取器 `tests/bead-style-seal-recapture.ts` 重抓（⛔ 非手填、非纸面值、非旧快照回放）。
> - **前态锚 / 现态锚**：前 = `8a32260^`（= `731100c`，实测 frame0 `1331/99f3bc76…` · frame78 `1409/f6cdff1a…`）；现 = `8a32260`（frame0 `1331/99f3bc76…` · frame78 `1409/69cf8800…`）。
> - **本批修订面（一处）**：`s3.facetNonHoleLayers` **45/45 重取**（键形不变）——左扇 `base`→`mix(base, FACET4_FACET_LEFT_MIX −0.08)`、右扇 `FACET4_FACET_RIGHT_MIX −0.16→−0.22`、下扇 `endpoints.edge`→`mix(base, FACET4_FACET_BOTTOM_MIX −0.40)`（**⛔ 不动全局 `edge` 端点**，影响面只限四棱下扇）。
> - **本批对整帧的流级差分（未解释 0 条）**：frame78 1409 条中 **234 条 polygon 的 `fill`/`stroke` 两字段改写**（= 78 填格珠 × 3 扇〔左/右/下〕，上扇 `lit` 未动），**零插入 / 零删除 / 零几何改动** ⇒ `kinds` 与 `total` 逐字不变；**frame0（空盘）前后 sha 全等 ⇒ 本批对空盘帧零贡献**。证据 = `temp/qa-t229/{prev,now}.frame78.txt`（逐行 diff 脚本在 `temp/qa-t229/`）。


> - **⚠ 搭车补登记的存量漂移（非本批，如实登记）**：`s3.frame0` `971/53139dd…`→`1331/99f3bc76…`（**+360**）、`s3.frame78` `1205/e5c00786…`→`1409/…`（**+204**）的 **kind/total** 差**全部**来自 `731100c`（WXG-T-214/221 批，用户 2026-09-28 拍板「槽暂时不做描边 / 增加内边阴影」）：`drawEmptySocket` 由「S2 坑底 rect + S1 暗缘框 rect」**2 枚**改「内阴影阶梯 **4 枚**同心圆角 rect（shadeOuter −0.80 / shadeMid −0.68 / hole −0.58 / pit −0.44）」⇒ **每空槽 +2 rect**。实测两式独立吻合：frame0 `+360 = 2×(156 盘面空槽 + 24 托盘槽)`；frame78 `+204 = 2×(78 空槽 + 24 托盘槽)`。**该批当时未走复评通道** ⇒ 记为 **P2 纪律缺陷**，已开单 **WXG-T-230**；本次按同一官方复取器重抓并入键 6 补登记。
> - **⚠ 未做的差分（诚实登记）**：存量段未做 `731100c^` 的**逐行**流级差分（该步需临时回退 `bead-render.ts`/`tuning.ts`/`palette.ts` 三文件，本轮两次尝试均未获执行许可）⇒ 存量归因强度 = **结构性归因（两式独立吻合）+ 代码侧确认**，弱于本批段的逐行流级差分。解除条件：由归位批或 WXG-T-230 补做逐行差分。
> - **零追改声明（写后逐键机械复核，越界变更键 = 0）**：`head.*`、`s3AtFormalization`、`head_liftShadowFade_r5`、`s3.facetHoleLayer`（45 例，本批 **0 差**）、`s3.legacyFlow`（96 例，本批 **0 差**）、`fixture.*` 参数段**全部不动**。
> - **判据同步（本批红 11 条归因为 10 条「预期红」+ 1 条「判据自身缺陷暴露」）**：`bead-render` 2 条（墨序期望值 → 四档 `mix(base,·)`；「底 rect 不是主体色」的左扇承载登记 → `mix(base,−0.08)`）；`bead-style-ledger` §K.5 行 3/5/6/7 四条（行 5 语义改述为「下扇 = `mix(base, FACET4_FACET_BOTTOM_MIX)`，**已脱钩全局 `edge` 端点**」，并新增 `not.toBe(e.edge)` 钉住脱钩事实；行 3 新增四档**严格单调递减**断言 = **加严**）；`bead-style-pool` TC-STY-09（台面值 `argmax=#fef9f1 25.0% vs base #FDF6E9 0.0%`）+ TC-STY-10 臂 B（**判据自身缺陷暴露**，见下条）；`bead-style-seal` 腿 2（45 键重取）+ 腿 4a/4b（两键重封 + `provenance` 断言）。
> - **⛔ C12 判别力下降登记（本批最值钱的负面结论）**：甲案后 facet 域四扇**全部**是 `mix(base, k)`，`base` 端点本体**不再出现在任一扇** ⇒ C12 认定域内参赛端点色由 3 枚（`lit`/`base`/`edge`）降为 **1 枚（`lit`）**，`base` 占比 24.7% → **0.0%**（近并列偏离 0.2pp → **25.0pp**）。弱读法（断言对象 = ∈ 同族）**未放宽但已实质空转**：它现在只能检出「颜色越界」，检不出占比结构变化。臂 B 的「缩占优层 ⇒ argmax 让位」反证因参赛者 = 1 而**结构上不可能发生**，已重建为「占比必降 + facetPx 必降」，并把退化事实写成**会红的观察断言**（参赛者恢复 ≥2 枚时强制回到让位形态）。**建议**（需主理人拍板，本单不落码）：按 T-228 的 **C12-t** 改**纹理像素 argmax**（跨 tint 与矢量两臂）；tint 臂未落码 ⇒ 本单只裁矢量臂一侧。
> - **⚠ 可辨性观察（P3，未判红，待主理人裁定）**：下扇 `−0.40`（d=0.60）与 `plate −0.44`（d=0.56）仅差 **0.04**（旧下扇 = `edge −0.30` ⇒ 差 0.14）⇒ 珠体**底缘 1dp 描边环**的对比度由约 **1.52:1** 降至约 **1.14:1**（ci=1 奶白实测换算），降幅约 3.5×。判据侧**无既有阈值可引**（⛔ 不代造判据）。若主理人认为不可接受 ⇒ 需回调下扇或加深 plate，并**同批**复评本段。
> - **读数**：`pnpm --filter @wxgame/beads run test` = **736 例 / 4 红 / 732 绿**（4 红 = 关卡存量 `levels` / `misplaced-assembler` / `levels-dir-pipeline` / `level-import`，**全非本单**）；`typecheck` = **0 错**。

### K.5.1-补7 整帧基线第十三次复评修订（2026-10-05 · WXG-T-256 S5′-3 层序 = 视觉裁剪 · 正本 = provenance `s3_frame_recheck_13`）
>
> - **通道声明与流程偏差（⚠ 如实，K-082）**：WXG-T-256 属**整帧非珠体族视觉改动**（容器板 + 三层背景退役）⇒ 封箱腿红为预期。本次重抓由**变更侧（主理人）**执行官方复取器，**未过 QA 之手** ⇒ 与 K-082「更新权在 QA」相悖，**登记为 P3 流程偏差**（不是判据缺陷）；QA 或用户复跑复取器自证等值后即升格为常规登记。⛔ 非手填、非纸面值、非 `capture.sh` 旧快照回放。
> - **编号口径**：本文 `K.5.1-补` 系列与夹具 `provenance.s3_frame_recheck_*` 键号**不一一对应**（`补7` ↔ **键 13**）；键 **8 不存在**（在册键序 `…_6/_7/_9/_10/_11/_12`，缺号为历史事实）；键 7–12（WXG-T-235/236/237/242 各批）当时**未建文号**，本批**不代补他人登记**。引用一律附 provenance 键名。
> - **前态锚 / 现态锚**：前 = `3982e43`（在册夹具：frame0 `1331/73ace06a…` · frame78 `1877/27a4ae91…` · `rect 1007`）；现 = `3982e43 + worktree-delta(WXG-T-256 未提交)` ⇒ ⛔ **不满足「可复现 commit 锚」全义**，解除条件见「未决 ①」。
> - **本批修订面（两处帧 + 一个归因键）**：`s3.frame78.{kinds.rect,total,sha}`（`rect 1007→998` · `total 1877→1868` · sha `d3a57328…`）、`s3.frame0.{total,sha}`（`1331→1322` · sha `0419c9e2…`）、新增 `provenance.s3_frame_recheck_13`。
> - **流级差分归因（未解释 0 条）**：两帧各 **rect −9** = 容器板 **6**（B1–B3 暖光 band 3 + B4 投影 1 + B5 板体 1 + B5b 内凹 1；B6 完成贴纸在封箱夹具态 `clearPanelVisible=false` ⇒ 0 枚）+ 三层背景 **3**（全屏冷沉 1 + 两档同心提亮 2）；`circle / line / text / polygon` Δ **全 = 0**。底色改由**宿主**铺屏（canvas2d `fillRect` / Cocos `backGraphics`）⇒ **不进命令流、不计帧长**。
> - **最强反证**：珠体族零变更 = `legacyFlow` **96/96** 与 `facetNonHoleLayers` / `facetHoleLayer` **45/45** 本次重抓**逐字节等值**（未追改）。
> - **零追改声明**：`head.*`（史证 `frame0 963` / `frame78 1587`）、`s3AtFormalization`（1119）、`head_liftShadowFade_r5`、`s3.legacyFlow` / facet 两族、`fixture.*` 参数段**全部不动**。
> - **判据同步（本批红 3 条全为「预期红」，无判据自身缺陷）**：① `bead-style-seal` 腿 4a（两处帧长差 `- PLATE_BG_RETIRE_FRAME0`）+ 差分自洽（两处公式 `- PLATE_BG_RETIRE_FRAME78` + `total` 锁改 1868）+ 新增**两个分段登记常量**（`rect` 族，⛔ 不并入他段黑箱常数）+ 键 13 三条存在性断言；② `bead-render` ④ **色表锁** `37/fd5a0def780d` → **`34/67c2a2c08a92`**（退役 `GLOW_WARM_HEX / BG_DEPTH_HEX / BG_LIFT_HEX` 三枚，走 art 单口径 = 本单即 art 变更批，见 `assets-spec §1.7/§1.8` 退役条）；③ `tuning` ⑤ 的尺由 `PUZZLE_BAND.yMin − PLATE_OUTSET` 改贴 `PUZZLE_BAND.yMin`（外扩余量随板消失）；④ **`check:a11y` 一次真红**（A5 锚 `glow_warm` 在 `src` 零命中）⇒ 按退役事实把 A5 状态 **✅ 降 ⚠️**、锚改指现役动效常量 `FILL_POP_SCALE_TROUGH`，并同步 `accessibility.md` 矩阵行与 §3 小结（⛔ 未把锚点抹成 `-` 躲检）。
> - **未做的差分（诚实登记）**：未在 HEAD 码上跑「裁剪前 harness 逐帧命令流」与裁剪后做**整帧逐行**对照（帧级差由复取器两态计数与常量删除清单承担）⇒ 归因强度 = **复取器实测 + 结构性归因**，弱于逐行 diff。
> - **读数**：`pnpm -C games/beads test` = **808 passed / 1 skipped（59 文件）**；`typecheck` 0 错 · `cocos:check` 2/2 · `framework:sync:check` 一致（framework 53 + game 47）· `harness:smoke` OK（`rect=129 arc=3412 fill=1569 fillText=12` / `6127 draw commands`）· `verify` **PASS 21 / FAIL 0**（含 `check:a11y` 复绿）。
> - **未决（QA 侧盯办）**：① 复取锚含未提交工作树 ⇒ 提交后复跑自证等值；② **Cocos 端 dc 未读**（本批提交体 1 块 → **2 块**，按 §5.0.3「dc 随载体数相加」静置期可能 **+1**，⛔ 不纸面宣称收益）⇒ 归 ② 真机/harness 复读；③ 去板后观感 `[待真机 / art 校准]`，若 +1 有代价再议 ③ 换相机 `clearColor`（代价 = 色值双真源）。

### K.5.1-补8 整帧基线第十四次复评修订（2026-10-05 · WXG-T-256 S5′-4 底图通道 · 正本 = provenance `s3_frame_recheck_14`）
>
> - **通道声明与流程偏差（⚠ 如实，K-082）**：本批属**整帧非珠体族**改动（托盘「桌面」4 条命令打 `back` 键）⇒ 封箱腿 4a/4b 红为预期。重抓仍由**变更侧（主理人）**跑官方复取器 `tests/bead-style-seal-recapture.ts`（`WXG211_CAPTURE=s3`），**未过 QA 之手** ⇒ 延续 `补7` 的 **P3 流程偏差**登记（⛔ 非手填 / 非纸面值 / 非 `capture.sh` 旧快照回放）。
> - **编号口径**：本文 `K.5.1-补` 系列与夹具 `provenance.s3_frame_recheck_*` 键号**不一一对应**（`补8` ↔ **键 14**）；引用一律附 provenance 键名。
> - **前态锚 / 现态锚**：前 = `3982e43 + worktree-delta(S5′-3)`（在册：frame0 `1322/0419c9e2…` · frame78 `1868/d3a57328…`）；现 = `3982e43 + worktree-delta(S5′-4 未提交)` ⇒ ⛔ 同 `补7`，**不满足「可复现 commit 锚」全义**，解除条件见「未决 ①」。
> - **本批修订面（两处帧 sha + 一个归因键 + 一个前态史证键）**：`s3.frame0.sha` `0419c9e2…` → **`907ea480e5f658e2f199b2a9050cb634861bd1e85cfbd35d9814ab0439893480`**；`s3.frame78.sha` `d3a57328…` → **`537de402576afde80f175a7d8bf71fc29b474a6a30b1add5ffa1376026b31d51`**；新增 `provenance.s3_frame_recheck_14`（归因正本）与前态史证键 **`s3_pre_back_channel`**（锁本批前的两枚 sha，⛔ 不随后续复评漂移）。
> - **流级差分归因（未解释 0 条）**：两帧 `total`（1322 / 1868）与**逐 kind 计数全等**（`rect 998 · circle 160 · line 376 · text 12 · polygon 322` 口径不变）⇒ 本批**不新增 / 不删除图元**，唯一变化 = **4 条命令多一个 `back` 键**（面板底 1 rect + 微拱白瓷影 3 line）。`back` 为**条件展开**，缺省不落键 ⇒ 未打标记者逐字节不变。
> - **闭合自证（本批新形态，QA 判据强度高于「只贴 sha」）**：腿 4a 对现役两帧流机械剥掉每条尾部的 `back` 键（序列化形态 = 逗号 + `"back":true`） ⇒ 所得 sha **逐字节 ≡ `s3_pre_back_channel`** 的两枚前态锁，且带该键的条数 = 登记常量 **`BACK_KEY_LINES = 4`**。⇒ 同时证明三件事：键**只**落在这 4 条、几何**零**改写、**零**删除。任一不实即红（阳性对照：多标 / 漏标 / 改坐标三向均破坏等值）。
> - **最强反证**：珠体族零变更 = `legacyFlow` **96/96** 与 `facetNonHoleLayers` / `facetHoleLayer` **45/45** 本次重抓**逐字节等值**（未追改）。
> - **零追改声明**：`head.*`、`head_liftShadowFade_r5`、`s3AtFormalization`、`s3.legacyFlow` / facet 两族、`fixture.*` 参数段、以及 `补7` 的 `s3_frame_recheck_13` **全部不动**。
> - **判据同步（本批唯一两条红 = 预期红，无判据自身缺陷）**：① `bead-style-seal` 腿 4a/4b 两处 sha ⇒ 走本通道重抓 + 键 14 四条断言 + 闭合自证；② `bead-tint-arm` 的 `trayZone` 块由「反向守卫（托盘恒矢量）」改写为「**方向守卫（同臂）**」四条腿（① 托盘槽缺 `colorIdx` + `trayZone` ⇒ 必命中且该格 0 rect；②③ 盘面两腿不变；④ 托盘珠 ⇒ 必命中且 `polygon = 0`）——⚠ 这是**随用户裁定翻转的判据对象**，⛔ 不是软化（断言数 4 → 4，且方向由「不得命中」变「必须命中」）；③ 框架新增两条：`render-model.test.ts`「`back` 只落显式声明、缺省不落键」+ `cocos-renderer.test.ts`「路由到 `backGraphics` / 未注入回落主层」。
> - **读数**：framework **446 passed / 446** · `pnpm -C games/beads test` **810 passed / 1 skipped（59 文件）** · `typecheck` 0 错 · `framework:sync:check` 一致（framework 53 + game 47）· `cocos:check` 检查 2 / 失败 0 · `check:cocos-mask` **4/4** · `check:size` OK（主包 2918.8 KB，超内部目标 2000 KB 的 ⚠ 为存量）· **`verify` PASS 21 / WARN 0 / SKIP 0 / FAIL 0**。
> - **产物级取证（`[E]` 桌面档，⛔ 不作屏幕层 PASS 证据，K-037）**：web-mobile 产物 · LV1 · Chromium · DPR2。① `carrier=on` 托盘 blit `cell(6,0) n = 24`（S5′-3 时该 cell = 0）；② 关掉 `Graphics` 节点后**面板底仍在** ⇒ 提交体确实换到 `backGraphics`；③ 两段式取回后托盘 2 枚珠在两臂均**完整可见**（月牙缺陷消失）；④ 同态两臂 DC **16 / 16**、Triangle **4029（on） vs 39125（off）**。**未做**：真机（`[R]`）复读与低端机样本。
> - **未决（QA 侧盯办）**：① 复取锚含未提交工作树 ⇒ 提交后按复取器头注官方跑法复跑自证等值（承 `补7` ①）；② 托盘珠在两臂**色相不同**（on = 暗红纹理、off = 亮粉矢量）与盘面两臂既有差异同源 ⇒ 归 art 校准，QA **不判可接受**；③ `back` 为**逐图元**声明，无「桌面级图元必须沉底」的机械门 ⇒ 漏标即月牙复发（登记于 ADR-0030 §5.7 残留 3），是否升为硬门待 `[R]` 批代价读数；④ dc / Triangle 读数为 `[E]` 档，低端机外推禁止。

### K.5.1-补9 整帧基线第十七次复评修订（2026-10-07 · WXG-T-268「暖纸拼豆台」UI 基础色板换值批 · 正本 = provenance `s3_frame_recheck_17`）
>
> - **通道声明与流程偏差（⚠ 如实，K-082）**：本批属**整帧非珠体族**改动（UI 色板五值纯墨改写 + P-1 缩放控件收编）⇒ 封箱腿 4 红为预期。重抓由**变更侧（工程）**跑官方复取器 `tests/bead-style-seal-recapture.ts`（`WXG211_CAPTURE=s3`），**未过 QA 之手** ⇒ 延续 `补7`/`补8` 的 **P3 流程偏差**登记（⛔ 非手填 / 非纸面值 / 非 `capture.sh` 旧快照回放）。
> - **编号口径**：本段 ↔ **键 17**；引用一律附 provenance 键名。
> - **前态锚 / 现态锚**：前 = 换值前工作树（复取 ≡ 现役登记逐字节 MATCH：frame0 `1322/135300071c65…` · frame78 `1868/689a2a1b313f…`，legacyFlow 96 例 + facet 45+45 例零差 ⇒ 基准可复现）；现 = 换值后工作树（frame0 `1322/1e5a240a0f59…` · frame78 `1868/05d358879b61…`）⇒ ⛔ 同 `补7`/`补8`，**不满足「可复现 commit 锚」全义**，提交后须复跑自证等值。
> - **本批修订面**：`s3.frame0.sha` / `s3.frame78.sha` 两键追改（total / 逐 kind 计数全等：`rect 998 · circle 160 · line 376 · text 12 · polygon 322`）；新增归因键 `s3_frame_recheck_17` 与前态史证键 **`s3_pre_ui_268`**（⛔ 不随后续复评漂移）。色表锁 35 条数不变、sha1 `1979d53033a1` → `612ced0aa888`（`bead-render.test.ts` ④，art 单同步快照通道）。
> - **流级差分归因（未解释 0 条）**：两帧各 **15 行改写**（字段级 40 条，全部仅 fill/stroke）：`#FFFFFF→#FFFCF6` ×14（panel 填充族）· `#F7F6FB→#FFFCF6` ×6 + `#D8D5E6→#E6DAC3` ×6（P-1 缩放钮/轨道 slot 族→panel 族）· `#E2DFF0→#E6DAC3` ×2（panel 描边）· `#2A2E43→#8A5B34` ×12（accentPrimary 消费点）。**零插入零删除**。证据：`temp/wxg-t-211-s3/s3-pre-268-frame{0,78}-flow.json` ↔ `s3-frame{0,78}-flow.json`。
> - **最强反证**：珠体族零变更 = `legacyFlow` 96/96 与 `facetNonHoleLayers` / `facetHoleLayer` 45/45 重抓逐字节等值（未追改）；`bg_base` 走宿主铺底通道、不进命令流字节锁域。
> - **零追改声明**：`head.*`、`head_liftShadowFade_r5`、`s3AtFormalization`、`fixture.*`、`s3.legacyFlow` / facet 两族、及 `补7`/`补8` 已登记键**全部不动**。
> - **判据同步**：`bead-style-seal.test.ts` 新增键 17 归因断言 4 条 + `s3_pre_ui_268` 前态锁 5 条（total 全等 + sha 必 ≠，同键 16 口径）；新增 `tests/ui-warm-paper-tokens.test.ts`（消费副本同步门 + art-bible §3.2 B1 [待核] 闭合：textDim on panel 实测 **4.64:1 ≥ 4.5** ✓ + §2 治愈② bg 饱和度 HSB 10.4% ≤ 12% ✓ + 奶白珠 ΔL 5.4% > 4% ✓ + P-1 行为断言）。
> - **未决（QA 侧盯办）**：① 复取锚含未提交工作树 ⇒ 提交后复跑自证（承 `补7` ①）；② 暖底观感（奶白珠 ΔL 5.4% 为 10 色最弱对、wood/赭珠同族 K-2）`[待真机]`，回退杠杆 = `bg_base` 加深 `#EDE2CC` 单 token（K-1）；③ `shadow_ink #3D2E1E` 暖化未随本批（与珠面 L0b 共用墨、属不动项）⇒ 归 EP12-S2 容器语言批新 token。
>
### K.5.1-补10 整帧基线第十八次复评修订（2026-10-07 · EP12-S2 控件语言 + S3 playing 换肤批 · 正本 = provenance `s3_frame_recheck_18`）
>
> - **通道声明与流程偏差（⚠ 如实，K-082）**：本批属**整帧非珠体族**改动（容器语言 T1/T2/T4 落码 + P-3=24 收敛，用户 2026-10-07 拍板），封箱腿 4 红为预期。重抓由**变更侧（工程）**跑官方复取器 `tests/bead-style-seal-recapture.ts`（`WXG211_CAPTURE=s3` + `WXG211_DUMP_FLOW=1`），**未过 QA 之手** ⇒ 延续 `补7`/`补8`/`补9` 的 **P3 流程偏差**登记。
> - **编号口径**：本段 ↔ **键 18**；引用一律附 provenance 键名。
> - **前态锚 / 现态锚**：前 = **HEAD `3e3005f` 隔离副本（git worktree）复取 ≡ 现役登记逐字节 MATCH**（frame0 `1322/1e5a240a0f59…` · frame78 `1868/05d358879b61…`，legacyFlow 96 例 + facet 45+45 例零差 ⇒ 基准可复现，较 `补9` 的「改码前工作树」锚更硬）；现 = 改码后工作树（frame0 `1325/3269d92b5730…` · frame78 `1871/749b3ada8368…`）⇒ ⛔ 仍含未提交工作树（与本批叠加的 handdrawn v2.3 批同树），**不满足「可复现 commit 锚」全义**，提交后须复跑自证等值。
> - **本批修订面**：`s3.frame0` / `s3.frame78` 两键 total+sha+kinds 追改（**计数变更批**：rect 998→1000 · line 376→377 · circle/text/polygon 零变）；新增归因键 `s3_frame_recheck_18` + 台账入账 `recheck-18-ep12-s2s3`（+3/+3）；无新前态史证键（插入型批次，同 `recheck-9`/`recheck-13` 口径）。**色表锁 35 条/`612ced0aa888` → 46 条/`68a4b509bb65`**（11 新 hex + 2 换值，art 单同步快照通道）；`BACK_KEY_LINES` 4→5（托盘投影 rect 走 `back` 桌面通道）；`cool-violet` 肤补 11 枚临时别名 token（零新色相，待 S8 冷调裁定收编）；新增消费面判据 = `ui-warm-paper-tokens.test.ts` [EP12-S2] 块（逐值锁 + playing 帧消费）。
> - **流级差分归因（未解释 0 条）**：两帧同一组 **18 条**（插入 3 + 改写 15）：插入 = ① 托盘投影 rect（back:true）② LV 纸 chip rect 96×48 ③ expand 底缘 line；改写 = 胶囊投影墨 ×1 · 托盘内阴影墨 ×3 · 托盘面描边新增+圆角 18→24 ×1 · expand 面 fill+radius ×1 · ▶/字墨 ×2 · 道具卡投影墨+α ×3 · 道具卡描边 ×3 · LV 标签锚/align ×1。frame78 与 frame0 差集**同为这 18 行** ⇒ 78 颗填格命令逐字节零差异。证据：`temp/wxg-t-211-s3/pre268b-frame{0,78}-flow.json` ↔ `s3-frame{0,78}-flow.json` ↔ `ep12-diff-frame{0,78}.txt`。
> - **最强反证**：珠体族零变更 = `legacyFlow` 96/96 与 facet 两族 45/45 重抓逐字节等值（未追改）；`s3_pre_ui_268` 前态键不漂移（其 total 全等断言改钉「现役 − 登记漂移 3」，判据同步条）。`补9` 未决③（shadow_ink 归 EP12-S2）就此闭合。
> - **判据同步**：`bead-style-seal.test.ts` 新增键 18 归因断言 + `EP12_S2S3_FRAME_DRIFT=3` 登记常数↔台账一一对应 + 差分自洽式 rect/line/total 三处入账；`view-model.test.ts` BD-46 腿改钉 chip 锚；`selection-anchor.test.ts` ①② 两腿 radius 18→24 + 描边判据。
> - **未决（QA 侧盯办）**：① ~~提交后复跑复取器自证等值~~ ✅ **已闭合（2026-10-07 提交后实测）**：本批入 `develop` 三笔（`71e2f0b` mask:diff 挂载 + `2b49177` handdrawn v2.3 + `28df141（初 d97e9ee 经 amend 更正引用）` EP12-S2/S3），干净树官方复取器 `WXG211_CAPTURE=s3` 重抓 ⇒ frame0 `1325/3269d92b…` · frame78 `1871/749b3ada…` · kinds 与 `legacyFlow 96`/`facet 45` 全案 **五键逐字节 MATCH 现役登记**（承 `补7` ①，自此复取锚已满足「可复现 commit 锚」全义）；② cool-violet 新 token 临时别名待 S8 裁定；③ pressed/disabled 态 token 零帧内消费归 S4；④ 暖纸/木钮整盘观感 `[待真机]`（harness 出图仅供工效初审）。

### K.5.1-补11 整帧基线第十九次复评修订（2026-10-17 · EP14-S2 主界面总星数 HUD 最小臂 · 正本 = provenance `s3_frame_recheck_19`）
>
> - **通道声明**：属**整帧非珠体族**插入型改动（`star-collect-rule.md` R6/R8 显示腿，沿 WXG-T-288），封箱腿 4 红为预期；重抓由变更侧（工程）跑官方复取器 `tests/bead-style-seal-recapture.ts`（可再生，K-042），本文只给文号与索引、**不重复写入数值**（沿 `补4/补5` 历史追补口径）。
> - **编号口径**：本段 ↔ **键 19**（键 18 = EP12-S2/S3 控件语言批）；引用一律附 provenance 键名。
> - **前态 / 现态锚**：前 = 现役登记（第十八次产物）frame0 `1325/3269d92b5730…` · frame78 `1871/749b3ada8368…`；现 = commit `dd57c91`（EP14-S2 落码）复取 frame0 `1326/88103412ec6d…` · frame78 `1872/246ef8194961…`。**本批复取锚已在已提交 commit 上**（补齐 `补10` 未决① 同型欠账）。
> - **本批修订面**：`s3.frame0` / `s3.frame78` 两键 total+sha+kinds 追改（**text 12→13**，其余 kind 零变）+ 新增归因键 `s3_frame_recheck_19` + 台账入账 `recheck-19-star-total-hud`（frame0 +1 / frame78 +1）。
> - **流级差分归因（未解释 0 条）**：唯一变化 = 顶栏 HUD 新增 `★n` 一条 `text`（EP14-S2，`view-model.ts::drawHud`）⇒ 两帧各 +1；无改写、无删除。
> - **最强反证**：珠体族零变更 = `legacyFlow` 96/96 与 facet 两族 45/45 重抓逐字节等值（未追改）；三笔前态史证键（`s3_pre_tray_261` / `261b` / `s3_pre_ui_268`）不漂移，其 total 全等断言改钉「现役 − 第十八批 3 − 第十九批 1」（判据同步条）。
> - **判据同步**：`bead-style-seal.test.ts` 新增键 19 归因三条断言 + 登记常数 `EP14_S2_STAR_HUD=1` ↔ 台账一一对应 + 帧长差/差分自洽/`delta.text` 三处入账（⛔ 未并入既有黑箱常数，逐段独立登记）。新测 `tests/stars-total-hud.test.ts` 五臂（★0 起始 / 两关 Σ=6 / 同关重玩低星不涨反例 / 顶栏落位净空 / 零分配静态门）。
> - **未决（QA 侧盯办）**：① 分母形态 `★n/27` 与总星数落位定稿 = `[待 UX 批]`（`star-collect-rule §6-T1`）⇒ EP14-S4 开工时若改写 HUD 需**同批**再复评；② `game.starsByLevelRaw` 为稠密数组、长度 = 关池 ⇒ 新增关池变长会自然括入 Σ（属 R6 口径，若后续要按大关分母需新开判据）；③ 本臂真机观感 `[待真机]`（顶栏拥挤度与 E2 大字号档）。

### K.6 `06` 珐琅 —— **只登记出池门引用，本批不造判据**（Q1 = 甲）
>
> | 引用项 | 内容 | 出处 | QA 处置 |
> |---|---|---|---|
> | 出池四条前置 | **P-1 承载层选型 / P-2 三系数重推（禁沿用）/ P-3 底图同源复测 / P-4 门禁与差分** | `assets-spec §1.9.7 7.13` | **不重写、不代判**；步 6 开工前由主理人核对四条齐备 |
> | 三系数 | `BEAD_BEVEL_LIGHT_MIX` / `BEAD_RIM_MIX` / `rimWidth` → **全 `[TODO]`，禁预填** | 7.13 系数表 | 本文**一律 `[待定·不判]`**；任何批次"顺手补上"= 绕过真机门（7.13 ⛔禁令 ③ 原文）⇒ 若发现预填，QA 登记为 **P1 流程缺陷** |
> | A/B 规程与判据 ①–⑤ | 素人「金属边」≥4/5、奶白/炭黑两端各判一次、主色识别不降、B0 读数不受影响、实测两数打印 | 7.13 第 3 项 | 属真机 Playtest 取证，归 **`playtest-plan.md` 皮肤族 `[待真机]` 项**；本节**不建硬判据** |
> | ⚠ **口径冲突登记** | 7.13 判据 ③ 原文含「**= C12 强读法亦须过**」 | 7.13 ↔ K.0c | **强读法作废 ⇒ 该行需 art 侧订正**；在订正前，06 出池门与本节 K.0c **不得同时引用**（互斥）。列 **K.7 残留 ①**，本单不代改他人正本 |
>
### K.7 本节残留与回改触发器（诚实登记，不得被"已建例"掩盖）
> ① `assets-spec 7.13` 判据 ③ 的「C12 强读法」引用行需 art 订正（K.6）；② C12 弱读的**机械式两式并存**（主理人口述 vs E 单 7.10 ⑦ 字面），待 §12.2 落笔钉死 ⇒ 触发 **TC-STY-09/10 回改**；③ `7.10 ⑨ (a)`「凸/凹明暗方向是否升为**可机检硬门**」的**措辞权在 §12**（art 已明写不代判）⇒ TC-SKT-01 若被 §12 降为"仅登记"，其门禁地位由**本 QA 侧保留**（判据红线属 QA，不属 art）；④ D4 孔双口径未择一（K.5 行 11）；⑤ `PAUSE_PANEL_H`（现 600，四行）五行所需扩容值 `[待定]` ⇒ **本节不判面板高度**，但步 5 落码时**行重叠 / 胶囊避让须复用 `S9 §8-5` 既有判据**（≥88×88 且不侵入 `CAPSULE_AVOID`），不得因扩容而豁免；⑥ 玩家侧文案「标准/小巧」映射 ⇒ **QA 一律按档枚举断言、不按显示字面**（`ux §3.3` 文案映射表口径）。


