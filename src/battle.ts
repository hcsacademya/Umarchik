// Jang simulyatsiyasi: grafikasiz, faqat mantiq. Har qadam step(dt) bilan yuradi.
import {
  AMIR_RESPAWN, BATTLES, BOOST_EFFECT, CASTLE_CD, CASTLE_DMG, CASTLE_FRONT, CASTLE_HP, CASTLE_RANGE, CASTLE_X, DEPTH,
  FACTIONS, FIRE_MULT, FORMATION_FRONT, MAX_MINERS, MINE_OFFSET, MINE_TIME, MINER_LOAD, MINER_UP, QUEUE_MAX,
  RANK, ROW_GAP, ROW_SIZE, START_SILVER, STATS, STOCK_CAP, UNIT_UP_STEP, enemyCastleHp, enemyIncome, enemyStats,
  itemOf, popCap, vsMult,
} from './config.ts';
import type { BoostId, Item, ItemId, Kind, Rank, Side, Stance } from './config.ts';
import { itemsFor, startForce, stepFor } from './campaign.ts';
import type { Save } from './campaign.ts';
import { EnemyAI } from './ai.ts';

export type Anim = 'idle' | 'walk' | 'attack' | 'mine' | 'carry';
type Task = 'toMine' | 'mining' | 'toCastle' | 'wait';

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
  attackT: number;
  hitT: number;
  garrison: boolean;
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
  t: number;
  dur: number;
  arc: number;
  smokeT: number;
}

export interface Particle {
  kind: 'smoke' | 'spark' | 'dust';
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
  stock: number; // qasr yonida yig'ilgan, hali olinmagan kumush (faqat o'yinchida)
  stockCap: number;
  stance: Stance;
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
  arrowTaken: number;
  income: number;
  amirDead: boolean;
  amirTimer: number;
}

export interface BattleEvent {
  text: string;
  good: boolean;
}

export type BuyError = 'kumush' | 'joy' | 'navbat' | 'konchi' | 'bor' | 'yopiq';

export function dirOf(side: Side): 1 | -1 {
  return side === 0 ? 1 : -1;
}

export function mineX(side: Side): number {
  return CASTLE_X[side] + dirOf(side) * MINE_OFFSET;
}

export function itemPop(it: Item): number {
  return STATS[it.kind].pop * (1 + it.escorts);
}

const ARROW_SPEED = 650;
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
  sides: [SideState, SideState];
  winner: Side | null = null;
  overT = 0;
  events: BattleEvent[] = [];
  private nextId = 1;
  private seed: number;
  private ai: EnemyAI;

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
        stock: 0,
        stockCap: STOCK_CAP + 100 * up.ombor,
        stance: 'tur',
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
        arrowTaken: 1,
        income: 1,
        amirDead: false,
        amirTimer: 0,
      },
      {
        silver: START_SILVER,
        stock: 0,
        stockCap: Infinity,
        stance: 'tur',
        castleHp: enemyCastleHp(level),
        castleMax: enemyCastleHp(level),
        castleDmg: CASTLE_DMG * eMult,
        castleCd: 1,
        items: itemsFor(stepFor(1, level)),
        popCap: popCap(stepFor(1, level)),
        queue: [],
        queueT: 0,
        bought: new Set(),
        hpMult: perKind((k) => eMult * (k === 'konchi' ? 1 : fac.hp)),
        dmgMult: perKind(() => eMult),
        speedMult: fac.speed,
        attackSpeed: 1,
        trainSpeed: 1,
        minerSpeed: 1,
        minerLoad: MINER_LOAD,
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

  // Qasr yonidagi kumushni olish (o'yinchi bosganda)
  collect(): number {
    const s = this.sides[0];
    const got = s.stock;
    s.silver += got;
    s.stock = 0;
    return got;
  }

  setStance(side: Side, st: Stance): void {
    const s = this.sides[side];
    if (s.amirDead) return; // Amir qaytguncha qo'shin qasrda
    s.stance = st;
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
      speed: st.speed * (kind === 'konchi' ? s.minerSpeed : s.speedMult),
      cdLeft: this.rand() * st.cd,
      facing: dir,
      anim: 'idle',
      animT: this.rand() * 2,
      attackT: 0,
      hitT: 0,
      garrison: false,
      dead: false,
      deadT: 0,
      reach: 0.75 + this.rand() * 0.25,
      slotX: CASTLE_X[side],
      slotY: DEPTH / 2,
      raid: 0,
      task: 'toMine',
      load: 0,
      mineT: 0,
      mineSpot: (this.rand() - 0.5) * 50,
    };
    if (kind === 'konchi' && initial) u.x = mineX(side) - dir * 60 + u.mineSpot;
    if (!initial && s.stance === 'chekinish') u.garrison = true;
    this.units.push(u);
    return u;
  }

  private spawnItem(side: Side, it: Item): void {
    this.spawn(side, it.kind, it.rank);
    for (let i = 0; i < it.escorts; i++) this.spawn(side, it.kind, 'oddiy');
  }

  // ---------------- Saf ("Joyida tur") ----------------

  private assignSlots(): void {
    for (const side of [0, 1] as Side[]) {
      const dir = dirOf(side);
      const groups: Unit[][] = [[], [], [], [], [], []];
      for (const u of this.units) {
        if (u.side !== side || u.dead || u.kind === 'konchi') continue;
        let g: number;
        if (u.rank !== 'oddiy') g = 0; // sarkardalar va qo'mondon Amirni oldinda himoya qiladi
        else if (u.kind === 'otliq') g = 1;
        else if (u.kind === 'amir') g = 2;
        else if (u.kind === 'qilichli') g = 3;
        else if (u.kind === 'nayzachi') g = 4;
        else g = 5;
        groups[g].push(u);
      }
      let back = 0; // oldingi qatordan orqaga masofa
      for (let g = 0; g < groups.length; g++) {
        const list = groups[g].sort((a, b) => a.id - b.id);
        const gap = g <= 1 ? ROW_GAP * 1.5 : ROW_GAP;
        for (let i = 0; i < list.length; i += ROW_SIZE) {
          const row = list.slice(i, i + ROW_SIZE);
          const off = ((ROW_SIZE - row.length) / 2) * 8;
          row.forEach((u, j) => {
            u.slotX = CASTLE_X[side] + dir * (FORMATION_FRONT - back);
            u.slotY = 4 + off + j * 8;
          });
          back += gap;
        }
      }
    }
  }

  // ---------------- Qadam ----------------

  step(dt: number): void {
    if (this.winner !== null) {
      this.overT += dt;
      this.updateFx(dt);
      return;
    }
    this.time += dt;
    for (const side of [0, 1] as Side[]) this.updateSide(side, dt);
    this.assignSlots();
    for (const u of this.units) this.updateUnit(u, dt);
    for (const side of [0, 1] as Side[]) this.castleShoot(side, dt);
    this.updateShots(dt);
    this.updateFx(dt);
    this.units = this.units.filter((u) => !u.dead || u.deadT < 1.2);
    this.ai.update(this, dt);
    for (const side of [0, 1] as Side[]) {
      if (this.sides[side].castleHp <= 0) {
        this.sides[side].castleHp = 0;
        this.winner = side === 0 ? 1 : 0;
        for (let i = 0; i < 30; i++) this.smoke(CASTLE_X[side] + (this.rand() - 0.5) * 220, 20 + this.rand() * 150, 1.5);
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
        s.stance = 'tur';
        this.spawn(side, 'amir', 'oddiy');
        this.events.push({ text: 'Yangi Amir maydonga chiqdi!', good: true });
      }
    }
  }

  private enemiesOf(side: Side): Unit[] {
    return this.units.filter((e) => e.side !== side && !e.dead && !e.garrison);
  }

  private castleFront(side: Side): number {
    return CASTLE_X[side] + dirOf(side) * CASTLE_FRONT;
  }

  private moveTo(u: Unit, x: number, dt: number): boolean {
    const d = x - u.x;
    if (Math.abs(d) < 3) {
      u.x = x;
      return true;
    }
    const step = Math.min(Math.abs(d), u.speed * dt);
    u.x += Math.sign(d) * step;
    u.facing = d > 0 ? 1 : -1;
    u.anim = u.kind === 'konchi' && u.load > 0 ? 'carry' : 'walk';
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
    u.attackT -= dt;
    const s = this.sides[u.side];
    const gate = CASTLE_X[u.side];

    if (u.garrison) {
      if (s.stance === 'chekinish') return;
      u.garrison = false;
      u.x = gate + dirOf(u.side) * 10;
    }
    if (s.stance === 'chekinish') {
      u.raid = 0;
      if (this.moveTo(u, gate, dt)) u.garrison = true;
      return;
    }
    if (u.kind === 'konchi') {
      this.updateMiner(u, dt);
      return;
    }

    const dir = dirOf(u.side);
    const other: Side = u.side === 0 ? 1 : 0;
    const enemies = this.enemiesOf(u.side);
    if (u.raid > 0) {
      u.raid -= dt;
      if (u.hp < u.maxHp * 0.4) u.raid = 0; // yarador — qaytadi
    }
    const raiding = u.raid > 0;
    let target: Unit | null = null;
    let best = Infinity;
    const aggro = s.stance === 'hujum' || raiding ? 320 : u.range + 240;
    const zoneEdge = CASTLE_X[u.side] + dir * (FORMATION_FRONT + 220);
    for (const e of enemies) {
      const d = Math.abs(e.x - u.x);
      if (d > aggro || d >= best) continue;
      if (!raiding && s.stance === 'tur' && (e.x - zoneEdge) * dir > 0 && d > u.range) continue; // himoya hududidan tashqarida
      best = d;
      target = e;
    }

    if (target) {
      this.engage(u, target.x, best, dt, () => this.strike(u, target!));
      if (u.anim !== 'walk') this.drift(u, target.y, dt);
      return;
    }
    if (raiding) {
      // Reyd: dushman konlari tomon, konchilarni izlab
      this.moveTo(u, mineX(other), dt);
      return;
    }
    if (s.stance === 'hujum') {
      const front = this.castleFront(other);
      const d = Math.max(0, (front - u.x) * dir);
      this.engage(u, front, d, dt, () => this.strikeCastle(u, other));
      return;
    }
    // Joyida tur
    if (this.moveTo(u, u.slotX, dt)) {
      u.facing = dir;
      if (u.attackT <= 0) u.anim = 'idle';
    }
    this.drift(u, u.slotY, dt);
  }

  private drift(u: Unit, y: number, dt: number): void {
    const d = y - u.y;
    u.y += Math.sign(d) * Math.min(Math.abs(d), 25 * dt);
  }

  private engage(u: Unit, tx: number, d: number, dt: number, hit: () => void): void {
    if (d <= u.range * u.reach) {
      u.facing = tx >= u.x ? 1 : -1;
      if (u.cdLeft <= 0) {
        u.cdLeft = u.cd;
        u.attackT = 0.35;
        hit();
      }
      u.anim = u.attackT > 0 ? 'attack' : 'idle';
    } else {
      this.moveTo(u, tx, dt);
    }
  }

  private strike(u: Unit, t: Unit): void {
    if (u.kind === 'kamonchi') {
      this.fireArrow(u.side, u.kind, u.dmg, u.x + u.facing * 20, 70, t, -1, false);
      return;
    }
    this.hurt(t, u.dmg * vsMult(u.kind, t.kind));
    for (let i = 0; i < 3; i++) this.particles.push(this.dust(t.x, t.y, 50 + this.rand() * 30, 'spark'));
  }

  private strikeCastle(u: Unit, side: Side): void {
    if (u.kind === 'kamonchi') {
      // Dushman qasrga olovli o'q otadi
      this.fireArrow(u.side, u.kind, u.dmg, u.x + u.facing * 20, 70, null, side, u.side === 1);
      return;
    }
    this.hurtCastle(side, u.dmg, false);
    this.particles.push(this.dust(this.castleFront(side), 20, 30 + this.rand() * 60, 'dust'));
  }

  private hurt(t: Unit, amount: number): void {
    if (t.dead) return;
    t.hp -= amount;
    t.hitT = 0.15;
    if (t.hp <= 0) this.kill(t);
  }

  private kill(u: Unit): void {
    u.dead = true;
    u.deadT = 0;
    u.hp = 0;
    if (u.kind === 'amir') {
      const s = this.sides[u.side];
      s.amirDead = true;
      s.amirTimer = AMIR_RESPAWN;
      s.stance = 'chekinish';
      this.events.push({ text: `Amir halok bo'ldi! Qo'shin qasrga chekinmoqda — ${AMIR_RESPAWN} soniyadan keyin yangi Amir chiqadi`, good: false });
    }
  }

  private hurtCastle(side: Side, amount: number, fire: boolean): void {
    const s = this.sides[side];
    s.castleHp -= amount * (fire ? FIRE_MULT : 1);
  }

  private updateMiner(u: Unit, dt: number): void {
    const s = this.sides[u.side];
    const dir = dirOf(u.side);
    const spot = mineX(u.side) - dir * 25 + u.mineSpot;
    const gate = CASTLE_X[u.side] + dir * 20;
    switch (u.task) {
      case 'toMine':
        if (this.moveTo(u, spot, dt)) {
          u.task = 'mining';
          u.mineT = MINE_TIME / s.minerSpeed;
          u.facing = dir;
        }
        break;
      case 'mining':
        u.anim = 'mine';
        u.mineT -= dt;
        if (u.mineT <= 0) {
          u.load = s.minerLoad;
          u.task = 'toCastle';
        }
        break;
      case 'toCastle':
        if (this.moveTo(u, gate, dt)) u.task = 'wait';
        break;
      case 'wait': {
        u.anim = 'carry';
        if (u.side === 1) {
          s.silver += u.load * s.income;
          u.load = 0;
        } else {
          const put = Math.min(u.load, s.stockCap - s.stock);
          s.stock += put;
          u.load -= put;
        }
        if (u.load <= 0) {
          u.load = 0;
          u.task = 'toMine';
        } else {
          u.anim = 'idle';
        }
        break;
      }
    }
    this.drift(u, 30 + (u.mineSpot / 50) * 10, dt);
  }

  // ---------------- O'qlar ----------------

  private fireArrow(side: Side, kind: Kind | null, dmg: number, x: number, z: number, t: Unit | null, castle: Side | -1, fire: boolean): void {
    const tx = t ? t.x : this.castleFront(castle as Side) + dirOf(castle as Side) * this.rand() * 60;
    const tz = t ? 50 : 40 + this.rand() * 160;
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
      this.fireArrow(side, null, s.castleDmg, cx + dirOf(side) * 60, 210, nearest(), -1, false);
    }
    // Qasr ichidagi kamonchilar ham otadi
    for (const u of this.units) {
      if (u.side !== side || !u.garrison || u.dead || u.kind !== 'kamonchi' || u.cdLeft > 0) continue;
      u.cdLeft = u.cd;
      this.fireArrow(side, 'kamonchi', u.dmg, cx + (this.rand() - 0.5) * 160, 160, nearest(), -1, side === 1);
    }
  }

  private updateShots(dt: number): void {
    const byId = new Map(this.units.map((u) => [u.id, u]));
    for (const sh of this.shots) {
      sh.t += dt;
      if (sh.target >= 0) {
        const t = byId.get(sh.target);
        if (t && !t.dead && !t.garrison) {
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
          if (t && !t.dead && !t.garrison) {
            const vs = sh.kind ? vsMult(sh.kind, t.kind) : 1;
            this.hurt(t, sh.dmg * vs * this.sides[t.side].arrowTaken);
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
      if (p.kind !== 'smoke') p.vz -= 200 * dt;
      else p.size += 10 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    // Shikastlangan qasrdan tutun chiqadi
    for (const side of [0, 1] as Side[]) {
      const s = this.sides[side];
      const dmg = 1 - s.castleHp / s.castleMax;
      if (dmg > 0.4 && this.rand() < dmg * dt * 6) {
        this.smoke(CASTLE_X[side] + (this.rand() - 0.5) * 200, 120 + this.rand() * 100, 2.5);
      }
    }
  }
}
