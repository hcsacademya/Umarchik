// Jang maydonini chizish (canvas). Mantiqqa tegmaydi — faqat Battle holatini o'qiydi.
import { BACKGROUNDS, ready } from './assets.ts';
import type { Background } from './assets.ts';
import { mineX, swingPhase } from './battle.ts';
import type { Battle, Shot, Snap, Unit } from './battle.ts';
import { BATTLES, CASTLE_DEPTH, CASTLE_X, COLORS, DEAD_LINGER, DEPTH, FORMATION_FRONT, RANK, WALL_SPOTS, WORLD_W } from './config.ts';
import type { Kind, Side, Terrain } from './config.ts';

export const VIEW_H = 560; // ekran balandligiga sig'adigan o'yin birligi
// Kamera: yer chizig'i ekran balandligining shu ulushida; chuqurlik (y) ekranda shuncha cho'ziladi —
// kattaroq bo'lsa maydon yuqoriroqdan ko'rinadi, saf qatorlari aniqroq ajraladi
const GROUND_AT = 0.7;
const DEPTH_K = 1.2;
const HORIZON = 36; // ufq yer chizig'idan shuncha birlik yuqorida

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

// Ikki rangni aralashtiradi (k — ikkinchisining ulushi), dark — qorong'ilashtirish
function mixHex(a: string, b: string, k: number, dark = 1): string {
  const p = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round((v + (y[i] - v) * k) * dark)).join(',')})`;
}

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
  minimap: Rect = { x: 0, y: 0, w: 0, h: 0 };
  safe = { left: 0, right: 0, top: 0 }; // tugmalar egallamagan joy (UI beradi)
  private enemyHex = '#c0392b'; // dushman kiyimi va bayroqlari — jang rangida

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
    this.groundY = h * GROUND_AT;
    this.clampCam();
  }

  // Dushman jangchilari va bayroqlari shu jang rangida chiziladi
  setEnemyColor(level: number): void {
    this.enemyHex = COLORS[BATTLES[level].color].hex;
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
    return this.groundY + y * this.scale * DEPTH_K - z * this.scale;
  }

  // k — oxirgi hisob qadamidan keyin o'tgan vaqt ulushi (0..1)
  draw(b: Battle, k = 1): void {
    const restore = this.blend(b, k);
    try {
      this.drawScene(b);
    } finally {
      restore();
    }
  }

  // Askar va o'qlarni oldingi va hozirgi hisob qadami orasiga vaqtincha qo'yadi; chizib bo'lgach
  // qaytaradigan funksiya asl holatni tiklaydi (mantiq ekran tezligiga bog'liq bo'lib qolmasin)
  private blend(b: Battle, k: number): () => void {
    if (k >= 1) return () => {};
    const lerp = (a: number, c: number): number => a + (c - a) * k;
    const saved: [Unit, Snap][] = [];
    for (const u of b.units) {
      const p = u.prev;
      if (!p) continue;
      saved.push([u, { x: u.x, y: u.y, walkDist: u.walkDist, animT: u.animT, swingT: u.swingT, hitT: u.hitT, deadT: u.deadT, door: u.door }]);
      u.x = lerp(p.x, u.x);
      u.y = lerp(p.y, u.y);
      u.walkDist = lerp(p.walkDist, u.walkDist);
      if (u.animT >= p.animT) u.animT = lerp(p.animT, u.animT);
      if (p.swingT >= 0 && u.swingT >= p.swingT) u.swingT = lerp(p.swingT, u.swingT);
      if (p.hitT > 0 && u.hitT > 0) u.hitT = lerp(p.hitT, u.hitT);
      if (u.dead && u.deadT >= p.deadT) u.deadT = lerp(p.deadT, u.deadT);
      u.door = lerp(p.door, u.door);
    }
    const shots: [Shot, number, number, number][] = [];
    for (const s of b.shots) {
      if (!s.prev) continue;
      shots.push([s, s.x, s.y, s.z]);
      s.x = lerp(s.prev.x, s.x);
      s.y = lerp(s.prev.y, s.y);
      s.z = lerp(s.prev.z, s.z);
    }
    return () => {
      for (const [u, v] of saved) Object.assign(u, v);
      for (const [s, x, y, z] of shots) {
        s.x = x;
        s.y = y;
        s.z = z;
      }
    };
  }

  private drawScene(b: Battle): void {
    const { ctx } = this;
    // qasr qulaganda ekran titraydi
    const shake = b.winner !== null && b.overT < 2.4 ? 1 - b.overT / 2.4 : 0;
    const shx = shake ? Math.sin(b.overT * 61) * 4 * shake * this.scale : 0;
    const shy = shake ? Math.cos(b.overT * 47) * 2.5 * shake * this.scale : 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, shx * this.dpr, shy * this.dpr);
    const def = BATTLES[b.level];
    const bg = BACKGROUNDS[def.terrain] ?? BACKGROUNDS[BG_FALLBACK[def.terrain] ?? def.terrain];
    if (bg && ready(bg.img)) this.drawBackground(bg);
    else {
      const pal = PALETTE[def.terrain];
      this.drawSky(pal);
      this.drawGround(pal);
    }
    // Qatlamlar: devordagi kamonchilar → tayanch → darvoza/konga kirayotganlar → teshigi o'yilgan ustki qatlam → maydondagilar
    for (const side of [0, 1] as Side[]) {
      this.drawWallArchers(b, side); // devor ularning oyog'ini yopadi
      this.drawBase(b, side);
    }
    const doorway = b.units.filter((u) => !u.dead && u.door > 0 && !(u.inside && u.doorDir === 0));
    for (const u of doorway) this.drawUnit(u, 1 - u.door * 0.85, u.y * (1 - u.door) - 7 * u.door);
    for (const side of [0, 1] as Side[]) this.drawBaseFront(b, side);
    this.drawRallyFlag(b);

    const list = b.units
      .filter((u) => !u.garrison && !u.inside && (u.dead || u.door === 0))
      .sort((a, c) => a.y - c.y || Number(c.dead) - Number(a.dead));
    for (const u of list) this.drawShadow(u);
    // avval o'liklar (yerda yotadi), keyin tiriklar
    for (const u of list) if (u.dead) this.drawUnit(u);
    for (const u of list) if (!u.dead) this.drawUnit(u);
    this.drawParticles(b);
    this.drawShots(b);
    this.drawPopups(b);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawCastleBars(b);
    this.drawMinimap(b);
  }

  // ---------------- Fon ----------------

  // Realistik panorama: uzoq manzara (osmon, tog', o'rmon) sekin siljiydi — chuqurlik hissi;
  // yer qismi esa qasr, kon va askarlar bilan bir tezlikda siljiydi — ular yerda "turadi".
  // Kenglik yetmasa rasm ko'zgudek takrorlanadi.
  private drawBackground(bg: Background): void {
    const { H } = this;
    const img = bg.img;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const gy = this.groundY - HORIZON * this.scale; // ufq chizig'i (yer boshlanadigan joy)
    const srcG = bg.ground * ih;
    const k = gy / srcG;
    const tw = iw * k;
    const fe = Math.round(ih * 0.035); // ikki qatlam bir-biriga silliq o'tadigan oraliq (faqat yer qismida)
    // avval yer (dunyo bilan siljiydi), ustidan uzoq manzara: ufqqacha tiniq, undan pastda asta shaffoflashadi
    this.tile(img, srcG, ih - srcG, gy, H - gy, tw, this.cam * this.scale);
    this.tile(this.farLayer(img, srcG, fe), 0, srcG + fe, 0, gy + fe * k, tw, this.cam * this.scale * 0.3);
  }

  private farCache = new Map<HTMLImageElement, HTMLCanvasElement>();

  private farLayer(img: HTMLImageElement, srcG: number, fe: number): HTMLCanvasElement {
    let c = this.farCache.get(img);
    if (!c) {
      c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = Math.round(srcG + fe);
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      const grad = g.createLinearGradient(0, srcG, 0, srcG + fe);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      // bitta to'rtburchak butun rasmni qoplaydi: yuqorisi to'liq, pastki oralig'i asta shaffof
      g.fillStyle = grad;
      g.fillRect(0, 0, c.width, c.height);
      this.farCache.set(img, c);
    }
    return c;
  }

  private tile(img: HTMLImageElement | HTMLCanvasElement, sy: number, sh: number, dy: number, dh: number, tw: number, off: number): void {
    const { ctx, W } = this;
    const iw = img.width;
    let x = -(((off % (2 * tw)) + 2 * tw) % (2 * tw));
    let i = 0;
    while (x < W) {
      ctx.save();
      if (i % 2) {
        ctx.translate(x + tw, 0);
        ctx.scale(-1, 1);
      } else ctx.translate(x, 0);
      ctx.drawImage(img, 0, sy, iw, sh, 0, dy, tw + 1, dh);
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
  // Vaqtincha: qasr, kon va askarlar yangi dizayn bilan qayta chiziladi. Hozir ular kod bilan oddiy shaklda,
  // joylari va o'lchamlari jang mantig'iga mos (darvoza — CASTLE_X, kon — mineX, devor tepasi — WALL_SPOTS)

  private groundShadow(x: number, y: number, rx: number, ry: number, alpha = 0.28): void {
    const { ctx } = this;
    ctx.fillStyle = `rgba(20,14,6,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(this.sx(x), this.sy(y, 0), rx * this.scale, ry * this.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dunyo koordinatasida to'rtburchak: x0..x1, yerdan z0..z1 balandlikda, y chuqurlikda
  private box(x0: number, x1: number, z0: number, z1: number, y: number, fill: string): void {
    const a = this.sx(Math.min(x0, x1));
    const c = this.sx(Math.max(x0, x1));
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(a, this.sy(y, z1), c - a, (z1 - z0) * this.scale);
  }

  // Tepadagi tishlar
  private crenels(x0: number, x1: number, z: number, y: number, fill: string): void {
    const l = Math.min(x0, x1);
    const r = Math.max(x0, x1);
    for (let x = l; x < r - 4; x += 14) this.box(x, Math.min(r, x + 8), z, z + 9, y, fill);
  }

  private flag(x: number, z: number, y: number, color: string, dir: number, t: number): void {
    const { ctx } = this;
    const px = this.sx(x);
    const py = this.sy(y, z);
    const k = this.scale;
    ctx.strokeStyle = '#3a2a14';
    ctx.lineWidth = Math.max(1, 1.5 * k);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 34 * k);
    ctx.stroke();
    const w = Math.sin(t * 4 + x) * 2 * k;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px, py - 34 * k);
    ctx.quadraticCurveTo(px + dir * 10 * k, py - 36 * k + w, px + dir * 20 * k, py - 31 * k);
    ctx.lineTo(px + dir * 20 * k, py - 22 * k);
    ctx.quadraticCurveTo(px + dir * 10 * k, py - 24 * k + w, px, py - 21 * k);
    ctx.closePath();
    ctx.fill();
  }

  // Ravoq (darvoza yoki kon og'zi): x markazda, kengligi w, balandligi h
  private arch(x: number, w: number, h: number, y: number, fill: string): void {
    const { ctx } = this;
    const l = this.sx(x - w / 2);
    const r = this.sx(x + w / 2);
    const bot = this.sy(y, 0);
    const top = this.sy(y, h);
    const rad = (r - l) / 2;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(l, bot);
    ctx.lineTo(l, top + rad);
    ctx.arc(l + rad, top + rad, rad, Math.PI, 0);
    ctx.lineTo(r, bot);
    ctx.closePath();
    ctx.fill();
  }

  private sideColor(side: Side): string {
    return side === 0 ? '#2346c8' : this.enemyHex;
  }

  private static GATE_TOP = 165; // darvoza minorasi tepasi (devordagi kamonchilar shu yerda)
  private static REAR_TOP = 130; // orqa devor tepasi

  // Kon: tosh tepalik, yog'och ramkali og'iz (konchilar shu yerga kirib-chiqadi)
  private drawMine(side: Side): void {
    const { ctx } = this;
    const mx = mineX(side);
    const k = this.scale;
    const base = this.sy(-8, 0);
    ctx.fillStyle = '#7d7262';
    ctx.beginPath();
    ctx.moveTo(this.sx(mx - 85), base);
    ctx.quadraticCurveTo(this.sx(mx - 60), base - 70 * k, this.sx(mx), base - 88 * k);
    ctx.quadraticCurveTo(this.sx(mx + 60), base - 70 * k, this.sx(mx + 85), base);
    ctx.closePath();
    ctx.fill();
    this.arch(mx, 36, 50, -8, '#1d1712');
    this.box(mx - 22, mx - 17, 0, 52, -7, '#6b4a2a');
    this.box(mx + 17, mx + 22, 0, 52, -7, '#6b4a2a');
    this.box(mx - 24, mx + 24, 50, 56, -7, '#6b4a2a');
  }

  // Qal'a: darvoza minorasi, orqa devor va minora, tishlar, bayroqlar; old tomonda kon
  private drawBase(b: Battle, side: Side): void {
    const dir = side === 0 ? 1 : -1;
    const gx = CASTLE_X[side];
    const G = Renderer.GATE_TOP;
    const R = Renderer.REAR_TOP;
    if (b.sides[side].castleHp <= 0) {
      // xarobalar: notekis past devor, asta cho'kadi
      const t = Math.min(1, b.overT / 1.2);
      for (let i = 0; i < 16; i++) {
        const x0 = gx - dir * (CASTLE_DEPTH + 25) + dir * i * 22;
        const hgt = (18 + hash(i + side * 50) * 30) + (1 - t) * (R - 30);
        this.box(x0, x0 + dir * 22, 0, hgt, -7, i % 2 ? '#6d6455' : '#5f5749');
      }
      this.drawMine(side);
      return;
    }
    const stone = '#9a8f7c';
    const dark = '#7a705f';
    this.box(gx - dir * CASTLE_DEPTH, gx - dir * 40, 0, R, -8, dark);
    this.crenels(gx - dir * CASTLE_DEPTH, gx - dir * 40, R, -8, dark);
    this.box(gx - dir * (CASTLE_DEPTH + 25), gx - dir * (CASTLE_DEPTH - 25), 0, R + 45, -7, stone);
    this.crenels(gx - dir * (CASTLE_DEPTH + 25), gx - dir * (CASTLE_DEPTH - 25), R + 45, -7, stone);
    this.box(gx - dir * 45, gx + dir * 28, 0, G, -6, stone);
    this.crenels(gx - dir * 45, gx + dir * 28, G, -6, stone);
    this.arch(gx, 40, 66, -6, '#1d1712');
    const c = this.sideColor(side);
    this.flag(gx - dir * 8, G + 9, -6, c, dir, b.time);
    this.flag(gx - dir * CASTLE_DEPTH, R + 54, -7, c, dir, b.time);
    this.drawMine(side);
  }

  // Chekinishda hamma ichkarida bo'lsa darvoza yopiladi
  private drawBaseFront(b: Battle, side: Side): void {
    const s = b.sides[side];
    if (s.castleHp <= 0 || s.stance !== 'chekinish' || !b.allInside(side)) return;
    this.arch(CASTLE_X[side], 40, 66, -6, '#6b4a2a');
    const gx = CASTLE_X[side];
    for (const dx of [-12, 0, 12]) this.box(gx + dx - 1, gx + dx + 1, 0, 60, -5.9, '#3e2a16');
  }

  // Devor tepasidagi kamonchilar: qasrniki + Chekinishda qasrga kirgan kamonchilar
  private drawWallArchers(b: Battle, side: Side): void {
    if (b.sides[side].castleHp <= 0) return;
    const dir = side === 0 ? 1 : -1;
    const n = b.wallArchers(side);
    for (let i = 0; i < n; i++) {
      const [dx] = WALL_SPOTS[i];
      const z = i < 3 ? Renderer.GATE_TOP : Renderer.REAR_TOP;
      this.figure(CASTLE_X[side] + dir * dx, -9, z, dir, 'kamonchi', 0.85, this.sideColor(side), {});
    }
  }

  // "Joyida tur" safi qayerda turishini ko'rsatadigan bayroq
  private drawRallyFlag(b: Battle): void {
    if (b.sides[0].stance !== 'tur') return;
    const { ctx } = this;
    const x = this.sx(CASTLE_X[0] + FORMATION_FRONT + 26);
    const y0 = this.sy(-2, 0);
    const h = 70 * this.scale;
    ctx.strokeStyle = '#4a3418';
    ctx.lineWidth = Math.max(1.5, 2 * this.scale);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 - h);
    ctx.stroke();
    const wave = Math.sin(b.time * 4) * 3 * this.scale;
    ctx.fillStyle = '#2346c8';
    ctx.strokeStyle = '#e8c060';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y0 - h);
    ctx.quadraticCurveTo(x + 14 * this.scale, y0 - h - 3 * this.scale + wave, x + 28 * this.scale, y0 - h + 5 * this.scale);
    ctx.lineTo(x + 20 * this.scale, y0 - h + 11 * this.scale);
    ctx.quadraticCurveTo(x + 12 * this.scale, y0 - h + 17 * this.scale + wave, x, y0 - h + 18 * this.scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Qasr jon chizig'i darvoza minorasi ustida
  private castleTop(_b: Battle, _side: Side): number {
    return Renderer.GATE_TOP + 40;
  }

  // ---------------- Askarlar ----------------
  // Vaqtincha oddiy odamcha: kiyimi tomon rangida (bizniki ko'k, Amir tilla, dushman — jang rangida), tur quroli bilan

  private drawShadow(u: Unit): void {
    const sc = RANK[u.rank].scale;
    const fade = u.dead ? Math.max(0, 1 - Math.max(0, u.deadT - DEAD_LINGER)) : 1;
    const w = (u.kind === 'otliq' ? 34 : 15) * sc;
    this.groundShadow(u.x, u.y, w, 3.5 * sc, 0.3 * fade);
  }

  // alpha < 1 va y — darvoza yoki konga kirib-chiqayotgan askar uchun
  private drawUnit(u: Unit, alpha = 1, y = u.y): void {
    const { ctx } = this;
    const sc = RANK[u.rank].scale;
    const hgt = (u.kind === 'otliq' ? 92 : 70) * sc;
    const color = u.kind === 'amir' && u.side === 0 ? '#c9962e' : this.sideColor(u.side);
    if (u.rank !== 'oddiy' && !u.dead) {
      ctx.strokeStyle = u.side === 0 ? 'rgba(255,205,80,0.9)' : 'rgba(200,40,30,0.85)';
      ctx.lineWidth = Math.max(1.5, 2 * this.scale);
      ctx.beginPath();
      ctx.ellipse(this.sx(u.x), this.sy(u.y, 0), 18 * sc * this.scale, 5 * this.scale, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (u.promoteT > 0 && !u.dead) {
      // yangi Amir: oltin nur
      const k = Math.min(1, u.promoteT / 1.5);
      const g = ctx.createRadialGradient(this.sx(u.x), this.sy(u.y, hgt * 0.5), 2, this.sx(u.x), this.sy(u.y, hgt * 0.5), hgt * this.scale);
      g.addColorStop(0, `rgba(255,220,110,${0.75 * k})`);
      g.addColorStop(1, 'rgba(255,220,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.sx(u.x) - hgt * this.scale, this.sy(u.y, hgt * 1.5), hgt * 2 * this.scale, hgt * 2 * this.scale);
    }
    const fade = u.dead ? Math.max(0, 1 - Math.max(0, u.deadT - DEAD_LINGER)) : alpha;
    this.figure(u.x, u.dead ? u.y : y, 0, u.facing, u.kind, sc, color, {
      walk: u.anim === 'walk' || u.anim === 'run' || u.anim === 'carry' ? u.walkDist : undefined,
      run: u.anim === 'run',
      swing: swingPhase(u),
      alt: u.swingAlt,
      dead: u.dead ? u.deadT : undefined,
      hit: u.hitT > 0 ? Math.min(1, u.hitT / 0.22) : 0,
      load: u.load > 0,
      alpha: fade,
      plume: u.rank !== 'oddiy',
    });
    if (u.dead || alpha < 1) return;
    if (u.kind === 'amir') this.drawAmirMark(u, hgt);
    if (u.hp < u.maxHp) {
      const w = 26 * this.scale * Math.min(1.6, sc);
      const x = this.sx(u.x) - w / 2;
      const yy = this.sy(u.y, hgt + 6);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - 1, yy - 1, w + 2, 5);
      ctx.fillStyle = u.side === 0 ? '#6fd06a' : '#e05a4a';
      ctx.fillRect(x, yy, w * (u.hp / u.maxHp), 3);
    }
  }

  // Odamcha: (0, 0) — oyoqlar orasi, yer sathida; birlikda, y yuqoriga manfiy
  private figure(x: number, y: number, z: number, facing: number, kind: Kind, sc: number, color: string, o: {
    walk?: number; run?: boolean; swing?: number; alt?: boolean; dead?: number; hit?: number; load?: boolean; alpha?: number; plume?: boolean;
  }): void {
    const { ctx } = this;
    const px = this.sx(x);
    if (px < -150 || px > this.W + 150) return;
    const s = this.scale * sc;
    const hit = o.hit ?? 0;
    const tint = (c: string, dark = 1): string => mixHex(c, '#ff3020', hit * 0.5, dark);
    const line = (ax: number, ay: number, bx: number, by: number, w: number, c: string): void => {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    };
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.translate(px, this.sy(y, z));
    ctx.scale(facing * s, s);
    if (o.dead !== undefined) ctx.rotate(-Math.min(1, o.dead * 3) * 1.45);
    ctx.lineCap = 'round';
    const horse = kind === 'otliq';
    const ph = o.walk !== undefined ? (o.walk / (o.run ? 34 : 28)) * Math.PI : 0;
    const sw = o.swing ?? -1;
    // zarba: qo'l ko'tariladi (0..0.3), tushadi (0.3..0.45 — tegish), qaytadi
    const strike = sw < 0 ? 0 : sw < 0.3 ? -(sw / 0.3) : sw < 0.45 ? -1 + ((sw - 0.3) / 0.15) * 1.6 : 0.6 * (1 - (sw - 0.45) / 0.55);
    let hipY = -34;
    if (horse) {
      // ot: tana, bo'yin-bosh, to'rt oyoq
      const brown = tint('#7a5230');
      const legA = o.walk !== undefined ? Math.sin(ph) * 0.5 : 0;
      for (const [lx, a, d] of [[-18, legA, 0.75], [16, -legA, 0.75], [-14, -legA, 1], [20, legA, 1]] as [number, number, number][]) {
        line(lx, -30, lx - Math.sin(a) * 30, -30 + Math.cos(a) * 30, 5, tint('#7a5230', d));
      }
      ctx.fillStyle = brown;
      ctx.beginPath();
      ctx.ellipse(0, -36, 27, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      line(22, -40, 32, -58, 8, brown);
      ctx.beginPath();
      ctx.ellipse(36, -58, 8, 5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(-14, -48, 22, 8);
      hipY = -46;
    } else {
      const a = o.walk !== undefined ? Math.sin(ph) * (o.run ? 0.7 : 0.45) : 0.12;
      for (const [ang, d] of [[-a, 0.75], [a, 1]] as [number, number][]) {
        const kx = Math.sin(ang) * 17;
        const ky = hipY + Math.cos(ang) * 17;
        const knee = o.walk !== undefined ? Math.max(0, -Math.sin(ang)) * 0.6 : 0.05;
        const fx = kx + Math.sin(ang - knee) * 17;
        const fy = ky + Math.cos(ang - knee) * 17;
        line(0, hipY, kx, ky, 6, tint('#4e4337', d));
        line(kx, ky, fx, fy, 5, tint('#5b3c24', d));
        line(fx - 2, fy, fx + 5, fy, 4, tint('#3e2a16', d));
      }
    }
    const neckY = hipY - 23;
    // uzoq qo'l (qalqon yoki kamon, yoki ikkinchi qilich)
    const farA = -0.5 - (kind === 'amir' ? strike * 0.6 : 0);
    const fhx = Math.sin(-farA) * 22;
    const fhy = neckY + 3 + Math.cos(farA) * 22;
    line(0, neckY + 3, fhx, fhy, 4, tint(color, 0.75));
    if (kind === 'amir') line(fhx, fhy, fhx + 18, fhy - 10, 2, '#c8ccd2');
    // gavda va bosh
    line(0, hipY, 0, neckY, 10, tint(color));
    if (o.load) {
      ctx.fillStyle = tint('#8a6a3a');
      ctx.fillRect(-12, neckY + 2, 8, 14);
    }
    ctx.fillStyle = tint('#c49a74');
    ctx.beginPath();
    ctx.arc(1, neckY - 7, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kind === 'konchi' ? tint('#d8c6a0') : kind === 'amir' ? tint('#f0e6cc') : tint('#8b8f96');
    ctx.beginPath();
    ctx.arc(1, neckY - 9, 6.8, Math.PI, 0);
    ctx.fill();
    if (o.plume) line(0, neckY - 15, -3, neckY - 24, 3, '#c8282a');
    if (kind === 'qilichli') {
      ctx.fillStyle = tint('#7a5230');
      ctx.beginPath();
      ctx.ellipse(fhx + 3, fhy - 4, 3, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (kind === 'kamonchi') {
      ctx.strokeStyle = tint('#6b4a2a');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fhx - 4, fhy, 13, -1.1, 1.1);
      ctx.stroke();
    }
    // yaqin qo'l va qurol
    const nearA = kind === 'konchi' ? -2.4 : kind === 'kamonchi' ? (sw >= 0 ? -1.4 : 0.3) : -0.4 + strike * 1.6;
    const hx = Math.sin(-nearA) * 22;
    const hy = neckY + 3 + Math.cos(nearA) * 22;
    line(0, neckY + 3, hx, hy, 4.5, tint(color));
    const dirx = Math.sin(-nearA);
    const diry = Math.cos(nearA);
    if (kind === 'qilichli' || kind === 'amir') line(hx, hy, hx + dirx * 20 + 8, hy + diry * 20 - 6, 2.2, '#d0d4da');
    if (kind === 'nayzachi' || horse) {
      const ang = horse ? -0.05 : -0.35 + Math.max(0, -strike) * 0.3;
      line(hx - Math.cos(ang) * 20, hy - Math.sin(ang) * 20, hx + Math.cos(ang) * 50, hy + Math.sin(ang) * 50, 2, '#7a5a34');
      line(hx + Math.cos(ang) * 50, hy + Math.sin(ang) * 50, hx + Math.cos(ang) * 58, hy + Math.sin(ang) * 58, 3, '#c8ccd2');
    }
    if (kind === 'konchi') {
      line(hx, hy, hx - 14, hy + 10, 2.2, '#6b4a2a');
      line(hx - 18, hy + 5, hx - 10, hy + 15, 2.5, '#8a8f96');
    }
    ctx.restore();
  }

  // Amir boshi ustida oltin belgi — uni qo'shin ichida darrov topish uchun
  private drawAmirMark(u: Unit, top: number): void {
    const { ctx } = this;
    const x = this.sx(u.x);
    const y = this.sy(u.y, top + 16);
    const s = 5 * this.scale + 2;
    ctx.fillStyle = '#ffd24a';
    ctx.strokeStyle = '#5a3a08';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s * 0.6);
    ctx.lineTo(x - s * 0.5, y - s * 0.1);
    ctx.lineTo(x, y - s * 0.8);
    ctx.lineTo(x + s * 0.5, y - s * 0.1);
    ctx.lineTo(x + s, y - s * 0.6);
    ctx.lineTo(x + s * 0.8, y + s * 0.4);
    ctx.lineTo(x - s * 0.8, y + s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
      else if (p.kind === 'cloud') {
        // yumshoq chang: ichma-ich uchta doira
        const al = Math.min(1, a * 1.6);
        for (const [r, o] of [[1, 0.16], [0.72, 0.2], [0.45, 0.22]]) {
          ctx.fillStyle = `rgba(172,154,128,${o * al})`;
          ctx.beginPath();
          ctx.arc(x, y, p.size * r * this.scale, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
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
      if (s.castleHp <= 0) continue;
      const w = 150 * this.scale;
      const cx = this.sx(CASTLE_X[side]) - w / 2;
      if (cx + w < 0 || cx > this.W) continue;
      const x = Math.max(6, Math.min(this.W - w - 6, cx)); // keng poytaxtda ham ekranda qolsin
      const y = Math.max(this.safe.top + 6, this.sy(-6, this.castleTop(b, side)));
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

  // "+30" kumush: qasr ustida ko'tarilib yo'qoladi
  private drawPopups(b: Battle): void {
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(15 * this.scale + 6)}px system-ui, sans-serif`;
    for (const p of b.popups) {
      const a = Math.max(0, Math.min(1, 1.6 - p.t));
      const x = this.sx(p.x);
      const y = this.sy(0, p.z + p.t * 50);
      ctx.globalAlpha = a;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(30,20,8,0.85)';
      ctx.strokeText(p.text, x, y);
      ctx.fillStyle = '#eef3f7';
      ctx.fillText(p.text, x, y);
      const r = 6 * this.scale + 2;
      const cx = x - ctx.measureText(p.text).width / 2 - r - 3;
      const g = ctx.createRadialGradient(cx - r * 0.3, y - r * 0.3, 1, cx, y, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, '#c9d1d8');
      g.addColorStop(1, '#7d8890');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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

