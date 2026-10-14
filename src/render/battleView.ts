import { UNITS, visualTier } from '../config';
import { Battle, BUnit, FIELD_H, FIELD_W, Feature } from '../game/battle';
import type { Terrain, UnitType } from '../types';
import { makeRng } from '../util';
import { getAsset } from './assets';
import { shade, withAlpha } from './iso';
import { roundRect } from './sprites';

const FIELD_COLORS: Partial<Record<Terrain, string>> = {
  tekislik: '#8fae58',
  unumdor: '#6d9a44',
  vodiy: '#9cbf64',
  yaylov: '#b2bd62',
  orman: '#5d8a40',
  tog: '#a49579',
  qorli_tog: '#c9c7c2',
  chol: '#d9c186',
  daryo: '#86a85a',
};

export class BattleView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  battle: Battle | null = null;
  private bg: HTMLCanvasElement | null = null;
  private colors: [string, string] = ['#2f7fd8', '#b3262d'];
  private tiers: [Partial<Record<UnitType, number>>, Partial<Record<UnitType, number>>] = [{}, {}];
  selectedGroup: number | null = null;
  onSelect: (g: number | null) => void = () => {};
  /** Ekrandagi maydon: yuqori va pastki panel uchun joy. */
  insetTop = 52;
  insetBottom = 96;
  private dpr = 1;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private time = 0;
  /** Kamera: maydonning ekran markazidagi nuqtasi va kattalashtirish. */
  private cam = { x: FIELD_W / 2, y: FIELD_H / 2, zoom: 0 };
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private pinch = 0;
  private moved = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.bindInput();
  }

  private bindInput(): void {
    const c = this.canvas;
    const local = (e: PointerEvent | WheelEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const p = local(e);
      this.pointers.set(e.pointerId, { ...p, sx: p.x, sy: p.y, t: performance.now() });
      if (this.pointers.size === 1) this.moved = false;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
        this.moved = true;
      }
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const q = local(e);
      if (this.pointers.size === 1) {
        if (Math.hypot(q.x - p.sx, q.y - p.sy) > 10) this.moved = true;
        if (this.moved) {
          this.cam.x -= (q.x - p.x) / this.scale;
          this.cam.y -= (q.y - p.y) / this.scale;
        }
      }
      p.x = q.x;
      p.y = q.y;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch > 0) this.cam.zoom *= d / this.pinch;
        this.pinch = d;
      }
    });
    const up = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (p && !this.moved && this.pointers.size === 0 && performance.now() - p.t < 600) this.tap(e);
      if (this.pointers.size < 2) this.pinch = 0;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.cam.zoom *= Math.exp(-e.deltaY * 0.0015);
      },
      { passive: false },
    );
  }

  start(b: Battle, colors: [string, string], levels: [Partial<Record<UnitType, number>>, Partial<Record<UnitType, number>>]): void {
    this.battle = b;
    this.colors = colors;
    this.tiers = [
      Object.fromEntries(Object.entries(levels[0]).map(([k, v]) => [k, visualTier(v as number)])),
      Object.fromEntries(Object.entries(levels[1]).map(([k, v]) => [k, visualTier(v as number)])),
    ];
    this.bg = this.renderBackground(b);
    this.selectedGroup = null;
    this.cam = { x: FIELD_W / 2, y: FIELD_H / 2, zoom: 0 };
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
  }

  private layout(): void {
    const W = this.canvas.width / this.dpr;
    const H = this.canvas.height / this.dpr;
    const availH = Math.max(100, H - this.insetTop - this.insetBottom);
    const fitAll = Math.min(W / FIELD_W, availH / FIELD_H);
    // Odatda maydon eniga moslanadi (telefonda yuqoriga-pastga suriladi).
    const fitWidth = Math.min(W / FIELD_W, (availH / FIELD_H) * 1.9);
    if (this.cam.zoom <= 0) this.cam.zoom = fitWidth;
    this.cam.zoom = Math.max(fitAll, Math.min(fitWidth * 2.5, this.cam.zoom));
    this.scale = this.cam.zoom;
    const viewW = W / this.scale;
    const viewH = availH / this.scale;
    const clampAxis = (c: number, view: number, lo: number, hi: number) =>
      view >= hi - lo ? (lo + hi) / 2 : Math.max(lo + view / 2, Math.min(hi - view / 2, c));
    this.cam.x = clampAxis(this.cam.x, viewW, 0, FIELD_W);
    // Yuqorida guruh yorliqlari uchun joy qoldiriladi.
    this.cam.y = clampAxis(this.cam.y, viewH, -70, FIELD_H + 10);
    this.ox = W / 2 - this.cam.x * this.scale;
    this.oy = this.insetTop + availH / 2 - this.cam.y * this.scale;
  }

  private toField(cx: number, cy: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: (cx - r.left - this.ox) / this.scale, y: (cy - r.top - this.oy) / this.scale };
  }

  private tap(e: PointerEvent): void {
    const b = this.battle;
    if (!b || b.result) return;
    const p = this.toField(e.clientX, e.clientY);
    if (p.x < -40 || p.y < -40 || p.x > FIELD_W + 40 || p.y > FIELD_H + 40) return;
    const near = (side: number) => {
      let best: BUnit | null = null;
      let bd = 34 * 34;
      for (const u of b.units) {
        if (u.dead || u.escaped || u.side !== side) continue;
        const d = (u.x - p.x) ** 2 + (u.y - 12 - p.y) ** 2;
        if (d < bd) {
          bd = d;
          best = u;
        }
      }
      return best;
    };
    const mine = near(b.playerSide);
    const enemy = near(b.playerSide === 0 ? 1 : 0);
    if (this.selectedGroup !== null && enemy) {
      b.command(this.selectedGroup, { kind: 'attack', group: enemy.group });
      return;
    }
    if (mine) {
      this.selectedGroup = mine.group;
      this.onSelect(mine.group);
      return;
    }
    if (this.selectedGroup !== null) {
      b.command(this.selectedGroup, {
        kind: 'move',
        x: Math.max(10, Math.min(FIELD_W - 10, p.x)),
        y: Math.max(10, Math.min(FIELD_H - 10, p.y)),
      });
    }
  }

  // ---------------- Fon ----------------

  private renderBackground(b: Battle): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = FIELD_W;
    c.height = FIELD_H;
    const ctx = c.getContext('2d')!;
    const base = FIELD_COLORS[b.terrain] ?? '#8fae58';
    const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    g.addColorStop(0, shade(base, -0.06));
    g.addColorStop(1, shade(base, 0.06));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    const rnd = makeRng(b.setup.seed + 99);
    // dog'lar
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = withAlpha(rnd() < 0.5 ? '#000000' : '#ffffff', 0.04);
      ctx.beginPath();
      ctx.ellipse(rnd() * FIELD_W, rnd() * FIELD_H, 30 + rnd() * 90, 14 + rnd() * 40, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // o't
    ctx.strokeStyle = shade(base, -0.25);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 500; i++) {
      const x = rnd() * FIELD_W;
      const y = rnd() * FIELD_H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y - 5);
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + 3, y - 4);
      ctx.stroke();
    }
    for (const f of b.features) this.drawFeature(ctx, f, rnd);
    // Chekinish chiziqlari
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, 14, FIELD_H);
    ctx.fillRect(FIELD_W - 14, 0, 14, FIELD_H);
    return c;
  }

  private drawFeature(ctx: CanvasRenderingContext2D, f: Feature, rnd: () => number): void {
    switch (f.kind) {
      case 'hill': {
        for (let i = 4; i >= 0; i--) {
          const k = (i + 1) / 5;
          ctx.fillStyle = withAlpha(i % 2 ? '#ffffff' : '#000000', 0.035 + (4 - i) * 0.012);
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, f.rx * k, f.ry * k, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(60,40,10,0.18)';
        ctx.lineWidth = 1.5;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, (f.rx * i) / 3.2, (f.ry * i) / 3.2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'forest': {
        const n = Math.round((f.rx * f.ry) / 500);
        const pts: [number, number][] = [];
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2;
          const r = Math.sqrt(rnd());
          pts.push([f.x + Math.cos(a) * f.rx * r, f.y + Math.sin(a) * f.ry * r]);
        }
        pts.sort((a, b) => a[1] - b[1]);
        for (const [x, y] of pts) {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.ellipse(x + 5, y + 4, 14, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = rnd() < 0.5 ? '#2f5e2a' : '#3b6e31';
          ctx.beginPath();
          ctx.arc(x, y - 10, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.arc(x - 4, y - 14, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'river': {
        ctx.fillStyle = '#d9c99a';
        ctx.beginPath();
        for (let y = 0; y <= FIELD_H; y += 20) {
          const x = f.x + Math.sin(y / 90) * 30 - f.rx - 8;
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let y = FIELD_H; y >= 0; y -= 20) ctx.lineTo(f.x + Math.sin(y / 90) * 30 + f.rx + 8, y);
        ctx.fill();
        ctx.fillStyle = '#4d8fc4';
        ctx.beginPath();
        for (let y = 0; y <= FIELD_H; y += 20) {
          const x = f.x + Math.sin(y / 90) * 30 - f.rx;
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let y = FIELD_H; y >= 0; y -= 20) ctx.lineTo(f.x + Math.sin(y / 90) * 30 + f.rx, y);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 30; i++) {
          const y = rnd() * FIELD_H;
          const x = f.x + Math.sin(y / 90) * 30 + (rnd() - 0.5) * f.rx;
          ctx.beginPath();
          ctx.moveTo(x - 8, y);
          ctx.quadraticCurveTo(x, y - 4, x + 8, y);
          ctx.stroke();
        }
        break;
      }
      case 'rocks': {
        for (let i = 0; i < 14; i++) {
          const a = rnd() * Math.PI * 2;
          const r = Math.sqrt(rnd());
          const x = f.x + Math.cos(a) * f.rx * r;
          const y = f.y + Math.sin(a) * f.ry * r;
          const s = 6 + rnd() * 12;
          ctx.fillStyle = '#7b756c';
          ctx.beginPath();
          ctx.moveTo(x - s, y);
          ctx.lineTo(x - s * 0.4, y - s * 0.9);
          ctx.lineTo(x + s * 0.6, y - s * 0.7);
          ctx.lineTo(x + s, y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.moveTo(x + s * 0.6, y - s * 0.7);
          ctx.lineTo(x + s, y);
          ctx.lineTo(x, y);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'snow': {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let i = 0; i < 300; i++) {
          ctx.beginPath();
          ctx.ellipse(rnd() * FIELD_W, rnd() * FIELD_H, 6 + rnd() * 20, 3 + rnd() * 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
  }

  // ---------------- Kadr ----------------

  render(dt: number): void {
    const b = this.battle;
    if (!b) return;
    this.time += dt;
    this.layout();
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b2228';
    ctx.fillRect(0, 0, W, H);
    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, this.ox * this.dpr, this.oy * this.dpr);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-60, -60, FIELD_W + 120, FIELD_H + 120);
    ctx.clip();

    // jasadlar
    for (const u of b.units) if (u.dead) this.drawBody(ctx, u, b.time);
    this.drawWallBack(ctx, b);
    // guruh buyruq nuqtasi
    if (this.selectedGroup !== null) {
      const g = b.groups[this.selectedGroup];
      if (g && g.order.kind === 'move') {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.order.x, g.order.y, 10 + Math.sin(this.time * 6) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const alive = b.units.filter((u) => !u.dead && !u.escaped).sort((a, c) => a.y - c.y);
    for (const u of alive) {
      if (this.selectedGroup !== null && u.group === this.selectedGroup) {
        ctx.strokeStyle = 'rgba(255,240,120,0.9)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(u.x, u.y + 1, u.cat === 'otliq' ? 13 : 9, u.cat === 'otliq' ? 5 : 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      this.drawUnit(ctx, u);
    }
    this.drawWallFront(ctx, b);
    // o'qlar
    ctx.strokeStyle = '#3a2a18';
    ctx.lineWidth = 1.4;
    for (const p of b.projectiles) {
      const k = p.t / p.dur;
      const x = p.x0 + (p.x1 - p.x0) * k;
      const arc = Math.sin(k * Math.PI) * Math.min(80, Math.abs(p.x1 - p.x0) * 0.25);
      const y = p.y0 + (p.y1 - p.y0) * k - arc;
      const k2 = Math.max(0, k - 0.06);
      const x2 = p.x0 + (p.x1 - p.x0) * k2;
      const y2 = p.y0 + (p.y1 - p.y0) * k2 - Math.sin(k2 * Math.PI) * Math.min(80, Math.abs(p.x1 - p.x0) * 0.25);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    this.drawGroupLabels(ctx, b);
    ctx.restore();
  }

  private drawWallBack(ctx: CanvasRenderingContext2D, b: Battle): void {
    if (!b.wall) return;
    const x = b.wall.x;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 14, 0, 16, FIELD_H);
  }

  private drawWallFront(ctx: CanvasRenderingContext2D, b: Battle): void {
    if (!b.wall) return;
    const w = b.wall;
    const x = w.x - 13;
    const broken = w.hp <= 0;
    const dmg = 1 - w.hp / w.maxHp;
    const gapTop = 360;
    const gapBot = 540;
    const seg = (y0: number, y1: number) => {
      ctx.fillStyle = '#a8a08f';
      ctx.fillRect(x, y0, 26, y1 - y0);
      ctx.fillStyle = '#8b8473';
      ctx.fillRect(x + 18, y0, 8, y1 - y0);
      ctx.strokeStyle = 'rgba(60,50,40,0.35)';
      ctx.lineWidth = 1;
      for (let y = y0; y < y1; y += 12) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 26, y);
        const off = (y / 12) % 2 ? 9 : 17;
        ctx.moveTo(x + off, y);
        ctx.lineTo(x + off, y + 12);
        ctx.stroke();
      }
      // tishlar (hujumchi tomonda)
      ctx.fillStyle = '#b8b09e';
      for (let y = y0; y < y1 - 6; y += 16) ctx.fillRect(x - 6, y, 7, 9);
    };
    if (broken) {
      seg(0, gapTop);
      seg(gapBot, FIELD_H);
      // xarobalar
      ctx.fillStyle = '#958d7c';
      for (let i = 0; i < 18; i++) {
        const yy = gapTop + ((i * 37) % (gapBot - gapTop));
        const xx = x - 10 + ((i * 53) % 46);
        ctx.beginPath();
        ctx.ellipse(xx, yy, 6 + (i % 3) * 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      seg(0, FIELD_H);
      if (dmg > 0.3) {
        ctx.strokeStyle = 'rgba(30,25,20,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 4, 400);
        ctx.lineTo(x + 14, 430);
        ctx.lineTo(x + 6, 470);
        if (dmg > 0.6) {
          ctx.moveTo(x + 18, 480);
          ctx.lineTo(x + 8, 520);
          ctx.lineTo(x + 16, 545);
        }
        ctx.stroke();
      }
    }
    // minoralar
    for (const ty of [90, 315, 585, 810]) {
      if (broken && ty > gapTop - 20 && ty < gapBot + 20) continue;
      ctx.fillStyle = '#b3ab99';
      ctx.fillRect(x - 8, ty - 22, 42, 44);
      ctx.fillStyle = '#958e7d';
      ctx.fillRect(x + 22, ty - 22, 12, 44);
      ctx.fillStyle = '#c4bcaa';
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 8 + i * 11, ty - 28, 7, 7);
    }
    // devor HP
    if (!broken) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 20, -2, 66, 10);
      ctx.fillStyle = '#e0b84a';
      ctx.fillRect(x - 19, -1, 64 * (w.hp / w.maxHp), 8);
    }
  }

  private drawBody(ctx: CanvasRenderingContext2D, u: BUnit, now: number): void {
    const age = now - u.deadAt;
    const a = Math.max(0.25, 0.7 - age / 60);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(90,20,15,0.35)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(this.colors[u.side], -0.3);
    ctx.fillRect(u.x - 7, u.y - 3, 12, 4);
    if (u.cat === 'otliq') {
      ctx.fillStyle = '#5a3f28';
      ctx.beginPath();
      ctx.ellipse(u.x + 4, u.y - 1, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawUnit(ctx: CanvasRenderingContext2D, u: BUnit): void {
    const color = this.colors[u.side];
    const tier = this.tiers[u.side][u.type] ?? 1;
    const img = getAsset(`unit_${u.type}_${tier}`) ?? getAsset(`unit_${u.type}`);
    ctx.save();
    ctx.translate(u.x, u.y);
    if (u.retreating) ctx.globalAlpha = 0.75;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 1, u.cat === 'otliq' ? 12 : 7, u.cat === 'otliq' ? 4 : 3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (img) {
      // Rasmlar bir xil rangda — tomonni oyoq ostidagi rangli halqa ko'rsatadi.
      ctx.fillStyle = withAlpha(color, 0.6);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 1, u.cat === 'otliq' ? 14 : 9, u.cat === 'otliq' ? 5 : 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.scale(u.facing, 1);
    const s = u.hero ? 1.55 : 1.2;
    ctx.scale(s, s);
    if (img) {
      const h = u.cat === 'otliq' ? 46 : 38;
      const w = (img.img.width / img.img.height) * h;
      const bob = Math.abs(Math.sin(u.walk * 1.2)) * 1.5;
      const lunge = u.attackAnim > 0 ? Math.sin((u.attackAnim / 0.3) * Math.PI) * 3 : 0;
      ctx.drawImage(img.img, -w / 2 + lunge, -h - bob, w, h);
    } else if (u.cat === 'otliq') this.drawRider(ctx, u, color, tier);
    else this.drawFoot(ctx, u, color, tier);
    if (u.hitFlash > 0) {
      ctx.globalAlpha = u.hitFlash * 4;
      ctx.fillStyle = '#ff4030';
      ctx.beginPath();
      ctx.arc(0, u.cat === 'otliq' ? -18 : -12, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // shaxsiy HP (faqat qahramonlar va katta guruh birliklari)
    if (u.hero || u.soldiers > 1.5) {
      const w = u.hero ? 22 : 14;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(u.x - w / 2, u.y - (u.hero ? 46 : 34), w, 3);
      ctx.fillStyle = u.side === this.battle!.playerSide ? '#7fe07f' : '#ff6a5a';
      ctx.fillRect(u.x - w / 2, u.y - (u.hero ? 46 : 34), w * (u.hp / u.maxHp), 3);
    }
  }

  private armor(color: string, tier: number): string {
    if (tier >= 3) return '#9aa3ad';
    if (tier === 2) return shade(color, -0.15);
    return color;
  }

  private helmet(ctx: CanvasRenderingContext2D, x: number, y: number, tier: number, color: string, hero: boolean, type: UnitType): void {
    if (type === 'amir') {
      ctx.fillStyle = '#e9c14a';
      ctx.beginPath();
      ctx.moveTo(x - 3.5, y - 2);
      ctx.lineTo(x - 3.5, y - 6);
      ctx.lineTo(x - 1.5, y - 4);
      ctx.lineTo(x, y - 7);
      ctx.lineTo(x + 1.5, y - 4);
      ctx.lineTo(x + 3.5, y - 6);
      ctx.lineTo(x + 3.5, y - 2);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (tier <= 1 && !hero) {
      ctx.fillStyle = '#7a5a3a';
      ctx.beginPath();
      ctx.arc(x, y - 1, 3.4, Math.PI, 0);
      ctx.fill();
      return;
    }
    ctx.fillStyle = tier >= 4 || hero ? '#d8b24a' : '#8f979f';
    ctx.beginPath();
    ctx.moveTo(x - 3.6, y);
    ctx.quadraticCurveTo(x - 3.6, y - 5, x, y - 6);
    ctx.quadraticCurveTo(x + 3.6, y - 5, x + 3.6, y);
    ctx.closePath();
    ctx.fill();
    if (tier >= 3 || hero) {
      ctx.fillStyle = hero ? color : '#b03030';
      ctx.beginPath();
      ctx.ellipse(x - 1, y - 7, 3.5, 1.6, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFoot(ctx: CanvasRenderingContext2D, u: BUnit, color: string, tier: number): void {
    const moving = Math.sin(u.walk * 1.2);
    const lx = moving * 2.5;
    // oyoqlar
    ctx.strokeStyle = '#3b2c1f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-1.5, -8);
    ctx.lineTo(-1.5 + lx, 0);
    ctx.moveTo(1.5, -8);
    ctx.lineTo(1.5 - lx, 0);
    ctx.stroke();
    if (u.hero) {
      ctx.fillStyle = shade(color, -0.25);
      ctx.beginPath();
      ctx.moveTo(-2, -17);
      ctx.lineTo(-8, -3);
      ctx.lineTo(0, -6);
      ctx.closePath();
      ctx.fill();
    }
    // tana
    ctx.fillStyle = this.armor(color, tier);
    ctx.fillRect(-3.5, -17, 7, 10);
    ctx.fillStyle = color;
    ctx.fillRect(-3.5, -10, 7, 3);
    if (tier >= 4) {
      ctx.fillStyle = '#e1b94a';
      ctx.fillRect(-3.5, -17, 7, 1.2);
    }
    // bosh
    ctx.fillStyle = '#e3c19a';
    ctx.beginPath();
    ctx.arc(0, -20, 3, 0, Math.PI * 2);
    ctx.fill();
    this.helmet(ctx, 0, -21, tier, color, u.hero, u.type);
    const atk = u.attackAnim > 0 ? Math.sin((u.attackAnim / 0.3) * Math.PI) : 0;
    if (u.cat === 'kamonchi') {
      // kamon
      ctx.strokeStyle = '#6b4520';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(4, -14, 7, -Math.PI / 2.2, Math.PI / 2.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(240,240,240,0.8)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(4 + Math.cos(-Math.PI / 2.2) * 7, -14 + Math.sin(-Math.PI / 2.2) * 7);
      ctx.lineTo(4 - atk * 4, -14);
      ctx.lineTo(4 + Math.cos(Math.PI / 2.2) * 7, -14 + Math.sin(Math.PI / 2.2) * 7);
      ctx.stroke();
      ctx.fillStyle = '#5a3d22';
      ctx.fillRect(-5, -18, 2.5, 8);
    } else if (u.cat === 'nayzachi') {
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-3, -6 + atk * 2);
      ctx.lineTo(14 + atk * 6, -26 + atk * 4);
      ctx.stroke();
      ctx.fillStyle = '#d0d4d8';
      ctx.beginPath();
      ctx.moveTo(14 + atk * 6, -26 + atk * 4);
      ctx.lineTo(18 + atk * 6, -30 + atk * 4);
      ctx.lineTo(15 + atk * 6, -24 + atk * 4);
      ctx.fill();
      ctx.fillStyle = shade(color, -0.2);
      ctx.fillRect(2, -17, 4, 12);
      ctx.strokeStyle = tier >= 3 ? '#d8b24a' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(2, -17, 4, 12);
    } else {
      // qilich va qalqon
      ctx.strokeStyle = '#d4d8dc';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(3, -12);
      ctx.lineTo(3 + 6 + atk * 4, -20 + atk * 10);
      ctx.stroke();
      ctx.fillStyle = shade(color, -0.25);
      ctx.beginPath();
      ctx.arc(3.5, -12, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tier >= 3 ? '#d8b24a' : '#c9c9c9';
      ctx.beginPath();
      ctx.arc(3.5, -12, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.hero) this.banner(ctx, -6, -6, color);
  }

  private drawRider(ctx: CanvasRenderingContext2D, u: BUnit, color: string, tier: number): void {
    const g = Math.sin(u.walk * 1.4);
    const armored = u.type === 'zirhli_otliq' || tier >= 3;
    // ot oyoqlari
    ctx.strokeStyle = '#3e2a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.lineTo(-7 + g * 3, 0);
    ctx.moveTo(-4, -8);
    ctx.lineTo(-4 - g * 3, 0);
    ctx.moveTo(6, -8);
    ctx.lineTo(6 - g * 3, 0);
    ctx.moveTo(9, -8);
    ctx.lineTo(9 + g * 3, 0);
    ctx.stroke();
    // ot tanasi
    ctx.fillStyle = armored ? '#8d949b' : u.side === 0 ? '#6b4a2e' : '#4e3a2a';
    ctx.beginPath();
    ctx.ellipse(1, -11, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (armored) {
      ctx.fillStyle = color;
      ctx.fillRect(-9, -9, 20, 2);
    }
    // bo'yin va bosh
    ctx.fillStyle = armored ? '#8d949b' : '#6b4a2e';
    ctx.beginPath();
    ctx.moveTo(8, -13);
    ctx.lineTo(13, -21);
    ctx.lineTo(17, -19);
    ctx.lineTo(12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16, -19, 4, 2.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // dum
    ctx.strokeStyle = '#2e2014';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.quadraticCurveTo(-15, -10, -14, -4);
    ctx.stroke();
    // chavandoz
    if (u.hero) {
      ctx.fillStyle = shade(color, -0.25);
      ctx.beginPath();
      ctx.moveTo(-1, -26);
      ctx.lineTo(-10, -12);
      ctx.lineTo(0, -15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = this.armor(color, armored ? 3 : tier);
    ctx.fillRect(-2.5, -25, 6, 10);
    ctx.fillStyle = color;
    ctx.fillRect(-2.5, -18, 6, 3);
    ctx.fillStyle = '#e3c19a';
    ctx.beginPath();
    ctx.arc(0.5, -28, 3, 0, Math.PI * 2);
    ctx.fill();
    this.helmet(ctx, 0.5, -29, armored ? Math.max(tier, 3) : tier, color, u.hero, u.type);
    const atk = u.attackAnim > 0 ? Math.sin((u.attackAnim / 0.3) * Math.PI) : 0;
    // nayza / qilich
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -20);
    ctx.lineTo(18 + atk * 6, -24 + atk * 2);
    ctx.stroke();
    ctx.fillStyle = '#d0d4d8';
    ctx.beginPath();
    ctx.moveTo(18 + atk * 6, -24 + atk * 2);
    ctx.lineTo(23 + atk * 6, -25 + atk * 2);
    ctx.lineTo(18 + atk * 6, -22 + atk * 2);
    ctx.fill();
    if (u.hero) this.banner(ctx, -5, -14, color);
  }

  private banner(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.strokeStyle = '#3b2b1a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 30);
    ctx.stroke();
    const w = Math.sin(this.time * 5) * 1.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 30);
    ctx.lineTo(x - 11, y - 28 + w);
    ctx.lineTo(x - 10, y - 21 + w);
    ctx.lineTo(x, y - 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e9c14a';
    ctx.beginPath();
    ctx.arc(x - 5, y - 25.5 + w / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawGroupLabels(ctx: CanvasRenderingContext2D, b: Battle): void {
    for (const g of b.groups) {
      const c = b.groupCenter(g);
      if (!c) continue;
      const n = b.groupSoldiers(g);
      let top = Infinity;
      for (const u of g.units) if (!u.dead && !u.escaped) top = Math.min(top, u.y);
      const label = `${UNITS[g.type].name} ${n}`;
      ctx.font = 'bold 15px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 12;
      const y = top - 56;
      const mine = g.side === b.playerSide;
      const sel = this.selectedGroup === g.id;
      ctx.fillStyle = sel ? 'rgba(255,220,90,0.95)' : mine ? 'rgba(20,45,90,0.8)' : 'rgba(110,20,20,0.8)';
      roundRect(ctx, c.x - w / 2, y, w, 20, 7);
      ctx.fill();
      ctx.fillStyle = sel ? '#222' : '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, c.x, y + 10.5);
      if (g.order.kind === 'retreat') {
        ctx.fillStyle = '#ffcf5a';
        ctx.fillText('↩', c.x + w / 2 + 10, y + 10.5);
      }
    }
  }
}
