// Jang ekrani: chap yuqorida yollash tugmalari (umumiy navbat), o'ng yuqorida kumush, askar soni va pauza,
// pastda holatlar (Chekinish / Joyida tur / Hujum), kichik xarita va kamera tugmalari.
import { unitIcon } from '../assets.ts';
import { Battle } from '../battle.ts';
import type { BuyError } from '../battle.ts';
import { BATTLES, BOOSTS, ITEMS, MAX_MINERS, WORLD_W } from '../config.ts';
import type { BoostId, ItemId, Stance } from '../config.ts';
import { campaignDone, finishBattle, takeBoosts } from '../campaign.ts';
import { Renderer } from '../render.ts';
import { haptic } from '../telegram.ts';
import { COIN, GOLD, ICON, button, closeModal, el, hasModal, modal } from './common.ts';
import { showHome } from './home.ts';
import { state } from './state.ts';

const STEP = 1 / 30;

const BUY_ERR: Record<BuyError, string> = {
  kumush: 'Kumush yetmaydi',
  joy: "Askar chegarasi to'lgan",
  navbat: "Navbat to'lgan (10 ta)",
  konchi: `Konchilar soni chegarada (${MAX_MINERS})`,
  bor: 'Bu jangda allaqachon olingan',
  yopiq: 'Hali ochilmagan',
};

const HINTS = [
  "Konchilar kondan kumush olib, qasr yoniga to'playdi. Qasr yonidagi <b>doirani bosing</b> — kumush sizniki. Maydonni barmoq bilan suring.",
  "Chap yuqoridagi tugmalardan <b>askar yollang</b>. Bir necha marta bossangiz navbatga turadi, × bilan bittasini olib tashlaysiz.",
  "Askarlar <b>Joyida tur</b> holatida qasr oldida saf tortadi. Kuchingiz yetganda <b>Hujum</b>ni bosing.",
  "Qiyin bo'lsa <b>Chekinish</b>: hamma qasrga kiradi, ichkaridagi kamonchilar qasrdan otadi. Dushman qasrini yiqiting!",
];

export function startBattle(level: number, boosts: BoostId[] = []): void {
  closeModal();
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  const s = el('section', 'screen');
  s.id = 'battle';
  const canvas = el('canvas');
  s.append(canvas);

  const b = new Battle(level, state.save, boosts);
  const r = new Renderer(canvas);
  r.setEnemyColor(level);
  if (import.meta.env.DEV) (window as unknown as { umarBattle: Battle }).umarBattle = b; // faqat sinov uchun

  // --- Chap yuqori: yollash tugmalari ---
  const shop = el('div', 'hud');
  shop.id = 'shop';
  const ids = ITEMS.filter((it) => b.sides[0].items.includes(it.id));
  const keys = '1234567890';
  const slots = ids.map((it, i) => {
    const slot = el('div', `slot${it.rank !== 'oddiy' ? ' special' : ''}`);
    const btn = el('button', 'unit');
    btn.title = `${it.name} — ${it.cost} kumush, ${it.train} soniya`;
    btn.innerHTML = `<div class="fill"></div><img src="${unitIcon(it.kind)}" alt=""><span class="key">${keys[i] ?? ''}</span><span class="q"></span>`;
    btn.addEventListener('click', () => tryBuy(it.id, btn));
    const x = button('×', () => {
      if (b.cancel(0, it.id)) haptic('light');
    }, 'x hidden');
    x.title = 'Navbatdan bittasini olib tashlash';
    slot.append(btn, x, el('div', 'price', `${COIN}${it.cost}`));
    shop.append(slot);
    return {
      it, btn, x,
      q: btn.querySelector('.q') as HTMLElement,
      fill: btn.querySelector('.fill') as HTMLElement,
    };
  });

  // --- O'ng yuqori: kumush, askar soni, pauza ---
  const top = el('div', 'hud');
  top.id = 'topbar';
  const silverEl = el('div', 'chip-big silver-chip');
  const popEl = el('div', 'chip-big');
  top.append(silverEl, popEl, button(ICON.pause, () => pause(), 'icon-btn'));
  const boostRow = el('div', 'hud');
  boostRow.id = 'boost-row';
  boostRow.innerHTML = boosts.map((id) => `<span class="chip">⚡ ${BOOSTS.find((x) => x.id === id)!.name}</span>`).join('');

  // --- Pastki qism ---
  const stances = el('div', 'hud');
  stances.id = 'stances';
  const stanceBtns: Record<Stance, HTMLButtonElement> = {
    chekinish: button('◀◀ Chekinish<small>Q</small>', () => setStance('chekinish')),
    tur: button('■ Joyida tur<small>W</small>', () => setStance('tur')),
    hujum: button('Hujum ▶▶<small>E</small>', () => setStance('hujum')),
  };
  stances.append(stanceBtns.chekinish, stanceBtns.tur, stanceBtns.hujum);

  const cam = el('div', 'hud');
  cam.id = 'cam-btns';
  cam.append(
    button(ICON.home, () => r.centerOn(500), 'icon-btn'),
    button(ICON.front, () => {
      const xs = b.units.filter((u) => u.side === 0 && !u.dead && !u.garrison && u.kind !== 'konchi').map((u) => u.x);
      r.centerOn(xs.length ? Math.max(...xs) : 500);
    }, 'icon-btn'),
  );

  const banner = el('div', 'hud hidden');
  banner.id = 'banner';
  const toasts = el('div', 'hud');
  toasts.id = 'toasts';
  const hint = el('div', 'hud hidden');
  hint.id = 'hint';

  s.append(shop, top, boostRow, stances, cam, banner, toasts, hint);
  app.append(s);
  r.cam = 0;

  // --- Holat ---
  let speed = 1;
  let paused = false;
  let running = true;
  let resultShown = false;
  let last = performance.now();
  let acc = 0;
  let hintStep = level === 0 ? 0 : -1;
  let hintT = 0;
  const held = new Set<string>();

  function toast(text: string, kind: 'good' | 'bad' | '' = ''): void {
    const t = el('div', `toast ${kind}`, text);
    toasts.append(t);
    while (toasts.children.length > 3) toasts.firstChild!.remove();
    setTimeout(() => t.remove(), 3500);
  }

  function tryBuy(id: ItemId, btn: HTMLElement): void {
    if (b.winner !== null) return;
    const err = b.buy(0, id);
    if (err) {
      toast(BUY_ERR[err], 'bad');
      btn.classList.remove('flash');
      void btn.offsetWidth;
      btn.classList.add('flash');
      haptic('medium');
    } else {
      haptic('light');
      if (hintStep === 1 && id !== 'konchi') hintStep = 2;
    }
  }

  function setStance(st: Stance): void {
    if (b.sides[0].amirDead) {
      toast("Amir qaytguncha qo'shin qasrda", 'bad');
      return;
    }
    b.setStance(0, st);
    if (hintStep === 2 && st === 'hujum') {
      hintStep = 3;
      hintT = 0;
    }
  }

  function collect(): void {
    const got = b.collect();
    if (got > 0) {
      toast(`+${Math.floor(got)} kumush`, 'good');
      haptic('light');
      if (hintStep === 0) hintStep = 1;
    }
  }

  function resume(): void {
    closeModal();
    paused = false;
    last = performance.now();
  }

  function pause(): void {
    if (resultShown) return;
    paused = true;
    const speedBtn = button(`Tezlik: x${speed}`, () => {
      speed = speed === 1 ? 2 : 1;
      speedBtn.textContent = `Tezlik: x${speed}`;
    });
    modal("To'xtatildi", '', [
      button('Davom etish', resume, 'primary'),
      button('Qaytadan boshlash', () => { stop(); startBattle(level, boosts); }),
      button('Bosh sahifaga', () => { stop(); showHome('oyin'); }),
      speedBtn,
    ]);
  }

  function stop(): void {
    running = false;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', onResize);
  }

  function showResult(): void {
    resultShown = true;
    const side = b.sides[0];
    const won = b.winner === 0;
    const silver = Math.floor(side.silver + side.stock);
    const save = state.save;
    const rw = finishBattle(save, level, won, silver);
    const body = el('div');
    haptic(won ? 'heavy' : 'medium');
    if (won) {
      body.append(
        el('div', 'row', `<span>Qolgan kumush: ${silver}</span><b>+${rw.fromSilver} oltin</b>`),
        el('div', 'row', `<span>G'alaba mukofoti</span><b>+${rw.bonus} oltin</b>`),
        el('div', 'row', `<span>Jami</span><b style="color:var(--gold)">${GOLD}+${rw.total}</b>`),
      );
      if (rw.unlocked) body.append(el('div', 'card', `<div class="title">Yangi ochildi: ${rw.unlocked}</div>Keyingi jangda kumushga sotib olishingiz mumkin.`));
      if (campaignDone(save) && level === BATTLES.length - 1) {
        body.append(el('div', 'card', '<div class="title">Barcha viloyatlar zabt etildi!</div>Siz butun xaritani birlashtirdingiz.'));
      }
      modal("G'alaba!", body, [button('Bosh sahifaga', () => { stop(); showHome('oyin'); }, 'primary')]);
    } else {
      body.append(
        el('div', 'row', `<span>Qolgan kumush: ${silver}</span><b>${GOLD}+${rw.total} (yarmi)</b>`),
        el('p', 'muted', "Ochilgan askarlar va kuchaytirishlar saqlanadi. Kuchaytirib, qayta urinib ko'ring!"),
      );
      modal("Mag'lubiyat", body, [
        button('Qayta urinish', () => { stop(); startBattle(level, takeBoosts(state.save)); }, 'primary'),
        button('Kuchaytirish', () => { stop(); showHome('kuchaytirish'); }),
        button('Bosh sahifaga', () => { stop(); showHome('oyin'); }),
      ]);
    }
  }

  // --- Kiritish ---
  function onKey(e: KeyboardEvent): void {
    if (hasModal()) {
      if (e.key === 'Escape' && paused && !resultShown) resume();
      return;
    }
    const k = e.key.toLowerCase();
    held.add(k);
    const idx = keys.indexOf(k);
    if (idx >= 0 && slots[idx]) tryBuy(slots[idx].it.id, slots[idx].btn);
    else if (k === 'q') setStance('chekinish');
    else if (k === 'w') setStance('tur');
    else if (k === 'e') setStance('hujum');
    else if (k === ' ') { e.preventDefault(); collect(); }
    else if (k === 'p' || k === 'escape') pause();
  }
  function onKeyUp(e: KeyboardEvent): void {
    held.delete(e.key.toLowerCase());
  }
  function onResize(): void {
    r.resize();
    r.safe = {
      left: stances.getBoundingClientRect().right,
      right: cam.getBoundingClientRect().left,
      top: Math.max(shop.getBoundingClientRect().bottom, top.getBoundingClientRect().bottom),
    };
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', onResize);
  onResize();

  let drag: { x: number; cam: number; moved: boolean; mini: boolean } | null = null;
  const inRect = (x: number, y: number, rc: { x: number; y: number; w: number; h: number } | null) =>
    !!rc && x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h;
  const miniX = (ox: number) => ((ox - r.minimap.x) / r.minimap.w) * WORLD_W;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const mini = inRect(e.offsetX, e.offsetY, { ...r.minimap, y: r.minimap.y - 10, h: r.minimap.h + 20 });
    drag = { x: e.clientX, cam: r.cam, moved: false, mini };
    if (mini) r.centerOn(miniX(e.offsetX));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.mini) {
      r.centerOn(miniX(e.offsetX));
      return;
    }
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) {
      r.cam = drag.cam - dx / r.scale;
      r.clampCam();
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved && !drag.mini) {
      const bb = r.bubble;
      if (bb && inRect(e.offsetX, e.offsetY, { x: bb.x - 12, y: bb.y - 12, w: bb.w + 24, h: bb.h + 24 })) collect();
    }
    drag = null;
  });
  canvas.addEventListener('wheel', (e) => {
    r.cam += ((e.deltaX + e.deltaY) / r.scale) * 0.6;
    r.clampCam();
  }, { passive: true });

  // --- Tsikl ---
  const shown = { silver: -1, pop: '' };
  function updateHud(dt: number): void {
    const side = b.sides[0];
    const silver = Math.floor(side.silver);
    if (silver !== shown.silver) {
      silverEl.innerHTML = `${COIN}<b>${silver}</b>`;
      shown.silver = silver;
    }
    const pop = `${b.popUsed(0)}/${side.popCap}`;
    if (pop !== shown.pop) {
      popEl.innerHTML = `${ICON.person}<b>${pop}</b>`;
      shown.pop = pop;
    }

    const tr = b.training(0);
    for (const sl of slots) {
      const n = b.queued(0, sl.it.id);
      const done = sl.it.rank !== 'oddiy' && side.bought.has(sl.it.id) && n === 0;
      const qt = n > 0 ? String(n) : done ? '✓' : '';
      if (sl.q.textContent !== qt) sl.q.textContent = qt;
      sl.x.classList.toggle('hidden', n === 0);
      // Tayyorlanayotgan tur pastdan yuqoriga to'ladi
      const p = tr && tr.id === sl.it.id ? tr.p : 0;
      sl.fill.style.height = `${Math.round(p * 100)}%`;
      const err = b.canBuy(0, sl.it.id);
      sl.btn.classList.toggle('off', err !== null && err !== 'navbat');
    }
    for (const st of Object.keys(stanceBtns) as Stance[]) {
      stanceBtns[st].classList.toggle('on', side.stance === st);
      stanceBtns[st].disabled = side.amirDead;
    }
    if (side.amirDead) {
      banner.classList.remove('hidden');
      banner.textContent = `Amir halok bo'ldi — qo'shin qasrda, yangi Amir ${Math.ceil(side.amirTimer)} soniyadan keyin`;
    } else banner.classList.add('hidden');

    // Amir halok bo'lgani tepadagi yozuvda ko'rinib turadi — alohida xabar shart emas
    for (const ev of b.events.splice(0)) if (ev.amir !== 'dead') toast(ev.text, ev.good ? 'good' : 'bad');

    if (hintStep >= 0 && hintStep < HINTS.length) {
      hint.classList.remove('hidden');
      hint.innerHTML = HINTS[hintStep];
      if (hintStep === 3) {
        hintT += dt;
        if (hintT > 12) hintStep = -1;
      }
    } else hint.classList.add('hidden');
  }

  function frame(now: number): void {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) {
      acc += dt * speed;
      while (acc >= STEP) {
        b.step(STEP);
        acc -= STEP;
      }
    }
    const pan = (held.has('arrowright') || held.has('d') ? 1 : 0) - (held.has('arrowleft') || held.has('a') ? 1 : 0);
    if (pan) {
      r.cam += pan * 800 * dt;
      r.clampCam();
    }
    r.draw(b);
    updateHud(dt);
    if (b.winner !== null && b.overT > 2.2 && !resultShown) showResult();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
