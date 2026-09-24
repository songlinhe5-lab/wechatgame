#!/usr/bin/env bash
# 拉取 2026-09-24 批四个外部 skill 源文件（正本登记见 my-skills/INDEX.md §1b.1）。
# 用法：在**空目录**里跑 `bash <本文件>` 生成 ./<skill>/ 暂存，再 `cp -R` 覆盖
# my-skills/<skill>/（上游正文逐字保留，不做本地改写）。
# 已省略：security-audit 的 validate-*.test.cjs（校验器自带单测，SKILL.md 不引用）。
set -euo pipefail
raw() { curl -sfL --retry 3 "https://raw.githubusercontent.com/$1" -o "$2"; }

CF=cloudflare/security-audit-skill/main/skills/security-audit
mkdir -p security-audit
for f in AI-AND-LLM.md ATTACK-CLASSES.md CLIENT-SIDE.md CLOUD-AND-DEPLOYMENT.md \
  DATA-ISOLATION-AND-LIFECYCLE.md DESKTOP-MOBILE-AND-LOCAL-IPC.md HUNTING.md \
  MEMORY-SAFETY-AND-BINARY.md PROTOCOLS-RPC-AND-MESSAGING.md RECONNAISSANCE.md \
  RESOURCE-EXHAUSTION-AND-AVAILABILITY.md SKILL.md SUPPLY-CHAIN-AND-RELEASE.md \
  VALIDATION-AND-REPORTING.md WEB-PROTOCOL-AND-AUTH.md report-schema.json \
  validate-coverage-ledger.cjs validate-findings.cjs; do
  raw "$CF/$f" "security-audit/$f"
done
raw "cloudflare/security-audit-skill/main/LICENSE" security-audit/LICENSE

AL=alibaba/open-code-review/main
mkdir -p open-code-review open-code-review-delegate
raw "$AL/skills/open-code-review/SKILL.md" open-code-review/SKILL.md
raw "$AL/skills/open-code-review-delegate/SKILL.md" open-code-review-delegate/SKILL.md
raw "$AL/LICENSE" open-code-review/LICENSE
cp open-code-review/LICENSE open-code-review-delegate/LICENSE

TB=Tencent/BrowserSkill/main/crates/bsk-cli/skill
mkdir -p browser-skill/references
raw "$TB/SKILL.md" browser-skill/SKILL.md
for f in debugging environment files help-and-recovery interaction-details \
  screenshots-and-canvas tabs-and-profiles; do
  raw "$TB/references/$f.md" "browser-skill/references/$f.md"
done
raw "Tencent/BrowserSkill/main/LICENSE" browser-skill/LICENSE

GA=google/ax/main
mkdir -p ax-runtime/docs
raw "$GA/README.md" ax-runtime/UPSTREAM-README.md
raw "$GA/DESIGN.md" ax-runtime/UPSTREAM-DESIGN.md

echo "== fetched =="
find . -type f | sort | xargs wc -c | tail -45
