from pathlib import Path
from PIL import Image
import numpy as np
import json
root = Path(__file__).resolve().parent
old = Image.open(root / 'avatar3_satellite_ground.jpg').convert('L')
wide = Image.open(root / 'avatar3_satellite_wide.jpg').convert('L')
a = np.asarray(wide.resize((1024,682)), dtype=float)
def sums(a,h,w):
    s = np.pad(a,((1,0),(1,0))).cumsum(0).cumsum(1)
    return s[h:,w:]-s[:-h,w:]-s[h:,:-w]+s[:-h,:-w]
best = (-1,None)
for width in range(148,158):
    height = round(width * old.height / old.width)
    b = np.asarray(old.resize((width,height)),dtype=float)
    b -= b.mean()
    shape=(a.shape[0]+height-1,a.shape[1]+width-1)
    convolution=np.fft.irfft2(np.fft.rfft2(a,shape)*np.fft.rfft2(b[::-1,::-1],shape),s=shape)
    corr=convolution[height-1:a.shape[0],width-1:a.shape[1]]
    energy=sums(a*a,height,width)-sums(a,height,width)**2/(height*width)
    score=corr/np.sqrt(np.maximum(energy,1)*np.sum(b*b))
    y,x=np.unravel_index(np.argmax(score),score.shape)
    if score[y,x]>best[0]: best=(float(score[y,x]),(width,height,int(x),int(y)))
score,(w,h,x,y)=best
# Preserve the old image's world-space size and position through image registration.
world_width=1400*1024/w
world_depth=933*682/h
world_x=(512-(x+w/2))*world_width/1024
world_z=60+(341-(y+h/2))*world_depth/682
metadata=json.loads((root/'avatar3_satellite_wide.json').read_text())
metadata.update(registrationScore=score, oldImageRectPreview=[x,y,w,h],worldWidth=world_width,worldDepth=world_depth,worldX=world_x,worldZ=world_z)
(root/'avatar3_satellite_wide.json').write_text(json.dumps(metadata,indent=2))
print(json.dumps(metadata,indent=2))
if score<.65: raise ValueError('Aerial registration confidence too low')
import base64
data=dict(width=world_width,depth=world_depth,x=world_x,z=world_z,
          texture='data:image/jpeg;base64,'+base64.b64encode((root/'avatar3_satellite_wide.jpg').read_bytes()).decode())
(root/'avatar3_satellite_wide_texture.js').write_text('window.AVATAR3_WIDE_AERIAL = '+json.dumps(data)+';')


