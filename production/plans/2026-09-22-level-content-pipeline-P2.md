# 关卡内容管线 P2（切块产 Plate + 目录模式入关）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 executing-plans 逐任务实现（本计划按方法 A：inline + CodeReview 评审门）。步骤用 `- [ ]` 跟踪。

**Goal:** 让 beads-studio「一键入关」在 P1 目录化真源上复活：≤50 关写成 `singles/L00NN.json`；任一维 >50 的母版按纯尺寸均分算法切成 `plates/P00NN.json`（含 N 个 Cell-Level），每格时长走 beads-bot 真引擎实测，追加 `manifest.json` entry 并 `contentVersion++`。

**Architecture:** 新增两个纯 Node 库 `level-slice.mjs`（母版 pattern/misplaced → cells[]）与 `level-store.mjs`（manifest 读写 + uid 分配 + 落盘），`server.mjs` 的 `ingestLevel` 改为目录模式编排器（切块→逐格实测→写文件→追加 manifest→跑 sync，失败回滚）。sync 装配器补 Plate 展开校验。守卫负例测试接 fast selftests。

**Tech Stack:** Node ESM · vitest · beads-bot（`--experimental-transform-types`）· 无新依赖。

**Spec:** `games/beads/design/proposals/level-content-pipeline.md`（§0 切块算法 / §1 数据模型 / §5 studio 改造 / §9 v0.2）。

## Global Constraints

- **切块算法（spec §0，逐字）**：每方向 `k=ceil(n/GRID_MAX)`，`base=floor(n/k)`，余数 `rem=n-base*k` 加到**末尾 rem 块**各 +1；横纵各算一次。`GRID_MAX=50`（引 §3.3，不新定义常量值）。验证：51→[25,26]，100→[50,50]，101→[33,34,34]。
- **每格必为合法 BeadsLevelRaw**：cell 尺寸 ∈ [6,50]×[5,50]、过 `validateBeadsLevel`、过 beads-bot 可解性与 blocker 判定；任一格 blockers 非空 ⇒ **整板拒收**（不留半成品）。
- **time 真引擎实测**：plate 每 cell 的 `time` 来自 beads-bot（喂 `{levels:[...cells]}` 一次跑，逐格取 `time`）；**不回落静态估算**（v1.41 红线）。bot 不可用 ⇒ 500 拒收。
- **不伪造资产**：Plate **不产栅格 `sourcePreview`**（P2-C 裁定）；预览由选关页从 cells 合成（属 P3/游戏侧，不在本计划）。plate 文件只存 `{plateUid,name,gridCols,gridRows,cells[]}`。
- **uid 稳定 + 数字 id 并存**：`uid`（`L00NN`/`P00NN`，零填充 4 位）只进 manifest/文件名；cell 与 single 对象仍带唯一数字 `id`（进 `LEVELS_DATA.levels`，运行时/存档用）。数字 id = 现有 levels 最大 id + 递增。
- **增量不破序**：只**追加** manifest entry（`order = max+1`）、`contentVersion++`；老 entry 字节不动。
- **回滚**：写盘后 `sync-levels-data` 或 `sync-framework-to-cocos` 失败 ⇒ 还原所有新增/改动的真源文件与 manifest，重跑 sync 回旧版。
- **脏文件隔离 + 共享文件预检**：P2 合法触碰 `package.json`/`selftests.mjs`（接守卫自测）——**改前 `git status` 确认其未被并发会话占用**；被占用则本计划登记延后，不抢改。
- **commitlint**：scope=`beads`、含 `WXG-T-185`、header≤100、无句号。
- **产物门禁**：每步以 `pnpm run levels:check` 收口；最终 `pnpm run verify` 全绿。

---

## 文件结构

| 动作 | 路径 | 职责 |
|---|---|---|
| Create | `tools/scripts/level-slice.mjs` | 纯函数：母版 `(pattern[], misplaced[]?, cols, rows)` → `{gridCols,gridRows,cells[]}`；均分切块算法 |
| Create | `tools/scripts/level-store.mjs` | 纯逻辑：manifest 读/追加、uid 分配、single/plate 落盘对象构造（无副作用的构造 + 薄写盘） |
| Create | `tools/scripts/level-slice.test.mjs`（或并入 beads tests） | 切块算法单测 |
| Create | `tools/scripts/level-store.test.mjs` | uid/manifest/回滚构造单测 |
| Create | `tools/scripts/sync-levels-data-selftest.mjs` | 装配器守卫负例（kind/pack/dup/orphan/order/plate 校验）→ exit 0/1 |
| Modify | `apps/beads-studio/server.mjs` | `ingestLevel` 目录模式重写（删 501 桩）；`importBlockers` >50 语义改「走 plate」 |
| Modify | `tools/scripts/sync-levels-data.mjs` | `assembleFromManifest` 加 Plate 展开校验（cells 数/尺寸/cellPos 覆盖） |
| Modify | `games/beads/tests/levels-dir-pipeline.test.ts` | levels 数断言改 Plate-aware（`>= entries`） |
| Modify | `package.json` + `tools/scripts/selftests.mjs` | 注册 `levels:sync:selftest` 进 fast 档（完整性守卫要求两处一致） |

---

## Task 1: level-slice.mjs（切块纯函数 + 单测）

**Interfaces:**
- Produces: `sliceBoard({ pattern, misplaced?, cols, rows, gridMax = 50 }) => { gridCols, gridRows, cells: [{ row, col, cols, rows, pattern, misplaced? }] }`。
  - `pattern`/`misplaced` = rowstring 数组（长 = rows，每个长 = cols）。cell 的 `pattern`/`misplaced` 为对应行段子矩形裁剪。
  - `cells` 序：行优先（r 外层、c 内层），`row=0..gridRows-1`、`col=0..gridCols-1`。
- Consumes：仅入参，无 IO/依赖。

- [ ] **Step 1: 写失败单测**（切块算法 + 裁剪）

```js
// tools/scripts/level-slice.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitRuns, sliceBoard } from './level-slice.mjs';

test('splitRuns 均分：余数加末尾', () => {
  assert.deepEqual(splitRuns(51, 50), [25, 26]);
  assert.deepEqual(splitRuns(100, 50), [50, 50]);
  assert.deepEqual(splitRuns(101, 50), [33, 34, 34]);
  assert.deepEqual(splitRuns(50, 50), [50]);
});

test('sliceBoard 51×51 → 2×2，每格 ≤50 且子矩形对齐', () => {
  const cols = 51, rows = 51;
  const pattern = Array.from({ length: rows }, (_, r) => '1'.repeat(cols)); // 占位满色
  const { gridCols, gridRows, cells } = sliceBoard({ pattern, cols, rows, gridMax: 50 });
  assert.equal(gridCols, 2); assert.equal(gridRows, 2);
  assert.equal(cells.length, 4);
  // 行宽/列高 = [25,26]
  assert.deepEqual(cells.map(c => c.cols), [25, 26, 25, 26]);
  assert.deepEqual(cells.map(c => c.rows), [25, 25, 26, 26]);
  for (const c of cells) {
    assert.ok(c.cols <= 50 && c.rows <= 50);
    assert.equal(c.pattern.length, c.rows);
    for (const line of c.pattern) assert.equal(line.length, c.cols);
  }
});

test('sliceBoard 裁剪 misplaced 与 pattern 同格对齐', () => {
  const cols = 51, rows = 25; // cols>50 触发横切，rows 不切
  const pattern = Array.from({ length: rows }, () => '2'.repeat(cols));
  const misplaced = Array.from({ length: rows }, () => '1'.repeat(cols));
  const { cells } = sliceBoard({ pattern, misplaced, cols, rows, gridMax: 50 });
  assert.equal(cells.length, 2);
  assert.equal(cells[0].misplaced[0], '1'.repeat(25));
  assert.equal(cells[1].misplaced[0], '1'.repeat(26));
});
```

- [ ] **Step 2: 跑，确认 FAIL**（模块不存在）。Run: `node --test tools/scripts/level-slice.test.mjs`

- [ ] **Step 3: 实现 `level-slice.mjs`**

```js
#!/usr/bin/env node
/**
 * level-slice.mjs — 母版图案按纯尺寸均分切块（关卡内容管线 P2，spec §0）。
 * 每方向：k=ceil(n/gridMax)，base=floor(n/k)，余数加末尾 rem 块各 +1（保证每块 ≤ gridMax）。
 * 纯函数，无 IO。pattern/misplaced 为 rowstring 数组。
 */
/** 一维均分：返回各块长度（和 === n，每项 ≤ gridMax，余数加末尾）。 */
export function splitRuns(n, gridMax) {
  const k = Math.max(1, Math.ceil(n / gridMax));
  const base = Math.floor(n / k);
  const rem = n - base * k;
  return Array.from({ length: k }, (_, i) => base + (i >= k - rem ? 1 : 0));
}

/** 母版 → { gridCols, gridRows, cells:[{row,col,cols,rows,pattern,misplaced?}] }，行优先序。 */
export function sliceBoard({ pattern, misplaced, cols, rows, gridMax = 50 }) {
  const colRuns = splitRuns(cols, gridMax);
  const rowRuns = splitRuns(rows, gridMax); // 纵横向同一均分规则（≤50 自然不切）
  const cells = [];
  let rowOffset = 0;
  for (let r = 0; r < rowRuns.length; r++) {
    let colOffset = 0;
    for (let c = 0; c < colRuns.length; c++) {
      const w = colRuns[c], h = rowRuns[r];
      const sub = pattern.slice(rowOffset, rowOffset + h).map((line) => line.slice(colOffset, colOffset + w));
      const cell = { row: r, col: c, cols: w, rows: h, pattern: sub };
      if (Array.isArray(misplaced)) {
        cell.misplaced = misplaced.slice(rowOffset, rowOffset + h).map((line) => line.slice(colOffset, colOffset + w));
      }
      cells.push(cell);
      colOffset += w;
    }
    rowOffset += h;
  }
  return { gridCols: colRuns.length, gridRows: rowRuns.length, cells };
}
```

- [ ] **Step 4: 跑，PASS**。Run: `node --test tools/scripts/level-slice.test.mjs`

- [ ] **Step 5: 提交**（连同 Task 2 前）`git add tools/scripts/level-slice.mjs tools/scripts/level-slice.test.mjs`（提交动作并入 Task 5 统一；本步仅暂存意图，实际 commit 见 Task 5）。

---

## Task 2: level-store.mjs（manifest 读写 / uid 分配 / 落盘对象构造）

**Interfaces:**
- Produces:
  - `readManifest(levelsDir) => {schemaVersion,contentVersion,gameId,description?,paletteFile,entries[]}`
  - `nextNumericId(levelsDir, manifest) => max(所有现有 levels[].id) + 1`（读 singles 现有 id + plate cells id）
  - `assignUid(kind, existingUids) => 'L'+pad(n)` 或 `'P'+pad(n)`（取该 kind 现有最大号 +1，零填充 4）
  - `buildSingleFile({ level }) => level`（即 BeadsLevelRaw，原样）
  - `buildPlateFile({ plateUid, name, gridCols, gridRows, cells }) => {plateUid,name,gridCols,gridRows,cells}`
  - `appendEntry(manifest, entry) => {...manifest, contentVersion: manifest.contentVersion + 1, entries: [...entries, {...entry, order: maxOrder+1}]}`
  - `writeLevelFile(levelsDir, relFile, obj)` / `writeManifest(levelsDir, manifest)`（薄 IO）
- Consumes: 文件系统真源。

- [ ] **Step 1: 写单测**（临时目录；uid 续号、order 追加、contentVersion++、数字 id 跳 plate cells）

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assignUid, nextNumericId, appendEntry } from './level-store.mjs';

test('assignUid 取现有最大号 +1', () => {
  assert.equal(assignUid('single', new Set(['L0001','L0009'])), 'L0010');
  assert.equal(assignUid('plate', new Set(['P0003'])), 'P0004');
  assert.equal(assignUid('single', new Set()), 'L0001');
});
test('appendEntry 只追加、order 续、contentVersion++', () => {
  const m = { contentVersion: 3, entries: [{ uid:'L0001', kind:'single', file:'singles/L0001.json', pack:'main', order:1 }] };
  const n = appendEntry(m, { uid:'L0002', kind:'single', file:'singles/L0002.json', pack:'main' });
  assert.equal(n.entries.length, 2);
  assert.equal(n.entries[1].order, 2);
  assert.equal(n.contentVersion, 4);
  assert.deepEqual(n.entries[0], m.entries[0]); // 老 entry 不动
});
```

- [ ] **Step 2: 跑 FAIL**。Run: `node --test tools/scripts/level-store.test.mjs`
- [ ] **Step 3: 实现 `level-store.mjs`**（按上面签名；`nextNumericId` 读 manifest 各 file：single 取 `obj.id`，plate 取 `max(cell.id)`；`assignUid` 用正则 `/^([LP])(\d{4})$/` 扫现有 uid 集取同种最大 +1）。
- [ ] **Step 4: 跑 PASS**。
- [ ] **Step 5:（提交并入 Task 5）**

---

## Task 3: server.mjs `ingestLevel` 目录模式重写 + importBlockers 语义

**Interfaces:**
- Consumes: `sliceBoard` / `level-store` / 现有 `measureWithBot`（改为可喂 `{levels:[...]}`）。
- Produces: `ingestLevel` 走目录模式；删 501 桩。

- [ ] **Step 1: 改 `importBlockers`**：`cols/rows > 50` 不再是 blocker（改由 plate 路径承载）；仅保留「异常小」「用色 >10」「无 pattern」等。≤50 → single；>50 → plate（切块）。注释标 spec §0。

- [ ] **Step 2: 加 `measureCells(cells)`**：构造 `tmpLevels = {levels: cells.map(c => ({ ...c, time: 0 }))}`（cell 已含 pattern/misplaced/cols/rows/decoys/palette?/paletteCodes?），写临时 `{levels}` JSON 文件，`spawnSync` beads-bot 指向它（bot `Array.isArray(doc.levels)` 分支），解析 stdout 末行**数组**，逐格回填 `time` 并收集 blockers；任一格 `blockers` 非空或 `cleared!==true` ⇒ 返回失败。临时文件 `finally` 删。

- [ ] **Step 3: 重写 `ingestLevel` 目录分支**（替换 501 桩 + 旧单文件写入）：

```
1. 读 manifest；取现有 uid 集、数字 id 水位。
2. 组 base level 字段（沿用现逻辑：name、decoys、pattern、misplaced?、palette/paletteCodes?、cycleProfile:'short'）。
3. if (cols<=50 && rows<=50):  // single
     uid=assignUid('single'); level.id=nextNumericId();
     time = 现有单关实测（measureWithBot 或 measureCells([level])[0]）; blockers 非空 → 422;
     写 singles/<uid>.json; manifest=appendEntry({uid,kind:'single',file:'singles/..',pack:'main'});
     快照 before = {manifest 文本, (无旧文件)};
   else:  // plate
     {gridCols,gridRows,cells}=sliceBoard({pattern,misplaced?,cols,rows,gridMax:50});
     每 cell 赋 id（nextNumericId 递增）+ name=`${plateName}-${r}${c}`;
     measured=measureCells(cells); 任一格不过 → 422（整板拒收，不写盘）;
     回填各 cell.time;
     plateUid=assignUid('plate'); plate=buildPlateFile({plateUid,name:plateName,gridCols,gridRows,cells});
     写 plates/<plateUid>.json; manifest=appendEntry({uid:plateUid,kind:'plate',file:'plates/..',pack:'main'});
4. writeManifest（contentVersion++）;
5. runSync()（sync-levels-data + sync-framework-to-cocos）; 失败 → 还原新增文件 + manifest 快照，重跑 sync，返回 500;
6. 200 { ingested: uid, kind, cells?:N, note:'harness 即时可玩；git 审 diff 后提交' }。
```
> 回滚：记录「本次新建的文件路径清单 + 改动前 manifest 原文」；失败删除新建文件 + 写回 manifest 原文 + runSync()。

- [ ] **Step 4: 手工冒烟（本地，需 beads-bot）**：起 studio（`node apps/beads-studio/server.mjs`，本地仓模式），对一个 ≤50 生成结果点「入关」→ 期望写 `singles/L0010.json` + manifest +1、`levels:check` 绿；对 >50（如 60×60）→ 期望写 `plates/P0001.json`（含 4 cells）、manifest 追加 plate entry、sync 展开 4 格进产物。若 bot/环境不可用，标注阻塞并至少跑 Task 4 的合成 fixture 验证装配。
- [ ] **Step 5:（提交并入 Task 5）**

---

## Task 4: sync Plate 展开校验（收 P1 parked #2）+ P1 测试 Plate-aware + 守卫负例接 CI

- [ ] **Step 1: `assembleFromManifest` plate 分支加校验**（替换 `if (e.kind==='plate') for (const c of obj.cells) levels.push(c);`）：

```js
    if (e.kind === 'plate') {
      const want = obj.gridCols * obj.gridRows;
      if (!Array.isArray(obj.cells) || obj.cells.length !== want)
        throw new Error(`${game.name}: plate ${e.uid} cells=${obj.cells?.length} ≠ gridCols*gridRows=${want}`);
      const seenPos = new Set();
      for (const c of obj.cells) {
        if (c.cols > 50 || c.rows > 50)
          throw new Error(`${game.name}: plate ${e.uid} 子格 ${c.row},${c.col} 超 GRID_MAX(50)`);
        const pos = `${c.row},${c.col}`;
        if (seenPos.has(pos)) throw new Error(`${game.name}: plate ${e.uid} cellPos 重复 ${pos}`);
        seenPos.add(pos);
        levels.push(c);
      }
      for (let r = 0; r < obj.gridRows; r++) for (let cc = 0; cc < obj.gridCols; cc++)
        if (!seenPos.has(`${r},${cc}`)) throw new Error(`${game.name}: plate ${e.uid} 缺 cellPos ${r},${cc}`);
    } else levels.push(obj);
```

- [ ] **Step 2: P1 测试 Plate-aware**：`levels-dir-pipeline.test.ts` 把 `d.levels.length === entries.length` 改为「按 manifest 算期望」：`singles 各 1 + plate 各 cells.length`（读 plate 文件求和）。当前无 plate → 仍等；加 plate 后不破。

- [ ] **Step 3: 守卫负例自测** `tools/scripts/sync-levels-data-selftest.mjs`：临时目录构造 bad manifest，动态 `import('./sync-levels-data.mjs')` 调 `assembleFromManifest`，断言各坏例 **throw**：kind=Plate 大写 / pack=sub-01 / 文件重复引用 / 孤儿 / order 非递增 / plate cells≠grid / cell>50 / cellPos 缺。全通过 `exit 0`，任一未拦 `exit 1`。

- [ ] **Step 4: 接 fast selftests（先 `git status` 确认 `package.json`/`selftests.mjs` 干净，被占用则登记延后）**：
  - `package.json` scripts 加 `"levels:sync:selftest": "node tools/scripts/sync-levels-data-selftest.mjs"`。
  - `selftests.mjs` `TIERS.fast` 加 `{ script: 'levels:sync:selftest', argv: ['node', `${S}/sync-levels-data-selftest.mjs`] }`（完整性守卫要求两处同名一致）。
  - Run: `pnpm run selftest:fast` → 新项 PASS 且守卫不报「未入档」。

- [ ] **Step 5: 全量** `pnpm run verify` 全绿。

---

## Task 5: 提交（脏文件隔离）

- [ ] 确认 `git status`：本计划改动仅 `level-slice.mjs`/`.test`、`level-store.mjs`/`.test`、`selftest.mjs`、`server.mjs`、`sync-levels-data.mjs`、`levels-dir-pipeline.test.ts`、`package.json`、`selftests.mjs`（+ 冒烟若真入关则含新增 singles/plate + manifest + 再生产物 + 镜像）。外来电游文件不纳。
- [ ] 逻辑分批 commit：
  1. `feat(beads): level-slice 均分切块纯函数 + 单测 (WXG-T-185)`
  2. `feat(beads): level-store manifest 追加/uid 分配 + 单测 (WXG-T-185)`
  3. `feat(beads): studio 一键入关目录模式 + plate 切块逐格实测 (WXG-T-185)`
  4. `test(beads): plate 展开校验 + 装配守卫负例接 fast selftests (WXG-T-185)`
- [ ] 每 commit 前 `pnpm run verify`（或至少 levels:check + 相关测试）。pre-commit 镜像门：若动了 `src/config/levels-data.ts`（真入了关）须 `framework:sync` 一并暂存。

---

## Self-Review

1. **Spec 覆盖**：§0 切块（T1）✓ / §1 plate 模型（T2/T3）✓ / §5 studio 改造（T3）✓ / §3-4 plate 校验（T4，收 parked #2）✓ / §7-6 ingest 契约（T3）✓ / 守卫负例接 CI（T4，收 P1 parked #1）✓。选关多宫 UI / 图鉴 / 分包 **有意排除**（spec §8/§6 归 P3+）。
2. **占位**：无 TBD；T3 Step4 明记「bot/环境不可用则标注阻塞 + 退到 T4 合成 fixture」，是环境事实非占位。
3. **类型/签名一致**：`splitRuns`/`sliceBoard` 产 `cells[].{row,col,cols,rows,pattern,misplaced?}` = T3 构造 level 字段 = T4 plate 校验读的 `c.cols/c.row/c.col`；`appendEntry`/`assignUid`/`nextNumericId` 签名 T2 产 = T3 用；manifest `entry{uid,kind,file,pack,order}` 与 P1 现有结构一致。
