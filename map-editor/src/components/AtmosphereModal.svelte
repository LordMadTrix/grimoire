<script lang="ts">
  import { mapStore } from '../lib/stores/mapStore.svelte';

  const ATMOSPHERES = [
    { id: 'day', name: 'Plein Jour', icon: '☀️', desc: 'Lumière naturelle éclatante et couleurs vives.', filter: 'none', vignette: false, vignetteOp: 0.2 },
    { id: 'sunset', name: 'Crépuscule', icon: '🌅', desc: 'Lueur ambrée et tons chauds de fin de journée.', filter: 'warm', vignette: true, vignetteOp: 0.35 },
    { id: 'night', name: 'Nuit de Lune', icon: '🌙', desc: 'Teinte nocturne froide et mystérieuse.', filter: 'cold', vignette: true, vignetteOp: 0.5 },
    { id: 'dungeon', name: 'Donjon & Torches', icon: '🔥', desc: 'Obscurité claustrophobe avec vignettage accentué.', filter: 'warm', vignette: true, vignetteOp: 0.65 },
    { id: 'fog', name: 'Brume Spectrale', icon: '🌫️', desc: 'Brouillard épais et contraste adouci.', filter: 'cold', vignette: true, vignetteOp: 0.4 },
    { id: 'blood_moon', name: 'Lune de Sang', icon: '🩸', desc: 'Ambiance menaçante aux reflets pourpres.', filter: 'warm', vignette: true, vignetteOp: 0.55 },
  ];

  function setAtmosphere(atm: typeof ATMOSPHERES[0]) {
    mapStore.atmospherePreset = atm.id as any;
    mapStore.mapFilter = atm.filter as any;
    mapStore.mapFilterIntensity = 0.6;
    mapStore.vignetteEnabled = atm.vignette;
    mapStore.vignetteOpacity = atm.vignetteOp;
  }
</script>

{#if mapStore.showAtmosphereModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => mapStore.showAtmosphereModal = false}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-title">
          <span class="icon">✨</span>
          <span>Atmosphère, Éclairage & Ambiance</span>
        </div>
        <button class="close-btn" onclick={() => mapStore.showAtmosphereModal = false}>✕</button>
      </div>

      <p class="modal-subtitle">
        Modifiez en temps réel l'ambiance lumineuse et météo de votre carte pour immerger vos joueurs.
      </p>

      <!-- Presets d'Ambiance -->
      <div class="section-title">Presets d'Éclairage & Heure du Jour</div>
      <div class="atmosphere-grid">
        {#each ATMOSPHERES as atm}
          <button
            class="atm-card"
            class:active={mapStore.atmospherePreset === atm.id}
            onclick={() => setAtmosphere(atm)}
          >
            <div class="atm-icon">{atm.icon}</div>
            <div class="atm-text">
              <div class="atm-name">{atm.name}</div>
              <div class="atm-desc">{atm.desc}</div>
            </div>
          </button>
        {/each}
      </div>

      <!-- Effets de Post-Processing -->
      <div class="section-title" style="margin-top: 20px;">Effets de Rendu & Textures Visuelles</div>
      <div class="controls-grid">
        <!-- Vignettage -->
        <div class="control-box">
          <div class="control-head">
            <label class="toggle-label">
              <input type="checkbox" bind:checked={mapStore.vignetteEnabled} />
              <span class="control-name">Vignettage Circulaire</span>
            </label>
            <span class="val">{Math.round(mapStore.vignetteOpacity * 100)}%</span>
          </div>
          {#if mapStore.vignetteEnabled}
            <input type="range" min="0.1" max="1.0" step="0.05" bind:value={mapStore.vignetteOpacity} class="slider" />
          {/if}
        </div>

        <!-- Parchemin Ancien -->
        <div class="control-box">
          <div class="control-head">
            <label class="toggle-label">
              <input type="checkbox" bind:checked={mapStore.paperOverlayEnabled} />
              <span class="control-name">Texture Parchemin Ancien</span>
            </label>
            <span class="val">{Math.round(mapStore.paperOverlayOpacity * 100)}%</span>
          </div>
          {#if mapStore.paperOverlayEnabled}
            <input type="range" min="0.1" max="1.0" step="0.05" bind:value={mapStore.paperOverlayOpacity} class="slider" />
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-primary" onclick={() => mapStore.showAtmosphereModal = false}>Appliquer & Fermer</button>
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
    width: 620px;
    max-width: 92vw;
    max-height: 85vh;
    overflow-y: auto;
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

  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: #e5a853;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 10px;
  }

  .atmosphere-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .atm-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 14px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }
  .atm-card:hover {
    background: rgba(229, 168, 83, 0.08);
    border-color: rgba(229, 168, 83, 0.4);
  }
  .atm-card.active {
    background: rgba(229, 168, 83, 0.15);
    border-color: #e5a853;
    box-shadow: 0 0 14px rgba(229, 168, 83, 0.25);
  }

  .atm-icon {
    font-size: 24px;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    flex-shrink: 0;
  }

  .atm-name {
    font-size: 13px;
    font-weight: 700;
    color: #fff;
  }

  .atm-desc {
    font-size: 11px;
    color: #94a3b8;
  }

  .controls-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .control-box {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 12px;
  }

  .control-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    color: #cbd5e1;
  }

  .val {
    font-size: 11px;
    color: #e5a853;
    font-weight: 700;
  }

  .slider {
    width: 100%;
    accent-color: #e5a853;
    cursor: pointer;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 16px;
  }

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
  .btn-primary:hover {
    transform: scale(1.03);
    box-shadow: 0 0 15px rgba(229, 168, 83, 0.4);
  }
</style>
