<script lang="ts">
  import { emitToPlayerView, readFileBase64 } from '$lib/api';
  import { getVaultPath, getVaultTree } from '$lib/stores/vault.svelte';
  import {
    vttStore,
    addGmToken, clearGmFow, undoGmFow,
    startCombat, stopCombat
  } from '$lib/stores/vtt.svelte';
  import type { VaultEntry } from '$lib/api';

  let isBlackout = $state(false);
  let showMapPicker = $state(false);

  function toggleGrid() {
    vttStore.showGrid = !vttStore.showGrid;
    emitToPlayerView('toggle_player_grid', { show: vttStore.showGrid });
  }

  function toggleBlackout() {
    isBlackout = !isBlackout;
    emitToPlayerView('toggle_player_blackout', { active: isBlackout });
  }

  function setGridSize(val: number) {
    vttStore.gridSize = Math.max(10, Math.min(200, val));
    emitToPlayerView('toggle_player_grid', { show: vttStore.showGrid, size: vttStore.gridSize });
  }

  function getAllImages(entries: VaultEntry[], parent = ''): { path: string; name: string }[] {
    let images: { path: string; name: string }[] = [];
    for (const e of entries) {
      if (e.is_dir && e.children) {
        images = [...images, ...getAllImages(e.children, parent + e.name + '/')];
      } else {
        const ext = e.extension?.toLowerCase();
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
          images.push({ path: parent + e.name, name: e.name });
        }
      }
    }
    return images;
  }

  async function selectMap(relativePath: string) {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    try {
      const base64 = await readFileBase64(`${vaultPath}/${relativePath}`);
      const ext = relativePath.split('.').pop()?.toLowerCase();
      let mime = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
      else if (ext === 'webp') mime = 'image/webp';
      const dataUrl = `data:${mime};base64,${base64}`;
      vttStore.currentMap = dataUrl;
      await emitToPlayerView('set_player_map', { url: dataUrl });
      if (isBlackout) toggleBlackout();
      showMapPicker = false;
    } catch (err) {
      console.error('Failed to load map:', err);
    }
  }

  function closeMap() {
    vttStore.currentMap = null;
    emitToPlayerView('set_player_map', { url: null });
  }

  let tokenCount = 0;
  function createTestToken() {
    tokenCount++;
    addGmToken({
      id: Math.random().toString(36).slice(2),
      name: `Token ${tokenCount}`,
      x: 125 + (tokenCount % 8) * 65,
      y: 125 + Math.floor(tokenCount / 8) * 65,
      size: 50,
      color: 0x3b82f6,
      hp: 10,
      maxHp: 10,
      visionRange: 0,
      isEnemy: false,
    });
  }
</script>

<div class="vtt-toolbar">
  <div class="toolbar-title">🕹️ Contrôle Joueurs</div>

  {#if vttStore.currentMap}
    <div class="tools-group">
      <button class="btn" class:active={vttStore.mode === 'select'}    onclick={() => vttStore.mode = 'select'}>👆 Sélect</button>
      <button class="btn" class:active={vttStore.mode === 'fog-reveal'} onclick={() => vttStore.mode = 'fog-reveal'}>👁️ Révéler</button>
      <button class="btn" class:active={vttStore.mode === 'fog-hide'}   onclick={() => vttStore.mode = 'fog-hide'}>⬛ Cacher</button>
      <button class="btn" class:active={vttStore.mode === 'measure'}    onclick={() => vttStore.mode = 'measure'}>📏 Règle</button>
      <div class="separator"></div>
      <button class="btn" onclick={createTestToken}>👹 +Token</button>
      <button class="btn" onclick={undoGmFow} title="Annuler la dernière zone de brouillard">↩️ FOW</button>
      <button class="btn" onclick={clearGmFow} title="Effacer tout le brouillard">🧹 Reset</button>
      <div class="separator"></div>
      <button
        class="btn combat-btn"
        class:active={vttStore.combatActive}
        onclick={() => vttStore.combatActive ? stopCombat() : startCombat()}
        title={vttStore.combatActive ? 'Terminer le combat' : 'Démarrer le tracker de combat'}
      >
        ⚔️ {vttStore.combatActive ? 'Combat ON' : 'Combat'}
      </button>
    </div>
  {/if}

  <div class="toolbar-actions">
    {#if !vttStore.currentMap}
      <button class="btn" onclick={() => showMapPicker = true}>🗺️ Charger Carte</button>
    {:else}
      <button class="btn" onclick={() => showMapPicker = true}>🗺️ Carte</button>
      <button class="btn" onclick={closeMap}>✖️ Fermer</button>
    {/if}

    <div class="grid-control" title="Taille de la grille (px)">
      <span class="grid-label">#</span>
      <input
        type="number"
        class="grid-input"
        value={vttStore.gridSize}
        min="10"
        max="200"
        step="5"
        onchange={(e) => setGridSize(Number((e.target as HTMLInputElement).value))}
      />
    </div>

    <button class="btn" class:active={vttStore.showGrid} onclick={toggleGrid}>#️⃣ Grille</button>
    <button class="btn blackout-btn" class:active={isBlackout} onclick={toggleBlackout}>
      {isBlackout ? '👁️ Écran' : '🕶️ Écran'}
    </button>
  </div>
</div>

<!-- Sélecteur de carte -->
{#if showMapPicker}
  {@const images = getAllImages(getVaultTree())}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={() => showMapPicker = false}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="picker-modal" onclick={e => e.stopPropagation()}>
      <div class="picker-header">
        <span>🗺️ Choisir une carte</span>
        <button class="picker-close" onclick={() => showMapPicker = false}>✕</button>
      </div>
      <div class="picker-list">
        {#if images.length === 0}
          <div class="picker-empty">Aucune image (PNG, JPG, WebP) dans le vault.</div>
        {:else}
          {#each images as img}
            <button class="picker-item" onclick={() => selectMap(img.path)}>
              <span class="picker-icon">🖼️</span>
              <span class="picker-name">{img.name}</span>
              <span class="picker-path">{img.path}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .vtt-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 8px;
  }

  .toolbar-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
  }

  .tools-group {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 12px;
    border-left: 1px solid var(--border);
    flex-wrap: wrap;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .separator {
    width: 1px;
    height: 18px;
    background: var(--border);
    margin: 0 2px;
  }

  .btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 3px 9px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .btn:hover { background: var(--bg-hover); color: var(--text-primary); }
  .btn.active {
    background: rgba(229, 168, 83, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }

  .combat-btn.active {
    background: rgba(239, 68, 68, 0.15);
    border-color: #ef4444;
    color: #ef4444;
  }

  .blackout-btn.active {
    background: rgba(200, 50, 50, 0.15);
    border-color: #c83232;
    color: #ff6b6b;
  }

  /* Contrôle taille de grille */
  .grid-control {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 6px;
  }

  .grid-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .grid-input {
    width: 44px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 12px;
    text-align: center;
    -moz-appearance: textfield;
  }
  .grid-input::-webkit-inner-spin-button,
  .grid-input::-webkit-outer-spin-button { -webkit-appearance: none; }

  /* Sélecteur de carte */
  .picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .picker-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: 480px;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: slideDown 0.15s ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .picker-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 16px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .picker-close:hover { background: var(--bg-hover); }

  .picker-list { overflow-y: auto; padding: 6px; }

  .picker-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }
  .picker-item:hover { background: var(--bg-hover); }

  .picker-icon { font-size: 18px; flex-shrink: 0; }
  .picker-name { font-size: 14px; color: var(--text-primary); font-weight: 500; }
  .picker-path {
    font-size: 11px;
    color: var(--text-muted);
    margin-left: auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .picker-empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
