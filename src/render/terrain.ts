import { GAME, TERRAIN_INFO } from '../config';
import type { GameState, Tile } from '../types';
import { tileRand } from '../util';
import { tileAt } from '../world/mapgen';
import { getAsset } from './assets';
import { diamondPath, shade, tileCenter, TH, TW, WORLD_H, WORLD_W } from './iso';
import { sparkle } from './sprites';

/**
 * Yer qatlami bir marta oldindan chiziladi (relyef, daraxtlar, tog'lar, daryo
 * va viloyat chegaralari). Har kadrda faqat shu rasm siljitiladi.
 */
export function renderTerrainLayer(s: GameState): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD_W;
  c.height = WORLD_H;
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const bg = getAsset('map_background');
  if (bg) {
    // Tayyor umumiy xarita rasmi berilgan bo'lsa — uni fon qilib qo'yamiz.
    ctx.drawImage(bg.img, 0, 0, WORLD_W, WORLD_H);
  } else {
    // 1) asosiy romblar
    for (let sum = 0; sum <= GAME.mapW + GAME.mapH - 2; sum++) {
      for (let x = 0; x <= sum; x++) {
        const y = sum - x;
        const t = tileAt(s.tiles, x, y);
        if (t) baseTile(ctx, s, t);
      }
    }
    // 2) bezaklar (orqadan oldinga)
    for (let sum = 0; sum <= GAME.mapW + GAME.mapH - 2; sum++) {
      for (let x = 0; x <= sum; x++) {
        const y = sum - x;
        const t = tileAt(s.tiles, x, y);
        if (t) decorate(ctx, t);
      }
    }
  }
  // 3) viloyat chegaralari — oltin nuqtali chiziq
  ctx.save();
  ctx.setLineDash([3, 6]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(60,40,0,0.45)';
  provinceBorders(ctx, s, 1.5);
  ctx.strokeStyle = '#f2cc4f';
  ctx.lineWidth = 2.4;
  provinceBorders(ctx, s, 0);
  ctx.restore();
  // 4) xarita qirrasi
  const n = tileCenter(0, 0);
  const e = tileCenter(GAME.mapW - 1, 0);
  const so = tileCenter(GAME.mapW - 1, GAME.mapH - 1);
  const w = tileCenter(0, GAME.mapH - 1);
  ctx.strokeStyle = 'rgba(40,28,10,0.7)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(n.x, n.y - TH / 2);
  ctx.lineTo(e.x + TW / 2, e.y);
  ctx.lineTo(so.x, so.y + TH / 2);
  ctx.lineTo(w.x - TW / 2, w.y);
  ctx.closePath();
  ctx.stroke();
  return c;
}

function provinceBorders(ctx: CanvasRenderingContext2D, s: GameState, off: number): void {
  ctx.beginPath();
  for (const t of s.tiles) {
    const { x: cx, y: cy } = tileCenter(t.x, t.y);
    const T = [cx, cy - TH / 2 + off];
    const Rr = [cx + TW / 2, cy + off];
    const B = [cx, cy + TH / 2 + off];
    const L = [cx - TW / 2, cy + off];
    const r = tileAt(s.tiles, t.x + 1, t.y);
    const d = tileAt(s.tiles, t.x, t.y + 1);
    if (r && r.province !== t.province) {
      ctx.moveTo(Rr[0], Rr[1]);
      ctx.lineTo(B[0], B[1]);
    }
    if (d && d.province !== t.province) {
      ctx.moveTo(B[0], B[1]);
      ctx.lineTo(L[0], L[1]);
    }
    void T;
  }
  ctx.stroke();
}

function baseTile(ctx: CanvasRenderingContext2D, s: GameState, t: Tile): void {
  const { x: cx, y: cy } = tileCenter(t.x, t.y);
  const base = TERRAIN_INFO[t.terrain].color;
  const v = (tileRand(t.x, t.y) - 0.5) * 0.1;
  const g = ctx.createLinearGradient(cx, cy - TH / 2, cx, cy + TH / 2);
  g.addColorStop(0, shade(base, 0.06 + v));
  g.addColorStop(1, shade(base, -0.06 + v));
  ctx.fillStyle = g;
  diamondPath(ctx, cx, cy, TW + 1.5, TH + 1);
  ctx.fill();
  // Suv qirg'oqlari
  if (t.terrain === 'daryo' || t.terrain === 'kol') {
    ctx.strokeStyle = 'rgba(220,205,150,0.75)';
    ctx.lineWidth = 3;
    const edges: [number, number, number[], number[]][] = [
      [1, 0, [cx + TW / 2, cy], [cx, cy + TH / 2]],
      [0, 1, [cx, cy + TH / 2], [cx - TW / 2, cy]],
      [-1, 0, [cx - TW / 2, cy], [cx, cy - TH / 2]],
      [0, -1, [cx, cy - TH / 2], [cx + TW / 2, cy]],
    ];
    for (const [dx, dy, a, b] of edges) {
      const n = tileAt(s.tiles, t.x + dx, t.y + dy);
      if (n && n.terrain !== 'daryo' && n.terrain !== 'kol') {
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
    }
  }
}

function tuft(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, s = 1): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, y);
  ctx.lineTo(x - 3 * s, y - 4 * s);
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 5 * s);
  ctx.moveTo(x + 2 * s, y);
  ctx.lineTo(x + 3 * s, y - 4 * s);
  ctx.stroke();
}

function inDiamond(t: Tile, k: number, margin = 0.7): [number, number] {
  const { x: cx, y: cy } = tileCenter(t.x, t.y);
  const a = (tileRand(t.x, t.y, k) * 2 - 1) * margin;
  const b = (tileRand(t.x, t.y, k + 50) * 2 - 1) * margin;
  return [cx + (a - b) * (TW / 4), cy + (a + b) * (TH / 4)];
}

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, kind: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 1, h * 0.32, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5b3d22';
  ctx.fillRect(x - 1.5, y - h * 0.35, 3, h * 0.35);
  if (kind < 0.55) {
    // archa
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const w = h * (0.42 - i * 0.1);
      const yy = y - h * 0.25 - i * h * 0.22;
      ctx.fillStyle = shade('#2f5a2b', i * 0.06);
      ctx.beginPath();
      ctx.moveTo(x - w, yy);
      ctx.lineTo(x, yy - h * 0.38);
      ctx.lineTo(x + w, yy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.moveTo(x, yy - h * 0.38);
      ctx.lineTo(x + w, yy);
      ctx.lineTo(x, yy);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // bargli daraxt
    ctx.fillStyle = '#3f6d33';
    ctx.beginPath();
    ctx.arc(x, y - h * 0.62, h * 0.3, 0, Math.PI * 2);
    ctx.arc(x - h * 0.18, y - h * 0.48, h * 0.22, 0, Math.PI * 2);
    ctx.arc(x + h * 0.18, y - h * 0.5, h * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.arc(x - h * 0.08, y - h * 0.72, h * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
}

function mountain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, snow: boolean, seed: number): void {
  const peakX = x + (seed - 0.5) * w * 0.3;
  const base = snow ? '#9d9a95' : '#8d7c63';
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(x + 4, y + 2, w * 0.55, w * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(base, 0.1);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(peakX, y - h);
  ctx.lineTo(peakX + w * 0.05, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(base, -0.25);
  ctx.beginPath();
  ctx.moveTo(peakX, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(peakX + w * 0.05, y + 2);
  ctx.closePath();
  ctx.fill();
  // qoyalar chizig'i
  ctx.strokeStyle = 'rgba(40,30,20,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(peakX - w * 0.12, y - h * 0.55);
  ctx.lineTo(peakX - w * 0.05, y - h * 0.35);
  ctx.moveTo(peakX + w * 0.12, y - h * 0.5);
  ctx.lineTo(peakX + w * 0.2, y - h * 0.3);
  ctx.stroke();
  if (snow || h > 40) {
    const sh = h * (snow ? 0.42 : 0.2);
    ctx.fillStyle = '#f5f7fa';
    ctx.beginPath();
    ctx.moveTo(peakX, y - h);
    ctx.lineTo(peakX - (w / 2) * (sh / h) * 1.05, y - h + sh);
    ctx.lineTo(peakX - w * 0.05, y - h + sh * 0.75);
    ctx.lineTo(peakX + w * 0.04, y - h + sh * 1.05);
    ctx.lineTo(peakX + (w / 2) * (sh / h), y - h + sh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(120,140,170,0.35)';
    ctx.beginPath();
    ctx.moveTo(peakX, y - h);
    ctx.lineTo(peakX + w * 0.04, y - h + sh * 1.05);
    ctx.lineTo(peakX + (w / 2) * (sh / h), y - h + sh);
    ctx.closePath();
    ctx.fill();
  }
}

function decorate(ctx: CanvasRenderingContext2D, t: Tile): void {
  const { x: cx, y: cy } = tileCenter(t.x, t.y);
  const r = (k: number) => tileRand(t.x, t.y, k);
  switch (t.terrain) {
    case 'tekislik':
    case 'vodiy':
    case 'unumdor':
    case 'yaylov': {
      const col = t.terrain === 'yaylov' ? '#8e9a3f' : t.terrain === 'unumdor' ? '#4b7a2c' : '#6f9440';
      const n = 3 + Math.floor(r(1) * 4);
      for (let i = 0; i < n; i++) {
        const [x, y] = inDiamond(t, 10 + i);
        tuft(ctx, x, y, col, 0.9 + r(20 + i) * 0.5);
      }
      if (t.terrain === 'vodiy') {
        for (let i = 0; i < 4; i++) {
          const [x, y] = inDiamond(t, 40 + i);
          ctx.fillStyle = i % 2 ? '#f4e27a' : '#f6f2ea';
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (r(3) < 0.12 && t.terrain !== 'yaylov') {
        const [x, y] = inDiamond(t, 60, 0.5);
        tree(ctx, x, y, 22, r(4));
      }
      if (t.terrain === 'yaylov' && r(5) < 0.25) {
        const [x, y] = inDiamond(t, 70, 0.5);
        ctx.fillStyle = '#8f8a7e';
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'orman': {
      const pts: [number, number, number][] = [];
      const n = 4 + Math.floor(r(1) * 3);
      for (let i = 0; i < n; i++) {
        const [x, y] = inDiamond(t, 10 + i, 0.75);
        pts.push([x, y, r(30 + i)]);
      }
      pts.sort((a, b) => a[1] - b[1]);
      for (const [x, y, k] of pts) tree(ctx, x, y, 26 + k * 14, k);
      break;
    }
    case 'tog':
    case 'qorli_tog': {
      const snow = t.terrain === 'qorli_tog';
      const h = snow ? 58 + r(1) * 24 : 34 + r(1) * 22;
      mountain(ctx, cx - 10, cy + 6, TW * 0.55, h * 0.7, snow, r(2));
      mountain(ctx, cx + 4, cy + 10, TW * 0.75, h, snow, r(3));
      break;
    }
    case 'chol': {
      ctx.strokeStyle = 'rgba(160,120,60,0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const [x, y] = inDiamond(t, 10 + i, 0.5);
        ctx.beginPath();
        ctx.arc(x, y + 6, 10, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      if (r(5) < 0.2) {
        const [x, y] = inDiamond(t, 20, 0.4);
        ctx.fillStyle = '#6f8a3c';
        ctx.fillRect(x - 1.5, y - 10, 3, 10);
        ctx.fillRect(x - 5, y - 7, 3, 2);
        ctx.fillRect(x - 5, y - 9, 2, 3);
      }
      break;
    }
    case 'daryo':
    case 'kol': {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.2;
      const n = t.terrain === 'kol' ? 2 : 2;
      for (let i = 0; i < n; i++) {
        const [x, y] = inDiamond(t, 10 + i, 0.5);
        ctx.beginPath();
        ctx.moveTo(x - 7, y);
        ctx.quadraticCurveTo(x - 3.5, y - 3, x, y);
        ctx.quadraticCurveTo(x + 3.5, y + 3, x + 7, y);
        ctx.stroke();
      }
      break;
    }
  }
  if (t.deposit && t.building === 'none') {
    // Kumush koni belgisi
    ctx.fillStyle = '#7c7c80';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 12);
    ctx.lineTo(cx - 6, cy + 2);
    ctx.lineTo(cx + 4, cy + 1);
    ctx.lineTo(cx + 11, cy + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eef3f7';
    sparkle(ctx, cx - 3, cy + 6, 2);
    sparkle(ctx, cx + 5, cy + 8, 1.5);
  }
}
