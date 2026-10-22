// Rasmlarni yuklash. O'lchamlar va tayanch nuqtalar tools/prepare_assets.py yasagan assets.json dan.
import meta from './assets.json';
import type { Kind } from './config.ts';

export interface Frame {
  img: HTMLImageElement | HTMLCanvasElement;
  w: number; // o'yin birligida
  h: number;
  ax: number; // tayanch nuqta (oyoq o'rtasi), kenglikka nisbatan
}

interface FrameMeta {
  f: string;
  w: number;
  h: number;
  ax: number;
}

const cache = new Map<string, HTMLImageElement>();

function image(src: string): HTMLImageElement {
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = src;
    cache.set(src, img);
  }
  return img;
}

function frames(list: FrameMeta[]): Frame[] {
  return list.map((m) => ({ img: image(m.f), w: m.w, h: m.h, ax: m.ax }));
}

// key: true — dushman rasmi mato qismlari toza ko'k rangda chizilgan (rang almashtirish uchun)
const unitMeta = meta.units as Record<Kind, { frames: FrameMeta[]; enemy: FrameMeta[]; key?: boolean }>;
const buildingMeta = meta.buildings as Record<string, FrameMeta[]>;

export const UNIT_FRAMES = {} as Record<Kind, [Frame[], Frame[]]>; // [o'yinchi, dushman]
for (const k of Object.keys(unitMeta) as Kind[]) {
  UNIT_FRAMES[k] = [frames(unitMeta[k].frames), frames(unitMeta[k].enemy)];
}

export const BUILDINGS: Record<string, Frame[]> = {};
for (const k of Object.keys(buildingMeta)) BUILDINGS[k] = frames(buildingMeta[k]);

// "qasr_dushman:2" -> kadr
export function building(ref: string): Frame {
  const [key, idx] = ref.split(':');
  return BUILDINGS[key][Number(idx)];
}

export const MAP_IMAGE = meta.map.f;

// Tugma rasmlari uchun: askarning tik turgan holati
export function unitIcon(kind: Kind): string {
  return unitMeta[kind].frames[0].f;
}

export function ready(img: Frame['img']): boolean {
  return img instanceof HTMLCanvasElement || (img.complete && img.naturalWidth > 0);
}

// ---------- Dushmanni jang rangiga bo'yash ----------
// Rasm "key" bo'lsa — faqat toza ko'k mato qismlari rangga almashadi (teri, charm, temir o'zgarmaydi).
// Aks holda (vaqtincha) — o'yinchi rasmidagi och mato qismlari rangga bo'yaladi.

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function recolorImage(img: HTMLImageElement, hex: string, key: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const [tr, tg, tb] = hexRgb(hex);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    let w: number;
    let light: number;
    if (key) {
      // ko'k: b eng katta, to'yingan
      w = b === max && b > r * 1.35 && b > g * 1.15 && sat > 0.3 ? 1 : 0;
      light = max / 200;
    } else {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      w = Math.min(1, Math.max(0, (lum - 95) / 110)) * Math.min(1, Math.max(0, (0.55 - sat) / 0.3)) * 0.8;
      light = lum / 190;
    }
    const dark = 0.85;
    px[i] = r * dark * (1 - w) + Math.min(255, tr * light) * w;
    px[i + 1] = g * dark * (1 - w) + Math.min(255, tg * light) * w;
    px[i + 2] = b * dark * (1 - w) + Math.min(255, tb * light) * w;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

const tinted = new Map<string, Frame[]>();

export function enemyFrames(kind: Kind, hex: string): Frame[] {
  const k = `${kind}:${hex}`;
  let out = tinted.get(k);
  if (!out) {
    const key = !!unitMeta[kind].key;
    const src = key ? UNIT_FRAMES[kind][1] : UNIT_FRAMES[kind][0];
    out = src.map((f) => ({ ...f, img: ready(f.img) && f.img instanceof HTMLImageElement ? recolorImage(f.img, hex, key) : f.img }));
    tinted.set(k, out);
  }
  return out;
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
