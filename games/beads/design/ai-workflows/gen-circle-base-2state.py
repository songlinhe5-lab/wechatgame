"""木质圆牌底托两态派生：normal = 木牌 + 柔和投影；pressed = 木牌压暗、无投影。

来源：WXG-T-546（`temp/m10-base-gen.py` 原样搬运）。输入 = T-539 的共用底托 `btn-base-2x-160.png`。
按下态语义：木牌本身无内投影，故不用「投影变窄」的旧口径（那是白盘版），改为「去投影 + 压暗 10%」。
用法：python3 games/beads/design/ai-workflows/gen-circle-base-2state.py（产物落 temp/，再拷入 final 与 cocos）
"""
from PIL import Image, ImageEnhance, ImageFilter

BASE = ('games/beads/design/art/proposals/menu-3d-style-20261030/'
        'btn-topbar-layered-20261102/btn-base-2x-160.png')
S = 160
LIFT = 0            # ⛔ 不得上移：源底托 bbox 已占满 0..159，任何上移都会把盘顶切平（WXG-T-546 首版即此错）
BLUR = 4            # 投影模糊半径
SHADOW_ALPHA = 0.40  # 投影最深处不透明度
PRESS_DARKEN = 0.90  # 按下态亮度系数

src = Image.open(BASE).convert('RGBA').resize((S, S), Image.LANCZOS)

body = Image.new('RGBA', (S, S), (0, 0, 0, 0))
body.alpha_composite(src, (0, -LIFT))

a = body.getchannel('A')
sh = Image.new('L', (S, S), 0)
sh.paste(a, (0, 5))                             # 投影只在下方溢出（与旧白盘同口径，溢出被画布裁掉）
sh = sh.filter(ImageFilter.GaussianBlur(BLUR))
shadow = Image.new('RGBA', (S, S), (24, 12, 4, 0))
shadow.putalpha(sh.point(lambda v: int(v * SHADOW_ALPHA)))

normal = Image.alpha_composite(shadow, body)

_r, _g, _b, _a = body.split()
_lit = ImageEnhance.Brightness(Image.merge('RGB', (_r, _g, _b))).enhance(PRESS_DARKEN)
pressed = Image.merge('RGBA', (*_lit.split(), _a))

normal.save('temp/base-normal-160.png')
pressed.save('temp/base-pressed-160.png')
print('normal / pressed 已生成，尺寸', normal.size)
