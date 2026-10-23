// Rasmlarni yuklash. O'lchamlar va tayanch nuqtalar tools/prepare_assets.py yasagan assets.json dan.
import meta from './assets.json';
import type { FactionId, Kind, Rank, Terrain } from './config.ts';

export interface Frame {
  img: HTMLImageElement | HTMLCanvasElement;
  w: number; // o'yin birligida
  h: number;
  ax: number; // tayanch nuqta (oyoq o'rtasi), kenglikka nisbatan
  wz?: number; // qasr: darvoza ustidagi devor tepasining balandligi
}

interface FrameMeta {
  f: string;
  w: number;
  h: number;
  ax: number;
  wz?: number;
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
  return list.map((m) => ({ img: image(m.f), w: m.w, h: m.h, ax: m.ax, wz: m.wz }));
}

const unitMeta = meta.units as Record<Kind, FrameMeta[]>;
// Dushman xalqlari: mato qismlari toza ko'k rangda chizilgan (rang almashtirish uchun)
const factionMeta = (meta as { factions?: Record<string, Record<string, FrameMeta[]>> }).factions ?? {};

export const UNIT_FRAMES = {} as Record<Kind, Frame[]>;
for (const k of Object.keys(unitMeta) as Kind[]) UNIT_FRAMES[k] = frames(unitMeta[k]);

const FACTION_FRAMES: Partial<Record<FactionId, Partial<Record<Kind, Frame[]>>>> = {};
for (const [fac, kinds] of Object.entries(factionMeta)) {
  const out: Partial<Record<Kind, Frame[]>> = {};
  for (const [k, list] of Object.entries(kinds)) out[k as Kind] = frames(list);
  FACTION_FRAMES[fac as FactionId] = out;
}

// ---------- Yaxlit tayanch: qal'a devori, darvoza va kon bitta rasmda ----------
// Teshiklar [x0, x1, y0, y1] — rasm kengligi/balandligiga nisbatan, y pastdan. Ular orqali askarlar ichkariga kirib ketadi
export interface Base extends Frame {
  gate: [number, number, number, number];
  mine: [number, number, number, number];
  mineDx: number; // darvozadan kon og'zigacha (o'yin birligida)
  wzGate: number; // darvoza ustidagi devor yo'lagi balandligi
}

interface BaseMeta extends FrameMeta {
  gate: [number, number, number, number];
  mine: [number, number, number, number];
  mineDx: number;
  wzGate: number;
}

const baseMeta = (meta as unknown as { bases: Record<string, BaseMeta> }).bases;
export const BASES: Record<string, Base> = {};
for (const [k, m] of Object.entries(baseMeta)) {
  BASES[k] = { img: image(m.f), w: m.w, h: m.h, ax: m.ax, gate: m.gate, mine: m.mine, mineDx: m.mineDx, wzGate: m.wzGate };
}

// Ustki qatlam: tayanch rasmining o'zi, faqat darvoza va kon teshiklari o'yib olingan.
// Askar teshik ichiga kirganda devor va ramka uning ustidan chiziladi — haqiqatan ichkariga kirib ketgandek
const fronts = new Map<Frame['img'], HTMLCanvasElement>();

export function baseFront(b: Base, img: Frame['img'] = b.img): HTMLCanvasElement | null {
  if (!ready(img)) return null;
  let c = fronts.get(img);
  if (!c) {
    c = document.createElement('canvas');
    const W = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
    const H = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    for (const [x0, x1, y0, y1] of [b.gate, b.mine]) {
      const l = x0 * W;
      const r = x1 * W;
      const top = H - y1 * H;
      const bot = H - y0 * H;
      const rad = (r - l) / 2;
      // ravoqsimon teshik: tepasi yarim doira
      g.beginPath();
      g.moveTo(l, bot + 2);
      g.lineTo(l, top + rad * 0.6);
      g.ellipse(l + rad, top + rad * 0.6, rad, rad * 0.6, 0, Math.PI, 0);
      g.lineTo(r, bot + 2);
      g.closePath();
      g.fill();
    }
    fronts.set(img, c);
  }
  return c;
}

// ---------- Skelet: jangchi bo'laklari va suyak nuqtalari (tools/rig_sheets.py) ----------
// Hamma o'lcham o'yin birligida; px, py — bo'lakning burilish nuqtasi (rasm chap-yuqori burchagidan)
export interface RigPart {
  img: Frame['img'];
  w: number;
  h: number;
  px: number;
  py: number;
}

export interface RigJoints {
  hip: [number, number]; // son: oyoq tagidan
  neck: [number, number]; // bo'yin, yelkalar, son bo'g'inlari, plash/o'qdon/savat tayanchi: sondan
  shoulder: [number, number];
  shoulderFar: [number, number];
  hipBack: [number, number];
  hipFront: [number, number];
  cape?: [number, number];
  quiver?: [number, number];
  basket?: [number, number];
  elbow: [number, number]; // tirsak: yelkadan
  hand: [number, number]; // qo'l tutqichi: tirsakdan
  knee: [number, number]; // tizza: son bo'g'inidan
  foot: number; // tizzadan oyoq tagigacha
  ankle?: [number, number]; // tovon: tizzadan
  sole?: number; // tovondan oyoq tagigacha
  horse?: HorseJoints; // otliq: ot skeleti (chavandoz shu odam skeleti)
}

// Ot: hamma nuqta tana markaziga nisbatan; body — tana markazi yerdan (x, y), W — yag'rin balandligi
export interface HorseJoints {
  W: number;
  body: [number, number];
  fore: [number, number]; // old va orqa oyoq tayanchi
  hind: [number, number];
  fuKnee: [number, number]; // old oyoq: yuqori bo'lakdan tizzagacha
  huHock: [number, number]; // orqa oyoq: yuqori bo'lakdan to'pig'igacha
  neck: [number, number];
  tail: [number, number];
  seat: [number, number]; // egar o'rindig'i (chavandozning son bo'g'ini)
  banner: [number, number]; // egar orqasi (qo'mondon bayrog'i)
}

export interface Rig {
  h: number;
  parts: Record<string, RigPart>;
  joints: RigJoints;
}

interface RigMeta {
  h: number;
  parts: Record<string, { f: string; w: number; h: number; px: number; py: number }>;
  joints: RigJoints;
}

const rigMeta = (meta as unknown as { rigs?: Record<string, RigMeta> }).rigs ?? {};
const RIG_DATA: Record<string, Rig> = {};
for (const [k, m] of Object.entries(rigMeta)) {
  const parts: Record<string, RigPart> = {};
  for (const [name, p] of Object.entries(m.parts)) parts[name] = { img: image(p.f), w: p.w, h: p.h, px: p.px, py: p.py };
  RIG_DATA[k] = { h: m.h, parts, joints: m.joints };
}

// Bizning jangchilar skeleti: sarkarda va qo'mondonning o'z rasmi bor
export function ownRig(kind: Kind, rank: Rank): Rig | undefined {
  const name = rank === 'qomondon' ? 'qomondon' : rank === 'sarkarda' ? `sarkarda_${kind}` : kind;
  return RIG_DATA[name] ?? RIG_DATA[kind];
}

export const MAP_IMAGE = meta.map.f;

// Realistik jang foni: ground — rasmda tekis yer boshlanadigan qator (balandlikka nisbatan)
export interface Background {
  img: HTMLImageElement;
  ground: number;
}

const bgMeta = (meta as { backgrounds?: Record<string, { f: string; ground: number }> }).backgrounds ?? {};
export const BACKGROUNDS: Partial<Record<Terrain, Background>> = {};
for (const [k, v] of Object.entries(bgMeta)) BACKGROUNDS[k as Terrain] = { img: image(v.f), ground: v.ground };

// Tugma rasmlari uchun: askarning tik turgan holati
export function unitIcon(kind: Kind): string {
  return unitMeta[kind][0].f;
}

export function ready(img: Frame['img']): boolean {
  return img instanceof HTMLCanvasElement || (img.complete && img.naturalWidth > 0);
}

// ---------- Dushmanni jang rangiga bo'yash ----------
// key = true: faqat toza ko'k mato qismlari rangga almashadi (teri, charm, temir o'zgarmaydi).
// key = false (xalq rasmi hali yo'q turlar): o'yinchi rasmidagi och mato qismlari rangga bo'yaladi.

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
      // ko'k ton (rang doirasida ~205–250°) va to'yinganlik; chegarada yumshoq o'tish
      let hue = 0;
      if (max !== min) {
        if (max === b) hue = 240 + ((r - g) / (max - min)) * 60;
        else if (max === g) hue = 120 + ((b - r) / (max - min)) * 60;
        else hue = (((g - b) / (max - min)) * 60 + 360) % 360;
      }
      const hw = Math.min(1, Math.max(0, Math.min(hue - 190, 265 - hue) / 15));
      const sw = Math.min(1, Math.max(0, (sat - 0.22) / 0.15));
      w = max > 25 ? hw * sw : 0;
      light = b / 175;
    } else {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      w = Math.min(1, Math.max(0, (lum - 95) / 110)) * Math.min(1, Math.max(0, (0.55 - sat) / 0.3)) * 0.8;
      light = lum / 190;
    }
    // key rasmda boshqa joylar o'zgarmaydi; vaqtinchalik bo'yashda biroz to'qlashadi
    const dark = key ? 1 : 0.85;
    // to'q rang (masalan qora) burmalari ko'rinib tursin
    const lift = key ? 28 * light : 0;
    px[i] = r * dark * (1 - w) + Math.min(255, tr * light + lift) * w;
    px[i + 1] = g * dark * (1 - w) + Math.min(255, tg * light + lift) * w;
    px[i + 2] = b * dark * (1 - w) + Math.min(255, tb * light + lift) * w;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

const tinted = new Map<string, Frame[]>();

// Dushman tayanchining bayroqlari (toza ko'k) jang rangiga bo'yaladi
export function tintedBase(key: string, hex: string): Base {
  const k = `b:${key}:${hex}`;
  let out = tinted.get(k) as Base[] | undefined;
  if (!out) {
    const b = BASES[key];
    out = [{ ...b, img: ready(b.img) && b.img instanceof HTMLImageElement ? recolorImage(b.img, hex, true) : b.img }];
    tinted.set(k, out);
  }
  return out[0];
}

// Dushman jangchisi: xalqining rasmi bo'lsa — o'sha (ko'k mato jang rangiga), bo'lmasa — bizning rasm bo'yalgan
export function enemyFrames(kind: Kind, hex: string, faction: FactionId): Frame[] {
  const own = FACTION_FRAMES[faction]?.[kind];
  const k = `${faction}:${kind}:${hex}`;
  let out = tinted.get(k);
  if (!out) {
    const key = !!own;
    const src = own ?? UNIT_FRAMES[kind];
    out = src.map((f) => ({ ...f, img: ready(f.img) && f.img instanceof HTMLImageElement ? recolorImage(f.img, hex, key) : f.img }));
    tinted.set(k, out);
  }
  return out;
}

// Dushman skeleti: xalqning o'z bo'laklari bo'lsa (ko'k mato jang rangiga bo'yaladi), bo'lmasa bizning skelet bo'yalgan
const tintedRigs = new Map<string, Rig>();

export function enemyRig(kind: Kind, rank: Rank, hex: string, faction: FactionId): Rig | undefined {
  // dushmanda qo'mondon yo'q: bo'lsa ham sarkarda rasmi
  const own = (rank !== 'oddiy' ? RIG_DATA[`${faction}_sarkarda_${kind}`] : undefined) ?? RIG_DATA[`${faction}_${kind}`];
  const src = own ?? ownRig(kind, rank);
  if (!src) return undefined;
  const k = `${faction}:${kind}:${rank}:${hex}`;
  let out = tintedRigs.get(k);
  if (!out) {
    const parts: Record<string, RigPart> = {};
    for (const [name, p] of Object.entries(src.parts)) {
      const base = p.img;
      parts[name] = { ...p, img: ready(base) && base instanceof HTMLImageElement ? recolorImage(base, hex, !!own) : base };
    }
    out = { ...src, parts };
    // rasm hali yuklanmagan bo'lsa saqlamaymiz — keyingi chizishda qayta uriniladi
    if (Object.values(src.parts).every((p) => ready(p.img))) tintedRigs.set(k, out);
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
