import { ALL_UNITS, UNITS } from './config';
import type { Army, UnitType } from './types';

/** Deterministik tasodifiy sonlar (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Silliq qiymatli shovqin, 0..1. */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = s(xf);
  const v = s(yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function fbm(x: number, y: number, seed: number): number {
  return valueNoise(x, y, seed) * 0.6 + valueNoise(x * 2.1, y * 2.1, seed + 7) * 0.3 + valueNoise(x * 4.3, y * 4.3, seed + 13) * 0.1;
}

/** Plita bo'yicha barqaror tasodif (render bezaklari uchun). */
export function tileRand(x: number, y: number, k = 0): number {
  return hash2(x, y, 9001 + k);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function armyCount(a: Army, includeHeroes = true): number {
  let n = 0;
  for (const k of ALL_UNITS) {
    if (!includeHeroes && UNITS[k].hero) continue;
    n += a[k] ?? 0;
  }
  return n;
}

export function armyAdd(a: Army, b: Army, sign = 1): Army {
  const out: Army = { ...a };
  for (const k of ALL_UNITS) {
    const v = (out[k] ?? 0) + sign * (b[k] ?? 0);
    if (v > 0) out[k] = v;
    else delete out[k];
  }
  return out;
}

export function armyEmpty(a: Army): boolean {
  return armyCount(a) === 0;
}

export function armyEntries(a: Army): [UnitType, number][] {
  return ALL_UNITS.filter((k) => (a[k] ?? 0) > 0).map((k) => [k, a[k] as number]);
}

export function fmt(n: number): string {
  const v = Math.floor(n);
  if (Math.abs(v) >= 100000) return (v / 1000).toFixed(0) + 'k';
  if (Math.abs(v) >= 10000) return (v / 1000).toFixed(1) + 'k';
  return String(v);
}

export function dayLabel(day: number): string {
  return `${Math.floor(day) + 1}-kun`;
}

export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
