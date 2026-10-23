"""
Spine uchun rasmlar (tools/export_spine.ts chaqiradi):
  art/spine/<nom>/images/<qism>.png        — Spine dasturida ochish uchun
  public/spine/<nom>/<nom>.webp + .atlas   — o'yin uchun bitta atlas sahifasi (Spine 4 atlas formati)
Ishga tushirish: python3 tools/spine_atlas.py <nom> '<{"qism": "rasm yo'li", ...}>'
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAD = 2


def main():
    name = sys.argv[1]
    parts = json.loads(sys.argv[2])
    img_dir = os.path.join(ROOT, 'art', 'spine', name, 'images')
    pub = os.path.join(ROOT, 'public', 'spine', name)
    os.makedirs(img_dir, exist_ok=True)
    os.makedirs(pub, exist_ok=True)
    ims = {k: Image.open(p).convert('RGBA') for k, p in parts.items()}
    for k, im in ims.items():
        im.save(os.path.join(img_dir, f'{k}.png'))
    # oddiy qatorma-qator joylash: balandligi bo'yicha saralab
    width = 512
    order = sorted(ims, key=lambda k: -ims[k].height)
    x = y = row = 0
    place = {}
    for k in order:
        w, h = ims[k].size
        if x + w + PAD > width:
            x, y, row = 0, y + row + PAD, 0
        place[k] = (x, y)
        x += w + PAD
        row = max(row, h)
    height = y + row
    page = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    for k, (px, py) in place.items():
        page.alpha_composite(ims[k], (px, py))
    page.save(os.path.join(pub, f'{name}.webp'), 'WEBP', quality=90, method=6)
    lines = [f'{name}.webp', f'size:{width},{height}', 'filter:Linear,Linear', 'pma:false']
    for k, (px, py) in place.items():
        w, h = ims[k].size
        lines += [k, f'bounds:{px},{py},{w},{h}']
    with open(os.path.join(pub, f'{name}.atlas'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'atlas {width}x{height}, {len(ims)} qism')


if __name__ == '__main__':
    main()
