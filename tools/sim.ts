// Balansni tekshirish: oddiy "bot-o'yinchi" har bir jangni o'ynaydi.
// Ishga tushirish: node tools/sim.ts [jang raqami] [urinishlar soni]
import { Battle } from '../src/battle.ts';
import { power } from '../src/ai.ts';
import { buyUpgrade, newSave, upgradeCost, upgradeOpen } from '../src/campaign.ts';
import { BATTLES, SPECIAL_MAX, UPGRADES, itemOf } from '../src/config.ts';
import type { ItemId } from '../src/config.ts';


function playBot(b: Battle): void {
  const s = b.sides[0];
  if (s.queue.length < 3) {
    if (b.minerCount(0) < 8) b.buy(0, 'konchi');
    else {
      const opts = s.items.filter((id) => id !== 'konchi');
      const special = opts.find((id) => itemOf(id).rank !== 'oddiy' && (s.bought[id] ?? 0) < SPECIAL_MAX);
      const pick: ItemId = special && s.silver > 700 ? special : opts[Math.floor(b.rand() * opts.length)];
      b.buy(0, pick);
    }
  }
  let mine = 0, theirs = 0, n = 0;
  for (const u of b.units) {
    if (u.dead || u.kind === 'konchi' || u.garrison) continue;
    if (u.side === 0) { mine += power(u); n++; } else theirs += power(u);
  }
  if (s.stance === 'hujum') { if (mine < theirs * 0.7) b.setStance(0, 'tur'); }
  else if (n >= 8 && mine > theirs * 1.2) b.setStance(0, 'hujum');
}

const only = process.argv[2] ? [Number(process.argv[2]) - 1] : BATTLES.map((_, i) => i);
const tries = Number(process.argv[3] ?? 3);
for (const level of only) {
  const res: string[] = [];
  let wins = 0;
  for (let k = 0; k < tries; k++) {
    const save = newSave();
    save.won = level;
    // shu jangga qadar yig'iladigan oltin taxminan: har g'alabada bonus + ~10 oltin kumushdan
    save.gold = 40 * level + 5 * level * (level - 1) + Number(process.argv[4] ?? 0);
    for (;;) {
      const opts = UPGRADES.filter((u) => upgradeOpen(save, u.id))
        .map((u) => [u.id, upgradeCost(save, u.id)] as const)
        .filter(([, c]) => c !== null && c <= save.gold);
      if (!opts.length) break;
      opts.sort((a, c) => a[1]! - c[1]!);
      buyUpgrade(save, opts[0][0]);
    }
    const b = new Battle(level, save, [], 1000 + k);
    const dt = 1 / 30;
    let amirDeaths = 0;
    while (b.winner === null && b.time < 900) {
      playBot(b);
      b.step(dt);
      for (const e of b.events.splice(0)) if (e.amir === 'dead' || e.amir === 'heir') amirDeaths++;
    }
    if (b.winner === 0) wins++;
    const w = b.winner === 0 ? 'YUTDI' : b.winner === 1 ? 'yutqazdi' : 'vaqt';
    res.push(`${w} ${Math.round(b.time)}s a${amirDeaths} q${Math.round(b.sides[0].castleHp)}`);
  }
  const d = BATTLES[level];
  console.log(`${String(level + 1).padStart(2)}. ${d.faction.padEnd(10)} ${d.temper.padEnd(6)} ${wins}/${tries} | ${res.join(' | ')}`);
}
