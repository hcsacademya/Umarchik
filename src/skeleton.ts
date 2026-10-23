// Skelet animatsiya: jangchi bo'laklardan yig'iladi (gavda, bosh, qo'llar, oyoqlar, qurol), har kadrda suyaklar
// burchagi askar holatidan hisoblanadi va bo'laklar shu burchakda chiziladi. Tayyor kadrlar yo'q —
// harakat ekran tezligida silliq, yurish va yugurish qadami bosib o'tilgan yo'lga mos (oyoq sirpanmaydi).
// Takrorlanmasligi uchun: har askarning o'z odati (qadam, qo'l silkinishi, egilish), zarbaning 3 xil turi
// tasodifiy, turganda vaqti-vaqti bilan tasodifiy harakatlar (qarash, oyoq almashtirish, qurolni to'g'rilash).
import type { Rig, RigPart } from './assets.ts';
import { ready } from './assets.ts';
import { swingPhase } from './battle.ts';
import type { Unit } from './battle.ts';
import { RANK } from './config.ts';
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
  aim: number; // kamonchi: uzoq nishonga o'q yuqoriroq (radian)
  footN: number; // oyoq kaftlari burchagi (0 — yerga tekis; musbat — tovon ko'tarilgan, uchi pastda)
  footF: number;
  ground: number; // 1 — gavda balandligi pastroqdagi oyoq yerga tegadigan qilib o'zi topiladi; 0 — y aniq berilgan (qadam)
}

type Key = Partial<Pose>;

// Takrorlanmas tasodif: bir askar uchun doim bir xil, askarlar orasida har xil
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const rnd = (u: Unit, k: number): number => hash(u.id * 13.7 + k * 7.31);

const BASE: Pose = {
  x: 0, y: 0, body: 0.04, head: 0,
  sh: 0, el: -0.3, bl: 0, shF: 0, elF: -0.3, blF: 0,
  hipN: 0.1, kneeN: 0.08, hipF: -0.12, kneeF: 0.08,
  fall: 0, cape: 0.06, aux: 0, aim: 0, footN: 0, footF: 0, ground: 1,
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

// Dushman yaqin: jangovar holat — oyoqlar keng, gavda egilgan, qurol tayyor
const GUARD: Record<Kind, Key> = {
  amir: { body: 0.12, sh: -0.5, el: -1.3, bl: -0.8, shF: -0.55, elF: -1.4, blF: -0.5, hipN: 0.3, kneeN: 0.3, hipF: -0.3, kneeF: 0.3 },
  qilichli: { body: 0.12, sh: -0.45, el: -0.9, bl: -0.45, shF: -0.95, elF: -1.2, hipN: 0.3, kneeN: 0.3, hipF: -0.3, kneeF: 0.3 },
  nayzachi: { body: 0.12, sh: -0.5, el: -0.6, bl: -1.9, shF: -0.95, elF: -1.2, hipN: 0.3, kneeN: 0.3, hipF: -0.3, kneeF: 0.3 },
  kamonchi: { body: 0.1, sh: -0.2, el: -0.7, shF: -0.6, elF: -0.8, hipN: 0.25, kneeN: 0.25, hipF: -0.25, kneeF: 0.25 },
  konchi: {},
  otliq: {},
};

// ---------------- Zarbalar ----------------
// Zarba ulushi 0..1. Yaqin jangchilarda dushmanga 0.444 da tegadi, kamonchida 0.71 da o'q uchadi.
const HIT_M = 0.444;
const HIT_A = 0.71;

type Track = [number, Key][];

// Amir: A — boshdan oshirib chopish (yaqin qo'l), B — uzoq qo'l bilan ko'ndalang, C — ikkala qilich bilan xoch
const AMIR: Track[] = [
  [
    [0.3, { sh: -3.3, el: -0.6, bl: -0.4, body: -0.12, head: -0.05, x: -1.5, hipN: 0.2, hipF: -0.25, cape: 0.35 }],
    [HIT_M, { sh: -1.2, el: -0.25, bl: 0.2, body: 0.2, head: 0.08, x: 3.5, hipN: 0.35, kneeN: 0.25, hipF: -0.45, kneeF: 0.2, cape: 0.05 }],
    [0.62, { sh: -0.8, el: -0.35, bl: -0.1, body: 0.16, head: 0.05, x: 3, hipN: 0.3, kneeN: 0.2, hipF: -0.4, kneeF: 0.15, cape: 0.2 }],
  ],
  [
    [0.3, { shF: 0.9, elF: 0.8, blF: 0.6, sh: -0.6, el: -1.5, body: -0.1, x: -1, cape: 0.3 }],
    [HIT_M, { shF: -1.5, elF: -0.1, blF: 0, sh: -0.5, el: -1.4, body: 0.22, head: 0.06, x: 4, hipN: 0.4, kneeN: 0.2, hipF: -0.4, kneeF: 0.1, cape: 0.05 }],
    [0.62, { shF: -1.35, elF: -0.3, blF: -0.2, sh: -0.45, el: -1.3, body: 0.15, x: 3.5, hipN: 0.35, kneeN: 0.15, hipF: -0.35, cape: 0.2 }],
  ],
  [
    [0.3, { sh: 0.6, el: -0.9, bl: 0.3, shF: 0.6, elF: -0.9, blF: 0.3, body: -0.14, x: -2, hipN: 0.25, hipF: -0.2, cape: 0.4 }],
    [HIT_M, { sh: -1.35, el: -0.2, bl: -0.5, shF: -1.35, elF: -0.2, blF: 0.3, body: 0.24, head: 0.08, x: 4.5, hipN: 0.4, kneeN: 0.25, hipF: -0.5, kneeF: 0.2, cape: 0.05 }],
    [0.62, { sh: -0.9, el: -0.5, bl: -0.3, shF: -0.9, elF: -0.5, blF: 0, body: 0.17, x: 3.5, hipN: 0.3, kneeN: 0.2, hipF: -0.4, cape: 0.2 }],
  ],
];

// Qilichli: A — boshdan chopish, B — ko'ndalang, C — oldinga sanchish (qalqon bilan itarib)
const SWORD: Track[] = [
  [
    [0.3, { sh: -3.2, el: -0.5, bl: -0.5, body: -0.12, head: -0.05, x: -1.5, hipN: 0.2, hipF: -0.25, shF: -0.7, elF: -1.0 }],
    [HIT_M, { sh: -1.15, el: -0.2, bl: 0.15, body: 0.2, head: 0.08, x: 3.5, hipN: 0.35, kneeN: 0.25, hipF: -0.45, kneeF: 0.2, shF: -0.5, elF: -0.8 }],
    [0.62, { sh: -0.8, el: -0.35, bl: -0.2, body: 0.16, head: 0.05, x: 3, hipN: 0.3, kneeN: 0.2, hipF: -0.4, kneeF: 0.15 }],
  ],
  [
    [0.3, { sh: 0.9, el: -0.4, bl: 0, body: -0.12, x: -1.5, hipN: 0.15, hipF: -0.2 }],
    [HIT_M, { sh: -1.5, el: -0.12, bl: -0.1, body: 0.2, head: 0.06, x: 3.5, hipN: 0.35, kneeN: 0.2, hipF: -0.4, kneeF: 0.15 }],
    [0.62, { sh: -1.2, el: -0.3, bl: -0.2, body: 0.15, x: 3, hipN: 0.3, kneeN: 0.15, hipF: -0.35 }],
  ],
  [
    [0.3, { sh: 0.4, el: -1.3, bl: -0.4, body: -0.08, x: -2, hipN: 0.2, hipF: -0.3, shF: -0.8, elF: -1.1 }],
    [HIT_M, { sh: -1.45, el: -0.1, bl: 0.05, body: 0.24, head: 0.06, x: 4.5, hipN: 0.45, kneeN: 0.25, hipF: -0.5, kneeF: 0.15, shF: -1.2, elF: -0.9 }],
    [0.62, { sh: -1.3, el: -0.25, bl: -0.1, body: 0.18, x: 4, hipN: 0.4, kneeN: 0.2, hipF: -0.45, shF: -0.9, elF: -1.0 }],
  ],
];

// Nayzachi: A — oldinga sanchish, B — tepadan pastga sanchish, C — pastdan, oyoqqa sanchish
const SPEAR: Track[] = [
  [
    [0.3, { sh: 0.7, el: -1.0, bl: -1.1, body: -0.1, x: -2.5, hipN: 0.25, hipF: -0.3, kneeF: 0.25 }],
    [HIT_M, { sh: -1.25, el: -0.15, bl: -0.15, body: 0.22, head: 0.06, x: 5, hipN: 0.45, kneeN: 0.25, hipF: -0.5, kneeF: 0.1 }],
    [0.62, { sh: -1.1, el: -0.2, bl: -0.25, body: 0.18, x: 4.5, hipN: 0.4, kneeN: 0.2, hipF: -0.45 }],
  ],
  [
    [0.3, { sh: -2.5, el: -0.8, bl: -0.5, body: -0.12, x: -1.5, hipN: 0.2, hipF: -0.25 }],
    [HIT_M, { sh: -1.6, el: -0.3, bl: 0.5, body: 0.2, head: 0.06, x: 4, hipN: 0.4, kneeN: 0.2, hipF: -0.4, kneeF: 0.1 }],
    [0.62, { sh: -1.3, el: -0.4, bl: 0.2, body: 0.15, x: 3.5, hipN: 0.3, kneeN: 0.15, hipF: -0.35 }],
  ],
  [
    [0.3, { sh: 0.5, el: -0.6, bl: -0.5, body: 0.0, x: -2, hipN: 0.3, kneeN: 0.35, hipF: -0.35, kneeF: 0.4, y: 2 }],
    [HIT_M, { sh: -0.9, el: -0.1, bl: 0.35, body: 0.28, head: 0.08, x: 5, hipN: 0.55, kneeN: 0.45, hipF: -0.6, kneeF: 0.3, y: 2 }],
    [0.62, { sh: -0.8, el: -0.2, bl: 0.2, body: 0.22, x: 4.5, hipN: 0.45, kneeN: 0.35, hipF: -0.5, y: 1 }],
  ],
];

// Kamonchi: kamon ko'tariladi, o'q tortiladi, qo'yib yuboriladi (aux — o'q kamonda). B — tez, qisqa tortish; C — sekin, to'liq
const BOW: Track[] = [
  [
    [0.22, { shF: -1.5, elF: -0.1, sh: 0.5, el: -1.3, body: 0.0, aux: 1 }],
    [0.6, { shF: -1.55, elF: -0.05, sh: 1.25, el: -2.35, body: -0.06, head: 0.04, x: -1.5, hipN: 0.15, aux: 1 }],
    [HIT_A, { shF: -1.55, elF: -0.05, sh: 1.2, el: -2.35, body: -0.05, x: -1.5, hipN: 0.15, aux: 1 }],
    [0.8, { shF: -1.5, elF: -0.1, sh: 0.7, el: -1.4, body: 0.04, x: 0, aux: 0 }],
  ],
  [
    [0.18, { shF: -1.45, elF: -0.12, sh: 0.7, el: -1.6, body: 0.02, aux: 1 }],
    [0.6, { shF: -1.5, elF: -0.08, sh: 1.0, el: -2.1, body: 0.0, head: 0.02, x: -0.8, hipN: 0.1, aux: 1 }],
    [HIT_A, { shF: -1.5, elF: -0.08, sh: 0.95, el: -2.1, body: 0.0, x: -0.8, aux: 1 }],
    [0.78, { shF: -1.4, elF: -0.15, sh: 0.5, el: -1.2, body: 0.05, x: 0.5, aux: 0 }],
  ],
  [
    [0.26, { shF: -1.6, elF: 0.0, sh: 0.4, el: -1.2, body: -0.02, hipN: 0.2, hipF: -0.2, aux: 1 }],
    [0.62, { shF: -1.62, elF: 0.0, sh: 1.35, el: -2.5, body: -0.1, head: 0.06, x: -2, hipN: 0.25, hipF: -0.25, kneeN: 0.15, aux: 1 }],
    [HIT_A, { shF: -1.62, elF: 0.0, sh: 1.3, el: -2.5, body: -0.09, x: -2, hipN: 0.25, hipF: -0.25, kneeN: 0.15, aux: 1 }],
    [0.84, { shF: -1.55, elF: -0.05, sh: 0.8, el: -1.5, body: 0.03, x: 0, aux: 0 }],
  ],
];

interface Moves {
  tracks?: Track[];
  hit: number;
}

const MOVES: Record<Kind, Moves> = {
  amir: { tracks: AMIR, hit: HIT_M },
  qilichli: { tracks: SWORD, hit: HIT_M },
  nayzachi: { tracks: SPEAR, hit: HIT_M },
  kamonchi: { tracks: BOW, hit: HIT_A },
  konchi: { hit: HIT_M },
  otliq: { hit: HIT_M },
};

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

// ---------------- Yurish va yugurish: haqiqiy qadam ----------------
// Har oyoq uchun qadam sikli: yerda turgan oyoq (tayanch) bosib o'tilgan yo'lga aynan teng orqaga suriladi —
// yerga mahkam turadi, sirpanmaydi; havodagi oyoq ko'tarilib oldinga o'tadi. Son va tizza burchagi oyoq kafti
// qayerda turishi kerakligidan hisoblanadi (ikki bo'g'inli IK): tizza o'zi bukiladi, tovon avval yerga tegadi,
// qadam oxirida tovon ko'tarilib oyoq uchidan itariladi. Gavda yurishda tayanch oyoq ustidan "oshib" o'tadi
// (o'rtada eng baland), yugurishda havoda biroz ko'tariladi. Qo'llar oyoqlarga qarama-qarshi silkinadi.

interface Gait {
  S: number; // to'liq sikl (ikki qadam) necha birlik yo'l, bo'yga nisbatan
  beta: number; // sikldan yerda turish ulushi
  c0: number; // oyoq gavdadan qancha oldinroq qo'yiladi (bo'yga nisbatan)
  lift: number; // havodagi oyoq ko'tarilishi (bo'yga nisbatan)
  early: number; // ko'tarilish sikl boshida bo'ladi (yugurishda tovon orqaga ko'tariladi)
  bend: number; // tizzalar doim biroz bukik (gavda pastroq, bo'yga nisbatan)
}

const WALK: Gait = { S: 0.84, beta: 0.6, c0: 0.03, lift: 0.07, early: 0.7, bend: 0.004 };
const RUN: Gait = { S: 1.05, beta: 0.36, c0: 0.05, lift: 0.2, early: 0.35, bend: 0.035 };

// Qo'llar silkinishi (yurish, yugurish): yaqin va uzoq qo'l; qurol ushlagan qo'l kamroq
const ARMS: Record<Kind, { n: [number, number]; f: [number, number]; freeN?: boolean; freeF?: boolean }> = {
  amir: { n: [0.22, 0.38], f: [0.22, 0.38] },
  qilichli: { n: [0.28, 0.42], f: [0.08, 0.12] },
  nayzachi: { n: [0.06, 0.1], f: [0.08, 0.12] },
  kamonchi: { n: [0.32, 0.55], f: [0.14, 0.22], freeN: true },
  konchi: { n: [0.04, 0.06], f: [0.32, 0.5], freeF: true },
  otliq: { n: [0, 0], f: [0, 0] },
};

interface Foot {
  x: number; // tovon (to'piq) gavda ostidan qancha oldinda
  up: number; // to'piq yerdan qancha baland (oyoq kafti burchagi va ko'tarilishi bilan)
  ang: number; // oyoq kafti burchagi
  stance: boolean;
}

function footAt(p: number, g: Gait, S: number, H: number, rig: Rig): Foot {
  p = ((p % 1) + 1) % 1;
  const J = rig.joints;
  const sole = J.sole ?? 0;
  const ft = rig.parts.foot;
  const toe = ft ? ft.w - ft.px : 0.08 * H;
  const heel = ft ? ft.px : 0.02 * H;
  const half = (g.beta * S) / 2;
  const c0 = g.c0 * H;
  let x: number;
  let lift = 0;
  let ang: number;
  let stance = false;
  const run = g === RUN;
  if (p < g.beta) {
    stance = true;
    const t = p / g.beta;
    x = half + c0 - t * g.beta * S;
    if (run) ang = 0.12 - 0.12 * t + 0.35 * smooth(Math.max(0, (t - 0.65) / 0.35));
    else ang = t < 0.15 ? -0.2 * (1 - smooth(t / 0.15)) : 0.55 * smooth(Math.max(0, (t - 0.68) / 0.32));
  } else {
    const t = (p - g.beta) / (1 - g.beta);
    const e = smooth(t);
    x = -half + c0 + g.beta * S * (run ? e ** 1.35 : e);
    // yurishda oyoq yerdan past o'tadi; yugurishda avval tovon orqaga ko'tariladi, keyin oyoq pasayib oldinga chiqadi
    lift = run
      ? g.lift * H * (t < g.early ? Math.sin((Math.PI / 2) * (t / g.early)) : Math.cos((Math.PI / 2) * ((t - g.early) / (1 - g.early))) ** 2.4)
      : g.lift * H * Math.sin(Math.PI * t ** g.early);
    const a0 = run ? 0.47 : 0.55;
    const a1 = run ? 0.1 : -0.2;
    ang = a0 + (a1 - a0) * smooth(Math.min(1, t * 1.1));
  }
  // tovon ko'tarilsa oyoq uchidan, uchi ko'tarilsa tovondan burilib turadi — to'piq shunga qarab ko'tariladi
  const up = sole * Math.cos(ang) + (ang > 0 ? toe * Math.sin(ang) : heel * Math.sin(-ang)) + lift;
  if (ang > 0) x += toe * (1 - Math.cos(ang));
  return { x, up, ang, stance };
}

// Ikki bo'g'inli IK: son bo'g'inidan (tx, ty) nuqtaga to'piqni yetkazadigan son va tizza burchagi (tizza oldinda)
function ik(rig: Rig, tx: number, ty: number): [number, number] {
  const J = rig.joints;
  const [kx, ky] = J.knee;
  const [ax, ay] = J.ankle ?? [0, J.foot];
  const l1 = Math.hypot(kx, ky);
  const l2 = Math.hypot(ax, ay);
  const psiK = Math.atan2(-kx, ky);
  const psiA = Math.atan2(-ax, ay);
  const d = Math.max(Math.abs(l1 - l2) + 0.5, Math.min(l1 + l2 - 0.02, Math.hypot(tx, ty)));
  const psiT = Math.atan2(-tx, ty);
  const g = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const th1 = psiT - g;
  const kxw = -Math.sin(th1) * l1;
  const kyw = Math.cos(th1) * l1;
  const th2 = Math.atan2(-(-Math.sin(psiT) * d - kxw), Math.cos(psiT) * d - kyw);
  const hip = th1 - psiK;
  return [hip, th2 - hip - psiA];
}

function gaitPose(u: Unit, base: Pose, rig: Rig, run: boolean): Pose {
  const g = run ? RUN : WALK;
  const J = rig.joints;
  const H = rig.h;
  const sc = RANK[u.rank].scale;
  const S = g.S * H * (0.94 + 0.12 * rnd(u, 1));
  const ph = u.walkDist / sc / S; // dunyo yo'li chizish masshtabiga keltiriladi
  const near = footAt(ph, g, S, H, rig);
  const far = footAt(ph + 0.5, g, S, H, rig);
  // gavda (son bo'g'ini) balandligi: tayanch oyoq yetadigan eng baland joy; tizzalar biroz bukik
  const [kx, ky] = J.knee;
  const [ax, ay] = J.ankle ?? [0, J.foot];
  const reach = Math.hypot(kx + ax, ky + ay) * 0.992;
  const stand = -J.hip[1];
  let h = stand - g.bend * H;
  if (run) h += 1.3 * Math.cos(Math.PI * 4 * (ph - g.beta / 2) + Math.PI); // tayanch o'rtasida past, havoda baland
  for (const [f, at] of [[near, J.hipBack], [far, J.hipFront]] as [Foot, [number, number]][]) {
    if (!f.stance) continue;
    const dx = f.x - at[0];
    h = Math.min(h, f.up + Math.sqrt(Math.max(0, reach * reach - dx * dx)));
  }
  const [hipN, kneeN] = ik(rig, near.x - J.hipBack[0], h - near.up - J.hipBack[1]);
  const [hipF, kneeF] = ik(rig, far.x - J.hipFront[0], h - far.up - J.hipFront[1]);
  // qo'llar: yaqin oyoq oldinda bo'lsa yaqin qo'l orqada (qarama-qarshi), uzoq qo'l oldinda
  const sN = near.x / ((g.beta * S) / 2 + 1e-6);
  const am = ARMS[u.kind];
  const k = run ? 1 : 0;
  const aa = 0.8 + 0.4 * rnd(u, 2);
  const lean = run ? 0.15 + (rnd(u, 3) - 0.5) * 0.05 : 0.03 + (rnd(u, 3) - 0.5) * 0.03;
  const p: Pose = {
    ...base,
    ground: 0,
    y: stand - h,
    x: run ? 1 : 0,
    body: base.body + lean,
    head: -0.6 * lean - 0.02 * sN,
    hipN, kneeN, hipF, kneeF,
    footN: near.ang,
    footF: far.ang,
    sh: base.sh + am.n[k] * aa * Math.max(-1.2, Math.min(1.2, sN)),
    shF: base.shF - am.f[k] * aa * Math.max(-1.2, Math.min(1.2, sN)),
    cape: base.cape + (run ? 0.55 : 0.18) + 0.06 * Math.sin(ph * Math.PI * 4),
  };
  if (am.freeN) p.el = run ? -1.4 : base.el - 0.15;
  if (am.freeF) p.elF = run ? -1.4 : base.elF - 0.15;
  return p;
}

// Turganda: nafas olish + vaqti-vaqti bilan har xil tasodifiy harakat (qarash, oyoq almashtirish, qurolni to'g'rilash)
function idlePose(u: Unit, base: Pose): Pose {
  const t = u.animT + u.id * 0.37;
  const b = Math.sin(t * (1.9 + 0.5 * rnd(u, 6)));
  const p: Pose = { ...base, y: 0.35 * b, body: base.body + 0.012 * b, sh: base.sh + 0.04 * b, shF: base.shF - 0.03 * b, cape: base.cape + 0.03 * b };
  const per = 3 + 3.5 * rnd(u, 5);
  const gt = u.animT + u.id * 1.37;
  const i = Math.floor(gt / per);
  const lt = gt - i * per;
  const dur = 1.5;
  if (lt > dur || hash(u.id * 3.1 + i * 1.7) < 0.25) return p;
  const e = Math.sin((Math.PI * lt) / dur) ** 2;
  const type = Math.floor(hash(u.id * 5.3 + i * 2.9) * 3);
  if (type === 0) {
    // atrofga qaraydi
    p.head += 0.16 * e;
    p.body += 0.04 * e;
  } else if (type === 1) {
    // og'irlikni boshqa oyoqqa o'tkazadi
    p.hipN += 0.2 * e;
    p.kneeN += 0.1 * e;
    p.hipF -= 0.08 * e;
    p.body -= 0.03 * e;
    p.y += 0.4 * e;
  } else {
    switch (u.kind) {
      case 'amir': p.bl -= 0.4 * e; p.blF += 0.5 * e; p.sh -= 0.15 * e; break; // qilichlarni aylantiradi
      case 'qilichli': p.bl += 0.7 * e; p.el += 0.25 * e; break;
      case 'nayzachi': p.sh -= 0.2 * e; p.bl += 0.25 * e; p.shF -= 0.15 * e; break;
      case 'kamonchi': p.shF -= 0.35 * e; p.elF -= 0.2 * e; p.head -= 0.1 * e; break; // kamonni ko'taradi
      case 'konchi': p.sh -= 0.25 * e; p.el += 0.35 * e; p.head += 0.1 * e; break;
      default:
    }
  }
  return p;
}

// Yiqilish: zarba old tomondan bo'lsa orqaga, orqadan bo'lsa oldinga; ba'zilari avval tiz cho'kadi
function deathPose(u: Unit, base: Pose): Pose {
  const t = u.deadT;
  const back = u.hitDir === 0 || u.hitDir !== u.facing; // zarba oldidan
  const kneel = (u.id & 2) !== 0;
  const t0 = kneel ? 0.28 : 0;
  const kn = kneel ? smooth(Math.min(1, t / 0.28)) : 0;
  const k = Math.max(0, Math.min(1, (t - t0) / 0.5));
  const bounce = t - t0 > 0.5 ? Math.exp(-(t - t0 - 0.5) * 9) * Math.sin((t - t0 - 0.5) * 22) * 0.05 : 0;
  const dir = back ? -1 : 1;
  const common = {
    ...base,
    fall: dir * (Math.PI / 2) * k * k + dir * bounce,
    head: dir * -0.25 * k,
    cape: 0.3 * (1 - k),
    aux: base.aux,
  };
  if (kneel && k <= 0) {
    return { ...common, y: 7 * kn, kneeN: 1.5 * kn, kneeF: 1.4 * kn, hipN: -0.3 * kn, hipF: -0.9 * kn, footN: 1.2 * kn, footF: 0.5 * kn, body: base.body + 0.1 * kn, sh: base.sh * (1 - kn), shF: base.shF * (1 - kn) };
  }
  const arms = back ? { sh: -2.4, shF: -2.0, el: 0.3, elF: 0.2 } : { sh: -1.2, shF: -1.0, el: -0.4, elF: -0.3 };
  const kN = (kneel ? 1.5 * (1 - k) : 0) + 0.6 * Math.sin(k * Math.PI);
  const kF = (kneel ? 1.4 * (1 - k) : 0) + 0.5 * Math.sin(k * Math.PI);
  return {
    ...common,
    footN: 0.1 + kN,
    footF: -0.15 + kF,
    y: kneel ? 7 * (1 - k) : 0,
    sh: arms.sh * k + base.sh * (1 - k),
    el: arms.el,
    shF: arms.shF * k + base.shF * (1 - k),
    elF: arms.elF,
    kneeN: kN,
    kneeF: kF,
    hipN: 0.1,
    hipF: -0.15,
  };
}

function targetPose(u: Unit, rig: Rig): Pose {
  let base = STANCE[u.kind];
  if (u.kind === 'konchi' && u.load > 0) {
    // yuk: kumushli savat orqada, ikki qo'l tasmada
    base = { ...base, sh: -0.25, el: -1.2, shF: -0.3, elF: -1.1, aux: 1, body: 0.12 };
  }
  if (u.dead) return deathPose(u, base);
  let p: Pose;
  const mv = MOVES[u.kind];
  const sw = swingPhase(u);
  const keys = mv.tracks ? mv.tracks[Math.min(mv.tracks.length - 1, u.swingVar)] : undefined;
  if (sw >= 0 && keys) {
    p = track(base, keys, sw, mv.hit);
    if (u.kind === 'kamonchi') p.aim = 0.38 * Math.max(0, Math.min(1, (u.aimD - 90) / 150)); // uzoqroq nishonga yuqoriroq
  } else if (u.anim === 'run') p = gaitPose(u, base, rig, true);
  else if (u.anim === 'walk' || u.anim === 'carry') p = gaitPose(u, base, rig, false);
  else p = idlePose(u, base);
  // jang holati: dushman yaqin bo'lsa tayyor tur (zarba va yugurish orasida)
  if (u.guard && sw < 0 && u.anim !== 'run') {
    const g = GUARD[u.kind];
    p = mix(p, u.anim === 'walk' ? { ...g, hipN: p.hipN, hipF: p.hipF, kneeN: p.kneeN, kneeF: p.kneeF, footN: p.footN, footF: p.footF } : g, 0.85);
  }
  if (u.hitT > 0) {
    // zarba yedi: gavda zarba tomoniga silkinadi (old tomondan bo'lsa orqaga)
    const k = Math.min(1, u.hitT / 0.22);
    const dir = u.hitDir !== 0 && u.hitDir === u.facing ? 1 : -1;
    p = { ...p, body: p.body + dir * 0.22 * k, head: p.head + dir * 0.16 * k, x: p.x + dir * 1.6 * k, kneeN: p.kneeN + 0.25 * k, y: p.y + 0.8 * k };
  }
  return p;
}

// Holat almashganda (turish → yurish → yugurish → zarba → o'lim) pozalar sakramasin: oldingi pozadan
// yangisiga BLEND soniyada o'tadi. Holat ichida aralashtirilmaydi — aks holda poza kechikib, oyoq yerdan
// uziladi va sirpanadi (yurish va yugurish qadami allaqachon silliq hisoblanadi)
const BLEND = 0.15;
const last = new WeakMap<Unit, { p: Pose; mode: string; from: Pose; t0: number }>();

function modeOf(u: Unit): string {
  if (u.dead) return 'dead';
  if (swingPhase(u) >= 0) return 'attack';
  return `${u.anim}${u.guard ? ':g' : ''}${u.load > 0 ? ':l' : ''}`;
}

export function rigPose(u: Unit, rig: Rig): Pose {
  const target = targetPose(u, rig);
  const now = performance.now() / 1000;
  const mode = modeOf(u);
  const st = last.get(u);
  if (!st) {
    last.set(u, { p: target, mode, from: target, t0: now - BLEND });
    return target;
  }
  if (st.mode !== mode) {
    st.from = st.p;
    st.t0 = now;
    st.mode = mode;
  }
  const k = (now - st.t0) / BLEND;
  let p = target;
  if (k < 1) {
    p = mix(st.from, target, smooth(Math.max(0, k)));
    p.aux = target.aux; // 0/1 belgilar aralashmaydi
  }
  st.p = p;
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

// Oyoq: son → tizza → to'piq; oyoq kafti berilgan burchakda (0 — yerga tekis), boldir burilishidan qat'i nazar
function leg(ctx: Ctx, rig: Rig, at: [number, number], hip: number, knee: number, foot: number, far: boolean): void {
  const P = rig.parts;
  const J = rig.joints;
  const d = far ? '_d' : '';
  ctx.save();
  ctx.translate(at[0], at[1]);
  ctx.rotate(hip);
  part(ctx, P['thigh' + d]);
  ctx.translate(J.knee[0], J.knee[1]);
  ctx.rotate(knee);
  part(ctx, P['shin' + d]);
  if (J.ankle && P['foot' + d]) {
    ctx.translate(J.ankle[0], J.ankle[1]);
    ctx.rotate(foot - (hip + knee));
    part(ctx, P['foot' + d]);
  }
  ctx.restore();
}

// Son bo'g'inidan oyoq tagigacha tik masofa (oyoq kafti tekis turgani uchun tovondan pastga doim sole)
function legDepth(rig: Rig, hip: number, knee: number): number {
  const J = rig.joints;
  if (!J.ankle) return J.knee[1] * Math.cos(hip) + J.foot * Math.cos(hip + knee);
  return J.knee[1] * Math.cos(hip) + J.ankle[1] * Math.cos(hip + knee) + (J.sole ?? 0);
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
  const drop = p.ground * (full - Math.max(legDepth(rig, p.hipN, p.kneeN), legDepth(rig, p.hipF, p.kneeF)));
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

  leg(ctx, rig, J.hipFront, p.hipF, p.kneeF, p.footF, true);
  leg(ctx, rig, J.hipBack, p.hipN, p.kneeN, p.footN, false);

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
  if (kind === 'kamonchi') upright(ctx, farHand, P.weapon, -0.05 - p.aim * 0.5);

  // yaqin qo'l va uning quroli
  const near = (c: Ctx): void => {
    c.rotate(p.bl);
    if (kind === 'kamonchi') {
      if (p.aux && P.arrow) {
        // o'q kamonga o'rnatilgan: jangchining oldiga qarab gorizontal
        c.rotate(-(p.sh + p.el + p.bl) - 0.02 - p.aim);
        part(c, P.arrow);
      }
    } else if (kind !== 'konchi' || !p.aux) held(c, P.weapon);
  };
  arm(ctx, rig, J.shoulder, p.sh, p.el, false, near);
  ctx.restore();

  ctx.restore();
}

// ---------------- Otliq: ot va chavandoz ----------------
// Ot o'z skeleti bilan: tana, bo'yin-bosh, dum, to'rt oyoq (har biri ikki bo'g'inli). Yurishda to'rt zarbli
// qadam, yugurishda chopish (galop: orqa oyoqlar ketma-ket, keyin old oyoqlar, tana chayqaladi). Chavandoz
// egarda o'tiradi: oyoqlari bukilgan, qo'lida nayza (yoki qilich), uzoq qo'lida qalqon.

interface HPose {
  x: number;
  y: number;
  pitch: number; // tana old-orqaga qiyshayishi
  nfU: number; // yaqin old oyoq: yuqori bo'lak, pastki bo'lak
  nfL: number;
  ffU: number; // uzoq old oyoq
  ffL: number;
  nhU: number; // yaqin orqa oyoq
  nhL: number;
  fhU: number; // uzoq orqa oyoq
  fhL: number;
  neck: number;
  tail: number;
  rider: Pose;
  rx: number; // chavandoz siljishi va burilishi (yiqilganda egardan tushadi)
  ry: number;
  rrot: number;
  lance: number; // nayza burchagi (dunyoda): 0 — oldinga gorizontal, manfiy — uchi yuqoriga
  banner: number;
}

// Chavandoz egarda: son oldinga, boldir pastga; nayzali — nayza qo'ltiqda, qilichli — qilich ko'tarilgan
const RIDER_LANCE: Pose = {
  ...BASE, body: 0.05, hipN: -1.25, kneeN: 1.4, hipF: -1.2, kneeF: 1.35,
  sh: 0.3, el: -1.45, shF: -0.4, elF: -1.1, cape: 0.15, aim: 0, footN: -0.12, footF: -0.12,
};
const RIDER_SWORD: Pose = { ...RIDER_LANCE, sh: -0.35, el: -1.25, bl: -0.85 };

// Nayza bilan: A — oldinga sanchish, B — tepadan pastga, C — pastdan yuqoriga (aim — nayza burchagiga qo'shimcha)
const LANCE: Track[] = [
  [
    [0.3, { sh: 0.75, el: -1.6, body: -0.1, aim: -0.06 }],
    [HIT_M, { sh: -0.7, el: -0.4, body: 0.22, aim: 0.07 }],
    [0.62, { sh: -0.45, el: -0.7, body: 0.15, aim: 0.05 }],
  ],
  [
    [0.3, { sh: -2.6, el: -0.5, body: -0.12, aim: -0.85 }],
    [HIT_M, { sh: -1.6, el: -0.25, body: 0.2, aim: 0.5 }],
    [0.62, { sh: -1.2, el: -0.5, body: 0.12, aim: 0.3 }],
  ],
  [
    [0.3, { sh: 0.55, el: -1.25, body: -0.06, aim: -0.3 }],
    [HIT_M, { sh: -0.6, el: -0.55, body: 0.18, aim: 0.3 }],
    [0.62, { sh: -0.35, el: -0.85, body: 0.1, aim: 0.15 }],
  ],
];
// Qilich bilan (qo'mondon): tepadan chopish, ko'ndalang, orqadan yuqoriga
const RIDER_SWORD_T: Track[] = [
  [
    [0.3, { sh: -3.0, el: -0.6, bl: -0.4, body: -0.14 }],
    [HIT_M, { sh: -1.0, el: -0.2, bl: 0.4, body: 0.24 }],
    [0.62, { sh: -0.7, el: -0.4, bl: 0.1, body: 0.15 }],
  ],
  [
    [0.3, { sh: 0.8, el: -0.5, bl: 0.2, body: -0.1 }],
    [HIT_M, { sh: -1.4, el: -0.1, bl: 0.1, body: 0.22 }],
    [0.62, { sh: -1.1, el: -0.3, bl: 0, body: 0.12 }],
  ],
  [
    [0.3, { sh: -2.2, el: -1.6, bl: -0.8, body: -0.1 }],
    [HIT_M, { sh: -0.6, el: -0.2, bl: 0.6, body: 0.26 }],
    [0.62, { sh: -0.5, el: -0.5, bl: 0.2, body: 0.15 }],
  ],
];

const HIND_REST = 0.15; // orqa oyoq tinch turganda: soni orqaga qiya, pastki qismi tik

// Bitta oyoqning qadam sikli (p — 0..1): yerda turganda orqaga suriladi, havoda bukilib oldinga o'tadi
function gaitLeg(p: number, stance: number, A: number, B: number, fore: boolean): [number, number] {
  p = ((p % 1) + 1) % 1;
  if (p < stance) {
    const t = p / stance;
    return [-A + 2 * A * t, fore ? 0.05 * Math.sin(Math.PI * t) : -0.1 * Math.sin(Math.PI * t)];
  }
  const t = (p - stance) / (1 - stance);
  const lift = Math.sin(Math.PI * t);
  return [A - 2 * A * smooth(t), fore ? B * lift : -B * lift];
}

function horseBase(rider: Pose): HPose {
  return {
    x: 0, y: 0, pitch: 0,
    nfU: -0.02, nfL: 0, ffU: 0.04, ffL: 0,
    nhU: 0, nhL: 0, fhU: -0.04, fhL: 0,
    neck: 0, tail: 0.28, rider, rx: 0, ry: 0, rrot: 0, lance: -0.12, banner: 0,
  };
}

function horseTarget(u: Unit, rig: Rig): HPose {
  const W = rig.joints.horse!.W;
  const lance = (rig.parts.weapon?.w ?? 0) > rig.h;
  const rb = lance ? RIDER_LANCE : RIDER_SWORD;
  const hp = horseBase({ ...rb });
  const t = u.animT + u.id * 0.37;
  const sw = swingPhase(u);
  if (u.dead) {
    // ot cho'kadi: tizzalari bukiladi, tana yerga tushadi; chavandoz orqaga yiqilib egardan tushadi
    const k = smooth(Math.min(1, u.deadT / 0.7));
    const kr = smooth(Math.min(1, u.deadT / 0.55));
    hp.nfU = hp.ffU = -0.5 * k;
    hp.nfL = hp.ffL = 2.0 * k;
    hp.nhU = hp.fhU = 0.7 * k;
    hp.nhL = hp.fhL = -1.7 * k;
    hp.y = 0.42 * W * k;
    hp.pitch = 0.1 * k;
    hp.neck = 0.6 * k;
    hp.tail = 0.1;
    hp.rrot = -1.45 * kr;
    hp.rx = -16 * kr;
    hp.ry = 14 * kr;
    hp.rider = { ...rb, sh: -2.2 * kr + rb.sh * (1 - kr), el: 0.2, shF: -1.8 * kr + rb.shF * (1 - kr), elF: 0.1, kneeN: rb.kneeN * (1 - 0.6 * kr), head: 0.3 * kr };
    hp.lance = -0.12 - 0.6 * kr;
    return hp;
  }
  if (u.anim === 'run' || u.anim === 'walk' || u.anim === 'carry') {
    const run = u.anim === 'run';
    const c = u.walkDist / ((run ? 1.7 : 1.0) * W * RANK[u.rank].scale);
    if (run) {
      [hp.fhU, hp.fhL] = gaitLeg(c, 0.42, 0.55, 1.1, false);
      [hp.nhU, hp.nhL] = gaitLeg(c - 0.1, 0.42, 0.55, 1.1, false);
      [hp.ffU, hp.ffL] = gaitLeg(c - 0.36, 0.42, 0.6, 1.6, true);
      [hp.nfU, hp.nfL] = gaitLeg(c - 0.48, 0.42, 0.6, 1.6, true);
      const ph = Math.PI * 2 * c;
      hp.pitch = 0.07 * Math.sin(ph - 0.3);
      hp.y = -2.2 * Math.max(0, Math.sin(ph + 1.9));
      hp.neck = 0.16 + 0.1 * Math.sin(ph + 0.6);
      hp.tail = 0.95 + 0.12 * Math.sin(ph * 2);
      hp.rider.body = 0.2 + 0.04 * Math.sin(ph);
      hp.ry = 1.2 * Math.max(0, Math.sin(ph + 2.4));
      hp.rider.cape = 0.9 + 0.08 * Math.sin(ph * 2);
      hp.lance = lance ? -0.03 : hp.lance;
      hp.banner = -0.12;
    } else {
      [hp.nhU, hp.nhL] = gaitLeg(c, 0.62, 0.42, 0.8, false);
      [hp.nfU, hp.nfL] = gaitLeg(c - 0.25, 0.62, 0.42, 1.0, true);
      [hp.fhU, hp.fhL] = gaitLeg(c - 0.5, 0.62, 0.42, 0.8, false);
      [hp.ffU, hp.ffL] = gaitLeg(c - 0.75, 0.62, 0.42, 1.0, true);
      hp.neck = 0.05 + 0.05 * Math.sin(Math.PI * 4 * c);
      hp.tail = 0.4 + 0.08 * Math.sin(Math.PI * 2 * c);
      hp.y = -0.5 * Math.abs(Math.sin(Math.PI * 4 * c));
      hp.rider.cape = 0.35;
    }
  } else {
    // turibdi: nafas, dum silkinishi; vaqti-vaqti bilan boshini silkitadi yoki oldingi oyog'i bilan yer tepadi
    const b = Math.sin(t * 1.7);
    hp.y = 0.3 * b;
    hp.neck = 0.03 * b;
    hp.tail = 0.28 + 0.1 * Math.sin(t * 2.3 + u.id);
    const per = 3.5 + 3 * rnd(u, 5);
    const gt = u.animT + u.id * 1.37;
    const i = Math.floor(gt / per);
    const lt = gt - i * per;
    if (lt < 1.4 && hash(u.id * 3.1 + i * 1.7) > 0.3) {
      const e = Math.sin((Math.PI * lt) / 1.4) ** 2;
      if (hash(u.id * 5.3 + i * 2.9) < 0.5) hp.neck += -0.2 * e + 0.12 * Math.sin(lt * 14) * e; // bosh silkitish
      else {
        hp.nfU = -0.35 * e;
        hp.nfL = 1.1 * e; // yer tepadi
      }
    }
  }
  if (sw >= 0) {
    const tracks = lance ? LANCE : RIDER_SWORD_T;
    hp.rider = track(hp.rider, tracks[Math.min(tracks.length - 1, u.swingVar)], sw, HIT_M);
    // ot ham zarbaga qo'shiladi: oldinga intiladi
    const k = Math.sin(Math.PI * Math.min(1, sw / 0.6));
    hp.pitch += 0.04 * k;
    hp.x += 2 * k;
  }
  if (u.guard && sw < 0 && lance) hp.lance = -0.04;
  if (u.hitT > 0) {
    const k = Math.min(1, u.hitT / 0.22);
    hp.pitch -= 0.05 * k;
    hp.neck -= 0.15 * k;
    hp.rider = { ...hp.rider, body: hp.rider.body - 0.2 * k, head: hp.rider.head - 0.15 * k };
  }
  return hp;
}

const lastH = new WeakMap<Unit, { p: HPose; t: number }>();

function mixH(a: HPose, b: HPose, k: number): HPose {
  const out = { ...b, rider: mix(a.rider, b.rider, k) };
  for (const key of Object.keys(b) as (keyof HPose)[]) {
    if (key === 'rider') continue;
    (out[key] as number) = (a[key] as number) + ((b[key] as number) - (a[key] as number)) * k;
  }
  return out;
}

function horsePose(u: Unit, rig: Rig): HPose {
  const target = horseTarget(u, rig);
  const now = performance.now() / 1000;
  const prev = lastH.get(u);
  let p = target;
  if (prev && !u.dead) {
    const dt = Math.min(0.1, now - prev.t);
    p = mixH(prev.p, target, 1 - Math.exp(-(swingPhase(u) >= 0 ? 30 : 12) * dt));
  }
  lastH.set(u, { p, t: now });
  return p;
}

function horseLeg(ctx: Ctx, rig: Rig, at: [number, number], up: number, low: number, fore: boolean, far: boolean): void {
  const P = rig.parts;
  const H = rig.joints.horse!;
  const d = far ? '_d' : '';
  ctx.save();
  ctx.translate(at[0], at[1]);
  ctx.rotate(up + (fore ? 0 : HIND_REST));
  part(ctx, P[(fore ? 'h_fu' : 'h_hu') + d]);
  const j = fore ? H.fuKnee : H.huHock;
  ctx.translate(j[0], j[1]);
  ctx.rotate(low - (fore ? 0 : HIND_REST));
  part(ctx, P[(fore ? 'h_fl' : 'h_hl') + d]);
  ctx.restore();
}

function drawHorse(ctx: Ctx, rig: Rig, hp: HPose): void {
  const H = rig.joints.horse!;
  const J = rig.joints;
  const P = rig.parts;
  const r = hp.rider;
  const lance = (P.weapon?.w ?? 0) > rig.h;
  ctx.save();
  ctx.translate(H.body[0] + hp.x, H.body[1] + hp.y);
  ctx.rotate(hp.pitch);
  const seat = (): void => {
    ctx.translate(H.seat[0] + hp.rx, H.seat[1] + hp.ry);
    ctx.rotate(hp.rrot);
  };
  // chavandozning uzoq oyog'i — ot orqasida
  ctx.save();
  seat();
  ctx.rotate(r.body);
  leg(ctx, rig, J.hipFront, r.hipF, r.kneeF, r.footF, true);
  ctx.restore();
  horseLeg(ctx, rig, H.hind, hp.fhU, hp.fhL, false, true);
  horseLeg(ctx, rig, H.fore, hp.ffU, hp.ffL, true, true);
  ctx.save();
  ctx.translate(H.tail[0], H.tail[1]);
  ctx.rotate(hp.tail);
  part(ctx, P.h_tail);
  ctx.restore();
  ctx.save();
  ctx.translate(H.neck[0], H.neck[1]);
  ctx.rotate(hp.neck);
  part(ctx, P.h_neck);
  ctx.restore();
  horseLeg(ctx, rig, H.hind, hp.nhU, hp.nhL, false, false);
  horseLeg(ctx, rig, H.fore, hp.nfU, hp.nfL, true, false);
  // qo'mondon bayrog'i: egar orqasiga mahkamlangan, mato orqaga hilpiraydi
  if (P.banner) {
    ctx.save();
    ctx.translate(H.banner[0], H.banner[1] + 10);
    ctx.rotate(hp.banner + 0.04 * Math.sin(performance.now() / 260));
    ctx.transform(0, -1, -1, 0, 0, 0);
    part(ctx, P.banner);
    ctx.restore();
  }
  part(ctx, P.h_body);

  // chavandoz
  ctx.save();
  seat();
  ctx.rotate(r.body);
  const farHand = arm(ctx, rig, J.shoulderFar, r.shF, r.elF, true);
  if (P.shield) upright(ctx, farHand, P.shield, 0.08);
  if (P.cape && J.cape) {
    ctx.save();
    ctx.translate(J.cape[0], J.cape[1]);
    ctx.rotate(r.cape);
    part(ctx, P.cape);
    ctx.restore();
  }
  part(ctx, P.torso);
  leg(ctx, rig, J.hipBack, r.hipN, r.kneeN, r.footN, false);
  ctx.save();
  ctx.translate(J.neck[0], J.neck[1]);
  ctx.rotate(r.head);
  part(ctx, P.head);
  ctx.restore();
  const acc = hp.pitch + hp.rrot + r.body + r.sh + r.el;
  arm(ctx, rig, J.shoulder, r.sh, r.el, false, (c) => {
    if (lance) {
      c.rotate(hp.lance + r.aim - acc); // nayza dunyoga nisbatan berilgan burchakda
      part(c, P.weapon);
    } else {
      c.rotate(r.bl);
      held(c, P.weapon);
    }
  });
  ctx.restore();
  ctx.restore();
}

// Askarni skeleti bilan chizadi (odam yoki otliq). (0, 0) — oyoqlar orasi, yer sathida; jangchi o'ngga qaragan
export function drawUnitRig(ctx: Ctx, rig: Rig, u: Unit): void {
  if (rig.joints.horse) drawHorse(ctx, rig, horsePose(u, rig));
  else drawRig(ctx, rig, rigPose(u, rig), u.kind);
}

// Boshining tepasi yerdan (jon chizig'i va Amir belgisi uchun)
export function rigTop(rig: Rig): number {
  const H = rig.joints.horse;
  if (!H) return rig.h;
  return -(H.body[1] + H.seat[1]) + rig.h * 0.49;
}

// Chizish chegarasi (o'yin birligida, oyoq ostidan): yiqilgan gavda, ko'tarilgan nayza ham sig'adi
export function rigBounds(rig: Rig): { l: number; r: number; t: number; b: number } {
  const h = rig.h;
  if (rig.joints.horse) return { l: -(h * 1.5), r: h * 2.1, t: -(h * 2.9), b: 16 };
  return { l: -(h + 40), r: h + 70, t: -(h * 1.9), b: 14 };
}
