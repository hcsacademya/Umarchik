import { visualTier } from '../config';
import { getAsset } from '../render/assets';
import type { UnitType, WorkerType } from '../types';

type Child = Node | string | number | null | undefined | false | Child[];
type Props = {
  class?: string;
  style?: string;
  title?: string;
  disabled?: boolean;
  html?: string;
  onclick?: (e: MouseEvent) => void;
  [k: string]: unknown;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v as string;
      else if (k === 'style') el.setAttribute('style', v as string);
      else if (k === 'html') el.innerHTML = v as string;
      else if (k === 'disabled') (el as HTMLButtonElement).disabled = !!v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function btn(label: Child, onclick: () => void, cls = '', disabled = false, title?: string): HTMLButtonElement {
  return h('button', { class: `btn ${cls}`, onclick: (e: MouseEvent) => (e.stopPropagation(), onclick()), disabled, title }, label);
}

const UNIT_EMOJI: Record<UnitType, string> = {
  piyoda: '🗡️',
  kamonchi: '🏹',
  nayzachi: '🔱',
  otliq: '🐎',
  zirhli_otliq: '🏇',
  zirhli_nayzachi: '🛡️',
  amir: '👑',
  qomondon: '🎖️',
  sarkarda_otliq: '⭐',
  sarkarda_nayzachi: '⭐',
  sarkarda_kamonchi: '⭐',
  sarkarda_piyoda: '⭐',
};

const WORKER_EMOJI: Record<WorkerType, string> = { dehqon: '👨‍🌾', chopon: '🐑', konchi: '⛏️' };

/** Portret: daraja bo'yicha ko'rinish bosqichi (1-3, 4-6, 7-9, 10). */
export function unitIcon(k: UnitType, level = 1, cls = ''): HTMLElement {
  const t = visualTier(level);
  const a = getAsset(`portrait_${k}_${t}`) ?? getAsset(`portrait_${k}`) ?? getAsset(`unit_${k}`);
  if (a) return h('span', { class: `portrait ${cls}` }, h('img', { src: a.img.src, alt: k }));
  return h('span', { class: `portrait ${cls}` }, UNIT_EMOJI[k]);
}

export function unitEmoji(k: UnitType): string {
  return UNIT_EMOJI[k];
}

export function workerIcon(w: WorkerType, level = 1): HTMLElement {
  const t = visualTier(level);
  const a = getAsset(`portrait_${w}_${t}`) ?? getAsset(`portrait_${w}`) ?? getAsset(`worker_${w}`);
  if (a) return h('span', { class: 'portrait' }, h('img', { src: a.img.src, alt: w }));
  return h('span', { class: 'portrait' }, WORKER_EMOJI[w]);
}

export function levelDots(level: number, max = 10): HTMLElement {
  const d = h('span', { class: 'lvl', title: `${level}/${max}` });
  for (let i = 1; i <= max; i++) d.appendChild(h('i', { class: i <= level ? 'on' : '' }));
  return d;
}
