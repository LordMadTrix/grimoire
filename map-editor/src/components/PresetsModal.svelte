<script lang="ts">
  import { mapStore } from '../lib/stores/mapStore.svelte';
  import { ALL_MAP_PRESETS, type MapPreset } from '../lib/mapPresets';

  let selectedPreset = $state<MapPreset>(ALL_MAP_PRESETS[0]);

  function applyAndClose(preset: MapPreset) {
    if (mapStore.stamps.length > 0 || mapStore.shapes.length > 0) {
      if (!confirm(`Remplacer la carte actuelle par le preset « ${preset.name} » ?\n(Cette action est annulable avec Ctrl+Z)`)) {
        return;
      }
    }
    preset.apply();
    mapStore.showPresetsModal = false;
  }
</script>

{#if mapStore.showPresetsModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => mapStore.showPresetsModal = false}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-title">
          <span class="icon">✨</span>
          <span>Générateur de Cartes & Presets Magiques</span>
        </div>
        <button class="close-btn" onclick={() => mapStore.showPresetsModal = false}>✕</button>
      </div>

      <p class="modal-subtitle">
        Générez en un éclair un environnement complet prêt pour vos parties : donjon, auberge animée, forêt druidique ou archipel d'îles.
      </p>

      <div class="presets-grid">
        {#each ALL_MAP_PRESETS as preset}
          <div
            class="preset-card"
            class:selected={selectedPreset.id === preset.id}
            onclick={() => selectedPreset = preset}
          >
            <div class="preset-icon">{preset.icon}</div>
            <div class="preset-info">
              <div class="preset-name">{preset.name}</div>
              <div class="preset-tag">{preset.category === 'battlemap' ? '⚔️ Battlemap Tactique' : '🗺️ Carte du Monde'}</div>
              <div class="preset-desc">{preset.description}</div>
            </div>
            <button class="preset-apply-btn" onclick={(e) => { e.stopPropagation(); applyAndClose(preset); }}>
              Générer
            </button>
          </div>
        {/each}
      </div>

      <div class="modal-footer">
        <div class="footer-tip">
          💡 <em>Tous les éléments générés restent modifiables, déplaçables et annulables avec Ctrl+Z.</em>
        </div>
        <button class="btn-cancel" onclick={() => mapStore.showPresetsModal = false}>Fermer</button>
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
    animation: fadeIn 0.15s ease-out;
  }

  .modal-card {
    background: #0f141f;
    border: 1px solid rgba(212, 168, 75, 0.4);
    border-radius: 16px;
    width: 680px;
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
    margin-bottom: 8px;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 800;
    color: #fff;
    letter-spacing: 0.02em;
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
  .close-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .modal-subtitle {
    color: #94a3b8;
    font-size: 13px;
    margin-bottom: 20px;
    line-height: 1.4;
  }

  .presets-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }

  .preset-card {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 14px 18px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .preset-card:hover {
    background: rgba(229, 168, 83, 0.06);
    border-color: rgba(229, 168, 83, 0.4);
    transform: translateY(-2px);
  }
  .preset-card.selected {
    background: rgba(229, 168, 83, 0.1);
    border-color: #e5a853;
  }

  .preset-icon {
    font-size: 32px;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  .preset-info {
    flex-grow: 1;
  }

  .preset-name {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 2px;
  }

  .preset-tag {
    font-size: 10px;
    font-weight: 600;
    color: #e5a853;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  .preset-desc {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.35;
  }

  .preset-apply-btn {
    background: linear-gradient(135deg, #e5a853, #b45309);
    border: none;
    color: #000;
    font-weight: 700;
    font-size: 12px;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .preset-apply-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 0 15px rgba(229, 168, 83, 0.4);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 16px;
  }

  .footer-tip {
    font-size: 11px;
    color: #64748b;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
    font-size: 12px;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
  }
  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
