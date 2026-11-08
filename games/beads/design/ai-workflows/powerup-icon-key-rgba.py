# Key white background: grow from canvas-border near-white seeds through connected near-white pixels only.
# Enclosed near-white areas (iron body, mesh holes) stay opaque.
from PIL import Image, ImageFilter
import numpy as np
SRC={'powerup_tray_restore':'item_tray_clear-qwen3pro-s42.png',
     'powerup_window_restore':'item_window_restore-qwen3pro-s42.png',
     'powerup_random_restore':'item_random_restore-qwen3pro-s42.png'}
def grow(white):
    bg=np.zeros_like(white)
    bg[0,:]|=white[0,:]; bg[-1,:]|=white[-1,:]; bg[:,0]|=white[:,0]; bg[:,-1]|=white[:,-1]
    while True:
        d=bg.copy()
        d[1:,:]|=bg[:-1,:]; d[:-1,:]|=bg[1:,:]; d[:,1:]|=bg[:,:-1]; d[:,:-1]|=bg[:,1:]
        d&=white
        if (d==bg).all(): return bg
        bg=d
for name,fn in SRC.items():
    im=Image.open(fn).convert('RGB')
    a=np.asarray(im).astype(int)
    white=(a.min(axis=2)>=236)
    bg=grow(white)
    alpha=Image.fromarray(((~bg)*255).astype('uint8'),'L').filter(ImageFilter.GaussianBlur(0.8))
    out=im.convert('RGBA'); out.putalpha(alpha)
    out=out.crop(out.getbbox())
    side=max(out.size); pad=int(side*0.06); S=side+2*pad
    canvas=Image.new('RGBA',(S,S),(0,0,0,0))
    canvas.alpha_composite(out,((S-out.size[0])//2,(S-out.size[1])//2))
    canvas=canvas.resize((512,512),Image.LANCZOS)
    canvas.save(f'{name}-keyed-512.png',optimize=True)
    al=np.asarray(canvas)[:,:,3]
    print(name,'bg frac %.1f%%'%(100*bg.mean()),'alpha0 %.1f%%'%(100*(al==0).mean()))
