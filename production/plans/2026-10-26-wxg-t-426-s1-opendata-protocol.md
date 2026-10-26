# WXG-T-426 · S-1 施工单：opendata 协议层 + Noop / Mock Provider

- **上位**：`docs/architecture/adr/ADR-0035-minigame-open-data-domain-friend-leaderboard.md` §5.2 **S-1**（Q1–Q4 已于 2026-10-26 全部拍板：榜页唯一总榜 + 分关下放结算面板 / 首开榜弹授权 / §3.1 协议形状 / R2 按需重贴）
- **状态**：✅ **已完工（2026-10-26，提交 `43b9a85c`）**
- **目标**：在**没有 `wx`、没有子域工程**的前提下，把「主域 ⇄ 子域」的消息形状与 Provider 契约**定死在 core**，并用纯 Node 单测证明三件事：版本握手可判、降级可走、Mock 能驱动后续 UI。

---

## 1. 范围（In / Out 一刀切）

**In（本单只做这些）**

| # | 交付 |
|---|---|
| 1 | `packages/framework/src/core/opendata/protocol.ts` — 判别联合 + 版本常量 + 边界校验 |
| 2 | `packages/framework/src/core/opendata/provider.ts` — `OpenDataProvider` 接口 + `NoopOpenDataProvider` |
| 3 | `packages/framework/src/core/opendata/mock.ts` — `MockOpenDataProvider`（同步回执，供 Node 测试 / harness） |
| 4 | `packages/framework/src/core/opendata/index.ts` + `core/index.ts` 加一行 barrel 导出 |
| 5 | `packages/framework/tests/core/opendata-protocol.test.ts` / `opendata-provider.test.ts` |

**Out（明确不做，防止切片膨胀）**

- ❌ `Platform.createOpenDataProvider?()` 与 `GameServices.openData?` 透传 → **S-2**
- ❌ beads 榜单面板 / 路由 / 空态文案 / 未授权态 → **S-3**
- ❌ `opendata/` 子域工程、独立 tsconfig、产物 `game.json` 的 `openDataContext` → **S-4**
- ❌ weapp 真实现（`getOpenDataContext` / `setUserCloudStorage` / `sharedCanvas`）与授权引导 → **S-5**
- ❌ R2 纹理贴图（`sharedCanvas` 只在真机 / 开发者工具存在）→ **S-5**
- ❌ 任何 §3 冻结常量、存档形状（save 保持 v6）、结算面板几何、金样本

---

## 2. 交付物与签名

### 2.1 `core/opendata/protocol.ts`

```ts
/** 握手版本。子域是独立打包/独立产物的运行时，热更可能只更新主域 ⇒ 版本不等必须可判。 */
export const OPEN_DATA_VERSION = 1;

export type RankBoard = 'settle' | 'settle-total' | 'sprint';
//  ⚠ Q1 排期（ADR-0035 §3.2）：'settle-total' = 榜页唯一榜；'settle' = 结算面板上下文分关榜；
//  'sprint' = 二期预留（WXG-T-422），本单只定义不启用。

export interface OpenDataTheme {
  bg: string; rowBg: string; rowBgSelf: string;
  text: string; accent: string;
  avatarSize: number; rowH: number; fontPx: number;
}

export type HostToOpenData =
  | { type: 'init'; version: number; theme: OpenDataTheme; board: RankBoard }
  | { type: 'rank:query'; board: RankBoard; key: string; order: 'asc' | 'desc'; limit: number }
  | { type: 'rank:refresh'; board: RankBoard }
  | { type: 'render:resize'; width: number; height: number; dpr: number }
  | { type: 'render:visible'; visible: boolean };

export type OpenDataToHost =
  | { type: 'ready'; version: number }
  | { type: 'rank:ready'; board: RankBoard; count: number }
  | { type: 'rank:error'; board: RankBoard; code: RankErrorCode };

export const RANK_ERROR_CODES = ['no-auth', 'empty', 'api-missing', 'fail'] as const;
export type RankErrorCode = (typeof RANK_ERROR_CODES)[number];

/** 边界校验：子域是独立运行时，回传消息**不可信**；非法形状一律 false，⛔ 不抛异常。 */
export function isOpenDataToHost(value: unknown): value is OpenDataToHost;

/** 主域只认同版本；不等 ⇒ 面板走「敬请期待」降级（ADR §3.1 约束 1）。 */
export function isCompatibleOpenDataVersion(version: unknown): boolean;
```

> 形状必须与 **ADR-0035 §3.1 逐字一致**；唯一允许的收紧是给字段加 `readonly`（不得改名、增删成员）。

### 2.2 `core/opendata/provider.ts`

```ts
export interface OpenDataProvider {
  /** 主域 → 子域。单向下发，不是 RPC；实现不得在此序列化业务数据。 */
  send(message: HostToOpenData): void;
  /** 子域 → 主域的状态回执。返回退订函数；订阅者自担回调内异常（与 EventBus 同口径）。 */
  onMessage(cb: (event: OpenDataToHost) => void): () => void;
  /** 幂等；destroy 后 send 静默丢弃、onMessage 不再触发。 */
  destroy(): void;
}

export class NoopOpenDataProvider implements OpenDataProvider { /* Node / web / 旧宿主降级 */ }
```

### 2.3 `core/opendata/mock.ts`

```ts
export interface MockOpenDataOptions {
  version?: number;          // 默认 OPEN_DATA_VERSION；填 0 可造「版本错位」用例
  autoReply?: boolean;       // 默认 true
  rows?: number;             // rank:query 回执 count，默认 0
  failCode?: RankErrorCode;  // 设置后 rank:query 回 rank:error
}

export class MockOpenDataProvider implements OpenDataProvider {
  readonly sent: HostToOpenData[];              // 供断言 / 调试
  emit(event: OpenDataToHost): void;            // 测试与 harness 手动驱动
}
```

- **同步回执**（`send` 内直接回调），⛔ 不用 `setTimeout` / 定时器 —— 单测不得依赖等待。
- `Mock` **不代判版本兼容**：`version: 0` 时如实回 `ready{version:0}`，判定归主域。
- ⛔ 不用 `Math.random()`（L4）；条数只从 `options.rows` 取。

### 2.4 barrel

`core/opendata/index.ts` 导出上述三件；`core/index.ts` 在 `export * from './ads/rewarded-ad.js';` 之后加 `export * from './opendata/index.js';`。

---

## 3. 实现硬约束

1. **零平台依赖**：`core/opendata/**` ⛔ import `cc` / DOM / `wx` / `window` / `document`，⛔ import `platform/*`（L2，`check:arch` 机械门）。
2. **校验只在校验函数内**：`isOpenDataToHost` 逐 `type` 分支检查必填字段与类型；未知 `type` / 缺字段 / `count` 非有限数或负数 / `null` / 数组 ⇒ `false`。
3. **零分配热路径**：`send` 只记录或透传，⛔ 不 `JSON.stringify`（序列化属平台层 S-2/S-5）；校验函数不构造中间集合。
4. **版本单一真源**：`OPEN_DATA_VERSION` 是协议唯一数字源；S-4 子域 ⛔ 手抄第二份（构建期生成，见 §6 风险 1）。
5. **不落任何游戏数值**：协议层不认识 `SETTLE_SCORE` / 关卡表；`key` 只是字符串。

---

## 4. 测试计划（**先红后绿**）

先写断言、跑红（文件不存在即红），再实现。用例清单：

**A. `opendata-protocol.test.ts`**

| # | 断言 |
|---|---|
| A1 | 主域 5 个 `type` 字面量齐全；子域 3 个齐全（静态哨兵，防漏改） |
| A2 | `OPEN_DATA_VERSION` 钉值 = **1** |
| A3 | `isOpenDataToHost` 正例 3（`ready` / `rank:ready` / `rank:error`）全 true |
| A4 | 反例 ≥6：未知 type / 缺 `board` / `count` 为 `NaN` / `count` 负数 / `null` / 数组 / `code` 不在枚举 ⇒ 全 false |
| A5 | `isCompatibleOpenDataVersion(1)` = true；`0` / `2` / `'1'` / `undefined` / `null` = false |

**B. `opendata-provider.test.ts`**

| # | 断言 |
|---|---|
| B1 | Noop：`send` 不抛；`onMessage` 永不触发；`destroy` 幂等；destroy 后 `send` 不抛 |
| B2 | Mock 默认：`send(init)` ⇒ 同步 `ready{version: 1}` |
| B3 | Mock 版本错位：`version: 0` ⇒ `ready{version: 0}`（由主域判不兼容） |
| B4 | Mock `rank:query` ⇒ `rank:ready{board, count: rows}`；`failCode` 设置 ⇒ `rank:error{code}` |
| B5 | Mock 退订后不再回调；`sent` 顺序与内容逐条相等 |
| B6 | 全用例**零 `await`** 通过（证明无定时器依赖） |

---

## 5. 验证命令

```bash
pnpm --filter @wxgame/framework exec vitest run tests/core/opendata-protocol.test.ts tests/core/opendata-provider.test.ts
pnpm run typecheck
pnpm run check:arch            # L2：core 纯净
pnpm run framework:sync && pnpm run framework:sync:check   # 若 core 有 cocos 镜像，零漂移
pnpm run test                  # 全量（framework + games）
pnpm run check:links && pnpm run ctx:check
```

> 注：`framework:sync` 若把 `core/**` 镜像进 `games/beads/cocos/assets/scripts/**`，镜像产物须一并提交，以 `sync:check` 零漂移为准。

---

## 6. 风险与待观察

1. **协议常量双份**：子域不能 import 主域代码 ⇒ S-4 必须**构建期生成**一份（从 `protocol.ts` 抽取），⛔ 手抄 `OPEN_DATA_VERSION`。本单先把常量放在唯一位置，为生成留口。
2. **Mock 的即时性 ≠ 真机**：`getFriendCloudStorage` 是异步且新好友可能有 2h 延迟（ADR §1.3 W8）⇒ S-2/S-3 的 UI 必须按「可能长时间无回执」设计加载态；⛔ 把 Mock 的同步回执当基线。
3. **`RankBoard` 有 3 个成员但只启用 2 个**：`'sprint'` 为二期（WXG-T-422）预留，本单只定义；S-2/S-3 ⛔ 在一期暴露冲刺入口或空榜。

---

## 7. 红线自证（交付时逐条打勾）

- [x] L2：`core/opendata/**` 零 `cc` / DOM / `wx` / `window` / `document`（`check:arch` 机械证）
- [x] L3：未碰 `games/*/src`
- [x] L4：零 `Math.random()`
- [x] 零存档改动（save 仍 v6）、零 §3 冻结常量、零金样本变更、零 `PANEL_SIZE` 改动
- [x] ⛔ 未手编 `.scene` / `.prefab` / `.meta`

---

## 8. 完成定义（DoD）

1. 两个测试文件全绿，新增用例 **≥ 12**（A ≥ 5 / B ≥ 6）。✅ **14 例**（A = 5 / B = 9）。
2. `typecheck` / `check:arch` / `framework:sync:check` / `check:links` / `ctx:check` 全绿。✅ 另加 `test` 全量：framework 532 例 / beads 1284 例。
3. ADR-0035 §5.2 的 **S-1** 行标 ✅ 并回填 commit 短 sha。✅ `43b9a85c`。
4. 收尾回传 0–3 条沉淀候选。

---

## 9. 交接给 S-2 / S-3 / S-5

- **S-2**：`Platform.createOpenDataProvider?(): OpenDataProvider | undefined`；Node/Web 返回 `NoopOpenDataProvider`，weapp 真实现延至 S-5；`GameServices.openData?` 一并透传（`compose/app.ts`）。
- **S-3**：面板只在「打开时」`send(init)`；未授权 / 无数据 / 版本不符分别落在 `no-auth` / `empty` / `ready.version` 三处分支。
- **S-5**：R2 = 收到 `rank:ready` / `rank:refresh` 后上传**一次** `sharedCanvas` 纹理，`render:visible=false` 停帧；⛔ 不挂每帧 blit（WXG-T-424）。
