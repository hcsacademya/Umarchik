import { FACTION_COLORS, TERRAIN_INFO } from '../config';
import { getAsset } from '../render/assets';
import type { Province, Tile } from '../types';
import { MAP, generateMap } from '../world/mapgen';
import { btn, h } from './dom';

/** Boshlash ekrani: davom etish yoki yangi o'yin uchun chet viloyatni tanlash. */
export function showStart(root: HTMLElement, canContinue: boolean, onContinue: () => void, onNew: (seed: number, province: number) => void): void {
  root.innerHTML = '';
  const seed = Math.floor(Math.random() * 1e9);
  const map = generateMap(seed);
  const choices = map.provinces.filter((p) => p.zone === 'chet');
  let chosen = choices[Math.floor(Math.random() * choices.length)].id;
  const wrap = h('div', { class: 'start' });
  const canvas = h('canvas', { class: 'minimap' }) as HTMLCanvasElement;
  const list = h('div', { class: 'prov-list' });

  const renderList = () => {
    list.innerHTML = '';
    for (const p of choices) {
      list.appendChild(
        h(
          'button',
          {
            class: `prov ${p.id === chosen ? 'on' : ''}`,
            onclick: () => {
              chosen = p.id;
              renderList();
              drawMini(canvas, map.tiles, map.provinces, chosen);
            },
          },
          h('b', null, p.name),
          h('span', null, p.desc),
        ),
      );
    }
  };

  const left = h(
    'div',
    { class: 'start-left' },
    h('h1', null, 'Tarixiy strategiya'),
    h('p', { class: 'lead' }, 'Kichik qarorgoh bilan boshlang, iqtisodni rivojlantiring, qo\'shin tuzing va markazdagi ikki imperiya — Rumiya va Parsiya hududi uchun kurashing. Boshlanish joyini — chet viloyatni tanlang:'),
    list,
    h(
      'div',
      { class: 'row', style: 'margin-top:10px' },
      canContinue ? btn('▶ Davom etish', onContinue, 'green') : null,
      btn('⚔ Yangi o\'yin', () => onNew(seed, chosen), 'gold'),
    ),
  );
  wrap.append(h('div', { class: 'start-inner' }, left, canvas));
  root.appendChild(wrap);
  renderList();
  requestAnimationFrame(() => drawMini(canvas, map.tiles, map.provinces, chosen));
}

function drawMini(canvas: HTMLCanvasElement, tiles: Tile[], provinces: Province[], chosen: number): void {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(10, Math.round(r.width * dpr));
  canvas.height = Math.max(10, Math.round(r.height * dpr));
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { w: iw, h: ih } = MAP.image;
  const k = Math.min(canvas.width / iw, canvas.height / ih) * 0.98;
  const ox = (canvas.width - iw * k) / 2;
  const oy = (canvas.height - ih * k) / 2;
  const g = MAP.grid;
  const pos = (x: number, y: number) => ({ x: ox + (g.cx + ((x - y) * g.tw) / 2) * k, y: oy + (g.top + ((x + y + 1) * g.tw) / 4) * k });
  const tw = g.tw * k;
  const bg = getAsset('map_background');
  if (bg) ctx.drawImage(bg.img, ox, oy, iw * k, ih * k);
  for (const t of tiles) {
    if (t.terrain === 'tashqi') continue;
    const empire = t.province === 0 ? FACTION_COLORS.empireA : t.province === 1 ? FACTION_COLORS.empireB : '';
    const color = t.province === chosen ? FACTION_COLORS.player : empire;
    if (!color && bg) continue;
    const { x, y } = pos(t.x, t.y);
    ctx.beginPath();
    ctx.moveTo(x, y - tw / 4 - 0.5);
    ctx.lineTo(x + tw / 2 + 0.5, y);
    ctx.lineTo(x, y + tw / 4 + 0.5);
    ctx.lineTo(x - tw / 2 - 0.5, y);
    ctx.closePath();
    ctx.fillStyle = color ? color + (t.province === chosen ? '99' : '44') : TERRAIN_INFO[t.terrain].color;
    ctx.fill();
  }
  ctx.font = `600 ${Math.max(11, canvas.width / 60)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of provinces) {
    const { x, y } = pos(p.cx, p.cy);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(p.name, x, y - tw * 0.6);
    ctx.fillStyle = p.id === chosen ? '#9fd0ff' : p.zone === 'markaz' ? '#ffd970' : '#fff';
    ctx.fillText(p.name, x, y - tw * 0.6);
  }
}
