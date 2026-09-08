<script lang="ts">
  import { mapStore } from '../lib/stores/mapStore.svelte';

  const LAYERS = [
    { id: 'background', name: 'Arrière-plan & Eau', icon: '🌊', count: () => mapStore.backgroundType },
    { id: 'terrain', name: 'Terrain & Relief Sculpté', icon: '⛰️', count: () => 'Raster' },
    { id: 'shapes', name: 'Formes & Pièces de Salles', icon: '🔷', count: () => `${mapStore.shapes.length} éléments` },
    { id: 'stamps', name: 'Tampons & Décorations', icon: '🌲', count: () => `${mapStore.stamps.length} objets` },
    { id: 'paths', name: 'Tracés, Routes & Murs', icon: '〰️', count: () => `${mapStore.paths.length} tracés` },
    { id: 'texts', name: 'Textes & Noms de Lieux', icon: '🏷️', count: () => `${mapStore.texts.length} étiquettes` },
    { id: 'grid', name: 'Grille Tactique', icon: '📐', count: () => `${mapStore.gridType} (${mapStore.gridSize}px)` },
  ];

  function toggleVisibility(id: string) {
    if (id === 'grid') {
      mapStore.showGrid = !mapStore.showGrid;
      mapStore.layerVisibility.grid = mapStore.showGrid;
      return;
    }
    const cur = (mapStore.layerVisibility as any)[id];
    (mapStore.layerVisibility as any)[id] = !cur;
  }

  function toggleLock(id: string) {
    if (id === 'grid') return;
    const cur = (mapStore.layerLocked as any)[id];
    (mapStore.layerLocked as any)[id] = !cur;
  }

  function showAll() {
    for (const k of Object.keys(mapStore.layerVisibility)) {
      (mapStore.layerVisibility as any)[k] = true;
    }
    mapStore.showGrid = true;
  }
</script>

{#if mapStore.showLayersModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => mapStore.showLayersModal = false}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-title">
          <span class="icon">👁️</span>
          <span>Gestionnaire de Calques (Layers)</span>
        </div>
        <button class="close-btn" onclick={() => mapStore.showLayersModal = false}>✕</button>
      </div>

      <p class="modal-subtitle">
        Affichez, masquez ou verrouillez chaque strate de votre composition cartographique.
      </p>

      <div class="layers-list">
        {#each LAYERS as layer}
          {@const isVisible = layer.id === 'grid' ? mapStore.showGrid : (mapStore.layerVisibility as any)[layer.id]}
          {@const isLocked = layer.id === 'grid' ? false : (mapStore.layerLocked as any)[layer.id]}
          <div class="layer-row" class:hidden-layer={!isVisible}>
            <div class="layer-left">
              <span class="layer-icon">{layer.icon}</span>
              <div class="layer-text">
                <span class="layer-name">{layer.name}</span>
                <span class="layer-count">{layer.count()}</span>
              </div>
            </div>

            <div class="layer-actions">
              <!-- Bouton Verrouiller -->
              {#if layer.id !== 'grid'}
                <button
                  class="action-btn"
                  class:locked={isLocked}
                  onclick={() => toggleLock(layer.id)}
                  title={isLocked ? 'Déverrouiller le calque' : 'Verrouiller le calque'}
                >
                  {isLocked ? '🔒' : '🔓'}
                </button>
              {/if}

              <!-- Bouton Visibilité -->
              <button
                class="action-btn"
                class:visible={isVisible}
                onclick={() => toggleVisibility(layer.id)}
                title={isVisible ? 'Masquer le calque' : 'Afficher le calque'}
              >
                {isVisible ? '👁️' : '🕶️'}
              </button>
            </div>
          </div>
        {/each}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={showAll}>Tout afficher</button>
        <button class="btn-primary" onclick={() => mapStore.showLayersModal = false}>Fermer</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-card {
    background: #0f141f;
    border: 1px solid rgba(212, 168, 75, 0.4);
    border-radius: 16px;
    width: 520px;
    max-width: 92vw;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(229, 168, 83, 0.2);
    padding: 24px;
    color: #e2e8f0;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 800;
    color: #fff;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .close-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }

  .modal-subtitle {
    color: #94a3b8;
    font-size: 13px;
    margin-bottom: 20px;
  }

  .layers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .layer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 14px;
    transition: all 0.15s ease;
  }
  .layer-row:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(229, 168, 83, 0.3);
  }
  .layer-row.hidden-layer {
    opacity: 0.5;
    background: rgba(0, 0, 0, 0.2);
  }

  .layer-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .layer-icon {
    font-size: 20px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
  }

  .layer-text {
    display: flex;
    flex-direction: column;
  }

  .layer-name {
    font-size: 13px;
    font-weight: 700;
    color: #fff;
  }

  .layer-count {
    font-size: 11px;
    color: #94a3b8;
  }

  .layer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s ease;
  }
  .action-btn:hover {
    background: rgba(229, 168, 83, 0.2);
    border-color: rgba(229, 168, 83, 0.5);
  }
  .action-btn.locked {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 16px;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
    font-size: 12px;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
  }
  .btn-secondary:hover { background: rgba(255, 255, 255, 0.05); }

  .btn-primary {
    background: linear-gradient(135deg, #e5a853, #b45309);
    border: none;
    color: #000;
    font-weight: 700;
    font-size: 13px;
    padding: 8px 18px;
    border-radius: 8px;
    cursor: pointer;
  }
</style>
