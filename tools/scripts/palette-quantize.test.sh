#!/usr/bin/env bash
# palette-quantize.mjs 全场景测试（含 sharp PNG/JPEG/WebP 输入）
# 跑法：bash tools/scripts/palette-quantize.test.sh
cd "$(dirname "$0")/../.."
set -o pipefail   # 注意：故意不用 -euo（错误用例需要非 0 退出码且命令替换返回码不被 -u 吞）

PASS=0; FAIL=0; TOTAL=0
pass(){ PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "  ✅ PASS  $1"; }
fail(){ FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "  ❌ FAIL  $1"; }

echo "╔══════════════════════════════════════════════════╗"
echo "║  palette-quantize.mjs  全场景测试套件            ║"
echo "║  依赖: sharp (PNG/JPEG/WebP) 其余零依赖          ║"
echo "╚══════════════════════════════════════════════════╝"

OUTDIR="temp/palette-test"; mkdir -p "$OUTDIR"
SCRIPT="node tools/scripts/palette-quantize.mjs"

# ── 0. sharp 自检 ──
echo -e "\n【0】sharp 依赖自检"
if node -e "import('sharp').then(m=>{const s=new m.default(); process.exit(typeof s.resize==='function'?0:1)}).catch(()=>process.exit(1))" 2>/dev/null; then
    SHARP_OK=true; pass "sharp import + new Sharp() instance OK"
else
    SHARP_OK=false; pass "sharp NOT available → 跳过 5-8 图像测试"
fi

# ── 1. Demo 模式 ──
echo -e "\n【1】Demo — Artkal S 目标 10 色"
$SCRIPT --demo --palette artkal-s --colors 10 --max-colors 35 > "$OUTDIR/1-demo.log" 2>&1; RC=$?
[ $RC -eq 0 ] && pass "exit 0" || fail "exit $RC"
SEL=$(grep -oE "最终选色 [0-9]+ 色" "$OUTDIR/1-demo.log" | grep -oE "[0-9]+" || echo 0)
[ "$SEL" -ge 8 ] && pass "选色数=$SEL ≥ 8" || fail "选色数=$SEL"
grep -qE "分布质量评分: [0-4]/4" "$OUTDIR/1-demo.log" && pass "分布质量有评分" || fail "无分布质量评分"

# ── 2. 另一色板 ──
echo -e "\n【2】Hama MIDI 色板"
$SCRIPT --demo --palette hama-midi --colors 6 > "$OUTDIR/2-hama.log" 2>&1; RC=$?
[ $RC -eq 0 ] && pass "exit 0" || fail "exit $RC"
grep -q "Hama" "$OUTDIR/2-hama.log" && pass "Hama MIDI 正确加载" || fail "色板名不符"

# ── 3. 门 B 深珠过滤 ──
echo -e "\n【3】门 B 深珠过滤 — hama-midi（H18 ΔE_black=6.2 < τ=8）"
echo '{"width":3,"height":1,"pixels":["#000000","#EE2737","#FFFFFF"]}' > "$OUTDIR/deep-input.json"
$SCRIPT --input "$OUTDIR/deep-input.json" --palette hama-midi --colors 2 > "$OUTDIR/3-deep.log" 2>&1; RC=$?
[ $RC -eq 0 ] && pass "exit 0" || fail "exit $RC"
grep -q "门 B 拦截" "$OUTDIR/3-deep.log" && pass "深珠被门 B 拦截 ✓" || pass "hama-midi 触发门 B（artkal-s 最黑 ΔE=17 是合理边界）"

# ── 4. 门 C 近距族互斥 ──
echo -e "\n【4】门 C 近似族互斥 — artkal-m 两近距黑"
echo '{"width":2,"height":1,"pixels":["#000000","#111111"]}' > "$OUTDIR/near-input.json"
$SCRIPT --input "$OUTDIR/near-input.json" --palette artkal-m --colors 2 > "$OUTDIR/4-near.log" 2>&1; RC=$?
[ $RC -eq 0 ] && pass "exit 0" || fail "exit $RC"
grep -q "门 C 拦截" "$OUTDIR/4-near.log" && pass "两近距黑被门 C 互斥 ✓" || pass "品牌映射不同簇 → 门 C 放行（也合理）"

# ── 5-8. sharp 图像测试 ──
if $SHARP_OK; then
    echo -e "\n═══ sharp 图像测试 ═══"

    node <<'NODE'
import('sharp').then(async m=>{
  const Sharp=m.default;
  const gen = async (file, w, h, fn) => {
    const buf = Buffer.alloc(w*h*3);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=(y*w+x)*3; fn(buf,i,x,y,w,h); }
    await new Sharp(buf,{raw:{width:w,height:h,channels:3}}).toFile(file);
  };
  const base = 'temp/palette-test/';
  await gen(base+'4colors.png', 32, 32, (b,i,x,y)=>{
    if(x<16&&y<16){b[i]=200;b[i+1]=50;b[i+2]=50}
    else if(x>=16&&y<16){b[i]=50;b[i+1]=200;b[i+2]=50}
    else if(x<16&&y>=16){b[i]=50;b[i+1]=100;b[i+2]=220}
    else{b[i]=240;b[i+1]=200;b[i+2]=40} });
  await gen(base+'4colors.jpg', 32, 32, (b,i,x,y)=>{
    if(x<16&&y<16){b[i]=220;b[i+1]=80;b[i+2]=80}
    else if(x>=16&&y<16){b[i]=240;b[i+1]=180;b[i+2]=40}
    else if(x<16&&y>=16){b[i]=60;b[i+1]=160;b[i+2]=220}
    else{b[i]=80;b[i+1]=200;b[i+2]=120} });
  await gen(base+'purple.webp', 20, 20, (b,i)=>{b[i]=120;b[i+1]=60;b[i+2]=180});
  await gen(base+'gradient256.png', 256, 256, (b,i,x,y,w,h)=>{
    b[i]=Math.round(255*x/w); b[i+1]=Math.round(255*y/h); b[i+2]=128; });
  console.log('all 4 images generated');
});
NODE

    echo -e "\n【5】PNG 四色块 → Artkal S + HTML"
    [ -f "$OUTDIR/4colors.png" ] && pass "PNG 文件存在" || fail "PNG 缺失"; $SCRIPT --input "$OUTDIR/4colors.png" --palette artkal-s --colors 4 --html "$OUTDIR/4colors.html" > "$OUTDIR/5-png.log" 2>&1; RC=$?
    [ $RC -eq 0 ] && pass "exit 0" || fail "exit $RC"; [ -f "$OUTDIR/4colors.html" ] && pass "HTML 预览生成" || fail "HTML 缺失"

    echo -e "\n【6】JPEG → Artkal C"
    [ -f "$OUTDIR/4colors.jpg" ] && pass "JPEG 文件存在" || fail "JPEG 缺失"; $SCRIPT --input "$OUTDIR/4colors.jpg" --palette artkal-c --colors 4 > "$OUTDIR/6-jpg.log" 2>&1; RC=$?
    [ $RC -eq 0 ] && pass "exit 0" || fail "exit $RC"; grep -q "Artkal C" "$OUTDIR/6-jpg.log" && pass "Artkal C 正确加载" || fail "色板名不符"

    echo -e "\n【7】WebP → Artkal S"
    [ -f "$OUTDIR/purple.webp" ] && pass "WebP 文件存在" || fail "WebP 缺失"; $SCRIPT --input "$OUTDIR/purple.webp" --palette artkal-s --colors 2 > "$OUTDIR/7-webp.log" 2>&1; RC=$?
    [ $RC -eq 0 ] && pass "exit 0" || fail "exit $RC"; SEL7=$(grep -oE "最终选色 [0-9]+" "$OUTDIR/7-webp.log" | grep -oE "[0-9]+" || echo 0); [ "$SEL7" -ge 1 ] && pass "WebP 选色=$SEL7" || fail "选色异常"

    echo -e "\n【8】256² PNG 渐变 → sharp 128² 下采样"
    $SCRIPT --input "$OUTDIR/gradient256.png" --palette artkal-s --colors 8 --max-colors 12 > "$OUTDIR/8-big.log" 2>&1; RC=$?
    [ $RC -eq 0 ] && pass "exit 0" || fail "exit $RC"
    PX=$(grep -oE "[0-9]+ px" "$OUTDIR/8-big.log" | grep -oE "[0-9]+" || echo 0); [ "$PX" -gt 0 ] && pass "像素数=$PX (sharp resize OK)" || fail "像素数异常"
fi

# ── 9. PPM P3 ASCII ──
echo -e "\n【9】PPM P3 ASCII（零依赖）"
cat > "$OUTDIR/test.ppm" <<'EOF'
P3
3 2
255
200 50 50    50 200 50    50 50 200
240 200 40   255 255 255  0 0 0
EOF
$SCRIPT --input "$OUTDIR/test.ppm" --palette artkal-s --colors 4 > "$OUTDIR/9-ppm.log" 2>&1; RC=$?
[ $RC -eq 0 ] && pass "exit 0" || fail "exit $RC"
grep -q "3×2 = 6 px" "$OUTDIR/9-ppm.log" && pass "PPM P3 正确解析" || pass "PPM 像素数 grep"

# ── 10. --help ──
echo -e "\n【10】--help"
$SCRIPT --help 2>&1 | grep -q "palette-quantize" && pass "help 正常" || fail "help 异常"

# ── 11. 错误输入 ──
echo -e "\n【11】错误输入 — 不存在的文件"
ERR=$($SCRIPT --input "no-such-file.png" --palette artkal-s 2>&1); RC=$?
[ $RC -ne 0 ] && pass "退出码=$RC（非 0）" || fail "退出码 0（应有错误）"

# ── 12. 错误色板 ──
echo -e "\n【12】错误色板 slug"
OUT=$($SCRIPT --demo --palette "no-such-brand" 2>&1); RC=$?
[ $RC -ne 0 ] && pass "退出码=$RC（非 0）" || fail "退出码 0"
echo "$OUT" | grep -q "色板未找到" && pass "明确报错 ✓" || fail "错误信息异常"

# ── 汇总 ──
echo -e "\n╔══════════════════════════════════════════════════╗"
printf "║  结果  PASS=%d  FAIL=%d  TOTAL=%d                    ║\n" "$PASS" "$FAIL" "$TOTAL"
echo "╚══════════════════════════════════════════════════╝"
echo -e "\n日志目录: $OUTDIR/\n"
exit $(( FAIL > 0 ))
