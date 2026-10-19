# Session 1 真机取证执行卡（2026-10-19）

> 本轮只做 **Session 1 · 冒烟与首屏**（含新增 **D-77 位图腿屏幕层序**）。任何一条 `FAIL` 即停后续场次（`device-walkthrough.md §3` 规则）。
> 判据、通过线、判定上限一律以 [device-walkthrough.md](../../device-walkthrough.md) 与其「来源」列所指文档为准，**本卡不新造判据、不预写 PASS**。

## 0. 仓库侧已备好（无需你操作）

| 前置 | 实测状态（2026-10-19 09:19） |
|---|---|
| 产物 | `games/beads/cocos/build/wechatgame` —— 先 `pnpm run framework:sync` 再 CLI `build:cocos`（默认 **release** 档，38.1s） |
| 包体 | 主包 **3188.2 KB / 108 文件 ≤ 4096**（`check:size` OK，无「疑似 debug」提示） |
| 包内资产 = 仓内投放件 = 设计正本 | `check:cocos-mask` 全绿：需求集齐张 + 18 件菜单纹理**字节相同**（含 ◀▶ 两件新配方投放件，BD-61 修复真进了包） |
| 旧包歧义已消除 | `build/wechatgame-001` → `build/_archive-wechatgame-001-20260929`；Cocos profile `outputName` 已改指 `wechatgame`（本地设置，未入仓） |
| AppID | 三处一致 `wx8cf9f756e5390749` |
| 待你确认 | 开发者工具登录态（须有该 AppID 的开发权限）+ vConsole 开关 |
| 预览通道 | ✅ 2026-10-19 09:3x 已由 MCP `run_game` 拉起 `http://localhost:3847`；**SIM 预读记录**：未登录态下点「编译」不注入代码（`PREVIEW_SIM_boot_1.png` / `_boot_2.png`：黑屏、iframe body 长 0、`cc` 未加载、Console 0 条）⇒ 定性为**未编译**而非产物黑屏；本记录只作通道诊断，**禁作真机判据**（K-044 §0-4） |

## 1. 你要做的操作（约 20 分钟）

0. **预览通道已帮你拉起**：`http://localhost:3847`（微信小游戏预览器，由 `weixin-minigame-helper` MCP 以
   `games/beads/cocos/build/wechatgame` 为工程启动）。若没在跑，重调一次 MCP 的 `run_game` 即可。
   ⚠ 该网页预览器自有一个登录态，**与 IDE 登录态不互通**（实测：`cli islogin` 已返回 `{"login":true}`，
   而这个页面仍是黑屏 + 登录钮 ⇒ 未注入）。⇒ **不必再纠结这个页面，直接走第 3 步的二维码。**
   （保留记录：未登录时点「编译」不注入代码——模拟器黑屏、iframe `body` 长 0、`cc` 未加载、Console 0 条
   ⇒ 那是**未编译**，不是产物黑屏，别误报缺陷。）
1. （若不用上面那个预览窗口）微信开发者工具「导入项目」→ 目录选 **`games/beads/cocos/build/wechatgame`**（⛔ 不要选 `build/` 父目录，那里的 `project.config.json` 是误生成物、AppID 不同）。
2. 「详情 → 本地设置」勾上调试相关项以便真机出现 **vConsole** 按钮；日志拿不到就改用 `wx.showModal` 弹窗取证（不要因此跳过性能项）。
3. **二维码已经生成好了（2026-10-19 10:0x，IDE 登录态可用后）** —— 直接用微信扫
   `temp/wxg294-preview-qr.png`（预览码会过期，过期就让主理人重跑下面这条命令，十几秒出图）：

   ```bash
   /Applications/wechatwebdevtools.app/Contents/MacOS/cli preview \
     --project "$PWD/games/beads/cocos/build/wechatgame" \
     --qr-format image --qr-output temp/wxg294-preview-qr.png \
     --info-output temp/wxg294-preview-info.json
   ```

   实测回读：`✔ preview`，**包总大小 3.1 MB（3,223,484 B）**——与 `check:size` 的 3188.2 KB 同一份产物，
   且**低于微信 4 MB 主包上限 ⇒ 平台侧接受这个包**（这是首次跑通的上传腿）。
   ⚠ 重要事实更正：`cli preview` 走 **IDE 登录态**，**不需要**上传密钥与 IP 白名单；只有
   `cli upload`（上传开发版）才需要。⇒ 本卡原写的「需上传密钥」仅适用于 upload。
4. 用手机扫码后，在**两台**设备上各跑一遍 §2 表：L-A = 华为畅享 90 Pro Max（ohos / dpr3）；
   iOS 侧（A11–A13 缺，HIGH 机可先跑功能与适配，**性能结论上限 `PASS*`**）。
   ⚠ 预览码有效期内不要重复跑 `preview`（会作废上一张）；扫码后手机上打开的就是**当前这份产物**。
5. 按 §2 表逐条操作并截图/录屏，文件放进本目录，命名 `<条目ID>_<机型档>_<序号>.png`（例：`D-77_LA_1.png`、`D-66_iOS_1.png`）。
6. 顺带记录三件事（有则写，无则留空，不要编）：冷启动秒表 3 次读数、是否出现任何弹窗报错、画面异常的具体格位。

## 2. 逐条操作与预期（Session 1）

| ID | 你做什么 | 期望看到什么（线来自来源文档） | 要留的证据 |
|---|---|---|---|
| D-39 | 扫码后看手机能不能正常拉起（来源 `test-cases.md` DEV-02「出包成功」） | 能进游戏、无 AppID / 域名报错。⚠ 仓库侧已跑通一半：`cli preview` 返回 `✔ preview`、包 **3.1 MB < 4 MB 主包上限** ⇒ 平台侧已接受这份包（走 IDE 登录态，不需上传密钥）；**仍待确认的是手机上真能跑起来** | 手机首屏照 1 张（可与 D-75 共用） |
| D-75 | 冷启动 | 首屏 = **主菜单**（非直进玩法，现口径） | 1 张首屏照 |
| D-69 | 看主菜单整体 | 走 blit 载体**不空白**；若空白 ⇒ 记为需 `carrier=off` 回退阀 | 1 张 + 现象描述 |
| **D-77** | ①点橱窗 Boss 图进选关墙 ②看**第 9 格**（L9 曼陀罗）③点 ◀▶ 翻页并按住 ④看橱窗与走马灯 | ①第 9 格出现**照片缩略**（不是程序化珠阵），且不被面板/卡片底色盖住；② ◀▶ **按下态与非按下态肉眼可分**（两件投放件互异）；③位图晚到时回退程序化不白屏 | **实拍屏面**≥3 张（选关墙 / ◀▶ 静息与按下 / 主菜单橱窗）。⛔ 只给「日志无 warn、命令已发出」不算证据（`control-manifest §19` 前置 2，判例 WXG-T-271） |
| D-74 | 主菜单 → 点 Boss 进选关 → 进关；点未解锁格 | 链路通；**未解锁格零响应**（不进关、不弹错） | 1–2 张 |
| D-59 | 杀进程重开 | 停在主菜单；主钮与橱窗反映当前关；点主钮扣心开局 | 1 张前后对照 |
| D-60 | 游戏中按 Home（`onHide`）→ 回到前台（`onShow`） | 自动暂停；回来停在 PAUSED 面板，不扣时 | 1 段录屏或 2 张 |
| D-61 | 改设置（风格 / 豆径 / 皮肤）→ 杀进程重开 | 与关前最后一帧一致 | 1 张设置页 + 1 张重开后 |
| D-66 | 冷启动计时 3 次取中位 | ≤1.5s（通用口径；beads 未另钉 ⇒ 达标也只能判 `PASS*`） | 3 个读数写入本目录 `D-66_<档>_timing.json` |

## 3. SIM 预读（开发者工具模拟器，2026-10-19 15:03 实拍屏）

> ⛔ **本段不是真机判据**（K-044 §0-4：模拟器读数禁作证据），只用于提前收窄真机诊断方向。

模拟器（iPad Pro 13 档，`brand: "devtools"`）实跑一帧，控制台与画面同时可见：

| 读数 | 值 |
|---|---|
| `LoadScene db://assets/Main.scene` | 20.44 ms |
| `[BeadsBlitCarrier]` 静态位图装载 | **21/21 已装载 → 落 UI blit 层** |
| `[BeadsBlitCarrier]` mask 腿 | `masks=4/4`、`carrier=on` |
| 装载来源 | mask 腿 = bundle `textures`；位图腿 = bundle `themes` |
| WEBP 能力 | `sys.hasFeature=true`（注意：交付格式已统一 PNG，本行只规能力探测） |

**两个结论**：

1. 装载腿日志全绿而屏幕是否真看得见仍需实拍——这正是 WXG-T-271 的同型形态，所以 D-77 只认屏面图；
2. 主菜单橱窗里看到的是**空玻璃柜 + 「第 9 关」木牌**，无位图内容——需 ART 确认这是预期（无作品时就是空柜），
   还是「位图腿落层不对/尺寸为零」的真缺陷。⇒ 真机第一轮先看这一点，能省一轮往返。

## 5. 回传之后谁做什么

- 我把读数与截图回填 [device-walkthrough.md](../../device-walkthrough.md) §3 判定/证据列与 §5/§6，并同步各**来源**文档的状态列（不代判阶段）。
- 阶段裁定 `PASS / CONCERNS / FAIL` 归编排者（`wxgame-orchestration`）；`线 = 未定义` 的条目最多判 `PASS*`（K-044 判定上限）。
- 出现 `FAIL` ⇒ 按 `bug-severity.md` 开 BD 号（当前工作树在册最大 = BD-61，新号从 **BD-62** 起，领号先全树 grep 防撞，判例 K-046/K-050）。

## 6. 三条禁忌（防假绿）

1. ⛔ 模拟器 / 开发者工具 / `web-mobile` 的读数当**真机证据**（它们只作方向参考，`render-perf-device-baseline.md §2` SIM 档禁作判据）。
2. ⛔ 把「缺通道」写成「预期内通过」——拿不到日志就记 `⛔ BLOCKED` + 解除条件。
3. ⛔ 用 10-18 20:24 那份旧产物做本轮取证：它**不含** BD-61 重烘的两件 ◀▶ 投放件，测出来的按下态结论与仓内代码不同源。
