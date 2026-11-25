#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""G13 对称性口径普查（WXG-T-1065）：判「母版本身对不对称」，⛔ 判「豆面该不该对称」。

判据正本 = `series-spec.md` §2 **G13**：母版按**墨形 bbox 归一**后再左右镜像比对，
墨形或色层任一 > 5 % ⇒ 母版本身不对称 ⇒ 该关珠面左右不一致属**设计内**，⛔ 为此改关卡数据。
⛔ 按画布中线直接比对（图不居中会造出 20–50 % 的假不对称，WXG-T-1064 首诊即栽在此）。

用法（仓根）：
    python3 games/beads/design/ai-workflows/check-g13-symmetry.py                 # 全章锁定母版普查
    python3 games/beads/design/ai-workflows/check-g13-symmetry.py A01 A03         # 只查指定章
    python3 games/beads/design/ai-workflows/check-g13-symmetry.py --levels        # 叠加珠面镜像差（只对「有对称义务」关硬拦）
    python3 games/beads/design/ai-workflows/check-g13-symmetry.py --check         # 合成自检（改算法必跑）
每章取目录内**版本号最高的 *-rgba.png** 为锁定母版；普查表只打印，`--levels` 不达标时 exit 1。
"""
import os
import re
import sys

import numpy as np
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
ROOT = os.path.join(REPO, "games", "beads", "design", "art", "proposals",
                    "levels-20arcs-selection-20261117")
THRESH = 5.0  # G13：> 5 % 判母版不对称


def _rates(rgb, alpha):
    """墨形 bbox 归一后的镜像不一致率（墨形 / 色层两项，%）。"""
    ink = alpha > 127
    if not ink.any():
        return None
    ys, xs = np.where(ink)
    crop = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    ck = ink[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    m = ck & ck[:, ::-1]
    ink_rate = float((ck.astype(np.uint8) != ck[:, ::-1].astype(np.uint8)).mean()) * 100
    diff = (np.abs(crop.astype(np.int16) - crop[:, ::-1].astype(np.int16)).sum(2) > 24) & m
    col_rate = float(diff.sum() / max(m.sum(), 1)) * 100
    return round(ink_rate, 2), round(col_rate, 2)


def locked_master(dirname):
    """锁定母版 = **版本号最高**，同版内 `-final` 后缀优先（v10 > v9 按数值比，⛔ 按字符串）。
    ⚠ 只筛 `-rgba.png` 会漏掉 `a01p06-v2-s42-rgba-final.png` 这类真锁版件。"""
    d = os.path.join(ROOT, dirname)
    best = None
    for f in os.listdir(d):
        if "-rgba" not in f or not f.endswith(".png"):
            continue
        v = re.search(r"v(\d+)", f)
        key = (int(v.group(1)) if v else -1, "-final" in f, f)
        if best is None or key > best[0]:
            best = (key, os.path.join(d, f))
    return best[1] if best else None


def survey(chapters):
    rows = []
    for name in sorted(os.listdir(ROOT)):
        if not re.match(r"A\d{2}-P\d{2}-", name):
            continue
        if chapters and name[:3] not in chapters:
            continue
        p = locked_master(name)
        if not p:
            rows.append((name, "-", "-", "-", "无 rgba 母版"))
            continue
        a = np.asarray(Image.open(p).convert("RGBA"))
        r = _rates(a[:, :, :3], a[:, :, 3])
        if r is None:
            rows.append((name, os.path.basename(p), "-", "-", "空图"))
            continue
        ink, col = r
        verdict = "母版不对称 ⇒ 豁免" if max(ink, col) > THRESH else "母版对称 ⇒ 有对称义务"
        rows.append((name, os.path.basename(p), ink, col, verdict))
    return rows


def level_mirror_diff(uid):
    """入库珠面的左右镜像差格数（色层；墨形另计）：A{arc}-P{n} → L000{12+(arc-1)*9+n-1}。"""
    import json
    p = os.path.join(REPO, "games", "beads", "design", "levels", "singles", f"L{uid:05d}.json")
    if not os.path.exists(p):
        return None, None
    rows = json.load(open(p))["pattern"]
    m = max(len(r) for r in rows)
    rows = [r.ljust(m, ".") for r in rows]
    ink = sum(1 for r in rows for x in range(m // 2) if (r[x] == ".") != (r[m - 1 - x] == "."))
    col = sum(1 for r in rows for x in range(m // 2) if r[x] != r[m - 1 - x])
    return ink, col


def selfcheck():
    """合成自检（两条腿缺一即失效）：
    ① **平移不变**：对称图整体右移 20 px，bbox 归一后仍须判「对称」（旧错法按画布中线会报假不对称）；
    ② **真不对称能抓住**：只抹掉右侧一枚色块，必须判「不对称」。"""
    base = np.zeros((120, 120, 4), np.uint8)
    for x, y, c in [(30, 30, 0), (60, 30, 1), (90, 30, 0), (30, 70, 2), (90, 70, 2)]:
        base[y:y + 12, x:x + 12, :3] = [(253, 246, 233), (255, 210, 63), (63, 191, 107)][c]
        base[y:y + 12, x:x + 12, 3] = 255
    sym = base.copy()
    sym[:, 60:] = sym[:, :60][:, ::-1]                       # 严格镜像
    shifted = np.zeros_like(sym)
    shifted[:, 20:] = sym[:, :-20]                           # 同一对称图整体右移
    cut = sym.copy()
    _, cx = np.where(cut[:, :, 3] > 127)
    cut[70:82, cx.max() - 11:cx.max() + 1, 3] = 0            # 抹掉最右一枚色块 ⇒ 真不对称
    r_sym = _rates(sym[:, :, :3], sym[:, :, 3])
    r_shift = _rates(shifted[:, :, :3], shifted[:, :, 3])
    r_cut = _rates(cut[:, :, :3], cut[:, :, 3])
    ok = max(r_sym) <= THRESH and max(r_shift) <= THRESH and max(r_cut) > THRESH
    print(f"自检：镜像 {r_sym}（须 ≤{THRESH}）｜平移 20px {r_shift}（须 ≤{THRESH}，证 bbox 归一生效）"
          f"｜缺块 {r_cut}（须 >{THRESH}） ⇒ {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--check" in sys.argv:
        sys.exit(selfcheck())
    rows = survey(set(args))
    print(f"{'关':<22}{'母版':<34}{'墨形%':>8}{'色层%':>8}  {'珠面镜像差':>10}  判定")
    bad = []
    for name, f, ink, col, verdict in rows:
        beads = "-"
        if "--levels" in sys.argv and isinstance(ink, float) and max(ink, col) <= THRESH:
            arc, pnum = int(name[1:3]), int(name[5:7])
            bi, bc = level_mirror_diff(12 + (arc - 1) * 9 + pnum - 1)
            if bi is not None:
                beads = f"{bi}/{bc}"
                if bc:
                    bad.append(f"{name} 珠面镜像差 {bc} 格（母版已对称 ⇒ 量化腿待修）")
        print(f"{name:<22}{str(f):<34}{str(ink):>8}{str(col):>8}  {beads:>10}  {verdict}")
    n_sym = sum(1 for r in rows if isinstance(r[2], float) and max(r[2], r[3]) <= THRESH)
    print(f"合计 {len(rows)} 关：有对称义务 {n_sym} ｜ 母版不对称（豁免）{len(rows) - n_sym}")
    if bad:
        print("❌ " + "\n❌ ".join(bad))
        sys.exit(1)
