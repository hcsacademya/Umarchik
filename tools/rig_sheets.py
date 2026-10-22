"""
Skelet animatsiya bo'laklarini "qismlar varag'i"dan (art/qismlar_*.webp) kesib oladi:
  - fonni olib tashlaydi, varaqdagi alohida bo'laklarni topadi (qatorlar bo'yicha, chapdan o'ngga),
  - har bir bo'lakni o'yin o'lchamiga keltiradi (jangchining bo'yi — GAME_H),
  - burilish nuqtalarini (yelka, tirsak, son, tizza ...) bo'lak shaklidan topadi,
  - orqadagi qo'l va oyoq uchun qorong'i nusxasini yasaydi (_d),
  - public/assets/parts/ ga yozadi, src/assets.json ning "rigs" bo'limini to'ldiradi.
Dushman varaqlarida har xalq bir necha qatorga takrorlangan: faqat birinchi nusxasi olinadi.

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

# Bo'laklarning jangchi bo'yiga nisbati (bo'lak balandligi / jangchi bo'yi)
BODY_FRAC = {'head': 0.19, 'torso': 0.43, 'upper': 0.19, 'fore': 0.19, 'thigh': 0.26, 'shin': 0.33}

# Bo'laklarni varaqda topish tartibi (qatorlar bo'yicha, chapdan o'ngga)
ORDER_SWORD = ['head', 'torso', 'shield', 'upper', 'fore', 'thigh', 'shin', 'weapon']
ORDER_ARCHER = ['head', 'torso', 'quiver', 'upper', 'fore', 'thigh', 'shin', 'weapon', 'arrow']

# nom: varaq, nechta qator (3x3 varaq) yoki guruh (dushman varag'i: 0 — tepadagi xalq, 2 — pastdagi), tartib,
# bo'yi, kalitlar. "pivot" — qo'lda belgilangan burilish nuqtalari (bo'lak bo'yi/kengligiga nisbatan, 0..1);
# yozilmagan nuqtalar bo'lak shaklidan avtomatik topiladi.
RIGS = {
    'amir': {
        'sheet': 'qismlar_amir.webp', 'rows': 3, 'h': 84,
        'order': ['head', 'torso', 'cape', 'upper', 'fore', 'thigh', 'shin', 'weapon'],
        'pivot': {'head': (0.62, 0.86), 'cape': (0.56, 0.08), 'weapon': (0.075, 0.42)},
        'shoulder': (0.40, 0.10), 'hip_fy': 0.60, 'wscale': {'weapon': 0.62},
        'attach': {'cape': (0.52, 0.05)},
    },
    'qilichli': {
        'sheet': 'qismlar_qilichli.webp', 'rows': 3, 'h': 79, 'order': ORDER_SWORD,
        'pivot': {'head': (0.60, 0.88), 'weapon': (0.09, 0.5)},
        'shoulder': (0.45, 0.10), 'hip_fy': 0.60, 'wscale': {'weapon': 0.8},
    },
    'nayzachi': {
        'sheet': 'qismlar_nayzachi.webp', 'rows': 3, 'h': 79, 'order': ORDER_SWORD,
        'pivot': {'head': (0.58, 0.88), 'weapon': (0.30, 0.5)},
        'shoulder': (0.45, 0.10), 'hip_fy': 0.60, 'wscale': {'weapon': 0.85},
    },
    'kamonchi': {
        'sheet': 'qismlar_kamonchi.webp', 'rows': 3, 'h': 79, 'order': ORDER_ARCHER,
        'pivot': {'head': (0.58, 0.86), 'quiver': (0.5, 0.25), 'weapon': (0.5, 0.5), 'arrow': (0.05, 0.5)},
        'shoulder': (0.45, 0.10), 'hip_fy': 0.60, 'wscale': {'weapon': 0.9, 'arrow': 0.9},
        'attach': {'quiver': (0.22, 0.30)},
    },
    'konchi': {
        'sheet': 'qismlar_konchi.webp', 'rows': 3, 'h': 75,
        'order': ['head', 'torso', 'upper', 'fore', 'thigh', 'shin', 'weapon', 'basket', 'basketfull'],
        'pivot': {'head': (0.55, 0.88), 'weapon': (0.25, 0.5), 'basket': (0.55, 0.30), 'basketfull': (0.55, 0.30)},
        'shoulder': (0.45, 0.10), 'hip_fy': 0.60, 'wscale': {'weapon': 0.9, 'basket': 0.85, 'basketfull': 0.85},
        'attach': {'basket': (0.18, 0.34)},
    },
}

# Dushman: ko'chmanchi va sovutli
FACTIONS = {
    'kochmanchi_qilichli': ('qismlar_dushman_qilichli_kochmanchi.webp', 0, ORDER_SWORD),
    'sovutli_qilichli': ('qismlar_dushman_qilichli_sovutli.webp', 2, ORDER_SWORD),
    'kochmanchi_nayzachi': ('qismlar_dushman_nayzachi.webp', 0, ORDER_SWORD),
    'sovutli_nayzachi': ('qismlar_dushman_nayzachi.webp', 2, ORDER_SWORD),
    'kochmanchi_kamonchi': ('qismlar_dushman_kamonchi.webp', 0, ORDER_ARCHER),
    'sovutli_kamonchi': ('qismlar_dushman_kamonchi.webp', 2, ORDER_ARCHER),
}
for _name, (_sheet, _group, _order) in FACTIONS.items():
    _base = RIGS[_name.split('_', 1)[1]]
    RIGS[_name] = {
        'sheet': _sheet, 'group': _group, 'h': 79, 'order': _order,
        'pivot': dict(_base['pivot'], head=(0.52, 0.86)),
        'shoulder': (0.42, 0.10), 'hip_fy': 0.60, 'wscale': _base['wscale'],
        'attach': _base.get('attach', {}),
    }
RIGS['kochmanchi_qilichli']['pivot']['weapon'] = (0.075, 0.42)  # egri qilich dastasi
RIGS['kochmanchi_qilichli']['wscale'] = {'weapon': 0.62}


def find_components(rgba, rows=None, group=None):
    """Varaqdagi bo'laklar: har biri uchun (niqob, bbox). Tartib: qatorlar, qator ichida chapdan o'ngga."""
    solid = rgba[..., 3] > 40
    lab, _ = ndi.label(ndi.binary_dilation(solid, iterations=7))
    comps = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        m = (lab[sl] == i) & (rgba[sl][..., 3] > 8)
        if (rgba[sl][..., 3][lab[sl] == i] > 40).sum() < 150:
            continue
        ys, xs = np.nonzero(m)
        comps.append({
            'sl': sl, 'mask': m,
            'x0': sl[1].start + xs.min(), 'x1': sl[1].start + xs.max() + 1,
            'y0': sl[0].start + ys.min(), 'y1': sl[0].start + ys.max() + 1,
            'cx': sl[1].start + xs.mean(), 'cy': sl[0].start + ys.mean(),
        })
    # tik bo'laklar (kamon) qator oralig'ida yopishib qolgan nusxalar bilan birga topilishi mumkin: birinchisini olamiz
    for c in comps:
        if c['y1'] - c['y0'] > 330:
            rows_on = (rgba[c['sl']][..., 3] > 40) & c['mask']
            empty = np.nonzero(~rows_on.any(axis=1))[0]
            gaps = empty[empty > 100]
            if len(gaps):
                cut = int(gaps[0])
                c['mask'] = c['mask'].copy()
                c['mask'][cut:] = False
                ys, xs = np.nonzero(c['mask'])
                c['y1'] = c['sl'][0].start + ys.max() + 1
                c['cy'] = c['sl'][0].start + ys.mean()
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


def darker(im):
    a = np.asarray(im).astype(np.float32)
    a[..., :3] *= DARK
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def build_rig(name, cfg):
    rgb = pa.load(cfg['sheet'])
    rgba = pa.remove_bg(rgb)
    comps = find_components(rgba, cfg.get('rows'), cfg.get('group'))
    order = cfg['order']
    if len(comps) != len(order):
        raise RuntimeError(f'{name}: {len(order)} ta bo\'lak kutilgandi, {len(comps)} ta topildi')
    pieces = {p: part_rgba(rgba, c) for p, c in zip(order, comps)}
    H = cfg['h']

    # 1) har bir tana bo'lagining masshtabi: balandligi jangchi bo'yining belgilangan ulushi
    sf = {p: BODY_FRAC[p] * H / pieces[p].shape[0] for p in BODY_FRAC}
    # 2) qurol-yarog' tana masshtabida (qo'shimcha ko'paytma bilan)
    for p in pieces:
        if p not in sf:
            sf[p] = sf['torso'] * cfg['wscale'].get(p, 1.0)
    # 3) butun jangchi bo'yi H bo'lishi uchun: oyoq tagidan bosh tepasigacha yig'ib o'lchaymiz, so'ng tuzatamiz
    def units(p):
        return pieces[p].shape[1] * sf[p], pieces[p].shape[0] * sf[p]

    def pivot_of(p):
        w, h = units(p)
        pv = cfg['pivot'].get(p)
        if pv:
            return pv[0] * w, pv[1] * h
        pc = pieces[p]
        top_x = row_center(pc, 0, max(2, pc.shape[0] * 0.05)) * w
        return top_x, 0.03 * h

    def tip_of(p, fy=0.95):
        """Bo'lakning pastki uchi (tirsak, tizza, qo'l): pastki qatorlar markazi."""
        pc = pieces[p]
        w, h = units(p)
        return row_center(pc, pc.shape[0] * 0.93, pc.shape[0]) * w, fy * h

    shin_w, shin_h = units('shin')
    shin_pv = pivot_of('shin')
    knee_h = shin_h - shin_pv[1]  # tizzadan oyoq tagigacha
    thigh_pv = pivot_of('thigh')
    thigh_tip = tip_of('thigh')
    thigh_len = thigh_tip[1] - thigh_pv[1]
    hip_y = knee_h + thigh_len  # sondan oyoq tagigacha
    tw, th = units('torso')
    hip_fy = cfg['hip_fy']
    torso_hip = (row_center(pieces['torso'], pieces['torso'].shape[0] * (hip_fy - 0.03), pieces['torso'].shape[0] * (hip_fy + 0.03)) * tw, hip_fy * th)
    torso_neck = (row_center(pieces['torso'], 0, max(2, pieces['torso'].shape[0] * 0.04)) * tw, 0.02 * th)
    head_pv = pivot_of('head')
    hw, hh = units('head')
    # bosh tepasi: bo'yin nuqtasidan yuqorida shuncha
    top_above_hip = (torso_hip[1] - torso_neck[1]) + head_pv[1]
    total = hip_y + top_above_hip
    k = H / total
    sf = {p: v * k for p, v in sf.items()}

    # masshtab o'zgargach hamma o'lchamni qaytadan hisoblaymiz
    shin_w, shin_h = units('shin')
    shin_pv = pivot_of('shin')
    knee_h = shin_h - shin_pv[1]
    thigh_pv = pivot_of('thigh')
    thigh_tip = tip_of('thigh')
    hip_y = knee_h + thigh_tip[1] - thigh_pv[1]
    tw, th = units('torso')
    torso_hip = (row_center(pieces['torso'], pieces['torso'].shape[0] * (hip_fy - 0.03), pieces['torso'].shape[0] * (hip_fy + 0.03)) * tw, hip_fy * th)
    torso_neck = (row_center(pieces['torso'], 0, max(2, pieces['torso'].shape[0] * 0.04)) * tw, 0.02 * th)
    sh_fx, sh_fy = cfg['shoulder']
    torso_sh = (sh_fx * tw, sh_fy * th)

    out_dir = os.path.join(pa.OUT, 'parts')
    os.makedirs(out_dir, exist_ok=True)
    parts = {}
    for p, pc in pieces.items():
        w, h = units(p)
        pv = pivot_of(p) if p != 'torso' else torso_hip
        im = pa.resize(pc, sf[p] * PX_PER_UNIT)
        rel = f'parts/{name}_{p}.webp'
        pa.save(im, rel)
        parts[p] = {'f': 'assets/' + rel, 'w': round(w, 2), 'h': round(h, 2), 'px': round(pv[0], 2), 'py': round(pv[1], 2)}
        if p in ('upper', 'fore', 'thigh', 'shin'):
            rel_d = f'parts/{name}_{p}_d.webp'
            pa.save(darker(im), rel_d)
            parts[p + '_d'] = dict(parts[p], f='assets/' + rel_d)

    def sub(a, b):
        return [round(a[0] - b[0], 2), round(a[1] - b[1], 2)]

    up_tip = tip_of('upper')
    fo_pv = pivot_of('fore')
    fo_tip = tip_of('fore', 0.90)
    # tirsak — yuqori qo'l pastki uchi (yelkaga nisbatan); qo'l tutqichi — bilak pastki uchi (tirsakka nisbatan)
    joints = {
        'hip': [0.0, round(-hip_y, 2)],
        'neck': sub(torso_neck, torso_hip),
        'shoulder': sub(torso_sh, torso_hip),
        'shoulderFar': [round(torso_sh[0] - torso_hip[0] + 0.05 * tw, 2), round(torso_sh[1] - torso_hip[1] + 0.01 * th, 2)],
        'hipBack': [-1.2, 0.0],
        'hipFront': [1.2, 0.0],
        'elbow': sub(up_tip, pivot_of('upper')),
        'hand': sub(fo_tip, fo_pv),
        'knee': sub(thigh_tip, thigh_pv),
        'foot': round(shin_h - shin_pv[1], 2),
    }
    for item, (fx, fy) in cfg.get('attach', {}).items():
        joints[item] = sub((fx * tw, fy * th), torso_hip)
    print(f'{name}: {len(parts)} bo\'lak, bo\'yi {H}, kattalashtirish {k:.3f}')
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
