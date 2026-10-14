"""
art/ papkasidagi asl rasmlarni o'yin uchun tayyorlaydi:
  - kulrang fonni olib tashlaydi (rembg),
  - 4 bosqichli varaqlarni alohida figuralarga bo'ladi,
  - portret (bosh qismi) qirqadi,
  - WebP (shaffof) qilib public/assets/ ga yozadi va manifest.json ni yangilaydi,
  - xaritani tayyorlab, src/world/mapData.json ni yasaydi (tools/build_map.py).

O'rnatish:  pip install rembg onnxruntime scipy pillow numpy
Ishga tushirish (loyiha ildizidan):  python tools/prepare_assets.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'art')
OUT = os.path.join(ROOT, 'public', 'assets')
sys.path.insert(0, os.path.join(ROOT, 'tools'))

UNIT_H = 300
PORTRAIT = 128

# (fayl, turi, kalit). {t} — bosqich raqami (1..4).
SPEC = [
    ('amir_4bosqich', 'row4', 'unit_amir_{t}'),
    ('amir', 'single', 'unit_amir'),
    ('piyoda_4bosqich', 'row4', 'unit_piyoda_{t}'),
    ('piyoda', 'single', 'unit_piyoda'),
    ('kamonchi_4bosqich', 'row4', 'unit_kamonchi_{t}'),
    ('kamonchi', 'single', 'unit_kamonchi'),
    ('nayzachi_4bosqich', 'row4', 'unit_nayzachi_{t}'),
    ('nayzachi', 'single', 'unit_nayzachi'),
    ('otliq_4bosqich', 'row4', 'unit_otliq_{t}'),
    ('otliq', 'single', 'unit_otliq'),
    ('qomondon_4bosqich', 'row4', 'unit_qomondon_{t}'),
    ('qomondon', 'single', 'unit_qomondon'),
    ('dehqon_4bosqich', 'row4', 'worker_dehqon_{t}'),
    ('dehqon', 'single', 'worker_dehqon'),
    ('chopon_4bosqich', 'row4', 'worker_chopon_{t}'),
    ('chopon', 'single', 'worker_chopon'),
    ('konchi_4bosqich', 'row4', 'worker_konchi_{t}'),
    ('konchi', 'single', 'worker_konchi'),
    ('sarkardalar', 'row4', ['unit_sarkarda_otliq_1', 'unit_sarkarda_nayzachi_1', 'unit_sarkarda_kamonchi_1', 'unit_sarkarda_piyoda_1']),
    ('sarkardalar_2bosqich', 'grid2x4', [
        ['unit_sarkarda_otliq_2', 'unit_sarkarda_nayzachi_2', 'unit_sarkarda_kamonchi_2', 'unit_sarkarda_piyoda_2'],
        ['unit_sarkarda_otliq_3', 'unit_sarkarda_nayzachi_3', 'unit_sarkarda_kamonchi_3', 'unit_sarkarda_piyoda_3'],
    ]),
    ('qarorgoh_4bosqich', 'row4b', 'core_{t}'),
    ('qarorgoh_1', 'building', 'core_1'),
    ('poytaxt_rim', 'building', 'capital_rim'),
    ('poytaxt_fors', 'building', 'capital_fors'),
]

# Bir rasmni bir nechta kalit ishlatadi.
ALIASES = {
    'unit_sarkarda_otliq_4': 'unit_sarkarda_otliq_3',
    'unit_sarkarda_nayzachi_4': 'unit_sarkarda_nayzachi_3',
    'unit_sarkarda_kamonchi_4': 'unit_sarkarda_kamonchi_3',
    'unit_sarkarda_piyoda_4': 'unit_sarkarda_piyoda_3',
    'unit_zirhli_otliq': 'unit_otliq_4',
    'unit_zirhli_nayzachi': 'unit_nayzachi_4',
}

# Xaritada binolarni plitaga joylash.
BUILDING_SPEC = {
    'core_1': dict(scale=1.25, anchorY=0.78),
    'core_2': dict(scale=1.35, anchorY=0.8),
    'core_3': dict(scale=1.5, anchorY=0.8),
    'core_4': dict(scale=1.65, anchorY=0.8),
    'capital_rim': dict(scale=3.2, anchorY=0.62),
    'capital_fors': dict(scale=3.2, anchorY=0.62),
}

session = None


def cutout(path):
    global session
    if session is None:
        session = new_session('isnet-general-use')
    im = Image.open(path).convert('RGB')
    return remove(im, session=session)


def bbox_crop(im, pad=4):
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 20)
    if len(xs) == 0:
        return im
    return im.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad), min(im.height, ys.max() + pad)))


def split_cols(im, n):
    """Shaffoflik bo'yicha eng bo'sh ustunlardan n bo'lakka ajratadi."""
    a = np.asarray(im)[..., 3].astype(float)
    prof = ndi.uniform_filter1d(a.sum(0), 9)
    w = im.width
    cuts = [0]
    for i in range(1, n):
        c = int(w * i / n)
        lo, hi = int(c - w * 0.1), int(c + w * 0.1)
        cuts.append(lo + int(np.argmin(prof[lo:hi])))
    cuts.append(w)
    return [im.crop((cuts[i], 0, cuts[i + 1], im.height)) for i in range(n)]


def split_rows(im, n):
    return [p.rotate(90, expand=True) for p in split_cols(im.rotate(-90, expand=True), n)]


def largest_part(im):
    """Bo'lakdagi eng katta figurani (va unga yopishganlarni) qoldiradi."""
    a = np.asarray(im)[..., 3] > 20
    lab, n = ndi.label(ndi.binary_dilation(a, iterations=6))
    if n <= 1:
        return im
    sizes = ndi.sum(a, lab, index=np.arange(1, n + 1))
    keep = lab == (1 + int(np.argmax(sizes)))
    arr = np.asarray(im).copy()
    arr[..., 3] = np.where(keep, arr[..., 3], 0)
    return Image.fromarray(arr)


def fit(im, max_w=None, max_h=None):
    w, h = im.size
    k = 1.0
    if max_w:
        k = min(k, max_w / w)
    if max_h:
        k = min(k, max_h / h)
    if k < 1:
        im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
    return im


def portrait(im):
    """Figuraning yuqori qismidan kvadrat portret."""
    a = np.asarray(im)[..., 3] > 40
    h, w = a.shape
    side = int(min(w, h * 0.42))
    top_rows = a[: max(1, int(h * 0.25))]
    xs = np.nonzero(top_rows.any(0))[0]
    cx = int(xs.mean()) if len(xs) else w // 2
    x0 = max(0, min(w - side, cx - side // 2))
    ys = np.nonzero(a.any(1))[0]
    y0 = max(0, int(ys.min()) - 4) if len(ys) else 0
    crop = im.crop((x0, y0, x0 + side, y0 + side))
    return crop.resize((PORTRAIT, PORTRAIT), Image.LANCZOS)


def save(im, key, manifest, extra=None):
    fn = f'{key}.webp'
    im.save(os.path.join(OUT, fn), 'WEBP', quality=86, method=6)
    manifest[key] = dict(file=fn, **extra) if extra else fn


def figure_out(im, key, manifest):
    fig = fit(bbox_crop(largest_part(im)), max_h=UNIT_H)
    save(fig, key, manifest)
    pkey = key.replace('unit_', 'portrait_').replace('worker_', 'portrait_')
    save(portrait(fig), pkey, manifest)


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {'_izoh': "Avtomatik yaratilgan: tools/prepare_assets.py. Qo'lda qo'shilgan kalitlar ham saqlanadi."}
    old_path = os.path.join(OUT, 'manifest.json')
    if os.path.exists(old_path):
        with open(old_path) as fh:
            for k, v in json.load(fh).items():
                if not k.startswith('_'):
                    manifest[k] = v
    for name, kind, keys in SPEC:
        path = os.path.join(ART, name + '.jpg')
        print('…', name)
        im = cutout(path)
        if kind == 'single':
            figure_out(im, keys, manifest)
        elif kind in ('row4', 'row4b'):
            parts = split_cols(bbox_crop(im), 4)
            for t, part in enumerate(parts, 1):
                key = keys[t - 1] if isinstance(keys, list) else keys.format(t=t)
                if kind == 'row4b':
                    b = fit(bbox_crop(largest_part(part)), max_w=520)
                    save(b, key, manifest, BUILDING_SPEC.get(key))
                else:
                    figure_out(part, key, manifest)
        elif kind == 'grid2x4':
            rows = split_rows(bbox_crop(im), 2)
            for r, row in enumerate(rows):
                for c, part in enumerate(split_cols(bbox_crop(row), 4)):
                    figure_out(part, keys[r][c], manifest)
        elif kind == 'building':
            b = fit(bbox_crop(im), max_w=760 if keys.startswith('capital') else 560)
            save(b, keys, manifest, BUILDING_SPEC.get(keys))
    # Devor/qal'a va kuzatuv minorasi uchun qarorgoh rasmlari.
    manifest['fort'] = dict(file='core_3.webp', scale=0.9, anchorY=0.8)
    manifest['tower'] = dict(file='core_2.webp', scale=0.8, anchorY=0.8)
    for alias, target in ALIASES.items():
        manifest[alias] = manifest[target]
        pa, pt = alias.replace('unit_', 'portrait_'), target.replace('unit_', 'portrait_')
        if pt in manifest:
            manifest[pa] = manifest[pt]

    # Xarita
    print('… umumiy_xarita')
    m = cutout(os.path.join(ART, 'umumiy_xarita.jpg'))
    arr = np.asarray(m).copy()
    filled = ndi.binary_fill_holes(arr[..., 3] > 127)
    arr[..., 3] = np.where(filled & (arr[..., 3] < 255), 255, arr[..., 3])
    # rasm ichidagi teshiklar to'ldiriladi, tashqi qirra yumshoq qoladi
    arr[..., 3] = np.where(filled, 255, arr[..., 3])
    rgba = Image.fromarray(arr)
    tmp = os.path.join(OUT, '_map_rgba.png')
    rgba.save(tmp)
    rgba.save(os.path.join(OUT, 'map.webp'), 'WEBP', quality=88, method=6)
    manifest['map_background'] = 'map.webp'
    import build_map
    build_map.main(tmp, os.path.join(ROOT, 'src', 'world', 'mapData.json'))
    os.remove(tmp)

    with open(old_path, 'w') as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    print('tayyor:', len(manifest) - 1, 'kalit')


if __name__ == '__main__':
    main()
