# lessons · `environment` 分片（标签 `环境`）

> 由 `knowledge/lessons.md`（WXG-T-111 按行内标签分片）逐字节搬运而来；本片条目**按 ID 升序**。
> 引用只写 **K-0NN**；口径正本（B 门不豁免 / 新标签 = 新片）见 `knowledge/INDEX.md` §1–§4。

## 环境

- **[环境][K-010] WorkBuddy 沙箱内 bash grep/链式命令会假阴性（空输出 + exit 1）**（来源 WXG-T-020 验收，2026-09-12）
  现象：bash 里 `grep` 明明有匹配却返回空输出，差点误判「成员交付未落盘」。
  根因：沙箱对管道/链式命令的执行怪象（本会话出现 ≥3 次）。
  规避：核验文件内容一律用专用 Grep/Read 工具；bash 只用于跑构建/测试/git。
