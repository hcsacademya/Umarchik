// Skelet animatsiya: jangchi bo'laklardan yig'iladi (gavda, bosh, qo'llar, oyoqlar), har kadrda suyaklar
// burchagi askar holatidan hisoblanadi va bo'laklar shu burchakda chiziladi. Tayyor kadrlar yo'q —
// harakat ekran tezligida silliq, yurish qadami bosib o'tilgan yo'lga mos (oyoq sirpanmaydi).
// Qilichlarni shu yerning o'zi chizadi.
import type { Rig, RigPart } from './assets.ts';
import { ready } from './assets.ts';
import { swingPhase } from './battle.ts';
import type { Unit } from './battle.ts';

// Burchaklar radianda (0 — rasmdagi tik turish holati, manfiy — oldinga/yuqoriga), siljish o'yin birligida
export interface Pose {
  x: number; // gavda oldinga siljishi
  y: number; // gavda pastga tushishi
  body: number; // gavda egilishi
  head: number;
  sh: number; // yaqin qo'l: yelka, tirsak, qilich
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
}

type Key = Partial<Pose>;

// Jangovar tik turish: ikki qilich oldinga, uchi biroz yuqoriga
const STANCE: Pose = {
  x: 0, y: 0, body: 0.04, head: 0,
  sh: -0.25, el: -1.0, bl: -0.9,
  shF: -0.35, elF: -1.2, blF: -0.7,
  hipN: 0.1, kneeN: 0.08, hipF: -0.12, kneeF: 0.08,
  fall: 0,
};

// Zarbalar (zarba ulushi 0..1; dushmanga 0.44 da tegadi)
const HIT_AT = 0.44;
// 1-zarba: yaqin qo'l bilan boshdan oshirib pastga chopish
const SWING_A: [number, Key][] = [
  [0.3, { sh: -3.3, el: -0.6, bl: -0.4, body: -0.12, head: -0.05, x: -1.5, hipN: 0.2, hipF: -0.25 }],
  [HIT_AT, { sh: -1.2, el: -0.25, bl: 0.2, body: 0.2, head: 0.08, x: 3.5, hipN: 0.35, kneeN: 0.25, hipF: -0.45, kneeF: 0.2 }],
  [0.62, { sh: -0.8, el: -0.35, bl: -0.1, body: 0.16, head: 0.05, x: 3, hipN: 0.3, kneeN: 0.2, hipF: -0.4, kneeF: 0.15 }],
];
// 2-zarba: uzoq qo'l bilan orqadan oldinga ko'ndalang, oldinga bir qadam tashlab
const SWING_B: [number, Key][] = [
  [0.3, { shF: 0.9, elF: 0.8, blF: 0.6, sh: -0.6, el: -1.5, body: -0.1, x: -1 }],
  [HIT_AT, { shF: -1.5, elF: -0.1, blF: 0, sh: -0.5, el: -1.4, body: 0.22, head: 0.06, x: 4, hipN: 0.4, kneeN: 0.2, hipF: -0.4, kneeF: 0.1 }],
  [0.62, { shF: -1.35, elF: -0.3, blF: -0.2, sh: -0.45, el: -1.3, body: 0.15, x: 3.5, hipN: 0.35, kneeN: 0.15, hipF: -0.35 }],
];

const STRIDE = 52; // bir to'liq qadam sikli (ikki qadam) necha birlik yo'l
const LEG_SWING = 0.42;
const KNEE_LIFT = 0.8;

const smooth = (t: number): number => t * t * (3 - 2 * t);

function mix(a: Pose, b: Key, t: number): Pose {
  const out = { ...a };
  for (const k of Object.keys(b) as (keyof Pose)[]) out[k] = a[k] + (b[k]! - a[k]) * t;
  return out;
}

// Kalit pozalar orasida silliq o'tish; zarba qismi (orqaga siltashdan tekkuncha) tezlashib boradi
function track(keys: [number, Key][], p: number): Pose {
  const pts: [number, Pose][] = [[0, STANCE], ...keys.map(([t, k]): [number, Pose] => [t, { ...STANCE, ...k }]), [1, STANCE]];
  for (let i = 1; i < pts.length; i++) {
    const [t0, a] = pts[i - 1];
    const [t1, b] = pts[i];
    if (p <= t1) {
      const t = (p - t0) / (t1 - t0);
      return mix(a, b, t1 === HIT_AT ? t * t : smooth(t));
    }
  }
  return STANCE;
}

function walkPose(u: Unit): Pose {
  const ph = (u.walkDist / STRIDE) * Math.PI * 2;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  return {
    ...STANCE,
    body: 0.09,
    head: -0.03 * s,
    sh: STANCE.sh + 0.2 * s,
    shF: STANCE.shF - 0.2 * s,
    hipN: LEG_SWING * s,
    kneeN: 0.08 + KNEE_LIFT * Math.max(0, -c) ** 1.5,
    hipF: -LEG_SWING * s,
    kneeF: 0.08 + KNEE_LIFT * Math.max(0, c) ** 1.5,
  };
}

function idlePose(u: Unit): Pose {
  const t = u.animT + u.id * 0.37;
  const b = Math.sin(t * 2.2);
  return { ...STANCE, y: 0.35 * b, body: STANCE.body + 0.012 * b, sh: STANCE.sh + 0.04 * b, shF: STANCE.shF - 0.03 * b };
}

// Yiqilish: orqaga, tobora tezlashib; yerga urilib biroz sakraydi
function deathPose(u: Unit): Pose {
  const t = u.deadT;
  const k = Math.min(1, t / 0.5);
  const bounce = t > 0.5 ? Math.exp(-(t - 0.5) * 9) * Math.sin((t - 0.5) * 22) * 0.05 : 0;
  return {
    ...STANCE,
    fall: -(Math.PI / 2) * k * k + bounce,
    sh: -2.4 * k + STANCE.sh * (1 - k),
    el: 0.3,
    shF: -2.0 * k + STANCE.shF * (1 - k),
    elF: 0.2,
    head: 0.25 * k,
    kneeN: 0.6 * Math.sin(k * Math.PI),
    kneeF: 0.5 * Math.sin(k * Math.PI),
    hipN: 0.1,
    hipF: -0.15,
  };
}

function targetPose(u: Unit): Pose {
  if (u.dead) return deathPose(u);
  let p: Pose;
  const sw = swingPhase(u);
  if (sw >= 0) p = track(u.swingAlt ? SWING_B : SWING_A, sw);
  else if (u.anim === 'walk' || u.anim === 'carry') p = walkPose(u);
  else p = idlePose(u);
  if (u.hitT > 0) {
    // zarba yedi: gavda orqaga silkinadi
    const k = Math.min(1, u.hitT / 0.22);
    p = { ...p, body: p.body - 0.2 * k, head: p.head - 0.15 * k, x: p.x - 1.5 * k };
  }
  return p;
}

// Holat almashganda (turish → yurish → zarba) pozalar sakramasin: har askarning oxirgi pozasi
// yangi holatga tez, lekin silliq yetib boradi. O'lim va zarba tig'i kechikmasligi uchun tezroq.
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
  }
  last.set(u, { p, t: now });
  return p;
}

// ---------------- Chizish ----------------

function part(ctx: CanvasRenderingContext2D, pt: RigPart | undefined): void {
  if (pt && ready(pt.img)) ctx.drawImage(pt.img, -pt.px, -pt.py, pt.w, pt.h);
}

// Egri qilich (shamshir): dasta qo'lda, tig' +y tomonga
function sabre(ctx: CanvasRenderingContext2D, dark: boolean): void {
  const L = 21;
  ctx.fillStyle = dark ? '#4a3220' : '#5d3e25';
  ctx.fillRect(-0.5, -3.2, 1, 4.2);
  ctx.fillStyle = dark ? '#a7832c' : '#d7ae45';
  ctx.beginPath();
  ctx.arc(0, -3.4, 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-2.3, 0.8, 4.6, 0.9);
  // tig': orqa tomoni tekis, o'tkir tomoni egilib uchiga ingichkalashadi
  const g = ctx.createLinearGradient(-1.2, 0, 1.2, 0);
  g.addColorStop(0, dark ? '#8b939a' : '#c9d0d6');
  g.addColorStop(0.5, dark ? '#b9c0c6' : '#f4f7f9');
  g.addColorStop(1, dark ? '#6c737a' : '#8e979f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-0.55, 1.7);
  ctx.quadraticCurveTo(-0.3, L * 0.6, 2.6, L);
  ctx.quadraticCurveTo(1.6, L * 0.55, 0.75, 1.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = dark ? 'rgba(40,40,44,0.6)' : 'rgba(60,64,70,0.55)';
  ctx.lineWidth = 0.22;
  ctx.stroke();
}

function arm(ctx: CanvasRenderingContext2D, rig: Rig, at: [number, number], sh: number, el: number, bl: number, far: boolean): void {
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
  ctx.rotate(bl);
  sabre(ctx, far);
  ctx.restore();
  part(ctx, P['fore' + d]); // qo'l dastani ushlab turadi
  ctx.restore();
}

function leg(ctx: CanvasRenderingContext2D, rig: Rig, at: [number, number], hip: number, knee: number, far: boolean): void {
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

// Koordinatalar o'yin birligida, (0, 0) — oyoqlar orasi, yer sathida; askar o'ngga qaragan
export function drawRig(ctx: CanvasRenderingContext2D, rig: Rig, p: Pose): void {
  const J = rig.joints;
  const full = rig.joints.knee[1] + rig.joints.foot;
  // oyoqlar bukilganda gavda pastga tushadi — pastroqdagi oyoq tagi yerga tegib turadi
  const drop = full - Math.max(legDepth(rig, p.hipN, p.kneeN), legDepth(rig, p.hipF, p.kneeF));
  ctx.save();
  if (p.fall) ctx.rotate(p.fall);
  ctx.translate(J.hip[0] + p.x, J.hip[1] + p.y + (p.fall ? 0 : drop));

  // uzoq qo'l — gavda orqasida
  ctx.save();
  ctx.rotate(p.body);
  arm(ctx, rig, J.shoulderFar, p.shF, p.elF, p.blF, true);
  ctx.restore();

  leg(ctx, rig, J.hipFront, p.hipF, p.kneeF, true);
  leg(ctx, rig, J.hipBack, p.hipN, p.kneeN, false);

  ctx.save();
  ctx.rotate(p.body);
  part(ctx, rig.parts.torso);
  ctx.save();
  ctx.translate(J.neck[0], J.neck[1]);
  ctx.rotate(p.head);
  part(ctx, rig.parts.head);
  ctx.restore();
  arm(ctx, rig, J.shoulder, p.sh, p.el, p.bl, false);
  ctx.restore();

  ctx.restore();
}

// Chizish chegarasi (o'yin birligida, oyoq ostidan): yiqilgan gavda va ko'tarilgan qilich ham sig'adi
export function rigBounds(rig: Rig): { l: number; r: number; t: number; b: number } {
  const h = rig.h;
  return { l: -(h + 30), r: h + 30, t: -(h + 40), b: 12 };
}
