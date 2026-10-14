export type Terrain =
  | 'tekislik'
  | 'unumdor'
  | 'vodiy'
  | 'yaylov'
  | 'orman'
  | 'tog'
  | 'qorli_tog'
  | 'chol'
  | 'daryo'
  | 'kol'
  /** Xarita tashqarisi (jarlik, bo'shliq) — o'ynalmaydi. */
  | 'tashqi';

export type Zone = 'chet' | 'orta' | 'markaz';

export type ResKey = 'kumush' | 'bronza' | 'don' | 'qoy';
export type Resources = Record<ResKey, number>;
export type Goods = 'don' | 'qoy' | 'kumush';

export type WorkerType = 'dehqon' | 'chopon' | 'konchi';

export type UnitType =
  | 'piyoda'
  | 'kamonchi'
  | 'nayzachi'
  | 'otliq'
  | 'zirhli_otliq'
  | 'zirhli_nayzachi'
  | 'amir'
  | 'qomondon'
  | 'sarkarda_otliq'
  | 'sarkarda_nayzachi'
  | 'sarkarda_kamonchi'
  | 'sarkarda_piyoda';

/** Jang toifasi: tur ustunligi shu bo'yicha hisoblanadi. */
export type UnitCat = 'piyoda' | 'kamonchi' | 'nayzachi' | 'otliq';

export type Army = Partial<Record<UnitType, number>>;

export type BuildingType = 'none' | 'core' | 'farm' | 'pasture' | 'mine' | 'tower' | 'fort' | 'city';

export type Crop = 'bugdoy' | 'arpa';
export type FactionKind = 'player' | 'ai' | 'empire';
export type Specialty = 'kon' | 'dehqon' | 'chorva';

export interface Capture {
  by: number;
  until: number;
  army: Army;
}

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  province: number;
  /** Kumush koni bor joy. */
  deposit: boolean;
  /** -1 = egasiz */
  owner: number;
  building: BuildingType;
  level: number;
  crop: Crop;
  workers: number;
  /** Ishxona ombori: shu yerda to'plangan mahsulot. */
  store: number;
  garrison: Army;
  capture: Capture | null;
  /** Bino umumiy xarita rasmida chizilgan — ustidan sprite chizilmaydi. */
  painted?: boolean;
}

export interface Province {
  id: number;
  name: string;
  zone: Zone;
  /** Markaziy plita (yorliq uchun). */
  cx: number;
  cy: number;
  /** Qisqa tavsif: qanday resurslar bor. */
  desc: string;
}

export interface Faction {
  id: number;
  kind: FactionKind;
  name: string;
  color: string;
  res: Resources;
  coreX: number;
  coreY: number;
  alive: boolean;
  coreLevel: number;
  barracksLevel: number;
  omborLevel: number;
  spyLevel: number;
  /** Yollangan ishchilar (jami, plitalarga biriktirilganlar ham). */
  workers: Record<WorkerType, number>;
  unitLevels: Record<UnitType, number>;
  workerLevels: Record<WorkerType, number>;
  specialty: Specialty | null;
  /** AI: o'yinchiga g'azab (qasos darajasi). */
  anger: number;
  wins: number;
  losses: number;
  /** Shu kungacha hujumdan himoyalangan. */
  protectedUntil: number;
  /** Ketma-ket och qolgan kunlar. */
  starving: number;
  unlocks: { qomondon: boolean; sarkarda: boolean };
  /** Amir yarador bo'lsa: shu kungacha. */
  amirWoundedUntil: number;
  /** AI kuch koeffitsiyenti (yaqin zaif, uzoq kuchli). */
  strength: number;
  nextActionDay: number;
  /** Imperiya uslubi. */
  style: 'rim' | 'fors' | null;
}

export type MarchPurpose = 'attack' | 'raid' | 'return' | 'move';

export interface MarchingArmy {
  id: number;
  owner: number;
  units: Army;
  path: { x: number; y: number }[];
  /** Yo'l bo'ylab joriy pozitsiya (plita indeksi, kasr). */
  pos: number;
  /** Kuniga necha plita yuradi. */
  speed: number;
  purpose: MarchPurpose;
  target: { x: number; y: number };
  /** O'yinchi bu qo'shin haqida xabar oldimi. */
  warned: boolean;
  /** O'yinchi ko'radigan taxminiy son. */
  shownCount: number;
}

export type LogKind = 'info' | 'good' | 'bad' | 'war';

export interface LogEntry {
  day: number;
  text: string;
  kind: LogKind;
}

export interface Market {
  /** Sotuvdan keyingi to'yinganlik (0..0.8), har kuni kamayadi. */
  saturation: Record<Goods, number>;
  /** Kunlik tebranish. */
  drift: Record<Goods, number>;
}

export interface PendingBattle {
  armyId: number | null;
  attacker: number;
  defender: number;
  x: number;
  y: number;
  attackUnits: Army;
  /** Garnizon yoki egallovchi qo'shin. */
  defendUnits: Army;
  kind: 'attack' | 'raid' | 'recapture';
}

export interface GameState {
  version: number;
  seed: number;
  day: number;
  tiles: Tile[];
  provinces: Province[];
  factions: Faction[];
  armies: MarchingArmy[];
  nextArmyId: number;
  market: Market;
  log: LogEntry[];
  speed: number;
  playerId: number;
  /** Egalik o'zgarganda oshadi (renderer keshlari uchun). */
  ownerVersion: number;
  pending: PendingBattle[];
  aiSpawnCounter: number;
}
