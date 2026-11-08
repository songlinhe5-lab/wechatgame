# Remove the three prop tiles from the RGB panel (panel coords). Same method as erase_stars_v4:
# plate by multi-scale normalized convolution from clean wood outside the box; grain = high-pass of a clean band.
from PIL import Image
import numpy as np
SRC_IMG='/Users/stephenhe/Development/workspace/wechatgame/temp/fullstar-gacha/rgb/panel-rgb-erased-v4.png'
OUT='panel-rgb-erased-v5.png'
im=np.asarray(Image.open(SRC_IMG).convert('RGB')).astype(float)
H,W,_=im.shape
X0,X1,Y0,Y1=155,405,744,828
mask=np.zeros((H,W),bool); mask[Y0:Y1,X0:X1]=True
def box_blur(a,r):
    def b1(x,axis):
        pad=[(0,0),(0,0)]; pad[axis]=(r+1,r+1)
        p=np.pad(x,pad,mode='edge'); c=np.cumsum(p,axis=axis); n=2*r+1
        if axis==0: return ((c[n:,:]-c[:-n,:])/n)[:x.shape[0],:]
        return ((c[:,n:]-c[:,:-n])/n)[:,:x.shape[1]]
    return b1(b1(b1(a,0),1),0)
yy0,xx0=np.mgrid[0:H,0:W]
sample=(yy0>=690)&(yy0<740)
keep=((~mask)&sample).astype(float)
plate=np.zeros_like(im); done=np.zeros((H,W),bool)
for r in (10,30,80,200):
    den=box_blur(keep,r)
    ok=(den>0.05)&(~done)
    for k in range(3):
        num=box_blur(im[...,k]*keep,r)
        plate[...,k][ok]=(num/(den+1e-9))[ok]
    done|=ok
for k in range(3):
    plate[...,k][~done]=im[...,k][keep>0].mean()
# clean grain band: right of the tiles, inside frame
SRC0,SRC1=420,500
src=im[Y0:Y1,SRC0:SRC1]
hp=(src-np.stack([box_blur(src[...,k],3) for k in range(3)],axis=2))*0.9
Lw=SRC1-SRC0; bw=X1-X0
tile=np.zeros((Y1-Y0,bw,3))
for j in range(bw):
    tile[:,j,:]=hp[:,j%Lw,:]
out=im.copy()
fill=plate[Y0:Y1,X0:X1]+tile
yy,xx=np.mgrid[Y0:Y1,X0:X1]
d=np.minimum.reduce([yy-Y0,Y1-1-yy,xx-X0,X1-1-xx]).astype(float)
w=np.clip((d+0.5)/3.0,0,1)[...,None]
blend=w*fill+(1-w)*im[Y0:Y1,X0:X1]
out[Y0:Y1,X0:X1]=np.clip(blend,0,255)
res=Image.fromarray(out.round().astype(np.uint8),'RGB')
res.save(OUT,optimize=True)
c=res.crop((140,700,420,844))
c.resize((c.width*3,c.height*3),Image.NEAREST).save('panel-bottom-v5-zoom.png')
print('done', OUT)
