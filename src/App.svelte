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
  import { openVault, reindex, openPlayerView, listMonitors, writeFile, createDirectory, emitToPlayerView } from '$lib/api';
  import type { MonitorInfo } from '$lib/api';
  import {
    vttStore,
    addGmFowShape, updateGmToken, syncStateToPlayerView, replaceGmToken, removeGmToken
  } from '$lib/stores/vtt.svelte';
  import { 
    getVaultTree, setVaultTree, 
    getVaultPath, setVaultPath,
    getActiveFile, setActiveFile,
    getActiveContent, setActiveContent,
    getIsDirty, setIsDirty,
    getSearchOpen, setSearchOpen 
  } from '$lib/stores/vault.svelte';

  // On utilise open() du plugin dialog pour le folder picker
  import { open } from '@tauri-apps/plugin-dialog';
  import { onMount } from 'svelte';
  import { documentDir, join } from '@tauri-apps/api/path';

  let isLoading = $state(false);
  let statusMessage = $state('');
  let showSettings = $state(false);
  let monitors = $state<MonitorInfo[]>([]);
  let showMonitorPicker = $state(false);
  let viewMode = $state<'editor' | 'graph'>('editor');

  onMount(async () => {
    const lastVault = localStorage.getItem('last_vault_path');
    if (lastVault) {
      try {
        await loadVault(lastVault);
      } catch {
        localStorage.removeItem('last_vault_path');
      }
    }
  });

  async function loadVault(vaultPath: string) {
    setVaultPath(vaultPath);
    const tree = await openVault(vaultPath);
    setVaultTree(tree);
    await reindex(vaultPath);
    localStorage.setItem('last_vault_path', vaultPath);
    await emitToPlayerView('sync_vault_path', { path: vaultPath });
  }

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
      await loadVault(vaultPath);

      statusMessage = 'Vault chargé avec succès';
      setTimeout(() => { statusMessage = ''; }, 3000);
    } catch (err) {
      console.error('Failed to open vault:', err);
      statusMessage = `Erreur: ${err}`;
    } finally {
      isLoading = false;
    }
  }

  async function handleCreateNewVault() {
    try {
      isLoading = true;
      statusMessage = 'Initialisation de la nouvelle aventure...';

      const docs = await documentDir();
      const baseDir = await join(docs, 'Grimoire');
      const name = window.prompt('Nom de votre campagne :', 'Ma Campagne');
      if (!name) return;

      const vaultPath = await join(baseDir, name);
      
      // Créer la structure de base
      await createDirectory(vaultPath, 'assets/maps');
      await createDirectory(vaultPath, 'assets/tokens');
      await createDirectory(vaultPath, 'assets/audio');
      await writeFile(vaultPath, 'Bienvenue.md', `# Bienvenue dans votre nouvelle aventure !\n\nCeci est votre Grimoire. Utilisez le panneau de gauche pour créer des notes.`);

      await loadVault(vaultPath);
      statusMessage = 'Nouveau vault créé !';
      setTimeout(() => { statusMessage = ''; }, 3000);
    } catch (err) {
      console.error('Failed to create vault:', err);
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
      showMonitorPicker = false;
      // Synchroniser l'état initial
      await emitToPlayerView('sync_vault_path', { path: getVaultPath() });
      await emitToPlayerView('set_player_map', { url: vttStore.currentMap });
      await emitToPlayerView('update_tokens', vttStore.tokens);
    } catch (err) {
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
        <div class="welcome-header">
          <div class="welcome-art">⚔️</div>
          <h2>Bienvenue dans Grimoire</h2>
          <p>Commencez par choisir ou créer une campagne.</p>
        </div>

        <div class="welcome-cards">
          <button class="welcome-card" onclick={handleCreateNewVault} disabled={isLoading}>
            <span class="card-icon">✨</span>
            <div class="card-text">
              <strong>Nouvelle Aventure</strong>
              <small>Crée un dossier organisé automatiquement dans vos Documents.</small>
            </div>
          </button>

          <button class="welcome-card" onclick={handleOpenVault} disabled={isLoading}>
            <span class="card-icon">📂</span>
            <div class="card-text">
              <strong>Ouvrir un Dossier</strong>
              <small>Sélectionnez un dossier existant sur votre ordinateur.</small>
            </div>
          </button>
        </div>
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
            vaultPath={getVaultPath()}
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
    padding: 32px;
    text-align: center;
    gap: 32px;
  }

  .welcome-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .welcome-art {
    font-size: 56px;
    margin-bottom: 8px;
    animation: floating 3s ease-in-out infinite;
  }

  @keyframes floating {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .welcome h2 {
    font-size: 20px;
    color: var(--accent);
    font-weight: 800;
  }

  .welcome p {
    font-size: 13px;
    color: var(--text-muted);
  }

  .welcome-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 320px;
  }

  .welcome-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    color: var(--text-primary);
  }

  .welcome-card:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .card-icon {
    font-size: 28px;
    flex-shrink: 0;
  }

  .card-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-text strong {
    font-size: 14px;
    font-weight: 700;
  }

  .card-text small {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.3;
  }

  .welcome-card:disabled {
    opacity: 0.5;
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
