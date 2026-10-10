#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
temp/studio-batch-report.py —— beads-studio 批量「导出 + 自检 + 效果对比」驱动。

链路（全部走 studio HTTP 接口，验证「接口自动导出资源 + 自检效果」是否可用）：
  每张 teaching-set PNG
    → PIL 解像成 RGBA
    → POST /api/generate（beads-gen 限色 + 错位；服务端 --patch 已回填真引擎 report.difficulty）
    → 读自检指标：主导色占比 / 色数 / 错位模式 / derangement / 改判 / cleared / timeEst / blockers
    → PIL 渲染「对位（正解 pattern）」与「错位（misplaced 初始盘）」两张拼豆盘面
    → （--ingest）POST /api/results/:id/ingest → 真写 design/levels + levels:sync + framework:sync
  汇总成 report.html（表格 + 逐关源图/对位/错位三视图）。

⚠ 默认 **不** ingest（不动真源）；加 --ingest 才导出。ingest 后请自行 git 还原（脚本会打印清单）。
零第三方依赖（urllib + PIL + 子进程起 node 服务）。

用法：
  python3 temp/studio-batch-report.py                       # 仅自检 + 渲染（安全）
  python3 temp/studio-batch-report.py --ingest              # 额外真导出到 design/levels
  python3 temp/studio-batch-report.py --dir temp/comfyui-out/teaching-set --mis full
"""
import argparse, base64, json, os, re, shutil, subprocess, sys, time
import urllib.request, urllib.error
from urllib.parse import urlencode
from PIL import Image, ImageDraw, ImageFont

def _repo_root(start):
    d = start
    while os.path.dirname(d) != d:
        if os.path.exists(os.path.join(d, "pnpm-workspace.yaml")):
            return d
        d = os.path.dirname(d)
    raise RuntimeError("找不到仓库根（pnpm-workspace.yaml）")


# 脚本可居任意深度（现 games/beads/design/ai-workflows/），向上找仓库根标记。
REPO = _repo_root(os.path.dirname(os.path.abspath(__file__)))
SERVER = os.path.join(REPO, "apps/beads-studio/server.mjs")


# ── 服务生命周期 ────────────────────────────────────────────────
def start_server(port):
    env = dict(os.environ, PORT=str(port))
    p = subprocess.Popen(["node", SERVER], cwd=REPO, env=env,
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    deadline = time.time() + 20
    buf = ""
    while time.time() < deadline:
        line = p.stdout.readline()
        if not line:
            if p.poll() is not None:
                raise RuntimeError("服务未起即退出：\n" + buf)
            continue
        buf += line
        if "beads-studio" in line:
            return p
    p.kill()
    raise RuntimeError("服务启动超时：\n" + buf)


def http_json(method, url, body=None, timeout=1800):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"content-type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw[:400]}


# ── 图像 → RGBA raw（按前端默认：送自然分辨率，不预缩；仅 4096 上限兜底）──
def png_to_raw(png, max_side=4096):
    im = Image.open(png).convert("RGBA")
    if max(im.size) > max_side:
        im = im.resize((max_side, max_side))
    w, h = im.size
    return {"w": w, "h": h, "data": base64.b64encode(im.tobytes()).decode()}


def board_size(name):
    # 两档默认（对齐 beads-studio UI，余参数全档共用）：
    #   普通关 = 倍率 2x ⇒ 16×16；Boss 关（level-09）= 倍率 1x ⇒ 32×32。
    #   倍率是前端推列/行的旋钮，generate 只收 cols/rows，故此处直接给最终格数。
    m = re.search(r"level-0?(\d+)", name)
    lvl = int(m.group(1)) if m else 0
    return (32, 32)# if lvl == 9 else (16, 16)


# ── 自检指标 ────────────────────────────────────────────────────
def dominant(pattern):
    from collections import Counter
    flat = [c for row in pattern for c in row]
    cnt = Counter(c for c in flat if c.isdigit())
    tot = sum(cnt.values())
    if not tot:
        return 0, 0, 0.0, 0
    mx = max(cnt.values())
    return mx, tot, 100.0 * mx / tot, len(cnt)


# ── 盘面渲染（对位 / 错位） ─────────────────────────────────────
def _hex(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i+2], 16) for i in (0, 2, 4))


def render_board(pattern, palette_hex, out_png, title):
    rows = len(pattern)
    cols = max((len(r) for r in pattern), default=0)
    cell, gap, pad, head = 26, 3, 14, 34
    W = pad * 2 + cols * cell
    H = head + pad * 2 + rows * cell
    img = Image.new("RGB", (W, H), (244, 239, 230))
    d = ImageDraw.Draw(img)
    try:
        font = next(ImageFont.truetype(p, 18) for p in (
            "/System/Library/Fonts/PingFang.ttc",
            "/System/Library/Fonts/STHeiti Medium.ttc",
            "/System/Library/Fonts/Helvetica.ttc",
        ) if os.path.exists(p))
    except Exception:
        font = ImageFont.load_default()
    d.text((pad, 8), title, fill=(60, 55, 50), font=font)
    r = (cell - gap) // 2
    for y, row in enumerate(pattern):
        for x in range(cols):
            ch = row[x] if x < len(row) else "."
            cx = pad + x * cell + cell // 2
            cy = head + pad + y * cell + cell // 2
            if ch.isdigit():
                col = _hex(palette_hex[int(ch) - 1])
                dark = tuple(int(v * 0.72) for v in col)
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col, outline=dark, width=2)
                hr = max(2, r // 4)
                d.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=(244, 239, 230))
            else:
                hr = max(2, r // 5)
                d.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], outline=(206, 198, 186))
    img.save(out_png)


# ── HTML 报告 ───────────────────────────────────────────────────
def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def build_html(rows_data, meta, out_html):
    css = """body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:24px;color:#333;background:#faf8f4}
h1{font-size:22px} .meta{color:#777;font-size:13px;margin-bottom:16px}
table{border-collapse:collapse;width:100%;font-size:13px;background:#fff}
th,td{border:1px solid #e2ddd3;padding:6px 9px;text-align:center}
th{background:#efe9dd} td.l{text-align:left}
.ok{color:#1a7f37;font-weight:600}.bad{color:#c0392b;font-weight:600}.warn{color:#b8860b;font-weight:600}
.card{background:#fff;border:1px solid #e2ddd3;border-radius:10px;padding:14px 16px;margin:16px 0}
.card h3{margin:0 0 10px;font-size:16px}
.strip{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
.strip figure{margin:0;text-align:center}
.strip figcaption{font-size:12px;color:#777;margin-top:4px}
.strip img{border:1px solid #ddd;border-radius:6px;max-width:340px;height:auto}
.kv{font-size:12px;color:#555;margin-top:8px;line-height:1.7}"""
    h = [f"<html><head><meta charset='utf-8'><title>beads-studio 批量自检报告</title><style>{css}</style></head><body>"]
    h.append("<h1>beads-studio 批量「导出 + 自检 + 效果对比」报告</h1>")
    h.append("<div class='meta'>" + esc(meta) + "</div>")
    h.append("<table><tr><th class='l'>关卡</th><th>色数</th><th>主导色%</th><th>错位模式</th>"
             "<th>derangement</th><th>改判</th><th>cleared</th><th>timeEst(s)</th><th>taps</th><th>入关</th></tr>")
    for r in rows_data:
        cls = "ok" if r["cleared"] else "bad"
        ing = r.get("ingest")
        if ing is None:
            ingcell = "<td class='warn'>未跑</td>"
        elif ing.get("ok"):
            ingcell = f"<td class='ok'>{esc(ing.get('uid',''))}</td>"
        else:
            ingcell = f"<td class='bad'>{esc(ing.get('err','拒收'))}</td>"
        h.append(f"<tr><td class='l'>{esc(r['name'])}</td><td>{r['colors']}</td>"
                 f"<td>{r['dom_pct']:.0f}%</td><td>{esc(r['mis'])}</td>"
                 f"<td>{esc(r['derange'])}</td><td>{r['balanced']}</td>"
                 f"<td class='{cls}'>{'✓' if r['cleared'] else '✗'}</td>"
                 f"<td>{r['time']}</td><td>{r['taps']}</td>{ingcell}</tr>")
    h.append("</table>")
    for r in rows_data:
        h.append(f"<div class='card'><h3>{esc(r['name'])}</h3><div class='strip'>")
        if r.get("src_img"):
            h.append(f"<figure><img src='{r['src_img']}'><figcaption>源图（AI 底图）</figcaption></figure>")
        if r.get("solved_img"):
            h.append(f"<figure><img src='{r['solved_img']}'><figcaption>对位 · 正解盘面（solved）</figcaption></figure>")
        if r.get("mis_img"):
            h.append(f"<figure><img src='{r['mis_img']}'><figcaption>错位 · 初始盘面（misplaced）</figcaption></figure>")
        h.append("</div>")
        if r.get("gen_error"):
            h.append(f"<div class='kv bad'>生成拒产：{esc(r['gen_error'])}</div>")
        else:
            h.append(f"<div class='kv'>色数 {r['colors']} ｜ 主导色 {r['dom']}/{r['fg']} = <b>{r['dom_pct']:.0f}%</b> "
                     f"｜ 错位 {esc(r['mis'])}（{esc(r['derange'])}）｜ 平衡改判 {r['balanced']} 格 "
                     f"｜ 难度分 {r.get('score','-')} ｜ cleared={'✓' if r['cleared'] else '✗'} ｜ "
                     f"timeEst {r['time']}s ｜ taps {r['taps']} ｜ blockers {esc(r.get('blockers') or '无')}"
                     + (f" ｜ <b>入关 {esc(r['ingest']['uid'])}</b>（{esc(r['ingest'].get('kind',''))}）"
                        if r.get("ingest") and r["ingest"].get("ok") else "")
                     + (f" ｜ <span class='bad'>入关失败：{esc(r['ingest']['err'])}</span>"
                        if r.get("ingest") and not r["ingest"].get("ok") else "")
                     + "</div>")
        h.append("</div>")
    h.append("</body></html>")
    open(out_html, "w", encoding="utf-8").write("\n".join(h))


# ── 主流程 ──────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="temp/comfyui-out/teaching-set")
    ap.add_argument("--out", default="temp/studio-batch-report")
    ap.add_argument("--mis", default="full", choices=["full", "max", "none", "swaps"])
    ap.add_argument("--colors", type=int, default=8)
    ap.add_argument("--palette", default="artkal-s")
    ap.add_argument("--port", type=int, default=18799)
    ap.add_argument("--ingest", action="store_true", help="真导出到 design/levels（默认不写）")
    args = ap.parse_args()

    src_dir = os.path.join(REPO, args.dir)
    out_dir = os.path.join(REPO, args.out)
    os.makedirs(out_dir, exist_ok=True)
    pngs = sorted(f for f in os.listdir(src_dir) if re.match(r"level-\d", f) and f.endswith(".png"))
    if not pngs:
        print(f"目录无 level-*.png：{src_dir}", file=sys.stderr); sys.exit(1)

    print(f"[driver] 起服务 :{args.port} …")
    srv = start_server(args.port)
    base = f"http://127.0.0.1:{args.port}"
    rows = []
    try:
        for fn in pngs:
            name = fn[:-4]
            png = os.path.join(src_dir, fn)
            cols, crs = board_size(name)
            raw = png_to_raw(png)
            def gen_with(mode):
                # 参数 = beads-studio 普通关默认档（对齐 UI）：palette artkal-s / colors 8 /
                # 全错位 full / 众数滤波 smooth 0 / 中值 premedian 0 / 误差最小 colorsmode error /
                # 主导色 cellmode mode / 长方形 shape square / 暖纸皮肤 skin warm-paper /
                # 铺满整盘未勾 ⇒ noframe 0（扣背景）。
                qq = urlencode({"cols": cols, "rows": crs, "palette": args.palette,
                                "colors": args.colors, "mis": mode, "noframe": "0",
                                "smooth": "0", "cellmode": "mode", "swaps": "8",
                                "colorsmode": "error", "premedian": "0",
                                "shape": "square", "skin": "warm-paper"})
                return http_json("POST", f"{base}/api/generate?{qq}", raw)
            print(f"\n[driver] {name}  ({cols}×{crs}, mis={args.mis})")
            st, j = gen_with(args.mis)
            used_mis = args.mis
            # full 拒产且引擎建议「用 --mis max 尽力错位」→ 自动降级（主导色 >N/2 无解全错位）
            if (st != 200 and args.mis == "full"
                    and "无法全错位" in str(j.get("error", ""))):
                print("  ↻ full 无解（主导色>N/2），降级 mis=max 尽力错位")
                st, j = gen_with("max"); used_mis = "max"
            rec = {"name": name, "colors": "-", "dom": 0, "fg": 0, "dom_pct": 0.0,
                   "mis": used_mis, "derange": "-", "balanced": "-", "cleared": False,
                   "time": "-", "taps": "-", "score": "-", "blockers": "-",
                   "ingest": None, "gen_error": None}
            if st != 200 or "pattern" not in j:
                rec["gen_error"] = j.get("error", f"HTTP {st}")
                print(f"  ✗ generate {st}: {rec['gen_error']}")
                rows.append(rec); continue
            pat = j["pattern"]; pal = j.get("paletteHex") or []
            mx, tot, pct, nc = dominant(pat)
            rep = j.get("report") or {}
            diff = rep.get("difficulty") or {}
            rec.update(colors=rep.get("colorsUsed", nc), dom=mx, fg=tot, dom_pct=pct,
                       derange=rep.get("derangement", "-"), balanced=rep.get("balancedChanged", "-"),
                       cleared=bool(diff.get("cleared")), time=diff.get("timeEst", "-"),
                       taps=diff.get("taps", "-"), score=diff.get("score", "-"),
                       blockers=diff.get("blockers") or "无")
            # 渲染三视图
            src_thumb = f"{name}.src.png"
            Image.open(png).convert("RGB").resize((340, 340)).save(os.path.join(out_dir, src_thumb))
            rec["src_img"] = src_thumb
            solved = f"{name}.solved.png"; mis = f"{name}.misplaced.png"
            render_board(pat, pal, os.path.join(out_dir, solved), f"{name} · 对位（正解）")
            rec["solved_img"] = solved
            mp = j.get("misplaced") or (j.get("levelDraft") or {}).get("misplaced")
            if mp:
                render_board(mp, pal, os.path.join(out_dir, mis), f"{name} · 错位（初始盘）")
                rec["mis_img"] = mis
            print(f"  ✓ 色数 {rec['colors']} 主导 {pct:.0f}% {rec['derange']} "
                  f"cleared={rec['cleared']} time={rec['time']}s")
            # ingest
            if args.ingest:
                rid = j.get("id")
                ist, ij = http_json("POST", f"{base}/api/results/{rid}/ingest")
                if ist == 200:
                    rec["ingest"] = {"ok": True, "uid": ij.get("ingested"), "kind": ij.get("kind")}
                    print(f"  → 入关 {ij.get('ingested')} ({ij.get('kind')})")
                else:
                    rec["ingest"] = {"ok": False, "err": ij.get("error", f"HTTP {ist}")}
                    print(f"  → 入关拒收：{rec['ingest']['err'][:120]}")
            rows.append(rec)
    finally:
        meta = (f"来源 {args.dir} ｜ 档位 {args.mis} colors={args.colors} palette={args.palette} ｜ "
                f"{'含真导出 ingest' if args.ingest else '仅自检（未 ingest，真源未改）'} ｜ "
                f"{time.strftime('%Y-%m-%d %H:%M:%S')}")
        out_html = os.path.join(out_dir, "report.html")
        build_html(rows, meta, out_html)
        srv.kill()
        print(f"\n[driver] 报告 → {os.path.relpath(out_html, REPO)}")
        if args.ingest:
            created = [r["ingest"]["uid"] for r in rows if r.get("ingest") and r["ingest"].get("ok")]
            if created:
                print(f"[driver] ⚠ 已写入真源 {len(created)} 关：{', '.join(created)}")
                print("[driver]    还原：git checkout -- games/beads/design/levels "
                      "games/beads/src/config/levels-data.ts "
                      "games/beads/cocos/assets/scripts/game/config/levels-data.ts "
                      "&& git clean -fd games/beads/design/levels/singles games/beads/design/levels/plates")


if __name__ == "__main__":
    main()
