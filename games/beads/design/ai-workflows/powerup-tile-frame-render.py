# Prop tile = wood-brown rounded frame (60x60, r14, 3px rim) + cream inner + icon 44x44 centred.
# Outer drop shadow matched to the star shadow: colour (55,28,8), offset y +4, blur 3, peak alpha 0.45.
# Canvas 84x84 design units, rendered at 4x (336 px). Frame sits at (12,12)-(72,72) so the node position is fixed.
from PIL import Image, ImageDraw, ImageFilter
S=4; U=84*S
def rr(draw_box, radius, fill):
    return dict(xy=draw_box, radius=radius, fill=fill)
ICONS={'window_restore':'powerup_window_restore-keyed-512.png','random_restore':'powerup_random_restore-keyed-512.png','tray_restore':'powerup_tray_restore-keyed-512.png'}
def tile(icon_path):
    # shadow layer
    m=Image.new('L',(U,U),0); md=ImageDraw.Draw(m)
    md.rounded_rectangle([12*S,(12+4)*S,72*S,(72+4)*S], radius=14*S, fill=255)
    m=m.filter(ImageFilter.GaussianBlur(3*S))
    shadow=Image.new('RGBA',(U,U),(55,28,8,0))
    shadow.putalpha(m.point(lambda v: int(v*0.45)))
    canvas=Image.new('RGBA',(U,U),(0,0,0,0))
    canvas.alpha_composite(shadow)
    d=ImageDraw.Draw(canvas)
    d.rounded_rectangle([12*S,12*S,72*S,72*S], radius=14*S, fill=(0x6B,0x3E,0x17,255))
    d.rounded_rectangle([15*S,15*S,69*S,69*S], radius=11*S, fill=(0xF5,0xE6,0xC8,255))
    ic=Image.open(icon_path).convert('RGBA').resize((44*S,44*S),Image.LANCZOS)
    canvas.alpha_composite(ic,(20*S,20*S))
    return canvas.resize((336,336),Image.LANCZOS)
for k,f in ICONS.items():
    tile(f).save(f'tile_{k}_336.png',optimize=True)
    print('ok',k)
