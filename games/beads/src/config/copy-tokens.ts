/**
 * 文案令牌单源（copy tokens）— WXG-T-269-S6 · 子单 T-2A（EP12-S6 工程切片首落）。
 *
 * 真源链 = `design/proposals/ui-style-redesign/tokens.md` **§7**（对外称名唯一出处）
 *   ⇄ `design/proposals/ui-style-redesign/menu-architecture.md` **§6**（屏内落点表，两表同值）。
 *
 * 纪律（照抄 §6 抬头，⛔ 不在工程侧放宽）：
 * - **UI 侧不散落字面，落码一律读表**；判据**只看令牌键**，字面可换（`ux-spec §3.3`「文案映射」判例）。
 * - 本文件**不发明文案、不改值、不加键**：键名与值逐行照抄设计表；新键须设计侧先落表。
 * - ⛔ 零 `systems-index §3` 变更：文案不是冻结数值，不住 `tuning.ts`（数值）也不住 `palette`（颜色）。
 *
 * 键名口径：以设计表全名为准（`btn_*_label`）；任务单口语写作 `btn_signin`/`btn_settings` 同指本表。
 * 未收键（诚实登记）：`wall_module_name` = `拼豆小铺`（§6/§10.5 第四轮终裁）—— 该键**不上屏**
 * 「是否显示归 art 单（林绘澄）」（`tokens.md §7` 同行注），故**不设未被消费的令牌**，待其消费批再入表。
 */
export const COPY_TOKENS = Object.freeze({
    /** `tokens.md §7` / `menu-architecture §6`：招牌 4 字、对外称名唯一出处（本批 = 系统字体占位，珠拼归 T-2B）。 */
    app_name: '拼豆小铺',
    /** `tokens.md §7`（第三轮 Q3=①）：招牌下唯一副行（`font_label` 28 · `text_secondary`）。 */
    app_slogan: '一颗一颗，拼出你的小铺',
    /** `tokens.md §7`：boot/主菜单底部 label 28（承，值含 `v1.x` 占位段，发布批随版本号复核 ⇒ 归发布单，本批不擅改）。 */
    version_label: 'v1.x · 演示版',
    /** `tokens.md §7` / §6：**取代码实装值**（原 `开始拼豆` 降为史证）；唯一木主钮标签。 */
    btn_start_label: '开始游戏',
    /** §6「承（实装值）」：次级纸钮 1。 */
    btn_signin_label: '签到',
    /** §6「承（实装值）」：次级纸钮 2。 */
    btn_settings_label: '设置',
    /** §6（第五轮 §1.3 新增）：走马灯小卡下部第一行前缀（后接 `${cleared}/${total}` 数据段）。 */
    carousel_progress_label: '闯关进度',
    /**
     * §6 标 **退役**（第四轮 Q5=①：作品墙上提 ⇒ 主菜单钮删除）。
     * 退役 = **入口退役**，非字面作废：`levels` overlay 与代码按 Q5① **保留不删** ⇒ 其钮/标题仍读本值。
     */
    btn_levels_label: '选关',
} as const);
