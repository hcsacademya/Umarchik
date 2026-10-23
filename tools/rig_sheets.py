"""
Skelet animatsiya bo'laklarini "qismlar varag'i"dan (art/qismlar_*.webp) kesib oladi:
  - fonni olib tashlaydi, varaqdagi alohida bo'laklarni topadi (qatorlar bo'yicha, chapdan o'ngga),
  - har bir bo'lakni HAQIQIY ODAM (va ot) NISBATLARIGA keltiradi: varaqlar turli ilovalarda chizilgan,
    bo'laklar har xil kattalikda bo'lishi mumkin — qo'l-oyoq aynan belgilangan uzunlikka, bosh va gavda
    shu varaqning umumiy masshtabida (lekin haqiqiy oraliqdan chiqmaydi), qurollar haqiqiy uzunligida,
  - burilish nuqtalarini (yelka, tirsak, son, tizza, bo'yin ...) bo'lak shaklidan topadi,
  - orqadagi qo'l va oyoq uchun qorong'i nusxasini yasaydi (_d),
  - public/assets/parts/ ga yozadi, src/assets.json ning "rigs" bo'limini to'ldiradi.
Dushman varaqlarida ikki xalq ikki qatorda: kerakli qator olinadi.

Ishga tushirish:  python3 tools/rig_sheets.py [nom ...]     (faqat "rigs" bo'limini yangilaydi)
Tekshirish rasmi: python3 tools/rig_sheets.py --preview     (scratch/parts_preview.png)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prepare_assets as pa  # noqa: E402

PX_PER_UNIT = 3.0  # bo'laklar o'yin birligiga nisbatan shuncha piksel bilan saqlanadi (burilganda xira bo'lmasin)
DARK = 0.68        # orqadagi qo'l va oyoq qorong'iroq

# ---------- Haqiqiy nisbatlar (jangchi bo'yi H ga nisbatan: tepadan oyoq tagigacha) ----------
# Qo'l-oyoq bo'laklarining balandligi aynan shunga keltiriladi: yelka (0.19), bilak mushti bilan (0.21),
# son (0.25), boldir etik bilan (0.29) — son bo'g'ini yerdan ~0.51H, yelka ~0.82H
LIMB = {'upper': 0.19, 'fore': 0.21, 'thigh': 0.25, 'shin': 0.29}
TORSO_SPAN = (0.29, 0.35)  # son bo'g'inidan bo'yingacha
HEAD_H = (0.15, 0.30)      # bosh bo'lagining balandligi (dubulg'a, pat bilan)
HEAD_W = (0.10, 0.28)
# Oyoq bo'laklari tabiiy ingichkaroq: kenglik shuncha ko'paytiriladi (etik va keng shim juda katta ko'rinmasin)
XS = {'thigh': 0.84, 'shin': 0.84, 'foot': 0.84}
ANKLE_OVERLAP = 5  # tovon va boldir tutashgan joyda shuncha piksel ustma-ust (chok ko'rinmasin)

# Anjomlar: varaqdagi o'lchamida (shu varaq masshtabida), lekin haqiqiy oraliqdan chiqmaydi: (o'lcham, eng kam, eng ko'p)
GEAR = {
    'cape': ('h', 0.46, 0.60),
    'shield': ('h', 0.30, 0.40),
    'quiver': ('h', 0.34, 0.46),
    'basket': ('h', 0.24, 0.34),
    'basketfull': ('h', 0.24, 0.34),
}
# Qurollar: haqiqiy uzunligi (bo'yiga nisbatan) va dastasi qayerda (uzunligi bo'yicha ulush)
WEAPONS = {
    'sabre': ('w', 0.50, 0.075),
    'sword': ('w', 0.54, 0.09),
    'spear': ('w', 1.35, 0.30),
    'lance': ('w', 1.55, 0.27),
    'bow': ('h', 0.64, 0.5),
    'pick': ('w', 0.47, 0.25),
    'arrow': ('w', 0.43, 0.05),
    'banner': ('w', 1.45, 0.02),
}
# Ot: yag'rin balandligi chavandoz bo'yining shuncha ulushi; ot bo'laklari yag'ringa nisbatan
HORSE_W = 0.84
HORSE = {'body': ('w', 1.0), 'neck': ('h', 0.62), 'tail': ('h', 0.42),
         'fu': ('h', 0.33), 'fl': ('h', 0.37), 'hu': ('h', 0.37), 'hl': ('h', 0.43)}

# Bo'laklarni varaqda topish tartibi (qatorlar bo'yicha, chapdan o'ngga)
ORDER_SWORD = ['head', 'torso', 'shield', 'upper', 'fore', 'thigh', 'shin', 'weapon']
ORDER_ARCHER = ['head', 'torso', 'quiver', 'upper', 'fore', 'thigh', 'shin', 'weapon', 'arrow']
ORDER_ELITE = ['head', 'torso', 'cape', 'shield', 'upper', 'fore', 'thigh', 'shin', 'weapon']
ORDER_ELITE_ARCHER = ['head', 'torso', 'cape', 'quiver', 'upper', 'fore', 'thigh', 'shin', 'weapon', 'arrow']
ORDER_HORSE = ['body', 'neck', 'tail', 'fu', 'fl', 'hu', 'hl', 'head', 'torso', 'upper', 'fore', 'thigh', 'shin',
               'weapon', 'shield']

# nom: varaq, qatorlar soni (rows) yoki xalq qatori (group: 0 — tepadagi, 1 — pastdagi), tartib, bo'yi, qurol turi.
# "pivot" — qo'lda belgilangan burilish nuqtalari (0..1); yozilmaganlari bo'lak shaklidan topiladi.
# "crop" — bo'lakning faqat bir qismi (qatorlar ulushi): rasmda yelka bilan birga butun qo'l chizilgan bo'lsa.
RIGS = {
    'amir': {
        'sheet': 'qismlar_amir.webp', 'rows': 3, 'h': 84, 'weapon': 'sabre',
        'order': ['head', 'torso', 'cape', 'upper', 'fore', 'thigh', 'shin', 'weapon'],
        'pivot': {'head': (0.62, 0.86), 'cape': (0.56, 0.08), 'weapon': (0.075, 0.42)},
        'shoulder': (0.40, 0.10), 'attach': {'cape': (0.52, 0.05)},
    },
    'qilichli': {
        'sheet': 'qismlar_qilichli.webp', 'rows': 3, 'h': 79, 'order': ORDER_SWORD, 'weapon': 'sword',
        'pivot': {'head': (0.60, 0.88), 'weapon': (0.09, 0.5)}, 'shoulder': (0.45, 0.10),
    },
    'nayzachi': {
        'sheet': 'qismlar_nayzachi.webp', 'rows': 3, 'h': 79, 'order': ORDER_SWORD, 'weapon': 'spear',
        'pivot': {'head': (0.58, 0.88)}, 'shoulder': (0.45, 0.10),
    },
    'kamonchi': {
        'sheet': 'qismlar_kamonchi.webp', 'rows': 3, 'h': 79, 'order': ORDER_ARCHER, 'weapon': 'bow',
        'pivot': {'head': (0.58, 0.86), 'quiver': (0.5, 0.25), 'weapon': (0.5, 0.5)},
        'shoulder': (0.45, 0.10), 'attach': {'quiver': (0.22, 0.30)},
    },
    'konchi': {
        'sheet': 'qismlar_konchi.webp', 'rows': 3, 'h': 75, 'weapon': 'pick',
        'order': ['head', 'torso', 'upper', 'fore', 'thigh', 'shin', 'weapon', 'basket', 'basketfull'],
        'pivot': {'head': (0.55, 0.88), 'basket': (0.55, 0.30), 'basketfull': (0.55, 0.30)},
        'shoulder': (0.45, 0.10), 'attach': {'basket': (0.18, 0.34)},
    },
    # ---- sarkardalar (piyoda): bezakli, plashli ----
    'sarkarda_qilichli': {
        'sheet': 'qismlar_sarkarda_qilichli.webp', 'rows': 3, 'h': 79, 'order': ORDER_ELITE, 'weapon': 'sword',
        'crop': {'upper': (0, 0.72)},
    },
    'sarkarda_nayzachi': {
        'sheet': 'qismlar_sarkarda_nayzachi.webp', 'rows': 3, 'h': 79, 'order': ORDER_ELITE, 'weapon': 'spear',
        'crop': {'upper': (0, 0.72)},
    },
    'sarkarda_kamonchi': {
        'sheet': 'qismlar_sarkarda_kamonchi.webp', 'rows': 3, 'h': 79, 'order': ORDER_ELITE_ARCHER, 'weapon': 'bow',
        'crop': {'upper': (0, 0.72)}, 'pivot': {'quiver': (0.5, 0.25)}, 'attach': {'quiver': (0.22, 0.30)},
    },
    # ---- otliqlar: ot va chavandoz ----
    'otliq': {
        'sheet': 'qismlar_otliq.webp', 'rows': 3, 'h': 79, 'horse': True, 'order': ORDER_HORSE, 'weapon': 'lance',
        'crop': {'upper': (0, 0.48)},
    },
    'sarkarda_otliq': {
        'sheet': 'qismlar_sarkarda_otliq.webp', 'rows': 4, 'h': 79, 'horse': True, 'weapon': 'lance',
        'order': ORDER_HORSE + ['cape'], 'crop': {'upper': (0, 0.72)},
    },
    'qomondon': {
        'sheet': 'qismlar_qomondon.webp', 'rows': 3, 'h': 79, 'horse': True, 'weapon': 'sword',
        'order': ORDER_HORSE + ['cape', 'banner'], 'crop': {'upper': (0, 0.72)},
        'legs_full': {'fu': True, 'hu': True},
    },
}

# Dushman: ko'chmanchi va sovutli (varaq, qator, tartib, qurol, qo'shimcha)
FACTIONS = {
    'kochmanchi_qilichli': ('qismlar_dushman_qilichli_kochmanchi.webp', 0, ORDER_SWORD, 'sabre', {}),
    'sovutli_qilichli': ('qismlar_dushman_qilichli_sovutli.webp', 2, ORDER_SWORD, 'sword', {}),
    'kochmanchi_nayzachi': ('qismlar_dushman_nayzachi.webp', 0, ORDER_SWORD, 'spear', {}),
    'sovutli_nayzachi': ('qismlar_dushman_nayzachi.webp', 2, ORDER_SWORD, 'spear', {}),
    'kochmanchi_kamonchi': ('qismlar_dushman_kamonchi.webp', 0, ORDER_ARCHER, 'bow', {}),
    'sovutli_kamonchi': ('qismlar_dushman_kamonchi.webp', 2, ORDER_ARCHER, 'bow', {}),
    'kochmanchi_sarkarda_qilichli': ('qismlar_dushman_sarkarda_qilichli.webp', 0, ORDER_ELITE, 'sabre', {'crop': {'upper': (0, 0.5)}}),
    'sovutli_sarkarda_qilichli': ('qismlar_dushman_sarkarda_qilichli.webp', 1, ORDER_ELITE, 'sword', {'crop': {'upper': (0, 0.5)}}),
    'kochmanchi_sarkarda_nayzachi': ('qismlar_dushman_sarkarda_nayzachi.webp', 0, ORDER_ELITE, 'spear', {'crop': {'upper': (0, 0.5)}}),
    'sovutli_sarkarda_nayzachi': ('qismlar_dushman_sarkarda_nayzachi.webp', 1, ORDER_ELITE, 'spear', {'crop': {'upper': (0, 0.5)}}),
    'kochmanchi_sarkarda_kamonchi': ('qismlar_dushman_sarkarda_kamonchi.webp', 0, ORDER_ELITE_ARCHER, 'bow',
                                     {'crop': {'upper': (0, 0.5), 'fore': (0.5, 1.0)}}),
    'sovutli_sarkarda_kamonchi': ('qismlar_dushman_sarkarda_kamonchi.webp', 1, ORDER_ELITE_ARCHER, 'bow', {}),
}
for _name, (_sheet, _group, _order, _weapon, _extra) in FACTIONS.items():
    _kind = _name.rsplit('_', 1)[1]
    _base = RIGS[_kind]
    RIGS[_name] = dict({
        'sheet': _sheet, 'group': _group, 'h': 79, 'order': _order, 'weapon': _weapon,
        'pivot': {k: v for k, v in _base.get('pivot', {}).items() if k in ('quiver', 'basket', 'basketfull')},
        'attach': _base.get('attach', {}),
    }, **_extra)
    if 'sarkarda' not in _name:
        RIGS[_name]['shoulder'] = (0.42, 0.10)
RIGS['kochmanchi_qilichli']['pivot']['weapon'] = (0.075, 0.42)  # egri qilich dastasi
RIGS['sovutli_qilichli']['pivot']['weapon'] = (0.09, 0.5)
# Dushman otliqlari (dushmanda qo'mondon yo'q)
RIGS.update({
    'kochmanchi_otliq': {
        'sheet': 'qismlar_dushman_otliq_kochmanchi.webp', 'rows': 3, 'h': 79, 'horse': True, 'order': ORDER_HORSE,
        'weapon': 'lance', 'crop': {'upper': (0, 0.6)},
    },
    'sovutli_otliq': {
        'sheet': 'qismlar_dushman_otliq_sovutli.webp', 'rows': 3, 'h': 79, 'horse': True, 'order': ORDER_HORSE,
        'weapon': 'lance', 'crop': {'upper': (0, 0.5)},
    },
    'kochmanchi_sarkarda_otliq': {
        'sheet': 'qismlar_dushman_sarkarda_otliq_kochmanchi.webp', 'rows': 4, 'h': 79, 'horse': True,
        'order': ORDER_HORSE + ['cape'], 'weapon': 'lance', 'crop': {'upper': (0, 0.66)},
    },
    'sovutli_sarkarda_otliq': {
        'sheet': 'qismlar_dushman_sarkarda_otliq_sovutli.webp', 'rows': 4, 'h': 79, 'horse': True,
        'order': ORDER_HORSE + ['cape'], 'weapon': 'lance', 'legs_full': {'hu': True}, 'hole': (0.29, 0.22),
    },
})


def _make_comp(sl, m):
    ys, xs = np.nonzero(m)
    return {
        'sl': sl, 'mask': m,
        'x0': sl[1].start + xs.min(), 'x1': sl[1].start + xs.max() + 1,
        'y0': sl[0].start + ys.min(), 'y1': sl[0].start + ys.max() + 1,
        'cx': sl[1].start + xs.mean(), 'cy': sl[0].start + ys.mean(),
    }


def _split(rgba, sl, m, axis, depth=0):
    """Yaqin turgan ikki bo'lak (masalan, ustma-ust kamonlar yoki oyoq va gavda) bir bo'lib topilsa —
    ular orasidagi bo'sh qator/ustundan ajratadi."""
    solid = (rgba[sl][..., 3] > 40) & m
    occ = solid.any(axis=1 - axis)
    runs, cur = [], None
    for i, on in enumerate(occ):
        if on and cur is None:
            cur = i
        elif not on and cur is not None:
            runs.append([cur, i])
            cur = None
    if cur is not None:
        runs.append([cur, len(occ)])
    # juda yaqin bo'laklarni (2 px dan kam oraliq) birlashtiramiz
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < 3:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    out = []
    for a, b in merged:
        sub = np.zeros_like(m)
        if axis == 0:
            sub[a:b] = m[a:b]
        else:
            sub[:, a:b] = m[:, a:b]
        if (sub & solid).sum() < 150:
            continue
        if len(merged) > 1 and depth < 2:
            out += _split(rgba, sl, sub, 1 - axis, depth + 1)
        else:
            out.append(sub)
    return out or [m]


def find_components(rgba, rows=None, group=None):
    """Varaqdagi bo'laklar: har biri uchun (niqob, bbox). Tartib: qatorlar, qator ichida chapdan o'ngga."""
    solid = rgba[..., 3] > 40
    lab, _ = ndi.label(ndi.binary_dilation(solid, iterations=7))
    comps = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        m = (lab[sl] == i) & (rgba[sl][..., 3] > 8)
        if (rgba[sl][..., 3][lab[sl] == i] > 40).sum() < 150:
            continue
        for sub in _split(rgba, sl, m, 0) + []:
            c = _make_comp(sl, sub)
            # varaqdagi katak chiziqlari kabi ingichka chiziqlar bo'lak emas
            if min(c['x1'] - c['x0'], c['y1'] - c['y0']) < 8:
                continue
            comps.append(c)
    H = rgba.shape[0]
    if group is None:
        bands = [[] for _ in range(rows)]
        for c in comps:
            bands[min(rows - 1, int(c['cy'] / (H / rows)))].append(c)
        return [c for b in bands for c in sorted(b, key=lambda c: c['cx'])]
    # dushman varag'i: bosh ustundagi komponentlar qatorlarni belgilaydi; guruhning birinchi nusxasi olinadi
    heads = sorted([c for c in comps if c['cx'] < 200], key=lambda c: c['y0'])
    lo = heads[group]['y0'] - 60
    hi = heads[group + 1]['y0'] - 60 if group + 1 < len(heads) else H
    return sorted([c for c in comps if lo <= c['y0'] < hi], key=lambda c: c['cx'])


def part_rgba(rgba, comp):
    sl = comp['sl']
    piece = rgba[sl].copy()
    piece[~comp['mask'], 3] = 0
    ys, xs = np.nonzero(piece[..., 3] > 8)
    return piece[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def row_center(piece, y_from, y_to):
    """Berilgan qatorlardagi shakl markazining x ulushi (0..1)."""
    a = piece[int(y_from):max(int(y_from) + 1, int(y_to)), :, 3] > 128
    xs = np.nonzero(a.any(axis=0))[0]
    if not len(xs):
        return 0.5
    return (xs.min() + xs.max() + 1) / 2 / piece.shape[1]


def find_ankle(pc):
    """Etikdagi tovon qatori: boldir (tor) tugab oyoq kafti (kengroq) boshlanadigan joy."""
    a = pc[..., 3] > 128
    h = pc.shape[0]
    widths = np.array([np.count_nonzero(a[y]) for y in range(h)])
    ref = np.median(widths[int(h * 0.25):int(h * 0.55)])
    for y in range(int(h * 0.6), h):
        if widths[y] > ref * 1.45:
            return max(int(h * 0.55), y - int(h * 0.03))
    return int(h * 0.8)


def resize_x(arr, scale, xs=1.0):
    im = pa.to_image(arr)
    w, h = max(1, round(im.width * scale * xs)), max(1, round(im.height * scale))
    return im.resize((w, h), Image.LANCZOS)


def darker(im):
    a = np.asarray(im).astype(np.float32)
    a[..., :3] *= DARK
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def crop_rows(pc, a, b):
    h = pc.shape[0]
    out = pc[int(h * a):max(int(h * a) + 2, int(round(h * b)))]
    ys, xs = np.nonzero(out[..., 3] > 8)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def has_hoof(pc):
    """Ot oyog'i pastida tuyoq bormi: tuyoq oyoqning eng ingichka joyidan keng bo'ladi."""
    a = pc[..., 3] > 128
    h = a.shape[0]
    w = np.array([np.count_nonzero(a[y]) for y in range(h)])
    mid = w[int(h * .55):int(h * .9)].min()
    return np.percentile(w[int(h * .93):], 80) > 1.5 * max(1, mid)


def shaft_row(pc):
    """Gorizontal qurolda (nayza, qilich) dasta chizig'i: eng uzun to'la qator."""
    a = pc[..., 3] > 128
    return int(np.argmax(a.sum(axis=1)))


def grip_x_bow(pc):
    """Kamonning ushlash joyi: o'rta qatorlardagi eng qalin bo'lak (ip emas) markazi."""
    a = pc[..., 3] > 128
    h = a.shape[0]
    band = a[int(h * 0.45):int(h * 0.55)].any(axis=0)
    lab, n = ndi.label(band)
    if not n:
        return 0.5
    sizes = ndi.sum(band, lab, range(1, n + 1))
    k = int(np.argmax(sizes)) + 1
    xs = np.nonzero(lab == k)[0]
    return (xs.min() + xs.max() + 1) / 2 / a.shape[1]


def head_neck(pc):
    """Boshda bo'yin nuqtasi: yuz va iyak (orqaga osilgan soch o'rimi va patlar emas) eng pastki joyi."""
    a = pc[..., 3] > 128
    h, w = a.shape
    right = a[:, int(w * 0.35):]
    widths = right.sum(axis=1)
    ok = np.nonzero(widths >= 0.3 * widths.max())[0]
    y = int(ok.max())
    xs = np.nonzero(a[max(0, y - 4):y + 1, int(w * 0.35):].any(axis=0))[0] + int(w * 0.35)
    x = (xs.min() + xs.max() + 1) / 2 if len(xs) else w * 0.6
    return x / w, max(0.5, (y - 0.02 * h) / h)


def fill_hole(pc, hole):
    """Teshikni chetidagi ranglar bilan asta to'ldiradi."""
    rgb = pc[..., :3].copy()
    known = ~hole & (pc[..., 3] > 200)
    todo = hole.copy()
    k = np.ones((3, 3))
    while todo.any():
        acc = np.dstack([ndi.convolve(rgb[..., c] * known, k, mode='constant') for c in range(3)])
        n = ndi.convolve(known.astype(np.float32), k, mode='constant')
        front = todo & (n > 0)
        if not front.any():
            break
        rgb[front] = acc[front] / n[front][:, None] * 0.92  # biroz to'qroq: qo'l ostidagi soya
        known |= front
        todo &= ~front
    out = pc.copy()
    out[hole, :3] = rgb[hole]
    return out


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


class Sheet:
    """Bitta jangchining bo'laklari va ularning masshtabi (manba pikselidan o'yin birligiga)."""

    def __init__(self, name, cfg):
        self.name = name
        self.cfg = cfg
        rgba = pa.remove_bg(pa.load(cfg['sheet']))
        comps = find_components(rgba, cfg.get('rows'), cfg.get('group'))
        order = cfg['order']
        if len(comps) != len(order):
            raise RuntimeError(f"{name}: {len(order)} ta bo'lak kutilgandi, {len(comps)} ta topildi")
        self.pc = {p: part_rgba(rgba, c) for p, c in zip(order, comps)}
        for p, (a, b) in cfg.get('crop', {}).items():
            self.pc[p] = crop_rows(self.pc[p], a, b)
        self.s = {}

    def size(self, p):
        return self.pc[p].shape[1] * self.s[p] * XS.get(p, 1.0), self.pc[p].shape[0] * self.s[p]

    def frac(self, p, fx, fy):
        w, h = self.size(p)
        return fx * w, fy * h

    def top(self, p, fy=0.03):
        pc = self.pc[p]
        return self.frac(p, row_center(pc, 0, max(2, pc.shape[0] * 0.05)), fy)

    def bottom(self, p, fy=0.95):
        pc = self.pc[p]
        return self.frac(p, row_center(pc, pc.shape[0] * 0.93, pc.shape[0]), fy)


def scale_person(sh, H):
    """Odam bo'laklarining masshtabi: qo'l-oyoq aniq uzunlikda, bosh-gavda varaqning umumiy masshtabida."""
    pc = sh.pc
    s = sh.s
    for p, f in LIMB.items():
        s[p] = f * H / pc[p].shape[0]
    g = float(np.median([s[p] for p in LIMB]))
    hip_fy = sh.cfg.get('hip_fy', 0.60)
    th = pc['torso'].shape[0]
    span_px = (hip_fy - 0.02) * th
    s['torso'] = clamp(g, TORSO_SPAN[0] * H / span_px, TORSO_SPAN[1] * H / span_px)
    hh, hw = pc['head'].shape[:2]
    lo = max(HEAD_H[0] * H / hh, HEAD_W[0] * H / hw)
    hi = min(HEAD_H[1] * H / hh, HEAD_W[1] * H / hw)
    s['head'] = clamp(g, min(lo, hi), max(lo, hi))
    for p in pc:
        if p in s:
            continue
        if p in GEAR:
            dim, lo, hi = GEAR[p]
            n = pc[p].shape[0 if dim == 'h' else 1]
            s[p] = clamp(g, lo * H / n, hi * H / n)
        elif p in ('weapon', 'arrow', 'banner'):
            dim, length, _ = WEAPONS[sh.cfg['weapon'] if p == 'weapon' else p]
            n = pc[p].shape[0 if dim == 'h' else 1]
            s[p] = length * H / n
    return g


def person_pivots(sh):
    """Har bo'lakning burilish nuqtasi (o'yin birligida, bo'lak chap-yuqori burchagidan)."""
    cfg = sh.cfg
    piv = {}
    for p in sh.pc:
        pv = cfg.get('pivot', {}).get(p)
        if pv:
            piv[p] = sh.frac(p, *pv)
        elif p == 'head':
            piv[p] = sh.frac(p, *head_neck(sh.pc[p]))
        elif p in ('weapon', 'arrow', 'banner'):
            kind = cfg['weapon'] if p == 'weapon' else p
            dim, _, grip = WEAPONS[kind]
            pc = sh.pc[p]
            if dim == 'h':
                piv[p] = sh.frac(p, grip_x_bow(pc), grip)
            else:
                piv[p] = sh.frac(p, grip, shaft_row(pc) / pc.shape[0])
        elif p == 'shield':
            piv[p] = sh.frac(p, 0.5, 0.45)
        elif p in ('fu', 'fl', 'hu', 'hl', 'body', 'neck', 'tail'):
            continue
        else:
            piv[p] = sh.top(p)
    return piv


def build_person(sh, H, piv):
    """Odam skeleti: bo'g'inlar (son, bo'yin, yelka, tirsak, qo'l, tizza, tovon)."""
    cfg = sh.cfg
    pc = sh.pc
    # etik: boldir va oyoq kafti alohida (yurganda oyoq kafti yerga tekis turadi)
    boot = pc['shin']
    total_px = boot.shape[0]
    ay = find_ankle(boot)
    ankle_x = row_center(boot, max(0, ay - 6), ay)
    pc['shin'] = boot[:ay + ANKLE_OVERLAP]
    pc['foot'] = boot[max(0, ay - ANKLE_OVERLAP):]
    sh.s['foot'] = sh.s['shin']
    k = sh.s['shin']
    piv['shin'] = (row_center(boot, 0, max(2, total_px * 0.05)) * boot.shape[1] * k * XS['shin'], 0.03 * total_px * k)
    piv['foot'] = (ankle_x * boot.shape[1] * k * XS['foot'], ANKLE_OVERLAP * k)
    knee_h = total_px * k - piv['shin'][1]  # tizzadan oyoq tagigacha
    ankle = (ankle_x * boot.shape[1] * k * XS['shin'] - piv['shin'][0], ay * k - piv['shin'][1])

    thigh_tip = sh.bottom('thigh')
    hip_y = knee_h + thigh_tip[1] - piv['thigh'][1]
    tw, th = sh.size('torso')
    hip_fy = cfg.get('hip_fy', 0.60)
    tpc = pc['torso']
    torso_hip = (row_center(tpc, tpc.shape[0] * (hip_fy - 0.03), tpc.shape[0] * (hip_fy + 0.03)) * tw, hip_fy * th)
    torso_neck = (row_center(tpc, 0, max(2, tpc.shape[0] * 0.04)) * tw, 0.02 * th)
    if 'shoulder' in cfg:
        sfx, sfy = cfg['shoulder']
    else:
        # yangi varaqlarda gavda qo'lsiz, yelkada teshik chizilgan: uni atrofdagi mato bilan yopamiz,
        # yelka bo'g'ini teshik markazida, qo'lning yuqori qismi uni to'liq qoplaydi
        sfx, sfy = cfg.get('hole', (0.31, 0.18))
        h, w = tpc.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w]
        rx, ry = 0.17 * w, 0.10 * h
        mask = (((xx - sfx * w) / rx) ** 2 + ((yy - sfy * h) / ry) ** 2 <= 1) & (tpc[..., 3] > 200)
        pc['torso'] = fill_hole(tpc, mask)
        piv['upper'] = sh.top('upper', 0.2)
    torso_sh = (sfx * tw, sfy * th)
    piv['torso'] = torso_hip

    def sub(a, b):
        return [round(a[0] - b[0], 2), round(a[1] - b[1], 2)]

    joints = {
        'hip': [0.0, round(-hip_y, 2)],
        'neck': sub(torso_neck, torso_hip),
        'shoulder': sub(torso_sh, torso_hip),
        'shoulderFar': [round(torso_sh[0] - torso_hip[0] + 0.05 * tw, 2), round(torso_sh[1] - torso_hip[1] + 0.01 * th, 2)],
        'hipBack': [-1.2, 0.0],
        'hipFront': [1.2, 0.0],
        'elbow': sub(sh.bottom('upper'), piv['upper']),
        'hand': sub(sh.bottom('fore', 0.90), piv['fore']),
        'knee': sub(thigh_tip, piv['thigh']),
        'foot': round(knee_h, 2),
        'ankle': [round(ankle[0], 2), round(ankle[1], 2)],
        'sole': round(knee_h - ankle[1], 2),
    }
    attach = dict(cfg.get('attach', {}))
    if 'cape' in pc and 'cape' not in attach:
        attach['cape'] = (sfx - 0.10, max(0.02, sfy - 0.06))  # plash yelka orqasidan osiladi
    for item, (fx, fy) in attach.items():
        joints[item] = sub((fx * tw, fy * th), torso_hip)
    return joints


def build_horse(sh, H, piv):
    """Ot: tana, bo'yin-bosh, dum, ikki bo'g'inli oyoqlar. Oyoqlar yerga tegadigan qilib tana balandligi topiladi."""
    pc = sh.pc
    W = HORSE_W * H
    full = sh.cfg.get('legs_full', {})
    for p, fr in (('fu', 0.55), ('hu', 0.53)):
        if full.get(p, has_hoof(pc[p])):
            pc[p] = crop_rows(pc[p], 0, fr)  # butun oyoq chizilgan: faqat yuqori qismi
        else:
            pc[p] = crop_rows(pc[p], 0, 0.92)
    for p, (dim, f) in HORSE.items():
        n = pc[p].shape[0 if dim == 'h' else 1]
        sh.s[p] = f * W / n
    for p in ('fu', 'hu'):
        piv[p] = sh.top(p)
    for p in ('fl', 'hl'):
        piv[p] = sh.top(p, 0.04)
    piv['tail'] = sh.top('tail')
    bpc = pc['body']
    bw, bh = sh.size('body')
    piv['body'] = (bw / 2, bh / 2)
    a = bpc[..., 3] > 128
    ph, pw = a.shape
    # bo'yin: neck bo'lagining pastki qismi (ko'krak) markazi
    npc = pc['neck']
    na = npc[..., 3] > 128
    nys, nxs = np.nonzero(na[int(npc.shape[0] * 0.82):])
    piv['neck'] = sh.frac('neck', nxs.mean() / npc.shape[1], 0.88)

    def col_front(y0, y1, rear=False):
        xs = np.nonzero(a[int(ph * y0):int(ph * y1)].any(axis=0))[0]
        return (xs.min() if rear else xs.max()) / pw

    front = col_front(0.15, 0.45)
    rear = col_front(0.08, 0.35, rear=True)
    # egar o'rindig'i: o'rtadagi ustunlarda tepaning eng past joyi
    best = (0, pw // 2)
    for x in range(int(pw * 0.38), int(pw * 0.62)):
        ys = np.nonzero(a[:, x])[0]
        if len(ys) and ys.min() > best[0]:
            best = (ys.min(), x)
    seat = (best[1] / pw * bw - bw / 2, best[0] / ph * bh - bh / 2 + 0.03 * bh)

    def rel(fx, fy):
        return fx * bw - bw / 2, fy * bh - bh / 2

    fore = rel(0.77, 0.68)
    fu_tip = sh.bottom('fu')
    fu_len = fu_tip[1] - piv['fu'][1]
    fl_len = sh.size('fl')[1] - piv['fl'][1]
    Lf = fu_len + fl_len
    body_y = -(fore[1] + Lf)  # tana markazi yerdan (manfiy — yuqorida)
    hl_len = sh.size('hl')[1] - piv['hl'][1]
    hind_y = clamp(fore[1] + Lf - (sh.bottom('hu')[1] - piv['hu'][1]) - hl_len, -0.05 * bh, 0.30 * bh)
    # orqa oyoq yerga yetsin: yuqori bo'lagi kerakli uzunlikka keltiriladi
    need = -body_y - hind_y - hl_len
    cur = sh.bottom('hu')[1] - piv['hu'][1]
    sh.s['hu'] *= need / cur
    piv['hu'] = sh.top('hu')
    hind = (0.22 * bw - bw / 2, hind_y)
    joints = {
        'W': round(W, 2),
        'body': [0.0, round(body_y, 2)],
        'fore': [round(fore[0], 2), round(fore[1], 2)],
        'hind': [round(hind[0], 2), round(hind[1], 2)],
        'fuKnee': [round(fu_tip[0] - piv['fu'][0], 2), round(fu_len, 2)],
        'huHock': [round(sh.bottom('hu')[0] - piv['hu'][0], 2), round(sh.bottom('hu')[1] - piv['hu'][1], 2)],
        'neck': [round(v, 2) for v in rel(front - 0.10, 0.30)],
        'tail': [round(v, 2) for v in rel(rear + 0.03, 0.16)],
        'seat': [round(seat[0], 2), round(seat[1], 2)],
        'banner': [round(seat[0] - 0.16 * bw, 2), round(seat[1] - 0.02 * bh, 2)],
    }
    return joints


def save_parts(name, sh, piv, horse=False):
    parts = {}
    for p, pc in sh.pc.items():
        key = ('h_' + p) if p in HORSE else p
        w, h = sh.size(p)
        pv = piv[p]
        im = resize_x(pc, sh.s[p] * PX_PER_UNIT, XS.get(p, 1.0))
        rel = f'parts/{name}_{key}.webp'
        pa.save(im, rel)
        parts[key] = {'f': 'assets/' + rel, 'w': round(w, 2), 'h': round(h, 2), 'px': round(pv[0], 2), 'py': round(pv[1], 2)}
        if p in ('upper', 'fore', 'thigh', 'shin', 'foot', 'fu', 'fl', 'hu', 'hl'):
            rel_d = f'parts/{name}_{key}_d.webp'
            pa.save(darker(im), rel_d)
            parts[key + '_d'] = dict(parts[key], f='assets/' + rel_d)
    return parts


def build_rig(name, cfg):
    H = cfg['h']
    sh = Sheet(name, cfg)
    g = scale_person(sh, H)
    piv = person_pivots(sh)
    joints = build_person(sh, H, piv)
    if cfg.get('horse'):
        joints['horse'] = build_horse(sh, H, piv)
    parts = save_parts(name, sh, piv)
    leg = -joints['hip'][1] / H
    print(f"{name}: {len(parts)} bo'lak, bo'yi {H}, oyoq ulushi {leg:.2f}, varaq masshtabi {g:.3f}")
    return {'h': H, 'parts': parts, 'joints': joints}


def build_rigs(meta, only=None):
    meta.setdefault('rigs', {})
    for name, cfg in RIGS.items():
        if only and name not in only:
            continue
        meta['rigs'][name] = build_rig(name, cfg)


def write_preview(meta):
    """Har bir skelet: bo'laklar yonma-yon, burilish nuqtalari bilan."""
    rows = []
    for name, rig in meta['rigs'].items():
        ims = []
        for p, m in rig['parts'].items():
            if p.endswith('_d'):
                continue
            im = Image.open(os.path.join(pa.ROOT, 'public', m['f'])).convert('RGBA')
            s = 2.2
            im = im.resize((int(m['w'] * 3 * s), int(m['h'] * 3 * s)), Image.LANCZOS)
            bg = Image.new('RGBA', (im.width + 8, im.height + 8), (70, 150, 70, 255))
            bg.alpha_composite(im, (4, 4))
            d = ImageDraw.Draw(bg)
            x, y = m['px'] * 3 * s + 4, m['py'] * 3 * s + 4
            d.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(255, 0, 0, 255), width=2)
            ims.append(bg)
        w = sum(i.width for i in ims) + 6 * len(ims)
        h = max(i.height for i in ims)
        row = Image.new('RGBA', (w, h + 14), (30, 30, 30, 255))
        ImageDraw.Draw(row).text((4, 0), name, fill=(255, 255, 255, 255))
        x = 0
        for i in ims:
            row.alpha_composite(i, (x, 14))
            x += i.width + 6
        rows.append(row)
    W = max(r.width for r in rows)
    sheet = Image.new('RGBA', (W, sum(r.height for r in rows)), (30, 30, 30, 255))
    y = 0
    for r in rows:
        sheet.alpha_composite(r, (0, y))
        y += r.height
    os.makedirs(os.path.join(pa.ROOT, 'scratch'), exist_ok=True)
    sheet.convert('RGB').save(os.path.join(pa.ROOT, 'scratch', 'parts_preview.png'))
    print('scratch/parts_preview.png yozildi')


def main():
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    with open(pa.META, encoding='utf-8') as f:
        meta = json.load(f)
    build_rigs(meta, only)
    with open(pa.META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print('src/assets.json yangilandi (rigs)')
    if '--preview' in sys.argv:
        write_preview(meta)


if __name__ == '__main__':
    main()
