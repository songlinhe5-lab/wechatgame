#!/usr/bin/env python3
"""U1② 落位测算：位图招牌塞进「顶栏 ↔ 门楣牌」带，需要压橱窗多少 px。

数值全部现读 `tuning.ts`（⛔ 不凭摘要），断言 = 在册的 Δ12 关系不变式 + 热区不叠。
用法：python3 b26-squeeze.py [--topbar-selftop 124]
"""
import re
import sys

TUN = "games/beads/src/config/tuning.ts"
ARCH = "games/beads/design/art/proposals/ui-style-redesign/menu-architecture.md"
DESIGN_H = 1334
DELTA = 12          # 在册带间净空口径（SIGN_BAND_PAD 同值）
SLOGAN_LINE = 28    # font_label 地板
# 牌高变体（均为 `b26-resign.py` 与行宽剖面实测，⛔ 不是估的）：
#   707×459 原件含两绳，绳在 y=0 被齐断；行宽 36→149 的跳变在 @2x y≈120（蝴蝶结顶），
#   跳变到 606 在 @2x y≈172（板上缘）。定稿版面 454×183 = 板上裁件 345×139 的 1.316× 等比。
VARIANTS = (
    (354, 230, "V-a 含断头绳（原件 1:1）"),
    (345, 170, "V-b 切绳留蝶（裁 @2x y≈120）"),
    (345, 139, "V-c 切到板上缘（已产 sign-norope@2x）"),
    (454, 183, "V-d 按定稿版面（= V-c 放大 1.316×，边缘必软）"),
)


def const(name):
    m = re.search(r"^export const %s = ([\d.]+);" %
                  name, open(TUN).read(), re.M)
    return float(m.group(1))


def hotzone_selftop():
    """顶栏热区 y-up 区间：必须钉「设置（齿轮）」那一行 `y∈[a,b]`（§5.1b 落位表）。
    ⚠ 文中首个 y∈[...] 是安全避让带 [1214,1334]，不是顶栏——上一版抓错行，自证当场报。"""
    m = re.search(r"设置[^|]*\|[^|]*y∈\[(\d+),(\d+)\]", open(ARCH).read())
    return m.groups()


CAROUSEL_TOP = const("CAROUSEL_TOP")
CAROUSEL_H = const("CAROUSEL_H")
CAROUSEL_THUMB = const("CAROUSEL_THUMB_AREA")
CAROUSEL_TEXT = const("CAROUSEL_TEXT_BAND")
PLAQUE_H = const("MENU_PLAQUE_H")
PLAQUE_PAD = const("SIGN_BAND_PAD")
PRIMARY_Y = const("MENU_PRIMARY_Y")          # 主钮下缘
TOUCH_MIN = const("TOUCH_MIN")
TITLE_Y = const("MENU_TITLE_Y")              # 珠拼带中心（现状对照）
SIGN_H = const("SIGN_MATRIX_N") * const("SIGN_BEAD_PITCH")

a, b = hotzone_selftop()                       # 顶栏热区 y-up 区间
TOP_LOW, TOP_HIGH = int(a), int(b)
CARD_TOP = CAROUSEL_TOP
PLAQUE_BOT = CARD_TOP + PLAQUE_PAD
PLAQUE_TOP = PLAQUE_BOT + PLAQUE_H
BAND_LOW, BAND_HIGH = PLAQUE_TOP, TOP_LOW      # 招牌可用带
GAP_CARD_PRIMARY = CARD_TOP - CAROUSEL_H - PRIMARY_Y - TOUCH_MIN  # 卡底 ↔ 主钮顶（现状）

print("== 现装（实测 tuning.ts）==")
print("顶栏热区 y-up [%d,%d]（自顶 %s–%s）｜珠拼招牌带 [%d,%d] 高 %d" %
      (TOP_LOW, TOP_HIGH, DESIGN_H - TOP_HIGH, DESIGN_H - TOP_LOW,
       TITLE_Y - SIGN_H / 2, TITLE_Y + SIGN_H / 2, SIGN_H))
print("slogan 基线 %.0f｜门楣牌带 [%d,%d]（派生 CAROUSEL_TOP+%d+%d）" %
      (const("MENU_SLOGAN_Y"), PLAQUE_BOT, PLAQUE_TOP, PLAQUE_PAD, PLAQUE_H))
print("走马灯卡带 [%d,%d] 高 %d（内件 缩略 %d + 文字带 %d = %d）｜卡底↔主钮顶净空 %d" %
      (CARD_TOP - CAROUSEL_H, CARD_TOP, CAROUSEL_H, CAROUSEL_THUMB, CAROUSEL_TEXT,
       CAROUSEL_THUMB + CAROUSEL_TEXT, GAP_CARD_PRIMARY))
print("⇒ 招牌可用带 = 门楣牌顶 %d ↔ 顶栏热区底 %d = **%d px**\n" %
      (PLAQUE_TOP, TOP_LOW, BAND_HIGH - BAND_LOW))

avail = BAND_HIGH - BAND_LOW
SLOGAN = '--with-slogan' in sys.argv
print('slogan 口径：%s' % ('在册（占 28 + Δ12）' if SLOGAN else '**已裁取消**（不占带）'))
for w, h, tag in VARIANTS:
    need = DELTA + h + (DELTA + (SLOGAN_LINE + DELTA if SLOGAN else 0))
    slack = avail - need
    print("%s｜需 %d px｜现带 %d ⇒ %s" % (tag, need, avail,
                                     "够，余 %d" % slack if slack >= 0 else "缺 **%d**" % -slack))
    squeeze = -slack
    if squeeze > 0:
        keep = CAROUSEL_H
        print("   压法 A 整卡下移 %d：卡带 [%d,%d] 内容不动｜卡底↔主钮净空 %d→%d%s" %
              (squeeze, CARD_TOP - CAROUSEL_H - squeeze, CARD_TOP - squeeze,
               GAP_CARD_PRIMARY, GAP_CARD_PRIMARY - squeeze,
               "⛔ 热区相叠" if GAP_CARD_PRIMARY - squeeze < 0 else ""))
        print("   压法 B 压卡高 %d→%d：卡底 520 不动 ⇒ 须从内件割 %d（缩略 %d→%d 或 文字带 %d→%d，"
              "⚠ 后者触 28 地板）" % (keep, keep - squeeze, squeeze, CAROUSEL_THUMB,
                                CAROUSEL_THUMB - squeeze, CAROUSEL_TEXT, CAROUSEL_TEXT - squeeze))
    # 牌顶锚定顶栏下缘 Δ12 后，牌底与门楣牌顶的净空（落位可行性第二道门）
    sign_bot = TOP_LOW - DELTA - h
    print("   落位：牌顶 %d（顶栏底 −Δ%d）⇒ 牌底 %d｜门楣牌顶 %d ⇒ 净空 %d%s\n" %
          (TOP_LOW - DELTA, DELTA, sign_bot, PLAQUE_TOP, sign_bot - PLAQUE_TOP,
           "✓" if sign_bot - PLAQUE_TOP >= DELTA else "⛔ 不足 Δ12"))

# 断言：在册判据不被本测算悄悄放宽
assert BAND_HIGH - BAND_LOW == 212, "可用带读数与预期不符，别硬算（顶栏行抓错？）"
assert CAROUSEL_THUMB + CAROUSEL_TEXT == CAROUSEL_H, "卡内件已不恰好充满，口径变了"
assert PLAQUE_PAD == DELTA, "门楣牌让位 Δ 与在册 12 不同源"
print("自证通过：带 212 / 卡内 340=240+100 / Δ12 单源")
