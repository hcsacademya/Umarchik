// Jang simulyatsiyasi: grafikasiz, faqat mantiq. Har qadam step(dt) bilan yuradi.
import {
  AMIR_RESPAWN, BATTLES, BLOCK_GAP, BOOST_EFFECT, CARRY_SLOW, CASTLE_CD, CASTLE_DEPTH, CASTLE_DMG, CASTLE_FRONT, CASTLE_HP,
  CASTLE_RANGE, CASTLE_X, COL_GAP, DEAD_LINGER, DEPTH, DIG_UP, DOOR_TIME, FACTIONS, FIRE_MULT, FORMATION_FRONT, HEAL_RATE,
  MAX_MINERS, MINE_OFFSET, MINE_TIME, MINER_LOAD, MINER_UP, QUEUE_MAX, RANK, ROW_SIZE, START_SILVER, STATS, UNIT_UP_STEP,
  WALL_SPOTS, enemyCastleHp, enemyIncome, enemyStats, enemyTrain, itemOf, popCap, vsMult,
} from './config.ts';
import type { BoostId, Item, ItemId, Kind, Rank, Side, Stance } from './config.ts';
import { itemsFor, startForce, stepFor } from './campaign.ts';
import type { Save } from './campaign.ts';
import { EnemyAI } from './ai.ts';

export type Anim = 'idle' | 'walk' | 'run' | 'attack' | 'carry';
// Konchi: konga boradi → kirib qazadi → savat bilan chiqib qasrga boradi → darvozaga kirib topshiradi → chiqadi
type Task = 'toMine' | 'inMine' | 'toCastle' | 'unload';

// Zarba: SWING — butun harakat davomiyligi, HIT — zarba (yoki o'q) aynan qaysi lahzada tegadi
const SWING = 0.45;
const HIT = 0.2;
const SHOOT = 0.62; // kamonchi: o'q olish, qo'yish, tortish, qo'yib yuborish
const RELEASE = 0.44;

export interface Unit {
  id: number;
  side: Side;
  kind: Kind;
  rank: Rank;
  x: number;
  y: number; // chuqurlik 0..DEPTH
  hp: number;
  maxHp: number;
  dmg: number;
  range: number;
  cd: number;
  speed: number;
  cdLeft: number;
  facing: 1 | -1;
  anim: Anim;
  animT: number;
  walkDist: number; // bosib o'tilgan yo'l (yurish kadrlari shunga bog'liq)
  swingT: number; // zarba boshlanganidan beri vaqt; -1 — zarba yo'q
  swingDone: boolean;
  swingTarget: number; // zarba kimga (askar id) yoki -1
  swingCastle: Side | -1; // yoki qaysi qasrga
  swingAlt: boolean; // (kadrli rasmlar uchun) zarba turi juft/toq
  swingVar: number; // zarba turi 0..2: har zarbada tasodifiy, harakatlar takrorlanmasin
  target: number; // qulflangan nishon (askar id) yoki -1
  retargetT: number; // nishonni qayta tanlashgacha
  aimD: number; // kamonchi: nishongacha masofa (kamonni qancha ko'tarish)
  guard: boolean; // dushman yaqin: qalqon ko'tarilgan
  hitDir: number; // oxirgi zarba yo'nalishi (+1 / -1): shu tomonga silkinadi yoki yiqiladi
  kite: number; // kamonchi: orqaga chekinish qolgan vaqti
  kiteCd: number;
  hitT: number;
  promoteT: number; // yangi Amir bo'lganda oltin chaqnash
  garrison: boolean;
  inside: boolean; // kon yoki qasr ichida (ko'rinmaydi, unga hujum qilib bo'lmaydi)
  door: number; // 0 — tashqarida, 1 — darvoza/kon ichida; oraliqda — kirib yoki chiqib kelmoqda
  doorDir: 0 | 1 | -1; // 1 kirmoqda, -1 chiqmoqda
  toGarrison: boolean; // kirgach qasrda qoladi (Chekinish)
  dead: boolean;
  deadT: number;
  reach: number; // jangovar masofaga kichik farq: hammasi bir nuqtaga yig'ilmasin
  slotX: number;
  slotY: number;
  raid: number; // reyd vaqti (soniya); 0 — reydda emas
  task: Task;
  load: number;
  mineT: number;
  mineSpot: number;
  prev?: Snap; // oldingi hisob qadamidagi holat (chizish uchun)
}

// Hisob sekundiga 30 marta yangilanadi, ekran esa 60+ marta chiziladi. Ekran ikki qadam orasidagi
// holatni shu ikki holatdan hisoblaydi — askarlar sakramay, silliq yuradi.
export interface Snap {
  x: number;
  y: number;
  walkDist: number;
  animT: number;
  swingT: number;
  hitT: number;
  deadT: number;
  door: number;
}

function snap(u: Unit): void {
  const p = (u.prev ??= { x: 0, y: 0, walkDist: 0, animT: 0, swingT: -1, hitT: 0, deadT: 0, door: 0 });
  p.x = u.x;
  p.y = u.y;
  p.walkDist = u.walkDist;
  p.animT = u.animT;
  p.swingT = u.swingT;
  p.hitT = u.hitT;
  p.deadT = u.deadT;
  p.door = u.door;
}

export interface Shot {
  side: Side;
  kind: Kind | null; // otgan askar turi (qasr uchun null)
  dmg: number;
  fire: boolean;
  target: number; // askar id, yoki -1
  castle: Side | -1;
  sx: number;
  sz: number;
  tx: number;
  ty: number;
  tz: number;
  x: number;
  y: number;
  z: number;
  prev?: { x: number; y: number; z: number };
  t: number;
  dur: number;
  arc: number;
  smokeT: number;
}

export interface Particle {
  kind: 'smoke' | 'spark' | 'dust' | 'cloud';
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  max: number;
  size: number;
}

export interface SideState {
  silver: number;
  stance: Stance;
  front: number; // "Joyida tur" safining oldingi chizig'i darvozadan (dushman himoyada uni qasrga yaqinlashtiradi)
  castleHp: number;
  castleMax: number;
  castleDmg: number;
  castleCd: number;
  items: ItemId[];
  popCap: number;
  queue: ItemId[]; // umumiy navbat: birinchi bosilgan birinchi chiqadi
  queueT: number; // navbatdagi birinchisining tayyorlanish vaqti
  bought: Set<ItemId>; // sarkarda/qo'mondon: jangda bir marta
  hpMult: Record<Kind, number>;
  dmgMult: Record<Kind, number>;
  speedMult: number; // jangchilar yurishi
  attackSpeed: number; // zarba tezligi
  trainSpeed: number; // navbat tezligi
  minerSpeed: number;
  minerLoad: number;
  mineTime: number; // konchi kon ichida qancha turadi
  arrowTaken: number;
  income: number;
  amirDead: boolean;
  amirTimer: number;
}

export interface BattleEvent {
  text: string;
  good: boolean;
  amir?: 'dead' | 'heir' | 'back'; // Amir halok bo'ldi / o'rniga askar Amir bo'ldi / qasrdan yangisi chiqdi
}

// Qasr ustida ko'tarilib yo'qoladigan yozuv (masalan, "+30" kumush)
export interface Popup {
  x: number;
  z: number;
  text: string;
  t: number;
}

export type BuyError = 'kumush' | 'joy' | 'navbat' | 'konchi' | 'bor' | 'yopiq';

export function dirOf(side: Side): 1 | -1 {
  return side === 0 ? 1 : -1;
}

export function mineX(side: Side): number {
  return CASTLE_X[side] + dirOf(side) * MINE_OFFSET;
}

// Zarba harakatining qaysi bosqichida (0..1), -1 — zarba yo'q. Chizishda kadr tanlash uchun
export function swingPhase(u: Unit): number {
  if (u.swingT < 0) return -1;
  const dur = Math.min(u.kind === 'kamonchi' ? SHOOT : SWING, u.cd * 0.95);
  return Math.min(0.999, u.swingT / dur);
}

// Askarga hujum qilsa bo'ladimi: tirik, tashqarida (darvoza yoki kon ichiga kirib ulgurmagan)
export function targetable(u: Unit): boolean {
  return !u.dead && !u.garrison && !u.inside && u.door < 0.5;
}

export function itemPop(it: Item): number {
  return STATS[it.kind].pop * (1 + it.escorts);
}

const ARROW_SPEED = 650;
const RUN_FAST = 1.45; // yugurganda yurishdan shuncha tez
const KINDS: Kind[] = ['amir', 'konchi', 'qilichli', 'nayzachi', 'kamonchi', 'otliq'];

function perKind(f: (k: Kind) => number): Record<Kind, number> {
  const out = {} as Record<Kind, number>;
  for (const k of KINDS) out[k] = f(k);
  return out;
}

export class Battle {
  level: number;
  boosts: BoostId[];
  time = 0;
  units: Unit[] = [];
  shots: Shot[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];
  sides: [SideState, SideState];
  winner: Side | null = null;
  overT = 0;
  events: BattleEvent[] = [];
  private nextId = 1;
  private seed: number;
  private ai: EnemyAI;
  private byId = new Map<number, Unit>();
  private foes: [Unit[], Unit[]] = [[], []]; // har tomon uchun dushman askarlari (har qadamda bir marta)
  private attackers = new Map<number, number>(); // nishonga nechta yaqin jangchi yopirilgan

  constructor(level: number, save: Save, boosts: BoostId[] = [], seed = Date.now()) {
    this.level = level;
    this.boosts = boosts;
    this.seed = seed >>> 0;
    const up = save.up;
    const has = (b: BoostId) => boosts.includes(b);
    const def = BATTLES[level];
    const fac = FACTIONS[def.faction];
    const eMult = enemyStats(level);
    this.sides = [
      {
        silver: START_SILVER + 50 * up.kumush,
        stance: 'tur',
        front: FORMATION_FRONT,
        castleHp: CASTLE_HP + 500 * up.qasr,
        castleMax: CASTLE_HP + 500 * up.qasr,
        castleDmg: CASTLE_DMG * (1 + 0.2 * up.otish),
        castleCd: 1,
        items: itemsFor(stepFor(0, level)),
        popCap: popCap(stepFor(0, level)),
        queue: [],
        queueT: 0,
        bought: new Set(),
        hpMult: perKind((k) => (k === 'konchi' ? 1 : 1 + UNIT_UP_STEP * up[k])),
        dmgMult: perKind((k) => (k === 'konchi' ? 1 : 1 + UNIT_UP_STEP * up[k])),
        speedMult: 1 + (has('tez_qadam') ? BOOST_EFFECT.tez_qadam : 0),
        attackSpeed: 1 + (has('jangovar_ruh') ? BOOST_EFFECT.jangovar_ruh : 0),
        trainSpeed: 1 / (1 - (has('tez_yollash') ? BOOST_EFFECT.tez_yollash : 0)),
        minerSpeed: (1 + MINER_UP.speed * up.konchi) * (1 + (has('tez_konchi') ? BOOST_EFFECT.tez_konchi : 0)),
        minerLoad: MINER_LOAD + MINER_UP.load * up.konchi,
        mineTime: MINE_TIME * (1 - DIG_UP * (up.qazish ?? 0)),
        arrowTaken: 1,
        income: 1,
        amirDead: false,
        amirTimer: 0,
      },
      {
        silver: START_SILVER,
        stance: 'tur',
        front: FORMATION_FRONT,
        castleHp: enemyCastleHp(level),
        castleMax: enemyCastleHp(level),
        castleDmg: CASTLE_DMG * eMult,
        castleCd: 1,
        items: itemsFor(stepFor(1, level)).filter((id) => id !== 'qomondon'), // dushmanda qo'mondon yo'q (Amir kabi)
        popCap: popCap(stepFor(1, level)),
        queue: [],
        queueT: 0,
        bought: new Set(),
        hpMult: perKind((k) => eMult * (k === 'konchi' ? 1 : fac.hp)),
        dmgMult: perKind(() => eMult),
        speedMult: fac.speed,
        attackSpeed: 1,
        trainSpeed: enemyTrain(level),
        minerSpeed: 1,
        minerLoad: MINER_LOAD,
        mineTime: MINE_TIME,
        arrowTaken: fac.arrowTaken,
        income: enemyIncome(level),
        amirDead: false,
        amirTimer: 0,
      },
    ];
    for (const side of [0, 1] as Side[]) {
      for (const k of startForce(side, level)) this.spawn(side, k, 'oddiy', true);
    }
    this.assignSlots();
    for (const u of this.units) {
      if (u.kind !== 'konchi') {
        u.x = u.slotX;
        u.y = u.slotY;
      }
    }
    this.ai = new EnemyAI(def.temper, def.faction);
  }

  rand(): number {
    // mulberry32 — takrorlanadigan tasodif (sinov uchun qulay)
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------------- Sotib olish va navbat ----------------

  popUsed(side: Side): number {
    let n = 0;
    for (const u of this.units) if (u.side === side && !u.dead) n += STATS[u.kind].pop;
    for (const id of this.sides[side].queue) n += itemPop(itemOf(id));
    return n;
  }

  queued(side: Side, id: ItemId): number {
    let n = 0;
    for (const q of this.sides[side].queue) if (q === id) n++;
    return n;
  }

  minerCount(side: Side): number {
    let n = this.queued(side, 'konchi');
    for (const u of this.units) if (u.side === side && !u.dead && u.kind === 'konchi') n++;
    return n;
  }

  // Navbatdagi birinchisi (tayyorlanayotgani) va uning ulushi 0..1
  training(side: Side): { id: ItemId; p: number } | null {
    const s = this.sides[side];
    if (!s.queue.length) return null;
    return { id: s.queue[0], p: Math.min(1, s.queueT / itemOf(s.queue[0]).train) };
  }

  canBuy(side: Side, id: ItemId): BuyError | null {
    const s = this.sides[side];
    const it = itemOf(id);
    if (!s.items.includes(id)) return 'yopiq';
    if (it.rank !== 'oddiy' && s.bought.has(id)) return 'bor';
    if (id === 'konchi' && this.minerCount(side) >= MAX_MINERS) return 'konchi';
    if (s.queue.length >= QUEUE_MAX) return 'navbat';
    if (this.popUsed(side) + itemPop(it) > s.popCap) return 'joy';
    if (s.silver < it.cost) return 'kumush';
    return null;
  }

  buy(side: Side, id: ItemId): BuyError | null {
    const err = this.canBuy(side, id);
    if (err) return err;
    const s = this.sides[side];
    const it = itemOf(id);
    s.silver -= it.cost;
    if (it.rank !== 'oddiy') s.bought.add(id);
    s.queue.push(id);
    return null;
  }

  // Navbatdan shu turdagi oxirgisini olib tashlash, puli to'liq qaytadi
  cancel(side: Side, id: ItemId): boolean {
    const s = this.sides[side];
    const i = s.queue.lastIndexOf(id);
    if (i < 0) return false;
    s.queue.splice(i, 1);
    if (i === 0) s.queueT = 0;
    const it = itemOf(id);
    s.silver += it.cost;
    if (it.rank !== 'oddiy') s.bought.delete(id);
    return true;
  }

  setStance(side: Side, st: Stance): void {
    this.sides[side].stance = st;
  }

  // ---------------- Yaratish ----------------

  private spawn(side: Side, kind: Kind, rank: Rank, initial = false): Unit {
    const st = STATS[kind];
    const r = RANK[rank];
    const s = this.sides[side];
    const dir = dirOf(side);
    const hp = st.hp * r.hp * s.hpMult[kind];
    const u: Unit = {
      id: this.nextId++,
      side,
      kind,
      rank,
      x: CASTLE_X[side] + dir * 10,
      y: 6 + this.rand() * (DEPTH - 12),
      hp,
      maxHp: hp,
      dmg: st.dmg * r.dmg * s.dmgMult[kind],
      range: st.range,
      cd: st.cd / s.attackSpeed,
      speed: st.speed * (kind === 'konchi' ? s.minerSpeed : s.speedMult) * (0.95 + this.rand() * 0.1), // har biri biroz boshqacha tez
      cdLeft: this.rand() * st.cd,
      facing: dir,
      anim: 'idle',
      animT: this.rand() * 2,
      walkDist: this.rand() * 60,
      swingT: -1,
      swingDone: false,
      swingTarget: -1,
      swingCastle: -1,
      swingAlt: false,
      swingVar: 0,
      target: -1,
      retargetT: 0,
      aimD: 0,
      guard: false,
      hitDir: 0,
      kite: 0,
      kiteCd: 0,
      hitT: 0,
      promoteT: 0,
      garrison: false,
      inside: false,
      door: 0,
      doorDir: 0,
      toGarrison: false,
      dead: false,
      deadT: 0,
      reach: 0.75 + this.rand() * 0.25,
      slotX: CASTLE_X[side],
      slotY: DEPTH / 2,
      raid: 0,
      task: 'toMine',
      load: 0,
      mineT: 0,
      mineSpot: (this.rand() - 0.5) * 16,
    };
    if (kind === 'konchi' && initial) u.x = mineX(side) - dir * (30 + this.rand() * 110);
    if (!initial) {
      // yangi askar qasr darvozasidan chiqib keladi (Chekinishda esa ichkarida qoladi)
      u.x = CASTLE_X[side];
      u.y = 4;
      u.door = 1;
      if (s.stance === 'chekinish') {
        u.garrison = true;
        u.inside = true;
      } else u.doorDir = -1;
    }
    this.units.push(u);
    return u;
  }

  private spawnItem(side: Side, it: Item): void {
    this.spawn(side, it.kind, it.rank);
    for (let i = 0; i < it.escorts; i++) this.spawn(side, it.kind, 'oddiy');
  }

  // ---------------- Saf ("Joyida tur") ----------------

  // Har tur alohida to'rtburchak blok: ustunda 4 tadan (chuqurlik bo'yicha), ustunlar orasida bo'sh joy,
  // bloklar orasida kengroq oraliq. Oldinda sarkardalar va otliq, keyin qilichli, Amir, nayzachi, kamonchi
  private assignSlots(): void {
    for (const side of [0, 1] as Side[]) {
      const dir = dirOf(side);
      const groups: Unit[][] = [[], [], [], [], [], []];
      for (const u of this.units) {
        if (u.side !== side || u.dead || u.kind === 'konchi') continue;
        let g: number;
        if (u.rank !== 'oddiy') g = 0;
        else if (u.kind === 'otliq') g = 1;
        else if (u.kind === 'qilichli') g = 2;
        else if (u.kind === 'amir') g = 3;
        else if (u.kind === 'nayzachi') g = 4;
        else g = 5;
        groups[g].push(u);
      }
      const step = (DEPTH - 8) / (ROW_SIZE - 1);
      let back = 0; // safning oldingi chetidan orqaga masofa
      for (let g = 0; g < groups.length; g++) {
        const list = groups[g].sort((a, b) => a.id - b.id);
        if (!list.length) continue;
        const gap = g <= 1 ? COL_GAP * 1.7 : COL_GAP;
        const cols = Math.ceil(list.length / ROW_SIZE);
        list.forEach((u, i) => {
          const c = Math.floor(i / ROW_SIZE);
          const r = i % ROW_SIZE;
          const inCol = Math.min(ROW_SIZE, list.length - c * ROW_SIZE);
          u.slotX = CASTLE_X[side] + dir * (this.sides[side].front - back - c * gap - r * 4); // qatorlar pog'onali
          u.slotY = 4 + (r + (ROW_SIZE - inCol) / 2) * step;
        });
        back += (cols - 1) * gap + BLOCK_GAP + (g <= 1 ? 16 : 0);
      }
    }
  }

  // ---------------- Qadam ----------------

  step(dt: number): void {
    for (const u of this.units) snap(u);
    for (const s of this.shots) s.prev = { x: s.x, y: s.y, z: s.z };
    if (this.winner !== null) {
      this.overT += dt;
      for (const u of this.units) if (u.dead) u.deadT += dt;
      this.collapseFx(dt);
      this.updateFx(dt);
      return;
    }
    this.time += dt;
    this.prepare();
    for (const side of [0, 1] as Side[]) this.updateSide(side, dt);
    this.assignSlots();
    for (const u of this.units) this.updateUnit(u, dt);
    this.separate(dt);
    for (const side of [0, 1] as Side[]) this.castleShoot(side, dt);
    this.updateShots(dt);
    this.updateFx(dt);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 1.6);
    this.units = this.units.filter((u) => !u.dead || u.deadT < DEAD_LINGER + 1);
    this.ai.update(this, dt);
    for (const side of [0, 1] as Side[]) {
      if (this.sides[side].castleHp <= 0) {
        this.sides[side].castleHp = 0;
        this.winner = side === 0 ? 1 : 0;
        for (let i = 0; i < 30; i++) this.smoke(this.castleMid(side) + (this.rand() - 0.5) * 300, 20 + this.rand() * 150, 1.5);
      }
    }
  }

  private updateSide(side: Side, dt: number): void {
    const s = this.sides[side];
    if (s.queue.length) {
      const it = itemOf(s.queue[0]);
      s.queueT += dt * s.trainSpeed;
      if (s.queueT >= it.train) {
        s.queueT = 0;
        s.queue.shift();
        this.spawnItem(side, it);
      }
    }
    if (s.amirDead) {
      s.amirTimer -= dt;
      if (s.amirTimer <= 0) {
        s.amirDead = false;
        this.spawn(side, 'amir', 'oddiy');
        this.events.push({ text: 'Qasrdan yangi Amir chiqdi!', good: true, amir: 'back' });
      }
    }
  }

  // Har qadam boshida: id jadvali, har tomonning dushmanlari, nishon bo'yicha yopirilganlar soni
  private prepare(): void {
    this.byId.clear();
    this.foes = [[], []];
    this.attackers.clear();
    for (const u of this.units) {
      this.byId.set(u.id, u);
      if (!targetable(u)) continue;
      this.foes[u.side === 0 ? 1 : 0].push(u);
    }
    for (const u of this.units) {
      if (u.dead || u.kind === 'kamonchi' || u.kind === 'konchi' || u.target < 0) continue;
      this.attackers.set(u.target, (this.attackers.get(u.target) ?? 0) + 1);
    }
  }

  // Askarlar bir nuqtaga yig'ilib qolmasin: juda yaqin turganlar bir-birini sekin itaradi
  // (jangda to'p-to'p bo'lib emas, safda va atrofida turib urishadi)
  private separate(dt: number): void {
    const list = this.units
      .filter((u) => !u.dead && !u.garrison && !u.inside && u.door === 0 && u.doorDir === 0 && u.kind !== 'konchi')
      .sort((a, b) => a.x - b.x);
    const PUSH = 36 * dt;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.x - a.x;
        if (dx > 11) break;
        const dy = b.y - a.y;
        if (Math.abs(dy) > 7) continue;
        // x bo'yicha itarish (o'zaro), chuqurlik bo'yicha ham siljiydi
        const px = (11 - dx) / 11 * PUSH;
        const standing = (u: Unit) => u.swingT < 0;
        if (standing(a)) a.x -= px * 0.5;
        if (standing(b)) b.x += px * 0.5;
        const sy = (dy >= 0 ? 1 : -1) * ((7 - Math.abs(dy)) / 7) * PUSH * 0.6;
        a.y = Math.max(2, Math.min(DEPTH - 2, a.y - sy));
        b.y = Math.max(2, Math.min(DEPTH - 2, b.y + sy));
      }
    }
  }

  // Yiqilayotgan qasr: chang va tutun bulutlari
  private collapseFx(dt: number): void {
    if (this.overT > 3.4) return;
    const loser: Side = this.winner === 0 ? 1 : 0;
    const k = Math.min(1, this.overT / 0.6);
    for (let i = 0; i < 2; i++) {
      if (this.rand() > dt * 24 * k) continue;
      // chang bulutlari: yerdan ko'tarilib, kengayib, so'nadi
      const life = 2 + this.rand() * 1.2;
      this.particles.push({
        kind: 'cloud', x: this.castleMid(loser) + (this.rand() - 0.5) * 340, y: this.rand() * 40, z: 6 + this.rand() * 70,
        vx: (this.rand() - 0.5) * 40, vz: 12 + this.rand() * 26, life, max: life, size: 12 + this.rand() * 12,
      });
    }
  }

  private enemiesOf(side: Side): Unit[] {
    return this.units.filter((e) => e.side !== side && targetable(e));
  }

  // Devor tepasidagi kamonchilar (ko'rsatish uchun): 1 ta qasrniki + qasrga kirgan kamonchilar
  wallArchers(side: Side): number {
    let n = 1;
    for (const u of this.units) if (u.side === side && u.garrison && !u.dead && u.kind === 'kamonchi') n++;
    return Math.min(n, WALL_SPOTS.length);
  }

  // Hamma qasr ichidami (darvoza yopiladi)
  allInside(side: Side): boolean {
    return this.units.every((u) => u.side !== side || u.dead || u.garrison);
  }

  garrisonCount(side: Side): number {
    let n = 0;
    for (const u of this.units) if (u.side === side && !u.dead && u.garrison) n++;
    return n;
  }

  private wallPoint(side: Side, i: number): [number, number] {
    const [dx, z] = WALL_SPOTS[i % WALL_SPOTS.length];
    // poytaxt devori oddiy qasrnikidan ikki baravar baland
    return [CASTLE_X[side] + dirOf(side) * dx, z];
  }

  private castleFront(side: Side): number {
    return CASTLE_X[side] + dirOf(side) * CASTLE_FRONT;
  }

  // Qasrning o'rtasi (tutun va effektlar uchun)
  private castleMid(side: Side): number {
    return CASTLE_X[side] + (dirOf(side) * (CASTLE_FRONT - CASTLE_DEPTH)) / 2;
  }

  // rejim: 'run' — yugurish (hujum, chekinish, safga qaytish), 'walk' — odatiy yurish (konchi ishi),
  // 'slow' — safda joyni sozlash: sekin qadam
  private moveTo(u: Unit, x: number, dt: number, mode: 'run' | 'walk' | 'slow' = 'run'): boolean {
    const d = x - u.x;
    if (Math.abs(d) < 3) {
      u.x = x;
      return true;
    }
    const carry = u.kind === 'konchi' && u.load > 0;
    const speed = u.speed * (carry ? CARRY_SLOW : 1) * (mode === 'slow' ? 0.6 : mode === 'run' ? RUN_FAST : 1); // savat og'ir
    const step = Math.min(Math.abs(d), speed * dt);
    u.x += Math.sign(d) * step;
    u.walkDist += step;
    u.facing = d > 0 ? 1 : -1;
    u.anim = carry ? 'carry' : mode === 'run' ? 'run' : 'walk';
    return false;
  }

  private updateUnit(u: Unit, dt: number): void {
    u.animT += dt;
    u.hitT -= dt;
    if (u.dead) {
      u.deadT += dt;
      return;
    }
    u.cdLeft -= dt;
    u.promoteT -= dt;
    const s = this.sides[u.side];
    const gate = CASTLE_X[u.side];

    if (u.doorDir !== 0) {
      this.updateDoor(u, dt);
      return;
    }
    if (u.garrison) {
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * HEAL_RATE * dt); // qasr ichida tuzaladi
      if (s.stance === 'chekinish') return;
      // Chekinish tugadi: darvozadan chiqadi
      u.garrison = false;
      u.x = gate;
      u.facing = dirOf(u.side);
      u.doorDir = -1;
      if (u.kind === 'konchi') {
        this.deliver(u);
        u.task = 'toMine';
      }
      return;
    }
    if (u.swingT >= 0 && this.updateSwing(u, dt)) return;
    if (s.stance === 'chekinish') {
      u.raid = 0;
      if (u.inside) {
        if (u.task === 'inMine') {
          // kondan chiqib qasrga yuguradi
          u.inside = false;
          u.task = 'toCastle';
          u.facing = (-dirOf(u.side)) as 1 | -1;
          u.doorDir = -1;
        } else u.garrison = true; // darvoza ichida — shu yerda qoladi
        return;
      }
      if (this.moveTo(u, gate, dt)) {
        u.toGarrison = true;
        u.facing = (-dirOf(u.side)) as 1 | -1;
        u.doorDir = 1;
      }
      return;
    }
    if (u.kind === 'konchi') {
      this.updateMiner(u, dt);
      return;
    }

    const dir = dirOf(u.side);
    const other: Side = u.side === 0 ? 1 : 0;
    if (u.raid > 0) {
      u.raid -= dt;
      if (u.hp < u.maxHp * 0.4) u.raid = 0; // yarador — qaytadi
    }
    const raiding = u.raid > 0;
    u.kiteCd -= dt;
    if (u.kite > 0) {
      this.backStep(u, dt);
      return;
    }
    const target = this.pickTarget(u, s, raiding, dt);
    u.guard = false;
    if (target) {
      this.engage(u, target.x, Math.abs(target.x - u.x), dt, target.id, -1, target.y);
      // yaqin jang: qalqonli askar qalqonini ko'taradi
      u.guard = Math.abs(target.x - u.x) < 95 && u.anim !== 'run';
      return;
    }
    u.target = -1;
    if (raiding) {
      // Reyd: dushman konlari tomon, konchilarni izlab
      this.moveTo(u, mineX(other), dt, 'run');
      return;
    }
    if (s.stance === 'hujum') {
      const front = this.castleFront(other);
      const d = Math.max(0, (front - u.x) * dir);
      // qasr oldida hamma bir joyda emas: har biri o'z chuqurligida, biroz oldinroq-orqaroq
      const ty = 6 + ((u.id * 17) % (DEPTH - 12));
      this.engage(u, front, d + (u.id % 4) * 5, dt, -1, other, ty);
      return;
    }
    // Joyida tur: uzoq bo'lsa yuguradi, yaqinda sekin qadam bilan joylashadi
    if (this.moveTo(u, u.slotX, dt, Math.abs(u.slotX - u.x) > 60 ? 'run' : 'slow')) {
      u.facing = dir;
      u.anim = 'idle';
    }
    this.drift(u, u.slotY, dt);
  }

  // Nishon tanlash: eng yaqin (chuqurlik bilan), lekin bitta dushmanga hamma yopirilmasin —
  // allaqachon urilayotganlar "uzoqroq" hisoblanadi. Tanlangan nishon bir ozgina vaqtga qulflanadi
  private pickTarget(u: Unit, s: SideState, raiding: boolean, dt: number): Unit | null {
    const dir = dirOf(u.side);
    const aggro = s.stance === 'hujum' || raiding ? 320 : u.range + 240;
    const zoneEdge = CASTLE_X[u.side] + dir * (s.front + 220);
    const ok = (e: Unit | undefined, reach: number): e is Unit => {
      if (!e || e.side === u.side || !targetable(e)) return false;
      const dx = Math.abs(e.x - u.x);
      if (dx > reach) return false;
      // himoya hududidan tashqarida turganlarga chiqmaydi
      return raiding || s.stance !== 'tur' || (e.x - zoneEdge) * dir <= 0 || dx <= u.range;
    };
    u.retargetT -= dt;
    const cur = u.target >= 0 ? this.byId.get(u.target) : undefined;
    if (u.retargetT > 0 && ok(cur, aggro * 1.25)) return cur;
    const melee = u.kind !== 'kamonchi';
    let best = Infinity;
    let pick: Unit | null = null;
    for (const e of this.foes[u.side]) {
      if (!ok(e, aggro)) continue;
      const d = Math.hypot(e.x - u.x, (e.y - u.y) * 1.5) + (melee ? (this.attackers.get(e.id) ?? 0) * 20 : 0);
      if (d < best) {
        best = d;
        pick = e;
      }
    }
    if (pick !== cur) {
      if (cur) this.attackers.set(cur.id, Math.max(0, (this.attackers.get(cur.id) ?? 1) - 1));
      if (pick && melee) this.attackers.set(pick.id, (this.attackers.get(pick.id) ?? 0) + 1);
    }
    u.target = pick ? pick.id : -1;
    u.retargetT = 0.7 + this.rand() * 0.6;
    return pick;
  }

  // Kamonchi: dushman yaqinlashib qolsa, o'q otishdan oldin orqaga bir necha qadam tashlaydi
  private backStep(u: Unit, dt: number): void {
    const dir = dirOf(u.side);
    u.kite -= dt;
    const step = u.speed * 0.7 * dt;
    u.x -= dir * step;
    u.walkDist -= step; // orqaga yurish: qadam sikli teskari
    u.anim = 'walk';
    u.guard = true;
    if ((u.x - CASTLE_X[u.side]) * dir < 80) u.kite = 0;
  }

  // Zarba harakati: qilich ko'tariladi, tushadi (shu lahzada tegadi), qaytadi. true — askar band
  private updateSwing(u: Unit, dt: number): boolean {
    const archer = u.kind === 'kamonchi';
    const dur = Math.min(archer ? SHOOT : SWING, u.cd * 0.95);
    const hitAt = (archer ? RELEASE : HIT) * (dur / (archer ? SHOOT : SWING));
    u.swingT += dt;
    u.anim = 'attack';
    if (!u.swingDone && u.swingT >= hitAt) {
      u.swingDone = true;
      if (u.swingCastle !== -1) this.strikeCastle(u, u.swingCastle);
      else {
        const t = this.units.find((e) => e.id === u.swingTarget);
        if (t && targetable(t) && (archer || Math.abs(t.x - u.x) <= u.range * 1.5)) this.strike(u, t);
      }
    }
    if (u.swingT >= dur) {
      u.swingT = -1;
      u.anim = 'idle';
      return false;
    }
    return true;
  }

  private drift(u: Unit, y: number, dt: number, speed = 25): void {
    const d = y - u.y;
    u.y += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
  }

  private engage(u: Unit, tx: number, d: number, dt: number, target: number, castle: Side | -1, ty: number): void {
    const archer = u.kind === 'kamonchi';
    const inX = d <= u.range * u.reach;
    // yaqin jangchi nishonning yonida (chuqurlikda ham) turishi kerak; kamonchiga chuqurlik shart emas
    const inY = archer || Math.abs(ty - u.y) <= 20;
    if (inX && inY) {
      u.facing = tx >= u.x ? 1 : -1;
      u.anim = 'idle';
      if (archer) u.aimD = d;
      // dushman juda yaqin: kamonchi sakrab orqaga chiqadi (otish navbatiga ulgurmasa)
      if (archer && castle === -1 && d < 42 && u.kiteCd <= 0 && u.cdLeft > u.cd * 0.3 && (u.x - CASTLE_X[u.side]) * dirOf(u.side) > 110) {
        u.kite = 0.55;
        u.kiteCd = 2.4;
        return;
      }
      if (u.cdLeft <= 0) {
        u.cdLeft = u.cd;
        u.swingT = 0;
        u.swingDone = false;
        u.swingTarget = target;
        u.swingCastle = castle;
        u.swingVar = Math.floor(this.rand() * 3);
        u.swingAlt = u.swingVar === 1;
        u.anim = 'attack';
      }
      return;
    }
    // masofa yetguncha yuguradi (yetgach keyingi qadamda to'xtaydi)
    if (!inX) this.moveTo(u, tx, dt, 'run');
    // chuqurlik bo'yicha nishonga yaqinlashadi: ularning o'rtasida har xil joyda turish uchun kichik siljish
    const off = castle !== -1 ? 0 : ((u.id % 5) - 2) * 4;
    this.drift(u, Math.max(2, Math.min(DEPTH - 2, ty + off)), dt, 42);
  }

  private strike(u: Unit, t: Unit): void {
    if (u.kind === 'kamonchi') {
      this.fireArrow(u.side, u.kind, u.dmg, u.x + u.facing * 14, 46, t, -1, false);
      return;
    }
    this.hurt(t, u.dmg * vsMult(u.kind, t.kind), u.facing);
    // zarba silkitadi: nishon biroz orqaga suriladi (yiqilmagan bo'lsa)
    if (!t.dead && !t.inside && !t.garrison && t.door === 0) t.x += u.facing * (t.kind === 'amir' ? 0 : 0);
    for (let i = 0; i < 4; i++) this.particles.push(this.dust(t.x - u.facing * 6, t.y, 34 + this.rand() * 20, 'spark'));
  }

  private strikeCastle(u: Unit, side: Side): void {
    if (u.kind === 'kamonchi') {
      // Dushman qasrga olovli o'q otadi
      this.fireArrow(u.side, u.kind, u.dmg, u.x + u.facing * 14, 46, null, side, u.side === 1);
      return;
    }
    this.hurtCastle(side, u.dmg, false);
    this.particles.push(this.dust(this.castleFront(side), 20, 30 + this.rand() * 60, 'dust'));
  }

  private hurt(t: Unit, amount: number, dir = 0): void {
    if (t.dead) return;
    t.hp -= amount;
    t.hitT = 0.22;
    if (dir) t.hitDir = dir;
    if (t.hp <= 0) this.kill(t);
  }

  private kill(u: Unit): void {
    u.dead = true;
    u.deadT = 0;
    u.hp = 0;
    u.swingT = -1;
    for (let i = 0; i < 6; i++) this.particles.push(this.dust(u.x, u.y, 10 + this.rand() * 10, 'dust'));
    if (u.kind === 'amir') {
      // Eng yaqin askar Amir bo'ladi; hech kim qolmagan bo'lsa — qasrdan yangisi chiqadi
      let heir: Unit | null = null;
      for (const h of this.units) {
        if (h.side !== u.side || h.dead || h.kind === 'konchi' || h.kind === 'amir') continue;
        const score = Math.abs(h.x - u.x) + (h.garrison ? 5000 : 0);
        if (!heir || score < Math.abs(heir.x - u.x) + (heir.garrison ? 5000 : 0)) heir = h;
      }
      if (heir) {
        const name = STATS[heir.kind].name;
        this.promote(heir);
        this.events.push({ text: `Amir halok bo'ldi — ${name} yangi Amir bo'ldi!`, good: false, amir: 'heir' });
      } else {
        const s = this.sides[u.side];
        s.amirDead = true;
        s.amirTimer = AMIR_RESPAWN;
        this.events.push({ text: `Amir halok bo'ldi! ${AMIR_RESPAWN} soniyadan keyin qasrdan yangi Amir chiqadi`, good: false, amir: 'dead' });
      }
    }
  }

  private promote(h: Unit): void {
    const s = this.sides[h.side];
    const st = STATS.amir;
    h.kind = 'amir';
    h.rank = 'oddiy';
    h.maxHp = st.hp * s.hpMult.amir;
    h.hp = h.maxHp;
    h.dmg = st.dmg * s.dmgMult.amir;
    h.range = st.range;
    h.cd = st.cd / s.attackSpeed;
    h.speed = st.speed * s.speedMult;
    h.swingT = -1;
    h.promoteT = 1.5;
  }

  private hurtCastle(side: Side, amount: number, fire: boolean): void {
    const s = this.sides[side];
    s.castleHp -= amount * (fire ? FIRE_MULT : 1);
  }

  // Konchi: kon og'ziga kirib ketadi, ichkarida qazib, savat bilan chiqadi, qasr darvozasiga kirib
  // kumushni topshiradi (balansga o'zi qo'shiladi) va yana chiqib konga ketadi
  private updateMiner(u: Unit, dt: number): void {
    const dir = dirOf(u.side);
    switch (u.task) {
      case 'toMine':
        if (this.moveTo(u, mineX(u.side) + u.mineSpot, dt, 'walk')) {
          u.task = 'inMine';
          u.facing = dir;
          u.doorDir = 1;
        }
        break;
      case 'inMine':
        u.mineT -= dt;
        if (u.mineT <= 0) {
          u.load = this.sides[u.side].minerLoad;
          u.task = 'toCastle';
          u.inside = false;
          u.facing = (-dir) as 1 | -1;
          u.doorDir = -1;
        }
        break;
      case 'toCastle':
        if (this.moveTo(u, CASTLE_X[u.side], dt, 'walk')) {
          u.task = 'unload';
          u.facing = (-dir) as 1 | -1;
          u.doorDir = 1;
        }
        break;
      case 'unload':
        u.mineT -= dt;
        if (u.mineT <= 0) {
          u.task = 'toMine';
          u.inside = false;
          u.facing = dir;
          u.doorDir = -1;
        }
        break;
    }
    if (u.doorDir === 0) this.drift(u, 16 + u.mineSpot, dt);
  }

  // Darvoza yoki konga kirib-chiqish: kirayotgan askar orqaga (devor tomonga) siljib qorong'ilikka singadi
  private updateDoor(u: Unit, dt: number): void {
    // chiqish sekinroq va ko'rinarli: askar qorong'ilikdan oddiy qadam bilan yurib chiqadi
    const out = u.doorDir < 0;
    u.door += (u.doorDir * dt) / (out ? DOOR_TIME * 1.7 : DOOR_TIME);
    u.anim = u.kind === 'konchi' && u.load > 0 ? 'carry' : 'walk';
    const stride = u.speed * dt * (out ? 0.5 : 0.35);
    u.walkDist += stride;
    if (u.doorDir > 0) {
      u.x += u.facing * stride; // ichkariga qarab yuradi
      u.y += (2 - u.y) * Math.min(1, dt * 8);
      if (u.door >= 1) {
        u.door = 1;
        u.doorDir = 0;
        u.inside = true;
        if (u.toGarrison) {
          u.toGarrison = false;
          u.garrison = true;
        } else if (u.kind === 'konchi') {
          const s = this.sides[u.side];
          if (u.task === 'inMine') u.mineT = s.mineTime / s.minerSpeed;
          else if (u.task === 'unload') {
            this.deliver(u);
            u.mineT = 0.35;
          }
        }
      }
    } else {
      u.x += u.facing * stride;
      if (u.door <= 0) {
        u.door = 0;
        u.doorDir = 0;
        u.inside = false;
      }
    }
  }

  // Kumush balansga o'zi qo'shiladi; o'yinchida qasr ustida "+30" chiqadi
  private deliver(u: Unit): void {
    if (u.load <= 0) return;
    const s = this.sides[u.side];
    s.silver += u.load * s.income;
    if (u.side === 0) this.popups.push({ x: CASTLE_X[0], z: 130, text: `+${Math.round(u.load)}`, t: 0 });
    u.load = 0;
  }

  // ---------------- O'qlar ----------------

  private fireArrow(side: Side, kind: Kind | null, dmg: number, x: number, z: number, t: Unit | null, castle: Side | -1, fire: boolean): void {
    const tx = t ? t.x : this.castleFront(castle as Side) - dirOf(castle as Side) * this.rand() * (CASTLE_FRONT + CASTLE_DEPTH * 0.6);
    const tz = t ? 36 : 30 + this.rand() * 150;
    const dist = Math.hypot(tx - x, tz - z);
    this.shots.push({
      side, kind, dmg, fire,
      target: t ? t.id : -1,
      castle,
      sx: x, sz: z,
      tx, ty: t ? t.y : 10 + this.rand() * 20, tz,
      x, y: t ? t.y : 20, z,
      t: 0,
      dur: dist / ARROW_SPEED + 0.05,
      arc: Math.min(110, dist * 0.18),
      smokeT: 0,
    });
  }

  private castleShoot(side: Side, dt: number): void {
    const s = this.sides[side];
    const cx = CASTLE_X[side];
    const enemies = this.enemiesOf(side).filter((e) => Math.abs(e.x - cx) <= CASTLE_RANGE);
    if (!enemies.length) {
      s.castleCd = Math.max(s.castleCd - dt, 0);
      return;
    }
    const nearest = () => enemies.reduce((a, b) => (Math.abs(a.x - cx) < Math.abs(b.x - cx) ? a : b));
    s.castleCd -= dt;
    if (s.castleCd <= 0) {
      s.castleCd = CASTLE_CD;
      const [wx, wz] = this.wallPoint(side, 0);
      this.fireArrow(side, null, s.castleDmg, wx, wz + 30, nearest(), -1, false);
    }
    // Qasrga kirgan kamonchilar devor tepasidan otadi
    let spot = 1;
    for (const u of this.units) {
      if (u.side !== side || !u.garrison || u.dead || u.kind !== 'kamonchi') continue;
      const i = spot++;
      if (u.cdLeft > 0) continue;
      u.cdLeft = u.cd;
      const [wx, wz] = this.wallPoint(side, i);
      this.fireArrow(side, 'kamonchi', u.dmg, wx, wz + 30, nearest(), -1, side === 1);
    }
  }

  private updateShots(dt: number): void {
    const byId = new Map(this.units.map((u) => [u.id, u]));
    for (const sh of this.shots) {
      sh.t += dt;
      if (sh.target >= 0) {
        const t = byId.get(sh.target);
        if (t && targetable(t)) {
          sh.tx = t.x;
          sh.ty = t.y;
        }
      }
      const p = Math.min(1, sh.t / sh.dur);
      sh.x = sh.sx + (sh.tx - sh.sx) * p;
      sh.y += (sh.ty - sh.y) * Math.min(1, dt * 8);
      sh.z = sh.sz + (sh.tz - sh.sz) * p + Math.sin(Math.PI * p) * sh.arc;
      if (sh.fire) {
        sh.smokeT -= dt;
        if (sh.smokeT <= 0) {
          sh.smokeT = 0.03;
          this.smoke(sh.x, sh.z, 0.6, sh.y);
        }
      }
      if (p >= 1) {
        if (sh.target >= 0) {
          const t = byId.get(sh.target);
          if (t && targetable(t)) {
            const vs = sh.kind ? vsMult(sh.kind, t.kind) : 1;
            this.hurt(t, sh.dmg * vs * this.sides[t.side].arrowTaken, dirOf(sh.side));
          }
        } else if (sh.castle !== -1) {
          this.hurtCastle(sh.castle, sh.dmg, sh.fire);
          if (sh.fire) for (let i = 0; i < 4; i++) this.smoke(sh.x, sh.z, 1.2);
        }
      }
    }
    this.shots = this.shots.filter((sh) => sh.t < sh.dur);
  }

  // Reyd: AI tanlagan askarlarni dushman konchilariga yuboradi
  sendRaid(ids: number[], seconds: number): void {
    for (const u of this.units) if (ids.includes(u.id)) u.raid = seconds;
  }

  // ---------------- Effektlar ----------------

  private smoke(x: number, z: number, life: number, y = 0): void {
    this.particles.push({
      kind: 'smoke', x, y, z,
      vx: (this.rand() - 0.5) * 20, vz: 18 + this.rand() * 20,
      life, max: life, size: 6 + this.rand() * 8,
    });
  }

  private dust(x: number, y: number, z: number, kind: 'spark' | 'dust'): Particle {
    return {
      kind, x, y, z,
      vx: (this.rand() - 0.5) * 80, vz: 20 + this.rand() * 60,
      life: 0.4, max: 0.4, size: kind === 'spark' ? 2 : 5,
    };
  }

  private updateFx(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (p.kind === 'cloud') p.size += 20 * dt;
      else if (p.kind !== 'smoke') p.vz -= 200 * dt;
      else p.size += 10 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    // Shikastlangan qasrdan tutun chiqadi
    for (const side of [0, 1] as Side[]) {
      const s = this.sides[side];
      const dmg = 1 - s.castleHp / s.castleMax;
      if (dmg > 0.4 && this.rand() < dmg * dt * 6) {
        this.smoke(this.castleMid(side) + (this.rand() - 0.5) * 300, 120 + this.rand() * 100, 2.5);
      }
    }
  }
}
