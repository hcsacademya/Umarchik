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

# 24 kadrli animatsiya varaqlari (6 ustun x 4 qator): (varaq, gavda balandligi, tik turish kadri — o'lcham shundan olinadi)
# Askarlar: 0–7 yurish, 8–9 turish, 10–11 zarba yeyish, 12–15 1-zarba, 16–19 2-zarba, 20–23 o'lim.
# Konchi: 0–7 bo'sh yurish, 8–15 savat bilan yurish, 16–17 turish, 18–19 zarba yeyish, 20–23 o'lim.
ANIM24 = {
    'amir': ('anim24_amir.webp', 76, 8),
    'qilichli': ('anim24_qilichli.webp', UNIT_H, 8),
    'nayzachi': ('anim24_nayzachi.webp', UNIT_H, 8),
    'kamonchi': ('anim24_kamonchi.webp', UNIT_H, 8),
    'konchi': ('anim24_konchi.webp', 68, 16),
}
# Dushman xalqlarining 24 kadrli varaqlari (bo'lmasa — eski 4 kadrli varaq ishlatiladi)
FACTION_ANIM24 = {
    ('kochmanchi', 'qilichli'): 'anim24_kochmanchi_qilichli.webp',
    ('kochmanchi', 'nayzachi'): 'anim24_kochmanchi_nayzachi.webp',
    ('kochmanchi', 'kamonchi'): 'anim24_kochmanchi_kamonchi.webp',
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

# Yaxlit tayanchlar: qal'a devori, darvoza va kon bitta rasmda. Darvoza teshigining balandligi (o'yin birligida)
GATE_H = 100
BASES = {
    'biz': 'baza_biz.webp',
    'biz_vayron': 'baza_biz_vayron.webp',
    'ormon': 'baza_ormon.webp',
    'dasht': 'baza_dasht.webp',
    'ekinzor': 'baza_ekinzor.webp',
    'kol': 'baza_kol.webp',
}

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
    for kind, (src, game_h, ref) in ANIM24.items():
        pieces = grid_split(remove_bg(load(src)), 4, 6)
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
            src24 = FACTION_ANIM24.get((fac, kind))
            if src24 and os.path.exists(os.path.join(ART, src24)):
                p24 = grid_split(remove_bg(load(src24)), 4, 6)
                meta['factions'][fac][kind] = save_frames(p24, f'{fac}_{kind}', game_h, preview, ref=8, stable=True)
            else:
                meta['factions'][fac][kind] = save_frames(pieces[r * 4:(r + 1) * 4], f'{fac}_{kind}', game_h, preview)


def dark_openings(rgba):
    """Darvoza va kon og'zi: pastki yarmidagi eng katta ikki qorong'i joy (chapdagisi — darvoza)."""
    a = rgba[..., 3] > 128
    lum = (rgba[..., :3] * [0.299, 0.587, 0.114]).sum(axis=2)
    H = a.shape[0]
    dark = a & (lum < 55)
    dark[:int(H * 0.45)] = False
    dark = ndi.binary_opening(dark, np.ones((5, 5)))
    lab, n = ndi.label(dark)
    sizes = ndi.sum(dark, lab, range(1, n + 1))
    boxes = []
    for i in np.argsort(sizes)[::-1][:2]:
        sl = ndi.find_objects((lab == i + 1).astype(int))[0]
        boxes.append((sl[1].start, sl[1].stop, sl[0].start, sl[0].stop))
    boxes.sort()
    return boxes  # [darvoza, kon]: (x0, x1, y0, y1)


def full_row(a, x0, x1, y_from, y_to, fill=0.93):
    """x0..x1 oralig'ida qator to'liq (tishlarsiz) devor bo'lgan eng yuqori qator — devor yo'lagi sathi."""
    for y in range(y_from, y_to):
        if a[y, x0:x1].mean() >= fill:
            return y
    return y_to


def build_bases(meta, preview):
    """Yaxlit tayanchlar: fon olib tashlanadi, pastki chet darvoza ostidan kesiladi (suv, yer dog'i ketadi).
    Meta: darvoza markazi (ax), teshiklar (kirish qatlami uchun), devor yo'lagi balandliklari, kon og'zigacha masofa."""
    meta['bases'] = {}
    ref_k = None
    gate_ref = None
    for key, src in BASES.items():
        if not os.path.exists(os.path.join(ART, src)):
            continue
        rgba = remove_bg(load(src))
        a = rgba[..., 3] > 128
        if key.endswith('_vayron'):
            boxes = gate_ref  # vayron holat: tuzilishi asl rasm bilan bir xil
        else:
            boxes = dark_openings(rgba)
        (gx0, gx1, gy0, gy1), (mx0, mx1, my0, my1) = boxes
        if not key.endswith('_vayron'):
            gate_ref = boxes
        ground = gy1 + 6  # yer chizig'i: darvoza teshigining osti
        k = ref_k or GATE_H / (gy1 - gy0)  # o'yin birligi / piksel (hamma tayanchlar bir xil masshtabda)
        ref_k = k
        gx = (gx0 + gx1) / 2
        # devor yo'lagi: darvoza ustida va chap devorda
        top = int(np.nonzero(a.any(axis=1))[0].min())
        wz_gate = (ground - full_row(a, int(gx - 50), int(gx + 50), top, gy0)) * k
        lx0, lx1 = int(gx - 640), int(gx - 360)
        wz_wall = (ground - full_row(a, max(0, lx0), max(1, lx1), top, gy0)) * k
        cut = rgba[top:ground + 2].copy()
        ys, xs = np.nonzero(cut[..., 3] > 8)
        cut = cut[:, :xs.max() + 1]
        im = to_image(cut)
        rel = save(im, f'baza_{key}.webp')
        h_units = im.height * k
        w_units = im.width * k
        def hole(x0, x1, y0, y1):
            # teshik: kenglikka va balandlikka nisbatan, y — pastdan
            return [round(x0 / im.width, 4), round(x1 / im.width, 4), round((ground + 2 - y1) / im.height, 4), round((ground + 2 - y0) / im.height, 4)]
        meta['bases'][key] = {
            'f': rel, 'w': round(w_units, 1), 'h': round(h_units, 1), 'ax': round(gx / im.width, 4),
            'gate': hole(gx0, gx1, gy0, gy1), 'mine': hole(mx0, mx1, my0, my1),
            'mineDx': round(((mx0 + mx1) / 2 - gx) * k, 1),
            'wzGate': round(wz_gate, 1), 'wzWall': round(wz_wall, 1),
        }
        preview.append((im.resize((im.width // 3, im.height // 3)), gx / im.width))
        print(f"baza {key}: {w_units:.0f}x{h_units:.0f} birlik, kon {meta['bases'][key]['mineDx']}, devor {wz_gate:.0f}/{wz_wall:.0f}")


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
    build_bases(meta, preview)
    build_backgrounds(meta, preview)
    build_map(meta)
    import rig_parts  # skelet qismlari (xuddi shu papkada)
    rig_parts.build_rigs(meta)
    with open(META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print('src/assets.json yozildi')
    if '--preview' in sys.argv:
        write_preview(preview)


if __name__ == '__main__':
    main()
