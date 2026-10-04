from pathlib import Path
from PIL import Image
import concurrent.futures, io, json, math, urllib.request, urllib.parse

ROOT = Path(__file__).resolve().parent
lon, lat = 78.53812666556714, 16.931367805314645
radius = 6378137
cx = radius * math.radians(lon)
cy = radius * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
# Four adjoining aerial captures share exact projected boundaries.
def capture(cell):
    col, row = cell
    left, top = cx - 4500 + col * 4500, cy + 3000 - row * 3000
    params = dict(bbox=f'{left},{top-3000},{left+4500},{top}', bboxSR=3857,
                  imageSR=3857, size='2048,1365', format='jpg', f='image')
    url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=90) as response:
        data = response.read()
    im = Image.open(io.BytesIO(data)).convert('RGB')
    if im.size != (2048, 1365):
        raise ValueError(f'Unexpected aerial capture size: {im.size}')
    return col, row, im

if __name__ == '__main__':
    mosaic = Image.new('RGB', (4096, 2730))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for col, row, image in pool.map(capture, [(0,0),(1,0),(0,1),(1,1)]):
            mosaic.paste(image, (col * 2048, row * 1365))
            print(f'Captured aerial section {col + 1}, {row + 1}', flush=True)
    mosaic.save(ROOT / 'avatar3_satellite_wide.jpg', quality=93)
    (ROOT / 'avatar3_satellite_wide.json').write_text(json.dumps(dict(
        source='Esri World Imagery', center=[lon,lat], bbox3857=[cx-4500,cy-3000,cx+4500,cy+3000],
        pixels=[4096,2730], captures=4), indent=2))
    print('Saved stitched aerial background: 4096 x 2730')
