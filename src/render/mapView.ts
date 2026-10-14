import { GAME } from '../config';
import { tileGoods, storeCap } from '../game/economy';
import { coreInfo } from '../game/state';
import { armyPos } from '../game/sim';
import type { GameState, Tile } from '../types';
import { armyCount, clamp } from '../util';
import { neighbors4, tileAt } from '../world/mapgen';
import { getAsset } from './assets';
import { Camera, diamondPath, tileCenter, TH, TW, withAlpha, worldToTile, WORLD_H, WORLD_W } from './iso';
import {
  capitalSprite,
  citySprite,
  coreSprite,
  drawArmyMarker,
  farmSprite,
  fortSprite,
  mineSprite,
  pastureSprite,
  roundRect,
  SPRITE,
  towerSprite,
} from './sprites';
import { renderTerrainLayer } from './terrain';

export interface MapViewHandlers {
  onTileTap: (t: Tile) => void;
}

export class MapView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  cam: Camera = { x: 0, y: 0, zoom: 0.8 };
  private terrain: HTMLCanvasElement | null = null;
  private terrainSeed = -1;
  private dpr = 1;
  selected: Tile | null = null;
  /** Nishon tanlash rejimi: qaysi plitalarni yoritish. */
  highlight: ((t: Tile) => boolean) | null = null;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private pinchDist = 0;
  private moved = false;
  visible = true;
  private time = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private getState: () => GameState,
    private handlers: MapViewHandlers,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.bindInput();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.clampCam();
  }

  invalidateTerrain(): void {
    this.terrain = null;
  }

  centerOn(x: number, y: number, zoom?: number): void {
    const c = tileCenter(x, y);
    this.cam.x = c.x;
    this.cam.y = c.y;
    if (zoom) this.cam.zoom = zoom;
    this.clampCam();
  }

  private minZoom(): number {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    return Math.max(0.25, Math.min(w / WORLD_W, h / WORLD_H) * 0.95);
  }

  private clampCam(): void {
    this.cam.zoom = clamp(this.cam.zoom, this.minZoom(), 2.2);
    this.cam.x = clamp(this.cam.x, 0, WORLD_W);
    this.cam.y = clamp(this.cam.y, 0, WORLD_H);
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    return { x: (sx - w / 2) / this.cam.zoom + this.cam.x, y: (sy - h / 2) / this.cam.zoom + this.cam.y };
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      this.pointers.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now() });
      if (this.pointers.size === 1) this.moved = false;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.moved = true;
      }
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (this.pointers.size === 1) {
        if (Math.hypot(x - p.sx, y - p.sy) > 8) this.moved = true;
        if (this.moved) {
          this.cam.x -= (x - p.x) / this.cam.zoom;
          this.cam.y -= (y - p.y) / this.cam.zoom;
          this.clampCam();
        }
      }
      p.x = x;
      p.y = y;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / this.pinchDist);
        this.pinchDist = d;
      }
    });
    const up = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!p) return;
      if (!this.moved && this.pointers.size === 0 && performance.now() - p.t < 600) {
        const w = this.screenToWorld(p.x, p.y);
        const tp = this.pickTile(w.x, w.y);
        if (tp) this.handlers.onTileTap(tp);
      }
      if (this.pointers.size < 2) this.pinchDist = 0;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => {
      this.pointers.delete(e.pointerId);
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = c.getBoundingClientRect();
        this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
      },
      { passive: false },
    );
  }

  private zoomAt(sx: number, sy: number, f: number): void {
    const before = this.screenToWorld(sx, sy);
    this.cam.zoom = clamp(this.cam.zoom * f, this.minZoom(), 2.2);
    const after = this.screenToWorld(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.clampCam();
  }

  zoomBy(f: number): void {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    this.zoomAt(w / 2, h / 2, f);
  }

  private pickTile(wx: number, wy: number): Tile | null {
    const s = this.getState();
    const t = worldToTile(wx, wy);
    return tileAt(s.tiles, t.x, t.y);
  }

  // ---------------- Chizish ----------------

  render(dt: number): void {
    if (!this.visible) return;
    this.time += dt;
    const s = this.getState();
    if (!this.terrain || this.terrainSeed !== s.seed) {
      this.terrain = renderTerrainLayer(s);
      this.terrainSeed = s.seed;
    }
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#20303a';
    ctx.fillRect(0, 0, W, H);
    const z = this.cam.zoom * this.dpr;
    ctx.setTransform(z, 0, 0, z, W / 2 - this.cam.x * z, H / 2 - this.cam.y * z);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.terrain, 0, 0);

    const view = this.viewRect();
    const vis = (t: Tile) => {
      const c = tileCenter(t.x, t.y);
      return c.x > view.x0 - TW && c.x < view.x1 + TW && c.y > view.y0 - TH && c.y < view.y1 + TH * 3;
    };

    this.drawOwnership(s, vis);
    this.drawHighlights(s, vis);
    this.drawBuildings(s, vis);
    this.drawArmies(s);
    this.drawProvinceLabels(s);
  }

  private viewRect() {
    const w = this.canvas.width / this.dpr / this.cam.zoom;
    const h = this.canvas.height / this.dpr / this.cam.zoom;
    return { x0: this.cam.x - w / 2, x1: this.cam.x + w / 2, y0: this.cam.y - h / 2, y1: this.cam.y + h / 2 };
  }

  private drawOwnership(s: GameState, vis: (t: Tile) => boolean): void {
    const ctx = this.ctx;
    for (const t of s.tiles) {
      if (t.owner < 0 || !vis(t)) continue;
      const f = s.factions[t.owner];
      const { x, y } = tileCenter(t.x, t.y);
      ctx.fillStyle = withAlpha(f.color, t.owner === s.playerId ? 0.26 : 0.2);
      diamondPath(ctx, x, y, TW - 2, TH - 1);
      ctx.fill();
    }
    // Davlat chegaralari
    ctx.lineWidth = 2.2;
    for (const t of s.tiles) {
      if (t.owner < 0 || !vis(t)) continue;
      const f = s.factions[t.owner];
      const { x: cx, y: cy } = tileCenter(t.x, t.y);
      const T = [cx, cy - TH / 2 + 1.5];
      const Rr = [cx + TW / 2 - 3, cy];
      const B = [cx, cy + TH / 2 - 1.5];
      const L = [cx - TW / 2 + 3, cy];
      const edges: [number, number, number[], number[]][] = [
        [1, 0, Rr, B],
        [0, 1, B, L],
        [-1, 0, L, T],
        [0, -1, T, Rr],
      ];
      ctx.strokeStyle = f.color;
      ctx.beginPath();
      for (const [dx, dy, a, b] of edges) {
        const n = tileAt(s.tiles, t.x + dx, t.y + dy);
        if (!n || n.owner !== t.owner) {
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
      }
      ctx.stroke();
    }
  }

  private drawHighlights(s: GameState, vis: (t: Tile) => boolean): void {
    const ctx = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    if (this.highlight) {
      for (const t of s.tiles) {
        if (!vis(t) || !this.highlight(t)) continue;
        const { x, y } = tileCenter(t.x, t.y);
        ctx.fillStyle = `rgba(255,70,50,${0.18 + pulse * 0.18})`;
        diamondPath(ctx, x, y, TW - 6, TH - 3);
        ctx.fill();
      }
    } else if (this.cam.zoom > 0.55) {
      // Sotib olish mumkin bo'lgan yerlar
      for (const t of buyableTiles(s)) {
        if (!vis(t)) continue;
        const { x, y } = tileCenter(t.x, t.y);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.25})`;
        ctx.lineWidth = 1.5;
        diamondPath(ctx, x, y, TW - 10, TH - 5);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (this.selected) {
      const { x, y } = tileCenter(this.selected.x, this.selected.y);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      diamondPath(ctx, x, y, TW - 4, TH - 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,90,${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 1.5;
      diamondPath(ctx, x, y, TW + 4, TH + 2);
      ctx.stroke();
    }
  }

  private buildingImage(s: GameState, t: Tile): { img: CanvasImageSource; w: number; h: number; ax: number; ay: number } | null {
    const f = t.owner >= 0 ? s.factions[t.owner] : null;
    const color = f?.color ?? '#888888';
    const fromSprite = (c: HTMLCanvasElement) => ({ img: c, w: SPRITE.w, h: SPRITE.h, ax: SPRITE.ax, ay: SPRITE.ay });
    // Tayyor rasm kalitlari
    let key: string | null = null;
    switch (t.building) {
      case 'core':
        if (f?.kind === 'empire') key = `capital_${f.style}`;
        else if (f?.kind === 'player') key = `core_${t.level}`;
        else key = `ai_core_${t.level}`;
        break;
      case 'city':
        key = `city_${f?.style ?? 'rim'}`;
        break;
      case 'farm':
        key = t.crop === 'arpa' ? 'farm_arpa' : 'farm';
        break;
      default:
        key = t.building;
    }
    const a = key ? getAsset(key) ?? (t.building === 'core' && f?.kind === 'ai' ? getAsset(`core_${t.level}`) : null) : null;
    if (a) {
      const scale = (a.spec.scale ?? 1.1) * TW;
      const h = (a.img.height / a.img.width) * scale;
      return { img: a.img, w: scale, h, ax: scale / 2, ay: h * (a.spec.anchorY ?? 0.85) };
    }
    switch (t.building) {
      case 'core':
        if (f?.kind === 'empire') return fromSprite(capitalSprite(f.style ?? 'rim', color));
        return fromSprite(coreSprite(t.level, color));
      case 'city':
        return fromSprite(citySprite(f?.style ?? 'rim', color));
      case 'farm':
        return fromSprite(farmSprite(t.crop, t.level));
      case 'pasture':
        return fromSprite(pastureSprite(t.level));
      case 'mine':
        return fromSprite(mineSprite(t.level));
      case 'tower':
        return fromSprite(towerSprite(t.level, color));
      case 'fort':
        return fromSprite(fortSprite(t.level, color));
    }
    return null;
  }

  private drawBuildings(s: GameState, vis: (t: Tile) => boolean): void {
    const ctx = this.ctx;
    const W = GAME.mapW;
    const H = GAME.mapH;
    for (let sum = 0; sum <= W + H - 2; sum++) {
      for (let x = Math.max(0, sum - H + 1); x <= Math.min(sum, W - 1); x++) {
        const t = s.tiles[(sum - x) * W + x];
        if (!vis(t)) continue;
        const { x: cx, y: cy } = tileCenter(t.x, t.y);
        if (t.building !== 'none') {
          const im = this.buildingImage(s, t);
          if (im) ctx.drawImage(im.img, cx - im.ax, cy - im.ay, im.w, im.h);
        }
        if (t.owner === s.playerId) this.drawTileBadges(s, t, cx, cy);
        if (t.capture) this.drawCapture(s, t, cx, cy);
      }
    }
  }

  private drawTileBadges(_s: GameState, t: Tile, cx: number, cy: number): void {
    const ctx = this.ctx;
    if (this.cam.zoom < 0.6) return;
    const g = tileGoods(t);
    if (g && t.store >= storeCap(t) * 0.5) {
      const icon = g === 'don' ? '🌾' : g === 'qoy' ? '🐑' : '◈';
      const bob = Math.sin(this.time * 3 + t.x) * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(cx + 22, cy - 34 + bob, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = t.store >= storeCap(t) - 1 ? '#d33' : '#c9a227';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#333';
      ctx.fillText(icon, cx + 22, cy - 33 + bob);
    }
    const n = armyCount(t.garrison);
    if (n > 0) {
      const label = `⚔ ${n}`;
      ctx.font = 'bold 10px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(20,40,80,0.85)';
      roundRect(ctx, cx - w / 2, cy + 8, w, 13, 5);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy + 15);
    }
  }

  private drawCapture(s: GameState, t: Tile, cx: number, cy: number): void {
    const ctx = this.ctx;
    const cap = t.capture!;
    const f = s.factions[cap.by];
    const total = GAME.captureDays;
    const left = Math.max(0, cap.until - s.day);
    const p = 1 - left / total;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy - 30, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy - 30, 11, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚑', cx, cy - 30);
  }

  private drawArmies(s: GameState): void {
    const ctx = this.ctx;
    for (const a of s.armies) {
      const hidden = !a.warned && targetsPlayer(s, a.target.x, a.target.y);
      if (hidden) continue;
      const pos = armyPos(a);
      const c = tileCenter(pos.x, pos.y);
      const mine = a.owner === s.playerId;
      const f = s.factions[a.owner];
      // yo'l chizig'i
      if (mine || targetsPlayer(s, a.target.x, a.target.y)) {
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -this.time * 20;
        ctx.strokeStyle = mine ? 'rgba(255,255,255,0.8)' : 'rgba(255,60,40,0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        for (let i = Math.ceil(a.pos); i < a.path.length; i++) {
          const p = tileCenter(a.path[i].x, a.path[i].y);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.restore();
      }
      const count = mine ? String(armyCount(a.units)) : a.warned ? `~${a.shownCount}` : String(armyCount(a.units));
      drawArmyMarker(ctx, c.x, c.y - 6, f.color, count, !mine, this.time + a.id);
    }
  }

  private drawProvinceLabels(s: GameState): void {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const size = clamp(15 / z, 14, 44);
    ctx.font = `600 ${size}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of s.provinces) {
      const c = tileCenter(p.cx, p.cy);
      const y = c.y - 34;
      ctx.lineWidth = Math.max(3, size / 5);
      ctx.strokeStyle = 'rgba(30,20,5,0.75)';
      ctx.strokeText(p.name, c.x, y);
      ctx.fillStyle = p.zone === 'markaz' ? '#ffd970' : '#fff4d6';
      ctx.fillText(p.name, c.x, y);
    }
  }
}

function targetsPlayer(s: GameState, x: number, y: number): boolean {
  const t = tileAt(s.tiles, x, y);
  return !!t && (t.owner === s.playerId || (!!t.capture && t.capture.by === s.playerId));
}

/** Pulni hisobga olmasdan sotib olsa bo'ladigan yerlar (yoritish uchun). */
function buyableTiles(s: GameState): Tile[] {
  const out = new Set<Tile>();
  const p = s.factions[s.playerId];
  let owned = 0;
  for (const t of s.tiles) if (t.owner === p.id) owned++;
  if (owned >= coreInfo(p).maxTiles) return [];
  for (const t of s.tiles) {
    if (t.owner !== p.id || t.capture) continue;
    for (const n of neighbors4(s.tiles, t)) {
      if (n.owner === -1 && n.province === t.province && n.terrain !== 'kol') out.add(n);
    }
  }
  return [...out];
}
