#!/usr/bin/env bash
# ui-golden-capture-selftest.sh — 复取器「可复现锚」守卫的负样本（WXG-T-375）。
#
# 守的是什么：`games/beads/tests/ui-golden-capture.ts` 在写夹具前必须确认
# `WXG298_SOURCE_REV` 等于当前 HEAD，否则夹具会带着一个「不是这段代码跑出来的」假出处
# （WXG-T-375 上一批 `capturedFrom` 就曾失真为无关 commit）。
#
# 负样本（两条都必须被拦住，且夹具字节不变）：
#   ① 缺 env             → exit ≠ 0，报错点明 WXG298_SOURCE_REV；
#   ② rev ≠ HEAD（deadbeef）→ 同上。
# 正例不在本脚本验：正例必然写夹具，而只读测试跑在 dirty 工作树上会污染夹具 ⇒ 由真实
# 复取批在干净检出里覆盖（见 docs/architecture/ui-architecture-beads.md §12 末条）。
#
# 用法：tools/scripts/ui-golden-capture-selftest.sh

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="games/beads/tests/__fixtures__/wxg-t-298-ui-golden.json"
RUN=(node --experimental-transform-types --import=./tools/scripts/lib/ts-js-resolve.mjs games/beads/tests/ui-golden-capture.ts)
PASS=0
FAIL=0

cd "$ROOT" || exit 1
before=$(shasum -a 256 "$FIXTURE" | awk '{print $1}')

check_rejected() {
    label="$1"
    shift
    out=$(env "$@" "${RUN[@]}" 2>&1)
    rc=$?
    if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q 'WXG298_SOURCE_REV'; then
        PASS=$((PASS + 1)); echo "  ✔ $label ⇒ 拒写（exit ${rc}）"
    else
        FAIL=$((FAIL + 1)); echo "  ✘ $label 未被拦住（exit ${rc}）"
    fi
}

check_rejected "① 缺 env" -u WXG298_SOURCE_REV
check_rejected "② rev ≠ HEAD" WXG298_SOURCE_REV=deadbeef

after=$(shasum -a 256 "$FIXTURE" | awk '{print $1}')
if [ "$before" = "$after" ]; then
    PASS=$((PASS + 1)); echo "  ✔ 两次拒写后夹具字节不变"
else
    FAIL=$((FAIL + 1)); echo "  ✘ 夹具被改写了！"
fi

echo "=================================================================="
echo "结果：PASS=$PASS FAIL=$FAIL"
echo "=================================================================="
[ "$FAIL" -eq 0 ] || exit 1
