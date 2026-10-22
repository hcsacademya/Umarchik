// Ekranlar: bosh menyu, yurish xaritasi, jang (tugmalar), natija va kuchaytirish oynalari.
import { MAP_IMAGE, unitIcon } from './assets.ts';
import { Battle } from './battle.ts';
import type { BuyError } from './battle.ts';
import { BATTLES, ITEMS, MAX_MINERS, TERRAIN_NAME, UPGRADES, WORLD_W, popCap } from './config.ts';
import type { ItemId, Stance } from './config.ts';
import {
  buyUpgrade, campaignDone, finishBattle, itemsFor, loadSave, newSave, stepFor, upgradeCost, writeSave,
} from './campaign.ts';
import type { Save } from './campaign.ts';
import { Renderer } from './render.ts';

const app = document.getElementById('app')!;
let save: Save = loadSave() ?? newSave();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', cls, label);
  b.addEventListener('click', onClick);
  return b;
}

function itemNames(ids: ItemId[]): string {
  return ids.map((id) => ITEMS.find((x) => x.id === id)!.name).join(', ');
}

// ---------------- Oyna (modal) ----------------

function modal(title: string, body: HTMLElement | string, actions: HTMLButtonElement[]): HTMLElement {
  closeModal();
  const m = el('div');
  m.id = 'modal';
  const box = el('div', 'box');
  box.append(el('h2', '', title));
  if (typeof body === 'string') box.append(el('div', 'rules', body));
  else box.append(body);
  const act = el('div', 'actions');
  act.append(...actions);
  box.append(act);
  m.append(box);
  document.body.append(m);
  return box;
}

function closeModal(): void {
  document.getElementById('modal')?.remove();
}

const RULES = `
<p><b>Maqsad:</b> dushman qasrini yiqitish. Sizning qasringiz yiqilsa — jang yutqaziladi, uni qayta o'ynaysiz.</p>
<p><b>Kumush:</b> konchilar kondan kumush olib, qasr yoniga to'playdi. Qasr ustidagi doirani bosib kumushni oling — ombor to'lsa konchilar kutib qoladi.</p>
<p><b>Askar yollash:</b> tepadagi tugmalar. Doira aylanib bo'lgach askar qasrdan chiqadi.</p>
<p><b>Holatlar:</b> <i>Chekinish</i> — hamma qasrga kiradi, ichkaridagi kamonchilar qasrdan otadi. <i>Joyida tur</i> — qasr oldida saf tortadi. <i>Hujum</i> — dushman qasri tomon yuradi.</p>
<p><b>Amir</b> halok bo'lsa, qo'shin o'zi qasrga chekinadi va 20 soniyadan keyin yangi Amir bilan chiqadi.</p>
<p><b>Tur ustunligi:</b> nayzachi otliqni, otliq kamonchini, kamonchi qilichlini, qilichli nayzachini yengadi.</p>
<p><b>G'alaba</b> yangi askar turini ochadi, qolgan kumush oltinga aylanadi (10 kumush = 1 oltin). Oltinga qasr va askarlarni kuchaytirasiz.</p>
<p><b>Boshqaruv:</b> maydonni suring yoki pastdagi kichik xaritani bosing. Klaviatura: 1–0 yollash, Q/W/E holatlar, Bo'shliq — kumushni olish, P — pauza.</p>`;

// ---------------- Bosh menyu ----------------

export function showMenu(): void {
  closeModal();
  app.innerHTML = '';
  const s = el('section', 'screen');
  s.id = 'menu';
  s.style.backgroundImage = `radial-gradient(ellipse at center, rgba(28,20,12,.35), rgba(28,20,12,.92)), url(${MAP_IMAGE})`;
  s.append(el('h1', '', 'UMAR'), el('p', '', "Qal'ama-qal'a yurish"));
  const hasSave = loadSave() !== null;
  if (hasSave) s.append(button('Davom etish', () => showMap(), 'primary'));
  s.append(
    button("Yangi o'yin", () => {
      if (!hasSave) return startNew();
      modal("Yangi o'yin", 'Barcha yutuqlar, oltin va kuchaytirishlar o\'chadi. Davom etasizmi?', [
        button("Ha, yangidan", startNew, 'primary'),
        button("Yo'q", closeModal),
      ]);
    }, hasSave ? '' : 'primary'),
    button("Qoidalar", () => modal("O'yin qoidalari", RULES, [button('Tushunarli', closeModal, 'primary')])),
  );
  app.append(s);
}

function startNew(): void {
  closeModal();
  save = newSave();
  writeSave(save);
  showMap();
}

// ---------------- Yurish xaritasi ----------------

export function showMap(selected = Math.min(save.won, BATTLES.length - 1)): void {
  closeModal();
  app.innerHTML = '';
  const s = el('section', 'screen');
  s.id = 'campaign';
  const area = el('div', 'map-area');
  const wrap = el('div', 'map-wrap');
  const img = el('img');
  img.src = MAP_IMAGE;
  img.alt = 'Xarita';
  wrap.append(img);

  const pts = BATTLES.map((b) => `${b.map[0] * 1280},${b.map[1] * 720}`);
  const done = pts.slice(0, Math.min(save.won + 1, pts.length));
  wrap.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 1280 720" preserveAspectRatio="none">
    <polyline points="${pts.join(' ')}" fill="none" stroke="rgba(20,12,4,.6)" stroke-width="7" stroke-linejoin="round"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="rgba(255,240,205,.85)" stroke-width="3" stroke-dasharray="10 8" stroke-linejoin="round"/>
    <polyline points="${done.join(' ')}" fill="none" stroke="#e8c060" stroke-width="5" stroke-linejoin="round"/>
  </svg>`);

  BATTLES.forEach((b, i) => {
    const state = i < save.won ? 'won' : i === save.won ? 'current' : 'locked';
    const n = button(i < save.won ? '✓' : String(i + 1), () => showMap(i), `node ${state}${i === selected ? ' sel' : ''}`);
    n.style.left = `${b.map[0] * 100}%`;
    n.style.top = `${b.map[1] * 100}%`;
    n.title = b.name;
    wrap.append(n);
  });
  area.append(wrap);

  const panel = el('aside');
  panel.id = 'map-panel';
  panel.append(el('h2', '', 'Yurish xaritasi'), el('div', 'gold', `Oltin: ${save.gold}`));
  if (campaignDone(save)) {
    panel.append(el('div', 'card', '<div class="title">Barcha viloyatlar zabt etildi!</div>Tabriklaymiz, Amir. Kuchaytirishlarni davom ettirishingiz mumkin.'));
  }
  const def = BATTLES[selected];
  const status = selected < save.won ? 'Zabt etilgan ✓' : selected === save.won ? 'Navbatdagi jang' : 'Hali yopiq';
  panel.append(el('div', 'card', `
    <div class="title">${selected + 1}. ${def.name}</div>
    <div class="muted">${TERRAIN_NAME[def.terrain]} · ${status}</div>
    <div style="margin-top:6px">Siz yollaysiz: ${itemNames(itemsFor(stepFor(0, selected)))}</div>
    <div>Dushmanda: ${itemNames(itemsFor(stepFor(1, selected)))}</div>
    <div class="muted">Askar chegarasi: ${popCap(stepFor(0, selected))}</div>`));
  const go = button('Jangga kirish', () => startBattle(selected), 'primary');
  go.disabled = selected !== save.won;
  panel.append(go, button('Kuchaytirish', () => showUpgrades(() => showMap(selected))), el('div', 'spacer'), button('Bosh menyu', showMenu));

  s.append(area, panel);
  app.append(s);
}

function showUpgrades(onClose: () => void): void {
  const body = el('div');
  body.append(el('div', 'gold', `<b style="color:var(--gold)">Oltin: ${save.gold}</b>`));
  for (const u of UPGRADES) {
    const lvl = save.up[u.id];
    const cost = upgradeCost(save, u.id);
    const row = el('div', 'up');
    const b = button(cost === null ? 'To\'liq' : `${cost} oltin`, () => {
      if (buyUpgrade(save, u.id)) showUpgrades(onClose);
    }, cost !== null && save.gold >= cost ? 'primary' : '');
    b.disabled = cost === null || save.gold < cost;
    row.append(
      el('div', '', `<b>${u.name}</b>`),
      b,
      el('div', 'dots', '●'.repeat(lvl) + '○'.repeat(u.costs.length - lvl)),
      el('div', 'muted', cost === null ? u.desc(lvl) : `${u.desc(lvl)} → ${u.desc(lvl + 1).split(': ')[1]}`),
    );
    body.append(row);
  }
  modal('Kuchaytirish', body, [button('Yopish', () => { closeModal(); onClose(); }, 'primary')]);
}

// ---------------- Jang ----------------

const STEP = 1 / 30;

const BUY_ERR: Record<BuyError, string> = {
  kumush: 'Kumush yetmaydi',
  joy: "Askar chegarasi to'lgan",
  navbat: "Navbat to'lgan",
  konchi: `Konchilar soni chegarada (${MAX_MINERS})`,
  bor: 'Bu jangda allaqachon olingan',
  yopiq: 'Hali ochilmagan',
};

const HINTS = [
  "Konchilar kondan kumush olib, qasr yoniga to'playdi. Qasr ustidagi <b>doirani bosing</b> — kumush sizniki. Maydonni barmoq bilan suring yoki pastdagi kichik xaritani bosing.",
  "Tepadagi tugmalardan <b>askar yollang</b>: doira aylanib bo'lgach askar qasrdan chiqadi. Ko'proq konchi — ko'proq kumush.",
  "Askarlar <b>Joyida tur</b> holatida qasr oldida saf tortadi. Kuchingiz yetganda <b>Hujum</b>ni bosing.",
  "Qiyin bo'lsa <b>Chekinish</b>: hamma qasrga kiradi, ichkaridagi kamonchilar qasrdan otadi. Dushman qasrini yiqiting!",
];

export function startBattle(level: number): void {
  closeModal();
  app.innerHTML = '';
  const s = el('section', 'screen');
  s.id = 'battle';
  const canvas = el('canvas');
  s.append(canvas);

  const b = new Battle(level, save);
  const r = new Renderer(canvas);
  if (import.meta.env.DEV) (window as unknown as { umarBattle: Battle }).umarBattle = b; // faqat sinov uchun

  // --- Tepa: kumush, do'kon, pauza ---
  const top = el('div', 'hud');
  top.id = 'hud-top';
  const res = el('div');
  res.id = 'res';
  const silverEl = el('div', 'silver');
  const popEl = el('div');
  const minerEl = el('div');
  res.append(silverEl, popEl, minerEl);
  const shop = el('div');
  shop.id = 'shop';
  const ids = ITEMS.filter((it) => b.sides[0].items.includes(it.id));
  const keys = '1234567890';
  const shopBtns = ids.map((it, i) => {
    const btn = el('button', `unit${it.rank !== 'oddiy' ? ' special' : ''}`);
    btn.title = `${it.name} — ${it.cost} kumush`;
    btn.innerHTML = `<img src="${unitIcon(it.kind)}" alt=""><span class="key">${keys[i] ?? ''}</span><span class="q"></span><span class="cost">${it.cost}</span><div class="pie"></div>`;
    btn.addEventListener('click', () => tryBuy(it.id, btn));
    shop.append(btn);
    return { it, btn, q: btn.querySelector('.q') as HTMLElement, pie: btn.querySelector('.pie') as HTMLElement };
  });
  const right = el('div');
  right.id = 'hud-right';
  const speedBtn = button('x1', () => {
    speed = speed === 1 ? 2 : 1;
    speedBtn.textContent = `x${speed}`;
  });
  right.append(speedBtn, button('⏸', () => pause()));
  if (document.fullscreenEnabled) {
    right.append(button('⛶', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => undefined);
    }));
  }
  top.append(res, shop, right);

  // --- Holat tugmalari ---
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
    button('⌂', () => r.centerOn(500)),
    button('⚔', () => {
      const xs = b.units.filter((u) => u.side === 0 && !u.dead && !u.garrison && u.kind !== 'konchi').map((u) => u.x);
      r.centerOn(xs.length ? Math.max(...xs) : 500);
    }),
  );

  const banner = el('div', 'hud hidden');
  banner.id = 'banner';
  const toasts = el('div', 'hud');
  toasts.id = 'toasts';
  const hint = el('div', 'hud hidden');
  hint.id = 'hint';

  s.append(top, stances, cam, banner, toasts, hint);
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
    } else if (hintStep === 1 && id !== 'konchi') {
      hintStep = 2;
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
      if (hintStep === 0) hintStep = 1;
    }
  }

  function pause(): void {
    if (resultShown) return;
    paused = true;
    modal("To'xtatildi", '', [
      button('Davom etish', () => { closeModal(); paused = false; last = performance.now(); }, 'primary'),
      button('Qaytadan boshlash', () => { stop(); startBattle(level); }),
      button('Jangni tark etish', () => { stop(); showMap(level); }),
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
    const rw = finishBattle(save, level, won, silver);
    const body = el('div');
    if (won) {
      body.append(
        el('div', 'row', `<span>Qolgan kumush: ${silver}</span><b>+${rw.fromSilver} oltin</b>`),
        el('div', 'row', `<span>G'alaba mukofoti</span><b>+${rw.bonus} oltin</b>`),
        el('div', 'row', `<span>Jami</span><b style="color:var(--gold)">+${rw.total} oltin</b>`),
      );
      if (rw.unlocked) body.append(el('div', 'card', `<div class="title">Yangi ochildi: ${rw.unlocked}</div>Keyingi jangda kumushga sotib olishingiz mumkin.`));
      if (campaignDone(save) && level === BATTLES.length - 1) {
        body.append(el('div', 'card', '<div class="title">Barcha viloyatlar zabt etildi!</div>Siz butun xaritani birlashtirdingiz.'));
      }
      modal("G'alaba!", body, [button('Xaritaga', () => { stop(); showMap(); }, 'primary')]);
    } else {
      body.append(
        el('div', 'row', `<span>Qolgan kumush: ${silver}</span><b>+${rw.total} oltin (yarmi)</b>`),
        el('p', 'muted', "Ochilgan askarlar va kuchaytirishlar saqlanadi. Kuchaytirib, qayta urinib ko'ring!"),
      );
      modal("Mag'lubiyat", body, [
        button('Qayta urinish', () => { stop(); startBattle(level); }, 'primary'),
        button('Kuchaytirish', () => showUpgrades(() => { stop(); startBattle(level); })),
        button('Xaritaga', () => { stop(); showMap(level); }),
      ]);
    }
  }

  // --- Kiritish ---
  function onKey(e: KeyboardEvent): void {
    if (document.getElementById('modal')) {
      if (e.key === 'Escape' && paused && !resultShown) { closeModal(); paused = false; last = performance.now(); }
      return;
    }
    const k = e.key.toLowerCase();
    held.add(k);
    const idx = keys.indexOf(k);
    if (idx >= 0 && shopBtns[idx]) tryBuy(shopBtns[idx].it.id, shopBtns[idx].btn);
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
      top: top.getBoundingClientRect().bottom,
    };
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', onResize);
  onResize();

  let drag: { x: number; cam: number; moved: boolean; mini: boolean } | null = null;
  const inRect = (x: number, y: number, rc: { x: number; y: number; w: number; h: number } | null) =>
    !!rc && x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const mini = inRect(e.offsetX, e.offsetY, { ...r.minimap, y: r.minimap.y - 10, h: r.minimap.h + 20 });
    drag = { x: e.clientX, cam: r.cam, moved: false, mini };
    if (mini) r.centerOn(((e.offsetX - r.minimap.x) / r.minimap.w) * WORLD_W);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.mini) {
      r.centerOn(((e.offsetX - r.minimap.x) / r.minimap.w) * WORLD_W);
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
    r.cam += (e.deltaX + e.deltaY) / r.scale * 0.6;
    r.clampCam();
  }, { passive: true });

  // --- Tsikl ---
  const shown = { silver: -1, pop: '', miners: '' };
  function updateHud(dt: number): void {
    const side = b.sides[0];
    const silver = Math.floor(side.silver);
    if (silver !== shown.silver) {
      silverEl.textContent = `⬤ ${silver}`;
      shown.silver = silver;
    }
    const pop = `Askar: ${b.popUsed(0)}/${side.popCap}`;
    if (pop !== shown.pop) popEl.textContent = shown.pop = pop;
    const miners = `Konchi: ${b.minerCount(0)}/${MAX_MINERS}`;
    if (miners !== shown.miners) minerEl.textContent = shown.miners = miners;

    for (const sb of shopBtns) {
      const q = side.queues[sb.it.id];
      const p = q && q.count > 0 ? q.t / sb.it.train : 0;
      sb.pie.style.setProperty('--p', q && q.count > 0 ? String(p) : '1');
      const qt = q && q.count > 0 ? String(q.count) : sb.it.rank !== 'oddiy' && side.bought.has(sb.it.id) ? '✓' : '';
      if (sb.q.textContent !== qt) sb.q.textContent = qt;
      const err = b.canBuy(0, sb.it.id);
      sb.btn.classList.toggle('off', err !== null && err !== 'navbat');
    }
    for (const st of Object.keys(stanceBtns) as Stance[]) {
      stanceBtns[st].classList.toggle('on', side.stance === st);
      stanceBtns[st].disabled = side.amirDead;
    }
    if (side.amirDead) {
      banner.classList.remove('hidden');
      banner.textContent = `Amir halok bo'ldi — yangi Amir ${Math.ceil(side.amirTimer)} soniyadan keyin`;
    } else banner.classList.add('hidden');

    for (const ev of b.events.splice(0)) toast(ev.text, ev.good ? 'good' : 'bad');

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
