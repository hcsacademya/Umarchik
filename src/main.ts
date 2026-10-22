import './style.css';
import { preload } from './assets.ts';
import { loadSave, newSave } from './campaign.ts';
import { initTelegram } from './telegram.ts';
import { showHome } from './ui/home.ts';
import { state } from './ui/state.ts';

initTelegram();
const app = document.getElementById('app')!;
app.innerHTML = '<div class="loading">Yuklanmoqda…</div>';
Promise.all([preload(), loadSave()]).then(([, save]) => {
  state.save = save ?? newSave();
  showHome('oyin');
});
