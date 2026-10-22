"""
Skelet animatsiya uchun qismlar: tik turgan kadrdan jangchini bo'laklarga ajratadi
(gavda, bosh, yelka, bilak+qo'l, son, boldir+etik), qo'l va qilich turgan joyni atrofidagi
rangdan to'ldiradi va public/assets/parts/ ga yozadi. Suyak nuqtalari src/assets.json ning
"rigs" bo'limiga yoziladi. Qilichlarni o'yin o'zi chizadi.

Hozircha bitta jangchi (Amir) va qo'lda belgilangan chegaralar bilan. Toza "qismlar varag'i"
kelganda shu yerdagi ko'pburchaklar o'rniga varaqdagi tayyor bo'laklar olinadi.

Ishga tushirish:  python3 tools/rig_parts.py        (faqat "rigs" bo'limini yangilaydi)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prepare_assets as pa  # noqa: E402

# Kataklar 6x4, har biri 256 px. Koordinatalar shu katak ichida (manba piksel).
CELL = 256

RIGS = {
    'amir': {
        'sheet': 'anim24_amir.webp',
        'frame': 9,
        'game_h': 76,
        'center': 125,  # gavda o'rtasi (x)
        # olib tashlanadigan joylar (o'zi chizilgan qilichlar bilan birga) va o'rni qaysi tomondagi
        # matodan ko'chirib to'ldiriladi (dx — shuncha piksel o'ngdagi/chapdagi qatordan)
        'remove': [
            # yaqin qo'l: yeng, bilakuzuk, qo'l, qilich dastasi va tig'i — o'rniga o'ngdagi ko'ylak
            ([(96, 94), (115, 94), (120, 126), (120, 153), (114, 154), (113, 172), (121, 206), (119, 213),
              (109, 213), (103, 178), (102, 155), (94, 154), (94, 146), (97, 136)], 22),
            # uzoq qo'l va qilichi — o'rniga chapdagi ko'ylak
            ([(139, 95), (155, 95), (157, 128), (161, 139), (189, 191), (189, 209), (177, 209), (150, 153),
              (139, 145)], -9),
        ],
        # gavdaning old cheti (uzoq qo'l olingach shu chiziqdan o'ngi shaffof bo'ladi): x = a + b*y
        'edge': (140.7, 0.045),
        'hem': 188,  # ko'ylak etagi: undan pastda faqat oyoqlar
        'cape': (94, 200),  # etakdan pastga tushgan plash popugi: x < 94, y < 200
        'head': (54, 61),  # gavda shu qatordan boshlanadi; bosh shu qatorgacha
        'upper': [(98, 96), (113, 96), (114, 120), (98, 120)],
        'fore': [(97, 118), (115, 118), (119, 126), (119, 149), (97, 149)],
        'leg': [(121, 186), (150, 186), (147, 200), (147, 226), (151, 229), (164, 232), (165, 241), (127, 241),
                (129, 226), (128, 206), (121, 197)],
        # suyak nuqtalari (manba piksel)
        'neck': (122, 56),
        'hip': (125, 150),
        'shoulder': (106, 80),  # yaqin yelka (plash ostida)
        'shoulder_far': (134, 82),
        'elbow': (106, 118),
        'hand': (108, 145),  # qilich dastasi qo'lda shu nuqtada
        'knee': (134, 196),
        'leg_hips': (118, 132),  # orqa va old son boshlanadigan x
    },
}

DARK = 0.7  # uzoq qo'l-oyoq qorong'iroq


def poly_mask(shape, pts):
    im = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=255)
    return np.asarray(im) > 0


def clone_fill(rgba, hole, dx):
    """Teshikni yonidagi matodan ko'chiradi (shu qatorning dx piksel narisidan); qolganini chetdan to'ldiradi."""
    h, w = hole.shape
    ys, xs = np.nonzero(hole)
    src = np.clip(xs + dx, 0, w - 1)
    ok = ~hole[ys, src] & (rgba[ys, src, 3] > 200)
    out = rgba.copy()
    out[ys[ok], xs[ok], :3] = rgba[ys[ok], src[ok], :3]
    out[ys[ok], xs[ok], 3] = 255
    rest = hole.copy()
    rest[ys[ok], xs[ok]] = False
    return fill_from_edges(out, rest) if rest.any() else out


def fill_from_edges(rgba, hole):
    """Teshikni chetidagi ranglar bilan asta to'ldiradi (oddiy inpaint)."""
    rgb = rgba[..., :3].copy()
    known = ~hole & (rgba[..., 3] > 200)
    todo = hole.copy()
    k = np.ones((3, 3))
    while todo.any():
        s = np.dstack([ndi.convolve(rgb[..., c] * known, k, mode='constant') for c in range(3)])
        n = ndi.convolve(known.astype(np.float32), k, mode='constant')
        front = todo & (n > 0)
        if not front.any():
            break
        rgb[front] = s[front] / n[front][:, None]
        known = known | front
        todo = todo & ~front
    out = rgba.copy()
    out[hole, :3] = rgb[hole]
    out[hole, 3] = 255
    return out


def crop_part(rgba, mask, pivot, ppu, k):
    """Bo'lakni qirqib, o'yin o'lchamiga keltiradi. Qaytaradi: (rasm, meta) — meta: o'lcham va tayanch (birlikda)."""
    a = rgba.copy()
    a[~mask, 3] = 0
    ys, xs = np.nonzero(a[..., 3] > 8)
    x0, x1, y0, y1 = xs.min() - 1, xs.max() + 2, ys.min() - 1, ys.max() + 2
    piece = a[y0:y1, x0:x1]
    scale = k * ppu  # manba pikselidan saqlanadigan pikselga
    im = pa.resize(piece, scale)
    w, h = (x1 - x0) * k, (y1 - y0) * k
    return im, {'w': round(w, 2), 'h': round(h, 2), 'px': round((pivot[0] - x0) * k, 2), 'py': round((pivot[1] - y0) * k, 2)}


def darker(im):
    a = np.asarray(im).astype(np.float32)
    a[..., :3] *= DARK
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def thigh_strip(rgba, leg_mask, hip_y, knee, width):
    """Son ko'ylak ostida ko'rinmaydi: shimning etak ostidagi qatorlaridan cho'zib yasaladi."""
    kx, ky = knee
    rows = rgba[ky - 8:ky, kx - width // 2:kx + width // 2].copy()
    m = leg_mask[ky - 8:ky, kx - width // 2:kx + width // 2]
    rows[~m, 3] = 0
    n = ky - hip_y
    reps = int(np.ceil(n / rows.shape[0]))
    strip = np.concatenate([rows] * reps, axis=0)[-n:]
    full = np.zeros_like(rgba)
    full[hip_y:ky, kx - width // 2:kx + width // 2] = strip
    return full


def build_rig(name, cfg, ppu):
    rgb = pa.load(cfg['sheet'])
    r, c = divmod(cfg['frame'], 6)
    cell = rgb[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL]
    rgba = pa.remove_bg(cell)
    alpha = rgba[..., 3] > 128
    ys, xs = np.nonzero(alpha)
    top, ground = ys.min(), ys.max()
    k = cfg['game_h'] / (ground - top)  # manba pikselidan o'yin birligiga
    shape = alpha.shape
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]

    # Qo'l, oyoq va boshni olib, gavdani to'ldiramiz
    a_e, b_e = cfg['edge']
    inside = (xx <= a_e + b_e * yy) & (yy < cfg['hem'])
    removed = np.zeros(shape, bool)
    torso = rgba
    for pts, dx in cfg['remove']:
        m = ndi.binary_dilation(poly_mask(shape, pts), iterations=1)
        removed |= m
        torso = clone_fill(torso, m & inside, dx)
    body = alpha | (removed & inside)
    cx_max, cy_max = cfg['cape']
    torso_mask = body & (yy >= cfg['head'][0]) & ((yy < cfg['hem']) | ((xx < cx_max) & (yy < cy_max)))
    torso_mask &= ~(removed & ~inside)

    head_mask = alpha & (yy < cfg['head'][1]) & ~removed
    upper_mask = poly_mask(shape, cfg['upper']) & alpha
    fore_mask = poly_mask(shape, cfg['fore']) & alpha
    leg_mask = poly_mask(shape, cfg['leg']) & alpha & ~removed

    # Yelka plash ostidan boshlanadi: yengning yuqori qatorlarini yelkagacha cho'zamiz
    sx, sy = cfg['shoulder']
    ex, ey = cfg['elbow']
    upper = rgba.copy()
    ys_u = np.nonzero(upper_mask.any(axis=1))[0]
    first = ys_u.min()
    for y in range(sy - 2, first):
        upper[y] = rgba[first + 2]
        upper_mask[y] = upper_mask[first + 2]

    kx, ky = cfg['knee']
    hip_y = cfg['hip'][1]
    thigh = thigh_strip(rgba, leg_mask, hip_y - 4, (kx, ky), 22)
    thigh_mask = thigh[..., 3] > 8

    out_dir = os.path.join(pa.OUT, 'parts')
    os.makedirs(out_dir, exist_ok=True)
    parts = {}

    def put(part, src, mask, pivot, dark=False):
        im, meta = crop_part(src, mask, pivot, ppu, k)
        rel = f'parts/{name}_{part}.webp'
        pa.save(im, rel)
        meta['f'] = 'assets/' + rel
        parts[part] = meta
        if dark:
            rel_d = f'parts/{name}_{part}_d.webp'
            pa.save(darker(im), rel_d)
            parts[part + '_d'] = {**meta, 'f': 'assets/' + rel_d}

    put('torso', torso, torso_mask, cfg['hip'])
    put('head', rgba, head_mask, cfg['neck'])
    put('upper', upper, upper_mask, cfg['shoulder'], dark=True)
    put('fore', rgba, fore_mask, cfg['elbow'], dark=True)
    put('thigh', thigh, thigh_mask, (kx, hip_y - 4), dark=True)
    put('shin', rgba, leg_mask, cfg['knee'], dark=True)

    cx = cfg['center']

    def rel(p, o):  # o nuqtaga nisbatan, birlikda
        return [round((p[0] - o[0]) * k, 2), round((p[1] - o[1]) * k, 2)]

    hip = cfg['hip']
    hb, hf = cfg['leg_hips']
    joints = {
        'hip': [round((hip[0] - cx) * k, 2), round((hip[1] - ground) * k, 2)],  # oyoq tagidan
        'neck': rel(cfg['neck'], hip),
        'shoulder': rel(cfg['shoulder'], hip),
        'shoulderFar': rel(cfg['shoulder_far'], hip),
        'elbow': rel(cfg['elbow'], cfg['shoulder']),
        'hand': rel(cfg['hand'], cfg['elbow']),
        'hipBack': rel((hb, hip_y - 4), hip),
        'hipFront': rel((hf, hip_y - 4), hip),
        'knee': rel(cfg['knee'], (kx, hip_y - 4)),
        'foot': round((ground - ky) * k, 2),
    }
    print(f'{name}: skelet, {len(parts)} ta qism, 1 manba px = {k:.3f} birlik')
    return {'h': cfg['game_h'], 'parts': parts, 'joints': joints}


def build_rigs(meta):
    meta['rigs'] = {name: build_rig(name, cfg, meta['ppu']) for name, cfg in RIGS.items()}


def main():
    with open(pa.META, encoding='utf-8') as f:
        meta = json.load(f)
    build_rigs(meta)
    with open(pa.META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print('src/assets.json yangilandi (rigs)')


if __name__ == '__main__':
    main()
