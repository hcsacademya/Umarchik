// O'yindagi skeletni (src/skeleton.ts) Spine 4.2 formatiga o'tkazadi: suyaklar, rasm qismlari, harakatlar.
// Natija:
//   art/spine/<nom>/<nom>.json + images/*.png     — Spine dasturida ochish uchun (Import Data)
//   public/spine/<nom>/<nom>.json, .atlas, .webp   — o'yin shu fayllarni o'qiydi
//   public/spine/<nom>/meta.json                   — yurish/yugurish qadami (harakat vaqti shu yo'lga bog'lanadi)
// Harakatlar o'yindagi pozalardan sekundiga 30 marta olinadi, ortiqcha kalitlar tashlanadi.
// Ishga tushirish: node tools/export_spine.ts [nom]      (hozircha: qilichli)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Rig } from '../src/assets.ts';
import { bake, legDepth, rigPose } from '../src/skeleton.ts';
import type { Pose } from '../src/skeleton.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2] ?? 'qilichli';
const FPS = 30;
const TOL_ROT = 0.25; // daraja: bundan kam farq qiladigan kalit tashlanadi
const TOL_POS = 0.05; // birlik

// ---------- Skelet ma'lumoti ----------
interface PartMeta { f: string; w: number; h: number; px: number; py: number }
const meta = JSON.parse(readFileSync(join(ROOT, 'src/assets.json'), 'utf8'));
const rm = meta.rigs[name] as { h: number; parts: Record<string, PartMeta>; joints: Rig['joints'] };
if (!rm) throw new Error(`${name}: skelet topilmadi`);
const rig: Rig = { h: rm.h, joints: rm.joints, parts: {} };
for (const [k, p] of Object.entries(rm.parts)) rig.parts[k] = { img: {} as never, w: p.w, h: p.h, px: p.px, py: p.py };
const J = rig.joints;
if (!J.ankle) throw new Error(`${name}: oyoq kafti yo'q (eski skelet)`);

// ---------- Suyaklar ----------
// β — suyakning Spine'dagi yo'nalishi (daraja): qo'l-oyoq pastga (-90), gavda yuqoriga (90). Shunda Spine dasturida
// suyaklar a'zolar bo'ylab ko'rinadi. pos — ota suyakdagi joyi (o'yin koordinatasi, y pastga), rot — burchagi (radian)
type V = [number, number];
interface BoneDef { name: string; parent?: string; beta: number; length: number; pos: (p: Pose) => V; rot: (p: Pose) => number }
const drop = (p: Pose): number => p.ground * (J.knee[1] + J.foot - Math.max(legDepth(rig, p.hipN, p.kneeN), legDepth(rig, p.hipF, p.kneeF)));
const len = (v: V): number => Math.hypot(v[0], v[1]);
const P = rig.parts;
const BONES: BoneDef[] = [
  { name: 'root', beta: 0, length: 0, pos: () => [0, 0], rot: (p) => p.fall },
  { name: 'hip', parent: 'root', beta: 90, length: 0, pos: (p) => [J.hip[0] + p.x, J.hip[1] + p.y + (p.fall ? 0 : drop(p))], rot: () => 0 },
  { name: 'body', parent: 'hip', beta: 90, length: len(J.neck), pos: () => [0, 0], rot: (p) => p.body },
  { name: 'neck', parent: 'body', beta: 90, length: P.head.h * 0.7, pos: () => J.neck, rot: (p) => p.head },
  { name: 'shoulderF', parent: 'body', beta: -90, length: len(J.elbow), pos: () => J.shoulderFar, rot: (p) => p.shF },
  { name: 'elbowF', parent: 'shoulderF', beta: -90, length: len(J.hand), pos: () => J.elbow, rot: (p) => p.elF },
  { name: 'handF', parent: 'elbowF', beta: -90, length: 2, pos: () => J.hand, rot: () => 0 },
  // qalqon gavdaga nisbatan deyarli tik turadi (qo'l burchagini qaytaradi)
  { name: 'shield', parent: 'handF', beta: 90, length: P.shield ? P.shield.h * 0.4 : 4, pos: () => [0, 0], rot: (p) => -(p.shF + p.elF) + 0.05 },
  { name: 'shoulderN', parent: 'body', beta: -90, length: len(J.elbow), pos: () => J.shoulder, rot: (p) => p.sh },
  { name: 'elbowN', parent: 'shoulderN', beta: -90, length: len(J.hand), pos: () => J.elbow, rot: (p) => p.el },
  { name: 'handN', parent: 'elbowN', beta: -90, length: P.weapon ? P.weapon.w - P.weapon.px : 4, pos: () => J.hand, rot: (p) => p.bl },
  { name: 'thighF', parent: 'hip', beta: -90, length: len(J.knee), pos: () => J.hipFront, rot: (p) => p.hipF },
  { name: 'shinF', parent: 'thighF', beta: -90, length: len(J.ankle!), pos: () => J.knee, rot: (p) => p.kneeF },
  { name: 'footF', parent: 'shinF', beta: 0, length: P.foot.w - P.foot.px, pos: () => J.ankle!, rot: (p) => p.footF - (p.hipF + p.kneeF) },
  { name: 'thighN', parent: 'hip', beta: -90, length: len(J.knee), pos: () => J.hipBack, rot: (p) => p.hipN },
  { name: 'shinN', parent: 'thighN', beta: -90, length: len(J.ankle!), pos: () => J.knee, rot: (p) => p.kneeN },
  { name: 'footN', parent: 'shinN', beta: 0, length: P.foot.w - P.foot.px, pos: () => J.ankle!, rot: (p) => p.footN - (p.hipN + p.kneeN) },
];
const beta = (b?: string): number => (b ? BONES.find((x) => x.name === b)!.beta : 0);
// Chizish tartibi (src/skeleton.ts drawRig bilan bir xil): slot → suyak, qism, qism burchagi (qurol qo'lda 90°)
const SLOTS: [string, string, string, number][] = [
  ['upper_d', 'shoulderF', 'upper_d', 0], ['fore_d', 'elbowF', 'fore_d', 0],
  ['thigh_d', 'thighF', 'thigh_d', 0], ['shin_d', 'shinF', 'shin_d', 0], ['foot_d', 'footF', 'foot_d', 0],
  ['thigh', 'thighN', 'thigh', 0], ['shin', 'shinN', 'shin', 0], ['foot', 'footN', 'foot', 0],
  ['torso', 'body', 'torso', 0], ['head', 'neck', 'head', 0], ['shield', 'shield', 'shield', 0],
  ['upper', 'shoulderN', 'upper', 0], ['weapon', 'handN', 'weapon', Math.PI / 2], ['fore', 'elbowN', 'fore', 0],
].filter(([, , part]) => P[part as string]) as [string, string, string, number][];

// ---------- O'yin koordinatasidan Spine'ga ----------
// O'yin: y pastga, burchak soat yo'nalishida (radian). Spine: y yuqoriga, burchak teskari (daraja)
const deg = (r: number): number => (-r * 180) / Math.PI;
const rotV = (v: V, d: number): V => {
  const a = (d * Math.PI) / 180;
  return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
};
const toSpine = (v: V, parentBeta: number): V => rotV([v[0], -v[1]], -parentBeta);
const r2 = (n: number): number => Math.round(n * 100) / 100;

// ---------- Pozalar ----------
let nextId = 1;
function pose(o: Record<string, unknown>): Pose {
  // har safar yangi askar: pozalar aralashtirilmaydi, aynan o'sha lahzaning pozasi olinadi
  const u = {
    id: 5, kind: name, side: 0, rank: 'oddiy', x: 0, y: 0, facing: 1, anim: 'idle', animT: 0, walkDist: 0, load: 0,
    swingT: -1, cd: 1, swingAlt: false, swingVar: 0, hitT: 0, hitDir: 0, guard: false, aimD: 0, dead: false, deadT: 0, ...o,
  };
  void nextId++;
  return rigPose(u as never, rig);
}
const dist = (a: Pose, b: Pose): number =>
  BONES.reduce((s, bn) => s + Math.abs(bn.rot(a) - bn.rot(b)) * 10 + len([bn.pos(a)[0] - bn.pos(b)[0], bn.pos(a)[1] - bn.pos(b)[1]]), 0);
// Takrorlanish davri: f(x) yana f(0) ga qaytadigan eng kichik x
function period(f: (x: number) => Pose, from: number, to: number, step: number): number {
  const p0 = f(0);
  let best = to;
  let bestD = Infinity;
  for (let x = from; x <= to; x += step) {
    const d = dist(f(x), p0);
    if (d < bestD - 1e-9) {
      bestD = d;
      best = x;
    } else if (bestD < 0.5 && d > bestD) break; // birinchi chuqur minimum
  }
  // aniqlashtirish
  for (let s = step / 2; s > 1e-4; s /= 2) {
    for (const x of [best - s, best + s]) {
      const d = dist(f(x), p0);
      if (d < bestD) {
        bestD = d;
        best = x;
      }
    }
  }
  return best;
}

// ---------- Kalitlar ----------
function sample(f: (t: number) => Pose, dur: number): { times: number[]; poses: Pose[] } {
  const n = Math.max(1, Math.round(dur * FPS));
  const times: number[] = [];
  const poses: Pose[] = [];
  for (let i = 0; i <= n; i++) {
    times.push((dur * i) / n);
    poses.push(f((dur * i) / n));
  }
  return { times, poses };
}
// Chiziqli oraliqdan farqi kichik kalitlarni tashlaydi (birinchi va oxirgi qoladi)
function reduce(times: number[], vals: number[][], tol: number): number[] {
  const keep = [0];
  let a = 0;
  for (let i = 1; i < times.length - 1; i++) {
    // a dan i+1 gacha to'g'ri chiziq a..i oralig'idagi hamma nuqtani yetarli aniq beradimi
    const b = i + 1;
    let ok = true;
    for (let j = a + 1; j < b && ok; j++) {
      const k = (times[j] - times[a]) / (times[b] - times[a]);
      for (const v of vals) if (Math.abs(v[a] + (v[b] - v[a]) * k - v[j]) > tol) ok = false;
    }
    if (!ok) {
      keep.push(i);
      a = i;
    }
  }
  keep.push(times.length - 1);
  return keep;
}

const setup = pose({ animT: 0 });
function boneTimelines(times: number[], poses: Pose[], additive?: Pose): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const bn of BONES) {
    const ref = additive ?? setup;
    const rot = poses.map((p) => deg(bn.rot(p) - bn.rot(ref)));
    const tl: Record<string, unknown> = {};
    if (rot.some((r) => Math.abs(r) > 0.01)) {
      tl.rotate = reduce(times, [rot], TOL_ROT).map((i) => ({ ...(times[i] ? { time: r2(times[i] * 1e4) / 1e4 } : {}), value: r2(rot[i]) }));
    }
    if (bn.name === 'hip' || bn.name === 'root') {
      const d = poses.map((p) => toSpine([bn.pos(p)[0] - bn.pos(ref)[0], bn.pos(p)[1] - bn.pos(ref)[1]], beta(bn.parent)));
      const xs = d.map((v) => v[0]);
      const ys = d.map((v) => v[1]);
      if (xs.some((x) => Math.abs(x) > 0.01) || ys.some((y) => Math.abs(y) > 0.01)) {
        tl.translate = reduce(times, [xs, ys], TOL_POS).map((i) => ({ ...(times[i] ? { time: r2(times[i] * 1e4) / 1e4 } : {}), x: r2(xs[i]), y: r2(ys[i]) }));
      }
    }
    if (Object.keys(tl).length) out[bn.name] = tl;
  }
  return out;
}

// ---------- Harakatlar ----------
bake.gestures = false; // turishda tasodifiy harakatlarsiz, toza nafas
const H = rig.h;
const idleT = period((t) => pose({ animT: t }), 1, 6, 1 / 60);
const walkS = period((d) => pose({ anim: 'walk', walkDist: d }), 0.3 * H, 2 * H, 0.25);
const runS = period((d) => pose({ anim: 'run', walkDist: d }), 0.3 * H, 2.5 * H, 0.25);
const SWING = 0.45;
const animations: Record<string, unknown> = {};
const add = (key: string, f: (t: number) => Pose, dur: number): void => {
  const { times, poses } = sample(f, dur);
  animations[key] = { bones: boneTimelines(times, poses) };
};
add('idle', (t) => pose({ animT: t }), idleT);
add('guard', (t) => pose({ animT: t, guard: true }), idleT);
// yurish va yugurish: 1 soniya = bitta to'liq qadam sikli (meta.json dagi yo'l)
add('walk', (t) => pose({ anim: 'walk', walkDist: t * walkS }), 1);
add('run', (t) => pose({ anim: 'run', walkDist: t * runS }), 1);
for (let v = 0; v < 3; v++) add(`attack${v + 1}`, (t) => pose({ anim: 'attack', swingVar: v, swingT: t }), SWING);
// zarba yeyish: ustiga qo'shiladigan (additive) farq, kuchi o'yinda 0..1
for (const [key, dir] of [['hit_front', -1], ['hit_back', 1]] as [string, number][]) {
  const base = pose({ animT: 0 });
  const hit = pose({ animT: 0, hitT: 0.22, hitDir: dir });
  animations[key] = { bones: boneTimelines([0], [hit], base) };
}
// o'lim: orqaga/oldinga, ba'zilari avval tiz cho'kadi (id ning 2-biti)
for (const [key, dir, id] of [['death_back', -1, 1], ['death_front', 1, 1], ['death_back_kneel', -1, 2], ['death_front_kneel', 1, 2]] as [string, number, number][]) {
  add(key, (t) => pose({ dead: true, deadT: t, hitDir: dir, id }), 1.4);
}

// ---------- Spine JSON ----------
const imgSize: Record<string, [number, number]> = JSON.parse(
  execFileSync('python3', ['-c', `
import json,sys
from PIL import Image
print(json.dumps({k: Image.open(v).size for k, v in json.loads(sys.argv[1]).items()}))`,
  JSON.stringify(Object.fromEntries(SLOTS.map(([, , part]) => [part, join(ROOT, 'public', rm.parts[part].f)])))]).toString(),
);
const bones = BONES.map((bn) => {
  const pb = beta(bn.parent);
  const [x, y] = toSpine(bn.pos(setup), pb);
  const rotation = deg(bn.rot(setup)) + bn.beta - pb;
  return { name: bn.name, ...(bn.parent ? { parent: bn.parent } : {}), ...(bn.length ? { length: r2(bn.length) } : {}), x: r2(x), y: r2(y), rotation: r2(rotation) };
});
const attachments: Record<string, unknown> = {};
for (const [slot, bone, part, ang] of SLOTS) {
  const pt = P[part];
  const b = beta(bone);
  // qism markazi suyakda (o'yin koordinatasi), qurol bo'lsa 90° burilgan
  let c: V = [pt.w / 2 - pt.px, pt.h / 2 - pt.py];
  if (ang) c = [c[0] * Math.cos(ang) - c[1] * Math.sin(ang), c[0] * Math.sin(ang) + c[1] * Math.cos(ang)];
  const [x, y] = toSpine(c, b);
  const [iw, ih] = imgSize[part];
  attachments[slot] = {
    [part]: { x: r2(x), y: r2(y), rotation: r2(deg(ang) - b), scaleX: +(pt.w / iw).toFixed(5), scaleY: +(pt.h / ih).toFixed(5), width: iw, height: ih },
  };
}
const json = {
  skeleton: { hash: `umar-${name}`, spine: '4.2.43', x: -H * 0.6, y: -2, width: H * 1.6, height: H * 1.25, images: './images/', audio: '' },
  bones,
  slots: SLOTS.map(([slot, bone, part]) => ({ name: slot, bone, attachment: part })),
  skins: [{ name: 'default', attachments }],
  animations,
};
const text = JSON.stringify(json);
const artDir = join(ROOT, 'art/spine', name);
const pubDir = join(ROOT, 'public/spine', name);
mkdirSync(artDir, { recursive: true });
mkdirSync(pubDir, { recursive: true });
writeFileSync(join(artDir, `${name}.json`), text);
writeFileSync(join(pubDir, `${name}.json`), text);
writeFileSync(join(pubDir, 'meta.json'), JSON.stringify({ walkStride: r2(walkS), runStride: r2(runS), attackTime: SWING }));
// rasmlar: Spine dasturi uchun PNG, o'yin uchun bitta atlas
execFileSync('python3', [join(ROOT, 'tools/spine_atlas.py'), name, JSON.stringify(Object.fromEntries(SLOTS.map(([, , part]) => [part, join(ROOT, 'public', rm.parts[part].f)])))], { stdio: 'inherit' });
const keys = Object.values(animations).reduce((s: number, a) => s + JSON.stringify(a).split('"value"').length + JSON.stringify(a).split('"x"').length - 2, 0);
console.log(`${name}: ${bones.length} suyak, ${SLOTS.length} qism, ${Object.keys(animations).length} harakat (~${keys} kalit), ` +
  `nafas ${idleT.toFixed(2)} s, qadam ${walkS.toFixed(1)} / ${runS.toFixed(1)} birlik, ${(text.length / 1024).toFixed(0)} KB`);
