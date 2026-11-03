# 验收清单

## 用户已拍板（不得回退）

- [x] 右上角标记全去掉
- [x] 进度数据 = 当前大关已完成小关 / 总小关
- [x] 三态 = 同一张大关 PNG，只差灰度量
- [x] 先渲染对照再落码（Phase 0 已完成，用户已裁决通过）
- [x] 灰度档 = 1.0 / 0.55 / 0；居中沙漏章一并删
- [x] **最终修正**：推关不再是整图 0.55，而是**从下到上的彩色 mask**（`grayWipe`，比例 = done/total）；磨砂玻璃已由 T-567 落地（`frost` = 预烘模糊）

## Phase 0

- [x] `?artGray` 参数缺省时行为与今日逐字节一致（`artGray=0` 与无参数逐像素 `diff bbox = None`）
- [x] 4 帧同机位、同帧号
- [x] 对照图已给用户，且用户明确通过或改档

## Phase 1

- [x] `grayFx` 对越界值夹取、键序固定、JSON 安全
- [x] `grayFxRead` 对 `undefined` / 无键返回 `undefined`
- [x] tint 与 gray 同时存在时 `base` 优先
- [x] 无 fx 路径零行为变化

## Phase 1（揭彩扩展）

- [x] `grayWipeFx` 载荷 = `[progress, soft]`、两值夹取、JSON 安全
- [x] `grayWipeRead` 对缺键 / 非数组 / 短板 / 非数字返回 `undefined`
- [x] 揭彩像素：顶部灰、底部原色、柔带逐行过渡（`soft=0` 硬边）
- [x] 揭彩缓存 = 每纹理最新一档（不随进度累加）

## Phase 3

- [x] 判档仍取 `_arcState`（首关已解锁未通关 = 推关，`done` 可为 0；⛔ 不用 `done === 0` 判 locked）
- [x] 推关 fx = `{ grayWipe: [done/total, 0.08] }`；锁定 = `{ gray: 1 }`；通关 = 无 fx
- [x] 对页揭彩用 `carouselPeerArcDone/Total`（不借用主车进度）
- [x] 菜单命令流中**不含** seal / badge 两枚 blit
- [x] 柜灯三档强度可见差异
- [x] 视图层未 `import { LEVELS }`、未持状态
- [x] 未开启磨砂玻璃 — T-567 落地（`{ frost: 8 }`，1/4 尺寸模糊缓存）

## Phase 4

- [ ] `pnpm run verify` 全绿
- [ ] `pnpm run check:links` 通过
- [ ] K-6 / 金样本已重抓并登记 §12
- [ ] 提交含 WXG-T-566 且已 push（`git ls-remote` 取证）
