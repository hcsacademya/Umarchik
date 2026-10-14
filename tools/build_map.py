"""
Umumiy xarita rasmidan o'yin xaritasini yasaydi.

  python tools/build_map.py <xarita_rgba.png> <chiqish.json> [tekshiruv.png]

Kirish: foni olib tashlangan (shaffof) xarita rasmi.
Chiqish: src/world/mapData.json — plitalar relyefi, viloyatlar, qal'alar joyi va
rasmni plitalar to'riga moslash (kalibrlash) ma'lumotlari.

Viloyatlar rasmdagi oltin nuqtali chegaralardan aniqlanadi: nuqtalar "devor" bo'ladi
va har bir viloyat o'z qal'asidan boshlab to'ldiriladi (geodezik Voronoy).
Devordagi uzilishlar natijani buzmaydi.
"""
import heapq
import json
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

N = 60  # plitalar to'ri N x N (romb)
CELL = 4  # viloyat hisobi uchun katak (piksel)

# Viloyatlar: nom, zona, urug' nuqtalar (rasm koordinatalari), qal'a (bo'lsa).
# 0 va 1 — imperiyalar (o'yin kodi shuni kutadi).
PROVINCES = [
    dict(name='Rumiya', zone='markaz', seeds=[(490, 320)], castle=(490, 320), kind='empireA'),
    dict(name='Parsiya', zone='markaz', seeds=[(820, 300)], castle=(820, 300), kind='empireB'),
    dict(name="G'arbiy qorli tog'lar", zone='chet', seeds=[(330, 85), (450, 70)], castle=None),
    dict(name="Sharqiy qorli tog'lar", zone='chet', seeds=[(1020, 100), (850, 70)], castle=None),
    dict(name="Qalin o'rmon", zone='chet', seeds=[(255, 200), (120, 160)], castle=(255, 200), kind='ai'),
    dict(name='Kumushsoy', zone='orta', seeds=[(540, 160)], castle=(540, 160), kind='ai'),
    dict(name='Shimoliy vodiy', zone='orta', seeds=[(785, 150)], castle=(785, 150), kind='ai'),
    dict(name="Tog'oldi", zone='chet', seeds=[(1020, 205)], castle=(1020, 205), kind='ai'),
    dict(name='Yaylovobod', zone='chet', seeds=[(1170, 375), (1080, 300)], castle=(1170, 375), kind='ai'),
    dict(name='Sharshara', zone='chet', seeds=[(230, 355), (90, 330)], castle=(230, 355), kind='ai'),
    dict(name="Ko'lbo'yi", zone='chet', seeds=[(275, 460), (360, 550)], castle=(275, 460), kind='ai'),
    dict(name="Qorabog'", zone='orta', seeds=[(505, 450)], castle=(505, 450), kind='ai'),
    dict(name='Janubiy dasht', zone='chet', seeds=[(570, 560)], castle=(570, 560), kind='ai'),
    dict(name='Oltinvodiy', zone='orta', seeds=[(740, 455)], castle=None),
    dict(name='Vohalar', zone='orta', seeds=[(945, 505), (800, 560)], castle=(945, 505), kind='ai'),
    dict(name="Qoyatog'", zone='chet', seeds=[(1110, 580), (1180, 480)], castle=(1110, 580), kind='ai'),
]
# Rasmdagi tayyor shaharlar (imperiyalar poytaxti atrofi) — plitaga bino chizilmaydi.
CITY_RADIUS = {'empireA': 95, 'empireB': 95, 'ai': 0}
# Rasmdagi kumush konlari
MINES = [(330, 85), (1020, 100)]

TERRAIN_CODE = {
    'tekislik': 'a', 'unumdor': 'b', 'vodiy': 'c', 'yaylov': 'd', 'orman': 'e',
    'tog': 'f', 'qorli_tog': 'g', 'chol': 'h', 'daryo': 'i', 'kol': 'j', 'tashqi': 'k',
}


def hsv(im):
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx = im.max(-1)
    mn = im.min(-1)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def main(src, out_json, vis_path=None):
    rgba = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255
    H, W = rgba.shape[:2]
    rgb = rgba[..., :3]
    land = ndi.binary_fill_holes(rgba[..., 3] > 0.5)
    h, s, v = hsv(rgb)

    # O'yin maydoni: qirg'oq jarliklarisiz yuza.
    ys, xs = np.nonzero(land)
    bottom = np.full(W, -1)
    for x in range(W):
        col = np.nonzero(land[:, x])[0]
        if len(col):
            bottom[x] = col.max()
    yy = np.arange(H)[:, None]
    cliff = (bottom[None, :] - yy) < 55
    surface = ndi.binary_erosion(land, iterations=10) & ~cliff

    # Piksel sinflari
    water = (h > 165) & (h < 230) & (s > 0.22) & (v > 0.25)
    snow = (s < 0.2) & (v > 0.72)
    grey_rock = (s < 0.28) & (v > 0.3) & (v <= 0.72)
    forest = (h > 55) & (h < 170) & (v < 0.42) & (s > 0.2)
    grass = (h > 48) & (h < 120) & (v >= 0.42) & (s > 0.25)
    sand = (h > 22) & (h < 46) & (s > 0.32) & (v > 0.55)
    brown_rock = (h > 10) & (h < 40) & (s > 0.2) & (v > 0.25) & (v < 0.6)
    gold = (h > 36) & (h < 62) & (s > 0.4) & (v > 0.84)
    field = (h > 36) & (h < 52) & (s > 0.5) & (v > 0.62)
    forest = (h > 55) & (h < 170) & (v < 0.5) & (s > 0.2)

    # ---------- Kalibrlash: romb to'ri yuzani o'rab oladi ----------
    sy_, sx_ = np.nonzero(surface)
    x0, x1, y0, y1 = sx_.min(), sx_.max(), sy_.min(), sy_.max()
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    half_w = (x1 - x0) / 2 + (y1 - y0) + 8  # A >= w/2 + h
    tw = 2 * half_w / N
    top = cy - half_w / 2

    def tile_center(tx, ty):
        return cx + (tx - ty) * tw / 2, top + (tx + ty + 1) * tw / 4

    # ---------- Viloyatlar: geodezik Voronoy ----------
    gh, gw = H // CELL, W // CELL
    def block(mask, op='mean'):
        m = mask[: gh * CELL, : gw * CELL].reshape(gh, CELL, gw, CELL)
        return m.mean(axis=(1, 3))
    land_c = block(land) > 0.5
    wall_c = block(ndi.binary_dilation(gold, iterations=2)) > 0.12
    water_c = block(water) > 0.5
    cost = np.where(wall_c, 40.0, np.where(water_c, 6.0, 1.0))
    dist = np.full((gh, gw), np.inf)
    owner = np.full((gh, gw), -1, int)
    pq = []
    for pid, p in enumerate(PROVINCES):
        for (sx, sy) in p['seeds']:
            gx, gy = int(sx // CELL), int(sy // CELL)
            dist[gy, gx] = 0
            owner[gy, gx] = pid
            heapq.heappush(pq, (0.0, gy, gx, pid))
    while pq:
        d, y, x, pid = heapq.heappop(pq)
        if d > dist[y, x]:
            continue
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if ny < 0 or nx < 0 or ny >= gh or nx >= gw or not land_c[ny, nx]:
                continue
            nd = d + cost[ny, nx]
            if nd < dist[ny, nx]:
                dist[ny, nx] = nd
                owner[ny, nx] = pid
                heapq.heappush(pq, (nd, ny, nx, pid))

    # ---------- Plitalar ----------
    terrain = []
    province = []
    for ty in range(N):
        for tx in range(N):
            px, py = tile_center(tx, ty)
            # romb ichidagi piksellar
            r = tw / 2
            xa, xb = int(max(0, px - r)), int(min(W, px + r))
            ya, yb = int(max(0, py - r / 2)), int(min(H, py + r / 2))
            if xb <= xa or yb <= ya:
                terrain.append('tashqi')
                province.append(0)
                continue
            gx_, gy_ = np.meshgrid(np.arange(xa, xb), np.arange(ya, yb))
            inside = np.abs(gx_ - px) / r + np.abs(gy_ - py) / (r / 2) <= 1
            sl = (slice(ya, yb), slice(xa, xb))
            surf = surface[sl][inside]
            if surf.mean() < 0.5:
                terrain.append('tashqi')
                province.append(0)
                continue
            f = lambda m: m[sl][inside].mean()
            fw, fsnow, frock, ffor, fsand, fbr, ffield = f(water), f(snow), f(grey_rock), f(forest), f(sand), f(brown_rock), f(field)
            if fw > 0.42:
                t = 'kol'
            elif fw > 0.2:
                t = 'daryo'
            elif py < 175 and fsnow > 0.18:
                t = 'qorli_tog'
            elif py < 175 and (frock + fsnow) > 0.3:
                t = 'tog'
            elif px > 720 and py > 400 and fbr > 0.35 and fsand < 0.35:
                t = 'tog'
            elif px > 700 and py > 410 and fsand > 0.25:
                t = 'chol'
            elif ffor > 0.45:
                t = 'orman'
            elif ffield > 0.22:
                t = 'unumdor'  # sariq ekinzorlar
            elif px > 960 and py < 430:
                t = 'yaylov'
            elif py < 260:
                t = 'vodiy'
            else:
                t = 'tekislik'
            terrain.append(t)
            gxc = min(gw - 1, int(px // CELL))
            gyc = min(gh - 1, int(py // CELL))
            pid = owner[gyc, gxc]
            if pid < 0:
                # yaqin katakdan
                ys_, xs_ = np.nonzero(owner >= 0)
                k = np.argmin((ys_ - gyc) ** 2 + (xs_ - gxc) ** 2)
                pid = owner[ys_[k], xs_[k]]
            province.append(int(pid))

    # Katta suv havzalari ko'l, ingichkalari daryo.
    arr = np.array(terrain).reshape(N, N)
    wmask = (arr == 'kol') | (arr == 'daryo')
    lab, n = ndi.label(wmask)
    for i in range(1, n + 1):
        cells = lab == i
        kol_share = (arr[cells] == 'kol').mean()
        if cells.sum() >= 8 and kol_share > 0.5:
            arr[cells & (arr == 'daryo')] = 'kol'
    # Daryo bo'yi unumdor.
    near_river = ndi.binary_dilation(arr == 'daryo', iterations=1)
    arr[near_river & np.isin(arr, ['tekislik', 'vodiy'])] = 'unumdor'
    terrain = list(arr.flatten())

    def tile_of(ix, iy):
        # rasm nuqtasidan plita
        a = (ix - cx) / (tw / 2)
        b = (iy - top) / (tw / 4) - 1
        return int(round((a + b) / 2)), int(round((b - a) / 2))

    castles = []
    cities = []
    for pid, p in enumerate(PROVINCES):
        if not p['castle']:
            continue
        tx, ty = tile_of(*p['castle'])
        idx = ty * N + tx
        if terrain[idx] in ('kol', 'daryo', 'tashqi'):
            terrain[idx] = 'tekislik'
        province[idx] = pid
        castles.append(dict(x=tx, y=ty, province=pid, kind=p['kind']))
        rad = CITY_RADIUS.get(p['kind'], 0)
        if rad:
            for ty2 in range(N):
                for tx2 in range(N):
                    px, py = tile_center(tx2, ty2)
                    i2 = ty2 * N + tx2
                    if (tx2, ty2) == (tx, ty) or province[i2] != pid or terrain[i2] in ('kol', 'daryo', 'tashqi'):
                        continue
                    if ((px - p['castle'][0]) / rad) ** 2 + ((py - p['castle'][1]) / (rad * 0.62)) ** 2 < 1:
                        cities.append([tx2, ty2])
    mines = []
    for (mx_, my_) in MINES:
        tx, ty = tile_of(mx_, my_)
        if terrain[ty * N + tx] != 'tashqi':
            mines.append([tx, ty])

    provs = []
    for pid, p in enumerate(PROVINCES):
        tiles = [(i % N, i // N) for i in range(N * N) if province[i] == pid and terrain[i] != 'tashqi']
        if p['castle']:
            lx, ly = tile_of(*p['castle'])
        else:
            mx_ = np.mean([t[0] for t in tiles])
            my_ = np.mean([t[1] for t in tiles])
            lx, ly = min(tiles, key=lambda t: (t[0] - mx_) ** 2 + (t[1] - my_) ** 2)
        provs.append(dict(name=p['name'], zone=p['zone'], cx=int(lx), cy=int(ly), tiles=len(tiles)))
        print(f"{pid:2d} {p['name']:24s} {p['zone']:7s} plitalar={len(tiles)}")

    data = dict(
        image=dict(w=W, h=H),
        grid=dict(n=N, cx=round(float(cx), 2), top=round(float(top), 2), tw=round(float(tw), 4)),
        terrain=''.join(TERRAIN_CODE[t] for t in terrain),
        province=province,
        provinces=provs,
        castles=castles,
        cities=cities,
        mines=mines,
    )
    with open(out_json, 'w') as fh:
        json.dump(data, fh, separators=(',', ':'), ensure_ascii=False)
    print('plitalar:', sum(1 for t in terrain if t != 'tashqi'), 'quruqlik;', N * N, 'jami')

    if vis_path:
        img = Image.fromarray((rgb * 255).astype(np.uint8)).convert('RGBA')
        over = Image.new('RGBA', img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(over)
        rng = np.random.default_rng(7)
        cols = [tuple(int(c) for c in rng.integers(30, 255, 3)) for _ in PROVINCES]
        tcol = {'kol': (0, 60, 255), 'daryo': (0, 160, 255), 'qorli_tog': (255, 255, 255), 'tog': (120, 100, 80), 'orman': (0, 90, 0), 'chol': (240, 200, 90), 'unumdor': (200, 220, 0), 'yaylov': (160, 230, 120), 'vodiy': (110, 200, 90), 'tekislik': (150, 190, 70)}
        for ty in range(N):
            for tx in range(N):
                i = ty * N + tx
                if terrain[i] == 'tashqi':
                    continue
                px, py = tile_center(tx, ty)
                poly = [(px, py - tw / 4), (px + tw / 2, py), (px, py + tw / 4), (px - tw / 2, py)]
                d.polygon(poly, fill=cols[province[i]] + (110,), outline=(0, 0, 0, 60))
                d.ellipse((px - 3, py - 3, px + 3, py + 3), fill=tcol[terrain[i]] + (255,))
        for c in castles:
            px, py = tile_center(c['x'], c['y'])
            d.rectangle((px - 6, py - 6, px + 6, py + 6), outline=(255, 0, 0, 255), width=3)
        for (tx, ty) in cities:
            px, py = tile_center(tx, ty)
            d.rectangle((px - 3, py - 3, px + 3, py + 3), outline=(255, 0, 255, 255), width=2)
        img.alpha_composite(over)
        d2 = ImageDraw.Draw(img)
        for p in provs:
            px, py = tile_center(p['cx'], p['cy'])
            d2.text((px - 20, py - 18), p['name'], fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0, 255))
        img.convert('RGB').save(vis_path)


if __name__ == '__main__':
    main(*sys.argv[1:])
