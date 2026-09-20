#!/usr/bin/env bash
# beads-studio 一键发布（WXG-T-179 续作）—— 与 .github/workflows/beads-studio-deploy.yml 同步的本地版。
#
# 为何要有它：CI 要先在 repo 配 SSH secrets 才生效；本机没装 / 没起 Docker 时也能靠这个直发
# （镜像构建发生在 VPS 上，本机只做 rsync + ssh）。
#
# 用法：
#   VPS=root@1.2.3.4 ./apps/beads-studio/deploy.sh
#   VPS=root@1.2.3.4 PORT=9000 KEY=~/.ssh/id_ed25519 DEST=/srv/beads-studio ./apps/beads-studio/deploy.sh
#   # 国内 VPS 拉不到 Docker Hub 时（不重启 docker、不改 daemon.json）：
#   VPS=root@1.2.3.4 BASE_IMAGE=public.ecr.aws/docker/library/node:20-alpine ./apps/beads-studio/deploy.sh
set -euo pipefail

[ -n "${VPS:-}" ] || { echo "用法：VPS=user@host ./deploy.sh（可选 PORT / KEY / DEST）"; exit 1; }
DEST="${DEST:-/opt/beads-studio}"
PORT="${PORT:-8787}"
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

SSH_OPTS=()
RSYNC_RSH="ssh"
if [ -n "${KEY:-}" ]; then
  SSH_OPTS+=(-i "$KEY")
  RSYNC_RSH="ssh -i $KEY"
fi
RSYNC=(rsync -az -e "$RSYNC_RSH")
# bash 3.2（macOS 自带）+ set -u 下直接 `"${SSH_OPTS[@]}"` 展开空数组会报 unbound ⇒ 走守卫写法。
ssh_x() { ssh ${SSH_OPTS[@]+"${SSH_OPTS[@]}"} "$VPS" "$@"; }

# ⚠ bash 3.2（macOS 自带）在 C/POSIX locale 下会把紧跟变量名的全角标点当作变量名字符 ⇒ 变量一律加 {}。
echo "→ rsync 部署单元到 ${VPS}:${DEST}（apps/beads-studio + beads-gen + artkal 色板）"
ssh_x "mkdir -p '$DEST/apps/beads-studio/public' '$DEST/tools/scripts' '$DEST/games/beads/art'"
# 本机 data/（调试产物）与 node_modules 不外传；Dockerfile / docker-compose.yml 随目录一并走。
"${RSYNC[@]}" --exclude data --exclude node_modules \
  "$REPO/apps/beads-studio/" "$VPS:$DEST/apps/beads-studio/"
"${RSYNC[@]}" "$REPO/tools/scripts/beads-gen.mjs" "$VPS:$DEST/tools/scripts/"
"${RSYNC[@]}" "$REPO/games/beads/art/artkal-palette.json" "$VPS:$DEST/games/beads/art/"

echo "→ 远端构建并启动（compose build context = ${DEST}）"
# BASE_IMAGE 只影响本次构建的 FROM（空 ⇒ compose 默认 node:20-alpine）。
ssh_x "cd '$DEST' && BEADS_STUDIO_BASE_IMAGE='${BASE_IMAGE:-}' PORT='$PORT' \
  docker compose -f apps/beads-studio/docker-compose.yml up -d --build"

echo "→ 健康检查（VPS 本机回环 :${PORT}/api/results）"
ssh_x "sleep 3; curl -fsS --max-time 10 'http://127.0.0.1:$PORT/api/results' >/dev/null \
  && echo OK \
  || { docker compose -f '$DEST/apps/beads-studio/docker-compose.yml' logs --tail 30; exit 1; }"

HOST=${VPS#*@}
echo "完成 → 前端 http://${HOST}:${PORT}/ ｜ 小游戏启动参数 studio=http://${HOST}:${PORT}"
