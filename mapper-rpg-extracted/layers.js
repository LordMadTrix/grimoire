// ============================================================
// PANNEAU CALQUES : liste, visibilité, suppression, ordre
// Affiche les calques du currentDoc.
// Photoshop convention : haut du panneau = haut de la pile (rendu en dernier).
// Notre array : layers[0]=bas, layers[N-1]=haut → on affiche reversed.
// ============================================================

const LAYERS_COLLAPSED_KEY = 'mapper-rpg-layers-collapsed';
let layersCollapsed = false;

function toggleLayersCollapsed() {
  layersCollapsed = !layersCollapsed;
  try { localStorage.setItem(LAYERS_COLLAPSED_KEY, layersCollapsed ? '1' : '0'); } catch {}
  applyLayersCollapsedState();
}

function applyLayersCollapsedState() {
  const panel = document.getElementById('layers-panel');
  const headerExp = document.getElementById('layers-header-expanded');
  const headerCol = document.getElementById('layers-header-collapsed');
  const list = document.getElementById('layers-list');
  if (!panel) return;
  if (layersCollapsed) {
    panel.style.width = '2.5rem';
    headerExp.style.display = 'none';
    headerCol.style.display = 'flex';
    list.style.display = 'none';
  } else {
    panel.style.width = '18rem';
    headerExp.style.display = 'flex';
    headerCol.style.display = 'none';
    list.style.display = '';
  }
  // Relayout après transition (200 ms)
  setTimeout(() => {
    if (typeof positionSpriteOverlay === 'function') positionSpriteOverlay();
    if (typeof positionAllInpaintLayers === 'function') positionAllInpaintLayers();
    if (typeof refreshGridLayer === 'function') refreshGridLayer();
    if (typeof applyViewTransform === 'function') applyViewTransform();
  }, 220);
}

window.addEventListener('DOMContentLoaded', () => {
  try { layersCollapsed = localStorage.getItem(LAYERS_COLLAPSED_KEY) === '1'; } catch {}
  applyLayersCollapsedState();
  renderLayersList();
});

function layerTitle(layer) {
  if (layer.type === 'sprites') {
    const n = (layer.sprites || []).length;
    return `🎨 Sprites (${n})`;
  }
  if (layer.type === 'inpaint') {
    const p = layer.prompt || 'Retouche';
    return `🩹 ${p.length > 28 ? p.slice(0, 26) + '…' : p}`;
  }
  return layer.type || '?';
}

function renderLayersList() {
  const list = document.getElementById('layers-list');
  if (!list) return;
  if (!currentDoc) {
    list.innerHTML = '<p class="text-gray-500 text-xs text-center mt-4">Aucune carte affichée.</p>';
    return;
  }
  list.innerHTML = '';
  const layers = currentDoc.layers || [];

  // Haut du panneau = top du stack (dernier élément de l'array)
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const row = document.createElement('div');
    row.className = 'bg-gray-800 rounded p-2 flex items-center gap-2 border border-gray-700';
    row.innerHTML = `
      <button title="Visibilité" class="layer-vis text-gray-300 hover:text-white w-6 text-center">${layer.visible !== false ? '👁' : '🙈'}</button>
      <span class="flex-1 text-xs truncate" title="${(layer.prompt || layer.type || '').replace(/"/g, '&quot;')}">${layerTitle(layer)}</span>
      <div class="flex flex-col gap-0.5">
        <button title="Monter" class="layer-up text-gray-400 hover:text-white text-[10px] leading-none" ${i === layers.length - 1 ? 'disabled' : ''}>▲</button>
        <button title="Descendre" class="layer-down text-gray-400 hover:text-white text-[10px] leading-none" ${i === 0 ? 'disabled' : ''}>▼</button>
      </div>
      <button title="Supprimer" class="layer-del text-red-400 hover:text-red-300 text-xs">🗑</button>
    `;
    row.querySelector('.layer-vis').addEventListener('click', () => toggleLayerVisibility(i));
    row.querySelector('.layer-up').addEventListener('click', () => moveLayer(i, +1));
    row.querySelector('.layer-down').addEventListener('click', () => moveLayer(i, -1));
    row.querySelector('.layer-del').addEventListener('click', () => deleteLayer(i));
    list.appendChild(row);

    // Détail : liste les sprites individuels sous le calque "sprites"
    if (layer.type === 'sprites' && layer.visible !== false) {
      const items = layer.sprites || [];
      // Affiche du dernier (au-dessus) au premier
      for (let j = items.length - 1; j >= 0; j--) {
        const s = items[j];
        const child = document.createElement('div');
        const isSelected = (placedSprites[j] && placedSprites.indexOf(placedSprites[j]) === selectedSpriteIdx);
        child.className = `ml-4 rounded p-1.5 flex items-center gap-2 cursor-pointer text-xs border ${isSelected ? 'bg-amber-900/40 border-amber-500' : 'bg-gray-800/50 hover:bg-gray-700/50 border-gray-700'}`;
        child.innerHTML = `
          <img class="layer-sprite-thumb" style="width:24px; height:24px; object-fit:contain;" draggable="false">
          <span class="flex-1 text-gray-300 truncate">#${s.sprite_id}</span>
          <button title="Supprimer ce sprite" class="sprite-item-del text-red-400 hover:text-red-300">✕</button>
        `;
        // Charge l'aperçu via le cache central (gère HTTP/2 stream cancellation)
        assets.applyToImg(child.querySelector('img.layer-sprite-thumb'), s.sprite_id, 'preview');
        child.addEventListener('click', (e) => {
          if (e.target.closest('.sprite-item-del')) return;
          selectSpriteByIndex(j);
        });
        child.querySelector('.sprite-item-del').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteSpriteByIndex(j);
        });
        list.appendChild(child);
      }
    }
  }

  // Image générée (base) en bas
  const baseRow = document.createElement('div');
  baseRow.className = 'bg-gray-900 rounded p-2 flex items-center gap-2 border border-gray-800 mt-2';
  baseRow.innerHTML = `
    <span class="w-6 text-center text-gray-500">🖼</span>
    <span class="flex-1 text-xs text-gray-400">Image générée (base)</span>
  `;
  list.appendChild(baseRow);

  if (layers.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-gray-500 text-xs text-center mt-2';
    empty.textContent = 'Aucun calque. Ajoute des sprites ou retouche pour en créer.';
    list.appendChild(empty);
  }
}

function selectSpriteByIndex(j) {
  if (j < 0 || j >= placedSprites.length) return;
  setSelected(j);
  if (typeof renderSelection === 'function') renderSelection();
}

function deleteSpriteByIndex(j) {
  if (j < 0 || j >= placedSprites.length) return;
  // Ajuste la sélection avant suppression
  if (selectedSpriteIdx === j) setSelected(-1);
  else if (selectedSpriteIdx > j) setSelected(selectedSpriteIdx - 1);
  // Dispatch via Command pattern (mutera le doc → renderers s'auto-refreshent)
  window.__undo.dispatch(new commands.DeleteSpriteCommand(j));
}

async function commitLayersChange() {
  if (!currentDoc || !currentMap) return;
  // doc déjà remplacé par un nouvel objet via domain.* — notification du store déjà passée.
  try {
    await invoke('update_document', { id: currentMap.id, document: JSON.stringify(currentDoc) });
  } catch (e) {
    console.warn('Persist layers failed', e);
  }
}

function toggleLayerVisibility(i) {
  const doc = currentDoc;
  if (!doc || !doc.layers[i]) return;
  pushHistory();
  const layer = doc.layers[i];
  appStore.set({ doc: domain.setLayerVisibility(doc, layer.id, !(layer.visible !== false)) });
  commitLayersChange();
}

function moveLayer(i, dir) {
  const doc = currentDoc;
  if (!doc || !doc.layers[i]) return;
  if (i + dir < 0 || i + dir >= doc.layers.length) return;
  pushHistory();
  appStore.set({ doc: domain.moveLayer(doc, i, dir) });
  commitLayersChange();
}

function deleteLayer(i) {
  const doc = currentDoc;
  if (!doc || !doc.layers[i]) return;
  pushHistory();
  appStore.set({ doc: domain.removeLayerAt(doc, i) });
  commitLayersChange();
}

// Abonnement propre via le store : à chaque changement, re-render le panneau
if (window.appStore) {
  appStore.subscribe(() => renderLayersList());
}
