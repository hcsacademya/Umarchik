import { GAME, TERRAIN_INFO, UNITS } from '../config';
import type { Battle } from '../game/battle';
import { btn, h, unitIcon } from './dom';

/** Taktik jang ekranidagi tugmalar va ma'lumotlar. */
export class BattleUI {
  private root: HTMLElement;
  private timerEl!: HTMLElement;
  private barMine!: HTMLElement;
  private barEnemy!: HTMLElement;
  private countMine!: HTMLElement;
  private countEnemy!: HTMLElement;
  private groupsEl!: HTMLElement;
  private cmdsEl!: HTMLElement;
  private eventEl: HTMLElement | null = null;
  private lastEvent = 0;
  speed = 1;
  private speedBtns: HTMLButtonElement[] = [];
  private autoBtn!: HTMLButtonElement;
  private selected: number | null = null;
  private lastGroupsKey = '';

  constructor(
    root: HTMLElement,
    private battle: Battle,
    private colors: [string, string],
    private names: [string, string],
    private onSelect: (g: number | null) => void,
  ) {
    this.root = root;
    this.build();
  }

  private build(): void {
    const b = this.battle;
    const ps = b.playerSide;
    this.root.innerHTML = '';
    this.timerEl = h('span', { class: 'timer' }, '4:00');
    this.barMine = h('div', { style: `background:${this.colors[ps]};width:50%` });
    this.barEnemy = h('div', { style: `background:${this.colors[ps === 0 ? 1 : 0]};width:50%` });
    this.countMine = h('b');
    this.countEnemy = h('b');
    const sp = h('div', { class: 'speed' });
    for (const v of [1, 2, 3]) {
      const bt = btn(`${v}x`, () => {
        this.speed = v;
        this.refreshSpeed();
      }, 'small');
      bt.dataset.v = String(v);
      this.speedBtns.push(bt);
      sp.appendChild(bt);
    }
    this.autoBtn = btn('🤖 Avto', () => {
      b.autoPlayer = !b.autoPlayer;
      this.autoBtn.classList.toggle('active', b.autoPlayer);
    }, 'small');
    const top = h(
      'div',
      { class: 'btop' },
      h('span', { class: 'hint' }, `${TERRAIN_INFO[b.terrain].name}${b.wall ? ' · devor' : ''} · ${ps === 0 ? 'siz hujumdasiz' : 'siz mudofaadasiz'}`),
      h(
        'div',
        { class: 'sidebar-str' },
        h('span', { style: `color:${this.colors[ps]}` }, 'Siz'),
        this.countMine,
        h('div', { class: 'strbar' }, this.barMine, this.barEnemy),
        this.countEnemy,
        h('span', { style: `color:${this.colors[ps === 0 ? 1 : 0]}` }, this.names[ps === 0 ? 1 : 0]),
      ),
      this.timerEl,
      sp,
      this.autoBtn,
    );
    this.groupsEl = h('div', { class: 'groups' });
    this.cmdsEl = h('div', { class: 'cmds' });
    const bot = h('div', { class: 'bbot' }, this.groupsEl, this.cmdsEl);
    this.root.append(top, bot);
    this.refreshSpeed();
    this.update();
  }

  /** Yuqori va pastki panellar balandligi (maydonni joylash uchun). */
  insets(): { top: number; bottom: number } {
    const top = this.root.querySelector('.btop') as HTMLElement | null;
    const bot = this.root.querySelector('.bbot') as HTMLElement | null;
    return { top: top?.offsetHeight ?? 48, bottom: bot?.offsetHeight ?? 92 };
  }

  private refreshSpeed(): void {
    for (const b of this.speedBtns) b.classList.toggle('active', Number(b.dataset.v) === this.speed);
  }

  setSelected(g: number | null): void {
    this.selected = g;
    this.lastGroupsKey = '';
    this.update();
  }

  update(): void {
    const b = this.battle;
    const ps = b.playerSide;
    const es = ps === 0 ? 1 : 0;
    const left = Math.max(0, b.timeLimit - b.time);
    this.timerEl.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    const sm = b.sideStrength(ps);
    const se = b.sideStrength(es);
    const tot = sm + se || 1;
    this.barMine.style.width = `${(sm / tot) * 100}%`;
    this.barEnemy.style.width = `${(se / tot) * 100}%`;
    this.countMine.textContent = String(b.sideSoldiers(ps));
    this.countEnemy.textContent = String(b.sideSoldiers(es));

    // Guruh tugmalari (faqat o'zgarganda qayta chiziladi)
    const mine = b.groups.filter((g) => g.side === ps);
    const key = mine.map((g) => `${g.id}:${b.groupSoldiers(g)}:${g.order.kind}`).join('|') + `|${this.selected}`;
    if (key !== this.lastGroupsKey) {
      this.lastGroupsKey = key;
      this.groupsEl.innerHTML = '';
      for (const g of mine) {
        const n = b.groupSoldiers(g);
        const ord = { hold: 'turibdi', move: 'yurmoqda', attack: 'hujumda', charge: 'hujumda', retreat: 'chekinmoqda' }[g.order.kind];
        this.groupsEl.appendChild(
          h(
            'button',
            {
              class: `gbtn ${this.selected === g.id ? 'sel' : ''} ${n === 0 ? 'dead' : ''}`,
              onclick: () => {
                if (n === 0) return;
                this.onSelect(this.selected === g.id ? null : g.id);
              },
            },
            unitIcon(g.type, (ps === 0 ? b.setup.attacker : b.setup.defender).unitLevels[g.type], 'sm'),
            h('span', null, `${UNITS[g.type].name} ${n}`),
            h('span', { class: 'o' }, ord),
          ),
        );
      }
    }

    // Buyruqlar
    const canRetreat = b.canRetreat();
    const lock = Math.ceil(GAME.retreatLockSec - b.time);
    const ckey = `${this.selected}|${canRetreat}|${canRetreat ? 0 : lock}`;
    if (this.cmdsEl.dataset.key !== ckey) {
      this.cmdsEl.dataset.key = ckey;
      this.cmdsEl.innerHTML = '';
      const sel = this.selected;
      if (sel !== null) {
        this.cmdsEl.append(
          h('span', { class: 'hint' }, 'Maydonni bosing — boradi, dushmanni bosing — hujum:'),
          btn('⚔ Hujum', () => b.command(sel, { kind: 'charge' }), 'small red'),
          btn('✋ Ushla', () => b.command(sel, { kind: 'hold' }), 'small'),
          btn(canRetreat ? '↩ Chekin' : `↩ ${lock}s`, () => b.command(sel, { kind: 'retreat' }), 'small', !canRetreat),
          btn('✕', () => this.onSelect(null), 'small'),
        );
      } else {
        this.cmdsEl.append(
          h('span', { class: 'hint' }, 'Guruhni tanlang yoki:'),
          btn('⚔ Hammasi hujumga', () => b.commandAll(ps, { kind: 'charge' }), 'small red'),
          btn('✋ Hammasi turib tursin', () => b.commandAll(ps, { kind: 'hold' }), 'small'),
          btn(canRetreat ? '↩ Hammasi chekinsin' : `↩ ${lock}s`, () => b.commandAll(ps, { kind: 'retreat' }), 'small', !canRetreat),
        );
      }
    }

    // Voqealar
    if (b.events.length > this.lastEvent) {
      const ev = b.events[b.events.length - 1];
      this.lastEvent = b.events.length;
      this.eventEl?.remove();
      const el = h('div', { class: 'bevent' }, ev.text);
      this.eventEl = el;
      this.root.appendChild(el);
      setTimeout(() => el.remove(), 2500);
    }
  }
}
