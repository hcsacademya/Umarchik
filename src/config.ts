// O'yin balansi va kampaniya. Barcha raqamlar shu yerda — o'zgartirish uchun faqat shu faylga qarang.

export type Side = 0 | 1; // 0 = o'yinchi (chapda), 1 = dushman (o'ngda)
export type Kind = 'amir' | 'konchi' | 'qilichli' | 'nayzachi' | 'kamonchi' | 'otliq';
export type Rank = 'oddiy' | 'sarkarda' | 'qomondon';
export type Stance = 'chekinish' | 'tur' | 'hujum';
export type Terrain = 'ormon' | 'kol' | 'ekinzor' | 'tog' | 'yaylov' | 'dasht' | 'chol' | 'shahar';
export type ItemId =
  | 'konchi' | 'qilichli' | 'nayzachi' | 'kamonchi' | 'otliq'
  | 'sarkarda_qilichli' | 'sarkarda_nayzachi' | 'sarkarda_kamonchi' | 'sarkarda_otliq' | 'qomondon';

// ---------- Jang maydoni (o'yin birliklarida; ekran balandligi 560 birlik) ----------
export const WORLD_W = 2500;
// Yaxlit tayanch (qal'a devori + darvoza + kon) chap chetda. CASTLE_X — darvoza; devor undan orqaga ketadi
export const CASTLE_X: [number, number] = [300, WORLD_W - 300];
export const CASTLE_FRONT = 70; // darvozadan darvoza minorasining old chetigacha
export const CASTLE_DEPTH = 300; // darvozadan qal'a devori orqaga qancha cho'ziladi
export const MINE_OFFSET = 200; // kon og'zi darvozadan (tayanch rasmidagi joyi bilan bir xil)
export const FORMATION_FRONT = 640; // "Joyida tur" safining oldingi qatori darvozadan
export const DEFENSIVE_FRONT = 300; // dushman himoyada: qasr o'qlari yetadigan joyda saf tortadi
export const COL_GAP = 26; // saf blokida ustunlar orasidagi masofa
export const BLOCK_GAP = 34; // bloklar (turlar) orasidagi qo'shimcha oraliq
export const ROW_SIZE = 4; // bir ustunda (chuqurlik bo'yicha) nechta askar
export const DEPTH = 56; // askarlar 0..56 chuqurlikda turadi
export const DOOR_TIME = 0.55; // darvoza yoki konga kirib-chiqish (soniya)

// Devor tepasidagi kamonchilar joyi: [darvozadan jang maydoni tomonga masofa, o'q chiqadigan balandlik].
// 0–2: darvoza ustida, 3–5: chap devorda. 0-joyda doim qasrning o'z kamonchisi turadi
export const WALL_SPOTS: [number, number][] = [
  [0, 200], [-26, 200], [26, 200], [-150, 165], [-185, 165], [-220, 165],
];

export const DEAD_LINGER = 5; // o'lgan askar yerda necha soniya yotadi
export const HEAL_RATE = 0.05; // qasr ichida soniyasiga jonning shuncha ulushi tiklanadi

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
  // Kuch nisbati: 1 Amir ≈ 5 qilichli ≈ 4 nayzachi ≈ 3 otliq ≈ 6 kamonchi (tools/duel.ts bilan tekshiriladi)
  amir: { name: 'Amir', hp: 940, dmg: 22, range: 34, cd: 0.7, speed: 70, pop: 0 },
  konchi: { name: 'Konchi', hp: 60, dmg: 0, range: 0, cd: 1, speed: 68, pop: 1 },
  qilichli: { name: 'Qilichli', hp: 107, dmg: 13, range: 30, cd: 0.9, speed: 66, pop: 1 },
  nayzachi: { name: 'Nayzachi', hp: 190, dmg: 13.5, range: 46, cd: 1.1, speed: 61, pop: 1 },
  kamonchi: { name: 'Kamonchi', hp: 95, dmg: 13.8, range: 220, cd: 1.4, speed: 63, pop: 1 },
  otliq: { name: 'Otliq', hp: 232, dmg: 18, range: 40, cd: 1.0, speed: 125, pop: 2 },
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
  sarkarda: { hp: 3, dmg: 2, scale: 1.08 }, // o'z bezakli rasmi bor: haqiqiy odam kattaligiga yaqin
  qomondon: { hp: 5.5, dmg: 2.4, scale: 1.1 },
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
export const SPECIAL_MAX = 4; // sarkarda va qo'mondon: har biridan bir jangda shuncha

// Askar chegarasi (konchi + jangchilar jami): g'alabalar soniga qarab
export function popCap(step: number): number {
  if (step >= 8) return 70; // qo'mondon ochilgach
  if (step >= 3) return 55; // otliq ochilgach
  return 44;
}

// ---------- Iqtisod ----------
export const START_SILVER = 150;
export const MINER_LOAD = 30; // bir safarda olib keladigan kumush
export const MINE_TIME = 6; // konchi kon ichida qancha turadi
export const CARRY_SLOW = 0.8; // savat bilan sekinroq yuradi
export const MAX_MINERS = 12;

// ---------- Qasr ----------
export const CASTLE_HP = 3000;
export const CASTLE_DMG = 14;
export const CASTLE_CD = 1.5;
export const CASTLE_RANGE = 400;
export const FIRE_MULT = 1.5; // olovli o'q qasrga
export const AMIR_RESPAWN = 20;

// ---------- Mukofot ----------
export const SILVER_PER_GOLD = 10;
export function winBonus(level: number): number {
  return 30 + 10 * level;
}

// ---------- Dushman ----------
export function enemyIncome(level: number): number {
  // 1–3-janglar yengilroq (o'rganish uchun)
  if (level < 3) return [0.85, 0.95, 1.05][level];
  return 1.55 + 0.06 * level;
}
export const EASY_LEVELS = 3; // shu janglarda dushman kechroq hujum qiladi
export const EASY_FIRST_ATTACK = 80; // soniya
export const EASY_NEXT_UNIT = 100; // "bir pog'ona oldindagi" askarni shundan keyin yollaydi
export function enemyStats(level: number): number {
  return 1.1 + 0.04 * level;
}
// Dushman askarlari tezroq tayyorlanadi (uning ham bitta navbati bor)
export function enemyTrain(level: number): number {
  return level < 3 ? 1 : 1.15 + 0.04 * level;
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
    hp: 0.95,
    speed: 1.2,
    arrowTaken: 1,
    prefer: { otliq: 2, kamonchi: 1.5 },
  },
  sovutli: {
    name: 'Sovutlilar',
    desc: "Og'ir zirhli: chidamli, o'qdan kam zarar ko'radi, sekin",
    hp: 1.12,
    speed: 0.85,
    arrowTaken: 0.8,
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
export type CastleUpId = 'qasr' | 'otish' | 'qazish' | 'kumush';
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
export const MINER_UP = { load: 4, speed: 0.06 }; // konchi: har darajada
export const DIG_UP = 0.1; // qazish: har darajada kon ichidagi vaqt shuncha qisqaradi

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
  { id: 'qazish', name: 'Kon tezligi', group: 'qasr', unlock: 0, costs: costs(0.8), desc: (l) => `Qazish ${(MINE_TIME * (1 - DIG_UP * l)).toFixed(1)} s` },
  { id: 'kumush', name: "Boshlang'ich kumush", group: 'qasr', unlock: 0, costs: costs(0.6), desc: (l) => `Boshida ${START_SILVER + 50 * l} kumush` },
];

// ---------- Market: tezlatish (oltinga). Jangda ⚡ tugmasi bilan yoqiladi, BOOST_TIME soniya ishlaydi ----------
export type BoostId = 'tez_konchi' | 'tez_yollash' | 'jangovar_ruh' | 'tez_qadam';
export interface Boost {
  id: BoostId;
  name: string;
  icon: string;
  desc: string;
  cost: number;
}

export const BOOSTS: Boost[] = [
  { id: 'tez_konchi', name: 'Tez konchi', icon: '⛏', desc: '1 daqiqa: konchilar 50% tez yuradi va qazadi', cost: 30 },
  { id: 'tez_yollash', name: 'Tez yollash', icon: '⏱', desc: '1 daqiqa: askarlar 50% tez tayyorlanadi', cost: 30 },
  { id: 'jangovar_ruh', name: 'Jangovar ruh', icon: '⚔', desc: '1 daqiqa: askarlar 30% tez zarba beradi', cost: 40 },
  { id: 'tez_qadam', name: 'Tez qadam', icon: '👣', desc: '1 daqiqa: askarlar 25% tez yuradi', cost: 25 },
];

export const BOOST_TIME = 60; // bitta tezlatish necha soniya ishlaydi (yana bosilsa vaqti qo'shiladi)
export const BOOST_EFFECT: Record<BoostId, number> = {
  tez_konchi: 0.5,
  tez_yollash: 0.5,
  jangovar_ruh: 0.3,
  tez_qadam: 0.25,
};

// ---------- Kampaniya: xarita bo'ylab janglar ----------
export type BaseId = 'ormon' | 'dasht' | 'ekinzor' | 'kol';
export interface BattleDef {
  name: string;
  terrain: Terrain;
  castle: BaseId; // dushman tayanchi rasmi
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
  { name: "G'arbiy o'rmon qal'asi", terrain: 'ormon', castle: 'ormon', map: [0.2, 0.27], faction: 'kochmanchi', color: 'kulrang', temper: 'sabrli' },
  { name: "G'arbiy tog' koni", terrain: 'tog', castle: 'ormon', map: [0.262, 0.12], faction: 'sovutli', color: 'qora', temper: 'sabrli' },
  { name: "Shimoliy dalalar qal'asi", terrain: 'ekinzor', castle: 'ekinzor', map: [0.42, 0.22], faction: 'kochmanchi', color: 'qizil', temper: 'tez' },
  { name: "Yashil bayroqli qal'a", terrain: 'yaylov', castle: 'ekinzor', map: [0.617, 0.22], faction: 'sovutli', color: 'yashil', temper: 'sabrli' },
  { name: "Sharqiy tog' koni", terrain: 'tog', castle: 'ormon', map: [0.797, 0.13], faction: 'kochmanchi', color: 'qora', temper: 'reyd' },
  { name: "Binafsha bayroqli qal'a", terrain: 'yaylov', castle: 'ekinzor', map: [0.797, 0.285], faction: 'sovutli', color: 'binafsha', temper: 'tez' },
  { name: "Ot yaylovi qal'asi", terrain: 'dasht', castle: 'dasht', map: [0.914, 0.52], faction: 'kochmanchi', color: 'zangori', temper: 'reyd' },
  { name: "Sariq bayroqli qal'a", terrain: 'chol', castle: 'dasht', map: [0.867, 0.81], faction: 'sovutli', color: 'sariq', temper: 'sabrli' },
  { name: "Cho'l vohasi", terrain: 'chol', castle: 'dasht', map: [0.738, 0.71], faction: 'kochmanchi', color: 'qizil', temper: 'tez' },
  { name: "Janubiy qora qal'a", terrain: 'ekinzor', castle: 'ormon', map: [0.447, 0.77], faction: 'sovutli', color: 'qora', temper: 'sabrli' },
  { name: 'Orol bandargohi', terrain: 'kol', castle: 'kol', map: [0.215, 0.64], faction: 'kochmanchi', color: 'zangori', temper: 'reyd' },
  { name: "Ko'l bo'yi qal'asi", terrain: 'kol', castle: 'kol', map: [0.18, 0.49], faction: 'sovutli', color: 'kok', temper: 'tez' },
  { name: "Qizil bayroqli qal'a", terrain: 'ekinzor', castle: 'ekinzor', map: [0.393, 0.63], faction: 'kochmanchi', color: 'qizil', temper: 'reyd' },
  { name: 'Qizil tomli poytaxt', terrain: 'shahar', castle: 'ekinzor', map: [0.383, 0.45], faction: 'sovutli', color: 'qizil', temper: 'sabrli' },
  { name: "Ko'k gumbazli poytaxt", terrain: 'shahar', castle: 'kol', map: [0.648, 0.43], faction: 'sovutli', color: 'kok', temper: 'tez' },
];
