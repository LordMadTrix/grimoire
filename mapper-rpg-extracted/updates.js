// ============================================================
// UPDATES — vérification + installation via tauri-plugin-updater
//
// Flow :
//   1. Au boot, GET /api/version (notre endpoint custom) pour récupérer
//      la version cible + flag force_update (que le manifest Tauri ne porte pas).
//   2. Si latest > current : affiche la modal.
//      - force_update=true → bouton "Plus tard" caché, banner rouge,
//        impossible de fermer.
//      - sinon → comportement classique avec "Plus tard" (memorise).
//   3. Au clic "Installer" : tauri-plugin-updater.check() puis
//      downloadAndInstall() avec progress bar. À la fin, l'app redémarre
//      automatiquement (Tauri).
//   4. Fallback si plugin échoue (dev, signature manquante) → ouvre
//      download_url dans le navigateur.
// ============================================================

// Pas de "Plus tard" : toute nouvelle version est proposée à chaque boot.
// La modal reste affichée jusqu'à l'install (ou fermeture brutale de l'app).

let _updateInfo = null;     // { current, latest, notes, force_update, download_url }
let _installing = false;    // verrou anti double-clic

function _cmpVersion(a, b) {
  const pa = String(a || '0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

async function checkForUpdate() {
  try {
    // On utilise notre endpoint custom (pas check() Tauri direct) parce qu'on
    // a besoin du flag force_update.
    const info = await invoke('check_for_update');
    if (!info || !info.update_available) return;
    showUpdateModal(info);
  } catch (e) {
    console.debug('check_for_update failed:', e);
  }
}

function showUpdateModal(info) {
  _updateInfo = info;
  document.getElementById('update-current').textContent = info.current || '?';
  document.getElementById('update-latest').textContent = info.latest || '?';
  document.getElementById('update-notes').textContent = info.release_notes || '';

  // Banner rouge "obligatoire" uniquement si force_update — sinon ton classique
  const banner = document.getElementById('update-force-banner');
  if (info.force_update) banner.classList.remove('hidden');
  else banner.classList.add('hidden');

  document.getElementById('update-progress-wrap').classList.add('hidden');
  document.getElementById('update-download-btn').disabled = false;
  document.getElementById('update-download-btn').onclick = installUpdate;
  document.getElementById('update-modal').style.display = 'flex';
}

function _setProgress(pct, msg) {
  document.getElementById('update-progress-bar').style.width = pct + '%';
  document.getElementById('update-progress-pct').textContent = Math.round(pct) + '%';
  if (msg) document.getElementById('update-progress-msg').textContent = msg;
}

async function installUpdate() {
  if (_installing) return;
  _installing = true;

  const btn = document.getElementById('update-download-btn');
  btn.disabled = true;
  document.getElementById('update-progress-wrap').classList.remove('hidden');
  _setProgress(0, 'Préparation…');

  try {
    const updater = window.__TAURI__ && window.__TAURI__.updater;
    if (!updater || !updater.check) throw new Error('plugin updater indisponible');

    const update = await updater.check();
    if (!update) {
      // Pas d'update Tauri (signature manquante côté serveur) — fallback web
      throw new Error('manifest Tauri non disponible, fallback web');
    }

    let downloaded = 0;
    let total = 0;
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          total = event.data.contentLength || 0;
          _setProgress(0, total ? `Téléchargement (${(total / 1024 / 1024).toFixed(1)} Mo)…` : 'Téléchargement…');
          break;
        case 'Progress':
          downloaded += event.data.chunkLength || 0;
          if (total) _setProgress((downloaded / total) * 100, 'Téléchargement…');
          break;
        case 'Finished':
          _setProgress(100, 'Installation… L\'app va redémarrer.');
          break;
      }
    });
    // À ce stade Tauri a déclenché l'install (installMode: passive sur Windows)
    // et redémarrera l'app. Si on arrive ici sans relaunch, on l'oblige :
    if (window.__TAURI__.process && window.__TAURI__.process.relaunch) {
      await window.__TAURI__.process.relaunch();
    }
  } catch (err) {
    console.warn('plugin updater échec:', err);
    // Fallback : ouvre la page de téléchargement dans le navigateur.
    // La modal reste affichée (pas de "Plus tard") — l'user installe puis relance.
    if (_updateInfo && _updateInfo.download_url) {
      try { await invoke('open_external_url', { url: _updateInfo.download_url }); } catch {}
      _setProgress(0, 'Téléchargement ouvert dans le navigateur. Installe la nouvelle version puis relance l\'app.');
      document.getElementById('update-progress-wrap').classList.add('hidden');
      btn.disabled = false;
      btn.textContent = 'Réouvrir le téléchargement';
    } else {
      _setProgress(0, 'Erreur : ' + String(err).slice(0, 120));
      btn.disabled = false;
    }
  } finally {
    _installing = false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(checkForUpdate, 1500);
});
