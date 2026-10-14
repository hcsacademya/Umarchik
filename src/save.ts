import { SAVE_VERSION } from './game/state';
import type { GameState } from './types';

const KEY = 'tarixiy-strategiya-save';

export function saveGame(s: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION || !Array.isArray(s.tiles)) return null;
    s.pending = s.pending ?? [];
    return s;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}
