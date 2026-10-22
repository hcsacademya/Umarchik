// O'yin balansi va kampaniya. Barcha raqamlar shu yerda — o'zgartirish uchun faqat shu faylga qarang.

export type Side = 0 | 1; // 0 = o'yinchi (chapda), 1 = dushman (o'ngda)
export type Kind = 'amir' | 'konchi' | 'qilichli' | 'nayzachi' | 'kamonchi' | 'otliq';
export type Rank = 'oddiy' | 'sarkarda' | 'qomondon';
export type Stance = 'chekinish' | 'tur' | 'hujum';
export type Terrain = 'ormon' | 'kol' | 'ekinzor' | 'tog' | 'yaylov' | 'dasht' | 'chol' | 'shahar';
export type ItemId =
  | 'konchi' | 'qilichli' | 'nayzachi' | 'kamonchi' | 'otliq'
  | 'sarkarda_qilichli' | 'sarkarda_nayzachi' | 'sarkarda_kamonchi' | 'sarkarda_otliq' | 'qomondon';

// ---------- Jang maydoni (o'yin birliklarida) ----------
export const WORLD_W = 2600;
export const CASTLE_X: [number, number] = [170, WORLD_W - 170];
export const CASTLE_FRONT = 115; // qasr markazidan old devorigacha
export const MINE_OFFSET = 370; // kon markazi qasrdan
export const FORMATION_FRONT = 560; // "Joyida tur" safining oldingi qatori qasrdan
export const ROW_GAP = 30;
export const ROW_SIZE = 5;
export const DEPTH = 40; // askarlar 0..40 chuqurlikda turadi

// ---------- Askarlar ----------
export interface Stats {
  name: string;
  hp: number;
  dmg: number;
  range: number;
  cd: number; // zarbalar orasidagi soniya
  speed: number;
  pop: number;
}

export const STATS: Record<Kind, Stats> = {
  amir: { name: 'Amir', hp: 550, dmg: 20, range: 40, cd: 0.8, speed: 82, pop: 0 },
  konchi: { name: 'Konchi', hp: 60, dmg: 0, range: 0, cd: 1, speed: 80, pop: 1 },
  qilichli: { name: 'Qilichli', hp: 110, dmg: 13, range: 36, cd: 0.9, speed: 78, pop: 1 },
  nayzachi: { name: 'Nayzachi', hp: 150, dmg: 12, range: 58, cd: 1.1, speed: 72, pop: 1 },
  kamonchi: { name: 'Kamonchi', hp: 80, dmg: 11, range: 240, cd: 1.4, speed: 74, pop: 1 },
  otliq: { name: 'Otliq', hp: 280, dmg: 22, range: 44, cd: 1.0, speed: 150, pop: 2 },
};

// Kim kimga qarshi qanday (real tarixga yaqin): VS[hujumchi][nishon] — zarba ko'paytmasi.
// Nayzali saf otliqni to'xtatadi, otliq kamonchini bosib ketadi, katta qalqon o'qdan saqlaydi,
// qilichli nayza uchidan o'tib yaqin jangda yengadi. Bitta turni ko'paytirib yutib bo'lmaydi.
export const VS: Partial<Record<Kind, Partial<Record<Kind, number>>>> = {
  qilichli: { nayzachi: 1.4, kamonchi: 1.5, otliq: 0.8 },
  nayzachi: { qilichli: 0.8, otliq: 2.0 },
  kamonchi: { qilichli: 0.7, nayzachi: 1.3 },
  otliq: { qilichli: 1.3, nayzachi: 0.5, kamonchi: 1.8 },
};

export function vsMult(attacker: Kind, target: Kind): number {
  return VS[attacker]?.[target] ?? 1;
}

export const RANK: Record<Rank, { hp: number; dmg: number; scale: number }> = {
  oddiy: { hp: 1, dmg: 1, scale: 1 },
  sarkarda: { hp: 3, dmg: 2, scale: 1.2 },
  qomondon: { hp: 5.5, dmg: 2.4, scale: 1.25 },
};

export interface Item {
  id: ItemId;
  name: string;
  kind: Kind;
  rank: Rank;
  cost: number;
  train: number; // soniya — qimmatrog'i sekinroq tayyorlanadi
  escorts: number; // birga chiqadigan oddiy askarlar
  unlock: number; // nechanchi g'alabadan keyin ochiladi
}

export const ITEMS: Item[] = [
  { id: 'konchi', name: 'Konchi', kind: 'konchi', rank: 'oddiy', cost: 50, train: 2.5, escorts: 0, unlock: 0 },
  { id: 'qilichli', name: 'Qilichli', kind: 'qilichli', rank: 'oddiy', cost: 75, train: 3, escorts: 0, unlock: 0 },
  { id: 'nayzachi', name: 'Nayzachi', kind: 'nayzachi', rank: 'oddiy', cost: 110, train: 4, escorts: 0, unlock: 1 },
  { id: 'kamonchi', name: 'Kamonchi', kind: 'kamonchi', rank: 'oddiy', cost: 130, train: 4, escorts: 0, unlock: 2 },
  { id: 'otliq', name: 'Otliq', kind: 'otliq', rank: 'oddiy', cost: 260, train: 6, escorts: 0, unlock: 3 },
  { id: 'sarkarda_qilichli', name: 'Qilichli sarkarda', kind: 'qilichli', rank: 'sarkarda', cost: 450, train: 9, escorts: 2, unlock: 4 },
  { id: 'sarkarda_nayzachi', name: 'Nayzachi sarkarda', kind: 'nayzachi', rank: 'sarkarda', cost: 550, train: 9, escorts: 2, unlock: 5 },
  { id: 'sarkarda_kamonchi', name: 'Kamonchi sarkarda', kind: 'kamonchi', rank: 'sarkarda', cost: 600, train: 9, escorts: 2, unlock: 6 },
  { id: 'sarkarda_otliq', name: 'Otliq sarkarda', kind: 'otliq', rank: 'sarkarda', cost: 900, train: 11, escorts: 2, unlock: 7 },
  { id: 'qomondon', name: "Qo'mondon", kind: 'otliq', rank: 'qomondon', cost: 1600, train: 14, escorts: 3, unlock: 8 },
];

export function itemOf(id: ItemId): Item {
  return ITEMS.find((x) => x.id === id)!;
}

export const QUEUE_MAX = 10; // bitta umumiy navbatda

// Askar chegarasi (konchi + jangchilar jami): g'alabalar soniga qarab
export function popCap(step: number): number {
  if (step >= 8) return 70; // qo'mondon ochilgach
  if (step >= 3) return 55; // otliq ochilgach
  return 44;
}

// ---------- Iqtisod ----------
export const START_SILVER = 150;
export const MINER_LOAD = 15;
export const MINE_TIME = 1.6;
export const MAX_MINERS = 12;
export const STOCK_CAP = 250; // qasr yonidagi ombor: to'lsa konchilar kutib turadi

// ---------- Qasr ----------
export const CASTLE_HP = 3000;
export const CASTLE_DMG = 14;
export const CASTLE_CD = 1.5;
export const CASTLE_RANGE = 420;
export const FIRE_MULT = 1.5; // olovli o'q qasrga
export const AMIR_RESPAWN = 20;

// ---------- Mukofot ----------
export const SILVER_PER_GOLD = 10;
export function winBonus(level: number): number {
  return 30 + 10 * level;
}

// ---------- Dushman ----------
export function enemyIncome(level: number): number {
  return 1.2 + 0.05 * level;
}
export function enemyStats(level: number): number {
  return 1 + 0.035 * level;
}
export function enemyCastleHp(level: number): number {
  return CASTLE_HP + 250 * level;
}

// Ikki dushman xalqi: ko'rinishi ham, jang uslubi ham boshqa
export type FactionId = 'kochmanchi' | 'sovutli';
export interface Faction {
  name: string;
  desc: string;
  hp: number; // jon ko'paytmasi
  speed: number; // yurish tezligi ko'paytmasi
  arrowTaken: number; // o'qdan oladigan zarar ko'paytmasi
  prefer: Partial<Record<Kind, number>>; // qaysi turni ko'proq yollaydi
}

export const FACTIONS: Record<FactionId, Faction> = {
  kochmanchi: {
    name: "Ko'chmanchilar",
    desc: "Yengil va tez: otliq va kamonchini ko'p chiqaradi",
    hp: 0.85,
    speed: 1.2,
    arrowTaken: 1,
    prefer: { otliq: 2, kamonchi: 1.5 },
  },
  sovutli: {
    name: 'Sovutlilar',
    desc: "Og'ir zirhli: chidamli, o'qdan kam zarar ko'radi, sekin",
    hp: 1.25,
    speed: 0.85,
    arrowTaken: 0.7,
    prefer: { qilichli: 1.5, nayzachi: 1.5 },
  },
};

// Dushman xarakteri: tez — kichik to'lqinlar bilan erta hujum; sabrli — kuch yig'ib katta hujum;
// reyd — otliq/yengil guruh bilan konchilarga hujum qiladi
export type Temper = 'tez' | 'sabrli' | 'reyd';
export const TEMPER_NAME: Record<Temper, string> = {
  tez: 'Shoshqaloq: erta hujum qiladi',
  sabrli: "Sabrli: kuch yig'ib, katta hujum qiladi",
  reyd: 'Reydchi: konchilarga tez-tez hujum qiladi',
};

// Dushman kiyimining rangi (xaritadagi bayroq rangi)
export type ColorId = 'kulrang' | 'qora' | 'qizil' | 'yashil' | 'binafsha' | 'zangori' | 'sariq' | 'kok';
export const COLORS: Record<ColorId, { name: string; hex: string }> = {
  kulrang: { name: 'Kulrang', hex: '#8c8c8c' },
  qora: { name: 'Qora', hex: '#2c2a30' },
  qizil: { name: 'Qizil', hex: '#b3261e' },
  yashil: { name: 'Yashil', hex: '#2e7d32' },
  binafsha: { name: 'Binafsha', hex: '#6a2d8f' },
  zangori: { name: 'Zangori', hex: '#1d8a8a' },
  sariq: { name: 'Sariq', hex: '#d1a116' },
  kok: { name: "Ko'k", hex: '#2346c8' },
};

// ---------- Kuchaytirish (oltinga, doimiy) ----------
// Har jangchi turi alohida kuchayadi; qasr ham alohida
export type UnitUpId = 'amir' | 'konchi' | 'qilichli' | 'nayzachi' | 'kamonchi' | 'otliq';
export type CastleUpId = 'qasr' | 'otish' | 'ombor' | 'kumush';
export type UpgradeId = UnitUpId | CastleUpId;

export interface Upgrade {
  id: UpgradeId;
  name: string;
  group: 'askar' | 'qasr';
  unlock: number; // nechanchi g'alabadan keyin kuchaytirish mumkin
  desc: (lvl: number) => string;
  costs: number[];
}

const BASE_COSTS = [40, 80, 140, 220, 320];
const costs = (k: number) => BASE_COSTS.map((c) => Math.round((c * k) / 5) * 5);

export const UNIT_UP_STEP = 0.1; // har daraja: jon va zarba +10%
export const MINER_UP = { load: 2, speed: 0.06 }; // konchi: har darajada

const fighterDesc = (l: number) => `Jon va zarba +${Math.round(UNIT_UP_STEP * 100 * l)}%`;

export const UPGRADES: Upgrade[] = [
  { id: 'konchi', name: 'Konchi', group: 'askar', unlock: 0, costs: costs(1), desc: (l) => `Savat ${MINER_LOAD + MINER_UP.load * l}, tezlik +${Math.round(MINER_UP.speed * 100 * l)}%` },
  { id: 'amir', name: 'Amir', group: 'askar', unlock: 0, costs: costs(1.3), desc: fighterDesc },
  { id: 'qilichli', name: 'Qilichli', group: 'askar', unlock: 0, costs: costs(1), desc: fighterDesc },
  { id: 'nayzachi', name: 'Nayzachi', group: 'askar', unlock: 1, costs: costs(1.2), desc: fighterDesc },
  { id: 'kamonchi', name: 'Kamonchi', group: 'askar', unlock: 2, costs: costs(1.2), desc: fighterDesc },
  { id: 'otliq', name: 'Otliq', group: 'askar', unlock: 3, costs: costs(1.5), desc: fighterDesc },
  { id: 'qasr', name: 'Qasr mustahkamligi', group: 'qasr', unlock: 0, costs: costs(1), desc: (l) => `${CASTLE_HP + 500 * l} jon` },
  { id: 'otish', name: 'Qasr kamonchilari', group: 'qasr', unlock: 0, costs: costs(1), desc: (l) => `O'q kuchi +${20 * l}%` },
  { id: 'ombor', name: 'Ombor', group: 'qasr', unlock: 0, costs: costs(0.8).slice(0, 3), desc: (l) => `Sig'imi ${STOCK_CAP + 100 * l}` },
  { id: 'kumush', name: "Boshlang'ich kumush", group: 'qasr', unlock: 0, costs: costs(0.6), desc: (l) => `Boshida ${START_SILVER + 50 * l} kumush` },
];

// ---------- Market: tezlatish (oltinga, bitta jangga) ----------
export type BoostId = 'tez_konchi' | 'tez_yollash' | 'jangovar_ruh' | 'tez_qadam';
export interface Boost {
  id: BoostId;
  name: string;
  desc: string;
  cost: number;
}

export const BOOSTS: Boost[] = [
  { id: 'tez_konchi', name: 'Tez konchi', desc: 'Konchilar 30% tez yuradi va qazadi', cost: 30 },
  { id: 'tez_yollash', name: 'Tez yollash', desc: 'Askarlar 25% tez tayyorlanadi', cost: 30 },
  { id: 'jangovar_ruh', name: 'Jangovar ruh', desc: 'Askarlar 20% tez zarba beradi', cost: 40 },
  { id: 'tez_qadam', name: 'Tez qadam', desc: 'Askarlar 15% tez yuradi', cost: 25 },
];

export const BOOST_EFFECT = {
  tez_konchi: 0.3,
  tez_yollash: 0.25,
  jangovar_ruh: 0.2,
  tez_qadam: 0.15,
};

// ---------- Kampaniya: xarita bo'ylab janglar ----------
export interface BattleDef {
  name: string;
  terrain: Terrain;
  castle: string; // rasm: buildings kaliti va indeksi, masalan "qasr_dushman:0"
  ruin?: string; // vayron holati (bo'lsa)
  mine: number; // kon rasmi indeksi
  map: [number, number]; // xaritadagi joyi (rasm o'lchamiga nisbatan 0..1)
  faction: FactionId;
  color: ColorId;
  temper: Temper;
}

export const TERRAIN_NAME: Record<Terrain, string> = {
  ormon: "O'rmon",
  kol: "Ko'l bo'yi",
  ekinzor: 'Ekinzor',
  tog: "Tog'",
  yaylov: 'Yaylov',
  dasht: 'Dasht',
  chol: "Cho'l",
  shahar: 'Poytaxt',
};

// Yo'l g'arbdagi o'rmondan boshlanib, xarita chetidan soat mili bo'ylab aylanadi va markazdagi ikki poytaxtda tugaydi.
// Dushman xalqi navbatma-navbat almashadi, rangi — xaritadagi o'sha qal'a bayrog'ining rangi.
export const BATTLES: BattleDef[] = [
  { name: "G'arbiy o'rmon qal'asi", terrain: 'ormon', castle: 'qasr_dushman:0', mine: 1, map: [0.2, 0.27], faction: 'kochmanchi', color: 'kulrang', temper: 'sabrli' },
  { name: "G'arbiy tog' koni", terrain: 'tog', castle: 'qasr_dushman:3', mine: 2, map: [0.262, 0.12], faction: 'sovutli', color: 'qora', temper: 'sabrli' },
  { name: "Shimoliy dalalar qal'asi", terrain: 'ekinzor', castle: 'qasr_dushman:2', mine: 0, map: [0.42, 0.22], faction: 'kochmanchi', color: 'qizil', temper: 'tez' },
  { name: "Yashil bayroqli qal'a", terrain: 'yaylov', castle: 'qasr_dushman:4', mine: 0, map: [0.617, 0.22], faction: 'sovutli', color: 'yashil', temper: 'sabrli' },
  { name: "Sharqiy tog' koni", terrain: 'tog', castle: 'qasr_dushman:3', mine: 2, map: [0.797, 0.13], faction: 'kochmanchi', color: 'qora', temper: 'reyd' },
  { name: "Binafsha bayroqli qal'a", terrain: 'yaylov', castle: 'qasr_dushman:3', mine: 0, map: [0.797, 0.285], faction: 'sovutli', color: 'binafsha', temper: 'tez' },
  { name: "Ot yaylovi qal'asi", terrain: 'dasht', castle: 'qasr_dushman:4', mine: 0, map: [0.914, 0.52], faction: 'kochmanchi', color: 'zangori', temper: 'reyd' },
  { name: "Sariq bayroqli qal'a", terrain: 'chol', castle: 'qasr_dushman:5', mine: 3, map: [0.867, 0.81], faction: 'sovutli', color: 'sariq', temper: 'sabrli' },
  { name: "Cho'l vohasi", terrain: 'chol', castle: 'qasr_dushman:5', mine: 3, map: [0.738, 0.71], faction: 'kochmanchi', color: 'qizil', temper: 'tez' },
  { name: "Janubiy qora qal'a", terrain: 'ekinzor', castle: 'qasr_dushman:0', mine: 0, map: [0.447, 0.77], faction: 'sovutli', color: 'qora', temper: 'sabrli' },
  { name: 'Orol bandargohi', terrain: 'kol', castle: 'qasr_dushman:1', mine: 0, map: [0.215, 0.64], faction: 'kochmanchi', color: 'zangori', temper: 'reyd' },
  { name: "Ko'l bo'yi qal'asi", terrain: 'kol', castle: 'qasr_dushman:1', mine: 1, map: [0.18, 0.49], faction: 'sovutli', color: 'kok', temper: 'tez' },
  { name: "Qizil bayroqli qal'a", terrain: 'ekinzor', castle: 'qasr_dushman:2', mine: 0, map: [0.393, 0.63], faction: 'kochmanchi', color: 'qizil', temper: 'reyd' },
  { name: 'Qizil tomli poytaxt', terrain: 'shahar', castle: 'shahar:0', ruin: 'shahar:2', mine: 0, map: [0.383, 0.45], faction: 'sovutli', color: 'qizil', temper: 'sabrli' },
  { name: "Ko'k gumbazli poytaxt", terrain: 'shahar', castle: 'shahar:1', ruin: 'shahar:3', mine: 0, map: [0.648, 0.43], faction: 'sovutli', color: 'kok', temper: 'tez' },
];
