import {
  BASIC_UNITS,
  BUILDINGS,
  CORE_LEVELS,
  ECON,
  FACTION_UPGRADES,
  MARKET,
  MAX_UPGRADE_LEVEL,
  SARKARDA_SQUAD,
  UNITS,
  UNLOCK,
  WORKER_INFO,
  ZONE_INFO,
  buildingUpgradeCost,
  impassable,
  levelMult,
  omborProtect,
  workerFor,
  upgradeCost,
  workersCapacity,
} from '../config';
import type { BuildingType, Faction, GameState, Goods, ResKey, Tile, UnitType, WorkerType } from '../types';
import { armyCount, clamp } from '../util';
import { neighbors4 } from '../world/mapgen';
import {
  addLog,
  autoAssignWorkers,
  coreInfo,
  coreTile,
  ownedTiles,
  soldierCount,
  totalArmy,
  totalWorkers,
} from './state';

export type ActionResult = { ok: true; msg?: string } | { ok: false; msg: string };
const fail = (msg: string): ActionResult => ({ ok: false, msg });
const ok = (msg?: string): ActionResult => ({ ok: true, msg });

function canPay(f: Faction, cost: Partial<Record<ResKey, number>>): boolean {
  for (const k of Object.keys(cost) as ResKey[]) if (f.res[k] < (cost[k] ?? 0)) return false;
  return true;
}
function pay(f: Faction, cost: Partial<Record<ResKey, number>>): void {
  for (const k of Object.keys(cost) as ResKey[]) f.res[k] -= cost[k] ?? 0;
}
function costText(cost: Partial<Record<ResKey, number>>): string {
  const names: Record<ResKey, string> = { kumush: 'kumush', bronza: 'bronza', don: 'don', qoy: 'qo\'y' };
  return (Object.keys(cost) as ResKey[])
    .filter((k) => (cost[k] ?? 0) > 0)
    .map((k) => `${cost[k]} ${names[k]}`)
    .join(', ');
}

// ---------------- Ishlab chiqarish ----------------

export function tileGoods(t: Tile): Goods | null {
  if (t.building === 'farm' || t.building === 'bog') return 'don';
  if (t.building === 'pasture') return 'qoy';
  if (t.building === 'mine') return 'kumush';
  return null;
}

/** Plitaning kunlik ishlab chiqarishi. */
export function tileProduction(s: GameState, t: Tile): number {
  if (t.owner < 0 || t.capture) return 0;
  const f = s.factions[t.owner];
  const lm = 1 + 0.15 * (t.level - 1);
  const starve = f.starving > 0 ? 0.7 : 1;
  if (t.building === 'farm') {
    const tm: Partial<Record<Tile['terrain'], number>> = { unumdor: 1.5, vodiy: 1.3, tekislik: 1.0, yaylov: 0.8, chol: 0.5 };
    let m = tm[t.terrain] ?? 0.7;
    if (t.crop === 'arpa') m = 0.75 + m * 0.25; // arpa kambag'al yerda ham o'sadi
    else if (t.terrain === 'unumdor' || t.terrain === 'vodiy') m *= 1.1;
    return t.workers * ECON.farmRate * m * lm * levelMult(f.workerLevels.dehqon) * starve;
  }
  if (t.building === 'bog') {
    const tm: Partial<Record<Tile['terrain'], number>> = { unumdor: 1.45, vodiy: 1.35, tekislik: 1.15 };
    return t.workers * ECON.farmRate * 1.2 * (tm[t.terrain] ?? 1) * lm * levelMult(f.workerLevels.dehqon) * starve;
  }
  if (t.building === 'pasture') {
    const tm: Partial<Record<Tile['terrain'], number>> = { yaylov: 1.5, vodiy: 1.1, tekislik: 1.0, unumdor: 0.9, chol: 0.6 };
    return t.workers * ECON.pastureRate * (tm[t.terrain] ?? 0.8) * lm * levelMult(f.workerLevels.chopon) * starve;
  }
  if (t.building === 'mine') {
    const m = (t.deposit ? 1.5 : 1) * (t.terrain === 'qorli_tog' ? 1.3 : 1);
    return t.workers * ECON.mineRate * m * lm * levelMult(f.workerLevels.konchi) * starve;
  }
  return 0;
}

export function storeCap(t: Tile): number {
  return 40 + 30 * t.level;
}

/** Har kadrda: ishxonalar omborida resurs to'planadi. */
export function accrue(s: GameState, dtDays: number): void {
  for (const t of s.tiles) {
    if (t.owner !== s.playerId) continue;
    const p = tileProduction(s, t);
    if (p <= 0) continue;
    t.store = Math.min(storeCap(t), t.store + p * dtDays);
  }
}

/** Ishxonalardagi yig'ilgan mahsulotni xazinaga olib keladi. */
export function collectAll(s: GameState, fid: number): number {
  const f = s.factions[fid];
  let total = 0;
  for (const t of s.tiles) {
    if (t.owner !== fid || t.store <= 0 || t.capture) continue;
    const g = tileGoods(t);
    if (!g) continue;
    const amount = Math.floor(t.store);
    f.res[g] += amount;
    t.store -= amount;
    total += amount;
  }
  return total;
}

export interface DailyReport {
  food: number;
  wages: number;
  tax: number;
  repair: number;
  decay: number;
}

export function dailyCosts(s: GameState, f: Faction): DailyReport {
  const army = totalArmy(s, f.id);
  let food = totalWorkers(f) * ECON.workerFood;
  let wages = 0;
  for (const [k, n] of Object.entries(army) as [UnitType, number][]) {
    food += UNITS[k].food * n;
    wages += UNITS[k].wage * n;
  }
  const tiles = ownedTiles(s, f.id);
  const tax = tiles.length * ECON.tileTax;
  let repair = 0;
  for (const t of tiles) if (t.building !== 'none') repair += t.level * ECON.repairPerLevel;
  const decay = Math.max(0, f.res.don * ECON.donDecay * (1 - 0.12 * (f.omborLevel - 1)));
  return { food, wages, tax, repair: Math.round(repair), decay };
}

/** Kun oxiri hisob-kitobi (faqat o'yinchi uchun; AI iqtisodi soddalashtirilgan). */
export function dailyPlayer(s: GameState): void {
  const f = s.factions[s.playerId];
  collectAll(s, f.id);
  const c = dailyCosts(s, f);
  f.res.don -= c.decay;
  // Oziq-ovqat: don, yetmasa qo'y so'yiladi.
  let need = c.food;
  const fromDon = Math.min(f.res.don, need);
  f.res.don -= fromDon;
  need -= fromDon;
  if (need > 0) {
    const sheep = Math.min(f.res.qoy, Math.ceil(need / ECON.qoyFoodValue));
    f.res.qoy -= sheep;
    need -= sheep * ECON.qoyFoodValue;
  }
  if (need > 0.5) {
    f.starving++;
    addLog(s, `Oziq-ovqat yetmadi! Askarlar kuchsizlanmoqda (${f.starving}-kun). Don sotib oling yoki ekinzor quring.`, 'bad');
  } else if (f.starving > 0) {
    f.starving = 0;
    addLog(s, 'Oziq-ovqat yetarli, askarlar tiklandi.', 'good');
  }
  const money = c.wages + c.tax + c.repair;
  f.res.bronza -= money;
  if (f.res.bronza < 0) {
    // Maosh to'lanmasa askarlarning bir qismi qochadi.
    const core = coreTile(s, f);
    let deserted = 0;
    for (const k of BASIC_UNITS) {
      const n = core.garrison[k] ?? 0;
      const d = Math.ceil(n * 0.15);
      if (d > 0) {
        core.garrison[k] = n - d;
        deserted += d;
      }
    }
    f.res.bronza = 0;
    if (deserted > 0) addLog(s, `Bronza yetmadi — ${deserted} askar maosh olmay ketib qoldi.`, 'bad');
  }
  for (const k of Object.keys(f.res) as ResKey[]) f.res[k] = Math.max(0, f.res[k]);
}

// ---------------- Bozor ----------------

export function buyers(s: GameState, g: Goods): number {
  let n = 0;
  for (const f of s.factions) {
    if (!f.alive || f.kind === 'player') continue;
    if (f.kind === 'empire') n += 0.5;
    else if (f.specialty === 'kon' && g !== 'kumush') n += 1;
    else if (f.specialty === 'dehqon' && g !== 'don') n += 1;
    else if (f.specialty === 'chorva' && g !== 'qoy') n += 1;
    else n += 0.25;
  }
  return n;
}

export function sellPrice(s: GameState, g: Goods): number {
  const b = buyers(s, g);
  const demand = 0.45 + 0.11 * b;
  return MARKET.base[g] * demand * s.market.drift[g] * (1 - s.market.saturation[g]);
}

export function buyPrice(s: GameState, g: Goods): number {
  return MARKET.base[g] * MARKET.buyMarkup * s.market.drift[g] * (1 + s.market.saturation[g] * 0.5);
}

export function sell(s: GameState, g: Goods, qty: number): ActionResult {
  const f = s.factions[s.playerId];
  qty = Math.floor(Math.min(qty, f.res[g]));
  if (qty <= 0) return fail('Sotish uchun mahsulot yo\'q');
  const b = Math.max(0.5, buyers(s, g));
  const p0 = sellPrice(s, g);
  s.market.saturation[g] = clamp(s.market.saturation[g] + (MARKET.satPerUnit[g] * qty) / b, 0, 0.85);
  const p1 = sellPrice(s, g);
  const revenue = Math.floor(((p0 + p1) / 2) * qty);
  f.res[g] -= qty;
  f.res.bronza += revenue;
  return ok(`${qty} sotildi: +${revenue} bronza`);
}

export function buy(s: GameState, g: Goods, qty: number): ActionResult {
  const f = s.factions[s.playerId];
  const price = buyPrice(s, g);
  const cost = Math.ceil(price * qty);
  if (f.res.bronza < cost) return fail(`${cost} bronza kerak`);
  f.res.bronza -= cost;
  f.res[g] += qty;
  return ok(`${qty} sotib olindi: −${cost} bronza`);
}

export function dailyMarket(s: GameState, rnd: () => number): void {
  for (const g of ['don', 'qoy', 'kumush'] as Goods[]) {
    s.market.saturation[g] *= 1 - MARKET.recoverPerDay;
    s.market.drift[g] = clamp(s.market.drift[g] + (rnd() - 0.5) * 0.12, 0.8, 1.25);
  }
}

// ---------------- Yer va qurilish ----------------

export function landPrice(s: GameState, t: Tile): number {
  return ZONE_INFO[s.provinces[t.province].zone].landPrice;
}

/** Faqat qo'shni (tutash) va o'sha viloyatdagi egasiz yer sotib olinadi. */
export function canBuyTile(s: GameState, t: Tile): ActionResult {
  const f = s.factions[s.playerId];
  if (t.owner !== -1) return fail('Bu yerning egasi bor');
  if (impassable(t)) return fail(t.terrain === 'kol' ? 'Ko\'lni sotib bo\'lmaydi' : 'Bu yer o\'yin maydonidan tashqarida');
  const adj = neighbors4(s.tiles, t).some((n) => n.owner === f.id && n.province === t.province && !n.capture);
  if (!adj) {
    const anyAdj = neighbors4(s.tiles, t).some((n) => n.owner === f.id);
    return fail(anyAdj ? 'Boshqa viloyatga faqat jang orqali chiqiladi' : 'Faqat o\'z yeringizga tutash yerni olish mumkin');
  }
  if (ownedTiles(s, f.id).length >= coreInfo(f).maxTiles) return fail('Yer chegarasi to\'ldi — qarorgohni kuchaytiring');
  const price = landPrice(s, t);
  if (f.res.kumush < price) return fail(`${price} kumush kerak`);
  return ok();
}

export function buyTile(s: GameState, t: Tile): ActionResult {
  const r = canBuyTile(s, t);
  if (!r.ok) return r;
  const f = s.factions[s.playerId];
  f.res.kumush -= landPrice(s, t);
  t.owner = f.id;
  t.building = 'none';
  t.level = 0;
  s.ownerVersion++;
  return ok('Yer sotib olindi');
}

export function buildOptions(t: Tile): (keyof typeof BUILDINGS)[] {
  const out: (keyof typeof BUILDINGS)[] = [];
  if (impassable(t)) return out;
  for (const k of Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]) {
    const d = BUILDINGS[k];
    if (k === 'mine') {
      if (t.deposit || t.terrain === 'tog' || t.terrain === 'qorli_tog') out.push(k);
      continue;
    }
    if (d.allowed && !d.allowed.includes(t.terrain)) continue;
    if (t.terrain === 'daryo' && k !== 'tower') continue;
    out.push(k);
  }
  return out;
}

export function build(s: GameState, t: Tile, b: keyof typeof BUILDINGS): ActionResult {
  const f = s.factions[s.playerId];
  if (t.owner !== f.id) return fail('Bu sizning yeringiz emas');
  if (t.building !== 'none') return fail('Bu yerda allaqachon bino bor');
  if (!buildOptions(t).includes(b)) return fail('Bu yerga bunday bino qurib bo\'lmaydi');
  const cost = BUILDINGS[b].costKumush;
  if (f.res.kumush < cost) return fail(`${cost} kumush kerak`);
  f.res.kumush -= cost;
  t.building = b as BuildingType;
  t.level = 1;
  t.painted = false;
  t.crop = t.terrain === 'chol' ? 'arpa' : 'bugdoy';
  autoAssignWorkers(s, f);
  return ok(`${BUILDINGS[b].name} qurildi`);
}

export function upgradeBuilding(s: GameState, t: Tile): ActionResult {
  const f = s.factions[s.playerId];
  if (t.owner !== f.id) return fail('Bu sizning yeringiz emas');
  if (t.building === 'core') return upgradeCore(s);
  if (t.building === 'none' || t.building === 'city') return fail('Kuchaytiriladigan bino yo\'q');
  const d = BUILDINGS[t.building];
  if (t.level >= d.maxLevel) return fail('Eng yuqori daraja');
  const cost = buildingUpgradeCost(d, t.level);
  if (f.res.kumush < cost) return fail(`${cost} kumush kerak`);
  f.res.kumush -= cost;
  t.level++;
  autoAssignWorkers(s, f);
  return ok(`${d.name} ${t.level}-darajaga ko'tarildi`);
}

export function demolish(s: GameState, t: Tile): ActionResult {
  const f = s.factions[s.playerId];
  if (t.owner !== f.id || t.building === 'core') return fail('Buzib bo\'lmaydi');
  t.building = 'none';
  t.level = 0;
  t.workers = 0;
  t.store = 0;
  t.painted = false;
  autoAssignWorkers(s, f);
  return ok('Bino buzildi');
}

export function setCrop(s: GameState, t: Tile, crop: Tile['crop']): void {
  if (t.owner === s.playerId && t.building === 'farm') t.crop = crop;
}

export function upgradeCore(s: GameState): ActionResult {
  const f = s.factions[s.playerId];
  if (f.coreLevel >= CORE_LEVELS.length) return fail('Qarorgoh eng yuqori darajada');
  const next = CORE_LEVELS[f.coreLevel];
  const cost = { kumush: next.costKumush, bronza: next.costBronza };
  if (!canPay(f, cost)) return fail(`${costText(cost)} kerak`);
  pay(f, cost);
  f.coreLevel++;
  coreTile(s, f).level = f.coreLevel;
  addLog(s, `Qarorgoh o'sdi: ${next.name}!`, 'good');
  return ok();
}

export function factionUpgrade(s: GameState, key: keyof typeof FACTION_UPGRADES): ActionResult {
  const f = s.factions[s.playerId];
  const d = FACTION_UPGRADES[key];
  const cur = key === 'barracks' ? f.barracksLevel : key === 'ombor' ? f.omborLevel : f.spyLevel;
  if (cur >= d.max) return fail('Eng yuqori daraja');
  const cost = d.cost(cur + 1);
  if (f.res.kumush < cost) return fail(`${cost} kumush kerak`);
  f.res.kumush -= cost;
  if (key === 'barracks') f.barracksLevel++;
  else if (key === 'ombor') f.omborLevel++;
  else f.spyLevel++;
  return ok(`${d.name}: ${cur + 1}-daraja`);
}

// ---------------- Ishchilar va askarlar ----------------

export function hireWorker(s: GameState, w: WorkerType): ActionResult {
  const f = s.factions[s.playerId];
  if (totalWorkers(f) >= coreInfo(f).maxWorkers) return fail('Ishchi chegarasi — qarorgohni kuchaytiring');
  const cost = WORKER_INFO[w].hireCost;
  if (f.res.bronza < cost) return fail(`${cost} bronza kerak`);
  f.res.bronza -= cost;
  f.workers[w]++;
  autoAssignWorkers(s, f);
  return ok(`${WORKER_INFO[w].name} yollandi`);
}

export function changeTileWorkers(s: GameState, t: Tile, delta: number): ActionResult {
  const f = s.factions[s.playerId];
  const w = workerFor(t.building);
  if (!w || t.owner !== f.id) return fail('Bu yerda ishchi ishlamaydi');
  if (delta > 0) {
    let assigned = 0;
    for (const o of s.tiles) if (o.owner === f.id && workerFor(o.building) === w) assigned += o.workers;
    if (assigned >= f.workers[w]) return fail(`Bo'sh ${WORKER_INFO[w].name.toLowerCase()} yo'q — yollang`);
    if (t.workers >= workersCapacity(t.level)) return fail('Bu ishxona to\'la — darajasini oshiring');
    t.workers++;
  } else {
    if (t.workers <= 0) return fail('Ishchi yo\'q');
    t.workers--;
  }
  return ok();
}

export function unitAvailable(f: Faction, k: UnitType): boolean {
  const d = UNITS[k];
  if (d.barracks > 0) return f.barracksLevel >= d.barracks;
  return false;
}

export function trainUnits(s: GameState, k: UnitType, n: number): ActionResult {
  const f = s.factions[s.playerId];
  const d = UNITS[k];
  if (!unitAvailable(f, k)) return fail(`Mashg'ulot maydoni ${d.barracks}-daraja kerak`);
  if (soldierCount(s, f.id) + n > coreInfo(f).maxSoldiers) return fail('Askar chegarasi — qarorgohni kuchaytiring');
  const cost = { bronza: d.costBronza * n, kumush: d.costKumush * n };
  if (!canPay(f, cost)) return fail(`${costText(cost)} kerak`);
  pay(f, cost);
  const core = coreTile(s, f);
  core.garrison[k] = (core.garrison[k] ?? 0) + n;
  return ok(`${n} ${d.name.toLowerCase()} tayyorlandi`);
}

export function upgradeUnit(s: GameState, k: UnitType): ActionResult {
  const f = s.factions[s.playerId];
  const lvl = f.unitLevels[k];
  if (lvl >= MAX_UPGRADE_LEVEL) return fail('Eng yuqori daraja');
  const cost = upgradeCost(lvl + 1, UNITS[k].hero);
  if (f.res.kumush < cost) return fail(`${cost} kumush kerak`);
  f.res.kumush -= cost;
  f.unitLevels[k]++;
  return ok(`${UNITS[k].name}: ${lvl + 1}-daraja`);
}

export function upgradeWorker(s: GameState, w: WorkerType): ActionResult {
  const f = s.factions[s.playerId];
  const lvl = f.workerLevels[w];
  if (lvl >= MAX_UPGRADE_LEVEL) return fail('Eng yuqori daraja');
  const cost = upgradeCost(lvl + 1);
  if (f.res.kumush < cost) return fail(`${cost} kumush kerak`);
  f.res.kumush -= cost;
  f.workerLevels[w]++;
  return ok(`${WORKER_INFO[w].plural}: ${lvl + 1}-daraja`);
}

export function unlockStatus(f: Faction, key: 'qomondon' | 'sarkarda') {
  const u = UNLOCK[key];
  return {
    core: f.coreLevel >= u.coreLevel,
    kumush: f.res.kumush >= u.kumush,
    wins: f.wins >= u.wins,
    req: u,
  };
}

export function unlockCommander(s: GameState, key: 'qomondon' | 'sarkarda'): ActionResult {
  const f = s.factions[s.playerId];
  if (f.unlocks[key]) return fail('Allaqachon ochilgan');
  const st = unlockStatus(f, key);
  if (!st.core) return fail(`Qarorgoh ${st.req.coreLevel}-daraja kerak`);
  if (!st.wins) return fail(`${st.req.wins} ta g'alaba kerak (hozir ${f.wins})`);
  if (!st.kumush) return fail(`${st.req.kumush} kumush kerak`);
  f.res.kumush -= st.req.kumush;
  f.unlocks[key] = true;
  const core = coreTile(s, f);
  if (key === 'qomondon') {
    core.garrison.qomondon = 1;
    core.garrison.zirhli_otliq = (core.garrison.zirhli_otliq ?? 0) + UNLOCK.commanderSquad.zirhli_otliq;
    core.garrison.zirhli_nayzachi = (core.garrison.zirhli_nayzachi ?? 0) + UNLOCK.commanderSquad.zirhli_nayzachi;
    addLog(s, 'Qo\'mondon ochildi! Zirhlangan otliq guruhi (15 kishi) qarorgohda.', 'good');
  } else {
    addLog(s, 'Sarkardalar ochildi! Ularni Qo\'shin bo\'limida yollang.', 'good');
  }
  return ok();
}

/** Qo'mondon guruhidagi zirhli askarlarni to'ldirish yoki sarkarda yollash. */
export function hireSpecial(s: GameState, k: UnitType): ActionResult {
  const f = s.factions[s.playerId];
  const army = totalArmy(s, f.id);
  const core = coreTile(s, f);
  const d = UNITS[k];
  if (k === 'zirhli_otliq' || k === 'zirhli_nayzachi') {
    if (!f.unlocks.qomondon) return fail('Qo\'mondon ochilmagan');
    const cap = UNLOCK.commanderSquad[k];
    if ((army[k] ?? 0) >= cap) return fail(`Guruhda eng ko'pi ${cap} ta`);
  } else if (k === 'qomondon') {
    if (!f.unlocks.qomondon) return fail('Qo\'mondon ochilmagan');
    if ((army.qomondon ?? 0) >= 1) return fail('Qo\'mondon bor');
  } else if (k in SARKARDA_SQUAD) {
    if (!f.unlocks.sarkarda) return fail('Sarkardalar ochilmagan');
    if ((army[k] ?? 0) >= 1) return fail('Bu sarkarda allaqachon bor');
  } else return fail('Noma\'lum');
  const cost = { bronza: d.costBronza, kumush: d.costKumush };
  if (!canPay(f, cost)) return fail(`${costText(cost)} kerak`);
  pay(f, cost);
  core.garrison[k] = (core.garrison[k] ?? 0) + 1;
  const squad = SARKARDA_SQUAD[k];
  if (squad) core.garrison[squad.type] = (core.garrison[squad.type] ?? 0) + squad.count;
  return ok(`${d.name} yollandi`);
}

/** Talon: ombor himoyalagan ulushdan tashqari. */
export function lootResources(_s: GameState, from: Faction, to: Faction, frac: number, only?: Goods): Partial<Record<ResKey, number>> {
  const prot = from.kind === 'player' ? omborProtect(from.omborLevel) : 0.3;
  const out: Partial<Record<ResKey, number>> = {};
  const keys: ResKey[] = only ? [only] : ['kumush', 'bronza', 'don', 'qoy'];
  for (const k of keys) {
    const amount = Math.floor(from.res[k] * (1 - prot) * frac);
    if (amount <= 0) continue;
    from.res[k] -= amount;
    to.res[k] += amount;
    out[k] = amount;
  }
  return out;
}

export function lootText(l: Partial<Record<ResKey, number>>): string {
  return costText(l) || 'hech narsa';
}

export function armyPower(s: GameState, fid: number): number {
  const f = s.factions[fid];
  const a = totalArmy(s, fid);
  let p = 0;
  for (const [k, n] of Object.entries(a) as [UnitType, number][]) {
    const d = UNITS[k];
    p += n * Math.sqrt(d.hp * d.atk) * levelMult(f.unitLevels[k]);
  }
  return p;
}

export function score(s: GameState, f: Faction): number {
  const tiles = ownedTiles(s, f.id).length;
  return Math.round(tiles * 10 + armyPower(s, f.id) / 8 + f.res.kumush / 40 + f.wins * 25 + f.coreLevel * 40);
}

export function homeArmyCount(s: GameState): number {
  return armyCount(coreTile(s, s.factions[s.playerId]).garrison);
}
