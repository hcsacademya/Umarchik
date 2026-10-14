import { GAME, TERRAIN_INFO } from '../config';
import type { Province, Terrain, Tile, Zone } from '../types';
import { makeRng } from '../util';
import mapData from './mapData.json';

/**
 * Xarita umumiy xarita rasmidan yasalgan (tools/build_map.py → mapData.json):
 * plitalar relyefi, 16 viloyat (rasmdagi oltin nuqtali chegaralar bo'yicha),
 * qal'alar va imperiya shaharlari joyi. Romb to'rning rasmdan tashqaridagi
 * plitalari 'tashqi' (o'ynalmaydi).
 */

const CODES: Record<string, Terrain> = {
  a: 'tekislik',
  b: 'unumdor',
  c: 'vodiy',
  d: 'yaylov',
  e: 'orman',
  f: 'tog',
  g: 'qorli_tog',
  h: 'chol',
  i: 'daryo',
  j: 'kol',
  k: 'tashqi',
};

export interface MapCastle {
  x: number;
  y: number;
  province: number;
  kind: 'empireA' | 'empireB' | 'ai';
}

export const MAP = {
  /** Rasm o'lchami va to'r kalibrlashi: plita (x,y) markazi rasmda
   *  ix = cx + (x - y) * tw / 2,  iy = top + (x + y + 1) * tw / 4. */
  image: mapData.image,
  grid: mapData.grid,
  castles: mapData.castles as MapCastle[],
  cities: mapData.cities as [number, number][],
  mines: mapData.mines as [number, number][],
};

export function generateMap(seed: number): { tiles: Tile[]; provinces: Province[] } {
  const N = GAME.mapW;
  const rnd = makeRng(seed ^ 0x5eed);
  const tiles: Tile[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const terrain = CODES[mapData.terrain[i]] ?? 'tashqi';
      tiles.push({
        x,
        y,
        terrain,
        province: mapData.province[i],
        deposit: (terrain === 'tog' || terrain === 'qorli_tog') && rnd() < 0.4,
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
  for (const [x, y] of MAP.mines) tiles[y * N + x].deposit = true;

  const provinces: Province[] = mapData.provinces.map((p, id) => ({
    id,
    name: p.name,
    zone: p.zone as Zone,
    cx: p.cx,
    cy: p.cy,
    desc: '',
  }));
  for (const p of provinces) {
    const own = tiles.filter((t) => t.province === p.id && t.terrain !== 'tashqi');
    // Nom yorlig'i viloyat o'rtasida (qal'a bayrog'i bilan ustma-ust tushmasin).
    if (own.length) {
      const mx = own.reduce((a, t) => a + t.x, 0) / own.length;
      const my = own.reduce((a, t) => a + t.y, 0) / own.length;
      const c = own.reduce((b, t) => ((t.x - mx) ** 2 + (t.y - my) ** 2 < (b.x - mx) ** 2 + (b.y - my) ** 2 ? t : b));
      p.cx = c.x;
      p.cy = c.y;
    }
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
