#!/usr/bin/env python3
"""Askar shabloni — bo'laklarga ajratilgan qo'g'irchoq (bo'lakli animatsiya uchun).

ChatGPT kiyimni shu shablon ustiga bo'yaydi: bo'laklarning o'lchami, joyi va bo'g'imlari shu yerda
belgilanadi, rasm chizuvchida emas. Shuning uchun bo'laklar yig'ilganda bir-biriga aniq mos keladi.

  python3 tools/shablon.py                     -> art/shablon/qilichli.png, .json, _pozalar.png
  python3 tools/shablon.py --tekshir rasm.png  -> bo'yalgan varaq shablonga qanchalik mos (har bo'lak bo'yicha)

Ranglar: kulrang — kiyim, to'q kulrang — yashirin uch (qo'shni bo'lak ostida qoladi), qora — teri,
oqish — temir. Bo'g'imdagi pastki bo'lakning uchi yarim doira, aylanish nuqtasi — shu doira markazi;
yuqori bo'lak shu doirani to'liq yopadi, shuning uchun qo'l-oyoq qanday bukilsa ham tirqish ochilmaydi.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'art' / 'shablon'

SIZE = 1024  # varaq (ChatGPT ning kvadrat rasmi bilan bir xil)
T = 640  # tik turgan askar bo'yi, piksel: tovondan bosh tepasigacha
GAP = 18  # bo'laklar orasidagi eng kam bo'sh joy
PAD = 4  # bo'lak rasmi chetidagi zaxira (chiziq uchun)

BG = (255, 0, 255)
LINE = (58, 58, 58)
FILL = {
    'kiyim': (189, 189, 189),
    'yashirin': (122, 122, 122),
    'teri': (20, 20, 20),
    'temir': (225, 225, 225),
}
DARK = 0.72  # uzoqdagi qo'l-oyoq shunchalik qoraytiriladi

# Bo'g'imlar tik turishda, T ulushida: x — oldinga (o'ngga), h — yerdan yuqoriga
JOINTS = {
    'neck': (0.01, 0.86),
    'shoulder': (0.005, 0.82),
    'elbow': (0.005, 0.63),
    'fist': (0.012, 0.45),
    'hip': (0.0, 0.52),
    'knee': (0.0, 0.285),
    'clasp': (-0.01, 0.845),
    'belt': (-0.035, 0.555),
}


def arc(cx, ch, rx, rh, a0, a1, n=28):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             ch + rh * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def cap(joint, r):
    # pastki bo'lakning yashirin uchi: bo'g'im ustidagi yarim doira
    x, h = JOINTS[joint]
    return arc(x, h, r, r, 0, 180)


def curve(x0, h0, length, bend, w0, w1, n=30):
    # egri tig' yoki qin: o'q chizig'i h bo'ylab (length manfiy — pastga), uchi bend qadar egiladi
    back, front = [], []
    for i in range(n + 1):
        t = i / n
        cx = x0 + bend * t * t
        ch = h0 + length * t
        w = w0 + (w1 - w0) * t ** 0.8
        back.append((cx - w, ch))
        front.append((cx + w, ch))
    return back + front[::-1]


# Har bir askarda bor bo'laklar
BODY = [
    dict(id='bosh', name="Bosh (qora bosh, bo'yin va bosh kiyim)", joint='neck', shapes=[
        ('teri', [(-0.022, 0.878), (0.032, 0.878), (0.03, 0.825), (-0.02, 0.825)]),
        ('teri', arc(0.01, 0.935, 0.065, 0.065, 0, 360)),
        ('kiyim', arc(0.0, 0.935, 0.085, 0.09, 8, 180) + [(-0.08, 0.9), (-0.03, 0.905), (0.04, 0.945)]),
    ]),
    dict(id='gavda', name="Gavda (yoqadan belbog' ostigacha)", joint='hip', shapes=[
        ('kiyim', [(-0.03, 0.868), (0.035, 0.868), (0.07, 0.83), (0.095, 0.76), (0.09, 0.68), (0.075, 0.56),
                   (0.08, 0.535), (-0.075, 0.535), (-0.07, 0.56), (-0.08, 0.70), (-0.08, 0.78), (-0.075, 0.83)]),
    ]),
    dict(id='son', name="Son (shim, tizzada burma)", joint='hip', shapes=[
        ('kiyim', arc(0.0, 0.52, 0.072, 0.072, 0, 180) + [(-0.083, 0.42), (-0.075, 0.30), (-0.06, 0.262),
                                                        (-0.06, 0.23), (0.06, 0.23), (0.06, 0.262), (0.08, 0.30),
                                                        (0.09, 0.42)]),
        ('yashirin', cap('hip', 0.072)),
    ]),
    dict(id='etik', name="Etik (tizzadan tovongacha)", joint='knee', shapes=[
        ('kiyim', arc(0.0, 0.285, 0.055, 0.055, 0, 180) + [(-0.062, 0.20), (-0.045, 0.075), (-0.05, 0.04),
                                                           (-0.048, 0.0), (0.14, 0.0), (0.146, 0.024),
                                                           (0.125, 0.045), (0.06, 0.062), (0.045, 0.085),
                                                           (0.05, 0.20)]),
        ('yashirin', cap('knee', 0.055)),
    ]),
    dict(id='yeng', name="Yeng (yelkadan tirsakkacha, pastida manjet)", joint='shoulder', shapes=[
        ('kiyim', arc(0.005, 0.82, 0.0425, 0.0425, 0, 180) + [(-0.04, 0.645), (-0.05, 0.635), (-0.05, 0.595),
                                                              (0.06, 0.595), (0.06, 0.635), (0.05, 0.645)]),
    ]),
    dict(id='bilak', name="Bilak va musht", joint='elbow', shapes=[
        ('teri', arc(0.012, 0.45, 0.04, 0.045, 0, 360)),
        ('kiyim', arc(0.005, 0.63, 0.035, 0.035, 0, 180) + [(-0.028, 0.485), (0.038, 0.485)]),
        ('yashirin', cap('elbow', 0.035)),
    ]),
]

# Tur bo'yicha qo'shimcha bo'laklar va varaqdagi joylashuv: (tayanch x, tepa y, ustundagi bo'laklar)
UNITS = {
    'qilichli': dict(
        pieces=[
            dict(id='etak_old', name="Etakning old yarmi", joint='hip', shapes=[
                ('kiyim', [(-0.015, 0.58), (0.062, 0.58), (0.135, 0.31), (-0.022, 0.31)]),
                ('band', (0.545, 0.58)),
            ]),
            dict(id='etak_orqa', name="Etakning orqa yarmi", joint='hip', shapes=[
                ('kiyim', [(-0.062, 0.58), (0.015, 0.58), (0.022, 0.31), (-0.135, 0.31)]),
                ('band', (0.545, 0.58)),
            ]),
            dict(id='plash', name="Plash (yelka to'g'nag'ichidan)", joint='clasp', shapes=[
                ('kiyim', [(-0.065, 0.865), (0.03, 0.865), (0.04, 0.83), (-0.035, 0.62), (-0.03, 0.18),
                           (-0.215, 0.17), (-0.17, 0.55), (-0.095, 0.79)]),
                ('temir', arc(-0.01, 0.845, 0.013, 0.013, 0, 360)),
            ]),
            dict(id='qilich', name="Qilich (tig'i yuqorida)", joint='fist', shapes=[
                ('temir', arc(0.012, 0.408, 0.011, 0.011, 0, 360)),
                ('kiyim', [(0.004, 0.415), (0.02, 0.415), (0.02, 0.484), (0.004, 0.484)]),
                ('temir', [(-0.026, 0.483), (0.05, 0.483), (0.046, 0.495), (-0.022, 0.495)]),
                ('temir', curve(0.012, 0.494, 0.356, 0.07, 0.0125, 0.0012)),
            ]),
            dict(id='qin', name="Qin (bo'sh)", joint='belt', shapes=[
                ('kiyim', curve(-0.035, 0.555, -0.395, -0.07, 0.016, 0.009)),
                ('temir', [(-0.052, 0.555), (-0.018, 0.555), (-0.018, 0.53), (-0.052, 0.53)]),
            ]),
        ],
        layout=[
            (165, 200, ['plash']),
            (320, 250, ['etak_old', 'etak_orqa']),
            (510, 30, ['bosh', 'gavda', 'son', 'etik']),
            (690, 205, ['yeng', 'bilak']),
            (850, 60, ['qilich', 'qin']),
        ],
        # yig'ishda chizish tartibi (orqadan oldinga); "2" — uzoqdagi qo'l-oyoq (o'sha bo'lak, qoraytirilgan)
        # qin chap sonda — tananing narigi tomonida, shuning uchun u ham "2"
        order=['plash', 'qin2', 'bilak2', 'yeng2', 'etik2', 'son2', 'etik', 'son', 'etak_orqa', 'etak_old', 'bosh',
               'gavda', 'qilich', 'bilak', 'yeng'],
    ),
}


def render_piece(p):
    """Bo'lakni o'z rasmiga chizadi: (RGBA massiv, tayanch nuqta pikselda)."""
    pts = [pt for kind, s in p['shapes'] if kind != 'band' for pt in s]
    minx = min(x for x, _ in pts)
    maxh = max(h for _, h in pts)
    w = math.ceil((max(x for x, _ in pts) - minx) * T) + 2 * PAD
    hh = math.ceil((maxh - min(h for _, h in pts)) * T) + 2 * PAD

    def px(x, h):
        return ((x - minx) * T + PAD, (maxh - h) * T + PAD)

    img = Image.new('RGBA', (w, hh), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for kind, s in p['shapes']:
        if kind != 'band':
            d.polygon([px(x, h) for x, h in s], fill=FILL[kind] + (255,))
    a = np.array(img)
    for kind, s in p['shapes']:
        if kind == 'band':  # bo'lakning shu balandlikdagi kiyim qismi yashirin
            y0, y1 = round(px(0, s[1])[1]), round(px(0, s[0])[1])
            band = a[y0:y1]
            band[(band[..., :3] == FILL['kiyim']).all(-1)] = FILL['yashirin'] + (255,)
    mask = a[..., 3] > 0
    edge = ndimage.binary_dilation(mask, iterations=2) & ~mask
    a[edge] = LINE + (255,)
    jx, jh = JOINTS[p['joint']]
    return a, px(jx, jh)


def build_template(unit):
    cfg = UNITS[unit]
    pieces = {p['id']: p for p in BODY + cfg['pieces']}
    sheet = np.zeros((SIZE, SIZE, 4), np.uint8)
    sheet[..., :3] = BG
    sheet[..., 3] = 255
    out = {}
    for col_x, top, ids in cfg['layout']:
        y = top
        for pid in ids:
            a, (pvx, pvy) = render_piece(pieces[pid])
            x0 = round(col_x - pvx)
            h, w = a.shape[:2]
            assert x0 >= 8 and y >= 8 and x0 + w <= SIZE - 8 and y + h <= SIZE - 8, f"{pid} varaqdan chiqdi"
            m = a[..., 3] > 0
            sheet[y:y + h, x0:x0 + w][m] = a[m]
            ys, xs = np.nonzero(m)
            out[pid] = dict(name=pieces[pid]['name'], joint=pieces[pid]['joint'],
                            box=[int(x0 + xs.min()), int(y + ys.min()), int(x0 + xs.max() + 1), int(y + ys.max() + 1)],
                            pivot=[round(x0 + pvx, 1), round(y + pvy, 1)])
            y += h + 28
    boxes = list(out.items())
    for i, (ia, a) in enumerate(boxes):
        for ib, b in boxes[i + 1:]:
            ax0, ay0, ax1, ay1 = a['box']
            bx0, by0, bx1, by1 = b['box']
            gap = max(bx0 - ax1, ax0 - bx1, by0 - ay1, ay0 - by1)
            assert gap >= GAP, f"{ia} va {ib} juda yaqin ({gap}px)"
    return Image.fromarray(sheet[..., :3]), out, pieces


def rot(v, deg):
    a = math.radians(deg)
    return (v[0] * math.cos(a) - v[1] * math.sin(a), v[0] * math.sin(a) + v[1] * math.cos(a))


def vadd(a, b):
    return (a[0] + b[0], a[1] + b[1])


def vsub(a, b):
    return (a[0] - b[0], a[1] - b[1])


# Sinov pozalari (burchak — gradus, soat millariga qarshi; qo'l-oyoq osilib turgani 0)
POSES = {
    'turish': dict(qilich=-160, qin=-25),
    'yurish': dict(son=28, etik=18, son2=-22, etik2=-57, etak_old=14, etak_orqa=-11,
                   yeng=-22, bilak=-2, yeng2=25, bilak2=50, qilich=-170, qin=-30, plash=-6),
    'zarba': dict(son=35, etik=-5, son2=-25, etik2=-30, etak_old=17, etak_orqa=-12,
                  yeng=150, bilak=195, yeng2=40, bilak2=85, qilich=40, qin=-35, plash=-10),
}


def pose_items(pose):
    """Har bo'lak uchun: (bo'lak, bo'g'imning dunyodagi joyi, burchak, qoraytirilganmi)."""
    a = lambda k: pose.get(k, 0)  # noqa: E731
    J = JOINTS
    items = {
        'bosh': ('bosh', J['neck'], 0, False),
        'gavda': ('gavda', J['hip'], 0, False),
        'plash': ('plash', J['clasp'], a('plash'), False),
        'qin2': ('qin', J['belt'], a('qin'), True),
        'etak_old': ('etak_old', J['hip'], a('etak_old'), False),
        'etak_orqa': ('etak_orqa', J['hip'], a('etak_orqa'), False),
    }
    for sfx, dark in (('', False), ('2', True)):
        elbow = vadd(J['shoulder'], rot(vsub(J['elbow'], J['shoulder']), a('yeng' + sfx)))
        fist = vadd(elbow, rot(vsub(J['fist'], J['elbow']), a('bilak' + sfx)))
        knee = vadd(J['hip'], rot(vsub(J['knee'], J['hip']), a('son' + sfx)))
        items['yeng' + sfx] = ('yeng', J['shoulder'], a('yeng' + sfx), dark)
        items['bilak' + sfx] = ('bilak', elbow, a('bilak' + sfx), dark)
        items['son' + sfx] = ('son', J['hip'], a('son' + sfx), dark)
        items['etik' + sfx] = ('etik', knee, a('etik' + sfx), dark)
        if not sfx:
            items['qilich'] = ('qilich', fist, a('qilich'), False)
    # yerga tushirish: eng pastdagi tovon h=0 da
    soles = [vadd(items[k][1], rot(vsub(p, J['knee']), items[k][2]))
             for k in ('etik', 'etik2') for p in ((-0.048, 0.0), (0.14, 0.0))]
    lift = -min(h for _, h in soles)
    return {k: (pid, (j[0], j[1] + lift), ang, dark) for k, (pid, j, ang, dark) in items.items()}


def render_pose(unit, pieces, pose, w=600, h=1000, ground=940, cx=300):
    scene = np.zeros((h, w, 3), np.uint8)
    scene[:] = (240, 236, 228)
    owner = np.full((h, w), -1, int)
    names = []
    items = pose_items(pose)
    for k in UNITS[unit]['order']:
        pid, (jx, jh), ang, dark = items[k]
        a, (pvx, pvy) = render_piece(pieces[pid])
        ph, pw = a.shape[:2]
        r = math.ceil(max(math.hypot(x - pvx, y - pvy) for x in (0, pw) for y in (0, ph))) + 2
        canvas = Image.new('RGBA', (2 * r, 2 * r), (0, 0, 0, 0))
        canvas.paste(Image.fromarray(a), (round(r - pvx), round(r - pvy)))
        img = np.array(canvas.rotate(ang, resample=Image.NEAREST))
        if dark:
            img[..., :3] = (img[..., :3] * DARK).astype(np.uint8)
        x0, y0 = round(cx + jx * T - r), round(ground - jh * T - r)
        sx0, sy0 = max(0, x0), max(0, y0)
        sx1, sy1 = min(w, x0 + 2 * r), min(h, y0 + 2 * r)
        sub = img[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0]
        m = sub[..., 3] > 0
        scene[sy0:sy1, sx0:sx1][m] = sub[..., :3][m]
        owner[sy0:sy1, sx0:sx1][m] = len(names)
        names.append(k)
    hid = np.array(FILL['yashirin'])
    seen = (scene == hid).all(-1) | (scene == (hid * DARK).astype(np.uint8)).all(-1)
    leaks = {}
    for i in owner[seen]:
        leaks[names[i]] = leaks.get(names[i], 0) + 1
    scene[ground:ground + 2] = (150, 140, 120)
    return scene, leaks


def build(unit='qilichli'):
    OUT.mkdir(parents=True, exist_ok=True)
    sheet, boxes, pieces = build_template(unit)
    sheet.save(OUT / f'{unit}.png')
    meta = dict(size=SIZE, T=T, joints=JOINTS, pieces=boxes, order=UNITS[unit]['order'])
    (OUT / f'{unit}.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    cells = []
    for name, pose in POSES.items():
        scene, leaks = render_pose(unit, pieces, pose)
        cells.append(scene)
        print(f"{name:7s} ko'rinib qolgan yashirin uch: {sum(leaks.values())} px {leaks if leaks else ''}")
    Image.fromarray(np.concatenate(cells, axis=1)).save(OUT / f'{unit}_pozalar.png')
    for pid, b in boxes.items():
        x0, y0, x1, y1 = b['box']
        print(f"  {pid:9s} {x1 - x0:4d}x{y1 - y0:<4d} tayanch {b['pivot']}")
    print(f"-> {OUT.relative_to(ROOT)}/{unit}.png, {unit}.json, {unit}_pozalar.png")


def check(path, unit='qilichli'):
    """Bo'yalgan varaqdagi har bo'lak shablondagi joyi va o'lchamidan qanchalik siljigan."""
    meta = json.loads((OUT / f'{unit}.json').read_text(encoding='utf-8'))
    img = Image.open(path).convert('RGB')
    if img.size != (SIZE, SIZE):
        print(f"rasm {img.size[0]}x{img.size[1]} — {SIZE}x{SIZE} ga keltirildi")
        img = img.resize((SIZE, SIZE), Image.LANCZOS)
    a = np.asarray(img).astype(int)
    bg = (a[..., 0] > 170) & (a[..., 2] > 170) & (a[..., 1] < 110)
    fg = ndimage.binary_opening(~bg, iterations=2)
    # bo'laklar (popuk kabi uzilgan mayda qismlar o'z bo'lagiga qo'shiladi)
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=5))
    comps = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        ys, xs = np.nonzero(fg[sl] & (lab[sl] == i + 1))
        if len(xs) > 1500:
            comps.append((xs.min() + sl[1].start, ys.min() + sl[0].start,
                          xs.max() + 1 + sl[1].start, ys.max() + 1 + sl[0].start))
    tpl = meta['pieces']
    # butun rasm biroz kattalashgan yoki surilgan bo'lsa zarari yo'q — avval shuni topamiz (s, tx, ty)
    s, tx, ty = 1.0, 0.0, 0.0
    for _ in range(3):
        match = {}
        for pid, b in tpl.items():
            cx, cy = s * (b['box'][0] + b['box'][2]) / 2 + tx, s * (b['box'][1] + b['box'][3]) / 2 + ty
            match[pid] = min(comps, key=lambda c: math.hypot((c[0] + c[2]) / 2 - cx, (c[1] + c[3]) / 2 - cy))
        src = np.array([v for pid in tpl for v in tpl[pid]['box']], float)
        dst = np.array([v for pid in tpl for v in match[pid]], float)
        A = np.zeros((len(src), 3))
        A[:, 0] = src
        A[0::2, 1] = 1
        A[1::2, 2] = 1
        s, tx, ty = np.linalg.lstsq(A, dst, rcond=None)[0]
    # ChatGPT shablonni aynan takrorlamaydi: butun rasmni biroz cho'zishi mumkin — bu zararsiz.
    # Muhimi bo'laklarning bir-biriga nisbati: bo'yi (bo'g'imdan bo'g'imgacha) ±6%, eni ±15%
    # (bo'g'imdagi yashirin uchlar shuncha farqni yopadi)
    rh = {pid: (match[pid][3] - match[pid][1]) / (b['box'][3] - b['box'][1]) for pid, b in tpl.items()}
    rw = {pid: (match[pid][2] - match[pid][0]) / (b['box'][2] - b['box'][0]) for pid, b in tpl.items()}
    sy, sx = float(np.median(list(rh.values()))), float(np.median(list(rw.values())))
    print(f"butun rasm: bo'yiga {sy:.2f}, eniga {sx:.2f} barobar (zararsiz)")
    bad = 0
    for pid in tpl:
        dh, dw = rh[pid] / sy - 1, rw[pid] / sx - 1
        ok = abs(dh) <= 0.06 and abs(dw) <= 0.15
        bad += not ok
        print(f"  {pid:9s} {'OK ' if ok else 'XATO'} bo'yi {dh:+.0%}, eni {dw:+.0%}")
    extra = len(comps) - len(set(match.values()))
    if extra:
        print(f"  shablonda yo'q ortiqcha narsa: {extra} ta")
    print('Hammasi mos.' if not bad and not extra else f"Mos emas: {bad} ta bo'lak.")


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--tekshir':
        check(sys.argv[2], *sys.argv[3:4])
    else:
        build(*sys.argv[1:2])
