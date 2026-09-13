# Breakout Cocos 工程操作单（3.8.8 实机逐击版）

> 2026-09-13 · 主理人整理。UI 文案取自本机插件源码 i18n（`~/.CocosCreator/extensions/cocos-mcp-server/i18n/zh.js`）与 Creator 3.8.8 实机菜单，比 `docs/agent/cocos-setup.md` 更贴近实际界面；冲突时以本文为准，完成后本文的「实测」结论回填 setup 文档。

## 0. 当前状态与一次性迁移（主理人代做）

- 编辑器当前开的是 `games/breakout/cocos/NewProject/`（Dashboard 新建时不允许选非空目录，所以多套了一层）。
- **迁移**：关闭编辑器后由主理人把 `NewProject/{assets,settings,package.json,tsconfig.json,profiles}` 上移一层到 `games/breakout/cocos/`，删缓存 `library/ temp/`，`package.json` name 改 `breakout`。工程可无损搬移（uuid 不变）。
- 之后在 Dashboard 用「**打开**」（不是新建）选 `games/breakout/cocos/`。

## 1. 阶段 B — 工程设置（编辑器里 5 分钟）

打开工程后：

**B1 设计分辨率**
1. 顶部菜单 **项目 → 项目设置**（快捷键无；左侧分类列表）
2. 选 **项目数据**：设计宽度 `750`、设计高度 `1334`，勾 `适配高度(Fit Height)`、不勾 Fit Width → 右下 **保存**
   （对应 `settings/v2/packages/project.json` 的 `designWidth/designHeight/fitHeight`）

**B2 功能裁剪（决定主包 ≤4MB）**
1. 同一 **项目设置** 窗口左侧选 **功能裁剪**
2. **只保留**：`2D` 相关的 **Graphics、Label、UITransform**（引擎模块里 2D 基础必留）
3. **去掉**：3D、物理（Physics）、粒子、动画/补间、Spine、DragonBones、Video、WebView、TiledMap、VR 等
4. **保存** → 菜单 **开发者 → 编译自定义引擎** 不需要；直接进 B3

**B3 建场景与唯一节点**
1. 左下 **资源管理器** `assets` 右键 → **创建 → 场景**，命名 `Main`，双击打开
2. 左上 **层级管理器** 空白处右键 → **创建 → 空节点** → 重命名 `GameRoot`
3. 选中 `GameRoot` → 右下 **属性检查器** → **添加组件** → `UITransform`，内容尺寸 `750 × 1334`
4. （Bootstrap 脚本：先跳过——框架引入方案按 README §2 待编辑器实测后再加，不影响 B/D/F 完成）
5. `Cmd+S` 保存。**校验：层级里只有 `Main` → `GameRoot`，别无他节点（ADR-0003）**

## 2. 阶段 D — 启动 MCP 服务（1 分钟）

1. 菜单 **扩展 → 扩展管理器** → 上方切 **全局** 标签 → 列表里找 `cocos-mcp-server`（名称显示「Cocos MCP 服务器」）→ 确认开关为**启用**（若列表为空或灰色：看 §4 排错）
2. 菜单 **扩展 → 打开 MCP 面板**（i18n 原文 `打开 MCP 面板`）→ 弹出 **MCP 服务器** 面板
3. 面板内：**端口** `3000`（勿改）→ 勾 **自动启动** → 点 **启动服务器**
4. 状态行应显示「服务器正在端口 3000 上运行」
5. 终端验证（**必须带 `--noproxy '*'`**，本机代理会劫持回环）：
   `curl -sS --noproxy '*' -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/mcp` → 非 `000` 即可达

## 3. 阶段 F — 工具白名单（L1 防线，2 分钟）

1. MCP 面板里点 **工具管理器**（或菜单 **扩展 → Cocos MCP Server → 打开工具管理器**——i18n：`工具管理器`/`打开工具管理器`）
2. **新建配置**（或编辑默认配置）→ 按前缀设置启用/禁用：
   - ✅ 启用：`project_*`、`debug_*`、`asset_*`、`validation_*`、`server_*`、`broadcast_*`
   - ❌ 禁用：`scene_*`、`node_*`、`component_*`、`prefab_*`、`sceneView_*`、`referenceImage_*`、`preferences_*`
3. **应用配置** → **保存设置**
4. 校验：回 MCP 面板或 IDE 侧工具列表，**不应再出现** `scene_add_node` 等写接口（缺失即正确）

## 4. 排错速查

| 症状 | 处置 |
|---|---|
| 扩展管理器看不到插件 | 确认目录 `~/.CocosCreator/extensions/cocos-mcp-server/` 里有 `package.json` 与 `dist/main.js`；没有则 `cd` 进去 `npm run build` |
| 面板启动失败 | 先 `node -v`（插件构建与运行需 Node ≥18）；看面板调试日志 |
| curl 000/连接拒绝 | 服务没起或端口不是 3000；确认面板状态行 |
| curl 502 且端口明明没起 | 代理劫持回环——加 `--noproxy '*'`；根治：shell 加 `export NO_PROXY=127.0.0.1,localhost` |
| IDE 侧 MCP 显示连接失败 | 编辑器没开/服务没启动属**预期**；开了才连得上 |
| 工具列表没有 `scene_*` | 正常，是 F 禁用的结果 |
