#!/usr/bin/env bash
# verify-all-selftest.sh —— 证明全量门禁聚合器「真的会红、且红了也不短路」（WXG-T-095 / BD-17）
#
# 为什么要有这个文件：`knowledge/lessons.md` **K-036 规避③** 明写——
#   「聚合脚本必须自带一条用例：注入一项失败 ⇒ 后续项仍跑且总退出码非零」。
# 只做单测式断言不够（K-030：脚本自测本身可能假绿），所以这里**同时对真实步骤链**做一次红→绿实测。
#
# 五步：
#   1) 合成自测：`--selftest`（不跑真实门禁，验聚合器三条承诺）必须绿
#   2) 表一致性：`--validate`（步骤表 ↔ package.json 未脱钩、verify 未回退成 `&&`）必须绿
#   3) 不短路实测：`--steps=<不存在的步骤>,check:tasks` 必须**红**，且 check:tasks 仍被执行
#   4) 清理语义：`--steps=check:tasks`（去掉注入项）必须**绿** —— 证明 3) 的红来自注入项本身
#   5) SKIP 不是 PASS：`--steps=check:size`，若本轮子命令自报 SKIP，则 `--strict` 必须把它判红
#
# 用法：bash tools/scripts/verify-all-selftest.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
rc=0
LOG=$(mktemp -t wxg-verify-selftest.XXXXXX)
trap 'rm -f "$LOG"' EXIT

ok() { echo "   ✅ $1"; }
bad() { echo "   ❌ $1"; rc=1; }

echo "── 1) 聚合器合成自测（--selftest）"
if node tools/scripts/verify-all.mjs --selftest >"$LOG" 2>&1; then
  ok "$(tail -1 "$LOG")"
else
  bad "--selftest 未通过"; cat "$LOG"
fi

echo "── 2) 步骤表与 package.json 未脱钩（--validate）"
if node tools/scripts/verify-all.mjs --validate >"$LOG" 2>&1; then
  ok "$(tail -1 "$LOG")"
else
  bad "--validate 未通过"; cat "$LOG"
fi

echo "── 3) 注入一项失败 ⇒ 必须红，且**后续项照跑**（不短路）"
if node tools/scripts/verify-all.mjs --steps=__wxg_selftest_no_such_step__,check:tasks >"$LOG" 2>&1; then
  bad "带必失败项却整体退出 0 —— 汇总退出码失效"
else
  ok "总退出码非零（如预期）"
fi
if grep -q '\[2/2\] check:tasks' "$LOG"; then
  ok "失败项之后的步骤仍被执行（BD-17 的短路已消除）"
else
  bad "后续步骤被跳过 —— 短路复发（BD-17）"; tail -20 "$LOG"
fi
if grep -q '^  ❌ FAIL __wxg_selftest_no_such_step__' "$LOG"; then
  ok "未通过项在汇总里被点名"
else
  bad "汇总未点名失败项"; tail -20 "$LOG"
fi

echo "── 4) 去掉注入项 ⇒ 必须绿（证明 3) 的红来自注入项本身）"
if node tools/scripts/verify-all.mjs --steps=check:tasks >"$LOG" 2>&1; then
  ok "单步 check:tasks PASS"
else
  bad "check:tasks 单步不绿（仓库现状问题，非聚合器问题）"; tail -20 "$LOG"
fi

echo "── 5) SKIP ≠ PASS（子命令自报未覆盖时）"
if node tools/scripts/verify-all.mjs --steps=check:size >"$LOG" 2>&1 && grep -q 'SKIP' "$LOG"; then
  if node tools/scripts/verify-all.mjs --steps=check:size --strict >>"$LOG" 2>&1; then
    bad "--strict 下 SKIP 仍判 0 —— 收紧失效"
  else
    ok "本轮 check:size 为 SKIP，且 --strict 已判红（未测不算通过）"
  fi
elif grep -q 'STATUS: SKIP' "$LOG" || grep -q '未覆盖' "$LOG"; then
  bad "SKIP 却整体退出 0（非 strict 应为 0，但汇总必须点名 SKIP）"; tail -20 "$LOG"
else
  ok "本轮 check:size 无 SKIP（产物齐备），收紧路径断言不适用 —— 由 1) 的合成用例覆盖"
fi

echo
if [ "$rc" -eq 0 ]; then
  echo "✅ verify-all-selftest 全绿"
else
  echo "❌ verify-all-selftest 失败"
fi
exit "$rc"
