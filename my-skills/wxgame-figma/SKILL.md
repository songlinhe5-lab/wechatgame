---
name: wxgame-figma
description: 从 Figma 设计稿取数据与导出切图时使用（走 FIGMA_API_KEY + REST，五 IDE 共用同一脚本，不需要 MCP、不需要 Dev/Full 座位）。触发：figma、设计稿还原、node-id、导出切图、设计 token、对设计稿。
---

# wxgame-figma — Figma 只读取数/导出（PAT · 五 IDE 统一）

本 skill 是**执行层**：把「拿到一个 figma.com 链接之后敲什么命令、产物落哪、怎么验收」排好。

## 0. 为什么不走 MCP（2026-11-03 实测，别再重跑）

| 路线 | 实测结果 | 结论 |
|---|---|---|
| 远程 `https://mcp.figma.com/mcp` | 无凭证 `401`；`X-Figma-Token: <PAT>` 仍 `401`；`Authorization: Bearer <PAT>` 回「figd_ tokens must be passed via X-Figma-Token header」；OAuth 动态注册 `POST /v1/oauth/mcp/register` → **`403 Forbidden`** | 远程 MCP 是**白名单制**，只认 catalog 内客户端。CodeBuddy / Cursor / Qoder / Trae 均不在列，无法自助注册 ⇒ **此路作废** |
| 本地 `http://127.0.0.1:3845/mcp` | 端口恒不监听；官方文档：桌面版 local MCP 需 **Dev 或 Full 座位** + Professional/Education/Org/Gov/Enterprise 计划 | 无座位即无解，且开关须人工在 App 内勾选，脚本无法代劳 |
| **REST + PAT** | `GET /v1/me` → `200`（身份已验证） | ✅ **本 skill 走的路线**，五 IDE 通用，零 MCP 依赖 |

## 1. 凭证

`FIGMA_API_KEY`（`figd_` 开头）—— 优先级：环境变量 → 仓库根 `.env.local`。脚本自己读，**不要**把它写进 skill、命令或提交物。

```bash
# 自检一句话
node my-skills/wxgame-figma/scripts/figma.mjs me
```

失效表现：`HTTP 403`（token 权限不足）或 `HTTP 401`（token 已撤销）。换 token 只改 `.env.local`。

## 2. 四条命令

脚本：`my-skills/wxgame-figma/scripts/figma.mjs`（Node 内置 fetch，**零 npm 依赖**）

| 命令 | 用途 | 示例 |
|---|---|---|
| `me` | 验凭证/查身份 | `node …/figma.mjs me` |
| `tree <url\|key> [--depth 2] [--max 200]` | 打印图层树（`id / type / name / 尺寸@坐标`），用来**定位 node-id** | `node …/figma.mjs tree "https://www.figma.com/design/KEY/Game" --depth 3` |
| `node <url> [--out f.json]` | 取单个节点瘦身 JSON（几何 / fills / 圆角 / 布局 / 文本 / 子节点递归） | `node …/figma.mjs node "…?node-id=12-34" --out temp/figma/n.json` |
| `img <url> --out <dir> [--format png\|svg\|pdf] [--scale 2] [--ids 1:2,3:4]` | 导出并下载图片 | `node …/figma.mjs img "…?node-id=12-34" --out temp/figma` |

要点：
- 链接里 `node-id=12-34` 的 `-` 自动转成 API 的 `:`；`--ids` 手写时用 `:` 或 `-` 都行。
- `tree` 默认只下钻 2 层、最多 200 行 —— **防大文件刷爆上下文**，要更深显式给 `--depth`。
- `img` 未给 `--out` 时落到 `temp/figma/`（已 gitignore）。

## 3. 标准流程

1. **先 `tree`** 看清层级，拿到目标 node-id —— 不要一上来 `node` 整个页面。
2. 要**还原度**（颜色/圆角/间距/字号）→ `node`；要**出图** → `img`（切图默认 `png --scale 2`，矢量图标用 `svg`）。
3. 产物落到 `temp/figma/`，人工/目视筛选后再入库。

## 4. 产物落位

| 用途 | 落点 |
|---|---|
| 中间产物、比对图 | `temp/figma/`（不入库） |
| 正式切图 / 参考图 | 按该游戏的 `assets-spec` 与 `menu-*` 落地单；**先查 `games/<game>/design/art/specs/`**，不要自创目录 |
| 设计 token 对照 | 只写进设计文档，⛔ 不进代码硬编码（颜色真源是 `palette.ts` / systems-index） |

## 5. 能力边界（写清，免得白试）

- **只读**。Figma REST 不能写画布；`POST /v1/files/...` 一类写入能力不在 PAT 常规权限内。
- **变量接口**（`/v1/files/:key/variables/local`）需企业版计划，普通 PAT 会 `403`。
- **导出上限**：节点过大或含 Figma 原生特效（模糊/图层混合）时，`images` 返回空 URL —— 脚本会提示跳过，此时改用 `--format svg` 或缩小到子节点。
- 速率限制：429 时按响应 `Retry-After` 退避，别并发轰。

## 6. 自检

```bash
node my-skills/wxgame-figma/scripts/figma.mjs selftest   # URL / 裸 key / 非法输入 三例
```

改了 `parseTarget` 或加子命令必须让它过。

## 7. 与其它 skill 的关系

- 出图/mockup：`wxgame-image-gen`（本 skill 只**取**设计稿，不生成）
- 美术规格与还原度审计：`wxgame-art-spec-programmatic` / `wxgame-art-review`
- 五 IDE 生效方式：`my-skills/` 为正本，`.cursor` / `.codebuddy` / `.workbuddy` / `.qoder` / `.trae` 的 `skills/` 下为相对符号链接（`pnpm run check:links` 机械守）
