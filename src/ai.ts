// Dushman: o'yinchi bilan bir xil qoidalarda o'ynaydi — konchi yollaydi, kumushga askar oladi,
// kuchi yetganda o'zi hujumga o'tadi, yengilayotganda qasriga qaytadi.
// Xalqi (qaysi turlarni yoqtiradi) va xarakteri (tez / sabrli / reyd) har jangda boshqacha.
import { CASTLE_X, DEFENSIVE_FRONT, EASY_FIRST_ATTACK, FORMATION_FRONT, EASY_LEVELS, EASY_NEXT_UNIT, FACTIONS, MAX_MINERS, itemOf, vsMult } from './config.ts';
import type { FactionId, ItemId, Kind, Temper } from './config.ts';
import type { Battle, Unit } from './battle.ts';

export function power(u: Unit): number {
  if (u.kind === 'konchi') return 0;
  return Math.sqrt(u.hp * (u.dmg / u.cd)) * (u.kind === 'kamonchi' ? 1.3 : 1);
}

interface TemperRule {
  wave: number; // hujum uchun eng kam askar soni (+ jang raqamiga qarab)
  waveStep: number;
  attackAt: number; // o'z kuchi / o'yinchi kuchi shundan oshsa hujum
  retreatAt: number; // hujumda shundan tushsa qaytadi
}

const RULES: Record<Temper, TemperRule> = {
  tez: { wave: 3, waveStep: 0.4, attackAt: 0.95, retreatAt: 0.5 },
  sabrli: { wave: 7, waveStep: 0.6, attackAt: 1.3, retreatAt: 0.65 },
  reyd: { wave: 5, waveStep: 0.5, attackAt: 1.15, retreatAt: 0.6 },
};

export class EnemyAI {
  private t = 0;
  private plan: ItemId | null = null;
  private planT = 0;
  private lastAttack = 0;
  private nextRaid = 60;
  private temper: Temper;
  private prefer: Partial<Record<Kind, number>>;

  constructor(temper: Temper, faction: FactionId) {
    this.temper = temper;
    this.prefer = FACTIONS[faction].prefer;
  }

  update(b: Battle, dt: number): void {
    this.t += dt;
    if (this.t < 0.8) return;
    this.t = 0;
    this.shop(b);
    this.command(b);
    if (this.temper === 'reyd') this.raid(b);
  }

  private shop(b: Battle): void {
    const miners = b.minerCount(1);
    const wantMiners = Math.min(MAX_MINERS, 6 + Math.floor(b.level / 2));
    // Qo'shini o'yinchinikidan kuchsiz bo'lsa — avval askar, keyin konchi
    let mine = 0;
    let theirs = 0;
    for (const u of b.units) {
      if (u.dead || u.kind === 'konchi') continue;
      if (u.side === 1) mine += power(u);
      else theirs += power(u);
    }
    const safe = mine >= theirs * 0.9;
    if (miners < 4 || (miners < wantMiners && safe && b.rand() < 0.6)) {
      if (b.buy(1, 'konchi') === null) return;
    }
    if (!this.plan) this.plan = this.choose(b);
    if (!this.plan) return;
    this.planT += 0.8;
    const err = b.buy(1, this.plan);
    if (err === null || err === 'bor' || err === 'joy' || this.planT > 25) {
      this.plan = null;
      this.planT = 0;
    }
  }

  private choose(b: Battle): ItemId | null {
    const s = b.sides[1];
    const easy = b.level < EASY_LEVELS;
    // 1–3-janglarda "bir pog'ona oldindagi" askarni kechroq oladi
    const ahead = b.level + 1;
    const opts: ItemId[] = s.items.filter((id) => id !== 'konchi' && !(easy && b.time < EASY_NEXT_UNIT && itemOf(id).unlock === ahead));
    if (!opts.length) return null;
    // Sarkarda/qo'mondon: ba'zan shunga kumush yig'adi
    // Sarkarda/qo'mondon: faqat puli yetganda (kutib, oddiy askar yollashni to'xtatmaydi)
    const special = opts.filter((id) => itemOf(id).rank !== 'oddiy' && !s.bought.has(id) && itemOf(id).cost <= s.silver);
    if (special.length && b.rand() < 0.35) return special[Math.floor(b.rand() * special.length)];

    // O'yinchi qo'shiniga qarshi qaysi tur foydali (zarba jadvali bo'yicha) + xalqning yoqtirgan turlari
    const theirs: Kind[] = b.units.filter((u) => u.side === 0 && !u.dead && u.kind !== 'konchi').map((u) => u.kind);
    const basic = opts.filter((id) => itemOf(id).rank === 'oddiy');
    const weights = basic.map((id) => {
      const k = itemOf(id).kind;
      let edge = 1;
      if (theirs.length) {
        let sum = 0;
        for (const t of theirs) sum += vsMult(k, t) / vsMult(t, k);
        edge = sum / theirs.length;
      }
      return Math.pow(edge, 2) * (this.prefer[k] ?? 1);
    });
    let r = b.rand() * weights.reduce((a, c) => a + c, 0);
    for (let i = 0; i < basic.length; i++) {
      r -= weights[i];
      if (r <= 0) return basic[i];
    }
    return basic[basic.length - 1];
  }

  private command(b: Battle): void {
    const s = b.sides[1];
    const rule = RULES[this.temper];
    let mine = 0;
    let mineN = 0;
    let theirs = 0;
    let threat = 0;
    for (const u of b.units) {
      if (u.dead || u.kind === 'konchi' || u.raid > 0) continue;
      if (u.side === 1) {
        if (u.garrison && s.stance !== 'chekinish') continue;
        mine += power(u);
        mineN++;
      } else if (!u.garrison) {
        theirs += power(u);
        if (Math.abs(u.x - CASTLE_X[1]) < 900) threat += power(u);
      }
    }
    // O'yinchi qasri ham himoya qiladi: hujumda shuni hisobga oladi
    const defended = theirs + 60;
    const minWave = rule.wave + b.level * rule.waveStep;
    const since = b.time - this.lastAttack;
    const easyWait = b.level < EASY_LEVELS && b.time < EASY_FIRST_ATTACK; // 1–3-janglar: boshida hujum qilmaydi
    // Kuchli dushman qasrga yaqinlashsa — qasrga kirib, devordan otib himoyalanadi va tuzaladi;
    // kuch yig'ilgach yana chiqadi
    // Kuchsizroq bo'lsa — qasr yonida saf tortadi (qasr o'qlari yordam beradi, konchilar ishlayveradi);
    // juda og'ir ahvolda — qasrga kirib, devordan otadi va tuzaladi
    const weak = threat > 0 && mine < threat * 0.9;
    s.front = weak ? DEFENSIVE_FRONT : FORMATION_FRONT;
    const holding = s.stance === 'chekinish';
    if (threat > 0 && mine < threat * (holding ? 0.55 : 0.3)) {
      b.setStance(1, 'chekinish');
    } else if (weak) {
      b.setStance(1, 'tur');
    } else if (s.stance === 'hujum') {
      if (mine < theirs * rule.retreatAt) b.setStance(1, 'tur');
    } else if (!easyWait && mineN >= minWave && (mine >= defended * rule.attackAt || (since > 120 && mine >= defended * 0.9))) {
      b.setStance(1, 'hujum');
      this.lastAttack = b.time;
    } else {
      b.setStance(1, 'tur');
    }
  }

  // Reydchi: vaqti-vaqti bilan tez askarlarni o'yinchi konchilariga yuboradi
  private raid(b: Battle): void {
    if (b.time < this.nextRaid || b.sides[1].stance !== 'tur' || (b.level < EASY_LEVELS && b.time < EASY_FIRST_ATTACK)) return;
    this.nextRaid = b.time + 35 + b.rand() * 20;
    const fast = b.units
      .filter((u) => u.side === 1 && !u.dead && !u.garrison && u.kind !== 'konchi' && u.raid <= 0)
      .sort((a, c) => c.speed - a.speed)
      .slice(0, 3);
    if (fast.length >= 2) b.sendRaid(fast.map((u) => u.id), 22);
  }
}
