import { GAME, NAMES, TERRAIN_INFO } from '../config';
import type { Province, Terrain, Tile, Zone } from '../types';
import { fbm, makeRng, valueNoise } from '../util';

/**
 * Xarita: romb (izometrik) plitalar to'ri. Ekranda shimol tepada:
 *  - shimolda qorli tog'lar va kumush konlari,
 *  - markazdan daryo o'tib janubi-g'arbdagi katta ko'lga quyiladi,
 *  - g'arbda o'rmon, sharqda yaylov, janubi-sharqda cho'l,
 *  - markazda ikki imperiya, 12 viloyat.
 */

/** Plitaning ekran koordinatasi (-1..1): sx sharqqa, sy janubga. */
export function screenNorm(x: number, y: number): { sx: number; sy: number } {
  const nx = ((x + 0.5) / GAME.mapW) * 2 - 1;
  const ny = ((y + 0.5) / GAME.mapH) * 2 - 1;
  return { sx: (nx - ny) / 2, sy: (nx + ny) / 2 };
}

const RIVER: [number, number][] = [
  [0.1, -0.56],
  [0.04, -0.3],
  [0.0, -0.08],
  [-0.06, 0.08],
  [-0.18, 0.22],
  [-0.32, 0.36],
  [-0.42, 0.45],
];
const LAKE = { sx: -0.44, sy: 0.47, r: 0.13 };

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function riverDist(sx: number, sy: number): number {
  let d = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    d = Math.min(d, distToSegment(sx, sy, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]));
  }
  return d;
}

/** Daryoning berilgan kenglikdagi sx qiymati (imperiyalar chegarasi uchun). */
function riverSxAt(sy: number): number {
  if (sy <= RIVER[0][1]) return RIVER[0][0];
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, ay] = RIVER[i];
    const [bx, by] = RIVER[i + 1];
    if (sy >= ay && sy <= by) return ax + ((sy - ay) / (by - ay)) * (bx - ax);
  }
  return RIVER[RIVER.length - 1][0];
}

function pickTerrain(sx: number, sy: number, seed: number, x: number, y: number): Terrain {
  const n = fbm(x / 7, y / 7, seed);
  const n2 = valueNoise(x / 4, y / 4, seed + 31);
  const lakeD = Math.hypot(sx - LAKE.sx, (sy - LAKE.sy) * 1.2);
  if (lakeD < LAKE.r + (n - 0.5) * 0.05) return 'kol';
  const rd = riverDist(sx, sy + (n2 - 0.5) * 0.02);
  if (rd < 0.032) return 'daryo';
  if (sy < -0.76 + (n - 0.5) * 0.12) return 'qorli_tog';
  if (sy < -0.58 + (n - 0.5) * 0.14) return 'tog';
  if (rd < 0.1) return 'unumdor';
  if (sx < -0.48 + (n - 0.5) * 0.22 && sy > -0.6) return 'orman';
  if (sx > 0.1 && sy > 0.3 + (n - 0.5) * 0.15) return 'chol';
  if (sx > 0.46 + (n - 0.5) * 0.2) return 'yaylov';
  if (n2 > 0.8 && Math.abs(sx) + Math.abs(sy) > 0.25) return 'tog';
  if (sy < -0.32 + (n - 0.5) * 0.08) return 'vodiy';
  if (n > 0.62) return 'vodiy';
  if (n < 0.33 && sx > 0.15) return 'yaylov';
  return 'tekislik';
}

function zoneAndProvince(sx: number, sy: number, seed: number, x: number, y: number): { zone: Zone; prov: number } {
  const n = valueNoise(x / 5, y / 5, seed + 101);
  const r = Math.abs(sx) + Math.abs(sy) + (n - 0.5) * 0.08;
  const a = Math.atan2(sy, sx) + (valueNoise(x / 6, y / 6, seed + 202) - 0.5) * 0.3;
  if (r < 0.3) {
    return { zone: 'markaz', prov: sx < riverSxAt(sy) + 0.03 ? 0 : 1 };
  }
  if (r < 0.62) {
    const idx = ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4; // 0 E, 1 S, 2 W, 3 N
    return { zone: 'orta', prov: 2 + idx };
  }
  const idx = ((Math.round((a + Math.PI / 2) / (Math.PI / 3)) % 6) + 6) % 6; // 0 N, 1 NE, 2 SE, 3 S, 4 SW, 5 NW
  return { zone: 'chet', prov: 6 + idx };
}

export function generateMap(seed: number): { tiles: Tile[]; provinces: Province[] } {
  const W = GAME.mapW;
  const H = GAME.mapH;
  const rnd = makeRng(seed ^ 0x5eed);
  const tiles: Tile[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const { sx, sy } = screenNorm(x, y);
      const terrain = pickTerrain(sx, sy, seed, x, y);
      const { prov } = zoneAndProvince(sx, sy, seed, x, y);
      const deposit = (terrain === 'tog' || terrain === 'qorli_tog') && rnd() < 0.4;
      tiles.push({
        x,
        y,
        terrain,
        province: prov,
        deposit,
        owner: -1,
        building: 'none',
        level: 0,
        crop: 'bugdoy',
        workers: 0,
        store: 0,
        garrison: {},
        capture: null,
      });
    }
  }

  const names = [
    NAMES.provinces.empireA,
    NAMES.provinces.empireB,
    ...NAMES.provinces.middle,
    ...NAMES.provinces.edge,
  ];
  const zones: Zone[] = ['markaz', 'markaz', 'orta', 'orta', 'orta', 'orta', 'chet', 'chet', 'chet', 'chet', 'chet', 'chet'];
  const provinces: Province[] = names.map((name, id) => ({ id, name, zone: zones[id], cx: 0, cy: 0, desc: '' }));

  for (const p of provinces) {
    const own = tiles.filter((t) => t.province === p.id);
    if (own.length === 0) continue;
    const ax = own.reduce((s, t) => s + t.x, 0) / own.length;
    const ay = own.reduce((s, t) => s + t.y, 0) / own.length;
    let best = own[0];
    let bd = Infinity;
    for (const t of own) {
      if (t.terrain === 'kol') continue;
      const d = (t.x - ax) ** 2 + (t.y - ay) ** 2;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    p.cx = best.x;
    p.cy = best.y;
    const counts = new Map<Terrain, number>();
    let deposits = 0;
    for (const t of own) {
      counts.set(t.terrain, (counts.get(t.terrain) ?? 0) + 1);
      if (t.deposit) deposits++;
    }
    const top = [...counts.entries()]
      .filter(([k]) => k !== 'daryo' && k !== 'kol')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => TERRAIN_INFO[k].name.toLowerCase());
    const extra: string[] = [];
    if (deposits > 0) extra.push(`${deposits} ta kumush koni`);
    if ((counts.get('daryo') ?? 0) > 0) extra.push('daryo');
    if ((counts.get('kol') ?? 0) > 0) extra.push('ko\'l');
    p.desc = [top.join(', '), ...extra].filter(Boolean).join('; ');
  }

  return { tiles, provinces };
}

export function tileAt(tiles: Tile[], x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= GAME.mapW || y >= GAME.mapH) return null;
  return tiles[y * GAME.mapW + x];
}

export const DIRS4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function neighbors4(tiles: Tile[], t: Tile): Tile[] {
  const out: Tile[] = [];
  for (const [dx, dy] of DIRS4) {
    const n = tileAt(tiles, t.x + dx, t.y + dy);
    if (n) out.push(n);
  }
  return out;
}
