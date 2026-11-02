"""木质圆牌底托两态派生：满幅盘体 + 内缘刻印（normal）／压暗加深内缘（pressed）。

来源：WXG-T-546/547/548（原 `temp/m10-base-gen.py`）。
输入 = T-539 的共用底托 `btn-base-2x-160.png`（该件 bbox 占满 0..159）。

⛔ 三条硬约束（全是踩过的坑，改这里前先读）：
  1. **盘体不得位移**：源 bbox 已占满画布，上移会把盘顶切平（WXG-T-546 首版错）。
  2. **盘体不得缩小**：缩了才能放下外投影，但代价是运行时常量 `MENU_TOPBAR_VISUAL_D = 80`
     按满幅铺满绘制 ⇒ 盘体实显直径跟着缩水（0.90 档只剩 Ø72，小 10%），四钮会明显小于其他 UI。
  3. **不要外投影**：源件没有余量，任何外投影都会溢到画布外被裁（WXG-T-547 修完顶部后暴露）。
⇒ 结论：立体感改由**内缘刻印**表达——满幅、零溢出、与「木刻」主题一致（图标本来就是刻痕）。

按下态语义：木牌本身无内投影，故不用白盘版「投影紧贴变窄」的旧口径，改为「整体压暗 10% + 内缘加深」。

用法：python3 games/beads/design/ai-workflows/gen-circle-base-2state.py（产物落 temp/，再拷入 final 与 cocos）
"""
from PIL import Image, ImageChops, ImageEnhance, ImageFilter

BASE = ('games/beads/design/art/proposals/menu-3d-style-20261030/'
        'btn-topbar-layered-20261102/btn-base-2x-160.png')
S = 160
RING = 7            # 内缘环宽度（MinFilter 核径）
RING_ALPHA = 0.28   # normal 内缘暗度
RING_ALPHA_PRESS = 0.44
PRESS_DARKEN = 0.90

body = Image.open(BASE).convert('RGBA').resize((S, S), Image.LANCZOS)
a = body.getchannel('A')
ring = ImageChops.subtract(a, a.filter(ImageFilter.MinFilter(RING)))

# 内缘：上缘略深（光从上方来，坑的上内壁背光），下缘略浅
yy = Image.linear_gradient('L').resize((S, S), Image.LANCZOS)  # 0 → 255 自上而下
ring_w = ImageChops.multiply(ring, yy.point(lambda v: int(160 + v * 0.37)))


def with_ring(level):
    over = Image.new('RGBA', (S, S), (28, 14, 5, 0))
    over.putalpha(ring_w.point(lambda v: int(v * level)))
    return Image.alpha_composite(over, body)


normal = with_ring(RING_ALPHA)

_r, _g, _b, _a = body.split()
_lit = ImageEnhance.Brightness(Image.merge('RGB', (_r, _g, _b))).enhance(PRESS_DARKEN)
dimmed = Image.merge('RGBA', (*_lit.split(), _a))
_ar, _ag, _ab, _aa = dimmed.split()
over = Image.new('RGBA', (S, S), (28, 14, 5, 0))
over.putalpha(ring_w.point(lambda v: int(v * RING_ALPHA_PRESS)))
pressed = Image.alpha_composite(over, dimmed)

normal.save('temp/base-normal-160.png')
pressed.save('temp/base-pressed-160.png')
print('normal / pressed 已生成（满幅 160，内缘刻印）')
