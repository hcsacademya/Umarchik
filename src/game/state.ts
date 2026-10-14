import {
  ALL_UNITS,
  CORE_LEVELS,
  FACTION_COLORS,
  GAME,
  NAMES,
  START,
  ZONE_INFO,
  impassable,
  workersCapacity,
} from '../config';
import type {
  Army,
  Faction,
  FactionKind,
  GameState,
  Province,
  Specialty,
  Terrain,
  Tile,
  UnitType,
  WorkerType,
} from '../types';
import { armyCount, makeRng, shuffle } from '../util';
import { MAP, generateMap, neighbors4, tileAt } from '../world/mapgen';

export const SAVE_VERSION = 2;

const START_TERRAIN: Terrain[] = ['tekislik', 'unumdor', 'vodiy', 'yaylov', 'chol'];

function emptyLevels(lvl = 1): Record<UnitType, number> {
  const o = {} as Record<UnitType, number>;
  for (const k of ALL_UNITS) o[k] = lvl;
  return o;
}

export function makeFaction(id: number, kind: FactionKind, name: string, color: string): Faction {
  return {
    id,
    kind,
    name,
    color,
    res: { kumush: 0, bronza: 0, don: 0, qoy: 0 },
    coreX: -1,
    coreY: -1,
    alive: true,
    coreLevel: 1,
    barracksLevel: 1,
    omborLevel: 1,
    spyLevel: 0,
    workers: { dehqon: 0, chopon: 0, konchi: 0 },
    unitLevels: emptyLevels(),
    workerLevels: { dehqon: 1, chopon: 1, konchi: 1 },
    specialty: null,
    anger: 0,
    wins: 0,
    losses: 0,
    protectedUntil: 0,
    starving: 0,
    unlocks: { qomondon: false, sarkarda: false },
    amirWoundedUntil: 0,
    strength: 1,
    nextActionDay: 0,
    style: null,
  };
}

/** Viloyatdan qarorgoh uchun joy topadi: yonida kon, ekin yeri va yaylov bo'lgani afzal. */
function findStartTile(s: GameState, provinceId: number, rnd: () => number, minCoreDist = 6): Tile | null {
  const cores = s.factions.filter((f) => f.coreX >= 0).map((f) => ({ x: f.coreX, y: f.coreY }));
  let best: Tile | null = null;
  let bestScore = -Infinity;
  for (const t of s.tiles) {
    if (t.province !== provinceId || t.owner !== -1 || t.painted) continue;
    if (!START_TERRAIN.includes(t.terrain)) continue;
    let minCore = Infinity;
    for (const c of cores) minCore = Math.min(minCore, Math.abs(c.x - t.x) + Math.abs(c.y - t.y));
    if (minCore < minCoreDist) continue;
    let inner = 0;
    let mine = false;
    let farm = false;
    let pasture = false;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > 3) continue;
        const n = tileAt(s.tiles, t.x + dx, t.y + dy);
        if (!n || n.province !== provinceId || n.owner !== -1 || impassable(n)) continue;
        if (d <= 2) inner++;
        if (n.terrain === 'tog' || n.terrain === 'qorli_tog' || n.deposit) mine = true;
        if (d <= 1 && (n.terrain === 'unumdor' || n.terrain === 'tekislik' || n.terrain === 'vodiy')) farm = true;
        if (d <= 2 && (n.terrain === 'yaylov' || n.terrain === 'tekislik' || n.terrain === 'vodiy')) pasture = true;
      }
    if (inner < 9) continue;
    const score = (mine ? 2 : 0) + (farm ? 1.5 : 0) + (pasture ? 1 : 0) + inner * 0.06 + rnd() * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** Har boshlang'ich zonada kichik kon bo'lsin: yaqinda tog' bo'lmasa, 2 qadam narida kon joyi ochiladi. */
function ensureMineNear(s: GameState, core: Tile, rnd: () => number): void {
  const near: Tile[] = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d === 0 || d > 2) continue;
      const n = tileAt(s.tiles, core.x + dx, core.y + dy);
      if (n && n.province === core.province && n.owner === -1 && !impassable(n) && n.terrain !== 'daryo') near.push(n);
    }
  if (near.some((t) => t.terrain === 'tog' || t.terrain === 'qorli_tog' || t.deposit)) return;
  const far = near.filter((t) => Math.abs(t.x - core.x) + Math.abs(t.y - core.y) === 2);
  const pool = far.length ? far : near;
  if (pool.length) pool[Math.floor(rnd() * pool.length)].deposit = true;
}

function bestBuildingFor(t: Tile, spec: Specialty | null, rnd: () => number): Tile['building'] {
  if ((t.terrain === 'tog' || t.terrain === 'qorli_tog') && (t.deposit || rnd() < 0.5)) return 'mine';
  if (t.terrain === 'tog' || t.terrain === 'qorli_tog') return 'tower';
  if (t.terrain === 'orman' || t.terrain === 'daryo') return 'none';
  if (t.terrain === 'yaylov') return 'pasture';
  if (t.terrain === 'unumdor') return 'farm';
  if (spec === 'chorva') return rnd() < 0.6 ? 'pasture' : 'farm';
  if (spec === 'dehqon') return rnd() < 0.75 ? 'farm' : 'pasture';
  return rnd() < 0.5 ? 'farm' : 'pasture';
}

/** AI garnizon tarkibi: uslub va ixtisosga qarab. */
export function makeGarrison(f: Faction, size: number, rnd: () => number): Army {
  const n = Math.max(1, Math.round(size));
  let mix: [UnitType, number][];
  if (f.style === 'rim') mix = [['piyoda', 0.55], ['nayzachi', 0.2], ['kamonchi', 0.2], ['otliq', 0.05]];
  else if (f.style === 'fors') mix = [['zirhli_otliq', 0.25], ['otliq', 0.2], ['kamonchi', 0.3], ['nayzachi', 0.1], ['piyoda', 0.15]];
  else if (f.specialty === 'chorva') mix = [['otliq', 0.3], ['kamonchi', 0.3], ['piyoda', 0.25], ['nayzachi', 0.15]];
  else if (f.specialty === 'kon') mix = [['piyoda', 0.4], ['nayzachi', 0.3], ['kamonchi', 0.25], ['otliq', 0.05]];
  else mix = [['piyoda', 0.45], ['kamonchi', 0.3], ['nayzachi', 0.15], ['otliq', 0.1]];
  const a: Army = {};
  let left = n;
  for (let i = 0; i < mix.length; i++) {
    const [k, w] = mix[i];
    const c = i === mix.length - 1 ? left : Math.min(left, Math.round(n * w + (rnd() - 0.5)));
    if (c > 0) a[k] = (a[k] ?? 0) + c;
    left -= c;
  }
  if (left > 0) a.piyoda = (a.piyoda ?? 0) + left;
  return a;
}

export function garrisonTarget(s: GameState, f: Faction, t: Tile): number {
  const zone = s.provinces[t.province].zone;
  let base = ZONE_INFO[zone].garrison * f.strength;
  if (t.building === 'core') base *= f.kind === 'empire' ? 3 : 2.4;
  else if (t.building === 'fort') base *= 1.7;
  else if (t.building === 'city') base *= 2;
  else if (t.building === 'none') base *= 0.6;
  // Imperiya chegara viloyatlari kuchliroq.
  if (f.kind === 'empire' && neighbors4(s.tiles, t).some((n) => n.province !== t.province)) base *= 1.4;
  return Math.max(1, Math.round(base));
}

function setupAiState(s: GameState, f: Faction, core: Tile, rnd: () => number, startSize: number, painted: boolean): void {
  f.coreX = core.x;
  f.coreY = core.y;
  const around: Tile[] = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const n = tileAt(s.tiles, core.x + dx, core.y + dy);
      if (!n || n.owner !== -1 || n.province !== core.province || impassable(n)) continue;
      around.push(n);
    }
  // Ixtisos: atrofdagi yerga qarab.
  let mt = 0;
  let fa = 0;
  let pa = 0;
  for (const t of around) {
    if (t.terrain === 'tog' || t.terrain === 'qorli_tog') mt++;
    else if (t.terrain === 'unumdor' || t.terrain === 'vodiy') fa++;
    else if (t.terrain === 'yaylov' || t.terrain === 'chol') pa++;
  }
  f.specialty = mt >= fa && mt >= pa && mt > 0 ? 'kon' : pa > fa ? 'chorva' : 'dehqon';
  core.owner = f.id;
  core.building = 'core';
  core.painted = painted;
  core.level = s.provinces[core.province].zone === 'orta' ? 2 : 1;
  f.coreLevel = core.level;
  around.sort((a, b) => Math.abs(a.x - core.x) + Math.abs(a.y - core.y) - (Math.abs(b.x - core.x) + Math.abs(b.y - core.y)));
  const take = around.filter((t) => t !== core).slice(0, startSize);
  for (const t of take) {
    t.owner = f.id;
    t.building = bestBuildingFor(t, f.specialty, rnd);
    t.level = t.building === 'none' ? 0 : 1;
    t.crop = t.terrain === 'chol' ? 'arpa' : 'bugdoy';
    t.workers = t.building === 'farm' || t.building === 'pasture' || t.building === 'mine' ? 2 + Math.floor(rnd() * 2) : 0;
    t.painted = painted;
  }
  // Bitta qal'a chegarada.
  const edge = take.filter((t) => t.building === 'none' || t.building === 'tower');
  if (edge.length > 0) {
    edge[0].building = 'fort';
    edge[0].level = 1;
  }
  const zone = s.provinces[core.province].zone;
  const lvl = zone === 'orta' ? 3 : 1;
  for (const k of ALL_UNITS) f.unitLevels[k] = lvl + (rnd() < 0.5 ? 1 : 0);
  for (const t of s.tiles) if (t.owner === f.id) t.garrison = makeGarrison(f, garrisonTarget(s, f, t), rnd);
  f.res = { kumush: 300, bronza: 300, don: 200, qoy: 20 };
}

function setupEmpire(s: GameState, f: Faction, provId: number, rnd: () => number): void {
  const own = s.tiles.filter((t) => t.province === provId && !impassable(t));
  for (const t of own) t.owner = f.id;
  const castle = MAP.castles.find((c) => c.province === provId)!;
  const capital = tileAt(s.tiles, castle.x, castle.y)!;
  capital.building = 'core';
  capital.level = 4;
  capital.painted = true;
  f.coreX = capital.x;
  f.coreY = capital.y;
  f.coreLevel = 4;
  // Rasmdagi poytaxt shahri.
  for (const [x, y] of MAP.cities) {
    const t = tileAt(s.tiles, x, y)!;
    if (t.owner !== f.id || t === capital) continue;
    t.building = 'city';
    t.level = 3;
    t.painted = true;
  }
  for (const t of own) {
    if (t.building !== 'none') continue;
    const frontier = neighbors4(s.tiles, t).some((n) => n.province !== provId && !impassable(n));
    if (frontier && rnd() < 0.1 && t.terrain !== 'daryo') {
      t.building = 'fort';
      t.level = 2 + Math.floor(rnd() * 2);
    } else if (t.terrain !== 'daryo') {
      t.building = bestBuildingFor(t, f.style === 'fors' ? 'chorva' : 'dehqon', rnd);
      t.level = t.building === 'none' ? 0 : 2;
      t.workers = t.building === 'farm' || t.building === 'pasture' || t.building === 'mine' ? 3 : 0;
      t.painted = true;
    }
  }
  for (const k of ALL_UNITS) f.unitLevels[k] = 5;
  if (f.style === 'rim') {
    f.unitLevels.piyoda = 8;
    f.unitLevels.nayzachi = 6;
  } else {
    f.unitLevels.zirhli_otliq = 7;
    f.unitLevels.otliq = 7;
  }
  for (const t of own) t.garrison = makeGarrison(f, garrisonTarget(s, f, t), rnd);
  f.res = { kumush: 5000, bronza: 5000, don: 3000, qoy: 300 };
}

export function newGame(seed: number, startProvince: number): GameState {
  const rnd = makeRng(seed);
  const { tiles, provinces } = generateMap(seed);
  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    day: 0,
    tiles,
    provinces,
    factions: [],
    armies: [],
    nextArmyId: 1,
    market: {
      saturation: { don: 0, qoy: 0, kumush: 0 },
      drift: { don: 1, qoy: 1, kumush: 1 },
    },
    log: [],
    speed: 1,
    playerId: 0,
    ownerVersion: 1,
    pending: [],
    aiSpawnCounter: 0,
  };

  const player = makeFaction(0, 'player', 'Siz', FACTION_COLORS.player);
  player.res = { ...START.res };
  player.workers = { ...START.workers };
  player.protectedUntil = GAME.protectionDays;
  s.factions.push(player);

  const empA = makeFaction(1, 'empire', NAMES.empireA, FACTION_COLORS.empireA);
  empA.style = 'rim';
  empA.strength = 2.2;
  const empB = makeFaction(2, 'empire', NAMES.empireB, FACTION_COLORS.empireB);
  empB.style = 'fors';
  empB.strength = 2.2;
  s.factions.push(empA, empB);
  setupEmpire(s, empA, 0, rnd);
  setupEmpire(s, empB, 1, rnd);

  // AI davlatchalar rasmdagi qal'alarda (avval ular, keyin o'yinchi joy tanlaydi).
  let nameIdx = 0;
  for (const c of MAP.castles.filter((c) => c.kind === 'ai')) {
    if (s.factions.length - 3 >= GAME.maxAiStates) break;
    const id = s.factions.length;
    const f = makeFaction(id, 'ai', NAMES.aiStates[nameIdx % NAMES.aiStates.length], FACTION_COLORS.ai[nameIdx % FACTION_COLORS.ai.length]);
    nameIdx++;
    s.factions.push(f);
    setupAiState(s, f, tileAt(s.tiles, c.x, c.y)!, rnd, provinces[c.province].zone === 'orta' ? 8 : 6, true);
  }
  s.aiSpawnCounter = nameIdx;

  // O'yinchi qarorgohi (o'z viloyatidagi qal'adan uzoqroqda).
  const core = findStartTile(s, startProvince, rnd, 6) ?? findStartTile(s, startProvince, rnd, 3)!;
  ensureMineNear(s, core, rnd);
  core.owner = 0;
  core.building = 'core';
  core.level = 1;
  core.garrison = { ...START.army };
  player.coreX = core.x;
  player.coreY = core.y;

  // Yaqin zaif, uzoq kuchli — kuch o'yinchi joyiga qarab belgilanadi.
  for (const f of s.factions) {
    if (f.kind !== 'ai') continue;
    f.strength = aiStrengthFor(s, coreTile(s, f));
    for (const t of s.tiles) if (t.owner === f.id) t.garrison = makeGarrison(f, garrisonTarget(s, f, t), rnd);
  }

  addLog(s, 'Qarorgohingiz qurildi. Yoniga yer sotib olib, ekinzor, yaylov va kon quring.', 'info');
  addLog(s, `Dastlabki ${GAME.protectionDays} kun hech kim sizga hujum qilmaydi.`, 'good');
  return s;
}

/** Yaqin zaif, uzoq kuchli. */
export function aiStrengthFor(s: GameState, t: Tile): number {
  const p = s.factions[0];
  const d = Math.abs(p.coreX - t.x) + Math.abs(p.coreY - t.y);
  const maxD = GAME.mapW + GAME.mapH;
  const zone = s.provinces[t.province].zone;
  return 0.6 + (d / maxD) * 1.6 + (zone === 'orta' ? 0.3 : 0);
}

export function spawnAiState(s: GameState, rnd: () => number): Faction | null {
  const alive = s.factions.filter((f) => f.kind === 'ai' && f.alive).length;
  if (alive >= GAME.maxAiStates) return null;
  const provs = shuffle(
    s.provinces.filter((p) => p.zone !== 'markaz').map((p) => p.id),
    rnd,
  );
  for (const pid of provs) {
    const t = findStartTile(s, pid, rnd, 7);
    if (!t) continue;
    const idx = s.aiSpawnCounter++;
    const id = s.factions.length;
    const f = makeFaction(
      id,
      'ai',
      NAMES.aiStates[idx % NAMES.aiStates.length] + (idx >= NAMES.aiStates.length ? ` ${Math.floor(idx / NAMES.aiStates.length) + 1}` : ''),
      FACTION_COLORS.ai[idx % FACTION_COLORS.ai.length],
    );
    f.strength = aiStrengthFor(s, t);
    s.factions.push(f);
    setupAiState(s, f, t, rnd, 4, false);
    s.ownerVersion++;
    return f;
  }
  return null;
}

export function addLog(s: GameState, text: string, kind: 'info' | 'good' | 'bad' | 'war' = 'info'): void {
  s.log.push({ day: s.day, text, kind });
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
  logListeners.forEach((l) => l(text, kind));
}

const logListeners: ((text: string, kind: string) => void)[] = [];
export function onLog(fn: (text: string, kind: string) => void): void {
  logListeners.push(fn);
}

// ---------- So'rov yordamchilari ----------

export function coreTile(s: GameState, f: Faction): Tile {
  return tileAt(s.tiles, f.coreX, f.coreY)!;
}

export function ownedTiles(s: GameState, fid: number): Tile[] {
  return s.tiles.filter((t) => t.owner === fid);
}

export function soldierCount(s: GameState, fid: number): number {
  let n = 0;
  for (const t of s.tiles) if (t.owner === fid) n += armyCount(t.garrison, false);
  for (const a of s.armies) if (a.owner === fid) n += armyCount(a.units, false);
  for (const t of s.tiles) if (t.capture && t.capture.by === fid) n += armyCount(t.capture.army, false);
  return n;
}

export function totalArmy(s: GameState, fid: number): Army {
  const out: Army = {};
  const add = (a: Army) => {
    for (const k of ALL_UNITS) if (a[k]) out[k] = (out[k] ?? 0) + (a[k] as number);
  };
  for (const t of s.tiles) if (t.owner === fid) add(t.garrison);
  for (const a of s.armies) if (a.owner === fid) add(a.units);
  for (const t of s.tiles) if (t.capture && t.capture.by === fid) add(t.capture.army);
  return out;
}

export function assignedWorkers(s: GameState, fid: number, w: WorkerType): number {
  const b = w === 'dehqon' ? 'farm' : w === 'chopon' ? 'pasture' : 'mine';
  let n = 0;
  for (const t of s.tiles) if (t.owner === fid && t.building === b) n += t.workers;
  return n;
}

export function totalWorkers(f: Faction): number {
  return f.workers.dehqon + f.workers.chopon + f.workers.konchi;
}

export function coreInfo(f: Faction) {
  return CORE_LEVELS[Math.min(CORE_LEVELS.length, Math.max(1, f.coreLevel)) - 1];
}

/** Bo'sh ishchilarni bo'sh o'rinlarga avtomatik biriktiradi. */
export function autoAssignWorkers(s: GameState, f: Faction): void {
  for (const w of ['dehqon', 'chopon', 'konchi'] as WorkerType[]) {
    const b = w === 'dehqon' ? 'farm' : w === 'chopon' ? 'pasture' : 'mine';
    let idle = f.workers[w] - assignedWorkers(s, f.id, w);
    if (idle < 0) {
      // Ishchilar kamaygan bo'lsa (talon) plitalardan olib tashlash.
      for (const t of s.tiles) {
        if (idle >= 0) break;
        if (t.owner !== f.id || t.building !== b) continue;
        const r = Math.min(t.workers, -idle);
        t.workers -= r;
        idle += r;
      }
      continue;
    }
    for (const t of s.tiles) {
      if (idle <= 0) break;
      if (t.owner !== f.id || t.building !== b) continue;
      const free = workersCapacity(t.level) - t.workers;
      if (free <= 0) continue;
      const add = Math.min(free, idle);
      t.workers += add;
      idle -= add;
    }
  }
}

export function provinceOf(s: GameState, t: Tile): Province {
  return s.provinces[t.province];
}
