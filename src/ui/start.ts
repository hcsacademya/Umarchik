import { FACTION_COLORS, GAME, TERRAIN_INFO } from '../config';
import type { Province, Tile } from '../types';
import { generateMap } from '../world/mapgen';
import { btn, h } from './dom';

/** Boshlash ekrani: davom etish yoki yangi o'yin uchun viloyat tanlash. */
export function showStart(root: HTMLElement, canContinue: boolean, onContinue: () => void, onNew: (seed: number, province: number) => void): void {
  root.innerHTML = '';
  let seed = Math.floor(Math.random() * 1e9);
  let map = generateMap(seed);
  let chosen = 6 + Math.floor(Math.random() * 6);
  const wrap = h('div', { class: 'start' });
  const canvas = h('canvas', { class: 'minimap' }) as HTMLCanvasElement;
  const list = h('div', { class: 'prov-list' });

  const renderList = () => {
    list.innerHTML = '';
    for (const p of map.provinces.filter((p) => p.zone === 'chet')) {
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
    h('p', { class: 'lead' }, 'Kichik qarorgoh bilan boshlang, iqtisodni rivojlantiring, qo\'shin tuzing va markazdagi ikki imperiya hududi uchun kurashing. Boshlanish joyini — chet viloyatni tanlang:'),
    list,
    h(
      'div',
      { class: 'row', style: 'margin-top:10px' },
      canContinue ? btn('▶ Davom etish', onContinue, 'green') : null,
      btn('🎲 Boshqa xarita', () => {
        seed = Math.floor(Math.random() * 1e9);
        map = generateMap(seed);
        renderList();
        drawMini(canvas, map.tiles, map.provinces, chosen);
      }),
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
  const W = GAME.mapW;
  const H = GAME.mapH;
  const tw = Math.min((2 * canvas.width) / (W + H), (4 * canvas.height) / (W + H)) * 0.95;
  const th = tw / 2;
  const ox = canvas.width / 2;
  const oy = (canvas.height - (W + H) * th / 2) / 2;
  const pos = (x: number, y: number) => ({ x: ox + (x - y) * tw / 2, y: oy + (x + y) * th / 2 + th / 2 });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const t of tiles) {
    const { x, y } = pos(t.x, t.y);
    let color = TERRAIN_INFO[t.terrain].color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - th / 2 - 0.5);
    ctx.lineTo(x + tw / 2 + 0.5, y);
    ctx.lineTo(x, y + th / 2 + 0.5);
    ctx.lineTo(x - tw / 2 - 0.5, y);
    ctx.closePath();
    ctx.fill();
    color = t.province === 0 ? FACTION_COLORS.empireA : t.province === 1 ? FACTION_COLORS.empireB : t.province === chosen ? FACTION_COLORS.player : '';
    if (color) {
      ctx.fillStyle = color + (t.province === chosen ? '88' : '55');
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#f2cc4f';
  ctx.lineWidth = Math.max(1, tw / 10);
  ctx.setLineDash([tw / 6, tw / 4]);
  ctx.beginPath();
  for (const t of tiles) {
    const { x, y } = pos(t.x, t.y);
    const rr = tiles[t.y * W + t.x + 1];
    const d = t.y + 1 < H ? tiles[(t.y + 1) * W + t.x] : null;
    if (t.x + 1 < W && rr && rr.province !== t.province) {
      ctx.moveTo(x + tw / 2, y);
      ctx.lineTo(x, y + th / 2);
    }
    if (d && d.province !== t.province) {
      ctx.moveTo(x, y + th / 2);
      ctx.lineTo(x - tw / 2, y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `600 ${Math.max(10, tw * 0.9)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of provinces) {
    const { x, y } = pos(p.cx, p.cy);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(p.name, x, y);
    ctx.fillStyle = p.id === chosen ? '#9fd0ff' : p.zone === 'markaz' ? '#ffd970' : '#fff';
    ctx.fillText(p.name, x, y);
  }
}
