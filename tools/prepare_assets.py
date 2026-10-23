"""
art/ papkasidagi fon va xarita rasmlarini o'yin uchun tayyorlaydi:
  - har bir fon varag'idagi ikki panoramani ajratadi (o'rtadagi och chiziq bo'yicha),
  - WebP qilib public/assets/ ga yozadi, o'lcham va yer chizig'ini src/assets.json ga yozadi.
Qasr, kon va askarlar rasmlari yangi dizayn bilan qayta qilinadi (hozir o'yin ularni kod bilan oddiy shaklda chizadi).

O'rnatish:        pip install pillow numpy
Ishga tushirish:  python3 tools/prepare_assets.py
Tekshirish rasmi: python3 tools/prepare_assets.py --preview   (scratch/preview.png)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'art')
OUT = os.path.join(ROOT, 'public', 'assets')
META = os.path.join(ROOT, 'src', 'assets.json')

# Jang fonlari: (varaq, [tepadagi joy, pastdagi joy]) va har panoramada tekis yer boshlanadigan qator (ulushda)
BACKGROUNDS = {
    'fon_ormon_kol.webp': (('ormon', 0.82), ('kol', 0.79)),
    'fon_tog_dasht.webp': (('tog', 0.82), ('dasht', 0.56)),
    'fon_chol_shahar.webp': (('chol', 0.74), ('shahar', 0.67)),
}


def load(name):
    return np.asarray(Image.open(os.path.join(ART, name)).convert('RGB')).astype(np.float32)


def build_backgrounds(meta, preview):
    """Har varaqda ikki panorama: o'rtadagi och ajratuvchi chiziq bo'yicha bo'linadi."""
    meta['backgrounds'] = {}
    for src, parts in BACKGROUNDS.items():
        rgb = load(src)
        h = rgb.shape[0]
        mid = rgb[int(h * 0.35):int(h * 0.65)]
        bright = mid.mean(axis=(1, 2))
        flat = mid.std(axis=(1, 2))
        rows = np.nonzero((bright > 190) & (flat < 22))[0] + int(h * 0.35)
        top_end, bot_start = (rows.min() - 2, rows.max() + 3) if len(rows) else (h // 2 - 4, h // 2 + 4)
        for (terrain, ground), (y0, y1) in zip(parts, [(2, top_end), (bot_start, h - 2)]):
            im = Image.fromarray(rgb[y0:y1, 2:-2].astype(np.uint8), 'RGB')
            rel = f'fon_{terrain}.webp'
            im.save(os.path.join(OUT, rel), 'WEBP', quality=80, method=6)
            meta['backgrounds'][terrain] = {'f': 'assets/' + rel, 'w': im.width, 'h': im.height, 'ground': ground}
            # tekshirish uchun yer chizig'i (qizil)
            pv = im.convert('RGBA')
            gy = int(ground * im.height)
            for x in range(im.width):
                pv.putpixel((x, gy), (255, 0, 0, 255))
            preview.append(pv)
        print(f'{src}: {parts[0][0]}, {parts[1][0]}')


def build_map(meta):
    im = Image.open(os.path.join(ART, 'xarita.jpg')).convert('RGB')
    im.save(os.path.join(OUT, 'xarita.webp'), 'WEBP', quality=85, method=6)
    meta['map'] = {'f': 'assets/xarita.webp', 'w': im.width, 'h': im.height}


def write_preview(preview):
    pad, scale, width = 10, 0.45, 1800
    ims = [im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale)))) for im in preview]
    x = y = pad
    row_h = 0
    places = []
    for im in ims:
        if x + im.width > width:
            x, y = pad, y + row_h + pad
            row_h = 0
        places.append((x, y))
        x += im.width + pad
        row_h = max(row_h, im.height)
    sheet = Image.new('RGBA', (width, y + row_h + pad), (60, 140, 90, 255))
    for (px, py), im in zip(places, ims):
        sheet.alpha_composite(im, (px, py))
    os.makedirs(os.path.join(ROOT, 'scratch'), exist_ok=True)
    sheet.save(os.path.join(ROOT, 'scratch', 'preview.png'))
    print('scratch/preview.png yozildi')


def main():
    meta, preview = {}, []
    build_backgrounds(meta, preview)
    build_map(meta)
    with open(META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print('src/assets.json yozildi')
    if '--preview' in sys.argv:
        write_preview(preview)


if __name__ == '__main__':
    main()
