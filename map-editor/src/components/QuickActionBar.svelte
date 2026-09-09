<script lang="ts">
  import { mapStore, pushHistory, undo, redo, canUndo, canRedo } from '../lib/stores/mapStore.svelte';

  function resetView() {
    mapStore.zoom = 0.6;
    mapStore.panX = 50;
    mapStore.panY = 50;
  }

  function toggleZen() {
    mapStore.zenMode = !mapStore.zenMode;
    if (mapStore.zenMode) {
      mapStore.showPanel = false;
    } else {
      mapStore.showPanel = true;
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function flipSelectedH() {
    if (mapStore.selectedElement?.type === 'stamp') {
      pushHistory();
      mapStore.stamps = mapStore.stamps.map(s => s.id === mapStore.selectedElement!.id ? { ...s, flipH: !s.flipH } : s);
    } else if (mapStore.selectedIds.length > 0) {
      pushHistory();
      mapStore.stamps = mapStore.stamps.map(s => mapStore.selectedIds.some(sel => sel.id === s.id) ? { ...s, flipH: !s.flipH } : s);
    }
  }

  function flipSelectedV() {
    if (mapStore.selectedElement?.type === 'stamp') {
      pushHistory();
      mapStore.stamps = mapStore.stamps.map(s => s.id === mapStore.selectedElement!.id ? { ...s, flipV: !s.flipV } : s);
    } else if (mapStore.selectedIds.length > 0) {
      pushHistory();
      mapStore.stamps = mapStore.stamps.map(s => mapStore.selectedIds.some(sel => sel.id === s.id) ? { ...s, flipV: !s.flipV } : s);
    }
  }
</script>

<div class="quick-bar-wrapper" class:zen-active={mapStore.zenMode}>
  <div class="quick-bar">
    <!-- Bibliothèque Céleste -->
    <button
      class="qb-btn celestial"
      class:active={mapStore.showCelestialModal}
      onclick={() => mapStore.showCelestialModal = true}
      title="Bibliothèque Céleste (Cartes, Tampons, Textures, Musiques)"
    >
      <span class="qb-icon">🌌</span>
      <span class="qb-label">Biblio Céleste</span>
    </button>

    <div class="qb-divider"></div>

    <!-- Presets de Cartes Instantanés -->
    <button
      class="qb-btn highlight"
      onclick={() => mapStore.showPresetsModal = true}
      title="Générer une carte complète en 1 clic (Auberge, Donjon, Forêt, Temple, Archipel)"
    >
      <span class="qb-icon">✨</span>
      <span class="qb-label">Presets Magiques</span>
    </button>

    <div class="qb-divider"></div>

    <!-- Ambiance & Éclairage -->
    <button
      class="qb-btn"
      class:active={mapStore.showAtmosphereModal}
      onclick={() => mapStore.showAtmosphereModal = true}
      title="Atmosphère, cycle Jour/Nuit, Brume et Éclairage"
    >
      <span class="qb-icon">
        {#if mapStore.atmospherePreset === 'sunset'}🌅
        {:else if mapStore.atmospherePreset === 'night'}🌙
        {:else if mapStore.atmospherePreset === 'dungeon'}🔥
        {:else if mapStore.atmospherePreset === 'fog'}🌫️
        {:else if mapStore.atmospherePreset === 'blood_moon'}🩸
        {:else}☀️{/if}
      </span>
      <span class="qb-label">Ambiance</span>
    </button>

    <!-- Gestionnaire de Calques (Layers) -->
    <button
      class="qb-btn"
      class:active={mapStore.showLayersModal}
      onclick={() => mapStore.showLayersModal = true}
      title="Gérer la visibilité et le verrouillage des calques"
    >
      <span class="qb-icon">👁️</span>
      <span class="qb-label">Calques</span>
    </button>

    <!-- Outil Règle de Mesure -->
    <button
      class="qb-btn"
      class:active={mapStore.activeTool === 'measure'}
      onclick={() => { mapStore.activeTool = 'measure'; mapStore.showPanel = false; }}
      title="Règle tactique de mesure de distances (M)"
    >
      <span class="qb-icon">📐</span>
      <span class="qb-label">Mesure</span>
    </button>

    <!-- Grille Tactique (G) -->
    <button
      class="qb-btn"
      class:active={mapStore.showGrid}
      onclick={() => mapStore.showGrid = !mapStore.showGrid}
      title="Afficher / Masquer la grille tactique (G)"
    >
      <span class="qb-icon">▦</span>
      <span class="qb-label">Grille</span>
    </button>

    <!-- Radar / Minimap -->
    <button
      class="qb-btn"
      class:active={mapStore.showMinimap}
      onclick={() => mapStore.showMinimap = !mapStore.showMinimap}
      title="Afficher / Masquer le radar de navigation (Minimap)"
    >
      <span class="qb-icon">🧭</span>
      <span class="qb-label">Radar</span>
    </button>

    {#if mapStore.selectedElement?.type === 'stamp' || (mapStore.selectedIds.length > 0 && mapStore.stamps.some(s => mapStore.selectedIds.some(sel => sel.id === s.id)))}
      <div class="qb-divider"></div>
      <button
        class="qb-btn-icon"
        onclick={flipSelectedH}
        title="Miroir Horizontal : inverser gauche/droite (H)"
      >
        ⇋
      </button>
      <button
        class="qb-btn-icon"
        onclick={flipSelectedV}
        title="Miroir Vertical : inverser haut/bas (J)"
      >
        ⇅
      </button>
    {/if}

    <div class="qb-divider"></div>

    <!-- Undo / Redo Express -->
    <button
      class="qb-btn-icon"
      onclick={undo}
      disabled={!canUndo()}
      title="Annuler la dernière action (Ctrl+Z)"
    >
      ↩
    </button>
    <button
      class="qb-btn-icon"
      onclick={redo}
      disabled={!canRedo()}
      title="Rétablir l'action (Ctrl+Y)"
    >
      ↪
    </button>

    <!-- Recadrer la vue -->
    <button
      class="qb-btn-icon"
      onclick={resetView}
      title="Recentrer la vue sur le canevas"
    >
      🎯
    </button>

    <!-- Plein Écran (F11) -->
    <button
      class="qb-btn-icon"
      onclick={toggleFullscreen}
      title="Basculer en Plein Écran (F11)"
    >
      ⛶
    </button>

    <!-- Mode Zen (Immersion totale) -->
    <button
      class="qb-btn zen-btn"
      class:zen={mapStore.zenMode}
      onclick={toggleZen}
      title="Mode Zen : masquer les panneaux latéraux pour dessiner en grand écran (Z)"
    >
      <span class="qb-icon">🧘</span>
      <span class="qb-label">{mapStore.zenMode ? 'Quitter Zen' : 'Mode Zen'}</span>
    </button>

    <!-- Aide & Raccourcis -->
    <button
      class="qb-btn-icon help"
      onclick={() => mapStore.showShortcutsModal = true}
      title="Aide & Raccourcis Clavier (?)"
    >
      ?
    </button>
  </div>
</div>

<style>
  .quick-bar-wrapper {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 140;
    pointer-events: auto;
    transition: all 0.3s ease;
  }

  .quick-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(14, 18, 27, 0.92);
    border: 1px solid rgba(212, 168, 75, 0.35);
    border-radius: 30px;
    padding: 5px 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(229, 168, 83, 0.15);
    backdrop-filter: blur(14px);
  }

  .qb-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: 1px solid transparent;
    color: #c9d1d9;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    user-select: none;
  }

  .qb-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .qb-btn.active {
    background: rgba(229, 168, 83, 0.2);
    border-color: rgba(229, 168, 83, 0.6);
    color: #f3c178;
  }

  .qb-btn.highlight {
    background: linear-gradient(135deg, rgba(229, 168, 83, 0.25), rgba(180, 83, 9, 0.2));
    border: 1px solid rgba(229, 168, 83, 0.5);
    color: #fce7b0;
  }
  .qb-btn.highlight:hover {
    background: linear-gradient(135deg, rgba(229, 168, 83, 0.4), rgba(180, 83, 9, 0.35));
    box-shadow: 0 0 12px rgba(229, 168, 83, 0.3);
  }

  .qb-btn.celestial {
    background: rgba(147, 51, 234, 0.15);
    border-color: rgba(168, 85, 247, 0.35);
    color: #e9d5ff;
  }
  .qb-btn.celestial:hover, .qb-btn.celestial.active {
    background: rgba(147, 51, 234, 0.35);
    border-color: #c084fc;
    color: #ffffff;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.4);
  }

  .qb-btn.zen-btn.zen {
    background: rgba(168, 85, 247, 0.25);
    border-color: rgba(168, 85, 247, 0.6);
    color: #e9d5ff;
  }

  .qb-btn-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    font-size: 13px;
    font-weight: bold;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .qb-btn-icon:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
  }
  .qb-btn-icon:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .qb-btn-icon.help {
    background: rgba(229, 168, 83, 0.15);
    border-color: rgba(229, 168, 83, 0.3);
    color: #e5a853;
  }
  .qb-btn-icon.help:hover {
    background: #e5a853;
    color: #000;
  }

  .qb-divider {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.12);
    margin: 0 3px;
  }

  .qb-icon {
    font-size: 13px;
  }
</style>
