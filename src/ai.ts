// Dushman: o'yinchi bilan bir xil qoidalarda o'ynaydi — konchi yollaydi, kumushga askar oladi,
// kuchi yetganda o'zi hujumga o'tadi, yengilayotganda qasriga qaytadi.
import { BEATS, CASTLE_X, ITEMS, MAX_MINERS } from './config.ts';
import type { ItemId, Kind } from './config.ts';
import type { Battle, Unit } from './battle.ts';

// Kim kimga qarshi kuchli: COUNTER[x] — x ni yengadigan tur
const COUNTER: Partial<Record<Kind, Kind>> = {};
for (const [a, b] of Object.entries(BEATS)) COUNTER[b as Kind] = a as Kind;

export function power(u: Unit): number {
  if (u.kind === 'konchi') return 0;
  return Math.sqrt(u.hp * (u.dmg / u.cd)) * (u.kind === 'kamonchi' ? 1.3 : 1);
}

export class EnemyAI {
  private t = 0;
  private plan: ItemId | null = null;
  private planT = 0;
  private lastAttack = 0;

  update(b: Battle, dt: number): void {
    this.t += dt;
    if (this.t < 0.8) return;
    this.t = 0;
    this.shop(b);
    this.command(b);
  }

  private shop(b: Battle): void {
    const miners = b.minerCount(1);
    const wantMiners = Math.min(MAX_MINERS, 6 + Math.floor(b.level / 2));
    if (miners < 4 || (miners < wantMiners && b.rand() < 0.6)) {
      if (b.buy(1, 'konchi') === null) return;
    }
    if (!this.plan) this.plan = this.choose(b);
    if (!this.plan) return;
    this.planT += 0.8;
    const err = b.buy(1, this.plan);
    if (err === null || err === 'bor' || err === 'joy' || err === 'navbat' || this.planT > 25) {
      this.plan = null;
      this.planT = 0;
    }
  }

  private choose(b: Battle): ItemId | null {
    const s = b.sides[1];
    const opts: ItemId[] = s.items.filter((id) => id !== 'konchi');
    if (!opts.length) return null;
    // Sarkarda/qo'mondon: kumush yetadigan bo'lsa ba'zan shunga yig'adi
    const special = opts.filter((id) => ITEMS.find((x) => x.id === id)!.rank !== 'oddiy' && !s.bought.has(id));
    if (special.length && b.rand() < 0.25) return special[Math.floor(b.rand() * special.length)];
    // O'yinchining eng ko'p turiga qarshi tur
    const counts: Partial<Record<Kind, number>> = {};
    for (const u of b.units) if (u.side === 0 && !u.dead && u.kind !== 'konchi' && u.kind !== 'amir') counts[u.kind] = (counts[u.kind] ?? 0) + 1;
    const top = (Object.entries(counts) as [Kind, number][]).sort((a, c) => c[1] - a[1])[0];
    const basic = opts.filter((id) => ITEMS.find((x) => x.id === id)!.rank === 'oddiy');
    if (top && b.rand() < 0.5) {
      const c = COUNTER[top[0]];
      if (c && basic.includes(c as ItemId)) return c as ItemId;
    }
    return basic[Math.floor(b.rand() * basic.length)];
  }

  private command(b: Battle): void {
    const s = b.sides[1];
    let mine = 0;
    let mineN = 0;
    let theirs = 0;
    let threat = 0;
    for (const u of b.units) {
      if (u.dead || u.kind === 'konchi') continue;
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
    const minWave = 5 + b.level * 0.5;
    const since = b.time - this.lastAttack;
    if (threat > 0 && mine < threat * 0.25 && b.sides[1].castleHp < b.sides[1].castleMax) {
      b.setStance(1, 'chekinish'); // qasr ichidan otib himoyalanadi
    } else if (s.stance === 'hujum') {
      if (mine < theirs * 0.6) b.setStance(1, 'tur');
    } else if (mineN >= minWave && (mine >= defended * 1.15 || (since > 120 && mine >= defended * 0.9))) {
      b.setStance(1, 'hujum');
      this.lastAttack = b.time;
    } else {
      b.setStance(1, 'tur');
    }
  }
}
