import { ALL_UNITS, COUNTERS, COUNTER_MULT, UNITS, levelMult } from '../config';
import type { Army, Faction, Tile, UnitCat, UnitType } from '../types';
import { armyCount, armyEntries } from '../util';

/**
 * Tomonning umumiy ko'paytuvchisi: ochlik, AI "hujumda kuchsiz, himoyada kuchli",
 * relyef va devor ustunligi.
 */
export function sideMult(f: Faction, role: 'att' | 'def', tile: Tile, includeWall: boolean): number {
  let m = 1 - Math.min(0.5, 0.1 * f.starving);
  if (f.kind === 'ai') m *= role === 'att' ? 0.85 : 1.25;
  if (f.kind === 'empire') m *= role === 'att' ? 1.0 : 1.3;
  if (role === 'def') {
    if (tile.terrain === 'tog' || tile.terrain === 'qorli_tog') m *= 1.15;
    else if (tile.terrain === 'orman') m *= 1.08;
    if (includeWall) m *= wallBonus(tile);
  }
  return m;
}

export function wallBonus(tile: Tile): number {
  if (tile.building === 'fort') return 1 + 0.1 * tile.level;
  if (tile.building === 'core') return 1 + 0.08 * tile.level;
  if (tile.building === 'city') return 1.2;
  return 1;
}

export function hasWall(tile: Tile): boolean {
  return tile.building === 'fort' || tile.building === 'core' || tile.building === 'city';
}

export function counterMult(att: UnitCat, def: UnitCat): number {
  if (COUNTERS[att] === def) return COUNTER_MULT;
  if (COUNTERS[def] === att) return 1 / 1.25;
  return 1;
}

function catFractions(a: Army): Record<UnitCat, number> {
  const out: Record<UnitCat, number> = { piyoda: 0, kamonchi: 0, nayzachi: 0, otliq: 0 };
  const total = armyCount(a) || 1;
  for (const [k, n] of armyEntries(a)) out[UNITS[k].cat] += n / total;
  return out;
}

export function armyStrength(a: Army, f: Faction, vs: Army | null, mult = 1): number {
  const fr = vs ? catFractions(vs) : null;
  let p = 0;
  let heroes = 0;
  for (const [k, n] of armyEntries(a)) {
    const d = UNITS[k];
    if (d.hero) heroes++;
    let e = Math.sqrt(d.hp * d.atk) * levelMult(f.unitLevels[k]);
    if (fr) {
      let c = 1;
      for (const cat of Object.keys(fr) as UnitCat[]) c += (counterMult(d.cat, cat) - 1) * fr[cat];
      e *= c;
    }
    p += e * n;
  }
  return p * mult * (1 + Math.min(0.2, heroes * 0.07));
}

export interface QuickResult {
  attWin: boolean;
  attLeft: Army;
  defLeft: Army;
  attLost: number;
  defLost: number;
  heroesLost: UnitType[];
}

function applyLoss(a: Army, frac: number, rnd: () => number, heroesLost: UnitType[]): Army {
  const out: Army = {};
  for (const [k, n] of armyEntries(a)) {
    if (UNITS[k].hero) {
      if (frac < 0.85 || rnd() < 0.5) out[k] = n;
      else heroesLost.push(k);
      continue;
    }
    const left = Math.max(0, Math.round(n * (1 - frac) + (rnd() - 0.5) * 0.8));
    if (left > 0) out[k] = left;
  }
  return out;
}

/** Tez hisob (avto-jang, AI va AI o'rtasidagi janglar). Teng bo'lsa mudofaachi yutadi. */
export function quickResolve(
  attF: Faction,
  attArmy: Army,
  defF: Faction,
  defArmy: Army,
  tile: Tile,
  rnd: () => number,
): QuickResult {
  const heroesLost: UnitType[] = [];
  const attN = armyCount(attArmy);
  const defN = armyCount(defArmy);
  if (defN === 0) return { attWin: attN > 0, attLeft: { ...attArmy }, defLeft: {}, attLost: 0, defLost: 0, heroesLost };
  if (attN === 0) return { attWin: false, attLeft: {}, defLeft: { ...defArmy }, attLost: 0, defLost: 0, heroesLost };
  const pa = armyStrength(attArmy, attF, defArmy, sideMult(attF, 'att', tile, false)) * (0.9 + rnd() * 0.2);
  const pd = armyStrength(defArmy, defF, attArmy, sideMult(defF, 'def', tile, hasWall(tile))) * (0.9 + rnd() * 0.2);
  const attWin = pa > pd;
  const ratio = attWin ? pd / pa : pa / pd;
  const winnerLoss = Math.min(0.92, Math.pow(ratio, 1.4) * 0.85 + 0.03);
  const loserLoss = 0.65 + rnd() * 0.25;
  const attLeft = applyLoss(attArmy, attWin ? winnerLoss : loserLoss, rnd, heroesLost);
  const defLeft = applyLoss(defArmy, attWin ? loserLoss : winnerLoss, rnd, heroesLost);
  return {
    attWin,
    attLeft,
    defLeft,
    attLost: attN - armyCount(attLeft),
    defLost: defN - armyCount(defLeft),
    heroesLost,
  };
}

export function armyDiff(before: Army, after: Army): Army {
  const out: Army = {};
  for (const k of ALL_UNITS) {
    const d = (before[k] ?? 0) - (after[k] ?? 0);
    if (d > 0) out[k] = d;
  }
  return out;
}
