# beads-studio 生成器服务（WXG-T-179 续作）。
# 部署单元 = 本镜像内 apps/beads-studio + tools/scripts/beads-gen.mjs 两个目录；
# 生成核心走 --in-raw --no-png 免浏览器路径 ⇒ 无需 playwright/chromium。
# 基础镜像可覆盖：默认走 Docker Hub 正名（GitHub Runner 能直连）；国内 VPS 上由 compose
# 传 BEADS_STUDIO_BASE_IMAGE（deploy.sh 首次会在 VPS 上建 .env）换成可达镜像源，
# 不改 daemon.json 也不重启 docker（同机其他容器不受影响）。
ARG BASE_IMAGE=node:20-alpine
FROM ${BASE_IMAGE}
WORKDIR /app
COPY apps/beads-studio/package.json ./
# beads-gen 拷到 vendor/ 并由 server.mjs 的容器分支（vendor/beads-gen.mjs）解析
COPY tools/scripts/beads-gen.mjs ./vendor/beads-gen.mjs
# Artkal 色板（--palette artkal 时 beads-gen 按 cwd/temp/ 解析，见其 ARTKAL 查找链）
COPY games/beads/art/artkal-palette.json ./temp/artkal-palette.json
COPY apps/beads-studio/server.mjs ./server.mjs
COPY apps/beads-studio/public ./public
RUN mkdir -p data
ENV PORT=8787
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "server.mjs"]
