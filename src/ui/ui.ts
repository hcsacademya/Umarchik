import {
  ALL_UNITS,
  BASIC_UNITS,
  BUILDINGS,
  CORE_LEVELS,
  FACTION_UPGRADES,
  GAME,
  MAX_UPGRADE_LEVEL,
  RES_INFO,
  SARKARDA_UNITS,
  TERRAIN_INFO,
  UNITS,
  UNLOCK,
  WORKER_INFO,
  ZONE_INFO,
  buildingUpgradeCost,
  levelMult,
  upgradeCost,
  visualTier,
  workersCapacity,
} from '../config';
import { armyStrength, sideMult, hasWall } from '../game/combat';
import {
  ActionResult,
  armyPower,
  build,
  buildOptions,
  buy,
  buyPrice,
  buyers,
  buyTile,
  canBuyTile,
  changeTileWorkers,
  collectAll,
  dailyCosts,
  demolish,
  factionUpgrade,
  hireSpecial,
  hireWorker,
  landPrice,
  score,
  sell,
  sellPrice,
  setCrop,
  storeCap,
  tileGoods,
  tileProduction,
  trainUnits,
  unitAvailable,
  unlockCommander,
  unlockStatus,
  upgradeBuilding,
  upgradeCore,
  upgradeUnit,
  upgradeWorker,
} from '../game/economy';
import { canAttack, playerAttack, playerMove, travelDays } from '../game/sim';
import { coreInfo, coreTile, ownedTiles, soldierCount, totalArmy, totalWorkers } from '../game/state';
import type { MapView } from '../render/mapView';
import type { Army, Faction, GameState, Goods, MarchingArmy, PendingBattle, Tile, UnitType, WorkerType } from '../types';
import { armyCount, armyEntries, dayLabel, fmt, tileRand } from '../util';
import { btn, h, levelDots, unitEmoji, unitIcon, workerIcon } from './dom';

export interface App {
  state: GameState;
  map: MapView;
  startBattle(pb: PendingBattle, tactical: boolean): void;
  newGame(): void;
  save(): void;
}

type ModalName = 'army' | 'market' | 'upgrades' | 'rating' | 'log' | 'menu' | 'help';

export class UI {
  private root: HTMLElement;
  private top!: HTMLElement;
  private bottom!: HTMLElement;
  private side: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private toasts!: HTMLElement;
  private alertBox: HTMLElement | null = null;
  private hint: HTMLElement | null = null;
  private resEls: Record<string, HTMLElement> = {};
  private dayEl!: HTMLElement;
  private dayBar!: HTMLElement;
  private shieldEl!: HTMLElement;
  private speedBtns: HTMLButtonElement[] = [];
  private logBadge!: HTMLElement;
  private seenLog = 0;
  selected: Tile | null = null;
  private modalName: ModalName | null = null;
  private modalTab = 0;
  private targetMode: { kind: 'attack' | 'move'; source: Tile } | null = null;
  private pickerOpen = false;
  /** Modal ochiq bo'lganda vaqt to'xtaydi. */
  pausedByModal = false;

  constructor(
    root: HTMLElement,
    private app: App,
  ) {
    this.root = root;
    this.build();
  }

  private get s(): GameState {
    return this.app.state;
  }
  private get p(): Faction {
    return this.s.factions[this.s.playerId];
  }

  // ---------------- Asosiy tuzilma ----------------

  private build(): void {
    this.root.innerHTML = '';
    this.top = h('div', { class: 'topbar' });
    const resKeys: [string, string, string][] = [
      ['kumush', '◈', 'ic-kumush'],
      ['bronza', '●', 'ic-bronza'],
      ['don', '🌾', ''],
      ['qoy', '🐑', ''],
      ['ishchi', '👥', ''],
      ['askar', '⚔️', ''],
    ];
    for (const [k, icon, cls] of resKeys) {
      const val = h('span', { class: 'v' }, '0');
      const delta = h('span', { class: 'delta' });
      const el = h('div', { class: 'res', title: k }, h('span', { class: `ic ${cls}` }, icon), val, delta);
      this.resEls[k] = el;
      this.top.appendChild(el);
    }
    this.top.appendChild(h('div', { class: 'spacer' }));
    this.shieldEl = h('span', { class: 'shield' });
    this.top.appendChild(this.shieldEl);
    this.dayEl = h('span', null, '1-kun');
    this.dayBar = h('div');
    this.top.appendChild(h('div', { class: 'daybox' }, this.dayEl, h('div', { class: 'daybar' }, this.dayBar)));
    const sp = h('div', { class: 'speed' });
    for (const [label, v] of [['⏸', 0], ['1x', 1], ['2x', 2], ['4x', 4]] as [string, number][]) {
      const b = btn(label, () => {
        this.s.speed = v;
        this.refreshHud();
      });
      b.dataset.v = String(v);
      this.speedBtns.push(b);
      sp.appendChild(b);
    }
    this.top.appendChild(sp);
    this.top.appendChild(btn('☰', () => this.openModal('menu')));
    this.root.appendChild(this.top);

    this.bottom = h('div', { class: 'bottombar' });
    const nav = (icon: string, label: string, fn: () => void) =>
      h('button', { class: 'navbtn', onclick: fn }, h('span', { class: 'i' }, icon), h('span', null, label));
    this.logBadge = h('span', { class: 'badge hidden' });
    this.bottom.append(
      nav('🏰', 'Qarorgoh', () => {
        const c = coreTile(this.s, this.p);
        this.app.map.centerOn(c.x, c.y);
        this.openTile(c);
      }),
      nav('⚔️', 'Qo\'shin', () => this.openModal('army')),
      nav('⚖️', 'Bozor', () => this.openModal('market')),
      nav('⬆️', 'Kuchaytirish', () => this.openModal('upgrades')),
      nav('🏆', 'Reyting', () => this.openModal('rating')),
      (() => {
        const b = nav('📜', 'Xabarlar', () => this.openModal('log'));
        b.appendChild(this.logBadge);
        return b;
      })(),
      nav('📦', 'Yig\'ish', () => {
        const n = collectAll(this.s, this.s.playerId);
        this.toast(n > 0 ? `Ishxonalardan ${n} birlik mahsulot yig'ildi` : 'Yig\'iladigan mahsulot yo\'q', n > 0 ? 'good' : 'info');
        this.refresh();
      }),
    );
    this.root.appendChild(this.bottom);

    const zoom = h('div', { class: 'zoom' }, btn('+', () => this.app.map.zoomBy(1.25)), btn('−', () => this.app.map.zoomBy(0.8)));
    this.root.appendChild(zoom);
    this.toasts = h('div', { class: 'toasts' });
    this.root.appendChild(this.toasts);
    this.seenLog = this.s.log.length;
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
  }

  // ---------------- HUD ----------------

  refreshHud(): void {
    const s = this.s;
    const p = this.p;
    const c = dailyCosts(s, p);
    let donProd = 0;
    for (const t of s.tiles) if (t.owner === p.id && t.building === 'farm') donProd += tileProduction(s, t);
    const setRes = (k: string, v: string, delta?: number, warn = false) => {
      const el = this.resEls[k];
      (el.querySelector('.v') as HTMLElement).textContent = v;
      const d = el.querySelector('.delta') as HTMLElement;
      if (delta === undefined) d.textContent = '';
      else {
        d.textContent = (delta >= 0 ? '+' : '') + fmt(delta);
        d.className = 'delta ' + (delta < 0 ? 'neg' : 'pos');
      }
      el.classList.toggle('warn', warn);
    };
    setRes('kumush', fmt(p.res.kumush));
    const bronzaDelta = -(c.wages + c.tax + c.repair);
    setRes('bronza', fmt(p.res.bronza), bronzaDelta, p.res.bronza + bronzaDelta < 0);
    const donDelta = donProd - c.food - c.decay;
    setRes('don', fmt(p.res.don), donDelta, p.res.don + donDelta < 0 && p.res.qoy * 4 < -donDelta);
    setRes('qoy', fmt(p.res.qoy));
    setRes('ishchi', `${totalWorkers(p)}/${coreInfo(p).maxWorkers}`);
    setRes('askar', `${soldierCount(s, p.id)}/${coreInfo(p).maxSoldiers}`);
    this.dayEl.textContent = dayLabel(s.day);
    this.dayBar.style.width = `${(s.day % 1) * 100}%`;
    const prot = p.protectedUntil - s.day;
    this.shieldEl.textContent = prot > 0 ? `🛡 ${prot >= 1 ? Math.ceil(prot) + ' kun' : Math.ceil(prot * 24) + ' soat'}` : '';
    for (const b of this.speedBtns) b.classList.toggle('active', Number(b.dataset.v) === s.speed);
    const unseen = s.log.length - this.seenLog;
    this.logBadge.textContent = String(Math.min(99, unseen));
    this.logBadge.classList.toggle('hidden', unseen <= 0);
  }

  /** Yon panel va ochiq modalni qayta chizish. */
  refresh(): void {
    this.refreshHud();
    if (this.selected) this.renderSide();
    if (this.modalName) this.renderModal();
  }

  toast(text: string, kind: string = 'info'): void {
    const t = h('div', { class: `toast ${kind}` }, text);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild!.remove();
    setTimeout(() => t.remove(), kind === 'war' ? 6000 : 3500);
  }

  private result(r: ActionResult): void {
    if (r.msg) this.toast(r.msg, r.ok ? 'good' : 'bad');
    this.refresh();
  }

  showAlert(army: MarchingArmy, text: string): void {
    this.alertBox?.remove();
    const target = army.path[army.path.length - 1];
    const box = h(
      'div',
      { class: 'alert' },
      h('b', null, '⚠ Hujum xavfi!'),
      h('div', null, text),
      h(
        'div',
        { class: 'row' },
        btn('Ko\'rish', () => {
          this.app.map.centerOn(target.x, target.y);
          const t = this.s.tiles[target.y * GAME.mapW + target.x];
          this.openTile(t);
          box.remove();
        }, 'gold small'),
        btn('Yopish', () => box.remove(), 'small'),
      ),
    );
    this.alertBox = box;
    this.root.appendChild(box);
    if (this.s.speed > 1) this.s.speed = 1;
    setTimeout(() => box.remove(), 15000);
  }

  // ---------------- Plita bosilganda ----------------

  onTileTap(t: Tile): void {
    if (this.targetMode) {
      const tm = this.targetMode;
      const valid = tm.kind === 'attack' ? canAttack(this.s, t).ok : (t.owner === this.s.playerId || t.capture?.by === this.s.playerId) && t !== tm.source;
      if (!valid) {
        this.toast(tm.kind === 'attack' ? canAttack(this.s, t).msg || 'Bu yerga hujum qilib bo\'lmaydi' : 'O\'z yeringizni tanlang', 'bad');
        return;
      }
      this.cancelTargetMode();
      this.openPicker(tm.kind, tm.source, t);
      return;
    }
    this.openTile(t);
  }

  openTile(t: Tile | null): void {
    this.selected = t;
    this.app.map.selected = t;
    if (!t) {
      this.side?.remove();
      this.side = null;
      return;
    }
    this.renderSide();
  }

  private startTargetMode(kind: 'attack' | 'move', source: Tile): void {
    this.targetMode = { kind, source };
    const s = this.s;
    this.app.map.highlight =
      kind === 'attack'
        ? (t) => canAttack(s, t).ok
        : (t) => (t.owner === s.playerId && !t.capture) || t.capture?.by === s.playerId;
    this.openTile(null);
    this.hint?.remove();
    this.hint = h(
      'div',
      { class: 'alert', style: 'right:auto;left:50%;transform:translateX(-50%);background:linear-gradient(#3d2a17,#2a1d12);border-color:#e8c14a' },
      h('b', null, kind === 'attack' ? '⚔ Hujum nishonini xaritadan tanlang' : '➜ Qo\'shin boradigan o\'z yeringizni tanlang'),
      h('div', { class: 'row' }, btn('Bekor qilish', () => this.cancelTargetMode(), 'small')),
    );
    this.root.appendChild(this.hint);
  }

  private cancelTargetMode(): void {
    this.targetMode = null;
    this.app.map.highlight = null;
    this.hint?.remove();
    this.hint = null;
  }

  private renderSide(): void {
    const t = this.selected;
    if (!t) return;
    const scroll = this.side?.querySelector('.side-body')?.scrollTop ?? 0;
    const s = this.s;
    const prov = s.provinces[t.province];
    const owner = t.owner >= 0 ? s.factions[t.owner] : null;
    const title =
      t.building === 'core' && owner
        ? owner.kind === 'player'
          ? 'Qarorgohingiz'
          : owner.kind === 'empire'
            ? `${owner.name} poytaxti`
            : `${owner.name} poytaxti`
        : placeName(t);
    const body = h('div', { class: 'side-body' });
    const panel = h(
      'div',
      { class: 'side' },
      h(
        'div',
        { class: 'side-head' },
        h('h3', null, title, h('span', { class: 'sub' }, `${prov.name} · ${ZONE_INFO[prov.zone].name} zona · ${TERRAIN_INFO[t.terrain].name}${t.deposit ? ' · kumush koni' : ''}`)),
        h('button', { class: 'x', onclick: () => this.openTile(null) }, '✕'),
      ),
      body,
    );
    if (t.capture) this.sideCapture(body, t);
    if (!owner) this.sideUnowned(body, t);
    else if (owner.kind === 'player') this.sideOwn(body, t);
    else this.sideEnemy(body, t, owner);
    this.side?.remove();
    this.side = panel;
    this.root.appendChild(panel);
    body.scrollTop = scroll;
  }

  private sideCapture(body: HTMLElement, t: Tile): void {
    const cap = t.capture!;
    const by = this.s.factions[cap.by];
    const left = Math.max(0, cap.until - this.s.day);
    body.append(
      h('div', { class: 'sec' }, 'Egallash jarayoni'),
      h('div', { class: 'kv' }, h('span', null, 'Egallayapti'), h('b', null, by.name)),
      h('div', { class: 'kv' }, h('span', null, 'Qolgan vaqt'), h('b', null, `${Math.ceil(left * 24)} soat`)),
      h('div', { class: 'kv' }, h('span', null, 'Egallovchi qo\'shin'), h('b', null, by.id === this.s.playerId ? armyText(cap.army) : `~${this.estimate(t, armyCount(cap.army))}`)),
    );
    if (by.id === this.s.playerId) {
      body.append(h('div', { class: 'note' }, 'Taymer tugaguncha dushman qaytarib olishga urinishi mumkin. Qo\'shimcha askar yuborsangiz bo\'ladi.'));
      body.append(h('div', { class: 'row' }, btn('Qo\'shimcha yuborish', () => this.openPicker('move', coreTile(this.s, this.p), t), 'small')));
    } else if (t.owner === this.s.playerId) {
      body.append(h('div', { class: 'note bad' }, 'Dushman yeringizni egallamoqda! Qaytarib olish uchun hujum qiling.'));
      body.append(h('div', { class: 'row' }, btn('⚔ Qaytarib olish', () => this.openPicker('attack', coreTile(this.s, this.p), t), 'red')));
    }
  }

  private sideUnowned(body: HTMLElement, t: Tile): void {
    const s = this.s;
    body.append(h('div', { class: 'note' }, TERRAIN_INFO[t.terrain].desc));
    if (t.terrain === 'kol') return;
    const r = canBuyTile(s, t);
    const price = landPrice(s, t);
    body.append(
      h('div', { class: 'sec' }, 'Yer'),
      h('div', { class: 'kv' }, h('span', null, 'Narxi'), h('b', null, `◈ ${price} kumush`)),
      h('div', { class: 'kv' }, h('span', null, 'Mumkin binolar'), h('b', null, buildOptions(t).map((b) => BUILDINGS[b].name).join(', ') || '—')),
    );
    if (!r.ok) body.append(h('div', { class: 'note bad' }, r.msg));
    body.append(
      h(
        'div',
        { class: 'row' },
        btn(`Sotib olish (◈ ${price})`, () => {
          const res = buyTile(s, t);
          this.result(res);
        }, 'gold', !r.ok),
      ),
    );
  }

  private sideOwn(body: HTMLElement, t: Tile): void {
    const s = this.s;
    const p = this.p;
    if (t.building === 'core') {
      const info = coreInfo(p);
      body.append(
        h('div', { class: 'sec' }, `Qarorgoh: ${info.name} (${p.coreLevel}/4)`),
        h('div', { class: 'kv' }, h('span', null, 'Yerlar'), h('b', null, `${ownedTiles(s, p.id).length}/${info.maxTiles}`)),
        h('div', { class: 'kv' }, h('span', null, 'Ishchilar'), h('b', null, `${totalWorkers(p)}/${info.maxWorkers}`)),
        h('div', { class: 'kv' }, h('span', null, 'Askarlar'), h('b', null, `${soldierCount(s, p.id)}/${info.maxSoldiers}`)),
        h('div', { class: 'note' }, 'Yadro qarorgoh hech qachon bosib olinmaydi, lekin talon qilinishi mumkin.'),
      );
      if (p.coreLevel < CORE_LEVELS.length) {
        const n = CORE_LEVELS[p.coreLevel];
        body.append(
          h('div', { class: 'row' }, btn(`⬆ ${n.name} (◈${n.costKumush} ●${n.costBronza})`, () => this.result(upgradeCore(s)), 'gold')),
        );
      }
    } else if (t.building === 'none') {
      body.append(h('div', { class: 'sec' }, 'Qurish'));
      const opts = h('div', { class: 'opts' });
      for (const b of buildOptions(t)) {
        const d = BUILDINGS[b];
        opts.appendChild(
          h(
            'button',
            { class: 'opt', disabled: p.res.kumush < d.costKumush, onclick: () => this.result(build(s, t, b)) },
            h('b', null, d.name),
            h('span', null, `◈ ${d.costKumush} · ${d.desc}`),
          ),
        );
      }
      if (!opts.children.length) body.append(h('div', { class: 'note' }, 'Bu yerga hech narsa qurib bo\'lmaydi.'));
      body.append(opts);
    } else if (t.building !== 'city') {
      const d = BUILDINGS[t.building];
      body.append(h('div', { class: 'sec' }, `${d.name} · ${t.level}-daraja`), h('div', { class: 'note' }, d.desc));
      const g = tileGoods(t);
      if (g) {
        const w: WorkerType = t.building === 'farm' ? 'dehqon' : t.building === 'pasture' ? 'chopon' : 'konchi';
        const prod = tileProduction(s, t);
        body.append(
          h(
            'div',
            { class: 'row between' },
            h('span', { class: 'row' }, workerIcon(w), h('b', null, `${t.workers}/${workersCapacity(t.level)} ${WORKER_INFO[w].plural.toLowerCase()}`)),
            h('span', { class: 'stepper' }, btn('−', () => this.result(changeTileWorkers(s, t, -1)), 'small'), btn('+', () => this.result(changeTileWorkers(s, t, 1)), 'small')),
          ),
          h('div', { class: 'kv' }, h('span', null, 'Kunlik mahsulot'), h('b', null, `${prod.toFixed(1)} ${RES_INFO[g].name.toLowerCase()}`)),
          h(
            'div',
            { class: 'row' },
            h('span', { style: 'font-size:12px' }, 'Ombor'),
            h('div', { class: 'bar' }, h('div', { style: `width:${(t.store / storeCap(t)) * 100}%` })),
            h('b', { style: 'font-size:12px' }, `${Math.floor(t.store)}/${storeCap(t)}`),
          ),
          h('div', { class: 'note' }, 'Mahsulot kun oxirida qarorgohga olib ketiladi. Dushman olsa — ombordagisi ham ketadi.'),
        );
        if (t.building === 'farm') {
          body.append(
            h(
              'div',
              { class: 'row' },
              h('span', { style: 'font-size:12px' }, 'Ekin:'),
              btn('Bug\'doy', () => (setCrop(s, t, 'bugdoy'), this.refresh()), `small ${t.crop === 'bugdoy' ? 'active' : ''}`),
              btn('Arpa', () => (setCrop(s, t, 'arpa'), this.refresh()), `small ${t.crop === 'arpa' ? 'active' : ''}`),
            ),
          );
        }
      }
      if (t.building === 'tower') body.append(h('div', { class: 'note' }, 'Har bir minora darajasi dushman qo\'shini haqida xabarni ertaroq va aniqroq qiladi.'));
      if (t.building === 'fort') body.append(h('div', { class: 'note' }, 'Jangda devor paydo bo\'ladi: hujumchilar avval devorni buzishi kerak.'));
      const row = h('div', { class: 'row' });
      if (t.level < d.maxLevel) {
        const cost = buildingUpgradeCost(d, t.level);
        row.appendChild(btn(`⬆ Daraja (◈ ${cost})`, () => this.result(upgradeBuilding(s, t)), 'gold', p.res.kumush < cost));
      }
      row.appendChild(btn('Buzish', () => this.result(demolish(s, t)), 'small'));
      body.append(row);
    }
    // Garnizon
    body.append(h('div', { class: 'sec' }, 'Garnizon'));
    const n = armyCount(t.garrison);
    body.append(h('div', { class: 'note' }, n > 0 ? armyText(t.garrison) : 'Bu yerda askar yo\'q. Bo\'sh yerni dushman jangsiz egallaydi.'));
    const row = h('div', { class: 'row' });
    if (n > 0) {
      row.append(
        btn('⚔ Hujum…', () => this.startTargetMode('attack', t), 'red small'),
        btn('➜ Ko\'chirish…', () => this.startTargetMode('move', t), 'small'),
      );
    }
    if (t.building !== 'core') row.append(btn('＋ Askar yuborish', () => this.openPicker('move', coreTile(s, p), t), 'small'));
    body.append(row);
  }

  private estimate(t: Tile, real: number): number {
    const err = Math.max(0, 0.4 - 0.08 * this.p.spyLevel);
    return Math.max(1, Math.round(real * (1 + (tileRand(t.x, t.y, Math.floor(this.s.day)) * 2 - 1) * err)));
  }

  private sideEnemy(body: HTMLElement, t: Tile, owner: Faction): void {
    const s = this.s;
    const kind = owner.kind === 'empire' ? 'Imperiya' : 'Davlatcha';
    const spec = owner.specialty ? { kon: 'konchilik', dehqon: 'dehqonchilik', chorva: 'chorvachilik' }[owner.specialty] : owner.style === 'rim' ? 'og\'ir piyoda, tosh qal\'a' : 'zirhli otliq';
    body.append(
      h('div', { class: 'row' }, h('span', { class: 'dot', style: `background:${owner.color}` }), h('b', null, owner.name), h('span', { class: 'chip' }, kind), h('span', { class: 'chip' }, spec)),
      h('div', { class: 'kv' }, h('span', null, 'Reyting'), h('b', null, fmt(score(s, owner)))),
    );
    if (owner.anger >= 1) body.append(h('div', { class: 'note bad' }, `G'azabda (${owner.anger.toFixed(1)}) — qasos reydini kuting.`));
    if (t.building !== 'none') {
      const name = t.building === 'core' ? 'Poytaxt' : t.building === 'city' ? 'Shahar' : BUILDINGS[t.building].name;
      body.append(h('div', { class: 'kv' }, h('span', null, 'Bino'), h('b', null, `${name} (${t.level})`)));
    }
    if (!t.capture) {
      const real = armyCount(t.garrison);
      const est = this.estimate(t, real);
      body.append(
        h('div', { class: 'kv' }, h('span', null, 'Garnizon (ayg\'oqchi)'), h('b', null, this.p.spyLevel >= 4 ? String(real) : `~${est}`)),
      );
      if (this.p.spyLevel >= 2) body.append(h('div', { class: 'note' }, armyText(t.garrison)));
      else body.append(h('div', { class: 'note' }, 'Tarkibni bilish uchun ayg\'oqchilarni 2-darajaga ko\'taring.'));
    }
    if (hasWall(t)) body.append(h('div', { class: 'note' }, '🧱 Devor bor — avval devorni buzish kerak.'));
    const uncapt = t.building === 'core' && owner.kind === 'empire';
    if (uncapt) body.append(h('div', { class: 'note' }, 'Imperiya poytaxtini bosib olib bo\'lmaydi — faqat talon.'));
    else if (t.building === 'core') body.append(h('div', { class: 'note good' }, 'Poytaxtni olsangiz butun davlat yerlari sizga o\'tadi.'));
    const c = canAttack(s, t);
    body.append(
      h('div', { class: 'row' }, btn('⚔ Hujum qilish', () => this.openPicker('attack', coreTile(s, this.p), t), 'red', !c.ok)),
    );
    if (!c.ok) body.append(h('div', { class: 'note bad' }, c.msg));
  }

  // ---------------- Qo'shin tanlash ----------------

  openPicker(kind: 'attack' | 'move', source: Tile, target: Tile): void {
    const s = this.s;
    let src = source;
    if (armyCount(src.garrison) === 0) {
      const alt = ownedTiles(s, s.playerId).find((t) => armyCount(t.garrison) > 0 && t !== target);
      if (alt) src = alt;
    }
    const sel: Army = {};
    for (const [k, n] of armyEntries(src.garrison)) {
      if (kind === 'attack' && src.building === 'core' && UNITS[k].hero) continue;
      sel[k] = kind === 'attack' && src.building === 'core' ? Math.max(0, n - Math.floor(n * 0.25)) : n;
    }
    this.pickerOpen = true;
    const render = () => {
      const tgtOwner = target.capture && target.capture.by !== s.playerId ? s.factions[target.capture.by] : target.owner >= 0 ? s.factions[target.owner] : null;
      const sources = ownedTiles(s, s.playerId).filter((t) => armyCount(t.garrison) > 0 && t !== target);
      const body = h('div', { class: 'side-body' });
      body.append(h('div', { class: 'sec' }, 'Qayerdan'));
      const srow = h('div', { class: 'row' });
      for (const st of sources.slice(0, 10)) {
        const label = st.building === 'core' ? `🏰 Qarorgoh (${armyCount(st.garrison)})` : `${placeName(st)} ${st.x},${st.y} (${armyCount(st.garrison)})`;
        srow.appendChild(
          btn(label, () => {
            src = st;
            for (const k of Object.keys(sel) as UnitType[]) delete sel[k];
            for (const [k, n] of armyEntries(st.garrison)) sel[k] = n;
            render();
          }, `small ${st === src ? 'active' : ''}`),
        );
      }
      body.append(srow);
      body.append(h('div', { class: 'sec' }, 'Askarlar'));
      for (const [k, n] of armyEntries(src.garrison)) {
        const v = sel[k] ?? 0;
        body.append(
          h(
            'div',
            { class: 'row between' },
            h('span', { class: 'row' }, unitIcon(k), h('span', null, h('b', null, UNITS[k].name), h('span', { class: 'note' }, ` (${n} bor, ${this.p.unitLevels[k]}-daraja)`))),
            h(
              'span',
              { class: 'stepper' },
              btn('0', () => ((sel[k] = 0), render()), 'small'),
              btn('−', () => ((sel[k] = Math.max(0, v - 1)), render()), 'small'),
              h('span', { class: 'n' }, String(v)),
              btn('+', () => ((sel[k] = Math.min(n, v + 1)), render()), 'small'),
              btn('max', () => ((sel[k] = n), render()), 'small'),
            ),
          ),
        );
      }
      const chosen = armyCount(sel);
      if (chosen > 0) {
        const days = travelDays(s, src, target, sel);
        body.append(h('div', { class: 'kv' }, h('span', null, 'Yo\'l'), h('b', null, isFinite(days) ? `~${Math.max(1, Math.round(days * 24))} soat (${(days * GAME.dayLengthSec).toFixed(0)} soniya)` : 'yo\'l yo\'q')));
      }
      if (kind === 'attack' && tgtOwner) {
        const defArmy = target.capture ? target.capture.army : target.garrison;
        const mine = armyStrength(sel, this.p, defArmy, sideMult(this.p, 'att', target, false));
        const theirs = armyStrength(defArmy, tgtOwner, sel, sideMult(tgtOwner, 'def', target, hasWall(target)));
        const noise = 1 + (tileRand(target.x, target.y, Math.floor(s.day) + 5) * 2 - 1) * Math.max(0, 0.35 - 0.07 * this.p.spyLevel);
        const ratio = theirs > 0 ? mine / (theirs * noise) : 99;
        const verdict = ratio > 1.6 ? ['Ustunlik sizda', 'good'] : ratio > 1.05 ? ['Teng atrofida, ozgina ustun', 'good'] : ratio > 0.75 ? ['Xavfli — teng kuch', 'bad'] : ['Dushman ancha kuchli', 'bad'];
        body.append(
          h('div', { class: 'kv' }, h('span', null, 'Dushman'), h('b', null, `${tgtOwner.name}, ~${this.estimate(target, armyCount(defArmy))} askar`)),
          h('div', { class: `note ${verdict[1]}` }, `Taxminiy kuch nisbati: ${ratio > 50 ? '∞' : ratio.toFixed(2)}x — ${verdict[0]}`),
        );
        if (hasWall(target)) body.append(h('div', { class: 'note' }, 'Devor bor: mudofaachilar ustunlikka ega.'));
      }
      const send = btn(kind === 'attack' ? '⚔ Yuborish' : '➜ Yuborish', () => {
        const r = kind === 'attack' ? playerAttack(s, src, target, sel) : playerMove(s, src, target, sel);
        this.toast(r.msg, r.ok ? 'good' : 'bad');
        if (r.ok) {
          this.closeModal();
          this.refresh();
        }
      }, kind === 'attack' ? 'red' : 'gold', chosen === 0);
      body.append(h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:10px' }, btn('Bekor', () => this.closeModal()), send));
      this.showModal(kind === 'attack' ? `Hujum: ${tgtOwner?.name ?? ''} (${target.x},${target.y})` : 'Qo\'shinni ko\'chirish', body, true);
    };
    render();
  }

  // ---------------- Modallar ----------------

  openModal(name: ModalName, tab = 0): void {
    this.modalName = name;
    this.modalTab = tab;
    if (name === 'log') this.seenLog = this.s.log.length;
    this.renderModal();
  }

  private showModal(title: string, body: HTMLElement, narrow = false, tabs?: string[]): void {
    this.modal?.remove();
    const m = h(
      'div',
      { class: `modal ${narrow ? 'narrow' : ''}` },
      h('div', { class: 'side-head' }, h('h3', null, title), h('button', { class: 'x', onclick: () => this.closeModal() }, '✕')),
      tabs
        ? h(
            'div',
            { class: 'tabs' },
            tabs.map((t, i) =>
              h('button', { class: `tab ${i === this.modalTab ? 'on' : ''}`, onclick: () => ((this.modalTab = i), this.renderModal()) }, t),
            ),
          )
        : null,
      body,
    );
    const wrap = h('div', { class: 'modal-wrap', onclick: (e: MouseEvent) => e.target === wrap && this.closeModal() }, m);
    this.modal = wrap;
    this.root.appendChild(wrap);
    this.pausedByModal = true;
  }

  closeModal(): void {
    this.modal?.remove();
    this.modal = null;
    this.modalName = null;
    this.pickerOpen = false;
    this.pausedByModal = false;
  }

  get modalOpen(): boolean {
    return !!this.modal;
  }

  private renderModal(): void {
    if (this.pickerOpen && !this.modalName) return;
    const scroll = this.modal?.querySelector('.side-body')?.scrollTop ?? 0;
    switch (this.modalName) {
      case 'army':
        this.modalArmy();
        break;
      case 'market':
        this.modalMarket();
        break;
      case 'upgrades':
        this.modalUpgrades();
        break;
      case 'rating':
        this.modalRating();
        break;
      case 'log':
        this.modalLog();
        break;
      case 'menu':
        this.modalMenu();
        break;
      case 'help':
        this.modalHelp();
        break;
      default:
        return;
    }
    const b = this.modal?.querySelector('.side-body');
    if (b) b.scrollTop = scroll;
  }

  private modalArmy(): void {
    const s = this.s;
    const p = this.p;
    const body = h('div', { class: 'side-body' });
    const tab = this.modalTab;
    if (tab === 0) {
      body.append(
        h('div', { class: 'note' }, `Mashg'ulot maydoni: ${p.barracksLevel}-daraja. Askarlar qarorgohda tayyorlanadi. Askar chegarasi: ${soldierCount(s, p.id)}/${coreInfo(p).maxSoldiers}.`),
        h('div', { class: 'note' }, 'Tur ustunligi: nayzachi → otliqqa, otliq → kamonchiga, kamonchi → piyodaga kuchli.'),
      );
      const cards = h('div', { class: 'cards' });
      for (const k of BASIC_UNITS) {
        const d = UNITS[k];
        const ok = unitAvailable(p, k);
        cards.appendChild(
          h(
            'div',
            { class: `card ${ok ? '' : 'locked'}` },
            h('h4', null, unitIcon(k), d.name, h('span', { class: 'chip' }, `${p.unitLevels[k]}-dar.`)),
            h('div', { class: 'stats' }, `❤ ${Math.round(d.hp * levelMult(p.unitLevels[k]))} · ⚔ ${Math.round(d.atk * levelMult(p.unitLevels[k]))} · 🛡 ${d.def} · ${d.range > 60 ? 'uzoqdan' : 'yaqindan'}`),
            h('div', { class: 'stats' }, `Narx: ●${d.costBronza}${d.costKumush ? ` ◈${d.costKumush}` : ''} · maosh ●${d.wage}/kun · ovqat ${d.food}`),
            ok
              ? h('div', { class: 'row' }, btn('+1', () => this.result(trainUnits(s, k, 1)), 'small green'), btn('+5', () => this.result(trainUnits(s, k, 5)), 'small green'), btn('+10', () => this.result(trainUnits(s, k, 10)), 'small green'))
              : h('div', { class: 'note bad' }, `Mashg'ulot maydoni ${d.barracks}-daraja kerak`),
          ),
        );
      }
      body.append(cards);
    } else if (tab === 1) {
      const qs = unlockStatus(p, 'qomondon');
      const ss = unlockStatus(p, 'sarkarda');
      const reqLine = (st: ReturnType<typeof unlockStatus>) =>
        h(
          'div',
          { class: 'row' },
          h('span', { class: `chip` }, `${st.core ? '✅' : '❌'} Qarorgoh ${st.req.coreLevel}`),
          h('span', { class: 'chip' }, `${st.kumush ? '✅' : '❌'} ◈${st.req.kumush}`),
          h('span', { class: 'chip' }, `${st.wins ? '✅' : '❌'} ${st.req.wins} g'alaba (${p.wins})`),
        );
      const army = totalArmy(s, p.id);
      body.append(
        h('div', { class: 'sec' }, 'Amir'),
        h('div', { class: 'row' }, unitIcon('amir'), h('span', null, p.amirWoundedUntil > 0 ? `Amir yarador — ${Math.ceil((p.amirWoundedUntil - s.day) * 24)} soatdan keyin qaytadi` : 'Amir — siz, davlat boshlig\'i. Jangda yonidagilarni ruhlantiradi.')),
        h('div', { class: 'sec' }, 'Qo\'mondon'),
        h('div', { class: 'note' }, `Zirhlangan otliq guruh boshlig'i: 1 qo'mondon, ${UNLOCK.commanderSquad.zirhli_otliq} zirhli otliq, ${UNLOCK.commanderSquad.zirhli_nayzachi} zirhli nayzachi.`),
      );
      if (!p.unlocks.qomondon) {
        body.append(reqLine(qs), h('div', { class: 'row' }, btn('Ochish', () => this.result(unlockCommander(s, 'qomondon')), 'gold', !(qs.core && qs.kumush && qs.wins))));
      } else {
        const row = h('div', { class: 'row' });
        for (const k of ['qomondon', 'zirhli_otliq', 'zirhli_nayzachi'] as UnitType[]) {
          const d = UNITS[k];
          row.append(h('span', { class: 'chip' }, `${unitEmoji(k)} ${d.name}: ${army[k] ?? 0}`), btn(`+ (●${d.costBronza} ◈${d.costKumush})`, () => this.result(hireSpecial(s, k)), 'small'));
        }
        body.append(row);
      }
      body.append(h('div', { class: 'sec' }, 'Sarkardalar'), h('div', { class: 'note' }, 'Har sarkarda o\'z maxsus guruhi (12 askar) bilan keladi. Oddiy askar tizimidan alohida.'));
      if (!p.unlocks.sarkarda) {
        body.append(reqLine(ss), h('div', { class: 'row' }, btn('Ochish', () => this.result(unlockCommander(s, 'sarkarda')), 'gold', !(ss.core && ss.kumush && ss.wins))));
      } else {
        const cards = h('div', { class: 'cards' });
        for (const k of SARKARDA_UNITS) {
          const d = UNITS[k];
          const have = (army[k] ?? 0) > 0;
          cards.append(
            h('div', { class: 'card' }, h('h4', null, unitIcon(k), d.name), h('div', { class: 'stats' }, `●${d.costBronza} ◈${d.costKumush}`), have ? h('div', { class: 'note good' }, 'Xizmatda') : btn('Yollash', () => this.result(hireSpecial(s, k)), 'small gold')),
          );
        }
        body.append(cards);
      }
    } else {
      // Garnizonlar va yo'ldagi qo'shinlar
      const tbl = h('table', { class: 'tbl' }, h('tr', null, h('th', null, 'Joy'), h('th', null, 'Askarlar'), h('th', null, '')));
      for (const t of ownedTiles(s, p.id)) {
        if (armyCount(t.garrison) === 0) continue;
        tbl.append(
          h(
            'tr',
            null,
            h('td', null, t.building === 'core' ? '🏰 Qarorgoh' : `${placeName(t)} (${t.x},${t.y})`),
            h('td', null, armyText(t.garrison)),
            h('td', null, btn('Ko\'rish', () => {
              this.closeModal();
              this.app.map.centerOn(t.x, t.y);
              this.openTile(t);
            }, 'small')),
          ),
        );
      }
      for (const t of s.tiles) {
        if (t.capture?.by !== p.id) continue;
        tbl.append(h('tr', null, h('td', null, `⚑ Egallanmoqda (${t.x},${t.y})`), h('td', null, armyText(t.capture.army)), h('td')));
      }
      for (const a of s.armies) {
        if (a.owner !== p.id) continue;
        const left = (a.path.length - 1 - a.pos) / a.speed;
        const what = { attack: 'Hujumga', raid: 'Reydga', return: 'Qaytmoqda', move: 'Ko\'chmoqda' }[a.purpose];
        tbl.append(h('tr', null, h('td', null, `🚩 ${what} (~${Math.ceil(left * 24)} soat)`), h('td', null, armyText(a.units)), h('td', null, btn('Ko\'rish', () => {
          this.closeModal();
          this.app.map.centerOn(a.target.x, a.target.y);
        }, 'small'))));
      }
      body.append(tbl);
      body.append(h('div', { class: 'note' }, `Umumiy kuch: ${fmt(armyPower(s, p.id))}`));
    }
    this.showModal('Qo\'shin', body, false, ['Tayyorlash', 'Qo\'mondon va sarkardalar', 'Garnizonlar']);
  }

  private modalMarket(): void {
    const s = this.s;
    const p = this.p;
    const body = h('div', { class: 'side-body' });
    body.append(h('div', { class: 'note' }, 'Ortiqcha mahsulotni AI davlatlarga sotasiz. AI davlatni yutsangiz — bitta xaridor kamayadi va narx tushadi. Ko\'p sotsangiz narx vaqtincha pasayadi.'));
    const tbl = h('table', { class: 'tbl' }, h('tr', null, h('th', null, 'Mahsulot'), h('th', null, 'Sizda'), h('th', null, 'Sotish narxi'), h('th', null, 'Xaridorlar'), h('th', null, 'Sotish'), h('th', null, 'Sotib olish')));
    for (const g of ['don', 'qoy', 'kumush'] as Goods[]) {
      const sp = sellPrice(s, g);
      const bp = buyPrice(s, g);
      tbl.append(
        h(
          'tr',
          null,
          h('td', null, `${RES_INFO[g].icon} ${RES_INFO[g].name}`),
          h('td', null, fmt(p.res[g])),
          h('td', null, `●${sp.toFixed(2)}`),
          h('td', null, buyers(s, g).toFixed(1)),
          h(
            'td',
            null,
            h(
              'span',
              { class: 'row' },
              btn('10', () => this.result(sell(s, g, 10)), 'small', p.res[g] < 10),
              btn('50', () => this.result(sell(s, g, 50)), 'small', p.res[g] < 50),
              btn('Yarmi', () => this.result(sell(s, g, Math.floor(p.res[g] / 2))), 'small', p.res[g] < 2),
            ),
          ),
          h('td', null, g === 'kumush' ? '—' : btn(`10 (●${Math.ceil(bp * 10)})`, () => this.result(buy(s, g, 10)), 'small')),
        ),
      );
    }
    body.append(tbl);
    const c = dailyCosts(s, p);
    body.append(
      h('div', { class: 'sec' }, 'Kunlik xarajatlar'),
      h('div', { class: 'kv' }, h('span', null, 'Askar maoshi'), h('b', null, `● ${fmt(c.wages)}`)),
      h('div', { class: 'kv' }, h('span', null, 'Soliq (yer)'), h('b', null, `● ${fmt(c.tax)}`)),
      h('div', { class: 'kv' }, h('span', null, 'Ta\'mir'), h('b', null, `● ${fmt(c.repair)}`)),
      h('div', { class: 'kv' }, h('span', null, 'Oziq-ovqat (ishchi + askar)'), h('b', null, `🌾 ${fmt(c.food)}`)),
      h('div', { class: 'kv' }, h('span', null, 'Donning buzilishi'), h('b', null, `🌾 ${fmt(c.decay)}`)),
      h('div', { class: 'note' }, 'Don tugasa qo\'y so\'yiladi. Ikkalasi ham tugasa askarlar kuchsizlanadi. Bronza tugasa askarlar ketib qoladi.'),
    );
    this.showModal('Bozor', body);
  }

  private modalUpgrades(): void {
    const s = this.s;
    const p = this.p;
    const body = h('div', { class: 'side-body' });
    const tab = this.modalTab;
    if (tab === 0) {
      body.append(h('div', { class: 'note' }, 'Har askar turi uchun 10 daraja. Ko\'rinish 4 bosqichda o\'zgaradi: 1-3, 4-6, 7-9, 10.'));
      const cards = h('div', { class: 'cards' });
      const types = ALL_UNITS.filter((k) => !UNITS[k].hero || k === 'amir' || (k === 'qomondon' && p.unlocks.qomondon) || (SARKARDA_UNITS.includes(k) && p.unlocks.sarkarda)).filter(
        (k) => !(k === 'zirhli_otliq' || k === 'zirhli_nayzachi') || p.unlocks.qomondon,
      );
      for (const k of types) {
        const lvl = p.unitLevels[k];
        const cost = upgradeCost(lvl + 1, UNITS[k].hero);
        cards.append(
          h(
            'div',
            { class: 'card' },
            h('h4', null, unitIcon(k), UNITS[k].name, h('span', { class: 'chip' }, `ko'rinish ${visualTier(lvl)}/4`)),
            levelDots(lvl),
            h('div', { class: 'stats' }, `Kuch: x${levelMult(lvl).toFixed(2)}${lvl < MAX_UPGRADE_LEVEL ? ` → x${levelMult(lvl + 1).toFixed(2)}` : ''}`),
            lvl < MAX_UPGRADE_LEVEL ? btn(`⬆ ◈ ${cost}`, () => this.result(upgradeUnit(s, k)), 'small gold', p.res.kumush < cost) : h('div', { class: 'note good' }, 'Eng yuqori daraja'),
          ),
        );
      }
      body.append(cards);
    } else if (tab === 1) {
      const cards = h('div', { class: 'cards' });
      for (const w of ['dehqon', 'chopon', 'konchi'] as WorkerType[]) {
        const lvl = p.workerLevels[w];
        const cost = upgradeCost(lvl + 1);
        let assigned = 0;
        const b = WORKER_INFO[w].building;
        for (const t of s.tiles) if (t.owner === p.id && t.building === b) assigned += t.workers;
        cards.append(
          h(
            'div',
            { class: 'card' },
            h('h4', null, workerIcon(w), WORKER_INFO[w].plural, h('span', { class: 'chip' }, `${p.workers[w]} (${p.workers[w] - assigned} bo'sh)`)),
            levelDots(lvl),
            h('div', { class: 'stats' }, `Unumdorlik: x${levelMult(lvl).toFixed(2)}`),
            h(
              'div',
              { class: 'row' },
              btn(`+ Yollash (●${WORKER_INFO[w].hireCost})`, () => this.result(hireWorker(s, w)), 'small green'),
              lvl < MAX_UPGRADE_LEVEL ? btn(`⬆ ◈ ${cost}`, () => this.result(upgradeWorker(s, w)), 'small gold', p.res.kumush < cost) : null,
            ),
          ),
        );
      }
      body.append(cards, h('div', { class: 'note' }, `Ishchilar: ${totalWorkers(p)}/${coreInfo(p).maxWorkers}. Bo'sh ishchilar yangi ishxona qurilganda avtomatik joylashadi.`));
    } else {
      const cards = h('div', { class: 'cards' });
      const info = coreInfo(p);
      const next = CORE_LEVELS[p.coreLevel];
      cards.append(
        h(
          'div',
          { class: 'card' },
          h('h4', null, h('span', { class: 'portrait' }, '🏰'), `Qarorgoh: ${info.name}`),
          levelDots(p.coreLevel, 4),
          h('div', { class: 'stats' }, `Yer ${info.maxTiles} · ishchi ${info.maxWorkers} · askar ${info.maxSoldiers}`),
          next ? btn(`⬆ ${next.name} (◈${next.costKumush} ●${next.costBronza})`, () => this.result(upgradeCore(s)), 'small gold') : h('div', { class: 'note good' }, 'Eng yuqori daraja'),
        ),
      );
      for (const key of Object.keys(FACTION_UPGRADES) as (keyof typeof FACTION_UPGRADES)[]) {
        const d = FACTION_UPGRADES[key];
        const cur = key === 'barracks' ? p.barracksLevel : key === 'ombor' ? p.omborLevel : p.spyLevel;
        const cost = d.cost(cur + 1);
        cards.append(
          h(
            'div',
            { class: 'card' },
            h('h4', null, h('span', { class: 'portrait' }, key === 'barracks' ? '🎯' : key === 'ombor' ? '🏚️' : '🕵️'), d.name),
            levelDots(cur, d.max),
            h('div', { class: 'stats' }, d.desc),
            cur < d.max ? btn(`⬆ ◈ ${cost}`, () => this.result(factionUpgrade(s, key)), 'small gold', p.res.kumush < cost) : h('div', { class: 'note good' }, 'Eng yuqori daraja'),
          ),
        );
      }
      body.append(cards);
    }
    this.showModal('Kuchaytirish', body, false, ['Askarlar', 'Ishchilar', 'Qarorgoh']);
  }

  private modalRating(): void {
    const s = this.s;
    const body = h('div', { class: 'side-body' });
    const rows = s.factions
      .filter((f) => f.alive)
      .map((f) => ({ f, sc: score(s, f), tiles: ownedTiles(s, f.id).length, power: armyPower(s, f.id) }))
      .sort((a, b) => b.sc - a.sc);
    const tbl = h('table', { class: 'tbl' }, h('tr', null, h('th', null, '#'), h('th', null, 'Davlat'), h('th', null, 'Turi'), h('th', null, 'Yer'), h('th', null, 'Qo\'shin kuchi'), h('th', null, 'G\'alaba'), h('th', null, 'Reyting')));
    rows.forEach((r, i) => {
      tbl.append(
        h(
          'tr',
          { class: r.f.kind === 'player' ? 'me' : '' },
          h('td', null, String(i + 1)),
          h('td', null, h('span', { class: 'dot', style: `background:${r.f.color}` }), r.f.name),
          h('td', null, r.f.kind === 'player' ? 'Siz' : r.f.kind === 'empire' ? 'Imperiya' : 'Davlatcha'),
          h('td', null, String(r.tiles)),
          h('td', null, fmt(r.power)),
          h('td', null, String(r.f.wins)),
          h('td', null, h('b', null, fmt(r.sc))),
        ),
      );
    });
    body.append(tbl, h('div', { class: 'note' }, 'Maqsad: yerni kengaytirish, davlat qurish va markazdagi ikki imperiya hududi uchun kurash.'));
    this.showModal('Reyting', body);
  }

  private modalLog(): void {
    const body = h('div', { class: 'side-body' });
    const items = [...this.s.log].reverse();
    for (const l of items) body.append(h('div', { class: `log-item ${l.kind}` }, h('span', { class: 'd' }, dayLabel(l.day)), l.text));
    if (!items.length) body.append(h('div', { class: 'note' }, 'Hozircha xabar yo\'q.'));
    this.showModal('Xabarlar', body, true);
  }

  private modalMenu(): void {
    const body = h('div', { class: 'side-body' });
    body.append(
      h(
        'div',
        { style: 'display:flex;flex-direction:column;gap:8px' },
        btn('▶ Davom etish', () => this.closeModal(), 'gold'),
        btn('💾 Saqlash', () => {
          this.app.save();
          this.toast('O\'yin saqlandi', 'good');
        }),
        btn('❓ Qanday o\'ynash', () => this.openModal('help')),
        btn('⛶ To\'liq ekran', () => {
          const el = document.documentElement;
          if (!document.fullscreenElement) {
            el.requestFullscreen?.().then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => {})).catch(() => {});
          } else document.exitFullscreen?.();
        }),
        btn('🗺 Yangi o\'yin', () => {
          if (confirm('Joriy o\'yin o\'chib ketadi. Yangi o\'yin boshlansinmi?')) {
            this.closeModal();
            this.app.newGame();
          }
        }, 'red'),
      ),
      h('div', { class: 'note', style: 'margin-top:10px' }, 'O\'yin avtomatik ravishda har kuni saqlanadi (brauzer xotirasida).'),
    );
    this.showModal('Menyu', body, true);
  }

  private modalHelp(): void {
    const body = h('div', { class: 'side-body' });
    const steps = [
      ['🏰 Boshlanish', 'Sizda tosh qal\'acha-uycha, 3 dehqon, 2 cho\'pon, 4 konchi va 4 piyoda bor. Yoningizdagi (oq punktir bilan belgilangan) yerlarni kumushga sotib oling.'],
      ['🌾 Iqtisod', 'Sotib olingan yerga ekinzor, yaylov yoki kon quring — bo\'sh ishchilar avtomatik joylashadi. Kumush — yer va qurilish uchun, bronza — kundalik xarajat (maosh, soliq, ta\'mir) uchun.'],
      ['⚖️ Bozor', 'Ortiqcha don, qo\'y va kumushni AI davlatlarga sotib bronza oling. Xarajatlar yuqori paneldagi qizil raqamda ko\'rinadi.'],
      ['⚔️ Qo\'shin', 'Qo\'shin bo\'limida askar tayyorlang. Dushman yerini bosib "Hujum qilish" tugmasi bilan qo\'shin yuboring. Qo\'shin xaritada yuradi.'],
      ['🗡 Jang', 'Qo\'shinlar uchrashganda jang maydoni ochiladi: guruhni tanlang (pastdagi tugma yoki askarni bosing), keyin maydonni bosing — o\'sha yerga boradi, dushmanni bosing — hujum qiladi. Vaqt tugasa mudofaachi yutadi. 1 daqiqadan keyin chekinish mumkin.'],
      ['⚑ Egallash', 'G\'alabadan keyin yer taymer bilan o\'tadi. Shu vaqtda dushman qaytarib olishga urinadi. AI poytaxtini olsangiz — butun davlati sizniki.'],
      ['😠 Qasos', 'AI davlatga hujum qilsangiz, u eng yaqin ishxonangizga reyd qiladi. Kuzatuv minoralari va ayg\'oqchilar hujum haqida oldinroq xabar beradi.'],
      ['👑 Maqsad', 'Qarorgohni kuchaytiring (4 bosqich), qo\'mondon va sarkardalarni oching, markazdagi Rumiya va Parsiya imperiyalari hududi uchun kurashing.'],
    ];
    for (const [t, d] of steps) body.append(h('div', { class: 'sec' }, t), h('div', { class: 'note', style: 'font-size:13px;color:#3b2c1c' }, d));
    body.append(h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:10px' }, btn('Tushunarli', () => this.closeModal(), 'gold')));
    this.showModal('Qanday o\'ynash', body, true);
  }

  // ---------------- Jang so'rovi ----------------

  showPending(pb: PendingBattle): void {
    const s = this.s;
    const att = s.factions[pb.attacker];
    const def = s.factions[pb.defender];
    const t = s.tiles[pb.y * GAME.mapW + pb.x];
    const playerAtt = pb.attacker === s.playerId;
    const body = h('div', { class: 'side-body' });
    body.append(
      h('div', { class: 'note', style: 'font-size:14px;color:#3b2c1c' }, playerAtt ? `Qo'shiningiz ${s.provinces[t.province].name} ga yetib keldi. ${def.name} garnizoni kutib turibdi.` : `${att.name} qo'shini ${t.building === 'core' ? 'qarorgohingizga' : 'yeringizga'} hujum qildi!`),
      h('div', { class: 'kv' }, h('span', null, 'Joy'), h('b', null, `${TERRAIN_INFO[t.terrain].name}${hasWall(t) ? ' · devor bor' : ''}`)),
      h('div', { class: 'kv' }, h('span', { style: 'color:#2f7fd8' }, playerAtt ? 'Siz (hujum)' : `${att.name} (hujum)`), h('b', null, armyText(pb.attackUnits))),
      h('div', { class: 'kv' }, h('span', { style: 'color:#b3262d' }, playerAtt ? `${def.name} (mudofaa)` : 'Siz (mudofaa)'), h('b', null, armyText(pb.defendUnits))),
      h('div', { class: 'note' }, `Jang ${Math.round(GAME.battleTimeSec / 60)} daqiqa. Vaqt tugasa mudofaachi yutadi.`),
      h(
        'div',
        { class: 'row', style: 'justify-content:flex-end;margin-top:10px' },
        btn('⚡ Avto-jang', () => {
          this.closeModal();
          this.app.startBattle(pb, false);
        }),
        btn('⚔ Jangni boshqarish', () => {
          this.closeModal();
          this.app.startBattle(pb, true);
        }, 'gold'),
      ),
    );
    this.showModal('⚔ Jang!', body, true);
    // Bu modalni tashqariga bosib yopib bo'lmaydi.
    const wrap = this.modal!;
    wrap.onclick = null;
    (wrap.querySelector('.x') as HTMLElement).style.display = 'none';
  }

  showBattleResult(win: boolean, text: string, before: Army, after: Army, onClose: () => void): void {
    const body = h('div', { class: 'side-body' });
    body.append(h('p', { class: `result-title ${win ? 'win' : 'lose'}` }, win ? 'G\'alaba!' : 'Mag\'lubiyat'));
    const tbl = h('table', { class: 'tbl' }, h('tr', null, h('th', null, 'Askar'), h('th', null, 'Edi'), h('th', null, 'Qoldi'), h('th', null, 'Yo\'qotish')));
    for (const [k, n] of armyEntries(before)) {
      const a = after[k] ?? 0;
      tbl.append(h('tr', null, h('td', null, `${unitEmoji(k)} ${UNITS[k].name}`), h('td', null, String(n)), h('td', null, String(a)), h('td', { style: n - a > 0 ? 'color:#a32020' : '' }, String(n - a))));
    }
    body.append(tbl, h('div', { class: 'note', style: 'font-size:13px;color:#3b2c1c;margin-top:8px' }, text));
    body.append(
      h(
        'div',
        { class: 'row', style: 'justify-content:flex-end;margin-top:10px' },
        btn('Davom etish', () => {
          this.closeModal();
          onClose();
        }, 'gold'),
      ),
    );
    this.showModal('Jang natijasi', body, true);
    const wrap = this.modal!;
    wrap.onclick = null;
    (wrap.querySelector('.x') as HTMLElement).style.display = 'none';
  }
}

function placeName(t: Tile): string {
  if (t.building === 'core') return 'Poytaxt';
  if (t.building === 'city') return 'Shahar';
  if (t.building === 'none') return TERRAIN_INFO[t.terrain].name;
  return BUILDINGS[t.building].name;
}

export function armyText(a: Army): string {
  const e = armyEntries(a);
  if (!e.length) return 'yo\'q';
  return e.map(([k, n]) => `${unitEmoji(k)}${n} ${UNITS[k].name.toLowerCase()}`).join(', ');
}
