// WXG-T-128 台账增量：领号 T-132（G5 案B framework 工程单；原定 T-131 被并发会话占用）+ 回填 T-128 状态与详情。
// 用法：node temp/t128-ledger.mjs <path> [stdin]
//   stdin 模式：从 stdin 读（HEAD 版），写 stdout（供 git hash-object）
//   无 stdin  ：就地改写工作树文件
// 头注「已分配至 / 下一可用号」按表内最大号重算 ⇒ 对 HEAD 版与他人热写版都成立。
import { readFileSync, writeFileSync } from 'node:fs';

const [path, mode] = [process.argv[2], process.argv[3]];
const src = mode === 'stdin' ? readFileSync(0, 'utf8') : readFileSync(path, 'utf8');

// 撞号登记：原定领 T-131，但并发会话在核查与写入之间领走 T-131（beads 美术质感规格，林绘澄）
// ⇒ 本单改领 T-132。幂等守卫随之改为 T-132，并修正已落盘 DETAIL_APPEND 内 2 处 T-131 引用。
const NEW_ROW =
    '| WXG-T-132 | G5案B：渲染管线全局变换通道（跨 framework） | 程基岩(eng) | 📋 已立项（待施工） | 见详情 |';

const T128_STATUS_OLD_HEAD = '| WXG-T-128 | beads 美术 v1.4「动态质感章」风格单(G1-G9 动效欠账清偿) | 林绘澄(art)+主理人(Qoder) |';
const T128_STATUS_NEW =
    T128_STATUS_OLD_HEAD +
    ' 🔄 进行中（**规格层定稿 v1.4-r2**：art 三件 + ux/gdd/audio/qa 四域回写；7 项裁定已落笔；落码拆分为 5 单待领号） | 见详情 |';

const DETAIL_APPEND = `
### 裁定与回写记录（2026-09-16，主理人复核 + 用户拍板 7 项）

**主理人三方复核结论**：改动范围合规（零代码、零 gdd/ux、零冻结常量、palette 零新增 hex）；林绘澄自报纠错的四类数字**逐条对代码复算验真**——彩带 5 色（\`STAR_GOLD #FFD23F\` == 珠色2 柠黄）、scratch 352 float（44×4×2）、A5 线宽 2.48/2.0/2.53/2.25（\`SYMBOL_REF_SIZE 64\` + \`stroke(3)=max(2,size×3/64)\` + \`TRAY_BEAD_SIZE=TRAY_SLOT−4=44\`）、图元净 −141/−580（基线 1810→1669/1230）；G6 禁飞带 \`y∈[447,787]\` 按 \`clearPanelLayout()\` **逐像素验过**（\`panel.yMin=(1334−480)/2=427\`、\`rowY=427+20=447\` = 按钮顶、缎带 \`titleY 745 ± 84/2 = [703,787]\`）。

**复核另抓 4 处缺陷（已全部修净，v1.4-r2）**：① **G2 LOD 阈值 126ms → 80ms**（卡内 \`α = 1−q\` 线性 ⇒ α≥0.6 ⇔ τ≤200×0.40=80ms；旧值系误把线性 α 当 easeIn 反解，落码按 126 会多画 46ms 十层）——错在 \`assets-spec §1.6.2/§1.6.9\` + \`art-bible §7.4\` 三处；② \`§1.6.9\`「砍掉的四层」→ **六层**（十层−保留 L1/L2/L3/L5）；③ \`accessibility\` A5⑦ G7 间隙 **4px → 3px**（\`52−48/2−50/2\`；只有被点那颗缩，4px 是「两颗都缩」的误用）；④ **改号 7 处**（\`WXG-T-127\` → \`WXG-T-128\`）。林绘澄另自查出 2 处同型残留并同批修净：A5① 取整写法 \`27+25=52 相切\` → \`26.5+25=51.5<52 间隙 0.5px\`（五处）、v1.3 遗留松口径「下压谷 ≥0.95」→ 收紧为 **0.96**（与 \`FILL_POP_SCALE_TROUGH\` 同源）。

**用户 7 项裁定（2026-09-16）**：

| # | 裁定 | 落笔处 |
|---|---|---|
| 1 | **G4 结算面板延迟 800ms 开**（庆祝先行放完再落遮罩；代价 = 过关到可点按钮多等 800ms） | \`ux-spec §5\`「过关庆祝」行 + \`bead-grid §4\` 表注 + \`art-bible §7.3.4\` / \`assets-spec §1.6.4\` 由「前提」改定案陈述 |
| 2 | **G5 采案 B（改框架，案 A 作废且不作降级预案）** | \`art-bible §7.3.5\` 全节重写 + \`§7.1\` Lv2「整屏 scale 1.015」**措辞不动**（案 B 下规格与实现一致，假绿种子消解）+ \`accessibility\` D1/D2/A5⑤/§2⑥；工程单 = **WXG-T-132**（原定 T-131，因并发会话占用改领） |
| 3 | **G7 加音效 = 新增第 20 个剪辑 \`sfx_denied\`**（非零音效、非复用 \`sfx_place\` 降 volume） | \`ux-spec §5\` 新行音效列「极轻闷「哒」」+ \`audio-events §1\` 注/§2.1/§5 Q-A05-5・6 + \`art-bible §7.5\` 注改写（**G6 仍无音效**，BD-16 判例保留）+ \`assets-spec §1.6.7\` 原子约束块 |
| 4 | **G6/G7 毫秒入 \`ux-spec §5\`**（「结算彩带」800 /「不可填格轻压」120，均复用既有行值、不新造时长） | \`ux-spec §5\` 增两行 ⇒ art 三件「§5 无此行 / 未决项 3」标注全清 |
| 5 | **LOD 只预埋 G4 的 6 层档**（G2 的 α<0.6 降 4 层与 G6 的 44→24 枚**规格保留、本轮不预埋**，只留回退阀②/③） | \`art-bible §7.4\` + \`assets-spec §1.6.9/§1.6.10/§1.8末\`；**图元改双口径**（规格口径 1669/−141；本轮落码口径 **1813/+3**，庆祝期 −580 本轮即成立） |
| 6 | **G3「全屏」限玩法区 \`y∈[0,1214]\`**（不侵入 \`HUD_BAND\`；白扫过 HUD 会让倒计时瞬时发白触 B1/E1） | \`art-bible §7.3.3\` + \`assets-spec §1.6.3/§6\`；⚠️ **主理人派单信里「HUD 在屏底」是错的**——\`systems-index §3\` 冻结「原点左下 / **y 向上**」+ §3.1「**顶部** HUD 带」，林绘澄拒绝照抄、按冻结真源写「顶部」（裁定实质与数值一字未改） |
| 7 | **1.06 = 规格起点值、非过冲量**（\`ux-spec §5\` 的 \`1.06→1.0 / 120ms\` 一字未改） | \`art-bible §7\` 主表由「ease-out-back，过冲 ≤1.05」改分段口径 + \`§7.3.1\` / \`assets-spec §1.6.1\` 读法声明块；谷 0.96 = **中间插值**，不违 §5（§5 只冻总时长与起止值） |

**主理人串行落笔的四域回写（非冻结规格文本，美术侧不改）**：

- **ux 域**：\`ux-spec §4\` 矩阵行「点锁定/已填格」由「静默忽略（零反馈）」→「**极轻非惩罚反馈**」；\`§5\` 增「结算彩带」「不可填格轻压」两行 + 「过关庆祝」行层序裁定 + **「珠子落座」行分段细化**（起点 1.06 → 谷 0.96@40ms → 终 1.00@120ms、L0a/L0b 联动、**重启门 120ms**）——补源依据：\`§5\` 事实纪律本就载有分段与门（「放错拒绝」行 60/80/60ms + 500ms 门），不补则 G1 的 40ms/门属「无源毫秒」。
- **GDD 域**：\`input-control §2.4\` + \`§8-5\` + \`§8-7\` + **v1.2 变更记录**（**§8-5 硬判据主体由「零反馈」转为「零事件」**，并显式写明「QA 不得再按旧文把 G7 轻压判成缺陷」；§8-7 与 §8-5 的 v1.1 期互斥随判据改写**消解**）；\`bead-grid §4\`（新增「（无事件）表现层轻压」行 + level:cleared 层序注）+ \`§6\` + \`§8-4\`（「零事件、零反馈」→「**零事件**」）。
- **audio 域**：\`audio-events §1\` 增变更注 + \`§2.1\` 两行归位（结算彩带 = 有意不做；轻压 = 预约）+ \`§5\` 新增 **Q-A05-5 / Q-A05-6**。⚠️ **冻结值 \`AUDIO_CLIP_TOTAL\` 19→20 本轮不动**：A05-24 是**活测试**（\`audio-dispatch.test.ts\` 断言 \`SPEC_CLIPS.length === AUDIO_CLIP_TOTAL\` 且 voice 表 ≡ clip 集），单独改 §3.12 会当场测试红 ⇒ 必须与 \`tuning.ts\` 常量 + \`audio-voices.ts\` 配方 + 测试 \`SPEC_CLIPS\` + §1 表行**同批原子提交**（解除条件六项见 Q-A05-5）。音频为**程序化合成** ⇒ 0 KB、不占包体、无需生成音频文件。
- **QA 域**：\`test-cases.md\` TC-GRID-04 / TC-INP-05 两条判据镜像（均「待实现」⇒ 改了零成本，防将来假 FAIL）；\`g4-probe-v1.1.mjs\` 增**修订 44** + P10 证据串叙述镜像（**不动任何断言/阈值/判定分支**；P10 测的是 §8-7 无选中点 empty 格，与 §8-5 锁定/已填格互斥 ⇒ 既有证据不失效、无需重跑）。

**落码拆分（5 单，施工时各自领号，不在本单预占号）**：

1. **G1 落座回弹（P0，首单）**——图元 +0、零冻结常量、零框架改动，\`_wrongFx\` 骨架 1:1 可复用（\`assets-spec §1.6.10\` 给 game 侧 5 步 + view 侧 4 步）；规格侧**已就绪**（林绘澄自评）。需工程定：\`drawFilledBead\` 的 \`FilledBeadOptions\` 扩 6 字段签名与默认值、\`bead:placed\` 的 view 侧消费者新建（现为零 = G1 P0 根因）。**D1 分支须同步接通**，否则 \`accessibility\` D1 由「N/A 诚实」转「✅ 假绿」。
2. **G2/G3/G4（P1）**——G4 含**面板延迟 800ms 开**（裁定 1）与唯一预埋的 \`lodLayers=6\`（裁定 5）；G2 作用对象**钉死为托盘槽位珠**（\`powerups.ts\`「绝不写网格」），照「消除网格珠」落码即破坏玩法状态机。
3. **G7 轻压 + \`sfx_denied\` 音频原子批**——含 \`systems-index §3.12\` 19→20 冻结变更单 + changelog 新行（主理人串行落笔）+ A05-24 五项同批；QA 侧须**新增 §8-5 独立探针用例**（事件增量 0 **且** 命令流出现 scale 覆写，按修订 25 用配对差分）。
4. **G6 结算彩带（P2）**——零 RNG lattice、44 枚 polygon、预分配 scratch 352 float；禁飞带 \`[447,787]\`。
5. **G5 案 B = WXG-T-132**（跨 \`packages/framework\`，**前置验证项 = \`FIXED_WIDTH\` 下整屏 1.015 是否露黑边**，未验证不得当已解决）。

**真机验证前置（阻塞项，登记不假装已解）**：v1.4 全部为**纸面几何核算**，真机未验（Cocos 构建阻塞，ADR-0009 P2，同 T-124/T-125 口径）。G1 落码后**首个真机抽检项** = L0a/L0b 接触阴影呼吸的观感（会不会读作「脏」而非「接触」）+ 峰值 0.5px 间隙；案 B 落码后须抽检整屏缩放致 HUD 文字 / 1px 描边的**亚像素抖动**（影响 E1/B1 观感）。若不先解构建阻塞，会重演 v1.3「F5 真机偏淡」那类事后才暴露的问题。

**美术规格侧未决项：零**（林绘澄回传 ⑤ 明述；三件文档内无条件句/待裁结构残留）。
`;

function transform(text) {
    let out = text;
    if (path.endsWith('TASKS.md')) {
        // ① T-128 状态行回填（保留原负责列，只换状态与产出）
        const lines = out.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(T128_STATUS_OLD_HEAD)) lines[i] = T128_STATUS_NEW;
        }
        out = lines.join('\n');
        // ② 插入 T-132 行（若尚未存在）：放在最后一条 WXG-T-1xx 行之后
        if (!out.includes('| WXG-T-132 |')) {
            const ls = out.split('\n');
            let last = -1;
            for (let i = 0; i < ls.length; i++) if (/^\| WXG-T-\d+ \|/.test(ls[i])) last = i;
            if (last >= 0) ls.splice(last + 1, 0, NEW_ROW);
            out = ls.join('\n');
        }
        // ③ 头注按表内最大号重算（对 HEAD 版与他人热写版都成立）
        const nums = [...out.matchAll(/^\| WXG-T-(\d+) \|/gm)].map((m) => Number(m[1]));
        const max = Math.max(...nums);
        out = out.replace(
            /当前已分配至 \*\*WXG-T-\d+\*\*（120 未启用，跳空合规），下一可用号 \*\*WXG-T-\d+\*\*/,
            `当前已分配至 **WXG-T-${max}**（120 未启用，跳空合规），下一可用号 **WXG-T-${max + 1}**`,
        );
    } else {
        // TASKS-DETAIL.md：在 T-128 节末（下一个 "## " 之前）追加裁定与回写记录
        if (!out.includes('### 裁定与回写记录（2026-09-16')) {
            const anchor = out.indexOf('## WXG-T-128');
            if (anchor < 0) throw new Error('T-128 section not found');
            const next = out.indexOf('\n## ', anchor + 10);
            const insertAt = next < 0 ? out.length : next;
            out = out.slice(0, insertAt) + '\n' + DETAIL_APPEND + out.slice(insertAt);
        }
        // 先修已落盘 DETAIL_APPEND 内 2 处撞号引用（这两串为本单独有，不误伤他的 T-131 节）
        out = out
            .replace('工程单 = **WXG-T-131**', '工程单 = **WXG-T-132**（原定 T-131，因并发会话占用改领）')
            .replace('**G5 案 B = WXG-T-131**', '**G5 案 B = WXG-T-132**');
        // T-132 详情节（追加到文件末尾）
        if (!out.includes('## WXG-T-132')) {
            out = out.replace(/\s*$/, '\n') + '\n## WXG-T-132\n\n' + T131_DETAIL;
        }
    }
    return out;
}

const T131_DETAIL = `
**G5 案 B：渲染管线全局变换通道（跨 \`packages/framework\`）** · 负责：程基岩(eng) · 状态：📋 已立项（待施工）

- 起因：WXG-T-128 美术 v1.4 缺口 **G5**——连击 Lv2「伪震屏」需**整屏 scale**，而渲染管线**无全局变换通道**（\`RenderModelBuilder._commands\` 为 \`private readonly\`，\`RenderModel\` 仅 \`begin/build\`、无变换字段；WXG-T-074 已登记）。视图侧现行处置 = **不假造替代画面**（\`view-model.ts::drawComboVfx\` 头注：\`'pseudoShake'\` 分支空实现，快照 \`comboVfxProgress\` 照常推进）。
- **用户裁定（2026-09-16）**：采**案 B（改框架）**，案 A（全场 filled 珠面齐脉冲 scale 1.00→1.015→1.00，约 15 行、不改框架、冲击感打约 6 折）**作废且不作降级预案**。
- 交付面：\`RenderModelBuilder\` 增全局变换通道（如 \`setTransform({ scale, anchorX, anchorY })\`）+ \`RenderModel\` 承载可选变换位 + **两个 adapter 各自实现**（web 2D context 变换 / \`CocosRender2D\` 节点缩放）。规格真源 = \`art-bible §7.3.5\`（v1.4-r2 定案段）+ \`§7.1\` Lv2 行「整屏 scale 1.00→1.015→1.00，150ms」（**措辞未改**，案 B 下规格与实现一致）。
- **前置验证项（不得当已解决）**：\`FIXED_WIDTH\` 下整屏放大 **1.015** 是否**露黑边**——设计空间 750×1334、\`systems-index §3\` 冻结「原点左下 / y 向上 / FIXED_WIDTH」，缩放锚点与视口填充策略须先给结论再动接口。
- 铁律与风险：跨 \`packages/framework\` 域 ⇒ **全矩阵回归**（framework + beads + breakout 三包测试 + \`check:arch\` L2「core 禁 cc/DOM/wx」不得因变换通道破例）；\`sync-framework-to-cocos\` 镜像须同批；**热路径零分配**（变换位不得逐帧 new）；L5「UI/渲染不持有游戏状态」不破。
- a11y 口径（\`accessibility\`，不随选案变）：D1 **整条关停**（\`reduceMotion\` 开 ⇒ 无缩放）；D2 单峰非周期 ⇒ 不构成闪烁；A5 峰值 50.75px < pitch 52 ⇒ 零重叠。**真机观察项**：整屏缩放会使 HUD 文字与 1px 描边产生**亚像素抖动**，影响 E1/B1 观感 ⇒ 落码后须真机抽检（现 Cocos 构建阻塞，ADR-0009 P2）。
- 图元：净 **+0**（变换不改图元数）。毫秒真源 = \`ux-spec §5\`「连击 ×3（Lv2）」行 **150ms**（冻结，不改）；幅度复用既有 \`COMBO_SHAKE_SCALE_MAX\`（**零新增冻结常量**）。
- **编号说明**：本单原拟领 \`WXG-T-131\`，但并发会话在主理人核查（表内最大号 130）与写入之间领走 T-131（beads 美术质感规格，林绘澄）⇒ **改领 T-132**。撞号由幂等守卫拦下（worktree 侧未误插状态行），已落盘详情内 2 处 T-131 引用同批修正；诚实登记不掩盖。
- **交叉依赖**：\`art-bible §7.3.5\`（v1.4-r2 定案段）现与并发会话的 **v1.5「纯色底 + 光影材质」**（T-131）叠加共存于同一文件，本单施工前须以**当时最新的 art-bible** 为准复核 §7.1 Lv2 行措辞是否仍为「整屏 scale 1.00→1.015→1.00，150ms」。
`;

const result = transform(src);
if (mode === 'stdin') process.stdout.write(result);
else writeFileSync(path, result);
