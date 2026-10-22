// Skelet animatsiya: jangchi bo'laklardan yig'iladi (gavda, bosh, qo'llar, oyoqlar, qurol), har kadrda suyaklar
// burchagi askar holatidan hisoblanadi va bo'laklar shu burchakda chiziladi. Tayyor kadrlar yo'q —
// harakat ekran tezligida silliq, yurish va yugurish qadami bosib o'tilgan yo'lga mos (oyoq sirpanmaydi).
// Takrorlanmasligi uchun: har askarning o'z odati (qadam, qo'l silkinishi, egilish), zarbaning 3 xil turi
// tasodifiy, turganda vaqti-vaqti bilan tasodifiy harakatlar (qarash, oyoq almashtirish, qurolni to'g'rilash).
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
  aim: number; // kamonchi: uzoq nishonga o'q yuqoriroq (radian)
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
  fall: 0, cape: 0.06, aux: 0, aim: 0,
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

const STRIDE = 52; // yurishda bir to'liq qadam sikli (ikki qadam) necha birlik yo'l
const RUN_STRIDE = 50; // yugurishda
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
  const stride = STRIDE * (0.9 + 0.2 * rnd(u, 1)); // har kimning qadami boshqacha
  const ph = (u.walkDist / stride) * Math.PI * 2;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const hold = u.kind === 'nayzachi' || u.kind === 'konchi' ? 0.08 : 0.2; // tutib turgan qo'l kam silkinadi
  const aa = 0.75 + 0.5 * rnd(u, 2);
  const ls = 0.9 + 0.2 * rnd(u, 4);
  return {
    ...base,
    body: base.body + 0.05 + (rnd(u, 3) - 0.5) * 0.08,
    head: -0.03 * s * aa,
    sh: base.sh + hold * s * aa,
    shF: base.shF - 0.12 * s * aa,
    hipN: LEG_SWING * s * ls,
    kneeN: 0.08 + KNEE_LIFT * Math.max(0, -c) ** 1.5,
    hipF: -LEG_SWING * s * ls,
    kneeF: 0.08 + KNEE_LIFT * Math.max(0, c) ** 1.5,
    cape: base.cape + 0.16 + 0.07 * s,
  };
}

// Yugurish: gavda oldinga egiladi, qadam keng, tizzalar baland, qo'llar kuchli silkinadi, qurol oldinga tayyor
function runPose(u: Unit, base: Pose): Pose {
  const stride = RUN_STRIDE * (0.92 + 0.16 * rnd(u, 1));
  const ph = (u.walkDist / stride) * Math.PI * 2;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const aa = 0.8 + 0.4 * rnd(u, 2);
  const lean = 0.2 + (rnd(u, 3) - 0.5) * 0.08;
  const p: Pose = {
    ...base,
    y: -1.1 * Math.abs(s) * aa, // yugurishda har qadamda biroz ko'tarilib tushadi
    x: 1.5,
    body: lean,
    head: -0.06 - 0.03 * s,
    hipN: 0.7 * s,
    kneeN: 0.25 + 1.2 * Math.max(0, -c) ** 1.3,
    hipF: -0.7 * s,
    kneeF: 0.25 + 1.2 * Math.max(0, c) ** 1.3,
    cape: base.cape + 0.5 + 0.1 * s,
  };
  switch (u.kind) {
    case 'amir':
      p.sh = -0.5 + 0.55 * s * aa; p.el = -1.2; p.bl = -0.4;
      p.shF = -0.5 - 0.55 * s * aa; p.elF = -1.2; p.blF = -0.4;
      break;
    case 'qilichli':
      p.sh = -0.5 + 0.6 * s * aa; p.el = -1.1; p.bl = -0.2;
      p.shF = -0.7; p.elF = -1.3;
      break;
    case 'nayzachi':
      // nayza oldinga, ko'tarilgan holda; qalqon ko'krakda
      p.sh = -0.35 + 0.15 * s * aa; p.el = -0.9; p.bl = -1.0;
      p.shF = -0.7; p.elF = -1.3;
      break;
    case 'kamonchi':
      p.sh = -0.2 + 0.6 * s * aa; p.el = -1.0;
      p.shF = -0.4 - 0.5 * s * aa; p.elF = -0.9;
      break;
    case 'konchi':
      p.sh = -0.5 + 0.1 * s; p.el = -1.9; p.shF = 0.1 - 0.7 * s * aa; p.elF = -0.6;
      break;
    default:
  }
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
    return { ...common, y: 7 * kn, kneeN: 1.5 * kn, kneeF: 1.4 * kn, hipN: -0.3 * kn, hipF: -0.9 * kn, body: base.body + 0.1 * kn, sh: base.sh * (1 - kn), shF: base.shF * (1 - kn) };
  }
  const arms = back ? { sh: -2.4, shF: -2.0, el: 0.3, elF: 0.2 } : { sh: -1.2, shF: -1.0, el: -0.4, elF: -0.3 };
  return {
    ...common,
    y: kneel ? 7 * (1 - k) : 0,
    sh: arms.sh * k + base.sh * (1 - k),
    el: arms.el,
    shF: arms.shF * k + base.shF * (1 - k),
    elF: arms.elF,
    kneeN: (kneel ? 1.5 * (1 - k) : 0) + 0.6 * Math.sin(k * Math.PI),
    kneeF: (kneel ? 1.4 * (1 - k) : 0) + 0.5 * Math.sin(k * Math.PI),
    hipN: 0.1,
    hipF: -0.15,
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
  const keys = mv.tracks ? mv.tracks[Math.min(mv.tracks.length - 1, u.swingVar)] : undefined;
  if (sw >= 0 && keys) {
    p = track(base, keys, sw, mv.hit);
    if (u.kind === 'kamonchi') p.aim = 0.38 * Math.max(0, Math.min(1, (u.aimD - 90) / 150)); // uzoqroq nishonga yuqoriroq
  } else if (u.anim === 'run') p = runPose(u, base);
  else if (u.anim === 'walk' || u.anim === 'carry') p = walkPose(u, base);
  else p = idlePose(u, base);
  // jang holati: dushman yaqin bo'lsa tayyor tur (zarba va yugurish orasida)
  if (u.guard && sw < 0 && u.anim !== 'run') {
    const g = GUARD[u.kind];
    p = mix(p, u.anim === 'walk' ? { ...g, hipN: p.hipN, hipF: p.hipF, kneeN: p.kneeN, kneeF: p.kneeF } : g, 0.85);
  }
  if (u.hitT > 0) {
    // zarba yedi: gavda zarba tomoniga silkinadi (old tomondan bo'lsa orqaga)
    const k = Math.min(1, u.hitT / 0.22);
    const dir = u.hitDir !== 0 && u.hitDir === u.facing ? 1 : -1;
    p = { ...p, body: p.body + dir * 0.22 * k, head: p.head + dir * 0.16 * k, x: p.x + dir * 1.6 * k, kneeN: p.kneeN + 0.25 * k, y: p.y + 0.8 * k };
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

// Chizish chegarasi (o'yin birligida, oyoq ostidan): yiqilgan gavda, ko'tarilgan nayza ham sig'adi
export function rigBounds(rig: Rig): { l: number; r: number; t: number; b: number } {
  const h = rig.h;
  return { l: -(h + 40), r: h + 70, t: -(h * 1.9), b: 14 };
}
