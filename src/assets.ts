// Rasmlarni yuklash: jang fonlari va xarita (tools/prepare_assets.py yasagan assets.json dan).
// Qasr, kon va askarlar rasmlari yangi dizayn bilan qayta qilinadi — hozircha o'yin ularni kod bilan oddiy chizadi.
import meta from './assets.json';
import type { Kind, Terrain } from './config.ts';
import { ready } from './ready.ts';

export { ready };

const cache = new Map<string, HTMLImageElement>();

export function loadImage(src: string): HTMLImageElement {
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = src;
    cache.set(src, img);
  }
  return img;
}

export const MAP_IMAGE = meta.map.f;

// Realistik jang foni: ground — rasmda tekis yer boshlanadigan qator (balandlikka nisbatan)
export interface Background {
  img: HTMLImageElement;
  ground: number;
}

const bgMeta = (meta as { backgrounds?: Record<string, { f: string; ground: number }> }).backgrounds ?? {};
export const BACKGROUNDS: Partial<Record<Terrain, Background>> = {};
for (const [k, v] of Object.entries(bgMeta)) BACKGROUNDS[k as Terrain] = { img: loadImage(v.f), ground: v.ground };

// Tugma belgilari: rasm yo'q paytda — tur harfi bilan oddiy belgi (yangi rasmlar kelguncha)
const ICON_TEXT: Record<Kind, [string, string]> = {
  amir: ['A', '#c9962e'],
  konchi: ['K', '#7a6a4a'],
  qilichli: ['Q', '#3d68c8'],
  nayzachi: ['N', '#3d8a6a'],
  kamonchi: ['Ka', '#8a5a3a'],
  otliq: ['O', '#6a3d8a'],
};

export function unitIcon(kind: Kind): string {
  const [t, c] = ICON_TEXT[kind];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="${c}" stroke="#f0e2b8" stroke-width="2"/><text x="24" y="31" font-family="system-ui,sans-serif" font-size="${t.length > 1 ? 17 : 21}" font-weight="800" fill="#fff" text-anchor="middle">${t}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function preload(): Promise<void> {
  const all = [...cache.values()];
  return Promise.all(
    all.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((res) => {
      img.onload = () => res();
      img.onerror = () => res();
    }))),
  ).then(() => undefined);
}
