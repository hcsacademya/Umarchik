import type { Crop } from '../types';
import { battlements, flag, isoBox, isoRoof, shade, TH, TW } from './iso';

/**
 * Kod bilan chiziladigan izometrik binolar. Tayyor rasm (assets) berilsa,
 * map renderer shu rasmlarni ishlatadi, aks holda shu spritelar.
 */

const SW = 140;
const SH = 170;
const AX = SW / 2;
const AY = 132;
const RES = 2;

const cache = new Map<string, HTMLCanvasElement>();

function sprite(key: string, draw: (ctx: CanvasRenderingContext2D, cx: number, cy: number) => void): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = SW * RES;
  c.height = SH * RES;
  const ctx = c.getContext('2d')!;
  ctx.scale(RES, RES);
  ctx.lineJoin = 'round';
  draw(ctx, AX, AY);
  cache.set(key, c);
  return c;
}

export const SPRITE = { w: SW, h: SH, ax: AX, ay: AY };

/** Plitaning tomonlari bo'yicha nuqta (a: x o'qi, b: y o'qi, -1..1 plita yarmi). */
function P(cx: number, cy: number, a: number, b: number): [number, number] {
  return [cx + (a - b) * (TW / 4), cy + (a + b) * (TH / 4)];
}

/** Izometrik prizma, a va b — plita yarmiga nisbatan yarim uzunliklar. */
function prism(ctx: CanvasRenderingContext2D, cx: number, cy: number, a: number, b: number, h: number, color: string, top?: string): void {
  const N = P(cx, cy, -a, -b);
  const E = P(cx, cy, a, -b);
  const S = P(cx, cy, a, b);
  const Wp = P(cx, cy, -a, b);
  ctx.fillStyle = shade(color, -0.1);
  ctx.beginPath();
  ctx.moveTo(Wp[0], Wp[1]);
  ctx.lineTo(S[0], S[1]);
  ctx.lineTo(S[0], S[1] - h);
  ctx.lineTo(Wp[0], Wp[1] - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, -0.32);
  ctx.beginPath();
  ctx.moveTo(S[0], S[1]);
  ctx.lineTo(E[0], E[1]);
  ctx.lineTo(E[0], E[1] - h);
  ctx.lineTo(S[0], S[1] - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = top ?? shade(color, 0.1);
  ctx.beginPath();
  ctx.moveTo(N[0], N[1] - h);
  ctx.lineTo(E[0], E[1] - h);
  ctx.lineTo(S[0], S[1] - h);
  ctx.lineTo(Wp[0], Wp[1] - h);
  ctx.closePath();
  ctx.fill();
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + 3, w / 2, w / 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function door(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  ctx.fillStyle = '#4a2f1b';
  ctx.beginPath();
  ctx.moveTo(x - h * 0.28, y);
  ctx.lineTo(x - h * 0.28, y - h * 0.7);
  ctx.quadraticCurveTo(x, y - h * 1.05, x + h * 0.28, y - h * 0.7);
  ctx.lineTo(x + h * 0.28, y);
  ctx.closePath();
  ctx.fill();
}

function windowSlit(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  ctx.fillStyle = '#2e2620';
  ctx.fillRect(x - 1, y - h, 2.2, h);
}

function tower(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stone: string, roof: string | null, flagColor?: string): void {
  isoBox(ctx, x, y, w, h, stone);
  windowSlit(ctx, x - w * 0.22, y - h * 0.45, 6);
  windowSlit(ctx, x + w * 0.22, y - h * 0.5, 6);
  if (roof) {
    isoRoof(ctx, x, y - h, w * 1.15, w * 0.9, roof);
    if (flagColor) flag(ctx, x, y - h - w * 0.85, 16, flagColor);
  } else {
    battlements(ctx, x, y - h, w, stone);
    if (flagColor) flag(ctx, x, y - h - 2, 18, flagColor);
  }
}

const STONE = '#b8ab92';
const STONE_DARK = '#9a8d75';
const WOOD_ROOF = '#8e4b2c';

/** Yadro qarorgoh: 4 bosqich. */
export function coreSprite(level: number, color: string): HTMLCanvasElement {
  return sprite(`core-${level}-${color}`, (ctx, cx, cy) => {
    shadow(ctx, cx, cy, 70 + level * 8);
    if (level <= 1) {
      // Kichik tosh qal'acha-uycha
      isoBox(ctx, cx, cy, 44, 24, STONE);
      battlements(ctx, cx, cy - 24, 44, STONE_DARK);
      door(ctx, cx - 11, cy + 5, 13);
      flag(ctx, cx + 4, cy - 30, 20, color);
      return;
    }
    if (level === 2) {
      // Minorali uy
      tower(ctx, cx - 14, cy - 8, 20, 48, STONE, null, color);
      isoBox(ctx, cx + 6, cy + 4, 42, 22, STONE);
      isoRoof(ctx, cx + 6, cy + 4 - 22, 46, 18, WOOD_ROOF);
      door(ctx, cx - 6, cy + 13, 12);
      return;
    }
    if (level === 3) {
      // Ikki minorali qo'rg'on
      prism(ctx, cx, cy, 0.62, 0.06, 14, STONE_DARK);
      prism(ctx, cx, cy, 0.06, 0.62, 14, STONE_DARK);
      tower(ctx, cx - 30, cy - 2, 20, 50, STONE, null, color);
      isoBox(ctx, cx + 4, cy + 4, 38, 30, STONE);
      isoRoof(ctx, cx + 4, cy - 26, 42, 20, WOOD_ROOF);
      tower(ctx, cx + 30, cy + 2, 20, 50, STONE, null, color);
      const [x1, y1] = P(cx, cy, 0.62, 0.62);
      prism(ctx, ...P(cx, cy, 0.62, 0), 0.06, 0.62, 12, STONE);
      prism(ctx, ...P(cx, cy, 0, 0.62), 0.62, 0.06, 12, STONE);
      door(ctx, x1 - 18, y1 - 6, 11);
      return;
    }
    // To'liq kichik qal'a
    const wallH = 18;
    prism(ctx, ...P(cx, cy, 0, -0.7), 0.7, 0.07, wallH, STONE_DARK);
    prism(ctx, ...P(cx, cy, -0.7, 0), 0.07, 0.7, wallH, STONE_DARK);
    tower(ctx, ...P(cx, cy, -0.7, -0.7), 18, 42, STONE, null);
    isoBox(ctx, cx, cy - 2, 40, 58, STONE);
    windowSlit(ctx, cx - 9, cy - 30, 8);
    windowSlit(ctx, cx + 9, cy - 34, 8);
    battlements(ctx, cx, cy - 60, 40, STONE_DARK);
    flag(ctx, cx, cy - 64, 26, color);
    tower(ctx, ...P(cx, cy, 0.7, -0.7), 18, 42, STONE, null, color);
    tower(ctx, ...P(cx, cy, -0.7, 0.7), 18, 42, STONE, null, color);
    prism(ctx, ...P(cx, cy, 0.7, 0), 0.07, 0.7, wallH, STONE);
    prism(ctx, ...P(cx, cy, 0, 0.7), 0.7, 0.07, wallH, STONE);
    const [gx, gy] = P(cx, cy, 0.25, 0.77);
    door(ctx, gx, gy, 14);
    tower(ctx, ...P(cx, cy, 0.7, 0.7), 18, 42, STONE, null);
  });
}

/** Imperiya poytaxti: Rim nusxasi yoki Fors nusxasi. */
export function capitalSprite(style: 'rim' | 'fors', color: string): HTMLCanvasElement {
  return sprite(`capital-${style}-${color}`, (ctx, cx, cy) => {
    shadow(ctx, cx, cy, 110);
    if (style === 'rim') {
      const stone = '#ddd6c6';
      prism(ctx, ...P(cx, cy, 0, -0.8), 0.8, 0.07, 20, '#c9c0ad');
      prism(ctx, ...P(cx, cy, -0.8, 0), 0.07, 0.8, 20, '#c9c0ad');
      tower(ctx, ...P(cx, cy, -0.8, -0.8), 20, 46, stone, null, color);
      // ibodatxona ustunlari bilan
      isoBox(ctx, cx, cy, 58, 10, '#e8e2d4');
      for (let i = -2; i <= 2; i++) {
        ctx.fillStyle = '#f4efe4';
        ctx.fillRect(cx - 4 + i * 9 - 2, cy + 6 - Math.abs(i) * 2 - 40, 4, 30);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(cx - 4 + i * 9 + 1, cy + 6 - Math.abs(i) * 2 - 40, 1.2, 30);
      }
      isoBox(ctx, cx, cy - 34, 62, 6, '#e8e2d4');
      isoRoof(ctx, cx, cy - 40, 64, 20, '#b6452b');
      tower(ctx, ...P(cx, cy, 0.8, -0.8), 20, 46, stone, null, color);
      tower(ctx, ...P(cx, cy, -0.8, 0.8), 20, 46, stone, null, color);
      prism(ctx, ...P(cx, cy, 0.8, 0), 0.07, 0.8, 18, '#d9d1bf');
      prism(ctx, ...P(cx, cy, 0, 0.8), 0.8, 0.07, 18, '#d9d1bf');
      tower(ctx, ...P(cx, cy, 0.8, 0.8), 20, 46, stone, null);
      return;
    }
    const sand = '#dcc493';
    prism(ctx, ...P(cx, cy, 0, -0.8), 0.8, 0.07, 18, '#c8ad7a');
    prism(ctx, ...P(cx, cy, -0.8, 0), 0.07, 0.8, 18, '#c8ad7a');
    minaret(ctx, ...P(cx, cy, -0.8, -0.8), 12, 56, sand);
    isoBox(ctx, cx, cy, 56, 30, sand);
    dome(ctx, cx, cy - 30, 22, '#2b9c97');
    door(ctx, cx - 14, cy + 10, 14);
    minaret(ctx, ...P(cx, cy, 0.8, -0.8), 12, 56, sand);
    minaret(ctx, ...P(cx, cy, -0.8, 0.8), 12, 56, sand);
    prism(ctx, ...P(cx, cy, 0.8, 0), 0.07, 0.8, 16, '#e2cc9f');
    prism(ctx, ...P(cx, cy, 0, 0.8), 0.8, 0.07, 16, '#e2cc9f');
    minaret(ctx, ...P(cx, cy, 0.8, 0.8), 12, 56, sand);
    flag(ctx, cx, cy - 74, 22, color);
  });
}

function dome(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.7, r * 0.1, x, y - r * 0.4, r * 1.2);
  g.addColorStop(0, shade(color, 0.45));
  g.addColorStop(1, shade(color, -0.25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.bezierCurveTo(x - r, y - r * 1.2, x - r * 0.2, y - r * 1.5, x, y - r * 1.7);
  ctx.bezierCurveTo(x + r * 0.2, y - r * 1.5, x + r, y - r * 1.2, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e9c14a';
  ctx.fillRect(x - 1, y - r * 1.95, 2, r * 0.3);
}

function minaret(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  isoBox(ctx, x, y, w, h, color);
  isoBox(ctx, x, y - h, w * 1.35, 3, shade(color, -0.1));
  dome(ctx, x, y - h - 3, w * 0.55, '#2b9c97');
}

export function citySprite(style: 'rim' | 'fors', color: string): HTMLCanvasElement {
  return sprite(`city-${style}-${color}`, (ctx, cx, cy) => {
    shadow(ctx, cx, cy, 90);
    if (style === 'rim') {
      const wall = '#e2dccd';
      const roof = '#b6452b';
      const house = (x: number, y: number, w: number, h: number) => {
        isoBox(ctx, x, y, w, h, wall);
        isoRoof(ctx, x, y - h, w + 4, w * 0.35, roof);
      };
      house(cx - 6, cy - 16, 26, 18);
      house(cx + 20, cy - 4, 24, 16);
      house(cx - 26, cy - 2, 24, 14);
      // forum
      isoBox(ctx, cx, cy + 8, 34, 6, '#ece6d8');
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = '#f6f2e8';
        ctx.fillRect(cx + i * 9 - 1.5, cy + 2 - 22, 3, 20);
      }
      isoBox(ctx, cx, cy - 14, 36, 4, '#ece6d8');
      isoRoof(ctx, cx, cy - 18, 38, 12, roof);
      flag(ctx, cx + 22, cy - 22, 16, color);
      return;
    }
    const sand = '#e0c995';
    const house = (x: number, y: number, w: number, h: number, d = false) => {
      isoBox(ctx, x, y, w, h, sand);
      if (d) dome(ctx, x, y - h, w * 0.32, '#2b9c97');
    };
    house(cx - 8, cy - 16, 24, 20, true);
    house(cx + 20, cy - 4, 22, 14);
    house(cx - 26, cy - 2, 22, 16);
    minaret(ctx, cx + 4, cy + 2, 9, 38, sand);
    house(cx + 2, cy + 14, 26, 12, true);
    flag(ctx, cx - 26, cy - 22, 16, color);
  });
}

export function farmSprite(crop: Crop, level: number): HTMLCanvasElement {
  return sprite(`farm-${crop}-${level}`, (ctx, cx, cy) => {
    const c1 = crop === 'bugdoy' ? '#d9b44a' : '#c7c27c';
    const c2 = crop === 'bugdoy' ? '#b8902f' : '#a6a160';
    // dala qatorlari
    for (let i = -4; i <= 4; i++) {
      const t = i / 4.6;
      const [x0, y0] = P(cx, cy, -0.82, t * 0.82);
      const [x1, y1] = P(cx, cy, 0.82, t * 0.82);
      ctx.strokeStyle = i % 2 === 0 ? c1 : c2;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      // boshoqlar
      ctx.strokeStyle = shade(c1, 0.2);
      ctx.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const f = (k + 0.5) / 5;
        const x = x0 + (x1 - x0) * f;
        const y = y0 + (y1 - y0) * f;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.5, y - 4);
        ctx.stroke();
      }
    }
    // kulba
    const [hx, hy] = P(cx, cy, -0.55, -0.55);
    isoBox(ctx, hx, hy, 16, 10, '#a98a62');
    isoRoof(ctx, hx, hy - 10, 19, 9, '#c9a560');
    if (level >= 2) {
      // xashak g'aramlari
      const [sx, sy] = P(cx, cy, 0.55, -0.45);
      haystack(ctx, sx, sy);
      if (level >= 3) haystack(ctx, ...P(cx, cy, 0.6, 0.1));
    }
  });
}

function haystack(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#d6b24f';
  ctx.beginPath();
  ctx.ellipse(x, y - 4, 6, 7, 0, Math.PI, 0);
  ctx.lineTo(x + 6, y);
  ctx.lineTo(x - 6, y);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x, y - 9, 6, 9);
}

function sheep(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 2, y);
  ctx.lineTo(x - 2, y - 2);
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + 2, y - 2);
  ctx.stroke();
  ctx.fillStyle = '#f2efe6';
  ctx.beginPath();
  ctx.ellipse(x, y - 4, 5, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b3632';
  ctx.beginPath();
  ctx.ellipse(x + dir * 5, y - 5, 1.8, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function pastureSprite(level: number): HTMLCanvasElement {
  return sprite(`pasture-${level}`, (ctx, cx, cy) => {
    // to'siq
    const corners: [number, number][] = [P(cx, cy, -0.75, -0.75), P(cx, cy, 0.75, -0.75), P(cx, cy, 0.75, 0.75), P(cx, cy, -0.75, 0.75)];
    ctx.strokeStyle = '#7a5532';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = corners[i];
      const [x1, y1] = corners[(i + 1) % 4];
      ctx.moveTo(x0, y0 - 6);
      ctx.lineTo(x1, y1 - 6);
      ctx.moveTo(x0, y0 - 3);
      ctx.lineTo(x1, y1 - 3);
      for (let k = 0; k <= 4; k++) {
        const x = x0 + ((x1 - x0) * k) / 4;
        const y = y0 + ((y1 - y0) * k) / 4;
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 8);
      }
    }
    ctx.stroke();
    const n = 3 + Math.min(4, level);
    const spots: [number, number][] = [
      [-0.3, -0.2], [0.2, -0.35], [0.35, 0.15], [-0.1, 0.3], [-0.45, 0.25], [0.45, -0.1], [0.05, 0.0],
    ];
    for (let i = 0; i < n; i++) {
      const [a, b] = spots[i];
      const [x, y] = P(cx, cy, a, b);
      sheep(ctx, x, y, i % 2 ? 1 : -1);
    }
    const [hx, hy] = P(cx, cy, -0.5, -0.55);
    isoBox(ctx, hx, hy, 14, 9, '#9b7b55');
    isoRoof(ctx, hx, hy - 9, 17, 8, '#7f6a4a');
  });
}

export function mineSprite(level: number): HTMLCanvasElement {
  return sprite(`mine-${level}`, (ctx, cx, cy) => {
    shadow(ctx, cx, cy, 60);
    // tosh tepalik
    ctx.fillStyle = '#8c8478';
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy + 4);
    ctx.quadraticCurveTo(cx - 24, cy - 30, cx - 2, cy - 34);
    ctx.quadraticCurveTo(cx + 22, cy - 30, cx + 32, cy + 2);
    ctx.quadraticCurveTo(cx, cy + 14, cx - 34, cy + 4);
    ctx.fill();
    ctx.fillStyle = '#6f685e';
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy - 34);
    ctx.quadraticCurveTo(cx + 22, cy - 30, cx + 32, cy + 2);
    ctx.quadraticCurveTo(cx + 12, cy + 10, cx + 2, cy + 8);
    ctx.closePath();
    ctx.fill();
    // kirish
    ctx.fillStyle = '#211c18';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 4);
    ctx.lineTo(cx - 12, cy - 10);
    ctx.quadraticCurveTo(cx - 4, cy - 18, cx + 4, cy - 10);
    ctx.lineTo(cx + 4, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a5532';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 5);
    ctx.lineTo(cx - 13, cy - 12);
    ctx.lineTo(cx + 5, cy - 12);
    ctx.lineTo(cx + 5, cy + 7);
    ctx.stroke();
    // aravacha
    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(cx + 10, cy - 2, 12, 6);
    ctx.fillStyle = '#cfd6dc';
    ctx.beginPath();
    ctx.ellipse(cx + 16, cy - 3, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(cx + 12, cy + 5, 1.8, 0, Math.PI * 2);
    ctx.arc(cx + 20, cy + 5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // kumush yaltirashi
    ctx.fillStyle = '#f4f7fa';
    for (const [sx, sy] of [[-18, -14], [8, -24], [20, -10], [-24, -4]].slice(0, 2 + Math.min(2, level))) sparkle(ctx, cx + sx, cy + sy, 2.5);
  });
}

export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2);
  ctx.lineTo(x + r * 0.5, y - r * 0.5);
  ctx.lineTo(x + r * 2, y);
  ctx.lineTo(x + r * 0.5, y + r * 0.5);
  ctx.lineTo(x, y + r * 2);
  ctx.lineTo(x - r * 0.5, y + r * 0.5);
  ctx.lineTo(x - r * 2, y);
  ctx.lineTo(x - r * 0.5, y - r * 0.5);
  ctx.closePath();
  ctx.fill();
}

export function towerSprite(level: number, color: string): HTMLCanvasElement {
  return sprite(`tower-${level}-${color}`, (ctx, cx, cy) => {
    shadow(ctx, cx, cy, 34);
    const h = 52 + level * 7;
    isoBox(ctx, cx, cy, 22, h, STONE);
    windowSlit(ctx, cx - 5, cy - h * 0.4, 7);
    windowSlit(ctx, cx + 5, cy - h * 0.6, 7);
    isoBox(ctx, cx, cy - h, 28, 4, STONE_DARK);
    battlements(ctx, cx, cy - h - 4, 28, STONE_DARK);
    flag(ctx, cx, cy - h - 6, 20, color);
    // mash'al
    ctx.fillStyle = 'rgba(255,190,70,0.9)';
    ctx.beginPath();
    ctx.arc(cx + 9, cy - h - 10, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function fortSprite(level: number, color: string): HTMLCanvasElement {
  return sprite(`fort-${level}-${color}`, (ctx, cx, cy) => {
    shadow(ctx, cx, cy, 80);
    const h = 14 + level * 3;
    const s = 0.6;
    prism(ctx, ...P(cx, cy, 0, -s), s, 0.07, h, STONE_DARK);
    prism(ctx, ...P(cx, cy, -s, 0), 0.07, s, h, STONE_DARK);
    tower(ctx, ...P(cx, cy, -s, -s), 16, h + 18, STONE, null);
    if (level >= 3) tower(ctx, ...P(cx, cy, s, -s), 16, h + 18, STONE, null, color);
    if (level >= 2) tower(ctx, ...P(cx, cy, -s, s), 16, h + 18, STONE, null, color);
    prism(ctx, ...P(cx, cy, s, 0), 0.07, s, h, STONE);
    prism(ctx, ...P(cx, cy, 0, s), s, 0.07, h, STONE);
    const [gx, gy] = P(cx, cy, 0.2, 0.67);
    door(ctx, gx, gy, 12);
    tower(ctx, ...P(cx, cy, s, s), 16, h + 18, STONE, null, level < 2 ? color : undefined);
  });
}

/** Xaritadagi qo'shin belgisi (har kadr chiziladi). */
export function drawArmyMarker(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, count: string, enemy: boolean, t: number): void {
  const bob = Math.sin(t * 8) * 1.2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -1; i <= 1; i++) {
    const sx = x + i * 8;
    const sy = y + Math.abs(i) * -2 + (i === 0 ? bob : -bob);
    ctx.fillStyle = '#4a3b2a';
    ctx.fillRect(sx - 2.5, sy - 6, 2, 6);
    ctx.fillRect(sx + 0.5, sy - 6, 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(sx - 3.5, sy - 14, 7, 9);
    ctx.fillStyle = '#e8c9a0';
    ctx.beginPath();
    ctx.arc(sx, sy - 17, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8d939a';
    ctx.beginPath();
    ctx.arc(sx, sy - 18, 3.2, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#c9c9c9';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx + 4, sy - 4);
    ctx.lineTo(sx + 4, sy - 26);
    ctx.stroke();
  }
  flag(ctx, x - 1, y - 18 + bob, 22, color);
  ctx.font = 'bold 12px system-ui, sans-serif';
  const w = ctx.measureText(count).width + 10;
  ctx.fillStyle = enemy ? 'rgba(150,20,20,0.92)' : 'rgba(20,40,80,0.9)';
  roundRect(ctx, x - w / 2, y + 6, w, 16, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(count, x, y + 14.5);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
