// Bo'lakli askar (qo'g'irchoq): bo'laklar bo'g'imlardan yig'iladi va har kadrda burchaklar bilan harakatlanadi.
// Bo'laklar va bo'g'im nuqtalari tools/kesish.py yasagan src/askar.json dan — suyak uzunliklari rasmdagi kiyimning
// o'zidan olinadi, kod hech narsani cho'zmaydi yoki to'g'rilamaydi. Pozalar shu yerda hisoblanadi.
import meta from './askar.json';
import { loadImage, ready } from './assets.ts';
import { swingPhase } from './battle.ts';
import type { Unit } from './battle.ts';

type V = [number, number];

interface PieceMeta {
  r: number[]; // atlasdagi joyi: x, y, eni, bo'yi
  p: number[]; // aylanish nuqtasi (bo'lak ichida)
  j: Record<string, number[]>; // bolalar bo'g'imlari — aylanish nuqtasiga nisbatan
}

interface RigMeta {
  img: string;
  T: number; // atlasdagi askar bo'yi (tovondan bosh tepasigacha)
  pieces: Record<string, PieceMeta>;
  order: string[]; // chizish tartibi, orqadan oldinga; "2" — tananing narigi tomonidagi bo'lak (qoraytiriladi)
}

// Poza: har bo'lakning burchagi, gradusda. Musbat — soat miliga qarshi: osilib turgan qo'l-oyoqning pastki uchi
// oldinga (yuz tomonga) chiqadi, tik turgan gavda va qilich tig'i esa orqaga og'adi.
// 0 — shablondagi holat: qo'l-oyoq tik osilgan, qilich tig'i tepaga qaragan
export interface Pose {
  gavda: number;
  bosh: number;
  plash: number;
  qin: number;
  etak_old: number;
  etak_orqa: number;
  yeng: number;
  bilak: number;
  qilich: number;
  yeng2: number;
  bilak2: number;
  son: number;
  etik: number;
  son2: number;
  etik2: number;
}

const KEYS = Object.keys({
  gavda: 0, bosh: 0, plash: 0, qin: 0, etak_old: 0, etak_orqa: 0, yeng: 0, bilak: 0, qilich: 0,
  yeng2: 0, bilak2: 0, son: 0, etik: 0, son2: 0, etik2: 0,
} satisfies Pose) as (keyof Pose)[];

export const PUPPET_H = 68; // askar bo'yi o'yin birligida (tovondan bosh tepasigacha)
const D2R = Math.PI / 180;
const BLEND = 0.16; // harakat turi almashganda yangi pozaga o'tish vaqti, soniya

const ease = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

function rotV(v: number[], deg: number): V {
  const r = deg * D2R;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c];
}

const add = (a: number[], b: number[]): V => [a[0] + b[0], a[1] + b[1]];

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b };
  for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}

function tinted(img: HTMLImageElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

interface Placed {
  at: Record<string, V>;
  ang: Record<string, number>;
  feet: V[]; // yaqin oyoq: tovon, uch; uzoq oyoq: tovon, uch
}

interface Mem {
  mode: string;
  from: Pose;
  t0: number;
  last: Pose;
}

export class Puppet {
  readonly rig: RigMeta;
  private img: HTMLImageElement;
  private dark: HTMLCanvasElement | null = null; // uzoqdagi qo'l-oyoq
  private red: HTMLCanvasElement | null = null; // zarba yeganda qizarish
  private leg: number; // sondan tovongacha (atlas pikseli)
  private guardHeel: number; // jangovar turishda orqa oyoq tovoni — hujumda shu joyda qoladi
  private mem = new WeakMap<Unit, Mem>();
  private off = document.createElement('canvas'); // shaffof askar (darvozaga kirayotgan, o'lik) shu yerda yig'iladi

  constructor(rig: RigMeta) {
    this.rig = rig;
    this.img = loadImage(rig.img);
    const P = rig.pieces;
    this.leg = P.son.j.knee[1] + P.etik.j.heel[1];
    this.guardHeel = this.place(GUARD).feet[2][0];
  }

  ready(): boolean {
    if (!ready(this.img)) return false;
    if (!this.dark) {
      this.dark = tinted(this.img, 'rgba(0,0,0,0.28)');
      this.red = tinted(this.img, 'rgba(255,40,24,0.8)');
    }
    return true;
  }

  // Bo'laklarni bo'g'imlardan yig'ish (son bo'g'imi — boshlang'ich nuqta)
  place(p: Pose): Placed {
    const P = this.rig.pieces;
    const hip: V = [0, 0];
    const tj = (n: string): V => rotV(P.gavda.j[n], p.gavda);
    const shoulder = tj('shoulder');
    const at: Record<string, V> = {
      gavda: hip, bosh: tj('neck'), plash: tj('clasp'), qin2: tj('belt'), etak_old: hip, etak_orqa: hip,
    };
    const ang: Record<string, number> = {
      gavda: p.gavda, bosh: p.bosh, plash: p.plash, qin2: p.qin, etak_old: p.etak_old, etak_orqa: p.etak_orqa,
    };
    const feet: V[] = [];
    for (const s of ['', '2'] as const) {
      const elbow = add(shoulder, rotV(P.yeng.j.elbow, p[`yeng${s}`]));
      const knee = add(hip, rotV(P.son.j.knee, p[`son${s}`]));
      at[`yeng${s}`] = shoulder;
      at[`bilak${s}`] = elbow;
      at[`son${s}`] = hip;
      at[`etik${s}`] = knee;
      ang[`yeng${s}`] = p[`yeng${s}`];
      ang[`bilak${s}`] = p[`bilak${s}`];
      ang[`son${s}`] = p[`son${s}`];
      ang[`etik${s}`] = p[`etik${s}`];
      feet.push(add(knee, rotV(P.etik.j.heel, p[`etik${s}`])), add(knee, rotV(P.etik.j.toe, p[`etik${s}`])));
      if (!s) {
        at.qilich = add(elbow, rotV(P.bilak.j.fist, p.bilak));
        ang.qilich = p.qilich;
      }
    }
    return { at, ang, feet };
  }

  // Askarni chizish: (x, y) — ekranda oyoqlar ostidagi nuqta, k — o'yin birligidan ekran pikseliga
  draw(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number, k: number, sc: number, alpha: number): void {
    if (!this.ready()) return;
    const s = (PUPPET_H * sc * k) / this.rig.T; // atlas pikselidan ekran pikseliga
    if (alpha >= 0.999) {
      this.drawAt(ctx, u, x, y, s, sc);
      return;
    }
    if (alpha <= 0.01) return;
    // bo'laklar ustma-ust tushgani uchun shaffoflik butun askarga birdan beriladi
    const tf = ctx.getTransform();
    const dev = Math.hypot(tf.a, tf.b);
    const size = Math.ceil(this.rig.T * 2.6 * s * dev);
    if (this.off.width < size) this.off.width = this.off.height = size;
    const g = this.off.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    g.setTransform(dev, 0, 0, dev, 0, 0);
    this.drawAt(g, u, size / 2 / dev, (size * 0.8) / dev, s, sc);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.off, 0, 0, size, size, tf.a * x + tf.c * y + tf.e - size / 2, tf.b * x + tf.d * y + tf.f - size * 0.8, size, size);
    ctx.restore();
  }

  private drawAt(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number, s: number, sc: number): void {
    const { pose, mode } = this.poseOf(u, sc);
    const pl = this.place(pose);
    const T = this.rig.T;
    let footY = -Infinity;
    for (const f of pl.feet) footY = Math.max(footY, f[1]);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(u.facing * s, s);
    if (mode === 'dead') {
      // yiqilish: butun tana yerdagi tovon (orqaga) yoki oyoq uchi (oldinga) atrofida aylanadi
      const back = u.hitDir * u.facing <= 0;
      const f = clamp01(u.deadT / 0.6);
      const bounce = u.deadT > 0.6 ? Math.sin(Math.min(1, (u.deadT - 0.6) / 0.18) * Math.PI) * 4 : 0;
      const fall = (88 * f * f - bounce) * (back ? 1 : -1);
      const xs = pl.feet.map((v) => v[0]);
      const px = back ? Math.min(...xs) : Math.max(...xs);
      ctx.translate(px, 0);
      ctx.rotate(-fall * D2R);
      ctx.translate(-px, -Math.abs(Math.sin(fall * D2R)) * 0.07 * T);
    }
    ctx.translate(mode === 'fight' ? this.guardHeel - pl.feet[2][0] : 0, -footY);
    const prevQ = ctx.imageSmoothingQuality;
    ctx.imageSmoothingQuality = 'high';
    const hit = u.hitT > 0 && !u.dead ? clamp01(u.hitT / 0.22) : 0;
    for (const id of this.rig.order) {
      const far = id.endsWith('2');
      const m = this.rig.pieces[far ? id.slice(0, -1) : id];
      const at = pl.at[id];
      const [rx, ry, rw, rh] = m.r;
      ctx.save();
      ctx.translate(at[0], at[1]);
      ctx.rotate(-pl.ang[id] * D2R);
      ctx.drawImage(far ? this.dark! : this.img, rx, ry, rw, rh, -m.p[0], -m.p[1], rw, rh);
      if (hit > 0) {
        ctx.globalAlpha *= hit * 0.45;
        ctx.drawImage(this.red!, rx, ry, rw, rh, -m.p[0], -m.p[1], rw, rh);
      }
      ctx.restore();
    }
    ctx.imageSmoothingQuality = prevQ;
    ctx.restore();
  }

  // Joriy harakat turi bo'yicha poza; tur almashganda eski pozadan silliq o'tiladi
  private poseOf(u: Unit, sc: number): { pose: Pose; mode: string } {
    let mode: string;
    let target: Pose;
    if (u.dead) {
      mode = 'dead';
      target = deathPose(u);
    } else if (u.anim === 'walk' || u.anim === 'run' || u.anim === 'carry') {
      mode = u.anim === 'run' ? 'run' : 'walk';
      target = this.gait(u, mode === 'run', sc);
    } else if (u.anim === 'attack' || u.swingT >= 0 || u.guard) {
      mode = 'fight';
      target = fightPose(u);
    } else {
      mode = 'idle';
      target = idlePose(u);
    }
    if (u.hitT > 0 && !u.dead) target = hitReact(target, u);
    const now = performance.now() / 1000;
    let m = this.mem.get(u);
    if (!m) {
      m = { mode, from: target, t0: -1, last: target };
      this.mem.set(u, m);
    }
    if (m.mode !== mode) {
      m.from = m.last;
      m.t0 = now;
      m.mode = mode;
    }
    const t = (now - m.t0) / BLEND;
    const pose = t < 1 ? lerpPose(m.from, target, ease(clamp01(t))) : target;
    m.last = pose;
    return { pose, mode };
  }

  // Yurish va yugurish. Yerga tekkan oyoq to'g'ri turadi va gavdaga nisbatan aynan yurilgan masofaga orqaga
  // suriladi — oyoq sirpanmaydi; ko'tarilgan oyoq tizzadan bukilib oldinga o'tadi
  private gait(u: Unit, run: boolean, sc: number): Pose {
    const A = run ? 32 : 24;
    const step = 2 * this.leg * Math.sin(A * D2R) * (PUPPET_H * sc) / this.rig.T; // bir qadam, o'yin birligida
    const ph = (((u.walkDist / (2 * step)) % 1) + 1) % 1;
    const [son, etik] = legPhase(ph, A, run ? 85 : 55);
    const [son2, etik2] = legPhase((ph + 0.5) % 1, A, run ? 85 : 55);
    const c = Math.cos(2 * Math.PI * ph);
    const lean = run ? 10 : 3;
    const gavda = -lean;
    const yeng = run ? 25 - 28 * c : 6 - 16 * c;
    const bilak = yeng + (run ? 70 : 14 + 6 * (1 - c));
    const yeng2 = run ? 25 + 30 * c : 6 + 18 * c;
    return {
      gavda,
      bosh: -lean * 0.5,
      plash: gavda - (run ? 18 : 8) + 3 * Math.sin(4 * Math.PI * ph),
      qin: gavda - 28 + 6 * Math.sin(2 * Math.PI * ph),
      ...skirt(son, son2, gavda),
      yeng,
      bilak,
      qilich: bilak - 150,
      yeng2,
      bilak2: yeng2 + (run ? 80 : 18),
      son,
      etik,
      son2,
      etik2,
    };
  }
}

// Bitta oyoqning qadam bosqichi f (0..1): [son burchagi, etik burchagi]
function legPhase(f: number, A: number, knee: number): [number, number] {
  if (f < 0.5) {
    const th = Math.asin(Math.sin(A * D2R) * (1 - 4 * f)) / D2R; // yerda: oyoq uchi gavdaga nisbatan bir tekis orqaga
    return [th, th - 3];
  }
  const t = (f - 0.5) / 0.5;
  const th = -A + 2 * A * ease(t);
  return [th, th - knee * Math.sin(Math.PI * t)];
}

// Etak ikki bo'lak: oldingisi oldinga chiqqan oyoqqa, orqadagisi orqadagi oyoqqa yarim burchak bilan ergashadi
function skirt(a: number, b: number, gavda: number): { etak_old: number; etak_orqa: number } {
  return {
    etak_old: Math.max(0, a, b) * 0.6 + gavda * 0.4,
    etak_orqa: Math.min(0, a, b) * 0.6 + gavda * 0.4,
  };
}

function idlePose(u: Unit): Pose {
  const br = Math.sin(u.animT * 1.8 + u.id);
  const gavda = -(1.5 + br);
  const yeng = 6 + 1.5 * br;
  const yeng2 = 4 - br;
  return {
    gavda,
    bosh: gavda * 0.5,
    plash: gavda - 3 + 1.5 * Math.sin(u.animT * 1.3 + u.id),
    qin: gavda - 22,
    ...skirt(5, -5, gavda),
    yeng,
    bilak: yeng + 16,
    qilich: yeng - 134,
    yeng2,
    bilak2: yeng2 + 12,
    son: 5,
    etik: 2,
    son2: -5,
    etik2: -7,
  };
}

// Jangovar turish: oldingi oyoq oldinda, qilich ko'tarilgan
const GUARD: Pose = {
  gavda: -6, bosh: -3, plash: -12, qin: -36, etak_old: 8, etak_orqa: -12,
  yeng: 40, bilak: 105, qilich: -40, yeng2: 22, bilak2: 70,
  son: 18, etik: 6, son2: -16, etik2: -24,
};

type Key = Partial<Pose>;
// Zarbalar (har zarbada tasodifan biri): tepadan chopish, yondan sermash, sanchish.
// Bosqichlar: qulochkash (0.30 gacha), zarba — 0.444 da tegadi, davomi (0.62 gacha), qaytish
const SWINGS: [Key, Key, Key][] = [
  [
    { gavda: 6, yeng: 165, bilak: 215, qilich: 80, yeng2: 50, bilak2: 80, son: 16, son2: -16 },
    { gavda: -14, yeng: 75, bilak: 85, qilich: -100, yeng2: -20, bilak2: 20, son: 26, etik: 2, son2: -22, etik2: -30 },
    { gavda: -12, yeng: 35, bilak: 45, qilich: -150, yeng2: -10, bilak2: 30, son: 26, etik: 2, son2: -22, etik2: -30 },
  ],
  [
    { gavda: 4, yeng: -35, bilak: 30, qilich: 40, yeng2: 45, bilak2: 85, son: 16, son2: -16 },
    { gavda: -12, yeng: 95, bilak: 95, qilich: -95, yeng2: -15, bilak2: 25, son: 24, etik: 4, son2: -20, etik2: -28 },
    { gavda: -8, yeng: 110, bilak: 120, qilich: -60, yeng2: -5, bilak2: 35, son: 24, etik: 4, son2: -20, etik2: -28 },
  ],
  [
    { gavda: 4, yeng: 10, bilak: 110, qilich: -90, yeng2: 40, bilak2: 80, son: 14, son2: -16 },
    { gavda: -16, yeng: 88, bilak: 90, qilich: -90, yeng2: -25, bilak2: 10, son: 30, etik: 0, son2: -24, etik2: -30 },
    { gavda: -14, yeng: 80, bilak: 88, qilich: -92, yeng2: -20, bilak2: 15, son: 30, etik: 0, son2: -24, etik2: -30 },
  ],
];

function withKey(base: Pose, k: Key): Pose {
  const p = { ...base, ...k };
  p.bosh = p.gavda * 0.5;
  p.plash = p.gavda - 10;
  p.qin = p.gavda - 32;
  return { ...p, ...skirt(p.son, p.son2, p.gavda) };
}

function fightPose(u: Unit): Pose {
  const sway = Math.sin(u.animT * 2.4 + u.id);
  const guard: Pose = { ...GUARD, gavda: GUARD.gavda - sway, yeng: GUARD.yeng + 2 * sway };
  const p = swingPhase(u);
  if (p < 0) return guard;
  const [W, S, F] = SWINGS[u.swingVar % SWINGS.length].map((k) => withKey(GUARD, k));
  if (p < 0.3) return lerpPose(guard, W, ease(p / 0.3));
  if (p < 0.444) {
    const t = (p - 0.3) / 0.144;
    return lerpPose(W, S, t * t); // zarba tezlashib tushadi
  }
  if (p < 0.62) return lerpPose(S, F, ease((p - 0.444) / 0.176));
  return lerpPose(F, guard, ease((p - 0.62) / 0.38));
}

// Zarba yeganda: zarba yo'nalishi tomon silkinadi
function hitReact(p: Pose, u: Unit): Pose {
  const k = clamp01(u.hitT / 0.22);
  const push = u.hitDir * u.facing >= 0 ? 1 : -1; // +1 — orqadan urildi (oldinga), -1 — oldidan (orqaga)
  return { ...p, gavda: p.gavda - push * 10 * k, bosh: p.bosh - push * 16 * k, yeng2: p.yeng2 - push * 14 * k };
}

function deathPose(u: Unit): Pose {
  const e = ease(clamp01(u.deadT / 0.6));
  const back = u.hitDir * u.facing <= 0;
  const arm = back ? 100 : 150;
  return {
    gavda: 0,
    bosh: (back ? 20 : -15) * e,
    plash: -8 * e,
    qin: -30,
    ...skirt(20 * e, -6 * e, 0),
    yeng: arm * e,
    bilak: (arm + 40) * e,
    qilich: (arm + 40) * e - 150 + 60 * e,
    yeng2: (arm - 20) * e,
    bilak2: (arm + 10) * e,
    son: 20 * e,
    etik: -30 * e,
    son2: -6 * e,
    etik2: -40 * e,
  };
}

const RIGS = meta as unknown as Record<string, RigMeta>;
const puppets = new Map<string, Puppet>();
for (const [id, rig] of Object.entries(RIGS)) puppets.set(id, new Puppet(rig));

// Hozircha faqat bizning qilichli yangi usulda; qolganlari rasmlari kelguncha oddiy shaklda
export function puppetOf(u: Unit): Puppet | null {
  if (u.side !== 0) return null;
  return puppets.get(u.kind) ?? null;
}
