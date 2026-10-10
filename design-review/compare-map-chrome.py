from PIL import Image
from pathlib import Path
root=Path(r'C:\Users\realt\Downloads\Avatar3\design-review')
for name,source,size in [('desktop',r'C:\Users\realt\Downloads\Desktop@2x (1).png',(1440,720)),('mobile',r'C:\Users\realt\Downloads\Mobile@2x (1).png',(390,844))]:
 ref=Image.open(source).convert('RGB').resize(size)
 actual=Image.open(root/f'map-first-{name}-{size[0]}.png').convert('RGB')
 board=Image.new('RGB',(size[0]*2,size[1]),'white')
 board.paste(ref,(0,0));board.paste(actual,(size[0],0));board.save(root/f'map-first-{name}-comparison.png')
