"""
art/ papkasidagi varaq-rasmlarni o'yin uchun tayyorlaydi:
  - kulrang fonni olib tashlaydi (chekkadan to'ldirish usuli, ichki oq/kulrang joylar saqlanadi),
  - varaqni alohida bo'laklarga (pozalar, qasrlar, konlar) ajratadi,
  - o'yin o'lchamiga moslab WebP qilib public/assets/ ga yozadi,
  - dushman xalqlari varaqlarini (tepada ko'chmanchi, pastda sovutli) ajratadi,
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

# Askarlarning bo'yi (o'yin birligida; ekran balandligi 560 birlik)
UNIT_H = 72

# 16 kadrli animatsiya varaqlari (4x4): (varaq, gavda balandligi, tik turish kadri — o'lcham shundan olinadi,
# alohida uchib ketgan o'q kabi ingichka bo'laklar olib tashlanadigan kadrlar)
ANIM16 = {
    'amir': ('anim_amir.webp', 76, 6, ()),
    'qilichli': ('anim_qilichli.webp', UNIT_H, 6, ()),
    'nayzachi': ('anim_nayzachi.webp', UNIT_H, 6, ()),
    'kamonchi': ('anim_kamonchi.webp', UNIT_H, 6, (11,)),
    'konchi': ('anim_konchi.webp', 68, 12, ()),
}

# Eski (kam kadrli) varaqlar: (varaq, qatorlar, ustunlar, gavda balandligi, ko'zgu)
UNITS = {
    # Vaqtincha: yon tomondan otliq rasmi chizilguncha namuna rasm (chapga qaragan, ko'zgu qilinadi)
    'otliq': ('otliq_vaqtincha.jpg', 1, 1, 102, True),
}

# Dushman xalqlari: har varaqda 2 qator x 4 poza — tepada ko'chmanchi, pastda sovutli.
# Mato qismlari toza ko'k: o'yin ularni har jangda bayroq rangiga almashtiradi.
FACTION_ROWS = ['kochmanchi', 'sovutli']
FACTION_UNITS = {
    'qilichli': ('dushman_qilichli.webp', UNIT_H),
    'nayzachi': ('dushman_nayzachi.webp', UNIT_H),
    'kamonchi': ('dushman_kamonchi.webp', UNIT_H),
}

# Binolar (yon tomondan). Kenglik — o'yin birligida, kesilmagan to'liq rasm bo'yicha.
CASTLE_W = 400  # bizning va dushman qasrlari
CITY_W = 640  # poytaxtlar
MINE_W = 210
# Qasrdan faqat darvoza old qismi qoladi: darvozadan chapga shuncha (to'liq kenglikka nisbatan) qoldiriladi
CASTLE_KEEP = 0.30
CITY_KEEP = 0.28

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


def grid_split(rgba, rows, cols, drop_thin=()):
    """Teng kataklarga bo'lingan varaq: har bir alohida bo'lak (figura, yerga tushgan qurol)
    markazi qaysi katakda bo'lsa, o'sha kadrga tegishli. Figura katak chegarasidan chiqsa ham kesilmaydi."""
    h, w = rgba.shape[:2]
    ch, cw = h / rows, w / cols
    solid = rgba[..., 3] > 40
    lab, n = ndi.label(solid, structure=np.ones((3, 3)))
    if not n:
        raise RuntimeError("varaq bo'sh")
    idx = np.arange(1, n + 1)
    area = ndi.sum(solid, lab, idx)
    cy, cx = np.array(ndi.center_of_mass(solid, lab, idx)).T
    boxes = ndi.find_objects(lab)
    out = []
    for k in range(rows * cols):
        r, c = divmod(k, cols)
        ids = [i for i in range(n) if area[i] > 30 and int(cy[i] // ch) == r and int(cx[i] // cw) == c]
        if not ids:
            raise RuntimeError(f'{k + 1}-kadr bo\'sh')
        main = max(ids, key=lambda i: area[i])
        if k in drop_thin:
            # asosiy figuradan ajralgan ingichka bo'laklarni (masalan uchib ketgan o'q) tashlaymiz
            keep = []
            for i in ids:
                sl = boxes[i]
                bh = sl[0].stop - sl[0].start
                bw = sl[1].stop - sl[1].start
                if i == main or not (bh < 20 and bw > 40):
                    keep.append(i)
            ids = keep
        mask = np.isin(lab, np.array(ids) + 1)
        mask = ndi.binary_dilation(mask, iterations=2)
        ys, xs = np.nonzero(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        piece = rgba[y0:y1, x0:x1].copy()
        piece[..., 3] *= mask[y0:y1, x0:x1]
        out.append(piece)
    return out


def figure_height(piece):
    """Boshdan oyoqqacha balandlik: ingichka qurollar (nayza, kamon ipi) olib tashlangan eng katta bo'lak bo'yicha."""
    m = ndi.binary_opening(piece[..., 3] > 128, structure=np.ones((11, 11)))
    lab, n = ndi.label(m)
    if not n:
        return piece.shape[0]
    sizes = ndi.sum(m, lab, range(1, n + 1))
    rows = np.nonzero((lab == int(np.argmax(sizes)) + 1).any(axis=1))[0]
    return rows.max() - rows.min() + 1


def torso_ax(piece):
    """Barqaror tayanch nuqta: bosh va tananing o'rtasi (oyoq va qurol harakati uni siljitmaydi)."""
    bm = body_mask(piece)
    if not bm.any():
        bm = piece[..., 3] > 128
    rows = np.nonzero(bm.any(axis=1))[0]
    top = rows.min()
    cut = top + max(1, int((rows.max() - top) * 0.45))
    part = bm[top:cut]
    cols_w = part.sum(axis=0)
    if not cols_w.any():
        cols_w = bm.sum(axis=0)
    return float((cols_w * np.arange(len(cols_w))).sum() / cols_w.sum()) / piece.shape[1]


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


def save(im, rel):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=88, method=6)
    return 'assets/' + rel.replace(os.sep, '/')


def frame_meta(file, im, ax, ppu):
    # w, h — o'yin birligida; ax — tayanch nuqta (oyoq o'rtasi) chapdan, ulushda
    return {'f': file, 'w': round(im.width / ppu, 1), 'h': round(im.height / ppu, 1), 'ax': round(ax, 3)}


def save_frames(pieces, name, game_h, preview, ref=0, stable=False):
    """Bir personajning pozalarini bir xil masshtabda saqlaydi (gavda balandligi — ref-pozadan)."""
    if stable:
        body_h = figure_height(pieces[ref])
    else:
        top, bottom = body_rows(pieces[ref])
        body_h = bottom - top + 1
    scale = game_h * PPU / body_h
    frames = []
    for i, p in enumerate(pieces):
        if stable:
            ax = torso_ax(p)
        else:
            bm = body_mask(p)
            cols_w = bm.sum(axis=0) if bm.any() else (p[..., 3] > 128).sum(axis=0)
            ax = float((cols_w * np.arange(len(cols_w))).sum() / cols_w.sum()) / p.shape[1]
        im = resize(p, scale)
        frames.append(frame_meta(save(im, f'units/{name}_{i}.webp'), im, ax, PPU))
        preview.append((im, ax))
    print(f'{name}: {len(pieces)} ta poza, gavda {body_h}px -> {game_h} birlik')
    return frames


def build_units(meta, preview):
    meta['units'] = {}
    for kind, (src, game_h, ref, drop) in ANIM16.items():
        pieces = grid_split(remove_bg(load(src)), 4, 4, drop)
        meta['units'][kind] = save_frames(pieces, kind, game_h, preview, ref=ref, stable=True)
    for kind, (src, rows, cols, game_h, mirror) in UNITS.items():
        rgba = remove_bg(load(src))
        if mirror:
            rgba = rgba[:, ::-1].copy()
            # namuna rasmdagi tuyoq ostidagi och yer dog'ini olib tashlaymiz
            h = rgba.shape[0]
            rgb = rgba[..., :3]
            sat = (rgb.max(axis=2) - rgb.min(axis=2)) / np.maximum(rgb.max(axis=2), 1)
            lum = (rgb * [0.299, 0.587, 0.114]).sum(axis=2)
            patch = (lum > 120) & (sat < 0.18)
            patch[:int(h * 0.88)] = False
            rgba[patch, 3] = 0
        meta['units'][kind] = save_frames(split(rgba, rows, cols), kind, game_h, preview)


def build_factions(meta, preview):
    meta['factions'] = {f: {} for f in FACTION_ROWS}
    for kind, (src, game_h) in FACTION_UNITS.items():
        if not os.path.exists(os.path.join(ART, src)):
            continue
        pieces = split(remove_bg(load(src)), 2, 4)
        for r, fac in enumerate(FACTION_ROWS):
            meta['factions'][fac][kind] = save_frames(pieces[r * 4:(r + 1) * 4], f'{fac}_{kind}', game_h, preview)


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


def wall_top(im, ax, w_units, h_units):
    """Darvoza ustidagi devor tepasining balandligi (o'yin birligida): devordagi kamonchilar shu yerda turadi."""
    a = np.asarray(im)[..., 3] > 128
    H, W = a.shape
    gate = ax * W
    tops = []
    for dx in range(-35, 26, 5):
        x = int(gate + dx * W / w_units)
        if not 0 <= x < W:
            continue
        col = a[:, x]
        for y in np.nonzero(col)[0]:
            if col[y:y + 12].all():
                tops.append((H - y) / H * h_units)
                break
    return round(float(np.median(tops)), 1) if tops else round(h_units * 0.62, 1)


def keep_front(piece, gate, keep_px):
    """Qasrning faqat darvoza old qismini qoldiradi: darvozadan chapga keep_px piksel. Qaytaradi: (bo'lak, yangi ax)."""
    gx = gate * piece.shape[1]
    x0 = int(max(0, gx - keep_px))
    p = piece[:, x0:]
    ys, xs = np.nonzero(p[..., 3] > 8)
    p = p[ys.min():ys.max() + 1, :xs.max() + 1]
    return p, (gx - x0) / p.shape[1]


def put_buildings(meta, preview, key, pieces, game_w, axes, full_w=None):
    """Bir guruh binolarni bir xil masshtabda saqlaydi. axes — har biri uchun tayanch nuqta (darvoza).
    full_w — kesilmagan rasmning kengligi (piksel): masshtab shundan olinadi."""
    med_w = full_w or float(np.median([p.shape[1] for p in pieces]))
    ppu = min(PPU, med_w / game_w)  # asl o'lchamdan kattalashtirmaymiz
    scale = game_w * ppu / med_w
    frames = []
    for i, (p, ax) in enumerate(zip(pieces, axes)):
        im = resize(p, scale)
        fm = frame_meta(save(im, f'{key}_{i}.webp'), im, ax, ppu)
        if key != 'kon':
            fm['wz'] = wall_top(im, ax, fm['w'], fm['h'])
        frames.append(fm)
        preview.append((im, ax))
    meta['buildings'][key] = frames
    print(f'{key}: {len(pieces)} ta, kenglik ~{game_w} birlik, darvoza {[round(a, 2) for a in axes]}')


def build_buildings(meta, preview):
    meta['buildings'] = {}
    # Bizning qasr: ochiq, yopiq, shikastlangan, vayron. Darvoza joyi — ochiq holatdan; to'rttasi bir xil kesiladi
    ours = split(remove_bg(load('qasr_biz.webp')), 2, 2)
    full = ours[0].shape[1]
    gx = gate_x(ours[0])
    cut = [keep_front(p, gx * full / p.shape[1], CASTLE_KEEP * full) for p in ours]
    put_buildings(meta, preview, 'qasr_biz', [c[0] for c in cut], CASTLE_W, [c[1] for c in cut], full_w=full)
    # Konlar: kirish joyi qasr tomonga (chapga) qaragan
    mines = split(remove_bg(load('konlar.webp')), 2, 2)
    put_buildings(meta, preview, 'kon', mines, MINE_W, [gate_x(m) for m in mines])
    # Dushman qasrlari: o'rmon, ko'l, ekinzor, tog', dasht, cho'l; keyin ikki poytaxt
    a = split(remove_bg(load('qasr_dushman_1.webp')), 2, 2)
    b = split(remove_bg(load('qasr_dushman_2.webp')), 2, 2)
    forts = a + b[:2]
    full = float(np.median([f.shape[1] for f in forts]))
    cut = [keep_front(f, gate_x(f), CASTLE_KEEP * f.shape[1]) for f in forts]
    put_buildings(meta, preview, 'qasr_dushman', [c[0] for c in cut], CASTLE_W, [c[1] for c in cut], full_w=full)
    cities = b[2:]
    full = float(np.median([c.shape[1] for c in cities]))
    cut = [keep_front(c, gate_x(c), CITY_KEEP * c.shape[1]) for c in cities]
    put_buildings(meta, preview, 'shahar', [c[0] for c in cut], CITY_W, [c[1] for c in cut], full_w=full)


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
    build_factions(meta, preview)
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
