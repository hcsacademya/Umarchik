"""
art/ papkasidagi varaq-rasmlarni o'yin uchun tayyorlaydi:
  - kulrang fonni olib tashlaydi (chekkadan to'ldirish usuli, ichki oq/kulrang joylar saqlanadi),
  - varaqni alohida bo'laklarga (pozalar, qasrlar, konlar) ajratadi,
  - o'yin o'lchamiga moslab WebP qilib public/assets/ ga yozadi,
  - dushman askarlari uchun rangi o'zgartirilgan nusxa yasaydi,
  - o'lcham va tayanch nuqtalarni src/assets.json ga yozadi.

O'rnatish:        pip install pillow numpy scipy
Ishga tushirish:  python3 tools/prepare_assets.py
Tekshirish rasmi: python3 tools/prepare_assets.py --preview   (scratch/preview.png)
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'art')
OUT = os.path.join(ROOT, 'public', 'assets')
META = os.path.join(ROOT, 'src', 'assets.json')

# O'yindagi 1 birlik necha piksel bo'lib saqlanadi (ekranda ~1.4–2.2 px/birlik)
PPU = 2.2

# Askarlar: (varaq, qatorlar, ustunlar, gavda balandligi o'yin birligida, ko'zgu)
UNITS = {
    'amir': ('amir.webp', 1, 4, 118, False),
    'konchi': ('konchi.webp', 2, 3, 104, False),
    'qilichli': ('qilichli.webp', 1, 4, 112, False),
    'nayzachi': ('nayzachi.webp', 1, 4, 112, False),
    'kamonchi': ('kamonchi.webp', 1, 4, 112, False),
    # Vaqtincha: yon tomondan otliq rasmi chizilguncha namuna rasm (chapga qaragan, ko'zgu qilinadi)
    'otliq': ('otliq_vaqtincha.jpg', 1, 1, 160, True),
}

# Binolar (yon tomondan). Kenglik — o'yin birligida.
CASTLE_W = 400  # bizning va dushman qasrlari
CITY_W = 640  # poytaxtlar
MINE_W = 230

# Jang fonlari: (varaq, [tepadagi joy, pastdagi joy]) va har panoramada tekis yer boshlanadigan qator (ulushda)
BACKGROUNDS = {
    'fon_ormon_kol.webp': (('ormon', 0.82), ('kol', 0.79)),
    'fon_tog_dasht.webp': (('tog', 0.82), ('dasht', 0.56)),
    'fon_chol_shahar.webp': (('chol', 0.74), ('shahar', 0.67)),
}


def load(name):
    return np.asarray(Image.open(os.path.join(ART, name)).convert('RGB')).astype(np.float32)


def remove_bg(rgb):
    """Kulrang fonni shaffof qiladi. Qaytaradi: RGBA (float, 0..255)."""
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))

    near = dist < 16
    labels, n = ndi.label(near)
    sizes = ndi.sum(np.ones_like(dist), labels, index=np.arange(1, n + 1))
    edge_ids = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    # chekkaga tegib turgan fon yoki katta yopiq "cho'ntak" (masalan qo'l va gavda orasi)
    mean_d = ndi.mean(dist, labels, index=np.arange(1, n + 1))
    keep_bg = np.zeros(n + 1, bool)
    keep_bg[1:] = (sizes > 2500) | ((sizes > 150) & (mean_d < 6))
    keep_bg[edge_ids] = True
    keep_bg[0] = False
    bgmask = keep_bg[labels]

    alpha = np.where(bgmask, 0.0, 1.0)
    # Chegaradagi yumshoq o'tish
    band = ndi.binary_dilation(bgmask, iterations=2) & ~bgmask
    soft = np.clip((dist - 8) / 26, 0, 1)
    alpha = np.where(band, np.minimum(alpha, soft), alpha)
    # Mayda dog'larni olib tashlash
    solid = alpha > 0.5
    lab, m = ndi.label(solid)
    if m:
        area = ndi.sum(solid, lab, index=np.arange(1, m + 1))
        small = np.zeros(m + 1, bool)
        small[1:] = area < 40
        alpha[small[lab]] = 0
    # Fon rangini chekkadan tozalash
    a = alpha[..., None]
    safe = np.maximum(a, 0.05)
    col = np.where(a > 0, np.clip((rgb - (1 - a) * bg) / safe, 0, 255), 0)
    return np.dstack([col, alpha * 255])


def segments(profile, want, min_gap=10):
    """1D proyeksiyadan bo'laklarni topadi va kerakli songa keltiradi."""
    on = profile > 0
    segs = []
    i, n = 0, len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            segs.append([i, j])
            i = j
        else:
            i += 1
    # yaqin bo'laklarni birlashtirish
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < min_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    # mayda shovqin bo'laklarni tashlash
    merged = [s for s in merged if profile[s[0]:s[1]].sum() > 200]
    while len(merged) > want:
        gaps = [merged[k + 1][0] - merged[k][1] for k in range(len(merged) - 1)]
        k = int(np.argmin(gaps))
        merged[k][1] = merged[k + 1][1]
        del merged[k + 1]
    # bir-biriga tegib turgan bo'laklar: eng kengini o'rtasidagi eng ingichka joyidan bo'lamiz
    while 0 < len(merged) < want:
        k = int(np.argmax([b - a for a, b in merged]))
        a, b = merged[k]
        lo, hi = a + int((b - a) * 0.3), a + int((b - a) * 0.7)
        cut = lo + int(np.argmin(profile[lo:hi]))
        merged[k:k + 1] = [[a, cut], [cut, b]]
    if len(merged) != want:
        raise RuntimeError(f'{want} ta bo\'lak kutilgandi, {len(merged)} ta topildi')
    return merged


def split(rgba, rows, cols):
    """Varaqni qator va ustunlarga ajratib, har bir bo'lakni qirqib qaytaradi."""
    solid = rgba[..., 3] > 128
    out = []
    for r0, r1 in segments(solid.sum(axis=1), rows, 14):
        band = solid[r0:r1]
        for c0, c1 in segments(band.sum(axis=0), cols, 1):
            piece = rgba[r0:r1, c0:c1]
            a = piece[..., 3] > 8
            ys, xs = np.nonzero(a)
            out.append(piece[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy())
    return out


def body_mask(piece):
    """Ingichka qurollarsiz gavda (nayza, kamon, bolta dastasi olib tashlanadi)."""
    m = piece[..., 3] > 128
    return ndi.binary_opening(m, structure=np.ones((17, 17)))


def body_rows(piece):
    """Gavda egallagan qatorlar: boshdan oyoqqacha (nayza uchi va qilich hisobga olinmaydi)."""
    widths = body_mask(piece).sum(axis=1)
    thr = 0.3 * np.percentile(widths[widths > 0], 75)
    ys = np.nonzero(widths >= thr)[0]
    return ys.min(), ys.max()


def to_image(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')


def resize(arr, scale):
    if abs(scale - 1) < 1e-3:
        return to_image(arr)
    im = to_image(arr)
    w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    return im.resize((w, h), Image.LANCZOS)


def enemy_tint(arr):
    """Dushman nusxasi: och kiyim to'q qizilga, charm va temir to'qroq tusga o'tadi."""
    rgb = arr[..., :3]
    lum = (rgb * [0.299, 0.587, 0.114]).sum(axis=2, keepdims=True)
    light = np.clip((lum - 90) / 120, 0, 1)  # och joylar (kiyim) ko'proq bo'yaladi
    red = np.concatenate([lum * 0.95, lum * 0.32, lum * 0.3], axis=2) * 0.85
    dark = rgb * np.array([0.82, 0.74, 0.74])
    out = dark * (1 - light * 0.75) + red * (light * 0.75)
    return np.dstack([np.clip(out, 0, 255), arr[..., 3]])


def save(im, rel):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=88, method=6)
    return 'assets/' + rel.replace(os.sep, '/')


def frame_meta(file, im, ax, ppu):
    # w, h — o'yin birligida; ax — tayanch nuqta (oyoq o'rtasi) chapdan, ulushda
    return {'f': file, 'w': round(im.width / ppu, 1), 'h': round(im.height / ppu, 1), 'ax': round(ax, 3)}


def build_units(meta, preview):
    meta['units'] = {}
    for kind, (src, rows, cols, game_h, mirror) in UNITS.items():
        rgba = remove_bg(load(src))
        if mirror:
            rgba = rgba[:, ::-1].copy()
        pieces = split(rgba, rows, cols)
        top, bottom = body_rows(pieces[0])
        body_h = bottom - top + 1
        scale = game_h * PPU / body_h
        frames, enemy = [], []
        for i, p in enumerate(pieces):
            bm = body_mask(p)
            cols_w = bm.sum(axis=0) if bm.any() else (p[..., 3] > 128).sum(axis=0)
            ax = float((cols_w * np.arange(len(cols_w))).sum() / cols_w.sum()) / p.shape[1]
            im = resize(p, scale)
            frames.append(frame_meta(save(im, f'units/{kind}_{i}.webp'), im, ax, PPU))
            ie = resize(enemy_tint(p), scale)
            enemy.append(frame_meta(save(ie, f'units/{kind}_e_{i}.webp'), ie, ax, PPU))
            preview.append((im, ax))
            preview.append((ie, ax))
        meta['units'][kind] = {'frames': frames, 'enemy': enemy}
        print(f'{kind}: {len(pieces)} ta poza, gavda {body_h}px -> {game_h} birlik')


def gate_x(piece):
    """Darvoza yoki kon kirish joyi: pastki qismdagi eng katta qorong'i joyning o'rtasi (kenglikka nisbatan)."""
    a = piece[..., 3] > 200
    lum = (piece[..., :3] * [0.299, 0.587, 0.114]).sum(axis=2)
    h = piece.shape[0]
    low = np.zeros_like(a)
    low[int(h * 0.45):] = True
    zone = a & low
    thr = np.percentile(lum[zone], 7)
    lab, n = ndi.label(zone & (lum <= thr))
    if not n:
        return 0.5
    sizes = ndi.sum(np.ones_like(lum), lab, index=np.arange(1, n + 1))
    ys, xs = np.nonzero(lab == int(np.argmax(sizes)) + 1)
    return float(xs.mean()) / piece.shape[1]


def put_buildings(meta, preview, key, pieces, game_w, axes):
    """Bir guruh binolarni bir xil masshtabda saqlaydi. axes — har biri uchun tayanch nuqta (darvoza)."""
    med_w = float(np.median([p.shape[1] for p in pieces]))
    ppu = min(PPU, med_w / game_w)  # asl o'lchamdan kattalashtirmaymiz
    scale = game_w * ppu / med_w
    frames = []
    for i, (p, ax) in enumerate(zip(pieces, axes)):
        im = resize(p, scale)
        frames.append(frame_meta(save(im, f'{key}_{i}.webp'), im, ax, ppu))
        preview.append((im, ax))
    meta['buildings'][key] = frames
    print(f'{key}: {len(pieces)} ta, kenglik ~{game_w} birlik, darvoza {[round(a, 2) for a in axes]}')


def build_buildings(meta, preview):
    meta['buildings'] = {}
    # Bizning qasr: ochiq, yopiq, shikastlangan, vayron. Darvoza joyi — ochiq holatdan.
    ours = split(remove_bg(load('qasr_biz.webp')), 2, 2)
    gx = gate_x(ours[0])
    put_buildings(meta, preview, 'qasr_biz', ours, CASTLE_W, [gx] * 4)
    # Konlar: kirish joyi qasr tomonga (chapga) qaragan
    mines = split(remove_bg(load('konlar.webp')), 2, 2)
    put_buildings(meta, preview, 'kon', mines, MINE_W, [gate_x(m) for m in mines])
    # Dushman qasrlari: o'rmon, ko'l, ekinzor, tog', dasht, cho'l; keyin ikki poytaxt
    a = split(remove_bg(load('qasr_dushman_1.webp')), 2, 2)
    b = split(remove_bg(load('qasr_dushman_2.webp')), 2, 2)
    forts = a + b[:2]
    put_buildings(meta, preview, 'qasr_dushman', forts, CASTLE_W, [gate_x(f) for f in forts])
    put_buildings(meta, preview, 'shahar', b[2:], CITY_W, [gate_x(c) for c in b[2:]])


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
            preview.append((pv, 0))
        print(f'{src}: {parts[0][0]}, {parts[1][0]}')


def build_map(meta):
    im = Image.open(os.path.join(ART, 'xarita.jpg')).convert('RGB')
    im.save(os.path.join(OUT, 'xarita.webp'), 'WEBP', quality=85, method=6)
    meta['map'] = {'f': 'assets/xarita.webp', 'w': im.width, 'h': im.height}


def write_preview(preview):
    pad, scale = 10, 0.45
    ims = [im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale)))) for im, _ in preview]
    width = 1800
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
    for (px, py), im, (_, ax) in zip(places, ims, preview):
        sheet.alpha_composite(im, (px, py))
        # tayanch nuqta (qizil)
        cx = px + int(ax * im.width)
        for d in range(-3, 4):
            sheet.putpixel((min(width - 1, max(0, cx + d)), py + im.height - 1), (255, 0, 0, 255))
    os.makedirs(os.path.join(ROOT, 'scratch'), exist_ok=True)
    sheet.save(os.path.join(ROOT, 'scratch', 'preview.png'))
    print('scratch/preview.png yozildi')


def main():
    meta, preview = {'ppu': PPU}, []
    build_units(meta, preview)
    build_buildings(meta, preview)
    build_backgrounds(meta, preview)
    build_map(meta)
    with open(META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print('src/assets.json yozildi')
    if '--preview' in sys.argv:
        write_preview(preview)


if __name__ == '__main__':
    main()
