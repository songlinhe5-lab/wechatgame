#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WXG-T-974 题材甄选 · 九宫格剪影预览生成器（草案工具，非入库资源）

从 candidates.json 读取 20 大关 × 9 图案的题材定义，用程序化像素剪影
（取色于 art-bible §3.2 十色珠板）画成每关一张 3×3 九宫格预览，供用户评审。

图元 DSL（在 15×15 逻辑网格上绘制，坐标 0..14；首参为色板索引 1..10）：
  D c cx cy r        实心圆
  E c cx cy rx ry    椭圆
  R c x0 y0 x1 y1    矩形（含端点）
  T c x0 y0 x1 y1 x2 y2   三角形
  P c x0 y0 x1 y1 ...     多边形（偶数个坐标点）
  L c x0 y0 x1 y1 w  线段（w 为线宽，默认 1）
  G c cx cy r t      圆环（t 为厚度，默认 1）

用户若要替换主题/图案，改 candidates.json 的文字，改本脚本 SKETCH 里
对应 Axx 的第 n 条图元串即可，然后重跑：python3 gen_preview.py
"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
N = 15                      # 逻辑网格边长
CELL = 26                   # 每逻辑格渲染像素
GAP = 9                     # 九宫格内格子间距
PAD = 18                    # 画布外边距
HEAD = 54                   # 顶部标题栏高度
LABEL = 20                  # 格子底部标签条
TILE = N * CELL             # 单图案像素边长 = 390
GRID_TILE = TILE + LABEL    # 含标签的格子高度
IMG_W = PAD * 2 + TILE * 3 + GAP * 2
IMG_H = HEAD + PAD + GRID_TILE * 3 + GAP * 2 + PAD

# art-bible §3.2 十色珠板（预览取色于此，不改色、不散落 hex）
PALETTE = {
    1: "#FDF6E9", 2: "#FFD23F", 3: "#F59B23", 4: "#3FBF6B", 5: "#E84C3D",
    6: "#8E6FD9", 7: "#3D7BF5", 8: "#A5652C", 9: "#6B3E1E", 10: "#33333D",
}
BG = "#EDEAF2"          # 冷紫灰静底（呼应冷调静底视觉身份）
TILE_BG = "#FAF8F4"     # 珠板暖白
LABEL_BG = "#3A3550"
INK = "#2E2A3E"
BOSS_EDGE = "#E8A317"


def find_font(size, bold=False):
    cands = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ]
    for p in cands:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size, index=(1 if bold and "PingFang" in p else 0))
            except Exception:
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    pass
    return ImageFont.load_default()


class Canvas:
    """在 N×N 整数网格上用图元绘制；grid[y][x] = 色板索引或 0(空)。"""
    def __init__(self):
        self.g = [[0] * N for _ in range(N)]

    def _paint(self, mask, c):
        px = mask.load()
        for y in range(N):
            for x in range(N):
                if px[x, y] > 0:
                    self.g[y][x] = c

    def _mask(self):
        return Image.new("L", (N, N), 0)

    @staticmethod
    def _take(a, n, default=0.0):
        """容错取值：不足补默认值，多余截断（草案数据不追求精确，保证出图优先）。"""
        return (list(a) + [default] * n)[:n]

    def op(self, cmd):
        p = cmd.split()
        op = p[0]
        nums = [float(v) for v in p[1:]]
        # 规范化颜色位：本 DSL 约定颜色为第 1 个数；草案数据有 51 条写成
        # 「颜色在末尾」（L 为倒数第 2，其余为最后），首个数字成了坐标(11-13)。
        # 检测越界即按该格式重解析，仍越界则 clamp 到 1-10，绝不让配色/轮廓丢失。
        c = int(nums[0]) if nums else 0
        if c < 1 or c > 10:
            if op == "L" and len(nums) >= 6:
                c = int(nums[-2])
                a = nums[:4] + [nums[-1]]
            else:
                c = int(nums[-1])
                a = nums[:-1]
            if c < 1 or c > 10:
                c = ((c - 1) % 10) + 1
        else:
            a = nums[1:]
        m = self._mask()
        d = ImageDraw.Draw(m)

        def clamp(v, lo=-1.0, hi=15.0):
            return max(lo, min(hi, v))

        def rad(v):
            return max(0.4, min(6.0, abs(v)))   # 半径钳制，杜绝巨圆糊满整格

        def box(x0, y0, x1, y1):
            return [clamp(min(x0, x1)), clamp(min(y0, y1)),
                    clamp(max(x0, x1)), clamp(max(y0, y1))]

        if op == "D":
            cx, cy, r = self._take(a, 3)
            cx, cy, r = clamp(cx), clamp(cy), rad(r)
            d.ellipse(box(cx - r, cy - r, cx + r, cy + r), fill=255)
        elif op == "E":
            cx, cy, rx, ry = self._take(a, 4)
            cx, cy, rx, ry = clamp(cx), clamp(cy), rad(rx), rad(ry)
            d.ellipse(box(cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
        elif op == "R":
            x0, y0, x1, y1 = self._take(a, 4)
            d.rectangle(box(x0, y0, x1, y1), fill=255)
        elif op == "T":
            x0, y0, x1, y1, x2, y2 = self._take(a, 6)
            if len(a) == 4:
                x2, y2 = x1, y1
            elif len(a) == 5:
                x2, y2 = a[4], clamp(a[1] + 3)  # 五坐标：第三点落回主体内
            d.polygon([(clamp(x0), clamp(y0)), (clamp(x1), clamp(y1)),
                       (clamp(x2), clamp(y2))], fill=255)
        elif op == "P":
            aa = a[:-1] if len(a) % 2 else a   # 奇数坐标丢弃末位
            pts = [(clamp(aa[i]), clamp(aa[i + 1])) for i in range(0, len(aa), 2)]
            if len(pts) >= 3:
                d.polygon(pts, fill=255)
        elif op == "L":
            x0, y0, x1, y1, w = self._take(a, 5, 1.0)
            d.line([(clamp(x0), clamp(y0)), (clamp(x1), clamp(y1))],
                   fill=255, width=max(1, min(3, int(w))))
        elif op == "G":
            cx, cy, r, t = self._take(a, 4, 1.0)
            cx, cy, r = clamp(cx), clamp(cy), rad(r)
            d.ellipse(box(cx - r, cy - r, cx + r, cy + r),
                      outline=255, width=max(1, min(3, int(t))))
        else:
            raise ValueError("unknown op: " + op)
        self._paint(m, c)

    def draw(self, sketch):
        for cmd in sketch.split("|"):
            cmd = cmd.strip()
            if cmd:
                self.op(cmd)
        return self.g


def render_beads(draw, g, ox, oy):
    """把逻辑网格画成糖果珠：实心圆 + 左上高光点。"""
    r = CELL * 0.40
    hi = CELL * 0.13
    for y in range(N):
        for x in range(N):
            c = g[y][x]
            if not c:
                continue
            col = PALETTE[c]
            cx = ox + x * CELL + CELL / 2
            cy = oy + y * CELL + CELL / 2
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
            # 高光：亮色珠用深色高光、暗色珠用白色，对比可读（三重编码的明度意图）
            hc = "#FFFFFF" if c in (5, 6, 7, 8, 9, 10) else "#FFFFFF"
            draw.ellipse([cx - r * 0.55, cy - r * 0.55,
                          cx - r * 0.55 + hi * 2, cy - r * 0.55 + hi * 2], fill=hc)


def draw_tile(img, d, sketch, pid, is_boss, tx, ty):
    # 珠板底
    d.rounded_rectangle([tx, ty, tx + TILE, ty + TILE], radius=10, fill=TILE_BG,
                        outline=(BOSS_EDGE if is_boss else "#CFC9DA"),
                        width=(4 if is_boss else 2))
    cv = Canvas()
    g = cv.draw(sketch)
    render_beads(d, g, tx, ty)
    # 标签条
    ly = ty + TILE + 2
    d.rounded_rectangle([tx, ly, tx + TILE, ly + LABEL - 4], radius=6, fill=LABEL_BG)
    tag = ("%s  ·  BOSS" % pid) if is_boss else pid
    f = find_font(15, bold=is_boss)
    d.text((tx + 8, ly + 1), tag, font=f, fill=("#FFD23F" if is_boss else "#FFFFFF"))


def build(arc, sketches):
    img = Image.new("RGB", (IMG_W, IMG_H), BG)
    d = ImageDraw.Draw(img)
    f_title = find_font(28, bold=True)
    f_sub = find_font(16)
    d.text((PAD, 12), "%s · %s" % (arc["arcId"], arc["title"]), font=f_title, fill=INK)
    d.text((PAD, 46), "题材域：%s ｜ 9 图案（第 9 格为 boss）｜ 草案·不入库" % arc["domain"],
           font=f_sub, fill="#6A6480")
    pats = arc["patterns"]
    for i, pat in enumerate(pats):
        r, c = divmod(i, 3)
        tx = PAD + c * (TILE + GAP)
        ty = HEAD + PAD + r * (GRID_TILE + GAP)
        key = "%s-%s" % (arc["arcId"], pat["id"])
        draw_tile(img, d, sketches[key], pat["id"], pat["isBoss"], tx, ty)
    return img


def main():
    with open(os.path.join(HERE, "candidates.json"), encoding="utf-8") as fh:
        data = json.load(fh)
    from sketches import SKETCH
    out = os.path.join(HERE, "preview")
    os.makedirs(out, exist_ok=True)
    for arc in data["arcs"]:
        img = build(arc, SKETCH)
        path = os.path.join(out, "arc-%s.png" % arc["arcId"])
        img.save(path)
        print("saved", path, img.size)


if __name__ == "__main__":
    main()
