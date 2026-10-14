import { GAME } from '../config';

export const TW = 96;
export const TH = 48;
export const ORIGIN_X = GAME.mapH * (TW / 2) + 40;
export const ORIGIN_Y = 90;
export const WORLD_W = (GAME.mapW + GAME.mapH) * (TW / 2) + 80;
export const WORLD_H = (GAME.mapW + GAME.mapH) * (TH / 2) + ORIGIN_Y + 40;

/** Plita markazining dunyo koordinatasi. */
export function tileCenter(x: number, y: number): { x: number; y: number } {
  return {
    x: (x - y) * (TW / 2) + ORIGIN_X,
    y: (x + y) * (TH / 2) + TH / 2 + ORIGIN_Y,
  };
}

export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  const a = (wx - ORIGIN_X) / (TW / 2);
  const b = (wy - ORIGIN_Y - TH / 2) / (TH / 2);
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}

export function diamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w = TW, h = TH): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Izometrik quti: (cx,cy) yerdagi asos markazi, w eni, h balandligi. */
export function isoBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color: string,
  topColor?: string,
): void {
  const hw = w / 2;
  const hd = w / 4;
  // chap yuz
  ctx.fillStyle = shade(color, -0.08);
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hd);
  ctx.lineTo(cx, cy + hd - h);
  ctx.lineTo(cx - hw, cy - h);
  ctx.closePath();
  ctx.fill();
  // o'ng yuz
  ctx.fillStyle = shade(color, -0.3);
  ctx.beginPath();
  ctx.moveTo(cx, cy + hd);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx + hw, cy - h);
  ctx.lineTo(cx, cy + hd - h);
  ctx.closePath();
  ctx.fill();
  // tepa
  ctx.fillStyle = topColor ?? shade(color, 0.12);
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy - h);
  ctx.lineTo(cx, cy - hd - h);
  ctx.lineTo(cx + hw, cy - h);
  ctx.lineTo(cx, cy + hd - h);
  ctx.closePath();
  ctx.fill();
}

/** Piramida tom. */
export function isoRoof(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, color: string): void {
  const hw = w / 2;
  const hd = w / 4;
  ctx.fillStyle = shade(color, -0.05);
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hd);
  ctx.lineTo(cx, cy - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, -0.32);
  ctx.beginPath();
  ctx.moveTo(cx, cy + hd);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, 0.1);
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy - hd);
  ctx.lineTo(cx, cy - h);
  ctx.closePath();
  ctx.fill();
}

/** Qal'a tishlari (krenellyatsiya) quti tepasida. */
export function battlements(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, color: string): void {
  const hw = w / 2;
  const hd = w / 4;
  const n = Math.max(2, Math.round(w / 10));
  const bw = w / (n * 2.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // chap qirra
    isoBox(ctx, cx - hw + t * hw, cy + t * hd, bw, bw * 0.9, color);
  }
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    isoBox(ctx, cx + t * hw, cy + hd - t * hd, bw, bw * 0.9, color);
  }
}

export function flag(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string): void {
  ctx.strokeStyle = '#3b2b1a';
  ctx.lineWidth = Math.max(1, h / 18);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.quadraticCurveTo(x + h * 0.35, y - h * 0.92, x + h * 0.55, y - h * 0.82);
  ctx.lineTo(x + h * 0.5, y - h * 0.62);
  ctx.quadraticCurveTo(x + h * 0.3, y - h * 0.7, x, y - h * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}
