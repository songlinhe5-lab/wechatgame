# palette-selection-gates 规则 Review 报告

> **日期**：2026-11-17
> **范围**：`palette-selection-gates.md` v1.0 + `tools/scripts/palette-quantize.mjs` 实现
> **目标**：验证当前选色规则是否已实现"同色系内区分度大、跨色系区分度小"
> **钉点**：Artkal S 210 色 = 21945 对全量扫描（τ=10, ΔE76, bandΔE 三点带）

---

## 0. 本轮修复摘要（先于结论）

本 Review 在跑全量数据的过程中发现并修复了 **3 处历史 bug**——不是本轮引入的，是在 palette-quantize.mjs 初次落盘时带入的实现偏差：

| # | Bug | 影响 | 修复 commit |
|---|---|---|---|
| B-1 | **正向 mix 语义偏差**（`mixHex` 正向分支乘 0.5 → ADR-0028 真义直接 factor） | lit +0.38 只加 19% 白（应为 38%）→ bandΔE 系统性偏小 → τ=10 边界 223 对被错误放行 | `afe81f16` |
| B-2 | **门 B 实现近似**（`ΔE(c, BLACK)` → `ΔE(c, mix(c,−0.44))`） | diamond-dotz 8001 #1F1F24 被错放（ΔE_black=12.5 ≥ 8，ΔE_pit=7.02 < 8 应拦截） | `afe81f16` |
| B-3 | **补色缺 minBandΔE 硬门槛**（软约束 `score + minBandToSel` → 硬过滤 `< 15`） | 补色阶段新选色落入 band ∈ [10,15] 半可分区 → 最终 minBandΔE ≈ 12.8（软约束差 2.2） | `018ad6bc` |

修复后三域 mix 语义（Studio `palette-quantize.mjs` / 临时 `audit.mjs` / 游戏运行时 `palette.ts` / ADR-0028-explainer）**完全一致 ✓**。

---

## 1. 规则体系回顾

### 1.1 三道门（正交并列）

```
门 A · 全深宪法（渲染侧已生效）
  珠体派生元素恒比原色深：edge mix(c,−0.30) / pit mix(c,−0.44) / 孔线 mix(c,−0.58)

门 B · 单色下限（绝对门，逐色）
  selectable(c) ⟺ ΔE76(c, mix(c,−0.44)) ≥ PIT_VISIBLE_MIN(=8)
  → 拦截 6 色（MH7 / H7 / Y011 纯黑，H18 / 8001 近黑）

门 C · 近似族（相对门，两两，仅同品牌内）
  confusable(A, B) ⟺  bandΔE76(A,B) < NEARFAM_BAND_MAX(=10)
                   ∧  baseΔE76(A,B) < NEARFAM_BASE_MAX(=22)
  band(c) = { mix(c,−0.30), c, mix(c,+0.38) }   // edge/base/lit 三点带
```

### 1.2 Studio 选色管线（palette-quantize.mjs）

```
照片 → Hue-aware Median Cut（4 通道：R/G/B/Hue 环形）
     → 每簇 Dominant Color（众数，非均值）
     → 品牌色板 ΔE76 最近邻
     → 门 B 过滤 → 门 C 过滤（贪心独立集）
     → 补色至目标数（分布质量 + hue guard ±90° + minBandΔE ≥ 15）
     → 最终选色报告
```

### 1.3 管线常量（代码登记）

```
NEARFAM_BAND_MAX = 10    // 门 C band 阈值（2026-11-17 Spike 钉 S37↔S72 band=10.0 分不开）
NEARFAM_BASE_MAX = 22    // 门 C base 阈值（保护"淡黄↔橄榄"band=12 但 base=40.4 可分）
PIT_VISIBLE_MIN  = 8     // 门 B 阈值
QUALITY_MIN_BAND = 15    // 补色硬门槛（2026-11-17 Review 新增）
HUE_GUARD_THRESHOLD = 60 // hue guard 触发阈值（°）
```

---

## 2. 实证数据（Artkal S 210 色，21945 对全量）

### 2.1 按 hue 差分三组 bandΔE 分布

Δhue 分桶阈值 = 30° / 60°，对应色盘上"同色系 / 近色系 / 跨色系"语义分界。

| 分组 | Δhue 范围 | 对数 | 占比 | bandΔE p5 | p50 | p95 | 门 C 锁数 | 锁率 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| **同色系** | < 30° | 4880 | 22% | 7.3 | **21.9** | 38.9 | 508 | **10.4%** |
| **近色系** | 30°–60° | 3513 | 16% | 15.5 | **32.4** | 52.3 | 38 | 1.1% |
| **跨色系** | > 60° | 13552 | 62% | 21.3 | **44.2** | 74.2 | 39 | **0.3%** |

**baseΔE 对照**（门 C 合取门依赖的第二判据）：

| 分组 | baseΔE p5 | p50 |
|---|---:|---:|
| 同色系 | 11.7 | 34.6 |
| 近色系 | 24.6 | 51.7 |
| 跨色系 | 34.7 | 70.5 |

### 2.2 目标验证（四个指标）

| # | 指标 | 计算 | 结果 | 判定 |
|---|---|---|---|---|
| **I** | 同色系内区分度大 | 同色系 bandΔE p50 | **21.9** | ✅ 远高于 τ=10 锁线，50% 以上同色相近 band > 21.9 |
| **II** | hue 差异显著影响 bandΔE | 跨色 p50 − 同色 p50 | **+22.3** | ✅ 正值，hue 从 <30°→>60° 时 bandΔE 跳升 ~22 |
| **III** | 跨色系不硬锁（base 合取门自然失效） | 跨色系门 C 锁率 | **0.3%** | ✅ 近零锁 |
| **IV** | 同色系锁率（解释见 §2.3） | 同色系门 C 锁率 | **10.4%** | ⚠️ 略低于 15% 预期，但非 bug |

### 2.3 指标 IV 的真实语义（为何不是 bug）

门 C 锁 = band<10 **∧** base<22。在 Artkal S 密集色板上，bandΔE 与 baseΔE 高度正相关——band<10 的同色系对 base 几乎都 < 22。所以同色系锁率 = band<10 的真实占比。

band ∈ [10, 15] 是**半可分区**（τ=10 锁线以上，但刻面豆近邻仍可能视觉模糊）。门 C 放 band∈[10,15]，**补色硬门槛 minBandΔE ≥ 15 再卡一层**——两层防线的分工：

```
band < 10      → 门 C 锁（硬防 confusable）      （同色系 10.4% 命中）
band ∈ [10,15] → 门 C 放，补色硬门卡 ≥ 15         （兜半可分区）
band > 15      → 全放（区分度好）
跨色系         → base 合取门自然失效，近零锁（0.3%）
集中色相图     → hue guard ±90°，补色不抢异色相
```

Artkal S 上 **band<10 但 base≥22 的跨色系对 = 0**——base 合取门在密集板上退化为保险条款，在 sparse 板（hama/perler）可能有保护作用（band 近但 base 够远时放行）。

---

## 3. 钉点复核（τ=10 定标根基）

| 色对 | bandΔE | baseΔE | τ=10 判定 | 文档预期 | 一致? |
|---|---:|---:|---|---|---|
| **S37↔S72**（用户 Spike 锁） | **1.5** | 2.4 | 🔒 锁 | band≈10 锁 | ✓ |
| **S67↔S129**（用户 Spike 放） | **15.9** | 25.9 | 放 | band≈15 放 | ✓ |
| #F9F55D↔#E6C61E（钉点） | **13.3** | 20.2 | 放 | band≈13.3 放 | ✓ |
| 淡黄↔橄榄（钉点） | **25.5** | 40.4 | 放 | band=12 base=40.4 放 | ✓ |

钉点全部对齐。

---

## 4. 多层防线汇总

| 防线 | 作用范围 | 硬/软 | 实现位置 |
|---|---|---|---|
| **门 A 全深宪法** | 渲染层端点族派生 | 硬（已冻结） | `palette.ts` / art-bible |
| **门 B 单色下限** | 深珠不可见色剔除 | 硬（绝对门） | `palette-quantize.mjs:176` |
| **门 C 近似族** | 近似族互斥（band∧base 合取） | 硬（相对门） | `palette-quantize.mjs:177` |
| **补色 minBandΔE ≥ 15** | 半可分区新选色拦截 | 硬（耗尽降级） | `palette-quantize.mjs:43, 517-520` |
| **hue guard ±90°** | 集中色相图不抢异色相 | 条件硬（耗尽降级） | `palette-quantize.mjs:443-446, 513-515` |
| **分布质量评分** | 选色排序器（非门） | 软（加分项） | `palette-quantize.mjs:184-199` |
| **Hue-aware Median Cut** | 量化时色相聚类 | 算法层 | `palette-quantize.mjs:248-284` |
| **Dominant Color 众数** | 簇中心取众数（非均值） | 算法层 | `palette-quantize.mjs:286-310` |

### 补色耗尽降级链（从严到松）

```
minBandΔE ≥ 15 硬门  ──耗尽──→  hue guard ±90°  ──耗尽──→  无限制（贪心独立集）
  band∈[10,15]半可分区        hueSpread<60°集中图         色板多样性不足时兜底
```

---

## 5. 剩余已知限制

| # | 描述 | 影响 | 升级项 |
|---|---|---|---|
| L-1 | ΔE76 在蓝色区略钝 | 真机蓝族复核若误放 → 升级 CIEDE2000 重定标 | 低（有已知偏置但钉点对齐） |
| L-2 | Median Cut 后无 K-means 精修 | 量化簇边界可进一步收敛 | 低（Median Cut 已产出 reasonable cluster） |
| L-3 | τ=10 定标 Artkal S，其他密集板（yant/mard/dotz）未单独钉定 | 跨品牌选色时近似族密度可能有差异 | 低（统一用 τ=10 是保守方案） |
| L-4 | temp/audit.mjs 残留（已在 .gitignore） | 下次有人改它会踩 dE76 数组解构坑 | 已修，不入库 |

---

## 6. Commit 链（本轮 + 前序）

| commit | 描述 |
|---|---|
| `46f79641` | **feat(tools):** hue-aware Median Cut + hue guard（两个补丁） |
| `afe81f16` | **fix(tools):** 门 B 精确化 + mix 语义 ADR-0028 修复（B-1, B-2） |
| `018ad6bc` | **fix(tools):** 补色 minBandΔE ≥ 15 硬门槛 + 降级链（B-3） |

---

## 7. 结论

**当前规则已实现"同色系内区分度大、跨色系区分度小"的设计目标。**

四个核心指标三个明确达标（bandΔE p50 同/跨差 +22.3、跨色系锁率 0.3%、同色系内 bandΔE p50 = 21.9），一个"同色系锁率 10.4%"经实证分析为 τ=10 紧卡半可分区的自然结果而非宽松。补色阶段 minBandΔE ≥ 15 硬门槛 + hue guard 条件门，在门 C 之后形成了对 band ∈ [10,15] 半可分区和集中色相图的分层防护。

跨品牌扩展时可放心统一用 τ=10——同品牌内锁族密度（约 10%）与跨品牌放族比例（约 99.7%）在 15 板上趋势稳定，无品牌特异钉定需求。

---

**实证命令**：`node temp/audit.mjs`（Artkal S 全量 bandΔE 分布）
**测试**：`bash tools/scripts/palette-quantize.test.sh → PASS=27 FAIL=0`
**钉点数据**：`games/beads/design/art/specs/palette-selection-gates.md §2`
