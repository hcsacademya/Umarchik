// Kampaniya holati: g'alabalar, oltin, kuchaytirishlar. Brauzer xotirasida saqlanadi.
import { BATTLES, ITEMS, SILVER_PER_GOLD, UPGRADES, winBonus } from './config.ts';
import type { ItemId, Kind, Side, UpgradeId } from './config.ts';

export interface Save {
  won: number; // nechta jang yutilgan (keyingi jang indeksi ham shu)
  gold: number;
  up: Record<UpgradeId, number>;
}

const KEY = 'umar-save-v1';

export function newSave(): Save {
  return { won: 0, gold: 0, up: { qasr: 0, otish: 0, savat: 0, askar: 0, kumush: 0, ombor: 0 } };
}

export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    return { ...newSave(), ...s, up: { ...newSave().up, ...s.up } };
  } catch {
    return null;
  }
}

export function writeSave(s: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // xotira yopiq bo'lsa ham o'yin ishlayveradi
  }
}

export function campaignDone(s: Save): boolean {
  return s.won >= BATTLES.length;
}

// Dushman doim bir pog'ona oldinda
export function stepFor(side: Side, level: number): number {
  return side === 0 ? level : level + 1;
}

export function itemsFor(step: number): ItemId[] {
  return ITEMS.filter((it) => it.unlock <= step).map((it) => it.id);
}

// Jang boshidagi qo'shin. O'yinchida Amir bor, dushmanda yo'q.
export function startForce(side: Side, level: number): Kind[] {
  const step = stepFor(side, level);
  const out: Kind[] = side === 0 ? ['amir', 'konchi', 'konchi'] : ['konchi', 'konchi'];
  if (step >= 1) out.push('qilichli', 'qilichli');
  if (step >= 2) out.push('nayzachi', 'nayzachi');
  if (step >= 3) out.push('kamonchi', 'kamonchi');
  return out;
}

export function upgradeCost(s: Save, id: UpgradeId): number | null {
  const u = UPGRADES.find((x) => x.id === id)!;
  const lvl = s.up[id];
  return lvl < u.costs.length ? u.costs[lvl] : null;
}

export function buyUpgrade(s: Save, id: UpgradeId): boolean {
  const cost = upgradeCost(s, id);
  if (cost === null || s.gold < cost) return false;
  s.gold -= cost;
  s.up[id]++;
  writeSave(s);
  return true;
}

export interface Reward {
  silver: number;
  fromSilver: number;
  bonus: number;
  total: number;
  unlocked: string | null;
}

// G'alabada: kumush 10:1 oltinga + bonus. Mag'lubiyatda: faqat kumushning yarmi.
export function finishBattle(s: Save, level: number, won: boolean, silver: number): Reward {
  const fromSilver = Math.floor(silver / SILVER_PER_GOLD);
  const bonus = won ? winBonus(level) : 0;
  const total = won ? fromSilver + bonus : Math.floor(fromSilver / 2);
  s.gold += total;
  let unlocked: string | null = null;
  if (won && level === s.won) {
    s.won++;
    const it = ITEMS.find((x) => x.unlock === s.won);
    unlocked = it ? it.name : null;
  }
  writeSave(s);
  return { silver, fromSilver, bonus, total, unlocked };
}
