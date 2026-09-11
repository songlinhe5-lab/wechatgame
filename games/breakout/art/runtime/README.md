# 运行时资源目录约定（art/runtime）

> 项目：微信小游戏矩阵 · 首款 demo《砖阵》
> 版本：v1.0 ｜ 作者：林绘澄
> **本文档定义规范；demo 阶段本目录为空，不存放任何真实美术文件。**

---

## 1. demo 阶段的现实

- 《砖阵》demo **不引入任何外部美术文件**，全部由 Cocos `Graphics` / 纯色 `Sprite` 程序化绘制。
- 因此 `art/runtime/` **当前为空目录**。它的存在是为了**固定未来资产落位的约定**，让程序无需在替换资产时改路径。

---

## 2. 目录结构（未来真实资产落位）

```
games/breakout/art/
├── art-bible.md            # 视觉身份（本文档同级）
├── assets-spec.md          # 资产规格
├── accessibility.md        # 可访问性
├── source/                 # 【源文件】PSD / Aseprite，不进包
│   ├── brick.psd
│   ├── paddle.psd
│   └── ui_kit.aseprite
└── runtime/                # 【运行时导出】== 未来映射到 Cocos assets/
    ├── textures/
    │   ├── gameplay/       # brick_*(5 型)  paddle_*  ball  item_*(6 种)
    │   ├── ui/             # ui_btn_*  ui_panel_*  ui_icon_*
    │   ├── bg/             # bg_*.png
    │   └── vfx/            # vfx_*.png
    ├── atlases/            # atlas_gameplay_01.png/.plist  atlas_ui_01.*
    ├── fonts/              # （默认不使用；若启用位图字体放此）
    └── audio/              # （音频归阮和鸣，仅登记占位）
```

> **映射规则**：`art/runtime/` 的子树与 Cocos 工程 `assets/` 对应；落码时引擎内路径 = `assets/<runtime 下的相对路径>`。

---

## 3. 命名规则（强制）

- 全小写 + 下划线；禁止空格、中文、大写、连字符。
- 模式：`{域}_{实体}_{变体}_{状态}.{ext}`
- 域：`bg` / `brick` / `ball` / `paddle` / `item` / `ui` / `vfx` / `audio`
- 示例：
  - `textures/gameplay/brick_t_damaged.png`、`textures/gameplay/brick_g_default.png`
  - `textures/gameplay/paddle_body_normal.png`
  - `textures/gameplay/item_expand.png`
  - `textures/ui/ui_btn_pause_normal.png`
  - `textures/ui/ui_btn_pause_pressed.png`
  - `textures/vfx/vfx_brick_burst_sheet.png`
  - `atlases/atlas_gameplay_01.png`
- 源文件与导出**同名**，仅存放位置不同（`source/` vs `runtime/`）。

---

## 4. 格式与尺寸规则

| 类型 | 格式 | 尺寸规则 |
|---|---|---|
| 砖块 / 挡板 / 球 | PNG（透明） | 严格按 `assets-spec.md` §1 表所列尺寸导出，**@1x 与设计像素 1:1** |
| UI 图标 / 按钮 | PNG | 同上；可做 9-slice 的用 9-slice，导出含边框 |
| 背景 | PNG / JPG | 750×1334（竖屏）或 2048×2048 可平铺纹理 |
| 图集 | PNG + plist/json | 1024 × 1024，UI 与 gameplay 分开，padding 2px |
| 源文件 | PSD / Aseprite | 不限，仅存 `source/`，不进包 |

- **@2x/@3x**：Cocos 走设计分辨率缩放，**默认只出 @1x**；确需高清时按 `_@2x` 后缀追加，并在 `assets-spec.md` 登记。
- **禁止**：把 `source/` 或未压缩大图放进 `runtime/`。

---

## 5. 入库检查清单（替换真实资产时逐条核对）

- [ ] 文件名符合 §3 命名规则。
- [ ] 尺寸与 `assets-spec.md` §1 一致（误差 0）。
- [ ] 已压缩（PNG-8 / ASTC），单图 ≤ 800 KB。
- [ ] 已登记到 `assets-spec.md` 的包体预算表实际大小列。
- [ ] 无孤立文件（每个文件都在规格表中有引用）。
- [ ] 图集已分离 UI / gameplay，关闭砖块与挡板的 trim。

---

*本目录约定冻结后再由程序引用；变更路径即视为破坏性改动，须同步通知程基岩。*
