<script lang="ts">
  import './app.css';
  import Sidebar from './components/Sidebar.svelte';
  import Editor from './components/Editor.svelte';
  import SearchPalette from './components/SearchPalette.svelte';
  import VTTToolbar from './components/VTTToolbar.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import MapCanvas from './components/MapCanvas.svelte';
  import InitiativeTracker from './components/InitiativeTracker.svelte';
  import AudioPlayer from './components/AudioPlayer.svelte';
  import GraphView from './components/GraphView.svelte';
  import { openVault, reindex, openPlayerView, listMonitors, writeFile } from '$lib/api';
  import type { MonitorInfo } from '$lib/api';
  import {
    vttStore,
    addGmFowShape, updateGmToken, syncStateToPlayerView, replaceGmToken, removeGmToken
  } from '$lib/stores/vtt.svelte';
  import {
    getVaultPath, setVaultPath,
    getVaultTree, setVaultTree,
    getSearchOpen, setSearchOpen,
    setActiveFile, setActiveContent, setIsDirty
  } from '$lib/stores/vault.svelte';

  // On utilise open() du plugin dialog pour le folder picker
  import { open } from '@tauri-apps/plugin-dialog';

  let isLoading = $state(false);
  let statusMessage = $state('');
  let showSettings = $state(false);
  let monitors = $state<MonitorInfo[]>([]);
  let showMonitorPicker = $state(false);
  let viewMode = $state<'editor' | 'graph'>('editor');

  async function handleOpenVault() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Sélectionner un Vault Grimoire',
      });

      if (!selected) return;

      isLoading = true;
      statusMessage = 'Chargement du vault...';

      const vaultPath = typeof selected === 'string' ? selected : selected[0];
      setVaultPath(vaultPath);

      // Charger l'arbre de fichiers
      const tree = await openVault(vaultPath);
      setVaultTree(tree);

      // Indexer le vault
      statusMessage = 'Indexation en cours...';
      const count = await reindex(vaultPath);
      statusMessage = `${count} fichiers indexés`;

      setTimeout(() => { statusMessage = ''; }, 3000);
    } catch (err) {
      console.error('Failed to open vault:', err);
      statusMessage = `Erreur: ${err}`;
    } finally {
      isLoading = false;
    }
  }

  async function launchPlayerView() {
    try {
      const monitorList = await listMonitors();
      if (monitorList.length > 1) {
        monitors = monitorList;
        showMonitorPicker = true;
      } else {
        await openOnMonitor(0);
      }
    } catch(err) {
      console.error('Failed to list monitors:', err);
      statusMessage = `Erreur VTT: ${err}`;
    }
  }

  async function openOnMonitor(index: number) {
    showMonitorPicker = false;
    try {
      await openPlayerView(index);
      statusMessage = `Vue joueur lancée sur l'écran ${index + 1}`;
      setTimeout(() => syncStateToPlayerView(), 1500);
      setTimeout(() => { statusMessage = ''; }, 3000);
    } catch(err) {
      console.error('Failed to open player view:', err);
      statusMessage = `Erreur VTT: ${err}`;
    }
  }

  async function handleReindex() {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    statusMessage = 'Réindexation…';
    try {
      const count = await reindex(vaultPath);
      statusMessage = `${count} fichiers réindexés`;
    } catch {
      statusMessage = 'Erreur de réindexation';
    }
    setTimeout(() => { statusMessage = ''; }, 3000);
  }

  async function handleNewFile() {
    const vaultPath = getVaultPath();
    if (!vaultPath) return;
    const name = window.prompt('Nom du fichier (sans extension) :');
    if (!name?.trim()) return;
    const relPath = name.trim() + '.md';
    const initialContent = `# ${name.trim()}\n\n`;
    try {
      await writeFile(vaultPath, relPath, initialContent);
      const tree = await openVault(vaultPath);
      setVaultTree(tree);
      setActiveFile(relPath);
      setActiveContent(initialContent);
      setIsDirty(false);
    } catch (err) {
      statusMessage = `Erreur: ${err}`;
    }
  }

  // Raccourci clavier global
  function handleGlobalKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      setSearchOpen(!getSearchOpen());
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      if (getVaultPath()) handleNewFile();
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<SearchPalette />
<AudioPlayer src={vttStore.audioSrc} volume={vttStore.audioVolume} />

{#if showMonitorPicker}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="monitor-backdrop" onclick={() => showMonitorPicker = false}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="monitor-modal" onclick={e => e.stopPropagation()}>
      <h3>🖥️ Choisir un écran</h3>
      <div class="monitor-list">
        {#each monitors as monitor, i}
          <button class="monitor-item" onclick={() => openOnMonitor(i)}>
            <span class="monitor-icon">{monitor.is_primary ? '🖥️' : '📺'}</span>
            <span class="monitor-info">
              <strong>{monitor.name || `Écran ${i + 1}`}</strong>
              <small>{monitor.size[0]}×{monitor.size[1]}{monitor.is_primary ? ' · Principal' : ''}</small>
            </span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

{#if showSettings}
  <SettingsModal onClose={() => showSettings = false} />
{/if}

<div class="app-layout">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <span class="logo-icon">📜</span>
        <span class="logo-text">Grimoire</span>
      </div>
    </div>

    {#if getVaultPath()}
      <div class="vault-info">
        <span class="vault-name" title={getVaultPath()}>
          📁 {getVaultPath().split('/').pop()}
        </span>
        <button onclick={() => setSearchOpen(true)} class="search-trigger" title="Rechercher (Ctrl+P)">
          🔍
        </button>
      </div>

      <nav class="sidebar-nav">
        <Sidebar entries={getVaultTree()} />
      </nav>

      <div class="sidebar-footer">
        <button onclick={launchPlayerView} class="footer-btn vtt-btn" title="Ouvrir la vue Joueurs sur un autre écran">
          🖥️ Lancer Vue Joueurs
        </button>
        <div class="footer-row">
          <button onclick={handleNewFile} class="footer-btn half" title="Nouveau fichier (Ctrl+N)">
            📄 Nouveau
          </button>
          <button onclick={handleReindex} class="footer-btn half" title="Rafraîchir l'index de recherche">
            🔄 Réindexer
          </button>
        </div>
        <button onclick={handleOpenVault} class="footer-btn" title="Changer de vault">
          📂 Changer de Vault
        </button>
        <button onclick={() => showSettings = true} class="footer-btn" title="Réglages">
          ⚙️ Réglages
        </button>
      </div>
    {:else}
      <div class="welcome">
        <div class="welcome-art">⚔️</div>
        <h2>Bienvenue, Maître</h2>
        <p>Ouvrez un vault pour commencer votre session.</p>
        <button onclick={handleOpenVault} class="open-vault-btn" disabled={isLoading}>
          {#if isLoading}
            ⏳ Chargement...
          {:else}
            📂 Ouvrir un Vault
          {/if}
        </button>
      </div>
    {/if}
  </aside>

  <!-- Main Content -->
  <main class="main-content">
    {#if getVaultPath()}
      <VTTToolbar />
    {/if}
    
    {#if vttStore.currentMap}
      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <div style="flex: 1; min-height: 0;">
          <MapCanvas
            mapUrl={vttStore.currentMap}
            gridEnabled={vttStore.showGrid}
            gridSize={vttStore.gridSize}
            isGM={true}
            fowShapes={vttStore.fowShapes}
            tokens={vttStore.tokens}
            vttMode={vttStore.mode}
            onFowUpdate={addGmFowShape}
            onTokenMove={updateGmToken}
            onTokenUpdate={replaceGmToken}
            onTokenDelete={removeGmToken}
          />
        </div>
        {#if vttStore.combatActive}
          <InitiativeTracker />
        {/if}
      </div>
    {:else}
      <div class="view-header">
        <div class="view-toggle">
          <button class:active={viewMode === 'editor'} onclick={() => viewMode = 'editor'}>📄 Éditeur</button>
          <button class:active={viewMode === 'graph'} onclick={() => viewMode = 'graph'}>🕸️ Graphe</button>
        </div>
      </div>
      {#if viewMode === 'editor'}
        <Editor />
      {:else}
        <GraphView />
      {/if}
    {/if}
  </main>
</div>

{#if statusMessage}
  <div class="status-bar">
    {statusMessage}
  </div>
{/if}

<style>
  .app-layout {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  /* ── Sidebar ──────────────────────────────────────────────── */

  .sidebar {
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-icon { font-size: 24px; }

  .logo-text {
    font-size: 20px;
    font-weight: 800;
    background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.5px;
  }

  .vault-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .vault-name {
    font-size: 12px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-trigger {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all var(--transition-fast);
  }
  .search-trigger:hover { background: var(--bg-hover); }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .sidebar-footer {
    padding: 8px;
    border-top: 1px solid var(--border-subtle);
  }

  .footer-row {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
  }

  .footer-btn {
    width: 100%;
    padding: 6px;
    margin-bottom: 6px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .footer-btn.half { flex: 1; width: auto; margin-bottom: 0; }
  .footer-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .vtt-btn {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }
  .vtt-btn:hover {
    background: rgba(229, 168, 83, 0.1);
  }

  /* ── Welcome ──────────────────────────────────────────────── */

  .welcome {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
    gap: 12px;
  }

  .welcome-art {
    font-size: 48px;
    opacity: 0.7;
    animation: pulse 3s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.05); opacity: 1; }
  }

  .welcome h2 {
    font-size: 18px;
    color: var(--accent);
    font-weight: 700;
  }

  .welcome p {
    font-size: 12px;
    color: var(--text-muted);
  }

  .open-vault-btn {
    margin-top: 8px;
    padding: 10px 20px;
    background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
    color: var(--bg-primary);
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all var(--transition-normal);
    box-shadow: 0 4px 16px rgba(229, 168, 83, 0.3);
  }

  .open-vault-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(229, 168, 83, 0.4);
  }

  .open-vault-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  /* ── Main Content ─────────────────────────────────────────── */

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .view-header {
    display: flex;
    justify-content: center;
    padding: 8px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
  }

  .view-toggle {
    display: flex;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 2px;
  }

  .view-toggle button {
    background: transparent;
    border: none;
    padding: 4px 16px;
    border-radius: 18px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-toggle button.active {
    background: var(--accent);
    color: var(--bg-primary);
  }

  /* ── Status Bar ───────────────────────────────────────────── */

  .status-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 4px 16px;
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-secondary);
    z-index: 100;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── Monitor picker ───────────────────────────────────────── */

  .monitor-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .monitor-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    min-width: 320px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    animation: fadeIn 0.15s ease;
  }

  .monitor-modal h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    color: var(--text-primary);
  }

  .monitor-list { display: flex; flex-direction: column; gap: 8px; }

  .monitor-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    color: var(--text-primary);
  }
  .monitor-item:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }

  .monitor-icon { font-size: 28px; }

  .monitor-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .monitor-info strong { font-size: 14px; }
  .monitor-info small { font-size: 11px; color: var(--text-muted); }
</style>
