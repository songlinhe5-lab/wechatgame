# 关卡内容管线 P1（目录化真源 + manifest 驱动 sync）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 subagent-driven-development 或 executing-plans 逐任务实现。步骤用 `- [ ]` 跟踪。

**Goal:** 把 beads 关卡真源从「单文件 `levels-01-08.json`」迁移为「`manifest.json` + `palette.json` + `singles/` + `plates/`（空）」目录化结构，并把 `sync-levels-data.mjs` 改造成 manifest 驱动装配，**产物 `levels-data.ts` 数据体逐字节不变**（零行为漂移）。

**Architecture:** sync 新增「目录模式」——检测到 `design/levels/manifest.json` 即按 manifest `order` 展开装配出与今天同形的 `LevelsData` 对象；否则保留「单 JSON 模式」（breakout 原样）。断言④由「恰 1 JSON」放宽为「manifest 模式 或 单 JSON 模式，二选一」。uid 只活在 manifest 层（entry↔file↔order），**不注入关卡对象**，以保产物字节稳定。

**Tech Stack:** Node ESM（`tools/scripts/*.mjs`）· vitest · 无新依赖。

**Spec:** `games/beads/design/proposals/level-content-pipeline.md`（本计划实现其 §1/§2/§3 + §6 的 P1；**§3 产物乙「分片」经用户 2026-09-22 同意延至 P3**，P1 单份装配）。

## Global Constraints

- **产物零数据漂移**：迁移+改造后，`export const LEVELS_DATA: LevelsData = {...}` 的**对象体**必须与迁移前逐字节一致（仅允许 GENERATED 头部注释更新）。
- **不伤 breakout**：`games/breakout/design/levels/levels-01-05.json` 单 JSON 模式行为不变。
- **真源唯一性不破**：K-031 族纪律——manifest 为关卡唯一顺序真源；漏项/孤儿/歧义必须 exit 1，不静默报绿。
- **L2/L3/L5 不破**：P1 全在 `tools/scripts/**` 与 `design/levels/**` 真源 + 生成物；不改 `core`、不改 `src` 逻辑（仅再生成 `levels-data.ts`）。
- **Cocos 镜像**：改到 `games/beads/src/config/levels-data.ts` 后必须 `pnpm run framework:sync` 并一并暂存 `games/beads/cocos/assets/scripts/`（pre-commit 门 ①⁷⁄₈）。
- **冻结量禁改**：`DEMO_LEVEL_COUNT` / `GRID_MAX` 等 §3 冻结常量本计划**不动**（关卡数仍 ≤ 现值；变更单归 spec §7，另行主理人流程）。
- **关卡数以实存为准**：当前 9 关（8 demo + 1 studio），不硬编码「8/10」。
- **commitlint**：type/scope 合法、header ≤100、含 `WXG-T-185`、subject 无句号。

---

## 文件结构

| 动作 | 路径 | 职责 |
|---|---|---|
| Create | `games/beads/design/levels/manifest.json` | 关卡唯一顺序真源：schemaVersion/contentVersion/gameId/description/paletteFile + entries[uid,kind,file,pack,order] |
| Create | `games/beads/design/levels/palette.json` | demo 十色板（原顶层 `palette` 抽出） |
| Create | `games/beads/design/levels/singles/L0001.json … L0009.json` | 一关一文件；内容 = 原 `levels[i]` 逐字段原样（**不加 uid**） |
| Create | `games/beads/design/levels/plates/README.md` | 空占位（P2 才产 Plate）；防 git 丢空目录 |
| Create | `tools/scripts/migrate-levels-to-dir.mjs` | 一次性迁移：读旧 json → 写上述真源（保键序） |
| Create | `games/beads/tests/levels-dir-sync.test.ts` | sync 目录模式/断言/兼容/漂移 单测 |
| Modify | `tools/scripts/sync-levels-data.mjs` | 目录模式装配 + 断言④放宽 + legacy 保留 + 头部/help |
| Modify | `games/beads/design/levels/levels-data.header.txt` | GENERATED 头部「Source of truth」指针改指目录模式 |
| Regenerate | `games/beads/src/config/levels-data.ts`（+ cocos 镜像） | sync 产物（数据体不变） |
| Delete | `games/beads/design/levels/levels-01-08.json` | 迁移完成后移除 |

---

## Task 1: 迁移真源为目录结构（保产物字节稳定）

**Files:**
- Create: `tools/scripts/migrate-levels-to-dir.mjs`
- Test: `games/beads/tests/levels-dir-sync.test.ts`（本任务先落快照与结构断言）

**Interfaces:**
- Consumes: `games/beads/design/levels/levels-01-08.json`（现网真源，含 version/gameId/palette/description/levels[]）。
- Produces: `manifest.json`、`palette.json`、`singles/L00NN.json`、`plates/README.md`；`entry.uid = "L" + String(oldId).padStart(4,"0")`，`order = 旧数组序（1-based）`，`pack = "main"`，`kind = "single"`。

- [ ] **Step 1: 冻结「迁移前产物数据体」为期望快照**

先跑一次现网 sync 确保 `src/config/levels-data.ts` 与真源一致，然后取对象体（`export const LEVELS_DATA` 之后到文件末）存为测试内联快照基准：

```bash
cd games/beads && node ../../tools/scripts/sync-levels-data.mjs --game=beads
# 取数据体（GENERATED 头部之后）作为期望
awk '/^export const LEVELS_DATA/{p=1} p' src/config/levels-data.ts > /tmp/levels-body.snapshot
node -e "const s=require('fs').readFileSync('/tmp/levels-body.snapshot','utf8');process.stdout.write(JSON.stringify(s))" > /tmp/levels-body.json
```

- [ ] **Step 2: 写迁移脚本**

`tools/scripts/migrate-levels-to-dir.mjs`：

```js
#!/usr/bin/env node
// 一次性：levels-01-08.json → manifest.json + palette.json + singles/ + plates/
// 键序：每关对象原样保留（JSON.parse 保序）；顶层装配序由 sync 侧固定。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = join(dirname(fileURLToPath(import.meta.url)), '../../games/beads/design/levels');
const src = JSON.parse(readFileSync(join(dir, 'levels-01-08.json'), 'utf8'));
const uid = (id) => 'L' + String(id).padStart(4, '0');
mkdirSync(join(dir, 'singles'), { recursive: true });
mkdirSync(join(dir, 'plates'), { recursive: true });
writeFileSync(join(dir, 'palette.json'), JSON.stringify({ palette: src.palette }, null, 2) + '\n');
src.levels.forEach((lv, i) => {
  const name = uid(lv.id);
  writeFileSync(join(dir, 'singles', `${name}.json`), JSON.stringify(lv, null, 2) + '\n');
});
const manifest = {
  schemaVersion: src.version,        // → LEVELS_DATA.version（保持 2）
  contentVersion: 1,                 // 增量计数（P2/B 用）
  gameId: src.gameId,
  description: src.description,
  paletteFile: 'palette.json',
  entries: src.levels.map((lv, i) => ({
    uid: uid(lv.id), kind: 'single', file: `singles/${uid(lv.id)}.json`, pack: 'main', order: i + 1,
  })),
};
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(dir, 'plates', 'README.md'), '# 组合图（Plate）真源占位\n\nP2 由 studio 均分切块产出；P1 无 Plate 数据。\n');
console.log(`迁移完成：${src.levels.length} 关 → singles/；palette.json；manifest.json`);
```

- [ ] **Step 3: 跑迁移**

Run: `node tools/scripts/migrate-levels-to-dir.mjs`
Expected: 打印「迁移完成：9 关」；`design/levels/singles/` 下 9 个 `L000N.json`；`manifest.json`、`palette.json`、`plates/README.md` 生成。

- [ ] **Step 4: 提交前暂存新真源（旧 json 此步保留，Task 4 统一删）**

```bash
git add games/beads/design/levels/manifest.json games/beads/design/levels/palette.json \
        games/beads/design/levels/singles games/beads/design/levels/plates
```

---

## Task 2: sync 改造为 manifest 驱动装配（目录模式 + 断言④放宽 + 保 legacy）

**Files:**
- Modify: `tools/scripts/sync-levels-data.mjs`（`discover()` 模式检测 / `buildModuleSource()` 装配 / 断言④ / 头部注释 / `printHelp`）
- Modify: `games/beads/design/levels/levels-data.header.txt`（仅「Source of truth」注释行）

**Interfaces:**
- Consumes: Task 1 产物 `manifest.json` / `palette.json` / `singles/*.json`（`plates/*.json` 结构预留在装配器内，P1 空）。
- Produces: 与现网同形的 `LEVELS_DATA`（顶层键序：`version, gameId, palette, description, levels`；levels 按 manifest `order`）。

- [ ] **Step 1: 写目录模式检测与装配（先让测试可跑）**

在 `sync-levels-data.mjs` 顶部常量区加 `const MANIFEST_FILE = 'manifest.json';`；把 `discover()` 内每游戏的判定改为**双模式**（替换原「断言④ 恰 1 JSON」段，`jsonFiles.length > 1` 分支之前）：

```js
    const manifestPath = join(levelsDir, MANIFEST_FILE);
    const hasManifest = isFile(manifestPath);
    // 目录模式：有 manifest.json 即以 manifest 为唯一真源（顶层仅允许 manifest + palette，不得再有别的关卡 json）
    if (hasManifest) {
      const stray = jsonFiles.filter((f) => f !== MANIFEST_FILE && f !== 'palette.json');
      if (stray.length) {
        problems.push(`${name}：目录模式（有 manifest.json）却仍有顶层关卡 json：${stray.join('、')} —— 二者歧义，请只保留 manifest 驱动`);
        continue;
      }
      if (!hasHeader) { problems.push(`${name}：目录模式缺 ${HEADER_FILE}`); continue; }
      if (!isFile(targetPath)) { problems.push(`${name}：目录模式缺 ${TARGET_REL}`); continue; }
      games.push({ name, mode: 'dir', manifestPath, levelsDir, headerPath, targetPath, jsonName: MANIFEST_FILE });
      continue;
    }

    // 单 JSON 模式（legacy，breakout）：无 manifest.json 时保持原「恰 1 json」语义
    if (jsonFiles.length > 1) {
      problems.push(`${name}：无 manifest.json 且 design/levels/ 顶层有 ${jsonFiles.length} 个关卡 .json（${jsonFiles.join('、')}）—— 要么恰好 1 个，要么改用 manifest.json 目录模式`);
      continue;
    }
    const jsonFiles2 = jsonFiles;
    // ↓ 以下为原 断言①②③ 与 push game（mode:'single'）逻辑，jsonPath 用 join(levelsDir, jsonFiles2[0])
    //   （沿用现有代码，仅把 jsonFiles→jsonFiles2、并给 games.push 加 mode:'single'）
```

`buildModuleSource()` 改为分派，并新增装配器（**顶层键序固定 = 原形；关卡对象原样不注入 uid**）：

```js
export function buildModuleSource(game) {
  const header = readFileSync(game.headerPath, 'utf8');
  const data = game.mode === 'dir' ? assembleFromManifest(game) : JSON.parse(readFileSync(game.jsonPath, 'utf8'));
  return `${header}\nexport const ${CONST_NAME}: LevelsData = ${render(data, 0)};\n`;
}

/** 目录模式装配：manifest order → LevelsData 对象（键序严格 = {version,gameId,palette,description,levels}）。 */
function assembleFromManifest(game) {
  const man = JSON.parse(readFileSync(game.manifestPath, 'utf8'));
  const paletteDoc = JSON.parse(readFileSync(join(game.levelsDir, man.paletteFile), 'utf8'));
  const entries = [...man.entries].sort((a, b) => a.order - b.order);
  const levels = [];
  for (const e of entries) {
    const obj = JSON.parse(readFileSync(join(game.levelsDir, e.file), 'utf8'));
    if (e.kind === 'single') {
      levels.push(obj);
    } else { // plate（P1 空；P2 填）：cells 展开进 levels
      for (const c of obj.cells) levels.push(c);
    }
  }
  return {
    version: man.schemaVersion,
    gameId: man.gameId,
    palette: paletteDoc.palette,
    description: man.description,
    levels,
  };
}
```

> `assembleFromManifest` 断言（缺失即在函数内 throw，供 --check 报错）：每个 `e.file` 存在；`singles/`+`plates/` 下每个 json 必须被 manifest 引用（无孤儿）；`uid` 唯一；`order` 连续 1..N；Plate 展开期校验 `cells.length===gridCols*gridRows` 且每 cell 尺寸 ≤ `GRID_MAX`。孤儿检测遍历 `readdirSync(levelsDir/singles)` 与 `.../plates` 的 `.json`。

- [ ] **Step 2: 更新 legacy push 与 `describeGame`/`printHelp`**

legacy 分支 `games.push({ name, mode:'single', jsonPath, jsonName: jsonFiles2[0], headerPath, targetPath })`；`printHelp` 与文件头注释「每游戏恰好 1 JSON」→「manifest 目录模式 或 单 JSON 模式」。header.txt「Source of truth」行改：

```
 * Source of truth: games/beads/design/levels/{manifest.json,palette.json,singles/,plates/}
```

- [ ] **Step 3: 运行 sync，产物数据体必须与快照逐字节一致**

Run: `node tools/scripts/sync-levels-data.mjs --game=beads`
Then:
```bash
awk '/^export const LEVELS_DATA/{p=1} p' games/beads/src/config/levels-data.ts > /tmp/levels-body.new
diff <(cat /tmp/levels-body.snapshot) <(cat /tmp/levels-body.new) && echo "✅ 数据体零漂移" || echo "❌ 漂移，须修装配（多为键序/漏字段）"
```
Expected: `✅ 数据体零漂移`。

- [ ] **Step 4: levels:check 全绿（含 breakout 未受影响）**

Run: `pnpm run levels:check`
Expected: `✅ levels:check OK —— 2 款游戏全部一致（beads、breakout）`。

---

## Task 3: Node 单测（漂移证明 + 断言 + 兼容）

**Files:**
- Test: `games/beads/tests/levels-dir-sync.test.ts`
- Consumes: `sync-levels-data.mjs` 导出的 `buildModuleSource` / `describeGame` / `assembleFromManifest`（后者需 export）。

- [ ] **Step 1: 加导出并写失败测试**

`sync-levels-data.mjs` 导出 `assembleFromManifest`（加 `export`）。新测试：

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { describeGame, buildModuleSource, assembleFromManifest } from '../../../tools/scripts/sync-levels-data.mjs';

const bodyOf = (src: string) => src.slice(src.indexOf('export const LEVELS_DATA'));

describe('beads 目录模式 sync', () => {
  const game = describeGame('beads');
  it('beads 走 dir 模式', () => { expect(game.mode).toBe('dir'); });

  it('装配数据体逐字节等于迁移前快照（零漂移）', () => {
    const snapshot = readFileSync('tests/__fixtures__/levels-body.snapshot', 'utf8');
    expect(bodyOf(buildModuleSource(game))).toBe(bodyOf(snapshot));
  });

  it('顶层键序 = version,gameId,palette,description,levels', () => {
    const d = assembleFromManifest(game);
    expect(Object.keys(d)).toEqual(['version', 'gameId', 'palette', 'description', 'levels']);
  });

  it('关卡数 = manifest entries order 连续', () => {
    const d = assembleFromManifest(game);
    expect(d.levels.length).toBeGreaterThanOrEqual(8);
    expect(d.version).toBe(2);
  });
});

describe('breakout legacy 单 JSON 模式不受影响', () => {
  it('mode=single', () => { expect(describeGame('breakout').mode).toBe('single'); });
});
```

把 Step-1-of-Task1 的 `/tmp/levels-body.snapshot` 存为 `games/beads/tests/__fixtures__/levels-body.snapshot`。

- [ ] **Step 2: 跑测试看红（未存 fixture / 未导出前）**

Run: `pnpm --filter @beads/app exec vitest run tests/levels-dir-sync.test.ts`（按本仓 beads 测试实际调用方式，可能是 `pnpm -r run test` 或 `cd games/beads && pnpm test`）
Expected: 先 FAIL（缺 export/fixture），补齐后 PASS。

- [ ] **Step 3: 加断言负例（孤儿/歧义）到测试**

用临时目录构造「manifest + 顶层 stray json」与「有 singles 文件未被 manifest 引用」两例，断言 `discover()` 产出对应 `problems`。（实现见 sync 内孤儿/歧义检测。）

- [ ] **Step 4: 全绿**

Run: beads 测试全量 + `pnpm run levels:check`
Expected: PASS。

---

## Task 4: 删旧真源 + 镜像同步 + 全量验证 + 提交

- [ ] **Step 1: 删 `levels-01-08.json`**

Run: `git rm games/beads/design/levels/levels-01-08.json`
Then: `pnpm run levels:sync && pnpm run levels:check`
Expected: check 绿（目录模式接管，产物不变）。

- [ ] **Step 2: Cocos 镜像同步**

Run: `pnpm run framework:sync`
Expected: `games/beads/cocos/assets/scripts/.../levels-data.ts` 镜像更新（若头部注释变了）。

- [ ] **Step 3: 全量验证**

Run: `pnpm run verify`
Expected: 全绿（含 levels:check / palettes:check / typecheck / beads 单测 / ctx 门 / 镜像门）。

- [ ] **Step 4: 提交（脏文件隔离——只 add 本任务文件）**

```bash
git add games/beads/design/levels/manifest.json games/beads/design/levels/palette.json \
        games/beads/design/levels/singles games/beads/design/levels/plates \
        games/beads/design/levels/levels-data.header.txt \
        games/beads/design/levels/levels-01-08.json \
        tools/scripts/sync-levels-data.mjs tools/scripts/migrate-levels-to-dir.mjs \
        games/beads/src/config/levels-data.ts games/beads/cocos/assets/scripts \
        games/beads/tests/levels-dir-sync.test.ts games/beads/tests/__fixtures__/levels-body.snapshot
git commit -m "feat(beads): 关卡真源目录化 + manifest 驱动 sync（产物零漂移）(WXG-T-185)"
```

> header.txt 变了 → `levels-data.ts` 头部注释变 → 镜像需同步；pre-commit ①⁷⁄₈ 会校验，勿 `--no-verify`。

---

## Self-Review（写完后自查，已并入上文）

1. **Spec 覆盖**：§1 内容仓（Task1）✓ / §2 版本 manifest（contentVersion 字段落 Task1，运行时展开 Task2）✓ / §3 sync 反转④+装配（Task2，分片延 P3 已在 Goal 声明）✓ / §5 studio 改造（P2，本计划不含）✗ 有意排除 / 断言扩面（Task2 装配内 + Task3 负例）✓。
2. **占位扫描**：无 TBD；所有代码步骤含具体代码。`pnpm test` 调用方式留一句让执行者按本仓实际脚本核对（属环境事实，非占位）。
3. **类型一致**：`assembleFromManifest` / `buildModuleSource` / `describeGame` 签名跨任务一致；`entry` 字段（uid/kind/file/pack/order）Task1 产出 = Task2 消费；`schemaVersion→version`、`contentVersion` 语义分离一致。
