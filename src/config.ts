import mapData from './world/mapData.json';
import type { BuildingType, Goods, ResKey, Resources, Terrain, UnitCat, UnitType, WorkerType, Zone } from './types';

/**
 * Barcha balans raqamlari shu yerda. Hujjatdagi "aniq raqamlar" ochiq savol,
 * shuning uchun bular boshlang'ich taxminlar — bemalol o'zgartiring.
 */
export const GAME = {
  /** Xarita to'ri umumiy xarita rasmidan yasalgan (tools/build_map.py). */
  mapW: mapData.grid.n,
  mapH: mapData.grid.n,
  /** 1x tezlikda bir o'yin kuni necha soniya. */
  dayLengthSec: 60,
  /** Yangi o'yinchi dastlabki kunlari hujumdan himoyalangan. */
  protectionDays: 5,
  /** Mag'lubiyatdan keyin dam (kun). */
  restAfterDefeatDays: 1,
  /** Jangdan keyin ishxonani egallash taymeri (kun). */
  captureDays: 0.4,
  /** Jang davomiyligi (soniya) — tugasa mudofaachi yutadi. */
  battleTimeSec: 240,
  /** Jang boshlangach chekinish taqiqlangan vaqt (soniya). */
  retreatLockSec: 60,
  /** G'olib oladigan resurs ulushi. */
  lootMin: 0.2,
  lootMax: 0.3,
  maxAiStates: 11,
  autosaveDays: 1,
};

export const START = {
  res: { kumush: 260, bronza: 160, don: 60, qoy: 4 } as Resources,
  workers: { dehqon: 3, chopon: 2, konchi: 4 } as Record<WorkerType, number>,
  army: { piyoda: 4, amir: 1 } as Partial<Record<UnitType, number>>,
};

export const NAMES = {
  empireA: 'Rumiya',
  empireB: 'Parsiya',
  aiStates: [
    'Oqtepa', 'Qorasuv', 'Ko\'ksaroy', 'Bo\'ztepa', 'Sayxun', 'Olmazor',
    'Yashilobod', 'Tillako\'l', 'Qumtepa', 'Shamolsoy', 'Toshqo\'rg\'on', 'Arpaobod',
  ],
};

export const FACTION_COLORS = {
  player: '#2f7fd8',
  empireA: '#b3262d',
  empireB: '#7b3fb0',
  ai: ['#d98a1f', '#2e9e5b', '#c9478f', '#1fa3a3', '#8a6d3b', '#6a7f2a', '#d04f2a', '#4b5fbf', '#9b9b2a', '#7a4a7a', '#3a8f8f', '#a0522d'],
};

export const TERRAIN_INFO: Record<Terrain, { name: string; color: string; passable: boolean; desc: string }> = {
  tekislik: { name: 'Tekislik', color: '#9cba62', passable: true, desc: 'Dehqonchilik va chorva uchun yaxshi' },
  unumdor: { name: 'Unumdor yer', color: '#6f9e45', passable: true, desc: 'Bug\'doy uchun eng yaxshi' },
  vodiy: { name: 'Vodiy', color: '#a8c96e', passable: true, desc: 'Ekin va chorva' },
  yaylov: { name: 'Yaylov', color: '#bcc66a', passable: true, desc: 'Qo\'y boqish uchun eng yaxshi' },
  orman: { name: 'O\'rmon', color: '#4f7a3a', passable: true, desc: 'Kamonchilarga qarshi pana' },
  tog: { name: 'Tog\'', color: '#9a8a72', passable: true, desc: 'Kumush konlari, himoya ustunligi' },
  qorli_tog: { name: 'Qorli tog\'', color: '#b9b6b0', passable: true, desc: 'Boy kumush konlari, yurish qiyin' },
  chol: { name: 'Cho\'l', color: '#dcc58a', passable: true, desc: 'Kambag\'al yer, arpa o\'sadi' },
  daryo: { name: 'Daryo', color: '#4e8fc4', passable: true, desc: 'Kechuv: qo\'shin sekinlashadi' },
  kol: { name: 'Ko\'l', color: '#3a73aa', passable: false, desc: 'O\'tib bo\'lmaydi' },
  tashqi: { name: 'Jarlik', color: '#3b3127', passable: false, desc: 'Xarita chegarasi' },
};

export function impassable(t: { terrain: Terrain }): boolean {
  return !TERRAIN_INFO[t.terrain].passable;
}

export const ZONE_INFO: Record<Zone, { name: string; landPrice: number; garrison: number }> = {
  chet: { name: 'Chet', landPrice: 40, garrison: 6 },
  orta: { name: 'O\'rta', landPrice: 110, garrison: 11 },
  markaz: { name: 'Markaz', landPrice: 350, garrison: 22 },
};

export const RES_INFO: Record<ResKey, { name: string; icon: string }> = {
  kumush: { name: 'Kumush', icon: '◈' },
  bronza: { name: 'Bronza', icon: '●' },
  don: { name: 'Don', icon: '🌾' },
  qoy: { name: 'Qo\'y', icon: '🐑' },
};

export const WORKER_INFO: Record<WorkerType, { name: string; plural: string; hireCost: number }> = {
  dehqon: { name: 'Dehqon', plural: 'Dehqonlar', hireCost: 20 },
  chopon: { name: 'Cho\'pon', plural: 'Cho\'ponlar', hireCost: 20 },
  konchi: { name: 'Konchi', plural: 'Konchilar', hireCost: 30 },
};

/** Qaysi binoda qaysi ishchi ishlaydi. */
const WORKPLACE: Partial<Record<BuildingType, WorkerType>> = { farm: 'dehqon', bog: 'dehqon', pasture: 'chopon', mine: 'konchi' };
export function workerFor(b: BuildingType): WorkerType | null {
  return WORKPLACE[b] ?? null;
}

export interface UnitDef {
  name: string;
  cat: UnitCat;
  hp: number;
  atk: number;
  def: number;
  /** Jang maydonida px/soniya. */
  speed: number;
  range: number;
  cooldown: number;
  costBronza: number;
  costKumush: number;
  wage: number;
  food: number;
  hero: boolean;
  /** Xaritada kuniga plita. */
  march: number;
  /** Mashg'ulot maydoni darajasi talabi (0 = oddiy yo'l bilan sotib olinmaydi). */
  barracks: number;
}

export const UNITS: Record<UnitType, UnitDef> = {
  piyoda: { name: 'Piyoda', cat: 'piyoda', hp: 100, atk: 10, def: 4, speed: 40, range: 16, cooldown: 1.0, costBronza: 30, costKumush: 0, wage: 1, food: 1, hero: false, march: 6, barracks: 1 },
  kamonchi: { name: 'Kamonchi', cat: 'kamonchi', hp: 70, atk: 9, def: 2, speed: 42, range: 170, cooldown: 1.5, costBronza: 40, costKumush: 6, wage: 1.5, food: 1, hero: false, march: 6, barracks: 2 },
  nayzachi: { name: 'Nayzachi', cat: 'nayzachi', hp: 110, atk: 11, def: 6, speed: 36, range: 22, cooldown: 1.1, costBronza: 45, costKumush: 8, wage: 1.5, food: 1, hero: false, march: 6, barracks: 3 },
  otliq: { name: 'Otliq', cat: 'otliq', hp: 150, atk: 14, def: 5, speed: 80, range: 18, cooldown: 1.0, costBronza: 80, costKumush: 20, wage: 3, food: 2, hero: false, march: 10, barracks: 3 },
  zirhli_otliq: { name: 'Zirhli otliq', cat: 'otliq', hp: 230, atk: 18, def: 11, speed: 68, range: 18, cooldown: 1.0, costBronza: 140, costKumush: 45, wage: 5, food: 2, hero: false, march: 8, barracks: 0 },
  zirhli_nayzachi: { name: 'Zirhli nayzachi', cat: 'nayzachi', hp: 180, atk: 14, def: 12, speed: 32, range: 22, cooldown: 1.1, costBronza: 90, costKumush: 25, wage: 3, food: 1, hero: false, march: 5, barracks: 0 },
  amir: { name: 'Amir', cat: 'otliq', hp: 420, atk: 26, def: 13, speed: 72, range: 18, cooldown: 0.9, costBronza: 0, costKumush: 0, wage: 0, food: 2, hero: true, march: 10, barracks: 0 },
  qomondon: { name: 'Qo\'mondon', cat: 'otliq', hp: 380, atk: 24, def: 13, speed: 70, range: 18, cooldown: 0.9, costBronza: 300, costKumush: 200, wage: 8, food: 2, hero: true, march: 8, barracks: 0 },
  sarkarda_otliq: { name: 'Otliq sarkarda', cat: 'otliq', hp: 360, atk: 24, def: 12, speed: 74, range: 18, cooldown: 0.9, costBronza: 400, costKumush: 300, wage: 10, food: 2, hero: true, march: 10, barracks: 0 },
  sarkarda_nayzachi: { name: 'Nayzachi sarkarda', cat: 'nayzachi', hp: 360, atk: 22, def: 15, speed: 40, range: 24, cooldown: 1.0, costBronza: 400, costKumush: 300, wage: 10, food: 2, hero: true, march: 6, barracks: 0 },
  sarkarda_kamonchi: { name: 'Kamonchi sarkarda', cat: 'kamonchi', hp: 300, atk: 22, def: 9, speed: 46, range: 200, cooldown: 1.2, costBronza: 400, costKumush: 300, wage: 10, food: 2, hero: true, march: 6, barracks: 0 },
  sarkarda_piyoda: { name: 'Piyoda sarkarda', cat: 'piyoda', hp: 400, atk: 24, def: 14, speed: 44, range: 18, cooldown: 0.9, costBronza: 400, costKumush: 300, wage: 10, food: 2, hero: true, march: 6, barracks: 0 },
};

export const BASIC_UNITS: UnitType[] = ['piyoda', 'kamonchi', 'nayzachi', 'otliq'];
export const ALL_UNITS = Object.keys(UNITS) as UnitType[];
export const SARKARDA_UNITS: UnitType[] = ['sarkarda_otliq', 'sarkarda_nayzachi', 'sarkarda_kamonchi', 'sarkarda_piyoda'];
/** Sarkarda bilan keladigan maxsus guruh. */
export const SARKARDA_SQUAD: Record<string, { type: UnitType; count: number }> = {
  sarkarda_otliq: { type: 'otliq', count: 12 },
  sarkarda_nayzachi: { type: 'nayzachi', count: 12 },
  sarkarda_kamonchi: { type: 'kamonchi', count: 12 },
  sarkarda_piyoda: { type: 'piyoda', count: 12 },
};

/** Kim kimga kuchli: nayzachi otliqqa, otliq kamonchiga, kamonchi piyodaga. */
export const COUNTERS: Partial<Record<UnitCat, UnitCat>> = {
  nayzachi: 'otliq',
  otliq: 'kamonchi',
  kamonchi: 'piyoda',
};
export const COUNTER_MULT = 1.5;

export const UNLOCK = {
  qomondon: { coreLevel: 3, kumush: 1500, wins: 5 },
  sarkarda: { coreLevel: 4, kumush: 3000, wins: 12 },
  /** Qo'mondon guruhi: 1 qo'mondon, 4 zirhli otliq, 10 zirhli nayzachi. */
  commanderSquad: { zirhli_otliq: 4, zirhli_nayzachi: 10 },
};

/** Yadro qarorgoh 4 bosqichi. */
export const CORE_LEVELS = [
  { name: 'Tosh qal\'acha-uycha', maxTiles: 8, maxWorkers: 14, maxSoldiers: 24, costKumush: 0, costBronza: 0 },
  { name: 'Minorali uy', maxTiles: 14, maxWorkers: 24, maxSoldiers: 50, costKumush: 450, costBronza: 150 },
  { name: 'Ikki minorali qo\'rg\'on', maxTiles: 22, maxWorkers: 36, maxSoldiers: 90, costKumush: 1300, costBronza: 400 },
  { name: 'Kichik qal\'a', maxTiles: 34, maxWorkers: 52, maxSoldiers: 150, costKumush: 3200, costBronza: 900 },
];

export const MAX_UPGRADE_LEVEL = 10;
export function upgradeCost(level: number, hero = false): number {
  return Math.round((hero ? 80 : 35) * Math.pow(level, 1.7));
}
/** Daraja oshgan sari ishlash/jang ko'rsatkichi. */
export function levelMult(level: number): number {
  return 1 + 0.08 * (level - 1);
}
/** Ko'rinish 4 bosqichda: 1-3, 4-6, 7-9, 10. */
export function visualTier(level: number): number {
  if (level >= 10) return 4;
  if (level >= 7) return 3;
  if (level >= 4) return 2;
  return 1;
}

export interface BuildingDef {
  name: string;
  costKumush: number;
  maxLevel: number;
  allowed: Terrain[] | null;
  needsDeposit?: boolean;
  desc: string;
}

export const BUILDINGS: Record<Exclude<BuildingType, 'none' | 'core' | 'city'>, BuildingDef> = {
  farm: { name: 'Ekinzor', costKumush: 25, maxLevel: 5, allowed: ['tekislik', 'unumdor', 'vodiy', 'yaylov', 'chol'], desc: 'Dehqonlar don yetishtiradi' },
  bog: { name: 'Bog\'', costKumush: 45, maxLevel: 5, allowed: ['tekislik', 'unumdor', 'vodiy'], desc: 'Devorli mevali bog\': dehqonlar ekinzordan ko\'proq oziq-ovqat oladi' },
  pasture: { name: 'Yaylov (qo\'ra)', costKumush: 25, maxLevel: 5, allowed: ['tekislik', 'vodiy', 'yaylov', 'chol', 'unumdor'], desc: 'Cho\'ponlar qo\'y boqadi' },
  mine: { name: 'Kon', costKumush: 45, maxLevel: 5, allowed: ['tog', 'qorli_tog'], needsDeposit: false, desc: 'Konchilar kumush qazadi (tog\' yoki kon joyi)' },
  tower: { name: 'Kuzatuv minorasi', costKumush: 70, maxLevel: 5, allowed: null, desc: 'Hujum haqida ertaroq va aniqroq xabar' },
  fort: { name: 'Devor va qal\'a', costKumush: 120, maxLevel: 5, allowed: null, desc: 'Jangda devor, garnizonga himoya ustunligi' },
};

export function buildingUpgradeCost(def: BuildingDef, level: number): number {
  return Math.round(def.costKumush * (0.8 + level * 0.9));
}

export const FACTION_UPGRADES = {
  barracks: { name: 'Mashg\'ulot maydoni', max: 5, cost: (l: number) => Math.round(90 * Math.pow(l, 1.8)), desc: 'Yangi askar turlarini ochadi (2: kamonchi, 3: nayzachi va otliq)' },
  ombor: { name: 'Ombor', max: 5, cost: (l: number) => Math.round(70 * Math.pow(l, 1.8)), desc: 'Talondan saqlanadigan ulush va buzilishni kamaytiradi' },
  spy: { name: 'Ayg\'oqchilar', max: 5, cost: (l: number) => Math.round(80 * Math.pow(l, 1.8)), desc: 'Dushman qo\'shini haqida erta va aniq xabar' },
};

/** Bozor: AI davlatlar xaridor. */
export const MARKET = {
  base: { don: 0.7, qoy: 7, kumush: 1.3 } as Record<Goods, number>,
  /** Bitta birlik sotilganda to'yinish qancha oshadi (xaridorlar soniga bo'linadi). */
  satPerUnit: { don: 0.0016, qoy: 0.012, kumush: 0.0012 } as Record<Goods, number>,
  buyMarkup: 1.7,
  recoverPerDay: 0.35,
};

export const ECON = {
  farmRate: 5,
  pastureRate: 1.4,
  mineRate: 3,
  workerFood: 1,
  tileTax: 1,
  repairPerLevel: 0.5,
  donDecay: 0.02,
  qoyFoodValue: 4,
};

export function workersCapacity(level: number): number {
  return 3 + level;
}

export function omborProtect(level: number): number {
  return 0.1 + 0.12 * (level - 1);
}
