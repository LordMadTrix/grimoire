const { invoke, convertFileSrc } = window.__TAURI__.core;

let selectedStyle = 'fantasy';
let selectedSize = 'medium';
let phraseInterval = null;
let historyMaps = {};
// currentMap et currentDoc sont maintenant des accesseurs sur window définis
// dans store.js. Lecture = appStore.state.doc / .mapMeta. Écriture passe par
// le store. Pas de let local pour éviter de masquer les accesseurs.
function isInpaintActive() { return window.appStore && appStore.state.activeTool === 'inpaint'; }
let isDrawing = false; // état éphémère de geste pinceau, ne va pas dans le store
// viewState vit dans appStore.state.view — accès via les helpers ci-dessous.
function getView() { return appStore.state.view; }
function setView(partial) {
  appStore.update(s => { s.view = { ...s.view, ...partial }; });
}
// pan state vit dans le ToolManager (tools.js)

const LOADING_PHRASES = [
  'Invocation des créatures…',
  'On refait la déco…',
  'Déménagement des meubles…',
  'Terrassement de la taverne…',
  'Polissage des stalactites…',
  'Lancement du sort de cartographie…',
  'Négociation avec le dragon…',
  'Aiguisage des pièges…',
  'Le gobelin range ses trésors…',
  'Plantation des champignons toxiques…',
  'Le squelette monte la garde…',
  'Réparation du pont-levis…',
  'Cirage des armures rouillées…',
  'Le mage relit son grimoire…',
  'Mise en place des torches…',
  'On nourrit le minotaure…',
  'Tracé des couloirs secrets…',
  'Réveil des morts-vivants…',
  'L\'aubergiste sort le vin elfique…',
  'Convocation du conseil des PNJ…',
  'Calibrage du d20 cosmique…',
  'Le DM relit ses notes…',
];

function startPhraseRotation() {
  const el = document.getElementById('loading-phrase');
  if (!el) return;
  const used = new Set();
  const pick = () => {
    if (used.size >= LOADING_PHRASES.length) used.clear();
    let p;
    do { p = LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]; }
    while (used.has(p));
    used.add(p);
    return p;
  };
  el.textContent = pick();
  el.parentElement.style.opacity = '1';
  phraseInterval = setInterval(() => {
    el.parentElement.style.opacity = '0';
    setTimeout(() => {
      el.textContent = pick();
      el.parentElement.style.opacity = '1';
    }, 500);
  }, 2800);
}

function stopPhraseRotation() {
  if (phraseInterval) { clearInterval(phraseInterval); phraseInterval = null; }
}

// --- Navigation ---
function showTab(tab) {
  ['editor', 'history'].forEach(t => {
    document.getElementById(`tab-${t}-content`).style.display = 'none';
    const btn = document.getElementById(`tab-${t}`);
    btn.className = 'tab-btn px-4 py-1.5 rounded-lg text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600';
  });
  const content = document.getElementById(`tab-${tab}-content`);
  content.style.display = 'flex';
  document.getElementById(`tab-${tab}`).className =
    'tab-btn px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white';

  // Actions de carte + palette d'outils : uniquement dans l'éditeur, quand une carte est affichée
  const resultVisible = document.getElementById('result').style.display === 'flex';
  document.getElementById('result-actions').style.display = (tab === 'editor' && resultVisible) ? 'flex' : 'none';
  // Palette d'outils : visible en permanence dans l'éditeur (même sans carte chargée)
  const palette = document.getElementById('tool-palette');
  if (palette) palette.style.display = (tab === 'editor') ? 'flex' : 'none';

  if (tab === 'history') loadHistory();
}

// --- Style / Size selectors ---
function selectStyle(btn) {
  document.querySelectorAll('.style-btn').forEach(b => {
    b.className = 'style-btn py-2 text-xs rounded-lg border border-gray-600 bg-gray-800 text-gray-300 hover:border-indigo-400';
  });
  btn.className = 'style-btn selected-style py-2 text-xs rounded-lg border border-indigo-500 bg-indigo-900/40 text-indigo-300';
  selectedStyle = btn.dataset.style;
}

function selectSize(btn) {
  document.querySelectorAll('.size-btn').forEach(b => {
    b.className = 'size-btn flex-1 py-2 text-xs rounded-lg border border-gray-600 bg-gray-800 text-gray-300 hover:border-indigo-400';
  });
  btn.className = 'size-btn selected-size flex-1 py-2 text-xs rounded-lg border border-indigo-500 bg-indigo-900/40 text-indigo-300';
  selectedSize = btn.dataset.size;
}

// --- Generate ---
async function generateMap() {
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) { showError('Décrivez la carte avant de générer.'); return; }

  const elements = [...document.querySelectorAll('.element-cb:checked')].map(cb => cb.value);
  const mapName = document.getElementById('map-name').value.trim() || null;

  setLoading(true);
  hideError();

  try {
    const result = await invoke('generate_map', {
      request: { prompt, style: selectedStyle, size: selectedSize, elements, map_name: mapName }
    });
    const mapMeta = {
      id: result.id,
      image_path: result.image_path,
      prompt,
      style: selectedStyle,
      size: selectedSize,
      elements,
      name: mapName,
    };
    const doc = {
      version: 1,
      id: result.id,
      name: mapName || `Carte ${result.id.slice(0,8)}`,
      base: { kind: 'ai', image_path: result.image_path, prompt, style: selectedStyle, size: selectedSize, elements },
      layers: [],
    };
    if (typeof resetUndoHistory === 'function') resetUndoHistory();
    // Important : changer img.src AVANT de notifier le store, sinon les renderers
    // tentent de rendre avec les dimensions de l'ancienne image.
    showResult(result.image_path);
    // Une seule mise à jour atomique du store → une seule volée de notifications.
    appStore.set({ doc, mapMeta, selectedSpriteIdx: -1 });
  } catch (err) {
    handleApiError(err);
  } finally {
    setLoading(false);
  }
}

function showResult(imagePath) {
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  const result = document.getElementById('result');
  result.style.display = 'flex';
  document.getElementById('result-actions').style.display = 'flex';
  const img = document.getElementById('result-img');
  img.src = convertFileSrc(imagePath);
  resetView();
}

function onResultImgClick() {
  if (!isInpaintActive()) openFullscreen(document.getElementById('result-img'));
}

// --- Zoom & Pan ---
// Pan/zoom est désormais géré par le ToolManager (voir tools.js).
// Ici on garde uniquement : applyViewTransform (renderer qui applique la transform CSS),
// et resetView (helper utilisé par showResult).
// L'état vit dans appStore.state.view.

function applyViewTransform() {
  const img = document.getElementById('result-img');
  const v = getView();
  img.style.transformOrigin = '0 0';
  img.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.scale})`;
}

function resetView() {
  setView({ scale: 1, tx: 0, ty: 0 });
}

document.addEventListener('DOMContentLoaded', () => {
  // Re-render automatique du transform CSS quand `view` change dans le store
  if (window.appStore) appStore.subscribeKey('view', applyViewTransform);
});

// --- Inpaint ---
function activateInpaintTool() {
  toolManager.activate('inpaint');
}

window.addEventListener('DOMContentLoaded', () => {
  toolManager.register('inpaint', {
    onActivate: enterInpaint,
    onDeactivate: exitInpaint,
  });
});

function enterInpaint() {
  if (!currentMap) { showError('Aucune carte à retoucher.'); return; }
  document.getElementById('result-actions').style.display = 'none';
  document.getElementById('inpaint-toolbar').style.display = 'flex';

  const img = document.getElementById('result-img');
  const canvas = document.getElementById('inpaint-canvas');
  canvas.classList.remove('hidden');
  // Le canvas inpaint doit être au-dessus de tout (sprites, layers inpaint) pour
  // intercepter les clics du brush, et les sprites ne doivent pas répondre.
  canvas.style.zIndex = '10';
  img.style.cursor = 'none';
  const spriteOverlay = document.getElementById('sprite-overlay');
  if (spriteOverlay) spriteOverlay.style.pointerEvents = 'none';

  positionInpaintCanvas();
  window.addEventListener('resize', positionInpaintCanvas);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  canvas.addEventListener('pointerdown', brushStart);
  canvas.addEventListener('pointermove', brushMove);
  canvas.addEventListener('pointerup', brushEnd);
  canvas.addEventListener('pointerleave', onBrushLeave);
  canvas.addEventListener('pointerenter', onBrushEnter);
}

function exitInpaint() {
  document.getElementById('result-actions').style.display = 'flex';
  document.getElementById('inpaint-toolbar').style.display = 'none';

  const canvas = document.getElementById('inpaint-canvas');
  canvas.classList.add('hidden');
  canvas.style.zIndex = '';
  document.getElementById('result-img').style.cursor = '';
  const spriteOverlay = document.getElementById('sprite-overlay');
  if (spriteOverlay) spriteOverlay.style.pointerEvents = 'auto';
  canvas.removeEventListener('pointerdown', brushStart);
  canvas.removeEventListener('pointermove', brushMove);
  canvas.removeEventListener('pointerup', brushEnd);
  canvas.removeEventListener('pointerleave', onBrushLeave);
  canvas.removeEventListener('pointerenter', onBrushEnter);
  document.getElementById('brush-cursor').style.display = 'none';
  window.removeEventListener('resize', positionInpaintCanvas);
}

function positionInpaintCanvas() {
  const img = document.getElementById('result-img');
  const canvas = document.getElementById('inpaint-canvas');
  if (!img.naturalWidth) return;

  const parent = canvas.parentElement;
  const imgRect = img.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();

  canvas.style.left = (imgRect.left - parentRect.left) + 'px';
  canvas.style.top = (imgRect.top - parentRect.top) + 'px';
  canvas.style.width = imgRect.width + 'px';
  canvas.style.height = imgRect.height + 'px';

  // Ne réinit que si la taille interne change (sinon ça vide le dessin)
  if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
    const prev = canvas.width ? document.createElement('canvas') : null;
    if (prev) {
      prev.width = canvas.width; prev.height = canvas.height;
      prev.getContext('2d').drawImage(canvas, 0, 0);
    }
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    if (prev) canvas.getContext('2d').drawImage(prev, 0, 0, canvas.width, canvas.height);
  }
}

function brushPos(e) {
  const canvas = document.getElementById('inpaint-canvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function brushStart(e) {
  if (e.button !== 0 || e.altKey) return; // clic milieu ou Alt = pan, pas pinceau
  isDrawing = true;
  const { x, y } = brushPos(e);
  drawBrush(x, y);
}

function brushMove(e) {
  updateBrushCursor(e);
  if (!isDrawing) return;
  const { x, y } = brushPos(e);
  drawBrush(x, y);
}

function brushEnd() { isDrawing = false; }

function onBrushEnter(e) {
  const cur = document.getElementById('brush-cursor');
  cur.style.display = 'block';
  updateBrushCursor(e);
}

function onBrushLeave() {
  isDrawing = false;
  document.getElementById('brush-cursor').style.display = 'none';
}

function updateBrushCursor(e) {
  const cur = document.getElementById('brush-cursor');
  const ring = document.getElementById('brush-ring');
  const size = parseInt(document.getElementById('brush-size').value, 10);
  ring.style.width = size + 'px';
  ring.style.height = size + 'px';
  cur.style.left = e.clientX + 'px';
  cur.style.top = e.clientY + 'px';
}

function drawBrush(x, y) {
  const canvas = document.getElementById('inpaint-canvas');
  const ctx = canvas.getContext('2d');
  const cssRect = canvas.getBoundingClientRect();
  const cssSize = parseInt(document.getElementById('brush-size').value, 10);
  const radius = cssSize * (canvas.width / cssRect.width) / 2;

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function clearMask() {
  const canvas = document.getElementById('inpaint-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function extractMaskB64() {
  const canvas = document.getElementById('inpaint-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const src = ctx.getImageData(0, 0, w, h).data;

  const mask = document.createElement('canvas');
  mask.width = w; mask.height = h;
  const mctx = mask.getContext('2d');
  const out = mctx.createImageData(w, h);
  let painted = 0;
  for (let i = 0; i < src.length; i += 4) {
    const ca = src[i + 3];
    // peinture pleine opacité (255) → mask alpha 0 = zone à éditer
    // pixels anti-aliasés au bord → gradient naturel
    out.data[i] = 255; out.data[i + 1] = 255; out.data[i + 2] = 255;
    out.data[i + 3] = 255 - ca;
    if (ca > 0) painted++;
  }
  mctx.putImageData(out, 0, 0);
  return { b64: mask.toDataURL('image/png').split(',')[1], painted };
}

async function runInpaint() {
  if (!currentMap) return;
  const promptEl = document.getElementById('inpaint-prompt');
  const userPrompt = promptEl.value.trim();
  if (!userPrompt) { showError('Décris ce que tu veux dans la zone.'); return; }

  const { b64, painted } = extractMaskB64();
  if (painted === 0) { showError('Peins une zone à régénérer.'); return; }

  hideError();
  const runBtn = document.getElementById('inpaint-run-btn');
  const inpaintToolbar = document.getElementById('inpaint-toolbar');
  const canvas = document.getElementById('inpaint-canvas');
  const lock = document.getElementById('inpaint-lock');
  const anim = document.getElementById('inpaint-anim');

  // Position de l'animation : centroïde du mask en pixels overlay
  const centroidCanvas = computeMaskCentroid();
  if (centroidCanvas && anim) {
    const overlayRect = canvas.getBoundingClientRect();
    const parentRect = anim.parentElement.getBoundingClientRect();
    // Convertit centroïde (en pixels internes canvas) → coords overlay → coords parent
    const scaleX = overlayRect.width / canvas.width;
    const scaleY = overlayRect.height / canvas.height;
    const screenX = overlayRect.left + centroidCanvas.x * scaleX;
    const screenY = overlayRect.top  + centroidCanvas.y * scaleY;
    anim.style.left = (screenX - parentRect.left) + 'px';
    anim.style.top  = (screenY - parentRect.top)  + 'px';
  }

  // Lock UI : overlay full-screen invisible qui catch tous les clics
  // + grayout + désactivation des boutons
  document.body.classList.add('inpaint-generating');
  canvas.classList.add('generating');
  lock.style.display = 'block';
  anim.style.display = 'block';
  inpaintToolbar.querySelectorAll('button, input').forEach(el => el.disabled = true);
  runBtn.textContent = 'Génération…';
  // Progress bar dans la toolbar inpaint
  document.getElementById('inpaint-progress-wrap').style.display = 'block';
  genProgress.start({ barId: 'inpaint-progress-bar', msgId: 'inpaint-progress-msg', defaultMsg: 'Régénération en cours…' });

  try {
    const layer = await invoke('inpaint_map', {
      request: {
        source_image_path: currentMap.image_path,
        mask_b64: b64,
        prompt: userPrompt,
        style: currentMap.style,
        size: currentMap.size,
        elements: currentMap.elements || [],
        name: null,
        context: currentMap.prompt || null,
      }
    });

    // S'assure qu'un doc existe (cas exceptionnel d'une carte préDoc-model)
    if (!currentDoc) {
      appStore.set({ doc: domain.createDoc({
        id: currentMap.id,
        name: currentMap.name,
        base: { kind: 'ai', image_path: currentMap.image_path, prompt: currentMap.prompt, style: currentMap.style, size: currentMap.size, elements: currentMap.elements || [] },
      }) });
    }
    // Dispatch via Command typée (apply persiste déjà via ctx.persist)
    window.__undo.dispatch(new commands.AddInpaintLayerCommand({
      id: layer.layer_id,
      image_path: layer.image_path,
      prompt: layer.prompt,
    }));

    exitInpaint();
    promptEl.value = '';
    // Pas besoin de re-afficher la carte : elle n'a jamais été cachée.
  } catch (err) {
    handleApiError(err);
  } finally {
    document.body.classList.remove('inpaint-generating');
    canvas.classList.remove('generating');
    lock.style.display = 'none';
    anim.style.display = 'none';
    inpaintToolbar.querySelectorAll('button, input').forEach(el => el.disabled = false);
    runBtn.textContent = '✨ Régénérer';
    genProgress.stop();
    setTimeout(() => {
      document.getElementById('inpaint-progress-wrap').style.display = 'none';
    }, 500);
  }
}

// Calcule le centroïde approximatif des pixels peints sur le canvas inpaint
// (positions en pixels internes du canvas). Step de 8px pour la perf.
function computeMaskCentroid() {
  const canvas = document.getElementById('inpaint-canvas');
  if (!canvas || !canvas.width) return null;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let sumX = 0, sumY = 0, count = 0;
  const step = 8;
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const i = (y * canvas.width + x) * 4;
      if (data[i + 3] > 0) { sumX += x; sumY += y; count++; }
    }
  }
  return count > 0 ? { x: sumX / count, y: sumY / count } : { x: canvas.width / 2, y: canvas.height / 2 };
}

function setLoading(on) {
  const btn = document.getElementById('generate-btn');
  btn.disabled = on;
  document.getElementById('generate-label').textContent = on ? 'Génération…' : 'Générer la carte';
  document.getElementById('generate-icon').textContent = on ? '' : '✨';
  document.getElementById('loading').style.display = on ? 'flex' : 'none';
  if (on) {
    document.getElementById('placeholder').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    startPhraseRotation();
    // Progress bar synchronisée avec les phrases rotatives
    genProgress.start({ barId: 'gen-progress-bar', msgId: 'gen-progress-msg', defaultMsg: 'Préparation…' });
  } else {
    stopPhraseRotation();
    genProgress.stop();
    // Ne pas re-afficher le placeholder si un résultat est visible
    const resultVisible = document.getElementById('result').style.display === 'flex';
    if (!resultVisible) {
      document.getElementById('placeholder').style.display = '';
    }
  }
}

function handleApiError(err) {
  const s = String(err);
  if (s.startsWith('RATE_LIMIT:')) {
    let data = {};
    try { data = JSON.parse(s.slice('RATE_LIMIT:'.length)); } catch {}
    showRateLimitModal(data);
    return;
  }
  showError(s);
}

function showRateLimitModal(data) {
  const el = document.getElementById('rate-reset-time');
  if (data && data.reset_at) {
    const d = new Date(data.reset_at);
    el.textContent = d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } else {
    el.textContent = 'dans 24 heures';
  }
  const limit = (data && data.limit) || 15;
  document.getElementById('rate-limit-count').textContent = `${limit} générations`;
  const modal = document.getElementById('rate-limit-modal');
  modal.style.display = 'flex';
}

function closeRateLimitModal() {
  document.getElementById('rate-limit-modal').style.display = 'none';
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError() { document.getElementById('error-msg').classList.add('hidden'); }

async function openFolder() {
  await invoke('open_maps_folder');
}

function openFullscreen(img) {
  const w = window.open('', '_blank');
  w.document.write(`<img src="${img.src}" style="max-width:100%;background:#000">`);
}

// --- History ---
function formatRelativeDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `il y a ${diffD} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: diffD > 365 ? 'numeric' : undefined });
}

function countLayers(docJson) {
  if (!docJson) return 0;
  try {
    const doc = JSON.parse(docJson);
    return (doc.layers || []).length;
  } catch { return 0; }
}

const STYLE_META = {
  fantasy:  { icon: '🐉', label: 'Fantasy' },
  medieval: { icon: '🏰', label: 'Médiéval' },
  modern:   { icon: '🏙', label: 'Moderne' },
  scifi:    { icon: '🚀', label: 'Sci-Fi' },
  horror:   { icon: '💀', label: 'Horror' },
  nature:   { icon: '🌳', label: 'Nature' },
};
function styleMeta(s) { return STYLE_META[s] || { icon: '🗺', label: s || '?' }; }

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function loadHistory() {
  const grid = document.getElementById('history-grid');
  const empty = document.getElementById('history-empty');
  grid.innerHTML = '<p class="text-gray-500 text-sm col-span-full">Chargement…</p>';

  try {
    const maps = await invoke('list_maps');
    grid.innerHTML = '';
    if (maps.length === 0) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    historyMaps = {};
    maps.forEach(m => {
      const e = m.entry || m;
      const id = e.id;
      const imgPath = e.image_path;
      let elements = [];
      try { elements = JSON.parse(e.elements || '[]'); } catch {}
      historyMaps[id] = {
        name: e.name, prompt: e.prompt, style: e.style, size: e.size, elements,
        image_path: imgPath, exists: m.exists, document: e.document,
      };

      const meta = styleMeta(e.style);
      const layers = countLayers(e.document);
      const date = formatRelativeDate(e.created_at);
      const name = escapeHtml(e.name);
      const prompt = escapeHtml(e.prompt);
      const exists = m.exists;

      const card = document.createElement('div');
      card.className = 'group bg-gray-900 border border-gray-700 rounded-xl overflow-hidden flex flex-col hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-900/20 transition-all';
      card.innerHTML = `
        <!-- Image hero avec hover overlay -->
        <div class="relative bg-gray-800" style="aspect-ratio: 4/3;">
          ${exists
            ? `<img src="${convertFileSrc(imgPath)}" alt="${name}" data-fs="${id}"
                 class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]">
               <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                 <button onclick="openFullscreen(document.querySelector('img[data-fs=\\'${id}\\']'))"
                   class="px-3 py-1.5 bg-white/90 text-gray-900 text-xs font-medium rounded-lg backdrop-blur transition hover:bg-white pointer-events-auto">🔍 Plein écran</button>
               </div>`
            : `<div class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                 <span>📷 Image manquante</span>
               </div>`
          }
          ${layers > 0 ? `<span class="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur text-white text-[10px] rounded-full font-medium">${layers} ${layers > 1 ? 'calques' : 'calque'}</span>` : ''}
        </div>

        <!-- Body -->
        <div class="p-3 flex-1 flex flex-col gap-2">
          <h3 class="text-sm font-semibold text-white truncate" title="${name}">${name}</h3>
          <p class="text-xs text-gray-400 leading-snug" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;" title="${prompt}">${prompt}</p>
          <div class="flex items-center justify-between text-[11px] text-gray-500 pt-1">
            <span class="flex items-center gap-1">${meta.icon} ${meta.label}</span>
            <span>${date}</span>
          </div>
        </div>

        <!-- Footer actions -->
        <div class="flex border-t border-gray-700/50">
          <button onclick="loadMap('${id}')" ${!exists ? 'disabled' : ''}
            class="flex-1 py-2.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600/20 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 border-r border-gray-700/50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Ouvrir
          </button>
          <button onclick="reuseMap('${id}')" title="Reprendre les paramètres de génération"
            class="px-3 py-2.5 text-xs text-gray-400 hover:bg-gray-700/50 hover:text-white transition flex items-center justify-center border-r border-gray-700/50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/>
            </svg>
          </button>
          <button onclick="deleteMap('${id}', this)" title="Supprimer"
            class="px-3 py-2.5 text-xs text-gray-500 hover:bg-red-600/20 hover:text-red-300 transition flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p class="text-red-400 text-sm col-span-full">Erreur : ${err}</p>`;
  }
}

function loadMap(id) {
  const m = historyMaps[id];
  if (!m) return;
  if (!m.exists) { showError('Fichier image introuvable sur le disque.'); showTab('editor'); return; }

  const mapMeta = {
    id,
    image_path: m.image_path,
    prompt: m.prompt,
    style: m.style,
    size: m.size,
    elements: m.elements || [],
    name: m.name,
  };

  // Reconstituer le document (depuis le JSON stocké ou fallback base seule)
  let doc = null;
  if (m.document) {
    try { doc = JSON.parse(m.document); } catch {}
  }
  if (!doc) {
    doc = {
      version: 1, id, name: m.name,
      base: { kind: 'ai', image_path: m.image_path, prompt: m.prompt, style: m.style, size: m.size, elements: m.elements || [] },
      layers: [],
    };
  }
  // Restaurer aussi les paramètres dans le panneau de gauche, pratique si on régénère ensuite
  document.getElementById('prompt').value = m.prompt;
  document.getElementById('map-name').value = m.name || '';
  const styleBtn = document.querySelector(`.style-btn[data-style="${m.style}"]`);
  if (styleBtn) selectStyle(styleBtn);
  const sizeBtn = document.querySelector(`.size-btn[data-size="${m.size}"]`);
  if (sizeBtn) selectSize(sizeBtn);
  document.querySelectorAll('.element-cb').forEach(cb => {
    cb.checked = (m.elements || []).includes(cb.value);
  });

  showTab('editor');
  hideError();
  if (typeof resetUndoHistory === 'function') resetUndoHistory();
  // src AVANT le notify (cf. generateMap)
  showResult(m.image_path);
  appStore.set({ doc, mapMeta, selectedSpriteIdx: -1 });
}

function reuseMap(id) {
  const m = historyMaps[id];
  if (!m) return;

  document.getElementById('prompt').value = m.prompt;
  document.getElementById('map-name').value = m.name || '';

  const styleBtn = document.querySelector(`.style-btn[data-style="${m.style}"]`);
  if (styleBtn) selectStyle(styleBtn);

  const sizeBtn = document.querySelector(`.size-btn[data-size="${m.size}"]`);
  if (sizeBtn) selectSize(sizeBtn);

  document.querySelectorAll('.element-cb').forEach(cb => {
    cb.checked = m.elements.includes(cb.value);
  });

  showTab('editor');
}

async function deleteMap(id, btn) {
  if (!confirm('Supprimer cette carte ?')) return;
  try {
    await invoke('delete_map', { id });
    btn.closest('div.bg-gray-900').remove();
  } catch (err) {
    alert('Erreur : ' + err);
  }
}
