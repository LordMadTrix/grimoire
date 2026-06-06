<script lang="ts">
  import { mapStore } from '../../lib/stores/mapStore.svelte';
</script>

<div class="panel-section">
  <span class="section-title">Mode Sculpter</span>
  <div class="modes-grid">
    <button
      class="mode-btn"
      class:active={mapStore.sculptMode === 'add'}
      onclick={() => mapStore.sculptMode = 'add'}
    >
      🟩 Créer la Terre
    </button>
    <button
      class="mode-btn"
      class:active={mapStore.sculptMode === 'subtract'}
      onclick={() => mapStore.sculptMode = 'subtract'}
    >
      🟦 Creuser la Mer
    </button>
  </div>
</div>

<!-- Curseur : Taille de brosse -->
<div class="slider-field">
  <div class="slider-header">
    <span class="slider-label">Taille</span>
    <div class="slider-value-container">
      <input type="number" min="10" max="200" bind:value={mapStore.sculptBrushSize} class="slider-value-input" />
      <span class="slider-unit">px</span>
    </div>
  </div>
  <input type="range" min="10" max="200" bind:value={mapStore.sculptBrushSize} class="slider-track" />
</div>

<div class="panel-section">
  <span class="section-title">Forme de brosse</span>
  <div class="shape-buttons-row" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;">
    <button
      class="shape-btn"
      class:active={mapStore.brushShape === 'circle'}
      onclick={() => mapStore.brushShape = 'circle'}
    >
      ◯ Rond
    </button>
    <button
      class="shape-btn"
      class:active={mapStore.brushShape === 'square'}
      onclick={() => mapStore.brushShape = 'square'}
    >
      ▢ Carré
    </button>
    <button
      class="shape-btn"
      class:active={mapStore.brushShape === 'rough'}
      onclick={() => mapStore.brushShape = 'rough'}
      style="font-size: 11px; padding: 4px 2px;"
    >
      🏔️ Brut
    </button>
  </div>
  <label class="checkbox-label" style="margin-top: 10px;">
    <input type="checkbox" bind:checked={mapStore.brushSnap} />
    <span>Magnétisme Grille</span>
  </label>
</div>

{#if mapStore.brushShape !== 'square'}
  <div class="slider-field">
    <div class="slider-header">
      <span class="slider-label">Rugosité des Côtes</span>
      <div class="slider-value-container">
        <input type="number" min="0" max="50" value={Math.round(mapStore.sculptRoughness * 100)} oninput={(e) => mapStore.sculptRoughness = Number(e.currentTarget.value) / 100} class="slider-value-input" />
        <span class="slider-unit">%</span>
      </div>
    </div>
    <input type="range" min="0" max="0.5" step="0.05" bind:value={mapStore.sculptRoughness} class="slider-track" />
    <span class="hint-text">Rend les côtes découpées naturelles</span>
  </div>
{/if}

<div class="panel-section" style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
  <span class="section-title">Actions Globales</span>
  <div style="display: flex; flex-direction: column; gap: 8px;">
    <button class="action-btn" onclick={() => (window as any).generateRandomContinent()} title="Générer un continent aléatoire">
      🎲 Générer Continent
    </button>
    <button class="action-btn" onclick={() => (window as any).fillLandMask()} title="Remplir toute la carte de terre">
      🟩 Remplir Terre
    </button>
    <button class="action-btn" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #ef4444;" onclick={() => (window as any).clearLandMask()} title="Effacer toute la terre (Tout en Eau)">
      🌊 Tout effacer (Mer)
    </button>
  </div>
</div>
