import './style.css';
import { GAME } from './config';
import { Battle } from './game/battle';
import { quickResolve } from './game/combat';
import { onSim, resolveBattle, tick } from './game/sim';
import { addLog, newGame, onLog } from './game/state';
import { loadAssets } from './render/assets';
import { BattleView } from './render/battleView';
import { MapView } from './render/mapView';
import { hasSave, loadGame, saveGame } from './save';
import type { Army, GameState, PendingBattle, Tile } from './types';
import { armyCount } from './util';
import { BattleUI } from './ui/battleUi';
import { h } from './ui/dom';
import { showStart } from './ui/start';
import { UI, type App } from './ui/ui';

type Scene = 'start' | 'map' | 'battle';

async function main(): Promise<void> {
  await loadAssets();
  const mapCanvas = document.getElementById('map') as HTMLCanvasElement;
  const battleCanvas = document.getElementById('battle') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui')!;
  const startLayer = h('div', { class: 'layer' });
  const mapLayer = h('div', { class: 'layer' });
  const battleLayer = h('div', { class: 'layer hidden' });
  uiRoot.append(mapLayer, battleLayer, startLayer);

  let state: GameState | null = null;
  let scene: Scene = 'start';
  let ui: UI | null = null;
  let battle: { b: Battle; pb: PendingBattle; bui: BattleUI } | null = null;

  const map = new MapView(mapCanvas, () => state!, { onTileTap: (t: Tile) => ui?.onTileTap(t) });
  const bview = new BattleView(battleCanvas);

  const save = () => {
    if (state) saveGame(state);
  };

  const setScene = (sc: Scene) => {
    scene = sc;
    startLayer.classList.toggle('hidden', sc !== 'start');
    mapLayer.classList.toggle('hidden', sc !== 'map');
    battleLayer.classList.toggle('hidden', sc !== 'battle');
    mapCanvas.classList.toggle('hidden', sc === 'battle');
    battleCanvas.classList.toggle('hidden', sc !== 'battle');
    map.visible = sc !== 'battle';
    requestAnimationFrame(() => {
      map.resize();
      bview.resize();
    });
  };

  const finishBattle = (pb: PendingBattle, out: { attWin: boolean; attLeft: Army; defLeft: Army; heroesLost: [import('./types').UnitType[], import('./types').UnitType[]] }) => {
    const s = state!;
    s.pending = s.pending.filter((x) => x !== pb);
    const playerAtt = pb.attacker === s.playerId;
    const text = resolveBattle(s, pb, out);
    const win = playerAtt ? out.attWin : !out.attWin;
    const before = playerAtt ? pb.attackUnits : pb.defendUnits;
    const after = playerAtt ? out.attLeft : out.defLeft;
    ui?.showBattleResult(win, text, before, after, () => {
      ui?.refresh();
      save();
    });
  };

  const app: App = {
    get state() {
      return state!;
    },
    map,
    startBattle(pb, tactical) {
      const s = state!;
      const att = s.factions[pb.attacker];
      const def = s.factions[pb.defender];
      const tile = s.tiles[pb.y * GAME.mapW + pb.x];
      if (!tactical) {
        const r = quickResolve(att, pb.attackUnits, def, pb.defendUnits, tile, Math.random);
        finishBattle(pb, {
          attWin: r.attWin,
          attLeft: r.attLeft,
          defLeft: r.defLeft,
          heroesLost: [r.heroesLost.filter((k) => (pb.attackUnits[k] ?? 0) > 0), r.heroesLost.filter((k) => (pb.defendUnits[k] ?? 0) > 0)],
        });
        return;
      }
      const playerSide = pb.attacker === s.playerId ? 0 : 1;
      const b = new Battle({
        attacker: att,
        defender: def,
        attArmy: pb.attackUnits,
        defArmy: pb.defendUnits,
        tile,
        playerSide,
        seed: Math.floor(Math.random() * 1e9),
      });
      const colors: [string, string] = [att.color, def.color];
      bview.start(b, colors, [att.unitLevels, def.unitLevels]);
      const bui = new BattleUI(battleLayer, b, colors, [att.name, def.name], (g) => {
        bview.selectedGroup = g;
        bui.setSelected(g);
      });
      bview.onSelect = (g) => bui.setSelected(g);
      battle = { b, pb, bui };
      setScene('battle');
    },
    newGame() {
      startNew();
    },
    save,
  };

  const beginGame = (s: GameState, firstTime: boolean) => {
    state = s;
    map.invalidateTerrain();
    ui = new UI(mapLayer, app);
    setScene('map');
    const core = s.factions[s.playerId];
    requestAnimationFrame(() => map.centerOn(core.coreX, core.coreY, 0.8));
    if (firstTime) ui.openModal('help');
    ui.refresh();
  };

  const startNew = () => {
    setScene('start');
    showStart(startLayer, hasSave(), () => {
      const s = loadGame();
      if (s) beginGame(s, false);
    }, (seed, prov) => {
      const s = newGame(seed, prov);
      beginGame(s, true);
      save();
    });
  };

  onSim((e) => {
    if (!ui || !state) return;
    if (e.type === 'alert') ui.showAlert(e.army, e.text);
    if (e.type === 'day') {
      if (Math.floor(state.day) % GAME.autosaveDays === 0) save();
      ui.refresh();
    }
  });
  onLog((text, kind) => {
    if (!ui || !state) return;
    if (kind === 'good' || kind === 'bad') ui.toast(text, kind);
  });

  window.addEventListener('resize', () => {
    map.resize();
    bview.resize();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });

  // ---------------- Asosiy sikl ----------------
  let last = performance.now();
  let hudTimer = 0;
  let sideSig = '';
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (scene === 'map' && state && ui) {
      if (!ui.pausedByModal) tick(state, dt);
      if (state.pending.length > 0 && !ui.modalOpen) ui.showPending(state.pending[0]);
      map.render(dt);
      hudTimer += dt;
      if (hudTimer > 0.25) {
        hudTimer = 0;
        ui.refreshHud();
        const t = ui.selected;
        if (t) {
          const p = state.factions[state.playerId];
          const sig = `${t.owner}|${t.building}|${t.level}|${t.workers}|${Math.floor(t.store / 2)}|${armyCount(t.garrison)}|${t.capture ? Math.ceil((t.capture.until - state.day) * 24) : -1}|${Math.floor(p.res.kumush / 5)}|${Math.floor(p.res.bronza / 5)}`;
          if (sig !== sideSig) {
            sideSig = sig;
            ui.refresh();
          }
        }
      }
    } else if (scene === 'battle' && battle) {
      const { b, pb, bui } = battle;
      if (!b.result) {
        let left = dt * bui.speed;
        while (left > 0) {
          const st = Math.min(1 / 30, left);
          b.step(st);
          left -= st;
          if (b.result) break;
        }
        bui.update();
      }
      const ins = bui.insets();
      bview.insetTop = ins.top;
      bview.insetBottom = ins.bottom;
      bview.render(dt);
      if (b.result) {
        const r = b.result;
        battle = null;
        battleLayer.innerHTML = '';
        setScene('map');
        if (r.timeout) addLog(state!, 'Jang vaqti tugadi — mudofaachi g\'olib.', 'info');
        finishBattle(pb, { attWin: r.winner === 0, attLeft: r.survivors[0], defLeft: r.survivors[1], heroesLost: r.heroesLost });
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  map.resize();
  bview.resize();
  startNew();
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__game = { get state() { return state; }, app, get battle() { return battle; } };
}

main();
