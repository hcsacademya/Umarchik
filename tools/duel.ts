// Kuch nisbatini tekshirish: 1 Amir N ta askarga qarshi (qasrlardan uzoqda, kuchaytirishsiz).
// Ishga tushirish: node tools/duel.ts
import { Battle } from '../src/battle.ts';
import { newSave } from '../src/campaign.ts';
import type { Kind, Side } from '../src/config.ts';

type Spawner = { spawn(side: Side, kind: Kind, rank: 'oddiy', initial: boolean): { x: number; y: number } };

function duel(kind: Kind, n: number, seed: number): boolean {
  const b = new Battle(3, newSave(), [], seed);
  const any = b as unknown as { ai: { update(): void } } & Spawner;
  any.ai = { update() {} };
  b.units = [];
  for (const s of b.sides) {
    s.silver = 0;
    s.castleHp = 1e9;
    s.castleMax = 1e9;
  }
  const e = b.sides[1];
  for (const k of Object.keys(e.hpMult) as Kind[]) {
    e.hpMult[k] = 1;
    e.dmgMult[k] = 1;
  }
  e.speedMult = 1;
  e.arrowTaken = 1;
  const a = any.spawn(0, 'amir', 'oddiy', true);
  a.x = 1150;
  for (let i = 0; i < n; i++) {
    const u = any.spawn(1, kind, 'oddiy', true);
    u.x = 1350 + i * 6;
  }
  b.setStance(0, 'hujum');
  b.setStance(1, 'hujum');
  for (let t = 0; t < 120 * 30; t++) {
    b.step(1 / 30);
    const alive = (side: Side) => b.units.some((u) => u.side === side && !u.dead);
    if (!alive(1)) return true;
    if (!b.units.some((u) => u.side === 0 && !u.dead && u.kind === 'amir')) return false;
  }
  return false;
}

const target: [Kind, number][] = [['qilichli', 5], ['nayzachi', 4], ['otliq', 3], ['kamonchi', 6]];
for (const [kind, n] of target) {
  const row: string[] = [];
  for (const m of [n - 1, n, n + 1]) {
    let w = 0;
    const tries = 40;
    for (let i = 0; i < tries; i++) if (duel(kind, m, 7 + i * 13)) w++;
    row.push(`${m}: ${Math.round((w / tries) * 100)}%`);
  }
  console.log(`Amir vs ${kind.padEnd(9)} ${row.join('  ')}`);
}
