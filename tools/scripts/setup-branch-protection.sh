#!/usr/bin/env bash
# 幂等配置 master 分支保护 — WXG-T-016
# 用法：tools/scripts/setup-branch-protection.sh
# 前置：gh 已安装且登录（需对该仓库有 admin 权限）
# 注意：required check 名匹配的是 check run 名（job 名）。
#       本脚本按精确名配置：gate（CI 收口）/ review（PR Review Headless 的 job id）/ lint（Commit Lint 的 job id）。
#       若 PR Checks 页显示的名字与此不符（例如带 workflow 名前缀），先跑一次 CI 核对实际名字后修正下方 CONTEXTS。
set -euo pipefail

BRANCH="master"
CONTEXTS='["gate", "review", "lint"]'

fail() { echo "❌ $*" >&2; exit 1; }

command -v gh >/dev/null 2>&1 || fail "未安装 gh CLI，请先安装：https://cli.github.com/"
gh auth status >/dev/null 2>&1 || fail "gh 未登录，请先执行: gh auth login"
command -v git >/dev/null 2>&1 || fail "未安装 git"

# 从 origin 解析 OWNER/REPO（支持 https 与 ssh 两种形式，容忍 .git 后缀）
REMOTE_URL="$(git remote get-url origin)" || fail "无法读取 origin remote"
REPO="$(printf '%s' "$REMOTE_URL" | sed -E 's#^https://github\.com/##; s#^git@github\.com:##; s#\.git$##')"
[ -n "$REPO" ] && [ "$REPO" != "$REMOTE_URL" ] || fail "无法从 origin 解析 GitHub 仓库名（当前: $REMOTE_URL）"

echo "仓库: $REPO    分支: $BRANCH"
echo "required checks: $CONTEXTS"

# 裁定留痕（WXG-T-016，主理人）：
# - enforce_admins=false：单人仓库，若对管理员同样生效，任何 check 故障/误配都会
#   把自己锁死且无第二人可解锁——保留紧急处置通道。
# - approvals=0：单人仓库无第二人可批准，1 个 approval 即自批死锁；
#   合并拦截由 required check `review`（Headless 评审）承担，不依赖人工 approval。
# 注意：定界符必须带引号（<<'JSON'）——否则反引号会被 bash 当命令替换执行；
#       JSON 不支持注释，说明文字一律放这里，不得写进 PAYLOAD。
PAYLOAD="$(cat <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["gate", "review", "lint"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
)"

# PUT 该接口本身幂等：重复执行只会覆盖为同一份配置
if gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" --input - <<< "$PAYLOAD" >/dev/null; then
  echo "✅ 分支保护已写入（幂等，可重复执行）"
else
  STATUS=$?
  echo "❌ 写入失败（exit=$STATUS）。常见原因：" >&2
  echo "   - 私有仓库 / 免费方案无分支保护权限（需 Pro 或公开仓库）" >&2
  echo "   - gh 账号对该仓库无 admin 权限" >&2
  exit "$STATUS"
fi

echo
echo "当前生效的 required contexts："
gh api "repos/$REPO/branches/$BRANCH/protection/required_status_checks" --jq '.contexts[]'
echo
echo "提示：若上述名字与 PR Checks 页实际 check 名不一致，先跑一次 CI 核对名字，"
echo "     再修正本脚本 CONTEXTS 后重跑（幂等）。"
