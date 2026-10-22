// Rasmlarni yuklash. O'lchamlar va tayanch nuqtalar tools/prepare_assets.py yasagan assets.json dan.
import meta from './assets.json';
import type { Kind } from './config.ts';

export interface Frame {
  img: HTMLImageElement;
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

const unitMeta = meta.units as Record<Kind, { frames: FrameMeta[]; enemy: FrameMeta[] }>;
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

export function preload(): Promise<void> {
  const all = [...cache.values()];
  return Promise.all(
    all.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((res) => {
      img.onload = () => res();
      img.onerror = () => res();
    }))),
  ).then(() => undefined);
}
