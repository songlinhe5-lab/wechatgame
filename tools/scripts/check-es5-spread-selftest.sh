#!/usr/bin/env bash
# check-es5-spread-selftest.sh —— 证明守卫「真的会红」（K-030 判据：脚本自测可能假绿，必须实测红→绿）
#
# 三步：
#   1) 基线：仓库现状应绿（exit 0）
#   2) 种植：往 games/beads/src 写一个临时文件，含 5 类缺陷形态（ES-01 数组展开：Set /
#      Map.keys() 迭代器 / 字符串；ES-02 调用展开；ES-03 rest 解构）+ 一个安全数组展开
#      + 一个逃生阀行 ⇒ 守卫必须红（exit 1），且**缺陷数 == 5**、安全行与逃生阀行不得被报
#   3) 清理：删除临时文件 ⇒ 恢复绿（exit 0），并断言工作树无残留
#
# 用法：bash tools/scripts/check-es5-spread-selftest.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
FIX=games/beads/src/__es5-spread-selftest.ts
rc=0
trap 'rm -f "$FIX"' EXIT

echo "── 1) 基线（仓库现状）"
if node tools/scripts/check-es5-spread.mjs >/tmp/es5-base.log 2>&1; then
  echo "   ✅ 绿（$(tail -1 /tmp/es5-base.log)）"
else
  echo "   ❌ 基线不绿，后续判定无意义"; cat /tmp/es5-base.log; exit 1
fi


echo "── 2) 种植 5 类缺陷 + 1 安全 + 1 逃生阀"
cat > "$FIX" <<'TS'
export function a(set: Set<number>): number[] {
  return [...set];
}
export function b(map: Map<string, number>): string[] {
  return [...map.keys()];
}
export function c(row: string): string[] {
  return [...row];
}
export function d(set: Set<number>): number {
  return Math.max(...set);
}
export function g(map: Map<string, number>): unknown {
  const [first, ...rest] = map;
  return [first, rest];
}
export function e(nums: number[]): number[] {
  return [...nums];
}
export function f(items: ArrayLike<string>): string[] {
  return [...items]; // es5-spread: allow 逃生阀演示
}
TS
node tools/scripts/check-es5-spread.mjs --json > /tmp/es5-planted.json 2>&1
code=$?
n=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/es5-planted.json','utf8')).violations.length)" 2>/dev/null || echo "?")
files=$(node -e "const v=JSON.parse(require('fs').readFileSync('/tmp/es5-planted.json','utf8')).violations;console.log(v.map(x=>x.kind).sort().join(','))" 2>/dev/null || echo "?")
if [ "$code" = "1" ] && [ "$n" = "5" ]; then
  echo "   ✅ 红，且缺陷数 == 5 → ${files}；安全数组展开与逃生阀未被误报"
else
  echo "   ❌ 期望 exit=1 / 5 条，实得 exit=${code} / ${n} 条 → ${files}"; rc=1
fi

echo "── 3) 清理后应回到绿"
rm -f "$FIX"
if node tools/scripts/check-es5-spread.mjs >/tmp/es5-after.log 2>&1; then
  echo "   ✅ 绿（$(tail -1 /tmp/es5-after.log)）"
else
  echo "   ❌ 清理后仍红"; cat /tmp/es5-after.log; rc=1
fi
if git status --porcelain -- "$FIX" | grep -q .; then
  echo "   ❌ 工作树有残留：$FIX"; rc=1
else
  echo "   ✅ 无残留（$FIX 未留在工作树）"
fi
[ "$rc" = "0" ] && echo "🎉 check-es5-spread 自测通过（红→绿双向均可复现）" || echo "💥 自测失败"
exit "$rc"
