"""Umumiy xarita rasmidan viloyatlarni (oltin nuqtali chegaralar) ajratish — tekshiruv uchun ko'rinish chiqaradi."""
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi


def hsv(im):
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx = im.max(-1)
    mn = im.min(-1)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def land_mask(rgba):
    a = rgba[..., 3] > 0.5
    return ndi.binary_fill_holes(a)


def gold_dots(rgb):
    """Oltin nuqtalar: atrofidan yorqinroq, sariq-oltin rangdagi kichik dog'lar."""
    h, s, v = hsv(rgb)
    local = ndi.uniform_filter(v, size=15)
    tophat = v - local
    cand = (h > 30) & (h < 64) & (s > 0.3) & (v > 0.72) & (tophat > 0.09)
    lab, n = ndi.label(cand)
    if n == 0:
        return np.zeros((0, 2))
    sizes = ndi.sum(cand, lab, index=np.arange(1, n + 1))
    cms = ndi.center_of_mass(cand, lab, index=np.arange(1, n + 1))
    pts = [(c[1], c[0]) for c, sz in zip(cms, sizes) if 2 <= sz <= 40]
    return np.array(pts)


def chains(pts, link=13.0, min_len=5):
    """Yaqin nuqtalarni zanjirga bog'laydi; qisqa zanjirlar (dala, qum) tashlanadi."""
    n = len(pts)
    parent = list(range(n))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    edges = []
    for i in range(n):
        d = np.hypot(pts[:, 0] - pts[i, 0], pts[:, 1] - pts[i, 1])
        for j in np.nonzero((d < link) & (np.arange(n) > i))[0]:
            edges.append((i, int(j)))
            parent[find(i)] = find(int(j))
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    keep = {g for g, m in groups.items() if len(m) >= min_len}
    return [(i, j) for i, j in edges if find(i) in keep], [i for i in range(n) if find(i) in keep]


def gold_mask(rgb, extra_lines=(), shape=None):
    pts = gold_dots(rgb)
    edges, _ = chains(pts)
    img = Image.new('L', (rgb.shape[1], rgb.shape[0]), 0)
    d = ImageDraw.Draw(img)
    for i, j in edges:
        d.line([tuple(pts[i]), tuple(pts[j])], fill=255, width=5)
    for line in extra_lines:
        d.line(line, fill=255, width=7)
    return np.asarray(img) > 0


def regions(land, border, min_area=1500):
    lab, n = ndi.label(land & ~border)
    sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(n + 1))
    good = [i for i in range(1, n + 1) if sizes[i] >= min_area]
    out = np.zeros_like(lab)
    for k, i in enumerate(good, 1):
        out[lab == i] = k
    # chegaradagi piksellarni eng yaqin viloyatga berish
    idx = ndi.distance_transform_edt(out == 0, return_distances=False, return_indices=True)
    full = out[idx[0], idx[1]]
    full[~land] = 0
    return full, len(good)


if __name__ == '__main__':
    src_rgba, out_path = sys.argv[1], sys.argv[2]
    rgba = np.asarray(Image.open(src_rgba).convert('RGBA')).astype(np.float32) / 255
    land = land_mask(rgba)
    border = gold_mask(rgba[..., :3])
    reg, n = regions(land, border)
    print('regions', n)
    rng = np.random.default_rng(3)
    cols = rng.integers(40, 255, size=(n + 1, 3))
    cols[0] = 0
    vis = (rgba[..., :3] * 255 * 0.45 + cols[reg] * 0.55).astype(np.uint8)
    vis[border] = [255, 255, 255]
    img = Image.fromarray(vis)
    d = ImageDraw.Draw(img)
    for k in range(1, n + 1):
        ys, xs = np.nonzero(reg == k)
        d.text((xs.mean(), ys.mean()), str(k), fill=(0, 0, 0))
        d.text((xs.mean() + 1, ys.mean() + 1), str(k), fill=(255, 255, 255))
    img.save(out_path)
