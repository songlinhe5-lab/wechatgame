# 发布清单（Release Checklist）· beads「拼豆小铺」

- 版本：v1.0 · 2026-10-15
- 适用发布类型：**首次提审发布（首发）**；后续热修沿用 `production/release/rollback.md §5` 简化流程
- 模板来源：`production/release/release-checklist.md`（breakout 版，六阶段 + 门控结构沿用）
- 状态：**待执行**（P4 文档批；真机走查与发布批未开）

---

## ⛔ 前置声明（务必先读）

> 1. **平台红线 ≠ 内部目标**：红线 = 微信主包 ≤ **4096 KB**、主包+分包 ≤ **30720 KB**（数值以[微信官方分包文档](https://developers.weixin.qq.com/minigame/dev/guide/base-ability/sub-packages.html)为准，上传前复核）；内部目标 = 主包 ≤ **2000 KB**（`check:size` 口径）。
> 2. **当前判定 `NO-GO`**：真机走查未执行（`production/qa/beads/device-walkthrough.md` 全部 `—`）；主包越内部目标；分包/远程包路线待发布批拍板（§8）。
> 3. 官方审核规则、类目、资质一律「以官方入口为准」，本清单不编造审核细节。

---

## 0. 使用说明

每项四要素：判据 / 负责人（角色）/ 证据 / 勾选。角色代号同 breakout 版：`ENG` `QA` `DES` `ART` `AUD` `OPS` `LEAD` `USER`。`🚦` = 门控项，未过不得进入下一阶段（`USER` 书面豁免除外）。

---

## 1. 阶段一：构建前（Pre-Build）

### 1.1 版本与范围冻结

| ☐ | 检查项 | 判据 | 负责人 | 现状 / 证据 |
|---|---|---|---|---|
| ☐ | 🚦 版本号三处一致 | `games/beads/package.json`、游戏内 `version_label`、微信后台版本号按 `version-strategy.md` 对齐 | OPS | ⚠ 漂移：`package.json` = `0.1.0`，菜单 `copy-tokens.ts::version_label` = `v1.x · 演示版` |
| ☐ | 发布范围冻结 | 关卡池、皮肤池、风格池以 `systems-index §3` 为准；未出池项（EP11 P-1…P-4）不混入 | DES + OPS | |
| ☐ | 🚦 漂移登记已闭合或豁免 | `systems-index` 漂移登记 + 本节已知漂移逐条有结论 | ENG + DES | |
| ☐ | 调试入口不进线上 | `studio=` 启动参数（beads-studio 导入，http 局域网）、`debugInfo` 覆层、`qa-probe` 不在提审包里可达 | ENG + QA | `BeadsBootstrap.ts` 只认 launch query `studio=` ⇒ 普通入口不可达；仍需在提审包上实测设置页无「导入」钮 |
| ☐ | 变更日志 | 新建 beads 段（Keep a Changelog，含「存档兼容性」强制段） | OPS | 待写 |

### 1.2 包体预算（2026-10-15 实测，产物 `cocos/build/wechatgame`，P3 落码前构建）

| 组成 | KB | 说明 |
|---|---|---|
| 引擎 `cocos-js/cc.js` | 1360 | 最大单项 |
| 菜单 BGM `audio/bgm_porch.mp3` | 704 | `build-cocos.mjs` 拷入、运行时字符串路径加载 ⇒ 不在 bundle 依赖图 |
| `assets/main`（脚本 + 主 bundle） | 552 | |
| `assets/textures`（菜单位图等，Cocos bundle） | 424 | `textures.meta`：`isBundle: true`，未设压缩类型 ⇒ 随主包 |
| `assets/internal` | 168 | 引擎内置 |
| 适配层与杂项 | ≈190 | `web-adapter.js` 100、`engine-adapter.js` 24 等 |
| **主包合计（`check:size`）** | **3166.3** | gzip 参考 1573.1；**红线余量 930 KB（77%）**；**越内部目标 1166 KB** |

| ☐ | 检查项 | 判据 | 负责人 |
|---|---|---|---|
| ☐ | 🚦 红线 | 主包 ≤ 4096 KB（✅ 现 3166） | ENG + OPS |
| ☐ | 🚦 内部目标 | 主包 ≤ 2000 KB，或 `USER` 书面豁免并写明理由 | ENG + USER |
| ☐ | 增量预留 | 待入包：三态徽标位图 ×3（128² @2x）、后续 BGM 曲目——发布批须按 §8 选型后重算 | ENG |
| ☐ | ⚠ 红线数值复核 | 上传前到官方文档确认当前上限 | OPS + USER |

### 1.3 依赖与工具就绪（2026-10-15 核实）

| ☐ | 检查项 | 判据 | 现状 |
|---|---|---|---|
| ☐ | 🚦 `pnpm run verify` | 22/22 PASS | ✅（P3 批末次） |
| ☐ | 🚦 AppID | profile / 工程 / 产物一致 = `wx8cf9f756e5390749` | ✅；⚠ `cocos/build/project.config.json` 的 `wx63c62151a1c0cf3b` 为误开父目录生成，开发者工具**只打开 `build/wechatgame/`** |
| ☐ | 微信开发者工具 | 已装、已登录有开发权限的微信号；上传密钥 + IP 白名单（CLI 上传时） | ✅ 已装（含 CLI）；登录/密钥 USER 确认 |
| ☐ | Cocos Creator | 版本 = 工程约定 | ✅ 3.8.8 |
| ☐ | 产物目录唯一 | 只留一个产物目录 | ⚠ `build/wechatgame` 与 `build/wechatgame-001`（09-29，profile `outputName` 仍指向它）并存 |
| ☐ | `.meta` 完整 | 新增脚本有编辑器生成的 `.meta`（⛔ 不手写） | 用 Creator 打开工程一次让编辑器补齐 |

---

## 2. 阶段二：构建（Build）

| ☐ | 检查项 | 判据 | 负责人 |
|---|---|---|---|
| ☐ | 干净构建 | 先 `pnpm run framework:sync`，再 `pnpm --filter @wxgame/beads build:cocos`；产物 mtime 晚于最后一次源码改动 | ENG |
| ☐ | 🚦 包体 | `check:size` 输出主包 / 分包数值并入本清单 §1.2 | ENG + OPS |
| ☐ | 分包/远程结构合规 | 按 §8 选定方案；`game.json` `subpackages` 或远程域名配置与方案一致 | ENG |
| ☐ | 无调试后门 | 无刷屏日志、无探针入口、无 dev 快捷键 | ENG + QA |
| ☐ | 产物归档 | 按版本号归档，记录构建号 | OPS |

---

## 3. 阶段三：自测（真机）

> 执行单：`production/qa/beads/device-walkthrough.md`（Session 0–7，K-044 判定上限规则）。本表只列**发布门控**。

| ☐ | 检查项 | 判据 | 负责人 |
|---|---|---|---|
| ☐ | 🚦 冒烟全过 | 走查单 Session 1 全部 `PASS` | QA |
| ☐ | 🚦 存档 | 杀进程 / onHide-onShow / 设置字段回显（D-59/60/61）`PASS`；伪造高版本存档不崩 | QA |
| ☐ | 🚦 真机覆盖 | ≥1 台 Android（L-A 畅享 ✅）+ ≥1 台 iOS 跑通 Session 1–3 | QA |
| ☐ | 🚦 输入 P0 | TC-CAM-DEV-01/02/03 无 FAIL | QA |
| ☐ | 性能 | D1 产出（允许 `PASS*（单侧）`，残留写明缺 L-B / iOS 低配）；无 p10 <30fps 触发 | ENG + QA |
| ☐ | 音频 | 真机确认 `createWebAudioContext` 存在且出声；否则登记 X-01 并由 USER 决定「静音首发」或改选型 | AUD + USER |
| ☐ | 激励视频 | 有真实广告位 ⇒ 三分支实测；无 ⇒ 复活入口的首发处理由 USER 定（隐藏 / 保留不可用态） | ENG + USER |
| ☐ | 合规自测 | 光敏（D-70）、无诱导分享、无外链；隐私协议入口是否必需以官方为准 | OPS |

---

## 4. 阶段四：提交审核

| ☐ | 检查项 | 判据 | 负责人 |
|---|---|---|---|
| ☐ | 🚦 主体与类目 | mp 后台主体、游戏类目已选定 | USER |
| ☐ | ⚠ 资质材料 | 按 `production/release/wechat-submission.md` 逐项确认 beads 适用性（**有激励广告 ⇒ 比 breakout 多流量主相关材料**，以官方为准） | USER + OPS |
| ☐ | 体验版 | 上传开发版 → 设为体验版 → 内部扫码复跑走查单 Session 1 | OPS |
| ☐ | 🚦 提审 | 记录提交时间、版本、审核单号 | USER |

## 5. 阶段五：上线

| ☐ | 检查项 | 判据 | 负责人 |
|---|---|---|---|
| ☐ | 🚦 审核通过 + USER 批准发布 | 人工审批，不可自动 | USER |
| ☐ | 发布方式 | 全量 / 灰度（灰度能力与比例以后台为准） | OPS + USER |
| ☐ | 回滚预案 | 按 `rollback.md §6` 模板填 beads 版（存档键 `wxgame.beads.*` 兼容矩阵） | OPS |

## 6. 阶段六：上线后观察

| ☐ | 检查项 | 判据 | 负责人 |
|---|---|---|---|
| ☐ | 错误监控 | mp 后台运营数据 / 错误日志无致命崩溃 | ENG |
| ☐ | 加载 | 白屏 / 卡加载抽样；选分包或远程方案时**额外**抽样「子包/远程加载失败」回退路径 | QA |
| ☐ | 🚦 回滚触发器 | 无触发 `rollback.md §1` 条件 | OPS |

---

## 7. 门控汇总（Go / No-Go）

**进入提审的硬门控（全绿才 go）**：§1.1 版本一致 · §1.2 红线 + 内部目标（或书面豁免）· §1.3 工具与 AppID · §3 冒烟/存档/真机覆盖/输入 P0 · §4 主体类目。

**当前判定：`NO-GO`**
- 真机走查未执行；
- 主包 3166 KB 越内部目标 2000 KB，§8 未拍板；
- 版本号漂移未闭合；
- 音频（X-01）与激励视频（X-07）的首发处理未定。

---

## 8. 分包 / 远程包选型（**发布批拍板，本清单不代裁**）

以 2026-10-15 实测为基线。所有方案都保留现有「位图缺失 ⇒ 程序化腿」回退，因此菜单位图晚到或加载失败不会白屏（已在 Node 侧验证，真机需走查 D-69 复核）。

| 方案 | 做法 | 主包估算 | 工程成本 | 运维成本 / 风险 |
|---|---|---|---|---|
| **A 维持单主包** | 不动 | 3166 KB（红线 77%） | 0 | 需 USER 豁免内部目标；后续每加一张位图/一首曲子都吃红线余量 930 KB |
| **B 分包** | ① `textures` bundle 在 **Creator 检查器**里把压缩类型设为「小游戏分包」（改的是 `.meta`，⛔ 只能经编辑器，L1）；② BGM 由 `build-cocos.mjs` 拷进分包目录并在 `game.json` 写 `subpackages`；③ 运行时首屏后 `wx.loadSubpackage` 再启用位图 / BGM | ≈ 2040 KB（−424 −704） | 中：编辑器操作 + 构建脚本 + 加载时序（菜单首帧程序化，分包到位后切位图） | 无服务器；分包仍计入 30 MB 总量；首帧观感会「程序化 → 位图」跳变一次（需 ART 认可） |
| **C 远程包** | `textures` 设为远程 bundle + BGM 走 CDN 下载 | ≈ 2040 KB | 中：同 B，外加下载失败 / 缓存 / 版本号策略 | **需 HTTPS CDN + mp 后台配置 downloadFile 合法域名**；离线或弱网首启无位图无 BGM；资源版本需与代码版本绑定（`version-strategy.md §5` 现结论「无需热更」需重审） |
| **补充 D 资源压缩**（可与 A/B/C 叠加） | BGM 降码率重编码；位图压缩档复核 | 视压缩比 | 低 | 听感 / 画质需 AUD/ART 复核 |

> 引擎 `cc.js` 1360 KB 是最大项。Cocos 的「分离引擎 / 引擎插件」（profile `separateEngine: false`）**是否计入主包、对首发是否可用，以[微信官方](https://developers.weixin.qq.com/minigame/dev/guide/)与 Cocos 文档为准**，本清单不下结论，列为发布批调研项。
>
> 只靠 B 或 C 仍略高于 2000 KB（≈2040），要真正达标需叠加 D 或引擎侧方案；否则仍需 USER 对内部目标豁免 ≈40 KB。

---

## 9. 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-10-15 | 初稿（P4）：beads 六阶段清单 + 实测包体基线 + AppID / 产物现状 + 分包/远程选型表（待发布批拍板） |
