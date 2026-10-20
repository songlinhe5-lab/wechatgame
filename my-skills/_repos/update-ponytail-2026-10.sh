#!/usr/bin/env bash
# 刷新 ponytail 家族六件（正本登记见 my-skills/INDEX.md §1b.2）。
# 上游：https://github.com/DietrichGebert/ponytail （MIT，根 LICENSE；技能正文在 skills/<name>/SKILL.md）
# 用法：在 my-skills/_repos/ 里跑 `bash <本文件>` ⇒ 生成/更新 ./ponytail 克隆，
#       再把 upstream/skills/ponytail* 逐字 `cp -R` 覆盖 my-skills/<skill>/。
# ⚠ 与 mattpocock-skills / superpowers / Claude-Code-Game-Studios 同惯例：克隆是内嵌
#   git 仓库，**不入库**（见 .gitignore），只作本地备查与刷新源。
# 入库快照的 provenance：首次从**本机已装副本** `~/.qoder/skills/ponytail*` 逐字 `cp -R`
#   （非上游直取），故刷新时**先 diff 再覆盖**——上游与已装副本措辞可能漂移，覆盖会改
#   本会话亲测在用的那条纪律文本。
set -euo pipefail
cd "$(dirname "$0")"

REPO=https://github.com/DietrichGebert/ponytail.git
SKILLS="ponytail ponytail-audit ponytail-debt ponytail-gain ponytail-help ponytail-review"

if [ -d ponytail/.git ]; then
  ( cd ponytail && git pull --ff-only )
else
  rm -rf ponytail && git clone --depth 1 "$REPO" ponytail
fi

echo "== upstream sha =="
( cd ponytail && git rev-parse --short HEAD )

echo "== diff（上游 vs 已入库正本；只报差异，不自动覆盖）=="
for s in $SKILLS; do
  if [ ! -f "ponytail/skills/$s/SKILL.md" ]; then echo "!! 上游缺 skills/$s/SKILL.md"; continue; fi
  if diff -q "ponytail/skills/$s/SKILL.md" "../$s/SKILL.md" >/dev/null 2>&1; then
    echo "   $s: 与上游一致"
  else
    echo "   $s: 有差异 ⇒ 人工看过再 cp -R ponytail/skills/$s ../$s"
  fi
done

echo "== 覆盖后必跑 =="
echo "   pnpm run check:links    # frontmatter name 必须等于目录名，且四 IDE skills/<name> 链接存在"
