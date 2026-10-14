import { GAME, UNITS, levelMult } from '../config';
import type { Army, Faction, Terrain, Tile, UnitCat, UnitType } from '../types';
import { armyEntries, makeRng } from '../util';
import { counterMult, hasWall, sideMult } from './combat';

export const FIELD_W = 1600;
export const FIELD_H = 900;
const MAX_ENTITIES_PER_SIDE = 90;
const WALL_X = 1150;

export type Side = 0 | 1;

export type Order =
  | { kind: 'hold' }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'attack'; group: number }
  | { kind: 'charge' }
  | { kind: 'retreat' };

export interface BUnit {
  id: number;
  side: Side;
  type: UnitType;
  cat: UnitCat;
  group: number;
  hero: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  range: number;
  cooldown: number;
  cdLeft: number;
  soldiers: number;
  targetId: number;
  retarget: number;
  slotX: number;
  slotY: number;
  dead: boolean;
  escaped: boolean;
  retreating: boolean;
  hitFlash: number;
  facing: number;
  walk: number;
  /** Otliq zarbasi: uzoq yugurgandan keyin birinchi zarba kuchli. */
  chargeTime: number;
  deadAt: number;
  attackAnim: number;
}

export interface BGroup {
  id: number;
  side: Side;
  type: UnitType;
  order: Order;
  anchorX: number;
  anchorY: number;
  units: BUnit[];
}

export interface Projectile {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  targetId: number;
  dmg: number;
  attCat: UnitCat;
}

export type FeatureKind = 'hill' | 'forest' | 'river' | 'rocks' | 'snow';
export interface Feature {
  kind: FeatureKind;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface Wall {
  x: number;
  hp: number;
  maxHp: number;
}

export interface BattleSetup {
  attacker: Faction;
  defender: Faction;
  attArmy: Army;
  defArmy: Army;
  tile: Tile;
  /** O'yinchi qaysi tomonda: 0 hujumchi, 1 mudofaachi. */
  playerSide: Side;
  seed: number;
}

export interface BattleResult {
  winner: Side;
  survivors: [Army, Army];
  heroesLost: [UnitType[], UnitType[]];
  wallBroken: boolean;
  timeout: boolean;
}

export class Battle {
  readonly setup: BattleSetup;
  readonly terrain: Terrain;
  units: BUnit[] = [];
  groups: BGroup[] = [];
  projectiles: Projectile[] = [];
  features: Feature[] = [];
  wall: Wall | null = null;
  time = 0;
  readonly timeLimit = GAME.battleTimeSec;
  autoPlayer = false;
  result: BattleResult | null = null;
  events: { text: string; t: number }[] = [];
  private rnd: () => number;
  private nextId = 1;
  private aiTimer = [0, 0.5];
  private endTimer = -1;
  private mult: [number, number];

  constructor(setup: BattleSetup) {
    this.setup = setup;
    this.rnd = makeRng(setup.seed);
    this.terrain = setup.tile.terrain;
    const wall = hasWall(setup.tile);
    this.mult = [
      sideMult(setup.attacker, 'att', setup.tile, false),
      // Devor jangda alohida obyekt sifatida ishlaydi, shuning uchun ko'paytuvchida yo'q.
      sideMult(setup.defender, 'def', setup.tile, false),
    ];
    this.buildTerrain();
    if (wall) {
      const lvl = setup.tile.building === 'core' ? setup.tile.level + 1 : setup.tile.level;
      const hp = 1200 + 800 * lvl;
      this.wall = { x: WALL_X, hp, maxHp: hp };
    }
    this.spawnSide(0, setup.attArmy, setup.attacker);
    this.spawnSide(1, setup.defArmy, setup.defender);
  }

  get playerSide(): Side {
    return this.setup.playerSide;
  }

  // ---------------- Tayyorlash ----------------

  private buildTerrain(): void {
    const r = this.rnd;
    const add = (kind: FeatureKind, x: number, y: number, rx: number, ry: number) => this.features.push({ kind, x, y, rx, ry });
    switch (this.terrain) {
      case 'tog':
      case 'qorli_tog':
        add('hill', 1300, 300 + r() * 300, 220, 160);
        add('hill', 700 + r() * 200, 150 + r() * 100, 160, 100);
        add('rocks', 500 + r() * 300, 650 + r() * 150, 140, 70);
        add('rocks', 950, 480 + r() * 200, 90, 60);
        if (this.terrain === 'qorli_tog') add('snow', 800, 450, 900, 500);
        break;
      case 'orman':
        for (let i = 0; i < 7; i++) add('forest', 350 + r() * 900, 100 + r() * 700, 90 + r() * 60, 70 + r() * 50);
        break;
      case 'daryo':
        add('river', 820, 450, 60, 600);
        break;
      case 'unumdor':
      case 'vodiy':
        add('river', 620 + r() * 200, 450, 38, 600);
        add('forest', 300 + r() * 200, 120 + r() * 100, 90, 60);
        add('hill', 1200, 700, 160, 100);
        break;
      case 'chol':
        add('hill', 600 + r() * 400, 200 + r() * 500, 200, 90);
        add('rocks', 900, 600, 100, 50);
        break;
      case 'yaylov':
      case 'tekislik':
      default:
        add('hill', 700 + r() * 300, 200 + r() * 500, 170, 110);
        if (r() < 0.6) add('forest', 400 + r() * 700, 100 + r() * 700, 110, 70);
        break;
    }
  }

  private spawnSide(side: Side, army: Army, f: Faction): void {
    const entries = armyEntries(army);
    const total = entries.reduce((s, [, n]) => s + n, 0);
    const scale = Math.max(1, total / MAX_ENTITIES_PER_SIDE);
    const melee: UnitType[] = [];
    const ranged: UnitType[] = [];
    const cav: UnitType[] = [];
    const heroes: UnitType[] = [];
    for (const [k] of entries) {
      const d = UNITS[k];
      if (d.hero) heroes.push(k);
      else if (d.cat === 'kamonchi') ranged.push(k);
      else if (d.cat === 'otliq') cav.push(k);
      else melee.push(k);
    }
    const mirror = (x: number) => (side === 0 ? x : FIELD_W - x);
    const wallPush = side === 1 && this.wall ? 60 : 0;
    const place = (types: UnitType[], x: number, ys: number[]) => {
      types.forEach((k, i) => {
        const y = ys[i % ys.length] + Math.floor(i / ys.length) * 40;
        this.spawnGroup(side, k, army[k] ?? 0, scale, mirror(x) + (side === 1 ? wallPush : 0), y, f);
      });
    };
    place(melee, 400, melee.length === 1 ? [450] : [330, 570, 450]);
    place(ranged, 250, ranged.length === 1 ? [450] : [360, 540]);
    place(cav, 300, [150, 750, 450]);
    place(heroes, 170, [450, 330, 570, 220, 680]);
  }

  private spawnGroup(side: Side, type: UnitType, count: number, scale: number, cx: number, cy: number, f: Faction): void {
    if (count <= 0) return;
    const d = UNITS[type];
    const ents = d.hero ? count : Math.max(1, Math.round(count / scale));
    const per = count / ents;
    const lm = levelMult(f.unitLevels[type]);
    const m = Math.sqrt(this.mult[side]);
    const g: BGroup = { id: this.groups.length, side, type, order: { kind: 'hold' }, anchorX: cx, anchorY: cy, units: [] };
    const cols = Math.max(1, Math.ceil(Math.sqrt(ents / 2)));
    const rows = Math.ceil(ents / cols);
    const sp = d.cat === 'otliq' ? 28 : 20;
    for (let i = 0; i < ents; i++) {
      const c = Math.floor(i / rows);
      const r = i % rows;
      const slotX = (c - (cols - 1) / 2) * sp * (side === 0 ? -1 : 1);
      const slotY = (r - (rows - 1) / 2) * sp;
      const hp = d.hp * lm * per * m;
      const u: BUnit = {
        id: this.nextId++,
        side,
        type,
        cat: d.cat,
        group: g.id,
        hero: d.hero,
        x: cx + slotX,
        y: Math.max(20, Math.min(FIELD_H - 20, cy + slotY)),
        hp,
        maxHp: hp,
        atk: d.atk * lm * per * m,
        def: d.def * lm,
        speed: d.speed,
        range: d.range,
        cooldown: d.cooldown,
        cdLeft: this.rnd() * d.cooldown,
        soldiers: per,
        targetId: -1,
        retarget: 0,
        slotX,
        slotY,
        dead: false,
        escaped: false,
        retreating: false,
        hitFlash: 0,
        facing: side === 0 ? 1 : -1,
        walk: this.rnd() * 10,
        chargeTime: 0,
        deadAt: 0,
        attackAnim: 0,
      };
      g.units.push(u);
      this.units.push(u);
    }
    this.groups.push(g);
  }

  // ---------------- Buyruqlar ----------------

  canRetreat(): boolean {
    return this.time >= GAME.retreatLockSec;
  }

  command(groupId: number, order: Order): boolean {
    const g = this.groups[groupId];
    if (!g || this.result) return false;
    if (order.kind === 'retreat' && !this.canRetreat()) return false;
    if (g.order.kind === 'retreat') return false;
    g.order = order;
    if (order.kind === 'move') {
      g.anchorX = order.x;
      g.anchorY = order.y;
    }
    if (order.kind === 'retreat') for (const u of g.units) u.retreating = true;
    for (const u of g.units) u.retarget = 0;
    return true;
  }

  commandAll(side: Side, order: Order): void {
    for (const g of this.groups) if (g.side === side && this.groupAlive(g) > 0) this.command(g.id, order);
  }

  groupAlive(g: BGroup): number {
    let n = 0;
    for (const u of g.units) if (!u.dead && !u.escaped) n++;
    return n;
  }

  groupSoldiers(g: BGroup): number {
    let n = 0;
    for (const u of g.units) if (!u.dead && !u.escaped) n += u.soldiers * (u.hp / u.maxHp);
    return Math.ceil(n - 0.001);
  }

  groupCenter(g: BGroup): { x: number; y: number } | null {
    let x = 0;
    let y = 0;
    let n = 0;
    for (const u of g.units)
      if (!u.dead && !u.escaped) {
        x += u.x;
        y += u.y;
        n++;
      }
    return n ? { x: x / n, y: y / n } : null;
  }

  sideStrength(side: Side): number {
    let p = 0;
    for (const u of this.units) if (u.side === side && !u.dead && !u.escaped && !u.retreating) p += Math.sqrt(u.hp * u.atk);
    return p;
  }

  sideSoldiers(side: Side): number {
    let n = 0;
    for (const g of this.groups) if (g.side === side) n += this.groupSoldiers(g);
    return n;
  }

  // ---------------- Relyef ----------------

  featureAt(x: number, y: number, kind: FeatureKind): boolean {
    for (const f of this.features) {
      if (f.kind !== kind) continue;
      const dx = (x - f.x) / f.rx;
      const dy = (y - f.y) / f.ry;
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  }

  private speedMult(u: BUnit): number {
    let m = 1;
    if (this.featureAt(u.x, u.y, 'river')) m *= 0.45;
    if (this.featureAt(u.x, u.y, 'forest')) m *= u.cat === 'otliq' ? 0.6 : 0.8;
    if (this.featureAt(u.x, u.y, 'rocks')) m *= 0.7;
    if (this.featureAt(u.x, u.y, 'hill')) m *= 0.85;
    if (this.featureAt(u.x, u.y, 'snow')) m *= 0.8;
    if (this.terrain === 'chol' && u.cat === 'otliq') m *= 1.1;
    return m;
  }

  private wallIntact(): boolean {
    return !!this.wall && this.wall.hp > 0;
  }

  /** Mudofaachi devor ortida. */
  private behindWall(u: BUnit): boolean {
    return this.wallIntact() && u.side === 1 && u.x > this.wall!.x;
  }

  // ---------------- Simulyatsiya ----------------

  step(dt: number): void {
    if (this.result) return;
    this.time += dt;
    for (const side of [0, 1] as Side[]) {
      const ai = side !== this.playerSide || this.autoPlayer;
      this.aiTimer[side] -= dt;
      if (ai && this.aiTimer[side] <= 0) {
        this.aiTimer[side] = 1;
        this.runAi(side);
      }
    }
    // Kamonchilarni ozroq qiynash uchun hold holatidagi guruhlar ham yaqin dushmanga javob beradi.
    const alive = this.units.filter((u) => !u.dead && !u.escaped);
    for (const u of alive) this.updateUnit(u, dt, alive);
    this.separate(alive);
    this.updateProjectiles(dt);
    this.checkEnd(dt);
  }

  private enemiesOf(u: BUnit, alive: BUnit[]): BUnit[] {
    return alive.filter((e) => e.side !== u.side && !e.dead && !e.escaped);
  }

  private nearest(u: BUnit, list: BUnit[], maxD = Infinity, preferCounter = false): BUnit | null {
    let best: BUnit | null = null;
    let bd = maxD * maxD;
    for (const e of list) {
      let d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2;
      if (preferCounter && counterMult(u.cat, e.cat) > 1) d *= 0.5;
      if (e.retreating) d *= 1.4;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private effRange(u: BUnit): number {
    let r = u.range;
    if (u.cat === 'kamonchi') {
      if (this.featureAt(u.x, u.y, 'hill')) r *= 1.25;
      if (this.behindWall(u)) r *= 1.2;
    }
    return r;
  }

  private updateUnit(u: BUnit, dt: number, alive: BUnit[]): void {
    u.hitFlash = Math.max(0, u.hitFlash - dt);
    u.attackAnim = Math.max(0, u.attackAnim - dt);
    u.cdLeft -= dt;
    const g = this.groups[u.group];
    const sm = this.speedMult(u);

    if (u.retreating) {
      const ex = u.side === 0 ? -60 : FIELD_W + 60;
      this.moveToward(u, ex, u.y, u.speed * 1.1 * sm, dt);
      if ((u.side === 0 && u.x < -40) || (u.side === 1 && u.x > FIELD_W + 40)) u.escaped = true;
      return;
    }

    u.retarget -= dt;
    let target = u.targetId >= 0 ? this.units.find((e) => e.id === u.targetId && !e.dead && !e.escaped) ?? null : null;
    if (!target || u.retarget <= 0) {
      u.retarget = 0.4 + this.rnd() * 0.3;
      target = this.pickTarget(u, g, alive);
      u.targetId = target ? target.id : -1;
    }

    const range = this.effRange(u);
    if (target) {
      const dist = Math.hypot(target.x - u.x, target.y - u.y);
      // Devor buzilmagan bo'lsa hujumchi yaqin jangchilar devorga uriladi.
      const blocked = this.wallIntact() && u.cat !== 'kamonchi' && ((u.side === 0 && target.x > this.wall!.x) || (u.side === 1 && target.x < this.wall!.x));
      if (blocked && u.side === 0) {
        const wx = this.wall!.x - 12;
        if (u.x < wx - 4) {
          this.moveToward(u, wx, u.y + (target.y - u.y) * 0.3, u.speed * sm, dt);
          u.chargeTime += dt;
        } else if (dist <= range + 26) {
          this.attack(u, target);
        } else if (u.cdLeft <= 0) {
          // Devorni buzish.
          u.cdLeft = u.cooldown;
          u.attackAnim = 0.25;
          const lowHp = 0.4 + 0.6 * (u.hp / u.maxHp);
          this.wall!.hp -= u.atk * 0.7 * lowHp;
          if (this.wall!.hp <= 0) {
            this.wall!.hp = 0;
            this.events.push({ text: 'Devor buzildi!', t: this.time });
          }
        }
        u.facing = 1;
        return;
      }
      if (blocked && u.side === 1) {
        // Mudofaachi devor ortidan chiqmaydi; devor yonida turib kutadi.
        if (dist <= range + 26) this.attack(u, target);
        else this.moveToward(u, Math.max(this.wall!.x + 14, g.anchorX + u.slotX), g.anchorY + u.slotY, u.speed * sm, dt);
        return;
      }
      if (dist > range) {
        this.moveToward(u, target.x, target.y, u.speed * sm, dt);
        u.chargeTime += dt;
      } else {
        this.attack(u, target);
      }
      return;
    }

    // Nishon yo'q: o'z joyiga qaytadi.
    const tx = g.anchorX + u.slotX;
    const ty = g.anchorY + u.slotY;
    if (Math.hypot(tx - u.x, ty - u.y) > 4) {
      this.moveToward(u, tx, ty, u.speed * sm, dt);
      u.chargeTime += dt;
    } else {
      u.chargeTime = 0;
      u.facing = u.side === 0 ? 1 : -1;
    }
  }

  private pickTarget(u: BUnit, g: BGroup, alive: BUnit[]): BUnit | null {
    const enemies = this.enemiesOf(u, alive);
    if (enemies.length === 0) return null;
    const range = this.effRange(u);
    const o = g.order;
    switch (o.kind) {
      case 'attack': {
        const tg = this.groups[o.group];
        const inGroup = tg ? enemies.filter((e) => e.group === tg.id) : [];
        if (inGroup.length > 0) {
          // Kamonchi yaqin turgan boshqa dushmanni ham otadi.
          if (u.cat === 'kamonchi') {
            const t = this.nearest(u, inGroup);
            if (t && Math.hypot(t.x - u.x, t.y - u.y) > range) return t;
            return t;
          }
          return this.nearest(u, inGroup);
        }
        g.order = { kind: 'charge' };
        return this.nearest(u, enemies, Infinity, true);
      }
      case 'charge':
        return this.nearest(u, enemies, Infinity, true);
      case 'move': {
        const close = this.nearest(u, enemies, u.cat === 'kamonchi' ? range : 45);
        if (close) return close;
        return null;
      }
      case 'hold':
      default: {
        const aggro = u.cat === 'kamonchi' ? range : 110;
        // Hold: faqat o'z joyidan uncha uzoqlashmaydi.
        const t = this.nearest(u, enemies, aggro, true);
        if (t && u.cat !== 'kamonchi') {
          const fromAnchor = Math.hypot(t.x - (g.anchorX + u.slotX), t.y - (g.anchorY + u.slotY));
          if (fromAnchor > 180) return null;
        }
        return t;
      }
    }
  }

  private moveToward(u: BUnit, tx: number, ty: number, speed: number, dt: number): void {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) return;
    const step = Math.min(d, speed * dt);
    let nx = u.x + (dx / d) * step;
    const ny = u.y + (dy / d) * step;
    if (this.wallIntact() && !u.retreating) {
      const wx = this.wall!.x;
      if (u.side === 0) nx = Math.min(nx, wx - 10);
      else nx = Math.max(nx, wx + 10);
    }
    u.x = nx;
    u.y = Math.max(12, Math.min(FIELD_H - 12, ny));
    if (Math.abs(dx) > 1) u.facing = dx > 0 ? 1 : -1;
    u.walk += dt * (speed / 10);
  }

  private aura(u: BUnit): number {
    // Sarkarda / qo'mondon / amir yaqinidagilar kuchliroq.
    for (const h of this.units) {
      if (!h.hero || h.dead || h.escaped || h.side !== u.side || h === u) continue;
      if ((h.x - u.x) ** 2 + (h.y - u.y) ** 2 < 170 * 170) return 1.15;
    }
    return 1;
  }

  private attack(u: BUnit, target: BUnit): void {
    u.facing = target.x > u.x ? 1 : -1;
    if (u.cdLeft > 0) return;
    u.cdLeft = u.cooldown * (0.9 + this.rnd() * 0.2);
    u.attackAnim = 0.3;
    const strength = u.soldiers > 1.01 ? 0.4 + 0.6 * (u.hp / u.maxHp) : 1;
    let dmg = u.atk * counterMult(u.cat, target.cat) * this.aura(u) * strength;
    if (u.cat === 'otliq' && u.chargeTime > 1.2) dmg *= 1.6;
    u.chargeTime = 0;
    if (u.cat === 'kamonchi' || u.range > 60) {
      const dist = Math.hypot(target.x - u.x, target.y - u.y);
      this.projectiles.push({
        x0: u.x,
        y0: u.y - 10,
        x1: target.x,
        y1: target.y - 6,
        t: 0,
        dur: Math.max(0.25, dist / 420),
        targetId: target.id,
        dmg,
        attCat: u.cat,
      });
      return;
    }
    this.damage(target, dmg, false);
  }

  private damage(target: BUnit, raw: number, ranged: boolean): void {
    if (target.dead) return;
    let def = target.def;
    if (this.featureAt(target.x, target.y, 'hill')) def *= 1.3;
    if (this.behindWall(target)) def *= ranged ? 2.2 : 1.6;
    if (ranged && this.featureAt(target.x, target.y, 'forest') && this.rnd() < 0.4) return;
    const dmg = raw * (20 / (20 + def));
    target.hp -= dmg;
    target.hitFlash = 0.15;
    if (target.hp <= 0) {
      target.hp = 0;
      target.dead = true;
      target.deadAt = this.time;
      if (target.hero) this.events.push({ text: `${UNITS[target.type].name} jangda yiqildi!`, t: this.time });
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.t >= p.dur) {
        const tgt = this.units.find((u) => u.id === p.targetId);
        if (tgt && !tgt.dead && !tgt.escaped && Math.hypot(tgt.x - p.x1, tgt.y - 6 - p.y1) < 30) this.damage(tgt, p.dmg, true);
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.t < p.dur);
  }

  private separate(alive: BUnit[]): void {
    const n = alive.length;
    for (let i = 0; i < n; i++) {
      const a = alive[i];
      for (let j = i + 1; j < n; j++) {
        const b = alive[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.cat === 'otliq' || b.cat === 'otliq' ? 16 : 12;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= min) continue;
        const push = (min - d) / 2;
        const px = (dx / d) * push;
        const py = (dy / d) * push;
        a.x -= px;
        a.y -= py;
        b.x += px;
        b.y += py;
      }
    }
    if (this.wallIntact()) {
      const wx = this.wall!.x;
      for (const u of alive) {
        if (u.retreating) continue;
        if (u.side === 0 && u.x > wx - 10) u.x = wx - 10;
        if (u.side === 1 && u.x < wx + 10) u.x = wx + 10;
      }
    }
  }

  // ---------------- Jang AI ----------------

  private runAi(side: Side): void {
    const enemySide: Side = side === 0 ? 1 : 0;
    const my = this.groups.filter((g) => g.side === side && this.groupAlive(g) > 0 && g.order.kind !== 'retreat');
    const enemy = this.groups.filter((g) => g.side === enemySide && this.groupAlive(g) > 0);
    if (my.length === 0 || enemy.length === 0) return;

    // Yutqazayotgan AI chekinadi.
    const isAiFaction = (side === 0 ? this.setup.attacker : this.setup.defender).kind !== 'player';
    if (isAiFaction && this.canRetreat() && this.sideStrength(side) < this.sideStrength(enemySide) * 0.25) {
      this.commandAll(side, { kind: 'retreat' });
      return;
    }
    const defending = side === 1;
    const wall = this.wallIntact();
    for (const g of my) {
      const c = this.groupCenter(g)!;
      const cat = UNITS[g.type].cat;
      if (defending && wall) {
        // Devor ortida turib otish, otliqlar devor buzilganini kutadi.
        if (g.order.kind !== 'hold') g.order = { kind: 'hold' };
        if (cat !== 'kamonchi') {
          g.anchorX = Math.max(this.wall!.x + 30, Math.min(g.anchorX, this.wall!.x + 70));
        }
        continue;
      }
      if (defending && !wall && this.time < 25 && cat !== 'otliq') {
        // Dastlab o'z o'rnida kutadi (relyef ustunligi).
        if (g.order.kind !== 'hold') g.order = { kind: 'hold' };
        continue;
      }
      // Nishon guruhni tanlash: avval ustun keladigan turga.
      let best: BGroup | null = null;
      let bestScore = Infinity;
      for (const e of enemy) {
        const ec = this.groupCenter(e)!;
        let d = Math.hypot(ec.x - c.x, ec.y - c.y);
        const m = counterMult(cat, UNITS[e.type].cat);
        if (m > 1) d *= 0.45;
        else if (m < 1) d *= 1.6;
        if (d < bestScore) {
          bestScore = d;
          best = e;
        }
      }
      if (!best) continue;
      if (cat === 'kamonchi') {
        const bc = this.groupCenter(best)!;
        const dist = Math.hypot(bc.x - c.x, bc.y - c.y);
        const range = UNITS[g.type].range;
        if (dist > range * 0.95) {
          const k = (dist - range * 0.8) / dist;
          let mx = c.x + (bc.x - c.x) * k;
          if (wall) mx = side === 0 ? Math.min(mx, this.wall!.x - 30) : Math.max(mx, this.wall!.x + 30);
          g.order = { kind: 'move', x: mx, y: c.y + (bc.y - c.y) * k };
          g.anchorX = mx;
          g.anchorY = c.y + (bc.y - c.y) * k;
        } else {
          g.order = { kind: 'attack', group: best.id };
        }
        continue;
      }
      g.order = { kind: 'attack', group: best.id };
    }
  }

  // ---------------- Tugash ----------------

  private activeCount(side: Side): number {
    let n = 0;
    for (const u of this.units) if (u.side === side && !u.dead && !u.escaped && !u.retreating) n++;
    return n;
  }

  private onFieldCount(side: Side): number {
    let n = 0;
    for (const u of this.units) if (u.side === side && !u.dead && !u.escaped) n++;
    return n;
  }

  private checkEnd(dt: number): void {
    const a0 = this.activeCount(0);
    const a1 = this.activeCount(1);
    if (this.time >= this.timeLimit) {
      this.finish(1, true);
      return;
    }
    if (a0 > 0 && a1 > 0) return;
    const loser: Side = a0 === 0 ? 0 : 1;
    if (this.endTimer < 0) {
      this.endTimer = 8;
      // G'olib chekinayotganlarni quvadi.
      const winner: Side = loser === 0 ? 1 : 0;
      for (const g of this.groups) if (g.side === winner && g.order.kind !== 'retreat') g.order = { kind: 'charge' };
    }
    this.endTimer -= dt;
    if (this.onFieldCount(loser) === 0 || this.endTimer <= 0) this.finish(loser === 0 ? 1 : 0, false);
  }

  private finish(winner: Side, timeout: boolean): void {
    const survivors: [Army, Army] = [{}, {}];
    const heroesLost: [UnitType[], UnitType[]] = [[], []];
    for (const g of this.groups) {
      let n = 0;
      for (const u of g.units) {
        if (u.dead) {
          if (u.hero) heroesLost[g.side].push(u.type);
          continue;
        }
        n += u.soldiers * (u.hp / u.maxHp);
      }
      const c = Math.ceil(n - 0.001);
      if (c > 0) survivors[g.side][g.type] = (survivors[g.side][g.type] ?? 0) + c;
    }
    this.result = { winner, survivors, heroesLost, wallBroken: !!this.wall && this.wall.hp <= 0, timeout };
  }

  /** Avto rejim: butun jangni tez hisoblash (sinov va kerak bo'lsa). */
  runToEnd(maxSteps = 6000): BattleResult {
    this.autoPlayer = true;
    let i = 0;
    while (!this.result && i++ < maxSteps) this.step(0.1);
    if (!this.result) this.finish(1, true);
    return this.result!;
  }
}
