# beads 真机走查单（P4 · K-044 解除条件逐项走查）

- 版本：v1.0 · 2026-10-15
- 适用：`games/beads` 首次真机走查（拿到 AppID 之后、提审之前）
- 上游：本单**只汇总不新造判据**——每条判据、阈值、解除条件以「来源」列所指文档为准；本单与来源冲突时以来源为准并回改本单
- 下游：走查结论回填各来源文档的状态列；发布门控见 `production/release/beads/release-checklist.md §3`
- 裁定权：PASS / CONCERNS / FAIL 的**阶段裁定**归编排者（`wxgame-orchestration`）；本单只产逐条读数与判定上限

---

## 0. 判定规则（先读，K-044）

1. **判定上限由判据完备性决定，不由实现进度决定**。来源未给通过线（本单「线」列 = `未定义`）的条目，走查后**最多判 `PASS*`**（附观察记录），不得判 `PASS`；要升 `PASS` 必须先由判据 owner 在来源文档补线。
2. **缺通道不是预期**：取证通道没打通（日志拿不到、设备档缺失、后端是 Null）⇒ 判 `⛔ BLOCKED` 并写解除条件，**不得**写成「预期内通过」。
3. **部分关闭改残留描述，不改整条判定**：例如 D1 只跑了 1 台低端机 ⇒ 判 `PASS*（单侧）`，残留 = 「缺 L-B」。
4. **模拟器 / 开发者工具 / web-mobile 读数一律不作真机证据**（`render-perf-device-baseline.md §2` SIM 档 = 必采但禁作判据）。
5. 判定符：`PASS`（线已定义且达标）· `PASS*`（线未定义或样本不足，附观察）· `FAIL`（开缺陷，按 `bug-severity.md` 分级）· `⛔`（阻塞，写解除条件）· `—`（本轮未执行）。

---

## 1. 前置（Session 0 · 全部打勾才开走查）

| ☐ | 项 | 判据 | 现状（2026-10-15 核实） |
|---|---|---|---|
| ☐ | AppID 一致 | 构建 profile / 工程 / 产物三处 = `wx8cf9f756e5390749` | ✅ `cocos/profiles/v2/packages/wechatgame.json`、`cocos/project.config.json`、`build/wechatgame/project.config.json` 一致。⚠ `cocos/build/project.config.json` 是 `wx63c62151a1c0cf3b`——那是开发者工具把 **`build/` 父目录**当工程打开时生成的（已被 `.gitignore`），**走查时只打开 `build/wechatgame/`**，该文件可删 |
| ☐ | 开发者工具 | 已装、已登录有该 AppID 开发权限的微信号 | ✅ `/Applications/wechatwebdevtools.app`（含 CLI）；登录态需 USER 确认 |
| ☐ | 构建新鲜 | 产物 mtime 晚于最新源码改动；构建前已 `pnpm run framework:sync` | ⚠ 现产物 `build/wechatgame` 21:14 构建，**早于** P3（按下态 / 陈列条）落码 ⇒ 走查前**重构建** |
| ☐ | 旧产物清理 | 只保留一个产物目录，防扫错包 | ⚠ 并存 `build/wechatgame`（10-15）与 `build/wechatgame-001`（09-29，profile 的 `outputName` 仍指向它）⇒ 走查前删 `-001` 或改 `outputName` |
| ☐ | 包体 | `pnpm run check:size` 未越红线 | ✅ 主包 3166.3 KB ≤ 4096（越内部目标 2000，见发布清单 §1.2） |
| ☐ | 日志通道 | 能拿到真机 console / 探针输出 | 优先 vConsole；拿不到 ⇒ 走 `wx.showModal` 屏幕弹窗取证（`render-perf-device-baseline.md §7.3` 判例），**不得**因此跳过性能项 |
| ☐ | 取证落盘 | 建 `production/qa/beads/device/<YYYY-MM-DD>/`，文件名 `<条目ID>_<机型档>_<序号>.png/.jsonl` | — |
| ☐ | 设备档 | 至少 L-A + iOS 各 1 台在手 | 见 §2：iOS 低配档缺 ⇒ 相关条目上限受限 |

---

## 2. 设备矩阵（引 `render-perf-device-baseline.md §2 / §2.1`）

| 档 | 角色 | 在手 | 影响 |
|---|---|---|---|
| L-A | 低端主判 | ✅ 华为畅享 90 Pro Max（ohos，Mali-G610，dpr3；鸿蒙资格三关已过） | — |
| L-B | 第二低端同向 | ❌ 缺（Honor 6 仅兼容探针，三关全过才可临时充当） | D1 只能 `PASS*（单侧）`；D2 只能出方向性预读，**不可裁定瓶颈** |
| MID | 中端对照 | ❌ 未登记 | D7 样本数受限 |
| iOS | A11–A13 | ❌ 缺（iPhone 13 Pro Max = HIGH，**不得**当 iOS 低配） | iOS 侧性能结论上限 `PASS*`；功能/适配可用 HIGH 机先跑 |
| SIM | 开发者工具 | ✅ | 必采、禁作判据 |

---

## 3. 走查条目（按场次排，同场一次性走完）

列说明：**线** = 来源给的通过线（逐字，`未定义` ⇒ 上限 `PASS*`）；**另需** = AppID 之外的前提；**判定 / 证据** 走查时回填。

### Session 1 · 冒烟与首屏（先走，任何一条 FAIL 即停后续场次）

| ID | 来源 | 查什么 | 线 | 另需 | 判定 / 证据 |
|---|---|---|---|---|---|
| D-39 | `qa/beads/test-cases.md` DEV-02 | `build:cocos`（wechatgame）出包成功 | 出包成功 | 上传密钥 + IP 白名单（预览/上传时） | |
| D-75 | `qa/beads/smoke-tests.md` SC-01 | 冷启动首屏 = 主菜单画面 | 现口径停菜单 | — | |
| D-69 | `ADR-0030` 残留项 | 首屏走 blit 载体不空白 | 空白 ⇒ `carrier=off` 回退阀 | — | |
| D-74 | `smoke-tests.md` SC-MN-01/02 | 首屏菜单 → 点 Boss 图进选关 → 进关；未解锁格零响应 | 画面半边冒烟 | — | |
| D-59 | `smoke-tests.md` SC-11 | 杀进程后停主菜单；主钮/橱窗反映当前关；点主钮扣心开局 | 现口径（非直进玩法） | — | |
| D-60 | `smoke-tests.md` SC-13 | `onHide` 自动暂停；`onShow` 停 PAUSED | F1 冻结补偿 | — | |
| D-61 | `test-cases.md` TC-SAVE 族 | 风格 / 豆径 / 皮肤等设置杀进程后一致 | §8-11「与关前最后一帧一致」 | — | |
| D-66 | `qa/test-plan.md` G5/L4（通用） | 冷启动时长 | ≤1.5s（通用口径，beads 未另钉） | 秒表 3 次取中位 | |

### Session 2 · 适配（刘海 / 安全区 / 分辨率）

| ID | 来源 | 查什么 | 线 | 另需 | 判定 / 证据 |
|---|---|---|---|---|---|
| D-38 | `test-cases.md` DEV-01 | wx 宿主坐标链（getLocation / push）；**小游戏无 dpr 封顶** | 同 TC-COORD R1/R2/R3 在 wx 复取 | dpr3 机（畅享 ✅） | |
| D-40 | `menu-architecture.md` 灵动岛顶栏 | 顶栏圆底压木框 ~2.5–4px、牌体间隙 5.5px | 观感可接受则不改（**未定义** ⇒ 上限 PASS*） | 灵动岛机（iPhone 13 PM ✗ 是刘海；需 14 Pro+） | |
| D-41 | `menu-architecture.md` Android safeArea | `safeArea.bottom` 报成 `screenHeight` 时走兜底不贴底 | 脏值走兜底 | Android targetSdk 35/36 机 | |
| D-42 | `menu-architecture.md` letterbox | `FitResult.offsetY ≠ 0` 时顶栏是否真落屏顶 | 未定义 | 高屏 letterbox 机 | |
| D-43 | `render-perf-device-baseline.md` DG-8 | ohos 下 zoom 极值 / 转屏 / 安全区 | 未定义（点击准已验） | HarmonyOS（畅享 ✅） | |
| D-44 | `qa/test-cases.md` TC-UI-02/03 | 热区 ≥88；胶囊避让 | ≥88×88；不侵入胶囊 | 刘海/胶囊机 | |
| D-45 | `ADR-0030 §19` | dpr3 高 zoom 1.41× 放大糊度 | 允许轻度放大；依据 = 实读 DPR + tint↔矢量对比 | dpr3 机 | |
| — | P1（本仓 2026-10-15） | 动态设计高：HUD 随 `hudDy` 上移、齿轮可点、全屏遮罩铺满 | 未定义（Node 已钉，真机首验） | 高屏机 ×1 + 1334 档机 ×1 | |

### Session 3 · 输入

| ID | 来源 | 查什么 | 线 | 另需 | 判定 / 证据 |
|---|---|---|---|---|---|
| D-46 | `test-cases.md` TC-CAM-DEV-01（P0） | zoom≠1（含大盘 fit）棋盘点哪落哪 | 点哪落哪 | — | |
| D-47 | TC-CAM-DEV-02（P0） | 真双指捏合、亚像素、边沿序；阈值 8 待本条读数定 | 未定义 | 录屏帧序 | |
| D-48 | TC-CAM-DEV-03（P0） | Cocos 逐指是否同固定步（F1 真机复现） | 未定义 | — | |
| D-49 | TC-CAM-DEV-04 | 放大后珠盖 HUD、描边缝比例 | 观感；坐实则开缺陷 | — | |
| D-50 | TC-CAM-DEV-05 | z<1 命中 vs `TOUCH_MIN=88`，每关 ≥5 例点准率 | 未写 % 线 ⇒ 上限 PASS* | — | |
| D-51 | `systems-index.md` `ZOOM_TAP_MIN=0.7` | 低倍 tap → 聚焦放大手感 | 数值本身待真机 | — | |
| D-52 | `ADR-0018`；`accessibility.md` F2 | 32 基触控邻格误触 | 错点率 **<10%** | 多盘档 | |
| D-53 | `systems-index.md` btn_expand | 扩展钮热区 132×88、与扩展行净空重测 | C1 热区规格 | 扩展态 | |
| D-54 | `ADR-0015` | 拖动夹取边界、8px 不对称、窄盘顶格 | 未定义 | 录屏 | |
| D-55 | `g4-regression-report.md` BD-26 | 道具卡间距 60 的真机误触率 | 未定义 | — | |
| — | P3（本仓 2026-10-15） | 面板/菜单按下态：按住可见换面 + 下沉 2；`reduceMotion` 只换面；淡出期仍显 | 未定义（Node 已钉） | — | |

### Session 4 · 渲染观感（统一截图取证：每条同机同亮度，原图入库）

| ID | 来源 | 查什么 | 线 |
|---|---|---|---|
| D-12 | `ADR-0028`；`wxg-t-228-tint-criteria.md` TC-TINT-20 / T2' | wx 上屏+离屏 `multiply/screen` 可用且与 harness 同观感 | 可用且同观感（开销无 ms 线） |
| D-13 | `tint-mask-asset-spec.md` | dpr2/3 孔缘 AA、环状杂点 | 未定义 |
| D-23 | `test-cases.md` TC-MN-35/36/37/39；EP12-S6 | 5s 内认出「拼豆小铺」· 招牌墨色差 · 缩略认关 · 虚线 AA | 认出招牌有时间线，其余未定义 |
| D-24 | `epics-beads-ep12.md` EP12-S7 | 通关陈列条 9 关档格边 53、单珠 ≈8.6px 能否认关 | 未定义；不达标需让总览行高（版面改动另裁） |
| D-25 | EP12 K-1/K-2 | 奶白珠最弱对；wood/赭珠同族对比 | 未定义 |
| D-26 | `tint-mask-asset-spec.md`；`ADR-0030` | facet-4 tint vs 矢量同屏混用；LOD 阈值跳变 | 美术评可接受 |
| D-27 | `ADR-0030`；`assets-spec` r20 | 去板后盘面对比 | 待 art 校准 |
| D-28 | `systems-index.md`；`ADR-0018 §3.4.2` | 盘珠 30 < 托盘面 ~41.6 反转观感 | 未定义 |
| D-29 | `accessibility.md` r7 | `BEAD_DRAW_INSET` 6px 缝视认性 | 未定义 |
| D-30 | `assets-spec §1.10` | fit 档同色格是否连成图块 | 「缩到 fit 档同色格仍连成图块」 |
| D-31 | `test-cases.md` TC-PER-21/26 | 扫光/彩带在真机亮度/刷新率下是否刺眼/糊 | 未定义 |
| D-32 | TC-PER-27；`accessibility` G5 | Lv2 伪震屏 HUD 亚像素抖 | 未定义 |
| D-34 | `menu-layout-implementation-spec.md` | 菜单位图重缩精度 + pressed 纹观感 | 未定义 |
| D-35 | `ux-spec.md` U14 | 设置遮罩降 α 后皮肤差异可辨 | α 未定 ⇒ ⛔ 先回填 α |
| D-36 | `assets-spec` 7.11.6 | 四棱 / `13` 刻面暗底环 ~1 CSS px 是否成立 | 未定义 |
| D-37 | `systems-index-changelog` v1.63–v1.69 | 相机溢出行盖 HUD / 被托盘盖 | 未定义 |
| D-72 | `accessibility.md` r14 | 32 基明度档有效数 | 未定义 |
| D-70 | `g4-regression-report.md` 光敏性 | 同屏不刺眼不闪（合规侧） | 不得据 Node 宣称达标 |

> 本场次 **全部为 `未定义` 线或观感线** ⇒ 走查判定上限 `PASS*`（附截图）；需要 `PASS` 的条目由 ART 在来源补可判句后复判。

### Session 5 · 性能（严格按 `render-perf-device-baseline.md §12` 执行序）

| ID | 来源 | 查什么 | 线 | 本轮可达上限 |
|---|---|---|---|---|
| D-03 | baseline §7 · D7 | WebGL/uniform/纹理能力矩阵（**先做**） | 全机型 `MAX_FRAGMENT_UNIFORM_VECTORS ≥20`；样本 <5 ⇒ 「未达线（样本不足）」 | 样本不足（在手 ≤3 台） |
| D-01 | baseline §5 · D1 | 低端现路径帧时间（静息/操作/捏合），≥3 轮/态，噪声底 ≤10% | 低端 ≥2 台产出基线表；p10 ≥50fps 降优 / p10 <30fps 触发 `ADR-0005 §5`（S、ms/fps 口径 `[待主理人拍]`） | `PASS*（单侧，缺 L-B）` |
| D-02 | baseline §6 · D2 | E0/E1a/E2b/E3 单变量臂 | 改善 ≥ S=15%（待拍）且 ≥2 台低端同向 | 方向性预读，**不可裁定** |
| D-05 | TC-TINT-22 / T4' | tint 两路版低端帧时间 | C ≥ A×1.5 | 同 D1 批 |
| D-06 | TC-TINT-21 / T3' | 已填格两路命令/blend 入四帧账 | 实测入 `§13.12`（无数字线） | PASS* |
| D-07 | TC-MN-38；EP12-S6 | 主菜单 0.61× / 选关墙 0.81× 在低端机帧率 | 未定义；超线按 T-1 §3.8 杠杆序回落 | PASS* |
| D-08 | EP11-S7 | 皮肤池双指标真机复核，回写 α≤2 | ≤7/≤2 仍为待真机假设 | 同 D1/D2 |
| D-09 | `ADR-0030` S2 `[R]` | 载体：填充 ms / 上传 ms / 纹理字节 / draw call | `[R]` 三台（含 HarmonyOS），缺则不得记通过 | `⛔`（缺 L-B + iOS 低配） |
| D-10 | `playtest-plan.md` 第 3 轮 | L6+ 大盘低端机帧率 | ≥30fps 族 | 可判 |
| D-11 | `systems-index-changelog` v1.57 | LOD 滞回带宽/观感 | 未定义 | PASS* |

### Session 6 · 音频 / 平台 API

| ID | 来源 | 查什么 | 线 | 另需 |
|---|---|---|---|---|
| D-56 | `g4-regression-report.md` A05-27 | iOS 首手势出声；后台恢复；泄漏；首个 clip 同步开销 | 未定义 | 机上须有 `wx.createWebAudioContext`，否则 ⇒ X-01 |
| D-58 | 同上 | 首次播放某 clip 帧抖 | 未定义 | — |
| D-57 | A05-26；`playtest-plan.md §0.2` | 听感墙/叠声；「解压/治愈」 | Playtest **不得**对解压/治愈下 PASS | 真人 |
| D-62 | `test-cases.md` TC-INP-12b | 激励视频拉起/发奖 + 未看完/skip/error 三分支 | 未定义；Mock 不得作证据 | **真实广告位 unit id** ⇒ 无则 X-07 |
| D-63 | settings `vibrate` | 震动开关与系统振动 | 未定义 | 支持振动机型 |

### Session 7 · 真人 Playtest（另排日程，需外部受试者）

| ID | 来源 | 查什么 | 线 |
|---|---|---|---|
| D-73 | TC-PER-03；`playtest-plan.md` 第 1 轮 | 无文字 3s 看懂；首次落子 | ≥80% 复述「把珠子填进图案」；首次落子 ≤15s |
| D-14 / D-15 | `playtest-plan.md` PT-SKIN-01 / 4.1a | 设置态降遮罩后告急脉冲误判「计时未冻」 | 误判率 ≤10%；>20% ⇒ U17 重审（`PANEL_SCRIM_ALPHA` 目标值未定 ⇒ 先 ⛔） |
| D-16..D-21 | PT-SKIN-02..07 | 线稿 3/2px · 暗底环 · 孔径 · 小豆档 · `13` 对角 · 升级换肤察觉 | 均为 A/B 档位倾向或只观察，**无 PASS 线** |
| D-22 | PT-SKIN-08 | `18` 对 CVD 玩家可辨度 | 不得下「色盲已修」 ⇒ 依赖 X-04 |
| D-33 | `ux-spec.md` U15 | `18` 默认首屏冲突感 | 未定义 |
| D-76 | `assets-spec` 7.13；EP11-S6 P-1…P-4 | 06 出池：素人「金属边」≥4/5 等 A/B | 按规程 ①–⑤；进 registry 归用户拍板 |

---

## 4. 真机解不了的阻塞（走查前须知，⛔ 不因真机在手而解除）

| ID | 条目 | 真实阻塞 | 解除条件 |
|---|---|---|---|
| X-01 | 音频出声（D-56/57/58） | `weapp.ts::createAudioBackend` 只走 WebAudio；机上无 `wx.createWebAudioContext` ⇒ `NullAudioBackend` 永久静音（合成 PCM 不能交 InnerAudioContext） | 真机实测 API 存在；不存在则需改音频选型（采样回退，牵动主包余量） |
| X-02 | TC-TINT-12 / V-3 | mask 渗漏缺陷（§7-D1）未修 ⇒ 必红，红 ≠ 路线 FAIL | D1 双通道同写 + 四 mask 重出 + `mask:diff` 绿 + TC-TINT-09/19 绿 |
| X-03 | D8 / D-04 | Shader Spike（D4）不存在 | D3 绿 + D4 出图 + D5 draw call 达标 |
| X-04 | CVD 可辨（D-22 / D-71） | 仓内无色盲模拟取图链 | 选定 CVD 模拟工具并入取证规程 |
| X-05 | TC-TINT-17 包体增量 | 包体守卫未形成可红闭环 | 构建产物上 `check:size` 能按 tint 件数断言 |
| X-06 | WebP 导入 | 需 Creator 导入取证 | 用本机 Creator 3.8.8 导入一次截图 |
| X-07 | 激励视频（D-62） | 无真实广告位只能 Mock | mp 后台开通流量主 / 申请广告位（USER） |
| X-08 | 「结构层 ≠ 出声」 | Node 平台恒 Null（护单测） | 随 X-01 |

---

## 5. 走查后回填

1. 每条判定回填到**来源文档**的状态列（本单只是索引）；`PASS*` 必写残留（缺哪一道）。
2. FAIL 开缺陷到 `production/qa/beads/bug-severity.md` 口径（`[P?] 现象` + 复现 / 期望 vs 实际 / 环境 / 证据）。
3. 新发现的「线未定义」条目登记给判据 owner（DES/ART/ENG），不在走查现场临时定线。
4. 走查汇总交编排者做阶段裁定，结论写入 `production/release/beads/release-checklist.md §3`。

## 6. 统计

| 场次 | 条目数 | 其中线已定义（可判 PASS） |
|---|---|---|
| S1 冒烟 | 8 | 8 |
| S2 适配 | 8 | 3 |
| S3 输入 | 11 | 3 |
| S4 观感 | 18 | 1 |
| S5 性能 | 10 | 3（且受设备档限制） |
| S6 音频/API | 5 | 0 |
| S7 Playtest | 6 组 | 2 |
| 阻塞 X | 8 | — |

> 汇总来源：2026-10-15 全仓检索（`[待真机]` / `[Device]` / `DEFERRED` / `解除条件`）去重，D 编号为本单自编、不回写来源；与来源条目一一对应的编号见各行「来源」列。

## 7. 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-10-15 | 初稿：汇总全仓真机待验项 + K-044 判定上限 + 阻塞清单（P4） |
