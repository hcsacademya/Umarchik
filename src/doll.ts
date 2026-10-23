// Kiyimli odamcha (Stick War g'oyasi, lekin rangli kiyimda): tana va kiyim kod bilan chiziladi. Qo'l-oyoqlar
// uchlari dumaloq shakllar — har qanday burchakda bo'g'inda uzilish yoki chok ko'rinmaydi; kiyim suyak bilan
// birga egiladi (ko'ylak etagi oyoqlarga qarab kengayadi). Egilmaydigan buyumlar — bosh (dubulg'a, salla),
// qalqon, qurol — rasmlardan. Pozalar (yurish, yugurish, zarba, o'lim) src/skeleton.ts dagi bilan bir xil.
import type { Rig, RigPart } from './assets.ts';
import type { Kind } from './config.ts';
import { ready } from './ready.ts';
import type { Pose } from './skeleton.ts';

export interface Look {
  skin: string;
  tunic: string; // ko'ylak va yenglar
  trousers: string;
  boots: string;
  sash: string; // belbog'
  vest?: string; // charm nimcha
  bracer?: string; // bilakuzuk (yo'q bo'lsa bilak ochiq)
  cape?: string; // plash
  twoBlades?: boolean; // ikkala qo'lda qilich (Amir)
  shield?: boolean;
}

// Hozircha sinov: bizning Amir va oddiy qilichli. Qolgan turlar eski skelet bilan chiziladi
export const LOOKS: Partial<Record<Kind, Look>> = {
  qilichli: {
    skin: '#c49a74', tunic: '#d6c39b', trousers: '#4e4337', boots: '#5b3c24', sash: '#8f2b22',
    vest: '#6e4b2d', bracer: '#6a4528', shield: true,
  },
  amir: {
    skin: '#c49a74', tunic: '#e6dcc2', trousers: '#3d3731', boots: '#4e3320', sash: '#9b2a22',
    bracer: '#5e3d22', cape: '#5d6a3a', twoBlades: true,
  },
};

type Ctx = CanvasRenderingContext2D;
type V = [number, number];

const DARK = 0.78; // uzoqdagi qo'l va oyoq qorong'iroq

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
const rot = (v: V, a: number): V => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function line(ctx: Ctx, a: V, b: V): void {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

interface Seg {
  a: V;
  b: V;
  w: number;
  c: string;
}

// Bir a'zoning bo'laklari: avval hammasining chegara chizig'i, keyin rangi — bo'g'inlarda chiziq qolmaydi.
// Ustidan ingichka och chiziq — hajm (yorug'lik oldindan tushadi)
function limb(ctx: Ctx, segs: Seg[]): void {
  ctx.lineCap = 'round';
  for (const s of segs) {
    ctx.strokeStyle = shade(s.c, 0.55);
    ctx.lineWidth = s.w + 0.9;
    line(ctx, s.a, s.b);
  }
  for (const s of segs) {
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.w;
    line(ctx, s.a, s.b);
  }
  for (const s of segs) {
    const dx = s.b[0] - s.a[0];
    const dy = s.b[1] - s.a[1];
    const L = Math.hypot(dx, dy) || 1;
    const n: V = [(dy / L) * s.w * 0.2, (-dx / L) * s.w * 0.2];
    ctx.strokeStyle = 'rgba(255,240,220,0.18)';
    ctx.lineWidth = s.w * 0.28;
    line(ctx, add(lerp(s.a, s.b, 0.12), n), add(lerp(s.a, s.b, 0.88), n));
  }
}

function part(ctx: Ctx, pt: RigPart | undefined): void {
  if (pt && ready(pt.img)) ctx.drawImage(pt.img, -pt.px, -pt.py, pt.w, pt.h);
}

// Qurol qo'lda: rasm gorizontal (uchi o'ngda) — 90° burib, uchi qo'l bo'ylab pastga
function held(ctx: Ctx, pt: RigPart | undefined): void {
  ctx.save();
  ctx.rotate(Math.PI / 2);
  part(ctx, pt);
  ctx.restore();
}

// Oyoq (son markazi koordinatasida): shim, etik, oyoq kafti. Burchaklar skeleton.ts dagi leg() bilan bir xil
function leg(ctx: Ctx, rig: Rig, L: Look, at: V, hip: number, knee: number, foot: number, dark: boolean): void {
  const J = rig.joints;
  const H = rig.h;
  const k = dark ? DARK : 1;
  const K = add(at, rot(J.knee, hip));
  const A = add(K, rot(J.ankle ?? [0, J.foot], hip + knee));
  const sole = J.sole ?? 0.045 * H;
  const ft = rig.parts.foot;
  const heel = ft ? ft.px * 0.7 : 0.03 * H;
  const toe = ft ? (ft.w - ft.px) * 0.88 : 0.09 * H;
  const fp = (v: V): V => add(A, rot(v, foot)); // oyoq kafti: yerga nisbatan burchak
  limb(ctx, [
    { a: at, b: K, w: 0.105 * H, c: shade(L.trousers, k) },
    { a: K, b: lerp(K, A, 0.42), w: 0.095 * H, c: shade(L.trousers, k) },
    { a: lerp(K, A, 0.3), b: A, w: 0.078 * H, c: shade(L.boots, k) },
    { a: fp([-heel, sole * 0.5]), b: fp([toe, sole * 0.55]), w: sole, c: shade(L.boots, k) },
  ]);
}

// Qo'l (gavda koordinatasida): yeng, bilakuzuk, musht. Qurol qo'ldan oldin chiziladi — musht dastani ushlaydi.
// Qaytaradi: qo'l (musht) joyi
function arm(ctx: Ctx, rig: Rig, L: Look, at: V, sh: number, el: number, dark: boolean, weapon?: (c: Ctx) => void): V {
  const J = rig.joints;
  const H = rig.h;
  const k = dark ? DARK : 1;
  const E = add(at, rot(J.elbow, sh));
  const Hd = add(E, rot(J.hand, sh + el));
  if (weapon) {
    ctx.save();
    ctx.translate(Hd[0], Hd[1]);
    ctx.rotate(sh + el);
    weapon(ctx);
    ctx.restore();
  }
  limb(ctx, [
    { a: at, b: E, w: 0.078 * H, c: shade(L.tunic, k) },
    { a: E, b: lerp(E, Hd, 0.45), w: 0.07 * H, c: shade(L.tunic, k) },
    { a: lerp(E, Hd, 0.4), b: lerp(E, Hd, 0.86), w: 0.06 * H, c: shade(L.bracer ?? L.skin, k) },
    { a: lerp(E, Hd, 0.9), b: Hd, w: 0.058 * H, c: shade(L.skin, k) },
  ]);
  return Hd;
}

function fillPath(ctx: Ctx, fill: string | CanvasGradient, edge: string): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 0.8;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function vgrad(ctx: Ctx, y0: number, y1: number, c: string, k0: number, k1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(c, k0));
  g.addColorStop(1, shade(c, k1));
  return g;
}

// Ko'ylak etagi (son markazi koordinatasida): beli gavda bilan egiladi, pastki cheti oyoqlarga qarab kengayadi
function skirt(ctx: Ctx, rig: Rig, L: Look, p: Pose): void {
  const J = rig.joints;
  const H = rig.h;
  const wb = rot([-0.086 * H, -0.06 * H], p.body);
  const wf = rot([0.086 * H, -0.06 * H], p.body);
  const d = 0.72;
  const tN = add(J.hipBack, rot([J.knee[0] * d, J.knee[1] * d], p.hipN));
  const tF = add(J.hipFront, rot([J.knee[0] * d, J.knee[1] * d], p.hipF));
  const [b, f] = tN[0] < tF[0] ? [tN, tF] : [tF, tN];
  const bb: V = [b[0] - 0.07 * H, b[1] + 0.01 * H];
  const bf: V = [f[0] + 0.07 * H, f[1] + 0.01 * H];
  ctx.beginPath();
  ctx.moveTo(wb[0], wb[1]);
  ctx.quadraticCurveTo(wb[0] - 0.02 * H, (wb[1] + bb[1]) / 2, bb[0], bb[1]);
  ctx.quadraticCurveTo((bb[0] + bf[0]) / 2, Math.max(bb[1], bf[1]) + 0.035 * H, bf[0], bf[1]);
  ctx.quadraticCurveTo(wf[0] + 0.03 * H, (wf[1] + bf[1]) / 2, wf[0], wf[1]);
  ctx.closePath();
  fillPath(ctx, vgrad(ctx, wb[1], Math.max(bb[1], bf[1]), L.tunic, 0.95, 0.78), shade(L.tunic, 0.5));
  // burmalar
  ctx.strokeStyle = shade(L.tunic, 0.7);
  ctx.lineWidth = 0.5;
  for (const t of [0.35, 0.65]) line(ctx, lerp(wb, wf, t), lerp(bb, bf, t));
}

// Gavda (gavda koordinatasida, (0, 0) — son markazi): bo'yin, ko'ylak, nimcha, belbog'
function torso(ctx: Ctx, rig: Rig, L: Look): void {
  const J = rig.joints;
  const H = rig.h;
  const cx = J.neck[0];
  const top = Math.min(J.shoulder[1], J.shoulderFar[1]) - 0.02 * H;
  const waist = -0.06 * H;
  // bo'yin
  ctx.lineCap = 'round';
  ctx.strokeStyle = shade(L.skin, 0.55);
  ctx.lineWidth = 0.062 * H;
  line(ctx, [cx, top + 0.03 * H], [cx + 0.004 * H, J.neck[1] - 0.01 * H]);
  ctx.strokeStyle = L.skin;
  ctx.lineWidth = 0.054 * H;
  line(ctx, [cx, top + 0.03 * H], [cx + 0.004 * H, J.neck[1] - 0.01 * H]);
  const body = (inset: number, from: number): void => {
    ctx.beginPath();
    ctx.moveTo(cx - 0.04 * H, top - 0.01 * H + from);
    ctx.quadraticCurveTo(cx - 0.112 * H + inset, top + from, cx - 0.105 * H + inset, top + 0.08 * H);
    ctx.lineTo(-0.088 * H + inset, waist);
    ctx.lineTo(0.086 * H - inset, waist);
    ctx.quadraticCurveTo(cx + 0.118 * H - inset, top + 0.13 * H, cx + 0.098 * H - inset, top + 0.05 * H + from);
    ctx.quadraticCurveTo(cx + 0.08 * H - inset, top + from, cx + 0.035 * H, top - 0.01 * H + from);
    ctx.closePath();
  };
  body(0, 0);
  fillPath(ctx, vgrad(ctx, top, waist, L.tunic, 1.05, 0.85), shade(L.tunic, 0.5));
  if (L.vest) {
    body(0.012 * H, 0.035 * H);
    fillPath(ctx, vgrad(ctx, top, waist, L.vest, 1.1, 0.82), shade(L.vest, 0.5));
    // nimcha qadamalari
    ctx.fillStyle = shade(L.vest, 1.45);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx + 0.07 * H, top + 0.07 * H + i * 0.045 * H, 0.006 * H, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // belbog' va orqada osilib turgan uchi
  const y0 = waist - 0.035 * H;
  ctx.beginPath();
  ctx.moveTo(-0.092 * H, y0 + 0.006 * H);
  ctx.lineTo(0.09 * H, y0);
  ctx.lineTo(0.09 * H, waist + 0.012 * H);
  ctx.lineTo(-0.092 * H, waist + 0.016 * H);
  ctx.closePath();
  fillPath(ctx, vgrad(ctx, y0, waist, L.sash, 1.1, 0.8), shade(L.sash, 0.5));
  ctx.beginPath();
  ctx.moveTo(-0.08 * H, waist);
  ctx.lineTo(-0.1 * H, waist + 0.1 * H);
  ctx.lineTo(-0.075 * H, waist + 0.095 * H);
  ctx.lineTo(-0.06 * H, waist);
  ctx.closePath();
  fillPath(ctx, shade(L.sash, 0.9), shade(L.sash, 0.5));
}

// Plash (gavda koordinatasida): orqa yelkadan osiladi, yurganda va zarbada orqaga hilpiraydi
function cape(ctx: Ctx, rig: Rig, L: Look, swing: number): void {
  const J = rig.joints;
  const H = rig.h;
  const top = Math.min(J.shoulder[1], J.shoulderFar[1]);
  ctx.save();
  ctx.translate(J.neck[0] - 0.06 * H, top);
  ctx.rotate(swing);
  ctx.beginPath();
  ctx.moveTo(-0.05 * H, 0);
  ctx.lineTo(0.06 * H, 0);
  ctx.quadraticCurveTo(0.08 * H, 0.3 * H, 0.05 * H, 0.6 * H);
  ctx.quadraticCurveTo(-0.07 * H, 0.64 * H, -0.16 * H, 0.58 * H);
  ctx.quadraticCurveTo(-0.11 * H, 0.3 * H, -0.05 * H, 0);
  ctx.closePath();
  fillPath(ctx, vgrad(ctx, 0, 0.6 * H, L.cape!, 1.05, 0.72), shade(L.cape!, 0.5));
  ctx.restore();
}

// Odamchani chizadi: (0, 0) — oyoqlar orasi, yer sathida; o'ngga qaragan. drop — oyoqlar bukilganda gavda cho'kishi
export function drawDoll(ctx: Ctx, rig: Rig, p: Pose, L: Look, drop: number): void {
  const J = rig.joints;
  const P = rig.parts;
  ctx.save();
  if (p.fall) ctx.rotate(p.fall);
  ctx.translate(J.hip[0] + p.x, J.hip[1] + p.y + (p.fall ? 0 : drop));
  // orqadagilar: plash va uzoq qo'l (gavda bilan birga egiladi)
  ctx.save();
  ctx.rotate(p.body);
  if (L.cape) cape(ctx, rig, L, p.cape);
  const farHand = arm(ctx, rig, L, J.shoulderFar, p.shF, p.elF, true, L.twoBlades ? (c) => {
    c.rotate(p.blF);
    held(c, P.weapon);
  } : undefined);
  ctx.restore();
  leg(ctx, rig, L, J.hipFront, p.hipF, p.kneeF, p.footF, true);
  leg(ctx, rig, L, J.hipBack, p.hipN, p.kneeN, p.footN, false);
  skirt(ctx, rig, L, p);
  ctx.save();
  ctx.rotate(p.body);
  torso(ctx, rig, L);
  ctx.save();
  ctx.translate(J.neck[0], J.neck[1]);
  ctx.rotate(p.head);
  part(ctx, P.head);
  ctx.restore();
  // qalqon uzoq qo'lda, gavda oldida, deyarli tik
  if (L.shield && P.shield) {
    ctx.save();
    ctx.translate(farHand[0], farHand[1]);
    ctx.rotate(0.05);
    part(ctx, P.shield);
    ctx.restore();
  }
  arm(ctx, rig, L, J.shoulder, p.sh, p.el, false, (c) => {
    c.rotate(p.bl);
    held(c, P.weapon);
  });
  ctx.restore();
  ctx.restore();
}
