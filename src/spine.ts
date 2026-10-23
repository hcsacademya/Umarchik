// Spine skeletlari: harakatlar Spine dasturida tayyorlanadi, o'yin ularni shu yerda ijro etadi.
// Fayllar: public/spine/<tur>/<tur>.json, .atlas, .webp va meta.json (tools/export_spine.ts yasaydi).
// Hozircha bizning oddiy qilichli; qolganlar src/skeleton.ts bilan chiziladi. Fayl yuklanmasa ham o'shanga qaytadi.
import {
  AssetManager, AtlasAttachmentLoader, MixBlend, MixDirection, Physics, Skeleton, SkeletonJson, SkeletonRenderer,
} from '@esotericsoftware/spine-canvas';
import type { Animation, SkeletonData, TextureAtlas } from '@esotericsoftware/spine-canvas';
import { swingPhase } from './battle.ts';
import type { Unit } from './battle.ts';
import { RANK } from './config.ts';
import type { Kind } from './config.ts';

// Spine bilan chiziladigan turlar (faqat bizning tomon, oddiy askar)
export const SPINE_UNITS: Kind[] = ['qilichli'];

interface Meta {
  walkStride: number; // walk harakatining 1 sikli necha birlik yo'l
  runStride: number;
  attackTime: number;
}

interface Loaded {
  data: SkeletonData;
  meta: Meta;
  anim: (name: string) => Animation | null;
}

const loaded = new Map<Kind, Loaded>();
const assets = new AssetManager('spine/');

async function load(kind: Kind): Promise<void> {
  try {
    const base = `${kind}/${kind}`;
    assets.loadJson(`${base}.json`);
    assets.loadTextureAtlas(`${base}.atlas`);
    const meta = (await (await fetch(`spine/${kind}/meta.json`)).json()) as Meta;
    await assets.loadAll();
    const atlas = assets.require(`${base}.atlas`) as TextureAtlas;
    const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(assets.require(`${base}.json`));
    loaded.set(kind, { data, meta, anim: (n) => data.findAnimation(n) });
  } catch (e) {
    console.warn(`Spine: ${kind} yuklanmadi, skelet bilan chiziladi`, e);
  }
}
for (const k of SPINE_UNITS) void load(k);

// Holat almashganda (turish → yurish → zarba ...) oldingi pozadan shuncha soniyada o'tadi (skeleton.ts dagidek)
const BLEND = 0.15;

interface State {
  skel: Skeleton;
  mode: string;
  cur: Animation | null;
  curT: number;
  curLoop: boolean;
  from: Animation | null;
  fromT: number;
  fromLoop: boolean;
  t0: number;
}
const states = new WeakMap<Unit, State>();
// har bir kanvas (asosiy va shaffof askar uchun yordamchi) o'z chizuvchisi bilan
const renderers = new WeakMap<CanvasRenderingContext2D, SkeletonRenderer>();

const smooth = (t: number): number => t * t * (3 - 2 * t);

// Askar holatidan harakat va uning vaqti: yurish/yugurish — bosib o'tilgan yo'ldan (oyoq sirpanmaydi),
// zarba — zarba ulushidan (tegish lahzasi jang hisobi bilan bir xil), o'lim — o'lganidan beri vaqtdan
function pick(u: Unit, L: Loaded): { a: Animation | null; t: number; loop: boolean; mode: string } {
  if (u.dead) {
    const back = u.hitDir === 0 || u.hitDir !== u.facing;
    const kneel = (u.id & 2) !== 0;
    const a = L.anim(`death_${back ? 'back' : 'front'}${kneel ? '_kneel' : ''}`);
    return { a, t: a ? Math.min(u.deadT, a.duration) : 0, loop: false, mode: 'dead' };
  }
  const sw = swingPhase(u);
  if (sw >= 0) {
    const a = L.anim(`attack${(u.swingVar % 3) + 1}`);
    return { a, t: a ? sw * a.duration : 0, loop: false, mode: 'attack' };
  }
  const dist = u.walkDist / RANK[u.rank].scale;
  if (u.anim === 'run') {
    const a = L.anim('run');
    return { a, t: a ? (dist / L.meta.runStride) * a.duration : 0, loop: true, mode: 'run' };
  }
  if (u.anim === 'walk' || u.anim === 'carry') {
    const a = L.anim('walk');
    return { a, t: a ? (dist / L.meta.walkStride) * a.duration : 0, loop: true, mode: 'walk' };
  }
  const a = L.anim(u.guard ? 'guard' : 'idle') ?? L.anim('idle');
  return { a, t: u.animT + u.id * 0.37, loop: true, mode: u.guard ? 'guard' : 'idle' };
}

// Askarni Spine bilan chizadi: (0, 0) — oyoqlar orasi, yer sathida, o'ngga qaragan (chaqiruvchi o'giradi va kattalashtiradi).
// Shu tur uchun Spine yo'q yoki hali yuklanmagan bo'lsa false — unda eski skelet bilan chiziladi
export function drawSpine(ctx: CanvasRenderingContext2D, u: Unit): boolean {
  if (u.side !== 0 || u.rank !== 'oddiy') return false;
  const L = loaded.get(u.kind);
  if (!L) return false;
  const now = performance.now() / 1000;
  const { a, t, loop, mode } = pick(u, L);
  let st = states.get(u);
  if (!st) {
    st = { skel: new Skeleton(L.data), mode, cur: a, curT: t, curLoop: loop, from: null, fromT: 0, fromLoop: false, t0: now - BLEND };
    states.set(u, st);
  }
  if (st.mode !== mode) {
    st.from = st.cur;
    st.fromT = st.curT;
    st.fromLoop = st.curLoop;
    st.mode = mode;
    st.t0 = now;
  }
  st.cur = a;
  st.curT = t;
  st.curLoop = loop;
  const sk = st.skel;
  sk.setToSetupPose();
  const k = (now - st.t0) / BLEND;
  if (k < 1 && st.from) {
    st.from.apply(sk, st.fromT, st.fromT, st.fromLoop, [], 1, MixBlend.setup, MixDirection.mixIn);
    a?.apply(sk, t, t, loop, [], smooth(Math.max(0, k)), MixBlend.replace, MixDirection.mixIn);
  } else a?.apply(sk, t, t, loop, [], 1, MixBlend.setup, MixDirection.mixIn);
  // zarba yeyish: ustiga qo'shiladi, 0.22 soniyada so'nadi
  if (u.hitT > 0 && !u.dead) {
    const hit = L.anim(u.hitDir !== 0 && u.hitDir === u.facing ? 'hit_back' : 'hit_front');
    hit?.apply(sk, 0, 0, false, [], Math.min(1, u.hitT / 0.22), MixBlend.add, MixDirection.mixIn);
  }
  sk.updateWorldTransform(Physics.update);
  // Spine'da y yuqoriga: chizishda aylantiramiz
  ctx.save();
  ctx.scale(1, -1);
  let r = renderers.get(ctx);
  if (!r) renderers.set(ctx, (r = new SkeletonRenderer(ctx)));
  r.draw(sk);
  ctx.restore();
  return true;
}
