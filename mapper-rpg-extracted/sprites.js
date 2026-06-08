// ============================================================
// SPRITES : picker + placement + flatten
// ============================================================

const SPRITE_HOST = 'https://www.maper-rpg.com';
const UNIV_LABELS = { 1: 'Médiéval', 2: 'Sci-Fi', 3: 'Moderne', 5: 'Nature' };

let spritesData = null;
let univFilter = null;
// Le "mode sprite" est désormais dérivé de toolManager / appStore.state.activeTool
function isSpriteActive() { return window.appStore && appStore.state.activeTool === 'sprite'; }
let placedSprites = [];
let selectedSpriteIdx = -1;
let spriteDragState = null;
let nextSpriteUid = 1;

// Source unique pour la sélection : met à jour le local ET le store en même temps.
function setSelected(idx) {
  selectedSpriteIdx = idx;
  if (window.appStore) appStore.set({ selectedSpriteIdx: idx });
}

async function ensureSpritesLoaded() {
  if (spritesData) return;
  try {
    spritesData = await invoke('fetch_sprites');
    buildUniversFilter();
    renderSpriteGrid();
  } catch (err) {
    document.getElementById('sprite-grid').innerHTML =
      `<p class="text-red-400 text-xs col-span-full">Erreur chargement : ${err}</p>`;
  }
}

function buildUniversFilter() {
  const el = document.getElementById('sprite-univers-filter');
  let html = `<button onclick="setUnivFilter(null)" data-univ="all" class="univ-btn px-2 py-0.5 text-xs rounded bg-amber-700 text-white">Tous</button>`;
  for (const u of spritesData.universes) {
    const lbl = UNIV_LABELS[u.id] || u.name;
    html += `<button onclick="setUnivFilter(${u.id})" data-univ="${u.id}" class="univ-btn px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600">${lbl}</button>`;
  }
  el.innerHTML = html;
}

function setUnivFilter(id) {
  univFilter = id;
  document.querySelectorAll('.univ-btn').forEach(b => {
    const v = b.dataset.univ;
    const active = (id === null && v === 'all') || String(id) === v;
    b.className = `univ-btn px-2 py-0.5 text-xs rounded ${active ? 'bg-amber-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`;
  });
  renderSpriteGrid();
}

function renderSpriteGrid() {
  if (!spritesData) return;
  const grid = document.getElementById('sprite-grid');
  const q = (document.getElementById('sprite-search').value || '').toLowerCase().trim();

  // Filtre custom sprites (toujours visibles quel que soit l'univers)
  const customs = (window.customSpritesList || []).filter(s => {
    if (!q) return true;
    return (s.name || '').toLowerCase().includes(q) || (s.prompt || '').toLowerCase().includes(q);
  });

  // Filtre sprites library
  const filtered = spritesData.sprites.filter(s => {
    if (univFilter !== null && !s.universes.includes(univFilter)) return false;
    if (!q) return true;
    return (s.name || '').toLowerCase().includes(q);
  });

  if (filtered.length === 0 && customs.length === 0) {
    grid.innerHTML = `<p class="text-gray-500 text-xs col-span-full text-center mt-4">Aucun sprite trouvé.</p>`;
    return;
  }
  grid.innerHTML = '';
  if (window._spriteObserver) window._spriteObserver.disconnect();

  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const img = e.target;
      const id = parseInt(img.dataset.spriteId, 10);
      observer.unobserve(img);
      if (!id || img.src) continue;
      assets.applyToImg(img, id, 'preview', () => {
        const btn = img.parentElement;
        if (btn) btn.innerHTML = `<span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:9px; color:#fca5a5; text-align:center;">#${id}<br>fail</span>`;
      });
    }
  }, { root: grid, rootMargin: '300px' });
  window._spriteObserver = observer;

  const frag = document.createDocumentFragment();

  // Section "Mes sprites" (custom) en premier
  if (customs.length > 0) {
    const header = document.createElement('div');
    header.className = 'col-span-full text-xs text-amber-400 font-semibold pt-1 pb-0.5';
    header.textContent = `Mes sprites (${customs.length})`;
    frag.appendChild(header);
    for (const s of customs) {
      const btn = document.createElement('button');
      btn.className = 'bg-gray-800 hover:bg-gray-700 rounded overflow-hidden border border-amber-700/50 hover:border-amber-500 transition';
      btn.style.cssText = 'position:relative; width:100%; padding:0; padding-bottom:100%; height:0;';
      btn.title = `${s.name}\n« ${s.prompt} »`;
      btn.onclick = () => placeCustomSprite(s);
      const img = document.createElement('img');
      img.src = convertFileSrc(s.image_path);
      img.alt = s.name;
      img.draggable = false;
      img.style.cssText = 'position:absolute; inset:0; margin:auto; max-width:90%; max-height:90%; object-fit:contain;';
      btn.appendChild(img);
      // Bouton supprimer (visible au hover) — implémenté via clic droit pour simplicité
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        if (confirm(`Supprimer le sprite « ${s.name} » ?`)) {
          invoke('delete_custom_sprite', { id: s.id }).then(() => {
            loadCustomSprites().then(renderSpriteGrid);
          });
        }
      };
      frag.appendChild(btn);
    }
    if (filtered.length > 0) {
      const sep = document.createElement('div');
      sep.className = 'col-span-full text-xs text-gray-500 font-semibold pt-2 pb-0.5 border-t border-gray-700';
      sep.textContent = `Bibliothèque (${filtered.length})`;
      frag.appendChild(sep);
    }
  }

  for (const s of filtered.slice(0, 400)) {
    const btn = document.createElement('button');
    btn.className = 'bg-gray-800 hover:bg-gray-700 rounded overflow-hidden border border-gray-700 hover:border-amber-500 transition';
    btn.style.cssText = 'position:relative; width:100%; padding:0; padding-bottom:100%; height:0;';
    btn.title = `${s.name} (#${s.id})`;
    btn.onclick = () => placeSpriteById(s.id);

    const img = document.createElement('img');
    img.dataset.spriteId = String(s.id);
    img.alt = s.name;
    img.draggable = false;
    img.style.cssText = 'position:absolute; inset:0; margin:auto; max-width:90%; max-height:90%; object-fit:contain;';

    btn.appendChild(img);
    frag.appendChild(btn);
  }
  grid.appendChild(frag);
  grid.querySelectorAll('img[data-sprite-id]').forEach(img => observer.observe(img));
}

function toggleSpritePicker() {
  // Délègue au ToolManager (rappelle enterSpriteMode/exitSpriteMode via hooks)
  toolManager.activate('sprite');
}

// Enregistrement du tool sprite au démarrage
window.addEventListener('DOMContentLoaded', () => {
  toolManager.register('sprite', {
    onActivate: enterSpriteMode,
    onDeactivate: exitSpriteMode,
  });
});

function enterSpriteMode() {
  if (!currentMap) { showError('Aucune carte à décorer.'); return; }
  document.getElementById('sprite-picker').style.display = 'flex';
  document.getElementById('sprite-toolbar').style.display = 'flex';
  document.getElementById('result-actions').style.display = 'none';

  const overlay = document.getElementById('sprite-overlay');
  overlay.classList.remove('hidden');
  positionSpriteOverlay();

  ensureSpritesLoaded();
}

// Handler clavier permanent (skip si on tape dans un input)
window.addEventListener('keydown', (e) => {
  if (selectedSpriteIdx < 0) return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  spriteKeyHandler(e);
});
window.addEventListener('resize', () => {
  if (placedSprites.length > 0) positionSpriteOverlay();
});

// Quand on affiche une carte, on rend visible tous les calques du document
function showLayersForCurrentDoc() {
  // Préserve l'index de sélection à travers le rebuild
  const previousSelection = selectedSpriteIdx;

  // Nettoie sprites
  const overlay = document.getElementById('sprite-overlay');
  for (const sp of placedSprites) { if (sp.el) sp.el.remove(); }
  placedSprites = [];

  // Nettoie inpaint overlays
  document.querySelectorAll('img.inpaint-layer').forEach(el => el.remove());

  if (!currentDoc) {
    setSelected(-1);
    return;
  }

  // Layer inpaint (dans l'ordre du tableau, du plus ancien au plus récent)
  for (const l of (currentDoc.layers || [])) {
    if (l.type !== 'inpaint' || !l.visible) continue;
    renderInpaintLayer(l);
  }

  // Layer sprites (toujours au-dessus des inpaint)
  const spriteLayer = (currentDoc.layers || []).find(l => l.type === 'sprites');
  if (spriteLayer && spriteLayer.visible) {
    overlay.classList.remove('hidden');
    positionSpriteOverlay();
    for (const s of (spriteLayer.sprites || [])) {
      const sprite = {
        uid: nextSpriteUid++,
        sprite_id: s.sprite_id,
        custom_id: s.custom_id,
        custom_path: s.custom_path,
        x: s.x, y: s.y, w: s.w, angle: s.angle,
        el: null, imgEl: null,
      };
      placedSprites.push(sprite);
      createSpriteElement(sprite);
    }
  }

  // Restaure la sélection si encore valide (l'ordre est conservé pendant un rebuild)
  if (previousSelection >= 0 && previousSelection < placedSprites.length) {
    setSelected(previousSelection);
    renderSelection();
  } else {
    setSelected(-1);
  }
}

function renderInpaintLayer(layer) {
  const resultDiv = document.getElementById('result');
  const baseImg = document.getElementById('result-img');
  if (!resultDiv || !baseImg) return;

  const img = document.createElement('img');
  img.className = 'inpaint-layer';
  img.dataset.layerId = layer.id;
  // max-width:none ; max-height:none : Tailwind preflight applique max-width:100%
  // par défaut à tous les <img>, ce qui empêche l'inpaint de grandir au zoom.
  img.style.cssText = 'position:absolute; pointer-events:none; z-index:2; max-width:none; max-height:none;';
  // convertFileSrc transforme un chemin local en URL asset://
  img.src = convertFileSrc(layer.image_path);
  // Insérer juste après l'image base (au-dessus dans le z-order grâce au z-index, mais dans le DOM aussi)
  baseImg.parentElement.insertBefore(img, baseImg.nextSibling);
  positionInpaintLayer(img);
}

function positionInpaintLayer(img) {
  const r = computeImgVisualRect();
  if (!r) return;
  img.style.left = r.left + 'px';
  img.style.top = r.top + 'px';
  img.style.width = r.width + 'px';
  img.style.height = r.height + 'px';
}

function positionAllInpaintLayers() {
  document.querySelectorAll('img.inpaint-layer').forEach(positionInpaintLayer);
}

function exitSpriteMode() {
  document.getElementById('sprite-picker').style.display = 'none';
  document.getElementById('sprite-toolbar').style.display = 'none';
  document.getElementById('result-actions').style.display = 'flex';
  // Les sprites restent toujours interactifs (sélection, drag, etc.)
  // On ne touche ni à l'overlay ni aux pointer-events
}

// Calcule le rect visuel de l'image base à partir de l'état view du store +
// du layout DOM (offsetLeft/Top/Width/Height = avant transform). Cela évite
// de dépendre de getBoundingClientRect qui peut avoir des subtilités de timing
// quand le transform vient d'être appliqué.
function computeImgVisualRect() {
  const img = document.getElementById('result-img');
  if (!img || !img.naturalWidth) return null;
  const v = window.appStore ? appStore.state.view : { scale: 1, tx: 0, ty: 0 };
  // offsetWidth/Height = taille AVANT transform (layout-level)
  // offsetLeft/Top    = position dans offsetParent AVANT transform
  // Avec transform-origin: 0 0, le post-transform rect est :
  //   left = offsetLeft + tx, top = offsetTop + ty
  //   width = offsetWidth * scale, height = offsetHeight * scale
  return {
    left: img.offsetLeft + v.tx,
    top: img.offsetTop + v.ty,
    width: img.offsetWidth * v.scale,
    height: img.offsetHeight * v.scale,
  };
}

function positionSpriteOverlay() {
  const r = computeImgVisualRect();
  if (!r) return;
  const overlay = document.getElementById('sprite-overlay');
  overlay.style.left = r.left + 'px';
  overlay.style.top = r.top + 'px';
  overlay.style.width = r.width + 'px';
  overlay.style.height = r.height + 'px';
  renderAllSprites();
}

function placeSpriteById(id) {
  // Note : on autorise le placement même si le tool sprite n'est pas le tool actif,
  // car le clic sur un bouton du picker est une intention claire de l'utilisateur.
  if (!currentMap) return;
  const img = document.getElementById('result-img');
  const nw = img.naturalWidth || 1024;
  const nh = img.naturalHeight || 1024;
  const baseSize = Math.min(nw, nh) * 0.12;
  // Dispatch via Command pattern (apply: ajoute au doc → renderers s'auto-refreshent)
  window.__undo.dispatch(new commands.PlaceSpriteCommand({
    sprite_id: id,
    x: nw / 2, y: nh / 2, w: baseSize, angle: 0,
  }));
  setSelected(placedSprites.length - 1);
  renderSelection();
}

// Pose un sprite CUSTOM (image stockée localement). On utilise un id négatif
// pour ne pas collider avec les IDs library, et on stocke le custom_path dans
// le sprite pour que le rendu sache où charger l'image.
function placeCustomSprite(customSprite) {
  if (!currentMap) return;
  const img = document.getElementById('result-img');
  const nw = img.naturalWidth || 1024;
  const nh = img.naturalHeight || 1024;
  const baseSize = Math.min(nw, nh) * 0.12;
  window.__undo.dispatch(new commands.PlaceSpriteCommand({
    sprite_id: -1,           // marqueur : c'est un custom
    custom_id: customSprite.id,
    custom_path: customSprite.image_path,
    x: nw / 2, y: nh / 2, w: baseSize, angle: 0,
  }));
  setSelected(placedSprites.length - 1);
  renderSelection();
}

function createSpriteElement(sp) {
  const overlay = document.getElementById('sprite-overlay');
  const wrap = document.createElement('div');
  wrap.style.position = 'absolute';
  wrap.style.userSelect = 'none';
  wrap.style.cursor = 'move';
  wrap.style.transformOrigin = 'center center';
  wrap.dataset.uid = sp.uid;

  const img = document.createElement('img');
  if (sp.custom_path) {
    // Sprite custom : image locale, on bypass le cache serveur
    img.src = convertFileSrc(sp.custom_path);
  } else {
    // Sprite library : passe par le cache central (assets.js)
    assets.applyToImg(img, sp.sprite_id, 'full');
  }
  img.style.display = 'block';
  img.style.width = '100%';
  img.style.height = 'auto';
  img.style.pointerEvents = 'none';
  img.draggable = false;

  wrap.appendChild(img);
  wrap.addEventListener('pointerdown', (e) => onSpritePointerDown(e, sp));
  wrap.addEventListener('wheel', (e) => onSpriteWheel(e, sp), { passive: false });

  overlay.appendChild(wrap);
  sp.el = wrap;
  sp.imgEl = img;
  renderSprite(sp);
}

function renderSprite(sp) {
  const img = document.getElementById('result-img');
  if (!img || !img.naturalWidth) return;
  // scale natural → display = (img.offsetWidth * view.scale) / naturalWidth
  // mais pour le sprite dans l'overlay (qui a la même largeur que img post-transform),
  // c'est plus simple : scale = overlay_width / natural_width.
  // L'overlay vient d'être set à img.offsetWidth * view.scale (cf. positionSpriteOverlay).
  const v = window.appStore ? appStore.state.view : { scale: 1 };
  const overlayWidth = img.offsetWidth * v.scale;
  const scale = overlayWidth / img.naturalWidth;
  const wPx = sp.w * scale;
  const xPx = sp.x * scale;
  const yPx = sp.y * scale;
  sp.el.style.left = (xPx - wPx / 2) + 'px';
  sp.el.style.top = (yPx - wPx / 2) + 'px';
  sp.el.style.width = wPx + 'px';
  sp.el.style.transform = `rotate(${sp.angle}deg)`;
}

function renderAllSprites() {
  for (const sp of placedSprites) {
    if (sp.el) renderSprite(sp);
  }
}

function renderSelection() {
  for (const sp of placedSprites) {
    if (!sp.el) continue;
    sp.el.style.outline = (placedSprites.indexOf(sp) === selectedSpriteIdx)
      ? '2px solid #f59e0b' : 'none';
    sp.el.style.outlineOffset = '2px';
  }
}

function onSpritePointerDown(e, sp) {
  if (e.button !== 0) return;
  e.stopPropagation();
  if (typeof pushHistory === 'function') pushHistory();
  setSelected(placedSprites.indexOf(sp));
  renderSelection();

  const img = document.getElementById('result-img');
  const v = window.appStore ? appStore.state.view : { scale: 1 };
  // scale natural → écran = (img.offsetWidth * view.scale) / naturalWidth
  const scale = (img.offsetWidth * v.scale) / (img.naturalWidth || 1024);

  spriteDragState = {
    sp,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startX: sp.x,
    startY: sp.y,
    scale,
  };
  const move = (ev) => {
    if (!spriteDragState) return;
    const st = spriteDragState;
    st.sp.x = st.startX + (ev.clientX - st.startClientX) / st.scale;
    st.sp.y = st.startY + (ev.clientY - st.startClientY) / st.scale;
    renderSprite(st.sp);
  };
  const up = () => {
    spriteDragState = null;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    schedulePersistSprites();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function onSpriteWheel(e, sp) {
  e.preventDefault();
  e.stopPropagation();
  if (!_wheelHistoryPushed) {
    if (typeof pushHistory === 'function') pushHistory();
    _wheelHistoryPushed = true;
    if (_wheelHistoryTimer) clearTimeout(_wheelHistoryTimer);
    _wheelHistoryTimer = setTimeout(() => { _wheelHistoryPushed = false; }, 600);
  }
  setSelected(placedSprites.indexOf(sp));
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  sp.w = Math.max(20, Math.min(4096, sp.w * factor));
  renderSprite(sp);
  renderSelection();
  schedulePersistSprites();
}

let _wheelHistoryPushed = false;
let _wheelHistoryTimer = null;

// Debounce des sauvegardes pour ne pas spammer la DB pendant un drag
let _persistTimer = null;
function schedulePersistSprites() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => { persistSpriteLayer(); _persistTimer = null; }, 250);
}

function spriteKeyHandler(e) {
  if (selectedSpriteIdx < 0) return;
  const sp = placedSprites[selectedSpriteIdx];
  if (!sp) return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  // Quitte tôt si on ne reconnaît pas la touche : pas de snapshot, pas de persist
  const isDelete = e.key === 'Delete' || e.key === 'Backspace';
  const isRotate = e.key === 'r' || e.key === 'R';
  const isArrow = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
  if (!isDelete && !isRotate && !isArrow) return;

  if (typeof pushHistory === 'function') pushHistory();
  if (isDelete) {
    e.preventDefault();
    if (sp.el) sp.el.remove();
    placedSprites.splice(selectedSpriteIdx, 1);
    setSelected(-1);
  } else if (isRotate) {
    sp.angle = (sp.angle + (e.shiftKey ? -15 : 15)) % 360;
    renderSprite(sp);
  } else if (e.key === 'ArrowLeft') {
    sp.angle = (sp.angle - 5) % 360;
    renderSprite(sp);
  } else if (e.key === 'ArrowRight') {
    sp.angle = (sp.angle + 5) % 360;
    renderSprite(sp);
  }
  schedulePersistSprites();
}

// Persiste l'état actuel des sprites dans le document de la carte courante
async function persistSpriteLayer() {
  const doc = currentDoc;
  if (!currentMap || !currentMap.id || !doc) return;

  const sprites = placedSprites.map(sp => {
    const out = { sprite_id: sp.sprite_id, x: sp.x, y: sp.y, w: sp.w, angle: sp.angle };
    if (sp.custom_id) out.custom_id = sp.custom_id;
    if (sp.custom_path) out.custom_path = sp.custom_path;
    return out;
  });

  // Retire l'ancien calque sprites s'il existe, puis ajoute le nouveau (si non-vide)
  const docWithoutSprites = {
    ...doc,
    layers: (doc.layers || []).filter(l => l.type !== 'sprites'),
  };
  const newDoc = sprites.length > 0
    ? domain.addLayer(docWithoutSprites, domain.makeSpriteLayer(sprites))
    : domain.withUpdatedAt(docWithoutSprites);

  appStore.set({ doc: newDoc });

  try {
    await invoke('update_document', { id: currentMap.id, document: JSON.stringify(newDoc) });
  } catch (e) {
    console.warn('Persist sprite layer failed', e);
  }
}

// Abonnements propres au store (remplace les monkey-patches)
window.addEventListener('DOMContentLoaded', () => {
  if (!window.appStore) return;

  // Quand la vue change (zoom/pan), repositionner les overlays
  appStore.subscribeKey('view', () => {
    if (placedSprites.length > 0 || isSpriteActive()) positionSpriteOverlay();
    positionAllInpaintLayers();
  });

  // Quand le document change (carte chargée, calque ajouté, undo, etc.) :
  // re-render des calques visuels
  appStore.subscribeKey('doc', () => {
    const img = document.getElementById('result-img');
    const apply = () => showLayersForCurrentDoc();
    if (img && img.complete && img.naturalWidth) apply();
    else if (img) img.addEventListener('load', apply, { once: true });
  });

  window.addEventListener('resize', positionAllInpaintLayers);
});
