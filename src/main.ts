import './style.css';
import { preload } from './assets.ts';
import { showMenu } from './ui.ts';

const app = document.getElementById('app')!;
app.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#bca98a">Yuklanmoqda…</div>';
preload().then(showMenu);
