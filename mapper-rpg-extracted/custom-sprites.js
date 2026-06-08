// ============================================================
// CUSTOM SPRITES — modal de génération + intégration au picker
//
// Flow :
//   1. User clique "Créer un sprite" → modal avec input prompt
//   2. Bouton "Générer" → invoke('generate_custom_sprite') → reçoit temp_path + image_b64
//   3. Preview affichée, user peut :
//      - Régénérer (re-appelle generate, l'ancien temp est jeté)
//      - Jeter (cleanup temp, ferme modal)
//      - Ajouter → invoke('save_custom_sprite') → renomme temp en final + DB
//   4. Au save, on rafraîchit la liste des custom sprites dans le picker
//
// État local :
//   _csPending : { temp_image_path, prompt } — sprite en cours d'évaluation
//   customSpritesList : tableau des custom sprites en DB (cache local)
// ============================================================

let _csPending = null;
// Exposé sur window pour que sprites.js puisse le lire au render du picker
window.customSpritesList = [];

async function loadCustomSprites() {
  try {
    window.customSpritesList = await invoke('list_custom_sprites');
  } catch (e) {
    console.warn('list_custom_sprites failed', e);
    window.customSpritesList = [];
  }
}

function openCustomSpriteModal() {
  document.getElementById('cs-prompt').value = '';
  document.getElementById('cs-name').value = '';
  _showStep('prompt');
  document.getElementById('cs-error').classList.add('hidden');
  document.getElementById('custom-sprite-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('cs-prompt').focus(), 50);
}

function closeCustomSpriteModal() {
  // Si un sprite est en cours d'évaluation et non validé, le jeter
  if (_csPending) {
    invoke('discard_temp_sprite', { tempImagePath: _csPending.temp_image_path }).catch(() => {});
    _csPending = null;
  }
  document.getElementById('custom-sprite-modal').style.display = 'none';
}

function _showStep(name) {
  for (const s of ['prompt', 'loading', 'preview']) {
    document.getElementById('cs-step-' + s).style.display = (s === name) ? 'block' : 'none';
  }
}

function _showCSError(msg) {
  const el = document.getElementById('cs-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function runCustomSpriteGeneration() {
  const prompt = document.getElementById('cs-prompt').value.trim();
  if (!prompt) { _showCSError('Décris l\'objet à créer.'); return; }

  document.getElementById('cs-error').classList.add('hidden');
  _showStep('loading');
  genProgress.start({ barId: 'cs-progress-bar', msgId: 'cs-progress-msg', defaultMsg: 'Invocation en cours…' });

  try {
    const result = await invoke('generate_custom_sprite', { request: { prompt } });
    // Le backend retourne { temp_id, image_path, prompt }. On normalise
    // en interne en utilisant image_path comme temp_image_path.
    _csPending = {
      temp_image_path: result.image_path,
      prompt: result.prompt,
    };
    document.getElementById('cs-preview-img').src = convertFileSrc(result.image_path);
    document.getElementById('cs-preview-prompt').textContent = `« ${result.prompt} »`;
    genProgress.stop();
    _showStep('preview');
  } catch (err) {
    genProgress.stop();
    const s = String(err);
    if (s.startsWith('RATE_LIMIT:')) {
      let data = {};
      try { data = JSON.parse(s.slice('RATE_LIMIT:'.length)); } catch {}
      closeCustomSpriteModal();
      if (typeof showRateLimitModal === 'function') showRateLimitModal(data);
      return;
    }
    _showCSError('Erreur : ' + s);
    _showStep('prompt');
  }
}

async function retryCustomSprite() {
  // Jette le pending et regénère avec le même prompt
  if (_csPending) {
    invoke('discard_temp_sprite', { tempImagePath: _csPending.temp_image_path }).catch(() => {});
    _csPending = null;
  }
  await runCustomSpriteGeneration();
}

async function discardCustomSprite() {
  if (_csPending) {
    invoke('discard_temp_sprite', { tempImagePath: _csPending.temp_image_path }).catch(() => {});
    _csPending = null;
  }
  closeCustomSpriteModal();
}

async function saveCustomSprite() {
  if (!_csPending) return;
  const name = document.getElementById('cs-name').value.trim() || null;
  try {
    const entry = await invoke('save_custom_sprite', {
      request: {
        temp_image_path: _csPending.temp_image_path,
        prompt: _csPending.prompt,
        name,
      },
    });
    _csPending = null;
    // Recharge la liste et re-render le grid
    await loadCustomSprites();
    if (typeof renderSpriteGrid === 'function') renderSpriteGrid();
    closeCustomSpriteModal();
  } catch (err) {
    _showCSError('Erreur sauvegarde : ' + String(err));
  }
}

// Chargement initial des custom sprites au démarrage
window.addEventListener('DOMContentLoaded', () => {
  loadCustomSprites();
});
