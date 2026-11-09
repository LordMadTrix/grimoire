import { mount } from 'svelte'
import './theme.css'
import App from './App.svelte'
import PlayerView from './PlayerView.svelte'
import { getCurrentWindow } from '@tauri-apps/api/window'

window.addEventListener('error', (event) => {
  console.error('[Grimoire Error]', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Grimoire Unhandled Rejection]', event.reason);
});

const urlParams = new URLSearchParams(window.location.search)
let isPlayerView = urlParams.get('view') === 'player'

try {
  if (getCurrentWindow().label === 'player-view') {
    isPlayerView = true;
  }
} catch (e) {
  // Ignore si on n'est pas dans Tauri
}

let app: any = null;
try {
  app = mount(isPlayerView ? PlayerView : App, {
    target: document.getElementById('app')!,
  });
} catch (err: any) {
  console.error('[Grimoire Fatal Mount Error]', err);
  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.innerHTML = `
      <div style="background:#141419;color:#ff6b6b;padding:30px;font-family:sans-serif;height:100vh;box-sizing:border-box;">
        <h2 style="color:#e5a853;margin-top:0;">⚠️ Erreur de Démarrage Grimoire</h2>
        <p style="color:#aaa;">Une exception est survenue au démarrage :</p>
        <pre style="background:#1d1d26;padding:16px;border-radius:8px;overflow:auto;color:#fff;border:1px solid #333;">${err?.stack || err?.message || err}</pre>
        <button onclick="location.reload()" style="background:#e5a853;color:#000;border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-weight:bold;margin-top:15px;">🔄 Recharger</button>
      </div>
    `;
  }
}

export default app

