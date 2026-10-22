// Skelet animatsiya: jangchi bo'laklardan yig'iladi (gavda, bosh, qo'llar, oyoqlar, qurol), har kadrda suyaklar
// burchagi askar holatidan hisoblanadi va bo'laklar shu burchakda chiziladi. Tayyor kadrlar yo'q —
// harakat ekran tezligida silliq, yurish qadami bosib o'tilgan yo'lga mos (oyoq sirpanmaydi).
// Tur bo'yicha farqi: qurol (egri qilich, qilich, nayza, kamon, kurak), qalqon, plash, o'qdon, savat.
import type { Rig, RigPart } from './assets.ts';
import { ready } from './assets.ts';
import { swingPhase } from './battle.ts';
import type { Unit } from './battle.ts';
import type { Kind } from './config.ts';

// Burchaklar radianda (0 — qo'l/oyoq pastga tushgan holat, manfiy — oldinga/yuqoriga), siljish o'yin birligida.
// Qurol burchagi (bl) bilakka nisbatan: 0 — qurol uchi qo'l bilan bir chiziqda pastga qaragan.
export interface Pose {
  x: number; // gavda oldinga siljishi
  y: number; // gavda pastga tushishi
  body: number; // gavda egilishi
  head: number;
  sh: number; // yaqin qo'l: yelka, tirsak, qurol
  el: number;
  bl: number;
  shF: number; // uzoq qo'l
  elF: number;
  blF: number;
  hipN: number; // yaqin oyoq: son, tizza
  kneeN: number;
  hipF: number; // uzoq oyoq
  kneeF: number;
  fall: number; // butun gavda oyoq ostidan burilishi (yiqilish)
  cape: number; // plash orqaga hilpirashi
  aux: number; // kamonchi: o'q kamonda (0/1); konchi: kumush yuki (0/1)
}

type Key = Partial<Pose>;

const BASE: Pose = {
  x: 0, y: 0, body: 0.04, head: 0,
  sh: 0, el: -0.3, bl: 0, shF: 0, elF: -0.3, blF: 0,
  hipN: 0.1, kneeN: 0.08, hipF: -0.12, kneeF: 0.08,
  fall: 0, cape: 0.06, aux: 0,
};

// Har bir turning tik turish holati
const STANCE: Record<Kind, Pose> = {
  // ikki egri qilich oldinga, uchlari biroz yuqoriga
  amir: { ...BASE, sh: -0.25, el: -1.0, bl: -0.9, shF: -0.35, elF: -1.2, blF: -0.7 },
  // qilich oldinga-pastga, qalqon ko'krak oldida
  qilichli: { ...BASE, sh: -0.2, el: -0.5, bl: -0.55, shF: -0.55, elF: -0.9 },
  // nayza tik, uchi biroz oldinga
  nayzachi: { ...BASE, sh: -0.15, el: -0.3, bl: -2.7, shF: -0.55, elF: -0.9 },
  // kamon pastda uzoq qo'lda
  kamonchi: { ...BASE, sh: 0.05, el: -0.3, shF: -0.3, elF: -0.5 },
  // kurak yelkada
  konchi: { ...BASE, sh: -0.5, el: -1.9, bl: -1.58, shF: 0.1, elF: -0.4, body: 0.06 },
  otliq: BASE,
};

// ---------------- Zarbalar ----------------
// Zarba ulushi 0..1. Yaqin jangchilarda dushmanga 0.444 da tegadi, kamonchida 0.71 da o'q uchadi.
const HIT_M = 0.444;
const HIT_A = 0.71;

type Track = [number, Key][];

// Amir: 1-zarba boshdan oshirib chopish (yaqin qo'l), 2-zarba uzoq qo'l bilan ko'ndalang
const AMIR_A: Track = [
  [0.3, { sh: -3.3, el: -0.6, bl: -0.4, body: -0.12, head: -0.05, x: -1.5, hipN: 0.2, hipF: -0.25, cape: 0.35 }],
  [HIT_M, { sh: -1.2, el: -0.25, bl: 0.2, body: 0.2, head: 0.08, x: 3.5, hipN: 0.35, kneeN: 0.25, hipF: -0.45, kneeF: 0.2, cape: 0.05 }],
  [0.62, { sh: -0.8, el: -0.35, bl: -0.1, body: 0.16, head: 0.05, x: 3, hipN: 0.3, kneeN: 0.2, hipF: -0.4, kneeF: 0.15, cape: 0.2 }],
];
const AMIR_B: Track = [
  [0.3, { shF: 0.9, elF: 0.8, blF: 0.6, sh: -0.6, el: -1.5, body: -0.1, x: -1, cape: 0.3 }],
  [HIT_M, { shF: -1.5, elF: -0.1, blF: 0, sh: -0.5, el: -1.4, body: 0.22, head: 0.06, x: 4, hipN: 0.4, kneeN: 0.2, hipF: -0.4, kneeF: 0.1, cape: 0.05 }],
  [0.62, { shF: -1.35, elF: -0.3, blF: -0.2, sh: -0.45, el: -1.3, body: 0.15, x: 3.5, hipN: 0.35, kneeN: 0.15, hipF: -0.35, cape: 0.2 }],
];

// Qilichli: chopish va ko'ndalang zarba; qalqon oldinda turadi
const SWORD_A: Track = [
  [0.3, { sh: -3.2, el: -0.5, bl: -0.5, body: -0.12, head: -0.05, x: -1.5, hipN: 0.2, hipF: -0.25, shF: -0.7, elF: -1.0 }],
  [HIT_M, { sh: -1.15, el: -0.2, bl: 0.15, body: 0.2, head: 0.08, x: 3.5, hipN: 0.35, kneeN: 0.25, hipF: -0.45, kneeF: 0.2, shF: -0.5, elF: -0.8 }],
  [0.62, { sh: -0.8, el: -0.35, bl: -0.2, body: 0.16, head: 0.05, x: 3, hipN: 0.3, kneeN: 0.2, hipF: -0.4, kneeF: 0.15 }],
];
const SWORD_B: Track = [
  [0.3, { sh: 0.9, el: -0.4, bl: 0, body: -0.12, x: -1.5, hipN: 0.15, hipF: -0.2 }],
  [HIT_M, { sh: -1.5, el: -0.12, bl: -0.1, body: 0.2, head: 0.06, x: 3.5, hipN: 0.35, kneeN: 0.2, hipF: -0.4, kneeF: 0.15 }],
  [0.62, { sh: -1.2, el: -0.3, bl: -0.2, body: 0.15, x: 3, hipN: 0.3, kneeN: 0.15, hipF: -0.35 }],
];

// Nayzachi: oldinga sanchish; ikkinchisi tepadan pastga
const SPEAR_A: Track = [
  [0.3, { sh: 0.7, el: -1.0, bl: -1.1, body: -0.1, x: -2.5, hipN: 0.25, hipF: -0.3, kneeF: 0.25 }],
  [HIT_M, { sh: -1.25, el: -0.15, bl: -0.15, body: 0.22, head: 0.06, x: 5, hipN: 0.45, kneeN: 0.25, hipF: -0.5, kneeF: 0.1 }],
  [0.62, { sh: -1.1, el: -0.2, bl: -0.25, body: 0.18, x: 4.5, hipN: 0.4, kneeN: 0.2, hipF: -0.45 }],
];
const SPEAR_B: Track = [
  [0.3, { sh: -2.5, el: -0.8, bl: -0.5, body: -0.12, x: -1.5, hipN: 0.2, hipF: -0.25 }],
  [HIT_M, { sh: -1.6, el: -0.3, bl: 0.5, body: 0.2, head: 0.06, x: 4, hipN: 0.4, kneeN: 0.2, hipF: -0.4, kneeF: 0.1 }],
  [0.62, { sh: -1.3, el: -0.4, bl: 0.2, body: 0.15, x: 3.5, hipN: 0.3, kneeN: 0.15, hipF: -0.35 }],
];

// Kamonchi: kamon ko'tariladi, o'q tortiladi, qo'yib yuboriladi (aux — o'q kamonda)
const BOW: Track = [
  [0.22, { shF: -1.5, elF: -0.1, sh: 0.5, el: -1.3, body: 0.0, aux: 1 }],
  [0.6, { shF: -1.55, elF: -0.05, sh: 1.25, el: -2.35, body: -0.06, head: 0.04, x: -1.5, hipN: 0.15, aux: 1 }],
  [HIT_A, { shF: -1.55, elF: -0.05, sh: 1.2, el: -2.35, body: -0.05, x: -1.5, hipN: 0.15, aux: 1 }],
  [0.8, { shF: -1.5, elF: -0.1, sh: 0.7, el: -1.4, body: 0.04, x: 0, aux: 0 }],
];

interface Moves {
  a?: Track;
  b?: Track;
  hit: number;
}

const MOVES: Record<Kind, Moves> = {
  amir: { a: AMIR_A, b: AMIR_B, hit: HIT_M },
  qilichli: { a: SWORD_A, b: SWORD_B, hit: HIT_M },
  nayzachi: { a: SPEAR_A, b: SPEAR_B, hit: HIT_M },
  kamonchi: { a: BOW, b: BOW, hit: HIT_A },
  konchi: { hit: HIT_M },
  otliq: { hit: HIT_M },
};

const STRIDE = 52; // bir to'liq qadam sikli (ikki qadam) necha birlik yo'l
const LEG_SWING = 0.42;
const KNEE_LIFT = 0.8;

const smooth = (t: number): number => t * t * (3 - 2 * t);

function mix(a: Pose, b: Key, t: number): Pose {
  const out = { ...a };
  for (const k of Object.keys(b) as (keyof Pose)[]) out[k] = a[k] + (b[k]! - a[k]) * t;
  return out;
}

// Kalit pozalar orasida silliq o'tish; zarbaga qadar tezlashib boradi
function track(base: Pose, keys: Track, p: number, hit: number): Pose {
  const pts: [number, Pose][] = [[0, base], ...keys.map(([t, k]): [number, Pose] => [t, { ...base, ...k }]), [1, base]];
  for (let i = 1; i < pts.length; i++) {
    const [t0, a] = pts[i - 1];
    const [t1, b] = pts[i];
    if (p <= t1) {
      const t = (p - t0) / (t1 - t0);
      return mix(a, b, t1 === hit ? t * t : smooth(t));
    }
  }
  return base;
}

function walkPose(u: Unit, base: Pose): Pose {
  const ph = (u.walkDist / STRIDE) * Math.PI * 2;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const bob = Math.abs(Math.cos(ph)) * 0.0;
  const hold = u.kind === 'nayzachi' || u.kind === 'konchi' ? 0.08 : 0.2; // tutib turgan qo'l kam silkinadi
  return {
    ...base,
    y: bob,
    body: base.body + 0.05,
    head: -0.03 * s,
    sh: base.sh + hold * s,
    shF: base.shF - 0.12 * s,
    hipN: LEG_SWING * s,
    kneeN: 0.08 + KNEE_LIFT * Math.max(0, -c) ** 1.5,
    hipF: -LEG_SWING * s,
    kneeF: 0.08 + KNEE_LIFT * Math.max(0, c) ** 1.5,
    cape: base.cape + 0.16 + 0.07 * s,
  };
}

function idlePose(u: Unit, base: Pose): Pose {
  const t = u.animT + u.id * 0.37;
  const b = Math.sin(t * 2.2);
  return { ...base, y: 0.35 * b, body: base.body + 0.012 * b, sh: base.sh + 0.04 * b, shF: base.shF - 0.03 * b, cape: base.cape + 0.03 * b };
}

// Yiqilish: orqaga, tobora tezlashib; yerga urilib biroz sakraydi
function deathPose(u: Unit, base: Pose): Pose {
  const t = u.deadT;
  const k = Math.min(1, t / 0.5);
  const bounce = t > 0.5 ? Math.exp(-(t - 0.5) * 9) * Math.sin((t - 0.5) * 22) * 0.05 : 0;
  return {
    ...base,
    fall: -(Math.PI / 2) * k * k + bounce,
    sh: -2.4 * k + base.sh * (1 - k),
    el: 0.3,
    shF: -2.0 * k + base.shF * (1 - k),
    elF: 0.2,
    head: 0.25 * k,
    kneeN: 0.6 * Math.sin(k * Math.PI),
    kneeF: 0.5 * Math.sin(k * Math.PI),
    hipN: 0.1,
    hipF: -0.15,
    cape: 0.3 * (1 - k),
    aux: base.aux,
  };
}

function targetPose(u: Unit): Pose {
  let base = STANCE[u.kind];
  if (u.kind === 'konchi' && u.load > 0) {
    // yuk: kumushli savat orqada, ikki qo'l tasmada
    base = { ...base, sh: -0.25, el: -1.2, shF: -0.3, elF: -1.1, aux: 1, body: 0.12 };
  }
  if (u.dead) return deathPose(u, base);
  let p: Pose;
  const mv = MOVES[u.kind];
  const sw = swingPhase(u);
  const keys = u.swingAlt ? mv.b : mv.a;
  if (sw >= 0 && keys) p = track(base, keys, sw, mv.hit);
  else if (u.anim === 'walk' || u.anim === 'carry') p = walkPose(u, base);
  else p = idlePose(u, base);
  if (u.hitT > 0) {
    // zarba yedi: gavda orqaga silkinadi
    const k = Math.min(1, u.hitT / 0.22);
    p = { ...p, body: p.body - 0.2 * k, head: p.head - 0.15 * k, x: p.x - 1.5 * k };
  }
  return p;
}

// Holat almashganda (turish → yurish → zarba) pozalar sakramasin: har askarning oxirgi pozasi
// yangi holatga tez, lekin silliq yetib boradi. Zarba kechikmasligi uchun tezroq.
const last = new WeakMap<Unit, { p: Pose; t: number }>();

export function rigPose(u: Unit): Pose {
  const target = targetPose(u);
  const now = performance.now() / 1000;
  const prev = last.get(u);
  let p = target;
  if (prev && !u.dead) {
    const dt = Math.min(0.1, now - prev.t);
    const rate = swingPhase(u) >= 0 ? 30 : 14;
    p = mix(prev.p, target, 1 - Math.exp(-rate * dt));
    p.aux = target.aux; // 0/1 belgilar aralashmaydi
  }
  last.set(u, { p, t: now });
  return p;
}

// ---------------- Chizish ----------------

type Ctx = CanvasRenderingContext2D;

function part(ctx: Ctx, pt: RigPart | undefined): void {
  if (pt && ready(pt.img)) ctx.drawImage(pt.img, -pt.px, -pt.py, pt.w, pt.h);
}

// Qurol qo'lda: bo'lak rasmi gorizontal (uchi o'ngda) — +90° burib, uchi pastga qaratiladi
function held(ctx: Ctx, pt: RigPart | undefined): void {
  if (!pt) return;
  ctx.save();
  ctx.rotate(Math.PI / 2);
  part(ctx, pt);
  ctx.restore();
}

// Qo'l: yelka → yuqori qo'l → tirsak → bilak; bilakning oxirida (qo'l turgan joyda) qurol chiziladi.
// Qaytaradi: qo'l turgan joyning matritsasi va shu joydagi umumiy burchak (qalqon/kamon tik tursin uchun).
function arm(ctx: Ctx, rig: Rig, at: [number, number], sh: number, el: number, far: boolean, weapon?: (c: Ctx) => void): { m: DOMMatrix; ang: number } {
  const P = rig.parts;
  const J = rig.joints;
  const d = far ? '_d' : '';
  ctx.save();
  ctx.translate(at[0], at[1]);
  ctx.rotate(sh);
  part(ctx, P['upper' + d]);
  ctx.translate(J.elbow[0], J.elbow[1]);
  ctx.rotate(el);
  ctx.save();
  ctx.translate(J.hand[0], J.hand[1]);
  const m = ctx.getTransform();
  weapon?.(ctx);
  ctx.restore();
  part(ctx, P['fore' + d]); // qo'l qurolni ushlab turadi
  ctx.restore();
  return { m, ang: sh + el };
}

function leg(ctx: Ctx, rig: Rig, at: [number, number], hip: number, knee: number, far: boolean): void {
  const P = rig.parts;
  const d = far ? '_d' : '';
  ctx.save();
  ctx.translate(at[0], at[1]);
  ctx.rotate(hip);
  part(ctx, P['thigh' + d]);
  ctx.translate(rig.joints.knee[0], rig.joints.knee[1]);
  ctx.rotate(knee);
  part(ctx, P['shin' + d]);
  ctx.restore();
}

// Son bo'g'inidan oyoq tagigacha tik masofa
function legDepth(rig: Rig, hip: number, knee: number): number {
  const t = rig.joints.knee[1];
  return t * Math.cos(hip) + rig.joints.foot * Math.cos(hip + knee);
}

// Qo'l matritsasida bo'lakni tik (yoki rot burchakda) chizadi: qalqon, kamon
function upright(ctx: Ctx, h: { m: DOMMatrix; ang: number }, pt: RigPart | undefined, rot = 0): void {
  ctx.save();
  ctx.setTransform(h.m);
  ctx.rotate(-h.ang + rot);
  part(ctx, pt);
  ctx.restore();
}

// Koordinatalar o'yin birligida, (0, 0) — oyoqlar orasi, yer sathida; jangchi o'ngga qaragan
export function drawRig(ctx: Ctx, rig: Rig, p: Pose, kind: Kind): void {
  const J = rig.joints;
  const P = rig.parts;
  const full = J.knee[1] + J.foot;
  // oyoqlar bukilganda gavda pastga tushadi — pastroqdagi oyoq tagi yerga tegib turadi
  const drop = full - Math.max(legDepth(rig, p.hipN, p.kneeN), legDepth(rig, p.hipF, p.kneeF));
  ctx.save();
  if (p.fall) ctx.rotate(p.fall);
  ctx.translate(J.hip[0] + p.x, J.hip[1] + p.y + (p.fall ? 0 : drop));
  ctx.save();
  ctx.rotate(p.body);

  const sabre = (c: Ctx) => held(c, P.weapon);
  // uzoq qo'l — gavda orqasida (qalqon va kamon keyin / yonida chiziladi)
  let farHand: { m: DOMMatrix; ang: number };
  if (kind === 'amir') farHand = arm(ctx, rig, J.shoulderFar, p.shF, p.elF, true, (c) => { c.rotate(p.blF); sabre(c); });
  else farHand = arm(ctx, rig, J.shoulderFar, p.shF, p.elF, true);
  ctx.restore();

  leg(ctx, rig, J.hipFront, p.hipF, p.kneeF, true);
  leg(ctx, rig, J.hipBack, p.hipN, p.kneeN, false);

  ctx.save();
  ctx.rotate(p.body);
  // orqadagi buyumlar: plash, o'qdon, savat
  if (P.cape && J.cape) {
    ctx.save();
    ctx.translate(J.cape[0], J.cape[1]);
    ctx.rotate(p.cape);
    part(ctx, P.cape);
    ctx.restore();
  }
  if (P.quiver && J.quiver) {
    ctx.save();
    ctx.translate(J.quiver[0], J.quiver[1]);
    ctx.rotate(-0.3);
    part(ctx, P.quiver);
    ctx.restore();
  }
  const basket = p.aux ? P.basketfull : P.basket;
  if (basket && J.basket) {
    ctx.save();
    ctx.translate(J.basket[0], J.basket[1]);
    ctx.rotate(p.cape * 0.5 - 0.03);
    part(ctx, basket);
    ctx.restore();
  }

  part(ctx, P.torso);
  ctx.save();
  ctx.translate(J.neck[0], J.neck[1]);
  ctx.rotate(p.head);
  part(ctx, P.head);
  ctx.restore();

  // qalqon (ko'krak oldida) va kamon (uzoq qo'lda) — gavdaning oldida
  if (kind === 'qilichli' || kind === 'nayzachi') upright(ctx, farHand, P.shield, 0.05);
  if (kind === 'kamonchi') upright(ctx, farHand, P.weapon, -0.05);

  // yaqin qo'l va uning quroli
  const near = (c: Ctx): void => {
    c.rotate(p.bl);
    if (kind === 'kamonchi') {
      if (p.aux && P.arrow) {
        // o'q kamonga o'rnatilgan: jangchining oldiga qarab gorizontal
        c.rotate(-(p.sh + p.el + p.bl) - 0.02);
        part(c, P.arrow);
      }
    } else if (kind !== 'konchi' || !p.aux) held(c, P.weapon);
  };
  arm(ctx, rig, J.shoulder, p.sh, p.el, false, near);
  ctx.restore();

  ctx.restore();
}

// Chizish chegarasi (o'yin birligida, oyoq ostidan): yiqilgan gavda, ko'tarilgan nayza ham sig'adi
export function rigBounds(rig: Rig): { l: number; r: number; t: number; b: number } {
  const h = rig.h;
  return { l: -(h + 40), r: h + 70, t: -(h * 1.9), b: 14 };
}
