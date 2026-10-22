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

// Tur ustunligi: kalit — kimga qarshi kuchli
export const BEATS: Partial<Record<Kind, Kind>> = {
  nayzachi: 'otliq',
  otliq: 'kamonchi',
  kamonchi: 'qilichli',
  qilichli: 'nayzachi',
};
export const BEATS_MULT = 1.5;

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
  train: number; // soniya
  escorts: number; // birga chiqadigan oddiy askarlar
  unlock: number; // nechanchi g'alabadan keyin ochiladi
}

export const ITEMS: Item[] = [
  { id: 'konchi', name: 'Konchi', kind: 'konchi', rank: 'oddiy', cost: 50, train: 3, escorts: 0, unlock: 0 },
  { id: 'qilichli', name: 'Qilichli', kind: 'qilichli', rank: 'oddiy', cost: 75, train: 4, escorts: 0, unlock: 0 },
  { id: 'nayzachi', name: 'Nayzachi', kind: 'nayzachi', rank: 'oddiy', cost: 110, train: 5, escorts: 0, unlock: 1 },
  { id: 'kamonchi', name: 'Kamonchi', kind: 'kamonchi', rank: 'oddiy', cost: 130, train: 5, escorts: 0, unlock: 2 },
  { id: 'otliq', name: 'Otliq', kind: 'otliq', rank: 'oddiy', cost: 260, train: 7, escorts: 0, unlock: 3 },
  { id: 'sarkarda_qilichli', name: 'Qilichli sarkarda', kind: 'qilichli', rank: 'sarkarda', cost: 450, train: 10, escorts: 2, unlock: 4 },
  { id: 'sarkarda_nayzachi', name: 'Nayzachi sarkarda', kind: 'nayzachi', rank: 'sarkarda', cost: 550, train: 10, escorts: 2, unlock: 5 },
  { id: 'sarkarda_kamonchi', name: 'Kamonchi sarkarda', kind: 'kamonchi', rank: 'sarkarda', cost: 600, train: 10, escorts: 2, unlock: 6 },
  { id: 'sarkarda_otliq', name: 'Otliq sarkarda', kind: 'otliq', rank: 'sarkarda', cost: 900, train: 12, escorts: 2, unlock: 7 },
  { id: 'qomondon', name: "Qo'mondon", kind: 'otliq', rank: 'qomondon', cost: 1600, train: 15, escorts: 3, unlock: 8 },
];

export const QUEUE_MAX = 5; // bitta tugmada navbat

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

// ---------- Dushman kuchi (har jangda sal oshadi) ----------
export function enemyIncome(level: number): number {
  return 1.2 + 0.06 * level;
}
export function enemyStats(level: number): number {
  return 1 + 0.04 * level;
}
export function enemyCastleHp(level: number): number {
  return CASTLE_HP + 250 * level;
}

// ---------- Kuchaytirishlar (oltinga) ----------
export type UpgradeId = 'qasr' | 'otish' | 'savat' | 'askar' | 'kumush' | 'ombor';
export interface Upgrade {
  id: UpgradeId;
  name: string;
  desc: (lvl: number) => string;
  costs: number[];
}

export const UPGRADES: Upgrade[] = [
  { id: 'qasr', name: 'Qasr mustahkamligi', desc: (l) => `Qasr: ${CASTLE_HP + 500 * l} jon`, costs: [40, 80, 140, 220, 320] },
  { id: 'otish', name: 'Qasr kamonchilari', desc: (l) => `Qasr o'qi: +${20 * l}%`, costs: [40, 80, 140, 220, 320] },
  { id: 'savat', name: 'Konchi savati', desc: (l) => `Bir safarda: ${MINER_LOAD + 2 * l} kumush`, costs: [30, 60, 110, 180, 270] },
  { id: 'askar', name: 'Askar kuchi', desc: (l) => `Jon va zarba: +${8 * l}%`, costs: [50, 100, 170, 260, 380] },
  { id: 'kumush', name: "Boshlang'ich kumush", desc: (l) => `Jang boshida: ${START_SILVER + 50 * l}`, costs: [25, 50, 90, 140, 200] },
  { id: 'ombor', name: 'Ombor', desc: (l) => `Sig'imi: ${STOCK_CAP + 100 * l}`, costs: [30, 70, 120] },
];

// ---------- Kampaniya: xarita bo'ylab janglar ----------
export interface BattleDef {
  name: string;
  terrain: Terrain;
  castle: string; // rasm: buildings kaliti va indeksi, masalan "qasr_dushman:0"
  ruin?: string; // vayron holati (bo'lsa)
  mine: number; // kon rasmi indeksi
  map: [number, number]; // xaritadagi joyi (rasm o'lchamiga nisbatan 0..1)
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

// Yo'l g'arbdagi o'rmondan boshlanib, xarita chetidan soat mili bo'ylab aylanadi va markazdagi ikki poytaxtda tugaydi
export const BATTLES: BattleDef[] = [
  { name: "G'arbiy o'rmon qal'asi", terrain: 'ormon', castle: 'qasr_dushman:0', mine: 1, map: [0.2, 0.27] },
  { name: "G'arbiy tog' koni", terrain: 'tog', castle: 'qasr_dushman:3', mine: 2, map: [0.262, 0.12] },
  { name: "Shimoliy dalalar qal'asi", terrain: 'ekinzor', castle: 'qasr_dushman:2', mine: 0, map: [0.42, 0.22] },
  { name: "Yashil bayroqli qal'a", terrain: 'yaylov', castle: 'qasr_dushman:4', mine: 0, map: [0.617, 0.22] },
  { name: "Sharqiy tog' koni", terrain: 'tog', castle: 'qasr_dushman:3', mine: 2, map: [0.797, 0.13] },
  { name: "Binafsha bayroqli qal'a", terrain: 'yaylov', castle: 'qasr_dushman:3', mine: 0, map: [0.797, 0.285] },
  { name: "Ot yaylovi qal'asi", terrain: 'dasht', castle: 'qasr_dushman:4', mine: 0, map: [0.914, 0.52] },
  { name: "Sariq bayroqli qal'a", terrain: 'chol', castle: 'qasr_dushman:5', mine: 3, map: [0.867, 0.81] },
  { name: "Cho'l vohasi", terrain: 'chol', castle: 'qasr_dushman:5', mine: 3, map: [0.738, 0.71] },
  { name: "Janubiy qora qal'a", terrain: 'ekinzor', castle: 'qasr_dushman:0', mine: 0, map: [0.447, 0.77] },
  { name: 'Orol bandargohi', terrain: 'kol', castle: 'qasr_dushman:1', mine: 0, map: [0.215, 0.64] },
  { name: "Ko'l bo'yi qal'asi", terrain: 'kol', castle: 'qasr_dushman:1', mine: 1, map: [0.18, 0.49] },
  { name: "Qizil bayroqli qal'a", terrain: 'ekinzor', castle: 'qasr_dushman:2', mine: 0, map: [0.393, 0.63] },
  { name: 'Qizil tomli poytaxt', terrain: 'shahar', castle: 'shahar:0', ruin: 'shahar:2', mine: 0, map: [0.383, 0.45] },
  { name: "Ko'k gumbazli poytaxt", terrain: 'shahar', castle: 'shahar:1', ruin: 'shahar:3', mine: 0, map: [0.648, 0.43] },
];
