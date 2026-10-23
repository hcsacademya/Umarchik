#!/usr/bin/env python3
"""Bo'yalgan shablondan askar bo'laklarini kesadi va o'yin uchun atlas yasaydi.

  python3 tools/kesish.py                         (art/askar/qilichli_varaq.webp dan)
  python3 tools/kesish.py rasm.webp qilichli

Natija: public/assets/askar/<tur>.webp (atlas), src/askar.json (har bo'lakning atlasdagi joyi, aylanish nuqtasi,
bo'g'imlari), art/askar/<tur>_yigilgan.png (tekshirish uchun yig'ilgan askar).

Kod bo'laklarni to'g'rilamaydi: o'lchamlari ChatGPT chizganicha qoladi, bo'g'im nuqtalari esa har bo'lakning
o'zidan olinadi (shablondagi nuqta shu bo'lakning chizilgan o'lchamiga ko'chiriladi). Shuning uchun suyak
uzunliklari rasmdagi kiyimga aynan mos keladi.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
import shablon  # noqa: E402

ROOT = shablon.ROOT
T_ATLAS = 200  # atlasdagi askar bo'yi (tovondan bosh tepasigacha), piksel
MIRROR = {'etak_orqa': 'etak_old'}  # orqa etak — old etakning ko'zgudagi aksi (o'lchami aynan bir xil)
# har bo'lakda qaysi nuqtalar kerak: bo'g'imlar (shablon.JOINTS) yoki shu yerdagi qo'shimcha nuqtalar (T ulushida)
POINTS = {
    'gavda': ['neck', 'shoulder', 'clasp', 'belt'],
    'son': ['knee'],
    'yeng': ['elbow'],
    'bilak': ['fist'],
    'etik': [('heel', (-0.048, 0.0)), ('toe', (0.14, 0.0))],
}


def key(rgb):
    """Pushti fondan ajratish: shaffoflik va fon rangi aralashmagan rang."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    t = np.clip((np.minimum(r, b) - g) / 255.0, 0, 1)  # qanchalik pushti
    alpha = np.clip((1 - t - 0.12) / 0.76, 0, 1)  # fon shovqini to'liq shaffof, kiyim to'liq ko'rinadi
    # popuk kabi ingichka chetlar fon bilan aralashib pushti bo'lib qoladi; varaqdagi ranglarda pushti yo'q, shuning
    # uchun chetdagi pushti tusli joylar tilla (popuk) rangiga qaytariladi. Qizil hoshiya ichkarida — unga tegmaydi
    edge = ndimage.distance_transform_edt(alpha >= 0.5) <= 8
    hsv = np.asarray(Image.fromarray(rgb.astype(np.uint8)).convert('HSV')).astype(int)
    pink = edge & (alpha > 0) & (hsv[..., 0] >= 200) & (hsv[..., 0] <= 252) & (hsv[..., 1] > 25)
    hsv[..., 0][pink] = 27
    hsv[..., 1][pink] = np.minimum(hsv[..., 1][pink], 150)
    out = rgb.copy()
    out[pink] = np.asarray(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB')).astype(float)[pink]
    print(f"popukdagi pushti tus tozalandi: {int(pink.sum())} piksel")
    spill = np.clip(np.minimum(out[..., 0], out[..., 2]) - out[..., 1], 0, None)  # qolgan pushti tus
    out[..., 0] -= spill
    out[..., 2] -= spill
    # yarim shaffof chetlar: rangi eng yaqin to'liq ko'rinadigan joydan olinadi (pushti hoshiya qolmaydi)
    solid = alpha >= 0.99
    idx = ndimage.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    return np.clip(out[idx[0], idx[1]], 0, 255), alpha


def fit(tpl, comps, k):
    """Butun varaq qanchalik cho'zilgan/surilgan: shablon -> rasm (har o'q alohida), bo'laklar mosligi."""
    sx = sy = k
    tx = ty = 0.0
    for _ in range(4):
        match = {}
        for pid, b in tpl.items():
            cx = sx * (b['box'][0] + b['box'][2]) / 2 + tx
            cy = sy * (b['box'][1] + b['box'][3]) / 2 + ty
            match[pid] = min(range(len(comps)), key=lambda i: math.hypot(
                (comps[i][0] + comps[i][2]) / 2 - cx, (comps[i][1] + comps[i][3]) / 2 - cy))
        xs = np.array([[tpl[p]['box'][k], comps[match[p]][k]] for p in tpl for k in (0, 2)], float)
        ys = np.array([[tpl[p]['box'][k], comps[match[p]][k]] for p in tpl for k in (1, 3)], float)
        sx, tx = np.polyfit(xs[:, 0], xs[:, 1], 1)
        sy, ty = np.polyfit(ys[:, 0], ys[:, 1], 1)
    return match, sx, sy


def premul_resize(img, k):
    w, h = max(1, round(img.width * k)), max(1, round(img.height * k))
    return img.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')


def pack(pieces, pad=2, width=512):
    """Oddiy qatorlab joylash: [(id, rasm)] -> atlas, {id: (x, y)}."""
    order = sorted(pieces, key=lambda kv: -kv[1].height)
    x = y = row = 0
    pos = {}
    for pid, img in order:
        if x + img.width + pad > width:
            x, y, row = 0, y + row + pad, 0
        pos[pid] = (x, y)
        x += img.width + pad
        row = max(row, img.height)
    atlas = Image.new('RGBA', (width, y + row), (0, 0, 0, 0))
    for pid, img in pieces:
        atlas.paste(img, pos[pid])
    return atlas, pos


def cut(path, unit):
    meta = json.loads((shablon.OUT / f'{unit}.json').read_text(encoding='utf-8'))
    tpl = meta['pieces']
    defs = {p['id']: p for p in shablon.BODY + shablon.UNITS[unit]['pieces']}
    src = Image.open(path).convert('RGB')
    k = src.width / shablon.SIZE  # shablon pikselidan rasm pikseliga (taxminan)
    rgb, alpha = key(np.asarray(src).astype(float))

    lab, _ = ndimage.label(ndimage.binary_dilation(alpha > 0.5, iterations=max(2, round(5 * k))))
    comps, labels = [], []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        ys, xs = np.nonzero((alpha[sl] > 0.5) & (lab[sl] == i + 1))
        if len(xs) > 1500 * k * k:
            comps.append((xs.min() + sl[1].start, ys.min() + sl[0].start,
                          xs.max() + 1 + sl[1].start, ys.max() + 1 + sl[0].start))
            labels.append(i + 1)
    match, sx, sy = fit(tpl, comps, k)
    out_k = T_ATLAS / (shablon.T * sy)  # rasm pikselidan atlas pikseliga: bo'y bo'yicha, eni o'z holicha qoladi
    print(f"varaq: shablonga nisbatan eniga {sx / k:.2f}, bo'yiga {sy / k:.2f} barobar")

    cut_pieces, info = {}, {}
    for pid, b in tpl.items():
        if pid in MIRROR:
            continue
        ci = match[pid]
        x0, y0, x1, y1 = comps[ci]
        m = 3
        cx0, cy0 = max(0, x0 - m), max(0, y0 - m)
        cx1, cy1 = min(src.width, x1 + m), min(src.height, y1 + m)
        a = alpha[cy0:cy1, cx0:cx1] * (lab[cy0:cy1, cx0:cx1] == labels[ci])
        rgba = np.dstack([rgb[cy0:cy1, cx0:cx1], a * 255]).round().astype(np.uint8)
        img = premul_resize(Image.fromarray(rgba, 'RGBA'), out_k)
        # shablon nuqtasi -> shu bo'lakning chizilgan o'lchamidagi nuqta -> atlas pikseli
        tx0, ty0, tx1, ty1 = b['box']
        kx, ky = (x1 - x0) / (tx1 - tx0), (y1 - y0) / (ty1 - ty0)

        def to_piece(X, Y):
            return [round(((x0 + (X - tx0) * kx) - cx0) * out_k, 1), round(((y0 + (Y - ty0) * ky) - cy0) * out_k, 1)]

        pjx, pjh = shablon.JOINTS[defs[pid]['joint']]
        pvx, pvy = b['pivot']

        def tpl_point(x, h):
            return pvx + (x - pjx) * shablon.T, pvy - (h - pjh) * shablon.T

        p = to_piece(pvx, pvy)
        joints = {}
        for spec in POINTS.get(pid, []):
            name, (x, h) = (spec, shablon.JOINTS[spec]) if isinstance(spec, str) else spec
            q = to_piece(*tpl_point(x, h))
            joints[name] = [round(q[0] - p[0], 1), round(q[1] - p[1], 1)]
        cut_pieces[pid] = img
        info[pid] = dict(p=p, j=joints)
        print(f"  {pid:9s} {img.width:3d}x{img.height:<3d} bo'yi qolganlarga nisbatan {ky / sy - 1:+.0%}")
    for pid, srcid in MIRROR.items():
        cut_pieces[pid] = cut_pieces[srcid].transpose(Image.FLIP_LEFT_RIGHT)
        w = cut_pieces[pid].width
        info[pid] = dict(p=[round(w - info[srcid]['p'][0], 1), info[srcid]['p'][1]], j={})
        print(f"  {pid:9s} = {srcid} ning aksi")

    atlas, pos = pack(list(cut_pieces.items()))
    out_dir = ROOT / 'public' / 'assets' / 'askar'
    out_dir.mkdir(parents=True, exist_ok=True)
    atlas.save(out_dir / f'{unit}.webp', quality=92, alpha_quality=100, method=6)
    for pid, (x, y) in pos.items():
        img = cut_pieces[pid]
        info[pid] = dict(r=[x, y, img.width, img.height], **info[pid])
    meta_path = ROOT / 'src' / 'askar.json'
    allm = json.loads(meta_path.read_text(encoding='utf-8')) if meta_path.exists() else {}
    allm[unit] = dict(img=f'assets/askar/{unit}.webp', T=T_ATLAS, pieces=info, order=shablon.UNITS[unit]['order'])
    meta_path.write_text(json.dumps(allm, ensure_ascii=False, indent=1), encoding='utf-8')
    preview(unit, cut_pieces, info).save(ROOT / 'art' / 'askar' / f'{unit}_yigilgan.png')
    print(f"-> public/assets/askar/{unit}.webp ({atlas.width}x{atlas.height}), src/askar.json, "
          f"art/askar/{unit}_yigilgan.png")


def preview(unit, imgs, info):
    """Yig'ilgan askar: tik turgan va qadam tashlagan — kesish to'g'riligini ko'z bilan tekshirish uchun."""
    def rot(v, a):  # a — gradus, musbat: osilgan bo'lakning pastki uchi oldinga
        r = math.radians(a)
        return (v[0] * math.cos(r) + v[1] * math.sin(r), -v[0] * math.sin(r) + v[1] * math.cos(r))

    poses = [  # src/puppet.ts dagi pozalarga yaqin: turish, yurish, jangovar turish
        dict(gavda=-1.5, bosh=-0.8, plash=-4.5, qin=-23.5, etak_old=2.4, etak_orqa=-3.6, yeng=6, bilak=22,
             qilich=-128, yeng2=4, bilak2=16, son=5, etik=2, son2=-5, etik2=-7),
        dict(gavda=-3, bosh=-1.5, plash=-11, qin=-31, etak_old=13, etak_orqa=-12, yeng=-10, bilak=4, qilich=-146,
             yeng2=24, bilak2=42, son=22, etik=19, son2=-20, etik2=-60),
        dict(gavda=-6, bosh=-3, plash=-12, qin=-36, etak_old=8, etak_orqa=-12, yeng=40, bilak=105, qilich=-40,
             yeng2=22, bilak2=70, son=18, etik=6, son2=-16, etik2=-24),
    ]
    cells = []
    for pose in poses:
        a = lambda n: pose.get(n, 0)  # noqa: E731
        hip = (0.0, 0.0)
        J = info['gavda']['j']
        shoulder, neck, clasp, belt = (rot(J[n], a('gavda')) for n in ('shoulder', 'neck', 'clasp', 'belt'))
        items = {'gavda': (hip, a('gavda')), 'bosh': (neck, a('bosh')), 'plash': (clasp, a('plash')),
                 'qin2': (belt, a('qin')),
                 'etak_old': (hip, a('etak_old')), 'etak_orqa': (hip, a('etak_orqa'))}
        feet = []
        for s in ('', '2'):
            elbow = np.add(shoulder, rot(info['yeng']['j']['elbow'], a('yeng' + s)))
            fist = np.add(elbow, rot(info['bilak']['j']['fist'], a('bilak' + s)))
            knee = np.add(hip, rot(info['son']['j']['knee'], a('son' + s)))
            items['yeng' + s] = (shoulder, a('yeng' + s))
            items['bilak' + s] = (tuple(elbow), a('bilak' + s))
            items['son' + s] = (hip, a('son' + s))
            items['etik' + s] = (tuple(knee), a('etik' + s))
            feet += [np.add(knee, rot(info['etik']['j'][f], a('etik' + s)))[1] for f in ('heel', 'toe')]
            if not s:
                items['qilich'] = (tuple(fist), a('qilich'))
        W, H = 260, 300
        ground = H - 20
        lift = ground - max(feet)
        cell = Image.new('RGBA', (W, H), (240, 236, 228, 255))
        for k in shablon.UNITS[unit]['order']:
            (jx, jy), ang = items[k]
            img = imgs[k.rstrip('2')]
            px, py = info[k.rstrip('2')]['p']
            r = math.ceil(max(math.hypot(x - px, y - py) for x in (0, img.width) for y in (0, img.height))) + 2
            c = Image.new('RGBA', (2 * r, 2 * r), (0, 0, 0, 0))
            c.paste(img, (round(r - px), round(r - py)))
            c = c.rotate(ang, resample=Image.BICUBIC)
            if k.endswith('2'):
                arr = np.array(c)
                arr[..., :3] = (arr[..., :3] * 0.72).astype(np.uint8)
                c = Image.fromarray(arr)
            cell.alpha_composite(c, (round(W / 2 + jx - r), round(lift + jy - r)))
        cells.append(cell)
    out = Image.new('RGBA', (sum(c.width for c in cells), cells[0].height))
    for i, c in enumerate(cells):
        out.paste(c, (i * c.width, 0))
    return out.convert('RGB').resize((out.width * 2, out.height * 2), Image.LANCZOS)


if __name__ == '__main__':
    args = sys.argv[1:]
    cut(args[0] if args else ROOT / 'art' / 'askar' / 'qilichli_varaq.webp', args[1] if len(args) > 1 else 'qilichli')
