// Bosh sahifa: chapda ingichka panel (profil, ID, oltin, sozlamalar), markazda tab mazmuni,
// pastda tablar: O'yin (xarita), PvP, Kuchaytirish, Market.
import { MAP_IMAGE, unitIcon } from '../assets.ts';
import {
  BATTLES, BOOSTS, COLORS, FACTIONS, ITEMS, TEMPER_NAME, TERRAIN_NAME, UPGRADES, popCap,
} from '../config.ts';
import type { Kind, UpgradeId } from '../config.ts';
import {
  buyBoost, buyUpgrade, campaignDone, itemsFor, newSave, stepFor, takeBoosts, upgradeCost, upgradeOpen, writeSave,
} from '../campaign.ts';
import { profile } from '../telegram.ts';
import { GOLD, ICON, button, closeModal, el, modal } from './common.ts';
import { state } from './state.ts';
import { startBattle } from './battleScreen.ts';

export type Tab = 'oyin' | 'pvp' | 'kuchaytirish' | 'market';

const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'oyin', name: "O'yin", icon: ICON.swords },
  { id: 'pvp', name: 'PvP', icon: ICON.shield },
  { id: 'kuchaytirish', name: 'Kuchaytirish', icon: ICON.up },
  { id: 'market', name: 'Market', icon: ICON.bag },
];

// Bizning bayroq turadigan joy: hali g'alaba bo'lmasa — xaritaning g'arbiy chetida
const HOME: [number, number] = [0.085, 0.37];

export const RULES = `
<p><b>Maqsad:</b> dushman qasrini yiqitish. Sizning qasringiz yiqilsa, jang shu joyning o'zida qayta o'ynaladi.</p>
<p><b>Kumush:</b> konchilar kondan kumush olib, qasr yoniga to'playdi. Doirani bosib kumushni oling. Ombor to'lsa konchilar kutib qoladi.</p>
<p><b>Askar yollash:</b> chap yuqoridagi tugmalar. Bir necha marta bossangiz navbatga turadi va bittalab chiqadi. × navbatdan bittasini olib tashlaydi, puli qaytadi.</p>
<p><b>Holatlar:</b> <i>Chekinish</i> — hamma qasrga kiradi, ichkaridagi kamonchilar otadi. <i>Joyida tur</i> — qasr oldida saf tortadi. <i>Hujum</i> — dushman qasri tomon yuradi.</p>
<p><b>Amir</b> halok bo'lsa, qo'shin o'zi qasrga chekinadi va 20 soniyadan keyin yangi Amir bilan chiqadi.</p>
<p><b>Kim kimni yengadi:</b> nayzachi otliqni to'xtatadi; otliq kamonchi va qilichlini bosib ketadi; qilichli nayzachi va kamonchini yengadi; kamonchi nayzachiga kuchli, lekin katta qalqonli qilichliga kuchsiz.</p>
<p><b>Kuchaytirish</b> jangchini doimiy kuchliroq qiladi. <b>Market</b>dagi tezlatish faqat bitta jangga amal qiladi.</p>
<p><b>G'alaba</b> yangi askar turini ochadi, qolgan kumush oltinga aylanadi (10 kumush = 1 oltin).</p>`;

let current: Tab = 'oyin';
let selected = -1;

export function showHome(tab: Tab = current): void {
  closeModal();
  current = tab;
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  const s = el('section', 'screen');
  s.id = 'home';

  // --- Chap panel ---
  const p = profile();
  const rail = el('aside');
  rail.id = 'rail';
  const avatar = el('div', 'avatar');
  if (p.photo) avatar.innerHTML = `<img src="${p.photo}" alt="">`;
  else avatar.textContent = p.name.slice(0, 1).toUpperCase();
  rail.append(
    avatar,
    el('div', 'pid', `ID<br>${p.id}`),
    el('div', 'rail-gold', `${GOLD}<b>${state.save.gold}</b>`),
    el('div', 'spacer'),
    button(ICON.gear, showSettings, 'rail-btn'),
  );

  // --- Tab mazmuni va tablar ---
  const main = el('main');
  main.id = 'home-main';
  const body = el('div');
  body.id = 'tab-body';
  const nav = el('nav');
  nav.id = 'tabs';
  for (const t of TABS) {
    nav.append(button(`${t.icon}<span>${t.name}</span>`, () => showHome(t.id), t.id === tab ? 'on' : ''));
  }
  main.append(body, nav);
  s.append(rail, main);
  app.append(s);

  if (tab === 'oyin') renderMap(body);
  else if (tab === 'pvp') renderPvp(body);
  else if (tab === 'kuchaytirish') renderUpgrades(body);
  else renderMarket(body);
}

// ---------------- O'yin: xarita ----------------

function renderMap(body: HTMLElement): void {
  const save = state.save;
  if (selected < 0 || selected >= BATTLES.length) selected = Math.min(save.won, BATTLES.length - 1);
  const area = el('div', 'map-area');
  const wrap = el('div', 'map-wrap');
  const img = el('img');
  img.src = MAP_IMAGE;
  img.alt = 'Xarita';
  wrap.append(img);

  const at = (m: [number, number]) => `${m[0] * 1280},${m[1] * 720}`;
  const pts = [at(HOME), ...BATTLES.map((b) => at(b.map))];
  const done = pts.slice(0, Math.min(save.won + 2, pts.length));
  wrap.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 1280 720" preserveAspectRatio="none">
    <polyline points="${pts.join(' ')}" fill="none" stroke="rgba(20,12,4,.6)" stroke-width="7" stroke-linejoin="round"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="rgba(255,240,205,.85)" stroke-width="3" stroke-dasharray="10 8" stroke-linejoin="round"/>
    <polyline points="${done.join(' ')}" fill="none" stroke="#e8c060" stroke-width="5" stroke-linejoin="round"/>
  </svg>`);

  BATTLES.forEach((b, i) => {
    const st = i < save.won ? 'won' : i === save.won ? 'current' : 'locked';
    const n = button(i < save.won ? '✓' : String(i + 1), () => {
      selected = i;
      showHome('oyin');
    }, `node ${st}${i === selected ? ' sel' : ''}`);
    n.style.left = `${b.map[0] * 100}%`;
    n.style.top = `${b.map[1] * 100}%`;
    n.title = b.name;
    wrap.append(n);
  });

  // Bizning bayroq: oxirgi zabt etilgan joyda
  const flagAt = save.won > 0 ? BATTLES[Math.min(save.won, BATTLES.length) - 1].map : HOME;
  const flag = el('div', 'our-flag', `<svg viewBox="0 0 40 48" width="100%" height="100%">
    <line x1="6" y1="2" x2="6" y2="46" stroke="#3a2a14" stroke-width="3" stroke-linecap="round"/>
    <path d="M7 4 H34 L28 12 L34 20 H7 Z" fill="#2346c8" stroke="#e8c060" stroke-width="2"/>
    <circle cx="18" cy="12" r="3.5" fill="#e8c060"/></svg>`);
  flag.style.left = `${flagAt[0] * 100}%`;
  flag.style.top = `${flagAt[1] * 100}%`;
  wrap.append(flag);
  area.append(wrap);

  // Tanlangan jang haqida
  const def = BATTLES[selected];
  const status = selected < save.won ? 'Zabt etilgan ✓' : selected === save.won ? 'Navbatdagi jang' : 'Hali yopiq';
  const fac = FACTIONS[def.faction];
  const color = COLORS[def.color];
  const card = el('div', 'battle-card');
  card.append(el('div', '', `
    <div class="title">${selected + 1}. ${def.name}</div>
    <div class="muted">${TERRAIN_NAME[def.terrain]} · ${status}</div>
    <div class="enemy"><span class="swatch" style="background:${color.hex}"></span><b>${fac.name}</b> · ${color.name}</div>
    <div class="muted small extra">${fac.desc}. ${TEMPER_NAME[def.temper]}.</div>
    <div class="small extra">Siz yollaysiz: ${namesFor(0, selected)}</div>
    <div class="small muted">Askar chegarasi: ${popCap(stepFor(0, selected))}</div>`));
  const owned = BOOSTS.filter((b) => save.boosts[b.id] > 0);
  if (owned.length && selected === save.won) {
    card.append(el('div', 'chips', owned.map((b) => `<span class="chip">⚡ ${b.name}</span>`).join('')));
  }
  if (campaignDone(save)) {
    card.append(el('div', 'small', '<b style="color:var(--gold)">Barcha viloyatlar zabt etildi!</b>'));
  }
  const go = button('Jangga kirish', () => startBattle(selected, takeBoosts(state.save)), 'primary');
  go.disabled = selected !== save.won;
  card.append(go);
  area.append(card);
  body.append(area);
  placeCard(card, wrap);
  // ekran aylansa yoki o'lchami o'zgarsa qaytadan joylanadi
  new ResizeObserver(() => placeCard(card, wrap)).observe(area);
}

// Karta xaritadagi jang tugunlarini yopmasin: to'rt burchakdan eng kam tugun yopadiganini tanlaymiz
// (tanlangan jangni yopish — eng yomoni). Yopilib qolgani bo'lsa ham tugun karta ustida turadi va bosiladi.
function placeCard(card: HTMLElement, wrap: HTMLElement): void {
  const nodes = [...wrap.querySelectorAll<HTMLElement>('.node')].map((n) => ({ r: n.getBoundingClientRect(), sel: n.classList.contains('sel') }));
  let best: [boolean, boolean] = [false, false];
  let bestScore = Infinity;
  for (const pos of [[false, false], [true, false], [false, true], [true, true]] as [boolean, boolean][]) {
    card.classList.toggle('at-left', pos[0]);
    card.classList.toggle('at-top', pos[1]);
    const c = card.getBoundingClientRect();
    let score = 0;
    for (const { r, sel } of nodes) {
      const hit = r.right > c.left - 4 && r.left < c.right + 4 && r.bottom > c.top - 4 && r.top < c.bottom + 4;
      if (hit) score += sel ? 100 : 1;
    }
    if (score < bestScore) {
      bestScore = score;
      best = pos;
    }
  }
  card.classList.toggle('at-left', best[0]);
  card.classList.toggle('at-top', best[1]);
}

function namesFor(side: 0 | 1, level: number): string {
  const ids = itemsFor(stepFor(side, level));
  return ITEMS.filter((it) => ids.includes(it.id) && it.rank === 'oddiy').map((it) => it.name).join(', ') +
    (ids.some((id) => ITEMS.find((x) => x.id === id)!.rank !== 'oddiy') ? ', sarkardalar' : '');
}

// ---------------- PvP ----------------

function renderPvp(body: HTMLElement): void {
  body.append(el('div', 'panel center', `
    <div class="card big">
      <div class="title">PvP — tez orada</div>
      <p class="muted">Boshqa o'yinchilar bilan jang keyingi bosqichda qo'shiladi.</p>
    </div>`));
}

// ---------------- Kuchaytirish ----------------

function renderUpgrades(body: HTMLElement): void {
  const save = state.save;
  const panel = el('div', 'panel');
  panel.append(el('div', 'panel-head', `<h2>Kuchaytirish</h2><div class="gold-big">${GOLD}${save.gold}</div>`));
  panel.append(el('p', 'muted small', "Kuchaytirish doimiy: jangchi avvalgi darajasidan kuchliroq bo'ladi."));
  for (const group of ['askar', 'qasr'] as const) {
    panel.append(el('h3', '', group === 'askar' ? 'Jangchilar' : 'Qasr'));
    const grid = el('div', 'grid');
    for (const u of UPGRADES.filter((x) => x.group === group)) grid.append(upgradeCard(u.id));
    panel.append(grid);
  }
  body.append(panel);
}

function upgradeCard(id: UpgradeId): HTMLElement {
  const save = state.save;
  const u = UPGRADES.find((x) => x.id === id)!;
  const lvl = save.up[id];
  const cost = upgradeCost(save, id);
  const open = upgradeOpen(save, id);
  const card = el('div', `up-card${open ? '' : ' locked'}`);
  const icon = u.group === 'askar' ? `<img src="${unitIcon(id as Kind)}" alt="">` : '<span class="castle-ico">🏰</span>';
  card.append(el('div', 'up-icon', icon));
  const info = el('div', 'up-info');
  info.append(
    el('div', 'title', u.name),
    el('div', 'dots', '●'.repeat(lvl) + '○'.repeat(u.costs.length - lvl)),
    el('div', 'muted small', !open
      ? `🔒 ${u.unlock}-g'alabadan keyin`
      : cost === null ? `${u.desc(lvl)} (eng yuqori)` : `${u.desc(lvl)}<br><span class="next">→ ${u.desc(lvl + 1)}</span>`),
  );
  card.append(info);
  const b = button(cost === null ? "To'liq" : `${GOLD}${cost}`, () => {
    if (buyUpgrade(state.save, id)) showHome('kuchaytirish');
  }, cost !== null && open && save.gold >= cost ? 'primary' : '');
  b.disabled = !open || cost === null || save.gold < cost;
  card.append(b);
  return card;
}

// ---------------- Market ----------------

function renderMarket(body: HTMLElement): void {
  const save = state.save;
  const panel = el('div', 'panel');
  panel.append(el('div', 'panel-head', `<h2>Market</h2><div class="gold-big">${GOLD}${save.gold}</div>`));
  panel.append(el('p', 'muted small', "Tezlatish faqat bitta jangga amal qiladi: sotib olganingiz keyingi jang boshlanganda ishlatiladi."));
  const grid = el('div', 'grid');
  for (const b of BOOSTS) {
    const card = el('div', 'up-card');
    card.append(el('div', 'up-icon', '<span class="castle-ico">⚡</span>'));
    card.append(el('div', 'up-info', `<div class="title">${b.name}</div><div class="muted small">${b.desc}</div>
      <div class="small">Sizda: <b>${save.boosts[b.id]}</b></div>`));
    const btn = button(`${GOLD}${b.cost}`, () => {
      if (buyBoost(state.save, b.id)) showHome('market');
    }, save.gold >= b.cost ? 'primary' : '');
    btn.disabled = save.gold < b.cost;
    card.append(btn);
    grid.append(card);
  }
  panel.append(grid);
  panel.append(el('p', 'muted small', 'Telegram Stars orqali xarid — keyingi bosqichda.'));
  body.append(panel);
}

// ---------------- Sozlamalar ----------------

function showSettings(): void {
  const p = profile();
  const body = el('div');
  body.append(el('div', 'row', `<span>${p.name}</span><b>ID ${p.id}</b>`));
  const sound = button('Ovoz — tez orada', () => undefined);
  sound.disabled = true;
  modal('Sozlamalar', body, [
    button('Qoidalar', () => modal("O'yin qoidalari", RULES, [button('Tushunarli', closeModal, 'primary')]), 'primary'),
    sound,
    button("O'yinni qaytadan boshlash", () => modal("O'yinni qaytadan boshlash", "Barcha yutuqlar, oltin va kuchaytirishlar o'chadi. Davom etasizmi?", [
      button('Ha, yangidan', () => {
        state.save = newSave();
        writeSave(state.save);
        selected = -1;
        showHome('oyin');
      }, 'primary'),
      button("Yo'q", closeModal),
    ])),
    button('Yopish', closeModal),
  ]);
}

