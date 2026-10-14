import { GAME, UNITS, ZONE_INFO } from '../config';
import type { Army, Faction, GameState, MarchPurpose, MarchingArmy, PendingBattle, Tile, UnitType, WorkerType } from '../types';
import { armyAdd, armyCount, armyEmpty, armyEntries, clamp, fmt } from '../util';
import { DIRS4, neighbors4, tileAt } from '../world/mapgen';
import { armyDiff, quickResolve } from './combat';
import { accrue, armyPower, dailyMarket, dailyPlayer, lootResources, lootText, tileGoods } from './economy';
import {
  addLog,
  autoAssignWorkers,
  coreTile,
  garrisonTarget,
  makeGarrison,
  ownedTiles,
  spawnAiState,
} from './state';

const R = Math.random;

type SimEvent =
  | { type: 'alert'; army: MarchingArmy; text: string }
  | { type: 'pending' }
  | { type: 'day' }
  | { type: 'owner' };
const listeners: ((e: SimEvent) => void)[] = [];
export function onSim(fn: (e: SimEvent) => void): void {
  listeners.push(fn);
}
function emit(e: SimEvent): void {
  for (const l of listeners) l(e);
}

// ---------------- Yo'l topish ----------------

function moveCost(t: Tile): number {
  switch (t.terrain) {
    case 'kol':
      return Infinity;
    case 'daryo':
      return 2;
    case 'qorli_tog':
      return 1.8;
    case 'tog':
      return 1.4;
    case 'orman':
      return 1.25;
    default:
      return 1;
  }
}

export function findPath(s: GameState, from: Tile, to: Tile): { x: number; y: number }[] | null {
  const W = GAME.mapW;
  const N = W * GAME.mapH;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const start = from.y * W + from.x;
  const goal = to.y * W + to.x;
  dist[start] = 0;
  // Kichik to'r uchun oddiy ochiq ro'yxat yetarli.
  const open: number[] = [start];
  const inOpen = new Uint8Array(N);
  inOpen[start] = 1;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    inOpen[cur] = 0;
    if (cur === goal) break;
    const cx = cur % W;
    const cy = (cur - cx) / W;
    for (const [dx, dy] of DIRS4) {
      const n = tileAt(s.tiles, cx + dx, cy + dy);
      if (!n) continue;
      const c = moveCost(n);
      if (!isFinite(c)) continue;
      const ni = n.y * W + n.x;
      const nd = dist[cur] + c;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = cur;
        if (!inOpen[ni]) {
          open.push(ni);
          inOpen[ni] = 1;
        }
      }
    }
  }
  if (!isFinite(dist[goal])) return null;
  const path: { x: number; y: number }[] = [];
  for (let c = goal; c !== -1; c = prev[c]) path.push({ x: c % W, y: Math.floor(c / W) });
  return path.reverse();
}

export function armySpeed(units: Army): number {
  let sp = Infinity;
  for (const [k] of armyEntries(units)) sp = Math.min(sp, UNITS[k].march);
  return isFinite(sp) ? sp : 6;
}

export function travelDays(s: GameState, from: Tile, to: Tile, units: Army): number {
  const p = findPath(s, from, to);
  if (!p) return Infinity;
  let cost = 0;
  for (let i = 1; i < p.length; i++) cost += moveCost(s.tiles[p[i].y * GAME.mapW + p[i].x]);
  return cost / armySpeed(units);
}

export function sendArmy(
  s: GameState,
  owner: number,
  from: Tile,
  to: Tile,
  units: Army,
  purpose: MarchPurpose,
  takeFrom: 'garrison' | 'none' = 'garrison',
): MarchingArmy | null {
  if (armyEmpty(units)) return null;
  const path = findPath(s, from, to);
  if (!path) return null;
  if (takeFrom === 'garrison') from.garrison = armyAdd(from.garrison, units, -1);
  const a: MarchingArmy = {
    id: s.nextArmyId++,
    owner,
    units: { ...units },
    path,
    pos: 0,
    speed: armySpeed(units),
    purpose,
    target: { x: to.x, y: to.y },
    warned: owner === s.playerId,
    shownCount: armyCount(units),
  };
  s.armies.push(a);
  return a;
}

export function armyPos(a: MarchingArmy): { x: number; y: number } {
  const i = Math.min(a.path.length - 1, Math.floor(a.pos));
  const j = Math.min(a.path.length - 1, i + 1);
  const f = a.pos - i;
  return { x: a.path[i].x + (a.path[j].x - a.path[i].x) * f, y: a.path[i].y + (a.path[j].y - a.path[i].y) * f };
}

// ---------------- Asosiy tik ----------------

export function tick(s: GameState, dtSec: number): void {
  if (s.speed <= 0 || s.pending.length > 0) return;
  const dtDays = (dtSec * s.speed) / GAME.dayLengthSec;
  const prevDay = Math.floor(s.day);
  s.day += dtDays;
  accrue(s, dtDays);
  moveArmies(s, dtDays);
  checkCaptures(s);
  checkWarnings(s);
  if (Math.floor(s.day) > prevDay) {
    dailyPlayer(s);
    dailyMarket(s, R);
    dailyAi(s);
    emit({ type: 'day' });
  }
}

function moveArmies(s: GameState, dtDays: number): void {
  const arrived: MarchingArmy[] = [];
  for (const a of s.armies) {
    const i = Math.min(a.path.length - 1, Math.floor(a.pos));
    const t = s.tiles[a.path[i].y * GAME.mapW + a.path[i].x];
    a.pos += (a.speed * dtDays) / moveCost(t);
    if (a.pos >= a.path.length - 1) {
      a.pos = a.path.length - 1;
      arrived.push(a);
    }
  }
  for (const a of arrived) {
    s.armies = s.armies.filter((x) => x !== a);
    arrive(s, a);
  }
}

function returnHome(s: GameState, owner: number, from: Tile, units: Army): void {
  const f = s.factions[owner];
  if (armyEmpty(units)) return;
  if (!f.alive) return;
  const home = coreTile(s, f);
  if (home === from) {
    home.garrison = armyAdd(home.garrison, units);
    return;
  }
  const a = sendArmy(s, owner, from, home, units, 'return', 'none');
  if (!a) home.garrison = armyAdd(home.garrison, units);
}

function arrive(s: GameState, a: MarchingArmy): void {
  const t = tileAt(s.tiles, a.target.x, a.target.y)!;
  const f = s.factions[a.owner];
  if (!f.alive) return;
  if (a.purpose === 'return') {
    const home = coreTile(s, f);
    home.garrison = armyAdd(home.garrison, a.units);
    return;
  }
  if (a.purpose === 'move') {
    if (t.owner === a.owner && !t.capture) t.garrison = armyAdd(t.garrison, a.units);
    else if (t.capture && t.capture.by === a.owner) t.capture.army = armyAdd(t.capture.army, a.units);
    else returnHome(s, a.owner, t, a.units);
    return;
  }
  // Hujum yoki reyd.
  if (t.capture && t.capture.by === a.owner) {
    t.capture.army = armyAdd(t.capture.army, a.units);
    return;
  }
  if (t.owner === a.owner && !t.capture) {
    t.garrison = armyAdd(t.garrison, a.units);
    return;
  }
  const defenderId = t.capture ? t.capture.by : t.owner;
  if (defenderId < 0) {
    returnHome(s, a.owner, t, a.units);
    return;
  }
  const defender = s.factions[defenderId];
  if (defender.kind === 'player' && s.day < defender.protectedUntil && a.owner !== s.playerId) {
    addLog(s, `${f.name} qo'shini himoya tufayli orqaga qaytdi.`, 'info');
    returnHome(s, a.owner, t, a.units);
    return;
  }
  const defendUnits = t.capture ? t.capture.army : t.garrison;
  const pb: PendingBattle = {
    armyId: a.id,
    attacker: a.owner,
    defender: defenderId,
    x: t.x,
    y: t.y,
    attackUnits: a.units,
    defendUnits: { ...defendUnits },
    kind: t.capture ? 'recapture' : a.purpose === 'raid' ? 'raid' : 'attack',
  };
  const playerInvolved = a.owner === s.playerId || defenderId === s.playerId;
  if (playerInvolved && !armyEmpty(defendUnits)) {
    s.pending.push(pb);
    emit({ type: 'pending' });
    return;
  }
  const r = quickResolve(f, a.units, defender, defendUnits, t, R);
  resolveBattle(s, pb, { attWin: r.attWin, attLeft: r.attLeft, defLeft: r.defLeft, heroesLost: [r.heroesLost.filter((h) => (a.units[h] ?? 0) > 0), r.heroesLost.filter((h) => (defendUnits[h] ?? 0) > 0)] });
}

export interface BattleOutcome {
  attWin: boolean;
  attLeft: Army;
  defLeft: Army;
  heroesLost: [UnitType[], UnitType[]];
}

/** Jang natijasini dunyoga qo'llaydi (taktik ham, avto ham shu yerdan o'tadi). */
export function resolveBattle(s: GameState, pb: PendingBattle, out: BattleOutcome): string {
  const t = tileAt(s.tiles, pb.x, pb.y)!;
  const att = s.factions[pb.attacker];
  const def = s.factions[pb.defender];
  const player = s.factions[s.playerId];
  const lines: string[] = [];
  const attLost = armyCount(pb.attackUnits) - armyCount(out.attLeft);
  const defLost = armyCount(pb.defendUnits) - armyCount(out.defLeft);

  // Qahramonlar.
  for (const [side, fac] of [[0, att], [1, def]] as [number, Faction][]) {
    for (const h of out.heroesLost[side]) {
      if (h === 'amir' && fac.kind === 'player') {
        fac.amirWoundedUntil = s.day + 2;
        lines.push('Amir yarador bo\'ldi — 2 kundan keyin qarorgohga qaytadi.');
      } else if (fac.kind === 'player') {
        lines.push(`${UNITS[h].name} halok bo'ldi.`);
      }
    }
  }
  // Halok bo'lgan qahramonlar natijada allaqachon yo'q.
  const attLeft = out.attLeft;
  const defLeft = out.defLeft;

  // Mudofaachilar holati.
  if (t.capture && t.capture.by === def.id) t.capture.army = defLeft;
  else t.garrison = defLeft;

  if (out.attWin) {
    att.wins++;
    def.losses++;
  } else {
    def.wins++;
    att.losses++;
  }

  const where = `${s.provinces[t.province].name} viloyati (${t.x},${t.y})`;
  if (!out.attWin) {
    lines.unshift(`${where}: ${def.name} ${att.name} hujumini qaytardi. Yo'qotishlar: hujumchi ${attLost}, mudofaachi ${defLost}.`);
    returnHome(s, att.id, t, attLeft);
    if (att.kind === 'ai' && def.kind === 'player') att.anger = Math.max(0, att.anger - 0.5);
  } else if (pb.kind === 'recapture') {
    // Egallash jarayonidagi qo'shin mag'lub bo'ldi.
    if (att.id === t.owner) {
      t.capture = null;
      t.garrison = armyAdd(t.garrison, attLeft);
      lines.unshift(`${where}: ${att.name} yerini qaytarib oldi!`);
    } else {
      t.capture = { by: att.id, until: s.day + GAME.captureDays, army: attLeft };
      lines.unshift(`${where}: ${att.name} egallashni boshladi.`);
    }
  } else {
    const uncapturable = t.building === 'core' && (def.kind === 'player' || def.kind === 'empire');
    if (uncapturable || pb.kind === 'raid') {
      // Reyd: talon olib qaytadi, yer o'tmaydi.
      let loot;
      if (t.building === 'core') {
        loot = lootResources(s, def, att, GAME.lootMin + R() * (GAME.lootMax - GAME.lootMin));
      } else {
        const g = tileGoods(t);
        loot = g ? lootResources(s, def, att, 0.1, g) : {};
        if (g && t.store > 0) {
          loot[g] = (loot[g] ?? 0) + Math.floor(t.store);
          att.res[g] += Math.floor(t.store);
          t.store = 0;
        }
      }
      lines.unshift(`${where}: ${att.name} reyd qildi va ${lootText(loot)} talon qildi.`);
      returnHome(s, att.id, t, attLeft);
      if (def.kind === 'player') def.protectedUntil = Math.max(def.protectedUntil, s.day + GAME.restAfterDefeatDays);
    } else {
      t.capture = { by: att.id, until: s.day + GAME.captureDays, army: attLeft };
      lines.unshift(`${where}: ${att.name} g'alaba qozondi! Egallash boshlandi (${Math.round(GAME.captureDays * 24)} soat).`);
      if (def.kind === 'player') def.protectedUntil = Math.max(def.protectedUntil, s.day + GAME.restAfterDefeatDays);
      // Himoyachi AI egallash davomida qaytarib olishga urinadi.
      if (def.kind !== 'player' && def.alive && R() < 0.6 && !busy(s, def)) {
        const units = takeFromCore(s, def, 0.45, 2);
        if (units) {
          const a = sendArmy(s, def.id, coreTile(s, def), t, units, 'attack', 'none');
          if (a) lines.push(`${def.name} qaytarib olish uchun qo'shin yubordi!`);
          else coreTile(s, def).garrison = armyAdd(coreTile(s, def).garrison, units);
        }
      }
    }
  }

  // AI qasosi.
  if (att.id === s.playerId && (def.kind === 'ai' || def.kind === 'empire')) {
    def.anger += 1;
    if (def.nextActionDay < s.day + 0.5) def.nextActionDay = s.day + 0.5 + R();
  }

  const text = lines.join(' ');
  const involved = att.id === player.id || def.id === player.id;
  const good = (att.id === player.id && out.attWin) || (def.id === player.id && !out.attWin);
  addLog(s, text, involved ? (good ? 'good' : 'bad') : 'war');
  s.ownerVersion++;
  return text;
}

function checkCaptures(s: GameState): void {
  for (const t of s.tiles) {
    if (!t.capture || s.day < t.capture.until) continue;
    const cap = t.capture;
    t.capture = null;
    const prevOwner = t.owner;
    const by = s.factions[cap.by];
    if (!by.alive) {
      continue;
    }
    if (prevOwner === cap.by) {
      t.garrison = armyAdd(t.garrison, cap.army);
      continue;
    }
    transferTile(s, t, cap.by, cap.army);
    if (prevOwner >= 0) {
      const prev = s.factions[prevOwner];
      const g = tileGoods(t);
      const loot = g ? lootResources(s, prev, by, GAME.lootMin + R() * (GAME.lootMax - GAME.lootMin), g) : {};
      if (g === 'don' || g === 'kumush') {
        // Chorvaning bir qismi ham o'tadi.
        const sheep = Math.floor(prev.res.qoy * 0.1);
        prev.res.qoy -= sheep;
        by.res.qoy += sheep;
        if (sheep) loot.qoy = sheep;
      }
      addLog(
        s,
        `${s.provinces[t.province].name} viloyati (${t.x},${t.y}): ${by.name} yerni egalladi. O'lja: ${lootText(loot)}.`,
        by.id === s.playerId ? 'good' : prev.id === s.playerId ? 'bad' : 'war',
      );
      if (t.building === 'core' && prev.kind === 'ai') destroyAiState(s, prev, by);
    }
  }
}

function workerTypeOf(t: Tile): WorkerType | null {
  return t.building === 'farm' ? 'dehqon' : t.building === 'pasture' ? 'chopon' : t.building === 'mine' ? 'konchi' : null;
}

function transferTile(s: GameState, t: Tile, newOwner: number, garrison: Army): void {
  const prevOwner = t.owner;
  const w = workerTypeOf(t);
  if (w && prevOwner >= 0 && s.factions[prevOwner].kind === 'player') {
    s.factions[prevOwner].workers[w] = Math.max(0, s.factions[prevOwner].workers[w] - t.workers);
  }
  t.owner = newOwner;
  t.garrison = garrison;
  if (t.building === 'core' && s.factions[newOwner].kind === 'player') {
    // Bosib olingan AI poytaxti oddiy qal'aga aylanadi.
    t.building = 'fort';
    t.level = Math.max(1, Math.min(5, t.level + 1));
  }
  if (w) {
    // Ishchilarning yarmi yangi egaga o'tadi.
    t.workers = Math.floor(t.workers / 2);
    const nf = s.factions[newOwner];
    if (nf.kind === 'player') nf.workers[w] += t.workers;
  }
  t.store = 0;
  if (s.factions[newOwner].kind === 'player') autoAssignWorkers(s, s.factions[newOwner]);
  if (prevOwner >= 0 && s.factions[prevOwner].kind === 'player') autoAssignWorkers(s, s.factions[prevOwner]);
  s.ownerVersion++;
  emit({ type: 'owner' });
}

function destroyAiState(s: GameState, f: Faction, by: Faction): void {
  f.alive = false;
  for (const t of s.tiles) {
    if (t.owner === f.id) {
      transferTile(s, t, by.id, t.garrison);
    }
    if (t.capture && t.capture.by === f.id) t.capture = null;
  }
  s.armies = s.armies.filter((a) => a.owner !== f.id);
  addLog(s, `${f.name} davlati yutildi! Uning yerlari ${by.name}ga o'tdi. Bozorda bitta xaridor kamaydi.`, by.id === s.playerId ? 'good' : 'war');
  f.nextActionDay = s.day + 2;
}

function checkWarnings(s: GameState): void {
  const p = s.factions[s.playerId];
  let towers = 0;
  for (const t of s.tiles) if (t.owner === p.id && t.building === 'tower') towers += t.level;
  towers = Math.min(10, towers);
  const warnDist = 3 + towers * 0.9 + p.spyLevel * 1.6;
  const err = Math.max(0, 0.5 - 0.05 * (towers + p.spyLevel * 1.5));
  for (const a of s.armies) {
    if (a.warned || a.owner === p.id) continue;
    const t = tileAt(s.tiles, a.target.x, a.target.y)!;
    if (t.owner !== p.id && !(t.capture && t.capture.by === p.id)) continue;
    const left = a.path.length - 1 - a.pos;
    if (left > warnDist) continue;
    a.warned = true;
    const real = armyCount(a.units);
    a.shownCount = Math.max(1, Math.round(real * (1 + (R() * 2 - 1) * err)));
    const f = s.factions[a.owner];
    const approx = err > 0.05 ? `~${a.shownCount}` : `${real}`;
    const text = `Ayg'oqchilar xabari: ${f.name} qo'shini (${approx} askar) ${t.building === 'core' ? 'qarorgohingizga' : 'yeringizga'} kelmoqda!`;
    addLog(s, text, 'war');
    emit({ type: 'alert', army: a, text });
  }
}

// ---------------- AI ----------------

function adaptMult(s: GameState, f: Faction): number {
  if (f.kind === 'empire') return 1;
  // O'yinchi kuchiga cheklangan moslashish.
  return 1 + Math.min(0.6, armyPower(s, s.playerId) / 4000);
}

function regenGarrisons(s: GameState, f: Faction): void {
  const adapt = adaptMult(s, f);
  for (const t of s.tiles) {
    if (t.owner !== f.id || t.capture) continue;
    const target = Math.round(garrisonTarget(s, f, t) * adapt);
    const cur = armyCount(t.garrison);
    if (cur >= target) continue;
    const add = Math.max(1, Math.round((target - cur) * (f.kind === 'empire' ? 0.25 : 0.18)));
    t.garrison = armyAdd(t.garrison, makeGarrison(f, add, R));
  }
}

function aiOwnTiles(s: GameState, f: Faction): Tile[] {
  return ownedTiles(s, f.id).filter((t) => !t.capture);
}

function busy(s: GameState, f: Faction): boolean {
  return s.armies.some((a) => a.owner === f.id && a.purpose !== 'return');
}

function takeFromCore(s: GameState, f: Faction, frac: number, min: number): Army | null {
  const core = coreTile(s, f);
  const n = armyCount(core.garrison);
  const take = Math.max(min, Math.floor(n * frac));
  if (n < min + 2) return null;
  const out: Army = {};
  let left = Math.min(take, n - 2);
  for (const [k, c] of armyEntries(core.garrison)) {
    if (left <= 0) break;
    if (UNITS[k].hero) continue;
    const x = Math.min(c, Math.ceil(c * (take / n)), left);
    if (x > 0) {
      out[k] = x;
      left -= x;
    }
  }
  return armyEmpty(out) ? null : out;
}

function nearestPlayerTile(s: GameState, f: Faction, includeCore: boolean): Tile | null {
  let best: Tile | null = null;
  let bd = Infinity;
  for (const t of s.tiles) {
    if (t.owner !== s.playerId || t.capture) continue;
    if (!includeCore && t.building === 'core') continue;
    const d = Math.abs(t.x - f.coreX) + Math.abs(t.y - f.coreY);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

function retaliate(s: GameState, f: Faction): void {
  const p = s.factions[s.playerId];
  if (f.anger < 1 || s.day < p.protectedUntil || s.day < f.nextActionDay || busy(s, f)) return;
  const toCore = f.anger >= 3 && R() < 0.5;
  const target = toCore ? coreTile(s, p) : nearestPlayerTile(s, f, false) ?? coreTile(s, p);
  const zoneG = ZONE_INFO[s.provinces[target.province].zone].garrison;
  const size = Math.round(zoneG * f.strength * (0.5 + 0.35 * Math.min(f.anger, 5)) * (f.kind === 'empire' ? 1.5 : 1));
  const units = takeFromCore(s, f, 0.6, Math.min(size, 3));
  if (!units) return;
  // Kerakli hajmga kesish.
  let n = armyCount(units);
  if (n > size) {
    for (const k of Object.keys(units) as UnitType[]) {
      const c = units[k] as number;
      const keep = Math.max(1, Math.round((c * size) / n));
      const back = c - keep;
      if (back > 0) {
        units[k] = keep;
        const core = coreTile(s, f);
        core.garrison[k] = (core.garrison[k] ?? 0) + back;
      }
    }
    n = armyCount(units);
  }
  const purpose: MarchPurpose = target.building !== 'core' && f.anger >= 4 ? 'attack' : 'raid';
  const a = sendArmy(s, f.id, coreTile(s, f), target, units, purpose, 'none');
  if (!a) {
    const core = coreTile(s, f);
    core.garrison = armyAdd(core.garrison, units);
    return;
  }
  f.anger = Math.max(0, f.anger - 1);
  f.nextActionDay = s.day + 2 + R() * 2;
}

function aiGrow(s: GameState, f: Faction): void {
  const own = aiOwnTiles(s, f);
  const cap = s.provinces[coreTile(s, f).province].zone === 'orta' ? 14 : 10;
  if (own.length >= cap || R() > 0.35) return;
  const cand: Tile[] = [];
  for (const t of own)
    for (const n of neighbors4(s.tiles, t))
      if (n.owner === -1 && n.province === t.province && n.terrain !== 'kol') cand.push(n);
  if (cand.length === 0) return;
  const t = cand[Math.floor(R() * cand.length)];
  t.owner = f.id;
  t.building = t.terrain === 'tog' || t.terrain === 'qorli_tog' ? 'mine' : t.terrain === 'yaylov' ? 'pasture' : t.terrain === 'orman' || t.terrain === 'daryo' ? 'none' : 'farm';
  t.level = t.building === 'none' ? 0 : 1;
  t.workers = t.building === 'none' ? 0 : 2;
  t.garrison = makeGarrison(f, 2, R);
  s.ownerVersion++;
}

/** AI davlatlar o'zaro va imperiyalar o'zaro urushadi. */
function aiWar(s: GameState, f: Faction): void {
  if (busy(s, f)) return;
  const chance = f.kind === 'empire' ? 0.1 : 0.07;
  if (R() > chance) return;
  const targets: Tile[] = [];
  for (const t of aiOwnTiles(s, f))
    for (const n of neighbors4(s.tiles, t)) {
      if (n.owner < 0 || n.owner === f.id || n.owner === s.playerId || n.capture) continue;
      const o = s.factions[n.owner];
      if (n.building === 'core' && o.kind === 'empire') continue;
      if (f.kind === 'ai' && o.kind === 'empire') continue;
      if (f.kind === 'empire' && o.kind === 'ai' && R() > 0.25) continue;
      targets.push(n);
    }
  if (targets.length === 0) return;
  const target = targets[Math.floor(R() * targets.length)];
  const units = takeFromCore(s, f, f.kind === 'empire' ? 0.3 : 0.45, 3);
  if (!units) return;
  const a = sendArmy(s, f.id, coreTile(s, f), target, units, 'attack', 'none');
  if (!a) coreTile(s, f).garrison = armyAdd(coreTile(s, f).garrison, units);
}

function dailyAi(s: GameState): void {
  const p = s.factions[s.playerId];
  if (p.amirWoundedUntil > 0 && s.day >= p.amirWoundedUntil) {
    p.amirWoundedUntil = 0;
    const core = coreTile(s, p);
    core.garrison.amir = 1;
    addLog(s, 'Amir tuzalib qarorgohga qaytdi.', 'good');
  }
  for (const f of s.factions) {
    if (!f.alive || f.kind === 'player') continue;
    regenGarrisons(s, f);
    f.anger = Math.max(0, f.anger * 0.93);
    retaliate(s, f);
    if (f.kind === 'ai') aiGrow(s, f);
    aiWar(s, f);
  }
  // Yutilgan AI o'rniga yangisi paydo bo'ladi.
  const dead = s.factions.filter((f) => f.kind === 'ai' && !f.alive && f.nextActionDay > 0 && s.day >= f.nextActionDay);
  for (const d of dead) {
    d.nextActionDay = 0;
    const nf = spawnAiState(s, R);
    if (nf) addLog(s, `Xaritada yangi davlat paydo bo'ldi: ${nf.name}.`, 'info');
  }
}

// ---------------- O'yinchi buyruqlari ----------------

export function canAttack(s: GameState, target: Tile): { ok: boolean; msg: string } {
  const p = s.factions[s.playerId];
  if (target.capture && target.capture.by === p.id) return { ok: false, msg: 'Bu yer allaqachon egallanmoqda' };
  const enemy = target.capture ? target.capture.by : target.owner;
  if (enemy === p.id && !target.capture) return { ok: false, msg: 'Bu sizning yeringiz' };
  if (enemy < 0) return { ok: false, msg: 'Egasiz yerga hujum qilinmaydi — qo\'shni bo\'lsa sotib oling' };
  if (target.terrain === 'kol') return { ok: false, msg: 'Ko\'l' };
  return { ok: true, msg: '' };
}

export function playerAttack(s: GameState, from: Tile, target: Tile, units: Army): { ok: boolean; msg: string } {
  const c = canAttack(s, target);
  if (!c.ok) return c;
  for (const [k, n] of armyEntries(units)) {
    if ((from.garrison[k] ?? 0) < n) return { ok: false, msg: 'Garnizonda yetarli askar yo\'q' };
  }
  if (armyEmpty(units)) return { ok: false, msg: 'Askar tanlang' };
  const a = sendArmy(s, s.playerId, from, target, units, 'attack');
  if (!a) return { ok: false, msg: 'Yo\'l topilmadi' };
  const days = (a.path.length - 1) / a.speed;
  return { ok: true, msg: `Qo'shin yo'lga chiqdi (~${fmt(days * 24)} soat).` };
}

export function playerMove(s: GameState, from: Tile, to: Tile, units: Army): { ok: boolean; msg: string } {
  if (to.owner !== s.playerId && !(to.capture && to.capture.by === s.playerId)) return { ok: false, msg: 'Faqat o\'z yeringizga' };
  if (armyEmpty(units)) return { ok: false, msg: 'Askar tanlang' };
  for (const [k, n] of armyEntries(units)) {
    if ((from.garrison[k] ?? 0) < n) return { ok: false, msg: 'Garnizonda yetarli askar yo\'q' };
  }
  const a = sendArmy(s, s.playerId, from, to, units, 'move');
  if (!a) return { ok: false, msg: 'Yo\'l topilmadi' };
  return { ok: true, msg: 'Qo\'shin yo\'lga chiqdi.' };
}

export function clampSpeed(v: number): number {
  return clamp(v, 0, 8);
}

export { armyDiff };
