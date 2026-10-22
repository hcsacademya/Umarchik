// Kampaniya holati: g'alabalar, oltin, kuchaytirishlar, Market tezlatishlari.
// Telegram ichida — Telegram bulutida, aks holda brauzer xotirasida saqlanadi.
import { BATTLES, BOOSTS, ITEMS, SILVER_PER_GOLD, UPGRADES, winBonus } from './config.ts';
import type { BoostId, ItemId, Kind, Side, UpgradeId } from './config.ts';
import { cloudGet, cloudSet } from './telegram.ts';

export interface Save {
  won: number; // nechta jang yutilgan (keyingi jang indeksi ham shu)
  gold: number;
  up: Record<UpgradeId, number>;
  boosts: Record<BoostId, number>; // sotib olingan, keyingi jangda ishlatiladigan tezlatishlar
}

const KEY = 'umar-save-v2';
const OLD_KEY = 'umar-save-v1';

export function newSave(): Save {
  const up = {} as Record<UpgradeId, number>;
  for (const u of UPGRADES) up[u.id] = 0;
  const boosts = {} as Record<BoostId, number>;
  for (const b of BOOSTS) boosts[b.id] = 0;
  return { won: 0, gold: 0, up, boosts };
}

function parse(raw: string | null): Save | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<Save>;
    const base = newSave();
    const up = { ...base.up, ...s.up } as Record<string, number>;
    // "Ombor" kuchaytirishi "Kon tezligi"ga almashdi: darajasi saqlanadi
    if (up.ombor && !up.qazish) up.qazish = up.ombor;
    delete up.ombor;
    return { ...base, ...s, up: up as Save['up'], boosts: { ...base.boosts, ...s.boosts } };
  } catch {
    return null;
  }
}

// 1-versiyadagi umumiy kuchaytirishlarni yangisiga o'tkazish
function migrate(raw: string | null): Save | null {
  if (!raw) return null;
  try {
    const old = JSON.parse(raw) as { won: number; gold: number; up: Record<string, number> };
    const s = newSave();
    s.won = old.won ?? 0;
    s.gold = old.gold ?? 0;
    const u = old.up ?? {};
    s.up.qasr = u.qasr ?? 0;
    s.up.otish = u.otish ?? 0;
    s.up.qazish = u.ombor ?? 0;
    s.up.kumush = u.kumush ?? 0;
    s.up.konchi = u.savat ?? 0;
    for (const k of ['amir', 'qilichli', 'nayzachi', 'kamonchi', 'otliq'] as const) s.up[k] = u.askar ?? 0;
    return s;
  } catch {
    return null;
  }
}

function localGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function loadSave(): Promise<Save | null> {
  const cloud = parse(await cloudGet(KEY));
  if (cloud) return cloud;
  return parse(localGet(KEY)) ?? migrate(localGet(OLD_KEY));
}

export function writeSave(s: Save): void {
  const raw = JSON.stringify(s);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // xotira yopiq bo'lsa ham o'yin ishlayveradi
  }
  cloudSet(KEY, raw);
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

// ---------- Kuchaytirish ----------

export function upgradeCost(s: Save, id: UpgradeId): number | null {
  const u = UPGRADES.find((x) => x.id === id)!;
  const lvl = s.up[id];
  return lvl < u.costs.length ? u.costs[lvl] : null;
}

export function upgradeOpen(s: Save, id: UpgradeId): boolean {
  return UPGRADES.find((x) => x.id === id)!.unlock <= s.won;
}

export function buyUpgrade(s: Save, id: UpgradeId): boolean {
  const cost = upgradeCost(s, id);
  if (cost === null || s.gold < cost || !upgradeOpen(s, id)) return false;
  s.gold -= cost;
  s.up[id]++;
  writeSave(s);
  return true;
}

// ---------- Market ----------

export function buyBoost(s: Save, id: BoostId): boolean {
  const b = BOOSTS.find((x) => x.id === id)!;
  if (s.gold < b.cost) return false;
  s.gold -= b.cost;
  s.boosts[id]++;
  writeSave(s);
  return true;
}

// Jang boshlanganda: har bir sotib olingan tezlatishdan bittasi ishlatiladi
export function takeBoosts(s: Save): BoostId[] {
  const out: BoostId[] = [];
  for (const b of BOOSTS) {
    if (s.boosts[b.id] > 0) {
      s.boosts[b.id]--;
      out.push(b.id);
    }
  }
  if (out.length) writeSave(s);
  return out;
}

// ---------- Jang natijasi ----------

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
