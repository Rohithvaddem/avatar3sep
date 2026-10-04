"""Bake the adjoining aerial captures and detail layer into one stable ground texture."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import base64, json
root = Path(__file__).resolve().parent
meta = json.loads((root/'avatar3_satellite_wide.json').read_text())
wide = Image.open(root/'avatar3_satellite_wide.jpg').convert('RGB')
x,y,w,h = meta['oldImageRectPreview']
# Registration was measured at 1024 x 682; convert to the full capture resolution.
sx,sy = wide.width/1024,wide.height/682
box = (round(x*sx),round(y*sy),round((x+w)*sx),round((y+h)*sy))
detail = Image.open(root/'avatar3_satellite_ground.jpg').convert('RGB').resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
mask=Image.new('L',detail.size,0)
draw=ImageDraw.Draw(mask)
inset=round(min(detail.size)*.06)
draw.rectangle((inset,inset,detail.width-inset,detail.height-inset),fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(inset/2))
wide.paste(detail,box[:2],mask)
# Fade the perimeter in the pixels, eliminating transparent overlapping meshes.
edge=Image.new('L',wide.size,0)
ImageDraw.Draw(edge).rectangle((90,90,wide.width-90,wide.height-90),fill=255)
edge=edge.filter(ImageFilter.GaussianBlur(40))
ground=Image.new('RGB',wide.size,(20,36,23))
ground.paste(wide,(0,0),edge)
target=root/'avatar3_satellite_background.jpg'
ground.save(target,quality=93)
data=dict(width=meta['worldWidth'],depth=meta['worldDepth'],x=meta['worldX'],z=meta['worldZ'],texture='data:image/jpeg;base64,'+base64.b64encode(target.read_bytes()).decode())
(root/'avatar3_satellite_wide_texture.js').write_text('window.AVATAR3_WIDE_AERIAL = '+json.dumps(data)+';')
print('Baked one opaque 4096 x 2730 aerial background.')
