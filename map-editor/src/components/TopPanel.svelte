<script lang="ts">
  import { mapStore, undo, redo, canUndo, canRedo } from '../lib/stores/mapStore.svelte';

  let { 
    onExport = () => {},
    onSave = () => {},
    onLoad = (e: Event) => {},
    onClear = () => {},
    onMenuClick = () => {}
  }: { 
    onExport?: () => void;
    onSave?: () => void;
    onLoad?: (e: Event) => void;
    onClear?: () => void;
    onMenuClick?: () => void;
  } = $props();
</script>

<div class="top-panel">
  <!-- Bouton Menu Hamburger -->
  <button type="button" class="tp-btn" onclick={onMenuClick} title="Menu">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" class="icon">
      <path fill="currentColor" d="M5 15h10v-2H5v2zM5 5v2h10V5H5zm0 6h10V9H5v2z"></path>
    </svg>
  </button>

  <div class="tp-divider"></div>

  <!-- Bouton d'exportation d'image -->
  <button type="button" id="top-export" class="tp-btn" onclick={onExport} title="Exporter la Carte (PNG)">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" class="icon">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M7.89467 8.15807V11.9573C7.89467 12.111 7.94511 12.2399 8.04599 12.344C8.14687 12.448 8.27188 12.5 8.421 12.5H11.579C11.7281 12.5 11.8531 12.448 11.954 12.344C12.0548 12.2399 12.1053 12.111 12.1053 11.9573V8.15807H13.6316C13.8597 8.15807 14.0198 8.05631 14.1119 7.85278C14.204 7.64925 14.1799 7.45703 14.0395 7.27612L10.4079 2.70353C10.3026 2.56784 10.1666 2.5 9.99998 2.5C9.83331 2.5 9.69734 2.56784 9.59208 2.70353L5.96043 7.27612C5.82007 7.45703 5.79595 7.64925 5.88806 7.85278C5.98016 8.05631 6.14025 8.15807 6.36833 8.15807H7.89467ZM4.33331 12.5C4.33331 11.9477 3.8856 11.5 3.33331 11.5C2.78103 11.5 2.33331 11.9477 2.33331 12.5V14.25C2.33331 15.9069 3.67646 17.25 5.33331 17.25H14.6666C16.3235 17.25 17.6666 15.9069 17.6666 14.25V12.5C17.6666 11.9477 17.2189 11.5 16.6666 11.5C16.1144 11.5 15.6666 11.9477 15.6666 12.5V14.25C15.6666 14.8023 15.2189 15.25 14.6666 15.25H5.33331C4.78103 15.25 4.33331 14.8023 4.33331 14.25V12.5Z" fill="currentColor"></path>
    </svg>
  </button>

  <div class="tp-divider"></div>

  <!-- Historique Undo / Redo -->
  <button type="button" class="tp-btn" onclick={undo} disabled={!canUndo()} title="Annuler (Ctrl+Z)">
    <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" class="icon" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
      <path fill="none" d="M0 0h24v24H0z"></path>
      <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"></path>
    </svg>
  </button>

  <button type="button" class="tp-btn" onclick={redo} disabled={!canRedo()} title="Rétablir (Ctrl+Y)">
    <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" class="icon" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
      <path fill="none" d="M0 0h24v24H0z"></path>
      <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16a8.002 8.002 0 0 1 7.6-5.5c1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"></path>
    </svg>
  </button>

  <!-- Historique étendu -->
  <button type="button" class="tp-btn" disabled={!canUndo()} title="Historique des modifications">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="icon">
      <path fill="currentColor" d="M13 3a9 9 0 0 0-9 9H1l4 3.99L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7s-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.25 2.52l.77-1.28l-3.52-2.09V8z"></path>
    </svg>
  </button>

  <div class="tp-divider"></div>

  <!-- OPTIONS DYNAMIQUES DE L'OUTIL -->
  <div class="tp-options-container">
    <!-- Sculpt ou Paint : Taille de brosse -->
    {#if mapStore.activeTool === 'sculpt'}
      <div class="tp-option-item">
        <label title="Taille du pinceau (Sculpt)">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 320 512" class="option-icon rotate-45" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
            <path d="M182.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L128 109.3l0 293.5L86.6 361.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 402.7l0-293.5 41.4 41.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-96-96z"></path>
          </svg>
        </label>
        <input type="range" min="10" max="200" bind:value={mapStore.sculptBrushSize} class="tp-slider-input" />
        <input type="number" min="10" max="200" bind:value={mapStore.sculptBrushSize} class="tp-number-input" />
        <span class="unit">px</span>
      </div>
    {/if}

    {#if mapStore.activeTool === 'paint'}
      <div class="tp-option-item">
        <label title="Taille du pinceau (Paint)">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 320 512" class="option-icon rotate-45" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
            <path d="M182.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L128 109.3l0 293.5L86.6 361.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 402.7l0-293.5 41.4 41.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-96-96z"></path>
          </svg>
        </label>
        <input type="range" min="15" max="300" bind:value={mapStore.paintBrushSize} class="tp-slider-input" />
        <input type="number" min="15" max="300" bind:value={mapStore.paintBrushSize} class="tp-number-input" />
        <span class="unit">px</span>
      </div>

      <div class="tp-option-item">
        <label title="Opacité du pinceau (Paint)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="option-icon">
            <path fill="currentColor" d="M17.66 8L12 2.35L6.34 8A8.02 8.02 0 0 0 4 13.64c0 2 .78 4.11 2.34 5.67a7.99 7.99 0 0 0 11.32 0c1.56-1.56 2.34-3.67 2.34-5.67S19.22 9.56 17.66 8zM6 14c.01-2 .62-3.27 1.76-4.4L12 5.27l4.24 4.38C17.38 10.77 17.99 12 18 14H6z"></path>
          </svg>
        </label>
        <input type="range" min="0.1" max="1.0" step="0.05" bind:value={mapStore.paintBrushOpacity} class="tp-slider-input" />
        <input type="number" min="10" max="100" value={Math.round(mapStore.paintBrushOpacity * 100)} oninput={(e) => mapStore.paintBrushOpacity = Number(e.currentTarget.value) / 100} class="tp-number-input" />
        <span class="unit">%</span>
      </div>
    {/if}

    <!-- Stamp : Échelle, Opacité, Rotation -->
    {#if mapStore.activeTool === 'stamp'}
      <div class="tp-option-item">
        <label title="Taille du Tampon (Échelle)">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 320 512" class="option-icon rotate-45" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
            <path d="M182.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L128 109.3l0 293.5L86.6 361.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 402.7l0-293.5 41.4 41.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-96-96z"></path>
          </svg>
        </label>
        <input type="range" min="0.1" max="3.0" step="0.05" bind:value={mapStore.stampScale} class="tp-slider-input" />
        <input type="number" min="10" max="300" value={Math.round(mapStore.stampScale * 100)} oninput={(e) => mapStore.stampScale = Number(e.currentTarget.value) / 100} class="tp-number-input" />
        <span class="unit">%</span>
      </div>

      <div class="tp-option-item">
        <label title="Opacité du Tampon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="option-icon">
            <path fill="currentColor" d="M17.66 8L12 2.35L6.34 8A8.02 8.02 0 0 0 4 13.64c0 2 .78 4.11 2.34 5.67a7.99 7.99 0 0 0 11.32 0c1.56-1.56 2.34-3.67 2.34-5.67S19.22 9.56 17.66 8zM6 14c.01-2 .62-3.27 1.76-4.4L12 5.27l4.24 4.38C17.38 10.77 17.99 12 18 14H6z"></path>
          </svg>
        </label>
        <input type="range" min="0.1" max="1.0" step="0.05" bind:value={mapStore.stampOpacity} class="tp-slider-input" />
        <input type="number" min="10" max="100" value={Math.round(mapStore.stampOpacity * 100)} oninput={(e) => mapStore.stampOpacity = Number(e.currentTarget.value) / 100} class="tp-number-input" />
        <span class="unit">%</span>
      </div>

      <div class="tp-option-item">
        <label title="Rotation du Tampon">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" class="option-icon" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
            <path d="M370.72 133.28C339.458 104.008 298.888 87.962 255.848 88c-77.458.068-144.328 53.178-162.791 126.85-1.344 5.363-6.122 9.15-11.651 9.15H24.103c-7.498 0-13.194-6.807-11.807-14.176C33.933 94.924 134.813 8 256 8c66.448 0 126.791 26.136 171.315 68.685L463.03 40.97C478.149 25.851 504 36.559 504 57.941V192c0 13.255-10.745 24-24 24H345.941c-21.382 0-32.09-25.851-16.971-40.971l41.75-41.749zM32 296h134.059c21.382 0 32.09 25.851 16.971 40.971l-41.75 41.75c31.262 29.273 71.835 45.319 114.876 45.28 77.418-.07 144.315-53.144 162.787-126.849 1.344-5.363 6.122-9.15 11.651-9.15h57.304c7.498 0 13.194 6.807 11.807 14.176C478.067 417.076 377.187 504 256 504c-66.448 0-126.791-26.136-171.315-68.685L48.97 471.03C33.851 486.149 8 475.441 8 454.059V320c0-13.255 10.745-24 24-24z"></path>
          </svg>
        </label>
        <input type="range" min="-180" max="180" step="5" bind:value={mapStore.stampRotation} class="tp-slider-input" />
        <input type="number" min="-180" max="180" bind:value={mapStore.stampRotation} class="tp-number-input" style="width: 50px;" />
        <span class="unit">°</span>
      </div>
    {/if}

    <!-- Path : Épaisseur -->
    {#if mapStore.activeTool === 'path'}
      <div class="tp-option-item">
        <label title="Épaisseur du tracé">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 320 512" class="option-icon rotate-45" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
            <path d="M182.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L128 109.3l0 293.5L86.6 361.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 402.7l0-293.5 41.4 41.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-96-96z"></path>
          </svg>
        </label>
        <input type="range" min="1" max="20" bind:value={mapStore.pathWidth} class="tp-slider-input" />
        <input type="number" min="1" max="20" bind:value={mapStore.pathWidth} class="tp-number-input" />
        <span class="unit">px</span>
      </div>
    {/if}

    <!-- Text : Taille, Rotation -->
    {#if mapStore.activeTool === 'text'}
      <div class="tp-option-item">
        <label title="Taille du texte">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 320 512" class="option-icon rotate-45" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
            <path d="M182.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L128 109.3l0 293.5L86.6 361.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 402.7l0-293.5 41.4 41.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-96-96z"></path>
          </svg>
        </label>
        <input type="range" min="10" max="80" bind:value={mapStore.textSize} class="tp-slider-input" />
        <input type="number" min="10" max="80" bind:value={mapStore.textSize} class="tp-number-input" />
        <span class="unit">pt</span>
      </div>

      <div class="tp-option-item">
        <label title="Rotation du texte">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" class="option-icon" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
            <path d="M370.72 133.28C339.458 104.008 298.888 87.962 255.848 88c-77.458.068-144.328 53.178-162.791 126.85-1.344 5.363-6.122 9.15-11.651 9.15H24.103c-7.498 0-13.194-6.807-11.807-14.176C33.933 94.924 134.813 8 256 8c66.448 0 126.791 26.136 171.315 68.685L463.03 40.97C478.149 25.851 504 36.559 504 57.941V192c0 13.255-10.745 24-24 24H345.941c-21.382 0-32.09-25.851-16.971-40.971l41.75-41.749zM32 296h134.059c21.382 0 32.09 25.851 16.971 40.971l-41.75 41.75c31.262 29.273 71.835 45.319 114.876 45.28 77.418-.07 144.315-53.144 162.787-126.849 1.344-5.363 6.122-9.15 11.651-9.15h57.304c7.498 0 13.194 6.807 11.807 14.176C478.067 417.076 377.187 504 256 504c-66.448 0-126.791-26.136-171.315-68.685L48.97 471.03C33.851 486.149 8 475.441 8 454.059V320c0-13.255 10.745-24 24-24z"></path>
          </svg>
        </label>
        <input type="range" min="-90" max="90" bind:value={mapStore.textRotation} class="tp-slider-input" />
        <input type="number" min="-90" max="90" bind:value={mapStore.textRotation} class="tp-number-input" />
        <span class="unit">°</span>
      </div>
    {/if}
  </div>

  <div class="tp-divider"></div>

  <!-- Titre de la carte -->
  <div class="tp-campaign">
    <input type="text" class="tp-campaign-title" placeholder="Sans titre" value="Royaume de Fantaisie" />
  </div>

  <!-- Séparateur flexible -->
  <div style="flex: 1;"></div>

  <!-- Boutons projet (Enregistrer / Charger / Vider) -->
  <div class="tp-project-actions">
    <button class="tp-proj-btn" onclick={onSave} title="Enregistrer le projet (JSON)">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="icon">
        <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" fill="currentColor"></path>
      </svg>
    </button>
    <label class="tp-proj-btn file-load-label" title="Charger un projet (JSON)">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="icon">
        <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" fill="currentColor"></path>
      </svg>
      <input type="file" accept=".json" onchange={onLoad} style="display:none;" />
    </label>
    <button class="tp-proj-btn tp-clear-btn" onclick={onClear} title="Vider la carte">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="icon">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"></path>
      </svg>
    </button>
  </div>
</div>

<style>
  .top-panel {
    height: var(--editor-top-nav-height);
    width: 100%;
    background-color: var(--bg-dark-primary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    padding: 0 12px;
    box-sizing: border-box;
    z-index: 140;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
  }

  .tp-btn {
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    padding: 0;
  }

  .tp-btn:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.05);
    color: var(--color-text-primary);
  }

  .tp-btn:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .tp-divider {
    height: 20px;
    width: 1px;
    background-color: rgba(255, 255, 255, 0.1);
    margin: 0 10px;
  }

  .icon {
    width: 18px;
    height: 18px;
  }

  .tp-options-container {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-left: 10px;
    flex: 1;
  }

  .tp-option-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tp-option-item label {
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .tp-option-item label:hover {
    color: var(--color-text-primary);
  }

  .option-icon {
    width: 14px;
    height: 14px;
  }

  .rotate-45 {
    transform: rotate(45deg);
  }

  /* Sliders de style Inkarnate */
  .tp-slider-input {
    appearance: none;
    -webkit-appearance: none;
    width: 100px;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .tp-slider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent-orange);
    box-shadow: 0 0 4px rgba(255, 204, 90, 0.5);
    transition: transform 0.1s;
  }

  .tp-slider-input::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  /* Boîtes numériques compactes style Inkarnate */
  .tp-number-input {
    background-color: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: var(--color-text-primary);
    font-size: 11px;
    padding: 3px 6px;
    width: 42px;
    text-align: center;
    outline: none;
    font-family: inherit;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .tp-number-input::-webkit-outer-spin-button,
  .tp-number-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .tp-number-input:focus {
    border-color: var(--accent-orange);
    background-color: rgba(255, 255, 255, 0.06);
  }

  .unit {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
    margin-left: -4px;
  }

  /* Titre et boutons projet */
  .tp-campaign {
    display: flex;
    align-items: center;
  }

  .tp-campaign-title {
    background: transparent;
    border: none;
    font-family: 'Cinzel', serif;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--accent-orange);
    outline: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
    width: 180px;
    padding: 2px 4px;
  }

  .tp-campaign-title:focus {
    border-color: rgba(255, 204, 90, 0.4);
  }

  .tp-project-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tp-proj-btn {
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    padding: 0;
  }

  .tp-proj-btn:hover {
    background-color: rgba(255, 204, 90, 0.08);
    border-color: var(--accent-orange);
    color: var(--accent-orange);
  }

  .file-load-label {
    position: relative;
    user-select: none;
  }

  .tp-clear-btn:hover {
    background-color: rgba(239, 68, 68, 0.08);
    border-color: #ef4444;
    color: #fca5a5;
  }
</style>
