#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/scripts/decision-model.py —— 阿里云百炼领域决策模型（decision-model-preview）入口。

**它不是聊天模型**：一次前向返回 choice / noul / score 三类判定 + 概率分布 + 置信度，
**不生成文本**，所以延迟与成本跟输出长度无关（2026-10-31 实测：203 input token、
服务端 41.9 ms、限时免费）。协议＝TypeSafe System One，`POST {BASE}/systemone`。

⚠ 三条硬约束（都决定了它**不能**塞进游戏运行时）：
  1. `state` 只吃**文本/结构化对象**，不吃图 ⇒ 「看一张出图判版面」得先由视觉模型
     转成文字描述，本脚本不做那一跳（那是 qwen3.8-max 的活，另算钱）。
  2. 置信度阈值**必须用自有样本标定**：实测同一场景 `next_action` 只有 0.48 而
     `is_stuck` 已 0.73 ⇒ 照搬文档示例的 0.9/0.6 会让自动化率归零。所以本脚本的
     主用法是 `--cases`（标定），不是"调一次拿答案"。
  3. 运行时接云＝玩家侧延迟 + 配额 + 隐私上报 + weapp 域名白名单 ⇒ 本脚本定位为
     **开发管线离线判定**（出图验收、QA 分流、批量分带），不是游戏内 DDA。

用法：
  # 标定：每行一个 JSON 用例（`state` + 可省的 `expect`），问题表单独一份全局共用
  python3 decision-model.py --cases temp/x.jsonl --questions q.json   # 人读表 + 阈值建议
  python3 decision-model.py --cases temp/x.jsonl --questions q.json --json
  # 用例内自带 questions 时可不给 --questions（探索问题表写法时用）
  python3 decision-model.py --state '{"streak":4,"idle_ms":900}' --questions q.json

用例文件（jsonl）形状：
  {"state": <任意 str/object/array>, "questions": {…}, "expect": {"q1": "choice值"}}

`--check` 跑离线自检（解析 + 阈值分桶），不联网。
仅标准库；TOKEN_PLAN_API_KEY / TOKEN_PLAN_BASE_URL 读环境变量或仓库根 .env.local。
"""
import json
import os
import re
import ssl
import sys
import time
import urllib.request
import urllib.error

MODEL = "decision-model-preview"


def _repo_root(start):
    d = start
    while os.path.dirname(d) != d:
        if os.path.exists(os.path.join(d, "pnpm-workspace.yaml")):
            return d
        d = os.path.dirname(d)
    raise RuntimeError("找不到仓库根（pnpm-workspace.yaml）")


REPO = _repo_root(os.path.dirname(os.path.abspath(__file__)))


def _env(name):
    v = os.environ.get(name)
    if v:
        return v.strip().strip('"').strip("'")
    for fn in (".env.local", ".env"):
        p = os.path.join(REPO, fn)
        if os.path.exists(p):
            m = re.search(rf"^{name}=(.+)$", open(p).read(), re.M)
            if m and m.group(1).strip():
                return m.group(1).strip().strip('"').strip("'")
    return None


def endpoint():
    base = _env("TOKEN_PLAN_BASE_URL")
    if not base:
        raise SystemExit("未找到 TOKEN_PLAN_BASE_URL（.env.local）")
    return base.rstrip("/") + "/systemone"


def ask(state, questions, key, url, model=MODEL):
    body = {"model": model, "state": state, "questions": questions}
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    t0 = time.time()
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
        resp = json.loads(r.read().decode())
    return resp, round((time.time() - t0) * 1000)


def pick(ans, qtype):
    """把三种答案归一成 (判定值, 判定强度)。

    ⚠ score 返回的是**概率加权等级索引**（浮点，实测如 3.75），不是整数⇒ 直接拿字符串
    与标注比会永远不等（首轮标定因此报出假 0/18）。取最近邻 round 才是正确口径；
    有序量表另报 MAE（命中率差一档算错，太窄）。
    noul **不返回 confidence**（文档：只有 choice/score 有），但 P(yes) 本身就是可标定的
    强度量：取到两端较远的那一侧 max(p, 1−p)。
    """
    if qtype == "noul":
        p = float(ans.get("noul") or 0.0)
        return ("true" if p >= 0.5 else "false"), max(p, 1.0 - p)
    if qtype == "score":
        return str(round(float(ans.get("score") or 0.0))), float(ans.get("confidence") or 0.0)
    return str(ans.get(qtype)), float(ans.get("confidence") or 0.0)


def calibrate(rows, key, url, model=MODEL, shared_q=None):
    """跑全部用例，按问题聚合：命中率 + 分对的最低强度 / 分错的最高强度。

    这两个数就是阈值建议的全部依据：`sep` 成立（错样最高 < 对样最低）才谈得上自动化，
    否则模型在这个问题上**不可分**，写多少提示词都救不回来 —— 表里直说，不粉饰。
    """
    acc = {}
    for i, case in enumerate(rows):
        state, qs, expect = case["state"], case.get("questions") or shared_q, case.get("expect") or {}
        if not qs:
            raise SystemExit(f"case#{i} 无 questions，也没给 --questions")
        try:
            resp, wall = ask(state, qs, key, url, model)
        except urllib.error.HTTPError as e:
            print(f"✗ case#{i} HTTP {e.code}: {e.read().decode()[:200]}")
            continue
        except Exception as e:
            print(f"✗ case#{i} {type(e).__name__}: {e}")
            continue
        answers = resp.get("answers") or resp.get("output", {}).get("answers") or {}
        usage = resp.get("usage", {})
        print("case#%d  墙钟 %dms  服务端 %sms  input_tokens %s"
              % (i, wall, resp.get("latency_ms", "?"), usage.get("input_tokens", usage)))
        for qid, ans in answers.items():
            qt = qs.get(qid, {}).get("type", ans.get("type", "choice"))
            v, strength = pick(ans, qt)
            a = acc.setdefault(qid, {"type": qt, "n": 0, "hit": 0, "ok_conf": [],
                                     "bad_conf": [], "vals": {}, "errs": []})
            a["n"] += 1
            a["vals"][v] = a["vals"].get(v, 0) + 1
            if qid in expect:
                if str(expect[qid]) == v:
                    a["hit"] += 1
                    a["ok_conf"].append(strength)
                else:
                    a["bad_conf"].append(strength)
                    if qt == "score":   # 有序量表：差多远比命中等不等更有意义
                        try:
                            a["errs"].append(abs(float(v) - float(expect[qid])))
                        except ValueError:
                            pass
            else:
                a["ok_conf"].append(strength)   # 无标注：只当分布样本，不计命中
    return acc


def advice(a):
    """阈值建议。分三种：可分 / 不可分 / 无标注。"""
    if not a["ok_conf"] and not a["bad_conf"]:
        return "无 confidence 字段"
    if not a["bad_conf"]:
        return (f"无错样 ⇒ 阈值 ≤ {min(a['ok_conf']):.2f} 可保全部命中"
                f"（共 {a['n']} 条，可能全是同一种，不算已验）")
    hi_bad = max(a["bad_conf"])
    if not a["ok_conf"]:
        return f"全错 ⇒ 别用；错样最高置信 {hi_bad:.2f}"
    lo_ok = min(a["ok_conf"])
    if hi_bad < lo_ok:
        return f"可分 ⇒ 阈值取 ({hi_bad:.2f}, {lo_ok:.2f})，建议 {((hi_bad + lo_ok) / 2):.2f}"
    return f"⚠ 不可分（错样最高 {hi_bad:.2f} ≥ 对样最低 {lo_ok:.2f}）⇒ 该问题不得自动放行，保留人工"


def report(acc):
    print(f"\n{'问题':<18} {'类型':<6} {'n':>3} {'命中':>8} {'强度区间':>13}  建议")
    for qid, a in sorted(acc.items()):
        confs = a["ok_conf"] + a["bad_conf"]
        rng = f"{min(confs):.2f}–{max(confs):.2f}" if confs else "?"
        labeled = bool(a["bad_conf"]) or (bool(a["ok_conf"]) and a["hit"])
        mae = f"  MAE {sum(a['errs']) / len(a['errs']):.2f}档" if a["errs"] else ""
        print("%-18s %-6s %3d %8s %14s  %s%s"
              % (qid, a["type"], a["n"],
                 (f"{a['hit']}/{a['n']}" if labeled else "无标注"),
                 rng, advice(a), mae))
        print(f"{'':<28}分布 {a['vals']}")


def check():
    """离线自检：不联网，只验解析与判定归一/分桶逻辑。改过上面三个函数必跑。"""
    assert pick({"noul": 0.73}, "noul") == ("true", 0.73)
    assert pick({"noul": 0.20}, "noul") == ("false", 0.80)   # 否侧强度取 max(p,1−p)
    assert pick({"choice": "hint"}, "choice")[0] == "hint"
    assert pick({"score": 3.75}, "score") == ("4", 0.0)      # 加权索引→最近邻，不抹字符串
    a = {"n": 4, "hit": 3, "ok_conf": [0.81, 0.9, 0.77], "bad_conf": [0.48], "vals": {}}
    assert "可分" in advice(a) and "0.6" in advice(a), advice(a)
    b = {"n": 4, "hit": 2, "ok_conf": [0.5], "bad_conf": [0.7], "vals": {}}
    assert "不可分" in advice(b), advice(b)
    print("check ok")


if __name__ == "__main__":
    argv = sys.argv[1:]
    if "--check" in argv:
        check()
        raise SystemExit
    if "-h" in argv or "--help" in argv:
        print(__doc__)
        raise SystemExit
    opt, i = {}, 0
    while i < len(argv):
        if argv[i].startswith("--") and i + 1 < len(argv) and not argv[i + 1].startswith("--"):
            opt[argv[i]] = argv[i + 1]
            i += 2
        else:
            opt[argv[i]] = True
            i += 1
    key, url = _env("TOKEN_PLAN_API_KEY"), endpoint()
    model = opt.get("--model", MODEL)
    if "--cases" in opt:
        rows = [json.loads(x) for x in open(os.path.join(REPO, opt["--cases"]), encoding="utf-8") if x.strip()]
        sq = json.load(open(os.path.join(REPO, opt["--questions"]), encoding="utf-8")) if "--questions" in opt else None
        acc = calibrate(rows, key, url, model, sq)
        if opt.get("--json"):
            print(json.dumps(acc, ensure_ascii=False, indent=2))
        else:
            report(acc)
        print("\n判读：命中与阈值只在**同一问题表 + 同一 state 口径**下有意义；换问法必须重标。"
              "\n未标定的问题一律当『参考』用（打日志、不驱动行为），别接自动放行。")
    elif "--state" in opt:
        qs = json.load(open(os.path.join(REPO, opt["--questions"]), encoding="utf-8")) \
            if "--questions" in opt else None
        if not qs:
            raise SystemExit("--state 需配 --questions <json>")
        state = opt["--state"]
        try:
            state = json.loads(state)
        except json.JSONDecodeError:
            pass
        resp, wall = ask(state, qs, key, url, model)
        print(f"墙钟 {wall}ms  服务端 {resp.get('latency_ms')}ms  usage {resp.get('usage')}")
        print(json.dumps(resp.get("answers", resp), ensure_ascii=False, indent=2))
    else:
        raise SystemExit("给 --cases <jsonl> 或 --state + --questions（--help 看用法）")
