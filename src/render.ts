// Jang maydonini chizish (canvas). Mantiqqa tegmaydi — faqat Battle holatini o'qiydi.
import { BACKGROUNDS, BUILDINGS, UNIT_FRAMES, building, enemyFrames, ready, tintedBuilding } from './assets.ts';
import type { Background, Frame } from './assets.ts';
import { mineX } from './battle.ts';
import type { Battle, Unit } from './battle.ts';
import { BATTLES, CASTLE_X, COLORS, DEPTH, RANK, WORLD_W } from './config.ts';
import type { Kind, Side, Terrain } from './config.ts';

export const VIEW_H = 560; // ekran balandligiga sig'adigan o'yin birligi

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Palette {
  sky: [string, string];
  far: string;
  near: string;
  ground: [string, string];
  tuft: string;
  peaks?: boolean;
  snow?: boolean;
  trees?: string;
  water?: string;
  dunes?: boolean;
  city?: string;
  fields?: string;
}

// Rasmi hali yo'q joylar uchun vaqtincha o'xshash fon
const BG_FALLBACK: Partial<Record<Terrain, Terrain>> = { ekinzor: 'dasht', yaylov: 'ormon' };

const PALETTE: Record<Terrain, Palette> = {
  ormon: { sky: ['#8fb7d4', '#dfe9e4'], far: '#7f9a86', near: '#4f6b48', ground: ['#5f7a3c', '#3f5528'], tuft: '#7c9a4a', trees: '#2f4a30' },
  kol: { sky: ['#86b6dc', '#e4eef2'], far: '#8aa7b0', near: '#6f8f6a', ground: ['#6f8a45', '#4d6331'], tuft: '#93ad5c', water: '#4f8fb0' },
  ekinzor: { sky: ['#9cc0dc', '#f1ead6'], far: '#a3ad7a', near: '#8d9a55', ground: ['#86883e', '#5f612a'], tuft: '#b3a64e', fields: '#c9b45a' },
  tog: { sky: ['#a9c4dc', '#eef2f6'], far: '#8f99a6', near: '#6d7480', ground: ['#80857f', '#585d58'], tuft: '#d9dee2', peaks: true, snow: true },
  yaylov: { sky: ['#8dbde0', '#e8f1e6'], far: '#94b77a', near: '#6f9a4c', ground: ['#76984a', '#516d32'], tuft: '#9fc160' },
  dasht: { sky: ['#a6c3d8', '#f2e7cc'], far: '#b5aa76', near: '#9c925a', ground: ['#a39a5a', '#7b733f'], tuft: '#c9bd78' },
  chol: { sky: ['#9fc2db', '#f6e2b8'], far: '#d6b27a', near: '#c99f63', ground: ['#d2a868', '#a8804a'], tuft: '#e6c690', dunes: true },
  shahar: { sky: ['#9ab4cf', '#f0d9bd'], far: '#b9a58a', near: '#9c8a70', ground: ['#8c7a5c', '#665840'], tuft: '#a8977a', city: '#a08e76' },
};

// Takrorlanadigan "tasodif" — fon har kadrda bir xil chiqishi uchun
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function noise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i + seed * 1000);
  const b = hash(i + 1 + seed * 1000);
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cam = 0;
  scale = 1;
  groundY = 0;
  W = 0;
  H = 0;
  dpr = 1;
  bubble: Rect | null = null; // kumush pufagi (bosiladigan)
  minimap: Rect = { x: 0, y: 0, w: 0, h: 0 };
  safe = { left: 0, right: 0, top: 0 }; // tugmalar egallamagan joy (UI beradi)
  private enemy: Partial<Record<Kind, Frame[]>> = {};
  private enemyCastle: Frame | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.W = w;
    this.H = h;
    this.scale = h / VIEW_H;
    this.groundY = h * 0.74;
    this.clampCam();
  }

  // Dushman jangchilari shu jang rangida chiziladi
  setEnemyColor(level: number): void {
    const def = BATTLES[level];
    const hex = COLORS[def.color].hex;
    this.enemy = {};
    for (const k of Object.keys(UNIT_FRAMES) as Kind[]) this.enemy[k] = enemyFrames(k, hex, def.faction);
    // Poytaxtlar o'z rangida qoladi, qolgan qasrlarning bayrog'i jang rangiga bo'yaladi
    this.enemyCastle = def.castle.startsWith('shahar') ? null : tintedBuilding(def.castle, hex);
  }

  viewWidth(): number {
    return this.W / this.scale;
  }

  clampCam(): void {
    this.cam = Math.max(0, Math.min(WORLD_W - this.viewWidth(), this.cam));
  }

  sx(x: number): number {
    return (x - this.cam) * this.scale;
  }

  sy(y: number, z: number): number {
    return this.groundY + y * this.scale * 0.9 - z * this.scale;
  }

  draw(b: Battle): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const def = BATTLES[b.level];
    const bg = BACKGROUNDS[def.terrain] ?? BACKGROUNDS[BG_FALLBACK[def.terrain] ?? def.terrain];
    if (bg && ready(bg.img)) this.drawBackground(bg);
    else {
      const pal = PALETTE[def.terrain];
      this.drawSky(pal);
      this.drawGround(pal);
    }
    this.drawMine(0, def.mine);
    this.drawMine(1, def.mine);
    this.drawCastle(b, 0);
    this.drawCastle(b, 1);

    const list = b.units.filter((u) => !u.garrison).sort((a, c) => a.y - c.y);
    for (const u of list) this.drawUnit(u);
    this.drawParticles(b);
    this.drawShots(b);
    this.drawCastleBars(b);
    this.drawBubble(b);
    this.drawMinimap(b);
  }

  // ---------------- Fon ----------------

  // Realistik panorama: tekis yer chizig'i jang maydoniga to'g'rilanadi, sekin siljiydi (parallaks),
  // kenglik yetmasa ko'zgudek takrorlanadi
  private drawBackground(bg: Background): void {
    const { ctx, W, H } = this;
    const img = bg.img;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const gy = this.groundY - 14 * this.scale;
    const k = gy / (bg.ground * ih);
    const tw = iw * k;
    const off = this.cam * this.scale * 0.35;
    const srcG = bg.ground * ih;
    let x = -(off % (2 * tw));
    let i = 0;
    while (x < W) {
      ctx.save();
      if (i % 2) {
        ctx.translate(x + tw, 0);
        ctx.scale(-1, 1);
      } else ctx.translate(x, 0);
      ctx.drawImage(img, 0, 0, iw, srcG, 0, 0, tw + 1, gy);
      ctx.drawImage(img, 0, srcG, iw, ih - srcG, 0, gy, tw + 1, H - gy);
      ctx.restore();
      x += tw;
      i++;
    }
  }

  private drawSky(p: Palette): void {
    const { ctx, W, groundY } = this;
    const g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, p.sky[0]);
    g.addColorStop(1, p.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, groundY + 2);

    // Uzoq qatlam
    if (p.peaks) this.layer(0.15, p.far, 230, 150, 0.012, 1, true, p.snow);
    else if (p.city) this.city(0.2, p.city);
    else this.layer(0.15, p.far, 120, 50, 0.006, 1, false);
    if (p.water) {
      ctx.fillStyle = p.water;
      ctx.fillRect(0, groundY - 22 * this.scale, W, 22 * this.scale);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 40; i++) {
        const x = ((hash(i) * 3000 - this.cam * 0.4) % W + W) % W;
        ctx.fillRect(x, groundY - (4 + hash(i + 9) * 16) * this.scale, 18 * this.scale, 1.5);
      }
    }
    // Yaqin qatlam
    this.layer(0.45, p.near, 60, p.dunes ? 40 : 28, p.dunes ? 0.004 : 0.01, 2, false);
    if (p.trees) this.trees(0.6, p.trees);
    if (p.fields) {
      ctx.fillStyle = p.fields;
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 30; i++) {
        const x = (i * 260 - this.cam * 0.6) * this.scale;
        ctx.fillRect(x, groundY - 10 * this.scale, 160 * this.scale, 6 * this.scale);
      }
      ctx.globalAlpha = 1;
    }
  }

  private layer(par: number, color: string, height: number, amp: number, freq: number, seed: number, jag: boolean, snow = false): void {
    const { ctx, W, groundY, scale } = this;
    const off = this.cam * par;
    const base = groundY - height * scale;
    const pts: [number, number][] = [];
    for (let px = -10; px <= W + 10; px += 6) {
      const wx = px / scale + off;
      let n = noise(wx * freq, seed) * 0.7 + noise(wx * freq * 2.7, seed + 3) * 0.3;
      if (jag) n = Math.pow(n, 1.6) * 1.4;
      pts.push([px, base - n * amp * scale]);
    }
    ctx.beginPath();
    ctx.moveTo(-10, groundY);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(W + 10, groundY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (snow) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(245,248,252,0.85)';
      ctx.beginPath();
      ctx.moveTo(-10, base);
      for (const [x, y] of pts) ctx.lineTo(x, y + 24 * scale);
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] - 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private trees(par: number, color: string): void {
    const { ctx, groundY, scale, W } = this;
    ctx.fillStyle = color;
    const off = this.cam * par;
    for (let i = 0; i < 160; i++) {
      const wx = i * 34 + hash(i) * 20;
      const x = (wx - off) * scale;
      if (x < -40 || x > W + 40) continue;
      const h = (40 + hash(i + 50) * 50) * scale;
      const w = h * 0.35;
      const y = groundY - 4 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x - w, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  private city(par: number, color: string): void {
    const { ctx, groundY, scale, W } = this;
    ctx.fillStyle = color;
    const off = this.cam * par;
    for (let i = 0; i < 90; i++) {
      const wx = i * 46;
      const x = (wx - off) * scale;
      if (x < -60 || x > W + 60) continue;
      const h = (50 + hash(i) * 90) * scale;
      const w = (24 + hash(i + 7) * 30) * scale;
      ctx.fillRect(x, groundY - h, w, h);
      if (hash(i + 3) > 0.6) {
        ctx.beginPath();
        ctx.arc(x + w / 2, groundY - h, w / 2, Math.PI, 0);
        ctx.fill();
      } else if (hash(i + 4) > 0.75) {
        ctx.fillRect(x + w / 2 - 3 * scale, groundY - h - 50 * scale, 6 * scale, 50 * scale);
      }
    }
  }

  private drawGround(p: Palette): void {
    const { ctx, W, H, groundY, scale } = this;
    const g = ctx.createLinearGradient(0, groundY - 6 * scale, 0, H);
    g.addColorStop(0, p.ground[0]);
    g.addColorStop(1, p.ground[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, groundY - 6 * scale, W, H - groundY + 6 * scale);
    ctx.fillStyle = p.tuft;
    for (let i = 0; i < 700; i++) {
      const wx = hash(i) * WORLD_W;
      const x = this.sx(wx);
      if (x < -10 || x > W + 10) continue;
      const y = this.sy(hash(i + 100) * (DEPTH + 60) - 6, 0);
      const s = (1.5 + hash(i + 200) * 2.5) * scale;
      ctx.fillRect(x, y, s * 2, s * 0.6);
    }
  }

  // ---------------- Binolar ----------------

  private drawSprite(f: Frame, x: number, y: number, z: number, flip: boolean, scale = 1, alpha = 1, rot = 0): void {
    const { ctx } = this;
    if (!ready(f.img)) return;
    const w = f.w * this.scale * scale;
    const h = f.h * this.scale * scale;
    const px = this.sx(x);
    const py = this.sy(y, z);
    if (px + w < -50 || px - w > this.W + 50) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(f.img, -f.ax * w, -h, w, h);
    ctx.restore();
  }

  // Kon kirish joyi (tayanch nuqta) qasr tomonga qaragan
  private drawMine(side: Side, idx: number): void {
    const f = BUILDINGS.kon[idx];
    this.drawSprite(f, mineX(side), -14, 0, side === 1);
  }

  // Bizning qasr: 0 ochiq, 1 yopiq (chekinishda), 2 shikastlangan, 3 vayron
  private castleFrame(b: Battle, side: Side): { f: Frame; alpha: number; sink: number } {
    const s = b.sides[side];
    const ratio = s.castleHp / s.castleMax;
    if (side === 0) {
      const i = ratio <= 0 ? 3 : ratio < 0.5 ? 2 : s.stance === 'chekinish' ? 1 : 0;
      return { f: BUILDINGS.qasr_biz[i], alpha: 1, sink: 0 };
    }
    const t = ratio <= 0 ? Math.min(1, b.overT / 2) : 0;
    return { f: this.enemyCastle ?? building(BATTLES[b.level].castle), alpha: 1 - t * 0.85, sink: t * 60 };
  }

  private drawCastle(b: Battle, side: Side): void {
    const { f, alpha, sink } = this.castleFrame(b, side);
    this.drawSprite(f, CASTLE_X[side], -10, -sink, side === 1, 1, alpha);
  }

  private castleTop(b: Battle, side: Side): number {
    return this.castleFrame(b, side).f.h;
  }

  // Qasr rasmining o'rtasi (darvoza chetroqda bo'lgani uchun)
  private castleMid(b: Battle, side: Side): number {
    const f = this.castleFrame(b, side).f;
    return CASTLE_X[side] + (side === 0 ? 1 : -1) * (0.5 - f.ax) * f.w;
  }

  // ---------------- Askarlar ----------------

  private frameIndex(u: Unit): number {
    if (u.kind === 'otliq') return 0;
    const step = Math.floor((u.animT * u.speed) / 14);
    if (u.kind === 'konchi') {
      if (u.anim === 'mine') return Math.floor(u.animT / 0.35) % 2 ? 3 : 0;
      if (u.anim === 'carry') return step % 2 ? 4 : 5;
      if (u.anim === 'walk') return [1, 0, 2, 0][step % 4];
      return u.load > 0 ? 4 : 0;
    }
    if (u.anim === 'walk') return [1, 0, 2, 0][step % 4];
    if (u.anim === 'attack') return 3;
    return 0;
  }

  private drawUnit(u: Unit): void {
    const frames = (u.side === 1 && this.enemy[u.kind]) || UNIT_FRAMES[u.kind];
    const f = frames[Math.min(this.frameIndex(u), frames.length - 1)];
    const sc = RANK[u.rank].scale;
    let z = 0;
    if (u.kind === 'otliq' && u.anim === 'walk') z = Math.abs(Math.sin(u.animT * 10)) * 3;
    const flip = u.facing < 0;
    const { ctx } = this;

    if (u.rank !== 'oddiy' && !u.dead) {
      ctx.fillStyle = u.side === 0 ? 'rgba(255,205,80,0.55)' : 'rgba(160,30,30,0.5)';
      ctx.beginPath();
      ctx.ellipse(this.sx(u.x), this.sy(u.y, 0), f.w * 0.45 * sc * this.scale, 6 * this.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.dead) {
      const t = Math.min(1, u.deadT * 3);
      this.drawSprite(f, u.x, u.y, 0, flip, sc, Math.max(0, 1 - u.deadT / 1.2), -u.facing * t * 1.3);
      return;
    }
    this.drawSprite(f, u.x, u.y, z, flip, sc);
    if (u.hp < u.maxHp) {
      const w = 34 * this.scale * Math.min(1.6, sc);
      const x = this.sx(u.x) - w / 2;
      const y = this.sy(u.y, f.h * sc + 8);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = u.side === 0 ? '#6fd06a' : '#e05a4a';
      ctx.fillRect(x, y, w * (u.hp / u.maxHp), 3);
    }
  }

  // ---------------- O'qlar va effektlar ----------------

  private drawShots(b: Battle): void {
    const { ctx } = this;
    for (const s of b.shots) {
      const p = Math.min(1, s.t / s.dur);
      const vx = (s.tx - s.sx) / s.dur;
      const vz = (s.tz - s.sz) / s.dur + (s.arc * Math.PI * Math.cos(Math.PI * p)) / s.dur;
      const len = Math.hypot(vx, vz) || 1;
      const ux = vx / len;
      const uz = vz / len;
      const x = this.sx(s.x);
      const y = this.sy(s.y, s.z);
      const L = 20 * this.scale;
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = Math.max(1, 1.4 * this.scale);
      ctx.beginPath();
      ctx.moveTo(x - ux * L, y + uz * L);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (s.fire) {
        ctx.fillStyle = '#ffb030';
        ctx.beginPath();
        ctx.arc(x, y, 4 * this.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,90,20,0.5)';
        ctx.beginPath();
        ctx.arc(x, y, 7 * this.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawParticles(b: Battle): void {
    const { ctx } = this;
    for (const p of b.particles) {
      const a = p.life / p.max;
      const x = this.sx(p.x);
      const y = this.sy(p.y, p.z);
      if (p.kind === 'smoke') ctx.fillStyle = `rgba(70,66,62,${0.45 * a})`;
      else if (p.kind === 'spark') ctx.fillStyle = `rgba(255,220,120,${a})`;
      else ctx.fillStyle = `rgba(120,100,70,${0.7 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, p.size * this.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------- Ekran ustidagi belgilar ----------------

  private drawCastleBars(b: Battle): void {
    const { ctx } = this;
    for (const side of [0, 1] as Side[]) {
      const s = b.sides[side];
      const w = 150 * this.scale;
      const cx = this.sx(this.castleMid(b, side)) - w / 2;
      if (cx + w < 0 || cx > this.W) continue;
      const x = Math.max(6, Math.min(this.W - w - 6, cx)); // keng poytaxtda ham ekranda qolsin
      const y = Math.max(this.safe.top + 6, this.sy(-10, this.castleTop(b, side) + 12));
      ctx.fillStyle = 'rgba(20,14,8,0.7)';
      ctx.fillRect(x - 2, y - 2, w + 4, 12 * this.scale + 4);
      ctx.fillStyle = side === 0 ? '#5fbf5a' : '#d9503f';
      ctx.fillRect(x, y, w * Math.max(0, s.castleHp / s.castleMax), 12 * this.scale);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(11 * this.scale + 4)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil(s.castleHp)} / ${s.castleMax}`, x + w / 2, y + 6 * this.scale);
    }
  }

  private drawBubble(b: Battle): void {
    const s = b.sides[0];
    this.bubble = null;
    if (s.stock <= 0 || b.winner !== null) return;
    const { ctx } = this;
    const full = s.stock >= s.stockCap;
    const pulse = 1 + Math.sin(b.time * 6) * (full ? 0.08 : 0.04);
    const r = 34 * this.scale * pulse + 8;
    const x = this.sx(this.castleMid(b, 0));
    const y = this.sy(-10, this.castleTop(b, 0) * 0.5);
    ctx.fillStyle = full ? 'rgba(200,50,40,0.92)' : 'rgba(250,240,215,0.95)';
    ctx.strokeStyle = full ? '#fff' : '#8a6a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = full ? '#fff' : '#4a3010';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(r * 0.55)}px system-ui, sans-serif`;
    ctx.fillText(`+${Math.floor(s.stock)}`, x, y - r * 0.12);
    ctx.font = `bold ${Math.round(r * 0.28)}px system-ui, sans-serif`;
    ctx.fillText(full ? "TO'LDI!" : 'bosing', x, y + r * 0.42);
    this.bubble = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
  }

  private drawMinimap(b: Battle): void {
    const { ctx, W, H } = this;
    const h = 26;
    const left = this.safe.left || W * 0.29;
    const right = this.safe.right || W * 0.71;
    let w = Math.min(420, right - left - 16);
    let x = left + (right - left - w) / 2;
    let y = H - h - 8;
    if (w < 150) {
      w = Math.min(300, W * 0.5);
      x = (W - w) / 2;
      y = this.safe.top + 6;
    }
    this.minimap = { x, y, w, h };
    ctx.fillStyle = 'rgba(20,14,8,0.6)';
    ctx.fillRect(x, y, w, h);
    const k = w / WORLD_W;
    for (const side of [0, 1] as Side[]) {
      ctx.fillStyle = side === 0 ? '#e8d9a0' : '#c87b6a';
      ctx.fillRect(x + CASTLE_X[side] * k - 6, y + 4, 12, h - 8);
    }
    for (const u of b.units) {
      if (u.dead || u.garrison) continue;
      ctx.fillStyle = u.side === 0 ? (u.kind === 'amir' ? '#ffd24a' : '#7fe07a') : '#ff6a55';
      ctx.fillRect(x + u.x * k - 1, y + 6 + (u.y / DEPTH) * (h - 14), u.rank === 'oddiy' ? 2 : 4, 3);
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + this.cam * k, y + 1, this.viewWidth() * k, h - 2);
  }

  centerOn(x: number): void {
    this.cam = x - this.viewWidth() / 2;
    this.clampCam();
  }
}

