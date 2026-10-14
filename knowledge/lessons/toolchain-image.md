# lessons · `toolchain-image` 分片（标签 `工具链图像`）

> `工具链` 片越 ctx B 门（8000 tok，2026-10-15 提交批 8133）⇒ 按 `knowledge/INDEX.md` §4
> 「该标签内部再切」取向，把 **PIL/图像工具链**类条目（K-127）子切为 `工具链图像` 新标签新片；
> 条目正文逐字节搬运，仅行内标签换名。⛔ 本片**不新增任何豁免**（判例 WXG-T-041 + K-025）。
> 引用只写 **K-0NN**；口径正本见 `knowledge/INDEX.md` §1–§4。

## 工具链图像

- **[工具链图像][K-127] PIL `ImageDraw.floodfill` 在 `L` 模式图上静默不灌（0 像素变化、不报错）⇒ 二值补洞别用它**（来源 原型 v2 第十批 / 无单，2026-10-13）
  同一套「四角灌哨兵色 → 反解未到达区＝洞」的逻辑，在 **RGB** 图上（本仓 `cut-sprites-local.py` /
  `l4-mockup.py::cut()` 用 `(255,0,255)` 哨兵）工作正常；把图换成 `Image.fromarray(uint8 2D)`（mode `L`）、
  哨兵换成单个 int，则 `floodfill` **一个像素都不改**且**不抛异常**，表现为「掩码占比恒 1.00 / bbox 等于整块裁切窗」，
  极易被误读成「阈值选错了」而反复调阈值（本批调了三轮：244→中性度→解析圆，才回查到这里）。
  口径：① 用 `floodfill` 前**先断言它真的改过像素**（灌后 `np.unique` 里必须有哨兵值）；
  ② 单实体（盘/胶囊/字块）的补洞根本不需要连通域——**逐行/逐列 span fill**（背景无命中 ⇒ 首尾命中之间必为实体）
  是确定性、零依赖、可目视复核的替代；③ 需要真连通域时走 `cut-sprites-local.py` 那条 RGB 腿。
  代码锚：`temp/l4-proto2.py::disc_mask`（span fill 版）、`games/beads/design/ai-workflows/cut-sprites-local.py`（RGB 腿）。
